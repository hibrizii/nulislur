import React, { useState } from 'react';
import { Plus, UserPlus, Edit2, X } from 'lucide-react';
import type { KelasRoom } from '../../../types';

interface ModalNewClassProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (namaKelas: string, maxPeserta?: number) => Promise<void>;
}

export const ModalNewClass: React.FC<ModalNewClassProps> = ({ isOpen, onClose, onSubmit }) => {
  const [namaKelas, setNamaKelas] = useState<string>('');
  const [maxPeserta, setMaxPeserta] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!namaKelas.trim()) return;
    setIsSubmitting(true);
    try {
      const parsedMax = maxPeserta.trim() ? Number(maxPeserta) : undefined;
      await onSubmit(namaKelas.trim(), parsedMax && parsedMax > 0 ? parsedMax : undefined);
      setNamaKelas('');
      setMaxPeserta('');
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="editorial-card w-full max-w-md my-auto max-h-[90vh] overflow-y-auto bg-white dark:bg-[#141416] border border-stone-200/80 dark:border-stone-800 p-6 sm:p-7 shadow-2xl">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-stone-100 dark:border-stone-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
              <Plus size={16} />
            </div>
            <div>
              <h3 className="text-base font-bold font-serif-literary text-stone-900 dark:text-stone-100">
                Buat Ruang Kelas Baru
              </h3>
              <p className="text-[11px] text-stone-500 dark:text-stone-400">
                Sistem otomatis menghasilkan kode kelas unik untuk siswa.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 cursor-pointer">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
              Nama Kelas:
            </label>
            <input
              type="text"
              value={namaKelas}
              onChange={(e) => setNamaKelas(e.target.value)}
              placeholder="Contoh: Kelas 10-A Menulis Kreatif"
              className="editorial-input w-full p-2.5 text-xs bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-750 dark:text-stone-100 rounded-lg"
              autoFocus
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
              Kapasitas Maksimal Siswa (Opsional):
            </label>
            <input
              type="number"
              min="1"
              max="500"
              value={maxPeserta}
              onChange={(e) => setMaxPeserta(e.target.value)}
              placeholder="Misal: 36 (Kosongkan jika tanpa batas kuota)"
              className="editorial-input w-full p-2.5 text-xs bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-750 dark:text-stone-100 rounded-lg"
            />
            <p className="text-[10.5px] text-stone-400 dark:text-stone-500 mt-1">
              Jika diisi, siswa baru tidak dapat mendaftar/bergabung saat kuota terpenuhi.
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
              disabled={isSubmitting || !namaKelas.trim()}
              className="editorial-btn px-4 py-2 text-xs bg-stone-900 hover:bg-stone-800 text-white dark:bg-stone-100 dark:!text-stone-950 dark:hover:bg-stone-200 font-semibold cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? 'Membuat...' : 'Buat Kelas'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface ModalJoinClassProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (kodeKelas: string) => Promise<void>;
}

export const ModalJoinClass: React.FC<ModalJoinClassProps> = ({ isOpen, onClose, onSubmit }) => {
  const [kodeKelas, setKodeKelas] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kodeKelas.trim()) return;
    setIsSubmitting(true);
    try {
      await onSubmit(kodeKelas.trim().toUpperCase());
      setKodeKelas('');
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="editorial-card w-full max-w-md my-auto max-h-[90vh] overflow-y-auto bg-white dark:bg-[#141416] border border-stone-200/80 dark:border-stone-800 p-6 sm:p-7 shadow-2xl">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-stone-100 dark:border-stone-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 flex items-center justify-center shrink-0">
              <UserPlus size={16} />
            </div>
            <div>
              <h3 className="text-base font-bold font-serif-literary text-stone-900 dark:text-stone-100">
                Gabung Kelas Rekan (Co-Teaching)
              </h3>
              <p className="text-[11px] text-stone-500 dark:text-stone-400">
                Masukkan kode kelas yang dibuat oleh rekan guru lain.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 cursor-pointer">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
              Kode Kelas Rekan Guru:
            </label>
            <input
              type="text"
              value={kodeKelas}
              onChange={(e) => setKodeKelas(e.target.value.toUpperCase())}
              placeholder="Contoh: KLS-9X2Y"
              className="editorial-input w-full p-2.5 text-xs font-mono font-bold uppercase bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-750 dark:text-stone-100 rounded-lg tracking-wider"
              autoFocus
              required
            />
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
              disabled={isSubmitting || !kodeKelas.trim()}
              className="editorial-btn px-4 py-2 text-xs bg-stone-900 hover:bg-stone-800 text-white dark:bg-stone-100 dark:!text-stone-950 dark:hover:bg-stone-200 font-semibold cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? 'Memproses...' : 'Gabung Kelas'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface ModalEditClassProps {
  isOpen: boolean;
  onClose: () => void;
  kelas: KelasRoom | null;
  onSubmit: (kelasId: string, namaBaru: string, maxPeserta?: number) => Promise<void>;
}

export const ModalEditClass: React.FC<ModalEditClassProps> = ({
  isOpen,
  onClose,
  kelas,
  onSubmit,
}) => {
  const [namaBaru, setNamaBaru] = useState<string>('');
  const [maxPeserta, setMaxPeserta] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  React.useEffect(() => {
    if (kelas) {
      setNamaBaru(kelas.namaKelas);
      setMaxPeserta(kelas.maxPeserta ? String(kelas.maxPeserta) : '');
    }
  }, [kelas]);

  if (!isOpen || !kelas) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!namaBaru.trim()) return;
    setIsSubmitting(true);
    try {
      const parsedMax = maxPeserta.trim() ? Number(maxPeserta) : undefined;
      await onSubmit(kelas.id, namaBaru.trim(), parsedMax && parsedMax > 0 ? parsedMax : undefined);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="editorial-card w-full max-w-md my-auto max-h-[90vh] overflow-y-auto bg-white dark:bg-[#141416] border border-stone-200/80 dark:border-stone-800 p-6 sm:p-7 shadow-2xl">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-stone-100 dark:border-stone-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
              <Edit2 size={16} />
            </div>
            <div>
              <h3 className="text-base font-bold font-serif-literary text-stone-900 dark:text-stone-100">
                Kelola Ruang Kelas
              </h3>
              <p className="text-[11px] text-stone-500 dark:text-stone-400">
                Kode kelas ({kelas.kodeKelas}) tidak akan berubah.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 cursor-pointer">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
              Nama Kelas:
            </label>
            <input
              type="text"
              value={namaBaru}
              onChange={(e) => setNamaBaru(e.target.value)}
              className="editorial-input w-full p-2.5 text-xs bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-750 dark:text-stone-100 rounded-lg"
              autoFocus
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
              Kapasitas Maksimal Siswa (Opsional):
            </label>
            <input
              type="number"
              min="1"
              max="500"
              value={maxPeserta}
              onChange={(e) => setMaxPeserta(e.target.value)}
              placeholder="Misal: 36 (Kosongkan jika tanpa batas kuota)"
              className="editorial-input w-full p-2.5 text-xs bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-750 dark:text-stone-100 rounded-lg"
            />
            <p className="text-[10.5px] text-stone-400 dark:text-stone-500 mt-1">
              Siswa tidak dapat bergabung jika kapasitas peserta telah penuh.
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
              disabled={isSubmitting || !namaBaru.trim()}
              className="editorial-btn px-4 py-2 text-xs bg-stone-900 hover:bg-stone-800 text-white dark:bg-stone-100 dark:!text-stone-950 dark:hover:bg-stone-200 font-semibold cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? 'Menyimpan...' : 'Simpan Perubahan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
