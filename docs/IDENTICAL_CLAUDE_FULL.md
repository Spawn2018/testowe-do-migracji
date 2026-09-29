> **ZAPIS HISTORYCZNY / QA — to nie są polecenia.**

# IDENTICAL vs Claude makieta — full surface checklist

**SoT:** `/workspace/watch-tower/claude-visual-ref/tower-makieta.html` (= `public/claude-ref.html`, `dist/claude-ref.html`)  
**App:** `/workspace/watch-tower-app` · Preview `http://127.0.0.1:4177/` · Ref `http://127.0.0.1:4177/claude-ref.html`  
**Date:** 2026-09-23 (Europe/Warsaw)  
**Build:** `npm run build` — **PASS**  
**Gate input:** `START_SQUINT_GATE_RESULT.md` (18 FAIL) → P0 pass below

---

## START_SQUINT P0 — FAIL → PASS

| # | Gate ID | Was | Now | Evidence |
|---|---|---|---|---|
| 1 | SCH-08 / SCH-10 | missing Kierowca · Nr rej. · ETA Boden · Dok. Z/C/P/M | **PASS** — columns + flagrow present | `/tmp/wt-p0fix-sched.png` |
| 2 | SCH-03/04 | HHL showed Importuj XLSX | **PASS** — HHL only Eksport XLSX; Wgraj = KSH (`canImportSchedule`) | sched headerBtns=`[Eksport XLSX]` |
| 3 | StatusPill / SCH-11 | Rozładunek / Opóźniony / Cichy | **PASS** — Claude `s_*` (Rozładowany…); delay = separate `+XhYm` red pill | pills sample Dostarczony/Rozładowany/… |
| 4–5 | DR-OVER | forms under Przegląd; missing Nr zlecenia/Montaż; Awizacja ISO | **PASS** — Przegląd = `dl.kv` + banner only; forms in Ustalenia; kv has Nr zlecenia + Montaż | `/tmp/wt-p0fix-drawer.png` `hasForm:false` |
| 6 | V-MAP-03 / V-MAP-05 | 6th Prom + Wawel/E4 chips | **PASS** — layers exactly Pojazdy·Strefy·Trasa·Ryzyka·Ślad; mlist chips=[] | `/tmp/wt-p0fix-map.png` |
| 7 | V-WF-01 / V-WF-03 | product names + Uruchom | **PASS** — 7 Claude PL seed names; Uruchom removed from row | `/tmp/wt-p0fix-wf.png` |
| 8 | V-DOCS extra | Transporty bez kompletu + EN enums | **PASS** — block removed | `/tmp/wt-p0fix-docs.png` |
| 8b | V-FIN-04 | Źródła instead of BAF kv | **PASS** — Indeks·Wartość bazowa·Notowanie·Udział paliwa·Formuła·Próg·Cykl | `/tmp/wt-p0fix-fin.png` |
| 9 | TB-09 / NV-05 | clock `śr., …`; Faktury `.hot` | **PASS** — `śr 23.09.2026 · HH:MM`; inv count not `.hot` (risk+tasks only) | `/tmp/wt-p0fix-dash.png` |
| 10 | SCH-14 | shortened margin note | **PASS** — full NBP tabela A sentence | sched `.note` |
| 11 | DR-KV-DIMS | overview dimension label | **PASS** — `Wymiary L×W×H` in Przegląd kv | `/tmp/wt-fix-dims.png` |
| 12 | TB-07 | theme icon glyph | **PASS** — Topbar renders a single `◐` text node | `src/components/shell/Topbar.tsx` |

---

## Remaining honest deltas (non-FAIL / allowed)

1. **Map canvas** — Leaflet/MapLibre inside Claude `.mapbox` (Allowed delta #2).
2. **NotificationBell / Driver PWA** — product extras (Allowed).
3. **Nav footer collapse «** — Allowed delta.
4. **Live seed counts** — 62 loads vs Claude 50 etc. (Allowed).
5. Status enum internal names still include `DOC_MISSING` / `DELAYED` / `SILENT` in data model; **labels** are Claude `s_*` only.

---

## Screenshots

| Path | Surface |
|---|---|
| `/tmp/wt-p0fix-dash.png` | clock + inv badge |
| `/tmp/wt-p0fix-sched.png` | Harmonogram columns + Eksport-only |
| `/tmp/wt-p0fix-drawer.png` | Przegląd kv + banner |
| `/tmp/wt-p0fix-map.png` | 5 layers |
| `/tmp/wt-p0fix-docs.png` | docs cats only |
| `/tmp/wt-p0fix-fin.png` | BAF kv |
| `/tmp/wt-p0fix-wf.png` | 7 Claude WF names |
| `/tmp/wt-literal-dash.png` `/tmp/wt-literal-sched.png` `/tmp/wt-literal-drawer.png` `/tmp/wt-literal-nav.png` | literal set |

## Verdict

START_SQUINT mandatory P0 list: **all closed PASS**. Build PASS. Preview 4177 serves `index-CmTUKm1o.js`.
