const SUPABASE_URL = 'https://ttxmnzvsjjrfyinfglwi.supabase.co';
const KEY = 'sb_publishable_dJBlRtovn2Ec889dK-Vftw_AL2m93Pz';

async function main() {
  const initialSchools = [
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

  const res = await fetch(`${SUPABASE_URL}/rest/v1/pengaturan`, {
    method: 'POST',
    headers: {
      'apikey': KEY,
      'Authorization': `Bearer ${KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates'
    },
    body: JSON.stringify({
      key: 'sekolah_list',
      val: JSON.stringify(initialSchools)
    })
  });
  console.log('Seed sekolah_list status:', res.status);
}
main();
