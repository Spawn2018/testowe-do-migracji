/**
 * wyglad/P7-a — teksty panelu transportu › Przegląd i okna Awizacja (E32, img/e32-after). Interfejs po polsku (E43).
 * Klucz spoza listy — słownik główny.
 */
import type { Locale } from '../types';
import { t } from './messages';

const PL: Record<string, string> = {
  /* nagłówek panelu */
  p7_hd_load: 'Załadunek',
  p7_hd_deliver: 'Dostawa',
  p7_hd_week: 't{n}',
  p7_back: 'Wróć do listy',

  /* Do zrobienia przy tym transporcie */
  p7_todo_h: 'Do zrobienia przy tym transporcie · {n}',
  p7_todo_h_phone: 'Do zrobienia · {n}',
  /* telefon, linia stanu zwiniętej sekcji (właściciel 18.10, 11:35) */
  p7_todo_more_1: 'i jeszcze {n} sprawa',
  p7_todo_more_2: 'i jeszcze {n} sprawy',
  p7_todo_more_5: 'i jeszcze {n} spraw',
  p7_todo_today: 'Załadunek dziś',
  p7_todo_over: 'po terminie',
  p7_todo_due: 'termin {date}',
  p7_todo_urgent: 'pilne od {date}',
  p7_todo_add: 'Dodaj',
  p7_todo_awiz: 'Uzupełnij',
  p7_todo_upload: 'Wgraj',
  p7_todo_prices: 'Ceny',
  p7_ksh_line_awiz_none: 'Awizacja: przewoźnik uzupełnia',
  p7_ksh_line_awiz_part: 'Awizacja: przewoźnik uzupełnia (brakuje: {what})',
  p7_ksh_line_awiz_ok: 'Awizacja: kompletna',

  /* Plan i ETA */
  p7_plan_h: 'Plan i ETA',
  p7_plan_load: 'Załadunek',
  p7_plan_deliver: 'Dostawa',
  p7_plan_dates: 'Daty',
  p7_plan_eta: 'ETA Boden',
  p7_no_hour: 'godzina nie podana',
  p7_no_date: 'data nie podana',
  p7_dates_import: 'z harmonogramu KSH · import {at}',
  p7_dates_import_plain: 'z harmonogramu KSH',
  p7_dates_changed: 'zmienił {who}, {at}',
  p7_dates_ksh_can: 'KSH może zmienić do wjazdu na załadunek, Administrator HHL — zawsze',
  p7_dates_edit: 'Edytuj',
  p7_place_deliver: 'Stegra, Boden',
  p7_plan_line: '{a} → {b}',

  /* Awizacja / kierowcy */
  p7_awiz_h: 'Awizacja',
  p7_awiz_fills: 'uzupełnia SCX',
  p7_awiz_none: 'brak',
  p7_awiz_part: 'brakuje {n}',
  p7_awiz_ok: 'kompletna',
  p7_awiz_ok_nosail: 'kompletna · bez rejsu',
  p7_drivers_h: 'Kierowcy i zestaw',
  p7_swap: 'przepięcie naczepy',
  p7_seg_one: 'Kierowca · odbiór i dostawa · Śrem → Boden',
  p7_seg_pl: 'Odcinek PL · Śrem → prom',
  p7_seg_se: 'Odcinek SE · prom → Boden',
  p7_seg_now: 'teraz',
  p7_tractor_w: 'ciągnik',
  p7_call: 'Zadzwoń',
  p7_call_aria: 'Zadzwoń: {name}',
  p7_row_driver: 'Kierowca',
  p7_row_tractor_trailer: 'Ciągnik · naczepa',
  p7_row_trailer: 'Naczepa',
  p7_row_link: 'Link śledzenia',
  p7_row_sailing: 'Rejs',
  p7_link_set: 'wpisany',
  p7_link_none: 'brak',
  p7_sail_pick: 'wybiera SCX z rozkładu w awizacji',
  p7_sail_none: 'nie przypisano',
  p7_sail_unpicked: 'dzień i godzina rejsu jeszcze niewybrane — wybiera SCX w awizacji',
  /* #557 cz. 2 — „Przypnij rejs” (tylko Administrator HHL) */
  p7_pin_lead: 'Auto jest już w Szwecji, a przypisany rejs jeszcze nie wypłynął. Pasujący rejs: {sailing}.',
  p7_pin_btn: 'Przypnij rejs',
  p7_pin_ask: 'Przypiąć rejs {sailing}? Status i etap w Szwecji przeliczą się od razu, a zmiana trafi do historii.',
  p7_pin_yes: 'Tak, przypnij',
  p7_pin_no: 'Anuluj',
  p7_pin_busy: 'Zapisuję…',
  p7_pin_done: 'Rejs przypięty: {sailing}',
  p7_pin_err: 'Nie udało się przypiąć rejsu.',
  p7_pin_err_unknown: 'Brak odpowiedzi z bazy — nie wiadomo, czy rejs przypięto. Karta pobrała już aktualny stan: sprawdź wiersz „Rejs”. Jeśli ostrzeżenie nadal jest widoczne, zamknij i otwórz kartę, aby spróbować ponownie.',
  p7_pin_err_read: 'Nie udało się pobrać propozycji rejsu.',
  p7_pin_err_admin: 'Przypiąć rejs może tylko Administrator HHL zalogowany z kodem weryfikacji dwuetapowej.',
  p7_pin_err_cancelled: 'Ten rejs jest odwołany — wybierz inny rejs w awizacji.',
  p7_pin_err_route: 'Ten rejs jest na innej trasie. Przypiąć można tylko rejs Gdańsk → Nynäshamn albo Gdynia → Karlskrona.',
  p7_pin_none: 'Auto jest już w Szwecji, a przypisany rejs jeszcze nie wypłynął. W rozkładzie nie ma pasującego rejsu — wybierz rejs w awizacji.',
  p7_pilots_h: 'Piloci',
  p7_pilot_pl: 'Pilot PL',
  p7_pilot_se: 'Pilot SE',
  p7_pilot_none: 'brak · uzupełnia SCX',
  p7_awiz_btn_add: 'Uzupełnij awizację',
  p7_awiz_btn_edit: 'Edytuj awizację',
  p7_awiz_btn_fix: 'Popraw awizację',

  /* Ładunek i zestaw */
  p7_cargo_h: 'Ładunek i zestaw',
  p7_cargo: 'Ładunek',
  p7_cargo_dims: 'Wymiary ładunku',
  p7_set: 'Zestaw z ładunkiem',
  p7_set_src: 'z tabeli HHL ({sym}) · zmienia HHL',
  p7_set_own: 'wpisane przy transporcie · zmienia HHL',
  p7_set_none: 'nieznany — poda HHL',
  /* wyglad/P7-b — „Zmień” przy zestawie (E32 pkt 7, E9 D-83) */
  p7_set_edit: 'Zmień',
  p7_set_edit_aria: 'Zmień zestaw z ładunkiem',
  p7_set_legend: 'Zestaw z ładunkiem, w metrach',
  p7_set_l: 'Długość',
  p7_set_w: 'Szerokość',
  p7_set_h: 'Wysokość',
  p7_set_save: 'Zapisz',
  p7_set_cancel: 'Anuluj',
  p7_set_reset: 'Przywróć z tabeli ({sym})',
  p7_set_err_fmt: 'Podaj trzy wymiary w metrach, np. 21,69 × 2,45 × 3,75.',
  p7_set_err_range: 'Długość 5–40 m, szerokość i wysokość 1,5–6 m.',
  p7_set_saved: 'Zapisano. Zmiana jest w zakładce Historia.',
  p7_set_fail: 'Nie udało się zapisać. Spróbuj ponownie.',
  p7_permit: 'Zezwolenie',
  p7_permit_FIRMA: 'Firma',
  p7_permit_TRASA: 'Trasa',
  p7_permit_FIRMA_sub: 'podpina się samo',
  p7_permit_TRASA_sub: 'wgrywa SCX do transportu',
  p7_qty: '{n} szt.',

  /* Numery zleceń */
  p7_num_h: 'Numery zleceń',
  p7_num_missing: 'brak',
  p7_num_cancel: 'Anuluj',
  p7_num_by_scx: 'wpisuje SCX',
  p7_num_by_hhl: 'wpisuje HHL',
  p7_num_add: 'Dodaj',
  p7_num_edit: 'Edytuj',

  /* telefon — linie stanu sekcji */
  p7_ph_plan: 'Plan',
  p7_ph_eta: 'ETA {v}',
  p7_ph_site: 'Na placu od {v}',
  p7_ph_num_both: 'brak obu',
  p7_ph_num_one: 'brak {which}',
  p7_ph_num_ok: 'są',

  /* okno Awizacja */
  p7_m_title: 'Awizacja · {code}',
  p7_hd_miss_scx: 'brak nr SCX',
  p7_m_load: 'załadunek {day} · Śrem',
  p7_m_missing: 'Brakuje: {what}.',
  p7_m_complete: 'Awizacja kompletna.',
  p7_m_complete_nosail: 'Do „Gotowy” brakuje jeszcze rejsu do Szwecji.',
  p7_m_urgent: 'Pilne od {at} (12\u00a0h przed dniem załadunku).',
  p7_m_warn: 'Termin: {at} (12\u00a0h przed dniem załadunku); przypomnienie od {warn}.',
  p7_m_urgent_h: 'Pilne od {at} (12\u00a0h przed załadunkiem).',
  p7_m_warn_h: 'Termin: {at} (12\u00a0h przed załadunkiem); przypomnienie od {warn}.',
  p7_m_seg_one: 'Kierowca · odbiór i dostawa · Śrem → Boden',
  p7_m_seg_pl: 'Odcinek PL · Śrem → prom',
  p7_m_seg_se: 'Odcinek SE · prom → Boden',
  p7_m_name: 'Imię i nazwisko',
  p7_m_phone: 'Telefon',
  p7_m_tractor: 'Ciągnik',
  p7_m_trailer: 'Naczepa (jedna na całą trasę)',
  p7_m_trailer_many: 'Wpisz jeden numer naczepy. Dwa numery w tym polu zrywają łączenie pozycji z emtrack z tym transportem.',
  p7_m_swap: 'Przepięcie naczepy',
  p7_m_swap_hint: 'po zaznaczeniu pojawia się „Odcinek SE · prom → Boden”',
  p7_m_operator: 'Armator',
  /* #666 decyzja 53 */
  p7_m_sailing: 'Rejs promem',
  p7_m_vessel: 'Statek',
  p7_m_scx_no: 'Nr zlecenia SCX',
  p7_m_hhl_no: 'Nr zlecenia HHL',
  p7_m_hhl_ro: 'wpisuje HHL',
  p7_m_foot: 'Można zapisać część. Sprawa w Do zrobienia zostaje, dopóki awizacja nie jest kompletna. Każda zmiana trafia do Historii jako „było → jest”.',
  p7_m_cancel: 'Anuluj',
  p7_m_close: 'Zamknij',
  p7_m_save: 'Zapisz',
  p7_m_ro: 'Awizację robi SCX. Ty ją oglądasz.',
  /* D-20261020-1501-01: Podgląd (B5) — tylko do odczytu; rejs i link śledzenia można dodać później */
  p7_m_ro_preview: 'Podgląd — tylko do odczytu. Awizację zapisujesz w swoim widoku HHL.',
  /* #666 decyzja 52–53 */
  p7_m_sailing_hist: 'Rejsy, które już wypłynęły lub dopłynęły (tylko Administrator HHL)',
  /* #666 decyzja 51 */
  p7_m_sailing_before_load: 'przed planowanym załadunkiem',
  /* #666 decyzja 55 */
  p7_m_sailing_empty: 'Brak rejsów w rozkładzie — źródło niedostępne lub rozkład jeszcze niepobrany; rejs można dodać później',
  /* D-20261020-1525-01: Odcinek SE — puste pola dozwolone; kierowcę SE awizuje się najpóźniej 48 h przed dostawą */
  p7_m_se_later: 'Można zapisać puste: inny kierowca i ciągnik od promu. Kierowcę SE trzeba awizować najpóźniej 48\u00a0h przed dostawą.',
  p7_m_se_later_miss: 'Do uzupełnienia najpóźniej 48\u00a0h przed dostawą: {what}. Do tego czasu sprawa „Brak awizacji kierowcy SE”.',
  p7_m_sailing_later: 'Rejs można dodać później. Do tego czasu w Do zrobienia jest sprawa „Brak rejsu promu”.',
  p7_m_track_later: 'Link nie jest wymagany do zapisu. Bez linku w Do zrobienia jest sprawa „Brak linku śledzenia”.',
  p7_m_pilots_h: 'Piloci',
  p7_m_pilots_lead: '{kind}: zestaw {set}. Tabela HHL: „PL + SE” — wymagany pilot PL i pilot SE (dwóch różnych). Załadunek {day}.',
  p7_m_pilots_missing: '{n} brakują',
  p7_m_pilots_missing_1: '1 brakuje',
  p7_m_convoy: 'Konwój {day}: {codes} — ci sami piloci dla całego konwoju',
  p7_m_pilot_pl: 'Pilot PL · Śrem → Gdańsk',
  p7_m_pilot_se: 'Pilot SE · Nynäshamn → Boden',
  p7_m_plate: 'Numer rejestracyjny',
  p7_m_pilot_name: 'Imię i nazwisko',
  p7_m_pilots_note: 'Wymóg pochodzi z symbolu („PL + SE” w tabeli HHL: KR, PL-B), nie z zezwoleń. Pola pilota: tylko numer rejestracyjny oraz imię i nazwisko.',
  p7_m_err_phone: 'Numer telefonu wygląda na niepełny.',

  /* „Brakuje: …” — nazwy pól */
  p7_miss_driver: 'kierowca',
  p7_miss_phone: 'telefon',
  p7_miss_tractor: 'ciągnik',
  p7_miss_trailer: 'naczepa',
  p7_miss_driverSe: 'kierowca odcinka SE',
  p7_miss_phoneSe: 'telefon odcinka SE',
  p7_miss_tractorSe: 'ciągnik odcinka SE',
  p7_miss_pilotPl: 'pilot PL — numer rejestracyjny, imię i nazwisko',
  p7_miss_pilotPlPlate: 'pilot PL — numer rejestracyjny',
  p7_miss_pilotPlName: 'pilot PL — imię i nazwisko',
  p7_miss_pilotSe: 'pilot SE — numer rejestracyjny, imię i nazwisko',
  p7_miss_pilotSePlate: 'pilot SE — numer rejestracyjny',
  p7_miss_pilotSeName: 'pilot SE — imię i nazwisko',
};

export function pt(locale: Locale, key: string): string {
  return PL[key] ?? t(locale, key);
}

export function ptHas(key: string): boolean {
  return key in PL;
}

export function ptp(locale: Locale, key: string, params: Record<string, string | number>): string {
  let s = pt(locale, key);
  for (const [k, v] of Object.entries(params)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

function plForm(n: number): '1' | '2' | '5' {
  if (n === 1) return '1';
  const d = n % 10;
  const h = n % 100;
  return d >= 2 && d <= 4 && (h < 12 || h > 14) ? '2' : '5';
}

export function ptn(locale: Locale, base: string, n: number, params: Record<string, string | number> = {}): string {
  return ptp(locale, `${base}_${plForm(n)}`, { n, ...params });
}
