import React, { useState, useRef, useMemo, useEffect } from 'react';
import { 
  FileEdit, 
  Check, 
  Sparkles, 
  ChevronLeft, 
  ChevronRight, 
  Printer, 
  FileText, 
  Search, 
  Maximize2, 
  Minimize2, 
  Edit2, 
  X, 
  MessageSquare, 
  Trash2, 
  PanelLeftClose,
  PanelLeftOpen,
  BookOpen,
  BarChart2,
  Clock,
  ShieldAlert,
  AlertTriangle,
  RotateCcw,
  CloudCheck,
  CheckCircle
} from 'lucide-react';
import { NulisEditor, TEACHER_FEEDBACK_OPTIONS, type TeacherFeedbackOption } from '../../Editor/NulisEditor';
import { 
  DataService, 
  stringToColor, 
  parseDocumentTagCounts,
  hitungPenilaianOtomatis
} from '../../../services/dataService';
import type { Dokumen, UserAccount, Komentar, Penugasan } from '../../../types';
import { exportToPdf, exportToWord, cleanSnippet, cleanTitle } from '../../../utils/exportDocument';

// Helper Klasifikasi Status Antrean Pedagogis
export function getDocQueueCategory(d: Dokumen): 'terkumpul' | 'revisi' | 'selesai' | 'draf' {
  if (d.status === 'Selesai' || d.isPublic) return 'selesai';
  if (d.status === 'Terkumpul') return 'terkumpul';
  const hasFeedback = Boolean(d.feedbackUmum && d.feedbackUmum.trim().length > 0);
  const hasMarks = Boolean(d.teks && d.teks.includes('<mark'));
  // Status Draf hanya dikategorikan sebagai 'revisi' jika sudah pernah dikumpulkan (dalam siklus revisi)
  // ATAU nyata-nyata memiliki catatan bimbingan atau tag koreksi aktif dari guru.
  // Draf awal siswa tanpa submission dan tanpa catatan guru tetap murni berstatus 'draf'.
  if (d.status === 'Draf' && (Boolean(d.waktuKumpul) || hasFeedback || hasMarks)) {
    return 'revisi';
  }
  return 'draf';
}

interface TabKoreksiTugasProps {
  students: UserAccount[];
  dokumenMap: Record<string, Dokumen>;
  selectedFilterClass: string;
  selectedStudentUsername: string;
  onSelectStudentUsername: (username: string) => void;
  selectedDocId: string;
  onSelectDocId: (id: string) => void;
  onTandaiSelesai: (izinPublikasi: boolean) => Promise<void>;
  penugasanList?: Penugasan[];
  onOpenNewPenugasanModal?: () => void;
  onDokumenUpdated?: () => void;
}

const RUBRIC_ASPECTS = [
  { id: 'kedalamanGagasan', name: 'Kedalaman Gagasan', category: 'Makro' },
  { id: 'kepaduanParagraf', name: 'Kepaduan Paragraf', category: 'Makro' },
  { id: 'strukturTeks', name: 'Struktur Teks', category: 'Makro' },
  { id: 'efektivitasKalimat', name: 'Efektivitas Kalimat', category: 'Mikro' },
  { id: 'ketepatanDiksi', name: 'Ketepatan Diksi', category: 'Mikro' },
  { id: 'kebakuanEjaan', name: 'Kebakuan & Ejaan', category: 'Kebahasaan' },
  { id: 'pembentukanKata', name: 'Pembentukan Kata', category: 'Kebahasaan' },
  { id: 'tandaBaca', name: 'Tanda Baca', category: 'Kebahasaan' },
  { id: 'hurufKapital', name: 'Huruf Kapital', category: 'Mikro' },
];

