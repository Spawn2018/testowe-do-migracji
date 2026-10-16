# wyglad/W-dane — wygląd bez czekania na dane wykonawcy (16.10.2026, 21:45)

Podstawa:
- właściciel 16.10.2026, 21:13 i 21:22: punkty z paska postępu robię teraz, nie czekam na dane Cursora;
- E31 pkt 5 (raport audytu: „Inne pliki” z przyciskiem „+ Dodaj”), D-20261014-2005-01 S4 pkt 7;
- E45 i D-20261016-0230-01 Z3 pkt 8 („Linia objazdu na mapie (przerywana) — w P9, ta sama warstwa co trasa”);
- E45 pkt 1, decyzja 07.10.2026, 22:15, L56 (przeprawy jak trasy promów HERE);
- W38 (Podgląd).

Wygląd, teksty, obliczenia widoku i dane demo (F8). Produkcja działa jak dziś, dopóki wykonawca nie poda danych (dopisek D-20261016-2130-01, pkt 3).

| Miejsce | Było | Jest |
|---|---|---|
| Panel transportu › Dokumenty › „Inne pliki” (HHL, SCX) | lista plików bez przycisku | „+ Dodaj” po prawej, jak na makiecie E31. Otwiera „Wgraj dokument” z rodzajem „Inne”. Można dodać kilka plików do jednego transportu, bez wersji. KSH — bez przycisku (KSH nic nie wgrywa, 19:11). |
| Dokumenty › „Wgraj dokument” i filtr „Rodzaj” | Zezwolenie PL, Zezwolenie SE, CMR | to samo i „Inne” |
| Mapa, Kokpit, Przegląd w panelu | — | po decyzji SCX „Jedziemy objazdem” — przerywana linia objazdu w warstwie „Trasa” (chowa ją „Trasa (droga i prom)”). Podpis: „T-17 · … · objazd przez Kramfors i Sandöbron (droga 90): +31 km, +35 min · decyzja SCX”. Po „Stoimy” — bez linii. |
| Mapa — przeprawy promowe | stałe tory wodne | tory z HERE, gdy serwer je poda (`map_display_state.ferries`) i geometria przejdzie sprawdzenie: końce do 10 km od terminali, długość 1,0–1,6 raza prostej, krok ≤ 150 km. Bez danych albo przy złej geometrii zostaje stały tor, osobno dla każdej przeprawy. Skrót sprawdzenia w `data-ferries` elementu mapy (do TEST, L56). |
| Podgląd (W38) | pasek „Podgląd: tak widzi …”, tylko odczyt, zapis ukryty, 2FA nieaktywne | bez zmian — wygląd jest. Dane jak konto firmy i odmowa zapisu w bazie — wykonawca w P6 (W38). |

**Produkcja do podłączenia (dopisek D-20261016-2130-01 pkt 3):**
- `otherDocsOn()` — `false`, dopóki aplikacja nie czyta i nie zapisuje rodzaju `OTHER`;
- `detourLinesOf()` — `[]`, dopóki serwer nie poda geometrii objazdu;
- `loadFerryLines()` — pusta lista, dopóki `map_display_state` nie ma pola `ferries`.

**Demo (G-09):** objazd przy T-17 w przybliżeniu idzie drogą 90: Utansjö → Ramvik → Kramfors → Sandöbron (Lunde) → wschodnim brzegiem na E4 przy Hornön.

**Poprawki po niezależnym sprawdzeniu (F7, 5 różnic):**
1. Podpis linii objazdu zawija się i mieści na telefonie (najwyżej 320 px).
2. Podpis w tokenach (`var(--surface)`, `var(--ink)`, `var(--rule)`), bez cienia i bez zaokrągleń — także w ciemnym motywie.
3. „Inne pliki”: bez powtarzanej etykiety „Inne”, nazwa i przyciski w jednym rzędzie z odstępem.
4. Krok między punktami przeprawy do 150 km (HERE daje długie proste na otwartym morzu) i powód odrzucenia w `data-ferries`.
5. Port do 10 km od terminalu — Gdynia nie uchodzi za Gdańsk.

Do tego: „+ Dodaj” ukryty w Podglądzie (W38).

**Sprawdzenie:**
- `tests/w-dane.test.ts` (12 testów): przeprawy, linia objazdu, „Inne pliki” i produkcja bez danych;
- przegląd w przeglądarce, 1440 i 390. Wyniki:
  - HHL i SCX: „+ Dodaj”, rodzaj „Inne”, dwa pliki na liście;
  - KSH bez przycisku;
  - na telefonie przycisk ma 44 px, bez przewijania w bok;
  - linia objazdu po decyzji na Mapie i w Przeglądzie; po odznaczeniu „Trasa” — 0;
  - w Kokpicie bez decyzji — 0.

| Plik | Co pokazuje |
|---|---|
| `inne-panel-hhl-1440.webp` | panel › Dokumenty: „Inne pliki” z „+ Dodaj” i dwoma plikami |
| `inne-okno-hhl-1440.webp` | „Wgraj dokument” z rodzajem „Inne” |
| `inne-panel-scx-390.webp` | telefon SCX: „Inne pliki” z plikiem i „+ Dodaj” |
| `objazd-karta-scx-1440.webp` | sprawa SCX „Objazd czy postój?” (bez zmian, przed decyzją) |
| `objazd-mapa-1440.webp` | Mapa po decyzji: kadr całej trasy i podpis linii |
| `objazd-mapa-zoom-1440.webp` | przybliżenie: przerywana linia objazdu wokół Högakustenbron |
| `objazd-podpis-390.webp` | telefon: podpis linii objazdu zawinięty, w kadrze mapy |
| `objazd-podpis-1440-ciemny.webp` | ciemny motyw: podpis w tokenach, bez cienia |
