# Visual align — Claude is the **clone target**

**Date:** 2026-09-23 (Europe/Warsaw) · Sebastian HARD decision in Watch Tower room

**Policy flip:** Claude makieta is **not** a “quality bar only.” It is the **1:1 visual/layout SoT**. Match look, shell, nav, spine, panels, KPI grid, drawers, tables, tokens, and **Barlow / Barlow Condensed**. Prior “do not Barlow-swap / IBM Plex identity / inspired not cloned” guidance is **void**.

| SoT | Owns |
|---|---|
| [`claude-makieta.html`](./claude-makieta.html) + [`claude-visual-ref/`](./claude-visual-ref/) | Visual + shell + nav keys/labels + view layouts + component chrome |
| [`VISUAL_BRIEF.md`](./VISUAL_BRIEF.md) | Builder recipes + Claude tokens + FAIL gates |
| [`UX_MAP.md`](./UX_MAP.md) | Modules M1–M12 · workflows · elite journeys · seed · functional acceptance · roles · pricing · permits · ETA confidence |

---

## Copy 1:1 from Claude

| Item | Notes |
|---|---|
| Typography | Barlow 400–700 · Barlow Condensed 500–700 (brand 23, spine 26, KPI 29, drawer 25, panel hd 17) |
| Color tokens | `--page` `--surface` `-2/-3` `--ink` `-2/-3` `--rule` `-2` `--amber` `--red` `--go` `--sea` `--plan` `--focus` + `*-bg` light **and** dark |
| Theme mechanism | `data-theme="light|dark"` (first-paint: HHL/SCX dark, KSH light — product rule) |
| Shell | `.app` · `.topbar` 52px · `.corridor` / `.stage` · `.body` 186→56 · `nav` · `main` |
| Nav | Glyphs + labels + counts + `.sep` · amber 3px `aria-current` · role-gated money/admin/tasks |
| Nav keys | `dash` `map` `sched` `risk` `docs` · `fin` `inv` · `wf` `geo` (HHL) · `tasks` (SCX) |
| Panels / KPI | `.panel` / `.panel-hd` / `.panel-bd` · `.kpis` 3-col flush rules · Condensed values |
| Controls | `.seg` ink-invert · `.iconbtn` 30px radius 2 · `.chipbtn` · `.btn` · `.pill` |
| Tables / filters / exception | Claude thead sticky · `.filters` · `.exq` gut+age |
| Drawer | `.scrim` · `.drawer` · `.dtabs` amber underline · `.kv` · `.tl` · `.mrow` · `.locked` |
| Map chrome | `.mapsplit` · solid `.maplayers` / `.mapkey` (MapLibre fills the box) |
| Radius / rules | 2px controls · 1px `--rule` panels · no soft SaaS card stack |
| Surfaces | **Solid-first** — do not invent glass KPI cards |

App may use `--wt-*` **aliases mapped 1:1** to Claude hex — visual still must match Claude.

---

## Keep from product SoT (UX_MAP / functional) — not a different look

| Keep | Why |
|---|---|
| Modules **M1–M12** | Scope of screens/interactions |
| Workflows §6 + elite §6.5 (E1–E4) | Exception→audit · permits · factoring · ETA confidence |
| Roles **HHL · KSH · SCX** only · **Stegra = place/POI only** | Product identity |
| Addresses / geofence named POI | ADDRESSES.md |
| Pricing hide by role (no blur/`••••`) | RLS UX |
| Factoring HHL-only post-MATCHED | E3 |
| ETA confidence band + reason chips (heurystyka, not “AI 94%”) | E4 / M12 |
| Import XLSX button **+** DnD same flow | M1 |
| Bell + Notification Center + mark-as-read | §1.2 |
| Zero-dead-metrics / actionable KPI+spine map | §3.1 · §4.2 |
| Collapsible nav toggle + `sessionStorage.wtNavCollapsed` | Additive to Claude ≤1100px collapse |
| MapLibre live corridor | Engine inside Claude map chrome |
| Seed §7 · functional acceptance §8 | QA gates |
| Brand product name **WATCH TOWER** in copy if needed | Claude mock says “TOWER” — product may show WATCH TOWER in Condensed brand slot without changing type system |

---

## Explicitly NOT required anymore

- IBM Plex Sans / Condensed / Mono as primary  
- “Claude = density bar only” / anti-clone wording  
- Ban on Barlow  
- Alternate cold-steel palette that diverges from Claude hex  
- Soft glass personality on KPI / spine / tables  

---

## Verify

1. Open `claude-makieta.html` beside app — squint: same type, tokens, shell, nav, spine, panels, KPI grid.  
2. Barlow loaded; no Plex-as-primary.  
3. HHL/SCX dark · KSH light first paint via `data-theme`.  
4. Functional gates still from UX_MAP §8 (import, bell, pricing hide, elite E1–E4, Stegra place-only).  
5. Visual acceptance: **matches Claude makieta look** (VISUAL_BRIEF §0 + UX_MAP §8 visual row).
