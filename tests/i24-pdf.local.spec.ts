/**
 * I-24 — eksport harmonogramu do PDF (build produkcyjny, lokalny Supabase): przycisk obok XLSX pobiera plik %PDF.
 * Uruchamia: SPEC=tests/i24-pdf.local.spec.ts scripts/i2/local-ui.sh
 */
import { test, expect, type Page } from '@playwright/test';

const APP = process.env.I2_UI_BASE ?? '';
const URL_ = process.env.VITE_SUPABASE_URL ?? '';
const SR = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const LOCAL = !!APP && /^http:\/\/(127\.0\.0\.1|localhost):/.test(URL_);

test.describe.configure({ mode: 'serial' });
test.skip(!LOCAL, 'I-24 UI: wymaga I2_UI_BASE i lokalnego Supabase');

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

test('HHL: harmonogram → Eksport PDF pobiera plik PDF', async ({ page }) => {
  test.setTimeout(90_000);
  await login(page, 'hhl@bk5.local');
  await page.locator('nav [data-view="sched"]').first().click();
  const dl = page.waitForEvent('download');
  await page.locator('[data-action="export-pdf"]').click();
  const d = await dl;
  expect(d.suggestedFilename()).toMatch(/harmonogram\.pdf$/);
  const p = await d.path();
  const fs = await import('node:fs');
  expect(fs.readFileSync(p!).subarray(0, 5).toString()).toBe('%PDF-');
});
