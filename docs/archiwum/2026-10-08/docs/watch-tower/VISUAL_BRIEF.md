# WATCH TOWER — Visual brief (Claude 1:1 SoT)

> **HARD 2026-09-23 (Sebastian, Watch Tower room):** Return **exactly** to Claude look and style.  
> **Barlow + Barlow Condensed are required** — not a smell. Claude makieta = visual/layout SoT.  
> Prior anti-slop “Claude = quality bar / ban Barlow / force IBM Plex” is **overridden**.
>
> **HARD ~01:41:** Claude = **1:1 visual + text + layout + style**. Ours = data/functions/integrations only. **Any deviation = FAIL.**
>
> **FROM ZERO ~01:46:** Rebuild shell from **Claude CSS/DOM only** (`tower-makieta.html`). No alternate design. Gate = squint-match makieta. Prior SPA shell PASSes superseded until rebuild.

| Layer | Source of truth |
|---|---|
| **Visual / shell / nav / panels / tokens / type** | This file + [`claude-makieta.html`](./claude-makieta.html) + [`claude-visual-ref/`](./claude-visual-ref/) (`extracted.css`, `tower-makieta.html`) |
| **Modules M1–M12 · workflows · elite · seed · acceptance functional · roles · pricing · permits · ETA** | [`UX_MAP.md`](./UX_MAP.md) |

**Open before painting:** `claude-makieta.html` (or `claude-visual-ref/tower-makieta.html`) side-by-side with the app. Pixel/layout match Claude — not a Plex redesign.

App may keep `--wt-*` aliases **mapped 1:1** to Claude token hex values below. Visual must still read as Claude, not a different system.

**Roles:** HHL / KSH / SCX only · Stegra = SITE POI (place-only)  
**Theme first-paint:** HHL + SCX → `data-theme="dark"` · KSH → `data-theme="light"` (same Claude palette, not a second design language)

---

## 0. FAIL gate (ship blocker) — must match Claude

If a screenshot fails **any** row → **do not ship**.

| FAIL if you see… | Required (Claude) |
|---|---|
| IBM Plex / Inter / Roboto / Poppins as primary UI | **Barlow** + **Barlow Condensed** (weights as makieta) |
| Soft SaaS card grid KPIs (`gap` + drop shadow + big radius) | Flush `.kpis` / `.kpi` 3-col rule grid (no card gap) |
| Nav chrome unlike Claude (wrong rail, no amber current, missing glyphs/counts/sep) | Left `nav` 186px · amber 3px current · glyph + label + count · `.sep` |
| Corridor missing / wrong stage chrome | `.corridor` + `.stage` Condensed counts + 3px fill bars |
| Milk/frosted glass KPI / spine / table | **Solid** `--surface` / `--surface-2` (Claude is solid-first) |
| Soft chip role/lang (amber outlines, pill chrome) | Ink-invert `.seg` (`aria-pressed` → ink fill / surface text) |
| Wrong radius language (12–16px panels) | **2px** controls; panels square/hard 1px `--rule` |
| Empty hero / decorative mesh / indigo SaaS | Ops content in Claude panels |
| Exception row without next-action verb | gut + title + **verb meta** + age (Claude `.exq`) |
| Fake “AI 94%” confidence | Confidence + **source** label (functional rule in UX_MAP) |

**Barlow is not FAIL.** Missing Barlow / forcing Plex **is** FAIL.

---

## 1. Typography (required)

```html
<link href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700&family=Barlow+Condensed:wght@500;600;700&display=swap" rel="stylesheet">
```

| Use | Face | Spec (from makieta) |
|---|---|---|
| Body UI | Barlow | 14px / lh 1.45 / `font-variant-numeric: tabular-nums` · weights 400–700 |
| Brand wordmark | Barlow Condensed | 23px / 700 / `letter-spacing: .06em` |
| Panel titles `.panel-hd h2` | Barlow Condensed | 17px / 600 / `.02em` |
| KPI values `.kpi .v` | Barlow Condensed | **29px** / 700 / lh 1.05 |
| Spine counts `.stage .n` | Barlow Condensed | **26px** / 700 (zero → ink-3 / 500) |
| Drawer title `.drawer-hd h3` | Barlow Condensed | 25px / 700 / `.03em` |
| Table headers | Barlow Condensed | 13px / 600 |
| Clock / codes / pills / mono feel | Barlow Condensed | as makieta (`.clock`, `.code`, `.pill`, `.mono`) |
| Section `h4.sec` | Barlow Condensed | 15px / 600 |

