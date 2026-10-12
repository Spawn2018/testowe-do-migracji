# QA_RE_SHIP_FROZEN — adversarial click Re-QA (Claude chrome frozen)

- **When:** 2026-09-23 02:58 CEST (Europe/Warsaw, UTC+2)
- **App:** `http://127.0.0.1:4177/` · bundle `index-BcX7jt0t.js`
- **Chrome rule:** no code/CSS/label changes this turn — functions only exercised
- **SoT:** `FUNCTIONS_UNDER_CLAUDE.md` · `AUDIT_CHAT_REQUIREMENTS.md`
- **Mode:** adversarial click · puppeteer-core · prefer FAIL
- **Shots:** `/workspace/watch-tower-app/shots-qa-reship/`
- **Script:** `scripts/qa-reship-frozen.mjs` (+ probe 6/9 retest)

## Verdict: **SHIP**

| # | Probe | Result |
|---|-------|--------|
| 1 | Drawer Ustalenia: save resources, awizacja, ferry → store | **PASS** |
| 2 | READY blocked without permit; works with cover | **PASS** |
| 3 | Plan B on risk changes ferry + notification | **PASS** |
| 4 | Pobierz paczkę ZIP downloads | **PASS** |
| 5 | HHL Eksport XLSX; KSH Wgraj dry-run path | **PASS** |
| 6 | Factoring HHL edit + SCX select mutates store | **PASS** |
| 7 | WF name / Nowa reguła → notification | **PASS** |
| 8 | Map 5 layers; AIS/Trafikverket live\|seed | **PASS** |
| 9 | Bell mark read; spine 2nd-click clear; KPI deep | **PASS** |
| 10 | Role switch hides/shows money cols | **PASS** |

**Score:** 10/10 PASS → **SHIP**

---

## Evidence (click)

### 1 · Ustalenia saves — **PASS**
- Opened load drawer → tab **Ustalenia** → **Zapisz zasoby** / **Zapisz awizację**
- Persist `watch-tower-ui-v4-closeout`: tractor `QA-TRACTOR-E7HWO`; ferry vessel `Nova Star` + booking `QA-AWIZ-7HWO`; awizacja window set
- Shots: `01-ustalenia-before.png`, `01-ustalenia-after.png`

### 2 · READY ← cover — **PASS**
- **SG-09** (doc gap): **Ustaw READY** `disabled=true`; status stayed `RESOURCES_PENDING`
- Covered load: READY enabled → status became `READY`
- Shots: `02-ready-blocked.png`, `02-ready-covered.png`

### 3 · Plan B — **PASS**
- Risks → **Przelicz** on ferry Plan B
- Load **SG-03** ferry booking `PF-SG-03` → `PLANB-risk-ferry-1`; `PLAN_B_ACTIVATED` event + 3 notifications
- Shots: `03-planb-before.png`, `03-planb-after.png`

### 4 · ZIP download — **PASS**
- Docs **Pobierz paczkę tygodnia** → CDP download `WATCH_TOWER_dokumenty_tydzien.zip` **88031** bytes
- Shot: `04-zip.png`

### 5 · Eksport / Wgraj — **PASS**
- HHL Harmonogram **Eksport XLSX** → `WATCH_TOWER_HHL_harmonogram.xlsx` **13317** bytes
- KSH **Wgraj aktualizację** + upload `ship-qa-unique.xlsx` → dry-run note `0/1 OK` + column map step (path exists)
- Shots: `05-hhl-eksport.png`, `05-ksh-wgraj.png`

### 6 · Factoring HHL + SCX — **PASS**
- HHL Faktury admin: fee `2.5` → `4.2`; label → `QA Factoring 9g3v` (store)
- SCX: radios **Płatność standardowa** / **Factoring**; select Factoring → **Złóż fakturę**
- New invoice `inv-mude9ilc-lta0z` with `factoring.selected=true`, `feePercent=4.2`
- Shots: `06b-factoring-hhl-before.png`, `06b-factoring-hhl-after.png`, `06b-factoring-scx-before.png`, `06b-factoring-scx-after.png`

### 7 · Workflow → notification — **PASS**
- HHL Automatyzacje → **Nowa reguła**
- Notifications `14→15`; workflowRuns `2→3`
- Shots: `07-wf-before.png`, `07-wf-after.png`

### 8 · Map layers + TV/AIS label — **PASS**
- Exactly **5** `.maplayers` labels: Pojazdy, Strefy, Trasa, Ryzyka, Ślad
- Note: `Trafikverket E4: **seed**` · `AIS: **seed**` (honest; no API key)
- Leaflet container present
- Shot: `08-map-layers.png`

### 9 · Bell / spine / KPI — **PASS**
- Bell → **Oznacz wszystkie**: unread `15→0` (history kept)
- Spine **Przygotowanie** 1st click filters (`aria-pressed=true`); 2nd click clears (`aria-pressed` none)
- KPI **Wymaga decyzji** → nav `aria-current=page` on **Ryzyka**; left Kokpit (`H&H Logistics` panel gone)
- Shots: `09-bell-open.png`, `09-bell-after.png`, `09-spine-filtered.png`, `09-spine-cleared.png`, `09b-kpi-deep.png`

### 10 · Role money columns — **PASS**
- Schedule thead by role:
  - **HHL:** Koszt + Przychód + Marża
  - **KSH:** Twoja cena only (no Koszt/Marża)
  - **SCX:** Moja stawka only (no Przychód/Marża)
- Shots: `10-cols-hhl.png`, `10-cols-ksh.png`, `10-cols-scx.png`

---

## Residuals (not FAIL)
- Trafikverket / AIS = **seed** without keys (labeled by design)
- Workflows remain 7 Claude-named rules (visual gate; product wanted 12 = known GAP)
- KSH dry-run on `ship-qa-unique.xlsx` showed `0/1 OK` (reject path still exercises dry-run UI)

## Polish
**SHIP.** All 10 frozen-chrome functional probes click-proven. No code changed this turn.
