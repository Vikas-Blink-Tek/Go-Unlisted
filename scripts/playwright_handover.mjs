/**
 * Playwright smoke — desktop + mobile viewports
 * Run: node scripts/playwright_handover.mjs
 * Requires: npx playwright install chromium (once)
 */
import { chromium, devices } from 'playwright';

const BASE = process.env.GU_BASE_URL || 'http://localhost:5173';
const ADMIN_EMAIL = process.env.GU_ADMIN_EMAIL || '';
const ADMIN_PASSWORD = process.env.GU_ADMIN_PASSWORD || '';
const results = { pass: 0, fail: 0, issues: [] };

function ok(msg) {
  console.log(`  ✓ ${msg}`);
  results.pass++;
}

function bad(msg, detail = '') {
  console.log(`  ✗ ${msg}${detail ? ` — ${detail}` : ''}`);
  results.fail++;
  results.issues.push({ msg, detail });
}

async function checkPage(page, name, path, checks) {
  try {
    const res = await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle', timeout: 30000 });
    if (!res || res.status() !== 200) {
      bad(`${name} loads`, `HTTP ${res?.status()}`);
      return;
    }
    ok(`${name} loads (${path})`);
    for (const [label, fn] of checks) {
      try {
        const pass = await fn(page);
        if (pass) ok(`${name}: ${label}`);
        else bad(`${name}: ${label}`);
      } catch (e) {
        bad(`${name}: ${label}`, String(e.message || e));
      }
    }
  } catch (e) {
    bad(`${name} navigation`, String(e.message || e));
  }
}

async function runViewport(deviceName, contextOptions) {
  console.log(`\n=== ${deviceName} ===`);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();

  await checkPage(page, 'Homepage', '/', [
    ['header visible', async (p) => (await p.locator('header, .header, nav').first().isVisible())],
    ['market activity or hero', async (p) => {
      const n = await p.locator('.market-scroll-viewport, .hero, [class*="hero"]').count();
      return n > 0;
    }],
    ['market cards not clipped', async (p) => {
      const card = p.locator('.market-activity-card, [class*="market"]').first();
      if ((await card.count()) === 0) return true;
      const box = await card.boundingBox();
      if (!box) return false;
      return box.height >= 80 && box.width > 0;
    }],
    ['no horizontal overflow', async (p) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2)],
  ]);

  await checkPage(page, 'Shares list', '/shares', [
    ['share cards', async (p) => (await p.locator('.share-card, [class*="share"]').count()) > 0],
    ['no horizontal overflow', async (p) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2)],
  ]);

  await checkPage(page, 'Share detail', '/shares/phonepe', [
    ['company name', async (p) => (await p.locator('h1, .share-detail, [class*="detail"]').count()) > 0],
    ['no horizontal overflow', async (p) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2)],
  ]);

  await checkPage(page, 'Admin login', '/admin/login', [
    ['login form', async (p) => (await p.locator('input[type="password"], form').count()) > 0],
  ]);

  // Login admin (optional — set GU_ADMIN_EMAIL / GU_ADMIN_PASSWORD)
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    bad(`${deviceName}: admin login flow`, 'Set GU_ADMIN_EMAIL and GU_ADMIN_PASSWORD');
  } else try {
    await page.goto(`${BASE}/admin/login`, { waitUntil: 'networkidle' });
    await page.fill('input[type="email"], input[autocomplete="username"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForSelector('.admin-app, .admin-sidebar', { timeout: 15000 });
    ok(`${deviceName}: admin login → dashboard`);

    await page.goto(`${BASE}/admin#prices`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.admin-topbar-title', { timeout: 10000 });
    const title = await page.locator('.admin-topbar-title').textContent();
    if (title?.includes('Stocks')) ok(`${deviceName}: admin prices panel`);
    else bad(`${deviceName}: admin prices panel`, `title="${title}"`);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 4);
    if (overflow) ok(`${deviceName}: admin no horizontal overflow`);
    else bad(`${deviceName}: admin horizontal overflow`);
  } catch (e) {
    bad(`${deviceName}: admin login flow`, String(e.message || e));
  }

  await browser.close();
}

console.log('==============================================');
console.log('GO UNLISTED — Playwright UI QA');
console.log(`Base: ${BASE}`);
console.log('==============================================');

await runViewport('Desktop (1280px)', { viewport: { width: 1280, height: 800 } });

const iphone = devices['iPhone 13'];
await runViewport('Mobile (iPhone 13)', {
  ...iphone,
  viewport: iphone.viewport,
});

const android = devices['Pixel 7'];
await runViewport('Mobile (Pixel 7)', {
  ...android,
  viewport: android.viewport,
});

console.log('\n==============================================');
console.log(`UI QA: ${results.pass} passed, ${results.fail} failed`);
console.log('==============================================');
process.exit(results.fail > 0 ? 1 : 0);
