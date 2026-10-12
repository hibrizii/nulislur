import React, { useState } from 'react';
import { PenTool, Plus, Edit2, Trash2, ChevronLeft, FileText, Send } from 'lucide-react';
import type { Dokumen, UserAccount } from '../../../types';
import { DataService, getWarnaTopik } from '../../../services/dataService';
import { NulisEditor } from '../../Editor/NulisEditor';

interface TabTulisanGuruProps {
  user: UserAccount;
  dokumenMap: Record<string, Dokumen>;
}

export const TabTulisanGuru: React.FC<TabTulisanGuruProps> = ({ user, dokumenMap }) => {
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [judul, setJudul] = useState<string>('');
  const [topik, setTopik] = useState<string>('Artikel');
  const [teks, setTeks] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const teacherDocs = Object.values(dokumenMap).filter((d) => d.penulisKategori === 'Guru');

  const handleMulaiTulis = (doc?: Dokumen) => {
    if (doc) {
      setActiveDocId(doc.id);
      setJudul(doc.judul);
      setTopik(doc.topik || 'Artikel');
      setTeks(doc.teks);
    } else {
      setActiveDocId(null);
      setJudul('');
      setTopik('Artikel');
      setTeks('');
    }
    setIsEditing(true);
  };

  const handleSimpanDraf = async () => {
    if (!judul.trim() || !teks.trim()) {
      alert('Lengkapi judul dan isi tulisan!');
      return;
    }
    setIsSaving(true);
    try {
      if (activeDocId) {
        await DataService.simpanDokumen(activeDocId, judul.trim(), teks, topik);
      } else {
        const newId = await DataService.buatDokumenBaru(
          user.nama || 'Guru',
          user.username,
          'Guru',
          judul.trim(),
          'Guru',
          topik
        );
        await DataService.simpanDokumen(newId, judul.trim(), teks, topik);
      }
      setIsEditing(false);
      setActiveDocId(null);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublikasikan = async () => {
    if (!judul.trim() || !teks.trim()) {
      alert('Lengkapi judul dan isi tulisan!');
      return;
    }
    setIsSaving(true);
    try {
      let docId = activeDocId;
      if (!docId) {
        docId = await DataService.buatDokumenBaru(
          user.nama || 'Guru',
          user.username,
          'Guru',
          judul.trim(),
          'Guru',
          topik
        );
      }
      await DataService.simpanDokumen(docId, judul.trim(), teks, topik);
      await DataService.publikasiKeMading(docId, topik, user.nama || 'Guru');
      setIsEditing(false);
      setActiveDocId(null);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleHapus = async (id: string) => {
    if (confirm('Hapus tulisan ini?')) {
      await DataService.hapusDokumen(id);
    }
  };

  return (
    <div className="h-full flex flex-col min-h-0 overflow-hidden gap-2.5 animate-in fade-in duration-200">
      {!isEditing ? (
        <>
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
              onClick={() => handleMulaiTulis()}
              className="editorial-btn bg-stone-900 hover:bg-stone-800 text-white dark:bg-stone-100 dark:!text-stone-950 dark:hover:bg-stone-200 py-1.5 px-3.5 text-xs font-semibold cursor-pointer shadow-xs flex items-center gap-1.5 rounded-xl"
            >
              <Plus size={14} /> <span>Buat Tulisan Baru</span>
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
                  Klik tombol di atas untuk membuat artikel atau materi menulis pertama Anda.
                </p>
                <button
                  onClick={() => handleMulaiTulis()}
                  className="editorial-btn bg-stone-900 hover:bg-stone-800 text-white dark:bg-stone-100 dark:!text-stone-950 py-2 px-3.5 text-xs font-semibold cursor-pointer shadow-xs"
                >
                  + Tulis Sekarang
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
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            d.isPublic
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                              : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-700'
                          }`}>
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
                            {d.topik}
                          </span>
                        </div>

                        <h3 className="font-bold text-base text-stone-900 dark:text-stone-100 mb-1.5 font-serif-literary leading-snug">
                          {d.judul}
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
                            onClick={() => handleMulaiTulis(d)}
                            className="p-1.5 rounded-lg text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
                            title="Edit Tulisan"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => handleHapus(d.id)}
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
        </>
      ) : (
        /* Form Editor Tulisan Guru (Terkunci Viewport dengan Scroll Mandiri di Kanvas) */
        <div className="h-full flex flex-col min-h-0 overflow-hidden editorial-card bg-white dark:bg-[#141416] border border-stone-200/80 dark:border-stone-800 p-4 sm:p-6 rounded-2xl shadow-2xs">
          <div className="shrink-0 flex items-center justify-between pb-3 mb-3 border-b border-stone-100 dark:border-stone-800">
            <button
              onClick={() => setIsEditing(false)}
              className="editorial-btn bg-stone-100 hover:bg-stone-200 text-stone-700 dark:bg-stone-800 dark:hover:bg-stone-700 dark:text-stone-300 text-xs py-1.5 px-3 flex items-center gap-1.5 cursor-pointer rounded-xl"
            >
              <ChevronLeft size={14} /> Kembali
            </button>
            <h3 className="text-base sm:text-lg font-bold font-serif-literary text-stone-900 dark:text-stone-100">
              {activeDocId ? 'Edit Tulisan Guru' : 'Buat Tulisan Baru'}
            </h3>
            <div className="w-16" />
          </div>

          <div className="shrink-0 grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-[11px] font-semibold text-stone-700 dark:text-stone-300 mb-1">
                Judul Tulisan / Materi:
              </label>
              <input
                type="text"
                value={judul}
                onChange={(e) => setJudul(e.target.value)}
                placeholder="Contoh: Menemukan Jiwa Cerita dalam Cerpen..."
                className="editorial-input w-full p-2 text-xs bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-750 dark:text-stone-100 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-stone-700 dark:text-stone-300 mb-1">
                Kategori Tulisan:
              </label>
              <select
                value={topik}
                onChange={(e) => setTopik(e.target.value)}
                className="editorial-input w-full p-2 text-xs bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-750 dark:text-stone-100 rounded-lg"
              >
                <option value="Cerpen">Cerpen</option>
                <option value="Puisi">Puisi</option>
                <option value="Esai">Esai</option>
                <option value="Artikel">Artikel</option>
                <option value="Resensi">Resensi</option>
                <option value="Lainnya">Lainnya</option>
              </select>
            </div>
          </div>

          {/* Area Editor Tiptap (Scroll Mandiri) */}
          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar rounded-xl border border-stone-200 dark:border-stone-800 mb-3 bg-stone-50/40 dark:bg-stone-900/40 p-4">
            <NulisEditor
              initialContent={teks}
              onUpdate={setTeks}
              placeholder="Tuliskan materi, panduan, atau refleksi inspiratif Anda di sini..."
            />
          </div>

          <div className="shrink-0 flex flex-wrap items-center justify-end gap-2.5 pt-3 border-t border-stone-100 dark:border-stone-800">
            <button
              onClick={() => setIsEditing(false)}
              className="editorial-btn bg-stone-100 hover:bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-300 py-1.5 px-3.5 text-xs cursor-pointer rounded-xl"
            >
              Batal
            </button>
            <button
              onClick={handleSimpanDraf}
              disabled={isSaving}
              className="editorial-btn bg-stone-100 hover:bg-stone-200 text-stone-800 dark:bg-stone-800 dark:text-stone-200 py-1.5 px-3.5 text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50 rounded-xl"
            >
              <FileText size={13} /> Simpan Draf
            </button>
            <button
              onClick={handlePublikasikan}
              disabled={isSaving}
              className="editorial-btn bg-stone-900 hover:bg-stone-800 text-white dark:bg-stone-100 dark:!text-stone-950 dark:hover:bg-stone-200 py-1.5 px-4 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50 rounded-xl"
            >
              <Send size={13} /> Terbitkan ke Publik
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
