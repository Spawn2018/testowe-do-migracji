# NAPRAWY — Etap D (kanon Sebastian D1–D26 + L* legacy)

| Pole | Wartość |
|---|---|
| Data zapisu | **2026-09-24** Europe/Warsaw |
| Status | **Fala 1 ACCEPTED** · trzy domknięcia (D21/D9/D16 + D1/D2/GATE) · **GO Fala 2 po odpowiedzi D7** (ta odpowiedź jest poniżej; bez startu kodu Fali 2 poza dokumentacją D7) |
| Repo | `Spawn2018/testowe-do-migracji` · branch `main` |
| Kod produktu | Fala 2 **nie** startuje tu (poza closeout D9/stylelint + proof D2) |

---

## Tabela translacji (stary numer → nowy)

Stary zakres NAPRAWY mieszł etykiety Sebastiana (Fala 1/2). **D1–D26 = wyłącznie kanon Sebastiana.** Kolidujące stare punkty dostają prefix **L** (nie „D9-legacy”).

| Stary | Nowy | Merge z D1–D26? | Status |
|---|---|---|---|
| D1 route-alts (SE ×4 Wybierz) | **L1** | nie (≠ D1 Tailwind) | OPEN |
| D2 delay-pill (`+1h 35 min`) | **L2** | nie (≠ D2 fonty) | OPEN |
| D3 warunki drogowe SE | **D3** | tak — Trafikverket live **lub** label demo | OPEN (Fala 2) |
| D4 terminy zadań (`18+i*9`) | **L4** | nie (≠ D4 voyage SoT) | OPEN |
| D5 preferencje powiadomień | **L5** | nie (≠ D5 KPI vs corridor) | OPEN |
| D6 pogoda / fale SAIL_ROWS | **D6** | zachowane (nie w skrócie fal, unikalne) | OPEN |
| D7 DRAWING % hardcode | **L7** | nie (≠ D7 BAF/SEFS) | OPEN |
| D8 geofence „Próbki”=2 | **L8** | nie (≠ D8 timezones) | OPEN |
| D9 JSONLogic / workflow runtime | **L9** | nie (≠ D9 chrome) | OPEN |
| D10–D15, D17–D19 | **D10–D15, D17–D19** | bez kolizji z falami F1 | OPEN (wg opisu) |
| D16 force-majeure | **L16** | nie (≠ D16 theme/rola) | OPEN |
| D18 stawki demo label | **D18** | tak | OPEN |
| D20 faktury trójstronne | **D20** | tak | OPEN (Fala 2) |
| D21 MapLibre | **D21** | tak | **DONE** Fala 1 |
| D22 store versioning | **D22** | tak | OPEN (Fala 2) |
| D23 import regression | **D23** | tak | PARTIAL Fala 0 |
| D24 14-click | **D24** | tak | **DONE** Fala 0 |
| D26 import removals + UI consent | **D26** | tak | PLAN only (Fala 3) |
| *(brak w starym)* voyage SoT | **D4** | nowy kanon Sebastian | OPEN (Fala 2) |
| *(brak w starym)* KPI vs corridor | **D5** | nowy kanon Sebastian | OPEN (Fala 2) |
| *(brak w starym)* BAF/SEFS formula | **D7** | nowy kanon Sebastian | **ANSWERED** (poniżej; fix = Fala 2) |
| *(brak w starym)* timezones last | **D8** | nowy kanon Sebastian | OPEN (Fala 2) |
| D1 Tailwind / D2 fonty / D9 chrome / D16 theme | **D1 / D2 / D9 / D16** | kanon Fala 1 | **DONE** (+ D9 stylelint closeout 2026-09-24) |

---

## Kanon Sebastian — D1–D26

### D1 — Tailwind remove
**DONE Fala 1** — usunięto Tailwind; role CSS + preflight compensation. ≠ L1.
- Removal SHA: `0dcea24c63e7526992b1eac9747efcef926affd3`
- Inventory: [`D1_TAILWIND_INVENTORY.md`](./D1_TAILWIND_INVENTORY.md) `de851b80…`
- Testy: `test:unit` **13/13**; playwright **4/4**

