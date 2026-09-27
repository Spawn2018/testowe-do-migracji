/**
 * I-2 — „zero fasady” w buildzie produkcyjnym (VITE_AUTH_MODE=supabase) na LOKALNYM Supabase.
 * KSH/SCX: bez przełącznika widoku; nikt nie ma Workflows; brak „fala”; szuflada: ETA v1 z bazy (± min);
 * HHL: przełącznik jest; ryzyka z notatkami „brak źródła danych”; formularz BAF/SEFS zapisuje wersję,
 * odczyt, korektę i dziennik. Uruchamia scripts/i2/local-ui.sh (I2_UI_BASE, lokalne klucze); bez zmiennej pomijany.
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
test.skip(!LOCAL, 'I-2 UI: wymaga I2_UI_BASE i lokalnego Supabase');

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

for (const who of ['ksh', 'scx'] as const) {
  test(`${who.toUpperCase()}: bez przełącznika widoku, bez Workflows, bez „fala”`, async ({ page }) => {
    await login(page, `${who}@bk5.local`);
    await expect(page.locator('.roleswitch')).toHaveCount(0);
    await expect(page.locator('nav [data-view="wf"]')).toHaveCount(0);
    await expect(page.locator('body')).not.toContainText(/fala \d/);
  });
}

test('HHL: przełącznik jest; brak Workflows; ryzyka „brak źródła danych”; szuflada z ETA v1 z bazy', async ({ page }) => {
  expect(Number(psql('select count(*) from loads where eta_basis is not null'))).toBeGreaterThan(0);
  await login(page, 'hhl@bk5.local');
  await expect(page.locator('.roleswitch')).toHaveCount(1);
  await expect(page.locator('nav [data-view="wf"]')).toHaveCount(0);
  await page.locator('nav [data-view="risk"]').first().click();
  await expect(page.locator('[data-panel="ferry"][data-source="db"]')).toBeVisible();
  await expect(page.locator('[data-no-source="sea"]')).toBeVisible();
  await expect(page.locator('[data-no-source="ferry-alt"]')).toBeVisible();
  await page.locator('nav [data-view="sched"]').first().click();
  await page.locator('tr[data-load]').first().click();
  await expect(page.locator('[data-eta="db"]')).toContainText(/± \d+ min · ETA v1/);
  await expect(page.locator('[data-permit]')).toHaveCount(1);
  await expect(page.locator('.drawer')).not.toContainText(/PL\/2026\/14\d\d|HHL\/2026\/12\d\d/);
});

test('I-2j KSH: mapa — pozycja promu z bazy z czasem odczytu albo „brak źródła danych”', async ({ page }) => {
  psql(`delete from vessel_positions`);
  await login(page, 'ksh@bk5.local');
  await page.locator('nav [data-view="map"]').first().click();
  await expect(page.locator('[data-ais="none"]')).toHaveText('brak źródła danych');
  const before = await page.locator('.wt-marker-ferry').count();
  psql(`insert into vessel_positions (vessel_id, lat, lon, sog_kn, cog, observed_at) select id, 58.2, 18.1, 16.5, 12, '2026-09-27T18:10:00Z' from vessels where mmsi = 311000787`);
  await page.reload();
  await page.waitForSelector('[data-auth="session"]', { timeout: 30000 });
  await page.locator('nav [data-view="map"]').first().click();
  await expect(page.locator('[data-ais="db"]')).toContainText(/z bazy, ostatni odczyt 27\.09\.2026,? 20:10/);
  await expect(page.locator('.wt-marker-ferry')).toHaveCount(before + 1);
  await expect(page.locator('.note')).toContainText('Dane AIS: Fintraffic / digitraffic.fi, licencja CC BY 4.0');
  psql(`delete from vessel_positions`);
});

test('I-2l HHL: kafelek „czas wykrycia odchylenia” — „—” bez danych, potem mediana z risk_signals', async ({ page }) => {
  psql(`delete from risk_signals where dedup_key like 'E2E-I2L-%'`);
  const base = Number(psql(`select count(*) from risk_signals where load_id is not null and occurred_at is not null and detected_at > now() - interval '30 days'`));
  test.skip(base > 0, 'baza lokalna ma już ryzyka z czasem zdarzenia');
  await login(page, 'hhl@bk5.local');
  const tile = page.locator('.kpi', { hasText: 'Czas wykrycia odchylenia' });
  await expect(tile.locator('.v')).toHaveText('—');
  psql(`insert into risk_signals (project_id, load_id, kind, severity, title, title_key, detail, dedup_key) select project_id, id, 'AUTO_STATUS', 'LOW', 'e2e', 'rk_generic', jsonb_build_object('occurred_at', now() - interval '12 minutes'), 'E2E-I2L-1' from loads order by id limit 1`);
  await page.reload();
  await page.waitForSelector('[data-auth="session"]', { timeout: 30000 });
  await expect(tile.locator('.v')).toHaveText('12 min');
  await expect(tile.locator('.d')).toHaveText('mediana · n = 1 (30 dni)');
  psql(`delete from risk_signals where dedup_key like 'E2E-I2L-%'`);
});

test('HHL: formularz BAF/SEFS — wersja parametrów, odczyt, korekta, dziennik', async ({ page }) => {
  test.setTimeout(90_000);
  psql(`set session_replication_role = replica; delete from fuel_index_readings; delete from sefs_parameters; delete from audit_log where action in ('SEFS_PARAMS_VERSION','FUEL_READING_ADD','FUEL_READING_CORRECT');`);
  await login(page, 'hhl@bk5.local');
  await page.locator('nav [data-view="options"]').first().click();
  const f = page.locator('[data-baf-form]');
  await expect(f).toContainText('brak zapisanych parametrów');
  await expect(page.locator('[data-no-source="rate-card"]')).toBeVisible();
  const p = f.locator('[data-baf="params"]');
  await p.getByLabel('Obowiązuje od').fill('2026-10-01');
  await p.getByLabel('Baza SEK/l').fill('18,50');
  await p.getByLabel('Baza PLN/l').fill('5,90');
  await p.getByLabel('Źródło SEK (adres)').fill('https://www.okq8.se/pa-stationen/drivmedel/');
  await p.getByLabel('Źródło PLN (adres)').fill('https://www.orlen.pl/pl/dla-biznesu/hurtowe-ceny-archiwalne');
  await p.getByLabel(/Tablica SEK/).fill('18.5;1\n20;1.02\n30;1.05');
  await p.getByLabel(/Tablica PLN/).fill('5.9;1\n6.5;1.01\n9;1.04');
  await p.getByRole('button', { name: 'Zapisz nową wersję' }).click();
  await expect(f).toContainText('wersja 1 · od 2026-10-01', { timeout: 15000 });
  await expect(f.locator('[data-baf-unagreed]')).toBeVisible();
  const r = f.locator('[data-baf="reading"]');
  for (const [idx, val] of [['SEK', '19,20'], ['PLN', '6,40']] as const) {
    await r.getByLabel('Indeks').selectOption(idx);
    await r.getByLabel(/^Okres/).fill('2026-09');
    await r.getByLabel('Data odczytu').fill('2026-09-25');
    await r.getByLabel(/Wartość/).fill(val);
    await r.getByLabel('Adres źródła').fill('https://example.org/odczyt');
    await r.getByRole('button', { name: 'Dodaj odczyt' }).click();
    await expect(f.locator('[data-baf="readings"]')).toContainText(`${idx} · 2026-09`, { timeout: 15000 });
  }
  await expect(f.locator('[data-baf-preview]')).toContainText('SEK 1.020, PLN 1.010 → stosowany min = 1.010');
  await f.locator('[data-baf="readings"] [data-reading]', { hasText: 'SEK · 2026-09' }).getByRole('button', { name: 'Koryguj' }).click();
  await r.getByLabel('Data odczytu').fill('2026-09-26');
  await r.getByLabel(/Wartość/).fill('18,00');
  await r.getByLabel(/Powód korekty/).fill('pomyłka przy przepisywaniu');
  await r.getByRole('button', { name: 'Zapisz korektę' }).click();
  await expect(f.locator('[data-baf-preview]')).toContainText('SEK 1.000, PLN 1.010 → stosowany min = 1.000', { timeout: 15000 });
  await expect(f.locator('[data-baf="log"] .auth-admin-row')).toHaveCount(4);
  await expect(f.locator('[data-baf="log"]')).toContainText('korekta odczytu');
  expect(psql(`select count(*)||'/'||(select count(*) from fuel_index_readings)||'/'||(select count(*) from fuel_index_readings where corrects_id is not null) from sefs_parameters`)).toBe('1/3/1');
  psql(`set session_replication_role = replica; delete from fuel_index_readings; delete from sefs_parameters; delete from audit_log where action in ('SEFS_PARAMS_VERSION','FUEL_READING_ADD','FUEL_READING_CORRECT');`);
});
