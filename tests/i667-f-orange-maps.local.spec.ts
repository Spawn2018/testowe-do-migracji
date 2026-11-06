/**
 * #667 F — e2e pomarańczowych linii na BUILDZIE PRODUKCYJNYM (VITE_AUTH_MODE=supabase)
 * z lokalnym / testowym Supabase (nigdy produkcja).
 * Każda mapa ≥ 1 polilinia #E5A544; leg SE-KAA obecny w map_display_state.
 * DP-58 (F7 #677 r3 / #850 r1): bez `if (count())` / `.catch` z zapasowym data-view;
 * + mapa telefonu (E8: Mapa spod „Więcej”) + TrackReplay (warstwa „Przebieg wybranego”).
 * Uruchamia: SPEC=tests/i667-f-orange-maps.local.spec.ts scripts/i2/local-ui.sh
 */
import { test, expect, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';

const APP = process.env.I2_UI_BASE ?? '';
const URL_ = process.env.VITE_SUPABASE_URL ?? '';
const DB = process.env.SUPABASE_DB_URL ?? '';
/** DP-229 CI: hasło z `scripts/i667/ci-orange-maps.sh` (FIVE_ROLE_LIVE_PASSWORD). */
const PW = process.env.I667_TEST_PASSWORD ?? 'TowerDbTest-12roles!';
const LOCAL = !!APP && /^http:\/\/(127\.0\.0\.1|localhost):/.test(URL_);
const psql = (sql: string) => execFileSync('psql', [DB, '-Atq', '-c', sql]).toString().trim();

test.describe.configure({ mode: 'serial' });
test.skip(!LOCAL, '#667 F: wymaga I2_UI_BASE i lokalnego Supabase (build produkcyjny)');

/**
 * DP-229 F7 r3: logowanie hasłem (nie magic link).
 * AuthGate ma `detectSessionInUrl=false` → hash z magic linku = ekran „Dalej”
 * (`data-auth="link-pending"`), a świeże konto z seeda ma `must_set_password`
 * → nigdy nie widać `[data-auth="session"]`.
 */
async function login(page: Page, email: string) {
  await page.goto(APP);
  await page.waitForSelector('[data-auth="login"]', { timeout: 30_000 });
  await page.locator('input[type=email]').fill(email);
  await page.locator('#auth-pw').fill(PW);
  await page.locator('[data-auth="login"] form button[type=submit]').click();
  await page.waitForSelector('[data-auth="session"]', { timeout: 30_000 });
  /* Shell z Kokpitem — nie wystarczy sam chip konta (mapa w puli bywa w schowku). */
  await page.waitForSelector('.grid2-map-body', { timeout: 30_000 });
}

/**
 * DP-229 F7 r5: otwarta szuflada ma `.drawer-scrim` nad nawigacją —
 * Playwright: „intercepts pointer events” przy kliku `data-view`.
 */
async function closeDrawerIfOpen(page: Page) {
  const scrim = page.locator('[data-drawer-scrim]');
  if (await scrim.count()) {
    await scrim.first().click({ force: true }).catch(() => {});
    await page.waitForSelector('aside.drawer', { state: 'detached', timeout: 5_000 }).catch(() => {});
  }
}

/** E8: na telefonie Mapa/Strefy są poza pinami — najpierw „Więcej”. */
async function openNavView(page: Page, view: string) {
  await closeDrawerIfOpen(page);
  const btn = page.locator(`nav button[data-view="${view}"]`).first();
  if (!(await btn.isVisible())) {
    await page.locator('nav .nav-more-btn').click();
    await expect(btn).toBeVisible({ timeout: 5_000 });
  }
  /* Już bieżący widok — bez zbędnego setView (odmontowanie CorridorMap → mapa w schowku). */
  if ((await btn.getAttribute('aria-current')) === 'page') return;
  await btn.click();
}

async function orangePathCount(page: Page, root: string): Promise<number> {
  return page.locator(root).locator('.leaflet-overlay-pane path').evaluateAll((els) =>
    els.filter((p) => {
      const stroke = (p.getAttribute('stroke') || '').toLowerCase();
      const style = (p.getAttribute('style') || '').toLowerCase();
      return stroke === '#e5a544' || /stroke:\s*#e5a544/.test(style);
    }).length);
}

/**
 * DP-229 F7 r4: nie czekaj na widoczność `.leaflet-overlay-pane` globalnie —
 * mapa z puli w schowku (`[data-map-pool=parked]`, visibility:hidden) też ma ten pane
 * i Playwright „resolved to hidden” na pierwszym trafieniu. Czekaj w kontenerze widoku
 * (`.grid2-map-body` / `[data-page=map]` / szuflada / strefy) na ≥1 pomarańczową.
 */
async function waitOrangeIn(page: Page, root: string, label: string) {
  const host = page.locator(root).first();
  await host.waitFor({ state: 'attached', timeout: 30_000 });
  await host.scrollIntoViewIfNeeded();
  await expect
    .poll(async () => orangePathCount(page, root), { timeout: 45_000, message: label })
    .toBeGreaterThanOrEqual(1);
}

test.beforeAll(() => {
  // SE-KAA musi mieć punkty (jak po jobie here-roads); bez prawdziwych współrzędnych GPS śladu.
  const n = Number(psql(`select coalesce(jsonb_array_length(points), 0) from here_road_geometry where leg = 'SE-KAA'`));
  if (!(n >= 2)) {
    throw new Error(`#667 F: SE-KAA bez punktów (jsonb_array_length=${n}) — uruchom here-roads na lokalnej bazie`);
  }
});

test('#667 F: Kokpit / Mapa / Strefy / geofence — ≥1 pomarańczowa; SE-KAA w RPC', async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page, 'hhl@bk5.local');

  // Kokpit (CorridorMap embedded) — DP-58: bez .catch na zapasowy data-view
  await openNavView(page, 'dash');
  await waitOrangeIn(page, '.grid2-map-body', 'Kokpit');

  // Mapa
  await openNavView(page, 'map');
  await waitOrangeIn(page, '[data-page="map"]', 'Mapa');

  // DP-58 / F7 #850 r1: warstwa p9c_l_trail = „Przebieg wybranego” (nie „Ślad”); tabela [data-map-table]
  await page.locator('.maplayers label', { hasText: /przebieg/i }).locator('input').check();
  await page.locator('[data-map-table] tr[data-load]').first().click();
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-track-replay]').first()).toBeVisible({ timeout: 30_000 });
  expect(await orangePathCount(page, '[data-page="map"]'), 'Mapa + TrackReplay').toBeGreaterThanOrEqual(1);

  // Karta / szuflada (mini-mapa z puli)
  await openNavView(page, 'sched');
  await page.locator('tr[data-load]').first().click();
  await waitOrangeIn(page, 'aside.drawer .corridor-map-el', 'szuflada');

  // Strefy (ZonesMap) — DP-58: data-view="geo", bez if (count())
  await openNavView(page, 'geo');
  await page.waitForSelector('[data-zones-map]', { timeout: 30_000 });
  await waitOrangeIn(page, '[data-zones-map]', 'Strefy');

  // DP-80: edytor geofence (osobny L.map) usunięty — formularz strefy rysuje `ZonesMap` mode="one"

  // DP-58 / F7 #850 r1: mapa telefonu (E8 390) — Mapa spod „Więcej”, ≥1 pomarańczowa
  await page.setViewportSize({ width: 390, height: 844 });
  await openNavView(page, 'map');
  await waitOrangeIn(page, '[data-page="map"]', 'Mapa telefon 390');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

  /* DP-229 F7 r6/r7: map_display_state wymaga current_app_user_id (jak bmapa asu).
   * F7 r7: jsonb_array_length tylko gdy typeof=array — inaczej „cannot get array length of a scalar”. */
  const hhlId = psql(`select id::text from auth.users where email = 'hhl@bk5.local' limit 1`);
  expect(hhlId, 'auth.users hhl@bk5.local').toMatch(/^[0-9a-f-]{36}$/i);
  const kaa = psql(`
    begin;
    select set_config('request.jwt.claim.sub', '${hhlId}', true);
    set local role authenticated;
    select exists(
      select 1
      from jsonb_array_elements(coalesce(map_display_state()->'roads', '[]'::jsonb)) e
      where e->>'leg' = 'SE-KAA'
        and case
          when jsonb_typeof(e->'points') = 'array' then jsonb_array_length(e->'points')
          else 0
        end >= 2
    )::text;
    commit
  `);
  expect(kaa, 'SE-KAA w map_display_state').toBe('true');
});
