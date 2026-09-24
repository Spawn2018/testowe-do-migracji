import { describe, expect, it } from 'vitest';
import {
  DEMO_FX,
  DEMO_FX_META,
  eurToPlnDemo,
  formatAppMoney,
  plnToEurDemo,
} from '../src/lib/money/demoFx';
import { RATE_COST, RATE_REV } from '../src/data/seed';
import { buildSeedLoads } from '../src/data/seed';

describe('P6 demo FX', () => {
  it('canonical NBP table 186/A/NBP/2026 mid 4.3900 @ 2026-09-24', () => {
    expect(DEMO_FX.no).toBe('186/A/NBP/2026');
    expect(DEMO_FX.effectiveDate).toBe('2026-09-24');
    expect(DEMO_FX.mid).toBe(4.39);
    expect(DEMO_FX_META.storedAs).toBe('EUR');
    expect(DEMO_FX_META.convertedFrom).toBe('PLN');
    expect(DEMO_FX_META.tableLabel).toBe('186/A/NBP/2026');
  });

  it('converts PLN→EUR and back at mid (2 dp)', () => {
    expect(plnToEurDemo(16500)).toBe(3758.54);
    expect(plnToEurDemo(27900)).toBe(6355.35);
    expect(eurToPlnDemo(3758.54)).toBeCloseTo(16500, 0);
  });

  it('RATE_* seed cards are EUR magnitudes (ex-PLN ÷ 4.39)', () => {
    expect(RATE_COST.map((r) => r.baseRate)).toEqual([3758.54, 4373.58, 5193.62]);
    expect(RATE_REV.map((r) => r.baseRate)).toEqual([4669.7, 5421.41, 6355.35]);
  });

  it('no load pricing currency PLN in seed data', () => {
    const loads = buildSeedLoads();
    const pln = loads.filter((l) => l.pricing.currency === 'PLN');
    expect(pln).toEqual([]);
    expect(loads.every((l) => l.pricing.currency === 'EUR')).toBe(true);
  });

  it('formatAppMoney converts EUR storage ↔ display preference', () => {
    expect(formatAppMoney(1000, 'pl', 'EUR')).toMatch(/1\s?000,00\sEUR/);
    const pln = formatAppMoney(1000, 'pl', 'PLN');
    expect(pln.replace(/\u00a0/g, ' ')).toMatch(/4\s?390,00\sPLN/);
  });
});
