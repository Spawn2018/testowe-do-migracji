/**
 * I-1 — import harmonogramu w interfejsie buildu produkcyjnego (VITE_AUTH_MODE=supabase) na LOKALNYM Supabase.
 * HHL: wgranie pełnego KSH_HARMONOGRAM.xlsx → podgląd z bazy (+50, w tym 9 „Standard”) → zatwierdzenie → 50 wierszy w tabeli, wersja 1.
 * KSH i SCX: brak przycisku importu. Uruchamia scripts/i1/local-ui.sh (I1_UI_BASE, lokalne klucze); bez zmiennej pomijany.
 */
import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';

const APP = process.env.I1_UI_BASE ?? '';
const URL_ = process.env.VITE_SUPABASE_URL ?? '';
const SR = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const DB = process.env.SUPABASE_DB_URL ?? '';
const LOCAL = !!APP && /^http:\/\/(127\.0\.0\.1|localhost):/.test(URL_);
const psql = (sql: string) => execFileSync('psql', [DB, '-Atq', '-c', sql]).toString().trim();

test.describe.configure({ mode: 'serial' });
test.skip(!LOCAL, 'I-1 UI: wymaga I1_UI_BASE i lokalnego Supabase');

async function loginUrl(email: string): Promise<string> {
  const r = await fetch(`${URL_}/auth/v1/admin/generate_link`, {
    method: 'POST', headers: { apikey: SR, Authorization: `Bearer ${SR}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'magiclink', email }),
  });
  const g = await r.json() as { action_link?: string; properties?: { action_link?: string } };
  const hop = await fetch((g.action_link ?? g.properties?.action_link)!, { redirect: 'manual' });
  const loc = hop.headers.get('location') ?? '';
  return APP + loc.slice(loc.indexOf('#'));
}

test('HHL importuje pełny harmonogram przez interfejs (podgląd z bazy, zapis, wersja)', async ({ page }) => {
  test.setTimeout(120_000);
  psql(`set session_replication_role = replica; delete from notifications; delete from load_events; delete from shipment_items; delete from schedule_imports; delete from loads;`);
  await page.goto(await loginUrl('hhl@bk5.local'));
  await page.waitForSelector('[data-auth="session"]', { timeout: 30000 });
  await page.locator('nav [data-view="sched"]').first().click();
  await expect(page.getByText('brak zaimportowanego harmonogramu')).toBeVisible();
  await page.getByRole('button', { name: /Wgraj|Import/ }).first().click();
  await page.locator('input[type="file"]').setInputFiles('tests/fixtures/ksh-harmonogram-synthetic.xlsx');
  await expect(page.locator('[data-import-server]')).toContainText('Podgląd z bazy', { timeout: 20000 });
  await expect(page.locator('[data-import-server]')).toContainText('Scandinavian Express');
  await page.getByRole('button', { name: 'Podgląd zmian' }).click();
  await expect(page.getByText('+5')).toBeVisible();
  expect(psql('select count(*) from loads')).toBe('0');
  await page.getByRole('button', { name: 'Zatwierdź' }).click();
  await expect(page.locator('[data-import-server]')).toContainText('Zapisano w bazie: wersja 1', { timeout: 20000 });
  await expect(page.locator('tr[data-load]')).toHaveCount(5, { timeout: 20000 });
  await expect(page.locator('[data-import-standard]')).toContainText('Pominięto 3 wiersze typu STANDARD');
  await expect(page.locator('tr[data-load]', { hasText: 'STD-01' })).toHaveCount(0);
  await expect(page.getByText(/wersja 1 · .* · ksh-harmonogram-synthetic\.xlsx/)).toBeVisible();
  expect(psql(`select count(*)||'/'||(select count(*) from shipment_items)||'/'||(select count(*) from schedule_imports where file_path like 'harmonogramy/%' and length(file_hash)=64) from loads`)).toBe('5/5/1');
  expect(psql(`select count(*) from storage.objects where bucket_id='harmonogramy' and name like '%.xlsx' and name not like 'i1-%' and name not like '%/i1-%'`)).toBe('1');
  // ten sam plik drugi raz → bez zmian
  await page.getByRole('button', { name: /Wgraj|Import/ }).first().click();
  await page.locator('input[type="file"]').setInputFiles('tests/fixtures/ksh-harmonogram-synthetic.xlsx');
  await expect(page.locator('[data-import-server]')).toContainText('bez zmian: 5', { timeout: 20000 });
  await page.getByRole('button', { name: 'Podgląd zmian' }).click();
  await page.getByRole('button', { name: 'Zatwierdź' }).click();
  await expect(page.locator('[data-import-server]')).toContainText('Bez zmian', { timeout: 20000 });
  expect(psql('select count(*) from schedule_imports')).toBe('1');
});

for (const who of ['ksh@bk5.local', 'scx@bk5.local']) {
  test(`${who.slice(0, 3).toUpperCase()}: brak importu w interfejsie`, async ({ page }) => {
    await page.goto(await loginUrl(who));
    await page.waitForSelector('[data-auth="session"]', { timeout: 30000 });
    await page.locator('nav [data-view="sched"]').first().click();
    await expect(page.locator('tr[data-load]').first()).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole('button', { name: /Wgraj|Import/ })).toHaveCount(0);
  });
}