Utility: `.cond { font-family: "Barlow Condensed","Barlow",Arial,sans-serif; letter-spacing: .015em }`

**Do not** load IBM Plex as the product primary. Optional Mono only if a functional ID needs it — default codes stay Condensed like Claude.

---

## 2. Color tokens (copy Claude `:root` exactly)

Light default (`:root` / `data-theme="light"`):

```css
:root {
  --page: #E3E9ED;
  --surface: #FFFFFF;
  --surface-2: #F4F7F9;
  --surface-3: #EAEFF3;
  --ink: #0E1A24;
  --ink-2: #3C4E5C;
  --ink-3: #6C7D8A;
  --rule: #C9D5DD;
  --rule-2: #DEE6EB;
  --amber: #C97E12; --amber-bg: #FBEFD9;
  --red: #B32639;   --red-bg: #F8DEE2;
  --go: #1B6E5D;    --go-bg: #DCEDE8;
  --sea: #245C87;   --sea-bg: #DCE8F1;
  --plan: #6C7D8A;  --plan-bg: #E6ECF0;
  --focus: #1D6FB8;
}
```

Dark (`:root[data-theme="dark"]` and prefers-dark when not forced light):

```css
:root[data-theme="dark"] {
  --page: #080F15;
  --surface: #101C25;
  --surface-2: #16242F;
  --surface-3: #1D2E3A;
  --ink: #DCE7EE;
  --ink-2: #A4B6C2;
  --ink-3: #748896;
  --rule: #263A48;
  --rule-2: #1C2B36;
  --amber: #E5A544; --amber-bg: #3A2C12;
  --red: #E8687C;   --red-bg: #3B1720;
  --go: #4FB79E;    --go-bg: #0F2B27;
  --sea: #6BA8D6;   --sea-bg: #12283A;
  --plan: #7E93A1;  --plan-bg: #1A272F;
  --focus: #5AA6E8;
}
```

### Optional `--wt-*` 1:1 aliases

Builders may alias for existing component APIs — **values must equal Claude hex**:

| Claude | Suggested alias |
|---|---|
| `--page` | `--wt-page` |
| `--surface` / `-2` / `-3` | `--wt-surface` / `-2` / `-3` |
| `--ink` / `-2` / `-3` | `--wt-ink` / `-2` / `-3` |
| `--rule` / `--rule-2` | `--wt-border` / `--wt-border-2` |
| `--amber` `--red` `--go` `--sea` `--plan` `--focus` | `--wt-amber` … same |

Do **not** invent a colder/warmer alternate palette under `--wt-*`.

### Amber usage (Claude)

Amber = **signal + select rail**: nav `aria-current` left border, drawer tab underline, MED severity gut, banner accent. Not decorative outline chips on every control. Role/lang use **ink-invert `.seg`**, not amber chips.

---

## 3. Surfaces — solid-first (Claude)

Claude makieta uses **opaque** `--surface` / `--surface-2` / `--surface-3`.  
**Do not invent glass KPI cards.** KPI, spine, nav, tables, panels = solid.

Optional near-opaque chrome over a busy MapLibre map only (product add-on) — never as the default personality of the shell. Prefer solid map layer chips like Claude `.maplayers` / `.mapkey` (solid `--surface` + 1px `--rule`).

---

## 4. Shell wireframe (match Claude class names)

```
.app (grid rows: auto auto 1fr)
├── .topbar          height 52px · surface · border-bottom rule
├── .corridor        spine stages · surface · border-bottom rule
└── .body            grid 186px 1fr  (≤1100px → 56px 1fr)
    ├── nav          surface · border-right rule
    └── main         scroll
(+ .scrim + .drawer overlay, not in grid)
```

### 4.1 `.topbar` (52px)

- padding `0 14px` · gap `18px` · flex align center  
- `.brand` → `<b>TOWER</b>` Condensed 23/700 + `#brandSub` ink-3 13px (project · org)  
- `.spacer` flex 1  
- `.roleswitch` + label “Widok” + `.seg#roleSeg` → **HHL / KSH / SCX** only  
- `.seg#langSeg` → PL / EN / SV  
- `.iconbtn` 30×30 · radius 2 · surface-2 · theme toggle (product: + **bell** as same chrome)  
- `.clock` Condensed 14 · Europe/Warsaw  

