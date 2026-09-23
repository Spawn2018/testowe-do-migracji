# 06 — Module expansion backlog (elite DORA-enterprise bar)

**Baseline modules:** M1–M12 per UX_MAP + CURSOR_PROMPT  
**Extras in scope:** **Factoring** (on M11), **Permit PERIOD/TRIP/REGULATION** (on M6 + attachment rules)  
**Data volume:** ≥60 loads required now; plan features for **100–200** loads.

Priority: **P0** = elite MVP bar · **P1** = next slice · **P2** = later / research-gated

---

## Cross-cutting data volume needs

| Capability | Min loads / samples | Notes |
|---|---|---|
| Exception UX polish | 60 seeded diverse states | Not ML |
| Ferry cutoff detector | ≥20 loads with ferry assignment | Binary metric |
| Empirical ETA bands | ≥30 exits per segment bin | See `04_ETA_PREDICTION.md` |
| SEFS weekly automation test | 8+ weeks snapshots | Time, not load count |
| Permit cover() stress | ≥1 PERIOD spanning many loads + ≥1 TRIP | QA D4/D5 |
| Factoring E2E | ≥3 invoice weeks | Fee edge cases |
| Shadow ML ETA | 100–200 corridor completions | Offline first |

---

## M1 — Harmonogram

| Pri | Feature |
|---|---|
| P0 | Dry-run diff + criticalDateChanges notify (already scoped) |
| P0 | Template memory per KSH Admin |
| P1 | Multi-file week import; conflict resolver UI |
| P1 | S-curve plan vs confirmed after import |
| P2 | SharePoint one-way watcher (rejected bidirectional) |

**Data:** 60+ rows/import stress; 100–200 cumulative version history.

---

## M2 — Lista + panel transportu

| Pri | Feature |
|---|---|
| P0 | Exception-oriented columns: next action, severity gut, docs gap, ferry risk chip |
| P0 | Virtualized ≥60; role column RLS hide |
| P1 | Saved views per role; keyboard j/k |
| P1 | Bulk assign SCX (HHL) with margin preview |
| P2 | Deck.gl historical replay (CURSOR backlog) |

---

## M3 — Mapa

| Pri | Feature |
|---|---|
| P0 | Split 60/40 + layers: vehicle, trail, planned route (permit geom), geofence, ferry, SE Situations |
| P1 | Trafikverket Situation live layer |
| P1 | AIS ferry vessel layer (server proxy) |
| P2 | Weather particles / wave overlay (keep subtle) |

---

## M4 — Geofence

| Pri | Feature |
|---|---|
| P0 | UI on existing `0002` engine; 12+ corridor zones |
| P1 | Permit-route corridor as read-only polygon import |
| P2 | Auto-suggest dwell thresholds from 100+ transitions |

---

## M5 — Pozycje / PWA

| Pri | Feature |
|---|---|
| P0 | PWA token, GPS share, 4 milestones, camera mock→storage |
| P0 | Adapter stubs rFMS + Webfleet/GENERIC_REST |
| P1 | Live OEM when SCX grants |
| P1 | Offline queue for milestones |
| P2 | Tachograph-aware break suggestions (careful legally) |

---

## M6 — Dokumenty (+ PERIOD / TRIP / REGULATION)

SoT: `PERMIT_ATTACHMENT_RULES.md`

| Pri | Feature |
|---|---|
| P0 | Categories + deadlines + ZIP + signed URL TTL |
| P0 | `permit_fits()` banner/block |
| P0 | **`cover(PERIOD)`** auto-OK docs for loads in validity ∩ dimension limits |
| P0 | **TRIP** per-load (or 14/30-day V window multi-cover rules) |
| P0 | **REGULATION** checklist (TSFS 36/37) without PDF permit |
| P0 | T-48 missing cover alert; PERIOD expiry ≤14d |
| P1 | Vehicle reg + route binding on PERIOD/TRIP |
| P1 | Versioned permit supersede |
| P2 | OCR assist (Tesseract rejected for MVP quality — cloud OCR only if proven) |

**Data:** mix PERIOD spanning ≥10 loads; TRIP one-to-one; V multi-window edge cases.

---

## M7 — Cennik / BAF / marża

| Pri | Feature |
|---|---|
| P0 | SEFS dual OKQ8/ORLEN + min multiplier snapshot on load |
| P0 | Waterfall + below-threshold flag; RLS tables |
| P1 | NBP FX stamp on snapshot |
| P1 | Ferry surcharge line separate from SEFS (don’t mix) |
| P2 | Semi-auto fuel HTML ingest with legal OK |

---

## M8 — Dashboardy

| Pri | Feature |
|---|---|
| P0 | ≤6 KPI/role + exception queue |
| P1 | SCX task SLA widget; HHL audit feed |
| P1 | Stegra large-type 72h arrivals |
| P2 | Carrier data-quality % (position freshness) |

---

## M9 — Workflow

| Pri | Feature |
|---|---|
| P0 | 7+ seed rules; toggle; run log |
| P0 | Inngest durable steps + HITL for Plan B / invoice |
| P1 | Escalation ladder L0–L3 |
| P1 | Fact trace viewer |
| P2 | Soft “suggested rule” from frequent manual actions (not auto-enable) |

---

## M10 — Ryzyka

| Pri | Feature |
|---|---|
| P0 | Types FERRY / ROAD_SE / DOC / OPS + severity + Plan B |
| P1 | MET wave + configurable thresholds (not armator fact) |
| P1 | Trafikverket-driven ROAD_SE |
| P2 | Everstream-like external news — out of scope unless feed verified |

---

## M11 — Faktura zbiorcza + **Factoring**

| Pri | Feature |
|---|---|
| P0 | Weekly creator; expected vs billed; MATCHED/DISPUTED; HHL Accept/Dispute |
| P0 | **Factoring:** HHL offer → SCX select → Accept → `payoutStatus=SCHEDULED` |
| P1 | Fee% / delay edge cases (0%, disabled offer, high fee) — QA elite |
| P1 | Doc-complete gate before factoring eligibility |
| P2 | KSeF (explicitly later per UX_MAP) |

---

## M12 — ETA

| Pri | Feature |
|---|---|
| P0 | Segment breakdown; refresh on status; method label deterministic/schedule |
| P1 | Rule-based bands; ferry cutoff risk boolean |
| P1 | Shadow model store at 100+ loads |
| P2 | Quantile/conformal UI when calibrated |

---

## Ranking — top P0 sequence for GO

1. M5 PWA + event projection  
2. M6 PERIOD/TRIP/`cover()` + T-48  
3. M2/M8 exception queue elite  
4. M9 Inngest seeds W1–W12 subset  
5. M7 SEFS snapshot + M11 invoice/factoring  
6. M3/M10 Trafikverket + MET  
7. M12 segment ETA honest labels  
8. Telematics adapter fill when grant arrives  

---

## Out of scope reminders

KSeF, Stripe, bidirectional SharePoint, React Flow builder, Tesseract OCR, Chromium telematics scrape — per CURSOR_PROMPT rejected list.
