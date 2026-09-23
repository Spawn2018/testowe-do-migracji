# FULL 1:1 SURFACE CHECKLIST — Claude makieta SoT

**Mandate:** App shell IDENTICAL to Claude for every button, text, layout, tab, menu, submenu, chrome. Ours only: data / functions / integrations inside that shell.  
**Gate:** adversarial squint PASS/FAIL per surface — zero “almost”.  
**Written:** 2026-09-23 ~02:35 CEST · Visual executor · **App code not modified.**

---

## SoT inventory

| Source | Path | Status |
|---|---|---|
| **Primary makieta** | `/workspace/watch-tower/claude-visual-ref/tower-makieta.html` | **SoT** (92231 B) |
| Mirror | `/workspace/watch-tower-app/public/claude-ref.html` | Byte-identical to primary |
| Copy | `/workspace/watch-tower/claude-makieta.html` | Same size; primary+mirror = gate pair |
| IDENTICAL_CLAUDE | `/workspace/watch-tower/IDENTICAL_CLAUDE.md` | Parity notes (may drift — makieta wins) |
| CLAUDE_SHELL_GATE | `/workspace/watch-tower/research-2026/CLAUDE_SHELL_GATE.md` | Prior shell gate |
| VISUAL_BRIEF | `/workspace/watch-tower/VISUAL_BRIEF.md` | Tokens / wireframe (hex may alias; makieta CSS wins) |
| START_UI_SPEC | `/workspace/watch-tower/START_UI_SPEC.md` | **MISSING** |

### Canonical chrome strings (makieta HTML/JS — ignore doc drift)

| Item | Exact SoT |
|---|---|
| Brand wordmark | **TOWER** (Barlow Condensed 23/700 / tracking .06em) |
| `<title>` | `TOWER — Stegra Boden` |
| Brand sub | `Stegra Boden · H&H Logistics` / `· KSH` / `· Scandinavian Express` |
| Role buttons | `H&H Logistics` · `KSH` · `Scandinavian Express` (ids **HHL** / **KSH** / **SCX**) |
| Role strip label PL | **Widok** (`I18N.view`) |
| Lang | PL · EN · SV |
| Theme control | ◐ · `title="Jasny / ciemny"` |
| Fonts | **Barlow** 400–700 + **Barlow Condensed** 500–700 |
| Nav home PL | **Kokpit** |
| Spine PL (9) | Przygotowanie · Załadunek · Droga PL · **Gdańsk** · Prom · Nynäshamn · Droga SE · Boden · Dostarczone |
| Drawer tabs PL | Przegląd · Przebieg · Dokumenty · Ceny · Ustalenia |
| Decision queue title | **Wymaga decyzji** |
| Decision empty | **Nic nie wymaga reakcji. Wszystkie transporty idą zgodnie z planem.** |
| Progress panel | **Postęp dostaw** · Plan / Wykonanie |
| Locked price | **Ta cena nie jest widoczna w Twojej roli.** |

**View IDs:** `dash` · `map` · `sched` · `risk` · `docs` · `fin` · `inv` · `wf` · `geo` · `tasks`  
**Drawer tab keys:** `over` · `tl` · `docs` · `money` · `chat`  
**Spine ids:** `PRE` · `ZAL` · `PL` · `GDA` · `SEA` · `NYN` · `SE` · `SITE` · `DONE`

---

## 1. Gate rules

### Scoring
- **PASS** only if pixel / layout / copy / chrome is a twin of Claude on that surface (squint + side-by-side).
- **FAIL** on any drift: wrong label, glyph, order, token, radius, type, missing/extra chrome, wrong empty string, wrong panel recipe.
- Do **not** invent surfaces Claude does not have.

