import { describe, expect, it } from 'vitest';
import {
  HERE_BILLING_DEFAULTS,
  budgetLevel,
  marginalOverCost,
  overPoolCost,
  routingAllows,
  tilesOpen,
} from '../supabase/functions/_shared/here/billing';

describe('D-78 koszt ponad pulę', () => {
  it('w puli koszt jest 0', () => {
    expect(overPoolCost(30000, 30000, 0.0002)).toBe(0);
    expect(overPoolCost(5000, 5000, 0.00275)).toBe(0);
    expect(overPoolCost(100, 30000, 0.0002)).toBe(0);
  });

  it('ponad pulę: (n−pula)×stawka', () => {
    expect(overPoolCost(30010, 30000, 0.0002)).toBeCloseTo(0.002, 8);
    expect(overPoolCost(5001, 5000, 0.00275)).toBeCloseTo(0.00275, 8);
  });

  it('progi tylko od kosztu ponad pule', () => {
    expect(budgetLevel(0, true)).toBe('ok');
    expect(budgetLevel(50, true)).toBe('warn');
    expect(budgetLevel(80, true)).toBe('high');
    expect(budgetLevel(100, true)).toBe('stop');
    expect(budgetLevel(99, false)).toBe('off');
  });

  it('kafelki gasną od 80% budżetu ponad pule', () => {
    expect(tilesOpen(79.9)).toBe(true);
    expect(tilesOpen(80)).toBe(false);
  });

  it('stop przy 100% blokuje także zapytania w darmowej puli', () => {
    expect(routingAllows(100, 'routing', 0, 1, HERE_BILLING_DEFAULTS)).toBe(false);
    expect(routingAllows(0, 'routing', 0, 1, HERE_BILLING_DEFAULTS)).toBe(true);
  });

  it('marginalny koszt w puli jest 0, poza pulą = stawka', () => {
    expect(marginalOverCost('routing', 4999, 1, HERE_BILLING_DEFAULTS)).toBe(0);
    expect(marginalOverCost('routing', 5000, 1, HERE_BILLING_DEFAULTS)).toBeCloseTo(0.00275, 8);
  });

  it('traffic ponad pulę: (n−5000)×0.00292', () => {
    expect(overPoolCost(5000, HERE_BILLING_DEFAULTS.trafficFree, HERE_BILLING_DEFAULTS.trafficRateUsd)).toBe(0);
    expect(overPoolCost(5001, HERE_BILLING_DEFAULTS.trafficFree, HERE_BILLING_DEFAULTS.trafficRateUsd)).toBeCloseTo(0.00292, 8);
    expect(marginalOverCost('traffic', 5000, 1, HERE_BILLING_DEFAULTS)).toBeCloseTo(0.00292, 8);
  });
});
