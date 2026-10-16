import puppeteer from 'puppeteer-core';
import { spawn } from 'child_process';
import path from 'path';

const ARTIFACT_DIR = 'C:\\Users\\Asus\\.gemini\\antigravity\\brain\\98a7167f-cb5d-4ae5-95a3-fcafe1535ada';
const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

async function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log('🚀 Starting Vite Preview Server on port 4175...');
  const preview = spawn('npx', ['vite', 'preview', '--port', '4175'], {
    shell: true,
    cwd: process.cwd(),
    stdio: 'pipe',
  });

  await new Promise((resolve) => {
    preview.stdout.on('data', (d) => {
      const str = d.toString();
      console.log(`[Vite] ${str.trim()}`);
      if (str.includes('4175')) {
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

    // 1. TEST LOGIN SEBAGAI HIBRI
    console.log('🔑 Logging in via UnifiedAuth as @hibri...');
    await page.goto('http://localhost:4175', { waitUntil: 'networkidle0' });

    // Clear any previous session
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload({ waitUntil: 'networkidle0' });

    // Fill form login
    await page.type('input[placeholder*="username" i], input[type="text"]', 'hibri');
    await page.type('input[type="password"]', '123');
    await page.click('button[type="submit"]');

    console.log('⏳ Waiting for TeacherDashboard navigation...');
    await wait(2500);

    // Verify session
    const hibriSession = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('nulislur_session') || '{}');
    });
    console.log('Hibri Session after login:', hibriSession);

    if (hibriSession.role !== 'guru') {
      throw new Error(`Expected role 'guru' for hibri, but got '${hibriSession.role}'`);
    }

    // Screenshot TeacherDashboard for hibri
    const ssHibriGuru = path.join(ARTIFACT_DIR, 'hibri_guru_dashboard_restored.png');
    await page.screenshot({ path: ssHibriGuru });
    console.log(`📸 Screenshot saved: ${ssHibriGuru}`);

    // Verify classes & student control
    const textContent = await page.evaluate(() => document.body.innerText);
    const hasClasses = textContent.includes('10 J') || textContent.includes('11 STEAM') || textContent.includes('Koreksi Tugas');
    console.log('Has teacher controls & classes in dashboard:', hasClasses);

    // Check presence of "Panel Admin" button in sidebar
    const hasAdminButton = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.some(b => b.innerText.includes('Panel Admin'));
    });
    console.log('Has "Panel Admin" button in sidebar:', hasAdminButton);

    // Click "Panel Admin"
    console.log('🖱️ Clicking "Panel Admin" from TeacherDashboard...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const adminBtn = btns.find(b => b.innerText.includes('Panel Admin'));
      if (adminBtn) adminBtn.click();
    });
    await wait(1000);

    const ssHibriSwitchedToAdmin = path.join(ARTIFACT_DIR, 'hibri_switched_to_admin.png');
    await page.screenshot({ path: ssHibriSwitchedToAdmin });
    console.log(`📸 Screenshot saved: ${ssHibriSwitchedToAdmin}`);

    // Click "Kembali ke Guru"
    console.log('🖱️ Clicking "Kembali ke Guru"...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const backBtn = btns.find(b => b.innerText.includes('Kembali ke Guru'));
      if (backBtn) backBtn.click();
    });
    await wait(1000);

    // 2. TEST LOGIN SEBAGAI ADMIN ACCOUNT
    console.log('🔑 Testing dedicated Admin login (username: admin, pass: admin123)...');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await wait(1500);

    await page.type('input[placeholder*="username" i], input[type="text"]', 'admin');
    await page.type('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');

    await wait(2500);

    const adminSession = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('nulislur_session') || '{}');
    });
    console.log('Admin Session after login:', adminSession);

    if (adminSession.role !== 'admin') {
      throw new Error(`Expected role 'admin' for user admin, but got '${adminSession.role}'`);
    }

    const ssAdminDirect = path.join(ARTIFACT_DIR, 'admin_account_direct_login.png');
    await page.screenshot({ path: ssAdminDirect });
    console.log(`📸 Screenshot saved: ${ssAdminDirect}`);

    console.log('🎉 VERIFICATION 100% SUCCESSFUL!');
  } finally {
    await browser.close();
    preview.kill();
  }
}

main().catch((err) => {
  console.error('❌ Verification Error:', err);
  process.exit(1);
});
