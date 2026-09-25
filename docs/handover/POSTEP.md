# POSTEP — rejestr zlecenia końcowego

Źródło ID: `docs/handover/ZLECENIE_FINAL.md` §12 (**51 pozycji**).  
Kolumny: `ID | pozycja | status | commit | testy (liczby) | uwagi`.

Po F2.5 dodać wiersze **L*** (L1/L2/L4/L5/L7/L8/L9/L16) — na razie brak (notatka: po F2.5).  
Niezgodności z F2.4: **F2.4-a / F2.4-b / F2.4-c** (poniżej, po G1).

Aktualizacja: **2026-09-25** Europe/Warsaw · **Etap 3 w toku** (BK0, BK1, BK2 DONE) · następny: BK3 · kroki właściciela: W-BK2-1…4 (niżej).

---

## Etap 0 — przygotowanie

| ID | pozycja | status | commit | testy (liczby) | uwagi |
|---|---|---|---|---|---|
| P0.1 | Zapisz zlecenie → `ZLECENIE_FINAL.md` | **DONE** | `10ac61e` | unit **41/41** · pw **4/4** | 465 linii, identyczne z `ZLECENIE_DLA_GROKA.md` z pakietu |
| P0.2 | Rozpakuj pakiet final wg tabeli | **DONE** | `ad5fcc9` | unit **41/41** · pw **4/4** | Źródło: chat attachment → `/workspace/tower-pakiet-final-extract/` (nie zip na Domowy Downloads/Desktop — False/False). `money.test.ts` import → `src/lib/money/engine`; **wykluczony** z `test:unit` do M1 (`vitest.config.ts` exclude) — suite pozostaje 41/41. `tower-makieta.html` nie kopiowany |
| P0.3 | Założ `POSTEP.md` rejestr 51 | **DONE** | `992a5e6` | unit **41/41** · pw **4/4** | 51 wierszy ID z §12; L* po F2.5 |

## Etap 1 — korekty po Fala 2 GATE

