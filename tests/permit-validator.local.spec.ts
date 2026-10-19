/**
 * SCOPE 6.5 — walidator zezwoleń na BUILDZIE PRODUKCYJNYM i lokalnym Supabase: zezwolenie PL powiązane z transportem,
 * zestaw 32,5 m przy limicie 30 m → baner „Zezwolenie niezgodne” (stan z bazy); po korekcie długości — odblokowany.
 * Uruchamia: SPEC=tests/permit-validator.local.spec.ts scripts/i2/local-ui.sh
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
test.skip(!LOCAL, 'walidator zezwoleń: wymaga I2_UI_BASE i lokalnego Supabase');

let LD = ''; let PM = '';
test.beforeAll(() => {
  LD = psql(`select id from loads where status='PLANNED' and carrier_org_id is not null order by plan_load_date, id limit 1`);
  PM = psql(`insert into permits (project_id, country, permit_no, valid_from, valid_until, max_length_m, max_width_m, max_height_m, max_weight_t)
             select project_id, 'PL', 'E2E/PL/65', current_date - 30, current_date + 60, 30, 4, 4.5, 60 from loads where id='${LD}' returning id`).split('\n')[0];
  psql(`insert into load_permits (load_id, permit_id) values ('${LD}','${PM}');
        set session_replication_role=replica; update loads set combo_length_m=32.5, combo_width_m=3.9, combo_height_m=4.4, combo_weight_t=58 where id='${LD}'`);
});
test.afterAll(() => {
  psql(`delete from load_permits where permit_id='${PM}'; delete from permits where id='${PM}';
        set session_replication_role=replica; update loads set combo_length_m=null, combo_width_m=null, combo_height_m=null, combo_weight_t=null where id='${LD}'`);
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


async function openLoad(page: Page) {
  await page.locator('nav [data-view="sched"]').first().click();
  await page.locator(`tr[data-load="${LD}"]`).click();
}

test('HHL: zezwolenie niezgodne → baner; po korekcie odblokowany', async ({ page }) => {
  test.setTimeout(90_000);
  await login(page, 'hhl@bk5.local');
  await openLoad(page);
  /* właściciel 19.10: Przegląd bez sekcji „Dokumenty” — stan zezwolenia w zakładce Dokumenty (wiersz zezwolenia) */
  await page.locator('#dtab-docs').click();
  await expect(page.locator('[data-permit-row] [data-permit-fit="no"]').first()).toBeVisible();
  // „Gotowy” w bazie: blokada wyzwalacza trg_loads_permit_gate (test i2 [6.5]); tu stan z load_permit_status()
  expect(psql(`select ok::text||'/'||array_to_string(breaches, ',') from load_permit_status() where load_id='${LD}'`)).toBe('false/LENGTH');
  psql(`set session_replication_role=replica; update loads set combo_length_m=29.8 where id='${LD}'`);
  await page.reload();
  await page.waitForSelector('[data-auth="session"]');
  // szuflada transportu zostaje otwarta po odświeżeniu (zapamiętany wybór) — stan z bazy przeładowany
  if (!(await page.locator('#dtab-docs').isVisible().catch(() => false))) {
    await page.keyboard.press('Escape');
    await openLoad(page);
  }
  await page.locator('#dtab-docs').click();
  await expect(page.locator('[data-permit-row]').first()).toBeVisible();
  await expect(page.locator('[data-permit-row] [data-permit-fit="no"]')).toHaveCount(0);
  expect(psql(`select ok from load_permit_status() where load_id='${LD}'`)).toBe('t');
});
