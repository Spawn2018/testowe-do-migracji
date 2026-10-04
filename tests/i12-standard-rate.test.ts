import { describe, expect, it } from 'vitest';
import {
  assertSameMechanism, buildPriceSide, marginForLoad, matchRateForCargo, rateWarningKey,
  type FuelSnapshot, type NbpRate, type RateRule,
} from '../src/lib/money/engine';
import { hasKey } from '../src/i18n/messages';

// Stawki TESTOWE (nie z cennika — D-1: prawdziwe kwoty wpisuje właściciel).
const TEST_STD_COST = 1000, TEST_STD_REV = 1300;
const dimRule = (id: string, rate: number): RateRule => ({ id, lengthFrom: 0, lengthTo: 30, widthFrom: 0, widthTo: 5, heightFrom: 0, heightTo: 5, weightFrom: 0, weightTo: 60, roadRateEur: rate });
const stdRule = (id: string, rate: number): RateRule => ({ id, lengthFrom: 0, lengthTo: 9999, widthFrom: 0, widthTo: 9999, heightFrom: 0, heightTo: 9999, weightFrom: 0, weightTo: 9999, roadRateEur: rate, cargoClass: 'STANDARD' });
const fuel: FuelSnapshot = { mechanism: 'SEFS_HYBRID_MIN', referenceDate: '2026-10-06', multSek: 1.1, multPln: 1.04, appliedMultiplier: 1.04, documentRef: 'test' };
const fx: NbpRate = { table: 'A', no: '190/A/NBP/2026', effectiveDate: '2026-10-05', mid: 4.25 };

describe('STD-CLEAN — klasa STANDARD bez stawki', () => {
  it('STANDARD nie dobiera stawki, także gdy w regułach została stara pozycja; wymiarowy jej nie bierze', () => {
    const rules = [dimRule('d1', 2000), stdRule('s1', TEST_STD_COST)];
    const s = matchRateForCargo({ cargoClass: 'STANDARD', dims: null }, rules);
    expect(s.matched).toBe(false);
    expect('roadRateEur' in s).toBe(false);
    const d = matchRateForCargo({ cargoClass: 'DIMENSIONED', dims: { lengthM: 18, widthM: 2.4, heightM: 2.4, weightT: 20 } }, rules);
    expect(d.matched && d.rule.id).toBe('d1');
  });
  it('brak stawki STANDARD = ostrzeżenie, nie zero (PL/EN/SV)', () => {
    const r = matchRateForCargo({ cargoClass: 'STANDARD', dims: null }, [dimRule('d1', 2000)]);
    expect(r.matched).toBe(false);
    expect('roadRateEur' in r).toBe(false);
    const key = rateWarningKey(r)!;
    expect(key).toBe('i12_warn_NO_STANDARD_RATE');
    for (const loc of ['pl', 'en', 'sv'] as const) expect(hasKey(loc, key)).toBe(true);
    expect(rateWarningKey(matchRateForCargo({ cargoClass: 'STANDARD', dims: null }, [stdRule('a', 1), stdRule('b', 2)]))).toBe('i12_warn_NO_STANDARD_RATE');
    expect(rateWarningKey(matchRateForCargo({ cargoClass: 'DIMENSIONED', dims: null }, [dimRule('d1', 1)]))).toBe('i12_warn_NO_DIMENSIONS');
  });
  it('mechanizm paliwa i kursu zostaje na stawce wymiarowej; STANDARD nie daje kwoty', () => {
    const blocked = matchRateForCargo({ cargoClass: 'STANDARD', dims: null }, [stdRule('sc', TEST_STD_COST)]);
    expect(blocked.matched).toBe(false);
    const c = matchRateForCargo({ cargoClass: 'DIMENSIONED', dims: { lengthM: 18, widthM: 2.4, heightM: 2.4, weightT: 20 } }, [dimRule('sc', TEST_STD_COST)]);
    const r = matchRateForCargo({ cargoClass: 'DIMENSIONED', dims: { lengthM: 18, widthM: 2.4, heightM: 2.4, weightT: 20 } }, [dimRule('sr', TEST_STD_REV)]);
    if (!c.matched || !r.matched) throw new Error('brak stawki testowej');
    const cost = buildPriceSide({ tier: 'PROGNOZA', roadRateEur: c.roadRateEur, roadRateAfterFuelEur: c.roadRateEur * fuel.appliedMultiplier, fuel, fx });
    const rev = buildPriceSide({ tier: 'PROGNOZA', roadRateEur: r.roadRateEur, roadRateAfterFuelEur: r.roadRateEur * fuel.appliedMultiplier, fuel, fx });
    expect(() => assertSameMechanism(cost, rev)).not.toThrow();
    expect(cost.fuelAmountEur).toBe(40);
    expect(rev.fuelAmountEur).toBe(52);
    const m = marginForLoad(cost, rev);
    expect(m.marginEur).toBe(312);
    expect(m.pln.margin).toBe(Math.round((1352 * 4.25 - 1040 * 4.25) * 100) / 100);
  });
});
