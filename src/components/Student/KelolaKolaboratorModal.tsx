import React, { useState, useEffect } from 'react';
import { DataService, stringToColor, getWaktuSekarang } from '../../services/dataService';
import type { Dokumen, KolaboratorAnggota, UserAccount } from '../../types';
import { Users, UserPlus, UserMinus, ShieldCheck, AlertCircle, Search, Sparkles, X } from 'lucide-react';

interface KelolaKolaboratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  doc: Dokumen | null;
  currentUsername: string;
  kodeKelas?: string;
  onSuccess?: () => void;
}

export const KelolaKolaboratorModal: React.FC<KelolaKolaboratorModalProps> = ({
  isOpen,
  onClose,
  doc,
  currentUsername,
  kodeKelas,
  onSuccess,
}) => {
  const [temanList, setTemanList] = useState<UserAccount[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pesanNotif, setPesanNotif] = useState<string | null>(null);

  const isPembuat = doc ? doc.username === currentUsername : false;
  const currentKolaborator = doc?.kolaborator || [];
  const maxSlot = 3; // 1 pembuat + 3 kolaborator = total 4 orang
  const sisaSlot = Math.max(0, maxSlot - currentKolaborator.length);

  useEffect(() => {
    if (isOpen && (kodeKelas || doc?.kodeKelas)) {
      DataService.getTemanSekelas(kodeKelas || doc?.kodeKelas, doc?.username || currentUsername)
        .then((list) => {
          setTemanList(list);
        })
        .catch(() => {});
    }
  }, [isOpen, kodeKelas, doc?.kodeKelas, doc?.username, currentUsername]);

  if (!isOpen || !doc) return null;

  const currentCollabUsernames = new Set([
    doc.username,
    ...currentKolaborator.map((k) => k.username),
  ]);

  const availableTeman = temanList.filter((t) => {
    if (currentCollabUsernames.has(t.username)) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      t.nama.toLowerCase().includes(q) ||
      t.username.toLowerCase().includes(q)
    );
  });

  const handleTambahKolaborator = async (teman: UserAccount) => {
    if (!isPembuat) return;
    if (currentKolaborator.length >= maxSlot) {
      alert('Jumlah maksimal 4 penulis telah tercapai (1 pembuat naskah dan 3 kolaborator).');
      return;
    }

    setIsSubmitting(true);
    try {
      const baru: KolaboratorAnggota = {
        username: teman.username,
        nama: teman.nama,
        warna: stringToColor(teman.username),
        waktuDitambahkan: getWaktuSekarang(),
      };
      const updated = [...currentKolaborator, baru];
      await DataService.updateKolaboratorDokumen(doc.id, updated);
      setPesanNotif(`Berhasil menambahkan ${teman.nama} sebagai kolaborator.`);
      setTimeout(() => setPesanNotif(null), 3000);
      onSuccess?.();
    } catch (e: any) {
      alert('Gagal menambahkan kolaborator: ' + (e?.message || 'Terjadi kesalahan'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeluarkanKolaborator = async (targetUsername: string, targetNama: string) => {
    if (!isPembuat) return;
    const konfirmasi = window.confirm(
      `Apakah kamu yakin ingin mengeluarkan "${targetNama}" dari kolaborasi naskah ini?`
    );
    if (!konfirmasi) return;

    setIsSubmitting(true);
    try {
      const updated = currentKolaborator.filter((k) => k.username !== targetUsername);
      await DataService.updateKolaboratorDokumen(doc.id, updated);
      setPesanNotif(`${targetNama} telah dikeluarkan dari naskah.`);
      setTimeout(() => setPesanNotif(null), 3000);
      onSuccess?.();
    } catch (e: any) {
      alert('Gagal mengeluarkan kolaborator: ' + (e?.message || 'Terjadi kesalahan'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="editorial-card w-full max-w-lg bg-white dark:bg-[#141416] border border-stone-200 dark:border-stone-800 p-6 sm:p-7 shadow-2xl rounded-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-stone-100 dark:border-stone-800">
          <h2 className="text-base font-bold font-serif-literary text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <Users size={18} className="text-purple-600 dark:text-purple-400" /> Kelola Kolaborator Naskah
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>
      <div className="space-y-4 text-xs">
        {/* Banner Penjelasan Role */}
        <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-900/60 border border-stone-200 dark:border-stone-800 flex items-start gap-2.5">
          <Users size={16} className="text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-stone-800 dark:text-stone-200 mb-0.5">
              Naskah: <span className="font-serif-literary font-bold italic">{doc.judul || 'Tanpa Judul'}</span>
            </p>
            <p className="text-[11px] text-stone-500 dark:text-stone-400 leading-relaxed">
              Maksimal 4 orang (1 pembuat naskah dan hingga 3 teman kolaborator). Semua anggota dapat menulis bersama secara serentak.
            </p>
          </div>
        </div>

        {pesanNotif && (
          <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-[11px] text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
            <Sparkles size={14} className="text-emerald-600 shrink-0" />
            <span>{pesanNotif}</span>
          </div>
        )}

        {/* 1. Pembuat Naskah */}
        <div>
          <label className="block font-semibold text-stone-700 dark:text-stone-300 mb-1.5 uppercase tracking-wider text-[10px]">
            Pembuat Naskah (Penulis Utama)
          </label>
          <div className="p-2.5 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/50 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-white text-[11px] shadow-sm"
                style={{ backgroundColor: stringToColor(doc.username) }}
              >
                {doc.nama.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                  {doc.nama}
                  <span className="text-[10px] font-mono text-stone-400">(@{doc.username})</span>
                </p>
                <p className="text-[10px] text-blue-700 dark:text-blue-300 flex items-center gap-1">
                  <ShieldCheck size={11} /> Pembuat naskah & pengumpul tugas
                </p>
              </div>
            </div>
            {isPembuat && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200">
                Kamu
              </span>
            )}
          </div>
        </div>

        {/* 2. Daftar Kolaborator */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="font-semibold text-stone-700 dark:text-stone-300 uppercase tracking-wider text-[10px]">
              Teman Kolaborator ({currentKolaborator.length} / {maxSlot})
            </label>
            <span className="text-[10px] text-stone-400">
              {sisaSlot > 0 ? `Tersedia ${sisaSlot} slot` : 'Slot penuh'}
            </span>
          </div>

          {currentKolaborator.length === 0 ? (
            <div className="p-4 rounded-xl border border-dashed border-stone-200 dark:border-stone-800 text-center text-stone-400 text-xs">
              Belum ada kolaborator yang ditambahkan ke naskah ini.
            </div>
          ) : (
            <div className="space-y-1.5">
              {currentKolaborator.map((k) => {
                const isSelf = k.username === currentUsername;
                return (
                  <div
                    key={k.username}
                    className="p-2.5 rounded-xl bg-white dark:bg-[#161618] border border-stone-200 dark:border-stone-800 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-white text-[11px] shadow-sm"
                        style={{ backgroundColor: k.warna || stringToColor(k.username) }}
                      >
                        {k.nama.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                          {k.nama}
                          <span className="text-[10px] font-mono text-stone-400">(@{k.username})</span>
                          {isSelf && (
                            <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400">
                              Kamu
                            </span>
                          )}
                        </p>
                        <p className="text-[10px] text-stone-400">Kolaborator</p>
                      </div>
                    </div>

                    {isPembuat && (
                      <button
                        type="button"
                        onClick={() => handleKeluarkanKolaborator(k.username, k.nama)}
                        disabled={isSubmitting}
                        className="px-2 py-1 rounded-lg text-stone-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 text-[11px] font-medium transition-colors flex items-center gap-1 cursor-pointer"
                        title="Keluarkan dari naskah"
                      >
                        <UserMinus size={13} /> Keluarkan
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 3. Tambah Kolaborator (Hanya untuk Pembuat Naskah dan jika slot masih ada) */}
        {isPembuat ? (
          sisaSlot > 0 ? (
            <div className="pt-2 border-t border-stone-100 dark:border-stone-800 space-y-2">
              <label className="block font-semibold text-stone-700 dark:text-stone-300 uppercase tracking-wider text-[10px]">
                Tambah Teman Menulis dari Kelas
              </label>

              <div className="relative">
                <Search size={13} className="absolute left-3 top-2.5 text-stone-400" />
                <input
                  type="text"
                  placeholder="Cari nama atau username teman sekelas..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="editorial-input w-full pl-8 pr-3 py-1.5 text-xs bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-750 dark:text-stone-100 rounded-xl"
                />
              </div>

              <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                {availableTeman.length === 0 ? (
                  <p className="text-center py-3 text-stone-400 text-[11px]">
                    {searchQuery ? 'Tidak ada teman sekelas yang cocok.' : 'Semua teman sekelas sudah ada di naskah ini atau belum ada siswa lain.'}
                  </p>
                ) : (
                  availableTeman.map((teman) => (
                    <div
                      key={teman.username}
                      className="p-2 rounded-lg hover:bg-stone-50 dark:hover:bg-stone-850 border border-transparent hover:border-stone-200 dark:hover:border-stone-800 flex items-center justify-between transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center font-bold text-white text-[10px]"
                          style={{ backgroundColor: stringToColor(teman.username) }}
                        >
                          {teman.nama.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-stone-900 dark:text-stone-100 text-[11px]">
                            {teman.nama}
                          </p>
                          <p className="text-[10px] font-mono text-stone-400">@{teman.username}</p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleTambahKolaborator(teman)}
                        disabled={isSubmitting}
                        className="editorial-btn bg-stone-100 hover:bg-blue-600 hover:text-white dark:bg-stone-800 dark:hover:bg-blue-600 text-stone-700 dark:text-stone-300 text-[11px] px-2.5 py-1 rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <UserPlus size={12} /> Tambah
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="p-2.5 rounded-lg bg-stone-100 dark:bg-stone-900 text-stone-500 text-[11px] flex items-center gap-2">
              <AlertCircle size={13} className="shrink-0" />
              <span>Batas maksimal 4 penulis telah tercapai. Keluarkan kolaborator terlebih dahulu jika ingin mengganti dengan teman lain.</span>
            </div>
          )
        ) : (
          <div className="p-2.5 rounded-lg bg-stone-100 dark:bg-stone-900 text-stone-500 text-[11px] flex items-center gap-2">
            <AlertCircle size={13} className="shrink-0" />
            <span>Pengaturan anggota dan pengumpulan naskah dikelola oleh pembuat naskah ({doc.nama}).</span>
          </div>
        )}

        <div className="flex justify-end pt-2 border-t border-stone-100 dark:border-stone-800">
          <button
            type="button"
            onClick={onClose}
            className="editorial-btn bg-stone-200 hover:bg-stone-300 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 text-xs px-4 py-2 rounded-xl cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  </div>
  );
};
