# wyglad/audyt-D — Mapa i Przegląd: poprawki z przeglądu zgodności (16.10.2026)

Podstawa:
- przegląd grupy D (`gap/D/GAPS.md`, stan `wyglad/P7-d` @ `1d43751`): D-01, D-03 … D-07;
- E1 (kadr całej trasy, 07.10), E29 (Mapa, 08.10), E41 (nazwa transportu: KSH widzi tylko kod, 08.10), E45 (Trasa = droga + prom, 07.10);
- decyzja właściciela 16.10, 01:13 (D-20261016-0200-01 Z3): „Kontrola trasy” i „Przeszkody wzdłuż korytarza” usunięte na stałe.

Gałąź `wyglad/audyt-D` stoi na `wyglad/E6-tel` (main z P7-d + P7-a + P7-b + P9-b + E6-tel). Wygląd, teksty, obliczenia widoku, dane demo (F8). Bez zmian w `supabase/`, dostawcach danych i zapisach. D-02 (Przełączniki) — inna grupa.

| ID | Było | Jest | Pliki |
|---|---|---|---|
| D-01 | Na `main` + P7-d w Przeglądzie wiersze „Kontrola trasy — … wyłączona” i „Przeszkody wzdłuż korytarza — …” | **Już zgodne na tej gałęzi:** panel Przegląd z P7-a nie ma tych wierszy, pliki `RouteCheckPanel.tsx` i `CorridorObstaclesPanel.tsx` nie istnieją, na Mapie brak warstwy przeszkód, w legendach, Pomocy, „Co nowego” i paczce demo (`dist`) 0 trafień „Kontrola trasy” / „Przeszkody wzdłuż korytarza”; Przełączniki bez H1/H3/H6 (P9-b). Klucz `rk_route_obstacle` zostaje w słowniku, póki funkcja bazy `h1_record_route_check` go używa (test `rk-generic`) — usuwa go wykonawca razem z funkcją (Z3 pkt 1–3). | — |
| D-03 | Najechanie na wiersz tabeli Mapy zmieniało tylko wiersz; znaczniki bez zmian | Najechanie na wiersz podświetla znacznik tego transportu: większy (×1,3), obwódka `var(--ink)`, nad innymi znacznikami; gdy auto jest w grupie (strefa, prom) — podświetla znacznik grupy. Zjechanie zdejmuje podświetlenie. Bez przerysowania mapy przy najechaniu (klasa na istniejącym znaczniku). Działa tak samo przy najechaniu na znacznik. | `src/components/map/CorridorMap.tsx`, `src/index.css` |
| D-04 | KSH wpisywał „HHL/2026/1243” albo „SCX-26-8003” i dostawał wiersz „T-01”; podpowiedź „Szukaj: kod, nr zlecenia, tablice” także u KSH | Mapa szuka tą samą funkcją co Harmonogram (`transportSearchBlob`, E41): HHL — kod, nr HHL, nr SCX; SCX — kod, swój nr i nr HHL; KSH — tylko kod; u wszystkich do tego tablice ciągnika i naczepy; nigdy numer z pliku KSH. Podpowiedź KSH: „Szukaj: kod, tablice”. Harmonogram: filtr był już według firmy, podpowiedź KSH „Szukaj: kod, kierowca, tablice”. Dokumenty: bez zmian — okno „Wgraj dokument” jest tylko dla HHL i SCX (oba widzą numery), filtr transportu ma nazwę E41 według firmy. | `src/lib/p9cMap.ts`, `src/views/MapView.tsx`, `src/views/ScheduleView.tsx`, `src/i18n/p9c.ts`, `src/i18n/sched7.ts` |
| D-05 | Telefon 390: podpis podkładu (2 linie) przykrywał początek trasy — grupa „3” w Śremie pod podpisem (dół trasy 557 px, góra podpisu 525 px) | Margines dolny kadru E1 liczony także od górnej krawędzi podpisu podkładu (24 px nad nim); po wczytaniu podkładu (podpis zmienia wysokość) kadr liczony od nowa. Telefon 360 / 390 / 430, HHL, KSH, SCX: trasa 25–27 px nad podpisem, cała w kadrze. Komputer i Kokpit bez zmian (legenda wyższa niż podpis; w Kokpicie podpis ukryty). Działa też dla krótszego podpisu HERE w produkcji. | `src/components/map/mapPool.ts`, `src/components/map/CorridorMap.tsx` |
| D-06 | Telefon: nagłówek → [Strefy w osobnym wierszu] → mapa → kafelki → szukaj/filtry → karty | Jak makieta E29 „Po zmianie · telefon”: nagłówek → pasek kafelków (przewijany w bok) → mapa → szukaj/filtry → karty. U HHL „Strefy” w jednym wierszu z tytułem i liczbami („Mapa w oknie 39 · bez pozycji 0 … Strefy”), „na żywo · 16:32” pod nimi; KSH i SCX — jeden wiersz jak dotąd. Komputer bez zmian (kafelki nad tabelą). Nic poza ekranem przy 360 / 390 / 430. | `src/views/MapView.tsx`, `src/index.css` |
| D-07 | Demo: linia drogowa (pomarańczowa, przerywana) szła prosto przez Bałtyk z Gdańska do Nynäshamn, równolegle do promu; z Karlskrony nie wychodziła droga SE | Tylko demo: trzy odcinki lądowe ciągłą linią jak trasy HERE w produkcji — Śrem → Gdańsk (S5, A1), Nynäshamn → Sztokholm → E4 → Boden, Karlskrona → E22 → E4 → Sztokholm (makieta `e1-kokpit-new`). Odcinek morski tylko jako prom. Mapa, Kokpit i Przegląd (wspólna mapa). Kadr E1 bez zmian (punkty w granicach korytarza). Produkcja bez zmian (trasy z `loadRoadLines`). | `src/data/roadLinesDemo.ts`, `src/components/map/mapPool.ts` |

