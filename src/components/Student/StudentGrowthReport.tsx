import React, { useState, useMemo } from 'react';
import type { Dokumen } from '../../types';
import { 
  Award, 
  BookOpen, 
  Sparkles, 
  ChevronRight, 
  X, 
  FileText, 
  Target,
  BarChart3
} from 'lucide-react';
import { parseDocumentTagCounts, hitungPenilaianOtomatis } from '../../services/dataService';

interface StudentGrowthReportProps {
  dokumenList: Dokumen[];
  onOpenEditor: (docId: string) => void;
}

const RUBRIC_VARIABLES = [
  { id: 'kedalamanGagasan', name: 'Kedalaman Gagasan', category: 'Makro', desc: 'Orisinalitas ide dan bobot argumentasi tulisan.' },
  { id: 'kepaduanParagraf', name: 'Kepaduan Paragraf', category: 'Makro', desc: 'Kohesi dan koherensi alur peralihan antarkalimat.' },
  { id: 'strukturTeks', name: 'Struktur Teks', category: 'Makro', desc: 'Kelengkapan pembuka, pengembangan isi, dan penutup teks.' },
  { id: 'efektivitasKalimat', name: 'Efektivitas Kalimat', category: 'Mikro', desc: 'Kejelasan subjek-predikat dan hemat kata.' },
  { id: 'ketepatanDiksi', name: 'Ketepatan Diksi', category: 'Mikro', desc: 'Kekayaan dan ketepatan variasi pilihan kosakata.' },
  { id: 'kebakuanEjaan', name: 'Kebakuan & Ejaan', category: 'Kebahasaan', desc: 'Kesesuaian kata baku KBBI dan minim salah ketik (typo).' },
  { id: 'pembentukanKata', name: 'Pembentukan Kata', category: 'Kebahasaan', desc: 'Penggunaan imbuhan (awalan, akhiran, konfiks) dan bentuk dasar kata secara tepat.' },
  { id: 'tandaBaca', name: 'Tanda Baca', category: 'Kebahasaan', desc: 'Penempatan tanda titik, koma, petik, dan hubung.' },
  { id: 'hurufKapital', name: 'Huruf Kapital', category: 'Mikro', desc: 'Penggunaan kapital di awal kalimat, nama diri, dan geografi.' },
];

