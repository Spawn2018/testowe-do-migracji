/**
 * wyglad/P9-e — teksty grupowania znaczników: auta na promie (E45 pkt 5, makieta `makiety_html/E45/mapa.html`,
 * `a-ferry.webp`, `a-ferry-m.png`) i auta w jednej strefie (D-20261009-1309-01 R5). Interfejs po polsku (E43).
 */
import type { Locale } from '../types';
import { t } from './messages';

const PL: Record<string, string> = {
  p9e_cars_one: '{n} auto',
  p9e_cars_few: '{n} auta',
  p9e_cars_many: '{n} aut',
  p9e_ferry_title: 'Prom {vessel} · {cars}',
  p9e_ferry_title_bare: 'Na promie · {cars}',
  p9e_ferry_dep_past: '{a} → {b} · wypłynął {t}',
  p9e_ferry_dep_next: '{a} → {b} · odpływa {t}',
  p9e_ferry_route: '{a} → {b}',
  p9e_ais_ok: 'pozycja statku z AIS · {t}',
  p9e_ais_stale: 'ostatni odczyt AIS {t}',
  p9e_ais_none: 'brak AIS · ostatnia pozycja auta {t}',
  p9e_ais_none_bare: 'brak AIS',
  p9e_zone_title: '{zone} · {cars}',
  p9e_zone_LOADING: 'miejsce załadunku',
  p9e_zone_PORT_OUT: 'port PL',
  p9e_zone_PORT_IN: 'port SE',
  p9e_zone_SITE: 'plac',
  p9e_tip_click: 'kliknij: lista transportów',
  p9e_more: '+{n}',
  p9e_list: 'Lista transportów',
  p9e_list_close: 'Zamknij listę',
  p9e_lg_zone: 'kilka aut w jednej strefie',
  p9e_lg_zone_short: 'kilka aut w strefie',
  /* wyglad/P9-f — Przegląd w panelu (E32 pkt 3, E27) */
  p9f_nopos: 'Brak pozycji',
  p9f_track_from: 'Śledzenie od {t}',
  p9f_track_from_day: 'Śledzenie od 03:00 w dniu załadunku',
  p9f_track_done: 'Śledzenie zakończone — „Dostarczone”',
  p9f_why_link: 'Brak linku śledzenia — SCX',
  p9f_site_since: 'Na placu od {t}',
  p9f_site_last: 'ostatnia pozycja {t} · postój',
  p9f_site_zone: 'strefa „{z}”',
};

export function p9e(locale: Locale, key: string): string {
  return PL[key] ?? t(locale, key);
}

export function p9ep(locale: Locale, key: string, params: Record<string, string | number>): string {
  let s = p9e(locale, key);
  for (const [k, v] of Object.entries(params)) s = s.split(`{${k}}`).join(String(v));
  return s;
}
