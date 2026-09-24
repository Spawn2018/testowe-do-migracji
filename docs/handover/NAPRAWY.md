# NAPRAWY — zakres Etapu D (jeszcze nie rozpoczęty)

| Pole | Wartość |
|---|---|
| Data zapisu | **2026-09-24** Europe/Warsaw |
| Status | **STOP przed Etapem D** — tylko lista zakresu |
| Źródła | Prompt finalny t110u (D1–D17) · t111u (D18) · t120u (D19–D24) · Sebastian 2026-09-24 (D26) · `02_FASADA.md` · `07_ZNANE_BLEDY.md` · C3 |
| Kod produktu | **bez zmian** w tym pliku |

> D1–D18 **obowiązują bez zmian**. D19–D24 **dochodzą** z Etapu C. D26 dopisane 2026-09-24. D24 zamknięte raportem D24_14_CLICK.md (SHIP 14/14). Nie zaczynać Fala 1 / D26 tutaj.

---

## D1–D18 (z t110u / t111u — bez zmian)

Pełny dosłowny tekst D1–D17 jest w transkrypcie **t110u** (PROMPT FINALNY). Poniżej skrót zsynchronizowany z fasadą C1 i notatkami t111u, żeby lista nie zginęła na dysku. Przy konflikcie brzmienia **wygrywa t110u**.

**D1-legacy-route-alts.** Alternatywy trasy SE ×4 „Wybierz” — dziś tylko toast; mają mutować load/risk (`RisksView`).  
> **Uwaga numeracji (Sebastian 2026-09-24):** to **NIE** jest Fala-1-D1. Fala-1-D1 = usunięcie Tailwind (najpierw inventory).

**D2.** Pill opóźnienia w drawerze (`+1h 35 min`) — liczyć z `delayMinutes`, nie stały napis (`LoadDrawer`).

**D3.** Warunki drogowe SE na korytarzu — endpoint na żywo **albo** jawna etykieta demo (ten sam wzorzec co D18); spójnie z panelem ryzyk.

**D4.** Terminy zadań — z `plannedLoadDate` / danych load, nie `18+i*9` (`TasksView`).

**D5.** Preferencje powiadomień w Opcjach — zapis **i** filtracja przy `push` (`OptionsView` + store).

**D6.** Pogoda / fale `SAIL_ROWS` — źródło prawdziwe lub oznaczenie demo (`RisksView`).

**D7.** Wskaźnik kompletności DRAWING — nie hardcode 100% (`DocsView`).

**D8.** Kolumna „Próbki” w geofence — z modelu, nie zawsze `2` (`GeofenceView`).

**D9 (legacy NAPRAWY — JSONLogic / workflow runtime).**  
JSONLogic / akcje workflow w runtime — realna semantyka, nie atrapa UI.  
> **Uwaga numeracji (Sebastian 2026-09-24):** to **NIE** jest Fala-1-D9. Fala-1-D9 = cienie/promienie/`!important` (chrome wizualny). Ten punkt JSONLogic zostaje na późniejsze fale (tu: „D9-legacy-JSONLogic”).

**D10.** Pozostałe ATRAPA / CZĘŚCIOWO z `02_FASADA.md` poza D1–D9 — domknięcie wierszy fasady (priorytet ATRAPA → CZĘŚCIOWO).

**D11.** Hardcoded toasty / copy PL w store i widokach kolidujące z i18n (nakłada się z D19; tu: ścieżki wskazane w C1 przed pełnym audytem C3).

**D12.** Sub faktur „tydzień 38 · 14–20.09.2026” — z daty seedu / zegara zamrożonego, nie literał (`InvoicesView`).

**D13.** Adapter telematyki SCX / integracje PORZUCONE spoza SPA — decyzja: podpiąć makietę albo wyciąć z UI obietnic.

**D14.** Martwy / podwójny silnik mapy — porządek Leaflet vs pozostałości (szczegół MapLibre → D15 / D21).

**D15.** Usunąć lub izolować porzucony MapLibre / `CorridorMap.leaflet.tsx` (żywy silnik = Leaflet). Powiązane z **D21**.