### 4.2 `.seg` (role / lang)

```
border 1px rule · radius 2 · overflow hidden · bg surface-2
button: pad 5×11 · 12.5px / 500 · ink-2 · border-right rule
[aria-pressed=true]: bg ink · color surface · weight 600
```

### 4.3 `.corridor` / `.stage`

Stages (Claude keys): `PRE · ZAL · PL · GDA · SEA · NYN · SE · SITE · DONE`  
PL labels: Przygotowanie · Załadunek · Droga PL · Gdańsk · Prom · Nynäshamn · Droga SE · Boden · Dostarczone  

Recipe:

- `.corridor` pad `9px 14px 11px` · overflow-x auto  
- `.corridor-inner` flex · min-width 940px  
- `.stage` flex 1 · border-left rule-2 · `.n` Condensed 26 · `.l` 11.5 ink-3 · `.bar` 3px track + `<i>` fill  
- pressed → `surface-3`; bar hues: `.sea` / `.site` (go) / `.pre` (plan)  
- **Actionable:** click filters list+map (UX_MAP §4.2); zero count → `.n.zero`

Product spine ids in UX_MAP (`spine.plan` …) map onto these Claude stages — same chrome, same click behavior.

### 4.4 `nav` (left)

Default desktop: **186px**. Claude responsive ≤1100px: **56px** (hide `.lbl` + `.count`).  
Product SoT also allows **explicit toggle** + `sessionStorage.wtNavCollapsed` (UX_MAP §1.1) — same widths, additive to Claude chrome.

```
nav button: flex · gap 9 · pad 8×14 · ink-2 · border-left 3px transparent
hover → surface-2
[aria-current=page] → surface-3 · ink · 600 · border-left-color amber
.glyph 17px · .count badge rule-2 · .count.hot = red-bg/red · .sep rule-2
```

**Nav keys / labels (Claude + product):**

| Block | key | PL label | Glyph (makieta) | Who |
|---|---|---|---|---|
| Common | `dash` | Kokpit | ▣ | all |
| | `map` | Mapa | ◎ | all |
| | `sched` | Harmonogram | ▤ | all (+ count loads) |
| | `risk` | Ryzyka | ▲ | all (+ hot count) |
| | `docs` | Dokumenty | ▢ | all |
| Money | `fin` | Finanse / Rozliczenia / Moje stawki | ₽ | HHL · KSH · SCX |
| | `inv` | Faktury | ▦ | HHL · SCX |
| Admin HHL | `wf` | Automatyzacje | ⚙ | HHL |
| | `geo` | Strefy | ⬡ | HHL |
| SCX | `tasks` | Moje zadania | ✎ | SCX |

Insert `.sep` between common / money / admin|tasks blocks (Claude `navHTML`).

### 4.5 `.panel` / `.panel-hd` / `.panel-bd`

- `.panel` = surface · border 1px rule · margin 12px  
- `.panel-hd` = flex · pad 9×13 · border-bottom rule-2 · **bg surface-2** · `h2` Condensed 17  
- `.panel-bd` pad 13 · `.panel-bd.flush` pad 0  
- `.grid2` = `1.35fr 1fr` gap 0 (stack ≤1100px)

### 4.6 KPI — `.kpis` / `.kpi` (flush rules, not cards)

```
.kpis { grid 3 cols · border-top rule-2 }
.kpi  { pad 11×13 · border-right + border-bottom rule-2 }
.kpi .k 11.5 ink-3 · .v Condensed 29/700 · .d 11.5 ink-3
.v.alert=red · .v.warn=amber · .v.good=go
```

No gap, no shadow, no soft floating cards. ≤6 KPI per role (UX_MAP M8) — still in this Claude grid.

### 4.7 Exception queue `.exq`

`li` flex · gut 3px (plan/amber/red by sev) · `.t` title · `.m` meta (**next action verb**) · `.age` Condensed. Hover surface-2. Click → drawer.

### 4.8 Tables

Sticky thead surface-2 Condensed · td pad 6×9 · hover surface-2 · `.hl` amber-bg · `.pill` radius 2 Condensed · status pills `.p-plan|go|sea|amber|red`.

### 4.9 Filters / chips

