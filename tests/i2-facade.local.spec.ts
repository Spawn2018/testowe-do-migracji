/**
 * I-2 — „zero fasady” w buildzie produkcyjnym (VITE_AUTH_MODE=supabase) na LOKALNYM Supabase.
 * KSH/SCX: bez przełącznika widoku; nikt nie ma Workflows; brak „fala”; szuflada: ETA v1 z bazy (± min);
 * HHL: przełącznik jest; ryzyka z notatkami „brak źródła danych”; formularz BAF/SEFS zapisuje wersję,
 * odczyt, korektę i dziennik. Uruchamia scripts/i2/local-ui.sh (I2_UI_BASE, lokalne klucze); bez zmiennej pomijany.
 */
import { test, expect, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { createHmac } from 'node:crypto';

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

test('HHL (HHL_ADMIN): przełącznik jest; Automatyzacje z bazy (9.4); ryzyka „brak źródła danych”; szuflada z ETA v1 z bazy', async ({ page }) => {
  expect(Number(psql('select count(*) from loads where eta_basis is not null'))).toBeGreaterThan(0);
  await login(page, 'hhl@bk5.local');
  await expect(page.locator('.roleswitch')).toHaveCount(1);
  await expect(page.locator('nav [data-view="wf"]')).toHaveCount(1);
  await page.locator('nav [data-view="risk"]').first().click();
  await expect(page.locator('[data-panel="ferry"][data-source="db"]')).toBeVisible();
  await expect(page.locator('[data-no-source="sea"]')).toBeVisible();
  await expect(page.locator('[data-ferry-alt="db"]')).toBeVisible();
  const ferry = page.locator('[data-panel="ferry"][data-source="db"]');
  await expect(ferry).not.toContainText('TT-Line');
  await expect(ferry).not.toContainText('Unity Line');
  await expect(ferry).not.toContainText('Karlshamn');
  await expect(page.locator('[data-panel="road-se"] .alt-list')).toHaveCount(0);
  await page.locator('nav [data-view="sched"]').first().click();
  await page.locator('tr[data-load]').first().click();
  /* przepisane w wyglad/P4-b — E15 pkt 6 i 8: blok ETA w Przeglądzie; przed wyjazdem „ETA: –”, w trasie „± N MIN · SŁOWO” z bazy */
  const eta = page.locator('[data-eta-block]');
  await expect(eta).toHaveCount(1);
  if ((await eta.getAttribute('data-eta')) === 'value') await expect(page.locator('[data-eta="db"]')).toContainText(/± \d+ MIN · /);
  else await expect(eta).toContainText('ETA: –');
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

/* Przepisane w wyglad/P3-b — E9 (decyzja 07.10 19:11, B6): czas wykrycia to stopka pod kafelkami HHL, nie kafelek;
   poniżej 5 zdarzeń „za mało danych (n z 5 zdarzeń w 30 dniach)”, od 5 zdarzeń mediana. */
test('I-2l HHL: stopka „Czas wykrycia odchylenia” — brak danych, potem „za mało danych” z risk_signals (B6)', async ({ page }) => {
  psql(`delete from risk_signals where dedup_key like 'E2E-I2L-%'`);
  const base = Number(psql(`select count(*) from risk_signals where load_id is not null and occurred_at is not null and detected_at > now() - interval '30 days'`));
  test.skip(base > 0, 'baza lokalna ma już ryzyka z czasem zdarzenia');
  await login(page, 'hhl@bk5.local');
  const foot = page.locator('[data-cockpit] [data-detect-lag]');
  await expect(foot).toHaveText('Czas wykrycia odchylenia: brak danych (0 z 5 zdarzeń w 30 dniach)');
  psql(`insert into risk_signals (project_id, load_id, kind, severity, title, title_key, detail, dedup_key) select project_id, id, 'AUTO_STATUS', 'LOW', 'e2e', 'rk_generic', jsonb_build_object('occurred_at', now() - interval '12 minutes'), 'E2E-I2L-1' from loads order by id limit 1`);
  await page.reload();
  await page.waitForSelector('[data-auth="session"]', { timeout: 30000 });
  await expect(foot).toHaveText('Czas wykrycia odchylenia: za mało danych (1 z 5 zdarzeń w 30 dniach)');
  await expect(foot.locator('b')).toHaveText('za mało danych');
  psql(`delete from risk_signals where dedup_key like 'E2E-I2L-%'`);
});

test('HHL: formularz BAF/SEFS — wersja parametrów, odczyt, korekta, dziennik', async ({ page }) => {
  test.setTimeout(90_000);
  psql(`set session_replication_role = replica; delete from fuel_index_readings; delete from sefs_parameters; delete from audit_log where action in ('SEFS_PARAMS_VERSION','FUEL_READING_ADD','FUEL_READING_CORRECT');`);
  await login(page, 'hhl@bk5.local');
  await page.locator('nav [data-view="options"]').first().click();
  /* D-20261014-0700-01 J5: BAF → fuel (cennik osobno w i19 → rates). */
  await page.locator('[data-opt-nav="fuel"]').click();
  const f = page.locator('[data-baf-form]');
  await expect(f).toContainText('brak zapisanych parametrów');
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
    await r.getByLabel(/^Dzień odczytu/).fill('2026-09-25');
    await r.getByLabel(/Wartość/).fill(val);
    await r.getByLabel('Adres źródła').fill('https://example.org/odczyt');
    await r.getByRole('button', { name: 'Dodaj odczyt' }).click();
    await expect(f.locator('[data-baf="readings"]')).toContainText(`${idx} · 2026-09-25`, { timeout: 15000 });
  }
  await expect(f.locator('[data-baf-preview]')).toContainText('SEK 1.020, PLN 1.010 → stosowany min = 1.010');
  await f.locator('[data-baf="readings"] [data-reading]', { hasText: 'SEK · 2026-09-25' }).getByRole('button', { name: 'Koryguj' }).click();
  await r.getByLabel(/^Dzień odczytu/).fill('2026-09-26');
  await r.getByLabel(/Wartość/).fill('18,00');
  await r.getByLabel(/Powód korekty/).fill('pomyłka przy przepisywaniu');
  await r.getByRole('button', { name: 'Zapisz korektę' }).click();
  await expect(f.locator('[data-baf-preview]')).toContainText('SEK 1.000, PLN 1.010 → stosowany min = 1.000', { timeout: 15000 });
  await expect(f.locator('[data-baf="log"] .auth-admin-row')).toHaveCount(4);
  await expect(f.locator('[data-baf="log"]')).toContainText('korekta odczytu');
  expect(psql(`select count(*)||'/'||(select count(*) from fuel_index_readings)||'/'||(select count(*) from fuel_index_readings where corrects_id is not null) from sefs_parameters`)).toBe('1/3/1');
  psql(`set session_replication_role = replica; delete from fuel_index_readings; delete from sefs_parameters; delete from audit_log where action in ('SEFS_PARAMS_VERSION','FUEL_READING_ADD','FUEL_READING_CORRECT');`);
});

// ── I-5: 2FA (TOTP) dla HHL_ADMIN ────────────────────────────────────────────
function totp(secret: string, at = Date.now()): string {
  const alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const ch of secret.replace(/=+$/, '').toUpperCase()) bits += alpha.indexOf(ch).toString(2).padStart(5, '0');
  const key = Buffer.from((bits.match(/.{8}/g) ?? []).map((b) => parseInt(b, 2)));
  const ctr = Buffer.alloc(8); ctr.writeBigUInt64BE(BigInt(Math.floor(at / 30000)));
  const h = createHmac('sha1', key).update(ctr).digest();
  const o = h[h.length - 1] & 15;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1e6).padStart(6, '0');
}
const mfaReset = () => psql(`delete from auth.mfa_factors where user_id = (select id from auth.users where email='hhl@bk5.local'); update security_flags set enabled=false where key='MFA_HHL_ADMIN'`);