| ID | pozycja | status | commit | testy (liczby) | uwagi |
|---|---|---|---|---|---|
| F2.1 | Ryzyka: 0 zmienionych ujęć — wyjaśnij/napraw | **DONE** | `3c6e3d3` | unit **41/41** · pw **4/4** · visual **90/720** tylko ryzyka | Hipoteza **(1)** (historyczna): `SAIL_ROWS` w RisksView — naprawione w D4 (`voyage.ts`). **(2)** false — DemoMark jest na panelu SE w Risks. **(3)** false — 90 ujęć `ryzyka` w matrycy. 0 diffów na GATE: `fullPage:false` + długa kolejka wyjątków → Prom/SE poniżej folda. Fix: `data-panel` + scroll Prom w `baseline.mjs`. Porównanie: wyłącznie ryzyka → tag `baseline-fala-2b-2026-09-24` |
| F2.2 | Próg testu wizualnego (`maxDiffPixelRatio`) | **DONE** | `14261fc` | unit **41/41** · pw **4/4** · visual compare **720/720** | `maxDiffPixelRatio:0.001` → `fullPage:true, maxDiffPixels:60, threshold:0.28`. Przy 0.15: 716/720 — 4× kokpit AA fringe (~18×16 px, 107 px); podniesiono **threshold** do 0.28 (nie maxDiffPixels). Wzorca shots-baseline **nie** regenerowano. Smoke `__screenshots__` odświeżone pod fullPage |
| F2.3 | Stylelint zielony (nowy `.stylelintrc`) | **DONE** | `6f77f7e` | unit **41/41** · pw **4/4** · stylelint **0** | Top5 przed: single-line-max-decl 265, rule-empty-line 49, no-duplicate-selectors 40, font-family-generic 30, declaration-no-important 11. Wyłączono formatowanie (+ no-duplicate-selectors: warstwowy CSS Claude; alpha-value-notation). Token/radius/shadow/font-allowed/!important **ON**. CSS: 11× !important usunięte (Leaflet specificity, reduced-motion target, [hidden]); font→var(--font-*); letter-spacing em; clip→clip-path. pre-push: lint:css |
| F2.4 | Weryfikacja mechanizmu paliwowego (bez kodu) | **DONE** | `8f74961` | unit **41/41** · pw **4/4** (bez zmian logiki) | SoT: `docs/watch-tower/BAF_SEFS.md`. Tabela zgodności w `03_PARAMETRY_BIZNESOWE.md` §2.2: **9 tak / 1 częściowo / fasada Opcji**. Naprawy: F2.4-a, F2.4-b, F2.4-c. Opcje BAF → D25 |
| F2.5 | Pozycje L1–L2/L4–L5/L7–L9/L16 — przydział | **DONE** | `48bb076` | — (docs) | 8× L* dopisane do POSTEP z etapem 2/4/5 — bez etapu nie wejdą do robót |
| F2.6 | Trzy wyjaśnienia (kokpit 54, mapa 18, TZ) | **DONE** | `454ba4a` | — (docs) | 1) Kokpit **54**/90: zmiana D5 KPI była wyraźna głównie u HHL (+ część KSH); ujęcia SCX i część KSH@768 zostały ≤ progu 0.001 (inne KPI / mniejszy obszar cyfr). 2) Mapa **18**/90 tylko @1920: podpis demo / etykiety rejsu dopiero przy pełnej szerokości przekroczyły budżet pikseli — węższe viewporty trzymały ratio. 3) `Europe/Warsaw` i `Europe/Stockholm` mają to samo przesunięcie i te same reguły DST — rozróżnienie w kodzie to zapis intencji operacyjnej, liczbowo offset się nie różni. |
| G1 | Brama etapu 1 | **DONE** | `2cadad2` | unit **41/41** · pw **4/4** · stylelint **0** · visual **720/720** (thr=0.28, maxDiffPixels=60) | `03_PARAMETRY` §2.2 tabela zgodności OK; L1–L16 przydzielone (F2.5); F2.1–F2.6 DONE. Bez regen baseline. STOP przed Etapem 2 |

### Naprawy z F2.4 (poza listą 51 — dopiski)

| ID | pozycja | status | commit | testy (liczby) | uwagi |
|---|---|---|---|---|---|
| F2.4-a | Konflikt daty SEFS: załadunek (`BAF_SEFS`) vs rozładunek (`MECHANIZM`) vs kod `loadDate` | OPEN | — | — | Uzgodnić SoT daty; `sefsForLoadDate` dziś jak załadunek. Etap: **2** (albo 4 przy pieniądzach) |
| F2.4-b | Brak wyliczania średniej z poprzedniego tygodnia (live/seed pipeline) | OPEN | — | — | `BAF_SEFS` §3; kod ma tylko `SEFS_WEEKLY` demo. Etap: **4** (M3/M8) lub **2** jeśli demo pipeline |
| F2.4-c | Opcje BAF/SEFS: wszystkie pola `bafFields` + nota UI nie zasilają `computeSefs` → D25 | **DONE** | `3ab44c1` | (w D25) | Pola `readOnly` + nota fasady; `computeSefs` ← tylko SEFS_WEEKLY. |

### Pozycje L* (F2.5) — przydział etapów

