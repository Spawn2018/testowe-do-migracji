/**
 * #667 F — e2e pomarańczowych linii na BUILDZIE PRODUKCYJNYM (VITE_AUTH_MODE=supabase)
 * z lokalnym / testowym Supabase (nigdy produkcja).
 * Każda mapa ≥ 1 polilinia #E5A544; leg SE-KAA obecny w map_display_state.
 * Uruchamia: SPEC=tests/i667-f-orange-maps.local.spec.ts scripts/i2/local-ui.sh
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
test.skip(!LOCAL, '#667 F: wymaga I2_UI_BASE i lokalnego Supabase (build produkcyjny)');

async function login(page: Page, email: string) {
  const r = await fetch(`${URL_}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: { apikey: SR, Authorization: `Bearer ${SR}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'magiclink', email }),
  });
  const g = await r.json() as { action_link?: string; properties?: { action_link?: string } };
  const hop = await fetch((g.action_link ?? g.properties?.action_link)!, { redirect: 'manual' });
  const loc = hop.headers.get('location') ?? '';
  await page.goto(APP + loc.slice(loc.indexOf('#')));
  await page.waitForSelector('[data-auth="session"]', { timeout: 30_000 });
}

async function orangePathCount(page: Page, root: string): Promise<number> {
  return page.locator(root).locator('.leaflet-overlay-pane path').evaluateAll((els) =>
    els.filter((p) => {
      const stroke = (p.getAttribute('stroke') || '').toLowerCase();
      const style = (p.getAttribute('style') || '').toLowerCase();
      return stroke === '#e5a544' || /stroke:\s*#e5a544/.test(style);
    }).length);
}

test.beforeAll(() => {
  // SE-KAA musi mieć punkty (jak po jobie here-roads); bez prawdziwych współrzędnych GPS śladu.
  const n = Number(psql(`select coalesce(jsonb_array_length(points), 0) from here_road_geometry where leg = 'SE-KAA'`));
  if (!(n >= 2)) {
    throw new Error(`#667 F: SE-KAA bez punktów (jsonb_array_length=${n}) — uruchom here-roads na lokalnej bazie`);
  }
});

test('#667 F: Kokpit / Mapa / Strefy / geofence — ≥1 pomarańczowa; SE-KAA w RPC', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page, 'hhl@bk5.local');

  // Kokpit (CorridorMap embedded)
  await page.locator('nav [data-view="dash"]').first().click().catch(() =>
    page.locator('nav [data-view="home"]').first().click());
  await page.waitForSelector('.corridor-map-el .leaflet-overlay-pane', { timeout: 30_000 });
  await page.waitForTimeout(1200);
  expect(await orangePathCount(page, '.corridor-map-el'), 'Kokpit').toBeGreaterThanOrEqual(1);

  // Mapa
  await page.locator('nav [data-view="map"]').first().click();
  await page.waitForSelector('[data-page="map"] .leaflet-overlay-pane', { timeout: 30_000 });
  await page.waitForTimeout(1200);
  expect(await orangePathCount(page, '[data-page="map"]'), 'Mapa').toBeGreaterThanOrEqual(1);

  // Karta / szuflada (mini-mapa z puli)
  await page.locator('nav [data-view="sched"]').first().click();
  await page.locator('tr[data-load]').first().click();
  await page.waitForSelector('aside.drawer .corridor-map-el .leaflet-overlay-pane', { timeout: 30_000 });
  await page.waitForTimeout(1200);
  expect(await orangePathCount(page, 'aside.drawer .corridor-map-el'), 'szuflada').toBeGreaterThanOrEqual(1);

  // Strefy (ZonesMap)
  await page.locator('nav [data-view="zones"]').first().click().catch(async () => {
    await page.locator('nav [data-view="geo"]').first().click();
  });
  const zonesRoot = page.locator('[data-zones-map]').first();
  if (await zonesRoot.count()) {
    await page.waitForTimeout(1200);
    expect(await orangePathCount(page, '[data-zones-map]'), 'Strefy').toBeGreaterThanOrEqual(1);
  }

  // Edytor geofence (osobny L.map), gdy widok dostępny
  const gfNav = page.locator('nav [data-view="geo"], nav [data-view="geofence"]').first();
  if (await gfNav.count()) {
    await gfNav.click();
    const gf = page.locator('[data-geofence-map]');
    if (await gf.count()) {
      await page.waitForTimeout(1200);
      expect(await orangePathCount(page, '[data-geofence-map]'), 'geofence').toBeGreaterThanOrEqual(1);
    }
  }

  const legs = psql(`
    select string_agg(leg, ',' order by leg)
    from (
      select e->>'leg' as leg
      from jsonb_array_elements((select map_display_state()->'roads')) e
      where jsonb_typeof(e->'points') = 'array' and jsonb_array_length(e->'points') >= 2
    ) x
  `);
  expect(legs, 'SE-KAA w map_display_state').toMatch(/SE-KAA/);
});
