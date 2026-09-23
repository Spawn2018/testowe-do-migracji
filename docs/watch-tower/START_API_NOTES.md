# START_API_NOTES — P0 mapa / API dla buildera (START GO)

**Data:** 2026-09-23 (Europe/Warsaw)  
**Źródło SoT research:** `research-2026/02-corridor-pl-se-apis.md` (+ `03_APIS_VERIFIED.md`, `03-eta-predictions.md`, `ADDRESSES.md`)  
**Dla:** builder makiety / appki (MapLibre, Situation, symulacja floty)  
**Zasada:** nie wymyślać endpointów; ORS ≠ trasa zezwolenia; Polferries ≠ API.

---

## 0. Kotwice WGS84 (SoT)

| Punkt | Adres | lon, lat |
|---|---|---|
| LOADING — KSH Śrem | Grunwaldzka 27C, 63-100 Śrem | `17.02460, 52.07391` |
| SITE — Stegra Boden | Stalverket 20, 96140 Boden | `21.75914, 65.80539` |
| PRE_ARRIVAL | bufor ~50 km przed SITE | geofence osobny |

Prom (orientacyjnie — żadne z tych nie jest „GPS terminala z API”):

| Punkt | Orientacja | Uwaga |
|---|---|---|
| Polferries Gdańsk | ~`18.72, 54.39` (Terminal Ferry) | doprecyzuj POI w seed GeoJSON |
| Nynäshamn | ~`17.95, 58.90` | Stockholms Hamnar; LOCODE `SENYN` |

Env (placeholder):

```bash
NEXT_PUBLIC_MAPTILER_KEY=   # opcjonalnie; bez klucza → OpenFreeMap
TRAFIKVERKET_API_KEY=       # wymagane do live Situation
# ORS tylko orientacyjnie (nie prawo trasy):
ORS_API_KEY=
```

---

## 1. Mapa — MapLibre + prawdziwe kafelki

### 1.1 Preferencja A — MapTiler (plan UX / CURSOR_PROMPT)

| Pole | Wartość |
|---|---|
| Style JSON | `GET https://api.maptiler.com/maps/{mapId}/style.json?key={KEY}` |
| Przykład mapId | `streets-v2` · dark: `dataviz-dark` / `basic-v2-dark` (wybierz per VISUAL_BRIEF) |
| Docs | https://docs.maptiler.com/cloud/api/maps/ · MapLibre: https://docs.maptiler.com/maplibre/ |
| Keys | https://cloud.maptiler.com/account/keys/ |
| Status research | **VERIFIED** (bez key → 403 „Get your FREE key…”) |

```ts
// react-map-gl / maplibre-gl
const mapStyle = `https://api.maptiler.com/maps/streets-v2/style.json?key=${process.env.NEXT_PUBLIC_MAPTILER_KEY}`
```

### 1.2 Preferencja B — OpenFreeMap (zero key, START bez blokady)

| Pole | Wartość |
|---|---|
| Liberty (default) | `https://tiles.openfreemap.org/styles/liberty` |
| Dark | `https://tiles.openfreemap.org/styles/dark` |
| Bright / Positron / Fiord | `…/styles/bright` · `positron` · `fiord` |
| Docs | https://openfreemap.org/quick_start/ |
| Attribution | wymagana (MapLibre dokłada automatycznie) |

**Reguła buildera:** jeśli `NEXT_PUBLIC_MAPTILER_KEY` puste → OpenFreeMap dark/liberty. Nie używać `demotiles.maplibre.org` w makiecie START (za ubogie).

### 1.3 Warstwy własne (GeoJSON / sources MapLibre) — obowiązkowe w START

1. `corridor-route` — LineString referencyjny (patrz §2)  
2. `geofences` — LOADING, PRE_PORT, FERRY legs, PRE_ARRIVAL, SITE  
3. `trafikverket-situation` — punkty/linie z API (§3)  
4. `fleet-sim` — FeatureCollection pozycji ciężarówek (§4)  
5. `ferry-leg` — odcinek Gdańsk→Nynäshamn (schematyczny linia morze)

---

## 2. Trasa ponadgabaryt — geometria referencyjna ≠ router HGV

**Hard rule (koordynator + research):**  
ORS / MapTiler Directions **nie są prawem trasy**. Prawna geometria = zezwolenie (PL kat. + SE dispens/Trix). W makiecie:

| Warstwa | Źródło | Rola |
|---|---|---|
| **A. Referencyjna (SoT UI)** | Seed GeoJSON `corridor_ref.geojson` | LineString Śrem → … → Gdańsk ferry → Nynäshamn → E4 → Stalverket 20 | rysunek + fitBounds + progress animacji |
| **B. Orientacyjna (opcjonalnie)** | ORS HeiGIT `driving-hgv` | tylko shadow / „sugerowany HGV” — **muted**, label „orientacyjnie, nie dispensa” |
| **C. Zezwolenie** | upload PDF + metadane | brak API składania; nie generować trasy z ORS |

