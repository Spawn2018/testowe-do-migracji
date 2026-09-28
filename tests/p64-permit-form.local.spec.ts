/**
 * SCOPE 6.4 (0086) — formularz zezwoleń w szufladzie na BUILDZIE PRODUKCYJNYM i lokalnym Supabase (nigdy produkcja):
 * przewoźnik dodaje zezwolenie PL (limit 30 m) do transportu z zestawem 32,5 m → wiersz „niezgodne”, baner w przeglądzie,
 * zapis + powiązanie + audit_log w bazie; odłącza przed „Gotowy”. HHL wiąże istniejące zezwolenie projektu. KSH — tylko odczyt.
 * Uruchamia: SPEC=tests/p64-permit-form.local.spec.ts scripts/i2/local-ui.sh
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
test.skip(!LOCAL, 'formularz zezwoleń: wymaga I2_UI_BASE i lokalnego Supabase');

let LD = '';
const NO = `E2E/P64/${Date.now() % 100000}`;
test.beforeAll(() => {
  LD = psql(`select id from loads where status='PLANNED' and carrier_org_id is not null order by plan_load_date desc, id limit 1`);
  psql(`set session_replication_role=replica; update loads set combo_length_m=32.5, combo_width_m=3.9, combo_height_m=4.4, combo_weight_t=58 where id='${LD}'`);
});
test.afterAll(() => {
  psql(`delete from load_permits where load_id='${LD}'; delete from permits where permit_no like 'E2E/P64/%';
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
async function openDocs(page: Page) {
  await page.locator('nav [data-view="sched"]').first().click();
  await page.locator(`tr[data-load="${LD}"]`).click();
  await page.locator('.dtabs button').nth(2).click();
  await expect(page.locator('[data-permit-form]')).toBeVisible();
}

test('SCX: nowe zezwolenie → zapis + powiązanie, „niezgodne”, baner; odłączenie przed Gotowy', async ({ page }) => {
  test.setTimeout(120_000);
  await login(page, 'scx@bk5.local');
  await openDocs(page);
  await page.locator('[data-permit-add]').click();
  const f = page.locator('[data-permit="form"]');
  await f.locator('[name="permit_no"]').fill(NO);
  await f.locator('[name="authority"]').fill('GDDKiA Gdańsk');
  const d = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
  await f.locator('[name="valid_from"]').fill(d(-400));
  await f.locator('[name="valid_until"]').fill(d(400));
  await f.locator('[name="max_length_m"]').fill('30');
  await f.locator('[name="max_width_m"]').fill('4');
  await f.locator('[name="max_height_m"]').fill('4,5');
  await f.locator('[name="max_weight_t"]').fill('60');
  await f.locator('[name="escort_required"]').selectOption('1');
  await f.locator('[name="route_desc"]').fill('A1 Gdańsk – DK91');
  await page.locator('[data-permit-save]').click();
  await expect(page.locator('[data-permit-msg="ok"]')).toBeVisible();
  const row = page.locator(`[data-permit-row="${NO}"]`);
  await expect(row).toBeVisible();
  await expect(row.locator('[data-permit-fit="no"]')).toBeVisible();
  await expect(row).toContainText('długość ponad limit');
  expect(psql(`select p.authority||'/'||p.escort_required||'/'||p.max_height_m||'/'||(select count(*) from load_permits lp where lp.permit_id=p.id and lp.load_id='${LD}')
               ||'/'||(select count(*) from audit_log a where a.action='PERMIT_SAVE' and a.entity_id=p.id::text) from permits p where p.permit_no='${NO}'`)).toBe('GDDKiA Gdańsk/1/4.50/1/1');
  await page.locator('.dtabs button').nth(0).click();
  await expect(page.locator('[data-permit="mismatch"]')).toBeVisible();
  await page.locator('.dtabs button').nth(2).click();
  await page.locator(`[data-permit-unlink="${NO}"]`).click();
  await expect(page.locator('[data-permit-none]')).toBeVisible();
  expect(psql(`select count(*) from load_permits where load_id='${LD}'`)).toBe('0');
  expect(psql(`select count(*) from audit_log where action='PERMIT_UNLINK' and entity_id='${LD}'`)).not.toBe('0');
});

test('HHL: powiązanie istniejącego zezwolenia projektu; KSH: tylko odczyt', async ({ browser }) => {
  test.setTimeout(120_000);
  const hhl = await browser.newPage();
  await login(hhl, 'hhl@bk5.local');
  await openDocs(hhl);
  const pid = psql(`select id from permits where permit_no='${NO}'`);
  await hhl.locator('[data-permit-pick]').selectOption(pid);
  await hhl.locator('[data-permit-link]').click();
  await expect(hhl.locator(`[data-permit-row="${NO}"]`)).toBeVisible();
  expect(psql(`select count(*) from load_permits where load_id='${LD}' and permit_id='${pid}'`)).toBe('1');
  await hhl.close();
  const ksh = await browser.newPage();
  await login(ksh, 'ksh@bk5.local');
  await openDocs(ksh);
  await expect(ksh.locator(`[data-permit-row="${NO}"]`)).toBeVisible();
  await expect(ksh.locator('[data-permit-add]')).toHaveCount(0);
  await expect(ksh.locator('[data-permit-unlink]')).toHaveCount(0);
  await ksh.close();
});
