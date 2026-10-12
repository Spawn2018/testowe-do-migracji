---
name: tower-migracja-bazy
description: Nakłada zmianę bazy danych Watch Tower bezpiecznie i w zgodzie z AGENTS.md. Użyj przy każdej zmianie schematu, funkcji, reguł dostępu, zadań cyklicznych i danych jednorazowych z planu.
---

# tower-migracja-bazy (wersja 08.10.2026)

1. Ostatni numer migracji lokalnie = na produkcji. Numer nowej migracji = następny wolny **w chwili rebase na `main`** przed bramą końcową paczki — sprawdzasz `node scripts/_check-mig-parity.mjs` (D-20261012-2210-01 R4).
2. `supabase/migrations/NNNN_nazwa.sql`.
3. Nowa tabela → RLS, reguły ról, zero uprawnień `anon`, test w zestawie bezpieczeństwa, wpis w liście kopii (`_shared/backup/core.ts`). Nowa funkcja → `is not true`, `set search_path`, dziennik audytu; dla `authenticated` → `function-allowlist.txt`, `null-guard-calls.txt`.
4. W trakcie pracy: zestawy dotknięte zmianą (`gh workflow run db.yml --ref <gałąź> -f suites=a,b`, D-86). Zmiana liczby testów → jedno źródło liczb.
5. Przed wdrożeniem: check `db` (GitHub Actions) zielony na tym samym SHA (D-86).
6. Potwierdzenie na TEST: zestawy `security`, `status`, `nullguard` i dotknięte migracją (`scripts/test-db-gate-step.mjs`) — uruchomienie bramy TEST: D-20261012-2210-01 R2.
7. **Commit + push pliku migracji** (PR, `gh pr merge --merge`).
8. Próba na produkcji w transakcji zakończonej `ROLLBACK` — polecenia na Windows: `docs/handover/dopiski/D-20261012-0105-01.md` R8.
9. `supabase db push`; powtórny `db push` zgłasza „aktualna” — polecenia: D-20261012-0105-01 R8 z poprawką D-20261012-2210-01 R4.
10. Lista migracji w repozytorium = `schema_migrations` (numery, nie znaczniki czasu).
11. `POSTEP.md`: numer, co zmienia, wyniki liczbami.

Dane jednorazowe (porządki, faza z pozycji, wgranie pliku): jedna transakcja; liczenie przed zmianą; wyjątek, gdy dopasowanie szersze niż oczekiwane; kopia zmienianych wierszy w R2 przed produkcją; wyzwalacze wysyłające powiadomienia wyłączone tylko w tej transakcji; wpis w `audit_log`.

**Nigdy:** edycja nałożonej migracji, kwoty cennika w SQL, dane osobowe w testach, migracja na produkcji przed pushem.