### D2 — fonts / `--tw-` w built CSS
**DONE Fala 1** + **proof closeout 2026-09-24**. ≠ L2.
- Fix kaskady Leaflet→Barlow: `e586ea07…`
- **Proof (`npm run build` → greps):**
  - `grep -c -- '--tw-' dist/assets/*.css` → **0**
  - `font-family` unique w built CSS:
    - `Barlow Condensed`
    - `Barlow Condensed,Barlow,Arial,sans-serif`
    - `Barlow,Arial,sans-serif`
    - `Barlow,Helvetica Neue,Arial,sans-serif` (Claude SoT fallbacks)
    - `var(--font-cond)` / `var(--font-mono)` (= Barlow Condensed stacks w `:root`)
    - **Uwaga:** nadal występuje vendor `Helvetica Neue,Arial,Helvetica,sans-serif` z `leaflet/dist/leaflet.css` w bundle — **nadpisywany** późniejszym `.leaflet-container{font:12px "Barlow",…}` w `src/index.css`. Runtime = Barlow. Nie regenerowano baseline.
- Testy Fala-1-D2: `test:unit` **13/13**; playwright **4/4**

### D3 — Trafikverket live OR demo label
OPEN (Fala 2). Warunki drogowe SE — endpoint na żywo **albo** jawna etykieta demo (wzorzec jak D18).

### D4 — single voyage source of truth
OPEN (Fala 2). Jedno źródło prawdy rejsu/ładunku (≠ L4 terminy zadań UI).

### D5 — KPI vs corridor
OPEN (Fala 2). Spójność KPI z korytarzem (≠ L5 preferencje notyfikacji).

### D6 — pogoda / fale `SAIL_ROWS`
OPEN. Źródło prawdziwe lub oznaczenie demo (`RisksView`).

### D7 — surcharge / BAF / SEFS formula — **ANSWER FIRST**
**ODPOWIEDŹ (bez zmiany kodu produktu):**

| Pole | Wartość |
|---|---|
| Plik | `src/lib/sefs.ts` |
| Funkcja | `computeSefs` |
| Linie | **50–59** (rdzeń); apply: `62–63`; pricing: `src/lib/pricing.ts` **53–54** |
| Model | **hybrid_min** |
| Formuła | `appliedMult = Math.min(multSek, multPln)` gdzie `multSek = lookupMult(priceSek, SEFS_SEK)`, `multPln = lookupMult(pricePln, SEFS_PLN)` |
| Apply do stawki | `applySefsToRoadRate`: `round2(roadBaseRate * appliedMult)` — **tylko** road freight; ferry eco / demurrage / extras poza SEFS (`pricing.ts` 37–39, 55–58) |
| Dowód biznesowy | `docs/handover/03_PARAMETRY_BIZNESOWE.md` §2 |

Fix produktowy (jeśli rozjazd vs kontrakt) = **Fala 2** — nie w tym closeout.

### D8 — timezones last
OPEN (Fala 2). Strefy czasowe na końcu (≠ L8 geofence samples).

### D9 — chrome shadows / radii / `!important` + stylelint
**DONE Fala 1** + **stylelint closeout 2026-09-24**. ≠ L9.

#### Closeout 2026-09-24 (pomiar → fix → greps)
**Przed:** box-shadow≠none **2** · radius>2px **1** · !important **28** (13 linii).

**Zmiany (bez psucia Claude SoT):**
- `th.stick,td.stick`: `box-shadow:-1px 0 0 var(--rule)` → `border-left:1px solid var(--rule)`
- `.wt-dot`: `box-shadow:0 0 0 1px rgba(0,0,0,.25)` → `outline:1px solid rgba(0,0,0,.25)`
- `.wf .sw`: `border-radius:9px` → `50%` (tor 32×18 nadal pill/elipsa)
- Usunięto `!important` z popup/bar/attribution kolorów, `.grid2-map-body .leaflet-container`, `.wt-marker` (kaskada po `leaflet.css`)

