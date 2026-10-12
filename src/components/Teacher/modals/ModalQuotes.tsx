import React, { useState, useEffect } from 'react';
import { Sparkles, X, Check } from 'lucide-react';
import { DataService } from '../../../services/dataService';

interface ModalQuotesProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ModalQuotes: React.FC<ModalQuotesProps> = ({ isOpen, onClose }) => {
  const [teks, setTeks] = useState<string>('');
  const [penulis, setPenulis] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const current = DataService.getQuote();
      setTeks(current.teks);
      setPenulis(current.penulis);
      setNotice(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSimpan = async () => {
    if (!teks.trim()) return;
    setIsSaving(true);
    try {
      await DataService.simpanQuote(teks.trim(), penulis.trim() || 'Anonim');
      setNotice('Kutipan berhasil disimpan dan diperbarui untuk semua siswa!');
      setTimeout(() => {
        setNotice(null);
        onClose();
      }, 1000);
    } catch (e) {
      console.error('Gagal menyimpan quote:', e);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="editorial-card w-full max-w-lg bg-white dark:bg-[#141416] border border-stone-200/80 dark:border-stone-800 p-6 sm:p-7 shadow-2xl">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-stone-100 dark:border-stone-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
              <Sparkles size={16} />
            </div>
            <div>
              <h3 className="text-base font-bold font-serif-literary text-stone-900 dark:text-stone-100">
                Kutipan Sastra Siswa
              </h3>
              <p className="text-[11px] text-stone-500 dark:text-stone-400">
                Kutipan inspiratif yang muncul di beranda dan lobi siswa.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {notice && (
          <div className="mb-4 p-2.5 rounded-lg text-xs bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 flex items-center gap-2 animate-in fade-in">
            <Check size={14} className="shrink-0" />
            <span>{notice}</span>
          </div>
        )}

        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
              Isi Kutipan / Quotes
            </label>
            <textarea
              value={teks}
              onChange={(e) => setTeks(e.target.value)}
              placeholder="Contoh: Menulislah, karena dengan menulis kamu sedang mengabadikan jejak pikiranmu..."
              rows={4}
              className="editorial-input w-full p-3 text-xs text-stone-800 dark:text-stone-200 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-750 rounded-lg focus:outline-none focus:ring-1 focus:ring-stone-400"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
              Nama Penulis / Tokoh
            </label>
            <input
              type="text"
              value={penulis}
              onChange={(e) => setPenulis(e.target.value)}
              placeholder="Contoh: Pramoedya Ananta Toer"
              className="editorial-input w-full px-3 py-2 text-xs text-stone-800 dark:text-stone-200 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-750 rounded-lg focus:outline-none focus:ring-1 focus:ring-stone-400"
            />
          </div>

          {/* Pratinjau Tampilan */}
          <div className="p-3.5 bg-stone-50 dark:bg-stone-900/60 rounded-xl border border-stone-200/60 dark:border-stone-800">
            <span className="text-[10px] uppercase font-bold text-stone-400 dark:text-stone-500 block mb-1">
              Pratinjau di Siswa:
            </span>
            <blockquote className="font-serif-literary text-xs italic text-stone-800 dark:text-stone-200 pl-2.5 border-l-2 border-amber-500">
              “{teks.trim() || 'Kutipan inspiratif akan tampil di sini...'}”
            </blockquote>
            <div className="text-right text-[10px] font-semibold text-stone-500 dark:text-stone-400 mt-1 font-serif-literary">
              — {penulis.trim() || 'Anonim'}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5">
          <button
            onClick={onClose}
            className="editorial-btn px-4 py-2 text-xs bg-stone-100 hover:bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700 cursor-pointer"
          >
            Batal
          </button>
          <button
            disabled={isSaving || !teks.trim()}
            onClick={handleSimpan}
            className="editorial-btn px-4 py-2 text-xs bg-stone-900 hover:bg-stone-800 text-white dark:bg-stone-100 dark:!text-stone-950 dark:hover:bg-stone-200 font-semibold cursor-pointer disabled:opacity-50"
          >
            {isSaving ? 'Menyimpan...' : 'Simpan Kutipan'}
          </button>
        </div>
      </div>
    </div>
  );
};
