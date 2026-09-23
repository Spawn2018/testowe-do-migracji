# STATIC QA — Watch Tower START sprint

- **Target:** `/workspace/watch-tower-app`
- **Mode:** adversarial static (code + seed only; prefer FAIL when weak)
- **When:** 2026-09-23 00:52 CEST (Europe/Warsaw)
- **Refs:** UX_MAP §1 / acceptance #18–20 · PERMIT_ATTACHMENT_RULES.md · QA_ELITE §0 B6 / §10 S1–S6

---

## Scorecard

| # | Gate | Verdict |
|---|------|---------|
| 1 | Roles only HHL/KSH/SCX — no Stegra in topbar/switcher | **PASS** |
| 2 | MapLibre tiles + animated trucks + ferry AIS (:4175) | **PASS** |
| 3 | Collapsible nav, glass chrome, firm logos | **PASS** (persist key ≠ SoT — see UX #18) |
| 4 | Bell mark-read clears unread badge | **PASS** (deletes, does not flip `read`) |
| 5 | KPI / spine / exception deep-links wired | **FAIL** |
| 6 | Schedule DnD XLSX dry-run → commit | **FAIL** |
| 7 | ≥62 loads; Kratownice W=3.6; `cover()` PERIOD\|TRIP\|REGULATION | **PASS** |
| 8 | `DRIVER_TOKENS['demo-sg14']` → SG-14 load | **PASS** |
| 9 | SCX KPI shows Koszt, not KSH Przychód | **PASS** |
| 10 | Dead buttons / hollow modules | **FAIL** |

**Overall: FIX** (borderline **BLOCK** if START claims “real XLSX import” or “zero dead chrome”)

---

## Gate 1 — Roles HHL / KSH / SCX only — **PASS**

**Evidence**

- `RoleId = 'HHL' | 'KSH' | 'SCX'` — `src/types/index.ts:3`
- Topbar switcher: `const ROLES: RoleId[] = ['HHL', 'KSH', 'SCX']` — `Topbar.tsx:8`, map `:75–101`
- `NAV_BY_ROLE` / `ROLE_META` only those three — `permissions.ts:15–19`, `:74–96`
- No `STEGRA` / Stegra role id in `src/`

**Stegra place-only (allowed):** geofence/SITE copy e.g. `seed.ts:49` (`Stegra · Stalverket 20, Boden`), `i18n/messages.ts` `unload_site`, `status.ts` SITES.site — not a role.

**Falsify attempt:** grep for Stegra-as-role → empty. **PASS.**

---

## Gate 2 — MapLibre + animated trucks + ferry AIS — **PASS**

**Evidence**

- MapLibre init + style — `CorridorMap.tsx:2–3`, `:309–315`; styles via `mapStyleForTheme` / OpenFreeMap|MapTiler — `corridor.ts:58–70`
- Fleet animation: `setInterval` tick 1500 ms — `CorridorMap.tsx:301–304`; `fleetFc` drifts in-transit — `:17–35`, applied `:348–350`
- Ferry AIS source/layers — `CorridorMap.tsx:204–228`, `:354–355`, `:367–368`
- Client → proxy `:4175/ais` — `ais.ts:38–53` (`${proto}://${host}:4175/ais`); proxy script `scripts/ais-proxy.mjs:10`, `:26`, `:69`; Vite comment `vite.config.ts:64–65`
- Seed fallback on WS fail — `ais.ts:45–46`, `:107–111` (honest “AIS seed” chip `:404`)

**Weakness (not FAIL):** live AIS requires external proxy + key; without it UI correctly stays seed. Animation is sim drift, not GPS — acceptable for START makieta.

---

## Gate 3 — Collapsible nav, glass, logos — **PASS** (UX #18 note)

**Evidence**

- Width 186 ↔ 56 — `Nav.tsx:65`, `:70`; toggle + `aria-expanded` — `:72`, `:137–145`; Topbar hamburger — `Topbar.tsx:47–56`
- Glass — `.wt-glass-chrome` / `.wt-glass-panel` blur — `index.css:125–140`; used on Topbar `:44`, bell `:47/:81`, map chrome, drawer
- Firm logos — `ROLE_META` paths `/logos/hhl.png`, `ksh.svg` / `ksh-white.svg`, `scx.png` / `scx-dark.png` — `permissions.ts:78–95`; files present under `public/logos/`

**UX #18 gap:** SoT wants `sessionStorage.wtNavCollapsed` (`UX_MAP.md` §1.1 / acceptance #18). Code uses **`localStorage` key `wt-nav-collapsed`** — `useTowerStore.ts:219`, `:280–284`. Collapses work; persist contract wrong (survives browser restart, wrong key name).

---

## Gate 4 — Bell mark-read clears badge — **PASS** (model smell)

**Evidence**

- Bell + unread badge — `NotificationBell.tsx:45–77`; count from unread scoped list `:30–33`
- Mark one / mark all — `:91`, `:126` → `markNotificationRead` / `markAllNotificationsRead`
- Store clears from array (filter-out) — `useTowerStore.ts:300–313`; `openNotification` also marks — `:347`
- Seed ≥5 unread — 13× `read: false` in `seed.ts` INITIAL_NOTIFICATIONS

**Adversarial note (UX #19):** Spec is “mark as read” (`read: true`, badge −1). Implementation **deletes** the notification. Badge goes to 0 → gate functional PASS, but history / read-state is wrong. Panel also only lists unread (`!n.read`), so there is no read archive.

Missing UX a11y: no `aria-haspopup="dialog"` on bell button (UX_MAP §1.2).

---

## Gate 5 — KPI / spine / exception deep-links — **FAIL**

**What works**

- `KpiTile` accepts `onClick` — `KpiTile.tsx:6`, `:25`
- Dashboard passes handlers for all role KPI sets — `DashboardView.tsx:58–182`, render `:187–189`
- `ExceptionRow` + `onClick` → `selectLoad` / `setView('risk')` — `DashboardView.tsx:226–232`; component `:9–19`
- Spine segments are buttons that navigate — `CorridorSpine.tsx:38–45`

**Why FAIL (prefer weak → FAIL)**

1. **Spine re-click cannot clear filter (UX_MAP §1 / #20).**  
   `setStageFilter` toggles null when same stage — `useTowerStore.ts:351–352`.  
   Immediately after, `navigateTo({ view: 'map', stage })` **forces `stage` again** — `CorridorSpine.tsx:42–45` + `navigateTo` `:294`.  
   So pressed segment never clears via second click. Dead/broken filter chrome.

2. **KPI “Załadunki 48h” / stage filters may not match spine stage enums** (e.g. `stage: 'LOADING'` vs corridor stages) — deep-link target quality weak; not verified as matching `CorridorStage`.

3. Zero-dead rule broken by spine bug alone → **FAIL** aligned with UX #20.

---

## Gate 6 — Schedule DnD XLSX dry-run → commit — **FAIL**

**Surface looks complete**

- DnD zone `onDragOver` / `onDrop` + file input — `ScheduleView.tsx:103–138`
- Steps upload → map → diff → commit — `:147–210`
- `commitImport` mutates store — `useTowerStore.ts:541+`

**Falsified**

- Dry-run payload is **hardcoded** (`SG-99`, `K-99`, fixed changed id) — `ScheduleView.tsx:39–65`
- Dropped file only sets **filename** (`acceptFile` `:67–75`); **no XLSX parse**, no SheetJS/exceljs, no bytes read
- Matches elite baseline **B6** (“Fake import dry-run | hardcode SG-99”) still open

Theater UI ≠ gate. **FAIL.** (Honest label “symulacja” also absent.)

---

## Gate 7 — ≥62 loads; Kratownice W=3.6; `cover()` — **PASS**

**Evidence**

- `loads.json` length **62** (confirmed via parse)
- Kratownice W=3.6 seeded: `K-01` PERIOD, `K-02`/`K-03` TRIP, `setWidthM: 3.6`
- Dataset also has `REGULATION` on non-krat TSFS loads (`R-01/02`, `D-01/02`) — kinds present in product data
- Classifier special-cases W=3.6 — `permits.ts:59–60`, `:121`, `:195–203`
- **`cover()` implemented** for PERIOD / TRIP / REGULATION / NONE — `permits.ts:352–435`
- Wired in Docs UI — `DocsView.tsx:3`, `:123–156`

**Weakness (not FAIL):** DocsView builds a **synthetic** attachment doc with generous dates / auto-link for TRIP so `cover` usually shows OK — demo of the function, not a hard READY gate from real uploaded docs. Function itself matches PERMIT_ATTACHMENT_RULES product rule block.

REGULATION on W=3.6 krat would be wrong per SoT (TSFS ≤3.50 m); seed correctly uses PERIOD/TRIP for krat.

---

## Gate 8 — `demo-sg14` → SG-14 — **PASS**

**Evidence**

- `DRIVER_TOKENS['demo-sg14'] = 'load-020'` — `seed.ts:692–693`
- `loads.json` `load-020.code === 'SG-14'`
- Driver route resolves token → load — `DriverPwa.tsx:15–16`; store milestones use same map — `useTowerStore.ts:721`

**Falsify:** mapping to wrong id would FAIL; it is not.  
Note: `demo-active` also → `load-020` (same load) — OK for this gate.

---

## Gate 9 — SCX KPI Koszt not KSH Przychód — **PASS**

**Evidence**

- SCX branch KPI includes `'Koszt tyg.'` when `canSeeCost(role)` — `DashboardView.tsx:163–170`
- `'Przychód narast.'` only under KSH + `canSeeRevenue` — `:128–135`
- `canSeeCost`: HHL|SCX — `permissions.ts:25–27`; `canSeeRevenue`: HHL|KSH — `:29–31` (SCX false)
- Finance: SCX sees COST matrix, not REVENUE — `FinanceView.tsx:186–227`

No SCX Przychód tile. **PASS.**

---

## Gate 10 — Dead buttons / hollow modules — **FAIL**

Hollow / theater found (non-exhaustive):

| Spot | Why hollow |
|------|------------|
| `ScheduleView` dry-run | Hardcoded diff; file ignored (Gate 6) |
| `DocsView` “ZIP mock” | Blob text download — `:174–181` |
| `DriverPwa` “Aparat (mock CMR/POD)” | Explicit mock — DriverPwa ~74–79 |
| `RisksView` Plan B | Toast only “Powiadomiono SCX… (mock)” |
| Spine re-click | Filter clear broken (Gate 5) |
| `markNotificationRead` | Deletes vs mark-read semantics |

Many other controls *do* navigate/mutate (tasks, workflows, invoices, geofence edit for HHL). Gate fails on **remaining** dead/theater surfaces that START checklist still treats as must-honest (esp. import).

---

## UX acceptance notes (#18–20)

| # | Spec (UX_MAP) | Static result |
|---|----------------|---------------|
| **#18** Collapsible nav 186↔56, `aria-expanded`, session persist | **PARTIAL** — collapse + a11y OK; persist is `localStorage['wt-nav-collapsed']` not `sessionStorage.wtNavCollapsed` |
| **#19** Bell mark-read clears item / badge −1; mark-all; seed ≥5 | **PARTIAL PASS** — badge clears; mark-all exists; seed 13; but **delete ≠ read**; no `aria-haspopup` |
| **#20** Zero dead KPI/spine/tiles | **FAIL** — spine re-click broken; import theater; see Gates 5/6/10 |

---

## Overall: **FIX**

Not **SHIP**: Gates **5, 6, 10** FAIL; UX #20 FAIL; elite B6 still true.  
Not full **BLOCK** only because core shell (roles, map, AIS wiring, logos, glass, 62 loads, `cover()`, demo-sg14, SCX Koszt) is in place — shippable after targeted fixes, not as “START complete” narrative.

### Top blockers (fix before SHIP)

1. **Real or honestly labeled XLSX dry-run** — stop hardcoding SG-99; parse bytes or stamp UI “symulacja” and strip “dry-run→commit” claims (Gate 6 / B6).
2. **Spine second-click clear** — do not call `navigateTo({ stage })` after toggle-to-null; honor UX filter clear (Gate 5 / #20).
3. **Hollow chrome** — ZIP/camera/Plan-B mocks: either wire or demote copy so they are not presented as live actions (Gate 10).
4. **Nav persist SoT** — `sessionStorage.wtNavCollapsed` per UX #18 (or update SoT if localStorage intentional).
5. **Notification mark-read** — set `read: true` (keep history) instead of deleting; badge from unread count (UX #19).

### Non-blockers (PASS)

Roles without Stegra · MapLibre+fleet+AIS proxy path · glass+logos · `cover()` + 62 loads + Kratownice W=3.6 PERIOD/TRIP · `demo-sg14`→`load-020`/SG-14 · SCX Koszt KPI.
