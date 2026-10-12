# FIX A–C — FROM ZERO re-gate prep (2026-09-23 ~02:05 CEST)

**SoT:** `claude-visual-ref/tower-makieta.html`  
**App:** `/workspace/watch-tower-app`  
**Build:** `npm run build` **PASS**  
**Preview:** `http://0.0.0.0:4177/`  
**Shots:** `watch-tower-app/shots-start/from-zero-fix-{hhl-dark,ksh-light,map,nav}.png`

Live DOM smoke (HHL dark, after fix):

- stages **9** = `Przygotowanie · Załadunek · Droga PL · Gdańsk · Prom · Nynäshamn · Droga SE · Boden · Dostarczone`
- panel heads include **`Wymaga decyzji`** · **`Postęp dostaw`** · **`Mapa`**

## A — Exception title (P0 text)

| | Gate FAIL | After (= Claude `q_title`) |
|---|---|---|
| PL | `Do załatwienia` | **`Wymaga decyzji`** |
| EN | (drift) | **`Needs a decision`** |
| SV | (drift) | **`Kräver beslut`** |

`src/i18n/messages.ts` → `exceptions`. Kokpit left `.panel-hd h2` uses `t(locale, 'exceptions')`.

## B — Kokpit right column (P0 layout)

OTIF cliff + chip strip removed. Claude `viewDash` right stack restored:

1. **`Postęp dostaw`** (`progress`) · sub `tygodnie 37–45` (`progress_weeks`)
2. SVG **Plan** / **Wykonanie** (`planline` / `actualline`) · weeks t37–t45 · today mark
3. Mini **Mapa** (230px) + `chipbtn` → full map · Leaflet `embedded` (no `.mapkey`)

- Chart: `src/components/chart/DeliveryProgress.tsx` (= makieta `scurveHTML`)
- Triad: `src/views/DashboardView.tsx` → `.panel.grid2` left exceptions · right progress + map

## C — Corridor spine = 9 stages (P0 IA)

Claude `PRE ZAL PL GDA SEA NYN SE SITE DONE` →

`PLAN · LOADING · TO_PORT · GDANSK · FERRY · APPROACH · SE_ROAD · SITE · DELIVERED`

- `AT_PORT` → **`GDANSK`** (label **Gdańsk**) between Droga PL and Prom
- Nynäshamn before Droga SE
- Domain tint = Claude: only `FERRY`=sea · `SITE`/`DELIVERED`=site · `PLAN`=pre (Gdańsk untinted)

## D — Map chrome (P1)

- Embedded dash map: no `.mapkey`
- Full map: Claude `.mapkey` status dots only (ferry floating card + long note removed)
- AIS tooltips non-permanent; MapView focus chip removed from `.maplayers`

## Unchanged

Barlow + Claude tokens · Leaflet · M1–M12 · HHL/KSH/SCX · i18n PL/EN/SV.

## Re-gate

Squint `from-zero-fix-*.png` vs makieta twin. Expect **A–C PASS**.
