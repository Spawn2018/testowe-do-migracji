/**
 * wyglad/W-b9-pl — B9 pkt 4 (D-20261019-1515-01): szwedzki tekst wolny nie trafia do treści głównej panelu
 * „Drogi w Szwecji”. Serwer (`describeDeviation`, `polishRoadFreeText`) zostawia `note = null` i szwedzki w `original`,
 * dopóki DeepL / pamięć nie przetłumaczą — panel pokazuje wtedy „Tłumaczenie w toku”, oryginał tylko pod
 * „Pokaż oryginał”, bez „przetłumaczone ze szwedzkiego”. Dane zmyślone.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { guardSwedish } from '../src/lib/corridorConditionsDb';
import { roadRowsFromCorridor } from '../src/lib/p6Route';
import { rt } from '../src/i18n/p6';

const SV = 'Vägarbete mellan Luleå och Boden, ett körfält avstängt';

describe('B9 — „Tłumaczenie w toku” zamiast szwedzkiego', () => {
  it('serwer bez tłumaczenia (note = null, oryginał po szwedzku) → w toku (F7 #344 B1)', () => {
    expect(guardSwedish(null, SV)).toEqual({ note: null, original: SV, pending: true });
  });
  it('opis równy oryginałowi → w toku', () => {
    expect(guardSwedish(SV, SV)).toEqual({ note: null, original: SV, pending: true });
  });
  it('polskie tłumaczenie zostaje — także z nazwami własnymi („Norrbottens län”, „Umeå Norr”) (F7 #344 P2)', () => {
    for (const pl of ['Roboty drogowe na E4 w Norrbottens län', 'Wypadek w węźle Umeå Norr', 'Korek w dzielnicy Söder']) {
      expect(guardSwedish(pl, SV)).toEqual({ note: pl, original: SV, pending: false });
    }
  });
  it('bez oryginału — bez zmian', () => {
    expect(guardSwedish(null, null)).toEqual({ note: null, original: null, pending: false });
    expect(guardSwedish('Roboty drogowe', null).pending).toBe(false);
  });
  it('wiersz drogi niesie stan „w toku”; tekst ze słownika panelu', () => {
    const [row] = roadRowsFromCorridor([{ id: 's1', severity: 'HIGH', title: 'Roboty drogowe', road: 'E4', ...guardSwedish(null, SV) }]);
    expect(row.pending).toBe(true);
    expect(row.note).toBeNull();
    expect(row.original).toBe(SV);
    expect(rt('pl', 'p6_road_pending')).toBe('Tłumaczenie w toku');
  });
  it('RoutePanel: „przetłumaczone” tylko przy gotowym tłumaczeniu, „w toku” z oznaczeniem data-road-note', () => {
    const src = readFileSync('src/components/risks/RoutePanel.tsx', 'utf8');
    expect(src).toContain("r.original && !r.pending ? ` · ${rt(locale, 'p6_road_translated')}`");
    expect(src).toContain('data-road-note="pending">{rt(locale, \'p6_road_pending\')}');
  });
});
