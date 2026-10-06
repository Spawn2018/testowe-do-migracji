/**
 * AUD-01 — pomiar otwarcia Mapy (Playwright, Chromium): zapytania do bazy, pierwszy kafelek, komplet kafelków.
 *
 * Tryb MOCK (domyślny): build produkcyjny (VITE_AUTH_MODE=supabase) z adresem Supabase `https://mockaud01.supabase.co`;
 * wszystkie odpowiedzi bazy, Auth i kafelków podstawia skrypt (94 transporty, 1 z pozycją GPS, opóźnienie bazy
 * DB_MS, kafelka TILE_MS). Liczba zapytań jest dokładna (to ten sam kod co na produkcji); czasy — orientacyjne
 * (makieta nie ma kolejki połączeń przeglądarki ani zimnego startu funkcji).
 *   BUILD=/tmp/wt-aud01-after LABEL=po node scripts/audyt/aud01-measure.mjs
 * Tryb PROD: APP=https://tower.log-mar.pl STORAGE=<plik storageState zalogowanej sesji testowej> — liczy żądania
 * do *.supabase.co i kafelki `/tiles/` albo `here-raster` na produkcji (wymaga sesji; skrypt nie loguje się sam).
 * Wynik: JSON na stdout + zrzuty OUT/<label>-<szerokość>.png.
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const LABEL = process.env.LABEL ?? 'pomiar';
const OUT = process.env.OUT ?? '/workspace/aud01-shots';
const APP = process.env.APP ?? '';
const STORAGE = process.env.STORAGE ?? '';
const BUILD = process.env.BUILD ?? '';
const PORT = Number(process.env.PORT ?? 4191);
const DB_MS = Number(process.env.DB_MS ?? 120);
const TILE_MS = Number(process.env.TILE_MS ?? 250);
const WINDOW_MS = Number(process.env.WINDOW_MS ?? 12000);
const WIDTHS = (process.env.WIDTHS ?? '1366,390').split(',').map(Number);
const MOCK = !APP;
const REF = 'mockaud01';
const HOST = `${REF}.supabase.co`;
mkdirSync(OUT, { recursive: true });

const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ORG = { HHL: uuid(9001), KSH: uuid(9002), SCX: uuid(9003) };
const LOADS = Array.from({ length: 94 }, (_, i) => ({
  id: uuid(i + 1), order_no: `KSH/AUD/${i + 1}`, carrier_org_id: ORG.SCX, status: i === 0 ? 'IN_TRANSIT_PL' : 'PLANNED',
  plan_load_date: `2026-10-${String(7 + (i % 20)).padStart(2, '0')}`, plan_load_from: null, plan_load_to: null,
  plan_delivery_date: `2026-10-${String(9 + (i % 20)).padStart(2, '0')}`, plan_delivery_from: null, plan_delivery_to: null,
  tractor_plate: `PO ${1000 + i}`, trailer_plate: null, escort_vehicles: 0, ferry_booking_ref: null, sailing_id: null,
  telematics_vehicle_id: null, plan_dates_status: null, plan_dates_confirmed_at: null, combo_length_m: null, combo_width_m: null,
  combo_height_m: null, combo_weight_t: null, delay_minutes: 0, eta_site: null, eta_confidence_min: null, eta_basis: null,
  eta_computed_at: null, hhl_order_no: null, carrier_order_no: null, actual_delivery_at: null,
  shipment_items: [{ shipment_code: `SG-${String(i + 1).padStart(2, '0')}`, item_type: 'SEGMENT', cargo_class: null, length_m: 30, width_m: 4, height_m: 4, total_weight_t: 80, unit_weight_t: 80, qty: 1, assembly_seq: i + 1 }],
  sailings: null,
}));
const FIX = { load_id: LOADS[0].id, ts: '2026-10-06T08:00:00Z', lat: 53.1, lng: 18.0 };
const PNG = readFileSync(new URL('../../public/brand/watchtower-logo-full.png', import.meta.url));

function jwt() {
  const b = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  return `${b({ alg: 'HS256', typ: 'JWT' })}.${b({ sub: uuid(7001), role: 'authenticated', aal: 'aal1', amr: [{ method: 'password', timestamp: now }], exp: now + 7200, iat: now, session_id: uuid(7002), email: 'audyt@test' })}.sig`;
}

function rpcBody(name) {
  switch (name) {
    case 'my_profile': return [{ user_id: uuid(7001), email: 'audyt@test', full_name: 'Audyt Test', role: 'HHL_ADMIN', org_code: 'HHL', org_name: 'H&H', locale: 'pl', active: true, must_set_password: false }];
    case 'my_mfa_status': return { required: false, satisfied: true };
    case 'map_display_state': return { tiles_open: true, month: '2026-10-01', roads: [] };
    case 'latest_vehicle_fixes': return [FIX];
    case 'load_track': return null; // ustawiane per żądanie niżej
    default: return [];
  }
}

async function mockRoutes(ctx, stats) {
  await ctx.route(`https://${HOST}/**`, async (route) => {
    const req = route.request();
    const u = new URL(req.url());
    const p = u.pathname;
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-expose-headers': 'content-range' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    if (p.startsWith('/functions/v1/here-raster')) {
      await sleep(TILE_MS);
      return route.fulfill({ status: 200, body: PNG, headers: { ...cors, 'content-type': 'image/png' } });
    }
    if (p.startsWith('/auth/v1/')) {
      if (p.endsWith('/user')) return route.fulfill({ json: { id: uuid(7001), email: 'audyt@test', role: 'authenticated', factors: [] }, headers: cors });
      return route.fulfill({ json: {}, headers: cors });
    }
    if (p.startsWith('/realtime/')) return route.abort();
    await sleep(DB_MS);
    if (p.startsWith('/rest/v1/rpc/')) {
      const name = p.slice('/rest/v1/rpc/'.length);
      let body = rpcBody(name);
      if (name === 'load_track') {
        let arg = {};
        try { arg = JSON.parse(req.postData() ?? '{}'); } catch { /* */ }
        body = arg.p_load === FIX.load_id ? [{ ts: FIX.ts, lat: FIX.lat, lng: FIX.lng, speed_kmh: 60, source: 'DRIVER_PWA' }] : [];
      }
      return route.fulfill({ json: body, headers: cors });
    }
    const table = p.slice('/rest/v1/'.length);
    const single = (req.headers()['accept'] ?? '').includes('vnd.pgrst.object');
    let rows = [];
    if (table === 'loads') rows = LOADS;
    else if (table === 'organizations') rows = Object.entries(ORG).map(([code, id]) => ({ id, code, kind: code === 'SCX' ? 'CARRIER' : code === 'KSH' ? 'CLIENT' : 'HHL', name: code }));
    else if (table === 'projects') rows = [{ id: uuid(8001), code: 'STEGRA_BODEN' }];
    if (single) return route.fulfill({ json: rows[0] ?? null, headers: cors });
    return route.fulfill({ json: rows, headers: { ...cors, 'content-range': `0-${Math.max(rows.length - 1, 0)}/${rows.length}` } });
  });
  // /tiles/... na domenie aplikacji (przepisanie Vercel) — w makiecie ta sama odpowiedź co funkcja.
  await ctx.route(/\/tiles\/(light|dark)\/\d+\/\d+\/\d+$/, async (route) => {
    await sleep(TILE_MS);
    return route.fulfill({ status: 200, body: PNG, headers: { 'content-type': 'image/png' } });
  });
}

