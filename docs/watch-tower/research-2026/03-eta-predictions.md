# WATCH TOWER — ETA segmentowe (MVP) + czego nie obiecywać

**Data:** 2026-09-23 (Europe/Warsaw)  
**Powiązanie:** pogłębia i operacjonalizuje [`04_ETA_PREDICTION.md`](./04_ETA_PREDICTION.md) — **nie sprzeczne**; tam: model segmentów, CI, literatura, plan n=60→200. Tu: design MVP pod spine `LOADING → PORT → FERRY → SE_ROAD → SITE`, wejścia, failure modes, vendor patterns, mapping do UX M12.  
**Źródła API:** [`02-corridor-pl-se-apis.md`](./02-corridor-pl-se-apis.md)  
**Zasada:** zero wymyślonych % dokładności; każda ETA ma `eta_method` + disclaimer.

Spine produktowy (UX_MAP / CURSOR): Plan → Załadunek → Do portu → Prom → SE road → Podejście → Plac.  
W silniku ETA MVP łączymy w **5 segmentów obliczeniowych** (jak w 04, z aliasami UX):

| ID silnika | Alias UX / event | Odpowiednik 04 |
|---|---|---|
| `LOADING` | Załadunek (geofence KSH Śrem) | przed S1 (dwell) |
| `PORT` | Do portu + PRE_PORT (brama / check-in) | S1 `PL_ROAD` + S2 `PRE_PORT` |
| `FERRY` | Prom Gdańsk → Nynäshamn | S3 `FERRY` |
| `SE_ROAD` | E4 Nynäshamn → podejście Boden | S4 `SE_ROAD` |
| `SITE` | PRE_ARRIVAL + plac Stegra | S5 `SITE` |

---

## 1. Jak vendorzy liczą multimodal ETA (road + wait + sail + road)

Wzorce rynkowe (p44, Shippeo, Transporeon, FourKites itd. — **opis behawioralny**, nie audyt ich CI):

1. **Segmentacja hard-mode** — każdy leg ma własny zegar; suma = ETA końcowa; przesiadki (prom, terminal) to **dyskretyzacja** (cutoff), nie ciągła interpolacja.
2. **Schedule-anchored legs** — dla promu / slotu terminala punkt ETA = rozkład + korekta opóźnienia (AIS, komunikat, status bramy), nie „średnia prędkość morza”.
3. **En-route refresh** — po nowej pozycji GPS przelicz tylko **otwarte** segmenty; zamknięte (np. już wypłynięty prom) trzymają timestamp eventów.
4. **Uncertainty productization** — band / confidence chip zamiast jednej minuty; HITL przy CRITICAL.
5. **Exception > minutowa precyzja** — „ryzyko cutoff promu” i Situation na E4 mają wyższą wartość biznesową niż ±3 min.

Literatura wspierająca segmentację / niepewność (bez przenoszenia % na korytarz WT) — jak w 04 §3: Servos et al. (BISE intermodal ML), DutyTTE (uncertainty), segment bus thesis DiVA. **Żaden z tych źródeł nie kalibruje PL–SE oversize.**

---

## 2. Model MVP (deterministyczny) — formuła

Zgodnie z 04:

```
ETA_final = t_ref + Σ duration_segment + Σ buffer_policy
```

- `t_ref` = teraz (Europe/Warsaw) albo czas ostatniego `load_event` kotwiczącego segment.
- Recalc przy: nowa pozycja PWA, przejście geofence, zmiana awizacji rejsu, Situation severity na trasie, import harmonogramu (data krytyczna), ręczny override SCX/HHL.
- **v0 = reguły + rozkład**; v1 = empiryczne percentyle dopiero gdy `n_bin ≥ 30` (04 §2–4). Makieta: label **deterministic** / **schedule**.

### Pola kontraktu (M12) — bez zmian względem 04

```
eta_point
eta_earliest / eta_latest   // band z policy; p10/p90 dopiero przy historii
eta_method: schedule | deterministic | historical | model
confidence: LOW | MED | HIGH   // heurystyka regułowa, NIE % modelu
eta_updated_at
eta_inputs[]                 // last_gps, ferry_id, situation_ids, weather_bin…
disclaimer: "nie jest gwarancją / not a guarantee"
```

