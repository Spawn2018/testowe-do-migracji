/**
 * wyglad/J4 — „Ocena przewoźników” w Kokpicie (E9, E11/E12, D-20261014-1420-01 R7 pkt 2). Po polsku (E43).
 * Nazwy kolumn i zdanie „Na czas = …” jak w karcie III-9 / D-23 (klucze `iii9_*`, `d23_*` w i2.ts).
 */
import type { Locale } from '../types';
import { t } from './messages';

const PL: Record<string, string> = {
  j4_h_hhl: 'Ocena przewoźników',
  j4_h_scx: 'Twoja ocena i punktualność',
  j4_sub: 'transporty rozładowane',
  j4_range_4w: '4 tygodnie',
  j4_range_all: 'Całość',
  j4_range_custom: 'Własny okres',
  j4_from: 'Rozładunek od',
  j4_to: 'Rozładunek do',
  j4_range_label: 'Okres',
  j4_empty: 'Brak rozładowanych transportów w wybranym okresie.',
  j4_c_carrier: 'Przewoźnik',
  j4_c_delivered: 'Rozładowane',
  j4_c_on_time: 'Na czas',
  j4_c_late: 'Opóźnienia z winy przewoźnika',
  j4_c_avg_late: 'Śr. spóźnienie',
  j4_c_score: 'Ocena HHL',
  j4_score_val: '{v} / 5 ({n})',
  j4_mine_h: 'Ostatnie oceny transportów',
  j4_mine_more: 'Pokaż wszystkie ({n})',
  j4_mine_less: 'Pokaż mniej',
  j4_c_load: 'Transport',
  j4_c_rated: 'Data oceny',
  j4_c_rating: 'Ocena',
  j4_note_hhl: 'Na czas = rozładunek do końca okna dostawy, a bez okna do końca dnia dostawy. Ocenę 1–5 wystawiasz w panelu transportu po rozładunku. Przewoźnik widzi swoją ocenę i punktualność; notatka HHL jest wewnętrzna.',
  j4_note_scx: 'Na czas = rozładunek do końca okna dostawy, a bez okna do końca dnia dostawy. Ocenę 1–5 wystawia HHL po rozładunku.',
};

export function j4(locale: Locale, key: string): string {
  return PL[key] ?? t(locale, key);
}

export function j4p(locale: Locale, key: string, params: Record<string, string | number>): string {
  let s = j4(locale, key);
  for (const [k, v] of Object.entries(params)) s = s.split(`{${k}}`).join(String(v));
  return s;
}
