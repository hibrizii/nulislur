import React, { useEffect } from 'react';
import { LogOut } from 'lucide-react';

interface LogoutConfirmationModalProps {
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  role: 'guru' | 'siswa';
}

export const LogoutConfirmationModal: React.FC<LogoutConfirmationModalProps> = ({
  isOpen,
  onCancel,
  onConfirm,
  role,
}) => {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const isTeacher = role === 'guru';

  return (
    <div 
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-stone-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-150"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="logout-title"
        className="editorial-card w-full max-w-sm bg-white dark:bg-[#141416] p-6 sm:p-7 rounded-2xl border border-stone-200/90 dark:border-stone-800 shadow-2xl animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-12 rounded-2xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-900/50 flex items-center justify-center mx-auto mb-4 shadow-2xs">
          <LogOut size={22} className="translate-x-0.5" />
        </div>

        <h3
          id="logout-title"
          className="text-lg sm:text-xl font-bold font-serif-literary text-stone-900 dark:text-stone-100 text-center mb-2"
        >
          {isTeacher ? 'Konfirmasi Keluar Akun' : 'Yakin Ingin Keluar?'}
        </h3>

        <p className="text-xs text-stone-600 dark:text-stone-400 text-center mb-6 leading-relaxed">
          {isTeacher
            ? 'Apakah Anda yakin ingin mengakhiri sesi mengajar? Semua catatan koreksi, penilaian, dan data kelas telah tersimpan secara aman.'
            : 'Pastikan tulisan Anda telah tersimpan otomatis sebelum keluar. Anda dapat masuk kembali kapan saja untuk melanjutkan tulisan.'}
        </p>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="editorial-btn flex-1 bg-stone-100 hover:bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700 text-xs py-2.5 font-semibold rounded-xl cursor-pointer transition-colors justify-center"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="editorial-btn flex-1 bg-red-600 hover:bg-red-700 text-white text-xs py-2.5 font-bold rounded-xl cursor-pointer transition-all shadow-xs hover:shadow-sm justify-center flex items-center gap-1.5"
            autoFocus
          >
            <LogOut size={14} /> Ya, Keluar
          </button>
        </div>
      </div>
    </div>
  );
};
