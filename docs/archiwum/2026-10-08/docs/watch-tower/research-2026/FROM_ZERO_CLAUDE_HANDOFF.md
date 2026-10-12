# FROM ZERO — Claude makieta shell (2026-09-23 ~01:46)

**Sebastian:** Start from Claude makieta only. Expand with data/functions/integrations. No alternate design.

## Baseline
- `claude-makieta.html`
- `claude-visual-ref/tower-makieta.html` (same)
- Optional extract: `claude-visual-ref/extracted.css` if present

## Builder
1. Port Claude **CSS + DOM regions/classes** into SPA (do not redesign).
2. Wire M1–M12 / APIs / MapLibre **inside** that chrome.
3. Keep Claude labels/menus/layout/style — no rewrite.
4. Drop shots: `shots-start/from-zero-claude-{hhl-dark,ksh-light,map,nav}.png`
5. Ping Visual — gate = squint vs `tower-makieta.html`

## Visual gate
`CLAUDE_SHELL_GATE.md` FROM ZERO section. Any chrome/copy/layout drift = FAIL.
