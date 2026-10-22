/* Właściciel 21.10.2026 20:14: Rozliczenia › tydzień z opłatą paliwową — „Brak listy publikacji” mimo notowań w bazie. */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { publicationsFromReadings } from '../src/lib/fuelPublSource';
import { fuelBasisFromDb, PRICE_VIEW_COLUMNS, PRICE_VIEW_COLUMNS_NO_BASIS } from '../src/data/mappers';
import { enrichFromBasis } from '../src/lib/p5Source';
import type { FuelWeekRow } from '../src/lib/p5Finance';
import type { Load } from '../src/types';

const r = (id: string, index_code: string, reading_date: string, value: number, entered_at: string, corrects_id: string | null = null) =>
  ({ id, index_code, reading_date, value, corrects_id, entered_at });

describe('publikacje cen paliwa z bazy', () => {
  it('SEK → OKQ8, PLN → Orlen; korekta zastępuje poprawiony wiersz; sortowanie po dniu', () => {
    const out = publicationsFromReadings([
      r('a', 'SEK', '2026-10-13', 22.8, '2026-10-13T10:00:00Z'),
      r('b', 'PLN', '2026-10-13', 7.0, '2026-10-13T10:00:00Z'),
      r('c', 'SEK', '2026-10-13', 22.9, '2026-10-14T10:00:00Z', 'a'),
      r('d', 'PLN', '2026-10-12', 6.9, '2026-10-12T10:00:00Z'),
    ]);
    expect(out).toEqual([
      { date: '2026-10-12', source: 'ORLEN', price: 6.9 },
      { date: '2026-10-13', source: 'OKQ8', price: 22.9 },
      { date: '2026-10-13', source: 'ORLEN', price: 7 },
    ]);
  });
  it('Finanse i panel cen wczytują publikacje z bazy', () => {
    for (const f of ['../src/views/FinanceView.tsx', '../src/components/drawer/PanelPrices.tsx']) {
      expect(readFileSync(new URL(f, import.meta.url), 'utf8')).toContain('useFuelPublications()');
    }
    expect(readFileSync(new URL('../src/lib/p5Source.ts', import.meta.url), 'utf8')).toContain('fuelPublicationsIn(r.idx.from, to)');
  });

  it('#409 / 0268: fuel_basis z widoku ceny → średnie, liczby, publikacje; zły kształt pominięty', () => {
    const b = fuelBasisFromDb({
      avg_sek: '23.10', avg_pln: 7.11, n_sek: 7, n_pln: 5,
      pubs_sek: [{ published_on: '2026-10-13', value: 22.94 }, { published_on: '2026-10-12', value: '23.14' }, { value: 1 }],
      pubs_pln: [{ published_on: '2026-10-13T00:00:00Z', value: 7.1 }],
      owner_note: 'nie dla frontu',
    })!;
    expect(b).toEqual({
      avgSek: 23.1, avgPln: 7.11, nSek: 7, nPln: 5,
      pubs: [
        { date: '2026-10-12', source: 'OKQ8', price: 23.14 },
        { date: '2026-10-13', source: 'OKQ8', price: 22.94 },
        { date: '2026-10-13', source: 'ORLEN', price: 7.1 },
      ],
    });
    expect(fuelBasisFromDb(null)).toBeNull();
    expect(PRICE_VIEW_COLUMNS).toBe(PRICE_VIEW_COLUMNS_NO_BASIS + ',fuel_basis');
  });

  it('#409: KSH/SCX bez fuel_index_readings — publikacje i średnie z fuel_basis transportu tygodnia; prognoza bez średnich', () => {
    const basis = { avgSek: 23.1, avgPln: 7.11, nSek: 7, nPln: 5, pubs: [
      { date: '2026-10-11', source: 'OKQ8' as const, price: 1 },
      { date: '2026-10-13', source: 'OKQ8' as const, price: 22.94 },
      { date: '2026-10-14', source: 'ORLEN' as const, price: 7.1 },
    ] };
    const side = { tier: 'PROGNOZA', computedEur: 1, invoicedEur: null, fuel: { refDate: '2026-10-20', multSek: 1.1, multPln: 1.2, applied: 1.1, basis }, fx: { tableNo: '', mid: 0, date: '', provisional: true } };
    const load = { id: 'L1', code: 'SG-01', pricing: { money: { v: 2, tier: 'PROGNOZA', cost: side, rev: side } } } as unknown as Load;
    const row: FuelWeekRow = {
      key: '2026-10-19', week: { no: 43, from: '2026-10-19', to: '2026-10-25' } as never, idx: { no: 42, from: '2026-10-12', to: '2026-10-18' } as never,
      okq8: { avg: null, n: null, mult: 1.1 }, orlen: { avg: null, n: null, mult: 1.2 }, applied: 1.1, state: 'OSTATECZNA',
      finalFrom: null, running: false, loads: [{ id: 'L1', code: 'SG-01' }],
    };
    const out = enrichFromBasis(row, [load], 'rev', '2026-10-22');
    expect(out.okq8).toEqual({ avg: 23.1, n: 7, mult: 1.1 });
    expect(out.orlen).toEqual({ avg: 7.11, n: 5, mult: 1.2 });
    expect(out.publications?.map((p) => p.date)).toEqual(['2026-10-13', '2026-10-14']);
    const prog = enrichFromBasis({ ...row, state: 'PROGNOZA', okq8: null, orlen: null }, [load], 'rev', '2026-10-22');
    expect(prog.okq8).toBeNull();
    expect(readFileSync(new URL('../src/lib/p5Source.ts', import.meta.url), 'utf8')).toContain('fromReadings && fromReadings.length ? fromReadings : fromBasis');
    expect(enrichFromBasis({ ...row, weekLast: row.week }, [load], 'rev', '2026-10-22')).toEqual({ ...row, weekLast: row.week });
  });
});
