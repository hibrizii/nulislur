import React, { useState } from 'react';
import { 
  Users, 
  Plus, 
  UserPlus, 
  Copy, 
  Check, 
  Edit2, 
  Trash2, 
  KeyRound, 
  Download, 
  Search,
  GraduationCap
} from 'lucide-react';
import type { KelasRoom, UserAccount, Penugasan } from '../../../types';
import { BookOpen, Calendar, Target } from 'lucide-react';

interface TabKelolaKelasProps {
  myClasses: KelasRoom[];
  user: UserAccount;
  allUsersList: UserAccount[];
  selectedFilterClass: string;
  onFilterClassChange: (code: string) => void;
  onOpenNewClassModal: () => void;
  onOpenJoinClassModal: () => void;
  onOpenEditClassModal: (k: KelasRoom) => void;
  onDeleteClass: (k: KelasRoom) => void;
  onResetPassword: (username: string, nama: string) => void;
  onDeleteStudent: (username: string, nama: string, kodeKelas?: string) => void;
  penugasanList?: Penugasan[];
  onOpenNewPenugasanModal?: () => void;
  onEditPenugasan?: (penugasan: Penugasan) => void;
  onDeletePenugasan?: (id: string, judul: string) => void;
}

export const TabKelolaKelas: React.FC<TabKelolaKelasProps> = ({
  myClasses,
  user,
  allUsersList,
  selectedFilterClass,
  onFilterClassChange,
  onOpenNewClassModal,
  onOpenJoinClassModal,
  onOpenEditClassModal,
  onDeleteClass,
  onResetPassword,
  onDeleteStudent,
  penugasanList = [],
  onOpenNewPenugasanModal,
  onEditPenugasan,
  onDeletePenugasan,
}) => {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [searchRoster, setSearchRoster] = useState<string>('');
  const [activeSubTab, setActiveSubTab] = useState<'siswa' | 'tugas'>('siswa');

  // Salin Kode Kelas
  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Hitung jumlah siswa per kelas secara efisien (O(N) lookup)
  const classStudentCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of allUsersList) {
      if (s.kodeKelas && s.role === 'siswa') {
        counts[s.kodeKelas] = (counts[s.kodeKelas] || 0) + 1;
      }
    }
    return counts;
  }, [allUsersList]);

  // Filter Siswa Roster (Memoized)
  const filteredStudents = React.useMemo(() => {
    return allUsersList.filter((s) => {
      // 1. Filter Kelas
      if (selectedFilterClass !== 'semua' && s.kodeKelas !== selectedFilterClass) {
        return false;
      }
      // 2. Search
      if (searchRoster.trim()) {
        const q = searchRoster.toLowerCase();
        const matchName = s.nama.toLowerCase().includes(q);
        const matchUser = s.username.toLowerCase().includes(q);
        if (!matchName && !matchUser) return false;
      }
      return true;
    });
  }, [allUsersList, selectedFilterClass, searchRoster]);

  // Ekspor Data Siswa ke CSV
  const handleExportCSV = () => {
    if (filteredStudents.length === 0) return;
    const headers = ['Nama Siswa', 'Username', 'Kode Kelas', 'Nama Kelas', 'Waktu Daftar'];
    const rows = filteredStudents.map((s) => [
      `"${s.nama.replace(/"/g, '""')}"`,
      `"${s.username}"`,
      `"${s.kodeKelas || ''}"`,
      `"${s.namaKelas || ''}"`,
      `"${s.waktuDaftar || ''}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Daftar_Siswa_${selectedFilterClass}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Kelas yang saat ini sedang aktif dipilih
  const currentSelectedClass = myClasses.find((k) => k.kodeKelas === selectedFilterClass);

  // Penugasan yang difilter sesuai kelas yang dipilih
  const filteredPenugasan = React.useMemo(() => {
    if (!penugasanList) return [];
    if (selectedFilterClass === 'semua') return penugasanList;
    return penugasanList.filter((p) => p.kodeKelas === selectedFilterClass);
  }, [penugasanList, selectedFilterClass]);

  return (
    <div className="h-full flex flex-col min-h-0 overflow-hidden gap-2.5 animate-in fade-in duration-200">
      {/* Top Bar Ringkas Tab Kelola Kelas */}
      <div className="shrink-0 p-3 sm:px-4 sm:py-2.5 bg-white dark:bg-[#141416] rounded-2xl border border-stone-200/80 dark:border-stone-800 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
        <div>
          <h2 className="text-base sm:text-lg font-bold font-serif-literary text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <GraduationCap size={18} className="text-amber-600 dark:text-amber-400" />
            <span>Kelola Kelas & Penugasan</span>
          </h2>
          <p className="text-[11px] text-stone-500 dark:text-stone-400 hidden sm:block">
            Pilih kelas di section kiri untuk melihat dan mengelola daftar siswa serta penugasan kelas di section kanan.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenJoinClassModal}
            className="editorial-btn bg-stone-100 hover:bg-stone-200 text-stone-800 dark:bg-stone-800 dark:hover:bg-stone-700 dark:text-stone-200 text-xs py-1.5 px-3 flex items-center gap-1.5 cursor-pointer rounded-xl"
            title="Ikuti kelas rekan guru sebagai co-teacher"
          >
            <UserPlus size={13} /> <span className="hidden sm:inline">Gabung Co-Teaching</span>
          </button>
          <button
            onClick={onOpenNewClassModal}
            className="editorial-btn bg-stone-900 hover:bg-stone-800 text-white dark:bg-stone-100 dark:!text-stone-950 dark:hover:bg-stone-200 text-xs py-1.5 px-3 font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs rounded-xl"
            title="Buat ruang kelas menulis baru"
          >
            <Plus size={14} /> <span>Buat Kelas</span>
          </button>
        </div>
      </div>

      {/* Main 2-Section Split View (Kiri: Card Kelas | Kanan: Siswa Roster) */}
      <div className="flex-1 min-h-0 flex flex-col md:flex-row gap-3 overflow-hidden">
        {/* SECTION 1 (KIRI): Card Kelas dengan Scroll Mandiri */}
        <section className="w-full md:w-[320px] lg:w-[360px] shrink-0 h-full flex flex-col min-h-0 bg-white dark:bg-[#141416] rounded-2xl border border-stone-200/80 dark:border-stone-800 shadow-2xs overflow-hidden">
          {/* Header Section Kelas */}
          <div className="shrink-0 p-3 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between gap-2 bg-stone-50/60 dark:bg-stone-900/40">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
              <Users size={13} /> Kelas Saya ({myClasses.length})
            </span>

            <button
              onClick={() => onFilterClassChange('semua')}
              className={`text-[10px] px-2 py-0.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                selectedFilterClass === 'semua'
                  ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 shadow-2xs'
                  : 'bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-300'
              }`}
            >
              Semua ({allUsersList.filter((u) => u.role === 'siswa').length})
            </button>
          </div>

          {/* List Kartu Kelas (Scroll Mandiri Terisolasi) */}
          <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3 custom-scrollbar">
            {myClasses.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-stone-300 dark:border-stone-700 rounded-xl">
                <Users size={32} className="mx-auto text-stone-300 dark:text-stone-600 mb-2" />
                <p className="text-xs font-semibold text-stone-600 dark:text-stone-400 mb-2">
                  Belum ada kelas yang dibuat.
                </p>
                <button
                  onClick={onOpenNewClassModal}
                  className="editorial-btn bg-stone-900 hover:bg-stone-800 text-white dark:bg-stone-100 dark:!text-stone-950 py-1.5 px-3 text-xs font-semibold cursor-pointer shadow-xs rounded-lg"
                >
                  + Buat Kelas Baru
                </button>
              </div>
            ) : (
              myClasses.map((k) => {
                const studentCount = classStudentCounts[k.kodeKelas] || 0;
                const isOwner = k.guruUsername === user.username;
                const isSelected = selectedFilterClass === k.kodeKelas;
                const isFull = Boolean(k.maxPeserta && studentCount >= k.maxPeserta);

                return (
                  <div
                    key={k.id}
                    onClick={() => onFilterClassChange(isSelected ? 'semua' : k.kodeKelas)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col gap-2.5 ${
                      isSelected
                        ? 'border-stone-900 bg-stone-50 dark:bg-stone-900/80 dark:border-stone-100 ring-2 ring-stone-900/20 dark:ring-stone-100/20 shadow-xs'
                        : 'border-stone-200/80 dark:border-stone-800 bg-white dark:bg-[#141416] hover:border-stone-300 dark:hover:border-stone-700 hover:shadow-2xs'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <span className={`text-[9px] font-bold px-2 py-0.2 rounded-full border ${
                        isOwner
                          ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                          : 'bg-purple-50 dark:bg-purple-950/40 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                      }`}>
                        {isOwner ? 'Pembuat' : 'Co-Teacher'}
                      </span>

                      <div className="flex items-center gap-1">
                        {isFull && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">
                            Penuh
                          </span>
                        )}
                        <span className="text-[11px] font-bold px-2 py-0.2 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                          {studentCount}{k.maxPeserta ? `/${k.maxPeserta}` : ''} Siswa
                        </span>
                      </div>
                    </div>

                    <div>
                      <h3 className="font-bold text-sm text-stone-900 dark:text-stone-100 leading-snug">
                        {k.namaKelas}
                      </h3>
                      {!isOwner && (
                        <p className="text-[10px] text-stone-400 dark:text-stone-500">
                          Oleh: {k.namaGuru || k.guruUsername}
                        </p>
                      )}
                    </div>

                    {/* Box Kode Kelas & Salin */}
                    <div className="p-2 bg-stone-100/80 dark:bg-stone-900 rounded-lg border border-stone-200/80 dark:border-stone-800 flex items-center justify-between gap-2">
                      <div>
                        <span className="text-[8px] uppercase font-bold text-stone-400 block">
                          KODE KELAS:
                        </span>
                        <span className="text-xs font-black font-mono tracking-wider text-stone-900 dark:text-stone-100">
                          {k.kodeKelas}
                        </span>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopyCode(k.kodeKelas);
                        }}
                        className="editorial-btn bg-white hover:bg-stone-50 text-stone-700 border border-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 dark:text-stone-300 dark:border-stone-700 text-[10px] py-1 px-2 cursor-pointer flex items-center gap-1 shadow-2xs rounded-md"
                        title="Salin Kode Kelas"
                      >
                        {copiedCode === k.kodeKelas ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
                        <span>{copiedCode === k.kodeKelas ? 'Tersalin' : 'Salin'}</span>
                      </button>
                    </div>

                    {/* Footer Kartu: Kelola & Hapus */}
                    <div className="pt-2 border-t border-stone-100 dark:border-stone-800/80 flex items-center justify-between gap-1.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenEditClassModal(k);
                        }}
                        className="editorial-btn flex-1 bg-stone-100 hover:bg-stone-200 text-stone-700 dark:bg-stone-800 dark:hover:bg-stone-700 dark:text-stone-300 text-[11px] py-1 flex items-center justify-center gap-1 cursor-pointer rounded-lg"
                      >
                        <Edit2 size={11} /> Kelola
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteClass(k);
                        }}
                        className="editorial-btn bg-stone-100 hover:bg-red-50 hover:text-red-600 dark:bg-stone-800 dark:hover:bg-red-950/40 dark:text-stone-400 dark:hover:text-red-400 text-stone-500 text-[11px] py-1 px-2.5 flex items-center justify-center cursor-pointer rounded-lg"
                        title="Hapus Kelas"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* SECTION 2 (KANAN): Roster Siswa & Penugasan Kelas Terpilih */}
        <section className="flex-1 min-w-0 h-full flex flex-col min-h-0 bg-white dark:bg-[#141416] rounded-2xl border border-stone-200/80 dark:border-stone-800 shadow-2xs overflow-hidden">
          {/* Header Section dengan Sub-Tabs (Siswa vs Penugasan) */}
          <div className="shrink-0 p-3 sm:px-4 sm:py-3 border-b border-stone-100 dark:border-stone-800 bg-stone-50/60 dark:bg-stone-900/40 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 p-1 bg-stone-200/70 dark:bg-stone-800/80 rounded-xl">
                <button
                  type="button"
                  onClick={() => setActiveSubTab('siswa')}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeSubTab === 'siswa'
                      ? 'bg-white dark:bg-[#141416] text-stone-900 dark:text-stone-100 shadow-2xs'
                      : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
                  }`}
                >
                  <Users size={13} />
                  <span>Siswa ({filteredStudents.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSubTab('tugas')}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeSubTab === 'tugas'
                      ? 'bg-white dark:bg-[#141416] text-stone-900 dark:text-stone-100 shadow-2xs'
                      : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
                  }`}
                >
                  <BookOpen size={13} />
                  <span>Penugasan ({filteredPenugasan.length})</span>
                </button>
              </div>

              <span className="text-[11px] text-stone-400 dark:text-stone-500 hidden lg:inline">
                {currentSelectedClass ? `Kelas: ${currentSelectedClass.namaKelas}` : 'Semua Kelas'}
              </span>
            </div>

            {/* Aksi Kanan Sesuai Sub-Tab */}
            {activeSubTab === 'siswa' ? (
              <div className="flex items-center gap-2">
                <div className="relative min-w-[160px] sm:min-w-[200px]">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
                  <input
                    type="text"
                    value={searchRoster}
                    onChange={(e) => setSearchRoster(e.target.value)}
                    placeholder="Cari siswa..."
                    className="editorial-input w-full pl-7 pr-2.5 py-1 text-xs bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-750 dark:text-stone-100 rounded-xl"
                  />
                </div>

                <button
                  onClick={handleExportCSV}
                  disabled={filteredStudents.length === 0}
                  className="editorial-btn bg-stone-900 hover:bg-stone-800 text-white dark:bg-stone-100 dark:!text-stone-950 dark:hover:bg-stone-200 text-xs py-1.5 px-3 flex items-center gap-1.5 cursor-pointer rounded-xl disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs font-semibold"
                  title="Unduh data siswa kelas ini ke format CSV (Excel)"
                >
                  <Download size={13} /> <span className="hidden sm:inline">Ekspor CSV</span>
                </button>
              </div>
            ) : (
              onOpenNewPenugasanModal && (
                <button
                  onClick={onOpenNewPenugasanModal}
                  className="editorial-btn bg-blue-600 hover:bg-blue-700 text-white text-xs py-1.5 px-3 rounded-xl flex items-center gap-1.5 cursor-pointer font-bold shadow-2xs"
                >
                  <Plus size={13} /> Buat Penugasan Baru
                </button>
              )
            )}
          </div>

          {/* Konten Sub-Tab */}
          {activeSubTab === 'siswa' ? (
            /* Kontainer Tabel Roster Siswa (Scroll Mandiri Terisolasi) */
            <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 custom-scrollbar">
              {filteredStudents.length === 0 ? (
                <div className="p-12 text-center text-stone-400">
                  <Users size={36} className="mx-auto text-stone-300 dark:text-stone-700 mb-2" />
                  <p className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                    Belum ada siswa di kelas ini.
                  </p>
                  <p className="text-[11px] text-stone-400 mt-0.5">
                    Bagikan kode kelas di section kiri kepada siswa agar mereka dapat bergabung.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-stone-200/80 dark:border-stone-800 text-[10px] uppercase font-bold tracking-wider text-stone-400 dark:text-stone-500">
                        <th className="pb-2.5 pl-2">Siswa</th>
                        <th className="pb-2.5 px-3">Username</th>
                        <th className="pb-2.5 px-3">Kelas</th>
                        <th className="pb-2.5 px-3 hidden sm:table-cell">Waktu Daftar</th>
                        <th className="pb-2.5 pr-2 text-right">Tindakan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100 dark:divide-stone-800/60">
                      {filteredStudents.map((s) => (
                        <tr key={s.username} className="hover:bg-stone-50/70 dark:hover:bg-stone-900/40 transition-colors">
                          <td className="py-2.5 pl-2">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 font-bold text-xs flex items-center justify-center font-serif-literary shrink-0">
                                {(s.nama || s.username)[0].toUpperCase()}
                              </div>
                              <span className="font-bold text-stone-900 dark:text-stone-100">
                                {s.nama}
                              </span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-stone-500 dark:text-stone-400">
                            @{s.username}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded-md bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 font-semibold text-[10px]">
                              {s.namaKelas || s.kodeKelas || '-'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-[11px] text-stone-400 font-mono hidden sm:table-cell">
                            {s.waktuDaftar || '-'}
                          </td>
                          <td className="py-2.5 pr-2 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => onResetPassword(s.username, s.nama)}
                                className="editorial-btn bg-stone-100 hover:bg-stone-200 text-stone-700 dark:bg-stone-800 dark:hover:bg-stone-700 dark:text-stone-300 text-[10px] py-1 px-2.5 rounded-lg flex items-center gap-1 cursor-pointer"
                                title="Reset kata sandi siswa"
                              >
                                <KeyRound size={11} /> <span>Reset Sandi</span>
                              </button>
                              <button
                                onClick={() => onDeleteStudent(s.username, s.nama, s.kodeKelas)}
                                className="editorial-btn bg-stone-100 hover:bg-red-50 hover:text-red-600 dark:bg-stone-800 dark:hover:bg-red-950/40 dark:text-stone-400 dark:hover:text-red-400 text-stone-500 text-[10px] p-1.5 rounded-lg flex items-center justify-center cursor-pointer"
                                title="Hapus akun siswa dari kelas"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            /* Kontainer Daftar Penugasan Kelas */
            <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 custom-scrollbar">
              {filteredPenugasan.length === 0 ? (
                <div className="p-12 text-center text-stone-400 border border-dashed border-stone-200 dark:border-stone-800 rounded-2xl">
                  <BookOpen size={36} className="mx-auto text-stone-300 dark:text-stone-700 mb-2" />
                  <p className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                    Belum ada penugasan di kelas ini.
                  </p>
                  <p className="text-[11px] text-stone-400 mt-0.5 mb-4">
                    Buat tugas menulis baru untuk memandu siswa dengan instruksi terarah.
                  </p>
                  {onOpenNewPenugasanModal && (
                    <button
                      onClick={onOpenNewPenugasanModal}
                      className="editorial-btn bg-blue-600 hover:bg-blue-700 text-white text-xs py-2 px-4 rounded-xl font-bold shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <Plus size={14} /> Buat Penugasan Pertama
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {filteredPenugasan.map((t) => (
                    <div
                      key={t.id}
                      className="p-4 rounded-2xl bg-white dark:bg-[#141416] border border-stone-200/80 dark:border-stone-800 shadow-2xs flex flex-col gap-2.5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-1.5 mb-1">
                            {t.topik && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-900/40">
                                {t.topik}
                              </span>
                            )}
                            {t.targetKataMin && (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 flex items-center gap-1">
                                <Target size={10} /> Min. {t.targetKataMin} kata
                              </span>
                            )}
                            {t.tenggatWaktu && (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200/60 flex items-center gap-1">
                                <Calendar size={10} /> Deadline: {t.tenggatWaktu}
                              </span>
                            )}
                          </div>

                          <h4 className="font-bold text-sm text-stone-900 dark:text-stone-100 font-serif-literary">
                            {t.judul}
                          </h4>
                          <p className="text-[11px] text-stone-400 dark:text-stone-500">
                            Kelas: <strong>{t.namaKelas || t.kodeKelas}</strong> • Dibuat: {t.waktuDibuat}
                          </p>
                        </div>

                        <div className="flex items-center gap-1">
                          {onEditPenugasan && (
                            <button
                              onClick={() => onEditPenugasan(t)}
                              className="p-1.5 rounded-lg text-stone-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 dark:hover:text-blue-400 transition-colors cursor-pointer"
                              title="Edit Penugasan"
                            >
                              <Edit2 size={14} />
                            </button>
                          )}
                          {onDeletePenugasan && (
                            <button
                              onClick={() => onDeletePenugasan(t.id, t.judul)}
                              className="p-1.5 rounded-lg text-stone-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 dark:hover:text-red-400 transition-colors cursor-pointer"
                              title="Hapus Penugasan"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </div>

                      {t.deskripsi && (
                        <p className="text-xs text-stone-600 dark:text-stone-300 bg-stone-50 dark:bg-stone-900/60 p-2.5 rounded-xl border border-stone-100 dark:border-stone-800/80 whitespace-pre-wrap leading-relaxed">
                          {t.deskripsi}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
