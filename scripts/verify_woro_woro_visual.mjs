import puppeteer from 'puppeteer-core';
import { spawn } from 'child_process';
import path from 'path';

const ARTIFACT_DIR = 'C:\\Users\\Asus\\.gemini\\antigravity\\brain\\98a7167f-cb5d-4ae5-95a3-fcafe1535ada';
const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

async function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log('🚀 Starting Vite Preview Server on port 4173...');
  const preview = spawn('npx', ['vite', 'preview', '--port', '4173'], {
    shell: true,
    cwd: process.cwd(),
    stdio: 'pipe',
  });

  await new Promise((resolve) => {
    preview.stdout.on('data', (d) => {
      const str = d.toString();
      console.log(`[Vite] ${str.trim()}`);
      if (str.includes('4173')) {
        resolve();
      }
    });
  });
  preview.stderr.on('data', (d) => console.error(`[Vite Error] ${d.toString().trim()}`));
  await wait(1000);

  console.log('🌐 Launching Microsoft Edge...');
  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,900'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });

    // Navigate to initialize origin
    await page.goto('http://localhost:4173', { waitUntil: 'networkidle0' });

    console.log('🔑 Setting Student Session & Seed Woro-woro...');
    await page.evaluate(() => {
      const studentSession = {
        username: 'haidhar',
        nama: 'HAIDHAR AWWALAN PUTRA LUSIDA',
        role: 'siswa',
        kodeKelas: 'xpzwzj',
        sessionId: 'sim-' + Date.now(),
      };
      localStorage.setItem('nulislur_session', JSON.stringify(studentSession));
      sessionStorage.setItem('nulislur_session', JSON.stringify(studentSession));

      // Inject demo woro-woro with super long URLs and links if local database exists
      const localDB = JSON.parse(localStorage.getItem('nulislur_offline_cache') || '{}');
      if (!localDB.pengumuman) localDB.pengumuman = [];

      localDB.pengumuman.unshift({
        id: 'woro-demo-test-url',
        teks: 'Anak-anak kelas 11 STEAM, silakan baca format panduan bab 2 di tautan ini: https://docs.google.com/document/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit?usp=sharing dan contoh penulisan di https://drive.google.com/file/d/1verylongdrivedocumenturlsampleexampletestingoverflowbreakword/view',
        waktu: 'Baru saja',
        kodeKelas: 'xpzwzj',
        tugasId: null,
      });

      localStorage.setItem('nulislur_offline_cache', JSON.stringify(localDB));
    });

    // 1. Screenshot Light Mode
    console.log('📸 Taking Light Mode screenshot...');
    await page.evaluate(() => {
      localStorage.setItem('nulislur_theme', 'light');
      sessionStorage.setItem('nulislur_theme', 'light');
      document.documentElement.classList.remove('dark');
    });

    await page.reload({ waitUntil: 'networkidle0' });
    await wait(2000);

    const lightPath = path.join(ARTIFACT_DIR, 'woro_woro_pastel_light.png');
    await page.screenshot({ path: lightPath, fullPage: false });
    console.log(`✅ Saved Light Mode screenshot: ${lightPath}`);

    // 2. Screenshot Dark Mode
    console.log('📸 Taking Dark Mode screenshot...');
    await page.evaluate(() => {
      localStorage.setItem('nulislur_theme', 'dark');
      sessionStorage.setItem('nulislur_theme', 'dark');
      document.documentElement.classList.add('dark');
    });

    await wait(1000);
    const darkPath = path.join(ARTIFACT_DIR, 'woro_woro_pastel_dark.png');
    await page.screenshot({ path: darkPath, fullPage: false });
    console.log(`✅ Saved Dark Mode screenshot: ${darkPath}`);

  } catch (err) {
    console.error('Error during screenshot capture:', err);
  } finally {
    await browser.close();
    preview.kill();
    console.log('🏁 Verification finished.');
    process.exit(0);
  }
}

main();
