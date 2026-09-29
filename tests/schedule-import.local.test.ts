/**
 * I-1 — import harmonogramu w trybie produkcyjnym na realnej skali (dawne 25.1; D23-S było tylko demo).
 * WYŁĄCZNIE lokalny Supabase (GoTrue + PostgREST + Storage + Postgres 17): scripts/i1/local.sh (I1_LOCAL=1).
 * Syntetyczny tests/fixtures/ksh-harmonogram-synthetic.xlsx → parser → import_schedule() przez REST z sesją HHL.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import ExcelJS from 'exceljs';
import { readXlsxRows } from '../src/lib/xlsxRead';
import { parseSchedule } from '../src/lib/scheduleParse';
import { toRpcRows, type ImportRpcResult, type RpcRow } from '../src/lib/scheduleImportRpc';

const URL_ = process.env.VITE_SUPABASE_URL ?? '';
const LOCAL = process.env.I1_LOCAL === '1' && /^http:\/\/(127\.0\.0\.1|localhost):/.test(URL_);
const ANON = process.env.VITE_SUPABASE_ANON_KEY ?? '';
const SR = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const DB = process.env.SUPABASE_DB_URL ?? '';
const psql = (sql: string) => execFileSync('psql', [DB, '-Atq', '-c', sql]).toString().trim();

async function post(path: string, body: unknown, key = ANON, bearer = key) {
  const r = await fetch(URL_ + path, { method: 'POST', headers: { apikey: key, Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const t = await r.text();
  let b: unknown = null; try { b = t ? JSON.parse(t) : null; } catch { b = t; }
  return { status: r.status, body: b as Record<string, unknown> };
}
async function token(email: string): Promise<string> {
  const g = await post('/auth/v1/admin/generate_link', { type: 'magiclink', email }, SR);
  const hash = (g.body.hashed_token ?? (g.body.properties as Record<string, string>)?.hashed_token) as string;
  const v = await post('/auth/v1/verify', { type: 'magiclink', token_hash: hash });
  return v.body.access_token as string;
}
async function rowsFromXlsx(buf: ArrayBuffer): Promise<RpcRow[]> {
  return toRpcRows(parseSchedule(await readXlsxRows(buf)).rows);
}
const ab = (b: Buffer) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;

describe.skipIf(!LOCAL)('I-1 import harmonogramu — lokalny Supabase, pełny plik', () => {
  let P = '', HHL = '', KSH = '', SCX = '';
  let full: RpcRow[] = [];
  const imp = (jwt: string, rows: RpcRow[], dry: boolean, cancel: string[] = [], file: Record<string, unknown> = { name: 'ksh-harmonogram-synthetic.xlsx' }) =>
    post('/rest/v1/rpc/import_schedule', { p_project: P, p_rows: rows, p_cancel_codes: cancel, p_file: file, p_dry_run: dry }, ANON, jwt);

  beforeAll(async () => {
    // czysty stan TYLKO lokalnie (postgres omija zakaz DELETE dla ról API)
    psql(`set session_replication_role = replica; delete from notifications; delete from load_events; delete from shipment_items; delete from schedule_imports; delete from audit_log where action like 'LOAD_%'; delete from loads;`);
    P = psql(`select id from projects where code = 'STEGRA_BODEN'`);
    [HHL, KSH, SCX] = await Promise.all(['hhl@bk5.local', 'ksh@bk5.local', 'scx@bk5.local'].map(token));
    full = await rowsFromXlsx(ab(readFileSync('tests/fixtures/ksh-harmonogram-synthetic.xlsx')));
  }, 60_000);

  it('KSH i SCX nie importują (podgląd ani zapis); anon — brak uprawnień', async () => {
    for (const [jwt, dry] of [[KSH, true], [KSH, false], [SCX, true], [SCX, false]] as const) {
      const r = await imp(jwt, full, dry);
      expect(r.status).toBeGreaterThanOrEqual(400);
      expect(String(r.body.message)).toMatch(/wyłącznie HHL/);
    }
    const a = await imp(ANON, full, true);
    expect(a.status).toBeGreaterThanOrEqual(400);
    expect(psql('select count(*) from loads')).toBe('0');
  });

  it('archiwum pliku: HHL zapisuje do koszyka „harmonogramy”, KSH nie', async () => {
    const body = readFileSync('tests/fixtures/ksh-harmonogram-synthetic.xlsx');
    const put = (jwt: string, name: string) => fetch(`${URL_}/storage/v1/object/harmonogramy/${P}/${name}`, {
      method: 'POST', headers: { apikey: ANON, Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }, body });
    expect((await put(HHL, `i1-test-${Date.now()}.xlsx`)).status).toBe(200);
    expect((await put(KSH, `i1-ksh-${Date.now()}.xlsx`)).status).toBeGreaterThanOrEqual(400);
  });

  it('syntetyczny harmonogram: podgląd, zapis, liczby i czas', async () => {
    let t = performance.now();
    const pre = await imp(HHL, full, true);
    const tPre = performance.now() - t;
    expect(pre.status).toBe(200);
    const p = pre.body as unknown as ImportRpcResult;
    expect(p.added).toHaveLength(8);
    expect(psql('select count(*) from loads')).toBe('0');
    t = performance.now();
    const r = await imp(HHL, full, false, [], { name: 'ksh-harmonogram-synthetic.xlsx', hash: 'h1', path: `harmonogramy/${P}/i1-test.xlsx` });
    const tCommit = performance.now() - t;
    expect(r.status).toBe(200);
    const res = r.body as unknown as ImportRpcResult;
    expect(res.version).toBe(1);
    const counts = psql(`select (select count(*) from loads)||'/'||(select count(*) from shipment_items)||'/'||(select count(*) from load_events where event_type='SCHEDULE_IMPORTED')||'/'||(select count(*) from schedule_imports)`);
    expect(counts).toBe('8/8/8/1');
    expect(psql(`select count(*) filter (where cargo_class='STANDARD' and length_m is null and width_m is null and height_m is null)||'/'||count(*) filter (where cargo_class='DIMENSIONED' and length_m is not null) from shipment_items`)).toBe('3/5');
    console.log(`[I-2C] syntetyk: 8 przyjętych (5 DIMENSIONED + 3 STANDARD) · podgląd ${tPre.toFixed(0)} ms (SQL ${p.ms} ms) · zapis ${tCommit.toFixed(0)} ms (SQL ${res.ms} ms) · ${counts}`);
    for (const jwt of [KSH, SCX]) {
      const g = await fetch(`${URL_}/rest/v1/loads?select=id`, { headers: { apikey: ANON, Authorization: `Bearer ${jwt}` } });
      expect(((await g.json()) as unknown[]).length).toBe(8);
    }
  });

  it('drugi import tego samego pliku: 0 zmian, 0 zapisów', async () => {
    const before = psql(`select (select count(*) from load_events)||'/'||(select count(*) from schedule_imports)||'/'||(select max(updated_at) from loads)`);
    const t = performance.now();
    const r = await imp(HHL, full, false, [], { name: 'ksh-harmonogram-synthetic.xlsx', hash: 'h1' });
    const ms = performance.now() - t;
    const res = r.body as unknown as ImportRpcResult;
    expect([res.added.length, res.changed.length, res.unchanged, res.cancelled.length, res.version]).toEqual([0, 0, 8, 0, null]);
    expect(psql(`select (select count(*) from load_events)||'/'||(select count(*) from schedule_imports)||'/'||(select max(updated_at) from loads)`)).toBe(before);
    console.log(`[I-2C] drugi import: 0 nowych · 0 zmian · 8 bez zmian · ${ms.toFixed(0)} ms (SQL ${res.ms} ms)`);
  });

  it('zmieniony plik (XLSX): 2 daty, 1 wymiar, 2 usunięte, 1 nowy → poprawne różnice', async () => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(readFileSync('tests/fixtures/ksh-harmonogram-synthetic.xlsx') as unknown as ExcelJS.Buffer);
    const ws = wb.worksheets[0];
    const hdr: Record<string, number> = {};
    ws.getRow(1).eachCell((c, i) => { hdr[String(c.value).trim()] = i; });
    const byCode = new Map<string, ExcelJS.Row>();
    ws.eachRow((row, i) => { if (i > 1 && row.getCell(hdr['Wysyłka']).value) byCode.set(String(row.getCell(hdr['Wysyłka']).value), row); });
    for (const code of ['QA-02', 'QA-03']) byCode.get(code)!.getCell(hdr['Data dostawy na budowę']).value = new Date('2026-11-20T00:00:00Z');
    byCode.get('QA-04')!.getCell(hdr['Rozmiar L x W x H']).value = '19,00 x 2,45 x 2,45';
    for (const code of ['QA-05', 'STD-03']) byCode.get(code)!.getCell(hdr['Wysyłka']).value = null;
    const last = ws.getRow(ws.rowCount + 1);
    last.getCell(hdr['Wysyłka']).value = 'QA-99';
    last.getCell(hdr['Rozmiar L x W x H']).value = '12,00 x 2,45 x 2,45';
    last.getCell(hdr['Ilość elementów']).value = 1;
    last.getCell(hdr['Waga transport [t]']).value = 9.5;
    last.getCell(hdr['Data załadunku']).value = new Date('2026-11-02T00:00:00Z');
    last.getCell(hdr['Data dostawy na budowę']).value = new Date('2026-11-07T00:00:00Z');
    last.commit();
    const rows = await rowsFromXlsx((await wb.xlsx.writeBuffer()) as ArrayBuffer);
    expect(rows).toHaveLength(7);
    psql(`update loads set plan_load_from = now(), plan_load_to = now() + interval '4 hours' where id = (select load_id from shipment_items where shipment_code = 'QA-02')`);
    const pre = (await imp(HHL, rows, true)).body as unknown as ImportRpcResult;
    expect(pre.added.map((a) => a.code)).toEqual(['QA-99']);
    expect(pre.changed.map((c) => `${c.code}:${c.fields.join('+')}`).sort()).toEqual(['QA-02:delivery_date', 'QA-03:delivery_date', 'QA-04:length_m']);
    expect(pre.cancel_candidates.map((c) => c.code).sort()).toEqual(['QA-05', 'STD-03']);
    expect(pre.critical.map((c) => c.code)).toEqual(['QA-02']);
    const t = performance.now();
    const res = (await imp(HHL, rows, false, ['QA-05', 'STD-03'], { name: 'ksh-harmonogram-v2.xlsx', hash: 'h2' })).body as unknown as ImportRpcResult;
    const ms = performance.now() - t;
    expect([res.version, res.added.length, res.changed.length, res.cancelled.length]).toEqual([2, 1, 3, 2]);
    expect(psql(`select count(*) filter (where status='CANCELLED')||'/'||count(*) from loads`)).toBe('2/9');
    expect(psql(`select plan_delivery_date from loads where id = (select load_id from shipment_items where shipment_code='QA-03')`)).toBe('2026-11-20');
    expect(psql(`select length_m from shipment_items where shipment_code='QA-04'`)).toBe('19.00');
    expect(psql(`select count(*) from load_events where event_type='SCHEDULE_DATE_CRITICAL'`)).toBe('1');
    expect(Number(psql(`select count(*) from notifications where template='SCHEDULE_DATE_CRITICAL'`))).toBeGreaterThanOrEqual(2);
    console.log(`[I-2C] zmieniony plik: +1 ~3 (1 krytyczna) −2 anulowane · wersja 2 · ${ms.toFixed(0)} ms (SQL ${res.ms} ms)`);
  });
});
