/**
 * DATY-67 — „Potwierdź daty” usunięte (daty z pliku KSH).
 * Spec I-18 UI zastąpiony: brak [data-plan-dates] / formularza potwierdzenia.
 * Uruchamia: SPEC=tests/i18-dates.local.spec.ts scripts/i2/local-ui.sh
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
test.skip(!LOCAL, 'DATY-67 UI: wymaga I2_UI_BASE i lokalnego Supabase');

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

const day = (n: number) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
let LD = '';

test('DATY-67: brak „Potwierdź daty”; daty z pliku (POTWIERDZONA)', async ({ page }) => {
  LD = psql(`select id from loads where order_no is not null limit 1`);
  test.skip(!LD, 'brak transportu w lokalnej bazie');
  psql(`update loads set plan_load_date='${day(12)}', plan_delivery_date='${day(17)}', plan_dates_status='POTWIERDZONA',
        plan_dates_confirmed_by=null, plan_dates_confirmed_at=now() where id='${LD}'`);

  await login(page, 'ksh@test');
  await page.locator('nav [data-view="sched"]').first().click();
  await page.locator(`tr[data-load="${LD}"]`).click();
  await expect(page.locator('[data-plan-dates]')).toHaveCount(0);
  await expect(page.locator('[data-plan-dates-confirm]')).toHaveCount(0);
  await expect(page.locator('[data-date-status]')).toHaveCount(0);

  await login(page, 'hhl@test');
  await page.locator('nav [data-view="sched"]').first().click();
  await expect(page.locator(`tr[data-load="${LD}"] [data-date-status]`)).toHaveCount(0);
});
