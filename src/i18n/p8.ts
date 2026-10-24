/**
 * wyglad/P8-a — teksty ekranu „Treści wiadomości” (E43; img/e43-after). Interfejs tylko po polsku (E43).
 */
const pl = {
  p8_title: 'Treści wiadomości',
  p8_who_link: 'Odbiorców ustawisz w Powiadomienia › Kto co dostaje',
  p8_default: 'domyślna',
  p8_changed: 'zmieniono {d} · {who}',
  p8_changed_short: 'zmieniono {d}',
  p8_draft: 'niezapisane zmiany',
  p8_loading: 'Wczytywanie treści…',
  p8_list_note: 'Pełna lista: 4 SMS + 34 rodzaje e-maili i powiadomień w dzwonku + 2 e-maile paczki do księgowości + 5 e-maili logowania. Wszystko tylko po polsku. Każda pozycja ma „domyślna” albo „zmieniono [data] · [osoba]”. Kanały i odbiorców ustawia się w „Kto co dostaje”.',
  p8_pl_only: 'Treść tylko po polsku — każdy odbiorca, także w Boden, dostaje tę samą wersję (decyzja 22:42).',
  p8_subject: 'Temat',
  p8_subject_note: 'Temat jest też tytułem wpisu w dzwonku.',
  p8_body: 'Treść',
  p8_insert: 'Wstaw dane',
  p8_insert_phone: 'Wstaw dane (przewiń w bok)',
  p8_insert_aria: 'Wstaw klocek: {label}',
  p8_count_ok: '{n} / 160 znaków',
  p8_count_over: '{n} / 160 znaków — skróć treść',
  p8_count_note: 'Polskie litery zostaną zamienione (ą → a), bo SMS ma 160 znaków tylko bez nich.',
  p8_preview: 'Podgląd na prawdziwym transporcie',
  p8_preview_phone: 'Podgląd',
  p8_preview_note: 'Kod transportu w każdej firmie: HHL „XX-00 · nr zlecenia HHL”, SCX „XX-00 · nr SCX”, KSH „XX-00”. W SMS zawsze sam kod.',
  p8_save: 'Zapisz',
  p8_test_s: 'Wyślij próbny SMS na mój numer',
  p8_test_s_phone: 'Próbny SMS',
  p8_test_email: 'Wyślij próbny e-mail na mój adres',
  p8_test_email_phone: 'Próbny e-mail',
  p8_reset: 'Przywróć domyślną treść',
  p8_history_note: 'Zmiana trafia do Historii zmian (kto, kiedy, było → jest).',
  p8_help: 'Dane wstawia się przyciskami. Każde pole jest jednym klockiem: nie da się go popsuć, a Backspace usuwa cały klocek. Lista przycisków zależy od wiadomości, np. przy fakturze są Numer faktury, Kwota i Termin. Gdy danej brakuje (np. naczepy), w wiadomości jest „—”, a podgląd to pokazuje.',
  p8_help_login: 'Przycisk z linkiem jest zawsze w treści i nie da się go usunąć — bez niego zapis jest zablokowany, bo osoba nie mogłaby się zalogować. Klocki wstawiają dane bez odmiany (np. „Anna Nowak”), więc tekst wokół pisze się tak, żeby pasował.',
  p8_saved: 'Zapisano. Następna wiadomość wyjdzie z tą treścią.',
  p8_reset_done: 'Przywrócono treść domyślną.',
  p8_test_done_s: 'Wysłano próbny SMS na Twój numer.',
  p8_test_done_email: 'Wysłano próbny e-mail na Twój adres.',
  p8_fail: 'Nie udało się. Spróbuj ponownie.',
  p8_err_empty: 'Treść nie może być pusta.',
  p8_err_subject: 'Temat nie może być pusty.',
  p8_err_sms_long: 'SMS ma więcej niż 160 znaków — skróć treść.',
  p8_err_sms_chars: 'Znaki spoza alfabetu SMS ({chars}) — usuń je albo zamień.',
  p8_count_worst: 'Przy najdłuższych danych (np. rejestracji): {n} / 160 — skróć treść.',
  p8_err_no_button: 'Przycisk z linkiem musi być w treści — wstaw go przyciskiem „+ Przycisk z linkiem”.',
  p8_ro: 'Tylko podgląd · zmienia Administrator HHL',
  p8_ro_prod: 'Treści domyślne. Zmiana treści włączy się po aktualizacji serwera (P8).',
  p8_prod_store: 'Zapisana treść jest w bazie z Historią zmian. Wiadomości wychodzą jeszcze z treścią domyślną — zapisana zacznie obowiązywać po aktualizacji wysyłki (P8).',
  p8_prod_login: 'Zapisana treść jest w bazie z Historią zmian. E-maile logowania wysyła jeszcze usługa logowania z treścią domyślną — zapisana zacznie obowiązywać po aktualizacji wysyłki (P8).',
  p8_back: 'Wróć do listy wiadomości',
  p8_email_note: 'E-mail i wpis w dzwonku mają tę samą treść.',
  p8_pack_note: 'Tylko e-mail, z załącznikami: faktura, CMR z podpisem i zestawienie. Powyżej 25 MB wychodzi w częściach („część 1 z 2”).',
} as const;

export type P8Key = keyof typeof pl;

export function p8t(key: P8Key, vars?: Record<string, string | number>): string {
  let s: string = pl[key];
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

export const P8_PL = pl;
