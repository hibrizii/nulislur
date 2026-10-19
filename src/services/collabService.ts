import * as Y from 'yjs';
import { Awareness, encodeAwarenessUpdate, applyAwarenessUpdate } from 'y-protocols/awareness';
import { supabase, isSupabaseConfigured } from './supabase';
import { DataService } from './dataService';
import { uint8ArrayToBase64, base64ToUint8Array } from '../utils/binaryUtils';

export interface CollabPeer {
  username: string;
  nama: string;
  warna: string;
  online: boolean;
  terakhirAktif?: number;
}

export interface CollabSession {
  ydoc: Y.Doc;
  awareness: Awareness;
  channel: any;
  destroy: () => void;
  broadcastTitleChange: (newTitle: string) => void;
  getYjsState: () => Uint8Array;
  hasExistingContent: boolean;
}

/**
 * Menginisialisasi sesi kolaborasi real-time berbasis CRDT Yjs.
 * Menggunakan Y.Doc + Awareness yang terikat langsung ke ProseMirror/TipTap.
 * Sinkronisasi disalurkan melalui Supabase Realtime Broadcast + Browser BroadcastChannel (0ms delay multi-tab).
 * Menjamin pengetikan bersama bebas tabrakan (conflict-free) dan kursor stabil tanpa goyang.
 */
