# wyglad/W-naprawy-2 — wygląd pod naprawy A5, A6, A8, A9 i C11 — 17.10.2026

Podstawa: D-20261017-0730-01 §2 (A5, A6, A8, A9) i „C4–C13” (C11); decyzje 17.10, 07:20 (4B — link śledzenia nie blokuje). Dopisek: D-20261017-1715-01.
Wygląd, teksty i obliczenia widoku (F8). Dane, parser importu i reguły w bazie — wykonawca w A5, A6, A8, A9 i C11. Pola, które ma wypełnić wykonawca, są opcjonalne: bez nich widok wygląda jak dziś.

| Miejsce | Było | Jest |
|---|---|---|
| Logowanie, „Ustaw hasło” i Moje konto (C11) | „Hasło musi mieć co najmniej 12 znaków” — sprawdzana tylko długość („111111111111” przechodziło) | „Hasło musi mieć co najmniej 12 znaków, w tym litery i cyfry.”; hasło bez liter albo bez cyfr → ten komunikat i hasło się nie zmienia |
| „Gotowy” — braki (oś Status, okno „Zmień status”, Kokpit, A9) | brak rejsu nie był brakiem; przy przepięciu naczepy brakował tylko „ciągnik SE” | „Brakuje: rejs · …” (uzupełnia SCX w Awizacji); przy przepięciu także „kierowca SE” i „telefon SE”. Ta sama lista co `awiz_missing(load)` w A9 — po A9 produkcja bierze listę z bazy (`load.readyGaps`) |
| Harmonogram › Więcej › Wgraj aktualizację — podgląd (A6) | „2/2 OK · ⚠0”, potem „+1 · ~1 · −0 · ⚠0” | „wczytano 2 z 2 wierszy” (ostrzeżenia słowami, tylko gdy są); „Nowe: 1 · Zmienione: 1 · Do usunięcia: 0 · Odrzucone: 0” |
| Ten sam podgląd — wiersze pominięte (A6, gdy parser poda liczby) | brak — pominięte wiersze NTG i puste ginęły albo dawały błędy | „Pominięte: inny przewoźnik (NTG) — 43 · puste wiersze — 15.” |
| Ten sam podgląd — daty KSH (A6 pkt 2, gdy parser poda liczbę) | wiersz „dostawa przed załadunkiem” odrzucony (KR-03) | „Daty KSH do sprawdzenia: 1 — wiersze wchodzą, a HHL i KSH dostają sprawę w „Do zrobienia”.” |
| Opcje › System › Stan systemu — źródło „Nie działa” (A8) | „Nie działa od 07:15 · 9 h 17 min” — nie wiadomo, kiedy kolejna próba | dodatkowo „następna próba o 18:07” (inny dzień — z datą); na telefonie w tej samej linii. Na produkcji z `skipped_until` emtrack po A8 |

Obrazy (`now=2026-09-23T14:32Z`):
- `po-stan-systemu.webp` — komputer 1440: „Ceny paliwa · Nie działa · od 07:15 · 9 h 17 min · następna próba o 18:07”;
- `po-stan-telefon.webp` — telefon 390: ta sama informacja w linii karty;
- `po-import.webp` — podgląd importu słowami (dwa wiersze: nowy i zmieniony);
- `po-gotowy-scx.webp` — SCX, D-02, „Zmień status → Gotowy”: „Brakuje: rejs · polisa OCP SCX · zezwolenie”.

Bez obrazu: wiersze „Pominięte …” i „Daty KSH do sprawdzenia …” pokazują się dopiero, gdy parser wykonawcy (A6) poda liczby (`ImportDiff.skippedCarrier`, `skippedEmpty`, `datesToCheck`); tekst sprawdza test jednostkowy.

Testy:
- `tests/w-naprawy-2.test.ts` — `passwordOk` (litery i cyfry), komunikat hasła, brak „rejs” i „kierowca SE” / „telefon SE”, podsumowanie importu z odmianą, zdanie „Pominięte: …”, „następna próba” w danych demo;
- `tests/auth-password.test.ts` — reguła hasła;
- e2e: `etap4-ui` (D26 import, M5, M6, M10), `e8-phone-gate` (P10b-c Stan systemu komputer i telefon, P4-b, P4-c „Gotowy”, P7-a Awizacja, P7-c, P7-d) — 33/33.
