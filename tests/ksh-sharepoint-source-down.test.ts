import { describe, expect, it } from 'vitest';
import { KSH_SOURCE_DOWN_MIN, shouldRaiseKshSourceDown } from '../src/lib/kshSharePointSourceDown';

describe('A6 SOURCE_DOWN SharePoint (30 min)', () => {
  const now = '2026-10-25T14:00:00.000Z';

  it('brak odczytu i brak first_error_at → bez alarmu (pierwsza awaria)', () => {
    expect(shouldRaiseKshSourceDown(null, now)).toBe(false);
    expect(shouldRaiseKshSourceDown(undefined, now, KSH_SOURCE_DOWN_MIN, null)).toBe(false);
  });

  it(`brak odczytu, first_error_at < ${KSH_SOURCE_DOWN_MIN} min → bez alarmu`, () => {
    expect(shouldRaiseKshSourceDown(null, now, KSH_SOURCE_DOWN_MIN, '2026-10-25T13:45:00.000Z')).toBe(false);
  });

  it(`brak odczytu, first_error_at ≥ ${KSH_SOURCE_DOWN_MIN} min → alarm`, () => {
    expect(shouldRaiseKshSourceDown(null, now, KSH_SOURCE_DOWN_MIN, '2026-10-25T13:30:00.000Z')).toBe(true);
    expect(shouldRaiseKshSourceDown(null, now, KSH_SOURCE_DOWN_MIN, '2026-10-25T12:00:00.000Z')).toBe(true);
  });

  it(`świeży odczyt (< ${KSH_SOURCE_DOWN_MIN} min) → bez alarmu`, () => {
    expect(shouldRaiseKshSourceDown('2026-10-25T13:45:00.000Z', now)).toBe(false);
    expect(shouldRaiseKshSourceDown('2026-10-25T13:31:00.000Z', now)).toBe(false);
  });

  it(`odczyt ≥ ${KSH_SOURCE_DOWN_MIN} min → alarm`, () => {
    expect(shouldRaiseKshSourceDown('2026-10-25T13:30:00.000Z', now)).toBe(true);
    expect(shouldRaiseKshSourceDown('2026-10-25T12:00:00.000Z', now)).toBe(true);
  });

  it('nie-data lastReadAt → alarm', () => {
    expect(shouldRaiseKshSourceDown('nie-data', now)).toBe(true);
  });
});
