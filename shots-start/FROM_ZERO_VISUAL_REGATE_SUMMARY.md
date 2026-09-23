# FROM ZERO — Visual re-gate (after P0/P1 fix)

**When:** 2026-09-23 ~02:04 Europe/Warsaw (CEST)  
**Preview:** `http://127.0.0.1:4173/` · **`npm run build` PASS**  
**SoT:** `claude-makieta.html` ≡ `claude-visual-ref/tower-makieta.html`  
**Prior gate:** `watch-tower/research-2026/visual-gate-from-zero/FROM_ZERO_GATE_RESULT.md` FAIL A–C

## Fixes applied (Claude chrome 1:1)

| # | Gap | Fix |
|---|---|---|
| **A P0** | `Do załatwienia` ≠ `q_title` | `exceptions` → PL **Wymaga decyzji** / EN **Needs a decision** / SV **Kräver beslut** (+ `progress` / `planline` / `actualline`) |
| **B P0** | OTIF-cliff + chip strip | Kokpit triad = Claude `renderDash`: left **Wymaga decyzji** queue · right **Postęp dostaw** Plan/Wykonanie weeks 37–45 · mini **Mapa** |
| **C P0** | 8 stages | Spine **9**: Przygotowanie · Załadunek · Droga PL · **Gdańsk** · Prom · Nynäshamn · Droga SE · Boden · Dostarczone (`GDANSK` stage; `AT_PORT`→Gdańsk; NYN before SE) |
| **D P1** | Blue/yellow map blob + floating chrome | Root cause: `.mapbox svg{width:100%}` stretched Leaflet UA flag. Scoped rule + fixed `.leaflet-attribution-flag`. Solid `.maplayers` / `.mapkey` (z-index 600); geofence/SE events off by default; no ferry float panel |

## DOM check (live)

- Spine labels (9): Przygotowanie, Załadunek, Droga PL, **Gdańsk**, Prom, Nynäshamn, Droga SE, Boden, Dostarczone
- Panel `h2`: H&H Logistics · **Wymaga decyzji** · **Postęp dostaw** · Mapa
- No OTIF / przepustowość shell chrome on Kokpit

## Shots (overwrite)

- `shots-start/from-zero-claude-hhl-dark.png`
- `shots-start/from-zero-claude-ksh-light.png`
- `shots-start/from-zero-claude-map.png`
- `shots-start/from-zero-claude-nav.png`
- Ref: `shots-start/from-zero-claude-makieta-dark.png`
- Metrics: `shots-start/from-zero-claude-metrics.json` (shell tokens still PASS)

## Squint note for Visual

Shell + Kokpit now read as makieta twin: same exception title, triad composition (queue | S-curve + mini map), 9-stage corridor incl. Gdańsk. Map chrome = Claude `.maplayers`/`.mapkey` without attribution-flag blob. Ours = live data inside that chrome — not an alternate design.
