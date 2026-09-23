# RESTORE-V2-CHROME — Claude makieta v2.0 optical restore

Date: 2026-09-23 (Europe/Warsaw)  
SoT: `/workspace/watch-tower/claude-v2.0/tower-makieta.html` (= `dist/claude-v2-ref.html`)  
Preview: `http://127.0.0.1:4177/` vs `http://127.0.0.1:4177/claude-v2-ref.html`

## What broke the spine / chrome (optical)

1. **BATCH-SCROLL / BATCH-PM end of `src/index.css`** forced:
   - `.page-sections > .panel { display:flex; flex-direction:column; margin:0 !important }`
   - That **overrode Claude `.panel.grid2 { display:grid }`** → dash triad stacked vertically (~1202px vs Claude ~649px), chart full-width (~2× tall), spacing looked “rebuilt”.
2. **`.page-sections { gap:12px; padding:12px }` + `margin:0` on children** reinvented Claude’s `.panel{margin:12px}` stack → different gaps between sections.
3. **`main { display:flex }` + `main > * { flex:1; min-height:0 }`** (SPA extras) fought content-grow / Claude block main.
4. **`usePageSectionDnD` injected `⋮⋮` grips into every `.panel-hd`** under `[data-page]` (including Claude dash / grid2 headers) → panel-hd no longer matched SoT.
5. Corridor **markup/CSS tokens were already Claude** (`.kb` / `.n` / `.l` / `.bar>i`, PL labels Przygotowanie…Dostarczone, 30px `.n`). The “rebuilt spine” feeling was mostly **layout drift around it** (grid2 collapse + spacing), not a new spine component.

## What was reverted / rewritten (features kept)

### CSS (`src/index.css`)
- Restored **Claude main**: `display:block; overflow-y:auto` (no flex-lock children).
- **`.page-sections`**: layout host only — `padding:0`, no gap skin; **panels keep `margin:12px`**.
- **Removed** rules that zeroed panel margins or forced `display:flex` on all `.page-sections > .panel`.
- **SectionCard content-grow** kept via `.panel.section-card:not(.grid2) { display:flex; flex-direction:column; overflow:visible; height:auto }` — **excludes `.grid2`**.
- BATCH-SCROLL intent kept: pages `height:auto; overflow:visible`; lists (`.exq` / `.mlist` / `.settings-list` / `.tablewrap`) uncapped vertically; `main` scrolls.
- Map table chrome kept (`.map-loads-table`, `.col-resize`, Terminowe/Spóźnione pressed chips).
- Corridor + topbar metrics **re-locked** to Claude (`height:52`, corridor padding `9px 14px 11px`, `.stage .n` 30px, domain bars sea/site/pre).
- Dash mini-map height restored to Claude **360px** (`.grid2-map-body` / `.minimap`).
- **DnD grips**: optically hidden by default (`width:0; opacity:0`), reveal on header hover/focus — **DnD still works**, Claude panel-hd look by default.

### TSX / hooks
- `DashboardView`: mini-map uses Claude 360 height (no fixed 280).
- `usePageSectionDnD`: stamps grips only on **`.section-card`** roots (not raw Claude `.panel.grid2` nested headers). SectionCard DnD feature kept.
- Removed unused `PageSections` import from `RisksView`.

### Explicitly NOT reverted (Sebastian keep-list)
- Page scroll + section backgrounds grow with content  
- Map **Terminowe / Spóźnione** + column resize  
- Section DnD (grips hover-revealed)  
- Live ferry widget in topbar  
- All org accounts / views still wired  

## Optical confirmation (puppeteer, 1440×900, dark, HHL Kokpit)

| Metric | App | Claude SoT | Match |
|--------|-----|------------|-------|
| topbar height | 52 | 52 | ✓ |
| corridor height | 82.67 | 82.67 | ✓ |
| `.stage .n` | 30px | 30px | ✓ |
| panel margin | 12px | 12px | ✓ |
| first panel top | 201.52 | 201.52 | ✓ |
| `.grid2` display | grid | grid | ✓ |
| `.grid2` height | ~650 | ~649 | ✓ |
| spine labels PL | Przygotowanie…Dostarczone | same | ✓ |
| `.panel-hd` padding | 9px 13px | 9px 13px | ✓ |
| grip default visible | false | false | ✓ |
| main scroll | yes | yes | ✓ |
| Map Terminowe/Spóźnione | present | n/a (app feature) | ✓ |
| Map col-resize | present | n/a | ✓ |

Shots: `/workspace/watch-tower/qa-start/restore-v2/final-*.png` + `final-metrics.json`.

Walked HHL (Kokpit/Mapa/Harmonogram/Ryzyka/Dokumenty/Faktury/Automatyzacje/Opcje/Strefy) + KSH/SCX Kokpit — corridor spine present on all; chrome metrics stable.

## Build / artifact

- `npm run build` — **PASS**
- `/workspace/watch-tower-dist.zip` — refreshed from `dist/` including `vercel.json`
- **No Vercel deploy** (parent)

## Success criteria

- Spine looks like Claude v2.0 (not a new spine)  
- Section typography/spacing match Claude stacked `margin:12` panels; dash `.grid2` side-by-side again  
- Scroll / content-fit / Map filters+resize / DnD / ferry live **still work**  
- Build passes; zip ready  
