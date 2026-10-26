/**
 * Polecenie właściciela 26.10.2026, 15:06 (#563): tabela mnożników „Cena ON — max próg” — wiersz „do X”.
 * Od tygodnia 44 wersja załącznika ma `tier_bound = 'MAX'`; wersje do t43 — `MIN` (D-20261020-1322-01) bez zmian.
 * Wynik kontrolny właściciela t44: SE 23,00 SEK/l → 1,14; PL 7,15 zł/l → 1,14.
 */
import { describe, expect, it } from 'vitest';
import { partyFuelView, tierBoundFor, tiersFromDb } from '../src/auth/liveFuel';
import { tierOf } from '../src/lib/p5bFuel';
import { lookupMult } from '../src/lib/sefs';

/** Tabele załącznika z polecenia właściciela 26.10.2026 15:06 (= `sefs_parameters` v3/v4 na produkcji, 51 + 51 progów). */
const parse = (x: string) => x.split(',').map((p) => { const [lte, mult] = p.split(':').map(Number); return { lte, mult }; });
const SEK = parse('17.4:0.92,17.7:0.93,18:0.94,18.3:0.95,18.6:0.97,18.9:0.98,19.2:0.99,19.5:1,19.8:1.01,20.1:1.02,20.4:1.04,20.7:1.05,21:1.06,21.3:1.07,21.6:1.08,21.9:1.09,22.2:1.11,22.5:1.12,22.8:1.13,23.1:1.14,23.4:1.15,23.7:1.16,24:1.18,24.3:1.19,24.6:1.2,24.9:1.21,25.2:1.22,25.5:1.23,25.8:1.25,26.1:1.26,26.4:1.27,26.7:1.28,27:1.29,27.3:1.3,27.6:1.32,27.9:1.33,28.2:1.34,28.5:1.35,28.8:1.36,29.1:1.37,29.4:1.39,29.7:1.4,30:1.41,30.3:1.42,30.6:1.43,30.9:1.44,31.2:1.46,31.5:1.47,31.8:1.48,32.1:1.49,32.4:1.5');
const PLN = parse('5:0.93,5.1:0.94,5.2:0.95,5.3:0.96,5.4:0.97,5.5:0.98,5.6:0.99,5.7:1,5.8:1.01,5.9:1.02,6:1.03,6.1:1.04,6.2:1.05,6.3:1.06,6.4:1.07,6.5:1.08,6.6:1.09,6.7:1.1,6.8:1.1,6.9:1.11,7:1.12,7.1:1.13,7.2:1.14,7.3:1.15,7.4:1.16,7.5:1.17,7.6:1.18,7.7:1.19,7.8:1.2,7.9:1.21,8:1.22,8.1:1.23,8.2:1.24,8.3:1.25,8.4:1.26,8.5:1.27,8.6:1.28,8.7:1.29,8.8:1.3,8.9:1.3,9:1.31,9.1:1.32,9.2:1.33,9.3:1.34,9.4:1.35,9.5:1.36,9.6:1.37,9.7:1.38,9.8:1.39,9.9:1.4,10:1.41');
const at = (tiers: ReturnType<typeof tiersFromDb>, v: number) => tiers[tierOf(tiers, v)].mult;

