# RAPORT — AUDYT PEŁNY 06.10 (AUD-01 … AUD-18)

Źródło: `AUDYT_PELNY_06_10.md`, polecenie `POLECENIA_KOORDYNATORA.md` 2026-10-06 10:34. Punkt po punkcie: przyczyna, poprawka, test, dowód. Zrzuty: `docs/handover/audyt-06-10/`. Czasy Europe/Warsaw.

---

## AUD-01 — Mapa: czas ładowania (A1)

**Przyczyna (potwierdzona w kodzie i pomiarem).**
1. `src/lib/vehiclePositions.ts` pobierał ostatnią pozycję GPS **osobnym `load_track(id, 1)` dla każdego transportu**, a wołały go niezależnie `MapView` (licznik „N pojazdów”) i `CorridorMap` (znaczniki) → **2 × 94 = 188 zapytań** przy wejściu w Mapę, 94 przy kokpicie, 2 przy panelu zlecenia. Na produkcji pozycje GPS ma **1 z 94** transportów (SQL niżej).
2. Podkład czekał na `rpc map_display_state` (zapytanie do bazy przed pierwszym kafelkiem), a `loadRoadLines` pytał o to samo drugi raz (4 wywołania przy przejściu kokpit → Mapa).
3. Kafelek = funkcja `here-raster` na tym samym hoście co dane (`*.supabase.co`): w kolejce za zapytaniami, po kolei `getUser` → `here_tiles_open` → HERE → licznik, odpowiedź `private` — każde otwarcie od nowa, bez pamięci po drodze.

**Poprawka** (gałąź `fix/aud-01-mapa`).
- Migracja **0190** `latest_vehicle_fixes(p_loads uuid[])` — jedna funkcja SQL dla wszystkich widocznych transportów; zwraca **tylko transporty z pozycją GPS** (ostatni punkt, przyciągnięty albo surowy). Security invoker = RLS `positions_read` jak `load_track`; anon bez EXECUTE; maks. 500 id; indeks `positions(load_id, ts desc)`.
- Klient: jedno wywołanie, wspólne przez 30 s dla tego samego zestawu (licznik + mapa = 1 zapytanie). `TrackReplay` (odtwarzanie „Ślad”) nie pyta o przebieg transportu bez żadnej pozycji.
- Podkład bez czekania na bazę: budżet D-78 sprawdza funkcja przy pobraniu z HERE (409 → podkład zapasowy, jak dotąd). `map_display_state` — jeden odczyt na stronę (TTL 60 s).
- **Kafelki przez brzeg Vercel** (bez nowego klucza właściciela): przeglądarka pobiera `/tiles/<motyw>/<z>/<x>/<y>` z domeny aplikacji; `vercel.json` przepisuje to do `here-raster` z `x-vercel-enable-rewrite-caching: 1`, funkcja oddaje 200 z `Vercel-CDN-Cache-Control: max-age=604800` (brzeg 7 dni) i `Cache-Control: public, max-age=86400` (przeglądarka 1 dzień), bez `Vary`. Token sesji w `x-wt-token` (żądanie z `Authorization` Vercel zawsze pomija pamięć). Funkcja wdrożona z `--no-verify-jwt` (jak `driver-photo`) i sama sprawdza sesję (`auth.getUser`), równolegle z budżetem; bez sesji 401 `no-store` (nie trafia do pamięci). Licznik D-78 (`here_note_service('tiles')`) liczy **każde pobranie z HERE** (w tle, `waitUntil`); trafienie w pamięć brzegu nie woła HERE, więc nie kosztuje i nie jest liczone.
- Hosting zapasowy (PR8, Cloudflare Pages) nie ma przepisania — klient po 404/HTML przechodzi wprost na funkcję (`edgeMissing`); test `hosting-switch` zaktualizowany świadomie (jedyne przepisanie = `/tiles`).
- Mapa (produkcja): pozycje, trasa, sytuacje i AIS ładują się **po narysowaniu podkładu** (zdarzenie `load`) albo najpóźniej po 1,5 s. Dotyczy wszystkich trzech map (Mapa, kokpit, panel zlecenia — ten sam komponent `CorridorMap`).

