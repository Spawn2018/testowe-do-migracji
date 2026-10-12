# 03 — Real APIs verified for corridor PL → ferry → Boden

**Rule:** no invented endpoints. Each row: status · endpoint · auth · license/constraints · WT use.  
**Fetched/verified window:** 2026-09-23 (sources may change).

Legend: ✅ verified primary docs · ⚠️ partial / HTML-only · ❌ no public API found · 🔶 commercial contract

---

## A. Telematics

### A1. rFMS 5.0 (OEM Remote FMS)

| Field | Value |
|---|---|
| Status | ✅ Spec public (2025-07-25) |
| Docs | https://www.fms-standard.com/Truck/down_load/download_ok.htm |
| Spec PDF | https://www.fms-standard.com/Truck/down_load/Technical_Specification_rFMS_vehicle_data_V5.0.0_25.07.2025.pdf |
| Auth PDF | https://www.fms-standard.com/Truck/down_load/API%20rFMS%20Authorization%20V.1.1.0.pdf (listed as API rFMS Authorization V.1.1.0) |
| Bundle | `rFMS_5_0.zip` (OpenAPI 3.0 YAML authoritative) |
| Auth | OAuth2 per rFMS Authorization (RFC 6749): Authorization Code and/or Client Credentials after resource-owner grant |
| Endpoints (logical) | HTTPS REST JSON: vehicles list, vehicle positions, vehicle statuses; **v5 adds push subscriptions** alongside pull (`starttime`/`stoptime`/`latestOnly`) |
| Host | **OEM-specific** (Scania, Volvo Trucks, …) — not a single global base URL |
| License | Spec download via FMS-Standard; **data access requires OEM customer agreement + vehicle owner grant** |
| Commercial | Per OEM / fleet owner; WT needs SCX (or HHL if fleet) to authorize client |
| SDK note | Community Go SDK examples: https://github.com/way-platform/rfms-go (Scania/Volvo patterns) — not official |
| WT use | Fill `adapter.ts` rFMS stub after meeting; pull positions 5–10 min or push if offered |

**Uncertainty:** Exact production base URLs differ by OEM portal — obtain from SCX telematics admin, do not guess.

### A2. Webfleet.connect (TomTom Telematics)

| Field | Value |
|---|---|
| Status | ✅ Developer portal + versioned docs |
| Portal | https://www.webfleet.com/en_us/webfleet/partners/integration/developer-resources/ |
| Protocol notes | https://flespi.com/protocols/webfleet-connect (third-party summary) |
| Endpoint (classic) | `https://csv.telematics.tomtom.com/extern` (CSV/JSON actions) |
| Auth | `account`, `username`, `password`, `apikey` query/body params; dedicated WEBFLEET.connect account recommended |
| Key actions | `showObjectReportExtern` (lat/lon microdegrees, pos_time); queues e.g. `popQueueMessagesExtern` for event-driven |
| Coords | Integer microdegrees → ÷ 1e6 for WGS84 |
| License | Customer/partner API key via Webfleet support / .connect Partner Program |
| Commercial | 🔶 Requires Webfleet subscription + API access approval |
| WT use | If SCX fleet is on Webfleet — preferred over scraping; map into GENERIC_REST/Webfleet adapter |

### A3. Driver PWA (first-party)

| Field | Value |
|---|---|
| Status | ✅ Product path (not third-party API) |
| Auth | Per-load token URL `/driver/:token` |
| Constraints | Personal data; retention `purge_personal_data()`; consent UX |
| WT use | **P0** independent of OEM — CURSOR_PROMPT mandate |

---

## B. Ferry — Polferries (Gdańsk ↔ Nynäshamn)

| Field | Value |
|---|---|
| Status | ❌ **No public machine API found** |
| Timetable HTML | GN: https://polferries.com/cargo/cargo-timetable.html?code=gn · NG: `?code=ng` · PL: https://polferries.pl/cargo/rozklad.html?code=gn |
| Observed pattern (Sept 2026 page) | Dep 18:00 → Arr 12:00*; vessels **WAW** (Wawel), **NS** (Nova Star); blank cells = no sailing that day |
| Disruption komunikaty | https://polferries.pl/faq/komunikaty-kursowania-promow.html |
| Booking | Form / cargo offices — e.g. cargo.gdansk@polsca.com · +48 58 343 02 12 |
| Auth/License | N/A API; HTML ToS/cookies apply if scraping |
| WT approach | (1) Seed/import timetable manually or semi-parse HTML **[legal review]** (2) Human event `FERRY_DISRUPTION` (3) AIS track assigned MMSI (4) Plan B sailings as ops data |

