# NAPRAWY — zakres Etapu D (jeszcze nie rozpoczęty)

| Pole | Wartość |
|---|---|
| Data zapisu | **2026-09-24** Europe/Warsaw |
| Status | **STOP przed Etapem D** — tylko lista zakresu |
| Źródła | Prompt finalny t110u (D1–D17) · t111u (D18) · t120u (D19–D24) · Sebastian 2026-09-24 (D26) · `02_FASADA.md` · `07_ZNANE_BLEDY.md` · C3 |
| Kod produktu | **bez zmian** w tym pliku |

> D1–D18 **obowiązują bez zmian**. D19–D24 **dochodzą** z Etapu C. D26 dopisane 2026-09-24. Nie zaczynać realizacji D24 tutaj.

---

## D1–D18 (z t110u / t111u — bez zmian)

Pełny dosłowny tekst D1–D17 jest w transkrypcie **t110u** (PROMPT FINALNY). Poniżej skrót zsynchronizowany z fasadą C1 i notatkami t111u, żeby lista nie zginęła na dysku. Przy konflikcie brzmienia **wygrywa t110u**.

**D1.** Alternatywy trasy SE ×4 „Wybierz” — dziś tylko toast; mają mutować load/risk (`RisksView`).

**D2.** Pill opóźnienia w drawerze (`+1h 35 min`) — liczyć z `delayMinutes`, nie stały napis (`LoadDrawer`).

**D3.** Warunki drogowe SE na korytarzu — endpoint na żywo **albo** jawna etykieta demo (ten sam wzorzec co D18); spójnie z panelem ryzyk.

**D4.** Terminy zadań — z `plannedLoadDate` / danych load, nie `18+i*9` (`TasksView`).

**D5.** Preferencje powiadomień w Opcjach — zapis **i** filtracja przy `push` (`OptionsView` + store).

**D6.** Pogoda / fale `SAIL_ROWS` — źródło prawdziwe lub oznaczenie demo (`RisksView`).

**D7.** Wskaźnik kompletności DRAWING — nie hardcode 100% (`DocsView`).

**D8.** Kolumna „Próbki” w geofence — z modelu, nie zawsze `2` (`GeofenceView`).

**D9.** JSONLogic / akcje workflow w runtime — realna semantyka, nie atrapa UI.

**D10.** Pozostałe ATRAPA / CZĘŚCIOWO z `02_FASADA.md` poza D1–D9 — domknięcie wierszy fasady (priorytet ATRAPA → CZĘŚCIOWO).

**D11.** Hardcoded toasty / copy PL w store i widokach kolidujące z i18n (nakłada się z D19; tu: ścieżki wskazane w C1 przed pełnym audytem C3).

**D12.** Sub faktur „tydzień 38 · 14–20.09.2026” — z daty seedu / zegara zamrożonego, nie literał (`InvoicesView`).

**D13.** Adapter telematyki SCX / integracje PORZUCONE spoza SPA — decyzja: podpiąć makietę albo wyciąć z UI obietnic.

**D14.** Martwy / podwójny silnik mapy — porządek Leaflet vs pozostałości (szczegół MapLibre → D15 / D21).

**D15.** Usunąć lub izolować porzucony MapLibre / `CorridorMap.leaflet.tsx` (żywy silnik = Leaflet). Powiązane z **D21**.

**D16.** Force-majeure / opóźnienia — mechanizm ryzyk bez atrap (rozszerzenie po SE road).

**D17.** Domknięcie luk fasady CZĘŚCIOWO z C1 (seed vs live, brakujące mutacje) według tabeli `02_FASADA.md`.

**D18.** Stawki w Opcjach (koszt 16500/19200/22800, przychód 20500/23800/27900 + parametry BAF) są **tylko demo** (negocjacje z przewoźnikami trwają). Jawnie oznaczyć „demo” w Opcjach, kolumnach finansowych Harmonogramu i Fakturach; jeden przełącznik wyłączający oznaczenie, gdy stawki będą potwierdzone. Ten sam wzorzec etykiety dla panelu warunków drogowych, jeśli D3 wybierze label zamiast żywego endpointu.

---

## D19–D24 (dopisane w t120u — znaleziska Etapu C)