### Allowed deltas (only)
1. Live/seed **data values** (counts, ETAs, codes, exception bodies, concrete banner facts) — banner/chrome shape still Claude.
2. **Map engine** (MapLibre etc.) inside Claude map chrome (`.mapsplit` / `.mapbox` / solid layers+legend).
3. **Notification bell** as extra `.iconbtn` (Claude topbar = theme + clock only).
4. **Nav footer collapse** «/» + persist; widths must remain **186 ↔ 56**. Claude itself collapses at ≤1100px via CSS only (no footer control, no topbar ☰).
5. **Extra drawer tabs** after Claude’s five — shared five labels stay Claude I18N; chrome stays `.dtabs` + amber underline.
6. **Theme first-paint by role** (product): HHL+SCX `data-theme="dark"`, KSH `light`. Makieta boots light + manual ◐ — gate compares **matched theme**; separately verify first-paint.

### Always FAIL
IBM Plex/Inter/Roboto/Poppins primary · soft SaaS KPI cards · glass KPI/spine/nav/tables · wrong brand/roles · Stegra as login role · doubled exception codes · amber chip role/lang · hollow CTAs · indigo mesh · empty black map · fake AI %.

### How to run
1. App `:4177` beside `/claude-ref.html` (or makieta file).
2. Match role + lang + theme.
3. Walk every Surface ID · shoot · fill §10.
4. Any FAIL = no ship for that surface.

---

## 2. Global chrome

### 2.1 Shell
| ID | Claude expected | ☐ |
|---|---|---|
| GC-01 | `.app` rows: auto auto 1fr (topbar · corridor · body) | |
| GC-02 | `.body` cols **186px 1fr**; ≤1100px → **56px 1fr** (hide `.lbl`+`.count`) | |
| GC-03 | `.scrim` + `.drawer` overlay (not in grid) | |
| GC-04 | No topbar ☰ | |
| GC-05 | No brand/role logo chip | |

### 2.2 Topbar (52px)
| ID | Claude expected | ☐ |
|---|---|---|
| TB-01 | h=52 · pad 0 14 · gap ~18 · surface · border-bottom 1px rule | |
| TB-02 | `<b>TOWER</b>` Condensed 23/700 / .06em | |
| TB-03 | `#brandSub` ink-3 13: `Stegra Boden · {H&H Logistics\|KSH\|Scandinavian Express}` | |
| TB-04 | Label **Widok** + role `.seg` order: H&H Logistics · KSH · Scandinavian Express | |
| TB-05 | Lang `.seg`: PL · EN · SV | |
| TB-06 | `.seg` recipe: 1px rule · radius **2** · surface-2; pressed = **ink fill / surface text** / 600 (not amber chips) | |
| TB-07 | Theme `.iconbtn` ◐ · title `Jasny / ciemny` · ~30×30 · radius 2 | |
| TB-08 | `.clock` Condensed 14 · Europe/Warsaw (sample `wt 22.09.2026 · 14:32`) | |
| TB-09 | Optional product bell = same `.iconbtn` chrome only | |

### 2.3 Theme & tokens (makieta CSS)
| ID | Claude expected | ☐ |
|---|---|---|
| TH-01 | Barlow + Barlow Condensed loaded (weights as makieta) | |
| TH-02 | Body Barlow 14 / lh~1.45 / tabular nums | |
| TH-03 | Light `:root`: page `#E3E9ED` surface `#FFFFFF` surface-2 `#F4F7F9` surface-3 `#EAEFF3` ink `#0E1A24` ink-2 `#3C4E5C` ink-3 `#6C7D8A` rule `#C9D5DD` rule-2 `#DEE6EB` amber `#C97E12` amber-bg `#FBEFD9` red `#B32639` red-bg `#F8DEE2` go `#1B6E5D` go-bg `#DCEDE8` sea `#245C87` sea-bg `#DCE8F1` plan `#6C7D8A` plan-bg `#E6ECF0` focus `#1D6FB8` | |
| TH-04 | Dark: page `#080F15` surface `#101C25` surface-2 `#16242F` surface-3 `#1D2E3A` ink `#DCE7EE` ink-2 `#A4B6C2` ink-3 `#748896` rule `#263A48` rule-2 `#1C2B36` amber `#E5A544` amber-bg `#3A2C12` red `#E8687C` red-bg `#3B1720` go `#4FB79E` go-bg `#0F2B27` sea `#6BA8D6` sea-bg `#12283A` plan `#7E93A1` plan-bg `#1A272F` focus `#5AA6E8` | |
| TH-05 | First paint HHL+SCX dark · KSH light | |
| TH-06 | Solid surfaces for KPI/spine/nav/panels/tables — no glass there | |
| TH-07 | Amber = signal + nav current + drawer tab underline | |
| TH-08 | Radius **2px** controls; panel 1px rule; focus-visible 2px focus | |

