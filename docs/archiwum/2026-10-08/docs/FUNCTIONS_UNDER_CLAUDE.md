# FUNCTIONS UNDER CLAUDE — checklist (chat SoT → wiring)

**When:** 2026-09-23 ~03:10 Europe/Warsaw (UTC+2)  
**App:** `/workspace/watch-tower-app` · Preview `http://127.0.0.1:4177/` · see latest dist bundle  
**Build:** `npm run build` **PASS**  
**Chrome rule:** Visual FINAL_SQUINT frozen — no shell/CSS/token/label changes; functions re-attached under Ustalenia / existing `.btn` / `.chipbtn` / `.panel` / `.note` / `.kv` only.

**Audit SoT:** `/workspace/watch-tower/AUDIT_CHAT_REQUIREMENTS.md`  
**Also:** `CLOSEOUT_STATUS.md`, `UX_MAP.md`

Legend: **WIRED** = mutates store / real download / labeled seed|live · **GAP** = honest remaining

---

## Scope mandate (user) → status

| # | Requirement | Status | Evidence |
|---|---|---|---|
| 1 | M1–M12 module actions mutate store under Claude views | **WIRED** | Schedule import/commit; drawer Ustalenia resources/awizacja/ferry/READY/SCX/geofence; Risks Plan B; Docs/Finance/Inv/WF/Geo/Driver/Map |
| 2 | READY blocked without permit cover (PERIOD/TRIP); `cover()` works | **WIRED** | `lib/permits.ts` `cover`/`isReadyBlocked`; store rejects READY + toast/event; drawer disables READY + banner |
| 3 | Schedule: KSH Wgraj XLSX dry-run→commit (ExcelJS); HHL Eksport only | **WIRED** | `canImportSchedule`=KSH only Wgraj; Eksport chipbtn → `exportLoadsXlsx` (ExcelJS) all roles |
| 4 | Drawer Ustalenia: resource/awizacja/ferry saves | **WIRED** | Forms in `tab===chat` (Ustalenia); Zapisz zasoby / Zapisz awizację → `updateResources`/`updateAwizacja`/`updateFerry`; set L×W×H/masa inputs restored |
| 5 | Plan B on risks mutates ferry + audit | **WIRED** | `applyPlanB` → ferry PLANB-*, risk soften, event, notify; RisksView Przelicz |
| 6 | Driver PWA camera → documents vault | **WIRED** | FileReader dataUrl → `driverAttachDoc` → `documents[]` + DOC_UPLOADED |
| 7 | Geofence triggers, GPS, fleet motion, AIS ferry markers | **WIRED** | GeofenceView save; driver GPS; CorridorMap fleet tick 1.5s; AIS layer tied to vehicles/ferry; Leaflet OK |
| 8 | Trafikverket labeled live-or-seed | **WIRED** | MapView `.note`: `Trafikverket E4: live\|seed` + AIS label from `fetchSituations`/`subscribeAis` |
| 9 | Factoring HHL configure / SCX choose | **WIRED** | InvoicesView HHL kv admin → `updateFactoringOffer`; SCX radio → `submitInvoice(..., factoringSelected)`; Accept → SCHEDULED |
| 10 | SEFS hybrid OKQ8/ORLEN BAF calc | **WIRED** | Finance BAF `.kv` keys Claude-frozen; values from `computeSefs`/`SEFS_WEEKLY`; ORLEN+OKQ8 links |
| 11 | Bell mark read; spine 2nd-click clear; KPI/deep-links; WF → notifications | **WIRED** | NotificationBell mark/mark-all; CorridorSpine toggle null; Dashboard KPI `navigateTo`; WF name click / Nowa → `runWorkflowNow` → notification |
| 12 | ETA confidence bands | **WIRED** | Overview ETA dd: LOW/MED/HIGH pill + earliest–latest h + reasons + «heurystyka» (no new tab) |
| 13 | Role permissions (cost/rev/margin) | **WIRED** | `canSeeCost/Revenue/Margin` in drawer pricing + Finance/Inv; locked copy for other roles |
| 14 | Addresses Śrem Grunwaldzka 27C / Boden Stalverket 20 | **WIRED** | `SITES` + geofences gf-01 / gf-11 |

