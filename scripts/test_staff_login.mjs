/**
 * Staff login + employee link UI/API tests
 * Run: node scripts/test_staff_login.mjs
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

function loadEnvFile() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 1) continue;
    const k = t.slice(0, i).trim();
    const v = t.slice(i + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
}

loadEnvFile();

const BASE = process.env.GU_BASE_URL || 'http://localhost:5173';
const API = process.env.GU_API_URL || process.env.GU_API_TARGET?.replace(/\/?$/, '') + '/api/api.php' || 'http://127.0.0.1:8080/api/api.php';
const ADMIN_EMAIL = process.env.GU_ADMIN_EMAIL || 'jgond1992@gmail.com';
const ADMIN_PASSWORD = process.env.GU_ADMIN_PASSWORD || 'Gounlisted@123';
const TEST_EMP_EMAIL = `qa.staff.${Date.now()}@gounlisted.test`;
const TEST_EMP_ID = `GUT${String(Date.now()).slice(-6)}`;
const TEST_EMP_PASS = 'TestPass123';

const pass = [];
const fail = [];

function ok(msg) {
  console.log(`  ✓ ${msg}`);
  pass.push(msg);
}
function bad(msg, detail = '') {
  console.log(`  ✗ ${msg}${detail ? ` — ${detail}` : ''}`);
  fail.push({ msg, detail });
}

async function apiJson(url, opts = {}) {
  const res = await fetch(url, opts);
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { _raw: text, _status: res.status };
  }
  return { status: res.status, json, headers: res.headers };
}

async function testApiPortal() {
  console.log('\n=== API: separate master vs staff login ===');
  console.log(`API: ${API}`);

  const health = await apiJson(`${API}?action=getCsrfToken`);
  if (health.status !== 200) {
    bad('API reachable', `HTTP ${health.status}`);
    return null;
  }
  ok('API reachable');

  const jar = new Map();
  const storeCookie = (res) => {
    const set = res.headers.getSetCookie?.() || [];
    for (const c of set) {
      const [pair] = c.split(';');
      const [k, v] = pair.split('=');
      jar.set(k.trim(), v);
    }
  };
  const cookieHeader = () => [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');

  const csrfRes = await fetch(`${API}?action=checkAuth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  storeCookie(csrfRes);
  const csrfBody = await csrfRes.json();
  const csrf = csrfBody.csrfToken || '';

  // Master on staff portal → rejected
  const masterOnStaff = await fetch(`${API}?action=loginAdmin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookieHeader(), 'X-CSRF-Token': csrf },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD, portal: 'staff' }),
  });
  storeCookie(masterOnStaff);
  const masterOnStaffBody = await masterOnStaff.json();
  if (masterOnStaff.status === 401 && /admin\/login/i.test(masterOnStaffBody.error || '')) {
    ok('Master blocked on staff portal');
  } else {
    bad('Master blocked on staff portal', JSON.stringify(masterOnStaffBody));
  }

  // Master on master portal → ok
  const masterLogin = await fetch(`${API}?action=loginAdmin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookieHeader(), 'X-CSRF-Token': csrf },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD, portal: 'master' }),
  });
  storeCookie(masterLogin);
  const masterBody = await masterLogin.json();
  if (masterBody.success && masterBody.isMaster && masterBody.portal === 'master') {
    ok('Master login on /admin portal');
  } else {
    bad('Master login on /admin portal', JSON.stringify(masterBody));
    return null;
  }

  // Create test employee
  const saveEmp = await fetch(`${API}?action=saveEmployee`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookieHeader(), 'X-CSRF-Token': csrf },
    body: JSON.stringify({
      name: 'QA Staff Test',
      email: TEST_EMP_EMAIL,
      employeeId: TEST_EMP_ID,
      password: TEST_EMP_PASS,
      permissions: ['pending', 'orders'],
    }),
  });
  const saveBody = await saveEmp.json();
  if (saveBody.success) {
    ok(`Test employee created (${TEST_EMP_EMAIL})`);
  } else {
    bad('Create test employee', JSON.stringify(saveBody));
    return jar;
  }

  // Logout master
  await fetch(`${API}?action=logout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookieHeader() },
    body: '{}',
  });
  jar.clear();

  const csrf2Res = await fetch(`${API}?action=checkAuth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  storeCookie(csrf2Res);
  const csrf2 = (await csrf2Res.json()).csrfToken || '';

  // Employee on master portal → rejected
  const empOnMaster = await fetch(`${API}?action=loginAdmin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookieHeader(), 'X-CSRF-Token': csrf2 },
    body: JSON.stringify({ email: TEST_EMP_EMAIL, password: TEST_EMP_PASS, portal: 'master' }),
  });
  const empOnMasterBody = await empOnMaster.json();
  if (empOnMaster.status === 401 && /staff\/login/i.test(empOnMasterBody.error || '')) {
    ok('Employee blocked on master portal');
  } else {
    bad('Employee blocked on master portal', JSON.stringify(empOnMasterBody));
  }

  // Employee on staff portal → ok
  const staffLogin = await fetch(`${API}?action=loginAdmin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookieHeader(), 'X-CSRF-Token': csrf2 },
    body: JSON.stringify({ email: TEST_EMP_EMAIL, password: TEST_EMP_PASS, portal: 'staff' }),
  });
  storeCookie(staffLogin);
  const staffBody = await staffLogin.json();
  if (staffBody.success && !staffBody.isMaster && staffBody.portal === 'staff') {
    ok('Employee login on /staff portal');
  } else {
    bad('Employee login on /staff portal', JSON.stringify(staffBody));
  }

  const auth = await fetch(`${API}?action=checkAuth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookieHeader() },
    body: '{}',
  });
  const authBody = await auth.json();
  if (authBody.authenticated && authBody.portal === 'staff') {
    ok('checkAuth returns portal=staff');
  } else {
    bad('checkAuth portal', JSON.stringify(authBody));
  }

  // Cleanup: re-login master and delete test employee
  await fetch(`${API}?action=logout`, { method: 'POST', headers: { Cookie: cookieHeader() }, body: '{}' });
  jar.clear();
  const csrf3Res = await fetch(`${API}?action=checkAuth`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  storeCookie(csrf3Res);
  const csrf3 = (await csrf3Res.json()).csrfToken || '';
  await fetch(`${API}?action=loginAdmin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookieHeader(), 'X-CSRF-Token': csrf3 },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD, portal: 'master' }),
  });
  const emps = await (await fetch(`${API}?action=getEmployees`, { headers: { Cookie: cookieHeader() } })).json();
  const testEmp = Array.isArray(emps) ? emps.find((e) => e.email === TEST_EMP_EMAIL) : null;
  if (testEmp?.id) {
    await fetch(`${API}?action=deleteEmployee`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieHeader(), 'X-CSRF-Token': csrf3 },
      body: JSON.stringify({ id: testEmp.id }),
    });
    ok('Test employee cleaned up');
  }

  return jar;
}

async function testStaffLoginUi(page) {
  console.log('\n=== UI: login pages + employee link ===');
  console.log(`UI: ${BASE}`);

  await page.goto(`${BASE}/staff/login`, { waitUntil: 'networkidle', timeout: 30000 });
  const staffTitle = await page.locator('h2').first().textContent();
  if (/employee/i.test(staffTitle || '')) ok('Staff login page shows Employee Portal');
  else bad('Staff login page title', staffTitle || 'empty');

  const staffLink = await page.locator('a[href="/admin/login"], a[href*="admin/login"]').count();
  if (staffLink > 0) ok('Staff page links to master login');
  else bad('Staff page master login link missing');

  await page.goto(`${BASE}/admin/login`, { waitUntil: 'networkidle', timeout: 30000 });
  const masterTitle = await page.locator('h2').first().textContent();
  if (/master/i.test(masterTitle || '')) ok('Admin login page shows Master Admin');
  else bad('Admin login page title', masterTitle || 'empty');

  // Master login → employees page → add employee modal shows auto link
  await page.fill('input[autocomplete="username"], input.form-input', ADMIN_EMAIL);
  await page.fill('input[type="password"]', ADMIN_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/admin/, { timeout: 15000 }).catch(() => {});

  await page.goto(`${BASE}/admin#employees`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(800);

  const autoLink = await page.locator('text=/staff\\/login/i').first().isVisible().catch(() => false);
  if (autoLink) ok('Employees page shows auto staff login link');
  else bad('Employees page missing auto staff login link');

  await page.click('button:has-text("Add Employee")');
  await page.waitForSelector('.emp-modal-card, .modal-card', { timeout: 8000 });

  const modalText = await page.locator('.emp-modal-card, .modal-card').innerText();
  if (/staff\/login/i.test(modalText)) ok('Add Employee modal shows auto login link');
  else bad('Add Employee modal missing login link');

  if (/auto-generated|auto/i.test(modalText)) ok('Modal mentions auto-generated link');
  else bad('Modal does not mention auto-generated link');

  await page.fill('input[name="employee-full-name"], .emp-modal-card input.form-input >> nth=0', 'UI Link Test');
  await page.fill('input[name="employee-ref-id"]', 'GUL999');
  await page.fill('input[name="employee-work-email"]', `ui.link.${Date.now()}@test.local`);
  await page.fill('input[name="employee-new-password"]', 'TestPass123');

  const copyBtn = page.locator('button:has-text("Copy details")');
  if (await copyBtn.count()) ok('Copy login details button visible before save');
  else bad('Copy login details button missing in modal');

  await page.click('button[type="submit"]:has-text("Save Employee")');
  await page.waitForTimeout(1500);

  const copyRow = page.locator('button:has-text("Copy login info")').first();
  if (await copyRow.isVisible().catch(() => false)) ok('Employee row shows Copy login info after save');
  else bad('Copy login info not in table after save');
}

async function main() {
  console.log('GO-UNLISTED — Staff login QA');
  await testApiPortal();

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await testStaffLoginUi(page);
  } catch (e) {
    bad('UI test error', String(e.message || e));
  }
  await browser.close();

  console.log('\n==============================================');
  console.log(`PASSED: ${pass.length}  FAILED: ${fail.length}`);
  if (fail.length) {
    console.log('\nFailures:');
    for (const f of fail) console.log(`  - ${f.msg}${f.detail ? `: ${f.detail}` : ''}`);
    process.exit(1);
  }
  console.log('All staff login tests passed.');
}

main();
