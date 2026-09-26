/** A6-T3 — liczby i procenty wg języka; PL bez zmian względem baseline. */
import { describe, expect, it } from 'vitest';
import { fmtPct, pctText, fmtNumKeepPl } from '../src/i18n/messages';

const nb = (s: string) => s.replace(/[\u00a0\u202f]/g, ' ');

describe('A6-T3 formaty liczb', () => {
  it('procent: EN 15.7%, PL 15,7%, SV 15,7 %', () => {
    expect(nb(fmtPct('en', 0.157))).toBe('15.7%');
    expect(nb(fmtPct('pl', 0.157))).toBe('15,7%');
    expect(nb(fmtPct('sv', 0.157))).toBe('15,7 %');
  });
  it('pctText: PL zachowuje dotychczasowy tekst, EN/SV z Intl', () => {
    expect(pctText('pl', 0.157, 1, '15.7%')).toBe('15.7%');
    expect(pctText('pl', 0.157)).toBe('15,7%');
    expect(nb(pctText('en', 0.157))).toBe('15.7%');
    expect(nb(pctText('sv', 0.157))).toBe('15,7 %');
  });
  it('liczby: separator dziesiętny wg języka', () => {
    expect(fmtNumKeepPl('en', 2.6, 1, '2.6')).toBe('2.6');
    expect(fmtNumKeepPl('sv', 2.6, 1, '2.6')).toBe('2,6');
    expect(fmtNumKeepPl('pl', 2.6, 1, '2.6')).toBe('2.6');
  });
});