| ID | pozycja | status | commit | testy (liczby) | uwagi |
|---|---|---|---|---|---|
| L1 | Alternatywy trasy SE ×4 „Wybierz” mają mutować load/risk (dziś toast) | **DONE** | `3ab44c1` | (D25) | `applySeRouteAlt` + `seRouteAlts.ts` — mutacja risk/load/event. |
| L2 | Pill opóźnienia w drawerze z `delayMinutes`, nie stały napis | **DONE** | `3ab44c1` | (D25) | `formatDelayPill(delayMinutesVsPlan)` w LoadDrawer. |
| L4 | Terminy zadań z `plannedLoadDate` / danych load, nie `18+i*9` | **DONE** | `3ab44c1` | (D25) | `hoursUntilLoad(plannedLoadDate)`. |
| L5 | Preferencje powiadomień w Opcjach: zapis **i** filtracja przy push | OPEN | — | — | Etap **4** (centrum powiadomień / M7·BK ścieżka push) |
| L7 | Wskaźnik kompletności DRAWING z modelu, nie hardcode 100% | **DONE** | `3ab44c1` | (D25) | Kategoria DRAWING w vault; licznik z UPLOADED. |
| L8 | Kolumna „Próbki” geofence z modelu, nie zawsze `2` | **DONE** | `3ab44c1` | (D25) | `samplesRequired` w Geofence + UI. |
| L9 | JSONLogic / akcje workflow w runtime — realna semantyka, nie atrapa UI | OPEN | — | — | Etap **4** (silnik reguł przy backendzie/pieniądzach) |
| L16 | Force-majeure / opóźnienia — mechanizm ryzyk bez atrap (po SE road) | OPEN | — | — | Etap **4** (rozszerzenie ryzyk / opóźnień) |

## Etap 2 — Fala 3A: treść, język, formaty, silnik · **ZAMKNIĘTY (G2)**

