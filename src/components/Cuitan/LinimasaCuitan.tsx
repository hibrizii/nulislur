import React, { useState, useEffect, useMemo } from 'react';
import { 
  Heart, 
  MessageSquare, 
  Trash2, 
  Send, 
  CornerDownRight, 
  Sparkles, 
  Clock, 
  AlertCircle,
  Check,
  Edit3
} from 'lucide-react';
import { DataService, stringToColor } from '../../services/dataService';
import type { CuitanItem, CuitanKomentar } from '../../types';

interface LinimasaCuitanProps {
  currentUser: {
    username: string;
    nama: string;
    role: 'siswa' | 'guru' | 'admin';
    kodeKelas?: string;
    namaKelas?: string;
    sekolahId?: string;
    namaSekolah?: string;
  };
}

export const LinimasaCuitan: React.FC<LinimasaCuitanProps> = ({ currentUser }) => {
  const [cuitanList, setCuitanList] = useState<CuitanItem[]>([]);
  
  // State Input Cuitan Baru
  const [teksCuitan, setTeksCuitan] = useState<string>('');
  const [isSubmittingCuitan, setIsSubmittingCuitan] = useState<boolean>(false);
  const [cuitanError, setCuitanError] = useState<string>('');
  const [cuitanSuccessNotice, setCuitanSuccessNotice] = useState<string>('');

  // State Edit Cuitan
  const [editingCuitan, setEditingCuitan] = useState<{ id: string; teks: string } | null>(null);
  const [isUpdatingCuitan, setIsUpdatingCuitan] = useState<boolean>(false);

  // State Komentar & Balasan Terbuka
  // Set of cuitanId yang kolom komentarnya sedang dibuka
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({});
  
  // State Input Komentar Level 1 (per cuitanId)
  const [komentarInputs, setKomentarInputs] = useState<Record<string, string>>({});
  
  // State Input Balasan Level 2 ({ cuitanId, parentCommentId, replyToUsername } | null)
  const [activeReplyBox, setActiveReplyBox] = useState<{
    cuitanId: string;
    parentId: string;
    replyToUsername: string;
  } | null>(null);
  const [replyInputText, setReplyInputText] = useState<string>('');

  // Modal Konfirmasi Hapus
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: 'cuitan' | 'komentar';
    cuitanId: string;
    komentarId?: string;
  } | null>(null);

  // 1. Sinkronisasi Data Real-time Cuitan
  useEffect(() => {
    const unsub = DataService.listenCuitan((list) => {
      setCuitanList(list);
    });
    return () => unsub();
  }, []);

  // 2. Cek apakah user (siswa) sudah membuat cuitan hari ini
  const hasPostedToday = useMemo(() => {
    if (currentUser.role === 'guru' || currentUser.role === 'admin') return false; // Guru & Admin bebas cuit
    const cleanCurrent = currentUser.username.toLowerCase();
    return cuitanList.some(
      (c) => c.username.toLowerCase() === cleanCurrent && DataService.isCuitanHariIni(c)
    );
  }, [cuitanList, currentUser.username, currentUser.role]);

  // Handler Simpan Edit Cuitan
  const handleSaveEditCuitan = async () => {
    if (!editingCuitan || !editingCuitan.teks.trim()) return;
    setIsUpdatingCuitan(true);
    try {
      const res = await DataService.editCuitan(editingCuitan.id, editingCuitan.teks, currentUser.username);
      if (res.success) {
        setEditingCuitan(null);
      } else {
        alert(res.message);
      }
    } catch {
      alert('Terjadi kesalahan saat menyimpan perubahan cuitan.');
    } finally {
      setIsUpdatingCuitan(false);
    }
  };

  // 3. Linimasa Sekolah (Cuitan terisolasi per sekolah)
  const filteredCuitan = useMemo(() => {
    return cuitanList.filter((c) => {
      if (currentUser.sekolahId && c.sekolahId) {
        return c.sekolahId === currentUser.sekolahId;
      }
      return true;
    });
  }, [cuitanList, currentUser.sekolahId]);

  // Handler Like Cuitan (Seketika < 1ms Optimistic UI)
  const handleToggleLikeCuitan = (cuitanId: string) => {
    setCuitanList((prev) =>
      prev.map((c) => {
        if (c.id !== cuitanId) return c;
        const currentLikes = c.likes || [];
        const hasLiked = currentLikes.includes(currentUser.username);
        const newLikes = hasLiked
          ? currentLikes.filter((u) => u !== currentUser.username)
          : [...currentLikes, currentUser.username];
        return { ...c, likes: newLikes };
      })
    );
    DataService.toggleLikeCuitan(cuitanId, currentUser.username);
  };

  // Handler Like Komentar / Balasan (Seketika < 1ms Optimistic UI)
  const handleToggleLikeKomentar = (cuitanId: string, komentarId: string) => {
    setCuitanList((prev) =>
      prev.map((c) => {
        if (c.id !== cuitanId) return c;
        return {
          ...c,
          komentar: (c.komentar || []).map((k) => {
            if (k.id !== komentarId) return k;
            const currentLikes = k.likes || [];
            const hasLiked = currentLikes.includes(currentUser.username);
            const newLikes = hasLiked
              ? currentLikes.filter((u) => u !== currentUser.username)
              : [...currentLikes, currentUser.username];
            return { ...k, likes: newLikes };
          }),
        };
      })
    );
    DataService.toggleLikeKomentar(cuitanId, komentarId, currentUser.username);
  };

  // Handler Buat Cuitan Baru (Optimistic UI & Instant Input Clear)
  const handlePostCuitan = async (e: React.FormEvent) => {
    e.preventDefault();
    setCuitanError('');
    const cleanTeks = teksCuitan.trim();

    if (!cleanTeks) {
      setCuitanError('Tuliskan sesuatu untuk membagikan cuitan.');
      return;
    }
    if (cleanTeks.length > 350) {
      setCuitanError('Panjang cuitan maksimal 350 karakter.');
      return;
    }

    if (currentUser.role === 'siswa' && hasPostedToday) {
      setCuitanError('Jatah cuitan harianmu sudah digunakan (maks. 1 cuitan/hari).');
      return;
    }

    const textToSend = cleanTeks;
    setTeksCuitan('');
    setCuitanSuccessNotice('Cuitan berhasil dikirim!');
    setTimeout(() => setCuitanSuccessNotice(''), 3000);

    const tempCuitanId = 'cuit_' + Date.now();
    const today = new Date();
    const todayLocalIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const optimisticCuitan: CuitanItem = {
      id: tempCuitanId,
      username: currentUser.username,
      teks: textToSend,
      waktu: 'Baru saja',
      tanggal: todayLocalIso,
      createdAt: Date.now(),
      kodeKelas: currentUser.kodeKelas || 'Umum',
      namaKelas: currentUser.namaKelas,
      sekolahId: currentUser.sekolahId,
      namaSekolah: currentUser.namaSekolah,
      likes: [],
      komentar: [],
    };

    setCuitanList((prev) => [optimisticCuitan, ...prev]);
    setIsSubmittingCuitan(true);

    try {
      const res = await DataService.tambahCuitan({
        username: currentUser.username,
        role: currentUser.role,
        teks: textToSend,
        kodeKelas: currentUser.kodeKelas,
        namaKelas: currentUser.namaKelas,
        sekolahId: currentUser.sekolahId,
        namaSekolah: currentUser.namaSekolah,
      });

      if (!res.success) {
        setCuitanError(res.message);
        setCuitanList((prev) => prev.filter((c) => c.id !== tempCuitanId));
        setTeksCuitan(textToSend);
      }
    } catch (err: any) {
      setCuitanError(err?.message || 'Terjadi gangguan saat mengirim cuitan.');
      setCuitanList((prev) => prev.filter((c) => c.id !== tempCuitanId));
      setTeksCuitan(textToSend);
    } finally {
      setIsSubmittingCuitan(false);
    }
  };

  // Toggle Buka/Tutup Komentar
  const toggleComments = (cuitanId: string) => {
    setOpenComments((prev) => ({
      ...prev,
      [cuitanId]: !prev[cuitanId],
    }));
  };

  // Handler Kirim Komentar Level 1 (Seketika < 1ms Optimistic)
  const handlePostKomentarLevel1 = (cuitanId: string) => {
    const text = (komentarInputs[cuitanId] || '').trim();
    if (!text) return;

    // 1. Kosongkan input dan buka komentar seketika
    setKomentarInputs((prev) => ({ ...prev, [cuitanId]: '' }));
    setOpenComments((prev) => ({ ...prev, [cuitanId]: true }));

    // 2. Tambah komentar ke state seketika
    const tempId = 'kom_' + Date.now();
    const optimisticKomentar: CuitanKomentar = {
      id: tempId,
      cuitanId,
      parentId: null,
      replyToUsername: null,
      username: currentUser.username,
      teks: text,
      waktu: 'Baru saja',
      likes: [],
    };

    setCuitanList((prev) =>
      prev.map((c) => {
        if (c.id !== cuitanId) return c;
        return {
          ...c,
          komentar: [...(c.komentar || []), optimisticKomentar],
        };
      })
    );

    // 3. Simpan di DataService (background local-first)
    DataService.tambahKomentarCuitan({
      cuitanId,
      parentId: null,
      replyToUsername: null,
      username: currentUser.username,
      teks: text,
    });
  };

  // Handler Kirim Balasan Level 2 (Seketika < 1ms Optimistic)
  const handlePostReplyLevel2 = () => {
    if (!activeReplyBox) return;
    const cleanText = replyInputText.trim();
    if (!cleanText) return;

    const { cuitanId, parentId, replyToUsername } = activeReplyBox;

    // 1. Tutup form balasan seketika
    setActiveReplyBox(null);
    setReplyInputText('');

    // 2. Tambah balasan ke state seketika
    const tempId = 'kom_' + Date.now();
    const optimisticReply: CuitanKomentar = {
      id: tempId,
      cuitanId,
      parentId,
      replyToUsername,
      username: currentUser.username,
      teks: cleanText,
      waktu: 'Baru saja',
      likes: [],
    };

    setCuitanList((prev) =>
      prev.map((c) => {
        if (c.id !== cuitanId) return c;
        return {
          ...c,
          komentar: [...(c.komentar || []), optimisticReply],
        };
      })
    );

    // 3. Simpan di DataService
    DataService.tambahKomentarCuitan({
      cuitanId,
      parentId,
      replyToUsername,
      username: currentUser.username,
      teks: cleanText,
    });
  };

  // Handler Eksekusi Hapus (Seketika < 1ms Optimistic)
  const handleExecuteDelete = () => {
    if (!deleteConfirm) return;
    const { type, cuitanId, komentarId } = deleteConfirm;
    setDeleteConfirm(null);

    if (type === 'cuitan') {
      setCuitanList((prev) => prev.filter((c) => c.id !== cuitanId));
      DataService.hapusCuitan(cuitanId);
    } else if (type === 'komentar' && komentarId) {
      setCuitanList((prev) =>
        prev.map((c) => {
          if (c.id !== cuitanId) return c;
          return {
            ...c,
            komentar: (c.komentar || []).filter(
              (k) => k.id !== komentarId && k.parentId !== komentarId
            ),
          };
        })
      );
      DataService.hapusKomentarCuitan(cuitanId, komentarId);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-4 animate-in fade-in duration-200">
      {/* 1. Header Linimasa */}
      <div className="editorial-card p-3 sm:px-4 bg-white dark:bg-[#141416] rounded-2xl border border-stone-200/80 dark:border-stone-800 flex items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 flex items-center justify-center shrink-0">
            <MessageSquare size={16} />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold font-serif-literary text-stone-900 dark:text-stone-100">
              Linimasa Cuitan
            </h2>
            <p className="text-[11px] text-stone-500 dark:text-stone-400">
              Wadah publik berbagi sekelumit gagasan, kutipan, dan inspirasi menulis ringkas
            </p>
          </div>
        </div>
      </div>

      {/* 2. Form Buat Cuitan Baru (Atau Informasi Jatah Habis) */}
      <div className="editorial-card p-4 sm:p-5 bg-white dark:bg-[#161618] rounded-2xl shadow-xs">
        {hasPostedToday ? (
          /* Jatah cuitan habis hari ini */
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-[#FAF4EB] dark:bg-[#221A12] text-xs text-[#7A5425] dark:text-[#E8CFB0]">
            <Sparkles size={16} className="text-[#8F6533] dark:text-[#D9B27F] shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-semibold text-stone-900 dark:text-stone-100">
                Kamu telah membagikan cuitan hari ini.
              </p>
              <p className="text-stone-600 dark:text-stone-300 text-[11px] leading-relaxed">
                Kamu dapat membuat cuitan baru lagi besok.
              </p>
            </div>
          </div>
        ) : (
          /* Form input cuitan */
          <form onSubmit={handlePostCuitan} className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="w-7 h-7 rounded-full text-white font-bold text-xs flex items-center justify-center shadow-2xs"
                  style={{ backgroundColor: stringToColor(currentUser.username) }}
                >
                  {currentUser.username[0]?.toUpperCase()}
                </div>
                <span className="text-xs font-mono font-bold text-stone-800 dark:text-stone-200">
                  @{currentUser.username}
                </span>
              </div>
              <span className={`text-[11px] font-mono ${
                teksCuitan.length > 320 ? 'text-amber-600 font-bold' : 'text-stone-400'
              }`}>
                {teksCuitan.length} / 350
              </span>
            </div>

            <textarea
              rows={3}
              maxLength={350}
              value={teksCuitan}
              onChange={(e) => setTeksCuitan(e.target.value)}
              placeholder="Apa gagasan atau cuitan inspiratifmu hari ini?"
              className="editorial-input w-full p-3 text-xs sm:text-sm bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-750 dark:text-stone-100 rounded-xl resize-none focus:ring-2 focus:ring-stone-900 dark:focus:ring-stone-100"
            />

            {cuitanError && (
              <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300 flex items-center gap-1.5">
                <AlertCircle size={14} className="shrink-0" />
                <span>{cuitanError}</span>
              </div>
            )}

            {cuitanSuccessNotice && (
              <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-200 flex items-center gap-1.5">
                <Check size={14} className="shrink-0" />
                <span>{cuitanSuccessNotice}</span>
              </div>
            )}

            <div className="flex items-center justify-end pt-1">
              <button
                type="submit"
                disabled={isSubmittingCuitan || !teksCuitan.trim()}
                className="editorial-btn bg-stone-900 hover:bg-stone-800 text-white dark:bg-stone-800 dark:hover:bg-stone-700 dark:text-stone-100 dark:border dark:border-stone-700 disabled:opacity-40 disabled:cursor-not-allowed py-2 px-4 text-xs font-bold rounded-xl cursor-pointer shadow-xs flex items-center gap-1.5 transition-all"
              >
                <Send size={13} />
                <span>Kirim Cuitan</span>
              </button>
            </div>
          </form>
        )}
      </div>

      {/* 3. Daftar Linimasa Cuitan */}
      <div className="space-y-3.5">
        {filteredCuitan.length === 0 ? (
          <div className="editorial-card p-10 text-center bg-white dark:bg-[#141416] border border-dashed border-stone-300 dark:border-stone-800 rounded-2xl">
            <MessageSquare size={32} className="mx-auto text-stone-300 dark:text-stone-600 mb-2" />
            <p className="text-sm font-semibold text-stone-700 dark:text-stone-300">
              Belum ada cuitan di linimasa ini.
            </p>
            <p className="text-xs text-stone-400 dark:text-stone-500 mt-1">
              Jadilah orang pertama yang membagikan pemikiran atau ide menulis!
            </p>
          </div>
        ) : (
          filteredCuitan.map((cuitan) => {
            const isLiked = (cuitan.likes || []).some((u) => u.toLowerCase() === currentUser.username.toLowerCase());
            const canEdit = cuitan.username.toLowerCase() === currentUser.username.toLowerCase();
            const canDelete = cuitan.username.toLowerCase() === currentUser.username.toLowerCase() || currentUser.role === 'guru';
            const commentsCount = (cuitan.komentar || []).length;
            const isCommentsOpen = Boolean(openComments[cuitan.id]);
            const isEditingThis = editingCuitan?.id === cuitan.id;

            // Organisir komentar ke dalam 2 level: Level 1 (Utama) dan Level 2 (Balasan)
            const rootComments = (cuitan.komentar || []).filter((k) => !k.parentId);
            const repliesByParentId: Record<string, CuitanKomentar[]> = {};
            (cuitan.komentar || []).forEach((k) => {
              if (k.parentId) {
                if (!repliesByParentId[k.parentId]) repliesByParentId[k.parentId] = [];
                repliesByParentId[k.parentId].push(k);
              }
            });

            return (
              <article
                key={cuitan.id}
                className="editorial-card p-4 sm:p-5 bg-white dark:bg-[#161618] rounded-2xl shadow-xs transition-shadow"
              >
                {/* Header Cuitan: Avatar + @username + Waktu + Edit/Hapus */}
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="w-8 h-8 rounded-full text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs"
                      style={{ backgroundColor: stringToColor(cuitan.username) }}
                    >
                      {cuitan.username[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="font-mono font-bold text-xs text-stone-900 dark:text-stone-100 truncate">
                          @{cuitan.username}
                        </span>
                        {cuitan.namaKelas && (
                          <span className="text-[10px] text-stone-400 dark:text-stone-500 font-sans truncate">
                            • {cuitan.namaKelas}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-stone-400 dark:text-stone-500 flex items-center gap-1">
                        <Clock size={10} />
                        <span>{cuitan.waktu}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    {canEdit && !isEditingThis && (
                      <button
                        onClick={() => setEditingCuitan({ id: cuitan.id, teks: cuitan.teks })}
                        className="text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer transition-colors"
                        title="Edit cuitan ini"
                      >
                        <Edit3 size={13} />
                      </button>
                    )}
                    {canDelete && (
                      <button
                        onClick={() => setDeleteConfirm({ type: 'cuitan', cuitanId: cuitan.id })}
                        className="text-stone-400 hover:text-[#8C3E3E] dark:hover:text-[#E49D9D] p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer transition-colors"
                        title="Hapus cuitan ini"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Teks Isi Cuitan / Mode Edit Inline */}
                {isEditingThis ? (
                  <div className="space-y-2 mb-3 pt-1">
                    <textarea
                      value={editingCuitan.teks}
                      onChange={(e) => setEditingCuitan({ ...editingCuitan, teks: e.target.value })}
                      maxLength={350}
                      rows={3}
                      className="editorial-input w-full p-2.5 text-xs sm:text-sm bg-stone-50 dark:bg-stone-900 text-stone-800 dark:text-stone-200 rounded-xl resize-none border border-stone-200 dark:border-stone-700 focus:outline-none"
                    />
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-stone-400 font-mono">
                        {editingCuitan.teks.length}/350
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setEditingCuitan(null)}
                          className="px-2.5 py-1 text-xs rounded-lg text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer transition-colors"
                        >
                          Batal
                        </button>
                        <button
                          type="button"
                          disabled={isUpdatingCuitan || !editingCuitan.teks.trim()}
                          onClick={handleSaveEditCuitan}
                          className="px-3 py-1 text-xs font-semibold rounded-lg bg-stone-900 hover:bg-stone-800 text-white dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-200 cursor-pointer transition-all disabled:opacity-50"
                        >
                          {isUpdatingCuitan ? 'Menyimpan...' : 'Simpan'}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-stone-800 dark:text-stone-200 text-xs sm:text-sm font-serif-literary leading-relaxed mb-3 whitespace-pre-wrap break-words">
                    {cuitan.teks}
                  </div>
                )}

                {/* Baris Tombol Aksi: Suka & Komentar */}
                <div className="flex items-center gap-4 pt-2.5 border-t border-stone-100 dark:border-stone-800/80 text-xs text-stone-500 dark:text-stone-400">
                  {/* Tombol Suka */}
                  <button
                    onClick={() => handleToggleLikeCuitan(cuitan.id)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                      isLiked
                        ? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 font-bold'
                        : 'hover:bg-stone-100 dark:hover:bg-stone-800 hover:text-stone-900 dark:hover:text-stone-200'
                    }`}
                  >
                    <Heart size={14} className={isLiked ? 'fill-red-600 dark:fill-red-400' : ''} />
                    <span>{cuitan.likes?.length || 0}</span>
                  </button>

                  {/* Tombol Buka/Tutup Komentar */}
                  <button
                    onClick={() => toggleComments(cuitan.id)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                      isCommentsOpen
                        ? 'bg-stone-100 dark:bg-stone-800 text-stone-900 dark:text-stone-100 font-bold'
                        : 'hover:bg-stone-100 dark:hover:bg-stone-800 hover:text-stone-900 dark:hover:text-stone-200'
                    }`}
                  >
                    <MessageSquare size={14} />
                    <span>{commentsCount} Komentar</span>
                  </button>
                </div>

                {/* Section Komentar Bergaris 2-Level (Terbuka saat isCommentsOpen) */}
                {isCommentsOpen && (
                  <div className="mt-3.5 pt-3 border-t border-stone-100 dark:border-stone-800 space-y-3 animate-in fade-in duration-150">
                    {/* Input Komentar Level 1 */}
                    <div className="flex items-center gap-2">
                      <div
                        className="w-6 h-6 rounded-full text-white font-bold text-[10px] flex items-center justify-center shrink-0 shadow-2xs"
                        style={{ backgroundColor: stringToColor(currentUser.username) }}
                      >
                        {currentUser.username[0]?.toUpperCase()}
                      </div>
                      <div className="flex-1 flex items-center gap-1.5 bg-stone-50 dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-750 px-2.5 py-1 focus-within:border-stone-400 dark:focus-within:border-stone-500">
                        <input
                          type="text"
                          value={komentarInputs[cuitan.id] || ''}
                          onChange={(e) =>
                            setKomentarInputs((prev) => ({ ...prev, [cuitan.id]: e.target.value }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handlePostKomentarLevel1(cuitan.id);
                          }}
                          placeholder="Tulis komentar..."
                          className="w-full text-xs bg-transparent dark:text-stone-100 focus:outline-hidden"
                        />
                        <button
                          type="button"
                          disabled={!(komentarInputs[cuitan.id] || '').trim()}
                          onClick={() => handlePostKomentarLevel1(cuitan.id)}
                          className="text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 disabled:opacity-30 cursor-pointer p-1"
                        >
                          <Send size={12} />
                        </button>
                      </div>
                    </div>

                    {/* Daftar Komentar Hierarki Bergaris */}
                    {rootComments.length === 0 ? (
                      <p className="text-[11px] text-stone-400 dark:text-stone-500 italic py-1 px-1">
                        Belum ada komentar. Jadilah yang pertama berkomentar!
                      </p>
                    ) : (
                      <div className="space-y-3 pt-1">
                        {rootComments.map((comment) => {
                          const replies = repliesByParentId[comment.id] || [];
                          const isCommentLiked = (comment.likes || []).some((u) => u.toLowerCase() === currentUser.username.toLowerCase());
                          const canDeleteComment =
                            comment.username.toLowerCase() === currentUser.username.toLowerCase() || currentUser.role === 'guru';

                          return (
                            <div key={comment.id} className="group/c1">
                              {/* KOMENTAR LEVEL 1 (UTAMA) */}
                              <div className="flex items-start gap-2">
                                <div
                                  className="w-6 h-6 rounded-full text-white font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5 shadow-2xs"
                                  style={{ backgroundColor: stringToColor(comment.username) }}
                                >
                                  {comment.username[0]?.toUpperCase()}
                                </div>

                                <div className="flex-1 min-w-0 bg-stone-50/80 dark:bg-stone-900/60 rounded-xl p-2.5 border border-stone-200/60 dark:border-stone-800">
                                  <div className="flex items-center justify-between gap-1 mb-1">
                                    <div className="flex items-center gap-1.5 truncate">
                                      <span className="font-mono font-bold text-[11px] text-stone-900 dark:text-stone-100">
                                        @{comment.username}
                                      </span>
                                      <span className="text-[10px] text-stone-400">• {comment.waktu}</span>
                                    </div>

                                    {canDeleteComment && (
                                      <button
                                        onClick={() =>
                                          setDeleteConfirm({
                                            type: 'komentar',
                                            cuitanId: cuitan.id,
                                            komentarId: comment.id,
                                          })
                                        }
                                        className="text-stone-400 hover:text-red-600 p-0.5 rounded cursor-pointer transition-colors"
                                        title="Hapus komentar"
                                      >
                                        <Trash2 size={11} />
                                      </button>
                                    )}
                                  </div>

                                  <div className="text-xs text-stone-800 dark:text-stone-200 font-serif-literary whitespace-pre-wrap break-words mb-1.5">
                                    {comment.teks}
                                  </div>

                                  {/* Tombol Suka & Balas Komentar Level 1 */}
                                  <div className="flex items-center gap-3 text-[11px] text-stone-500 dark:text-stone-400 pt-0.5">
                                    <button
                                      onClick={() => handleToggleLikeKomentar(cuitan.id, comment.id)}
                                      className={`flex items-center gap-1 hover:text-red-600 cursor-pointer ${
                                        isCommentLiked ? 'text-red-600 font-bold' : ''
                                      }`}
                                    >
                                      <Heart
                                        size={11}
                                        className={isCommentLiked ? 'fill-red-600' : ''}
                                      />
                                      <span>{comment.likes?.length || 0} Suka</span>
                                    </button>

                                    <button
                                      onClick={() => {
                                        setActiveReplyBox({
                                          cuitanId: cuitan.id,
                                          parentId: comment.id,
                                          replyToUsername: comment.username,
                                        });
                                        setReplyInputText('');
                                      }}
                                      className="font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer flex items-center gap-1"
                                    >
                                      <CornerDownRight size={11} /> Balas
                                    </button>
                                  </div>
                                </div>
                              </div>

                              {/* BALASAN LEVEL 2 (BERGARIS VERTIKAL ALA FACEBOOK) */}
                              {(replies.length > 0 || (activeReplyBox && activeReplyBox.parentId === comment.id)) && (
                                <div className="border-l-2 border-stone-200 dark:border-stone-800 ml-3 pl-3 sm:ml-4 sm:pl-3.5 mt-2 space-y-2">
                                  {replies.map((reply) => {
                                    const isReplyLiked = (reply.likes || []).some((u) => u.toLowerCase() === currentUser.username.toLowerCase());
                                    const canDeleteReply =
                                      reply.username.toLowerCase() === currentUser.username.toLowerCase() || currentUser.role === 'guru';

                                    return (
                                      <div key={reply.id} className="flex items-start gap-2">
                                        <div
                                          className="w-5 h-5 rounded-full text-white font-bold text-[9px] flex items-center justify-center shrink-0 mt-0.5 shadow-2xs"
                                          style={{ backgroundColor: stringToColor(reply.username) }}
                                        >
                                          {reply.username[0]?.toUpperCase()}
                                        </div>

                                        <div className="flex-1 min-w-0 bg-stone-100/70 dark:bg-stone-850/80 rounded-xl p-2 border border-stone-200/60 dark:border-stone-750">
                                          <div className="flex items-center justify-between gap-1 mb-1">
                                            <div className="flex items-center gap-1.5 truncate">
                                              <span className="font-mono font-bold text-[10.5px] text-stone-900 dark:text-stone-100">
                                                @{reply.username}
                                              </span>
                                              <span className="text-[9.5px] text-stone-400">• {reply.waktu}</span>
                                            </div>

                                            {canDeleteReply && (
                                              <button
                                                onClick={() =>
                                                  setDeleteConfirm({
                                                    type: 'komentar',
                                                    cuitanId: cuitan.id,
                                                    komentarId: reply.id,
                                                  })
                                                }
                                                className="text-stone-400 hover:text-red-600 p-0.5 rounded cursor-pointer transition-colors"
                                                title="Hapus balasan"
                                              >
                                                <Trash2 size={10} />
                                              </button>
                                            )}
                                          </div>

                                          <div className="text-xs text-stone-800 dark:text-stone-200 font-serif-literary whitespace-pre-wrap break-words mb-1">
                                            {reply.replyToUsername && (
                                              <span className="font-mono font-bold text-blue-600 dark:text-blue-400 mr-1.5">
                                                @{reply.replyToUsername}
                                              </span>
                                            )}
                                            {reply.teks}
                                          </div>

                                          {/* Tombol Suka & Balas Balasan Level 2 */}
                                          <div className="flex items-center gap-3 text-[10.5px] text-stone-500 dark:text-stone-400 pt-0.5">
                                            <button
                                              onClick={() => handleToggleLikeKomentar(cuitan.id, reply.id)}
                                              className={`flex items-center gap-1 hover:text-red-600 cursor-pointer ${
                                                isReplyLiked ? 'text-red-600 font-bold' : ''
                                              }`}
                                            >
                                              <Heart
                                                size={10}
                                                className={isReplyLiked ? 'fill-red-600' : ''}
                                              />
                                              <span>{reply.likes?.length || 0}</span>
                                            </button>

                                            <button
                                              onClick={() => {
                                                setActiveReplyBox({
                                                  cuitanId: cuitan.id,
                                                  parentId: comment.id,
                                                  replyToUsername: reply.username,
                                                });
                                                setReplyInputText('');
                                              }}
                                              className="font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer flex items-center gap-1"
                                            >
                                              <CornerDownRight size={10} /> Balas
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}

                                  {/* Input Balasan Inline (Jika aktif untuk comment induk ini) */}
                                  {activeReplyBox && activeReplyBox.parentId === comment.id && (
                                    <div className="pt-1 animate-in fade-in duration-150">
                                      <div className="flex items-center gap-1.5 bg-white dark:bg-stone-900 rounded-xl border border-blue-300 dark:border-blue-700 p-1.5 shadow-2xs">
                                        <span className="text-[10px] font-mono text-blue-600 dark:text-blue-400 font-bold pl-1 shrink-0">
                                          @{activeReplyBox.replyToUsername}
                                        </span>
                                        <input
                                          type="text"
                                          autoFocus
                                          value={replyInputText}
                                          onChange={(e) => setReplyInputText(e.target.value)}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') handlePostReplyLevel2();
                                            if (e.key === 'Escape') setActiveReplyBox(null);
                                          }}
                                          placeholder="Ketik balasan... (Esc untuk batal)"
                                          className="w-full text-xs bg-transparent dark:text-stone-100 focus:outline-hidden"
                                        />
                                        <button
                                          type="button"
                                          onClick={() => setActiveReplyBox(null)}
                                          className="text-[10px] text-stone-400 hover:text-stone-600 px-1 cursor-pointer"
                                        >
                                          Batal
                                        </button>
                                        <button
                                          type="button"
                                          disabled={!replyInputText.trim()}
                                          onClick={handlePostReplyLevel2}
                                          className="bg-stone-900 hover:bg-stone-800 text-white dark:bg-stone-800 dark:hover:bg-stone-700 dark:text-stone-100 dark:border dark:border-stone-700 disabled:opacity-40 px-2 py-1 rounded-lg text-xs font-semibold cursor-pointer shrink-0"
                                        >
                                          Kirim
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
          })
        )}
      </div>

      {/* Modal Konfirmasi Hapus */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="editorial-card w-full max-w-sm bg-white dark:bg-[#141416] border border-stone-200 dark:border-stone-800 p-5 rounded-2xl shadow-xl space-y-3">
            <h3 className="font-serif-literary font-bold text-base text-stone-900 dark:text-stone-100">
              Hapus {deleteConfirm.type === 'cuitan' ? 'Cuitan' : 'Komentar'}?
            </h3>
            <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed">
              Tindakan ini tidak dapat dibatalkan. {deleteConfirm.type === 'cuitan' ? 'Seluruh komentar pada cuitan ini juga akan terhapus.' : ''}
            </p>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="editorial-btn flex-1 bg-stone-100 hover:bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-300 py-2 text-xs font-medium cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleExecuteDelete}
                className="editorial-btn flex-1 bg-red-600 hover:bg-red-700 text-white py-2 text-xs font-bold cursor-pointer shadow-xs"
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
