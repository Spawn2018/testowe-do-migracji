import { describe, expect, it } from 'vitest';
import { plPlural } from '../src/lib/plPlural';
import { standardSkipMessage } from '../src/lib/standardSkipMessage';
import { tp } from '../src/i18n/messages';

const wiersz = (n: number) => plPlural(n, 'wiersz', 'wiersze', 'wierszy');

describe('PL-PLURAL', () => {
  it('odmiana na 1, 2, 5, 12, 22, 25', () => {
    expect(wiersz(1)).toBe('wiersz');
    expect(wiersz(2)).toBe('wiersze');
    expect(wiersz(5)).toBe('wierszy');
    expect(wiersz(12)).toBe('wierszy');
    expect(wiersz(22)).toBe('wiersze');
    expect(wiersz(25)).toBe('wierszy');
  });

  it('11 i 21 jak 5+, 14 jak 12, 24 jak 22, 0 jak 5+', () => {
    expect(wiersz(0)).toBe('wierszy');
    expect(wiersz(4)).toBe('wiersze');
    expect(wiersz(11)).toBe('wierszy');
    expect(wiersz(14)).toBe('wierszy');
    expect(wiersz(21)).toBe('wierszy');
    expect(wiersz(24)).toBe('wiersze');
  });

  it('import: 2 transporty i 2 wiersze, 1 i 5 bez zmiany sensu', () => {
    /* wyglad/W-naprawy-2 (F7): to samo zdanie co w podglądzie importu, bez wielkich liter */
    expect(standardSkipMessage(2, 2)).toBe('Zaimportowano 2 transporty. Pominięte: rozmiar „Standard” (ładunki innej firmy) — 2.');
    expect(standardSkipMessage(1, 1)).toBe('Zaimportowano 1 transport. Pominięte: rozmiar „Standard” (ładunki innej firmy) — 1.');
    expect(standardSkipMessage(5, 12)).toBe('Zaimportowano 5 transportów. Pominięte: rozmiar „Standard” (ładunki innej firmy) — 12.');
    expect(standardSkipMessage(22, 0)).toBe('Zaimportowano 22 transporty.');
  });

  it('tp po polsku odmienia; bez słownika EN (8A) — tekst i odmiana po polsku', () => {
    expect(tp('pl', 'a6_sch_export_ok', { rows: 22, bytes: 10 })).toBe('Eksport XLSX · 22 wiersze · 10 B');
    expect(tp('pl', 'a6_sch_export_ok', { rows: 12, bytes: 10 })).toBe('Eksport XLSX · 12 wierszy · 10 B');
    expect(tp('pl', 'a6_sch_export_ok', { rows: 1, bytes: 10 })).toBe('Eksport XLSX · 1 wiersz · 10 B');
    expect(tp('en', 'a6_sch_export_ok', { rows: 22, bytes: 10 })).toBe('Eksport XLSX · 22 wiersze · 10 B');
    expect(tp('pl', 'd26_allow', { n: 2 })).toBe('Anuluj 2 pozycje nieobecne w pliku');
    expect(tp('pl', 'd26_allow', { n: 5 })).toBe('Anuluj 5 pozycji nieobecnych w pliku');
    expect(tp('pl', 'rk_client_errors', { kinds: 1, hits: 22 }).replace(/\u00a0/g, ' ')).toBe(
      'Błędy w przeglądarce użytkowników: 1 rodzaj, 22 wystąpienia w 15 min',
    );
  });
});
