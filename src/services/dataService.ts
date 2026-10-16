import { supabase, isSupabaseConfigured } from './supabase';
import type { Dokumen, UserAccount, UserRole, KelasRoom, LiveStatus, PenilaianRubrik, MigrasiRedeemItem, Penugasan, Pengumuman, CuitanItem, CuitanKomentar, KolaboratorAnggota, Sekolah, FiturPaketSekolah } from '../types';
import { initialMigrasiRedeemData } from '../data/migrasi_redeem_data';
import { uint8ArrayToBase64, base64ToUint8Array } from '../utils/binaryUtils';
import { cleanTitle } from '../utils/exportDocument';

// Helper Waktu Standar Indonesia
export function getWaktuSekarang(): string {
  const now = new Date();
  return now.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Helper Hashing Warna Avatar / Nama (Warna HEX 6-digit valid untuk CRDT Awareness & CSS)
export function stringToColor(str: string): string {
  const palette = [
    '#2563EB', '#7C3AED', '#DB2777', '#EA580C', 
    '#059669', '#0891B2', '#D97706', '#4F46E5',
    '#DC2626', '#0D9488', '#9333EA', '#CA8A04'
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const idx = Math.abs(hash) % palette.length;
  return palette[idx];
}

// Helper Topik Warna (Modern Soft Editorial)
export function getWarnaTopik(topik?: string): { bg: string; text: string; border: string } {
  switch (topik) {
    case 'Cerpen':
      return { bg: '#FEF3C7', text: '#92400E', border: '#FDE68A' };
    case 'Puisi':
      return { bg: '#F3E8FF', text: '#6B21A8', border: '#E9D5FF' };
    case 'Esai':
      return { bg: '#E0E7FF', text: '#3730A3', border: '#C7D2FE' };
    case 'Artikel':
      return { bg: '#DCFCE7', text: '#166534', border: '#BBF7D0' };
    case 'Resensi':
      return { bg: '#FFE4E6', text: '#9F1239', border: '#FECDD3' };
    case 'Lainnya':
    case 'Bebas':
      return { bg: '#F1F5F9', text: '#334155', border: '#E2E8F0' };
    // Backward compatibility untuk naskah yang sudah terlanjur terpublikasi sebelumnya
    case 'Teks Anekdot':
      return { bg: '#FEF9C3', text: '#854D0E', border: '#FEF08A' };
    case 'Teks Negosiasi':
      return { bg: '#E0F2FE', text: '#075985', border: '#BAE6FD' };
    case 'Teks Eksplanasi':
      return { bg: '#DCFCE7', text: '#166534', border: '#BBF7D0' };
    case 'Artikel/Esai':
      return { bg: '#EDE9FE', text: '#5B21B6', border: '#DDD6FE' };
    default:
      return { bg: '#F1F5F9', text: '#334155', border: '#E2E8F0' };
  }
}

// Cache in-memory debounce views untuk mencegah duplikasi eksekusi bersamaan (misal React double-mount)
const viewedTimestamps = new Map<string, number>();

// Generate Kode Kelas Format Classroom (6 karakter alfanumerik tanpa tanda hubung)
function generateKodeKelas(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Mapping Helper dari Supabase DB Row ke Dokumen Model
function mapDokumenRow(row: Record<string, unknown>): Dokumen {
  let parsedPenilaian: PenilaianRubrik | undefined = undefined;
  if (row.penilaian) {
    try {
      parsedPenilaian = typeof row.penilaian === 'string' ? JSON.parse(row.penilaian) : (row.penilaian as PenilaianRubrik);
    } catch {}
  }
  if (!parsedPenilaian && typeof window !== 'undefined') {
    try {
      const local = getLocalDB();
      if (local.dokumen?.[String(row.id)]?.penilaian) {
        parsedPenilaian = local.dokumen[String(row.id)].penilaian;
      }
    } catch {}
  }

  // Resolusi Nama Kelas: Hindari ekspos kode kelas, cari nama kelas jika belum ada di row
  let resolvedNamaKelas = (row.nama_kelas as string) || (row.kelas as string) || undefined;
  const kKode = (row.kode_kelas as string) || undefined;
  if (!resolvedNamaKelas && kKode) {
    try {
      const local = getLocalDB();
      if (local.kelas && local.kelas[kKode]) {
        resolvedNamaKelas = local.kelas[kKode].namaKelas;
      } else if (local.users) {
        const authorUser = Object.values(local.users).find((u) => u.username === row.username);
        if (authorUser?.namaKelas) {
          resolvedNamaKelas = authorUser.namaKelas;
        }
      }
    } catch {}
  }

  // Layout mode resolution
  let layoutMode: ('web' | 'kertas') | undefined = (row.layout_mode as 'web' | 'kertas') || undefined;
  if (!layoutMode && typeof window !== 'undefined') {
    try {
      layoutMode = (localStorage.getItem(`doc_layout_${row.id}`) as 'web' | 'kertas') || undefined;
    } catch {}
  }

  // Tugas ID & Judul Tugas resolution (dengan fallback cache local)
  let tugasId: string | undefined = (row.tugas_id as string) || (row.tugasId as string) || undefined;
  let judulTugas: string | undefined = (row.judul_tugas as string) || (row.judulTugas as string) || undefined;
  if ((!tugasId || !judulTugas) && typeof window !== 'undefined') {
    try {
      const cachedTugas = localStorage.getItem(`doc_tugas_${row.id}`);
      if (cachedTugas) {
        const parsedTugas = JSON.parse(cachedTugas);
        if (!tugasId && parsedTugas.tugasId) tugasId = parsedTugas.tugasId;
        if (!judulTugas && parsedTugas.judulTugas) judulTugas = parsedTugas.judulTugas;
      }
    } catch {}
  }

  // Resolusi data kolaborasi multi-siswa
  let isKolaboratif = Boolean(row.is_kolaboratif);
  let parsedKolaborator: KolaboratorAnggota[] = [];
  if (row.kolaborator) {
    try {
      parsedKolaborator = typeof row.kolaborator === 'string' ? JSON.parse(row.kolaborator) : (row.kolaborator as KolaboratorAnggota[]);
    } catch {}
  }
  let parsedKolaboratorUsernames: string[] = [];
  if (row.kolaborator_usernames) {
    try {
      parsedKolaboratorUsernames = typeof row.kolaborator_usernames === 'string' ? JSON.parse(row.kolaborator_usernames) : (row.kolaborator_usernames as string[]);
    } catch {}
  }
  if (parsedKolaborator.length > 0 && parsedKolaboratorUsernames.length === 0) {
    parsedKolaboratorUsernames = parsedKolaborator.map((k) => k.username);
  }
  if (!isKolaboratif && parsedKolaborator.length > 0) {
    isKolaboratif = true;
  }
  if (typeof window !== 'undefined' && (!parsedKolaborator || parsedKolaborator.length === 0)) {
    try {
      const local = getLocalDB();
      const localDoc = local.dokumen?.[String(row.id)];
      if (localDoc?.kolaborator && localDoc.kolaborator.length > 0) {
        parsedKolaborator = localDoc.kolaborator;
        parsedKolaboratorUsernames = localDoc.kolaboratorUsernames || parsedKolaborator.map((k) => k.username);
        isKolaboratif = true;
      }
    } catch {}
  }

  return {
    id: String(row.id),
    nama: String(row.nama || ''),
    username: String(row.username || ''),
    kodeKelas: kKode,
    namaKelas: resolvedNamaKelas,
    judul: cleanTitle(String(row.judul || '')),
    teks: String(row.teks || ''),
    status: (row.status as 'Draf' | 'Terkumpul' | 'Selesai') || 'Draf',
    pelanggaran: Number(row.pelanggaran || 0),
    isPublic: Boolean(row.is_public),
    izinPublish: Boolean(row.izin_publish),
    topik: (row.topik as string) || undefined,
    tugasId,
    judulTugas,
    feedbackUmum: (row.feedback_umum as string) || undefined,
    penulisKategori: (row.penulis_kategori as 'Siswa' | 'Guru') || 'Siswa',
    waktuEdit: String(row.waktu_edit || ''),
    waktuKumpul: (row.waktu_kumpul as string) || undefined,
    waktuPublish: row.waktu_publish ? Number(row.waktu_publish) : null,
    waktuPublishTeks: (row.waktu_publish_teks as string) || null,
    views: Number(row.views || 0),
    penilaian: parsedPenilaian,
    layoutMode,
    isKolaboratif,
    kolaborator: parsedKolaborator,
    kolaboratorUsernames: parsedKolaboratorUsernames,
  };
}

export interface TagCountsRecord {
  [key: string]: any;
  kapital: number;
  imbuhan: number;
  tanda_baca: number;
  kebakuan: number;
  diksi: number;
  kalimat: number;
  gagasan: number;
  kohesi: number;
  struktur: number;
  _unresolved?: Record<string, number>;
  _resolved?: Record<string, number>;
}

// Helper Parsing Tag Koreksi Guru dari Naskah Siswa (Membedakan Belum Direvisi vs Sudah Direvisi)
export function parseDocumentTagCounts(teks: string): TagCountsRecord {
  const counts: TagCountsRecord = {
    kapital: 0,
    imbuhan: 0,
    tanda_baca: 0,
    kebakuan: 0,
    diksi: 0,
    kalimat: 0,
    gagasan: 0,
    kohesi: 0,
    struktur: 0,
  };
  const unresolved: Record<string, number> = {
    kapital: 0,
    imbuhan: 0,
    tanda_baca: 0,
    kebakuan: 0,
    diksi: 0,
    kalimat: 0,
    gagasan: 0,
    kohesi: 0,
    struktur: 0,
  };
  const resolved: Record<string, number> = {
    kapital: 0,
    imbuhan: 0,
    tanda_baca: 0,
    kebakuan: 0,
    diksi: 0,
    kalimat: 0,
    gagasan: 0,
    kohesi: 0,
    struktur: 0,
  };

  if (!teks) {
    counts._unresolved = unresolved;
    counts._resolved = resolved;
    return counts;
  }

  const badgeMap: Record<string, string> = {
    'huruf kapital': 'kapital',
    'kapital': 'kapital',
    'imbuhan': 'imbuhan',
    'pembentukan kata': 'imbuhan',
    'tanda baca': 'tanda_baca',
    'kebakuan': 'kebakuan',
    'kebakuan & ejaan': 'kebakuan',
    'ketepatan diksi': 'diksi',
    'diksi': 'diksi',
    'efektivitas kalimat': 'kalimat',
    'kalimat': 'kalimat',
    'kedalaman gagasan': 'gagasan',
    'gagasan': 'gagasan',
    'kepaduan paragraf': 'kohesi',
    'kohesi': 'kohesi',
    'struktur teks': 'struktur',
    'struktur': 'struktur',
  };

  // 1. Ekstrak dari seluruh tag <mark ...> (Prioritas utama: atribut data-tag & data-resolved)
  const markRegex = /<mark\b([^>]*)>/gi;
  let markMatch: RegExpExecArray | null;

  while ((markMatch = markRegex.exec(teks)) !== null) {
    const attrs = markMatch[1];
    const isResolved = /data-resolved=["']true["']/i.test(attrs);
    let countedFromDataTag = false;

    // Prioritas 1: Atribut data-tag
    const tagAttrMatch = attrs.match(/data-tag=["']([^"']+)["']/i);
    if (tagAttrMatch) {
      const rawTags = tagAttrMatch[1].split(/[\s,]+/);
      for (const tag of rawTags) {
        if (counts[tag] !== undefined) {
          counts[tag]++;
          if (isResolved) {
            resolved[tag] = (resolved[tag] || 0) + 1;
          } else {
            unresolved[tag] = (unresolved[tag] || 0) + 1;
          }
          countedFromDataTag = true;
        }
      }
    }

    // Prioritas 2: Fallback ke badge dalam atribut data-pesan jika data-tag belum terisi
    if (!countedFromDataTag) {
      const pesanAttrMatch = attrs.match(/data-pesan=["']([^"']+)["']/i);
      if (pesanAttrMatch) {
        const pesan = pesanAttrMatch[1];
        const badgeInPesan = pesan.matchAll(/\[(.*?)\]/g);
        for (const b of badgeInPesan) {
          const key = b[1].toLowerCase().trim();
          const mapped = badgeMap[key];
          if (mapped && counts[mapped] !== undefined) {
            counts[mapped]++;
            if (isResolved) {
              resolved[mapped] = (resolved[mapped] || 0) + 1;
            } else {
              unresolved[mapped] = (unresolved[mapped] || 0) + 1;
            }
          }
        }
      }
    }
  }

  // 2. Ekstrak tag badge text seperti [Huruf Kapital] yang berada di luar elemen <mark>
  const textWithoutMarks = teks.replace(/<mark\b[^>]*>[\s\S]*?<\/mark>/gi, '');
  const badgeMatches = textWithoutMarks.matchAll(/\[(.*?)\]/g);
  for (const match of badgeMatches) {
    const key = match[1].toLowerCase().trim();
    const mapped = badgeMap[key];
    if (mapped && counts[mapped] !== undefined) {
      counts[mapped]++;
      unresolved[mapped] = (unresolved[mapped] || 0) + 1;
    }
  }

  counts._unresolved = unresolved;
  counts._resolved = resolved;
  return counts;
}

// Konversi Jumlah Kesalahan ke Skala 1 - 5 (Skala Rubrik Standar)
function hitungSkorVariabel(errorCount: number, baseScore = 5): number {
  if (errorCount <= 0) return baseScore;
  if (errorCount === 1) return 4.5;
  if (errorCount === 2) return 4.0;
  if (errorCount === 3) return 3.2;
  if (errorCount === 4) return 2.5;
  return Math.max(1.5, 2.0 - (errorCount - 5) * 0.2);
}

// Hitung Skor Variabel dengan Pemulihan Nilai Revisi (Recovery):
// Jika kesalahan ditandai "Sudah Direvisi", penalti dipulihkan 60%.
// Contoh: 1 kesalahan (penalti 0.5) -> direvisi -> pulih 0.3 -> sisa penalti 0.2 -> skor naik dari 4.5 menjadi 4.8!
export function hitungSkorVariabelDenganRevisi(
  unresolvedCount: number,
  resolvedCount: number,
  baseScore = 5
): number {
  const totalCount = unresolvedCount + resolvedCount;
  if (totalCount <= 0) return baseScore;

  const rawScore = hitungSkorVariabel(totalCount, baseScore);
  const totalPenalty = baseScore - rawScore;

  if (resolvedCount <= 0) {
    return Number(rawScore.toFixed(1));
  }

  const recoveryRatio = (resolvedCount / totalCount) * 0.6;
  const recoveredPoints = totalPenalty * recoveryRatio;
  const finalScore = Math.min(baseScore, Math.max(1, rawScore + recoveredPoints));

  return Number(finalScore.toFixed(1));
}

// Helper Otomatisasi Penilaian Rubrik Holistik Berbasis Naskah & Catatan Guru (Zero-Friction)
export function hitungPenilaianOtomatis(
  doc: Dokumen, 
  customTagCounts?: Record<string, number> | TagCountsRecord, 
  catatanUmum?: string
): PenilaianRubrik {
  // 1. Keadaan Draf Awal (sebelum pernah dikumpulkan siswa):
  // Feedback guru berstatus murni pendampingan/mentoring/saran ramah anak.
  // Sama sekali TIDAK berpengaruh ke nilai (skor tetap utuh 100).
  const isDrafAwal = doc.status === 'Draf' && !doc.waktuKumpul;
  if (isDrafAwal) {
    return {
      kedalamanGagasan: 5,
      kepaduanParagraf: 5,
      strukturTeks: 5,
      efektivitasKalimat: 5,
      ketepatanDiksi: 5,
      kebakuanEjaan: 5,
      pembentukanKata: 5,
      tandaBaca: 5,
      hurufKapital: 5,
      skorMakro: 100,
      skorMikro: 100,
      skorTotal: 100,
      predikat: 'Sangat Baik',
      catatanGuru: catatanUmum !== undefined ? catatanUmum.trim() : (doc.feedbackUmum || doc.penilaian?.catatanGuru || ''),
      waktuDinilai: getWaktuSekarang(),
      tagCounts: {},
    };
  }

  // 2. Keadaan Naskah Sudah Dikumpulkan / Dalam Siklus Revisi:
  // Sistem penilaian resmi berjalan aktif dengan penalti & pemulihan revisi.
  const tagCounts: TagCountsRecord = (customTagCounts as TagCountsRecord) || parseDocumentTagCounts(doc.teks);
  const unresolved = tagCounts._unresolved || (tagCounts as Record<string, number>);
  const resolved = tagCounts._resolved || {};

  const kedalamanGagasan = Math.min(5, Math.max(1, hitungSkorVariabelDenganRevisi(unresolved.gagasan || 0, resolved.gagasan || 0, 5)));
  const kepaduanParagraf = Math.min(5, Math.max(1, hitungSkorVariabelDenganRevisi(unresolved.kohesi || 0, resolved.kohesi || 0, 5)));
  const strukturTeks = Math.min(5, Math.max(1, hitungSkorVariabelDenganRevisi(unresolved.struktur || 0, resolved.struktur || 0, 5)));

  // Aspek Mikro (6 Variabel)
  const efektivitasKalimat = Math.min(5, Math.max(1, hitungSkorVariabelDenganRevisi(unresolved.kalimat || 0, resolved.kalimat || 0, 5)));
  const ketepatanDiksi = Math.min(5, Math.max(1, hitungSkorVariabelDenganRevisi(unresolved.diksi || 0, resolved.diksi || 0, 5)));
  const kebakuanEjaan = Math.min(5, Math.max(1, hitungSkorVariabelDenganRevisi(unresolved.kebakuan || 0, resolved.kebakuan || 0, 5)));
  const pembentukanKata = Math.min(5, Math.max(1, hitungSkorVariabelDenganRevisi(unresolved.imbuhan || 0, resolved.imbuhan || 0, 5)));
  const tandaBaca = Math.min(5, Math.max(1, hitungSkorVariabelDenganRevisi(unresolved.tanda_baca || 0, resolved.tanda_baca || 0, 5)));
  const hurufKapital = Math.min(5, Math.max(1, hitungSkorVariabelDenganRevisi(unresolved.kapital || 0, resolved.kapital || 0, 5)));

  // Skor Makro (0 - 100): Rata-rata 3 variabel x 20
  const skorMakro = Math.round(((kedalamanGagasan + kepaduanParagraf + strukturTeks) / 3) * 20);

  // Skor Mikro (0 - 100): Rata-rata 6 variabel x 20
  const skorMikro = Math.round(
    ((efektivitasKalimat + ketepatanDiksi + kebakuanEjaan + pembentukanKata + tandaBaca + hurufKapital) / 6) * 20
  );

  // Skor Total: Bobot 50% Makro + 50% Mikro
  const skorTotal = Math.min(100, Math.max(20, Math.round(skorMakro * 0.5 + skorMikro * 0.5)));

  let predikat: 'Perlu Bimbingan' | 'Cukup' | 'Baik' | 'Sangat Baik' = 'Sangat Baik';
  if (skorTotal >= 88) predikat = 'Sangat Baik';
  else if (skorTotal >= 75) predikat = 'Baik';
  else if (skorTotal >= 60) predikat = 'Cukup';
  else predikat = 'Perlu Bimbingan';

  return {
    kedalamanGagasan,
    kepaduanParagraf,
    strukturTeks,
    efektivitasKalimat,
    ketepatanDiksi,
    kebakuanEjaan,
    pembentukanKata,
    tandaBaca,
    hurufKapital,
    skorMakro,
    skorMikro,
    skorTotal,
    predikat,
    catatanGuru: catatanUmum !== undefined ? catatanUmum.trim() : (doc.feedbackUmum || doc.penilaian?.catatanGuru || ''),
    waktuDinilai: getWaktuSekarang(),
    tagCounts,
  };
}

// ==============================================================================
// LOCAL STORAGE FALLBACK REPOSITORY (Ketika Supabase URL belum diisi di .env)
// ==============================================================================
const LOCAL_STORAGE_KEY = 'nulislur_local_db';

interface LocalDB {
  users: Record<string, UserAccount>;
  kelas: Record<string, KelasRoom>;
  dokumen: Record<string, Dokumen>;
  pengumuman: Pengumuman[];
  likes: Record<string, Record<string, boolean>>; // docId -> username -> true
  komentar: Record<string, { id: string; nama: string; username: string; teks: string; waktu: string }[]>;
  views?: Record<string, number>; // docId -> count
  live: Record<string, {
    username: string;
    nama: string;
    kodeKelas: string;
    aktivitas: string;
    isOnline: boolean;
    sedangKeluarTab: boolean;
    docAktifId?: string | null;
    sessionId?: string;
    pelanggaranCount: number;
    updatedAt: number;
  }>;
  trackingAktif: boolean;
  redeemList?: MigrasiRedeemItem[];
  penugasan?: Record<string, Penugasan>;
  cuitanList?: CuitanItem[];
}

const initialCuitanSeed: CuitanItem[] = [
  {
    id: 'cuit_demo_1',
    username: 'guru',
    teks: 'Selamat datang di linimasa Cuitan NulisLur! Di sini kalian bisa membagikan sekelumit gagasan, kutipan favorit, atau proses kreatif saat menulis. Saling sapa dan apresiasi ide teman ya! ✍️',
    waktu: getWaktuSekarang(),
    kodeKelas: 'NULIS-10A',
    namaKelas: 'Kelas 10-A Menulis Sastra',
    likes: ['ahmad', 'budi'],
    komentar: [
      {
        id: 'kom_cuit_1',
        cuitanId: 'cuit_demo_1',
        parentId: null,
        replyToUsername: null,
        username: 'ahmad',
        teks: 'Keren banget bu/pak! Izin cuit ide cerpen misteri saya nanti siang ya.',
        waktu: getWaktuSekarang(),
        likes: ['guru'],
      },
      {
        id: 'kom_cuit_2',
        cuitanId: 'cuit_demo_1',
        parentId: 'kom_cuit_1',
        replyToUsername: 'ahmad',
        username: 'budi',
        teks: 'Wah seru tuh, gas Ahmad! Nanti aku baca dan kasih feedback.',
        waktu: getWaktuSekarang(),
        likes: ['ahmad'],
      }
    ]
  }
];

function getLocalDB(): LocalDB {
  const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (raw) {
    try {
      const parsed: LocalDB = JSON.parse(raw);
      if (!parsed.redeemList || parsed.redeemList.length === 0) {
        parsed.redeemList = initialMigrasiRedeemData;
      }
      if (!parsed.penugasan) {
        parsed.penugasan = {};
      }
      if (!parsed.cuitanList || parsed.cuitanList.length === 0) {
        parsed.cuitanList = initialCuitanSeed;
      }
      return parsed;
    } catch {
      // fallback jika corrupt
    }
  }

  // Default seed
  const sampleKelas: KelasRoom = {
    id: 'NULIS-10A',
    kodeKelas: 'NULIS-10A',
    namaKelas: 'Kelas 10-A Menulis Sastra',
    guruUsername: 'guru',
    namaGuru: 'Ibu/Bapak Guru',
    waktuDibuat: getWaktuSekarang()
  };

  const initialDB: LocalDB = {
    users: {
      guru: {
        username: 'guru',
        nama: 'Ibu/Bapak Guru (Pengajar)',
        role: 'guru',
        password: 'guru123',
        waktuDaftar: getWaktuSekarang()
      },
      ahmad: {
        username: 'ahmad',
        nama: 'Ahmad Rizki',
        role: 'siswa',
        password: '123',
        kodeKelas: 'NULIS-10A',
        namaKelas: 'Kelas 10-A Menulis Sastra',
        waktuDaftar: getWaktuSekarang()
      },
      budi: {
        username: 'budi',
        nama: 'Budi Santoso',
        role: 'siswa',
        password: '123',
        kodeKelas: 'NULIS-10A',
        namaKelas: 'Kelas 10-A Menulis Sastra',
        waktuDaftar: getWaktuSekarang()
      }
    },
    kelas: {
      'NULIS-10A': sampleKelas
    },
    dokumen: {},
    penugasan: {
      'tugas-demo-1': {
        id: 'tugas-demo-1',
        judul: 'Menulis Cerpen Pengalaman Pribadi',
        deskripsi: 'Tuliskan cerpen naratif berdasarkan pengalaman pribadi yang paling berkesan. Perhatikan struktur alur (orientasi, komplikasi, resolusi) serta penggunaan tanda baca yang tepat.',
        kodeKelas: 'NULIS-10A',
        namaKelas: 'Kelas 10-A Menulis Sastra',
        guruUsername: 'guru',
        namaGuru: 'Ibu/Bapak Guru (Pengajar)',
        waktuDibuat: getWaktuSekarang(),
        topik: 'Cerpen',
        targetKataMin: 150
      }
    },
    pengumuman: [
      {
        id: '1',
        teks: 'Selamat datang di NulisLur! Mulailah menulis karya cerpen atau puisi pertamamu hari ini.',
        waktu: getWaktuSekarang(),
        kodeKelas: 'NULIS-10A'
      }
    ],
    likes: {},
    komentar: {},
    live: {},
    trackingAktif: true,
    redeemList: initialMigrasiRedeemData,
    cuitanList: initialCuitanSeed
  };

  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(initialDB));
  return initialDB;
}

function saveLocalDB(db: LocalDB) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(db));
    window.dispatchEvent(new Event('nulislur_db_change'));
  } catch (e) {
    console.error('Gagal menyimpan local DB ke LocalStorage (kemungkinan kuota penuh):', e);
  }
}