`confidence` w MVP:
- **HIGH** — segment kotwiczony eventem (np. `FERRY_DEPARTED`) lub świeży GPS &lt; X min + brak Situation.
- **MED** — GPS OK, brak live Situation, bufory standardowe.
- **LOW** — brak GPS, cutoff promu niepotwierdzony, Situation HIGH, luka w awizacji, overnight bez pozycji.

---

## 3. Segmenty — wejścia, duration, failure modes

### 3.1 `LOADING` (załadunek KSH Śrem)

| | |
|---|---|
| **Bounds** | Wejście geofence LOADING → event `DEPARTED` / wyjście geofence |
| **Wejścia** | Geofence dwell; milestone PWA; fotki mocowania/CMR (status docs, nie ETA); planowane okno KSH |
| **Duration v0** | `max(0, window_end - now)` + stały buffer załadunku **konfigurowalny** (parametr ops, nie hardcode „prawdy”) **albo** residual z czasu wejścia jeśli już na placu |
| **ETA wyjścia** | `t_loading_exit = now + remaining_load_buffer` |
| **Failure modes** | Brak geofence hit → trzymaj plan okna; docs incomplete nie zmienia fizyki, ale blokuje READY (workflow); oversize mocowanie dłuższe — override ręczny |

**Nie obiecywać:** predykcji czasu mocowania z wymiarów zestawu bez historii.

---

### 3.2 `PORT` = droga PL + PRE_PORT (Śrem → brama / check-in Gdańsk)

Alias UX: „Do portu”. W 04: S1+S2.

| | |
|---|---|
| **Bounds** | `DEPARTED` → geofence port / check-in / boarding-close |
| **Wejścia** | PWA GPS; dystans po trasie planowanej (ORS `driving-hgv` lub dystans polilinii zezwolenia); planowana prędkość średnia **policy** (osobno day/night); odpoczynki kierowcy jako **buffer policy** jeśli brak tachografu; GDDKiA Situation/DATEX gdy dostępne (P2); IMGW ostrzeżenia (opc.) |
| **Duration v0** | `distance_km / v_planned + rest_buffers + traffic_penalty_table` |
| **Cutoff logic (ważniejsze niż minuta)** | `t_port_arrive + pre_port_dwell ≤ boarding_close` → boolean **at_risk_ferry_cutoff** |
| **PRE_PORT dwell** | Stały buffer v0; empiryczny dopiero z historii (04 S2) |
| **Failure modes** | Brak GPS → trzymaj last ETA + LOW confidence; objazd zezwolenia kat. V ≠ ORS truck route — **preferuj polilinię z permit** gdy jest; brak znanego `boarding_close` → **[DO WERYFIKACJI]** z cargo Polferries (04 §8) — użyj konserwatywnego parametru oznaczonego `unverified_cutoff` |

**Źródła (02):** ORS HeiGIT HGV; KPD DATEX (później); PWA.

---

### 3.3 `FERRY` (Gdańsk → Nynäshamn)

| | |
|---|---|
| **Bounds** | Odejście (plan lub event) → przyjazd Nynäshamn (plan lub AIS/event) |
| **Wejścia** | Awizacja SCX (`ferry_id`, data, WAW/NS); rozkład Polferries (HTML / cargo timetable — **BRAK API**); komunikaty kursowania; opc. AIS MMSI; Open-Meteo Marine `wave_height` (risk layer) |
| **Duration v0** | **Schedule-anchored:** typowo **18:00 → +1d 12:00** (zweryfikowany wzorzec HTML 2026-09-23) = ~18 h leg; korekta tylko gdy komunikat/AIS poda inne SOD/ETA |
| **Risk layer** | Score fal / wiatru → UI Ryzyka M10; **nie** auto-cancel; progi dopiero po pisemnej polityce SCX/Polferries |
| **Failure modes** | Anulacja/opóźnienie tylko ze strony komunikatów lub telefonu → event `FERRY_DISRUPTION` (HITL); AIS mid-Bałtyk bez SLA (04); brak API → polling HTML tylko za zgodą ToS |

