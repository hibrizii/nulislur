import React from 'react';
import { 
  Eye, 
  FileEdit, 
  Users, 
  KeyRound, 
  BookOpen,
  MessageSquare,
  PenTool, 
  Megaphone, 
  Sparkles, 
  ShieldAlert, 
  Bell, 
  BellOff, 
  LogOut,
  X,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';
import { ThemeToggle } from '../Common/ThemeToggle';
import type { UserAccount } from '../../types';

export type TeacherTab = 'pantauan' | 'penilaian' | 'kelas' | 'migrasi' | 'mading' | 'redaksi' | 'cuitan';

interface TeacherSidebarProps {
  user: UserAccount;
  activeTab: TeacherTab;
  onTabChange: (tab: TeacherTab) => void;
  pendingReviewCount: number;
  onlineCount: number;
  totalViolations: number;
  masterTracking: boolean;
  onToggleTracking: () => void;
  notifPelanggaran: boolean;
  onToggleNotifPelanggaran: () => void;
  onOpenWoroModal: () => void;
  onOpenQuoteModal: () => void;
  onLogout: () => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const TeacherSidebar: React.FC<TeacherSidebarProps> = ({
  user,
  activeTab,
  onTabChange,
  pendingReviewCount,
  onlineCount,
  masterTracking,
  onToggleTracking,
  notifPelanggaran,
  onToggleNotifPelanggaran,
  onOpenWoroModal,
  onOpenQuoteModal,
  onLogout,
  isOpenMobile,
  onCloseMobile,
  isCollapsed = false,
  onToggleCollapse,
}) => {
  return (
    <>
      {/* Overlay Backdrop untuk Mobile */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-stone-900/50 backdrop-blur-xs z-40 lg:hidden"
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 bg-white dark:bg-[#141416] border-r border-stone-200/80 dark:border-stone-800 flex flex-col justify-between transition-all duration-200 ease-in-out lg:translate-x-0 h-screen max-h-screen shrink-0 overflow-hidden ${
          isOpenMobile ? 'translate-x-0 shadow-2xl w-64 p-5' : '-translate-x-full'
        } lg:static lg:z-auto ${
          isCollapsed ? 'lg:w-[72px] lg:px-2.5 lg:py-4' : 'lg:w-64 lg:p-5'
        }`}
      >
        <div className="flex-1 flex flex-col min-h-0">
          {/* Header Brand */}
          <div className={`pb-3 mb-3 border-b border-stone-100 dark:border-stone-800 flex items-center ${
            isCollapsed ? 'lg:flex-col lg:gap-2 justify-between' : 'justify-between'
          }`}>
            <div className={`flex items-center gap-2.5 min-w-0 ${isCollapsed ? 'lg:justify-center' : ''}`}>
              <div className="w-9 h-9 rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 flex items-center justify-center font-serif-literary font-bold text-base shadow-xs shrink-0">
                NL
              </div>
              {/* Teks Brand (Hanya tampil jika expanded atau di mobile) */}
              <div className={`min-w-0 flex-1 ${isCollapsed ? 'lg:hidden' : ''}`}>
                <h1 className="text-base font-bold font-serif-literary text-stone-900 dark:text-stone-100 truncate">
                  NulisLur
                </h1>
                <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 block uppercase tracking-wider">
                  Ruang Guru
                </span>
              </div>
            </div>

            {/* Kontrol Desktop Collapse & Theme Toggle */}
            <div className={`flex items-center gap-1 ${isCollapsed ? 'lg:flex-col' : ''}`}>
              {/* Tombol Collapse Desktop */}
              {onToggleCollapse && (
                <button
                  type="button"
                  onClick={onToggleCollapse}
                  className="hidden lg:flex p-1.5 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
                  title={isCollapsed ? 'Buka Sidebar' : 'Ciutkan Sidebar'}
                >
                  {isCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
                </button>
              )}

              <ThemeToggle className="w-8 h-8 rounded-lg" />

              {/* Close Mobile */}
              {isOpenMobile && (
                <button
                  type="button"
                  onClick={onCloseMobile}
                  className="p-1 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 lg:hidden"
                >
                  <X size={18} />
                </button>
              )}
            </div>
          </div>

          {/* Profil Singkat Guru */}
          {isCollapsed ? (
            <div 
              className="hidden lg:flex w-9 h-9 mx-auto mb-3 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-200 font-bold text-xs items-center justify-center font-serif-literary shrink-0 border border-stone-200 dark:border-stone-700 cursor-default"
              title={`${user.nama || user.username} (@${user.username})`}
            >
              {(user.nama || user.username || 'G')[0].toUpperCase()}
            </div>
          ) : (
            <div className="px-3 py-2.5 mb-3 rounded-xl bg-stone-50 dark:bg-stone-900/60 border border-stone-200/60 dark:border-stone-800 flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300 font-bold text-xs flex items-center justify-center font-serif-literary shrink-0">
                {(user.nama || user.username || 'G')[0].toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-stone-800 dark:text-stone-200 truncate">
                  {user.nama || user.username}
                </div>
                <div className="text-[10px] text-stone-400 dark:text-stone-500 font-mono truncate">
                  @{user.username}
                </div>
              </div>
            </div>
          )}

          {/* Navigasi Utama */}
          <nav className="flex flex-col gap-1 overflow-y-auto pr-0.5 flex-1 custom-scrollbar">
            {!isCollapsed && (
              <span className="text-[9px] uppercase font-bold tracking-wider text-stone-400 dark:text-stone-500 px-2 py-0.5">
                Aktivitas Utama
              </span>
            )}

            {/* Tab 1: Pantauan Siswa */}
            <button
              onClick={() => {
                onTabChange('pantauan');
                onCloseMobile?.();
              }}
              title="Pantauan Siswa Real-time"
              className={`editorial-btn py-2 text-xs cursor-pointer transition-all ${
                isCollapsed ? 'lg:justify-center lg:px-0' : 'justify-between px-3'
              } ${
                activeTab === 'pantauan'
                  ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 shadow-xs font-semibold'
                  : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800/80 hover:text-stone-900 dark:hover:text-stone-100'
              }`}
            >
              <div className="flex items-center gap-2.5 relative">
                <Eye size={16} className="shrink-0" />
                <span className={isCollapsed ? 'lg:hidden' : ''}>Pantauan Siswa</span>
                {/* Badge Dot saat collapsed */}
                {isCollapsed && onlineCount > 0 && (
                  <span className="hidden lg:block absolute -top-1 -right-1.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#141416]" />
                )}
              </div>
              {/* Badge Count saat expanded */}
              {onlineCount > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  isCollapsed ? 'lg:hidden' : ''
                } ${
                  activeTab === 'pantauan'
                    ? 'bg-emerald-500 text-white'
                    : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                }`}>
                  {onlineCount}
                </span>
              )}
            </button>

            {/* Tab 2: Koreksi Tugas */}
            <button
              onClick={() => {
                onTabChange('penilaian');
                onCloseMobile?.();
              }}
              title="Studio Koreksi Tugas"
              className={`editorial-btn py-2 text-xs cursor-pointer transition-all ${
                isCollapsed ? 'lg:justify-center lg:px-0' : 'justify-between px-3'
              } ${
                activeTab === 'penilaian'
                  ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 shadow-xs font-semibold'
                  : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800/80 hover:text-stone-900 dark:hover:text-stone-100'
              }`}
            >
              <div className="flex items-center gap-2.5 relative">
                <FileEdit size={16} className="shrink-0" />
                <span className={isCollapsed ? 'lg:hidden' : ''}>Koreksi Tugas</span>
                {/* Badge Dot saat collapsed */}
                {isCollapsed && pendingReviewCount > 0 && (
                  <span className="hidden lg:block absolute -top-1 -right-1.5 w-2.5 h-2.5 rounded-full bg-blue-500 ring-2 ring-white dark:ring-[#141416]" />
                )}
              </div>
              {/* Badge Count saat expanded */}
              {pendingReviewCount > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  isCollapsed ? 'lg:hidden' : ''
                } ${
                  activeTab === 'penilaian'
                    ? 'bg-blue-500 text-white'
                    : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                }`}>
                  {pendingReviewCount}
                </span>
              )}
            </button>

            {/* Tab 3: Kelola Kelas */}
            <button
              onClick={() => {
                onTabChange('kelas');
                onCloseMobile?.();
              }}
              title="Kelola Kelas & Siswa"
              className={`editorial-btn py-2 text-xs cursor-pointer transition-all ${
                isCollapsed ? 'lg:justify-center lg:px-0' : 'justify-start px-3'
              } ${
                activeTab === 'kelas'
                  ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 shadow-xs font-semibold'
                  : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800/80 hover:text-stone-900 dark:hover:text-stone-100'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Users size={16} className="shrink-0" />
                <span className={isCollapsed ? 'lg:hidden' : ''}>Kelola Kelas</span>
              </div>
            </button>

            {!isCollapsed && (
              <span className="text-[9px] uppercase font-bold tracking-wider text-stone-400 dark:text-stone-500 px-2 py-0.5 mt-2">
                Karya & Publikasi
              </span>
            )}

            {/* Tab: Cuitan Siswa */}
            <button
              onClick={() => {
                onTabChange('cuitan');
                onCloseMobile?.();
              }}
              title="Cuitan Siswa"
              className={`editorial-btn py-2 text-xs cursor-pointer transition-all ${
                isCollapsed ? 'lg:justify-center lg:px-0' : 'justify-start px-3'
              } ${
                activeTab === 'cuitan'
                  ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 shadow-xs font-semibold'
                  : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800/80 hover:text-stone-900 dark:hover:text-stone-100'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <MessageSquare size={16} className="shrink-0" />
                <span className={isCollapsed ? 'lg:hidden' : ''}>Cuitan Siswa</span>
              </div>
            </button>

            {/* Tab: Pojok Baca */}
            <button
              onClick={() => {
                onTabChange('mading');
                onCloseMobile?.();
              }}
              title="Pojok Baca"
              className={`editorial-btn py-2 text-xs cursor-pointer transition-all ${
                isCollapsed ? 'lg:justify-center lg:px-0' : 'justify-start px-3'
              } ${
                activeTab === 'mading'
                  ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 shadow-xs font-semibold'
                  : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800/80 hover:text-stone-900 dark:hover:text-stone-100'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <BookOpen size={16} className="shrink-0" />
                <span className={isCollapsed ? 'lg:hidden' : ''}>Pojok Baca</span>
              </div>
            </button>

            {/* Tab 5: Tulisan Guru */}
            <button
              onClick={() => {
                onTabChange('redaksi');
                onCloseMobile?.();
              }}
              title="Tulisan Guru"
              className={`editorial-btn py-2 text-xs cursor-pointer transition-all ${
                isCollapsed ? 'lg:justify-center lg:px-0' : 'justify-start px-3'
              } ${
                activeTab === 'redaksi'
                  ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 shadow-xs font-semibold'
                  : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800/80 hover:text-stone-900 dark:hover:text-stone-100'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <PenTool size={16} className="shrink-0" />
                <span className={isCollapsed ? 'lg:hidden' : ''}>Tulisan Guru</span>
              </div>
            </button>

            {/* Tab 6: Kode Redeem Migrasi */}
            <button
              onClick={() => {
                onTabChange('migrasi');
                onCloseMobile?.();
              }}
              title="Kode Redeem Migrasi"
              className={`editorial-btn py-2 text-xs cursor-pointer transition-all ${
                isCollapsed ? 'lg:justify-center lg:px-0' : 'justify-start px-3'
              } ${
                activeTab === 'migrasi'
                  ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 shadow-xs font-semibold'
                  : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800/80 hover:text-stone-900 dark:hover:text-stone-100'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <KeyRound size={16} className="shrink-0" />
                <span className={isCollapsed ? 'lg:hidden' : ''}>Kode Redeem</span>
              </div>
            </button>

            {/* Quick Actions (Woro-woro & Quotes) */}
            {!isCollapsed && (
              <span className="text-[9px] uppercase font-bold tracking-wider text-stone-400 dark:text-stone-500 px-2 py-0.5 mt-2">
                Interaksi Siswa
              </span>
            )}

            <button
              onClick={onOpenWoroModal}
              title="Kirim Woro-woro ke Siswa"
              className={`editorial-btn py-2 text-xs text-amber-900 bg-amber-50/80 hover:bg-amber-100 border border-amber-200/80 dark:bg-amber-950/30 dark:text-amber-200 dark:border-amber-900/60 dark:hover:bg-amber-950/60 cursor-pointer ${
                isCollapsed ? 'lg:justify-center lg:px-0' : 'justify-start px-3'
              }`}
            >
              <Megaphone size={15} className="text-amber-600 dark:text-amber-400 shrink-0" />
              <span className={isCollapsed ? 'lg:hidden' : 'ml-2'}>Woro-woro</span>
            </button>

            <button
              onClick={onOpenQuoteModal}
              title="Atur Kutipan Sastra Siswa"
              className={`editorial-btn py-2 text-xs text-stone-800 bg-stone-100/80 hover:bg-stone-200 border border-stone-200/70 dark:bg-stone-900 dark:text-stone-200 dark:border-stone-800 dark:hover:bg-stone-800 cursor-pointer ${
                isCollapsed ? 'lg:justify-center lg:px-0' : 'justify-start px-3'
              }`}
            >
              <Sparkles size={15} className="text-amber-500 shrink-0" />
              <span className={isCollapsed ? 'lg:hidden' : 'ml-2'}>Kutipan</span>
            </button>
          </nav>
        </div>

        {/* Footer Sidebar: Pengaturan Anti-Curang & Logout */}
        <div className="pt-2.5 mt-2 border-t border-stone-100 dark:border-stone-800 flex flex-col gap-2">
          {/* Card Sensor Sanksi */}
          {isCollapsed ? (
            <button
              onClick={onToggleTracking}
              className={`p-2 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                masterTracking 
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 border border-emerald-200 dark:border-emerald-800' 
                  : 'bg-stone-100 dark:bg-stone-800 text-stone-400 border border-stone-200 dark:border-stone-700'
              }`}
              title={masterTracking ? 'Sensor Sanksi: Aktif (Klik untuk ubah)' : 'Sensor Sanksi: Nonaktif (Klik untuk ubah)'}
            >
              <ShieldAlert size={16} />
            </button>
          ) : (
            <div className="p-2.5 bg-stone-50 dark:bg-stone-900/60 rounded-xl border border-stone-200/70 dark:border-stone-800">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[9px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider flex items-center gap-1">
                  <ShieldAlert size={11} /> Sensor Sanksi
                </span>
                <span className={`w-2 h-2 rounded-full ${masterTracking ? 'bg-emerald-500' : 'bg-stone-400'}`} />
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={onToggleTracking}
                  className={`py-1 px-1.5 rounded-lg text-[10px] font-semibold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                    masterTracking
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-stone-200 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-300'
                  }`}
                  title="Aktifkan/nonaktifkan deteksi sanksi keluar tab"
                >
                  <span>{masterTracking ? 'Deteksi: On' : 'Deteksi: Off'}</span>
                </button>

                <button
                  onClick={() => {
                    if (!masterTracking) {
                      alert('Nyalakan deteksi keluar tab terlebih dahulu untuk mengaktifkan alarm.');
                      return;
                    }
                    onToggleNotifPelanggaran();
                  }}
                  className={`py-1 px-1.5 rounded-lg text-[10px] font-semibold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                    notifPelanggaran && masterTracking
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-stone-200 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-300'
                  }`}
                  title="Aktifkan alarm suara saat ada siswa keluar tab"
                >
                  {notifPelanggaran && masterTracking ? <Bell size={10} /> : <BellOff size={10} />}
                  <span>{notifPelanggaran && masterTracking ? 'Alarm' : 'Mute'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Tombol Logout */}
          <button
            onClick={onLogout}
            title="Keluar Akun"
            className={`editorial-btn bg-stone-100 hover:bg-red-50 hover:text-red-700 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-red-950/40 dark:hover:text-red-400 text-stone-600 py-2 text-xs cursor-pointer flex items-center justify-center ${
              isCollapsed ? 'lg:px-0' : 'w-full gap-1.5'
            }`}
          >
            <LogOut size={14} className="shrink-0" />
            <span className={isCollapsed ? 'lg:hidden' : ''}>Keluar</span>
          </button>
        </div>
      </aside>
    </>
  );
};
