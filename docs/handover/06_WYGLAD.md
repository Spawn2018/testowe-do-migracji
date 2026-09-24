# C5 · Wygląd — tokeny, siatka, referencja wizualna

| Pole | Wartość |
|---|---|
| Data | **2026-09-23 ~22:01 CEST** (Europe/Warsaw) |
| Zakres | C5 (rozstrzygnięcie SoT) + start `06_WYGLAD` (tokeny / siatka / skala / breakpointy / kroje / ikony / kafelki) |
| Metoda | `rg` + `Read` na `src/` i trzech makietach HTML; porównanie cech v2.0 vs v1 |
| Kod produktu | **bez zmian** (tylko docs + nagłówki NIEAKTUALNE na archiwalnych HTML) |
| Commit | **nie** |

---

## 0. Werdykt C5 (skrót)

| Pytanie | Odpowiedź |
|---|---|
| **Wobec której ref zbudowano obecną app?** | **Claude v2.0** — obecne są **wszystkie trzy** cechy diagnostyczne v2.0 (patrz §1). Komentarz w CSS: `/* Claude makieta v2.0 CSS 1:1 */` (`src/index.css:9`). |
| **Kanoniczna od teraz (jedna)** | **`claude-v2.0/tower-makieta.html`** (= `index.html`, te same bajty) — ścieżki: `/workspace/watch-tower/claude-v2.0/`, mirror `docs/watch-tower/claude-v2.0/`, `design/claude-v2.0/` (md5 `1b707795…`). Deklaracja: `CLAUDE_V2_SOT.md`. |
| **Pozostałe** | v1 = archiwum. Nagłówki **NIEAKTUALNE** (preferowane vs `docs/archiwum/` — katalogu nie tworzono). |

**Cechy v2.0 w app:** stage `.kb` cyfry **TAK** · waybill + perforacja **TAK** · baner krytyczny ukośne pasy **TAK**.

---

## 1. C5.1 — wobec której referencji zbudowano app (dowody)

Trzy pliki na dysku to **różne** artefakty (rozmiar / md5):

| Ref | Ścieżka (canon poza app) | Rozmiar | md5 (HTML) | Rola |
|---|---|---|---|---|
| **v2.0** | `/workspace/watch-tower/claude-v2.0/tower-makieta.html` | 107 360 B | `1b707795437eacbc3de1fa28469f5148` | **SoT** |
| v1 visual-ref | `/workspace/watch-tower/claude-visual-ref/tower-makieta.html` | 92 231 B → +banner | `964fe808…` (przed bannerem) | archiwum |
| v1 root | `/workspace/watch-tower/claude-makieta.html` | = visual-ref (identyczny przed bannerem) | j.w. | archiwum |

Koordynator (etap 0 / `CLAUDE_V2_SOT.md`): v2.0 = visual SoT. UX briefy (`VISUAL_BRIEF.md`, `UX_MAP.md`) nadal **linkują** v1 HTML — treść polityki (Barlow, tokeny) OK; **ścieżka HTML SoT = v2.0** (to domknięcie C5).

### 1.1 Test trzech cech v2.0 (ETAP_C_PROMPT C5)

| Cecha v2.0 | v2.0 makieta | v1 makiety | **App (obecna)** |
|---|---|---|---|
| Pasek etapów — cyfry podpowiedzi klawiszy w rogu (`.stage .kb`) | TAK (`tower-makieta.html:93`, markup `:949`) | **BRAK** (brak `.kb`; `.stage .n` = 26px) | **TAK** — CSS `src/index.css:93–95` (+ lock `:774–776`); markup `CorridorSpine.tsx:59` (`<span className="kb">{i + 1}</span>`) |
| Nagłówek szuflady list przewozowy + linia perforacji (`.wb-code` / `.wb-fields` / `.perf`) | TAK (`:325–333`, drawer `:1572–1586`) | **BRAK** (tylko `.drawer-hd` + `h3`) | **TAK** — CSS `index.css:331–339`; markup `LoadDrawer.tsx:133–172` (`wb-code`, `wb-fields`, `<div className="perf" />`) |
| Baner krytyczny — ukośne pasy u góry (`.banner.red::before` + `repeating-linear-gradient(45deg,…)`) | TAK (`:291–293`, użycie `:1098`) | **BRAK** `repeating-linear` | **TAK** — CSS `index.css:297–299`; użycie `DashboardView.tsx:54` (`className="banner red"`), też `LoadDrawer.tsx:282` |

**Wniosek:** app została przebudowana / zamrożona wobec **Claude v2.0**, nie wobec v1. Sam komentarz w `index.css:9` to potwierdza.

