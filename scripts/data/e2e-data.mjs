// BK3: test przeglądarkowy SupabaseProvider (build z VITE_AUTH_MODE=supabase pod BASE).
// Bez wysyłki e-maili (generate_link). Sprawdza: dane z serwera wg RLS, brak danych demo,
// magazyn v2 (demo) nie jest czytany ani wysyłany, zapis z UI (czat) trafia na serwer.
// Wymaga fixture z tests/supabase-provider.live.test.ts (TEST-BK3-A/B).
// Użycie: node scripts/data/e2e-data.mjs
import { chromium } from '@playwright/test';
import { loadEnvLocal, need, TEST_ACCOUNTS } from '../auth/env.mjs';

const env = loadEnvLocal();
need(env, ['VITE_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', ...TEST_ACCOUNTS.map((a) => a.key)]);
const BASE = process.env.BK3_BASE ?? 'http://127.0.0.1:4178/';
const sb = env.VITE_SUPABASE_URL.replace(/\/$/, '');
const SR = env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: SR, Authorization: `Bearer ${SR}`, 'Content-Type': 'application/json' };
const DEMO_KEY = 'watch-tower-ui-v6-ready-gate';
let pass = 0, fail = 0;
const check = (n, c) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };
const email = (org) => env[TEST_ACCOUNTS.find((a) => a.org === org).key].toLowerCase();

async function magicFragment(addr) {
  const g = await fetch(`${sb}/auth/v1/admin/generate_link`, { method: 'POST', headers: H, body: JSON.stringify({ type: 'magiclink', email: addr }) }).then((r) => r.json());
  const r = await fetch(g.action_link ?? g.properties?.action_link, { redirect: 'manual' });
  const loc = r.headers.get('location') ?? '';
  return loc.slice(loc.indexOf('#'));
}
const ids = await fetch(`${sb}/rest/v1/loads?select=id,order_no&order_no=in.(TEST-BK3-A,TEST-BK3-B)`, { headers: H }).then((r) => r.json());
const idA = ids.find((x) => x.order_no === 'TEST-BK3-A')?.id;
check('fixture TEST-BK3-A/B istnieje', Boolean(idA) && ids.length === 2);

const browser = await chromium.launch();
async function login(org, { seedDemo = false } = {}) {
  const ctx = await browser.newContext();
  if (seedDemo) {
    await ctx.addInitScript(([k]) => {
      if (!localStorage.getItem(k)) localStorage.setItem(k, JSON.stringify({ state: { role: 'HHL', loads: [{ id: 'load-001', code: 'DEMO-LEAK' }] }, version: 1 }));
    }, [DEMO_KEY]);
  }
  const page = await ctx.newPage();
  const writes = [];
  page.on('request', (r) => { if (r.url().includes('/rest/v1/') && r.method() !== 'GET') writes.push(`${r.method()} ${r.url()} ${r.postData() ?? ''}`); });
  await page.goto(BASE + (await magicFragment(email(org))));
  await page.waitForSelector('[data-auth="session"]', { timeout: 30000 });
  return { ctx, page, writes };
}
async function scheduleText(page) {
  await page.keyboard.press('h');
  await page.waitForTimeout(800);
  return page.locator('main').innerText();
}

try {
  const scx = await login('SCX', { seedDemo: true });
  const t = await scheduleText(scx.page);
  check('SCX: widzi swój transport TEST-BK3-A', t.includes('TEST-BK3-A'));
  check('SCX: nie widzi TEST-BK3-B (RLS)', !t.includes('TEST-BK3-B'));
  check('SCX: brak danych demo (SG-01 / DEMO-LEAK)', !t.includes('SG-01') && !t.includes('DEMO-LEAK'));
  // zapis z UI: czat w szufladzie transportu
  const tag = `bk3-ui-${Date.now()}`;
  await scx.page.locator(`tr[data-load="${idA}"]`).first().click();
  await scx.page.locator('aside').getByRole('button', { name: /Ustalenia/ }).first().click();
  await scx.page.fill('input[placeholder="Napisz do pozostałych stron…"]', tag);
  await scx.page.locator('form.chatbar button[type=submit]').click();
  let row = null;
  for (let i = 0; i < 20 && !row; i++) {
    await new Promise((r) => setTimeout(r, 500));
    const rows = await fetch(`${sb}/rest/v1/load_messages?select=id,author_org,load_id&body=eq.${encodeURIComponent(tag)}`, { headers: H }).then((r) => r.json());
    row = rows[0] ?? null;
  }
  check('SCX: wiadomość z UI zapisana na serwerze (author_org=SCX)', row?.author_org === 'SCX' && row?.load_id === idA);
  if (row) await fetch(`${sb}/rest/v1/load_messages?id=eq.${row.id}`, { method: 'DELETE', headers: H });
  check('Żaden zapis nie zawiera danych/id demo', scx.writes.length > 0 && scx.writes.every((w) => !/load-0\d\d|DEMO-LEAK|"SG-\d/.test(w)));
  const ls = await scx.page.evaluate((k) => ({ demo: localStorage.getItem(k), sb: localStorage.getItem(`${k}-supabase`) }), DEMO_KEY);
  check('Magazyn v2 (demo) nietknięty, klucz Supabase bez danych', (ls.demo ?? '').includes('DEMO-LEAK') && !(ls.sb ?? '').includes('"loads"'));
  await scx.ctx.close();

  const hhl = await login('HHL');
  const th = await scheduleText(hhl.page);
  check('HHL: widzi TEST-BK3-A i TEST-BK3-B', th.includes('TEST-BK3-A') && th.includes('TEST-BK3-B'));
  await hhl.page.screenshot({ path: '/tmp/bk3-e2e-hhl-schedule.png' });
  await hhl.ctx.close();

  const ksh = await login('KSH');
  const tk = await scheduleText(ksh.page);
  check('KSH: widzi oba transporty projektu (klient)', tk.includes('TEST-BK3-A') && tk.includes('TEST-BK3-B'));
  await ksh.ctx.close();
} finally { await browser.close(); }
console.log(`\nBK3 e2e: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
