/**
 * wyglad/P6 — teksty strony Ryzyka (E7 „Do zrobienia” i „Sytuacja na trasie”, E6 karta sprawy) poza pierwszym
 * wczytaniem: moduł ładowany razem z leniwym widokiem Ryzyk (budżet 400 kB gzip). Interfejs po polsku (E43).
 * Klucz spoza listy — słownik główny.
 */
import type { Locale } from '../types';
import { t } from './messages';

const PL: Record<string, string> = {
  p6_title: 'Ryzyka',
  p6_todo: 'Do zrobienia',
  p6_todo_same: 'ta sama liczba w menu i w Kokpicie',
  p6_scope_MINE: 'Moje',
  p6_scope_FIRM: 'Moja firma',
  p6_scope_ALL: 'Wszystkie',
  p6_scope_aria: 'Zakres spraw',
  p6_sort: 'Najpilniejsze najpierw',
  p6_empty_MINE: 'Nie masz wziętych spraw.',
  p6_empty_FIRM: 'Twoja firma nie ma spraw do zrobienia.',
  p6_empty_ALL: 'Nie ma spraw do zrobienia.',
  p6_more_1: '… jeszcze 1 karta',
  p6_more_2: '… jeszcze {n} karty',
  p6_more_5: '… jeszcze {n} kart',
  p6_more_sub: 'każda rozwija się kliknięciem w tym samym miejscu',
  p6_expand: 'Rozwiń',
  p6_collapse: 'Zwiń',
  p6_issues_1: '{n} sprawa',
  p6_issues_2: '{n} sprawy',
  p6_issues_5: '{n} spraw',
  p6_load_dates: '{status} · załadunek {load}{late} · dostawa {deliver}',
  p6_load_late: ' minął',
  p6_info: 'Informacja: {text} (nie liczy się)',
  p6_info_s: '{text}',

  /* sprawa */
  p6_org_HHL: 'H&H Logistics',
  p6_org_SCX: 'Scandinavian Express',
  p6_org_KSH: 'KSH',
  p6_decides: 'decyduje {org}',
  p6_fills: 'uzupełnia {org}',
  /* A4 (wyglad/W-faktura-termin, F7): faktura po terminie */
  p6_checks_pay: 'sprawdza płatność {org}',
  p6_nobody: 'nikt nie wziął',
  p6_taken: 'przypisana: {name}',
  p6_taken_me: 'przypisana: Ty',
  p6_dec_over: '{what} po terminie od {date}',
  p6_dec_due: '{what} · termin {date}',
  p6_dec_short_NO_AWIZACJA: 'Awizacja',
  p6_dec_short_NO_SAILING: 'Rejs',
  p6_dec_short_NO_TRACKING: 'Śledzenie',
  p6_dec_short_NO_AWIZ_SE: 'Kierowca SE',
  /* wyglad/W-naprawy (D-20261017-1450-01 §2 pkt 3): nazwy nowych spraw z napraw A2, A3, A6 — kody podaje dopisek */
  p6_dec_short_KSH_DATES_CHECK: 'Daty KSH do sprawdzenia',
  p6_dec_short_DELIVERED_CHECK: 'Czy dostarczono?',
  p6_dec_short_CMR_UPLOAD: 'Wgraj CMR',
  /* A1 L17 (D-20261017-2130-01 §5) */
  p6_dec_short_DELIVERY_UNCONFIRMED: 'Potwierdź dostawę',
  p6_merged_1: '{n} zgłoszenie',
  p6_merged_2: '{n} jednakowe zgłoszenia połączone w jedno',
  p6_merged_5: '{n} jednakowych zgłoszeń połączonych w jedno',
  p6_take: 'Biorę tę sprawę',
  /* E37 „Komunikaty zdaniami” (zamiast „Tę decyzję rozstrzyga inna firma.”) */
  p6_case_other_firm: 'Tę sprawę prowadzi {org}. Możesz ją tylko podejrzeć.',
  p6_give: 'Oddaj',
  p6_takeover: 'Przejmij',
  p6_takeover_q: 'Przejąć sprawę od {name}?',
  p6_takeover_yes: 'Tak, przejmuję',
  p6_cancel: 'Anuluj',
  p6_fill: 'Uzupełnij',
  p6_awiz: 'Otwórz awizację',
  p6_awiz_s: 'Awizacja',
  p6_docs: 'Wgraj',
  p6_open: 'Otwórz transport',
  /* A4 (wyglad/W-faktura-termin): sprawa „Faktura … nieopłacona po terminie” */
  p6_invoice: 'Otwórz fakturę',
  p6_fee: 'Dopłata',
  p6_fee_name_DWELL: 'Dopłata: postój {where} {dur}',
  p6_fee_name_CANCEL: 'Dopłata: anulowanie ({pct}% frachtu)',
  p6_fee_sub: 'podpowiedź systemu {fee} · decyduje {org}',
  p6_fee_wait_hhl: 'Scandinavian Express dodał dopłatę {fee} — czeka na Twoją akceptację',
  p6_call_org: 'Zadzwoń do {org}',
  p6_call_short: '{org}',
  p6_details: 'Szczegóły',
  p6_details_hide: 'Ukryj szczegóły',

  /* karta sprawy (E6) */
  p6_case_load: 'Transport',
  p6_case_dec: 'Decyduje',
  p6_case_fill: 'Uzupełnia',
  p6_case_pay: 'Sprawdza płatność',
  p6_case_dec_line: '{org} · {role} (albo administrator HHL)',
  p6_case_dec_admin: '{org} · Administrator',
  p6_load_unknown: 'Transport spoza Twojej listy',
  p6_case_assigned: 'Przypisana do',
  p6_case_assigned_none: 'nikt',
  p6_case_call: 'Zadzwoń w tej sprawie',
  p6_case_call_btn: 'Zadzwoń',
  p6_case_call_to: 'Zadzwoń: {name}, {phone}',
  p6_case_backup: 'gdy przewoźnik nie odbiera',
  p6_case_assigned_tag: 'ma tę sprawę',
  p6_case_hist: 'Historia sprawy',
  p6_case_no_phone: 'brak telefonu',
  p6_role_HHL_ADMIN: 'Administrator',
  p6_role_HHL_OPS: 'Operacje',
  p6_role_CARRIER_DISPATCH: 'Dyspozytor',
  p6_role_CARRIER_USER: 'Użytkownik',
  p6_role_CLIENT_USER: 'Użytkownik',
  p6_hist_took: '„Biorę tę sprawę”',
  p6_hist_gave: '„Oddaj”',
  p6_hist_tookover: '„Przejmij” od {name}',
  p6_me: 'Ty',

  /* sytuacja na trasie */
  p6_route: 'Sytuacja na trasie',
  p6_route_nobell: 'bez dzwonka',
  p6_tab_todo: 'Do zrobienia',
  p6_tab_route: 'Na trasie',
  p6_tab_sys: 'System',
  p6_tabs_aria: 'Części strony Ryzyka',
  p6_ferries: 'Promy dziś',
  p6_ferries_next: 'Najbliższe promy',
  p6_onboard_1: 'na pokładzie: {n} transport',
  p6_onboard_2: 'na pokładzie: {n} transporty',
  p6_onboard_5: 'na pokładzie: {n} transportów',
  p6_ferry_row: '{vessel} · {time} {from} → {to}',
  p6_ferry_row_s: '{vessel} · {time}',
  p6_ferry_STORM: 'Możliwe odwołanie',
  p6_ferry_ELEVATED: 'Podwyższone ryzyko',
  p6_ferry_CANCELLED: 'Odwołany',
  p6_ferry_DELAYED: 'Opóźniony do {time}',
  p6_ferry_OK: 'Bez ostrzeżeń',
  p6_sea: 'fala {wave} m, porywy {gust} (progi {tw} m / {tg} węzłów)',
  p6_sea_s: 'porywy {gust}',
  p6_kn_1: '{n} węzeł',
  p6_kn_2: '{n} węzły',
  p6_kn_5: '{n} węzłów',
  p6_sea_none: 'bez pomiaru morza',
  p6_ferry_open: 'Pokaż rejs w Harmonogramie › Rejsy',
  p6_ksh_open: 'Otwórz transport',
  p6_ferries_note: 'Jeden wiersz na rejs, najnowszy pomiar. „Statek w porcie” trafia do historii rejsu, nie na tę listę.',
  p6_ferries_none: 'Brak rejsów do Szwecji w rozkładzie na najbliższe dni.',
  p6_ferries_nodata: 'Brak danych o rejsach.',
  p6_ferry_warn: 'Ostrzeżenia rejsów',
  p6_sea_attr: 'Dane morskie: {attr} · pomiar {at}',
  p6_weather: 'Pogoda i siła wyższa',
  p6_bans: 'Zakazy ruchu w dniu przejazdu',
  p6_bans_note: 'informacja — nie liczy się do „Do zrobienia”',
  p6_road_slow: 'spowolnienie ×{mult}{reason}',
  p6_alt_h: 'Druga przeprawa',
  p6_alt_why_CANCELLED: 'Rejs {vessel} odwołany.',
  p6_alt_why_STORM: 'Sztorm na przeprawie {from}.',
  p6_alt_list: 'Najbliższe odejścia do Szwecji: {line}',
  p6_alt_note: 'Zmiana przeprawy nie wymaga nowego zezwolenia. Rejs rezerwuje Scandinavian Express.',
  p6_alt_both: 'Sztorm albo odwołania na obu przeprawach — bez propozycji.',
  p6_alt_nodata: 'Brak danych o rozkładzie drugiej przeprawy.',
  p6_line_POLFERRIES: 'Polferries · Gdańsk → Nynäshamn',
  p6_line_STENA: 'Stena Line · Gdynia → Karlskrona',
  p6_port_GDN: 'Gdańsk',
  p6_port_GDY: 'Gdynia',
  p6_port_NYN: 'Nynäshamn',
  p6_port_KAA: 'Karlskrona',
  /* BN9-a: nowe przeprawy z katalogu promów */
  p6_port_TLL: 'Tallinn',
  p6_port_MUU: 'Muuga',
  p6_port_PLD: 'Paldiski',
  p6_port_HEL: 'Helsinki',
  p6_port_VUO: 'Vuosaari',
  p6_port_STO: 'Sztokholm',
  p6_port_KPS: 'Kapellskär',
  p6_line_TALLINK: 'Tallink Silja · Tallinn → Helsinki',
  p6_line_VIKING: 'Viking Line · Tallinn → Helsinki',
  p6_line_ECKERO: 'Eckerö Line · Tallinn → Helsinki',
  p6_line_DFDS: 'DFDS · Paldiski → Kapellskär',
  p6_notice: 'Komunikat armatora (wpis ręczny)',
  p6_road_pl: 'Drogi PL',
  p6_road_pl_src: 'HERE',
  p6_road_pl_none: 'Brak komunikatów o utrudnieniach na drogach w Polsce. Źródło: HERE, odświeżanie co 15 minut.',
  p6_road_se: 'Drogi SE',
  p6_road_counts: '{list} · Trafikverket',
  p6_imp_VERY_HIGH: 'Bardzo duży wpływ',
  p6_imp_HIGH: 'Duży wpływ',
  p6_imp_MEDIUM: 'Średni wpływ',
  p6_imp_LOW: 'Mały wpływ',
  p6_road_translated: 'przetłumaczone ze szwedzkiego',
  p6_road_original: 'Pokaż oryginał',
  /* B9 (D-20261019-1515-01 pkt 4) */
  p6_road_pending: 'Tłumaczenie w toku',
  p6_road_all: 'Pokaż wszystkie {n}',
  p6_road_less: 'Pokaż mniej',
  p6_road_note: 'Najpierw bardzo duży i duży wpływ. Zakazy ruchu w dniu przejazdu są informacją przy swoim transporcie, nie liczą się do „Do zrobienia”.',
  p6_road_none: 'Brak utrudnień na E4 i E22.',
  p6_road_nosrc: 'Brak danych z Trafikverket.',
  p6_sys: 'System',
  p6_sys_hhl: 'tylko HHL',
  p6_sys_n_1: '{n} sprawa techniczna (SMS, kopie, źródła danych) jest w Opcje › System › Stan systemu.',
  p6_sys_n_2: '{n} sprawy techniczne (SMS, kopie, źródła danych) są w Opcje › System › Stan systemu.',
  p6_sys_n_5: '{n} spraw technicznych (SMS, kopie, źródła danych) jest w Opcje › System › Stan systemu.',
  p6_sys_none: 'Sprawy techniczne (SMS, kopie, źródła danych) są w Opcje › System › Stan systemu.',
  p6_sys_go: 'Otwórz Stan systemu',
  p6_ksh_note: 'Sprawy do zrobienia prowadzą H&H Logistics i Scandinavian Express. Tu widzisz sytuację na trasie.',
};

/** Czy klucz jest w tekstach P6 (np. krótka nazwa rodzaju decyzji). */
export function rtHas(key: string): boolean {
  return key in PL;
}

export function rt(locale: Locale, key: string): string {
  return PL[key] ?? t(locale, key);
}

/** Polska odmiana po liczbie: klucze `<base>_1` (1), `<base>_2` (2–4, bez 12–14), `<base>_5` (reszta). */
export function plForm(n: number): '1' | '2' | '5' {
  if (n === 1) return '1';
  const d = n % 10;
  const h = n % 100;
  return d >= 2 && d <= 4 && (h < 12 || h > 14) ? '2' : '5';
}

export function rtp(locale: Locale, key: string, params: Record<string, string | number>): string {
  let s = rt(locale, key);
  for (const [k, v] of Object.entries(params)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

export function rtn(locale: Locale, base: string, n: number, params: Record<string, string | number> = {}): string {
  return rtp(locale, `${base}_${plForm(n)}`, { n, ...params });
}
