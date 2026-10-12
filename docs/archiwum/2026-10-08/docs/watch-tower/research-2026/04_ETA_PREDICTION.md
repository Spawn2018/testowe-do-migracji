# 04 — Prediction / ETA (corridor-aware, no fake stats)

**Principle (CURSOR_PROMPT §12–13):** no invented APIs; no unsourced accuracy %.  
**QA gates:** P1–P4 in `QA_ELITE_UPGRADE_CHECKLIST.md`.

---

## 1. Segment model for PL → SE → Boden

| Segment ID | Bounds (conceptual) | Primary signal | ETA method v0 | ETA method v1 |
|---|---|---|---|---|
| S1 `PL_ROAD` | Load site → Gdańsk port gate | GPS / PWA / rFMS | Distance÷planned speed + rest buffers | Gradient boost / quantile on historical dwell |
| S2 `PRE_PORT` | Gate → check-in / boarding close | Geofence dwell | Fixed buffer + schedule cutoff | Empirical dwell distribution |
| S3 `FERRY` | Departure → Nynäshamn arrival | Polferries timetable + AIS | **Schedule** 18:00→12:00* + vessel WAW/NS | Delay model from AIS SOD/ETA vs schedule |
| S4 `SE_ROAD` | Nynäshamn → Boden approach | GPS + Trafikverket Situation | Distance÷speed + weather slowdown table | Segment travel-time ML |
| S5 `SITE` | Approach geofence → unload | Geofence + Stegra window | Window start; unload buffer | Historical unload duration |

\*Polferries cargo GN timetable shows **18:00–12:00*** pattern with vessels WAW/NS — verify footnotes on live page: https://polferries.com/cargo/cargo-timetable.html?code=gn

**Composition:**  
`ETA_final = t0 + Σ duration_s + Σ buffer_s`  
Recalc on: new position, geofence transition, ferry assignment change, Situation severity on route, schedule import critical date change.

---

## 2. Confidence intervals — what to show

| Stage | Data volume (order of magnitude) | Honest UI | Method |
|---|---|---|---|
| Demo / makieta | seeds | Label **deterministic** / **schedule** | No CI or ± fixed policy buffer |
| ≥60 loads (required) | sparse per segment | **Band from rules** (e.g. +driver break, +ferry slip day) | Not ML |
| ~100–200 loads | thin history | Empirical percentiles **if n≥30 per segment-bin** | Bootstrap / historical residual |
| Hundreds+ per segment | richer | Quantile regression or **conformal** intervals | Calibrated coverage target |

**Never** show a single minute-precision ETA from a model without source tag.

Recommended fields:
```
eta_point
eta_p10 / eta_p90   // or null
eta_method: schedule | deterministic | historical | model
eta_updated_at
eta_inputs[]        // e.g. last_fix, ferry_id, situation_ids
disclaimer: "nie jest gwarancją"
```

---

## 3. Literature & product references (careful citing)

| Source | What it supports | What it does **not** prove for WT |
|---|---|---|
| Servos et al., *An ETA Prediction Model for Intermodal Transport Networks Based on Machine Learning*, BISE / Springer, https://doi.org/10.1007/s12599-020-00653-0 · https://link.springer.com/article/10.1007/s12599-020-00653-0 | Intermodal ML ETA is researched; schedules create hard discontinuities | Any accuracy % on PL–SE steel corridor |
| Uncertainty-aware segment ETA (bus) thesis/paper via DiVA: http://urn.kb.se/resolve?urn=urn%3Anbn%3Ase%3Ahj%3Adiva-72727 | Segment-level risk decomposition, drift | Freight ferry applicability |
| DutyTTE (AAAI): https://doi.org/10.1609/aaai.v39i12.33350 | Multimodal uncertainty / mixture approaches | Deployability in 5-day MVP |
| En-route TTE framework preprint: https://doi.org/10.48550/arxiv.2504.04086 | Efficient en-route estimation | Road freight with permits |
| Vendor “predictive ETA” pages (p44, Shippeo, Transporeon) | Market expectation of continuous recalc | Published, auditable CI on *this* lane |

**Evaluation metrics if/when ML ships:** PICP (coverage), mean interval width, Winkler/MIS — not “accuracy 92%”.

---

## 4. Data volume plan (60 → 100–200)

### Already required: ≥60 loads
Enough to:
- Validate geofence transitions and spine filters.
- Measure **schedule adherence** to ferry cutoff (binary caught / missed).
- Build residual histograms for S1/S4 **if** GPS dense (PWA or telematics).

Not enough for:
- Stable ML per vehicle class / weather bin / weekday.

### Plan for 100–200 loads
| n loads | Enable |
|---|---|
| 60–99 | Rule ETA + manual override log; collect features |
| 100–149 | Per-segment empirical p50/p90 **where n_bin≥30**; ferry on-time rate |
| 150–200 | Simple quantile model candidate offline; A/B vs deterministic in shadow mode |
| 200+ | Consider conformal calibration; still HITL for CRITICAL |

**Feature store (minimal):**
`load_id, segment, t_enter, t_exit, distance_km, night_flag, weather_bin, situation_max_severity, vehicle_class, permit_class, ferry_id, residual_min`

Retention: positions purged per personal-data policy; aggregates OK.

---

## 5. Ferry-specific prediction

1. **Default:** timetable assignment (date → WAW/NS, 18:00 dep).  
2. **Risk layer:** MET Oceanforecast wave height along track (points sampled) → risk score, **not** auto-cancel.  
3. **Live:** AIS MMSI of assigned vessel — SOD vs scheduled dep; ETA to Nynäshamn from AIS if available.  
4. **Failure mode:** Polferries komunikaty page (no API) — human flags `FERRY_DISRUPTION` event.

Do not claim storm thresholds as “armator policy” unless SCX/Polferries provide written limits (QA elite M10).

---

## 6. SE road (E4) prediction inputs

- GPS speed / ETA remaining distance.  
- Trafikverket `Situation` + `RoadCondition` along corridor bbox.  
- WeatherStation temps (ice risk) — qualitative slowdown table, versioned.  
- Driver hours: if unknown, buffer policy — don’t invent tachograph compliance engine in MVP.

---

## 7. Product UX rules

1. Drawer M12: stacked segment bars with method chips.  
2. Kokpit: “at risk of ferry cutoff” boolean from S1+S2 vs boarding close — higher value than ±3 min ETA.  
3. PRE_ARRIVAL mail ~40 min: use **point ETA with method=…** and band if present.  
4. Shadow mode: store model ETA without showing until QA P1–P4 pass.

---

## 8. Uncertainty flags

- Exact boarding cutoff times / cargo gate closes: **[DO WERYFIKACJI]** with Polferries cargo offices.  
- AIS coverage mid-Baltic: satellite vs terrestrial — AISStream has no SLA.  
- Historical n=200 may still be sparse across many permit classes — bin carefully.
