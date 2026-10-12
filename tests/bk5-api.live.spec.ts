/**
 * BK5 — test widoczności na poziomie API (Playwright, trzy konta testowe, hostowany Supabase).
 * Sprawdzana jest ODPOWIEDŹ SIECIOWA, nie ekran:
 *  - przegląd WSZYSTKICH tabel/widoków PostgREST (lista z OpenAPI) + Storage dla każdego konta:
 *    KSH nigdy nie dostaje kosztu (load_cost), faktury kosztowej, jej pozycji ani dokumentów;
 *    SCX nigdy przychodu (load_revenue) ani faktury przychodowej; HHL widzi obie (kontrola dodatnia);
 *  - ruch sieciowy aplikacji (build VITE_AUTH_MODE=supabase na :4178) — te same zakazy;
 *  - AN1/AN2: przewoźnik zmieniający nr zlecenia HHL / KSH albo okna planowe dostaje BŁĄD, wartość bez zmian.
 * Uruchomienie: SUPABASE_LIVE=1 npx playwright test tests/bk5-api.live.spec.ts
 * (bez SUPABASE_LIVE=1 pomijany). Dane testowe TEST-BK5-* tworzone i usuwane w tym przebiegu
 * (service role wyłącznie do fixture/sprzątania). Bez wysyłki e-maili (generate_link).
 */
import { test, expect, request as pwRequest, type APIRequestContext } from '@playwright/test';
import { loadEnvLocal, ensureLiveFiveRoles, accountEmail, TEST_ACCOUNTS } from '../scripts/auth/env.mjs';

const LIVE = process.env.SUPABASE_LIVE === '1';
const APP = process.env.BK5_BASE ?? 'http://127.0.0.1:4178/';
type Org = 'HHL' | 'KSH' | 'SCX';
const ORGS: Org[] = ['HHL', 'KSH', 'SCX'];
const ENV_KEY: Record<Org, string> = { HHL: 'TEST_USER_HHL_EMAIL', KSH: 'TEST_USER_KSH_EMAIL', SCX: 'TEST_USER_SCX_EMAIL' };

// Wartości-wartowniki: występują WYŁĄCZNIE w danych kosztowych / przychodowych fixture.
const COST = { amount: '7717.71', inv: 'TEST-BK5-SCX-KOSZT', line: '7707.07' };
const REV = { amount: '8818.81', inv: 'TEST-BK5-HHL-PRZYCHOD', line: '8808.08' };

test.describe.configure({ mode: 'serial' });
test.skip(!LIVE, 'BK5: wymaga SUPABASE_LIVE=1 i .env.local');

let env: Record<string, string>;
let base = '';
let admin: APIRequestContext;
const api = {} as Record<Org, APIRequestContext>;
const token = {} as Record<Org, string>;
const fx = {
  loadA: '', project: '', org: {} as Record<string, string>,
  costInv: '', revInv: '', costPdf: { id: '', path: '' }, revPdf: { id: '', path: '' },
  createdCost: false, createdRev: false,
};
let endpoints: string[] = [];

async function json(r: { text(): Promise<string> }) {
  const t = await r.text();
  try { return t ? JSON.parse(t) : null; } catch { return t; }
}
async function adminReq(method: string, path: string, data?: unknown, headers: Record<string, string> = {}) {
  const r = await admin.fetch(base + path, { method, data, headers: { Prefer: 'return=representation', ...headers } });
  const b = await json(r);
  if (!r.ok()) throw new Error(`${method} ${path.split('?')[0]} → ${r.status()} ${JSON.stringify(b).slice(0, 200)}`);
  return b;
}
async function registerAndUpload(org: Org, category: string, name: string, projectId: string) {
  const r = await api[org].post(`${base}/rest/v1/rpc/create_document`, {
    data: { p_load_id: null, p_category: category, p_file_name: name, p_mime: 'application/pdf', p_size: 64, p_project_id: projectId },
  });
  const row = (await json(r))?.[0];
  if (!r.ok() || !row) throw new Error(`create_document ${org}: ${r.status()}`);
  const body = Buffer.from(`%PDF-1.4\n% ${name}\n%%EOF\n`.padEnd(64, ' '));
  const u = await api[org].post(`${base}/storage/v1/object/${row.bucket}/${row.object_path}`, {
    data: body, headers: { 'Content-Type': 'application/pdf', 'x-upsert': 'false' },
  });
  if (!u.ok()) throw new Error(`upload ${org}: ${u.status()}`);
  return { id: row.id as string, path: row.storage_path as string };
}

