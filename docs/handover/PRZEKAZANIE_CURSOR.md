# Przekazanie projektu TOWER dla Cursora (stan 28.09.2026)

Ten dokument to punkt wejścia. Starsze `01_HANDOVER.md`…`09_INDEKS_WIEDZY.md` opisują etap makiety (23.09) i są
**nieaktualne** co do architektury (dziś jest produkcyjny Supabase). Źródła prawdy, w tej kolejności:
`PLAN.md` (kolejka i **§4 decyzje właściciela**) → `POSTEP.md` (dziennik: każda pozycja, commit, testy) → `SCOPE.md`
(zakres i statusy) → `SECURITY.md` → `G4_WZORZEC.md` (wzorzec wizualny) → `III12_LISTA_ETAP_III.md` (otwarte pozycje).

## 1. Twarde zasady (obowiązują bez wyjątków)

| Obszar | Zasada |
|---|---|
| Wygląd | UI po polsku, **1:1 z makietą** (`public/tower-makieta.html`, `DESIGN_SYSTEM.md`). **Każda zmiana wyglądu = STOP i decyzja właściciela** (Sebastian Bożek). Poprawki bez zmiany wyglądu (aria, tabIndex, treść plików eksportu) są dozwolone. |
| Produkcja (Supabase `nglnnrmzmhusvxslousq`) | Zmiany schematu **wyłącznie migracjami** `supabase/migrations/NNNN_*.sql` — idempotentne (`if not exists`, `create or replace`, `on conflict do nothing`), nieniszczące. **Zero zapisów testowych** na produkcji; weryfikacja tylko w transakcji zakończonej `rollback`. |
| Baza — styl | Strażniki `if (warunek) is not true then raise` (test `nullguard` wyłapuje `if not …`). Funkcje `SECURITY DEFINER` zawsze z `set search_path = public`. `anon` bez uprawnień. Nowa funkcja dla `authenticated` → wpis w `tests/db/function-allowlist.txt` i `tests/db/null-guard-calls.txt` (domyślne uprawnienia: nowa funkcja nie ma EXECUTE dla nikogo — I-26). |
| Git | Bez `--force`, bez `--no-verify`. `git pull --rebase`. Push przechodzi przez **pełną bramę pre-push** (`.githooks/pre-push`, ok. 9 min). Po pushu local == remote. |
| Sekrety | Tylko w `.env.local` (poza repo). Nigdy nie wypisywać wartości w logach, commitach ani raportach. |
| Koszty | Bez nowych płatnych usług i zasobów. |
| Cloudflare | Nie logować się (wrangler wylogowany celowo) — patrz §6, retencja R2. |
| Wiadomości zewnętrzne | `security_flags.EXTERNAL_MESSAGING = false` do R-2 (umowy RODO): e-mail tylko na log-mar.pl, SMS tylko numery testowe. Nie przełączać. |

## 2. Architektura (dziś)

- Front: Vite + React 19 + TypeScript + Zustand, HashRouter. `VITE_AUTH_MODE=demo` = dane demo (`src/data/seed.ts`), inaczej `SupabaseProvider`. Moduły bez backendu są w produkcji ukryte (`src/lib/prodFacade.ts`, `permissions.ts` — m.in. „Automatyzacje”).
- Baza: Supabase Postgres 17, migracje `0001`…`0096`, RLS na wszystkich tabelach; logika biznesowa w funkcjach SQL + `pg_cron` (25 zadań `tower-*`, lista: `select jobname, schedule from cron.job`).
- Funkcje Edge (`supabase/functions/`): backup-export, document-archive, driver-photo, ferry-ais, ferry-schedule, ferry-status, fuel-wob (bez crona, przełącznik `FUEL_WOB_INGEST` wyłączony), road-pl, road-se, send-notifications, traffic-flow, usage-check. Wspólne: `_shared/` (m.in. `notifyTemplates.ts` — treść powiadomień PL/EN/SV, używana też przez aplikację).
- Hosting: Vercel, projekt `watch-tower-makieta`, domeny `tower.log-mar.pl` i `watch-tower-makieta.vercel.app`. Ostatnie wdrożenie: `69fdee7` (28.09).
- Przełączniki (`security_flags`): MFA_HHL_ADMIN=false, EXTERNAL_MESSAGING=false, PERMIT_REQUIRED_NON_STANDARD=false, FUEL_WOB_INGEST=false.

