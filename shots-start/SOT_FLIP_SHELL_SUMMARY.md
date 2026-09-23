# SoT flip — Claude shell match (Builder → WT Visual)

**When:** 2026-09-23 ~01:35 Europe/Warsaw  
**Authority:** Sebastian / `SOT_FLIP_CLAUDE_SHELL_2026-09-23.md` + `START_UI_SPEC.md`

## Done

| Item | Status |
|---|---|
| Fonts → **Barlow + Barlow Condensed** (Google Fonts in `index.html`) | PASS |
| Stop Plex-as-only-chrome (`@theme`, `--wt-font-*`) | PASS — zero Plex refs in src |
| Makieta dark/light hex → `--wt-*` aliases | PASS (`#080F15` / `#E3E9ED` page, etc.) |
| Shell geometry: topbar **52**, nav **186**, spine pad **9/14/11**, brand **23**, spine n **26**, KPI **29** | PASS |
| `.wt-seg` ink-invert (surface-2, Barlow UI 12.5, no uppercase Condensed) | PASS |
| `.wt-iconbtn` 30×30 radius 2 | PASS |
| Nav density + `.count` / `.count.hot` like makieta | PASS |
| Domain kept: M1–M12 + HHL/KSH/SCX only (no makieta demo cargo) | PASS |
| Solid KPI / spine / tables (no milk glass) | kept |
| `npm run build` | **PASS** |
| Preview | `http://127.0.0.1:4173/` |

## Side-by-side metrics (dark, 1440×900)

| Metric | App | Makieta |
|---|---|---|
| body font | Barlow 14px | Barlow 14px |
| brand | Barlow Condensed 23 | Barlow Condensed 23 |
| topbar H | 52 | 52 |
| nav W | 186 | 186 |
| spine pad | 9px 14px 11px | 9px 14px 11px |
| `--page` / `--wt-bg` | `#080F15` | `#080F15` |
| `--surface` | `#101C25` | `#101C25` |
| `--ink` | `#DCE7EE` | `#DCE7EE` |

All `match.*` flags in `sot-flip-shell-metrics.json` = **true**.

## Shots

- `shots-start/sot-flip-app-shell.png` / `sot-flip-app-chrome.png`
- `shots-start/sot-flip-makieta-shell.png` / `sot-flip-makieta-chrome.png`
- `shots-start/sot-flip-shell-metrics.json`

## Files touched

- `index.html` — Barlow load; `data-theme="dark"` first paint
- `src/index.css` — tokens, fonts, seg/topbar/nav/iconbtn
- `src/components/shell/Topbar.tsx` — `wt-brand` / `wt-clock` / `wt-iconbtn`
- `src/components/shell/Nav.tsx` — makieta padding/glyph/count
- `src/components/shell/NotificationBell.tsx` — `wt-iconbtn`

## Note for Visual

Prior “Barlow FAIL / Plex only” gates are overridden for **shell** per SoT flip. Score M1–M12 content richness separately from shell chrome match.