Dodatkowe markery v2.0 obecne w app (poza trzema testowymi):

- SVG ikony nav (`ClaudeIcon.tsx` — komentarz „1:1 from tower-makieta.html”; v1 = glify Unicode / `font-size:14px` w `.glyph`)
- Motyw tablicy wyróżniającej: `td.over`, `.board` (`index.css:300–307`; `LoadDrawer.tsx:198`)
- Skala typograficzna v2: `.kpi .v` **42px**, `.stage .n` **30px** (v1: 29 / 26)
- `.ops` pasek promowy w topbarze (`Topbar.tsx:139`)
- Style `.skel` / `.empty` / `.kbdpanel` skopiowane z v2 CSS

---

## 2. C5.2 — kanoniczna referencja od teraz

**Jedna kanoniczna:** `claude-v2.0/tower-makieta.html`

| Kopia | Ścieżka | Status |
|---|---|---|
| Canon (poza app) | `/workspace/watch-tower/claude-v2.0/` | SoT |
| Mirror w app docs | `docs/watch-tower/claude-v2.0/` | SoT (ten sam md5) |
| Mirror design | `design/claude-v2.0/` | SoT (ten sam md5) |
| Meta | `CLAUDE_V2_SOT.md`, `README.txt` | obowiązujące |

**Archiwum v1** (nie mierzyć fidelity vs te pliki):

| Plik | Nagłówek NIEAKTUALNE |
|---|---|
| `docs/watch-tower/claude-makieta.html` | TAK (C4 — sticky banner + komentarz) |
| `docs/watch-tower/claude-visual-ref/tower-makieta.html` | TAK (C4) |
| `docs/watch-tower/claude-visual-ref/README.md` | TAK (C4) |
| `docs/watch-tower/claude-visual-ref/extracted.css` | TAK (C4) |
| `/workspace/watch-tower/claude-makieta.html` | **dodany C5** (banner jak C4) |
| `/workspace/watch-tower/claude-visual-ref/tower-makieta.html` | **dodany C5** |

`docs/archiwum/` **nie** tworzony — zgodnie z preferencją C4 (nagłówek w miejscu).

**Uwaga docs:** `VISUAL_BRIEF.md` / `VISUAL_ALIGN_CLAUDE.md` / `UX_MAP.md` nadal wskazują w tabelach ścieżkę v1 — polityka Barlow/tokenów pozostaje **TAK**; przy otwieraniu makiety używać **v2.0**. Skala w §1 briefu (KPI 29 / spine 26) = liczby **v1** — w v2.0/app: **42 / 30**.

---

## 3. C5.3 — różnice app vs kanoniczna v2.0 (fakty, bez oceny)

Chrome CSS v2.0 jest wbudowany w app (`index.css` linie ~11–348 ≈ extract z makiety). Poniżej **odchylenia / nadbudowy**, nie werdykt FAIL/PASS.

### 3.1 Warstwa technologii (makieta = jeden HTML; app = SPA)

| Fakt | Makieta v2.0 | App |
|---|---|---|
| Runtime | statyczny HTML+JS w jednym pliku | React + Vite + Zustand (`src/`) |
| Mapa | schemat SVG korytarza w makiecie | MapLibre GL + Leaflet (`CorridorMap.tsx` / `.leaflet.tsx`); kontener nadal `.mapbox` |
| Dane | seed wbudowany w HTML | `src/data/seed.ts` + localStorage + import XLSX |
| i18n | obiekty T() w makiecie | `src/i18n/messages.ts` (PL/EN/SV) |
| Tailwind | brak | `@import "tailwindcss"` + `@theme` font aliases (`index.css:1–7`) — **nie** osobna skóra; tokeny Claude w `:root` |

### 3.2 CSS / chrome

| Fakt | Szczegół |
|---|---|
| Blok „SPA extras” | od `index.css:349` — collapse nav, `button.kpi`, `exq-row`, toast, Leaflet/MapLibre overrides, Options/Workflow pages, `--wt-*` aliasy |
| Duplikat lock spine | reguły `.corridor` / `.stage` / `.kb` powtórzone ~`index.css:760–786` („Lock Claude corridor spine…”) |
| `.skel` | CSS obecny (`:324`); **brak** użycia w `*.tsx` |
| `.empty` | CSS obecny (`:325–328`); **brak** `className="empty"` w `*.tsx` |
| Promień / cienie | jak v2: kontrole `border-radius:2px`, panele bez soft shadow (toasty: `box-shadow:none`) |

### 3.3 Shell / widoki obecne w app, których makieta nie ma jako osobnych „produktowych” ekranów SPA