| ID | pozycja | status | commit | testy (liczby) | uwagi |
|---|---|---|---|---|---|
| D19-T | Test PL-znaków poza EN/SV UI | **DONE** | `fd30c94` (+ D19 zielony) | `npm run test:d19` → **en=0 / sv=0** | Harness bez zmian. Po D19: hits→0; **`test:d19` w `.githooks/pre-push`**. |
| D10 | Jedna funkcja `formatMoney` | **DONE** | `20ba91c` | unit **44/44** (+3 `format-money.test.ts`) · pw **4/4** | Silnik: `formatMoney(amount, lang, currency)` w `src/lib/money/engine.ts` (code, locale). Store: `displayCurrency` (domyślnie PLN) + Opcje. Migracja: Dashboard, Schedule, Finance, Invoices, LoadDrawer; SEFS indeksy SEK/PLN też. Local `fmt`/toLocaleString+PLN usunięte. `money.test.ts` włączony w M1. EUR w Opcjach = etykieta bez FX (M1/M4 `formatForUser`). |
| D17 | Format daty w tabeli bez powtarzanego roku | **DONE** | `2e590db` | unit **49/49** (+5 D17 w `time.test.ts`) · pw **4/4** | `formatTableDay` / `formatTableInZone` / `refYearInOps` w `time.ts`: rok pomijany gdy = rok ops (Warsaw). Tabele: Schedule (załadunek/dostawa/ETA), Tasks, Invoices. Drawer nadal pełny `dd.MM.yyyy` (D8). |
| M1 | Silnik money + testy (49 zielonych, 1 skip) | **DONE** | `d113779` | money **49 passed / 1 skipped** (`NBP_LIVE`); unit **98 passed / 1 skipped** (money 49+1 skip + reszta 49) | Zdjęto `exclude` `money.test.ts` z `vitest.config.ts` — suite w `test:unit`/pre-push. Silnik bez zmian reguły FX/niezmiennika. **Fit:** app wycena demo nadal PLN w `pricing.*` (fasada); `formatMoney` (D10) już z silnika; pełne `formatForUser`/marża/poziomy → M2–M4/M8. Brak potrzeby przepisywania reguł. |
| D11 | Debug/EN enumy out z UI | **DONE** | `8a8569c` | unit **98 passed / 1 skipped** · pw **4/4** | `src/lib/enumLabels.ts` + seed/permits/eta PL. Ukryto: ferry status, geofence type, event type, doc category, severity, etaConfidence, payoutStatus, workflow trigger, READY/permitFits/CANCELLED w copy. Nie D19. |
| D19 | 104 napisy → słownik PL/EN/SV | **DONE** | `d1d10b1` | unit **98 passed / 1 skipped** · pw **4/4** · D19-T **en=0/sv=0** · lint:css **0** | Chrome → `t()` via `src/i18n/messages.ts` + `src/i18n/d19Extra.ts` (PL/EN/SV). Seed/demo narrative → `data-content`. StatusPill/enumLabels locale-aware. Smoke mapa PL odświeżony (legenda i18n) — pełny baseline G2. Gaps: LoadDrawer/DriverPwa/Tasks/KeyboardHelp częściowo PL (poza matrycą HHL D19-T); creator WF PL gdy otwarty. |
| D12 | Dane startowe prawdopodobne | **DONE** | `d8114a7` | unit **98 passed / 1 skipped** · pw **4/4** · D19-T **0/0** · lint:css **0** | `loads.json` + `seedIdentity.ts` + extras w `seed.ts`: nazwiska PL/LT/SE, E.164 (+48/+46/+370), tablice PL/SE/LT, zlecenia `KSH/2026/####`, `HHL/2026/####`, `SCX-26-####`. Brak Driver N / +48 600 000 000 / PSE 1000. data-content na kierowca/tablica (Schedule/Map/Drawer). Smoke mapa odświeżony (tekst danych). Pełny baseline = G2. |
| D6 | Telefon kierowcy → szuflada; KSH ±24 h | **DONE** | `a071261` | unit **103 passed / 1 skipped** · pw **4/4** · D19-T **0/0** · lint:css **0** | `canSeeDriverPhone` / `visibleDriverPhone` w `permissions.ts`: HHL+SCX zawsze; KSH tylko ±24 h od dostawy (unload→ETA→noon SE). Schedule + LoadDrawer (osobne pole Telefon) z tej samej funkcji. Test: `tests/permissions-phone.test.ts` (+5). |
| D13 | Wzorce wizualne / `section-card-hd--drag` | **DONE** | `6cc701a` | unit **103 passed / 1 skipped** · pw **4/4** · D19-T **0/0** · lint:css **0** (z `selector-class-pattern`) | `section-card-hd--drag` → `.is-draggable` (jak `is-dragging`/`is-drag-over`). Katalog + §5.1 kebab/`is-*` w `DESIGN_SYSTEM.md`. Stylelint `selector-class-pattern` włączony. |
| D18 | Oznaczenie danych demonstracyjnych | **DONE** | `9a9d9cd` | unit **105 passed / 1 skipped** · pw **4/4** · D19-T **0/0** · lint:css **0** | `showDemoMarks` (domyślnie ON) + przełącznik w Opcje → Preferencje. `DemoMark` na: cennik SCX, BAF/SEFS (Opcje), dodatek paliwowy (Finanse), panel SE (Ryzyka). i18n `demo_mark*`. Test: store toggle + soft footnotes. |
| P6 | Stawki demo PLN→EUR tabelą 186/A/NBP/2026 | **DONE** | `5a4c1c0` | unit **110 passed / 1 skipped** · pw **4/4** · D19-T **0/0** · lint:css **0** | `DEMO_FX`/`DEMO_FX_META` w `src/lib/money/demoFx.ts` (186/A/NBP/2026 · 2026-09-24 · mid 4,3900). `RATE_*` + extras seed + store draft → EUR (`plnToEurDemo`). UI: `formatAppMoney` (Dashboard/Schedule/Finance/Invoices/LoadDrawer); SEFS → `formatSourceMoney`. Opcje cennik: edycja w EUR + nota FX. Test: `tests/demo-fx.test.ts` (+5). D18 DemoMark zostaje. Bez D-EUR-T / regen baseline. |
| D-EUR-T | Test waluty EUR/PLN w UI | **DONE** | `d9d4967` | `npm run test:deur` → **EUR=0 / PLN=0** · unit **110/1 skip** · pw **4/4** · D19-T **0/0** · lint:css **0** | Spec `tests/d-eur-t.spec.ts`: dwa tryby preferencji; zakazy z ZLECENIE; wyjątki data-deur-exempt (indeks paliwowy, wybór waluty). Money cells = kod trybu; nota FX 4,3900. test:deur w pre-push. sched_money_note {cur}. Smoke kokpit odświeżony (FX P6). Bez D25 / regen baseline. |
| D25 | Atrapy/porzucone z fasady — decyzja | **DONE** | `3ab44c1` | unit **110/1 skip** · pw **4/4** · D19-T **0/0** · D-EUR-T **0/0** · lint:css **0** | ATRAPA→implement (L1/L2/L4/L7/L8, prefs filter, invoice week/deltas); SAIL via voyage+DemoMark; PORZUCONE: MapLibre public usunięte, leaflet duplikat już brak, BAF Options fasada (F2.4-c). Decyzje w `02_FASADA.md` §D25. L9/F2.4-a/b poza Etap 2. Bez G2. |
| G2 | Brama etapu 2 + baseline Fala 3a | **DONE** | `7510dab` | unit **110/1 skip** · pw **4/4** · D19-T **0/0** · D-EUR-T **0/0** · lint:css **0** · visual capture **720/720** · compare **711/720** zmienionych → REGEN | Capture `baseline.mjs` → candidate 720/720. Compare vs fala-2: **711 changed / 9 identical** (grupy: docs/mapa/ryzyka 90, harmonogram 89, kokpit 87, faktury 60, …). Uzasadnione Etap 2 (D19/D12/P6/D18/D25…). REGEN `shots-baseline` + tag `baseline-fala-3a-2026-09-25`. Raport: `docs/handover/G2_BASELINE_FALA3A.md`. Etap 2 CLOSED. |

