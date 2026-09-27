/** I-1 — mapowanie importu w trybie produkcyjnym (bez sieci): pełny harmonogram KSH → wiersze RPC → podgląd. */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { readXlsxRows } from '../src/lib/xlsxRead';
import { parseSchedule } from '../src/lib/scheduleParse';
import { rpcToDiff, toRpcRows, type ImportRpcResult } from '../src/lib/scheduleImportRpc';
import { canImportSchedule } from '../src/lib/permissions';

async function fullSchedule() {
  const b = readFileSync('public/KSH_HARMONOGRAM.xlsx');
  return parseSchedule(await readXlsxRows(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer));
}

describe('I-1 import harmonogramu — tryb produkcyjny', () => {
  it('KSH_HARMONOGRAM.xlsx: 123 wiersze, 50 z wysyłką, 41 przyjętych, 9 odrzuconych (wymiar „Standard”)', async () => {
    const p = await fullSchedule();
    expect(p.stats.total).toBe(123);
    expect(p.stats.accepted).toBe(41);
    expect(p.issues.filter((i) => i.code === 'BAD_DIMENSIONS').map((i) => i.shipmentCode)).toEqual(
      ['T-03', 'T-04', 'T-05', 'T-08', 'T-09', 'T-10', 'T-13', 'T-14', 'T-15']);
    expect(p.issues.filter((i) => i.code === 'NO_SHIPMENT_CODE')).toHaveLength(73);
  });
  it('wiersze RPC: klucz = Wysyłka, liczby i daty ISO, bez danych kierowcy', async () => {
    const rows = toRpcRows((await fullSchedule()).rows);
    expect(rows).toHaveLength(41);
    expect(new Set(rows.map((r) => r.code)).size).toBe(41);
    expect(rows[0]).toMatchObject({ code: 'SG-01', length_m: 18.21, width_m: 2.45, height_m: 2.45, qty: 7, total_weight_t: 20.74, load_date: '2026-09-30', delivery_date: '2026-10-05' });
    expect(Object.keys(rows[0])).not.toContain('driver_name');
    expect(Object.keys(rows[0])).not.toContain('driver_phone');
  });
  it('odpowiedź bazy → ten sam podgląd co demo (nowe / zmienione / anulowane / zablokowane)', () => {
    const res: ImportRpcResult = {
      dry_run: true, version: null, import_id: null, rows: 3, unchanged: 1, carrier: 'Scandinavian Express', ms: 12,
      added: [{ code: 'SG-03' }], changed: [{ code: 'SG-01', load_id: 'u1', fields: ['load_date'], critical: true }],
      cancel_candidates: [{ code: 'T-01', load_id: 'u2' }],
      blocked: [{ code: 'SG-00', load_id: 'u3', reason: 'INVOICED', message: '' }, { code: 'T-02', load_id: 'u4', reason: 'CANCELLED', message: '' }],
      cancelled: [], critical: [{ code: 'SG-01', fields: ['load_date'] }],
    };
    const d = rpcToDiff(res, { filename: 'h.xlsx', accepted: 3, total: 3, rejected: 0, warnings: 0, issues: [] });
    expect(d.added).toEqual([{ code: 'SG-03' }]);
    expect(d.changed).toEqual([{ id: 'u1', patch: {}, criticalDate: true }]);
    expect(d.removalCandidates).toEqual([{ id: 'u2', code: 'T-01' }]);
    expect(d.removalBlocked.map((b) => b.reason)).toEqual(['INVOICED', 'CANCELLED']);
    expect(rpcToDiff(res, { filename: 'h.xlsx', accepted: 0, total: 3, rejected: 3, warnings: 0, issues: [] }).removalCandidates).toEqual([]);
  });
  it('uprawnienie: produkcja — tylko HHL; demo — KSH (bez zmian wzorca)', () => {
    expect(['HHL', 'KSH', 'SCX'].map((r) => canImportSchedule(r as 'HHL', true))).toEqual([true, false, false]);
    expect(['HHL', 'KSH', 'SCX'].map((r) => canImportSchedule(r as 'HHL', false))).toEqual([false, true, false]);
  });
});