Makieta ma te same **zakładki** koncepcyjnie; app ma pełne widoki React + logikę (Options rate editor, Workflows creator, Geofence, Docs, Finance, Driver PWA, Tasks…). To różnica **funkcji pod chromem**, nie druga skóra — zgodne z mandatem „look 1:1, functions underneath”.

### 3.4 Mapa / kafelki (produkt ≠ schemat makiety)

| Fakt | Wartość |
|---|---|
| Domyślny styl | lokalne `public/map-styles/{dark,light}.json` — raster **tile.openstreetmap.de** |
| Attribution w stylu | `© OpenStreetMap contributors` |
| Fallback | MapLibre demotiles (`demotiles.maplibre.org/style.json`); opcjonalnie OpenFreeMap |
| Override | `VITE_MAPTILER_KEY` → MapTiler dataviz-dark / streets-v2 (`corridor.ts:61–75`) |
| Leaflet ATTR string | OSM + CARTO + Esri (`CorridorMap.tsx:29`) |
| Makieta | brak kafelków OSM — czysty SVG |

### 3.5 Ikony

| Fakt | Wartość |
|---|---|
| Nav / theme / ferry | inline SVG w `ClaudeIcon.tsx` (klucze: dash, map, sched, risk, docs, fin, inv, wf, geo, options, tasks, ferry, theme) — port z v2 `ICONS` |
| Bell | osobny SVG stroke w `NotificationBell.tsx` (nie z zestawu ClaudeIcon) |
| Drawer close | znak `✕` (Unicode) w `LoadDrawer.tsx:140` |
| v1 | glify tekstowe w `.glyph` (nie ten SoT) |

### 3.6 Typografia — liczby SoT (v2.0 = app)

| Element | v1 | **v2.0 / app** |
|---|---|---|
| `.stage .n` | 26px | **30px** |
| `.kpi .v` | 29px / lh 1.05 | **42px** / lh 1 |
| `.wb-code` | — | 31px |
| body | 14px / lh 1.45 | to samo |
| brand | Condensed 23px / 700 / .06em | to samo |

---

## 4. Tokeny kolorów (SoT = v2.0 = `src/index.css:11–48`)

### Light (`:root` / `data-theme="light"`)

| Token | Hex |
|---|---|
| `--page` | `#E3E9ED` |
| `--surface` | `#FFFFFF` |
| `--surface-2` | `#F4F7F9` |
| `--surface-3` | `#EAEFF3` |
| `--ink` | `#0E1A24` |
| `--ink-2` | `#3C4E5C` |
| `--ink-3` | `#6C7D8A` |
| `--rule` | `#C9D5DD` |
| `--rule-2` | `#DEE6EB` |
| `--amber` / `--amber-bg` | `#C97E12` / `#FBEFD9` |
| `--red` / `--red-bg` | `#B32639` / `#F8DEE2` |
| `--go` / `--go-bg` | `#1B6E5D` / `#DCEDE8` |
| `--sea` / `--sea-bg` | `#245C87` / `#DCE8F1` |
| `--plan` / `--plan-bg` | `#6C7D8A` / `#E6ECF0` |
| `--focus` | `#1D6FB8` |

### Dark (`:root[data-theme="dark"]` + `prefers-color-scheme` gdy nie light)

| Token | Hex |
|---|---|
| `--page` | `#080F15` |
| `--surface` / `-2` / `-3` | `#101C25` / `#16242F` / `#1D2E3A` |
| `--ink` / `-2` / `-3` | `#DCE7EE` / `#A4B6C2` / `#748896` |
| `--rule` / `--rule-2` | `#263A48` / `#1C2B36` |
| `--amber` / bg | `#E5A544` / `#3A2C12` |
| `--red` / bg | `#E8687C` / `#3B1720` |
| `--go` / bg | `#4FB79E` / `#0F2B27` |
| `--sea` / bg | `#6BA8D6` / `#12283A` |
| `--plan` / bg | `#7E93A1` / `#1A272F` |
| `--focus` | `#5AA6E8` |

Aliasy produktowe `--wt-*` (`index.css:429+`) mapują 1:1 na powyższe — nie druga paleta.

First-paint motyw (z briefu / produktu): HHL+SCX → dark; KSH → light.

---

## 5. Siatka / shell

```
.app          grid-template-rows: auto auto 1fr; height 100%
├── .topbar   height 52px; padding 0 14px; gap 18px
├── .corridor padding 9px 14px 11px; .corridor-inner min-width 940px
└── .body     grid-template-columns: 186px 1fr
    ├── nav   border-right; amber 3px aria-current
    └── main  scroll
(+ .scrim + .drawer — overlay, poza gridem)
```