## Etap 3 — backend

| ID | pozycja | status | commit | testy (liczby) | uwagi |
|---|---|---|---|---|---|
| BK0 | STOP — dane dostępowe od właściciela | **DONE** | `62919b8` (docs) | — | Sześć zmiennych w `.env.local` (gitignored `*.local` / `.env.*`): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`, `RESEND_API_KEY`, `MAIL_FROM` — obecne, niepuste. Wartości **tylko** lokalnie; nie w commitach / Vercel (O2 później). Brak Dockera na boxie → BK1 na hostowanym Supabase właściciela (idealnie później osobny `tower-test`). |
| BK1 | Migracje + seed stegra + cron | **DONE** | `e70e378` | — | `npx supabase` CLI 2.117 (`supabase init` → `config.toml`). `supabase db push` na hostowany projekt (Postgres 17.6, pusta baza): `0001`–`0003` OK + nowa `0004_cron.sql`; historia `supabase_migrations` = 0001…0004; 38 tabel w `public`; rozszerzenia postgis/btree_gist/citext/pgcrypto aktywne. Seed `supabase/seed/stegra.sql` uruchomiony 2× (idempotentny): org HHL/KSH/SCX (3), projekt STEGRA_BODEN (1), payment_terms 30 d (KSH) i 35 d (HHL→SCX). pg_cron włączony (`0004_cron.sql`, UTC, nazwane zadania = idempotentne): `tower_refresh_payment_status` 02:15 codz., `tower_purge_personal_data` 02:30 codz., `tower_detect_silent_vehicles` `*/15`, `tower_detect_sequence_risk` 02:45 codz. (wrapper `detect_sequence_risk_all()` po wszystkich projektach, bez grantów dla anon/authenticated); wszystkie 4 aktywne, funkcje wywołane ręcznie bez błędów. Połączenie: host bezpośredni `db.<ref>.supabase.co` tylko IPv6 (nieosiągalny z boxa) → session pooler IPv4 `aws-1-eu-west-1` :5432, te same poświadczenia (od BK2: `SUPABASE_DB_POOLER_URL` w `.env.local`, nigdy w logach/commitach). `tests/db/supabase_stub.sql` **nie** uruchamiany na Supabase. Brak zmian UI. |
| BK2 | Auth (magic link) + 3 org | **DONE** | `1fd0e82` | verify 21/21 · e2e 20/20 · unit 114/1 skip | Migracja `0005_auth.sql` (push OK): konta **tylko na zaproszenie** — `user_invites` + wyzwalacz na `auth.users` (tworzy `app_users` z zaproszenia; adres bez zaproszenia odrzucony `TOWER_NO_INVITE`); funkcje HHL_ADMIN `admin_invite_user` / `admin_revoke_invite` / `admin_set_user_role` / `admin_set_user_active` + `my_profile()`; zgodność roli z firmą (`role_matches_org`, role z `0001`); brak zapisu `app_users`/`user_invites` z API; wszystko w `audit_log`; admin nie odbierze sobie roli ani nie dezaktywuje siebie. UI (`src/auth/`, ładowane leniwie): ekran logowania PL w chrome Claude (e-mail → link), bramka + blokada roli widoku wg firmy konta, pasek sesji z „Wyloguj”, panel **Opcje → Użytkownicy i role** (tylko HHL_ADMIN: zaproś, zmień rolę, dezaktywuj, cofnij zaproszenie). Tryb Supabase **tylko** gdy `VITE_AUTH_MODE=supabase` + URL + klucz anon — bez flagi DemoProvider jak dotąd (baseline/pw/D19/D-EUR bez zmian; build demo nie zawiera URL/klucza ani kodu Supabase — sprawdzone). Przepływ `implicit` (link z zaproszenia działa w przeglądarce zaproszonego). Konta testowe: 3 (HHL_ADMIN / KSH CLIENT_ADMIN / SCX CARRIER_DISPATCH), adresy plus na domenie `MAIL_FROM`, e-mail potwierdzony, **żaden e-mail nie wysłany**; adresy tylko w `.env.local` (`TEST_USER_*_EMAIL`). Skrypty: `scripts/auth/seed-test-users.mjs` (idempotentny), `verify.mjs` (magic link przez `generate_link` bez wysyłki → sesja → RLS/RPC dla 3 firm), `e2e-browser.mjs` (build z flagą, logowanie/wylogowanie, blokada roli, panel admina). SMTP Resend i adresy przekierowań = **kroki właściciela** (brak tokenu Management API; klucz service role go nie daje) — do tego czasu domyślny mailer Supabase wysyła tylko do członków zespołu projektu. |
| BK3 | `DemoProvider` / `SupabaseProvider` | OPEN | — | — | pending |
| BK4 | Storage plików (PDF/CMR/POD/zdjęcia) | OPEN | — | — | pending |
| BK5 | Test widoczności na poziomie API | OPEN | — | — | pending |
| BK6 | CI db/money/unit/pw | OPEN | — | — | pending |
| G3 | Brama etapu 3 | OPEN | — | — | pending |

### Kroki właściciela po BK2 (panel Supabase — nie da się ich wykonać kluczem service role)

**W-BK2-1 · SMTP przez Resend** (bez tego zaproszenia nie wychodzą do osób spoza zespołu projektu Supabase)
1. Resend → *Domains*: upewnij się, że domena adresu z `MAIL_FROM` ma status **Verified**.
2. Supabase → projekt → *Authentication* → *Emails* → zakładka *SMTP Settings* → włącz **Enable Custom SMTP**.
3. Wpisz: *Sender email* = adres z `MAIL_FROM`; *Sender name* = `Tower · H&H Logistics`; *Host* = `smtp.resend.com`; *Port* = `465`; *Username* = `resend`; *Password* = klucz API Resend (ten sam co `RESEND_API_KEY`).
4. *Save*. Następnie *Authentication* → *Rate Limits* → „Rate limit for sending emails” podnieś np. do 60/h.

**W-BK2-2 · Adresy przekierowań** (link z e-maila musi wracać do aplikacji)
1. *Authentication* → *URL Configuration* → *Site URL* = adres produkcyjny Vercel (np. `https://<projekt>.vercel.app`).
2. *Redirect URLs* → dodaj: `https://<projekt>.vercel.app/**`, `http://localhost:5173/**`, `http://127.0.0.1:4177/**`.
3. *Authentication* → *Sign In / Providers* → *Email*: zostaw **włączone** „Allow new users to sign up” — konta i tak powstają wyłącznie z zaproszenia (wyzwalacz odrzuca inne adresy).

