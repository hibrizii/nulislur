# NulisLur - Studio Literasi & Bengkel Menulis Terpandu 🖋️

Platform literasi sekolah modern berbasis **React + TypeScript + Vite + Tailwind CSS + Tiptap + Supabase (PostgreSQL + Realtime)**.

---

## ⚡ Panduan Setup Supabase (Gratis & Cepat - 2 Menit)

Aplikasi NulisLur saat ini telah resmi dimigrasikan ke **Supabase**. Ikuti 3 langkah mudah berikut untuk menghubungkan database Supabase Anda:

### 1. Buat Proyek di Supabase
1. Buka [supabase.com](https://supabase.com) dan buat akun (gratis, tanpa kartu kredit).
2. Klik **"New Project"**, beri nama proyek (misal: `nulislur-db`), buat password database, dan pilih lokasi server terdekat (**Singapore**).

### 2. Jalankan Skrip Database (SQL Editor)
1. Di dasbor Supabase Anda, klik menu **SQL Editor** (ikon terminal di sidebar kiri).
2. Buka file [`supabase_schema.sql`](file:///C:/Users/Asus/.gemini/antigravity/scratch/nulislur/supabase_schema.sql) yang ada di folder proyek ini.
3. Salin (*copy*) seluruh isinya, tempel (*paste*) ke SQL Editor Supabase, lalu klik tombol **"Run"** (ikon play hijau).
   - *Skrip ini otomatis membuat tabel `kelas`, `users`, `dokumen`, `likes`, `komentar`, `pengumuman`, `kehadiran_live`, dan menyalakan Supabase Realtime!*

### 3. Masukkan Kunci API ke File `.env`
1. Di Supabase, buka menu **Project Settings** (ikon gerigi) ➔ pilih **API**.
2. Salin **Project URL** dan **anon public key**.
3. Buka file `.env` di folder proyek ini dan tempelkan nilainya:
```env
VITE_SUPABASE_URL=https://xxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJh......
```

> **Catatan Kemudahan**: Jika file `.env` belum diisi, aplikasi tetap bisa berjalan normal dalam **Mode Lokal / Demo** sehingga Anda bisa langsung mencobanya tanpa menunggu setup database!

---

## 🎨 Desain: Modern Editorial / Studio Sastra
- Latar lembut *warm paper* (`#FAF9F6`), nyaman untuk membaca dan menulis naskah berjam-jam.
- Tipografi sastra *Merriweather / Georgia* dengan spasi baris 1.9 yang lega.
- Anotasi koreksi guru berupa *soft pastel highlight* dengan kartu catatan yang bersih.

---

## 🚪 Autentikasi 1 Gerbang & Kode Unik Kelas
- **Satu Pintu Masuk Bersih**: Form universal (Username + Password). Sistem di balik layar yang otomatis mendeteksi apakah akun adalah Siswa atau Guru.
- **Pendaftaran Siswa Mandiri**: Siswa baru cukup mendaftar dengan Nama, Username, Password, dan **Kode Kelas dari Guru** (misal: `NULIS-10A`).
- **Kelola Kelas & Siswa di Dasbor**:
  - Guru dapat membuat kelas baru dengan kode unik acak (misal: `LUR-482`).
  - Guru dapat melihat tabel seluruh siswa, mereset password siswa menjadi `123456`, atau menghapus siswa langsung dari dasbor.

---

## 🔑 Akun Uji Coba Bawaan

| Peran | Username | Kata Sandi | Keterangan |
| :--- | :--- | :--- | :--- |
| **Guru** | **`guru`** | **`guru123`** | Kode kelas bawaan: **`NULIS-10A`** |
| **Siswa 1** | **`ahmad`** | **`123`** | Siswa kelas 10-A |
| **Siswa 2** | **`budi`** | **`123`** | Siswa kelas 10-A |

---

## 🚀 Menjalankan Aplikasi di Komputer Lokal

```powershell
cd C:\Users\Asus\.gemini\antigravity\scratch\nulislur
npm run dev
```
Buka `http://localhost:5173` di peramban Anda.