**D19. Sto cztery napisy wpisane na stałe w komponentach.**  
Z C3. Najpoważniejsze znalezisko etapu — wersja szwedzka jest w dużej części **pozorna** (użyje jej Scandinavian Express). Te napisy nie zmieniają się między językami, więc zrzuty PL/EN/SV będą w tych miejscach identyczne i regresja wizualna niczego nie wykryje. Każdy napis do słownika, w trzech językach.

**D20. Różnice na fakturach wpisane na stałe.**  
Z C1. Rozbieżność (m.in. rząd 1 840 PLN / delty +1240/+600) zaszyta → dopasowanie trójstronne jest **fasadą** — moduł pokazuje wynik, którego nie policzył. Ma liczyć naprawdę: transporty zaznaczone wobec zrealizowanych wobec kwoty z cennika, z rozbiciem różnic linia po linii.

**D21. Usuń martwy MapLibre.**  
Z C1 i przekazania QA. Leży w drzewie obok żywego Leaflet, powiększa paczkę i myli przy utrzymaniu. Powiązane z D15.

**D22. Wersjonowanie i migracja magazynu trwałego.**  
Z pliku 07. Klucz `watch-tower-ui-v6-ready-gate` bez wersjonowania schematu. Na produkcji użytkownik po aktualizacji czyta stan w starym kształcie i nie wie o tym. Numer wersji w magazynie, sprawdzenie przy starcie, migracja albo czyste wyczyszczenie z komunikatem.

**D23. Testy regresji importu harmonogramu.**  
Z pliku 07: naprawione pod P9, bez testów automatycznych. Przy awarii funkcja **kasuje harmonogram klienta**. Minimum pięć wariantów pliku: poprawny, pusty, z inną kolejnością kolumn, ze zmienionymi nagłówkami, z wierszami niespełniającymi walidacji. Każdy sprawdza, że istniejące dane przetrwały.  
*(PR #1 — unit testy `tests/schedule-import.test.ts` — squash-merge na `main` 2026-09-24; to nie zamyka pełnego D23 na skali produkcyjnej — patrz Fala 3.)*

**D24. Pełny przebieg czternastu prób.**  
Z pliku 07: po P9 wykonano tylko sprawdzenia skupione. Do wykonania na aktualnej paczce, z sumą kontrolną paczki w raporcie. **NIE START** w tej sesji.

---

## Fale (plan Sebastiana 2026-09-24)

### Fala 0 — testy / bezpieczeństwo regresji
- **D23** — unit testy importu (PR #1 na `main`)
- **D24** — pełny przebieg 14 prób (**nie rozpoczęty**)

### Fala 1–2
- Bez zmian względem D1–D22 powyżej; kolejność jak niżej.

### Fala 3 — import UX + skala + visual CI
- **D26** — poniżej
- Później w tej samej fali (notatka, nie status „done”): wariant testu na skali ~70+ wierszy; visual CI + te same browsery co lokalnie.

---

### D26 — podgląd importu kłamie o usunięciach
Problem: `diffSchedule` pokazuje brakujące kody jako removed, a `dryRunFromXlsx(...).removedIds` jest zawsze `[]`; `commitImport` bez `allowRemovals` nic nie usuwa. KSH widzi „N usunięte”, klika Zatwierdź, nic nie znika.

Wybrana droga (Sebastian 2026-09-24): **2 — usunięcia za wyraźną zgodą**. Osobne pole wyboru w oknie podglądu, domyślnie odznaczone, z liczbą i listą kodów; `allowRemovals` musi dojść z UI, nie tylko istnieć w kodzie.

---

## Kolejność (gdy Sebastian da START na D)

1. Nie mieszać z C2.3 / baseline.  
2. **Fala 0:** D23 (unit) → D24 (14 prób) — D24 dopiero na osobny START.  
3. Najpierw bezpieczne tooling/i18n (D19, D22), potem atrapy funkcji (D20, D1–D9), potem sprzątanie (D15/D21).  
4. **Fala 3:** D26 (zgoda na usunięcia w UI) + skala ~70+ + visual CI.  
5. D18 (oznaczenie demo) można zrobić wcześnie — zero zmiany logiki stawek.

---

*Koniec zakresu. Realizacja D24/D26 = osobny START — nie w tej sesji Etapu C.*
