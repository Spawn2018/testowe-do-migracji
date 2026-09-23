# RE_SQUINT GATE RESULT — Adversarial re-pass vs Claude

**Verdict headline: FAIL**

**Timestamp:** 2026-09-23 02:48 CEST (Europe/Warsaw)  
**Executor:** WT — Visual (RE_SQUINT after P0 Must-fixes)  
**App code:** not modified  
**SoT:** `/workspace/watch-tower/claude-visual-ref/tower-makieta.html`  
**Prior:** `START_SQUINT_GATE_RESULT.md` (18 FAIL)  
**Builder claim:** `/workspace/watch-tower-app/IDENTICAL_CLAUDE_FULL.md`  
**Evidence:** `/tmp/wt-p0fix-*.png`, `/tmp/wt-literal-*.png`, live DOM `:4177` (puppeteer-core), StatusPill / LoadDrawer / MapView / ScheduleView / seed / Topbar cross-check  

---

## Counts (rescored)

| Metric | Count |
|---|---|
| **PASS** | **94** |
| **FAIL** | **2** |
| **N/A** | **6** |
| **Overall** | **FAIL** (any hard chrome/copy/layout FAIL ⇒ no ship) |

*Prior 18 hard FAILs → PASS. Two **new** hard residuals remain (zero-almost: microcopy chrome = FAIL). Soft “looks close” never PASS. Allowed deltas not counted as FAIL.*

---

## Prior FAIL → now (Must-fix P0 + P0.5)

| Prior FAIL ID | Was | Now | Evidence |
|---|---|---|---|
| **SCH-08 / SCH-10** | missing Kierowca · Nr rej. · ETA Boden · Dok. Z/C/P/M | **PASS** | `/tmp/wt-p0fix-sched.png`, `/tmp/wt-literal-sched.png`; live `ths` exact |
| **SCH-03 / SCH-04** | HHL **Importuj XLSX** | **PASS** | HHL header = **Eksport XLSX** only; `canImportSchedule` = KSH |
| **SCH-11 / StatusPill** | Rozładunek / Opóźniony / Cichy | **PASS** | Claude `s_*` labels; delay separate `+1h35` red pill; live pills sample |
| **DR-OVER** (forms + missing kv) | Zasoby/Awizacja forms under Przegląd; no Nr zlecenia/Montaż | **PASS*** | Przegląd = `dl.kv` + permit banner; `visibleInputs:0`; Nr zlecenia + Montaż present — *residual microcopy below* |
| **V-MAP-03** | 6th **Prom** layer | **PASS** | layers = Pojazdy·Strefy·Trasa·Ryzyka·Ślad (`/tmp/wt-p0fix-map.png`) |
| **V-MAP-05** | Wawel/E4 mlist chips | **PASS** | live `chips: []` |
| **V-WF-01** | **Uruchom** per row | **PASS** | live `uruchom: 0`; note Claude płótna present |
| **V-WF-03** | product WF names | **PASS** | 7 Claude PL seed names exact (`seed.ts` + `/tmp/wt-p0fix-wf.png`) |
| **V-WF-04** | note weak / Uruchom dominates | **PASS** | Claude note present; Uruchom gone |
| **V-DOCS *extra*** | Transporty bez kompletu + EN enums | **PASS** | `/tmp/wt-p0fix-docs.png`; live `bad:false` |
| **V-FIN-04** | **Źródła** BAF substitute | **PASS** | Indeks·Wartość bazowa·Notowanie·Udział paliwa·Formuła·Próg·Cykl (`/tmp/wt-p0fix-fin.png`) |
| **TB-09** (START id; checklist TB-08) | `śr., …,` clock | **PASS** | live `śr 23.09.2026 · 02:46`; Topbar middot pattern = Claude `wt DD.MM.YYYY · HH:MM` |
| **NV-05** | Faktury `.count.hot` | **PASS** | only Ryzyka hot; Faktury grey (`/tmp/wt-literal-nav.png` + live) |
| **SCH-14** | shortened NBP note | **PASS** | full “NBP tabela A z dnia poprzedzającego…” |

