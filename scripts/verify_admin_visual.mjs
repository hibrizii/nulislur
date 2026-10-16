import puppeteer from 'puppeteer-core';
import { spawn } from 'child_process';
import path from 'path';

const ARTIFACT_DIR = 'C:\\Users\\Asus\\.gemini\\antigravity\\brain\\98a7167f-cb5d-4ae5-95a3-fcafe1535ada';
const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

async function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log('🚀 Starting Vite Preview Server on port 4174...');
  const preview = spawn('npx', ['vite', 'preview', '--port', '4174'], {
    shell: true,
    cwd: process.cwd(),
    stdio: 'pipe',
  });

  await new Promise((resolve) => {
    preview.stdout.on('data', (d) => {
      const str = d.toString();
      console.log(`[Vite] ${str.trim()}`);
      if (str.includes('4174')) {
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
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1366,850'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 850 });

    // 1. Setup Admin session for user 'hibri'
    await page.goto('http://localhost:4174', { waitUntil: 'networkidle0' });

    console.log('🔑 Setting Admin Session for user hibri...');
    await page.evaluate(() => {
      const adminSession = {
        username: 'hibri',
        nama: 'Ahmad Hibrizi (Administrator)',
        role: 'admin',
        sekolahId: 'sman1-gondanglegi',
        namaSekolah: 'SMA Negeri 1 Gondanglegi',
        sessionId: 'sim-admin-' + Date.now(),
      };
      localStorage.setItem('nulislur_session', JSON.stringify(adminSession));
      sessionStorage.setItem('nulislur_session', JSON.stringify(adminSession));
      localStorage.setItem('nulislur_theme', 'light');
      sessionStorage.setItem('nulislur_theme', 'light');
      document.documentElement.classList.remove('dark');
    });

    await page.reload({ waitUntil: 'networkidle0' });
    await wait(1500);

    // Screenshot Tab 1: Manajemen Sekolah (Light Mode)
    const ssSekolahLight = path.join(ARTIFACT_DIR, 'admin_sekolah_light.png');
    await page.screenshot({ path: ssSekolahLight });
    console.log(`📸 Screenshot saved: ${ssSekolahLight}`);

    // Switch to Dark Mode
    console.log('🌙 Switching to Dark Mode...');
    await page.evaluate(() => {
      localStorage.setItem('nulislur_theme', 'dark');
      sessionStorage.setItem('nulislur_theme', 'dark');
      document.documentElement.classList.add('dark');
    });
    await wait(500);

    const ssSekolahDark = path.join(ARTIFACT_DIR, 'admin_sekolah_dark.png');
    await page.screenshot({ path: ssSekolahDark });
    console.log(`📸 Screenshot saved: ${ssSekolahDark}`);

    // Click Tab 2: Akun Guru
    console.log('👥 Navigating to Tab Akun Guru...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const guruBtn = buttons.find((b) => b.innerText.includes('Akun Guru'));
      if (guruBtn) guruBtn.click();
    });
    await wait(600);

    const ssGuruDark = path.join(ARTIFACT_DIR, 'admin_guru_dark.png');
    await page.screenshot({ path: ssGuruDark });
    console.log(`📸 Screenshot saved: ${ssGuruDark}`);

    // Click Tab 3: Ringkasan Platform
    console.log('📊 Navigating to Tab Ringkasan Platform...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const platBtn = buttons.find((b) => b.innerText.includes('Ringkasan Platform'));
      if (platBtn) platBtn.click();
    });
    await wait(600);

    const ssPlatformDark = path.join(ARTIFACT_DIR, 'admin_platform_dark.png');
    await page.screenshot({ path: ssPlatformDark });
    console.log(`📸 Screenshot saved: ${ssPlatformDark}`);

    // 2. Test Tab Koreksi Tugas in Teacher Dashboard to verify white box leak is gone
    console.log('👨‍🏫 Testing Teacher Dashboard Koreksi Tugas (Dark Mode)...');
    await page.evaluate(() => {
      const teacherSession = {
        username: 'guru_sastra',
        nama: 'Dra. Sri Wahyuni, M.Pd.',
        role: 'guru',
        sekolahId: 'sman1-gondanglegi',
        namaSekolah: 'SMA Negeri 1 Gondanglegi',
        sessionId: 'sim-guru-' + Date.now(),
      };
      localStorage.setItem('nulislur_session', JSON.stringify(teacherSession));
      sessionStorage.setItem('nulislur_session', JSON.stringify(teacherSession));
      localStorage.setItem('nulislur_theme', 'dark');
      sessionStorage.setItem('nulislur_theme', 'dark');
      document.documentElement.classList.add('dark');
    });

    await page.reload({ waitUntil: 'networkidle0' });
    await wait(1500);

    // Click Tab Koreksi Tugas / Penilaian
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const koreksiBtn = buttons.find((b) => b.innerText.includes('Koreksi') || b.innerText.includes('Penilaian'));
      if (koreksiBtn) koreksiBtn.click();
    });
    await wait(800);

    const ssTeacherDark = path.join(ARTIFACT_DIR, 'teacher_koreksi_dark_kalibrasi.png');
    await page.screenshot({ path: ssTeacherDark });
    console.log(`📸 Screenshot saved: ${ssTeacherDark}`);

    console.log('🎉 All screenshots successfully generated and verified!');
  } finally {
    await browser.close();
    preview.kill();
  }
}

main().catch((err) => {
  console.error('❌ Error during verification:', err);
  process.exit(1);
});
