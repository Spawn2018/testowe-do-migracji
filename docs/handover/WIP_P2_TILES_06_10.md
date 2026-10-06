# P2-TILES (06.10.2026) — W TOKU

## Cel
Brama wizualna (matryca 280 + smoke Playwright) bierze kafelki podkładu z repozytorium, bez sieci. Produkcja bez zmian.

## Checkpoint 10:45 CEST
- Gałąź `feat/p2-tiles-06-10` z main `70bd625`
- `scripts/visual/tiles.mjs` (TILES=replay domyślnie | record | live); puppeteer w `baseline.mjs`, Playwright `beforeEach` w `visual.spec.ts` i `visual-states.spec.ts`
- `tests/fixtures/tiles/`: 40 kafelków (CARTO dark 20, Esri 20, zoom 4), 536 kB + `_missing.png`; brak kafelka w replay → błąd matrycy
- Dowód: mapa×30 w replay = 30/30 identyczne z `shots-baseline` (też w record); visual+stany 16/16; bez katalogu Esri `mapa…light` FAIL (0,37 ujęcia) → kafelki naprawdę z repo; vitest `p2-tiles` 4/4
- Znalezisko: CARTO `dark_all` bez klucza zwraca „API KEY REQUIRED” (sprawdzone curl 06.10) — produkcyjny podkład zapasowy ciemny (bez HERE) pokazuje ten napis → zgłoszone, poza zakresem P2-TILES
- Następny: pełna matryca w replay (czy inne widoki wołają kafelki), gate:visual, fresh-smoke, testy, scalenie

## 10:36 CEST — ODŁOŻONE (priorytet właściciela: AUDYT PEŁNY 06.10)
- Zatrzymane w czystym punkcie; bez scalenia. Pełna brama (gate:visual/fresh-smoke) uruchomiona na `1024867` przed odłożeniem — wynik w `/workspace/wt-gate-visual/last.txt`.
- Wznowienie: dokończyć bramę, PLAN/POSTEP, scalenie.
