// Skrip Migrasi Naskah Siswa dari Firebase Realtime Database ke Supabase & LocalDB
// Mengelompokkan naskah per siswa, menghasilkan kode unik redeem, dan menyimpan data master redeem.

const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const FIREBASE_URL = 'https://nulisyoks-default-rtdb.asia-southeast1.firebasedatabase.app/dokumen.json';
const SUPABASE_HOST = 'ttxmnzvsjjrfyinfglwi.supabase.co';
const SUPABASE_KEY = 'sb_publishable_dJBlRtovn2Ec889dK-Vftw_AL2m93Pz';

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

function postSupabase(endpoint, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = https.request(
      {
        hostname: SUPABASE_HOST,
        path: `/rest/v1/${endpoint}`,
        method: 'POST',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          Prefer: 'return=representation',
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(data ? JSON.parse(data) : null);
            } catch {
              resolve(data);
            }
          } else {
            reject(new Error(`Supabase error [${res.statusCode}]: ${data}`));
          }
        });
      }
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function upsertPengaturan(key, val) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify([{ key, val }]);
    const req = https.request(
      {
        hostname: SUPABASE_HOST,
        path: '/rest/v1/pengaturan?on_conflict=key',
        method: 'POST',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          Prefer: 'resolution=merge-duplicates',
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(true);
          } else {
            reject(new Error(`Pengaturan upsert error [${res.statusCode}]: ${data}`));
          }
        });
      }
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// Menghitung perkiraan kata dari teks HTML
function countWordsFromHtml(html) {
  if (!html) return 0;
  const clean = html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').trim();
  return clean ? clean.split(/\s+/).filter(Boolean).length : 0;
}

// Generate kode unik ramah baca, misal: NL-AKRAM-7X
function generateFriendlyCode(name, usedCodes) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  let prefix = 'NL';
  if (parts.length > 0) {
    const cleanFirstName = parts[0].replace(/[^a-zA-Z0-9]/g, '').toUpperCase().substring(0, 7);
    if (cleanFirstName.length >= 3) {
      prefix = `NL-${cleanFirstName}`;
    }
  }

  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // Tanpa 0, 1, I, O agar tidak membingungkan
  for (let attempt = 0; attempt < 1000; attempt++) {
    let rand = '';
    for (let i = 0; i < 3; i++) {
      rand += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const candidate = `${prefix}-${rand}`;
    if (!usedCodes.has(candidate)) {
      usedCodes.add(candidate);
      return candidate;
    }
  }

  // Fallback
  const hex = crypto.randomBytes(3).toString('hex').toUpperCase();
  const fallback = `NL-${hex}`;
  usedCodes.add(fallback);
  return fallback;
}

