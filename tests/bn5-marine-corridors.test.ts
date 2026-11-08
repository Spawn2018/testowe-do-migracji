/**
 * BN5 (#714) — mapowanie korytarzy / punktów; trasa nieznana → null (bez GDN-NYN).
 */
import { describe, expect, it } from 'vitest';
import {
  MARINE_CORRIDORS,
  MARINE_POINTS,
  marineCorridorForFamily,
  marineCorridorForRoute,
  marinePointsForCorridor,
  marinePointsForRoute,
  marineRouteFamily,
} from '../supabase/functions/_shared/ferry/marineWeather';

describe('BN5 marineCorridorForRoute / marinePointsForRoute', () => {
  it('PL–SE bez zmian', () => {
    expect(marineCorridorForRoute('GDN-NYN')).toBe('BALTIC_GDN_NYN');
    expect(marineCorridorForRoute('NYN-GDN')).toBe('BALTIC_GDN_NYN');
    expect(marineCorridorForRoute('GDY-KAA')).toBe('BALTIC_GDY_KAA');
    expect(marineCorridorForRoute('KAA-GDY')).toBe('BALTIC_GDY_KAA');
    expect(marinePointsForRoute('GDN-NYN')).toEqual(['GDN', 'MID', 'NYN', 'SMHI_KNOLLS']);
    expect(marinePointsForRoute('GDY-KAA')).toEqual(['GDY', 'MID_STENA', 'KAA']);
  });

  it('rodziny bałtyckie → 3 nowe korytarze', () => {
    for (const r of ['TLL-HEL', 'TLLA-HEL', 'HEL-TLL', 'HELA-TLL', 'MUU-VUO', 'VUO-MUU']) {
      expect(marineCorridorForRoute(r)).toBe('BALTIC_GULF_FI');
    }
    expect(marinePointsForRoute('TLL-HEL')).toEqual(['GULF_MID']);
    expect(marinePointsForRoute('MUU-VUO')).toEqual(['GULF_MID']);

    expect(marineCorridorForRoute('PLD-KPS')).toBe('BALTIC_PLD_KPS');
    expect(marineCorridorForRoute('KPS-PLD')).toBe('BALTIC_PLD_KPS');
    expect(marinePointsForRoute('PLD-KPS')).toEqual(['NB_EAST', 'ALAND_S']);

    expect(marineCorridorForRoute('TLL-STO')).toBe('BALTIC_TLL_STO');
    expect(marineCorridorForRoute('STO-TLL')).toBe('BALTIC_TLL_STO');
    expect(marinePointsForRoute('TLL-STO')).toEqual(['GULF_W', 'GULF_MID', 'ALAND_SEA']);
  });

  it('trasa nieznana / pusta → null (regresja DP-116 / #714)', () => {
    expect(marineCorridorForRoute(null)).toBeNull();
    expect(marineCorridorForRoute('')).toBeNull();
    expect(marineCorridorForRoute('HEL-STO')).toBeNull();
    expect(marineCorridorForRoute('OTHER')).toBeNull();
    expect(marinePointsForRoute(null)).toBeNull();
    expect(marinePointsForRoute('HEL-STO')).toBeNull();
    expect(marineRouteFamily('POLFERRIES')).toBeNull();
  });

  it('5 korytarzy i punkty otwartej wody w słowniku', () => {
    expect([...MARINE_CORRIDORS]).toEqual([
      'BALTIC_GDN_NYN',
      'BALTIC_GDY_KAA',
      'BALTIC_GULF_FI',
      'BALTIC_PLD_KPS',
      'BALTIC_TLL_STO',
    ]);
    expect(MARINE_POINTS.GULF_MID).toEqual({ lat: 59.80, lon: 24.85, label: expect.any(String) });
    expect(MARINE_POINTS.NB_EAST.lat).toBeCloseTo(59.55, 2);
    expect(MARINE_POINTS.ALAND_SEA.lon).toBeCloseTo(19.40, 2);
    /* DP-153: GDN/NYN na otwartej wodzie (nie przybrzeżne NaN). */
    expect(MARINE_POINTS.GDN.lat).toBeCloseTo(54.65, 2);
    expect(MARINE_POINTS.GDN.lon).toBeCloseTo(18.80, 2);
    expect(MARINE_POINTS.NYN.lat).toBeCloseTo(58.75, 2);
    expect(MARINE_POINTS.NYN.lon).toBeCloseTo(18.20, 2);
    for (const c of MARINE_CORRIDORS) {
      expect(marinePointsForCorridor(c).length).toBeGreaterThan(0);
    }
  });

  it('DP-145: family_key ze słownika wygrywa z zapasem w kodzie', () => {
    expect(marineCorridorForRoute('HEL-STO')).toBeNull();
    expect(marineCorridorForRoute('HEL-STO', { 'HEL-STO': 'TLL-STO' })).toBe('BALTIC_TLL_STO');
    expect(marineRouteFamily('X-NEW', { 'X-NEW': 'PLD-KPS' })).toBe('PLD-KPS');
    expect(marineCorridorForFamily('PLD-KPS')).toBe('BALTIC_PLD_KPS');
    expect(marinePointsForRoute('X-NEW', new Map([['X-NEW', 'MUU-VUO']]))).toEqual(['GULF_MID']);
    /* Znana trasa: słownik może nadpisać rodzinę (np. alias w bazie). */
    expect(marineCorridorForRoute('GDN-NYN', { 'GDN-NYN': 'GDY-KAA' })).toBe('BALTIC_GDY_KAA');
  });
});
