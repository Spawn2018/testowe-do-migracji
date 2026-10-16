# wyglad/push-telefon — Dla mnie › Ten telefon / komputer (15.10.2026, 20:10)

Podstawa: E5 (raport audytu, `img/e5-desk`, `img/e5-phone`); polecenie właściciela 15.10.2026, 19:43 („powiadomienia muszą działać bez względu na rodzaj Androida i telefonu, także iOS”); dopisek `D-20261015-1955-01` (F1–F10, W42 = e-mail, W43).

| Element E5 | Było | Jest |
|---|---|---|
| Instrukcja iPhone (4 kroki), Android (1 krok) | jak w E5 | bez zmian |
| — | — | „Samsung i inne Androidy · gdy powiadomienie nie przychodzi” (3 kroki: powiadomienia aplikacji, bateria bez ograniczeń, poza „Uśpionymi aplikacjami”) |
| „Włącz powiadomienia” | prośba o zgodę po `await import(…)`; błąd zostawiał przyciski nieaktywne | moduł ładowany przy otwarciu ekranu, przycisk aktywny po wczytaniu; prośba o zgodę od razu po dotknięciu (iPhone, F10); każdy błąd → „Nie udało się…”, przyciski wracają |
| — | — | „Sprawdź ten telefon”: przeglądarka, iPhone z ekranu początkowego, zgoda, urządzenie zapisane, test doszedł — ✓ / ✗ / • / – z podpowiedzią dla Androida, iPhone’a albo komputera; iPhone w karcie Safari: jedyny problem „ekran początkowy”; iPhone bez Push API z ekranu → „iOS 16.4” |
| Twoje urządzenia: „aktywne” | zawsze „aktywne” | po kolumnie `last_ack_at` (C16 N7): „działa · potwierdzenie 15.10, 19:52” (zielone, potwierdzenie z 7 dni), „ostatnie potwierdzenie …” (starsze) albo „bez potwierdzenia”; do tego czasu „aktywne” |
| „Wyślij powiadomienie testowe” | „Wysłane…” albo „Nie udało się. Spróbuj ponownie.” | powód po polsku (wygasło, błąd usługi, brak połączenia z serwerem…); po C16 N3: „Wysłano o 19:52. Czekam na potwierdzenie…” → „Doszło na urządzenie o 19:52 (po 3 s)” albo „Urządzenie nie potwierdziło odbioru w ciągu 15 sekund…”; „doszło” = potwierdzenie nowsze niż to sprzed dotknięcia (bez porównywania zegarów); drugi test na tym samym urządzeniu dopiero po wyniku pierwszego |
| Zasada | „Na telefon trafia tylko pilna sprawa…” | bez zmian; zdanie o e-mailu zapasowym (W42) koordynator dopisze po odbiorze C16 N4 |
| Ikona powiadomienia | — | `public/brand/badge-96.png` (biała sylwetka wieży, dla `badge` w `sw.js`, C16 N5) |

Sprawdzone (podgląd demo, 1440 / 390 / 360 px, motyw jasny i ciemny): axe WCAG 2 A/AA na ekranie — 0; przewijanie w poziomie — 0; tekst < 12 px — 0; przyciski < 44 px na telefonie — 0.

Zrzuty: `dev-1440-light.webp`, `dev-390-dark.webp`.
