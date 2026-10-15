const { createClient } = require('@supabase/supabase-js');
const { randomUUID } = require('crypto');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://ttxmnzvsjjrfyinfglwi.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_dJBlRtovn2Ec889dK-Vftw_AL2m93Pz';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const NUM_STUDENTS = 25;
const STUDENT_NAMES = [
  'juli', 'megawatt', 'ahmad', 'budiariea', 'budi',
  'fizi', 'jappae', 'hannan', 'yudiskurcaci', 'flibesk',
  'void_aftaz', 'harz', 'ghumals', 'ikhwalezstd', 'lee',
  'fhrii', 'alif', 'haidhar', 'oliseratustahun', 'ujangg',
  'mabaitb_2028', 'sim_siswa_22', 'sim_siswa_23', 'sim_siswa_24', 'sim_siswa_25'
];

async function runSimulation() {
  console.log('================================================================');
  console.log('🚀 MEMULAI SIMULASI BEBAN KELAS NULISLUR (CONCURRENCY STRESS TEST)');
  console.log(`Target: ${NUM_STUDENTS} Siswa Serentak | Endpoint: ${SUPABASE_URL}`);
  console.log('================================================================\n');

  const overallResults = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    timeouts: 0,
    status504s: 0,
    latencies: []
  };

  function record(success, latency, status = null) {
    overallResults.totalRequests++;
    if (success) {
      overallResults.successfulRequests++;
    } else {
      overallResults.failedRequests++;
      if (status === 504) overallResults.status504s++;
    }
    overallResults.latencies.push(latency);
  }

  // ---------------------------------------------------------------------------
  // FASE 1: SIMULASI 25 SISWA LOGIN BERSAMAAN
  // ---------------------------------------------------------------------------
  console.log(`[FASE 1] Mengirim ${NUM_STUDENTS} Login Serentak ke Supabase...`);
  const phase1Start = Date.now();
  const loginPromises = STUDENT_NAMES.map(async (username) => {
    const start = Date.now();
    try {
      const { data, error, status } = await supabase
        .from('users')
        .select('username,nama,role,kode_kelas')
        .eq('username', username)
        .maybeSingle();
      const elapsed = Date.now() - start;
      const ok = !error;
      record(ok, elapsed, status);
      return { username, ok, elapsed, error };
    } catch (err) {
      const elapsed = Date.now() - start;
      record(false, elapsed, 500);
      return { username, ok: false, elapsed, error: err.message };
    }
  });

  const loginResults = await Promise.all(loginPromises);
  const phase1Duration = Date.now() - phase1Start;
  const loginFails = loginResults.filter(r => !r.ok).length;
  const avgLoginLatency = Math.round(loginResults.reduce((a, b) => a + b.elapsed, 0) / loginResults.length);
  const maxLoginLatency = Math.max(...loginResults.map(r => r.elapsed));
  console.log(`✅ FASE 1 SELESAI dalam ${phase1Duration}ms:`);
  console.log(`   - Berhasil: ${loginResults.length - loginFails}/${loginResults.length}`);
  console.log(`   - Gagal: ${loginFails}`);
  console.log(`   - Rata-rata Latensi: ${avgLoginLatency}ms | Latensi Terlambat: ${maxLoginLatency}ms\n`);

  // ---------------------------------------------------------------------------
  // FASE 2: SIMULASI 25 SISWA MEMBUKA LOBI BERSAMAAN (TRAFFIC STORM ASLI)
  // Sebelumnya memicu 1.800 WebSocket & puluhan query per siswa -> 504 Timeout.
  // Sekarang menggunakan isolasi listenDokumenSiswa + batch mading stats.
  // ---------------------------------------------------------------------------
  console.log(`[FASE 2] Simulasi 25 Siswa Masuk Lobi Serentak (125+ Query Paralel)...`);
  const phase2Start = Date.now();

  const lobbyPromises = STUDENT_NAMES.map(async (username) => {
    const studentLobbyStart = Date.now();
    try {
      // 1. Ambil dokumen siswa terisolasi (dokumen sendiri + mading)
      const t1 = Date.now();
      const docsReq = supabase
        .from('dokumen')
        .select('*')
        .or(`username.eq.${username},is_public.eq.true`)
        .then(r => { record(!r.error, Date.now() - t1, r.status); return r; });

      // 2. Ambil Woro-woro
      const t2 = Date.now();
      const pengumumanReq = supabase
        .from('pengumuman')
        .select('*')
        .then(r => { record(!r.error, Date.now() - t2, r.status); return r; });

      // 3. Ambil Penugasan
      const t3 = Date.now();
      const penugasanReq = supabase
        .from('penugasan')
        .select('*')
        .order('created_at', { ascending: false })
        .then(r => { record(!r.error, Date.now() - t3, r.status); return r; });

      // 4. Batch Mading Stats (hanya doc_id tanpa teks)
      const t4 = Date.now();
      const likesReq = supabase
        .from('likes')
        .select('doc_id')
        .then(r => { record(!r.error, Date.now() - t4, r.status); return r; });

      const t5 = Date.now();
      const komentarReq = supabase
        .from('komentar')
        .select('doc_id')
        .then(r => { record(!r.error, Date.now() - t5, r.status); return r; });

      // 5. Presence heartbeat
      const t6 = Date.now();
      const presenceReq = supabase
        .from('kehadiran_live')
        .upsert({
          username,
          nama: `Siswa ${username}`,
          kode_kelas: 'NULIS-10A',
          aktivitas: 'Beranda',
          is_online: true,
          sedang_keluar_tab: false,
          updated_at: new Date().toISOString()
        })
        .then(r => { record(!r.error, Date.now() - t6, r.status); return r; });

      const [docs, pengumuman, penugasan, likes, komentar, presence] = await Promise.all([
        docsReq, pengumumanReq, penugasanReq, likesReq, komentarReq, presenceReq
      ]);

      const studentTotalTime = Date.now() - studentLobbyStart;
      const anyError = docs.error || pengumuman.error || penugasan.error || likes.error || komentar.error;
      return { username, ok: !anyError, elapsed: studentTotalTime, docCount: (docs.data || []).length };
    } catch (err) {
      return { username, ok: false, elapsed: Date.now() - studentLobbyStart, error: err.message };
    }
  });

  const lobbyResults = await Promise.all(lobbyPromises);
  const phase2Duration = Date.now() - phase2Start;
  const lobbyFails = lobbyResults.filter(r => !r.ok).length;
  const avgLobbyLatency = Math.round(lobbyResults.reduce((a, b) => a + b.elapsed, 0) / lobbyResults.length);
  const maxLobbyLatency = Math.max(...lobbyResults.map(r => r.elapsed));
  console.log(`✅ FASE 2 SELESAI dalam ${phase2Duration}ms:`);
  console.log(`   - Berhasil: ${lobbyResults.length - lobbyFails}/${lobbyResults.length}`);
  console.log(`   - Gagal (504/Timeout): ${lobbyFails}`);
  console.log(`   - Rata-rata Waktu Muat Lobi: ${avgLobbyLatency}ms | Paling Lambat: ${maxLobbyLatency}ms\n`);

  // ---------------------------------------------------------------------------
  // FASE 3: SIMULASI 20 SISWA KLAIM REDEEM DI DETIK YANG SAMA
  // (Menguji apakah single-row lock contention sudah tereliminasi)
  // ---------------------------------------------------------------------------
  console.log(`[FASE 3] Setup & Simulasi 20 Siswa Menekan Tombol "Klaim" Bersamaan...`);

  // Siapkan 20 dokumen uji coba sementara
  const testDocIds = [];
  const testCodes = [];
  for (let i = 1; i <= 20; i++) {
    const testId = randomUUID();
    const testCode = `SIMTEST${i}`;
    testDocIds.push(testId);
    testCodes.push(testCode);
  }

  // Insert dokumen uji coba
  const seedDocs = testDocIds.map((id, idx) => ({
    id,
    judul: `Karya Uji Coba Simulasi ${idx + 1}`,
    teks: `<p>Ini naskah dummy untuk menguji konkurensi beban 20 klaim serentak.</p>`,
    username: `migrasi_SIMTEST${idx + 1}`,
    nama: `Pemilik Lama ${idx + 1}`,
    status: 'Draf',
    waktu_edit: new Date().toISOString()
  }));

  const { error: seedErr } = await supabase.from('dokumen').upsert(seedDocs);
  if (seedErr) {
    console.warn('Peringatan saat seeding test documents:', seedErr.message);
  }

  const phase3Start = Date.now();
  const claimPromises = testCodes.map(async (code, idx) => {
    const claimStart = Date.now();
    const docId = testDocIds[idx];
    const targetUser = STUDENT_NAMES[idx] || `siswa_sim_${idx}`;

    try {
      // 1. Update dokumen langsung dengan .select('*')
      const tUpdate = Date.now();
      const updateRes = await supabase
        .from('dokumen')
        .update({
          username: targetUser,
          nama: `Nama Siswa ${targetUser}`,
          waktu_edit: new Date().toISOString()
        })
        .eq('id', docId)
        .select('*');
      record(!updateRes.error, Date.now() - tUpdate, updateRes.status);

      // 2. Simpan catatan klaim individual (Kunci terpisah anti-lock)
      const tClaimKey = Date.now();
      const claimKeyRes = await supabase
        .from('pengaturan')
        .upsert({
          key: `redeem_claim_${code}`,
          val: JSON.stringify({
            kodeRedeem: code,
            redeemedByUsername: targetUser,
            redeemedAt: new Date().toISOString(),
            docIds: [docId]
          })
        }, { onConflict: 'key' });
      record(!claimKeyRes.error, Date.now() - tClaimKey, claimKeyRes.status);

      const claimTotalTime = Date.now() - claimStart;
      const ok = !updateRes.error && !claimKeyRes.error;
      return { code, user: targetUser, ok, elapsed: claimTotalTime };
    } catch (err) {
      return { code, user: targetUser, ok: false, elapsed: Date.now() - claimStart, error: err.message };
    }
  });

  const claimResults = await Promise.all(claimPromises);
  const phase3Duration = Date.now() - phase3Start;
  const claimFails = claimResults.filter(r => !r.ok).length;
  const avgClaimLatency = Math.round(claimResults.reduce((a, b) => a + b.elapsed, 0) / claimResults.length);
  const maxClaimLatency = Math.max(...claimResults.map(r => r.elapsed));
  console.log(`✅ FASE 3 SELESAI dalam ${phase3Duration}ms:`);
  console.log(`   - Berhasil Klaim Serentak: ${claimResults.length - claimFails}/${claimResults.length}`);
  console.log(`   - Gagal (Lock / 504): ${claimFails}`);
  console.log(`   - Rata-rata Waktu Eksekusi Klaim: ${avgClaimLatency}ms | Paling Lambat: ${maxClaimLatency}ms\n`);

  // Bersihkan data uji coba klaim agar database tetap rapi
  console.log('🧹 Membersihkan dokumen uji coba simulasi dari database...');
  await supabase.from('dokumen').delete().in('id', testDocIds);
  for (const c of testCodes) {
    await supabase.from('pengaturan').delete().eq('key', `redeem_claim_${c}`);
  }
  console.log('✨ Data uji coba berhasil dibersihkan.\n');

  // ---------------------------------------------------------------------------
  // FASE 4: SIMULASI 20 SISWA MENGETIK & AUTO-SAVE BERSAMAAN (3 SIKLUS SIMPAN)
  // ---------------------------------------------------------------------------
  console.log(`[FASE 4] Simulasi 20 Siswa Mengetik & Mengirim Auto-Save Naskah (3 Siklus)...`);

  // Buat 20 dokumen draf uji coba untuk sesi mengetik
  const draftIds = STUDENT_NAMES.slice(0, 20).map(() => randomUUID());
  const initialDrafts = draftIds.map((id, i) => ({
    id,
    judul: `Cerpen Simulasi Kelas - ${STUDENT_NAMES[i]}`,
    teks: `<p>Paragraf awal oleh ${STUDENT_NAMES[i]}.</p>`,
    username: STUDENT_NAMES[i],
    nama: `Siswa ${STUDENT_NAMES[i]}`,
    status: 'Draf',
    waktu_edit: new Date().toISOString()
  }));

  await supabase.from('dokumen').upsert(initialDrafts);

  let totalSavesExecuted = 0;
  let totalSaveErrors = 0;

  for (let cycle = 1; cycle <= 3; cycle++) {
    const cycleStart = Date.now();
    const savePromises = draftIds.map(async (id, idx) => {
      const u = STUDENT_NAMES[idx];
      const start = Date.now();
      const updatedTeks = `<p>Paragraf awal oleh ${u}.</p><p>Kalimat tambahan siklus ${cycle}: Pada suatu hari yang cerah di sekolah, kami menulis bersama dengan tenang dan lancar tanpa kendala jaringan.</p>`;
      try {
        const { error, status } = await supabase
          .from('dokumen')
          .update({
            teks: updatedTeks,
            waktu_edit: new Date().toISOString()
          })
          .eq('id', id);
        const elapsed = Date.now() - start;
        record(!error, elapsed, status);
        totalSavesExecuted++;
        if (error) totalSaveErrors++;
        return { ok: !error, elapsed };
      } catch (err) {
        totalSavesExecuted++;
        totalSaveErrors++;
        record(false, Date.now() - start, 500);
        return { ok: false, elapsed: Date.now() - start };
      }
    });

    await Promise.all(savePromises);
    console.log(`   - Siklus ${cycle}/3: 20 simpan serentak selesai dalam ${Date.now() - cycleStart}ms`);
  }

  // Bersihkan draf simulasi
  await supabase.from('dokumen').delete().in('id', draftIds);
  console.log(`✅ FASE 4 SELESAI: ${totalSavesExecuted - totalSaveErrors}/${totalSavesExecuted} auto-save tersimpan sempurna.\n`);

  // ---------------------------------------------------------------------------
  // LAPORAN AKHIR SIMULASI
  // ---------------------------------------------------------------------------
  console.log('================================================================');
  console.log('📊 RANGKUMAN HASIL AKHIR SIMULASI BEBAN KELAS (25 SISWA SERENTAK)');
  console.log('================================================================');
  console.log(`Total Permintaan HTTP: ${overallResults.totalRequests}`);
  console.log(`Sukses: ${overallResults.successfulRequests} (${Math.round((overallResults.successfulRequests / overallResults.totalRequests) * 100)}%)`);
  console.log(`Gagal: ${overallResults.failedRequests}`);
  console.log(`Error 504 (Gateway Timeout): ${overallResults.status504s}`);
  console.log(`Latensi Rata-rata: ${Math.round(overallResults.latencies.reduce((a, b) => a + b, 0) / overallResults.latencies.length)} ms`);
  console.log(`Latensi Minimum: ${Math.min(...overallResults.latencies)} ms`);
  console.log(`Latensi Maksimum: ${Math.max(...overallResults.latencies)} ms`);
  console.log('================================================================\n');

  if (overallResults.status504s === 0 && overallResults.successfulRequests === overallResults.totalRequests) {
    console.log('🎉 KESIMPULAN: ARSITEKTUR 100% STABIL & SIAP DIGUNAKAN UNTUK 20+ SISWA!');
  } else if (overallResults.status504s === 0) {
    console.log('⚠️ KESIMPULAN: STABIL TANPA TIMEOUT 504, TERDAPAT BEBERAPA PERMINTAAN RINGAN PERLU PERHATIAN.');
  } else {
    console.log('❌ KESIMPULAN: MASIH TERDAPAT TIMEOUT 504.');
  }
}

runSimulation().catch(err => {
  console.error('Fatal Simulation Error:', err);
  process.exit(1);
});