### 2.1 Segmenty LineString (kolejność)

1. `PL_ROAD` — Śrem → Terminal Polferries Gdańsk  
2. `FERRY` — Gdańsk → Nynäshamn (linia morska; nie snap do dróg)  
3. `SE_ROAD` — Nynäshamn → E4 N → Boden Stalverket 20  

Seed: ręczny / uproszczony polyline w repo (może być ~kilkadziesiąt–kilkaset punktów). **Nie** wstawiać wyniku ORS jako `corridor_ref`.

### 2.2 ORS — tylko orientacja (host 2026)

| Pole | Wartość |
|---|---|
| Endpoint | `POST https://api.heigit.org/openrouteservice/v2/directions/driving-hgv` |
| Auth | header `Authorization: {ORS_API_KEY}` |
| Docs | https://giscience.github.io/openrouteservice/api-reference/endpoints/directions/ |
| Status | **VERIFIED** (bez key → 401) |
| Stary host | `api.openrouteservice.org` — **WYŁĄCZONY 2026-08-24** — nie używać |

Body (szkielet):

```json
{
  "coordinates": [[17.02460, 52.07391], [18.72, 54.39]],
  "options": {
    "profile_params": {
      "restrictions": { "height": 4.0, "width": 3.0, "weight": 40000 }
    }
  }
}
```

Nigdy nie łącz FERRY leg przez `driving-hgv`. Dla SE osobne wywołanie Nynäshamn→Boden jeśli potrzeba shadow.

---

## 3. Trafikverket Situation — real API (P0 E4)

| Pole | Wartość |
|---|---|
| Endpoint JSON | `POST https://api.trafikinfo.trafikverket.se/v2/data.json` |
| Endpoint XML | `POST https://api.trafikinfo.trafikverket.se/v2/data.xml` |
| Auth | darmowy klucz → `<LOGIN authenticationkey="…"/>` |
| Rejestracja | https://www.trafikverket.se/e-tjanster/trafikverkets-oppna-api-for-trafikinformation/ |
| Konsola | https://api.trafikinfo.trafikverket.se/ · https://data.trafikverket.se/ |
| Guide | https://www.trafiklab.se/api/other-apis/trafikverket/ |
| Content-Type | `application/xml` lub `text/xml` |
| objecttype P0 | `Situation` (schemaversion **1.5** — potwierdź w konsoli; może być 1.6) |
| Status research | **VERIFIED** (bez body → 400 oczekiwane) |

### 3.1 Przykład body — filtr E4

```xml
<REQUEST>
  <LOGIN authenticationkey="TRAFIKVERKET_API_KEY"/>
  <QUERY objecttype="Situation" schemaversion="1.5" limit="50">
    <FILTER>
      <LIKE name="Deviation.LocationDescriptor" value="%E4%"/>
    </FILTER>
  </QUERY>
</REQUEST>
```

**Lepszy filtr START (zalecany po pierwszym live teście):** bbox WGS84 korytarza Nynäshamn→Boden zamiast samego LIKE — sprawdź w Datautbytesportal nazwę pola geometrii (`Deviation.Geometry.WGS84` / AND Inside). Fallback: LIKE `%E4%` + client-side clip do bbox:

```
bbox SE corridor (przybliżony):
  SW 17.5, 58.7
  NE 22.5, 66.0
```

### 3.2 Mapowanie do UI

- Warstwa mapy: severity → kolor (CRITICAL/HIGH hot)  
- Exception queue / M10 ROAD_SE: title + age + link do Situation Id  
- **Nie** używać `FerryAnnouncement` Trafikverket jako status Polferries (to vägfärjor — research §A5)

### 3.3 Gdy brak klucza w makiecie

Seed 3–5 Situation fake w GeoJSON z flagą `source: "seed"`; UI chip „demo”. Live fetch tylko gdy `TRAFIKVERKET_API_KEY` ustawiony (server route / Inngest, nie eksponuj key w browser).

---

## 4. Symulacja ruchu ciężarówek (animacja po progress)

**Brak API floty w dniu 1** → symulacja na geometrii `corridor_ref`.

### 4.1 Model

Dla każdego aktywnego `load`:

| Pole | Źródło |
|---|---|
| `progress` ∈ [0,1] | seed / clock / status spine |
| `position` | `along(corridor_ref, progress * length)` (Turf `along` / `length`) |
| `heading` | bearing do następnego punktu |
| `segment` | PL_ROAD / FERRY / SE_ROAD wg cumulative length |
| `updated_at` | tick 1–5 s w UI demo; 5–10 min w „pseudo live” |

### 4.2 MapLibre

- Source `fleet-sim` type `geojson`, feature per load (`id` = load id)  
- Layer `circle` + opcjonalnie `symbol` ciężarówka  
- Animacja: `requestAnimationFrame` lub interval → mutate GeoJSON → `setData`  
- Hover sync z listą (UX_MAP split 60/40)

### 4.3 Status → progress (seed)

