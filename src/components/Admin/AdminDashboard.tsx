import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Building2,
  Users,
  Shield,
  Plus,
  KeyRound,
  Check,
  X,
  RefreshCw,
  LogOut,
  CheckCircle2,
  AlertCircle,
  Edit,
  Trash2,
  Search,
  Sparkles,
  Sliders,
  Database,
  Globe,
  Radio,
  FileText,
  School,
  UserCheck,
  ArrowLeft
} from 'lucide-react';
import { DataService } from '../../services/dataService';
import type { UserAccount, Sekolah, FiturPaketSekolah } from '../../types';
import { ThemeToggle } from '../Common/ThemeToggle';
import { NeoModal } from '../Common/NeoModal';

interface AdminDashboardProps {
  user: UserAccount;
  onLogout: () => void;
  onBackToTeacher?: () => void;
}

const TIER_PRESETS: Record<'free' | 'starter' | 'pro' | 'enterprise', FiturPaketSekolah> = {
  free: {
    kolaborasi: false,
    cuitan: false,
    antiCurang: true,
    eksporResmi: false,
    maxKelas: 3,
    maxSiswaPerKelas: 36,
  },
  starter: {
    kolaborasi: true,
    cuitan: false,
    antiCurang: true,
    eksporResmi: true,
    maxKelas: 6,
    maxSiswaPerKelas: 40,
  },
  pro: {
    kolaborasi: true,
    cuitan: true,
    antiCurang: true,
    eksporResmi: true,
    maxKelas: 15,
    maxSiswaPerKelas: 45,
  },
  enterprise: {
    kolaborasi: true,
    cuitan: true,
    antiCurang: true,
    eksporResmi: true,
    maxKelas: 999,
    maxSiswaPerKelas: 100,
  },
};

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ user, onLogout, onBackToTeacher }) => {
  const [activeTab, setActiveTab] = useState<'sekolah' | 'guru' | 'platform'>('sekolah');
  const [sekolahList, setSekolahList] = useState<Sekolah[]>([]);
  const [guruList, setGuruList] = useState<UserAccount[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Platform stats
  const [stats, setStats] = useState({
    totalSekolah: 0,
    totalGuru: 0,
    totalSiswa: 0,
    totalDokumen: 0,
    totalCuitan: 0,
  });

  // State Modal Tambah / Edit Sekolah
  const [isSekolahModalOpen, setIsSekolahModalOpen] = useState(false);
  const [editingSekolah, setEditingSekolah] = useState<Sekolah | null>(null);
  const [sekolahFormId, setSekolahFormId] = useState('');
  const [sekolahFormNama, setSekolahFormNama] = useState('');
  const [sekolahFormNpsn, setSekolahFormNpsn] = useState('');
  const [sekolahFormJenjang, setSekolahFormJenjang] = useState<'SMA' | 'SMK' | 'MA' | 'SMP' | 'SD' | 'Umum'>('SMA');
  const [sekolahFormPaket, setSekolahFormPaket] = useState<'free' | 'starter' | 'pro' | 'enterprise'>('pro');
  const [sekolahFormStatus, setSekolahFormStatus] = useState<'aktif' | 'nonaktif'>('aktif');
  const [sekolahFormFitur, setSekolahFormFitur] = useState<FiturPaketSekolah>(TIER_PRESETS.pro);
  const [isSavingSekolah, setIsSavingSekolah] = useState(false);

  // State Modal Tambah Guru
  const [isGuruModalOpen, setIsGuruModalOpen] = useState(false);
  const [guruFormNama, setGuruFormNama] = useState('');
  const [guruFormUser, setGuruFormUser] = useState('');
  const [guruFormPass, setGuruFormPass] = useState('');
  const [guruFormSekolahId, setGuruFormSekolahId] = useState('');
  const [isSavingGuru, setIsSavingGuru] = useState(false);

  // State Modal Reset Password Guru
  const [resetPassTarget, setResetPassTarget] = useState<UserAccount | null>(null);
  const [newPassInput, setNewPassInput] = useState('');
  const [isResettingPass, setIsResettingPass] = useState(false);

  // State Modal Ubah Sekolah Guru
  const [editGuruSekolahTarget, setEditGuruSekolahTarget] = useState<UserAccount | null>(null);
  const [newSekolahIdForGuru, setNewSekolahIdForGuru] = useState('');
  const [isChangingGuruSekolah, setIsChangingGuruSekolah] = useState(false);

  // State Konfirmasi Hapus Sekolah
  const [deleteSekolahTarget, setDeleteSekolahTarget] = useState<Sekolah | null>(null);

  // Filter Guru
  const [guruSearch, setGuruSearch] = useState('');
  const [guruFilterSekolah, setGuruFilterSekolah] = useState('semua');

  // Load all initial data
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [listSekolah, listGuru, platformStats] = await Promise.all([
        DataService.getDaftarSekolah(),
        DataService.getSemuaGuru(),
        DataService.getPlatformStats(),
      ]);
      setSekolahList(listSekolah);
      setGuruList(listGuru);
      setStats(platformStats);
    } catch (e) {
      console.error('Gagal memuat data admin:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const unsubSekolah = DataService.listenSekolah((list) => {
      setSekolahList(list);
    });
    return () => unsubSekolah();
  }, [fetchData]);

  const showToast = (type: 'success' | 'error', text: string) => {
    setNotice({ type, text });
    setTimeout(() => setNotice(null), 4000);
  };

  // Open Edit Sekolah Modal
  const handleOpenEditSekolah = (sekolah: Sekolah) => {
    setEditingSekolah(sekolah);
    setSekolahFormId(sekolah.id);
    setSekolahFormNama(sekolah.namaSekolah);
    setSekolahFormNpsn(sekolah.npsn || '');
    setSekolahFormJenjang(sekolah.jenjang || 'SMA');
    setSekolahFormPaket(sekolah.paket);
    setSekolahFormStatus(sekolah.status);
    setSekolahFormFitur({ ...sekolah.fitur });
    setIsSekolahModalOpen(true);
  };

  // Open New Sekolah Modal
  const handleOpenNewSekolah = () => {
    setEditingSekolah(null);
    setSekolahFormId('');
    setSekolahFormNama('');
    setSekolahFormNpsn('');
    setSekolahFormJenjang('SMA');
    setSekolahFormPaket('pro');
    setSekolahFormStatus('aktif');
    setSekolahFormFitur({ ...TIER_PRESETS.pro });
    setIsSekolahModalOpen(true);
  };

  // Apply Tier Preset to Form
  const handleApplyTierPreset = (tier: 'free' | 'starter' | 'pro' | 'enterprise') => {
    setSekolahFormPaket(tier);
    setSekolahFormFitur({ ...TIER_PRESETS[tier] });
  };

  // Save Sekolah (Create or Update)
  const handleSaveSekolah = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = (sekolahFormId || sekolahFormNama.toLowerCase().replace(/[^a-z0-9]/g, '-')).trim();
    const cleanNama = sekolahFormNama.trim();

    if (!cleanId || !cleanNama) {
      showToast('error', 'ID dan Nama Sekolah wajib diisi.');
      return;
    }

    setIsSavingSekolah(true);
    try {
      const sekolahPayload: Sekolah = {
        id: cleanId,
        namaSekolah: cleanNama,
        npsn: sekolahFormNpsn.trim() || undefined,
        jenjang: sekolahFormJenjang,
        paket: sekolahFormPaket,
        status: sekolahFormStatus,
        fitur: sekolahFormFitur,
        waktuDaftar: editingSekolah ? editingSekolah.waktuDaftar : new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }),
      };

      const res = await DataService.simpanSekolah(sekolahPayload);
      if (res.success) {
        showToast('success', res.message);
        setIsSekolahModalOpen(false);
        fetchData();
      } else {
        showToast('error', res.message);
      }
    } catch {
      showToast('error', 'Terjadi kesalahan saat menyimpan sekolah.');
    } finally {
      setIsSavingSekolah(false);
    }
  };

  // Delete Sekolah
  const handleDeleteSekolah = async () => {
    if (!deleteSekolahTarget) return;
    try {
      const res = await DataService.hapusSekolah(deleteSekolahTarget.id);
      if (res.success) {
        showToast('success', res.message);
        setDeleteSekolahTarget(null);
        fetchData();
      } else {
        showToast('error', res.message);
      }
    } catch {
      showToast('error', 'Gagal menghapus sekolah.');
    }
  };

  // Save Guru Account
  const handleSaveGuru = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guruFormNama.trim() || !guruFormUser.trim() || !guruFormPass.trim()) {
      showToast('error', 'Semua bidang wajib diisi.');
      return;
    }

    const targetSekolah = sekolahList.find((s) => s.id === guruFormSekolahId) || sekolahList[0];
    const sId = targetSekolah ? targetSekolah.id : 'sman1-gondanglegi';
    const sNama = targetSekolah ? targetSekolah.namaSekolah : 'SMA Negeri 1 Gondanglegi';

    setIsSavingGuru(true);
    try {
      const res = await DataService.tambahAkunGuru(
        guruFormNama.trim(),
        guruFormUser.trim(),
        guruFormPass.trim(),
        sId,
        sNama
      );
      if (res.success) {
        showToast('success', res.message);
        setIsGuruModalOpen(false);
        setGuruFormNama('');
        setGuruFormUser('');
        setGuruFormPass('');
        fetchData();
      } else {
        showToast('error', res.message);
      }
    } catch {
      showToast('error', 'Gagal menambahkan akun guru.');
    } finally {
      setIsSavingGuru(false);
    }
  };

  // Reset Guru Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPassTarget || !newPassInput.trim()) {
      showToast('error', 'Masukkan kata sandi baru.');
      return;
    }

    setIsResettingPass(true);
    try {
      const res = await DataService.resetPasswordUser(resetPassTarget.username, newPassInput.trim());
      if (res.success) {
        showToast('success', res.message);
        setResetPassTarget(null);
        setNewPassInput('');
      } else {
        showToast('error', res.message);
      }
    } catch {
      showToast('error', 'Gagal mereset kata sandi.');
    } finally {
      setIsResettingPass(false);
    }
  };

  // Change Guru School
  const handleChangeGuruSekolah = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editGuruSekolahTarget || !newSekolahIdForGuru) return;
    const targetSekolah = sekolahList.find((s) => s.id === newSekolahIdForGuru);
    if (!targetSekolah) return;

    setIsChangingGuruSekolah(true);
    try {
      const res = await DataService.ubahSekolahGuru(
        editGuruSekolahTarget.username,
        targetSekolah.id,
        targetSekolah.namaSekolah
      );
      if (res.success) {
        showToast('success', res.message);
        setEditGuruSekolahTarget(null);
        fetchData();
      } else {
        showToast('error', res.message);
      }
    } catch (err: any) {
      showToast('error', err?.message || 'Gagal mengubah sekolah guru.');
    } finally {
      setIsChangingGuruSekolah(false);
    }
  };

  // Filtered Guru List
  const filteredGuruList = useMemo(() => {
    return guruList.filter((g) => {
      const matchSearch =
        !guruSearch ||
        g.nama.toLowerCase().includes(guruSearch.toLowerCase()) ||
        g.username.toLowerCase().includes(guruSearch.toLowerCase());
      const matchSekolah =
        guruFilterSekolah === 'semua' ||
        g.sekolahId === guruFilterSekolah ||
        (!g.sekolahId && guruFilterSekolah === 'sman1-gondanglegi');
      return matchSearch && matchSekolah;
    });
  }, [guruList, guruSearch, guruFilterSekolah]);

  const getTierBadge = (tier: string) => {
    switch (tier) {
      case 'enterprise':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800';
      case 'pro':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800';
      case 'starter':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800';
      default:
        return 'bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300 border-stone-200 dark:border-stone-700';
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9F6] dark:bg-[#0c0a09] text-stone-900 dark:text-stone-100 flex flex-col transition-colors duration-200">
      {/* Top Banner Notice */}
      {notice && (
        <div
          className={`fixed top-4 right-4 z-[99999] px-4 py-3 rounded-xl shadow-lg border flex items-center gap-2.5 text-xs font-semibold animate-in fade-in slide-in-from-top-2 duration-200 ${
            notice.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-800'
              : 'bg-red-50 text-red-900 border-red-200 dark:bg-red-950 dark:text-red-200 dark:border-red-800'
          }`}
        >
          {notice.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{notice.text}</span>
        </div>
      )}

      {/* Header Admin */}
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-[#141416]/90 backdrop-blur-md border-b border-stone-200/80 dark:border-stone-800 px-4 sm:px-6 py-3.5 transition-colors">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 flex items-center justify-center font-serif-literary font-black text-lg shadow-sm">
              N
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-serif-literary font-bold text-base sm:text-lg tracking-tight">
                  NulisLur
                </h1>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 shadow-2xs">
                  Admin Panel
                </span>
              </div>
              <p className="text-[11px] text-stone-500 dark:text-stone-400">
                Pusat Kontrol Multi-Sekolah, Akun Guru & Lisensi Fitur
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {onBackToTeacher && (
              <button
                onClick={onBackToTeacher}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 hover:bg-stone-800 dark:hover:bg-stone-200 flex items-center gap-1.5 shadow-xs cursor-pointer transition-all"
                title="Kembali ke Dashboard Guru"
              >
                <ArrowLeft size={13} />
                <span>Kembali ke Guru</span>
              </button>
            )}

            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-stone-100 dark:bg-stone-800 text-xs text-stone-700 dark:text-stone-300 font-medium">
              <Shield size={14} className="text-amber-600 dark:text-amber-400" />
              <span>{user.nama || 'Administrator'} (@{user.username})</span>
            </div>

            <ThemeToggle />

            <button
              onClick={onLogout}
              className="p-2 sm:px-3 sm:py-1.5 rounded-xl text-xs font-semibold bg-stone-100 hover:bg-stone-200 dark:bg-stone-850 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Keluar dari Admin Panel"
            >
              <LogOut size={14} />
              <span className="hidden sm:inline">Keluar</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto w-full flex-1 p-4 sm:p-6 flex flex-col gap-6">
        {/* Navigation Tabs */}
        <div className="flex items-center justify-between border-b border-stone-200/80 dark:border-stone-800 pb-3 flex-wrap gap-3">
          <div className="flex items-center gap-1.5 bg-stone-100 dark:bg-stone-900 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('sekolah')}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'sekolah'
                  ? 'bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
              }`}
            >
              <School size={15} />
              <span>Manajemen Sekolah & Lisensi</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-stone-200 dark:bg-stone-700 font-bold">
                {sekolahList.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('guru')}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'guru'
                  ? 'bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
              }`}
            >
              <Users size={15} />
              <span>Akun Guru</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-stone-200 dark:bg-stone-700 font-bold">
                {guruList.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('platform')}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'platform'
                  ? 'bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
              }`}
            >
              <Database size={15} />
              <span>Ringkasan Platform</span>
            </button>
          </div>

          <button
            onClick={fetchData}
            disabled={isLoading}
            className="p-2 text-xs font-medium text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors"
            title="Muat Ulang Data"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Segarkan</span>
          </button>
        </div>

        {/* TAB 1: MANAJEMEN SEKOLAH & FITUR PRICING */}
        {activeTab === 'sekolah' && (
          <div className="flex flex-col gap-5 animate-in fade-in duration-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold font-serif-literary text-stone-900 dark:text-stone-100">
                  Daftar Sekolah & Konfigurasi Fitur
                </h2>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Atur isolasi data dan aktifkan fitur premium (kolaborasi, cuitan, anti-curang) per instansi.
                </p>
              </div>
              <button
                onClick={handleOpenNewSekolah}
                className="px-4 py-2.5 rounded-xl bg-stone-900 text-white hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-200 text-xs font-semibold flex items-center justify-center gap-2 shadow-xs cursor-pointer transition-all shrink-0"
              >
                <Plus size={15} />
                <span>Tambah Sekolah Baru</span>
              </button>
            </div>

            {sekolahList.length === 0 ? (
              <div className="editorial-card p-12 text-center bg-white dark:bg-[#141416] border border-dashed border-stone-300 dark:border-stone-700">
                <Building2 size={32} className="mx-auto text-stone-400 mb-2 opacity-60" />
                <p className="text-sm font-semibold text-stone-700 dark:text-stone-300">
                  Belum ada sekolah terdaftar.
                </p>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
                  Klik tombol &quot;Tambah Sekolah Baru&quot; di atas untuk mulai menambahkan instansi.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {sekolahList.map((sekolah) => {
                  const f = sekolah.fitur;
                  return (
                    <div
                      key={sekolah.id}
                      className="editorial-card bg-white dark:bg-[#141416] border border-stone-200/80 dark:border-stone-800 p-5 rounded-2xl flex flex-col justify-between shadow-xs hover:border-stone-300 dark:hover:border-stone-700 transition-all"
                    >
                      <div>
                        {/* Header Kartu Sekolah */}
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span
                                className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${getTierBadge(
                                  sekolah.paket
                                )}`}
                              >
                                Paket {sekolah.paket}
                              </span>
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300">
                                {sekolah.jenjang || 'SMA'}
                              </span>
                              <span
                                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                  sekolah.status === 'aktif'
                                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                                    : 'bg-stone-100 dark:bg-stone-800 text-stone-400'
                                }`}
                              >
                                {sekolah.status === 'aktif' ? '● Aktif' : '○ Non-aktif'}
                              </span>
                            </div>
                            <h3 className="font-serif-literary font-bold text-base text-stone-900 dark:text-stone-100 truncate">
                              {sekolah.namaSekolah}
                            </h3>
                            <div className="flex items-center gap-2 text-[11px] text-stone-400 dark:text-stone-500 font-mono mt-0.5">
                              <span>ID: {sekolah.id}</span>
                              {sekolah.npsn && <span>• NPSN: {sekolah.npsn}</span>}
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => handleOpenEditSekolah(sekolah)}
                              className="p-1.5 rounded-lg text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
                              title="Ubah Lisensi & Fitur"
                            >
                              <Edit size={15} />
                            </button>
                            {sekolah.id !== 'sman1-gondanglegi' && (
                              <button
                                onClick={() => setDeleteSekolahTarget(sekolah)}
                                className="p-1.5 rounded-lg text-stone-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                                title="Hapus Sekolah"
                              >
                                <Trash2 size={15} />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Matriks Fitur Aktif */}
                        <div className="grid grid-cols-2 gap-2 my-3 p-3 rounded-xl bg-stone-50 dark:bg-[#18181A] border border-stone-100 dark:border-stone-850 text-xs">
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-2 h-2 rounded-full ${
                                f.kolaborasi ? 'bg-emerald-500' : 'bg-stone-300 dark:bg-stone-700'
                              }`}
                            />
                            <span className="text-[11px] text-stone-600 dark:text-stone-400">
                              Kolaborasi Real-time: <strong>{f.kolaborasi ? 'ON' : 'OFF'}</strong>
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <div
                              className={`w-2 h-2 rounded-full ${
                                f.cuitan ? 'bg-emerald-500' : 'bg-stone-300 dark:bg-stone-700'
                              }`}
                            />
                            <span className="text-[11px] text-stone-600 dark:text-stone-400">
                              Cuitan Sekolah: <strong>{f.cuitan ? 'ON' : 'OFF'}</strong>
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <div
                              className={`w-2 h-2 rounded-full ${
                                f.antiCurang ? 'bg-emerald-500' : 'bg-stone-300 dark:bg-stone-700'
                              }`}
                            />
                            <span className="text-[11px] text-stone-600 dark:text-stone-400">
                              Sensor Anti-Curang: <strong>{f.antiCurang ? 'ON' : 'OFF'}</strong>
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <div
                              className={`w-2 h-2 rounded-full ${
                                f.eksporResmi ? 'bg-emerald-500' : 'bg-stone-300 dark:bg-stone-700'
                              }`}
                            />
                            <span className="text-[11px] text-stone-600 dark:text-stone-400">
                              Ekspor Resmi DOCX/PDF: <strong>{f.eksporResmi ? 'ON' : 'OFF'}</strong>
                            </span>
                          </div>
                        </div>

                        {/* Limit Kuota */}
                        <div className="flex items-center justify-between text-[11px] text-stone-500 dark:text-stone-400 px-1">
                          <span>Kuota Maksimal: <strong>{f.maxKelas} Kelas</strong></span>
                          <span>Batas Siswa: <strong>{f.maxSiswaPerKelas} Siswa/Kelas</strong></span>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between text-[11px] text-stone-400 dark:text-stone-500">
                        <span>Terdaftar: {sekolah.waktuDaftar}</span>
                        <button
                          onClick={() => handleOpenEditSekolah(sekolah)}
                          className="text-stone-800 dark:text-stone-200 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Sliders size={12} />
                          <span>Atur Paket & Fitur</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: MANAJEMEN AKUN GURU */}
        {activeTab === 'guru' && (
          <div className="flex flex-col gap-5 animate-in fade-in duration-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold font-serif-literary text-stone-900 dark:text-stone-100">
                  Daftar Akun Guru
                </h2>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Kelola hak akses pengajar di setiap sekolah serta reset kata sandi jika guru lupa akses.
                </p>
              </div>

              <button
                onClick={() => {
                  setGuruFormNama('');
                  setGuruFormUser('');
                  setGuruFormPass('guru123');
                  setGuruFormSekolahId(sekolahList[0]?.id || 'sman1-gondanglegi');
                  setIsGuruModalOpen(true);
                }}
                className="px-4 py-2.5 rounded-xl bg-stone-900 text-white hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-200 text-xs font-semibold flex items-center justify-center gap-2 shadow-xs cursor-pointer transition-all shrink-0"
              >
                <Plus size={15} />
                <span>Tambah Akun Guru</span>
              </button>
            </div>

            {/* Filter Search & Dropdown Sekolah */}
            <div className="flex flex-col sm:flex-row items-center gap-2.5">
              <div className="relative flex-1 w-full">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                <input
                  type="text"
                  value={guruSearch}
                  onChange={(e) => setGuruSearch(e.target.value)}
                  placeholder="Cari nama guru atau @username..."
                  className="editorial-input w-full pl-8.5 pr-8 py-2 text-xs bg-white dark:bg-[#141416] text-stone-900 dark:text-stone-100 border border-stone-200/80 dark:border-stone-800 rounded-xl"
                />
                {guruSearch && (
                  <button
                    onClick={() => setGuruSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 cursor-pointer"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              <select
                value={guruFilterSekolah}
                onChange={(e) => setGuruFilterSekolah(e.target.value)}
                className="editorial-input px-3 py-2 text-xs bg-white dark:bg-[#141416] text-stone-900 dark:text-stone-100 border border-stone-200/80 dark:border-stone-800 rounded-xl w-full sm:w-auto"
              >
                <option value="semua">Semua Sekolah ({guruList.length})</option>
                {sekolahList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.namaSekolah}
                  </option>
                ))}
              </select>
            </div>

            {/* Tabel Guru */}
            <div className="editorial-card bg-white dark:bg-[#141416] border border-stone-200/80 dark:border-stone-800 rounded-2xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-stone-50 dark:bg-stone-900/60 border-b border-stone-200/80 dark:border-stone-800 text-stone-500 dark:text-stone-400 uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-3 px-4">Nama Lengkap & User</th>
                      <th className="py-3 px-4">Instansi Sekolah</th>
                      <th className="py-3 px-4">Hak Akses</th>
                      <th className="py-3 px-4 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 dark:divide-stone-850">
                    {filteredGuruList.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-stone-400 text-xs">
                          Tidak ada akun guru yang sesuai dengan pencarian atau filter.
                        </td>
                      </tr>
                    ) : (
                      filteredGuruList.map((guru) => (
                        <tr
                          key={guru.username}
                          className="hover:bg-stone-50/70 dark:hover:bg-stone-850/50 transition-colors"
                        >
                          <td className="py-3 px-4">
                            <div className="font-semibold text-stone-900 dark:text-stone-100">
                              {guru.nama}
                            </div>
                            <div className="text-[11px] text-stone-400 dark:text-stone-500 font-mono">
                              @{guru.username}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-stone-700 dark:text-stone-300">
                              {guru.namaSekolah || 'SMA Negeri 1 Gondanglegi'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                guru.role === 'admin'
                                  ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300'
                                  : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                              }`}
                            >
                              {guru.role}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => {
                                  setEditGuruSekolahTarget(guru);
                                  setNewSekolahIdForGuru(guru.sekolahId || (sekolahList[0]?.id || 'sman1-gondanglegi'));
                                }}
                                className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200 transition-colors cursor-pointer inline-flex items-center gap-1"
                                title="Pindahkan / Tetapkan Sekolah Guru"
                              >
                                <Building2 size={12} />
                                <span>Ubah Sekolah</span>
                              </button>
                              <button
                                onClick={() => {
                                  setResetPassTarget(guru);
                                  setNewPassInput('guru123');
                                }}
                                className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200 transition-colors cursor-pointer inline-flex items-center gap-1"
                                title="Reset Kata Sandi"
                              >
                                <KeyRound size={12} />
                                <span>Reset Sandi</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: RINGKASAN PLATFORM & MULTI-SEKOLAH */}
        {activeTab === 'platform' && (
          <div className="flex flex-col gap-6 animate-in fade-in duration-200">
            <div>
              <h2 className="text-xl font-bold font-serif-literary text-stone-900 dark:text-stone-100">
                Ringkasan & Metrik Ekosistem Platform
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Statistik real-time, status integritas arsitektur multi-sekolah, dan kuota database.
              </p>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
              <div className="editorial-card p-4 bg-white dark:bg-[#141416] border border-stone-200/80 dark:border-stone-800 rounded-2xl shadow-xs">
                <div className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <Building2 size={13} />
                  <span>Sekolah</span>
                </div>
                <div className="text-2xl font-bold font-serif-literary text-stone-900 dark:text-stone-100">
                  {stats.totalSekolah}
                </div>
                <span className="text-[10px] text-stone-500">Instansi terdaftar</span>
              </div>

              <div className="editorial-card p-4 bg-white dark:bg-[#141416] border border-stone-200/80 dark:border-stone-800 rounded-2xl shadow-xs">
                <div className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <UserCheck size={13} />
                  <span>Guru</span>
                </div>
                <div className="text-2xl font-bold font-serif-literary text-stone-900 dark:text-stone-100">
                  {stats.totalGuru}
                </div>
                <span className="text-[10px] text-stone-500">Pengajar terdaftar</span>
              </div>

              <div className="editorial-card p-4 bg-white dark:bg-[#141416] border border-stone-200/80 dark:border-stone-800 rounded-2xl shadow-xs">
                <div className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <Users size={13} />
                  <span>Siswa</span>
                </div>
                <div className="text-2xl font-bold font-serif-literary text-stone-900 dark:text-stone-100">
                  {stats.totalSiswa}
                </div>
                <span className="text-[10px] text-stone-500">Pelajar aktif</span>
              </div>

              <div className="editorial-card p-4 bg-white dark:bg-[#141416] border border-stone-200/80 dark:border-stone-800 rounded-2xl shadow-xs">
                <div className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <FileText size={13} />
                  <span>Naskah</span>
                </div>
                <div className="text-2xl font-bold font-serif-literary text-stone-900 dark:text-stone-100">
                  {stats.totalDokumen}
                </div>
                <span className="text-[10px] text-stone-500">Karya tulisan</span>
              </div>

              <div className="editorial-card p-4 bg-white dark:bg-[#141416] border border-stone-200/80 dark:border-stone-800 rounded-2xl shadow-xs">
                <div className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <Sparkles size={13} />
                  <span>Cuitan</span>
                </div>
                <div className="text-2xl font-bold font-serif-literary text-stone-900 dark:text-stone-100">
                  {stats.totalCuitan}
                </div>
                <span className="text-[10px] text-stone-500">Linimasa literasi</span>
              </div>
            </div>

            {/* Architecture Explainer Card */}
            <div className="editorial-card p-6 bg-white dark:bg-[#141416] border border-stone-200/80 dark:border-stone-800 rounded-2xl shadow-xs flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <Shield className="text-amber-600 dark:text-amber-400" size={18} />
                <h3 className="font-serif-literary font-bold text-base text-stone-900 dark:text-stone-100">
                  Skema Isolasi Multi-Sekolah NulisLur
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                <div className="p-4 rounded-xl bg-stone-50 dark:bg-[#18181A] border border-stone-100 dark:border-stone-850">
                  <div className="flex items-center gap-2 font-bold text-xs text-stone-800 dark:text-stone-200 mb-1">
                    <Radio size={14} className="text-amber-600" />
                    <span>Woro-woro (Siaran)</span>
                  </div>
                  <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 mb-2">
                    🔒 Terisolasi 100%
                  </span>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400 leading-relaxed">
                    Pengumuman siaran guru hanya dapat dibaca oleh siswa dari sekolah yang sama (<code className="font-mono text-[10px]">sekolahId</code>).
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-stone-50 dark:bg-[#18181A] border border-stone-100 dark:border-stone-850">
                  <div className="flex items-center gap-2 font-bold text-xs text-stone-800 dark:text-stone-200 mb-1">
                    <Sparkles size={14} className="text-blue-600" />
                    <span>Linimasa Cuitan</span>
                  </div>
                  <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 mb-2">
                    🔒 Terisolasi 100%
                  </span>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400 leading-relaxed">
                    Cuitan dan komentar siswa menjadi ruang sosial privat intra-sekolah tanpa campur aduk siswa sekolah lain.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-stone-50 dark:bg-[#18181A] border border-stone-100 dark:border-stone-850">
                  <div className="flex items-center gap-2 font-bold text-xs text-stone-800 dark:text-stone-200 mb-1">
                    <Globe size={14} className="text-emerald-600" />
                    <span>Pojok Baca (Mading)</span>
                  </div>
                  <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 mb-2">
                    🌐 Terbuka Lintas Sekolah
                  </span>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400 leading-relaxed">
                    Karya yang telah disetujui guru dapat dibaca oleh siswa seluruh Indonesia, lengkap dengan badge identitas asal sekolah.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MODAL TAMBAH / EDIT SEKOLAH & FITUR */}
      {isSekolahModalOpen && (
        <div className="fixed inset-0 z-[10000] overflow-y-auto bg-stone-900/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150">
          <div className="min-h-full flex items-center justify-center py-6">
            <div className="editorial-card w-full max-w-lg bg-white dark:bg-[#141416] p-6 rounded-2xl shadow-2xl border border-stone-200/80 dark:border-stone-800 flex flex-col gap-5">
              <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-stone-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 flex items-center justify-center shrink-0">
                    <Building2 size={16} />
                  </div>
                  <div>
                    <h3 className="font-serif-literary font-bold text-base text-stone-900 dark:text-stone-100">
                      {editingSekolah ? 'Edit Sekolah & Lisensi Fitur' : 'Tambah Sekolah Baru'}
                    </h3>
                    <p className="text-[11px] text-stone-500 dark:text-stone-400">
                      Konfigurasikan paket dan fitur premium yang dapat diakses sekolah ini.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsSekolahModalOpen(false)}
                  className="p-1.5 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 cursor-pointer rounded-lg"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveSekolah} className="flex flex-col gap-4 text-xs">
                {/* ID & Nama */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-stone-700 dark:text-stone-300 mb-1">
                      ID Sekolah (Slug): <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={sekolahFormId}
                      onChange={(e) => setSekolahFormId(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                      disabled={Boolean(editingSekolah)}
                      placeholder="misal: sman1-gondanglegi"
                      required
                      className="editorial-input w-full px-3 py-2 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-750 rounded-xl disabled:opacity-60"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-stone-700 dark:text-stone-300 mb-1">
                      NPSN (Opsional):
                    </label>
                    <input
                      type="text"
                      value={sekolahFormNpsn}
                      onChange={(e) => setSekolahFormNpsn(e.target.value)}
                      placeholder="misal: 20517743"
                      className="editorial-input w-full px-3 py-2 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-750 rounded-xl"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-stone-700 dark:text-stone-300 mb-1">
                    Nama Lengkap Instansi: <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={sekolahFormNama}
                    onChange={(e) => setSekolahFormNama(e.target.value)}
                    placeholder="misal: SMA Negeri 1 Gondanglegi"
                    required
                    className="editorial-input w-full px-3 py-2 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-750 rounded-xl"
                  />
                </div>

                {/* Jenjang & Status */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-stone-700 dark:text-stone-300 mb-1">
                      Jenjang:
                    </label>
                    <select
                      value={sekolahFormJenjang}
                      onChange={(e) => setSekolahFormJenjang(e.target.value as any)}
                      className="editorial-input w-full px-3 py-2 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-750 rounded-xl"
                    >
                      <option value="SMA">SMA</option>
                      <option value="SMK">SMK</option>
                      <option value="MA">MA</option>
                      <option value="SMP">SMP</option>
                      <option value="SD">SD</option>
                      <option value="Umum">Umum / Komunitas</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-stone-700 dark:text-stone-300 mb-1">
                      Status Akses:
                    </label>
                    <select
                      value={sekolahFormStatus}
                      onChange={(e) => setSekolahFormStatus(e.target.value as any)}
                      className="editorial-input w-full px-3 py-2 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-750 rounded-xl"
                    >
                      <option value="aktif">Aktif (Dapat Login)</option>
                      <option value="nonaktif">Non-aktif (Dibekukan)</option>
                    </select>
                  </div>
                </div>

                {/* Template Tier Presets */}
                <div className="pt-2 border-t border-stone-100 dark:border-stone-800">
                  <label className="block font-semibold text-stone-700 dark:text-stone-300 mb-1.5 flex items-center justify-between">
                    <span>Pilihan Paket Lisensi (Tier):</span>
                    <span className="text-[10px] text-stone-400 font-normal">Klik untuk mengisi fitur otomatis</span>
                  </label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {(['free', 'starter', 'pro', 'enterprise'] as const).map((tier) => (
                      <button
                        key={tier}
                        type="button"
                        onClick={() => handleApplyTierPreset(tier)}
                        className={`py-1.5 px-2 rounded-lg text-[11px] font-bold uppercase tracking-wider border text-center transition-all cursor-pointer ${
                          sekolahFormPaket === tier
                            ? 'bg-stone-900 text-white border-stone-900 dark:bg-stone-100 dark:text-stone-900 dark:border-stone-100 shadow-xs'
                            : 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400 hover:border-stone-300'
                        }`}
                      >
                        {tier}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Saklar Fitur (Toggles) */}
                <div className="p-3.5 rounded-xl bg-stone-50 dark:bg-stone-900/60 border border-stone-200/80 dark:border-stone-800 flex flex-col gap-2.5">
                  <div className="text-[11px] font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider mb-0.5">
                    Konfigurasi Fitur Premium:
                  </div>

                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-stone-700 dark:text-stone-300">⚡ Kolaborasi Multi-Siswa Real-time</span>
                    <input
                      type="checkbox"
                      checked={sekolahFormFitur.kolaborasi}
                      onChange={(e) =>
                        setSekolahFormFitur({ ...sekolahFormFitur, kolaborasi: e.target.checked })
                      }
                      className="w-4 h-4 rounded text-stone-900 focus:ring-0 cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-stone-700 dark:text-stone-300">💬 Linimasa Cuitan Literasi Sekolah</span>
                    <input
                      type="checkbox"
                      checked={sekolahFormFitur.cuitan}
                      onChange={(e) =>
                        setSekolahFormFitur({ ...sekolahFormFitur, cuitan: e.target.checked })
                      }
                      className="w-4 h-4 rounded text-stone-900 focus:ring-0 cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-stone-700 dark:text-stone-300">🛡️ Sensor Anti-Curang & Pelanggaran</span>
                    <input
                      type="checkbox"
                      checked={sekolahFormFitur.antiCurang}
                      onChange={(e) =>
                        setSekolahFormFitur({ ...sekolahFormFitur, antiCurang: e.target.checked })
                      }
                      className="w-4 h-4 rounded text-stone-900 focus:ring-0 cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-stone-700 dark:text-stone-300">📄 Ekspor Dokumen Resmi (DOCX/PDF)</span>
                    <input
                      type="checkbox"
                      checked={sekolahFormFitur.eksporResmi}
                      onChange={(e) =>
                        setSekolahFormFitur({ ...sekolahFormFitur, eksporResmi: e.target.checked })
                      }
                      className="w-4 h-4 rounded text-stone-900 focus:ring-0 cursor-pointer"
                    />
                  </label>
                </div>

                {/* Kuota Angka */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-stone-700 dark:text-stone-300 mb-1">
                      Maksimal Kelas:
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={999}
                      value={sekolahFormFitur.maxKelas}
                      onChange={(e) =>
                        setSekolahFormFitur({ ...sekolahFormFitur, maxKelas: Number(e.target.value) || 1 })
                      }
                      className="editorial-input w-full px-3 py-2 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-750 rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-stone-700 dark:text-stone-300 mb-1">
                      Maksimal Siswa / Kelas:
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={200}
                      value={sekolahFormFitur.maxSiswaPerKelas}
                      onChange={(e) =>
                        setSekolahFormFitur({
                          ...sekolahFormFitur,
                          maxSiswaPerKelas: Number(e.target.value) || 1,
                        })
                      }
                      className="editorial-input w-full px-3 py-2 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-750 rounded-xl"
                    />
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100 dark:border-stone-800">
                  <button
                    type="button"
                    onClick={() => setIsSekolahModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 font-semibold cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingSekolah}
                    className="px-5 py-2 rounded-xl bg-stone-900 text-white hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-200 font-semibold flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    <Check size={14} />
                    <span>{isSavingSekolah ? 'Menyimpan...' : 'Simpan Sekolah'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL TAMBAH AKUN GURU */}
      {isGuruModalOpen && (
        <div className="fixed inset-0 z-[10000] overflow-y-auto bg-stone-900/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150">
          <div className="min-h-full flex items-center justify-center py-6">
            <div className="editorial-card w-full max-w-md bg-white dark:bg-[#141416] p-6 rounded-2xl shadow-2xl border border-stone-200/80 dark:border-stone-800 flex flex-col gap-5">
              <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-stone-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 flex items-center justify-center shrink-0">
                    <UserCheck size={16} />
                  </div>
                  <div>
                    <h3 className="font-serif-literary font-bold text-base text-stone-900 dark:text-stone-100">
                      Tambah Akun Guru
                    </h3>
                    <p className="text-[11px] text-stone-500 dark:text-stone-400">
                      Buat akun pengajar baru dan tautkan ke instansi sekolah.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsGuruModalOpen(false)}
                  className="p-1.5 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 cursor-pointer rounded-lg"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveGuru} className="flex flex-col gap-3.5 text-xs">
                <div>
                  <label className="block font-semibold text-stone-700 dark:text-stone-300 mb-1">
                    Nama Lengkap Guru (dengan Gelar): <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={guruFormNama}
                    onChange={(e) => setGuruFormNama(e.target.value)}
                    placeholder="misal: Siti Nurhaliza, S.Pd."
                    required
                    autoFocus
                    className="editorial-input w-full px-3 py-2 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-750 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-stone-700 dark:text-stone-300 mb-1">
                    Username Login: <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={guruFormUser}
                    onChange={(e) => setGuruFormUser(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    placeholder="misal: bu_siti"
                    required
                    className="editorial-input w-full px-3 py-2 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-750 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-stone-700 dark:text-stone-300 mb-1">
                    Kata Sandi Awal: <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={guruFormPass}
                    onChange={(e) => setGuruFormPass(e.target.value)}
                    placeholder="misal: guru123"
                    required
                    className="editorial-input w-full px-3 py-2 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-750 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-stone-700 dark:text-stone-300 mb-1">
                    Tautkan ke Sekolah: <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={guruFormSekolahId}
                    onChange={(e) => setGuruFormSekolahId(e.target.value)}
                    className="editorial-input w-full px-3 py-2 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-750 rounded-xl"
                  >
                    {sekolahList.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.namaSekolah} ({s.id})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100 dark:border-stone-800">
                  <button
                    type="button"
                    onClick={() => setIsGuruModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 font-semibold cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingGuru}
                    className="px-5 py-2 rounded-xl bg-stone-900 text-white hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-200 font-semibold flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    <Check size={14} />
                    <span>{isSavingGuru ? 'Menyimpan...' : 'Buat Akun Guru'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL RESET PASSWORD GURU */}
      {resetPassTarget && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="editorial-card w-full max-w-sm bg-white dark:bg-[#141416] p-5 rounded-2xl shadow-2xl border border-stone-200/80 dark:border-stone-800 flex flex-col gap-4">
            <div className="flex items-center justify-between pb-2 border-b border-stone-100 dark:border-stone-800">
              <div className="flex items-center gap-2">
                <KeyRound size={16} className="text-amber-600 dark:text-amber-400" />
                <h3 className="font-serif-literary font-bold text-sm text-stone-900 dark:text-stone-100">
                  Reset Sandi Guru
                </h3>
              </div>
              <button
                onClick={() => setResetPassTarget(null)}
                className="p-1 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-stone-600 dark:text-stone-400">
              Setel kata sandi baru untuk <strong>{resetPassTarget.nama}</strong> (@{resetPassTarget.username}):
            </p>

            <form onSubmit={handleResetPassword} className="flex flex-col gap-3 text-xs">
              <input
                type="text"
                value={newPassInput}
                onChange={(e) => setNewPassInput(e.target.value)}
                placeholder="Kata sandi baru..."
                required
                autoFocus
                className="editorial-input w-full px-3 py-2 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-750 rounded-xl"
              />

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResetPassTarget(null)}
                  className="px-3 py-1.5 rounded-lg text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isResettingPass}
                  className="px-4 py-1.5 rounded-lg bg-stone-900 text-white hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-200 font-semibold flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
                >
                  <span>{isResettingPass ? 'Menyimpan...' : 'Reset Sandi'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL UBAH SEKOLAH GURU */}
      {editGuruSekolahTarget && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="editorial-card w-full max-w-sm bg-white dark:bg-[#141416] p-5 rounded-2xl shadow-2xl border border-stone-200/80 dark:border-stone-800 flex flex-col gap-4">
            <div className="flex items-center justify-between pb-2 border-b border-stone-100 dark:border-stone-800">
              <div className="flex items-center gap-2">
                <Building2 size={16} className="text-amber-600 dark:text-amber-400" />
                <h3 className="font-serif-literary font-bold text-sm text-stone-900 dark:text-stone-100">
                  Pindahkan Sekolah Guru
                </h3>
              </div>
              <button
                onClick={() => setEditGuruSekolahTarget(null)}
                className="p-1 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-stone-600 dark:text-stone-400">
              Pilih instansi sekolah untuk guru <strong>{editGuruSekolahTarget.nama}</strong> (@{editGuruSekolahTarget.username}):
            </p>

            <form onSubmit={handleChangeGuruSekolah} className="flex flex-col gap-3.5 text-xs">
              <div>
                <label className="block font-semibold text-stone-700 dark:text-stone-300 mb-1">
                  Instansi Sekolah:
                </label>
                <select
                  value={newSekolahIdForGuru}
                  onChange={(e) => setNewSekolahIdForGuru(e.target.value)}
                  className="editorial-input w-full px-3 py-2 bg-stone-50 dark:bg-stone-900 text-stone-900 dark:text-stone-100 border border-stone-200 dark:border-stone-750 rounded-xl"
                >
                  {sekolahList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.namaSekolah} ({s.id})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100 dark:border-stone-800">
                <button
                  type="button"
                  onClick={() => setEditGuruSekolahTarget(null)}
                  className="px-3 py-1.5 rounded-lg text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isChangingGuruSekolah}
                  className="px-4 py-1.5 rounded-lg bg-stone-900 text-white hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-200 font-semibold flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
                >
                  <Check size={13} />
                  <span>{isChangingGuruSekolah ? 'Menyimpan...' : 'Simpan Perubahan'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM MODAL HAPUS SEKOLAH */}
      <NeoModal
        isOpen={Boolean(deleteSekolahTarget)}
        title="Hapus Instansi Sekolah?"
        description={`Apakah Anda yakin ingin menghapus sekolah "${deleteSekolahTarget?.namaSekolah}"? Sekolah yang dihapus tidak akan dapat mengakses fitur NulisLur.`}
        confirmText="Ya, Hapus Sekolah"
        cancelText="Batal"
        confirmColor="#DC2626"
        onConfirm={handleDeleteSekolah}
        onCancel={() => setDeleteSekolahTarget(null)}
      />
    </div>
  );
};
