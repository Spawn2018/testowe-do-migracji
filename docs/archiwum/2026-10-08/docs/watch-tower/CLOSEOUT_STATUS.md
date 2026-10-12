# WATCH TOWER — CLOSEOUT STATUS

**When:** 2026-09-23 ~01:05 CEST (Europe/Warsaw)  
**Build:** `npm run build` **PASS** (Vite + tsc; MapLibre worker chunk emitted)  
**App:** `/workspace/watch-tower-app`  
**SoT:** `AUDIT_CHAT_REQUIREMENTS.md` · `UX_MAP.md`

Zasada Sebastiana: nic nie odraczać / nie zawężać / zero wydmuszek.

---

## Ownership this executor

| # | Item | Status | Evidence |
|---|---|---|---|
| 1 | ETA M12 bands | **DONE** | `lib/eta.ts` + drawer tab: segments, LOW/MED/HIGH, earliest–latest, reason chips, heurystyka label; refresh on `setLoadStatus` / ferry / geofence |
| 2 | E2E UX_MAP §2 | **DONE** | Drawer: Przypisz SCX → resources/awizacja/ferry → READY←cover → Depart → Geofence event → UNLOADED→POD notify; invoices+factoring store; import Wave1 |
| 3 | Workflows ≥7 | **DONE** | **12** rules (`wf-1`…`wf-12`); toggle + Run now → run log + notification |
| 4 | Data stress | **DONE** | 62 loads; ferry assigned **49**; invoices **W36 FUNDED / W37 SCHEDULED / W38 DISPUTED / W39 SUBMITTED**; PERIOD **34**; uncovered TRIP kratownice/SG block READY (SG-09/18, K-03) |
| 5 | Finance SEFS waterfall + below-threshold | **DONE** | FinanceView waterfall + actionable list (SG-08/15/22/SS-02 @9%); Dashboard prefers flagged load |
| 6 | Geofence editor | **DONE** | SVG click-place circle; form hysteresis/dwell/notify; save persists + notification |
| 7 | READY←cover | **DONE** | `isReadyBlocked` / `evaluateLoadCover`; store rejects READY + toast/event; DocsView honest GAP |
| 8 | MapLibre worker | **DONE** | `setWorkerUrl(.../maplibre-gl-worker.mjs?url)` — worker in `dist/assets/` |

Wave1 (sibling — do not revert): dense glass 97/98.5 · spine clear · ExcelJS XLSX · Plan B notify · camera→DOC_UPLOADED · real ZIP · AIS proxy.

---

## A. Brief otwierający

| # | Status | Notes |
|---|---|---|
| A1 | **PARTIAL→mostly DONE** | M1–M12 ekrany + CTA mutacje; makieta Vite (nie Next/Supabase) = celowe |
| A2 | DONE* | Cold steel + dense glass; Visual sibling owns identity fonts |
| A3 | DONE | research-2026 |
| A4 | DONE | UX_MAP.md |
| A5 | **DONE** | E2E §2 path + READY gate + hollow Wave1 fixes |
| A6 | DONE | 62 loads |
| A7 | **DONE** | Gate 10: READY←cover; Plan B/ZIP/camera real |
| A8 | DONE | bot team |
| A9 | DONE | Claude HTML ref |

## B. Motywy / BAF / zezwolenia / cennik / faktoring

| # | Status | Notes |
|---|---|---|
| B1 | DONE | theme per role |
| B2 | DONE | SITES + geofences |
| B3 | DONE | sefs.ts hybrid |
| B4 | DONE | PERMITS_PL_SE |
| B5 | **DONE** | cover() PERIOD/TRIP/REGULATION; READY blocked on GAP; Docs UI shows kind |
| B6 | DONE | scxRates |
| B7 | DONE | PERMIT_BY_RATE_LINE |
| B8 | DONE | InvoicesView factoring offer + pipeline states in seed |
| B9 | DONE | loads from schedule |
| B10 | DONE | preview/desktop |

## C. START!!!!

