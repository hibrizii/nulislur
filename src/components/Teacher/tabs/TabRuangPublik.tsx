import React, { useState } from 'react';
import { BookOpen, Eye, Trash2, ArrowUpRight, Filter } from 'lucide-react';
import type { Dokumen } from '../../../types';
import { getWarnaTopik } from '../../../services/dataService';
import { cleanSnippet } from '../../../utils/exportDocument';

interface TabRuangPublikProps {
  dokumenMap: Record<string, Dokumen>;
  onInspectDoc: (doc: Dokumen) => void;
  onTakedownDoc: (docId: string) => Promise<void>;
}

export const TabRuangPublik: React.FC<TabRuangPublikProps> = ({
  dokumenMap,
  onInspectDoc,
  onTakedownDoc,
}) => {
  const [selectedKategori, setSelectedKategori] = useState<string>('semua');

  const publicDocs = Object.values(dokumenMap).filter((d) => d.isPublic);

  const filteredDocs = publicDocs.filter((d) => {
    if (selectedKategori === 'semua') return true;
    return d.topik === selectedKategori;
  });

  const categories = ['Cerpen', 'Puisi', 'Esai', 'Artikel', 'Resensi', 'Lainnya'];

  return (
    <div className="h-full flex flex-col min-h-0 overflow-hidden gap-2.5 animate-in fade-in duration-200">
      {/* Header Tab (Shrink-0) */}
      <div className="shrink-0 editorial-card p-3 sm:px-4 sm:py-2.5 bg-white dark:bg-[#141416] rounded-2xl border border-stone-200/80 dark:border-stone-800 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
        <div>
          <h2 className="text-base sm:text-lg font-bold font-serif-literary text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <BookOpen size={18} className="text-blue-600 dark:text-blue-400" />
            <span>Pojok Baca Sekolah</span>
          </h2>
          <p className="text-[11px] text-stone-500 dark:text-stone-400 hidden sm:block">
            Karya sastra dan tulisan siswa yang telah lolos kurasi redaksi guru dan dapat dibaca oleh seluruh warga sekolah.
          </p>
        </div>

        <div className="text-xs font-semibold px-2.5 py-1 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 border border-blue-200/80 dark:border-blue-900/60">
          {publicDocs.length} Naskah Tayang
        </div>
      </div>

      {/* Filter Kategori Chips (Shrink-0) */}
      <div className="shrink-0 editorial-card p-2 sm:px-3 sm:py-2 bg-white dark:bg-[#141416] rounded-xl border border-stone-200/80 dark:border-stone-800 flex flex-wrap items-center gap-1.5 shadow-2xs">
        <span className="text-xs font-bold text-stone-400 dark:text-stone-500 mr-1 flex items-center gap-1">
          <Filter size={12} /> Kategori:
        </span>
        <button
          onClick={() => setSelectedKategori('semua')}
          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            selectedKategori === 'semua'
              ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 shadow-2xs'
              : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200'
          }`}
        >
          Semua ({publicDocs.length})
        </button>
        {categories.map((kat) => {
          const count = publicDocs.filter((d) => d.topik === kat).length;
          return (
            <button
              key={kat}
              onClick={() => setSelectedKategori(kat)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                selectedKategori === kat
                  ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 shadow-2xs'
                  : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200'
              }`}
            >
              {kat} ({count})
            </button>
          );
        })}
      </div>

      {/* Grid Naskah Publik (Scroll Mandiri Terisolasi) */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-0.5">
        {filteredDocs.length === 0 ? (
          <div className="editorial-card p-12 text-center bg-white dark:bg-[#141416] border border-dashed border-stone-200 dark:border-stone-800">
          <BookOpen size={36} className="mx-auto text-stone-300 dark:text-stone-600 mb-3" />
          <p className="text-sm font-semibold text-stone-700 dark:text-stone-300">
            Belum ada naskah publik dalam kategori ini.
          </p>
          <p className="text-xs text-stone-400 dark:text-stone-500 mt-1">
            Beri izin publikasi pada naskah siswa di tab Koreksi Tugas untuk mempublikasikannya ke sini.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredDocs.map((d) => {
            const topicColor = getWarnaTopik(d.topik);
            return (
              <div
                key={d.id}
                className="editorial-card p-5 bg-white dark:bg-[#141416] border border-stone-200/80 dark:border-stone-800 flex flex-col justify-between hover:shadow-xs transition-shadow"
              >
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <span
                      style={{
                        backgroundColor: topicColor.bg,
                        color: topicColor.text,
                        borderColor: topicColor.border,
                      }}
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider"
                    >
                      {d.topik}
                    </span>
                    <span className="text-xs text-stone-400 dark:text-stone-500 font-mono">
                      {d.waktuPublishTeks || d.waktuEdit}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold font-serif-literary text-stone-900 dark:text-stone-100 mb-1 leading-snug">
                    {d.judul}
                  </h3>
                  <div className="text-xs text-stone-500 dark:text-stone-400 mb-3">
                    Penulis: <strong className="text-stone-800 dark:text-stone-200">{d.nama}</strong> (@{d.username})
                  </div>

                  <p className="font-serif-literary text-xs text-stone-600 dark:text-stone-400 line-clamp-3 mb-4 leading-relaxed italic bg-stone-50/60 dark:bg-stone-900/40 p-3 rounded-xl border border-stone-100 dark:border-stone-800/60">
                    &quot;{cleanSnippet(d.teks)}&quot;
                  </p>
                </div>

                <div className="pt-3 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3 text-xs text-stone-400 dark:text-stone-500 font-mono">
                    <span className="flex items-center gap-1" title="Jumlah Pembaca">
                      <Eye size={13} /> {d.views || 0} Pembaca
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => onInspectDoc(d)}
                      className="editorial-btn bg-stone-100 hover:bg-stone-200 text-stone-800 dark:bg-stone-800 dark:hover:bg-stone-700 dark:text-stone-200 text-xs py-1 px-2.5 cursor-pointer flex items-center gap-1"
                      title="Buka Lembar Koreksi & Evaluasi"
                    >
                      <ArrowUpRight size={13} /> Evaluasi
                    </button>
                    <button
                      onClick={() => onTakedownDoc(d.id)}
                      className="p-1 rounded text-stone-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 cursor-pointer"
                      title="Tarik dari Ruang Publik (Kembalikan ke privat siswa)"
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
