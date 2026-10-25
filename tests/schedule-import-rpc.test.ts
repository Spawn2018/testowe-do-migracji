/** I-1 — mapowanie importu w trybie produkcyjnym (bez sieci): pełny harmonogram KSH → wiersze RPC → podgląd. */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { readXlsxRows } from '../src/lib/xlsxRead';
import { parseSchedule } from '../src/lib/scheduleParse';
import { rpcToDiff, toRpcRows, type ImportRpcResult } from '../src/lib/scheduleImportRpc';
import { canImportSchedule } from '../src/lib/permissions';

const KSH_FIXTURE = 'tests/fixtures/ksh-harmonogram-synthetic.xlsx';

async function fullSchedule() {
  const b = readFileSync(KSH_FIXTURE);
  return parseSchedule(await readXlsxRows(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer));
}

describe('I-1 import harmonogramu — tryb produkcyjny', () => {
  const STD = ['STD-01', 'STD-02', 'STD-03'];
  it('ksh-harmonogram-synthetic.xlsx: STANDARD (NTG) pominięte, reszta przyjęta', async () => {
    const p = await fullSchedule();
    expect(p.stats.total).toBeGreaterThanOrEqual(8);
    expect(p.stats.skippedStandard).toBe(3);
    expect(p.stats.accepted).toBe(5);
    expect(p.rows.map((r) => r.shipmentCode)).toEqual(['QA-01', 'QA-02', 'QA-03', 'QA-04', 'QA-05']);
    expect(p.issues.filter((i) => i.code === 'BAD_DIMENSIONS')).toEqual([]);
    expect(p.issues.filter((i) => STD.includes(i.shipmentCode ?? ''))).toEqual([]);
    /* A6: puste wiersze (tylko Lp.) → skippedEmpty, nie ERROR NO_SHIPMENT_CODE (E38). */
    expect(p.stats.skippedEmpty + p.issues.filter((i) => i.code === 'NO_SHIPMENT_CODE').length).toBeGreaterThanOrEqual(5);
  });
  it('wiersze RPC: klucz = Wysyłka, liczby i daty ISO; A6 wysyła zasoby/numery', async () => {
    const rows = toRpcRows((await fullSchedule()).rows);
    expect(rows).toHaveLength(5);
    expect(new Set(rows.map((r) => r.code)).size).toBe(5);
    expect(rows.find((r) => r.code === 'STD-01')).toBeUndefined();
    expect(Object.keys(rows[0])).not.toContain('cargo_class');   // wymiarowe bez klucza — schedule_row bez zmian po 0050
    expect(rows.find((r) => r.code === 'QA-01')).toMatchObject({ code: 'QA-01', length_m: 18.21, width_m: 2.45, height_m: 2.45, qty: 7, total_weight_t: 20.74, load_date: '2026-09-30', delivery_date: '2026-10-05' });
    expect(Object.keys(rows[0])).toContain('driver_name');
    expect(Object.keys(rows[0])).toContain('hhl_order_no');
    expect(Object.keys(rows[0])).toContain('carrier_order_no');
    expect(Object.keys(rows[0])).not.toContain('order_no');
  });
  it('odpowiedź bazy → ten sam podgląd co demo (nowe / zmienione / anulowane / zablokowane)', () => {
    const res: ImportRpcResult = {
      dry_run: true, version: null, import_id: null, rows: 3, unchanged: 1, carrier: 'Scandinavian Express', ms: 12,
      added: [{ code: 'SG-03' }], changed: [{ code: 'SG-01', load_id: 'u1', fields: ['load_date'], critical: true }],
      cancel_candidates: [{ code: 'T-01', load_id: 'u2' }],
      blocked: [{ code: 'SG-00', load_id: 'u3', reason: 'INVOICED', message: '' }, { code: 'T-02', load_id: 'u4', reason: 'CANCELLED', message: '' }],
      cancelled: [], critical: [{ code: 'SG-01', fields: ['load_date'] }],
    };
    const d = rpcToDiff(res, { filename: 'h.xlsx', accepted: 3, total: 3, rejected: 0, warnings: 0, skippedStandard: 0, issues: [] });
    expect(d.added).toEqual([{ code: 'SG-03' }]);
    expect(d.changed).toEqual([{ id: 'u1', patch: {}, criticalDate: true }]);
    expect(d.removalCandidates).toEqual([{ id: 'u2', code: 'T-01' }]);
    expect(d.removalBlocked.map((b) => b.reason)).toEqual(['INVOICED', 'CANCELLED']);
    expect(rpcToDiff(res, { filename: 'h.xlsx', accepted: 0, total: 3, rejected: 3, warnings: 0, skippedStandard: 0, issues: [] }).removalCandidates).toEqual([]);
  });
  it('uprawnienie: tylko HHL — produkcja i demo (I-2a)', () => {
    expect(['HHL', 'KSH', 'SCX'].map((r) => canImportSchedule(r as 'HHL', true))).toEqual([true, false, false]);
    expect(['HHL', 'KSH', 'SCX'].map((r) => canImportSchedule(r as 'HHL', false))).toEqual([true, false, false]); // I-2a: demo jak produkcja
  });
});

