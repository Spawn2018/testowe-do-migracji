/**
 * I-13 — parametry SEFS tylko do odczytu w Ustawieniach KSH i przewoźnika (0063), build produkcyjny na LOKALNYM Supabase.
 * Przewoźnik: COST i BOTH wyłącznie uzgodnione; KSH: REVENUE i BOTH. Uruchamia: SPEC=tests/i13-sefs.local.spec.ts scripts/i2/local-ui.sh
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
test.skip(!LOCAL, 'I-13 UI: wymaga I2_UI_BASE i lokalnego Supabase');

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

test.beforeAll(() => {
  // wersje testowe tylko na lokalnej bazie (append-only: istniejące zostają, dopisujemy 4 nowe)
  const ins = (applies: string, agreed: boolean) => psql(`insert into sefs_parameters (project_id, version, valid_from, base_sek, base_pln, index_sek, index_pln,
      source_url_sek, source_url_pln, tiers_sek, tiers_pln, agreed_with_carrier, applies_to)
    select p.id, coalesce((select max(version) from sefs_parameters where project_id = p.id), 0) + 1, current_date, 19.47, 5.698, 'OKQ8', 'ORLEN',
      'https://www.okq8.se/', 'https://www.orlen.pl/', '[{"lte":25,"mult":1}]', '[{"lte":6,"mult":1}]', ${agreed}, '${applies}'
    from projects p where p.code = 'STEGRA_BODEN'`);
  ins('COST', true); ins('REVENUE', false); ins('COST', false); ins('BOTH', true);
});

const visible = async (page: Page) => page.locator('[data-sefs-version]').evaluateAll((els) => els.map((e) => e.getAttribute('data-sefs-applies')).join(','));

test('SCX: Ustawienia — SEFS tylko do odczytu: COST i BOTH, wyłącznie uzgodnione', async ({ page }) => {
  await login(page, 'scx@bk5.local');
  await page.locator('nav [data-view="settings"]').first().click();
  await expect(page.locator('[data-sefs-readonly]')).toBeVisible();
  await expect(page.locator('[data-sefs-version]').first()).toBeVisible();
  const n = Number(psql(`select count(*) from sefs_parameters where applies_to in ('COST','BOTH') and agreed_with_carrier`));
  await expect(page.locator('[data-sefs-version]')).toHaveCount(Math.min(n, 12));
  expect(await visible(page)).not.toMatch(/REVENUE/);
  await expect(page.locator('[data-sefs-readonly] input, [data-sefs-readonly] button')).toHaveCount(0);
});

test('KSH: Ustawienia — SEFS: REVENUE i BOTH, bez COST', async ({ page }) => {
  await login(page, 'ksh@bk5.local');
  await page.locator('nav [data-view="settings"]').first().click();
  await expect(page.locator('[data-sefs-version]').first()).toBeVisible();
  const n = Number(psql(`select count(*) from sefs_parameters where applies_to in ('REVENUE','BOTH')`));
  await expect(page.locator('[data-sefs-version]')).toHaveCount(Math.min(n, 12));
  expect(await visible(page)).not.toMatch(/COST/);
});
