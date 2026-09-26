# Kopie zapasowe — ANEKS 4 PR2

**Stan:** kod gotowy, przetestowany bez R2. **ANEKS 5:** hostowany projekt = PRODUKCJA — test odtworzenia wyłącznie do lokalnego Postgresa z migracjami; na produkcji tylko odczyt. Wdrożenie czeka na: konto/klucze Cloudflare R2, `SUPABASE_ACCESS_TOKEN`, klucz age (A5-KLUCZ).

## Co jest w repo
| Element | Plik |
|---|---|
| Logika (lista tabel, gzip, szyfrowanie age, retencja 7 dziennych / 3 miesięczne, manifest) | `supabase/functions/_shared/backup/core.ts` |
| Funkcja Edge (COPY każdej tabeli → gzip → age → R2; pliki Storage przyrostowo; retencja; wpis `backup_runs`) | `supabase/functions/backup-export/index.ts` |
| Tabela przebiegów | `supabase/migrations/0023_backup_runs.sql` (zastosowana na hostowanym) |
| Harmonogram 02:30 (pg_cron + pg_net + Vault) | `supabase/sql/cron_backup.sql` — uruchomić NA PRODUKCJI |
| Odtworzenie | `scripts/restore.sh` (domyślnie do schematu `restore_*`, niedestrukcyjne; `--into-public` tylko z `RESTORE_CONFIRM=TAK`) |
| Testy | `tests/backup-core.test.ts` (4), `tests/db/backup.sh` (10 lokalnie; `BACKUP_HOSTED=1` +2: odczyt produkcji → odtworzenie lokalnie), w bramce `gate.sh` jako `backup 10` |

Poza kopią: `positions` (dane osobowe, retencja 30 dni), `driver_tokens` (skróty tokenów), `spatial_ref_sys` (PostGIS). Test pokrycia w `backup.sh` pilnuje, że każda tabela `public` jest w kopii albo na liście wyłączeń.

## Wynik testu (2026-09-26)
- przed ANEKSEM 5: eksport z hostowanego → odtworzenie do schematu `restore_check` na hostowanym (usunięty po teście): 405 wierszy = manifest.
- po ANEKSIE 5: eksport z produkcji (tylko odczyt) → odtworzenie do lokalnego Postgresa: 405 wierszy = manifest, 12/12. Na produkcji brak schematów `restore_*`. Zły klucz → odtworzenie niemożliwe.

## Ryzyko
Kopia raz na dobę: **utrata danych do 24 h** w razie awarii między kopiami (akceptowane w ANEKSIE 4).

## Sekrety funkcji (ustawia właściciel/Grok: `supabase secrets set …`)
`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `BACKUP_AGE_RECIPIENT` (tylko **publiczny** klucz `age1…`). Klucz prywatny zostaje offline u właściciela.

## Działania właściciela
1. Cloudflare R2: kubełek + klucz API z dostępem tylko do niego.
2. `age-keygen -o klucz.txt` na własnym komputerze; do Groka tylko linia `public key: age1…`.
3. `SUPABASE_ACCESS_TOKEN` w pliku env → `supabase functions deploy backup-export` + sekrety.
4. Na produkcji: pg_cron, pg_net, Vault (`project_url`, `service_role_key`) → `supabase/sql/cron_backup.sql`.
5. Raz w miesiącu: pobrać kopię z R2 i `scripts/restore.sh` do LOKALNEGO Postgresa z migracjami (klucz prywatny udostępniony przez właściciela na czas testu, potem usunięty) → wynik w POSTEP.md.
