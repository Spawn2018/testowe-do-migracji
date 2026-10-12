# MAP_TILES_FIX — Leaflet + public basemap

- **When:** 2026-09-23 ~01:24 CEST (Europe/Warsaw)
- **App:** `/workspace/watch-tower-app`
- **Build:** `npm run build` **PASS**
- **Preview:** http://127.0.0.1:4177/ · AIS :4175 **untouched**

## Problem
MapLibre worker broken (`shared.mjs` 404) → blank / non-functional map.

## Fix
1. **CorridorMap** switched from MapLibre → **Leaflet** (`leaflet` + `@types/leaflet`, already installed).
2. Removed `setWorkerUrl` / `maplibre-gl-worker` import from CorridorMap (maplibre stays in `package.json` unused).
3. Import `leaflet/dist/leaflet.css`. Map container `absolute inset-0` with explicit height parent.
4. Layer badge: **`Carto public tiles · {theme}`**.
5. Attribution: OSM + CARTO (+ Esri note).

## Basemap (public, no key)
Requested Carto CDN URLs:

- dark: `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png`
- light: `https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png`

**Reality check (2026-09):** those Carto CDN endpoints return watermark tiles  
(`API KEY REQUIRED` / `carto.com/basemaps/apikey`) without a key — geography not visible.

**Live tiles used instead (public, no key, geography OK):**

- dark: Esri Canvas `World_Dark_Gray_Base` (`…/tile/{z}/{y}/{x}`)
- light: Esri Canvas `World_Light_Gray_Base`

Constants `CARTO_DARK` / `CARTO_LIGHT` kept in source for the intended endpoints.

## Features retained
- Corridor polyline (`corridor_ref` / `CORRIDOR_REF_COORDS`)
- Ferry leg polyline
- Fleet markers (1.5s tick drift animation)
- Ferry AIS markers + permanent labels
- Geofence circles (`radiusM`)
- Trafikverket situation points
- Layer toggles (`mapLayers.*`)
- Click → `selectLoad`, hover → `setHoverLoad`
- Focus mode (selected load only)
- Theme swap retargets tile URL

## Evidence
- Screenshot: `watch-tower-app/shots-start/map-tiles-fix.png`
  - Leaflet container + tiles loaded
  - Scandinavia / N Europe geography visible
  - Badge: `Basemap: Carto public tiles · dark · …`
  - Overlays: corridor, fleet, AIS (Nova Star / M/F Wawel)
- Crop: `shots-start/map-tiles-crop.png`

## Untouched
- AIS proxy `:4175` / store / visual-v4 Dashboard chrome
- Trafikverket middleware / seed situations

## Files
- `src/components/map/CorridorMap.tsx` — Leaflet rewrite
- `src/components/map/CorridorMap.leaflet.tsx` — backup copy of same
- `scripts/shot-map-tiles-fix.mjs` — screenshot helper
