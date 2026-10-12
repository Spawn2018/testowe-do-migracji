# FIX_FN2_HOLLOWS — click FAILs 1–4 (Claude shell only)

- **When:** 2026-09-23 ~03:11 Europe/Warsaw (UTC+2)
- **App:** `http://127.0.0.1:4177/` · bundle `index-Dy3BsA9-.js`
- **Rule:** Claude chrome FROZEN — no look/CSS/copy/Visual-gated string edits
- **Note:** Prior QA shots (`fn2-*.png`) were from a **non-Claude** shell (wrong brand/tabs/spine labels). Re-QA must hard-refresh Claude on **4177**.

## Changes

### 1. Ustalenia empty (`LoadDrawer` tab `chat`)
- **HHL / SCX (`canEditResources`):** forms Zasoby + Awizacja/Prom + Zapisz unchanged; replaced `display:contents` wrappers with `Fragment` so grid `.kv` inputs stay in the form tree.
- **KSH:** never blank — read-only note «Edycja zasobów i awizacji: Scandinavian Express / H&H» + current values in `.kv` (zasoby + awizacja/prom).
- Action row (Przypisz SCX / READY / …) + chat remain below for all roles.

### 2. Eksport XLSX missing (`ScheduleView`)
- `Eksport XLSX` chip already outside `canImportSchedule` — kept for **HHL / KSH / SCX**.
- Panel header: `flexWrap` + chip group so second chip is not clipped; `data-action="export-xlsx"`.
- Rebuild + restart preview 4177 (stale-bundle suspicion).

### 3. READY on SG-07 despite MISMATCH
- `evaluateLoadCover`: check `status === 'MISMATCH'` **or** `permitFits === false` **before** `cover()` so `attachmentKind: NONE` cannot report OK over a MISMATCH doc.
- `isReadyBlocked`: explicit blocks for `docMissing`, MISMATCH / `permitFits===false`, then `!evaluateLoadCover.covered`.
- `setLoadStatus(..., READY)` already refuses + toast — unchanged path.
- Drawer READY: `disabled` uses same gate (`permitBlock || !coverInfo.covered || docMissing`).
- Verified: **SG-07 / load-010** → `gate.blocked === true` (`MISMATCH document`) even if kind forced to `NONE`.

### 4. Spine / map POI 2nd-click clear
- `CorridorSpine`: 2nd click same stage → `setStageFilter(null)` + `navigateTo({ stage: null })` (stay on current view; filter cleared). 1st click → map + filter.
- `setStageFilter(null)` always clears (no toggle quirk).
- Map: situation + geofence click toggle `mapFocusKey`; **2nd click same key clears focus** and does **not** navigate to Prom/Ryzyka (addresses «E4 Gävle» POI steal).

## Build / preview
- `npm run build` — **PASS**
- Preview restarted: `127.0.0.1:4177` · `index-Dy3BsA9-.js`

## Out of scope
- No CSS / Claude chrome / Visual-gated copy.
- Wrong-shell QA evidence discarded for ship gate; parent will re-ping QA on Claude only.
