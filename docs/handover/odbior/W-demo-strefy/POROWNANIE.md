# W-demo-strefy — zdarzenia strefy placu w danych demo

Koordynator (Claude), 18.10.2026, 20:50. Gałąź `wyglad/W-demo-strefy` (od `main` 7e9c286, z #303). F8: tylko dane demo i test, bez bazy, wyglądu i tekstów.

## Podstawa
- P11 pkt 7, paczka B (e17, e25; `docs/handover/odbior/P11-zgodnosc/POROWNANIE.md`, „Dane demo”). W demo nie było zdarzeń strefy placu, więc:
  - przy dostarczonym (SG-23) oś Status pokazywała „Na placu · pominięte”;
  - przy „Dostarczone” stało samo „śledzenie wyłączone · data realizacji usługi”, bez „Wyjazd z placu po 3 h 44 min” z makiety;
  - przy transporcie na placu (T-12) nie było „postój potwierdzony”.
- Termin z tamtego porównania: do 25.10.

## Co zmieniam
`src/data/seed.ts`, `buildSeedEvents`: dla transportów „Na placu”, „Rozładowany” i „Dostarczone” zdarzenia strefy placu (gf-11 „Stegra · Stalverket 20, Boden”) jak z silnika stref:
- wjazd do strefy z automatu: `STATUS_AUTO` → „Na placu” oraz `GEOFENCE_ENTER`;
- postój potwierdzony po 15 min (`GEOFENCE_DWELL`, jak `dwellMin` strefy) — tylko gdy jest przed zegarem demo;
- przy rozładowanych i dostarczonych wyjazd ze strefy (`GEOFENCE_EXIT`, `dwell_min`) w chwili rozładunku — ten sam moment co „Dostarczone”;
- czas na placu na zmianę: 3 h 44 min, 3 h 16 min, 4 h 11 min;
- T-12 (na placu): wjazd 15:10 — ta sama godzina co „Na placu od 15:10” w panelu — postój 15:25, bez wyjazdu.

Postój dłuższy niż 10 min, więc nie powstaje sprawa „Wyjazd z placu po … — czy dostarczono?” (L14).

## Wynik (demo, zegar 23.09.2026, 16:32)
| transport | Status › Na placu | Status › Dostarczone |
|---|---|---|
| SG-23 | „Wjazd na „Stegra · Stalverket 20, Boden”” · „08:19 · postój … potwierdzony” | „Wyjazd z placu po 3 h 16 min · śledzenie wyłączone · data realizacji usługi” |
| SG-02 | wjazd · „10:21 · postój … potwierdzony” | „Wyjazd z placu po 3 h 44 min · …” |
| T-12 | wjazd · „15:25 · postój … potwierdzony” | — (jeszcze na placu) |

## Testy
- Nowy `tests/p11-demo-strefa-placu.test.ts`:
  - kolejność wjazd → postój → wyjazd;
  - wyjazd = rozładunek;
  - „Na placu” przed „Dostarczone”;
  - brak sprawy „czy dostarczono?”;
  - T-12.
- Unit, `tsc -b`, e2e etap4/5/6, aud03, d-eur-t, persist-toast, e8 — wynik w PR.

## Poza zakresem
- Podpowiedź „Z GPS: wyjazd z placu … · Użyj” w oknie „Zmień status” pojawia się tylko przy transporcie, który wyjechał z placu, a status stoi. W demo takiego nie ma — wyjazd od razu zmienia status. Na produkcji podpowiedź bierze się z bazy.
