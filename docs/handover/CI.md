# CI — brama lokalna (BK6)

**GitHub Actions: ODŁOŻONE** (Aneks 1 — decyzja właściciela; rozliczenia / uprawnienie `workflow`).
Do czasu włączenia bramą jest hak `pre-push` (`git config core.hooksPath .githooks`).

## Co uruchamia `.githooks/pre-push`

| Krok | Polecenie | Oczekiwane |
|---|---|---|
| LFS | `git lfs pre-push` | wzorzec `shots-baseline` |
| unit (+ `money.test.ts`, `ferry.test.ts`, `storage-files.test.ts`) | `npm run test:unit` | wszystkie zielone; pominięte tylko testy żywe (`NBP_LIVE`, `SUPABASE_LIVE`) |
| świeży build HEAD | `bash scripts/ci/fresh-smoke.sh` | `git archive HEAD` → `/tmp/wt-fresh-*`, `vite build` (demo, **0** wystąpień `supabase` w paczce), `vite preview` na **:4179** (`FRESH_PORT`), `PW_BASE_URL` → poniższe 3 kroki; sprzątanie przy wyjściu |
| Playwright smoke | `npm run test:visual` | 4/4 (świeży build :4179) |
| D19-T | `npm run test:d19` | en=0 / sv=0 |
| D-EUR-T | `npm run test:deur` | EUR=0 / PLN=0 |
| stylelint | `npm run lint:css` | 0 błędów |
| baza | `bash tests/db/gate.sh` | security **52/52** · status **44/44** · storage **33/33** |

Krok bazy działa, gdy lokalny Postgres (z PostGIS) odpowiada pod `PGADMIN`
(domyślnie `postgres://postgres@localhost:5433/postgres`). Brak bazy = ostrzeżenie
i pominięcie; `TOWER_REQUIRE_DB=1 git push` zamienia brak bazy w błąd.

Podgląd **:4177** (i jego tunel, `dist/` repo) nie jest używany przez bramę — ręcznie
`npm run test:visual` nadal celuje w :4177, chyba że ustawisz `PW_BASE_URL`.

Pełna matryca wizualna (bramy etapów): `OUT=shots-gX-candidate BASE_URL=http://127.0.0.1:<port>/ node scripts/baseline.mjs`
→ `CANDIDATE=shots-gX-candidate node scripts/compare-baseline.mjs` (`pngjs` + `pixelmatch` w devDependencies).

## Testy bazy ręcznie

```
PGADMIN=postgres://postgres@localhost:5433/postgres bash tests/db/gate.sh   # z kontrolą liczb
PGADMIN=… bash tests/db/run.sh                                              # security + status (plik właściciela)
PGADMIN=… bash tests/db/storage.sh                                          # BK4: koszyki Storage + documents
```

- Każdy zestaw zakłada własną, czystą bazę (`tower_test_*`): atrapa Supabase
  (`supabase_stub.sql`, dla Storage także `storage_stub.sql`) → migracje `0001…` → `seed.sql`.
- **Atrap nigdy nie uruchamiaj na Supabase** — nadpisałyby schematy `auth` / `storage`.
- Debian z kilkoma klastrami: ustaw `PGCLUSTER` (np. `17/main`); `gate.sh` robi to sam z portu.
- `run.sh` nie zwraca kodu błędu przy FAIL — dlatego brama używa `gate.sh`.

## Testy na hostowanym Supabase (ręcznie, `.env.local`, bez wysyłki e-maili)

```
SUPABASE_LIVE=1 npx vitest run tests/supabase-provider.live.test.ts   # BK3, 8
node scripts/auth/verify.mjs                                          # BK2, 21
node scripts/storage/verify.mjs                                       # BK4, 27
SUPABASE_LIVE=1 npx playwright test tests/bk5-api.live.spec.ts        # BK5, 8 (część z UI: build Supabase na :4178)
```

Build trybu Supabase dla testów UI:
`VITE_AUTH_MODE=supabase npx vite build --outDir /tmp/wt-sb-dist && npx vite preview --outDir /tmp/wt-sb-dist --port 4178`.

## Gdy właściciel włączy Actions

Plan: `tests/db/gate.sh` na usłudze `postgis/postgis:17` (PGADMIN na porcie usługi),
`npm run test:unit`, Playwright z tymi samymi przeglądarkami (`npx playwright install --with-deps chromium`),
`actions/checkout` z `lfs: true`. Sekrety Supabase tylko dla testów żywych (osobny, ręczny workflow).
