/**
 * III-9 (SCOPE 10.6, 0089) — ocena przewoźnika na BUILDZIE PRODUKCYJNYM i lokalnym Supabase (nigdy produkcja):
 * HHL ocenia rozładowany transport w szufladzie (4, komentarz) → wiersz carrier_ratings + audit_log; Opcje → „Ocena
 * przewoźników” pokazuje zrealizowane / na czas / ocenę; KSH nie widzi formularza ani karty.
 * Uruchamia: SPEC=tests/iii9-rating.local.spec.ts scripts/i2/local-ui.sh
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
test.skip(!LOCAL, 'ocena przewoźnika: wymaga I2_UI_BASE i lokalnego Supabase');

let LD = ''; let before = '';
test.beforeAll(() => {
  LD = psql(`select id from loads where status='PLANNED' and carrier_org_id is not null order by plan_load_date desc, id offset 2 limit 1`);
  before = psql(`select status||'|'||coalesce(actual_delivery_at::text,'') from loads where id='${LD}'`);
  psql(`set session_replication_role=replica; update loads set status='UNLOADED', actual_delivery_at=(plan_delivery_date::timestamp at time zone 'Europe/Stockholm') + interval '10 hours' where id='${LD}'`);
});
test.afterAll(() => {
  psql(`delete from carrier_ratings where load_id='${LD}'; set session_replication_role=replica; update loads set status='${before.split('|')[0]}', actual_delivery_at=null where id='${LD}'`);
});

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
async function openLoad(page: Page) {
  await page.locator('nav [data-view="sched"]').first().click();
  await page.locator(`tr[data-load="${LD}"]`).click();
}

test('HHL: ocena w szufladzie → baza; karta przewoźników w Opcjach', async ({ page }) => {
  test.setTimeout(120_000);
  await login(page, 'hhl@bk5.local');
  await openLoad(page);
  const f = page.locator('[data-carrier-rating-form]');
  await expect(f).toBeVisible();
  await f.locator('[name="score"]').selectOption('4');
  await f.locator('[name="comment"]').fill('Terminowo, drobne braki w CMR');
  await page.locator('[data-carrier-rating-save]').click();
  await expect(page.locator('[data-carrier-rating-msg="ok"]')).toBeVisible();
  await expect(page.locator('[data-carrier-rating="4"]')).toBeVisible();
  expect(psql(`select score||'/'||comment from carrier_ratings where load_id='${LD}'`)).toBe('4/Terminowo, drobne braki w CMR');
  expect(psql(`select (count(*) > 0)::text from audit_log where action='CARRIER_RATING' and entity_id='${LD}'`)).toBe('true');
  await page.keyboard.press('Escape');
  await page.locator('nav [data-view="options"]').first().click();
  const card = page.locator('[data-carrier-scorecard]');
  await expect(card).toBeVisible();
  await expect(card.locator('[data-scorecard-score]').first()).toContainText('4,00 / 5 (1)');
  await expect(card.locator('[data-scorecard-ontime]').first()).toContainText('1 (100%)');
  if (process.env.SHOT) await card.screenshot({ path: '/tmp/iii9-card.png' });
});

test('D-23 SCX: własna karta i oceny w Ustawieniach, ocena w szufladzie tylko do odczytu, bez notatki HHL', async ({ page }) => {
  test.setTimeout(120_000);
  await login(page, 'scx@bk5.local');
  await page.locator('nav [data-view="settings"]').first().click();
  const card = page.locator('[data-carrier-scorecard]');
  await expect(card).toBeVisible();
  await expect(card.locator('[data-scorecard-row]')).toHaveCount(1);
  await expect(card.locator('[data-scorecard-score]').first()).toContainText('4,00 / 5 (1)');
  await expect(card.locator('[data-my-rating="4"]')).toHaveCount(1);
  await expect(card).not.toContainText('drobne braki');
  if (process.env.SHOT) await card.screenshot({ path: '/tmp/d23-card.png' });
  await openLoad(page);
  await expect(page.locator('[data-carrier-rating-ro]')).toContainText('4 / 5');
  await expect(page.locator('[data-carrier-rating-form]')).toHaveCount(0);
  expect(await page.content()).not.toContain('drobne braki');
});

test('KSH: bez formularza oceny i bez karty', async ({ page }) => {
  test.setTimeout(90_000);
  await login(page, 'ksh@bk5.local');
  await openLoad(page);
  await expect(page.locator('.drawer')).toBeVisible();
  await expect(page.locator('[data-carrier-rating-form]')).toHaveCount(0);
  expect(psql(`select count(*) from carrier_ratings where load_id='${LD}'`)).toBe('1');
});
