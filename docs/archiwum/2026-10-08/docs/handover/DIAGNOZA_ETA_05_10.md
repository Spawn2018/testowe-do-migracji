# DIAGNOZA-ETA — SG-01, SG-24, KR-04…KR-07 (05.10.2026 ~11:50 PL)

Bez zmian w kodzie. Odczyt produkcji `nglnnrmzmhusvxslousq`.

## Wynik zbiorczy

| Kod | Status | GPS (pozycje) | eta_site | eta_computed_at (UTC) | Skąd ETA | Werdykt |
|---|---|---|---|---|---|---|
| SG-01 | PLANNED | **0** | 2026-10-07 16:00Z | 2026-10-04 12:30 | **z planu** (ETA v2 OSM, segment PLANNED, żaden GPS) | **P1** — wartość z planu |
| SG-24 | READY | **0** | 2026-10-30 17:00Z | 2026-10-01 22:24 | **z planu** (flaga „przed załadunkiem — start z planu załadunku”) | **P1** — wartość z planu |
| KR-04 | PLANNED | **0** | 2026-12-13 17:00Z | 2026-10-01 22:24 | **z planu** (ta sama flaga) | **P1** |
| KR-05 | PLANNED | **0** | 2026-12-18 17:00Z | 2026-10-01 22:24 | **z planu** | **P1** |
| KR-06 | PLANNED | **0** | 2026-12-13 17:00Z | 2026-10-01 22:24 | **z planu** | **P1** |
| KR-07 | PLANNED | **0** | 2026-12-17 17:00Z | 2026-10-01 22:24 | **z planu** | **P1** |

## Szczegóły

- Ostatnia pozycja GPS: **brak** dla wszystkich sześciu (`pos_n = 0`, `last_pos = null`).
- `eta_basis.method` = `ETA v2 (OSM)`; `causes.progress` = `status` (nie GPS).
- Flagi typowe: `przed załadunkiem — start z planu załadunku` oraz/lub `brak przypisanego rejsu — założony najbliższy z rozkładu`.
- `actual_load_at` = null we wszystkich; żaden nie wyjechał ze strefy Śrem.
- Wartości `eta_computed_at` są z **01.10** (KR-*, SG-24) oraz **04.10** (SG-01) — sprzed lub obok 0158 (ETA-PRE-LOAD). Sprzątanie starych wartości → **R-0** (po akceptacji).

## Miejsce w kodzie (źródło błędu P1)

ETA liczona przy statusie/planie bez pozycji GPS trafia do `loads.eta_site` przez funkcje ETA v2 (OSM / korytarz), m.in. ścieżka z migracji **0122** / **0146** (`positions` puste → start z planu załadunku). Decyzja D-80 / ETA-PRE-LOAD (0158): przed wyjazdem ze strefy placu w Śremie UI ma pokazywać „–”; wartości w bazie sprzed czyszczenia R-0 pozostają do usunięcia z transportami.

## Zalecenie (bez naprawy w tej pozycji)

1. W raporcie dla właściciela: wszystkie 6 = ETA z planu, zero GPS → błąd P1 widoczności.
2. Posprzątać przy R-0 (kasowanie transportów kasuje też `eta_*`).
3. Osobna naprawa (jeśli po R-0 nadal cron/wyzwalacz zapisuje ETA z planu przed załadunkiem): nie zapisywać `eta_site` gdy brak pozycji i brak `GEOFENCE_EXIT` LOADING — poza zakresem DIAGNOZA-ETA.
