# FUNCTIONAL_REQA_STATIC_FN2 — Watch Tower SPA

- **When:** 2026-09-23 02:56 CEST (Europe/Warsaw)
- **App:** `/workspace/watch-tower-app`
- **Mode:** static adversarial probe only; no code/CSS/token changes; prefer **FAIL**
- **SoT:** `/workspace/watch-tower-app/FUNCTIONS_UNDER_CLAUDE.md`
- **Method:** source grep + source-chain inspection in `src/views`, `src/components`, `src/lib`, and store; no browser click/e2e claim

## Verdict

**SHIP_STATIC** — scope mandate **#1–#14: 14/14 PASS**. No empty click handler, toast-only business handler, TODO/stub/fake handler, or hollow requested action found in the inspected source. **Hollows found: 0.**

The prefer-FAIL posture was applied: any requested action was treated as FAIL unless its handler reached a real download, store mutation, navigation mutation, event/notification mutation, or explicit labeled seed/live path.

## Scope mandate scorecard

| # | Requirement | Verdict | Static evidence |
|---:|---|---|---|
| 1 | M1–M12 module actions mutate store under Claude views | **PASS** | Schedule import commits via `commitImport` (`src/views/ScheduleView.tsx:256-268`, `src/store/useTowerStore.ts:779-890`); drawer resources/awizacja/ferry/READY/docs; Risks Plan B; Docs/Finance/Invoices/Workflow/Geo/Driver/Map chains are present. |
| 2 | READY blocked without permit cover; `cover()` works | **PASS** | `cover` implements NONE/REGULATION/TRIP/PERIOD checks (`src/lib/permits.ts:407-434`); `isReadyBlocked` evaluates `docMissing` and cover (`:493-498`); store rejects READY and appends `READY_BLOCKED` (`src/store/useTowerStore.ts:483-497`); drawer disables the control (`src/components/drawer/LoadDrawer.tsx:584-590`). |
| 3 | KSH-only Wgraj XLSX dry-run→commit; Eksport available | **PASS** | `canImportSchedule` is exactly `role === 'KSH'` (`src/lib/permissions.ts:45-47`); Wgraj and import panels are gated (`src/views/ScheduleView.tsx:157-175,211`); XLSX export is unconditional (`:162-172`) and calls `exportLoadsXlsx`. |
| 4 | Drawer Ustalenia resource/awizacja/ferry saves | **PASS** | Form submit calls `updateResources` (`src/components/drawer/LoadDrawer.tsx:391-407`), `updateAwizacja` and `updateFerry` (`:482-500`); store mutates loads and events (`src/store/useTowerStore.ts:534-569`). Dimensions/weight inputs are included (`LoadDrawer.tsx:439-471`). |
| 5 | Plan B mutates ferry + audit | **PASS** | UI calls `applyPlanB` (`src/views/RisksView.tsx:127-134`); store mutates ferry/risk, appends `PLAN_B_ACTIVATED`, pushes notification and toast (`src/store/useTowerStore.ts:1042-1124`). |
| 6 | Driver PWA camera → documents vault | **PASS** | FileReader creates a data URL and calls `driverAttachDoc` (`src/views/DriverPwa.tsx:110-137`); store creates `Document`, writes `documents[]`, clears CMR missing flag, appends `DOC_UPLOADED`, and notifies (`src/store/useTowerStore.ts:408-475`). |
| 7 | Geofence/GPS/fleet/AIS | **PASS** | Geofence editor submits `saveGeofence` (`src/views/GeofenceView.tsx:116-129`); map sources include fleet tick/AIS layers (`src/components/map/CorridorMap.tsx:114-144,232-299`); AIS and Trafikverket explicitly track live/seed modes (`src/lib/ais.ts:38-111`, `src/views/MapView.tsx:33-39,169-174`). |
| 8 | Trafikverket labeled live-or-seed | **PASS** | `fetchSituations` returns live or seed mode (`src/lib/trafikverket.ts:132-148`); MapView renders `Trafikverket E4: live|seed` and AIS mode (`src/views/MapView.tsx:169-174`). |
| 9 | Factoring HHL configure / SCX choose | **PASS** | HHL controls call `updateFactoringOffer` (`src/views/InvoicesView.tsx:152-216`); SCX selection changes factoring mode (`:223-286`); store mutates offer and snapshots factoring on invoice submit (`src/store/useTowerStore.ts:892-912`). |
| 10 | SEFS hybrid OKQ8/ORLEN BAF | **PASS** | Finance calls `computeSefs` from `SEFS_WEEKLY` (`src/views/FinanceView.tsx:5,60-62`), renders ORLEN/OKQ8 sources (`:84-99`); implementation is in `src/lib/sefs.ts:50-90`. |
| 11 | Bell read; spine clear; KPI/deep-links; WF notifications | **PASS** | Bell calls mark-one/all (`src/components/shell/NotificationBell.tsx:92-134`) and store sets `read: true` (`src/store/useTowerStore.ts:321-340`); spine second click sends `stage: null` (`src/components/shell/CorridorSpine.tsx:48-51`); Dashboard KPI tiles call `navigateTo` (`src/views/DashboardView.tsx:91-233`); WF run appends run + notification (`src/store/useTowerStore.ts:741-766`). |
| 12 | ETA confidence bands | **PASS** | ETA model emits LOW/MED/HIGH, earliest/latest and reasons (`src/lib/eta.ts:61-115,171-194`); drawer renders band/range/heurystyka (`src/components/drawer/LoadDrawer.tsx:158-168`). |
| 13 | Role permissions cost/revenue/margin | **PASS** | Role gates are explicit (`src/lib/permissions.ts:25-35`); Finance/Invoices/LoadDrawer conditionally render or lock values (`src/views/FinanceView.tsx:130-199`, `src/views/InvoicesView.tsx:35-38`, `src/components/drawer/LoadDrawer.tsx:316-371`). |
| 14 | Addresses Śrem Grunwaldzka 27C / Boden Stalverket 20 | **PASS** | Anchors are seeded in `src/data/seed.ts:39,49`; same sites are defined in `src/lib/status.ts:38-59`. |

