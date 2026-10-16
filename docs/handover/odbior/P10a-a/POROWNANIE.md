# wyglad/P10a-a — E22: nowa wersja, „na żywo”, zamiast pustej strony (16.10.2026, 04:30)

Podstawa:
- E22 („Propozycja — do akceptacji, bez pytań”), makieta `E22/przel.html` „Po zmianie”;
- PLAN §4 P10a;
- dane do podłączenia: D-20261016-0430-01.

Wygląd, teksty i nawigacja (F8). Bez zapisów i zapytań.

| Element | Było | Jest |
|---|---|---|
| Nowa wersja po wdrożeniu | komunikat tylko przy zmianie `sw.js` („Dostępna nowa wersja — odśwież”) | pasek pod paskiem górnym: **„Jest nowa wersja Watch Tower.** Odśwież, kiedy skończysz to, co robisz. Nic się nie zgubi.” + „Odśwież teraz” (telefon: przycisk 44 px) |
| Świeżość danych | — | przy tytule Harmonogramu, Mapy i Ryzyk: „● na żywo · 16:32”; bez sieci czerwone „brak połączenia od 16:30” |
| Część, która się nie wczyta | pusta strona, bez paska i menu | w miejscu części: „Ta część aplikacji zmieniła się po aktualizacji · Odśwież stronę, żeby ją otworzyć. Twoje zapisane dane są bezpieczne. · Odśwież”; pasek górny, pasek etapów i menu zostają |

**Produkcja przed podłączeniem:** paska i znacznika nie ma (`p10aSource`: `false` / `null`). Komunikat w miejscu części działa od razu.

**Demo:**
- pasek przy `&nowa-wersja=1` w adresie;
- znacznik z godziny „teraz” i stanu sieci przeglądarki.

**Sprawdzone:**
- e2e blok P10a-a — 3/3:
  - pasek i znacznik, także bez sieci;
  - plik Ryzyk zablokowany → komunikat, pasek i menu widoczne;
  - telefon — 0 w bramie E8;
- regresja: pasek górny, P6 Ryzyka;
- unit `p10a-look` — 2;
- pierwsze wczytanie: 397,6 kB gzip samodzielnie; razem z #240 (panel transportu ładowany osobno) ok. 378 kB.

**Zrzuty:**
- `nowa-wersja-na-zywo-1440.webp`
- `czesc-nie-wczytana-1440.webp`
- `nowa-wersja-390.webp`
