# Kopie zapasowe — ANEKS 4 PR2 (+ PR2-R2, PR2-B)

**Stan (27.09.2026):** wdrożone na produkcji. Codziennie 02:30 czasu PL (`30 0 * * *` UTC) pg_cron → `backup-export` → Worker `tower-backup-writer` → Cloudflare R2 `tower-backup`. Pierwsza kopia OK 27.09 01:43 (38 tabel, 362 wiersze), test odtworzenia OK (`RESTORE OK tabel=38 wierszy=362`), przyjęty przez właściciela.

## Co jest w repo
| Element | Plik |
|---|---|
| Logika (lista tabel i wyłączeń, gzip, age, manifest z SHA-256 plików, klient Workera) | `supabase/functions/_shared/backup/core.ts` |
| Funkcja Edge (COPY → gzip → age → Worker; pliki Storage przyrostowo; wpis `backup_runs`) | `supabase/functions/backup-export/index.ts` |
| Worker tylko do dopisywania (PUT nowego obiektu, `x-backup-secret`; GET/DELETE/LIST 405, nadpisanie 409) | `workers/backup-writer/`, test na żywo `scripts/r2/test-writer.sh` |
| Blokada usuwania i cykl życia R2 | `docs/handover/r2/bucket-lock.json` (daily/ 30 d, monthly/ 360 d), `docs/handover/r2/lifecycle.json` (31 / 361 d) |
| Tabela przebiegów, blokada współbieżności | `0023_backup_runs.sql`, `0044_backup_run_lock.sql` |
| Konta po odtworzeniu do nowego projektu | `0045_restore_relink_accounts.sql`, ważność listy 30 dni `0046_relink_expiry.sql` |
| Harmonogram | `supabase/sql/cron_backup.sql` (zastosowany na produkcji) |
| Odtworzenie tabel / plików | `scripts/restore.sh`, `scripts/restore-files.sh` |
| Testy | `tests/backup-core.test.ts`, `tests/db/backup.sh` (bramka `backup 20`), `tests/db/invite.sh` (bramka `invite 48`) |

Poza kopią: `positions` (dane osobowe, 30 dni), `driver_tokens` (skróty tokenów), `spatial_ref_sys` (PostGIS), `account_relink_pending` (stan przejściowy odtworzenia). Test pokrycia w `backup.sh` pilnuje, że każda tabela `public` jest w kopii albo na liście wyłączeń.

## Układ w R2
- `daily/RRRR-MM-DD/<tabela>.csv.gz.age` + `manifest.json.age` + `_run.json`; ponowny przebieg tego samego dnia → `daily/RRRR-MM-DD-HHMMSS/`. Pierwszego dnia miesiąca także `monthly/RRRR-MM/`.
- `files/<kubeł>/<ścieżka>.age` — pliki Storage, przyrostowo (dokumenty wgrane od ostatniej udanej kopii). Klucz = ścieżka dokumentu, więc ten sam plik nie jest zapisywany drugi raz. SHA-256 i rozmiar pliku sprzed szyfrowania są w manifeście przebiegu, który go zapisał.
- Blokady usuwania (stan 27.09.2026 ok. 11:38, `wrangler r2 bucket lock list tower-backup`):
  ```
  name: tower-daily-30d / enabled: Yes / prefix: daily/ / condition: after 30 days
  name: tower-files-360d / enabled: Yes / prefix: files/ / condition: after 360 days
  name: tower-monthly-360d / enabled: Yes / prefix: monthly/ / condition: after 360 days
  ```
- Cykl życia: `daily/` 31 dni, `monthly/` 361 dni. **`files/` nie ma reguły cyklu życia** — kopie plików dokumentów zostają bezterminowo (po 360 dniach tylko przestaje ich chronić blokada). Informacja, bez zmian.

## Blokada współbieżności (0044)
`backup-export` zaczyna od `backup_run_begin()`: `pg_try_advisory_xact_lock` + sprawdzenie trwającego przebiegu w jednej transakcji. Drugi start (w tej samej chwili albo w trakcie przebiegu) kończy się od razu wpisem `SKIPPED` w `backup_runs`. Blokada transakcyjna zamiast sesyjnej, bo połączenie funkcji Edge może iść przez pooler w trybie transakcji. Przebieg przerwany przez platformę (np. 546) bez zakończenia przez 30 min → `ERROR`, następny start normalny.

## Comiesięczny test odtworzenia (procedura przyjęta 27.09.2026)
Wykonuje Grok na boksie, do **lokalnego** Postgresa z migracjami; na produkcji nic nie jest zapisywane.
1. **Krótkie logowanie:** `npx wrangler login` (OAuth konta właściciela, tylko na czas testu).
2. **Pobranie** ostatniego pełnego katalogu kopii: `wrangler r2 object get tower-backup/daily/<katalog>/<tabela>.csv.gz.age --remote --file …` dla każdej tabeli z listy `BACKUP_TABLES` + `manifest.json.age`.
3. **Odtworzenie:** `AGE_IDENTITY=<klucz prywatny> RESTORE_DB_URL=<lokalna baza po migracjach> scripts/restore.sh <katalog> --drop-after` → `RESTORE OK tabel=N wierszy=M`.
4. **Pliki** (gdy manifest ma `files`): pobrać `files/<ścieżka>.age` dla ścieżek z manifestu i `scripts/restore-files.sh <katalog-files> <wyjście> <manifest.json.age…>` → `FILES OK plikow=N bajtow=B sha256_zgodne=N/N`.
5. **Wylogowanie:** `npx wrangler logout`, potem `npx wrangler whoami` — w raporcie dosłownie wynik „You are not authenticated…”.
6. Wynik (tabele, wiersze, pliki, sumy, whoami) → wiersz w `POSTEP.md`.

