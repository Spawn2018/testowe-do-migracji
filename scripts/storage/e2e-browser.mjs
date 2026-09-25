// BK4: test przeglądarkowy plików (build z VITE_AUTH_MODE=supabase pod BASE, domyślnie :4178).
// SCX wgrywa PDF w szufladzie transportu → plik w prywatnym koszyku → podgląd linkiem
// podpisanym (15 min); KSH otwiera ten sam plik; w localStorage brak bajtów pliku.
// Sprzątanie service role: wyłącznie plik i wiersz documents z tego przebiegu.
// Wymaga fixture TEST-BK3-A (tests/supabase-provider.live.test.ts). Bez wysyłki e-maili.
// Użycie: node scripts/storage/e2e-browser.mjs
import { chromium } from '@playwright/test';
import { loadEnvLocal, need, TEST_ACCOUNTS } from '../auth/env.mjs';

const env = loadEnvLocal();
need(env, ['VITE_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', ...TEST_ACCOUNTS.map((a) => a.key)]);
const BASE = process.env.BK4_BASE ?? 'http://127.0.0.1:4178/';
const sb = env.VITE_SUPABASE_URL.replace(/\/$/, '');
const SR = env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: SR, Authorization: `Bearer ${SR}`, 'Content-Type': 'application/json' };
let pass = 0, fail = 0;
const check = (n, c) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };
const email = (org) => env[TEST_ACCOUNTS.find((a) => a.org === org).key].toLowerCase();

async function magicFragment(addr) {
  const g = await fetch(`${sb}/auth/v1/admin/generate_link`, { method: 'POST', headers: H, body: JSON.stringify({ type: 'magiclink', email: addr }) }).then((r) => r.json());
  const r = await fetch(g.action_link ?? g.properties?.action_link, { redirect: 'manual' });
  const loc = r.headers.get('location') ?? '';
  return loc.slice(loc.indexOf('#'));
}
const ids = await fetch(`${sb}/rest/v1/loads?select=id,order_no&order_no=eq.TEST-BK3-A`, { headers: H }).then((r) => r.json());
const idA = ids[0]?.id;
check('fixture TEST-BK3-A istnieje', Boolean(idA));

const browser = await chromium.launch();
async function login(org) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(BASE + (await magicFragment(email(org))));
  await page.waitForSelector('[data-auth="session"]', { timeout: 30000 });
  await page.keyboard.press('h');
  await page.waitForTimeout(800);
  return { ctx, page };
}
async function openDocsTab(page) {
  await page.locator(`tr[data-load="${idA}"]`).first().click();
  await page.locator('aside .dtabs button').filter({ hasText: /Dokumenty/ }).first().click();
}

const name = `BK4-e2e-${Date.now()}.pdf`;
const body = `%PDF-1.4\n% ${name}\n%%EOF\n`;
let doc = null;
try {
  const scx = await login('SCX');
  await openDocsTab(scx.page);
  await scx.page.locator('aside input[type=file]').setInputFiles({ name, mimeType: 'application/pdf', buffer: Buffer.from(body) });
  for (let i = 0; i < 30 && !doc; i++) {
    await new Promise((r) => setTimeout(r, 500));
    const rows = await fetch(`${sb}/rest/v1/documents?select=id,storage_path,load_id,category,uploaded_by&file_name=eq.${encodeURIComponent(name)}`, { headers: H }).then((r) => r.json());
    doc = rows[0] ?? null;
  }
  check('SCX: wgranie z szuflady → wiersz documents (CMR, transport A)', doc?.load_id === idA && doc?.category === 'CMR');
  check('ścieżka nadana przez serwer w koszyku dokumenty', Boolean(doc?.storage_path?.startsWith(`dokumenty/`) && doc.storage_path.includes(`/${idA}/${doc.id}/`)));
  const [bucket, ...rest] = (doc?.storage_path ?? '/').split('/');
  const obj = await fetch(`${sb}/storage/v1/object/${bucket}/${rest.join('/')}`, { headers: H });
  check('plik jest w Storage (treść zgodna)', obj.status === 200 && (await obj.text()).includes(name));
  await scx.page.waitForTimeout(500);
  const row = scx.page.locator('aside .docrow-name', { hasText: name });
  check('SCX: plik na liście dokumentów w szufladzie', (await row.count()) > 0);
  await row.first().click();
  const frame = scx.page.locator('.docpreview iframe');
  await frame.waitFor({ timeout: 15000 });
  const src = await frame.getAttribute('src');
  check('SCX: podgląd = link podpisany Storage', Boolean(src?.includes('/storage/v1/object/sign/dokumenty/')));
  check('podgląd oznaczony „link ważny 15 min”', (await scx.page.locator('.docpreview .panel-hd .sub').innerText()).includes('link ważny 15 min'));
  const ls = await scx.page.evaluate(() => Object.keys(localStorage).map((k) => localStorage.getItem(k) ?? '').join('\n'));
  check('localStorage bez bajtów pliku i bez linku podpisanego', !ls.includes('data:application/pdf') && !ls.includes('/object/sign/'));
  await scx.page.screenshot({ path: '/tmp/bk4-e2e-scx-preview.png' });
  await scx.ctx.close();

  const ksh = await login('KSH');
  await openDocsTab(ksh.page);
  const krow = ksh.page.locator('aside .docrow-name', { hasText: name });
  check('KSH: widzi CMR transportu projektu', (await krow.count()) > 0);
  if (await krow.count()) {
    await krow.first().click();
    const kframe = ksh.page.locator('.docpreview iframe');
    await kframe.waitFor({ timeout: 15000 });
    const ksrc = await kframe.getAttribute('src');
    const res = ksrc ? await fetch(ksrc) : null;
    check('KSH: link podpisany zwraca plik (HTTP 200)', res?.status === 200 && (await res.text()).includes(name));
  }
  await ksh.ctx.close();
} finally {
  await browser.close();
  if (doc) {
    const [bucket, ...rest] = doc.storage_path.split('/');
    await fetch(`${sb}/storage/v1/object/${bucket}`, { method: 'DELETE', headers: H, body: JSON.stringify({ prefixes: [rest.join('/')] }) });
    await fetch(`${sb}/rest/v1/documents?id=eq.${doc.id}`, { method: 'DELETE', headers: H });
    console.log('sprzątanie: plik i wiersz documents z tego przebiegu usunięte');
  }
}
console.log(`\nBK4 e2e: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
