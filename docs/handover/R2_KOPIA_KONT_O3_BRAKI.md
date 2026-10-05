# R2 — kopia usuniętych kont O3 / typo: stwierdzone braki (2026-10-05)

Raport diagnostyczny (decyzja właściciela **F**). Bez zgadywania; konta były testowe.

## Co jest lokalnie (poza repo)

- Plik JSON: `/home/box/sand-data/agents/8f0d9d27-789e-4b31-bed8-10c6e4900c24/konta-backup/usuniete_o3_scandimavian_2026-10-05T12-46-06-438Z.json` (2954 B, mtime 05.10.2026 14:46 PL).
- Weryfikacja zeszyt: konta `sebastian+tower-o3-*` usunięte z `app_users` + `auth.users`; audyt `USER_DELETED_OWNER_05_10`.

## Co jest w Cloudflare R2 (stan sprawdzony 05.10.2026 ~16:26 PL)

| Fakt | Wynik |
|------|--------|
| Bucket `tower-backup` | **istnieje** (`creation_date` 2026-09-26) |
| Obiekty `daily/…` | **są** (m.in. `daily/2026-09-26-233736/…`) — codzienna kopia Workerem |
| Obiekty pod prefiksem `konta/` | **brak** (lista pusta) — kopia O3/typo **nie** leży w R2 |
| Token API `CLOUDFLARE_API_TOKEN` w `.env.local` | **obecny**, `tokens/verify` → active |
| `CLOUDFLARE_ACCOUNT_ID` w `.env.local` | **nieobecny** (konto da się odczytać z API `/accounts`) |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_ENDPOINT` | **nieobecne** w `.env.local` |
| `BACKUP_WRITER_URL` + `BACKUP_WRITER_SECRET` | **obecne** — ścieżka Workera dziennych dumpów (inna niż ręczny PUT JSON kont) |
| Sesja `wrangler login` (OAuth) | **brak użytecznej sesji CLI**: `npx wrangler` wymaga Node ≥22 (box: Node 20); wcześniejsze handover: wrangler celowo wylogowany |
| `wrangler` w `node_modules` projektu | **brak** |

## Czego brakuje do zapisu kopii JSON kont w R2

1. **Sam obiekt w R2** — lokalny JSON nie został jeszcze wgrany (prefiks `konta/` pusty).
2. **Wygodna konfiguracja CLI (opcjonalna):** Node ≥22 albo lokalny `wrangler` + ewentualnie `CLOUDFLARE_ACCOUNT_ID` w env — **nie jest to twarde blokowanie**, bo token API już listuje bucket i przyjmuje PUT/DELETE obiektów (sonda testowa usunięta od razu; nic nie zostawiono).
3. **Klucze S3-style R2** (`R2_ACCESS_KEY_ID` / secret / endpoint) — **nieobecne**; nie są potrzebne, jeśli używa się Cloudflare API + istniejącego tokenu z uprawnieniem do R2.
4. **Decyzja ścieżki obiektu** (np. `konta/usuniete_o3_….json`) — nie zapisana w poleceniu F; F = tylko raport.

## Nie robione w tym punkcie F

- Brak wgrania JSON do R2 (zgodnie z poleceniem: raport, nie implementacja).
- Brak zmiany lifecycle / bucket-lock (`docs/handover/r2/*.json` bez zmian).
