/**
 * DP-81/82 (#762, #898 F7): szum ostrzeżeń ferry-schedule.
 * DP-82: nieznany kod (np. „–”) na przeszłych datach Polferries — bez ostrzeżenia.
 */
import { describe, expect, it } from 'vitest';
import { parsePolferriesSchedule } from '../supabase/functions/_shared/ferry/polferries.ts';

const SAMPLE = `
<html><body>
<div class="navy-header">Gdańsk - Nynäshamn</div>
<div id="r1102026" class="tab-pane">
<table>
<tr><td>18:00 - 12:00*</td><td>–</td><td>WAW</td><td>XX</td></tr>
</table>
</div>
</body></html>
`;

describe('DP-82 Polferries — przeszłe nieznane kody bez ostrzeżenia', () => {
  it('przeszły „–” bez warn; przyszły nieznany kod → warn; WAW zapisany', () => {
    /* now = 02.10 → dzień 1 przeszły, 2 = dziś (WAW), 3 = przyszły (XX). */
    const now = new Date('2026-10-02T12:00:00Z');
    const out = parsePolferriesSchedule(SAMPLE, { now });
    expect(out.sailings.some((s) => s.vessel === 'M/F Wawel' && s.date === '2026-10-02')).toBe(true);
    expect(out.warnings.some((w) => /nieznany kod statku „–”/.test(w))).toBe(false);
    expect(out.warnings.some((w) => /2026-10-03.*nieznany kod statku „XX”/.test(w))).toBe(true);
  });

  it('przyszły „–” nadal ostrzega', () => {
    const now = new Date('2026-09-01T12:00:00Z');
    const out = parsePolferriesSchedule(SAMPLE, { now });
    expect(out.warnings.some((w) => /2026-10-01.*nieznany kod statku „–”/.test(w))).toBe(true);
  });
});
