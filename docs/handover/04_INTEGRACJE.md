# 04 · Integracje zewnętrzne

| Pole | Wartość |
|---|---|
| Data | **2026-09-23** Europe/Warsaw |
| Źródła | `src/lib/{ais,trafikverket,ferry,corridor}.ts` · `CorridorMap.tsx` · `vite.config.ts` · **`docs/watch-tower/START_API_NOTES.md`** (wciągnięte) · `00_KONTEKST` A3 |
| Zasada | nie inventować endpointów; Polferries ≠ API; ORS ≠ prawo trasy |

---

## 1. Macierz (stan w makiecie)

| Integracja | Stan w SPA | Klucz / env | Live bez klucza? | Dowód |
|---|---|---|---|---|
| **Kafelki mapy (Esri Canvas)** | **DZIAŁA** | brak | tak (publiczne) | `CorridorMap.tsx` `TILE_DARK`/`TILE_LIGHT` |
| Carto CDN (zadeklarowane) | URL w kodzie; **nieaktywne** (watermark 2026-09) | — | problematyczne | komentarz `CorridorMap.tsx:19–21`; proxy `/map-proxy/carto` w Vite |
| MapTiler / OpenFreeMap | **docs/README stale** (MapLibre) | `VITE_MAPTILER_KEY` | n/d — mapa ≠ MapLibre | README vs aktywny Leaflet |
| MapLibre GL | **PORZUCONE** leftover | — | — | `public/maplibre-*`; `CorridorMap.leaflet.tsx` 0 importów |
| **Trafikverket Situation** | **CZĘŚCIOWO** live\|seed | `TRAFIKVERKET_API_KEY` / `VITE_…` (serwer) | seed labeled | `vite.config.ts` middleware; `trafikverket.ts` |
| **AISStream (prom)** | **CZĘŚCIOWO** live\|seed | `AISSTREAM_API_KEY` **server-only** | seed | `ais.ts` · `scripts/ais-proxy.mjs` · port **4175** |
| Polferries booking/rozkład API | **ODRZUCONE** — brak publicznego API | — | seed HTML / HITL | START_API_NOTES §5 · `ferry-sailings.json` |
| AIS MMSI Wawel / Nova Star | **USTALONE** identyfikatory | 311852000 / 311000787 | pozycja ≠ booking | `ais.ts` · START_API_NOTES §5.2 |
| SEFS ORLEN / OKQ8 | **seed snapshot** (nie HTTP) | — | n/d | `sefs.ts` `SEFS_WEEKLY` · URL tylko w metadanych |
| Factoring bankowy | **store-only** | — | n/d | `DEFAULT_FACTORING_OFFER` |
| Import SharePoint Graph | **poza makietą** (copy UI) | — | XLSX lokalny | `00_KONTEKST` A2/A3 |
| ORS HeiGIT driving-hgv | **niepodpięte** jako SoT | `ORS_API_KEY` | — | START_API_NOTES §2 — tylko orientacja |
| Pogoda morska / SMHI | **niepodpięte**; UI = `SAIL_ROWS` hardcode | — | — | `RisksView` · START_API_NOTES §6 |
| Telematyka SCX (rFMS…) | **ATRAPA poza SPA** | — | drift mapy | `/workspace/watch-tower/…/adapter.ts` |
| NBP FX | **brak klienta** | — | — | `00_KONTEKST` A3 |
| GDDKiA KPD / DATEX | research P2 | cert | — | START_API_NOTES §6 |
| Driver geolocation | **DZIAŁA** one-shot | uprawnienia przeglądarki | — | `DriverPwa` `getCurrentPosition` |

---

## 2. START_API_NOTES — skrót wciągnięty

Pełny tekst: `docs/watch-tower/START_API_NOTES.md` (2026-09-23, WT — Research).

### 2.1 Kotwice WGS84

| Punkt | lon, lat |
|---|---|
| KSH Śrem Grunwaldzka 27C | 17.02460, 52.07391 |
| Stegra Boden Stalverket 20 | 21.75914, 65.80539 |
| Polferries Gdańsk (orient.) | ~18.72, 54.39 |
| Nynäshamn (orient.) | ~17.95, 58.90 |

