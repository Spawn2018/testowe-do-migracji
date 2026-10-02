/**
 * III-7 (SCOPE 7.10) — pełna ścieżka sporu i akceptacji faktury na BUILDZIE PRODUKCYJNYM i lokalnym Supabase.
 * KSH zgłasza spór faktury HHL → HHL widzi historię i odpowiada → KSH widzi odpowiedź i akceptuje → historia 3 kroków.
 * 0082: HHL wysyła korektę z plikiem PDF → KSH (odbiorca) widzi wpis „korekta” i otwiera plik linkiem podpisanym.
 * Faktura kosztowa SCX w sporze: przycisk „Opłacona” u HHL wyłączony z komunikatem.
 * Uruchamia: SPEC=tests/iii7-dispute.local.spec.ts scripts/i2/local-ui.sh
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
test.skip(!LOCAL, 'spór faktury: wymaga I2_UI_BASE i lokalnego Supabase');

let IR = ''; let IC = '';
const cleanup = () => psql(`set session_replication_role=replica; delete from documents where file_name='e2e-iii7-korekta.pdf'; delete from invoice_dispute_events where invoice_id in (select id from invoices where invoice_number like 'E2E/III7/%');
  delete from notifications where payload->>'number' like 'E2E/III7/%'; delete from invoice_lines where invoice_id in (select id from invoices where invoice_number like 'E2E/III7/%');
  delete from invoices where invoice_number like 'E2E/III7/%';`);
test.beforeAll(() => {
  cleanup();
  const ins = (dir: string, issuer: string, recipient: string, num: string) => psql(`insert into invoices (project_id, carrier_org_id, direction, issuer_org_id, recipient_org_id, invoice_number, currency, net_total, vat_total, gross_total, issue_date, due_date, period_start, period_end, week_key)
    select p.id, ${dir === 'KOSZT' ? "(select id from organizations where code='SCX')" : 'null'}, '${dir}', (select id from organizations where code='${issuer}'), (select id from organizations where code='${recipient}'), '${num}', 'EUR', 100, 0, 100,
           current_date, current_date + 30, current_date - 7, current_date, to_char(current_date, 'IYYY-"W"IW') from projects p limit 1 returning id`).split('\n')[0];
  IR = ins('PRZYCHOD', 'HHL', 'KSH', 'E2E/III7/1');
  IC = ins('KOSZT', 'SCX', 'HHL', 'E2E/III7/2');
  const L = psql(`select id from loads where status <> 'CANCELLED' order by plan_load_date nulls last, id limit 1`);
  psql(`insert into invoice_lines (invoice_id, load_id, direction) values ('${IR}','${L}','PRZYCHOD'), ('${IC}','${L}','KOSZT')`);
});
test.afterAll(() => cleanup());

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


async function openBill(page: Page, id: string) {
  await page.locator('nav [data-view="inv"]').first().click();
  await page.locator(`tr[data-bill="${id}"]`).click();
  await expect(page.locator(`[data-bill-detail="${id}"]`)).toBeVisible();
}

test('KSH zgłasza spór faktury HHL', async ({ page }) => {
  test.setTimeout(90_000);
  await login(page, 'ksh@bk5.local');
  await openBill(page, IR);
  await page.locator('[data-bill-actions="verify"] input').fill('stawka poz. 1 niezgodna');
  await page.locator('[data-verify="SPORNA"]').click();
  await expect.poll(() => psql(`select verification_status from invoices where id='${IR}'`)).toBe('SPORNA');
  expect(psql(`select kind from invoice_dispute_events where invoice_id='${IR}'`)).toBe('OPENED');
});

test('HHL widzi spór, odpowiada', async ({ page }) => {
  test.setTimeout(90_000);
  await login(page, 'hhl@bk5.local');
  await openBill(page, IR);
  const th = page.locator(`[data-dispute-thread="${IR}"]`);
  await expect(th.locator('[data-dispute-event="OPENED"]')).toContainText('stawka poz. 1 niezgodna');
  await th.locator('[data-dispute-reply]').fill('stawka wg aneksu 2');
  await th.locator('[data-action="dispute-reply"]').click();
  await expect(th.locator('[data-dispute-event="REPLY"]')).toContainText('stawka wg aneksu 2');
  // 0082: korekta z załączonym PDF
  await th.locator('[data-dispute-file]').setInputFiles({ name: 'e2e-iii7-korekta.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n% korekta\n%%EOF\n') });
  await expect(th.locator('[data-action="dispute-reply"]')).toHaveText(/korekt/i);
  await th.locator('[data-dispute-reply]').fill('faktura korygująca KOR/1');
  await th.locator('[data-action="dispute-reply"]').click();
  await expect(th.locator('[data-dispute-event="CORRECTION"]')).toContainText('faktura korygująca KOR/1');
  await expect(th.locator('[data-dispute-doc="e2e-iii7-korekta.pdf"]')).toBeVisible();
  expect(psql(`select x.role from invoice_documents x join documents d on d.id=x.document_id where x.invoice_id='${IR}' and d.file_name='e2e-iii7-korekta.pdf'`)).toBe('KOREKTA');
  expect(Number(psql(`select count(*) from notifications n join app_users u on u.id=n.user_id where n.template='INVOICE_DISPUTE_REPLY' and u.email='ksh@bk5.local' and n.payload->>'invoice_id'='${IR}'`))).toBe(2);
  // faktura kosztowa SCX w sporze: zapłata wstrzymana
  psql(`set session_replication_role=replica; update invoices set verification_status='SPORNA', dispute_note='brak CMR' where id='${IC}'`);
  await page.reload();
  await page.waitForSelector('[data-auth="session"]');
  await openBill(page, IC);
  await expect(page.locator(`[data-bill-detail="${IC}"] [data-paid]`)).toBeDisabled();
  await expect(page.locator(`[data-bill-detail="${IC}"] [data-pay-blocked]`)).toBeVisible();
});

test('KSH widzi odpowiedź i plik korekty, akceptuje — historia 4 kroków', async ({ page }) => {
  test.setTimeout(90_000);
  await login(page, 'ksh@bk5.local');
  await openBill(page, IR);
  const th = page.locator(`[data-dispute-thread="${IR}"]`);
  await expect(th.locator('[data-dispute-event="REPLY"]')).toContainText('stawka wg aneksu 2');
  await expect(th.locator('[data-action="dispute-reply"]')).toHaveCount(0);
  await expect(th.locator('[data-dispute-event="CORRECTION"]')).toContainText('faktura korygująca KOR/1');
  await page.evaluate(() => {
    (window as unknown as { __opened: string[] }).__opened = [];
    document.addEventListener('click', (ev) => {
      const a = (ev.target as HTMLElement | null)?.closest?.('a');
      if (a instanceof HTMLAnchorElement && a.href) (window as unknown as { __opened: string[] }).__opened.push(a.href);
    }, true);
  });
  await th.locator('[data-dispute-doc="e2e-iii7-korekta.pdf"]').click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __opened: string[] }).__opened[0] ?? '')).toMatch(/\/storage\/v1\/object\/sign\//);
  const signed = await page.evaluate(() => (window as unknown as { __opened: string[] }).__opened[0]);
  const got = await fetch(signed);
  expect(got.status).toBe(200);
  expect((await got.text()).startsWith('%PDF')).toBe(true);
  await page.locator('[data-verify="ZAAKCEPTOWANA"]').click();
  await expect.poll(() => psql(`select string_agg(kind, ',' order by id) from invoice_dispute_events where invoice_id='${IR}'`)).toBe('OPENED,REPLY,CORRECTION,RESOLVED');
  await expect(th.locator('[data-dispute-event="RESOLVED"]')).toBeVisible();
});
