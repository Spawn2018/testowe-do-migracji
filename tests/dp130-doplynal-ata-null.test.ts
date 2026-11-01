/**
 * DP-130 — kontrakt triggera sailings_set_status_from_actual (0364).
 * Etap: BN4 / sailings; źródło F7 #703 r2 DP-130.
 * Źródło prawdy = SQL; ta tablica decyzji pilnuje regresji reguły.
 */
import { describe, expect, it } from 'vitest';

/** Lustrzane odbicie reguły 0364 (bez ODWOLANY → bez zmian). */
function nextStatusFromActual(input: {
  status: string;
  actualDepartureAt: string | null;
  actualArrivalAt: string | null;
}): string {
  if (input.status === 'ODWOLANY') return input.status;
  if (input.actualArrivalAt != null) return 'DOPLYNAL';
  if (input.status === 'DOPLYNAL') return 'DOPLYNAL';
  if (input.actualDepartureAt != null) return 'W_REJSIE';
  return input.status;
}

describe('DP-130 sailings status from actual_*', () => {
  it('jawny DOPLYNAL przy ATA null zostaje (closeStale)', () => {
    expect(nextStatusFromActual({
      status: 'DOPLYNAL',
      actualDepartureAt: '2026-11-01T08:00:00.000Z',
      actualArrivalAt: null,
    })).toBe('DOPLYNAL');
  });

  it('ATD bez jawnego DOPLYNAL → W_REJSIE', () => {
    expect(nextStatusFromActual({
      status: 'ZAPLANOWANY',
      actualDepartureAt: '2026-11-01T08:00:00.000Z',
      actualArrivalAt: null,
    })).toBe('W_REJSIE');
  });

  it('ATA → DOPLYNAL', () => {
    expect(nextStatusFromActual({
      status: 'W_REJSIE',
      actualDepartureAt: '2026-11-01T08:00:00.000Z',
      actualArrivalAt: '2026-11-01T12:00:00.000Z',
    })).toBe('DOPLYNAL');
  });

  it('ODWOLANY bez zmian mimo ATD', () => {
    expect(nextStatusFromActual({
      status: 'ODWOLANY',
      actualDepartureAt: '2026-11-01T08:00:00.000Z',
      actualArrivalAt: null,
    })).toBe('ODWOLANY');
  });
});