**W-BK2-3 · Szablon e-maila (opcjonalnie, po polsku)** — *Authentication* → *Emails* → *Templates* → *Magic Link*: temat `Twój link do logowania — Tower`, treść z `{{ .ConfirmationURL }}` (link ważny 1 h).

**W-BK2-4 · Własne konto administratora** — po W-BK2-1/2: zaloguj się kontem testowym HHL (adres w `.env.local`, `TEST_USER_HHL_EMAIL`) lub poproś wykonawcę o skrypt, i w *Opcje → Użytkownicy i role* zaproś swój adres jako **Administrator HHL**. Zmienne Vercel (`VITE_AUTH_MODE=supabase`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) — dopiero w O2; do zamknięcia etapu 3 aplikacja nie jest udostępniana z prawdziwymi danymi.

## Etap 4 — Fala 3B: pieniądze, faktury, zlecenia

| ID | pozycja | status | commit | testy (liczby) | uwagi |
|---|---|---|---|---|---|
| M2 | Dane v2: EUR, poziomy, migawki | OPEN | — | — | pending |
| M3 | Kurs NBP na żywo + `fx_rates` | OPEN | — | — | pending |
| M4 | Ustawienia użytkownika (język/waluta/motyw) | OPEN | — | — | pending |
| M5 | Numery zleceń KSH/HHL/SCX w harmonogramie | OPEN | — | — | pending |
| M6 | Faktury — model 3 stron | OPEN | — | — | pending |
| M7 | Terminy i płatności + przypomnienia | OPEN | — | — | pending |
| M8 | Niezmiennik / poziomy w wycenie | OPEN | — | — | pending |
| M9 | Aplikacja kierowcy: watchPosition + zgoda | OPEN | — | — | pending |
| D26 | Import — usunięcia za zgodą | OPEN | — | — | pending |
| D23-S | Import test na skali ~72 wierszy | OPEN | — | — | pending |
| G4 | Brama etapu 4 + baseline Fala 3b | OPEN | — | — | pending |

