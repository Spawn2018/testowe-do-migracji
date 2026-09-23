# SE road conditions + force majeure delays

**When:** 2026-09-23 Europe/Warsaw (UTC+2)  
**App:** `/workspace/watch-tower-app` · Preview `http://127.0.0.1:4177/`  
**Chrome rule:** Claude Visual FINAL_SQUINT frozen — no shell/CSS/token/label edits; data + risk/map behaviour only under existing panels.

## Files touched
- `src/lib/trafikverket.ts` — enriched `SEED_SITUATIONS` (7 along E4 Nynäshamn→Boden) with `delayMin` + `kind`; live parse estimates delay/kind; `riskTypeForSituation()`
- `src/types/index.ts` — `RiskType` += `FORCE_MAJEURE`; `Risk` += `delayImpactHours`, `situationId`, `causeCategory`
- `src/data/seed.ts` — ROAD_SE ×2 + FORCE_MAJEURE ×4; wf-9 actions; `applyForceMajeureDelays()`
- `src/store/useTowerStore.ts` — init applies FM delays; `ensureRiskFromSituation`; wf-9 Run now hooks TV CRITICAL; persist `watch-tower-ui-v6-ready-gate`
- `src/views/RisksView.tsx` — SCX sees FM; panel **Warunki drogowe SE · E4** (situations + ROAD_SE/FM rows); Prom panel chrome untouched
- `src/components/map/CorridorMap.tsx` — Ryzyka layer tooltips `+N min`; 1st click links `situationId` → riskFilter + selectLoad; 2nd click clears only
- `SE_ROAD_AND_FORCE_MAJEURE.md` — this file

## 1 — Warunki drogowe SE

| Id | Place | Kind | Severity | delayMin |
|---|---|---|---|---|
| seed-sit-nyn | Nynäshamn | restriction | MEDIUM | 28 |
| seed-sit-1 | Gävle | roadworks | HIGH | 35 |
| seed-sit-2 | Sundsvall | accident | HIGH | 55 |
| seed-sit-3 | Umeå N | weather | MEDIUM | 40 |
| seed-sit-4 | Luleå | restriction | CRITICAL | 120 |
| seed-sit-5 | Södertälje | restriction | LOW | 20 |
| seed-sit-boden | Boden S | weather | CRITICAL | 210 |

- Map: existing **Ryzyka** (`seEvents`) — no 6th checkbox. Note still `Trafikverket E4: live|seed`.
- RisksView: second panel under Prom — corridor table + ROAD_SE/FM list (existing `.panel` / `.panel-hd` / `.two` / `.mrow` / `.pill`).

## 2 — Siła wyższa

Seed FM risks (Polish titles, `Odpowiada: …`, cause):
1. Zamknięcie E4 (śnieżyca) · +4 h · CRITICAL · SE_ROAD load  
2. Sztorm Bałtyk / rejs · +12 h · HIGH · ferry window  
3. Akcja związkowa Nynäshamn · +6 h · HIGH  
4. Kontrola graniczna · +3 h · CRITICAL  

`applyForceMajeureDelays` marks linked loads `delayed`, bumps ETA, appends reason. CRITICAL remain in «Wymaga decyzji» (`ul.exq`).  
wf-9 Run now → `ensureRiskFromSituation(CRITICAL seed)`.

## Build / evidence
- `npm run build` — **PASS** (`index-SrSmSOTT.js`)
- Preview: `127.0.0.1:4177`
- Screenshots: `/tmp/wt-se-road.png` (SE panel), `/tmp/wt-force-majeure.png` (FM in queue + panel), `/tmp/wt-se-road-map.png` (Ryzyka layer on)
