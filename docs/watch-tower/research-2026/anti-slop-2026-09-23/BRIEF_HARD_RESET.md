# HARD VISUAL RESET — Sebastian 2026-09-23 01:08

**Verdict user:** „wygląda dramatycznie… śmierdzi ai na kilometr”
**Rule:** Claude = poprzeczka jakości, NIE kalka. Internet refs = craft principles, not screenshots to clone.

## Kill list (AI-slop tells)
- Soft floating cards with gaps/shadows
- Amber outline “chip” role switchers as primary chrome
- Washed glass / blur as personality
- Even KPI card grids with breathing room
- Generic indigo/purple/gradient/mesh
- Oversized radius (8–16px)
- Empty hero whitespace
- Status pills that look like Notion/Linear-marketing badges

## Steal principles (not look-alikes)
1. **Bloomberg / trading terminal** (vontigo trading-terminal DS): dark-only ops surface, panels share borders not gaps, sharp edges, mono tabular data, one accent, readable at 2m, no decorative spacing.
2. **Linear UI redesign**: align ruthlessly; content edge-to-edge; radius only on floating overlays; flat tiled surface.
3. **SupplyGrid / Freightline ops**: density + scannability; mono for IDs; borders not shadows; amber ONLY for warnings not chrome.
4. **FourKites tracking craft**: exception + confidence labels; timeline progressive disclosure; solid vs predicted states.
5. **ToolJet control tower pattern**: map + exception queue + weekly — dark command centre, tight spacing — avoid their marketing-orange candy if it reads toy.

## Our identity (keep)
- IBM Plex Sans / Condensed / Mono
- Cold steel surfaces + single amber for **exceptions/warnings only**
- Roles HHL dark / KSH light / SCX dark
- Management-by-exception first

## Concrete CSS targets
- `--page` near-black / cool paper (theme); surfaces step 1–2%
- All main chrome: `border-radius: 0|2px`; panels `border: 1px solid var(--rule)`; **grid gap: 0** for KPI/exception/map split
- KPI: flush rail, value Condensed ~28–32, label 11px muted; NO card shadow
- Role switch: ink-invert segment control (pressed = ink fill), not amber chips
- Tables: 28–30px rows, mono codes, severity gut 3px left
- Map overlays: solid surface, hairline border, no blur
- Exception queue: full-width severity strip optional; next-action mandatory

## Refs (URLs researched this turn)
- https://blog.tooljet.com/shipment-control-tower/
- https://linear.app/now/how-we-redesigned-the-linear-ui
- https://vontigo.ai/docs/systems/trading-terminal
- https://designmd.ai/chef/supplygrid
- https://github.com/vugarfamiloglu/supplytrack-chain (Freightline)
- https://petebartsch.com/Peter-Bartsch-Case-Study_FourKites_Tracking.pdf
- https://varyense.com/case-studies/cascade-flow

Builder: rewrite `index.css` + Topbar/Nav/CorridorSpine/Dashboard/KpiTile/ExceptionRow/Map chrome. Screenshots before/after.

## Human craft (Sebastian 01:09)
Modern 2026 app that feels designed by an operator/designer — intentional hierarchy, exception-first, imperfect-but-deliberate chrome — NOT an AI dashboard template.

## Eye-level craft (Sebastian 01:10) — PRIMARY
Judge by what a human sees on screen, not by CSS checklist:

1. **Corners:** one language — sharp (0–2px) on data/chrome; soft radius ONLY on floating overlays (menus, toasts). No random 6–12px cards.
2. **Softening:** no mushy blur/glass as personality; hard hairline borders; soft only where elevation is real (popover).
3. **Rhythm:** eye must scan exception → KPI → table without “card soup”; shared edges, flush strips.
4. **Contrast:** ink on surface must feel printed, not foggy.
5. **Arrangements:** uneven intentional hierarchy (one dominant exception band) beats symmetric AI grids.

Success = designer squint test on PNG passes; fail if “looks generated”.

---

## Eye-level SoT lock (Sebastian 01:10–01:13) — PRIMARY for Visual gate

Judge **PNG squint test**, not DOM/CSS compliance theater.

### Deliberate radius language
| Surface | Radius | Softening |
|---|---|---|
| Page, spine, KPI rail, tables, nav, exception list | **0–2px** | **None** — hairline `1px` border only |
| Floating overlays (menu, toast, map popover) | **3–4px max** | Optional light shadow `0 8px 24px` — never blur glass personality |
| Status tags in tables | **2px** hard capsule | Solid fill — not soft marketing pills |

**FAIL:** mixed 8–16px cards, soft everywhere, or “accidentally rounded” AI mush.

### Soft vs hard (what the eye feels)
- **Hard default:** shared edges, flush strips, printed contrast (ink on surface).
- **Soft rare:** only when something truly floats above the page.
- **Banned as mood:** backdrop-blur / washed glass / foggy low-contrast chrome.

### Visual rhythm (scan path)
1. **Exception band** (CRITICAL) dominates first fixation — uneven on purpose.  
2. Corridor spine counts second.  
3. Exception queue + one companion panel (waterfall / arrivals / map+list).  
**FAIL:** symmetric card soup; equal-weight tiles fighting for attention.

### Contrast
Ink must feel **printed**, not foggy. Light (KSH) = cool paper + dark ink AA. Dark (HHL/SCX) = near-black page + bright ink. Severity red/amber only on guts/banners — not chrome.

### Human-made tells (keep)
- Irregular hierarchy (one fat critical strip > tidy AI grid)
- Next-action verbs in exception meta
- Imperfect-but-intentional: sharp data chrome + tiny soft only on overlays
- Map shows **real corridor ink**, not empty black void

### Eye FAIL (instant)
- Empty map canvas (black rectangle without geography)  
- Soft glass personality on main chrome  
- Amber outline chips as primary chrome  
- Card-gap KPI grid with shadows  
- “Looks generated” on 2m squint  

Success = designer would believe an ops designer drew it for corridor PL→SE — not Midjourney SaaS.
