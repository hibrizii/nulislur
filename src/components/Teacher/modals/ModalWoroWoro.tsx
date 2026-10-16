import React, { useState } from 'react';
import { Megaphone, Trash2, X, Send } from 'lucide-react';
import { DataService } from '../../../services/dataService';
import type { Pengumuman } from '../../../types';
import { FormattedWoroText } from '../../Common/FormattedWoroText';

interface ModalWoroWoroProps {
  isOpen: boolean;
  onClose: () => void;
  pengumumanList: Pengumuman[];
  sekolahId?: string;
}

export const ModalWoroWoro: React.FC<ModalWoroWoroProps> = ({
  isOpen,
  onClose,
  pengumumanList,
  sekolahId,
}) => {
  const [inputWoro, setInputWoro] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleKirim = async () => {
    if (!inputWoro.trim()) return;
    setIsSending(true);
    try {
      await DataService.tambahPengumuman(inputWoro.trim(), undefined, undefined, sekolahId);
      setInputWoro('');
    } catch (e) {
      console.error('Gagal mengirim woro-woro:', e);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="editorial-card w-full max-w-lg bg-white dark:bg-[#141416] border border-stone-200/80 dark:border-stone-800 p-6 sm:p-7 shadow-2xl">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-stone-100 dark:border-stone-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#FAF4EB] dark:bg-[#282015] text-[#8F6533] dark:text-[#E2C7A7] border border-[#ECDDC8] dark:border-[#3E3121] flex items-center justify-center shrink-0">
              <Megaphone size={16} />
            </div>
            <div>
              <h3 className="text-base font-bold font-serif-literary text-stone-900 dark:text-stone-100">
                Woro-woro (Pengumuman Siaran)
              </h3>
              <p className="text-[11px] text-stone-500 dark:text-stone-400">
                Pesan ini akan tampil di beranda seluruh siswa secara real-time.
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

        <div className="mb-4">
          <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
            Isi Pesan Pengumuman
          </label>
          <textarea
            value={inputWoro}
            onChange={(e) => setInputWoro(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                handleKirim();
              }
            }}
            placeholder="Contoh: Anak-anak, silakan selesaikan naskah bab 2 sebelum jam 11 siang..."
            rows={3}
            className="editorial-input w-full p-3 text-xs text-stone-800 dark:text-stone-200 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-750 rounded-lg focus:outline-none focus:ring-1 focus:ring-stone-400"
          />
          <div className="flex justify-between items-center mt-2">
            <span className="text-[10px] text-stone-400 dark:text-stone-500">
              Tekan Ctrl+Enter untuk kirim cepat
            </span>
            <button
              onClick={handleKirim}
              disabled={isSending || !inputWoro.trim()}
              className="editorial-btn bg-stone-900 hover:bg-stone-800 text-white dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-200 py-1.5 px-3.5 text-xs font-semibold cursor-pointer shadow-xs disabled:opacity-50 flex items-center gap-1.5"
            >
              <Send size={12} /> {isSending ? 'Mengirim...' : 'Kirim Woro-woro'}
            </button>
          </div>
        </div>

        <div className="border-t border-stone-100 dark:border-stone-800 pt-3 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-stone-700 dark:text-stone-300">
              Riwayat Pengumuman Aktif ({pengumumanList.filter(p => !sekolahId || !p.sekolahId || p.sekolahId === sekolahId).length})
            </span>
          </div>

          <div className="max-h-48 overflow-y-auto pr-1 flex flex-col gap-2">
            {(() => {
              const scopedList = sekolahId ? pengumumanList.filter(p => !p.sekolahId || p.sekolahId === sekolahId) : pengumumanList;
              if (scopedList.length === 0) {
                return (
                  <p className="text-xs text-stone-400 dark:text-stone-500 text-center py-4 bg-stone-50 dark:bg-stone-900/40 rounded-lg border border-dashed border-stone-200 dark:border-stone-800">
                    Belum ada woro-woro yang sedang aktif.
                  </p>
                );
              }
              return scopedList.map((p) => (
                <div
                  key={p.id}
                  className="p-3 bg-[#FAF9F5] dark:bg-[#18181A] rounded-xl border border-[#E8E4DA] dark:border-[#27262A] flex justify-between items-start gap-2.5 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-stone-800 dark:text-stone-200 text-xs">
                      <FormattedWoroText text={p.teks} />
                    </div>
                    <span className="text-[10px] text-stone-400 dark:text-stone-500 mt-1.5 block font-mono">
                      {p.waktu}
                    </span>
                  </div>
                  <button
                    onClick={async () => {
                      await DataService.hapusPengumuman(p.id);
                    }}
                    className="p-1.5 rounded-lg text-stone-400 hover:text-[#8C3E3E] hover:bg-[#FDF1F1] dark:hover:bg-[#2A1818] cursor-pointer shrink-0 transition-colors"
                    title="Hapus Pengumuman"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ));
            })()}
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="editorial-btn px-4 py-2 text-xs bg-stone-100 hover:bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700 font-medium cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
