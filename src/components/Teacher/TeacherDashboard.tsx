import React, { useState, useEffect, useRef, useMemo } from 'react';
import { DataService } from '../../services/dataService';
import type { 
  Dokumen, 
  LiveStatus, 
  Pengumuman, 
  KelasRoom, 
  UserAccount, 
  MigrasiRedeemItem,
  Penugasan
} from '../../types';
import { NeoModal } from '../Common/NeoModal';
import { TeacherSidebar, type TeacherTab } from './TeacherSidebar';
import { TeacherHeader } from './TeacherHeader';
import { TabPantauan } from './tabs/TabPantauan';
import { TabKoreksiTugas } from './tabs/TabKoreksiTugas';
import { TabKelolaKelas } from './tabs/TabKelolaKelas';
import { TabRuangPublik } from './tabs/TabRuangPublik';
import { TabTulisanGuru } from './tabs/TabTulisanGuru';
import { TabMigrasiRedeem } from './tabs/TabMigrasiRedeem';
import { ModalWoroWoro } from './modals/ModalWoroWoro';
import { ModalQuotes } from './modals/ModalQuotes';
import { ModalResetPassword } from './modals/ModalResetPassword';
import { ModalNewClass, ModalJoinClass, ModalEditClass } from './modals/ModalKelas';
import { ModalPenugasan } from './modals/ModalPenugasan';
import { LogoutConfirmationModal } from '../Common/LogoutConfirmationModal';
import { LinimasaCuitan } from '../Cuitan/LinimasaCuitan';
import { TeacherEditorView } from './TeacherEditorView';

