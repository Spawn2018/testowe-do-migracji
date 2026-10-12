# WATCH TOWER — katalog API / źródeł danych korytarza PL–SE

**Data researchu:** 2026-09-23 (Europe/Warsaw)  
**Korytarz:** Śrem (KSH) → Port Gdańsk / Polferries → Nynäshamn → E4 (~900 km) → Stegra Boden (65.80539, 21.75914)  
**Zakres:** ładunki oversize; MVP control tower  
**Zasada:** endpointy bez weryfikacji HTTP/oficjalnej dokumentacji → status `DO_WERYFIKACJI` + sposób weryfikacji. Brak wymyślonych % dokładności.

Legenda statusów:
- **VERIFIED** — potwierdzono istnienie strony/dokumentacji i/lub odpowiedź HTTP w dniu researchu
- **DO_WERYFIKACJI** — źródło wiarygodne pośrednio (katalog, biblioteka, opis), brak pełnego live-testu z kluczem / niepewny zakres
- **BRAK** — nie znaleziono publicznego API w badanym zakresie

---

## A) Prom / port

### A1. Polferries — rozkład Gdańsk ↔ Nynäshamn

| Pole | Wartość |
|---|---|
| Status | **VERIFIED** (HTML oficjalny); API: **BRAK** |
| URL rozkład (PL) | https://polferries.pl/rozklad-i-cennik/rozklad.html?code=gn |
| URL rozkład (EN) | https://polferries.com/prices-i-timetable/ferries-to-sweden-timetable.html?code=gn |
| URL cargo timetable | https://polferries.com/cargo/cargo-timetable.html?code=gn |
| Dostęp | Publiczny HTML; brak dokumentowanego REST/JSON API |
| Obserwacja 2026-09-23 | Typowo **18:00 → +1 dzień 12:00**; jednostki **NS (Nova Star)** / **WAW (Wawel)**; ~1 odejście/dzień (z lukami w kalendarzu) |

**Uwagi MVP:** brak oficjalnego API → źródło prawdy = awizacja SCX + ręczny/periodiczny import z HTML *albo* B2B feed od Polferries (jeśli uzyskany kontraktowo). Scraping: **ryzyko ToS** — przed automatyzacją uzyskać zgodę / sprawdzić regulamin; preferować ręczny snapshot + alert przy zmianie komunikatu.

Jak weryfikować dalej: DevTools Network na stronie rozkładu (czy jest XHR JSON); zapytanie do cargo@ / B2B Polferries o feed.

### A2. Polferries — komunikaty kursowania (opóźnienia / anulacje)

| Pole | Wartość |
|---|---|
| Status | **VERIFIED** (HTML) |
| URL | https://polferries.pl/faq/komunikaty-kursowania-promow.html |
| Dostęp | Publiczny |
| Live 2026-09-23 | Sekcja **Gdańsk – Nynäshamn** listuje rejsy (Nova Star / Wawel) z planowymi godzinami; strona aktualizowana operacyjnie |

**Uwagi:** sygnał „delayed/cancelled” nie jest ustrukturyzowanym API — trzeba parsować status tekstowy / porównywać z planem. Kontakt awaryjny z strony: info o ruchu promów +48 455 455 040.

### A3. Port Gdańsk — info operacyjna

| Pole | Wartość |
|---|---|
| Status | **DO_WERYFIKACJI** (brak publicznego otwartego API znalezionego) |
| Strona ruchu (pilot) | https://www.gdanskpilot.pl/en/harbour-traffic — **VERIFIED** HTTP 200 |
| VTS / systemy | Opis systemów VTS Zatoka Gdańska: https://www.umgdy.gov.pl/en/marine-safety/vts-zatoka-gdanska-en/supporting-systems-of-vts-zatoka-gdanska/ |
| API | **BRAK** udokumentowanego publicznego REST dla anløpów |

Jak weryfikować: kontakt Port of Gdańsk / UMGDy o dostęp do AIS-PL / DMIS; ewentualnie komercyjne AIS (VesselFinder itd.) — poza MVP.

### A4. Port Nynäshamn / Stockholms Hamnar

