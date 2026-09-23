# WATCH TOWER — Executive Summary (research pack, Sept 2026)

**Dla:** coordinator / Sebastian  
**Korytarz:** PL załadunek → Gdańsk (Polferries Wawel/Nova Star) → Nynäshamn → E4 → Boden / Stegra  
**Data packu:** 2026-09-23 (Europe/Warsaw)  
**Zakres:** research only — bez zmian w makiecie / kodzie runtime

---

## 1. Teza produktowa

Globalne control towere (project44, FourKites, Shippeo, Transporeon Visibility) sprzedają **sieć + AI agents + exception engine**. Dla Stegra Boden (12–15 userów, 3–4 org, ≥60→100–200 loads) to overkill i zły fit: brak korzyci z „282k carriers”, a potrzeba jest **korytarzowa, multi-party, nienormatywna** (zezwolenia PERIOD/TRIP, SEFS dual-source, prom 1×/dzień, RLS marży).

**Wyróżnik WATCH TOWER:** management-by-exception na jednym korytarzu + role HHL/KSH/SCX/Stegra + document vault z `cover(PERIOD)`/`TRIP` + BAF hybrydowy OKQ8∩ORLEN + workflow Inngest — nie „visibility SaaS”.

## 2. Co wziąć od konkurencji (bez kopiowania fluff)

| Wzorzec | Skąd | Adaptacja WT |
|---|---|---|
| Exception queue severity×time-to-impact | project44 Exceptions Engine | już w UX_MAP — wzmocnić next-action + owner |
| Document agent → vault + AP unblock | FourKites Polly | vault M6 bez „AI agent” marketingu; OCR = P2 |
| Carrier onboarding / data quality | Shippeo Guarantee (marketing) | PWA-first + rFMS stub; quality = completeness % |
| Visibility Hub + dock slot | Transporeon | slot awizacji już jest; dock Stegra = ETA 72h read-only |
| Risk graph (weather/geo) | Everstream | M10: MET Ocean + Trafikverket Situation — nie multi-tier supplier |
| MacroPoint / Trimble visibility | Descartes, Trimble | wzorzec alert+geofence; nie kupować sieci |

**Pricing konkurencji:** prawie zawsze „on request”. Nie cytować „starting $250k” jako fakt rynkowy bez kontraktu — to listing AWS/anegdota.

## 3. API — co jest realne na korytarzu

| Źródło | Status | Uwaga |
|---|---|---|
| **rFMS 5.0** (25.07.2025) | ✅ spec publiczna | OAuth2; OEM-specific host; wymaga grantu właściciela floty |
| **Webfleet.connect** | ✅ docs publiczne | account+user+pass+apikey; commercial Webfleet |
| **Trafikverket Open API v2** | ✅ | key; Situation / RoadCondition / WeatherStation — krytyczne E4 |
| **MET Norway Oceanforecast 2.0** | ✅ | UA obowiązkowy; CC BY 4.0; proxy+cache |
| **SMHI metobs / ocean files** | ✅ częściowo | metobs REST; NEMO GRIB download — nie REST forecast |
| **NBP API** | ✅ | HTTPS-only od 2025-08-01; tabele A/B/C |
| **ORLEN / OKQ8** | ⚠️ HTML listowe | brak oficjalnego public API cen hurtowych — scraper/manual + snapshot |
| **Polferries** | ❌ brak API | rozkład HTML `code=gn/ng`; komunikaty osobna strona; Plan B = ręka + AIS |
| **AIS** | ⚠️ mieszane | AISStream (free key, no SLA); Digitraffic = FI waters; Sjöfartsverket = płatny abonament |

Szczegóły: `03_APIS_VERIFIED.md`.

## 4. ETA / predykcja — bez fake stats

- Segmentuj: PL road · pre-port dwell · ferry schedule · SE road · site approach.  
- Do ~60–100 loads: **deterministyczne** ETA + confidence „schedule/traffic/model” label — nie ML claim.  
- ML quantile/conformal ma sens od **setek** przejazdów per segment; literatura: BISE 2020 intermodal ETA; conformal/uncertainty papers 2025 — cytować ostrożnie.  
- UI: zawsze rozróżniać **model vs deterministic** (gate P1 w QA elite).

## 5. Backlog elite (skrót P0)

1. PERIOD/TRIP/`cover()` + T-48 permit gaps  
2. Exception queue + workflow run log (Inngest HITL)  
3. PWA GPS + adapter stub → rFMS/Webfleet gdy SCX da grant  
4. SEFS dual-source snapshot + NBP FX  
5. Trafikverket Situation overlay + MET wave risk na prom  
6. Factoring E2E na M11  
7. ETA segment breakdown z CI dopiero gdy dane ≥100–200

Pełna mapa: `06_BACKLOG_MODULES.md`. Orders: `07_TEAM_ORDERS.md`.

## 6. Visual / UX 2026

Trzymać **cold steel + amber** z VISUAL_BRIEF; iść dalej w stronę Linear density / Bloomberg ops — nie Inter/indigo SaaS. Anti-AI-slop: zero mesh, zero glass, zero unexplained %. Referencje: Linear UI redesign, Dense Dashboard craft, NDara-style supervised autonomy (evidence+approve).

## 7. Ryzyka researchu (flagi)

- Polferries: **brak** machine-readable status → opóźnienia rejsów = human + komunikaty + AIS MMSI Wawel/Nova Star.  
- Fuel: źródła umowne = strony HTML — legalność scrapingu pod ToS do weryfikacji prawnej.  
- Digitraffic AIS **nie pokrywa** Gdańsk–Nynäshamn (FI).  
- Konkurencyjne % (40% faster exception…) = **marketing** project44 — nie powielać w pitchu WT.

## 8. Pliki packu

| Plik | Treść |
|---|---|
| `01_COMPETITORS.md` | project44…Webfleet + PL TMS |
| `02_UX_UI_2026.md` | trendy + visual direction |
| `03_APIS_VERIFIED.md` | endpointy / auth / license |
| `04_ETA_PREDICTION.md` | segmenty, CI, data volume |
| `05_WORKFLOWS.md` | Inngest / playbooks |
| `06_BACKLOG_MODULES.md` | M1–M12 + factoring + PERIOD/TRIP |
| `07_TEAM_ORDERS.md` | split ról |

**Następny krok użytkownika:** powiedzieć **GO** — wtedy implementacja wg orders, nie research.
