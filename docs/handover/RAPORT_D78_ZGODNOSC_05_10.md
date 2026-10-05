# Raport uzupełniający D-78 / H-3 / H-2-PL

Data: **2026-10-05 ~12:27+** · Europe/Warsaw  
Polecenie: `POLECENIA_KOORDYNATORA.md` (~12:27).

---

## 1) Zgodność z portalem HERE

### Dlaczego portal ~26 tras, a system 4?
| Źródło | Routing | Uwagi |
|---|---|---|
| Watch Tower (`here_usage`, paź 2026) | **4** | Wyłącznie `here-roads` (geometria podkładu). H-1/H-3 wyłączone → 0. |
| Portal HERE (~26) | ręcznie / H-0 | POSTĘP 04.10: testy H-0 (~14 routing + reverse geocode) **bez** zapisu do `here_note_service`. Różnica = testy poza aplikacją, nie „ucieczka” zliczania w kodzie produkcyjnym. |

### Skąd 7 zapytań geokodowania?
W kodzie Watch Tower **nie ma** wywołań Geocoding / Reverse Geocode.  
**7 geocode = portal / testy ręczne H-0**, nie ruch aplikacji.

### Czy po poprawce KAŻDE wywołanie HERE z aplikacji trafia do licznika?
**Tak — wszystkie obecne ścieżki aplikacji:**

| Funkcja Edge | Usługa w `here_usage` |
|---|---|
| `here-raster` | `tiles` |
| `here-roads` | `routing` |
| `route-check` (H-1) | `routing` |
| `corridor-obstacles` (H-3) | `routing` |
| `road-pl` (H-2-PL, od 0171) | `traffic` |

Brak wywołań: geocode, map matching, Map Attributes (H-3 przebudowane).  
Ręczny ruch w portalu / Postman **nie** przechodzi przez Edge → nie trafia do licznika (oczekiwane).

### Advanced Raster Tile — pula 30 000?
**Tak (cennik HERE / kalkulator):** warstwa darmowa **0–30 000** dla Raster Tile i **Advanced Raster Tile** (ta sama półka „General ≤30K”).  
Aplikacja używa `logistics.day/night` → kategoria **Advanced Raster Tile**.  
Parametr `HERE_TILES_FREE=30000` w `app_parameters` jest zgodny z tą półką (do potwierdzenia na koncie właściciela).

---

## 2) H-6 a Map Attributes

H-6 = warstwa UI na katalogu H-3 (`H6_LAYER_ENABLED=false`, flaga `H6_MAP_OBSTACLES` false).  
**Nigdy nie wołała Map Attributes** samodzielnie.  
H-3 wcześniej używało Attributes — **przebudowane** na Routing v8 (PR #84).  
**H-6 nie wymaga osobnej przebudowy Attributes.**

---

## 3) H-2-PL — stan i wykonanie

| Element | Stan |
|---|---|
| GDDKiA KPD DATEX | Zapas: `KPD_DATEX_URL` (+ cert). Bez URL → nie LIVE. Wcześniej często DEMO. |
| HERE Traffic v7 | **Wdrazane teraz** — `road-pl` priorytetowo woła `/v7/incidents` wzdłuż `CORRIDOR_PL` (1× corridor / przebieg), ryzyka `ROAD_PL:HERE:…`. |
| Pula Traffic | `HERE_TRAFFIC_FREE=5000` / mies. (Real-Time Traffic, półka darmowa). |
| Stawka ponad pulę | `HERE_TRAFFIC_RATE_USD=0.00292` (~$2.92 / 1k). |
| Szacunek zużycia | Cron co 10 min × 1 TX ≈ **~4320 / mies.** → w puli 5000, koszt ponad pulę **$0**. |
| Budżet D-78 | Traffic wchodzi do sumy `over_pool`; stop przy 100% wstrzymuje kolejne wywołania. |

Migracja: `0171_h2pl_here_traffic.sql`. Flag H1/H3/H6: **bez zmian (false)**.

---

## Skrót dla właściciela
1. **26 vs 4** = testy poza systemem (H-0), nie niedoliczanie Edge.  
2. **7 geocode** = poza aplikacją.  
3. **Licznik** obejmuje wszystkie ścieżki Edge HERE; + traffic po H-2-PL.  
4. **Advanced Raster 30k** — tak wg cennika.  
5. **H-6** — bez Attributes; źródło = H-3 Routing.  
6. **H-2-PL** — HERE Traffic + pula 5000; KPD jako zapas.
