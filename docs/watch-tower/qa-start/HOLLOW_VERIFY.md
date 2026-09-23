# HOLLOW_VERIFY — adversarial closeout

- **When:** 2026-09-23 CEST (Europe/Warsaw)
- **App:** `/workspace/watch-tower-app`
- **Method:** source review against `HOLLOW_FIX.md`, plus `npm run build` and `npm run lint`.
- **Verdict:** **NO_SHIP**

## Checks

### 1) `driverAttachDoc` writes a `Document` with `dataUrl` into `documents[]` — PASS

Evidence: `src/store/useTowerStore.ts:406-474` resolves the driver token, constructs a full `Document` at `426-440` including `dataUrl: payload.dataUrl` (`436`), then prepends it to `documents` at `441-449`. It rejects an empty data URL at `421-423` and emits `DOC_UPLOADED` at `450-465`.

### 2) DriverPwa `FileReader.readAsDataURL` wired — PASS

Evidence: `src/views/DriverPwa.tsx:104-138`: file input change creates `FileReader` (`115`), reads `reader.result` (`120-125`), passes `dataUrl` to `driverAttachDoc` (`127-133`), and calls `reader.readAsDataURL(f)` (`137`).

### 3) DocsView `Podgląd` for `dataUrl` — PASS

Evidence: `src/views/DocsView.tsx:131-135` conditionally renders a `Podgląd` anchor when `d.dataUrl` exists, with `href={d.dataUrl}` and a new tab. Note: `download={d.name}` may make the browser download rather than inline-preview in some browsers, but the persisted data URL is wired to the control.

### 4) `driverSharePosition` uses real geolocation, with no mock success path — PASS

Evidence: `src/store/useTowerStore.ts:973-1037`: unavailable geolocation records `POSITION_SHARE_DENIED` (`979-988`); the only success path is `navigator.geolocation.getCurrentPosition` (`990`), which writes the returned coordinates and emits `POSITION_SHARED` (`991-1015`). Error/deny/timeout emits denial (`1017-1035`). It uses **`getCurrentPosition`, not `watchPosition`**; there is no mock-coordinate success fallback in the app source.

### 5) `applyPlanB` mutates ferry and emits `PLAN_B_ACTIVATED` — FAIL

The linked-load path works: `src/store/useTowerStore.ts:1060-1089` mutates `load.ferry` (vessel, departure/arrival, booking ref, `BOOKED`) and `1090-1104` emits `PLAN_B_ACTIVATED`.

However, the operation is guarded by `if (loadId)` (`1060`). Seed data exposes a selectable ferry Plan B with **no load ID**: `src/data/seed.ts:537-547` (`risk-8`, `ferryPlanB`, no `loadId`). The UI still invokes `applyPlanB` for it (`src/views/RisksView.tsx:119-125`). That path only pushes notification/toast (`1106-1115`), with no ferry mutation and no activation event. This is a real hollow path.

### 6) Persist `partialize` includes documents/data URL — PASS, with quota risk

Evidence: `src/store/useTowerStore.ts:1117-1140` includes the entire `documents` array at `1127`; no mapper strips `dataUrl`. The field is part of `Document` at `src/types/index.ts:168-182` (`dataUrl` at `178-180`). Therefore the vault is not stripped by `partialize` on reload.

Residual risk remains: large camera data URLs can exceed localStorage quota and cause persistence failure; this is a capacity risk, not a deliberate `dataUrl` stripping path.

### 7) Regression checks — PASS

- **READY gate:** `src/store/useTowerStore.ts:481-497` calls `isReadyBlocked` before allowing `READY`; `src/lib/permits.ts:493-498` enforces `docMissing`/coverage blocking. The drawer also disables the action when blocked (`src/components/drawer/LoadDrawer.tsx:184-190`).
- **Spine clear:** `src/components/shell/CorridorSpine.tsx:43-48` sets the next filter to `null` on a second click.
- **XLSX parse:** `src/views/ScheduleView.tsx:47-61` reads the file and calls `dryRunFromXlsx`; `src/lib/scheduleDryRun.ts:68-75` calls `readXlsxRows` and parses the rows; `src/lib/xlsxRead.ts:22-26` still uses ExcelJS.
- `npm run build`: **PASS**.
- `npm run lint`: completed with two pre-existing warnings, no errors.

## Ship decision

**NO_SHIP** until the unlinked `risk-8` Plan B path is either given a valid `loadId` or explicitly disabled/handled with a real ferry target and `PLAN_B_ACTIVATED` event. The other hollow-fix paths are present; persistence still needs a size/quota strategy before treating large camera uploads as durable.