// ==============================================================================
// SALURAN BROADCAST & REALTIME PRESENCE TERPADU (<30ms)
// ==============================================================================
const BROADCAST_LIVE_CHANNEL_NAME = 'realtime:kehadiran_broadcast';

const localLiveBroadcast = typeof window !== 'undefined' && 'BroadcastChannel' in window
  ? new BroadcastChannel('nulislur_local_live_sync')
  : null;

// Registry listener internal untuk mendistribusikan broadcast seketika (<30ms)
type LiveBroadcastListener = (event: string, payload: any) => void;
const liveBroadcastListeners = new Set<LiveBroadcastListener>();

let liveBroadcastChannelInstance: ReturnType<typeof supabase.channel> | null = null;

function getLiveBroadcastChannel() {
  if (!isSupabaseConfigured || typeof window === 'undefined') return null;
  if (liveBroadcastChannelInstance) return liveBroadcastChannelInstance;

  liveBroadcastChannelInstance = supabase.channel(BROADCAST_LIVE_CHANNEL_NAME, {
    config: {
      broadcast: { self: true }
    }
  });

  // PENTING: Listener .on('broadcast') HARUS dipasang SEBELUM .subscribe() dipanggil
  liveBroadcastChannelInstance
    .on('broadcast', { event: 'pelanggaran' }, ({ payload }) => {
      liveBroadcastListeners.forEach((fn) => fn('pelanggaran', payload));
    })
    .on('broadcast', { event: 'pulihkan_fokus' }, ({ payload }) => {
      liveBroadcastListeners.forEach((fn) => fn('pulihkan_fokus', payload));
    })
    .on('broadcast', { event: 'reset_pelanggaran' }, ({ payload }) => {
      liveBroadcastListeners.forEach((fn) => fn('reset_pelanggaran', payload));
    })
    .on('broadcast', { event: 'status_update' }, ({ payload }) => {
      liveBroadcastListeners.forEach((fn) => fn('status_update', payload));
    })
    .on('broadcast', { event: 'tracking_toggle' }, ({ payload }) => {
      liveBroadcastListeners.forEach((fn) => fn('tracking_toggle', payload));
    });

  liveBroadcastChannelInstance.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      console.log('[Supabase Realtime] Terhubung ke saluran siaran langsung');
    }
  });

  return liveBroadcastChannelInstance;
}

// Inisialisasi awal
if (isSupabaseConfigured) {
  getLiveBroadcastChannel();
}

function broadcastLiveMessage(event: string, payload: any) {
  // 1. Antartab browser lokal
  localLiveBroadcast?.postMessage({ event, payload });

  // 2. Siaran WebSocket Supabase (<30ms ke seluruh perangkat)
  if (isSupabaseConfigured) {
    const channel = getLiveBroadcastChannel();
    if (channel) {
      channel.send({
        type: 'broadcast',
        event,
        payload
      });
    }
  }
}

let activePresenceActivity = 'Beranda';
let activePresenceDocId: string | null = null;
let lastBroadcastStatus: { username: string; aktivitas: string; docAktifId: string | null; time: number } | null = null;

// Cache daftar kode redeem untuk mencegah request storm saat klaim massal
let cachedRedeemList: MigrasiRedeemItem[] | null = null;
let lastRedeemListFetchTime = 0;

// In-memory cache & background sync queue untuk Cuitan (Performa ultra-cepat)
let inMemoryCuitanCache: CuitanItem[] | null = null;
let cuitanSyncDebounceTimer: ReturnType<typeof setTimeout> | null = null;

function saveCuitanState(list: CuitanItem[], syncToRemote: boolean = true) {
  inMemoryCuitanCache = list;
  try {
    const local = getLocalDB();
    local.cuitanList = list;
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(local));
  } catch (e) {
    console.error('Gagal menyimpan cuitan ke localStorage:', e);
  }

  // Broadcast seketika ke jendela/tab lokal (0ms)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('nulislur_cuitan_change', { detail: list }));
  }

  // Debounced non-blocking background sync ke Supabase
  if (syncToRemote && isSupabaseConfigured) {
    if (cuitanSyncDebounceTimer) clearTimeout(cuitanSyncDebounceTimer);
    cuitanSyncDebounceTimer = setTimeout(async () => {
      try {
        await supabase.from('pengaturan').upsert({
          key: 'cuitan_list',
          val: JSON.stringify(list),
        });
      } catch (err) {
        console.warn('Gagal background sync cuitan ke Supabase:', err);
      }
    }, 250);
  }
}

