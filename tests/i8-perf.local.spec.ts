/**
 * I-8 — wydajność interfejsu (build produkcyjny, LOKALNY Supabase z wolumenem scripts/i8/seed.sql): trzy role,
 * czas od otwarcia linku logowania do kokpitu z danymi, przejście do harmonogramu z pełną listą, mapa.
 * Uruchomienie: SPEC=tests/i8-perf.local.spec.ts SB_WORKDIR=/tmp/sblocal bash scripts/i2/local-ui.sh
 */
import { test, expect } from '@playwright/test';
import { writeFileSync, existsSync, readFileSync } from 'node:fs';

const APP = process.env.I2_UI_BASE ?? '';
const URL_ = process.env.VITE_SUPABASE_URL ?? '';
const SR = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
test.skip(!APP || !/^http:\/\/(127\.0\.0\.1|localhost):/.test(URL_), 'I-8: tylko lokalnie');
test.describe.configure({ mode: 'serial' });
const OUT = '/tmp/i8-ui.json';

for (const who of ['hhl', 'ksh', 'scx'] as const) {
  test(`I-8 ${who.toUpperCase()}: logowanie → kokpit, harmonogram, mapa`, async ({ page }) => {
    test.setTimeout(120000);
    const runs: Record<string, number[]> = { login: [], sched: [], map: [] };
    let rows = 0;
    for (let i = 0; i < 3; i++) {
      await page.context().clearCookies();
      await page.goto('about:blank');
      const r = await fetch(`${URL_}/auth/v1/admin/generate_link`, { method: 'POST', headers: { apikey: SR, Authorization: `Bearer ${SR}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'magiclink', email: `${who}@bk5.local` }) });
      const g = await r.json() as { action_link?: string; properties?: { action_link?: string } };
      const hop = await fetch((g.action_link ?? g.properties?.action_link)!, { redirect: 'manual' });
      const loc = hop.headers.get('location') ?? '';
      const t0 = Date.now();
      await page.goto(APP + loc.slice(loc.indexOf('#')));
      await page.waitForSelector('[data-auth="session"]', { timeout: 60000 }); await page.waitForSelector('.kpi .v, main h2', { timeout: 60000 });
      runs.login.push(Date.now() - t0);
      const t1 = Date.now();
      await page.locator('nav [data-view="sched"]').first().click();
      await page.waitForSelector('.sched-table tbody tr', { timeout: 60000 });
      runs.sched.push(Date.now() - t1);
      rows = await page.locator('.sched-table tbody tr').count();
      const t2 = Date.now();
      await page.locator('nav [data-view="map"]').first().click();
      await page.waitForSelector('.leaflet-container', { timeout: 60000 });
      runs.map.push(Date.now() - t2);
      await page.evaluate(() => localStorage.clear());
    }
    const med = (a: number[]) => [...a].sort((x, y) => x - y)[1];
    const res = { role: who, rows, login_ms: med(runs.login), sched_ms: med(runs.sched), map_ms: med(runs.map), runs };
    const all = existsSync(OUT) && who !== 'hhl' ? JSON.parse(readFileSync(OUT, 'utf8')) : [];
    writeFileSync(OUT, JSON.stringify([...all, res], null, 1));
    console.log('I-8', JSON.stringify(res));
    expect(rows).toBeGreaterThan(0);
  });
}