### 2.4 Type scale
| ID | Use | Spec | ☐ |
|---|---|---|---|
| TY-01 | Brand | 23/700/.06em Condensed | |
| TY-02 | Panel h2 | 17/600/.02em Condensed | |
| TY-03 | KPI `.v` | **29**/700/lh1.05 | |
| TY-04 | Spine `.n` | **26**/700 (zero→ink-3/500) | |
| TY-05 | Drawer h3 | 25/700/.03em | |
| TY-06 | Table th | 13/600 Condensed | |
| TY-07 | `h4.sec` | 15/600 | |
| TY-08 | code/pill/mono/clock/age | Condensed as makieta | |

### 2.5 Corridor spine
| ID | Claude expected | ☐ |
|---|---|---|
| SP-01 | Under topbar · pad~9/14/11 · surface · border-b rule | |
| SP-02 | Inner flex · **min-width 940px** | |
| SP-03 | Order+PL: Przygotowanie · Załadunek · Droga PL · Gdańsk · Prom · Nynäshamn · Droga SE · Boden · Dostarczone | |
| SP-04 | Ids PRE ZAL PL GDA SEA NYN SE SITE DONE | |
| SP-05 | `.n` 26 Condensed · `.l` 11.5 ink-3 · bar 3px; pressed surface-3 | |
| SP-06 | Bar hues SEA→sea · SITE/DONE→go · PRE→plan | |
| SP-07 | Click toggles stage filter; zero → `.n.zero` | |

---

## 3. Nav / rail

### 3.1 Chrome
| ID | Claude expected | ☐ |
|---|---|---|
| NV-01 | Width **186** / collapsed **56** | |
| NV-02 | Btn: flex gap9 pad8×14 ink-2 border-left 3px transparent | |
| NV-03 | Current: surface-3 · ink · 600 · border-left **amber** | |
| NV-04 | Glyph 17 · count badge · `.count.hot` red · `.sep` | |
| NV-05 | Hot: risk (if c) + tasks | |
| NV-06 | Product footer «/» OK; no topbar ☰ | |

### 3.2 Items (PL) by role

**Common (all), order:**
| # | id | Glyph | Label | Count |
|---|---|---|---|---|
| 1 | dash | ▣ | Kokpit | — |
| 2 | map | ◎ | Mapa | — |
| 3 | sched | ▤ | Harmonogram | loads |
| 4 | risk | ▲ | Ryzyka | risks (**hot**) |
| 5 | docs | ▢ | Dokumenty | — |

**SCX only (before first sep):** tasks ✎ **Moje zadania** (hot)

**Sep → money:**
- HHL: fin ₽ **Finanse** · inv ▦ **Faktury**
- KSH: fin ₽ **Rozliczenia** only
- SCX: fin ₽ **Moje stawki** · inv ▦ **Faktury**

**Sep → HHL admin:** wf ⚙ **Automatyzacje** · geo ⬡ **Strefy**

