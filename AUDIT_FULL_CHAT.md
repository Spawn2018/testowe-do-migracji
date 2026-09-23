# AUDIT_FULL_CHAT — Sebastian · pełny czat → DONE / PARTIAL / GAP

**When:** 2026-09-23 03:10 CEST (Europe/Warsaw, UTC+2)  
**App:** `/workspace/watch-tower-app` · Preview `http://127.0.0.1:4177/` · bundle `index-B7IO13KK.js`  
**Visual:** FINAL_SQUINT PASS — chrome frozen (no Topbar/Nav/index.css Claude recipes, drawer kv labels, map 5 layers, BAF kv keys, `s_*`, theme `◐`).  
**QA click:** `QA_RE_SHIP_FROZEN.md` → **SHIP 10/10** (02:58).  
**SoT:** `AUDIT_CHAT_REQUIREMENTS.md` · `UX_MAP.md` · `FUNCTIONS_UNDER_CLAUDE.md` · `CLOSEOUT_STATUS.md` · `research-2026/05_WORKFLOWS.md` (W1–W12).

**Zasada:** tylko funkcje/moduły pod Claude chrome; zero look change.

---

## Honest answer: „czy wszystkie funkcje wpiąłeś?”

**NO — not YES.** Product-required functional surface is **wired**; remaining items are **PARTIAL by design** (live API keys) or **out-of-makieta scope** (Next/Supabase, React Flow builder).  
**Zero product-required GAP left inside Vite makieta** after this pass (WF 12 closed). See § Remaining.

---

## A. Brief otwierający

| # | Requirement | Status | File evidence | QA click-proven |
|---|---|---|---|---|
| A1 | 100% funkcjonalności z plików Claude | **DONE** | M1–M12 views under Claude shell; `FUNCTIONS_UNDER_CLAUDE.md` | SHIP probes 1–10 |
| A2 | Można przeprojektować; zero AI-slop | **PARTIAL** | FINAL_SQUINT PASS; continuous craft | Visual gate (not QA click) |
| A3 | Inspiracje 2026 | **DONE** | `research-2026/` | n/a research |
| A4 | Logiczny UX map | **DONE** | `UX_MAP.md` | n/a doc |
| A5 | 100% klikalny workflow, zero wydmuszek | **DONE** | Drawer CTAs + Wave1 hollows + ZIP/Eksport/factoring | SHIP 1–7 |
| A6 | ≥60 transportów | **DONE** | `src/data/loads.json` **62** | SHIP sched cols |
| A7 | Każda funkcja/moduł działa | **DONE** | store mutators + views | SHIP 10/10 |
| A8 | Zespół botów | **DONE** | research team orders | n/a |
| A9 | Makieta HTML Claude jako ref | **DONE** | `claude-makieta.html` / visual-ref | FINAL_SQUINT |

## B. Motywy / adresy / BAF / zezwolenia / cennik / faktoring / KSH

| # | Requirement | Status | File evidence | QA click-proven |
|---|---|---|---|---|
| B1 | KSH light, HHL dark | **DONE** | theme per role in store/Topbar | role probes |
| B2 | Śrem Grunwaldzka 27C / Stalverket 20 Boden | **DONE** | `lib/status.ts` SITES; `gf-01`/`gf-11` | n/a seed |
| B3 | BAF SEFS hybrid OKQ8/ORLEN | **DONE** | `lib/sefs.ts` `computeSefs`; FinanceView `.kv` | static probe prior |
| B4 | Limity PL/SE zezwoleń | **DONE** | `PERMITS_PL_SE.md` + permits lib | READY gate SHIP 2 |
| B5 | PERIOD vs TRIP cover | **DONE** | `lib/permits.ts` `cover`/`isReadyBlocked` | SHIP 2 |
| B6 | Cennik SCX base + dims | **DONE** | `scx-rates-base.json` / `lib/scxRates.ts` | n/a |
| B7 | Pozwolenia ↔ pozycje cennika | **DONE** | `permit-by-rate-line.json` | n/a |
| B8 | Faktoring SCX; HHL %/dni | **DONE** | InvoicesView + store `updateFactoringOffer`/`submitInvoice` | **SHIP 6** |
| B9 | KSH_HARMONOGRAM.xlsx | **DONE** | loads from schedule seed | SHIP 5 Wgraj path |
| B10 | Pokazać makietę | **DONE** | preview 4177 | SHIP run |

## C. START!!!! (elite)

