# Limity planu darmowego — ANEKS 4 PR4, PR5, PR7

## PR4 — usage-check (codzienna kontrola)
- Migracja `0024_usage_check.sql` (TESTOWY: zastosowana): `usage_history` (trend), `usage_measure()`, `record_usage(metric, used, quota)`.
- Progi: **≥ 70% → ryzyko `USAGE_LIMIT` MEDIUM (odbiorca HHL)**, **≥ 85% → HIGH + e-mail** (raz przy przekroczeniu, bez codziennego powtarzania), < 70% → ryzyko zamykane.
- Limity liczone dziesiętnie (500 MB = 500 000 000 B) — alarm nieco wcześniej niż panel Supabase.
- Funkcja Edge `supabase/functions/usage-check` + harmonogram `supabase/sql/cron_usage.sql` (07:00 PL).
- Pomiar bez tokenu: baza (`pg_database_size`), pliki (`storage.objects`), wywołania Edge — **przybliżenie** z `integration_runs`. Transfer (egress) i dokładne wywołania Edge wymagają API zarządzania (`SUPABASE_MGMT_TOKEN`) — opcjonalne; bez niego transfer sprawdza właściciel w panelu.
- Stan TESTOWEGO 2026-09-26: baza 24 652 947 B (4,9% z 500 MB), pliki 0 B.
- **Czeka na właściciela:** wdrożenie funkcji (token), sekrety `RESEND_API_KEY`, `MAIL_FROM`, `ALERT_EMAIL_TO` (PR3), pg_cron na produkcji.

## PR5 — pozycje GPS (budżet bazy 500 MB)
- Aplikacja kierowcy (`src/lib/driverTracking.ts`): **co 2 min w ruchu, co 15 min na postoju** (< 5 km/h; prędkość z GPS, bez niej z przesunięcia). Doba jazdy = 720 punktów, doba postoju = 96 (test).
- `process_position()` (migracja `0025_position_budget.sql`): punkt **< 60 s po poprzednim** dla tego transportu pomijany w całości (dotyczy telematyki, tokenu kierowcy i każdego źródła).
- `purge_personal_data()`: było — pozycje starsze niż 90 dni i tylko dla rozładowanych; jest — **cały ślad kasowany 30 dni po rozładunku**; dane kierowcy nadal po 90 dniach. Przy okazji: odebrane EXECUTE dla zalogowanych (HHL mógł wywołać `purge_personal_data(0)`).
- **Pomiar:** 1 000 pozycji z 4 indeksami (gist, brin, load_id+ts, unique) = **386 662 B ≈ 387 kB** (≈ 387 B na punkt; pomiar na 10 000 wierszy, PostgreSQL 17, `tests/db/release.sh`).
- **Prognoza** (założenia: 20 aut jednocześnie w trasie jak w tabeli PR6, ~10 h jazdy + 14 h postoju na dobę = 356 punktów/auto/dobę, trasa ~4 doby, ~75 transportów/miesiąc):
  - napływ: 20 × 356 = 7 120 punktów/dobę ≈ **2,75 MB/dobę**;
  - stan ustalony przy retencji 30 dni po rozładunku: ~(75 + 20) transportów × ~1 424 punkty ≈ 135 000 punktów ≈ **52 MB** (≈ 10% limitu 500 MB);
  - najgorszy przypadek (20 aut w ruchu 24 h, 720 punktów/dobę, 34 doby w oknie): ≈ 490 000 punktów ≈ **190 MB** (38%) — nadal pod progiem 70% usage-check.
  - bez PR5 (co minutę albo 150 m, bez retencji 30 dni): ≥ 2× napływ i 3× dłuższe przechowywanie — przekroczenie 500 MB w ciągu kilku miesięcy.
