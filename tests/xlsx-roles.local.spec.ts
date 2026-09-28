/**
 * PLAN §1.5 (28.09) — eksport XLSX harmonogramu per rola na BUILDZIE PRODUKCYJNYM i lokalnym Supabase.
 * Jeden transport (SCX, projekt KSH) z kosztem 11111.11, przychodem 22222.22, kierowcą i telefonem; dostawa poza ±24 h.
 * Sprawdza nagłówki i wartości w pobranym pliku: KSH bez kosztu/marży/kierowcy, SCX bez przychodu/marży.
 * Uruchamia: SPEC=tests/xlsx-roles.local.spec.ts scripts/i2/local-ui.sh
 */
import { test, expect, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import ExcelJS from 'exceljs';

const APP = process.env.I2_UI_BASE ?? '';
const URL_ = process.env.VITE_SUPABASE_URL ?? '';
const SR = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const DB = process.env.SUPABASE_DB_URL ?? '';
const LOCAL = !!APP && /^http:\/\/(127\.0\.0\.1|localhost):/.test(URL_);
const psql = (sql: string) => execFileSync('psql', [DB, '-Atq', '-c', sql]).toString().trim();
const NAME = 'Jan Probny'; const PHONE = '+48600' + '123456';

test.describe.configure({ mode: 'serial' });
test.skip(!LOCAL, 'eksport per rola: wymaga I2_UI_BASE i lokalnego Supabase');

let LID = '';
test.beforeAll(() => {
  LID = psql(`select l.id from loads l join projects p on p.id=l.project_id join organizations c on c.id=l.carrier_org_id join organizations k on k.id=p.client_org_id
              where l.status <> 'CANCELLED' and c.code='SCX' and k.code='KSH' order by l.plan_load_date nulls last, l.id limit 1`);
  psql(`set session_replication_role=replica; update loads set driver_name='${NAME}', driver_phone='${PHONE}', plan_delivery_from=now() + interval '10 days', plan_delivery_date=(now() + interval '10 days')::date, eta_site=null where id='${LID}';
        insert into load_cost (load_id, base_amount) values ('${LID}', 11111.11) on conflict (load_id) do update set base_amount=excluded.base_amount;
        insert into load_revenue (load_id, base_amount) values ('${LID}', 22222.22) on conflict (load_id) do update set base_amount=excluded.base_amount;`);
});
test.afterAll(() => {
  psql(`delete from load_cost where load_id='${LID}'; delete from load_revenue where load_id='${LID}'; set session_replication_role=replica; update loads set driver_name=null, driver_phone=null where id='${LID}';`);
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

async function exportFor(page: Page, email: string) {
  await login(page, email);
  await page.locator('nav [data-view="sched"]').first().click();
  const [d] = await Promise.all([page.waitForEvent('download'), page.locator('[data-action="export-xlsx"]').click()]);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile((await d.path())!);
  const ws = wb.worksheets[0];
  const rows: string[][] = [];
  ws.eachRow((r) => rows.push((r.values as unknown[]).slice(1).map((v) => String(v ?? ''))));
  return { headers: rows[0], all: rows.map((r) => r.join('|')).join('\n') };
}

test('HHL: pełny eksport — koszt, przychód, marża, kierowca, telefon', async ({ page }) => {
  test.setTimeout(90_000);
  const x = await exportFor(page, 'hhl@bk5.local');
  expect(x.headers).toEqual(expect.arrayContaining(['Koszt_EUR', 'Przychód_EUR', 'Marża_EUR', 'Kierowca', 'Telefon']));
  for (const v of ['11111.11', '22222.22', '11111.11', NAME, PHONE]) expect(x.all).toContain(v);
});

test('KSH: cena tak; koszt, marża, imię i telefon kierowcy (poza ±24 h) — nie', async ({ page }) => {
  test.setTimeout(90_000);
  const x = await exportFor(page, 'ksh@bk5.local');
  expect(x.headers).toContain('Cena_EUR');
  for (const h of ['Koszt_EUR', 'Przychód_EUR', 'Marża_EUR', 'Kierowca']) expect(x.headers).not.toContain(h);
  expect(x.all).toContain('22222.22');
  for (const v of ['11111.11', NAME, PHONE]) expect(x.all).not.toContain(v);
});

test('SCX: koszt i kierowca tak; przychód, cena klienta i marża — nie', async ({ page }) => {
  test.setTimeout(90_000);
  const x = await exportFor(page, 'scx@bk5.local');
  expect(x.headers).toEqual(expect.arrayContaining(['Koszt_EUR', 'Kierowca', 'Telefon']));
  for (const h of ['Przychód_EUR', 'Cena_EUR', 'Marża_EUR']) expect(x.headers).not.toContain(h);
  for (const v of ['11111.11', NAME, PHONE]) expect(x.all).toContain(v);
  expect(x.all).not.toContain('22222.22');
});
