# ANTI_SLOP_RESET — v3 hard reset (2026-09-23 WA)

**Verdict target:** freight ops instrument (Sept 2026: calm / tactile flat / typo-as-UI / editorial density / warm near-black / one accent). Not AI SaaS card soup. Not brutalist toy.

## Killed (eye-level)

| Slop tell | Where it lived | Fate |
|-----------|----------------|------|
| Soft floating cards + 12–16px gaps | Dashboard padding/`gap:12` panels | Edge-to-edge `.wt-dash`; `gap:0` exception split |
| Mid-soft radius (6–12px) everywhere | panels, chips, pills, overlays | **One radius language:** `0` data chrome · `2px` controls · `4px` floating overlays only |
| Drop shadows / glass wash / blur | `.wt-glass-*`, map overlays, cards | Solid surface + 1px `--rule`; `backdrop-filter: none`; `box-shadow: none` on chrome |
| Amber candy chrome | role/lang chips, drawer tab underline, nav current, selected row wash | Ink-invert `.wt-seg`; ink left rail; ink drawer tabs; selected row = `--surface-3` |
| Notion/Linear-marketing status pills | `StatusPill` filled rounded badges | `.wt-status` hairline border, mono, radius 0, fill only for warn/crit |
| Breathing KPI card grid | spaced tiles with shadows | Flush `.wt-kpis` shared 1px rules, Condensed ~28 value, 11px uppercase label |
| Sans for codes / ages / clock | exception meta, map table, topbar clock | IBM Plex Mono for IDs, ETA, ages, clock |
| Cool pure-navy #080F15 “dashboard dark” | `:root` page | Warm near-black `#0B0D0C` / steel surfaces (OLED-friendly) |
| Empty hero whitespace | dash margins | Critical banner → KPI → alert strip → exception band dominant |

## Replaced with (craft)

- **Tokens** `src/index.css`: warm dark + KSH cool paper light; `--wt-r` / `--wt-r-ctrl` / `--wt-r-float`; semantic severity colors unchanged.
- **Shell:** Topbar 44px flat; Nav default **56px** collapsed, ink current (not amber); CorridorSpine flush track + domain fills.
- **Dashboard:** `.wt-dash` / `.wt-dash-alert` / `.wt-exception-grid` — critical band, flush KPIs, severity alert strip, tiled exception + role panel.
- **Map:** `.wt-maplayers` / `.wt-mapkey` solid float chrome; mono codes/ETA; outline status marks.
- **Drawer:** `.wt-drawer` / `.wt-drawer-tabs` ink selected underline; mono load code.
- **Fonts:** IBM Plex Sans / Condensed / Mono kept — density + hierarchy, not Barlow clone.

## Amber policy (unchanged intent)

Amber / `--wt-accent` = **severity / warn / delay only** (exception guts, warn KPI values, map “załadunek” key). Never role switch, never primary chrome.

## Eye gate (shots)

Preview `:4177` · `npm run build` PASS.

| Shot | Path |
|------|------|
| HHL dark cockpit | `watch-tower-app/shots-start/visual-v3-cockpit.png` |
| Map + overlays | `watch-tower-app/shots-start/visual-v3-map.png` |
| KSH light | `watch-tower-app/shots-start/visual-v3-ksh-light.png` |

**Eye read:** sharp tiled surfaces, shared hairlines, typo hierarchy on KPI/spine, mono on codes, exception queue dominant, light theme intact (cool paper + ink). Soft radius only on map float overlays.

## Explicit non-goals

- Not cloning Claude HTML / Barlow ref.
- Not marketing-orange ToolJet candy.
- Not Inter + indigo mesh SaaS template.