**Test.**
- `tests/aud01-mapa.test.ts` 11/11 (94 id → 1 wywołanie; współdzielenie w TTL; brak id z serwera → 0 zapytań; `/tiles` na domenie aplikacji, localhost wprost; `vercel.json`; nagłówki funkcji; podkład bez `map_display_state`; dane po podkładzie). `hosting-switch` 5/5.
- Baza: `tests/db/i2.sh` +5 (EXECUTE anon/authenticated; z 2 transportów tylko ten z pozycją; duplikaty/NULL; pusta tablica; inny przewoźnik 0 wierszy — RLS) → **i2 540/540**; null-guard +4 → **597/597**; cała brama DB OK (security 88/88 … baf 46/46).
- Próba na produkcji w transakcji wycofanej: HHL, 94 id → **1 wiersz**, 214 ms; anon EXECUTE false, authenticated true; po `rollback` funkcji brak.

**Pomiar przed / po** — `scripts/audyt/aud01-measure.mjs`, Playwright Chromium, świeży kontekst, build produkcyjny (`VITE_AUTH_MODE=supabase`) z podstawioną bazą (94 transporty, 1 z GPS; baza 120 ms, kafelek 250 ms). Przed = `main` `f87e338`, po = gałąź AUD-01. Liczby zapytań są dokładne (ten sam kod co produkcja); czasy w makiecie są orientacyjne (brak kolejki połączeń i zimnego startu funkcji). Okno 12 s od wejścia w Mapę (klawisz `m` z kokpitu).

| | 1366 przed | 1366 po | 390 przed | 390 po |
|---|---|---|---|---|
| zapytania do bazy przy otwarciu Mapy (12 s) | **195** | **4** | **195** | **4** |
| w tym `load_track` | 188 | 0 | 188 | 0 |
| `map_display_state` | 4 | 1 | 4 | 1 |
| pozycje GPS (`latest_vehicle_fixes`) | — | 0 (wspólne z kokpitem, 1 zapytanie) | — | 0 (j.w.) |
| droga kafelka | `*.supabase.co/functions/v1/here-raster` | `/tiles/light/z/x/y` (domena aplikacji) | j.w. | j.w. |
| pierwszy / komplet kafelków (makieta) | 695 / 695 ms | 431 / 431 ms | 701 / 701 ms | 439 / 439 ms |
| kokpit: zapytania (start aplikacji) / `load_track` | 123 / 94 | 28 / 0 (+1 `latest_vehicle_fixes`) | 123 / 94 | 28 / 0 |
| panel zlecenia: zapytania / `load_track` | 12 / 2 | 8 / 0 (+1) | 12 / 2 | 8 / 0 |

Kryterium „zapytań przy otwarciu Mapy ≤ 20”: **4** ✔. „Zero zapytań dla transportów bez pozycji”: ✔ (1 zapytanie zbiorcze, zwraca 1 transport). Zrzuty: `audyt-06-10/aud01-przed-makieta-1366.png`, `aud01-przed-makieta-390.png`, `aud01-po-makieta-1366.png`, `aud01-po-makieta-390.png`, `aud01-po-makieta-1366-panel.png`; surowe wyniki `aud01-przed-makieta.json`, `aud01-po-makieta.json`.

**Produkcja:** sekcja „AUD-01 — wdrożenie” niżej.

### AUD-01 — wdrożenie (06.10)

| krok | wynik |
|---|---|
| PR | #137 scalony → `f291c84` (11:16) |
| migracja 0190 na PROD | funkcja jest; anon EXECUTE false, authenticated true; `schema_migrations` 0190 `aud01_latest_vehicle_fixes` (jak 0185–0189) |
| funkcja `here-raster` | wdrożona z `--no-verify-jwt` (`--use-api`); bez sesji → 401 `{"fallback":true}` z funkcji |
| Vercel prod | `dpl_Hv5CtFjKrs3TDbtnMAVRW36MsJmJ`, alias tower.log-mar.pl; **tower.log-mar.pl 200, watch-tower-makieta.vercel.app 200** (ta sama paczka `index-CrEe5lT7.js`) |
| paczka prod | `latest_vehicle_fixes` ✔, `x-wt-token` ✔, `/tiles/` ✔, `service_role` 0, `load_track(…, p_limit:1)` 0 |
| `/tiles/light/4/8/4` na obu domenach bez sesji | 401, `cache-control: no-store`, `x-vercel-cache: MISS` — przepisanie działa, odpowiedzi bez sesji nie trafiają do pamięci |
| SQL prod | 94 transporty aktywne, **1** z pozycją GPS, 217 wierszy `positions`; `latest_vehicle_fixes(94 id)` jako HHL → 1 wiersz, 214 ms |

**Pomiar prod po zalogowaniu — dopisze koordynator** (czasy kafelków 1366/390, zapytania przy otwarciu Mapy, `x-vercel-cache: HIT`).

