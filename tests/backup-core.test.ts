import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Encrypter } from 'age-encryption';
import {
  BACKUP_BUCKETS, CHUNK_EST_ROWS, EXCLUDED_TABLES, EXCLUSION_REASONS, REQUIRED_TABLES, REST_CSV_MAX_ROWS,
  PART_MAX_ROWS, SELECT_BATCH_ROWS, TABLE_COPY_TIMEOUT_MS, TABLE_SELECT_TIMEOUT_MS, WALL_BUDGET_MS,
  assertCsvInCountWindow, assertCsvMatchesDbCount, assertSafeCtid, backupTables, copyCtidRangeSql,
  csvEscapeField, csvRowCount, ctidPageRanges, gzip, heapPagesFromBytes, parseBackupProgress,
  parseSelectColumns, partObjectKey, pastWallBudget, postgrestSelectParam, remainingTables,
  retentionDeletes, rowsToCsv, sealTable, selectTextCastSql, sha256Hex, shouldChunkByEstimate,
} from '../supabase/functions/_shared/backup/core';

const hasAge = (() => { try { execFileSync('age', ['--version']); return true; } catch { return false; } })();

describe('ANEKS 4 PR2 — logika kopii', () => {
  const CAT = ['positions', 'driver_tokens', 'account_relink_pending', 'load_events', 'loads', 'schedule_imports', ...REQUIRED_TABLES];
  it('surowe pozycje GPS i tokeny poza kopią; load_events (zdarzenia biznesowe) w kopii', () => {
    const t = backupTables(CAT);
    expect(t).not.toContain('positions');
    expect(EXCLUDED_TABLES).toContain('positions');
    expect(t).toContain('load_events');
    expect(new Set(t).size).toBe(t.length);
  });
  it('I-2B: tabele z katalogu — nowa tabela trafia do kopii bez zmiany kodu; schedule_imports w kopii', () => {
    const t = backupTables([...CAT, 't_nowa_tabela']);
    expect(t).toContain('t_nowa_tabela');
    expect(t).toContain('schedule_imports');
    expect(t).toEqual([...t].sort());
  });
  it('I-2B: każde wyłączenie ma powód; brak wymaganej tabeli albo zła nazwa = błąd przebiegu', () => {
    for (const k of EXCLUDED_TABLES) expect(EXCLUSION_REASONS[k].length).toBeGreaterThan(10);
    expect(() => backupTables(CAT.filter((x) => x !== 'loads'))).toThrow(/loads/);
    expect(() => backupTables([...CAT, 'x; drop table loads'])).toThrow(/niedozwolone/);
  });
  it('I-2B: kubełek harmonogramy w kopii', () => {
    expect(BACKUP_BUCKETS).toContain('harmonogramy');
  });

  it('liczba wierszy CSV z nagłówkiem, także z nową linią w polu', () => {
    expect(csvRowCount('a,b\n1,2\n3,"x\ny"\n')).toBe(2);
    expect(csvRowCount('a,b\n')).toBe(0);
    expect(csvRowCount('')).toBe(0);
  });

  // #463 / D-20261022-2110-01 + F7 #472 — stronicowanie; ostatni zakres otwarty; kompletność
  it('#463: shouldChunkByEstimate od progu; zakresy ctid — ostatni bez górnej granicy', () => {
    expect(shouldChunkByEstimate(CHUNK_EST_ROWS - 1)).toBe(false);
    expect(shouldChunkByEstimate(CHUNK_EST_ROWS)).toBe(true);
    expect(heapPagesFromBytes(0)).toBe(1);
    expect(heapPagesFromBytes(8192)).toBe(1);
    expect(heapPagesFromBytes(8193)).toBe(2);
    expect(heapPagesFromBytes(2049 * 8192)).toBe(2049);
    expect(heapPagesFromBytes(2310 * 8192)).toBe(2310);
    expect(ctidPageRanges(0)).toEqual([{ from: 0, to: null }]);
    expect(ctidPageRanges(32)).toEqual([{ from: 0, to: null }]);
    expect(ctidPageRanges(33)).toEqual([{ from: 0, to: 32 }, { from: 32, to: null }]);
    expect(copyCtidRangeSql('notifications', 0, 32, null, true)).toContain('header true');
    expect(copyCtidRangeSql('notifications', 0, 32, null, true)).toContain("ctid < '(32,0)'");
    expect(copyCtidRangeSql('notifications', 32, null, null, false)).toContain('header false');
    expect(copyCtidRangeSql('notifications', 32, null, null, false)).toMatch(/ctid >= '\(32,0\)'::tid\)/);
    expect(copyCtidRangeSql('notifications', 32, null, null, false)).not.toContain('ctid <');
    expect(copyCtidRangeSql('loads', 0, 8, '"id", "code"', true)).toContain('"id", "code"');
    expect(() => copyCtidRangeSql('x;drop', 0, 1, null, true)).toThrow(/niedozwolona/);
    expect(() => copyCtidRangeSql('loads', 5, 5, null, true)).toThrow(/zakres/);
    expect(() => assertCsvMatchesDbCount(10, 10, 'loads')).not.toThrow();
    expect(() => assertCsvMatchesDbCount(9, 10, 'notifications')).toThrow(/niekompletna.*notifications.*csv=9.*db=10/);
  });

  // #479 F7: poza RR — przedział n0/n1 (wstawki / retencja w trakcie); brak wierszy → ERROR
  it('#479: assertCsvInCountWindow — wstawki, usunięcia, ubytek w CSV', () => {
    expect(() => assertCsvInCountWindow(100, 100, 100, 'loads')).not.toThrow();
    expect(() => assertCsvInCountWindow(105, 100, 110, 'integration_runs')).not.toThrow(); // wstawki
    expect(() => assertCsvInCountWindow(95, 100, 90, 'sms_heartbeats')).not.toThrow(); // retencja
    expect(() => assertCsvInCountWindow(100, 110, 90, 'notifications')).not.toThrow(); // n0>n1, csv w środku
    expect(() => assertCsvInCountWindow(89, 100, 90, 'audit_log')).toThrow(
      /niekompletna.*audit_log.*csv=89.*n0=100.*n1=90/,
    ); // csv < lo
    expect(() => assertCsvInCountWindow(111, 100, 110, 'vessel_positions')).toThrow(
      /niekompletna.*vessel_positions.*csv=111.*n0=100.*n1=110/,
    ); // csv > hi
    expect(() => assertCsvInCountWindow(0, 5, 5, 'app_users')).toThrow(/csv=0.*n0=5.*n1=5/);
  });

  // #479 cz.5 (historyczne): próg PostgREST; F7 A — select w Edge, helpery CSV zostają
  it('#479: postgrestSelectParam / REST_CSV_MAX_ROWS', () => {
    expect(REST_CSV_MAX_ROWS).toBe(1000);
    expect(REST_CSV_MAX_ROWS).toBeLessThan(CHUNK_EST_ROWS);
    expect(postgrestSelectParam(null)).toBe('*');
    expect(postgrestSelectParam('')).toBe('*');
    expect(postgrestSelectParam('"id", "email"')).toBe('id,email');
    expect(postgrestSelectParam('id, code')).toBe('id,code');
    expect(() => postgrestSelectParam('"id";drop')).toThrow(/zła kolumna/);
  });

  // #479 F7 A: bez COPY — select porcjami + CSV w kodzie
  it('#479 F7 A: select batch / CSV escape / ctid', () => {
    expect(SELECT_BATCH_ROWS).toBe(2_000);
    expect(TABLE_SELECT_TIMEOUT_MS).toBe(TABLE_COPY_TIMEOUT_MS);
    // #498: wall krótszy — tabela w częściach, timeout całej tabeli historyczny
    expect(TABLE_SELECT_TIMEOUT_MS).toBeGreaterThanOrEqual(WALL_BUDGET_MS);
    expect(parseSelectColumns(null)).toBeNull();
    expect(parseSelectColumns('"id", "code"')).toEqual(['id', 'code']);
    expect(selectTextCastSql(['id', 'code'])).toBe('"id"::text as "id", "code"::text as "code"');
    expect(assertSafeCtid('(0,1)')).toBe('(0,1)');
    expect(() => assertSafeCtid('0,1')).toThrow(/zły ctid/);
    expect(csvEscapeField(null)).toBe('');
    expect(csvEscapeField('')).toBe('""');
    expect(csvEscapeField('a,b')).toBe('"a,b"');
    expect(csvEscapeField('x"y')).toBe('"x""y"');
    expect(csvEscapeField('plain')).toBe('plain');
    expect(rowsToCsv(['a', 'b'], [[null, '1'], ['', 'x,y']])).toBe('a,b\n,1\n"","x,y"\n');
    expect(csvRowCount(rowsToCsv(['a'], []))).toBe(0);
    expect(csvRowCount(rowsToCsv(['a'], [['1'], ['2']]))).toBe(2);
  });

  // #463 F7: kontynuacja w limicie Edge (~150 s) — budżet wywołania + lista pozostałych tabel
  it('#463: remainingTables / pastWallBudget / timeout tabeli < wall', () => {
    expect(TABLE_COPY_TIMEOUT_MS).toBeGreaterThan(WALL_BUDGET_MS); // #498: wall krótszy; tabela w częściach
    expect(WALL_BUDGET_MS).toBeLessThan(150_000);
    expect(remainingTables(['a', 'b', 'c'], { a: 1 })).toEqual(['b', 'c']);
    expect(remainingTables(['a', 'b'], null)).toEqual(['a', 'b']);
    expect(remainingTables(['a'], { a: 0 })).toEqual([]);
    expect(pastWallBudget(1_000, 1_000 + WALL_BUDGET_MS - 1)).toBe(false);
    expect(pastWallBudget(1_000, 1_000 + WALL_BUDGET_MS)).toBe(true);
  });

  // #498: części ≤ 5000 wierszy; klucz partNNNN; progress w backup_runs
  it('#498: PART_MAX_ROWS / partObjectKey / parseBackupProgress', () => {
    expect(PART_MAX_ROWS).toBe(5_000);
    expect(PART_MAX_ROWS).toBeGreaterThan(SELECT_BATCH_ROWS);
    expect(partObjectKey('integration_runs', 1)).toBe('integration_runs.part0001.csv.gz.age');
    expect(partObjectKey('notifications', 12)).toBe('notifications.part0012.csv.gz.age');
    expect(() => partObjectKey('x;drop', 1)).toThrow(/niedozwolona/);
    expect(() => partObjectKey('loads', 0)).toThrow(/części/);
    const p = parseBackupProgress({
      table: 'integration_runs', after_ctid: '(10,2)', next_part: 3, n0: 70_000, rows_so_far: 10_000,
      parts: [{ part: 1, rows: 5000, key: 'integration_runs.part0001.csv.gz.age' }],
    });
    expect(p?.table).toBe('integration_runs');
    expect(p?.after_ctid).toBe('(10,2)');
    expect(p?.next_part).toBe(3);
    expect(p?.rows_so_far).toBe(10_000);
    expect(parseBackupProgress(null)).toBeNull();
    expect(parseBackupProgress({ table: 'bad;x', next_part: 1, n0: 1, rows_so_far: 0 })).toBeNull();
  });

  it('retencja: dzienne > 30 dni i miesięczne ≥ 12 miesięcy do usunięcia; pliki zostają', () => {
    const today = new Date('2026-09-26T01:00:00Z');
    const del = retentionDeletes([
      'daily/2026-09-26/loads.csv.gz.age', 'daily/2026-08-27/loads.csv.gz.age', 'daily/2026-08-26/loads.csv.gz.age',
      'monthly/2025-10/loads.csv.gz.age', 'monthly/2025-09/loads.csv.gz.age', 'files/dokumenty/p/l/d/a.pdf.age',
    ], today);
    expect(del).toEqual(['daily/2026-08-26/loads.csv.gz.age', 'monthly/2025-09/loads.csv.gz.age']);
  });

  it('3b: retencja nigdy nie kasuje obiektu pod blokadą R2 (docs/handover/r2/bucket-lock.json)', async () => {
    const { readFileSync } = await import('node:fs');
    const lock = JSON.parse(readFileSync('docs/handover/r2/bucket-lock.json', 'utf8')) as { rules: { prefix: string; condition: { maxAgeSeconds: number } }[] };
    const lockMs = (k: string) => (lock.rules.find((r) => k.startsWith(r.prefix))?.condition.maxAgeSeconds ?? 0) * 1000;
    const created = new Map<string, number>();
    let checked = 0;
    for (let t = Date.UTC(2026, 0, 1, 2, 30); t < Date.UTC(2028, 6, 1); t += 86_400_000) {
      const now = new Date(t);
      created.set(`daily/${now.toISOString().slice(0, 10)}/m.age`, t);
      if (now.getUTCDate() === 1) created.set(`monthly/${now.toISOString().slice(0, 7)}/m.age`, t);
      for (const k of retentionDeletes([...created.keys()], now)) {
        expect(t - created.get(k)!, k).toBeGreaterThanOrEqual(lockMs(k));
        created.delete(k); checked++;
      }
    }
    expect(checked).toBeGreaterThan(800);
  });

  it.skipIf(!hasAge)('format zgodny z restore.sh: JS gzip + age (X25519) → `age -d | gunzip`; zły klucz odrzucony', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'wt-age-'));
    try {
    execFileSync('age-keygen', ['-o', join(dir, 'k.txt')], { stdio: 'ignore' });
    const recipient = execFileSync('age-keygen', ['-y', join(dir, 'k.txt')]).toString().trim();
    expect(recipient).toMatch(/^age1[0-9a-z]+$/);
    const csv = 'id,order_no\n1,"KSH/1"\n2,"Zażółć gęślą jaźń"\n';
    const sealed = await sealTable(new TextEncoder().encode(csv), async (p) => { const e = new Encrypter(); e.addRecipient(recipient); return await e.encrypt(p); });
    expect(Buffer.from(sealed).includes(Buffer.from('KSH/1'))).toBe(false);
    writeFileSync(join(dir, 't.csv.gz.age'), sealed);
    const out = execFileSync('bash', [
      '-c',
      'age -d -i "$1" "$2" | gunzip',
      '_',
      join(dir, 'k.txt'),
      join(dir, 't.csv.gz.age'),
    ]).toString();
    expect(out).toBe(csv);
    execFileSync('age-keygen', ['-o', join(dir, 'zly.txt')], { stdio: 'ignore' });
    expect(() => execFileSync('age', ['-d', '-i', join(dir, 'zly.txt'), join(dir, 't.csv.gz.age')], { stdio: 'pipe' })).toThrow();
    expect((await gzip(new Uint8Array(10_000))).byteLength).toBeLessThan(200);
    } finally {
      rmSync(dir, { recursive: true, force: true });   // klucze testowe nie zostają na dysku
    }
  });
});

