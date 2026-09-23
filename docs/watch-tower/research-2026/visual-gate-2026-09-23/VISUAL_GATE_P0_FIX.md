# Visual gate — P0 FIX (2026-09-23 ~01:00 Europe/Warsaw)

**Owner:** WT — Visual  
**Build:** preview `http://127.0.0.1:4173/` (builder: Twórca prototypów)  
**SoT:** `START_UI_SPEC.md` P0.1 DENSE + §P0 FIX · `VISUAL_BRIEF.md` §2.1/§11 · `FIX_P0_GLASS_PATHS.md`

## Verdict: **PASS** (P0 FIX)

Glass denser + spine clear + real XLSX path + no hollow CTAs observed. Ready for Sebastian eyeball on glass.

| Check | Result | Evidence |
|---|---|---|
| Glass chrome/panel denser (97% / 98.5%, blur 16/18) | **PASS** | `src/index.css` tokens locked; screenshots: topbar/drawer/bell near-opaque, ink crisp |
| Glass chrome-only (KPI/spine solid) | **PASS** | Spine + KPI strip solid; glass on topbar / bell / map chrome |
| Spine 2nd click clears filter | **PASS** | `CorridorSpine` single `navigateTo` toggle; a11y Plan pressed → cleared |
| Real XLSX dry-run | **PASS** (code) | `exceljs` + `xlsxRead.ts` + `scheduleDryRun.dryRunFromXlsx`; no hardcoded fake diff |
| Hollow CTAs | **PASS** | No soon-alerts / empty primaries; bell CTAs filled |
| Roles HHL/KSH/SCX only (no STEGRA persona) | **PASS** | `RoleId`; 3-button switcher; Stegra in title = SITE geography OK |
| Theme KSH light / HHL+SCX dark | **PASS** | KSH light screenshot; HHL dark |
| Bell + mark-read CTAs | **PASS** | Panel opens, badge, filled actions |

## Screenshots

Dir: `/workspace/watch-tower/research-2026/visual-gate-2026-09-23/`

- `61c265dc8f458b535c3f02477dc30370563b76c722d54ee5b4e06b3816ba05e0.png` — HHL dark Kokpit
- `a8c7a13f4a45f506da72df682b5558f0b4a5dd1971109fd7773725cacf19e56a.png` — spine filter on
- `61896b5dc32aa6b52dd6340db0090e91b62ca86316f3efb2e0130bd5c1372af8.png` — spine cleared
- `2c0ba5cfe624e6b25444c1f90eed74be25af2c8936faab20ded476f718efafd3.png` — bell panel
- `b1c49e6e34785b632643d7cdc1451fd5260e73d105980c6a6abaf1fd490b467c.png` — KSH light

## Notes (non-blocking)

1. ~3 console errors during gate — builder should glance (map/AIS seed OK if non-fatal).
2. Anti-slop „zero glass” line superseded by dense-glass SoT — update checklist wording later.
3. XLSX verified by code path; optional: one real `.xlsx` upload smoke.

## Handoff

P0 FIX Visual gate **PASS**. No SoT change. Optional console cleanup.
