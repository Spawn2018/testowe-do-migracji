import { describe, expect, it } from 'vitest';
import { isPlausibleNational, toNationalPhone } from '../src/lib/phoneNational';

describe('toNationalPhone', () => {
  it('strips +48', () => {
    expect(toNationalPhone('+48 601 234 567')).toEqual({ national: '601234567', country: 'PL' });
  });
  it('strips 0048', () => {
    expect(toNationalPhone('0048601234567')).toEqual({ national: '601234567', country: 'PL' });
  });
  it('keeps SE leading 0 after +46', () => {
    expect(toNationalPhone('0046701234567')).toEqual({ national: '0701234567', country: 'SE' });
  });
  it('plain national stays', () => {
    expect(toNationalPhone('601234567')).toEqual({ national: '601234567', country: 'PL' });
  });
});

describe('isPlausibleNational', () => {
  it('accepts PL mobile', () => {
    expect(isPlausibleNational('601234567')).toBe(true);
  });
  it('rejects empty', () => {
    expect(isPlausibleNational('')).toBe(false);
  });
});