interface TeacherDashboardProps {
  user: UserAccount;
  onLogout: () => void;
}

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState<TeacherTab>('pantauan');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState<boolean>(false);
  const [activeEditorDocId, setActiveEditorDocId] = useState<string | null>(null);

  // Real-time State
  const [liveMap, setLiveMap] = useState<Record<string, LiveStatus>>({});
  const [dokumenMap, setDokumenMap] = useState<Record<string, Dokumen>>({});
  const [pengumumanList, setPengumumanList] = useState<Pengumuman[]>([]);
  const [kelasList, setKelasList] = useState<KelasRoom[]>([]);
  const [allUsersList, setAllUsersList] = useState<UserAccount[]>([]);
  const [masterTracking, setMasterTracking] = useState<boolean>(true);

  // Filter Multi-Kelas & Siswa
  const [joinedClassCodes, setJoinedClassCodes] = useState<string[]>([]);
  const [selectedFilterClass, setSelectedFilterClass] = useState<string>('semua');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Sidebar Desktop Collapsed State (Hanya Ikon)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('teacher_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const handleToggleSidebarCollapse = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('teacher_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  // Penilaian & Koreksi State
  const [selectedStudentUsername, setSelectedStudentUsername] = useState<string>('');
  const [selectedDocId, setSelectedDocId] = useState<string>('');

  // Migrasi Firebase State
  const [redeemList, setRedeemList] = useState<MigrasiRedeemItem[]>([]);
  const [redeemNotice, setRedeemNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Penugasan State
  const [penugasanList, setPenugasanList] = useState<Penugasan[]>([]);
  const [isPenugasanModalOpen, setIsPenugasanModalOpen] = useState<boolean>(false);
  const [penugasanToEdit, setPenugasanToEdit] = useState<Penugasan | null>(null);

  // Modals State
  const [isWoroModalOpen, setIsWoroModalOpen] = useState<boolean>(false);
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState<boolean>(false);
  const [isNewClassModalOpen, setIsNewClassModalOpen] = useState<boolean>(false);
  const [isJoinClassModalOpen, setIsJoinClassModalOpen] = useState<boolean>(false);
  const [isEditClassModalOpen, setIsEditClassModalOpen] = useState<boolean>(false);
  const [editingClass, setEditingClass] = useState<KelasRoom | null>(null);

  // Modal Reset Password Siswa
  const [resetPassModal, setResetPassModal] = useState<{
    isOpen: boolean;
    username: string;
    nama: string;
  }>({
    isOpen: false,
    username: '',
    nama: '',
  });

  // Generic Confirmation Modal
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    confirmColor?: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    description: '',
    onConfirm: () => {},
  });

  // Notifikasi Pelanggaran (Audio Chime & Toast)
  const [notifPelanggaran, setNotifPelanggaran] = useState<boolean>(true);
  const [violationToast, setViolationToast] = useState<{ id: string; message: string } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const playAlarmSound = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1); // A5

      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch (e) {
      console.warn('Audio chime error:', e);
    }
  };

  const showViolationToast = (nama: string, username: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setViolationToast({
      id: Date.now().toString(),
      message: `${nama} (@${username}) terdeteksi keluar tab!`,
    });
    playAlarmSound();
    toastTimerRef.current = setTimeout(() => {
      setViolationToast(null);
    }, 3500);
  };

  // Refs untuk tracking status tanpa re-subscribe overhead
  const masterTrackingRef = useRef(masterTracking);
  masterTrackingRef.current = masterTracking;
  const notifPelanggaranRef = useRef(notifPelanggaran);
  notifPelanggaranRef.current = notifPelanggaran;

  // 1. Listen Live Siswa
  useEffect(() => {
    const unsub = DataService.listenLive(
      (live) => setLiveMap(live),
      (payload) => {
        if (masterTrackingRef.current && notifPelanggaranRef.current) {
          showViolationToast(payload.nama || payload.username, payload.username);
        }
      }
    );
    return () => unsub();
  }, []);

  // 2. Listen Dokumen
  useEffect(() => {
    const unsub = DataService.listenDokumen((docs) => setDokumenMap(docs));
    return () => unsub();
  }, []);

  // 3. Listen Kelas
  useEffect(() => {
    const unsub = DataService.listenKelas((rooms) => setKelasList(rooms));
    return () => unsub();
  }, []);

  // 4. Listen Seluruh Akun Siswa
  useEffect(() => {
    const unsub = DataService.listenUsers((users) => setAllUsersList(users));
    return () => unsub();
  }, []);

  // 5. Listen Master Tracking Setting
  useEffect(() => {
    const unsub = DataService.listenTrackingAktif((aktif) => {
      setMasterTracking(aktif);
    });
    return () => unsub();
  }, []);

  // 6. Listen Pengumuman / Woro-woro
  useEffect(() => {
    const unsub = DataService.listenPengumuman((list) => setPengumumanList(list));
    return () => unsub();
  }, []);

  // 6b. Listen Penugasan Kelas
  useEffect(() => {
    const unsub = DataService.listenPenugasan((list) => {
      setPenugasanList(list);
    });
    return () => unsub();
  }, []);

  const handleDeletePenugasan = async (id: string, judul: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Hapus Penugasan?',
      description: `Apakah Anda yakin ingin menghapus penugasan "${judul}"? Naskah siswa yang sudah dibuat tetap tersimpan sebagai tulisan mandiri.`,
      confirmColor: '#DC2626',
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        try {
          await DataService.hapusPenugasan(id);
        } catch (err) {
          console.error('Gagal menghapus penugasan:', err);
        }
      },
    });
  };

  // 7. Muat Akses Co-Teaching Kelas Guru
  useEffect(() => {
    DataService.getAksesKelasGuru(user.username).then((codes) => {
      setJoinedClassCodes(codes || []);
    });
  }, [user?.username]);

  // Fetch Data Redeem Migrasi
  const fetchRedeemList = async () => {
    try {
      const list = await DataService.getDaftarKodeRedeem();
      setRedeemList(list);
    } catch (err) {
      console.error('Gagal mengambil daftar redeem:', err);
    }
  };

  useEffect(() => {
    if (activeTab === 'migrasi') {
      fetchRedeemList();
    }
  }, [activeTab]);

  // Daftar Kelas Guru ini (Dibuat Sendiri + Co-Teaching)
  const myClasses = useMemo(() => {
    return kelasList.filter(
      (k) => k.guruUsername === user.username || joinedClassCodes.includes(k.kodeKelas)
    );
  }, [kelasList, user.username, joinedClassCodes]);

  // Daftar Siswa Terkait Kelas Guru ini
  const myStudents = useMemo(() => {
    const myClassCodes = new Set(myClasses.map((k) => k.kodeKelas));
    return allUsersList.filter(
      (u) => u.role === 'siswa' && u.kodeKelas && myClassCodes.has(u.kodeKelas)
    );
  }, [allUsersList, myClasses]);

  // Filter Siswa Berdasarkan Kelas Terpilih
  const filteredStudents = useMemo(() => {
    if (selectedFilterClass === 'semua') {
      return myStudents;
    }
    return myStudents.filter((s) => s.kodeKelas === selectedFilterClass);
  }, [myStudents, selectedFilterClass]);

  // Metrik Statistik Terpadu
  const onlineCount = useMemo(() => {
    return filteredStudents.filter((s) => {
      const live = liveMap[s.username];
      return Boolean(live?.isOnline);
    }).length;
  }, [filteredStudents, liveMap]);

  const taskQueueCount = useMemo(() => {
    return filteredStudents.filter((s) => {
      return Object.values(dokumenMap).some(
        (d) => (d.username === s.username || d.nama === s.nama) && d.status === 'Terkumpul'
      );
    }).length;
  }, [filteredStudents, dokumenMap]);

  const totalViolations = useMemo(() => {
    return filteredStudents.reduce((acc, s) => {
      const live = liveMap[s.username];
      return acc + (live?.pelanggaranCount || 0);
    }, 0);
  }, [filteredStudents, liveMap]);

  // Handler Toggle Tracking Anti-Curang
  const handleToggleTracking = async () => {
    const newStatus = !masterTracking;
    setMasterTracking(newStatus);
    await DataService.setMasterTracking(newStatus);
  };

  // Handler Reset Pelanggaran Seluruh Siswa
  const handleResetPelanggaran = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Reset Pelanggaran Tab Seluruh Siswa?',
      description: 'Seluruh angka sanksi pelanggaran keluar tab akan diatur ulang ke 0. Lanjutkan?',
      confirmColor: '#DC2626',
      onConfirm: async () => {
        setLiveMap((prev) => {
          const updated: Record<string, LiveStatus> = {};
          Object.entries(prev).forEach(([key, val]) => {
            updated[key] = { ...val, pelanggaranCount: 0, sedangKeluarTab: false };
          });
          return updated;
        });
        setDokumenMap((prev) => {
          const updated: Record<string, Dokumen> = {};
          Object.entries(prev).forEach(([key, val]) => {
            updated[key] = { ...val, pelanggaran: 0 };
          });
          return updated;
        });
        await DataService.resetSemuaPelanggaran();
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  // Handler Buat Kelas Baru
  const handleCreateNewClass = async (namaKelas: string, maxPeserta?: number) => {
    const room = await DataService.buatKelasBaru(namaKelas, user.username, user.nama || user.username, maxPeserta);
    setSelectedFilterClass(room.kodeKelas);
  };

  // Handler Gabung Kelas Rekan
  const handleJoinClass = async (kodeKelas: string) => {
    const res = await DataService.gabungKelasRekan(kodeKelas, user.username);
    if (!res.success) {
      alert(res.message || `Kode kelas "${kodeKelas}" tidak ditemukan.`);
      return;
    }
    setJoinedClassCodes((prev) => [...prev, kodeKelas]);
    setSelectedFilterClass(kodeKelas);
  };

  // Handler Edit Nama & Kapasitas Kelas
  const handleEditClassName = async (_kelasId: string, namaBaru: string, maxPeserta?: number) => {
    if (editingClass) {
      await DataService.editKelas(editingClass.kodeKelas, namaBaru, maxPeserta);
    }
    setEditingClass(null);
  };

  // Handler Hapus Kelas
  const handleDeleteClass = (k: KelasRoom) => {
    setConfirmModal({
      isOpen: true,
      title: `Hapus Kelas ${k.namaKelas}?`,
      description: `Seluruh ruang kelas "${k.namaKelas}" (${k.kodeKelas}) akan dihapus. Dokumen siswa tetap tersimpan. Lanjutkan?`,
      confirmColor: '#DC2626',
      onConfirm: async () => {
        await DataService.hapusKelas(k.kodeKelas, user.username);
        if (selectedFilterClass === k.kodeKelas) {
          setSelectedFilterClass('semua');
        }
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  // Handler Hapus Siswa
  const handleDeleteStudent = (username: string, nama: string, kodeKelas?: string) => {
    setConfirmModal({
      isOpen: true,
      title: `Hapus Akun Siswa ${nama}?`,
      description: `Akun "${username}" akan dihapus permanen dari kelas dan database. Lanjutkan?`,
      confirmColor: '#DC2626',
      onConfirm: async () => {
        await DataService.hapusSiswa(username, kodeKelas);
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  // Handler Tandai Selesai / Beri Izin Publikasi
  const handleTandaiSelesai = async (izinPublikasi: boolean) => {
    if (!selectedDocId) return;
    const doc = dokumenMap[selectedDocId];
    if (!doc) return;

    if (izinPublikasi) {
      await DataService.updateStatusDokumen(selectedDocId, 'Selesai', false);
      await DataService.publikasiKeMading(selectedDocId, doc.topik || 'Lainnya', doc.nama);
    } else {
      await DataService.updateStatusDokumen(selectedDocId, 'Selesai', false);
    }
  };

  // Handler Reset Semua Klaim Testing Migrasi
  const handleResetAllTesting = async () => {
    try {
      const res = await DataService.resetSemuaKlaimTesting();
      if (res.success) {
        setRedeemNotice({
          type: 'success',
          text: res.message || `Berhasil mereset ${res.count} kode redeem!`,
        });
        await fetchRedeemList();
      }
    } catch (e: any) {
      setRedeemNotice({ type: 'error', text: e?.message || 'Gagal mereset kode testing.' });
    }
  };

  // Handler Reset Item Tunggal Migrasi
  const handleResetItem = async (kode: string) => {
    try {
      const res = await DataService.resetKlaimKodeRedeem(kode);
      if (res.success) {
        setRedeemNotice({
          type: 'success',
          text: res.message || `Kode "${kode}" berhasil direset menjadi belum diklaim.`,
        });
        await fetchRedeemList();
      }
    } catch (e: any) {
      setRedeemNotice({ type: 'error', text: e?.message || 'Gagal mereset kode.' });
    }
  };

  // Salin Format WhatsApp Migrasi
  const handleCopyWhatsApp = () => {
    if (redeemList.length === 0) return;
    let text = `*DAFTAR KODE KLAIM KARYA LAMA - NULISLUR*\n\n`;
    text += `Halo anak-anak, bagi yang sudah punya karya di aplikasi lama, silakan daftar akun baru di NulisLur, lalu masukkan kode unik di bawah ini pada menu *Klaim Karya Lama*:\n\n`;

    redeemList
      .filter((r) => !r.isRedeemed)
      .forEach((r, idx) => {
        text += `${idx + 1}. *${r.originalNama}*\n`;
        text += `   👉 Kode: \`${r.kodeRedeem}\` (${r.naskahList?.length || 0} karya)\n\n`;
      });

    text += `Pastikan kode disimpan dengan baik ya! Selamat menulis kembali. ✨`;

    navigator.clipboard.writeText(text);
    setRedeemNotice({
      type: 'success',
      text: 'Format WhatsApp berhasil disalin ke clipboard! Silakan paste langsung ke grup WhatsApp kelas.',
    });
  };

  // Jika sedang membuka Editor Guru (Layar penuh murni tanpa sidebar & tanpa tab, identik seperti siswa)
  if (activeEditorDocId) {
    return (
      <TeacherEditorView
        docId={activeEditorDocId}
        user={user}
        onBack={() => setActiveEditorDocId(null)}
      />
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#FAF9F6] dark:bg-[#0c0a09] text-stone-900 dark:text-stone-100 transition-colors duration-200">
      {/* Sidebar Navigasi Modern (Stuck sepanjang layar) */}
      <TeacherSidebar
        user={user}
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          setIsMobileMenuOpen(false);
        }}
        pendingReviewCount={taskQueueCount}
        onlineCount={onlineCount}
        totalViolations={totalViolations}
        masterTracking={masterTracking}
        onToggleTracking={handleToggleTracking}
        notifPelanggaran={notifPelanggaran}
        onToggleNotifPelanggaran={() => setNotifPelanggaran((p) => !p)}
        onOpenWoroModal={() => setIsWoroModalOpen(true)}
        onOpenQuoteModal={() => setIsQuoteModalOpen(true)}
        onLogout={() => setIsLogoutModalOpen(true)}
        isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={handleToggleSidebarCollapse}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen min-w-0 overflow-hidden">
        {/* Header Bar Atas (Stuck di atas) */}
        <TeacherHeader
          myClasses={myClasses}
          selectedFilterClass={selectedFilterClass}
          onFilterClassChange={setSelectedFilterClass}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
          onlineCount={onlineCount}
          taskQueueCount={taskQueueCount}
          violationCount={totalViolations}
          violationToast={violationToast}
          onDismissViolationToast={() => setViolationToast(null)}
          onOpenWoroModal={() => setIsWoroModalOpen(true)}
          onOpenQuoteModal={() => setIsQuoteModalOpen(true)}
        />

        {/* Tab View Container (Terisi 100% tanpa scrollbar ganda di level window) */}
        <main className="flex-1 min-h-0 overflow-hidden flex flex-col p-2.5 sm:p-4">
          {/* TAB 1: PANTAUAN SISWA */}
          {activeTab === 'pantauan' && (
            <TabPantauan
              students={filteredStudents}
              liveMap={liveMap}
              dokumenMap={dokumenMap}
              kelasList={kelasList}
              selectedFilterClass={selectedFilterClass}
              searchQuery={searchQuery}
              masterTracking={masterTracking}
              onResetPelanggaran={handleResetPelanggaran}
              onInspectStudent={(uname) => {
                setSelectedStudentUsername(uname);
                const docs = Object.values(dokumenMap).filter(
                  (d) => (d.username === uname || d.nama === uname) && d.penulisKategori !== 'Guru'
                );
                docs.sort((a, b) => {
                  const timeA = new Date(a.waktuEdit || a.waktuKumpul || 0).getTime();
                  const timeB = new Date(b.waktuEdit || b.waktuKumpul || 0).getTime();
                  return timeB - timeA;
                });
                setSelectedDocId(docs[0] ? docs[0].id : '');
                setActiveTab('penilaian');
              }}
            />
          )}

          {/* TAB 2: KOREKSI TUGAS */}
          {activeTab === 'penilaian' && (
            <TabKoreksiTugas
              students={filteredStudents}
              dokumenMap={dokumenMap}
              selectedFilterClass={selectedFilterClass}
              selectedStudentUsername={selectedStudentUsername}
              onSelectStudentUsername={setSelectedStudentUsername}
              selectedDocId={selectedDocId}
              onSelectDocId={setSelectedDocId}
              onTandaiSelesai={handleTandaiSelesai}
              penugasanList={penugasanList}
              onOpenNewPenugasanModal={() => setIsPenugasanModalOpen(true)}
            />
          )}

          {/* TAB 3: KELOLA KELAS & SISWA */}
          {activeTab === 'kelas' && (
            <TabKelolaKelas
              myClasses={myClasses}
              user={user}
              allUsersList={allUsersList}
              selectedFilterClass={selectedFilterClass}
              onFilterClassChange={setSelectedFilterClass}
              onOpenNewClassModal={() => setIsNewClassModalOpen(true)}
              onOpenJoinClassModal={() => setIsJoinClassModalOpen(true)}
              onOpenEditClassModal={(k) => {
                setEditingClass(k);
                setIsEditClassModalOpen(true);
              }}
              onDeleteClass={handleDeleteClass}
              onResetPassword={(username, nama) => {
                setResetPassModal({ isOpen: true, username, nama });
              }}
              onDeleteStudent={handleDeleteStudent}
              penugasanList={penugasanList}
              onOpenNewPenugasanModal={() => {
                setPenugasanToEdit(null);
                setIsPenugasanModalOpen(true);
              }}
              onEditPenugasan={(p) => {
                setPenugasanToEdit(p);
                setIsPenugasanModalOpen(true);
              }}
              onDeletePenugasan={handleDeletePenugasan}
            />
          )}

          {/* TAB CUITAN SISWA */}
          {activeTab === 'cuitan' && (
            <div className="h-full min-h-0 overflow-y-auto custom-scrollbar w-full py-2 pr-1">
              <div className="max-w-3xl mx-auto">
                <LinimasaCuitan
                  currentUser={{
                    username: user.username,
                    nama: user.nama,
                    role: 'guru',
                    kodeKelas: selectedFilterClass === 'semua' ? undefined : selectedFilterClass,
                  }}
                />
              </div>
            </div>
          )}

          {/* TAB 4: RUANG PUBLIK (POJOK BACA) */}
          {activeTab === 'mading' && (
            <TabRuangPublik
              dokumenMap={dokumenMap}
              onInspectDoc={(d) => {
                setSelectedStudentUsername(d.username || d.nama);
                setSelectedDocId(d.id);
                setActiveTab('penilaian');
              }}
              onTakedownDoc={async (docId) => {
                await DataService.takeDownMading(docId);
              }}
            />
          )}

          {/* TAB 5: TULISAN GURU */}
          {activeTab === 'redaksi' && (
            <TabTulisanGuru
              user={user}
              dokumenMap={dokumenMap}
              onOpenEditor={(id) => setActiveEditorDocId(id)}
            />
          )}

          {/* TAB 6: KODE REDEEM & MIGRASI */}
          {activeTab === 'migrasi' && (
            <TabMigrasiRedeem
              redeemList={redeemList}
              onRefresh={fetchRedeemList}
              onResetAllTesting={handleResetAllTesting}
              onResetItem={handleResetItem}
              onCopyWhatsApp={handleCopyWhatsApp}
              notice={redeemNotice}
              onDismissNotice={() => setRedeemNotice(null)}
            />
          )}
        </main>
      </div>

      {/* Global Modals */}
      <ModalWoroWoro
        isOpen={isWoroModalOpen}
        onClose={() => setIsWoroModalOpen(false)}
        pengumumanList={pengumumanList}
      />

      <ModalQuotes
        isOpen={isQuoteModalOpen}
        onClose={() => setIsQuoteModalOpen(false)}
      />

      <ModalResetPassword
        isOpen={resetPassModal.isOpen}
        onClose={() => setResetPassModal({ isOpen: false, username: '', nama: '' })}
        username={resetPassModal.username}
        nama={resetPassModal.nama}
      />

      <ModalNewClass
        isOpen={isNewClassModalOpen}
        onClose={() => setIsNewClassModalOpen(false)}
        onSubmit={handleCreateNewClass}
      />

      <ModalJoinClass
        isOpen={isJoinClassModalOpen}
        onClose={() => setIsJoinClassModalOpen(false)}
        onSubmit={handleJoinClass}
      />

      <ModalEditClass
        isOpen={isEditClassModalOpen}
        onClose={() => {
          setIsEditClassModalOpen(false);
          setEditingClass(null);
        }}
        kelas={editingClass}
        onSubmit={handleEditClassName}
      />

      {/* Modal Buat / Edit Penugasan */}
      <ModalPenugasan
        isOpen={isPenugasanModalOpen}
        onClose={() => {
          setIsPenugasanModalOpen(false);
          setPenugasanToEdit(null);
        }}
        myClasses={myClasses}
        defaultClassCode={selectedFilterClass}
        user={user}
        penugasanToEdit={penugasanToEdit}
        onSuccess={() => {
          setPenugasanToEdit(null);
        }}
      />

      {/* Generic Confirmation Modal */}
      <NeoModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        description={confirmModal.description}
        confirmColor={confirmModal.confirmColor}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
      />

      {/* Modal Konfirmasi Logout Guru */}
      <LogoutConfirmationModal
        isOpen={isLogoutModalOpen}
        onCancel={() => setIsLogoutModalOpen(false)}
        onConfirm={onLogout}
        role="guru"
      />
    </div>
  );
};
