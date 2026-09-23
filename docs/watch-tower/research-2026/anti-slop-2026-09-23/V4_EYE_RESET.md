# V4 EYE RESET — 2026-09-23 ~01:22 Europe/Warsaw

**Verdict target:** Sebastian glance-test prefers v4 over tragic v3.  
**SoT:** `VISUAL_V4_BRIEF.md` · `VISUAL_V4_HANDOFF.md` · this note.  
**App:** `watch-tower-app` · preview `:4177` · `npm run build` PASS.

## What looked tragic in v3 (eye, not CSS theater)

| Fail | What the eye saw |
|------|------------------|
| Icon-only 56px rail | Broken/unfinished — glyphs without names vs Claude’s labeled nav + badges |
| Strip soup | Spine + CRITICAL + KPI rail + ticker = four chrome bands fighting before content |
| Spreadsheet void | Exception list + waterfall text only — no chart, no geography |
| Oppressive dark / harsh light | Cool navy void `#080F15`; light = boxed clinical paper |
| Generated-brutalist | Equal-weight strips, no decision figure, anti-slop emptiness |

Ref shots kept for autopsy: `shots-start/visual-v3-{cockpit,ksh-light,map,claude-ref}.png`.

## What v4 changed for the eye

### 1. Nav expanded by default (~186)
- Desktop default **labels + count badges** (Kokpit, Mapa, Harmonogram, Ryzyka `5`, …).
- Collapse still available (☰ / «); auto-collapse only ≤1100.
- Session key `wtNavCollapsed=1` remembers collapse; default is **expanded**.

### 2. Cockpit triad (rich, not void)
```
exceptions (priority) | chart (OTIF editorial spark + mini-stats)
                      | map (corridor tiles, embedded)
```
- KPI card-row strip **removed** from cockpit (anti strip-soup).
- Ticker / dash-alert strip **demoted** — ferry/road noise lives in map/panels, not a 4th band.
- Role footnotes (HHL margin sample · KSH 72h arrivals · SCX tasks) sit **inside** the chart panel edge.

### 3. ≤2 full-width bands above main
1. Corridor spine (shell) — keep  
2. CRITICAL decision banner — only when queue has CRITICAL  
No KPI rail + ticker stacking on top of those.

### 4. Hierarchy — one huge decision figure
CRITICAL banner: Condensed **figure** (`2`) + `WYMAGA DECYZJI · CRITICAL` + title + next-action + age.  
Secondary meta (OTIF / marża / docs / ferry) = quiet mini-stats on the chart header.

### 5. Surfaces — warm near-black / cool paper
Dark tokens shifted warm: `#0B0D0C` / `#141816` / `#1A1F1C` (not antiseptic navy).  
Light: cooler paper, filled panels, shared 1px rules.  
Radius: data chrome 0–2 · float ≤6. No milk-glass personality.

### 6. Map geography (not black canvas)
- Cockpit + Map view use corridor basemap via **`/map-proxy/carto/...`** (Vite server+preview proxy → Carto).
- Demotiles/OpenFreeMap may 403 on box egress — proxy is the reliable path.
- Embedded map hides ferry chrome clutter; full Map view keeps layers + legend.

### 7. Identity kept
IBM Plex Sans / Condensed / Mono · HHL/KSH/SCX · ink-seg roles/langs · amber = signal only · no Barlow/HTML clone.

## Shots (eye gate)

| Shot | Path |
|------|------|
| HHL dark cockpit | `watch-tower-app/shots-start/visual-v4-cockpit-dark.png` (+ alias `visual-v4-cockpit.png`) |
| KSH light cockpit | `watch-tower-app/shots-start/visual-v4-cockpit-ksh.png` (+ alias `visual-v4-ksh-light.png`) |
| Map | `watch-tower-app/shots-start/visual-v4-map.png` |

Capture: `node scripts/shot-visual-v4.mjs` against preview `:4177`.  
Measured: nav width **186**, labels visible, `.wt-cockpit` + chart + map present, KSH `data-theme=light`.

## Acceptance checklist (BRIEF)

- [x] Squint: human premium ops — triad filled, not empty brutalist  
- [x] Nav shows **labels** at desktop default  
- [x] Cockpit shows **exceptions + chart + map** together  
- [x] ≤2 full-width strips (spine + critical)  
- [x] Map shows real geography  
- [x] Anti-slop: no card-gap KPI soup / amber chips / milk glass  
- [x] KSH light readable; HHL dark warm near-black  
- [x] Build PASS · preview :4177  

## Explicit non-goals
Not cloning Claude DOM/Barlow. Not ToolJet candy. Not Inter+indigo mesh.

*WT — Builder. Visual re-gates on these PNGs.*
