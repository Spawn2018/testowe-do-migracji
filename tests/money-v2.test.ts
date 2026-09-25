/**
 * M2 — dane v2: EUR, trzy poziomy, obie wartości (Z1), migawki mnożnika i kursu,
 * STORE_SCHEMA_VERSION 2 z migracją v1→v2.
 */
import { describe, expect, it } from 'vitest';
import { buildDemoSnapshot } from '../src/data/demoProvider';
import {
  applyInvoiceToSide, buildLoadMoney, fxForDate, marginV2, sideEffectiveEur, sideInvoiceDiffEur, unloadedAtOf,
} from '../src/lib/money/loadMoney';
import { DEMO_NBP_RATES } from '../src/lib/money/demoFx';
import { STORE_SCHEMA_VERSION, migrateTowerPersist } from '../src/lib/storePersist';
import type { Load } from '../src/types';

const snap = buildDemoSnapshot();
const delivered = snap.loads.find((l) => l.status === 'DELIVERED')!;
const inTransit = snap.loads.find((l) => l.status === 'IN_TRANSIT_SE')!;

describe('M2 dane v2', () => {
  it('każdy transport demo ma dane v2 w EUR', () => {
    const withMoney = snap.loads.filter((l) => l.pricing.money?.v === 2);
    expect(withMoney.length).toBe(snap.loads.length);
  });

  it('trzy poziomy: nierozładowany = PROGNOZA, rozładowany = REALIZACJA, zafakturowany = FAKTURA', () => {
    expect(inTransit.pricing.money!.tier).toBe('PROGNOZA');
    const m = buildLoadMoney(delivered, { todayLocal: '2026-09-23' });
    expect(m.tier).toBe('REALIZACJA');
    const inv = buildLoadMoney(delivered, { todayLocal: '2026-09-23', invoicedCostEur: 100, invoicedRevEur: 200 });
    expect(inv.tier).toBe('FAKTURA');
    const half = buildLoadMoney(delivered, { todayLocal: '2026-09-23', invoicedCostEur: 100 });
    expect(half.tier).toBe('REALIZACJA'); // poziom transportu = mniej pewna strona
  });

  it('Z1: faktura nie nadpisuje wyliczonej — obie wartości zostają, marża z fakturowanej, różnica flagowana', () => {
    const m = buildLoadMoney(delivered, { todayLocal: '2026-09-23' });
    const computed = m.cost.computedEur;
    const cost = applyInvoiceToSide(m.cost, computed + 123.45);
    expect(cost.computedEur).toBe(computed);
    expect(cost.invoicedEur).toBe(Math.round((computed + 123.45) * 100) / 100);
    expect(sideEffectiveEur(cost)).toBe(cost.invoicedEur);
    expect(sideInvoiceDiffEur(cost)).toBe(123.45);
    const mm = marginV2({ ...m, cost });
    expect(mm.marginEur).toBeCloseTo(sideEffectiveEur(m.rev) - cost.invoicedEur!, 2);
  });

  it('migawka mnożnika: ta sama data i mnożnik po obu stronach; migawka kursu z numerem tabeli', () => {
    const m = inTransit.pricing.money!;
    expect(m.cost.fuel).toEqual(m.rev.fuel);
    expect(m.cost.fuel.applied).toBe(Math.min(m.cost.fuel.multSek, m.cost.fuel.multPln));
    expect(m.cost.fx.tableNo).toMatch(/^\d{3}\/A\/NBP\/2026$/);
    expect(m.cost.fx.date < m.cost.fuel.refDate).toBe(true); // kurs: dzień roboczy PRZED datą
  });

  it('kurs prowizoryczny dla daty w przyszłości; rozładunek → tabela sprzed dnia rozładunku', () => {
    expect(fxForDate('2026-10-05', '2026-09-23').provisional).toBe(true);
    const r = fxForDate('2026-09-24', '2026-09-26');
    expect(r.provisional).toBe(false);
    expect(r.rate.no).toBe('185/A/NBP/2026');
    expect(DEMO_NBP_RATES.find((x) => x.no === '186/A/NBP/2026')!.mid).toBe(4.39);
  });

  it('rozładowany bez daty (demo) → koniec okna rozładunku; UNLOADED z datą ma pierwszeństwo', () => {
    expect(unloadedAtOf(delivered)).toBeTruthy();
    expect(unloadedAtOf({ ...delivered, unloadedAt: '2026-09-20T10:00:00Z' })).toBe('2026-09-20T10:00:00Z');
    expect(unloadedAtOf(inTransit)).toBeNull();
  });

  it('STORE_SCHEMA_VERSION = 2; migracja v1→v2 dokłada dane v2 bez utraty pól', () => {
    expect(STORE_SCHEMA_VERSION).toBe(2);
    const v1Loads = snap.loads.slice(0, 3).map((l) => {
      const { money: _m, ...pricing } = l.pricing;
      void _m;
      return { ...l, pricing } as Load;
    });
    const res = migrateTowerPersist({ loads: v1Loads, invoices: [], role: 'HHL' }, 1);
    expect(res.wiped).toBe(false);
    const out = res.state.loads as Load[];
    expect(out).toHaveLength(3);
    expect(out.every((l) => l.pricing.money?.v === 2)).toBe(true);
    expect(out[0].code).toBe(v1Loads[0].code);
    expect(out[0].pricing.costTotal).toBe(v1Loads[0].pricing.costTotal);
  });
});

import { applyPriceViews, type PriceViewRow } from '../src/data/mappers';

describe('M2 ceny z widoków rolowych (tryb Supabase)', () => {
  const row = (o: Partial<PriceViewRow>): PriceViewRow => ({
    load_id: 'L', pricing_tier: 'REALIZACJA', base_amount: 1800, baf_amount: 18, extras_amount: 182,
    computed_total_eur: 2000, invoiced_total_eur: null, effective_total_eur: 2000,
    fuel_ref_date: '2026-09-24', fuel_mult_sek: 1.02, fuel_mult_pln: 1.01, fuel_applied_mult: 1.01,
    fx_table_no: '185/A/NBP/2026', fx_effective_date: '2026-09-23', fx_rate_pln: '4.3588', fx_provisional: false, ...o,
  });
  it('HHL (obie strony): marża z wartości efektywnych, Z1 w danych v2', () => {
    const l = applyPriceViews(delivered, row({ invoiced_total_eur: 2100, effective_total_eur: 2100, pricing_tier: 'FAKTURA' }), row({ computed_total_eur: 2500, effective_total_eur: 2500 }));
    expect(l.pricing.margin).toBe(400);
    expect(l.pricing.money!.cost.computedEur).toBe(2000);
    expect(l.pricing.money!.cost.invoicedEur).toBe(2100);
    expect(l.pricing.money!.tier).toBe('REALIZACJA');
    expect(l.pricing.money!.cost.fx.mid).toBe(4.3588);
  });
  it('KSH (tylko przychód): koszt = 0, brak marży', () => {
    const l = applyPriceViews(delivered, undefined, row({ effective_total_eur: 2500 }));
    expect(l.pricing.costTotal).toBe(0);
    expect(l.pricing.revTotal).toBe(2500);
    expect(l.pricing.margin).toBe(0);
  });
});