## Etap 5 — Fala 4: infrastruktura

| ID | pozycja | status | commit | testy (liczby) | uwagi |
|---|---|---|---|---|---|
| D14 | Trasy adresowalne | OPEN | — | — | pending |
| D15 | Podział paczki / lazy mapa &lt;400 kB | OPEN | — | — | pending |
| G5 | Brama etapu 5 | OPEN | — | — | pending |

## Etap 6 — odbiór końcowy

| ID | pozycja | status | commit | testy (liczby) | uwagi |
|---|---|---|---|---|---|
| O1 | Pełny komplet testów + D24 ×14 | OPEN | — | — | pending |
| O2 | Deploy produkcyjny Vercel + Supabase | OPEN | — | — | pending |
| O3 | Test dymny na produkcji | OPEN | — | — | pending |
| O4 | Oznaczenie demo zostaje do potwierdzenia | OPEN | — | — | pending |
| O5 | `RAPORT_KONCOWY.md` + tag `release-1.0` | OPEN | — | — | pending |

---

## Poza zakresem (otwarte — nie pomijać)

| temat | status | uwagi |
|---|---|---|
| Adapter telematyki SCX | OPEN | czeka na nazwę systemu + API |
| Parametry operacyjne od przewoźnika | OPEN | cutoff promu, progi fal, prędkość HHL |
| Geometria trasy z zezwolenia | OPEN | czeka na zezwolenia z trasą |
| Klucz Trafikverket | OPEN | SE road demo do czasu klucza |
| Źródło statusu promów Polferries | OPEN | decyzja właściciela |
| Rozbicie marży na 3 poziomy | OPEN | czeka na zgodę |
| GitHub Actions rozliczenia + `unit.yml` | OPEN | właściciel |

---

## Licznik wierszy ID

- Wymagane §12: **51**
- W tabelach etapów powyżej: **51** (P0×3 + F2/G1×7 + Etap2×14 + BK/G3×8 + Etap4×11 + Etap5×3 + Etap6×5)
- L* po F2.5: **0** na razie (dopisać po F2.5)