async function run() {
  console.log('🚀 Memulai migrasi data naskah Firebase ke Supabase...');
  console.log('1. Mengambil data dokumen dari Firebase Realtime Database...');
  const rawDocs = await fetchJson(FIREBASE_URL);

  if (!rawDocs || typeof rawDocs !== 'object') {
    throw new Error('Gagal mengambil dokumen dari Firebase atau data kosong.');
  }

  const docEntries = Object.entries(rawDocs);
  console.log(`✓ Berhasil mengambil ${docEntries.length} naskah dari Firebase.`);

  // 2. Kelompokkan dokumen per nama siswa
  const groupedByAuthor = new Map();
  for (const [fbKey, doc] of docEntries) {
    const rawName = (doc.nama || 'Tanpa Nama').trim();
    if (!groupedByAuthor.has(rawName)) {
      groupedByAuthor.set(rawName, []);
    }
    groupedByAuthor.get(rawName).push({ fbKey, ...doc });
  }

  console.log(`✓ Teridentifikasi ${groupedByAuthor.size} siswa unik.`);

  const usedCodes = new Set();
  const masterRedeemList = [];
  const allDocsToInsert = [];

// Memastikan seluruh baris memiliki struktur dan key yang seragam 100% untuk PostgREST batch insert
function formatDocRow(fields) {
  return {
    id: fields.id,
    nama: String(fields.nama || ''),
    username: String(fields.username || ''),
    kode_kelas: String(fields.kode_kelas || 'MIGRASI'),
    judul: String(fields.judul || 'Tanpa Judul'),
    teks: String(fields.teks || '<p></p>'),
    status: String(fields.status || 'Draf'),
    pelanggaran: Number(fields.pelanggaran || 0),
    is_public: Boolean(fields.is_public),
    izin_publish: Boolean(fields.izin_publish),
    topik: fields.topik ? String(fields.topik) : null,
    feedback_umum: fields.feedback_umum ? String(fields.feedback_umum) : null,
    penulis_kategori: String(fields.penulis_kategori || 'Siswa'),
    waktu_edit: String(fields.waktu_edit || 'Sep 2026'),
    waktu_kumpul: fields.waktu_kumpul ? String(fields.waktu_kumpul) : null,
  };
}

  // 3. Tambahkan 1 Akun Siswa Demo Testing untuk Guru
  const demoCode = 'NL-DEMO-TEST';
  usedCodes.add(demoCode);
  const demoDoc1Id = crypto.randomUUID();
  const demoDoc2Id = crypto.randomUUID();

  allDocsToInsert.push(
    formatDocRow({
      id: demoDoc1Id,
      nama: 'Siswa Percobaan (Demo Testing)',
      username: 'migrasi_' + demoCode,
      kode_kelas: 'MIGRASI',
      judul: 'Menatap Langit Senja (Demo Selesai)',
      teks: '<p>Ini adalah naskah percobaan contoh pertama dengan status selesai. Naskah ini disediakan khusus agar guru dapat menguji coba alur redeem dengan aman dan leluasa.</p><p>Setiap kata dan paragraf tersimpan dengan baik di sistem NulisLur.</p>',
      status: 'Selesai',
      pelanggaran: 0,
      is_public: false,
      izin_publish: false,
      topik: 'Cerpen',
      feedback_umum: 'Bagus sekali alurnya, pertahankan!',
      penulis_kategori: 'Siswa',
      waktu_edit: '06 Okt 2026, 12.00',
      waktu_kumpul: '06 Okt 2026, 12.30',
    })
  );

  allDocsToInsert.push(
    formatDocRow({
      id: demoDoc2Id,
      nama: 'Siswa Percobaan (Demo Testing)',
      username: 'migrasi_' + demoCode,
      kode_kelas: 'MIGRASI',
      judul: 'Rencana Masa Depan (Demo Draf)',
      teks: '<p>Ini adalah naskah contoh kedua dengan status draf. Naskah ini membuktikan bahwa status draf tetap terjaga saat siswa mengklaim kodenya.</p>',
      status: 'Draf',
      pelanggaran: 0,
      is_public: false,
      izin_publish: false,
      topik: 'Esai',
      feedback_umum: null,
      penulis_kategori: 'Siswa',
      waktu_edit: '06 Okt 2026, 12.15',
      waktu_kumpul: null,
    })
  );

  masterRedeemList.push({
    kodeRedeem: demoCode,
    originalNama: 'Siswa Percobaan (Demo Testing)',
    docIds: [demoDoc1Id, demoDoc2Id],
    naskahList: [
      {
        id: demoDoc1Id,
        judul: 'Menatap Langit Senja (Demo Selesai)',
        status: 'Selesai',
        waktuEdit: '06 Okt 2026, 12.00',
        kataCount: 42,
      },
      {
        id: demoDoc2Id,
        judul: 'Rencana Masa Depan (Demo Draf)',
        status: 'Draf',
        waktuEdit: '06 Okt 2026, 12.15',
        kataCount: 28,
      },
    ],
    isRedeemed: false,
  });

  // 4. Proses 31 siswa asli dari Firebase
  for (const [authorName, docs] of groupedByAuthor.entries()) {
    const kodeRedeem = generateFriendlyCode(authorName, usedCodes);
    const authorDocIds = [];
    const authorNaskahList = [];

    for (const d of docs) {
      const docId = crypto.randomUUID();
      authorDocIds.push(docId);

      const kataCount = countWordsFromHtml(d.teks || '');
      authorNaskahList.push({
        id: docId,
        judul: d.judul || 'Tanpa Judul',
        status: d.status || 'Draf',
        waktuEdit: d.waktuEdit || 'Sep 2026',
        kataCount,
      });

      allDocsToInsert.push(
        formatDocRow({
          id: docId,
          nama: authorName,
          username: 'migrasi_' + kodeRedeem,
          kode_kelas: 'MIGRASI',
          judul: d.judul || 'Tanpa Judul',
          teks: d.teks || '<p></p>',
          status: d.status || 'Draf',
          pelanggaran: Number(d.pelanggaran || 0),
          is_public: Boolean(d.isPublic),
          izin_publish: Boolean(d.izinPublish),
          topik: d.topik || null,
          feedback_umum: d.feedbackUmum || null,
          penulis_kategori: 'Siswa',
          waktu_edit: d.waktuEdit || 'Sep 2026',
          waktu_kumpul: d.waktuKumpul || null,
        })
      );
    }

    masterRedeemList.push({
      kodeRedeem,
      originalNama: authorName,
      docIds: authorDocIds,
      naskahList: authorNaskahList,
      isRedeemed: false,
    });
  }

  // Urutkan siswa berdasarkan alfabet nama
  masterRedeemList.sort((a, b) => a.originalNama.localeCompare(b.originalNama));

  console.log(`✓ Siap memasukkan ${allDocsToInsert.length} naskah untuk ${masterRedeemList.length} siswa ke Supabase.`);

  // 5. Masukkan dokumen ke Supabase dalam batch kecil (15 per batch) agar aman dan stabil
  const batchSize = 15;
  for (let i = 0; i < allDocsToInsert.length; i += batchSize) {
    const chunk = allDocsToInsert.slice(i, i + batchSize);
    console.log(`   Mengunggah batch naskah ${i + 1} - ${Math.min(i + batchSize, allDocsToInsert.length)}...`);
    await postSupabase('dokumen', chunk);
  }
  console.log('✓ Seluruh naskah berhasil diunggah ke tabel dokumen Supabase!');

  // 6. Simpan master list kode redeem ke tabel pengaturan Supabase
  console.log('4. Menyimpan daftar master kode redeem ke tabel pengaturan Supabase...');
  await upsertPengaturan('migrasi_redeem_list', JSON.stringify(masterRedeemList));
  console.log('✓ Master kode redeem tersimpan di Supabase.');

  // 7. Simpan backup lokal ke src/data/migrasi_redeem_data.json
  const backupPath = path.resolve(__dirname, '../src/data/migrasi_redeem_data.json');
  fs.writeFileSync(backupPath, JSON.stringify(masterRedeemList, null, 2), 'utf8');
  console.log(`✓ Backup data redeem tersimpan secara lokal di: ${backupPath}`);

  // Simpan juga salinan naskah lengkap lokal sebagai pengaman
  const fullBackupPath = path.resolve(__dirname, '../src/data/migrasi_dokumen_backup.json');
  fs.writeFileSync(fullBackupPath, JSON.stringify(allDocsToInsert, null, 2), 'utf8');
  console.log(`✓ Backup dokumen lengkap tersimpan di: ${fullBackupPath}`);

  console.log('\n=========================================');
  console.log('🎉 MIGRASI SUKSES 100%!');
  console.log(`Total Siswa: ${masterRedeemList.length}`);
  console.log(`Total Dokumen: ${allDocsToInsert.length}`);
  console.log('Contoh 5 Kode Redeem:');
  masterRedeemList.slice(0, 5).forEach((item, idx) => {
    console.log(`  ${idx + 1}. ${item.originalNama} (${item.naskahList.length} karya) -> Kode: ${item.kodeRedeem}`);
  });
  console.log('=========================================\n');
}

run().catch((err) => {
  console.error('❌ Terjadi kesalahan saat migrasi:', err);
  process.exit(1);
});