export const StudentGrowthReport: React.FC<StudentGrowthReportProps> = ({ dokumenList, onOpenEditor }) => {
  const [selectedDocModal, setSelectedDocModal] = useState<Dokumen | null>(null);

  // Filter dokumen yang sudah dinilai atau selesai
  const gradedDocs = useMemo(() => {
    return dokumenList
      .filter((d) => d.status === 'Selesai' || Boolean(d.penilaian) || d.status === 'Terkumpul')
      .map((d) => {
        let penilaian = d.penilaian;
        if (!penilaian) {
          const tags = parseDocumentTagCounts(d.teks);
          penilaian = hitungPenilaianOtomatis(d, tags, d.feedbackUmum);
        }
        return {
          ...d,
          penilaian,
        };
      })
      .sort((a, b) => {
        const timeA = a.waktuKumpul || a.waktuEdit || '';
        const timeB = b.waktuKumpul || b.waktuEdit || '';
        return timeB.localeCompare(timeA);
      });
  }, [dokumenList]);

  // Statistik Agregat Siswa
  const aggregateStats = useMemo(() => {
    if (gradedDocs.length === 0) return null;

    let sumTotal = 0;
    let sumMacro = 0;
    let sumMicro = 0;
    const varSums: Record<string, number> = {};

    RUBRIC_VARIABLES.forEach((v) => {
      varSums[v.id] = 0;
    });

    gradedDocs.forEach((d) => {
      const p = d.penilaian!;
      sumTotal += p.skorTotal;
      sumMacro += p.skorMakro;
      sumMicro += p.skorMikro;

      RUBRIC_VARIABLES.forEach((v) => {
        varSums[v.id] += (p as any)[v.id] || 4.0;
      });
    });

    const count = gradedDocs.length;
    const avgTotal = Math.round(sumTotal / count);
    const avgMacro = Math.round(sumMacro / count);
    const avgMicro = Math.round(sumMicro / count);

    const varAverages: Record<string, number> = {};
    RUBRIC_VARIABLES.forEach((v) => {
      varAverages[v.id] = Number((varSums[v.id] / count).toFixed(1));
    });

    // Identifikasi Superpower & Fokus Peningkatan
    const sortedVars = [...RUBRIC_VARIABLES].sort(
      (a, b) => varAverages[b.id] - varAverages[a.id]
    );

    const superpowers = sortedVars.slice(0, 2);
    const focusAreas = sortedVars.slice(-2).reverse();

    let predikatGlobal: 'Mahir (A)' | 'Cakap (B)' | 'Berkembang (C)' | 'Perlu Bimbingan (D)' = 'Cakap (B)';
    if (avgTotal >= 88) predikatGlobal = 'Mahir (A)';
    else if (avgTotal >= 75) predikatGlobal = 'Cakap (B)';
    else if (avgTotal >= 60) predikatGlobal = 'Berkembang (C)';
    else predikatGlobal = 'Perlu Bimbingan (D)';

    return {
      avgTotal,
      avgMacro,
      avgMicro,
      predikatGlobal,
      varAverages,
      superpowers,
      focusAreas,
      totalTugas: count,
    };
  }, [gradedDocs]);

  // Pure SVG Radar Coordinates Calculation (9 Sumbu)
  const radarSvgData = useMemo(() => {
    if (!aggregateStats) return null;

    const cx = 160;
    const cy = 160;
    const radius = 100;
    const n = RUBRIC_VARIABLES.length; // 9

    // Level circles (1 to 5)
    const gridLevels = [1, 2, 3, 4, 5].map((lvl) => {
      const r = (lvl / 5) * radius;
      const pts = Array.from({ length: n }).map((_, i) => {
        const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
        const x = cx + r * Math.cos(angle);
        const y = cy + r * Math.sin(angle);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      }).join(' ');
      return { level: lvl, points: pts };
    });

    // Sumbu Jari-jari
    const axes = RUBRIC_VARIABLES.map((v, i) => {
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      const xEnd = cx + radius * Math.cos(angle);
      const yEnd = cy + radius * Math.sin(angle);

      // Label coordinate with extra offset
      const labelOffset = radius + 22;
      const xLabel = cx + labelOffset * Math.cos(angle);
      const yLabel = cy + labelOffset * Math.sin(angle);

      return {
        id: v.id,
        name: v.name,
        category: v.category,
        x1: cx,
        y1: cy,
        x2: xEnd,
        y2: yEnd,
        xLabel,
        yLabel,
        score: aggregateStats.varAverages[v.id],
      };
    });

    // Data polygon
    const polygonPoints = RUBRIC_VARIABLES.map((v, i) => {
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      const score = Math.min(5, Math.max(1, aggregateStats.varAverages[v.id]));
      const r = (score / 5) * radius;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');

    return { cx, cy, gridLevels, axes, polygonPoints };
  }, [aggregateStats]);

  // Jika belum ada data tugas yang dinilai
  if (gradedDocs.length === 0 || !aggregateStats || !radarSvgData) {
    return (
      <div className="editorial-card p-12 text-center bg-white dark:bg-[#141416] border border-dashed border-stone-300 dark:border-stone-700 max-w-2xl mx-auto my-8">
        <div className="w-14 h-14 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center mb-4">
          <Award size={26} />
        </div>
        <h3 className="font-serif-literary text-xl font-bold text-stone-900 dark:text-stone-100 mb-2">
          Belum Ada Laporan Perkembangan Menulis
        </h3>
        <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed max-w-md mx-auto mb-6">
          Kumpulkan draf tugas naskah Anda dan tunggu catatan koreksi dari guru. Setelah guru mengoreksi naskah, grafik kemampuan, skor rata-rata, dan catatan perkembangan menulis Anda akan tampil secara otomatis di sini.
        </p>
        <div className="p-4 bg-stone-50 dark:bg-stone-900 rounded-xl text-left max-w-md mx-auto border border-stone-200/70 dark:border-stone-800">
          <div className="text-[11px] font-bold uppercase tracking-wider text-stone-600 dark:text-stone-300 mb-2 flex items-center gap-1.5">
            <Sparkles size={13} className="text-amber-500" />
            <span>Aspek Penilaian Menulis:</span>
          </div>
          <div className="grid grid-cols-2 gap-1 text-[11px] text-stone-600 dark:text-stone-400">
            <div>• Kedalaman Gagasan</div>
            <div>• Efektivitas Kalimat</div>
            <div>• Kepaduan Paragraf</div>
            <div>• Ketepatan Diksi</div>
            <div>• Struktur Teks</div>
            <div>• Kebakuan & Ejaan</div>
            <div>• Pembentukan Kata</div>
            <div>• Tanda Baca & Kapital</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 pb-12 animate-in fade-in duration-300">
      {/* 1. Header Ringkasan & Skor Utama */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Kartu Skor Rata-rata */}
        <div className="editorial-card p-6 bg-white dark:bg-[#141416] border border-stone-200/80 dark:border-stone-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400 flex items-center gap-1.5">
                <BarChart3 size={14} className="text-stone-500" /> Skor Rata-rata
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 font-semibold text-stone-600 dark:text-stone-300">
                {aggregateStats.totalTugas} Naskah Dinilai
              </span>
            </div>
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-4xl font-black font-serif-literary text-stone-900 dark:text-stone-100">
                {aggregateStats.avgTotal}
              </span>
              <span className="text-sm text-stone-400 dark:text-stone-500 font-medium">/ 100</span>
            </div>
            <div className="text-xs font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1">
              <span>Predikat:</span>
              <span className="underline decoration-amber-400 underline-offset-2">{aggregateStats.predikatGlobal}</span>
            </div>
          </div>
          <p className="text-[11px] text-stone-400 dark:text-stone-500 mt-4 pt-3 border-t border-stone-100 dark:border-stone-800">
            Rata-rata kumulatif dari seluruh tugas yang telah dinilai dan diberi masukan.
          </p>
        </div>

        {/* Kartu Aspek Terkuat & Perlu Latihan */}
        <div className="editorial-card p-6 bg-white dark:bg-[#141416] border border-stone-200/80 dark:border-stone-800 flex flex-col justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400 flex items-center gap-1.5 mb-3">
              <Sparkles size={14} className="text-stone-500" /> Ringkasan Kemampuan
            </span>

            {/* Aspek Terkuat */}
            <div className="mb-3 p-2.5 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/40">
              <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 flex items-center gap-1 mb-1">
                <span>Aspek Terkuat:</span>
              </div>
              <div className="text-xs font-semibold text-emerald-950 dark:text-emerald-200">
                {aggregateStats.superpowers.map((s) => s.name).join(' & ')}
              </div>
              <div className="text-[10px] text-emerald-800/80 dark:text-emerald-300/80 mt-0.5">
                Skor tertinggi (rata-rata {(aggregateStats.varAverages[aggregateStats.superpowers[0].id] * 20).toFixed(0)}%).
              </div>
            </div>

            {/* Perlu Latihan */}
            <div className="p-2.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40">
              <div className="text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300 flex items-center gap-1 mb-1">
                <Target size={12} /> Perlu Latihan:
              </div>
              <div className="text-xs font-semibold text-amber-950 dark:text-amber-200">
                {aggregateStats.focusAreas.map((f) => f.name).join(' & ')}
              </div>
              <div className="text-[10px] text-amber-800/80 dark:text-amber-300/80 mt-0.5">
                Area yang paling sering mendapatkan catatan perbaikan dari guru.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Visualisasi Radar Chart 9 Variabel & Tabel Rincian */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Radar Chart (Pure SVG) */}
        <div className="lg:col-span-5 editorial-card p-6 bg-white dark:bg-[#141416] border border-stone-200/80 dark:border-stone-800 flex flex-col items-center">
          <div className="w-full flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">
              Grafik Kemampuan
            </h4>
            <span className="text-[10px] text-stone-400">Skala 1 - 5</span>
          </div>

          <div className="w-full max-w-[320px] aspect-square relative my-2">
            <svg viewBox="0 0 320 320" className="w-full h-full overflow-visible">
              {/* Grid concentric polygons */}
              {radarSvgData.gridLevels.map((gl) => (
                <polygon
                  key={gl.level}
                  points={gl.points}
                  fill={gl.level === 5 ? 'rgba(0,0,0,0.02)' : 'none'}
                  stroke="currentColor"
                  strokeWidth={gl.level === 5 ? '1.5' : '0.8'}
                  className="text-stone-200 dark:text-stone-800"
                />
              ))}

              {/* Sumbu jari-jari */}
              {radarSvgData.axes.map((ax) => (
                <line
                  key={ax.id}
                  x1={ax.x1}
                  y1={ax.y1}
                  x2={ax.x2}
                  y2={ax.y2}
                  stroke="currentColor"
                  strokeWidth="0.8"
                  strokeDasharray="2,2"
                  className="text-stone-200 dark:text-stone-800"
                />
              ))}

              {/* Area data polygon */}
              <polygon
                points={radarSvgData.polygonPoints}
                fill="rgba(59, 130, 246, 0.25)"
                stroke="#2563eb"
                strokeWidth="2.5"
                className="transition-all duration-700 ease-out"
              />

              {/* Titik vertex data */}
              {radarSvgData.axes.map((ax, idx) => {
                const angle = -Math.PI / 2 + (idx * 2 * Math.PI) / 9;
                const r = (ax.score / 5) * 100;
                const x = 160 + r * Math.cos(angle);
                const y = 160 + r * Math.sin(angle);
                return (
                  <circle
                    key={ax.id}
                    cx={x}
                    cy={y}
                    r="4"
                    fill="#1d4ed8"
                    stroke="#ffffff"
                    strokeWidth="1.5"
                  />
                );
              })}

              {/* Label 9 Variabel di keliling SVG */}
              {radarSvgData.axes.map((ax) => {
                const isLeft = ax.xLabel < 155;
                const isRight = ax.xLabel > 165;
                const textAnchor = isRight ? 'start' : isLeft ? 'end' : 'middle';

                return (
                  <text
                    key={ax.id}
                    x={ax.xLabel}
                    y={ax.yLabel}
                    textAnchor={textAnchor}
                    dominantBaseline="central"
                    className="text-[9px] font-semibold fill-stone-700 dark:fill-stone-300"
                  >
                    {ax.name.split(' ')[0]} ({ax.score})
                  </text>
                );
              })}
            </svg>
          </div>

          <div className="flex items-center justify-center gap-4 text-[10px] text-stone-500 dark:text-stone-400 mt-2">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" />
              Skor Kompetensi Anda
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 border border-stone-400 border-dashed inline-block" />
              Target Maksimal (5.0)
            </span>
          </div>
        </div>

        {/* Tabel 9 Variabel Rincian & Deskripsi */}
        <div className="lg:col-span-7 editorial-card p-6 bg-white dark:bg-[#141416] border border-stone-200/80 dark:border-stone-800">
          <h4 className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 mb-4 border-b border-stone-100 dark:border-stone-800 pb-2">
            Rincian Aspek Penilaian
          </h4>

          <div className="flex flex-col gap-3">
            {RUBRIC_VARIABLES.map((v) => {
              const score = aggregateStats.varAverages[v.id];
              const percentage = Math.round((score / 5) * 100);

              return (
                <div
                  key={v.id}
                  className="p-3 bg-stone-50/70 dark:bg-stone-900/60 rounded-xl border border-stone-100 dark:border-stone-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <strong className="text-xs text-stone-900 dark:text-stone-100 truncate">
                        {v.name}
                      </strong>
                    </div>
                    <p className="text-[11px] text-stone-400 dark:text-stone-500 leading-tight">
                      {v.desc}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="w-24 sm:w-28 h-2 bg-stone-200 dark:bg-stone-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          score >= 4.5
                            ? 'bg-emerald-500'
                            : score >= 3.5
                            ? 'bg-blue-500'
                            : 'bg-amber-500'
                        }`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <div className="text-xs font-mono font-bold text-stone-900 dark:text-stone-100 w-9 text-right">
                      {score.toFixed(1)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3. Riwayat Tugas & Detail Nilai Naskah */}
      <div className="editorial-card p-6 bg-white dark:bg-[#141416] border border-stone-200/80 dark:border-stone-800">
        <div className="flex items-center justify-between mb-4 border-b border-stone-100 dark:border-stone-800 pb-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
            <BookOpen size={14} className="text-stone-500" />
            <span>Linimasa Riwayat Tugas Dinilai ({gradedDocs.length})</span>
          </h4>
          <span className="text-[11px] text-stone-400">Klik tugas untuk rincian skor & masukan guru</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {gradedDocs.map((doc) => {
            const p = doc.penilaian!;
            return (
              <div
                key={doc.id}
                onClick={() => setSelectedDocModal(doc)}
                className="p-4 bg-stone-50/70 hover:bg-stone-100/80 dark:bg-stone-900/50 dark:hover:bg-stone-850 rounded-xl border border-stone-200/70 dark:border-stone-800 cursor-pointer transition-all flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-stone-200/70 dark:bg-stone-800 text-stone-700 dark:text-stone-300">
                      {doc.topik || 'Tugas Menulis'}
                    </span>
                    <span className="text-xs font-black font-serif-literary px-2 py-0.5 rounded bg-amber-100/80 dark:bg-amber-950 text-amber-900 dark:text-amber-200">
                      {p.skorTotal} / 100
                    </span>
                  </div>

                  <h5 className="font-bold text-sm text-stone-900 dark:text-stone-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-1 mb-1">
                    {doc.judul}
                  </h5>

                  <p className="text-[11px] text-stone-400 dark:text-stone-500 mb-3 line-clamp-2 italic">
                    "{p.catatanGuru || doc.feedbackUmum || 'Tidak ada catatan umum tambahan.'}"
                  </p>
                </div>

                <div className="pt-2 border-t border-stone-200/50 dark:border-stone-800/60 flex items-center justify-between text-[11px] text-stone-500 dark:text-stone-400">
                  <span>Predikat: <strong>{p.predikat}</strong></span>
                  <span className="text-blue-600 dark:text-blue-400 font-semibold flex items-center gap-0.5">
                    Rincian <ChevronRight size={13} />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* MODAL RINCIAN PENILAIAN PER NASKAH */}
      {selectedDocModal && selectedDocModal.penilaian && (
        <div
          onClick={() => setSelectedDocModal(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 backdrop-blur-xs p-4 animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="editorial-card w-full max-w-lg bg-white dark:bg-stone-900 p-6 shadow-2xl border border-stone-300 dark:border-stone-800 rounded-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-stone-100 dark:border-stone-800">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block mb-0.5">
                  Rapor Penilaian Tugas
                </span>
                <h3 className="font-bold font-serif-literary text-lg text-stone-900 dark:text-stone-100">
                  {selectedDocModal.judul}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDocModal(null)}
                className="text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 p-1 rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Skor Utama Naskah ini */}
            <div className="p-4 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200/80 dark:border-amber-800/80 flex items-center justify-between mb-4">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300 mb-0.5">
                  Skor Naskah
                </div>
                <div className="text-3xl font-black font-serif-literary text-amber-950 dark:text-amber-100">
                  {selectedDocModal.penilaian.skorTotal} <span className="text-xs font-normal text-amber-700 dark:text-amber-400">/ 100</span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-amber-200/80 dark:bg-amber-900 text-amber-900 dark:text-amber-200 inline-block">
                  {selectedDocModal.penilaian.predikat}
                </span>
              </div>
            </div>

            {/* Catatan Guru */}
            <div className="mb-4 p-3 bg-stone-50 dark:bg-stone-800/60 rounded-xl border border-stone-200/60 dark:border-stone-800 text-xs">
              <strong className="block text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-1">
                Catatan Guru:
              </strong>
              <p className="text-stone-800 dark:text-stone-200 italic font-serif-literary">
                "{selectedDocModal.penilaian.catatanGuru || selectedDocModal.feedbackUmum || 'Tidak ada catatan umum tertulis.'}"
              </p>
            </div>

            {/* Rincian Aspek Penilaian */}
            <div className="mb-5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-stone-600 dark:text-stone-400 mb-2">
                Rincian Skor Aspek Penilaian (Skala 1 - 5):
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {RUBRIC_VARIABLES.map((v) => {
                  const val = (selectedDocModal.penilaian as any)[v.id] || 4.0;
                  return (
                    <div
                      key={v.id}
                      className="p-2 bg-stone-50 dark:bg-stone-800/50 rounded-lg border border-stone-100 dark:border-stone-800 flex items-center justify-between text-xs"
                    >
                      <span className="text-stone-700 dark:text-stone-300 truncate mr-2">{v.name}</span>
                      <span className="font-mono font-bold text-stone-900 dark:text-stone-100">{val.toFixed(1)}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Tombol Buka di Editor */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  const id = selectedDocModal.id;
                  setSelectedDocModal(null);
                  onOpenEditor(id);
                }}
                className="editorial-btn flex-1 bg-stone-900 hover:bg-stone-800 text-white dark:bg-stone-100 dark:hover:bg-stone-200 dark:text-stone-900 text-xs py-2.5 font-semibold cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
              >
                <FileText size={14} /> Buka Naskah & Lihat Highlight Koreksi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
