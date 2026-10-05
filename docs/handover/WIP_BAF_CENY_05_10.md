# WIP — BAF i ceny (polecenie 05.10 ~21:48 + uzup. ~21:51)

Gałąź `fix/baf-ceny-05-10`. Czas Europe/Warsaw.

| Element | Stan |
|---|---|
| Migracja **0187** `0187_baf_goeasy_ceny.sql` | w repo; brama lokalna w toku; próba na PROD w wycofanej transakcji **OK** (tydz. 40 = 1,14, tydz. 41 = 1,13; 86/94 wycenione) |
| Testy `tests/db/baf.sh` | **28/28** lokalnie (w bramie jako `check baf 28`) |
| `i31.sh` | dostosowany do średniej z publikacji (9/9) |
| Edge `fuel-prices` | kod: GoEasy Diesel firmowa + `published_on` (Orlen effective date / OKQ8 „Gäller fr.om”); **do wdrożenia po 0187** |
| UI | Ceny: pigułka „wstępny”; baner zezwolenia: „Ładunek ma … m” gdy brak wymiarów zestawu |
| Dokumenty | rejestr decyzji D-2/D-34, PLAN.md (BAF-CENY-05-10), POLECENIA |

## Następne kroki (jeśli przerwane)
1. `bash tests/db/gate.sh` zielona (w tym `baf 28`) → PR → merge do `main`.
2. `node scripts/m0187-migrate.mjs dry-run-prod` → `apply-prod` → `verify-prod`.
3. `node scripts/m0187-migrate.mjs report-prod > /tmp/r.txt && python3 scripts/baf-report-94.py /tmp/r.txt docs/handover/RAPORT_BAF_CENY_94_05_10.md`.
4. Edge `fuel-prices` (MCP deploy_edge_function, verify_jwt=false, 4 pliki).
5. Vercel `--prod` z `git archive main` (kopia bez `.git`); `tower.log-mar.pl` i `watch-tower-makieta.vercel.app` → 200.

## Uwagi
- 8 transportów KR bez daty załadunku: stawka KR zależy od liczby aut w konwoju (data załadunku) → wycena wstrzymana (NO_CONVOY), nie zero.
- Tygodnie przyszłe: mnożnik WSTEPNY = ostatnia opublikowana cena; cron `tower-load-price-refresh` co 6 h; po zamknięciu tygodnia OSTATECZNY = migawka.
- Odczyty Q8 Trucks 28.09–05.10 nie są usuwane (append-only): korekta `corrects_id` na GoEasy z powodem.
