-- ==============================================================================
-- SKEMA BASIS DATA NULISLUR (SUPABASE POSTGRESQL + REALTIME + RLS)
-- Versi: Produksi (Scalable, High-Performance, Zero-Configuration)
-- ==============================================================================

-- 1. TABEL KELAS
CREATE TABLE IF NOT EXISTS public.kelas (
    id TEXT PRIMARY KEY,
    kode_kelas TEXT UNIQUE NOT NULL,
    nama_kelas TEXT NOT NULL,
    guru_username TEXT NOT NULL,
    nama_guru TEXT NOT NULL,
    max_peserta INTEGER DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Migrasi keamanan kolom jika tabel kelas sudah ada sebelumnya
ALTER TABLE public.kelas ADD COLUMN IF NOT EXISTS max_peserta INTEGER DEFAULT NULL;

-- 2. TABEL PENGGUNA (SISWA & GURU)
CREATE TABLE IF NOT EXISTS public.users (
    username TEXT PRIMARY KEY,
    nama TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('guru', 'siswa')),
    password TEXT NOT NULL,
    kode_kelas TEXT,
    nama_kelas TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TABEL DOKUMEN / KARYA TULISAN
CREATE TABLE IF NOT EXISTS public.dokumen (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nama TEXT NOT NULL,
    username TEXT NOT NULL,
    kode_kelas TEXT DEFAULT 'Umum',
    judul TEXT NOT NULL,
    teks TEXT DEFAULT '<p><br></p>',
    status TEXT NOT NULL DEFAULT 'Draf' CHECK (status IN ('Draf', 'Terkumpul', 'Selesai')),
    pelanggaran INTEGER DEFAULT 0,
    is_public BOOLEAN DEFAULT FALSE,
    izin_publish BOOLEAN DEFAULT FALSE,
    topik TEXT,
    tugas_id TEXT,
    judul_tugas TEXT,
    feedback_umum TEXT,
    penulis_kategori TEXT DEFAULT 'Siswa',
    layout_mode TEXT DEFAULT 'kertas',
    waktu_edit TEXT,
    waktu_kumpul TEXT,
    waktu_publish BIGINT,
    waktu_publish_teks TEXT,
    views INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Migrasi keamanan kolom jika tabel dokumen sudah ada sebelumnya
ALTER TABLE public.dokumen ADD COLUMN IF NOT EXISTS tugas_id TEXT;
ALTER TABLE public.dokumen ADD COLUMN IF NOT EXISTS judul_tugas TEXT;
ALTER TABLE public.dokumen ADD COLUMN IF NOT EXISTS layout_mode TEXT DEFAULT 'kertas';
ALTER TABLE public.dokumen ADD COLUMN IF NOT EXISTS penulis_kategori TEXT DEFAULT 'Siswa';
ALTER TABLE public.dokumen ADD COLUMN IF NOT EXISTS penilaian JSONB DEFAULT NULL;

-- 4. TABEL PENUGASAN (TUGAS TERSTRUKTUR DARI GURU)
CREATE TABLE IF NOT EXISTS public.penugasan (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    judul TEXT NOT NULL,
    deskripsi TEXT NOT NULL,
    kode_kelas TEXT NOT NULL,
    nama_kelas TEXT,
    guru_username TEXT NOT NULL,
    nama_guru TEXT,
    waktu_dibuat TEXT,
    tenggat_waktu TEXT,
    topik TEXT,
    target_kata_min INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. TABEL SUKA (LIKES RUANG PUBLIK)
CREATE TABLE IF NOT EXISTS public.likes (
    id BIGSERIAL PRIMARY KEY,
    doc_id UUID NOT NULL REFERENCES public.dokumen(id) ON DELETE CASCADE,
    username TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (doc_id, username)
);

-- 6. TABEL KOMENTAR / APRESIASI RUANG PUBLIK
CREATE TABLE IF NOT EXISTS public.komentar (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doc_id UUID NOT NULL REFERENCES public.dokumen(id) ON DELETE CASCADE,
    nama TEXT NOT NULL,
    username TEXT NOT NULL,
    teks TEXT NOT NULL,
    waktu TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. TABEL PENGUMUMAN / WORO-WORO KELAS
CREATE TABLE IF NOT EXISTS public.pengumuman (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teks TEXT NOT NULL,
    waktu TEXT NOT NULL,
    kode_kelas TEXT DEFAULT 'Umum',
    tugas_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Migrasi jika tabel pengumuman sudah ada sebelumnya
ALTER TABLE public.pengumuman ADD COLUMN IF NOT EXISTS tugas_id TEXT;

-- 8. TABEL KEHADIRAN & STATUS LIVE SISWA (SENSOR MEJA KERJA)
CREATE TABLE IF NOT EXISTS public.kehadiran_live (
    username TEXT PRIMARY KEY,
    nama TEXT NOT NULL,
    kode_kelas TEXT DEFAULT 'Umum',
    aktivitas TEXT DEFAULT 'Beranda',
    is_online BOOLEAN DEFAULT TRUE,
    sedang_keluar_tab BOOLEAN DEFAULT FALSE,
    doc_aktif_id TEXT,
    session_id TEXT,
    pelanggaran_count INTEGER DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. TABEL PENGATURAN GLOBAL (TERMASUK CUITAN & SENSOR)
CREATE TABLE IF NOT EXISTS public.pengaturan (
    key TEXT PRIMARY KEY,
    val TEXT NOT NULL
);

-- Inisialisasi Pengaturan Sensor
INSERT INTO public.pengaturan (key, val)
VALUES ('tracking_aktif', 'true')
ON CONFLICT (key) DO NOTHING;

-- ==============================================================================
-- INDEX PERFORMA TINGGI (SCALABILITY BOOSTER)
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_dokumen_username ON public.dokumen (username);
CREATE INDEX IF NOT EXISTS idx_dokumen_kode_kelas ON public.dokumen (kode_kelas);
CREATE INDEX IF NOT EXISTS idx_dokumen_status ON public.dokumen (status);
CREATE INDEX IF NOT EXISTS idx_dokumen_penulis_kategori ON public.dokumen (penulis_kategori);
CREATE INDEX IF NOT EXISTS idx_users_kode_kelas ON public.users (kode_kelas);
CREATE INDEX IF NOT EXISTS idx_penugasan_kode_kelas ON public.penugasan (kode_kelas);
CREATE INDEX IF NOT EXISTS idx_komentar_doc_id ON public.komentar (doc_id);
CREATE INDEX IF NOT EXISTS idx_likes_doc_id ON public.likes (doc_id);
CREATE INDEX IF NOT EXISTS idx_pengumuman_tugas_id ON public.pengumuman (tugas_id);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) & KEBIJAKAN AKSES
-- ==============================================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kelas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dokumen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.penugasan ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.komentar ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pengumuman ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kehadiran_live ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pengaturan ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "policy_users_all" ON public.users;
DROP POLICY IF EXISTS "policy_kelas_all" ON public.kelas;
DROP POLICY IF EXISTS "policy_dokumen_all" ON public.dokumen;
DROP POLICY IF EXISTS "policy_penugasan_all" ON public.penugasan;
DROP POLICY IF EXISTS "policy_likes_all" ON public.likes;
DROP POLICY IF EXISTS "policy_komentar_all" ON public.komentar;
DROP POLICY IF EXISTS "policy_pengumuman_all" ON public.pengumuman;
DROP POLICY IF EXISTS "policy_kehadiran_live_all" ON public.kehadiran_live;
DROP POLICY IF EXISTS "policy_pengaturan_all" ON public.pengaturan;

CREATE POLICY "policy_users_all" ON public.users FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "policy_kelas_all" ON public.kelas FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "policy_dokumen_all" ON public.dokumen FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "policy_penugasan_all" ON public.penugasan FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "policy_likes_all" ON public.likes FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "policy_komentar_all" ON public.komentar FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "policy_pengumuman_all" ON public.pengumuman FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "policy_kehadiran_live_all" ON public.kehadiran_live FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "policy_pengaturan_all" ON public.pengaturan FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ==============================================================================
-- AKTIFKAN REALTIME PUBLICATION (UNTUK SINKRONISASI INSTAN ANTARPERANGKAT)
-- ==============================================================================
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.dokumen;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.kelas;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.pengaturan;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.kehadiran_live;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.penugasan;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.komentar;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.likes;
  EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;

-- ==============================================================================
-- DATA AWAL BAWAAN (DEFAULT SEEDS)
-- ==============================================================================
-- Akun Guru Bawaan (Username: guru, Password: guru123)
INSERT INTO public.users (username, nama, role, password)
VALUES ('guru', 'Ibu/Bapak Guru (Pengajar)', 'guru', 'guru123')
ON CONFLICT (username) DO NOTHING;

-- Kelas Bawaan
INSERT INTO public.kelas (id, kode_kelas, nama_kelas, guru_username, nama_guru, max_peserta)
VALUES ('NULIS-10A', 'NULIS-10A', 'Kelas 10-A Menulis Sastra', 'guru', 'Ibu/Bapak Guru', 36)
ON CONFLICT (id) DO NOTHING;

-- Akun Siswa Bawaan
INSERT INTO public.users (username, nama, role, password, kode_kelas, nama_kelas)
VALUES 
    ('ahmad', 'Ahmad Rizki', 'siswa', '123', 'NULIS-10A', 'Kelas 10-A Menulis Sastra'),
    ('budi', 'Budi Santoso', 'siswa', '123', 'NULIS-10A', 'Kelas 10-A Menulis Sastra')
ON CONFLICT (username) DO NOTHING;
