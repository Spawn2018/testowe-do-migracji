/**
 * E21 (P2) — daty „01.10.2026, 12:00” (rok zawsze — właściciel 16.10.2026), liczby, „4,8%”, odmiana „1 pojazd”.
 */
import { describe, expect, it } from 'vitest';
import { formatListDateTime, formatPercentPoints, formatPlMoney, formatPlNumber, formatDistance, vehiclesInMotion } from '../src/lib/format';

describe('E21 formaty', () => {
  it('data listy bez sekund, zawsze z rokiem (właściciel 16.10.2026)', () => {
    expect(formatListDateTime('2026-10-01T10:00:00Z', 'Europe/Warsaw')).toBe('01.10.2026, 12:00');
    expect(formatListDateTime('2025-10-01T10:00:00Z', 'Europe/Warsaw')).toBe('01.10.2025, 12:00');
    expect(formatListDateTime('2026-10-01', 'Europe/Warsaw')).toBe('01.10.2026');
  });

  it('liczba, procent, kwota, odległość, odmiana', () => {
    expect(formatPlNumber(1726.59, 2)).toBe('1\u00a0726,59');
    expect(formatPlNumber(8239.15, 2)).toBe('8\u00a0239,15');
    expect(formatPercentPoints(4.8)).toBe('4,8%');
    expect(formatPlMoney(1726.59, 'PLN')).toBe('1\u00a0726,59\u00a0PLN');
    expect(formatDistance(800)).toBe('800 m');
    expect(formatDistance(2300)).toBe('2,3 km');
    expect(vehiclesInMotion(1)).toBe('1 pojazd w ruchu');
    expect(vehiclesInMotion(2)).toBe('2 pojazdy w ruchu');
    expect(vehiclesInMotion(5)).toBe('5 pojazdów w ruchu');
  });
});