| ID | Check | ☐ |
|---|---|---|
| NV-10 | HHL full order+labels+seps | |
| NV-11 | KSH: common+sep+Rozliczenia only | |
| NV-12 | SCX: common+Moje zadania+sep+Moje stawki+Faktury | |
| NV-13 | Gates: wf/geo need HHL; tasks need SCX; inv→fin if KSH | |

EN/SV: Overview/Map/Schedule/Risks/Documents/Finance/Invoices/Automations/Zones/Charges/My rates/My tasks · Översikt/Karta/Tidplan/Risker/Dokument/Ekonomi/Fakturor/Automatiseringar/Zoner/Kostnader/Mina priser/Mina uppgifter.

---

## 4. Views

### 4.0 `dash` — see also §5
| ID | Claude expected | ☐ |
|---|---|---|
| V-DASH-01 | Role `.banner` / `.banner.red` chrome (copy may be live) | |
| V-DASH-02 | KPI panel h2 = org · sub `{date} · projekt Stegra Boden` | |
| V-DASH-03 | `.kpis` 3-col flush · 6 tiles · Condensed 29 | |
| V-DASH-04 | grid2: **Wymaga decyzji** + chip Ryzyka · **Postęp dostaw** + mini **Mapa** | |
| V-DASH-05 | `.exq` ≤7 or `q_none` | |
| V-DASH-06 | S-curve + Plan/Wykonanie/dziś | |
| V-DASH-07 | Mini map ~230px in surface-3 | |

### 4.1 `sched`
| ID | Claude expected | ☐ |
|---|---|---|
| V-SCHED-01 | Hd **Harmonogram** + SharePoint-style sub + chips | |
| V-SCHED-02 | Filters + table + role `.note` | |

### 4.2 `map`
| ID | Claude expected | ☐ |
|---|---|---|
| V-MAP-01 | Hd **Mapa** · sub `{n} pojazdów w ruchu · pozycje co 5 min` · chip **Strefy** | |
| V-MAP-02 | mapsplit ~1.25/1 · mapbox min~520 · solid layers+key | |
| V-MAP-03 | Layers PL: Pojazdy · Strefy · Trasa · Ryzyka · Ślad | |
| V-MAP-04 | Legend: w drodze · załadunek · opóźniony · na placu · brak sygnału | |
| V-MAP-05 | Right vehicle list rows | |
| V-MAP-06 | Empty: **Brak transportów w ruchu dla wybranego filtra.** | |
| V-MAP-07 | Corridor disclaimer `.note` | |

### 4.3 `geo` (HHL)
| ID | Claude expected | ☐ |
|---|---|---|
| V-GEO-01 | **Strefy** · `12 stref · rysowane na mapie` · **Nowa strefa** | |
| V-GEO-02 | Cols: Nazwa · Typ · Promień · Postój · Histereza · Próbki · Powiadamia | |
| V-GEO-03 | Hysteresis/samples/dwell `.note` | |

### 4.4 `risk`
| ID | Claude expected | ☐ |
|---|---|---|
| V-RISK-01 | **Wymaga decyzji** · `{n} otwartych · sortowanie: waga × czas do skutku` | |
| V-RISK-02 | Full `.exq` (gut·title·meta·age) | |
| V-RISK-03 | Panel **Prom i Bałtyk** · `jedno odejście dziennie · spóźnienie kosztuje dobę` | |
| V-RISK-04 | Ferry table · Alternatywy · **Przelicz** · loads on sailing | |

### 4.5 `docs`
| ID | Claude expected | ☐ |
|---|---|---|
| V-DOCS-01 | **Dokumenty** · sub kategorie · **Pobierz paczkę tygodnia** | |
| V-DOCS-02 | Cols: Kategoria · Kto wgrywa · Wymagalność · Kompletność · Stan | |
| V-DOCS-03 | Cats: Zezwolenie PL · Zezwolenie SE (dispens) · CMR · POD · Zdjęcia mocowania · Polisa OCP · Rysunek elementu | |
| V-DOCS-04 | OCP expiry `.note` | |