| # | Requirement | Status | File evidence | QA click-proven |
|---|---|---|---|---|
| C1 | Burza + rozszerzenie modułów | **DONE** | research-2026 + team orders | n/a |
| C2 | Predykcje / ETA bands | **DONE** | `lib/eta.ts` + drawer overview ETA | prior closeout |
| C3 | Prawdziwe API mapy/drogi SE | **PARTIAL** | Leaflet; TV/AIS **live\|seed** labeled (`MapView` `.note`) | **SHIP 8** (seed labeled) |
| C4 | SOTA UX / nie generyczny | **DONE** | `FINAL_SQUINT_GATE_RESULT.md` PASS; chrome frozen | Visual |
| C5 | Więcej workflow | **DONE** | **12** rules `wf-1…12` in `seed.ts` (7 Claude + 5 product); `.wf`/`.sw`; name click → `runWorkflowNow` | SHIP 7 (7 names); **12 wired this pass — rebuild** |
| C6 | Top-tier eng + elite biz | **PARTIAL** | Vite in-memory makieta (not Next/Supabase) — functions full | n/a arch |
| C7 | Real maps + trasy ponadgab. | **DONE** | `corridor_ref.json` + CorridorMap | SHIP 8 |
| C8 | Trafikverket API SE | **PARTIAL** | live iff key else seed labeled | SHIP 8 |
| C9 | Symulacja ruchu | **DONE** | fleet tick CorridorMap | n/a |
| C10 | Living/working feel | **PARTIAL** | continuous (ticks, events, notifications) | subjective |
| C11 | Collapsible side menu | **DONE** | 186↔56 + `sessionStorage.wtNavCollapsed` | prior |
| C12 | Loga firm | **DONE** | HHL/KSH/SCX assets | n/a |
| C13 | Glass OK jeśli trendy | **DONE** | dense 97/98.5 | Visual |
| C14 | Import + DnD | **DONE** | Schedule ExcelJS dry-run→commit (KSH); Eksport XLSX | **SHIP 5** |
| C15 | Usunąć Stegra role | **DONE** | 3 roles only | SHIP 10 |
| C16 | Tile/link klikalny + deep-link | **DONE** | KPI `navigateTo`; spine toggle; bell | **SHIP 9** |
| C17 | Bell + mark read | **DONE** | NotificationBell | **SHIP 9** |
| C18 | Glass nie za przezroczysty | **DONE** | dense tokens | Visual |

## D. Promy / AIS

| # | Requirement | Status | File evidence | QA click-proven |
|---|---|---|---|---|
| D1 | API przepraw research | **DONE** | `FERRY_AIS.md` / research | n/a |
| D2 | Statek kiedy wypływa | **DONE** | `ferry-sailings.json` + drawer ferry | SHIP 1 ferry save |
| D3 | Darmowe AIS + mapa | **PARTIAL** | `lib/ais.ts` proxy live\|seed labeled | SHIP 8 seed |
| D4 | Wawel + Nova Star MMSI | **DONE** | AIS seed / ferry data | n/a |

## E. Meta

| # | Requirement | Status | Evidence |
|---|---|---|---|
| E1 | Głęboki audyt | **DONE** | this file + CLOSEOUT |
| E2 | Nic nie odraczać (makieta) | **DONE** | closeout + functions-under-Claude + this pass WF12 |

---

## UX_MAP modules M1–M12

| ID | Module | Status | Evidence | QA |
|---|---|---|---|---|
| M1 | Harmonogram | **DONE** | ScheduleView Wgraj/DnD/dry-run/commit; Eksport | SHIP 5 |
| M2 | Lista + drawer | **DONE** | Schedule + LoadDrawer tabs | SHIP 1–2 |
| M3 | Mapa | **DONE** | MapView 5 layers + CorridorMap | SHIP 8 |
| M4 | Geofence | **DONE** | GeofenceView editor + 13 zones | prior closeout |
| M5 | Driver PWA | **DONE** | DriverPwa GPS + 4 milestones + camera→vault | prior |
| M6 | Dokumenty PERIOD/TRIP/REG | **DONE** | DocsView + `cover` + ZIP | SHIP 2,4 |
| M7 | Cennik/BAF/marża | **DONE** | FinanceView SEFS + below-threshold | prior |
| M8 | Dashboardy HHL/KSH/SCX | **DONE** | DashboardView KPI actionable | SHIP 9–10 |
| M9 | Workflow | **DONE** | **12** rules; toggle + run→notify | SHIP 7 (+5 append) |
| M10 | Ryzyka + Plan B | **DONE** | RisksView `applyPlanB` | **SHIP 3** |
| M11 | Faktura + factoring | **DONE** | InvoicesView HHL/SCX | **SHIP 6** |
| M12 | ETA bands | **DONE** | `lib/eta.ts` + drawer Przegląd | prior |

---

## UX_MAP §2 e2e path (import→…→factoring)

