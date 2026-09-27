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
  const STD = ['T-03', 'T-04', 'T-05', 'T-08', 'T-09', 'T-10', 'T-13', 'T-14', 'T-15'];
  it('KSH_HARMONOGRAM.xlsx: 123 wiersze, 50 z wysyłką — 50 przyjętych, w tym 9 klasy STANDARD (I-2C)', async () => {
    const p = await fullSchedule();
    expect(p.stats.total).toBe(123);
    expect(p.stats.accepted).toBe(50);
    expect(p.issues.filter((i) => i.code === 'BAD_DIMENSIONS')).toEqual([]);
    expect(p.rows.filter((r) => r.cargoClass === 'STANDARD').map((r) => r.shipmentCode)).toEqual(STD);
    expect(p.rows.filter((r) => r.cargoClass === 'STANDARD').every((r) => r.lengthM == null && r.widthM == null && r.heightM == null)).toBe(true);
    expect(p.issues.filter((i) => i.code === 'OVERSIZE' && STD.includes(i.shipmentCode ?? ''))).toEqual([]);
    expect(p.issues.filter((i) => i.code === 'NO_SHIPMENT_CODE')).toHaveLength(73);
  });
  it('wiersze RPC: klucz = Wysyłka, liczby i daty ISO, bez danych kierowcy', async () => {
    const rows = toRpcRows((await fullSchedule()).rows);
    expect(rows).toHaveLength(50);
    expect(new Set(rows.map((r) => r.code)).size).toBe(50);
    expect(rows.find((r) => r.code === 'T-03')).toMatchObject({ cargo_class: 'STANDARD', length_m: null, width_m: null, height_m: null, qty: 27, total_weight_t: 20.81 });
    expect(Object.keys(rows[0])).not.toContain('cargo_class');   // wymiarowe bez klucza — schedule_row bez zmian po 0050
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

describe('I-2C klasa STANDARD — parser, walidator zezwoleń, UI', () => {
  it('„Standard” (dowolna wielkość liter) → klasa STANDARD; śmieci w wymiarach nadal BAD_DIMENSIONS', () => {
    const base = { 'Wysyłka': 'X-1', 'Ilość elementów': 20, 'Waga transport [t]': 15.34 };
    const ok = parseSchedule([{ ...base, 'Rozmiar L x W x H': ' standard ' }]);
    expect(ok.rows[0]).toMatchObject({ cargoClass: 'STANDARD', lengthM: null, widthM: null, heightM: null });
    const bad = parseSchedule([{ ...base, 'Rozmiar L x W x H': 'duży' }]);
    expect(bad.rows).toHaveLength(0);
    expect(bad.issues[0].code).toBe('BAD_DIMENSIONS');
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
  it('wiersz bazy STANDARD (wymiary NULL) → Load z cargoClass STANDARD; walidator zezwoleń pomija, READY niezablokowany', () => {
    const l = loadFromRow(row('STANDARD'), [], 0, '2026-09-27T12:00:00Z');
    expect(l.dims.cargoClass).toBe('STANDARD');
    expect(isReadyBlocked(l, [])).toEqual({ blocked: false, reason: 'ładunek normatywny (Standard) — zezwolenie niewymagane' });
    expect(evaluateLoadCover(l, []).covered).toBe(true);
    expect(loadFromRow(row('DIMENSIONED'), [], 0, '2026-09-27T12:00:00Z').dims).toMatchObject({ lengthM: 14.62 });
    expect(loadFromRow(row('DIMENSIONED'), [], 0, '2026-09-27T12:00:00Z').dims.cargoClass).toBeUndefined();
  });
});