### 4.6 `fin`
| ID | Claude expected | ☐ |
|---|---|---|
| V-FIN-01 | HHL **Finanse**: Od przychodu do marży · BAF · Marża wg typu · no silent zero note | |
| V-FIN-02 | KSH **Rozliczenia**: Do zapłaty · `.locked` · BAF | |
| V-FIN-03 | SCX **Moje stawki**: Należność · `.locked` · BAF | |
| V-FIN-04 | BAF kv: Indeks · Wartość bazowa · Notowanie · Udział paliwa · Formuła · Próg · Cykl | |

### 4.7 `inv` (HHL/SCX)
| ID | Claude expected | ☐ |
|---|---|---|
| V-INV-01 | **Faktury** · week sub · SCX **Złóż fakturę** / HHL **Zgłoś spór**+**Zatwierdź** | |
| V-INV-02 | Strip: cennik / faktura / rozbieżność · pill Do wyjaśnienia | |
| V-INV-03 | Cols: Wysyłka · Typ · Dostawa · Wg cennika · Zafakturowano · Różnica · Ocena | |
| V-INV-04 | Triangulation `.note` | |

### 4.8 `wf` (HHL)
| ID | Claude expected | ☐ |
|---|---|---|
| V-WF-01 | **Automatyzacje** · `{n} aktywnych` · **Nowa reguła** | |
| V-WF-02 | `.wf`+`.sw` · name · rule · runs/miesiąc | |
| V-WF-03 | Seed names (7): Powiadomienie 40 min przed placem · Brak zezwolenia na 48 h przed · Cichy pojazd · Ryzyko promowe · Zmiana daty na transporcie awizowanym · Potwierdzenie dostawy · Otwarcie fakturowania | |
| V-WF-04 | Note: trigger/warunek/akcje — bez canvas | |

### 4.9 `tasks` (SCX)
| ID | Claude expected | ☐ |
|---|---|---|
| V-TASK-01 | **Moje zadania** · sub przed terminem / eskalacja | |
| V-TASK-02 | Cols: Wysyłka · Czego brakuje · Załadunek · Termin · Stan · Uzupełnij | |
| V-TASK-03 | Pills: pilne / wkrótce / w terminie | |

---

## 5. Cockpit / Dash specifics

| ID | Claude expected | ☐ |
|---|---|---|
| CK-01 | Spine 9 incl. Gdańsk (SP-*) | |
| CK-02 | HHL `.banner.red` ferry-threat pattern | |
| CK-03 | KSH `.banner` delivery/crane pattern | |
| CK-04 | SCX `.banner` fields-to-complete pattern | |
| CK-05 | Panel title = org (H&H Logistics / KSH / Scandinavian Express) | |
| CK-06 | Sub `{date} · projekt Stegra Boden` | |
| CK-07 | **Wymaga decyzji** + count + chip **Ryzyka** | |
| CK-08 | **Postęp dostaw** · tygodnie 37–45 · S-curve | |
| CK-09 | Legend Plan · Wykonanie · dziś | |
| CK-10 | Caption tony narastająco | |
| CK-11 | Mini **Mapa** + chip + ~230px | |
| CK-12 | Exception: gut + code once + next-action meta + age — **no doubled IDs** | |

**KPI labels (I18N):**  
HHL: Transporty w drodze · Wymaga decyzji · Terminowość · Marża narastająco · Komplet dokumentów · Czas wykrycia odchylenia  
KSH: Elementy dostarczone · Tonaż na placu · Najbliższa dostawa · Transporty w drodze · Terminowość · Wymaga decyzji  
SCX: Do uzupełnienia · Transporty w drodze · Terminowość · Przychód tygodnia · Ryzyko promowe · Komplet dokumentów  

| ID | ☐ |
|---|---|
| CK-KPI-H | |
| CK-KPI-K | |
| CK-KPI-S | |