// ==============================================================================
// DATA SERVICE (HYBRID SUPABASE + FALLBACK)
// ==============================================================================
export const DataService = {
  // Inisialisasi awal
  async seedInitialAccountsIfNeeded() {
    if (isSupabaseConfigured) {
      return;
    }
    getLocalDB();
  },

  // 1. Autentikasi 1 Gerbang (Universal Login)
  async login(usernameInput: string, passwordInput: string): Promise<{ success: boolean; user?: UserAccount; message?: string }> {
    const username = usernameInput.trim().toLowerCase();
    const password = passwordInput.trim();

    if (!username || !password) {
      return { success: false, message: 'Harap isi Username dan Kata Sandi.' };
    }

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('username', username)
          .maybeSingle();

        if (error || !data) {
          if (!data || error?.code === 'PGRST116' || error?.message?.includes('Cannot coerce')) {
            return {
              success: false,
              message: 'Akun tidak ditemukan.',
            };
          }
          console.warn('Supabase login check:', error?.message || 'Data kosong');
          return { 
            success: false, 
            message: 'Akun tidak ditemukan.' 
          };
        }

        if (data.password !== password) {
          return { success: false, message: 'Kata sandi tidak cocok. Silakan coba lagi.' };
        }

        let role: UserRole = (data.role as UserRole) || 'siswa';
        // Akun admin memiliki akses admin, akun hibri adalah guru pengajar
        if (username === 'admin') {
          role = 'admin';
        } else if (username === 'hibri') {
          role = 'guru';
        } else {
          try {
            const { data: adminSetting } = await supabase.from('pengaturan').select('val').eq('key', 'admin_users').maybeSingle();
            if (adminSetting?.val) {
              const admins = JSON.parse(adminSetting.val);
              if (Array.isArray(admins) && admins.includes(username)) {
                role = 'admin';
              }
            }
          } catch {}
        }

        const guruMap = await this.getGuruSekolahMap();
        const mappedSekolah = guruMap[username];
        const finalSekolahId = mappedSekolah?.sekolahId || data.sekolah_id || 'sman1-gondanglegi';
        const finalNamaSekolah = mappedSekolah?.namaSekolah || data.nama_sekolah || 'SMA Negeri 1 Gondanglegi';

        const user: UserAccount = {
          username: data.username,
          nama: data.nama,
          role,
          kodeKelas: data.kode_kelas,
          namaKelas: data.nama_kelas,
          sekolahId: finalSekolahId,
          namaSekolah: finalNamaSekolah,
          waktuDaftar: data.created_at
        };

        return { success: true, user };
      } catch (err: unknown) {
        return { success: false, message: err instanceof Error ? err.message : 'Gagal menghubungi Supabase.' };
      }
    }

    // Fallback Local
    const local = getLocalDB();
    const user = local.users[username];
    if (!user) {
      return { success: false, message: 'Akun tidak ditemukan.' };
    }
    if (user.password !== password) {
      return { success: false, message: 'Kata sandi tidak cocok.' };
    }
    if (username === 'admin') {
      user.role = 'admin';
    } else if (username === 'hibri') {
      user.role = 'guru';
    }

    const guruMap = await this.getGuruSekolahMap();
    const mapped = guruMap[username];
    if (mapped) {
      user.sekolahId = mapped.sekolahId;
      user.namaSekolah = mapped.namaSekolah;
    } else if (!user.sekolahId) {
      user.sekolahId = 'sman1-gondanglegi';
      user.namaSekolah = 'SMA Negeri 1 Gondanglegi';
    }

    return { success: true, user };
  },

  // 2. Pendaftaran Siswa Mandiri (dengan Kode Kelas)
  async registerStudent(
    nama: string,
    usernameInput: string,
    password: string,
    kodeKelasInput: string
  ): Promise<{ success: boolean; user?: UserAccount; message?: string }> {
    const cleanNama = nama.trim();
    const username = usernameInput.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
    const cleanPass = password.trim();
    const kodeKelas = kodeKelasInput.trim().toUpperCase();

    if (!cleanNama || !username || !cleanPass || !kodeKelas) {
      return { success: false, message: 'Semua kolom wajib diisi!' };
    }

    if (isSupabaseConfigured) {
      try {
        // Cek apakah kelas ada (menggunakan ilike agar case-insensitive)
        const { data: kelasData, error: errKelas } = await supabase
          .from('kelas')
          .select('*')
          .ilike('kode_kelas', kodeKelas)
          .maybeSingle();

        if (errKelas) {
          return { success: false, message: `Gagal membaca database kelas (${errKelas.message}).` };
        }

        if (!kelasData) {
          return { 
            success: false, 
            message: `Kode kelas "${kodeKelas}" tidak ditemukan! Pastikan kode kelas sudah dibuat oleh gurumu (contoh kode demo: NULIS-10A).` 
          };
        }

        // Cek kapasitas kelas jika ada batasan max_peserta
        const maxCap = (kelasData as any).max_peserta ? Number((kelasData as any).max_peserta) : undefined;
        if (maxCap && maxCap > 0) {
          const { count, error: errCount } = await supabase
            .from('users')
            .select('*', { count: 'exact', head: true })
            .eq('kode_kelas', kelasData.kode_kelas)
            .eq('role', 'siswa');

          if (!errCount && count !== null && count >= maxCap) {
            return {
              success: false,
              message: `Pendaftaran ditolak: Kelas "${kelasData.nama_kelas}" sudah penuh (Kapasitas: ${count}/${maxCap} siswa). Silakan hubungi guru kelas.`
            };
          }
        }

        // Cek username sudah dipakai
        const { data: existingUser, error: errUser } = await supabase
          .from('users')
          .select('username')
          .eq('username', username)
          .maybeSingle();

        if (errUser) {
          console.warn('Cek user:', errUser.message);
        }

        if (existingUser) {
          return { success: false, message: `Username "${username}" sudah digunakan. Silakan pilih username lain.` };
        }

        const kelasMap = await this.getKelasSekolahMap();
        const mappedSekolah = kelasMap[kelasData.kode_kelas];
        const targetSekolahId = mappedSekolah?.sekolahId || (kelasData as any).sekolah_id;
        const targetNamaSekolah = mappedSekolah?.namaSekolah || (kelasData as any).nama_sekolah;

        // Simpan user baru
        const newUser: UserAccount = {
          username,
          nama: cleanNama,
          role: 'siswa',
          password: cleanPass,
          kodeKelas: kelasData.kode_kelas,
          namaKelas: kelasData.nama_kelas,
          sekolahId: targetSekolahId || undefined,
          namaSekolah: targetNamaSekolah || undefined,
          waktuDaftar: getWaktuSekarang()
        };

        try {
          const { error: insertErr } = await supabase.from('users').insert({
            username,
            nama: cleanNama,
            role: 'siswa',
            password: cleanPass,
            kode_kelas: kelasData.kode_kelas,
            nama_kelas: kelasData.nama_kelas,
            sekolah_id: targetSekolahId || null,
            nama_sekolah: targetNamaSekolah || null
          });

          if (insertErr) {
            await supabase.from('users').insert({
              username,
              nama: cleanNama,
              role: 'siswa',
              password: cleanPass,
              kode_kelas: kelasData.kode_kelas,
              nama_kelas: kelasData.nama_kelas
            });
          }
        } catch {
          await supabase.from('users').insert({
            username,
            nama: cleanNama,
            role: 'siswa',
            password: cleanPass,
            kode_kelas: kelasData.kode_kelas,
            nama_kelas: kelasData.nama_kelas
          });
        }

        // Inisialisasi kehadiran live
        await supabase.from('kehadiran_live').upsert({
          username,
          nama: cleanNama,
          kode_kelas: kelasData.kode_kelas,
          aktivitas: 'Beranda',
          is_online: true,
          sedang_keluar_tab: false,
          pelanggaran_count: 0
        });

        return { success: true, user: newUser };
      } catch (err: unknown) {
        return { success: false, message: err instanceof Error ? err.message : 'Gagal mendaftar ke Supabase.' };
      }
    }

    // Fallback Local
    const local = getLocalDB();
    const kelasData = local.kelas[kodeKelas];
    if (!kelasData) {
      return { success: false, message: `Kode kelas "${kodeKelas}" tidak ditemukan! Coba gunakan kode contoh: NULIS-10A` };
    }
    if (kelasData.maxPeserta && kelasData.maxPeserta > 0) {
      const currentCount = Object.values(local.users).filter((u) => u.kodeKelas === kodeKelas && u.role === 'siswa').length;
      if (currentCount >= kelasData.maxPeserta) {
        return {
          success: false,
          message: `Pendaftaran ditolak: Kelas "${kelasData.namaKelas}" sudah penuh (Kapasitas: ${currentCount}/${kelasData.maxPeserta} siswa). Silakan hubungi guru kelas.`
        };
      }
    }
    if (local.users[username]) {
      return { success: false, message: `Username "${username}" sudah digunakan. Pilih username lain.` };
    }

    const kelasMap = await this.getKelasSekolahMap();
    const mappedSekolah = kelasMap[kodeKelas];
    const targetSekolahId = mappedSekolah?.sekolahId || kelasData.sekolahId;
    const targetNamaSekolah = mappedSekolah?.namaSekolah || kelasData.namaSekolah;

    const newUser: UserAccount = {
      username,
      nama: cleanNama,
      role: 'siswa',
      password: cleanPass,
      kodeKelas,
      namaKelas: kelasData.namaKelas,
      sekolahId: targetSekolahId || undefined,
      namaSekolah: targetNamaSekolah || undefined,
      waktuDaftar: getWaktuSekarang()
    };

    local.users[username] = newUser;
    saveLocalDB(local);
    return { success: true, user: newUser };
  },

  // 3. Manajemen Kelas oleh Guru
  async buatKelasBaru(
    namaKelas: string, 
    guruUsername: string, 
    namaGuru: string, 
    maxPeserta?: number,
    sekolahId?: string,
    namaSekolah?: string
  ): Promise<KelasRoom> {
    const cleanNamaKelas = namaKelas.trim();
    const kode = generateKodeKelas();
    const validMaxPeserta = maxPeserta && maxPeserta > 0 ? Math.floor(maxPeserta) : undefined;

    const newRoom: KelasRoom = {
      id: kode,
      kodeKelas: kode,
      namaKelas: cleanNamaKelas,
      guruUsername,
      namaGuru,
      sekolahId: sekolahId || undefined,
      namaSekolah: namaSekolah || undefined,
      waktuDibuat: getWaktuSekarang(),
      maxPeserta: validMaxPeserta
    };

    if (sekolahId && namaSekolah) {
      await this.setKelasSekolah(kode, sekolahId, namaSekolah);
    }

    if (isSupabaseConfigured) {
      try {
        await supabase.from('kelas').insert({
          id: kode,
          kode_kelas: kode,
          nama_kelas: cleanNamaKelas,
          guru_username: guruUsername,
          nama_guru: namaGuru,
          sekolah_id: sekolahId || null,
          nama_sekolah: namaSekolah || null,
          max_peserta: validMaxPeserta ?? null
        });
      } catch {
        try {
          await supabase.from('kelas').insert({
            id: kode,
            kode_kelas: kode,
            nama_kelas: cleanNamaKelas,
            guru_username: guruUsername,
            nama_guru: namaGuru,
            max_peserta: validMaxPeserta ?? null
          });
        } catch {
          await supabase.from('kelas').insert({
            id: kode,
            kode_kelas: kode,
            nama_kelas: cleanNamaKelas,
            guru_username: guruUsername,
            nama_guru: namaGuru
          });
        }
      }
      return newRoom;
    }

    const local = getLocalDB();
    local.kelas[kode] = newRoom;
    saveLocalDB(local);
    return newRoom;
  },

  // 3b. Gabung Kelas Rekan (Co-Teaching Access - Terisolasi per Sekolah)
  async gabungKelasRekan(
    kodeKelasInput: string, 
    guruUsername: string, 
    guruSekolahId?: string
  ): Promise<{ success: boolean; message: string; kelas?: KelasRoom }> {
    const kodeKelas = kodeKelasInput.trim().toUpperCase();
    if (!kodeKelas) return { success: false, message: 'Kode kelas tidak boleh kosong.' };

    const kelasMap = await this.getKelasSekolahMap();
    const mapped = kelasMap[kodeKelas];

    if (isSupabaseConfigured) {
      try {
        const { data: kelasData, error } = await supabase
          .from('kelas')
          .select('*')
          .ilike('kode_kelas', kodeKelas)
          .maybeSingle();

        if (error || !kelasData) {
          return { success: false, message: `Kelas dengan kode "${kodeKelas}" tidak ditemukan.` };
        }

        const classSekolahId = mapped?.sekolahId || (kelasData as any).sekolah_id;
        const classNamaSekolah = mapped?.namaSekolah || (kelasData as any).nama_sekolah;

        if (guruSekolahId && classSekolahId && classSekolahId !== guruSekolahId) {
          return {
            success: false,
            message: `Akses ditolak: Kelas "${kelasData.nama_kelas}" terdaftar di bawah naungan ${classNamaSekolah || classSekolahId}. Anda hanya dapat bergabung dengan kelas di sekolah Anda.`
          };
        }

        // Simpan daftar kelas yang diakses guru di tabel pengaturan
        const key = `guru_access_${guruUsername}`;
        const { data: settingRow } = await supabase
          .from('pengaturan')
          .select('val')
          .eq('key', key)
          .maybeSingle();

        let currentCodes: string[] = [];
        if (settingRow?.val) {
          try {
            currentCodes = JSON.parse(settingRow.val);
          } catch {
            currentCodes = [];
          }
        }

        if (!currentCodes.includes(kelasData.kode_kelas)) {
          currentCodes.push(kelasData.kode_kelas);
          await supabase.from('pengaturan').upsert({
            key,
            val: JSON.stringify(currentCodes)
          });
        }

        const room: KelasRoom = {
          id: kelasData.id,
          kodeKelas: kelasData.kode_kelas,
          namaKelas: kelasData.nama_kelas,
          guruUsername: kelasData.guru_username,
          namaGuru: kelasData.nama_guru,
          sekolahId: classSekolahId || undefined,
          namaSekolah: classNamaSekolah || undefined,
          waktuDibuat: kelasData.created_at
        };

        return { success: true, message: `Berhasil bergabung dengan kelas "${kelasData.nama_kelas}"!`, kelas: room };
      } catch (err: unknown) {
        return { success: false, message: err instanceof Error ? err.message : 'Gagal menghubungi Supabase.' };
      }
    }

    const local = getLocalDB();
    const kelasData = local.kelas[kodeKelas];
    if (!kelasData) {
      return { success: false, message: `Kelas dengan kode "${kodeKelas}" tidak ditemukan.` };
    }

    const classSekolahId = mapped?.sekolahId || kelasData.sekolahId;
    const classNamaSekolah = mapped?.namaSekolah || kelasData.namaSekolah;

    if (guruSekolahId && classSekolahId && classSekolahId !== guruSekolahId) {
      return {
        success: false,
        message: `Akses ditolak: Kelas "${kelasData.namaKelas}" terdaftar di bawah naungan ${classNamaSekolah || classSekolahId}. Anda hanya dapat bergabung dengan kelas di sekolah Anda.`
      };
    }

    return { success: true, message: `Berhasil bergabung dengan kelas "${kelasData.namaKelas}"!`, kelas: kelasData };
  },

  async getAksesKelasGuru(guruUsername: string): Promise<string[]> {
    if (isSupabaseConfigured) {
      try {
        const key = `guru_access_${guruUsername}`;
        const { data } = await supabase.from('pengaturan').select('val').eq('key', key).maybeSingle();
        if (data?.val) {
          return JSON.parse(data.val);
        }
      } catch {
        return [];
      }
    }
    return [];
  },

  // 3b. Gabung Kelas Siswa (Ketika kelas sebelumnya terhapus atau belum punya kelas)
  async gabungKelasSiswa(
    username: string,
    kodeKelasInput: string
  ): Promise<{ success: boolean; message: string; kelas?: KelasRoom }> {
    const cleanKode = (kodeKelasInput || '').trim().toLowerCase();
    if (!cleanKode) {
      return { success: false, message: 'Kode kelas tidak boleh kosong.' };
    }

    if (isSupabaseConfigured) {
      try {
        const { data: allRooms } = await supabase.from('kelas').select('*');
        const targetRoom = (allRooms || []).find(
          (r) => (r.kode_kelas || '').toLowerCase() === cleanKode
        );

        if (!targetRoom) {
          return {
            success: false,
            message: `Kelas dengan kode "${kodeKelasInput}" tidak ditemukan. Pastikan kode kelas yang dimasukkan sudah benar.`
          };
        }

        const maxCap = (targetRoom as any).max_peserta ? Number((targetRoom as any).max_peserta) : undefined;
        if (maxCap && maxCap > 0) {
          const { count } = await supabase
            .from('users')
            .select('*', { count: 'exact', head: true })
            .eq('kode_kelas', targetRoom.kode_kelas)
            .eq('role', 'siswa');

          if (count !== null && count >= maxCap) {
            return {
              success: false,
              message: `Kelas "${targetRoom.nama_kelas}" sudah penuh (${count}/${maxCap} siswa). Tidak dapat bergabung.`
            };
          }
        }

        const kelas: KelasRoom = {
          id: targetRoom.id,
          kodeKelas: targetRoom.kode_kelas,
          namaKelas: targetRoom.nama_kelas,
          guruUsername: targetRoom.guru_username,
          namaGuru: targetRoom.nama_guru,
          waktuDibuat: targetRoom.created_at,
          maxPeserta: maxCap
        };

        // 1. Update profil siswa ke kelas baru
        await supabase
          .from('users')
          .update({ kode_kelas: kelas.kodeKelas, nama_kelas: kelas.namaKelas })
          .eq('username', username);

        // 2. Update status kehadiran live
        await supabase
          .from('kehadiran_live')
          .update({ kode_kelas: kelas.kodeKelas })
          .eq('username', username);

        // 3. Alihkan draf naskah yang belum terkumpul ke kelas baru secara otomatis
        await supabase
          .from('dokumen')
          .update({ kode_kelas: kelas.kodeKelas })
          .eq('username', username)
          .eq('status', 'Draf');

        return {
          success: true,
          message: `Berhasil bergabung ke ${kelas.namaKelas}!`,
          kelas
        };
      } catch (err: any) {
        console.error('Error gabungKelasSiswa:', err);
        return { success: false, message: err?.message || 'Gagal bergabung ke kelas.' };
      }
    }

    const local = getLocalDB();
    const targetRoom = Object.values(local.kelas).find(
      (k) => (k.kodeKelas || '').toLowerCase() === cleanKode
    );

    if (!targetRoom) {
      return {
        success: false,
        message: `Kelas dengan kode "${kodeKelasInput}" tidak ditemukan.`
      };
    }

    if (targetRoom.maxPeserta && targetRoom.maxPeserta > 0) {
      const currentCount = Object.values(local.users).filter((u) => u.kodeKelas === targetRoom.kodeKelas && u.role === 'siswa').length;
      if (currentCount >= targetRoom.maxPeserta) {
        return {
          success: false,
          message: `Kelas "${targetRoom.namaKelas}" sudah penuh (${currentCount}/${targetRoom.maxPeserta} siswa). Tidak dapat bergabung.`
        };
      }
    }

    if (local.users[username]) {
      local.users[username].kodeKelas = targetRoom.kodeKelas;
      local.users[username].namaKelas = targetRoom.namaKelas;
    }
    if (local.live[username]) {
      local.live[username].kodeKelas = targetRoom.kodeKelas;
    }
    Object.values(local.dokumen).forEach((d) => {
      if ((d.username === username || d.nama === username) && d.status === 'Draf') {
        d.kodeKelas = targetRoom.kodeKelas;
      }
    });
    saveLocalDB(local);

    return {
      success: true,
      message: `Berhasil bergabung ke ${targetRoom.namaKelas}!`,
      kelas: targetRoom
    };
  },

  async cekStatusKelas(kodeKelas?: string): Promise<boolean> {
    if (!kodeKelas) return false;
    const clean = kodeKelas.trim().toLowerCase();
    if (isSupabaseConfigured) {
      try {
        const { data } = await supabase.from('kelas').select('id, kode_kelas');
        return (data || []).some((k) => (k.kode_kelas || '').toLowerCase() === clean);
      } catch {
        return false;
      }
    }
    const local = getLocalDB();
    return Object.values(local.kelas).some((k) => (k.kodeKelas || '').toLowerCase() === clean);
  },

  // Edit Nama dan Kapasitas Kelas
  async editKelas(kodeKelas: string, namaBaru: string, maxPesertaBaru?: number): Promise<boolean> {
    const cleanNama = namaBaru.trim();
    if (!kodeKelas || !cleanNama) return false;
    const validMax = maxPesertaBaru && maxPesertaBaru > 0 ? Math.floor(maxPesertaBaru) : null;

    if (isSupabaseConfigured) {
      try {
        const updatePayload: Record<string, unknown> = {
          nama_kelas: cleanNama,
          max_peserta: validMax,
        };
        const { error } = await supabase
          .from('kelas')
          .update(updatePayload)
          .eq('kode_kelas', kodeKelas);

        if (error && error.message?.includes('max_peserta')) {
          await supabase
            .from('kelas')
            .update({ nama_kelas: cleanNama })
            .eq('kode_kelas', kodeKelas);
        }

        await supabase
          .from('users')
          .update({ nama_kelas: cleanNama })
          .eq('kode_kelas', kodeKelas);

        return true;
      } catch (err) {
        console.error('Error editKelas:', err);
        return false;
      }
    }

    const local = getLocalDB();
    if (local.kelas[kodeKelas]) {
      local.kelas[kodeKelas].namaKelas = cleanNama;
      local.kelas[kodeKelas].maxPeserta = validMax ?? undefined;
      Object.values(local.users).forEach((u) => {
        if (u.kodeKelas === kodeKelas) {
          u.namaKelas = cleanNama;
        }
      });
      saveLocalDB(local);
      return true;
    }
    return false;
  },

  async editNamaKelas(kodeKelas: string, namaBaru: string, maxPesertaBaru?: number): Promise<boolean> {
    return this.editKelas(kodeKelas, namaBaru, maxPesertaBaru);
  },

  // Hapus Kelas
  async hapusKelas(kodeKelas: string, guruUsername?: string): Promise<boolean> {
    if (!kodeKelas) return false;

    if (isSupabaseConfigured) {
      try {
        await supabase.from('kelas').delete().eq('kode_kelas', kodeKelas);

        if (guruUsername) {
          const key = `guru_access_${guruUsername}`;
          const { data } = await supabase.from('pengaturan').select('val').eq('key', key).maybeSingle();
          if (data?.val) {
            try {
              const currentCodes = JSON.parse(data.val);
              const updated = currentCodes.filter((c: string) => c !== kodeKelas);
              await supabase.from('pengaturan').upsert({ key, val: JSON.stringify(updated) });
            } catch {}
          }
        }
        return true;
      } catch (err) {
        console.error('Error hapusKelas:', err);
        return false;
      }
    }

    const local = getLocalDB();
    if (local.kelas[kodeKelas]) {
      delete local.kelas[kodeKelas];
      saveLocalDB(local);
      return true;
    }
    return false;
  },

  // Hapus Siswa
  async hapusSiswa(username: string, _kodeKelas?: string) {
    if (isSupabaseConfigured) {
      await supabase.from('users').delete().eq('username', username);
      await supabase.from('kehadiran_live').delete().eq('username', username);
      return;
    }

    const local = getLocalDB();
    delete local.users[username];
    delete local.live[username];
    saveLocalDB(local);
  },

  // Reset Password Siswa oleh Guru
  async resetPasswordSiswa(username: string, passwordBaru: string = '123456'): Promise<{ success: boolean; message: string }> {
    const cleanPass = passwordBaru.trim() || '123456';
    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase.from('users').update({ password: cleanPass }).eq('username', username);
        if (error) {
          return { success: false, message: `Gagal mereset sandi: ${error.message}` };
        }
        return { success: true, message: `Kata sandi untuk @${username} berhasil direset menjadi: ${cleanPass}` };
      } catch (err: unknown) {
        return { success: false, message: err instanceof Error ? err.message : 'Gagal mereset kata sandi.' };
      }
    }

    const local = getLocalDB();
    if (local.users[username]) {
      local.users[username].password = cleanPass;
      saveLocalDB(local);
      return { success: true, message: `Kata sandi untuk @${username} berhasil direset menjadi: ${cleanPass}` };
    }
    return { success: false, message: 'Pengguna tidak ditemukan.' };
  },

  // Ubah Akun Siswa (Hanya ID/Username dan Password - Nama Lengkap Terkunci)
  async ubahAkunSiswa(
    oldUsername: string,
    newUsername: string,
    newPassword?: string
  ): Promise<{ success: boolean; message: string; user?: UserAccount }> {
    const cleanOld = oldUsername.trim().toLowerCase();
    const cleanNew = newUsername.trim().toLowerCase();

    if (!cleanNew) {
      return { success: false, message: 'ID / Username tidak boleh kosong.' };
    }
    if (cleanNew.length < 3) {
      return { success: false, message: 'Username minimal 3 karakter.' };
    }
    if (!/^[a-zA-Z0-9_.-]+$/.test(cleanNew)) {
      return { success: false, message: 'Username hanya boleh berisi huruf, angka, titik, strip (-), dan garis bawah (_).' };
    }

    if (newPassword && newPassword.trim().length < 4) {
      return { success: false, message: 'Kata sandi baru minimal 4 karakter.' };
    }

    const isUsernameChanged = cleanOld !== cleanNew;

    if (isSupabaseConfigured) {
      try {
        // Jika username berubah, pastikan username baru belum dipakai
        if (isUsernameChanged) {
          const { data: existing } = await supabase
            .from('users')
            .select('username')
            .eq('username', cleanNew)
            .maybeSingle();

          if (existing) {
            return { success: false, message: `Username "${cleanNew}" sudah dipakai oleh akun lain. Silakan pilih username yang berbeda.` };
          }
        }

        // Ambil data user sekarang
        const { data: userData, error: fetchErr } = await supabase
          .from('users')
          .select('*')
          .eq('username', cleanOld)
          .single();

        if (fetchErr || !userData) {
          return { success: false, message: 'Data akun tidak ditemukan di database.' };
        }

        const updatePayload: Record<string, unknown> = {};
        if (isUsernameChanged) {
          updatePayload.username = cleanNew;
        }
        if (newPassword && newPassword.trim()) {
          updatePayload.password = newPassword.trim();
        }

        if (Object.keys(updatePayload).length > 0) {
          const { error: updateErr } = await supabase
            .from('users')
            .update(updatePayload)
            .eq('username', cleanOld);

          if (updateErr) {
            return { success: false, message: `Gagal memperbarui akun: ${updateErr.message}` };
          }
        }

        // Jika username berubah, perbarui seluruh referensi relasional
        if (isUsernameChanged) {
          try {
            await supabase.from('dokumen').update({ username: cleanNew }).eq('username', cleanOld);
            await supabase.from('kehadiran_live').update({ username: cleanNew }).eq('username', cleanOld);
            await supabase.from('komentar').update({ username: cleanNew }).eq('username', cleanOld);
          } catch {}

          // Perbarui dokumen di mana user terdaftar sebagai rekan kolaborator
          try {
            const { data: collabDocs } = await supabase
              .from('dokumen')
              .select('id, kolaborator, kolaborator_usernames')
              .eq('is_kolaboratif', true);
            if (collabDocs && collabDocs.length > 0) {
              for (const cd of collabDocs) {
                const kList = cd.kolaborator || [];
                const uList = cd.kolaborator_usernames || [];
                const hasUser = uList.includes(cleanOld) || kList.some((k: any) => k.username === cleanOld);
                if (hasUser) {
                  const updatedKList = kList.map((k: any) =>
                    k.username === cleanOld ? { ...k, username: cleanNew } : k
                  );
                  const updatedUList = uList.map((u: string) => (u === cleanOld ? cleanNew : u));
                  await supabase
                    .from('dokumen')
                    .update({
                      kolaborator: updatedKList,
                      kolaborator_usernames: updatedUList,
                    })
                    .eq('id', cd.id);
                }
              }
            }
          } catch (e) {
            console.warn('Gagal cascade kolaborator dokumen di Supabase:', e);
          }

          // Perbarui Cuitan, Komentar Cuitan, dan Likes Cuitan
          try {
            let cuitanList: CuitanItem[] = [];
            if (isSupabaseConfigured) {
              const { data: remoteCuitan } = await supabase
                .from('pengaturan')
                .select('val')
                .eq('key', 'cuitan_list')
                .maybeSingle();
              if (remoteCuitan && remoteCuitan.val) {
                const parsed = typeof remoteCuitan.val === 'string' ? JSON.parse(remoteCuitan.val) : remoteCuitan.val;
                if (Array.isArray(parsed) && parsed.length > 0) {
                  cuitanList = parsed;
                }
              }
            }
            if (cuitanList.length === 0) {
              cuitanList = inMemoryCuitanCache || (await this.getCuitanList());
            }

            let cuitanChanged = false;
            const updatedCuitanList = cuitanList.map((c) => {
              let itemChanged = false;
              let cUsername = c.username;
              if (c.username.toLowerCase() === cleanOld) {
                cUsername = cleanNew;
                itemChanged = true;
              }
              let cLikes = c.likes || [];
              if (cLikes.some((u) => u.toLowerCase() === cleanOld)) {
                cLikes = cLikes.map((u) => (u.toLowerCase() === cleanOld ? cleanNew : u));
                itemChanged = true;
              }
              let cKomentar = c.komentar || [];
              const updatedKomentar = cKomentar.map((k) => {
                let komChanged = false;
                let kUsername = k.username;
                let kReplyTo = k.replyToUsername;
                let kLikes = k.likes || [];
                if (k.username.toLowerCase() === cleanOld) {
                  kUsername = cleanNew;
                  komChanged = true;
                }
                if (k.replyToUsername && k.replyToUsername.toLowerCase() === cleanOld) {
                  kReplyTo = cleanNew;
                  komChanged = true;
                }
                if (kLikes.some((u) => u.toLowerCase() === cleanOld)) {
                  kLikes = kLikes.map((u) => (u.toLowerCase() === cleanOld ? cleanNew : u));
                  komChanged = true;
                }
                if (komChanged) {
                  itemChanged = true;
                  return { ...k, username: kUsername, replyToUsername: kReplyTo, likes: kLikes };
                }
                return k;
              });

              if (itemChanged) {
                cuitanChanged = true;
                return {
                  ...c,
                  username: cUsername,
                  likes: cLikes,
                  komentar: updatedKomentar,
                };
              }
              return c;
            });

            if (cuitanChanged) {
              saveCuitanState(updatedCuitanList, true);
              if (isSupabaseConfigured) {
                await supabase.from('pengaturan').upsert({
                  key: 'cuitan_list',
                  val: JSON.stringify(updatedCuitanList),
                });
              }
            }
          } catch (e) {
            console.warn('Gagal cascade username ke cuitan:', e);
          }

          // Perbarui tiket redeem jika pernah klaim
          try {
            const list = await this.getDaftarKodeRedeem();
            let changed = false;
            list.forEach((item) => {
              if (item.redeemedByUsername === cleanOld) {
                item.redeemedByUsername = cleanNew;
                changed = true;
              }
            });
            if (changed) {
              await supabase.from('pengaturan').upsert({
                key: 'migrasi_redeem_list',
                val: JSON.stringify(list)
              });
            }
          } catch {}
        }

        const updatedUser: UserAccount = {
          username: cleanNew,
          nama: String(userData.nama || ''),
          role: 'siswa',
          password: (newPassword && newPassword.trim() ? newPassword.trim() : userData.password) as string,
          kodeKelas: (userData.kode_kelas as string) || undefined,
          namaKelas: (userData.nama_kelas as string) || undefined,
          waktuDaftar: (userData.created_at as string) || undefined
        };

        // Sinkronkan ke LocalDB
        const local = getLocalDB();
        if (local.users[cleanOld]) {
          const oldAccount = local.users[cleanOld];
          delete local.users[cleanOld];
          local.users[cleanNew] = {
            ...oldAccount,
            username: cleanNew,
            password: updatedUser.password
          };
        }
        if (isUsernameChanged) {
          // Dokumen di localDB
          Object.values(local.dokumen).forEach((d) => {
            if (d.username === cleanOld) d.username = cleanNew;
            if (d.kolaborator && Array.isArray(d.kolaborator)) {
              d.kolaborator.forEach((k) => {
                if (k.username === cleanOld) k.username = cleanNew;
              });
            }
            if (d.kolaboratorUsernames && Array.isArray(d.kolaboratorUsernames)) {
              d.kolaboratorUsernames = d.kolaboratorUsernames.map((u) => (u === cleanOld ? cleanNew : u));
            }
          });
          // Likes & Komentar di localDB
          if (local.likes) {
            Object.keys(local.likes).forEach((docId) => {
              if (local.likes[docId] && local.likes[docId][cleanOld] !== undefined) {
                local.likes[docId][cleanNew] = local.likes[docId][cleanOld];
                delete local.likes[docId][cleanOld];
              }
            });
          }
          if (local.komentar) {
            Object.keys(local.komentar).forEach((docId) => {
              if (local.komentar[docId]) {
                local.komentar[docId].forEach((k) => {
                  if (k.username === cleanOld) k.username = cleanNew;
                });
              }
            });
          }
          if (local.live && local.live[cleanOld]) {
            const liveOld = local.live[cleanOld];
            delete local.live[cleanOld];
            local.live[cleanNew] = { ...liveOld, username: cleanNew };
          }
        }
        saveLocalDB(local);

        // Update session di peramban seketika
        if (isUsernameChanged && typeof window !== 'undefined') {
          try {
            const curSession = localStorage.getItem('nulislur_session');
            if (curSession) {
              const parsed = JSON.parse(curSession);
              if (parsed.username === cleanOld) {
                const updated = { ...parsed, username: cleanNew, password: updatedUser.password };
                localStorage.setItem('nulislur_session', JSON.stringify(updated));
                sessionStorage.setItem('nulislur_session', JSON.stringify(updated));
              }
            }
          } catch {}
          window.dispatchEvent(new CustomEvent('nulislur_db_change'));
        }

        return {
          success: true,
          message: isUsernameChanged
            ? `ID akun berhasil diubah menjadi @${cleanNew}. Silakan gunakan username baru untuk login selanjutnya!`
            : 'Kata sandi berhasil diperbarui!',
          user: updatedUser
        };
      } catch (err: unknown) {
        return {
          success: false,
          message: err instanceof Error ? err.message : 'Terjadi gangguan saat menyimpan pembaruan akun.'
        };
      }
    }

    // Fallback Local Storage
    const local = getLocalDB();
    if (!local.users[cleanOld]) {
      return { success: false, message: 'Akun tidak ditemukan di penyimpanan lokal.' };
    }

    if (isUsernameChanged && local.users[cleanNew]) {
      return { success: false, message: `Username "${cleanNew}" sudah dipakai oleh akun lain.` };
    }

    const target = local.users[cleanOld];
    const finalPassword = newPassword && newPassword.trim() ? newPassword.trim() : target.password;

    if (isUsernameChanged) {
      delete local.users[cleanOld];
      local.users[cleanNew] = {
        ...target,
        username: cleanNew,
        password: finalPassword
      };

      Object.values(local.dokumen).forEach((d) => {
        if (d.username === cleanOld) d.username = cleanNew;
        if (d.kolaborator && Array.isArray(d.kolaborator)) {
          d.kolaborator.forEach((k) => {
            if (k.username === cleanOld) k.username = cleanNew;
          });
        }
        if (d.kolaboratorUsernames && Array.isArray(d.kolaboratorUsernames)) {
          d.kolaboratorUsernames = d.kolaboratorUsernames.map((u) => (u === cleanOld ? cleanNew : u));
        }
      });

      if (local.likes) {
        Object.keys(local.likes).forEach((docId) => {
          if (local.likes[docId] && local.likes[docId][cleanOld] !== undefined) {
            local.likes[docId][cleanNew] = local.likes[docId][cleanOld];
            delete local.likes[docId][cleanOld];
          }
        });
      }

      if (local.komentar) {
        Object.keys(local.komentar).forEach((docId) => {
          if (local.komentar[docId]) {
            local.komentar[docId].forEach((k) => {
              if (k.username === cleanOld) k.username = cleanNew;
            });
          }
        });
      }

      if (local.live[cleanOld]) {
        const liveOld = local.live[cleanOld];
        delete local.live[cleanOld];
        local.live[cleanNew] = { ...liveOld, username: cleanNew };
      }

      if (local.redeemList) {
        local.redeemList.forEach((r) => {
          if (r.redeemedByUsername === cleanOld) r.redeemedByUsername = cleanNew;
        });
      }

      // Cascade ke cuitan lokal
      if (local.cuitanList) {
        local.cuitanList = local.cuitanList.map((c) => {
          let cUser = c.username === cleanOld ? cleanNew : c.username;
          let cLikes = (c.likes || []).map((u) => (u === cleanOld ? cleanNew : u));
          let cKom = (c.komentar || []).map((k) => ({
            ...k,
            username: k.username === cleanOld ? cleanNew : k.username,
            replyToUsername: k.replyToUsername === cleanOld ? cleanNew : k.replyToUsername,
            likes: (k.likes || []).map((u) => (u === cleanOld ? cleanNew : u)),
          }));
          return { ...c, username: cUser, likes: cLikes, komentar: cKom };
        });
        inMemoryCuitanCache = local.cuitanList;
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('nulislur_cuitan_change', { detail: local.cuitanList }));
        }
      }
    } else {
      target.password = finalPassword;
    }

    saveLocalDB(local);

    if (isUsernameChanged && typeof window !== 'undefined') {
      try {
        const curSession = localStorage.getItem('nulislur_session');
        if (curSession) {
          const parsed = JSON.parse(curSession);
          if (parsed.username === cleanOld) {
            const updated = { ...parsed, username: cleanNew, password: finalPassword };
            localStorage.setItem('nulislur_session', JSON.stringify(updated));
            sessionStorage.setItem('nulislur_session', JSON.stringify(updated));
          }
        }
      } catch {}
      window.dispatchEvent(new CustomEvent('nulislur_db_change'));
    }

    const updatedUser: UserAccount = {
      ...local.users[cleanNew || cleanOld],
      username: cleanNew,
      password: finalPassword
    };

    return {
      success: true,
      message: isUsernameChanged
        ? `ID akun berhasil diubah menjadi @${cleanNew}. Silakan gunakan username baru untuk login selanjutnya!`
        : 'Kata sandi berhasil diperbarui!',
      user: updatedUser
    };
  },

  // 4. Setup Kehadiran Siswa (Bebas dari algoritma kicked paksa, selalu aktif 24/7)
  setupKehadiran(
    username: string,
    nama: string,
    kodeKelas: string | undefined,
    sessionId: string
  ): () => void {
    activePresenceActivity = 'Beranda';
    activePresenceDocId = null;

    const syncPresenceOnline = () => {
      broadcastLiveMessage('status_update', {
        username,
        nama,
        kodeKelas: kodeKelas || 'Umum',
        aktivitas: activePresenceActivity,
        docAktifId: activePresenceDocId,
        isOnline: true,
        sedangKeluarTab: false,
        sessionId
      });

      if (isSupabaseConfigured) {
        supabase.from('kehadiran_live').upsert({
          username,
          nama,
          kode_kelas: kodeKelas || 'Umum',
          aktivitas: activePresenceActivity,
          doc_aktif_id: activePresenceDocId,
          is_online: true,
          sedang_keluar_tab: false,
          session_id: sessionId,
          updated_at: new Date().toISOString()
        }).then();
      } else {
        const local = getLocalDB();
        local.live[username] = {
          username,
          nama,
          kodeKelas: kodeKelas || 'Umum',
          aktivitas: activePresenceActivity,
          docAktifId: activePresenceDocId,
          isOnline: true,
          sedangKeluarTab: false,
          sessionId,
          pelanggaranCount: local.live[username]?.pelanggaranCount || 0,
          updatedAt: Date.now()
        };
        saveLocalDB(local);
      }
    };

    // Sinyal instan saat pertama kali setup
    syncPresenceOnline();

    // Heartbeat berkala setiap 60 detik agar hemat bandwidth & tidak membebani kuota log database
    const heartbeatTimer = setInterval(syncPresenceOnline, 60000);

    const handleWindowUnload = () => {
      broadcastLiveMessage('status_update', {
        username,
        nama,
        kodeKelas: kodeKelas || 'Umum',
        aktivitas: 'Offline',
        isOnline: false,
        sedangKeluarTab: false
      });
      if (isSupabaseConfigured) {
        supabase.from('kehadiran_live').update({
          is_online: false,
          updated_at: new Date().toISOString()
        }).eq('username', username).then();
      }
    };

    window.addEventListener('beforeunload', handleWindowUnload);
    window.addEventListener('pagehide', handleWindowUnload);

    return () => {
      clearInterval(heartbeatTimer);
      window.removeEventListener('beforeunload', handleWindowUnload);
      window.removeEventListener('pagehide', handleWindowUnload);

      broadcastLiveMessage('status_update', {
        username,
        nama,
        kodeKelas: kodeKelas || 'Umum',
        aktivitas: 'Offline',
        isOnline: false,
        sedangKeluarTab: false
      });

      if (isSupabaseConfigured) {
        supabase.from('kehadiran_live').update({
          is_online: false,
          updated_at: new Date().toISOString()
        }).eq('username', username).then();
      } else {
        const curr = getLocalDB();
        if (curr.live[username]) {
          curr.live[username].isOnline = false;
          saveLocalDB(curr);
        }
      }
    };
  },

  // Update aktivitas live (selalu aktif dan mandiri dari setting sensor)
  updateAktivitas(username: string, aktivitas: string, docAktifId: string | null = null) {
    if (!username) return;

    const now = Date.now();
    if (
      lastBroadcastStatus &&
      lastBroadcastStatus.username === username &&
      lastBroadcastStatus.aktivitas === aktivitas &&
      lastBroadcastStatus.docAktifId === docAktifId &&
      now - lastBroadcastStatus.time < 15000
    ) {
      // Data aktivitas persis sama dalam 15 detik terakhir, cegah spam request
      return;
    }
    lastBroadcastStatus = { username, aktivitas, docAktifId, time: now };

    activePresenceActivity = aktivitas;
    activePresenceDocId = docAktifId;

    broadcastLiveMessage('status_update', {
      username,
      aktivitas,
      docAktifId,
      isOnline: true
    });

    if (isSupabaseConfigured) {
      supabase.from('kehadiran_live').update({
        aktivitas,
        doc_aktif_id: docAktifId,
        is_online: true,
        updated_at: new Date().toISOString()
      }).eq('username', username).then();
      return;
    }

    const local = getLocalDB();
    if (local.live[username]) {
      local.live[username].aktivitas = aktivitas;
      local.live[username].docAktifId = docAktifId;
      local.live[username].isOnline = true;
      local.live[username].updatedAt = Date.now();
      saveLocalDB(local);
    }
  },

  // Catat Pelanggaran Layar (Anti-Curang) dengan Broadcast Instan (<30ms)
  async catatPelanggaran(username: string, docId?: string | null, nama?: string) {
    if (!username) return;

    const payload = {
      username,
      nama: nama || username,
      docId,
      sedangKeluarTab: true,
      timestamp: Date.now()
    };

    // Sinyal instan ke seluruh tab peramban dan WebSocket Supabase (<30ms)
    broadcastLiveMessage('pelanggaran', payload);

    if (isSupabaseConfigured) {
      // Simpan permanen ke Supabase di background tanpa menahan UI
      try {
        const { data } = await supabase
          .from('kehadiran_live')
          .select('pelanggaran_count, nama, kode_kelas')
          .eq('username', username)
          .maybeSingle();

        const count = (data?.pelanggaran_count || 0) + 1;
        await supabase.from('kehadiran_live').upsert({
          username,
          nama: data?.nama || nama || username,
          kode_kelas: data?.kode_kelas || 'Umum',
          is_online: true,
          sedang_keluar_tab: true,
          pelanggaran_count: count,
          updated_at: new Date().toISOString()
        });

        if (docId) {
          const { data: docData } = await supabase
            .from('dokumen')
            .select('pelanggaran')
            .eq('id', docId)
            .maybeSingle();

          if (docData) {
            await supabase.from('dokumen').update({
              pelanggaran: (docData.pelanggaran || 0) + 1
            }).eq('id', docId);
          }
        }
      } catch (err) {
        console.error('Error catatPelanggaran background save:', err);
      }
      return;
    }

    const local = getLocalDB();
    if (local.live[username]) {
      local.live[username].sedangKeluarTab = true;
      local.live[username].pelanggaranCount = (local.live[username].pelanggaranCount || 0) + 1;
    }
    if (docId && local.dokumen[docId]) {
      local.dokumen[docId].pelanggaran = (local.dokumen[docId].pelanggaran || 0) + 1;
    }
    saveLocalDB(local);
    window.dispatchEvent(
      new CustomEvent('nulislur_pelanggaran_notify', {
        detail: { username, nama: nama || username, docId }
      })
    );
  },

  // Pulihkan status fokus saat kembali ke lembar tulisan
  async pulihkanFokus(username: string) {
    if (!username) return;

    broadcastLiveMessage('pulihkan_fokus', {
      username,
      timestamp: Date.now()
    });

    if (isSupabaseConfigured) {
      await supabase
        .from('kehadiran_live')
        .update({ sedang_keluar_tab: false, updated_at: new Date().toISOString() })
        .eq('username', username);
      return;
    }
    const local = getLocalDB();
    if (local.live[username]) {
      local.live[username].sedangKeluarTab = false;
      saveLocalDB(local);
    }
  },

  // Reset Semua Pelanggaran
  async resetSemuaPelanggaran() {
    // 1. Pancarkan reset instan ke antartab peramban & WebSocket
    broadcastLiveMessage('reset_pelanggaran', { timestamp: Date.now() });

    if (isSupabaseConfigured) {
      try {
        // PostgREST membutuhkan WHERE clause eksplisit untuk UPDATE
        await supabase
          .from('kehadiran_live')
          .update({ sedang_keluar_tab: false, pelanggaran_count: 0 })
          .neq('username', '');

        await supabase
          .from('dokumen')
          .update({ pelanggaran: 0 })
          .neq('id', '00000000-0000-0000-0000-000000000000');
      } catch (err) {
        console.error('Error resetSemuaPelanggaran:', err);
      }
      return;
    }

    const local = getLocalDB();
    Object.keys(local.live).forEach((u) => {
      local.live[u].sedangKeluarTab = false;
      local.live[u].pelanggaranCount = 0;
    });
    Object.keys(local.dokumen).forEach((d) => {
      local.dokumen[d].pelanggaran = 0;
    });
    saveLocalDB(local);
  },

  // Master Tracking Sensor
  listenTrackingAktif(callback: (aktif: boolean) => void): () => void {
    const liveListener: LiveBroadcastListener = (event, payload) => {
      if (event === 'tracking_toggle' && payload && typeof payload.aktif === 'boolean') {
        callback(payload.aktif);
      }
    };
    liveBroadcastListeners.add(liveListener);

    if (isSupabaseConfigured) {
      supabase.from('pengaturan').select('val').eq('key', 'tracking_aktif').maybeSingle().then(({ data }) => {
        callback(data ? data.val !== 'false' : true);
      });

      const channel = supabase
        .channel('public:pengaturan')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'pengaturan', filter: 'key=eq.tracking_aktif' }, (p) => {
          const val = (p.new as any)?.val;
          callback(val !== 'false');
        })
        .subscribe();

      return () => {
        liveBroadcastListeners.delete(liveListener);
        supabase.removeChannel(channel);
      };
    }

    const local = getLocalDB();
    callback(local.trackingAktif ?? true);
    const handler = () => {
      callback(getLocalDB().trackingAktif ?? true);
    };
    window.addEventListener('nulislur_db_change', handler);
    return () => {
      liveBroadcastListeners.delete(liveListener);
      window.removeEventListener('nulislur_db_change', handler);
    };
  },

  async setMasterTracking(aktif: boolean) {
    broadcastLiveMessage('tracking_toggle', { aktif });
    if (isSupabaseConfigured) {
      await supabase.from('pengaturan').upsert({ key: 'tracking_aktif', val: String(aktif) });
      return;
    }
    const local = getLocalDB();
    local.trackingAktif = aktif;
    saveLocalDB(local);
  },

  // 5. Manajemen Dokumen Menulis
  async buatDokumenBaru(
    nama: string,
    username: string,
    kodeKelas: string | undefined,
    judul: string,
    penulisKategori: 'Siswa' | 'Guru' = 'Siswa',
    topik?: string,
    tugasId?: string | null,
    judulTugas?: string | null,
    isKolaboratif?: boolean,
    kolaborator?: KolaboratorAnggota[]
  ): Promise<string> {
    const cleanJudul = judul.replace(/\n|\r/g, ' ').substring(0, 100);
    const waktu = getWaktuSekarang();

    const defaultLayout = (typeof window !== 'undefined' ? (localStorage.getItem('nulislur_layout_mode') as 'web' | 'kertas') : null) || 'kertas';

    let namaKelasDoc: string | undefined = undefined;
    try {
      const local = getLocalDB();
      if (kodeKelas && local.kelas && local.kelas[kodeKelas]) {
        namaKelasDoc = local.kelas[kodeKelas].namaKelas;
      } else if (local.users && local.users[username]) {
        namaKelasDoc = local.users[username].namaKelas;
      }
    } catch {}

    const safeCollab = Boolean(isKolaboratif);
    const safeKolaborator = kolaborator || [];
    const safeUsernames = safeKolaborator.map((k) => k.username);

    if (isSupabaseConfigured) {
      const payload: Record<string, unknown> = {
        nama,
        username,
        kode_kelas: kodeKelas || 'Umum',
        judul: cleanJudul,
        teks: '<p></p>',
        status: 'Draf',
        pelanggaran: 0,
        is_public: false,
        izin_publish: false,
        penulis_kategori: penulisKategori,
        waktu_edit: waktu,
        layout_mode: defaultLayout,
      };
      if (topik) payload.topik = topik;
      if (tugasId) payload.tugas_id = tugasId;
      if (judulTugas) payload.judul_tugas = judulTugas;
      if (safeCollab) {
        payload.is_kolaboratif = true;
        payload.kolaborator = safeKolaborator;
      }

      let insertRes = await supabase.from('dokumen').insert(payload).select('id').single();
      let data = insertRes.data;
      let error = insertRes.error;

      // Dynamic missing column retry loop jika schema Supabase belum memiliki layout_mode, is_kolaboratif, dll:
      let attempts = 0;
      while (error && attempts < 8) {
        attempts++;
        const errMsg = error.message || '';
        let colRemoved = false;

        const match = errMsg.match(/Could not find the '([^']+)' column/i);
        if (match && match[1]) {
          const missingCol = match[1];
          if (missingCol in payload) {
            delete payload[missingCol];
            colRemoved = true;
          }
        }

        const candidateCols = ['layout_mode', 'tugas_id', 'judul_tugas', 'topik', 'penulis_kategori', 'is_kolaboratif', 'kolaborator', 'kolaborator_usernames'];
        for (const col of candidateCols) {
          if (errMsg.toLowerCase().includes(col) && col in payload) {
            delete payload[col];
            colRemoved = true;
          }
        }

        if (colRemoved) {
          insertRes = await supabase.from('dokumen').insert(payload).select('id').single();
          data = insertRes.data;
          error = insertRes.error;
        } else {
          break;
        }
      }

      if (error || !data) {
        console.warn('Supabase buatDokumenBaru fallback ke local storage:', error?.message);
        const local = getLocalDB();
        const fallbackId = 'doc_' + Date.now();
        const fallbackDoc: Dokumen = {
          id: fallbackId,
          nama,
          username,
          kodeKelas: kodeKelas || 'Umum',
          namaKelas: namaKelasDoc,
          judul: cleanJudul,
          teks: '<p></p>',
          status: 'Draf',
          pelanggaran: 0,
          waktuEdit: waktu,
          isPublic: false,
          izinPublish: false,
          penulisKategori,
          views: 0,
          topik,
          tugasId: tugasId || undefined,
          judulTugas: judulTugas || undefined,
          layoutMode: defaultLayout,
          isKolaboratif: safeCollab,
          kolaborator: safeKolaborator,
          kolaboratorUsernames: safeUsernames,
        };
        local.dokumen[fallbackId] = fallbackDoc;
        saveLocalDB(local);
        return fallbackId;
      }

      if (typeof window !== 'undefined') {
        try {
          if (defaultLayout) {
            localStorage.setItem(`doc_layout_${data.id}`, defaultLayout);
          }
          if (tugasId || judulTugas) {
            localStorage.setItem(`doc_tugas_${data.id}`, JSON.stringify({ tugasId, judulTugas }));
          }
        } catch {}
      }

      try {
        const local = getLocalDB();
        local.dokumen[data.id] = {
          id: data.id,
          nama,
          username,
          kodeKelas: kodeKelas || 'Umum',
          namaKelas: namaKelasDoc,
          judul: cleanJudul,
          teks: '<p></p>',
          status: 'Draf',
          pelanggaran: 0,
          waktuEdit: waktu,
          isPublic: false,
          izinPublish: false,
          penulisKategori,
          views: 0,
          topik,
          tugasId: tugasId || undefined,
          judulTugas: judulTugas || undefined,
          layoutMode: defaultLayout,
          isKolaboratif: safeCollab,
          kolaborator: safeKolaborator,
          kolaboratorUsernames: safeUsernames,
        };
        saveLocalDB(local);
      } catch {}

      return data.id;
    }

    const local = getLocalDB();
    const id = 'doc_' + Date.now();
    const doc: Dokumen = {
      id,
      nama,
      username,
      kodeKelas: kodeKelas || 'Umum',
      namaKelas: namaKelasDoc,
      judul: cleanJudul,
      teks: '<p></p>',
      status: 'Draf',
      pelanggaran: 0,
      waktuEdit: waktu,
      isPublic: false,
      izinPublish: false,
      penulisKategori,
      views: 0,
      topik,
      tugasId: tugasId || undefined,
      judulTugas: judulTugas || undefined,
      layoutMode: defaultLayout,
      isKolaboratif: safeCollab,
      kolaborator: safeKolaborator,
      kolaboratorUsernames: safeUsernames,
    };
    local.dokumen[id] = doc;
    saveLocalDB(local);
    return id;
  },

  async updateKolaboratorDokumen(docId: string, kolaborator: KolaboratorAnggota[]): Promise<boolean> {
    if (!docId) return false;
    const isCollab = kolaborator.length > 0;
    const usernames = kolaborator.map((k) => k.username);

    const local = getLocalDB();
    if (local.dokumen && local.dokumen[docId]) {
      local.dokumen[docId].isKolaboratif = isCollab;
      local.dokumen[docId].kolaborator = kolaborator;
      local.dokumen[docId].kolaboratorUsernames = usernames;
      saveLocalDB(local);
    }

    if (isSupabaseConfigured) {
      try {
        const payload: Record<string, unknown> = {
          is_kolaboratif: isCollab,
          kolaborator: kolaborator,
        };
        const updateRes = await supabase.from('dokumen').update(payload).eq('id', docId);
        if (updateRes.error) {
          console.warn('Gagal update kolaborator ke Supabase:', updateRes.error.message);
        }
      } catch (e) {
        console.warn('Gagal update kolaborator ke Supabase:', e);
      }
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('nulislur_db_change'));
    }
    return true;
  },

  async getTemanSekelas(kodeKelas?: string, excludeUsername?: string): Promise<UserAccount[]> {
    if (isSupabaseConfigured && kodeKelas) {
      try {
        const { data } = await supabase
          .from('users')
          .select('username, nama, role, kode_kelas, nama_kelas')
          .eq('role', 'siswa')
          .eq('kode_kelas', kodeKelas);
        if (data && data.length > 0) {
          return data
            .filter((u) => u.username !== excludeUsername)
            .map((u) => ({
              username: u.username,
              nama: u.nama,
              role: 'siswa',
              kodeKelas: u.kode_kelas,
              namaKelas: u.nama_kelas,
            }));
        }
      } catch {}
    }
    const local = getLocalDB();
    return Object.values(local.users || {})
      .filter((u) => u.role === 'siswa' && (!kodeKelas || u.kodeKelas === kodeKelas) && u.username !== excludeUsername);
  },

  async simpanDokumen(id: string, judul: string, teks: string, topik?: string, layoutMode?: 'web' | 'kertas') {
    if (!id) return;
    const waktu = getWaktuSekarang();
    if (layoutMode && typeof window !== 'undefined') {
      try {
        localStorage.setItem(`doc_layout_${id}`, layoutMode);
      } catch {}
    }

    // ZERO-TRUST SAFETY SHIELD:
    // Cek apakah data teks yang dikirim adalah string kosong atau tag kosong
    const isIncomingTeksEmpty = !teks || teks.trim() === '' || teks === '<p></p>' || teks === '<p><br></p>' || teks.trim() === '<p> </p>';
    const isIncomingJudulEmpty = !judul || judul.trim() === '';

    // Snapshot lokal darurat setiap kali ada teks valid (Disaster Recovery Buffer)
    if (!isIncomingTeksEmpty && typeof window !== 'undefined') {
      try {
        localStorage.setItem(`nulislur_backup_${id}`, JSON.stringify({
          judul,
          teks,
          waktu,
          timestamp: Date.now()
        }));
      } catch {}
    }

    const local = getLocalDB();
    const existingLocalDoc = local.dokumen ? local.dokumen[id] : undefined;

    if (isSupabaseConfigured) {
      let safeJudul = cleanTitle(judul);
      let safeTeks = teks;

      // Perlindungan jika teks / judul kosong dikirim:
      // Verifikasi ke database apakah dokumen sebelumnya memiliki konten asli.
      // DILARANG KERAS menimpa tulisan siswa dengan teks kosong!
      if (isIncomingTeksEmpty || isIncomingJudulEmpty) {
        try {
          const { data: currentDoc } = await supabase.from('dokumen').select('judul, teks').eq('id', id).maybeSingle();
          if (currentDoc) {
            const currentHasContent = currentDoc.teks && currentDoc.teks.length > 15 && currentDoc.teks !== '<p></p>' && currentDoc.teks !== '<p><br></p>';
            if (isIncomingTeksEmpty && currentHasContent) {
              console.warn(`[SAFETY SHIELD NULISLUR] Menolak penimpaan teks kosong pada dokumen ${id}. Konten asli dipertahankan!`);
              safeTeks = currentDoc.teks;
            }
            if (isIncomingJudulEmpty && currentDoc.judul && currentDoc.judul.trim().length > 0) {
              safeJudul = currentDoc.judul;
            }
          }
        } catch (e) {
          console.warn('[SAFETY SHIELD] Verifikasi DB gagal, menggunakan fallback cache:', e);
          if (isIncomingTeksEmpty && existingLocalDoc?.teks && existingLocalDoc.teks.length > 15) {
            safeTeks = existingLocalDoc.teks;
          }
        }
      }

      const payload: Record<string, unknown> = {
        judul: safeJudul,
        teks: safeTeks,
        waktu_edit: waktu
      };
      if (topik !== undefined) payload.topik = topik;
      if (layoutMode !== undefined) payload.layout_mode = layoutMode;
      let updateRes = await supabase.from('dokumen').update(payload).eq('id', id);
      let error = updateRes.error;
      let attempts = 0;
      while (error && attempts < 4) {
        attempts++;
        const errMsg = error.message || '';
        let colRemoved = false;
        const match = errMsg.match(/Could not find the '([^']+)' column/i);
        if (match && match[1] && match[1] in payload) {
          delete payload[match[1]];
          colRemoved = true;
        }
        for (const col of ['layout_mode', 'topik']) {
          if (errMsg.toLowerCase().includes(col) && col in payload) {
            delete payload[col];
            colRemoved = true;
          }
        }
        if (colRemoved) {
          updateRes = await supabase.from('dokumen').update(payload).eq('id', id);
          error = updateRes.error;
        } else {
          break;
        }
      }

      if (local.dokumen && local.dokumen[id]) {
        local.dokumen[id].judul = safeJudul;
        local.dokumen[id].teks = safeTeks;
        local.dokumen[id].waktuEdit = waktu;
        if (topik !== undefined) local.dokumen[id].topik = topik;
        if (layoutMode !== undefined) local.dokumen[id].layoutMode = layoutMode;
        saveLocalDB(local);
      }
      return;
    }

    if (local.dokumen[id]) {
      const existing = local.dokumen[id];
      const currentHasContent = existing.teks && existing.teks.length > 15 && existing.teks !== '<p></p>' && existing.teks !== '<p><br></p>';
      const safeTeks = (isIncomingTeksEmpty && currentHasContent) ? existing.teks : teks;
      const safeJudul = (isIncomingJudulEmpty && existing.judul && existing.judul.trim().length > 0) ? existing.judul : judul;

      local.dokumen[id].judul = cleanTitle(safeJudul);
      local.dokumen[id].teks = safeTeks;
      local.dokumen[id].waktuEdit = waktu;
      if (topik !== undefined) local.dokumen[id].topik = topik;
      if (layoutMode !== undefined) local.dokumen[id].layoutMode = layoutMode;
      saveLocalDB(local);
    }
  },

  async updateLayoutModeDokumen(id: string, layoutMode: 'web' | 'kertas') {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(`doc_layout_${id}`, layoutMode);
      } catch {}
    }
    if (isSupabaseConfigured) {
      try {
        await supabase.from('dokumen').update({ layout_mode: layoutMode }).eq('id', id);
      } catch {
        // fallback to local
      }
    }
    const local = getLocalDB();
    if (local.dokumen[id]) {
      local.dokumen[id].layoutMode = layoutMode;
      saveLocalDB(local);
      window.dispatchEvent(new CustomEvent('nulislur_db_change'));
    }
  },

  async kumpulkanDokumen(id: string, judul: string, teks: string) {
    const waktu = getWaktuSekarang();
    if (isSupabaseConfigured) {
      await supabase.from('dokumen').update({
        status: 'Terkumpul',
        judul,
        teks,
        waktu_kumpul: waktu,
        waktu_edit: waktu
      }).eq('id', id);
      return;
    }

    const local = getLocalDB();
    if (local.dokumen[id]) {
      local.dokumen[id].status = 'Terkumpul';
      local.dokumen[id].judul = judul;
      local.dokumen[id].teks = teks;
      local.dokumen[id].waktuKumpul = waktu;
      local.dokumen[id].waktuEdit = waktu;
      saveLocalDB(local);
    }
  },

  async updateStatusDokumen(id: string, status: 'Draf' | 'Terkumpul' | 'Selesai', izinPublish = false) {
    const isPublic = status === 'Draf' ? false : undefined;

    if (isSupabaseConfigured) {
      const payload: Record<string, unknown> = { status, izin_publish: izinPublish };
      if (isPublic !== undefined) payload.is_public = isPublic;
      await supabase.from('dokumen').update(payload).eq('id', id);
      return;
    }

    const local = getLocalDB();
    if (local.dokumen[id]) {
      local.dokumen[id].status = status;
      local.dokumen[id].izinPublish = izinPublish;
      if (status === 'Draf') {
        local.dokumen[id].isPublic = false;
      }
      saveLocalDB(local);
    }
  },

  async publikasiKeMading(id: string, topik: string, _nama: string) {
    const stamp = Date.now();
    const waktu = getWaktuSekarang();

    if (isSupabaseConfigured) {
      await supabase.from('dokumen').update({
        is_public: true,
        topik,
        waktu_publish: stamp,
        waktu_publish_teks: waktu
      }).eq('id', id);
      return;
    }

    const local = getLocalDB();
    if (local.dokumen[id]) {
      local.dokumen[id].isPublic = true;
      local.dokumen[id].topik = topik;
      local.dokumen[id].waktuPublish = stamp;
      local.dokumen[id].waktuPublishTeks = waktu;
      saveLocalDB(local);
    }
  },

  async takeDownMading(id: string) {
    if (isSupabaseConfigured) {
      await supabase.from('dokumen').update({
        is_public: false,
        izin_publish: false,
        waktu_publish: null,
        waktu_publish_teks: null
      }).eq('id', id);
      await supabase.from('likes').delete().eq('doc_id', id);
      await supabase.from('komentar').delete().eq('doc_id', id);
      return;
    }

    const local = getLocalDB();
    if (local.dokumen[id]) {
      local.dokumen[id].isPublic = false;
      local.dokumen[id].izinPublish = false;
      local.dokumen[id].waktuPublish = null;
      local.dokumen[id].waktuPublishTeks = null;
      delete local.likes[id];
      delete local.komentar[id];
      saveLocalDB(local);
    }
  },

  async simpanFeedbackUmum(id: string, feedback: string) {
    const cleanFeedback = (feedback || '').trim();
    if (isSupabaseConfigured) {
      await supabase.from('dokumen').update({ feedback_umum: cleanFeedback }).eq('id', id);
      return;
    }

    const local = getLocalDB();
    if (local.dokumen[id]) {
      local.dokumen[id].feedbackUmum = cleanFeedback;
      saveLocalDB(local);
    }
  },

  async simpanPenilaian(id: string, penilaian: PenilaianRubrik, markSelesai = true) {
    if (!id) return;
    const waktu = getWaktuSekarang();
    const cleanFeedback = (penilaian.catatanGuru || '').trim();

    const local = getLocalDB();
    if (local.dokumen[id]) {
      local.dokumen[id].penilaian = penilaian;
      local.dokumen[id].feedbackUmum = cleanFeedback;
      if (markSelesai) {
        local.dokumen[id].status = 'Selesai';
      }
      local.dokumen[id].waktuEdit = waktu;
      saveLocalDB(local);
    }

    if (isSupabaseConfigured) {
      const payload: Record<string, unknown> = {
        feedback_umum: cleanFeedback,
        waktu_edit: waktu,
      };
      if (markSelesai) {
        payload.status = 'Selesai';
      }

      // 1. Coba update kolom penilaian langsung di dokumen
      const fullPayload = {
        ...payload,
        penilaian: JSON.stringify(penilaian),
      };

      const res = await supabase.from('dokumen').update(fullPayload).eq('id', id);
      if (res.error) {
        const errMsg = res.error.message || '';
        // Jika kolom penilaian belum ada di tabel dokumen Supabase:
        if (errMsg.toLowerCase().includes('penilaian')) {
          await supabase.from('dokumen').update(payload).eq('id', id);
          try {
            await supabase.from('pengaturan').upsert({
              key: `penilaian_${id}`,
              val: JSON.stringify(penilaian),
            });
          } catch (e) {
            console.warn('Gagal simpan fallback penilaian ke pengaturan:', e);
          }
        }
      } else {
        // Berhasil update langsung, tetap simpan cadangan di tabel pengaturan
        try {
          await supabase.from('pengaturan').upsert({
            key: `penilaian_${id}`,
            val: JSON.stringify(penilaian),
          });
        } catch {}
      }
    }
  },

  async hapusDokumen(id: string) {
    if (!id) return;

    // 1. Bersihkan dari local storage seketika (0ms)
    try {
      const local = getLocalDB();
      if (local && local.dokumen) {
        delete local.dokumen[id];
        if (local.likes) delete local.likes[id];
        if (local.komentar) delete local.komentar[id];
        saveLocalDB(local);
      }
    } catch {}

    // 2. Hapus dari Supabase jika online
    if (isSupabaseConfigured) {
      try {
        await supabase.from('dokumen').delete().eq('id', id);
      } catch (e) {
        console.warn('Gagal hapus dokumen dari Supabase:', e);
      }
    }

    // 3. Dispatch event agar seluruh listener me-refresh tampilan seketika
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('nulislur_db_change'));
    }
  },

  // 6. Interaksi Ruang Publik
  getViews(docId: string): number {
    try {
      const viewsMap = JSON.parse(localStorage.getItem('nulislur_views_map') || '{}');
      const local = getLocalDB();
      return Math.max(viewsMap[docId] || 0, local.dokumen[docId]?.views || 0, local.views?.[docId] || 0);
    } catch {
      return 0;
    }
  },

  getDocStats(docId: string, username?: string): { views: number; likes: number; comments: number; isLiked: boolean } {
    try {
      const viewsMap = JSON.parse(localStorage.getItem('nulislur_views_map') || '{}');
      const local = getLocalDB();
      const views = Math.max(viewsMap[docId] || 0, local.dokumen[docId]?.views || 0, local.views?.[docId] || 0);
      const likesRaw = local.likes[docId] || {};
      const likes = Object.keys(likesRaw).length;
      const isLiked = username ? !!likesRaw[username] : false;
      const comments = (local.komentar[docId] || []).length;
      return { views, likes, comments, isLiked };
    } catch {
      return { views: 0, likes: 0, comments: 0, isLiked: false };
    }
  },

  async getMadingStatsSummary(): Promise<{ likesMap: Record<string, number>; commentsMap: Record<string, number> }> {
    const likesMap: Record<string, number> = {};
    const commentsMap: Record<string, number> = {};

    const local = getLocalDB();
    if (local.likes) {
      Object.entries(local.likes).forEach(([docId, users]) => {
        likesMap[docId] = Object.keys(users || {}).length;
      });
    }
    if (local.komentar) {
      Object.entries(local.komentar).forEach(([docId, list]) => {
        commentsMap[docId] = (list || []).length;
      });
    }

    if (isSupabaseConfigured) {
      try {
        const [likesRes, commentsRes] = await Promise.all([
          supabase.from('likes').select('doc_id'),
          supabase.from('komentar').select('doc_id')
        ]);

        if (likesRes.data && Array.isArray(likesRes.data)) {
          const remoteLikesMap: Record<string, number> = {};
          likesRes.data.forEach((r: { doc_id: string }) => {
            if (r.doc_id) remoteLikesMap[r.doc_id] = (remoteLikesMap[r.doc_id] || 0) + 1;
          });
          Object.assign(likesMap, remoteLikesMap);
        }

        if (commentsRes.data && Array.isArray(commentsRes.data)) {
          const remoteCommentsMap: Record<string, number> = {};
          commentsRes.data.forEach((r: { doc_id: string }) => {
            if (r.doc_id) remoteCommentsMap[r.doc_id] = (remoteCommentsMap[r.doc_id] || 0) + 1;
          });
          Object.assign(commentsMap, remoteCommentsMap);
        }
      } catch (err) {
        console.warn('Gagal sinkronisasi batch mading stats:', err);
      }
    }

    return { likesMap, commentsMap };
  },

  async toggleLike(docId: string, username: string) {
    if (!docId || !username) return;

    // 1. Optimistic Local Update (Respons Seketika < 1ms untuk animasi hati & angka)
    const local = getLocalDB();
    if (!local.likes) local.likes = {};
    if (!local.likes[docId]) local.likes[docId] = {};
    let isLikedNow = false;
    if (local.likes[docId][username]) {
      delete local.likes[docId][username];
      isLikedNow = false;
    } else {
      local.likes[docId][username] = true;
      isLikedNow = true;
    }
    const currentCount = Object.keys(local.likes[docId]).length;
    saveLocalDB(local);

    window.dispatchEvent(new CustomEvent('nulislur_likes_change', {
      detail: { docId, count: currentCount, isLikedByMe: isLikedNow, username }
    }));

    // 2. Latar Belakang: Sinkronisasi dengan Supabase jika aktif
    if (isSupabaseConfigured) {
      try {
        const { data } = await supabase.from('likes').select('id').match({ doc_id: docId, username }).maybeSingle();
        if (data) {
          if (!isLikedNow) {
            await supabase.from('likes').delete().eq('id', data.id);
          }
        } else {
          if (isLikedNow) {
            await supabase.from('likes').insert({ doc_id: docId, username });
          }
        }

        // Ambil jumlah like terbaru dari Supabase untuk rekonsiliasi
        const { data: allLikes } = await supabase.from('likes').select('username').eq('doc_id', docId);
        if (allLikes) {
          const freshCount = allLikes.length;
          const freshLikedByMe = allLikes.some((l) => l.username === username);
          const freshLocal = getLocalDB();
          if (!freshLocal.likes[docId]) freshLocal.likes[docId] = {};
          if (freshLikedByMe) freshLocal.likes[docId][username] = true;
          else delete freshLocal.likes[docId][username];
          saveLocalDB(freshLocal);
          window.dispatchEvent(new CustomEvent('nulislur_likes_change', {
            detail: { docId, count: freshCount, isLikedByMe: freshLikedByMe, username }
          }));
        }
      } catch (e) {
        console.error('Gagal sinkron like ke Supabase:', e);
      }
    }
  },

  async catatView(docId: string, _username?: string) {
    if (!docId) return;

    // 1. Session Storage Deduplication (Per sesi tab/browser)
    // Jika naskah ini sudah pernah dibuka dalam sesi browsing saat ini, jangan tambah hitung ganda
    try {
      const sessionKey = `nulislur_viewed_${docId}`;
      if (typeof window !== 'undefined' && window.sessionStorage) {
        if (window.sessionStorage.getItem(sessionKey)) {
          return; // Sudah tercatat di sesi ini, abaikan
        }
        window.sessionStorage.setItem(sessionKey, String(Date.now()));
      }
    } catch {}

    // 2. Debounce in-memory guard (minimal selang 30 detik antar pemanggilan untuk docId yang sama)
    const now = Date.now();
    const lastTime = viewedTimestamps.get(docId) || 0;
    if (now - lastTime < 30000) {
      return;
    }
    viewedTimestamps.set(docId, now);

    // 3. Dapatkan angka dasar views saat ini (ambil nilai tertinggi antara local cache dan Supabase)
    let currentViews = this.getViews(docId);

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.from('dokumen').select('views').eq('id', docId).maybeSingle();
        if (!error && data && 'views' in data) {
          const remoteViews = Number(data.views || 0);
          currentViews = Math.max(currentViews, remoteViews);
        }
      } catch {}
    }

    const nextViews = currentViews + 1;

    // 4. Sinkronkan nilai baru secara atomic ke seluruh state lokal
    try {
      const viewsMap = JSON.parse(localStorage.getItem('nulislur_views_map') || '{}');
      viewsMap[docId] = nextViews;
      localStorage.setItem('nulislur_views_map', JSON.stringify(viewsMap));
    } catch {}

    const local = getLocalDB();
    if (!local.views) local.views = {};
    local.views[docId] = nextViews;
    if (local.dokumen[docId]) {
      local.dokumen[docId].views = nextViews;
    }
    saveLocalDB(local);

    window.dispatchEvent(new CustomEvent('nulislur_views_change', { detail: { docId, count: nextViews } }));

    // 5. Update ke Supabase database jika aktif
    if (isSupabaseConfigured) {
      try {
        await supabase.from('dokumen').update({ views: nextViews }).eq('id', docId);
      } catch {
        // Abaikan dengan aman jika kolom views belum ditambahkan di Supabase
      }
    }
  },

  async tambahKomentar(docId: string, nama: string, username: string, teks: string) {
    const waktu = getWaktuSekarang();
    const newKom = {
      id: 'k_' + Date.now(),
      nama,
      username,
      teks,
      waktu
    };

    // 1. Optimistic Local Save (Komentar langsung muncul seketika di daftar)
    const local = getLocalDB();
    if (!local.komentar[docId]) local.komentar[docId] = [];
    local.komentar[docId].push(newKom);
    saveLocalDB(local);

    window.dispatchEvent(new CustomEvent('nulislur_komentar_change', {
      detail: { docId, items: local.komentar[docId] }
    }));

    // 2. Background Supabase sync
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.from('komentar').insert({
          doc_id: docId,
          nama,
          username,
          teks,
          waktu
        }).select().maybeSingle();

        if (!error && data) {
          // Ganti ID sementara dengan ID resmi dari Supabase
          const freshLocal = getLocalDB();
          if (freshLocal.komentar[docId]) {
            const idx = freshLocal.komentar[docId].findIndex(k => k.id === newKom.id);
            if (idx !== -1) {
              freshLocal.komentar[docId][idx] = {
                id: String(data.id),
                nama: data.nama,
                username: data.username,
                teks: data.teks,
                waktu: data.waktu
              };
              saveLocalDB(freshLocal);
              window.dispatchEvent(new CustomEvent('nulislur_komentar_change', {
                detail: { docId, items: freshLocal.komentar[docId] }
              }));
            }
          }
        }
      } catch (e) {
        console.error('Gagal simpan komentar ke Supabase:', e);
      }
    }
  },

  async hapusKomentar(docId: string, komId: string) {
    const local = getLocalDB();
    if (local.komentar[docId]) {
      local.komentar[docId] = local.komentar[docId].filter((k) => k.id !== komId);
      saveLocalDB(local);
    }
    window.dispatchEvent(new CustomEvent('nulislur_komentar_change', {
      detail: { docId, items: local.komentar[docId] || [] }
    }));

    if (isSupabaseConfigured) {
      try {
        await supabase.from('komentar').delete().eq('id', komId);
      } catch {}
    }
  },

  // 7. Pengumuman
  async tambahPengumuman(teks: string, kodeKelas?: string, tugasId?: string | null, sekolahId?: string) {
    const waktu = getWaktuSekarang();
    const id = 'p_' + Date.now();
    const newPengumumanItem: Pengumuman = {
      id,
      teks,
      waktu,
      kodeKelas: kodeKelas || 'Umum',
      tugasId: tugasId || null,
      sekolahId: sekolahId || undefined,
    };

    // 1. Selalu simpan ke localDB terlebih dahulu (optimistic local save)
    const local = getLocalDB();
    if (!local.pengumuman) local.pengumuman = [];
    local.pengumuman.unshift(newPengumumanItem);
    saveLocalDB(local);

    // 2. Simpan ke Supabase jika aktif
    if (isSupabaseConfigured) {
      const payload: Record<string, unknown> = {
        teks,
        waktu,
        kode_kelas: kodeKelas || 'Umum',
      };
      if (tugasId) payload.tugas_id = tugasId;
      if (sekolahId) payload.sekolah_id = sekolahId;

      try {
        let { error } = await supabase.from('pengumuman').insert(payload);
        if (error) {
          const errMsg = error.message || '';
          if (errMsg.includes('sekolah_id')) {
            delete payload.sekolah_id;
          }
          if (errMsg.includes('tugas_id')) {
            delete payload.tugas_id;
          }
          await supabase.from('pengumuman').insert(payload);
        }
      } catch (err) {
        console.warn('Gagal tambah pengumuman di Supabase:', err);
      }
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('nulislur_db_change'));
    }
  },

  // 7b. Penugasan Kelas
  async buatPenugasan(params: {
    judul: string;
    deskripsi: string;
    kodeKelas: string;
    namaKelas?: string;
    guruUsername: string;
    namaGuru: string;
    tenggatWaktu?: string | null;
    topik?: string;
    targetKataMin?: number | null;
  }): Promise<string> {
    const waktu = getWaktuSekarang();
    const id = 'tgs_' + Date.now();
    let assignedId = id;

    if (isSupabaseConfigured) {
      try {
        const payload: Record<string, unknown> = {
          judul: params.judul,
          deskripsi: params.deskripsi,
          kode_kelas: params.kodeKelas,
          nama_kelas: params.namaKelas,
          guru_username: params.guruUsername,
          nama_guru: params.namaGuru,
          waktu_dibuat: waktu,
          tenggat_waktu: params.tenggatWaktu || null,
          topik: params.topik || null,
          target_kata_min: params.targetKataMin || null,
        };
        const { data, error } = await supabase.from('penugasan').insert(payload).select('id').single();
        if (!error && data) {
          assignedId = String(data.id);
          const local = getLocalDB();
          if (!local.penugasan) local.penugasan = {};
          local.penugasan[assignedId] = {
            id: assignedId,
            ...params,
            waktuDibuat: waktu,
          };
          saveLocalDB(local);
        }
      } catch (e) {
        console.warn('Supabase penugasan insert fallback:', e);
      }
    }

    if (assignedId === id) {
      const local = getLocalDB();
      if (!local.penugasan) local.penugasan = {};
      const item: Penugasan = {
        id,
        ...params,
        waktuDibuat: waktu,
      };
      local.penugasan[id] = item;
      saveLocalDB(local);
    }

    // Auto-create Woro-woro pengumuman tugas baru
    try {
      const namaKelasDisplay = params.namaKelas || params.kodeKelas;
      const infoDeadline = params.tenggatWaktu ? ` (Deadline: ${params.tenggatWaktu})` : '';
      const woroTeks = `[TUGAS:${assignedId}] 📋 Tugas Baru: "${params.judul}" (${namaKelasDisplay})${infoDeadline} — Silakan baca instruksi dan mulai menyusun karyamu!`;
      await this.tambahPengumuman(woroTeks, params.kodeKelas, assignedId);
    } catch (err) {
      console.warn('Gagal broadcast woro-woro penugasan:', err);
    }

    return assignedId;
  },

  async editPenugasan(id: string, params: {
    judul: string;
    deskripsi: string;
    kodeKelas: string;
    namaKelas?: string;
    tenggatWaktu?: string | null;
    topik?: string;
    targetKataMin?: number | null;
  }): Promise<void> {
    const namaKelasDisplay = params.namaKelas || params.kodeKelas;
    const infoDeadline = params.tenggatWaktu ? ` (Deadline: ${params.tenggatWaktu})` : '';
    const updatedWoroTeks = `[TUGAS:${id}] 📋 Tugas: "${params.judul}" (${namaKelasDisplay})${infoDeadline} — Silakan baca instruksi dan mulai menyusun karyamu!`;

    if (isSupabaseConfigured) {
      try {
        const payload: Record<string, unknown> = {
          judul: params.judul,
          deskripsi: params.deskripsi,
          kode_kelas: params.kodeKelas,
          nama_kelas: params.namaKelas,
          tenggat_waktu: params.tenggatWaktu || null,
          topik: params.topik || null,
          target_kata_min: params.targetKataMin || null,
        };
        await supabase.from('penugasan').update(payload).eq('id', id);

        // Update juga teks woro-woro yang terkait jika ada
        try {
          await supabase.from('pengumuman').update({ teks: updatedWoroTeks, kode_kelas: params.kodeKelas }).eq('tugas_id', id);
        } catch {}
        try {
          await supabase.from('pengumuman').update({ teks: updatedWoroTeks, kode_kelas: params.kodeKelas }).ilike('teks', `%${id}%`);
        } catch {}
      } catch (e) {
        console.warn('Supabase penugasan update fallback:', e);
      }
    }

    const local = getLocalDB();
    if (local.penugasan && local.penugasan[id]) {
      local.penugasan[id] = {
        ...local.penugasan[id],
        judul: params.judul,
        deskripsi: params.deskripsi,
        kodeKelas: params.kodeKelas,
        namaKelas: params.namaKelas,
        tenggatWaktu: params.tenggatWaktu || null,
        topik: params.topik,
        targetKataMin: params.targetKataMin || null,
      };
    }
    // Update pengumuman lokal jika ada
    if (local.pengumuman) {
      local.pengumuman.forEach((p) => {
        if (String(p.tugasId || '') === String(id) || p.teks.includes(String(id))) {
          p.teks = `📋 Tugas: "${params.judul}" (${namaKelasDisplay})${infoDeadline} — Silakan baca instruksi dan mulai menyusun karyamu!`;
          p.kodeKelas = params.kodeKelas;
        }
      });
    }
    saveLocalDB(local);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('nulislur_db_change'));
    }
  },

  async hapusPenugasan(id: string): Promise<void> {
    if (isSupabaseConfigured) {
      try {
        await supabase.from('penugasan').delete().eq('id', id);
      } catch (e) {
        console.warn('Gagal hapus penugasan dari Supabase:', e);
      }
      try {
        await supabase.from('pengumuman').delete().eq('tugas_id', id);
      } catch {}
      try {
        await supabase.from('pengumuman').delete().ilike('teks', `%${id}%`);
      } catch {}
    }
    const local = getLocalDB();
    if (local.penugasan && local.penugasan[id]) {
      delete local.penugasan[id];
    }
    local.pengumuman = (local.pengumuman || []).filter(
      (p) => String(p.tugasId || '') !== String(id) && !p.teks.includes(String(id))
    );
    saveLocalDB(local);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('nulislur_db_change'));
    }
  },

  async getDokumen(): Promise<Record<string, Dokumen>> {
    if (isSupabaseConfigured) {
      const { data } = await supabase.from('dokumen').select('*');
      const map: Record<string, Dokumen> = {};
      if (data) {
        data.forEach((row) => {
          const doc = mapDokumenRow(row);
          map[doc.id] = doc;
        });
      }
      return map;
    }
    const local = getLocalDB();
    return { ...local.dokumen };
  },

  async getDokumenById(id: string): Promise<Dokumen | null> {
    if (!id) return null;
    if (isSupabaseConfigured) {
      try {
        const { data } = await supabase.from('dokumen').select('*').eq('id', id).maybeSingle();
        if (data) return mapDokumenRow(data);
      } catch {}
    }
    const local = getLocalDB();
    return local.dokumen?.[id] || null;
  },

  // 8. Unified Real-Time Listeners
  listenDokumen(callback: (docs: Record<string, Dokumen>) => void): () => void {
    if (isSupabaseConfigured) {
      const docCache: Record<string, Dokumen> = {};
      const fetchAll = async () => {
        const { data } = await supabase.from('dokumen').select('*');
        if (data) {
          data.forEach((row) => {
            const doc = mapDokumenRow(row);
            docCache[doc.id] = doc;
          });
          callback({ ...docCache });
        }
      };

      fetchAll();

      const channel = supabase
        .channel('public:dokumen')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'dokumen' }, (p) => {
          if ((p.eventType === 'UPDATE' || p.eventType === 'INSERT') && p.new) {
            const doc = mapDokumenRow(p.new as any);
            docCache[doc.id] = doc;
            callback({ ...docCache });
          } else if (p.eventType === 'DELETE' && p.old) {
            const oldId = (p.old as any).id;
            if (oldId) {
              delete docCache[oldId];
              callback({ ...docCache });
            }
          } else {
            fetchAll();
          }
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }

    // Local
    const update = () => {
      callback(getLocalDB().dokumen);
    };
    update();
    window.addEventListener('nulislur_db_change', update);
    return () => window.removeEventListener('nulislur_db_change', update);
  },

  listenDokumenSingle(docId: string, callback: (doc: Dokumen | null) => void): () => void {
    if (isSupabaseConfigured) {
      const fetchOne = async () => {
        const { data } = await supabase.from('dokumen').select('*').eq('id', docId).single();
        if (data) {
          callback(mapDokumenRow(data));
        } else {
          callback(null);
        }
      };

      fetchOne();

      const channel = supabase
        .channel(`public:dokumen:${docId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'dokumen', filter: `id=eq.${docId}` }, (p) => {
          if ((p.eventType === 'UPDATE' || p.eventType === 'INSERT') && p.new) {
            callback(mapDokumenRow(p.new as any));
          } else if (p.eventType === 'DELETE') {
            callback(null);
          } else {
            fetchOne();
          }
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }

    const update = () => {
      const db = getLocalDB();
      callback(db.dokumen[docId] || null);
    };
    update();
    window.addEventListener('nulislur_db_change', update);
    return () => window.removeEventListener('nulislur_db_change', update);
  },

  listenDokumenSiswa(username: string, callback: (docs: Record<string, Dokumen>) => void): () => void {
    const docCache: Record<string, Dokumen> = {};

    const checkIsCollab = (d: Dokumen): boolean => {
      const byList = Array.isArray(d.kolaborator) && d.kolaborator.some((k) => k.username === username || (k as any) === username);
      const byUsernames = Array.isArray(d.kolaboratorUsernames) && d.kolaboratorUsernames.includes(username);
      return byList || byUsernames;
    };

    // 1. Ambil dari lokal dulu untuk respons instan (< 1ms)
    const local = getLocalDB();
    if (local && local.dokumen) {
      Object.values(local.dokumen).forEach((d) => {
        const isAuthor = d.username ? d.username === username : false;
        const isCollab = checkIsCollab(d);
        if (isAuthor || isCollab || d.isPublic) {
          docCache[d.id] = d;
        }
      });
      callback({ ...docCache });
    }

    if (isSupabaseConfigured) {
      const fetchStudentDocs = async () => {
        try {
          // Ambil dokumen sendiri + mading publik DAN dokumen kolaborasi
          const [ownRes, collabRes, jsonbRes] = await Promise.all([
            supabase
              .from('dokumen')
              .select('*')
              .or(`username.eq.${username},is_public.eq.true`),
            supabase
              .from('dokumen')
              .select('*')
              .eq('is_kolaboratif', true),
            supabase
              .from('dokumen')
              .select('*')
              .contains('kolaborator', JSON.stringify([{ username }])),
          ]);

          const freshServerDocs: Record<string, Dokumen> = {};

          if (!ownRes.error && ownRes.data) {
            ownRes.data.forEach((row) => {
              const doc = mapDokumenRow(row);
              freshServerDocs[doc.id] = doc;
            });
          }

          const processCollabRows = (rows: any[] | null) => {
            if (!rows) return;
            rows.forEach((row) => {
              const doc = mapDokumenRow(row);
              const isCollab = checkIsCollab(doc) || doc.username === username;
              if (isCollab) {
                freshServerDocs[doc.id] = doc;
              }
            });
          };

          if (!collabRes.error && collabRes.data) {
            processCollabRows(collabRes.data);
          }
          if (!jsonbRes.error && jsonbRes.data) {
            processCollabRows(jsonbRes.data);
          }

          // Sinkronkan docCache secara bersih: hapus dokumen yang sudah tidak ada di server
          for (const key of Object.keys(docCache)) {
            delete docCache[key];
          }
          Object.assign(docCache, freshServerDocs);

          // Bersihkan local storage agar naskah yang dihapus tidak menjadi zombie
          try {
            const freshLocal = getLocalDB();
            if (freshLocal?.dokumen) {
              // Hapus dokumen lama milik siswa ini yang sudah dihapus di server
              Object.keys(freshLocal.dokumen).forEach((id) => {
                const d = freshLocal.dokumen[id];
                const isRelevant = d.username === username || checkIsCollab(d);
                if (isRelevant && !freshServerDocs[id]) {
                  delete freshLocal.dokumen[id];
                }
              });
              // Simpan dokumen server yang aktif
              Object.values(freshServerDocs).forEach((d) => {
                freshLocal.dokumen[d.id] = d;
              });
              saveLocalDB(freshLocal);
            }
          } catch {}

          callback({ ...docCache });
        } catch (err) {
          console.warn('Gagal memuat dokumen siswa dari Supabase:', err);
        }
      };

      fetchStudentDocs();

      // Dengarkan perubahan dokumen siswa:
      // 1) Dokumen milik sendiri (username=eq.${username})
      // 2) Dokumen kolaboratif (is_kolaboratif=eq.true)
      const channel = supabase
        .channel(`public:dokumen:${username}:${Date.now()}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'dokumen', filter: `username=eq.${username}` },
          (p) => {
            if ((p.eventType === 'UPDATE' || p.eventType === 'INSERT') && p.new) {
              const doc = mapDokumenRow(p.new as any);
              docCache[doc.id] = doc;
              try {
                const freshLocal = getLocalDB();
                if (freshLocal?.dokumen) {
                  freshLocal.dokumen[doc.id] = doc;
                  saveLocalDB(freshLocal);
                }
              } catch {}
              callback({ ...docCache });
            } else if (p.eventType === 'DELETE' && p.old) {
              const oldId = (p.old as any).id;
              if (oldId) {
                delete docCache[oldId];
                try {
                  const freshLocal = getLocalDB();
                  if (freshLocal?.dokumen && freshLocal.dokumen[oldId]) {
                    delete freshLocal.dokumen[oldId];
                    saveLocalDB(freshLocal);
                  }
                } catch {}
                callback({ ...docCache });
              }
            }
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'dokumen', filter: 'is_kolaboratif=eq.true' },
          (p) => {
            if ((p.eventType === 'UPDATE' || p.eventType === 'INSERT') && p.new) {
              const doc = mapDokumenRow(p.new as any);
              const isCollab = checkIsCollab(doc) || doc.username === username;
              if (isCollab) {
                docCache[doc.id] = doc;
                try {
                  const freshLocal = getLocalDB();
                  if (freshLocal?.dokumen) {
                    freshLocal.dokumen[doc.id] = doc;
                    saveLocalDB(freshLocal);
                  }
                } catch {}
                callback({ ...docCache });
              } else if (docCache[doc.id] && doc.username !== username) {
                // Siswa dikeluarkan dari tim kolaborasi naskah
                delete docCache[doc.id];
                try {
                  const freshLocal = getLocalDB();
                  if (freshLocal?.dokumen && freshLocal.dokumen[doc.id]) {
                    delete freshLocal.dokumen[doc.id];
                    saveLocalDB(freshLocal);
                  }
                } catch {}
                callback({ ...docCache });
              }
            } else if (p.eventType === 'DELETE' && p.old) {
              const oldId = (p.old as any).id;
              if (oldId && docCache[oldId]) {
                delete docCache[oldId];
                try {
                  const freshLocal = getLocalDB();
                  if (freshLocal?.dokumen && freshLocal.dokumen[oldId]) {
                    delete freshLocal.dokumen[oldId];
                    saveLocalDB(freshLocal);
                  }
                } catch {}
                callback({ ...docCache });
              }
            }
          }
        )
        .subscribe();

      const updateLocal = () => {
        const freshLocal = getLocalDB();
        if (freshLocal && freshLocal.dokumen) {
          Object.values(freshLocal.dokumen).forEach((d) => {
            const isAuthor = d.username ? d.username === username : false;
            const isCollab = checkIsCollab(d);
            if (isAuthor || isCollab || d.isPublic) {
              docCache[d.id] = d;
            }
          });
          callback({ ...docCache });
        }
      };
      window.addEventListener('nulislur_db_change', updateLocal);

      return () => {
        supabase.removeChannel(channel);
        window.removeEventListener('nulislur_db_change', updateLocal);
      };
    }

    // Fallback local
    const update = () => {
      const freshLocal = getLocalDB();
      const studentDocs: Record<string, Dokumen> = {};
      if (freshLocal && freshLocal.dokumen) {
        Object.values(freshLocal.dokumen).forEach((d) => {
          const isAuthor = d.username ? d.username === username : false;
          const isCollab = checkIsCollab(d);
          if (isAuthor || isCollab || d.isPublic) {
            studentDocs[d.id] = d;
          }
        });
      }
      callback(studentDocs);
    };

    window.addEventListener('nulislur_db_change', update);
    return () => window.removeEventListener('nulislur_db_change', update);
  },

  listenKelas(callback: (rooms: KelasRoom[]) => void): () => void {
    if (isSupabaseConfigured) {
      const fetchAll = async () => {
        const { data } = await supabase.from('kelas').select('*');
        if (data) {
          const kelasMap = await this.getKelasSekolahMap();
          const rooms: KelasRoom[] = data.map((r) => {
            const mapped = kelasMap[r.kode_kelas];
            return {
              id: r.id,
              kodeKelas: r.kode_kelas,
              namaKelas: r.nama_kelas,
              guruUsername: r.guru_username,
              namaGuru: r.nama_guru,
              sekolahId: mapped?.sekolahId || (r as any).sekolah_id || undefined,
              namaSekolah: mapped?.namaSekolah || (r as any).nama_sekolah || undefined,
              waktuDibuat: r.created_at,
              maxPeserta: r.max_peserta ? Number(r.max_peserta) : undefined
            };
          });
          callback(rooms);
        }
      };

      fetchAll();

      const channel = supabase
        .channel('public:kelas')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'kelas' }, () => {
          fetchAll();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }

    const update = async () => {
      const kelasMap = await this.getKelasSekolahMap();
      const all = Object.values(getLocalDB().kelas).map((k) => {
        const mapped = kelasMap[k.kodeKelas];
        return {
          ...k,
          sekolahId: mapped?.sekolahId || k.sekolahId || undefined,
          namaSekolah: mapped?.namaSekolah || k.namaSekolah || undefined,
        };
      });
      callback(all);
    };
    update();
    window.addEventListener('nulislur_db_change', update);
    return () => window.removeEventListener('nulislur_db_change', update);
  },

  listenUsers(callback: (users: UserAccount[]) => void): () => void {
    if (isSupabaseConfigured) {
      const fetchAll = async () => {
        const { data } = await supabase.from('users').select('*').eq('role', 'siswa');
        if (data) {
          const kelasMap = await this.getKelasSekolahMap();
          const list: UserAccount[] = data.map((u) => {
            const mappedSekolah = u.kode_kelas ? kelasMap[u.kode_kelas] : undefined;
            return {
              username: u.username,
              nama: u.nama,
              role: u.role,
              kodeKelas: u.kode_kelas,
              namaKelas: u.nama_kelas,
              sekolahId: (u as any).sekolah_id || mappedSekolah?.sekolahId || undefined,
              namaSekolah: (u as any).nama_sekolah || mappedSekolah?.namaSekolah || undefined,
              waktuDaftar: u.created_at
            };
          });
          callback(list);
        }
      };

      fetchAll();

      const channel = supabase
        .channel('public:users')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => {
          fetchAll();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }

    const update = async () => {
      const kelasMap = await this.getKelasSekolahMap();
      const all = Object.values(getLocalDB().users)
        .filter((u) => u.role === 'siswa')
        .map((u) => {
          const mappedSekolah = u.kodeKelas ? kelasMap[u.kodeKelas] : undefined;
          return {
            ...u,
            sekolahId: u.sekolahId || mappedSekolah?.sekolahId || undefined,
            namaSekolah: u.namaSekolah || mappedSekolah?.namaSekolah || undefined,
          };
        });
      callback(all);
    };
    update();
    window.addEventListener('nulislur_db_change', update);
    return () => window.removeEventListener('nulislur_db_change', update);
  },

  listenLive(
    callback: (live: Record<string, LiveStatus>) => void,
    onPelanggaranNotify?: (data: { username: string; nama: string; docId?: string }) => void
  ): () => void {
    const liveMapCache: Record<string, LiveStatus> = {};
    let lastNotifiedTime = 0;
    let lastNotifiedUser = '';

    const handlePelanggaranEvent = (payload: any) => {
      if (!payload || !payload.username) return;
      const u = payload.username;
      const now = Date.now();
      const isDuplicate = lastNotifiedUser === u && now - lastNotifiedTime < 1500;

      if (liveMapCache[u]) {
        liveMapCache[u].sedangKeluarTab = true;
        if (!isDuplicate) {
          liveMapCache[u].pelanggaranCount = (liveMapCache[u].pelanggaranCount || 0) + 1;
        }
      } else {
        liveMapCache[u] = {
          isOnline: true,
          aktivitas: 'Sedang Menulis',
          docAktifId: payload.docId,
          sedangKeluarTab: true,
          sessionId: 'live',
          kodeKelas: 'Umum',
          pelanggaranCount: 1
        };
      }
      callback({ ...liveMapCache });

      if (!isDuplicate) {
        lastNotifiedUser = u;
        lastNotifiedTime = now;
        onPelanggaranNotify?.(payload);
      }
    };

    const handlePulihkanFokusEvent = (payload: any) => {
      if (!payload || !payload.username) return;
      const u = payload.username;
      if (liveMapCache[u]) {
        liveMapCache[u].sedangKeluarTab = false;
        callback({ ...liveMapCache });
      }
    };

    const handleResetPelanggaranEvent = () => {
      Object.keys(liveMapCache).forEach((u) => {
        liveMapCache[u].sedangKeluarTab = false;
        liveMapCache[u].pelanggaranCount = 0;
      });
      callback({ ...liveMapCache });
    };

    const handleStatusUpdateEvent = (payload: any) => {
      if (!payload || !payload.username) return;
      const u = payload.username;
      if (liveMapCache[u]) {
        if (payload.aktivitas !== undefined) liveMapCache[u].aktivitas = payload.aktivitas;
        if (payload.isOnline !== undefined) liveMapCache[u].isOnline = payload.isOnline;
        if (payload.sedangKeluarTab !== undefined) liveMapCache[u].sedangKeluarTab = payload.sedangKeluarTab;
        if (payload.docAktifId !== undefined) liveMapCache[u].docAktifId = payload.docAktifId;
        if (payload.kodeKelas !== undefined) liveMapCache[u].kodeKelas = payload.kodeKelas;
      } else {
        liveMapCache[u] = {
          isOnline: payload.isOnline ?? true,
          aktivitas: payload.aktivitas || 'Aktif',
          docAktifId: payload.docAktifId,
          sedangKeluarTab: payload.sedangKeluarTab ?? false,
          sessionId: payload.sessionId || 'live',
          kodeKelas: payload.kodeKelas || 'Umum',
          pelanggaranCount: payload.pelanggaranCount || 0
        };
      }
      callback({ ...liveMapCache });
    };

    // 1. Tangkap Broadcast Lokal Antartab Browser (Kecepatan 0ms)
    const localHandler = (e: MessageEvent) => {
      if (e.data?.event === 'pelanggaran') {
        handlePelanggaranEvent(e.data.payload);
      } else if (e.data?.event === 'pulihkan_fokus') {
        handlePulihkanFokusEvent(e.data.payload);
      } else if (e.data?.event === 'reset_pelanggaran') {
        handleResetPelanggaranEvent();
      } else if (e.data?.event === 'status_update') {
        handleStatusUpdateEvent(e.data.payload);
      }
    };
    localLiveBroadcast?.addEventListener('message', localHandler);

    // 2. Tangkap Broadcast Instan Antarperangkat via Supabase WebSocket (<30ms)
    const liveBroadcastListener: LiveBroadcastListener = (event, payload) => {
      if (event === 'pelanggaran') {
        handlePelanggaranEvent(payload);
      } else if (event === 'pulihkan_fokus') {
        handlePulihkanFokusEvent(payload);
      } else if (event === 'reset_pelanggaran') {
        handleResetPelanggaranEvent();
      } else if (event === 'status_update') {
        handleStatusUpdateEvent(payload);
      }
    };
    liveBroadcastListeners.add(liveBroadcastListener);

    if (isSupabaseConfigured) {
      const fetchInitial = async () => {
        const { data } = await supabase.from('kehadiran_live').select('*');
        if (data) {
          data.forEach((r) => {
            const updatedAtMs = r.updated_at ? new Date(r.updated_at).getTime() : 0;
            // Anggap online jika is_online true dan update terbaru < 120 detik lalu (atau jika updated_at kosong)
            const isFresh = updatedAtMs > 0 ? (Date.now() - updatedAtMs < 120000) : true;
            const online = Boolean(r.is_online) && isFresh;
            liveMapCache[r.username] = {
              isOnline: online,
              aktivitas: online ? (r.aktivitas || 'Beranda') : 'Offline',
              docAktifId: r.doc_aktif_id,
              sedangKeluarTab: Boolean(r.sedang_keluar_tab),
              sessionId: r.session_id,
              kodeKelas: r.kode_kelas,
              pelanggaranCount: Number(r.pelanggaran_count || 0)
            };
          });
          callback({ ...liveMapCache });
        }
      };

      fetchInitial();

      // Refresh data hanya saat jendela browser kembali aktif (fokus), tanpa polling terus-menerus
      const handleWindowFocus = () => {
        fetchInitial();
      };
      if (typeof window !== 'undefined') {
        window.addEventListener('focus', handleWindowFocus);
      }

      // Dengarkan pembaruan database PostgreSQL secara reaktif lewat Realtime WebSocket (hemat egress 99%)
      const dbChannel = supabase
        .channel('public:kehadiran_live_db')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'kehadiran_live' }, (p) => {
          if (p.eventType === 'INSERT' || p.eventType === 'UPDATE') {
            const r = p.new as any;
            if (r && r.username) {
              const updatedAtMs = r.updated_at ? new Date(r.updated_at).getTime() : 0;
              const isFresh = updatedAtMs > 0 ? (Date.now() - updatedAtMs < 120000) : true;
              const online = Boolean(r.is_online) && isFresh;
              liveMapCache[r.username] = {
                isOnline: online,
                aktivitas: online ? (r.aktivitas || 'Beranda') : 'Offline',
                docAktifId: r.doc_aktif_id,
                sedangKeluarTab: Boolean(r.sedang_keluar_tab),
                sessionId: r.session_id,
                kodeKelas: r.kode_kelas,
                pelanggaranCount: Number(r.pelanggaran_count || 0)
              };
              callback({ ...liveMapCache });
            }
          } else if (p.eventType === 'DELETE') {
            const old = p.old as any;
            if (old?.username) {
              delete liveMapCache[old.username];
              callback({ ...liveMapCache });
            }
          }
        })
        .subscribe();

      return () => {
        if (typeof window !== 'undefined') {
          window.removeEventListener('focus', handleWindowFocus);
        }
        liveBroadcastListeners.delete(liveBroadcastListener);
        localLiveBroadcast?.removeEventListener('message', localHandler);
        supabase.removeChannel(dbChannel);
      };
    }

    const update = () => {
      const raw = getLocalDB().live;
      const map: Record<string, LiveStatus> = {};
      Object.keys(raw).forEach((k) => {
        const item = raw[k];
        const isFresh = item.updatedAt ? (Date.now() - item.updatedAt < 35000) : true;
        const online = Boolean(item.isOnline) && isFresh;
        map[k] = {
          isOnline: online,
          aktivitas: online ? (item.aktivitas || 'Beranda') : 'Offline',
          docAktifId: item.docAktifId,
          sedangKeluarTab: item.sedangKeluarTab,
          sessionId: item.sessionId,
          kodeKelas: item.kodeKelas,
          pelanggaranCount: item.pelanggaranCount || 0
        };
      });
      callback(map);
    };
    update();
    const handleNotify = (e: any) => {
      handlePelanggaranEvent(e.detail);
    };
    window.addEventListener('nulislur_db_change', update);
    window.addEventListener('nulislur_pelanggaran_notify', handleNotify);
    return () => {
      liveBroadcastListeners.delete(liveBroadcastListener);
      localLiveBroadcast?.removeEventListener('message', localHandler);
      window.removeEventListener('nulislur_db_change', update);
      window.removeEventListener('nulislur_pelanggaran_notify', handleNotify);
    };
  },

  listenPengumuman(callback: (items: Pengumuman[]) => void): () => void {
    const parsePengumumanItem = (item: any): Pengumuman => {
      let tugasId = item.tugas_id || item.tugasId || null;
      let teks = String(item.teks || '');
      const tagMatch = teks.match(/^\[TUGAS:([^\]]+)\]\s*(.*)$/);
      if (tagMatch) {
        if (!tugasId) tugasId = tagMatch[1];
        teks = tagMatch[2];
      }
      return {
        id: String(item.id),
        teks,
        waktu: String(item.waktu || ''),
        kodeKelas: item.kode_kelas || item.kodeKelas,
        tugasId,
        sekolahId: item.sekolah_id || item.sekolahId || undefined
      };
    };

    // Langsung berikan data lokal saat ini (< 1ms)
    const initialLocal = getLocalDB();
    callback((initialLocal.pengumuman || []).map(parsePengumumanItem));

    if (isSupabaseConfigured) {
      const fetchAll = async () => {
        try {
          let res = await supabase.from('pengumuman').select('*').order('created_at', { ascending: false });
          if (res.error && res.error.message && res.error.message.includes('created_at')) {
            res = await supabase.from('pengumuman').select('*');
          }
          if (!res.error && res.data) {
            const mapped = res.data.map(parsePengumumanItem);
            const currentLocal = getLocalDB();
            currentLocal.pengumuman = mapped;
            saveLocalDB(currentLocal);
            callback(mapped);
          }
        } catch (err) {
          console.warn('Fetch pengumuman Supabase error:', err);
        }
      };

      fetchAll();

      const channel = supabase
        .channel('public:pengumuman')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'pengumuman' }, () => {
          fetchAll();
        })
        .subscribe();

      const updateLocal = () => {
        const curr = getLocalDB();
        if (curr.pengumuman && curr.pengumuman.length > 0) {
          callback(curr.pengumuman.map(parsePengumumanItem));
        }
      };
      window.addEventListener('nulislur_db_change', updateLocal);

      return () => {
        supabase.removeChannel(channel);
        window.removeEventListener('nulislur_db_change', updateLocal);
      };
    }

    const update = () => {
      callback((getLocalDB().pengumuman || []).map(parsePengumumanItem));
    };
    update();
    window.addEventListener('nulislur_db_change', update);
    return () => window.removeEventListener('nulislur_db_change', update);
  },

  listenPenugasan(callback: (items: Penugasan[]) => void, kodeKelas?: string): () => void {
    const getLocalList = () => {
      const local = getLocalDB();
      const list = Object.values(local.penugasan || {});
      return (!kodeKelas || kodeKelas === 'semua')
        ? list
        : list.filter((p) => p.kodeKelas === kodeKelas);
    };

    if (isSupabaseConfigured) {
      let hasFetchedFromSupabase = false;

      const fetchAll = async () => {
        try {
          let query = supabase.from('penugasan').select('*').order('created_at', { ascending: false });
          if (kodeKelas && kodeKelas !== 'semua') {
            query = query.eq('kode_kelas', kodeKelas);
          }
          const { data, error } = await query;
          if (!error && data) {
            const mapped: Penugasan[] = data.map((row: any) => ({
              id: String(row.id),
              judul: row.judul || '',
              deskripsi: row.deskripsi || '',
              kodeKelas: row.kode_kelas || '',
              namaKelas: row.nama_kelas || undefined,
              guruUsername: row.guru_username || '',
              namaGuru: row.nama_guru || '',
              waktuDibuat: row.waktu_dibuat || row.created_at || '',
              tenggatWaktu: row.tenggat_waktu || null,
              topik: row.topik || undefined,
              targetKataMin: row.target_kata_min ? Number(row.target_kata_min) : null,
            }));

            // Sync cache localDB agar sinkron dan tidak kosong saat event local db_change terpicu
            try {
              const local = getLocalDB();
              const penugasanCache: Record<string, Penugasan> = (!kodeKelas || kodeKelas === 'semua') ? {} : (local.penugasan || {});
              mapped.forEach((p) => {
                penugasanCache[p.id] = p;
              });
              local.penugasan = penugasanCache;
              saveLocalDB(local);
            } catch {}

            hasFetchedFromSupabase = true;
            callback(mapped);
            return;
          }
        } catch (err) {
          console.warn('Fetch penugasan Supabase error:', err);
        }

        // Fallback ke local hanya jika fetch Supabase gagal
        callback(getLocalList());
      };

      // Tampilkan cache lokal awal jika ada, lalu fetch data terbaru dari Supabase
      const initialLocal = getLocalList();
      if (initialLocal.length > 0) {
        callback(initialLocal);
      }
      fetchAll();

      const channel = supabase
        .channel('public:penugasan')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'penugasan' }, () => {
          fetchAll();
        })
        .subscribe();

      const updateLocal = () => {
        const list = getLocalList();
        if (hasFetchedFromSupabase || list.length > 0) {
          callback(list);
        }
      };
      window.addEventListener('nulislur_db_change', updateLocal);

      return () => {
        supabase.removeChannel(channel);
        window.removeEventListener('nulislur_db_change', updateLocal);
      };
    }

    const update = () => {
      callback(getLocalList());
    };
    update();
    window.addEventListener('nulislur_db_change', update);
    return () => window.removeEventListener('nulislur_db_change', update);
  },

  listenKomentar(docId: string, callback: (komentar: { id: string; nama: string; username: string; teks: string; waktu: string }[]) => void): () => void {
    // 1. Tampilkan komentar lokal seketika (< 1ms)
    const getLocalList = () => getLocalDB().komentar[docId] || [];
    callback(getLocalList());

    const handleLocalUpdate = (e?: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent && customEvent.detail && customEvent.detail.docId && customEvent.detail.docId !== docId) {
        return;
      }
      callback(getLocalList());
    };

    window.addEventListener('nulislur_komentar_change', handleLocalUpdate);
    window.addEventListener('nulislur_db_change', handleLocalUpdate);
    window.addEventListener('storage', handleLocalUpdate);

    let supabaseCleanup = () => {};

    // 2. Sinkronkan dengan Supabase secara real-time di latar belakang
    if (isSupabaseConfigured) {
      const fetchAll = async () => {
        try {
          const { data } = await supabase.from('komentar').select('*').eq('doc_id', docId).order('created_at', { ascending: true });
          if (data && Array.isArray(data)) {
            const formatted = data.map((k) => ({
              id: String(k.id),
              nama: k.nama,
              username: k.username,
              teks: k.teks,
              waktu: k.waktu,
            }));

            // Gabungkan komentar lokal dan remote tanpa duplikasi
            const local = getLocalDB();
            const existing = local.komentar[docId] || [];
            const mergedMap = new Map<string, { id: string; nama: string; username: string; teks: string; waktu: string }>();

            existing.forEach((item) => mergedMap.set(item.id, item));
            formatted.forEach((item) => mergedMap.set(item.id, item));

            const merged = Array.from(mergedMap.values());
            local.komentar[docId] = merged;
            saveLocalDB(local);
            callback(merged);
          }
        } catch {}
      };

      fetchAll();

      try {
        const channel = supabase
          .channel(`public:komentar:${docId}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'komentar', filter: `doc_id=eq.${docId}` }, () => {
            fetchAll();
          })
          .subscribe();

        supabaseCleanup = () => {
          supabase.removeChannel(channel);
        };
      } catch {}
    }

    return () => {
      supabaseCleanup();
      window.removeEventListener('nulislur_komentar_change', handleLocalUpdate);
      window.removeEventListener('nulislur_db_change', handleLocalUpdate);
      window.removeEventListener('storage', handleLocalUpdate);
    };
  },

  listenLikes(docId: string, username: string, callback: (likesCount: number, isLikedByMe: boolean) => void): () => void {
    // 1. Tampilkan status suka lokal seketika (< 1ms)
    const getLocalLikes = () => {
      const raw = getLocalDB().likes[docId] || {};
      const count = Object.keys(raw).length;
      return { count, isLiked: !!raw[username] };
    };

    const initial = getLocalLikes();
    callback(initial.count, initial.isLiked);

    const handleLocalUpdate = (e?: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent && customEvent.detail && customEvent.detail.docId && customEvent.detail.docId !== docId) {
        return;
      }
      const fresh = getLocalLikes();
      callback(fresh.count, fresh.isLiked);
    };

    window.addEventListener('nulislur_likes_change', handleLocalUpdate);
    window.addEventListener('nulislur_db_change', handleLocalUpdate);
    window.addEventListener('storage', handleLocalUpdate);

    let supabaseCleanup = () => {};

    // 2. Sinkronkan dengan Supabase di latar belakang
    if (isSupabaseConfigured) {
      const fetchLikes = async () => {
        try {
          const { data } = await supabase.from('likes').select('username').eq('doc_id', docId);
          if (data && Array.isArray(data)) {
            const count = data.length;
            const isLiked = data.some((l) => l.username === username);

            const local = getLocalDB();
            if (!local.likes[docId]) local.likes[docId] = {};
            data.forEach((l) => {
              local.likes[docId][l.username] = true;
            });
            saveLocalDB(local);

            callback(count, isLiked);
          }
        } catch {}
      };

      fetchLikes();

      try {
        const channel = supabase
          .channel(`public:likes:${docId}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'likes', filter: `doc_id=eq.${docId}` }, () => {
            fetchLikes();
          })
          .subscribe();

        supabaseCleanup = () => {
          supabase.removeChannel(channel);
        };
      } catch {}
    }

    return () => {
      supabaseCleanup();
      window.removeEventListener('nulislur_likes_change', handleLocalUpdate);
      window.removeEventListener('nulislur_db_change', handleLocalUpdate);
      window.removeEventListener('storage', handleLocalUpdate);
    };
  },

  listenViews(docId: string, callback: (viewsCount: number) => void): () => void {
    const getCount = () => {
      try {
        const viewsMap = JSON.parse(localStorage.getItem('nulislur_views_map') || '{}');
        const local = getLocalDB();
        return Math.max(viewsMap[docId] || 0, local.dokumen[docId]?.views || 0, local.views?.[docId] || 0);
      } catch {
        return 0;
      }
    };

    callback(getCount());

    const handleLocalUpdate = (e?: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent && customEvent.detail && customEvent.detail.docId && customEvent.detail.docId !== docId) {
        return;
      }
      callback(getCount());
    };

    window.addEventListener('nulislur_views_change', handleLocalUpdate);
    window.addEventListener('storage', handleLocalUpdate);
    window.addEventListener('nulislur_db_change', handleLocalUpdate);

    let supabaseCleanup = () => {};

    if (isSupabaseConfigured) {
      const fetchViews = async () => {
        try {
          const { data, error } = await supabase.from('dokumen').select('views').eq('id', docId).maybeSingle();
          if (!error && data && 'views' in data) {
            const remoteViews = Number(data.views || 0);
            const currentLocal = getCount();
            const highest = Math.max(remoteViews, currentLocal);
            callback(highest);
          }
        } catch {}
      };
      fetchViews();

      try {
        const channel = supabase
          .channel(`public:views:${docId}`)
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'dokumen', filter: `id=eq.${docId}` }, (payload) => {
            if (payload.new && 'views' in payload.new) {
              const remoteViews = Number(payload.new.views || 0);
              const currentLocal = getCount();
              callback(Math.max(remoteViews, currentLocal));
            }
          })
          .subscribe();

        supabaseCleanup = () => {
          supabase.removeChannel(channel);
        };
      } catch {}
    }

    return () => {
      supabaseCleanup();
      window.removeEventListener('nulislur_views_change', handleLocalUpdate);
      window.removeEventListener('storage', handleLocalUpdate);
      window.removeEventListener('nulislur_db_change', handleLocalUpdate);
    };
  },

  async hapusPengumuman(id: string) {
    if (isSupabaseConfigured) {
      try {
        await supabase.from('pengumuman').delete().eq('id', id);
      } catch (e) {
        console.warn('Gagal hapus pengumuman Supabase:', e);
      }
    }

    const local = getLocalDB();
    local.pengumuman = (local.pengumuman || []).filter((p) => p.id !== id);
    saveLocalDB(local);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('nulislur_db_change'));
    }
  },

  // 11b. Kutipan Sastra Harian (Quotes Inspiratif)
  getQuote(): { teks: string; penulis: string } {
    try {
      const saved = localStorage.getItem('nulislur_quote_sastra');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.teks) return parsed;
      }
    } catch {}
    return {
      teks: 'Orang boleh pandai setinggi langit, tapi selama ia tidak menulis, ia akan hilang di dalam masyarakat dan dari sejarah. Menulis adalah bekerja untuk keabadian.',
      penulis: 'Pramoedya Ananta Toer'
    };
  },

  async simpanQuote(teks: string, penulis: string): Promise<void> {
    const quote = {
      teks: teks.trim() || 'Menulis adalah bekerja untuk keabadian.',
      penulis: penulis.trim() || 'Pramoedya Ananta Toer',
      waktu: getWaktuSekarang()
    };

    try {
      localStorage.setItem('nulislur_quote_sastra', JSON.stringify(quote));
      window.dispatchEvent(new CustomEvent('nulislur_quote_change', { detail: quote }));
    } catch {}

    if (isSupabaseConfigured) {
      try {
        await supabase
          .from('pengaturan')
          .upsert({ key: 'quote_sastra', val: JSON.stringify(quote) }, { onConflict: 'key' });
      } catch (err) {
        console.warn('Gagal simpan quote ke Supabase:', err);
      }
    }
  },

  listenQuote(callback: (quote: { teks: string; penulis: string }) => void): () => void {
    callback(this.getQuote());

    const handleUpdate = (e?: Event) => {
      const custom = e as CustomEvent;
      if (custom && custom.detail) {
        callback(custom.detail);
      } else {
        callback(this.getQuote());
      }
    };

    window.addEventListener('nulislur_quote_change', handleUpdate);
    window.addEventListener('storage', handleUpdate);

    let supabaseCleanup = () => {};

    if (isSupabaseConfigured) {
      const fetchRemote = async () => {
        try {
          const { data, error } = await supabase
            .from('pengaturan')
            .select('val')
            .eq('key', 'quote_sastra')
            .maybeSingle();

          if (!error && data && data.val) {
            const parsed = typeof data.val === 'string' ? JSON.parse(data.val) : data.val;
            if (parsed && parsed.teks) {
              localStorage.setItem('nulislur_quote_sastra', JSON.stringify(parsed));
              callback(parsed);
            }
          }
        } catch {}
      };

      fetchRemote();

      try {
        const channel = supabase
          .channel('public:pengaturan:quote_sastra')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'pengaturan', filter: 'key=eq.quote_sastra' },
            (payload) => {
              if (payload.new && 'val' in payload.new) {
                const val = payload.new.val;
                const parsed = typeof val === 'string' ? JSON.parse(val) : val;
                if (parsed && parsed.teks) {
                  localStorage.setItem('nulislur_quote_sastra', JSON.stringify(parsed));
                  callback(parsed);
                }
              }
            }
          )
          .subscribe();

        supabaseCleanup = () => {
          supabase.removeChannel(channel);
        };
      } catch {}
    }

    return () => {
      supabaseCleanup();
      window.removeEventListener('nulislur_quote_change', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  },

  // 12. Migrasi & Sistem Kode Redeem
  async getDaftarKodeRedeem(): Promise<MigrasiRedeemItem[]> {
    const now = Date.now();
    if (cachedRedeemList && now - lastRedeemListFetchTime < 15000) {
      return cachedRedeemList;
    }

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('pengaturan')
          .select('val')
          .eq('key', 'migrasi_redeem_list')
          .maybeSingle();

        if (!error && data && data.val) {
          const parsed = typeof data.val === 'string' ? JSON.parse(data.val) : data.val;
          if (Array.isArray(parsed) && parsed.length > 0) {
            const local = getLocalDB();
            local.redeemList = parsed;
            saveLocalDB(local);
            cachedRedeemList = parsed;
            lastRedeemListFetchTime = now;
            return parsed;
          }
        }
      } catch (err) {
        console.warn('Gagal memuat daftar redeem dari Supabase:', err);
      }
    }

    const local = getLocalDB();
    if (!local.redeemList || local.redeemList.length === 0) {
      local.redeemList = initialMigrasiRedeemData;
      saveLocalDB(local);
    }
    cachedRedeemList = local.redeemList;
    lastRedeemListFetchTime = now;
    return local.redeemList;
  },

  async getStatusRedeemSiswa(username: string): Promise<MigrasiRedeemItem | null> {
    if (!username) return null;
    const list = await this.getDaftarKodeRedeem();
    const found = list.find((item) => Boolean(item.isRedeemed && item.redeemedByUsername === username));
    return found || null;
  },

  async klaimKodeRedeem(
    kodeInput: string,
    targetUser: { username: string; nama: string; kodeKelas?: string; namaKelas?: string }
  ): Promise<{ success: boolean; message: string; naskahList?: Dokumen[] }> {
    const cleanCode = kodeInput.trim().toUpperCase();
    if (!cleanCode) {
      return { success: false, message: 'Harap masukkan kode klaim/redeem.' };
    }

    const list = await this.getDaftarKodeRedeem();

    // Cek apakah akun siswa ini sudah pernah mengklaim karya lama kode lain
    const existingClaim = list.find(
      (r) => r.isRedeemed && r.redeemedByUsername === targetUser.username
    );

    if (existingClaim && existingClaim.kodeRedeem.trim().toUpperCase() !== cleanCode) {
      return {
        success: false,
        message: `Kamu sudah pernah mengklaim karya lama (${existingClaim.originalNama} - Kode: ${existingClaim.kodeRedeem}). Setiap akun hanya dapat mengklaim 1 paket arsip. Jika ada kekeliruan, mintalah gurumu untuk membatalkan klaim tersebut di Dashboard Guru agar kamu bisa mengklaim lagi.`
      };
    }

    const itemIndex = list.findIndex(
      (item) => item.kodeRedeem.trim().toUpperCase() === cleanCode
    );

    if (itemIndex === -1) {
      return {
        success: false,
        message: `Kode "${cleanCode}" tidak ditemukan. Pastikan huruf dan format kode sudah sesuai.`
      };
    }

    const item = { ...list[itemIndex] };

    // Cek apakah sudah pernah diklaim
    if (item.isRedeemed) {
      if (item.redeemedByUsername === targetUser.username) {
        let userDocs: Dokumen[] = [];
        if (isSupabaseConfigured) {
          const { data } = await supabase.from('dokumen').select('*').in('id', item.docIds);
          if (data) userDocs = data.map(mapDokumenRow);
        }
        if (userDocs.length === 0) {
          const local = getLocalDB();
          userDocs = item.docIds.map((id) => local.dokumen[id]).filter(Boolean);
        }
        return {
          success: true,
          message: `Kamu sudah pernah mengklaim karya ini sebelumnya (${userDocs.length} karya aktif).`,
          naskahList: userDocs
        };
      }

      return {
        success: false,
        message: `Kode "${cleanCode}" sudah pernah diklaim pada ${item.redeemedAt || 'sebelumnya'}. Jika kamu adalah pemilik asli naskah ini (${item.originalNama}), mintalah gurumu untuk mereset kodenya di Dashboard Guru.`
      };
    }

    const docIds = item.docIds || item.naskahList.map((n) => n.id);
    const waktuKlaim = getWaktuSekarang();

    // 1. Update dokumen di Supabase jika aktif (langsung select('*') dalam 1 pemanggilan roundtrip)
    let claimedDocs: Dokumen[] = [];
    if (isSupabaseConfigured) {
      try {
        const updatePayload: Record<string, unknown> = {
          username: targetUser.username,
          nama: targetUser.nama,
          waktu_edit: waktuKlaim
        };
        if (targetUser.kodeKelas) updatePayload.kode_kelas = targetUser.kodeKelas;

        const { data: updatedData, error: updateErr } = await supabase
          .from('dokumen')
          .update(updatePayload)
          .in('id', docIds)
          .select('*');

        if (updateErr) {
          console.error('Gagal update dokumen di Supabase saat redeem:', updateErr);
          return { success: false, message: `Gagal menghubungkan dokumen di database: ${updateErr.message}` };
        }

        if (updatedData && Array.isArray(updatedData)) {
          claimedDocs = updatedData.map(mapDokumenRow);
        }
      } catch (err: unknown) {
        return {
          success: false,
          message: err instanceof Error ? err.message : 'Terjadi gangguan saat menghubungkan dokumen.'
        };
      }
    }

    // 2. Update dokumen di LocalDB
    const local = getLocalDB();
    docIds.forEach((id) => {
      if (local.dokumen[id]) {
        local.dokumen[id].username = targetUser.username;
        local.dokumen[id].nama = targetUser.nama;
        if (targetUser.kodeKelas) local.dokumen[id].kodeKelas = targetUser.kodeKelas;
        if (targetUser.namaKelas) local.dokumen[id].namaKelas = targetUser.namaKelas;
        local.dokumen[id].waktuEdit = waktuKlaim;
      }
    });

    // 3. Update status tiket di memori & cache lokal
    item.isRedeemed = true;
    item.redeemedByUsername = targetUser.username;
    item.redeemedByNama = targetUser.nama;
    item.redeemedKodeKelas = targetUser.kodeKelas;
    item.redeemedAt = waktuKlaim;
    list[itemIndex] = item;
    local.redeemList = list;
    saveLocalDB(local);

    cachedRedeemList = list;
    lastRedeemListFetchTime = Date.now();

    // 4. Catat klaim di Supabase (Gunakan kunci terpisah per kode agar tidak terjadi lock contention saat 20 siswa klaim bareng)
    if (isSupabaseConfigured) {
      try {
        await supabase.from('pengaturan').upsert({
          key: `redeem_claim_${cleanCode}`,
          val: JSON.stringify({
            kodeRedeem: cleanCode,
            redeemedByUsername: targetUser.username,
            redeemedByNama: targetUser.nama,
            redeemedKodeKelas: targetUser.kodeKelas,
            redeemedAt: waktuKlaim,
            docIds
          })
        }, { onConflict: 'key' });

        // Sinkronkan daftar utama secara asinkron tanpa memblokir respon siswa
        Promise.resolve(
          supabase.from('pengaturan').upsert({
            key: 'migrasi_redeem_list',
            val: JSON.stringify(list)
          }, { onConflict: 'key' })
        ).catch(() => {});
      } catch (err) {
        console.warn('Gagal mencatat klaim ke Supabase:', err);
      }
    }

    if (claimedDocs.length === 0) {
      claimedDocs = docIds.map((id) => local.dokumen[id]).filter(Boolean);
    }

    // Trigger update event
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('nulislur_db_change'));
    }

    return {
      success: true,
      message: `Selamat! ${docIds.length} karya atas nama "${item.originalNama}" berhasil dipulihkan ke akunmu.`,
      naskahList: claimedDocs
    };
  },

  async resetKlaimKodeRedeem(kode: string): Promise<{ success: boolean; message: string }> {
    const cleanCode = kode.trim().toUpperCase();
    const list = await this.getDaftarKodeRedeem();
    const itemIndex = list.findIndex(
      (item) => item.kodeRedeem.trim().toUpperCase() === cleanCode
    );

    if (itemIndex === -1) {
      return { success: false, message: `Kode "${cleanCode}" tidak ditemukan.` };
    }

    const item = { ...list[itemIndex] };
    const docIds = item.docIds || item.naskahList.map((n) => n.id);

    // Kembalikan dokumen ke state migrasi awal
    if (isSupabaseConfigured) {
      try {
        await supabase
          .from('dokumen')
          .update({
            username: `migrasi_${item.kodeRedeem}`,
            nama: item.originalNama,
            kode_kelas: 'MIGRASI'
          })
          .in('id', docIds);
      } catch (err) {
        console.warn('Gagal reset dokumen di Supabase:', err);
      }
    }

    const local = getLocalDB();
    docIds.forEach((id) => {
      if (local.dokumen[id]) {
        local.dokumen[id].username = `migrasi_${item.kodeRedeem}`;
        local.dokumen[id].nama = item.originalNama;
        local.dokumen[id].kodeKelas = 'MIGRASI';
        local.dokumen[id].namaKelas = undefined;
      }
    });

    // Reset status item tiket
    item.isRedeemed = false;
    item.redeemedByUsername = undefined;
    item.redeemedByNama = undefined;
    item.redeemedKodeKelas = undefined;
    item.redeemedAt = undefined;
    list[itemIndex] = item;

    if (isSupabaseConfigured) {
      try {
        await supabase.from('pengaturan').upsert({
          key: 'migrasi_redeem_list',
          val: JSON.stringify(list)
        }, { onConflict: 'key' });

        // Hapus juga catatan klaim individual
        await supabase.from('pengaturan').delete().eq('key', `redeem_claim_${cleanCode}`);
      } catch (err) {
        console.warn('Gagal update redeem list di Supabase saat reset:', err);
      }
    }

    local.redeemList = list;
    saveLocalDB(local);

    cachedRedeemList = list;
    lastRedeemListFetchTime = Date.now();

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('nulislur_db_change'));
    }

    return {
      success: true,
      message: `Kode "${item.kodeRedeem}" untuk "${item.originalNama}" berhasil di-reset. Kode aktif kembali dan siap diklaim.`
    };
  },

  async resetSemuaKlaimTesting(): Promise<{ success: boolean; message: string; count: number }> {
    const list = await this.getDaftarKodeRedeem();
    const claimedIndices = list
      .map((item, idx) => (item.isRedeemed ? idx : -1))
      .filter((idx) => idx !== -1);

    if (claimedIndices.length === 0) {
      return { success: true, message: 'Tidak ada kode yang sedang diklaim saat ini.', count: 0 };
    }

    const allResetDocIds: string[] = [];
    const local = getLocalDB();

    for (const idx of claimedIndices) {
      const item = list[idx];
      const docIds = item.docIds || item.naskahList.map((n) => n.id);
      allResetDocIds.push(...docIds);

      docIds.forEach((id) => {
        if (local.dokumen[id]) {
          local.dokumen[id].username = `migrasi_${item.kodeRedeem}`;
          local.dokumen[id].nama = item.originalNama;
          local.dokumen[id].kodeKelas = 'MIGRASI';
          local.dokumen[id].namaKelas = undefined;
        }
      });

      list[idx] = {
        ...item,
        isRedeemed: false,
        redeemedByUsername: undefined,
        redeemedByNama: undefined,
        redeemedKodeKelas: undefined,
        redeemedAt: undefined
      };
    }

    if (isSupabaseConfigured && allResetDocIds.length > 0) {
      try {
        for (const idx of claimedIndices) {
          const item = list[idx];
          const docIds = item.docIds || item.naskahList.map((n) => n.id);
          await supabase
            .from('dokumen')
            .update({
              username: `migrasi_${item.kodeRedeem}`,
              nama: item.originalNama,
              kode_kelas: 'MIGRASI'
            })
            .in('id', docIds);
        }

        await supabase.from('pengaturan').upsert({
          key: 'migrasi_redeem_list',
          val: JSON.stringify(list)
        });
      } catch (err) {
        console.warn('Gagal reset massal di Supabase:', err);
      }
    }

    local.redeemList = list;
    saveLocalDB(local);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('nulislur_db_change'));
    }

    return {
      success: true,
      message: `Berhasil mereset ${claimedIndices.length} kode klaim testing. Semua naskah kembali ke status pra-klaim dan siap diuji coba lagi.`,
      count: claimedIndices.length
    };
  },

  // 13. Fitur Cuitan (Microblogging Linimasa) - Dioptimasi Cepat (In-Memory & Local-First)
  async getCuitanList(): Promise<CuitanItem[]> {
    if (inMemoryCuitanCache && inMemoryCuitanCache.length > 0) {
      return inMemoryCuitanCache;
    }

    const local = getLocalDB();
    if (local.cuitanList && local.cuitanList.length > 0) {
      inMemoryCuitanCache = local.cuitanList;
    } else {
      local.cuitanList = initialCuitanSeed;
      inMemoryCuitanCache = initialCuitanSeed;
      saveCuitanState(initialCuitanSeed, false);
    }

    // Sync remote secara background saat awal muat
    if (isSupabaseConfigured) {
      (async () => {
        try {
          const { data, error } = await supabase
            .from('pengaturan')
            .select('val')
            .eq('key', 'cuitan_list')
            .maybeSingle();

          if (!error && data && data.val) {
            const parsed = typeof data.val === 'string' ? JSON.parse(data.val) : data.val;
            if (Array.isArray(parsed) && parsed.length > 0) {
              inMemoryCuitanCache = parsed;
              const freshLocal = getLocalDB();
              freshLocal.cuitanList = parsed;
              localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(freshLocal));
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('nulislur_cuitan_change', { detail: parsed }));
              }
            }
          }
        } catch {}
      })();
    }

    return inMemoryCuitanCache!;
  },

  isCuitanHariIni(c: CuitanItem): boolean {
    const now = new Date();
    const localIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const utcIso = now.toISOString().slice(0, 10);

    // 1. Cek properti tanggal tersimpan
    if (c.tanggal && (c.tanggal === localIso || c.tanggal === utcIso)) return true;

    // 2. Cek createdAt timestamp
    if (c.createdAt) {
      try {
        const d = new Date(c.createdAt);
        const dLocal = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        if (dLocal === localIso || d.toISOString().slice(0, 10) === utcIso) return true;
      } catch {}
    }

    // 3. Cek timestamp yang terkandung dalam id cuitan (cuit_{ts})
    if (c.id && c.id.startsWith('cuit_')) {
      const ts = Number(c.id.replace('cuit_', ''));
      if (!isNaN(ts) && ts > 0) {
        try {
          const d = new Date(ts);
          const dLocal = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          if (dLocal === localIso || d.toISOString().slice(0, 10) === utcIso) return true;
        } catch {}
      }
    }

    // 4. Cek string waktu (misal "09 Okt 2026, 13.00")
    if (c.waktu) {
      const localId1 = now.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
      const localId2 = now.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
      if (
        c.waktu.includes(localIso) ||
        c.waktu.includes(utcIso) ||
        c.waktu.includes(localId1) ||
        c.waktu.includes(localId2)
      ) {
        return true;
      }
    }
    return false;
  },

  async cekJatahCuitanHariIni(username: string): Promise<boolean> {
    const list = inMemoryCuitanCache || getLocalDB().cuitanList || [];
    return list.some((c) => c.username === username && this.isCuitanHariIni(c));
  },

  async tambahCuitan(params: {
    username: string;
    role: 'siswa' | 'guru' | 'admin';
    teks: string;
    kodeKelas?: string;
    namaKelas?: string;
    sekolahId?: string;
    namaSekolah?: string;
  }): Promise<{ success: boolean; message: string; cuitan?: CuitanItem }> {
    const cleanTeks = params.teks.trim();
    if (!cleanTeks) {
      return { success: false, message: 'Cuitan tidak boleh kosong.' };
    }
    if (cleanTeks.length > 350) {
      return { success: false, message: 'Panjang cuitan maksimal 350 karakter.' };
    }

    const list = inMemoryCuitanCache || (await this.getCuitanList());

    // Limitasi: Siswa hanya 1 cuitan per hari kalender
    if (params.role === 'siswa') {
      const alreadyPostedToday = list.some(
        (c) => c.username === params.username && this.isCuitanHariIni(c)
      );
      if (alreadyPostedToday) {
        return {
          success: false,
          message: 'Kamu sudah mengirim cuitan hari ini. Setiap siswa memiliki jatah 1 cuitan per hari.',
        };
      }
    }

    const now = Date.now();
    const today = new Date();
    const todayLocalIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const newCuitan: CuitanItem = {
      id: 'cuit_' + now,
      username: params.username,
      teks: cleanTeks,
      waktu: getWaktuSekarang(),
      tanggal: todayLocalIso,
      createdAt: now,
      kodeKelas: params.kodeKelas || 'Umum',
      namaKelas: params.namaKelas,
      sekolahId: params.sekolahId,
      namaSekolah: params.namaSekolah,
      likes: [],
      komentar: [],
    };

    const updatedList = [newCuitan, ...list];
    saveCuitanState(updatedList, true);

    return { success: true, message: 'Cuitan berhasil dikirim!', cuitan: newCuitan };
  },

  async tambahKomentarCuitan(params: {
    cuitanId: string;
    parentId?: string | null;
    replyToUsername?: string | null;
    username: string;
    teks: string;
  }): Promise<{ success: boolean; message: string; komentar?: CuitanKomentar }> {
    const cleanTeks = params.teks.trim();
    if (!cleanTeks) {
      return { success: false, message: 'Komentar tidak boleh kosong.' };
    }

    const list = inMemoryCuitanCache || (await this.getCuitanList());
    const targetIdx = list.findIndex((c) => c.id === params.cuitanId);
    if (targetIdx === -1) {
      return { success: false, message: 'Cuitan tidak ditemukan.' };
    }

    const updatedList = [...list];
    const cuitan = { ...updatedList[targetIdx] };
    const newKomentar: CuitanKomentar = {
      id: 'kom_' + Date.now(),
      cuitanId: params.cuitanId,
      parentId: params.parentId || null,
      replyToUsername: params.replyToUsername || null,
      username: params.username,
      teks: cleanTeks,
      waktu: getWaktuSekarang(),
      likes: [],
    };

    cuitan.komentar = [...(cuitan.komentar || []), newKomentar];
    updatedList[targetIdx] = cuitan;

    saveCuitanState(updatedList, true);

    return { success: true, message: 'Komentar berhasil dikirim!', komentar: newKomentar };
  },

  async toggleLikeCuitan(cuitanId: string, username: string): Promise<void> {
    const list = inMemoryCuitanCache || (await this.getCuitanList());
    const targetIdx = list.findIndex((c) => c.id === cuitanId);
    if (targetIdx === -1) return;

    const updatedList = [...list];
    const cuitan = { ...updatedList[targetIdx] };
    const likes = new Set(cuitan.likes || []);
    if (likes.has(username)) {
      likes.delete(username);
    } else {
      likes.add(username);
    }
    cuitan.likes = Array.from(likes);
    updatedList[targetIdx] = cuitan;

    saveCuitanState(updatedList, true);
  },

  async toggleLikeKomentar(cuitanId: string, komentarId: string, username: string): Promise<void> {
    const list = inMemoryCuitanCache || (await this.getCuitanList());
    const targetIdx = list.findIndex((c) => c.id === cuitanId);
    if (targetIdx === -1) return;

    const updatedList = [...list];
    const cuitan = { ...updatedList[targetIdx] };
    const komIdx = (cuitan.komentar || []).findIndex((k) => k.id === komentarId);
    if (komIdx === -1) return;

    const updatedKomentar = [...cuitan.komentar];
    const kom = { ...updatedKomentar[komIdx] };
    const likes = new Set(kom.likes || []);
    if (likes.has(username)) {
      likes.delete(username);
    } else {
      likes.add(username);
    }
    kom.likes = Array.from(likes);
    updatedKomentar[komIdx] = kom;
    cuitan.komentar = updatedKomentar;
    updatedList[targetIdx] = cuitan;

    saveCuitanState(updatedList, true);
  },

  async editCuitan(cuitanId: string, newTeks: string, username: string): Promise<{ success: boolean; message: string }> {
    const cleanTeks = newTeks.trim();
    if (!cleanTeks) return { success: false, message: 'Isi cuitan tidak boleh kosong.' };
    if (cleanTeks.length > 350) return { success: false, message: 'Panjang cuitan maksimal 350 karakter.' };

    const list = inMemoryCuitanCache || (await this.getCuitanList());
    const targetIdx = list.findIndex((c) => c.id === cuitanId);
    if (targetIdx === -1) return { success: false, message: 'Cuitan tidak ditemukan.' };

    const cuitan = list[targetIdx];
    if (cuitan.username.toLowerCase() !== username.toLowerCase()) {
      return { success: false, message: 'Anda hanya dapat mengedit cuitan milik sendiri.' };
    }

    const updatedList = [...list];
    updatedList[targetIdx] = {
      ...cuitan,
      teks: cleanTeks,
    };

    saveCuitanState(updatedList, true);
    return { success: true, message: 'Cuitan berhasil diperbarui!' };
  },

  async hapusCuitan(cuitanId: string): Promise<void> {
    const list = inMemoryCuitanCache || (await this.getCuitanList());
    const updated = list.filter((c) => c.id !== cuitanId);
    saveCuitanState(updated, true);
  },

  async hapusKomentarCuitan(cuitanId: string, komentarId: string): Promise<void> {
    const list = inMemoryCuitanCache || (await this.getCuitanList());
    const targetIdx = list.findIndex((c) => c.id === cuitanId);
    if (targetIdx === -1) return;

    const updatedList = [...list];
    const cuitan = { ...updatedList[targetIdx] };
    cuitan.komentar = (cuitan.komentar || []).filter(
      (k) => k.id !== komentarId && k.parentId !== komentarId
    );
    updatedList[targetIdx] = cuitan;
    saveCuitanState(updatedList, true);
  },

  listenCuitan(callback: (list: CuitanItem[]) => void): () => void {
    // 1. Sampaikan data lokal/memori secara seketika (< 1ms)
    this.getCuitanList().then((list) => callback(list));

    // 2. Dengarkan broadcast lokal tab/window
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent<CuitanItem[]>;
      if (customEvent.detail) {
        callback(customEvent.detail);
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('nulislur_cuitan_change', handler);
    }

    // 3. Dengarkan update realtime antardevice via Supabase Realtime
    let channel: any = null;
    if (isSupabaseConfigured) {
      channel = supabase
        .channel('public:pengaturan:cuitan')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'pengaturan', filter: 'key=eq.cuitan_list' },
          (payload) => {
            if (payload.new && (payload.new as any).val) {
              try {
                const raw = (payload.new as any).val;
                const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
                if (Array.isArray(parsed)) {
                  inMemoryCuitanCache = parsed;
                  const local = getLocalDB();
                  local.cuitanList = parsed;
                  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(local));
                  callback(parsed);
                }
              } catch {}
            }
          }
        )
        .subscribe();
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('nulislur_cuitan_change', handler);
      }
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  },

  async saveYjsDocState(docId: string, state: Uint8Array, localOnly: boolean = false): Promise<void> {
    if (!docId || !state || state.byteLength <= 4) return;
    try {
      const b64 = uint8ArrayToBase64(state);
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(`collab_yjs_${docId}`, b64);
        } catch {}
      }
      if (localOnly) return;
      // Safety guard: Jangan simpan jika ukuran binary > 50 KB untuk mencegah pembengkakan egress kuota Supabase
      if (state.byteLength > 50 * 1024) return;
      if (isSupabaseConfigured) {
        await supabase.from('pengaturan').upsert({
          key: `collab_yjs_${docId}`,
          val: b64,
        });
      }
    } catch (e) {
      console.warn('Gagal menyimpan state Yjs dokumen:', e);
    }
  },

  async getYjsDocState(docId: string): Promise<Uint8Array | null> {
    try {
      // 1. Coba ambil dari Supabase
      if (isSupabaseConfigured) {
        const { data } = await supabase
          .from('pengaturan')
          .select('val')
          .eq('key', `collab_yjs_${docId}`)
          .maybeSingle();
        if (data?.val) {
          const arr = base64ToUint8Array(data.val);
          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem(`collab_yjs_${docId}`, data.val);
            } catch {}
          }
          return arr;
        }
      }

      // 2. Fallback ambil dari localStorage
      if (typeof window !== 'undefined') {
        const localVal = localStorage.getItem(`collab_yjs_${docId}`);
        if (localVal) {
          return base64ToUint8Array(localVal);
        }
      }
    } catch (e) {
      console.warn('Gagal membaca state Yjs dokumen:', e);
    }
    return null;
  },

  // ==============================================================================
  // FITUR MANAJEMEN MULTI-SEKOLAH & ROLE ADMIN (PRICING & AKSES GURU)
  // ==============================================================================

  async getDaftarSekolah(): Promise<Sekolah[]> {
    if (isSupabaseConfigured) {
      try {
        const { data } = await supabase.from('pengaturan').select('val').eq('key', 'sekolah_list').maybeSingle();
        if (data && data.val) {
          const list = JSON.parse(data.val);
          if (Array.isArray(list) && list.length > 0) return list;
        }
      } catch (e) {
        console.warn('Gagal memuat sekolah_list:', e);
      }
    }
    return [
      {
        id: 'sman1-gondanglegi',
        namaSekolah: 'SMA Negeri 1 Gondanglegi',
        npsn: '20517758',
        jenjang: 'SMA',
        paket: 'pro',
        status: 'aktif',
        fitur: {
          kolaborasi: true,
          cuitan: true,
          antiCurang: true,
          eksporResmi: true,
          maxKelas: 15,
          maxSiswaPerKelas: 45
        },
        waktuDaftar: '16 Okt 2026'
      }
    ];
  },

  listenSekolah(callback: (list: Sekolah[]) => void): () => void {
    const fetchAndCallback = async () => {
      const list = await this.getDaftarSekolah();
      callback(list);
    };
    fetchAndCallback();

    if (isSupabaseConfigured) {
      const channel = supabase
        .channel('public:pengaturan:sekolah_list')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'pengaturan', filter: 'key=eq.sekolah_list' }, () => {
          fetchAndCallback();
        })
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    }

    const handler = () => fetchAndCallback();
    window.addEventListener('nulislur_db_change', handler);
    return () => window.removeEventListener('nulislur_db_change', handler);
  },

  async simpanSekolah(sekolah: Sekolah): Promise<{ success: boolean; message: string }> {
    try {
      const current = await this.getDaftarSekolah();
      const idx = current.findIndex(s => s.id === sekolah.id);
      if (idx >= 0) {
        current[idx] = sekolah;
      } else {
        current.unshift(sekolah);
      }
      if (isSupabaseConfigured) {
        await supabase.from('pengaturan').upsert({
          key: 'sekolah_list',
          val: JSON.stringify(current)
        });
      }
      window.dispatchEvent(new Event('nulislur_db_change'));
      return { success: true, message: `Sekolah "${sekolah.namaSekolah}" berhasil disimpan!` };
    } catch (e: any) {
      return { success: false, message: e?.message || 'Gagal menyimpan sekolah.' };
    }
  },

  async hapusSekolah(sekolahId: string): Promise<{ success: boolean; message: string }> {
    try {
      const current = await this.getDaftarSekolah();
      const filtered = current.filter(s => s.id !== sekolahId);
      if (isSupabaseConfigured) {
        await supabase.from('pengaturan').upsert({
          key: 'sekolah_list',
          val: JSON.stringify(filtered)
        });
      }
      window.dispatchEvent(new Event('nulislur_db_change'));
      return { success: true, message: 'Sekolah berhasil dihapus.' };
    } catch (e: any) {
      return { success: false, message: e?.message || 'Gagal menghapus sekolah.' };
    }
  },

  async getFiturSekolah(sekolahId?: string): Promise<FiturPaketSekolah> {
    const list = await this.getDaftarSekolah();
    const target = list.find(s => s.id === (sekolahId || 'sman1-gondanglegi'));
    if (target && target.fitur) return target.fitur;
    return {
      kolaborasi: true,
      cuitan: true,
      antiCurang: true,
      eksporResmi: true,
      maxKelas: 15,
      maxSiswaPerKelas: 45
    };
  },

  async getGuruSekolahMap(): Promise<Record<string, { sekolahId: string; namaSekolah: string }>> {
    if (isSupabaseConfigured) {
      try {
        const { data } = await supabase.from('pengaturan').select('val').eq('key', 'guru_sekolah_map').maybeSingle();
        if (data?.val) {
          return JSON.parse(data.val);
        }
      } catch {}
    }
    const local = getLocalDB();
    const map: Record<string, { sekolahId: string; namaSekolah: string }> = {};
    Object.values(local.users).forEach((u) => {
      if ((u.role === 'guru' || u.role === 'admin') && u.sekolahId) {
        map[u.username] = { sekolahId: u.sekolahId, namaSekolah: u.namaSekolah || '' };
      }
    });
    return map;
  },

  async setGuruSekolah(username: string, sekolahId: string, namaSekolah: string): Promise<void> {
    const cleanUser = username.trim().toLowerCase();
    const curMap = await this.getGuruSekolahMap();
    curMap[cleanUser] = { sekolahId, namaSekolah };

    if (isSupabaseConfigured) {
      try {
        await supabase.from('pengaturan').upsert({
          key: 'guru_sekolah_map',
          val: JSON.stringify(curMap)
        });
        await supabase.from('users').update({
          sekolah_id: sekolahId,
          nama_sekolah: namaSekolah
        }).eq('username', cleanUser);
      } catch {}
    }

    const local = getLocalDB();
    if (local.users[cleanUser]) {
      local.users[cleanUser].sekolahId = sekolahId;
      local.users[cleanUser].namaSekolah = namaSekolah;
      saveLocalDB(local);
    }

    if (typeof window !== 'undefined') {
      try {
        const sessionStr = localStorage.getItem('nulislur_session');
        if (sessionStr) {
          const sess = JSON.parse(sessionStr);
          if (sess.username === cleanUser) {
            sess.sekolahId = sekolahId;
            sess.namaSekolah = namaSekolah;
            localStorage.setItem('nulislur_session', JSON.stringify(sess));
            sessionStorage.setItem('nulislur_session', JSON.stringify(sess));
          }
        }
      } catch {}
      window.dispatchEvent(new Event('nulislur_db_change'));
    }
  },

  async ubahSekolahGuru(username: string, sekolahId: string, namaSekolah: string): Promise<{ success: boolean; message: string }> {
    try {
      await this.setGuruSekolah(username, sekolahId, namaSekolah);
      return { success: true, message: `Guru @${username} berhasil dipindahkan ke ${namaSekolah}.` };
    } catch (e: any) {
      return { success: false, message: e?.message || 'Gagal mengubah sekolah guru.' };
    }
  },

  async getKelasSekolahMap(): Promise<Record<string, { sekolahId: string; namaSekolah: string }>> {
    if (isSupabaseConfigured) {
      try {
        const { data } = await supabase.from('pengaturan').select('val').eq('key', 'kelas_sekolah_map').maybeSingle();
        if (data?.val) {
          return JSON.parse(data.val);
        }
      } catch {}
    }
    const local = getLocalDB();
    const map: Record<string, { sekolahId: string; namaSekolah: string }> = {};
    Object.values(local.kelas).forEach((k) => {
      if (k.sekolahId) {
        map[k.kodeKelas] = { sekolahId: k.sekolahId, namaSekolah: k.namaSekolah || '' };
      }
    });
    return map;
  },

  async setKelasSekolah(kodeKelas: string, sekolahId: string, namaSekolah: string): Promise<void> {
    const cleanKode = kodeKelas.trim().toUpperCase();
    const curMap = await this.getKelasSekolahMap();
    curMap[cleanKode] = { sekolahId, namaSekolah };

    if (isSupabaseConfigured) {
      try {
        await supabase.from('pengaturan').upsert({
          key: 'kelas_sekolah_map',
          val: JSON.stringify(curMap)
        });
        await supabase.from('kelas').update({
          sekolah_id: sekolahId,
          nama_sekolah: namaSekolah
        }).eq('kode_kelas', cleanKode);
      } catch {}
    }

    const local = getLocalDB();
    if (local.kelas[cleanKode]) {
      local.kelas[cleanKode].sekolahId = sekolahId;
      local.kelas[cleanKode].namaSekolah = namaSekolah;
      saveLocalDB(local);
    }
  },

  async getSemuaGuru(): Promise<UserAccount[]> {
    const guruMap = await this.getGuruSekolahMap();
    if (isSupabaseConfigured) {
      try {
        const { data } = await supabase.from('users').select('*').in('role', ['guru', 'admin']);
        if (data) {
          return data.map(u => {
            const mapped = guruMap[u.username];
            return {
              username: u.username,
              nama: u.nama,
              role: (u.username === 'admin' ? 'admin' : (u.role || 'guru')) as UserRole,
              kodeKelas: u.kode_kelas,
              namaKelas: u.nama_kelas,
              sekolahId: mapped?.sekolahId || u.sekolah_id || 'sman1-gondanglegi',
              namaSekolah: mapped?.namaSekolah || u.nama_sekolah || 'SMA Negeri 1 Gondanglegi',
              waktuDaftar: u.created_at
            };
          });
        }
      } catch (e) {
        console.warn('Gagal memuat daftar guru:', e);
      }
    }
    const local = getLocalDB();
    return Object.values(local.users).filter(u => u.role === 'guru' || u.role === 'admin').map(u => {
      const mapped = guruMap[u.username];
      return {
        ...u,
        sekolahId: mapped?.sekolahId || u.sekolahId || 'sman1-gondanglegi',
        namaSekolah: mapped?.namaSekolah || u.namaSekolah || 'SMA Negeri 1 Gondanglegi',
      };
    });
  },

  async tambahAkunGuru(nama: string, username: string, password: string, sekolahId: string, namaSekolah: string): Promise<{ success: boolean; message: string }> {
    const cleanUser = username.trim().toLowerCase();
    const cleanNama = nama.trim();
    if (!cleanUser || !cleanNama || !password) {
      return { success: false, message: 'Harap lengkapi semua bidang.' };
    }
    if (isSupabaseConfigured) {
      try {
        const { data: existing } = await supabase.from('users').select('username').eq('username', cleanUser).maybeSingle();
        if (existing) {
          return { success: false, message: `Username "${cleanUser}" sudah digunakan.` };
        }
        const { error } = await supabase.from('users').insert({
          username: cleanUser,
          nama: cleanNama,
          password: password.trim(),
          role: 'guru',
          sekolah_id: sekolahId,
          nama_sekolah: namaSekolah
        });
        if (error) {
          await supabase.from('users').insert({
            username: cleanUser,
            nama: cleanNama,
            password: password.trim(),
            role: 'guru'
          });
        }
        await this.setGuruSekolah(cleanUser, sekolahId, namaSekolah);
        return { success: true, message: `Akun Guru "${cleanNama}" (@${cleanUser}) berhasil dibuat!` };
      } catch (e: any) {
        return { success: false, message: e?.message || 'Gagal menambahkan akun guru.' };
      }
    }
    const local = getLocalDB();
    if (local.users[cleanUser]) {
      return { success: false, message: `Username "${cleanUser}" sudah ada.` };
    }
    local.users[cleanUser] = {
      username: cleanUser,
      nama: cleanNama,
      password: password.trim(),
      role: 'guru',
      sekolahId,
      namaSekolah
    };
    saveLocalDB(local);
    await this.setGuruSekolah(cleanUser, sekolahId, namaSekolah);
    return { success: true, message: `Akun Guru "${cleanNama}" berhasil dibuat!` };
  },

  async resetPasswordUser(targetUsername: string, newPass: string): Promise<{ success: boolean; message: string }> {
    if (isSupabaseConfigured) {
      try {
        await supabase.from('users').update({ password: newPass.trim() }).eq('username', targetUsername.trim().toLowerCase());
        return { success: true, message: `Kata sandi untuk @${targetUsername} berhasil direset.` };
      } catch (e: any) {
        return { success: false, message: e?.message || 'Gagal mereset kata sandi.' };
      }
    }
    const local = getLocalDB();
    if (local.users[targetUsername]) {
      local.users[targetUsername].password = newPass.trim();
      saveLocalDB(local);
      return { success: true, message: 'Kata sandi berhasil direset.' };
    }
    return { success: false, message: 'Akun tidak ditemukan.' };
  },

  async getPlatformStats(): Promise<{ totalSekolah: number; totalGuru: number; totalSiswa: number; totalDokumen: number; totalCuitan: number }> {
    let totalSekolah = 1;
    let totalGuru = 1;
    let totalSiswa = 0;
    let totalDokumen = 0;
    let totalCuitan = 0;

    try {
      const sekolah = await this.getDaftarSekolah();
      totalSekolah = sekolah.length;
    } catch {}

    if (isSupabaseConfigured) {
      try {
        const [{ count: gCount }, { count: sCount }, { count: dCount }] = await Promise.all([
          supabase.from('users').select('*', { count: 'exact', head: true }).in('role', ['guru', 'admin']),
          supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'siswa'),
          supabase.from('dokumen').select('*', { count: 'exact', head: true })
        ]);
        if (gCount !== null) totalGuru = gCount;
        if (sCount !== null) totalSiswa = sCount;
        if (dCount !== null) totalDokumen = dCount;

        const { data: cuitanData } = await supabase.from('pengaturan').select('val').eq('key', 'cuitan_list').maybeSingle();
        if (cuitanData?.val) {
          const list = JSON.parse(cuitanData.val);
          if (Array.isArray(list)) totalCuitan = list.length;
        }
      } catch (e) {
        console.warn('Gagal memuat platform stats:', e);
      }
    } else {
      const local = getLocalDB();
      const users = Object.values(local.users);
      totalGuru = users.filter(u => u.role === 'guru' || u.role === 'admin').length;
      totalSiswa = users.filter(u => u.role === 'siswa').length;
      totalDokumen = Object.keys(local.dokumen).length;
      totalCuitan = local.cuitanList ? local.cuitanList.length : 0;
    }

    return { totalSekolah, totalGuru, totalSiswa, totalDokumen, totalCuitan };
  }
};