| Pole | Wartość |
|---|---|
| Status | **VERIFIED** (strony HTML); API: **BRAK** |
| Info linii Polferries | https://www.stockholmshamnar.se/nynaeshamn/gods-och-passagerartrafik/ |
| Fartygsanlöp (aktualne anløpy) | https://www.stockholmshamnar.se/fartygsanloep/ |
| LOCODE | SENYN (kontekst SE) |

**Uwagi:** Sjöfartsverket wspomina przyszłe REST EMSWe dla publicznych czasów anløp — endpoint nieopublikowany w researchu → nie używać w MVP.

### A5. Trafikverket FerryAnnouncement / FerryRoute

| Pole | Wartość |
|---|---|
| Status | **DO_WERYFIKACJI** |
| Kontekst | Typy obiektów pojawiają się w bibliotekach klientów Trafikinfo (np. `FerryAnnouncement` schema 1.2) oraz w Datautbytesportal; **prawdopodobnie dotyczą promów drogowych Trafikverket (vägfärjor), nie Polferries Bałtyk** |
| Endpoint bazowy | `POST https://api.trafikinfo.trafikverket.se/v2/data.json` (patrz B1) |

Jak weryfikować: klucz API + zapytanie `objecttype="FerryAnnouncement"` filtrowane po Nynäshamn/Gdańsk; jeśli pusto → **nie używać** dla linii Polferries.

---

## B) Droga / ruch SE & PL

### B1. Trafikverket Open API (via Trafiklab / data.trafikverket.se) — **priorytet MVP SE**

| Pole | Wartość |
|---|---|
| Status | **VERIFIED** |
| Endpoint JSON | `POST https://api.trafikinfo.trafikverket.se/v2/data.json` |
| Endpoint XML | `POST https://api.trafikinfo.trafikverket.se/v2/data.xml` |
| Dokumentacja / rejestracja | https://www.trafikverket.se/e-tjanster/trafikverkets-oppna-api-for-trafikinformation/ |
| Konsola / model | https://api.trafikinfo.trafikverket.se/ · https://data.trafikverket.se/ |
| Opis Trafiklab | https://www.trafiklab.se/api/other-apis/trafikverket/ |
| Dostęp | **Darmowy klucz API** po rejestracji (Trafikverket lub Trafiklab) |
| Licencja | CC0 (wg dokumentacji Trafikinfo) |
| Weryfikacja 2026-09-23 | Endpoint odpowiada (HTTP 400 bez body — oczekiwane; wymaga XML + klucz) |

**Typy istotne dla E4 (wg Trafiklab):**

| objecttype | Zastosowanie MVP |
|---|---|
| `Situation` | Zdarzenia: roboty, wypadki, korki, przeszkody, **avvikande färjetider**, kolonnkörning |
| `RoadCondition` / `RoadConditionOverview` | Stan nawierzchni / śliskość |
| `WeatherStation` | Stacje pogodowe przy drodze |
| `Camera` | Kamery drogowe (PhotoUrl) — **DO_WERYFIKACJI** schemaversion + namespace `Road.Infrastructure` w konsoli |

Przykładowy szkielet zapytania (z dokumentacji Trafiklab; **wymaga własnego klucza**):

```xml
<REQUEST>
  <LOGIN authenticationkey="YOUR_KEY"/>
  <QUERY objecttype="Situation" schemaversion="1.5" limit="50">
    <FILTER>
      <LIKE name="Deviation.LocationDescriptor" value="%E4%"/>
    </FILTER>
  </QUERY>
</REQUEST>
```

Header: `Content-Type: application/xml` lub `text/xml`.  
Współrzędne: SWEREF 99 TM + WGS84 w geometrii.

**Jak weryfikować filtr E4:** po uzyskaniu klucza — zapytanie Situation z LIKE E4 + bbox Nynäshamn→Boden; potwierdzić schemaversion w Datautbytesportal (1.5 vs 1.6).

### B2. GDDKiA KPD — DATEX II (PL utrudnienia) — **priorytet MVP PL**