**FINAL greps (`src/index.css` only, bez bak):**
- box-shadow≠none: **0**
- border-radius>2px: **0**
- !important token count: **11** (6 linii)

**Leftover `!important` — uzasadnienie (NIE `stylelint-disable`):**

| Miejsce | Dlaczego zostaje |
|---|---|
| L55 `@media (prefers-reduced-motion:reduce) *` ×2 | a11y: musi przebić dowolne `transition`/`animation` |
| L210 `.leaflet-container …-pane svg` ×3 | Leaflet sam ustawia `max-width/height:none !important` |
| L392 `.leaflet-attribution-flag` ×2 | pin 12×8 vs stretch SVG / reguły Leaflet `!important` |
| L841 `[hidden]:where(…)` ×1 | preflight: `display:none` musi wygrywać z utility/display |
| L843–844 tile/marker `img` ×3 | pin vs `img{max-width:100%}` + Leaflet `!important` na tiles |

**Tooling:**
- `.stylelintrc.json` — dokładnie wersja Sebastiana (ignore `tower.css` / `node_modules` / `dist` / `shots-baseline`)
- `npm i -D stylelint stylelint-config-standard stylelint-declaration-strict-value`
- script `lint:css`: `stylelint "src/**/*.css"`
- **stylelint one-line:** `492 problems (492 errors, 0 warnings)` — z czego triad: `declaration-no-important` **11** (= justified above); `declaration-property-value-allowed-list` dla shadow/radius: **0**. Reszta = flood `declaration-block-single-line-max-declarations` (264), `rule-empty-line-before` (49), `no-duplicate-selectors` (40), odd-px `declaration-property-value-disallowed-list` (38), font-family generic (30), itd. **Poza zakresem tego closeout** (nie przepisujemy całego design systemu / formatowania 1-linijkowego CSS).

Commit D9+stylelint: patrz tabela postępu.

### D10 — pozostałe ATRAPA / CZĘŚCIOWO z `02_FASADA.md`
OPEN (poza D1–D9 Fala 1).

### D11 — hardcoded toasty / copy PL vs i18n
OPEN (nakłada się z D19).

### D12 — sub faktur „tydzień 38…” z seedu/zegara
OPEN.

### D13 — adapter telematyki SCX / PORZUCONE
OPEN.

### D14 — martwy / podwójny silnik mapy
OPEN (żywy = Leaflet; resztki → D15/D21 DONE częściowo).

### D15 — izolacja porzuconego MapLibre / duplikatów
OPEN / w większości pokryte przez **D21 DONE**.

### D16 — theme per role (`data-theme`, bez `dark` class)
**DONE Fala 1**. ≠ L16. SHA `230e876e…`. Unit theme **5** w `tests/theme-role.test.ts`. `test:unit` **13/13**; playwright **4/4**.

### D17 — luk fasady CZĘŚCIOWO (C1)
OPEN.

### D18 — stawki demo label (+ przełącznik)
OPEN. Ten sam wzorzec etykiety co D3 gdy label zamiast live.

### D19 — 104 hardcode stringi i18n (C3)
OPEN.

### D20 — three-way invoice match
OPEN (Fala 2). Policzyć naprawdę: zaznaczone vs zrealizowane vs cennik.

### D21 — MapLibre remove
**DONE Fala 1**. SHA `58a509a8…`. `test:unit` **8/8** (wówczas); playwright **4/4**.

### D22 — store versioning / migracja
OPEN (Fala 2).

### D23 — import regression tests
PARTIAL Fala 0 — `tests/schedule-import.test.ts` na `main`; pełna skala produkcyjna = Fala 3.

### D24 — 14-click
**DONE** — [`docs/qa-start/D24_14_CLICK.md`](../qa-start/D24_14_CLICK.md) SHIP **14/14**; HEAD wówczas `86050d10`.

