> **NIEAKTUALNE — zastąpione przez VISUAL_BRIEF.md + claude-v2.0 (v4 skóra odrzucona eye Sebastiana / SoT flip)**
>
> Indeks: `docs/handover/09_INDEKS_WIEDZY.md` · Etap C4 · 2026-09-23. Pliku nie usuwać.

# VISUAL v4 BRIEF — human premium Sept 2026 (not empty brutalist)

**Owner:** WT — Visual · **For:** Builder · **Date:** 2026-09-23 ~01:16  
**Trigger:** Sebastian eye-FAIL on v3 (“tragic”). Claude = **quality bar**, not clone.  
**Trends:** `anti-slop-2026-09-23/TRENDS_SEPT_2026.md` (calm / tactile / typo editorial)  
**Anti-slop still ON:** no card soup, no amber chips, no milk glass KPI, no Inter/indigo — but **anti-slop ≠ barren**.

---

## North star (eye)

A **human-made premium ops tool** you’d trust on a corridor wall: warm near-black, printed typography, rich cockpit, calm confidence.  
If it looks like a Midjourney “brutalist dashboard” or an empty wireframe — **FAIL**.

Squint test: exception story + where things are + how money/flow moves — in one screen — without strip fatigue.

---

## v3 → v4 corrections

| v3 problem (eye) | v4 fix |
|---|---|
| Icon-only skinny nav | **Expanded nav with labels** (default desktop ≥1100). Collapse still ok ≤1100 / toggle — but expanded is the premium read. Width ~186: glyph + label + badge. |
| Strip soup (spine+KPI+banners stacked thin) | **Fewer strips.** Keep corridor spine OR merge secondary KPIs into one calm meta row. Max **two** full-width horizontal bands above main stage (spine + optional meta). CRITICAL banner can replace a strip, not stack endlessly. |
| Cockpit = list + waterfall only | **Rich triad:** (1) exception queue, (2) **chart** (OTIF / margin / throughput — editorial, not candy), (3) **map** (real tiles) in the same cockpit breath — e.g. 12-col: exceptions 5 · chart 3 · map 4, or exceptions 5 · (chart over map) 7. |
| Empty brutalist void | Warm near-black surfaces with **content density**; panels filled with real ops affordances; shared edges, not acres of blank `#080F15`. |
| Map black canvas | Real MapLibre/demotiles corridor + `.wt-mapkey` BL (tiles fix in flight — must show geography). |

---

## Layout recipe (cockpit desktop)

```
┌ topbar 52 (brand · org ink-seg · lang ink-seg · bell · clock)
├ corridor spine 56–60 (Condensed counts — ONE strip)
├ [optional] CRITICAL band (only if unresolved CRITICAL — replaces need for extra strip)
├ body: nav 186 (labels!) | main
│         main = rich stage:
│         ┌ exceptions (priority) ─┬ chart (editorial) ─┐
│         │ gut + next-action      │ OTIF/margin spark   │
│         │                        ├ map (real tiles) ───┤
│         └────────────────────────┴────────────────────┘
```

Mobile/narrow: stack exceptions → chart → map; nav collapses to 56.

---

## Nav (expanded = default premium)

- Width **186** expanded: icon 16–18 + label 14 + optional count pill  
- Current: **3px amber left rail** + surface-3 — full bleed, not chip  
- Collapsed 56: icons + tooltip; auto ≤1100 or user pin  
- Labels in PL (and EN/SV via i18n): Kokpit, Mapa, Harmonogram, Ryzyka, Dokumenty, Finanse, …

---

## Less strip soup

**Allowed above main:**
1. Corridor spine (stages) — keep  
2. At most one meta row OR critical band — not both plus KPI card row plus chip row  

**Move into panels:** OTIF / margin / docs — into chart panel header or flush mini-stats *inside* the chart card edge (shared border), not a third full-width strip.

---

## Human premium (Sept 2026) — keep anti-slop teeth

- Warm near-black / cool paper (not pure void black)  
- Radius language 0–2 data · ≤4 overlay only  
- Ink-invert seg for role/lang  
- Condensed display KPI numbers; Mono IDs  
- Exception gut 3px + **next-action verb** + age  
- One amber for signal only  
- Editorial chart: line/area with hairline grid, no gradient candy  
- Map: solid overlays, legend BL, corridor ink visible  

**Still FAIL:** soft card grids, amber outline chips, milk glass personality, Inter/indigo/mesh, empty hero, icon-rail-only desktop, strip stacking ≥3.

---

## Claude bar (not clone)

Match/exceed: density, contrast, instrument calm, readable hierarchy.  
Do **not**: Barlow, Claude DOM, copy HTML chrome 1:1.  
IBM Plex identity stays.

---

## Acceptance (eye gate v4)

- [ ] Squint: human premium ops — not tragic empty brutalist  
- [ ] Nav shows **labels** at desktop default  
- [ ] Cockpit shows **exceptions + chart + map** together  
- [ ] ≤2 full-width strips above main (spine + critical/meta)  
- [ ] Map shows real geography (not black void)  
- [ ] Anti-slop checklist still PASS (no card soup / amber chips / milk glass)  
- [ ] KSH light still AA; HHL/SCX dark warm near-black  
- [ ] Side-by-side vs Claude: density ≥ bar, identity clearly WT/Plex  

Shots required: `visual-v4-cockpit.png`, `visual-v4-map.png`, `visual-v4-ksh-light.png`

---

*WT — Visual. Builder owns SPA. Re-gate when shots land.*