---

## Chat audit A–E (refresh)

| ID | Status | Notes |
|---|---|---|
| A1–A9 | **WIRED** / A2 visual owned | Full business functions in Vite makieta under Claude shell |
| B1–B10 | **WIRED** | Theme, addresses, SEFS, permits, SCX rates, factoring, KSH schedule, preview |
| C1–C18 | **WIRED** except C3/C8/C10 PARTIAL; C4 DONE (FINAL_SQUINT); C5=12 WF | TV/AIS live need keys; living feel continuous |
| D1–D4 | **WIRED** / D3 PARTIAL | AIS proxy live or seed labeled |
| E1–E2 | **WIRED** | This checklist + audit refresh |

---

## Hollows closed this pass (post-visual)

| Hollow | Fix | Surface (Claude-safe) |
|---|---|---|
| ZIP toast-only / no handler | `lib/zipDocs.ts` JSZip download | Drawer «Pobierz paczkę ZIP»; Docs «Pobierz paczkę tygodnia» |
| Wgraj dokument `onClick={()=>{}}` | `uploadDocument` missing cat | Drawer docs `.btn` |
| Eksport XLSX no handler | `lib/xlsxExport.ts` ExcelJS | Schedule `.chipbtn` (HHL keeps Eksport-only chrome) |
| Factoring UI stripped | HHL configure + SCX choose panels | Invoices `.panel` / `.kv` / `.mrow` |
| ETA bands not shown | confidence + band in overview ETA | Drawer Przegląd `.kv` ETA dd only |
| SEFS static 12,4% theater | live `computeSefs` + below-threshold list | Finance BAF `.kv` keys unchanged |
| WF run removed with Uruchom | name click + Nowa chip → `runWorkflowNow` | Workflows `.wf` / existing chipbtn label |
| Ustalenia set dims not saved | L×W×H / masa / escortPlate inputs | Ustalenia form only |
| TV/AIS unlabeled | live\|seed in map note | Map `.note` (no 6th layer chip) |
| AIS hidden if ferry toggle gone | AIS vis ← ferry \|\| vehicles | CorridorMap (no chrome) |

---

## Remaining GAPs (honest)

1. **Trafikverket / AIS live** — require API keys; without key = **seed** label (by design, not fake live).
2. **«Nowa reguła»** — label frozen; click runs first enabled workflow (makieta), does not open a rule builder form (React Flow out of scope).
3. **Claude Next/Supabase stack** — out of Vite makieta scope; functions mirrored in-memory.

**Closed this pass:** Workflows **12** (keep 7 Claude names + append wf-8…12 product PL). Persist key `watch-tower-ui-v5-wf12`. Re-QA SHIP was already 10/10 (`QA_RE_SHIP_FROZEN.md`).

---

## Files touched (executor)

- `src/lib/zipDocs.ts` **new**
- `src/lib/xlsxExport.ts` **new**
- `src/components/drawer/LoadDrawer.tsx` — ZIP, Wgraj, ETA bands, Ustalenia set dims
- `src/views/ScheduleView.tsx` — Eksport XLSX
- `src/views/DocsView.tsx` — ZIP tygodnia
- `src/views/InvoicesView.tsx` — factoring HHL/SCX
- `src/views/FinanceView.tsx` — SEFS kv values + below-threshold
- `src/views/WorkflowsView.tsx` — run via name / Nowa
- `src/views/MapView.tsx` — TV/AIS live\|seed note
- `src/components/map/CorridorMap.tsx` — AIS visibility with vehicles
- `FUNCTIONS_UNDER_CLAUDE.md` **this file**

**Not touched:** `index.css` Claude tokens, Topbar/Nav/CorridorSpine class recipes, Visual-gated strings (`Wymiary L×W×H`, `◐`, `s_*`, WF names, BAF kv keys, map 5 layers).
