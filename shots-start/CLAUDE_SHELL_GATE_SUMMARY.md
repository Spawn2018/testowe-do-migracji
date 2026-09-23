# Claude shell gate — Pass 2 (Builder → WT Visual)

**When:** 2026-09-23 ~01:36 Europe/Warsaw  
**App:** `http://127.0.0.1:4173/` · `npm run build` **PASS**  
**SoT:** `VISUAL_BRIEF.md` §0–§2 · `VISUAL_ALIGN_CLAUDE.md` · `START_UI_SPEC.md` · `CLAUDE_SHELL_GATE.md` · `claude-makieta.html`

## Checklist (`CLAUDE_SHELL_GATE.md`)

| # | Check | Pass |
|---|---|---|
| 1 | Barlow + Barlow Condensed; no Plex-as-primary | ✅ |
| 2 | Tokens = Claude hex (light + dark) | ✅ `#080F15` / `#E3E9ED` page |
| 3 | Topbar 52 · brand Condensed 23 · ink `.seg` | ✅ |
| 4 | Nav 186 · amber 3px current · collapse 56 · seps | ✅ glyphs 1:1 + block seps |
| 5 | Spine Condensed **26** + 3px bars | ✅ |
| 6 | KPI flush 3-col · Condensed **29** · solid | ✅ restored on dash |
| 7 | Panels / tables / drawer Claude chrome (2px / 1px) | ✅ |
| 8 | Exception gut + title + next-action + age | ✅ |
| 9 | Map solid layers/legend (MapLibre/Leaflet inside) | ✅ |
| 10 | HHL/SCX dark · KSH light first paint | ✅ |
| 11 | Roles HHL/KSH/SCX only · Stegra = SITE POI | ✅ |
| 12 | M1–M12 domain kept (no makieta demo cargo) | ✅ |
| 13 | Squint: reads as Claude shell | ✅ |

## Shots

- `shots-start/claude-shell-hhl-dark.png`
- `shots-start/claude-shell-ksh-light.png`
- `shots-start/claude-shell-map.png`
- `shots-start/claude-shell-nav-expanded.png`
- metrics: `shots-start/claude-shell-gate-metrics.json` (all checks `true`)

## Finish vs prior SoT flip

Prior flip already had Barlow + tokens + geometry. Pass 2 closed remaining gaps:

1. **Nav** — Claude glyphs (`◎ ▤ ▲ ▢ ₽ ✎ ⚙ ⬡`) + `.sep` between common / money / admin  
2. **KPI rail** — flush `.wt-kpis` 3-col restored on Dashboard (was missing; mini-stats alone ≠ gate)  
3. Gate-named screenshots + metrics artifact

## Preview

`vite preview --host 127.0.0.1 --port 4173` (also `:4177` on 0.0.0.0)
