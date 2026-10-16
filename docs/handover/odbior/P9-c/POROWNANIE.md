# wyglad/P9-c — strona Mapa według E29 i E45 pkt 2–3 (16.10.2026, 06:15)

Podstawa:
- E29 „Propozycja” pkt 1–10, zdecydowane 08.10 12:14 (pyt. 1 A: tabela = okno śledzenia);
- L20 (bez częstotliwości w nagłówku), L22 („Brak GPS” tylko alarm);
- E45 pkt 2–3, zdecydowane 07.10 22:42 („Trasa” = droga i prom, statki pod „Pojazdy”, bez kropek);
- makieta `raport/img/e29-after`, `makiety_html/E29/map.html`;
- PLAN §4 P9;
- dane do podłączenia: D-20261016-0615-01.

Wygląd, teksty i liczenie widoku (F8). Bez zapisów i zapytań.

**Zawiera #244 (P10a-a, znacznik „na żywo”) i #245 (P9-a, komunikat zamiast szarej mapy) — scalasz po nich.**

| Element | Było | Jest |
|---|---|---|
| Nagłówek | „39 pojazdów w ruchu · pozycje co 2 min w ruchu, co 15 min na postoju” | „W oknie śledzenia 39 · z pozycją 39 · bez pozycji 0 — od 03:00 w dniu załadunku do »Dostarczone«”; telefon: „w oknie 39 · bez pozycji 0” |
| „Strefy” | każda rola | tylko HHL |
| Warstwy | Pojazdy, Strefy, Trasa, Ryzyka, Ślad | Pojazdy i statki, Trasa (droga i prom), Strefy, Utrudnienia drogowe, Przebieg wybranego |
| „Trasa” | tylko droga; prom i 4 kropki zostawały | droga i prom razem; kropek nie ma na żadnej mapie |
| Statki AIS | zawsze | pod „Pojazdy i statki” |
| Znacznik | kolor według statusu (w tym kolory statusów, których baza nie ma), dymek „kod · kierowca · ciągnik” | kolor według etapu: załadunek, w drodze, na placu; czerwona obwódka = opóźniony; wyszarzenie = brak GPS; dymek: nazwa · etap / opóźnienie · ETA / ostatnia pozycja · odcinek kierowcy / „kliknij: panel transportu”; podpis z nazwą przy ≤ 15 autach albo od przybliżenia 7 |
| Legenda | w drodze, załadunek, opóźniony, na placu, brak sygnału | załadunek · w drodze (PL, port, prom, SE) · na placu · opóźniony · brak GPS · statek (AIS) z liczbą aut |
| Filtry | W trasie · Opóźnione · Brak GPS | W oknie · Opóźnione · Brak GPS · Bez pozycji; „Szukaj: kod, nr zlecenia, tablice” |
| Tabela | 7 kolumn, przy 1366 px widać 4,5 | Transport · Etap · Pozycja · ETA Boden; 1366 px bez przewijania w bok |
| Pozycja | — | godzina ostatniej pozycji; prom: „statek (AIS)”; „brak GPS od 22:40 / próg 30 min w ruchu”; „brak pozycji” + powód i kto uzupełnia (tylko z danych) |
| ETA Boden | z planu przed wyjazdem | „–” przed wyjazdem; „+1 h 10 min po oknie”; „z ostatniej pozycji” przy braku GPS; „na placu od 23:05” |
| Dopisek pod mapą | „Schemat korytarza, nie mapa nawigacyjna…” | tylko źródła: HERE, Trafikverket (SE), HERE (PL), AIS Fintraffic CC BY 4.0, godzina odczytu statków |
| Telefon | 5 pól warstw nad mapą, tabela 7 kolumn | „Warstwy ▾” na mapie → arkusz z warstwami i legendą; lista jako karty; dotknięcie znacznika → arkusz: etap, ETA, „Otwórz panel transportu”, „Pokaż przebieg na mapie” |

**Kokpit:** te same znaczniki i dymek (bez podpisów i legendy w kafelku).

**Produkcja przed podłączeniem (D-20261016-0615-01):**
- godzina pozycji pokazuje się, gdy dane mają czas ostatniej pozycji — inaczej „pozycja GPS”;
- powód braku pozycji tylko wtedy, gdy serwer podaje stan linku śledzenia — bez zgadywania.

**Demo:** ETA Boden „–”, bo demo nie liczy ETA bez GPS (decyzja 04.10).

**Sprawdzone:**
- e2e blok P9-c — 4/4:
  - komputer: nagłówek, 4 kolumny, warstwy, legenda, źródła, dymek; 1366 px bez przewijania;
  - „Trasa” chowa drogę i prom, „Pojazdy” auta i statki; bez kropek;
  - KSH: bez „Strefy”, sam kod;
  - telefon: arkusz warstw (cele ≥ 44 px, tekst ≥ 12 px), karty, arkusz znacznika → panel;
- regresja:
  - brama E8 telefon (9 widoków × 3 konta × 3 szerokości);
  - P4 pasek etapów i Mapa (testy Mapy zmienione: „W oknie”, „Na mapie: 0”);
  - P9-a, P10a-a, AUD-01e, B-7a/B-7b (telefon: „Warstwy ▾”);
- unit `p9c-map` (13); cały zestaw zielony;
- pierwsze wczytanie 395,8 kB gzip — strona Mapa ładowana osobno, jak Ryzyka.

**Zrzuty:**
- `mapa-1440.webp`, `mapa-1440-dymek.webp`, `mapa-1440-ciemny.webp`, `mapa-1366.webp`, `mapa-1440-ksh.webp`;
- `kokpit-1440.webp`;
- `mapa-390.webp`, `mapa-390-warstwy.webp`, `mapa-390-arkusz.webp`.
