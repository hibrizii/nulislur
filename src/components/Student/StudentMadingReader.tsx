import React, { useState, useEffect, useRef, useMemo } from 'react';
import { DataService, getWarnaTopik, stringToColor } from '../../services/dataService';
import type { Dokumen } from '../../types';
import { ArrowLeft, Heart, MessageSquare, Send, AlertCircle, Eye, X, Share2, Sparkles, Clock } from 'lucide-react';
import { ThemeToggle } from '../Common/ThemeToggle';
import { prepareContentForExport } from '../../utils/exportDocument';

interface StudentMadingReaderProps {
  docId: string;
  namaSiswa: string;
  username: string;
  onBack: () => void;
}

export const StudentMadingReader: React.FC<StudentMadingReaderProps> = ({
  docId,
  namaSiswa,
  username,
  onBack,
}) => {
  const [doc, setDoc] = useState<Dokumen | null>(null);
  const [isLiked, setIsLiked] = useState<boolean>(false);
  const [likeCount, setLikeCount] = useState<number>(0);
  const [viewsCount, setViewsCount] = useState<number>(0);
  const [komentarList, setKomentarList] = useState<{ id: string; nama: string; username: string; teks: string; waktu: string }[]>([]);
  const [inputKomentar, setInputKomentar] = useState<string>('');
  const [isCommentModalOpen, setIsCommentModalOpen] = useState<boolean>(false);
  const [scrollProgress, setScrollProgress] = useState<number>(0);

  const lastCommentTimeRef = useRef<number>(0);
  const [commentError, setCommentError] = useState<string>('');
  const hasCountedViewRef = useRef<boolean>(false);

  useEffect(() => {
    if (!hasCountedViewRef.current) {
      hasCountedViewRef.current = true;
      DataService.catatView(docId, username);
    }

    const unsub = DataService.listenDokumenSingle(docId, (d) => {
      if (d) {
        setDoc(d);
        DataService.updateAktivitas(username, `Membaca karya ${d.nama}`, null);
      }
    });

    return () => {
      unsub();
      DataService.updateAktivitas(username, 'Beranda', null);
    };
  }, [docId, username]);

  useEffect(() => {
    const unsub = DataService.listenViews(docId, (count) => {
      setViewsCount(count);
    });
    return () => unsub();
  }, [docId]);

  useEffect(() => {
    const unsub = DataService.listenLikes(docId, username, (count, liked) => {
      setLikeCount(count);
      setIsLiked(liked);
    });

    return () => unsub();
  }, [docId, username]);

  useEffect(() => {
    const unsub = DataService.listenKomentar(docId, (items) => {
      setKomentarList(items);
    });

    return () => unsub();
  }, [docId]);

  useEffect(() => {
    const handleScroll = () => {
      const totalScroll = document.documentElement.scrollHeight - window.innerHeight;
      if (totalScroll > 0) {
        const current = (window.scrollY / totalScroll) * 100;
        setScrollProgress(Math.min(100, Math.max(0, current)));
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const readingTime = useMemo(() => {
    if (!doc?.teks) return 1;
    const clean = doc.teks.replace(/<[^>]*>/g, ' ').trim();
    const words = clean ? clean.split(/\s+/).filter(Boolean).length : 0;
    return Math.max(1, Math.ceil(words / 180));
  }, [doc?.teks]);

  const handleToggleLike = async () => {
    await DataService.toggleLike(docId, username);
  };

  const handleKirimKomentar = async (e: React.FormEvent) => {
    e.preventDefault();
    setCommentError('');
    const trimmed = inputKomentar.trim();
    if (!trimmed) return;

    // Keamanan: Rate limiting komentar (cooldown 3 detik per user)
    const now = Date.now();
    if (now - lastCommentTimeRef.current < 3000) {
      setCommentError('Mohon tunggu sejenak sebelum mengirim komentar baru.');
      return;
    }

    // Keamanan: Sanitasi sederhana menghapus tag HTML/Script
    const sanitized = trimmed.replace(/<[^>]*>?/gm, '').slice(0, 500);
    if (!sanitized) return;

    lastCommentTimeRef.current = now;
    await DataService.tambahKomentar(docId, namaSiswa, username, sanitized);
    setInputKomentar('');
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    alert('Tautan halaman naskah berhasil disalin!');
  };

  if (!doc) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-stone-50/60 dark:bg-[#0c0a09]">
        <div className="editorial-card p-6 bg-white dark:bg-[#141416] font-medium text-sm text-stone-500 dark:text-stone-400 shadow-sm rounded-xl border border-stone-200 dark:border-stone-800">
          Memuat karya...
        </div>
      </div>
    );
  }

  const topicColor = getWarnaTopik(doc.topik);

  return (
    <div className="min-h-screen bg-stone-50/60 dark:bg-[#0c0a09] text-stone-900 dark:text-stone-100 pb-20 transition-colors duration-200">
      {/* Reading Scroll Progress Bar */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-stone-200/40 dark:bg-stone-800/60 z-50">
        <div
          className="h-full bg-blue-600 dark:bg-blue-400 transition-all duration-75"
          style={{ width: `${scrollProgress}%` }}
        />
      </div>

      {/* Sticky Top Navigation Bar */}
      <header className="sticky top-0 z-30 bg-white/90 dark:bg-[#141416]/90 backdrop-blur-md border-b border-stone-200/80 dark:border-stone-800 px-4 sm:px-8 py-3.5">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <button
            onClick={onBack}
            className="editorial-btn bg-white dark:bg-stone-800 hover:bg-stone-100 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200 py-1.5 px-3 text-xs border border-stone-200 dark:border-stone-700 rounded-xl shadow-2xs flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <ArrowLeft size={15} /> <span>Kembali</span>
          </button>

          {/* Quick Actions (Views, Like Heart, Pop-up Comments) */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Views Count */}
            <div className="flex items-center gap-1.5 text-xs text-stone-500 dark:text-stone-400 font-medium px-2.5 py-1 bg-stone-100 dark:bg-stone-800 rounded-lg">
              <Eye size={14} className="text-stone-400" />
              <span>{viewsCount}</span>
            </div>

            {/* Like Heart Button */}
            <button
              onClick={handleToggleLike}
              className={`flex items-center gap-1.5 text-xs font-semibold py-1.5 px-3 rounded-xl border transition-all cursor-pointer shadow-2xs ${
                isLiked
                  ? 'bg-red-50 text-red-600 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900/60 hover:bg-red-100'
                  : 'bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-200 border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-700'
              }`}
              title={isLiked ? 'Batal Suka' : 'Suka Karya'}
            >
              <Heart
                size={16}
                fill={isLiked ? '#dc2626' : 'none'}
                className={isLiked ? 'text-red-600' : 'text-stone-500'}
              />
              <span>{likeCount}</span>
            </button>

            {/* Comment Pop-up Trigger Button */}
            <button
              onClick={() => setIsCommentModalOpen(true)}
              className="flex items-center gap-1.5 text-xs font-semibold py-1.5 px-3 rounded-xl bg-white dark:bg-stone-800 hover:bg-stone-100 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200 border border-stone-200 dark:border-stone-700 transition-all cursor-pointer shadow-2xs"
              title="Buka Komentar & Apresiasi"
            >
              <MessageSquare size={16} className="text-stone-500" />
              <span>{komentarList.length}</span>
            </button>

            {/* Share / Copy Link */}
            <button
              onClick={handleCopyLink}
              className="p-1.5 rounded-xl bg-white hover:bg-stone-100 text-stone-500 border border-stone-200 dark:bg-stone-800 dark:text-stone-300 dark:border-stone-700 shadow-2xs cursor-pointer transition-colors hidden sm:flex"
              title="Salin Tautan"
            >
              <Share2 size={15} />
            </button>

            {/* Theme Toggle */}
            <ThemeToggle className="border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800" />
          </div>
        </div>
      </header>

      {/* Main Spacious Editorial Reading Canvas */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-6 sm:pt-10">
        <article className="editorial-card bg-white dark:bg-[#141416] p-6 sm:p-14 lg:p-18 shadow-sm border border-stone-200/90 dark:border-stone-800 rounded-2xl">
          {/* Header Karya */}
          <header className="border-b border-stone-100 dark:border-stone-800 pb-8 mb-10">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
              <span
                style={{ 
                  backgroundColor: topicColor.bg, 
                  color: topicColor.text,
                  borderColor: topicColor.border 
                }}
                className="text-xs font-semibold px-3 py-1 rounded-full border shadow-2xs"
              >
                {doc.topik || 'Karya'}
              </span>

              {doc.waktuPublishTeks && (
                <span className="text-xs text-stone-400 dark:text-stone-500 font-medium">
                  Dirilis: {doc.waktuPublishTeks}
                </span>
              )}
            </div>

            <h1 className="text-3xl sm:text-5xl font-bold font-serif-literary text-stone-900 dark:text-stone-100 leading-[1.2] mb-5 tracking-tight">
              {doc.judul}
            </h1>

            <div className="flex flex-wrap items-center gap-3 text-sm text-stone-600 dark:text-stone-300 font-medium pt-2">
              <div className="flex items-center gap-2">
                <span className="text-stone-400 dark:text-stone-500">Penulis:</span>
                <strong className="text-stone-900 dark:text-stone-100 font-semibold">{doc.nama}</strong>
              </div>
              {doc.namaKelas && (
                <span className="px-2.5 py-0.5 rounded-md bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 text-xs font-medium">
                  {doc.namaKelas}
                </span>
              )}
              <span className="text-stone-300 dark:text-stone-700">·</span>
              <span className="text-xs text-stone-500 dark:text-stone-400 flex items-center gap-1 font-mono">
                <Clock size={13} className="text-stone-400" /> ~{readingTime} menit baca
              </span>
            </div>
          </header>

          {/* Isi Teks Luas & Rapi dengan Tipografi Menyeluruh */}
          {(() => {
            const { cleanHtml, footnotes } = prepareContentForExport(doc.teks);
            return (
              <>
                <div
                  className="prose prose-stone dark:prose-invert max-w-none font-serif-literary text-lg sm:text-[19px] leading-[1.85] text-stone-800 dark:text-stone-200 space-y-4"
                  dangerouslySetInnerHTML={{ __html: cleanHtml }}
                />

                {footnotes.length > 0 && (
                  <div className="mt-12 pt-6 border-t border-stone-200 dark:border-stone-800">
                    <div className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-3 flex items-center gap-1.5">
                      <Sparkles size={14} className="text-stone-600 dark:text-stone-400" />
                      <span>Catatan Kaki (Footnotes)</span>
                    </div>
                    <div className="flex flex-col gap-2">
                      {footnotes.map((fn) => (
                        <div
                          key={fn.index}
                          className="text-xs text-stone-700 dark:text-stone-300 font-serif-literary flex items-start gap-2"
                        >
                          <span className="font-bold text-stone-900 dark:text-stone-100 shrink-0">
                            [{fn.index}]
                          </span>
                          <span className="leading-relaxed">{fn.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            );
          })()}

          {/* Footer Apresiasi di Bawah Naskah */}
          <footer className="mt-14 pt-8 border-t border-stone-100 dark:border-stone-800 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={handleToggleLike}
                className={`editorial-btn py-2.5 px-4 text-xs font-semibold rounded-xl border flex items-center gap-2 shadow-2xs transition-all cursor-pointer ${
                  isLiked
                    ? 'bg-red-50 text-red-600 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900/60 hover:bg-red-100'
                    : 'bg-stone-50 hover:bg-stone-100 text-stone-700 border-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 dark:text-stone-200 dark:border-stone-700'
                }`}
              >
                <Heart size={16} fill={isLiked ? '#dc2626' : 'none'} />
                <span>{isLiked ? 'Disukai' : 'Suka Karya Ini'} ({likeCount})</span>
              </button>

              <button
                onClick={() => setIsCommentModalOpen(true)}
                className="editorial-btn bg-stone-50 hover:bg-stone-100 text-stone-700 border border-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 dark:text-stone-200 dark:border-stone-700 py-2.5 px-4 text-xs font-semibold rounded-xl shadow-2xs flex items-center gap-2 cursor-pointer"
              >
                <MessageSquare size={16} />
                <span>Beri Komentar ({komentarList.length})</span>
              </button>
            </div>

            <div className="flex items-center gap-2 text-xs text-stone-400 dark:text-stone-500">
              <Eye size={14} /> Dibaca {viewsCount} kali
            </div>
          </footer>
        </article>
      </main>

      {/* Pop-Up Modal Komentar & Apresiasi */}
      {isCommentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-xs animate-in fade-in">
          <div
            className="editorial-card w-full max-w-lg bg-white dark:bg-stone-900 rounded-2xl shadow-2xl border border-stone-200 dark:border-stone-800 overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Modal */}
            <div className="px-5 py-4 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between bg-stone-50/60 dark:bg-stone-850/60">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-950/60 flex items-center justify-center text-amber-800 dark:text-amber-300">
                  <Sparkles size={15} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                    Komentar Pembaca
                  </h3>
                  <p className="text-[11px] text-stone-400 dark:text-stone-500">
                    {komentarList.length} apresiasi untuk karya ini
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCommentModalOpen(false)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* List Komentar */}
            <div className="p-5 flex-1 overflow-y-auto flex flex-col gap-3 min-h-[160px]">
              {komentarList.length === 0 ? (
                <div className="py-12 text-center text-stone-400 dark:text-stone-500 text-xs">
                  <MessageSquare size={28} className="mx-auto mb-2 opacity-30 text-stone-400 dark:text-stone-500" />
                  Belum ada komentar. Jadilah yang pertama memberi apresiasi!
                </div>
              ) : (
                komentarList.map((k) => (
                  <div
                    key={k.id}
                    className="p-3.5 bg-stone-50/80 dark:bg-stone-800/80 rounded-xl border border-stone-100 dark:border-stone-750 text-xs"
                  >
                    <div className="flex justify-between items-center mb-1.5">
                      <strong
                        style={{ color: stringToColor(k.nama) }}
                        className="font-semibold text-xs"
                      >
                        {k.nama}
                      </strong>
                      <span className="text-[10px] text-stone-400 dark:text-stone-500">{k.waktu}</span>
                    </div>
                    <p className="text-stone-700 dark:text-stone-200 break-words leading-relaxed font-sans text-xs">
                      {k.teks}
                    </p>
                  </div>
                ))
              )}
            </div>

            {/* Form Tulis Komentar */}
            <form onSubmit={handleKirimKomentar} className="p-4 border-t border-stone-100 dark:border-stone-800 bg-stone-50/40 dark:bg-stone-850/40">
              {commentError && (
                <div className="flex items-center gap-1.5 text-[11px] text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 p-2 rounded-lg border border-red-200 dark:border-red-900/60 mb-2">
                  <AlertCircle size={13} className="shrink-0" />
                  <span>{commentError}</span>
                </div>
              )}
              <div className="flex flex-col gap-2">
                <textarea
                  value={inputKomentar}
                  onChange={(e) => {
                    setInputKomentar(e.target.value);
                    if (commentError) setCommentError('');
                  }}
                  placeholder="Tulis apresiasi atau komentar untuk karya ini..."
                  className="editorial-input w-full p-3 text-xs resize-none h-20 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 border border-stone-200 dark:border-stone-700"
                  autoFocus
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCommentModalOpen(false)}
                    className="editorial-btn bg-stone-100 hover:bg-stone-200 text-stone-700 dark:bg-stone-800 dark:hover:bg-stone-700 dark:text-stone-300 py-1.5 px-3 text-xs cursor-pointer"
                  >
                    Tutup
                  </button>
                  <button
                    type="submit"
                    className="editorial-btn bg-stone-900 hover:bg-stone-800 text-white dark:bg-stone-100 dark:hover:bg-stone-200 dark:text-stone-900 py-1.5 px-4 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Send size={12} /> Kirim
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
