/**
 * #508 F7 — metryki / progi / formatResult skryptu deploy-main (bez wywołań LH/bazy).
 */
import { describe, expect, it } from 'vitest';
import {
  LIMIT,
  LIMIT_TEXT,
  METRICS,
  formatResult,
  passesLimits,
} from '../scripts/ci/perf-lighthouse-deploy.mjs';

describe('perf-lighthouse-deploy (#508)', () => {
  it('p1–p3: Logowanie / Offline / Logowanie, ścieżki publiczne', () => {
    expect(METRICS.map((m) => m.id)).toEqual(['p1', 'p2', 'p3']);
    expect(METRICS[0]).toMatchObject({ what: 'Logowanie · telefon', path: '/', formFactor: 'mobile' });
    expect(METRICS[1]).toMatchObject({ what: 'Offline · telefon', path: '/offline.html', formFactor: 'mobile' });
    expect(METRICS[2]).toMatchObject({ what: 'Logowanie · komputer', path: '/', formFactor: 'desktop' });
    expect(METRICS.every((m) => !/Kokpit|Mapa|Harmonogram/.test(m.what))).toBe(true);
  });

  it('progi LCP/CLS/TBT jak PLAN', () => {
    expect(LIMIT).toEqual({ lcpMs: 2500, cls: 0.1, tbtMs: 300 });
    expect(LIMIT_TEXT).toContain('2,5');
  });

  it('formatResult i passesLimits', () => {
    expect(formatResult(2000, 0.01, 100)).toBe('2,0 s · 0,01 · 100 ms');
    expect(formatResult(2500, 0.1, 300)).toBe('2,5 s · 0,10 · 300 ms');
    expect(passesLimits(2500, 0.1, 300)).toBe(true);
    expect(passesLimits(2500.1, 0.1, 300)).toBe(false);
    expect(passesLimits(2500, 0.11, 300)).toBe(false);
    expect(passesLimits(2500, 0.1, 301)).toBe(false);
  });
});
