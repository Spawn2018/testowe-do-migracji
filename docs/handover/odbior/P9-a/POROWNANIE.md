# wyglad/P9-a — E24-1: komunikat zamiast szarej mapy (16.10.2026, 04:45)

Podstawa:
- E24 „Rozwiązanie” pkt 4, makieta `raport/img/e24-after` (`makiety_html/E24`);
- `ROZSTRZYGNIECIA_LUK.md` E24-1 (typ K);
- PLAN §4 P9;
- zapis zgłoszenia do podłączenia: D-20261016-0445-01.

Wygląd, teksty i liczenie widoku (F8). Bez zapisów i zapytań.

| Element | Było | Jest |
|---|---|---|
| Podkład się nie wczytał | szara mapa bez słowa; „wczytany” już po zdarzeniu `load`, także przy samych błędach | pierwszy kafelek z obrazem = podkład jest; 3 przebiegi bez obrazu (ponowienia po 1 s i 2 s) = karta na środku mapy |
| Karta — komputer | — | **„Nie udało się wczytać podkładu mapy”** · „Pozycje i trasa są aktualne. Brakuje tylko tła z ulicami.” · „Spróbuj ponownie” · „Odśwież stronę” · przypis „Próbowano 3 razy: {droga}. Zgłoszenie zapisane dla HHL.” |
| Karta — telefon i Kokpit (mapa < 560 px) | — | „Nie udało się wczytać podkładu” · „Pozycje i trasa są aktualne.” · „Spróbuj ponownie” (44 px) |
| Mapa pod kartą | — | trasa, pojazdy, przybliżanie i warstwy działają; karta zasłania tylko siebie, bez cienia |
| „Spróbuj ponownie” | — | podkład zakładany od nowa, przycisk „Wczytuję podkład…”; pierwszy kafelek → karta znika |
| Plik z podkładem nie pobrał się (E22, 06.10 17:22) | mapa szara do odświeżenia | 3 próby, potem karta z „Odśwież stronę” jako głównym przyciskiem |

**Droga w przypisie:**
- produkcja z kluczem przeglądarkowym: „HERE wprost i przez serwer aplikacji” (makieta);
- produkcja bez klucza: „HERE przez serwer aplikacji”;
- demo: „podkład zapasowy bez HERE” — demo nie używa HERE, więc na zrzutach jest ta wersja.

**Produkcja przed podłączeniem:** karta, próby i „Spróbuj ponownie” działają od razu. Zdania „Zgłoszenie zapisane dla HHL.” nie ma, dopóki zapis nie zwróci sukcesu (`p9aSource`: `false`).

**Sprawdzone:**
- e2e blok P9-a — 6/6:
  - komputer: kafelki zablokowane → karta z makiety, trasa i pojazdy na mapie, bez cienia, przyciski ≥ 44 px; po zdjęciu blokady „Spróbuj ponownie” → kafelki, karta znika;
  - komputer: podkład się wczytuje → karty nie ma;
  - Kokpit: wersja krótka;
  - telefon 360 / 390 / 430: wersja krótka, 1 przycisk ≥ 44 px, nic uciętego, tekst ≥ 12 px;
- regresja: AUD-01e (jedna mapa na sesję, zero nowych kafelków przy powrocie), brama E8 telefon, P4 pasek etapów i Mapa;
- unit `p9a-basemap` (14) i `p9a-chunk` (1); cały zestaw unit zielony;
- pierwsze wczytanie: 396,5 kB gzip (main 396,3 kB; karta jest w kawałku mapy, ładowanym osobno).

**Zrzuty:**
- `mapa-1440.webp` — Mapa, jasny;
- `mapa-1440-ciemny.webp` — Mapa, ciemny;
- `kokpit-1440.webp` — mapa w Kokpicie, wersja krótka;
- `mapa-390.webp` — telefon;
- `po-ponowieniu-1440.webp` — po „Spróbuj ponownie” z odblokowanymi kafelkami.
