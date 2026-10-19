/**
 * wyglad/W-b9-pl — B9 pkt 4 (D-20261019-1515-01): szwedzki tekst wolny nie trafia do treści głównej panelu
 * „Drogi w Szwecji”. Zanim serwer przetłumaczy (DeepL, pamięć tłumaczeń) — „Tłumaczenie w toku”, oryginał tylko pod
 * „Pokaż oryginał”. Dane zmyślone.
 */
import { describe, expect, it } from 'vitest';
import { guardSwedish, TRANSLATION_PENDING } from '../src/lib/corridorConditionsDb';

describe('B9 — „Tłumaczenie w toku” zamiast szwedzkiego', () => {
  it('opis równy oryginałowi (nieprzetłumaczony) → „Tłumaczenie w toku”, oryginał zostaje', () => {
    const sv = 'Vägarbete mellan Luleå och Boden, ett körfält avstängt';
    expect(guardSwedish(sv, sv)).toEqual({ note: TRANSLATION_PENDING, original: sv });
  });
  it('szwedzki opis bez oryginału → przeniesiony pod „Pokaż oryginał”', () => {
    expect(guardSwedish('Olycka på E4 norr om Piteå', null)).toEqual({ note: TRANSLATION_PENDING, original: 'Olycka på E4 norr om Piteå' });
  });
  it('polskie tłumaczenie zostaje bez zmian', () => {
    const r = guardSwedish('Roboty drogowe między Luleå a Boden, jeden pas zamknięty', 'Vägarbete mellan Luleå och Boden');
    /* nazwy miejscowości z „å” nie mogą zamienić polskiego opisu w „w toku” */
    expect(r.note).not.toBe(TRANSLATION_PENDING);
  });
  it('brak opisu — bez zmian', () => {
    expect(guardSwedish(null, 'Vägarbete')).toEqual({ note: null, original: 'Vägarbete' });
  });
});
