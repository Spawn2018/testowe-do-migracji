import { describe, expect, it } from 'vitest';
import {
  matchRateBySymbol,
  rateWarningKey,
  shipmentFamily,
  type RateRule,
} from '../src/lib/money/engine';

/** Stawki zmyślone — nie z cennika produkcyjnego. */
const sym = (
  id: string,
  family: string,
  symbol: string,
  L: number,
  W: number,
  H: number,
  T: number,
  rate: number,
  convoy?: number,
): RateRule => ({
  id,
  family,
  symbol,
  cargoClass: 'SYMBOL',
  lengthFrom: 0,
  lengthTo: L,
  widthFrom: 0,
  widthTo: W,
  heightFrom: 0,
  heightTo: H,
  weightFrom: 0,
  weightTo: T,
  roadRateEur: rate,
  convoyCars: convoy ?? null,
});

const RULES: RateRule[] = [
  sym('bsa', 'BS', 'BS-A', 12.5, 2.45, 1.3, 23, 100),
  sym('bsb', 'BS', 'BS-B', 14.95, 2.45, 1.8, 31.1, 200),
  sym('bsc', 'BS', 'BS-C', 16.5, 2.45, 1.8, 33.6, 300),
  sym('kr3', 'KR', 'KR', 20.2, 3.52, 2.6, 28.4, 400, 3),
  sym('kr2', 'KR', 'KR', 20.2, 3.52, 2.6, 28.4, 500, 2),
  sym('kr1', 'KR', 'KR', 20.2, 3.52, 2.6, 28.4, 600, 1),
  sym('pla', 'PL', 'PL-A', 14.7, 2.45, 2.45, 22.1, 700),
  sym('plb', 'PL', 'PL-B', 14.7, 3.4, 2.45, 14.6, 800),
  sym('sg', 'SG', 'SG', 18.21, 2.45, 2.45, 20.8, 900),
  sym('ss', 'SS', 'SS', 18.21, 3, 2.5, 21.3, 910),
  sym('t', 'T', 'T', 14.62, 2.45, 2.45, 20.2, 920),
  sym('ts', 'TS', 'TS', 17.5, 2.45, 2.65, 22.4, 930),
];

describe('I-30 — cennik według symbolu', () => {
  it('rodziny: TS≠T, SS≠SG', () => {
    expect(shipmentFamily('TS-01')).toBe('TS');
    expect(shipmentFamily('T-01')).toBe('T');
    expect(shipmentFamily('SS-01')).toBe('SS');
    expect(shipmentFamily('SG-32')).toBe('SG');
    expect(shipmentFamily('PL-10.1')).toBe('PL');
    expect(shipmentFamily('KR-08')).toBe('KR');
  });

  it('najmniejsza pozycja BS obejmująca wymiary', () => {
    const r = matchRateBySymbol({
      shipmentCode: 'BS-02',
      dims: { lengthM: 14, widthM: 2.4, heightM: 1.5, weightT: 30 },
      rules: RULES,
    });
    expect(r.matched).toBe(true);
    if (r.matched) expect(r.rule.symbol).toBe('BS-B');
  });

  it('przekroczenie L/W/masy → NO_PRICE (nie zero)', () => {
    const r = matchRateBySymbol({
      shipmentCode: 'BS-99',
      dims: { lengthM: 20, widthM: 2.4, heightM: 1.2, weightT: 20 },
      rules: RULES,
    });
    expect(r).toEqual({ matched: false, reason: 'NO_PRICE' });
    expect(rateWarningKey(r)).toBe('i30_warn_NO_PRICE');
  });

  it('wyłącznie wysokość poza → HEIGHT_ADOPTED', () => {
    const r = matchRateBySymbol({
      shipmentCode: 'PL-2',
      dims: { lengthM: 14.7, widthM: 2.45, heightM: 2.6, weightT: 20 },
      rules: RULES,
    });
    expect(r.matched).toBe(true);
    if (r.matched) {
      expect(r.rule.symbol).toBe('PL-A');
      expect(r.heightAdopted).toBe(true);
    }
  });

  it('PL-1 / PL-10.1 / PL-17.1 przy 2,60 → jak PL-B (decyzja właściciela)', () => {
    for (const code of ['PL-1', 'PL-10.1', 'PL-17.1']) {
      const r = matchRateBySymbol({
        shipmentCode: code,
        dims: { lengthM: 14.7, widthM: 3.4, heightM: 2.6, weightT: 14 },
        rules: RULES,
      });
      expect(r.matched).toBe(true);
      if (r.matched) {
        expect(r.rule.symbol).toBe('PL-B');
        expect(r.heightAdopted).toBe(true);
      }
    }
  });

  it('KR: konwój 1/2/3 wybiera wariant; >3 → cap 3', () => {
    const base = { shipmentCode: 'KR-01', dims: { lengthM: 20, widthM: 3.5, heightM: 2.5, weightT: 28 }, rules: RULES };
    const c1 = matchRateBySymbol({ ...base, convoyCount: 1 });
    const c2 = matchRateBySymbol({ ...base, convoyCount: 2 });
    const c3 = matchRateBySymbol({ ...base, convoyCount: 3 });
    const c4 = matchRateBySymbol({ ...base, convoyCount: 4 });
    expect(c1.matched && c1.roadRateEur).toBe(600);
    expect(c2.matched && c2.roadRateEur).toBe(500);
    expect(c3.matched && c3.roadRateEur).toBe(400);
    expect(c4.matched && c4.roadRateEur).toBe(400);
    if (c4.matched) expect(c4.convoyCapped).toBe(true);
  });

  it('KR bez konwoju → NO_CONVOY', () => {
    const r = matchRateBySymbol({
      shipmentCode: 'KR-01',
      dims: { lengthM: 20, widthM: 3.5, heightM: 2.5, weightT: 28 },
      convoyCount: null,
      rules: RULES,
    });
    expect(r.reason).toBe('NO_CONVOY');
  });
});