**Do not invent** `/api/sailings` for Polferries.

---

## C. Marine weather

### C1. MET Norway — Oceanforecast 2.0

| Field | Value |
|---|---|
| Status | ✅ |
| Docs | https://api.met.no/weatherapi/oceanforecast/2.0/documentation |
| Data model | https://docs.api.met.no/doc/oceanforecast/datamodel.html |
| Example | `https://api.met.no/weatherapi/oceanforecast/2.0/complete?lat=60.10&lon=5` |
| Auth | **No API key**; mandatory identifying **User-Agent** (app + contact). Missing/banned UA → 403 |
| ToS | https://docs.api.met.no/doc/TermsOfService.html — identify; cache/`Expires`; ≤20 req/s without agreement; proxy recommended; no Yr branding |
| License | CC BY 4.0 attribution — https://docs.api.met.no/doc/License.html |
| Coverage | NW Europe ocean points; land→snap to sea; outside model → 422 |
| WT use | Sample points along Gdańsk–Nynäshamn track for wave height / water speed → M10 FERRY risk (**config thresholds**, not “armator fact”) |

### C2. SMHI

| Field | Value |
|---|---|
| Status | ✅ / ⚠️ mixed products |
| Open Data portal | https://opendata.smhi.se/ |
| Met observations REST | Pattern: `https://opendata-download-metobs.smhi.se/api/version/latest/parameter/{id}/station-set/all/period/latest-hour/data.json` (and station-specific variants) — confirm parameter IDs in portal docs |
| Marine forecast files | NEMO-Nordic short-range GRIB via data-download (e.g. oceanography/nemo-nsbs01-short) — **file download**, not simple JSON forecast API |
| Sea level pages | https://www.smhi.se/data/hav-och-havsmiljo/havsvattenstand |
| License | SMHI open data licenses (check per dataset; typically attribution) |
| WT use | Backup/complement MET for SE coastal; road weather via Trafikverket WeatherStation often enough for E4 |

---

## D. Swedish road — Trafikverket Open API

| Field | Value |
|---|---|
| Status | ✅ |
| Official | https://www.trafikverket.se/e-tjanster/trafikverkets-oppna-api-for-trafikinformation/ |
| Console/docs | https://api.trafikinfo.trafikverket.se/ |
| Trafiklab mirror guide | https://www.trafiklab.se/api/other-apis/trafikverket/ |
| Endpoint | `POST https://api.trafikinfo.trafikverket.se/v2/data.json` (or `.xml`) |
| Auth | `authenticationkey` in XML `<LOGIN>` — register + accept license on Trafikverket (or Trafiklab key) |
| Content-Type | `application/xml` \| `text/xml` \| `text/plain` (v2) |
| Object types (road-relevant) | `Situation`, `RoadCondition`, `RoadConditionOverview`, `WeatherStation` (+ rail types unused) |
| Coords | SWEREF 99 TM + WGS84 geometries |
| License | Trafikverket API license (accept on registration); rate monitored |
| Lastkajen (NVDB packs) | Separate Bearer API https://lastkajen.trafikverket.se/ — for static road data packs, not live Situations |
| WT use | M3 map layer + M10 ROAD_SE; filter bbox corridor Nynäshamn→Boden |

Example shape (key redacted):
```xml
<REQUEST>
  <LOGIN authenticationkey="YOUR_KEY"/>
  <QUERY objecttype="Situation" schemaversion="1" limit="100">
    <FILTER><!-- geographic / time filters per docs --></FILTER>
  </QUERY>
</REQUEST>
```

---

## E. AIS streams

### E1. AISStream

| Field | Value |
|---|---|
| Status | ✅ |
| Docs | https://aisstream.io/documentation · site https://aisstream.io/ |
| Endpoint | `wss://stream.aisstream.io/v0/stream` |
| Auth | Free API key (GitHub login); **server-side only** (no browser) |
| Subscribe | JSON within 3s: `APIKey`, `BoundingBoxes` required; optional `FiltersShipMMSI`, `FilterMessageTypes` |
| Limits | 3 connections/account; 3/IP; 1 subscription update/s; no SLA; drop if slow consumer; Sept 2026+ bandwidth limits if uncompressed |
| License/commercial | Free tier with limits; verify current ToS on account page for redistribution |
| WT use | Track ferry MMSI in bbox southern Baltic; infer underway / ETA soft signal |

### E2. Digitraffic (Fintraffic) AIS

