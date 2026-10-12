import React, { useState, useEffect } from 'react';
import { 
  X, 
  CheckCircle2, 
  Circle, 
  Crosshair, 
  Sparkles, 
  CheckCheck,
  AlertCircle
} from 'lucide-react';

export interface KoreksiItem {
  kata: string;
  pesan: string;
}

interface RevisionChecklistDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  docId: string;
  feedbackUmum?: string;
  daftarKoreksi: KoreksiItem[];
  onScrollToMark: (index: number) => void;
}

export const RevisionChecklistDrawer: React.FC<RevisionChecklistDrawerProps> = ({
  isOpen,
  onClose,
  docId,
  feedbackUmum,
  daftarKoreksi,
  onScrollToMark,
}) => {
  // Simpan status centang revisi di localStorage agar tidak hilang saat reload
  const storageKey = `checklist_${docId}`;
  
  const [checkedMap, setCheckedMap] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Perbarui state jika docId berubah
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`checklist_${docId}`);
      setCheckedMap(saved ? JSON.parse(saved) : {});
    } catch {
      setCheckedMap({});
    }
  }, [docId]);

  // Tutup panel dengan tombol Esc di keyboard
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const toggleCheck = (id: string) => {
    setCheckedMap((prev) => {
      const updated = { ...prev, [id]: !prev[id] };
      try {
        localStorage.setItem(storageKey, JSON.stringify(updated));
        window.dispatchEvent(new CustomEvent('nulislur_checklist_change', { detail: { docId } }));
      } catch (e) {
        console.error('Gagal menyimpan checklist revisi:', e);
      }
      return updated;
    });
  };

  if (!isOpen) return null;

  // Hitung total item yang harus diperiksa
  const hasFeedbackUmum = Boolean(feedbackUmum && feedbackUmum.trim().length > 0);
  const totalItems = daftarKoreksi.length + (hasFeedbackUmum ? 1 : 0);
  
  let completedCount = 0;
  if (hasFeedbackUmum && checkedMap['umum']) completedCount++;
  daftarKoreksi.forEach((_, idx) => {
    if (checkedMap[`item_${idx}`]) completedCount++;
  });

  const progressPercent = totalItems > 0 ? Math.round((completedCount / totalItems) * 100) : 100;
  const isAllCompleted = totalItems > 0 && completedCount === totalItems;

  const handleFocusClick = (index: number) => {
    onScrollToMark(index);
    // Di layar kecil (ponsel/tablet), tutup panel agar siswa leluasa melihat teks yang disorot
    if (window.innerWidth < 768) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[60] overflow-hidden flex justify-end">
      {/* Backdrop Gelap Transparan */}
      <div 
        onClick={onClose} 
        className="fixed inset-0 bg-stone-900/40 backdrop-blur-xs transition-opacity duration-300 cursor-pointer"
        title="Klik di luar untuk menutup"
      />

      {/* Slide-over Drawer Panel */}
      <div className="relative w-full max-w-md bg-stone-50 dark:bg-stone-900 h-full shadow-2xl flex flex-col z-10 border-l border-stone-200 dark:border-stone-800 animate-in slide-in-from-right duration-300">
        
        {/* Drawer Header */}
        <div className="p-5 bg-white dark:bg-stone-900 border-b border-stone-200 dark:border-stone-800">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center text-amber-900 dark:text-amber-300 font-bold">
                <CheckCheck size={18} />
              </div>
              <div>
                <h3 className="text-base font-bold text-stone-900 dark:text-stone-100 leading-tight">
                  Daftar Periksa Revisi
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400 font-medium">
                  Tindak lanjuti masukan guru langkah demi langkah
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex items-center gap-1 text-xs font-semibold text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100 px-2.5 py-1.5 rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 hover:bg-stone-100 dark:hover:bg-stone-700 transition-colors cursor-pointer"
              title="Tutup Panel (Esc)"
            >
              <X size={15} />
              <span>Tutup</span>
            </button>
          </div>

          {/* Progress Bar Card */}
          <div className="mt-3 p-3.5 bg-stone-50 dark:bg-stone-800/80 rounded-xl border border-stone-200/90 dark:border-stone-700/80">
            <div className="flex items-center justify-between text-xs font-semibold mb-2">
              <span className="text-stone-700 dark:text-stone-300">Kemajuan Revisi</span>
              <span className={isAllCompleted ? 'text-emerald-700 dark:text-emerald-400 font-bold' : 'text-amber-800 dark:text-amber-300'}>
                {completedCount} dari {totalItems} selesai ({progressPercent}%)
              </span>
            </div>
            
            {/* Visual Bar */}
            <div className="w-full h-2.5 bg-stone-200 dark:bg-stone-700 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-300 rounded-full ${
                  isAllCompleted ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {isAllCompleted && (
              <div className="mt-2.5 flex items-center gap-1.5 text-xs text-emerald-800 dark:text-emerald-200 font-medium bg-emerald-50 dark:bg-emerald-950/40 p-2 rounded-lg border border-emerald-200 dark:border-emerald-800">
                <Sparkles size={14} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span>Semua masukan telah kamu tandai! Naskah siap dikumpulkan kembali.</span>
              </div>
            )}
          </div>
        </div>

        {/* List of Feedback Items */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          {totalItems === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-stone-400 dark:text-stone-500">
              <CheckCircle2 size={36} className="text-stone-300 dark:text-stone-600 mb-2" />
              <p className="text-sm font-medium">Belum ada catatan koreksi dari guru.</p>
              <p className="text-xs mt-1">Jika guru menandai kata atau memberi evaluasi, daftarnya akan muncul di sini.</p>
            </div>
          ) : (
            <>
              {/* Catatan Evaluasi Umum (Jika ada) */}
              {hasFeedbackUmum && (
                <div 
                  className={`p-4 rounded-xl border transition-all ${
                    checkedMap['umum']
                      ? 'bg-stone-100/80 dark:bg-stone-800/50 border-stone-200 dark:border-stone-800 text-stone-400 dark:text-stone-500 opacity-80'
                      : 'bg-amber-50/90 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/80 text-amber-950 dark:text-amber-100 shadow-xs'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => toggleCheck('umum')}
                      className="mt-0.5 shrink-0 text-amber-700 dark:text-amber-400 hover:text-amber-900 cursor-pointer"
                      title={checkedMap['umum'] ? 'Tandai belum selesai' : 'Tandai sudah diperbaiki'}
                    >
                      {checkedMap['umum'] ? (
                        <CheckCircle2 size={20} className="text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <Circle size={20} className="text-amber-500 dark:text-amber-400 hover:text-amber-600" />
                      )}
                    </button>
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-200 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 px-2 py-0.5 rounded">
                          Evaluasi Umum
                        </span>
                        {checkedMap['umum'] && (
                          <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                            Selesai diperiksa
                          </span>
                        )}
                      </div>
                      <p className={`text-xs font-serif-literary leading-relaxed mt-1.5 ${
                        checkedMap['umum'] ? 'line-through text-stone-400 dark:text-stone-500' : 'text-stone-800 dark:text-stone-200'
                      }`}>
                        "{feedbackUmum}"
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Daftar Koreksi Highlight Teks */}
              {daftarKoreksi.map((item, idx) => {
                const itemId = `item_${idx}`;
                const isChecked = Boolean(checkedMap[itemId]);

                return (
                  <div
                    key={idx}
                    className={`p-3.5 rounded-xl border transition-all ${
                      isChecked
                        ? 'bg-stone-100/70 dark:bg-stone-800/40 border-stone-200 dark:border-stone-800 text-stone-400 dark:text-stone-500 opacity-80'
                        : 'bg-white dark:bg-stone-800/90 border-stone-200/90 dark:border-stone-700 text-stone-800 dark:text-stone-200 shadow-xs hover:border-amber-300 dark:hover:border-amber-500'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Checkbox Button */}
                      <button
                        type="button"
                        onClick={() => toggleCheck(itemId)}
                        className="mt-0.5 shrink-0 transition-transform active:scale-90 cursor-pointer"
                        title={isChecked ? 'Tandai belum diperbaiki' : 'Tandai sudah diperbaiki'}
                      >
                        {isChecked ? (
                          <CheckCircle2 size={20} className="text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <Circle size={20} className="text-stone-400 dark:text-stone-500 hover:text-amber-600" />
                        )}
                      </button>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center justify-between gap-1 mb-1.5">
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded font-serif-literary truncate ${
                            isChecked
                              ? 'bg-stone-200 dark:bg-stone-700 text-stone-500 dark:text-stone-400 line-through'
                              : 'bg-amber-100 dark:bg-amber-900/50 text-amber-900 dark:text-amber-200'
                          }`}>
                            "{item.kata}"
                          </span>

                          {/* Tombol Tunjukkan di Naskah */}
                          <button
                            type="button"
                            onClick={() => handleFocusClick(idx)}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100 bg-stone-100 dark:bg-stone-800 hover:bg-amber-50 dark:hover:bg-amber-950/60 hover:border-amber-300 dark:hover:border-amber-700 border border-stone-200 dark:border-stone-700 px-2 py-1 rounded-md transition-all cursor-pointer"
                            title="Lompat dan sorot kata ini di naskah tulisan"
                          >
                            <Crosshair size={12} className="text-amber-600 dark:text-amber-400" />
                            <span>Tunjukkan</span>
                          </button>
                        </div>

                        {/* Catatan Koreksi Guru */}
                        <p className={`text-xs leading-relaxed ${
                          isChecked ? 'line-through text-stone-400 dark:text-stone-500' : 'text-stone-700 dark:text-stone-300 font-medium'
                        }`}>
                          {item.pesan}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* Footer Info & Close Action */}
        <div className="p-4 bg-white dark:bg-stone-900 border-t border-stone-200 dark:border-stone-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
            <span className="flex items-center gap-1 text-[11px] text-stone-400 dark:text-stone-500">
              <AlertCircle size={13} className="text-stone-400 dark:text-stone-500" /> Tersimpan otomatis
            </span>
            {completedCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  setCheckedMap({});
                  try {
                    localStorage.removeItem(storageKey);
                  } catch (e) {
                    console.error(e);
                  }
                }}
                className="text-[11px] text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 underline cursor-pointer"
              >
                Reset tanda centang
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="editorial-btn w-full sm:w-auto bg-stone-900 hover:bg-stone-800 text-white dark:bg-stone-100 dark:hover:bg-stone-200 dark:text-stone-900 px-4 py-2 text-xs font-semibold rounded-lg cursor-pointer flex items-center justify-center gap-1.5"
          >
            <X size={14} /> Tutup Panel
          </button>
        </div>

      </div>
    </div>
  );
};
