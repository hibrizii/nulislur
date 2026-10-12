import React, { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

interface ThemeToggleProps {
  className?: string;
  size?: number;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  className = '',
  size = 18,
}) => {
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    // Cek sessionStorage lebih dulu agar sesi tab Guru & Siswa tidak saling bertabrakan saat pengujian
    const sessionTheme = sessionStorage.getItem('nulislur_theme');
    if (sessionTheme) return sessionTheme === 'dark';
    const saved = localStorage.getItem('nulislur_theme');
    if (saved) return saved === 'dark';
    return document.documentElement.classList.contains('dark') || 
           window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    // Sinkronisasi class dark di documentElement
    if (isDark) {
      document.documentElement.classList.add('dark');
      sessionStorage.setItem('nulislur_theme', 'dark');
      localStorage.setItem('nulislur_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      sessionStorage.setItem('nulislur_theme', 'light');
      localStorage.setItem('nulislur_theme', 'light');
    }
  }, [isDark]);

  const toggleTheme = () => {
    setIsDark((prev) => !prev);
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`p-2 rounded-xl text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800/80 transition-all duration-200 cursor-pointer flex items-center justify-center shrink-0 ${className}`}
      title={isDark ? 'Mode Terang' : 'Mode Gelap'}
      aria-label="Toggle tema gelap atau terang"
    >
      {isDark ? (
        <Sun
          size={size}
          className="text-stone-200 hover:text-white transition-transform duration-300 hover:rotate-45"
        />
      ) : (
        <Moon
          size={size}
          className="text-stone-600 dark:text-stone-300 transition-transform duration-300 hover:-rotate-12"
        />
      )}
    </button>
  );
};
