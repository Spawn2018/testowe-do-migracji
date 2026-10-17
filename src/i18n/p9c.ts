/**
 * wyglad/P9-c — teksty strony Mapa według E29 (zdecydowane 08.10 12:14, pyt. 1 A; L20, L22) i E45 pkt 2
 * (makieta `raport/img/e29-after`, `makiety_html/E29/map.html`). Interfejs po polsku (E43).
 */
import type { Locale } from '../types';
import { t } from './messages';
import { serverRuleOn } from '../lib/serverRules';

const PL: Record<string, string> = {
  /* nagłówek (pkt 2, L20 — bez deklaracji częstotliwości) */
  p9c_head: 'W oknie śledzenia {n} · z pozycją {m} · bez pozycji {k}',
  p9c_head_hint: ' — od 03:00 w dniu załadunku do „Dostarczone”',
  p9c_head_short: 'w oknie {n} · bez pozycji {k}',
  /* warstwy (pkt 3, E45 pkt 2) */
  p9c_l_vehicles: 'Pojazdy i statki',
  p9c_l_route: 'Trasa (droga i prom)',
  p9c_l_zones: 'Strefy',
  p9c_l_road: 'Utrudnienia drogowe',
  p9c_l_trail: 'Przebieg wybranego',
  p9c_l_trail_long: 'Przebieg wybranego transportu',
  p9c_layers: 'Warstwy',
  p9c_layers_close: 'Zamknij warstwy',
  /* legenda (pkt 4) */
  p9c_lg_load: 'załadunek',
  p9c_lg_road: 'w drodze (PL, port, prom, SE)',
  p9c_lg_road_short: 'w drodze',
  p9c_lg_site: 'na placu',
  p9c_lg_late: 'opóźniony',
  p9c_lg_nogps: 'brak GPS',
  p9c_lg_ship: 'statek (AIS) z liczbą aut',
  p9c_lg_ship_short: 'statek z liczbą aut',
  /* filtry (pkt 5, L22) */
  p9c_f_window: 'W oknie · {n}',
  p9c_f_stage: '{stage} · {n}',
  p9c_f_late: 'Opóźnione · {n}',
  p9c_f_nogps: 'Brak GPS · {n}',
  p9c_f_nopos: 'Bez pozycji · {n}',
  p9c_search: 'Szukaj: kod, nr zlecenia, tablice',
  /* KSH widzi tylko kod, bez numerów zleceń (E41, 08.10) */
  p9c_search_ksh: 'Szukaj: kod, tablice',
  /* tabela (pkt 6) */
  p9c_c_transport: 'Transport',
  p9c_c_stage: 'Etap',
  p9c_c_pos: 'Pozycja',
  p9c_c_eta: 'ETA Boden',
  p9c_stage_prep_day: 'dzień załadunku {d}',
  p9c_pos_gps: 'pozycja GPS',
  p9c_pos_ship: 'statek (AIS)',
  p9c_pos_ship_none: 'statek bez AIS',
  p9c_pos_nogps: 'brak GPS od {t}',
  p9c_pos_nogps_sub: 'próg 30 min w ruchu',
  p9c_pos_rest: 'postój od {t}',
  p9c_pos_none: 'brak pozycji',
  p9c_pos_none_link: 'brak linku śledzenia · Do zrobienia SCX',
  p9c_pos_none_wait: 'link śledzenia czeka na pierwszą pozycję',
  p9c_pos_none_bad: 'link śledzenia nie działa · Do zrobienia SCX',
  p9c_pos_none_down: 'źródło pozycji nie odpowiada · Stan systemu',
  p9c_eta_none: '–',
  p9c_eta_late: '+{d} po oknie',
  p9c_eta_late_ksh: '{d} po oknie KSH',
  p9c_eta_from_last: 'z ostatniej pozycji',
  p9c_eta_site: 'na placu od {t}',
  p9c_empty: 'W oknie śledzenia: 0',
  p9c_empty_sub: 'nikt nie jest teraz w oknie śledzenia',
  p9c_empty_f: 'Na mapie: 0',
  p9c_empty_sub_f: 'żaden z wybranych transportów nie ma teraz pozycji',
  p9c_list_empty: 'Brak transportów dla tych filtrów.',
  /* znacznik (pkt 7) */
  p9c_tip_late: 'opóźniony {d}',
  p9c_tip_eta: 'ETA Boden {eta}',
  p9c_tip_last: 'ostatnia pozycja {t}',
  p9c_tip_seg_PL: 'kierowca odcinka PL',
  p9c_tip_seg_SE: 'kierowca odcinka SE',
  p9c_tip_click: 'kliknij: panel transportu',
  /* dopisek pod mapą (pkt 8) */
  p9c_note: 'Podkład i trasy: HERE · utrudnienia: Trafikverket (SE), HERE (PL) · statki: AIS Fintraffic / digitraffic.fi, CC BY 4.0',
  p9c_note_ais_at: ', ostatni odczyt {t}',
  /* E1 (Przegląd): bez pozycji — cała trasa i ta informacja */
  p9c_drawer_nogps: 'Brak pozycji GPS',
  /* telefon (pkt 9) */
  p9c_sheet_open: 'Otwórz panel transportu',
  p9c_sheet_trail: 'Pokaż przebieg na mapie',
  p9c_sheet_eta: 'ETA Boden {eta}',
  p9c_sheet_last: 'Ostatnia pozycja {t} · kierowca i zestaw odcinka {seg}',
  p9c_sheet_close: 'Zamknij',
};

/**
 * Audyt 17.10 (D-20261017-0730-01 §4): dopisek pod mapą wymienia źródła utrudnień dopiero wtedy, gdy warstwa
 * pokazuje je z danych produkcji (`ROAD_SITUATIONS_MAP`), a HERE (PL) — gdy działa odczyt PL (`ROAD_PL_HERE`).
 */
function mapNote(): string {
  const ais = 'statki: AIS Fintraffic / digitraffic.fi, CC BY 4.0';
  if (!serverRuleOn('ROAD_SITUATIONS_MAP')) return `Podkład i trasy: HERE · ${ais}`;
  const road = serverRuleOn('ROAD_PL_HERE') ? 'Trafikverket (SE), HERE (PL)' : 'Trafikverket (SE)';
  return `Podkład i trasy: HERE · utrudnienia: ${road} · ${ais}`;
}

export function p9m(locale: Locale, key: string): string {
  if (key === 'p9c_note') return mapNote();
  return PL[key] ?? t(locale, key);
}

export function p9mp(locale: Locale, key: string, params: Record<string, string | number>): string {
  let s = p9m(locale, key);
  for (const [k, v] of Object.entries(params)) s = s.split(`{${k}}`).join(String(v));
  return s;
}
