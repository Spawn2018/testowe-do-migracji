# W-demo-strefy — zdarzenia strefy placu w danych demo

Koordynator (Claude), 18.10.2026, 20:50. Gałąź `wyglad/W-demo-strefy` (od `main` 7e9c286, z #303). F8: tylko dane demo i test, bez bazy, wyglądu i tekstów.

## Podstawa
- P11 pkt 7, paczka B (e17, e25; `docs/handover/odbior/P11-zgodnosc/POROWNANIE.md`, „Dane demo”). W demo nie było zdarzeń strefy placu, więc:
  - przy dostarczonym (SG-23) oś Status pokazywała „Na placu · pominięte”;
  - przy „Dostarczone” stało samo „śledzenie wyłączone · data realizacji usługi”, bez „Wyjazd z placu po 3 h 44 min” z makiety;
  - przy transporcie na placu (T-12) nie było „postój potwierdzony”.
- Termin z tamtego porównania: do 25.10.

## Co zmieniam
`src/data/seed.ts`, `buildSeedEvents`: dla transportów „Na placu”, „Rozładowany” i „Dostarczone” zdarzenia strefy placu jak z silnika stref:
- wjazd na plac (gf-11 „Stegra · Stalverket 20, Boden”) z automatu: `STATUS_AUTO` → „Na placu” oraz `GEOFENCE_ENTER`:
  - przy „Na placu” o godzinie „czeka przed placem od …” z bloku ETA (`waitSince`): T-12 15:10, T-18 11:40;
  - przy rozładowanych i dostarczonych 3 h 44 min przed wyjazdem — tyle, ile „Postój · rozładunek Boden” w Cenach (ten sam wjazd i wyjazd);
- postój potwierdzony po 15 min (`GEOFENCE_DWELL`, jak `dwellMin` strefy) — tylko przy postoju co najmniej 15 min i przed zegarem demo;
- wyjazd ze strefy (`GEOFENCE_EXIT`, `dwell_min`) w chwili rozładunku — ten sam moment co „Dostarczone”;
- D-01 (pierwszy „Na placu”, karta „Wyjazd z placu po 6 min — czy dostarczono?”):
  - wjazd 16:01 (blok ETA: „Na miejscu od 16:01”), wyjazd 16:07 po 6 min, bez postoju potwierdzonego;
  - wyjazd o tej samej godzinie co na karcie (zegar − 25 min).

Długi postój (3 h 44 min) nie otwiera sprawy „czy dostarczono?” (L14). Otwiera ją tylko D-01 — jak przed zmianą.

`src/data/demoEta.ts`: D-01 „Na miejscu od 16:01” (było ogólne 15:10) — ta sama chwila co wjazd na plac.

`src/lib/p6bDemo.ts`, `src/lib/p4cDemo.ts` (dane demo): strona szwedzka w Historii i karta „czy dostarczono?” — niżej, „Przy innym zegarze”.

`src/lib/statusAxis.ts` (obliczenie widoku, F8; na produkcji dziś bez skutku — żaden zapis `load_events` nie ma `payload.source = 'GPS'`, F7 runda 2):
- początek „śladu z przewozu” liczy też zdarzenia oznaczone „GPS” (np. „Załadunek · GPS” w osi Status);
- bez tego ślad dostarczonego zaczynał się dopiero przy wjeździe na plac (uwaga F7 B4);
- przykład SG-23: „ślad z przewozu: 18.09.2026, 08:30 – 22.09.2026, 11:20”.

## Wynik (demo, zegar 23.09.2026, 16:32)
| transport | Status › Na placu | Status › Dostarczone / pasek śledzenia |
|---|---|---|
| SG-23 | wjazd 22.09, 07:36 · postój potwierdzony 07:51 | „Wyjazd z placu po 3 h 44 min” · „ślad z przewozu: 18.09.2026, 08:30 – 22.09.2026, 11:20” |
| SG-02 (rozładowany) | wjazd 10:06 · postój 10:21 | wyjazd 13:50 |
| T-12 | wjazd 15:10 · postój 15:25 | — (jeszcze na placu) |
| T-18 | wjazd 11:40 · postój 11:55 | — |
| D-01 | wjazd 16:01 · wyjazd 16:07 (6 min) | — (karta „czy dostarczono?”) |

Inne miejsca, które się zmieniają:
- Automatyzacje — ostatnie działanie w wierszach „Status ze stref” oraz „Opłata paliwowa, kurs NBP, ceny”: było „SG-02 · 13:50”, jest „D-01 · 16:07” (najpóźniejsze zdarzenie strefy przed zegarem);
- Mapa i Harmonogram: D-01 „na placu od 16:01” (było 15:10).

## Przy innym zegarze (F7 runda 2, `?now=2026-11-20T11:00:00+01:00`)
- Przy późniejszym zegarze zdarzenia z przyszłości przestają być odfiltrowane. Dlatego:
  - T-18: Historia demo (`p6bDemo`) liczyła stronę szwedzką od dnia dostawy z planu (25.09). Wyjazd z portu i bufor 50 km wypadały po wjeździe na plac (23.09, 11:40);
  - teraz liczy od wcześniejszego z dni: dostawa z planu albo „czeka przed placem od …” (`etaDetail.waitSince`);
  - T-18 po zmianie: prom 21.09, 18:00 → wyjazd z portu 22.09, 14:05 → bufor 50 km 23.09, 05:22 → plac 23.09, 11:40.
- D-01: karta demo „czy dostarczono?” brała wyjazd jako „zegar − 25 min”. Przy późniejszym zegarze pokazywała 20.11, a oś miała 23.09, 16:07.
  - Teraz karta bierze wyjazd i czas z ostatniego wyjazdu ze strefy placu (`p4cDemo.demoDeliveredCheck`): 23.09.2026, 16:07 po 6 min, przy każdym zegarze.
  - Przy zegarze przed 16:07 karty nie ma, bo transport jest jeszcze na placu.
- Test: dwa przypadki przy zegarze 20.11 (karta D-01, kolejność strony szwedzkiej w Historii przy wszystkich 15 transportach z placem).

## Testy
- `tests/p11-demo-strefa-placu.test.ts` (7 testów):
  - rozładowane i dostarczone: wjazd → postój → wyjazd = rozładunek, 224 min, ten sam wjazd, wyjazd i czas co Ceny;
  - rozładowane: bez karty „czy dostarczono?” (sprawdzane na statusie „Rozładowany”, gdzie karta jest możliwa);
  - „Na placu”: wjazd = `waitSince` z bloku ETA, status z automatu w tej samej chwili, T-12 i T-18, bez wyjazdu poza D-01;
  - D-01: 6 min, chwila wyjazdu = karta demo = karta liczona ze zdarzeń;
  - ślad z przewozu: `firstFixAt` = „Załadunek · GPS”, przed wjazdem na plac i przed „Dostarczone”.
- Unit (całość), `tsc -b`, e2e etap4/5/6, aud03, d-eur-t, persist-toast, e8 — zielone lokalnie.

## Poza zakresem
- Podpowiedź „Z GPS: … · Użyj” w oknie „Zmień status”:
  - pojawia się, gdy istnieje zdarzenie strefy pasujące do wybranego statusu i nie wcześniejsze niż bieżący status (`gpsHint`);
  - po tej zmianie ma ją każdy z 15 transportów ze zdarzeniami placu — np. przy „Dostarczone” z godziną wyjazdu z placu;
  - jej wyglądu ani reguły nie zmieniam.
