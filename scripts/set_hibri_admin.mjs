const SUPABASE_URL = 'https://ttxmnzvsjjrfyinfglwi.supabase.co';
const KEY = 'sb_publishable_dJBlRtovn2Ec889dK-Vftw_AL2m93Pz';

async function main() {
  const settingRes = await fetch(`${SUPABASE_URL}/rest/v1/pengaturan`, {
    method: 'POST',
    headers: {
      'apikey': KEY,
      'Authorization': `Bearer ${KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates'
    },
    body: JSON.stringify({
      key: 'admin_users',
      val: JSON.stringify(['hibri', 'admin'])
    })
  });
  console.log('Pengaturan admin_users upsert status:', settingRes.status);
  
  // Verify reading it back
  const readRes = await fetch(`${SUPABASE_URL}/rest/v1/pengaturan?key=eq.admin_users`, {
    headers: {
      'apikey': KEY,
      'Authorization': `Bearer ${KEY}`
    }
  });
  console.log('Verified admin_users:', await readRes.json());
}
main();
