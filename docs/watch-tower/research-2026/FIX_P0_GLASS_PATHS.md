# FIX_P0_GLASS_PATHS — Visual (2026-09-23)

Dense glass SoT + CSS only. Builder still owns spine / xlsx / hollow CTA.

## Paths changed (absolute)

| Path | Change |
|---|---|
| `/workspace/watch-tower/research-2026/START_UI_SPEC.md` | P0.1 rewritten to DENSE locked tokens (97% / 98.5%, blur 16/18); added `## P0 FIX — Sebastian follow-up (2026-09-23)` with spine bug, real XLSX, hollow CTAs + acceptance |
| `/workspace/watch-tower/VISUAL_BRIEF.md` | §2.1 denser tokens; anti-pattern / checklist / §11 START lock no longer say 78% or blur 8–12 |
| `/workspace/watch-tower/research-2026/VISUAL_BRIEF_ELITE.md` | START lock + anti-slop aligned to dense glass; pointer to P0 FIX |
| `/workspace/watch-tower-app/src/index.css` | `.wt-glass-chrome` / `.wt-glass-panel` / `.wt-btn.wt-glass-chrome` → 97% / 98.5%, blur 16/18, stronger border+ink mix; box-shadows kept |
| `/workspace/watch-tower/research-2026/FIX_P0_GLASS_PATHS.md` | This report |

## Glass fill % now in index.css

- `.wt-glass-chrome`: **97%** `var(--wt-surface)` + `blur(16px)`
- `.wt-glass-panel`: **98.5%** `var(--wt-surface)` + `blur(18px)`
- `.wt-btn.wt-glass-chrome`: **97%** `var(--wt-surface-2)`

## Builder must still code (not Visual CSS)

1. **Spine 2nd click clear filter** — `CorridorSpine.tsx` + store/`navigateTo`: toggle in one place (`next = stageFilter===stage ? null : stage` then `navigateTo({ view:'map', stage: next })`). Do not call `setStageFilter` then force-set via `navigateTo`.
2. **Real XLSX dry-run** — add `xlsx` dep; parse uploaded File in `ScheduleView` `acceptFile`; compute added/changed/removed/rejected vs current loads; reject non-xlsx; remove hardcoded `dryRun` (~L39–65).
3. **Hollow CTA audit** — every visible button/link must navigate / open drawer / set filter / open real modal; ban `alert('soon')`, empty `onClick`, decorative primary buttons.

See START_UI_SPEC `## P0 FIX — Sebastian follow-up (2026-09-23)` for full recipes + acceptance checkboxes.
