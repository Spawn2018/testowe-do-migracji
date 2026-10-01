import { describe, expect, it } from 'vitest';
import { isPlausibleNational, toE164, toNationalPhone } from '../src/lib/phoneNational';
import { normalizePhone } from '../src/lib/scheduleParse';

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

describe('toE164', () => {
  it('PL national → +48', () => {
    expect(toE164('601234567', 'PL')).toBe('+48601234567');
  });
  it('SE national with leading 0 → +46', () => {
    expect(toE164('0701234567', 'SE')).toBe('+46701234567');
  });
});

describe('normalizePhone (import)', () => {
  it('import +48 → krajowy', () => {
    expect(normalizePhone('+48 601 234 567')).toBe('601234567');
  });
  it('import plain stays', () => {
    expect(normalizePhone('601234567')).toBe('601234567');
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
