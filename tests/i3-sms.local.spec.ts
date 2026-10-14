/**
 * I-3 — panel bramki SMS dla HHL (0067/0068), build produkcyjny na LOKALNYM Supabase.
 * Przed R-2: znacznik „przed R-2”, token urządzenia raz, numer testowy, SMS testowy w kolejce.
 * Uruchamia: SPEC=tests/i3-sms.local.spec.ts scripts/i2/local-ui.sh
 */
import { test, expect, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';

const APP = process.env.I2_UI_BASE ?? '';
const URL_ = process.env.VITE_SUPABASE_URL ?? '';
const SR = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const DB = process.env.SUPABASE_DB_URL ?? '';
const LOCAL = !!APP && /^http:\/\/(127\.0\.0\.1|localhost):/.test(URL_);
const psql = (sql: string) => execFileSync('psql', [DB, '-Atq', '-c', sql]).toString().trim();
const purge = () => psql(`delete from sms_outbox; delete from sms_test_numbers; delete from sms_devices; update security_flags set enabled = false where key = 'EXTERNAL_MESSAGING';`);

test.describe.configure({ mode: 'serial' });
test.skip(!LOCAL, 'I-3 UI: wymaga I2_UI_BASE i lokalnego Supabase');

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

test.beforeAll(purge);
test.afterAll(purge);

test('HHL: bramka SMS — urządzenie, numer testowy, SMS testowy (przed R-2)', async ({ page }) => {
  test.setTimeout(90_000);
  await login(page, 'hhl@bk5.local');
  await page.locator('nav [data-view="options"]').first().click();
  /* D-20261014-0700-01 J5: bramka SMS → zones. */
  await page.locator('[data-opt-nav="zones"]').click();
  const g = page.locator('[data-sms-gateway]');
  await expect(g.locator('[data-sms-external="off"]')).toHaveText('przed R-2: tylko SMS testowe i e-mail na log-mar.pl');
  await g.getByLabel('Nazwa telefonu').fill('Pixel test');
  await g.getByRole('button', { name: 'Wydaj token urządzenia' }).click();
  await expect(g.locator('[data-sms-token]')).toContainText(/sd_[0-9a-f]{64}/, { timeout: 15000 });
  await expect(g.locator('[data-sms-device="Pixel test"]')).toContainText('dziś 0/150');
  await g.getByLabel('Numer (E.164)').fill('+48600000001');
  await g.getByLabel('Opis').fill('telefon HHL');
  await g.getByRole('button', { name: 'Dodaj numer' }).click();
  await expect(g.locator('[data-sms="test-numbers"]')).toContainText('telefon HHL · …001');
  await g.getByRole('button', { name: 'Wyślij SMS testowy' }).click();
  await expect(g.locator('[data-sms-row="TEST"]')).toContainText('QUEUED · …001');
  await g.getByRole('button', { name: 'Wstrzymaj' }).click();
  await expect(g.locator('[data-sms-device="Pixel test"]')).toContainText('wstrzymane');
  expect(psql(`select count(*) from sms_outbox where kind = 'TEST'`)).toBe('1');
});