export const TabKoreksiTugas: React.FC<TabKoreksiTugasProps> = ({
  students,
  dokumenMap,
  selectedFilterClass,
  selectedStudentUsername,
  onSelectStudentUsername,
  selectedDocId,
  onSelectDocId,
  onTandaiSelesai,
  penugasanList = [],
  onOpenNewPenugasanModal,
  onDokumenUpdated,
}) => {
  // Layout Controls
  const [isQueueCollapsed, setIsQueueCollapsed] = useState<boolean>(false);
  // Rubrik dihapus: Hanya ada tab Catatan dan Analisis
  const [activeInspectorTab, setActiveInspectorTab] = useState<'catatan' | 'info'>('catatan');
  // Filter Penugasan: 'semua' | 'mandiri' | idPenugasan
  const [selectedTugasFilter, setSelectedTugasFilter] = useState<string>('semua');
  // Filter Status Antrean: Semua, Terkumpul, Revisi, Selesai, Draf Siswa, Belum Mulai
  const [queueStatusFilter, setQueueStatusFilter] = useState<'semua' | 'terkumpul' | 'revisi' | 'selesai' | 'draf' | 'belum_mulai'>('semua');
  const [queueSearch, setQueueSearch] = useState<string>('');

  // Mode Fokus (Zen Mode)
  const [isFocusMode, setIsFocusMode] = useState<boolean>(false);
  const [showFocusCatatan, setShowFocusCatatan] = useState<boolean>(false);

  // Catatan Guru State & Timer Debounce Auto-Save
  const [catatanUmum, setCatatanUmum] = useState<string>('');
  const [catatanSavedNotice, setCatatanSavedNotice] = useState<boolean>(false);
  const [editorKey, setEditorKey] = useState<number>(0);
  const catatanTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Moderasi Komentar Publik
  const [moderasiKomentar, setModerasiKomentar] = useState<Komentar[]>([]);

  // Dokumen Terpilih
  const selectedDoc = selectedDocId ? dokumenMap[selectedDocId] : null;

  // Sinkronisasi Komentar Publik Dokumen
  useEffect(() => {
    if (!selectedDocId || !selectedDoc?.isPublic) {
      setModerasiKomentar([]);
      return;
    }
    const unsub = DataService.listenKomentar(selectedDocId, (list) => {
      setModerasiKomentar(list);
    });
    return () => unsub();
  }, [selectedDocId, selectedDoc?.isPublic]);

  // Sinkronisasi Catatan Guru dari Dokumen yang dipilih
  useEffect(() => {
    if (selectedDoc) {
      setCatatanUmum(selectedDoc.feedbackUmum || selectedDoc.penilaian?.catatanGuru || '');
    } else {
      setCatatanUmum('');
    }
  }, [selectedDocId]);

  // Cleanup auto-save timer saat unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, []);

  // Auto-save umpan balik guru dengan debounce 500ms (Catatan dan nilai otomatis melekat)
  const handleCatatanChange = (val: string) => {
    setCatatanUmum(val);
    if (!selectedDocId || !selectedDoc) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(async () => {
      try {
        await DataService.simpanFeedbackUmum(selectedDocId, val);
        const tags = parseDocumentTagCounts(selectedDoc.teks);
        const autoPenilaian = hitungPenilaianOtomatis(selectedDoc, tags, val);
        await DataService.simpanPenilaian(selectedDocId, autoPenilaian, false);
        if (dokumenMap[selectedDocId]) {
          dokumenMap[selectedDocId].feedbackUmum = val;
          dokumenMap[selectedDocId].penilaian = autoPenilaian;
        }
        if (onDokumenUpdated) onDokumenUpdated();
        setCatatanSavedNotice(true);
        setTimeout(() => setCatatanSavedNotice(false), 2500);
      } catch (err) {
        console.error('Gagal auto-save catatan guru:', err);
      }
    }, 500);
  };

  // Handler Kembalikan ke Siswa untuk Revisi (Nilai dan Catatan Melekat)
  const handleMintaRevisi = async () => {
    if (!selectedDocId || !selectedDoc) return;
    try {
      const tags = parseDocumentTagCounts(selectedDoc.teks);
      const autoPenilaian = hitungPenilaianOtomatis(selectedDoc, tags, catatanUmum);
      await DataService.simpanPenilaian(selectedDocId, autoPenilaian, false);
      if (catatanUmum.trim()) {
        await DataService.simpanFeedbackUmum(selectedDocId, catatanUmum.trim());
      }
      await DataService.updateStatusDokumen(selectedDocId, 'Draf', false);
      if (dokumenMap[selectedDocId]) {
        dokumenMap[selectedDocId].status = 'Draf';
        dokumenMap[selectedDocId].penilaian = autoPenilaian;
      }
      if (onDokumenUpdated) onDokumenUpdated();
      alert('Naskah telah dikembalikan ke siswa untuk perbaikan. Nilai dan catatan bimbingan tetap melekat.');
    } catch (err: any) {
      console.error('Gagal meminta revisi siswa:', err);
      alert('Gagal mengembalikan status naskah: ' + (err?.message || 'Terjadi kesalahan sistem'));
    }
  };

  // Slash Command '/' untuk Catatan Evaluasi Guru
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashQuery, setSlashQuery] = useState('');
  const [slashIndex, setSlashIndex] = useState(0);

  const filteredSlashOptions = useMemo(() => {
    if (!slashQuery.trim()) return TEACHER_FEEDBACK_OPTIONS;
    const q = slashQuery.toLowerCase().trim();
    return TEACHER_FEEDBACK_OPTIONS.filter((o) =>
      o.label.toLowerCase().includes(q) ||
      o.tag.toLowerCase().includes(q) ||
      o.keywords.some((k) => k.includes(q))
    );
  }, [slashQuery]);

  const handleCatatanTextChange = (text: string, targetEl?: HTMLTextAreaElement | null) => {
    handleCatatanChange(text);
    const textarea = targetEl || catatanTextareaRef.current;
    if (!textarea) return;
    const cursor = textarea.selectionStart ?? text.length;
    const textBefore = text.slice(0, cursor);
    const match = textBefore.match(/\/([a-zA-Z0-9_]*)$/);
    if (match) {
      setSlashOpen(true);
      setSlashQuery(match[1]);
      setSlashIndex(0);
    } else {
      setSlashOpen(false);
    }
  };

  const handleInsertCatatanOption = (opt: TeacherFeedbackOption, targetEl?: HTMLTextAreaElement | null) => {
    const textarea = targetEl || catatanTextareaRef.current;
    let nextVal = '';
    if (textarea) {
      const cursor = textarea.selectionStart ?? catatanUmum.length;
      const textBefore = catatanUmum.slice(0, cursor);
      const textAfter = catatanUmum.slice(cursor);
      const cleanBefore = textBefore.replace(/\/([a-zA-Z0-9_]*)$/, '').trim();
      const insertion = `${opt.tag} ${opt.template}`;
      nextVal = cleanBefore 
        ? `${cleanBefore}\n${insertion}${textAfter ? `\n${textAfter.trim()}` : ''}`
        : `${insertion}${textAfter ? `\n${textAfter.trim()}` : ''}`;
    } else {
      const insertion = `${opt.tag} ${opt.template}`;
      nextVal = catatanUmum.trim() ? `${catatanUmum.trim()}\n${insertion}` : insertion;
    }
    handleCatatanChange(nextVal);
    setSlashOpen(false);
    setTimeout(() => {
      if (textarea) textarea.focus();
    }, 50);
  };

  const handleCatatanKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>, targetEl?: HTMLTextAreaElement | null) => {
    if (slashOpen && filteredSlashOptions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSlashIndex((prev) => (prev + 1) % filteredSlashOptions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSlashIndex((prev) => (prev - 1 + filteredSlashOptions.length) % filteredSlashOptions.length);
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const selected = filteredSlashOptions[slashIndex];
        if (selected) handleInsertCatatanOption(selected, targetEl);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setSlashOpen(false);
        return;
      }
    }
  };

  // Handler Tandai Semua Koreksi Telah Direvisi:
  // Menandai seluruh tag koreksi/highlight di naskah dengan data-resolved="true"
  // dan memulihkan skor aspek rubrik siswa secara proporsional (tanpa mengubah status Selesai)
  const handleTandaiSemuaDirevisi = async () => {
    if (!selectedDocId || !selectedDoc) return;
    const rawTeks = selectedDoc.teks || '';
    if (!rawTeks.includes('<mark')) return;

    try {
      const updatedTeks = rawTeks.replace(/<mark\b([^>]*?)>/gi, (match, attrs) => {
        if (!/data-resolved=["']true["']/i.test(attrs)) {
          return `<mark ${attrs} data-resolved="true">`;
        }
        return match;
      });

      await DataService.simpanDokumen(selectedDocId, selectedDoc.judul, updatedTeks);
      const tags = parseDocumentTagCounts(updatedTeks);
      const autoPenilaian = hitungPenilaianOtomatis({ ...selectedDoc, teks: updatedTeks }, tags, catatanUmum);
      await DataService.simpanPenilaian(selectedDocId, autoPenilaian, false);
      if (dokumenMap[selectedDocId]) {
        dokumenMap[selectedDocId].teks = updatedTeks;
        dokumenMap[selectedDocId].penilaian = autoPenilaian;
      }
      setEditorKey((prev) => prev + 1);
      if (onDokumenUpdated) onDokumenUpdated();
    } catch (err: any) {
      console.error('Gagal menandai semua revisi:', err);
      alert('Gagal menandai revisi: ' + (err?.message || 'Terjadi kesalahan'));
    }
  };

  // Auto detect koreksi tag dari naskah
  const detectedTagCounts = useMemo(() => {
    if (!selectedDoc?.teks) return null;
    return parseDocumentTagCounts(selectedDoc.teks);
  }, [selectedDoc?.teks]);

  // Daftar Penugasan yang relevan dengan kelas yang sedang dipilih
  const availablePenugasan = useMemo(() => {
    if (!penugasanList) return [];
    if (selectedFilterClass === 'semua') return penugasanList;
    return penugasanList.filter((p) => p.kodeKelas === selectedFilterClass);
  }, [penugasanList, selectedFilterClass]);

  // Kumpulan seluruh siswa dan seluruh naskah mereka (diurutkan berdasarkan waktu aktivitas terbaru)
  const taskQueueAll = useMemo(() => {
    return students
      .filter((s) => {
        if (selectedFilterClass !== 'semua' && s.kodeKelas !== selectedFilterClass) return false;
        return true;
      })
      .map((s) => {
        let docs = Object.values(dokumenMap).filter(
          (d) => (d.username === s.username || d.nama === s.nama) && d.penulisKategori !== 'Guru'
        );

        // Filter berdasarkan Penugasan
        if (selectedTugasFilter === 'mandiri') {
          docs = docs.filter((d) => !d.tugasId);
        } else if (selectedTugasFilter !== 'semua') {
          docs = docs.filter((d) => d.tugasId === selectedTugasFilter);
        }

        docs.sort((a, b) => {
          const timeA = new Date(a.waktuEdit || a.waktuKumpul || 0).getTime();
          const timeB = new Date(b.waktuEdit || b.waktuKumpul || 0).getTime();
          return timeB - timeA;
        });

        return {
          student: s,
          docs,
        };
      });
  }, [students, dokumenMap, selectedFilterClass, selectedTugasFilter]);

  // Hitung jumlah counter pada masing-masing kategori antrean (berdasarkan klasifikasi pedagogis)
  const queueCounts = useMemo(() => {
    let semua = 0;
    let terkumpul = 0;
    let revisi = 0;
    let draf = 0;
    let selesai = 0;
    let belumMulai = 0;

    taskQueueAll.forEach(({ docs }) => {
      if (docs.length === 0) {
        belumMulai++;
      } else {
        docs.forEach((d) => {
          semua++;
          const cat = getDocQueueCategory(d);
          if (cat === 'terkumpul') terkumpul++;
          else if (cat === 'revisi') revisi++;
          else if (cat === 'selesai') selesai++;
          else draf++;
        });
      }
    });

    return { semua, terkumpul, revisi, draf, selesai, belumMulai };
  }, [taskQueueAll]);

  // Antrean Siswa yang difilter sesuai tab status dan pencarian (memuat seluruh matchingDocs)
  const taskQueueStudents = useMemo(() => {
    return taskQueueAll
      .map(({ student, docs }) => {
        let matchingDocs = docs;
        if (queueStatusFilter === 'terkumpul') {
          matchingDocs = docs.filter((d) => getDocQueueCategory(d) === 'terkumpul');
        } else if (queueStatusFilter === 'revisi') {
          matchingDocs = docs.filter((d) => getDocQueueCategory(d) === 'revisi');
        } else if (queueStatusFilter === 'draf') {
          matchingDocs = docs.filter((d) => getDocQueueCategory(d) === 'draf');
        } else if (queueStatusFilter === 'selesai') {
          matchingDocs = docs.filter((d) => getDocQueueCategory(d) === 'selesai');
        } else if (queueStatusFilter === 'belum_mulai') {
          matchingDocs = [];
        }
        return { student, docs, matchingDocs };
      })
      .filter(({ student, docs, matchingDocs }) => {
        // 1. Filter Pencarian Nama / Judul
        if (queueSearch.trim()) {
          const q = queueSearch.toLowerCase();
          const matchStudent = student.nama.toLowerCase().includes(q) || student.username.toLowerCase().includes(q);
          const currentDocs = queueStatusFilter === 'semua' || queueStatusFilter === 'belum_mulai' ? docs : matchingDocs;
          const matchDoc = currentDocs.some((d) => d.judul?.toLowerCase().includes(q));
          if (!matchStudent && !matchDoc) return false;
        }

        // 2. Filter Status
        if (queueStatusFilter === 'belum_mulai') {
          return docs.length === 0;
        }
        if (queueStatusFilter === 'semua') {
          return true;
        }
        return matchingDocs.length > 0;
      });
  }, [taskQueueAll, queueSearch, queueStatusFilter]);

  // Daftar naskah yang dapat dinavigasi dengan tombol < dan > di top studio bar
  const navigableQueueItems = useMemo(() => {
    const items: { studentUsername: string; docId: string }[] = [];
    taskQueueStudents.forEach(({ student, matchingDocs, docs }) => {
      const list = matchingDocs.length > 0 ? matchingDocs : docs;
      if (list.length === 0) {
        items.push({ studentUsername: student.username, docId: '' });
      } else {
        list.forEach((d) => {
          items.push({ studentUsername: student.username, docId: d.id });
        });
      }
    });
    return items;
  }, [taskQueueStudents]);

  // Helper Ganti Naskah Berikutnya / Sebelumnya
  const handleNavigateQueue = (delta: number) => {
    if (navigableQueueItems.length === 0) return;
    const currentIndex = navigableQueueItems.findIndex(
      (item) => item.studentUsername === selectedStudentUsername && (item.docId === selectedDocId || !item.docId)
    );
    let nextIndex = currentIndex + delta;
    if (nextIndex < 0) nextIndex = navigableQueueItems.length - 1;
    if (nextIndex >= navigableQueueItems.length) nextIndex = 0;

    const nextItem = navigableQueueItems[nextIndex];
    if (nextItem) {
      onSelectStudentUsername(nextItem.studentUsername);
      onSelectDocId(nextItem.docId);
    }
  };

  // Bila kategori/tugas berubah dan naskah terpilih tidak ada di antrean aktif, pilih naskah pertama yang cocok
  useEffect(() => {
    if (navigableQueueItems.length > 0) {
      const isCurrentInQueue = navigableQueueItems.some(
        (i) => i.studentUsername === selectedStudentUsername && (i.docId === selectedDocId || !i.docId)
      );
      if (!isCurrentInQueue) {
        const first = navigableQueueItems[0];
        onSelectStudentUsername(first.studentUsername);
        onSelectDocId(first.docId);
      }
    }
  }, [queueStatusFilter, selectedTugasFilter, navigableQueueItems]);

  // Hitung jumlah kata teks
  const totalWordCount = useMemo(() => {
    if (!selectedDoc?.teks) return 0;
    return cleanSnippet(selectedDoc.teks).split(/\s+/).filter(Boolean).length;
  }, [selectedDoc?.teks]);

  return (
    <div className="h-full flex flex-col min-h-0 overflow-hidden animate-in fade-in duration-200">
      {/* Top Studio Bar (Ramping & Ringkas) */}
      <div className="shrink-0 p-3 sm:px-4 sm:py-2.5 bg-white dark:bg-[#141416] rounded-2xl border border-stone-200/80 dark:border-stone-800 flex flex-wrap items-center justify-between gap-3 shadow-2xs mb-2.5">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => setIsQueueCollapsed(!isQueueCollapsed)}
            className="editorial-btn bg-stone-100 hover:bg-stone-200 text-stone-700 dark:bg-stone-800 dark:hover:bg-stone-700 dark:text-stone-300 p-2 text-xs rounded-xl cursor-pointer shrink-0"
            title={isQueueCollapsed ? 'Buka Antrean Tugas' : 'Ciutkan Antrean Tugas'}
          >
            {isQueueCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>

          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-bold font-serif-literary text-stone-900 dark:text-stone-100 flex items-center gap-2 truncate">
              <span>Studio Koreksi Tugas</span>
              {selectedDoc && (() => {
                const selCat = getDocQueueCategory(selectedDoc);
                const selBadgeLabel = 
                  selCat === 'terkumpul' ? 'Terkumpul' :
                  selCat === 'revisi' ? `Revisi ${selectedDoc.penilaian ? `(${selectedDoc.penilaian.skorTotal})` : ''}` :
                  selCat === 'selesai' ? `Selesai ${selectedDoc.penilaian ? `(${selectedDoc.penilaian.skorTotal})` : ''}` :
                  'Draf';
                const selBadgeColor = 
                  selCat === 'terkumpul' ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300' :
                  selCat === 'revisi' ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300' :
                  selCat === 'selesai' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' :
                  'bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300';
                return (
                  <span className={`text-[10px] font-sans font-bold px-2 py-0.5 rounded-full shrink-0 ${selBadgeColor}`}>
                    {selBadgeLabel}
                  </span>
                );
              })()}
            </h2>
            <p className="text-[11px] text-stone-500 dark:text-stone-400 truncate">
              {selectedDoc ? (
                <>
                  Naskah: <strong>{cleanTitle(selectedDoc.judul)}</strong> oleh {selectedDoc.nama}
                  {selectedDoc.kolaborator && selectedDoc.kolaborator.length > 0 && (
                    <> & {selectedDoc.kolaborator.map((k) => k.nama).join(', ')}</>
                  )}
                  {' '}(@{selectedDoc.username})
                  {(selectedDoc.isKolaboratif || (selectedDoc.kolaborator && selectedDoc.kolaborator.length > 0)) && (
                    <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300">
                      👥 Kolaborasi
                    </span>
                  )}
                </>
              ) : (
                'Pilih siswa di antrean sebelah kiri untuk mulai membaca dan memberi catatan.'
              )}
            </p>
          </div>
        </div>

        {/* Quick Queue Navigation & Mode Fokus */}
        <div className="flex items-center gap-2 shrink-0">
          {navigableQueueItems.length > 0 && (
            <div className="flex items-center gap-1 mr-1">
              <span className="text-xs text-stone-400 dark:text-stone-500 font-mono hidden sm:inline mr-1">
                {Math.max(1, navigableQueueItems.findIndex((i) => i.studentUsername === selectedStudentUsername && (i.docId === selectedDocId || !i.docId)) + 1)} / {navigableQueueItems.length}
              </span>
              <button
                onClick={() => handleNavigateQueue(-1)}
                className="editorial-btn bg-stone-100 hover:bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-300 p-1.5 rounded-lg cursor-pointer"
                title="Naskah Sebelumnya"
              >
                <ChevronLeft size={15} />
              </button>
              <button
                onClick={() => handleNavigateQueue(1)}
                className="editorial-btn bg-stone-100 hover:bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-300 p-1.5 rounded-lg cursor-pointer"
                title="Naskah Berikutnya"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          )}

          {selectedDoc && (
            <button
              onClick={() => setIsFocusMode(true)}
              className="editorial-btn bg-stone-900 hover:bg-stone-800 text-white dark:bg-stone-800 dark:hover:bg-stone-700 dark:text-stone-100 dark:border dark:border-stone-700 px-3 py-1.5 text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs"
              title="Buka Mode Fokus Layar Penuh"
            >
              <Maximize2 size={13} /> <span className="hidden sm:inline">Mode Fokus</span>
            </button>
          )}
        </div>
      </div>

      {/* Main 3-Zone Workspace (Terkunci Viewport, Prioritas Mutlak Teks Naskah) */}
      <div className="flex-1 min-h-0 flex gap-3 overflow-hidden">
        {/* ZONA 1: Antrean Tugas (Queue Panel) */}
        {!isQueueCollapsed && (
          <aside className="w-[230px] shrink-0 h-full flex flex-col min-h-0 bg-white dark:bg-[#141416] rounded-2xl border border-stone-200/80 dark:border-stone-800 p-3 shadow-2xs">
            {/* Header Antrean & Filter Status */}
            <div className="shrink-0 pb-2.5 mb-2.5 border-b border-stone-100 dark:border-stone-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
                  <FileEdit size={13} /> Antrean ({taskQueueStudents.length})
                </span>
              </div>

              {/* Filter Penugasan Dropdown */}
              <div className="mb-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400 flex items-center gap-1">
                    <BookOpen size={11} /> Tugas
                  </span>
                  {onOpenNewPenugasanModal && (
                    <button
                      type="button"
                      onClick={onOpenNewPenugasanModal}
                      className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                      title="Buat instruksi penugasan baru"
                    >
                      + Buat Tugas
                    </button>
                  )}
                </div>
                <select
                  value={selectedTugasFilter}
                  onChange={(e) => {
                    if (e.target.value === '__NEW__') {
                      onOpenNewPenugasanModal?.();
                    } else {
                      setSelectedTugasFilter(e.target.value);
                    }
                  }}
                  className="editorial-input w-full px-2 py-1 text-[11px] bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-750 dark:text-stone-100 rounded-lg truncate cursor-pointer font-medium"
                >
                  <option value="semua">Semua Naskah</option>
                  {availablePenugasan.map((t) => (
                    <option key={t.id} value={t.id}>
                      📝 {t.judul}
                    </option>
                  ))}
                  <option value="mandiri">✍️ Tanpa Label Tugas (Mandiri)</option>
                  {onOpenNewPenugasanModal && (
                    <option value="__NEW__">➕ + Buat Tugas Baru...</option>
                  )}
                </select>
              </div>

              {/* Filter Pills: Semua, Terkumpul, Sedang Revisi, Selesai, Draf Mandiri, Belum Mulai */}
              <div className="grid grid-cols-2 gap-1 mb-2">
                <button
                  type="button"
                  onClick={() => setQueueStatusFilter('semua')}
                  className={`py-1 px-1.5 text-[10px] font-semibold rounded-lg transition-colors cursor-pointer text-center truncate ${
                    queueStatusFilter === 'semua'
                      ? 'bg-stone-900 text-white dark:bg-stone-800 dark:text-stone-100 dark:border dark:border-stone-700 shadow-2xs'
                      : 'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700'
                  }`}
                  title="Tampilkan seluruh siswa di kelas"
                >
                  Semua ({queueCounts.semua})
                </button>
                <button
                  type="button"
                  onClick={() => setQueueStatusFilter('terkumpul')}
                  className={`py-1 px-1.5 text-[10px] font-semibold rounded-lg transition-colors cursor-pointer text-center truncate ${
                    queueStatusFilter === 'terkumpul'
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700'
                  }`}
                  title="Tugas yang telah dikumpulkan siswa dan siap dinilai"
                >
                  Terkumpul ({queueCounts.terkumpul})
                </button>
                <button
                  type="button"
                  onClick={() => setQueueStatusFilter('revisi')}
                  className={`py-1 px-1.5 text-[10px] font-semibold rounded-lg transition-colors cursor-pointer text-center truncate ${
                    queueStatusFilter === 'revisi'
                      ? 'bg-amber-600 text-white shadow-2xs'
                      : 'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700'
                  }`}
                  title="Naskah yang telah dikoreksi guru dan sedang direvisi siswa (nilai sementara tercatat)"
                >
                  Sedang Revisi ({queueCounts.revisi})
                </button>
                <button
                  type="button"
                  onClick={() => setQueueStatusFilter('selesai')}
                  className={`py-1 px-1.5 text-[10px] font-semibold rounded-lg transition-colors cursor-pointer text-center truncate ${
                    queueStatusFilter === 'selesai'
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700'
                  }`}
                  title="Tugas yang sudah selesai dinilai atau diterbitkan"
                >
                  Selesai ({queueCounts.selesai})
                </button>
                <button
                  type="button"
                  onClick={() => setQueueStatusFilter('draf')}
                  className={`py-1 px-1.5 text-[10px] font-semibold rounded-lg transition-colors cursor-pointer text-center truncate ${
                    queueStatusFilter === 'draf'
                      ? 'bg-stone-700 text-white shadow-2xs'
                      : 'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700'
                  }`}
                  title="Draf mandiri siswa yang belum pernah dikumpulkan"
                >
                  Draf Mandiri ({queueCounts.draf})
                </button>
                <button
                  type="button"
                  onClick={() => setQueueStatusFilter('belum_mulai')}
                  className={`py-1 px-1.5 text-[10px] font-semibold rounded-lg transition-colors cursor-pointer text-center truncate ${
                    queueStatusFilter === 'belum_mulai'
                      ? 'bg-stone-700 text-white shadow-2xs'
                      : 'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700'
                  }`}
                  title="Siswa yang belum membuat draf naskah sama sekali"
                >
                  Belum Mulai ({queueCounts.belumMulai})
                </button>
              </div>

              {/* Input Search Antrean */}
              <div className="relative">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
                <input
                  type="text"
                  value={queueSearch}
                  onChange={(e) => setQueueSearch(e.target.value)}
                  placeholder="Cari naskah..."
                  className="editorial-input w-full pl-7 pr-2 py-1 text-[11px] bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-750 dark:text-stone-100 rounded-lg"
                />
              </div>
            </div>

            {/* List Siswa di Antrean (Scroll Internal Mandiri) */}
            <div className="flex-1 min-h-0 overflow-y-auto pr-0.5 flex flex-col gap-1.5 custom-scrollbar">
              {taskQueueStudents.length === 0 ? (
                <p className="text-xs text-stone-400 dark:text-stone-500 text-center py-8">
                  Tidak ada siswa dalam kategori ini.
                </p>
              ) : (
                taskQueueStudents.map(({ student, docs, matchingDocs }) => {
                  // Jika siswa belum memiliki naskah sama sekali
                  if (docs.length === 0 || matchingDocs.length === 0) {
                    const isSelected = student.username === selectedStudentUsername && !selectedDocId;
                    return (
                      <button
                        key={student.username}
                        type="button"
                        onClick={() => {
                          onSelectStudentUsername(student.username);
                          onSelectDocId('');
                        }}
                        className={`p-2.5 rounded-xl text-left transition-all flex flex-col gap-1 cursor-pointer border ${
                          isSelected
                            ? 'bg-stone-900 text-white dark:bg-stone-800 dark:text-stone-100 border-stone-900 dark:border-amber-500/70 shadow-xs'
                            : 'bg-stone-50/70 dark:bg-stone-900/40 hover:bg-stone-100 dark:hover:bg-stone-800/60 border-stone-200/60 dark:border-stone-800/80 text-stone-800 dark:text-stone-200'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 w-full">
                          <span className="font-bold text-xs truncate max-w-[130px]">
                            {student.nama}
                          </span>
                          <span className="text-[9px] text-stone-400 dark:text-stone-500 font-medium shrink-0">
                            Kosong
                          </span>
                        </div>
                        <div className="text-[10px] text-stone-400 dark:text-stone-500 italic">
                          Belum mulai menulis
                        </div>
                      </button>
                    );
                  }

                  // Jika hanya ada 1 naskah yang cocok untuk siswa ini
                  if (matchingDocs.length === 1) {
                    const doc = matchingDocs[0];
                    const isSelected = selectedDocId === doc.id;
                    const cat = getDocQueueCategory(doc);
                    const badgeLabel = 
                      cat === 'terkumpul' ? 'Terkumpul' :
                      cat === 'revisi' ? (doc.penilaian ? `Revisi (${doc.penilaian.skorTotal})` : 'Revisi') :
                      cat === 'selesai' ? (doc.penilaian ? `Selesai (${doc.penilaian.skorTotal})` : 'Selesai') :
                      'Draf';
                    return (
                      <button
                        key={`${student.username}-${doc.id}`}
                        type="button"
                        onClick={() => {
                          onSelectStudentUsername(student.username);
                          onSelectDocId(doc.id);
                        }}
                        className={`p-2.5 rounded-xl text-left transition-all flex flex-col gap-1 cursor-pointer border ${
                          isSelected
                            ? 'bg-stone-900 text-white dark:bg-stone-800 dark:text-stone-100 border-stone-900 dark:border-amber-500/70 shadow-xs'
                            : 'bg-stone-50/70 dark:bg-stone-900/40 hover:bg-stone-100 dark:hover:bg-stone-800/60 border-stone-200/60 dark:border-stone-800/80 text-stone-800 dark:text-stone-200'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 w-full">
                          <span className="font-bold text-xs truncate max-w-[125px]">
                            {student.nama}
                          </span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full shrink-0 ${
                            isSelected
                              ? 'bg-stone-800 text-white dark:bg-stone-700 dark:text-stone-200'
                              : cat === 'terkumpul'
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                              : cat === 'revisi'
                              ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300'
                              : cat === 'selesai'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-300'
                          }`}>
                            {badgeLabel}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-1">
                          <span className={`text-[11px] font-serif-literary truncate italic flex-1 ${
                            isSelected ? 'text-stone-300 dark:text-stone-700' : 'text-stone-500 dark:text-stone-400'
                          }`}>
                            &quot;{cleanTitle(doc.judul)}&quot;
                          </span>
                        </div>

                        {doc.judulTugas && (
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium truncate flex items-center gap-1 ${
                            isSelected
                              ? 'bg-stone-800 text-blue-300 dark:bg-stone-750 dark:text-blue-300'
                              : 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-900/40'
                          }`}>
                            <BookOpen size={9} className="shrink-0" />
                            <span className="truncate">{doc.judulTugas}</span>
                          </span>
                        )}
                      </button>
                    );
                  }

                  // Jika ada lebih dari 1 naskah yang cocok untuk siswa ini
                  const hasSelectedDoc = matchingDocs.some((d) => d.id === selectedDocId);
                  return (
                    <div
                      key={student.username}
                      className={`p-2 rounded-xl border transition-all flex flex-col gap-1.5 ${
                        hasSelectedDoc
                          ? 'bg-stone-100/90 dark:bg-stone-900/90 border-stone-300 dark:border-stone-700 shadow-2xs'
                          : 'bg-stone-50/70 dark:bg-stone-900/40 border-stone-200/60 dark:border-stone-800/80'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 px-1 pt-0.5">
                        <span className="font-bold text-xs truncate text-stone-900 dark:text-stone-100 max-w-[130px]">
                          {student.nama}
                        </span>
                        <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded-full bg-stone-200 dark:bg-stone-800 text-stone-600 dark:text-stone-400 shrink-0">
                          {matchingDocs.length} Naskah
                        </span>
                      </div>

                      <div className="flex flex-col gap-1">
                        {matchingDocs.map((doc) => {
                          const isThisDocSelected = selectedDocId === doc.id;
                          const mCat = getDocQueueCategory(doc);
                          const mBadgeLabel = 
                            mCat === 'terkumpul' ? 'Terkumpul' :
                            mCat === 'revisi' ? (doc.penilaian ? `Revisi (${doc.penilaian.skorTotal})` : 'Revisi') :
                            mCat === 'selesai' ? (doc.penilaian ? `Selesai (${doc.penilaian.skorTotal})` : 'Selesai') :
                            'Draf';
                          return (
                            <button
                              key={doc.id}
                              type="button"
                              onClick={() => {
                                onSelectStudentUsername(student.username);
                                onSelectDocId(doc.id);
                              }}
                              className={`p-2 rounded-lg text-left transition-all flex flex-col gap-0.5 cursor-pointer border ${
                                isThisDocSelected
                                  ? 'bg-stone-900 text-white dark:bg-stone-800 dark:text-stone-100 border-stone-900 dark:border-amber-500/60 shadow-xs'
                                  : 'bg-white dark:bg-stone-850 hover:bg-stone-100 dark:hover:bg-stone-800 border-stone-200/80 dark:border-stone-750 text-stone-800 dark:text-stone-200'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-1 w-full">
                                <span className={`text-[11px] font-serif-literary truncate italic flex-1 ${
                                  isThisDocSelected ? 'text-white dark:text-amber-400 font-medium' : 'text-stone-700 dark:text-stone-300'
                                }`}>
                                  &quot;{cleanTitle(doc.judul)}&quot;
                                </span>
                                <span className={`text-[8.5px] font-bold px-1.5 py-0.2 rounded-full shrink-0 ${
                                  isThisDocSelected
                                    ? 'bg-stone-800 text-white dark:bg-stone-700 dark:text-stone-200'
                                    : mCat === 'terkumpul'
                                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                                    : mCat === 'revisi'
                                    ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300'
                                    : mCat === 'selesai'
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                    : 'bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-300'
                                }`}>
                                  {mBadgeLabel}
                                </span>
                              </div>

                              {doc.judulTugas && (
                                <span className={`text-[8.5px] px-1.5 py-0.5 rounded font-medium truncate flex items-center gap-1 mt-0.5 ${
                                  isThisDocSelected
                                    ? 'bg-stone-800 text-blue-300 dark:bg-stone-750 dark:text-blue-300'
                                    : 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-900/40'
                                }`}>
                                  <BookOpen size={8} className="shrink-0" />
                                  <span className="truncate">{doc.judulTugas}</span>
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </aside>
        )}

        {/* ZONA 2: Kanvas Naskah Siswa (Center Stage - PRIORITAS UTAMA) */}
        <section className="flex-1 min-w-0 h-full flex flex-col min-h-0 bg-white dark:bg-[#141416] rounded-2xl border border-stone-200/80 dark:border-stone-800 shadow-2xs overflow-hidden">
          {selectedDoc ? (
            <>
              {/* AREA TEKS TUGAS SISWA (HEADER & BANNER IKUT TER-SCROLL KE ATAS AGAR RUANG BACA LEGA) */}
              <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 bg-[#FAF9F6]/60 dark:bg-[#0c0a09]/60 custom-scrollbar">
                {/* Header Metadata Naskah (Mengalir & Ikut Ter-scroll ke Atas) */}
                <div className="max-w-4xl mx-auto mb-4 bg-white dark:bg-[#141416] p-4 sm:p-5 rounded-2xl border border-stone-200/80 dark:border-stone-800 shadow-2xs">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-2.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {(() => {
                        const selCat = getDocQueueCategory(selectedDoc);
                        const selBadgeLabel = 
                          selCat === 'terkumpul' ? 'Terkumpul (Siap Diperiksa)' :
                          selCat === 'revisi' ? `Sedang Revisi ${selectedDoc.penilaian ? `(Nilai Sementara: ${selectedDoc.penilaian.skorTotal}/100)` : ''}` :
                          selCat === 'selesai' ? `Selesai Dinilai ${selectedDoc.penilaian ? `(Nilai: ${selectedDoc.penilaian.skorTotal}/100)` : ''}` :
                          'Draf Mandiri';
                        const selBadgeColor = 
                          selCat === 'terkumpul' ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300' :
                          selCat === 'revisi' ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300' :
                          selCat === 'selesai' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' :
                          'bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-300';
                        return (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${selBadgeColor}`}>
                            {selBadgeLabel}
                          </span>
                        );
                      })()}
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-stone-100 dark:bg-stone-800/80 text-stone-600 dark:text-stone-400">
                        {totalWordCount} kata
                      </span>
                      {selectedDoc.layoutMode && (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400">
                          {selectedDoc.layoutMode === 'kertas' ? 'Kertas A4' : 'Format Web'}
                        </span>
                      )}
                      {selectedDoc.pelanggaran ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400 flex items-center gap-1">
                          <AlertTriangle size={11} /> {selectedDoc.pelanggaran}x Keluar Tab
                        </span>
                      ) : null}
                      {selectedDoc.isPublic && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300">
                          Tayang Publik
                        </span>
                      )}
                      {selectedDoc.judulTugas && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-900/40 flex items-center gap-1">
                          <BookOpen size={10} /> {selectedDoc.judulTugas}
                        </span>
                      )}
                    </div>

                    {/* Ekspor Naskah Cepat */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => exportToPdf(selectedDoc.judul, selectedDoc.nama, selectedDoc.teks, selectedDoc.topik)}
                        className="editorial-btn bg-stone-100 hover:bg-stone-200 text-stone-700 dark:bg-stone-800 dark:hover:bg-stone-700 dark:text-stone-300 text-xs px-2.5 py-1.5 cursor-pointer rounded-lg"
                        title="Cetak Naskah PDF"
                      >
                        <Printer size={13} /> <span className="hidden sm:inline">PDF</span>
                      </button>
                      <button
                        onClick={() => exportToWord(selectedDoc.judul, selectedDoc.nama, selectedDoc.teks, selectedDoc.topik)}
                        className="editorial-btn bg-stone-100 hover:bg-stone-200 text-stone-700 dark:bg-stone-800 dark:hover:bg-stone-700 dark:text-stone-300 text-xs px-2.5 py-1.5 cursor-pointer rounded-lg"
                        title="Unduh Naskah Word"
                      >
                        <FileText size={13} /> <span className="hidden sm:inline">Word</span>
                      </button>
                    </div>
                  </div>

                  <h1 className="text-xl sm:text-2xl font-bold font-serif-literary text-stone-900 dark:text-stone-100 leading-snug mb-1">
                    {cleanTitle(selectedDoc.judul)}
                  </h1>
                  <div className="text-xs text-stone-500 dark:text-stone-400 flex flex-wrap items-center gap-2">
                    <span>
                      Penulis: <strong className="text-stone-800 dark:text-stone-200">{selectedDoc.nama}</strong>
                      {selectedDoc.kolaborator && selectedDoc.kolaborator.length > 0 && (
                        <> & {selectedDoc.kolaborator.map((k) => k.nama).join(', ')}</>
                      )}
                      {' '}(@{selectedDoc.username || '-'})
                    </span>
                    {(selectedDoc.isKolaboratif || (selectedDoc.kolaborator && selectedDoc.kolaborator.length > 0)) && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                        👥 Tugas Kolaborasi
                      </span>
                    )}
                    <span className="text-stone-300 dark:text-stone-700">•</span>
                    <span className="text-[11px] font-mono text-stone-400">
                      {selectedDoc.status === 'Terkumpul' ? `Kumpul: ${selectedDoc.waktuKumpul || selectedDoc.waktuEdit || '-'}` : `Edit Terakhir: ${selectedDoc.waktuEdit || '-'}`}
                    </span>
                  </div>
                </div>

                <div className="max-w-4xl mx-auto bg-white dark:bg-[#141416] rounded-2xl border border-stone-200/80 dark:border-stone-800 p-6 sm:p-10 shadow-xs mb-8">
                  {/* Tiptap NulisEditor mode Teacher */}
                  <NulisEditor
                    key={`guru_${selectedDocId}_${selectedDoc.layoutMode || 'kertas'}_${editorKey}`}
                    initialContent={selectedDoc.teks}
                    isTeacher={true}
                    readOnly={false}
                    initialLayoutMode={selectedDoc.layoutMode || 'kertas'}
                    onLayoutModeChange={(mode) => {
                      if (selectedDocId) {
                        DataService.updateLayoutModeDokumen(selectedDocId, mode);
                      }
                    }}
                    onUpdate={async (html) => {
                      if (!html || html === '<p></p>' || html === '<p><br></p>') return;
                      await DataService.simpanDokumen(selectedDocId, selectedDoc.judul, html);
                      const tags = parseDocumentTagCounts(html);
                      const autoPenilaian = hitungPenilaianOtomatis({ ...selectedDoc, teks: html }, tags, catatanUmum);
                      await DataService.simpanPenilaian(selectedDocId, autoPenilaian, false);
                      if (dokumenMap[selectedDocId]) {
                        dokumenMap[selectedDocId].teks = html;
                        dokumenMap[selectedDocId].penilaian = autoPenilaian;
                      }
                      if (onDokumenUpdated) onDokumenUpdated();
                    }}
                  />
                </div>

                {/* Moderasi Komentar Publik jika sudah tayang */}
                {selectedDoc.isPublic && (
                  <div className="max-w-4xl mx-auto p-5 bg-white dark:bg-[#141416] border border-stone-200/80 dark:border-stone-800 rounded-2xl shadow-xs mb-8">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 border-b border-stone-100 dark:border-stone-800 pb-2 mb-3 flex items-center gap-1.5">
                      <MessageSquare size={14} className="text-blue-600 dark:text-blue-400" />
                      <span>Moderasi Komentar Ruang Publik ({moderasiKomentar.length})</span>
                    </h4>
                    <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
                      {moderasiKomentar.length === 0 ? (
                        <p className="text-xs text-stone-400 dark:text-stone-500">Belum ada komentar publik pada naskah ini.</p>
                      ) : (
                        moderasiKomentar.map((k) => (
                          <div
                            key={k.id}
                            className="p-2.5 bg-stone-50 dark:bg-stone-900 rounded-xl border border-stone-100 dark:border-stone-800 flex justify-between items-center text-xs"
                          >
                            <div>
                              <strong style={{ color: stringToColor(k.nama) }}>{k.nama}:</strong>{' '}
                              <span className="text-stone-700 dark:text-stone-300">{k.teks}</span>
                            </div>
                            <button
                              onClick={async () => {
                                await DataService.hapusKomentar(selectedDocId, k.id);
                              }}
                              className="p-1 rounded text-stone-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
                              title="Hapus Komentar"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-stone-400">
              <BookOpen size={48} className="text-stone-300 dark:text-stone-700 mb-3" />
              <h3 className="text-base font-bold font-serif-literary text-stone-800 dark:text-stone-200 mb-1">
                Belum Ada Naskah yang Dipilih
              </h3>
              <p className="text-xs text-stone-400 dark:text-stone-500 max-w-sm">
                Pilih salah satu siswa dari antrean di sebelah kiri untuk mulai membaca, mengoreksi teks, dan memberi umpan balik.
              </p>
            </div>
          )}
        </section>

        {/* ZONA 3: Inspektor Catatan & Analisis (Ramping & Proporsional: 270px) */}
        <aside className="w-[270px] shrink-0 h-full flex flex-col min-h-0 bg-white dark:bg-[#141416] rounded-2xl border border-stone-200/80 dark:border-stone-800 shadow-2xs overflow-hidden">
          {selectedDoc ? (
            <>
              {/* Header Catatan & Analisis dengan Auto-save Status */}
              <div className="shrink-0 px-3.5 py-2.5 bg-stone-50/90 dark:bg-stone-900/60 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between">
                <span className="text-xs font-semibold text-stone-600 dark:text-stone-400">
                  Umpan Balik
                </span>
                <div className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium shrink-0 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200/60 dark:border-emerald-800/60">
                  <CloudCheck size={12} className={catatanSavedNotice ? 'animate-pulse' : ''} />
                  <span>{catatanSavedNotice ? 'Tersimpan!' : 'Auto-save'}</span>
                </div>
              </div>

              {/* Inspector Tabs (HANYA Catatan vs Analisis, Rubrik Dihapus) */}
              <div className="shrink-0 grid grid-cols-2 border-b border-stone-100 dark:border-stone-800 text-xs font-semibold">
                <button
                  onClick={() => setActiveInspectorTab('catatan')}
                  className={`py-2 text-center transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                    activeInspectorTab === 'catatan'
                      ? 'border-b-2 border-stone-900 dark:border-stone-100 text-stone-900 dark:text-stone-100 bg-stone-50/50 dark:bg-stone-900/50 font-bold'
                      : 'text-stone-400 hover:text-stone-700 dark:hover:text-stone-200'
                  }`}
                >
                  <FileEdit size={13} /> Catatan
                </button>
                <button
                  onClick={() => setActiveInspectorTab('info')}
                  className={`py-2 text-center transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                    activeInspectorTab === 'info'
                      ? 'border-b-2 border-stone-900 dark:border-stone-100 text-stone-900 dark:text-stone-100 bg-stone-50/50 dark:bg-stone-900/50 font-bold'
                      : 'text-stone-400 hover:text-stone-700 dark:hover:text-stone-200'
                  }`}
                >
                  <BarChart2 size={13} /> Analisis
                </button>
              </div>

              {/* Isi Tab (Scroll Mandiri di Dalam Inspektor) */}
              <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3 custom-scrollbar">
                {/* TAB 1: CATATAN GURU */}
                {activeInspectorTab === 'catatan' && (
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-stone-700 dark:text-stone-300">
                        Umpan Balik Guru
                      </span>
                      <span className="text-[10px] text-stone-400 font-mono">Ketik / untuk variabel</span>
                    </div>

                    <div className="relative">
                      <textarea
                        ref={catatanTextareaRef}
                        value={catatanUmum}
                        onChange={(e) => handleCatatanTextChange(e.target.value)}
                        onKeyDown={(e) => handleCatatanKeyDown(e)}
                        placeholder="Tulis catatan apresiasi atau ketik / untuk aspek rubrik..."
                        rows={7}
                        className="editorial-input w-full p-2.5 text-xs bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-750 dark:text-stone-100 rounded-xl leading-relaxed resize-none"
                      />

                      {/* Dropdown Slash Command Menu */}
                      {slashOpen && filteredSlashOptions.length > 0 && (
                        <div
                          className="absolute left-0 right-0 bottom-full mb-1 z-50 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl shadow-2xl p-1.5 max-h-56 overflow-y-auto custom-scrollbar animate-in zoom-in-95"
                        >
                          <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-stone-400 dark:text-stone-500 border-b border-stone-100 dark:border-stone-800 mb-1 flex items-center justify-between">
                            <span>Pilih Variabel Rubrik (/{slashQuery})</span>
                            <span className="text-[9px] text-stone-400 font-normal">Enter: Terapkan</span>
                          </div>
                          <div className="flex flex-col gap-0.5">
                            {filteredSlashOptions.map((opt, idx) => {
                              const isSel = idx === slashIndex;
                              return (
                                <button
                                  key={opt.id}
                                  type="button"
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    handleInsertCatatanOption(opt);
                                  }}
                                  className={`w-full flex items-center justify-between p-2 rounded-lg text-left text-xs transition-colors cursor-pointer ${
                                    isSel
                                      ? 'bg-amber-600 text-white dark:bg-amber-600 dark:text-white shadow-xs font-semibold'
                                      : 'text-stone-800 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800'
                                  }`}
                                >
                                  <div className="truncate mr-2">
                                    <div className="font-semibold text-xs leading-tight">{opt.label}</div>
                                    <div className={`text-[10px] truncate ${isSel ? 'text-amber-100' : 'text-stone-400 dark:text-stone-500'}`}>
                                      {opt.template}
                                    </div>
                                  </div>
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono shrink-0 ${
                                    isSel ? 'bg-amber-700 text-amber-100' : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400'
                                  }`}>
                                    {opt.tag}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-stone-400 pt-1 border-t border-stone-100 dark:border-stone-800">
                      <span className="flex items-center gap-1">
                        <CloudCheck size={11} className="text-stone-400" />
                        <span>Otomatis disimpan real-time</span>
                      </span>
                      {catatanSavedNotice && (
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-0.5 animate-in fade-in">
                          <Check size={11} /> Tersimpan
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* TAB 2: ANALISIS & DETEKSI NASKAH */}
                {activeInspectorTab === 'info' && (
                  <div className="space-y-2.5 text-xs">
                    {/* Pelanggaran Keluar Tab */}
                    <div className="p-2.5 rounded-xl bg-stone-50 dark:bg-stone-900/60 border border-stone-200/60 dark:border-stone-800 flex justify-between items-center">
                      <span className="text-stone-600 dark:text-stone-400 flex items-center gap-1.5">
                        <ShieldAlert size={14} className={selectedDoc.pelanggaran ? "text-red-500" : "text-emerald-500"} />
                        <span>Sanksi Tab:</span>
                      </span>
                      <span className={`font-bold font-mono ${selectedDoc.pelanggaran ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                        {selectedDoc.pelanggaran || 0}x Keluar
                      </span>
                    </div>

                    {/* Total Kata */}
                    <div className="p-2.5 rounded-xl bg-stone-50 dark:bg-stone-900/60 border border-stone-200/60 dark:border-stone-800 flex justify-between items-center">
                      <span className="text-stone-600 dark:text-stone-400 flex items-center gap-1.5">
                        <FileText size={14} className="text-stone-400" />
                        <span>Total Kata:</span>
                      </span>
                      <span className="font-bold font-mono text-stone-900 dark:text-stone-100">
                        {totalWordCount} kata
                      </span>
                    </div>

                    {/* Estimasi Waktu Baca */}
                    <div className="p-2.5 rounded-xl bg-stone-50 dark:bg-stone-900/60 border border-stone-200/60 dark:border-stone-800 flex justify-between items-center">
                      <span className="text-stone-600 dark:text-stone-400 flex items-center gap-1.5">
                        <Clock size={14} className="text-stone-400" />
                        <span>Estimasi Baca:</span>
                      </span>
                      <span className="font-bold font-mono text-stone-900 dark:text-stone-100">
                        ±{Math.max(1, Math.ceil(totalWordCount / 180))} menit
                      </span>
                    </div>

                    {/* Tag Mikro Koreksi Inline */}
                    <div className="p-2.5 rounded-xl bg-stone-50 dark:bg-stone-900/60 border border-stone-200/60 dark:border-stone-800 space-y-1.5">
                      <span className="text-[10px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider block">
                        Koreksi Inline Terdeteksi:
                      </span>
                      {detectedTagCounts && Object.entries(detectedTagCounts).some(([k, c]) => !k.startsWith('_') && typeof c === 'number' && c > 0) ? (
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(detectedTagCounts)
                            .filter(([k, count]) => !k.startsWith('_') && typeof count === 'number' && count > 0)
                            .map(([k, c]) => {
                              const resCount = detectedTagCounts._resolved?.[k] || 0;
                              return (
                                <span
                                  key={k}
                                  className={`px-2 py-0.5 rounded-md text-[10px] font-semibold flex items-center gap-1 ${
                                    resCount > 0
                                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                                      : 'bg-stone-200 dark:bg-stone-800 text-stone-800 dark:text-stone-200'
                                  }`}
                                >
                                  <span>{k}: {c}x</span>
                                  {resCount > 0 && <span className="text-[9px] font-bold">({resCount} direvisi ✓)</span>}
                                </span>
                              );
                            })}
                        </div>
                      ) : (
                        <p className="text-[11px] text-stone-400 italic">Belum ada tag koreksi inline disisipkan.</p>
                      )}
                    </div>

                    {/* Skor Rubrik & Penilaian Otomatis (Live) */}
                    {(() => {
                      const currentPenilaian = selectedDoc.penilaian || hitungPenilaianOtomatis(selectedDoc, detectedTagCounts || undefined, catatanUmum);
                      return (
                        <div className="p-2.5 rounded-xl bg-stone-50 dark:bg-stone-900/60 border border-stone-200/60 dark:border-stone-800 space-y-2">
                          <div className="flex items-center justify-between border-b border-stone-200/50 dark:border-stone-800 pb-1.5">
                            <span className="text-[10px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
                              Skor Rubrik Otomatis:
                            </span>
                            <span className="text-xs font-bold font-mono px-2 py-0.5 rounded-md bg-stone-200 dark:bg-stone-800 text-stone-900 dark:text-stone-100">
                              {currentPenilaian.skorTotal}/100 • {currentPenilaian.predikat}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                            <div className="p-1.5 rounded-lg bg-white dark:bg-stone-800/60 border border-stone-200/50 dark:border-stone-700/50">
                              <span className="text-[10px] text-stone-400 block">Makro (50%)</span>
                              <span className="font-bold font-mono text-stone-800 dark:text-stone-200">{currentPenilaian.skorMakro}</span>
                            </div>
                            <div className="p-1.5 rounded-lg bg-white dark:bg-stone-800/60 border border-stone-200/50 dark:border-stone-700/50">
                              <span className="text-[10px] text-stone-400 block">Mikro (50%)</span>
                              <span className="font-bold font-mono text-stone-800 dark:text-stone-200">{currentPenilaian.skorMikro}</span>
                            </div>
                          </div>

                          <div className="space-y-1 pt-1">
                            <span className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block">
                              9 Aspek Koreksi (Skala 1 - 5):
                            </span>
                            <div className="grid grid-cols-1 gap-1">
                              {RUBRIC_ASPECTS.map((asp) => {
                                const score = (currentPenilaian as any)[asp.id] ?? 5.0;
                                return (
                                  <div key={asp.id} className="flex items-center justify-between text-[11px] py-0.5 px-1.5 rounded bg-white/70 dark:bg-stone-800/40 border border-stone-100 dark:border-stone-800">
                                    <span className="text-stone-600 dark:text-stone-400 truncate mr-2">{asp.name}</span>
                                    <span className={`font-mono font-bold ${score < 5.0 ? 'text-amber-600 dark:text-amber-400' : 'text-stone-700 dark:text-stone-300'}`}>
                                      {score.toFixed(1)}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* Status Dokumen & Tindakan (Footer Inspektor) */}
              <div className="shrink-0 p-3 bg-stone-50/70 dark:bg-stone-900/40 border-t border-stone-100 dark:border-stone-800 space-y-1.5">
                {selectedDoc.teks && selectedDoc.teks.includes('<mark') && (
                  <button
                    onClick={handleTandaiSemuaDirevisi}
                    className="editorial-btn w-full bg-emerald-50 hover:bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 text-[11px] py-1.5 cursor-pointer shadow-2xs justify-center font-medium transition-colors"
                    title="Tandai semua catatan koreksi telah selesai direvisi dan pulihkan nilai aspek (tanpa mengubah status Selesai)"
                  >
                    <CheckCircle size={13} className="text-emerald-600 dark:text-emerald-400" /> Tandai Telah Direvisi Semua
                  </button>
                )}

                {selectedDoc.status === 'Draf' && (
                  <div className="space-y-1.5">
                    <div className="p-2 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40 text-[10px] text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                      <Sparkles size={12} className="shrink-0 text-amber-600 dark:text-amber-400" />
                      <span>
                        {selectedDoc.penilaian 
                          ? `Sedang direvisi siswa (Nilai Sementara: ${selectedDoc.penilaian.skorTotal}/100 - ${selectedDoc.penilaian.predikat}). Nilai & catatan melekat otomatis.` 
                          : 'Sedang dikerjakan siswa. Bimbingan & nilai Anda otomatis melekat dan tampil di lobi siswa.'}
                      </span>
                    </div>
                    <button
                      onClick={() => onTandaiSelesai(false)}
                      className="editorial-btn w-full bg-stone-900 hover:bg-stone-800 text-white dark:bg-stone-800 dark:hover:bg-stone-700 dark:text-stone-100 dark:border dark:border-stone-700 text-[11px] py-1.5 cursor-pointer justify-center shadow-xs"
                      title="Selesaikan bimbingan dan kunci naskah sebagai selesai"
                    >
                      <Check size={13} /> Tandai Selesai Langsung
                    </button>
                  </div>
                )}

                {selectedDoc.status === 'Terkumpul' && (
                  <div className="space-y-1.5">
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        onClick={() => onTandaiSelesai(false)}
                        className="editorial-btn bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] py-1.5 cursor-pointer shadow-xs justify-center"
                        title="Tandai naskah telah selesai dinilai (kunci nilai akhir)"
                      >
                        <Check size={13} /> Selesai
                      </button>
                      <button
                        onClick={() => onTandaiSelesai(true)}
                        className="editorial-btn bg-blue-600 hover:bg-blue-700 text-white text-[11px] py-1.5 cursor-pointer shadow-xs justify-center"
                        title="Selesaikan dan terbitkan langsung ke Pojok Baca Sekolah"
                      >
                        <Sparkles size={13} /> Terbitkan
                      </button>
                    </div>
                    <button
                      onClick={handleMintaRevisi}
                      className="editorial-btn w-full bg-amber-600 hover:bg-amber-700 text-white text-[11px] py-1.5 cursor-pointer shadow-xs justify-center font-semibold"
                      title="Kembalikan naskah ke siswa untuk perbaikan lanjutan. Nilai dan catatan bimbingan tetap melekat."
                    >
                      <RotateCcw size={12} /> Kembalikan ke Siswa untuk Revisi
                    </button>
                  </div>
                )}

                {selectedDoc.status === 'Selesai' && !selectedDoc.isPublic && (
                  <div className="space-y-1.5">
                    <button
                      onClick={() => onTandaiSelesai(true)}
                      className="editorial-btn w-full bg-blue-600 hover:bg-blue-700 text-white text-[11px] py-1.5 cursor-pointer shadow-xs justify-center"
                    >
                      <Sparkles size={13} /> Terbitkan ke Ruang Publik
                    </button>
                    <button
                      onClick={handleMintaRevisi}
                      className="editorial-btn w-full bg-stone-100 hover:bg-stone-200 text-stone-700 dark:bg-stone-800 dark:hover:bg-stone-700 dark:text-stone-300 text-[11px] py-1.5 cursor-pointer justify-center"
                      title="Buka kembali untuk revisi tambahan dari siswa"
                    >
                      <RotateCcw size={12} /> Buka Kembali untuk Revisi Siswa
                    </button>
                  </div>
                )}

                {selectedDoc.isPublic && (
                  <button
                    onClick={async () => {
                      await DataService.takeDownMading(selectedDocId);
                    }}
                    className="editorial-btn w-full bg-amber-50 hover:bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-800/80 text-[11px] py-1.5 border border-amber-200 cursor-pointer justify-center"
                  >
                    Tarik dari Ruang Publik
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center p-6 text-center text-xs text-stone-400">
              Pilih siswa di antrean untuk memberi catatan & tindakan.
            </div>
          )}
        </aside>
      </div>

      {/* Mode Fokus Canvas Layar Penuh (Zen Mode Opsi Tambahan) */}
      {isFocusMode && selectedDoc && (
        <div className="fixed inset-0 z-50 bg-[#FAF9F6] dark:bg-[#121214] flex flex-col overflow-hidden animate-in fade-in duration-150">
          <header className="px-4 sm:px-8 py-2.5 bg-white/95 dark:bg-[#18181B]/95 backdrop-blur-md border-b border-stone-200 dark:border-stone-800 flex items-center justify-between gap-4 shrink-0 shadow-2xs">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setIsFocusMode(false)}
                className="editorial-btn bg-stone-100 hover:bg-stone-200 text-stone-700 dark:bg-stone-800 dark:hover:bg-stone-700 dark:text-stone-300 px-3 py-1.5 text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-2xs"
                title="Keluar dari Mode Fokus (Esc)"
              >
                <Minimize2 size={14} /> Keluar Fokus
              </button>
              <div className="border-l border-stone-200 dark:border-stone-800 pl-3 min-w-0">
                <h3 className="text-sm font-bold font-serif-literary text-stone-900 dark:text-stone-100 truncate">
                  {cleanTitle(selectedDoc.judul)}
                </h3>
                <div className="text-xs text-stone-500 dark:text-stone-400 truncate">
                  Penulis: <strong className="text-stone-800 dark:text-stone-200">{selectedDoc.nama}</strong> (@{selectedDoc.username || '-'})
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleNavigateQueue(-1)}
                className="editorial-btn bg-stone-100 hover:bg-stone-200 text-stone-700 dark:bg-stone-800 dark:hover:bg-stone-700 dark:text-stone-300 px-3 py-1.5 text-xs font-semibold rounded-xl flex items-center gap-1 cursor-pointer"
                title="Tugas Sebelumnya"
              >
                <ChevronLeft size={14} /> Sebelumnya
              </button>
              <button
                type="button"
                onClick={() => handleNavigateQueue(1)}
                className="editorial-btn bg-stone-900 hover:bg-stone-800 text-white dark:bg-stone-800 dark:hover:bg-stone-700 dark:text-stone-100 dark:border dark:border-stone-700 px-3.5 py-1.5 text-xs font-bold rounded-xl flex items-center gap-1 cursor-pointer shadow-xs"
                title="Tugas Berikutnya"
              >
                Berikutnya <ChevronRight size={14} />
              </button>
              <button
                type="button"
                onClick={() => setShowFocusCatatan(!showFocusCatatan)}
                className={`editorial-btn text-xs py-1.5 px-3 rounded-xl border flex items-center gap-1.5 cursor-pointer transition-colors ${
                  showFocusCatatan
                    ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-800 font-semibold'
                    : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border-transparent hover:bg-stone-200'
                }`}
              >
                <Edit2 size={13} /> Catatan
              </button>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto p-4 sm:p-8 flex justify-center relative custom-scrollbar">
            <div className="w-full max-w-4xl bg-white dark:bg-[#18181B] p-6 sm:p-12 rounded-2xl shadow-sm border border-stone-200/80 dark:border-stone-800 my-auto">
              <NulisEditor
                key={`focus_${selectedDocId}_${selectedDoc.layoutMode || 'kertas'}_${editorKey}`}
                initialContent={selectedDoc.teks}
                isTeacher={true}
                readOnly={false}
                initialLayoutMode={selectedDoc.layoutMode || 'kertas'}
                onLayoutModeChange={(mode) => {
                  if (selectedDocId) {
                    DataService.updateLayoutModeDokumen(selectedDocId, mode);
                  }
                }}
                onUpdate={async (html) => {
                  if (!html || html === '<p></p>' || html === '<p><br></p>') return;
                  await DataService.simpanDokumen(selectedDocId, selectedDoc.judul, html);
                  const tags = parseDocumentTagCounts(html);
                  const autoPenilaian = hitungPenilaianOtomatis({ ...selectedDoc, teks: html }, tags, catatanUmum);
                  await DataService.simpanPenilaian(selectedDocId, autoPenilaian, false);
                  if (dokumenMap[selectedDocId]) {
                    dokumenMap[selectedDocId].teks = html;
                    dokumenMap[selectedDocId].penilaian = autoPenilaian;
                  }
                  if (onDokumenUpdated) onDokumenUpdated();
                }}
              />
            </div>

            {/* Popover Catatan Guru */}
            {showFocusCatatan && (
              <div className="fixed bottom-6 right-6 z-50 w-80 sm:w-96 bg-white dark:bg-[#18181B] border border-stone-300 dark:border-stone-700 rounded-2xl shadow-2xl p-4 animate-in slide-in-from-bottom-4">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-stone-100 dark:border-stone-800">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
                    <Edit2 size={13} /> Catatan Umum Guru
                  </h4>
                  <button
                    type="button"
                    onClick={() => setShowFocusCatatan(false)}
                    className="text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 p-0.5 rounded cursor-pointer"
                  >
                    <X size={15} />
                  </button>
                </div>

                <div className="relative">
                  <textarea
                    value={catatanUmum}
                    onChange={(e) => handleCatatanTextChange(e.target.value, e.target)}
                    onKeyDown={(e) => handleCatatanKeyDown(e, e.currentTarget)}
                    placeholder="Tulis catatan (Ketik / untuk cari aspek rubrik)..."
                    rows={4}
                    className="editorial-input w-full p-2.5 text-xs bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-750 dark:text-stone-100 mb-2 rounded-lg resize-none"
                  />

                  {slashOpen && filteredSlashOptions.length > 0 && (
                    <div
                      className="absolute left-0 right-0 bottom-full mb-1 z-50 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl shadow-2xl p-1.5 max-h-52 overflow-y-auto custom-scrollbar animate-in zoom-in-95"
                    >
                      <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-stone-400 dark:text-stone-500 border-b border-stone-100 dark:border-stone-800 mb-1 flex items-center justify-between">
                        <span>Pilih Variabel Rubrik (/{slashQuery})</span>
                        <span className="text-[9px] text-stone-400 font-normal">Enter: Terapkan</span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        {filteredSlashOptions.map((opt, idx) => {
                          const isSel = idx === slashIndex;
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                handleInsertCatatanOption(opt);
                              }}
                              className={`w-full flex items-center justify-between p-2 rounded-lg text-left text-xs transition-colors cursor-pointer ${
                                isSel
                                  ? 'bg-amber-600 text-white dark:bg-amber-600 dark:text-white shadow-xs font-semibold'
                                  : 'text-stone-800 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800'
                              }`}
                            >
                              <div className="truncate mr-2">
                                <div className="font-semibold text-xs leading-tight">{opt.label}</div>
                                <div className={`text-[10px] truncate ${isSel ? 'text-amber-100' : 'text-stone-400 dark:text-stone-500'}`}>
                                  {opt.template}
                                </div>
                              </div>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono shrink-0 ${
                                isSel ? 'bg-amber-700 text-amber-100' : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400'
                              }`}>
                                {opt.tag}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between text-[11px] text-stone-400">
                  <span className="flex items-center gap-1">
                    <CloudCheck size={12} /> Auto-save aktif
                  </span>
                  {catatanSavedNotice && (
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1 animate-in fade-in">
                      <Check size={12} /> Tersimpan
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
