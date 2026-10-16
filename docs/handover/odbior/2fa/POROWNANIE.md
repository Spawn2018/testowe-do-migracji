# wyglad/2fa — Moje konto › urządzenia 2FA, Przełączniki › wymaganie 2FA dla administratorów (16.10.2026, 04:05)

Podstawa:
- D-20261014-1420-01, część „Koordynator”: w „Moje konto” lista urządzeń 2FA z „Dodaj drugie urządzenie” i „Usuń”; w „Przełącznikach” wymaganie 2FA dla administratorów; w Podglądzie pola i przyciski nieaktywne;
- I-17 (drugie urządzenie przed wymaganiem);
- E12, E19, E37, W38;
- dane do podłączenia: D-20261016-0405-01.

Wygląd, teksty i nawigacja (F8). Bez zapisów. Po podłączeniu panel tymczasowy `MyMfa` (R2) znika.

| Element | Było | Jest |
|---|---|---|
| Moje konto › 2FA (włączona) | tylko „Włączona”; urządzenia, drugie urządzenie i usuwanie w osobnym panelu `MyMfa` pod ekranem | „Urządzenia z kodem 2FA”: nazwa i „od 12.10.2026”. Przy 1 urządzeniu: „Dodaj drugie urządzenie” z powodem („gdy zgubisz telefon…”) i „Ostatniego urządzenia nie usuniesz”. Przy 2 i więcej: „Usuń” z pytaniem „Usunąć urządzenie »…«?” |
| Sesja bez kodu 2FA | — | przyciski nieaktywne i zdanie „Dodawanie i usuwanie urządzeń — po zalogowaniu kodem z aplikacji” |
| Podgląd (W38) | pola edytowalne | pola tylko do odczytu, przyciski nieaktywne, „Podgląd — nic tu nie zapiszesz.” |
| Przełączniki › „2FA wymagane dla Administratorów HHL” | przełącznik zawsze aktywny | gdy wymaganie jest wyłączone, a konto nie ma 2FA na dwóch urządzeniach albo sesja jest bez kodu: przełącznik nieaktywny z powodem pod nazwą (wyłączenie zawsze możliwe) |

**Sprawdzone:**
- e2e blok `wyglad/2fa` — 2/2: komputer HHL; telefon HHL — 0 w bramie E8;
- regresja P3-c;
- unit `mfa2-look` i całość: 147 plików;
- pierwsze wczytanie 396,3 kB gzip.

**Zrzuty:**
- `moje-konto-2fa-1440.webp`
- `przelaczniki-2fa-1440.webp`
