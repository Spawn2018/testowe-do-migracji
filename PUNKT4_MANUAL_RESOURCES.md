# PUNKT 4 — Manual resources / awizacja (Ustalenia)

**When:** 2026-09-23 ~03:55 Europe/Warsaw (UTC+2)  
**App:** `/workspace/watch-tower-app` · Preview `http://127.0.0.1:4177/`  
**Build:** `npm run build` **PASS** · bundle `index-Dv_DN8mr.js` / `index-C_xoECFn.css`  
**Chrome rule:** Claude v2.0 FROZEN — no look/CSS redesign; edit UI stays in drawer **Ustalenia** only.

---

## Goal (done)

Manual entry of:
1. **Driver** — name, phone  
2. **Vehicle** — tractor, trailer, escort/plates, set L×W×H / masa (already in Ustalenia)  
3. **Awizacja podjęcia** — load window **start/end with hour** via `datetime-local`

Saving **propagates** across mockup and **updates status** honestly.

---

## Behavior

### Forms (Ustalenia / Claude tab)
- **Zapisz zasoby** → `updateResources` → `load.resources` + toast «Zasoby zapisane» + audit `RESOURCES_UPDATED`
- **Zapisz awizację** → `updateAwizacja` + `updateFerry` → toast «Awizacja zapisana» + audit `AWIZACJA_UPDATED` (+ `FERRY_UPDATED`)
- Load window + ferry departure/arrival use **`type="datetime-local"`** (Warsaw `+02:00` on save; ISO ↔ local helpers)

### Status transitions (store)

| From | Condition on Zapisz zasoby | To | Audit note |
|---|---|---|---|
| `RESOURCES_PENDING` / `PLANNED` («Brak auta») | driver + tractor + trailer filled **and** permit cover OK (`isReadyBlocked` w/o stale `docMissing`) | **`READY`** («Gotowy») | `STATUS_READY · Zasoby uzupełnione — cover OK` |
| same | resources filled **but** cover blocked (e.g. TRIP gap) | **`DOC_MISSING`** | `STATUS_DOC_MISSING · Zasoby OK → cover: …` |

| On Zapisz awizację | Condition | Effect |
|---|---|---|
| confirmed + load window start/end + resources complete + cover OK | status in PLANNED / RESOURCES_PENDING / DOC_MISSING | → **`READY`** (`Awizacja potwierdzona + zasoby + cover OK`) |

Also:
- Clears OPS «Brak kierowcy / numerów rejestracyjnych» risks for that load → rebuilds `exceptions[]`
- Clears stale `docMissing` when promoting to READY on cover OK

### Derived displays refreshed (same store reads)
- Schedule columns **Kierowca**, **Nr rej.**, status pill  
- Map fleet tooltip: `code · driver · plate`  
- Tasks list (status-driven «czego brakuje»)  
- Exceptions meta (resource gap closed)  
- Przegląd kv: Kierowca / Ciągnik·naczepa (values only — layout frozen)

---

## Verified transitions (puppeteer)

### A — PERIOD cover OK → READY
- Load **SG-19** seed: `RESOURCES_PENDING`, empty driver/plates  
- Fill Jan Kowalski / WWL 4P40 / WWL N4P0 → **Zapisz zasoby**  
- **Result:** `RESOURCES_PENDING` → **`READY`**  
- Events: `RESOURCES_UPDATED`, `STATUS_READY · Zasoby uzupełnione — cover OK`  
- Schedule row: `Gotowy · Jan Kowalski · WWL 4P40`  
- Awizacja 2026-10-17 08:00–16:00 + confirmed → `AWIZACJA_UPDATED` / `FERRY_UPDATED` (already READY)

### B — TRIP cover gap → DOC_MISSING
- Load **SG-09** seed: `RESOURCES_PENDING`, `attachmentKind: TRIP`  
- Fill driver+plates → **Zapisz zasoby**  
- **Result:** → **`DOC_MISSING`**  
- Event: `STATUS_DOC_MISSING · Zasoby OK → cover: TRIP — brak linku load_id / window_id`

---

## Files touched

| File | Change |
|---|---|
| `src/store/useTowerStore.ts` | `resourcesComplete`, exception rebuild, status transitions in `updateResources` / `updateAwizacja` |
| `src/components/drawer/LoadDrawer.tsx` | `datetime-local` load window (+ ferry times); ISO helpers |
| `src/components/map/CorridorMap.tsx` (+ leaflet twin) | tooltip shows driver/plate |
| `src/views/TasksView.tsx` | READY + confirmed awizacja copy |
| `PUNKT4_MANUAL_RESOURCES.md` | this file |
| `scripts/smoke-p4-resources.mjs` / `verify-p4.mjs` | smoke / verify |

**Not touched:** Claude chrome CSS/tokens, Przegląd kv layout, P5–P11 (files, Opcje, rate editor, public link, full QA).

---

## Deliverables

| Item | Path / result |
|---|---|
| Build | **PASS** |
| Preview | `http://127.0.0.1:4177/` |
| Doc | `/workspace/watch-tower-app/PUNKT4_MANUAL_RESOURCES.md` |
| Screenshot | `/tmp/wt-p4-ustalenia.png` — Ustalenia filled + **SG-19 Gotowy** + toasts |

## Verdict

**PASS** — Punkt 4 only; manual zasoby/awizacja with hours; status RESOURCES_PENDING→READY or DOC_MISSING; audit + toast; derived fields sync.
