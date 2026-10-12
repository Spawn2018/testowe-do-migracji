> **NIEAKTUALNE — zastąpione przez research-2026/visual-gate-from-zero/FINAL_SQUINT_GATE_RESULT.md**
>
> Indeks: `docs/handover/09_INDEKS_WIEDZY.md` · Etap C4 · 2026-09-23. Pliku nie usuwać.

# Visual gate — visual-v2 (2026-09-23 ~01:05 Europe/Warsaw)

**Owner:** WT — Visual  
**Build shots:** `watch-tower-app/shots-start/visual-v2-*.png`  
**SoT:** `VISUAL_BRIEF.md` §12 · `START_UI_SPEC.md` P0 VISUAL · `CLAUDE_CRAFT_HANDOFF.md`  
**Framing:** Claude = craft bar, **inspired not cloned** (IBM Plex · solid-first)

## Verdict: **CONDITIONAL PASS** (identity + solid-first landed; craft gaps remain)

v2 is clearly closer: Plex, solid panels, collapsed 56px rail, denser spine. Not yet ≥ Claude on instrument chrome (seg, map legend, flush KPI discipline).

| Check | Result | Notes |
|---|---|---|
| IBM Plex (not Barlow) | **PASS** | Cockpit + map shots |
| Solid panels / KPI not washed glass | **PASS** | Solid dark KPI + panels; glass only light chrome |
| Nav collapsed ~56 rail | **PASS** | Icon rail + amber current mark |
| Roles HHL/KSH/SCX only | **PASS** | No Stegra persona |
| Spine condensed large numbers | **PASS≈** | Large counts + stage bars present (verify 26px exact in CSS) |
| Seg **ink-invert** role+lang | **FAIL** | Roles still amber-outline chips; lang closer to invert |
| KPI flush rail (zero card gap) | **PARTIAL** | Secondary KPI still reads cardy vs Claude flush grid |
| Map `.wt-mapkey` legend | **FAIL** | Layers OK; no bottom-left status legend |
| Exception gut + next-action + age Condensed | **PARTIAL** | Gut + meta present; age craft not clearly Condensed 13 |
| Panel-hd surface-2 + Condensed 17 | **PARTIAL** | Headers exist; strip craft uneven |
| Exception-first severity banner | **OPEN** | Chip alerts only (exceed item optional) |
| Anti-slop (no indigo/mesh/hero) | **PASS** | Cold steel + amber |

## Shots reviewed
- `watch-tower-app/shots-start/visual-v2-cockpit.png`
- `watch-tower-app/shots-start/visual-v2-map.png`
- `watch-tower-app/shots-start/visual-v2-claude-ref.png` (ref — light Claude craft)

## Must-fix before full PASS (builder)
1. Role+lang → unified **ink-invert seg** (not amber chips) — HANDOFF #3  
2. Add **`.wt-mapkey`** bottom-left on map — HANDOFF #8  
3. KPI secondary strip → **flush rail** zero gap, value **29** — HANDOFF #2  
4. Confirm spine n **26** Condensed 700 + % bar fill — HANDOFF #1  

Optional exceed: full-width severity banner on home.

## SoT paths (locked this turn)
- `/workspace/watch-tower/VISUAL_BRIEF.md` (§6 recipes · §12 gate)
- `/workspace/watch-tower/research-2026/START_UI_SPEC.md` (P0 VISUAL)
- `/workspace/watch-tower/research-2026/CLAUDE_CRAFT_EXTRACT.md`
- `/workspace/watch-tower/research-2026/CLAUDE_CRAFT_HANDOFF.md` (top 12)

*WT — Visual. Re-gate after next rebuild with those 4 must-fix.*
