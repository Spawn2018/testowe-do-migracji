/**
 * Właściciel 20.10.2026, 11:35: „Wgraj plik KSH (zapas)” nie przenosił godzin z kolumn „Godzina (załadunek)”
 * i „Godzina (rozładunek)”. ExcelJS podaje komórkę w formacie czasu jako datę (1899-12-30 08:00 UTC) —
 * `parseTime` brał z niej tekst daty i zwracał null. Dane zmyślone (G-17).
 */
import { describe, expect, it } from 'vitest';
import { parseTime } from '../src/lib/scheduleParse';
import { COLUMN_MAP_DEFAULT } from '../src/lib/importColumnMap';

describe('import KSH — godziny', () => {
  it('komórka w formacie czasu (Date z ExcelJS)', () => {
    expect(parseTime(new Date(Date.UTC(1899, 11, 30, 8, 0, 0)))).toBe('08:00');
    expect(parseTime(new Date(Date.UTC(1899, 11, 30, 16, 30, 0)))).toBe('16:30');
    /* zaokrąglenie Excela: 07:59:59,9 → 08:00 */
    expect(parseTime(new Date(Date.UTC(1899, 11, 30, 7, 59, 59, 900)))).toBe('08:00');
    /* data z godziną */
    expect(parseTime(new Date(Date.UTC(2026, 9, 21, 6, 15, 0)))).toBe('06:15');
  });
  it('ułamek doby i liczba seryjna z godziną', () => {
    expect(parseTime(1 / 3)).toBe('08:00');
    expect(parseTime(46316 + 0.75)).toBe('18:00');
  });
  it('tekst bez zmian', () => {
    expect(parseTime('8:00')).toBe('08:00');
    expect(parseTime('08.30')).toBe('08:30');
    expect(parseTime('07:00 - 15:00')).toBe('07:00');
    expect(parseTime('')).toBeNull();
    expect(parseTime(null)).toBeNull();
    expect(parseTime(8.3)).toBeNull();
  });
  it('nazwy kolumn jak w pliku KSH', () => {
    expect(COLUMN_MAP_DEFAULT.loadTime).toBe('Godzina (załadunek)');
    expect(COLUMN_MAP_DEFAULT.deliveryTime).toBe('Godzina (rozładunek)');
  });
});
