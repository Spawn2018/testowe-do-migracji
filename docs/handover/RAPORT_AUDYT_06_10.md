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

**Produkcja.** (uzupełniane po wdrożeniu — sekcja niżej)
