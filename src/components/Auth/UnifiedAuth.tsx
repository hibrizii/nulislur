import React, { useState, useRef } from 'react';
import { DataService } from '../../services/dataService';
import type { UserAccount } from '../../types';
import { Feather, ArrowRight, UserPlus, LogIn, Sparkles, KeyRound, AlertCircle } from 'lucide-react';
import { ThemeToggle } from '../Common/ThemeToggle';

interface UnifiedAuthProps {
  onAuthSuccess: (user: UserAccount) => void;
}

export const UnifiedAuth: React.FC<UnifiedAuthProps> = ({ onAuthSuccess }) => {
  const [mode, setMode] = useState<'masuk' | 'daftar'>('masuk');

  // State Form Masuk
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // State Form Daftar
  const [regNama, setRegNama] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regKodeKelas, setRegKodeKelas] = useState('');

  // Anti-Spam & Bot Protection: Honeypot & Rate Limiter
  const [honeypot, setHoneypot] = useState('');
  const formMountTimeRef = useRef<number>(Date.now());
  const regRateLimitRef = useRef<{ count: number; windowStart: number; blockedUntil: number }>({
    count: 0,
    windowStart: Date.now(),
    blockedUntil: 0,
  });

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginUsername.trim() || !loginPassword.trim()) {
      setErrorMsg('Harap lengkapi username dan kata sandi.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const res = await DataService.login(loginUsername.trim(), loginPassword.trim());
      if (res.success && res.user) {
        onAuthSuccess(res.user);
      } else {
        setErrorMsg(res.message || 'ID atau kata sandi tidak cocok.');
      }
    } catch {
      setErrorMsg('Gagal menghubungkan ke server. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Anti-Bot Honeypot trap: Bot otomatis mengisi input tersembunyi
    if (honeypot) {
      setErrorMsg('Aktivitas tidak wajar terdeteksi. Pendaftaran ditolak.');
      return;
    }

    // 2. Anti-Spam Submission Speed Gate: Pendaftaran manusia membutuhkan waktu mengetik minimal 1.5 detik
    if (Date.now() - formMountTimeRef.current < 1500) {
      setErrorMsg('Pengisian form terlalu cepat. Harap periksa kembali data Anda.');
      return;
    }

    // 3. Rate Limiter Cooldown: Maksimal 3 pendaftaran per menit dari sesi yang sama
    const now = Date.now();
    const rate = regRateLimitRef.current;
    if (now < rate.blockedUntil) {
      const remainingSeconds = Math.ceil((rate.blockedUntil - now) / 1000);
      setErrorMsg(`Terlalu banyak percobaan pendaftaran. Harap tunggu ${remainingSeconds} detik.`);
      return;
    }

    if (now - rate.windowStart > 60000) {
      rate.count = 0;
      rate.windowStart = now;
    }

    rate.count += 1;
    if (rate.count > 3) {
      rate.blockedUntil = now + 45000; // Blokir selama 45 detik
      setErrorMsg('Terlalu banyak percobaan pendaftaran dalam waktu singkat. Harap tunggu 45 detik.');
      return;
    }

    // 4. Validasi & Sanitasi Input Ketat
    const cleanNama = regNama.replace(/<[^>]*>/g, '').trim();
    const cleanUsername = regUsername.trim().toLowerCase();
    const cleanKodeKelas = regKodeKelas.trim().toLowerCase();

    if (!cleanNama || !cleanUsername || !regPassword || !cleanKodeKelas) {
      setErrorMsg('Semua kolom pendaftaran wajib diisi.');
      return;
    }

    if (cleanNama.length < 2 || cleanNama.length > 60) {
      setErrorMsg('Nama lengkap harus terdiri dari 2 hingga 60 karakter.');
      return;
    }

    // Format username: hanya huruf kecil, angka, titik, underscore, strip (3-30 karakter)
    const usernameRegex = /^[a-z0-9_.-]{3,30}$/;
    if (!usernameRegex.test(cleanUsername)) {
      setErrorMsg('Username hanya boleh berisi huruf kecil, angka, titik, underscore, atau strip (3-30 karakter).');
      return;
    }

    if (regPassword.length < 4) {
      setErrorMsg('Kata sandi minimal 4 karakter.');
      return;
    }

    const kodeKelasRegex = /^[a-z0-9_-]{3,20}$/;
    if (!kodeKelasRegex.test(cleanKodeKelas)) {
      setErrorMsg('Format kode kelas tidak valid.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const res = await DataService.registerStudent(
        cleanNama,
        cleanUsername,
        regPassword,
        cleanKodeKelas
      );
      if (res.success && res.user) {
        onAuthSuccess(res.user);
      } else {
        setErrorMsg(res.message || 'Pendaftaran gagal. Periksa kembali data Anda.');
      }
    } catch {
      setErrorMsg('Terjadi kesalahan saat mendaftar. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 bg-[#FAF9F6] dark:bg-[#0c0a09] relative transition-colors duration-200">
      {/* Minimalist Theme Toggle at Top Right */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
        <ThemeToggle className="border border-stone-200 dark:border-stone-800 bg-white/80 dark:bg-stone-900/80 shadow-xs" />
      </div>

      {/* Brand Header */}
      <div className="text-center mb-8">
        <div className="w-12 h-12 bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 rounded-2xl mx-auto flex items-center justify-center mb-3 shadow-md">
          <Feather size={24} />
        </div>
        <h1 className="text-3xl font-black font-serif-literary text-stone-900 dark:text-stone-100 tracking-tight">
          NulisLur
        </h1>
      </div>

      {/* Auth Card */}
      <div className="editorial-card w-full max-w-md bg-white dark:bg-[#141416] border border-stone-200/80 dark:border-stone-800 p-6 sm:p-8">
        {/* Tab Toggle: Masuk vs Daftar */}
        <div className="flex bg-stone-100 dark:bg-stone-800/80 p-1 rounded-xl mb-6">
          <button
            type="button"
            onClick={() => {
              setMode('masuk');
              setErrorMsg('');
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              mode === 'masuk'
                ? 'bg-white text-stone-900 shadow-sm dark:bg-[#18181B] dark:text-stone-100'
                : 'text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100'
            }`}
          >
            <LogIn size={14} /> Masuk
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('daftar');
              setErrorMsg('');
              formMountTimeRef.current = Date.now();
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              mode === 'daftar'
                ? 'bg-white text-stone-900 shadow-sm dark:bg-[#18181B] dark:text-stone-100'
                : 'text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100'
            }`}
          >
            <UserPlus size={14} /> Daftar
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-xl text-xs font-medium mb-5 flex items-center gap-2">
            <AlertCircle size={15} className="shrink-0 text-red-600 dark:text-red-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {mode === 'masuk' ? (
          /* TAB 1: MASUK */
          <form onSubmit={handleLogin} autoComplete="off" className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
                ID PENGGUNA / USERNAME
              </label>
              <input
                type="text"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                placeholder="Username..."
                autoComplete="off"
                className="editorial-input w-full p-3 bg-white dark:bg-[#18181B] text-stone-900 dark:text-stone-100 border border-stone-200 dark:border-stone-700/80 focus:border-stone-900 dark:focus:border-stone-300 dark:placeholder-stone-500"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
                KATA SANDI
              </label>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                className="editorial-input w-full p-3 bg-white dark:bg-[#18181B] text-stone-900 dark:text-stone-100 border border-stone-200 dark:border-stone-700/80 focus:border-stone-900 dark:focus:border-stone-300 dark:placeholder-stone-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="editorial-btn bg-stone-900 hover:bg-stone-800 text-white dark:bg-stone-100 dark:hover:bg-stone-200 dark:text-stone-900 py-3.5 mt-2 text-sm font-semibold cursor-pointer shadow-xs"
            >
              {loading ? 'Memeriksa...' : 'Masuk'} <ArrowRight size={16} />
            </button>

            <div className="mt-4 pt-4 border-t border-stone-100 dark:border-stone-800 text-center">
              <span className="text-xs text-stone-500 dark:text-stone-400">
                Belum punya akun?{' '}
                <button
                  type="button"
                  onClick={() => setMode('daftar')}
                  className="font-bold text-stone-900 dark:text-stone-100 underline underline-offset-2 cursor-pointer hover:text-stone-700 dark:hover:text-stone-300"
                >
                  Daftar di sini
                </button>
              </span>
            </div>
          </form>
        ) : (
          /* TAB 2: DAFTAR */
          <form onSubmit={handleRegister} autoComplete="off" className="flex flex-col gap-3.5">
            {/* Honeypot anti-bot trap (tidak terlihat oleh manusia, menjebak bot spammer) */}
            <div style={{ display: 'none', position: 'absolute', left: '-9999px', opacity: 0 }} aria-hidden="true">
              <label htmlFor="hp_website">Website</label>
              <input
                id="hp_website"
                type="text"
                name="website_profile"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
                tabIndex={-1}
                autoComplete="off"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                NAMA LENGKAP
              </label>
              <input
                type="text"
                value={regNama}
                onChange={(e) => setRegNama(e.target.value)}
                placeholder="Nama lengkap..."
                autoComplete="off"
                className="editorial-input w-full p-2.5 bg-white dark:bg-[#18181B] text-stone-900 dark:text-stone-100 border border-stone-200 dark:border-stone-700/80 focus:border-stone-900 dark:focus:border-stone-300 dark:placeholder-stone-500"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                USERNAME (NISN / HURUF KECIL)
              </label>
              <input
                type="text"
                value={regUsername}
                onChange={(e) => setRegUsername(e.target.value)}
                placeholder="Username..."
                autoComplete="off"
                className="editorial-input w-full p-2.5 bg-white dark:bg-[#18181B] text-stone-900 dark:text-stone-100 border border-stone-200 dark:border-stone-700/80 focus:border-stone-900 dark:focus:border-stone-300 dark:placeholder-stone-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                KATA SANDI
              </label>
              <input
                type="password"
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                placeholder="Minimal 3 karakter"
                autoComplete="new-password"
                className="editorial-input w-full p-2.5 bg-white dark:bg-[#18181B] text-stone-900 dark:text-stone-100 border border-stone-200 dark:border-stone-700/80 focus:border-stone-900 dark:focus:border-stone-300 dark:placeholder-stone-500"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-bold text-stone-800 dark:text-stone-200">
                  KODE KELAS
                </label>
                <span className="text-[11px] text-stone-600 dark:text-stone-400 flex items-center gap-1 font-semibold">
                  <KeyRound size={12} className="text-stone-700 dark:text-stone-400" /> Wajib diisi
                </span>
              </div>
              <input
                type="text"
                value={regKodeKelas}
                onChange={(e) => setRegKodeKelas(e.target.value.toLowerCase())}
                placeholder="Masukkan kode kelas dari guru..."
                autoComplete="off"
                className="editorial-input w-full p-2.5 font-mono tracking-wider font-bold bg-stone-50 dark:bg-[#18181B] border-stone-300 dark:border-stone-700 focus:border-stone-800 dark:focus:border-stone-300 dark:text-stone-100"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="editorial-btn bg-stone-900 hover:bg-stone-800 text-white dark:bg-stone-100 dark:hover:bg-stone-200 dark:text-stone-900 py-3.5 mt-2 text-sm font-semibold cursor-pointer shadow-xs"
            >
              {loading ? 'Mendaftarkan...' : 'Daftar Akun'} <Sparkles size={16} />
            </button>
          </form>
        )}
      </div>

      <div className="mt-8 text-xs text-stone-500 dark:text-stone-500 font-medium">
        © 2026 NulisLur
      </div>
    </div>
  );
};