**Confirmation:** all **8+ START Must-fix P0 items closed PASS** (incl. TB-09 / NV-05 / SCH-14 P0.5).

---

## New FAILs (ranked)

| Rank | Surface ID | Expected (Claude) | Actual | Evidence | Drift |
|---|---|---|---|---|---|
| **P0** | **TB-07** (checklist; START TB-08 soft) | Theme `.iconbtn` glyph **◐** | Literal **`'◐'`** (quotes U+0027 around glyph) | live `iconbtn` text/len=3; `/tmp/wt-theme-crop.png` | JSX text child `'◐'` vs Claude `◐` |
| **P0** | **DR-KV-DIMS** (DR-OVER residual) | Overview `<dt>` = **Wymiary L×W×H** (`T("c_dims")`) | `<dt>Wymiary</dt>` | LoadDrawer.tsx:123; live drawer `dts`; makieta `drawerHTML` | microcopy chrome ≠ twin → **FAIL** (zero-almost) |

---

## Adjudicated residuals (steering)

| Item | Verdict | Why |
|---|---|---|
| Drawer **Wymiary** vs **Wymiary L×W×H** | **FAIL** | Still short; Claude I18N `c_dims` exact. Microcopy chrome = FAIL. |
| **Kod przyczyny** conditional | **PASS** | Claude only when `delayCode`. App shows delay on ETA as red pill (`+1h…`); no false always-on Kod przyczyny. *(Format soft: drawer uses `+1h 35 min` vs table/Claude `+1h35` — not scored separate hard FAIL this pass.)* |
| **Nynäshamn** status | **PASS** | `StatusPill` `BY_STAGE.APPROACH = 'Nynäshamn'`. No current seed row in APPROACH → not in live pill set; stage fallback OK. *(P1 note only if product never emits APPROACH stage — not observed as chrome FAIL.)* |

---

## Self-report / allowed deltas

| Builder / delta | Gate |
|---|---|
| Map Leaflet/MapLibre inside Claude mapsplit chrome | **Allowed** — not FAIL |
| NotificationBell second `.iconbtn` | **Allowed** |
| Nav footer « collapse | **Allowed** |
| Live seed counts (62 vs Claude 50 etc.) | **Allowed** |
| Internal enums `DOC_MISSING` / `DELAYED` / `SILENT` with Claude **labels** only | **PASS** (labels twin) |
| Theme first-paint HHL dark / matched-theme compare | **PASS** on literal dark set; light p0fix shots = toggled session, not first-paint FAIL |
| Builder “all P0 closed” | **CONFIRM** for START Must-fix list; **INVALIDATE overall ship** — 2 new hard residuals |

---

## Method notes

1. Listed every START hard FAIL Surface ID.  
2. Visually Read all `/tmp/wt-p0fix-*.png` + `/tmp/wt-literal-*.png`.  
3. Cross-checked StatusPill, Schedule header/cols, LoadDrawer overview, Map layers, WF names, Docs, Fin BAF vs makieta I18N.  
4. Fresh live DOM probe on `http://127.0.0.1:4177/` (no source edits).  
5. Ignored stale `/tmp/sb/tower_*.png`.  

---

## Report paths

- **This file:** `/workspace/watch-tower/research-2026/visual-gate-from-zero/RE_SQUINT_GATE_RESULT.md`  
- Prior: `START_SQUINT_GATE_RESULT.md`  
- Checklist: `FULL_1TO1_SURFACE_CHECKLIST.md`  

**App code:** not modified.  
**Overall:** **FAIL** — prior 18 P0 closed; remaining **TB-07** quoted ◐ + **DR-KV-DIMS** `Wymiary` ≠ `Wymiary L×W×H`.