---

## 6. Drawer

### 6.1 Chrome
| ID | Claude expected | ☐ |
|---|---|---|
| DR-01 | Scrim rgba(6,14,20,.45) · drawer `min(560px,100%)` solid | |
| DR-02 | h3 code · status pill · delay pill · ✕ | |
| DR-03 | Meta: type · order · loadPoint → Boden | |
| DR-04 | `.dtabs` · selected amber 2px bottom | |

### 6.2 Tabs (Claude five)
| key | PL | EN | SV |
|---|---|---|---|
| over | Przegląd | Overview | Översikt |
| tl | Przebieg | Progress | Förlopp |
| docs | Dokumenty | Documents | Dokument |
| money | Ceny | Pricing | Priser |
| chat | Ustalenia | Notes | Noteringar |

| ID | ☐ |
|---|---|
| DR-10 tabs order+labels | |
| DR-11 extras only after these five | |

### 6.3 Bodies
| ID | Claude expected | ☐ |
|---|---|---|
| DR-OVER | kv: typ, wymiary, zestaw, masa, zlecenie, montaż, załadunek, dostawa, ETA, kierowca, pojazd, pilotaż, prom + permit banner | |
| DR-TL | Timeline import→POD | |
| DR-DOCS | rows ✓/brak · **Pobierz paczkę ZIP** · **Wgraj dokument** (not KSH) | |
| DR-MONEY | cost/rev by role · `.locked`=`locked` I18N · margin HHL only | |
| DR-CHAT | thread · placeholder `msgph` · **Wyślij** | |

---

## 7. Sched / Harmonogram

| ID | Claude expected | ☐ |
|---|---|---|
| SCH-01 | Panel **Harmonogram** | |
| SCH-02 | Sub import SharePoint KSH · version stamp | |
| SCH-03 | KSH: **Wgraj aktualizację** | |
| SCH-04 | All: **Eksport XLSX** | |
| SCH-05 | Search ph: **Szukaj kodu, kierowcy, nr rej.** | |
| SCH-06 | Chips: **Wszystkie · W drodze · Opóźnione · Bez dokumentów** | |
| SCH-07 | Count filtered/total · optional stage | |
| SCH-08 | Cols: Wysyłka · Typ · Wymiary L×W×H · Masa · Załadunek · Dostawa · Status · Kierowca · Nr rej. · ETA Boden · Dok. | |
| SCH-09 | Money cols: HHL Koszt+Przychód+Marża · KSH Twoja cena · SCX Moja stawka | |
| SCH-10 | Doc flags Z/C/P/M | |
| SCH-11 | Status pills `s_*` · delay `+XhYm` | |
| SCH-12 | Missing driver red **— brak —** | |
| SCH-13 | Sortable sticky thead Condensed | |
| SCH-14 | HHL note NBP / margin &lt;18% red | |
| SCH-15 | KSH/SCX price visibility notes | |
| SCH-16 | Row → drawer | |

---

## 8. Role matrices

### Differs
| Dimension | HHL | KSH | SCX |
|---|---|---|---|
| First paint | dark | light | dark |
| Brand sub org | H&H Logistics | KSH | Scandinavian Express |
| Money nav | Finanse+Faktury | Rozliczenia | Moje stawki+Faktury |
| Admin nav | Automatyzacje+Strefy | — | — |
| Tasks nav | — | — | Moje zadania |
| seeCost/Rev/Margin | Y/Y/Y | N/Y/N | Y/N/N |
| Sched upload | — | Wgraj aktualizację | — |
| Inv actions | Zgłoś spór+Zatwierdź | no inv | Złóż fakturę |
| Drawer upload | yes | no | yes |
| Banner | red ferry | amber delivery | amber tasks |

