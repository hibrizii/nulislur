import { useState, useEffect, lazy, Suspense } from 'react';
import { UnifiedAuth } from './components/Auth/UnifiedAuth';
import { ErrorBoundary } from './components/Common/ErrorBoundary';
import { DataService } from './services/dataService';
import type { UserAccount } from './types';

// Optimalisasi Code-Splitting: Unduh modul Portal Siswa & Dashboard Guru secara dinamis (On-Demand)
const StudentPortal = lazy(() =>
  import('./components/Student/StudentPortal').then((m) => ({ default: m.StudentPortal }))
);
const TeacherDashboard = lazy(() =>
  import('./components/Teacher/TeacherDashboard').then((m) => ({ default: m.TeacherDashboard }))
);
const AdminDashboard = lazy(() =>
  import('./components/Admin/AdminDashboard').then((m) => ({ default: m.AdminDashboard }))
);

const ViewLoadingFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-stone-50 dark:bg-stone-950 text-stone-500 dark:text-stone-400">
    <div className="flex flex-col items-center gap-3">
      <div className="w-7 h-7 border-2 border-stone-300 dark:border-stone-700 border-t-stone-800 dark:border-t-stone-200 rounded-full animate-spin" />
      <span className="text-xs font-serif-literary tracking-wide text-stone-600 dark:text-stone-400">Memuat NulisLur...</span>
    </div>
  </div>
);

export function App() {
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => {
    // Prioritaskan sessionStorage agar 2 tab di peramban yang sama dapat login sebagai akun berbeda (Guru & Siswa)
    const session = sessionStorage.getItem('nulislur_session');
    if (session) {
      try {
        return JSON.parse(session);
      } catch (e) {
        console.error('Failed to parse sessionStorage', e);
      }
    }
    const saved = localStorage.getItem('nulislur_session');
    if (saved) {
      try {
        const user = JSON.parse(saved);
        sessionStorage.setItem('nulislur_session', saved);
        return user;
      } catch (e) {
        console.error('Failed to parse localStorage', e);
      }
    }
    return null;
  });

  // Pastikan akun awal ter-seed jika database baru
  useEffect(() => {
    DataService.seedInitialAccountsIfNeeded();
  }, []);

  const handleAuthSuccess = (user: UserAccount) => {
    setCurrentUser(user);
    sessionStorage.setItem('nulislur_session', JSON.stringify(user));
    localStorage.setItem('nulislur_session', JSON.stringify(user));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    sessionStorage.removeItem('nulislur_session');
    localStorage.removeItem('nulislur_session');
  };

  return (
    <ErrorBoundary>
      <Suspense fallback={<ViewLoadingFallback />}>
        {!currentUser ? (
          <UnifiedAuth onAuthSuccess={handleAuthSuccess} />
        ) : currentUser.role === 'admin' ? (
          <AdminDashboard user={currentUser} onLogout={handleLogout} />
        ) : currentUser.role === 'guru' ? (
          <TeacherDashboard user={currentUser} onLogout={handleLogout} />
        ) : (
          <StudentPortal user={currentUser} onLogout={handleLogout} />
        )}
      </Suspense>
    </ErrorBoundary>
  );
}

export default App;
