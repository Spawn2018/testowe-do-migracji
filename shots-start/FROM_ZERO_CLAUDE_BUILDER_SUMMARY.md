# FROM ZERO — Claude makieta shell rebuild

**When:** 2026-09-23 ~01:55 Europe/Warsaw  
**Preview:** `http://127.0.0.1:4173/` · **`npm run build` PASS**  
**SoT:** `FROM_ZERO_CLAUDE_HANDOFF.md` · `CLAUDE_SHELL_GATE.md` (FROM ZERO) · `claude-makieta.html` ≡ `claude-visual-ref/tower-makieta.html`

## What changed
- **Chrome CSS = makieta `<style>` 1:1** (Barlow + Barlow Condensed, Claude light/dark tokens, shell/panels/KPIs/exq/drawer/map chrome).
- **DOM regions/classes = makieta:** `.app` · `.topbar` · `.brand` · `.seg` · `.roleswitch` · `.corridor` · `.stage` · `.body` · `nav` · `.panel` / `.panel-hd` / `.panel-bd` · `.kpis` / `.kpi` · `.exq` · `.scrim` / `.drawer` · `.mapsplit` / `.maplayers` / `.mapkey`.
- **Removed `wt-*` dual-skin classes** (metrics `wtClassLeft: []`). Kept `--wt-*` **token aliases only** for domain inline colors.
- Product wiring (M1–M12, MapLibre, HHL/KSH/SCX data) stays **inside** that shell.

## Live DOM check (HHL dark)
- Brand: **TOWER** (makieta 1:1)
- Roles: `H&H Logistics` · `KSH` · `Scandinavian Express`
- Nav: Kokpit · Mapa · Harmonogram · Ryzyka · Dokumenty · Finanse · Faktury · Automatyzacje · Strefy
- Shell flags: app/topbar/corridor/body/panel/kpis = **true**

## Squint metrics

| | App HHL dark | App KSH light | Makieta |
|---|---|---|---|
| Font | Barlow 14 | Barlow 14 | Barlow 14 |
| Brand | Condensed **23** | 23 | 23 |
| Topbar H | **52** | 52 | 52 |
| Nav W | **186** | 186 | 186 |
| Corridor pad | **9 14 11** | same | 9 14 11 |
| `--page` | `#080f15` | `#e3e9ed` | Claude |
| `--surface` | `#101c25` | `#fff` | Claude |
| `--ink` | `#dce7ee` | `#0e1a24` | Claude |
| First paint | dark | light | HHL/SCX dark · KSH light |
| `wt-*` chrome | **0** | **0** | — |

## Shots for Visual
- `shots-start/from-zero-claude-hhl-dark.png`
- `shots-start/from-zero-claude-ksh-light.png`
- `shots-start/from-zero-claude-map.png`
- `shots-start/from-zero-claude-nav.png`
- Ref: `shots-start/from-zero-makieta-dark.png`
- `shots-start/from-zero-claude-metrics.json`

## Visual squint note
Side-by-side vs `tower-makieta.html`: same type, tokens, shell geometry, amber nav rail, corridor spine, flush KPI rule-grid, solid panels/drawer/map chrome. Ours = live data + MapLibre + M1–M12 inside that chrome — not an alternate skin.