test.beforeAll(async () => {
  env = loadEnvLocal();
  const host = await ensureLiveFiveRoles(env);
  base = host.url;
  env.VITE_SUPABASE_URL = host.url;
  env.VITE_SUPABASE_ANON_KEY = host.anonKey;
  env.SUPABASE_SERVICE_ROLE_KEY = host.serviceKey;
  for (const a of TEST_ACCOUNTS) env[a.key] = accountEmail(env, a);
  const SR = host.serviceKey;
  admin = await pwRequest.newContext({ extraHTTPHeaders: { apikey: SR, Authorization: `Bearer ${SR}` } });

  for (const o of ORGS) {
    const g = await adminReq('POST', '/auth/v1/admin/generate_link', { type: 'magiclink', email: env[ENV_KEY[o]].toLowerCase() });
    const anon = await pwRequest.newContext({ extraHTTPHeaders: { apikey: env.VITE_SUPABASE_ANON_KEY } });
    const v = await anon.post(`${base}/auth/v1/verify`, { data: { type: 'magiclink', token_hash: g.hashed_token ?? g.properties?.hashed_token } });
    token[o] = (await json(v))?.access_token;
    expect(token[o], `${o}: sesja`).toBeTruthy();
    api[o] = await pwRequest.newContext({ extraHTTPHeaders: { apikey: env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${token[o]}` } });
    await anon.dispose();
  }

  const orgs = await adminReq('GET', '/rest/v1/organizations?select=id,code');
  fx.org = Object.fromEntries(orgs.map((x: { id: string; code: string }) => [x.code, x.id]));
  const [load] = await adminReq('GET', '/rest/v1/loads?select=id,project_id&order_no=eq.TEST-BK3-A');
  expect(load, 'fixture TEST-BK3-A (BK3)').toBeTruthy();
  fx.loadA = load.id; fx.project = load.project_id;

  // koszt / przychód transportu (tylko gdy brak — nie nadpisujemy cudzych danych)
  if (!(await adminReq('GET', `/rest/v1/load_cost?select=load_id&load_id=eq.${fx.loadA}`)).length) {
    await adminReq('POST', '/rest/v1/load_cost', { load_id: fx.loadA, base_amount: Number(COST.amount) }); fx.createdCost = true;
  }
  if (!(await adminReq('GET', `/rest/v1/load_revenue?select=load_id&load_id=eq.${fx.loadA}`)).length) {
    await adminReq('POST', '/rest/v1/load_revenue', { load_id: fx.loadA, base_amount: Number(REV.amount) }); fx.createdRev = true;
  }
  const period = { period_start: '2026-10-05', period_end: '2026-10-11', project_id: fx.project };
  const [ci] = await adminReq('POST', '/rest/v1/invoices', {
    ...period, direction: 'KOSZT', carrier_org_id: fx.org.SCX, issuer_org_id: fx.org.SCX, recipient_org_id: fx.org.HHL,
    invoice_number: COST.inv, currency: 'PLN', net_total: Number(COST.amount), gross_total: Number(COST.amount), due_date: '2026-11-15',
  });
  const [ri] = await adminReq('POST', '/rest/v1/invoices', {
    ...period, direction: 'PRZYCHOD', issuer_org_id: fx.org.HHL, recipient_org_id: fx.org.KSH,
    invoice_number: REV.inv, currency: 'EUR', net_total: Number(REV.amount), gross_total: Number(REV.amount), due_date: '2026-11-10',
  });
  fx.costInv = ci.id; fx.revInv = ri.id;
  await adminReq('POST', '/rest/v1/invoice_lines', [
    { invoice_id: fx.costInv, load_id: fx.loadA, direction: 'KOSZT', invoiced_net: Number(COST.line), invoiced_amount: Number(COST.line) },
    { invoice_id: fx.revInv, load_id: fx.loadA, direction: 'PRZYCHOD', invoiced_net: Number(REV.line), invoiced_amount: Number(REV.line) },
  ]);
  fx.costPdf = await registerAndUpload('SCX', 'INVOICE', `${COST.inv}.pdf`, fx.project);
  fx.revPdf = await registerAndUpload('HHL', 'INVOICE', `${REV.inv}.pdf`, fx.project);
  await adminReq('POST', '/rest/v1/invoice_documents', [
    { invoice_id: fx.costInv, document_id: fx.costPdf.id, role: 'FAKTURA_PDF' },
    { invoice_id: fx.revInv, document_id: fx.revPdf.id, role: 'FAKTURA_PDF' },
  ]);

  // lista wszystkich tabel i widoków wystawionych przez PostgREST (OpenAPI; sam schemat, bez danych)
  const spec = await adminReq('GET', '/rest/v1/', undefined, { Accept: 'application/openapi+json' });
  // Pominięte wyłącznie metadane rozszerzenia PostGIS (8500 definicji układów współrzędnych —
  // dane referencyjne, nie dane firm; pełny odczyt przekraczał limit czasu).
  const POSTGIS_META = new Set(['spatial_ref_sys', 'geography_columns', 'geometry_columns']);
  endpoints = Object.keys(spec.paths ?? {}).filter((p) => p !== '/' && !p.startsWith('/rpc/')).map((p) => p.slice(1))
    .filter((p) => !POSTGIS_META.has(p));
});

test.afterAll(async () => {
  if (!admin) return;
  const del = (p: string) => adminReq('DELETE', p).catch((e) => console.warn(String(e)));
  for (const inv of [fx.costInv, fx.revInv].filter(Boolean)) {
    await del(`/rest/v1/invoice_documents?invoice_id=eq.${inv}`);
    await del(`/rest/v1/invoice_lines?invoice_id=eq.${inv}`);
    await del(`/rest/v1/invoices?id=eq.${inv}`);
  }
  for (const d of [fx.costPdf, fx.revPdf].filter((x) => x.id)) {
    const [bucket, ...rest] = d.path.split('/');
    await admin.fetch(`${base}/storage/v1/object/${bucket}`, { method: 'DELETE', data: { prefixes: [rest.join('/')] } });
    await del(`/rest/v1/documents?id=eq.${d.id}`);
  }
  if (fx.createdCost) await del(`/rest/v1/load_cost?load_id=eq.${fx.loadA}`);
  if (fx.createdRev) await del(`/rest/v1/load_revenue?load_id=eq.${fx.loadA}`);
  for (const o of ORGS) await api[o]?.dispose();
  await admin.dispose();
});

/** Wszystkie odpowiedzi API dla konta: każda tabela/widok + podpisy Storage obu PDF. */
async function sweep(o: Org): Promise<{ text: string; statuses: Record<string, number> }> {
  const parts: string[] = [];
  const statuses: Record<string, number> = {};
  for (const ep of endpoints) {
    const r = await api[o].get(`${base}/rest/v1/${ep}?select=*&limit=1000`);
    statuses[ep] = r.status();
    parts.push(`## ${ep}\n${await r.text()}`);
  }
  for (const d of [fx.costPdf, fx.revPdf]) {
    const [bucket, ...rest] = d.path.split('/');
    const r = await api[o].post(`${base}/storage/v1/object/sign/${bucket}/${rest.join('/')}`, { data: { expiresIn: 900 } });
    statuses[`sign:${d.path}`] = r.status();
    const b = await json(r);
    parts.push(`## sign ${d.path}\n${r.ok() && b?.signedURL ? `SIGNED:${d.id}` : ''}`);
  }
  return { text: parts.join('\n'), statuses };
}
/** Zakazane wartości w odpowiedziach: lista `sekcja: wartość` (pusta = zielono). */
function hits(text: string, forbidden: string[]): string[] {
  const out: string[] = [];
  for (const part of text.split('\n## ')) {
    const head = part.split('\n')[0].replace(/^## /, '');
    for (const f of forbidden) if (part.slice(head.length).includes(f)) out.push(`${head}: ${f}`);
  }
  return out;
}
const forbiddenCost = () => [COST.amount, COST.inv, COST.line, fx.costInv, fx.costPdf.id];
const forbiddenRev = () => [REV.amount, REV.inv, REV.line, fx.revInv, fx.revPdf.id];

test('API: OpenAPI wystawia tabele i widoki do przeglądu', async () => {
  expect(endpoints.length).toBeGreaterThanOrEqual(30);
  for (const t of ['loads', 'invoices', 'invoice_lines', 'invoice_documents', 'documents', 'load_cost', 'load_revenue']) expect(endpoints).toContain(t);
});

test('API: KSH nigdy nie dostaje kosztu, faktury kosztowej, jej pozycji ani dokumentów', async () => {
  const { text, statuses } = await sweep('KSH');
  expect(hits(text, forbiddenCost())).toEqual([]);
  expect(statuses.load_cost).toBeGreaterThanOrEqual(400); // tabela kosztów zamknięta dla ról API
  expect(text).toContain(REV.inv); // kontrola: własna faktura HHL→KSH jest widoczna
  expect(text).toContain(`SIGNED:${fx.revPdf.id}`); // … i jej PDF
});

test('API: SCX nigdy nie dostaje przychodu ani faktury przychodowej', async () => {
  const { text, statuses } = await sweep('SCX');
  expect(hits(text, forbiddenRev())).toEqual([]);
  expect(statuses.load_revenue).toBeGreaterThanOrEqual(400);
  expect(text).toContain(COST.inv); // kontrola: własna faktura SCX→HHL
  expect(text).toContain(`SIGNED:${fx.costPdf.id}`);
});

test('API: HHL widzi obie faktury, pozycje i PDF (kontrola dodatnia)', async () => {
  const { text } = await sweep('HHL');
  for (const s of [COST.inv, REV.inv, COST.line, REV.line, `SIGNED:${fx.costPdf.id}`, `SIGNED:${fx.revPdf.id}`]) expect(text).toContain(s);
});

// ---- AN1 / AN2: zapisy przewoźnika --------------------------------------------------------
async function loadRow() {
  const [r] = await adminReq('GET', `/rest/v1/loads?select=order_no,hhl_order_no,carrier_order_no,driver_name,plan_load_from,plan_load_to,plan_delivery_from,plan_delivery_to&id=eq.${fx.loadA}`);
  return r;
}
async function patch(o: Org, body: Record<string, unknown>) {
  const r = await api[o].patch(`${base}/rest/v1/loads?id=eq.${fx.loadA}`, { data: body, headers: { Prefer: 'return=representation' } });
  return { status: r.status(), body: await json(r) };
}

test('API: przewoźnik nie zmieni numeru zlecenia HHL ani KSH ani okien planowych — błąd, nie sukces', async () => {
  const before = await loadRow();
  const attempts: [string, Record<string, unknown>][] = [
    ['nr zlecenia HHL', { hhl_order_no: 'SCX-HACK-HHL' }],
    ['nr zlecenia KSH', { order_no: 'SCX-HACK-KSH' }],
    ['okno załadunku od', { plan_load_from: '2026-10-01T06:00:00Z' }],
    ['okno załadunku do', { plan_load_to: '2026-10-01T18:00:00Z' }],
    ['okno dostawy od', { plan_delivery_from: '2026-10-08T06:00:00Z' }],
    ['okno dostawy do', { plan_delivery_to: '2026-10-08T18:00:00Z' }],
  ];
  for (const [what, body] of attempts) {
    const r = await patch('SCX', body);
    expect(r.status, `SCX ${what}: HTTP ${r.status} ${JSON.stringify(r.body).slice(0, 160)}`).toBeGreaterThanOrEqual(400);
    expect(JSON.stringify(r.body), what).toMatch(/Przewoźnik nie może zmieniać|permission denied/);
  }
  expect(await loadRow()).toEqual(before);
});

test('API: przewoźnik zmienia własne pola (nr zlecenia SCX, kierowca); HHL nie zmieni nr SCX; KSH nic', async () => {
  const before = await loadRow();
  const ok = await patch('SCX', { carrier_order_no: 'TEST-BK5-SCX-NR', driver_name: 'Test BK5' });
  expect(ok.status).toBe(200);
  expect(ok.body?.[0]).toMatchObject({ carrier_order_no: 'TEST-BK5-SCX-NR', driver_name: 'Test BK5' });
  const hhl = await patch('HHL', { carrier_order_no: 'HHL-HACK' });
  expect(hhl.status).toBeGreaterThanOrEqual(400);
  expect(JSON.stringify(hhl.body)).toContain('Numer zlecenia przewoźnika wpisuje wyłącznie przewoźnik');
  const ksh = await patch('KSH', { driver_name: 'KSH-HACK' });
  expect(ksh.status === 200 ? ksh.body : []).toEqual([]); // RLS: brak wiersza do zmiany
  const restore = await patch('SCX', { carrier_order_no: before.carrier_order_no, driver_name: before.driver_name });
  expect(restore.status).toBe(200);
  expect(await loadRow()).toEqual(before);
});

// ---- ruch sieciowy aplikacji --------------------------------------------------------------
test('Aplikacja (tryb Supabase): odpowiedzi sieciowe w każdym widoku bez danych zakazanych dla roli', async ({ browser }) => {
  test.setTimeout(240_000);
  const reachable = await fetch(APP).then((r) => r.ok).catch(() => false);
  test.skip(!reachable, `build Supabase nie działa pod ${APP}`);
  for (const [o, forbidden] of [['KSH', forbiddenCost()], ['SCX', forbiddenRev()]] as [Org, string[]][]) {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const bodies: string[] = [];
    page.on('response', async (r) => {
      if (!r.url().startsWith(base)) return;
      try { bodies.push(await r.text()); } catch { /* przekierowanie / brak treści */ }
    });
    const g = await adminReq('POST', '/auth/v1/admin/generate_link', { type: 'magiclink', email: env[ENV_KEY[o]].toLowerCase() });
    const hop = await fetch(g.action_link ?? g.properties?.action_link, { redirect: 'manual' });
    const loc = hop.headers.get('location') ?? '';
    await page.goto(APP + loc.slice(loc.indexOf('#')));
    await page.waitForSelector('[data-auth="session"]', { timeout: 30000 });
    const views = await page.locator('nav [data-view]').all();
    for (const v of views) { await v.click({ timeout: 5000 }).catch(() => undefined); await page.waitForTimeout(700); }
    await page.keyboard.press('h');
    await page.locator(`tr[data-load="${fx.loadA}"]`).first().click({ timeout: 10000 });
    await page.waitForTimeout(1000);
    const all = bodies.join('\n');
    expect(bodies.length, `${o}: odpowiedzi API`).toBeGreaterThan(3);
    expect(views.length, `${o}: widoki`).toBeGreaterThan(3);
    for (const s of forbidden) expect(all, `${o}: ${s}`).not.toContain(s);
    await ctx.close();
  }
});

test('Aplikacja: przewoźnik zapisuje „Awizacja / Prom” bez zmiany okien — brak plan_* w zapisie, brak błędu', async ({ browser }) => {
  test.setTimeout(120_000);
  const reachable = await fetch(APP).then((r) => r.ok).catch(() => false);
  test.skip(!reachable, `build Supabase nie działa pod ${APP}`);
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const patches: string[] = [];
  page.on('request', (r) => { if (r.url().includes('/rest/v1/loads') && r.method() === 'PATCH') patches.push(r.postData() ?? ''); });
  const g = await adminReq('POST', '/auth/v1/admin/generate_link', { type: 'magiclink', email: env[ENV_KEY.SCX].toLowerCase() });
  const hop = await fetch(g.action_link ?? g.properties?.action_link, { redirect: 'manual' });
  const loc = hop.headers.get('location') ?? '';
  await page.goto(APP + loc.slice(loc.indexOf('#')));
  await page.waitForSelector('[data-auth="session"]', { timeout: 30000 });
  await page.keyboard.press('h');
  await page.locator(`tr[data-load="${fx.loadA}"]`).first().click();
  await page.locator('aside .dtabs button').filter({ hasText: /Ustalenia/ }).first().click();
  const before = await loadRow();
  await page.getByRole('button', { name: 'Zapisz awizację' }).click();
  await page.waitForTimeout(2500);
  expect(patches.filter((p) => p.includes('plan_')), 'zapis okien planowych').toEqual([]);
  expect(await page.locator('text=Nie zapisano na serwerze').count()).toBe(0);
  expect(await loadRow()).toEqual(before);
  await ctx.close();
});
