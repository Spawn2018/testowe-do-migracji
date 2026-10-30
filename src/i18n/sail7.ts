/**
 * wyglad/P7-d — teksty Harmonogram › Rejsy (E30 pkt 7, makieta `makiety_html/E30/harm.html`, raport `img/e30-after`).
 * Po polsku (E43). Nagłówki kolumn i działania zostają z `etap4.ts` (`sail_col_*`, `sail_add`, `sail_delay`, `sail_cancel`).
 */
import type { Locale } from '../types';
import { t } from './messages';

const PL: Record<string, string> = {
  sv_sub: 'Polska → Szwecja oraz Estonia → Finlandia i Szwecja',
  sv_future: 'Przyszłe',
  sv_returns: 'Pokaż powroty',
  sv_src_POLFERRIES: 'Polferries',
  sv_src_STENA: 'Stena Line',
  sv_src_TALLINK: 'Tallink Silja',
  sv_src_VIKING: 'Viking Line',
  sv_src_ECKERO: 'Eckerö Line',
  sv_src_DFDS: 'DFDS',
  sv_src_RECZNIE: 'HHL ręcznie',
  sv_src_DANE_STARTOWE: 'dane startowe',
  sv_st_delayed: 'opóźniony',
  sv_st_cancelled: 'odwołany',
  sv_st_gone: 'wypłynął',
  sv_none: 'Brak rejsów w wybranym zakresie.',
  sv_none_future: 'Brak przyszłych rejsów wyjazdowych w rozkładzie.',
  /* BN9-b: filtr armatora */
  sv_line_filter: 'Armator',
  sv_line_all: 'Wszyscy armatorzy',
  /* DP-20, decyzja 55 */
  sv_line_empty: 'Brak rejsów tego armatora w rozkładzie — źródło niedostępne albo rozkład nie został jeszcze pobrany; rejs można dodać później.',
  /* DP-3, DP-5 */
  sv_route_unknown: 'nieznana trasa',
  sv_route_unknown_err: 'Nieznana trasa — wybierz trasę z listy',
  sv_reach: 'Rozkład w bazie: {list}.',
  sv_reach_item: '{line} do {date}',
  sv_reach_POLFERRIES: 'Polferries',
  sv_reach_STENA: 'Stena Line',
  sv_reach_TALLINK: 'Tallink Silja',
  sv_reach_VIKING: 'Viking Line',
  sv_reach_ECKERO: 'Eckerö Line',
  sv_reach_DFDS: 'DFDS',
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