### Must stay identical
| ID | Rule | ☐ |
|---|---|---|
| RM-01 | Same tokens/type/radii/recipes | |
| RM-02 | Same spine | |
| RM-03 | Same common nav labels/glyphs/order | |
| RM-04 | Same drawer five labels | |
| RM-05 | Same sched chip vocabulary | |
| RM-06 | Stegra = SITE POI only — never a role | |

---

## 9. Empty states & microcopy

### 9.1 Full I18N.pl (84 keys — SoT)

```
view: Widok
nav_dash: Kokpit | nav_map: Mapa | nav_sched: Harmonogram | nav_risk: Ryzyka
nav_docs: Dokumenty | nav_fin: Finanse | nav_inv: Faktury | nav_wf: Automatyzacje | nav_geo: Strefy
nav_fin_ksh: Rozliczenia | nav_fin_scx: Moje stawki | nav_tasks: Moje zadania
st_PRE: Przygotowanie | st_ZAL: Załadunek | st_PL: Droga PL | st_GDA: Gdańsk
st_SEA: Prom | st_NYN: Nynäshamn | st_SE: Droga SE | st_SITE: Boden | st_DONE: Dostarczone
s_PLANNED: Planowany | s_RESOURCES_PENDING: Brak auta | s_DOCS_PENDING: Brak dokumentów
s_READY: Gotowy | s_AT_LOADING: Załadunek | s_IN_TRANSIT_PL: W drodze PL
s_AT_PORT_GDANSK: Port Gdańsk | s_FERRY: Na promie | s_AT_PORT_NYNASHAMN: Nynäshamn
s_IN_TRANSIT_SE: W drodze SE | s_AT_SITE: Na placu | s_UNLOADED: Rozładowany | s_DELIVERED: Dostarczony
c_code: Wysyłka | c_type: Typ | c_dims: Wymiary L×W×H | c_weight: Masa | c_load: Załadunek
c_deliv: Dostawa | c_status: Status | c_driver: Kierowca | c_plate: Nr rej. | c_eta: ETA Boden
c_docs: Dok. | c_cost: Koszt | c_rev: Przychód | c_margin: Marża | c_myprice: Moja stawka
c_yourprice: Twoja cena | c_order: Nr zlecenia | c_seq: Montaż
k_active: Transporty w drodze | k_exc: Wymaga decyzji | k_otif: Terminowość | k_margin: Marża narastająco
k_docs: Komplet dokumentów | k_ferry: Ryzyko promowe | k_delivered: Elementy dostarczone
k_tonnage: Tonaż na placu | k_next: Najbliższa dostawa | k_toaction: Do uzupełnienia
k_week: Przychód tygodnia | k_lag: Czas wykrycia odchylenia
q_title: Wymaga decyzji
q_none: Nic nie wymaga reakcji. Wszystkie transporty idą zgodnie z planem.
d_over: Przegląd | d_tl: Przebieg | d_docs: Dokumenty | d_money: Ceny | d_chat: Ustalenia
b_filter: Filtruj | b_all: Wszystkie | b_late: Opóźnione | b_nodocs: Bez dokumentów | b_active: W drodze
search: Szukaj kodu, kierowcy, nr rej.
locked: Ta cena nie jest widoczna w Twojej roli.
progress: Postęp dostaw | planline: Plan | actualline: Wykonanie
send: Wyślij | msgph: Napisz do pozostałych stron…
```

EN/SV: same keys in makieta `I18N.en` / `I18N.sv`.

### 9.2 Empty / hard-coded chrome strings
| ID | String | ☐ |
|---|---|---|
| ES-01 | `q_none` when no exceptions | |
| ES-02 | Map: Brak transportów w ruchu dla wybranego filtra. | |
| ES-03 | Sched driver: — brak — | |
| ES-04 | Drawer docs miss: brak | |
| ES-05 | Drawer driver empty: nie uzupełniono | |
| ES-06 | `.locked` + role gloss notes | |
| ES-07 | Task: pilne / wkrótce / w terminie | |
| ES-08 | Inv: poza cennikiem / zgodna · Do wyjaśnienia | |

