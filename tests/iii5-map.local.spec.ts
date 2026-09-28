/**
 * III-5 (SCOPE 5.10, 5.13; 0088) na BUILDZIE PRODUKCYJNYM i lokalnym Supabase (nigdy produkcja):
 *  (a) znaczniki transportów w tym samym punkcie (np. 50 × plac załadunku) rozłożone — żadne dwa nie nakładają się (≥ 20 px);
 *  (b) odtwarzanie przebiegu: warstwa „Ślad” + wybrany transport → pozycje GPS z bazy (load_track), suwak zmienia chwilę;
 *      transport bez GPS → „Brak pozycji GPS”.
 * Uruchamia: SPEC=tests/iii5-map.local.spec.ts scripts/i2/local-ui.sh
 */
import { test, expect, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';

const APP = process.env.I2_UI_BASE ?? '';
const URL_ = process.env.VITE_SUPABASE_URL ?? '';
const SR = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const DB = process.env.SUPABASE_DB_URL ?? '';
const LOCAL = !!APP && /^http:\/\/(127\.0\.0\.1|localhost):/.test(URL_);
const psql = (sql: string) => execFileSync('psql', [DB, '-Atq', '-c', sql]).toString().trim();

test.describe.configure({ mode: 'serial' });
test.skip(!LOCAL, 'mapa III-5: wymaga I2_UI_BASE i lokalnego Supabase');

let LD = ''; let LE = '';
test.beforeAll(() => {
  [LD, LE] = psql(`select id from loads where status='PLANNED' order by plan_load_date, id limit 2`).split('\n');
  psql(`insert into positions (load_id, ts, geom_raw, speed_kmh, source)
        select '${LD}', now() - make_interval(hours => 12 - g), st_setsrid(st_makepoint(17.0 + g * 0.15, 52.1 + g * 0.2), 4326), 60 + g, 'DRIVER_PWA'
          from generate_series(0, 11) g on conflict do nothing`);
});
test.afterAll(() => { psql(`delete from positions where load_id='${LD}' and source='DRIVER_PWA'`); });

async function login(page: Page, email: string) {
  const r = await fetch(`${URL_}/auth/v1/admin/generate_link`, {
    method: 'POST', headers: { apikey: SR, Authorization: `Bearer ${SR}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'magiclink', email }),
  });
  const g = await r.json() as { action_link?: string; properties?: { action_link?: string } };
  const hop = await fetch((g.action_link ?? g.properties?.action_link)!, { redirect: 'manual' });
  const loc = hop.headers.get('location') ?? '';
  await page.goto(APP + loc.slice(loc.indexOf('#')));
  await page.waitForSelector('[data-auth="session"]', { timeout: 30000 });
}

test('mapa: znaczniki bez nakładania; odtwarzanie przebiegu z bazy', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page, 'hhl@bk5.local');
  await page.locator('nav [data-view="map"]').first().click();
  await page.waitForSelector('.leaflet-marker-icon');
  await page.waitForTimeout(800);
  const centers = await page.locator('.leaflet-marker-pane .leaflet-marker-icon').evaluateAll((els) =>
    els.map((e) => { const r = e.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }));
  expect(centers.length).toBeGreaterThanOrEqual(10);
  let min = Infinity;
  for (let i = 0; i < centers.length; i++) for (let j = i + 1; j < centers.length; j++) min = Math.min(min, Math.hypot(centers[i][0] - centers[j][0], centers[i][1] - centers[j][1]));
  expect(min).toBeGreaterThanOrEqual(20);
  if (process.env.SHOT) await page.locator('.mapbox').screenshot({ path: '/tmp/iii5-declutter.png' });

  await page.locator('.maplayers label', { hasText: /ślad/i }).locator('input').check();
  await page.locator(`.mlist tr[data-load="${LD}"]`).click();
  await page.keyboard.press('Escape');
  const rp = page.locator('[data-track-replay="12"]');
  await expect(rp).toBeVisible();
  await expect(rp).toContainText('12 pozycji');
  const endText = await page.locator('[data-track-at]').innerText();
  await page.locator('[data-track-slider]').fill('0');
  await expect(page.locator('[data-track-at]')).not.toHaveText(endText);
  if (process.env.SHOT) await page.locator('.mapbox').screenshot({ path: '/tmp/iii5-replay.png' });
  await page.locator('[data-track-play]').click();
  await page.waitForTimeout(600);
  const v = Number(await page.locator('[data-track-slider]').inputValue());
  expect(v).toBeGreaterThan(0);

  await page.locator(`.mlist tr[data-load="${LE}"]`).click();
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-track-empty]')).toBeVisible();
});
