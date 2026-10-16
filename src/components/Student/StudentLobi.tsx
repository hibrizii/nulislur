import React, { useState, useEffect, useCallback } from 'react';
import { DataService, getWarnaTopik, stringToColor, getWaktuSekarang } from '../../services/dataService';
import type { Dokumen, Pengumuman, UserAccount, Penugasan, MigrasiRedeemItem, KolaboratorAnggota, KelasRoom } from '../../types';
import { 
  Plus, 
  LogOut, 
  Trash2, 
  Share2, 
  Eye, 
  Heart, 
  MessageSquare,
  BookOpen,
  Feather,
  Globe,
  Clock,
  AlertCircle,
  FileText,
  CheckCircle,
  Megaphone,
  TrendingUp,
  KeyRound,
  CheckCircle2,
  Sparkles,
  RefreshCw,
  X,
  User,
  Lock,
  Search,
  Users,
} from 'lucide-react';
import { NeoModal } from '../Common/NeoModal';
import { ThemeToggle } from '../Common/ThemeToggle';
import { cleanSnippet, cleanTitle } from '../../utils/exportDocument';
import { StudentGrowthReport } from './StudentGrowthReport';
import { LinimasaCuitan } from '../Cuitan/LinimasaCuitan';
import { KelolaKolaboratorModal } from './KelolaKolaboratorModal';
import { FormattedWoroText } from '../Common/FormattedWoroText';

interface StudentLobiProps {
  nama: string;
  username: string;
  kodeKelas?: string;
  namaKelas?: string;
  sekolahId?: string;
  namaSekolah?: string;
  initialTab?: 'karya' | 'perkembangan' | 'mading' | 'cuitan';
  onTabChange?: (tab: 'karya' | 'perkembangan' | 'mading' | 'cuitan') => void;
  highlightDocId?: string | null;
  onOpenEditor: (docId: string) => void;
  onOpenMadingReader: (docId: string) => void;
  onLogout: () => void;
  onUserUpdate?: (updatedUser: UserAccount) => void;
}

