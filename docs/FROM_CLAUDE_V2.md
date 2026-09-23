# FROM CLAUDE V2.0 — punkt 3 shell rebuild

**When:** 2026-09-23 ~03:52 Europe/Warsaw (UTC+2)  
**SoT:** `/workspace/watch-tower/claude-v2.0/tower-makieta.html` (= `public/claude-v2-ref.html`, `dist/claude-v2-ref.html`)  
**App:** `/workspace/watch-tower-app` · Preview `http://127.0.0.1:4177/` · Ref `http://127.0.0.1:4177/claude-v2-ref.html`  
**Build:** `npm run build` **PASS** (bundle `index-Bu8gGGwl.js` / `index-C_xoECFn.css`)  
**Scope:** Visual shell = Claude **v2.0** 1:1 + **100%** previously wired chat functions. **Not** punkty 4–8 (Opcje / file preview / rate editor).

---

## Diff v1 chrome → v2.0 (what changed)

| Area | Was (v1 / prior React) | Now (v2.0) |
|---|---|---|
| KPI `.v` | 29px | **42px** (room-scale numeral) |
| Stage `.n` | 26px | **30px** + **`.kb` 1–9** hints |
| Nav glyphs | Unicode ▣◎▤… | **SVG `.ico`** (ClaudeIcon) |
| Pills | radius 2px, no stripe | **radius 0 + 3px left color stripe** |
| Banner `.red` | flat amber/red | **hazard hatch** `::before` + `td.over` / `.board` |
| Table | padding 9px | **7px** + **sticky last money col** `.stick` |
| Flags | 16×16 | **14×14** |
| Topbar clock | weekday clock string | **`.ops`**: week `tN` · ferry countdown · clock/date |
| Topbar | theme ◐ | **theme SVG** + **`?` kbdpanel** |
| Drawer hd | `h3` + `.meta` | **`.wb-code` + `.wb-fields` + `.perf`** (waybill) |
| CSS chrome | v1 extract | **verbatim v2 `<style>`** + SPA extras after |
| Keyboard | none | **K/M/H/R/D/F**, T theme, Shift+R role, Esc, `?` |

Unchanged by design: store, seed, Leaflet/map layers, XLSX/ZIP/factoring/READY←cover/Plan B/SE road/force majeure/12 WF/Driver PWA/AIS|TV labels.

---

## Files touched

- `src/index.css` — v2 CSS 1:1 + SPA extras
- `src/components/shell/ClaudeIcon.tsx` **new**
- `src/components/shell/KeyboardHelp.tsx` **new**
- `src/components/shell/Topbar.tsx` — ops / theme SVG / help / bell kept
- `src/components/shell/Nav.tsx` — SVG icons
- `src/components/shell/CorridorSpine.tsx` — `.kb` 1–9
- `src/components/drawer/LoadDrawer.tsx` — waybill hd + `.board`
- `src/views/ScheduleView.tsx` — `kbdhint`, `td.over`, `.stick`
- `src/App.tsx` — chrome key shortcuts
- `public/claude-v2-ref.html` / `dist/claude-v2-ref.html` — copy of SoT
- `FROM_CLAUDE_V2.md` — this file

---

## Function checklist (still WIRED under v2 chrome)

Legend: same as `FUNCTIONS_UNDER_CLAUDE.md` / `AUDIT_FULL_CHAT.md`.

| # | Requirement | Status |
|---|---|---|
| 1 | M1–M12 module actions mutate store | **WIRED** |
| 2 | READY blocked without permit cover | **WIRED** |
| 3 | Schedule KSH Wgraj XLSX dry-run→commit; HHL Eksport | **WIRED** |
| 4 | Drawer Ustalenia resources/awizacja/ferry | **WIRED** |
| 5 | Plan B on risks | **WIRED** |
| 6 | Driver PWA camera → vault | **WIRED** |
| 7 | Geofence / GPS / fleet / AIS | **WIRED** |
| 8 | Trafikverket live\|seed label | **WIRED** |
| 9 | Factoring HHL configure / SCX choose | **WIRED** |
| 10 | SEFS hybrid OKQ8/ORLEN | **WIRED** |
| 11 | Bell mark read; spine 2nd-click clear; KPI deep-links; WF→notify | **WIRED** |
| 12 | ETA confidence bands | **WIRED** |
| 13 | Role cost/rev/margin | **WIRED** |
| 14 | Addresses Śrem / Boden | **WIRED** |
| — | SE road + force majeure | **WIRED** (`SE_ROAD_AND_FORCE_MAJEURE.md`) |
| — | ZIP docs pack | **WIRED** |
| — | 12 workflows | **WIRED** |

**Honest GAPs (unchanged):** TV/AIS need API keys → seed label; «Nowa reguła» runs first enabled WF (no rule builder); Claude Next/Supabase out of Vite scope.

---

## Screenshots

- `/tmp/wt-v2-dash.png` — app Kokpit under v2 chrome (dark)
- `/tmp/wt-v2-ref.png` — Claude makieta v2.0 ref (light, frozen seed counts)
- `/tmp/wt-v2-vs-ref` — short comparison note

Ref uses light + frozen seed (counts differ). Chrome recipes (ops, kb, SVG nav, hatch banner, KPI scale, Barlow tokens) match.

---

## Explicitly NOT done (punkty 4–8)

- Opcje menu
- File preview
- Rate editor
- Any alternate invented design

## Verdict

**PASS** — v2 visual shell rebuild + existing chat functions retained; build green; preview on 4177; ref HTML served.