### 2.2 Mapa (plan research vs runtime)

- Research preferował **MapLibre** + MapTiler key **lub** OpenFreeMap.  
- **Runtime 2026-09-23:** Leaflet + **Esri** World Dark/Light Gray (po `MAP_TILES_FIX`; Carto watermark).  
- Warstwy własne: corridor_ref, ferry-leg, geofences, fleet-sim (progress), TV, AIS.

### 2.3 Trasa

- SoT UI = seed GeoJSON `corridor_ref` (PL_ROAD → FERRY → SE_ROAD).  
- ORS = opcjonalny shadow — **nigdy** dispensa. Host ORS 2026: `api.heigit.org` (stary `api.openrouteservice.org` wyłączony).

### 2.4 Trafikverket

- `POST https://api.trafikinfo.trafikverket.se/v2/data.json`  
- Auth: `<LOGIN authenticationkey="…"/>` w XML body.  
- Objecttype P0: `Situation` schemaversion **1.5**, filtr LIKE `%E4%` (bbox SE w kliencie).  
- W makiecie: Vite middleware `POST /api/trafikverket` podstawia klucz serwerowy; bez klucza → `{mode:'seed'}`.

### 2.5 Polferries

- **Brak** publicznego developer API.  
- Seed + HITL; status z HTML/AIS/ops — nie fake `/api/sailings`.  
- Typowy rejs research: dep ~18:00 → arr +1d 12:00.

### 2.6 AIS

- AISStream przez lokalny proxy; klient **nigdy** nie dostaje API key.  
- Env docs (placeholder research): `NEXT_PUBLIC_MAPTILER_KEY`, `TRAFIKVERKET_API_KEY`, `ORS_API_KEY` — w Vite odpowiedniki `VITE_*` / bez prefixu jak wyżej.

---

## 3. Wywołania z kodu (konkret)

### 3.1 Kafelki

```
TILE_DARK  = …/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}
TILE_LIGHT = …/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}
```

Leaflet `L.tileLayer` w `CorridorMap.tsx` ~179. Attribution OSM+CARTO+Esri (ATTR string).

### 3.2 Trafikverket

1. Browser `fetch('/api/trafikverket', { method:'POST', body: JSON })`.  
2. Plugin Vite buduje XML + opcjonalnie forward do `api.trafikinfo…`.  
3. `fetchSituations()` mapuje live lub zwraca `SEED_SITUATIONS` (E4 Nynäshamn→Boden).

### 3.3 AIS

1. `subscribeAis` → WebSocket `VITE_AIS_WS_URL` lub `ws://<host>:4175/ais`.  
2. Proxy (`npm run ais-proxy`) ładuje klucz z box-secrets / env.  
3. Fail/open seed → `source:'seed'`; UI chip „AIS live | seed”.

### 3.4 Ferry / import / factoring / permits

| Obszar | Zewnętrzne HTTP? | Mechanizm |
|---|---|---|
| Ferry sailings | nie | `ferry-sailings.json` + `nextLiveSailing` |
| Import harmonogramu | nie (plik lokalny) | ExcelJS w przeglądarce |
| Factoring | nie | store |
| Permits | nie | JSON SoT + classifier |
| SEFS ceny | nie | tabele + weekly seed |

---

## 4. Checklist ops (klucze)

| Chcę | Ustaw | Uruchom |
|---|---|---|
| Live E4 Situation | `TRAFIKVERKET_API_KEY` w env procesu Vite | `npm run dev` / preview |
| Live pozycja promu | `AISSTREAM_API_KEY` | `npm run ais-proxy` + otwarta mapa |
| Reprodukowalne zrzuty | `VITE_FROZEN_NOW` lub `?now=` | bez losowego countdown |

Rejestracja TV: portal Trafikverket Open API (linki w START_API_NOTES §3).  
AISStream: konto + key — **nie** commitować do repo.

---

## 5. Ryzyka integracyjne (skrót)

- README nadal opisuje MapLibre/OpenFreeMap — **nie mylić z Leaflet/Esri**.  
- `/tmp` shots TV/AIS historyczne mogą być utracone → `docs/evidence/UTRACONE.md`.  
- Carto proxy w Vite istnieje, ale warstwa aktywna = Esri.  