export const StudentLobi: React.FC<StudentLobiProps> = ({
  nama,
  username,
  kodeKelas,
  namaKelas,
  sekolahId,
  namaSekolah,
  initialTab = 'karya',
  onTabChange,
  highlightDocId,
  onOpenEditor,
  onOpenMadingReader,
  onLogout,
  onUserUpdate,
}) => {
  const [activeTab, setActiveTabState] = useState<'karya' | 'perkembangan' | 'mading' | 'cuitan'>(initialTab);

  const setActiveTab = (tab: 'karya' | 'perkembangan' | 'mading' | 'cuitan') => {
    setActiveTabState(tab);
    onTabChange?.(tab);
  };

  useEffect(() => {
    if (initialTab && initialTab !== activeTab) {
      setActiveTabState(initialTab);
    }
  }, [initialTab]);

  useEffect(() => {
    if (activeTab === 'mading' && highlightDocId) {
      const timer = setTimeout(() => {
        const el = document.getElementById(`mading-card-${highlightDocId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [activeTab, highlightDocId]);
  const [dokumenList, setDokumenList] = useState<Dokumen[]>([]);
  const [madingList, setMadingList] = useState<Dokumen[]>([]);
  const [pengumumanList, setPengumumanList] = useState<Pengumuman[]>([]);

  // Filter & Search untuk Daftar Tugas Siswa
  const [taskFilterStatus, setTaskFilterStatus] = useState<'semua' | 'kolaborasi' | 'revisi' | 'draf' | 'terkumpul' | 'selesai'>('semua');
  const [taskSearchQuery, setTaskSearchQuery] = useState<string>('');

  // Versi reaktif checklist revisi siswa
  const [checklistVersion, setChecklistVersion] = useState(0);

  useEffect(() => {
    const handleChecklistChange = () => {
      setChecklistVersion((v) => v + 1);
    };
    window.addEventListener('nulislur_checklist_change', handleChecklistChange);
    window.addEventListener('storage', handleChecklistChange);
    return () => {
      window.removeEventListener('nulislur_checklist_change', handleChecklistChange);
      window.removeEventListener('storage', handleChecklistChange);
    };
  }, []);

  // Helper Klasifikasi Status Naskah Siswa
  const getDocStatusInfo = (doc: Dokumen) => {
    const hasFeedback = Boolean(doc.feedbackUmum && doc.feedbackUmum.trim().length > 0);
    let markCount = 0;
    if (doc.teks) {
      const matches = doc.teks.match(/<mark/g);
      markCount = matches ? matches.length : 0;
    }
    const totalNotes = markCount + (hasFeedback ? 1 : 0);

    let isAllChecked = false;
    let uncheckedCount = totalNotes;

    if (totalNotes > 0) {
      try {
        const raw = localStorage.getItem(`checklist_${doc.id}`);
        const checkedMap: Record<string, boolean> = raw ? JSON.parse(raw) : {};
        let checkedCount = 0;
        if (hasFeedback && checkedMap['umum']) checkedCount++;
        for (let i = 0; i < markCount; i++) {
          if (checkedMap[`item_${i}`]) checkedCount++;
        }
        if (checkedCount >= totalNotes) {
          isAllChecked = true;
          uncheckedCount = 0;
        } else {
          uncheckedCount = totalNotes - checkedCount;
        }
      } catch {
        // default unchecked
      }
    }

    if (doc.isPublic) {
      return {
        type: 'publish' as const,
        label: 'Terpublikasi',
        badgeClass: 'bg-[#EEF3F8] dark:bg-[#1A2530] text-[#365778] dark:text-[#A4C2E0] shadow-2xs',
        icon: Globe,
        needsRevision: false,
        totalNotes: 0,
      };
    }
    if (doc.status === 'Selesai') {
      return {
        type: 'selesai' as const,
        label: 'Selesai',
        badgeClass: 'bg-[#EAF3EC] dark:bg-[#1E2B22] text-[#2D5A37] dark:text-[#A7D1AF] shadow-2xs',
        icon: CheckCircle,
        needsRevision: false,
        totalNotes: 0,
      };
    }

    // Jika guru sudah memberi feedback/mark dan siswa BELUM mencentang semuanya -> Tampilkan Perlu Revisi!
    if (totalNotes > 0 && !isAllChecked) {
      return {
        type: 'revisi' as const,
        label: uncheckedCount > 0 ? `Perlu Revisi (${uncheckedCount})` : 'Perlu Revisi',
        badgeClass: 'bg-[#FAF0ED] dark:bg-[#2B1B18] text-[#874538] dark:text-[#E4A599] font-medium shadow-2xs',
        icon: AlertCircle,
        needsRevision: true,
        totalNotes: uncheckedCount,
      };
    }

    if (doc.status === 'Terkumpul') {
      return {
        type: 'terkumpul' as const,
        label: 'Menunggu Koreksi',
        badgeClass: 'bg-[#FAF4EB] dark:bg-[#282117] text-[#785429] dark:text-[#E2C7A7] shadow-2xs',
        icon: Clock,
        needsRevision: false,
        totalNotes: 0,
      };
    }

    return {
      type: 'draf' as const,
      label: 'Draf Saya',
      badgeClass: 'bg-[#F4F3EF] dark:bg-[#222126] text-[#5C5751] dark:text-[#B5B0A8] shadow-2xs',
      icon: FileText,
      needsRevision: false,
      totalNotes: 0,
    };
  };

  const taskStats = React.useMemo(() => {
    let revisi = 0;
    let draf = 0;
    let terkumpul = 0;
    let selesai = 0;
    let publish = 0;
    let kolaborasi = 0;

    dokumenList.forEach((d) => {
      const isCollab = Boolean(d.isKolaboratif || (d.kolaborator && d.kolaborator.length > 0));
      if (isCollab) kolaborasi++;
      const info = getDocStatusInfo(d);
      if (info.type === 'publish') publish++;
      if (info.type === 'selesai' || info.type === 'publish') selesai++;
      if (info.type === 'terkumpul') terkumpul++;
      if (info.type === 'revisi') revisi++;
      if (info.type === 'draf') draf++;
    });

    return { revisi, draf, terkumpul, selesai, publish, kolaborasi, total: dokumenList.length };
  }, [dokumenList, checklistVersion]);

  const filteredDokumenList = React.useMemo(() => {
    return dokumenList.filter((doc) => {
      const info = getDocStatusInfo(doc);
      let matchFilter = true;
      if (taskFilterStatus === 'revisi') matchFilter = info.type === 'revisi';
      else if (taskFilterStatus === 'draf') matchFilter = info.type === 'draf';
      else if (taskFilterStatus === 'kolaborasi') matchFilter = Boolean(doc.isKolaboratif || (doc.kolaborator && doc.kolaborator.length > 0));
      else if (taskFilterStatus === 'terkumpul') matchFilter = info.type === 'terkumpul';
      else if (taskFilterStatus === 'selesai') matchFilter = info.type === 'selesai' || info.type === 'publish';

      const q = taskSearchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        (doc.judul && doc.judul.toLowerCase().includes(q)) ||
        (doc.teks && doc.teks.toLowerCase().includes(q));

      return matchFilter && matchSearch;
    });
  }, [dokumenList, taskFilterStatus, taskSearchQuery, checklistVersion]);

  const [isNewDocOpen, setIsNewDocOpen] = useState(false);
  const [newDocTitle, setNewDocTitle] = useState('');
  const [deleteDocId, setDeleteDocId] = useState<string | null>(null);

  // State Kolaborasi Multi-Siswa
  const [isCollabMode, setIsCollabMode] = useState<boolean>(false);
  const [selectedCollabs, setSelectedCollabs] = useState<KolaboratorAnggota[]>([]);
  const [classmates, setClassmates] = useState<UserAccount[]>([]);
  const [classmateSearch, setClassmateSearch] = useState<string>('');
  const [managingCollabDoc, setManagingCollabDoc] = useState<Dokumen | null>(null);

  // Penugasan Kelas Siswa
  const [penugasanList, setPenugasanList] = useState<Penugasan[]>([]);
  const [selectedTugasId, setSelectedTugasId] = useState<string>('');
  const [selectedTugasJudul, setSelectedTugasJudul] = useState<string>('');

  useEffect(() => {
    if (!kodeKelas) return;
    const unsub = DataService.listenPenugasan((list) => {
      setPenugasanList(list);
    }, kodeKelas);
    return () => unsub();
  }, [kodeKelas]);

  // State Kelas untuk resolusi nama kelas yang ramah (human-readable)
  const [kelasList, setKelasList] = useState<KelasRoom[]>([]);

  useEffect(() => {
    const unsub = DataService.listenKelas((list) => {
      setKelasList(list);
    });
    return () => unsub();
  }, []);

  const resolveNamaKelas = useCallback((targetKodeKelas?: string | null, tugasId?: string | null) => {
    if (!targetKodeKelas || targetKodeKelas === 'Semua' || targetKodeKelas === 'Umum') {
      return 'Semua Kelas';
    }
    const found = kelasList.find(
      (k) => (k.kodeKelas || '').trim().toLowerCase() === targetKodeKelas.trim().toLowerCase()
    );
    if (found && found.namaKelas) {
      return found.namaKelas;
    }
    if (tugasId) {
      const tugas = penugasanList.find((t) => String(t.id) === String(tugasId));
      if (tugas?.namaKelas) return tugas.namaKelas;
    }
    if (kodeKelas && targetKodeKelas.trim().toLowerCase() === kodeKelas.trim().toLowerCase() && namaKelas) {
      return namaKelas;
    }
    return targetKodeKelas;
  }, [kelasList, penugasanList, kodeKelas, namaKelas]);

  useEffect(() => {
    if (isNewDocOpen && kodeKelas) {
      DataService.getTemanSekelas(kodeKelas, username).then(setClassmates).catch(() => {});
    }
  }, [isNewDocOpen, kodeKelas, username]);

  const [publishDocId, setPublishDocId] = useState<string | null>(null);
  const [publishTopic, setPublishTopic] = useState('Cerpen');

  const [madingStats, setMadingStats] = useState<Record<string, { likes: number; comments: number; views: number }>>({});
  const [madingFilterTopik, setMadingFilterTopik] = useState<string>('Semua');
  const [madingSearchQuery, setMadingSearchQuery] = useState<string>('');

  // State Modal Klaim Karya Lama (Migrasi)
  const [isRedeemModalOpen, setIsRedeemModalOpen] = useState(false);
  const [redeemInput, setRedeemInput] = useState('');
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [redeemFeedback, setRedeemFeedback] = useState<{
    success: boolean;
    message: string;
    naskahList?: Dokumen[];
  } | null>(null);

  // State Status Klaim Arsip Lama Siswa (1 akun hanya boleh klaim 1 kali, bisa klaim lagi jika dibatalkan guru)
  const [claimedRedeemInfo, setClaimedRedeemInfo] = useState<MigrasiRedeemItem | null>(null);

  const fetchRedeemStatus = useCallback(async () => {
    if (!username) return;
    try {
      const info = await DataService.getStatusRedeemSiswa(username);
      setClaimedRedeemInfo(info);
    } catch (e) {
      console.warn('Gagal memuat status redeem siswa:', e);
    }
  }, [username]);

  useEffect(() => {
    fetchRedeemStatus();
    const handleDbChange = () => {
      fetchRedeemStatus();
    };
    window.addEventListener('nulislur_db_change', handleDbChange);
    return () => window.removeEventListener('nulislur_db_change', handleDbChange);
  }, [fetchRedeemStatus]);

  // State Modal Pengaturan Akun Siswa (Ubah ID & Password)
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [newUsernameInput, setNewUsernameInput] = useState(username);
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [isUpdatingAccount, setIsUpdatingAccount] = useState(false);
  const [accountNotice, setAccountNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // State Kutipan Inspiratif / Quotes (Dapat diubah oleh guru)
  const [quoteHarian, setQuoteHarian] = useState<{ teks: string; penulis: string }>(() => DataService.getQuote());

  useEffect(() => {
    const unsub = DataService.listenQuote((q) => {
      setQuoteHarian(q);
    });
    return () => unsub();
  }, []);

  // 1. Listen dokumen siswa (Hanya dengarkan naskah milik sendiri + mading, hemat 99% broadcast)
  useEffect(() => {
    const unsub = DataService.listenDokumenSiswa(username, (docs) => {
      const myDocs: Dokumen[] = [];
      const madingDocs: Dokumen[] = [];

      Object.values(docs).forEach((d) => {
        const isAuthor = d.username ? d.username === username : d.nama === nama;
        const isCollab =
          Boolean(d.kolaborator?.some((k) => k.username === username || (k as any) === username)) ||
          Boolean(d.kolaboratorUsernames?.includes(username));
        if ((isAuthor || isCollab) && d.penulisKategori !== 'Guru') {
          myDocs.push(d);
        }

        if (d.isPublic) {
          madingDocs.push(d);
        }
      });

      madingDocs.sort((a, b) => (b.waktuPublish || 0) - (a.waktuPublish || 0));

      setDokumenList(myDocs);
      setMadingList(madingDocs);
    });

    return () => unsub();
  }, [nama, username]);

  // 2. Listen pengumuman
  useEffect(() => {
    const unsub = DataService.listenPengumuman((items) => {
      setPengumumanList(items);
    });

    return () => unsub();
  }, []);

  // Filter Woro-woro: Sembunyikan tugas yang sudah dikumpulkan/selesai oleh siswa ini atau jika tugas telah dihapus guru
  const filteredPengumumanList = React.useMemo(() => {
    return pengumumanList.filter((p) => {
      // Isolasi 100% woro-woro antar sekolah
      if (sekolahId && p.sekolahId && p.sekolahId !== sekolahId) {
        return false;
      }
      // Filter kelas jika ada (case-insensitive)
      if (
        p.kodeKelas &&
        p.kodeKelas !== 'Umum' &&
        kodeKelas &&
        p.kodeKelas.trim().toUpperCase() !== kodeKelas.trim().toUpperCase()
      ) {
        return false;
      }
      // Jika woro-woro penugasan
      if (p.tugasId) {
        // Jika penugasan sudah termuat di lobi, pastikan tugas tersebut belum dihapus guru
        if (penugasanList.length > 0) {
          const tugasAda = penugasanList.some((t) => String(t.id) === String(p.tugasId));
          if (!tugasAda) {
            return false;
          }
        }
        // Sembunyikan jika siswa sudah submit (Terkumpul atau Selesai) untuk penugasan ini
        const sudahSubmit = dokumenList.some(
          (d) =>
            (d.status === 'Terkumpul' || d.status === 'Selesai') &&
            Boolean(d.tugasId && String(d.tugasId) === String(p.tugasId))
        );
        if (sudahSubmit) {
          return false;
        }
      }
      return true;
    });
  }, [pengumumanList, dokumenList, kodeKelas, penugasanList, sekolahId]);

  // Optimalisasi: Memoize daftar ID naskah mading agar tidak unsubscribe/resubscribe puluhan listener saat siswa mengetik draf
  const madingIdsKey = React.useMemo(() => madingList.map((d) => d.id).join(','), [madingList]);

  // 3. Muat Likes, Views, Comments untuk Ruang Publik secara efisien (Batch fetch, hemat 99% koneksi WebSocket)
  useEffect(() => {
    if (!madingIdsKey) return;
    const currentMadingDocs = madingList;
    if (currentMadingDocs.length === 0) return;

    // Inisialisasi awal madingStats langsung dari cache lokal agar respons instan (< 1ms)
    setMadingStats((prev) => {
      const initial: Record<string, { likes: number; comments: number; views: number }> = { ...prev };
      currentMadingDocs.forEach((d) => {
        const stats = DataService.getDocStats(d.id, username);
        initial[d.id] = {
          likes: stats.likes,
          comments: stats.comments,
          views: Math.max(stats.views, d.views || 0),
        };
      });
      return initial;
    });

    // Ambil data agregat likes & komentar secara batch (hanya 2 request kecil, tanpa puluhan websocket)
    DataService.getMadingStatsSummary().then(({ likesMap, commentsMap }) => {
      setMadingStats((prev) => {
        const updated = { ...prev };
        currentMadingDocs.forEach((d) => {
          const current = updated[d.id] || { likes: 0, comments: 0, views: d.views || 0 };
          updated[d.id] = {
            likes: likesMap[d.id] !== undefined ? likesMap[d.id] : current.likes,
            comments: commentsMap[d.id] !== undefined ? commentsMap[d.id] : current.comments,
            views: Math.max(current.views, d.views || 0),
          };
        });
        return updated;
      });
    });

    // Tangkap perubahan interaksi lokal seketika
    const handleStatChange = () => {
      setMadingStats((prev) => {
        const updated = { ...prev };
        currentMadingDocs.forEach((d) => {
          const stats = DataService.getDocStats(d.id, username);
          updated[d.id] = {
            likes: stats.likes,
            comments: stats.comments,
            views: Math.max(stats.views, d.views || 0),
          };
        });
        return updated;
      });
    };

    window.addEventListener('nulislur_likes_change', handleStatChange);
    window.addEventListener('nulislur_views_change', handleStatChange);
    window.addEventListener('nulislur_komentar_change', handleStatChange);

    return () => {
      window.removeEventListener('nulislur_likes_change', handleStatChange);
      window.removeEventListener('nulislur_views_change', handleStatChange);
      window.removeEventListener('nulislur_komentar_change', handleStatChange);
    };
  }, [madingIdsKey, username]);

  const filteredMadingList = React.useMemo(() => {
    return madingList.filter((doc) => {
      const matchTopik = madingFilterTopik === 'Semua' || doc.topik === madingFilterTopik;
      const q = madingSearchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        (doc.judul && doc.judul.toLowerCase().includes(q)) ||
        (doc.nama && doc.nama.toLowerCase().includes(q)) ||
        (doc.namaKelas && doc.namaKelas.toLowerCase().includes(q));
      return matchTopik && matchSearch;
    });
  }, [madingList, madingFilterTopik, madingSearchQuery]);

  const handleCreateNewDoc = async () => {
    if (!newDocTitle.trim()) {
      alert('Judul tidak boleh kosong!');
      return;
    }
    if (isCollabMode && selectedCollabs.length === 0) {
      alert('Kamu memilih mode Kolaborasi, silakan pilih minimal 1 teman kolaborator di daftar teman sekelas di bawah. Atau pilih mode Mandiri jika ingin menulis sendiri.');
      return;
    }
    try {
      const activeTask = penugasanList.find((p) => p.id === selectedTugasId);
      const docId = await DataService.buatDokumenBaru(
        nama,
        username,
        kodeKelas,
        newDocTitle.trim(),
        'Siswa',
        activeTask?.topik,
        selectedTugasId || null,
        selectedTugasJudul || null,
        isCollabMode,
        selectedCollabs
      );
      setIsNewDocOpen(false);
      setNewDocTitle('');
      setSelectedTugasId('');
      setSelectedTugasJudul('');
      setIsCollabMode(false);
      setSelectedCollabs([]);
      onOpenEditor(docId);
    } catch (err: any) {
      console.error('Gagal membuat dokumen:', err);
      alert('Gagal membuat dokumen: ' + (err?.message || 'Terjadi kesalahan sistem'));
    }
  };

  const handleConfirmPublish = async () => {
    if (!publishDocId) return;
    await DataService.publikasiKeMading(publishDocId, publishTopic, nama);
    setPublishDocId(null);
    setActiveTab('mading');
  };

  const handleKlaimRedeem = async () => {
    const code = redeemInput.trim();
    if (!code) {
      alert('Silakan masukkan kode klaim terlebih dahulu!');
      return;
    }
    setIsRedeeming(true);
    setRedeemFeedback(null);
    try {
      const res = await DataService.klaimKodeRedeem(code, {
        username,
        nama,
        kodeKelas,
        namaKelas,
      });
      setRedeemFeedback(res);
      if (res.success) {
        setRedeemInput('');
        fetchRedeemStatus();
      }
    } catch (err: unknown) {
      setRedeemFeedback({
        success: false,
        message: err instanceof Error ? err.message : 'Terjadi gangguan saat memproses kode klaim.',
      });
    } finally {
      setIsRedeeming(false);
    }
  };

  const handleSaveAccount = async () => {
    setAccountNotice(null);
    const cleanNew = newUsernameInput.trim().toLowerCase();
    if (!cleanNew) {
      setAccountNotice({ type: 'error', text: 'ID / Username tidak boleh kosong.' });
      return;
    }
    if (newPasswordInput && newPasswordInput.trim().length < 4) {
      setAccountNotice({ type: 'error', text: 'Kata sandi baru minimal 4 karakter.' });
      return;
    }
    if (newPasswordInput && newPasswordInput !== confirmPasswordInput) {
      setAccountNotice({ type: 'error', text: 'Konfirmasi kata sandi tidak cocok. Harap periksa kembali.' });
      return;
    }

    setIsUpdatingAccount(true);
    try {
      const res = await DataService.ubahAkunSiswa(
        username,
        cleanNew,
        newPasswordInput ? newPasswordInput.trim() : undefined
      );

      if (res.success) {
        setAccountNotice({ type: 'success', text: res.message });
        setNewPasswordInput('');
        setConfirmPasswordInput('');
        if (res.user && onUserUpdate) {
          onUserUpdate(res.user);
        }
        setTimeout(() => {
          setIsAccountModalOpen(false);
          setAccountNotice(null);
        }, 1500);
      } else {
        setAccountNotice({ type: 'error', text: res.message });
      }
    } catch (err: unknown) {
      setAccountNotice({
        type: 'error',
        text: err instanceof Error ? err.message : 'Terjadi gangguan saat menyimpan perubahan akun.'
      });
    } finally {
      setIsUpdatingAccount(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-8 w-full flex flex-col min-h-screen">
      {/* Header Siswa */}
      <header className="editorial-card p-6 sm:p-8 bg-white dark:bg-[#141416] mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300">
              {namaKelas || 'Kelas'}
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold font-serif-literary text-stone-900 dark:text-stone-100">
            Halo, {nama}
          </h2>
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5">
          <ThemeToggle />

          {claimedRedeemInfo ? (
            <button
              onClick={() => {
                setIsRedeemModalOpen(true);
                setRedeemFeedback({
                  success: true,
                  message: `Karya arsip atas nama "${claimedRedeemInfo.originalNama}" (Kode: ${claimedRedeemInfo.kodeRedeem}) sudah berhasil terhubung ke akunmu.`,
                  naskahList: (claimedRedeemInfo.naskahList as any) || [],
                });
              }}
              className="editorial-btn bg-[#EAF3EC] hover:bg-[#DDECE0] text-[#2D5A37] dark:bg-[#1E2B22] dark:text-[#A7D1AF] px-3 sm:px-3.5 py-2 text-xs font-semibold cursor-pointer shadow-xs flex items-center gap-1.5 transition-colors"
              title={`Karya arsip sudah diklaim (${claimedRedeemInfo.kodeRedeem}). Klik untuk melihat arsip.`}
            >
              <CheckCircle2 size={14} className="text-[#2D5A37] dark:text-[#A7D1AF]" />
              <span className="hidden sm:inline">Karya Terklaim</span>
              <span className="sm:hidden">Terklaim</span>
            </button>
          ) : (
            <button
              onClick={() => {
                setIsRedeemModalOpen(true);
                setRedeemFeedback(null);
              }}
              className="editorial-btn bg-[#FAF4EB] hover:bg-[#F2E8D8] text-[#785429] dark:bg-[#282117] dark:text-[#E2C7A7] dark:hover:bg-[#322A1E] px-3 sm:px-3.5 py-2 text-xs font-semibold cursor-pointer shadow-xs flex items-center gap-1.5 transition-colors"
              title="Klaim naskah tulisan dari semester/aplikasi sebelumnya"
            >
              <KeyRound size={14} className="text-[#785429] dark:text-[#E2C7A7]" />
              <span className="hidden sm:inline">Klaim Karya Lama</span>
              <span className="sm:hidden">Klaim</span>
            </button>
          )}

          <button
            onClick={() => setIsNewDocOpen(true)}
            className="editorial-btn bg-[#2D2926] hover:bg-[#1C1917] text-white dark:bg-[#EAE6E1] dark:hover:bg-white dark:text-[#1C1917] px-3.5 sm:px-4 py-2 text-xs font-bold cursor-pointer shadow-xs flex items-center gap-1.5 transition-all"
            title="Buat Naskah Tulisan Baru"
          >
            <Plus size={15} />
            <span className="hidden sm:inline">Tulisan Baru</span>
            <span className="sm:hidden">Tulis</span>
          </button>

          <div className="h-5 w-[1px] bg-stone-200 dark:bg-stone-800 mx-0.5" />

          {/* Sisi Paling Kanan: Akun Saya & Keluar (Hanya Icon) */}
          <button
            onClick={() => {
              setNewUsernameInput(username);
              setNewPasswordInput('');
              setConfirmPasswordInput('');
              setAccountNotice(null);
              setIsAccountModalOpen(true);
            }}
            className="w-9 h-9 rounded-xl flex items-center justify-center bg-stone-100 hover:bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700 shadow-2xs transition-all cursor-pointer hover:scale-105 active:scale-95 shrink-0"
            title="Pengaturan Akun Saya (Ubah ID & Kata Sandi)"
            aria-label="Pengaturan Akun Saya"
          >
            <User size={16} />
          </button>

          <button
            onClick={onLogout}
            className="w-9 h-9 rounded-xl flex items-center justify-center bg-stone-100 hover:bg-red-50 text-stone-700 hover:text-red-700 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-red-950/40 dark:hover:text-red-400 shadow-2xs transition-all cursor-pointer hover:scale-105 active:scale-95 shrink-0"
            title="Keluar dari Akun"
            aria-label="Keluar"
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* Tabs Navigasi */}
      <div className="flex gap-3 mb-6 border-b border-stone-200 dark:border-stone-800">
        <button
          onClick={() => setActiveTab('karya')}
          className={`pb-3 text-sm font-semibold transition-all relative flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'karya'
              ? 'text-stone-900 dark:text-stone-100 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-stone-900 dark:after:bg-stone-100'
              : 'text-stone-400 dark:text-stone-500 hover:text-stone-700 dark:hover:text-stone-300'
          }`}
        >
          <FileText size={14} className="opacity-70" /> Tulisanku ({dokumenList.length})
        </button>
        <button
          onClick={() => setActiveTab('cuitan')}
          className={`pb-3 text-sm font-semibold transition-all relative flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'cuitan'
              ? 'text-stone-900 dark:text-stone-100 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-stone-900 dark:after:bg-stone-100'
              : 'text-stone-400 dark:text-stone-500 hover:text-stone-700 dark:hover:text-stone-300'
          }`}
        >
          <MessageSquare size={14} className="opacity-70" /> Cuitan
        </button>
        <button
          onClick={() => setActiveTab('mading')}
          className={`pb-3 text-sm font-semibold transition-all relative flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'mading'
              ? 'text-stone-900 dark:text-stone-100 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-stone-900 dark:after:bg-stone-100'
              : 'text-stone-400 dark:text-stone-500 hover:text-stone-700 dark:hover:text-stone-300'
          }`}
        >
          <BookOpen size={14} className="opacity-70" /> Pojok Baca
        </button>
        <button
          onClick={() => setActiveTab('perkembangan')}
          className={`pb-3 text-sm font-semibold transition-all relative flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'perkembangan'
              ? 'text-stone-900 dark:text-stone-100 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-stone-900 dark:after:bg-stone-100'
              : 'text-stone-400 dark:text-stone-500 hover:text-stone-700 dark:hover:text-stone-300'
          }`}
        >
          <TrendingUp size={14} className="opacity-70" /> Perkembangan Menulis
        </button>
      </div>

      {/* Konten Beranda */}
      {activeTab === 'karya' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Kolom Kiri: Daftar Kartu Tulisan Siswa */}
          <div className="lg:col-span-2">
            {/* Search Bar & Status Filter Pills */}
            <div className="mb-5 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 justify-between">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                <input
                  type="text"
                  value={taskSearchQuery}
                  onChange={(e) => setTaskSearchQuery(e.target.value)}
                  placeholder="Cari judul tugas naskah..."
                  className="editorial-input w-full pl-8.5 pr-8 py-2 text-xs bg-white dark:bg-[#141416] text-stone-900 dark:text-stone-100 rounded-xl shadow-2xs border-stone-200/50 dark:border-stone-800/60"
                />
                {taskSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setTaskSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 cursor-pointer"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              {/* Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                {[
                  { id: 'semua', label: 'Semua', count: dokumenList.length, alert: false },
                  { id: 'kolaborasi', label: 'Kolaborasi', count: taskStats.kolaborasi, alert: false },
                  { id: 'revisi', label: 'Perlu Revisi', count: taskStats.revisi, alert: taskStats.revisi > 0 },
                  { id: 'draf', label: 'Draf', count: taskStats.draf, alert: false },
                  { id: 'terkumpul', label: 'Menunggu', count: taskStats.terkumpul, alert: false },
                  { id: 'selesai', label: 'Selesai', count: taskStats.selesai, alert: false },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setTaskFilterStatus(tab.id as any)}
                    className={`text-[11px] font-semibold px-2.5 py-1.5 rounded-lg whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs ${
                      taskFilterStatus === tab.id
                        ? tab.alert
                          ? 'bg-[#874538] text-white dark:bg-[#A35647]'
                          : 'bg-stone-900 text-white dark:bg-stone-800 dark:text-stone-100'
                        : tab.alert
                        ? 'bg-[#FAF0ED] dark:bg-[#2B1B18] text-[#874538] dark:text-[#E4A599] hover:bg-[#F5E6E1]'
                        : 'bg-white dark:bg-[#141416] text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800/80'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                        taskFilterStatus === tab.id
                          ? 'bg-white/20 text-white'
                          : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300'
                      }`}
                    >
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {dokumenList.length === 0 ? (
              <div className="editorial-card p-12 text-center bg-white dark:bg-[#141416] border border-dashed border-stone-300 dark:border-stone-700">
                <div className="w-12 h-12 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-400 dark:text-stone-500 mx-auto flex items-center justify-center mb-3">
                  <Feather size={20} />
                </div>
                <h3 className="font-serif-literary text-lg font-bold text-stone-800 dark:text-stone-100 mb-1">
                  Kamu belum nulis sama sekali.
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400 mb-5">
                  Buat tulisan baru untuk mulai menulis naskah.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button
                    onClick={() => setIsNewDocOpen(true)}
                    className="editorial-btn bg-stone-900 hover:bg-stone-800 text-white dark:bg-stone-800 dark:hover:bg-stone-700 dark:text-stone-100 dark:border dark:border-stone-700 px-4 py-2.5 text-xs cursor-pointer"
                  >
                    <Plus size={15} /> Buat Tugas
                  </button>
                  {!claimedRedeemInfo && (
                    <button
                      onClick={() => {
                        setIsRedeemModalOpen(true);
                        setRedeemFeedback(null);
                      }}
                      className="editorial-btn bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-800/80 dark:hover:bg-amber-950/70 px-4 py-2.5 text-xs cursor-pointer flex items-center gap-1.5"
                    >
                      <KeyRound size={15} className="text-amber-600 dark:text-amber-400" /> Klaim Karya Lama
                    </button>
                  )}
                </div>
              </div>
            ) : filteredDokumenList.length === 0 ? (
              <div className="editorial-card p-10 text-center bg-white dark:bg-[#141416] border border-dashed border-stone-300 dark:border-stone-700">
                <p className="text-xs text-stone-500 dark:text-stone-400 mb-3">
                  Tidak ada tugas naskah yang cocok dengan filter atau kata kunci pencarian.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setTaskFilterStatus('semua');
                    setTaskSearchQuery('');
                  }}
                  className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                >
                  Reset Filter & Pencarian
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredDokumenList.map((doc) => {
                  const isApproved = doc.status === 'Selesai' || doc.izinPublish;
                  const isCollabDoc = Boolean(doc.isKolaboratif || (doc.kolaborator && doc.kolaborator.length > 0));
                  const isPembuat = doc.username ? doc.username === username : doc.nama === nama;
                  const info = getDocStatusInfo(doc);
                  const StatusIcon = info.icon;

                  return (
                    <div
                      key={doc.id}
                      onClick={() => onOpenEditor(doc.id)}
                      className={`editorial-card p-5 bg-white dark:bg-[#141416] cursor-pointer flex flex-col justify-between transition-all hover:shadow-md ${
                        info.needsRevision
                          ? 'ring-1 ring-[#E5B5AA]/60 dark:ring-[#5C2B22]/60 shadow-xs'
                          : ''
                      }`}
                    >
                      <div>
                        <div className="flex flex-wrap items-center justify-between gap-1.5 mb-2.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className={`text-[11px] font-semibold px-2 py-0.5 rounded-md flex items-center gap-1 ${info.badgeClass}`}
                            >
                              <StatusIcon size={11} /> {info.label}
                            </span>
                            {doc.judulTugas && (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-[#EEF3F8] dark:bg-[#1A2530] text-[#365778] dark:text-[#A4C2E0] shadow-2xs flex items-center gap-1">
                                <BookOpen size={10} /> {cleanTitle(doc.judulTugas)}
                              </span>
                            )}
                            {isCollabDoc && (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-[#F3EFF8] dark:bg-[#251E2E] text-[#594673] dark:text-[#CBBDE2] shadow-2xs flex items-center gap-1">
                                <Users size={10} /> {isPembuat ? `Kolaborasi (${(doc.kolaborator?.length || 0) + 1})` : `Diajak Kolab oleh ${doc.nama}`}
                              </span>
                            )}
                          </div>

                          {doc.pelanggaran > 0 && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#FDF1F1] dark:bg-[#2A1818] text-[#8C3E3E] dark:text-[#E49D9D] shadow-2xs flex items-center gap-1">
                              <AlertCircle size={11} /> {doc.pelanggaran}x
                            </span>
                          )}
                        </div>

                        <h4 className="font-serif-literary font-bold text-base text-stone-900 dark:text-stone-100 line-clamp-2 mb-1 group-hover:text-[#365778] dark:group-hover:text-[#A4C2E0] transition-colors">
                          {cleanTitle(doc.judul)}
                        </h4>

                        {/* Info Tim Kolaborasi */}
                        {isCollabDoc && (
                          <div className="flex flex-wrap items-center gap-1.5 mb-2 text-[11px] text-stone-500 dark:text-stone-400">
                            <span className="text-[10px] text-stone-400">Penulis:</span>
                            <span className="font-semibold text-stone-700 dark:text-stone-300">
                              {doc.nama}
                            </span>
                            {doc.kolaborator && doc.kolaborator.length > 0 && (
                              <span>
                                & {doc.kolaborator.map((k) => k.nama).join(', ')}
                              </span>
                            )}
                            {!isPembuat && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#E9E1F2] dark:bg-[#32233F] text-[#594673] dark:text-[#CBBDE2] font-semibold ml-1">
                                Kolaborator
                              </span>
                            )}
                          </div>
                        )}

                        {info.needsRevision && (
                          <div className="mt-1 mb-2.5 px-2.5 py-1.5 rounded-lg bg-[#FAF0ED] dark:bg-[#2B1B18] text-[11px] text-[#874538] dark:text-[#E4A599] flex items-center gap-1.5 shadow-2xs">
                            <Sparkles size={12} className="text-[#A35647] dark:text-[#E4A599] shrink-0" />
                            <span className="truncate">Ada catatan koreksi dari guru ({info.totalNotes})</span>
                          </div>
                        )}

                        <p className="font-serif-literary text-xs text-stone-500 dark:text-stone-400 line-clamp-3 mb-4 leading-relaxed">
                          {cleanSnippet(doc.teks)}
                        </p>
                      </div>

                      <div className="pt-3 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between text-xs">
                        <span className="text-[11px] text-stone-400 dark:text-stone-500">
                          {doc.status === 'Terkumpul' || doc.status === 'Selesai'
                            ? `Disubmit: ${doc.waktuKumpul || '-'}`
                            : `Diedit: ${doc.waktuEdit || '-'}`}
                        </span>

                        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          {doc.status === 'Draf' && isPembuat && (
                            <button
                              type="button"
                              onClick={() => setManagingCollabDoc(doc)}
                              className="editorial-btn bg-stone-100 hover:bg-[#F3EFF8] text-stone-600 hover:text-[#594673] dark:bg-stone-800 dark:hover:bg-[#251E2E] dark:text-stone-300 dark:hover:text-[#CBBDE2] text-xs px-2.5 py-1 rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                              title="Kelola Kolaborator"
                            >
                              <Users size={12} /> {isCollabDoc ? `Kolaborator (${(doc.kolaborator?.length || 0) + 1})` : '+ Ajak Kolab'}
                            </button>
                          )}

                          {!isPembuat && isCollabDoc && (
                            <button
                              type="button"
                              onClick={() => setManagingCollabDoc(doc)}
                              className="editorial-btn bg-stone-100 hover:bg-[#F3EFF8] text-stone-600 hover:text-[#594673] dark:bg-stone-800 dark:hover:bg-[#251E2E] dark:text-stone-300 dark:hover:text-[#CBBDE2] text-xs px-2.5 py-1 rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                              title="Lihat Tim Kolaborator"
                            >
                              <Users size={12} /> Tim ({(doc.kolaborator?.length || 0) + 1})
                            </button>
                          )}

                          {isApproved && !doc.isPublic && (
                            <button
                              onClick={() => setPublishDocId(doc.id)}
                              className="editorial-btn bg-[#365778] hover:bg-[#29435C] text-white dark:bg-[#436A92] dark:hover:bg-[#527EAE] text-xs px-2.5 py-1 cursor-pointer"
                              title="Publikasikan ke Ruang Publik"
                            >
                              <Share2 size={12} /> Publikasi
                            </button>
                          )}

                          {doc.status === 'Draf' && isPembuat && (
                            <button
                              onClick={() => setDeleteDocId(doc.id)}
                              className="p-1.5 rounded-lg text-stone-400 hover:text-[#8C3E3E] hover:bg-[#FDF1F1] dark:hover:bg-[#2A1818] transition-colors cursor-pointer"
                              title="Hapus Draf"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Kolom Kanan: Woro-woro & Kutipan Sastra */}
          <div className="flex flex-col gap-5">
            <div className="editorial-card p-5 bg-white dark:bg-[#141416]">
              <div className="flex items-center justify-between pb-3 mb-3.5 border-b border-stone-100 dark:border-stone-800">
                <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                  <Megaphone size={16} className="text-[#8F6533] dark:text-[#D9B27F]" /> 
                  <span>Woro-woro</span>
                </h3>
              </div>

              <div className="max-h-72 overflow-y-auto pr-1 flex flex-col gap-3 custom-scrollbar">
                {filteredPengumumanList.length === 0 ? (
                  <div className="py-8 text-center text-xs text-stone-400 dark:text-stone-500 font-serif-literary italic">
                    Belum ada woro-woro baru untuk kelasmu.
                  </div>
                ) : (
                  filteredPengumumanList.map((p) => (
                    <div
                      key={p.id}
                      className={`p-3.5 rounded-xl text-xs font-medium transition-all duration-200 ${
                        p.tugasId
                          ? 'bg-[#FAF4EB] dark:bg-[#221A12] text-stone-800 dark:text-stone-200 shadow-2xs'
                          : 'bg-[#FAF9F5] dark:bg-[#18181B] text-stone-800 dark:text-stone-200 shadow-2xs'
                      }`}
                    >
                      {p.tugasId ? (
                        <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-[#ECDDC8]/60 dark:border-[#3D3021]/60">
                          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#7A5425] dark:text-[#E8CFB0] bg-[#F1E5D3] dark:bg-[#342717] px-2 py-0.5 rounded-md">
                            <BookOpen size={10} className="text-[#8F6533] dark:text-[#D9B27F]" /> Penugasan Guru
                          </span>
                          <button
                            onClick={() => {
                              setSelectedTugasId(p.tugasId!);
                              const found = penugasanList.find((t) => t.id === p.tugasId);
                              if (found) setSelectedTugasJudul(found.judul);
                              setNewDocTitle('');
                              setIsNewDocOpen(true);
                            }}
                            className="inline-flex items-center gap-1 text-[10px] font-semibold py-0.5 px-2.5 rounded-md bg-[#7A5425] hover:bg-[#66441C] text-white dark:bg-[#D9B27F] dark:text-[#251A0C] dark:hover:bg-[#E8C496] shadow-2xs cursor-pointer transition-all active:scale-95"
                            title="Mulai menulis tugas ini"
                          >
                            <Plus size={10} /> Tulis Sekarang
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#5C5952] dark:text-[#B8B5AD] bg-[#F1EFEA] dark:bg-[#252528] px-2 py-0.5 rounded-md">
                            Informasi
                          </span>
                        </div>
                      )}

                      <div className="text-stone-700 dark:text-stone-300">
                        <FormattedWoroText text={p.teks} />
                      </div>

                      <div className="mt-2.5 pt-2 border-t border-stone-200/50 dark:border-stone-800/80 flex items-center justify-between text-[10px] text-stone-400 dark:text-stone-500">
                        <span className="flex items-center gap-1">
                          <Clock size={11} className="opacity-70" /> {p.waktu}
                        </span>
                        {p.kodeKelas && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 shadow-2xs">
                            {resolveNamaKelas(p.kodeKelas, p.tugasId)}
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Kutipan Sastra / Quotes Inspiratif */}
            <div className="editorial-card p-4.5 bg-[#FAF9F6] dark:bg-[#161618] text-stone-800 dark:text-stone-200 relative overflow-hidden shadow-2xs">
              <blockquote className="font-serif-literary text-xs sm:text-[13px] leading-relaxed text-stone-700 dark:text-stone-300 italic mb-2 relative z-10 pl-3.5 border-l-2 border-[#C9A874] dark:border-[#8E744A]">
                “{quoteHarian.teks}”
              </blockquote>
              <div className="text-right text-[11px] font-semibold text-stone-500 dark:text-stone-400 font-serif-literary">
                — {quoteHarian.penulis}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab Cuitan */}
      {activeTab === 'cuitan' && (
        <div className="max-w-2xl mx-auto w-full animate-in fade-in duration-150">
          <LinimasaCuitan
            currentUser={{
              username,
              nama,
              role: 'siswa',
              kodeKelas,
              namaKelas,
              sekolahId,
              namaSekolah,
            }}
          />
        </div>
      )}

      {/* Tab Perkembangan Belajar */}
      {activeTab === 'perkembangan' && (
        <div className="max-w-5xl mx-auto w-full">
          <StudentGrowthReport
            dokumenList={dokumenList}
            onOpenEditor={onOpenEditor}
          />
        </div>
      )}

      {/* Tab Pojok Baca */}
      {activeTab === 'mading' && (
        <div className="max-w-3xl mx-auto w-full">
          <div className="text-center mb-6">
            <h3 className="text-2xl font-bold font-serif-literary text-stone-900 dark:text-stone-100 mb-1 flex items-center justify-center gap-2">
              <BookOpen size={20} className="text-stone-900 dark:text-stone-100" /> Pojok Baca
            </h3>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Karya tulisan dari seluruh kelas yang telah disetujui guru dan dipublikasikan.
            </p>
          </div>

          {/* Search Bar & Kategori Topik */}
          <div className="mb-6 flex flex-col sm:flex-row items-center gap-2.5">
            <div className="relative w-full sm:flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                value={madingSearchQuery}
                onChange={(e) => setMadingSearchQuery(e.target.value)}
                placeholder="Cari judul, nama penulis, atau kelas..."
                className="editorial-input w-full pl-8.5 pr-8 py-2 text-xs bg-white dark:bg-[#141416] text-stone-900 dark:text-stone-100 border border-stone-200/80 dark:border-stone-800 rounded-xl"
              />
              {madingSearchQuery && (
                <button
                  type="button"
                  onClick={() => setMadingSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 cursor-pointer"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 scrollbar-none">
              {['Semua', 'Cerpen', 'Puisi', 'Esai', 'Artikel', 'Resensi', 'Lainnya'].map((topik) => (
                <button
                  key={topik}
                  type="button"
                  onClick={() => setMadingFilterTopik(topik)}
                  className={`text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border whitespace-nowrap transition-all cursor-pointer ${
                    madingFilterTopik === topik
                      ? 'bg-stone-900 text-white border-stone-900 dark:bg-stone-800 dark:text-stone-100 dark:border-stone-700 shadow-2xs'
                      : 'bg-white dark:bg-[#141416] text-stone-600 dark:text-stone-400 border-stone-200/80 dark:border-stone-800 hover:bg-stone-100 dark:hover:bg-stone-800/80'
                  }`}
                >
                  {topik}
                </button>
              ))}
            </div>
          </div>

          {madingList.length === 0 ? (
            <div className="editorial-card p-12 text-center bg-white dark:bg-[#141416] border border-dashed border-stone-300 dark:border-stone-700">
              <p className="text-sm font-medium text-stone-500 dark:text-stone-400">
                Belum ada karya yang dipublikasikan di Pojok Baca.
              </p>
            </div>
          ) : filteredMadingList.length === 0 ? (
            <div className="editorial-card p-12 text-center bg-white dark:bg-[#141416] border border-dashed border-stone-300 dark:border-stone-700">
              <p className="text-sm font-medium text-stone-500 dark:text-stone-400">
                Tidak ada karya yang sesuai dengan kata kunci atau filter topik yang dipilih.
              </p>
              <button
                type="button"
                onClick={() => {
                  setMadingFilterTopik('Semua');
                  setMadingSearchQuery('');
                }}
                className="mt-3 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                Reset Filter & Pencarian
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {filteredMadingList.map((doc) => {
                const topicColor = getWarnaTopik(doc.topik);
                const fallbackStat = DataService.getDocStats(doc.id, username);
                const stat = madingStats[doc.id] || {
                  likes: fallbackStat.likes,
                  comments: fallbackStat.comments,
                  views: Math.max(fallbackStat.views, doc.views || 0),
                };

                const isHighlighted = highlightDocId === doc.id;

                return (
                  <article
                    id={`mading-card-${doc.id}`}
                    key={doc.id}
                    onClick={() => onOpenMadingReader(doc.id)}
                    className={`editorial-card p-6 bg-white dark:bg-[#141416] border ${
                      isHighlighted
                        ? 'border-blue-500 dark:border-blue-400 ring-2 ring-blue-500/30 shadow-md'
                        : 'border-stone-200/80 dark:border-stone-800'
                    } hover:bg-stone-50/50 dark:hover:bg-stone-900/60 cursor-pointer transition-all`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span
                        style={{ 
                          backgroundColor: topicColor.bg, 
                          color: topicColor.text,
                          borderColor: topicColor.border 
                        }}
                        className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full border"
                      >
                        {doc.topik || 'Karya'}
                      </span>
                      <span className="text-xs text-stone-400 dark:text-stone-500">
                        Oleh: <strong className="text-stone-800 dark:text-stone-200 font-semibold">{doc.nama}</strong>
                        {doc.namaKelas && (
                          <span className="ml-1.5 px-2 py-0.5 rounded-md bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 text-[10px] font-medium">
                            {doc.namaKelas}
                          </span>
                        )}
                        {doc.namaSekolah && (
                          <span className="ml-1.5 px-2 py-0.5 rounded-md bg-[#FAF4EB] dark:bg-[#282015] text-[#8F6533] dark:text-[#E2C7A7] text-[10px] font-medium border border-[#ECDDC8]/80 dark:border-[#3E3121]/80">
                            🏫 {doc.namaSekolah}
                          </span>
                        )}
                      </span>
                    </div>

                    <h4 className="text-xl font-bold font-serif-literary text-stone-900 dark:text-stone-100 mb-2 hover:text-blue-700 dark:hover:text-blue-400 transition-colors">
                      {cleanTitle(doc.judul)}
                    </h4>

                    <p className="font-serif-literary text-sm text-stone-600 dark:text-stone-300 line-clamp-3 mb-4 leading-relaxed">
                      {cleanSnippet(doc.teks)}
                    </p>

                    <div className="pt-3 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between text-xs text-stone-500 dark:text-stone-400">
                      <div className="flex gap-4">
                        <span className="flex items-center gap-1">
                          <Eye size={14} /> {stat.views}
                        </span>
                        <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                          <Heart size={14} /> {stat.likes}
                        </span>
                        <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                          <MessageSquare size={14} /> {stat.comments}
                        </span>
                      </div>

                      <span className="text-[11px] text-stone-400 dark:text-stone-500">
                        {doc.waktuPublishTeks ? `Dirilis: ${doc.waktuPublishTeks}` : ''}
                      </span>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal Buat Tulisan Baru */}
      {isNewDocOpen && (
        <div className="fixed inset-0 z-[10000] overflow-y-auto bg-stone-900/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150">
          <div className="min-h-full flex items-center justify-center py-6">
            <div className="editorial-card w-full max-w-md bg-white dark:bg-[#141416] p-5 sm:p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-stone-100 dark:border-stone-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 flex items-center justify-center shrink-0">
                  <Plus size={16} />
                </div>
                <div>
                  <h3 className="text-base font-bold font-serif-literary text-stone-900 dark:text-stone-100">
                    Mulai Menulis Naskah Baru
                  </h3>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400">
                    Pilih penugasan kelas atau tulis karya mandiri bebas.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsNewDocOpen(false);
                  setNewDocTitle('');
                  setSelectedTugasId('');
                  setSelectedTugasJudul('');
                }}
                className="p-1 rounded text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleCreateNewDoc();
              }}
              className="space-y-4 text-xs"
            >
              {penugasanList.length > 0 && (
                <div>
                  <label className="block font-semibold text-stone-700 dark:text-stone-300 mb-1">
                    Label Penugasan Kelas:
                  </label>
                  <select
                    value={selectedTugasId}
                    onChange={(e) => {
                      const tId = e.target.value;
                      setSelectedTugasId(tId);
                      const found = penugasanList.find((p) => p.id === tId);
                      setSelectedTugasJudul(found ? found.judul : '');
                    }}
                    className="editorial-input w-full px-3 py-2 text-xs bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-750 dark:text-stone-100 rounded-xl"
                  >
                    <option value="">✍️ Tulisan Bebas / Mandiri (Tanpa Tugas)</option>
                    {penugasanList.map((t) => (
                      <option key={t.id} value={t.id}>
                        📝 {t.judul}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {selectedTugasId && (() => {
                const cur = penugasanList.find((p) => p.id === selectedTugasId);
                if (!cur) return null;
                return (
                  <div className="p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/40 text-[11px] text-stone-700 dark:text-stone-300">
                    <p className="font-semibold text-blue-900 dark:text-blue-200 mb-1">
                      Instruksi Tugas: {cur.judul}
                    </p>
                    {cur.deskripsi && <p className="mb-1.5 leading-relaxed">{cur.deskripsi}</p>}
                    <div className="flex flex-wrap gap-2 text-[10px] text-stone-500 dark:text-stone-400">
                      {cur.topik && <span>• Kategori: {cur.topik}</span>}
                      {cur.targetKataMin && <span>• Target: Min. {cur.targetKataMin} kata</span>}
                      {cur.tenggatWaktu && <span>• Deadline: {cur.tenggatWaktu}</span>}
                    </div>
                  </div>
                );
              })()}

              <div>
                <label className="block font-semibold text-stone-700 dark:text-stone-300 mb-1">
                  Judul Tulisan / Naskah: <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newDocTitle}
                  onChange={(e) => setNewDocTitle(e.target.value)}
                  placeholder="Masukkan judul naskah..."
                  required
                  autoFocus
                  className="editorial-input w-full px-3 py-2 text-xs bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-750 dark:text-stone-100 rounded-xl focus:ring-2 focus:ring-stone-900 dark:focus:ring-stone-100"
                />
              </div>

              {/* Pilihan Mode Penulisan: Mandiri vs Kolaborasi */}
              <div>
                <label className="block font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
                  Mode Penulisan:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsCollabMode(false);
                      setSelectedCollabs([]);
                    }}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2.5 ${
                      !isCollabMode
                        ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-500 text-blue-900 dark:text-blue-200 ring-1 ring-blue-500/30'
                        : 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400 hover:border-stone-300'
                    }`}
                  >
                    <div className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-900/60 flex items-center justify-center text-blue-700 dark:text-blue-300 shrink-0">
                      <Feather size={13} />
                    </div>
                    <div>
                      <p className="font-bold text-[11px]">Mandiri</p>
                      <p className="text-[10px] opacity-75">Tulis sendiri</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsCollabMode(true)}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2.5 ${
                      isCollabMode
                        ? 'bg-purple-50/80 dark:bg-purple-950/40 border-purple-500 text-purple-900 dark:text-purple-200 ring-1 ring-purple-500/30'
                        : 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400 hover:border-stone-300'
                    }`}
                  >
                    <div className="w-6 h-6 rounded-lg bg-purple-100 dark:bg-purple-900/60 flex items-center justify-center text-purple-700 dark:text-purple-300 shrink-0">
                      <Users size={13} />
                    </div>
                    <div>
                      <p className="font-bold text-[11px]">Kolaborasi</p>
                      <p className="text-[10px] opacity-75">Bersama teman</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Bagian Pilih Teman jika Mode Kolaborasi */}
              {isCollabMode && (
                <div className="p-3 rounded-xl bg-purple-50/40 dark:bg-purple-950/20 border border-purple-200/70 dark:border-purple-900/40 space-y-2.5 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-purple-900 dark:text-purple-200 text-[11px] flex items-center gap-1.5">
                      <Users size={13} /> Pilih Teman Kolaborator ({selectedCollabs.length} / 3)
                    </span>
                    <span className="text-[10px] text-stone-400">
                      Total maks. 4 orang (kamu + 3 teman)
                    </span>
                  </div>

                  {/* Chips Teman yang Dipilih */}
                  {selectedCollabs.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {selectedCollabs.map((collab) => (
                        <span
                          key={collab.username}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] bg-white dark:bg-stone-900 border border-purple-300 dark:border-purple-800 text-purple-900 dark:text-purple-200 shadow-2xs font-medium"
                        >
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: collab.warna || stringToColor(collab.username) }}
                          />
                          {collab.nama}
                          <button
                            type="button"
                            onClick={() => setSelectedCollabs((prev) => prev.filter((c) => c.username !== collab.username))}
                            className="p-0.5 hover:text-red-600 rounded-full cursor-pointer ml-0.5"
                          >
                            <X size={11} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Pencarian dan Pemilihan Teman */}
                  {selectedCollabs.length < 3 && (
                    <div className="space-y-1.5">
                      <input
                        type="text"
                        placeholder="Cari nama teman sekelas..."
                        value={classmateSearch}
                        onChange={(e) => setClassmateSearch(e.target.value)}
                        className="editorial-input w-full px-2.5 py-1.5 text-xs bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-750 dark:text-stone-100 rounded-lg"
                      />

                      <div className="max-h-32 overflow-y-auto space-y-1 pr-1">
                        {classmates
                          .filter((cm) => {
                            if (selectedCollabs.some((c) => c.username === cm.username)) return false;
                            if (cm.username === username) return false;
                            if (!classmateSearch.trim()) return true;
                            const q = classmateSearch.toLowerCase();
                            return cm.nama.toLowerCase().includes(q) || cm.username.toLowerCase().includes(q);
                          })
                          .slice(0, 6)
                          .map((cm) => (
                            <div
                              key={cm.username}
                              onClick={() => {
                                if (selectedCollabs.length >= 3) return;
                                setSelectedCollabs((prev) => [
                                  ...prev,
                                  {
                                    username: cm.username,
                                    nama: cm.nama,
                                    warna: stringToColor(cm.username),
                                    waktuDitambahkan: getWaktuSekarang(),
                                  },
                                ]);
                              }}
                              className="p-1.5 rounded-lg bg-white/80 dark:bg-stone-900/80 hover:bg-purple-50 dark:hover:bg-purple-950/40 border border-stone-200/60 dark:border-stone-800 flex items-center justify-between transition-colors text-[11px] cursor-pointer"
                            >
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-5 h-5 rounded-full flex items-center justify-center font-bold text-white text-[9px]"
                                  style={{ backgroundColor: stringToColor(cm.username) }}
                                >
                                  {cm.nama.charAt(0).toUpperCase()}
                                </div>
                                <span className="font-medium text-stone-800 dark:text-stone-200">{cm.nama}</span>
                              </div>
                              <button
                                type="button"
                                className="editorial-btn bg-purple-100 hover:bg-purple-600 hover:text-white dark:bg-purple-950/60 dark:hover:bg-purple-600 text-purple-900 dark:text-purple-200 text-[10px] px-2 py-0.5 rounded cursor-pointer pointer-events-none"
                              >
                                + Pilih
                              </button>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  <p className="text-[10px] text-stone-500 dark:text-stone-400 italic">
                    * Kamu adalah pembuat naskah. Teman yang dipilih dapat menulis bersama secara langsung. Kolaborator juga bisa ditambah atau dikeluarkan kapan saja nanti.
                  </p>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 mt-4 border-t border-stone-100 dark:border-stone-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsNewDocOpen(false);
                    setNewDocTitle('');
                    setSelectedTugasId('');
                    setSelectedTugasJudul('');
                  }}
                  className="px-3 py-2 text-xs font-semibold text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-stone-900 hover:bg-stone-800 dark:bg-stone-800 dark:text-stone-100 dark:hover:bg-stone-700 dark:border dark:border-stone-700 rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  Mulai Menulis
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
      )}

      {/* Modal Hapus Draf */}
      <NeoModal
        isOpen={!!deleteDocId}
        title="Hapus Tugas?"
        description="Draf tugas ini akan dihapus permanen. Lanjutkan?"
        confirmText="Hapus"
        confirmColor="#DC2626"
        onConfirm={async () => {
          if (deleteDocId) {
            const targetId = deleteDocId;
            setDeleteDocId(null);
            setDokumenList((prev) => prev.filter((d) => d.id !== targetId));
            await DataService.hapusDokumen(targetId);
          }
        }}
        onCancel={() => setDeleteDocId(null)}
      />

      {/* Modal Publikasi ke Pojok Baca */}
      {publishDocId && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in">
          <div className="editorial-card w-full max-w-md my-auto max-h-[90dvh] overflow-y-auto bg-white dark:bg-[#141416] border border-stone-200/80 dark:border-stone-800 p-6 sm:p-7 text-center">
            <h2 className="text-xl font-bold font-serif-literary text-stone-900 dark:text-stone-100 mb-2 flex items-center justify-center gap-2">
              <BookOpen size={20} className="text-blue-600 dark:text-blue-400" /> Publikasikan ke Pojok Baca
            </h2>
            <p className="text-xs text-stone-600 dark:text-stone-300 mb-5">
              Pilih kategori tulisan untuk Pojok Baca:
            </p>

            <select
              value={publishTopic}
              onChange={(e) => setPublishTopic(e.target.value)}
              className="editorial-input w-full p-2.5 text-xs font-semibold mb-6 bg-white dark:bg-stone-900 dark:text-stone-100 dark:border-stone-700"
            >
              <option value="Cerpen">Cerpen</option>
              <option value="Puisi">Puisi</option>
              <option value="Esai">Esai</option>
              <option value="Artikel">Artikel</option>
              <option value="Resensi">Resensi</option>
              <option value="Lainnya">Lainnya</option>
            </select>

            <div className="flex gap-3">
              <button
                onClick={() => setPublishDocId(null)}
                className="editorial-btn flex-1 bg-stone-100 hover:bg-stone-200 text-stone-700 dark:bg-stone-800 dark:hover:bg-stone-700 dark:text-stone-300 py-2.5 text-xs cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmPublish}
                className="editorial-btn flex-1 bg-stone-900 hover:bg-stone-800 text-white dark:bg-blue-600 dark:hover:bg-blue-500 py-2.5 text-xs cursor-pointer shadow-xs"
              >
                Publikasikan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Klaim Karya Lama (Migrasi) */}
      {isRedeemModalOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in">
          <div className="editorial-card w-full max-w-lg my-auto bg-white dark:bg-[#141416] border border-stone-200/80 dark:border-stone-800 p-6 sm:p-7 max-h-[90vh] flex flex-col justify-between overflow-y-auto">
            <div>
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-stone-100 dark:border-stone-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 flex items-center justify-center shrink-0">
                    <KeyRound size={16} />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-bold font-serif-literary text-stone-900 dark:text-stone-100">
                      Klaim Karya Tulisan Lama
                    </h3>
                    <p className="text-[11px] text-stone-500 dark:text-stone-400">
                      Hubungkan arsip tulisanmu dari semester/aplikasi sebelumnya
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setIsRedeemModalOpen(false);
                    setRedeemFeedback(null);
                    setRedeemInput('');
                  }}
                  className="p-1.5 rounded-md text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {claimedRedeemInfo && !redeemFeedback?.success ? (
                <div className="py-2 animate-in fade-in duration-200">
                  <div className="bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4 mb-4 text-xs text-emerald-950 dark:text-emerald-200 leading-relaxed">
                    <div className="font-bold flex items-center gap-1.5 mb-1.5 text-emerald-800 dark:text-emerald-300">
                      <CheckCircle2 size={16} />
                      Arsip Karya Sudah Diklaim
                    </div>
                    <p className="mb-2">
                      Akunmu telah berhasil menghubungkan seluruh karya lama atas nama <strong>&quot;{claimedRedeemInfo.originalNama}&quot;</strong> (Kode: <code className="font-mono font-bold bg-white dark:bg-stone-900 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">{claimedRedeemInfo.kodeRedeem}</code>).
                    </p>
                    <div className="text-[11px] text-stone-600 dark:text-stone-300 bg-white/70 dark:bg-stone-900/60 p-2.5 rounded-lg border border-emerald-100 dark:border-emerald-900/40">
                      <p className="font-semibold text-stone-700 dark:text-stone-200 mb-0.5">ℹ️ Ketentuan Keamanan Klaim:</p>
                      Untuk mencegah klaim ganda, kamu tidak dapat memasukkan kode lain. Jika ada kesalahan atau kamu ingin membatalkan/mengganti kode ini, mintalah gurumu untuk <strong>mereset kode klaim</strong> di Dashboard Guru. Begitu dibatalkan oleh guru, opsi klaim akan terbuka kembali.
                    </div>
                  </div>

                  {claimedRedeemInfo.naskahList && claimedRedeemInfo.naskahList.length > 0 && (
                    <div className="mb-4 bg-stone-50 dark:bg-stone-900/60 rounded-xl p-3 border border-stone-200/70 dark:border-stone-800 max-h-52 overflow-y-auto">
                      <div className="text-[11px] font-semibold text-stone-500 dark:text-stone-400 mb-2 px-1 uppercase tracking-wider">
                        Daftar Naskah Arsip yang Terhubung ({claimedRedeemInfo.naskahList.length} Karya):
                      </div>
                      <div className="flex flex-col gap-2">
                        {claimedRedeemInfo.naskahList.map((doc, idx) => (
                          <div
                            key={doc.id || idx}
                            className="p-2.5 bg-white dark:bg-[#18181b] rounded-lg border border-stone-200/80 dark:border-stone-800/80 flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center gap-2 truncate pr-2">
                              <FileText size={14} className="text-stone-400 shrink-0" />
                              <span className="font-serif-literary font-semibold text-stone-800 dark:text-stone-200 truncate">
                                {cleanTitle(doc.judul)}
                              </span>
                            </div>
                            <span
                              className={`text-[10px] font-semibold px-2 py-0.5 rounded shrink-0 ${
                                doc.status === 'Selesai'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                  : doc.status === 'Terkumpul'
                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                              }`}
                            >
                              {doc.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsRedeemModalOpen(false);
                        setRedeemFeedback(null);
                        setRedeemInput('');
                      }}
                      className="editorial-btn w-full bg-stone-900 hover:bg-stone-800 text-white dark:bg-stone-800 dark:hover:bg-stone-700 dark:text-stone-100 dark:border dark:border-stone-700 py-2.5 text-xs font-bold cursor-pointer shadow-xs"
                    >
                      Tutup
                    </button>
                  </div>
                </div>
              ) : !redeemFeedback?.success ? (
                <div>
                  <div className="bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-800/50 rounded-xl p-3.5 mb-4 text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
                    <div className="font-semibold flex items-center gap-1.5 mb-1">
                      <Sparkles size={13} className="text-amber-600 dark:text-amber-400" />
                      Punya kode dari Guru?
                    </div>
                    Masukkan kode unik yang dibagikan gurumu. 1 kode otomatis memulihkan seluruh draf dan tugas yang pernah kamu buat sebelumnya ke akun ini.
                  </div>

                  <div className="mb-4">
                    <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
                      Kode Unik Klaim:
                    </label>
                    <input
                      type="text"
                      value={redeemInput}
                      onChange={(e) => setRedeemInput(e.target.value.toUpperCase())}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleKlaimRedeem();
                      }}
                      placeholder="CONTOH: NL-NAMA-XYZ"
                      className="editorial-input w-full p-3 font-mono tracking-wider font-bold text-center text-base sm:text-lg bg-stone-50 dark:bg-stone-900 dark:text-stone-100 dark:border-stone-700 focus:bg-white transition-colors"
                      autoFocus
                    />
                    <p className="text-[11px] text-stone-400 dark:text-stone-500 mt-1.5 text-center">
                      Format kode tidak sensitif huruf besar/kecil (contoh kode demo: <code className="bg-stone-100 dark:bg-stone-800 px-1 py-0.5 rounded text-[10px]">NL-DEMO-TEST</code>)
                    </p>
                  </div>

                  {redeemFeedback && !redeemFeedback.success && (
                    <div className="p-3 mb-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/80 text-xs text-red-700 dark:text-red-300 flex items-start gap-2 animate-in fade-in">
                      <AlertCircle size={15} className="shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
                      <span>{redeemFeedback.message}</span>
                    </div>
                  )}

                  <div className="flex gap-2.5 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsRedeemModalOpen(false);
                        setRedeemFeedback(null);
                        setRedeemInput('');
                      }}
                      className="editorial-btn flex-1 bg-stone-100 hover:bg-stone-200 text-stone-700 dark:bg-stone-800 dark:hover:bg-stone-700 dark:text-stone-300 py-2.5 text-xs font-medium cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      disabled={isRedeeming || !redeemInput.trim()}
                      onClick={handleKlaimRedeem}
                      className="editorial-btn flex-1 bg-stone-900 hover:bg-stone-800 disabled:opacity-50 disabled:cursor-not-allowed text-white dark:bg-stone-800 dark:hover:bg-stone-700 dark:text-stone-100 dark:border dark:border-stone-700 py-2.5 text-xs font-bold cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
                    >
                      {isRedeeming ? (
                        <>
                          <RefreshCw size={13} className="animate-spin" /> Menghubungkan...
                        </>
                      ) : (
                        <>
                          <KeyRound size={13} /> Klaim Karya Saya
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                /* Tampilan Berhasil (Tanpa Efek Confetti Sesuai Permintaan) */
                <div className="py-2 animate-in zoom-in-95 duration-200">
                  <div className="text-center mb-4">
                    <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center mb-2.5">
                      <CheckCircle2 size={24} />
                    </div>
                    <h4 className="font-serif-literary text-lg font-bold text-stone-900 dark:text-stone-100">
                      Klaim Berhasil!
                    </h4>
                    <p className="text-xs text-stone-600 dark:text-stone-300 mt-1">
                      {redeemFeedback.message}
                    </p>
                  </div>

                  {redeemFeedback.naskahList && redeemFeedback.naskahList.length > 0 && (
                    <div className="mb-4 bg-stone-50 dark:bg-stone-900/60 rounded-xl p-3 border border-stone-200/70 dark:border-stone-800 max-h-52 overflow-y-auto">
                      <div className="text-[11px] font-semibold text-stone-500 dark:text-stone-400 mb-2 px-1 uppercase tracking-wider">
                        Daftar Karya yang Berhasil Dipulihkan:
                      </div>
                      <div className="flex flex-col gap-2">
                        {redeemFeedback.naskahList.map((doc, idx) => (
                          <div
                            key={doc.id || idx}
                            className="p-2.5 bg-white dark:bg-[#18181b] rounded-lg border border-stone-200/80 dark:border-stone-800/80 flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center gap-2 truncate pr-2">
                              <FileText size={14} className="text-stone-400 shrink-0" />
                              <span className="font-serif-literary font-semibold text-stone-800 dark:text-stone-200 truncate">
                                {cleanTitle(doc.judul)}
                              </span>
                            </div>
                            <span
                              className={`text-[10px] font-semibold px-2 py-0.5 rounded shrink-0 ${
                                doc.status === 'Selesai'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                  : doc.status === 'Terkumpul'
                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                              }`}
                            >
                              {doc.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsRedeemModalOpen(false);
                        setRedeemFeedback(null);
                        setRedeemInput('');
                      }}
                      className="editorial-btn w-full bg-stone-900 hover:bg-stone-800 text-white dark:bg-stone-800 dark:hover:bg-stone-700 dark:text-stone-100 dark:border dark:border-stone-700 py-2.5 text-xs font-bold cursor-pointer shadow-xs"
                    >
                      Buka & Lihat di Tulisanku
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Pengaturan Akun Siswa (Ubah ID & Password) */}
      {isAccountModalOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="editorial-card w-full max-w-md bg-white dark:bg-[#141416] border border-stone-200/80 dark:border-stone-800 p-6 sm:p-7 overflow-y-auto">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-stone-100 dark:border-stone-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 flex items-center justify-center shrink-0">
                  <User size={16} />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold font-serif-literary text-stone-900 dark:text-stone-100">
                    Pengaturan Akun Siswa
                  </h3>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400">
                    Kelola ID (username) dan kata sandi akunmu
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsAccountModalOpen(false);
                  setAccountNotice(null);
                }}
                className="p-1.5 rounded-md text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {accountNotice && (
              <div
                className={`p-3 rounded-xl mb-4 text-xs flex items-start gap-2 animate-in fade-in ${
                  accountNotice.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                    : 'bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300 border border-red-200 dark:border-red-800'
                }`}
              >
                {accountNotice.type === 'success' ? (
                  <CheckCircle2 size={15} className="shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <AlertCircle size={15} className="shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
                )}
                <span>{accountNotice.text}</span>
              </div>
            )}

            <div className="space-y-4">
              {/* Nama Lengkap: Terkunci & Read-Only */}
              <div>
                <label className="flex items-center justify-between text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
                  <span>Nama Lengkap:</span>
                  <span className="text-[10px] text-amber-700 dark:text-amber-400 font-medium flex items-center gap-1 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-200/60 dark:border-amber-800/60">
                    <Lock size={10} /> Terkunci (Sesuai Presensi Guru)
                  </span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={nama}
                    disabled
                    readOnly
                    className="editorial-input w-full p-2.5 text-xs bg-stone-100 dark:bg-stone-900/80 text-stone-500 dark:text-stone-400 cursor-not-allowed border-stone-200 dark:border-stone-800 font-medium select-none"
                  />
                  <Lock size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400" />
                </div>
                <p className="text-[10px] text-stone-400 dark:text-stone-500 mt-1">
                  Nama lengkap tidak dapat diubah agar sinkron dengan daftar nilai dan presensi guru.
                </p>
              </div>

              {/* ID Akun / Username: Dapat diubah */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
                  ID Akun / Username Baru:
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-xs font-mono">
                    @
                  </span>
                  <input
                    type="text"
                    value={newUsernameInput}
                    onChange={(e) => setNewUsernameInput(e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                    placeholder="username_kamu"
                    className="editorial-input w-full pl-7 pr-3 py-2.5 text-xs font-mono bg-stone-50 dark:bg-stone-900 dark:text-stone-100 dark:border-stone-700 focus:bg-white"
                  />
                </div>
                <p className="text-[10px] text-stone-400 dark:text-stone-500 mt-1">
                  Gunakan huruf, angka, strip (-), atau garis bawah (_). Minimal 3 karakter.
                </p>
              </div>

              {/* Password Baru: Opsional */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
                  Kata Sandi Baru:
                </label>
                <input
                  type="password"
                  value={newPasswordInput}
                  onChange={(e) => setNewPasswordInput(e.target.value)}
                  placeholder="Kosongkan jika tidak ingin mengubah sandi"
                  className="editorial-input w-full p-2.5 text-xs bg-stone-50 dark:bg-stone-900 dark:text-stone-100 dark:border-stone-700 focus:bg-white"
                />
                <p className="text-[10px] text-stone-400 dark:text-stone-500 mt-1">
                  Isi hanya bila ingin memperbarui kata sandi (minimal 4 karakter).
                </p>
              </div>

              {/* Konfirmasi Password */}
              {newPasswordInput && (
                <div className="animate-in fade-in">
                  <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
                    Konfirmasi Kata Sandi Baru:
                  </label>
                  <input
                    type="password"
                    value={confirmPasswordInput}
                    onChange={(e) => setConfirmPasswordInput(e.target.value)}
                    placeholder="Ketik ulang kata sandi baru..."
                    className="editorial-input w-full p-2.5 text-xs bg-stone-50 dark:bg-stone-900 dark:text-stone-100 dark:border-stone-700 focus:bg-white"
                  />
                </div>
              )}
            </div>

            <div className="flex gap-2.5 pt-6 mt-4 border-t border-stone-100 dark:border-stone-800">
              <button
                type="button"
                onClick={() => {
                  setIsAccountModalOpen(false);
                  setAccountNotice(null);
                }}
                className="editorial-btn flex-1 bg-stone-100 hover:bg-stone-200 text-stone-700 dark:bg-stone-800 dark:hover:bg-stone-700 dark:text-stone-300 py-2.5 text-xs font-medium cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isUpdatingAccount || !newUsernameInput.trim()}
                onClick={handleSaveAccount}
                className="editorial-btn flex-1 bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white dark:bg-stone-800 dark:hover:bg-stone-700 dark:text-stone-100 dark:border dark:border-stone-700 py-2.5 text-xs font-bold cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
              >
                {isUpdatingAccount ? (
                  <>
                    <RefreshCw size={13} className="animate-spin" /> Menyimpan...
                  </>
                ) : (
                  'Simpan Perubahan'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Kelola Kolaborator Naskah */}
      <KelolaKolaboratorModal
        isOpen={Boolean(managingCollabDoc)}
        onClose={() => setManagingCollabDoc(null)}
        doc={managingCollabDoc}
        currentUsername={username}
        kodeKelas={kodeKelas}
        onSuccess={() => {
          if (managingCollabDoc) {
            DataService.getDokumenById(managingCollabDoc.id).then((updated) => {
              if (updated) setManagingCollabDoc(updated);
            });
          }
        }}
      />
    </div>
  );
};