| Pole | Wartość |
|---|---|
| Status | **VERIFIED** (portal + metadane); endpoint SOAP po rejestracji: **DO_WERYFIKACJI** (wymaga certyfikatu) |
| Portal | https://kpd.gddkia.gov.pl/ |
| Specyfikacja | https://kpd.gddkia.gov.pl/index.php/pl/specyfikacja-techniczna/ |
| Metadane DATEX | https://kpd.gddkia.gov.pl/index.php/pl/metadane-datex/ |
| Standard | DATEX II **3.4** (utrudnienia); inne profile 3.5/3.7 |
| Tryby | Push on Occurrence (preferowany), Snapshot Pull, **D2Light** (JSON Situation Publication — tylko profil Utrudnienia) |
| Dostęp | Rejestracja podmiotu + użytkownik Odbiorca Danych; **certyfikat klienta**; wniosek → kpd@gddkia.gov.pl (FAQ/instrukcje na portalu) |
| Zasięg | Drogi krajowe (korytarz Śrem→Gdańsk: S5/A1/S7 itd. — filtrować po geometrii) |

**Uwagi MVP:** onboarding KPD trwa dni–tygodnie → na start można użyć ręcznych alertów / publicznego komunikatu GDDKiA; pełna integracja DATEX = faza 1.5.

Jak weryfikować: po rejestracji pobrać WSDL „Utrudnienia”, wykonać Snapshot Pull lub D2Light i sprawdzić czy pojawiają się sytuacje na A1/S7 do Trójmiasta.

### B3. Alternatywy PL (lżejsze)

| Źródło | Status | URL | Uwaga |
|---|---|---|---|
| GDDKiA komunikaty / mapa utrudnień (web) | DO_WERYFIKACJI | gov.pl/gddkia | Nie jest API; scraping mapy = ToS |
| OpenStreetMap notes / Overpass | VERIFIED ekosystem | https://overpass-api.de/ | Nie zastępuje DATEX; tylko geometria/POI |

---

## C) Mapy / routing

### C1. MapTiler + MapLibre (plan projektu)

| Pole | Wartość |
|---|---|
| Status | **VERIFIED** |
| Style JSON | `GET https://api.maptiler.com/maps/{mapId}/style.json?key=KEY` (np. `streets-v2`) |
| Docs Maps API | https://docs.maptiler.com/cloud/api/maps/ |
| MapLibre guide | https://docs.maptiler.com/maplibre/ |
| Geocoding | https://docs.maptiler.com/cloud/api/geocoding/ — **VERIFIED** (HTTP 403 „Missing key” bez klucza = endpoint żywy) |
| Dostęp | Konto Cloud → free key: https://cloud.maptiler.com/account/keys/ |
| Weryfikacja 2026-09-23 | Style bez key → 403 „Get your FREE key…” |

**MVP:** MapLibre GL JS + style MapTiler; warstwy własne (GeoJSON: trasa, geofence, Situation, pozycja PWA).  
**Routing MapTiler:** produkt Directions / truck routing w beta (maptiler.com/routing) — **DO_WERYFIKACJI** dostępność dla konta projektu; nie polegać w MVP bez potwierdzenia.

### C2. OpenRouteService / HeiGIT (routing HGV)

| Pole | Wartość |
|---|---|
| Status | **VERIFIED** (host + deprecation notice) |
| Nowy host (od 2026) | `POST https://api.heigit.org/openrouteservice/v2/directions/driving-hgv` |
| Stary host | `api.openrouteservice.org` — **deprecated**, shut-off **2026-08-24** (komunikat HeiGIT) |
| Docs | https://giscience.github.io/openrouteservice/api-reference/endpoints/directions/ |
| Announcement | https://ask.openrouteservice.org/t/deprecating-api-openrouteservice-org-in-favour-of-api-heigit-org/7912 |
| Dostęp | API key (signup HeiGIT/ORS); free tier z limitami |
| Weryfikacja 2026-09-23 | `api.heigit.org/.../driving-hgv` → HTTP **401** bez klucza (endpoint żywy) |

Opcje ciężarówki: `options.profile_params.restrictions` (height/width/weight) — **ważne dla oversize**, ale ORS nie zastępuje zezwolenia / trasy wyznaczonej w dispensie SE.

