import React from 'react';
import { 
  Menu, 
  Filter, 
  Search, 
  X, 
  ShieldAlert, 
  FileEdit, 
  Megaphone,
  Sparkles,
} from 'lucide-react';
import type { KelasRoom } from '../../types';

interface TeacherHeaderProps {
  myClasses: KelasRoom[];
  selectedFilterClass: string;
  onFilterClassChange: (code: string) => void;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  onOpenMobileMenu: () => void;
  onlineCount: number;
  taskQueueCount: number;
  violationCount: number;
  violationToast: { id: string; message: string } | null;
  onDismissViolationToast: () => void;
  onOpenWoroModal: () => void;
  onOpenQuoteModal: () => void;
}

export const TeacherHeader: React.FC<TeacherHeaderProps> = ({
  myClasses,
  selectedFilterClass,
  onFilterClassChange,
  searchQuery,
  onSearchQueryChange,
  onOpenMobileMenu,
  onlineCount,
  taskQueueCount,
  violationCount,
  violationToast,
  onDismissViolationToast,
  onOpenWoroModal,
  onOpenQuoteModal,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-white/95 dark:bg-[#141416]/95 backdrop-blur-md border-b border-stone-200/80 dark:border-stone-800 px-4 sm:px-6 py-3 transition-colors">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Kiri: Hamburger (Mobile) / Toggle Sidebar (Desktop) + Global Class Selector */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={onOpenMobileMenu}
            className="p-1.5 rounded-lg text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 lg:hidden cursor-pointer"
            title="Buka Menu"
          >
            <Menu size={20} />
          </button>

          {/* Kelas Selector */}

          <div className="flex items-center gap-2">
            <span className="hidden sm:flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
              <Filter size={13} /> Kelas Aktif:
            </span>
            <select
              value={selectedFilterClass}
              onChange={(e) => onFilterClassChange(e.target.value)}
              className="editorial-input py-1.5 px-3 text-xs font-semibold bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-750 dark:text-stone-100 rounded-xl max-w-[200px] sm:max-w-[240px] truncate"
            >
              <option value="semua">Semua Kelas ({myClasses.length})</option>
              {myClasses.map((k) => (
                <option key={k.kodeKelas} value={k.kodeKelas}>
                  {k.namaKelas} ({k.kodeKelas})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Tengah/Kanan: Pencarian Siswa & Quick Metrics */}
        <div className="flex items-center gap-2.5 flex-1 justify-end max-w-xl">
          {/* Pencarian Cepat */}
          <div className="relative w-full max-w-[220px] sm:max-w-[260px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              placeholder="Cari siswa atau tugas..."
              className="editorial-input w-full pl-8 pr-7 py-1.5 text-xs bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-750 dark:text-stone-100 rounded-xl focus:bg-white dark:focus:bg-stone-900"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchQueryChange('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 p-0.5"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Quick Indicator Badges */}
          <div className="hidden md:flex items-center gap-2">
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-900/60 text-xs font-semibold"
              title={`${onlineCount} siswa sedang online`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>{onlineCount} Online</span>
            </div>

            {taskQueueCount > 0 && (
              <div
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 border border-blue-200/80 dark:border-blue-900/60 text-xs font-semibold"
                title={`${taskQueueCount} tugas siap diperiksa`}
              >
                <FileEdit size={12} />
                <span>{taskQueueCount} Antrean</span>
              </div>
            )}

            {violationCount > 0 && (
              <div
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200/80 dark:border-amber-900/60 text-xs font-semibold"
                title={`${violationCount} total pelanggaran keluar tab`}
              >
                <ShieldAlert size={12} />
                <span>{violationCount}x Sanksi</span>
              </div>
            )}
          </div>

          {/* Quick Action Modal Triggers (Desktop) */}
          <div className="hidden xl:flex items-center gap-1 pl-2 border-l border-stone-200 dark:border-stone-800">
            <button
              onClick={onOpenWoroModal}
              className="p-1.5 rounded-lg text-amber-700 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-950/40 cursor-pointer"
              title="Kirim Woro-woro Siswa"
            >
              <Megaphone size={16} />
            </button>
            <button
              onClick={onOpenQuoteModal}
              className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/40 cursor-pointer"
              title="Atur Kutipan Sastra Siswa"
            >
              <Sparkles size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Toast Alert Pelanggaran (Muncul jika ada siswa keluar tab) */}
      {violationToast && (
        <div className="mt-2.5 p-2.5 bg-red-600 text-white rounded-xl shadow-lg flex items-center justify-between text-xs font-semibold animate-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <ShieldAlert size={15} className="shrink-0 animate-bounce" />
            <span>{violationToast.message}</span>
          </div>
          <button
            onClick={onDismissViolationToast}
            className="p-1 rounded hover:bg-red-700 text-white/80 hover:text-white cursor-pointer"
          >
            <X size={13} />
          </button>
        </div>
      )}
    </header>
  );
};
