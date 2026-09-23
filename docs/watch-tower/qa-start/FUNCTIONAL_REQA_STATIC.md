# FUNCTIONAL_REQA_STATIC — Watch Tower SPA

- **When:** 2026-09-23 01:45 CEST (Europe/Warsaw)
- **App:** `/workspace/watch-tower-app` · preview `http://127.0.0.1:4177/` (HTTP 200)
- **Mode:** functional-only static Re-QA · **prefer FAIL** · visual/Claude-shell look out of scope
- **SoT:** UX_MAP M1–M12 · AUDIT functional blockers · checklist items 1–12 below
- **Method:** source + seed + dist evidence (no visual judgment)

---

## Verdict: **SHIP**

No functional hollow found on the 12 gates. Prior Wave1/Plan B / vault / GPS / Leaflet closeouts still hold in current tree. Prefer FAIL posture applied; none of the gates met FAIL criteria.

---

## Scorecard (prefer FAIL)

| # | Gate | Verdict | Evidence |
|---|------|---------|----------|
| 1 | Map is Leaflet (`CorridorMap.tsx` uses `L.map`) | **PASS** | `src/components/map/CorridorMap.tsx:2-3` imports `leaflet` + CSS; `:167` `L.map(containerRef.current, …)`; tiles via `L.tileLayer` `:175`. Wired from `MapView.tsx:5,66` and `DashboardView.tsx:6,425`. Dist bundle contains leaflet runtime (`dist/assets/index-*.js`). *Residual:* unused MapLibre assets still under `public/` + CSS `.maplibregl-*` leftovers — not the active map path. |
| 2 | Import: `dryRunFromXlsx` real parse | **PASS** | `ScheduleView.tsx:47-61` `arrayBuffer` → `dryRunFromXlsx(buf,…)`. `scheduleDryRun.ts:68-75` → `readXlsxRows` → `parseSchedule` → `diffSchedule`. `xlsxRead.ts:22-26` ExcelJS `wb.xlsx.load`. No SG-99 hardcode path in dry-run. Smoke on `ship-qa-unique.xlsx`: rows parsed, code `QA-UNIQUE-742`, no SG-99. |
| 3 | READY←cover `isReadyBlocked` | **PASS** | `permits.ts:493-498` `isReadyBlocked` (docMissing + `evaluateLoadCover`). Store gate `useTowerStore.ts:484-497` rejects READY + toast/`READY_BLOCKED` event. Drawer `LoadDrawer.tsx:64,174,192` disables / banners when blocked. |
| 4 | `applyPlanB` mutates ferry + `PLAN_B_ACTIVATED`; risk-8 has `loadId` | **PASS** | `useTowerStore.ts:1042-1123`: resolves `loadId`, mutates `load.ferry` (vessel/dep/arr/`BOOKED`/bookingRef) `:1069-1087`, appends `PLAN_B_ACTIVATED` `:1099-1113`, notify+toast. Seed `seed.ts:538-547` **`risk-8` has `loadId: ferry.id`** + `ferryPlanB`. UI `RisksView.tsx:129` calls `applyPlanB`. |
| 5 | Camera vault `documents[]` + `dataUrl` | **PASS** | `DriverPwa.tsx:115-137` `FileReader.readAsDataURL` → `driverAttachDoc`. Store `useTowerStore.ts:408-475` builds `Document` with `dataUrl: payload.dataUrl` `:438`, prepends to `documents` `:443-447`. `DocsView.tsx:131-133` Podgląd when `d.dataUrl`. Persist `partialize` includes `documents` `:1136` (quota residual only). |
| 6 | GPS real geolocation | **PASS** | `driverSharePosition` `useTowerStore.ts:975-1039`: success only via `navigator.geolocation.getCurrentPosition` `:992`; writes lat/lng + `POSITION_SHARED`; deny/unavailable → `POSITION_SHARE_DENIED`. **No mock success path.** (One-shot `getCurrentPosition`, not continuous `watchPosition` — still real geolocation.) |
| 7 | Spine second-click clear | **PASS** | `CorridorSpine.tsx:50-51` `next = stageFilter === stage ? null : stage` → `navigateTo({ view:'map', stage: next })`. `navigateTo` `useTowerStore.ts:310-315` applies `opts.stage` when `!== undefined` (incl. `null`). |
| 8 | 12 workflows run→notif | **PASS** | Seed `wf-1`…`wf-12` (`seed.ts:54-166+`). `runWorkflowNow` `:741-766` appends `workflowRuns` + **`notifications`** + toast. UI `WorkflowsView.tsx:10,45` Run button → `runWorkflowNow(w.id)`. |
| 9 | ETA confidence bands | **PASS** | `eta.ts` LOW/MED/HIGH + earliest/latest + reasons; `applyEtaToLoad` on init (`useTowerStore.ts:227`). Drawer ETA tab `LoadDrawer.tsx:77,536-600` confidence pill, range, segment chips, method label. |
| 10 | Polish default UI (`locale pl`, nav via i18n) | **PASS** | Store default `locale: 'pl'` (`useTowerStore.ts:233`). `messages.ts` pl dict: `nav_dash: 'Kokpit'`, `nav_map: 'Mapa'`, … `nav_geo: 'Strefy'`. `Nav.tsx:53,122` `navLabel(locale, key, role)`. Topbar brand/project/role via `t(locale,…)`. Not English-only chrome on default. *Minor:* toast reason `'docMissing flag'` (`permits.ts:495`) is English fragment inside Polish toast — not chrome-wide EN. |
| 11 | M1–M12 views exist + wired App/Nav | **PASS** · **MISSING: none** | See module map below. All surfaces present; role-scoped Nav is intentional (`permissions.ts` NAV_BY_ROLE). |
| 12 | ≥60 loads | **PASS** | `src/data/loads.json` length **62** (`load-001`…`load-062`); `buildSeedLoads()` maps raw JSON (`seed.ts:204+`); store `initialLoads` from seed. |

