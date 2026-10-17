# wyglad/W-przed-wydaniem-1 — dwie poprawki z odbioru wyglądu przed wydaniem — 17.10.2026

Podstawa: `ODBIOR_WYGLADU_PRZED_WYDANIEM.md` › „Do poprawy przed wydaniem” (uwagi niezależnego sprawdzenia F7 do #295, 17.10 — to samo na `main`); E8 (telefon: karty tabel, nic nie łamie się w środku liczby ani numeru).
Tylko wygląd (F8). Bez zmian w danych, bazie i tekstach.
PR stoi na #295 (`wyglad/W-faktura-termin`): scalić po #295.

| Miejsce | Było | Jest |
|---|---|---|
| Strefy, konto HHL: komputer (1440, 1280) i telefon (390, 360 — karta strefy z historią zmian, np. „Plac budowy Stegra Boden”, „Terminal Polferries Gdańsk”) | dokument wyższy od okna (komputer: 1031 px przy 900, 1083 px przy 800; telefon: 1237 px przy 844, 1239 px przy 740): dwa ukryte teksty dla czytników ekranu („— Pokaż kształt sprzed zmiany: …”, `.sr-only`, pozycja absolutna) liczyły się do całego dokumentu, nie do przewijanego obszaru treści, więc dokument dostawał własny pasek przewijania | `.zv{position:relative}` — ukryte teksty należą do obszaru treści; dokument = okno (900 / 800 / 844 / 740 px); obszar treści i karta strefy na telefonie przewijają się jak przed; wygląd strony bez zmian (zrzut przed i po — różnią się tylko kafelki mapy i liczba Ryzyk z #295) |
| Telefon 390, Faktury › szczegóły faktury › wiersz „Transport” | nazwa transportu i opłata paliwowa były dwiema osobnymi kolumnami obok etykiety; nazwa ściśnięta do ~67 px łamała się w środku numeru: „T-03 ·” / „HHL/2026/1” / „249” (u KSH sam kod „SG-01”, u SCX „SCX-26-8001” — też złamane w środku) | nazwa i opłata paliwowa w jednym bloku (`.inv-line-name`): nazwa w jednej linii „T-03 · HHL/2026/1249”, pod nią opłata paliwowa; od 320 px nazwa mieści się w jednej linii, a numer zawsze stoi w całości; gdyby kolumna była węższa od numeru, nazwa łamie się najpierw między członami („T-03 ·” / numer) (`overflow-wrap:break-word` zamiast `anywhere` dla tej nazwy). Komputer — piksel w piksel bez zmian (1440, 1280) |

Sprawdzenie całej aplikacji (zegar 23.09 i 20.11, konta HHL, KSH i SCX, 1440 / 1280 / 390 / 360, 12 stron; na telefonie także kreator faktury i szczegóły każdej faktury):
- dokument wyższy albo szerszy od okna — po zmianie 0 (przed: Strefy u HHL; Faktury — naprawione w #295);
- słowo złamane w środku w kartach tabel na telefonie — po zmianie 0 (przed: tylko wiersz „Transport” w szczegółach faktury).

Obrazy:
- `przed-faktura-390.webp` — telefon, szczegóły faktury: „T-03 · HHL/2026/1” / „249”;
- `po-faktura-390.webp` — telefon, ten sam wiersz: „T-03 · HHL/2026/1249”, pod nim opłata paliwowa.

Testy (`tests/etap6-ui.spec.ts`, blok „Przed wydaniem”, uruchamiane w CI przez `test:etap6`):
- HHL: 12 stron × 1440 / 1280 / 390 oraz karta każdej strefy na telefonie (390, 360) — dokument nie wyższy i nie szerszy od okna; pomiar po wczytaniu historii strefy i ułożeniu strony. Na `main` test pada: Faktury 1440, 1280 i 390, Strefy 1280, karty „Plac budowy Stegra Boden” i „Terminal Polferries Gdańsk” przy 390 i 360;
- HHL, SCX, KSH, telefon 390: szczegóły każdej faktury po kolei (akordeon — otwarta jedna), po ułożeniu karty — żaden człon nazwy transportu nie stoi w dwóch liniach (przy zegarze 20.11 to 2 faktury, 5 pozycji na konto). Selektor niezależny od nowego bloku, więc na `main` test pada u wszystkich trzech kont („HHL/2026/1249”, „SCX-26-8009”, „T-03”).

Niezależne sprawdzenie wyglądu (F7, 18.10, 00:35): wygląd bez uwag (Strefy 1440 / 1280 / 390 / 360, Faktury 390 / 360 / 320 u trzech kont, komputer piksel w piksel, reguły stylu); poprawione — test faktur sprawdzał tylko jedną fakturę (akordeon) i mierzył przed ułożeniem karty, opis Stref obejmuje teraz telefon, zdanie o łamaniu numeru doprecyzowane.
