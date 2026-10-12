export type UserRole = 'guru' | 'siswa';

export interface UserAccount {
  username: string;
  nama: string;
  role: UserRole;
  password?: string;
  kodeKelas?: string;
  namaKelas?: string;
  waktuDaftar?: string;
}

export interface UserSession {
  username: string;
  nama: string;
  role: UserRole;
  kodeKelas?: string;
  namaKelas?: string;
  sessionId: string;
}

export interface KelasRoom {
  id: string; // kode kelas, misal: 'LUR-892'
  kodeKelas: string;
  namaKelas: string;
  guruUsername: string;
  namaGuru: string;
  waktuDibuat: string;
  siswaCount?: number;
  coTeachers?: string[];
  maxPeserta?: number;
}

export interface PenilaianRubrik {
  // Aspek Makro: Substansi & Organisasi (1 - 5)
  kedalamanGagasan: number;
  kepaduanParagraf: number;
  strukturTeks: number;

  // Aspek Mikro: Kebahasaan & Mekanik (1 - 5)
  efektivitasKalimat: number;
  ketepatanDiksi: number;
  kebakuanEjaan: number;
  pembentukanKata: number;
  tandaBaca: number;
  hurufKapital: number;

  skorMakro: number; // 0 - 100
  skorMikro: number; // 0 - 100
  skorTotal: number; // 0 - 100
  predikat: 'Perlu Bimbingan' | 'Cukup' | 'Baik' | 'Sangat Baik';
  catatanGuru?: string;
  waktuDinilai?: string;
  tagCounts?: Record<string, number>;
}

export interface Penugasan {
  id: string;
  judul: string;
  deskripsi: string;
  kodeKelas: string;
  namaKelas?: string;
  guruUsername: string;
  namaGuru: string;
  waktuDibuat: string;
  tenggatWaktu?: string | null;
  topik?: string;
  targetKataMin?: number | null;
}

export interface Dokumen {
  id: string;
  nama: string;
  username: string;
  kodeKelas?: string;
  kelas?: string;
  namaKelas?: string;
  judul: string;
  teks: string;
  status: 'Draf' | 'Terkumpul' | 'Selesai';
  pelanggaran: number;
  waktuEdit: string;
  waktuKumpul?: string;
  isPublic: boolean;
  izinPublish?: boolean;
  topik?: string;
  tugasId?: string | null;
  judulTugas?: string | null;
  waktuPublish?: number | null;
  waktuPublishTeks?: string | null;
  feedbackUmum?: string;
  updateDariGuru?: boolean;
  penulisKategori?: 'Siswa' | 'Guru';
  views?: number;
  penilaian?: PenilaianRubrik;
  layoutMode?: 'web' | 'kertas';
}

export interface LiveStatus {
  isOnline: boolean;
  aktivitas: string;
  docAktifId?: string | null;
  sedangKeluarTab: boolean;
  sessionId?: string;
  terakhirAktif?: number;
  kodeKelas?: string;
  pelanggaranCount?: number;
}

export interface Komentar {
  id: string;
  nama: string;
  username?: string;
  teks: string;
  waktu: string;
}

export interface Pengumuman {
  id: string;
  teks: string;
  waktu: string;
  kodeKelas?: string;
  tugasId?: string | null;
}

export interface GlobalSettings {
  trackingAktif: boolean;
}

export interface MigrasiRedeemNaskah {
  id: string;
  judul: string;
  status: 'Draf' | 'Terkumpul' | 'Selesai';
  waktuEdit?: string;
  kataCount?: number;
}

export interface MigrasiRedeemItem {
  kodeRedeem: string;
  originalNama: string;
  docIds: string[];
  naskahList: MigrasiRedeemNaskah[];
  isRedeemed: boolean;
  redeemedByUsername?: string;
  redeemedByNama?: string;
  redeemedKodeKelas?: string;
  redeemedAt?: string;
}

export interface CuitanKomentar {
  id: string;
  cuitanId: string;
  parentId?: string | null;
  replyToUsername?: string | null;
  username: string;
  teks: string;
  waktu: string;
  likes: string[];
}

export interface CuitanItem {
  id: string;
  username: string;
  teks: string;
  waktu: string;
  tanggal?: string;
  createdAt?: number;
  kodeKelas?: string;
  namaKelas?: string;
  likes: string[];
  komentar: CuitanKomentar[];
}

