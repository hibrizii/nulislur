import React, { useState, useEffect } from 'react';
import { KeyRound, X, CheckCircle2, AlertCircle, RefreshCw, Copy, Check } from 'lucide-react';
import { DataService } from '../../../services/dataService';

interface ModalResetPasswordProps {
  isOpen: boolean;
  onClose: () => void;
  username: string;
  nama: string;
}

export const ModalResetPassword: React.FC<ModalResetPasswordProps> = ({
  isOpen,
  onClose,
  username,
  nama,
}) => {
  const [newPass, setNewPass] = useState<string>('123456');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setNewPass('123456');
      setNotice(null);
      setCopied(false);
    }
  }, [isOpen, username]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPass.trim()) {
      setNotice({ type: 'error', text: 'Kata sandi baru tidak boleh kosong.' });
      return;
    }

    setIsSubmitting(true);
    setNotice(null);

    try {
      await DataService.resetPasswordSiswa(username, newPass.trim());
      setNotice({
        type: 'success',
        text: `Kata sandi untuk @${username} berhasil diatur ulang menjadi "${newPass.trim()}". Beritahukan ke siswa.`,
      });
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err: any) {
      setNotice({
        type: 'error',
        text: err?.message || 'Gagal mereset kata sandi siswa.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(newPass);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="editorial-card w-full max-w-md bg-white dark:bg-[#141416] border border-stone-200/80 dark:border-stone-800 p-6 sm:p-7 shadow-2xl">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-stone-100 dark:border-stone-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 flex items-center justify-center shrink-0">
              <KeyRound size={16} />
            </div>
            <div>
              <h3 className="text-base font-bold font-serif-literary text-stone-900 dark:text-stone-100">
                Reset Kata Sandi Siswa
              </h3>
              <p className="text-[11px] text-stone-500 dark:text-stone-400">
                Atur ulang kata sandi bila siswa lupa sandinya
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
          <div
            className={`p-3 rounded-xl border text-xs mb-4 flex items-center gap-2 animate-in fade-in ${
              notice.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60'
                : 'bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800/60'
            }`}
          >
            {notice.type === 'success' ? (
              <CheckCircle2 size={15} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <AlertCircle size={15} className="shrink-0 text-red-600 dark:text-red-400" />
            )}
            <span>{notice.text}</span>
          </div>
        )}

        <div className="p-3 bg-stone-50 dark:bg-stone-900/60 rounded-xl border border-stone-200/60 dark:border-stone-800 mb-4 text-xs">
          <div className="text-stone-500 dark:text-stone-400">Target Siswa:</div>
          <div className="font-bold text-stone-900 dark:text-stone-100 text-sm mt-0.5">{nama}</div>
          <div className="font-mono text-stone-400 dark:text-stone-500 text-[11px]">@{username}</div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                Kata Sandi Baru:
              </label>
              <button
                type="button"
                onClick={() => setNewPass('123456')}
                className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw size={10} /> Default 123456
              </button>
            </div>

            <div className="relative">
              <input
                type="text"
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
                placeholder="Masukkan kata sandi baru..."
                className="editorial-input w-full p-2.5 pr-20 text-xs font-mono font-bold bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 dark:text-stone-100"
                required
              />
              <button
                type="button"
                onClick={handleCopy}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2 py-1 text-[10px] font-semibold rounded bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 flex items-center gap-1"
                title="Salin sandi baru"
              >
                {copied ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
                <span>{copied ? 'Tersalin' : 'Salin'}</span>
              </button>
            </div>
            <p className="text-[10px] text-stone-400 dark:text-stone-500 mt-1">
              Standar reset bawaan adalah <strong>123456</strong>. Siswa dapat menggantinya sendiri di akun mereka.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100 dark:border-stone-800">
            <button
              type="button"
              onClick={onClose}
              className="editorial-btn px-4 py-2 text-xs bg-stone-100 hover:bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700 cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !newPass.trim()}
              className="editorial-btn px-4 py-2 text-xs bg-stone-900 hover:bg-stone-800 text-white dark:bg-stone-100 dark:!text-stone-950 dark:hover:bg-stone-200 font-semibold cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? 'Menyimpan...' : 'Terapkan Sandi Baru'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