## 3. Uruchomienie i testy

| Co | Polecenie |
|---|---|
| Zależności | `npm ci` |
| Aplikacja demo | `VITE_AUTH_MODE=demo npm run dev` |
| Typy | `npx tsc -p tsconfig.app.json --noEmit` |
| Testy jednostkowe | `npm test` (vitest; 28.09 po 9.4: 531 zaliczonych / 33 pominięte) |
| Brama bazy | `PGCLUSTER=17/main bash tests/db/gate.sh` — lokalny Postgres 17 na porcie 5433 (`postgres://postgres@localhost:5433`), każdy zestaw tworzy własną bazę. Oczekiwane liczby przypadków są w `gate.sh` (`check <zestaw> N`) — **nowy test = podbić liczbę**, inaczej push padnie. 28.09: security 88, status 44, storage 37, money 130, release 145, backup 23, session 27, archive 18, watchdog 27, invite 48, risks 23, import 66, nullguard 369, i2 510, workflows 46. |
| Push | `PGCLUSTER=17/main TOWER_REQUIRE_DB=1 git push` (pre-push: vitest, brama bazy, e2e Playwright, zrzuty stanów, smoke). |
| Brama wizualna | `npm run gate:visual` (~42 min, port 4188, 840 ujęć, próg 0,1%, poza pre-push). Wynik: `/workspace/wt-gate-visual/last.txt`. Każde odchylenie wyjaśnić jak w `G4_WZORZEC.md` §III-13 (commit → klasyfikacja zamierzone/regresja → naprawa regresji) **zanim** odświeży się wzorzec. Ujęcia odświeżać w kolejności matrycy (patrz §G-V a956ab6). |
| Dostępność | `A11Y_STRICT=1 A11Y_URL=http://127.0.0.1:4189 node scripts/a11y/audit.mjs out.json` na buildzie demo. |

## 4. Procedury produkcyjne

1. **Migracja:** plik `NNNN_*.sql` → lokalnie `bash tests/db/gate.sh` → próba na produkcji w transakcji:
   `begin; \i migracja; \i migracja; <kontrole>; rollback;` (`psql "$SUPABASE_DB_POOLER_URL" -f próba.sql`) →
   `supabase db push --db-url "$SUPABASE_DB_POOLER_URL"` → kontrola `supabase_migrations.schema_migrations`.
2. **Funkcja Edge:** `SUPABASE_ACCESS_TOKEN=… npx supabase functions deploy <nazwa> --project-ref nglnnrmzmhusvxslousq --use-api`.
3. **Vercel (gdy zmienia się kod aplikacji):** `git archive <sha>` do czystego katalogu + `.vercel/project.json` → `npx vercel --prod --yes` → obie domeny 200 → rekurencyjny skan plików JS z `tower.log-mar.pl` (39 plików): 0× `service_role`, 0× wartość klucza service role.

## 5. Co jest zrobione 28.09 (szczegóły i liczby w POSTEP.md)

A11Y-2 (wiersze listy wyjątków z klawiatury, bez zmiany wyglądu) · 16.3 (reguła zastąpiona przez I-18; import tylko HHL, potwierdzanie dat tylko KSH, eksport per rola — testy) · 9.8 (odsiew duplikatów: notifications, risk_signals, sms_outbox, e-mail z Idempotency-Key) · 3.6 (wersje harmonogramu tylko do dopisywania — 0093) · 10.8 (PDF w języku interfejsu, czasy wg D8) · 9.1–9.3 (silnik automatyzacji — 0094 + 0095; reguły startowe wyłączone, bez crona) · brama wizualna `a956ab6` wyjaśniona (1 ujęcie, artefakt kolejności).

## 6. Otwarte pozycje (kolejność proponowana)