async function magic(page: Page, email: string) {
  await page.context().clearCookies();
  await page.evaluate(() => localStorage.clear()).catch(() => undefined);
  await page.goto('about:blank');
  const r = await fetch(`${URL_}/auth/v1/admin/generate_link`, { method: 'POST', headers: { apikey: SR, Authorization: `Bearer ${SR}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'magiclink', email }) });
  const g = await r.json() as { action_link?: string; properties?: { action_link?: string } };
  const hop = await fetch((g.action_link ?? g.properties?.action_link)!, { redirect: 'manual' });
  const loc = hop.headers.get('location') ?? '';
  await page.goto(APP + loc.slice(loc.indexOf('#')));
}
const nextWindow = (page: Page) => page.waitForTimeout(30000 - (Date.now() % 30000) + 500);

test('I-5 HHL: włączenie TOTP z Moje konto (AccountScreen) i weryfikacja przy kolejnym logowaniu', async ({ page }) => {
  /* D-20261014-0700-01 J3/J5: AccountScreen zamiast MyMfa; I-17 (2 urządzenia + wymóg) zostaje w tests/db/i2.sh. */
  test.setTimeout(180000);
  mfaReset();
  try {
    await login(page, 'hhl@bk5.local');
    await page.locator('nav [data-view="options"]').first().click();
    await page.locator('[data-opt-nav="account"]').click();
    await expect(page.locator('[data-auth="my-account"]')).toBeVisible();
    await page.getByRole('button', { name: 'Włącz 2FA' }).click();
    const box = page.locator('[data-auth="my-mfa"]');
    await box.locator('[data-mfa="setup"] button').click();
    const s1 = (await box.locator('[data-mfa-secret]').textContent())!.trim();
    await box.locator('[data-mfa="setup-code"] input').fill(totp(s1));
    await box.locator('[data-mfa="setup-code"] button[type=submit]').click();
    await expect(page.locator('.ox-account .ox-tag')).toContainText(/Włączona/i, { timeout: 15000 });
    await magic(page, 'hhl@bk5.local');
    await page.waitForSelector('[data-auth="mfa"] [data-mfa="verify"]', { timeout: 30000 });
    await expect(page.locator('[data-auth="session"]')).toHaveCount(0);
    await nextWindow(page);
    await page.locator('[data-mfa="verify"] input').fill(totp(s1));
    await page.locator('[data-mfa="verify"] button[type=submit]').click();
    await page.waitForSelector('[data-auth="session"]', { timeout: 30000 });
  } finally { mfaReset(); }
});

// ── I-4: instrukcje w aplikacji ──────────────────────────────────────────────
for (const [who, view, role, n] of [['hhl', 'options', 'hhl', 7], ['ksh', 'settings', 'ksh', 6], ['scx', 'settings', 'scx', 6]] as const) {
  test(`I-4 ${who.toUpperCase()}: instrukcja w ${view === 'options' ? 'Opcjach' : 'Ustawieniach'} — ${n} kroków`, async ({ page }) => {
    await login(page, `${who}@bk5.local`);
    await page.locator(`nav [data-view="${view}"]`).first().click();
    /* wyglad/P3-c (E11): Dla mnie › Instrukcja w menu bocznym */
    await page.locator('[data-opt-nav="guide"]').click();
    const g = page.locator(`[data-guide="${role}"]`);
    await expect(g.locator('summary h2')).toHaveText('Instrukcja');
    await g.locator('summary').click();
    await expect(g.locator('ol > li')).toHaveCount(n);
  });
}

test('I-4 kierowca: PWA z linkiem serwerowym — instrukcja otwarta przed zgodą, 8 kroków, PL/EN/SV', async ({ page }) => {
  const tok = 'wt_' + 'e4'.repeat(32);
  psql(`delete from driver_tokens where token_hash = driver_token_hash('${tok}'); insert into driver_tokens (load_id, token_hash, expires_at) select id, driver_token_hash('${tok}'), now() + interval '1 day' from loads where status not in ('CANCELLED','DELIVERED','UNLOADED') order by id limit 1`);
  try {
    await page.goto(`${APP}/#/driver/${tok}`);
    const g = page.locator('[data-guide="drv"]');
    await expect(g).toHaveAttribute('open', '');
    await expect(g.locator('ol > li')).toHaveCount(8);
    await page.locator('.driver-pwa-tabs button', { hasText: 'SV' }).click();
    await expect(g.locator('summary h2')).toHaveText('Instruktion');
    await page.locator('.driver-pwa-tabs button', { hasText: 'EN' }).click();
    await expect(g.locator('ol > li').first()).toContainText('Open the link from the dispatcher');
  } finally { psql(`delete from driver_tokens where token_hash = driver_token_hash('${tok}')`); }
});

// ── I-6: błędy przeglądarki do bazy ──────────────────────────────────────────
test('I-6: błąd JS i odrzucona obietnica w buildzie produkcyjnym trafiają do client_errors (z rolą, bez tokenów)', async ({ page }) => {
  psql(`delete from client_errors where message like '%E2E-I6%'`);
  await login(page, 'ksh@bk5.local');
  await page.waitForTimeout(1500);                       // reporter ładowany leniwie
  await page.evaluate(() => { setTimeout(() => { throw new Error('E2E-I6 wyjątek'); }, 0); void Promise.reject(new Error('E2E-I6 obietnica')); });
  await expect.poll(() => psql(`select string_agg(kind||'/'||coalesce(app_role,'∅')||'/'||(build is not null)::text, ',' order by kind) from client_errors where message like '%E2E-I6%'`), { timeout: 15000 })
    .toBe('error/CLIENT_ADMIN/true,rejection/CLIENT_ADMIN/true');
  expect(psql(`select count(*) from client_errors where message like '%E2E-I6%' and (path like '%access_token%' or path like '%?%')`)).toBe('0');
  psql(`delete from client_errors where message like '%E2E-I6%'`);
});
