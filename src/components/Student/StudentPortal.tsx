import React, { useState, useEffect, useRef } from 'react';
import { StudentLobi } from './StudentLobi';
import { StudentEditorView } from './StudentEditorView';
import { StudentMadingReader } from './StudentMadingReader';
import { AntiCheatOverlay } from '../Common/AntiCheatOverlay';
import { DataService } from '../../services/dataService';
import { School, AlertCircle } from 'lucide-react';
import type { UserAccount } from '../../types';
import { LogoutConfirmationModal } from '../Common/LogoutConfirmationModal';

interface StudentPortalProps {
  user: UserAccount;
  onLogout: () => void;
}

export const StudentPortal: React.FC<StudentPortalProps> = ({ user, onLogout }) => {
  const [currentStudentUser, setCurrentStudentUser] = useState<UserAccount>(user);
  const [activeView, setActiveView] = useState<'lobi' | 'editor' | 'reader'>('lobi');
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [lobiTab, setLobiTab] = useState<'karya' | 'perkembangan' | 'mading' | 'cuitan'>('karya');
  const [highlightMadingDocId, setHighlightMadingDocId] = useState<string | null>(null);
  const [masterTracking, setMasterTracking] = useState<boolean>(true);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState<boolean>(false);

  // Status Kelas & Modal Belum Ada Kelas
  const [isNoClassModalOpen, setIsNoClassModalOpen] = useState<boolean>(false);
  const [inputClassCode, setInputClassCode] = useState<string>('');
  const [joinError, setJoinError] = useState<string>('');
  const [isJoining, setIsJoining] = useState<boolean>(false);

  const cleanupPresenceRef = useRef<(() => void) | null>(null);

  // Verifikasi apakah kelas siswa masih aktif atau sudah terhapus
  useEffect(() => {
    let isMounted = true;
    DataService.cekStatusKelas(currentStudentUser.kodeKelas).then((isActive) => {
      if (isMounted && !isActive) {
        setIsNoClassModalOpen(true);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [currentStudentUser.kodeKelas]);

  // Setup Kehadiran saat siswa aktif (Bebas dari algoritma kicked paksa)
  useEffect(() => {
    const sessionId = Date.now().toString();
    const cleanup = DataService.setupKehadiran(
      currentStudentUser.username,
      currentStudentUser.nama,
      currentStudentUser.kodeKelas,
      sessionId
    );

    cleanupPresenceRef.current = cleanup;

    return () => {
      if (cleanupPresenceRef.current) {
        cleanupPresenceRef.current();
        cleanupPresenceRef.current = null;
      }
    };
  }, [currentStudentUser]);

  // Dengarkan master setting deteksi tab dari guru
  useEffect(() => {
    const unsub = DataService.listenTrackingAktif((aktif) => {
      setMasterTracking(aktif);
    });
    return () => unsub();
  }, []);

  // Pastikan status aktivitas diperbarui saat siswa kembali ke lobi
  useEffect(() => {
    if (activeView === 'lobi') {
      DataService.updateAktivitas(currentStudentUser.username, 'Beranda', null);
    }
  }, [activeView, currentStudentUser.username]);

  // Matikan klik kanan untuk seluruh area portal siswa demi menjaga integritas menulis
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };
    window.addEventListener('contextmenu', handleContextMenu);
    return () => {
      window.removeEventListener('contextmenu', handleContextMenu);
    };
  }, []);

  const handleJoinNewClass = async () => {
    if (!inputClassCode.trim()) {
      setJoinError('Harap masukkan kode kelas.');
      return;
    }
    setIsJoining(true);
    setJoinError('');
    const res = await DataService.gabungKelasSiswa(currentStudentUser.username, inputClassCode.trim());
    setIsJoining(false);

    if (res.success && res.kelas) {
      const updatedUser: UserAccount = {
        ...currentStudentUser,
        kodeKelas: res.kelas.kodeKelas,
        namaKelas: res.kelas.namaKelas,
      };
      setCurrentStudentUser(updatedUser);
      sessionStorage.setItem('nulislur_session', JSON.stringify(updatedUser));
      localStorage.setItem('nulislur_session', JSON.stringify(updatedUser));
      setIsNoClassModalOpen(false);
      setInputClassCode('');
      alert(`Berhasil bergabung ke ${res.kelas.namaKelas}! Draf naskah tulisan Anda telah otomatis ditautkan ke kelas ini.`);
    } else {
      setJoinError(res.message);
    }
  };

  const handleLogout = () => {
    if (cleanupPresenceRef.current) {
      cleanupPresenceRef.current();
      cleanupPresenceRef.current = null;
    }
    onLogout();
  };

  const handleBackToLobby = React.useCallback(() => {
    setActiveView('lobi');
    setActiveDocId(null);
  }, []);

  return (
    <div
      onContextMenu={(e) => e.preventDefault()}
      className="min-h-screen bg-[#FAF9F6] dark:bg-[#0c0a09] text-stone-900 dark:text-stone-100 flex flex-col justify-between select-none sm:select-auto transition-colors duration-200"
    >
      {/* Sensor Kehilangan Fokus Layar Siswa (Aktif di seluruh area saat login) */}
      <AntiCheatOverlay
        active={masterTracking}
        onViolation={(_alasan) => {
          DataService.catatPelanggaran(currentStudentUser.username, activeDocId || undefined, currentStudentUser.nama);
        }}
        onDismiss={() => DataService.pulihkanFokus(currentStudentUser.username)}
      />

      {activeView === 'lobi' && (
        <StudentLobi
          nama={currentStudentUser.nama}
          username={currentStudentUser.username}
          kodeKelas={currentStudentUser.kodeKelas}
          namaKelas={currentStudentUser.namaKelas}
          initialTab={lobiTab}
          onTabChange={(tab) => {
            setLobiTab(tab);
            if (tab !== 'mading') setHighlightMadingDocId(null);
          }}
          highlightDocId={highlightMadingDocId}
          onOpenEditor={(docId) => {
            setActiveDocId(docId);
            setActiveView('editor');
          }}
          onOpenMadingReader={(docId) => {
            setLobiTab('mading');
            setHighlightMadingDocId(docId);
            setActiveDocId(docId);
            setActiveView('reader');
          }}
          onLogout={() => setIsLogoutModalOpen(true)}
          onUserUpdate={(updatedUser) => {
            setCurrentStudentUser(updatedUser);
            sessionStorage.setItem('nulislur_session', JSON.stringify(updatedUser));
            localStorage.setItem('nulislur_session', JSON.stringify(updatedUser));
          }}
        />
      )}

      {activeView === 'editor' && activeDocId && (
        <StudentEditorView
          docId={activeDocId}
          namaSiswa={currentStudentUser.nama}
          username={currentStudentUser.username}
          onBackToLobby={handleBackToLobby}
        />
      )}

      {activeView === 'reader' && activeDocId && (
        <StudentMadingReader
          docId={activeDocId}
          namaSiswa={currentStudentUser.nama}
          username={currentStudentUser.username}
          onBack={handleBackToLobby}
        />
      )}

      {/* Modal Siswa Belum Terdaftar di Kelas (atau Kelas Dihapus) */}
      {isNoClassModalOpen && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="editorial-card w-full max-w-md bg-white dark:bg-stone-900 p-7 text-center shadow-2xl border border-stone-200 dark:border-stone-800">
            <div className="w-14 h-14 bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <School size={28} />
            </div>
            <h3 className="text-xl font-bold font-serif-literary text-stone-900 dark:text-stone-100 mb-2">
              Kamu Belum Masuk Kelas Manapun
            </h3>
            <p className="text-xs text-stone-600 dark:text-stone-400 mb-5 leading-relaxed">
              Kelas Anda sebelumnya tidak lagi aktif atau Anda belum terdaftar di kelas. Masukkan kode kelas dari guru Anda untuk mulai atau melanjutkan menulis. Draf tulisan Anda tetap tersimpan dengan aman.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleJoinNewClass();
              }}
              className="text-left mb-4"
            >
              <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider mb-1.5">
                KODE KELAS
              </label>
              <input
                type="text"
                value={inputClassCode}
                onChange={(e) => {
                  setInputClassCode(e.target.value.toLowerCase());
                  setJoinError('');
                }}
                placeholder="Contoh: a7b9k2"
                className="editorial-input w-full p-2.5 text-sm font-mono tracking-wider font-bold bg-stone-50 dark:bg-stone-800 focus:bg-white dark:focus:bg-stone-900 dark:text-stone-100 lowercase"
                autoFocus
              />
              {joinError && (
                <div className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400 font-medium mt-2">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{joinError}</span>
                </div>
              )}

              <div className="flex gap-2.5 mt-5">
                <button
                  type="button"
                  onClick={() => setIsLogoutModalOpen(true)}
                  className="editorial-btn bg-stone-100 hover:bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700 text-xs py-2.5 px-4 cursor-pointer"
                >
                  Keluar Akun
                </button>
                <button
                  type="submit"
                  disabled={isJoining}
                  className="editorial-btn flex-1 bg-stone-900 hover:bg-stone-800 text-white dark:bg-stone-800 dark:hover:bg-stone-700 dark:text-stone-100 dark:border dark:border-stone-700 text-xs py-2.5 font-semibold cursor-pointer"
                >
                  {isJoining ? 'Menghubungkan...' : 'Gabung Kelas'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Logout Siswa */}
      <LogoutConfirmationModal
        isOpen={isLogoutModalOpen}
        onCancel={() => setIsLogoutModalOpen(false)}
        onConfirm={handleLogout}
        role="siswa"
      />

      <footer className="py-6 text-center text-xs text-stone-400 font-medium">
        © 2026 NulisLur
      </footer>
    </div>
  );
};