---

## M1–M12 wiring map

| Mod | SoT (UX_MAP) | Surface | App / Nav |
|-----|--------------|---------|-----------|
| M1 | Harmonogram | `ScheduleView` | App `sched` · Nav all roles |
| M2 | Lista + panel | `MapView` list pane (+ Schedule table) | App `map`/`sched` |
| M3 | Mapa | `CorridorMap` (Leaflet) in `MapView` / dash embed | App `map` |
| M4 | Geofence | `GeofenceView` | App `geo` · Nav **HHL only** |
| M5 | PWA kierowcy | `DriverPwa` | App `Route /driver/:token` (not sidebar — by SoT) |
| M6 | Dokumenty | `DocsView` | App `docs` · Nav all |
| M7 | Cennik / BAF | `FinanceView` | App `fin` · Nav all (labels role-i18n) |
| M8 | Dashboardy | `DashboardView` | App `dash` · Nav all |
| M9 | Workflow | `WorkflowsView` (12 rules) | App `wf` · Nav **HHL only** |
| M10 | Ryzyka | `RisksView` + Plan B | App `risk` · Nav all |
| M11 | Faktura + factoring | `InvoicesView` | App `inv` · Nav HHL+SCX |
| M12 | ETA bands | `LoadDrawer` tab `eta` | Drawer (not separate nav key) |

**MISSING:** none.

Extra (not M1–M12): `TasksView` (`tasks`, SCX nav) — present, out of M-list.

---

## AUDIT functional blockers (spot)

| Topic | Status vs this tree |
|-------|---------------------|
| Real XLSX dry-run→commit | PASS (#2) |
| Spine clear | PASS (#7) |
| READY←cover | PASS (#3) |
| Zero hollow Plan B / camera vault / GPS | PASS (#4/#5/#6) — prior risk-8 `loadId` gap **closed** |
| ETA bands | PASS (#9) |
| Workflows ≥7 (now 12) run→notif | PASS (#8) |
| Map engine | Leaflet (#1) supersedes older MapLibre-blocker wording; basemap path is L.tileLayer |
| ≥60 loads / diversity | PASS (#12, 62) |
| PL default chrome | PASS (#10) |

Accepted residuals (not FAIL under SoT): AIS/Trafikverket **seed labeled** without keys; camera vault localStorage quota; GPS one-shot; dead MapLibre public assets.

---

## Overall: **SHIP**

Functional checklist **12/12 PASS**. No module missing. No remaining hollow on Plan B / vault / GPS / import / READY / Leaflet / workflows / ETA / PL nav. Re-QA gate closed for functional ship.

