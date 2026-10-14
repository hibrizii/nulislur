import React, { useState, useEffect } from 'react';
import { getWaktuSekarang } from '../../services/dataService';
import { 
  History, 
  RotateCcw, 
  ShieldCheck, 
  Clock, 
  Check, 
  X, 
  Save, 
  Eye, 
  Sparkles,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

export interface DocumentSnapshot {
  id: string;
  timestamp: number;
  waktu: string;
  judul: string;
  teks: string;
  wordCount: number;
  charCount: number;
  trigger: 'auto' | 'manual' | 'before_restore';
}

interface RiwayatCadanganModalProps {
  isOpen: boolean;
  onClose: () => void;
  docId: string;
  currentJudul: string;
  currentTeks: string;
  onRestore: (snapshot: DocumentSnapshot) => void;
}

export const RiwayatCadanganModal: React.FC<RiwayatCadanganModalProps> = ({
  isOpen,
  onClose,
  docId,
  currentJudul,
  currentTeks,
  onRestore,
}) => {
  const [snapshots, setSnapshots] = useState<DocumentSnapshot[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pesanNotif, setPesanNotif] = useState<string | null>(null);

  // Muat daftar snapshot dari localStorage
  const loadSnapshots = () => {
    if (!docId || typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(`nulislur_history_${docId}`);
      let list: DocumentSnapshot[] = raw ? JSON.parse(raw) : [];

      // Integrasikan juga dengan backup darurat terbaru jika ada
      const rawBackup = localStorage.getItem(`nulislur_backup_${docId}`);
      if (rawBackup) {
        try {
          const parsedBackup = JSON.parse(rawBackup);
          const exists = list.some((s) => Math.abs(s.timestamp - (parsedBackup.timestamp || 0)) < 3000);
          if (!exists && parsedBackup.teks && parsedBackup.teks.length > 10) {
            const cleanTeks = parsedBackup.teks.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
            list.unshift({
              id: `backup_${parsedBackup.timestamp || Date.now()}`,
              timestamp: parsedBackup.timestamp || Date.now(),
              waktu: parsedBackup.waktu || 'Cadangan Terakhir',
              judul: parsedBackup.judul || 'Tanpa Judul',
              teks: parsedBackup.teks,
              wordCount: cleanTeks ? cleanTeks.split(/\s+/).filter(Boolean).length : 0,
              charCount: cleanTeks.length,
              trigger: 'auto',
            });
          }
        } catch {}
      }

      // Urutkan dari yang terbaru ke terlama
      list.sort((a, b) => b.timestamp - a.timestamp);
      setSnapshots(list);
    } catch (e) {
      console.warn('Gagal memuat riwayat cadangan:', e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadSnapshots();
    }
  }, [isOpen, docId]);

  if (!isOpen) return null;

  // Buat titik cadangan manual sekarang
  const handleBuatCadanganManual = () => {
    if (!currentTeks || currentTeks === '<p></p>' || currentTeks === '<p><br></p>') {
      alert('Naskah masih kosong, belum ada konten yang perlu dicadangkan.');
      return;
    }

    const clean = currentTeks.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const newSnap: DocumentSnapshot = {
      id: `manual_${Date.now()}`,
      timestamp: Date.now(),
      waktu: getWaktuSekarang(),
      judul: currentJudul || 'Tanpa Judul',
      teks: currentTeks,
      wordCount: clean ? clean.split(/\s+/).filter(Boolean).length : 0,
      charCount: clean.length,
      trigger: 'manual',
    };

    try {
      const raw = localStorage.getItem(`nulislur_history_${docId}`);
      const list: DocumentSnapshot[] = raw ? JSON.parse(raw) : [];
      list.unshift(newSnap);
      const capped = list.slice(0, 30);
      localStorage.setItem(`nulislur_history_${docId}`, JSON.stringify(capped));
      setSnapshots(capped);
      setPesanNotif('Titik cadangan manual berhasil dibuat!');
      setTimeout(() => setPesanNotif(null), 3000);
    } catch (e) {
      alert('Gagal menyimpan cadangan: Memori peramban penuh.');
    }
  };

  // Pulihkan naskah ke snapshot tertentu
  const handlePulihkan = (snap: DocumentSnapshot) => {
    const konfirmasi = window.confirm(
      `Apakah kamu yakin ingin memulihkan naskah ke versi "${snap.waktu}" (${snap.wordCount} kata)?\n\nNaskah saat ini akan disimpan otomatis sebagai cadangan darurat sebelum dipulihkan.`
    );
    if (!konfirmasi) return;

    // Simpan dulu kondisi saat ini sebagai checkpoint 'before_restore'
    if (currentTeks && currentTeks.length > 10) {
      try {
        const cleanCurrent = currentTeks.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        const preRestoreSnap: DocumentSnapshot = {
          id: `pre_restore_${Date.now()}`,
          timestamp: Date.now(),
          waktu: getWaktuSekarang(),
          judul: currentJudul || 'Tanpa Judul',
          teks: currentTeks,
          wordCount: cleanCurrent ? cleanCurrent.split(/\s+/).filter(Boolean).length : 0,
          charCount: cleanCurrent.length,
          trigger: 'before_restore',
        };
        const raw = localStorage.getItem(`nulislur_history_${docId}`);
        const list: DocumentSnapshot[] = raw ? JSON.parse(raw) : [];
        list.unshift(preRestoreSnap);
        localStorage.setItem(`nulislur_history_${docId}`, JSON.stringify(list.slice(0, 30)));
      } catch {}
    }

    onRestore(snap);
    setPesanNotif(`Naskah berhasil dipulihkan ke versi ${snap.waktu}!`);
    setTimeout(() => {
      setPesanNotif(null);
      onClose();
    }, 1500);
  };

  const getTriggerLabel = (trigger: DocumentSnapshot['trigger']) => {
    switch (trigger) {
      case 'manual':
        return { label: 'Cadangan Manual', color: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800' };
      case 'before_restore':
        return { label: 'Sebelum Pemulihan', color: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800' };
      default:
        return { label: 'Otomatis Berkala', color: 'bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300 border-stone-200 dark:border-stone-700' };
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-fade-in">
      <div className="editorial-card bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 w-full max-w-2xl max-h-[88vh] flex flex-col shadow-2xl rounded-2xl overflow-hidden animate-scale-in">
        
        {/* Header Modal */}
        <div className="p-5 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between bg-stone-50/70 dark:bg-stone-850/70">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
              <History size={20} />
            </div>
            <div>
              <h3 className="font-serif text-lg font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                Riwayat Cadangan Naskah
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Penyelamat tulisan & checkpoint berkala karya ilmiah, cerpen, atau novel Anda.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 hover:bg-stone-200/50 dark:hover:bg-stone-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Notifikasi Status */}
        {pesanNotif && (
          <div className="bg-emerald-50 dark:bg-emerald-950/50 border-b border-emerald-200 dark:border-emerald-800 px-5 py-2.5 flex items-center gap-2 text-xs font-semibold text-emerald-800 dark:text-emerald-200">
            <Check size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{pesanNotif}</span>
          </div>
        )}

        {/* Banner Perlindungan Data */}
        <div className="px-5 py-3.5 bg-purple-50/50 dark:bg-purple-950/20 border-b border-purple-100 dark:border-purple-900/40 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-medium text-stone-700 dark:text-stone-300">
            <ShieldCheck size={16} className="text-purple-600 dark:text-purple-400 shrink-0" />
            <span>Sistem Perlindungan <strong>Zero-Trust</strong> & <strong>Cadangan Lokal 0ms</strong> Aktif</span>
          </div>
          <button
            type="button"
            onClick={handleBuatCadanganManual}
            className="editorial-btn bg-purple-600 hover:bg-purple-700 text-white py-1.5 px-3 text-xs flex items-center gap-1.5 font-medium shadow-xs cursor-pointer rounded-lg"
          >
            <Save size={13} />
            <span>Buat Cadangan Sekarang</span>
          </button>
        </div>

        {/* Daftar Snapshot */}
        <div className="p-5 overflow-y-auto flex-1 space-y-3">
          {snapshots.length === 0 ? (
            <div className="text-center py-12 px-4">
              <Clock size={36} className="mx-auto text-stone-300 dark:text-stone-700 mb-2.5" />
              <p className="text-sm font-semibold text-stone-700 dark:text-stone-300">Belum ada titik cadangan</p>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 max-w-sm mx-auto">
                Sistem akan membuat titik cadangan otomatis setiap Anda mengetik secara signifikan, atau Anda dapat menekan tombol &quot;Buat Cadangan Sekarang&quot;.
              </p>
            </div>
          ) : (
            snapshots.map((snap) => {
              const badge = getTriggerLabel(snap.trigger);
              const isExpanded = expandedId === snap.id;
              const plainPreview = snap.teks.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

              return (
                <div
                  key={snap.id}
                  className="editorial-card p-3.5 bg-stone-50/80 dark:bg-stone-850 border border-stone-200 dark:border-stone-800 rounded-xl hover:border-stone-300 dark:hover:border-stone-700 transition-all"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <Clock size={15} className="text-stone-400 dark:text-stone-500" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-stone-900 dark:text-stone-100">
                            {snap.waktu}
                          </span>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badge.color}`}>
                            {badge.label}
                          </span>
                        </div>
                        <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
                          Judul: <strong className="text-stone-700 dark:text-stone-300">{snap.judul || 'Tanpa Judul'}</strong> &bull; {snap.wordCount} kata ({snap.charCount} karakter)
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setExpandedId(isExpanded ? null : snap.id)}
                        className="p-1.5 text-xs text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700 rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                        title={isExpanded ? 'Tutup cuplikan' : 'Lihat cuplikan'}
                      >
                        <Eye size={13} />
                        {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePulihkan(snap)}
                        className="editorial-btn bg-stone-900 hover:bg-stone-800 text-white dark:bg-stone-100 dark:hover:bg-white dark:text-stone-900 py-1 px-2.5 text-xs flex items-center gap-1 font-semibold rounded-lg cursor-pointer shadow-xs transition-transform active:scale-95"
                      >
                        <RotateCcw size={12} />
                        <span>Pulihkan</span>
                      </button>
                    </div>
                  </div>

                  {/* Cuplikan Teks jika expanded */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-stone-200 dark:border-stone-800 text-xs text-stone-600 dark:text-stone-300 bg-white/70 dark:bg-stone-900/70 p-3 rounded-lg max-h-40 overflow-y-auto leading-relaxed font-sans">
                      <div className="font-bold text-stone-900 dark:text-stone-100 mb-1">
                        Pratinjau Isi Naskah:
                      </div>
                      <p className="whitespace-pre-wrap">{plainPreview ? (plainPreview.slice(0, 400) + (plainPreview.length > 400 ? '...' : '')) : '(Naskah kosong)'}</p>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer Modal */}
        <div className="p-4 border-t border-stone-200 dark:border-stone-800 bg-stone-50/70 dark:bg-stone-850/70 flex items-center justify-between text-xs text-stone-500 dark:text-stone-400">
          <div className="flex items-center gap-1.5">
            <Sparkles size={13} className="text-amber-500" />
            <span>Maksimal 30 titik riwayat tersimpan aman.</span>
          </div>
          <button
            onClick={onClose}
            className="editorial-btn bg-white hover:bg-stone-100 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 py-1.5 px-3 text-xs border border-stone-200 dark:border-stone-700 cursor-pointer rounded-lg"
          >
            Tutup
          </button>
        </div>

      </div>
    </div>
  );
};
