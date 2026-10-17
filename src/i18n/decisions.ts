/** DEC-2 — etykiety typów i opcji decyzji (katalog 0102). */
import type { Locale } from '../types';

type Dict = Record<string, string>;

const pl: Dict = {
  dec_type_FERRY_CANCELLED: 'Rejs odwołany albo sztorm na trasie',
  dec_type_ETA_AFTER_LATEST: 'ETA po godzinie „najpóźniej do”',
  dec_type_KSH_DATE_LT_5D: 'KSH zmieniło datę < 5 dni przed załadunkiem',
  dec_type_NO_AWIZACJA: 'Brak awizacji w terminie',
  dec_type_DOC_MISSING: 'Brak zezwolenia lub dokumentu przed „Gotowy”',
  dec_type_KSH_ROW_GONE: 'Wiersz zniknął z pliku KSH',
  dec_type_TOWER_KSH_CONFLICT: 'Konflikt Watch Tower ↔ plik KSH',
  dec_type_KSH_FILE_ERROR: 'Błąd w pliku KSH',
  dec_type_NO_POSITION: 'Brak pozycji auta w drodze',
  dec_type_ROUTE_DEVIATION: 'Zjazd z trasy z zezwolenia',
  dec_type_SEFS_OUT_OF_TABLE: 'Opłata paliwowa: cena poza tabelą albo awaria źródła',
  dec_type_SEFS_INVOICE_DIFF: 'Opłata paliwowa na fakturze ≠ wyliczona',
  dec_type_KR_OVER_3: 'Ponad 3 kratownice jednego dnia',
  dec_type_INSURANCE_EXPIRING: 'Polisa przewoźnika wygasa',
  dec_type_DWELL_OVER_FREE: 'Zmierzony postój ponad czas wolny',
  dec_type_BACKUP_FAILED: 'Kopia zapasowa nieudana',
  dec_type_KSH_DATES_CHECK: 'Daty KSH do sprawdzenia',
  dec_type_DELIVERED_CHECK: 'Wyjazd z placu po krótkim postoju — czy dostarczono?',
  dec_type_DELIVERY_UNCONFIRMED: 'Potwierdź dostawę — doba po planowanej dostawie bez „Dostarczone”',
  dec_type_CMR_UPLOAD: 'Wgraj CMR z podpisem odbiorcy',
  dec_opt_NEXT_SAME: 'Następny rejs tego armatora',
  dec_opt_OTHER_OPERATOR: 'Rejs drugiego armatora',
  dec_opt_HOLD: 'Wstrzymaj',
  dec_opt_NOTIFY_KSH: 'Powiadom KSH z nową ETA',
  dec_opt_ACCEPT_SILENT: 'Przyjmij bez powiadomienia',
  dec_opt_ESCALATE_CARRIER: 'Eskaluj do przewoźnika',
  dec_opt_ACCEPT: 'Przyjmuję',
  dec_opt_PROPOSE_DATE: 'Proponuję inny termin',
  dec_opt_ESCALATE_HHL: 'Eskaluj do HHL',
  dec_opt_ADD_AWIZACJA: 'Dodaj awizację',
  dec_opt_REPORT_PROBLEM: 'Zgłoś problem',
  dec_opt_ADD_PERMIT: 'Dodaj zezwolenie',
  dec_opt_CANCEL_WARN_FEE: 'Anuluj (ostrzeżenie o opłacie)',
  dec_opt_KEEP_ASK_KSH: 'Zostaw i zapytaj KSH',
  dec_opt_KEEP_TOWER: 'Wartość z Watch Tower',
  dec_opt_TAKE_FILE: 'Wartość z pliku',
  dec_opt_ASK_FIX: 'Poproś KSH o poprawkę',
  dec_opt_SKIP_ROW: 'Pomiń wiersz',
  dec_opt_MANUAL_STATUS: 'Podaj status ręcznie',
  dec_opt_DETOUR_OK: 'Objazd uzgodniony',
  dec_opt_EXTEND_14D: 'Uzgodnij rozszerzenie (14 dni)',
  dec_opt_LAST_MULT: 'Ostatni mnożnik',
  dec_opt_DISPUTE: 'Spór',
  dec_opt_PRICE_AS_3: 'Cena jak dla 3',
  dec_opt_MANUAL_PRICE: 'Cena ręczna',
  dec_opt_UPLOAD_POLICY: 'Wgraj nową polisę',
  dec_opt_ADD_FEE: 'Dodaj dopłatę uzgodnioną',
  dec_opt_NOT_APPLICABLE: 'Nie dotyczy',
  dec_opt_RETRY_NOW: 'Ponów kopię',
  dec_opt_REPORT: 'Zgłoś',
  dec_opt_DATES_OK: 'Daty są dobre',
  dec_opt_STILL_EN_ROUTE: 'Jeszcze w drodze — przypomnij jutro',
  dec_opt_DELIVERED_YES: 'Tak, dostarczono',
  dec_opt_DELIVERED_NO: 'Nie',
  dec_opt_UPLOAD_CMR: 'Wgraj CMR',
};

export const DEC_I18N: Record<Locale, Dict> = { pl, en: {}, sv: {} };

export function decText(locale: Locale, key: string | null | undefined, fallback?: string): string {
  if (!key) return fallback ?? '';
  return DEC_I18N[locale][key] ?? DEC_I18N.pl[key] ?? fallback ?? key;
}
