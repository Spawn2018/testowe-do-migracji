# P9 v2 Eye + Click QA — Watch Tower vs Claude v2.0

**Run:** 2026-09-23 04:20–04:39 UTC+2  
**Scope:** verification only; no code/CSS changes. Ref was captured from `/claude-v2-ref.html`; final app eye captures were also taken in a fresh incognito window with a clean seed.

## Bundle / screenshots

- Served app script: `index-DyFIe8Ef.js` (1,903,508 B)
- Served CSS: `index-ByS64djj.css` (57,682 B)
- Ref: `p9-ref-dash.png`, `p9-ref-schedule.png`
- App: `p9-app-fresh-dash.png`, `p9-app-fresh-schedule.png` (also retained: `p9-app-dash.png`, `p9-app-schedule.png`)
- Function evidence: `p9-fn-*.png` in this folder.

## Eye scorecard

| Chrome area | Result | Observation / allowed delta |
|---|---|---|
| Topbar / `.ops` | PASS | TOWER, week `t39`, ferry countdown, clock/date, theme/help SVG; bell is an allowed product extra. |
| Nav SVG icons | PASS | v2 icon treatment present; no v1 Unicode-nav mismatch on fresh app. |
| Spine + keyboard hints | PASS | Stages 1–9 and `.kb` numbering present. |
| KPI numeral scale | PASS | Room-scale numerals match v2; live KPI values differ from frozen ref. |
| Pills / left stripe | PASS | Square v2 pills with colored left stripes. |
| Hazard hatch banners | PASS | Hatch treatment visible on hazard surface; fresh dashboard uses an amber live alert while ref uses the frozen red alert (data/severity delta, not token mismatch). |
| Schedule density | PASS | Dense v2 table, status strips, document markers and sticky money column; 62/72 live rows vs 50 frozen ref. |
| Drawer header / waybill | PASS | `.wb-code`, fields, status and waybill-style header present. |

**Eye verdict: PASS.** Theme was light in fresh incognito and matched the light ref; dark drawer/function surfaces also retained v2 tokens.

## Click scorecard

| # | Probe | Result | Evidence / notes |
|---:|---|---|---|
| 1 | Ustalenia HHL/SCX save; KSH read-only | PASS | HHL and SCX resource/awizacja saves fired; KSH SG-07 Ustalenia rendered read-only values with no save controls. |
| 2 | READY blocked on MISMATCH (SG-07) | **FAIL / fixture mismatch** | SG-07 `Ustaw READY` was disabled, but its fresh-seed docs were all present and header was `Rozładowany`, not `MISMATCH`. Exact mismatch fixture observed on SG-34, also with READY disabled. Required SG-07 mismatch case was not reproduced. |
| 3 | Plan B mutates | PASS | `Gdynia–Karlskrona` changed to `Plan B aktywny` and emitted a notification. |
| 4 | ZIP bytes > 0 | PASS | `SG-34_dokumenty.zip`, 605 B. |
| 5 | Eksport XLSX bytes > 0 | PASS | KSH XLSX export, 14,677 B. |
| 6 | KSH Wgraj: dry-run; commit 0 must not wipe | **FAIL** | Dry-run displayed `+1 / -0 / Δ0`; clicking `Zatwierdź` replaced the 72-row schedule with one `QA-SCHEDULE-742` row (`1/1`). This is a destructive zero-delta import. |
| 7 | Factoring HHL/SCX | PASS | HHL toggle persisted; SCX standard/factoring radios switched and factoring was reselected. |
| 8 | WF run → notification | PASS | `Uruchom` produced `Uruchomiono: Powiadomienie 40 min przed placem`; unread count increased 13→14. |
| 9 | Map TV/AIS seed/live label | PASS | Map note showed `Trafikverket E4: seed · AIS: seed`; expected API-key fallback. |
| 10 | Driver camera → DOC_UPLOADED | PASS | `#/driver/demo-active`: `Aparat / plik → CMR` accepted a file, showed `Załączono · CMR · p9-ref-dash.png (156647 B)` and vault entry. |
| 11 | Bell mark-all | PASS | `Oznacz wszystkie` reduced unread count 15→0. |
| 12 | Spine second-click clear | PASS | First click activated stage/filter; second click cleared active/pressed state. |
| 13 | KPI deep-link | PASS | `Wymaga decyzji` KPI opened the risk/delegation view. |
| 14 | Spot hollow CTAs | PASS (none confirmed) | No exercised CTA was a confirmed no-op. Coverage was limited after the destructive import result. |
| + | `?` help; K/M/H shortcuts | PASS | Help dialog listed shortcuts; native key verification navigated to Map (`M`). |

## Hollow list

None confirmed in exercised paths. The KSH import `Zatwierdź` control is not hollow; it is destructive and is listed as a functional FAIL.

## Overall

# **NO_SHIP**

Eye chrome is v2-compatible, but the required KSH zero-delta commit safety check fails catastrophically (72 rows → 1), and the exact SG-07/MISMATCH READY fixture could not be reproduced (SG-07 was `Rozładowany` with all docs present).

Report: `/workspace/watch-tower/qa-start/P9_V2_EYE_CLICK.md`