describe('tabela mnożników „do X” (tier_bound = MAX)', () => {
  const sek = tiersFromDb(SEK, 'MAX');
  const pln = tiersFromDb(PLN, 'MAX');

  it('tydzień 44 — wynik kontrolny właściciela', () => {
    expect(at(sek, 23.0)).toBe(1.14);
    expect(at(pln, 7.15)).toBe(1.14);
  });

  it('progi włącznie, następny grosz to następny wiersz', () => {
    expect(at(sek, 23.1)).toBe(1.14);
    expect(at(sek, 23.11)).toBe(1.15);
    expect(at(pln, 7.2)).toBe(1.14);
    expect(at(pln, 7.21)).toBe(1.15);
    expect(at(pln, 6.8)).toBe(1.1);
  });

  it('brzegi tabeli: poniżej pierwszego — pierwszy wiersz, powyżej ostatniego — ostatni', () => {
    expect(at(sek, 17.0)).toBe(0.92);
    expect(at(sek, 33.0)).toBe(1.5);
    expect(at(pln, 4.5)).toBe(0.93);
    expect(at(pln, 10.5)).toBe(1.41);
  });

  it('przedziały na ekranie: od progu poprzedniego + 0,01 do swojego progu', () => {
    expect(sek[0]).toEqual({ from: 0, to: 17.4, mult: 0.92 });
    expect(sek[1]).toEqual({ from: 17.41, to: 17.7, mult: 0.93 });
    expect(pln[22]).toEqual({ from: 7.11, to: 7.2, mult: 1.14 });
    expect(sek).toHaveLength(51);
    expect(pln).toHaveLength(51);
  });

  it('ekran i wspólny odczyt frontu (`lookupMult` MAX) dają ten sam mnożnik dla każdej średniej co 0,01', () => {
    for (let c = 1600; c <= 3300; c += 1) expect(at(sek, c / 100)).toBe(lookupMult(c / 100, SEK, 'MAX'));
    for (let c = 450; c <= 1050; c += 1) expect(at(pln, c / 100)).toBe(lookupMult(c / 100, PLN, 'MAX'));
  });
});

describe('wersje do tygodnia 43 bez zmian (tier_bound = MIN albo brak pola)', () => {
  it('brak pola = MIN — przedziały jak dotąd', () => {
    const t = [{ lte: 22.5, mult: 1.12 }, { lte: 22.2, mult: 1.11 }];
    expect(tiersFromDb(t)).toEqual([{ from: 22.2, to: 22.49, mult: 1.11 }, { from: 22.5, to: 22.79, mult: 1.12 }]);
    expect(tiersFromDb(t, null)).toEqual(tiersFromDb(t, 'MIN'));
  });

  it('MIN: 23,03 → 1,13 (odczyt „od”, jak policzone t43 i wcześniej)', () => {
    expect(at(tiersFromDb(SEK, 'MIN'), 23.03)).toBe(1.13);
    expect(lookupMult(23.03, SEK, 'MIN')).toBe(1.13);
    expect(lookupMult(23.03, SEK, 'MAX')).toBe(1.14);
  });
});

describe('sposób odczytu progu idzie za wersją tygodnia (F7 #576)', () => {
  const bounds = [{ version: 5, tier_bound: 'MAX' }, { version: 4, tier_bound: 'MIN' }, { version: 3, tier_bound: null }];
  it('wersja, z której baza policzyła tydzień, wygrywa z najnowszą', () => {
    expect(tierBoundFor(bounds, 4, 5)).toBe('MIN');
    expect(tierBoundFor(bounds, 5, 5)).toBe('MAX');
  });
  it('bez wersji tygodnia — najnowsza; brak kolumny / wiersza — MIN', () => {
    expect(tierBoundFor(bounds, null, 5)).toBe('MAX');
    expect(tierBoundFor(bounds, 3, 5)).toBe('MIN'); // wersja tygodnia bez pola = MIN, nie najnowsza
    expect(tierBoundFor(bounds, 9, 5)).toBe('MAX'); // brak wiersza wersji tygodnia → najnowsza
    expect(tierBoundFor([], 5, 5)).toBe('MIN');
    expect(tierBoundFor(null, null, null)).toBe('MIN');
  });
  it('widok KSH/SCX przekazuje sposób odczytu do tabeli', () => {
    const params = { version: 5, valid_from: '2026-10-26', agreed_with_carrier: true, tiers_sek: SEK, tiers_pln: PLN, tier_bound: 'MAX' as const };
    const v = partyFuelView({ today: '2026-10-26', side: 'rev', loads: [], params });
    expect(v.tiers.sek[0]).toEqual({ from: 0, to: 17.4, mult: 0.92 });
    const m = partyFuelView({ today: '2026-10-26', side: 'rev', loads: [], params: { ...params, tier_bound: 'MIN' } });
    expect(m.tiers.sek[0].from).toBe(17.4);
  });
});
