# WIP — BAF PROGNOZA (06.10.2026)

**Status:** implementacja lokalna gotowa; brama → PR → apply 0189 → deploy.

## Polecenie
66 transportów 16.10–15.12 miało mnożnik **1,12** z niepełnego tygodnia (1 GoEasy 05.10).
Zasada: prev tydzień niezamknięty → **PROGNOZA = ostatni OSTATECZNY** (dziś **1,13**), etykieta „prognoza” w Cenach; po zamknięciu → OSTATECZNY + migawka; odświeżenie przelicza PROGNOZA.

## Zmiany
- Migracja **0189** `supabase/migrations/0189_baf_prognoza.sql`
  - `sefs_last_ostateczny`, `sefs_week_calc` → PROGNOZA bez częściowej średniej
  - `sefs_refresh_prognoza`, `load_price_compute` (brak daty → PROGNOZA)
  - CHECK `fuel_status` + PROGNOZA
- Testy `tests/db/baf.sh` (46 OK): dziś przyszłe = 1,13 PROGNOZA; symulacja zamknięcia tyg. 41; regresja 40/41/TELM
- UI: pigułka `fuel_forecast` (pl/en/sv) w szufladzie transportu
- Skrypt `scripts/m0189-migrate.mjs` (dry-run / apply / verify / fix)

## Po bramie
1. PR + merge main
2. `node scripts/m0189-migrate.mjs apply-prod` (przelicza ~66)
3. Deploy Vercel; obie domeny 200
