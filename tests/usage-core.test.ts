import { describe, expect, it } from 'vitest';
import { FREE_QUOTAS, alertEmail, levelFor, measurements } from '../supabase/functions/_shared/usage/core';

describe('PR4 usage-check — progi', () => {
  it('69,99% OK, 70% WARN, 85% HIGH', () => {
    expect(levelFor(6999, 10000)).toEqual({ pct: 69.99, level: 'OK' });
    expect(levelFor(350_000_000, FREE_QUOTAS.DB_BYTES).level).toBe('WARN');
    expect(levelFor(425_000_000, FREE_QUOTAS.DB_BYTES).level).toBe('HIGH');
  });
  it('pomiary: przybliżenie Edge bez tokenu, API zarządzania z tokenem; transfer tylko z API', () => {
    const m = { db_bytes: 1, storage_bytes: 2, edge_invocations_approx: 3 };
    expect(measurements(m).map((x) => x.metric)).toEqual(['DB_BYTES', 'STORAGE_BYTES', 'EDGE_INVOCATIONS']);
    expect(measurements(m)[2].used).toBe(3);
    const w = measurements(m, { edge_invocations: 9, egress_bytes: 7 });
    expect(w[2]).toMatchObject({ used: 9, source: 'management-api' });
    expect(w[3]).toMatchObject({ metric: 'EGRESS_BYTES', used: 7, quota: 5_000_000_000 });
  });
  it('e-mail po polsku z liczbami', () => {
    const e = alertEmail([{ metric: 'DB_BYTES', pct: 86, used: 430_000_000, quota: 500_000_000, title: 'Limit planu darmowego: baza danych 86,0%' }]);
    expect(e.subject).toContain('85%');
    expect(e.subject).toMatch(/^Watch Tower:/);
    expect(e.text).toContain('baza danych 86,0%');
    expect(e.text).toMatch(/430\s000\s000 z 500\s000\s000/);
  });
});
