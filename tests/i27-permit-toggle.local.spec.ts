/**
 * I-27 (0084) — przełącznik „brak zezwolenia blokuje Gotowy” w Opcjach (HHL_ADMIN) na BUILDZIE PRODUKCYJNYM i lokalnym Supabase:
 * domyślnie wyłączony → włączenie zapisuje flagę + audit_log → wyłączenie przywraca stan. KSH panelu nie widzi.
 * Uruchamia: SPEC=tests/i27-permit-toggle.local.spec.ts scripts/i2/local-ui.sh
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
test.skip(!LOCAL, 'I-27: wymaga I2_UI_BASE i lokalnego Supabase');
const flag = () => psql(`select enabled::text from security_flags where key='PERMIT_REQUIRED_NON_STANDARD'`);
test.beforeAll(() => { psql(`update security_flags set enabled=false where key='PERMIT_REQUIRED_NON_STANDARD'`); });
test.afterAll(() => { psql(`update security_flags set enabled=false where key='PERMIT_REQUIRED_NON_STANDARD'`); });

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



async function openOptions(page: Page) {
  await page.locator('nav [data-view="options"], nav [data-view="settings"]').first().click();
  /* D-20261014-0700-01 J5: wymóg zezwoleń → permits. */
  await page.locator('[data-opt-nav="permits"]').click();
}

test('HHL_ADMIN: włącza i wyłącza wymóg zezwoleń (flaga + audit_log)', async ({ page }) => {
  test.setTimeout(90_000);
  await login(page, 'hhl@bk5.local');
  await openOptions(page);
  const panel = page.locator('[data-permit-requirement]');
  await expect(panel).toHaveAttribute('data-permit-requirement', 'off');
  await panel.locator('[data-action="permit-requirement"]').click();
  await expect(page.locator('[data-permit-requirement="on"]')).toBeVisible();
  expect(flag()).toBe('true');
  expect(Number(psql(`select count(*) from audit_log where action='PERMIT_REQUIREMENT_SET' and new_value->>'enabled'='true'`))).toBeGreaterThan(0);
  await page.locator('[data-permit-requirement] [data-action="permit-requirement"]').click();
  await expect(page.locator('[data-permit-requirement="off"]')).toBeVisible();
  expect(flag()).toBe('false');
});

test('KSH: panelu wymogu zezwoleń nie ma', async ({ page }) => {
  test.setTimeout(90_000);
  await login(page, 'ksh@bk5.local');
  const nav = page.locator('nav [data-view="options"], nav [data-view="settings"]');
  if (await nav.count()) await nav.first().click();
  await page.waitForTimeout(1500);
  await expect(page.locator('[data-permit-requirement]')).toHaveCount(0);
});