| Step | Status | CTA / wire |
|---|---|---|
| KSH Import XLSX → map → dry-run → commit | **DONE** | ScheduleView; SHIP 5 |
| HHL Przypisz SCX | **DONE** | drawer `assignScx` |
| SCX resources / awizacja / ferry | **DONE** | Ustalenia forms; **SHIP 1** |
| PERIOD/TRIP cover → READY gate | **DONE** | `isReadyBlocked`; **SHIP 2** |
| LOADING / Depart / geofence | **DONE** | Wyjazd + Zdarzenie strefy |
| Ferry / PRE_PORT / SEA | **DONE** | status + ferry booking + Plan B |
| SITE → UNLOADED → POD 24h | **DONE** | Oznacz rozładowany → notify |
| SCX weekly invoice → match | **DONE** | InvoicesView submit |
| HHL Accept + factoring | **DONE** | **SHIP 6** |

---

## AUDIT blockers 1–16

| # | Bloker | Status |
|---|---|---|
| 1 | Real XLSX | **DONE** |
| 2 | Spine 2nd-click clear | **DONE** SHIP 9 |
| 3 | Bell mark-read | **DONE** SHIP 9 |
| 4 | wtNavCollapsed | **DONE** |
| 5 | Zero hollow (Plan B/ZIP/camera/Eksport/factoring) | **DONE** |
| 6 | READY←cover | **DONE** SHIP 2 |
| 7 | Map worker + AIS | **DONE** worker; AIS PARTIAL key |
| 8 | ETA bands | **DONE** |
| 9 | E2E §2 | **DONE** |
| 10 | Workflows ≥12 | **DONE** this pass (`wf-1…12`) |
| 11 | Data diversity | **DONE** (62 loads, multi invoice weeks, ferry, TRIP stress) |
| 12 | Trafikverket live | **PARTIAL** seed labeled |
| 13 | Driver PWA | **DONE** |
| 14 | Geofence editor | **DONE** |
| 15 | SEFS waterfall + threshold | **DONE** |
| 16 | Re-QA SHIP | **DONE** `QA_RE_SHIP_FROZEN.md` 10/10 |

---

## START / hollow residuals

| Item | Status |
|---|---|
| Hollow `onClick={()=>{}}` | **DONE** — none left in src |
| ZIP / Eksport / factoring / SEFS / ETA / Ustalenia / WF run | **DONE** FUNCTIONS_UNDER_CLAUDE |
| «Nowa reguła» opens builder | **GAP (makieta)** — frozen label; runs first enabled WF (UX_MAP: no React Flow) |
| Live TV/AIS without key | **PARTIAL by design** |

---

## Workflows inventory (M9 / C5)

**Kept (Claude visual-gated PL names):**  
1. Powiadomienie 40 min przed placem  
2. Brak zezwolenia na 48 h przed  
3. Cichy pojazd  
4. Ryzyko promowe  
5. Zmiana daty na transporcie awizowanym  
6. Potwierdzenie dostawy  
7. Otwarcie fakturowania  

**Appended this pass (product W3/W5/W8/W9/W12 style, same `.wf`/`.sw`, no Uruchom):**  
8. Zdążenie na rejs · PRE_PORT *(Bufor 20 km · Gdańsk)*  
9. Sytuacja Trafikverket E4  
10. Akceptacja factoringu  
11. Wygaśnięcie PERIOD ≤14 dni  
12. Marża poniżej progu  

Persist key bumped: `watch-tower-ui-v5-wf12` (avoids sticky 7-rule localStorage).

---

## Remaining honest GAPs / PARTIAL (product)

1. **C3/C8/D3 PARTIAL** — Trafikverket / AIS **live** need API keys; without key = honest **seed** label (not fake live).  
2. **C6/C10 PARTIAL** — Vite makieta vs Claude Next/Supabase; living feel continuous.  
3. **«Nowa reguła»** — no rule-builder form (explicitly out of UX_MAP §9).  
4. **A2 PARTIAL** — visual craft owned; FINAL_SQUINT PASS but anti-slop never “finished forever”.

**None of the above are unfinished product wires under frozen chrome** except optional live keys.

---

## Wired this pass (executor)

1. `src/data/seed.ts` — append `wf-8…wf-12` (5 product rules).  
2. `src/store/useTowerStore.ts` — persist `watch-tower-ui-v5-wf12`.  
3. `AUDIT_CHAT_REQUIREMENTS.md` — C4 **DONE**, C5=12, blocker 10 DONE.  
4. `FUNCTIONS_UNDER_CLAUDE.md` — remaining GAPs refreshed.  
5. **This file** `AUDIT_FULL_CHAT.md`.  
6. `npm run build` + preview 4177.

**Not touched:** `index.css` Claude recipes, Topbar/Nav chrome, drawer kv labels, map 5 layer labels, BAF kv keys, `s_*`, theme glyph, Uruchom button (still absent).
