import { describe, expect, it } from 'vitest';
import { formatDelayPill } from '../src/components/ui/StatusPill';
import { etaDuration } from '../src/lib/etaDuration';

/* D-071 (zeszyt 8.8, 02.10; audyt 17.10 §3.1 pkt 3): „X d Y h Z min” powyżej 24 h, „Y h Z min” poniżej */
describe('formatDelayPill — D-071', () => {
  it('poniżej 24 h → godziny i minuty', () => {
    expect(formatDelayPill(95)).toBe('+1 h 35 min');
    expect(formatDelayPill(120)).toBe('+2 h');
    expect(formatDelayPill(35)).toBe('+35 min');
  });
  it('powyżej 24 h → dni, godziny i minuty', () => {
    expect(formatDelayPill(42 * 60)).toBe('+1 d 18 h');
    expect(formatDelayPill(28 * 60 + 27)).toBe('+1 d 4 h 27 min');
    expect(formatDelayPill(-50)).toBe('-50 min');
  });
});

describe('etaDuration', () => {
  it('zera pomijane, zawsze z jednostką', () => {
    expect(etaDuration(0)).toBe('0 min');
    expect(etaDuration(1440)).toBe('1 d');
    expect(etaDuration(1450)).toBe('1 d 10 min');
    expect(etaDuration(1200)).toBe('20 h');
    expect(etaDuration(500)).toBe('8 h 20 min');
  });
});
