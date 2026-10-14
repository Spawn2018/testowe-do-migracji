/**
 * III-6 (SCOPE 6.1) — wymagalność i terminy dokumentów z bazy na BUILDZIE PRODUKCYJNYM i lokalnym Supabase.
 * HHL: tabela wymagań z bazy (wyglad/P5, E31: zezwolenia, CMR i dwie polisy — bez rysunku, POD i zdjęć mocowania),
 * kolumna „Po terminie” = stan z bazy; terminy tylko do odczytu na stronie Dokumenty. Zmiana terminu CMR —
 * Opcje › Zezwolenia i dokumenty (E12, L26), zapis w doc_requirements (audit_log) bez zmian.
 * KSH: widzi wymagania, bez przycisku zmiany; próba RPC jako KSH odrzucona w bazie (test i2).
 * Uruchamia: SPEC=tests/iii6-docs.local.spec.ts scripts/i2/local-ui.sh
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
test.skip(!LOCAL, 'wymagalność dokumentów: wymaga I2_UI_BASE i lokalnego Supabase');

test.afterAll(() => {
  psql(`update doc_requirements set offset_hours=2 where category='CMR'`);
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


test('HHL: wymagania z bazy, zmiana terminu CMR zapisana', async ({ page }) => {
  test.setTimeout(90_000);
  psql(`update doc_requirements set offset_hours=2 where category='CMR'`);
  await login(page, 'hhl@bk5.local');
  await page.locator('nav [data-view="docs"]').first().click();
  const cmr = page.locator('tr[data-docreq="CMR"]');
  await expect(cmr.locator('[data-docreq-text]')).toContainText('2 h');
  // wyglad/P5, E31 pkt 1: zezwolenie PL, zezwolenie SE, CMR, polisa przewoźnika, polisa HHL
  await expect(page.locator('tr[data-docreq]')).toHaveCount(5);
  await expect(page.locator('[data-docreq-note]')).toBeVisible();
  await expect(cmr.locator('[data-docreq-overdue]')).toHaveCount(1);
  await expect(page.locator('[data-action="docreq-edit"]')).toHaveCount(0);
  // stan z bazy: liczba „po terminie” w UI = liczba OVERDUE w doc_requirements_status (konto HHL widzi wszystkie transporty)
  const permit = page.locator('tr[data-docreq="PERMIT_PL"] [data-docreq-overdue]');
  const dbOverdue = psql(`select count(*) from doc_requirements_status((select id from projects limit 1)) where category='PERMIT_PL' and state='OVERDUE'`);
  await expect(permit).toHaveAttribute('data-docreq-overdue', dbOverdue);
  // zmiana terminu: Opcje › Zezwolenia i dokumenty (E12, L26)
  await page.locator('nav [data-view="options"]').first().click();
  await page.locator('[data-opt-nav="permits"]').first().click();
  const term = page.locator('[data-doc-terms] tr[data-docreq="CMR"]');
  await term.locator('[data-action="docreq-edit"]').click();
  await term.locator('[data-docreq-hours]').fill('6');
  await term.locator('[data-action="docreq-save"]').click();
  await expect(term.locator('[data-docreq-text]')).toContainText('6 h');
  await expect.poll(() => psql(`select offset_hours from doc_requirements where category='CMR'`)).toBe('6');
  expect(Number(psql(`select count(*) from audit_log where action='DOC_REQUIREMENT_SET' and new_value->>'offset_hours'='6'`))).toBeGreaterThan(0);
});

test('KSH: wymagania widoczne, bez możliwości zmiany', async ({ page }) => {
  test.setTimeout(90_000);
  await login(page, 'ksh@bk5.local');
  await page.locator('nav [data-view="docs"]').first().click();
  await expect(page.locator('tr[data-docreq="CMR"] [data-docreq-text]')).toContainText('h');
  await expect(page.locator('[data-action="docreq-edit"]')).toHaveCount(0);
});