export async function initCollabSession(
  docId: string,
  user: { username: string; nama: string; warna?: string },
  callbacks?: {
    onPeersChange?: (peers: CollabPeer[]) => void;
    onTitleChange?: (newTitle: string) => void;
  },
  _initialHtml?: string
): Promise<CollabSession> {
  const ydoc = new Y.Doc();
  const awareness = new Awareness(ydoc);
  const userColor = user.warna || '#2563EB';

  // Set identitas penulis lokal di Awareness
  awareness.setLocalStateField('user', {
    name: user.nama,
    color: userColor,
    username: user.username,
  });

  // 1. Muat snapshot binary state Yjs yang tersimpan (dari Supabase / localStorage)
  let hasExistingContent = false;
  try {
    const savedState = await DataService.getYjsDocState(docId);
    if (savedState && savedState.byteLength > 0) {
      Y.applyUpdate(ydoc, savedState, 'initial');
      const frag = ydoc.getXmlFragment('default');
      if (frag.length > 0) {
        hasExistingContent = true;
      }
    }
  } catch (err) {
    console.warn('[Collab] Gagal memuat snapshot awal:', err);
  }

  const channelName = `collab_doc_${docId}`;
  const localBcName = `nulislur_bc_collab_${docId}`;
  let localBc: BroadcastChannel | null = null;

  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    try {
      localBc = new BroadcastChannel(localBcName);
    } catch {}
  }

  let channel: any = null;
  let isChannelSubscribed = false;
  let isDestroyed = false;
  let heartbeatTimer: any = null;
  let reconnectTimer: any = null;
  const pendingBroadcasts: Array<{ type: string; event: string; payload: any }> = [];

  const sendBroadcast = (event: string, payload: any) => {
    // A. Kirim via Supabase Broadcast (antar device / browser berbeda)
    if (channel && !isDestroyed) {
      if (isChannelSubscribed) {
        channel.send({
          type: 'broadcast',
          event,
          payload,
        }).catch(() => {});
      } else {
        if (pendingBroadcasts.length < 50) {
          pendingBroadcasts.push({ type: 'broadcast', event, payload });
        }
      }
    }

    // B. Kirim via Local BroadcastChannel (antar tab di browser yang sama - seketika 0ms)
    if (localBc && !isDestroyed) {
      try {
        localBc.postMessage({
          type: event,
          ...payload,
        });
      } catch {}
    }
  };

  // 2. Hubungkan event pengetikan Yjs lokal -> broadcast update binary diff ke rekan
  ydoc.on('update', (update: Uint8Array, origin: any) => {
    if (origin === 'remote' || origin === 'initial') return;
    const b64 = uint8ArrayToBase64(update);
    sendBroadcast('yjs_update', {
      update: b64,
      sender: user.username,
      clientId: ydoc.clientID,
    });
  });

  // 3. Hubungkan event pergerakan kursor / seleksi Awareness lokal -> broadcast ke rekan
  awareness.on('update', ({ added, updated, removed }: any, origin: any) => {
    if (origin === 'remote') return;
    const changedClients = added.concat(updated, removed);
    const update = encodeAwarenessUpdate(awareness, changedClients);
    sendBroadcast('awareness_update', {
      update: uint8ArrayToBase64(update),
      sender: user.username,
      clientId: ydoc.clientID,
    });
  });

  // Helper sync peers list ke callback
  const syncPeersList = () => {
    const peersMap = new Map<string, CollabPeer>();

    // Tambahkan user saat ini
    peersMap.set(user.username, {
      username: user.username,
      nama: user.nama,
      warna: userColor,
      online: true,
      terakhirAktif: Date.now(),
    });

    // Ambil dari Supabase Presence jika ada
    if (channel) {
      try {
        const presenceState = channel.presenceState();
        Object.keys(presenceState).forEach((key) => {
          const presences = presenceState[key] as any[];
          if (presences && presences.length > 0) {
            const p = presences[presences.length - 1];
            const u = p.username || key;
            peersMap.set(u, {
              username: u,
              nama: p.nama || u,
              warna: p.warna || '#2563EB',
              online: true,
              terakhirAktif: p.terakhirAktif || Date.now(),
            });
          }
        });
      } catch {}
    }

    // Ambil dari Awareness states
    const states = awareness.getStates();
    states.forEach((state: any) => {
      if (state.user && state.user.username) {
        const u = state.user.username;
        peersMap.set(u, {
          username: u,
          nama: state.user.name || u,
          warna: state.user.color || '#2563EB',
          online: true,
          terakhirAktif: Date.now(),
        });
      }
    });

    callbacks?.onPeersChange?.(Array.from(peersMap.values()));
  };

  awareness.on('change', () => {
    syncPeersList();
  });

  // 4. Handshake Protokol Yjs
  const handleSyncStep1 = (msg: { sv: string; sender: string; clientId?: number }) => {
    if (msg.clientId && msg.clientId === ydoc.clientID) return;
    try {
      const remoteSv = base64ToUint8Array(msg.sv);
      const diff = Y.encodeStateAsUpdate(ydoc, remoteSv);
      sendBroadcast('sync_step_2', {
        update: uint8ArrayToBase64(diff),
        sender: user.username,
        clientId: ydoc.clientID,
        target: msg.sender,
        targetClientId: msg.clientId,
      });

      // Kirim juga snapshot awareness saat ini agar kursor langsung muncul
      const allClients = Array.from(awareness.getStates().keys());
      if (allClients.length > 0) {
        const awarenessAll = encodeAwarenessUpdate(awareness, allClients);
        sendBroadcast('awareness_update', {
          update: uint8ArrayToBase64(awarenessAll),
          sender: user.username,
          clientId: ydoc.clientID,
        });
      }
    } catch (err) {
      console.warn('[Collab] Gagal handle sync_step_1:', err);
    }
  };

  const handleSyncStep2 = (msg: { update: string; sender: string; clientId?: number; target?: string; targetClientId?: number }) => {
    if (msg.clientId && msg.clientId === ydoc.clientID) return;
    if (msg.targetClientId && msg.targetClientId !== ydoc.clientID) return;
    try {
      const diff = base64ToUint8Array(msg.update);
      Y.applyUpdate(ydoc, diff, 'remote');
    } catch (err) {
      console.warn('[Collab] Gagal handle sync_step_2:', err);
    }
  };

  const handleYjsUpdate = (msg: { update: string; sender: string; clientId?: number }) => {
    if (msg.clientId && msg.clientId === ydoc.clientID) return;
    try {
      const update = base64ToUint8Array(msg.update);
      Y.applyUpdate(ydoc, update, 'remote');
    } catch (err) {
      console.warn('[Collab] Gagal handle yjs_update:', err);
    }
  };

  const handleAwarenessUpdate = (msg: { update: string; sender: string; clientId?: number }) => {
    if (msg.clientId && msg.clientId === ydoc.clientID) return;
    try {
      const update = base64ToUint8Array(msg.update);
      applyAwarenessUpdate(awareness, update, 'remote');
    } catch (err) {
      console.warn('[Collab] Gagal handle awareness_update:', err);
    }
  };

  const handleTitleChange = (msg: { title: string; sender: string; clientId?: number }) => {
    if (msg.clientId && msg.clientId === ydoc.clientID) return;
    if (msg.title !== undefined) {
      callbacks?.onTitleChange?.(msg.title);
    }
  };

  const sendInitialSyncRequest = () => {
    const sv = Y.encodeStateVector(ydoc);
    sendBroadcast('sync_step_1', {
      sv: uint8ArrayToBase64(sv),
      sender: user.username,
      clientId: ydoc.clientID,
    });
    // Kirim state awareness lokal
    const selfAwareness = encodeAwarenessUpdate(awareness, [awareness.clientID]);
    sendBroadcast('awareness_update', {
      update: uint8ArrayToBase64(selfAwareness),
      sender: user.username,
      clientId: ydoc.clientID,
    });
  };

  // 5. Inisialisasi Supabase Channel jika tersedia
  if (isSupabaseConfigured) {
    // Bersihkan instance channel lama dengan nama yang sama jika ada sebelum membuat baru
    try {
      const existingChannels = (supabase as any).getChannels ? (supabase as any).getChannels() : [];
      const oldChannel = existingChannels.find(
        (ch: any) => ch.topic === `realtime:${channelName}` || ch.subTopic === channelName
      );
      if (oldChannel) {
        supabase.removeChannel(oldChannel);
      }
    } catch {}

    channel = supabase.channel(channelName, {
      config: {
        presence: { key: user.username },
        broadcast: { ack: false, self: false },
      },
    });

    channel.on('broadcast', { event: 'yjs_update' }, (msg: any) => {
      if (msg.payload?.update) handleYjsUpdate(msg.payload);
    });

    channel.on('broadcast', { event: 'awareness_update' }, (msg: any) => {
      if (msg.payload?.update) handleAwarenessUpdate(msg.payload);
    });

    channel.on('broadcast', { event: 'sync_step_1' }, (msg: any) => {
      if (msg.payload?.sv) handleSyncStep1(msg.payload);
    });

    channel.on('broadcast', { event: 'sync_step_2' }, (msg: any) => {
      if (msg.payload?.update) handleSyncStep2(msg.payload);
    });

    channel.on('broadcast', { event: 'title_change' }, (msg: any) => {
      if (msg.payload?.title !== undefined) handleTitleChange(msg.payload);
    });

    channel.on('presence', { event: 'sync' }, () => {
      syncPeersList();
    });

    channel.on('presence', { event: 'join' }, () => {
      syncPeersList();
      // Rekan baru saja masuk: Segera kirim handshake sync agar rekan seketika mendapatkan update naskah
      sendInitialSyncRequest();
    });

    channel.on('presence', { event: 'leave' }, () => {
      syncPeersList();
    });

    const subscribeChannel = () => {
      if (isDestroyed || !channel) return;
      channel.subscribe(async (status: string, err?: any) => {
        if (isDestroyed) return;
        if (status === 'SUBSCRIBED') {
          isChannelSubscribed = true;
          try {
            await channel.track({
              username: user.username,
              nama: user.nama,
              warna: userColor,
              terakhirAktif: Date.now(),
            });
          } catch {}

          // Kirim antrean broadcast yang tertahan sebelum koneksi tersambung
          while (pendingBroadcasts.length > 0) {
            const item = pendingBroadcasts.shift();
            if (item) {
              channel.send(item).catch(() => {});
            }
          }

          // Mulai jabat tangan sync dengan rekan online
          sendInitialSyncRequest();
        } else if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') {
          console.warn(`[Collab] Supabase channel status: ${status}. Mencoba reconnect...`, err);
          isChannelSubscribed = false;
          if (reconnectTimer) clearTimeout(reconnectTimer);
          reconnectTimer = setTimeout(() => {
            if (!isDestroyed && channel) {
              subscribeChannel();
            }
          }, 2000);
        } else if (status === 'CLOSED') {
          isChannelSubscribed = false;
        }
      });
    };

    subscribeChannel();

    // Heartbeat berkala (12 detik) untuk menjaga koneksi WebSocket tetap hidup di jaringan sekolah
    heartbeatTimer = setInterval(() => {
      if (isDestroyed) return;
      if (channel && isChannelSubscribed) {
        channel.track({
          username: user.username,
          nama: user.nama,
          warna: userColor,
          terakhirAktif: Date.now(),
        }).catch(() => {});

        const selfAwareness = encodeAwarenessUpdate(awareness, [awareness.clientID]);
        sendBroadcast('awareness_update', {
          update: uint8ArrayToBase64(selfAwareness),
          sender: user.username,
          clientId: ydoc.clientID,
        });
      }
    }, 12000);
  }

  // 6. Listener Local BroadcastChannel (Antar-tab browser yang sama)
  if (localBc) {
    localBc.onmessage = (event) => {
      const data = event.data;
      if (!data) return;

      if (data.type === 'yjs_update' && data.update) {
        handleYjsUpdate(data);
      } else if (data.type === 'awareness_update' && data.update) {
        handleAwarenessUpdate(data);
      } else if (data.type === 'sync_step_1' && data.sv) {
        handleSyncStep1(data);
      } else if (data.type === 'sync_step_2' && data.update) {
        handleSyncStep2(data);
      } else if (data.type === 'title_change' && data.title !== undefined) {
        handleTitleChange(data);
      }
    };

    // Kirim request sync ke tab lain di browser yang sama
    setTimeout(() => {
      sendInitialSyncRequest();
    }, 50);
  }

  const broadcastTitleChange = (newTitle: string) => {
    sendBroadcast('title_change', {
      title: newTitle,
      sender: user.username,
      clientId: ydoc.clientID,
    });
  };

  const getYjsState = (): Uint8Array => {
    return Y.encodeStateAsUpdate(ydoc);
  };

  const destroy = () => {
    isDestroyed = true;
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    try {
      awareness.destroy();
    } catch {}
    if (channel) {
      try {
        channel.untrack();
      } catch {}
      try {
        supabase.removeChannel(channel);
      } catch {}
      channel = null;
    }
    if (localBc) {
      try {
        localBc.close();
      } catch {}
      localBc = null;
    }
    try {
      ydoc.destroy();
    } catch {}
  };

  return {
    ydoc,
    awareness,
    channel,
    destroy,
    broadcastTitleChange,
    getYjsState,
    hasExistingContent,
  };
}