## Hollow-pattern probe

### Exact empty handlers

- `onClick={()=>{}}`: **none**
- `onClick={() => {}}`: **none**
- multiline empty arrow bodies `=> {}` in `src/views`/`src/components`: **none**
- inert `onClick={undefined|null|false|true}`: **none**

### Requested action chains

| Action | Verdict | Handler → real effect |
|---|---|---|
| ZIP export | **PASS** | `LoadDrawer.tsx:286-293` and `DocsView.tsx:44-48` call `downloadDocumentsZip`; `src/lib/zipDocs.ts:26-66` builds JSZip and triggers a Blob download. Toast is completion feedback, not the only effect. |
| XLSX export | **PASS** | `ScheduleView.tsx:165-169` calls `exportLoadsXlsx`; `src/lib/xlsxExport.ts:44-81` builds ExcelJS workbook and triggers XLSX Blob download. |
| Wgraj dokument | **PASS** | `LoadDrawer.tsx:303-307` calls `uploadDocument`; store writes/replaces `documents[]` and appends `DOC_UPLOADED`/mismatch event (`useTowerStore.ts:583-613`). |
| Factoring | **PASS** | Inputs directly call `updateFactoringOffer`; store mutation at `useTowerStore.ts:892-895`; SCX choice is consumed by `submitInvoice` (`:897-912`). |
| WF run | **PASS** | `WorkflowsView.tsx:21-25,47-48` calls `runWorkflowNow`; store writes `workflowRuns`, `notifications`, and increments `runCount` (`useTowerStore.ts:741-766`). |
| Ustalenia Zapisz | **PASS** | Submit handlers call `updateResources`, `updateAwizacja`, and `updateFerry` (`LoadDrawer.tsx:391-407,482-500`), not toast-only. |
| Plan B | **PASS** | `RisksView.tsx:131-134` calls `applyPlanB`; ferry/risk/event/notification mutation at `useTowerStore.ts:1069-1124`. |
| READY | **PASS** | `LoadDrawer.tsx:588` calls `setLoadStatus`; store performs permit gate and either rejects with event or mutates the load (`useTowerStore.ts:483-521`). |
| Bell | **PASS** | `NotificationBell.tsx:93,119-122,133` calls mark-all/open/mark-one; store preserves history and sets read flags (`useTowerStore.ts:321-374`). |
| CorridorSpine | **PASS** | `CorridorSpine.tsx:48-51` toggles selected stage to `null` and routes through `navigateTo`; store applies nullable stage (`useTowerStore.ts:310-318`). |
| KPI `navigateTo` | **PASS** | `DashboardView.tsx:95-233,292` wires KPI/deep-link clicks to actual view/filter state; `navigateTo` mutates store (`useTowerStore.ts:310-318`). |
| `driverAttachDoc` | **PASS** | `DriverPwa.tsx:127-133` passes file bytes/data URL; store persists a vault `Document` with `dataUrl` and `source: 'driver'` (`useTowerStore.ts:428-451`). |

## Role-gate probe

- **Wgraj:** `canImportSchedule(role)` is KSH-only (`src/lib/permissions.ts:45-47`), and both upload UI and dry-run/commit UI are gated (`src/views/ScheduleView.tsx:157-175,211`).
- **Eksport:** `Eksport XLSX` is rendered outside the KSH-only branch (`src/views/ScheduleView.tsx:162-172`), so it is available to all current roles.
- **Stegra:** no `Stegra` role exists. `RoleId` is only `HHL | KSH | SCX` (`src/types/index.ts:1-3`), Topbar role list is `['HHL','KSH','SCX']` (`src/components/shell/Topbar.tsx:8`), and nav maps only those roles (`src/lib/permissions.ts:15-18`). “Stegra” appears only as project/site copy, not a nav role.

## Remaining keywords / stubs in requested directories

| Probe | Result |
|---|---|
| `TODO` in `src/views` or `src/components` | none |
| `stub` in `src/views` or `src/components` | none |
| `fake` in `src/views` or `src/components` | none |
| `wkrótce` | one legitimate urgency label, `src/views/TasksView.tsx:42`; no handler/stub semantics |
| fake/toast-only business handler | none found |

**Non-hollow residual noted outside the requested directories:** `src/lib/zipDocs.ts:50-61` contains an intentional metadata-only `.txt` fallback for an uploaded document lacking `dataUrl`, while still producing a real ZIP. This is not an empty handler and does not change the hollow count.

## Final result

- **Checklist:** 14/14 PASS
- **Hollows:** **0**
- **Summary:** **SHIP_STATIC**
- **No code changed.**
