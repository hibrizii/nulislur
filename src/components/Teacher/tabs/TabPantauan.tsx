import React, { useState } from 'react';
import { 
  Users, 
  RotateCcw, 
  ShieldAlert, 
  Eye, 
  LayoutGrid, 
  List, 
  Clock,
  PenTool
} from 'lucide-react';
import type { UserAccount, LiveStatus, Dokumen, KelasRoom } from '../../../types';

interface TabPantauanProps {
  students: UserAccount[];
  liveMap: Record<string, LiveStatus>;
  dokumenMap: Record<string, Dokumen>;
  kelasList: KelasRoom[];
  selectedFilterClass: string;
  searchQuery: string;
  masterTracking: boolean;
  onResetPelanggaran: () => void;
  onInspectStudent: (username: string) => void;
}

export const TabPantauan: React.FC<TabPantauanProps> = ({
  students,
  liveMap,
  dokumenMap: _dokumenMap,
  kelasList,
  selectedFilterClass,
  searchQuery,
  masterTracking,
  onResetPelanggaran,
  onInspectStudent: _onInspectStudent,
}) => {
  const [statusFilter, setStatusFilter] = useState<'semua' | 'online' | 'mengetik' | 'melanggar' | 'offline'>('semua');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Filter siswa berdasarkan search query & statusFilter sesi live
  const filteredList = students.filter((s) => {
    // 1. Search Query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = s.nama.toLowerCase().includes(q);
      const matchUser = s.username.toLowerCase().includes(q);
      if (!matchName && !matchUser) return false;
    }

    // 2. Status Filter Sesi Live
    const live = liveMap[s.username];
    const isOnline = Boolean(live?.isOnline);
    const isMelanggar = (live?.pelanggaranCount || 0) > 0 || live?.sedangKeluarTab;
    const isMengetik = isOnline && live?.aktivitas?.toLowerCase().includes('menulis');

    if (statusFilter === 'online') return isOnline;
    if (statusFilter === 'mengetik') return isMengetik;
    if (statusFilter === 'melanggar') return isMelanggar;
    if (statusFilter === 'offline') return !isOnline;

    return true;
  });

  // KPI Calculations Sesi Live
  const onlineCount = students.filter((s) => Boolean(liveMap[s.username]?.isOnline)).length;

  const typingCount = students.filter((s) => {
    const live = liveMap[s.username];
    const isOnline = Boolean(live?.isOnline);
    return isOnline && live?.aktivitas?.toLowerCase().includes('menulis');
  }).length;

  const violationCount = students.reduce((acc, s) => {
    const live = liveMap[s.username];
    return acc + (live?.pelanggaranCount || 0);
  }, 0);

  const offlineCount = Math.max(0, students.length - onlineCount);

  return (
    <div className="h-full flex flex-col min-h-0 overflow-hidden animate-in fade-in duration-200">
      {/* 1. SATU-SATUNYA TOOLBAR STICKY: RAMPING & TERPADU (~44px) */}
      <div className="shrink-0 p-2 sm:px-3 bg-white dark:bg-[#141416] rounded-2xl border border-stone-200/80 dark:border-stone-800 flex flex-wrap items-center justify-between gap-2 shadow-2xs mb-2">
        {/* Kiri: Judul Ringkas + Interactive Stat-Pills (Hanya Perilaku Live) */}
        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
          <span className="text-xs font-bold font-serif-literary text-stone-900 dark:text-stone-100 flex items-center gap-1.5 mr-1 shrink-0">
            <Eye size={15} className="text-emerald-600 dark:text-emerald-400" />
            <span>Pantauan Sesi</span>
          </span>

          <span className="text-stone-300 dark:text-stone-700 hidden sm:inline">•</span>

          {/* Interactive Stat-Pills */}
          <div className="flex flex-wrap items-center gap-1">
            <button
              onClick={() => setStatusFilter('semua')}
              className={`px-2.5 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                statusFilter === 'semua'
                  ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 shadow-2xs'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700'
              }`}
            >
              Semua ({students.length})
            </button>

            <button
              onClick={() => setStatusFilter('online')}
              className={`px-2.5 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                statusFilter === 'online'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${statusFilter === 'online' ? 'bg-white' : 'bg-emerald-500 animate-pulse'}`} />
              Online ({onlineCount})
            </button>

            <button
              onClick={() => setStatusFilter('mengetik')}
              className={`px-2.5 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                statusFilter === 'mengetik'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700'
              }`}
            >
              Sedang Menulis ({typingCount})
            </button>

            {violationCount > 0 ? (
              <button
                onClick={() => setStatusFilter('melanggar')}
                className={`px-2.5 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                  statusFilter === 'melanggar'
                    ? 'bg-red-600 text-white shadow-2xs'
                    : 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 border border-red-200/60 dark:border-red-900/40'
                }`}
              >
                <ShieldAlert size={11} /> Sanksi ({violationCount}x)
              </button>
            ) : null}

            <button
              onClick={() => setStatusFilter('offline')}
              className={`px-2.5 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                statusFilter === 'offline'
                  ? 'bg-stone-600 text-white shadow-2xs'
                  : 'bg-stone-100 text-stone-500 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-400 dark:hover:bg-stone-700'
              }`}
            >
              Offline ({offlineCount})
            </button>
          </div>
        </div>

        {/* Kanan: Aksi Reset Sanksi & Toggle Layout */}
        <div className="flex items-center gap-1.5 shrink-0 ml-auto sm:ml-0">
          <button
            onClick={onResetPelanggaran}
            className="editorial-btn bg-stone-100 hover:bg-stone-200 text-stone-700 dark:bg-stone-800 dark:hover:bg-stone-700 dark:text-stone-300 text-xs py-1 px-2.5 flex items-center gap-1.5 cursor-pointer rounded-xl"
            title="Reset catatan sanksi pelanggaran seluruh siswa ke 0"
          >
            <RotateCcw size={12} /> <span className="hidden sm:inline">Reset Sanksi</span>
          </button>

          <div className="flex items-center gap-0.5 bg-stone-100 dark:bg-stone-800 p-0.5 rounded-xl">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-2xs font-semibold'
                  : 'text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
              }`}
              title="Tampilan Kartu (Grid)"
            >
              <LayoutGrid size={14} />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-2xs font-semibold'
                  : 'text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
              }`}
              title="Tampilan Tabel (List)"
            >
              <List size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* 2. AREA KONTEN UTAMA (SCROLLABLE DENGAN RUANG LEGA MAKSIMAL) */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-0.5 space-y-3">
        {/* KPI Summary Cards (Mengalir di Dalam Scroll, Tidak Stuck Memblokir Layar) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="p-2.5 bg-white dark:bg-[#141416] rounded-xl border border-stone-200/80 dark:border-stone-800 shadow-2xs">
            <div className="flex items-center justify-between text-stone-400 dark:text-stone-500 text-[10px] font-bold uppercase tracking-wider mb-0.5">
              <span>Total Siswa</span>
              <Users size={13} />
            </div>
            <div className="text-lg font-black font-serif-literary text-stone-900 dark:text-stone-100">
              {students.length}
            </div>
            <span className="text-[10px] text-stone-400 truncate block">
              {selectedFilterClass === 'semua' ? 'Semua kelas aktif' : `Kelas: ${selectedFilterClass}`}
            </span>
          </div>

          <div className="p-2.5 bg-white dark:bg-[#141416] rounded-xl border border-stone-200/80 dark:border-stone-800 shadow-2xs">
            <div className="flex items-center justify-between text-blue-600 dark:text-blue-400 text-[10px] font-bold uppercase tracking-wider mb-0.5">
              <span>Sedang Menulis</span>
              <PenTool size={13} className="text-blue-500" />
            </div>
            <div className="text-lg font-black font-serif-literary text-blue-700 dark:text-blue-400">
              {typingCount}
            </div>
            <span className="text-[10px] text-stone-400 truncate block">
              {onlineCount > 0 ? `${typingCount} dari ${onlineCount} siswa online` : 'Belum ada aktivitas'}
            </span>
          </div>

          <div className="p-2.5 bg-white dark:bg-[#141416] rounded-xl border border-stone-200/80 dark:border-stone-800 shadow-2xs">
            <div className="flex items-center justify-between text-blue-600 dark:text-blue-400 text-[10px] font-bold uppercase tracking-wider mb-0.5">
              <span>Kehadiran</span>
              <Users size={13} />
            </div>
            <div className="text-lg font-black font-serif-literary text-blue-700 dark:text-blue-400 flex items-baseline gap-1">
              <span>{onlineCount}</span>
              <span className="text-xs font-sans font-medium text-stone-400 dark:text-stone-500">
                / {students.length} Siswa
              </span>
            </div>
            <span className="text-[10px] text-stone-400 truncate block">
              {offlineCount} siswa offline
            </span>
          </div>

          <div className="p-2.5 bg-white dark:bg-[#141416] rounded-xl border border-stone-200/80 dark:border-stone-800 shadow-2xs">
            <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 text-[10px] font-bold uppercase tracking-wider mb-0.5">
              <span>Sanksi Tab</span>
              <ShieldAlert size={13} />
            </div>
            <div className="text-lg font-black font-serif-literary text-stone-900 dark:text-stone-100">
              {violationCount}x
            </div>
            <span className="text-[10px] text-stone-400 truncate block">
              {masterTracking ? 'Sensor aktif' : 'Sensor nonaktif'}
            </span>
          </div>
        </div>

        {filteredList.length === 0 ? (
          <div className="editorial-card p-12 text-center bg-white dark:bg-[#141416] border border-dashed border-stone-200 dark:border-stone-800">
            <Users size={32} className="mx-auto text-stone-300 dark:text-stone-600 mb-3" />
            <p className="text-sm font-semibold text-stone-700 dark:text-stone-300">
              Tidak ada siswa yang sesuai kriteria filter.
            </p>
            <p className="text-xs text-stone-400 dark:text-stone-500 mt-1">
              Coba ganti filter status atau bersihkan kata kunci pencarian.
            </p>
          </div>
        ) : viewMode === 'grid' ? (
          /* Grid Kartu Siswa Minimalis & Ramping (5-6 Kolom) */
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5">
            {filteredList.map((s) => {
              const live = liveMap[s.username];
              const isOnline = Boolean(live?.isOnline);
              const isMelanggar = (live?.pelanggaranCount || 0) > 0 || live?.sedangKeluarTab;

              return (
                <div
                  key={s.username}
                  className={`p-3 bg-white dark:bg-[#141416] rounded-xl border transition-all flex flex-col justify-between ${
                    isMelanggar && live?.sedangKeluarTab
                      ? 'border-red-400 dark:border-red-800 bg-red-50/20 shadow-xs'
                      : isMelanggar
                      ? 'border-red-200 dark:border-red-900/40 bg-red-50/5'
                      : isOnline
                      ? 'border-stone-200 dark:border-stone-750 hover:border-stone-350 shadow-2xs'
                      : 'border-stone-200/60 dark:border-stone-800/70 opacity-80'
                  }`}
                >
                  <div>
                    {/* Header: Indikator Online/Offline & Badge Sanksi */}
                    <div className="flex items-center justify-between gap-1.5 mb-1.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-stone-300 dark:bg-stone-600'
                          }`}
                        />
                        <span className="text-[10px] font-semibold text-stone-500 dark:text-stone-400 truncate">
                          {isOnline ? 'Online' : 'Offline'}
                        </span>
                      </div>

                      {(live?.pelanggaranCount || 0) > 0 && (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 flex items-center gap-0.5 shrink-0">
                          <ShieldAlert size={9} /> {live?.pelanggaranCount}x
                        </span>
                      )}
                    </div>

                    {/* Nama Siswa & Username */}
                    <h4 className="font-bold text-xs text-stone-900 dark:text-stone-100 truncate" title={s.nama}>
                      {s.nama}
                    </h4>
                    <div className="text-[10px] text-stone-400 dark:text-stone-500 font-mono truncate mb-2">
                      @{s.username} • {s.namaKelas || kelasList.find((k) => k.kodeKelas === s.kodeKelas)?.namaKelas || 'Kelas'}
                    </div>
                  </div>

                  {/* Status Aktivitas Langsung (Tanpa Label 'Aktivitas Terakhir:') */}
                  <div>
                    {isMelanggar && live?.sedangKeluarTab ? (
                      <div className="p-1.5 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-[10px] text-red-600 dark:text-red-400 font-bold flex items-center gap-1">
                        <ShieldAlert size={12} className="shrink-0" />
                        <span className="truncate">Keluar Tab!</span>
                      </div>
                    ) : isOnline ? (
                      <div className="p-1.5 rounded-lg bg-stone-50 dark:bg-stone-900/60 border border-stone-200/60 dark:border-stone-800 text-[10px] text-stone-700 dark:text-stone-300 font-medium truncate" title={live?.aktivitas || 'Aktif'}>
                        {live?.aktivitas || 'Aktif di kelas'}
                      </div>
                    ) : (
                      <div className="p-1.5 rounded-lg bg-stone-50/50 dark:bg-stone-900/30 border border-stone-100 dark:border-stone-850 text-[10px] text-stone-400 dark:text-stone-500 flex items-center gap-1">
                        <Clock size={10} className="shrink-0" />
                        <span className="truncate">Belum aktif</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Table View Sesi Live Minimalis */
          <div className="editorial-card p-4 bg-white dark:bg-[#141416] border border-stone-200/80 dark:border-stone-800 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-stone-100 dark:border-stone-800 text-stone-400 dark:text-stone-500 font-bold uppercase tracking-wider text-[10px]">
                  <th className="pb-2.5">Siswa</th>
                  <th className="pb-2.5">Kelas</th>
                  <th className="pb-2.5">Status & Aktivitas</th>
                  <th className="pb-2.5 text-right">Pelanggaran Tab</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                {filteredList.map((s) => {
                  const live = liveMap[s.username];
                  const isOnline = Boolean(live?.isOnline);

                  return (
                    <tr key={s.username} className="hover:bg-stone-50/60 dark:hover:bg-stone-900/40">
                      <td className="py-2.5 font-semibold text-stone-900 dark:text-stone-100">
                        <div>{s.nama}</div>
                        <div className="text-[10px] text-stone-400 font-mono">@{s.username}</div>
                      </td>
                      <td className="py-2.5">
                        <span className="px-2 py-0.5 rounded bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 font-medium text-[10px]">
                          {s.namaKelas || kelasList.find((k) => k.kodeKelas === s.kodeKelas)?.namaKelas || 'Kelas'}
                        </span>
                      </td>
                      <td className="py-2.5">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-stone-300 dark:bg-stone-600'
                            }`}
                          />
                          <span className="text-stone-700 dark:text-stone-300 font-medium text-[11px]">
                            {isOnline ? live?.aktivitas || 'Online' : 'Offline'}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 text-right">
                        {(live?.pelanggaranCount || 0) > 0 ? (
                          <span className="px-2 py-0.5 rounded-full font-bold text-[10px] bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 inline-flex items-center gap-1">
                            <ShieldAlert size={10} /> {live?.pelanggaranCount}x
                          </span>
                        ) : (
                          <span className="text-stone-400 font-mono text-[11px]">0</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