**Czego nie zmierzyłem na produkcji:** pierwszy kafelek ≤ 2 s / komplet ≤ 5 s / zapytania ≤ 20 po zalogowaniu i trafienie `x-vercel-cache: HIT` dla kafelka. Wymaga zalogowanej sesji (konto testowe HHL); wykonawca nie ma danych logowania i nie tworzy sobie dostępu. Do wykonania przez osobę z kontem testowym:
`APP=https://tower.log-mar.pl STORAGE=<storageState.json zalogowanej sesji> LABEL=prod-po node scripts/audyt/aud01-measure.mjs` (1366 i 390 px, wynik JSON + zrzuty). Drugi przebieg w nowym kontekście powinien mieć kafelki z `x-vercel-cache: HIT`.

**Do potwierdzenia przez właściciela:** pamięć kafelków HERE na brzegu Vercel 7 dni (przeglądarka 1 dzień) — zgodność z warunkami licencji HERE; w razie potrzeby skrócić `vercel-cdn-cache-control` w `here-raster`.

**Znalezisko przy okazji (P2-TILES):** podkład zapasowy ciemny (CARTO `dark_all` bez klucza) zwraca dziś kafelek „API KEY REQUIRED” — widoczny, gdy budżet HERE jest zamknięty i motyw ciemny.

## AUD-01c — awaria mapy na produkcji (polecenie właściciela 06.10 13:45)

Wdrożenie: PR #140 (scalenie `6e93d2d`), Vercel `dpl_GWYpijKvAdJhBjKefkm8z81w1BWJ`, `here-raster` z `6e93d2d` (`--no-verify-jwt`), bez migracji. Stan zastany: #139 był wdrożony w całości (Vercel `dpl_CPmwRuXGv1Vnj2GsBAgRcF4XSWyJ`, `here-raster` z `ebec592`, bez migracji). Dowody curl: `audyt-06-10/aud01c-curl-po.txt`, `audyt-06-10/aud01c-curl-24.txt` (box wychodzi do sieci z USA — czasy w Polsce będą krótsze; pomiar w przeglądarce po zalogowaniu kontem TEST — koordynator).