| Field | Value |
|---|---|
| Status | ✅ but **Finnish waters focus** |
| Docs | https://www.digitraffic.fi/en/marine-traffic/ |
| REST | `https://meri.digitraffic.fi/api/ais/v1/locations` · vessels metadata `/api/ais/v1/vessels` |
| MQTT | `wss://meri.digitraffic.fi:443/mqtt` topics `vessels-v2/{mmsi}/location` |
| Auth | Open; identify client sensibly |
| WT use | **Low** for Gdańsk–Nynäshamn corridor — do not rely on FI AIS for PL–SE ferry |

### E3. Sjöfartsverket AIS (Sweden)

| Field | Value |
|---|---|
| Status | 🔶 Paid subscription — not open API |
| Info | https://www.sjofartsverket.se/sv/tjanster/transporter-och-farleder2/bygg-och-teknik/teckna-abonnemang-for-att-fa-ais-information/ |
| Historical RAIS | Orderable datasets — not realtime free |
| WT use | Optional upgrade if AISStream insufficient mid-sea |

### E4. AISHub / MarineTraffic / Spire

| Provider | Status | Note |
|---|---|---|
| AISHub | ⚠️ reciprocal | https://www.aishub.net/api — typically contribute feed; poll limits |
| MarineTraffic / Spire | 🔶 commercial | Enterprise contracts; good coverage **[pricing opaque]** |

---

## F. FX & fuel (BAF / SEFS)

### F1. NBP Web API

| Field | Value |
|---|---|
| Status | ✅ |
| Docs | https://api.nbp.pl/en.html |
| Base | `https://api.nbp.pl/api/` |
| Examples | `.../exchangerates/tables/a/` · `.../exchangerates/rates/a/eur/` · `.../rates/a/sek/last/10/?format=json` |
| Auth | None |
| Constraints | HTTPS only (HTTP ended 2025-08-01); max 93-day range per query; 404 if no table |
| License | Public NBP service — attribute as NBP; check any usage notes on site |
| WT use | EUR/PLN/SEK for reporting; engine already knows `NBP_A_PERIOD_AVERAGE` pattern |

### F2. ORLEN Ekodiesel (PL) — SEFS source

| Field | Value |
|---|---|
| Status | ⚠️ **HTML wholesale page — no official public API verified** |
| Page | https://www.orlen.pl/pl/dla-biznesu/hurtowe-ceny-paliw (EN: `/en/for-business/fuel-wholesale-prices`) |
| Third-party “ORLEN API” listings | Unofficial scrapers — **do not treat as sanctioned API** |
| WT use | Weekly manual or approved scrape → snapshot `price_pln`; fallback last multiplier per contract |

### F3. OKQ8 GoEasy Diesel (SE) — SEFS source

| Field | Value |
|---|---|
| Status | ⚠️ **HTML B2B price list — no official public API verified** |
| Page | https://www.okq8.se/foretag/priser/ |
| Related | Consumer drivmedel https://www.okq8.se/pa-stationen/drivmedel/ — not the contractual GoEasy list |
| WT use | Same as ORLEN — weekly average Mon–Sun; `min(mult_sek, mult_pln)` |

**Legal flag:** scraping fuel sites → review ToS + robots; prefer email/CSV from supplier if offered.

---

## G. Integration priority matrix

| Priority | Source | Blocks |
|---|---|---|
| P0 | PWA positions | Live map without OEM |
| P0 | Trafikverket Situation | SE road risk layer |
| P0 | NBP | FX display / averages |
| P0 | Polferries timetable **manual seed** | Ferry spine |
| P1 | MET Oceanforecast | Ferry wave risk |
| P1 | Webfleet **or** rFMS (whichever SCX grants) | Replace PWA when available |
| P1 | AISStream ferry MMSI | Live ferry track |
| P2 | SMHI metobs / NEMO files | Enrichment |
| P2 | Sjöfartsverket AIS paid | Coverage upgrade |
| P3 | ORLEN/OKQ8 automation | SEFS ops time-save |

---

## H. Explicit non-APIs (do not invent)

- Polferries sailing status REST  
- Official ORLEN/OKQ8 JSON price API (not found in primary docs)  
- Single pan-Baltic free government AIS covering full GN route  
- “Stegra yard API” — none in research; Stegra = read-only WT role  

---

## I. Verification checklist for data/API engineer

1. Register Trafikverket key; POST Situation bbox test.  
2. Curl MET Oceanforecast with proper UA; confirm 200 + attribution footer in app.  
3. Ask SCX: Webfleet? rFMS OEM? share grant path.  
4. Resolve Wawel + Nova Star MMSI; AISStream bbox test server-side.  
5. Legal note on fuel HTML ingestion.  
6. Document timetable seed process for monthly Polferries HTML.