**Sprawdzone:**
- `tsc -p tsconfig.app.json` — 0 błędów; `lint:css` — 0; `oxlint` zmienionych plików — 0;
- unit: `p9c-map` (nowy test wyszukiwania według firmy: KSH bez numerów HHL/SCX, SCX z numerem HHL, numer z pliku KSH w żadnej firmie) i pliki dotyczące Mapy, mapy z puli i Harmonogramu (13 plików, 120 testów); cały zestaw `test:unit` — 169 plików, 1373 testy zaliczone, 35 pominiętych (jak dotąd), 0 błędów;
- e2e przepisane / dopisane w `tests/e8-phone-gate.spec.ts` (bez uruchamiania — puszcza koordynator w CI):
  - „komputer: najechanie na wiersz tabeli podświetla znacznik (E29, audyt D-03)”;
  - „KSH: bez przycisku „Strefy”…” — dopisane: podpowiedź „Szukaj: kod, tablice”, „HHL/2026” i „SCX-26” → 0 wierszy, kod → wiersze (D-04);
  - „telefon 390: trasa nad podpisem podkładu; kafelki nad mapą, „Strefy” w wierszu z tytułem (audyt D-05, D-06)”;
- podgląd paczki demo (Playwright, pliki `dist` przez przechwycenie żądań, bez serwera): HHL, KSH, SCX przy 360, 390, 430, 1366, 1440 i Kokpit 1440 — trasa w kadrze z marginesem, nad legendą i nad podpisem; najechanie na każdy z 28 wierszy z pozycją GPS podświetla dokładnie 1 znacznik (10 razy znacznik grupy), wiersz promu — znacznik statku;
- pierwsze wczytanie: 368,8 kB gzip (budżet 400 kB); paczka demo bez „sms:”, „mailto:”, „supabase”.

**Wzorce zrzutów** (`tests/__screenshots__`) nieodświeżone: zmieni się Mapa i Kokpit (linia trasy demo, kolejność na telefonie) — odświeża koordynator w CI.

**Nie zrobione:**
- D-02 — inna grupa (Przełączniki bezpieczeństwa).
- D-01 — nic do zmiany na tej gałęzi; klucz `rk_route_obstacle` i funkcje / tabele `route_checks`, `corridor_obstacles`, `corridor_fetches` usuwa wykonawca (Z3).

**Uwaga poza zakresem:** na komputerze legenda Mapy leży na lewej części podpisu podkładu (podpis 2 linie przy 1440 px) — było tak przed zmianą; do decyzji, czy podpis przenieść nad legendę albo skrócić.
