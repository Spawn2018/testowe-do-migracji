/**
 * wyglad/P5 — dopłaty w panelu „Ceny” (E33): postój i anulowanie według zasad z decyzji 12:23 i 12:35,
 * przykłady z „Testu” E33 (SG-03 Boden 3 h 44 min → 0 EUR; Śrem 8 h 10 min → 225,00 EUR; anulowanie 4 dni → 15 %).
 * Panel bez napisu o cudzej cenie; w produkcji bez podpowiedzi z bazy zostaje dzisiejszy formularz dopłat.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { cancelFee, cancelPct, daysBetween, durText, dwellFee } from '../src/lib/p5Fees';

describe('E33 — postój', () => {
  it('czas wolny 4 h na rozładunku: 3 h 44 min → 0 EUR', () => {
    expect(dwellFee(224, 'UNLOAD')).toEqual({ overMin: 0, hours: 0, days: 0, eur: 0 });
  });
  it('czas wolny 6 h na załadunku: 8 h 10 min → 3 rozpoczęte godziny × 75 = 225,00 EUR', () => {
    expect(dwellFee(490, 'LOAD')).toMatchObject({ overMin: 130, hours: 3, eur: 225 });
  });
  it('powyżej 24 h — 750 EUR za każdą rozpoczętą dobę', () => {
    expect(dwellFee(25 * 60, 'UNLOAD')).toMatchObject({ days: 2, eur: 1500 });
  });
  it('czas jako tekst', () => {
    expect([durText(224), durText(490), durText(45), durText(120)]).toEqual(['3 h 44 min', '8 h 10 min', '45 min', '2 h']);
  });
});

describe('E33 — anulowanie', () => {
  it('procent według dni do załadunku (2 dni = 25 %, decyzja 08.10 pkt 1)', () => {
    expect([7, 5, 4, 3, 2, 1, 0, -1].map((d) => cancelPct(d))).toEqual([0, 0, 15, 25, 25, 50, 100, 100]);
    expect(daysBetween('2026-10-04', '2026-10-08')).toBe(4);
  });
  it('ten sam procent od frachtu przewoźnika i KSH, bez opłaty paliwowej: 4 dni → 1 035,00 / 1 086,75', () => {
    expect(cancelFee(6900, 7245, 4)).toEqual({ pct: 15, cost: 1035, rev: 1086.75 });
  });
});

describe('E33 — panel „Ceny”', () => {
  const src = readFileSync(new URL('../src/components/drawer/PanelPrices.tsx', import.meta.url), 'utf8');
  it('bez „Inne”, „WSTĘPNE”, „OPL-8” i bez napisu o cudzej cenie', () => {
    const dict = readFileSync(new URL('../src/i18n/p5.ts', import.meta.url), 'utf8');
    const pr = dict.split('\n').filter((l) => /^\s+p5_(pr|fee)_/.test(l)).join('\n');
    expect(pr).not.toMatch(/WSTĘPNE|OPL-8|Inne|nie jest widoczna w Twojej roli/);
    expect(src).not.toMatch(/no_price/);
  });
  it('kolor marży według jednego progu z Opcji (E16), nie 18 %', () => {
    expect(src).toMatch(/marginThresholdOf\(\)/);
    expect(src).not.toMatch(/0\.18/);
  });
  it('w produkcji bez podpowiedzi z bazy zostaje dzisiejszy formularz dopłat', () => {
    expect(src).toMatch(/suggestions \? feeList : legacyFees/);
    const s = readFileSync(new URL('../src/lib/p5Source.ts', import.meta.url), 'utf8');
    expect(s).toMatch(/VITE_AUTH_MODE !== 'supabase' \? demoFeeSuggestions\(load\) : null/);
  });
});