| Pozycja | Stan | Następny krok | Kto decyduje |
|---|---|---|---|
| 9.4 kreator reguł — widok | **podpięte 28.09 (9.4)**: `SupabaseProvider` czyta `workflows` (RLS `wf_all` — tylko HHL_ADMIN) i `workflow_runs`; przełącznik i kreator zapisują przez API (`workflow.update`/`workflow.create`, mapowanie `src/data/workflowMap.ts`); w produkcji moduł widoczny tylko dla HHL_ADMIN (`canSeeWorkflows`), „Uruchom” daje tylko komunikat (reguły uruchamia zdarzenie) | brak osobnego UI edycji istniejącej reguły (w makiecie go nie ma — dodanie = zmiana wyglądu, STOP); widok nie pokazuje historii przebiegów (tylko licznik OK) | właściciel: włączenie START-1…7 i zadanie cykliczne `workflow_worker` |
| 9.2 zadanie cykliczne | `workflow_worker(limit, teraz)` gotowy, bez crona; od 0096 także `wf_enqueue_daily(teraz)` (wyzwalacz „codziennie o 06:00”, jeden przebieg na regułę i aktywny transport na dzień) — bez crona; wyzwalacz „status promu” (FERRY_STATUS) działa od razu (wyzwalacz na `sailings`) | migracja z `cron.schedule('tower-automatyzacje', '* * * * *', …)` i `cron.schedule('tower-automatyzacje-06', …)` o 06:00 Europe/Warsaw (pg_cron liczy w UTC — 04:00 latem, 05:00 zimą, albo co godzinę z warunkiem na godzinę lokalną) | właściciel — PLAN D-29 (START) |
| Retencja R2 (`files/`) | **czeka na logowanie do Cloudflare** (`docs/handover/r2/lifecycle.json`, `bucket-lock.json` przygotowane) | po zalogowaniu właściciela: nałożyć lifecycle na kubełek kopii | właściciel (logowanie) |
| D-2 indeks SEFS / WOB | III-10 gotowe (0092, `fuel-wob` wdrożona, przełącznik wyłączony) | włączenie `FUEL_WOB_INGEST` + cron | właściciel |
| D-27 kontrast tokenów, kursor bez akcji | audyt: 1327 naruszeń kontrastu, 362 elementy z kursorem bez akcji (`RAPORT_DOSTEPNOSC.md`) | zmiana tokenów = zmiana wyglądu | właściciel |
| III-11 pogoda morska | rekomendacja FMI WAM + DMI WAM (CC BY 4.0), `RAPORT_POGODA_MORSKA.md` | wdrożenie po decyzji | właściciel |
| Uodpornienie `scripts/baseline.mjs` | `page.click('#themeBtn')` przewija okno przy 390 px | kliknięcie przez `evaluate` albo zerowanie `scrollX` przed ujęciem + pełny przebieg i odświeżenie ujęć 390/768 z opisem | wykonawca |
| Wyzwalacze CRON w regułach | poza zakresem 0094 (wf-2, wf-7, wf-11 z demo) | osobna pozycja | — |
| Eksport PDF innych widoków | brak przycisków w makiecie | — | właściciel (zmiana wyglądu) |
| Pliki starszych wersji harmonogramu w UI | brak w makiecie; dostęp przez kopię zapasową | — | właściciel |
| Cache CDN `tower-hhl.pages.dev` (I-0) | wygasa ok. 04.10.2026 | sprawdzić po 04.10 | — |
| Odłożone po 1.0 | kalendarz 9.10, e-CMR 6.9, ślad węglowy 10.9, SMS 6/7/10/11, integracja SharePoint (zgoda IT KSH) | wznowienie decyzją właściciela | właściciel |

## 7. Pułapki środowiska

- `rg` bez ścieżki czeka na stdin; `fd` i `rsync` nie są zainstalowane.
- Procesy podglądu zabijać po PID z `ss -ltnp | grep ':PORT '`, nie `pkill -f`. Port 4177 i katalog `dist/` — nie ruszać; 4188 zajmuje brama wizualna.
- Testy bazy równolegle z pushem kolidują (te same bazy `tower_test_*`) — nie uruchamiać ich w trakcie pre-push.
- Szum 7–14 px w pasku górnym (y 10–11) w ujęciach jest niezależny od kodu.
