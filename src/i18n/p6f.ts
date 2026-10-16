/**
 * wyglad/P6-f — Dla mnie › Ten telefon / komputer: aplikacja zainstalowana, „Zainstaluj aplikację”, wiadomości z Czatu
 * w powiadomieniu (D-20261016-0310-01 Cz19 pkt 5, Cz23 pkt 4–5; D-20261016-0315-01 Cz32). Tylko po polsku (E43).
 */
const pl = {
  p6f_app: 'Aplikacja na tym telefonie',
  p6f_app_app: 'Działasz w zainstalowanej aplikacji. Dotknięcie powiadomienia otworzy tę aplikację.',
  p6f_app_can: 'Watch Tower nie jest zainstalowany — dotknięcie powiadomienia otworzy przeglądarkę.',
  p6f_app_installed: 'Zainstalowano. Uruchamiaj Watch Tower z ikony na ekranie — wtedy powiadomienia otworzą aplikację.',
  p6f_app_browser: 'Otwierasz Watch Tower w przeglądarce. Jeśli aplikacja jest zainstalowana, uruchamiaj ją z ikony na ekranie — wtedy dotknięcie powiadomienia otworzy aplikację, nie przeglądarkę.',
  p6f_install: 'Zainstaluj aplikację',
  p6f_install_no: 'Instalacja przerwana. Możesz zainstalować później.',
  p6f_samsung: 'Samsung: instaluj z Chrome (⋮ → „Dodaj do ekranu głównego” → „Zainstaluj”), nie z Samsung Internet. Skrót z innej przeglądarki otwiera powiadomienia w Chrome.',
  p6f_chat: 'Wiadomości z Czatu w powiadomieniu',
  p6f_chat_1: 'Tytuł: nazwa transportu i kto napisał (Imię Nazwisko // firma); pod spodem treść wiadomości.',
  p6f_chat_2: '„Oznacz jako odczytane” — bez otwierania aplikacji; autor zobaczy, kto i kiedy przeczytał.',
  p6f_chat_3: '„Odpowiedz” — wpisujesz odpowiedź od razu w powiadomieniu; idzie do tych samych odbiorców co wiadomość.',
  p6f_chat_4: 'iPhone pokazuje powiadomienie bez przycisków — dotknij go i odpisz w Czacie.',
  p6f_chat_5: 'Treść na zablokowanym ekranie: ustawienia telefonu → Powiadomienia → „Ukryj treść na ekranie blokady”.',
  p6f_chat_6: 'Rozmowy „tylko HHL i SCX” nie trafiają do KSH — ani w dzwonku, ani na telefon.',
} as const;

export type P6fKey = keyof typeof pl;
export const ft = (key: P6fKey): string => pl[key];
export const P6F_PL = pl;
