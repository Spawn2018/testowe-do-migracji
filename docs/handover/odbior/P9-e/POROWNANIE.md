# wyglad/P9-e — auta na promie i w jednej strefie jednym znacznikiem (16.10.2026, 07:15)

Podstawa:
- E45 pkt 5 (zdecydowane 07.10 22:42): „auta tego samego rejsu jako jeden znacznik na pozycji statku z AIS z liczbą aut; najechanie — rejs i kody; kliknięcie — lista transportów (telefon: lista od dołu); bez AIS — ostatnia pozycja z »brak AIS«; po zejściu z promu — osobne znaczniki; tak samo w Kokpicie”;
- D-20261009-1309-01 R5 (decyzja 09.10 13:09): to samo dla więcej niż 1 auta w strefie załadunku, portu PL, portu SE albo placu (E34), bez buforów; poza strefami — W28, do odpowiedzi tylko strefy;
- makieta `makiety_html/E45/mapa.html`, `a-ferry.webp`, `a-ferry-m.png`;
- PLAN §4 P9 (E45, „grupowanie aut na promie” i „w jednej lokalizacji”).

Wygląd i liczenie widoku (F8), bez danych. **Złożone na #249 (`wyglad/P9-d`)** — scalasz po #249.

| Miejsce | Było | Jest |
|---|---|---|
| Auta na promie | każde auto osobno, w tym samym punkcie, znaczniki na sobie | jeden znacznik statku z liczbą aut na pozycji statku z AIS (statek nie jest rysowany drugi raz); bez AIS — na ostatniej pozycji auta, wyszarzony |
| Auta w strefie | osobne znaczniki na sobie | od 2 aut w strefie załadunku, portu PL, portu SE albo placu — jeden znacznik z liczbą na środku strefy, w kolorze etapu (załadunek, w drodze, plac); opóźnione auto w grupie — czerwona obwódka |
| Najechanie | dymek pierwszego auta | „Prom Nova Star · 6 aut” / „Gdańsk → Nynäshamn · wypłynął 08.10, 18:00” / kody / odczyt AIS albo „brak AIS · ostatnia pozycja auta 16:28” / „kliknij: lista transportów”; strefa: „{miejsce} · 3 auta” / rodzaj miejsca / kody |
| Kliknięcie | panel pierwszego auta | komputer: karta z listą na mapie (kod, numer zlecenia, etap, „opóźniony”), wiersz → panel transportu; telefon: lista od dołu, wiersz → arkusz transportu; jedno auto na promie → od razu panel |
| Kokpit | jak wyżej | te same grupy co na Mapie |
| Legenda | — | „kilka aut w jednej strefie” (telefon: „kilka aut w strefie”) |
| Przegląd w panelu, tryb skupienia | — | bez grup (jeden transport) |
| Demo | auta rozłożone według postępu (plac Boden przy Umeå, port PL na morzu) | auto w strefie swojego etapu (załadunek, port PL, port SE, plac), prom na linii promu; droga — jak dotąd |

**Produkcja przed podłączeniem (D-20261016-0715-01):**
- pozycja statku — `vessel_positions` po nazwie statku z rejsu (`sailings.vessel`);
- rejs auta — `loads.sailing_id`, a bez niego statek z rezerwacji (`ferry.vessel`).

Strefy z bazy (`geofences`) działają od razu.

**Sprawdzone:**
- e2e blok P9-e — 2/2:
  - komputer: grupy prom 6, port PL 4, załadunek 3, plac 3; dymek z kodami bez numerów; karta 6 wierszy → panel; Kokpit te same grupy;
  - telefon: lista od dołu, wiersze ≥ 44 px → arkusz transportu;
- bloki P9-c (legenda 7 pozycji, dymek pojedynczego auta) i P9-d — zielone;
- unit `p9e-groups` (12) — wszystkie zielone, w tym test R5 („3” → „2” + osobny), test E45 („3 transporty jednego rejsu = jeden znacznik »3«”), bufory się nie liczą, prom przed strefą;
- cały zestaw unit zielony;
- pierwsze wczytanie 396,1 kB gzip.

**Zrzuty:** `mapa-1440.webp`, `mapa-1440-dymek.webp`, `mapa-1440-lista.webp`, `kokpit-1440-lista.webp`, `mapa-390-lista.webp`, `mapa-390-arkusz.webp`.
