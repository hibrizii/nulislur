import React, { useState, useEffect, useRef } from 'react';
import { DataService } from '../../services/dataService';
import type { Dokumen, UserAccount } from '../../types';
import { NulisEditor } from '../Editor/NulisEditor';
import { ThemeToggle } from '../Common/ThemeToggle';
import { exportToPdf, exportToWord } from '../../utils/exportDocument';
import { 
  ArrowLeft, 
  CloudCheck, 
  CloudUpload,
  Printer,
  FileText,
  Send,
  X,
  Sparkles,
  BookOpen
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface TeacherEditorViewProps {
  docId: string;
  user: UserAccount;
  onBack: () => void;
}

export const TeacherEditorView: React.FC<TeacherEditorViewProps> = ({
  docId,
  user,
  onBack,
}) => {
  const [doc, setDoc] = useState<Dokumen | null>(null);
  const [judul, setJudul] = useState<string>('');
  const [topik, setTopik] = useState<string>('Artikel');
  const [teks, setTeks] = useState<string>('');
  const [layoutMode, setLayoutMode] = useState<'kertas' | 'web'>('kertas');
  const [saveStatus, setSaveStatus] = useState<'saving' | 'saved'>('saved');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isPublic, setIsPublic] = useState<boolean>(false);
  const [toastNotice, setToastNotice] = useState<string | null>(null);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastLocalTeksRef = useRef<string>('');
  const lastEditTimeRef = useRef<number>(0);
  const lastLocalJudulRef = useRef<string>('');
  const lastTitleEditTimeRef = useRef<number>(0);

  // Show temporary toast notice
  const showToast = (message: string) => {
    setToastNotice(message);
    setTimeout(() => {
      setToastNotice(null);
    }, 3000);
  };

  // 1. Listen dokumen yang sedang diedit
  useEffect(() => {
    if (!docId) return;

    const unsub = DataService.listenDokumenSingle(docId, (data) => {
      if (!data) return;

      // KEAMANAN RELASIONAL KETAT: Guru HANYA boleh mengedit karya kategori Guru miliknya sendiri.
      // Dilarang keras mengedit karya siswa!
      if (data.penulisKategori !== 'Guru' || (data.username && data.username !== user.username)) {
        alert('Akses Ditolak: Anda tidak memiliki hak untuk mengedit naskah ini.');
        onBack();
        return;
      }

      setDoc(data);

      const isRecentlyEditingTitle = Date.now() - lastTitleEditTimeRef.current < 3000;
      if (!isRecentlyEditingTitle && data.judul !== lastLocalJudulRef.current) {
        setJudul(data.judul || '');
        lastLocalJudulRef.current = data.judul || '';
      }

      const isRecentlyEditingTeks = Date.now() - lastEditTimeRef.current < 3000;
      if (!isRecentlyEditingTeks && data.teks !== lastLocalTeksRef.current) {
        setTeks(data.teks || '<p></p>');
        lastLocalTeksRef.current = data.teks || '';
      }

      if (data.topik) setTopik(data.topik);
      if (data.layoutMode) setLayoutMode(data.layoutMode);
      setIsPublic(Boolean(data.isPublic));

      DataService.updateAktivitas(
        user.username,
        `Menulis: ${data.judul || 'Naskah'}`,
        docId
      );
    });

    return () => {
      unsub();
      DataService.updateAktivitas(user.username, 'Beranda', null);
    };
  }, [docId, user.username, onBack]);

  // Debounced title update (Tanpa fallback dummy 'Tulisan Guru', simpan persis apa adanya yang diketik)
  const handleTitleChange = (newTitle: string) => {
    if (newTitle.length > 120) return;
    lastLocalJudulRef.current = newTitle;
    lastTitleEditTimeRef.current = Date.now();
    setJudul(newTitle);
    setSaveStatus('saving');

    if (titleTimerRef.current) clearTimeout(titleTimerRef.current);
    titleTimerRef.current = setTimeout(async () => {
      try {
        await DataService.simpanDokumen(docId, newTitle, teks, topik);
        setSaveStatus('saved');
      } catch (err) {
        console.warn('Gagal auto-save judul:', err);
      }
    }, 800);
  };

  // Debounced editor content update
  const handleEditorUpdate = (html: string) => {
    lastLocalTeksRef.current = html;
    lastEditTimeRef.current = Date.now();
    setTeks(html);
    setSaveStatus('saving');

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      try {
        await DataService.simpanDokumen(docId, judul, html, topik);
        setSaveStatus('saved');
      } catch (err) {
        console.warn('Gagal auto-save teks:', err);
      }
    }, 800);
  };

  // Topic change handler
  const handleTopicChange = async (newTopik: string) => {
    setTopik(newTopik);
    setSaveStatus('saving');
    try {
      await DataService.simpanDokumen(docId, judul, teks, newTopik);
      setSaveStatus('saved');
      showToast(`Kategori diubah menjadi ${newTopik}`);
    } catch (err) {
      console.warn('Gagal mengubah topik:', err);
    }
  };

  // Layout mode change
  const handleLayoutChange = async (mode: 'web' | 'kertas') => {
    setLayoutMode(mode);
    if (docId) {
      await DataService.updateLayoutModeDokumen(docId, mode);
    }
  };

  // Manual save handler
  const handleManualSave = async () => {
    setIsSaving(true);
    setSaveStatus('saving');
    try {
      await DataService.simpanDokumen(docId, judul, teks, topik);
      setSaveStatus('saved');
      showToast('Draf tulisan berhasil disimpan!');
    } catch (err: any) {
      alert('Gagal menyimpan draf: ' + (err?.message || 'Terjadi kesalahan'));
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle publish to Mading / Pojok Baca
  const handlePublishToggle = async () => {
    if (!judul.trim()) {
      alert('Isi judul tulisan terlebih dahulu sebelum menerbitkan!');
      return;
    }

    setIsSaving(true);
    try {
      await DataService.simpanDokumen(docId, judul.trim(), teks, topik);

      if (!isPublic) {
        await DataService.publikasiKeMading(docId, topik, user.nama || 'Guru');
        setIsPublic(true);
        confetti({
          particleCount: 80,
          spread: 60,
          origin: { y: 0.6 },
        });
        showToast('Karya berhasil diterbitkan di Pojok Baca Sekolah! ✨');
      } else {
        await DataService.takeDownMading(docId);
        setIsPublic(false);
        showToast('Karya telah ditarik dari publik dan kembali menjadi draf.');
      }
    } catch (err: any) {
      alert('Gagal mengubah status publikasi: ' + (err?.message || 'Terjadi kesalahan'));
    } finally {
      setIsSaving(false);
    }
  };

  // Export handlers
  const handleDownloadPdf = () => {
    exportToPdf({
      title: judul || doc?.judul || 'Tulisan Guru',
      author: user.nama || user.username,
      className: 'Ruang Guru',
      htmlContent: teks,
    });
  };

  const handleDownloadWord = () => {
    exportToWord({
      title: judul || doc?.judul || 'Tulisan Guru',
      author: user.nama || user.username,
      className: 'Ruang Guru',
      htmlContent: teks,
    });
  };

  return (
    <div className="min-h-screen w-full bg-[#FAF9F6] dark:bg-[#0c0a09] text-stone-900 dark:text-stone-100 transition-colors duration-200">
      <div className="max-w-4xl mx-auto p-4 sm:p-8 pb-36 sm:pb-48 w-full min-h-screen flex flex-col">
        {/* Header Bar Layar Penuh (Identik dengan Siswa, Bersih Tanpa Tab) */}
        <header className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-4 border-b border-stone-200 dark:border-stone-800">
          <button
            type="button"
            onClick={onBack}
            className="editorial-btn bg-white hover:bg-stone-100 text-stone-700 dark:bg-stone-800 dark:hover:bg-stone-700 dark:text-stone-200 py-2 px-3 text-xs border border-stone-200 dark:border-stone-700 cursor-pointer flex items-center gap-1.5 rounded-xl font-medium shadow-2xs"
          >
            <ArrowLeft size={14} /> Kembali
          </button>

          <div className="flex items-center gap-3">
            {/* Status Simpan Otomatis */}
            <div className="flex items-center gap-2 text-xs font-medium text-stone-500 dark:text-stone-400">
              {saveStatus === 'saving' ? (
                <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                  <CloudUpload size={15} /> Menyimpan...
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                  <CloudCheck size={15} /> Tersimpan
                </span>
              )}
            </div>

            {/* Pilihan Kategori Tulisan */}
            <div className="flex items-center gap-1.5">
              <select
                value={topik}
                onChange={(e) => handleTopicChange(e.target.value)}
                className="text-xs font-semibold px-2.5 py-1.5 rounded-xl border bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200 border-stone-200 dark:border-stone-700 focus:outline-none cursor-pointer shadow-2xs"
                title="Pilih Kategori Tulisan"
              >
                <option value="Artikel">Artikel</option>
                <option value="Cerpen">Cerpen</option>
                <option value="Puisi">Puisi</option>
                <option value="Esai">Esai</option>
                <option value="Resensi">Resensi</option>
                <option value="Lainnya">Lainnya</option>
              </select>
            </div>

            {/* Status Publikasi Badge */}
            <div>
              <span
                className={`text-xs font-bold px-2.5 py-1 rounded-md border ${
                  isPublic
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 shadow-2xs'
                    : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 border-stone-200 dark:border-stone-700'
                }`}
              >
                {isPublic ? 'Tayang di Publik' : 'Draf Guru'}
              </span>
            </div>

            <ThemeToggle />
          </div>
        </header>

        {/* Notifikasi Toast Mengambang */}
        {toastNotice && (
          <div className="fixed top-6 right-6 z-[10000] p-3 px-4 bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 rounded-xl shadow-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
            <Sparkles size={14} className="text-amber-400 dark:text-amber-600 shrink-0" />
            <span>{toastNotice}</span>
          </div>
        )}

        {/* Area Menulis Luas (Zen Paper Full Width, Tanpa Sidebar / Tab Sempit) */}
        <main className="w-full flex flex-col gap-5">
          {/* Banner Karya Tayang jika sudah diterbitkan */}
          {isPublic && (
            <div className="p-3.5 sm:p-4 bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 rounded-2xl flex items-center justify-between gap-3 text-xs text-emerald-900 dark:text-emerald-200 shadow-2xs">
              <div className="flex items-center gap-2.5">
                <BookOpen size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="font-medium">
                  Tulisan ini sedang aktif tayang di <strong>Pojok Baca</strong> dan dapat dibaca oleh seluruh siswa sekolah.
                </span>
              </div>
            </div>
          )}

          {/* Lembar Tulis Naskah */}
          <div className="editorial-card bg-white dark:bg-[#141416] p-6 sm:p-10 lg:p-12 pt-10 sm:pt-14 lg:pt-16 shadow-xs border border-stone-200/90 dark:border-stone-800 rounded-2xl min-h-[75vh]">
            {/* Judul Tulisan: Format Sama Persis Seperti Siswa */}
            <div className="pt-2 sm:pt-4 pb-6 sm:pb-7 mb-6 sm:mb-8 border-b border-stone-200/80 dark:border-stone-800/80">
              <input
                type="text"
                value={judul}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="Judul"
                spellCheck={false}
                lang="id"
                className="w-full text-2xl sm:text-4xl lg:text-[40px] font-bold font-serif-literary text-stone-900 dark:text-stone-100 border-0 p-0 focus:outline-none placeholder:text-stone-300 dark:placeholder:text-stone-600 bg-transparent leading-snug tracking-tight"
              />
            </div>

            {/* Tiptap Rich-Text Editor: Placeholder sama seperti siswa */}
            <NulisEditor
              initialContent={teks}
              initialLayoutMode={layoutMode}
              onLayoutModeChange={handleLayoutChange}
              readOnly={false}
              isTeacher={false}
              blockCopyPaste={false}
              onUpdate={handleEditorUpdate}
              placeholder="Tulis di sini..."
            />
          </div>

          {/* Tombol Aksi Bawah */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5 bg-white dark:bg-[#141416] rounded-2xl border border-stone-200/80 dark:border-stone-800 shadow-2xs">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadPdf}
                className="editorial-btn bg-stone-50 dark:bg-stone-800/80 hover:bg-stone-100 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700 py-2 px-3 text-xs flex items-center gap-1.5 cursor-pointer rounded-xl font-medium"
              >
                <Printer size={14} /> Cetak / Unduh PDF
              </button>
              <button
                type="button"
                onClick={handleDownloadWord}
                className="editorial-btn bg-stone-50 dark:bg-stone-800/80 hover:bg-stone-100 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700 py-2 px-3 text-xs flex items-center gap-1.5 cursor-pointer rounded-xl font-medium"
              >
                <FileText size={14} /> Unduh Word (.docx)
              </button>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={handleManualSave}
                disabled={isSaving}
                className="editorial-btn bg-stone-100 hover:bg-stone-200 text-stone-800 dark:bg-stone-800 dark:text-stone-200 py-2 px-4 text-xs font-semibold flex items-center gap-1.5 cursor-pointer rounded-xl"
              >
                <CloudUpload size={14} /> Simpan Draf
              </button>

              <button
                type="button"
                onClick={handlePublishToggle}
                disabled={isSaving}
                className={`editorial-btn py-2 px-5 text-xs font-bold flex items-center gap-2 cursor-pointer shadow-xs rounded-xl transition-all ${
                  isPublic
                    ? 'bg-amber-600 hover:bg-amber-700 text-white dark:bg-amber-500 dark:hover:bg-amber-600'
                    : 'bg-stone-900 hover:bg-stone-800 text-white dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-200'
                }`}
              >
                {isPublic ? (
                  <>
                    <X size={14} /> Tarik dari Publik
                  </>
                ) : (
                  <>
                    <Send size={14} /> Terbitkan ke Pojok Baca
                  </>
                )}
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};
