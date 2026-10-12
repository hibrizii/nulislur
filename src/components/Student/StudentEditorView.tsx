import React, { useState, useEffect, useRef } from 'react';
import { DataService } from '../../services/dataService';
import type { Dokumen } from '../../types';
import { NulisEditor, type HoverFeedbackData } from '../Editor/NulisEditor';
import { NeoModal } from '../Common/NeoModal';
import { ThemeToggle } from '../Common/ThemeToggle';
import { exportToPdf, exportToWord } from '../../utils/exportDocument';
import { RevisionChecklistDrawer } from './RevisionChecklistDrawer';
import { 
  ArrowLeft, 
  CheckCircle, 
  AlertCircle, 
  Sparkles, 
  CloudCheck, 
  CloudUpload,
  X,
  CheckCheck,
  Printer,
  FileText
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface StudentEditorViewProps {
  docId: string;
  namaSiswa: string;
  username: string;
  onBackToLobby: () => void;
}

export const StudentEditorView: React.FC<StudentEditorViewProps> = ({
  docId,
  namaSiswa: _namaSiswa,
  username,
  onBackToLobby,
}) => {
  const [doc, setDoc] = useState<Dokumen | null>(null);
  const [judul, setJudul] = useState<string>('');
  const [teks, setTeks] = useState<string>('');
  const [saveStatus, setSaveStatus] = useState<'saving' | 'saved'>('saved');
  const [hoverFeedback, setHoverFeedback] = useState<HoverFeedbackData | null>(null);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState<boolean>(false);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState<boolean>(false);
  const [checklistVersion, setChecklistVersion] = useState(0);

  useEffect(() => {
    const handleChecklistChange = () => setChecklistVersion((v) => v + 1);
    window.addEventListener('nulislur_checklist_change', handleChecklistChange);
    return () => window.removeEventListener('nulislur_checklist_change', handleChecklistChange);
  }, []);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastLocalTeksRef = useRef<string>('');
  const lastEditTimeRef = useRef<number>(0);
  const lastLocalJudulRef = useRef<string>('');
  const lastTitleEditTimeRef = useRef<number>(0);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleHoverFeedback = (data: HoverFeedbackData | null) => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    if (data) {
      setHoverFeedback(data);
    } else {
      hoverTimerRef.current = setTimeout(() => {
        setHoverFeedback(null);
      }, 250);
    }
  };

  // Posisi tooltip di atas / dekat kata yang di-highlight tanpa keluar layar
  const tooltipCoords = React.useMemo(() => {
    if (!hoverFeedback) return null;
    const { rect } = hoverFeedback;
    const tooltipWidth = 280;
    const tooltipHeight = 110;

    // Utamakan posisi DI ATAS kata yang di-highlight
    const spaceAbove = rect.top;
    const isAbove = spaceAbove >= tooltipHeight + 12;

    const top = isAbove ? rect.top - 8 : rect.bottom + 8;
    const markCenter = rect.left + rect.width / 2;
    const left = Math.max(16, Math.min(markCenter - tooltipWidth / 2, window.innerWidth - tooltipWidth - 16));
    const notchLeft = Math.max(16, Math.min(markCenter - left, tooltipWidth - 16));

    return {
      top,
      left,
      isAbove,
      notchLeft,
    };
  }, [hoverFeedback]);

  // Ekstraksi seluruh catatan koreksi highlight yang ada pada teks
  const daftarKoreksi = React.useMemo(() => {
    if (!teks) return [];
    try {
      const temp = document.createElement('div');
      temp.innerHTML = teks;
      const marks = temp.querySelectorAll('mark');
      const list: { kata: string; pesan: string }[] = [];
      marks.forEach((m) => {
        const pesan = m.getAttribute('data-pesan');
        if (pesan) {
          list.push({
            kata: m.textContent || '',
            pesan,
          });
        }
      });
      return list;
    } catch {
      return [];
    }
  }, [teks]);

  const isRevisionNeeded = React.useMemo(() => {
    if (!doc || doc.status === 'Selesai' || doc.isPublic) return false;
    const hasFeedback = Boolean(doc.feedbackUmum && doc.feedbackUmum.trim().length > 0);
    const totalItems = daftarKoreksi.length + (hasFeedback ? 1 : 0);
    if (totalItems === 0) return false;
    try {
      const raw = localStorage.getItem(`checklist_${docId}`);
      const checkedMap = raw ? JSON.parse(raw) : {};
      let checkedCount = 0;
      if (hasFeedback && checkedMap['umum']) checkedCount++;
      daftarKoreksi.forEach((_, idx) => {
        if (checkedMap[`item_${idx}`]) checkedCount++;
      });
      return checkedCount < totalItems;
    } catch {
      return true;
    }
  }, [doc, daftarKoreksi, docId, checklistVersion]);

  // Sorot dan gulir layar ke posisi kata yang diberi catatan koreksi oleh guru
  const handleScrollToMark = (index: number) => {
    const marks = document.querySelectorAll('.tiptap mark');
    if (marks[index]) {
      const target = marks[index] as HTMLElement;
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target.classList.add('mark-spotlight');
      setTimeout(() => {
        target.classList.remove('mark-spotlight');
      }, 2500);
    }
  };

  // Matikan klik kanan di lembar kerja siswa demi integritas menulis
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };
    window.addEventListener('contextmenu', handleContextMenu);
    return () => {
      window.removeEventListener('contextmenu', handleContextMenu);
    };
  }, []);

  // Listen document data (dengan pencegah echo loop saat siswa mengetik/menghapus)
  useEffect(() => {
    const unsub = DataService.listenDokumenSingle(docId, (data) => {
      if (!data) {
        onBackToLobby();
        return;
      }
      setDoc(data);

      // Jangan menimpa judul jika siswa baru saja mengetik judul dalam 3 detik terakhir
      const isRecentlyEditingTitle = Date.now() - lastTitleEditTimeRef.current < 3000;
      if (!isRecentlyEditingTitle && data.judul !== lastLocalJudulRef.current) {
        setJudul(data.judul || '');
        lastLocalJudulRef.current = data.judul || '';
      }

      // Jangan menimpa teks jika siswa baru saja mengetik/menghapus dalam 3 detik terakhir
      const isRecentlyEditingTeks = Date.now() - lastEditTimeRef.current < 3000;
      if (!isRecentlyEditingTeks && data.teks !== lastLocalTeksRef.current) {
        setTeks(data.teks || '<p></p>');
        lastLocalTeksRef.current = data.teks || '';
      }

      DataService.updateAktivitas(
        username,
        `Mengerjakan: ${data.judul || 'Tanpa Judul'}`,
        docId
      );
    });

    return () => {
      unsub();
      DataService.updateAktivitas(username, 'Beranda', null);
      if (titleTimerRef.current) clearTimeout(titleTimerRef.current);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (docId) {
        DataService.simpanDokumen(docId, lastLocalJudulRef.current, lastLocalTeksRef.current).catch(() => {});
      }
    };
  }, [docId, username, onBackToLobby]);

  // Debounced title update
  const handleTitleChange = (newTitle: string) => {
    if (newTitle.length > 100) return;
    lastLocalJudulRef.current = newTitle;
    lastTitleEditTimeRef.current = Date.now();
    setJudul(newTitle);
    setSaveStatus('saving');

    if (titleTimerRef.current) clearTimeout(titleTimerRef.current);
    titleTimerRef.current = setTimeout(async () => {
      if (doc && doc.status === 'Draf') {
        await DataService.simpanDokumen(docId, newTitle, lastLocalTeksRef.current);
        setSaveStatus('saved');
      }
    }, 600);
  };

  // Debounced editor content update
  const handleEditorUpdate = (html: string) => {
    lastLocalTeksRef.current = html;
    lastEditTimeRef.current = Date.now();
    setTeks(html);
    setSaveStatus('saving');

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      if (doc && doc.status === 'Draf') {
        await DataService.simpanDokumen(docId, lastLocalJudulRef.current, html);
        setSaveStatus('saved');
      }
    }, 600);
  };

  // Handler Kembali dengan Flush Auto-Save Seketika
  const handleBackWithFlush = async () => {
    if (titleTimerRef.current) {
      clearTimeout(titleTimerRef.current);
      titleTimerRef.current = null;
    }
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    if (doc && doc.status === 'Draf') {
      try {
        await DataService.simpanDokumen(docId, lastLocalJudulRef.current, lastLocalTeksRef.current);
      } catch (e) {
        console.warn('Gagal flush draf siswa:', e);
      }
    }
    onBackToLobby();
  };

  // Kumpulkan tugas
  const handleKumpulkan = async () => {
    if (!judul.trim() || teks === '<p></p>' || teks === '<p><br></p>' || !teks.trim()) {
      alert('Judul dan isi tulisan tidak boleh kosong!');
      return;
    }

    await DataService.kumpulkanDokumen(docId, judul, teks);
    setIsSubmitModalOpen(false);

    confetti({
      particleCount: 80,
      spread: 60,
      origin: { y: 0.6 },
    });
  };

  const handleDownloadPdf = () => {
    exportToPdf({
      title: judul || doc?.judul || 'Naskah Tulisan',
      author: doc?.nama || username,
      className: doc?.namaKelas,
      htmlContent: teks,
    });
  };

  const handleDownloadWord = () => {
    exportToWord({
      title: judul || doc?.judul || 'Naskah Tulisan',
      author: doc?.nama || username,
      className: doc?.namaKelas,
      htmlContent: teks,
    });
  };

  if (!doc) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="editorial-card p-6 bg-white font-medium text-sm text-stone-500">
          Memuat dokumen...
        </div>
      </div>
    );
  }

  const isDraf = doc.status === 'Draf';
  const isApproved = doc.status === 'Selesai' || doc.izinPublish || doc.isPublic;
  const totalCatatanGuru = daftarKoreksi.length + (doc.feedbackUmum ? 1 : 0);

  return (
    <div
      onContextMenu={(e) => e.preventDefault()}
      className="max-w-4xl mx-auto p-4 sm:p-8 pb-36 sm:pb-48 w-full min-h-screen flex flex-col select-none sm:select-auto"
    >
      {/* Header Bar */}
      <header className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-4 border-b border-stone-200 dark:border-stone-800">
        <button
          onClick={handleBackWithFlush}
          className="editorial-btn bg-white hover:bg-stone-100 text-stone-700 dark:bg-stone-800 dark:hover:bg-stone-700 dark:text-stone-200 py-2 px-3 text-xs border border-stone-200 dark:border-stone-700 cursor-pointer"
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

          {/* Tombol Pop-Up Catatan Revisi Siswa (Jika Ada Catatan) */}
          {totalCatatanGuru > 0 && (
            <button
              type="button"
              onClick={() => setIsFeedbackModalOpen((prev) => !prev)}
              className="editorial-btn bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800 py-1.5 px-3 text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
              title="Buka / Tutup Daftar Catatan Guru"
            >
              <CheckCheck size={14} className="text-amber-700 dark:text-amber-400" />
              <span className="font-semibold">Catatan Guru</span>
              <span className="bg-amber-200 dark:bg-amber-800 text-amber-950 dark:text-amber-100 font-bold px-1.5 py-0.5 rounded-full text-[10px]">
                {totalCatatanGuru}
              </span>
            </button>
          )}

          <div>
            {isRevisionNeeded ? (
              <span className="text-xs font-bold px-2.5 py-1 rounded-md border bg-orange-50 text-orange-700 border-orange-300 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800 flex items-center gap-1.5 shadow-2xs">
                <AlertCircle size={12} /> Perlu Revisi
              </span>
            ) : (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-md border bg-stone-50 text-stone-600 border-stone-200 dark:bg-stone-800 dark:text-stone-300 dark:border-stone-700">
                {doc.status}
              </span>
            )}
          </div>

          <ThemeToggle />
        </div>
      </header>

      {/* Area Menulis Luas (Zen Paper Full Width, Tanpa Sidebar Sempit) */}
      <main className="w-full flex flex-col gap-5">
        {/* Banner Informatif jika Guru Sudah Memberi Catatan Evaluasi Menyeluruh */}
        {doc.feedbackUmum && (
          <div className="p-4 sm:p-5 bg-amber-50/95 dark:bg-amber-950/40 border border-amber-200/90 dark:border-amber-800/80 rounded-2xl flex flex-wrap items-center justify-between gap-4 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-200 dark:bg-amber-900/60 flex items-center justify-center text-amber-900 dark:text-amber-300 shrink-0">
                <Sparkles size={18} />
              </div>
              <div>
                <span className="text-xs font-bold text-amber-950 dark:text-amber-200 uppercase tracking-wider block">
                  Catatan Evaluasi Guru
                </span>
                <p className="text-xs text-amber-900/80 dark:text-amber-300/80 font-medium line-clamp-1 mt-0.5">
                  "{doc.feedbackUmum}"
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsFeedbackModalOpen(true)}
              className="editorial-btn bg-stone-900 hover:bg-stone-800 text-white dark:bg-stone-100 dark:hover:bg-stone-200 dark:text-stone-900 text-xs py-2 px-3.5 shadow-xs cursor-pointer flex items-center gap-1.5 font-semibold"
            >
              <CheckCheck size={13} />
              <span>Daftar Periksa Revisi</span>
            </button>
          </div>
        )}

        {/* Lembar Tulis Naskah */}
        <div className="editorial-card bg-white dark:bg-[#141416] p-6 sm:p-10 lg:p-12 pt-10 sm:pt-14 lg:pt-16 shadow-xs border border-stone-200/90 dark:border-stone-800 rounded-2xl min-h-[75vh]">
          {/* Judul Tulisan: Jarak atas lapang dan jarak ke Formatting Toolbar proporsional elegan */}
          <div className="pt-2 sm:pt-4 pb-6 sm:pb-7 mb-6 sm:mb-8 border-b border-stone-200/80 dark:border-stone-800/80">
            <input
              type="text"
              disabled={!isDraf}
              value={judul}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="Judul tulisan..."
              spellCheck={false}
              lang="id"
              className="w-full text-2xl sm:text-4xl lg:text-[40px] font-bold font-serif-literary text-stone-900 dark:text-stone-100 border-0 p-0 focus:outline-none placeholder:text-stone-300 dark:placeholder:text-stone-600 bg-transparent leading-snug tracking-tight"
            />
          </div>

          {/* Tiptap Rich-Text Editor */}
          <NulisEditor
            initialContent={teks}
            initialLayoutMode={doc?.layoutMode || (typeof window !== 'undefined' ? (localStorage.getItem('nulislur_layout_mode') as 'web' | 'kertas') : null) || 'kertas'}
            onLayoutModeChange={(mode) => {
              if (docId) {
                DataService.updateLayoutModeDokumen(docId, mode);
              }
            }}
            readOnly={!isDraf}
            isTeacher={false}
            blockCopyPaste={isDraf}
            onUpdate={handleEditorUpdate}
            onHoverFeedback={handleHoverFeedback}
            placeholder="Tulis di sini..."
          />
        </div>

        {/* Tombol Aksi Bawah: Siswa meninjau naskah secara penuh sebelum submit */}
        <div className="mt-4 flex flex-col gap-3">
          {isDraf ? (
            <div className="p-6 sm:p-8 bg-stone-50 dark:bg-stone-900/60 rounded-2xl border border-stone-200/80 dark:border-stone-800 flex flex-col items-center text-center">
              <p className="text-xs text-stone-600 dark:text-stone-400 mb-4 max-w-md leading-relaxed">
                Sudah memeriksa naskah tulisan dari awal hingga akhir? Jika sudah yakin, kumpulkan tugas untuk diperiksa oleh gurumu.
              </p>
              <button
                onClick={() => setIsSubmitModalOpen(true)}
                className="editorial-btn w-full sm:w-auto px-8 py-3.5 bg-stone-900 hover:bg-stone-800 text-white dark:bg-stone-100 dark:hover:bg-stone-200 dark:text-stone-900 text-sm font-bold shadow-sm rounded-xl cursor-pointer flex items-center justify-center gap-2 transition-transform active:scale-98"
              >
                <CheckCircle size={18} /> Kumpulkan Tugas
              </button>
            </div>
          ) : (
            <>
              {!isApproved && (
                <div className="p-4 bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-xs font-medium text-amber-900 dark:text-amber-200 flex items-center justify-center gap-2">
                  <AlertCircle size={16} className="text-amber-600 dark:text-amber-400" />
                  <span>
                    Tugas telah dikumpulkan dan sedang diperiksa guru. Naskah terkunci dan dapat diunduh (PDF / Word) setelah selesai diperiksa.
                  </span>
                </div>
              )}

              {isApproved && (
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={handleDownloadPdf}
                    className="editorial-btn flex-1 bg-stone-900 hover:bg-stone-800 text-white dark:bg-stone-100 dark:hover:bg-stone-200 dark:text-stone-900 py-3.5 text-sm font-semibold rounded-xl shadow-xs cursor-pointer"
                  >
                    <Printer size={16} /> Unduh Naskah (PDF)
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadWord}
                    className="editorial-btn flex-1 bg-white hover:bg-stone-100 text-stone-800 border border-stone-300 dark:bg-stone-800 dark:hover:bg-stone-700 dark:text-stone-200 dark:border-stone-700 py-3.5 text-sm font-semibold rounded-xl shadow-xs cursor-pointer"
                  >
                    <FileText size={16} /> Unduh Naskah (Word .doc)
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Floating Pop-Up Tooltip di dekat / di atas kata highlight kuning */}
      {hoverFeedback && tooltipCoords && (
        <div
          onMouseEnter={() => {
            if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
          }}
          onMouseLeave={() => {
            setHoverFeedback(null);
          }}
          style={{
            top: `${tooltipCoords.top}px`,
            left: `${tooltipCoords.left}px`,
            transform: tooltipCoords.isAbove ? 'translateY(-100%)' : 'none',
          }}
          className="fixed z-50 w-72 max-w-[calc(100vw-32px)] editorial-card bg-white/95 dark:bg-stone-900/95 backdrop-blur-md border-2 border-amber-400 dark:border-amber-500 p-3.5 shadow-2xl rounded-2xl animate-in fade-in zoom-in-95 pointer-events-auto"
        >
          {/* Segitiga penunjuk arah kata */}
          <div
            style={{ left: `${tooltipCoords.notchLeft}px` }}
            className={`absolute w-3 h-3 bg-white dark:bg-stone-900 border-amber-400 dark:border-amber-500 transform rotate-45 -translate-x-1/2 ${
              tooltipCoords.isAbove
                ? '-bottom-[7px] border-b-2 border-r-2'
                : '-top-[7px] border-t-2 border-l-2'
            }`}
          />

          <div className="flex items-start justify-between gap-2 mb-1.5 relative z-10">
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900 dark:text-amber-300 truncate">
              <Sparkles size={14} className="text-amber-600 dark:text-amber-400 shrink-0" />
              <span className="truncate">
                Catatan Guru pada <span className="font-serif-literary underline">"{hoverFeedback.kata}"</span>:
              </span>
            </div>
            <button
              type="button"
              onClick={() => setHoverFeedback(null)}
              className="text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 p-0.5 rounded shrink-0 cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>
          <p className="font-serif-literary font-medium text-xs text-stone-900 dark:text-stone-100 bg-amber-50/90 dark:bg-amber-950/60 p-2.5 rounded-lg border border-amber-200/90 dark:border-amber-800/80 leading-relaxed relative z-10">
            "{hoverFeedback.pesan}"
          </p>
        </div>
      )}

      {/* Drawer Daftar Periksa Revisi Interaktif untuk Siswa */}
      <RevisionChecklistDrawer
        isOpen={isFeedbackModalOpen}
        onClose={() => setIsFeedbackModalOpen(false)}
        docId={docId}
        feedbackUmum={doc.feedbackUmum}
        daftarKoreksi={daftarKoreksi}
        onScrollToMark={handleScrollToMark}
      />

      {/* Modal Konfirmasi Submit */}
      <NeoModal
        isOpen={isSubmitModalOpen}
        title="Kumpulkan Tugas?"
        description="Setelah dikumpulkan, tugas tidak dapat diedit sebelum guru mengembalikan untuk revisi. Lanjutkan?"
        confirmText="Kumpulkan"
        confirmColor="#1C1917"
        onConfirm={handleKumpulkan}
        onCancel={() => setIsSubmitModalOpen(false)}
      />
    </div>
  );
};
