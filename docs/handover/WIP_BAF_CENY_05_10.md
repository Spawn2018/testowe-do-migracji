# WIP — BAF i ceny (polecenie 05.10 ~21:48 + uzup. ~21:51)

Gałąź `fix/baf-ceny-05-10`. Czas Europe/Warsaw.

| Element | Stan |
|---|---|
| Migracja **0187** `0187_baf_goeasy_ceny.sql` | w repo (commit `68c8db9`); **NIE nałożona na PROD**. Próba na PROD w wycofanej transakcji **OK** 22:23 (tydz. 40 = 1,14, tydz. 41 = 1,13; 86/94 wycenione) |
| Brama lokalna | przebieg 2 (`c654b7f`): wszystko zielone poza dec-auto 60/64 (SEFS L-1b) → poprawione w `68c8db9` (dec-auto 64/64, baf 28/28, i31 9/9, money 135/135 osobno). **Pełna brama na `68c8db9` uruchomiona 22:23** → log `/tmp/gate_baf3.log` (ok. 8 min). session 26/1 = KNOWN-DEBT (niesprawdzane w bramie) |
| Testy `tests/db/baf.sh` | **28/28** lokalnie (w bramie jako `check baf 28`) |
| `i31.sh` | dostosowany do średniej z publikacji (9/9) |
| Edge `fuel-prices` | kod: GoEasy Diesel firmowa + `published_on` (Orlen effective date / OKQ8 „Gäller fr.om”); **do wdrożenia po 0187** |
| UI | Ceny: pigułka „wstępny”; baner zezwolenia: „Ładunek ma … m” gdy brak wymiarów zestawu |
| Dokumenty | rejestr decyzji D-2/D-34, PLAN.md (BAF-CENY-05-10), POLECENIA |
| PR | **#129** (otwarty, scalić po zielonej bramie) |
| Raport 94 | `RAPORT_BAF_CENY_94_05_10.md` — wersja z próby w wycofanej transakcji; po apply-prod wygenerować ponownie |

## Następne kroki (jeśli przerwane)
1. Sprawdzić `/tmp/gate_baf3.log` (ostatnia linia `[db] baf 28/28 OK`, brak linii `[db] … oczekiwano`); jeśli przerwana — `bash tests/db/gate.sh` ponownie. Zielona → scalić **PR #129** do `main`.
2. `node scripts/m0187-migrate.mjs dry-run-prod` → `apply-prod` → `verify-prod`.
3. `node scripts/m0187-migrate.mjs report-prod > /tmp/r.txt && python3 scripts/baf-report-94.py /tmp/r.txt docs/handover/RAPORT_BAF_CENY_94_05_10.md`.
4. Edge `fuel-prices` (MCP deploy_edge_function, verify_jwt=false, 4 pliki).
5. Vercel `--prod` z `git archive main` (kopia bez `.git`); `tower.log-mar.pl` i `watch-tower-makieta.vercel.app` → 200.

## Uwagi
- 8 transportów KR bez daty załadunku: stawka KR zależy od liczby aut w konwoju (data załadunku) → wycena wstrzymana (NO_CONVOY), nie zero.
- Tygodnie przyszłe: mnożnik WSTEPNY = ostatnia opublikowana cena; cron `tower-load-price-refresh` co 6 h; po zamknięciu tygodnia OSTATECZNY = migawka.
- Odczyty Q8 Trucks 28.09–05.10 nie są usuwane (append-only): korekta `corrects_id` na GoEasy z powodem.

## Do decyzji koordynatora / właściciela
- **SG-03 (15062/2026/OSL/GDA/P):** `plan_load_date` = 01.10 (tydz. 40 → **1,14**, jak we wzorcu), ale `actual_load_at` = **05.10 13:21** (moment podłączenia emtrack w trasie, nie rzeczywisty załadunek). Reguła D-34/0155 bierze rzeczywisty załadunek przed planem → dziś SG-03 dostaje tydz. 41 = **1,13**. Nie zmieniałem danych (lista STOP). Do wyboru: poprawić `actual_load_at` SG-03 na rzeczywisty załadunek (01.10) albo potwierdzić 1,13.
- 8 × KR bez daty załadunku → brak stawki (konwój 1/2/3 auta nieznany).