| # | Status | Notes |
|---|---|---|
| C1 | DONE | research + orders |
| C2 | **DONE** | ETA confidence bands + chips (heuristic labeled) |
| C3 | **PARTIAL** | MapLibre+OpenFreeMap+worker OK; Trafikverket live iff key else seed labeled; AIS proxy live/seed |
| C4 | PARTIAL | Visual sibling; dense glass kept |
| C5 | **DONE** | 12 workflows + run log → notifications |
| C6 | PARTIAL | Vite makieta = pełna funkcja biznesowa OK; Claude stack = docelowa architektura |
| C7 | DONE | corridor_ref |
| C8 | PARTIAL | middleware; seed when no key |
| C9 | DONE | fleet tick |
| C10 | PARTIAL | living feel — continuous |
| C11 | DONE | nav 186↔56 sessionStorage |
| C12 | DONE | logos |
| C13 | DONE | dense 97/98.5 |
| C14 | DONE | Wave1 ExcelJS dry-run→commit |
| C15 | DONE | no Stegra role |
| C16 | DONE | spine 2nd click (Wave1); KPI actionable |
| C17 | DONE | Wave1 bell mark-read |
| C18 | DONE | glass density |

## D. Promy / AIS

| # | Status | Notes |
|---|---|---|
| D1 | DONE | API research |
| D2 | DONE | ferry-sailings seed |
| D3 | **PARTIAL** | AIS proxy + seed banner; depends on key/network |
| D4 | DONE | Wawel + Nova Star MMSI |

## E. Meta

| # | Status | Notes |
|---|---|---|
| E1 | DONE | this audit + CLOSEOUT |
| E2 | **DONE** (makieta scope) | Full closeout sprint applied; no intentional deferrals in ownership |

---

## Blokery AUDIT (1–16) → wynik

| # | Bloker | Result |
|---|---|---|
| 1 | Real XLSX | DONE (Wave1) |
| 2 | Spine clear | DONE (Wave1) |
| 3 | Bell mark-read | DONE (Wave1) |
| 4 | wtNavCollapsed | DONE (Wave1) |
| 5 | Zero hollow | DONE (Wave1 Plan B/camera/ZIP) |
| 6 | Permit cover→READY | **DONE** this wave |
| 7 | MapLibre worker + AIS | **DONE** worker; AIS PARTIAL (key) |
| 8 | ETA bands | **DONE** |
| 9 | E2E §2 | **DONE** |
| 10 | Workflows+ | **DONE** (12) |
| 11 | Data diversity | **DONE** |
| 12 | Trafikverket | PARTIAL (seed labeled) |
| 13 | Driver PWA | DONE (Wave1 camera+vault event) |
| 14 | Geofence editor | **DONE** |
| 15 | SEFS waterfall + threshold | **DONE** |
| 16 | Re-QA SHIP | **GAP** — needs human/QA re-run after this build |

---

## Remaining GAPs (honest)

1. **Re-QA until SHIP** — not executed in this turn (no click QA pass after closeout).
2. **Trafikverket / AIS live** — require API keys; without key = seed + honest label (by design, not fake live).
3. **Visual polish / identity fonts** — owned by Visual sibling; not contested here.
4. **Claude Next/Supabase stack** — out of makieta Vite scope; functions mirrored in-memory.

Empty product GAPs inside ownership rows above: **none** (ETA, e2e, cover, workflows, data, finance flag, geofence, MapLibre worker).

---

## Files touched (this executor)

- `src/lib/eta.ts` (new)
- `src/lib/permits.ts` (cover gate helpers)
- `src/types/index.ts` (EtaConfidence / Load ETA fields)
- `src/data/seed.ts` (12 WF, 4 invoice weeks, below-threshold, TRIP stress)
- `src/store/useTowerStore.ts` (ETA refresh, READY gate, assignScx, triggerGeofence, persist v4)
- `src/components/drawer/LoadDrawer.tsx`
- `src/components/map/CorridorMap.tsx` (worker)
- `src/views/{Finance,Geofence,Docs,Dashboard}View.tsx`
- `ACCEPTANCE.md` · this `CLOSEOUT_STATUS.md`


---

## Functions-under-Claude (2026-09-23 02:55 Europe/Warsaw)

See `/workspace/watch-tower-app/FUNCTIONS_UNDER_CLAUDE.md`. Hollow ZIP/Eksport/factoring/SEFS/ETA/Ustalenia/WF/TV-label closed under frozen Claude chrome. `npm run build` PASS · preview 4177.


---

## Full-chat audit pass (2026-09-23 03:10 Europe/Warsaw)

See `/workspace/watch-tower-app/AUDIT_FULL_CHAT.md`. Workflows restored to **12** (7 Claude + 5 product under `.wf`). C4 FINAL_SQUINT → DONE. Persist `watch-tower-ui-v5-wf12`. Build PASS · preview 4177 `index-B7IO13KK.js`.
