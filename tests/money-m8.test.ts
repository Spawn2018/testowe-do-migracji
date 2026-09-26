/** M8 — „ten sam mechanizm” przy każdym wyliczeniu; rozjazd przerywa wyliczenie (lista wyjątków). */
import { describe, expect, it } from 'vitest';
import { buildDemoSnapshot } from '../src/data/demoProvider';
import { applyPriceViews, type PriceViewRow } from '../src/data/mappers';
import { assertSameMechanism, buildPriceSide } from '../src/lib/money/engine';
import { DEMO_NBP_RATES } from '../src/lib/money/demoFx';
import { mechanismIssue, moneyViewFor, tierSummary, withMoneyV2 } from '../src/lib/money/loadMoney';

const snap = buildDemoSnapshot();
const delivered = snap.loads.find((l) => l.status === 'DELIVERED')!;

const row = (o: Partial<PriceViewRow>): PriceViewRow => ({
  load_id: 'L', pricing_tier: 'REALIZACJA', base_amount: 1800, baf_amount: 18, extras_amount: 182,
  computed_total_eur: 2000, invoiced_total_eur: null, effective_total_eur: 2000,
  fuel_ref_date: '2026-09-24', fuel_mult_sek: 1.02, fuel_mult_pln: 1.01, fuel_applied_mult: 1.01,
  fx_table_no: '185/A/NBP/2026', fx_effective_date: '2026-09-23', fx_rate_pln: '4.3588', fx_provisional: false, ...o,
});

describe('M8 niezmiennik mechanizmu', () => {
  const fuel = (m: number) => ({ mechanism: 'SEFS_HYBRID_MIN' as const, referenceDate: '2026-09-24', multSek: m, multPln: m, appliedMultiplier: m, documentRef: 't' });
  const side = (m: number) => buildPriceSide({ tier: 'REALIZACJA', roadRateEur: 1000, roadRateAfterFuelEur: 1000 * m, extras: [], fuel: fuel(m), fx: DEMO_NBP_RATES[0], fxProvisional: false });

  it('rozjazd mnożnika paliwowego przerywa wyliczenie (silnik)', () => {
    expect(() => assertSameMechanism(side(1.01), side(1.02))).toThrow(/Różne mnożniki paliwowe/);
    expect(() => assertSameMechanism(side(1.01), side(1.01))).not.toThrow();
  });

  it('rozjazd w migawkach z bazy → moneyError, bez cichej marży „jak gdyby nic”', () => {
    const l = applyPriceViews(delivered, row({}), row({ fuel_applied_mult: 1.02 }));
    expect(l.pricing.moneyError).toMatch(/Różne mnożniki paliwowe/);
    const ok = applyPriceViews(delivered, row({}), row({ computed_total_eur: 2500, effective_total_eur: 2500 }));
    expect(ok.pricing.moneyError).toBeNull();
    const dates = applyPriceViews(delivered, row({}), row({ fuel_ref_date: '2026-09-25' }));
    expect(dates.pricing.moneyError).toMatch(/Różne daty/);
  });

  it('różne tabele kursu przed fakturą = rozjazd; po fakturze dozwolone', () => {
    const pre = applyPriceViews(delivered, row({}), row({ fx_table_no: '186/A/NBP/2026' }));
    expect(pre.pricing.moneyError).toMatch(/tabele kursowe/);
    const inv = applyPriceViews(delivered, row({ pricing_tier: 'FAKTURA', invoiced_total_eur: 2000 }), row({ fx_table_no: '186/A/NBP/2026' }));
    expect(inv.pricing.moneyError).toBeNull();
  });

  it('jedna strona (rola bez wglądu) → nie ma czego porównać', () => {
    const l = applyPriceViews(delivered, undefined, row({ fuel_applied_mult: 1.5 }));
    expect(l.pricing.moneyError).toBeNull();
    expect(mechanismIssue(l.pricing.money!)).toBeNull();
  });

  it('błąd wyliczenia w aplikacji zdejmuje dane v2 i zapisuje powód (lista wyjątków), nie zero', () => {
    const broken = { ...delivered, unloadedAt: 'nie-data' };
    const l = withMoneyV2(broken, '2026-09-23');
    expect(l.pricing.money).toBeUndefined();
    expect(l.pricing.moneyError).toMatch(/Niepoprawna data/);
    const fine = withMoneyV2(delivered, '2026-09-23');
    expect(fine.pricing.moneyError).toBeNull();
    expect(fine.pricing.money?.v).toBe(2);
  });

  it('ponowne wyliczenie zachowuje kwoty z faktur (Z1)', () => {
    const first = withMoneyV2(delivered, '2026-09-23', 1234);
    const again = withMoneyV2(first, '2026-09-23');
    expect(again.pricing.money!.cost.invoicedEur).toBe(1234);
    expect(again.pricing.money!.cost.tier).toBe('FAKTURA');
  });
});

describe('M8 oznaczenie poziomu i kursu tymczasowego', () => {
  it('strona wyceny dla roli: SCX koszt, KSH przychód, HHL poziom transportu', () => {
    const l = applyPriceViews(delivered, row({ pricing_tier: 'FAKTURA', invoiced_total_eur: 2000 }), row({ fx_provisional: true }));
    const m = l.pricing.money!;
    expect(moneyViewFor('SCX', m).tier).toBe('FAKTURA');
    expect(moneyViewFor('KSH', m).tier).toBe('REALIZACJA');
    expect(moneyViewFor('KSH', m).side.fx.provisional).toBe(true);
    expect(moneyViewFor('HHL', m).tier).toBe('REALIZACJA');
  });

  it('zestawienie poziomów liczy każdy transport raz, błędy osobno', () => {
    const broken = withMoneyV2({ ...delivered, id: 'X', code: 'BROKEN-1', unloadedAt: 'nie-data' }, '2026-09-23');
    const loads = [...snap.loads, broken];
    const s = tierSummary(loads, 'HHL');
    const total = s.counts.PROGNOZA + s.counts.REALIZACJA + s.counts.FAKTURA;
    expect(total).toBe(snap.loads.length);
    expect(s.errors).toEqual(['BROKEN-1']);
    expect(s.counts.PROGNOZA).toBeGreaterThan(0);
  });
});
