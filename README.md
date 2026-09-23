# WATCH TOWER — makieta klikalna (PL→SE oversized)

Client-side SPA: Vite + React + TypeScript + Tailwind + **MapLibre GL**. Zustand store (+ localStorage persistence for mutations). Roles: **HHL | KSH | SCX** only (Stalverket 20 Boden = SITE/POI, not a login role).

Corridor (permit/reference, **not** ORS legal): **KSH Śrem (Grunwaldzka 27C)** → PL road → **Polferries Gdańsk** → ferry → **Nynäshamn** → E4 → **Stalverket 20, Boden**.

## Run

```bash
cd /workspace/watch-tower-app
npm i
npm run dev
```

AIS proxy (server-side key — never in browser):

```bash
# loads AISSTREAM_API_KEY from box-secrets / env
bash scripts/start-ais-proxy.sh   # ws://localhost:4175/ais
```

Production build:

```bash
npm run build
npm run preview
```

## Env

| Variable | Where | Purpose |
|---|---|---|
| `VITE_MAPTILER_KEY` | client optional | MapTiler style; **if empty → OpenFreeMap** `tiles.openfreemap.org/styles/dark` (dark) / `liberty` (light) |
| `TRAFIKVERKET_API_KEY` or `VITE_TRAFIKVERKET_API_KEY` | **server** (Vite middleware `/api/trafikverket`) | Live Situation v2; without key → seed E4 demo |
| `AISSTREAM_API_KEY` | **server only** (`scripts/ais-proxy.mjs`) | Live ferry AIS (Wawel/Nova Star); without key → seed positions |
| `VITE_AIS_WS_URL` | client optional | override AIS WS (default `ws://<host>:4175/ais`) |
| `ORS_API_KEY` | optional | orientational HGV shadow only — never SoT route |

## Map layers (MapLibre)

1. `corridor-route` — `src/data/corridor_ref.json` permit/reference LineString  
2. `ferry-leg` — schematic GDN→NYN sea line  
3. `fleet-sim` — trucks via Turf `along(corridor_ref, progress)` · tick ~1.5s  
4. `trafikverket-situation` — live or seed  
5. `ferry-ais` — AISStream via local proxy (MMSI 311852000 / 311000787)  
6. geofences + POI  

UI badges: **Situation: live TV | seed** · **AIS live | AIS seed (brak klucza)** · ferry sailing label (WAW/NS, dep time). Polferries = HTML seed / HITL — **no booking API**.

## Demo click-path

### HHL Ops (dark default)
1. **Kokpit** — click KPI / exception → drawer or module deep-link  
2. Spine stage → filters map  
3. **Mapa** — MapLibre tiles, live truck motion, ferry AIS markers, E4 chips  
4. Bell → mark read → item vanishes from unread  
5. Nav collapse (☰) → 56px icon rail  

### KSH (light default)
1. Role **KSH** + logos in switcher  
2. **Harmonogram** — drag-and-drop XLSX → map → dry-run → commit  
3. Finanse = **revenue only** (no cost/margin DOM)  

### SCX (dark)
1. **Zadania** · KPI **Koszt tyg.** (not KSH revenue)  
2. Driver `#/driver/demo-active` or `demo-sg14` → load-020 (SG-14)  

## Seed
- **72 loads** (SG/T/K/R/P/D/SS) incl. P7 weather, ferry, E4, GPS, permit and sequence exceptions  
- SEFS + SCX rates + permits `cover(PERIOD|TRIP|REGULATION)`  
- Factoring HHL → SCX invoice  

## Visual
Cold steel + amber · restrained **glass on chrome only** (topbar / bell panel / map overlays) · dense command center per `START_UI_SPEC.md`.