### 9.3 Hard-coded buttons PL
Wgraj aktualizację · Eksport XLSX · Nowa strefa · Przelicz · Pobierz paczkę tygodnia · Złóż fakturę · Zgłoś spór · Zatwierdź · Nowa reguła · Uzupełnij · Pobierz paczkę ZIP · Wgraj dokument · Ryzyka · Mapa · Strefy · ◐

---

## 10. Audit protocol

### When koordynator signals
1. Preview app **`:4177`**.
2. Claude: `/claude-ref.html` or `claude-visual-ref/tower-makieta.html`.
3. Match role · lang · theme.
4. Per Surface ID: shoot app+makieta · fill table · PASS only if twin.
5. Shots: `watch-tower-app/shots-start/1to1-{surface}-{role}-{app|makieta}.png`.

### Template

| Surface ID | Claude expected | App actual | Verdict | Evidence shot |
|---|---|---|---|---|
| GC-01 | 3-row app grid | | PASS/FAIL | |
| TB-02 | TOWER Condensed 23 | | | |
| SP-03 | 9 stages + Gdańsk PL labels | | | |
| NV-10 | HHL nav order/labels | | | |
| NV-11 | KSH Rozliczenia only | | | |
| NV-12 | SCX + Moje zadania | | | |
| V-DASH-04 | Wymaga decyzji \| Postęp \| mini Mapa | | | |
| CK-KPI-H | HHL 6 KPI labels | | | |
| V-MAP-03 | 5 layer labels | | | |
| SCH-06 | 4 quick chips | | | |
| DR-10 | 5 drawer tabs | | | |
| TH-03 | light hex twin | | | |
| TH-04 | dark hex twin | | | |
| … | *(every ID in §§2–9)* | | | |

### Minimum shot set
1 HHL dark dash+spine+nav · 2 KSH light dash · 3 SCX dark+tasks nav · 4 map · 5 sched · 6 risk+ferry · 7 drawer tabs · 8 fin+inv · 9 wf+geo · 10 SCX tasks

---

## Ambiguities (Visual / koordynator)

1. **Doc drift:** IDENTICAL_CLAUDE / VISUAL_BRIEF sometimes use alternate org/project spellings. **Makieta wins** (table above). Rewrite docs?
2. **Theme first-paint:** Makieta boots light; product forces HHL/SCX dark. Confirm matched-theme compare + separate first-paint check (not FAIL vs light makieta).
3. **Extra drawer tabs** (resources/awizacja/ferry/ETA): allowed — confirm max set; Claude five labels immutable.
4. **Bell:** product-only — confirm topbar `.iconbtn` only; not graded vs makieta absence.
5. **Nav footer toggle:** product-only — 186↔56; no topbar ☰.
6. **`START_UI_SPEC.md`:** missing — restore or ignore?
7. **Banner copy:** seed ferry text vs live critical exception — chrome must stay `.banner`/`.banner.red`.
8. **SVG map place labels** vs MapLibre — FAIL only on panel/layer/legend chrome, not engine labels?
9. **I18N key names in app** may differ — gate = visible string + layout.
10. If `claude-makieta.html` ever diverges from `claude-visual-ref/tower-makieta.html`, primary+`public/claude-ref.html` win.

---

## Counts

| Metric | Count |
|---|---|
| View IDs | **10** |
| Drawer tabs | **5** |
| Spine stages | **9** (incl. Gdańsk) |
| Roles | **3** |
| I18N.pl keys | **84** |
| Checklist Surface IDs | **≈ 150** |
| Hard-coded buttons listed | **16** |
| Workflow seed names | **7** |

**Deliverable path:** `/workspace/watch-tower/research-2026/visual-gate-from-zero/FULL_1TO1_SURFACE_CHECKLIST.md`  
**App code:** untouched.
