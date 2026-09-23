# PUNKT 9 — Full functional + eye QA (Claude v2.0)

**When:** 2026-09-23 04:26 CEST (Europe/Warsaw, UTC+2)  
**App:** `http://127.0.0.1:4177/` · bundle `index-D00ZV9dP.js` / `index-ByS64djj.css`  
**Ref:** `http://127.0.0.1:4177/claude-v2-ref.html`  
**UI:** PL · prefer FAIL  
**Build:** `npm run build` — **PASS** (after critical fixes)

## Verdict: **SHIP**

Critical READY-gate hollows fixed (chrome-safe). All listed areas pass functional + chrome squint vs v2. Residual notes are non-blocking.

---

## SHIP / FAIL list

| # | Area | Verdict | Evidence |
|---|---|---|---|
| 1 | Nav views HHL | **SHIP** | Kokpit · Mapa · Harmonogram · Ryzyka · Dokumenty · Finanse · Faktury · Automatyzacje · Strefy · Opcje — all non-stub |
| 2 | Nav views KSH | **SHIP** | Kokpit · Mapa · Harmonogram · Ryzyka · Dokumenty · Rozliczenia (no money/admin leak); cost/margin cols hidden |
| 3 | Nav views SCX | **SHIP** | Kokpit · Mapa · Harmonogram · Ryzyka · Dokumenty · Moje zadania · Moje stawki · Faktury |
| 4 | Drawer tabs | **SHIP** | Przegląd · Przebieg · Dokumenty · Ceny · Ustalenia (matches Claude v2 `d_over/d_tl/d_docs/d_money/d_chat`) |
| 5 | Ustalenia save + status | **SHIP** | HHL: Zapisz zasoby → driver `QA P9 Kierowca`; Zapisz awizację → `confirmed` + window persisted; status path OK |
| 6 | Docs upload / preview / download | **SHIP** | Wgraj dokument + file input; preview modal with `<img>`; download produces bytes (ZIP pack 99855 B observed) |
| 7 | Opcje cennik / BAF | **SHIP** | Panels `SCX · cennik bazowy` + `BAF / SEFS · paliwo`; 25 inputs; DOM edit `rateCost[0]` survives reload |
| 8 | WF create | **SHIP** | Nowa reguła → `P9 QA Reguła` (12→13); Uruchom bumps notifications |
| 9 | Import / export | **SHIP** | Eksport XLSX >0 B; Wgraj dry-run UI; empty XLSX → toast reject, loads 72 unchanged |
| 10 | Plan B | **SHIP** | Ryzyka · Alternatywy · Przelicz → store `Plan B aktywny` + toast `Plan B: Nova Star…` |
| 11 | READY gate | **SHIP** *(fixed)* | SG-34 seed was READY+MISMATCH (**FAIL** found); demoted to `DOC_MISSING`. Ustaw READY + Wyjazd disabled (`docMissing` / MISMATCH). Store blocks READY / IN_TRANSIT_PL / LOADING when `isReadyBlocked` |
| 12 | Map layers | **SHIP** | Leaflet present; toggles Pojazdy/Strefy/Trasa/Ryzyka/Ślad flip checked state |
| 13 | Risks SE / FM | **SHIP** | Seed types DOC6 · OPS12 · FERRY2 · ROAD_SE3 · FORCE_MAJEURE5; SE E4 + FM copy visible |
| 14 | Factoring | **SHIP** | HHL: Oferta factoringu + prowizja%; SCX: Tryb płatności |
| 15 | Bell | **SHIP** | Popover + «Oznacz wszystkie» → unread 13→0 |
| 16 | Spine | **SHIP** | 9 stages + `.kb` 1–9; aria-pressed on → 2nd click clears (stageFilter session-only, not persist — by design) |
| 17 | KPI deep-links | **SHIP** | `.v` font-size **42px**; click → Harmonogram (and other role KPIs navigate) |
| 18 | Visual squint vs v2 | **SHIP** | kpiFs 42 / stageFs 30 / kb + SVG nav ico + `.ops` match ref; no chrome drift flagged |

---

## Critical fixes applied (chrome-safe)

1. **`src/data/seed.ts`** — SG-34 demoted `READY` → `DOC_MISSING` + `docMissing` + `permitFits:false` (aligned with MISMATCH docs / risk copy).  
2. **`src/store/useTowerStore.ts`** — `setLoadStatus` blocks `READY` **and** `IN_TRANSIT_PL` / `LOADING` when `isReadyBlocked` (closes Wyjazd bypass).  
3. **`src/components/drawer/LoadDrawer.tsx`** — Wyjazd uses same disabled/guard as Ustaw READY.

Build remained **PASS** after each fix.

---

## Notes (non-blocking)

- Empty XLSX toast is `Nie udało się odczytać XLSX` (not the FN3B «brak poprawnych wierszy» string) — base untouched → accepted.  
- `mapLayers` / `stageFilter` intentionally omitted from zustand `partialize` (session UX).  
- Honest GAPs unchanged: TV/AIS need keys → seed label; Claude Next/Supabase out of Vite scope.  
- Shots: `/tmp/wt-p9/*.png` (42) · raw JSON `/tmp/wt-p9-retest.json` · scripts `scripts/punkt9-full-qa.mjs`, `scripts/punkt9-retest.mjs`

---

## P9 NO_SHIP blocker fix — additive schedule import

- `scheduleDryRun` now always returns `removedIds: []`; partial XLSX files only add or change rows.
- `commitImport` ignores supplied removals by default and toasts `Import: pominięto usuwanie N pozycji (tryb dopisywania)`; destructive removal requires explicit `allowRemovals: true`.
- SG-34 remains a seeded `DOC_MISSING` load with `PERMIT_PL`/`PERMIT_SE` documents marked `MISMATCH`, so the Docs view exposes a READY-disabled demo.
- Verified: `npm run build` PASS; preview restarted on `http://127.0.0.1:4177/`; one-row XLSX smoke reports `added=1`, `changed=0`, `removed=0`, `rejected=0`; commit preserves all 72 existing loads and adds the row.

## Brief verdict

**SHIP** under Claude v2.0 chrome. Prefer-FAIL QA caught SG-34 seeded READY with permit MISMATCH and Wyjazd bypassing the gate; both fixed without chrome drift. Build PASS.