### C3. OSM / własne kafelki

| Pole | Wartość |
|---|---|
| Status | **VERIFIED** (ekosystem) |
| Rola | Geometria bazowa; Overpass dla POI; nie jako jedyny provider mapy UI |

---

## D) Telematyka / pozycje

### D1. rFMS (ACEA / FMS-Standard)

| Pole | Wartość |
|---|---|
| Status | **VERIFIED** (specyfikacja PDF dostępna) |
| Portal | https://www.fms-standard.com/Truck/index.htm |
| Spec rFMS vehicle data v5.0.0 | https://www.fms-standard.com/Truck/down_load/Technical_Specification_rFMS_vehicle_data_V5.0.0_25.07.2025.pdf (HTTP 200, ~1.9 MB, 2025-07-25) |
| Auth | OAuth 2.0 (osobna spec Authorization) |
| Dostęp | **Nie jest publicznym API** — wymaga umowy z OEM / fleet provider (Volvo, Scania, MAN…); endpointy per producent |
| Wzorzec | `GET …/vehicleposition?vin=…&latestOnly=true` (WGS84, heading, speed; odświeżanie min. ~15 min wg spec) |

**MVP bez API przewoźnika:** **Driver PWA GPS** (`/driver/:token`) — push pozycji do Watch Tower (geofence LOADING→PORT→FERRY→SE_ROAD→SITE). rFMS = faza późniejsza gdy SCX udostępni VIN + zgodę OEM.

### D2. Typowe wzorce EU fleet API

| Wzorzec | Uwaga dla MVP |
|---|---|
| OEM rFMS | OAuth + VIN allowlist; opóźnienie vs PWA |
| TMS/ telematics (Webfleet, Trimble, Samsara…) | Integracje B2B; każdy SCX inny — abstrakcja adapterów |
| AIS morski | Pozycja promu (nie naczepy); komercyjne API — poza MVP |

---

## E) Pogoda / stan morza (ryzyko promu)

### E1. Open-Meteo Marine API

| Pole | Wartość |
|---|---|
| Status | **VERIFIED** (live JSON 2026-09-23) |
| Endpoint | `GET https://marine-api.open-meteo.com/v1/marine?latitude=…&longitude=…&hourly=wave_height,…` |
| Docs | https://open-meteo.com/en/docs/marine-weather-api |
| Dostęp | Free non-commercial; commercial → klucz / customer- prefix |
| Test | lat=55.0 lon=18.5 (Bałtyk środkowy) → HTTP 200, `wave_height` |

**MVP:** flaga ryzyka fal na odcinku Gdańsk–Nynäshamn (threshold operacyjny uzgodnić z SCX/Polferries — **nie obiecywać automatycznego cancel**).

### E2. SMHI Open Data — prognoza meteo SE

| Pole | Wartość |
|---|---|
| Status | **VERIFIED** (SNOW1gv1 live) |
| Nowy API (zastąpił PMP3gv2 od 2026-03-31) | `GET https://opendata-download-metfcst.smhi.se/api/category/snow1g/version/1/geotype/point/lon/{lon}/lat/{lat}/data.json` |
| Docs | https://opendata.smhi.se/metfcst/snow1gv1 |
| Komunikat deprecacji PMP3 | https://www.smhi.se/data/om-smhis-data/uppdateringar-oppna-data/uppdateringar-i-smhis-oppna-data/2026-03-16-api-for-pmp3-avvecklas-31-mars |
| Dostęp | Otwarte; bez klucza |
| Test 2026-09-23 | Stockholm lon/lat → HTTP 200, `timeSeries` z `air_temperature`, `wind_speed`, … |

**Nie używać:** `…/category/pmp3g/version/2/…` (404).

### E3. IMGW-PIB (PL)

| Pole | Wartość |
|---|---|
| Status | **VERIFIED** |
| Synop JSON | `GET https://danepubliczne.imgw.pl/api/data/synop` |
| Docs / regulamin | https://danepubliczne.imgw.pl/apiinfo |
| Dostęp | Publiczny (ustawa o otwartych danych); sprawdzić regulamin przy reuse komercyjnym |
| Test | HTTP 200, tablica stacji |

