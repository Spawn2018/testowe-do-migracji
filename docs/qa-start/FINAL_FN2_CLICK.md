# FINAL FN2 — Adversarial click Re-QA (functions under Claude chrome)

- **When:** 2026-09-23 ~03:07 Europe/Warsaw (UTC+2)
- **App:** `http://127.0.0.1:4177/` · `/workspace/watch-tower-app`
- **Rule:** Claude chrome FROZEN — look/CSS/copy not judged
- **SoT:** `/workspace/watch-tower-app/FUNCTIONS_UNDER_CLAUDE.md`
- **Static companion:** `FUNCTIONAL_REQA_STATIC_FN2.md` → SHIP_STATIC (14/14 wiring present)
- **Click (authoritative for ship):** **NO_SHIP** — 10 PASS / 4 FAIL

Prefer FAIL: click evidence overrides static “wired” claims when UI does not behave.

## Scorecard (click)

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | Drawer Ustalenia saves | **FAIL** | `fn2-drawer-ustalenia.png` — tab empty; no Zapisz fields |
| 2 | READY←cover | **FAIL** | `fn2-ready-cover.png` — SG-07 MISMATCH/blocked UI yet READY applied |
| 3 | Plan B | PASS | `fn2-planb.png` |
| 4 | ZIP download | PASS | `fn2-zip-download.png` → real `QA-SCHEDULE-742_docs.zip` |
| 5 | XLSX Eksport | **FAIL** | `fn2-xlsx-import-export.png` — no Eksport chip / no download |
| 6 | KSH XLSX import | PASS | same shot — dry-run→commit, 41 plan loads |
| 7 | Factoring HHL/SCX | PASS | `fn2-factoring-hhl.png`, `fn2-factoring.png` |
| 8 | WF run | PASS | `fn2-workflow.png` · `wf-1 · OK` |
| 9 | Map AIS/TV label | PASS | `fn2-map-ais.png` · `Situation: seed · AIS seed` |
| 10 | Driver camera→vault | PASS | `fn2-driver.png` · DOC_UPLOADED |
| 11 | Bell mark read | PASS | `fn2-bell.png` · Powiadomienia · 0 |
| 12 | Spine 2nd-click clear | **FAIL** | `fn2-spine.png` — 2nd E4 Gävle opened Prom/Ryzyka |
| 13 | KPI deep-links | PASS | `fn2-kpi.png` → Map + Plan filter |
| 14 | Spot-check other CTAs | PASS | `fn2-spotcheck-finance.png` |

## Hollow list (builder fix — no look/CSS)

1. **Ustalenia empty** — drawer tab for logistics save  
   - Shot: `qa-start/fn2-drawer-ustalenia.png`  
   - Source expected: `src/components/drawer/LoadDrawer.tsx` `tab === 'chat'` (~384+) forms `Zapisz zasoby` / `Zapisz awizację` gated by `canEditResources(role)`  
   - Expected: editable fields + persist after Zapisz  
   - Observed: empty tab

2. **Eksport XLSX missing in UI** — Harmonogram  
   - Shot: `qa-start/fn2-xlsx-import-export.png`  
   - Source expected: `src/views/ScheduleView.tsx:162-172` chipbtn `Eksport XLSX` → `exportLoadsXlsx` / `src/lib/xlsxExport.ts`  
   - Observed: chip absent at click time (verify preview bundle vs source; possible stale serve)

3. **READY not blocked on permit MISMATCH** — SG-07 drawer  
   - Shot: `qa-start/fn2-ready-cover.png`  
   - Source expected: `src/lib/permits.ts` `isReadyBlocked` / `cover`; `LoadDrawer.tsx:587-590` `disabled={permitBlock}` + `useTowerStore` READY reject  
   - Observed: cover NONE/MISMATCH shown but status became READY

4. **Spine 2nd-click does not clear** — CorridorSpine / map  
   - Shot: `qa-start/fn2-spine.png`  
   - Source expected: `src/components/shell/CorridorSpine.tsx:48-51` toggle `stage: null`  
   - Observed: second click on E4 Gävle opened Prom/Ryzyka detail instead of clearing list+map  
   - Note: confirm click target is spine stage chip, not map POI

## Accepted residuals (not FAIL this gate)

- AIS/TV **seed** labeled (no API keys) — by design  
- WF product count 7 vs 12 — Visual name lock  
- Static wiring present for FAILS — runtime/UI still NO_SHIP until click re-PASS

## Verdict

**NO_SHIP** until hollows 1–4 re-QA click PASS. Do not change Claude chrome/CSS/copy.

---

## INVALIDATION (2026-09-23 ~03:09 Europe/Warsaw)

**Coordinator:** FN2 click evidence hit **OLD** chrome, not frozen Claude shell SoT.

Wrong UI markers in `fn2-*.png`: brand «WATCH TOWER»; drawer tabs Awizacja/Prom/ETA; «Zamknij»; spine Plan/Do portu; «Importuj XLSX».

Claude SoT on `http://127.0.0.1:4177/` (hard refresh): brand **TOWER**; tabs Przegląd·Przebieg·Dokumenty·Ceny·**Ustalenia**; ✕ close; spine Przygotowanie…Gdańsk…; HHL **Eksport XLSX** / KSH **Wgraj aktualizację**.

**Gate status:** FN2 **NO_SHIP suspended / evidence void**. Static SHIP_STATIC still describes source wiring only. **No click re-run until coordinator RE_CLICK** on fresh Claude build.
