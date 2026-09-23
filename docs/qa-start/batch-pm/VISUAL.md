# Watch Tower visual QA — batch-pm

Date: 2026-09-23 14:00–14:06 UTC+2  
Local preview: http://127.0.0.1:4177/ (hard-refreshed first)

## Part A — local preview

| Screenshot | Result | Notes |
|---|---|---|
| `01-kokpit-map.png` | **FAIL** | Kokpit map widget is cut off at the bottom of the captured viewport: only its header/top sliver is visible. |
| `02-topbar-ferry.png` | **PASS** | Local top-right ferry shows a live `2 h 59 min` countdown to Wawel 23.09 17:00 NYN→GDN, not the past 22.09 sailing. |
| `03-mapa-markers.png` | **PASS** | Mapa shows directional arrow glyphs on truck dots and direction arrows on ferry dots. |
| `04-harmonogram.png` | **PASS** | `Zapisz widok` is left of `Eksport XLSX`; stage filters `Załadunek` through `Boden` are visible. |
| `05-ryzyka.png` | **PASS** | After scrolling the internal risks panel, `Warunki drogowe SE · E4` is followed below the corridor by `Alternatywy trasy SE (zagrożenia drogowe)`. |
| `06-faktury-hhl.png` | **PASS** | H&H Logistics Faktury renders without factoring content overlapping the invoice table. |
| `07-faktury-scx.png` | **PASS** | Switching to Scandinavian Express leaves Faktury usable; SCX factoring/payment and CMR/POD sections render. |
| `08-section-dnd.png` | **PASS** | Opcje shows grey SectionCard headers (including `SCX · cennik bazowy` and `BAF / SEFS · paliwo`). |

Additional SectionCard check: grey section headers were also present on Dokumenty and Strefy (Strefy table/header view verified).

## Part B — Vercel

- Project: `watch-tower-makieta`
- Redeployed from the Vercel project UI; `/workspace/watch-tower-dist.zip` was dropped on the project overview and the resulting production deployment reached **Ready**.
- Final URL: https://watch-tower-makieta.vercel.app/
- HTTP note: `HTTP/2 200`, `content-type: text/html; charset=utf-8`.
- Production spot-check: TOWER loads after hard refresh, but ferry widget still shows **`0 h 00 min` / `M/F Wawel · 22.09 21:00`** (past sailing), so the production ferry-live criterion is **FAIL** despite the local preview PASS.

Screenshots are saved in this directory as `01-...png` through `08-...png`.

## Follow-up 09/10 — 2026-09-23 14:10–14:16 UTC+2

| Screenshot | Result | Notes |
|---|---|---|
| `09-kokpit-map-fixed.png` | **FAIL** | Local preview was hard-refreshed and opened to Kokpit. The map widget body is still only a thin sliver beneath the `Mapa` header (no usable map tiles/route). Top-right local ferry showed live `2 h 49 min`, `Wawel · 23.09 17:00 · NYN→GDN`. |
| `10-vercel-ferry.png` | **FAIL** | Production hard refresh still shows `0 h 00 min`, `M/F Wawel · 22.09 21:00` (past sailing). Production HTML references old asset `assets/index-_gz-WMP7.js`; supplied `/workspace/watch-tower-dist.zip` contains `assets/index-BnZ6tEHd.js` (and `index-CucCds3q.css`). Vercel UI showed a Ready production deployment, but the production URL remained on the old asset. |

Production URL: https://watch-tower-makieta.vercel.app/ (Ready deployment observed; required visual/hash criteria not met).

## Follow-up 11 — 2026-09-23 14:30 UTC+2

- Production redeployed to the existing `watch-tower-makieta` project via Vercel CLI; deployment reached **READY** and was aliased to `watch-tower-makieta.vercel.app`.
- Production HTML now references `assets/index-BnZ6tEHd.js`; old `index-_gz-WMP7.js` is absent.
- Ferry countdown: **PASS** — top-right shows `2 h 30 min`, `Wawel · 23.09 17:00 · NYN→GDN` (not the past 22.09 sailing).
- Screenshot: `12-vercel-prod-new.png`.