describe('I-2C klasa STANDARD — parser, walidator zezwoleń, UI', () => {
  it('„Standard” w wymiarach jest pomijany (NTG), śmieci w wymiarach nadal BAD_DIMENSIONS', () => {
    const base = { 'Wysyłka': 'X-1', 'Ilość elementów': 20, 'Waga transport [t]': 15.34 };
    const ok = parseSchedule([{ ...base, 'Rozmiar L x W x H': ' standard ' }]);
    expect(ok.rows).toHaveLength(0);
    expect(ok.stats.skippedStandard).toBe(1);
    expect(ok.issues.filter((i) => i.severity === 'ERROR')).toEqual([]);
    const bad = parseSchedule([{ ...base, 'Rozmiar L x W x H': 'duży' }]);
    expect(bad.rows).toHaveLength(0);
    expect(bad.issues.some((i) => i.code === 'BAD_DIMENSIONS')).toBe(true);
    const dim = parseSchedule([{ ...base, 'Rozmiar L x W x H': '18,21 x 2,45 x 2,45' }]);
    expect(dim.rows[0].cargoClass).toBe('DIMENSIONED');
  });
});

import { loadFromRow, type LoadRow } from '../src/data/mappers';
import { evaluateLoadCover, isReadyBlocked } from '../src/lib/permits';
describe('I-2C klasa STANDARD — baza → UI i walidator zezwoleń', () => {
  const row = (cargo: 'STANDARD' | 'DIMENSIONED'): LoadRow => ({
    id: '00000000-0000-0000-0000-0000000000c1', order_no: null, carrier_org_id: null, status: 'PLANNED',
    plan_load_date: '2026-10-02', plan_load_from: null, plan_load_to: null, plan_delivery_date: '2026-10-07',
    plan_delivery_from: null, plan_delivery_to: null, tractor_plate: null, trailer_plate: null, driver_name: null,
    driver_phone: null, escort_vehicles: 0, ferry_booking_ref: null, combo_length_m: null, combo_width_m: null,
    combo_height_m: null, combo_weight_t: null, delay_minutes: null, eta_site: null,
    shipment_items: [{ shipment_code: 'T-03', item_type: null, cargo_class: cargo, qty: 27, assembly_seq: null,
      length_m: cargo === 'STANDARD' ? null : 14.62, width_m: cargo === 'STANDARD' ? null : 2.45, height_m: cargo === 'STANDARD' ? null : 2.45,
      total_weight_t: 20.81, unit_weight_t: null }],
  });
  it('wiersz bazy STANDARD zostaje klasą historyczną; zezwolenie nie jest pomijane z powodu klasy', () => {
    const l = loadFromRow(row('STANDARD'), [], 0, '2026-09-27T12:00:00Z');
    expect(l.dims.cargoClass).toBe('STANDARD');
    expect(isReadyBlocked(l, []).reason).not.toContain('zezwolenie niewymagane');
    expect(evaluateLoadCover(l, []).reason).not.toContain('ładunek normatywny');
    expect(loadFromRow(row('DIMENSIONED'), [], 0, '2026-09-27T12:00:00Z').dims).toMatchObject({ lengthM: 14.62 });
    expect(loadFromRow(row('DIMENSIONED'), [], 0, '2026-09-27T12:00:00Z').dims.cargoClass).toBeUndefined();
  });
});
