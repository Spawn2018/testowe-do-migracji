import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

// I-15 (0062): pasmo ETA = pierwiastek z sumy kwadratów składników; odpoczynek dobowy 11 h ±0% jako osobny odcinek, przerwy 2 h ±50%.
const rss = (xs: number[]) => Math.round(Math.sqrt(xs.reduce((a, x) => a + x * x, 0)));

describe('I-15 — pasmo ETA (RSS)', () => {
  it('liczby przed/po zgodne z testem bazy (i2.sh)', () => {
    const pl = 7.5 * 60 * 0.25, se = 17 * 60 * 0.2, rest = 11 * 60 * 0, brk = 2 * 60 * 0.5;
    expect(rss([360, pl, se, rest, brk])).toBe(433); // przed: 1013 (suma, SE 30 h ±30%)
    expect(rss([30, pl, se, brk])).toBe(242); // przed: 683
    expect(rss([30, 60, pl, se, brk])).toBe(250); // przed: 743
    expect(rss([30, 60, se, brk])).toBe(223); // przed: 630
  });
  it('migracja: parametry i RSS w funkcji', () => {
    const s = readFileSync('supabase/migrations/0062_eta_band_rss.sql', 'utf8');
    expect(s).toContain("'SE_DAILY_REST', 'Odpoczynek dobowy");
    expect(s).toMatch(/update eta_segment_params set hours = 2, spread_pct = 50/);
    expect(s).toContain('round(sqrt(v_var))::int');
    expect(s).not.toContain('v_conf');
  });
});
