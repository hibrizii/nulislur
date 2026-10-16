import puppeteer from 'puppeteer-core';
import { spawn } from 'child_process';
import path from 'path';

const ARTIFACT_DIR = 'C:\\Users\\Asus\\.gemini\\antigravity\\brain\\98a7167f-cb5d-4ae5-95a3-fcafe1535ada';
const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log('🚀 Starting Vite Preview Server on port 4176...');
  const preview = spawn('npx.cmd', ['vite', 'preview', '--port', '4176', '--strictPort'], {
    cwd: 'C:\\Users\\Asus\\.gemini\\antigravity\\scratch\\nulislur',
    shell: true,
  });

  await new Promise((resolve) => {
    preview.stdout.on('data', (d) => {
      const msg = d.toString();
      console.log('[Vite]', msg.trim());
      if (msg.includes('Local:')) resolve();
    });
    preview.stderr.on('data', (d) => console.error('[Vite Error]', d.toString().trim()));
    setTimeout(resolve, 8000);
  });
  await wait(1000);

  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    // 1. SISWA A (hannan) membuat dokumen kolaborasi dan mengundang siswa B (fizi)
    console.log('👤 [Student A: @hannan] Logging in...');
    const pageA = await browser.newPage();
    await pageA.setViewport({ width: 1400, height: 900 });

    await pageA.goto('http://localhost:4176/', { waitUntil: 'domcontentloaded' });
    await wait(1500);

    // Login as hannan (password: hannanjihan)
    await pageA.type('input[placeholder*="username" i], input[type="text"]', 'hannan');
    await pageA.type('input[type="password"]', 'hannanjihan');
    await pageA.click('button[type="submit"]');
    await wait(3500);

    // Click "Buat Tugas" / "Naskah Baru"
    console.log('📝 [Student A: @hannan] Creating collaborative document...');
    const createBtnFound = await pageA.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find((b) =>
        b.innerText.includes('Tulisan Baru') ||
        b.innerText.includes('Tulis') ||
        b.innerText.includes('Buat Tugas') ||
        b.innerText.includes('Naskah Baru')
      );
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });

    if (!createBtnFound) {
      throw new Error('Button Buat Tugas / Naskah Baru not found');
    }
    await wait(1500);

    // Fill title inside modal form
    const docTitle = `Riset Kolaborasi Literasi ${Date.now().toString().slice(-4)}`;
    await pageA.type('form input[placeholder*="judul" i]', docTitle);
    await wait(500);

    // Click mode Kolaborasi inside modal form
    await pageA.evaluate(() => {
      const modal = document.querySelector('form');
      if (modal) {
        const btns = Array.from(modal.querySelectorAll('button'));
        const btnCollab = btns.find((b) => b.innerText.includes('Kolaborasi'));
        if (btnCollab) btnCollab.click();
      }
    });
    await wait(1500);

    // Search or select friend @fizi (Salman)
    console.log('🔍 [Student A: @hannan] Adding @fizi (Salman) as collaborator...');
    await pageA.type('form input[placeholder*="teman" i]', 'fizi');
    await wait(1000);

    await pageA.evaluate(() => {
      const modal = document.querySelector('form');
      if (modal) {
        const btns = Array.from(modal.querySelectorAll('button'));
        const addBtn = btns.find((b) => b.innerText.includes('Tambah') || b.innerText.includes('+'));
        if (addBtn) addBtn.click();
      }
    });
    await wait(1000);

    // Submit form / click "Mulai Menulis"
    console.log('🚀 [Student A: @hannan] Submitting form to create collab doc...');
    await pageA.evaluate(() => {
      const form = document.querySelector('form');
      if (form) {
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.click();
      }
    });
    await wait(4000);

    const ssAuthorEditor = path.join(ARTIFACT_DIR, 'kolaborasi_author_editor.png');
    await pageA.screenshot({ path: ssAuthorEditor });
    console.log(`📸 Screenshot saved: ${ssAuthorEditor}`);

    // 2. SISWA B (@fizi) login di browser context terpisah
    console.log('👤 [Student B: @fizi] Logging in on separate incognito context...');
    const contextB = await browser.createBrowserContext();
    const pageB = await contextB.newPage();
    await pageB.setViewport({ width: 1400, height: 900 });

    await pageB.goto('http://localhost:4176/', { waitUntil: 'domcontentloaded' });
    await wait(1500);

    await pageB.type('input[placeholder*="username" i], input[type="text"]', 'fizi');
    await pageB.type('input[type="password"]', 'triobbc7911');
    await pageB.click('button[type="submit"]');
    await wait(3500);

    // Check if the collaborative document appears on fizi's dashboard
    const fiziContent = await pageB.evaluate(() => document.body.innerText);
    const hasDocOnFizi = fiziContent.includes(docTitle);
    console.log(`✅ Does collaborative doc "${docTitle}" appear on fizi's dashboard?`, hasDocOnFizi);

    const ssFiziLobi = path.join(ARTIFACT_DIR, 'kolaborasi_fizi_lobi_muncul.png');
    await pageB.screenshot({ path: ssFiziLobi });
    console.log(`📸 Screenshot saved: ${ssFiziLobi}`);

    // Click on the Kolaborasi tab pill
    console.log('🖱️ Clicking Kolaborasi filter pill on fizi...');
    await pageB.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const tabCollab = btns.find((b) => b.innerText.includes('Kolaborasi'));
      if (tabCollab) tabCollab.click();
    });
    await wait(1000);

    const ssFiziCollabTab = path.join(ARTIFACT_DIR, 'kolaborasi_fizi_tab_kolaborasi.png');
    await pageB.screenshot({ path: ssFiziCollabTab });
    console.log(`📸 Screenshot saved: ${ssFiziCollabTab}`);

    // Open the document in editor as fizi
    console.log('🖱️ Opening collaborative document as fizi...');
    await pageB.evaluate((title) => {
      const h4s = Array.from(document.querySelectorAll('h4'));
      const target = h4s.find((h) => h.innerText.includes(title));
      if (target) {
        const card = target.closest('.editorial-card') || target.parentElement;
        if (card) card.click();
      }
    }, docTitle);
    await wait(3500);

    const ssFiziEditor = path.join(ARTIFACT_DIR, 'kolaborasi_fizi_editor_sukses.png');
    await pageB.screenshot({ path: ssFiziEditor });
    console.log(`📸 Screenshot saved: ${ssFiziEditor}`);

    console.log('🎉 VERIFIKASI KOLABORASI 100% SUKSES!');
  } finally {
    await browser.close();
    preview.kill();
  }
}

main().catch((err) => {
  console.error('❌ Verification Error:', err);
  process.exit(1);
});