Token R2 tylko do odczytu zastąpi krok 1 dopiero wtedy, gdy zacznie działać przekazywanie sekretów (token ma trafić do `.env.local` bez przechodzenia przez czat).

## Odtworzenie awaryjne do NOWEGO projektu Supabase
1. Nowy projekt → migracje (`supabase db push`) → `RESTORE_CONFIRM=TAK … scripts/restore.sh <katalog> --into-public`.
2. **Konta.** Kopia obejmuje schemat `public` bez `auth.users` (hasła/sesje/konta logowania są w schemacie `auth` platformy, nie w kopii). Po odtworzeniu `app_users` wskazuje identyfikatory kont, których w nowym projekcie nie ma, a zaproszenia są przyjęte — bez dodatkowego kroku logowanie kończyłoby się „konto tylko na zaproszenie”. Dlatego:
   - `restore.sh --into-public` wpisuje takie konta do `account_relink_pending` i wypisuje `konta_do_polaczenia=N`;
   - użytkownik loguje się jak zwykle (link z e-maila na stronie logowania). Nowe konto logowania z adresem z listy zostaje **połączone po adresie e-mail** z dotychczasowym wierszem `app_users`: rola, organizacja, aktywność, historia bez zmian; audit `USER_RELINKED_AFTER_RESTORE`; adres znika z listy;
   - bezpieczeństwo: łączony jest tylko adres z listy i tylko wiersz, którego stare konto nie istnieje; zalogować się może wyłącznie właściciel skrzynki (link z e-maila). Adres spoza listy — zasady zaproszeń bez zmian;
   - połączenie nie zmienia `active`: konto **nieaktywne w kopii zostaje nieaktywne** (loguje się, ale widzi 0 wierszy — RLS); przywrócić je może tylko HHL (ponowne zaproszenie / zmiana w panelu);
   - **ważność listy: 30 dni** od odtworzenia (`relink_valid_days()`, 0046). Starszy wpis jest pomijany (zasady zaproszeń jak dla obcego adresu), a zadanie dzienne `tower-wygasanie-listy-kont` (02:45 UTC) usuwa go z audytem `RELINK_PENDING_EXPIRED`. Kto nie zaloguje się w 30 dni, dostaje od HHL zwykłe ponowne zaproszenie. 30 dni = okno uruchomienia nowego projektu po awarii; dłuższa lista to niepotrzebnie długo otwarta ścieżka przejęcia konta po adresie;
   - administrator HHL loguje się pierwszy tą samą drogą; nie trzeba nikogo zapraszać ponownie.
   - Supabase → Authentication → URL Configuration: Site URL i Redirect URLs nowego adresu aplikacji (inaczej link nie wróci do aplikacji).
3. **Pliki:** `scripts/restore-files.sh` z `RESTORE_STORAGE_URL` i `RESTORE_SERVICE_KEY` nowego projektu (zmienne środowiska na komputerze właściciela; klucz nie trafia do repo ani czatu) wgrywa pliki do tych samych kubełków i ścieżek (bez nadpisywania) i sprawdza SHA-256.
4. `restore.sh` oznacza przebieg `backup_runs` zapisany w trakcie kopii (RUNNING) jako `ERROR`, żeby nie blokował nowych kopii.
5. Na nowym projekcie: sekrety funkcji (`BACKUP_AGE_RECIPIENT`, `BACKUP_WRITER_URL`, `BACKUP_WRITER_SECRET`), Vault i `supabase/sql/cron_*.sql`.

## Wyniki testów
- 26.09: eksport z produkcji (odczyt) → lokalny Postgres: 405 wierszy = manifest. Zły klucz → odtworzenie niemożliwe.
- 27.09 (produkcja → R2 → lokalnie): `RESTORE OK tabel=38 wierszy=362`.
- 27.09 PR2-B, lokalny Supabase w Dockerze + lokalny R2 (`wrangler dev --local`, ten sam Worker i kontrakt; test-writer 8/8): 2 dokumenty wgrane do Storage (250 016 B PDF + 40 006 B JPG) → kopia z `files/` (2 pliki) → pliki usunięte z Storage → `FILES OK plikow=2 bajtow=290022 sha256_zgodne=2/2 wgrane=2` → pobrane ze Storage: SHA-256 przed = po (2/2). Kolejny przebieg przyrostowy: 1 nowy plik, 2 pominięte (już w `files/`), SHA-256 w manifeście zgodne. Dwa równoległe wywołania: 1 OK + 1 `SKIPPED`. Odtworzenie `--into-public` → `konta_do_polaczenia=3`; logowanie linkiem (GoTrue) jednego z nich → konto połączone, widzi swoje dane (RLS); obcy adres → odmowa.
- 27.09 PR2-C, lokalny Supabase (GoTrue): konto nieaktywne w kopii → połączone, sesja wydana, widzi projekty 0 / app_users 0 / loads 0; wpis listy starszy niż 30 dni → logowanie odrzucone; kontrolnie aktywne konto → projekty 1, loads 2. `expire_relink_pending()` usunęło 1 przeterminowany wpis.

## Ryzyko
Kopia raz na dobę: **utrata danych do 24 h** (akceptowane w ANEKSIE 4). Limity darmowego R2: 10 GB, 1 mln operacji A / 10 mln B miesięcznie.

## Sekrety
Funkcja Supabase: `BACKUP_AGE_RECIPIENT` (tylko publiczny `age1…`), `BACKUP_WRITER_URL`, `BACKUP_WRITER_SECRET`. Worker: `BACKUP_WRITER_SECRET`. Klucz service_role nie opuszcza Supabase; klucz prywatny age offline u właściciela.
