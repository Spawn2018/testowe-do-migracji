/**
 * W-eta-czas (20.10.2026, właściciel 17:13): czasy ETA w godzinach i minutach,
 * a powyżej 24 h — dni, godziny i minuty. Dotyczy pasma „± …” w bloku ETA
 * i podpowiedzi opóźnienia na mapie (wcześniej surowe minuty, np. „± 435 min”).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { etaDuration } from '../src/lib/etaDuration';
import { tp } from '../src/i18n/messages';

describe('W-eta-czas — format czasu ETA', () => {
  it('poniżej godziny: same minuty', () => {
    expect(etaDuration(45)).toBe('45 min');
  });
  it('poniżej doby: godziny i minuty (SG-17: 435 min → 7 h 15 min)', () => {
    expect(etaDuration(435)).toBe('7 h 15 min');
    expect(etaDuration(120)).toBe('2 h');
  });
  it('powyżej doby: dni, godziny i minuty', () => {
    expect(etaDuration(1565)).toBe('1 d 2 h 5 min');
    expect(etaDuration(1440 * 2 + 30)).toBe('2 d 30 min');
  });
  it('pasmo ± w bloku ETA używa formatu d/h/min', () => {
    expect(tp('pl', 'p4b_eta_band', { m: etaDuration(435), word: 'Niska' })).toBe('± 7 h 15 min · Niska');
    const src = readFileSync('src/components/drawer/EtaBlock.tsx', 'utf8');
    expect(src).toContain("tp(locale, 'p4b_eta_band', { m: etaDuration(load.etaConfMin), word })");
  });
  it('podpowiedź opóźnienia na mapie bez surowych minut', () => {
    const src = readFileSync('src/components/map/CorridorMap.tsx', 'utf8');
    expect(src).not.toContain('+${s.delayMin} min');
    expect(src).toContain('+${etaDuration(s.delayMin)}');
  });
});