**D16-legacy-force-majeure.** Force-majeure / opóźnienia — mechanizm ryzyk bez atrap (rozszerzenie po SE road).  
> **Uwaga numeracji (Sebastian 2026-09-24):** to **NIE** jest Fala-1-D16. Fala-1-D16 = motyw per rola + `data-theme` bez klasy `dark`.

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
**DONE 2026-09-24** — żywy silnik = Leaflet (`CorridorMap.tsx`); usunięto dep `maplibre-gl`, duplikat `CorridorMap.leaflet.tsx`, `public/map-styles/`, kaskadę `MAP_STYLE`/`demotiles` w `corridor.ts`, selektory `.maplibregl-*` w `index.css`.

**D22. Wersjonowanie i migracja magazynu trwałego.**  
Z pliku 07. Klucz `watch-tower-ui-v6-ready-gate` bez wersjonowania schematu. Na produkcji użytkownik po aktualizacji czyta stan w starym kształcie i nie wie o tym. Numer wersji w magazynie, sprawdzenie przy starcie, migracja albo czyste wyczyszczenie z komunikatem.

**D23. Testy regresji importu harmonogramu.**  
Z pliku 07: naprawione pod P9, bez testów automatycznych. Przy awarii funkcja **kasuje harmonogram klienta**. Minimum pięć wariantów pliku: poprawny, pusty, z inną kolejnością kolumn, ze zmienionymi nagłówkami, z wierszami niespełniającymi walidacji. Każdy sprawdza, że istniejące dane przetrwały.  
*(PR #1 — unit testy `tests/schedule-import.test.ts` — squash-merge na `main` 2026-09-24; to nie zamyka pełnego D23 na skali produkcyjnej — patrz Fala 3.)*

**D24. Pełny przebieg czternastu prób.**  
Z pliku 07: po P9 wykonano tylko sprawdzenia skupione. Do wykonania na aktualnej paczce, z sumą kontrolną paczki w raporcie.  
**DONE 2026-09-24** — raport [`docs/qa-start/D24_14_CLICK.md`](../qa-start/D24_14_CLICK.md): **SHIP 14/14**; appChecksum `d91ce4c3786451f20adf3ec8fead38c8d39dc8ed5a464ebb67c84a24762474fa` (`index-BqvbHwzw.js`); HEAD `86050d10`.

---

## Brama CI / lokalna (2026-09-24)

- **Wybór:** hak `pre-push` (opcja 2) — `.githooks/pre-push` uruchamia `git lfs pre-push`, `npm run test:unit`, `npx playwright test`. `core.hooksPath=.githooks`.
- Billing Actions nadal leży → workflow nie biegnie na GitHub; `unit.yml` ma już `actions/checkout@v4` z `lfs: true` na przyszłość.
- Do czasu działającego CI: po **każdym** commicie Fali 1 wpisywać liczby (nie „zielone”): `test:unit N/N`, `playwright N/N`, `visual 720/720` (bez regeneracji wzorca).

## Fale (plan Sebastiana 2026-09-24)

### Fala 0 — testy / bezpieczeństwo regresji
- **D23** — unit testy importu (PR #1 na `main`)
- **D24** — pełny przebieg 14 prób — **DONE** → [`D24_14_CLICK.md`](../qa-start/D24_14_CLICK.md) (SHIP 14/14)

### Fala 1 — sprzątanie mapy + chrome (START 2026-09-24)
- **D21** — DONE — usuń martwy MapLibre.
- **D9** (Fala 1) — DONE — cienie / promienie ≤2px / sprzątanie `!important`. **≠** D9-legacy-JSONLogic.
- **D16** (Fala 1) — DONE — motyw per rola (KSH light, HHL/SCX dark) + `data-theme` only (bez Tailwind `dark`). **≠** D16-legacy-force-majeure.
- **D1 inventory (D1a)** — DONE — [`D1_TAILWIND_INVENTORY.md`](./D1_TAILWIND_INVENTORY.md). **Removal jeszcze NIE.**
- **Następne (NIE START):** D1 removal (strip TW) / D2.

#### Fala-1-D9 — szczegóły
- Soft `box-shadow` → `none`: `.docpreview`, `.wf-creator`, `.sched-col-menu` (toasty już `none`).
- Radius: inline toast/driver `3→2`; kontrole CSS już `2px`; **kept** `.wf .sw` `border-radius:9px` (= Claude SoT switch track); `50%` dots OK.
- `!important` usunięte gdzie da się specificity; **kept** (Leaflet/a11y): reduced-motion, leaflet popup/attribution/bar, grid2-map leaflet fill, `.wt-marker` transparent.
- 1px rule shadows kept: `th.stick` (−1px rule), `.wt-dot` ring `0 0 0 1px`.

#### Fala-1-D16 — szczegóły
- `applyThemeToDom`: tylko `data-theme` na `<html>`; `classList.remove('dark')` (bez Tailwind toggle).
- `defaultThemeForRole`: KSH → light; HHL/SCX → dark (bez zmian).
- `setRole` / `initTheme` / `onRehydrateStorage`: gdy `!themeManual`, wymuszają motyw roli (stale persist nie trzyma dark na KSH).
- Manual `setTheme` / `toggleTheme` → `themeManual=true` (bez zmian).
- Unit: `tests/theme-role.test.ts` (5). `index.html` boot `data-theme="dark"` (HHL-first).

### Postęp Fala 1

| Item | Commit | Pliki | test:unit | playwright | visual | Bundle JS (bytes) | Bundle CSS (bytes) |
|---|---|---|---|---|---|---|---|
| D21 | `58a509a8341cf455f1dbab60d41c1dc2107af2a5` | `package.json`, `package-lock.json`, `src/lib/corridor.ts`, `src/index.css`, −`src/components/map/CorridorMap.leaflet.tsx`, −`public/map-styles/` | **8/8** | **4/4** | smoke **4/4** (720 deferred) | 2073585 → **2073339** (−246); sha256 `d91ce4c3…` → `7cd831c2…` (`index-CAL_24W1.js`) | 65554 → **65461** (−93); sha256 `320c485d…` → `7bcd6d50…` (`index-Db6djQzs.css`) |
| **D9** (Fala 1 — chrome wizualny; ≠ D9-legacy-JSONLogic) | `cb41781d5a17eb58342c99d246a2f9c100ffe6f1` | `src/index.css`, `Toasts.tsx`, `DriverPwa.tsx` | **8/8** | **4/4** | smoke **4/4** (720 deferred) | n/a (CSS/chrome only) | n/a |
| **D16** (Fala 1 — motyw/rola; ≠ D16-legacy-force-majeure) | `230e876e3998916fa92275569660540e8af2f2ca` | `src/lib/theme.ts`, `useTowerStore.ts`, `tests/theme-role.test.ts`, `tests/setup.ts` | **13/13** | **4/4** | smoke **4/4** (720 deferred) | n/a (behaviour) | n/a |
| **D1a** inventory (≠ D1-legacy-route-alts; removal = next) | `de851b80cee33f31c129e1bbfddb337808c41e60` | `docs/handover/D1_TAILWIND_INVENTORY.md` (+ NAPRAWY) | **13/13** | **4/4** | smoke **4/4** (720 deferred) | n/a (docs-only) | n/a |

### Fala 1–2 (pozostałe)
- Kolejność pozostała jak niżej; **D1 removal** / D2 **nie rozpoczęte** (inventory D1a DONE).

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
2. **Fala 0:** D23 (unit) ✓ → D24 (14 prób) ✓ — raport D24_14_CLICK.md.  
3. Najpierw bezpieczne tooling/i18n (D19, D22), potem atrapy funkcji (D20, D1–D9), potem sprzątanie (D15/D21).  
4. **Fala 3:** D26 (zgoda na usunięcia w UI) + skala ~70+ + visual CI.  
5. D18 (oznaczenie demo) można zrobić wcześnie — zero zmiany logiki stawek.

---

*Koniec zakresu. D24 zamknięte. Fala 1: D21+D9+D16+D1a DONE. Nie startować D1 removal / D2 / D26 / legacy bez osobnego START.*