### E4. Copernicus Marine — Bałtyk fale

| Pole | Wartość |
|---|---|
| Status | **VERIFIED** (strona produktu) |
| Produkt | BALTICSEA_ANALYSISFORECAST_WAV_003_010 |
| URL | https://data.marine.copernicus.eu/product/BALTICSEA_ANALYSISFORECAST_WAV_003_010/description |
| Dostęp | Rejestracja Copernicus Marine; NetCDF / services — cięższe niż Open-Meteo |

---

## F) Zezwolenia — tylko portale / API wniosków (light)

Szczegóły limitów: `/workspace/watch-tower/PERMITS_PL_SE.md` — **nie duplikować**.

| Kraj | Portal / kanał | Status | URL |
|---|---|---|---|
| PL | GDDKiA przejazdy nienormatywne | VERIFIED | https://www.gov.pl/web/gddkia/przejazdy-nienormatywne3 |
| PL | biznes.gov.pl kat. V / II–IV (e-usługa) | VERIFIED | https://www.biznes.gov.pl/pl/portal/ou674 · ou675 |
| SE | Trafikverket **Trix** (transportdispens) | VERIFIED | https://trix.trafikverket.se/ · https://bransch.trafikverket.se/for-dig-i-branschen/vag/Transportdispens/gora-ansokan/ |
| SE | 1 gmina → gmina; multi-gmina → Trafikverket | VERIFIED (opis bransch) | j.w. |

**API wniosków:** **BRAK** publicznego REST do składania zezwoleń — tylko e-usługi / ePUAP / Trix UI. Watch Tower MVP = **upload PDF + metadane** (PermitKind PERIOD/TRIP/REGULATION), nie automatyczne składanie.

---

## Macierz priorytetów integracji MVP

| Priorytet | Źródło | Po co |
|---|---|---|
| P0 | Driver PWA GPS | Pozycja bez API SCX |
| P0 | MapTiler + MapLibre | Mapa korytarza |
| P0 | Polferries HTML / awizacja | Plan rejsu + komunikaty |
| P1 | Trafikverket Situation | Zakłócenia E4 |
| P1 | Open-Meteo Marine + SMHI | Ryzyko pogody/fal |
| P1 | ORS HeiGIT driving-hgv | ETA road (heurystyka) |
| P2 | GDDKiA KPD DATEX | Utrudnienia PL |
| P3 | rFMS OEM | Pozycja floty bez PWA |

---

## Brief dla koordynatora

- **Polferries nie ma publicznego API** — rozkład + komunikaty tylko HTML (zweryfikowane 2026-09-23); scraping = ryzyko ToS; MVP: awizacja SCX + monitoring strony komunikatów.
- **Trafikverket Open API** (`api.trafikinfo.trafikverket.se/v2/data.json`) = najmocniejsze darmowe źródło SE (Situation / RoadCondition / WeatherStation); klucz darmowy; filtr E4 do zweryfikowania po rejestracji.
- **GDDKiA KPD DATEX II 3.4** = właściwy kanał utrudnień PL, ale **onboarding + certyfikat** — nie blokować MVP; planować równolegle.
- **Mapa:** MapLibre + MapTiler (style.json + key) — już w planie UX; routing truck → **ORS HeiGIT** `api.heigit.org/openrouteservice/v2/directions/driving-hgv` (stary host wyłączony 2026-08-24).
- **Pozycje MVP = PWA GPS kierowcy**; rFMS ACEA v5 istnieje jako standard OEM, ale nie jako open endpoint.
- **Morze:** Open-Meteo Marine (live) + SMHI SNOW1gv1 (nie PMP3); nie obiecywać auto-cancel rejsu na bazie fal.
- **Porty Gdańsk / Nynäshamn:** brak publicznego API anløpów; strony HTML Stockholms Hamnar / Gdansk Pilot.
- **Zezwolenia:** tylko portale (biznes.gov.pl, Trix) — szczegóły w `PERMITS_PL_SE.md`; Watch Tower trzyma dokumenty, nie składa wniosków API.
