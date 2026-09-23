# SHIP_STATIC — Watch Tower (adversarial)

- **When:** 2026-09-23 01:03 CEST (Europe/Warsaw)
- **App:** `/workspace/watch-tower-app` (dist mtime ~01:03:40 CEST; worker asset present)
- **SoT:** `/workspace/watch-tower/AUDIT_CHAT_REQUIREMENTS.md` blockers 1–16 + A5/A7
- **Also:** UX_MAP.md, PERMIT_ATTACHMENT_RULES.md, QA_ELITE_UPGRADE_CHECKLIST.md
- **Mode:** static code + seed + XLSX smoke; prefer FAIL / NO_SHIP
- **Click:** not re-run this gate (prior click QA had MapLibre/import/READY issues; builder claims fixes — static only)

---

## Verdict: **NO_SHIP**

Not SHIP: blockers **5, 9, 13, 16** FAIL; **A5/A7** FAIL (camera vault hollow). Prefer NO_SHIP until literally every AUDIT blocker + zero-hollow pass.

---

## Scorecard vs AUDIT blockers 1–16

| # | Blocker | Verdict | Evidence |
|---|---------|---------|----------|
| 1 | Real XLSX parse → dry-run → commit (no SG-99 hardcode) | **PASS** | `ScheduleView.tsx:47–59` `acceptFile` → `arrayBuffer` → `dryRunFromXlsx`; libs `scheduleDryRun.ts` / `scheduleParse.ts` / `xlsxRead.ts`; `commitImport` wired `ScheduleView.tsx:25,228`. Smoke on `KSH_HARMONOGRAM.xlsx`: total 123, accepted 41, added sample SG-01…, **no SG-99**. |
| 2 | Spine second-click clears filter | **PASS** | `CorridorSpine.tsx:46–47` `next = stageFilter === stage ? null : stage` then `navigateTo({ view:'map', stage: next })`. |
| 3 | Bell mark-read (keep history) + aria-haspopup | **PASS** | `useTowerStore.ts:307–310` sets `read: true` (map, not filter-delete); `NotificationBell.tsx:48` `aria-haspopup="dialog"`; mark-one `:127`. |
| 4 | sessionStorage.wtNavCollapsed | **PASS** | `useTowerStore.ts:226,289` `sessionStorage.getItem/setItem('wtNavCollapsed')` — matches SoT key. |
| 5 | Zero hollow: Plan B, camera→storage blob, ZIP real, no toast-only mocks | **FAIL** | **ZIP:** real store-method archive `DocsView.tsx:18–65,230+`. **Plan B:** `RisksView.tsx:104–112` `pushNotification` + toast (matches UX_MAP mock notify — not toast-only). **Camera→vault: FAIL** — `driverAttachDoc` (`useTowerStore.ts:396–408`) only `appendEvent(DOC_UPLOADED)` + toast; **no `documents[]` row, no bytes/blob**. `Document` type (`types/index.ts:168–178`) has no blob field. `DriverPwa.tsx:95–101` passes `f.name/f.size` only. |
| 6 | Permit cover gates READY; TRIP/REGULATION UI | **PASS** | `permits.ts:407+` `cover()`; `isReadyBlocked` / `evaluateLoadCover` `:477–498`; drawer uses gate + cover banner; store `setLoadStatus` READY short-circuits when blocked (`useTowerStore.ts` READY gate). Docs UI TRIP/REGULATION copy `DocsView.tsx:193–197`. Seed kinds PERIOD/TRIP/REGULATION/NONE present. |
| 7 | MapLibre tiles/worker + AIS live stable w/ proxy | **PASS** *(static)* | `CorridorMap.tsx:3–8` `setWorkerUrl(maplibreWorkerUrl)`; dist `assets/maplibre-gl-worker-*.mjs`. AIS: proxy script + `ais.ts` `:4175`; UI labels seed vs live (`CorridorMap.tsx:410`). *Not click-verified this turn.* |
| 8 | ETA confidence LOW/MED/HIGH + earliest–latest + reason chips | **PASS** | `eta.ts` bands + reasons; `applyEtaToLoad` on init (`useTowerStore.ts:217`). Drawer ETA tab: confidence pill, earliest→latest, reason chips, per-segment confidence/range/reasons (`LoadDrawer.tsx:532–610`). Type `EtaConfidence = 'LOW'\|'MED'\|'HIGH'`. |
| 9 | Full e2e UX_MAP §2 click path | **FAIL** | Static chain import→assign→resources→permits→ferry→geofence→POD→invoice→factoring **mostly wired**, but POD/camera step is hollow (event-only, no vault doc) → path not “zero wydmuszek”. Prefer FAIL without click proof of full path. |
| 10 | Expand workflows beyond 7; run log → notifications | **PASS** | Seed `wf-1`…`wf-12` (12 rules); `runWorkflowNow` appends run + notification + toast (`useTowerStore.ts` ~673–698). |
| 11 | Data diversity (ferry, invoice weeks ≥3, permit stress) | **PASS** | 62 loads; ferry bookingRef on ~54; invoices W36–W39 (4 weeks); attachmentKind PERIOD/TRIP/REGULATION/NONE mix. |
| 12 | Trafikverket live when key; seed labeled honestly | **PASS** | `trafikverket.ts` live\|seed; map chrome `Situation: live TV \| seed`, `AIS seed (brak klucza)` (`CorridorMap.tsx:402–410`). |
| 13 | Driver PWA: GPS share + 4 milestones + camera stores file in vault | **FAIL** | Milestones: 4 CTAs → `driverMilestone` status change — OK. GPS: `driverSharePosition` explicit **watchPosition mock** + toast `(mock)` (`useTowerStore.ts:908–921`). Camera: **no vault** (see #5) — only DOC_UPLOADED event metadata. |
| 14 | Geofence editor fully mutates + notifies | **PASS** | `saveGeofence` mutates array + `pushToast` + `pushNotification` to role flags (`useTowerStore.ts:547–568`). |
| 15 | Finance SEFS waterfall + below-threshold flag | **PASS** | `pricing.ts:73` `belowThreshold: marginPct < 0.12`; `FinanceView.tsx:233–255` waterfall + BELOW THRESHOLD flag. |
| 16 | Re-QA until SHIP (not FIX) | **FAIL** | This static gate → **NO_SHIP**; remaining hollow prevents SHIP. |

**A5 (100% klikalny, zero wydmuszek):** **FAIL** — camera vault + GPS mock.  
**A7 (każda funkcja/moduł działa):** **FAIL** — driver document vault incomplete.

---

## Remaining hollow / deferrals

1. **Camera → vault:** `driverAttachDoc` does not create a `Document`, does not retain file bytes/blob/objectURL; UI admits event-only (`DriverPwa.tsx:101`).
2. **GPS share mock:** labeled `(mock)` / `watchPosition mock` — not honest “share” beyond seed coords event.
3. **Plan B residual:** notification + toast only (no `appendEvent` / risk-status mutation). Acceptable vs UX_MAP §6.1 mock notify; still thin vs “immutable trail” elite E1 if Plan B counted as exception primary action.
4. **E2E §2:** not click-closed this gate; MapLibre/AIS live stability not re-probed in browser after worker fix.
5. **No product deferrals claimed in code comments** that reopen AUDIT E2 — hollow is implementation gap, not documented deferral.

---

## Evidence file:line (anchors)

| Topic | Loc |
|-------|-----|
| XLSX acceptFile | `src/views/ScheduleView.tsx:47–59` |
| dryRunFromXlsx | `src/lib/scheduleDryRun.ts` (+ `scheduleParse.ts`, `xlsxRead.ts`) |
| Spine clear | `src/components/shell/CorridorSpine.tsx:46–47` |
| Bell mark-read | `src/store/useTowerStore.ts:307–310`; `NotificationBell.tsx:48,127` |
| sessionStorage key | `src/store/useTowerStore.ts:226,289` |
| Plan B notify | `src/views/RisksView.tsx:104–112` |
| ZIP real | `src/views/DocsView.tsx:18–65` |
| Camera hollow | `src/store/useTowerStore.ts:396–408`; `src/views/DriverPwa.tsx:95–101` |
| cover / READY gate | `src/lib/permits.ts:407–498`; store READY branch |
| MapLibre worker | `src/components/map/CorridorMap.tsx:3–8`; `dist/assets/maplibre-gl-worker-*.mjs` |
| ETA UI | `src/components/drawer/LoadDrawer.tsx:532–610`; `src/lib/eta.ts` |
| Workflows 12 | `src/data/seed.ts` `wf-1`…`wf-12` |
| Geofence notify | `src/store/useTowerStore.ts:547–568` |
| SEFS below | `src/lib/pricing.ts:73`; `src/views/FinanceView.tsx:233–255` |
| GPS mock | `src/store/useTowerStore.ts:908–921` |

---

## Overall: **NO_SHIP**

Builder closed many prior FIX items (XLSX bytes parse, spine clear, bell read-flag, sessionStorage key, MapLibre worker URL, cover→READY, ETA bands, workflow count, SEFS flag, geofence notify). **SHIP blocked** by **driver camera vault** (and GPS mock) violating AUDIT **#5 / #13 / A5**. Re-run this gate after vault stores a real `Document` (and preferably blob/objectURL) and GPS mock is either real `watchPosition` or an honest non-primary label.