| Krok | Przyczyna | Poprawka | Test / dowód |
|---|---|---|---|
| 1. `/tiles/logistics.day|night` → 404 HTML | `vercel.json` przepisywał tylko `light|dark` | `/tiles/:styl/:z/:x/:y[.png]` → `api/tiles`; style `logistics.day`, `logistics.night`, `light`(→day), `dark`(→night); inne → 404 JSON `no-store` | 5 kafelków × 2 domeny: 200, `image/png`, bajty `89504e47`; vitest `aud01-mapa` |
| 2. Region | funkcja szła do regionu najbliższego klientowi (us-east), w #139 eu-west-1 | `here-raster` z `forceFunctionRegion=eu-central-1` (Frankfurt — z eu-central-1/eu-north-1 bliżej bazy eu-west-1, Dublin); funkcja Vercel `api/tiles` w `fra1` (`vercel.json` `regions`) | każda odpowiedź: `X-Sb-Edge-Region: eu-central-1`, `x-vercel-id: …::fra1::…` |
| 3. Pamięć brzegu (nigdy HIT) | odpowiedź Supabase niesie `set-cookie: __cf_bm` (Cloudflare) — Vercel nie trzyma odpowiedzi z `set-cookie`; przepisanie zewnętrzne nie mogło dać HIT | `api/tiles` przekazuje tylko obraz + `Cache-Control` (bez ciasteczek, `Vary`, autoryzacji); kafelki publiczne (decyzja właściciela), klient: zwykły `<img>` bez nagłówków. Ochrona: siatka z/x/y ≤ 19, dozwolone style, Referer/Origin (jeśli jest) tylko dwie domeny (+ podglądy `watch-tower-makieta-*.vercel.app`, localhost) → inaczej 403, limit 600 pobrań HERE/min/IP i 3000/min/proces → 429, budżet `here_tiles_open` (cache 60 s) → 409 i klient przełącza na zapas, licznik D-78 każdego pobrania z HERE (zapis zbiorczy co ≤ 2 s). Pamiętane tylko 200 i 404 spoza siatki (1 h); 403/409/429/502 `no-store` | 24/24 MISS → 24/24 HIT (drugi, świeży curl bez ciasteczek); 404 spoza siatki MISS → HIT; obcy Referer 403 `no-store`; licznik D-78: 3 nowe kafelki → `here_usage.tiles` 4074 → 4077 |
| 4. `latest_vehicle_fixes` 500 po 13 s | logi Supabase: jedyny 500 dziś (06.10 ~11:2x, 13 364 ms) = `canceling statement due to statement timeout` (8 s) w czasie zimnego startu mapy, gdy `here-raster` robił 3 wywołania bazy/Auth na kafelek (07:00–08:00 UTC: 68 timeoutów, 400× `here_note_service` + 397× `here_tiles_open` na godzinę). Plan zapytania jest dobry | #139 (bez bazy na kafelek, ponowna próba w kliencie) + #140 (kafelki z brzegu: HIT nie dotyka bazy) | od wdrożenia #139 (12:02): 0 timeoutów, 0 × 500, 126 wywołań, śr. 361–469 ms (z siecią), maks. 2,3 s. EXPLAIN ANALYZE na PROD (tylko odczyt) dla 94 transportów: **37 ms** całość; ciało: `Index Scan Backward using positions_load_id_ts_source_key` 94 pętle × 0,044 ms |
| 5. Ciemny zapas „API KEY REQUIRED” | CARTO od 09.2026 wymaga klucza: `basemaps.cartocdn.com/dark_all|light_all/…` bez klucza zwraca ten sam obraz-znak wodny (md5 `df9307c7` / `502fc5f6` dla każdego z/x/y) | CARTO bez klucza niemożliwe (potrzebny klucz od CARTO: rejestracja e-mailem i akceptacja warunków; komercyjnie płatne — decyzja właściciela). Ciemny zapas = Esri `World_Street_Map` (bez klucza, z etykietami, już w CSP) z ciemnym filtrem CSS `.wt-tiles-dark`; nie „szary Esri” (zasada B-MAPA) | `bmapa.test`: przy 80% budżetu ciemny = World_Street_Map + `wt-tiles-dark`, bez `cartocdn`; Esri 200 `image/jpeg` z/x/y różne; gate:visual — 24 ciemne ujęcia Mapa/kokpit odświeżone świadomie (przyczyna `2122418`, w starych wzorcach był znak wodny CARTO) |
| 6. Pomiar bez logowania | — | — | 24 kafelki z12 (tower.log-mar.pl, z USA): zimne MISS mediana 0,86 s (maks. 1,08 s; w tym funkcja→HERE mediana 388 ms), ciepłe HIT mediana 0,23 s (maks. 0,31 s; to głównie TLS i ocean — z Polski krócej); watch-tower-makieta.vercel.app HIT 0,04–0,07 s |
| 7. Pamięć 7 dni a warunki HERE | — | `s-maxage` = `max-age` z nagłówka HERE (dziś `max-age=86400`), najwyżej 7 dni → **24 h zamiast 7 dni**; bez `stale-while-revalidate` (nagłówek HERE go nie daje) | `x-here-cache-control: max-age=86400` w odpowiedzi |

**Warunki HERE — cytaty:**

