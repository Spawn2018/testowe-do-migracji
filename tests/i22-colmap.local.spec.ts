/**
 * I-22 — kreator mapowania kolumn importu (build produkcyjny, lokalny Supabase).
 * Plik KSH z przemianowanymi nagłówkami → kreator → szablon w bazie → import 50/50 → ten sam układ drugi raz rozpoznany bez kreatora.
 * Uruchamia: SPEC=tests/i22-colmap.local.spec.ts scripts/i2/local-ui.sh
 */
import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import ExcelJS from 'exceljs';

const APP = process.env.I2_UI_BASE ?? '';
const URL_ = process.env.VITE_SUPABASE_URL ?? '';
const SR = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const DB = process.env.SUPABASE_DB_URL ?? '';
const LOCAL = !!APP && /^http:\/\/(127\.0\.0\.1|localhost):/.test(URL_);
const psql = (sql: string) => execFileSync('psql', [DB, '-Atq', '-c', sql]).toString().trim();
const FILE = 'test-results/i22_uklad_b.xlsx';
const RENAME: Record<string, string> = {
  'Wysyłka': 'Shipment ID', 'Ilość elementów': 'Qty', 'Rozmiar L x W x H': 'Size LxWxH',
  'Data załadunku': 'Loading date', 'Data dostawy na budowę': 'Delivery date',
};

test.describe.configure({ mode: 'serial' });
test.skip(!LOCAL, 'I-22 UI: wymaga I2_UI_BASE i lokalnego Supabase');

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

test.beforeAll(async () => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile('public/KSH_HARMONOGRAM.xlsx');
  wb.worksheets[0].getRow(1).eachCell((c) => { const v = String(c.value ?? '').trim(); if (RENAME[v]) c.value = RENAME[v]; });
  await wb.xlsx.writeFile(FILE);
});

test('HHL: nowy układ kolumn → kreator → szablon → import 50/50; drugi raz rozpoznany', async ({ page }) => {
  test.setTimeout(150_000);
  psql(`set session_replication_role = replica; delete from notifications; delete from load_events; delete from shipment_items; delete from schedule_imports; delete from loads; delete from import_column_templates;`);
  await page.goto(await loginUrl('hhl@bk5.local'));
  await page.waitForSelector('[data-auth="session"]', { timeout: 30000 });
  await page.locator('nav [data-view="sched"]').first().click();
  await page.getByRole('button', { name: /Wgraj|Import/ }).first().click();
  await page.locator('input[type="file"]').setInputFiles(FILE);
  const wiz = page.locator('[data-import-colmap]');
  await expect(wiz).toBeVisible({ timeout: 20000 });
  await expect(page.locator('[data-action="colmap-save"]')).toBeDisabled();
  await expect(page.locator('[data-colmap-field="itemType"]')).toHaveValue('Typ'); // niezmieniona kolumna dopasowana sama
  const pick: Record<string, string> = { shipmentCode: 'Shipment ID', qty: 'Qty', dimensions: 'Size LxWxH', loadDate: 'Loading date', deliveryDate: 'Delivery date' };
  for (const [f, h] of Object.entries(pick)) await page.locator(`[data-colmap-field="${f}"]`).selectOption(h);
  await page.locator('[data-colmap-name]').fill('Układ B (test)');
  await page.locator('[data-action="colmap-save"]').click();
  await expect(page.locator('[data-import-server]')).toContainText('Podgląd z bazy', { timeout: 20000 });
  expect(psql(`select name||'/'||(column_map->>'shipmentCode') from import_column_templates`)).toBe('Układ B (test)/Shipment ID');
  await page.getByRole('button', { name: 'Podgląd zmian' }).click();
  await expect(page.getByText('+50')).toBeVisible();
  await page.getByRole('button', { name: 'Zatwierdź' }).click();
  await expect(page.locator('[data-import-server]')).toContainText('Zapisano w bazie: wersja 1', { timeout: 20000 });
  await expect(page.locator('tr[data-load]')).toHaveCount(50, { timeout: 20000 });
  expect(psql(`select count(*)||'/'||max(column_map->>'shipmentCode') from schedule_imports`)).toBe('1/Shipment ID');
  // ten sam układ drugi raz → bez kreatora (szablon rozpoznany), bez zmian
  await page.getByRole('button', { name: /Wgraj|Import/ }).first().click();
  await page.locator('input[type="file"]').setInputFiles(FILE);
  await expect(page.locator('[data-import-server]')).toContainText('bez zmian: 50', { timeout: 20000 });
  await expect(wiz).toHaveCount(0);
});
