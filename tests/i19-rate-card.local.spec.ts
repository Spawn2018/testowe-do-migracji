/**
 * I-19 — formularz cennika HHL (0065), build produkcyjny na LOKALNYM Supabase.
 * Wersja 1 kosztu z przedziałem i STANDARD, wersja 2 z powodem, dziennik zmian; KSH nie widzi formularza.
 * Stawki TESTOWE (D-1: prawdziwych kwot nie wpisujemy). Uruchamia: SPEC=tests/i19-rate-card.local.spec.ts scripts/i2/local-ui.sh
 */
import { test, expect, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';

const APP = process.env.I2_UI_BASE ?? '';
const URL_ = process.env.VITE_SUPABASE_URL ?? '';
const SR = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const DB = process.env.SUPABASE_DB_URL ?? '';
const LOCAL = !!APP && /^http:\/\/(127\.0\.0\.1|localhost):/.test(URL_);
const psql = (sql: string) => execFileSync('psql', [DB, '-Atq', '-c', sql]).toString().trim();
const purge = () => psql(`delete from audit_log where action = 'RATE_CARD_VERSION'; select set_config('tower.rate_purge', 'on', true); delete from rate_cards;`);

test.describe.configure({ mode: 'serial' });
test.skip(!LOCAL, 'I-19 UI: wymaga I2_UI_BASE i lokalnego Supabase');

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

test('HHL: cennik kosztów — wersja 1, wersja 2 z powodem, dziennik', async ({ page }) => {
  test.setTimeout(90_000);
  await login(page, 'hhl@bk5.local');
  await page.locator('nav [data-view="options"]').first().click();
  const f = page.locator('[data-rate-card-form]');
  await expect(f).toContainText('brak zapisanego cennika');
  await expect(page.locator('[data-no-source="rate-card"]')).toHaveCount(0);
  const form = f.locator('[data-rate-card="form"]');
  await form.getByLabel('Obowiązuje od').fill('2026-10-01');
  await form.getByRole('button', { name: 'Dodaj przedział' }).click();
  const vals: Array<[string, string]> = [['Długość od, wiersz 1', '0'], ['Długość do, wiersz 1', '20'], ['Szerokość od, wiersz 1', '0'], ['Szerokość do, wiersz 1', '3'],
    ['Wysokość od, wiersz 1', '0'], ['Wysokość do, wiersz 1', '3'], ['Masa od, wiersz 1', '0'], ['Masa do, wiersz 1', '40']];
  for (const [l, v] of vals) await form.getByLabel(l, { exact: true }).fill(v);
  // brak stawki = błąd wiersza (nie zero)
  await form.getByRole('button', { name: 'Zapisz nową wersję cennika' }).click();
  await expect(f.locator('[role="status"]')).toContainText('Wiersz 1');
  await form.getByLabel('Stawka, wiersz 1', { exact: true }).fill('1,5');
  await form.getByLabel(/Stawka STANDARD/).fill('2');
  await form.getByRole('button', { name: 'Zapisz nową wersję cennika' }).click();
  await expect(f.locator('[data-rate-card-current]')).toHaveText('wersja 1 · od 2026-10-01', { timeout: 15000 });
  await expect(f.locator('[data-rate-version="1"]')).toContainText('pozycji: 2 · ze stawką STANDARD');
  // wersja 2: formularz wypełniony bieżącą wersją, powód wymagany
  await expect(form.getByLabel('Stawka, wiersz 1', { exact: true })).toHaveValue('1,5');
  await form.getByLabel(/Stawka STANDARD/).fill('');
  await form.getByLabel('Powód zmiany (wymagany)').fill('TEST bez STANDARD');
  await form.getByRole('button', { name: 'Zapisz nową wersję cennika' }).click();
  await expect(f.locator('[data-rate-card-current]')).toHaveText('wersja 2 · od 2026-10-01', { timeout: 15000 });
  await expect(f.locator('[data-rate-version="2"]')).toContainText('bez stawki STANDARD');
  await expect(f.locator('[data-rate-version="1"]')).toContainText('ze stawką STANDARD');
  const log = f.locator('[data-rate-card="log"]');
  await expect(log).toContainText('koszt (przewoźnik) · SCX · wersja 2 · pozycje 2 → 1 · TEST bez STANDARD');
  await expect(log).toContainText('koszt (przewoźnik) · SCX · wersja 1 · pozycje 0 → 2');
  // przychód: osobna numeracja, organizacja klienta
  await form.getByLabel('Strona').selectOption('REVENUE');
  await expect(form.getByLabel(/^Klient/)).toContainText('KSH');
  await expect(f.locator('[data-rate-card-current]')).toHaveText('brak zapisanego cennika');
  expect(psql(`select string_agg(side||':'||version, ',' order by version) from rate_cards`)).toBe('COST:1,COST:2');
});

test('KSH: brak formularza cennika', async ({ page }) => {
  await login(page, 'ksh@bk5.local');
  const opt = page.locator('nav [data-view="options"]');
  if (await opt.count()) {
    await opt.first().click();
    await expect(page.locator('[data-rate-card-form]')).toHaveCount(0);
  }
});