- HERE Platform Terms, Location Services Terms 1.3 (https://www.here.com/en-gb/terms/here-platform-terms-september-2023): „In addition to the caching restrictions in the Platform Terms, you may not use HERE Materials in a manner that pre-fetches, caches, or stores data or Results, except as explicitly allowed by the caching headers (HTTP/1.1 standard) returned by HERE Location Services.”
- Ta sama strona, 6.4 l): „You may not: … Create any Results that contain unenhanced or unmodified HERE Content or scaling one Request to serve multiple End Users;” oraz 6.4 j) „Cache or store outside of the Platform any Results … for more than 30 days …”.
- HERE Docs, Raster Tile API „Cache tiles efficiently” (https://docs.here.com/map-rendering/docs/cache-maps-raster-tile-api): „HERE recommends that you set the maximum cache duration to `86400` seconds (24 hours) …” oraz „caching or storing any location data for the purpose of building a repository of location assets or scaling one request to serve multiple end users is prohibited.”

Wniosek: HERE pozwala na tyle, ile mówi nagłówek (dziś 24 h) — `s-maxage` skrócone do nagłówka. **Do decyzji właściciela (licencja):** wspólna pamięć brzegu z natury obsługuje jednym pobraniem z HERE wielu użytkowników, czego dotyczy zakaz „scaling one Request to serve multiple End Users”. Kafelki publiczne i pamięć wspólna wdrożone zgodnie z poleceniem 13:45; jeśli właściciel (albo HERE) uzna to za niezgodne — przełączenie na pamięć tylko w przeglądarce to jedna linia (`tileCacheControl`: `private, max-age=…`), kosztem braku HIT na brzegu.

## AUD-01d — podkład: bez wspólnej pamięci brzegu, HERE wprost z przeglądarki (decyzja właściciela 06.10 16:28)

**Przyczyna.** AUD-01c postawił pamięć kafelków HERE na brzegu Vercel (`s-maxage`) — jeden pobrany kafelek obsługiwał wielu użytkowników (drugi klient: `x-vercel-cache: HIT`). Warunki HERE (Platform Terms §1.3, §6.4 l) zabraniają skalowania jednego zapytania na wielu użytkowników i pobierania z wyprzedzeniem; pamięć wolno trzymać tylko tyle, ile pozwalają nagłówki HERE.

**Poprawka (PR #142, `55849da`).**
1. `api/tiles` i `here-raster`: `Cache-Control: private, max-age=<max-age HERE, ≤ 86400>`, bez `s-maxage`/`CDN-Cache-Control` (`api/tiles` wymusza `private` nawet przy starym nagłówku z góry). `x-vercel-enable-rewrite-caching` — nie występuje w `vercel.json` (sprawdzone, test). Pośrednik zostaje tylko jako zapas.
2. Główna droga: przeglądarka → `https://maps.hereapi.com/v3/base/mc/{z}/{x}/{y}/png?style=logistics.day|night&size=256&apiKey=<VITE_HERE_BROWSER_KEY>`; brak zmiennej → pośrednik `/tiles`; 3 błędy kafelka HERE wprost (np. zła domena klucza) → pośrednik do końca strony. Klucz serwerowy `HERE_API_KEY` nie trafia do klienta (test). CSP `img-src` + `https://maps.hereapi.com` (`vercel.json`, `public/_headers`).
3. D-78 z przeglądarki (`src/components/map/hereTileMeter.ts`): liczy `tileload` kafelków HERE wprost, z pominięciem trafień w pamięć przeglądarki, gdy to widać (Resource Timing `transferSize=0` przy `decodedBodySize>0` — wymaga `Timing-Allow-Origin` od HERE; bez tego liczone są wszystkie pobrania — licznik zawyża, nie zaniża). Zgłoszenie zbiorcze co 60 s oraz przy `pagehide`/ukryciu karty przez `fetch(..., {keepalive:true})` (odpowiednik `sendBeacon`; `sendBeacon` nie niesie nagłówków `apikey`/`Authorization` Supabase) do RPC `here_tiles_report(p_n)` — migracja **0191**: tylko aktywne konto (`current_app_user_id`), 0–5000 na wywołanie, ≤ 20 000 na konto na minutę, `here_note_service('tiles', n)` → `here_usage.tiles`; odpowiedź = `tiles_open` (wydatek < 80% budżetu) — jedyny odczyt budżetu, najwyżej raz na minutę; `false` → podkład zapasowy do końca sesji. W trybie pośrednika licznik prowadzi dalej `here-raster` (bez podwójnego liczenia).
4. Pobieranie z wyprzedzeniem: w kodzie go nie było (sprawdzone `git log -S prefetch/keepBuffer`, `rg`), test pilnuje braku `prefetch|keepBuffer|preload` w warstwie. **Jedna instancja mapy na sesję (punkt 3 z AUD-01b) — w kodzie jej nie ma** (każdy widok montuje własną mapę Leaflet); nie budowane w AUD-01d — do decyzji/zlecenia (warunek dla celu „kolejne otwarcia ≤ 0,3 s”).

**Testy.** `tests/aud01d-podklad.test.ts` 7/7 (adres HERE, wykrywanie pamięci, licznik: zbiorczo/≤ 1×min/≤ 5000/ponowienie/80% → zapas/`pagehide`, warstwa, CSP, brak klucza serwerowego, migracja), `tests/aud01-mapa.test.ts` 16/16 (private, bez s-maxage). Baza: `tests/db/bmapa.sh` +10 (anon bez EXECUTE, okno niedostępne, +40 → `here_usage.tiles` +40, 0 → stan, >5000/ujemne/>20 000 na minutę/bez konta odrzucone, ≥ 80% → `tiles_open=false`) → **33/33**; lista EXECUTE + null-guard (**602/602**). Brama: vitest 859/0, tsc, lint 0 błędów, gitleaks 0, `npm audit --omit=dev --audit-level=high` 0, fresh-smoke OK, brama DB OK (session/l13 — znany dług 05.10). Bez zmian wizualnych bez klucza → bez gate:visual.

**Dowody (curl, prod).**
- PRZED (16:37, `dpl_GWYp…`): `/tiles/logistics.day/7/70/41` klient 1 `cache-control: public, max-age=86400`, `x-vercel-cache: MISS`; klient 2 → **`HIT`** (wspólna pamięć).
- PO (17:25, Vercel `dpl` z `55849da`, alias tower.log-mar.pl; pakiet `index-B-f4r6eC.js`; `here-raster` v8): obie domeny `/` 200; `/tiles/logistics.day/8/141/82` ×3 na każdej domenie → `200 image/png 76 110 B`, `cache-control: private, max-age=86400`, **brak `s-maxage`**, `x-vercel-cache: MISS` za każdym razem (także drugi i trzeci klient); ten sam kafelek co PRZED (`7/70/41`) ×2 → `MISS`, `MISS`. Czasy przez pośrednika 0,87–1,27 s na kafelek (bez wspólnej pamięci każdy kafelek idzie do HERE; główna droga = HERE wprost po włączeniu klucza). CSP prod: `img-src … https://maps.hereapi.com …`.
- SQL prod: `here_tiles_report` — anon `false`, authenticated `true`; `here_tile_reports` RLS on, SELECT dla konta `false`; `here_tiles_open` = `true`; `here_usage.tiles` 10.2026 = 4 309.
- Wdrożenie Vercel z repozytorium było zablokowane („team configuration”, autor scalenia GitHub) — wdrożono z czystego `git archive 55849da` (jak AUD-01c).

**Czeka na właściciela — klucz przeglądarkowy HERE.** Nie mamy dostępu API do konta HERE (tylko klucz serwerowy `HERE_API_KEY`; utworzenie klucza i zaufanych domen wymaga panelu albo tokenu OAuth konta HERE). Kroki:
1. https://platform.here.com → zaloguj → launcher (prawy górny róg) → **Access Manager** → zakładka **Apps** → **Register new app** (np. „Watch Tower — przeglądarka”, Default access to a project: *No project*). Osobna aplikacja, bo zaufane domeny działają na całą aplikację — włączone na obecnej zablokowałyby klucz serwerowy (`here-raster`, `here-roads`, wywołania bez nagłówka Referer).
2. W nowej aplikacji: **Credentials → API Keys → Create API key**.
3. Zakładka **Trusted domains**: dodaj `https://tower.log-mar.pl` oraz `https://watch-tower-makieta.vercel.app` → przełącz **Enable trusted domains** na włączone.
4. Vercel → projekt `watch-tower-makieta` → Settings → Environment Variables → **`VITE_HERE_BROWSER_KEY`** = nowy klucz, środowisko Production → ponowne wdrożenie (zmienna `VITE_` wchodzi do pakietu przy budowie).
5. Po wdrożeniu: na mapie `data-tile-path="here-direct"`, kafelki z `maps.hereapi.com`, licznik `here_usage.tiles` rośnie co ≤ 60 s.

Pomiar właściciela (pierwsze otwarcie dnia ≤ 2 s, kolejne ≤ 0,3 s, 1366/390 px) — po włączeniu klucza; cel „kolejne ≤ 0,3 s” wymaga też jednej instancji mapy na sesję (nie ma jej w kodzie, patrz pkt 4).

### AUD-01d — klucz przeglądarkowy HERE włączony (06.10 ~18:00)

Właściciel utworzył klucz (osobna aplikacja HERE, Trusted domains), koordynator dodał `VITE_HERE_BROWSER_KEY` (Vercel Production). Ponowne wdrożenie `main` (`b2051b0`) z `git archive` → alias tower.log-mar.pl, pakiet `index-CV7Mungi.js`. Sprawdzenie: pakiet zawiera drogę HERE wprost (`maps.hereapi.com` ×1), klucz wbudowany (zgodność z wartością w środowisku, bez wypisywania), RPC `here_tiles_report`; CSP `img-src` z `https://maps.hereapi.com` na obu domenach; klucz z Referer `https://tower.log-mar.pl/` → 200 image/png, `https://watch-tower-makieta.vercel.app/` → 200 image/png, obca domena → 401. `watch-tower-makieta.vercel.app/` 200. `tower.log-mar.pl/` z adresu IP skrzynki → 403 `x-vercel-mitigated: deny` (zapora Vercel po serii pobrań kawałków pakietu; z zewnątrz strona odpowiada — WebFetch OK). `here_usage.tiles` 10.2026 = 4 309, `here_tile_reports` 0 wierszy do 18:12 — nikt zalogowany nie otworzył mapy; zgłoszenie z przeglądarki do potwierdzenia sesją zalogowaną (koordynator).

## AUD-01e — jedna mapa na sesję (decyzja koordynatora z polecenia właściciela AUD-01d)

**Przyczyna.** Każdy widok (Mapa, mini-mapa kokpitu, panel zlecenia) montował własną mapę Leaflet i niszczył ją przy wyjściu (`L.map` / `map.remove()` w `CorridorMap`): przy każdym powrocie nowa mapa, nowy podkład (`applyBasemap`), 32 nowe kafelki `<img>` na widok Mapa 1366 px, dane mapy dopiero po narysowaniu podkładu.

**Poprawka.** `src/components/map/mapPool.ts`: jedna mapa na kartę. Widok wpina element `.corridor-map-el` do swojego gniazda (`.corridor-map-host`), przy zamknięciu odkłada go do ukrytego schowka o tym samym rozmiarze (Leaflet nie przycina kafelków) — mapa, podkład i warstwy zostają. Widok (środek/zoom/rozmiar) zapamiętany per miejsce (`map` / `kokpit` / `drawer`): powrót bez zmian → nic (zero kafelków); inne miejsce/rozmiar → `setView(reset)` + nowy renderer SVG i warstwy wektorowe (piksel w piksel jak świeża mapa — wzorce wizualne bez zmian). Podkład zakładany raz na motyw (`ensureBasemap`), przełączenie zapasu D-78 działa niezależnie od widoku. Gdy mapa jest zajęta (panel zlecenia nad widokiem Mapa) — mapa jednorazowa, niszczona przy zamknięciu. Słuchacze (`zoomend`), `ResizeObserver`, `requestAnimationFrame`, `setTimeout`, `load` zdejmowane przy zamknięciu. Bez pobierania z wyprzedzeniem.

**Testy.** `tests/aud01e-map-pool.spec.ts` (Playwright, przeglądarka): `created`=1 po kokpit→Mapa→Harmonogram→Mapa×3→kokpit→Mapa, ten sam element DOM, 1 `.leaflet-container`, 0 nowych żądań i 0 nowych `<img>` kafelków przy powrocie, liczba słuchaczy `zoomend`/`moveend` stała, panel zlecenia nad Mapą → mapa jednorazowa zniszczona po zamknięciu, powrót ≤ 300 ms. `tests/aud01e-map-pool.test.ts` 4/4 (źródło). Brama: vitest 863/0, tsc, lint 0 błędów, gate:visual OK (smoke+stany ok, matryca 280/280, 0 zmienionych), etap5/b7/e2e-core 22/22 (jeden niestabilny przebieg etap5 D14 — 15/15 przy 3× powtórzeniu, także na `main`), fresh-smoke OK.

**Pomiar lokalny (podgląd demo, 1366×900, Chromium; czas klik → mapa ma rozmiar i wszystkie kafelki widoku wczytane):**

| przejście | PRZED (`main`) | PO |
|---|---|---|
| kokpit → Mapa (pierwsze) | 304–502 ms, 32 nowe `<img>` | 278–324 ms, 10 nowych `<img>` |
| Harmonogram → Mapa (powrót, ×3) | 35–40 ms, **32 nowe `<img>`** za każdym razem | 33–42 ms, **0 nowych `<img>`**, 0 żądań |
| Mapa → kokpit | 35–48 ms, 12 nowych `<img>` | 34–42 ms, 0* |
| kokpit → Mapa | 36–46 ms, 32 nowe `<img>` | 34–51 ms, 0* |

*pierwszy pomiar przed dodaniem `reset` przy zmianie miejsca; po `reset` kafelki kokpit↔Mapa są tworzone ponownie z pamięci przeglądarki (cena zgodności wzorców), powrót do tego samego widoku nadal 0. Lokalnie kafelki są w pamięci przeglądarki, więc czasy PRZED też są krótkie; na produkcji różnica to brak ponownego tworzenia mapy, podkładu (`applyBasemap`, odczyt budżetu) i opóźnienia danych do 1,5 s. Pomiar prod (konto testowe, 1366/390 px) — koordynator.

### AUD-01d/e — wdrożenie produkcyjne (06.10 18:29)

| zmiana | commit `main` | wdrożenie Vercel (Production) |
|---|---|---|
| AUD-01d (podkład `private`, HERE wprost, licznik D-78) | `55849da` (#142) | `dpl_C56cUTUKuXjSAcAARfRLvBk2FMuz` (17:25) |
| AUD-01d — klucz `VITE_HERE_BROWSER_KEY` wbudowany | `b2051b0` | `dpl_4axsYajGyaxNag2zZgHvYvHBuQ4c` (~17:58) |
| AUD-01e — jedna mapa na sesję (#144) | `e9d8bf7` | **`dpl_7q3eE1oPS5bmitnHkUHcJS5NRJ6N`** (18:29, `git archive`; aliasy tower.log-mar.pl, watch-tower-makieta.vercel.app) |

Sprawdzenie po `dpl_7q3eE1oPS5bmitnHkUHcJS5NRJ6N`: `watch-tower-makieta.vercel.app/` 200; `tower.log-mar.pl/` odpowiada z zewnątrz (WebFetch: „Watch Tower — Stegra Boden”), z IP skrzynki nadal 403 zapory Vercel (nie obchodzone). Pakiet `index-BcYY9RHN.js` + kawałki: `maps.hereapi.com` ×1, `__wtMapPool` ×1 (mapPool), klucz wbudowany ×1 (bez wypisywania), `here_tiles_report` ×1. Kafelek HERE z kluczem przeglądarkowym: Referer `https://tower.log-mar.pl/` → 200, obca domena → 401. RPC `here_tiles_report` (tylko `authenticated`, anon bez EXECUTE): pierwsze zgłoszenie z zalogowanej przeglądarki 18:13 (n=42) → `here_usage.tiles` 10.2026: 4 309 → 4 392 — licznik D-78 z przeglądarki działa na produkcji.

## AUD-02 — dzwonek (A2)

**Przyczyna.** `NotificationBell` pokazywał surowy temat powiadomienia: dla szablonów bez tekstu PL (`RISK_OPEN`, `RISK_RESOLVED`, `RISK_SEVERITY`, `ZONE_ENTER/EXIT`, `LOAD_STATUS_CHANGED`, `DECISION_RESOLVED`) — kod szablonu (prod: 1 812 wierszy); tytuły ryzyk z technicznym przedrostkiem `2fc65160: `; bez kodu transportu; czas „15m / 1.5h”; każde zdarzenie osobno (2 539 nieprzeczytanych). Klik: ładunki ryzyk/stref nie niosą kodu transportu → `/transport/brak`; szablony spoza tabeli CELE nie miały celu L-4.

**Poprawka.** `supabase/functions/_shared/notifyTemplates.ts` — teksty PL/EN/SV dla brakujących szablonów, nieznany szablon → „Powiadomienie” (nigdy kod). `src/lib/bellList.ts` — `bellTitle` („SG-11 · co się stało”, kod z magazynu transportów po `load_id`, zapasowo z ładunku; bez przedrostka id), `bellAge` („teraz / 15 min temu / 3 godz. temu / wczoraj / 5 dni temu”, en/sv), `bellGroups` (transport + rodzaj = jedna pozycja: najnowsza treść, ×N, najwyższa waga, „3 zdarzenia tego rodzaju”), `withLoadCode`. `clickTargets.ts` — `noticeType`: cel jak dla zdarzenia źródłowego (ryzyko → jego rodzaj, strefa → GEOFENCE_*, status → STATUS_CHANGE, decyzja → karta decyzji). `useTowerStore.openNotification` — `/transport/<kod z load_id>`; klik w grupę otwiera najnowszą pozycję, reszta grupy przeczytana. `mappers.ts` — bez zdania dla e-maila w treści dzwonka. `send-notifications` bez ponownego wdrożenia (treść e-maili bez zmian — osobna decyzja).

**Testy.** `tests/aud02-dzwonek.test.ts` 6/6: każdy szablon z produkcji → „SG-xx · …” bez kodu szablonu i przedrostka; kod z ładunku, gdy transportu brak w magazynie; grupowanie (licznik, waga, najnowsza treść); „15 min temu”, nie „15m”; nieznany szablon → „Powiadomienie”; klik → cel L-4 najnowszej pozycji, reszta przeczytana, ryzyko → widok ryzyk. Brama: vitest 869/0, tsc, lint 0 błędów, gate:visual OK (smoke+stany ok, matryca 280/280, 0 zmienionych), fresh-smoke OK.

**Dowód.** `docs/handover/audyt-06-10/aud02-tytuly-po.tsv` — 14 szablonów z produkcji: tytuł, treść, czas, cel z szablonu i cel po kliknięciu (`/transport/brak` → `/transport/SG-11…`). Prod (SQL, 06.10): 1 812 pozycji pokazywało kod szablonu → 0; 2 539 nieprzeczytanych → 1 974 pozycji po grupowaniu.
