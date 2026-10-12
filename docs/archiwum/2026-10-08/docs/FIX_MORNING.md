# FIX_MORNING — Sebastian bugs (Ryzyka / Harmonogram / Mapa)

**When:** 2026-09-23 Europe/Warsaw (UTC+2)  
**App:** `/workspace/watch-tower-app`  
**Chrome:** Claude v2 frozen — layout/CSS/behavior only, no redesign  
**Persist:** `watch-tower-ui-v6-ready-gate` (unchanged)

## Bundle
- JS: `dist/assets/index-_gz-WMP7.js`
- CSS: `dist/assets/index-DNEbhzR1.css`
- `npm run build` — **PASS**

## Public
- Local: `http://127.0.0.1:4177/` → 200  
- Tunnel: `https://loaded-borders-leads-mba.trycloudflare.com` → 200

## Fixes

### 1) Ryzyka rozjeżdża się
**Cause:** `RisksView` returned a React fragment → three `.panel` became direct `main` children. CSS `main > *{flex:1;min-height:0}` squeezed them into one viewport and overflow stacked (ghost E4 Nynäshamn / Gävle).

**Fix:** Wrap panels in single scroll root `.dash.risk-page`. Panels stack and scroll; no absolute pile-up.

### 2) Harmonogram + spine
**Cause:** `ScheduleView` called `filterLoads(..., stageFilter, ...)` and appended spine stage to the counter (`· Przygotowanie`).

**Fix:**
- Pass `null` stage into `filterLoads` (ignore CorridorSpine on Harmonogram only).
- Add local chip **Dostarczone** (`status/stage === DELIVERED`).
- Counter shows only `N / total` — no spine stage label.
- Spine still navigates Map/filters Kokpit/Map as before.

### 3) Mapa pusta
**Cause:** `.mapbox svg{width:100%;height:100%}` stretched Leaflet overlay SVG panes → polylines/circleMarkers rendered off-geometry (tiles OK, markers/route invisible).

**Fix:**
- Scope SVG stretch to bare schematic children; force Leaflet overlay/marker SVGs `width/height:auto`.
- `CorridorMap` root fills `.mapbox` via `position:absolute;inset:0` + `ResizeObserver` → `invalidateSize`.
- `.maplayers` z-index 1000 so checkboxes stay clickable above the map root.

## Optical QA
Dir: `/workspace/watch-tower/qa-start/fix-morning/`

| Shot | Check |
|------|--------|
| `01-risks.png` / `01b-risks-se-panel.png` | SE table + ROAD_SE/FM columns clean, no overlap |
| `02-schedule-spine-ignored.png` | Spine Przygotowanie pressed → still 72 rows, no `· Przygotowanie` |
| `02b-schedule-delivered.png` | Dostarczone chip → 7/72, all Dostarczony |
| `03-map-markers.png` | Pojazdy+Trasa+Ryzyka on → corridor + vehicle markers visible |
| `summary.json` | Automated pass flags |

## Files touched
- `src/views/RisksView.tsx`
- `src/views/ScheduleView.tsx`
- `src/components/map/CorridorMap.tsx`
- `src/index.css`
- `FIX_MORNING.md` (this file)
- `scripts/fix-morning-qa.mjs`
