# Limity planu darmowego — ANEKS 4 PR4, PR5, PR7

## PR4 — usage-check (codzienna kontrola)
- Migracja `0024_usage_check.sql` (TESTOWY: zastosowana): `usage_history` (trend), `usage_measure()`, `record_usage(metric, used, quota)`.
- Progi: **≥ 70% → ryzyko `USAGE_LIMIT` MEDIUM (odbiorca HHL)**, **≥ 85% → HIGH + e-mail** (raz przy przekroczeniu, bez codziennego powtarzania), < 70% → ryzyko zamykane.
- Limity liczone dziesiętnie (500 MB = 500 000 000 B) — alarm nieco wcześniej niż panel Supabase.
- Funkcja Edge `supabase/functions/usage-check` + harmonogram `supabase/sql/cron_usage.sql` (07:00 PL).
- Pomiar bez tokenu: baza (`pg_database_size`), pliki (`storage.objects`), wywołania Edge — **przybliżenie** z `integration_runs`. Transfer (egress) i dokładne wywołania Edge wymagają API zarządzania (`SUPABASE_MGMT_TOKEN`) — opcjonalne; bez niego transfer sprawdza właściciel w panelu.
- Stan TESTOWEGO 2026-09-26: baza 24 652 947 B (4,9% z 500 MB), pliki 0 B.
- **Czeka na właściciela:** wdrożenie funkcji (token), sekrety `RESEND_API_KEY`, `MAIL_FROM`, `ALERT_EMAIL_TO` (PR3), pg_cron na produkcji.
