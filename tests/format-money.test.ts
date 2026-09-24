/**
 * D10 — jedna funkcja formatująca kwoty (silnik).
 * Pełny money.test.ts pozostaje wykluczony do M1.
 */
import { describe, it, expect } from 'vitest';
import { formatMoney } from '../src/lib/money/engine';

describe('D10 formatMoney', () => {
  it('kod waluty + liczba według języka interfejsu', () => {
    expect(formatMoney(12345.6, 'pl', 'EUR')).toMatch(/^12\s345,60\sEUR$/);
    expect(formatMoney(12345.6, 'en', 'EUR')).toMatch(/^EUR\s12,345\.60$/);
    expect(formatMoney(12345.6, 'sv', 'EUR')).toMatch(/^12\s345,60\sEUR$/);
  });

  it('PLN według języka UI', () => {
    expect(formatMoney(422.74, 'pl', 'PLN')).toMatch(/^422,74\sPLN$/);
    expect(formatMoney(422.74, 'en', 'PLN')).toMatch(/^PLN\s422\.74$/);
  });

  it('domyślna waluta = EUR (CURRENCY silnika)', () => {
    expect(formatMoney(100, 'pl')).toMatch(/EUR$/);
  });
});
