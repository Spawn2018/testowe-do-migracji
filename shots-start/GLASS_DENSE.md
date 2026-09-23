# Glass dense tokens (2026-09-23 Europe/Warsaw)

Locked in `src/index.css` (near-opaque; motif via blur + 1px border + inset highlight):

| Class | Surface mix | Blur |
|-------|-------------|------|
| `.wt-glass-chrome` | **97%** `--wt-surface` | 16px + saturate 1.15 |
| `.wt-glass-panel` | **98.5%** `--wt-surface` | 18px + saturate 1.15 |
| `.wt-btn.wt-glass-chrome` | **97%** `--wt-surface-2` (hover surface-3 97%) | inherits |
| No backdrop-filter | solid `--wt-surface` | — |

Also: `color: var(--wt-ink)` on glass (no translucent text). KPI / tables stay solid (`.wt-panel`).

Shots (after): `glass-dense-cockpit.png`, `glass-dense-map.png`, `glass-dense-map-overlay.png`  
Before refs (QA thinner ~78–82% era): `glass-dense-before-*-ref.png`
