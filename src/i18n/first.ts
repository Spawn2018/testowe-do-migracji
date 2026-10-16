/**
 * wyglad/P10b-d — teksty pierwszego wejścia (E37 pkt 9, makieta `makiety_html/E37/pasek.html`
 * „Po zmianie · telefon · zaproszona osoba (link → hasło → pierwsze wejście)”). Interfejs po polsku (E43), bez kodów.
 */
import type { Locale } from '../types';
import { t } from './messages';

const PL: Record<string, string> = {
  fe_step: '{n} z {total}',
  fe_steps_aria: 'Krok {n} z {total}',
  fe_inv_title: 'Zaproszenie do Watch Tower',
  fe_inv_by: '{who} z {company} zaprasza Cię do systemu kontroli transportów Śrem → Boden.',
  fe_inv_general: 'Zaproszenie do systemu kontroli transportów Śrem → Boden.',
  fe_inv_person: 'Osoba',
  fe_inv_company: 'Firma',
  fe_inv_account: 'Konto',
  fe_inv_next: 'Dalej — ustaw hasło',
  fe_inv_note: 'Zaproszenie otwiera się dopiero po „Dalej” — tak chronimy link przed programami, które sprawdzają pocztę.',
  fe_inv_cancel: 'Anuluj',
  fe_pw_title: 'Ustaw hasło',
  fe_pw: 'Hasło',
  fe_pw_repeat: 'Powtórz hasło',
  fe_pw_len_ok: '{n} znaków — dobrze (min. {min})',
  fe_pw_len_short: '{n} znaków — za mało (min. {min})',
  fe_pw_len_empty: 'Co najmniej {min} znaków, litery i cyfry',
  /* wyglad/audyt-E (E-12; E19 decyzja 1 A): litery i cyfry */
  fe_pw_no_digit: '{n} znaków — brak cyfry (min. {min} znaków, litery i cyfry)',
  fe_pw_no_letter: '{n} znaków — brak litery (min. {min} znaków, litery i cyfry)',
  fe_pw_same: 'Hasła są takie same',
  fe_pw_diff: 'Hasła się różnią',
  fe_pw_save: 'Zapisz hasło',
  fe_pw_show: 'Pokaż',
  fe_pw_hide: 'Ukryj',
  fe_pw_saving: 'Zapisuję…',
  fe_pw_note: 'Dalej logujesz się e-mailem i hasłem. Sesja na tym urządzeniu trwa do roku.',
  fe_det_title: 'Twoje dane',
  fe_det_missing: 'Na Twoim koncie nie ma jeszcze telefonu. Uzupełnij go, żeby przejść dalej.',
  fe_det_first: 'Imię',
  fe_det_last: 'Nazwisko',
  fe_det_phone: 'Telefon (wymagany)',
  fe_det_cc: 'Kierunkowy',
  fe_det_cc_PL: '+48 Polska',
  fe_det_cc_SE: '+46 Szwecja',
  fe_det_number: 'Numer',
  fe_det_phone_note: 'Widzą go osoby, które prowadzą Twoje sprawy.',
  fe_det_name_bad: 'Wpisz imię i nazwisko.',
  fe_det_phone_bad: 'Wpisz numer telefonu: 7–11 cyfr, bez kierunkowego.',
  fe_det_fail: 'Nie udało się zapisać. Spróbuj za chwilę.',
  fe_det_next: 'Dalej',
  fe_det_save: 'Zapisz i przejdź dalej',
  fe_det_saving: 'Zapisuję…',
  fe_nt_title: 'Powiadomienia i telefon',
  fe_nt_gets: 'Dostajesz:',
  fe_nt_more: 'i {n} innych — pełna lista w „Dla mnie”.',
  fe_nt_none: 'Na razie nic nie przychodzi na Twoje konto — ustawia to Administrator HHL w „Kto co dostaje”.',
  fe_nt_push_phone: 'Włącz powiadomienia na tym telefonie',
  fe_nt_push_desk: 'Włącz powiadomienia na tym komputerze',
  fe_nt_push_busy: 'Włączam…',
  fe_nt_push_ok: 'Powiadomienia włączone na tym urządzeniu.',
  fe_nt_push_denied: 'Przeglądarka nie pozwoliła na powiadomienia. Zmienisz to w ustawieniach przeglądarki.',
  fe_nt_push_unsupported: 'Ta przeglądarka nie pokazuje powiadomień.',
  fe_nt_push_fail: 'Nie udało się włączyć powiadomień. Spróbuj później w „Dla mnie › Ten telefon”.',
  fe_nt_ios_1: 'iPhone: najpierw ',
  fe_nt_ios_b: 'Udostępnij → Dodaj do ekranu głównego',
  fe_nt_ios_2: ', potem otwórz Watch Tower z ikony.',
  fe_nt_android: 'Android:',
  fe_nt_android_menu: 'Android: w Chrome ⋮ → „Dodaj do ekranu głównego” → „Zainstaluj”, potem otwórz Watch Tower z ikony.',
  fe_nt_app: 'Watch Tower działa jako aplikacja na tym telefonie.',
  fe_nt_installed: 'Zainstalowano. Uruchamiaj Watch Tower z ikony na ekranie.',
  fe_nt_later: 'Możesz to zrobić później: Menu konta › Dla mnie › Ten telefon.',
  fe_nt_start: 'Zaczynam',
};

export function fe(locale: Locale, key: string): string {
  return PL[key] ?? t(locale, key);
}

export function fep(locale: Locale, key: string, params: Record<string, string | number>): string {
  let s = fe(locale, key);
  for (const [k, v] of Object.entries(params)) s = s.split(`{${k}}`).join(String(v));
  return s;
}
