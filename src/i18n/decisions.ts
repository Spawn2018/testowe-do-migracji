/** DEC-2 — etykiety typów i opcji decyzji (katalog 0102). */
import type { Locale } from '../types';

type Dict = Record<string, string>;

const pl: Dict = {
  dec_type_FERRY_CANCELLED: 'Rejs odwołany albo sztorm na trasie',
  dec_type_ETA_AFTER_LATEST: 'ETA po godzinie „najpóźniej do”',
  dec_type_KSH_DATE_LT_5D: 'KSH zmieniło datę < 5 dni przed załadunkiem',
  dec_type_KSH_DATE_COUNTER: 'Propozycja innego terminu',
  dec_type_NO_AWIZACJA: 'Brak awizacji w terminie',
  /* D-20261020-1501-01: rejs i link śledzenia nieobowiązkowe przy zapisie awizacji — ich brak to sprawa do zamknięcia */
  dec_type_NO_SAILING: 'Brak rejsu promu w awizacji',
  dec_type_NO_TRACKING: 'Brak linku śledzenia',
  /* D-20261020-1525-01: Odcinek SE — kierowca SE najpóźniej 48 h przed dostawą */
  dec_type_NO_AWIZ_SE: 'Brak awizacji kierowcy SE (48\u00a0h przed dostawą)',
  dec_type_DOC_MISSING: 'Brak zezwolenia lub dokumentu przed „Gotowy”',
  dec_type_KSH_ROW_GONE: 'Wiersz zniknął z pliku KSH',
  dec_type_TOWER_KSH_CONFLICT: 'Konflikt Watch Tower ↔ plik KSH',
  dec_type_KSH_FILE_ERROR: 'Błąd w pliku KSH',
  dec_type_NO_POSITION: 'Brak pozycji auta w drodze',
  dec_type_ROUTE_DEVIATION: 'Zjazd z trasy z zezwolenia',
  dec_type_SEFS_OUT_OF_TABLE: 'Opłata paliwowa: cena poza tabelą albo awaria źródła',
  dec_type_SEFS_INVOICE_DIFF: 'Opłata paliwowa na fakturze ≠ wyliczona',
  /* #563: korekta ceny w zamkniętym tygodniu — bez cichego przeliczenia migawek */
  dec_type_SEFS_WEEK_CORR: 'Korekta ceny paliwa zmienia mnożnik zamkniętego tygodnia',
  dec_type_KR_OVER_3: 'Ponad 3 kratownice jednego dnia',
  dec_type_INSURANCE_EXPIRING: 'Polisa przewoźnika wygasa',
  dec_type_DWELL_OVER_FREE: 'Zmierzony postój ponad czas wolny',
  dec_type_BACKUP_FAILED: 'Kopia zapasowa nieudana',
  /* #581 P4-k / 27A: auto-kalibracja ETA > 15 % — zatwierdzenie HHL */
  dec_type_ETA_CALIBRATION_APPROVAL: 'Kalibracja ETA wymaga zatwierdzenia',
  dec_opt_APPLY_ETA_CALIB: 'Zastosuj nowe czasy odcinków',
  dec_opt_REJECT_ETA_CALIB: 'Odrzuć propozycję',
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
  dec_opt_REJECT_DATE: 'Odrzucam — zostaje data KSH',
  /* #384 pkt 5 — formularz „Proponuję inny termin” */
  dec_prop_title: 'Proponowany termin',
  dec_ksh_props_title: 'Propozycje innego terminu od Scandinavian Express',
  dec_ksh_accept_confirm: 'Po przyjęciu daty planu zmienią się na:',
  dec_ksh_confirm_yes: 'Tak, przyjmuję',
  dec_ksh_confirm_no: 'Anuluj',
  dec_ksh_done_accept: 'Przyjęto propozycję — daty planu zmienione, przewoźnik zostanie powiadomiony.',
  dec_ksh_done_other: 'Odpowiedź wysłana.',
  dec_prop_load_date: 'Data załadunku',
  dec_prop_load_time: 'Godzina załadunku (PL)',
  dec_prop_del_date: 'Data dostawy',
  dec_prop_del_time: 'Godzina dostawy (SE)',
  dec_prop_hint: 'Propozycja trafi do KSH do przyjęcia albo odrzucenia. Daty planu zmienią się dopiero po przyjęciu przez KSH.',
  dec_prop_send: 'Wyślij propozycję do KSH',
  dec_prop_err_NO_LOAD_DATE: 'Podaj datę załadunku.',
  dec_prop_err_PAST: 'Proponowany załadunek musi być najwcześniej jutro.',
  dec_prop_err_DELIVERY_BEFORE_LOAD: 'Dostawa nie może być przed załadunkiem.',
  dec_prop_err_BAD_FORMAT: 'Sprawdź format daty i godziny.',
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
  /* #590/#592 — import KSH: zmiana przewoźnika w pliku, usunięty transport wrócił w pliku */
  dec_type_KSH_CARRIER_CHANGED: 'Zmiana przewoźnika w pliku KSH',
  dec_opt_CARRIER_CANCEL: 'Anuluj transport',
  dec_opt_CARRIER_REMOVE: 'Usuń z harmonogramu',
  dec_opt_CARRIER_SNOOZE: 'Odłóż o 2\u00a0h',
  dec_type_KSH_REMOVED_BACK: 'Usunięty transport wrócił w pliku KSH',
  dec_opt_REMOVED_KEEP: 'Zostaw usunięty',
  dec_opt_REMOVED_RESTORE: 'Przywróć do harmonogramu',
  dec_confirm_CARRIER_CANCEL: 'Transport zostanie anulowany — przewoźnik i KSH zobaczą go jako anulowany. Na pewno?',
  dec_confirm_CARRIER_REMOVE: 'Transport zniknie z harmonogramu wszystkich firm (HHL, SCX, KSH). Działa tylko przed załadunkiem. Przywrócić go może wyłącznie administrator HHL. Na pewno?',
  dec_confirm_REMOVED_RESTORE: 'Transport wróci do harmonogramu z poprzednim statusem. Na pewno?',
  dec_confirm_yes: 'Tak, potwierdzam',
  dec_confirm_back: 'Wróć',
  dec_err_unknown_option: 'Ta opcja nie jest obsługiwana na tym ekranie — nic nie zmieniono.',
  dec_err_no_load: 'Decyzja nie wskazuje transportu — nic nie zmieniono.',
  dec_err_restore_admin: 'Przywrócić transport może tylko administrator HHL — decyzja zostaje otwarta.',
  dec_err_stale: 'Ta decyzja jest już nieaktualna — lista została odświeżona, nic nie zmieniono.',
  dec_err_forbidden: 'Brak uprawnień do tego rozstrzygnięcia — decyzja zostaje otwarta.',
  /* W-604 (0320): błędy kalibracji ETA przy rozstrzygnięciu ETA_CALIBRATION_APPROVAL */
  dec_err_ETA_NOT_ADMIN: 'Kalibrację ETA zatwierdza tylko Administrator HHL — decyzja zostaje otwarta.',
  dec_err_ETA_APPLY_NEWER: 'Jest już nowsza zastosowana wersja kalibracji z tymi odcinkami — tej nie da się zastosować. Odrzuć propozycję.',
  dec_err_ETA_UNDO_NEWER: 'Najpierw trzeba cofnąć nowszą wersję kalibracji z tymi odcinkami — nic nie zmieniono.',
  dec_err_ETA_BUSY: 'Kalibracja ETA jest właśnie zapisywana — spróbuj za chwilę. Decyzja zostaje otwarta.',
  dec_err_ETA_FROZEN: 'Kalibracja ETA jest zamrożona — nowych czasów nie da się zastosować. Odmroź w Opcjach albo odrzuć propozycję.',
  dec_err_ETA_UNDO_MISSING: 'Ta wersja kalibracji nie jest już zastosowana — nic nie zmieniono.',
  dec_err_ETA_UNDONE: 'Ta wersja kalibracji została cofnięta — nie da się jej zastosować ponownie. Odrzuć propozycję.',
  dec_err_ETA_APPLY_MISSING: 'Tej wersji kalibracji nie ma już w bazie — odrzuć propozycję.',
  /* W-604: wiersz karty decyzji kalibracji (detail: version, max_change_pct) */
  dec_eta_calib_title: 'Kalibracja ETA',
  /* W-604: opcje APPLY / REJECT bez typu decyzji (historia) — ogólne słowa */
  dec_opt_APPLY: 'Zastosuj',
  dec_opt_REJECT: 'Odrzuć',
};

export const DEC_I18N: Record<Locale, Dict> = { pl, en: {}, sv: {} };

/** Opcja o tym samym kodzie w kilku typach decyzji — etykieta z katalogu typu (`label_key` w `decision_types.options`). */
const OPT_BY_TYPE: Record<string, Record<string, string>> = {
  ETA_CALIBRATION_APPROVAL: { APPLY: 'dec_opt_APPLY_ETA_CALIB', REJECT: 'dec_opt_REJECT_ETA_CALIB' },
  KSH_DATE_COUNTER: { REJECT: 'dec_opt_REJECT_DATE' },
};

/** W-604: etykieta wybranej opcji w historii — najpierw z typu decyzji, potem `dec_opt_<kod>`; '' — brak etykiety. */
export function decOptText(locale: Locale, option: string, typeCode?: string | null): string {
  const byType = typeCode ? OPT_BY_TYPE[typeCode]?.[option] : undefined;
  if (byType) return decText(locale, byType, '');
  return decText(locale, `dec_opt_${option}`, '');
}

export function decText(locale: Locale, key: string | null | undefined, fallback?: string): string {
  if (!key) return fallback ?? '';
  return DEC_I18N[locale][key] ?? DEC_I18N.pl[key] ?? fallback ?? key;
}
