/**
 * DP-151 — fetchMarineConditions / select musi zawierać detail (status, warnings, ice).
 */
import { describe, expect, it } from 'vitest';
import { MARINE_CONDITIONS_SELECT } from '../src/lib/marineWeatherDb';

describe('marineWeatherDb — DP-151', () => {
  it('MARINE_CONDITIONS_SELECT zawiera detail', () => {
    expect(MARINE_CONDITIONS_SELECT.split(',')).toContain('detail');
    expect(MARINE_CONDITIONS_SELECT).toMatch(/corridor/);
    expect(MARINE_CONDITIONS_SELECT).toMatch(/observed_at/);
  });
});
