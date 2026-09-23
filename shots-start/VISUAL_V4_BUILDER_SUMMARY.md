# VISUAL v4 — Builder ship note (for eye re-gate)

**When:** 2026-09-23 ~01:25 Europe/Warsaw  
**App:** `/workspace/watch-tower-app`  
**Preview:** `http://127.0.0.1:4177/` (`npm run build` PASS · `vite preview`)

## SoT followed
- `research-2026/VISUAL_V4_BRIEF.md` + `VISUAL_V4_HANDOFF.md`
- Anti-slop teeth kept: solid panels, ink-invert seg, no milk-glass KPI/spine/table, no amber chip chrome, IBM Plex

## Must-ship checklist

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Expanded nav labels **186px** default (collapse ≤1100 / toggle) | PASS — measured 186 on HHL + KSH @1440 |
| 2 | Cockpit **triad**: exceptions + chart + map | PASS — `.wt-cockpit` = ex \| chart/map stack |
| 3 | ≤2 full-width strips above main | PASS — spine + optional CRITICAL banner only (no KPI card strip / alert chip row) |
| 4 | Warm near-black premium density (HHL/SCX) | PASS — filled panels, flush edges, not empty void |
| 5 | Real map tiles + legend BL | PASS — MapLibre + local/Carto/demotiles cascade; `.wt-mapkey` bottom-left |

## Shots
- `shots-start/visual-v4-cockpit.png` — HHL dark, nav labels, triad
- `shots-start/visual-v4-map.png` — full map, geography + legend BL
- `shots-start/visual-v4-ksh-light.png` — KSH light AA cockpit

## Implementation notes (no extra chrome)
- Nav default expanded; MQ auto-collapse does **not** pin session
- KPI/meta moved into chart header as flush `.wt-mini-stats` (not a 3rd strip)
- Editorial SVG spark (hairline grid, no gradient candy)
- Embedded CorridorMap in cockpit (ferry chip hidden; legend stays)
- Roles/identity: HHL · KSH · SCX · IBM Plex

## Ask Visual
Eye re-gate vs Claude density bar. If FAIL, cite which checklist row — do not send another polish pass without a new SoT delta.
