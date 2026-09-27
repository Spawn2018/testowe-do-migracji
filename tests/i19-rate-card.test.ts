import { describe, expect, it } from 'vitest';
import { buildRules, EMPTY_ROW, num } from '../src/lib/rateCard';

const row = (o: Partial<typeof EMPTY_ROW>) => ({ ...EMPTY_ROW, length_from: '0', length_to: '20', width_from: '0', width_to: '3', height_from: '0', height_to: '3', weight_from: '0', weight_to: '40', base_rate: '1', ...o });

describe('I-19 cennik — parsowanie formularza', () => {
  it('liczby z przecinkiem i spacjami', () => {
    expect(num('12,5')).toBe(12.5);
    expect(num(' 1 000 ')).toBe(1000);
    expect(num('')).toBeNull();
    expect(num('abc')).toBeNull();
  });
  it('przedziały + STANDARD → pozycje dla RPC', () => {
    const b = buildRules([row({ base_rate: '10,5', note: ' x ' })], '7');
    expect(b).toEqual({ rules: [
      { cargo_class: 'DIMENSIONED', note: 'x', length_from: 0, length_to: 20, width_from: 0, width_to: 3, height_from: 0, height_to: 3, weight_from: 0, weight_to: 40, base_rate: 10.5 },
      { cargo_class: 'STANDARD', base_rate: 7 },
    ] });
  });
  it('puste pole stawki lub przedziału = błąd wiersza (nie zero)', () => {
    expect(buildRules([row({}), row({ base_rate: '' })], '')).toEqual({ bad: 2 });
    expect(buildRules([row({ width_to: '' })], '')).toEqual({ bad: 1 });
    expect(buildRules([row({ weight_from: '-1' })], '')).toEqual({ bad: 1 });
  });
  it('STANDARD pusty = brak pozycji; niepoprawny = błąd 0', () => {
    expect(buildRules([], '')).toEqual({ rules: [] });
    expect(buildRules([], 'x')).toEqual({ bad: 0 });
  });
});
