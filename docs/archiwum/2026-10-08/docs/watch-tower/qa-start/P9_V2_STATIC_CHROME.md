# P9 — Claude v2.0 Static Chrome QA

- **Target:** `/workspace/watch-tower-app/src`
- **Mode:** static/adversarial; prefer FAIL
- **When:** 2026-09-23 04:21 CEST (Europe/Warsaw)
- **SoT:** `/workspace/watch-tower/claude-v2.0/tower-makieta.html` and `/workspace/watch-tower-app/public/claude-v2-ref.html`
- **SoT index:** `/workspace/watch-tower-app/FROM_CLAUDE_V2.md`
- **Reference parity:** the two SoT HTML files are byte-identical (`cmp` PASS).

## Marker scorecard

| # | Marker | Verdict | File:line evidence |
|---:|---|---|---|
| 1 | KPI `.v` approximately 42px | **PASS** | `src/index.css:139` sets `.kpi .v` to `font-size:42px`; `src/components/ui/KpiTile.tsx:17-20` renders `.kpi` / `.v`. SoT reference: `tower-makieta.html:139`. |
| 2 | Corridor stage `.n` approximately 30px; `.kb` hints 1–9 | **PASS** | `src/index.css:92-95` sets `.stage .n` to 30px and styles `.kb`; `src/components/shell/CorridorSpine.tsx:34-65` renders `{i + 1}` for every `STAGE_ORDER` stage; `src/lib/status.ts:105-115` contains 9 stages. SoT reference: `tower-makieta.html:92-95`. |
| 3 | ClaudeIcon SVG navigation | **PASS** | `src/components/shell/ClaudeIcon.tsx:4-20,24-119` defines inline SVG icons; `src/components/shell/Nav.tsx:5,132` imports and renders `ClaudeIcon`. |
| 4 | Pill radius 0 plus left color stripe | **PASS** | `src/index.css:181-188` sets `border-radius:0`, `border-left:3px`, and tone-specific stripe colors. SoT reference: `tower-makieta.html:181-188`. |
| 5 | Banner hazard hatch | **PASS** | `src/index.css:291-301` defines the red hatch `::before`, `td.over`, and `.board`; use sites are `src/views/DashboardView.tsx:53-58`, `src/views/ScheduleView.tsx:398-405`, and `src/components/drawer/LoadDrawer.tsx:197,281`. SoT reference: `tower-makieta.html:291-301`. |
| 6 | Topbar `.ops`, theme SVG, KeyboardHelp `?` | **PASS** | `.ops` CSS is `src/index.css:336-341`; `src/components/shell/Topbar.tsx:106-150` renders theme `ClaudeIcon`, literal `?`, ops week/countdown/clock; `src/components/shell/KeyboardHelp.tsx:4-15,29-35` includes `?`. |
| 7 | LoadDrawer waybill `.wb-code` / `.wb-fields` / `.perf` | **PASS** | CSS: `src/index.css:325-333`; JSX: `src/components/drawer/LoadDrawer.tsx:134,142,171`. |
| 8 | Schedule sticky money column / `kbdhint` | **PASS** | Sticky CSS: `src/index.css:161-163`; hint CSS/JS: `src/index.css:307`, `src/views/ScheduleView.tsx:333-335`; money `stick` classes: `src/views/ScheduleView.tsx:367-378,441-449`. |
| 9 | `App.tsx` keyboard shortcuts | **PASS** | `src/App.tsx:34-76` implements Escape, `?`, T, Shift+R, K/M/H/R/D/F and role gating; `src/components/shell/KeyboardHelp.tsx:4-15` lists the same contract. |
| 10 | Live bundle provenance vs v2 SoT note | **FAIL** | `curl http://127.0.0.1:4177/` at 04:21 CEST serves `/assets/index-Ph5F0lnn.js` and `/assets/index-ByS64djj.css` (`dist/index.html:11-12`). `FROM_CLAUDE_V2.md:6` still declares `index-Bu8gGGwl.js` / `index-C_xoECFn.css`. Current live CSS/JS do contain the expected chrome selectors/markers, but the recorded v2 build hashes are stale and do not identify the live bundle. |

## Live bundle note

The current served bundle is internally consistent with the current `dist/index.html` and exposes the checked chrome markers (`.kpi .v`, `.stage .n`, `.stage .kb`, `.ops`, `.wb-code`, `.wb-fields`, `.perf`, `.kbdhint`, `position:sticky`, `banner red`, `kbdpanel`, `wt-toggle-help`). The FAIL is limited to build-provenance drift in `FROM_CLAUDE_V2.md:6`; no source-code change was made.

## Result

- **Chrome markers:** 9 PASS / 0 marker FAIL.
- **Overall static result:** **FAIL** due to live-bundle provenance mismatch.
- **FAIL count:** **1**.
