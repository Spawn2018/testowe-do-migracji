# HOLLOW_FIX — Watch Tower QA NO_SHIP closeout

- **When:** 2026-09-23 ~01:10 CEST (Europe/Warsaw)
- **App:** `/workspace/watch-tower-app`
- **Build:** `npm run build` **PASS**
- **Preview:** http://127.0.0.1:4177/ · AIS :4175 (untouched)

## Hollows eliminated

### 1) Driver camera → documents vault
- `DriverPwa`: `FileReader.readAsDataURL` → `driverAttachDoc({ filename, bytes, dataUrl, mimeType, category })`
- Store writes real `Document` into `documents[]` (same store DocsView reads), category **CMR|POD**, `loadId`, `dataUrl` (localStorage-capable via zustand `persist` partialize), event `DOC_UPLOADED`, notification
- DocsView: **Podgląd** link when `dataUrl` present
- Not event/toast-only anymore

### 2) Driver GPS share
- `navigator.geolocation.getCurrentPosition` when available
- Success: updates load `lat`/`lng` + `POSITION_SHARED` event with coords
- Deny / unavailable / timeout: `POSITION_SHARE_DENIED` + honest HIGH toast — **no fake success**

### 3) Plan B (RisksView)
- New `applyPlanB(riskId, optionIndex)`: mutates load `ferry` (vessel / dep+24h / bookingRef `PLANB-…` / `BOOKED`), softens risk, `PLAN_B_ACTIVATED` load event, notification + toast
- UI: pick option → **Aktywuj Plan B + powiadom SCX**

## Regression intact (not reverted)
| Check | Status |
|-------|--------|
| READY ← permit cover (`isReadyBlocked` / `evaluateLoadCover`) | intact |
| ExcelJS XLSX import (`xlsxRead` / `dryRunFromXlsx`) | intact |
| Spine 2nd-click clear (`CorridorSpine` → `null`) | intact |
| AIS proxy :4175 / MapLibre worker | intact |
| Visual / dense glass | not touched |

## Files
- `src/types/index.ts` — Document vault fields
- `src/store/useTowerStore.ts` — attach / GPS / applyPlanB
- `src/views/DriverPwa.tsx`, `RisksView.tsx`, `DocsView.tsx`

## Note for re-QA
Large camera photos inflate localStorage; vault still real for SHIP gate. Click-probe MapLibre/AIS live separately if needed.
