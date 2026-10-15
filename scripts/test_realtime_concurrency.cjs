const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://ttxmnzvsjjrfyinfglwi.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_dJBlRtovn2Ec889dK-Vftw_AL2m93Pz';

const NUM_CLIENTS = 20;

async function testRealtimeConcurrency() {
  console.log('================================================================');
  console.log(`🔌 UJI KONEKSI REALTIME WEBSOCKET: ${NUM_CLIENTS} SISWA SERENTAK`);
  console.log('================================================================\n');

  const clients = [];
  const channels = [];
  const subscriptionResults = [];

  for (let i = 0; i < NUM_CLIENTS; i++) {
    const client = createClient(SUPABASE_URL, SUPABASE_KEY);
    clients.push(client);
    const username = `siswa_test_${i + 1}`;

    const subPromise = new Promise((resolve) => {
      const channel = client
        .channel(`public:dokumen:${username}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'dokumen', filter: `username=eq.${username}` }, () => {})
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            resolve({ clientIndex: i + 1, username, status, ok: true });
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            resolve({ clientIndex: i + 1, username, status, ok: false });
          }
        });
      channels.push({ client, channel });
    });

    subscriptionResults.push(subPromise);
  }

  const startTime = Date.now();
  const results = await Promise.all(subscriptionResults);
  const duration = Date.now() - startTime;

  const successfulSubs = results.filter(r => r.ok).length;
  console.log(`✅ HASIL KONEKSI REALTIME WEBSOCKET (${duration}ms):`);
  console.log(`   - Sukses Tersambung (SUBSCRIBED): ${successfulSubs}/${NUM_CLIENTS}`);
  console.log(`   - Gagal / Error: ${NUM_CLIENTS - successfulSubs}`);

  // Disconnect all clients cleanly
  for (const { client, channel } of channels) {
    client.removeChannel(channel);
  }

  console.log('✨ Seluruh saluran Realtime WebSocket telah ditutup dengan aman.\n');
  if (successfulSubs === NUM_CLIENTS) {
    console.log('🎉 KESIMPULAN REALTIME: 20 KONEKSI WEBSOCKET SISWA STABIL & LOLOS PENGUJIAN!');
  } else {
    console.log('⚠️ KESIMPULAN REALTIME: Ada beberapa koneksi yang tidak terhubung.');
  }
}

testRealtimeConcurrency().catch(console.error);
