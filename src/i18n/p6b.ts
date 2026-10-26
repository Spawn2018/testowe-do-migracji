/**
 * wyglad/P6-b — teksty panelu transportu: Historia i Czat (E17). Interfejs po polsku (E43). Klucz spoza listy — słownik główny.
 * Mały słownik: wchodzi do pierwszego wczytania razem z liczbą nieprzeczytanych na zakładce „Czat” (budżet 400 kB gzip).
 */
import type { Locale } from '../types';
import { t } from './messages';

const PL: Record<string, string> = {
  /* Historia */
  p6b_f_ALL: 'Wszystko',
  p6b_f_ROUTE: 'Statusy i trasa',
  p6b_f_RES: 'Zasoby i awizacja',
  p6b_f_NUM: 'Numery',
  p6b_f_DOC: 'Dokumenty',
  p6b_f_PRICE: 'Ceny',
  p6b_f_RES_short: 'Zasoby',
  p6b_f_aria: 'Rodzaj wpisów',
  p6b_tag_STATUS: 'Status',
  p6b_tag_TRASA: 'Trasa',
  p6b_tag_ZASOBY: 'Zasoby',
  p6b_tag_NUMER: 'Numer',
  p6b_tag_DOKUMENT: 'Dokument',
  p6b_tag_CENA: 'Cena',
  p6b_tag_PLAN: 'Plan',
  p6b_tag_IMPORT: 'Import',
  p6b_tag_PROBA: 'Próba',
  p6b_tag_NOTATKA: 'Notatka',
  p6b_tag_DECYZJA: 'Decyzja',
  p6b_tag_INNE: 'Zmiana',
  p6b_hist_empty: 'Brak wpisów w tym zakresie.',
  p6b_hidden_1: '{n} dawny zapis bez zmiany ukryty (np. ten sam numer, zasoby bez zmian, „Gotowy → Gotowy”).',
  p6b_hidden_2: '{n} dawne zapisy bez zmiany ukryte (np. ten sam numer, zasoby bez zmian, „Gotowy → Gotowy”).',
  p6b_hidden_5: '{n} dawnych zapisów bez zmiany ukrytych (np. ten sam numer, zasoby bez zmian, „Gotowy → Gotowy”).',
  p6b_src_GPS: 'GPS',
  p6b_src_AIS: 'AIS',
  p6b_src_IMPORT: 'import',
  p6b_src_MANUAL: 'ręcznie',
  /* A10: pozostałe źródła automatu (oś Status — p6c_tag_*) */
  p6b_src_SCHEDULE: 'rozkład promu',
  p6b_src_DATA: 'dane awizacji',
  p6b_src_DOC: 'dokumenty',
  p6b_src_DRIVER: 'kierowca (aplikacja)',
  p6b_src_INVOICE: 'faktury',
  p6b_driver_app: 'Kierowca (aplikacja)',
  p6b_no_person: '(zapis bez osoby)',
  p6b_as: 'jako',
  /* D-0005 (0234): korekta godziny statusu przez Administratora HHL */
  p6b_korekta_admin: 'Administrator HHL',
  p6b_korekta_axis: 'poprawił Administrator HHL (było {was})',
  p6b_korekta_axis_who: 'poprawka godziny: {who} (było {was})',
  p6b_korekta_hist: 'korekta godziny (było {was})',
  p6b_korekta_ais: 'wypłynięcie według AIS (było {was})',

  /* nazwy zdarzeń (E17-2) — bez kodów */
  p6b_ev_STATUS: 'Status: {to}',
  p6b_ev_STATUS_AUTO: 'Status zmieniony automatycznie',
  p6b_ev_GEOFENCE_ENTER: 'Wjazd w strefę {zone}',
  p6b_ev_GEOFENCE_EXIT: 'Wyjazd ze strefy {zone}',
  p6b_ev_GEOFENCE_DWELL: 'Postój w strefie {zone}',
  p6b_ev_zone_none: '(strefa bez nazwy)',
  p6b_ev_RESOURCES_UPDATED: 'Zasoby: {fields}',
  p6b_ev_RESOURCES_ASSIGNED: 'Zasoby przypisane',
  /* D-20261020-1118-01 (#357): zapis pilotów z okna „Uzupełnij awizację” */
  p6b_ev_PILOTS_SET: 'Piloci w awizacji zapisani',
  p6b_ev_ORDER_NO_UPDATED: 'Numer zlecenia',
  p6b_ev_ORDER_NO_HHL: 'Nr zlecenia HHL',
  p6b_ev_ORDER_NO_SCX: 'Nr zlecenia SCX',
  p6b_ev_SCHEDULE_IMPORTED: 'Dodany z harmonogramu KSH',
  p6b_import_ver: 'wersja {v}',
  p6b_import_file: 'plik {f}',
  p6b_ev_SAILING_ASSIGNED: 'Rejs',
  p6b_ev_FERRY_UPDATED: 'Prom zmieniony',
  p6b_ev_READY_BLOCKED: '„Gotowy” zablokowany',
  p6b_ev_AWIZACJA_UPDATED: 'Awizacja zmieniona',
  p6b_ev_SCX_ASSIGNED: 'Przewoźnik przypisany',
  p6b_ev_DOC_MISSING: 'Brak dokumentu',
  p6b_ev_POSITION_STALE: 'Brak pozycji GPS',
  p6b_ev_POSITION_SHARED: 'Pozycja z telefonu kierowcy',
  p6b_ev_POSITION_SHARE_DENIED: 'Kierowca nie udostępnił pozycji',
  p6b_ev_PLAN_B_ACTIVATED: 'Plan B włączony',
  p6b_ev_FEE: 'Dopłata',
  p6b_ev_PRICE: 'Cena',
  p6b_ev_OTHER: 'Zmiana w transporcie',
  p6b_ev_PERMIT_MISMATCH: 'Zezwolenie niezgodne z zestawem',
  p6b_ev_MILESTONE_LOADED: 'Załadunek zakończony',
  p6b_ev_MILESTONE_UNLOADED: 'Rozładunek zakończony',
  p6b_ev_DRIVER_ON_FERRY: 'Kierowca: na promie',
  p6b_ev_DRIVER_PROBLEM: 'Kierowca zgłosił problem',
  p6b_ev_DELAY_DETECTED: 'Wykryto opóźnienie',
  p6b_ev_RISK_RAISED: 'Nowe ryzyko',
  p6b_ev_SILENT_VEHICLE: 'Brak sygnału z pojazdu',
  p6b_ev_PLAN_DATES_CONFIRMED: 'Daty planu potwierdzone',
  /* #384: skutki rozstrzygnięć decyzji (decision_apply_effect) */
  p6b_ev_DECISION_EFFECT: 'Decyzja rozstrzygnięta',
  p6b_ev_DECISION_HOLD: 'Decyzja wstrzymana',
  p6b_ev_DECISION_SAILING: 'Decyzja: zmiana rejsu',
  p6b_ev_DECISION_KEEP_TOWER: 'Decyzja: zostaje wartość z Watch Tower',
  p6b_ev_DOC_UPLOADED: 'Wgrano dokument',
  p6b_ev_NOTE: 'Notatka',
  p6b_st_CANCELLED: 'Anulowany',
  p6b_yes: 'tak',
  p6b_no: 'nie',
  p6b_removed: 'usunięty',
  p6b_plan_load: 'załadunek:',
  p6b_plan_del: 'dostawa {a} → {b}',
  p6b_field_driverName: 'kierowca',
  p6b_field_driverPhone: 'telefon kierowcy',
  p6b_field_driverDeliveryName: 'kierowca odcinka SE',
  p6b_field_driverDeliveryPhone: 'telefon kierowcy SE',
  p6b_field_tractorPlate: 'ciągnik',
  p6b_field_tractorDeliveryPlate: 'ciągnik odcinka SE',
  p6b_field_trailerPlate: 'naczepa',
  p6b_field_trailerSwap: 'przepięcie naczepy',
  /* wyglad/P7-b — „Zmień” przy zestawie (E32 pkt 7) */
  p6b_field_setLengthM: 'zestaw z ładunkiem',
  p6b_field_setWidthM: 'zestaw z ładunkiem',
  p6b_field_setHeightM: 'zestaw z ładunkiem',
  p6b_field_escort: 'pilot',
  p6b_field_escortPlate: 'pilot',
  p6b_field_other: 'dane',

  /* Przegląd: stan awizacji (E17 → E32; to, co KSH widział w „Ustaleniach”) */
  p6b_awi_none: 'brak · uzupełnia SCX',
  p6b_awi_open: 'niepotwierdzona',
  p6b_awi_ok: 'potwierdzona',

  /* Czat */
  p6b_chat_vis: 'Widzą:',
  p6b_chat_vis_ALL: 'HHL, SCX, KSH',
  p6b_chat_vis_HHL_SCX: 'tylko HHL i SCX',
  p6b_chat_vis_ALL_short: 'wszyscy',
  p6b_chat_vis_HHL_SCX_short: 'HHL i SCX',
  p6b_chat_vis_aria: 'Kto zobaczy wiadomość',
  p6b_chat_ph_ALL: 'Napisz do HHL, SCX i KSH…',
  p6b_chat_ph_HHL_SCX: 'Napisz tylko do HHL i SCX…',
  p6b_chat_ph_KSH: 'Napisz do HHL i SCX…',
  p6b_chat_ph_short: 'Napisz…',
  p6b_chat_send: 'Wyślij',
  p6b_chat_label: 'Wiadomość',
  p6b_chat_hint: 'Enter wysyła · Shift+Enter nowa linia · powiadomienie w aplikacji dla pozostałych firm',
  p6b_chat_empty: 'Brak wiadomości. Napisz pierwszą.',
  p6b_chat_only: 'tylko HHL i SCX',
  p6b_chat_log: 'Wiadomości',
  p6b_chat_unread_1: '{n} nieprzeczytana',
  p6b_chat_unread_2: '{n} nieprzeczytane',
  p6b_chat_unread_5: '{n} nieprzeczytanych',
};

export function ht(locale: Locale, key: string): string {
  return PL[key] ?? t(locale, key);
}

export function htHas(key: string): boolean {
  return key in PL;
}

export function htp(locale: Locale, key: string, params: Record<string, string | number>): string {
  let s = ht(locale, key);
  for (const [k, v] of Object.entries(params)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

function plForm(n: number): '1' | '2' | '5' {
  if (n === 1) return '1';
  const d = n % 10;
  const h = n % 100;
  return d >= 2 && d <= 4 && (h < 12 || h > 14) ? '2' : '5';
}

export function htn(locale: Locale, base: string, n: number, params: Record<string, string | number> = {}): string {
  return htp(locale, `${base}_${plForm(n)}`, { n, ...params });
}
