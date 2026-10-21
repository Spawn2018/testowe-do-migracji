/* Właściciel 21.10.2026 20:14: Rozliczenia › tydzień z opłatą paliwową — „Brak listy publikacji” mimo notowań w bazie. */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { publicationsFromReadings } from '../src/lib/fuelPublSource';

const r = (id: string, index_code: string, reading_date: string, value: number, entered_at: string, corrects_id: string | null = null) =>
  ({ id, index_code, reading_date, value, corrects_id, entered_at });

describe('publikacje cen paliwa z bazy', () => {
  it('SEK → OKQ8, PLN → Orlen; korekta zastępuje poprawiony wiersz; sortowanie po dniu', () => {
    const out = publicationsFromReadings([
      r('a', 'SEK', '2026-10-13', 22.8, '2026-10-13T10:00:00Z'),
      r('b', 'PLN', '2026-10-13', 7.0, '2026-10-13T10:00:00Z'),
      r('c', 'SEK', '2026-10-13', 22.9, '2026-10-14T10:00:00Z', 'a'),
      r('d', 'PLN', '2026-10-12', 6.9, '2026-10-12T10:00:00Z'),
    ]);
    expect(out).toEqual([
      { date: '2026-10-12', source: 'ORLEN', price: 6.9 },
      { date: '2026-10-13', source: 'OKQ8', price: 22.9 },
      { date: '2026-10-13', source: 'ORLEN', price: 7 },
    ]);
  });
  it('Finanse i panel cen wczytują publikacje z bazy', () => {
    for (const f of ['../src/views/FinanceView.tsx', '../src/components/drawer/PanelPrices.tsx']) {
      expect(readFileSync(new URL(f, import.meta.url), 'utf8')).toContain('useFuelPublications()');
    }
    expect(readFileSync(new URL('../src/lib/p5Source.ts', import.meta.url), 'utf8')).toContain('fuelPublicationsIn(r.idx.from');
  });
});
