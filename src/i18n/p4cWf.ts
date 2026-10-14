/**
 * wyglad/P4-c — teksty Automatyzacji („Działa samo”, E35 pkt 1, L13) poza pierwszym wczytaniem: moduł ładowany razem
 * z leniwym widokiem Automatyzacji (budżet 400 kB gzip, `scripts/bundle-size.mjs`). Interfejs po polsku (E43);
 * klucz spoza listy — słownik główny (`t`).
 */
import type { Locale } from '../types';
import { t } from './messages';

const PL: Record<string, string> = {
  p4c_wf_tab_auto: 'Działa samo',
  p4c_wf_tab_own: 'Własne reguły · {n}',
  p4c_wf_auto_lead: 'Co aplikacja robi bez człowieka. Liczby ustawia się w Opcjach, a tu jest opis i ostatnie działanie.',
  p4c_wf_auto_foot: 'Po kliknięciu wiersza: pełny opis, ostatnie działania i odnośnik do ustawień.',
  p4c_wf_g_status: 'STATUSY',
  p4c_wf_g_todo: 'DO ZROBIENIA',
  p4c_wf_g_msg: 'WIADOMOŚCI',
  p4c_wf_g_money: 'PIENIĄDZE I DANE',
  p4c_wf_r_zones: 'Status ze stref',
  p4c_wf_r_zones_d: 'wjazd i wyjazd: Śrem, porty, plac (E25, E34) · wyjazd z placu → Dostarczone (E26)',
  p4c_wf_r_cases: 'Sprawy z terminem',
  p4c_wf_r_cases_d: 'awizacja 48/12 h, dokumenty 24 h, numery zleceń, daty KSH ≤ 5 dni, postój ponad czas wolny (E7, E32, E31, E33)',
  p4c_wf_r_gps: 'Cisza GPS, ETA, prom',
  p4c_wf_r_gps_d: 'brak pozycji 30 min w ruchu / 3 h na postoju, opóźnienie po wyjeździe, rejs odwołany (E15, E45)',
  p4c_wf_r_notify: 'Powiadomienia i e-maile',
  p4c_wf_r_notify_d: 'kto co dostaje: zdarzenie × rola × kanał (E11, E5), treści z szablonów (E43)',
  p4c_wf_r_texts: 'SMS do Śremu i Boden',
  p4c_wf_r_texts_d: 'A zbliżanie · B wcześniejszy przyjazd · C auto czeka · D wjazd; cisza 20:00–06:00 (E42)',
  p4c_wf_r_prices: 'Opłata paliwowa, kurs NBP, ceny',
  p4c_wf_r_prices_d: 'ceny paliwa 07:15 (po E3 także 09:15 i 13:15), NBP 12:30 i 16:30, wycena co 6 h (E3, E16, E39)',
  p4c_wf_r_sched: 'Harmonogram KSH',
  p4c_wf_r_sched_d: 'plik KSH: wiersze z „Przewoźnik = HH”, daty zmienia tylko KSH; SharePoint po dostępie od IT KSH (E38)',
  p4c_wf_link_thr: 'Opcje › Progi',
  p4c_wf_link_who: 'Opcje › Kto co dostaje',
  p4c_wf_link_zones: 'Opcje › SMS przy miejscach',
  p4c_wf_link_fuel: 'Opcje › Opłata paliwowa',
  p4c_wf_link_geo: 'Strefy',
  p4c_wf_meta_sched: 'po E38',
  p4c_wf_last: 'Ostatnie działanie: {what}',
  p4c_wf_last_none: 'Ostatnie działanie: brak źródła danych.',
  p4c_wf_state: 'Stan: {what}',
  p4c_wf_open: 'Ustawienia: {where} ›',
  p4c_wf_zt_zone: 'Strefa',
  p4c_wf_zt_in: 'Wjazd',
  p4c_wf_zt_out: 'Wyjazd',
  p4c_wf_zt_srem: 'KSH Śrem (załadunek)',
  p4c_wf_zt_srem_in: 'Załadunek',
  p4c_wf_zt_srem_out: 'Droga PL — po postoju ≥ 5 min (załadowany)',
  p4c_wf_zt_portpl: 'Port PL — Gdańsk, Gdynia',
  p4c_wf_zt_portpl_in: 'Port PL',
  p4c_wf_zt_portpl_out: 'bez zmiany — „Na promie” z odejścia rejsu',
  p4c_wf_zt_portse: 'Port SE — Nynäshamn, Karlskrona',
  p4c_wf_zt_portse_in: 'Port SE',
  p4c_wf_zt_portse_out: 'Droga SE',
  p4c_wf_zt_site: 'Plac budowy Stegra Boden',
  p4c_wf_zt_site_in: 'Na placu',
  p4c_wf_zt_site_out: 'Dostarczone — po ≥ 10 min; krócej: sprawa „czy dostarczono?” dla SCX',
  p4c_wf_zt_buf: 'Bufory: 20 km przed portem, 50 km przed Boden i Śremem',
  p4c_wf_zt_buf_in: 'bez zmiany statusu',
  p4c_wf_zt_buf_out: 'bez zmiany statusu',
  p4c_wf_zt_who: 'Zmienia tylko Administrator HHL: edycja strefy (E34) i własne reguły (E35). Wierszy tej listy nie edytuje się tutaj.',
  p4c_wf_more: 'Więcej',
  p4c_wf_less: 'Zwiń',
};

/** Tekst „Działa samo” z parametrami `{nazwa}`. */
export function wt(locale: Locale, key: string, params: Record<string, string | number> = {}): string {
  const raw = PL[key];
  if (raw == null) return t(locale, key);
  return raw.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m));
}
