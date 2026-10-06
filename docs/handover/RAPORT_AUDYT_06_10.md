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
