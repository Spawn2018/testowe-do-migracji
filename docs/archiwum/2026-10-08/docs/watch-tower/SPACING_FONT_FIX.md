# SPACING / FONT FIX — Claude SoT align (2026-09-23 ~02:21 CEST)

**Mandate:** Sebastian still saw differences vs Claude (descriptions, font, spacing/paragraphs, **especially right-side menu/panel**). Match makieta at squint.

**App:** `/workspace/watch-tower-app`  
**SoT CSS:** `claude-visual-ref/extracted.css` (+ `tower-makieta.html`)  
**Preview:** `http://0.0.0.0:4177/` · `npm run build` **PASS**

---

## Changes

### 1. `src/index.css` — Claude rules verbatim

- Rebuilt from `extracted.css` 1:1 (shell / corridor / body / panels / kpi / exq / table / filters / map / drawer / tl / money / chat / misc).
- Kept only:
  - `@import "tailwindcss"` + `@theme` Barlow aliases (no IBM Plex)
  - SPA extras (nav-collapsed, Leaflet/MapLibre fill, toasts, bell-pop, button.kpi, exq-row buttons, data-table)
  - `--wt-*` **aliases only** → Claude `--page/--surface/--ink/--rule/--amber/--red/--go/--sea/--plan/--focus`
- Removed Tailwind-ish spacing that fought Claude padding on chrome regions (`.drawer-hd` / `.dbody` / `.panel-bd` / `.exq` / `nav button` / `.mapsplit` gap:0).

**Canonical rhythm (SoT):**

| Token | Value |
|---|---|
| body | Barlow 14px / line-height 1.45 |
| `nav button` | padding **8px 14px** |
| `.panel-bd` | padding **13px** |
| `.exq li` | padding **9px 13px 9px 10px** |
| `.drawer` | width **min(560px, 100%)** |
| `.drawer-hd h3` | Barlow Condensed **25px** / 700 / `.03em` |
| `.drawer-hd .meta` | **12.5px** ink-3 |
| `.dbody` | padding **13px 15px** |
| `.dtabs` selected | amber bottom border (not ink) |

### 2. Right side — panel / mapsplit / mlist / drawer

- **Kokpit right column** (`.grid2` → progress + mini map): already Claude DOM; ensured `.grid2{gap:0}`, `.panel-hd` / `.panel-bd` / `.sub` copy.
- **Map `.mlist`:** Claude list rhythm + severity gut (sea/red) · hover/select amber-bg like makieta.
- **`LoadDrawer`:** replaced Tailwind chrome (`width:440`, h3 20px, `px-3.5 py-3`, ink tab underline, `p-3.5` body, grid-cols kv) with Claude classes:
  - `.drawer` (CSS width) · `.drawer-hd` · `.r1` · `h3` · `.meta` · `.dtabs` · `.dbody`
  - overview → `.kv` · timeline → `.tl` · docs/money → `.mrow` / `.sec` / `.locked` · chat → `.msg` / `.chatbar`
  - close control → `.iconbtn` ✕ (makieta)

### 3. Copy — shell chrome I18N = Claude

Panel titles/subs already used Claude voice (`Wymaga decyzji`, `Postęp dostaw`, `tygodnie 37–45`, `… pojazdów w ruchu · pozycje co 5 min`).

Aligned remaining shell/tab strings with makieta `I18N`:

| Key | PL / EN / SV (Claude) |
|---|---|
| `tab_timeline` | Przebieg / **Progress** / **Förlopp** |
| `tab_chat` (SV) | **Noteringar** |
| `search` | Szukaj kodu, kierowcy, nr rej. / Search code, driver, plate / Sök kod, förare, reg.nr |
| `nav_sched` (SV) | **Tidplan** |
| `nav_geo` (SV) | **Zoner** |
| `nav_wf` (SV) | **Automatiseringar** |

### 4. No IBM Plex as primary

- `index.html` + `@theme` load **Barlow / Barlow Condensed** only.
- Gate metric `plex: false` on body `font-family`.

---

## Gate metrics (computed, app ≡ Claude)

From `shots-start/spacing-fix-metrics.json`:

| Metric | App | Claude |
|---|---|---|
| body font / size / lh | Barlow · 14px · 20.3px | same |
| brand | TOWER · 23px | same |
| panel-bd pad | 13px | 13px |
| nav button pad | 8px 14px | 8px 14px |
| exq pad | 9px 13px 9px 10px | same |
| drawer width | **560** | **560** |
| drawer h3 | **25px** Condensed | **25px** Condensed |
| drawer meta | 12.5px | 12.5px |
| dbody pad | 13px 15px | 13px 15px |
| IBM Plex | false | false |
| panel H2 | H&H Logistics · Wymaga decyzji · Postęp dostaw · Mapa | same |

---

## Shots

| File | Content |
|---|---|
| `shots-start/spacing-fix-app.png` | App HHL dark · Kokpit |
| `shots-start/spacing-fix-claude.png` | Makieta HHL dark · Kokpit |
| `shots-start/spacing-fix-right-app.png` | App right column (progress + map) |
| `shots-start/spacing-fix-right-claude.png` | Makieta right column |
| `shots-start/spacing-fix-right-app-drawer.png` | App load drawer (additive) |
| `shots-start/spacing-fix-right-claude-drawer.png` | Makieta drawer (additive) |
| `shots-start/spacing-fix-metrics.json` | Computed gate |

Script: `scripts/shot-spacing-fix.mjs`

---

## Success criteria

Right column / drawer + type rhythm **indistinguishable from makieta at squint**: Condensed 25 drawer title, 12.5 meta, 560 drawer, panel-bd 13 / exq 9×13 / nav 8×14, Barlow 14/1.45, amber tab underline, Claude panel subs.