| Element | Spec |
|---|---|
| KPI | `.kpis` 3 kolumny, border-top rule-2; bez gap/shadow |
| `.grid2` | `1.35fr 1fr` gap 0 |
| `.mapsplit` | `1.25fr 1fr` |
| `.kv` | `150px 1fr` |
| Radius kontrolek | **2px** |
| Nav current | `border-left-color: var(--amber)` |

Collapse: klasa `.app.nav-collapsed` → `56px` (SPA extra; makieta robi to media-query).

---

## 6. Breakpointy (z CSS SoT + SPA)

| Max-width | Efekt |
|---|---|
| **1240px** | `.ops .lb`, `.ops .sep` ukryte |
| **1100px** | `.grid2` → 1 kol; `.body` → `56px 1fr`; ukryte `nav .lbl` + `.count` |
| **1000px** | `.mapsplit` → 1 kol |
| **820px** | `.two` → 1 kol |

Safe-area: `env(safe-area-inset-*)` na `:root` / `html` / `.kbdpanel`.

`prefers-reduced-motion: reduce` → wyzerowane transition/animation.

---

## 7. Kroje (fonts)

| Użycie | Krój | Wagi (ładowane) |
|---|---|---|
| UI body | **Barlow** | 400, 500, 600, 700 |
| Brand, KPI, spine, kody, tablice, kbd | **Barlow Condensed** | 500, 600, 700 |

Źródło: Google Fonts w `index.html:8–10` (ten sam URL co makieta).

**Licencja kroju:** Barlow / Barlow Condensed — **SIL Open Font License 1.1** (typowo przez Google Fonts; plik OFL nie jest vendoringowany w repo — lokalnie fallback `Helvetica Neue`, Arial).

**FAIL:** IBM Plex / Inter / Roboto / Poppins jako primary (nadpisane etapy anti-slop — zob. `09_INDEKS_WIEDZY.md`).

---

## 8. Ikony

- Zestaw kanoniczny: inline SVG 20×20 z makiety v2.0 → `src/components/shell/ClaudeIcon.tsx`.
- Nav: `glyph` 18×18 (`index.css:115–116`).
- Brak Lucide / Heroicons / MDI jako primary set.

---

## 9. Kafelki mapy — źródła i licencje (znalezione w repo)

| Źródło | Gdzie | Licencja / attribution (wg plików) |
|---|---|---|
| **OpenStreetMap** raster (`tile.openstreetmap.de`) | `public/map-styles/dark.json`, `light.json` | `© OpenStreetMap contributors` (ODbL dla danych OSM) |
| MapLibre demotiles | `corridor.ts` `MAP_STYLE.demotiles` | demo MapLibre (fallback) |
| OpenFreeMap | `openfreemap.org/styles/…` | opcjonalny; własna polityka kafelków OFM |
| MapTiler | gdy `VITE_MAPTILER_KEY` | licencja MapTiler wg klucza konta |
| CARTO / Esri | string ATTR w Leaflet | wymienione w `CorridorMap.tsx:29` |
| Glyphy demo | `demotiles.maplibre.org/font/…` w JSON stylu | MapLibre demo fonts |

Makieta v2.0 **nie** używa tych kafelków (SVG). Attribution UI: kontrolki Leaflet/MapLibre stylizowane pod Claude (`index.css:396–410`).

---

## 10. Motyw „tablica wyróżniająca” (v2.0 — trzy miejsca)

Komentarz SoT (`index.css:291–296` / makieta): ukośne pasy **tylko** w:

1. górna krawędź `.banner.red::before`
2. lewa krawędź `td.over::before`
3. miniatura `.board` przy wymiarach w szufladzie

Czwarte użycie = złamanie motywu (reguła z makiety, nie ocena app).

---

## 11. Pliki do otwarcia przy bramie wizualnej

1. **SoT:** `design/claude-v2.0/tower-makieta.html` lub `docs/watch-tower/claude-v2.0/tower-makieta.html`
2. **App CSS:** `src/index.css` (blok v2 + SPA extras)
3. **Shell:** `Topbar.tsx`, `Nav.tsx`, `CorridorSpine.tsx`, `ClaudeIcon.tsx`, `LoadDrawer.tsx`
4. **Meta SoT:** `design/claude-v2.0/CLAUDE_V2_SOT.md`
5. **Indeks:** `09_INDEKS_WIEDZY.md` (C4)

**Nie** otwierać jako SoT: `claude-makieta.html`, `claude-visual-ref/*` (v1 — NIEAKTUALNE).

---

## 12. Poza zakresem tego pliku

- Macierz fidelity C2.3 — **nie** rozpoczęta (zakaz w zadaniu).
- Naprawy UI / pixel gate — etap D / C2.
- Commit — brak.