describe('PR2 — zapis przez Worker (tylko dopisywanie)', async () => {
  const { writerClient, rerunPrefix } = await import('../supabase/functions/_shared/backup/core');
  const calls: { url: string; init: RequestInit }[] = [];
  const fake = (status: number) => (async (url: string, init: RequestInit) => { calls.push({ url, init }); return new Response('', { status }); }) as unknown as typeof fetch;
  it('PUT z nagłówkiem sekretu; 201 → CREATED, 409 → EXISTS, inny → błąd', async () => {
    expect(await writerClient('https://w.example/', 's3cret', fake(201))('daily/2026-09-27/a b.csv.gz.age', new Uint8Array([1]))).toBe('CREATED');
    expect(calls[0].url).toBe('https://w.example/daily/2026-09-27/a%20b.csv.gz.age');
    expect(calls[0].init.method).toBe('PUT');
    expect((calls[0].init.headers as Record<string, string>)['x-backup-secret']).toBe('s3cret');
    expect(await writerClient('https://w.example', 's', fake(409))('daily/x', new Uint8Array())).toBe('EXISTS');
    await expect(writerClient('https://w.example', 's', fake(401))('daily/x', new Uint8Array())).rejects.toThrow(/401/);
  });
  it('ponowny przebieg → katalog z godziną UTC', () => {
    expect(rerunPrefix('daily/2026-09-27/', new Date('2026-09-27T01:02:03Z'))).toBe('daily/2026-09-27-010203/');
  });
});

describe('PR2-B: suma SHA-256 plików w manifeście', () => {
  it('sha256Hex = wzorcowa suma (hex, 64 znaki)', async () => {
    expect(await sha256Hex(new TextEncoder().encode('abc'))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
  it('lista wyłączeń obejmuje stan przejściowy odtworzenia (account_relink_pending)', () => {
    expect(EXCLUDED_TABLES).toContain('account_relink_pending');
  });
});