**Po `FERRY_DEPARTED`:** `eta_point` przyjazdu = schedule/AIS; segment drogi PL zamknięty.

---

### 3.4 `SE_ROAD` (Nynäshamn → podejście Stegra / E4 ~900 km)

| | |
|---|---|
| **Bounds** | `PORT_IN` Nynäshamn / wyjazd z terminala → geofence PRE_ARRIVAL (~50 km) lub SITE approach |
| **Wejścia** | PWA GPS; dystans residual; Trafikverket `Situation` + `RoadCondition` + opc. `WeatherStation` w bbox E4; tabela spowolnień pogodowych **versioned** (np. ice/snow bin → mnożnik); ograniczenia z dispensy / TSFS (nie silnik tachografu) |
| **Duration v0** | `remaining_km / v_se + situation_delay_table + weather_slowdown + rest_buffers` |
| **Situation delay** | Mapowanie severity → dodane minuty (parametry ops); brak Situation = 0 |
| **Failure modes** | Oversize + dispensa: trasa Trix ≠ najszybsza HGV; zimowe zamknięcia / kolonnkörning; luka GPS w Norrland → LOW + ostatni bearing; nie inventować compliance godzin jazdy |

**Źródła (02):** Trafikverket Open API; SMHI SNOW1gv1; ORS/MapTiler odległość.

**PRE_ARRIVAL mail (~40 min):** użyj `eta_point` + band policy + `eta_method` (zgodnie z UX_MAP / 04 §7) — **mid bandu lub conservative**, nigdy „gwarantowane 40 min”.

---

### 3.5 `SITE` (podejście → rozładunek Stegra Boden)

| | |
|---|---|
| **Bounds** | PRE_ARRIVAL / approach → `UNLOADED` |
| **Wejścia** | Geofence SITE (65.80539, 21.75914); okno Stegra; dwell history (później) |
| **Duration v0** | Czas do `window_start` jeśli early; + stały unload buffer; late = `now + unload_buffer` |
| **Failure modes** | Okno przesunięte przez Stegra (HITL); kolejka na placu nieznana bez sygnału site; POD 24h to workflow docs, nie ETA |

---

## 4. Składanie multimodalne (pseudokod)

```
function recompute_eta(load):
  segs = []
  if not departed_loading:
    segs += loading_remaining(load)
  if not in_ferry_leg:
    segs += port_road_and_preport(load)   # includes cutoff risk flag
  if ferry_assigned:
    segs += ferry_schedule_leg(load)      # method=schedule
  if ferry_arrived_or_skip:
    segs += se_road_remaining(load)       # Trafikverket modifiers
  segs += site_unload(load)

  eta_point = sum_end(segs)
  band = policy_band(load, segs)          # NOT ML in MVP
  confidence = min(seg.confidence)
  return { eta_point, band, confidence, eta_method, eta_inputs, disclaimer }
```

**Kotwice eventów (przykłady):** `DEPARTED`, `PRE_PORT`, `FERRY_WAITING`, `FERRY_DEPARTED`, `FERRY_ARRIVED`, `PORT_IN`, `PRE_ARRIVAL`, `SITE`, `UNLOADED` — ETA przeszłych segmentów = timestamps eventów, nie re-estymacja.

---

## 5. Band / confidence bez fałszywych %

| Faza danych | Co wolno pokazać | Czego nie |
|---|---|---|
| Makieta / demo | deterministic + schedule; ± stały policy buffer | „92% accuracy”, p10/p90 z n=3 |
| ≥60 ładunków | Rule band (przerwa, slip day promu, Situation) | ML CI |
| n_bin ≥ 30 na segment | Empirical p50/p90 w tym binie | Globalny % na cały korytarz |
| Shadow model | Zapis w DB, UI off do QA P1–P4 | Pokazywanie jako „AI ETA” |

Metryki ewaluacji **gdy** kiedyś ML: PICP, szerokość interwału, Winkler/MIS (04 §3) — nie marketingowe „accuracy”.