`.filters` strip surface-2 · inputs radius 2 · `.chipbtn` / pressed = ink fill (same language as `.seg`).

### 4.10 Map chrome (Claude layout)

`.mapsplit` ~1.25fr / 1fr · `.mapbox` · solid `.maplayers` / `.mapkey`. Product map engine = **MapLibre** (UX_MAP M3) inside this Claude split chrome — not a different visual language.

### 4.11 Drawer

`.scrim` rgba(6,14,20,.45) · `.drawer` width min(560px,100%) solid surface · `.drawer-hd` Condensed h3 · `.dtabs` surface-2 · selected tab **amber bottom border 2px** · `.dbody` scroll · `.kv` · timeline `.tl` · money `.mrow` · `.locked` dashed for hidden prices · `.btn` ink fill radius 2.

Product tabs (Przegląd · Przebieg · … · ETA) sit in Claude `.dtabs` chrome; pricing hide / factoring / confidence = UX_MAP functional rules.

### 4.12 Misc Claude atoms

`.banner` / `.banner.red` · `.note` · `.wf` + `.sw` toggle · `.btn` / `.btn.ghost` · `:focus-visible` 2px `--focus` · `prefers-reduced-motion` kill transitions.

---

## 5. Theme first-paint (product rule × Claude mechanism)

| Role | First paint |
|---|---|
| HHL | `data-theme="dark"` |
| SCX | `data-theme="dark"` |
| KSH | `data-theme="light"` |

Manual theme toggle (`.iconbtn`) overrides for session; role switch resets to role default unless product stores preference. Implement with Claude `data-theme` on `<html>` — **do not** invent a second palette.

---

## 6. Functional chrome add-ons (same Claude look)

These live in UX_MAP; visually they **reuse** Claude atoms (do not invent a parallel design system):

| Add-on | Claude carrier |
|---|---|
| Bell + Notification Center | `.iconbtn` + panel/drawer solid surface (same as `.drawer` / panel) |
| Import XLSX + DnD | `.btn` / drop-zone inside `.panel` on `sched` |
| Zero-dead-metrics | `.kpi` / `.stage` clicks → filters (UX_MAP §4.2) |
| Confidence / PermitKind / FactoringStatus | `.pill` + Condensed labels — no new hues |
| Collapsible nav toggle | Same 186↔56 as Claude ≤1100px + explicit toggle + session persist |

---

## 7. View → module map (visual = Claude views)

| Claude `view` | Primary UI chrome | UX_MAP module |
|---|---|---|
| `dash` | panel + kpis + exq + grid2 map teaser | M8 (+ exception / map peek) |
| `map` | mapsplit + layers | M3 |
| `sched` | filters + table + import | M1 · M2 |
| `risk` | risk panels / ferry | M10 |
| `docs` | docs table + banners | M6 |
| `fin` | money / rates / locked | M7 |
| `inv` | invoice week match | M11 (+ E3 factoring HHL) |
| `wf` | workflow list + sw | M9 |
| `geo` | zones table / editor | M4 |
| `tasks` | SCX task table | SCX tasks (M8/M6 support) |
| drawer ETA tab | confidence band | M12 · E4 |
| `/driver/:token` | outside shell | M5 |

Copy/layout descriptions: prefer Claude makieta + relevant passages in `ROZMOWA_CLAUDE.txt`. Functional acceptance remains UX_MAP §8.

---

## 8. Builder checklist (short)

1. Load Barlow + Barlow Condensed (weights as §1).  
2. Paste Claude light+dark tokens (§2); alias `--wt-*` 1:1 if needed.  
3. Shell: topbar 52 · corridor stages · body 186/56 · panel/kpi/nav/drawer recipes (§4).  
4. Solid surfaces; no glass KPI.  
5. Role first-paint dark/dark/light via `data-theme`.  
6. Side-by-side vs `claude-makieta.html` — squint match.  
7. Functional modules/workflows/roles/seed → UX_MAP only.

**Refs:** [`claude-makieta.html`](./claude-makieta.html) · [`claude-visual-ref/extracted.css`](./claude-visual-ref/extracted.css) · [`claude-visual-ref/tower-makieta.html`](./claude-visual-ref/tower-makieta.html) · [`VISUAL_ALIGN_CLAUDE.md`](./VISUAL_ALIGN_CLAUDE.md) · [`UX_MAP.md`](./UX_MAP.md)
