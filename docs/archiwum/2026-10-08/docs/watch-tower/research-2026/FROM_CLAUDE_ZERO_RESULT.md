# FROM CLAUDE ZERO — shell reset (2026-09-23 ~01:54 CEST)

**Sebastian mandate:** Start from Claude makieta only. Expand with data/functions/integrations. No alternate design.

**App:** `/workspace/watch-tower-app`  
**SoT visual:** `claude-visual-ref/tower-makieta.html` ≡ `public/claude-ref.html`  
**Preview:** `http://0.0.0.0:4177/` · `npm run build` **PASS**  
**Gate shots:** `watch-tower-app/shots-start/from-zero-claude-{hhl-dark,ksh-light,map,nav}.png` (+ makieta twin)

---

## What was RESET (visual / chrome)

| Item | Before (mutated SPA) | After (Claude 1:1) |
|---|---|---|
| CSS source of truth | Hand-tuned `wt-*` / anti-slop / v3 / v4 layers | **Exact Claude `<style>`** from makieta into `src/index.css` |
| Token names | `--wt-bg`, `--wt-ink`, … as primary | Claude `--page` `--surface` `--ink` `--rule` `--amber` `--red` `--go` `--sea` `--plan` `--focus` (+ light/dark) |
| `--wt-*` | Primary design system | **Aliases only** → Claude tokens (views keep working) |
| Shell DOM | `.wt-topbar` `.wt-corridor` `.wt-nav` flex hacks | Claude `.app` → `.topbar` → `.corridor` → `.body` → `nav` + `main` |
| Type | Mixed / prior Plex history | **Barlow + Barlow Condensed** (makieta sizes: brand 23, spine 26, KPI 29) |
| Brand | `WATCH TOWER` | **`TOWER`** (Claude brand slot) |
| Role seg labels | Short HHL/KSH/SCX | Claude voice: **H&H Logistics / KSH / Scandinavian Express** |
| Panels / KPI / exq / map / drawer | `wt-panel` `wt-kpi` glass leftovers | Claude `.panel` `.kpis` `.kpi` `.exq` `.mapsplit` `.mapbox` `.maplayers` `.scrim` `.drawer` `.dtabs` |
| Theme | `data-theme` kept | Same mechanism; HHL/SCX dark · KSH light first paint |

**Explicitly discarded as SoT:** anti-slop / visual-v3 / visual-v4 / “inspired not cloned” SPA chrome. Prior shell PASS artifacts superseded for Visual gate.

---

## What was KEPT (product utility)

| Keep | Notes |
|---|---|
| **≥62 loads** from KSH seed | `src/data/loads.json` + schedule import |
| **M1–M12 modules** | dash, map, sched, risk, docs, fin, inv, tasks, wf, geo + drawer tabs |
| **Map** | Leaflet public tiles (Esri/Carto path) inside Claude `.mapbox` |
| **AIS proxy** | `scripts/ais-proxy.mjs` / `npm run ais-proxy` |
| **SEFS / permits** | PERIOD/TRIP/cover, factoring, READY gate |
| **Schedule XLSX import** | ExcelJS dry-run → commit |
| **Workflows** | 12 automations HHL-gated |
| **Polish UI / I18N** | Claude PL voice (Widok, Kokpit, stage labels, locked price copy) + EN/SV switcher |
| **Store / selectors / permissions** | Zustand store, role RLS UX (hide prices, not blur) |
| **Bell + notifications** | Product additive on Claude `.iconbtn` |
| **Collapsible nav** | Additive `nav-collapsed` (56px) on Claude 186px nav |
| **Driver PWA route** | `#/driver/:token` |

Spine stays **8 product stages** (PLAN…DELIVERED) mapped to Claude chrome — Claude makieta has 9 (Gdańsk separate). Intentional product map, not a second visual system.

---

## Method

1. Extract Claude CSS 1:1 from `tower-makieta.html` → `src/index.css`
2. Rebuild shell components to Claude DOM/classes (`Topbar`, `CorridorSpine`, `Nav`, `App`)
3. Point KPI / exception / status / map / drawer chrome at Claude classes
4. Keep `--wt-*` as aliases so view logic did not need a full rewrite
5. `npm run build` · preview `0.0.0.0:4177` · side-by-side shots vs makieta

---

## Gate metrics (squint)

From `shots-start/from-zero-claude-metrics.json` — all **true**:

- Barlow Condensed brand **23px** · topbar **52** · nav **186**
- Dark `--page` / `--surface` / `--ink` match makieta
- KSH light `--page` `#E3E9ED`
- Spine **26** · KPI **29**
- Shell regions `.app` + `.corridor` present
- Map Leaflet tiles loaded

**Brand text:** `TOWER` (app ≡ makieta)

---

## Shots

| File | Content |
|---|---|
| `from-zero-claude-hhl-dark.png` | App HHL dark · Kokpit |
| `from-zero-claude-ksh-light.png` | App KSH light · Kokpit |
| `from-zero-claude-map.png` | App map + tiles |
| `from-zero-claude-nav.png` | App nav expanded |
| `from-zero-claude-makieta-dark.png` | Claude SoT twin |
| `from-claude-zero-{makieta,app-cockpit,app-map}.png` | Mandate aliases |

---

## Visual — please re-gate

Prior SPA shell PASSes are **superseded**. Gate = squint vs `tower-makieta.html` per `research-2026/CLAUDE_SHELL_GATE.md` FROM ZERO section.

Ready for Visual review.
