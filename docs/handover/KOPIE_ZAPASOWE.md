# Kopie zapasowe — ANEKS 4 PR2

**Stan:** kod gotowy i przetestowany na projekcie TESTOWYM bez R2. Wdrożenie **czeka na właściciela** (R2 + klucz age + token Supabase).

## Co jest w repo
| Element | Plik |
|---|---|
| Logika (lista tabel, gzip, szyfrowanie age, retencja 7 dziennych / 3 miesięczne, manifest) | `supabase/functions/_shared/backup/core.ts` |
| Funkcja Edge (COPY każdej tabeli → gzip → age → R2; pliki Storage przyrostowo; retencja; wpis `backup_runs`) | `supabase/functions/backup-export/index.ts` |
| Tabela przebiegów | `supabase/migrations/0023_backup_runs.sql` (zastosowana na TESTOWYM) |
| Harmonogram 02:30 (pg_cron + pg_net + Vault) | `supabase/sql/cron_backup.sql` — uruchomić NA PRODUKCJI |
| Odtworzenie | `scripts/restore.sh` (domyślnie do schematu `restore_*`, niedestrukcyjne; `--into-public` tylko z `RESTORE_CONFIRM=TAK`) |
| Testy | `tests/backup-core.test.ts` (4), `tests/db/backup.sh` (10 lokalnie; `BACKUP_HOSTED=1` +2 na TESTOWYM), w bramce `gate.sh` jako `backup 10` |

Poza kopią: `positions` (dane osobowe, retencja 30 dni), `driver_tokens` (skróty tokenów), `spatial_ref_sys` (PostGIS). Test pokrycia w `backup.sh` pilnuje, że każda tabela `public` jest w kopii albo na liście wyłączeń.

## Wynik testu na TESTOWYM (2026-09-26)
Eksport wszystkich tabel z hostowanego projektu TESTOWEGO → szyfrowanie age → `restore.sh --schema restore_check --drop-after`: liczby wierszy = manifest (405 wierszy), schemat usunięty. Zły klucz → odtworzenie niemożliwe.

## Ryzyko
Kopia raz na dobę: **utrata danych do 24 h** w razie awarii między kopiami (akceptowane w ANEKSIE 4).

## Sekrety funkcji (ustawia właściciel/Grok: `supabase secrets set …`)
`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `BACKUP_AGE_RECIPIENT` (tylko **publiczny** klucz `age1…`). Klucz prywatny zostaje offline u właściciela.

## Działania właściciela
1. Cloudflare R2: kubełek + klucz API z dostępem tylko do niego.
2. `age-keygen -o klucz.txt` na własnym komputerze; do Groka tylko linia `public key: age1…`.
3. `SUPABASE_ACCESS_TOKEN` w pliku env → `supabase functions deploy backup-export` + sekrety.
4. Na produkcji: pg_cron, pg_net, Vault (`project_url`, `service_role_key`) → `supabase/sql/cron_backup.sql`.
5. Raz w miesiącu: pobrać kopię z R2 i `scripts/restore.sh` na TESTOWYM → wynik w POSTEP.md.
