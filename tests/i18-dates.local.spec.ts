/**
 * I-18 — status dat planu WSTĘPNA | POTWIERDZONA w buildzie produkcyjnym na LOKALNYM Supabase (0061). Widoki trzech ról:
 * KSH potwierdza i zmienia daty w szufladzie; HHL i przewoźnik (SCX) widzą status (✓ w harmonogramie, autor i czas);
 * SCX bez formularza. Zmiana potwierdzonej daty = zdarzenie + powiadomienie HHL i przewoźnika.
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
test.skip(!LOCAL, 'I-18 UI: wymaga I2_UI_BASE i lokalnego Supabase');

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

async function openLoad(page: Page) {
  await page.locator('nav [data-view="sched"]').first().click();
  await page.locator(`tr[data-load="${LD}"]`).click();
  await expect(page.locator('[data-plan-dates]')).toBeVisible();
}

test.beforeAll(() => {
  LD = psql(`select id from loads where status='PLANNED' and carrier_org_id is not null order by plan_load_date, id limit 1`);
  psql(`update loads set plan_load_date='${day(12)}', plan_delivery_date='${day(17)}', plan_dates_status='WSTEPNA',
        plan_dates_confirmed_by=null, plan_dates_confirmed_at=null where id='${LD}'`);
  psql(`delete from notifications where template='PLAN_DATES_CHANGED'`);
});

test('SCX: data WSTĘPNA, bez formularza „Potwierdź daty”', async ({ page }) => {
  await login(page, 'scx@bk5.local');
  await openLoad(page);
  await expect(page.locator('[data-plan-dates]')).toHaveAttribute('data-plan-dates', 'WSTEPNA');
  await expect(page.locator('[data-plan-dates-form]')).toHaveCount(0);
});

test('KSH: potwierdza daty, potem zmienia potwierdzoną datę', async ({ page }) => {
  await login(page, 'ksh@bk5.local');
  await openLoad(page);
  await expect(page.locator('[data-plan-dates-form]')).toBeVisible();
  await page.locator('[data-plan-dates-confirm]').click();
  await expect(page.locator('[data-plan-dates]')).toHaveAttribute('data-plan-dates', 'POTWIERDZONA', { timeout: 15000 });
  await expect(page.locator('[data-plan-dates-by]')).toBeVisible();
  expect(psql(`select plan_dates_status from loads where id='${LD}'`)).toBe('POTWIERDZONA');
  await page.locator('[data-plan-dates-form] input[name="ld"]').fill(day(13));
  await page.locator('[data-plan-dates-form] input[name="dd"]').fill(day(18));
  await page.locator('[data-plan-dates-confirm]').click();
  await expect.poll(() => psql(`select plan_load_date from loads where id='${LD}'`)).toBe(day(13));
  expect(psql(`select count(*) from load_events where load_id='${LD}' and event_type='PLAN_DATES_CHANGED'`)).toBe('1');
  expect(psql(`select string_agg(distinct o.code, ',' order by o.code) from notifications n join app_users u on u.id=n.user_id
               join organizations o on o.id=u.org_id where n.template='PLAN_DATES_CHANGED' and n.channel='IN_APP'`)).not.toMatch(/KSH/);
});

for (const who of ['hhl', 'scx'] as const) {
  test(`${who.toUpperCase()}: widzi datę POTWIERDZONĄ (szuflada i ✓ w harmonogramie), bez formularza`, async ({ page }) => {
    await login(page, `${who}@bk5.local`);
    await openLoad(page);
    await expect(page.locator('[data-plan-dates]')).toHaveAttribute('data-plan-dates', 'POTWIERDZONA');
    await expect(page.locator('[data-plan-dates-by]')).toBeVisible();
    await expect(page.locator('[data-plan-dates-form]')).toHaveCount(0);
    await expect(page.locator(`tr[data-load="${LD}"] [data-date-status="POTWIERDZONA"]`).first()).toBeVisible();
  });
}
