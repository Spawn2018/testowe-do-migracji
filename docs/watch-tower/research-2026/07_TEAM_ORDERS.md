# 07 — Team orders (proposed split) — wait for user GO

Research pack ready under `/workspace/watch-tower/research-2026/`.  
**Do not start implementation until user says GO.**

---

## Coordinator

**Owns:** scope freeze, GO/NO-GO, RLS acceptance, vendor asks (SCX telematics, Polferries contacts), legal note on fuel HTML.

| # | Task | Input | Output |
|---|---|---|---|
| C1 | Read `00_EXEC_SUMMARY.md` + confirm P0 sequence in `06_BACKLOG` | pack | Signed P0 list |
| C2 | Ask SCX: Webfleet vs rFMS OEM + grant path | `03_APIS` | Adapter choice memo |
| C3 | Confirm Polferries boarding/cargo cutoff times | cargo offices | Numbers for W3 ferry rule |
| C4 | Legal: ORLEN/OKQ8 scrape vs manual | BAF_SEFS | Decision |
| C5 | Schedule adversarial QA window | QA checklist | Date |
| C6 | After GO: track DORA-ish: small batches, feature flags | — | Weekly cut |

---

## UX

**Owns:** VISUAL_BRIEF evolution, exception-first IA, role states, anti-slop review.

| # | Task | Refs | Output |
|---|---|---|---|
| U1 | Exception queue row anatomy (one-line) | `02_UX`, UX_MAP §6.1 | Spec + makieta notes |
| U2 | PERIOD/TRIP/REGULATION document UX | PERMIT_ATTACHMENT_RULES | Flows + empty/blocked states |
| U3 | Factoring offer/accept screens | QA M11 | Wire states |
| U4 | ETA drawer: method chips + bands | `04_ETA` | UI copy PL/EN/SV |
| U5 | Evidence strip for workflow proposals | `05_WORKFLOWS` | Component recipe |
| U6 | Visual direction A vs B font decision | `02_UX` §2 | Token PR to VISUAL_BRIEF only (not app code until GO) |
| U7 | Stegra large-type 72h | UX_MAP | Layout |

---

## Frontend

**Owns:** makieta→app fidelity, MapLibre, tables, drawers, i18n — **no research-time code changes now**.

| # | Task (post-GO) | Depends |
|---|---|---|
| F1 | Shell/spine/role switch parity | U1 |
| F2 | Docs vault PERIOD cover UI | U2, data model |
| F3 | Exception queue + keyboard | U1 |
| F4 | Map layers Situation + ferry AIS (consume BFF) | data/API |
| F5 | M9 run log + HITL approve buttons | workflows |
| F6 | Factoring UI | U3 |
| F7 | ETA segment breakdown | U4 |
| F8 | PWA route | M5 |

---

## Data / API

**Owns:** verified integrations, adapters, seeds, BFF proxy (MET UA, AISStream key).

| # | Task | Refs |
|---|---|---|
| D1 | Trafikverket key + Situation poll prototype (scratch, not makieta) | `03` §D |
| D2 | MET Oceanforecast proxy + cache headers | `03` §C1 |
| D3 | NBP client + SEFS snapshot job design | `03` §F, BAF_SEFS |
| D4 | AISStream server client; resolve WAW/NS MMSI | `03` §E |
| D5 | Polferries timetable seed JSON for 60–90 days | HTML gn/ng |
| D6 | rFMS/Webfleet adapter fill after C2 | adapter.ts |
| D7 | Feature store schema for ETA residuals | `04` |
| D8 | `cover(PERIOD)` / TRIP SQL alignment with PERMIT_ATTACHMENT_RULES | M6 |
| D9 | Factoring state machine on invoices | M11 |
| D10 | Inngest functions W1–W12 subset | `05` |

**Constraint:** no invented Polferries/ORLEN APIs; mark blockers.

---

## QA adversarial

**Owns:** elite gates; try to break RLS, permit cover, factoring, ETA honesty.

| # | Task | Gate |
|---|---|---|
| Q1 | Execute `QA_ELITE_UPGRADE_CHECKLIST.md` D4/D5 PERIOD/TRIP | FAIL if cover wrong |
| Q2 | Role matrix prices: Stegra never sees money/PII | RLS |
| Q3 | Factoring fee edge cases | M11 elite |
| Q4 | ETA without method label = FAIL | P1 |
| Q5 | Workflow double-fire emails | Idempotency |
| Q6 | Map Situation layer: poisoned/unexpected payload | Resilience |
| Q7 | PWA token brute/expiry | Security |
| Q8 | At 100 loads: performance table/map | Perf budget |

Deliver: written FAIL/PASS with repro; no “seems fine”.

---

## Research (this role — ongoing)

| # | Task | When |
|---|---|---|
| R1 | Refresh API ToS if blocked | on GO integration |
| R2 | Capture public UX refs only (no login scrape) | as needed |
| R3 | MMSI + ferry komunikaty monitoring method | with D4 |
| R4 | Update pack if SCX names telematics vendor | after C2 |
| R5 | Do **not** modify running makieta in research turns | standing |

---

## RACI snapshot

| Deliverable | C | UX | FE | Data | QA | Res |
|---|---|---|---|---|---|---|
| P0 scope | A | C | C | C | C | I |
| Visual tokens | C | A | C | I | I | C |
| PERIOD/TRIP | C | A | R | R | A | C |
| Telematics | A | I | C | A | C | C |
| ETA honesty | C | A | R | R | A | C |
| Factoring | A | C | R | R | A | I |
| Live SE risk layers | C | C | R | A | C | C |

A=accountable R=responsible C=consulted I=informed

---

## Definition of ready for GO

- [ ] Coordinator signed P0 list  
- [ ] SCX telematics path known or explicit “PWA-only until date”  
- [ ] Ferry cutoff numbers or explicit assumptions documented  
- [ ] Fuel ingest legal decision  
- [ ] QA window booked  

Until then: research pack is the artifact; makieta code untouched.