### D25 — *(rezerwa — brak osobnego kanonu w falach; nie używać bez START)*

### D26 — import removals z UI consent
PLAN only (Fala 3) — opcja 2 Sebastian: checkbox zgody, `allowRemovals` z UI.

---

## L* — stare punkty bez merge (OPEN)

**L1.** Alternatywy trasy SE ×4 „Wybierz” — dziś toast; mają mutować load/risk (`RisksView`).

**L2.** Pill opóźnienia w drawerze — liczyć z `delayMinutes`, nie stały napis (`LoadDrawer`).

**L4.** Terminy zadań — z `plannedLoadDate` / danych load, nie `18+i*9` (`TasksView`).

**L5.** Preferencje powiadomień w Opcjach — zapis **i** filtracja przy `push`.

**L7.** Wskaźnik kompletności DRAWING — nie hardcode 100% (`DocsView`).

**L8.** Kolumna „Próbki” w geofence — z modelu, nie zawsze `2` (`GeofenceView`).

**L9.** JSONLogic / akcje workflow w runtime — realna semantyka, nie atrapa UI.

**L16.** Force-majeure / opóźnienia — mechanizm ryzyk bez atrap (rozszerzenie po SE road).

---

## Brama CI / lokalna (2026-09-24)

- Hak `pre-push`: `.githooks/pre-push` → `git lfs pre-push`, `npm run test:unit`, `npx playwright test`. `core.hooksPath=.githooks`.
- Nie pushować `.github/workflows`. Nie regenerować `shots-baseline`. Nie deploy Vercel.

## Fale

### Fala 0 — DONE / partial
- D23 unit import — partial · D24 14-click — **DONE** 14/14

### Fala 1 — **ACCEPTED / CLOSED**
- D21 · D9 (+ stylelint closeout) · D16 · D1 · D2 (+ proof) · GATE visual **720/720**
- Tag: `baseline-fala-1-2026-09-24` (bez regen PNG)

#### Postęp Fala 1 (zachowane liczby)

| Item | Commit | test:unit | playwright | visual |
|---|---|---|---|---|
| D21 | `58a509a8341cf455f1dbab60d41c1dc2107af2a5` | **8/8** | **4/4** | smoke 4/4 |
| D9 chrome | `cb41781d5a17eb58342c99d246a2f9c100ffe6f1` | **8/8** | **4/4** | smoke 4/4 |
| D16 | `230e876e3998916fa92275569660540e8af2f2ca` | **13/13** | **4/4** | smoke 4/4 |
| D1a inventory | `de851b80cee33f31c129e1bbfddb337808c41e60` | **13/13** | **4/4** | smoke 4/4 |
| D1 removal | `0dcea24c63e7526992b1eac9747efcef926affd3` | **13/13** | **4/4** | smoke 4/4 |
| D2 fonts | `e586ea07c925e1ea463d795825a009cb08845f3f` | **13/13** | **4/4** | smoke 4/4 |
| Fala 1 GATE | `2aac0a97e186485cb50c78b9808e1f0023f9ac80` | **13/13** | **4/4** | **720/720** |
| D9 stylelint closeout | `2415e11b21878cb2060c6576be02b098a0ae20f4` | **13/13** | **4/4** | no regen |
| NAPRAWY renumber + D2 proof + D7 answer | see `git log -1 -- docs/handover/NAPRAWY.md` | **13/13** | **4/4** | — |

### Fala 2 — GO po D7 answer
D3, D4 (voyage), D5 (KPI), D7 fix (jeśli potrzeba po answer), D8 timezones, D20, D22. **Nie startować w tym closeout.**

### Fala 3
D26 (plan) + skala importu + visual CI.

---

*Koniec. Fala 1 accepted. D7 answered (hybrid_min). L1/L2/L4/L5/L7/L8/L9/L16 OPEN. Fala 2 czeka na osobny START kodu.*
