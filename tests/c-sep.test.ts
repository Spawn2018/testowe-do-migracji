import { describe, expect, it } from 'vitest';
import { formatSharePointPair, formatTowerPair } from '../src/lib/cSep';

describe('C-SEP formatTowerPair', () => {
  it('brak wartości → –', () => {
    expect(formatTowerPair(null, null, false)).toBe('–');
    expect(formatTowerPair('', '  ', true)).toBe('–');
  });
  it('dwie wartości bez przepięcia → A / B', () => {
    expect(formatTowerPair('Jan Kowalski', 'Piotr Nowak', false)).toBe('Jan Kowalski / Piotr Nowak');
  });
  it('przepięcie → A|B bez spacji', () => {
    expect(formatTowerPair('Jan Kowalski', 'Piotr Nowak', true)).toBe('Jan Kowalski|Piotr Nowak');
  });
  it('druga pusta bez przepięcia → A / ...', () => {
    expect(formatTowerPair('Jan Kowalski', null, false)).toBe('Jan Kowalski / ...');
  });
  it('przepięcie, druga pusta → A|...', () => {
    expect(formatTowerPair('Jan Kowalski', null, true)).toBe('Jan Kowalski|...');
  });
});

describe('C-SEP formatSharePointPair', () => {
  it('zawsze ukośnik, nigdy pipe', () => {
    expect(formatSharePointPair('Jan Kowalski', 'Piotr Nowak')).toBe('Jan Kowalski / Piotr Nowak');
    expect(formatSharePointPair('Jan Kowalski', null)).toBe('Jan Kowalski / ...');
    expect(formatSharePointPair(null, null)).toBe('–');
  });
});
