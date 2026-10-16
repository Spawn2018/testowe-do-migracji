# wyglad/P9-f — mapa w Przeglądzie panelu: powód braku pozycji, „Na placu od …”, strefa placu (16.10.2026, 07:40)

Podstawa:
- E32 pkt 3 (zdecydowane 08.10 12:14): „Mapa (E1): zoom 11 na ostatniej pozycji w oknie śledzenia, co 60 s; bez pozycji cała trasa (droga + prom, E45) + powód (»Śledzenie od 08.10, 03:00«, »Brak linku śledzenia — SCX«); na placu »Na placu od 07.10, 08:35« + strefa”;
- przykład SG-15 z E32: „Brak pozycji · Śledzenie od 08.10, 03:00 · Brak linku śledzenia — SCX”;
- E27 (okno śledzenia od 03:00 w dniu załadunku do „Dostarczone”);
- PLAN §4 P9 („Ekrany: … Przegląd w panelu”).

Wygląd i liczenie widoku (F8), bez danych. **Złożone na #250 (`wyglad/P9-e`)** — scalasz po #250. Zmiana tylko w mapie (`CorridorMap`, miejsce „drawer”), bez zmian w `PanelOverview` z P7-a — oba PR scalają się bez konfliktu.

| Przypadek | Było (P9-d) | Jest |
|---|---|---|
| Przed oknem śledzenia (np. „Zaplanowany”) | cała trasa, bez dopisku | cała trasa + „Brak pozycji · Śledzenie od 07.10, 03:00”, a gdy w danych nie ma linku: „· Brak linku śledzenia — SCX” |
| W oknie bez pozycji (produkcja) | „Brak pozycji GPS” | „Brak pozycji · {powód z linku śledzenia}”; bez stanu linku w danych — „Brak pozycji GPS” |
| Na placu | przybliżenie 11 na aucie | to samo + strefa placu na mapie (także przy wyłączonej warstwie „Strefy”) + „Na placu od 07.10, 08:35” (wjazd do strefy placu, a bez niego początek czekania przed placem) |
| Po „Dostarczone” | cała trasa, bez dopisku | „Śledzenie zakończone — „Dostarczone”” |
| Kadr całej trasy | dopisek mógł zasłonić Śrem | margines dolny liczony od górnej krawędzi dopisku (jak legenda na Mapie) |

Powód braku pozycji tylko z danych (`trackingLink`). Godzina „Na placu od” tylko z faktów (zdarzenie wjazdu albo `etaDetail.waitSince`), nigdy z ETA.

**Demo:** zdarzeń wjazdu do strefy placu w demo nie ma — na placu widać strefę, bez godziny „Na placu od”. Demo nie ma też stanu linku śledzenia — przed oknem tylko „Brak pozycji · Śledzenie od …”.

**Sprawdzone:**
- e2e blok P9-f: SG-11 przed oknem, trasa nad dopiskiem, bez znacznika; SG-01 po dostawie; T-12 na placu — strefa placu;
- bloki P9-d i P9-e — zielone; cała specyfikacja e8-phone-gate + AUD-01e + B-7 — 96/96;
- unit `p9f-note` (3) — przed oknem z linkiem / bez stanu linku / z linkiem czekającym; w oknie bez pozycji; na placu; po dostawie;
- cały zestaw unit zielony;
- pierwsze wczytanie 396,1 kB gzip.

**Zrzuty:** `panel-1440-przed.webp` (SG-11), `panel-1440-plac.webp` (T-12), `panel-1440-po.webp` (SG-01), `panel-390-przed.webp`.
