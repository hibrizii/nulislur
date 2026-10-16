import React, { useState, useEffect } from 'react';
import { BookOpen, X, Calendar, AlignLeft, Target, Edit2, Check } from 'lucide-react';
import { DataService } from '../../../services/dataService';
import type { KelasRoom, UserAccount, Penugasan } from '../../../types';

interface ModalPenugasanProps {
  isOpen: boolean;
  onClose: () => void;
  myClasses: KelasRoom[];
  defaultClassCode?: string;
  user: UserAccount;
  penugasanToEdit?: Penugasan | null;
  onSuccess?: (penugasanId: string) => void;
}

const TOPIK_OPTIONS = ['Cerpen', 'Puisi', 'Esai', 'Artikel', 'Resensi', 'Bebas'];

export const ModalPenugasan: React.FC<ModalPenugasanProps> = ({
  isOpen,
  onClose,
  myClasses,
  defaultClassCode,
  user,
  penugasanToEdit,
  onSuccess,
}) => {
  const [judul, setJudul] = useState<string>('');
  const [deskripsi, setDeskripsi] = useState<string>('');
  const [selectedClassCodes, setSelectedClassCodes] = useState<string[]>([]);
  const [topik, setTopik] = useState<string>('Cerpen');
  const [targetKataMin, setTargetKataMin] = useState<string>('');
  const [tenggatWaktu, setTenggatWaktu] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setErrorMsg('');
      if (penugasanToEdit) {
        setJudul(penugasanToEdit.judul || '');
        setDeskripsi(penugasanToEdit.deskripsi || '');
        setTopik(penugasanToEdit.topik || 'Cerpen');
        setTargetKataMin(penugasanToEdit.targetKataMin ? String(penugasanToEdit.targetKataMin) : '');
        setTenggatWaktu(penugasanToEdit.tenggatWaktu || '');
        setSelectedClassCodes(penugasanToEdit.kodeKelas ? [penugasanToEdit.kodeKelas] : []);
      } else {
        setJudul('');
        setDeskripsi('');
        setTopik('Cerpen');
        setTargetKataMin('');
        setTenggatWaktu('');

        if (defaultClassCode && defaultClassCode !== 'semua' && myClasses.some((k) => k.kodeKelas === defaultClassCode)) {
          setSelectedClassCodes([defaultClassCode]);
        } else if (myClasses.length > 0) {
          setSelectedClassCodes([myClasses[0].kodeKelas]);
        } else {
          setSelectedClassCodes([]);
        }
      }
    }
  }, [isOpen, penugasanToEdit, defaultClassCode, myClasses]);

  if (!isOpen) return null;

  const toggleClassCode = (code: string) => {
    if (penugasanToEdit) {
      // Saat edit, hanya boleh 1 kelas
      setSelectedClassCodes([code]);
      return;
    }
    setSelectedClassCodes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const toggleSelectAllClasses = () => {
    if (selectedClassCodes.length === myClasses.length) {
      setSelectedClassCodes([]);
    } else {
      setSelectedClassCodes(myClasses.map((c) => c.kodeKelas));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!judul.trim()) {
      setErrorMsg('Judul penugasan wajib diisi!');
      return;
    }
    if (selectedClassCodes.length === 0) {
      setErrorMsg('Pilih minimal satu target ruang kelas!');
      return;
    }

    const minWords = targetKataMin.trim() ? parseInt(targetKataMin.trim(), 10) : null;

    setIsSubmitting(true);
    try {
      if (penugasanToEdit) {
        const targetCode = selectedClassCodes[0];
        const selectedClassObj = myClasses.find((k) => k.kodeKelas === targetCode);
        await DataService.editPenugasan(penugasanToEdit.id, {
          judul: judul.trim(),
          deskripsi: deskripsi.trim(),
          kodeKelas: targetCode,
          namaKelas: selectedClassObj?.namaKelas,
          topik,
          targetKataMin: minWords && !isNaN(minWords) && minWords > 0 ? minWords : null,
          tenggatWaktu: tenggatWaktu.trim() || null,
        });
        onSuccess?.(penugasanToEdit.id);
      } else {
        let lastCreatedId = '';
        for (const code of selectedClassCodes) {
          const selectedClassObj = myClasses.find((k) => k.kodeKelas === code);
          const newId = await DataService.buatPenugasan({
            judul: judul.trim(),
            deskripsi: deskripsi.trim(),
            kodeKelas: code,
            namaKelas: selectedClassObj?.namaKelas,
            guruUsername: user.username,
            namaGuru: user.nama,
            topik,
            targetKataMin: minWords && !isNaN(minWords) && minWords > 0 ? minWords : null,
            tenggatWaktu: tenggatWaktu.trim() || null,
          });
          lastCreatedId = newId;
        }
        onSuccess?.(lastCreatedId);
      }
      onClose();
    } catch (err: any) {
      console.error('Gagal memproses penugasan:', err);
      setErrorMsg(err?.message || 'Terjadi kesalahan sistem saat memproses penugasan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="editorial-card w-full max-w-lg my-auto bg-white dark:bg-[#141416] border border-stone-200/80 dark:border-stone-800 p-6 sm:p-7 shadow-2xl overflow-y-auto max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-stone-100 dark:border-stone-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 flex items-center justify-center shrink-0 shadow-2xs">
              {penugasanToEdit ? <Edit2 size={18} /> : <BookOpen size={18} />}
            </div>
            <div>
              <h3 className="text-base font-bold font-serif-literary text-stone-900 dark:text-stone-100">
                {penugasanToEdit ? 'Edit Penugasan' : 'Buat Penugasan Baru'}
              </h3>
              <p className="text-[11px] text-stone-500 dark:text-stone-400">
                {penugasanToEdit
                  ? 'Perbarui instruksi atau tenggat waktu tugas untuk siswa.'
                  : 'Berikan instruksi penulisan terarah bagi siswa di kelas Anda.'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 cursor-pointer transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {errorMsg && (
          <div className="mb-4 p-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Judul Penugasan */}
          <div>
            <label className="block font-semibold text-stone-700 dark:text-stone-300 mb-1">
              Judul Tugas / Instruksi <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={judul}
              onChange={(e) => setJudul(e.target.value)}
              placeholder="Misal: Menulis Cerpen Bertema Kearifan Lokal..."
              required
              className="editorial-input w-full px-3 py-2 text-xs bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-750 dark:text-stone-100 rounded-xl focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Target Ruang Kelas (Bisa Pilih Banyak Kelas Sekaligus) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="font-semibold text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
                <span>Target Ruang Kelas</span>
                <span className="text-red-500">*</span>
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                  {selectedClassCodes.length} kelas dipilih
                </span>
              </label>
              {!penugasanToEdit && myClasses.length > 1 && (
                <button
                  type="button"
                  onClick={toggleSelectAllClasses}
                  className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                >
                  {selectedClassCodes.length === myClasses.length ? 'Batal Semua' : 'Pilih Semua Kelas'}
                </button>
              )}
            </div>

            {myClasses.length === 0 ? (
              <p className="text-xs text-stone-400 italic">Belum ada kelas yang terdaftar.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-36 overflow-y-auto p-1.5 bg-stone-50/70 dark:bg-stone-900/60 rounded-xl border border-stone-200/80 dark:border-stone-800 custom-scrollbar">
                {myClasses.map((k) => {
                  const isSelected = selectedClassCodes.includes(k.kodeKelas);
                  return (
                    <button
                      key={k.kodeKelas}
                      type="button"
                      onClick={() => toggleClassCode(k.kodeKelas)}
                      className={`p-2 rounded-lg text-left transition-all flex items-center gap-2 cursor-pointer border text-xs ${
                        isSelected
                          ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-300 dark:border-blue-800 text-blue-900 dark:text-blue-200 font-semibold shadow-2xs'
                          : 'bg-white dark:bg-stone-850 hover:bg-stone-100 dark:hover:bg-stone-800 border-stone-200/80 dark:border-stone-750 text-stone-700 dark:text-stone-300'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                        isSelected
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-900'
                      }`}>
                        {isSelected && <Check size={11} strokeWidth={3} />}
                      </div>
                      <div className="min-w-0 flex-1 truncate">
                        <span className="truncate block font-medium">{k.namaKelas}</span>
                        <span className="text-[10px] text-stone-400 dark:text-stone-500 font-mono block">({k.kodeKelas})</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            <p className="text-[10px] text-stone-400 dark:text-stone-500 mt-1">
              {penugasanToEdit
                ? 'Klik kelas untuk mengubah target kelas tugas ini.'
                : 'Pilih satu atau beberapa kelas sekaligus. Tugas dan pengumuman woro-woro akan dikirimkan ke setiap kelas terpilih.'}
            </p>
          </div>

          {/* Kategori / Genre Teks */}
          <div>
            <label className="block font-semibold text-stone-700 dark:text-stone-300 mb-1">
              Kategori / Genre Teks
            </label>
            <select
              value={topik}
              onChange={(e) => setTopik(e.target.value)}
              className="editorial-input w-full px-3 py-2 text-xs bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-750 dark:text-stone-100 rounded-xl"
            >
              {TOPIK_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {/* Target Kata Minimal & Tenggat Waktu (2 Kolom) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-stone-700 dark:text-stone-300 mb-1 flex items-center gap-1.5">
                <Target size={13} className="text-stone-400" /> Target Kata Minimal (Opsional)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="25"
                  value={targetKataMin}
                  onChange={(e) => setTargetKataMin(e.target.value)}
                  placeholder="Misal: 150 kata"
                  className="editorial-input w-full px-3 py-2 text-xs bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-750 dark:text-stone-100 rounded-xl"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-stone-700 dark:text-stone-300 mb-1 flex items-center gap-1.5">
                <Calendar size={13} className="text-stone-400" /> Tenggat Waktu / Deadline (Opsional)
              </label>
              <input
                type="date"
                value={tenggatWaktu}
                onChange={(e) => setTenggatWaktu(e.target.value)}
                className="editorial-input w-full px-3 py-2 text-xs bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-750 dark:text-stone-100 rounded-xl"
              />
            </div>
          </div>

          {/* Deskripsi & Petunjuk Tugas */}
          <div>
            <label className="block font-semibold text-stone-700 dark:text-stone-300 mb-1 flex items-center gap-1.5">
              <AlignLeft size={13} className="text-stone-400" /> Panduan & Ketentuan Penulisan
            </label>
            <textarea
              rows={3}
              value={deskripsi}
              onChange={(e) => setDeskripsi(e.target.value)}
              placeholder="Tuliskan petunjuk pengerjaan tugas, struktur tulisan yang diharapkan, atau rubrik penilaian ringkas..."
              className="editorial-input w-full px-3 py-2 text-xs bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-750 dark:text-stone-100 rounded-xl resize-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-stone-100 dark:border-stone-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-3.5 py-2 text-xs font-semibold text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting || myClasses.length === 0}
              className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? 'Menyimpan...' : (penugasanToEdit ? 'Simpan Perubahan' : 'Terbitkan Tugas')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