function startPreview() {
  const proc = spawn('npx', ['vite', 'preview', '--outDir', BUILD, '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', detached: true });
  return proc;
}

async function measure(browser, width) {
  const height = width < 600 ? 844 : 768;
  const ctx = await browser.newContext({
    viewport: { width, height }, locale: 'pl-PL', timezoneId: 'Europe/Warsaw',
    ...(STORAGE ? { storageState: STORAGE } : {}),
    ...(width < 600 ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}),
  });
  const stats = { db: [], tiles: [] };
  if (MOCK) {
    await mockRoutes(ctx, stats);
    const token = jwt();
    await ctx.addInitScript(([k, v]) => { try { if (!localStorage.getItem(k)) localStorage.setItem(k, v); } catch { /* */ } }, [
      `sb-${REF}-auth-token`,
      JSON.stringify({ access_token: token, refresh_token: 'r', token_type: 'bearer', expires_in: 7200, expires_at: Math.floor(Date.now() / 1000) + 7200, user: { id: uuid(7001), email: 'audyt@test', aud: 'authenticated', role: 'authenticated', factors: [] } }),
    ]);
  }
  const page = await ctx.newPage();
  let t0 = 0;
  page.on('request', (r) => {
    const u = r.url();
    if (/supabase\.co\/rest\/v1\//.test(u) && r.method() !== 'OPTIONS') stats.db.push({ t: Date.now(), name: u.replace(/^.*\/rest\/v1\//, '').replace(/\?.*$/, '') });
  });
  page.on('requestfinished', (r) => {
    const u = r.url();
    if (/\/tiles\/(light|dark)\/|here-raster|basemaps\.cartocdn|arcgisonline/.test(u)) stats.tiles.push({ t: Date.now(), url: u.replace(/\?.*$/, '') });
  });
  const base = MOCK ? `http://wt-aud01.test:${PORT}/` : APP;
  await page.goto(base + '#/?lang=pl', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-auth="session"], .app-shell, [data-page]', { timeout: 60000 }).catch(() => undefined);
  await sleep(6000); // kokpit załadowany, ruch ucichł
  stats.db.length = 0; stats.tiles.length = 0;
  t0 = Date.now();
  await page.keyboard.press('m');
  const firstTile = page.waitForFunction(() => {
    const m = document.querySelector('[data-page="map"] .leaflet-container');
    return !!m && m.querySelectorAll('.leaflet-tile-loaded').length > 0;
  }, null, { timeout: WINDOW_MS, polling: 50 }).then(() => Date.now() - t0, () => null);
  const allTiles = page.waitForFunction(() => {
    const m = document.querySelector('[data-page="map"] .leaflet-container');
    if (!m) return false;
    const all = m.querySelectorAll('.leaflet-tile');
    return all.length > 0 && m.querySelectorAll('.leaflet-tile-loaded').length === all.length;
  }, null, { timeout: WINDOW_MS, polling: 50 }).then(() => Date.now() - t0, () => null);
  const [ft, at] = await Promise.all([firstTile, allTiles]);
  const rest = WINDOW_MS - (Date.now() - t0);
  if (rest > 0) await sleep(rest);
  const shot = `${OUT}/${LABEL}-${width}.png`;
  await page.screenshot({ path: shot });
  const byName = {};
  for (const r of stats.db) byName[r.name] = (byName[r.name] ?? 0) + 1;
  const res = {
    label: LABEL, width, mode: MOCK ? 'mock' : 'prod', firstTileMs: ft, allTilesMs: at,
    dbRequests12s: stats.db.length, loadTrack: byName['rpc/load_track'] ?? 0, latestVehicleFixes: byName['rpc/latest_vehicle_fixes'] ?? 0,
    tilesFinished: stats.tiles.length, tilePaths: [...new Set(stats.tiles.map((x) => x.url.replace(/\/\d+\/\d+\/\d+$/, '/z/x/y').replace(/^https?:\/\/[^/]+/, '')))],
    dbByName: byName, screenshot: shot,
  };
  await ctx.close();
  return res;
}

const proc = MOCK ? startPreview() : null;
try {
  if (MOCK) for (let i = 0; i < 40; i++) { try { await fetch(`http://127.0.0.1:${PORT}/`); break; } catch { await sleep(500); } }
  const browser = await chromium.launch({ args: MOCK ? [`--host-resolver-rules=MAP wt-aud01.test 127.0.0.1`] : [] });
  const out = [];
  for (const w of WIDTHS) out.push(await measure(browser, w));
  await browser.close();
  writeFileSync(`${OUT}/${LABEL}.json`, JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
} finally {
  if (proc) { try { process.kill(-proc.pid); } catch { /* */ } }
}
