import { describe, expect, it } from 'vitest';
import { KSH_SOURCE_DOWN_MIN, shouldRaiseKshSourceDown } from '../src/lib/kshSharePointSourceDown';

describe('A6 SOURCE_DOWN SharePoint (30 min)', () => {
  const now = '2026-10-25T14:00:00.000Z';

  it('brak odczytu → alarm', () => {
    expect(shouldRaiseKshSourceDown(null, now)).toBe(true);
    expect(shouldRaiseKshSourceDown(undefined, now)).toBe(true);
    expect(shouldRaiseKshSourceDown('nie-data', now)).toBe(true);
  });

  it(`świeży odczyt (< ${KSH_SOURCE_DOWN_MIN} min) → bez alarmu`, () => {
    expect(shouldRaiseKshSourceDown('2026-10-25T13:45:00.000Z', now)).toBe(false);
    expect(shouldRaiseKshSourceDown('2026-10-25T13:31:00.000Z', now)).toBe(false);
  });

  it(`odczyt ≥ ${KSH_SOURCE_DOWN_MIN} min → alarm`, () => {
    expect(shouldRaiseKshSourceDown('2026-10-25T13:30:00.000Z', now)).toBe(true);
    expect(shouldRaiseKshSourceDown('2026-10-25T12:00:00.000Z', now)).toBe(true);
  });
});
