import React, { useState } from 'react';
import { PenTool, Plus, Edit2, Trash2 } from 'lucide-react';
import type { Dokumen, UserAccount } from '../../../types';
import { DataService, getWarnaTopik } from '../../../services/dataService';

interface TabTulisanGuruProps {
  user: UserAccount;
  dokumenMap: Record<string, Dokumen>;
  onOpenEditor: (docId: string) => void;
}

export const TabTulisanGuru: React.FC<TabTulisanGuruProps> = ({
  user,
  dokumenMap,
  onOpenEditor,
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const teacherDocs = Object.values(dokumenMap).filter((d) => d.penulisKategori === 'Guru');

  const handleBuatTulisanBaru = async () => {
    if (isCreating) return;
    setIsCreating(true);
    try {
      const newId = await DataService.buatDokumenBaru(
        user.nama || user.username,
        user.username,
        'Umum',
        '',
        'Guru',
        'Artikel'
      );
      onOpenEditor(newId);
    } catch (err: any) {
      console.error('Gagal membuat naskah baru:', err);
      alert('Gagal membuat naskah baru: ' + (err?.message || 'Terjadi kesalahan sistem'));
    } finally {
      setIsCreating(false);
    }
  };

  const handleHapus = async (id: string, judul: string) => {
    if (confirm(`Hapus tulisan "${judul || 'Tanpa Judul'}"? Tindakan ini tidak dapat dibatalkan.`)) {
      await DataService.hapusDokumen(id);
    }
  };

  return (
    <div className="h-full flex flex-col min-h-0 overflow-hidden gap-2.5 animate-in fade-in duration-200">
      {/* Header Tab (Shrink-0) */}
      <div className="shrink-0 editorial-card p-3 sm:px-4 sm:py-2.5 bg-white dark:bg-[#141416] rounded-2xl border border-stone-200/80 dark:border-stone-800 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
        <div>
          <h2 className="text-base sm:text-lg font-bold font-serif-literary text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <PenTool size={18} className="text-amber-600 dark:text-amber-400" />
            <span>Tulisan & Materi Guru</span>
          </h2>
          <p className="text-[11px] text-stone-500 dark:text-stone-400 hidden sm:block">
            Bagikan panduan menulis, materi sastra, apresiasi karya, atau tulisan reflektif guru untuk dibaca siswa.
          </p>
        </div>

        <button
          type="button"
          disabled={isCreating}
          onClick={handleBuatTulisanBaru}
          className="editorial-btn bg-stone-900 hover:bg-stone-800 text-white dark:bg-stone-100 dark:!text-stone-950 dark:hover:bg-stone-200 py-1.5 px-3.5 text-xs font-semibold cursor-pointer shadow-xs flex items-center gap-1.5 rounded-xl disabled:opacity-50"
        >
          <Plus size={14} /> <span>{isCreating ? 'Mempersiapkan...' : 'Buat Tulisan Baru'}</span>
        </button>
      </div>

      {/* Grid Tulisan Guru (Scroll Mandiri Terisolasi) */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-0.5">
        {teacherDocs.length === 0 ? (
          <div className="editorial-card p-12 text-center bg-white dark:bg-[#141416] border border-dashed border-stone-200 dark:border-stone-800">
            <PenTool size={36} className="mx-auto text-stone-300 dark:text-stone-600 mb-3" />
            <p className="text-sm font-semibold text-stone-700 dark:text-stone-300">
              Belum ada tulisan materi dari guru.
            </p>
            <p className="text-xs text-stone-400 dark:text-stone-500 mt-1 mb-4">
              Klik tombol di bawah untuk membuka ruang editor penuh dan menulis materi atau artikel pertama Anda.
            </p>
            <button
              type="button"
              disabled={isCreating}
              onClick={handleBuatTulisanBaru}
              className="editorial-btn bg-stone-900 hover:bg-stone-800 text-white dark:bg-stone-100 dark:!text-stone-950 py-2 px-3.5 text-xs font-semibold cursor-pointer shadow-xs disabled:opacity-50"
            >
              + {isCreating ? 'Mempersiapkan...' : 'Tulis Sekarang'}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {teacherDocs.map((d) => {
              const topicColor = getWarnaTopik(d.topik);
              return (
                <div
                  key={d.id}
                  className="editorial-card p-4 sm:p-5 bg-white dark:bg-[#141416] border border-stone-200/80 dark:border-stone-800 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          d.isPublic
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                            : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-700'
                        }`}
                      >
                        {d.isPublic ? 'Tayang di Publik' : 'Draf Privat'}
                      </span>
                      <span
                        style={{
                          backgroundColor: topicColor.bg,
                          color: topicColor.text,
                          borderColor: topicColor.border,
                        }}
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-full border"
                      >
                        {d.topik || 'Artikel'}
                      </span>
                    </div>

                    <h3 className="font-bold text-base text-stone-900 dark:text-stone-100 mb-1.5 font-serif-literary leading-snug">
                      {d.judul || 'Tanpa Judul'}
                    </h3>
                    <p className="text-xs text-stone-500 dark:text-stone-400 line-clamp-3 mb-4 leading-relaxed font-serif-literary italic">
                      {d.teks ? d.teks.replace(/<[^>]*>/g, '').slice(0, 150) : 'Belum ada konten'}...
                    </p>
                  </div>

                  <div className="pt-3 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between text-xs">
                    <span className="text-[10px] text-stone-400 font-mono">
                      {d.waktuEdit || '-'}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onOpenEditor(d.id)}
                        className="p-1.5 rounded-lg text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer flex items-center gap-1 text-xs font-medium"
                        title="Buka Editor Layar Penuh"
                      >
                        <Edit2 size={13} />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleHapus(d.id, d.judul)}
                        className="p-1.5 rounded-lg text-stone-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
                        title="Hapus Tulisan"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