---

## 6. Czego **NIE** obiecywać (checklista sprzedaż/UX)

1. **Gwarantowanej minuty** przyjazdu na plac / do cutoff promu.  
2. **Procentowej dokładności** modelu na korytarzu Stegra bez kalibracji.  
3. **Auto-cancel / auto-rebook** promu na podstawie fal (Open-Meteo ≠ polityka armatora).  
4. **Live statusu Polferries z API** — API **BRAK**; HTML/komunikaty + HITL.  
5. **Że ORS/MapTiler = trasa zezwolenia** oversize — routing HGV ≠ dispensa Trix / kat. V.  
6. **Pełnej zgodności tachografu / kabotażu** w silniku ETA MVP.  
7. **AIS jako SLA** pozycji promu.  
8. **rFMS w dniu 1** — MVP = PWA GPS; OEM później.  
9. **DATEX KPD od dnia 0** — onboarding certyfikatu; do tego czasu Situation SE &gt; PL.  
10. **Jednego globalnego „ETA confidence %”** w kokpicie — tylko chip LOW/MED/HIGH + method.

---

## 7. Mapowanie na produkt (M12 / spine / ryzyka)

| Potrzeba UX | Mechanizm ETA |
|---|---|
| Drawer M12 stacked bars | Jeden bar / segment z `eta_method` chip |
| Alert „zdążenie na rejs” | `at_risk_ferry_cutoff` z PORT vs boarding_close |
| M10 Ryzyka FERRY | wave score + komunikaty; nie mieszać z `eta_point` bez labela |
| Mail PRE_ARRIVAL ~40 min | point + band + method + disclaimer |
| Exception queue | Situation HIGH / FERRY_DISRUPTION / cutoff risk &gt; drobny drift ETA |
| Shadow ML | 04 §7 + QA checklist — poza MVP UI |

---

## 8. Parametry do zebrania od ops (nie zgadywać w kodzie)

Oznaczyć w config jako `UNVERIFIED` aż SCX/Polferries/Stegra potwierdzą:

- [ ] Godzina zamknięcia check-in cargo / boarding close Gdańsk  
- [ ] Minimalny czas PRE_PORT (kolejka, odprawa oversize)  
- [ ] Polityka slip day (co gdy miss cutoff — następny rejs)  
- [ ] Progi fal / wiatru „obserwuj” vs „eskaluj” (nie cancel)  
- [ ] `v_planned` PL i SE (osobno naczepa oversize + pilot)  
- [ ] Bufory odpoczynku gdy brak FMS/tachografu  
- [ ] Okno Stegra + typowy unload dwell  
- [ ] Mapowanie Trafikverket severity → minuty

---

## 9. Plan wdrożenia ETA (zgodny z 04 §4)

| Krok | Zakres |
|---|---|
| MVP | Deterministic + schedule ferry; PWA; policy band; cutoff boolean; Trafikverket Situation jako delay table; Open-Meteo risk chip |
| +60 loads | Histogramy residual S1/S4; ferry on-time rate; feature store minimalny (04) |
| 100–200 | Empirical p50/p90 gdy n_bin≥30; shadow quantile offline |
| Później | rFMS; KPD DATEX; AIS delay model; conformal — nadal HITL CRITICAL |

---

## 10. Uncertainty flags (przeniesione / uzupełnione z 04)

- Cutoff cargo Polferries: **[DO WERYFIKACJI]** z biurem cargo.  
- FerryAnnouncement Trafikverket ≠ Polferries Bałtyk (patrz 02 A5).  
- Pokrycie AIS mid-Bałtyk: bez SLA.  
- Biny historii rozjeżdżają się po `permit_class` / pogodzie — nie łączyć w jeden „model korytarza”.  
- Czas lokalny: UI Europe/Warsaw; leg SE trzymać też świadomość strefy SE w logach eventów.

---

*Koniec 03 — ETA predictions. SoT segmentacji i CI: `04_ETA_PREDICTION.md`. SoT źródeł: `02-corridor-pl-se-apis.md`.*
