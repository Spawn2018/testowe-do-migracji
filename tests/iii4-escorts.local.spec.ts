/**
 * III-4 (0087) — pojazdy pilotujące na BUILDZIE PRODUKCYJNYM i lokalnym Supabase (nigdy produkcja): zezwolenie wymaga
 * 2 pilotów → „awizowane 0 / wymagane 2”; przewoźnik awizuje 2 (firma, tablica, zakres) → stan zgodny, zapis w bazie
 * (load_escorts, loads.escort_vehicles, audit_log); KSH widzi listę tylko do odczytu.
 * Uruchamia: SPEC=tests/iii4-escorts.local.spec.ts scripts/i2/local-ui.sh
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
test.skip(!LOCAL, 'pojazdy pilotujące: wymaga I2_UI_BASE i lokalnego Supabase');

let LD = ''; let PM = '';
test.beforeAll(() => {
  LD = psql(`select id from loads where status='PLANNED' and carrier_org_id is not null order by plan_load_date desc, id offset 1 limit 1`);
  PM = psql(`insert into permits (project_id, country, permit_no, valid_from, valid_until, escort_required)
             select project_id, 'PL', 'E2E/E34', current_date - 400, current_date + 400, 2 from loads where id='${LD}' returning id`).split('\n')[0];
  psql(`insert into load_permits (load_id, permit_id) values ('${LD}','${PM}')`);
});
test.afterAll(() => {
  psql(`delete from load_escorts where load_id='${LD}'; delete from load_permits where permit_id='${PM}'; delete from permits where id='${PM}';
        set session_replication_role=replica; update loads set escort_vehicles=0 where id='${LD}'`);
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
async function openRes(page: Page) {
  await page.locator('nav [data-view="sched"]').first().click();
  await page.locator(`tr[data-load="${LD}"]`).click();
  /* wyglad/P6-b (E17, E32): piloci w Przeglądzie (z „Ustaleń”); do awizacji SCX w P7 */
  await page.locator('.dtabs button').nth(0).click();
  await expect(page.locator('[data-escorts]')).toBeVisible();
}

test('SCX: wymagane 2 → awizacja 2 pilotów → stan zgodny, zapis w bazie', async ({ page }) => {
  test.setTimeout(120_000);
  await login(page, 'scx@bk5.local');
  await openRes(page);
  await expect(page.locator('[data-escorts-state="missing"]')).toContainText('awizowane 0 / wymagane 2');
  if (process.env.SHOT) { await page.locator('[data-escort-add]').click(); await page.locator('[data-escorts]').screenshot({ path: '/tmp/esc.png' }); await page.locator('[data-escort-remove="1"]').click(); }
  await expect(page.locator('input[name="escortPlate"]')).toHaveCount(0);
  for (const [i, c, pl, sc] of [[0, 'Pilot-Trans', 'po 12345', 'PL'], [1, 'Följebil AB', 'ABC 123', 'SE']] as const) {
    await page.locator('[data-escort-add]').click();
    await page.locator(`[name="company${i}"]`).fill(c);
    await page.locator(`[name="plate${i}"]`).fill(pl);
    await page.locator(`[name="scope${i}"]`).selectOption(sc);
  }
  // D-22 (0090): kierowca pierwszego pilota — imię i telefon (spacje usuwane → E.164)
  await page.locator('[name="driver0"]').fill('Adam Pilot');
  await page.locator('[name="phone0"]').fill('+48 600 100 200');
  await expect(page.locator('[data-escort-pii-note]')).toBeVisible()
  await page.locator('[data-escorts-save]').click();
  await expect(page.locator('[data-escorts-msg="ok"]')).toBeVisible();
  await expect(page.locator('[data-escorts-state="ok"]')).toContainText('awizowane 2 / wymagane 2');
  expect(psql(`select string_agg(seq||':'||plate||':'||scope, ',' order by seq) from load_escorts where load_id='${LD}'`)).toBe('1:PO 12345:PL,2:ABC 123:SE');
  expect(psql(`select string_agg(seq||':'||coalesce(driver_name,'-')||':'||coalesce(driver_phone,'-'), ',' order by seq) from load_escorts where load_id='${LD}'`)).toBe('1:Adam Pilot:+48600100200,2:-:-');
  expect(psql(`select (new_value::text like '%600100200%')::text from audit_log where action='ESCORTS_SET' and entity_id='${LD}' order by id desc limit 1`)).toBe('false');
  await page.keyboard.press('Escape'); await openRes(page);
  await expect(page.locator('[name="phone0"]')).toHaveValue('+48600100200');
  expect(psql(`select escort_vehicles||'/'||(select (count(*) > 0)::text from audit_log where action='ESCORTS_SET' and entity_id='${LD}' and jsonb_array_length(new_value)=2) from loads where id='${LD}'`)).toBe('2/true');
});

test('KSH: lista pilotów tylko do odczytu, z imieniem i telefonem (D-1243)', async ({ page }) => {
  test.setTimeout(90_000);
  await login(page, 'ksh@bk5.local');
  await openRes(page);
  await expect(page.locator('[data-escorts="2"]')).toContainText('PO 12345');
  await expect(page.locator('[data-escorts-form]')).toHaveCount(0);
  // D-20261020-1243-01 (zastępuje D-22): KSH widzi imię i telefon kierowcy pilota (zgody RODO)
  await expect(page.locator('[data-escorts]')).toContainText('Adam Pilot');
  await expect(page.locator('[data-escorts]')).toContainText('600100200');
});
