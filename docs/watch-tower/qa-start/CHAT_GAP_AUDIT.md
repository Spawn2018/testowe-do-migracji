# CHAT_GAP_AUDIT — t106/t107 (Strefy scroll + full chat reconcile)

**When:** 2026-09-23 Europe/Warsaw (UTC+2)  
**App:** `/workspace/watch-tower-app`  
**SoT optical:** `/workspace/watch-tower/claude-v2.0/tower-makieta.html`  
**Sources read:** `AUDIT_FULL_CHAT.md`, `BATCH-PM-SECTIONS.md`, `BATCH-SCROLL-SECTIONS.md`, `RESTORE-V2-CHROME.md`, `HOLLOW_VERIFY.md`, afternoon t101–t102  
**Note:** `AUDIT_CHAT_REQUIREMENTS.md` — **absent** in app tree.

**Rule:** only in-makieta GAPs closed; live API keys / Next–Supabase left PARTIAL labeled; no redesign.

---

## Immediate fix #1 — Strefy

| Requirement | Status | Evidence | Action taken |
|---|---|---|---|
| Options → Strefy geograficzne inner scroll (`.settings-list` 360px) | **DONE** | Was GAP: BATCH-SCROLL set `.settings-list{max-height:none;overflow:visible}`. Smoke: maxH 360px, overflow auto, scrollH 709 > clientH 360 (13 rows). | `src/index.css` STREFA restore after batch; removed `.settings-list` from BATCH uncapping |
| GeofenceView (`data-page="geofence"`) table inner scroll + capped height | **DONE** | Was GAP: global `.tablewrap{max-height:none}`. Smoke: maxH calc(100vh−260)=640px @900vh, overflow auto. | `.panel[data-page="geofence"] .tablewrap{max-height:calc(100vh - 260px)!important;overflow:auto!important}` |
| Do **not** re-cap Faktury / Automatyzacje / Dokumenty / Ryzyka / Map lists | **DONE** | Dokumenty smoke: `.tablewrap` maxH **none**; `main` page-scrolls; `.exq` / `.mlist` / `.workflow-summary` stay uncapped | Scoped geofence exception only |
| Corridor / topbar / grid2 chrome untouched | **DONE** | Smoke: `.grid2`=grid, `.stage .n`=30px, topbar=52, corridor present | No chrome edits this pass |

---

## Afternoon batches (t101–t102)

| Requirement | Status | Evidence | Action taken |
|---|---|---|---|
| Kokpit map usable (Claude 360) | **DONE** | `.grid2-map-body{height:360px}` | none |
| Ferry arrows on map | **DONE** | CorridorMap + `nextLiveSailing` heading | none |
| Harmonogram cols / Zapisz widok / stage filters | **DONE** | `ScheduleView.tsx` | none |
| Ryzyka SE alts + force majeure | **DONE** | `RisksView` + seed | none |
| Faktury overlap / SCX stack | **DONE** | `.invoices-page` stack | none |
| Sections grey header like Strefy | **DONE** | `SectionCard` + `panel-hd` | none |
| Fitted section bg grows WITH content (except Strefy) | **DONE** | BATCH-SCROLL + STREFA exception | Strefy exception only |
| Truck arrows up/down | **DONE** | mapMarkers + `.wt-arrow` | none |
| Live ferry countdown topbar | **DONE** | `ferry.ts` `nextLiveSailing` + Topbar | none |
| Section DnD via grey header | **DONE** | `usePageSectionDnD` grips hover-reveal | none |
| Page scroll; Faktury/WF/Opcje/Docs full content | **DONE** | `main` scroll; pages `height:auto` | none |
| Ryzyka „Wymaga decyzji” ALL rows (no inner 5-cap) | **DONE** | `.exq` uncapped | none |
| Map Terminowe/Spóźnione + col narrow + thin lines | **DONE** | MapView + `.map-loads-table` | none |
| Optical Claude v2.0 (grid2, spine) | **DONE** | RESTORE-V2; `:not(.grid2)` | none this pass |

---

## AUDIT_FULL_CHAT product surface

| Requirement | Status | Evidence | Action taken |
|---|---|---|---|
| A1–A9 / B1–B10 / M1–M12 / e2e path | **DONE** | AUDIT_FULL_CHAT; views wired | none |
| C1–C2, C4–C5, C7, C11–C18 | **DONE** | WF12, nav, bell, import, KPI | none |
| C3/C8/D3 Trafikverket / AIS live | **PARTIAL** | MapView `live\|seed` labels; no keys | leave labeled seed |
| C6/C10 Vite vs Next/Supabase | **PARTIAL** | makieta architecture | out of scope |
| Empty `onClick={()=>{}}` hollows | **DONE** | ripgrep: none in `src/` | none |
| «Nowa reguła» form | **DONE** | WorkflowsView creator + store | none |
| Plan B ferry mutate + event | **DONE** | `applyPlanB` + loadId fallback | none |
| ≥60 loads / 12 workflows | **DONE** | loads.json=62; wf-1…12 | none |

---

## HOLLOW_VERIFY residuals

| Item | Status | Evidence | Action taken |
|---|---|---|---|
| Driver vault / Podgląd / GPS | **DONE** | store + DriverPwa + DocsView | none |
| Unlinked Plan B hollow | **DONE** | seed loadId/loadCode + applyPlanB fallback | none (prior report stale) |
| localStorage quota large camera | **PARTIAL** | capacity risk | out of makieta polish |

---

## Execute summary (this pass)

**Only code change:** `src/index.css` — STREFA restore (Options `.settings-list` + geofence `.tablewrap`); removed `.settings-list` from BATCH-SCROLL uncapping.

**Docs:** this file `/workspace/watch-tower/qa-start/CHAT_GAP_AUDIT.md`.

**No other product files edited.**

---

## Verify

| Check | Result |
|---|---|
| `npm run build` | **PASS** (`tsc -b && vite build`; css `index-H7PonlLg.css`) |
| `/workspace/watch-tower-dist.zip` + `vercel.json` | refreshed (~1.1 MB, 25 entries, includes `vercel.json`) |
| Optical smoke (puppeteer-core, 1440×900, :4177) | Options `.settings-list` **360px/auto** inner scroll; Geofence `.tablewrap` **640px/auto**; Dokumenty `main` page-scroll, tablewrap maxH **none**; Kokpit `.grid2`=grid, `.stage .n`=30px, topbar=52, corridor present |
