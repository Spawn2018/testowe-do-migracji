/**
 * wyglad/P7-d — teksty Harmonogram › Rejsy (E30 pkt 7, makieta `makiety_html/E30/harm.html`, raport `img/e30-after`).
 * Po polsku (E43). Nagłówki kolumn i działania zostają z `etap4.ts` (`sail_col_*`, `sail_add`, `sail_delay`, `sail_cancel`).
 */
import type { Locale } from '../types';
import { t } from './messages';

const PL: Record<string, string> = {
  sv_sub: 'Gdańsk → Nynäshamn i Gdynia → Karlskrona',
  sv_future: 'Przyszłe',
  sv_returns: 'Pokaż powroty',
  sv_src_POLFERRIES: 'Polferries',
  sv_src_STENA: 'Stena Line',
  sv_src_RECZNIE: 'HHL ręcznie',
  sv_src_DANE_STARTOWE: 'dane startowe',
  sv_st_delayed: 'opóźniony',
  sv_st_cancelled: 'odwołany',
  sv_st_gone: 'wypłynął',
  sv_none: 'Brak rejsów w wybranym zakresie.',
  sv_none_future: 'Brak przyszłych rejsów do Szwecji w rozkładzie.',
  sv_reach: 'Rozkład w bazie: {list}.',
  sv_reach_item: '{line} do {date}',
  sv_reach_POLFERRIES: 'Polferries',
  sv_reach_STENA: 'Stena Line',
  sv_loads_title: 'Pokaż te transporty w Harmonogramie',
  sv_note_admin: 'Automat „Prom” bierze godzinę po opóźnieniu, jeśli jest wpisana. Odwołanie rejsu daje ryzyko przy każdym przypisanym transporcie.',
  sv_note_ro: 'Rejsy zmienia tylko Administrator HHL.',
  sv_arr: 'przypłynięcie {t}',
  sv_loads_l: 'Transporty:',
  sv_filter: 'Rejs: {vessel} · {t}',
  sv_filter_clear: 'Pokaż wszystkie transporty',
};

export function sv(locale: Locale, key: string): string {
  return PL[key] ?? t(locale, key);
}

export function svp(locale: Locale, key: string, params: Record<string, string | number>): string {
  let s = sv(locale, key);
  for (const [k, v] of Object.entries(params)) s = s.split(`{${k}}`).join(String(v));
  return s;
}