| Status / spine | progress hint |
|---|---|
| LOADING / PLAN | 0.00–0.02 |
| PL road | 0.05–0.35 |
| PRE_PORT / FERRY_WAITING | 0.36–0.40 |
| FERRY underway | 0.40–0.55 (interpoluj po czasie rejsu 18:00→12:00) |
| SE_ROAD | 0.55–0.92 |
| PRE_ARRIVAL | 0.92–0.97 |
| SITE / UNLOADED | 0.98–1.00 |

Później: prawdziwy PWA GPS nadpisuje symulację (`geom_raw`); symulacja tylko gdy brak pingu.

---

## 5. Polferries — brak API → seed + HITL

| Zasób | URL | Rola w START |
|---|---|---|
| Rozkład cargo GN | https://polferries.com/cargo/cargo-timetable.html?code=gn | źródło do ręcznego seedu (WAW / NS) |
| Rozkład PL | https://polferries.pl/cargo/rozklad.html?code=gn | j.w. |
| Komunikaty | https://polferries.pl/faq/komunikaty-kursowania-promow.html | HITL: `FERRY_DISRUPTION` |
| API | **BRAK** | **nie inventować** `/api/sailings` |

### 5.1 Seed model (przykład)

```ts
type FerrySailing = {
  id: string
  vessel: 'WAW' | 'NS' // Wawel | Nova Star
  depPort: 'GDN'
  arrPort: 'NYN'
  depLocal: string // Europe/Warsaw ISO
  arrLocal: string // SE local awareness w logach
  status: 'PLANNED' | 'BOARDING' | 'DEPARTED' | 'ARRIVED' | 'CANCELLED' | 'DELAYED'
  source: 'seed' | 'hitl'
}
```

Obserwacja research 2026-09-23: typowo **dep 18:00 → arr +1d 12:00**; ~1 odejście/dzień.

UI: status tylko z seed/HITL; przycisk ops „Oznacz opóźnienie / anulację” → event `load_events`.

### 5.2 Uzupełnienie ferry check (koordynator → Research, 2026-09-23)

| Linia / źródło | API? | Uwaga operacyjna |
|---|---|---|
| **Polferries / POLSCA** Gdańsk–Nynäshamn | **NIE** publicznego developer API | HTML rozkład + `booking.polsca.com` + telefony cargo; status = **HITL / HTML / AIS** |
| **Stena Line** | Portal developerski za signup: `api-portal-dev.stenaline.com` | Freight **Gdynia–Karlskrona** = Plan B; nie free scrape |
| **Unity Line / TT-Line** | Brak publicznego booking API | TT: wewnętrzny Azure hub only |
| **AISStream** (niezależne) | Tak (pozycja) | Wawel MMSI **311852000**; Nova Star MMSI **311000787** — fakt pozycji, **nie** status bookingu |

---

## 6. Poza P0 (nie blokować START)

| Źródło | Endpoint | Kiedy |
|---|---|---|
| Open-Meteo Marine | `GET https://marine-api.open-meteo.com/v1/marine?latitude=55&longitude=18.5&hourly=wave_height` | chip ryzyka fal (nie auto-cancel) |
| SMHI SNOW1gv1 | `GET https://opendata-download-metfcst.smhi.se/api/category/snow1g/version/1/geotype/point/lon/{lon}/lat/{lat}/data.json` | pogoda SE; **nie** pmp3g (deprecated) |
| GDDKiA KPD DATEX II 3.4 | portal https://kpd.gddkia.gov.pl/ (SOAP/D2Light po certyfikacie) | P2 — onboarding |
| rFMS 5.0 | OEM-specific OAuth; spec PDF 2025-07-25 | po grant SCX; MVP = PWA |
| Driver PWA | `/driver/:token` + `watchPosition` | P0 produktowe (równolegle do symulacji) |

---

## 7. Checklist buildera (START)

- [ ] MapLibre z **prawdziwymi** tiles (MapTiler key **lub** OpenFreeMap)  
- [ ] `corridor_ref.geojson`: Śrem → Gdańsk → ferry → Nynäshamn → E4 → Stalverket 20  
- [ ] ORS tylko jako warstwa opcjonalna / muted — nigdy jako SoT trasy  
- [ ] Server route Trafikverket Situation + key; fallback seed  
- [ ] Animacja floty `along(corridor_ref, progress)`  
- [ ] Ferry status z seed/HITL — zero fake Polferries API  
- [ ] Label w UI gdy demo: „Situation: seed” / „Pozycja: symulacja”

---

## 8. Pliki research do czytania przy implementacji

| Plik | Po co |
|---|---|
| `research-2026/02-corridor-pl-se-apis.md` | pełny katalog + Brief |
| `research-2026/03_APIS_VERIFIED.md` | macierz statusów |
| `research-2026/03-eta-predictions.md` | segmenty ETA + czego nie obiecywać |
| `ADDRESSES.md` | współrzędne SoT |
| `PERMITS_PL_SE.md` | limity — nie API trasy |

*WT — Research · START GO · 2026-09-23*
