# POSTEP — rejestr zlecenia końcowego

Źródło ID: `docs/handover/ZLECENIE_FINAL.md` §12 (**51 pozycji**) + Aneks 1 (AN1 · M10 · M11) + Aneks 2 (AN2 · M12) = **56 pozycji**.  
Kolumny: `ID | pozycja | status | commit | testy (liczby) | uwagi`.

Po F2.5 dodać wiersze **L*** (L1/L2/L4/L5/L7/L8/L9/L16) — na razie brak (notatka: po F2.5).  
Niezgodności z F2.4: **F2.4-a / F2.4-b / F2.4-c** (poniżej, po G1).

Aktualizacja: **2026-09-26** Europe/Warsaw · **Etap 5 ZAMKNIĘTY (G5)** (Etap 4 ZAMKNIĘTY · D14 · D15 · G5 DONE; wzorzec `baseline-fala-3b-2026-09-26`, 840 ujęć, 0 zmian w G5) · następny: Etap 6 (O1) · kroki właściciela: W-BK2-1/2 DONE (01:07 CEST; domena log-mar.pl Verified w Resend — potwierdzone 01:09), W-BK2-3 (opcjonalny), W-BK2-4 i **W-M7-1** (wdrożenie funkcji e-mail) otwarte (niżej).

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
| BK1 | Migracje + seed stegra + cron | **DONE** | `e70e378` | — | `npx supabase` CLI 2.117 (`supabase init` → `config.toml`). `supabase db push` na hostowany projekt (Postgres 17.6, pusta baza): `0001`–`0003` OK + nowa `0004_cron.sql`; historia `supabase_migrations` = 0001…0004; 38 tabel w `public`; rozszerzenia postgis/btree_gist/citext/pgcrypto aktywne. Seed `supabase/seed/stegra.sql` uruchomiony 2× (idempotentny): org HHL/KSH/SCX (3), projekt STEGRA_BODEN (1), payment_terms 30 d (KSH) i 35 d (HHL→SCX). pg_cron włączony (`0004_cron.sql`, UTC, nazwane zadania = idempotentne): `tower_refresh_payment_status` 02:15 codz., `tower_purge_personal_data` 02:30 codz., `tower_detect_silent_vehicles` `*/15`, `tower_detect_sequence_risk` 02:45 codz. (wrapper `detect_sequence_risk_all()` po wszystkich projektach, bez grantów dla anon/authenticated); wszystkie 4 aktywne, funkcje wywołane ręcznie bez błędów. Połączenie: host bezpośredni `db.<ref>.supabase.co` tylko IPv6 (nieosiągalny z boxa) → session pooler IPv4 `aws-1-eu-west-1` :5432, te same poświadczenia (od BK2: `SUPABASE_DB_POOLER_URL` w `.env.local`, nigdy w logach/commitach). `tests/db/supabase_stub.sql` **nie** uruchamiany na Supabase. Brak zmian UI. **Od AN1:** migracje repo = 0001–0004 właściciela (0002 poprawiona G1–G3, 0004 = `0004_statusy_automatyczne.sql` z aneksu) + nasze przenumerowane `0005_cron.sql` (sprzątanie: wyrejestrowanie 4 starych zadań `tower_*`, usunięcie wrappera) / `0006_auth.sql` / `0007_data_layer.sql`. Zadania pg_cron planuje teraz **0004 aneksu**: `tower-prom` (co min), `tower-prom-opoznienie` (*/10), `tower-cisza-gps` (*/15), `tower-terminy`, `tower-rodo`, `tower-kolejnosc`. Seed zakłada 5 stref korytarza + 2 statki. |
| BK2 | Auth (magic link) + 3 org | **DONE** | `1fd0e82` | verify 21/21 · e2e 20/20 · unit 114/1 skip | Migracja `0005_auth.sql` (od AN1: **`0006_auth.sql`**; push OK): konta **tylko na zaproszenie** — `user_invites` + wyzwalacz na `auth.users` (tworzy `app_users` z zaproszenia; adres bez zaproszenia odrzucony `TOWER_NO_INVITE`); funkcje HHL_ADMIN `admin_invite_user` / `admin_revoke_invite` / `admin_set_user_role` / `admin_set_user_active` + `my_profile()`; zgodność roli z firmą (`role_matches_org`, role z `0001`); brak zapisu `app_users`/`user_invites` z API; wszystko w `audit_log`; admin nie odbierze sobie roli ani nie dezaktywuje siebie. UI (`src/auth/`, ładowane leniwie): ekran logowania PL w chrome Claude (e-mail → link), bramka + blokada roli widoku wg firmy konta, pasek sesji z „Wyloguj”, panel **Opcje → Użytkownicy i role** (tylko HHL_ADMIN: zaproś, zmień rolę, dezaktywuj, cofnij zaproszenie). Tryb Supabase **tylko** gdy `VITE_AUTH_MODE=supabase` + URL + klucz anon — bez flagi DemoProvider jak dotąd (baseline/pw/D19/D-EUR bez zmian; build demo nie zawiera URL/klucza ani kodu Supabase — sprawdzone). Przepływ `implicit` (link z zaproszenia działa w przeglądarce zaproszonego). Konta testowe: 3 (HHL_ADMIN / KSH CLIENT_ADMIN / SCX CARRIER_DISPATCH), adresy plus na domenie `MAIL_FROM`, e-mail potwierdzony, **żaden e-mail nie wysłany**; adresy tylko w `.env.local` (`TEST_USER_*_EMAIL`). Skrypty: `scripts/auth/seed-test-users.mjs` (idempotentny), `verify.mjs` (magic link przez `generate_link` bez wysyłki → sesja → RLS/RPC dla 3 firm), `e2e-browser.mjs` (build z flagą, logowanie/wylogowanie, blokada roli, panel admina). SMTP Resend i adresy przekierowań = **kroki właściciela** (brak tokenu Management API; klucz service role go nie daje) — do tego czasu domyślny mailer Supabase wysyła tylko do członków zespołu projektu. |
| BK3 | `DemoProvider` / `SupabaseProvider` | **DONE** | `aa1a9a7` | unit 126 (+11 BK3) / 9 skip · live 8/8 (`SUPABASE_LIVE=1`) · e2e 9/9 · BK2 verify 21/21 · BK2 e2e 20/20 | `src/data/`: kontrakt `DataProvider` (`loadSnapshot()` + `apply(DataMutation)`), `DemoProvider` (seed — dawny init store przeniesiony 1:1, store == zrzut demo, sprawdzone testem; baseline bez zmian), `SupabaseProvider` (klient wstrzykiwany, sesja użytkownika + RLS, **nigdy** service role w przeglądarce), `registry.writeThrough` (jedyny element w paczce demo; bez odbiorcy = no-op; id demo nigdy nie idą na serwer), `supabaseBridge` (po zalogowaniu zrzut z serwera zastępuje dane w store; błąd zapisu → komunikat PL + ponowne pobranie). **Z Supabase czytane:** transporty (+elementy wysyłki), zdarzenia, wiadomości, strefy (okrąg z `v_geofences_circle`), ryzyka otwarte, metadane dokumentów, nr zleceń HHL/przewoźnika. **Zapisywane:** status, zasoby, awizacja (okna), prom, zdarzenia, wiadomości, strefy (`upsert_geofence_circle`, tylko HHL_ADMIN). Migracja `0006_data_layer.sql` (od AN1: **`0007_data_layer.sql`**): widok/funkcja stref (SECURITY INVOKER → RLS), autor wiadomości i aktor zdarzenia ustawiane przez serwer (koniec podszywania), insert zdarzeń/wiadomości tylko dla transportów widocznych (polityki z 0001 miały `check (true)`). Zustand = pamięć podręczna: w trybie Supabase store startuje pusty, osobny klucz `…-supabase` z samymi preferencjami UI; magazyn v2 (demo) nie jest czytany ani wysyłany (e2e: podrzucony `DEMO-LEAK` nie pojawia się, zapisy bez id demo). Test live: fixture `TEST-BK3-A` (SCX) / `TEST-BK3-B` (bez przewoźnika) — SCX widzi tylko swój, KSH/HHL oba; SCX zmienia zasoby/status swojego, cudzy odrzucony; KSH bez zmiany statusu; reguła 0003 (READY bez nr HHL) odrzucona z komunikatem; strefa HHL zapis/odczyt (promień ±2%), KSH odrzucony; anon nic nie czyta. **Korekta BK2:** kontrola paczki demo w BK2 szukała tylko nazwy „supabase” w plikach — leniwe chunki (`AuthGate`, supabase-js) jednak były w `dist/` (nieładowane, bez URL/klucza). Naprawione: literalny warunek `import.meta.env.VITE_AUTH_MODE === 'supabase'` → w buildzie demo `dist/assets` = tylko `index.js` + CSS; brak `GoTrueClient`/`PostgrestClient`/URL/klucza; test strażnik w `tests/data-layer.test.ts`. **Luki (świadomie):** ceny/finanse (widoki rolowe `v_load_financials_*`), faktury, automatyzacje, powiadomienia, wersje harmonogramu, import XLSX na serwer → Etap 4 (w trybie Supabase puste, nie demo); pliki dokumentów → BK4; stałe teksty widoków (np. „wersja 7 z 21.09” w Harmonogramie, licznik Faktury min. 1) — kosmetyka po BK; brak realtime (odświeżenie przy logowaniu / po błędzie zapisu); zdarzenia fixture zostają (append-only z 0001); PWA kierowcy nadal demo. |
| BK4 | Storage plików (PDF/CMR/POD/zdjęcia) | **DONE** | `80e870b` | unit **153 / 9 skip** (+9 `tests/storage-files.test.ts`) · `tests/db/storage.sh` **33/33** · hostowany `scripts/storage/verify.mjs` **27/27** · e2e przeglądarka `scripts/storage/e2e-browser.mjs` **10/10** · `tests/db/run.sh` **52/52 · 44/44** (z 0009) · pw **4/4** · d19 **0** · deur **0** · lint **0** | **Migracja `0009_storage.sql`** (idempotentna; `db push` → historia 0001–0009): trzy **prywatne** koszyki — `dokumenty` (PDF/JPEG/PNG/WEBP/HEIC, 20 MB: CMR, POD, zezwolenia, polisy, specyfikacje), `zdjecia` (obrazy, 15 MB: zdjęcia mocowania), `faktury` (PDF, 20 MB; rejestracja faktur = M6). Ścieżka `<koszyk>/<projekt>/<transport\|org>/<id dokumentu>/<nazwa>` nadawana **wyłącznie przez serwer** (wyzwalacz na `documents`; także `uploaded_by`, `uploaded_at`, `project_id` z transportu; unikalny indeks `storage_path`). RPC `create_document` (SECURITY INVOKER → RLS; walidacja typu i rozmiaru) → upload pod tę ścieżkę → przy błędzie `discard_document` (tylko autor, ≤1 h, tylko bez obiektu). **Polityki Storage:** odczyt obiektu ⇔ użytkownik widzi wiersz `documents` (to samo RLS dla metadanych i bajtów); zapis tylko autor rejestracji, ≤1 h, koszyk zgodny z kategorią; **brak UPDATE/DELETE** (bez nadpisywania i usuwania z API). **Zawężenie `documents` (decyzja techniczna, bezpieczeństwo w bazie):** `docs_insert` — przewoźnik/klient tylko do **widocznego** transportu (wcześniej dowolny), bez transportu wyłącznie przewoźnik: polisa/faktura; restrykcyjna `docs_scope` — dokument transportu tylko przy widocznym transporcie; PDF faktury (`INVOICE`) tylko strony faktury (RLS `invoices`/`invoice_documents`, w tym zakres KSH z 0003) albo autor przed podpięciem → KSH nie dostanie PDF faktury SCX ani metadanych. **Linki podpisane 900 s** (`SIGNED_URL_TTL_S`; test sprawdza `exp−iat=900`). **Aplikacja:** `src/data/storageFiles.ts` (leniwy chunk, rejestrowany w `supabaseBridge` jako `FileSink`), `src/lib/docFiles.ts` (wspólne wgrywanie: tryb Supabase + id serwera → Storage; demo → pamięć sesji); szuflada / Dokumenty / Faktury / aplikacja kierowcy wgrywają przez jedną ścieżkę; podgląd i pobieranie (`DocPreview`, `DocFileRow`, ZIP) linkiem podpisanym; w podglądzie dopisek „link ważny 15 min” (istniejący `.sub`, bez nowego wzorca). Napisy `bk4_*` w PL/EN/SV. **Demo:** bajty plików (zdjęcia kierowcy, skany) **nie trafiają do localStorage** — persist zapisuje wyłącznie metadane (po przeładowaniu podgląd = stub „metadane”); paczka demo nadal bez kodu Supabase (build: tylko `index.js`+CSS; 0× `StorageClient`/`createSignedUrl`/URL). Pliki testowe z przebiegów verify/e2e usunięte po teście (service role — tylko własne). **Kroki właściciela:** brak (koszyki i polityki z migracji, bez panelu). **Luki:** aplikacja kierowcy w trybie Supabase nadal na tokenach demo (konto/łącze kierowcy = M9) — ścieżka Storage gotowa, zadziała po M9; wersjonowanie w UI pokazuje ostatni plik kategorii (baza trzyma wszystkie); podpięcie PDF do faktury = M6. |
| BK5 | Test widoczności na poziomie API | **DONE** | `17e6beb` | `SUPABASE_LIVE=1 npx playwright test tests/bk5-api.live.spec.ts` **8/8** (bez flagi 8 skipped) · unit **157 / 9 skip** (+4 `tests/awizacja-patch.test.ts`) · pw **4/4** · d19 **0** · deur **0** · lint **0** | **Playwright, trzy konta testowe, sprawdzana odpowiedź sieciowa:** (1) przegląd **wszystkich** tabel i widoków PostgREST (lista z OpenAPI; pominięte tylko metadane PostGIS `spatial_ref_sys`/`geometry_columns`/`geography_columns` — dane referencyjne, pełny odczyt przekraczał limit czasu) + podpis Storage obu PDF, dla każdego konta. Fixture tworzony i usuwany w przebiegu (TEST-BK5: faktura kosztowa SCX→HHL i przychodowa HHL→KSH, pozycje, PDF w koszyku `faktury`, `load_cost`/`load_revenue` na TEST-BK3-A z wartościami-wartownikami). **KSH:** zero trafień kosztu / faktury kosztowej / jej pozycji / PDF; `load_cost` = 42501; kontrola: widzi własną fakturę i PDF. **SCX:** zero trafień przychodu / faktury przychodowej; `load_revenue` = 42501; kontrola: własna faktura + PDF. **HHL:** widzi obie (kontrola dodatnia). (2) Ruch sieciowy aplikacji (build `VITE_AUTH_MODE=supabase`, :4178) — KSH i SCX przechodzą wszystkie widoki nawigacji + szufladę: zero zakazanych wartości. (3) **AN1/AN2:** przewoźnik zmieniający `hhl_order_no`, `order_no` (KSH), `plan_load_from/to`, `plan_delivery_from/to` → HTTP ≥400 („Przewoźnik nie może zmieniać: …”), wartości bez zmian; kontrola: przewoźnik zmienia `carrier_order_no`/`driver_name` (przywrócone), HHL nie zmieni nr SCX („…wpisuje wyłącznie przewoźnik”), KSH nie zmienia nic. **Werdykt trafienia KSH z pierwszego przebiegu: FAŁSZYWY ALARM testu, nie wyciek** — pierwsza wersja przeszukiwała tekst razem z nagłówkami sekcji `## sign <ścieżka>`, a ścieżka PDF faktury kosztowej zawiera jej id i nazwę `TEST-BK5-SCX-KOSZT.pdf`; sam podpis dla KSH był pusty (odmowa). Poprawka: dopasowanie wyłącznie w treści odpowiedzi, raport `sekcja: wartość`; wartowniki kwot sprawdzone też bezpośrednio w bazie (brak w `spatial_ref_sys`). Bez migracji 0010. **Luka z AN2 (częściowo):** formularz „Awizacja / Prom” wysyłał okna planowe przy każdym zapisie przewoźnika (odrzucane przez `trg_loads_guard`) — teraz `awizacjaChanges` wysyła **tylko zmienione pola** (porównanie chwili, dokładność minuty), test przeglądarkowy: zapis przewoźnika bez zmian = brak `plan_*` w PATCH, brak błędu. Pola nadal wyglądają na edytowalne dla przewoźnika — ukrycie/readonly zostaje w **M5/M10** (dotyka matrycy wizualnej). Sprzątanie hostowane potwierdzone: faktury/pozycje/dokumenty/obiekty/koszt/przychód = 0; TEST-BK3-A bez zmian. `.gitignore` + `test-results/` (kontekst błędów Playwright zawiera tokeny sesji). |
| BK6 | CI db/money/unit/pw | **DONE** | `7c5c63a` | pre-push (push `7c5c63a`): unit **157 / 9 skip** · pw **4/4** · d19 **0** · deur **0** · lint **0** · db `tests/db/gate.sh` **security 52/52 · status 44/44 · storage 33/33** | **GitHub Actions nadal odłożone (AN1)** — CI czeka na właściciela (rozliczenia / uprawnienie `workflow`); plan workflow w `docs/handover/CI.md`. Brama = `.githooks/pre-push`, rozszerzony o **`tests/db/gate.sh`**: uruchamia `tests/db/run.sh` (plik właściciela, bez zmian) + `tests/db/storage.sh` i sprawdza liczby (`WYNIK: N OK, 0 FAIL` dla 52/44/33) — `run.sh` sam zwraca 0 także przy FAIL (grep trafia w WYNIK), stąd osobny sprawdzian. Krok bazy tylko gdy lokalny Postgres+PostGIS odpowiada pod `PGADMIN` (domyślnie :5433; `PGCLUSTER` wyznaczany z portu); brak bazy = ostrzeżenie, `TOWER_REQUIRE_DB=1` = błąd. `money.test.ts` i `ferry.test.ts` są w `test:unit`. Testy żywe (BK2/BK3/BK4/BK5) ręcznie — lista w `CI.md`. · **chore(BK6) `9a9378d`:** pre-push uruchamia `scripts/ci/fresh-smoke.sh` — `git archive HEAD` → `/tmp/wt-fresh-*`, build demo (kontrola: 0× `supabase` w paczce), `vite preview` :4179, `PW_BASE_URL` → visual 4/4 · d19 0 · deur 0, sprzątanie; podgląd :4177 / tunel / `dist/` nietknięte (wcześniejszy smoke testował `dist/` z 2026-09-25 23:50). `pngjs` 7 + `pixelmatch` 5 w devDependencies → `scripts/compare-baseline.mjs` działa z repo. |
| G3 | Brama etapu 3 | **DONE** | (ten commit `docs(G3)`) | db `gate.sh` **security 52/52 · status 44/44 · storage 33/33** · ferry **17/17** · unit **157 / 9 skip** · pw **4/4** · d19 **0** · deur **0** · lint **0** · pełna matryca wizualna **720/720 identycznych** (0 zmian) · hosted migracje **0001–0009** · BK5 live **8/8** · BK2 verify **21/21** · live provider **8/8** · BK3 e2e **9/9** · BK4 verify **27/27** · BK4 e2e **10/10** | **Stan:** wszystkie kryteria bramy spełnione (AN1/AN2: security 52 + status 44 + ferry 17). **Świeża paczka:** podgląd :4177 (i tunel) serwuje `dist/` zbudowany 2026-09-25 23:50 (sprzed BK4/BK5) — nie ruszany; pw/d19/deur i matryca wizualna uruchomione na **świeżym buildzie demo** z HEAD (`vite build --outDir /tmp/wt-demo-dist`, podgląd :4179, konfiguracja Playwright z `baseURL` nadpisanym na :4179; paczka demo: 0 wystąpień `supabase`). Matryca: `OUT=shots-g3-candidate BASE_URL=http://127.0.0.1:4179/ node scripts/baseline.mjs` (720 ujęć; pierwsze przejście przerwane crashem Chromium po 305 ujęciach, brakujące widoki dograne przez `FILTER`, 0 FAIL) → porównanie z `shots-baseline` (tag `baseline-fala-3a-2026-09-25`) progi G2 (0.28 / 60 px / 0.001): **720 identical, 0 changed, 0 size mismatch** → **baseline NIE regenerowany** (brak uzasadnienia). `pngjs`/`pixelmatch` nie ma w `package.json` — porównanie uruchomione kopią skryptu z pakietami zainstalowanymi w `/tmp` (repo bez zmian zależności). Tryb Supabase testowany na świeżym buildzie `VITE_AUTH_MODE=supabase` (:4178). Hosted po testach: invoices/invoice_lines/documents/storage.objects/load_cost/load_revenue = 0 (tylko własne resztki testów, brak nowych). **Luki przeniesione:** aplikacja kierowcy w trybie Supabase nadal na tokenach demo (M9); UI pokazuje tylko najnowszy plik kategorii (baza trzyma wersje); PDF ↔ faktura (M6); okna `plan_*` przewoźnika w UI wyglądają na edytowalne — baza odrzuca (M5/M10); widoki `v_load_*` permission denied dla wszystkich (Etap 4); GitHub Actions odłożone (pre-push = brama). |

### Kroki właściciela po BK2 (panel Supabase — nie da się ich wykonać kluczem service role)

**W-BK2-1 · SMTP przez Resend — DONE 2026-09-26 ~01:07 CEST** (ustawione przez Supabase Management API: custom SMTP `smtp.resend.com:465`, user `resend`, hasło = `RESEND_API_KEY`, nadawca `Watch Tower` <`MAIL_FROM`>). Domena **log-mar.pl** ma w Resend status **Verified** (potwierdzone przez właściciela 2026-09-26 01:09). Instrukcja historyczna: (bez tego zaproszenia nie wychodzą do osób spoza zespołu projektu Supabase)
1. Resend → *Domains*: upewnij się, że domena adresu z `MAIL_FROM` ma status **Verified**.
2. Supabase → projekt → *Authentication* → *Emails* → zakładka *SMTP Settings* → włącz **Enable Custom SMTP**.
3. Wpisz: *Sender email* = adres z `MAIL_FROM`; *Sender name* = `Tower · H&H Logistics`; *Host* = `smtp.resend.com`; *Port* = `465`; *Username* = `resend`; *Password* = klucz API Resend (ten sam co `RESEND_API_KEY`).
4. *Save*. Następnie *Authentication* → *Rate Limits* → „Rate limit for sending emails” podnieś np. do 60/h.

**W-BK2-2 · Adresy przekierowań — DONE 2026-09-26 ~01:07 CEST** (Management API: *Site URL* = `https://watch-tower-makieta.vercel.app`; allow list = `https://watch-tower-makieta.vercel.app/**`, `http://localhost:5173/**`). Instrukcja historyczna: (link z e-maila musi wracać do aplikacji)
1. *Authentication* → *URL Configuration* → *Site URL* = adres produkcyjny Vercel (np. `https://<projekt>.vercel.app`).
2. *Redirect URLs* → dodaj: `https://<projekt>.vercel.app/**`, `http://localhost:5173/**`, `http://127.0.0.1:4177/**`.
3. *Authentication* → *Sign In / Providers* → *Email*: zostaw **włączone** „Allow new users to sign up” — konta i tak powstają wyłącznie z zaproszenia (wyzwalacz odrzuca inne adresy).

**W-BK2-3 · Szablon e-maila (opcjonalnie, po polsku)** — *Authentication* → *Emails* → *Templates* → *Magic Link*: temat `Twój link do logowania — Tower`, treść z `{{ .ConfirmationURL }}` (link ważny 1 h).

**W-BK2-4 · Własne konto administratora** — po W-BK2-1/2: zaloguj się kontem testowym HHL (adres w `.env.local`, `TEST_USER_HHL_EMAIL`) lub poproś wykonawcę o skrypt, i w *Opcje → Użytkownicy i role* zaproś swój adres jako **Administrator HHL**. Zmienne Vercel (`VITE_AUTH_MODE=supabase`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) — dopiero w O2; do zamknięcia etapu 3 aplikacja nie jest udostępniana z prawdziwymi danymi.

**W-M7-1 · Wysyłka e-maili przypomnień (M7) — funkcja `send-notifications`** (box nie ma tokenu Management API). Kolejka e-maili działa w bazie (`notifications`, kanał EMAIL, status PENDING); wysyła je funkcja Edge. Kroki (terminal z Supabase CLI, jednorazowo):
1. `npx supabase login` (token konta właściciela) i `npx supabase link --project-ref <ref projektu>`.
2. `npx supabase secrets set RESEND_API_KEY=<klucz Resend> MAIL_FROM=<adres nadawcy> APP_URL=https://watch-tower-makieta.vercel.app`.
3. `npx supabase functions deploy send-notifications --no-verify-jwt` (funkcja sama sprawdza klucz service role).
4. Harmonogram co 5 min: *Integrations → Cron → Create job* → typ *Supabase Edge Function* `send-notifications`, metoda POST, nagłówek `Authorization: Bearer <service role>` (albo poproś wykonawcę o migrację z `pg_net` po udostępnieniu tokenu).
Po wdrożeniu: e-maile przypomnień i „nowa faktura” wychodzą w języku odbiorcy; opłacone faktury nie dostają kolejnych e-maili.

## Aneksy

| ID | pozycja | status | commit | testy (liczby) | uwagi |
|---|---|---|---|---|---|
| AN1 | Aneks 1 — statusy automatyczne, poprawki silnika stref, rejsy, reguły zmian transportu | **DONE** | `cd1c56d` (tekst) · `a33a2a5` (docs) · `e06542b` (migracje/testy db) · `6567ce7` (aplikacja) | `tests/db/run.sh` **security 50/50 · status 44/44** (czysty lokalny Postgres 17 + PostGIS, migracje 0001–0007) · unit **127 / 9 skip** · live **8/8** · BK2 verify **21/21** · BK2 e2e **20/20** · BK3 e2e **9/9** · pw **4/4** · d19 **0** · deur **0** · lint **0** | **Pliki:** `AGENTS.md`, `.cursor/rules/tower.mdc`, `STATUSY_AUTOMATYCZNE.md`, `MECHANIZM_PIENIEDZY.md` v2.2, `SCOPE.md`, `0002_geofence_engine.sql` (G1–G3: m.in. promień okręgu w `geography` — wcześniej Mercator, strefy 40–60% mniejsze), `0004_statusy_automatyczne.sql`, seed, `tests/db/{run,security,status}.sh`. **Przenumerowanie:** nasze `0004_cron`/`0005_auth`/`0006_data_layer` → `0005_cron` (sprzątanie duplikatów cron — 0004 aneksu jest nadrzędna) / `0006_auth` (wyzwalacz na `auth.users` warunkowy — stub testowy nie ma schematu auth) / `0007_data_layer`. **Uzgodnienie zdalne (bez resetu, bez usuwania kont):** stan zastany: historia 0001…0006 (stare nazwy), brak `sailings`/`vessels`/`trg_loads_guard`, `loads.ferry_vessel` obecne, 4 zadania `tower_*`, 0 stref, 2 transporty, 3 konta. Kroki: 0002 ponownie wgrana `psql -1` (same `create or replace`; okrąg 800 m mierzy 800 m) → `supabase migration repair` (0004/0005/0006 reverted; 0006/0007 applied — treść auth/data_layer już była) → `db push --include-all` (0004 aneksu + 0005 cron) → seed 2× idempotentny. Stan po: historia 0001–0007, `sailings`/`vessels`/`sailing_id`/`trg_loads_guard` są, `ferry_vessel`/`ferry_departure` usunięte, cron = dokładnie 6 zadań aneksu, wrapper usunięty, 5 stref, 2 statki, dane i konta nietknięte. **Aplikacja:** prom czytany z `sailings` przez `loads.sailing_id` (embed `sailings(…,vessels(name))`; czasy `coalesce(delayed_*, *)`; status ODWOLANY→CANCELLED, OPOZNIONY→DELAYED, inaczej BOOKED); zapis promu = `ferry_booking_ref` + `sailing_id` tylko gdy rejs (statek + rozkładowe odejście) istnieje w `sailings` — pełne przypisanie rejsu w M10. Tryb demo bez zmian (pw 4/4, paczka demo bez kodu Supabase). **Uruchomienie testów db (ręcznie, poza pre-push — wymaga lokalnego Postgres + PostGIS):** `PGADMIN=postgres://postgres@localhost:<port>/postgres bash tests/db/run.sh` (przy kilku klastrach Debiana ustaw `PGCLUSTER`, inaczej ostrzeżenie wrappera psql psuje porównania). GitHub Actions odłożone — bramą zostaje pre-push. |
| AN2 | Aneks 2 — źródła danych zewnętrznych, okna planowe poza przewoźnikiem | **DONE** | `b7056c8` (tekst) · `61731ff` (pliki/migracje/testy) | `tests/db/run.sh` **security 52/52 · status 44/44** (migracje 0001–0008) · `tests/ferry.test.ts` **17/17** · unit **144 / 9 skip** · live **8/8** · BK2 verify **21/21** · BK2 e2e **20/20** · BK3 e2e **9/9** · pw **4/4** · d19 **0** · deur **0** · lint **0** | **Decyzje właściciela:** przewoźnik **nie zmienia okien planowych** (plan z harmonogramu KSH; wymusza baza — `guard_load_update`, +2 testy security); źródła zewnętrzne wyłącznie darmowe (`ZRODLA_DANYCH.md`). **Pliki:** `docs/handover/ZRODLA_DANYCH.md` (nowy), `STATUSY_AUTOMATYCZNE.md`, `SCOPE.md` (§38), `AGENTS.md`, `.cursor/rules/tower.mdc`, `0004_statusy_automatyczne.sql` (zastąpiona), seed `stegra.sql` (operator POLSCA Baltic Ferries; Nova Star MMSI 311000787 / IMO 9462067; Wawel MMSI do potwierdzenia), `tests/db/security.sh` (52), `src/lib/ferry/polferries.ts` + `digitraffic.ts` (z `lib/ferry/` pakietu; import w teście poprawiony na `../src/lib/ferry/`), `tests/ferry.test.ts`, fixtures z 25.09.2026. **Baza hostowana — delta, bez resetu:** 0004 była już zastosowana (AN1), a nie jest idempotentna (create type/table, cron) → zmiany Aneksu 2 wniesione nową migracją **`0008_an2_okna_planowe_statki.sql`** (idempotentna: `add column if not exists mmsi/imo`, `create or replace guard_load_update()` 1:1 z nowej 0004, uzupełnienie operatora/MMSI/IMO statków — seed ma `on conflict do nothing`); na świeżej bazie 0008 = no-op (run.sh 52/44 z 0008). `db push` → historia 0001–0008; seed ponownie (idempotentny); stan: 2 statki z nowym operatorem, Nova Star z MMSI/IMO, 5 stref, 6 zadań cron, 2 transporty, 3 konta — nietknięte. **Znana luka (M5/M10):** szuflada nadal pokazuje przewoźnikowi okna załadunku jako edytowalne (formularz „Awizacja / Prom”) — baza odrzuci faktyczną zmianę; ukrycie/readonly w M5/M10 (zmiana UI dotyka matrycy wizualnej, nie trywialna teraz). |

## Aneks 3 — decyzje do wydania 1.0 (`DECYZJE_WYDANIE_1_0.md`)

| ID | pozycja | status | commit | testy (liczby) | uwagi |
|---|---|---|---|---|---|
| AN3 | Aneks 3 — tekst w `ZLECENIE_FINAL.md` | **DONE** | (ten commit `docs(AN3)`) | — | wypchnięcie 7 commitów `5767156..79ff7d5` przez pre-push; drzewo lokalnie = zdalnie `571b92c3…` |
| 2.1 | Import: anulowanie zamiast kasowania, blokada od AT_LOADING i przy fakturze; zakaz DELETE na `loads` | DONE | 8445485 | release 30/30 (db), unit 278, schedule-import 19, etap4 D26 e2e | 0019: zakaz DELETE loads (uprawnienie + wyzwalacz), import_cancel_loads/import_removal_check/cancel_load z audit_log; hosted TESTOWY zastosowane; podgląd pokazuje zablokowane z powodem; snapshot Supabase pomija CANCELLED · testy bazy wg AN3 §2.1 |
| 2.2 | `risk_signals.audience` — zamknięte drzwi (RLS) | DONE | 8d4198a | release 58/58 (db; 28 nowych 2.2, czerwone 22 FAIL przed 0020) | 0020: audience HHL/HHL_PRZEWOZNIK/HHL_KLIENT/WSZYSCY z wyzwalacza (klient API nie nadpisze), risks_read: przewoźnik tylko swoje transporty + korytarz, klient swój projekt; hosted TESTOWY zastosowane; live provider 14/14, auth 21/21 · testy bazy wg AN3 §2.2 |
| 2.3 | Token kierowcy: ≥128 bitów, skrót, jeden transport, ważność, odwołanie | DONE | 1595e8b | release 108/108 (db; 39 nowych 2.3), unit driver-api 5, hosted: token 67 zn., instrukcje 0 pól cenowych | 0021 + PR6: pozycje i etapy przez SQL (anon, bez Edge), zdjęcia przez Edge driver-photo (kod w repo; wdrożenie funkcji czeka na token właściciela §4.4); hosted TESTOWY zastosowane · razem z PR6 (`driver_post_position`) |
| 2.4 | Numer zlecenia 48 h — ryzyko + przypomnienie, bez blokady | DONE | 1ad7d4b | release 69/69 (db; 11 nowych 2.4) | detect_missing_order_numbers (0012) + odbiorcy z 0020: brak numeru HHL → ryzyko HHL + przypomnienie HHL; brak numeru przewoźnika → HHL_PRZEWOZNIK + przypomnienie przewoźnika; blokady Q10 bez zmian |
| PL-T | Polskie znaki w napisach PL + test PL-T (hunspell pl_PL) + przebieg 840 (EN/SV = 0 zmian) | DONE | 40eca8a, 28c2b05, 22e8921 | PL-T 4/4 (czerwony przed: 112 słów spoza pl_PL; zielony po); przebieg 840: ok 840/840, zmienione 169 — wszystkie PL, EN 0, SV 0; visual smoke 4/4 (2 ujęcia mapy PL odświeżone) | zmiana .github/workflows/unit.yml (lfs: true) wycofana z commitu 28c2b05 — GitHub odrzuca push workflow bez zakresu workflow tokenu (działanie właściciela) · poprawione 114 napisów PL (d19Pl); identyfikatory w bazie ASCII bez zmian; tag baseline-1.0-2026-09-26; otwarte: baner kokpitu w DashboardView.tsx (tekst bez polskich znaków widoczny też w EN/SV — poprawka zmieniłaby ujęcia EN/SV, decyzja właściciela) · tag `baseline-1.0-<data>` |

## Aneks 4 — produkcja w całości za darmo (`ANEKS_4_PRODUKCJA_ZA_DARMO.md`)

| ID | pozycja | status | commit | testy (liczby) | uwagi |
|---|---|---|---|---|---|
| AN4 | Aneks 4 — tekst w `ZLECENIE_FINAL.md` | **DONE** | (ten commit `docs(AN4)`) | — | obecny projekt Supabase = **testowy** (AN3 §4.1); produkcja = nowy projekt UE, plan darmowy |
| PR1 | Podtrzymanie: `keep_alive()` + `system_heartbeat`, Cloudflare Worker co 6 h, e-mail przy błędzie | DONE (Worker czeka na Cloudflare) | d188716, d99b5ce | keep-alive-worker 4/4 (+1: brak service_role w workers/src/konfiguracji hostingu); db release: keep_alive dla anon, zapis 1 wiersza ≤ 1/60 s | odp. §3c: Worker używa wyłącznie SUPABASE_ANON_KEY; keep_alive() security definer aktualizuje tylko system_heartbeat · 0022 system_heartbeat + keep_alive() (anon, zapis ≤1/60 s); workers/keep-alive: cron co 6 h, e-mail Resend przy błędzie; wdrożenie Workera i sekrety — konto Cloudflare właściciela (sekcja 10 p.2) · Worker wdraża właściciel (konto Cloudflare) |
| PR2 | Kopie: `backup-export` 02:30 (CSV+gzip, age X25519, R2), `scripts/restore.sh`, test odtworzenia | DONE (Edge wdrożona; cron WYŁĄCZONY — czeka na R2) | bd4d59b | backup 10/10 | 26.09: backup-export v1 wdrożona, BACKUP_AGE_RECIPIENT = publiczny klucz age (prywatny nie opuszcza /workspace/secure); bez crona tower-backup-export do czasu sekretów R2_* (Cloudflare) · 0023 na TESTOWYM; utrata danych do 24 h; wdrożenie Edge + R2 + klucz age — właściciel (docs/handover/KOPIE_ZAPASOWE.md) · R2 i klucz age — właściciel |
| PR3 | Poczta: Resend jako SMTP Supabase Auth, domena zweryfikowana | **DONE** (zamknięte przez właściciela 26.09.2026) | — | link logowania 15:29 PL → doręczony (Resend: delivered), zalogowanie z telefonu 15:47:32 PL | Auth SMTP = Resend (smtp.resend.com:465), nadawca @log-mar.pl; pełny przebieg zaproszenia Sebastian@log-mar.pl (HHL_ADMIN) wysłany 16:03:30 PL — czeka na kliknięcie właściciela · 26.09 15:00: Sebastian.bozekq@gmail.com jest członkiem organizacji Supabase (rola Owner) → test linku nie spełnia kryterium, link NIE wysłany; auth.users bez zmian (lista sprzątania pusta); potrzebny inny adres spoza zespołu; ALERT_EMAIL_TO=Sebastian@log-mar.pl ustawiony w sekretach funkcji · 26.09: test linku na Sebastian.bozekq@gmail.com NIE wykonany — warunek (sprawdzenie członków organizacji Supabase przez Management API) niemożliwy bez tokenu; odczyt produkcji: adres w auth.users 0, w app_users 0; nic nie wysłano, nic nie utworzono; ALERT_EMAIL_TO=Sebastian@log-mar.pl dla usage-check/keep-alive — czeka na ten sam token (sekrety Edge) i token Cloudflare (Worker); Resend free: 100 e-maili/dobę (UTC), 3000/mies., 10 req/s · Resend (plan darmowy) jako SMTP Supabase Auth + DNS SPF/DKIM — działanie właściciela nr 3 (sekcja 10 ANEKSU 4); kryterium: link logowania dociera spoza zespołu projektu; sprawdzić dzienny limit wysyłek · blokuje produkcję; konto/DNS — właściciel |
| PR4 | `usage-check` codziennie: 70% → ryzyko, 85% → ryzyko wysokie + e-mail, historia | **DONE** (wdrożone, cron włączony) | 86b5a74 | usage-core (unit); Edge usage-check v1: bez klucza 401, klucz anon 403 | 26.09: wdrożona; sekrety ALERT_EMAIL_TO, RESEND_API_KEY, MAIL_FROM; pg_net 0.20.4 włączony, Vault: project_url + service_role_key; cron tower-usage-check 05:00 UTC (07:00 PL); pg_net → Edge sprawdzony (driver-photo → 400, bez zapisu); pierwszy przebieg 27.09 07:00 PL · 70% → ryzyko HHL, 85% → HIGH + e-mail raz; egress tylko z API zarządzania (opcjonalny token); docs/handover/LIMITY_PLANU_DARMOWEGO.md |
| PR5 | GPS: 2 min w ruchu / 15 min na postoju, limit 60 s w `process_position()`, retencja 30 dni, pomiar bajtów | DONE | 816970f | driver-tracking 10/10; db release 145/145 (PR5: 14); status 44/44; TESTOWY: 0025 + pominięcie punktu 30 s (rollback) | 1000 pozycji = 386 662 B; prognoza ~52 MB stan ustalony, najgorzej ~190 MB; purge_personal_data bez EXECUTE dla zalogowanych |
| PR6 | `driver_post_position(token, …)` w SQL (warunki 2.3, limit zapytań); zdjęcia przez Edge | DONE (Edge driver-photo wdrożona) | 1595e8b, 9b404ba | release 145/145; Edge: bez formularza → 400 | 26.09: driver-photo v1 --no-verify-jwt (token kierowcy sprawdza baza) · pozycje i zdarzenia przez SQL driver_post_position/driver_post_event (API bazy, bez limitu Edge); zdjęcia przez Edge driver-photo — wdrożenie wymaga tokenu Supabase (właściciel nr 6); budżet ~71 000/500 000 wywołań — pomiar po miesiącu |
| PR7 | Pliki: kompresja zdjęć w przeglądarce (1600 px, JPEG 0,75), PDF ≤ 10 MB, archiwizacja od 70% | **DONE** (archiwizacja: Edge przygotowana, czeka na R2) | b93f0a3 · d8f916e | db archive **18/18** (przed 0029: 15 FAIL); Playwright pr7-compress 1/1 (13,6 MB → 236 kB, 1600×1200); unit 310 passed / 28 skip | 0029 na hostowanym (PDF ≤ 10 MB; 0 dokumentów, 0 kandydatów); funkcje archiwum tylko service_role; start archiwizacji od 70% z 1 GB; backup-export pomija archived_at; Edge `document-archive` bez harmonogramu |
| PR8 | Hosting: Vercel darmowy + zapas Cloudflare Pages, domena u właściciela, `PRZELACZENIE_HOSTINGU.md`, test przełączenia | **PRZYGOTOWANE** (wdrożenie po działaniach właściciela) | 8755c82 | hosting-switch 5/5 | 4.3a: build statyczny; vercel.json tylko nagłówki /download; /api/trafikverket tylko dev/podgląd (produkcja → dane przykładowe / Edge road-se); brak funkcji Vercel; public/_headers = te same nagłówki dla Cloudflare Pages; procedura w `PRZELACZENIE_HOSTINGU.md` · wdrożenie po działaniach właściciela (§10) |
| AN5 | Aneks 5 v2 — tekst w `ZLECENIE_FINAL.md` | **DONE** | (ten commit `docs(AN5)`) | — | obecny projekt Supabase = **PRODUKCJA** (jedyny); od teraz żadnych testów zapisujących na hostowanym; kolejność wg sekcji 6 ANEKSU 5 (zastępuje kolejność PR z ANEKSU 4) |
| A5-SPRZATANIE | Sprzątanie danych testowych: kopia → lista tabela po tabeli do zatwierdzenia → usunięcie → liczby | OPEN | — | — | STOP przed usunięciem — akceptacja właściciela; zostają migracje, `stegra.sql`, 147 rejsów |
| A5-BK5-LOKALNIE | BK5 (test API) na lokalnym Supabase (CLI + Docker) | BLOCKED | — | — | na boxie brak Dockera — BK5 nie uruchamiany na produkcji |
| A5-PODGLADY | Podglądy Vercel w `DemoProvider`, build produkcyjny tylko z `main` | **DONE** | e87c24f | vercel-preview-mode 4/4; build VERCEL_ENV=preview + VITE_AUTH_MODE=supabase → 0 × „supabase”; production z gałęzi dev → przerwany | `build/authMode.ts` wywoływany w vite.config.ts; poza Vercel bez zmian; Production Branch = main ustawić też w panelu Vercel (właściciel, przy O2) |
| A5-SESJA-ROK | Sesja użytkownika 365 dni (pg_cron czyści `auth.sessions`), JWT 3600 s, link ≤ 1 h, odwoływanie, Moje urządzenia + testy §4.5 | DONE (konfiguracja Auth hostowana — do potwierdzenia przez Management API) | 2a7e939 · d24236a | db session 27/27; session-year 5/5; session-year.local 6/6; gate +session 27 | 0028: słowniki i preferencje też wymagają aktywnego konta · 0026 na hostowanym, cron tower-sesje-rok 02:20 UTC; JWT 3600 s i otp_expiry 3600 s w config.toml (test); link jednorazowy i JWT na hostowanym — niesprawdzone: brak SUPABASE_ACCESS_TOKEN w środowisku procesu; naprawione przy okazji: organizations/projects/app_users czytelne dla nieaktywnego — teraz 0 wierszy; kierowca bez zmian · kierowca bez zmian (24 h po rozładunku, max 14 dni) — rocznej autoryzacji kierowcy nie zaczęto |
| A5-KLUCZ | Para kluczy age poza repo; publiczny → sekret `backup-export`; prywatny → właściciel offline, potem usunięcie z dysku | W TOKU (czeka na przekazanie) | — | — | para age wygenerowana 26.09 10:58 poza repo (/workspace/secure, prywatny chmod 600, nie w repo/logach/raportach); publiczny w pliku obok — do sekretu backup-export po uzyskaniu tokenu; prywatny: przekazanie właścicielowi → usunięcie z dysku i potwierdzenie |
| 6.1 | Przyczyna systemowa luk EXECUTE: ALTER DEFAULT PRIVILEGES + lista dozwolonych funkcji | **DONE** | `593e065` | security 56/56 (+4: lista dozwolonych, PUBLIC 0, nowa funkcja bez EXECUTE, purge_personal_data); czerwony przed (3 FAIL: 33 funkcje z EXECUTE dla PUBLIC) | 0027 na hostowanym: odebrano 40 par rola–funkcja (m.in. anon: mark_invoice_paid, detect_*; oba: wyzwalacze, rls_auto_enable), poza listą 0; service_role jawnie. Dziennik (pg_stat_statements od 24.09 23:00 PL + cron.job_run_details od 25.09 02:30 PL): purge_personal_data 0 wywołań przez anon/authenticated/service_role; 3 przez postgres — harmonogram (25.09 04:30 i 26.09 04:15 PL) i administracyjne |
| A5-BK5-LOKALNIE | BK5 na lokalnym Supabase (Docker), bez dotykania produkcji | **DONE lokalnie** | d24236a · 3a306b4 | BK5 **8/8**; session-year.local **6/6**; supabase-provider.live 12/14 (M10/M12: brak lokalnie danych path-scenario i rejsów Polferries); db session **27/27** | `scripts/bk5/local.sh` przerywa, gdy API nie jest lokalne; konta `*@bk5.local` tylko lokalnie (hostowany: 0 kont, 0 nowych sesji). Luka znaleziona: konto nieaktywne widziało geofences/vessels/sailings/fx_rates (polityka `true`) → migracja **0028** (hostowany: zastosowana), test w session.sh czerwony przed (2 FAIL), zielony po |
| 3b | Blokada kubełka R2 (Bucket Locks) dla kopii | **PRZYGOTOWANE** (czeka na token Cloudflare) | 41fc9b7 | backup-core **5/5** (test blokady czerwony przy blokadzie monthly 366 d) | reguły `docs/handover/r2/bucket-lock.json`: `daily/` 30 d, `monthly/` 360 d; w dokumentacji Cloudflare brak ograniczenia do planu płatnego; DELETE zablokowanego obiektu nie przerywa backup-export; `KOPIE_ZAPASOWE.md`: retencja poprawiona na 30 d / 12 mies. (było 7/3); R2 free 10 GB, 1 mln A, 10 mln B / mies. |
| AN5-BANER | Baner kokpitu KSH/przewoźnik ze słownika PL/EN/SV + D19-T słownik (wszystkie role i widoki) | **DONE** (wzorzec 840 NIEzaktualizowany — różnice nie są szumem) | 4e29354 · c13eae2 | D19-T 2/2; 2. przebieg 26.09: 60 ujęć kokpitu KSH/SCX × 4 przebiegi (build bez banera A/B, z banerem A/B) | Dowód: ten sam build A vs B = 0 px w 60/60 (brak szumu); bez vs z banerem: zmiany w 60/60, poza pasem banera tylko 1 ujęcie (ksh sv 1280 dark, 10 px); wzorzec vs build BEZ banera: 13 ujęć różni się poza banerem (159–298 px, powtarzalnie) → stały dryf od kodu po utworzeniu wzorca, nie szum; kryterium niewykazane, shots-baseline bez zmian; przebiegi w /tmp/rel/runs2 · 9 ujęć ma drobne różnice poza banerem także w buildzie BEZ zmiany banera (ok. 18×25 px, 160–220 px; w KSH EN niestabilne między przebiegami: 10 px) → `shots-baseline/` NIE zaktualizowany; przebieg w `/tmp/rel/shots-ban`; SCX PL zmienione przez polskie znaki (pól, uzupełnienia, załadunkiem); poza banerem znane 44 trafienia / 12 tekstów (`tests/fixtures/d19-dict-known.json`) — do decyzji właściciela |
| A5-EDGE | Wdrożenie funkcji Edge i sekretów na produkcji (26.09) | **DONE** | — | 11/11 ACTIVE v1; bez klucza 401 (10 z JWT), anon → 403 (usage-check, backup-export); driver-photo bez JWT → 400 | Wdrożone: usage-check, backup-export, document-archive, send-notifications, driver-photo (bez JWT), ferry-ais, ferry-schedule, ferry-status, road-pl, road-se, traffic-flow. Sekrety: ALERT_EMAIL_TO, RESEND_API_KEY (klucz tylko do wysyłki), MAIL_FROM, BACKUP_AGE_RECIPIENT (publiczny). Cron włączony: **tower-usage-check** (05:00 UTC). WYŁĄCZONE: tower-backup-export i document-archive (R2/Cloudflare); send-notifications (wysyła e-maile do użytkowników — decyzja właściciela; kolejka EMAIL = 0); ferry/road/traffic (bez kluczy API działają w trybie DEMO — zapisałyby dane demonstracyjne na produkcji) |
| 3.2b | Cron ferry-ais co 10 min na produkcji | **DONE** (zadanie działa, funkcja odpowiada 403 — patrz F-KLUCZ) | f78744e | cron.job_run_details: 15:40 succeeded; net: 403 | 12 zadań cron; ferry-ais zawsze LIVE; Wawel bez MMSI (prawdziwe 311852000 — do wpisania przez właściciela) |
| 3.2c | Typy plików: sygnatura w driver-photo + limit | **DONE** (wdrożone na produkcję) | f0ff35e | unit file-signature 7/7; produkcja: HTML jako JPEG → **415**, 0 obiektów, 0 dokumentów | reszta typów pokryta listami MIME zasobników |
| 3.2d | Higiena funkcji (0030) | **DONE** (produkcja) | a64465b | 0 funkcji bez search_path (było 22); funkcje poza allowlistą 0 | spatial_ref_sys: REVOKE nie działa → W1 |
| 3.2e | Widoki v_load_* | **DONE** (bez zmian — sprawdzone) | — | widoki nieaktualizowalne, właściciel postgres | nadmiarowe prawa zapisu authenticated z domyślnych uprawnień nieskuteczne; widoki cenowe definer celowo (SECURITY.md §1) |
| 3.2f | 8 tabel z RLS bez polityk | **DONE** (celowe, opisane) | 4ecf337 | security +3 [3.2f] | 6 bez GRANT; permits/insurance_policies 0 wierszy przez RLS; HHL widzi je jako dokumenty (SECURITY.md §2) |
| W1 | spatial_ref_sys tylko do odczytu dla anon/authenticated (0031) | **DONE** (produkcja 26.09 ~15:45 PL) | 4ecf337 | security **67/67** (było 62); produkcja: DELETE srid=-1 anon/authenticated → 42501, TRUNCATE authenticated → 42501, postgres → DELETE 0; 8500 wierszy bez zmian | wyzwalacz instrukcji `spatial_ref_sys_readonly`; funkcja bez EXECUTE dla ról API |
| W2 | Zdarzenia: lista dozwolonych typów dla ról API + CHECK + strefa z tabeli (0032) | **DONE** (produkcja 26.09 ~15:47 PL) | cd3b73f | security **76/76** (+9), status **44/44** bez zmian; bez 0032: 7 z 9 nowych testów FAIL; produkcja (transakcje wycofane): KSH GEOFENCE_ENTER, SCX GEOFENCE_ENTER/STATUS_AUTO/MILESTONE_UNLOADED → RLS, nieznany typ → CHECK, SCX NOTE przechodzi; load_events 40 → 40 | tabela typ → kto tworzy: SECURITY.md §6; 40 istniejących zdarzeń zgodnych z CHECK (sprawdzone przed wdrożeniem); unit 322/28 |
| F-KLUCZ | Zadania cron → funkcje Edge dostawały 403 (klucz w env platformy ≠ klucz legacy w Vault) | **DONE** (10 funkcji wdrożonych 26.09 ~15:49 PL) | 31b9093 | unit service-auth 5/5; produkcja: cron ferry-ais 15:40 → 403, 15:50 → **200** (LIVE, ok, Wawel BRAK_MMSI); bez klucza 401, anon 403 (5 funkcji) | wykryte przy sprawdzaniu pierwszego przebiegu ferry-ais (3.2b); dotyczyło też usage-check, backup-export, document-archive, send-notifications i ferry-*/road-*/traffic-flow; wykrycie po skrótach sekretów z Management API (bez odczytu wartości) |
| 3.2a | Sprzątanie danych testowych produkcji (zatwierdzone przez właściciela) | **DONE** (26.09 16:03 PL, jedna transakcja) | — | przed → po: loads 3→0, load_events 40→0, positions 6→0, geofence_states 5→0, shipment_items 2→0, notifications 1→0, sailings 148→147, risk_signals 2→0, audit_log 163→1 (CLEANUP_TEST_DATA, id 167), integration_runs 5→1 (usunięte id 1–4), user_invites 3→0, app_users 3→0, auth.users 3→0, identities 3→0, sessions 175→0, refresh_tokens 175→0, one_time_tokens 0, mfa 0; próba wycofana przed wykonaniem dała identyczne liczby | wyzwalacze `load_events.trg_load_events_immutable` i `loads.loads_no_delete` wyłączone i włączone w tej samej transakcji (po commicie tgenabled=O); kopia: `/workspace/secure/kopia-przed-sprzataniem-2026-09-26` (manifest sha256 33566ce7…, SHA256SUMS c1b597f2…, dopisane zaszyfrowane migawki 16:00 usuwanych tabel); dziennik produkcji zaczyna się od CLEANUP_TEST_DATA |
| WAWEL-AIS | Wawel: MMSI/IMO/znak wywoławczy | **DONE** (produkcja) | 4569a7b | produkcja: Wawel 311852000 / 7814462 / C6TY9; Nova Star bez zmian | seed stegra.sql zaktualizowany |
| ZAPR-7D | Zaproszenie wygasa po 7 dniach (0034) | **DONE** (produkcja) | db08f9c | security **79/79** (+3: 8 dni → TOWER_INVITE_EXPIRED, 6 d 23 h → konto, bez zaproszenia → TOWER_NO_INVITE); produkcja w transakcji wycofanej: zaproszenie sprzed 8 dni → TOWER_INVITE_EXPIRED, bez śladów (invites 1, users 1, audit 3) | disable_signup=false zostaje; ponowne zaproszenie odnawia termin |
| STRAZNIK | Strażnik wyniku zadań (0035) | **DONE** (produkcja 26.09 ~16:06 PL) | ea201ee | watchdog.sh **19/19** (symulowany błąd ferry-ais od 12:00 → OK o 12:17, ALARM o 13:07 = najbliższy przebieg cogodzinny; bez duplikatów; zamknięcie po sukcesie; kopia nieuzbrojona do pierwszego sukcesu; KSH 0 ryzyk; anon/authenticated bez EXECUTE); produkcja w transakcji wycofanej (now+61 min): ferry-ais ALARM, 1 ryzyko JOB_FAILURE HIGH audience HHL, e-mail w kolejce pg_net do Sebastian@log-mar.pl, temat „[Watch Tower] ALARM: …”; po rollbacku ryzyka 0, kolejka 0 | cron tower-straznik-zadan 7 * * * *; Vault +3 sekrety (resend_api_key, mail_from, alert_email_to); usage-check wdrożone z zapisem integration_runs; stan teraz: ferry-ais OK, usage-check OKRES_STARTOWY, backup NIEUZBROJONY (R2) |
| CENY-3ROLE | Transport testowy z kosztem i przychodem na produkcji + symulacja 3 ról (zatwierdzone przez właściciela) | **DONE** (26.09 ~16:10 PL) | — | jedna transakcja wycofana: transport TEST-CENY-1, koszt 2000+BAF 100 = **2100** EUR, przychód 2600+BAF 130 = **2730** EUR; HHL: 1 transport, koszt 2100 / przychód 2730 / marża **630 (23,08%)**, widok klienta 1, widok przewoźnika 1; KSH: 1 transport, marże **0**, cena klienta **2730**, cena przewoźnika **0**, load_cost/load_revenue → permission denied; przewoźnik: 1 transport, marże **0**, cena klienta **0**, cena przewoźnika **2100**, load_cost/load_revenue → permission denied; anon: widoki cenowe → permission denied; PRZED/PO: loads 0/0, load_cost 0/0, load_revenue 0/0, audit_log 3/3, app_users 1/1, TEST-CENY-1 0, konta symulacji 0 | usunięcie = ROLLBACK tej samej transakcji (atomowo, bez wyłączania wyzwalaczy loads_no_delete / load_events); konta KSH/przewoźnika tylko jako wiersze app_users w transakcji (bez kont auth); w audit_log 0 wpisów z testu |
| ZAPR-SEB | Pierwsze prawdziwe konto: Sebastian@log-mar.pl HHL_ADMIN (pełny przebieg zaproszenia) | **DONE** (logowanie 26.09 16:06 PL; potwierdzenie „Moje urządzenia” w UI — właściciel) | — | zaproszenie 16:03:29 (bootstrap SQL + audit USER_INVITED), link 16:03:30 (HTTP 200), kliknięcie i logowanie 16:06 z telefonu (Android); app_users HHL_ADMIN aktywny, e-mail potwierdzony; auth.sessions 1: utworzona 26.09.2026 16:06, my_sessions() wygasa 26.09.2027 16:06 (+365 dni); current_app_role() = HHL_ADMIN | bez hasła ustawionego przez kogokolwiek (GoTrue zapisuje losowy skrót dla kont OTP — hasło nieznane, logowanie tylko linkiem); not_after = null z założenia (plan darmowy: 365 dni liczy my_sessions + cron tower-sesje-rok) |
| 2.2 | Cron send-notifications (kolejka e-mail notifications → Resend) | **DONE** (produkcja 26.09 16:14 PL) | 1f35a65 | watchdog **20/20**; pierwszy przebieg 16:15:07: HTTP 200, integration_runs ok (pending 0, sent 0, failed 0) | cron tower-send-notifications */5 (14 zadań cron); sekret APP_URL = site_url Auth (https://watch-tower-makieta.vercel.app) dla linków w e-mailach; strażnik: okno 30 min od 17:00 PL; ok. 430 wpisów integration_runs/dobę (ferry-ais + send-notifications) — retencja do rozważenia |
| W3 | load_messages.msgs_read + shipment_items.items_read wg transportu/projektu (0037) | **DONE** (produkcja 26.09 ~16:40 PL) | 7318abd | security **83/83** (+4; bez 0037: 3 z 4 FAIL — przewoźnik widział wiadomość i pozycję cudzego transportu, klient pozycję cudzego projektu); status 44/44; produkcja: polityki odczytane po wdrożeniu | SECURITY.md §8 |
| W4 | Limity zasobników (0038) | **DONE** (produkcja) | 3a025e3 | storage **35/35** (+2); produkcja: zdjecia 15 MB → **2 MB**, dokumenty 20 MB → **10 MB**, faktury 20 MB bez zmian; obiektów w storage 0 | 3.2c: sygnatura + limit w driver-photo już wcześniej (f0ff35e); faktury 20 MB — do decyzji |
| WZORZEC-840 | Przebieg 840 po D19-12 (baner + 12 tekstów) → nowy tag wzorca | **STOP** (tag NIE utworzony, shots-baseline bez zmian) | 496f63e | 840/840 ujęć OK (build HEAD demo, bez „supabase” w paczce); vs wzorzec: różne 324 (dokładnie), pixelmatch>0: 316, compare.mjs >60 px: 237. EN/SV: 263 (inne widoki 211 — wyłącznie miejsca 12 tekstów: dokumenty 36, faktury 40, ryzyka 60, automatyzacje 16, finanse 20, moje-zadania 20, strefy 18, rozliczenia 1 = 16 px pixelmatch 0; kokpit 52 = baner KSH/SCX + znacznik D15). **Poza zakresem**: PL 61 ujęć (PL-T 40eca8a: ustawienia 17 „Język/wyświetlania/Domyślny”, ryzyka 5, dokumenty 1, finanse 2, harmonogram 2, mapa 2, moje-stawki 2, rozliczenia 1, strefy 1, kokpit 28) oraz znacznik ciężarówki D15 (ecb0632) w kokpicie HHL 20 ujęć (≈211 px, pixelmatch ≤21) | zmiany spoza banera i 12 tekstów = zamierzone wg bisectu (G4_WZORZEC.md), ale reguła „każda inna zmiana → STOP”; decyzja właściciela: przyjąć PL-T + D15 do nowego wzorca (ujęcia gotowe: /tmp/rel/shots-840-run) albo nie; D19-T słownik: 0 znanych trafień, fresh-smoke OK |
| HASLO-B | Skąd hash bcrypt na koncie „tylko link” (Sebastian@log-mar.pl) | **DONE** (bez zmian na produkcji) | — | odczyt produkcji: auth.users created_at 26.09 16:03:30 PL (1 s po USER_INVITED 16:03:29), invited_at **NULL**, confirmation_sent_at 16:03:30, provider email, hash `$2a$` 60 zn.; w repo jedyna ścieżka zaproszenia = `signInWithOtp(shouldCreateUser: true)` (UsersAdmin.tsx:55), bootstrap też POST /auth/v1/otp (HTTP 200) | Konto utworzył GoTrue przez **signInWithOtp → /auth/v1/otp → MagicLink**; dla nowego/niepotwierdzonego użytkownika GoTrue sam generuje losowe hasło tymczasowe: supabase/auth @ce9a8ee `internal/api/magic_link.go` l. 84–91 (`crypto.GeneratePassword(config.Password.RequiredCharacters, 33)` → `Signup`), nigdzie nie zwracane. My hasła nie ustawialiśmy → wymiana hasła i wpis audytu **niepotrzebne**; sesja właściciela nietknięta. Logi Auth przez Management API niedostępne (`logs.all` usunięty 23.09, nowy `/logs` zwraca „Backend error”); auth.audit_log_entries puste (audyt GoTrue wyłączony) |
| ZAPR-LOGIN | Wygasanie zaproszeń w praktyce + przyjęcie przy pierwszym logowaniu (0039) | **DONE** (produkcja 26.09 ~18:50 PL) | 0f1ff4d | **invite.sh 28/28** (nowy w gate): link tworzy konto bez USER_ACCEPTED_INVITE → pierwsze logowanie = 1 wpis + accepted_at, kolejne logowanie bez wpisu; konto bez logowania 8 dni → active=false, widzi 0 wierszy, audyt USER_INVITE_EXPIRED; zalogowane 8 dni i świeże 6 d 23 h bez zmian; ponowne uruchomienie 0; anon/HHL bez EXECUTE; ponowne zaproszenie → aktywne, nowy termin, USER_REINVITED, zadanie 0, logowanie → przyjęcie; zalogowanego nie da się zaprosić ponownie; wygasłe konto ze starym linkiem → bez przyjęcia, dalej 0 wierszy · produkcja (transakcja wycofana): 2 konta testowe → przyjęcia 0 → logowanie jednego → 1; expire teraz 0, now+8 d 1 (niezalogowane off, zalogowane on, Sebastian on); przed/po: auth.users 1/1, app_users 1/1, audit 3/3, invites 1/1; cron `tower-wygasanie-zaproszen` 40 2 * * * aktywny, oba wyzwalacze O | handle_new_auth_user tylko zakłada app_users; wyzwalacz AFTER UPDATE OF last_sign_in_at (NULL → wartość) pisze przyjęcie; `expire_unaccepted_accounts(p_now)` liczy 7 dni od max(utworzenie konta, ostatnie zaproszenie); `admin_invite_user` reaktywuje konto bez logowania (UI bez zmian — ten sam przycisk „Zaproś” + link). Historyczny wpis 169 USER_ACCEPTED_INVITE (16:03:30, przed kliknięciem 16:06) zostaje — dziennik tylko do dopisywania |
| FAKTURY-10MB | Limit PDF faktur 10 MB jak wszystkie PDF (0040) | **DONE** (produkcja) | c4d4f9b | storage **37/37** (+2: zasobnik faktury 10485760, create_document INVOICE 10 MB + 1 B → „za duży”); unit invoices3 +1 (10 MB przechodzi, +1 B → PDF_SIZE); produkcja: dokumenty 10 MB, faktury **10 MB**, zdjecia 2 MB | Kreator faktury (BillsPanel) przekazuje rozmiar pliku, `checkBill` zwraca PDF_SIZE — komunikat PL/EN/SV „PDF faktury jest za duży — limit to 10 MB”; create_document odrzucał PDF > 10 MB już od 0029 |
| RETENCJA-RUNS | Retencja integration_runs (0041) | **DONE** (produkcja) | 6a3e554 | watchdog **27/27** (+7: usuwa 5 z 9 — ok > 30 d i błędy > 180 d; ok 29 d i błąd 100 d zostają; ostatni sukces zadania 90 d zostaje i strażnik go widzi; zadanie tylko z błędem 400 d usunięte; ponownie 0; authenticated bez EXECUTE) · produkcja (transakcja wycofana): teraz 0 usuniętych, now+31 d 43 z 45 — zostaje po 1 (ostatni sukces ferry-ais i send-notifications); po rollbacku 45 | cron `tower-retencja-przebiegow` 50 2 * * * aktywny (16 zadań cron) |
| WZORZEC-3C | Nowy wzorzec 840 (PL-T 61 + D15 20 przyjęte 26.09 18:30) + tag `baseline-fala-3c-2026-09-26` | **DONE** | cede8bd | pełny przebieg 840 na buildzie HEAD 6a3e554 (demo, 0× „supabase”, po ZAPR-LOGIN/FAKTURY-10MB/RETENCJA-RUNS — kreator faktury zmieniony, więc przebieg obowiązkowy): **840/840 OK, 0 FAIL**; vs stary wzorzec: zmienione pikselowo **323**, compare > 60 px **237** (automatyzacje 16, dokumenty 36, faktury 40, finanse 15, kokpit 50, moje-zadania 20, ryzyka 60); podział: EN/SV inne 211 (12 tekstów D19-12), kokpit 80 (baner KSH/SCX 60 + znacznik D15 w kokpicie HHL 20), PL inne 32 (PL-T); po aktualizacji shots-baseline: **840/840 identyczne, 0 różnic** | Walidacja PDF faktury (błąd tylko po kliknięciu) nie zmieniła żadnego ujęcia — wynik jak w WZORZEC-840 (324 → 323, różnica 1 ujęcie szumu mapy). Para przed/po znacznika D15 (kokpit HHL EN 1440 light): /workspace/wzorzec-d15/ (przed, po, powiększenie ×10 z różnicami). Poprzedni wiersz WZORZEC-840 (STOP) zamknięty decyzją właściciela |
| A6-T1 | Ryzyka z kluczem tłumaczenia: risk_signals.title_key + detail->'params', wszystkie funkcje (baza + Edge), UI/e-maile/baner/demo ze słownika PL/EN/SV | DONE (0042 na produkcji; Edge wdrożone) | 21cca69 | unit 342/28 (risk-keys 14); db risks 17/17; gate 11 zestawów OK | 26.09: 0042 → produkcja (dry-run, --yes); sprawdzenie w transakcji wycofanej: detect_silent_vehicles → rk_silent_vehicle {plate, minutes}, job_watchdog → rk_job_failure, 0 wierszy bez klucza. Funkcje bazy: auto_set_status, apply_geofence_status, detect_ferry_overdue, promote_ferry_departures, detect_silent_vehicles, detect_sequence_risk, detect_missing_order_numbers, record_usage, job_watchdog (+ wyzwalacz: brak klucza → rk_generic). Edge wdrożone: ferry-schedule, ferry-status, ferry-ais, road-se, road-pl, traffic-flow, send-notifications (język e-maila = app_users.locale odbiorcy). PL = dotychczasowe teksty |
| A6-T2 | Test pseudo-lokalizacji (⟦…⟧) + przeniesienie napisów na sztywno do słownika | OPEN | — | — | ANEKS 6 |
| A6-T3 | Liczby, procenty i daty przez Intl w aktywnym języku (EN 15.7%, PL 15,7%, SV 15,7 %) | OPEN | — | — | ANEKS 6 |
| A6-WZORZEC | Przebieg 840 po T1–T3: EN/SV tylko miejsca T1–T3, PL 0 zmian (inaczej STOP) → tag | OPEN | — | — | ANEKS 6 |
| PR2-ZMIANA | Kopie przez Worker Cloudflare z wiązaniem R2 (binding) — bez klucza R2 i bez S3 | OPEN (po T1–T3 i po CLOUDFLARE_API_TOKEN) | — | — | Decyzja właściciela 26.09 21:15: Worker przyjmuje tylko PUT nowego obiektu z nagłówkiem sekretu współdzielonego z backup-export; GET/LIST/DELETE → 405, nadpisanie istniejącego klucza → 409, PUT bez sekretu → 401; blokada retencji jak w bucket-lock.json; restore.sh pobiera kopie osobnym tokenem tylko do odczytu, tworzonym na czas testu i odwoływanym po nim |
| A6-T2 | Brakujące tłumaczenia UI: pseudo-lokalizacja (build VITE_PSEUDO=1, ?pseudo=1 → ⟦…⟧) + crawl 3 języki × 3 role × widoki/szuflada (wszystkie zakładki)/dzwonek/pomoc; słownik ui6.ts | DONE | c4f5286 | unit 342/28; tsc OK; gate 11 zestawów OK | 409 nowych kluczy a6_* (widoki, szuflada, toasty store, panele auth/urządzenia/użytkownicy, link kierowcy, podgląd dokumentu, PWA kierowcy); mapy {pl,en,sv} → dictEntry (73 wpisy). Crawl: 871 → 583 napisów poza słownikiem — pozostałe to dane (seed, osoby, tablice, pliki, trasy, nazwy własne, sytuacje Trafikverket, nazwy reguł). PL identyczny (840). Znane stare usterki PL zostawione celowo: DRAWING w PL pokazuje identyfikator doc_cat_drawing, title flag dokumentów w harmonogramie = kod kategorii, kilka tekstów bez polskich znaków (np. podwyzszone, Zaladowano) — do poprawy osobną zmianą z akceptacją zmiany wzorca PL |
| A6-T3 | Liczby, procenty, wymiary, daty wg języka (Intl) | DONE | 7db8e45 | unit 345/28 (number-format 3) | Wg języka (EN/SV przez Intl): procenty (marża, OTIF, kompletność dokumentów), wymiary w szufladzie, fala/wiatr, data w Topbar i Dashboard, daty w Moje urządzenia. PL w postaci dotychczasowej (pctText z plLegacy, fmtNumKeepPl) — 840 PL bez zmian; +0.6 h w Ryzykach bez zmian. Poza zakresem: daty w tabelach (time.ts, formatTableDay — zapis liczbowy dd.mm, taki sam we wszystkich językach) |
| A6-WZORZEC | Wzorzec 840 po ANEKS 6 T1–T3 | DONE | 1b18fa1 | 840/840 OK; compare: PL 0/280, EN 280/280, SV 280/280 (próg 0,28 / 60 px) | Świeży build demo z HEAD (bez VITE_PSEUDO), paczka 0× słowo zakazane. PL: 0 ujęć ponad próg (maks. 0 px; 91 ujęć z różnicami antyaliasingu pod progiem). EN/SV: każde ujęcie zmienione, bo pasek górny jest na każdym ekranie (t→w/v tydzień, fala→wave/våg, data wg języka) + teksty widoków z T1–T3. W trakcie: poprawka EN wave (zawijanie przełącznika ról przy 1280) i rk_usage_next bez nazwy dostawcy. Tag baseline-fala-3d-2026-09-26 |
| A6-USTERKI | 3 usterki PL + twarda reguła kluczy w pseudo-lokalizacji | DONE | 1a0e4b2 | unit 345/28; crawl: 0 widocznych kluczy, 575 napisów = dane | (1) dokument DRAWING: PL/EN/SV z doc_cat_drawing zamiast identyfikatora; (2) dymek flag Z/C/F w harmonogramie: nazwa kategorii zamiast kodu (PERMIT_PL, LASHING_PHOTOS…); (3) teksty bez polskich znaków (podwyzszone, Zaladowano, Rozladowano, Dojezdza, Sila wyzsza, dokumentow, wymiarow, rozklad, Nynashamn) oraz szwedzkich (forhojd, Narmar, Farja, Godsfordakring…) — 25 wartości. Źródło: KOD — mapy w src/lib/voyageSea.ts i src/lib/enumLabels.ts sprzed ANEKS 6 (przeniesione 1:1 do słownika w A6-T2); nie baza, nie dane demo. Reguła twarda w scripts/pseudo-l10n.mjs (niezależna od wyjątków): na 583 napisach uznanych za dane znalazła 6 (wszystkie doc_cat_drawing), po poprawce 0 |
| A6-GENERIC | rk_generic: bezpiecznik zostaje, test ścieżek + strażnik | DONE (0043 na produkcji) | 53636db | unit rk-generic 3; db risks 23/23 | Test tests/rk-generic.test.ts: ostatnie definicje funkcji z migracji — 13 ścieżek (raise_risk 7: auto_set_status, apply_geofence_status ×3, promote_ferry_departures ×2, detect_ferry_overdue; insert 6: detect_silent_vehicles, detect_sequence_risk, detect_missing_order_numbers ×2, record_usage, job_watchdog), każda z jawnym kluczem rk_*; Edge: jedyne wejście store.ts → raise_integration_risk z title_key, 5 miejsc titleKey (8 kluczy), 12 wywołań raiseRisk w jobs.ts. 0043 (idempotentna): wyzwalacz AFTER INSERT when title_key='rk_generic' → JOB_FAILURE HIGH (audience HHL), klucz rk_key_guard, jedno otwarte na projekt×rodzaj, e-mail Resend na ALERT_EMAIL_TO (Vault), nigdy nie blokuje zapisu. Produkcja: dry-run → --yes; test w transakcji wycofanej: ryzyko rk_key_guard/JOB_FAILURE/HIGH/HHL, mail WYSLANY_DO_KOLEJKI (wycofany); otwartych rk_generic: 0 |
| A6-WZORZEC2 | Wzorzec 840 po 3 usterkach PL, regule kluczy i strażniku rk_generic | DONE | ce094ad | 840/840 OK; PL 25/280, EN 0/280, SV 25/280 (próg 0,28 / 60 px) | Świeży build demo z HEAD, 0× słowo zakazane. Wszystkie 50 zmienionych ujęć to widok Dokumenty, kolumna nazw w liście plików: PL „doc_cat_drawing” → „Rysunek elementu” (usterka 1), SV PL-tillstand/SE-tillstand/Godsfordakring → tillstånd/Godsförsäkring (usterka 3). EN bez zmian (już ze słownika od A6-T2). Pozostałe usterki (dymek flag, teksty w szufladzie/tytułach) poza kadrem 840. Tag baseline-fala-3e-2026-09-27 |
| PR2-R2 | Kopia zapasowa na Cloudflare R2 (Worker tylko PUT, blokada usuwania) | DONE | ccbfd8b | test-writer 8/8 (401/401/405/405/405/400/201/409); kopia OK 38 tabel / 362 wiersze / 27 934 B → daily/2026-09-26-234302/; RESTORE OK tabel=38 wierszy=362; strażnik 27 h → ALARM backup + e-mail do kolejki (wycofane) | Zasobnik tower-backup (weur), blokada daily/ 30 d, monthly/ 360 d; cykl życia 31/361 d. Worker tower-backup-writer: sekret x-backup-secret, if-none-match. Cron 30 0 * * * UTC. Poprawka: for-await na strumieniu COPY zawieszał Edge (546) na tabelach >16 kB → zdarzenia data/end. Katalog daily/2026-09-26/ niepełny (przerwany przebieg, zablokowany 30 d). Token R2 tylko do odczytu do testu odtworzenia: czeka na właściciela (OAuth nie tworzy tokenów); pobranie w teście przez wrangler. |
| PR1-PR8 | Worker podtrzymania na Cloudflare; Pages z integracją Git | DONE | babe741 | keep-alive ?check=1 → 200 ok, system_heartbeat beats=1 source=cf-worker; cron 0 */6 * * * | Worker tower-keep-alive.tower-hhl.workers.dev, sekrety: klucz anon, Resend, ALERT_EMAIL, MAIL_FROM (bez klucza serwisowego). Pages: czeka na autoryzację aplikacji GitHub Cloudflare przez właściciela (kroki w PRZELACZENIE_HOSTINGU.md); test przełączenia po pierwszym buildzie. 27.09 11:18: właściciel założył Pages tower-hhl.pages.dev z integracją Git (build zielony, tytuł „TOWER — Stegra Boden”, Preview branches = None) i dodał Redirect URL https://tower-hhl.pages.dev/** w Supabase. Test przełączenia (bez logowania, publiczne adresy, commit a60e98d): https://tower-hhl.pages.dev/ → 200, tytuł „TOWER — Stegra Boden”; build lokalny tego commitu (tylko VITE_SUPABASE_URL + klucz anon) vs Pages: 37/37 serwowanych plików identycznych bajtowo (index.html + assets; _headers Pages przetwarza, nie serwuje); /download/tower-makieta.html → 308 → /download/tower-makieta 200, Content-Disposition: attachment. Logowanie linkiem z nowego adresu nie testowane (wysłałoby e-mail z produkcji). Odczyt preview_deployment_setting i reguła files/ CZEKAJĄ: wrangler login (OAuth) wygasł po 120 s bez kliknięcia Allow w przeglądarce — potrzebne kliknięcie właściciela. 27.09 ok. 11:38 (logowanie właściciela, już wylogowane): API Pages tower-hhl: production_branch main, source.type github, preview_deployment_setting "none", production_deployments_enabled true, zmienne produkcyjne tylko NODE_VERSION, VITE_AUTH_MODE, VITE_SUPABASE_ANON_KEY, VITE_SUPABASE_URL (bez klucza serwisowego). wrangler logout: „Successfully logged out.”; whoami: „You are not authenticated. Please run `wrangler login`.” |
| PR2-B | Kopie: współbieżność, pliki, konta po odtworzeniu, procedura miesięczna | DONE | 5c62f6c | backup.sh 20/20, invite.sh 38/38, unit 353/28 skip; produkcja: 0044+0045 wdrożone, backup-export wdrożony, w wycofanej transakcji RUNNING→SKIPPED, restore_mark_relink()=0 | (1) KOPIE_ZAPASOWE.md: comiesięczny test = krótkie wrangler login → restore.sh (+restore-files.sh) → logout → dosłowny wynik whoami w raporcie; token R2 tylko do odczytu dopiero po uruchomieniu przekazywania sekretów. (3) Lokalny Supabase (Docker) + lokalny R2 (wrangler dev --local, ten sam Worker, test-writer 8/8): 2 pliki, 290 022 B, SHA-256 przed/po 2/2 zgodne, wgrane z powrotem 2/2; przebieg przyrostowy: 1 nowy, 2 pominięte. (4) restore.sh --into-public → account_relink_pending (konta_do_polaczenia=N); pierwsze logowanie linkiem łączy app_users po e-mailu (tylko adres z listy i osierocony wiersz), audit USER_RELINKED_AFTER_RESTORE; test GoTrue: 3 na liście → 1 połączony, widzi swoje dane, obcy adres odrzucony. restore.sh zamyka też przebieg RUNNING z kopii. (5) backup_run_begin(): pg_try_advisory_xact_lock + trwający przebieg → SKIPPED; 2 równoległe wywołania lokalnie: 1 OK + 1 SKIPPED. |
| PR2-B-R2LOCK | Blokada R2 dla prefiksu files/ (360 dni) | DONE | — | — | Do zrobienia przy najbliższym logowaniu do Cloudflare (test przełączenia hostingu): Worker przyjmuje files/, a blokady obejmują tylko daily/ i monthly/. Dodać regułę files/ 360 dni (wrangler r2 bucket lock add tower-backup …), potem wkleić dosłowną listę wrangler r2 bucket lock list tower-backup, logout + whoami. Teraz nie wykonywać. 27.09 11:19: próba logowania — wygasła bez zgody w przeglądarce; nadal OPEN, wykonać w tym samym logowaniu co test przełączenia. 27.09 ok. 11:38 (logowanie właściciela): dodana reguła tower-files-360d. Lista po zmianie: name: tower-daily-30d / enabled: Yes / prefix: daily/ / condition: after 30 days · name: tower-files-360d / enabled: Yes / prefix: files/ / condition: after 360 days · name: tower-monthly-360d / enabled: Yes / prefix: monthly/ / condition: after 360 days. Informacja: files/ nie ma reguły cyklu życia (pliki dokumentów zostają, blokada 360 dni) — bez zmian. |
| PR2-C | Konta po odtworzeniu: nieaktywne zostaje nieaktywne; lista ważna 30 dni | DONE | 74a7ca0 | invite.sh 48/48 (+10), gate OK, unit 353/28 skip; produkcja: 0046 wdrożona, cron tower-wygasanie-listy-kont 45 2 * * * aktywny, lista pusta (0) | (a) już w 0045 połączenie nie zmienia active — potwierdzone testem: lokalny Supabase/GoTrue, konto nieaktywne → sesja, ale projekty 0 / app_users 0 / loads 0. (b) 0045 nie miała wygasania → 0046: relink_valid_days()=30, wyzwalacz pomija starsze wpisy, expire_relink_pending() codziennie 02:45 UTC z audytem RELINK_PENDING_EXPIRED; lokalnie wpis 31-dniowy → logowanie odrzucone, usunięty 1. Opis w KOPIE_ZAPASOWE.md. |
| DOMENA-TOWER | Adres produkcyjny tower.log-mar.pl | PARTIAL | — | Vercel: domena dodana do watch-tower-makieta, verified true; CNAME tower → c8ddf203a73a39c2.vercel-dns-017.com.; Supabase Site URL https://tower.log-mar.pl + Redirect https://tower.log-mar.pl/** (PATCH 200, pages.dev zostaje); check-domain.sh przed CNAME: 1 OK / 7 FAIL (oczekiwane — łapie *.log-mar.pl CT8) | Czeka: właściciel dodaje CNAME w CT8 → po propagacji scripts/check-domain.sh (+ logowanie linkiem tylko na konto właściciela). UWAGA: produkcja Vercel = build demo sprzed 3 dni (makieta bez logowania) — do wdrożenia wersji produkcyjnej potrzebna osobna zgoda (O2). Procedura awarii Vercel → Pages w PRZELACZENIE_HOSTINGU.md. |
| DOMENA-TOWER-2 | CNAME tower.log-mar.pl | PARTIAL — propagacja DNS | — | 27.09 ok. 12:40: Google DNS zwraca CNAME `c8ddf203a73a39c2.vercel-dns-017.com.` → 216.198.79.1 / 64.29.17.1; certyfikat Let's Encrypt (YR2), CN/SAN tower.log-mar.pl, ważny 27.09–26.12.2026; `/` 200, `/tower-makieta.html` i `/download/tower-makieta.html` 404 (339 B); Cloudflare DNS jeszcze zwraca stary wpis `*.log-mar.pl` (CT8, 136.243.156.120, zły certyfikat), TTL 915 s | Rano CNAME czekał na właściciela; według właściciela jest już wpisany (27.09 przed 12:10). Do zrobienia po pełnej propagacji: `bash scripts/check-domain.sh` + logowanie linkiem na konto właściciela. Domena wskazuje wdrożenie produkcyjne O2 (ekran logowania). |
| AUDYT-STATUS | Statusy SCOPE 0–11, sekcja C audytu, B5, O3a/O3b | DONE (tylko dokumentacja) | (ten commit `docs(AUDYT-STATUS)`) | — (docs; produkcja tylko SELECT) | `AUDYT_ZAKRESU.md` dodany; SCOPE §0–11: 114 pozycji — GOTOWE 47 · częściowo 37 · nie zrobione 9 · zablokowane 10 · odłożone 7 · do potwierdzenia 4; dzienniki odłożeń (7) i blokad (8 wpisów); SCOPE §39: C1–C8, B5 (1 miejsce załadunku = strefa KSH Śrem, 0,33 m), etap I = B1–B7. Nic nie naprawiano |
| release-1.0 | Tag `release-1.0` na commicie działającym na produkcji | OPEN | — | — | **dopiero po etapie I z audytu (`AUDYT_ZAKRESU.md` sekcja B: B1–B7) i po O3b** (decyzja właściciela 27.09.2026; O2 i O3a DONE 27.09.2026) |

## Etap 4 — Fala 3B: pieniądze, faktury, zlecenia · **ZAMKNIĘTY (G4)**

| ID | pozycja | status | commit | testy (liczby) | uwagi |
|---|---|---|---|---|---|
| M2 | Dane v2: EUR, poziomy, migawki | **DONE** | `45e8d10` | unit **166 / 9 skip** (`tests/money-v2.test.ts` **9/9**) · db **52/44/33 + money 17/17** · hosted `scripts/money/verify.mjs` **15/15** · live provider **8/8** · pw **4/4** · d19 **0** · deur **0** · lint **0** | **App:** `src/lib/money/loadMoney.ts` — `LoadMoneyV2` na `pricing.money`: poziom (mniej pewna strona), **obie wartości** `computedEur` / `invoicedEur` (Z1: `applyInvoiceToSide` nie rusza wyliczenia, marża z fakturowanej, różnica `sideInvoiceDiffEur`), migawka mnożnika SEFS z datą (ta sama po obu stronach, `assertSameMechanism` w ścieżce), migawka kursu z numerem tabeli (reguła W3 na prawdziwych tabelach NBP 2026-08-03…09-25 w `src/data/nbpEurDemo.ts`; brak tabeli → najstarsza + prowizoryczny, nigdy cicho). `Load.unloadedAt` (W5). `STORE_SCHEMA_VERSION` **2**, migracja v1→v2 dokłada dane v2 bez utraty pól. Tryb Supabase: ceny z widoków v2 (`applyPriceViews`; strona niewidoczna = 0, marża tylko przy obu stronach). **Baza `0010_money_v2.sql` (hosted, historia 0001–0010):** widoki `v_load_*` z `security_invoker=false` + `security_barrier` i **jawnym filtrem** jak `cost_read`/`revenue_read` (naprawa G3: permission denied dla wszystkich); tabele `load_cost`/`load_revenue` nadal zamknięte; kolumny v2 (poziom, computed/invoiced/effective, fuel/fx); marża w EUR (Z3); wyzwalacz Z1 (wyliczenie po zafakturowaniu niezmienne). Nowy zestaw `tests/db/money.sh` w `gate.sh`. Wygląd bez zmian (dane v2 pokaże M8). |
| M3 | Kurs NBP na żywo + `fx_rates` | **DONE** | `ce3ff43` | unit **167 / 14 skip** (`tests/nbp-live.test.ts`: 1 + **5 z `NBP_LIVE=1`** zielone; `money.test.ts` z `NBP_LIVE=1` **50/50**) · db **52/44/33 + money 31/31** · hosted verify **23/23** · pw **4/4** · d19 **0** · deur **0** | **Baza `0011_fx_nbp.sql` (hosted, historia 0001–0011):** rozszerzenie `http` (w bazie, bez funkcji Edge i sekretów — API NBP publiczne) → `fx_sync_nbp(dzień)` pobiera **przedział [dzień − 14, dzień − 1]** (nigdy pojedynczy dzień; 404 = brak publikacji → 0), parser `fx_ingest_nbp(jsonb)` → `fx_rates` (upsert); pg_cron `tower-kurs-nbp` `30 10,14 * * *` UTC (po publikacji ~12:00 PL) + `fx_apply_pending()`. `fx_rate_before(dzień)` = reguła W3 (ostatnia tabela ŚCIŚLE przed dniem, w oknie 14 dni; brak → błąd). **Migawka przy rozładunku:** wyzwalacz na `loads.actual_delivery_at` → kurs + data opłaty paliwowej (dzień lokalny, Z2) na obu stronach, poziom REALIZACJA, tylko gdy strona niezafakturowana (Z1); brak tabeli → migawka prowizoryczna, uzupełniana po pobraniu; zmiana planu i nowe tabele nie ruszają migawki. `fx_rates`: odczyt dla zalogowanych, zapis tylko funkcje systemowe (bez EXECUTE dla ról API). Hosted: pobrano na żywo tabele 2025-12 i 2026-09 (17 wierszy, najnowsza 2026-09-25). App: `src/lib/money/nbpSync.ts` (przedział + migawka z żywego API). Test hosted zmienia i przywraca `actual_delivery_at`/`plan_delivery_from` fixture TEST-BK3-A (wpisy `LOAD_DELIVERY_DATE_CHANGE` w dzienniku audytu — dziennik jest tylko do dopisywania). |
| M4 | Ustawienia użytkownika (język/waluta/motyw) | **DONE** | `500e405` + `7bc89e0` (fix: opis waluty `data-deur-exempt`, pełny przegląd D-EUR-T KSH/SCX:PLN 0) | unit **167 / 15 skip** · D-EUR-T **2/2** (HHL EUR+PLN: 0; **KSH i SCX przez „Ustawienia”** EUR+PLN: 0 — w trybie PLN zakazane także `EUR`/€ poza wyjątkami) · live provider **9/9** (+ ustawienia) · hosted verify **33/33** (+10: `user_preferences` 3 konta) · pw **4/4** · d19 **0** · db **52/44/33 + money 31/31** | **Panel „Preferencje interfejsu”** wydzielony do `src/components/settings/UiPrefsPanel.tsx` i użyty ponownie: Opcje HHL (układ bez zmian) + **nowy widok „Ustawienia”** (`SettingsView`, `options-page`/`options-grid`, bez nowych komponentów) w nawigacji **KSH i SCX** (ikona zębatki jak Opcje). Język, waluta wyświetlania, motyw. **Zapis:** akcje store `setLocale`/`setDisplayCurrency`/`setTheme` → `writeThrough({type:"prefs.save"})` → `user_preferences` (upsert własnego wiersza, `current_app_user_id()`); przy logowaniu `loadPreferences()` → `applyUserPrefs` (bez ponownego zapisu). Demo: jak dotąd localStorage. Cennik w Opcjach oznaczony `data-deur-exempt="rate-card-source"` (źródłowy EUR — jak indeks paliwowy). Teksty PL/EN/SV w `src/i18n/etap4.ts`. **Zmiana wizualna:** nowa pozycja „Ustawienia” w nawigacji KSH/SCX → matryca wizualna do przeliczenia w G4. |
| M5 | Numery zleceń KSH/HHL/SCX w harmonogramie | **DONE** | `988da2d` | unit **186 / 15 skip** (+19 `tests/order-numbers.test.ts`) · live provider **10/10** (+M5) · hosted verify **44/44** (+11 M5) · db **52/44/33 + money 50/50** (+19 M5) · pw **4/4** · d19 **0** · D-EUR-T **2/2** · **etap4-ui 3/3** (nowy, w pre-push) | **Harmonogram:** kolumny `ord_ksh`/`ord_hhl`/`ord_scx` („Zlec. KSH/HHL/SCX”) zaraz za kodem wysyłki we wszystkich rolach (Q9); zapisane preferencje kolumn sprzed M5 dostają nowe kolumny za kodem; tabela przewija się w poziomie, ostatnia kolumna finansowa `.stick` (bez nowego wzorca); wyszukiwarka po numerach. **Szuflada (Przegląd):** trzy wiersze numerów — KSH tylko odczyt (import), HHL edytuje wyłącznie swój, SCX wyłącznie swój (pole `input` + „Zapisz” wzorem formularzy szuflady), pozostali widzą tekst / „nie uzupełniono”. Zapis `load.orderNo` → `hhl_order_no` / `carrier_order_no`. **Wymuszenie:** lustro `enforce_order_numbers()` w store (`orderNumberGate`) + błędy bazy tłumaczone `friendlyDbError` (PL/EN/SV: brak numeru HHL/przewoźnika, cudzy numer, okna planowe, data rozładunku zamrożona, status wstecz, duplikat) w komunikacie zapisu — „Nie można oznaczyć jako gotowy — brak numeru zlecenia HHL…”. **Brak przed terminem:** `0012_order_numbers.sql` (hosted, historia 0001–0012): `detect_missing_order_numbers()` (pg_cron `tower-numery-zlecen` co godzinę) — HHL przed GOTOWY, przewoźnik przed załadunkiem, od **48 h** przed planowym załadunkiem → ryzyko `RESOURCE_MISSING` (detail.rule=ORDER_NO, właściciel) + przypomnienie `notifications` IN_APP **wyłącznie** do strony, która ma wpisać numer; uzupełnienie numeru zamyka ryzyko (wyzwalacz). **`notifications` bez RLS od 0001 → włączone** (odczyt tylko własnych, zapis tylko funkcje systemowe). Demo: dane startowe z trzema numerami (D12, kokpit bez zmian do G4); usunięcie numeru w szufladzie tworzy ryzyko + przypomnienie. **AN2:** przewoźnik widzi okna planowe w „Awizacja / Prom” jako tekst (`data-plan-readonly`), zapis wysyła tylko „Potwierdzona”. **Parametr do potwierdzenia przez właściciela:** wyprzedzenie przypomnienia 48 h (`ORDER_NO_LEAD_H`, `p_lead_h`). **Znalezisko bezpieczeństwa (poza M5) → naprawione `7c027cf` fix(RLS), `0013_rls_gaps.sql` (hosted, historia 0001–0013):** `geofence_states`, `load_permits`, `schedule_imports`, `workflow_runs` były bez RLS i czytelne dla anon (hosted: HTTP 200) → RLS, anon bez dostępu, odczyt wg widoczności transportu / HHL, zapis HHL lub funkcje systemowe; db money 59/59 (+9), hosted verify 49/49 (+5). Otwarte (poza zakresem, do decyzji): `risk_signals` czytelne dla wszystkich zalogowanych (`risks_read using (true)` z 0001). · **AN1:** przewoźnik zmienia wyłącznie swój numer, HHL wyłącznie swój; **HHL nie może zmienić numeru zlecenia przewoźnika** (W12, wymusza baza — `guard_load_update`) · **AN2:** w szufladzie i formularzach przewoźnik **nie widzi pól okien planowych jako edytowalnych** (baza i tak odrzuci; interfejs nie może proponować zmiany) |
| M6 | Faktury — model 3 stron | **DONE** | `2b4ff4a` | unit **202 / 17 skip** (+16 `tests/invoices3.test.ts`) · live provider **11/11** (+M6: SCX rejestruje → HHL weryfikuje i „Opłacona”; HHL → KSH, SPORNA z uzasadnieniem) · hosted verify **76/76** (+27 M6, fixture TEST sprzątane) · db **52/44/33 + money 88/88** (+29 M6) · pw **4/4** · d19 **0** · D-EUR-T **2/2** (KSH ma teraz widok `inv`) · **etap4-ui 6/6** (+3 M6) | **Baza:** `0014_invoice_register.sql` + `0015_register_invoice_rule_fix.sql` (hosted, historia 0001–0015). `register_invoice(jsonb)` — wystawca rejestruje w jednej transakcji: nagłówek (netto/VAT/brutto **przepisane z dokumentu**, system nie liczy VAT), PDF wymagany (`create_document(null,INVOICE,…,projekt)` + Storage), pozycje z kursem per pozycja, kontrole liczone w bazie (NIEZREALIZOWANY, ZLY_TYDZIEN, KWOTA >1 i >0,2 %, TABELA_NBP/KURS_NBP/DATA_KURSU wobec migawki lub W3, BRAK_KURSU, OPLATA_PALIWOWA z aplikacji; nagłówek BRAK_NA_FAKTURZE + `missing_load_ids`), termin dokument > `payment_terms` > 30 dni (KSH) / 35 dni (HHL wobec SCX), Z1 (`invoiced_total_eur` obok wyliczenia, poziom FAKTURA), CMR/POD pozycji i FAKTURA_PDF w `invoice_documents`, Q13 powiadomienie KSH, dziennik audytu; podwójne fakturowanie → zrozumiały błąd. 0015: reguła kursu jako skalary (pierwsza pozycja bez migawki i rozładunku dawała błąd „record v_rule is not assigned yet” — wykryte testem live). Weryfikacja/płatność bez zmian z 0003 (odbiorca weryfikuje, SPORNA z uzasadnieniem, `mark/unmark_invoice_paid` wyłącznie HHL, cofnięcie z powodem). **Aplikacja:** `src/lib/invoices3.ts` (strony, widoczność W7, kontrole = lustro RPC, termin, stan płatności w obie strony, dane startowe 2+2), wycinek store `bills` (utrwalany) + akcje; SupabaseProvider czyta `invoices`+`invoice_lines` (kierunek ≠ null) i zapisuje przez RPC; po zapisie odświeżenie z serwera. **UI (wzorce makiety: panel/tablewrap/kv/mrow/pill/seg):** HHL — „Faktury kosztowe” (weryfikacja, „Opłacona” z datą, cofnięcie z powodem) i „Faktury przychodowe” z kreatorem jak u SCX (tydzień, transporty, EUR/PLN, kurs per pozycja z podpowiedzią W3 — potwierdź/popraw, netto/VAT/brutto, numer, daty, PDF, kontrole przed zapisem); SCX — rejestracja z wyborem waluty, lista ze statusem i terminem, **bez „Opłacona”**; KSH — nowy widok „Faktury” (nawigacja), **wyłącznie** faktury HHL→KSH, PDF + CMR + POD, kolumna „Wg cen KSH” (nigdy koszt), ZGODNA / SPORNA (z uzasadnieniem) / ZAAKCEPTOWANA, termin i status płatności. Kwoty w walucie faktury `data-deur-exempt="invoice-currency"`. Istniejący panel trójstronny HHL/SCX bez zmian. Demo: faktury v2 nie zmieniają poziomu/marży transportów ani kokpitu (do G4). · **AN1:** po umieszczeniu transportu na fakturze **data rozładunku zamrożona** dla wszystkich poza HHL (Z4) |
| M7 | Terminy i płatności + przypomnienia | **DONE** (e-mail: krok właściciela W-M7-1) | `c907fe9` | unit **208 / 17 skip** (+6 `tests/payment-reminders.test.ts`) · live provider **12/12** (+M7) · hosted verify **87/87** (+11 M7) · db **52/44/33 + money 104/104** (+16 M7) · pw **4/4** · d19 **0** · D-EUR-T **2/2** · etap4-ui **6/6** | **Baza:** `0016_payment_reminders.sql` (hosted, historia 0001–0016). `send_payment_reminders(dzień lokalny)` — zadanie systemowe (pg_cron `tower-przypomnienia` 00:15 UTC, po `tower-terminy`; użytkownik nie uruchomi — test), najpierw `refresh_payment_status` (w obie strony), potem kadencja **−3 / 0 / +1 / +7 / +14** (z `payment_terms` relacji, domyślnie ta) dla nieopłaconych faktur v2; odbiorcy **wyłącznie** aktywni użytkownicy płatnika (odbiorca faktury) i wierzyciela (wystawca) — KSH nigdy o fakturach SCX (test DB + hosted); dwa kanały: IN_APP (centrum powiadomień) i EMAIL (kolejka `notifications` PENDING), treść w języku odbiorcy (`app_users.locale`), kwota w walucie faktury; deduplikacja per faktura/dzień kadencji/użytkownik/kanał. **Opłacona → cisza:** wyzwalacz anuluje niewysłane e-maile przypomnień (CANCELLED), kolejne dni kadencji nic nie tworzą (test). „Opłacona”/cofnięcie — funkcje HHL z 0003 (data, powód, audyt). `notifications.read_at` + `mark_notifications_read(ids)` (tylko własne IN_APP). **Wysyłka e-mail:** `supabase/functions/send-notifications` (Resend, klucz idempotencji per wiersz, ponowne sprawdzenie statusu tuż przed wysyłką → opłacona nie wychodzi) + `supabase/functions/_shared/notifyTemplates.ts` — **jedno źródło treści** PL/EN/SV dla e-maila i aplikacji. **Aplikacja:** SupabaseProvider ładuje centrum powiadomień z serwera (IN_APP, RLS własne), przeczytanie zapisywane; szczegóły faktury pokazują plan przypomnień (wysłane / zaplanowane / wstrzymane — opłacona) i adresatów (płatnik, wierzyciel). Demo: bez nowych powiadomień startowych (kokpit bez zmian do G4). **Luka:** brak tokenu Management API → funkcji nie da się wdrożyć z boxa (krok właściciela **W-M7-1**); do tego czasu e-maile czekają w kolejce (PENDING), kanał w aplikacji działa. Drobna luka: odrzucona przez bazę rejestracja faktury (wyścig) zostawia niewidoczny dla innych plik PDF (brak polityki usuwania w Storage) — kontrole w aplikacji wyprzedzają RPC. |
| M8 | Niezmiennik / poziomy w wycenie | DONE | 19a8f14 | unit 216/18 skip (+money-m8 8) · pw 4/4 · d19 0 · deur 2/2 · etap4 7/7 · db bez zmian (52/44/33 + money 104) | assertSameMechanism przy każdym wyliczeniu (withMoneyV2: seed/migracja/import) — rozjazd przerywa wyliczenie → moneyError na liście wyjątków, nie zero; mechanismIssue na migawkach z bazy (applyPriceViews); szuflada Ceny: poziom, mnożnik z datą, tabela NBP, pill kursu tymczasowego, notka rozjazdu; Finanse: zestawienie poziomów per rola + pill na liście poniżej progu; **decyzja: oznaczenie poziomu w kokpicie odłożone do G4** (reguła baseline — kokpit w migawkach wizualnych); obserwacja: w demo wszystkie 72 transporty mają kurs tymczasowy (daty odniesienia po ostatniej tabeli demo NBP) |
| M9 | Aplikacja kierowcy: watchPosition + zgoda | DONE | 3f73c7a | unit 224/18 skip (+driver-tracking 8) · pw 4/4 · d19 0 · deur 2/2 · etap4 8/8 · db 52/44/33 + money 116 (+[M9] 12) · hosted verify 95/95 · live 12/12 | 0017 na hosted: report_position() (przewoźnik transportu/HHL, DRIVER_PWA, fix >250 m bez stref, czas z przyszłości odrzucony) → process_position(); **usterka bezpieczeństwa naprawiona:** process_position (security definer) miał EXECUTE dla PUBLIC/anon/authenticated — każdy, także niezalogowany, mógł przesuwać transporty pozycjami i wyzwalać automat statusów; teraz tylko service_role; MILESTONE_LOADED zapisuje wyłącznie przewoźnik transportu albo HHL; **współrzędne terminali zweryfikowane z mapą** (OSM/Nominatim, ferryguide, Sjöfartsverket): Gdańsk Westerplatte 54.40372, 18.68130 (~100 m korekty), Nynäshamn Färjeterminal 58.90453, 17.95621 (było ~3,4 km na północ — strefa 800 m nie zadziałałaby), strefa załadunku KSH Śrem z ADDRESSES.md; aplikacja: zgoda przy pierwszym uruchomieniu w języku telefonu, watchPosition (próg 60 s / 150 m), bez zgody tylko przyciski etapów; Załadowany → MILESTONE_LOADED, Rozładowany → UNLOADED razem z datą (także z szuflady — wcześniej baza odrzucała), PROM tylko automat; zdjęcia do Storage — ścieżka BK4 bez zmian; luka: brak osobnego logowania kierowcy (aplikacja działa w sesji przewoźnika) — decyzja właściciela przy wdrożeniu · **AN1:** zdarzenia wg `STATUSY_AUTOMATYCZNE.md` §6 — „Załadowany” → `MILESTONE_LOADED`; „Rozładowany” → UNLOADED **razem z datą rozładunku** (baza odrzuca UNLOADED bez daty); pozycje przez `process_position()`; strefy załadunku z `docs/watch-tower/ADDRESSES.md` (współrzędne terminali zweryfikować z mapą) |
| M10 | Rejsy i automat statusów w aplikacji (po M6) | DONE | 1310492 | unit 234/19 skip (+sailings 10) · pw 4/4 · d19 0 · deur 2/2 · etap4 9/9 · db 52/44/33 + money 116 · hosted verify 95/95 · live 13/13 (+M10 ścieżka) | rozkład rejsów w Harmonogramie (zakładka Rejsy: HHL dodaje/opóźnia/odwołuje, odwołanie → ryzyka transportów na tym rejsie; wszyscy widzą); w szufladzie formularz Rejs (wybór rejsu + numer rezerwacji) zamiast wolnego tekstu promu — SCX do wypłynięcia, potem tylko HHL (blokada także w bazie, komunikat zrozumiały); oś czasu: STATUS_AUTO jako „Zmiana automatyczna” (z → do · powód); **kryterium na hosted:** scripts/ferry/path-scenario.sql prowadzi stały fixture TEST-M10 (przewoźnik SCX, M/F Wawel) pozycjami przez process_position() i promote_ferry_departures(): AT_PORT_GDANSK → FERRY → AT_PORT_NYNASHAMN → IN_TRANSIT_SE → AT_SITE; test live sprawdza status, rejs i 5× STATUS_AUTO z powodem na kontach HHL/KSH/SCX oraz odrzucenie zmiany rejsu przez SCX po wypłynięciu; fixture zostaje (zdarzenia append-only); źródło statusów Polferries — decyzja właściciela (do tego czasu ręcznie) · AN1: HHL zarządza rozkładem (dodanie, opóźnienie, odwołanie; źródło Polferries = decyzja właściciela, do tego czasu ręcznie); przypisanie rejsu w szufladzie (HHL + przewoźnik; po wypłynięciu tylko HHL); oś zdarzeń z `STATUS_AUTO` i powodem; ryzyka AUTO_STATUS / LOADING_UNCONFIRMED / rejs przegapiony / odwołany / PROM po czasie (PL/EN/SV); zrozumiałe błędy bazy. Kryterium: ścieżka transportu port → PROM → plac na 3 kontach testowych · **AN2:** w szufladzie i formularzach przewoźnik **nie widzi pól okien planowych jako edytowalnych** (baza i tak odrzuci; interfejs nie może proponować zmiany) |
| M11 | Rozbicie marży w Finansach (po M2) | DONE | fd94928 | unit 239/19 skip (+money-m11 5) · pw 4/4 · d19 0 · deur 2/2 · etap4 10/10 · db 52/44/33 + money 116 | w bloku „Od przychodu do marży” (HHL) trzy wiersze .mrow z pigułką poziomu i liczbą transportów: zafakturowana / zrealizowana niezafakturowana / prognozowana + wiersz „Marża łączna · wszystkie transporty”; sumy z totalsByTier (silnik) na marżach v2 z wartości efektywnych (faktura nadrzędna); waluta z ustawień użytkownika — EUR źródłowo, PLN per transport każda strona swoim kursem NBP (nie kursem demo), zaokrąglenie per transport; transporty z przerwanym wyliczeniem (moneyError) poza sumą z licznikiem; kryterium: test jednostkowy suma 3 = łączna (EUR i PLN, 72 transporty demo) + test UI; KSH/SCX bez bloku marży; uwaga: górny wiersz „Marża” (tylko dostarczone, kurs demo) zostaje bez zmian · AN1 (rozbicie zatwierdzone): 3 wiersze `.mrow` w „Od przychodu do marży” — zafakturowana / zrealizowana niezafakturowana / prognozowana; sumy z `totalsByTier` w walucie użytkownika. Kryterium: suma 3 = marża łączna, test jednostkowy |
| M12 | Integracje danych zewnętrznych (po M10) | DONE | 380e0ac | unit 260/20 skip (+integrations 21; ferry 17/17) · pw 4/4 · d19 0 · deur 2/2 · etap4 10/10 · db 52/44/33 + money 130 (+[M12] 14) · hosted verify 95/95 · live 14/14 | **0018 na hosted** (raise_integration_risk + latest_vehicle_positions tylko service_role; dziennik integration_runs — odczyt HHL; wyzwalacz: każdy zapis rejsu przez użytkownika = źródło RECZNIE, więc pierwszeństwo RECZNIE > POLFERRIES > DANE_STARTOWE egzekwuje baza); sześć funkcji Edge na wspólnym rdzeniu supabase/functions/_shared (te same parsery co w aplikacji): ferry-schedule (nowy parser rozkładu cargo), ferry-status (komunikaty; NIEZNANY → rejs bez zmiany + ryzyko MEDIUM), ferry-ais (Digitraffic, tylko strona szwedzka, informacja z atrybucją CC BY 4.0), road-se (Trafikverket E4, bufor 5 km), road-pl (KPD DATEX II), traffic-flow (TomTom przy autach); awaria źródła / zmiana struktury → ryzyko „Źródło niedostępne” (zamykane po udanym odczycie), nigdy cicha pustka; limit częstotliwości z dziennika (ferry-status co 15 min, nie częściej); bez klucza tryb DEMO bez pobierania (panel SE zostaje oznaczony D3/D18). **Kryterium:** scripts/ferry/run-job.ts (ten sam kod co funkcja) na prawdziwych stronach Polferries → hosted: ferry-schedule 147 rejsów (26.09.2026–04.01.2027, oba kierunki), ferry-status 10 rejsów uzgodnionych z komunikatami (0 zmian — wszystkie „Planowo”); pierwszy przebieg ferry-status padł na nagłówku User-Agent z długą kreską (nie-ASCII) → poprawnie powstało ryzyko SOURCE_DOWN, zamknięte automatycznie po udanym odczycie (dziennik zachowany, test pilnuje ASCII); test offline każdej funkcji (Polferries — prawdziwe strony z 26.09; Trafikverket/TomTom/DATEX II — przykłady w formacie z dokumentacji, bo brak kluczy); poprawka: Digitraffic interpretFix używał starego punktu terminalu Nynäshamn (~3,4 km obok) → zweryfikowane współrzędne z M9 (punkt testowy w ferry.test.ts przesunięty, dalej 17/17); UI: kolumna Źródło w rozkładzie + atrybucja Polferries; ręczne opóźnienie/odwołanie w demo też oznacza RECZNIE; **krok właściciela W-M12-1:** wdrożenie funkcji + pg_net + Vault + harmonogram (scripts/ferry/cron-edge.sql); klucze Trafikverket/TomTom, rejestracja KPD, zgoda Polferries i MMSI Wawel — ZRODLA_DANYCH §3 · AN2, wg `ZRODLA_DANYCH.md`; funkcje Edge z pg_cron: `ferry-schedule` (rozkład cargo → `sailings`, co tydzień + ręcznie HHL), `ferry-status` (`parsePolferriesStatus`, **co 15 min, nie częściej**), `ferry-ais` (`fetchVesselFix`, co 10 min, rejsy w toku), `road-se` (Trafikverket, klucz), `road-pl` (KPD GDDKiA DATEX II, rejestracja + certyfikat), `traffic-flow` (TomTom, klucz). Zasady: pierwszeństwo `RECZNIE` > `POLFERRIES` > `DANE_STARTOWE`; NIEZNANY → bez zmiany rejsu, ryzyko HHL; awaria źródła → ryzyko „źródło niedostępne”, nigdy cicha pustka; ryzyka drogowe w `ROAD_SE`/`ROAD_PL`; atrybucje (Digitraffic CC BY 4.0 obowiązkowo); bez klucza panel = dane demonstracyjne (D18); klucze tylko w sekretach funkcji. Kryterium: `ferry-status` zapisuje rejsy z prawdziwej strony do bazy testowej; test jednostkowy każdej funkcji na zapisanych danych, bez sieci |
| D26 | Import — usunięcia za zgodą | DONE | dc364d7 | unit 264/20 skip (+schedule-import D26 4 → 12) · etap4 11/11 (+D26) · pw 4/4 · d19 0 · deur 2/2 · db 52/44/33 + money 130 | podgląd importu pokazuje pozycje nieobecne w pliku jako kandydatów: pole „Usuń N pozycji nieobecnych w pliku” (label.switchline, domyślnie odznaczone, reset przy każdym pliku) + lista kodów + opis skutku; licznik „−” pokazuje wyłącznie usunięcia, które zostaną wykonane (−0 bez zgody; wcześniej dry-run zawsze −0, a ścieżka usuwania była nieosiągalna z UI); zatwierdzenie przekazuje allowRemovals i dokładnie kandydatów z podglądu; pusty/nieczytelny plik → 0 kandydatów (ochrona P9 72→1); import tylko w trybie demo (bez zapisu do bazy — bez zmian); **obserwacja dla właściciela:** usunięcie obejmuje każdy status (także w drodze/dostarczone) — ewentualne ograniczenie do niezrealizowanych = decyzja właściciela |
| D23-S | Import test na skali ~72 wierszy | DONE | 4c52455 | unit 268/20 skip (schedule-import 16: D23 8 + D26 4 + D23-S 4) · etap4 11/11 · pw 4/4 · d19 0 · deur 2/2 · db 52/44/33 + money 130 | wariant testu importu na realnej skali w tests/schedule-import.test.ts: 72 transporty demo (buildDemoSnapshot — loads.json ma 62 + seed), pliki XLSX budowane z tych samych danych: identyczny harmonogram 72 wierszy → 0 dodanych / 0 zmian / 0 kandydatów (round-trip bez fałszywych zmian); 75 wierszy (72 + 2 nowe + 1 błędny, 3 zmiany dat) → +2 ~3 odrzucony 1, 74 transporty, wersja harmonogramu z licznikami; 71 z 72 → 1 kandydat, bez zgody 72, ze zgodą 71 (znika wyłącznie ten jeden); 72 błędne → baza nietknięta i 0 kandydatów nawet przy wymuszonym allowRemovals (P9 72→1) |
| G4 | Brama etapu 4 + baseline Fala 3b | **DONE** | 3153a78 | unit **271 / 20 skip** (+money-g4 3) · money (db) **130/130** · db **security 52/52 · status 44/44 · storage 33/33** · ferry **17/17** · pw visual **4/4** · etap4 **12/12** · D19-T **0** · D-EUR-T **2/2 (0)** · BK5 live **8/8** · stylelint **0** · hosted verify **95/95** · live provider **14/14** · matryca **840/840 OK** (720 → 840: +30 Faktury KSH, +30 faktury przychodowe HHL, +60 Ustawienia KSH/SCX) · wzorzec **471 zmienionych / 720** + 120 nowych · PLN kontrolny **6/6** | **Kokpit (odłożone z M8):** pill poziomu pewności (najmniej pewny składnik, `aggregateTier`) + pill kursu tymczasowego z liczbą pod kwotą — marża narastająca HHL, tydzień SCX (KSH bez kwot w kokpicie); wzorce pill/kpi, bez nowych. **Matryca:** `scripts/baseline.mjs` SCRIPT_VERSION `2026-09-26-g4-fala3b-views`, build demo z HEAD (:4181), 840/840 bez FAIL. **Wzorzec zregenerowany** — uzasadnienie widok·rola w `docs/handover/G4_WZORZEC.md`: nawigacja KSH (Faktury M6, Ustawienia M4) 135, nawigacja SCX (Ustawienia) 72, harmonogram M5/M10 90, faktury M7 60, finanse M8/M11 30, rozliczenia/moje-stawki M8 51, kokpit G4 60 — wszystkie 471 przypisane; widoki tylko-HHL poza tymi czterema 0 zmian. Migawki smoke: tylko `kokpit-hhl-pl-1920-*` (ta sama przyczyna), mapa bez zmian. **Zestaw PLN:** `SET=pln` → `shots-baseline-pln/` (kokpit + harmonogram × 3 role × 1440 × motyw domyślny, waluta PLN przez Opcje/Ustawienia). Tag `baseline-fala-3b-2026-09-26`. **Obserwacja (D19, bez zmian):** etykieta motywu ciemnego to „Ciemny · HHL” także w roli SCX. `pngjs`/`pixelmatch` — porównanie kopią skryptu z pakietami w /tmp (jak G3). · **AN1:** `tests/db/run.sh` **security 50/50 + status 44/44** · **AN2:** **security 52/52 + status 44/44 + `tests/ferry.test.ts` 17/17** |

## Etap 5 — Fala 4: infrastruktura · **ZAMKNIĘTY (G5)**

| ID | pozycja | status | commit | testy (liczby) | uwagi |
|---|---|---|---|---|---|
| D14 | Trasy adresowalne | **DONE** | f384740 | unit **275 / 20 skip** (+routes 4) · etap5 **4/4** (nowy `npm run test:etap5`, w fresh-smoke) · etap4 **12/12** · pw visual **4/4** · d19 **0** · deur **2/2** · wygląd bez zmian (migawki smoke identyczne) | `src/lib/routes.ts` (mapa widok ↔ ścieżka: /kokpit /mapa /harmonogram /ryzyka /dokumenty /finanse /faktury /zadania /automatyzacje /strefy /opcje /ustawienia + /transport/<kod>) i `src/hooks/useRouteSync.ts` w TowerShell: URL → sklep przy zmianie ścieżki (widok, jeśli rola go ma; szuflada po kodzie; link sprzed wczytania danych Supabase czeka na transporty), sklep → URL z wpisem historii (wstecz zamyka szufladę), query `?now=` zachowane; ścieżka spoza roli / nieznany kod → zastąpione dozwolonym widokiem; nieznane ścieżki (fragment powrotu z logowania) nieprzepisywane. **HashRouter zostaje** (adresy `#/harmonogram`, `#/transport/SG-32`): hosting statyczny bez przepisań, linki kierowcy `#/driver/<token>`, kontrakt `#/…?now=` baseline/testów. Rola i język już w trwałym ustawieniu (persist demo; Supabase: rola z konta, język `user_preferences` M4) — potwierdzone testem przeładowania. Luka: link magiczny logowania wraca na `origin+pathname` (bez ścieżki hash) — głęboki link przetrwa logowanie hasłem, nie linkiem e-mail. |
| D15 | Podział paczki / lazy mapa &lt;400 kB | **DONE** | ecb0632 | unit **275 / 20 skip** · etap5 **5/5** (+D15 1) · etap4 **12/12** · pw visual **4/4** · d19 **0** · deur **2/2** · kontrola matrycy 1440 (168 ujęć) **168/168 identycznych** z `baseline-fala-3b` · rozmiar: pierwsze wczytanie **2229,2 → 899,6 kB** surowo · **584,5 → 221,6 kB gzip** (cel < 400 kB ✓) | **Rozmiar przed / po** (`node scripts/bundle-size.mjs <dist>`: index.html + skrypty/modulepreload/CSS z index.html; gzip -9): przed (`f384740`) jeden kawałek `index` 2176,5 kB / 569,9 kB gz + CSS 51,9 / 14,2; po: `index` 845,2 / 206,1 gz + runtime 1,4 / 0,8 + CSS 51,9 / 14,2. Leniwe: ExcelJS 934,5 / 253,9 gz (eksport/import), mapa `CorridorMap`+Leaflet 160,7 / 45,3, import harmonogramu (zod) 100,6 / 27,4, JSZip 94,5 / 27,7, eksport 3,0 / 1,5. **Cel „poniżej 400 kB” liczony jako transfer (gzip)** — surowo 900 kB (sam react-dom + router ≈ 300 kB min.); budżet 400 kB gzip sprawdzany w `scripts/ci/fresh-smoke.sh` (pre-push, kod 6 przy przekroczeniu), `npm run size` dla `dist/`. Mapa: `LazyCorridorMap` (Suspense, zastępnik w tym samym miejscu — bez przesunięć). **Kontrola wizualna wykryła dwie niedeterministyczności**, naprawione w tym commicie: (1) przewinięcie widoku przechodziło do następnego (`main` wspólny) — teraz nowy widok startuje od góry; (2) dryf pozycji ciężarówek co 1,5 s zależał od chwili zamontowania mapy — przy zamrożonym czasie (`?now=`) wyłączony. Po poprawkach 168/168 identycznych. |
| G5 | Brama etapu 5 | **DONE** | (ten commit `docs(G5)`) | unit **275 / 20 skip** · money (db) **130/130** · db **52/44/33** · ferry **17/17** · pw visual **4/4** · etap4 **12/12** · etap5 **5/5** · D19-T **0** · D-EUR-T **2/2** · stylelint **0** · pełna matryca **840/840 identycznych** z `baseline-fala-3b-2026-09-26` (0 zmian) · rozmiar pierwszego wczytania demo **221,6 kB gzip** / 899,6 surowo (Supabase: 224,2 / 905,0) — budżet 400 kB gzip ✓ | **Brama spełniona:** testy zielone (pre-push `5767156`: unit, fresh-smoke z budżetem rozmiaru + visual/d19/deur/etap4/etap5, lint:css, gate.sh 52/44/33 + money 130). **Raport rozmiaru paczki:** przed D15 2229,2 kB / 584,5 kB gz → po 899,6 / 221,6 kB gz (szczegóły w wierszu D15; `node scripts/bundle-size.mjs <dist>`). Matryca na świeżym buildzie demo z HEAD (:4181): 840 ujęć, 0 FAIL; porównanie repo-skryptem `scripts/compare-baseline.mjs` (pngjs/pixelmatch z package.json) progi 0.28/60 px/0.001: **0 zmienionych** → wzorzec **nie** regenerowany (brak uzasadnienia), tag bez zmian. |

## Etap 6 — odbiór końcowy

| ID | pozycja | status | commit | testy (liczby) | uwagi |
|---|---|---|---|---|---|
| O1 | Pełny komplet testów + D24 ×14 | **DONE** | 1742b03 | unit **275 / 20 skip** · money (unit) **49 + 1 skip** (`NBP_LIVE=1` **50/50**, nbp-live **6/6**) · `tests/db` **security 52/52 · status 44/44 · storage 33/33 · money 130/130** · ferry **17/17** · Playwright: visual **4/4** · etap4 **12/12** · etap5 **5/5** · etap6 **1/1** · D19-T **0** trafień · D-EUR-T **2/2** (0) · BK5 live **8/8** · stylelint **0** · matryca **840/840** identycznych (G5; dawniej 720) · **D24 14/14 SHIP** na paczce produkcyjnej · hosted: money verify **95/95**, live provider **14/14**, BK2 verify **21/21**, BK4 verify **27/27** | **D24 (O1):** `docs/qa-start/D24_O1.md` — build produkcyjny demo z HEAD `5767156` (:4181), `appChecksum` sha256 JS `5e4f847b578e777e25cf60b1d1b92b53a6177d834a9448887291d128c7262b17` (`index-7A_5LP4I.js`), CSS `755b5ef0…2143`. Pierwszy przebieg 12/14 — oba FAIL to nieaktualna sonda, nie regresja: #2 szukał „Ustaw READY” (od D11 „Oznacz jako gotowy”), #13 dopasowywał etykietę i kwotę w jednej linii (po M8/M11 osobne komórki; w Fali 0 rozstrzygał reprobe) — sonda strukturalna: kolumny tabel + komunikaty blokady ról. Produkt bez zmian. Build Supabase (BK5 UI, :4178) pierwsze wczytanie 224,2 kB gz. **Znalezisko:** ~25 napisów PL w `src/i18n/d19Extra.ts` bez polskich znaków (np. „Przychod”, „Marza”, „Zalaczniki CMR / POD”, „Pobierz paczke tygodnia”) — zapisane jako otwarte **D19-PL** (poprawka zmienia wzorzec wizualny → następny etap wyglądu). |
| O2 | Deploy produkcyjny Vercel + Supabase | **DONE** 27.09.2026 (zgoda właściciela) | `70e7ae3`, `d936814` | makieta z paczki produkcyjnej: `tests/o2-prod-strip.test.ts` 3/3, `hosting-switch` 5/5, pre-push OK (baza: security 83, release 145, backup 20, invite 48 …); Vercel: 18/18 plików `dist/` identycznych z buildem lokalnym `d936814`; zrzut ekranu logowania `/workspace/o2/login.png` | **Przed:** Pages i Vercel (makieta) serwowały bez logowania `/download/tower-makieta.html` (308 → 200, 92 717 B, załącznik), `/tower-makieta.html`, `/claude-makieta.html`, `/claude-ref.html`, `/claude-v2-ref.html`, `/KSH_HARMONOGRAM.xlsx`. **Zmiana:** `build/prodStrip.ts` (wtyczka Vite) — przy `VITE_AUTH_MODE=supabase` usuwa te pliki i `/download/` z `dist/`, blok `/download/*` z `_headers`, dodaje `404.html` (Pages zwraca 404 zamiast `index.html`); tryb demo bez zmian; `vercel.json` bez nagłówków (Vercel doklejał `Content-Disposition: attachment` do 404). **Vercel:** projekt `watch-tower-makieta` — framework vite, `npm ci`, `npm run build`, `dist`, Node 22.x; zmienne Production: `NODE_VERSION`, `VITE_AUTH_MODE`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (nic więcej, bez klucza serwisowego); `vercel --prod` z `git archive d936814` → https://watch-tower-makieta-51yg7bwxc-sebastianbozekq-7781s-projects.vercel.app, aliasy watch-tower-makieta.vercel.app i tower.log-mar.pl. **Po wdrożeniu:** ekran logowania („Wyślij link do logowania”), 0 słów z makiety, pakiet JS z adresem Supabase i fragmentem `AuthGate`, 0 × service_role; `/tower-makieta.html` i `/download/tower-makieta.html` → 404, 339 B, bez załącznika na Vercel, tower.log-mar.pl i Pages. **Stare wdrożenia:** ochrona Vercel Authentication (`ssoProtection: all_except_custom_domains`) była już włączona — 10 wdrożeń (7 z makietą + 2 pośrednie + bieżące), wszystkie adresy wdrożeń → 302 do logowania Vercel, usunięto 0. **Trenowanie modeli:** zespół Hobby miał `dataSharingConsent: granted` (przez ToS); API odrzuca zmianę → **krok właściciela:** Vercel → Team Settings → Data Preferences → Opt-out. **Pozostałość:** CDN Pages trzyma w pamięci podręcznej (s-maxage 7 dni, stan sprzed wdrożenia) adresy bez `.html`: `/tower-makieta`, `/download/tower-makieta`, `/claude-*`, `/KSH_HARMONOGRAM.xlsx` — czyszczenie wymaga panelu Cloudflare (bez logowania wykonawcy). |
| O3 | Test dymny na produkcji | **PODZIELONE 27.09.2026 → O3a + O3b** (zależy od O2) | — | przedprodukcyjnie na hostowanym Supabase: BK5 **8/8** (3 konta, widoczność faktur w API i w ruchu sieciowym UI) · live provider **14/14** · BK2 **21/21** · BK4 **27/27** · M10 ścieżka TEST-M10 (GDANSK → PROM → NYNASHAMN → SE → AT_SITE) w live provider | Test dymny **na produkcji** niemożliwy bez O2. Zakres O3 pokryty dziś na hostowanym Supabase (nie produkcja): logowanie trzech kont (BK2/BK5), widoczność faktur KSH/SCX/HHL (BK5), transport przez automat statusów do AT_SITE (M10, TEST-M10); rozładunek ręczny HHL (nigdy automatycznie). **Import** sprawdzony tylko na DemoProvider (D23-S 72 wiersze, D26, D24 #3) — na hostowanym Supabase ścieżka import → rozładunek **nie** była testowana end-to-end (do zrobienia w O3 po O2). **Po O2:** powtórzyć `SUPABASE_LIVE=1 npx playwright test tests/bk5-api.live.spec.ts` z `BK5_BASE=<adres produkcji>` + ręczny import → rozładunek na jednym transporcie testowym. |
| O3a | Logowanie trzech ról (HHL, KSH, SCX) na produkcji | **DONE** 27.09.2026 | (docs) | 3/3 logowania linkiem z Admin API (`generate_link` typ invite, bez e-maila) na https://watch-tower-makieta.vercel.app: sesja + `my_profile`: HHL_OPS/HHL, CLIENT_USER/KSH, CARRIER_DISPATCH/SCX; zrzuty `/workspace/o2/o3a-{hhl,ksh,scx}.png`. Widoczność (transakcja wycofana, `SET LOCAL role authenticated` + `request.jwt.claims`): projekty/ładunki/faktury — HHL_ADMIN 1/0/0, HHL_OPS 1/0/0, CLIENT_USER 1/0/0, CARRIER_DISPATCH 1/0/0 (całość w bazie 1/0/0) | Konta `sebastian+tower-o3-{hhl,ksh,scx}@log-mar.pl` z `admin_invite_user` (jako HHL_ADMIN). Po teście: `admin_set_user_active(false)` ×3 → aktywne 0/3; `auth.sessions` 3 → 0, `auth.refresh_tokens` 3 → 0. Audyt zostaje: USER_INVITED 3, USER_ACCEPTED_INVITE 3, USER_ACTIVE_SET 3. Zero transportów i innych danych biznesowych. Uwagi z UI: przełącznik „Widok HHL/KSH/SCX” widoczny dla ról KSH i SCX; na kokpicie KSH stały baner „Dostawa 26.09 o 11:30 … Transport R-03 …” i oś „dziś 23.09” — wygląda na tekst demonstracyjny (do sprawdzenia w etapie I). |
| O3b | Pełny transport na produkcji = pierwszy prawdziwy transport w pilotażu | OPEN — pilotaż | — | — | wydzielone z O3 (27.09.2026). Uwaga z audytu statusów: SupabaseProvider nie zapisuje nowych/zmienionych transportów z importu (brak insert do `loads`) — bez tego O3b nie przejdzie |
| I-0 | Etap I — wyciek plików (KSH_HARMONOGRAM.xlsx, 4 kopie makiety) i danych demo w pakiecie JS | PARTIAL — pakiet, pliki i wdrożenia DONE (Vercel 1, Pages 1); zostaje tylko cache CDN `tower-hhl.pages.dev` (6 ścieżek, wygasa ok. 04.10.2026) | `45bc74b`, `1b2e2e9`, `e6c064d` | Vercel: wdrożeń 10 → 3 (usunięte 7 z 23.09 13:20 – 24.09 00:43), stare adresy 404 `DEPLOYMENT_NOT_FOUND`; po wdrożeniu `e6c064d` są 4 (3 starsze z danymi demo w JS, chronione Vercel Authentication — 302). Pages (wrangler, 27.09 16:35–16:45): wdrożeń 10 (wszystkie production, 0 preview) → 1; usunięte 9 (395247e … 5629129). 7 z 9 starych adresów `<hash>.tower-hhl.pages.dev` daje 404; **d365b18e i ee5232f7 nadal 200** (makieta, xlsx) 20 min po usunięciu — do sprawdzenia w panelu. Nowe wdrożenia po usunięciu: 42201899 (1b2e2e9), 079ef8d3 (e6c064d, bieżące); 753d28b2 (45bc74b) zostało — 42201899 i 753d28b2 mają dane demo w JS. Strażnik `tests/i0-prod-guard.test.ts` **zielony** 4/4: w dist 0 plików *.xlsx, *makieta*, claude-*; 0 identyfikatorów demo (72 sprawdzane), 0 „23.09”, 0 „R-03”, 0 numerów +48/+46; parytet eksportów *.prod.ts. Na żywo (tower.log-mar.pl, Vercel, Pages, 13 plików JS): 0 / 0 / 0 / 0; ekran logowania na tower.log-mar.pl i Vercel (`/workspace/i0/login-*.png`). Pre-push: unit 360, wizualne demo bez regeneracji wzorców zielone | **Pierwsze wdrożenie z plikami:** Vercel 23.09.2026 13:20 (claude-ref.html, claude-v2-ref.html, KSH_HARMONOGRAM.xlsx; publiczne na watch-tower-makieta.vercel.app do 27.09 12:11); Pages 27.09.2026 11:06:44 (395247e, wszystkie 6 plików; `.html` 404 od 12:16:19, 70e7ae3). **Cache Pages:** `/tower-makieta`, `/download/tower-makieta`, `/claude-makieta`, `/claude-ref`, `/claude-v2-ref`, `/KSH_HARMONOGRAM.xlsx` → 200 z `cf-cache-status: HIT` (zapisane ok. 11:32, s-maxage 7 dni → wygasa ok. 04.10.2026 11:32); API Cloudflare nie ma czyszczenia cache dla pages.dev (token wranglera bez uprawnień do cache), `_redirects` na Pages nie obsługuje 404; dodane `Cache-Control: no-store` w `_headers` (nagłówek widoczny w odpowiedzi, treść nadal z cache). **Analityka/logi:** Pages — brak Web Analytics (brak skryptu beacon), brak Functions (tail nie dotyczy), GraphQL Analytics niedostępne bez osobnego tokenu; Vercel — 0 wpisów logów, brak Web Analytics. Brak logów pobrań. KSH_HARMONOGRAM.xlsx: 1 arkusz, 123 wiersze danych, 16 kolumn; „Imię i nazwisko kierowcy”, „Nr tel. kierowcy” puste. **B (dane demo poza pakietem):** wtyczka Vite `i0-demo-swap` podmienia `src/data/seed.ts`, `src/data/demoProvider.ts`, `src/i18n/demoOnly.ts` na `*.prod.ts`; logika `applyForceMajeureDelays`/`buildSeedExceptions` w `src/lib/seedLogic.ts`. W produkcji puste: tabele stawek (Opcje → stawki COST/REVENUE), parametry BAF (fasada F2.4), demonstracyjne tokeny linków kierowcy; ukryte: banery KSH/SCX; „dziś” na wykresie = bieżąca data. Dane transportów w produkcji jak dotąd z Supabase (store startował pusty już od BK3). wrangler: logout, whoami „You are not authenticated. Please run `wrangler login`.” **Domknięcie 27.09.2026 ok. 17:58:** Pages — wdrożeń 4 → 1 (usunięte 753d28b2/45bc74b, 42201899/1b2e2e9, 079ef8d3/e6c064d; zostaje 775cc9b8/99c64bf, bieżące produkcyjne); curl z boksu: 753d28b2, 42201899, 079ef8d3, d365b18e, ee5232f7 → `/`, `/tower-makieta`, `/KSH_HARMONOGRAM.xlsx`, `/assets/index-CY6faOMj.js` wszystkie 404 (16 141 B, strona błędu Cloudflare, bez `cf-cache-status`/`age`); 775cc9b8 `/` 200, `/tower-makieta` i xlsx 404 (339 B). Na `tower-hhl.pages.dev` 6 ścieżek nadal 200 z `cf-cache-status: HIT`, `age` ≈ 23 200 s (makieta 92 717 B, xlsx 31 604 B) — cache CDN, wygasa ok. 04.10.2026. wrangler logout → whoami „You are not authenticated. Please run `wrangler login`.” Vercel — wdrożeń 4 → 1 (usunięte 51yg7bwxc, 4srxkzpuc, qurcjsmvf z danymi demo w JS; zostaje 90juzrwlv = `e6c064d`); stare adresy 404 `x-vercel-error: DEPLOYMENT_NOT_FOUND`. Telefony/rejestracje demo: brak generatora — lista wpisana na sztywno w `src/data/seedIdentity.ts` (commit d8114a7, 25.09.2026 00:32, „feat(D12): realistic PL/LT/SE seed people…”): `SEED_DRIVERS` l. 3–34 (30 osób: 15 PL +48 z prefiksami 500–508/601–609, 10 SE +46 70x, 5 LT +370), `SEED_TRACTORS` l. 36–43, `SEED_TRAILERS` l. 45–51, `SEED_ESCORTS` l. 53–56, przydział cykliczny `seedResourcesForIndex` l. 68+ (użyte w `seed.ts` l. 373); `loads.json` zawiera te same wartości wpisane na sztywno (58 ładunków z telefonem, 30 unikalnych, wszystkie z `SEED_DRIVERS`) — skryptu, który przepisał je do JSON, nie ma w repo. W produkcji podmienione na `seed.prod.ts` (strażnik: 0 numerów w dist). |
| I-1 | Etap I — import harmonogramu w trybie `supabase` (BLOKER): zapis `loads` + `shipment_items` w jednej transakcji, podgląd nowe/zmienione/anulowane, wersje + archiwum pliku, powiadomienie o zmianie daty awizowanego | **DONE** 27.09.2026 (import na produkcji czeka tylko na aktywne konto HHL) | `9bf80d7`, `f8b6355` | `tests/db/import.sh` 37/37 (w gate/pre-push); `schedule-import-rpc` 4/4; unit 364 passed / 33 skipped; lokalny Supabase (CLI+Docker, build produkcyjny) `schedule-import.local` 5/5, UI `i1-import-ui.local` 3/3; `i0-prod-guard` 4/4; tsc, lint:css OK | **Funkcja:** `import_schedule(p_project, p_rows, p_cancel_codes, p_file, p_dry_run)` — SECURITY DEFINER, search_path=public, advisory lock, tylko HHL (0048: także przy `is_hhl()` = NULL, konto nieaktywne/bez `app_users`), EXECUTE tylko authenticated; klucz = kod „Wysyłka”; zmienia wyłącznie `plan_load_date`/`plan_delivery_date`/`order_no` i wymiary pozycji — okna `plan_*_from/_to` nietknięte (ANEKS 2); anulowanie = status CANCELLED (0 DELETE) przez `tower.cancel_ctx`=IMPORT + audit_log + zdarzenie; zdarzenia tylko INSERT; bez zmian w pliku → 0 zapisów, brak nowej wersji. **3.6:** wersja w `schedule_imports` (+`file_name`), plik w prywatnym koszyku Storage `harmonogramy/<projekt>/<sha256>.xlsx` (tylko HHL). **3.7:** zmiana daty na awizowanym (okno ustawione lub status ≥ READY) → zdarzenie SCHEDULE_DATE_CRITICAL + powiadomienia IN_APP HHL i przewoźnik (e-mail wymaga wdrożenia Edge `send-notifications`). **UI:** podgląd różnic z serwera, prawdziwa linia wersji, import tylko HHL na produkcji (demo bez zmian). **Skala (lokalny Supabase, `KSH_HARMONOGRAM.xlsx`, 123 wiersze, 50 z wysyłką):** 41 transportów / 41 pozycji / 41 zdarzeń / 1 wersja; 9 odrzuconych BAD_DIMENSIONS (wymiar „Standard”: T-03…T-05, T-08…T-10, T-13…T-15), 73 wiersze puste; podgląd 29–36 ms (SQL 8–13 ms), zapis 22–30 ms (SQL 15–21 ms); drugi import: 0 nowych / 0 zmian / 41 bez zmian, 15 ms; zmieniony XLSX: +1, ~4 (1 krytyczna), −2 anulowane, wersja 2, 19–23 ms; RLS: KSH, SCX, anon odrzuceni, archiwum HHL 200 / KSH ≥400. **Produkcja nglnnrmzmhusvxslousq:** migracje 0047 i 0048 (`supabase db push`), weryfikacja w transakcji wycofanej: dry-run HHL 41 nowych / 61 ms, konta nieaktywne (HHL_OPS, CLIENT_USER, CARRIER_DISPATCH) i bez `app_users` → „wyłącznie HHL”; po rollbacku loads/wersje 0/0; żadnego importu. **Vercel:** `git archive f8b6355` → https://watch-tower-makieta-js0ryb6v9-sebastianbozekq-7781s-projects.vercel.app (aliasy tower.log-mar.pl, watch-tower-makieta.vercel.app): logowanie 200, pakiet z `import_schedule`, 0 × service_role, `/KSH_HARMONOGRAM.xlsx` i makiety 404. Pages (zapas) nie aktualizowane — w tyle. **Otwarte:** decyzja „Standard” (9 transportów, `length_m` NOT NULL); wzorzec `if not is_hhl()` (NULL przepuszcza) nadal w `cancel_load`, `import_cancel_loads`, `import_removal_check`, `register_invoice`, `mark_invoice_paid`, `unmark_invoice_paid`; backup nie obejmuje koszyka `harmonogramy`. |
| I-2A | Etap I — systemowa poprawka strażników NULL (konto nieaktywne / bez `app_users` → `is_hhl()` = NULL, „if not …” nie odmawiał) | **DONE** 27.09.2026 | `5d375f5` | `tests/db/nullguard.sh` 175/175 (w gate/pre-push): 41 funkcji z EXECUTE dla authenticated — 35 z kontrolą × 4 konta (nieaktywny HHL, KSH, SCX, brak `app_users`) = **140/140 odmów** (przed 0049: 88/140), 6 czystych obliczeniowych bez dostępu do danych; kontrola pozytywna aktywnego HHL 30 zgodnych + 2 n/d; test statyczny `tests/db/null-guard-static.mjs` (migracje w pre-push + żywa baza) 0 naruszeń; unit `null-guard-static` 3/3 | **Migracja 0049** (produkcja: TAK, `supabase db push`): `is_hhl()`/`can_see_margin()` ściśle true/false; 25 funkcji przepisanych na „if (…) is not true then raise” / „is true” (m.in. issue_driver_token, revoke_driver_token, report_position, cancel_load, import_*, mark/unmark_invoice_paid, register_invoice, admin_*, guard_load_update, guard_invoice_update + odmowa bez aktywnego konta, apply_geofence_status, permit_fits); fx_rate_before, keep_alive (anon dalej działa), risk_audience_for: zalogowany bez aktywnego konta → odmowa. **Przed poprawką** (lokalnie): nieaktywny/bez konta wydawał token kierowcy, oznaczał fakturę jako opłaconą, widział kandydatów importu. **Produkcja, transakcja wycofana:** 4 konta × 35 = 140/140 odmów, Sebastian@log-mar.pl (HHL_ADMIN, aktywny) 20/20 bez odmowy, `is_hhl()`=true, podgląd importu pełnego pliku: 50 nowych (po 0050); po ROLLBACK 0 zmian w danych; test statyczny na żywej bazie 102 definicje, 0 naruszeń. Generator weryfikacji: `scripts/i2/nullguard-prod.py`. Import na produkcji NIE czeka na aktywację — HHL_ADMIN przechodzi `is_hhl()`. |
| I-2B | Etap I — kopia zapasowa: tabele z katalogu zamiast listy na sztywno, kubełek `harmonogramy` | **DONE** 27.09.2026 | `d2a8219` | `tests/db/backup.sh` 22/22 (było 20): katalog vs pliki kopii (tabela spoza kopii i wyłączeń = czerwony), nowa tabela `t_nowa_tabela` w kopii bez zmiany kodu, nieaktualne wyłączenie = czerwony, odtworzenie 3 plików (2 dokumenty + harmonogram) SHA-256 3/3; `backup-core` 12/12 | `CATALOG_TABLES_SQL` (public, r/p, bez obiektów rozszerzeń) − `EXCLUSION_REASONS` (positions, driver_tokens, spatial_ref_sys, account_relink_pending — każde z powodem); `REQUIRED_TABLES` (brak = błąd przebiegu); `BACKUP_BUCKETS = ['harmonogramy']` → `files/harmonogramy/<projekt>/<sha>.xlsx.age` (wszystkie obiekty, powtórki pomija Worker 409). Uwaga: `schedule_imports` była już na liście — wypadał tylko kubełek. Produkcja (odczyt): katalog 41 tabel → 38 w kopii (jak dotąd), kubełek 0 obiektów. **Edge `backup-export` wdrożona** (`supabase functions deploy --use-api`, verify_jwt, anon → 403). Worker Cloudflare `tower-backup-writer` bez zmian (prefiks `files/` już dozwolony) — logowanie do Cloudflare niepotrzebne. Pierwszy przebieg z nowym kodem: nocny cron 02:30. |
| I-2C | Etap I — klasa ładunku STANDARD (9 transportów „Standard”: T-03…05, T-08…10, T-13…15) | **DONE** 27.09.2026 | `0c247b3` | `tests/db/import.sh` 46/46 (+9: STANDARD przyjęty z NULL, idempotencja, STANDARD z wymiarami / brak klasy i wymiarów / nieznana klasa odrzucone, 2× ograniczenie bazy, stare `schedule_row` bez fałszywych zmian); `schedule-import-rpc` 6/6; lokalny Supabase `schedule-import.local` 5/5, UI `i1-import-ui.local` 3/3 (9 × „Standard” w kolumnie wymiarów); unit 372 passed / 33 skipped; `i0-prod-guard` 4/4 | **Migracja 0050** (produkcja: TAK): `shipment_items.cargo_class` STANDARD / DIMENSIONED (domyślnie), `length/width/height_m` NULL wyłącznie i obowiązkowo dla STANDARD (`shipment_items_dims_by_class`), `schedule_row_canon` + `import_schedule` z klasą. Parser: „Standard” → STANDARD (bez OVERSIZE / IMPLAUSIBLE_QTY); walidator zezwoleń (`isReadyBlocked`, `evaluateLoadCover`) pomija STANDARD; UI (harmonogram, szuflada, eksport XLSX): „Standard”. **Pełny plik (lokalny Supabase, build produkcyjny):** 123 wiersze → 50/50 wysyłek (41 z wymiarami + 9 STANDARD, 73 puste); podgląd 41 ms (SQL 14), zapis 32 ms (SQL 24): transporty/pozycje/zdarzenia/wersje 50/50/50/1; drugi import 0/0/50 bez zmian, 19 ms; zmieniony XLSX +1 ~4 (1 krytyczna) −2 anulowane, wersja 2, loads 51. Produkcja (transakcja wycofana): podgląd HHL_ADMIN 50 nowych, 15 ms. **Vercel:** `git archive 0c247b3` → https://watch-tower-makieta-h4pl3ydou-sebastianbozekq-7781s-projects.vercel.app (tower.log-mar.pl, watch-tower-makieta.vercel.app): logowanie 200, pakiet z `cargo_class`, 0 × service_role, makiety i xlsx 404. Otwarte: wycena klasy STANDARD (siatka stawek wymaga wymiarów — dziś brak dopasowania). |
| I-2a | Etap I — przełącznik widoku HHL/KSH/SCX tylko dla konta HHL; import harmonogramu tylko HHL (także demo) | **DONE** 27.09.2026 | `16638cb` | `canSwitchView()` (prod: org HHL); Shift+R tylko przy przełączniku; `canImportSchedule` HHL=true, KSH/SCX=false w demo i prod; `i2-facade.local.spec` (build produkcyjny, lokalny Supabase): KSH 0 przełączników, SCX 0, HHL 1; D26 przeniesiony na HHL (etap4 12/12) |
| I-2b | Etap I — baner i oś postępu kokpitu z bazy | **DONE** 27.09.2026 | `16638cb` | prod: baner = najpoważniejsze CRITICAL/HIGH z `risk_signals` (+liczba), brak → brak banera; oś tygodni z `plan_delivery_date`/`actual_delivery_at` (maks. 26), pusty harmonogram → komunikat; OTIF „—” przy 0 dostarczonych; kafelek dokumentów z `documents`; unit `i2-facade` 14/14 |
| I-2c | Etap I — Workflows ukryte w produkcji | **DONE** 27.09.2026 | `16638cb` | `navForRole(r, prod)` bez `wf` dla 3 ról; Opcje: podsumowanie automatyzacji i preferencja „reguły workflow” ukryte; lokalny build prod: 0 × `nav [data-view=wf]` dla HHL/KSH/SCX |
| I-2d | Etap I — ETA v1 w bazie: odcinki + rejs z `sailings` + pasmo ufności | **DONE** 27.09.2026 | `16638cb`, `d912df7` | migracja **0051**: `eta_segment_params` (6 parametrów-założeń, źródło „założenie M12”), `compute_load_eta`/`refresh_load_eta` (bez EXECUTE dla API), 4 wyzwalacze (load_events, positions, sailings, loads), `loads.eta_basis`/`eta_confidence_min`/`eta_computed_at`, `delay_minutes` = ETA − koniec okna planu; `guard_load_update`: kontekst ETA zmienia wyłącznie eta_*/delay_minutes; `tests/db/i2.sh` **51/51** (w gate); klient: mapper bierze ETA z bazy, szuflada „± N min · ETA v1 (baza)”, bez zastępczych 95 min; produkcja: 0 transportów → backfill 0 wierszy; weryfikacja w wycofanej transakcji: nowy transport → ETA, pasmo 747 min, 3 odcinki |
| I-2e | Etap I — pogoda, przeprawy alternatywne, objazdy SE, pozycje AIS: „brak źródła danych” | **DONE** 27.09.2026 | `16638cb`, `a4ff639` | prod: pasek górny — najbliższy rejs z `sailings` bez fali; Ryzyka — rozkład z bazy + 2 notatki `data-no-source` (morze, przeprawy); SE: bez zdarzeń przykładowych i objazdów; mapa bez pozycji AIS seed; `HIDDEN_IN_PROD` 13 kluczy, każdy użyty (test) |
| I-2f | Etap I — prawdziwy formularz BAF/SEFS dla HHL | **DONE** 27.09.2026 | `16638cb`, `d912df7` | migracja **0052**: `sefs_parameters` (wersje, append-only), `fuel_index_readings` (okres, data, wartość, wymagany adres źródła; korekta = nowy wiersz z powodem), RPC `sefs_save_parameters`/`fuel_add_reading`/`baf_change_log` (tylko HHL, strażnik „is not true”), audit_log 3 akcje; lista dozwolonych +3, security 83/83, nullguard 190/190; UI `BafForm` (leniwy, tylko Supabase): wersja → odczyt SEK+PLN → podgląd mnożnika min(SEK,PLN) → korekta → dziennik 4 wpisy (lokalny e2e 4/4); produkcja w wycofanej transakcji: HHL zapisuje wersję 1, odczyt, dziennik 2; UPDATE tabeli = odmowa; duplikat okresu i brak adresu = odmowa; konto bez `app_users` = odmowa zapisu i dziennika, widzi 0/0; po rollback 0/0/0. Wartości SEFS nie wpisane (D-2) |
| I-2g | Etap I — kody opóźnień ukryte | **DONE** 27.09.2026 | `16638cb` | UI ich nie używa; test statyczny: 0 wystąpień `delay_code`/`delayCode`/`A_CLIENT` w `src/` |
| I-2h | Etap I — fikcyjne numery demo + strażnik wysyłki | **DONE** 27.09.2026 | `16638cb` | 30 numerów w `SEED_DRIVERS` (15 PL `+48 000 000 001…015`, 5 LT `+370 000 0000 1…5`, 10 SE pula PTS `+46 70 174 06 05…14`), 58 wystąpień w `loads.json`, 3 w teście; `i2-demo-no-send` 5/5: pule, 0 numerów spoza pul w `src/`, runtime demo: brak odbiorcy zdalnego i 0 wywołań fetch/XHR, paczka demo bez supabase/functions/v1/signInWithOtp/api.resend.com/sms:/mailto:; wzorce wizualne bez zmian (numery nie występują w ujęciach `tests/__screenshots__`) |
| I-2i | Etap I — przegląd 37 pozycji „częściowo” | **DONE** 27.09.2026 | (ten wpis) | 37 przejrzanych: 11 działało tylko w demo — 8 ukrytych/zastąpionych w I-2a–h, 3 nowe pozycje w PLAN (I-2j, I-2k, I-2l); tabela niżej (§ I-2i). Macierz ujęć pl/1280 (56 ujęć, stary vs nowy build demo): różnice tylko harmonogram HHL/KSH (przycisk importu przeniesiony na HHL, 4 ujęcia) + mapa (niestabilna także stary vs stary); kokpit 68/68 bez różnic po `a4ff639` |
| I-2j | Etap I — pozycje promów z bazy (AIS z `ferry-ais`) na mapie zamiast przykładowych | **DONE** 27.09.2026 | `5ed7dd0` | migracja **0053** (produkcja: TAK, `supabase db push`, 2× lokalnie — idempotentna): `vessel_positions` (statek, lat/lon, SOG, COG, czas sygnału AIS, czas odczytu; unikalność statek+czas sygnału), RLS odczyt = aktywne konto, API bez INSERT/UPDATE/DELETE, anon bez SELECT; retencja 30 dni `purge_vessel_positions` (bez EXECUTE dla API, ostatnia pozycja statku zostaje), cron `tower-retencja-pozycji-promow` 02:55 UTC. `tests/db/i2.sh` **60/60** (+9 I-2j), brama bazy 14/14 zestawów zielona (security 83, nullguard 190 …); unit `integrations` 24/24 (+3: zapis pozycji, powtórka sygnału = 0 nowych, statek bez rejsu — pozycja bez wniosku, pusta odpowiedź = 0), `i2j-ais-db` 4/4; lokalny Supabase, build produkcyjny: `i2-facade.local` **5/5** (nowy: KSH mapa „brak źródła danych” → po wstawieniu pozycji „z bazy, ostatni odczyt 27.09.2026 20:10” + znacznik promu +1 + atrybucja CC BY 4.0) | **Zadanie:** `ferry-ais` zapisuje pozycję każdego statku z MMSI (rejs w toku — jak dotąd z obserwacją/ryzykiem; bez rejsu — tylko pozycja). Edge `ferry-ais` wdrożona (wersja 6, verify_jwt). **Produkcja:** przebieg 20:40 PL → `M/F Wawel` 58,9056 N 17,9572 E, SOG 0 (Nynäshamn), sygnał 20:36:56, odczyt 20:40:03; Nova Star — Digitraffic 0 obiektów (poza zasięgiem), 0 wierszy. **Klient:** `subscribeFerryPositions` — produkcja: odczyt `vessel_positions` co 2 min (moduł ładowany leniwie, bez WebSocket, bez pozycji przykładowych), podpowiedź znacznika „odczyt AIS <data>”, stopka mapy „AIS: z bazy, ostatni odczyt … (Dane AIS: Fintraffic / digitraffic.fi, licencja CC BY 4.0)” albo „brak źródła danych”; demo bez zmian (proxy/seed). **Vercel:** `git archive 92ae55d` → https://watch-tower-makieta-6lvpqzmwo-sebastianbozekq-7781s-projects.vercel.app (aliasy tower.log-mar.pl, watch-tower-makieta.vercel.app — oba 200); 18 plików JS, 0 × `service_role`, kawałek `aisDb-*.js` tylko w paczce produkcyjnej (demo: test `i2-demo-no-send` zielony). |
| I-D9 | Etap I (P0, decyzja D-9) — parametry odcinków ETA v1 | **DONE** 27.09.2026 | `8d69a40` | migracja **0054** (produkcja: TAK; idempotentna — 2× lokalnie): PL_ROAD 7,5 h ±25%, PORT_CHECKIN 3 h, SE_ROAD 17 h ±20%, SE_BREAKS 13 h ±30%, CROSSING_DEFAULT 18 h ±15% bez zmian; źródła: „szacunek koordynatora 27.09 — do potwierdzenia z SCX (II-3)” ×3, „właściciel 27.09: obsada jednoosobowa, odpoczynek na promie” ×1; przeliczenie ETA transportów w toku (produkcja: 0). `tests/db/i2.sh` **62/62** (+2 D-9; 7 oczekiwań przeliczonych: bez rozkładu 43 → 58,5 h, pasmo rejsu założonego 747 → 1013, przypisanego 417 → 683, opóźnionego 477 → 743, FERRY 423 → 630) | **Produkcja, transakcja wycofana** (ten sam transport wzorcowy: nowy, załadunek jutro, dostawa +3 dni, rejs założony z rozkładu): **przed** pasmo ±747 min, opóźnienie 390 min, ETA 01.10 06:30 PL; **po** ±1013 min, opóźnienie 1080 min, ETA 01.10 18:00 PL; po rollback 0 transportów. Model: obsada jednoosobowa, przeprawa promem = dobowy odpoczynek na promie (potwierdzone przez właściciela 27.09 — zamknięte, nie do potwierdzenia z SCX), bez postoju w Nynäshamn; SE = 17 + 13 = 30 h, rozrzut odcinka SE = większy z dwóch (30%). |
| I-2k | Etap I — paczka dokumentów „tydzień” tylko z transportów wybranego tygodnia ISO | **DONE** 27.09.2026 | `e4b393d` | unit `i2k-doc-week` **5/5**: tydzień transportu (rozładunek → planowana dostawa → planowany załadunek; niedziela 27.09 = W39, poniedziałek 28.09 = W40), wybór domyślny, dokumenty W39 2/5, W40 1/5, W38 (rozładowany 18.09) 1/5, W41 0, dokument bez transportu nigdy; **plik ZIP** paczki W39 odczytany z powrotem: dokładnie 2 pliki `documents/L39a/…`, `documents/L39b/…`; fresh-smoke (visual, d19, deur, etap4/5/6) zielony | **Błąd (nie fasada):** przycisk „Pobierz paczkę tygodnia” pakował całą listę `documents` w obu trybach. **Teraz:** `src/lib/docWeek.ts` (`loadWeekKey`, `weeksWithLoads`, `defaultDocWeek`, `docsForWeek`) — tydzień jak w fakturach tygodniowych (`unloadedAtOf`, strefa Europe/Warsaw); w nagłówku Dokumentów lista tygodni z transportami (istniejący styl `select.input`, jak w kreatorze faktur), domyślnie bieżący albo najbliższy następny; plik `WATCH_TOWER_dokumenty_<RRRR-Www>.zip`. Demo (zamrożony czas 23.09): tygodnie W39–W47, domyślny W39. |
| I-2l | Etap I — czas wykrycia odchylenia z `risk_signals` zamiast „8 min” | **DONE** 27.09.2026 | `825da20` | migracja **0055** (produkcja: TAK; idempotentna): `risk_signals.occurred_at` + wyzwalacz BEFORE INSERT (jawne `detail.occurred_at`; cichy pojazd = ostatnia pozycja + próg; ryzyko strefy = czas zdarzenia strefy z `load_events`; inaczej NULL), `kpi_detection_lag(p_project, p_days)` — mediana (wykrycie − zdarzenie) ryzyk transportów z 30 dni, SECURITY INVOKER (zakres = RLS), anon bez EXECUTE, lista dozwolonych +1, null-guard-calls EMPTY. `tests/db/i2.sh` **72/72** (+10: 0 próbek → „—”, cichy pojazd 90 min, strefa 7 min, jawny 20 min, brak/zły czas → NULL, HHL 3/20, KSH 0 (RLS), SCX 3/20, bez app_users 0, okno 30 dni), `nullguard` **194/194** (odmowy 156/156 = 39 × 4 konta), security 83/83; unit `i2l-detect-lag` 3/3; lokalny Supabase, build produkcyjny: `i2-facade.local` **6/6** (kafelek HHL „—” → po ryzyku z czasem „12 min”, „mediana · n = 1 (30 dni)”) | **Produkcja, transakcja wycofana (Sebastian@log-mar.pl, HHL_ADMIN):** bez danych 0 próbek / mediana pusta (kafelek „—”); transport testowy w drodze, ostatnia pozycja 2 h temu → `detect_silent_vehicles(90)` 1 ryzyko, czas wykrycia 30 min, KPI 1/30; po rollback 0 transportów, 0 ryzyk z czasem. Istniejących wierszy `risk_signals` nie zmieniano. **Kokpit:** w produkcji kafelek zawsze widoczny (moduł `detectLag` ładowany leniwie tylko w paczce produkcyjnej), wartość z bazy albo „—”; demo bez zmian („8 min”, wzorce wizualne nietknięte). Stara `kpi_exception_detection_lag` (z `load_events.recorded_at`) zostaje nieużywana. |
| I-10 | Etap I — e-mail o zmianie daty awizowanego transportu | **DONE** 27.09.2026 | `a0d21bc` | migracja **0056** (produkcja: TAK): wyzwalacz AFTER INSERT na `notifications` — dla IN_APP `SCHEDULE_DATE_CRITICAL` tworzy bliźniaczy EMAIL (`dedup = 'EMAIL:' || dedup`, tylko aktywne konto z adresem); `send-notifications` wdrożona ponownie. unit `i10-email` 2/2, `tests/db/i2.sh` **77/77**, import 48/48, gate lokalnie 14/14 zestawów | **Produkcja:** transakcja wycofana — IN_APP dla Sebastiana → EMAIL PENDING z adresem konta, po rollback 0 wierszy. **Dostarczenie:** wiersz id=125 (EMAIL na `sebastian+tower-test@log-mar.pl`, kod TEST-I10) wstawiony 21:16:17 PL → cron `tower-send-notifications` **SENT 21:20:03 PL**, bez błędu. |
| O-V | wdrożenie Vercel `5d43f5d` (I-2k + I-2l) | **DONE** 27.09.2026 | `5d43f5d` | 19 plików JS, **0** × service_role; tower.log-mar.pl 200, watch-tower-makieta.vercel.app 200 | — |
| I-5 | Etap I — 2FA TOTP dla HHL_ADMIN (`aal2`) | **DONE** 27.09.2026 | (ten wpis) | migracja **0057** (produkcja: TAK): `security_flags` (MFA_HHL_ADMIN — przy wdrożeniu włączana tylko, gdy każdy aktywny HHL_ADMIN ma zweryfikowany TOTP; produkcja: **false**), `current_aal()`, `mfa_satisfied(role)` w helperach ról (HHL_ADMIN bez aal2 przy włączonym wymaganiu = brak roli → RLS i RPC odmawiają), `my_mfa_status()`, `admin_set_mfa_enforcement(bool)` (tylko HHL_ADMIN w aal2, audit_log MFA_ENFORCEMENT_SET). Klient: `src/auth/Mfa.tsx` (zapis QR + klucz, kod przy logowaniu, panel w Opcjach; leniwie, tylko build Supabase), AuthGate: ekran kodu przed danymi. `tests/db/i2.sh` **96/96** (+19), `nullguard` **204/204**, unit **416** passed (w tym `i5-mfa` 8/8), lokalny Supabase z TOTP, build produkcyjny: `i2-facade.local` **7/7** (zapis TOTP w Opcjach → wymaganie włączone → nowa sesja pokazuje ekran kodu bez danych → kod → aplikacja) | **Produkcja, transakcja wycofana (Sebastian@log-mar.pl):** aal1 + flaga wyłączona → rola HHL_ADMIN, projekty 1; flaga włączona + aal1 → projekty **0**; aal2 → projekty 1. Po `db push` flaga = false (Sebastian ma 0 składników MFA). **Instrukcja (D-11):** Opcje → „Weryfikacja dwuetapowa” → „Skonfiguruj aplikację uwierzytelniającą” → zeskanować QR (Google/Microsoft Authenticator) → wpisać kod → „Włącz wymaganie”. Awaryjnie (utrata telefonu): `update security_flags set enabled=false where key='MFA_HHL_ADMIN'` z konta serwisowego + usunięcie składnika w panelu Supabase Auth. |
| O-V | wdrożenie Vercel `a548eba` (I-5 + I-10) | **DONE** 27.09.2026 | `a548eba` | 22 pliki JS, **0** × service_role (index + chunki, w tym `Mfa-*.js`); tower.log-mar.pl 200, watch-tower-makieta.vercel.app 200 | — |
| I-D9-a | Analiza: czy opóźnienie 1080 min (ETA 01.10 18:00 PL) transportu wzorcowego D-9 jest wiarygodne | **DONE** 27.09.2026 | (ten wpis) | produkcja, transakcja wycofana, 4 warianty godziny załadunku | **Wynik: to nie błąd, tylko skutek modelu (skok o jeden rejs).** Transport wzorcowy: załadunek jutro (28.09) bez godziny → start 12:00 PL (reguła `compute_load_eta`: sama data = południe), dostawa 30.09 → koniec okna = 01.10 00:00 (Europe/Stockholm). Dojazd: 12:00 + PL 7,5 h + check-in 3 h = **22:30** → rejs 28.09 18:00 już odszedł → najbliższy **29.09 18:00**, przypłynięcie 30.09 12:00 → + SE 17 + 13 = 30 h → **01.10 18:00** → opóźnienie 18 h = **1080 min**. Przed D-9 (4,5 + 2 h) dojazd 18:30 — też po rejsie 18:00, ten sam rejs, SE 18,5 h → 01.10 06:30 (390 min). Suma odcinków 7,5 + 3 + 18 + 17 + 13 = 58,5 h — zgodna z testem `i2.sh`. **Wrażliwość (ten sam transport, różna godzina załadunku):** 06:00 → rejs 28.09, ETA 30.09 18:00, opóźnienie **0**; 07:30 → **0** (dokładnie na granicy: 07:30 + 10,5 h = 18:00); 08:00 → rejs 29.09, **1080 min**; bez godziny → **1080 min**. **Właściciel 27.09 (zamknięte):** różnica 390 → 1080 min = nowe czasy (+3 h jazdy + 8,5 h odpoczynku = 690 min), NIE błąd — zgodne z rozbiciem powyżej (ten sam rejs 29.09 18:00; SE 18,5 → 30 h = +11,5 h = 690 min). Wniosek: dla rejsu codziennie 18:00 załadunek w Polsce musi się skończyć do **07:30**, inaczej transport traci dobę. Do potwierdzenia z SCX w II-3: realna godzina załadunku i cutoff check-inu (3 h to szacunek). Przeprawa jako odpoczynek dobowy — zamknięta decyzją właściciela, bez zmian. |
| I-4 | Etap I — instrukcje w aplikacji: kierowca PL/EN/SV, HHL, KSH, przewoźnik | **DONE** 27.09.2026 | (ten wpis) | treść w słowniku `i4_*` (src/i18n/i2.ts): kierowca **8** kroków, HHL **7**, KSH **6**, przewoźnik **6** — każdy w PL/EN/SV (**81** tekstów + nagłówki); komponent `src/components/guide/Guide.tsx` (rozwijany panel „Instrukcja”). Osadzenie tylko w buildzie produkcyjnym, leniwie: PWA kierowcy (otwarta przed zgodą na lokalizację), Opcje (HHL), Ustawienia (KSH/SCX). unit `i4-guide` **7/7**, PL-T 4/4 (hunspell pl_PL bez nowych wyjątków), unit łącznie **423** passed; lokalny Supabase, build produkcyjny: `i2-facade.local` **11/11** (+4: HHL 7, KSH 6, SCX 6, kierowca z linkiem serwerowym — 8 kroków, przełączenie SV/EN) | Kierowca: link, język, zgoda i jej wycofanie, przyciski etapów, PROBLEM, zdjęcie CMR/POD, **prom = odpoczynek dobowy (D-9)**, nowy link. Treść opisuje wyłącznie funkcje, które działają w produkcji (bez fasady). Demo i wzorce zrzutów bez zmian (panel nie istnieje w paczce demo). |
| I-6 | Etap I — monitoring błędów przeglądarki do własnej tabeli + alarm | **DONE** 27.09.2026 | (ten wpis) | migracja **0058** (produkcja: TAK): `client_errors` (odcisk komunikat+pierwsza linia stosu; ten sam błąd w 10 min = `hits`+1), `report_client_error()` (anon — PWA kierowcy i ekran logowania; zalogowany tylko z aktywnym kontem; limity pól, 60 nowych/min globalnie, tokeny `wt_…`, JWT i `access_token=` wycinane), odczyt tylko HHL_ADMIN (RLS), `client_error_watch()` co 15 min (cron `tower-bledy-przegladarki`): błąd w 15 min → ryzyko HHL `JOB_FAILURE`/`rk_client_errors` + e-mail ALERT_EMAIL_TO (Resend przez pg_net), jeden alarm na incydent, zamknięcie po 24 h bez błędów; retencja 30 dni (`tower-bledy-retencja`). Klient `src/lib/errorReport.ts` (window `error` + `unhandledrejection`, maks. 10 na kartę, ten sam komunikat raz na 60 s, identyfikator buildu z nazwy paczki), instalowany leniwie tylko w buildzie produkcyjnym. `tests/db/i2.sh` +18, nullguard **209/209**, unit `i6-error-report` 4/4, lokalny Supabase: `i2-facade.local` (+1: wyjątek i odrzucona obietnica KSH → 2 wiersze z rolą CLIENT_ADMIN i buildem) | **Produkcja:** transakcja wycofana — anon zgłoszenie z tokenem → zapis `wt_…`, alarm ALARM/1 ryzyko HHL, e-mail do kolejki (wycofany). **Błąd testowy przez publiczne API (klucz anon, jak przeglądarka):** 21:46:36 PL `true` → wiersz id=1 w `client_errors` (`I6-TEST-PROD…`, ścieżka `/#/test`); odczyt tabeli kluczem anon: **permission denied** (42501). **Alarm na produkcji:** cron 22:00:00 PL → ryzyko HHL `rk_client_errors` (HIGH), e-mail przez Resend 22:00:07 — odpowiedź **200** (id wiadomości zwrócony). Po weryfikacji wiersz testowy usunięty, ryzyko testowe zamknięte ręcznie. |
| I-7 | Etap I — retencja danych kierowcy 90 dni | **DONE** 27.09.2026 | (ten wpis) | migracja **0059** (produkcja: TAK): `purge_personal_data` (cron `tower-rodo` 02:15 UTC) — imię i telefon 90 dni po rozładunku (jak dotąd) **+ anulowane** (90 dni po anulowaniu; wcześniej zostawały bez końca), pozycje GPS 30 dni po rozładunku **+ anulowane po 90 dniach**, **linki kierowcy** (`driver_tokens`) 90 dni po wygaśnięciu/odwołaniu; transport w toku nigdy (także po terminie planu); każdy przebieg → `integration_runs` job `rodo` z liczbami; strażnik `p_days ≥ 0`. `tests/db/i2.sh` +11 (rozładowany 91/89 d, anulowany 91/10 d, w drodze 200 d, linki 91/89/odwołany 100 d, dziennik 1/1/1/2, drugi przebieg 0), release 145/145 | **Produkcja, transakcja wycofana:** przebieg 0 (0 transportów), wpis `rodo` z sześcioma licznikami 0; anon/authenticated bez EXECUTE. Zdjęcia CMR/POD — decyzja D-3 (poza I-7). Tablice rejestracyjne zostają (dane pojazdu do dokumentów). |
| I-8 | Etap I — wydajność: cały harmonogram + GPS wg PR5, trzy role | **DONE** 27.09.2026 | (ten wpis) | lokalny Supabase (nigdy produkcja), wolumen `scripts/i8/seed.sql`: **350** transportów (300 „PERF” −120…+60 dni + 50), **112 496** pozycji GPS (79 transportów × 1 424 pkt = 4 doby × 356 wg PR5), tabela pozycji **39 MB**; po pomiarze `scripts/i8/clean.sql`. **Baza** (`scripts/i8/sql-perf.sh`, mediana z 7): harmonogram (transporty + ładunki + rejs, RLS) HHL **36,6 ms**, KSH **51,9 ms**, SCX **103,5 ms**; ryzyka ~6 ms; widoki cen ~4,5 ms; `process_position` (punkt + strefy + ETA) **44,1 ms**; ostatnia pozycja aut w trasie **8,6 ms**; `compute_load_eta` ×300 **76,1 ms**; `detect_silent_vehicles` **7,3 ms**; `purge_personal_data` **17,5 ms**. **Interfejs** (build produkcyjny, `tests/i8-perf.local.spec.ts`, mediana z 3, Chromium): logowanie → kokpit z danymi HHL **879 ms** / KSH **884 ms** / SCX **873 ms**; harmonogram z pełną listą **350 wierszy** HHL **462 ms** / KSH **601 ms** / SCX **352 ms**; mapa HHL **340 ms** / KSH **326 ms** / SCX **525 ms** | Napływ GPS wg PR5 (20 aut, punkt co 2 min) ≈ 0,17 wywołania/s × 44 ms — pomijalne. Wszystkie czasy < 1 s; pierwsze wejście (zimna pamięć podręczna) 1,2–1,5 s. Bez zmian w kodzie aplikacji. |
| I-17 | Etap I — 2FA: drugie urządzenie uwierzytelniające | **DONE** 27.09.2026 | (ten wpis) | migracja **0060** (produkcja: TAK): `mfa_factor_count()` (zweryfikowane TOTP bieżącego konta; bez EXECUTE dla API), `my_mfa_status().factors`, `admin_set_mfa_enforcement(true)` **tylko przy ≥ 2 urządzeniach** (wyłączenie zawsze). Panel „Weryfikacja dwuetapowa”: lista urządzeń (nazwa „TOWER n · data”), „Dodaj drugie urządzenie” (sesja aal2), „Usuń” gdy są dwa; ekran kodu przy logowaniu: wybór urządzenia, gdy więcej niż jedno. `tests/db/i2.sh` **132/132** (+7), unit **430** passed (`i5-mfa` 11/11); lokalny Supabase: `i2-facade.local` **12/12** — scenariusz: urządzenie 1 → wymaganie zablokowane → urządzenie 2 (inny sekret) → wymaganie włączone → sesja A kodem urządzenia 2 → sesja B: kod urządzenia 2 dla urządzenia 1 odrzucony, kod urządzenia 1 przyjęty | **Produkcja, transakcja wycofana:** Sebastian `factors 0`, aal1, wymaganie wyłączone. **D-11:** zapisz dwa urządzenia, potem „Włącz wymaganie” (przy jednym przycisk nie pojawia się, baza odmawia). |
| I-18 | Etap I — status dat planu WSTĘPNA / POTWIERDZONA (D-12) | **DONE** 27.09.2026 | (ten wpis) | migracja **0061** (produkcja: TAK, najpierw transakcja wycofana: 0 transportów, N=5, 0 ryzyk): `loads.plan_dates_status` + autor + czas; RPC `ksh_confirm_dates` (tylko KSH klienta projektu, do wjazdu na załadunek; zmiana dat przy potwierdzeniu dozwolona); zmiana daty POTWIERDZONEJ = zdarzenie `PLAN_DATES_CHANGED` + powiadomienie w aplikacji i e-mail dla HHL, przewoźnika i KSH (bez autora); zmiana przez HHL lub import cofa status do WSTĘPNA; import: data potwierdzona NIE jest nadpisywana bez osobnej zgody (`overwrite_confirmed`), w oknie importu ostrzeżenie z listą „przed → po” i pole zgody; ostrzeżenie wraca przy każdym imporcie, dopóki różnica istnieje; `app_parameters.DATE_CONFIRM_DAYS`=5, `detect_unconfirmed_dates()` (cron `tower-potwierdzenie-dat` co godzinę) → ryzyko `DATES_UNCONFIRMED` (HHL+KSH); ANEKS 2 bez zmian. Harmonogram: ✓ lub „wstępna” przy datach; szuflada (przegląd): status, autor, czas, formularz tylko dla KSH. Szablon e-mail PL/EN/SV, `send-notifications` wdrożone ponownie. `tests/db/i2.sh` **168/168** (+36), nullguard **214/214**, unit **433** passed (`i18-plan-dates` 3/3), lokalny Supabase: `i18-dates.local` **4/4** (SCX wstępna bez formularza → KSH potwierdza i zmienia → HHL i SCX widzą ✓), `i2-facade.local` **12/12** | SCOPE 16.3 (import u KSH) ZASTĄPIONA PRZEZ I-18. |
| O-V2 | wdrożenie Vercel `cdbb696` (I-4, I-6, I-7, I-8, I-17, I-18) | **DONE** 27.09.2026 | `cdbb696` | **0** × service_role (index + chunki); tower.log-mar.pl 200, watch-tower-makieta.vercel.app 200; `ksh_confirm_dates` obecne w paczce | — |
| I-16 | Etap I — walidacja ETA v1 na 50 prawdziwych transportach wobec planu KSH 5 dni | **DONE** 27.09.2026 | (ten wpis) | `scripts/i16/eta-validation.sql`, produkcja w transakcji wycofanej (prawdziwy rozkład GDN-NYN: 73 rejsy, codziennie 18:00 poza większością niedziel; parametry 0054). Dane: 50 przyjętych wierszy `KSH_HARMONOGRAM.xlsx` (plik nie ma godzin, więc start = dzień załadunku 12:00). Zapas = koniec dnia (załadunek + 5 dni, Sztokholm) − ETA. **Wynik: min 30,0 h · mediana 54,0 h · maks. 55,0 h, ujemnych 0/50.** Rozkład: 39 × 54–55 h (start → ETA 78 h), 11 × 30 h (start → ETA 102 h: załadunek w sobotę albo piątek bez rejsu w niedzielę → rejs w poniedziałek; w tym SS-04, SS-05). 55 h = zmiana czasu 25.10. Wobec dat dostawy z pliku: min 30 · mediana 54 · maks. 102 h (7 wierszy ma w pliku 4 albo 7 dni zamiast 5). Pasmo ±1013 min dla wszystkich (rejs założony, nie przypisany: +6 h). **Wniosek dla modelu:** przy starcie 12:00 dojazd + check-in (10,5 h) zawsze mija rejs 18:00 tego samego dnia, więc każdy transport bez godziny płynie dzień później. Plan 5 dni ma zapas mimo to. Realna godzina załadunku (zatwierdzana w I-18) może skrócić ETA o 24 h. **Transport wzorcowy D-9** (załadunek 28.09 bez godziny, dostawa 30.09): start pon 28.09 12:00 → PL_ROAD 7,5 h → 19:30 → check-in 3 h → 22:30 → rejs **wt 29.09 18:00** (rejs 28.09 18:00 już odszedł; najbliższy w rozkładzie, założony) → przypłynięcie śr 30.09 12:00 (odpoczynek dobowy na promie, D-9) → SE_ROAD 17 h → czw 01.10 05:00 → SE_BREAKS 13 h → **ETA czw 01.10 18:00** (78 h od startu), ±1013 min. Wobec daty z pliku (koniec 30.09) −18 h — ten transport ma w teście tylko 2 dni na dostawę; wobec planu 5 dni (koniec 03.10) **+54 h**. Model i rejs sprawdzone: ujemny zapas to skutek skoku o jeden rejs (I-D9-a), nie błąd. | Do II-3 (SCX): godzina załadunku i cutoff check-inu. |
| I-15 | Etap I — pasmo ETA: odpoczynek dobowy osobno, łączenie RSS | **DONE** 27.09.2026 | (ten wpis) | migracja **0062** (produkcja: TAK; najpierw transakcja wycofana): odcinek SE = SE_ROAD 17 h ±20% + **SE_DAILY_REST 11 h ±0%** (nowy, osobny) + **SE_BREAKS 2 h ±50%** (było 13 h ±30%); suma SE 30 h, więc ETA bez zmian. Pasmo = pierwiastek z sumy kwadratów składników (odcinki + niepewność rejsu), `eta_basis.band` = metoda, pasmo, dawna suma liniowa, składniki. **Pasmo przed → po (te same stany co w `i2.sh`):** rejs założony z rozkładu **1013 → 433 min** (suma przy nowych odcinkach 737); rejs przypisany **683 → 242**; rejs przypisany opóźniony **743 → 250**; na promie (opóźniony) **630 → 223**; bez rozkładu 1535 → 776. 50 transportów KSH (I-16): wszystkie **±1013 → ±433 min**; ETA i zapas bez zmian (30 / 54 / 55 h). Transport D-9: SE_ROAD do czw 05:00 → odpoczynek dobowy do 16:00 → przerwy do **18:00 = ETA**, pasmo 1013 → 433. `tests/db/i2.sh` **170/170**, unit `i15-eta-band` 2/2 | — |
| I-13 | Etap I — zakres wersji SEFS COST / REVENUE / BOTH (+ D-10) | **DONE** 27.09.2026 | (ten wpis) | migracja **0063** (produkcja: TAK; najpierw transakcja wycofana: 0 wersji na produkcji): `sefs_parameters.applies_to` (domyślnie BOTH, istniejące wersje = BOTH), RLS tylko SELECT: HHL wszystko; przewoźnik COST i BOTH **wyłącznie `agreed_with_carrier`** i tylko projekty, w których ma transport (D-10); KSH REVENUE i BOTH, tylko projekt, którego jest klientem. Zapis bez zmian: wyłącznie RPC HHL (`sefs_save_parameters` przyjmuje `applies_to`, inna wartość = odmowa). Interfejs: HHL — pole „Zakres wersji” w formularzu SEFS; KSH i przewoźnik — panel „Dopłata paliwowa SEFS — parametry” (tylko odczyt) w Ustawieniach. `tests/db/i2.sh` **184/184** (+14: przewoźnik widzi v3 COST i v6 BOTH uzgodnione, nie widzi REVENUE ani nieuzgodnionej COST; KSH widzi BOTH i REVENUE, nie widzi COST; INSERT/UPDATE/RPC przewoźnika odrzucone; przewoźnik bez transportu w projekcie 0), unit **437** passed (`i13-sefs-scope` 2/2), lokalny Supabase `i13-sefs.local` **2/2**, `i2-facade.local` **12/12** | — |
| I-12 | Etap I — cennik: pozycja STANDARD (D-8 wariant A) | **DONE** 27.09.2026 | (ten wpis) | migracja **0064** (produkcja: TAK; najpierw transakcja wycofana; cenniki na produkcji: 0): `rate_rules.cargo_class` DIMENSIONED (domyślnie) / STANDARD, najwyżej jedna pozycja STANDARD na cennik (koszt i przychód to osobne cenniki `rate_cards.side`). `rate_match(cennik, transport)` (tylko HHL): wszystkie pozycje transportu STANDARD → pozycja STANDARD (stała stawka, wymiary bez znaczenia); brak → `NO_STANDARD_RATE` z komunikatem „Brak stawki STANDARD w cenniku (koszt/przychód) — wycena wstrzymana, to nie jest zero”, `base_rate` NULL; wymiarowy → przedział wymiarów (pozycja STANDARD pominięta), `NO_BRACKET` / `AMBIGUOUS` / `NO_DIMENSIONS`; mieszany → `MIXED_CARGO`. Silnik referencyjny `src/lib/money/engine.ts`: `matchRateForCargo` + `rateWarningKey` (teksty `i12_warn_*` PL/EN/SV). Paliwo i kurs — ten sam mechanizm (`buildPriceSide`, `assertSameMechanism`). Test mechanizmu na stawkach TESTOWYCH 1000 / 1300 EUR (nie z cennika): mnożnik 1,04 po obu stronach → paliwo 40 / 52 EUR, marża 312 EUR, ta sama tabela NBP. **Kwot nie wpisano (D-1)** — cennika na produkcji nie ma; wpisanie stawek wymaga D-1 (i drogi zapisu dla HHL — dziś RLS bez polityk, tylko SQL). `tests/db/i2.sh` **196/196** (+12), nullguard **219/219**, unit **440** passed (`i12-standard-rate` 3/3) | D-1: kwoty stawek STANDARD (koszt i przychód). |
| O-V3 | wdrożenie Vercel `a14a2ac` (I-16, I-15, I-13, I-12) | **DONE** 27.09.2026 | `a14a2ac` | **0** × service_role (index + chunki); tower.log-mar.pl 200, watch-tower-makieta.vercel.app 200 | — |
| I-9 | SCOPE.md = plik koordynatora | **DONE** 27.09 (ten commit) | — (docs) | — | §0–55 dosłownie z pliku koordynatora; dopiski wykonawcy: 16.3 zastąpiona przez I-18, dzienniki odłożeń/blokad; nowa §56 (numer 53 zajęty przez koordynatora): stare tabele 0–11 i dawny §39 przeniesione w całości (56.2, 56.3) |
| I-11 | mapa SCOPE → PLAN | **DONE** 27.09 (ten commit) | — (docs) | — | §56.1: 65 pozycji spoza GOTOWE → GOTOWE 8 · częściowo 26 · do zrobienia 9 · zablokowane 10 · odłożone 7 · do potwierdzenia 5; nowe pozycje PLAN: I-19 (cennik HHL, P1), I-20…I-24, III-2…III-9, D-13…D-15 |
| I-19 | formularz cennika HHL | **DONE** 27.09 (ten commit) | 0065 (produkcja: nałożona) | i2 226/226 (+30), nullguard 229/229, security 83/83, vitest 444, e2e i19 2/2, domyślny 12/12 | `rate_card_save` — tylko HHL; każda zmiana = nowa wersja (projekt, strona, organizacja) z kompletem pozycji; COST → przewoźnik, REVENUE → klient; najwyżej 1 STANDARD; przedziały liczone włącznie — nakładanie odrzucane (inaczej rate_match = AMBIGUOUS); powód wymagany od v2; rate_cards/rate_rules tylko do dopisywania; dziennik RATE_CARD_VERSION (stara/nowa wersja z pozycjami); RLS: czyta tylko HHL. UI: Opcje → „Cennik HHL — koszt i przychód” (PL/EN/SV). Produkcja: 0 cenników — kwoty wpisuje właściciel (D-1) |
| I-14 | jedno źródło dopłaty paliwowej | **DONE** 27.09 (ten commit) | 0066 (produkcja: nałożona) | gate: i2 226/226, security 83/83 | parametry tylko w `sefs_parameters`, odczyty tylko w `fuel_index_readings`; nieużywane `baf_definitions` i `baf_index_values` (0 wierszy) oraz `rate_cards.baf_id` usunięte; strażnik: przy jakichkolwiek danych migracja przerywa się bez usuwania |
| III-1 (szkielet) | raport kalibracji odcinków ETA | **SZKIELET** 27.09 (ten commit) | — | samotest syntetyczny: PL_ROAD 9,0 h vs 7,5 h → PROPOZYCJA; reszta bez zmian; produkcja: n = 0 | odcinki z GEOFENCE_ENTER/EXIT: PL_ROAD, PORT_CHECKIN, CROSSING, SE_TOTAL (= SE_ROAD + SE_BREAKS + SE_DAILY_REST); mediana, p10–p90, min–max, odchylenie; propozycja tylko przy n ≥ 5 i odchyleniu > 10%; zatwierdza HHL osobną migracją. Prawdziwe dane po 5 transportach pilotażu |
| I-3 (część bazowa) | bramka SMS — baza | **DONE** 27.09 (ten commit) | 0067 (produkcja: nałożona; cron `tower-sms-straznik` co minutę); send-notifications wdrożona (szablony SMS_FALLBACK, SMS_GATEWAY_SILENT) | i2 265/265 (+39), nullguard 249/249, security 83/83 | według PROPOZYCJA_SMS §3: `sms_devices` (token tylko SHA-256, limit 150/dobę, pauza), `sms_outbox` (CHECK: zakaz cen, ≤ 306 znaków), `sms_heartbeats`; telefon wywołuje tylko `sms_pull`/`sms_report`/`sms_heartbeat` (anon + token urządzenia, 20 wywołań/min, bez podwójnego wydania, przejścia tylko do przodu); `issue_driver_token_sms` = token + SMS w jednej transakcji; wyzwalacze WINDOW_CHANGE (≥ 30 min), SAILING_CHANGE, SAILING_CANCELLED, LOAD_CANCELLED tylko przy aktywnym linku; szablony PL bez polskich znaków (GSM-7, ≤ 160 znaków), język z `loads.driver_locale` albo prefiksu; strażnik: cisza > 15 min → JOB_FAILURE HIGH + e-mail HHL, SMS > 10 min lub FAILED → e-mail zastępczy, EXPIRED, link usuwany z treści po 24 h, retencja 90 dni. Przyjęte z zaleceń propozycji (do potwierdzenia przez właściciela): bez ogonków, limit 150, SMS 1–5 teraz. Telefonu brak (D-4) — produkcja: 0 urządzeń, 0 SMS |
| O-V4 | wdrożenie Vercel `04b1505` (I-19 formularz cennika, etykieta bramki SMS w ryzykach) | **DONE** 27.09 | — | — | tower.log-mar.pl i watch-tower-makieta.vercel.app: 200; 0 × service_role w index i 22 chunkach; chunk `RateCardForm` obecny |
| I-3 UI + R-2 | bramka SMS w UI i blokada wiadomości zewnętrznych | **DONE** 28.09 (ten commit) | 0068 (produkcja: nałożona, `EXTERNAL_MESSAGING` = wyłączone) | i2 279/279 (+14), nullguard 269/269, vitest 444, PL-T 4/4, e2e i3-sms 1/1, domyślny 12/12 | przed R-2: e-mail spoza log-mar.pl → status BLOCKED_R2 (send-notifications wysyła tylko PENDING; także po próbie UPDATE), telefon pobiera wyłącznie SMS TEST na numery z `sms_test_numbers`; włącza tylko HHL_ADMIN (`admin_set_external_messaging`, wpis w audit_log). Produkcja 28.09: 0 urządzeń, 0 numerów testowych, 0 telefonów kierowców, 0 kont spoza log-mar.pl. UI: przycisk „Wyślij link SMS-em” (szuflada transportu), panel „Bramka SMS” (Opcje HHL) |
| I-3 P0 (SMS 8, 9, sekret) | rodzaje pilotażu 1–5, 8, 9 (ZLECENIE_ETAP_I I-3); link z tokenem nigdy w `sms_outbox.body` | **DONE** 28.09 (ten commit) | 0069 (produkcja: nałożona; cron `tower-sms-rozladunek` */10) | i2 293/293 (+14), nullguard 269/269, backup 23/23 (+1), import 48/48, vitest 444 | CHECK `kind` + GPS_SILENT, UNLOAD_CONFIRM (szablony PL bez ogonków, ≤ 160 zn.). SMS 8: nowe ryzyko SILENT_VEHICLE, transport w ruchu (bez FERRY), aktywny link, maks. 1 na 3 h, minuty od ostatniej pozycji. SMS 9: AT_SITE ≥ 2 h bez MILESTONE_UNLOADED (rozładunek ustala datę usługi i kurs faktury), 1 na transport. Sekret: pełna treść w `sms_outbox_secret` (RLS, brak grantów; HHL: permission denied), `sms_pull` podaje ją telefonowi, wyzwalacz kasuje ją, gdy status opuszcza QUEUED/CLAIMED (test: po SENT 0 wierszy); HHL `select body` = 0 wierszy z `wt_`/URL; e-mail zastępczy bierze `body` bez linku; `backup-export` pomija `sms_outbox_secret` (wdrożona). Test I-10 w import.sh dostosowany do BLOCKED_R2 (0068). Gate wykrył skutek 0068 w money.sh: opłacona faktura nie anulowała przypomnienia BLOCKED_R2 — poprawione migracją 0071 (anuluje PENDING i BLOCKED_R2; produkcja: nałożona), money 130/130. |
| ETA §57 | opóźnienie od końca dnia dostawy w Europe/Stockholm | **DONE** 28.09 (ten commit) | 0070 (produkcja: nałożona; 0 transportów w toku do przeliczenia) | i2 +2, vitest `time.test.ts` 10/10 | Było: `delay_minutes` od końca okna `plan_delivery_to` (np. 16:00), w UI demo od południa. Jest: zawsze od północy po dniu dostawy (`load_delivery_day_end`, lato +02, zima +01); UI `delayMinutesVsPlan` tak samo. |
| D-13 | stan paneli (28.09) | **ZAMKNIĘTE** (zastąpione) | — | — | Vercel: adresy wdrożeń `*-sebastianbozekq-7781s-projects.vercel.app` → 302 na `vercel.com/sso-api` (Vercel Authentication aktywne); zmienne Supabase tylko w środowisku Production → podgląd = tryb demo; wdrożenia wyłącznie ręczne `--prod` (brak podglądów na liście). Pages: `preview_deployment_setting` = none (odczyt API 27.09 11:38); aliasy gałęzi `*.tower-hhl.pages.dev` → 404. Ponowny odczyt ustawień Pages z API — przy następnym logowaniu do Cloudflare (akcja właściciela, bez logowania teraz). |
| D-15 | limity ponadnormatywności PL i SE | **ZEBRANE** 28.09, do potwierdzenia z przewoźnikiem | — | — | `docs/handover/LIMITY_PONADNORMATYWNOSC.md`: PL — rozp. MI Dz.U. 2024 poz. 502 § 2, § 3 ust. 1 (brzmienie sprawdzone 28.09), § 5 ust. 1, PoRD art. 61, 64–64d; SE — Trafikförordning 1998:1276 4 kap. 12, 13, 15, 17 §§, 13 kap. 3 § (dispens). |
| O-V5 | wdrożenie Vercel `63ea178` (UI bramki SMS, „Wyślij link SMS-em”, opóźnienie od końca dnia dostawy) | **DONE** 28.09 | — | — | tower.log-mar.pl i watch-tower-makieta.vercel.app 200; 0 × service_role w index i chunkach; „Wyślij link SMS-em” w paczce produkcyjnej. |
| I-20 | ogólny dziennik audytu (SCOPE 2.6) | **DONE** 28.09 (ten commit) | 0072 (produkcja: nałożona, 7 wyzwalaczy) | i2 +10 | loads, shipment_items, invoices, invoice_lines, rate_cards, rate_rules, sefs_parameters → audit_log ROW_*; UPDATE tylko ze zmienionymi kolumnami, bez wpisu przy samym przeliczeniu ETA (eta_*, delay_minutes, updated_at); `driver_name`/`driver_phone` jako „[dane osobowe]” (retencja 90 dni nie obejmuje dziennika); KSH nie widzi dziennika. |
| I-21 | terminy zasobów przed załadunkiem i eskalacja (SCOPE 4.3) | **DONE** 28.09 (ten commit) | 0073 + 0074 jawne klucze rk_res_* + 0075 odczyt terminów tylko dla aktywnego konta (test session) (produkcja: nałożone; cron `tower-zasoby` 7,22,37,52) | i2 +13, `risk-keys` 14/14 | Terminy w tabeli `resource_deadlines` (propozycja 48/12 h kierowca i pojazd, 24/6 h dokumenty — **do potwierdzenia z SCX, II-3**). Ryzyko RESOURCE_MISSING (rule RESOURCE_DEADLINE, widzi HHL + przewoźnik, klient nie), eskalacja HIGH → CRITICAL na tym samym ryzyku, IN_APP RESOURCE_DEADLINE (szablon PL/EN/SV, send-notifications wdrożona), zamknięcie po uzupełnieniu albo po wyjeździe na załadunek. |
| I-23 | odsiewanie duplikatów powiadomień (SCOPE 9.8) | **DONE** 28.09 (ten commit) | — | vitest `notify-dedup` 12/12, i2 +2 | 10 miejsc INSERT w bazie, wszystkie z dedup_key i on conflict do nothing; szablony: INVOICE_NEW, ORDER_NO_MISSING, PAYMENT_REMINDER, PLAN_DATES_CHANGED, RESOURCE_DEADLINE, SCHEDULE_DATE_CRITICAL, SMS_FALLBACK, SMS_GATEWAY_SILENT. |
| D-15 (uzup.) | § 3 ust. 1 rozporządzenia — brzmienie sprawdzone | 28.09 | — | — | 40 t (≥ 5 osi), intermodal 42/44 t (pkt 2 lit. a–d), 4-osiowy członowy 36/38 t (pkt 6); naciski osi przeniesione do właściwego § 5 ust. 1 (10 t / 11,5 t). SCOPE §57/§58: pierwsze litery treści poprawione na dosłowne. |
| I-24 | eksport harmonogramu do PDF (SCOPE 10.8) | **DONE** 28.09 (ten commit) | — | vitest `pdf-export` 3/3 (350 transportów → ≥ 10 stron, polskie znaki w tytule), e2e `tests/i24-pdf.local.spec.ts` 1/1, domyślny 12/12, vitest 459 | `data-action="export-pdf"`; czcionka `public/fonts/LiberationSans-Regular.ttf` (SIL OFL 1.1, licencja obok) pobierana dopiero przy eksporcie; nowe zależności pdf-lib, @pdf-lib/fontkit. Kolumny: kod, typ, status, daty, ETA Boden, tablice, prom — bez kierowcy/telefonu i kwot (plik do przekazania dalej). |
| O-V6 | wdrożenie Vercel `db3d5e3` (Eksport PDF, teksty ryzyk zasobów I-21) | **DONE** 28.09 | — | — | tower.log-mar.pl i watch-tower-makieta.vercel.app 200; `/fonts/LiberationSans-Regular.ttf` 200; 0 × service_role w index i chunkach. |
| SEC-1 (§1.5) | eksport XLSX i dane kierowcy per rola — **WYCIEK POTWIERDZONY I NAPRAWIONY** | **DONE** 28.09 (ten commit) | 0076 (produkcja: nałożona; `authenticated` bez SELECT `driver_phone`/`driver_name`, anon bez SELECT loads) | i2 325/325 (+7), nullguard 274/274 (+5), vitest 463 (`xlsx-export-roles` 4/4), e2e build produkcyjny `tests/xlsx-roles.local.spec.ts` 3/3 (HHL/KSH/SCX), domyślny 12/12, i3-sms 1/1 | **Dowód przed poprawką (lokalny Supabase, konto KSH CLIENT_ADMIN):** `select driver_phone from loads` → telefon kierowcy widoczny (1/50 transportów z telefonem = 1 widoczny), bez reguły ±24 h (D6 była tylko w UI); XLSX dla KSH i SCX miał kolumny Koszt/Przychód/Marża (wartości 0 z widoków rolowych — ceny w bazie były szczelne) oraz Kierowca/Telefon; nagłówki `_PLN` przy kwotach w EUR. **Po:** dane kierowcy tylko przez `load_driver_contacts()` (HHL — wszystkie; przewoźnik — własne; klient — sam telefon w ±24 h od dostawy; inni — nic); XLSX: HHL wszystko, KSH `Cena_EUR` + telefon wg D6 (bez kosztu, marży, imienia), SCX `Koszt_EUR` + kierowca (bez przychodu, ceny, marży); waluta z danych (EUR). Produkcja przed poprawką: 0 telefonów kierowców i tylko HHL aktywny — brak faktycznego ujawnienia. Vercel `baae4a8` wdrożony zaraz po migracji (obie domeny 200, 0 × service_role, `load_driver_contacts` w paczce, brak `driver_name,driver_phone` w zapytaniu loads). |
| O4 | Oznaczenie demo zostaje do potwierdzenia | **DONE** (potwierdzenie właściciela: W-O4) | d1895be | etap6 **1/1** (nowy `npm run test:etap6`, w fresh-smoke) · D24 #8 (Trafikverket=demonstracyjne) · `tests/demo-label.test.ts` w unit | Oznaczenia **zostają** bez zmian w kodzie: `DemoMark` przy stawkach i opłacie paliwowej (Opcje ×2, Finanse ×1), panel warunków drogowych SE w Ryzykach `data-demo=trafikverket` + nota „demonstracyjne” (M12 `road-se` gotowy, przełączy się po kluczu Trafikverket — AN2/D3). Oznaczenia domyślnie włączone; przełącznik w Opcjach je ukrywa/przywraca (test). **Krok właściciela W-O4:** potwierdzić prawdziwe stawki i parametry opłaty paliwowej → dopiero wtedy zdjąć oznaczenie; założyć klucz Trafikverket (i TomTom) → panel SE na żywo. |
| O5 | `RAPORT_KONCOWY.md` + tag `release-1.0` | OPEN | — | — | pending |

---

## Poza zakresem (otwarte — nie pomijać)

| temat | status | uwagi |
|---|---|---|
| Adapter telematyki SCX | OPEN | czeka na nazwę systemu + API |
| Parametry operacyjne od przewoźnika | OPEN | cutoff promu, progi fal, prędkość HHL |
| Geometria trasy z zezwolenia | OPEN | czeka na zezwolenia z trasą |
| Klucz Trafikverket | OPEN | SE road demo do czasu klucza · **AN2 (D3):** panel warunków drogowych SE przechodzi na Trafikverket (M12 `road-se`), **gdy właściciel założy klucz** — do tego czasu bez zmian |
| Źródło statusu promów Polferries | ROZSTRZYGNIĘTE (AN2) | komunikaty armatora (`src/lib/ferry/polferries.ts`) + AIS Digitraffic — `ZRODLA_DANYCH.md`; wdrożenie w M12 |
| Rozbicie marży na 3 poziomy | **ZAMKNIĘTE (AN1)** | zgoda w Aneksie 1 → pozycja **M11** |
| GitHub Actions rozliczenia + `unit.yml` | ODŁOŻONE (AN1) | bramą zostaje `.githooks/pre-push`; `tests/db/run.sh` ręcznie |

---

## Licznik wierszy ID

- Wymagane §12: **51** + Aneks 1 (AN1, M10, M11) + Aneks 2 (AN2, M12) = **56**; Aneks 3 (AN3, 2.1–2.4, PL-T) + Aneks 4 (AN4, PR1–PR8, release-1.0) = **+16 → 72**
- W tabelach etapów powyżej: **56** (P0×3 + F2/G1×7 + Etap2×14 + BK/G3×8 + Aneksy×2 + Etap4×14 + Etap5×3 + Etap6×5)
- L* po F2.5: **0** na razie (dopisać po F2.5)


## I-2i — pozycje „częściowo” działające tylko w demo (przegląd 27.09.2026)

| SCOPE | Co działało tylko w demo | Produkcja po I-2 | Dalej |
|---|---|---|---|
| 5.12 | ETA liczona w przeglądarce ze statusu | ETA v1 w bazie (0051) | parametry odcinków: decyzja 17.14 / II-3 |
| 7.4 | notowania paliwa (atrapa w Opcjach/Finansach) | formularz odczytów ze źródłem (0052), bez zadania pobierania | II-1 (D-2) |
| 9.3 / 9.4 | 12 reguł i „Uruchom” bez ewaluacji | moduł ukryty | Etap III — silnik Workflows |
| 8.4 | przeprawy alternatywne, objazdy SE (statyczne) | „brak źródła danych” | II-6 / Etap III |
| 8.1 | pogoda i fala (statyczne) | „brak źródła danych” | Etap III — źródło pogody |
| 10.7 | kafelek „czas wykrycia 8 min” | ukryty | **I-2l** |
| 6.4 / 6.5 | numer PL/2026/14xx i „zezwolenie zgodne” | stan z dokumentów: wgrane / brak / niewymagane (STANDARD), bez deklaracji zgodności | Etap III — walidator zezwoleń |
| 6.6 | przypomnienie o polisie OCP | ukryte | Etap III (C4) |
| 5.10 | pozycje promów AIS na mapie | ukryte | **I-2j** |
| 6.8 | paczka „tygodnia” pakuje całą listę | działa tak samo w obu trybach — błąd, nie fasada | **I-2k** |
| — | oferta factoringu, cennik w Opcjach (zapis w przeglądarce) | ukryte / „brak źródła danych — B1” | D-1 |

Pozostałe 26 pozycji „częściowo” nie zależą od trybu demo (braki infrastruktury, testów, dokumentacji) — zostają w SCOPE i trafią do kolejki w I-11.
| I-22 | kreator mapowania kolumn importu + szablony w bazie (HHL) | **DONE** 28.09 (ten commit) | 0077 (produkcja: nałożona) — `import_column_templates` (unikalny podpis nagłówków w projekcie, RLS odczyt tylko HHL, zapis tylko przez RPC `import_template_save`: HHL, walidacja pól, wymagane nr przesyłki + ilość, upsert po podpisie, wpis `audit_log` IMPORT_TEMPLATE_SAVE) | i2 333/333 (+8), nullguard 279/279 (+5), session 27/27, vitest 467 (`import-mapping` 4/4), e2e build produkcyjny `tests/i22-colmap.local.spec.ts` 1/1 (nieznany układ → kreator → zapis szablonu → podgląd → import), domyślny 12/12 | Nieznany układ pliku otwiera krok mapowania (sugestie z nazw nagłówków); zapisany szablon rozpoznawany automatycznie przy kolejnym imporcie (toast, bez kreatora). Tryb demo: szablony w localStorage. KSH/SCX nie widzą ani nie zapisują szablonów. |
| O-V7 | Vercel produkcja po I-22 | **DONE** 28.09 | commit `703a387` wdrożony (Ready) | tower.log-mar.pl 200, watch-tower-makieta.vercel.app 200, 0 × service_role (index + chunki, także zagnieżdżone), `import_template_save` w chunku `scheduleImportServer` | — |
| III-3 (część) + kontrola nullguard | testy bazy tylko lokalnie, wycofanie zapisów, workflow CI | **CZĘŚCIOWO** 28.09 (ten commit) | — | nullguard 280/280 (+1: migawka audit_log/szablony/loads/faktury/powiadomienia przed i po wywołaniach — bez zmian), próba z adresem poolera Supabase i obcym hostem → ODMOWA, kod 2 | **Sprawdzone:** nullguard tworzy własną bazę tymczasową `tower_test_nullguard` na lokalnym Postgresie (drop/create database), każde wywołanie w `begin … rollback`; zapis HHL (np. `import_template_save`) nie zostaje. **Dodane:** `tests/db/local-only.sh` wczytywany przez wszystkie 14 skryptów `tests/db/*.sh` — odmowa, gdy host PGADMIN nie jest lokalny lub adres wygląda na Supabase w chmurze. **Workflow CI** `docs/ci/db.yml` gotowy; push do `.github/workflows/` odrzucony (token bez uprawnienia `workflow`) — do przeniesienia przez właściciela; Actions i tak wymaga rozliczeń (SCOPE 26.2). Osobny projekt Supabase = koszt → decyzja właściciela. |
| III-6 | dokumenty: wymagalność i terminy per kategoria w bazie, wersje, widoczność per organizacja (SCOPE 6.1, 6.2) | **DONE** 28.09 (ten commit) | 0078 (produkcja: nałożona, 7 wymagań startowych) — `doc_requirements` (projekt × kategoria: wymagany, strona odpowiedzialna, zdarzenie odniesienia, przesunięcie h; odczyt: aktywne konto; zapis tylko `doc_requirement_set` — HHL, audit_log ze starą wartością; wyzwalacz zakłada wymagania dla nowego projektu), `doc_requirements_status()` (security invoker: transport × kategoria wymagana → termin, OK/MISSING/OVERDUE), `documents.supersedes/superseded_at` + `document_supersede` (tylko autor nowego pliku w ciągu 1 h, ten sam transport i kategoria, audit_log), `docs_scope`: dokument bez transportu wgrany przez przewoźnika niewidoczny dla innego przewoźnika | i2 353/353 (+20), nullguard 295/295 (+15), session 27/27, security 83/83, vitest 472 (`doc-requirements` 2/2, `doc-versions` 3/3), e2e build produkcyjny `tests/iii6-docs.local.spec.ts` 2/2 (HHL zmienia termin CMR → zapis w bazie + audit_log, licznik „po terminie” = baza; KSH bez przycisku zmiany), domyślny 12/12 | Widok Dokumenty: kolumny „Wymagany / termin” i „Po terminie” z bazy, HHL zmienia wymagalność i godziny w wierszu. Nowy plik tej samej kategorii transportu = nowa wersja (zdjęcia mocowania bez wersji), zastąpione poza sejfem, znacznik „wersja N”. **Decyzja do potwierdzenia z SCX/KSH:** terminy startowe — zezwolenie PL 24 h przed załadunkiem, zezwolenie SE 24 h przed promem, CMR i zdjęcia do 2 h po załadunku, POD do 24 h po rozładunku, rysunek KSH 72 h przed załadunkiem, polisa — dokument organizacyjny. |
| III-7 | pełna ścieżka sporu i akceptacji faktury (SCOPE 7.10) | **DONE** 28.09 (ten commit) | 0079 (produkcja: nałożona; `send-notifications` wdrożona z szablonami sporu) — `invoice_dispute_events` (OPENED / REPLY / CORRECTION / RESOLVED / WITHDRAWN; odczyt: strony faktury i HHL; zapis tylko wyzwalaczem i RPC), wyzwalacz po zmianie `verification_status` (wpis + powiadomienie wystawcy INVOICE_DISPUTED / INVOICE_DISPUTE_RESOLVED, dedup_key), `invoice_dispute_reply` (tylko wystawca, tylko faktura SPORNA, opcjonalnie dokument korekty; powiadomienie odbiorcy INVOICE_DISPUTE_REPLY; audit_log), `mark_invoice_paid`: faktura kosztowa w sporze — zapłata wstrzymana | i2 371/371 (+18), nullguard 300/300 (+5), money 130/130, release 145/145, vitest 475 (`invoice-dispute` 2/2, szablony PL/EN/SV), e2e build produkcyjny `tests/iii7-dispute.local.spec.ts` 3/3 (KSH spór → HHL widzi i odpowiada, KSH dostaje powiadomienie → KSH akceptuje, historia OPENED,REPLY,RESOLVED; HHL: „Opłacona” wyłączona dla faktury kosztowej w sporze), domyślny 12/12 | Szczegóły faktury: „Historia sporu” (kto, kiedy, krok, treść) i pole odpowiedzi dla wystawcy. Korekta z dokumentem — obsługiwana w bazie (CORRECTION), w UI dziś odpowiedź tekstowa. |
| O-V8 | Vercel produkcja po III-6 i III-7 | **DONE** 28.09 | `bc31ac1` (III-6), potem `d0eb99f` (III-7) wdrożone | tower.log-mar.pl 200, watch-tower-makieta.vercel.app 200, 0 × service_role (index + chunki, także zagnieżdżone); `doc_requirements_status` i `invoice_dispute_reply` w chunkach leniwych (paczka demo bez nich — test i2-demo-no-send) | — |
| I-25 (P0) | cofnięcie reguły opóźnienia z 0070 (błąd w komunikacie koordynatora) | **DONE** 28.09 (ten commit) | 0080 (produkcja: nałożona po teście w wycofanej transakcji: okno 08–12 / ETA 18:00 → 360) — `load_delivery_deadline(dzień, plan_delivery_to)` = koniec okna, a bez okna północ po dniu dostawy (Europe/Stockholm); `refresh_load_eta` liczy od niego; przeliczenie transportów w toku | i2 373/373 (+2: akceptacja 360 \| 0 \| 360 i północ lato/zima; przeliczenie na transporcie z oknem), import 49/49 (+1: import nie ustawia okna dostawy ani załadunku), vitest 476 (`time.test.ts`: te same 3 przypadki + ETA przed końcem okna — funkcja UI `delayMinutesVsPlan` z oknem), domyślny e2e 12/12 | W produkcji UI pokazuje `loads.delay_minutes` z bazy (`delayPillMinutes`), w demo — `delayMinutesVsPlan` z tą samą regułą, więc baza i UI liczą identycznie. Okno pochodzi wyłącznie od KSH (0061). `import_schedule` zapisuje tylko `plan_load_date` i `plan_delivery_date`, a godzina z pliku nie tworzy okna. SCOPE §57: zdanie o opóźnieniu zastąpione dosłownie. |
| III-3 — decyzja | gdzie uruchamiać testy bazy | **DECYZJA** 28.09 | — | — | **Wybrano: lokalny Postgres/Supabase w samej kontroli kodu** — hook pre-push uruchamia pełne `tests/db/gate.sh` (14 zestawów, każdy na własnej bazie tymczasowej), a `tests/db/local-only.sh` odmawia pracy na hoście innym niż lokalny. **Odrzucono:** (a) drugi projekt Supabase — zająłby ostatni darmowy slot i usypia się po 7 dniach bezczynności, a PLAN §1.4 zakazuje zakładania projektów i włączania rozliczeń; (b) GitHub Actions — wcześniej runner nie startował z powodu rozliczeń (SCOPE 26.2), a token agenta nie ma uprawnienia `workflow`. `docs/ci/db.yml` zostaje jako gotowy wariant na przyszłość, bez sekretów i bez chmury Supabase, jeśli właściciel włączy Actions. Żadne nowe płatne ani chmurowe zasoby nie zostały utworzone. |
| O-V9 | Vercel produkcja po I-25 | **DONE** 28.09 | commit `e5849f9` wdrożony | tower.log-mar.pl 200, watch-tower-makieta.vercel.app 200, 0 × service_role (index + chunki, także zagnieżdżone) | Pytania o terminy dokumentów (III-6) i zasobów (I-21) dopisane do II-3 w PLAN. |
| SEC-2 + walidator 6.5 | walidator zezwoleń i wymiarów zestawu; szczelność `permits` | **DONE** 28.09 (ten commit) | 0081 (produkcja: nałożona; anon bez SELECT permits, polityka `permits_read`) | i2 388/388 (+15), nullguard 316/316 (+15), security 83/83, storage 37/37, release 145/145, vitest 476, e2e build produkcyjny `tests/permit-validator.local.spec.ts` 1/1, domyślny 12/12 | **Znalezione (bezpieczeństwo/poprawność):** (1) `permits` miało RLS bez żadnej polityki, a anon i authenticated miały pełne uprawnienia tabelowe (INSERT/UPDATE/DELETE/TRUNCATE). RLS blokowało wiersze, więc nie było wycieku ani zapisu, ale tabela była bezużyteczna, a uprawnienia nadmiarowe. Teraz anon nie ma nic, authenticated ma tylko SELECT, odczyt przysługuje HHL i stronom widzącym powiązany transport, a zapis idzie wyłącznie przez RPC `permit_save` / `load_permit_link` (HHL albo przewoźnik transportu, audit_log). (2) `permit_fits` liczył nieznany wymiar zestawu jako 0, czyli „pasuje”. Teraz to naruszenie DIMS_UNKNOWN. **Blokada:** transport z powiązanym niezgodnym zezwoleniem nie przejdzie z PLANNED/RESOURCES_PENDING/DOCS_PENDING do READY ani dalej (komunikat z krajem, numerem i naruszeniem). Brak zezwolenia PL/SE jest sygnalizowany w `load_permit_status.missing_countries`, ale nie blokuje, bo produkcja nie ma jeszcze zezwoleń w bazie. UI: baner „Zezwolenie niezgodne z zestawem” w szufladzie, `permitFits` z bazy. **Otwarte:** formularz zezwoleń w UI (SCOPE 6.4). |
| O-V10 | Vercel produkcja po walidatorze 6.5 | **DONE** 28.09 | commit `67e5bc7` wdrożony (Ready, 04:33) | tower.log-mar.pl 200, watch-tower-makieta.vercel.app 200, 0 × service_role (index + chunki, także zagnieżdżone), `load_permit_status` w chunkach | Pierwsza próba `vercel --prod` zwróciła „Not authorized” (przejściowo, `whoami` poprawne), a ponowienie przeszło. |
| III-7 (luka UI) | korekta faktury z załączonym dokumentem | **DONE** 28.09 (ten commit) | 0082 (produkcja: nałożona po próbie w wycofanej transakcji) — `invoice_documents.role` + KOREKTA (KSH widzi ją w module faktur), `invoice_dispute_reply(…, p_document)`: plik musi być świeży (≤ 24 h), wgrany przez tę samą osobę, INVOICE bez transportu, z projektu faktury i niepowiązany z żadną fakturą; po zapisie łączony z fakturą jako KOREKTA | i2 400/400 (+12: cudzy plik / plik innej faktury / ponowne użycie → odmowa; SCX korekta → CORRECTION + KOREKTA + audit_log; KSH przed wysłaniem nie widzi pliku HHL, po wysłaniu widzi; SCX nie widzi korekty faktury HHL → KSH; KSH nie widzi korekty SCX → HHL), nullguard 316/316, money 130/130, storage 37/37, vitest 477 (`invoice-dispute` +1: tylko PDF ≤ 10 MB), e2e build produkcyjny `tests/iii7-dispute.local.spec.ts` 3/3 (HHL załącza PDF → wpis „korekta wystawcy” z plikiem; KSH otwiera plik linkiem podpisanym — 200, `%PDF`), fresh-smoke 12/12 i reszta zielona, i2-demo-no-send 5/5 | **Znalezione:** przed 0082 dokument korekty (wgrany przez wystawcę) był widoczny tylko dla autora, więc odbiorca nie mógł otworzyć pliku z wpisu CORRECTION. UI: przycisk „Załącz korektę (PDF)” obok odpowiedzi, a po wyborze pliku przycisk zmienia się na „Wyślij korektę”. W historii sporu przy wpisie pojawia się „Plik korekty: nazwa”. Tryb demo: plik trzymany w sesji. Przy odrzuceniu przez bazę plik jest usuwany ze Storage i z `documents`. |
| I-26 (P1, bezpieczeństwo) | anon bez uprawnień do tabel i sekwencji w `public`; authenticated bez TRUNCATE/REFERENCES/TRIGGER | **DONE** 28.09 (ten commit) | 0083 (produkcja: nałożona po próbie w wycofanej transakcji) — odebranie wszystkich uprawnień anon do tabel/widoków/sekwencji `public` (poza `spatial_ref_sys`), TRUNCATE/REFERENCES/TRIGGER od authenticated, `ALTER DEFAULT PRIVILEGES` dla postgres (tabele i sekwencje) | security 88/88 (+5: anon 0 uprawnień tabel, anon 0 sekwencji, authenticated 0 × TRUNCATE/REFERENCES/TRIGGER, nowa tabela/sekwencja bez uprawnień anon i bez TRUNCATE dla authenticated, INSERT anon do loads → permission denied), cała brama 14/14 (release 145/145: przebieg kierowcy z tokenem jako anon — pozycja, zdarzenie, instrukcje), lokalny Supabase, build produkcyjny: `i2-facade.local` 12/12 (w tym I-4 PWA kierowcy z linku i I-6 `report_client_error` jako anon) + `iii7-dispute.local` 3/3 | **Stan produkcji przed 0083:** anon miał pełne INSERT/UPDATE/DELETE/TRUNCATE na 22 tabelach (documents, geofences, insurance_policies, integration_runs, invoice_documents, invoice_lines, invoices, load_events, load_messages, organizations, payment_terms, positions, projects, risk_signals, sailings, shipment_items, user_preferences, vessels, workflows; na loads INSERT/UPDATE/TRUNCATE), SELECT na app_users i eta_segment_params, USAGE na 15 sekwencjach. Zatrzymywało go tylko RLS; TRUNCATE RLS nie obejmuje, ale PostgREST go nie udostępnia, więc nie było drogi wykorzystania z API. authenticated miał TRUNCATE na 29, a REFERENCES/TRIGGER na 38 tabelach — nadmiarowe, odebrane. **Po 0083 (produkcja):** anon 0 uprawnień tabelowych poza spatial_ref_sys (chroni go wyzwalacz 0031) oraz widokami PostGIS `geometry_columns` / `geography_columns`. Te widoki należą do supabase_admin, więc migracja (postgres) ich nie zmieni; to metadane katalogu, a zapis blokują reguły DO INSTEAD NOTHING. Sekwencje anon: 0. authenticated TRUNCATE/REFERENCES/TRIGGER: 0. `keep_alive` jako anon działa; `driver_get_instructions` dochodzi do sprawdzenia tokenu (na produkcji 0 transportów — pełny przebieg sprawdzony lokalnie). **Otwarte (poza zakresem):** domyślne uprawnienia supabase_admin w `public` nadal nadają anon wszystko na nowych obiektach tego właściciela. Tworzą je tylko rozszerzenia, bo migracje działają jako postgres, a zmiana wymaga członkostwa w supabase_admin. Schemat `storage` ma podobne domyślne uprawnienia — chroni go RLS Supabase Storage. |
| I-27 (P1, przed R-3) | brak zezwolenia blokuje „Gotowy” dla klasy ≠ STANDARD — przełącznik | **DONE** 28.09 (ten commit) | 0084 (produkcja: nałożona po próbie w wycofanej transakcji; flaga **wyłączona**) — `security_flags.PERMIT_REQUIRED_NON_STANDARD` (domyślnie false), `admin_set_permit_requirement(bool)` (tylko HHL_ADMIN, audit_log PERMIT_REQUIREMENT_SET), `permit_requirement_state()` (odczyt HHL), `load_needs_permit` (pozycja klasy ≠ STANDARD albo brak pozycji), `trg_loads_permit_gate`: przy włączonej fladze brak powiązanego zezwolenia PL lub SE → odmowa przejścia PLANNED/RESOURCES_PENDING/DOCS_PENDING → READY i dalej (komunikat z brakującymi krajami) | i2 416/416 (+16: domyślnie wyłączony i DIMENSIONED przechodzi; KSH/SCX nie włączają i nie widzą stanu; HHL_ADMIN włącza + audit_log; **DIMENSIONED bez zezwolenia nie osiąga READY** (HHL i przewoźnik); STANDARD bez zezwolenia przechodzi; tylko PL → „brak SE”; PL+SE zgodne → READY; brak pozycji = ponadnormatywny; wyłączenie), nullguard 326/326 (+10), security 88/88 (lista funkcji +2), e2e build produkcyjny `tests/i27-permit-toggle.local.spec.ts` 2/2 (HHL_ADMIN w Opcjach włącza i wyłącza → flaga i audit_log; KSH bez panelu) | **Działanie właściciela (PLAN §4, D-21):** przed pierwszym prawdziwym transportem wejdź w Opcje → „Wymóg zezwoleń (transporty ponadnormatywne)” → „Włącz wymóg”. Do tego czasu brak zezwolenia jest tylko sygnalizowany (`missing_countries`), a niezgodne zezwolenie blokuje zawsze (0081). |
| I-28 (P2) | usunięcie `load_delivery_day_end` | **DONE** 28.09 (ten commit) | 0085 (produkcja: nałożona) — `drop function if exists load_delivery_day_end(date, timestamptz)` | i2 417/417 (+1: funkcja usunięta, `load_delivery_deadline` zostaje) | Przed usunięciem sprawdzone: na produkcji 0 funkcji z odwołaniem w treści i 0 zależności `pg_depend`; w repozytorium poza 0070/0080 i dziennikiem 0 odwołań (aplikacja, Edge, testy). |
| O-V11 | Vercel produkcja po III-7 (korekta), I-26, I-27, I-28 | **DONE** 28.09 | commit `5e5776c` wdrożony (Ready) | tower.log-mar.pl 200, watch-tower-makieta.vercel.app 200, 0 × service_role (index + chunki, także zagnieżdżone), `admin_set_permit_requirement` i `p_document` (korekta) w chunkach leniwych | Migracje 0082–0085 nałożone na produkcję przed wdrożeniem, każda najpierw sprawdzona w wycofanej transakcji. Pierwsza próba `vercel --prod` znowu zwróciła „Not authorized”, a ponowienie przeszło. |
| SCOPE 6.4 | formularz zezwoleń w UI — HHL i przewoźnik transportu | **DONE** 28.09 (ten commit) | 0086 (produkcja: nałożona `supabase db push` po próbie w wycofanej transakcji: 2 nowe funkcje, anon bez EXECUTE, `search_path` ustalona, strażniki odmawiają dla nieznanego transportu; produkcja: 0 transportów, 0 zezwoleń) — `load_permit_save` (pola: kraj PL/SE, numer, organ, ważność od–do, maks. długość/szerokość/wysokość/masa — puste = bez limitu, pojazdy pilotujące 0–5, trasa ≤ 2000 zn.; zapis + powiązanie w jednej transakcji; HHL albo przewoźnik transportu; anulowany = odmowa; audit_log PERMIT_SAVE + PERMIT_LINK), `load_permit_unlink` (tylko przed READY — po READY odłączenie obchodziłoby blokadę 0081/0084; audit_log PERMIT_UNLINK), `permit_save`: przewoźnik tylko w projekcie, w którym ma transport | i2 436/436 (+19), nullguard 336/336 (+10), security 88/88 (lista funkcji +2), vitest 477, e2e build produkcyjny `tests/p64-permit-form.local.spec.ts` 2/2 (SCX dodaje PL 30 m do zestawu 32,5 m → „niezgodne · długość ponad limit”, baner w przeglądzie, w bazie organ/pilotaż/wysokość/powiązanie/audit_log; odłączenie → 0 powiązań + PERMIT_UNLINK; HHL wiąże istniejące zezwolenie projektu; KSH widzi wiersz bez przycisków), regresja `permit-validator.local` + `i27-permit-toggle.local` 3/3 | UI: szuflada → Dokumenty → „Zezwolenia transportu”: lista powiązanych zezwoleń z oceną `permit_fits` (RLS) i powodami, „Dodaj zezwolenie”, „Powiąż” (zezwolenie projektu), „Odłącz” (przed „Gotowy”); chunk leniwy tylko w buildzie Supabase (paczka demo bez zmian). Teksty PL/EN/SV (`p64_*`). |
| III-4 | pojazdy pilotujące: dane i awizacja (SCOPE 4.5) | **DONE** 28.09 (ten commit) | 0087 (produkcja: nałożona `supabase db push` po próbie w wycofanej transakcji: 4 rodzaje terminów, anon bez uprawnień, authenticated tylko SELECT, `detect_resource_deadlines` = 0, strażnik odmawia; `send-notifications` wdrożona z opisem ESCORT) — `load_escorts` (kolejność 1–5, firma, tablica `^[A-Z0-9 -]{2,15}$`, zakres PL / SE / PL_SE; RLS jak loads), `load_escorts_set` (pełna lista, HHL albo przewoźnik transportu, do rozładunku; synchronizuje `loads.escort_vehicles`; audit_log ESCORTS_SET ze starą i nową listą), `load_escort_status()` (wymagane = maks. `escort_required` powiązanych zezwoleń / awizowane / brakujące), termin ESCORT 48/12 h w `resource_deadlines` → RESOURCE_MISSING `rk_res_escort` z eskalacją i auto-zamknięciem | i2 456/456 (+20), nullguard 346/346 (+10), security 88/88 (lista +2), backup 23/23, release 145/145, vitest 477 (klucze `rk_res_escort*` PL/EN/SV), e2e build produkcyjny `tests/iii4-escorts.local.spec.ts` 2/2 (wymagane 2 → „awizowane 0 / wymagane 2” → SCX awizuje 2 → „2 / 2”, w bazie `1:PO 12345:PL,2:ABC 123:SE`, escort_vehicles 2, audit_log; KSH lista bez formularza), `i2-facade.local` 12/12, `p64-permit-form.local` 2/2 | UI (build Supabase): szuflada → zakładka zasobów → „Pojazdy pilotujące” zamiast pola „Pilot” (tryb demo bez zmian). **Decyzje:** termin ESCORT 48/12 h → pytanie do SCX w II-3 (c); imię/telefon pilota → D-22. |
| III-5 | mapa: unikanie kolizji etykiet (SCOPE 5.10), odtwarzanie przebiegu w czasie (SCOPE 5.13) | **DONE** 28.09 (ten commit) | 0088 (produkcja: nałożona po próbie w wycofanej transakcji: anon bez EXECUTE, authenticated z EXECUTE, nieznany transport → 0 wierszy) — `load_track(p_load, p_limit ≤ 5000)` security invoker (RLS `positions_read`), punkt przyciągnięty do drogi ma pierwszeństwo przed surowym | i2 461/461 (+5: uprawnienia, SCX 3 punkty rosnąco z pierwszeństwem punktu przyciągniętego, KSH widzi, limit = najnowsze, inny przewoźnik 0), nullguard 350/350 (+4), vitest 488 (+11 `map-declutter`: 2/3/6/12/50 znaczników w jednym punkcie → odstęp ≥ 22 px, determinizm, łańcuch, interpolacja przebiegu), e2e build produkcyjny `tests/iii5-map.local.spec.ts` 1/1 (50 transportów: minimalny odstęp środków znaczników ≥ 20 px; „Ślad” + transport z 12 pozycjami → „12 pozycji”, suwak zmienia chwilę, „Odtwórz” przesuwa; transport bez GPS → „Brak pozycji GPS”) | **Kolizje:** w produkcji pozycje transportów wynikają ze statusu (np. 50 × plac załadunku = jeden punkt) — nakładające się znaczniki rozkładane na okręgu (≤ 8) albo spirali Vogla (> 8), przeliczane po zmianie przybliżenia; tryb demo bez zmian (wzorzec zrzutów makiety). **Odtwarzanie:** warstwa „Ślad” (była w makiecie bez działania) + wybrany transport → linia przebiegu z bazy, znacznik w czasie, suwak, „Odtwórz/Pauza” (~30 s na przebieg), czas i prędkość punktu; zostaje po zamknięciu szuflady; bez danych — komunikat, nigdy trasa przykładowa. |
| III-9 | ocena przewoźnika (SCOPE 10.6); widok placu budowy (SCOPE 10.4, opcjonalny) | **DONE** 28.09 (10.6, ten commit); 10.4 → D-24 | 0089 (produkcja: nałożona `supabase db push` po próbie w wycofanej transakcji, 2× nałożona = idempotentna: anon bez SELECT, obie funkcje SECURITY DEFINER z `search_path=public`) — tabela `carrier_ratings` (jedna ocena na transport, RLS i SELECT tylko HHL), `carrier_rate_load` (tylko HHL, po rozładunku, 1–5 + komentarz ≤ 500, audit_log CARRIER_RATING), `carrier_scorecard(p_from, p_to)` (tylko HHL) | i2 473/473 (+12), nullguard 360/360 (+10), vitest 488, e2e build produkcyjny `tests/iii9-rating.local.spec.ts` 2/2 (HHL: ocena 4 w szufladzie → wiersz + audit_log, karta „4,00 / 5 (1)”, na czas „1 (100%)”; KSH: bez formularza) | Karta przewoźników w Opcjach (tylko HHL): zrealizowane, na czas (do końca okna, bez okna do końca dnia dostawy), opóźnienia z winy przewoźnika, średnie spóźnienie, średnia ocena; filtr dat rozładunku. Ocena w szufladzie (przegląd) po rozładunku. Nowe decyzje: D-23 (czy przewoźnik widzi oceny), D-24 (widok placu budowy — nowa rola i wzorzec). |
| O-V12 | Vercel produkcja po SCOPE 6.4 i III-4 | **DONE** 28.09 | commit `bd13a92` wdrożony (Ready) | tower.log-mar.pl 200, watch-tower-makieta.vercel.app 200, 55 plików JS, 0 × service_role, 0 × klucz; chunki PermitForm i EscortPanel obecne | Migracje 0086–0087 i funkcja Edge `send-notifications` na produkcji przed wdrożeniem. |
| O-V13 | Vercel produkcja po III-5 i III-9 | **DONE** 28.09 | commit `cee4920` wdrożony (Ready) | tower.log-mar.pl 200, watch-tower-makieta.vercel.app 200 (ten sam index), 39 plików JS (index + chunki zagnieżdżone), 0 × service_role, 0 × klucz; chunki TrackReplay, CarrierScorecard, CarrierRating, PermitForm, EscortPanel obecne | Migracje 0088–0089 nałożone na produkcję przed wdrożeniem, każda najpierw sprawdzona w wycofanej transakcji. |
| III-2 (część) | wierność wizualna: suma kontrolna arkusza wobec makiety (SCOPE 0.1), procedura nowej klasy (SCOPE 0.7) | **CZĘŚCIOWO** 28.09 (ten commit) | `tests/stylesheet-mockup.test.ts` (4 testy): SHA-256 arkusza referencyjnego makiety, tokeny :root równe, każda deklaracja makiety (204 selektory, także @media) = ta sama wartość w `src/index.css` po rozwinięciu `var(--…)`, lista 13 odstępstw z uzasadnieniem i źródłem (NAPRAWY D9, BATCH-SCROLL, FIX_MORNING, F2.3) bez martwych wpisów; DESIGN_SYSTEM.md §7a (3 warunki) | vitest 492 (+4), stylelint 0 | **Znaleziony i naprawiony dryf:** reset preflight `code,kbd,samp,pre{font-size:1em}` (D1) nadpisywał regułę makiety `kbd{font-size:11.5px}` — skróty w „Pomocy klawiatury” i podpowiedź „/” w harmonogramie miały rozmiar tekstu otoczenia; `kbd` wyjęty z resetu. Zostaje: próg 0,1% / 840 ujęć (CI odrzucone w III-3) i zrzuty stanów. |
| O-V14 | Vercel produkcja po III-2 (część: dryf kbd) | **DONE** 28.09 | commit `f7bda8b` wdrożony (Ready) | tower.log-mar.pl 200, watch-tower-makieta.vercel.app 200, 39 plików JS, 0 × service_role, 0 × klucz; w arkuszu CSS produkcji reset `code,samp,pre` bez `kbd` | Bez nowych migracji. |
| III-2 (reszta) | wierność wizualna: zrzuty stanów (SCOPE 0.8, 0.9), tryb systemowy (0.10), brama 0,1% (0.3, 11.4) | **CZĘŚCIOWO** 28.09 (ten commit) — 0.8–0.10 DONE; 0.3 → D-25 (STOP §1.4: nieoczekiwane różnice wzorca spoza pozycji) | `tests/visual-states.spec.ts` — 11 wzorców `stan-*.png` (najechanie, fokus, pusty × ciemny/jasny; wciśnięty, zablokowany, ładowanie, błąd, walidacja) + test trybu systemowego; harmonogram: szkielet 12 wierszy przez 260 ms i stan pusty `.empty` z „Wyczyść filtry” (tekst makiety, PL/EN/SV `iii2_empty_*`); `npm run gate:visual` (`scripts/visual/gate.sh`: git archive HEAD → build demo → podgląd :4188 → smoke + stany → matryca 840 → `compare-baseline.mjs` STRICT, próg 0,1%); stany dołączone do pre-push (`fresh-smoke.sh`) | stany 12/12 (2 przebiegi bez różnic), smoke 4/4, d19 2/2, deur 2/2, etap4 12/12, etap5 5/5, etap6 1/1, vitest 492; matryca 840/840 wykonana (~67 min, 0 błędów): **665 w progu 0,1%, 175 ponad** (Dokumenty 90, Harmonogram 85) | Różnice zbadane: build kontrolny z cofniętą poprawką `kbd` daje te same 85 różnic Harmonogramu (przyciski „Wgraj aktualizację”, „Eksport PDF” z I-22/I-24), a sama poprawka `kbd` zmienia ≤ 25 px na ujęcie (< 0,1%, bez zmiany wzorca). Dokumenty: terminy i „Zmień” per kategoria + wybór tygodnia (III-6). Wzorca **nie odświeżyłem** (zmiana spoza pozycji) — decyzja D-25. Podgląd 4177 i `dist/` nietknięte; własne podglądy :4188/:4189/:4190 z katalogów /tmp. |
| O-V15 | Vercel produkcja po III-2 (stany harmonogramu) | **DONE** 28.09 | commit `e7b7bfa` wdrożony (Ready) | tower.log-mar.pl 200, watch-tower-makieta.vercel.app 200, 39 plików JS, 0 × service_role, 0 × klucz; stan pusty harmonogramu (`data-sched-empty`) w paczce | Bez nowych migracji. |
| INC-28.09 | incydent: fragment hasła bazy produkcji w wyjściu narzędzia agenta (nie na dysku) | **ZAMKNIĘTY** 28.09 — właściciel zaakceptował ryzyko, hasło bez zmian | `SUPABASE_DB_URL` w .env.local poprawione: „@” w haśle zakodowane jako %40 (URL parsuje się poprawnie; połączenie bezpośrednie wymaga IPv6, niedostępnego na maszynie roboczej — praca dalej przez pooler) | przeszukanie dysku: 0 plików z hasłem | Przyczyna: niezakodowany „@” zmylił maskowanie; maskowanie URL zawsze do ostatniego „@”. |
| D-22 | kierowca pojazdu pilotującego: imię i telefon (decyzja właściciela 28.09) | **DONE** 28.09 (ten commit) | 0090 (produkcja: nałożona `supabase db push` po próbie w wycofanej transakcji, 2× = idempotentna: authenticated bez SELECT `driver_phone`, z SELECT `plate`; `load_escort_contacts` SECURITY DEFINER z `search_path`, anon bez EXECUTE) — kolumny `load_escorts.driver_name/driver_phone` (E.164), uprawnienia kolumnowe jak `loads` (0076), `load_escort_contacts()` (HHL wszystkie, przewoźnik własne, KSH 0), `load_escorts_set` z kontaktem (walidacja, audit_log bez danych osobowych), `purge_personal_data` + piloci 90 dni | i2 486/486 (+13: uprawnienia kolumnowe, zły telefon/imię, zapis z normalizacją telefonu, SCX/HHL widzą, KSH 0 i „permission denied” na kolumnie, KSH widzi pojazdy bez danych, inny przewoźnik 0, audit bez PII, retencja 89 dni zostaje / 91 dni czyści + licznik), nullguard 364/364 (+4), e2e `tests/iii4-escorts.local.spec.ts` 2/2 (SCX wpisuje kierowcę pilota → baza, brak PII w audit_log, odczyt po ponownym otwarciu; KSH: ani w DOM, ani w treści strony) | Eksport XLSX harmonogramu budowany z danych transportów w przeglądarce — kontaktów pilota tam nie ma, a KSH i tak ich nie dostaje z bazy. Nota w formularzu: „widzi tylko HHL i przewoźnik; usuwane 90 dni po rozładunku”. SECURITY.md §2 uzupełnione. |
| D-25 | warunkowe odświeżenie wzorca Dokumenty/Harmonogram + brama wizualna bez nadzoru (decyzja właściciela 28.09) | **DONE** 28.09 (ten commit) — **139 odświeżonych / 36 wypisanych** | `scripts/visual/d25-verify.mjs`: kandydat HEAD (build demo, :4188, 180 ujęć z prostokątami stref) → dla każdego ujęcia różnica nad strefą, w pasach bocznych i pod strefą po przesunięciu pionowym (skróty wierszy) ≤ 0,1%; wynik `docs/evidence/d25-verify-2026-09-28.json`. `scripts/visual/gate.sh` przepisany na przebieg bez nadzoru: blokada, linia wyniku zawsze w `/workspace/wt-gate-visual/last.txt` + `history.log`, kody 0–5 | 175 ujęć z różnicą: **139 zgodnych** (różnica wyłącznie w strefie nowych elementów, w tym przesunięcie treści pod nią) → w `shots-baseline/`; **5** mieści się w progu (bez zmiany); **36 wypisanych, NIE zaktualizowanych**: (a) 12 × Harmonogram 1920 (HHL i SCX × pl/en/sv × 2 motywy) — w kolumnie „Telefon” inne numery kierowców w danych demo (+48000000001… zamiast +48601234821…) — zmiana treści spoza nowych elementów; (b) 18 × Dokumenty HHL 1280/1440/1920 — lista „Pliki w vault” przesunięta o ułamkowe ~133 px: te same pozycje, różnica tylko z antyaliasingu tekstu (31–212 px po rozmyciu), ale formalnie poza strefą; (c) 6 × Harmonogram HHL sv 390/768/1280 — to samo zjawisko po zawinięciu nagłówka (0–88 px po rozmyciu). Test bramy: SKIP_MATRIX=1 → `OK … kod=0` (74 s); port 4177 → `FAIL … powód=port-4177-zarezerwowany kod=2` | Przebieg nocny do czasu decyzji o 36 ujęciach będzie `FAIL … zmienione=36` (kod 1). Propozycja: (a) wymaga decyzji, czy nowe numery demo mają zostać; (b)+(c) to artefakt renderowania — można je zatwierdzić jednym słowem (D-26). |
| D-23 | przewoźnik widzi swoje oceny i punktualność, notatka HHL wewnętrzna (decyzja właściciela 28.09) | **DONE** 28.09 (ten commit) | 0091 (produkcja: nałożona po próbie w wycofanej transakcji, 2× = idempotentna: authenticated bez SELECT `comment`, z SELECT `score`, anon nic, 2 polityki RLS, funkcje SECURITY DEFINER z `search_path`) — polityka `carrier_ratings_carrier` (własna organizacja), uprawnienia kolumnowe bez `comment`/`rated_by`, `carrier_rating_detail(p_load)` tylko HHL, `carrier_scorecard` dla przewoźnika = własny wiersz | i2 491/491 (+5: kolumny, SCX widzi 2 oceny bez notatki, SCX „permission denied” na `comment`, SCX odmowa `carrier_rating_detail`, HHL czyta notatkę, inny przewoźnik 0/0, KSH odmowa karty, karta SCX = 1 wiersz 2/1/1/4.00), nullguard 369/369 (+5), vitest 492, e2e `tests/iii9-rating.local.spec.ts` 3/3 (HHL ocenia z notatką; SCX: Ustawienia → „Twoja ocena i punktualność” — własny wiersz 4,00 / 5 (1), lista „Oceny transportów”, szuflada: ocena tylko do odczytu, notatki brak w DOM; KSH bez formularza) | Pole komentarza w formularzu HHL nazwane „Notatka wewnętrzna HHL”; nota karty HHL: „przewoźnik widzi ocenę i punktualność; notatka wewnętrzna”. Karta przewoźnika w Ustawieniach (SCX nie ma Opcji). SECURITY.md §2 uzupełnione. |
| III-10 | pobieranie EU Weekly Oil Bulletin do `fuel_index_readings` — gotowe, WYŁĄCZONE do D-2 (decyzja właściciela 28.09) | **DONE** 28.09 (ten commit) — przełącznik wyłączony, 0 odczytów WOB na produkcji | 0092 (produkcja: nałożona `supabase db push` po próbie w wycofanej transakcji, 2× = idempotentna): kody `WOB_DIESEL_PL` / `WOB_DIESEL_SE` (olej napędowy z podatkami, EUR/l), przełącznik `security_flags.FUEL_WOB_INGEST` = false, `fuel_wob_enabled()` i `fuel_wob_ingest(project, rows, source_url)` wyłącznie dla service_role (odmowa przy wyłączonym przełączniku, tylko kody WOB, tylko `https://energy.ec.europa.eu/`, tydzień już zapisany = pominięty, audit_log FUEL_READING_ADD „system”). Funkcja Edge `fuel-wob` wdrożona (bez crona; przy wyłączonym przełączniku kończy się bez pobierania i bez zapisu; bez klucza 401). Parser `supabase/functions/_shared/fuel/wob.ts` (XLSX bez zależności, JSZip do rozpakowania) | vitest `tests/iii10-wob.test.ts` 11/11 na prawdziwym pliku KE (ceny 21.09.2026: PL 2,0391 EUR/l, SE 2,0902 EUR/l, okres 2026-W39; zmiana układu, waluty, jednostki, brak wiersza, cena poza zakresem → błąd); i2 505/505 (+14: przełącznik, uprawnienia, odmowa przy wyłączonym, 2 odczyty po włączeniu, powtórka pominięta, źródło/kod/data/pusta tablica/projekt odrzucone, wpis widoczny w `baf_change_log`); vitest 503 | Formularz BAF (Opcje) pokazuje nadal tylko odczyty SEK/PLN. Włączenie po D-2 (jeśli przewoźnik wybierze WOB): `update security_flags set enabled = true where key = 'FUEL_WOB_INGEST'` + harmonogram pg_cron → pg_net (czwartek po publikacji biuletynu) jak w `supabase/sql/cron_usage.sql`. Tabele mnożników SEFS nadal liczą się z SEK/PLN — użycie WOB we wzorze wymaga decyzji D-2. |
| III-11 | źródło pogody morskiej Gdańsk–Nynäshamn — raport (decyzja właściciela 28.09) | **DONE** 28.09 (commit z III-10) | `docs/handover/RAPORT_POGODA_MORSKA.md`: DMI, FMI, SMHI, Copernicus Marine, ECMWF, DWD, Open-Meteo, IMGW — licencja, zasięg, częstotliwość, format, koszt; źródła sprawdzone na stronach dostawców | test na żywo 28.09 ok. 10:00: FMI WAM dla punktu w połowie trasy (56,5° N, 18,5° E) odpowiada w ~1 s (fala 0,86 → 1,23 m); DMI EDR dwukrotnie HTTP 429 (przeciążenie) | Propozycja: FMI WAM + DMI WAM jako drugie źródło (CC BY 4.0, bez konta i klucza); Copernicus Marine jako zapas (wymaga konta); Open-Meteo (darmowe API tylko niekomercyjnie) i IMGW (użycie gospodarcze/żegluga = odpłatna umowa) odpadają. Nic w UI. |
| III-12 | lista otwartych pozycji Etapu III niezależnych od właściciela + audyt dostępności (decyzja właściciela 28.09) | **DONE** 28.09 (ten commit) | lista `docs/handover/III12_LISTA_ETAP_III.md`; audyt `docs/handover/RAPORT_DOSTEPNOSC.md` — `npm run audit:a11y` (`scripts/a11y/audit.mjs`, axe-core 4.13, WCAG 2.0/2.1 A+AA + test klawiatury), 54 widoki (3 role × 2 motywy × menu), wyniki `docs/evidence/a11y-2026-09-28-{przed,po}.json`. Poprawki bez zmiany wyglądu: `aria-label` dla 18 pól/list (Faktury, Opcje, Ustawienia), `src/lib/clickableRow.ts` — wiersze otwierające szufladę/edycję w 9 tabelach osiągalne Tab + Enter/Spacja | axe przed → po: `label` 14 → 0, `select-name` 22 → 0, `scrollable-region-focusable` 8 → 0, `list` 12 → 12, `color-contrast` 1327 → 1327 (D-27); klawiatura 1402 → 362 (reszta = kursor „rączka” bez akcji z CSS makiety); vitest `tests/iii12-clickable-row.test.ts` 3/3 | Nowa decyzja **D-27** (kontrast: tokeny `--ink-3`, `--amber` jako tekst, licznik dzwonka; kursor bez akcji) — zmienia wygląd makiety, więc bez decyzji nie ruszane. Test czytnikiem ekranu (NVDA/VoiceOver) nie wykonany — tylko reguły axe. |
| O-V16 | Vercel produkcja po D-22, D-23, III-10, III-12 | **DONE** 28.09 | commit `6e9e2fb` wdrożony (Ready) | tower.log-mar.pl 200, watch-tower-makieta.vercel.app 200, 39 plików JS (rekurencyjnie), 0 × service_role, 0 × klucz | Migracje 0090–0092 na produkcji potwierdzone w `supabase_migrations.schema_migrations`; `FUEL_WOB_INGEST` = false, 0 odczytów WOB. |
| III-13 | korekta właściciela 28.09: D-26 to nie decyzja właściciela — 36 ujęć do wyjaśnienia przez nas | **DONE** 28.09 — 3 grupy, 0 regresji, wzorzec 36 ujęć odświeżony (`G4_WZORZEC.md` §III-13) | D-26 usunięta z PLAN §4, wpisana jako pozycja robocza III-13 | — | Plan: commit per ujęcie (log/bisect + porównanie zrzutów), grupy, klasyfikacja zamierzona (`G4_WZORZEC.md`) / regresja (naprawa + test), potem odświeżenie wzorca. Wynik: ujęcia dla 40 commitów `ce094ad..6e9e2fb`; A (12 × Harmonogram 1920) `16638cb` numery demo I-2h + `f7bda8b` chipy 1 px (kbd); B (18 × Dokumenty HHL 1280–1920) `bc31ac1` III-6 — przesunięcie 133 px, prawa kolumna na innym ułamku piksela; C (6 × Harmonogram HHL SV 390/768/1280) `db3d5e3` I-24 — zawinięcie paska przez przycisk PDF, ułamkowe przesunięcie. Nocny gate:visual na `24dbbcf` (10:22): `FAIL … matryca=804/840 zmienione=36 kod=1` — dokładnie te 36. |
| A11Y-2 | dostępność bez zmiany wyglądu — reszta (pozycja (1) planu 28.09) | **DONE** 28.09 (ten commit) | `ExceptionRow` (kolejka „Wymaga decyzji” w Kokpicie i Ryzykach): `<li>` bez `role="button"`, klawiatura przez `clickableRow` (Enter i Spacja — wcześniej tylko Enter); `scripts/a11y/audit.mjs`: tryb `A11Y_STRICT=1` | axe (54 widoki): `list` 12 → 0; naruszenia poza kontrastem **0**; kontrast 1327 bez zmian (D-27); klawiatura 362 (kursor bez akcji — D-27); tsc OK | Pozostałe poprawki dostępności wymagają zmiany wyglądu → D-27. |
| 16.3 | sprawdzenie w bazie: import tylko po stronie uprawnionej, eksport tylko w zakresie roli (pozycja (2) planu 28.09) | **DONE** 28.09 (ten commit) | Stan reguły: SCOPE 16.3 („import tylko KSH, eksport tylko HHL”) **zastąpiona przez I-18** (właściciel 27.09): import harmonogramu robi **HHL**, KSH **potwierdza daty** (`ksh_confirm_dates`, tylko KSH). Sprawdzone w bazie: `import_schedule` — odmowa dla KSH, SCX, konta bez `app_users`, HHL nieaktywnego; zapis wprost do tabel zamknięty przez RLS (`loads_insert_hhl`, `items_write`, `schedule_imports_hhl` = `is_hhl()`), brak DELETE na `loads`, anon bez dostępu; historia importów widoczna tylko dla HHL; koszyk Storage `harmonogramy` tylko HHL (0047). Eksport: XLSX/PDF generowane w przeglądarce z danych już ograniczonych przez RLS, kolumny per rola (`tests/xlsx-export-roles.test.ts`: KSH bez kosztu/marży/kierowcy, SCX bez przychodu/ceny klienta/marży; PDF bez danych kierowcy i kwot — I-24) | `tests/db/import.sh` 60/60 (+11: RLS INSERT KSH/SCX na `loads`, `shipment_items`, `schedule_imports`, UPDATE pozycji przez KSH = 0 wierszy, widoczność historii importów, anon, brak DELETE, `ksh_confirm_dates` SECURITY DEFINER bez anon); `ksh_confirm_dates` odmowa dla SCX/HHL — i2 | Eksport dostępny dla każdej roli w jej zakresie danych — tak jest w makiecie; ograniczenie przycisku eksportu tylko do HHL byłoby zmianą wyglądu i wróciłoby do zastąpionej reguły 16.3 — nie ruszane. Luka: brak. |
| 9.8 | odsiewanie duplikatów powiadomień — domknięcie (pozycja (3) planu 28.09; I-23 obejmowało tylko `notifications`) | **DONE** 28.09 (ten commit) | Przegląd ostatnich definicji wszystkich funkcji SQL: 13 miejsc wstawia do `notifications` (dedup_key + `on conflict do nothing`), 16 do `risk_signals`, 1 do `sms_outbox`. Sygnały ryzyka: 10× `on conflict … do nothing`, 6× najpierw sprawdzenie otwartego sygnału z tym kluczem (`job_watchdog`, `sms_watchdog`, `record_usage` — aktualizacja zamiast nowego wiersza, `detect_resource_deadlines`); ostatnią zaporą jest unikalny indeks `risk_signals(dedup_key) where resolved_at is null` — przy wyścigu dwóch przebiegów drugi dostaje błąd, duplikatu nie ma. Rozwiązany sygnał + powrót problemu = nowy sygnał (zamierzone). Kolejka SMS: unikalny `sms_outbox.dedup_key`. Wysyłka e-mail (`send-notifications`): ponowne sprawdzenie statusu tuż przed wysyłką + `Idempotency-Key: tower-notif-<id>` w Resend — nakładające się przebiegi nie wysyłają dwa razy. Bez migracji i bez zmian kodu aplikacji. | vitest `tests/notify-dedup.test.ts` 28/28 (+ blok 9.8: każdy INSERT do `risk_signals`/`sms_outbox` podaje dedup_key i ma odsiew; literały tekstowe wycinane przed analizą); i2 **510/510** (+5 „[9.8]”: indeksy unikalne risk_signals i sms_outbox, `raise_risk` ×2 = 1 otwarty, po rozwiązaniu nowy, `job_watchdog` ×2 bez nowych sygnałów) | — |
| 3.6 | wersjonowanie i archiwum pliku harmonogramu — sprawdzenie i domknięcie (pozycja (4) planu 28.09, audyt D4) | **DONE** 28.09 (ten commit) | Stan przed: wersja = kolejny numer per projekt (`unique (project_id, version)` — dwa równoległe importy nie dostaną tej samej wersji, drugi kończy się błędem), wpis wersji z nazwą pliku, SHA-256 i ścieżką; plik w prywatnym koszyku `harmonogramy` pod nazwą = skrót treści, upload bez nadpisywania, polityki Storage tylko SELECT/INSERT dla HHL (brak UPDATE/DELETE) — plik wersji niezmienny; tabela i koszyk w kopii zapasowej (I-2B). **Luka:** polityka `schedule_imports_hhl` była FOR ALL, a `authenticated` miał INSERT/UPDATE/DELETE — HHL mógł przez API poprawić lub usunąć wpis wersji z pominięciem `import_schedule`. **Naprawa — migracja 0093** (idempotentna, bez zmian danych): odebrane INSERT/UPDATE/DELETE/TRUNCATE, polityka tylko do odczytu `schedule_imports_hhl_read` (`is_hhl()`), strażniki `is not true then raise`; wersje dopisuje wyłącznie `import_schedule` (SECURITY DEFINER, właściciel postgres z BYPASSRLS). Produkcja: próba w wycofanej transakcji (migracja ×2, polityka `schedule_imports_hhl_read:r`, authenticated SELECT tak / UPDATE nie), potem `supabase db push` — 0093 w `schema_migrations`. Bez zmian kodu aplikacji (aplikacja tylko czyta historię). | `tests/db/import.sh` **66/66** (+6 „[3.6]”: UPDATE/DELETE/INSERT wprost przez HHL odrzucone, polityki tylko odczyt, unikalna para projekt+wersja, import przez `import_schedule` nadal dopisuje wersję z plikiem i skrótem); pełna brama bazy 14 zestawów OK | Przeglądanie i pobieranie starszych wersji w interfejsie — brak w makiecie (zmiana wyglądu = decyzja właściciela); dziś dostęp przez kopię zapasową albo panel Supabase. |
| G-V a956ab6 | brama wizualna na `a956ab6` (pozycja (0) planu 28.09) | **DONE** 28.09 (ten commit) — 839/840 wyjaśnione, regresji 0 | `gate:visual` 11:33: `FAIL matryca=839/840 zmienione=1` (`harmonogram__hhl__sv__390__dark-default`). Commit: żaden (src `6e9e2fb` = `a956ab6`). Przyczyna: `page.click('#themeBtn')` w `baseline.mjs` przewija okno w poziomie, gdy przycisk motywu jest poza ekranem 390 px (SV) i poprzednie ujęcie było jasne; wzorzec z III-13 robiony pojedynczym ujęciem (bez kliknięcia). Dowód: pojedyncze ujęcie 0 px, para jasne→ciemne 98 276 px, powtórzenie 0 px. Klasyfikacja: artefakt kolejności ujęć. Wzorzec: 1 ujęcie zastąpione wersją z kolejności matrycy (`G4_WZORZEC.md` §G-V a956ab6) | ujęcia `/tmp/bis` (build `6e9e2fb` i `a956ab6`), porównanie dokładne | Uodpornienie `baseline.mjs` na przewijanie = osobna pozycja (zmieni ujęcia 390/768; pełny przebieg ~42 min). Kolejny `gate:visual` uruchomiony na nowym HEAD — wynik w raporcie końcowym. |
| 10.8 | eksport PDF — dokończenie (pozycja (5) planu 28.09) | **DONE** 28.09 (ten commit) | I-24 dało plik PDF z harmonogramu; braki w treści pliku: nagłówki, tytuł i stopka tylko po polsku, status jako surowy kod (`IN_TRANSIT_PL`), ETA Boden wycinana z ISO (czas UTC bez oznaczenia — wbrew D8), stopka w UTC. Teraz: nagłówki/tytuł/stopka w języku interfejsu (PL/EN/SV, nowe klucze `i24_pdf_*`), status przez ten sam słownik co w tabeli (`statusLabel` wydzielony do `src/lib/statusLabel.ts`, `StatusPill` go reeksportuje — bez zmian wyglądu), daty wg D8: załadunek Europe/Warsaw, dostawa i ETA Boden Europe/Stockholm, dni kalendarzowe bez przesunięcia, stopka „wygenerowano … (Europe/Warsaw)”. Przycisk i komunikaty w interfejsie bez zmian (zmienia się wyłącznie zawartość pliku). Nadal bez danych kierowcy i kwot. | vitest `pdf-export` 6/6 (+3: nagłówki i status PL/EN/SV bez surowych kodów, strefy D8, stopka i tytuł w 3 językach), vitest całość **524 passed / 33 skipped**; tsc 0 | Eksport PDF innych widoków (Finanse, Faktury) — w makiecie brak przycisków, dodanie = zmiana wyglądu (decyzja właściciela). |
| O-V17 | wdrożenie Vercel `c90c062` (A11Y-2 + 10.8) | **DONE** 28.09 | `npx vercel --prod` z `git archive c90c062`; tower.log-mar.pl i watch-tower-makieta.vercel.app → 200; rekurencyjny skan 39 plików JS: 0× `service_role`, 0× klucz | — | — |
| 9.1–9.4 | silnik automatyzacji (pozycja (6) planu 28.09, audyt C1) | **9.1–9.3 DONE**, 9.4 CZĘŚCIOWO — 28.09 (ten commit) | **Migracja 0094** (idempotentna, nieniszcząca; produkcja: próba w wycofanej transakcji — migracja ×2, 7 reguł / 0 włączonych, worker pusty, brak EXECUTE dla authenticated/anon — potem `supabase db push`). **9.1:** wyzwalacz = typ zdarzenia z `load_events` (15 dozwolonych), warunek = podzbiór JSONLogic (`wf_logic`: var, missing, and, or, !, !!, ==, !=, <, <=, >, >=, in; inny operator → wyjątek), akcje: `notify` (powiadomienie w aplikacji `WORKFLOW_ALERT` dla HHL / KSH / przewoźnika transportu, PL/EN/SV w `notifyTemplates`), `risk` (`raise_risk` z kluczem reguły); `email`/`sms` zapisują „ZABLOKOWANE_R2” (EXTERNAL_MESSAGING). Kontekst warunku: zdarzenie + transport bez danych kierowcy i kwot. **9.2:** wyzwalacz `load_events_workflows` kolejkuje przebieg (QUEUED, `dedup_key` = reguła+zdarzenie; błąd kolejkowania nie blokuje zapisu zdarzenia), `workflow_worker(limit, teraz)` (tylko service_role, `for update skip locked`) wykonuje w podtransakcji; błąd → RETRY za 2^n min, po 5 próbach DEAD. **9.3:** START-1…7 w każdym projekcie, **wyłączone** (dojazd na plac, wjazd przed port, POD po rozładunku, opóźnienie, krytyczna zmiana daty, cichy pojazd, anulowanie). **9.4:** zapis reguł przez API tylko HHL_ADMIN (RLS `wf_all`), walidacja `wf_validate` (wyzwalacz, akcje, odbiorcy, rodzaj ryzyka, warunek sprawdzany przy zapisie). | `tests/db/workflows.sh` **35/35** (nowy zestaw w bramie bazy: JSONLogic, reguły startowe, uprawnienia i walidacja, kolejka i odsiew, wykonanie z powiadomieniami tylko do właściwych odbiorców, ryzyko, ponawianie RETRY→DEAD z terminami, blokada R-2, odporność zapisu zdarzeń); nullguard 369/369; vitest `notify-dedup` 29/29 | Do decyzji: (a) włączenie reguł startowych, (b) zadanie cykliczne wywołujące `workflow_worker` (np. co minutę; bez niego kolejka czeka). Podpięcie widoku „Automatyzacje” do bazy (9.4 UI; moduł w produkcji ukryty — I-2) → pakiet przekazania. Wyzwalacze CRON (wf-2, wf-7, wf-11 z demo) — poza zakresem. |
| 9.1 (0095) | poprawka silnika: tytuł sygnału ryzyka z reguły | **DONE** 28.09 (ten commit) | Brama pre-push (vitest `rk-generic`) odrzuciła push `42005b2`: `wf_action` wołał `raise_risk` bez jawnego klucza tytułu → bezpiecznik `rk_generic`. 0094 była już na produkcji, więc bez edycji pliku — **migracja 0095** (`create or replace wf_action`: `title_key` `rk_workflow` + parametry reguła/tytuł/transport; strażnik). Słownik `rk_workflow` PL/EN/SV w `src/i18n/risks.ts`. Produkcja: próba w wycofanej transakcji (×2, SECURITY DEFINER, bez EXECUTE dla authenticated), `supabase db push` — 0095 w `schema_migrations`. | vitest **525 passed / 33 skipped**; `workflows.sh` 35/35 (kontrola START-7 sprawdza `title_key = rk_workflow`; test nakłada ponownie 0094+ po seed); nullguard 369/369 | — |
| i2-III-4 (test) | niestabilny test zależny od godziny | **DONE** 28.09 (ten commit) | Push `d5a1ab7` odrzucony: i2 509/510 — „awizacja: brak pilotów 24 h przed załadunkiem” dało CRITICAL zamiast HIGH. Przyczyna w teście (III-4, 0087), nie w kodzie: `plan_load_date = jutro` → termin = jutro 00:00 Warszawa; po 12:00 do terminu zostaje < 12 h = próg `critical_h` dla ESCORT → CRITICAL. Rano test przechodził. Naprawa: transport testowy dostaje `plan_load_from = now() + 30 h` (zawsze między progiem 12 h a wyprzedzeniem 48 h). | i2 **510/510** o 12:2x | — |
| R2-retencja | retencja `files/` w kubełku kopii R2 | **CZEKA** — na logowanie właściciela do Cloudflare | Polecenie 28.09: pominąć, wrangler wylogowany, nie logować się. Przygotowane `docs/handover/r2/lifecycle.json` i `bucket-lock.json`; nałożenie po zalogowaniu (bez nowych płatnych zasobów). | — | wpis w `PRZEKAZANIE_CURSOR.md` §6 |
| HO-1 | pakiet przekazania dla Cursora (pozycja (7) planu 28.09) | **DONE** 28.09 (ten commit) | `docs/handover/PRZEKAZANIE_CURSOR.md`: kolejność źródeł prawdy, twarde zasady, architektura dziś (migracje 0001–0095, 12 funkcji Edge, 25 zadań cron, przełączniki), uruchomienie i liczby testów, procedury produkcyjne (migracja z próbą w wycofanej transakcji, Edge, Vercel + skan JS), zrobione 28.09, otwarte pozycje z następnym krokiem i decydującym, pułapki środowiska. `.cursor/rules/tower.mdc` (alwaysApply): twarde zasady w skrócie. `01_HANDOVER.md` oznaczony jako nieaktualny z odnośnikiem. | — (dokumenty) | — |
| HO-1a | korekta HO-1: przywrócone reguły `.cursor/rules/tower.mdc` | **DONE** 28.09 (ten commit) | HO-1 nadpisało istniejący plik reguł (źródła prawdy dziedzin: MECHANIZM_PIENIEDZY, STATUSY_AUTOMATYCZNE, ZRODLA_DANYCH; zasady EUR/NBP/statusów/wyglądu). Przywrócona pełna treść sprzed HO-1 + dopisane zasady z HO-1 (bez powtórzeń) i odnośnik do `PRZEKAZANIE_CURSOR.md`; `AGENTS.md` — krok 0: przeczytaj `PRZEKAZANIE_CURSOR.md`. | — (dokumenty) | — |
| G-V c90c062 | brama wizualna na `c90c062` (po A11Y-2 i 10.8) + naprawa bramy | **DONE** 28.09 (ten commit) | Wynik 12:33: matryca **840/840 identyczna, 0 zmian**, ale linia `FAIL` — `missingInBaseline=17`: `gate.sh` zapisywał ujęcia do `$TMP/shots`, gdzie `git archive` rozpakowuje 17 śledzonych zrzutów z 23.09 (`shots/`), a porównanie kończy się kodem 2 przy nadmiarowych plikach. Błąd bramy od jej powstania (także przebiegi `24dbbcf`, `a956ab6`). Naprawa: katalog `$TMP/gate-shots`. A11Y-2 i 10.8 bez wpływu na wygląd — potwierdzone matrycą. `G4_WZORZEC.md` §G-V c90c062 | `bash -n` gate.sh; kolejny pełny przebieg uruchomiony na tym commicie | — |
| 9.4 | widok „Automatyzacje” na danych z bazy (HHL_ADMIN) | **DONE** 28.09 (ten commit) | `SupabaseProvider.loadSnapshot` czyta `workflows` (RLS `wf_all`: tylko HHL_ADMIN, inne role 0 wierszy) i `workflow_runs` (ostatnie 1000; licznik = przebiegi OK; DEAD/RETRY → błąd z opisem, QUEUED → „w kolejce”); przełącznik → `workflow.update {enabled}`, kreator → `workflow.create` (insert z `project_id`, walidacja `wf_validate` w bazie; błąd → komunikat „Nie zapisano na serwerze…” i odświeżenie), `updateWorkflow` w store → `workflow.update`. Mapowanie `src/data/workflowMap.ts`: wyzwalacze kreatora POSITION_STALE↔SILENT_VEHICLE, UNLOADED↔MILESTONE_UNLOADED (FERRY_STATUS i CRON baza odrzuca — silnik ich nie obsługuje), akcje tekstowe notify_hhl/notify_ksh/notify_scx/risk:RODZAJ:POZIOM/email/sms ↔ JSON, warunek = JSONLogic. Widoczność: klucz `workflows` usunięty z `HIDDEN_IN_PROD` (12 kluczy), `canSeeWorkflows()` — produkcja tylko HHL_ADMIN, demo bez zmian (dane demo, zapis do serwera tylko dla id uuid). „Uruchom” w trybie Supabase: tylko komunikat (nowy klucz `a6_ts_wf_run_event_only` PL/EN/SV), bez fałszywego przebiegu. Przełącznik „Reguły workflow” w Opcjach/Powiadomieniach dalej ukryty w produkcji (filtruje tylko komunikaty w przeglądarce). **Wygląd bez zmian** (te same komponenty). **Nie zrobione (zmiana wyglądu = STOP):** osobny formularz edycji istniejącej reguły i lista historii przebiegów — w makiecie ich nie ma. Produkcja: bez migracji; START-1…7 nadal wyłączone, bez zadania cyklicznego. Testy: `tests/workflow-map.test.ts` (6), `i2-facade.test.ts` zaktualizowany; vitest 531/33; `i2-facade.local.spec.ts`: HHL_ADMIN widzi Automatyzacje. |
| G-V bb7216e | brama wizualna na `bb7216e` (po naprawie `gate.sh`) | **DONE** 28.09 (ten commit) | Wynik 13:28: `OK HEAD=bb7216e smoke+stany=ok matryca=840/840 zmienione=0 czas=2494s kod=0` — pierwszy przebieg z zielonym kodem po naprawie `$TMP/gate-shots`. |
| G-V narzędzie | `scripts/baseline.mjs` odporne na przewinięcie w poziomie | **DONE** 28.09 (ten commit; pełny przebieg i klasyfikacja — kolejny wiersz) | `setTheme` klikał `#themeBtn` przez `page.click`, które przewija okno do przycisku — przy 390 px ujęcie przesuwało się w poziomie zależnie od kolejności zadań (artefakt SV 390 dark z przebiegu na a956ab6). Teraz klik w DOM (`clickThemeBtn`, bez przewijania) i przed każdym ujęciem `resetHorizontalScroll()` (`window.scrollTo(0, scrollY)`, `scrollLeft = 0` dla dokumentu); przewinięcie w pionie (navTo) bez zmian. Kod aplikacji bez zmian — bez wdrożenia. |
| G-V 0efa871 | pełny przebieg bramy po uodpornieniu narzędzia + klasyfikacja + odświeżenie wzorca | **DONE** 28.09 (ten commit) | `gate:visual` na `0efa871` (14:26): `FAIL 678/840, zmienione 162` — wszystkie to artefakt starego narzędzia (okno przewinięte w poziomie w starym wzorcu): 144 × 390 px (przesunięcie 111–349 px), 18 × SCX 768 px (4 px), plus 3 poniżej progu (KSH 390 harmonogram, pasek filtrów ~1 px). Opis grup w `G4_WZORZEC.md` (commit, przyczyna, ocena: zamierzona, regresji 0). Wzorzec odświeżony dopiero po klasyfikacji: 165 ujęć z `0efa871`. Przy okazji: `PLAN.md` — II-7 (HERE Routing v8 zamiast TomTom), II-7a (warunek włączenia: limit 25 000/mies., regulamin), D-28 (wynik regulaminu HERE: STOP — plan podstawowy wyklucza „Asset Management”; oferta Enterprise/asset-based albo inny dostawca); II-7/II-7a zablokowane przez D-28; dodany `RAPORT_HERE_REGULAMIN.md` (z innego wątku). Nic z HERE nie implementowane. |
| 9.1a | wyzwalacze z kreatora dotąd odrzucane przez bazę: „status promu” i „codziennie o 06:00” | **DONE** 28.09 (ten commit) | Migracja 0096 (idempotentna; próba w wycofanej transakcji na produkcji: katalog wyzwalaczy t, wyzwalacz 1, START włączone 0, zadania cykliczne silnika 0, EXECUTE dla authenticated f). `FERRY_STATUS`: wyzwalacz `sailings_workflows` na `sailings` — zmiana statusu (ZAPLANOWANY/OPOZNIONY/ODWOLANY) albo czasów rejsu kolejkuje przebieg dla każdego nieanulowanego i niedostarczonego transportu na rejsie (payload: status, poprzedni status, statek, trasa, czas odejścia/przypłynięcia, `delay_min`; klucz odsiewu z podpisu zmiany — ten sam zapis bez zmian nie dubluje); błąd kolejkowania nie blokuje zapisu rejsu. `CRON_DAILY_06`: `wf_enqueue_daily(p_now)` — jeden przebieg na regułę i aktywny transport na dzień (dzień wg Europe/Warsaw), tylko service_role. **Zadania cyklicznego NIE utworzono** (migracja sprawdza, że go nie ma) — włączenie razem z START-1…7 wpisane jako decyzja D-29 w PLAN §4. Wygląd bez zmian (kreator miał te wyzwalacze od początku; mapowanie 9.4 przepuszcza kody bez zmian). Testy: `tests/db/workflows.sh` 35 → 46 (+11: zapis reguł, opóźnienie → SKIPPED wg warunku, odwołanie → OK + powiadomienie HHL, brak dubli, anulowany transport pominięty, dzienny odsiew i granica doby Europe/Warsaw, wyłączona reguła, uprawnienia). |
| G-V 42a72c7 | brama wizualna potwierdzająca po odświeżeniu wzorca (165 ujęć) | **DONE** 28.09 (ten commit) | Wynik 15:33: `OK HEAD=42a72c7 smoke+stany=ok matryca=840/840 zmienione=0 czas=2500s kod=0` — nowe narzędzie (bez przewijania w poziomie) i odświeżony wzorzec zgodne. Zamyka III-2 0.3/11.4 (wariant lokalny, SCOPE 0.3/11.4 → GOTOWE). |
| O-0096 | nałożenie 0096 na produkcję | **DONE** 28.09 | Próba w wycofanej transakcji (0096 ×2): wyzwalacz `sailings_workflows` 1, `wf_enqueue_sailing`/`wf_enqueue_daily` SECURITY DEFINER z `search_path=public`, EXECUTE anon/authenticated f/f, reguły 7 / włączone 0, `wf_enqueue_daily` w transakcji = 0, zadania cykliczne silnika 0; po ROLLBACK wyzwalacza brak. `supabase db push --db-url` (pooler) ×2: pierwszy nałożył 0096, drugi „Remote database is up to date”. `schema_migrations`: 0096 workflow_ferry_daily. Po nałożeniu: START 0/7, cron silnika 0. Kod aplikacji od `0163949` bez zmian (tylko dokumenty, zrzuty, testy, migracja) — bez wdrożenia; tower.log-mar.pl 200, watch-tower-makieta.vercel.app 200. | — | D-29 bez zmian |
| 6.6 | polisy przewoźnika z przypomnieniem o wygaśnięciu (audyt C4) — część bazowa | **DONE (część bazowa)** 28.09 (ten commit) | **Migracja 0097** (idempotentna, bez zmian danych; produkcja: próba w wycofanej transakcji ×2 — 3 funkcje SECURITY DEFINER z `search_path`, `insurance_policies` bez SELECT dla authenticated/anon, `detect_insurance_expiry` bez EXECUTE dla authenticated, 0 polis, wykrycie w transakcji 0, cron 0). `insurance_policies` zamknięta dla ról API (odebrane uprawnienia tabeli; wcześniej authenticated miał SELECT przy RLS bez polityk). `insurance_policy_save` (HHL dla dowolnego przewoźnika, przewoźnik tylko własna organizacja; walidacja numeru, okresu, waluty EUR/PLN/SEK, sumy, dokumentu INSURANCE; tylko dopisywanie; audit_log INSURANCE_SAVE bez sumy), `insurance_policies_list` (HHL wszystkie, przewoźnik własne, KSH 0; dni do końca), `detect_insurance_expiry(p_now, 14)` tylko service_role: najpóźniejsza polisa przewoźnika kończy się ≤ 14 dni → ryzyko INSURANCE HIGH (po terminie CRITICAL, eskalacja tego samego sygnału) w każdym projekcie z aktywnym transportem przewoźnika, `load_id` null + `carrier_org_id` (widzi HHL i ten przewoźnik, KSH nie), IN_APP `INSURANCE_EXPIRY` dla przewoźnika i HHL (odsiew), nowa polisa poza oknem → zamknięcie. Teksty PL/EN/SV: `rk_insurance_expiry*` (risks.ts), `INSURANCE_EXPIRY` (notifyTemplates). **Bez zadania cyklicznego** (polecenie 28.09) i **bez formularza polisy** (brak w makiecie) → D-30; notka „Polisa OCP … wygasa” w Dokumentach nadal ukryta w produkcji (`policyExpiryNote`). | `tests/db/insurance.sh` **33/33** (nowy zestaw w bramie: uprawnienia, walidacja, widoczność list, okno 14 dni, odsiew, eskalacja, zamknięcie, anulowane transporty, NULL); nullguard 369 → **379**; security 88/88 (kontrola 3.2f: `insurance_policies` bez SELECT dla authenticated zamiast „0 wierszy”); vitest `notify-dedup` + `rk-generic` 34/34 | Włączenie: D-30 (harmonogram `select public.detect_insurance_expiry()` np. codziennie 06:10 Europe/Warsaw + formularz polisy albo wpis przez HHL). |
| O-V18 | 0097 na produkcji + wdrożenie Vercel `15647c2` (6.6) | **DONE** 28.09 | Po próbie w wycofanej transakcji: `supabase db push` ×2 (pierwszy nałożył 0097, drugi „up to date”), `schema_migrations`: 0097 insurance_expiry; `insurance_policies` bez SELECT dla authenticated, cron polis 0, cron silnika 0, START 0/7. `npx vercel --prod --yes` z `git archive 15647c2` (bez „Not authorized”) → tower.log-mar.pl 200, watch-tower-makieta.vercel.app 200; rekurencyjny skan 58 plików JS: 0× `service_role`, 0× wartość klucza; `rk_insurance_expiry` w paczce. | — | — |
| G-V 6900022 | nocna brama wizualna | **DONE** 29.09 (ten commit) | Wynik 01:55: `OK HEAD=6900022 smoke+stany=ok matryca=840/840 zmienione=0 czas=2523s kod=0` — przebieg bez nadzoru (rutyna ~01:11). | — | — |
| I-30 | cennik według symboli (paczka 30.09) | **DONE** (sesja 30.09 wieczór) | (HEAD) | verify OK; i30 db 10/10; map 87/95 | zob. wpis I-30 w tabeli „Sesja 30.09 (wieczór)” |
| G-V 629f224 | nocna brama wizualna | **DONE** 30.09 (ten commit) | Wynik 02:39: `OK HEAD=629f224 smoke+stany=ok matryca=840/840 zmienione=0 czas=2452s kod=0` — przebieg bez nadzoru (po `git lfs pull`; pierwszy przebieg 01:57 FAIL: `shots-baseline/` to wskaźniki LFS, nie różnice pikseli). | — | — |
| G-V 894a684 | nocna brama wizualna | **DONE** 01.10 (ten commit) | Wynik 01:58: `OK HEAD=894a684 smoke+stany=ok matryca=840/840 zmienione=0 czas=2484s kod=0` — przebieg bez nadzoru (rutyna ~01:10). | — | — |
| G-V 59a5ce4 | nocna brama wizualna | **DONE** 02.10 (ten commit) | Wynik 01:58: `FAIL HEAD=59a5ce4 smoke+stany=fail matryca=310/840 zmienione=530 powód=różnice-ponad-0,1% czas=2450s kod=1` — przebieg bez nadzoru (rutyna ~01:10). | 530 ponad próg 0,1%: harmonogram 56, dokumenty/faktury/kokpit/mapa/ryzyka po 54, ustawienia 36, automatyzacje/opcje 30, pozostałe 18; smoke+stany też fail; wzorca NIE odświeżano. | — |
| G-V a232da9 | nocna brama wizualna | **DONE** 03.10 (ten commit) | Wynik 01:54: `FAIL HEAD=a232da9 smoke+stany=fail matryca=631/840 zmienione=209 powód=różnice-ponad-0,1% czas=2417s kod=1` — przebieg bez nadzoru (rutyna ~01:14; git-lfs zainstalowany ręcznie, `git pull --rebase` pominięty — brak upstream gałęzi `fix/przejecie-testy-02-10`). | 209 ponad próg 0,1%: kokpit/harmonogram/mapa po 54, faktury 27, automatyzacje 18, strefy 2; smoke+stany też fail; vs 02.10 (530) poprawa po G4-D27-D31; wzorca NIE odświeżano. | — |
| G-V fd5f8e2 | nocna brama wizualna | **DONE** 04.10 (ten commit) | Wynik 01:58: `OK HEAD=fd5f8e2 smoke+stany=ok matryca=840/840 zmienione=0 czas=2439s kod=0` — przebieg bez nadzoru (rutyna ~01:17; po zwolnieniu orphaned preview na 4188). | — | — |
| G-V 33fa661 | nocna brama wizualna | **DONE** 05.10 (ten commit) | Wynik 01:59: `FAIL HEAD=33fa661 smoke+stany=fail matryca=720/840 zmienione=120 powód=różnice-ponad-0,1% czas=2427s kod=1` — przebieg bez nadzoru (rutyna ~01:18; osobny worktree na origin/main, `git lfs pull`, port 4188). | 120 ponad próg 0,1%: mapa 36, kokpit 30, strefy 24, opcje 18, harmonogram 12 (KSH/SCX 1920); smoke+stany fail (mapa 1920 light, stan-najechanie dark). Prawdopodobnie zamierzone zmiany UI scalone 04.10 po fd5f8e2 (L-4…L-13, H-1…H-3, L-12 kreator stref, STD-CLEAN: GeofenceView, DashboardView/cockpitTiles, OptionsView, ScheduleView, index.css); wzorca NIE odświeżano — czeka na zgodę właściciela. | — |
| G-V 9c83d21 | nocna brama wizualna | **DONE** 06.10 (ten commit) | Wynik 01:17: `FAIL HEAD=9c83d21 smoke+stany=fail matryca=- zmienione=- powód=przerwany czas=187s kod=2` — przebieg bez nadzoru (rutyna ~01:14; `git lfs pull`, port 4188). Matryca niewykonalna na tym HEAD: `scripts/baseline.mjs` klika `#langSeg`, usunięty w `8322d02` (05.10, „bez języka i zegara”) → każde ujęcie `FAIL lang btn not found` (19/19 przed przerwaniem, 0 zrzutów, 0 porównań z `shots-baseline/`); bramę przerwał SIGTERM spoza przebiegu (~01:17 — zatrzymany przez executor B-SMOKE-LANG: przebieg na starym HEAD, port 4188 potrzebny do naprawy), resztę matrycy zatrzymano — wynik deterministyczny. | 0 ujęć w progu / 0 ponad próg (brak porównania). Smoke+stany fail: `kokpit__hhl__pl__1920__light` (lang btn not found: PL), `stan-najechanie (dark)` 6% pikseli — zamierzone zmiany UI 05.10 (brak PL/EN/SV i zegara `8322d02`, kafelki korytarza bez cyfr B-9.2 `6fc3037`, kolumny HHL-KSH/SCAN, daty z rokiem i pola dat B-8 `50ba5d6`, „Jak działa” B-6a); wzorca NIE odświeżano — czeka na B-SMOKE-LANG (P1). | — |
| G-V 020e379 | nocna brama wizualna | **DONE** 08.10.2026 (ten commit) | Wynik 01:28: `OK HEAD=020e379 smoke+stany=ok matryca=280/280 zmienione=0 czas=794s kod=0` — przebieg bez nadzoru (start ~01:15; `main` = `origin/main`, `git lfs pull` 280/280 PNG, port 4188, build w /tmp). | 280/280 w progu 0,1%, 0 ponad próg; wzorca NIE odświeżano. | — |
| G-V fc2f43c | nocna brama wizualna | **DONE** 10.10.2026 (ten commit) | Wynik 01:30 (Europe/Warsaw): `OK HEAD=fc2f43c smoke+stany=ok matryca=280/280 zmienione=0 czas=764s kod=0` — przebieg bez nadzoru (start ~01:17; `main` = `origin/main`, `git lfs pull` 280/280 PNG, port 4188, build w /tmp). Poprzednie 2 nocne przebiegi (09.10) nie wystartowały: na pudle brakowało `git-lfs`, `node_modules/` (→ `npm ci`) i Chromium Playwright, a `build/*.ts` było usunięte z drzewa roboczego (przywrócone `git checkout -- build`). | 280/280 w progu 0,1%, 0 ponad próg; wzorca NIE odświeżano. | — |
| B-SMOKE-LANG | testy bez `#langSeg` (8322d02) | **DONE** 06.10 | PR #134 (`30ba55f`, `1505ce2`) | `gate:visual` 10:18 **OK** HEAD=1505ce2 smoke+stany=ok matryca **280/280** zmienione 0 (744 s); `fresh-smoke.sh` OK: visual 4/4, stany 12/12, persist-toast 3/3, d-eur-t 2/2, etap4 12/12, etap5 5/5, etap6 1/1; e2e-core 5/5; vitest 836 passed / 35 skip; gitleaks historia 0 (po dopisaniu 4 nazw flag H3/H10 do `.gitleaksignore` — fałszywe alarmy z main 05.10), `npm audit --omit=dev --audit-level=high` 0 | Matryca PL 280 odświeżona na buildzie `55eccc4`; przyczyny grup z bisekcji (14 ujęć × 41 buildów od `fd5f8e2`): `8322d02`+`6fc3037` wszędzie; harmonogram `e5ccb96`/`50ba5d6`/`f456153`; mapa `e5ccb96` B-7c; ustawienia `8322d02`+`e5ccb96` Q-9 B; opcje `43e41fb`; strefy `4126b39`; ryzyka `3a48097`; rozliczenia `bfc7ed9`. Bez przyczyny: 0. VERIFY-13 17.4/17.8 → PASS. |
| B-PERSIST-TOAST | brak toastu „stan uszkodzony” przy pierwszym wejściu | **DONE** 06.10 | `c1d23e2` (PR #134) | `tests/persist-toast.spec.ts` 3/3 (HEAD); na `c1d23e2^` 1/3 FAIL (system jasny) | Przyczyna `e5ccb96` (Q-9 B): `setState` w `onRehydrateStorage` przed przypisaniem store → TypeError → toast. Prod 06.10: ekran logowania bez toastu (obie domeny, light/dark); wadliwa ścieżka była w paczce prod → naprawa wdrożona z #134. |
| B-SMOKE-DRIFT | awarie smoke ukryte pod `#langSeg` | **DONE** 06.10 | `55eccc4` (PR #134) | etap4 12/12, e2e-core 5/5, etap6 1/1, d-eur-t 2/2 | Regresja aplikacji: O4 DemoMark w akordeonie Opcji (`5685099`) — naprawiona. Reszta: testy pod AWIZ-4, B-K.1, DRV-CLOSE, DEC-6, L-5, D-31 (sprawdzenia zastąpione odpowiednikami). d-eur-t pomija tekst niewidoczny (zwinięte `<details>`). |
| O-V B-SMOKE-LANG | Vercel prod po PR #134 | **DONE** 06.10 10:23 | scalenie `a78e876` (#134); #133 zamknięty (treść w #134) | `dpl_DcRvzniRJvFTo1siEZ4B2SyKPfyz` READY (git archive `a78e876`), alias tower.log-mar.pl; tower.log-mar.pl **200**, watch-tower-makieta.vercel.app **200**; paczka prod zawiera poprawkę (`queueMicrotask(()=>{try{…setState({theme…`), 0× `service_role` | Prod po wdrożeniu: ekran logowania light/dark bez toastu i bez pageerror (obie domeny). Pierwsza próba CLI „Not authorized” (wysyłka plików), ponowienie OK. |

## Porządki 29.09.2026 — archiwum i pliki poufne

| ID | pozycja | status | commit | uwagi |
|---|---|---|---|---|
| PORZ-1 | Archiwum instrukcji → `docs/archiwum/`; nowe zasady; grafiki Watch Tower; usunięcie xlsx/docx poufnych z drzewa | **DONE** (ten commit) | (HEAD po pushu) | Historia gita **nie** przepisana (repo prywatne). Commity z plikami poufnymi do wyczyszczenia przed ewentualnym udostępnieniem: `0ad97bae` (SCX_CENNIK.xlsx, KSH_HARMONOGRAM.xlsx, BAF_SPEC.docx, qa xlsx), `af3ea61c` (public/KSH_HARMONOGRAM.xlsx, docs/qa-start/*.xlsx), `deaad9c6` (przykładowe kwoty w PRZEKAZANIE_CURSOR.md). Kopie: `D:\Watch Tower\dane\z_repozytorium\`. |

### Klasyfikacja xlsx (E.2)

**Używane przez testy/skrypty → syntetyczne w `tests/fixtures/`:**
- `public/KSH_HARMONOGRAM.xlsx` → `ksh-harmonogram-synthetic.xlsx`
- `docs/qa-start/p9r-merge-plus1-valid.xlsx` (+ kopia watch-tower) → `p9r-merge-plus1-valid.xlsx`
- `docs/qa-start/ship-qa-schedule.xlsx` → `ship-qa-schedule.xlsx`
- `docs/qa-start/ship-qa-unique.xlsx` → `ship-qa-unique.xlsx`

**Nieużywane w kodzie → kopia do `dane\z_repozytorium`, `git rm`:**
- `p9r-import-plus1-exact.xlsx`, `p9r-merge-plus1.xlsx`, `p9r-sg34-restore.xlsx` (oba katalogi qa-start)
- `docs/watch-tower/SCX_CENNIK.xlsx`, `KSH_HARMONOGRAM.xlsx`, `BAF_SPEC.docx` (E.1)

**Zostaje:** `tests/fixtures/wob-*.xlsx` (dane publiczne KE).



## Baza testowa 30.09.2026 — Plan B (Supabase hosted, bez Dockera)

| ID | pozycja | status | commit | testy (liczby) | uwagi |
|---|---|---|---|---|---|
| BAZA-T | projekt `watch-tower-test` (ref emkbykwenwrjmbprydml); TEST_DB_URL z Management API (Session :5432) + TEST_DB_PASSWORD; brama `node scripts/test-db-gate.mjs`; bezpiecznik produkcji; zasada w `baza.mdc` | **DONE** (ten commit) | (HEAD po pushu) | połączenie OK (PostgreSQL 17.6); migracje 0001–0097 nałożone (0031 trigger: WARN — brak uprawnień spatial_ref_sys na free test); refuse-prod **5/5**; hosted: archive **18/18**, watchdog **27/27**; FAIL (hosted≠stub): security 74/88, status 8/44, storage 30/37, money 115/130, release 141/145, session 15/27, invite brak WYNIK (auth), risks 20/23, import 65/66, nullguard 358/379, i2 429/510, workflows 27/46, insurance 30/33; backup SKIP (CREATE DATABASE) | **Klient:** istniejący psql pg16 + Node `pg` — bez winget, bez Dockera. Windows psql: URI przez `-d`. Bezpiecznik `refuse-prod.sh`. Zasada: bez zielonych testów bazy żadna migracja nie wchodzi na produkcję. Dane zmyślone. Aplikacji i produkcji nie ruszano. |

| BAZA-T2 | brama hosted: dostosowanie bez osłabiania asercji (Admin API, SKIP tylko spatial/CREATE DATABASE) | **DONE** 30.09 (ten commit) | (HEAD po pushu) | pełna brama — tabela niżej | Bez zmian aplikacji/produkcji. `TEST_SERVICE_ROLE_KEY` z Management API → `.env.local` (nigdy nie wypisany). |

### BAZA-T2 — wyniki bramy hosted (emkbykwenwrjmbprydml)

| Zestaw | OK | FAIL | SKIP | status |
|---|---|---|---|---|
| security | 84 | 0 | 2 | OK (oczek. 84; lokalnie 88−4 spatial) |
| status | 44 | 0 | 0 | OK |
| storage | 37 | 0 | 0 | OK |
| money | 130 | 0 | 0 | OK |
| release | 145 | 0 | 0 | OK |
| backup | — | — | 1 | SKIP — CREATE DATABASE |
| session | 27 | 0 | 0 | OK |
| archive | 18 | 0 | 0 | OK |
| watchdog | 27 | 0 | 0 | OK |
| invite | 48 | 0 | 0 | OK |
| risks | 21 | 0 | 2 | OK (oczek. 21; lokalnie 23−2 tower_test_status) |
| import | 66 | 0 | 0 | OK |
| nullguard | 379 | 0 | 0 | OK |
| i2 | 510 | 0 | 0 | OK |
| workflows | 46 | 0 | 0 | OK |
| insurance | 33 | 0 | 0 | OK |

**SKIP (jawne, tylko dozwolone):**
1. `spatial_ref_sys` DELETE/UPDATE (security) — hosted free: brak OWNER/TRIGGER 0031
2. `postgres DELETE spatial_ref_sys` — j.w.
3. `backup` cały zestaw — CREATE DATABASE niedostępne na hosted
4. `risks` automat statusów/promów (`tower_test_status`) — wymaga osobnej bazy (CREATE DATABASE)
5. `risks` automat: klucze funkcji — j.w.

**Kategoria (b) prawdziwy błąd:** brak.

Uwaga: zestaw `i2` na hosted wymaga `ensureSeedAuthUsers` (FK `auth.mfa_factors` → `auth.users`); brama woła Admin API przed i2/session.

**Klasyfikacja wcześniejszych FAIL → (a) środowisko hosted (naprawione adaptacją, nie luzowaniem asercji):**
| FAIL | przyczyna (a) | adaptacja |
|---|---|---|
| atrapa `auth.users` / DISABLE TRIGGER | free: brak OWNER na auth | Admin API + `TEST_SERVICE_ROLE_KEY` |
| `spatial_ref_sys` mutacje | brak uprawnień PostGIS | SKIP (asercja lokalna bez zmian) |
| backup / `tower_test_status` | CREATE DATABASE | SKIP |
| nullguard „funkcje bez wpisu” | CRLF w `comm` na Windows | `tr -d '\r'` |
| workflows START-1…7 = 0 | shim no-opował ponowne migracje po seed | `TOWER_ALLOW_MIG_REAPPLY` |
| storage KSH PDF HHL = 0 | `storage.objects` przeżywa DROP public + UNIQUE | czyszczenie (replica) + unikalna ścieżka na hosted |
| i2 GPS flags puste | enum bez `DRIVER_APP` | `DRIVER_PWA` na hosted |
| i2 rate_card_save / purge | `-c`→`-f`: `set_config(...,true)` poza transakcją | jawne `BEGIN`…`COMMIT` |
| i2 MFA factors = 0 | prawdziwa `auth.mfa_factors` (nie atrapa) | insert z kolumnami hosted; bez DROP tabeli |
| i2 UNLOADED +00 vs +02 | TimeZone=UTC na poolerze | `TimeZone=Europe/Warsaw` w shim + `PGTZ` |
| pooler leftover JWT | `auth.uid()` w insertach postgres | clear JWT na początku każdego psql |
| money FIX JSON | Windows Store `python3` stub | Node |
| UTF-8 PL w `-c` | Win32 argv | `-c` → plik UTF-8 + `-f` |

## Sesja 30.09 (wieczór) — ENV + I-33

| ID | pozycja | status | commit | testy (liczby) | uwagi |
|---|---|---|---|---|---|
| ENV-0a/b/e | eol=lf; vitest CRLF+suma makiety; hunspell SKIP Windows; drop VITE_TRAFIKVERKET_API_KEY | **DONE** | `a2b38f18` | vitest **530 passed / 36 skipped / 0 failed** | `core.autocrlf=true` → working tree CRLF; testy normalizują LF. PL-T: 2× SKIP z jawnym powodem w nazwie. 0c (baza testowa) pominięte — DONE wcześniej `894a684e`. |
| I-33 | strażnik zawieszonej kopii RUNNING > 30 min | **DONE** | (ten commit) | dry-run PROD+TEST ROLLBACK OK; izolowany I-33 na TEST **ok**; produkcja: 0098 + cron `tower-backup-stale` `*/5` | **Przyczyna id=10 (29.09 00:30 UTC):** Edge `backup-export` urwał się w trakcie COPY (postęp 12 tabel / 8062 B w `tables`, m.in. fx_rates…fuel_index_readings); `finished_at` puste do następnej nocy. `backup_run_begin` oznaczył ERROR dopiero przy starcie id=11. **Nocna 30.09 id=11:** OK, `daily/2026-09-30/`, 63238 B, 16 s. **Strażnik:** `backup_stale_watchdog()` → ERROR + JOB_FAILURE + e-mail (Vault). gate backup oczekuje **29** (było 23). Domeny: tower.log-mar.pl **200**, tower-hhl.pages.dev **200**. |
| ODBIÓR | potwierdzenie paczki/zleceń 30.09 | **DONE** | (ten commit) | — | Lista ID w PLAN.md § PACZKA 30.09. Kolejka rozszerzona (AUTH-1, DEC-*, BRAND-15, …). |
| AUTH-1 | logowanie hasłem (PO_SPOTKANIU §1) | **DONE** (kod+baza; live 20 kont — przy R-2) | (ten commit) | vitest **534/36 skip**; unit `auth-password` 3/3; 0099 na PROD+TEST | Migracja 0099: `must_set_password`, `auth_email_allowed` (anon), `app_user_mark_password_set`, `my_profile`+flaga. UI: e-mail+hasło, reset (tylko gdy allowed), „Dalej” przed tokenem (`detectSessionInUrl:false`), ustaw hasło ≥12. Istniejące konta: must_set_password=true → prośba o hasło przy następnym wejściu. Kryterium 20 kont/5 min — przy zaproszeniach R-2. |
| I-30 | cennik według symbolu (D-1) | **DONE** | `ae62f2f9` | verify xlsx≡JSON **OK**; unit i30 **7/7** + guardian **1/1**; db i30 **10/10**; map HH **87/95** (8× KR-08…15 bez daty → NO_CONVOY, zgodnie z decyzją); vitest powiązane **15/15** | Migracja **0100** (PROD dry-run ROLLBACK + apply; TEST apply). `rate_match` SYMBOL: rodzina z numeru, konwój KR, HEIGHT_ADOPTED, PL-1/10.1/17.1→2,45. Formularz Opcje przebudowany. Skrypty: `i30-verify-cennik.mjs`, `i30-load-cennik.mjs` (TEST domyślnie; PROD: `TOWER_CENNIK_PROD=1`), `i30-map-harmonogram.mjs`. Kwoty załadowane TEST+PROD skryptem z `D:\Watch Tower\dane` — **nigdy w migracji/repo**. Demo `src/data/*` oczyszczone z kolizji kwot. |
| I-31 | SEFS hybrid_min (D-2) | **DONE** | (ten commit) | unit i31 **3/3** (w tym 28.09–04.10 → **1,14**); db i31 **6/6** | Migracja **0101** (PROD dry-run + apply). `sefs_lookup_mult` / `sefs_compute_hybrid` / `sefs_week_for_load`. Tabele 51+51 skryptem `i31-load-sefs.mjs` → TEST v3 + PROD v1. III-10 WOB **wyłączone**. Odczyty dzienne period=YYYY-MM-DD. Następne: **DEC-2 centrum decyzji**. |
| DEC-2 | centrum decyzji (DECYZJE §2) | **DONE** | (ten commit) | dec2 **18/18** | **0102/0103** + **0126** `decision_apply_effect` (CANCEL/NOTIFY/HOLD/CHANGE_SAILING/TAKE_FILE/BACKUP_RETRY/…); resolve → jsonb + ui_hint; UI DecisionCentre → szuflada |
| DEC-3 | powiadomienia (§3) | **DONE** | (ten commit) | dec3 **10/10** | **0104** decyzje; **0126** wyzwalacze status/ryzyko/strefa → `matrix_notify` |
| DEC-4 | widoczność macierz (§4) | **DONE** | (ten commit) | j.w. | **0105** admin + egzekwowanie firm/kanałów w `matrix_notify` (EMAIL gdy macierz) |
| BRAND-15 | nazwa i logo Watch Tower (§15) | **DONE** | `f8c8af6c` `57527034` | risk-keys **14/14** | favicon/splash/manifest/SW; logo AuthGate; topbar; UI bez „TOWER”. Zostaje: szablon e-mail Auth (dashboard Supabase). |
| AWIZ-4 | awizacja Dodaj/Edytuj (§4) | **DONE** (UI; zapis KSH=II-10) | (ten commit) | awizacja-state **5/5**; phone-national **5/5**; tsc OK | Modal nad panelem; pola §4; armator→rejs→statek; filtr „zdąży” (+14 h); tracking→`telematics_vehicle_id`; Ustalenia bez starego formularza kierowca/rejs. |
| HHL-4a | nr zlecenia HHL (§4a) | **W TOKU** | (ten commit) | — | Przycisk Dodaj/Edytuj + pole w oknie awizacji; konflikt pliku i zapis SharePoint = II-10. |
| TEL-1 | telefony bez kierunkowego (§1) | **DONE** | (ten commit) | phone-national **10/10**; xlsx-roles **4/4**; tsc OK; security hosted | Migracja **0111** PROD+TEST: `driver_phone_country`, konwersja E.164→krajowy, `driver_phone_e164` przy SMS. Import `normalizePhone` → krajowy. Eksport = krajowy. Escort/awizacja: blur zdejmuje kierunkowy. |

**Następne:** DATY-67 · kolejka PLAN (po TEL-1).
**Czeka na właściciela:** instalacja APK bramki (`D:\Watch Tower\dane\apk\WatchTowerSMS.apk`) + parowanie + SMS test; API emtrack, linki podwykonawców, wymiary aut, zgoda IT KSH + creds SharePoint; szablon e-mail Auth „Watch Tower”; akceptacja pisemna II-10-E2; numer właściciela do SMS testowego (w UI, nie w repo).

| RESP-14 | telefon i PWA (§14) | **W TOKU** | `dfcc0afe` | tsc OK | `sw.js` v2026-10-01b + `offline.html`; toast nowej wersji; menu ☰ + nav overlay ≤768; drawer/awizacja pełny ekran; karty harmonogramu; cele 44px / input 16px. Brama 390/768 + Lighthouse — przy wdrożeniu. |
| DEC-5 | SMS strefy 2+2 (§5) | **DONE** | (ten commit) | dec5 **11/11** na TEST | Migracja **0106** TEST+PROD. Listy LOAD_SREM/UNLOAD_BODEN; wyzwalacze; dedup; bufor przed Śremem; UI Opcje; TEL-1 przy zapisie. |

### Uzupełnienie START PRACY (01.10) — od koordynatora

Przyjęte: **II-10-E1**, **II-10-E2**, **ONE-MECH** (D-29/D-29t), **I-7a** (§1a, bez wycofania zgody), **CLEAN-TT-HERE** (P2).
Wpisy w `PLAN.md` (PACZKA + decyzje D-29/D-32/D-33 + DEC-CLICK).

### Akceptacja koordynatora (01.10 popołudnie)

Przyjęte: **DEC-CLICK** (a/b/c), **D-29t** (z warunkiem zastępników), **D-4** (zamknięte),
**PUSH+PROD**, **I-3-APK**.

| ID | pozycja | status | commit | testy (liczby) | uwagi |
|---|---|---|---|---|---|
| DEC-6 | ustawienia admina §6 | **DONE** | (ten commit) | dec6 **15/15**; nullguard **473**; security **84/84**; tsc OK | Układ zwijany. **0107** progi. **0110** (PROD dry-run ROLLBACK + push; TEST apply): `admin_auth_login_log`, `system_broadcast` + `admin_broadcast_set/clear` + `system_broadcast_current`. UI: AuthLoginLog, BroadcastForm, DataExportPanel (CSV/XLSX z widocznością). Baner w shell. |
| DEC-CLICK | routing klików | **AKCEPTACJA** | (docs) | — | Grupa C bez nowych typów; status/strefa → Transport; grupa D bez driver PWA (D-38). Implementacja w ONE-MECH/DEC-3. |
| D-29t | tabela nakładania | **AKCEPTACJA** | (docs) | — | Warunek: żaden alarm bez zastępnika — lista poniżej. Scalenie = ONE-MECH. |
| D-4 | telefon+SIM | **ZAMKNIĘTE** | — | — | Koordynator: Android + SIM są. Dalej = I-3-APK. |
| I-3-APK | aplikacja bramki Android | **DONE APK** | (ten commit) | APK **1.0.0** podpisany v2 | Plik: `D:\Watch Tower\dane\apk\WatchTowerSMS.apk` · SHA-256 `d6324bb089e6764d436066ce309b4d4caab59f91de3c42aa54e9a40f4a50ce8c` · klucz poza repo (`dane\apk-klucz`). Instrukcja USB/Drive zaktualizowana. Czeka: instalacja na telefonie właściciela + parowanie + SMS test. |

#### D-29t — lista „było → jest” (warunek akceptacji: zero znikających alarmów)

| Było (źródło alarmu / akcji) | Jest (zastępnik — alarm zostaje) |
|---|---|
| START/wf-3 „Cichy pojazd” | `detect_silent_vehicles` (DB) → ryzyko SILENT + macierz RISK; wf-3 wyłączony (bez dubla) |
| START/wf-1 Bufor 50 km Boden | silnik geofence + DEC-5 SMS stref + macierz LOAD_STATUS; wf-1 nie osobno |
| START/wf-8 Plan B / PRE_PORT | ryzyko FERRY + decyzja plan B + macierz; wf-8 wyłączony |
| START/wf-4 Ryzyko promowe | jedno zdarzenie ryzyka FERRY → macierz + decyzja; wf-4 wyłączony |
| START/wf-5 Zmiana daty awizowanej | DATY-67 + decyzja + powiadomienia (I-10 ścieżka); wf-5 wyłączony |
| START/wf-2 Brak zezwolenia 48 h | I-27 + decyzja + macierz; wf-2 wyłączony po podpięciu DEC |
| START/wf-6 POD po rozładunku | ścieżka dokumentów + SMS 9 (DEC-5/D-19); wf-6 nie dubluje |
| SMS 5 / 9 z wf | wyłącznie wyzwalacze §5 / macierz (już 0106) |
| Opóźnienie ETA (mail z wf) | ryzyko DELAY → decyzja; bez osobnego maila z wf |
| START/wf-9 Trafikverket | ryzyko ROAD_SE + macierz; wf-9 wyłączony |
| START/wf-7…12 (faktury/marża…) | macierz MONEY/SYSTEM albo osobna decyzja — **nie kasować** przed mapowaniem |
| LOADING_UNCONFIRMED / SEQUENCE / DATES_UNCONFIRMED / USAGE_LIMIT / JOB_FAILURE | zostają w grupie C (DEC-CLICK a) — **bez nowych typów**, mechanizm ryzyka bez zmian |
| Kopia JOB_FAILURE | poza grupą C (osobna ścieżka strażnika kopii) — bez zmian |

#### Naprawa bramy po 0106 (01.10)

| ID | status | commit | testy | uwagi |
|---|---|---|---|---|
| 0109 | **DONE** PROD+TEST | `93ce1109` | i2 **510/510**; dec5 **11/11** | `sms_zone_on_geofence_enter`: niepoprawny `geofence_id` nie wywala INSERT `load_events` (I-2l). Seed: Bufor przed Sremem w `tests/db/seed.sql`. i2: oczekiwania SMS po `sms_strip_pl` / „Watch Tower”. |
| O-V | vercel --prod po 0105–0109 | **DONE** | `5d2b0248` | tower.log-mar.pl **200**, watch-tower-makieta.vercel.app **200**; dpl `GJ26sabE…` READY | Deploy z kopii bez `.git` (CLI z metadanymi git → BLOCKED). Naprawy TS: ScheduleView Fragment, `await getSupabase` w SmsZoneRecipients, awizacja bez CANCELLED w typie UI. |
| ONE-MECH | wyłączenie dubli + DEC-CLICK | **DONE** | (ten commit) | — | Seed wf-1…12 off (7/10–12 → MONEY/SYSTEM); auto-run usunięty; klik strefy→Transport; wf w prod = podgląd. |
| I-3-APK | APK lokalnie | **DONE APK** | (ten commit) | APK **1.0.3** v2 | `WatchTowerSMS.apk` SHA-256 `64eca1b1…8c05`. **1.0.3 Realme:** onDestroy nie kasuje ON; KeepAlive 12 min; BOOT/QUICKBOOT; dialog baterii + autostart. Smoke **PASS**. Strefy **OFF**. |
| SMS-DELIV | burst 10 | **DONE** (po 2 h) | — | **10/10 DELIVERED** (QUEUED 0 / SENT 0 / FAILED 0); tag `20261001205456`; last4 `7907` | Sygnał „2 h minęły” → `node scripts/sms-burst-test.mjs` exit 0. Strefy były **OFF** (`SMS_ZONE_APPROACH`/`SMS_ZONE_ENTER` = f). |
| SMS-ZONE-ON | włączenie stref po 10/10 | **DONE** | — | przed: APPROACH=f ENTER=f (PROD+TEST); po **0116**: APPROACH=t ENTER=t (PROD+TEST) | Migracja **0116** (przywrócenie po 0112). Dry-run ROLLBACK OK → `db push` PROD; TEST: SQL + wpis `schema_migrations`. APK/bramki **nietknięte**. |
| ADM-10 | Działaj jako (§10 / D-52) | **DONE** | (ten commit) | 0117 PROD+TEST; adm10 **8/8**; tsc OK | Migracja **0117**: `impersonation_state`, `current_*` → konto docelowe, `real_app_*`, `admin_impersonate_start/stop`, `audit_log.acting_as_user_id` + trigger, `my_profile` (+acting_as/real_*). UI: przycisk w Użytkownikach + pasek wyjścia. |
| DATY-67 | daty z pliku KSH + opóźnienie (§6–7); bez „Potwierdź daty” | **DONE** | (ten commit) | 0113 PROD+TEST; vitest i18 **3/3**; tsc OK; sekcja i2 DATY-67 **25/25** (po poprawce SCX→WSTEPNA); oczekiwanie i2 bramy **499** | Migracja **0113**: `schedule_cell_ts`, import zawsze nadpisuje daty/godziny z pliku → `plan_load_from` (PL) / `plan_delivery_to` (SE); `ksh_confirm_dates` odmowa DATY-67; `detect_unconfirmed_dates` = 0 + cron zdjęty; ryzyko **LATE_DATE_CHANGE** (HHL+SCX) przy zmianie ≤ N dni; `TRANSIT_TARGET_DAYS=4` (rezerwa ETA → II-7b, bez zmiany `compute_load_eta`/I-15). UI: usunięty panel „Potwierdź daty”, znaczniki WSTĘPNA/✓, zgoda overwrite. Bramka SMS / strefy **nietknięte**. |
| I-7a | KSH widzi kierowcę/auto na stałe (bez wycofania zgody) | **DONE** | (ten commit) | 0114 PROD+TEST; vitest permissions-phone + xlsx-export **9/9**; tsc OK | Migracja **0114**: `load_driver_contacts` — CLIENT pełne imię+telefon swojego projektu bez okna ±24 h. Front: `canSeeDriverPhone` zawsze dla KSH; eksport XLSX z Kierowca/Telefon. i2 §I-7a zaktualizowany. Bramka SMS / strefy **nietknięte**. |
| OPL-8 | opłaty wyłącznie ręcznie (§8; zastępuje auto I-32) | **DONE** | (ten commit) | 0115 PROD+TEST; tsc OK; i2 +13 (oczek. **512**); nullguard +15 (oczek. **488**) | Migracja **0115**: `load_agreed_fees` + `load_agreed_fee_add` (tylko HHL) + `fee_catalog_hints` (podpowiedź) + `load_dwell_info` (minuty, bez kwoty). UI: formularz w szufladzie (tab Finanse). Zero funkcji auto-naliczania. Bramka SMS / strefy **nietknięte**. |
| FAK-9 | faktury EUR lub PLN przy rejestracji (§9) | **DONE** | (ten commit) | vitest invoices3 **17/17**; CHECK currency EUR/PLN na `invoices`; `register_invoice` + `BillsPanel` wybór EUR/PLN + FX NBP A per pozycja | Już w M6/invoices3 — potwierdzone względem §9 (wybór waluty, PLN = EUR×kurs transportu, marża w EUR). Zestawienie tygodniowe = istniejący tydzień faktury. Bramka SMS / strefy **nietknięte**. |
| HIST-11 | pełna historia zmian (§11) | **DONE** | (ten commit) | 0118 PROD+TEST; hist11 **11/11**; tsc OK; i2 +3 (oczek. **515**); nullguard +5 (oczek. **513**) | Migracja **0118**: `audit_log.source`; `audit_row_change` → `current_app_user_id` (ADM-10 acting_as) + source z `tower.audit_source` / `system`; wyzwalacze ROW_* na **37** tabelach biznesowych (konta, ustawienia, dokumenty, decyzje, opłaty…); RPC `admin_audit_history` (filtry kto/kiedy/obiekt/rodzaj + szukaj). UI Opcje → „Historia zmian” (było→jest, automat, eksport CSV/XLSX). Dry-run PROD ROLLBACK OK → `db push`; TEST: SQL + `schema_migrations`. Bramka SMS / strefy **nietknięte**. |
| STENA-3 | Stena Line Gdynia–Karlskrona (§3) | **DONE** | (ten commit) | 0119+0120 PROD+TEST; **bez nowej migracji schema** (fundament); ferry **23/23**; integrations **27/27** (Stena+403) | Rozkład+status: JSON AEM Stena; źródło `STENA`. AIS: port Karlskrona; Digitraffic 01.10 = 0 pozycji Spirit/Estelle/Ebba (brak ≠ opóźnienie). Edge ferry-* wdrożone PROD. **Luki:** ETA (II-7), pogoda (II-8), opóźnienie AIS (II-9), trasa alt. w ryzykach; współrzędne terminali. |
| II-5 | komunikaty armatorów — odczyt teraz | **DONE** | (ten commit) | j.w. | Parser Polferries + Stena status; 403→NIEZNANY+ryzyko Cloudflare. D-18 e-mail informacyjny zostaje. |
| II-6 | Trafikverket E4 — warunki + spowolnienie SE | **DONE** | (ten commit) | **0121** PROD+TEST (dry-run ROLLBACK OK → push); integrations road-se; Edge `road-se` wdrożony | Live: **RoadCondition** + **WeatherMeasurepoint** (Situation **nie istnieje** w Open API 01.10). `corridor_conditions.SE_E4` + `SE_ROAD_SLOWDOWN_PCT=15`. KPD/TomTom nadal DEMO. |
| II-7 | własny silnik ETA OSM (ODbL); HERE nie | **DONE** | (ten commit) | **0122** PROD+TEST (dry-run ROLLBACK OK → push); corridor-eta vitest **6/6**; ferry/integrations OK; i2 +9 (oczek. hosted **524** / lokal **519**) | `corridor_polylines` PL+SE; `corridor_progress`; `compute_load_eta` → **ETA v2 (OSM)** (locate, tempo D-9/I-15, SE×slowdown II-6, rejs GDN-NYN\|GDY-KAA, attribution); ryzyka off-corridor >2 km + ETA_BREACH > DELAY_MIN; UI szuflada ODbL. Bez GPS = jak v1. |
| II-7b | kalibracja ucząca się — szkielet | **SZKIELET** | (ten commit) | **0123** PROD+TEST; nullguard +10 (oczek. hosted **523**) | Tabele `eta_segment_observations` / `eta_calibration_versions`; `admin_set_eta_calibration_frozen` + `apply_eta_calibration_version`. **Pełna nauka + symulacja 30 → TELM-2 / D-TELM-ETA.** |
| II-9 | opóźnienie wypłynięcia z AIS | **DONE** | (ten commit) | ferry **+3**; Edge `ferry-ais` wdrożony PROD | `aisDepartureDelayMin`: dystans/SOG vs cutoff; brak pozycji ≠ opóźnienie; ryzyko `rk_ais_departure_delay`. Digitraffic PL nadal często bez sygnału. |

| II-8 | pogoda morska FMI+DMI+SMHI; progi D-39 | **DONE** | (ten commit) | **0124** PROD+TEST (dry-run ROLLBACK OK → push); Edge `ferry-weather` wdrożony; cron `tower-ferry-weather` 15 */6; marine-weather vitest **10/10**; integrations ferry-weather **3/3**; LIVE: wave **1,17 m**, gust **≈20 kn**, risk niskie, źródła FMI+DMI (+SMHI ocobs Knolls) | Punkty GDN/MID/NYN ±6 h; progi `WAVE_M`/`GUST_KN` (3,8 m / 40 kn, etykiety D-39); ryzyko `rk_ferry_weather`; UI Ryzyka: atrybucja CC BY 4.0. IMGW pominięte (umowa). SMHI metfcst API 404 — tylko ocobs. DMI czasem 429 (retry+FMI). |
| I-29 | budżety darmowych planów × 140 transportów | **DONE** | (ten commit) | — | Tabela szczyt vs limit w `I29_BUDGETY_140.md`: Resend/SMS/baza/Edge/TV/FMI — wszystkie OK; Edge ≈22–25k/mies. ≪ 500k. |
| CLEAN-TT-HERE | TomTom/HERE martwy kod | **DONE** | (ten commit) | integrations traffic-flow **1/1** DEMO; bez `TOMTOM_API_KEY` w run-job | Usunięte `parseTomTomFlow`/`tomtomFlowUrl`/`flowRisk`; Edge `traffic-flow` stub DEMO; i18n rk_src_TOMTOM „wycofane”; ZRODLA §2.3. Fixture `tomtom-flow-sample.json` zostaje (archiwum testowe, nieużywane). |

| D-27 | kontrast WCAG AA (≥4,5:1) | **DONE** | (ten commit) | tokeny --ink-3 / --amber-ink; bell-badge; kursor | Jasny --ink-3=#5A6B78; ciemny #788C9A; tekst ostrzeżeń --amber-ink=#A55A00; badge dzwonka #0E1A24 na --red; thead/tbody cursor:default (aktywne = [tabindex]). Wzorzec bramy wizualnej do odświeżenia (G4). |
| UI-12 | interfejs §12 | **DONE** | (ten commit) | Nav session + Docs/Schedule | Użytkownik/rola/Wyloguj w lewym menu (nie fixed bottom); POD i mocowanie usunięte z UI; CMR zostaje (SCX/HHL). |
| D-30 | polisy: cron + formularz HHL/przewoźnik | **DONE** | (ten commit) | **0125** PROD+TEST; insurance **42/42**; tsc OK; RESP-14 phone **3/3** | Migracja **0125**: `approval_status` PENDING/APPROVED/REJECTED; `insurance_policy_approve`; detect tylko APPROVED; cron `tower-polisy` 10 4 * * * (PROD). UI: `InsurancePolicyForm` w Dokumentach (SCX wpisuje → HHL zatwierdza; HHL zapis = od razu APPROVED); notka z bazy. Dane polisy od przewoźnika — po spotkaniu. |
| D-31 | pasek górny 390 px | **DONE** | (ten commit) | CSS ≤430; resp14-phone 390/768 | Ukryty lang+roleswitch na wąskim; brand ściśnięty; `overflow-x:clip` (bez scrollu poziomego przy theme). **Wzorzec 390 nie odświeżany** — G4-D27-D31. |
| RESP-14 | telefon/PWA dokończenie | **DONE** | (ten commit) | resp14-phone **3/3**; LH viewport=1 a11y=1 | Brama 390/768 overflow; menu sesja; skrypt `lh:resp14`. Installable/SW na HTTPS prod. §12 user = UI-12. |
| HHL-4a | nr zlecenia HHL (§4a) | **DONE** | (ten commit) | UI awizacja/szuflada | Dodaj/Edytuj nr HHL działa; zapis zwrotny do pliku KSH = II-10-E2 / D-33. |

**Następne:** kolejka P0–P1 bez blockerów właściciela — **wyczerpana** (G4-D27-D31 DONE 02.10).
**Czeka na właściciela:**
- **D-32** — zgoda IT KSH + creds SharePoint → `.env.local` (blokuje II-10-E1)
- **D-TELM-ETA / TELM-2** — API emtrack + przykłady linków (blokuje II-7b naukę)
- **ZEZW-13** — wymiary aut (P2)
- **D-18** — e-mail informacyjny do armatora (II-5 odczyt już DONE)
- **D-17** — cert KPD GDDKiA
- dane polisy OCP po spotkaniu SCX
- II-10-E2 — pisemna akceptacja po E1
- **R-2 / D-16** — właściciel sam dodaje użytkowników w aplikacji (zaproszenia odblokowane 0133)
- **R-1** — import prawdziwego harmonogramu na PROD
- pełne `EXTERNAL_MESSAGING` (SMS do kierowców) — osobna decyzja HHL_ADMIN

| I-3-APK | bramka Android | **DONE** | (ten commit) | burst **10/10 DELIVERED**; strefy **0116** ON | Zamknięte decyzją koordynatora 02.10 (po teście stabilności + burst). |
| DEC-2/3/4 | skutki + macierz powiadomień | **DONE** | (ten commit) | **0126** PROD+TEST (dry-run ROLLBACK OK → apply); dec2 **18/18**; dec3 **10/10** | `matrix_notify` + skutki opcji; wyzwalacze status/ryzyko/strefa; UI hint. |
| AUTH-MAIL | szablony e-mail Auth „Watch Tower” | **DONE** 02.10 | — | Management API PATCH `config/auth` (bez wysyłki) | Tematy + treści: confirmation/invite/magic_link/recovery/email_change — wszystkie zawierają „Watch Tower”. |
| MIG-PARITY | lista migracji repo = PROD | **DONE** 02.10 | `e2947d70` | LOCAL 126 = PROD 126 (`0001`…`0126`); missing 0 | Commit + push `e2947d70`. |

#### Zmiany oczekiwań bramy (sesja 01–02.10) — `scripts/test-db-gate.mjs` / `tests/db/gate.sh`

| Zestaw | Było (przed sesją / `59a5ce49`) | Jest | Dlaczego (test za zmianą) |
|---|---|---|---|
| nullguard (hosted) | 473 | **523** → **528** | + `insurance_policy_approve` w `null-guard-calls.txt` (GUARD ×4 + pozytywne HHL). Migawka: pomija `audit_log` entity=`app_users` — HIST-11 `trg_audit_row` zapisuje ROW_UPDATE przy przełączaniu `active` w teście (34→38 to nie wyciek rollbacku). |
| i2 (hosted) | 510 → w trakcie 499/512/515… | **524** | DATY-67, I-7a, OPL-8 (+13), HIST-11 (+3), II-7 (+9) — sekcje w `tests/db/i2.sh` |
| dec2 | 14 | **18** | **0126** skutki opcji — `tests/db/dec2.sh` |
| money | 130 | **131** | M5: asercja numerów precyzyjna + `RISK_OPEN/RESOURCE_MISSING` (0127); test w `money.sh` |
| dec3 | 8 | **10** → **13** | **0126** macierz + wyzwalacze; **0127** +3 asercje mapowania kind→grupa (`tests/db/dec3.sh`) |
| adm10 | (brak) | **8** | nowy `tests/db/adm10.sh` (0117) |
| hist11 | (brak) | **11** | nowy `tests/db/hist11.sh` (0118) |
| insurance | 33 | **42** | **0125** approve/cron — `tests/db/insurance.sh` |
| workflows | 46 | **47** | +chk T-BOOM w kolejce; RETRY: pin `next_attempt_at` do osi testu (po 01.10.2026 `now()` > p_now testu) |
| migracje (hosted) | 126 | **127** | **0127** `risk_matrix_group_map` |
| nullguard (lokal `gate.sh`) | 379 | **389** | lokalna lista wywołań (bez pełnego hosted) — do weryfikacji na czystej bramie |
| i2 (lokal `gate.sh`) | 510 | **519** | jak i2 hosted, podzbiór lokalny |

**Allowlist (nie EXPECTED):** pierwsza czysta brama 02.10 → security **83 OK / 1 FAIL**: brak `authenticated insurance_policy_approve` w `function-allowlist.txt` mimo grantu w **0125** i testów w `insurance.sh` (approve/reject HHL, odmowa KSH). **Dopisano do allowlist** — EXPECTED security **84** bez zmiany (FAIL → OK).

**money FAIL (naprawa 0127 + precyzja asercji M5):** czysta brama → money **129/130**: `KSH nie dostaje przypomnień o numerach` (otrzymano 5→3, oczekiwano 0).
1. **0126** mapował `RESOURCE_MISSING` → `RISK_FERRY_WEATHER` (KSH IN_APP). **0127** — tylko `FERRY`/`WEATHER`/`ETA_BREACH` → ta grupa; reszta → `SYSTEM`. Test: `dec3.sh` +3. 
2. Asercja M5 była `count(*) from notifications = 0` — za szeroka: M3 (`plan_delivery_*`) po **0113** tworzy `PLAN_DATES_CHANGED` dla KSH (zamierzone). **Było:** cisza całkowita. **Jest:** `ORDER_NO_MISSING = 0` + nowa asercja `RISK_OPEN+RESOURCE_MISSING = 0`. EXPECTED money **130 → 131**.

**D-STENA-COORDS — DONE 02.10** (właściciel potwierdził terminale):
- Gdynia (54.53321, 18.54425): https://www.google.com/maps?q=54.53321,18.54425
- Karlskrona (56.16460, 15.63080): https://www.google.com/maps?q=56.16460,15.63080

**i2 / workflows (czysta brama 02.10):**
- i2 SMS: TEL-1 — test ustawiał `driver_phone='+4670…'` przy domyślnym `driver_phone_country='PL'` → E.164 `+48467…` → locale pl. **Jest:** `0701234567` + `country='SE'`.
- i2 HIST-11: `(…)::text` → **true** (nie `t`).
- i2 II-7: UUID `…ii70` (nie-hex) — INSERT cicho padał → `…a170`.
- workflows: re-apply tylko 0094–0096; R-2 czyści EMAIL; RETRY pinuje `next_attempt_at` do 2026-10-01. EXPECTED **47**.

*Czysta brama hosted — pełny bieg po poprawkach (02.10).*

### Raport wznowienia po awarii (02.10 popołudnie)

| Pozycja | Status | Wynik |
|---|---|---|
| E2E `tests/e2e-core.spec.ts` | DONE | selektory awizacji `label.form-field` Kierowca/Ciągnik; telefon 390 → `button.phone-menu-btn` |
| G4 visual-states + smoke | DONE | 11× stan + 4× smoke odświeżone — **BRAND-15 + D-27** (nie regresja) |
| G4 matryca 840 | DONE | SHA: **840/840 zmienione**, 0 bez przyczyny; odświeżone (`G4_WZORZEC.md`) |
| **0128** | DONE PROD+TEST | tylko `(select auth.uid())` w 4 politykach |
| commit + push | DONE | `b34a2236` — LOCAL HEAD = origin/HEAD |
| vercel --prod | DONE | `dpl_4Dy6w3KdB4xt1kytHWFtEU4Ab5pX` READY; Aliased `tower.log-mar.pl` |
| domeny | DONE | `tower.log-mar.pl` **200**, `watch-tower-makieta.vercel.app` **200** |

**0128 — ostrzeżenia doradcy świadomie NIE zmieniane:**
- **security_definer_view** `v_load_*` — zamierzone (0010): tabele `load_cost`/`load_revenue` bez GRANT dla API; widok = właściciel + filtr WHERE + `security_barrier`. Bez porównania HHL/KSH/SCX przed/po → **nie ruszamy**.
- **rls_disabled_in_public** `spatial_ref_sys` — PostGIS (`supabase_admin`), chronione wyzwalaczem **0031**; RLS nie włączamy.
- **st_estimatedextent** anon EXECUTE — właściciel `supabase_admin`; `REVOKE` nie zmienia ACL (grantor admin) — **bez zmiany**.

**Brama TEST (0128, 128 mig):** security…import OK (wcześniejszy bieg); remainder: nullguard **528**, i2 **524**, i30 **10**, i31 **6**, dec2 **18**, dec3 **13**, dec5 **11**, dec6 **15**, adm10 **8**, hist11 **11**, workflows **47**, insurance **42** — wszystkie 0 FAIL.

| Zestaw EXPECTED | Było | Jest | Dlaczego |
|---|---|---|---|
| migracje (hosted) | 127 | **128** | **0128** `advisor_security_perf` |
| subset i30/i31 | (brak w subset) | **10 / 6** | dopisane do `test-db-gate.mjs` + `test-db-gate-subset.mjs` |

**EXPECTED i30/i31 — potwierdzenie 02.10:** `node scripts/test-db-gate-subset.mjs i30 i31` → i30 **10/10**, i31 **6/6**, **EXIT=0**.

### Rytm: niedzielna czysta brama TEST

| Bieg | Data | Wynik |
|---|---|---|
| (następny) | **niedziela 05.10.2026** | — pełny `test-db-gate.mjs` od zera; wynik tutaj |

### Stan po wznowieniu (02.10)

### BRAND-15 uzupełnienie (02.10) — 404 i szablony

| Pozycja | Status | Wynik |
|---|---|---|
| 404 `prodStrip` | DONE | tytuł/link „Watch Tower — nie znaleziono” |
| makiety `public/` | DONE | tytuł + brand |
| MFA / e-maile / notify | DONE | Watch Tower zamiast TOWER w UI/szablonach |
| testy | DONE | o2-prod-strip, i5-mfa, keep-alive, usage |

### Przed pilotażem — kolejka (02.10)

| ID | Status | Wynik |
|---|---|---|
| BRAND+deploy | DONE | `4a274d10` push; Vercel `watch-tower-makieta` READY → `tower.log-mar.pl`; obie domeny **200**; 404 = Watch Tower |
| DR-TEST | **DONE** | `node scripts/dr-test-restore.mjs` → TEST `emkbykwenwrjmbprydml`, schemat `restore_20261002`. **RESTORE OK tabel=67 wierszy=4920** (= manifest). **ELAPSED_SEC=20**. Klucz age tylko lokalnie — właściciel może usunąć plik. |
| SIM-1 | **DONE** | Pełny przebieg `sim1-full-transport.mjs` na TEST: READY→AT_LOADING→IN_TRANSIT_PL→AT_PORT_GDANSK→FERRY→AT_PORT_NYNASHAMN→IN_TRANSIT_SE→**AT_SITE**; pozycje=16, zdarzenia=58, ryzyka=2, powiadomienia=155 (IN_APP 151 PENDING, EMAIL 4 BLOCKED_R2); ETA site 07.10 12:05; SMS 1× OWNER (zamaskowany), inne numery=0. |
| LOAD-1 | **DONE** | `scripts/load1-stress.mjs`: seed **140** w 570 ms; 20 użytkowników (3 role) falami×8 (limit Session pooler 15). Czasy ms — kokpit p50 **386** / p95 **475**; harmonogram p50 **319** / p95 **373**; mapa p50 **88** / p95 **153**; wall 4580 ms. LOADS_TOTAL=143. |
| DOC-ROLE | **DONE** | Teksty 1-stronicowe PL: `docs/handover/instrukcje/HHL.md`, `KSH.md`, `SCX.md`. W aplikacji: panel „Instrukcja” (`Guide.tsx`) — HHL w Opcjach, KSH/SCX w Ustawieniach, kierowca w PWA; rozszerzone `i4_hhl_7/8`, `i4_ksh_7`, `i4_scx_7` (PL/EN/SV). Commit `4971ffbf`. |
| DAILY-1 | **DONE** (+0130) | Okno = **ostatnie 24 h** (`created_at` / `last_seen_at`). **sms_failed=10**: anulowana seria TEST bursta 01.10 19:58 PL (`burst 1.0.1: CLAIMED bez SENT…`) — nadal w oknie 24 h w chwili raportu; **nie bug zakresu**. **client_error_types**: było 10 wierszy (głównie Leaflet `_leaflet_pos` + 1× stale chunk BroadcastForm). Naprawy: `CorridorMap` safeInvalidate; `lazyRetry` w Opcjach; migracja **0130** = `count(distinct fingerprint)` (dry-run → **4** typy). |
| Deploy `4971ffbf`+naprawy | **DONE** | Usunięto 3× UNKNOWN. Pętla 30 min **STOP**. Jedno `vercel --prod` (kopia bez `.git`) → `dpl_HbRcgv8…` **READY**, alias `tower.log-mar.pl`. |

### II-6/II-8 cron + panel SE + send-notifications (02.10)

| Pozycja | Status | Wynik |
|---|---|---|
| Cron `road-se` | **DONE** | migracja **0131** PROD+TEST: `tower-road-se` `*/15 * * * *`; Edge przeładowany; ręczny przebieg po wdrożeniu |
| Cron `ferry-weather` | **DONE** | **0131**: było `15 */6` → `15 * * * *` (co 1 h) |
| Cron `ferry-status` | **DONE** | **0132** PROD+TEST: `tower-ferry-status` `*/15`; ręczny przebieg LIVE `inserted=8 unchanged=10` |
| Panel „Warunki drogowe SE” | **DONE** | przyczyna „brak źródła”: `shows('roadSituationsSe')=false` w PROD mimo żywych danych w `corridor_conditions`. Naprawa: odczyt z bazy (`corridorConditionsDb`); „brak źródła” tylko gdy brak żywego wiersza. **Zrzut po wdrożeniu:** `tmp-se-panel-e4.png` — `NO_SOURCE=0`, sub `Trafikverket · ×1.00`, nota `RC 25 · WX 115 · sytuacji: 0 · 2.10.2026, 17:22:38` |
| send-notifications | **DONE** | 1 fail / 1740: `Gateway Timeout` 28.09 23:00 UTC (przejściowy). Od wtedy same `ok`. Timeout HTTP cron 60→**90 s** (0131) |

#### Przegląd harmonogramów integracji Edge (02.10)

| Integracja | Harmonogram | Powód braku / uwagi |
|---|---|---|
| `road-se` | **`*/15 * * * *`** (`tower-road-se`) | LIVE Trafikverket → `corridor_conditions` + ROAD_SE |
| `ferry-weather` | **`15 * * * *`** (`tower-ferry-weather`) | FMI+DMI+SMHI → `marine_conditions` |
| `ferry-ais` | `*/10 * * * *` | działa |
| `send-notifications` | `*/5 * * * *` | timeout 90 s |
| `usage-check` | `0 5 * * *` | działa |
| `backup-export` | `30 0 * * *` | włączony; wymaga R2 |
| `ferry-status` | **`*/15 * * * *`** (`tower-ferry-status`) | **0132** PROD+TEST — II-5/STENA LIVE |
| `ferry-schedule` | **`0 5 * * 1`** (`tower-ferry-schedule`) | **0134** — zgoda właściciela 02.10; poniedziałek 05:00 UTC |
| `road-pl` | **brak** | KPD DATEX bez URL/cert → DEMO; cron zapisałby atrapy |
| `traffic-flow` | **brak** | CLEAN-TT-HERE: zawsze DEMO |
| `fuel-wob` | **brak** | `FUEL_WOB_INGEST` wyłączony (D-2) |
| `document-archive` | **brak** | czeka na R2 / Cloudflare |
| `driver-photo` | **brak** | na żądanie (kierowca) |
| `daily-admin-digest` | `0 5 * * *` (SQL) | nie Edge |

### Przekazanie 02.10 (OSTATNIE POLECENIE) — STOP dla tego wykonawcy

| Pozycja | Status | Wynik |
|---|---|---|
| Commit + push | **DONE** | `324ab953` — panel SE + corridorConditionsDb + 0131–0134 + SIM-1 + reguła migracji |
| Migracje repo = PROD | **DONE** | `0001`…`0134` na PROD+TEST (naprawa timestamp→0131/0132; `db push` 0133+0134) |
| Reguła: migracja w gicie przed PROD | **DONE** | `.cursor/rules/baza.mdc`, `tower.mdc`, `AGENTS.md` (+ wzorzec) |
| D-STENA-COORDS | **DONE** | właściciel potwierdził terminale Gdynia/Karlskrona |
| BLOCKED_R2 częściowo | **DONE** | **0133:** e-mail do `app_users` + aktywnych `user_invites` = PENDING; SMS kierowców nadal zablokowane; PROD: 0× BLOCKED_R2 |
| Cron `ferry-schedule` | **DONE** | **0134** `tower-ferry-schedule` `0 5 * * 1` |
| Deploy Vercel | **DONE** | `dpl_GY6p4iMx…` READY na `watch-tower-makieta`; Aliased `tower.log-mar.pl`; obie domeny **200** (`tower.log-mar.pl`, `watch-tower-makieta.vercel.app`). (Pierwsza próba robocopy pełna → ENOSPC; potem slim bez shots; przypadkowy projekt `tower-vercel-slim-*` usunięty) |
| SIM-1 | **DONE** | pełny tor TEST → AT_SITE |

#### Stan końcowy — zrobione / otwarte / czeka na właściciela

**Zrobione:** II-6/II-8 crony, panel SE z DB, send-notifications timeout, ferry-status+ferry-schedule, 0133 messaging, D-STENA-COORDS, DR-TEST, SIM-1, LOAD-1, DOC-ROLE, DAILY-1, BRAND, reguła migracji-przed-PROD, commit `324ab953`, deploy `dpl_GY6p4iMx…`.

**Otwarte (kolejny wykonawca):** R-1 import; R-2 zaproszenia w UI (właściciel dodaje konta); R-3; II-10-E1/E2; II-7b; pełne EXTERNAL_MESSAGING gdy HHL włączy SMS.

**Czeka na właściciela:** D-32, D-TELM-ETA, ZEZW-13, D-17, D-18, D-16, polisy OCP, II-10-E2, ewentualnie `admin_set_external_messaging(true)`.

**ZATRZYMANE — pracę przejmuje inny wykonawca.**

**Czekam także (dane):** IT KSH (SharePoint / D-32); API emtrack + linki; wymiary aut; polisy OCP. **DR-TEST zakończony — właściciel może usunąć klucz age.**

### 2026-10-03 — PB-2

Wcześniej czerwone testy aplikacji, liczby z kodu: przewodnik i4 (`tests/i4-guide.test.ts`) — HHL ma 8 kroków, nie 7; KSH i SCX mają po 7, nie 6 (`EXPECT`: hhl 8, ksh 7, scx 7). Klucze ryzyk (`tests/risk-keys.test.ts`) — lista 12 źródeł (`SOURCE_IDS`), nie asercja `toBe(6)`.

### 2026-10-03 — PB-3 i kokpit (scalenie zablokowane)

Dwa trafienia score 70 w `scripts/bundle-size.mjs`: skrypt uruchamiany tylko przy budowaniu, nie trafia do aplikacji. Zaakceptowane ryzyko. Feed Aikido w workspace Spawn2018 zwraca 400 (funkcja wyłączona), więc oznaczenia w panelu Aikido nie da się zapisać. Zapis jest tutaj.

Kokpit, ujęcie `kokpit__hhl__pl__1920__light`: 18579 px przy progu 60. Układ i treść zgodne ze wzorcem. Różnica na krawędziach liter (antyaliasing), nie z D-27, BRAND-15, RESP-14 ani UI-12. Wzorca nie odświeżono. SCALENIE ZABLOKOWANE do decyzji właściciela.

### 2026-10-03 — wyjątek wizualny PR #2

Wyjątek — test wizualny czerwony także na main, naprawa w P1-FONT. Kokpit 18579 px przy progu 60. Przyczyna: czcionka z Google Fonts, różne pliki na różnych systemach. Nie jest błędem gałęzi `fix/przejecie-testy-02-10`.

### 2026-10-03 — P1-FONT, zmiana źródła czcionki

Aikido HIGH w `scripts/bundle-size.mjs` to fałszywy alarm (odczyt tylko z listy `assetFiles`). Właściciel oznacza ręcznie w panelu Aikido. Bez komentarza ignore w kodzie.

Zmiana źródła czcionki: Barlow 400/500/600/700 i Barlow Condensed 500/600/700 z repozytorium (`public/fonts/*.woff2`, licencja SIL OFL 1.1 w `OFL-Barlow.txt`). Zero połączeń do fonts.googleapis.com i fonts.gstatic.com w aplikacji, makietach i CSP. Stylelint `src/index.css`: 0 błędów (clip, id, !important) bez wyłączania reguł.

Wzorzec odświeżony w środowisku bramy. Matryca `shots-baseline`: **840** ujęć. Playwright `tests/__screenshots__`: **15** ujęć. `baseline.mjs`: ok=840 fail=0.

Lista ujęć, które się zmieniły:

- `shots-baseline/automatyzacje__hhl__en__1280__dark-default.png`
- `shots-baseline/automatyzacje__hhl__en__1280__light.png`
- `shots-baseline/automatyzacje__hhl__en__1440__dark-default.png`
- `shots-baseline/automatyzacje__hhl__en__1440__light.png`
- `shots-baseline/automatyzacje__hhl__en__1920__dark-default.png`
- `shots-baseline/automatyzacje__hhl__en__1920__light.png`
- `shots-baseline/automatyzacje__hhl__en__390__dark-default.png`
- `shots-baseline/automatyzacje__hhl__en__390__light.png`
- `shots-baseline/automatyzacje__hhl__en__768__dark-default.png`
- `shots-baseline/automatyzacje__hhl__en__768__light.png`
- `shots-baseline/automatyzacje__hhl__pl__1280__dark-default.png`
- `shots-baseline/automatyzacje__hhl__pl__1280__light.png`
- `shots-baseline/automatyzacje__hhl__pl__1440__dark-default.png`
- `shots-baseline/automatyzacje__hhl__pl__1440__light.png`
- `shots-baseline/automatyzacje__hhl__pl__1920__dark-default.png`
- `shots-baseline/automatyzacje__hhl__pl__1920__light.png`
- `shots-baseline/automatyzacje__hhl__pl__390__dark-default.png`
- `shots-baseline/automatyzacje__hhl__pl__390__light.png`
- `shots-baseline/automatyzacje__hhl__pl__768__dark-default.png`
- `shots-baseline/automatyzacje__hhl__pl__768__light.png`
- `shots-baseline/automatyzacje__hhl__sv__1280__dark-default.png`
- `shots-baseline/automatyzacje__hhl__sv__1280__light.png`
- `shots-baseline/automatyzacje__hhl__sv__1440__dark-default.png`
- `shots-baseline/automatyzacje__hhl__sv__1440__light.png`
- `shots-baseline/automatyzacje__hhl__sv__1920__dark-default.png`
- `shots-baseline/automatyzacje__hhl__sv__1920__light.png`
- `shots-baseline/automatyzacje__hhl__sv__390__dark-default.png`
- `shots-baseline/automatyzacje__hhl__sv__390__light.png`
- `shots-baseline/automatyzacje__hhl__sv__768__dark-default.png`
- `shots-baseline/automatyzacje__hhl__sv__768__light.png`
- `shots-baseline/dokumenty__hhl__en__1280__dark-default.png`
- `shots-baseline/dokumenty__hhl__en__1280__light.png`
- `shots-baseline/dokumenty__hhl__en__1440__dark-default.png`
- `shots-baseline/dokumenty__hhl__en__1440__light.png`
- `shots-baseline/dokumenty__hhl__en__1920__dark-default.png`
- `shots-baseline/dokumenty__hhl__en__1920__light.png`
- `shots-baseline/dokumenty__hhl__en__390__dark-default.png`
- `shots-baseline/dokumenty__hhl__en__390__light.png`
- `shots-baseline/dokumenty__hhl__en__768__dark-default.png`
- `shots-baseline/dokumenty__hhl__en__768__light.png`
- `shots-baseline/dokumenty__hhl__pl__1280__dark-default.png`
- `shots-baseline/dokumenty__hhl__pl__1280__light.png`
- `shots-baseline/dokumenty__hhl__pl__1440__dark-default.png`
- `shots-baseline/dokumenty__hhl__pl__1440__light.png`
- `shots-baseline/dokumenty__hhl__pl__1920__dark-default.png`
- `shots-baseline/dokumenty__hhl__pl__1920__light.png`
- `shots-baseline/dokumenty__hhl__pl__390__dark-default.png`
- `shots-baseline/dokumenty__hhl__pl__390__light.png`
- `shots-baseline/dokumenty__hhl__pl__768__dark-default.png`
- `shots-baseline/dokumenty__hhl__pl__768__light.png`
- `shots-baseline/dokumenty__hhl__sv__1280__dark-default.png`
- `shots-baseline/dokumenty__hhl__sv__1280__light.png`
- `shots-baseline/dokumenty__hhl__sv__1440__dark-default.png`
- `shots-baseline/dokumenty__hhl__sv__1440__light.png`
- `shots-baseline/dokumenty__hhl__sv__1920__dark-default.png`
- `shots-baseline/dokumenty__hhl__sv__1920__light.png`
- `shots-baseline/dokumenty__hhl__sv__390__dark-default.png`
- `shots-baseline/dokumenty__hhl__sv__390__light.png`
- `shots-baseline/dokumenty__hhl__sv__768__dark-default.png`
- `shots-baseline/dokumenty__hhl__sv__768__light.png`
- `shots-baseline/dokumenty__ksh__en__1280__dark.png`
- `shots-baseline/dokumenty__ksh__en__1280__light-default.png`
- `shots-baseline/dokumenty__ksh__en__1440__dark.png`
- `shots-baseline/dokumenty__ksh__en__1440__light-default.png`
- `shots-baseline/dokumenty__ksh__en__1920__dark.png`
- `shots-baseline/dokumenty__ksh__en__1920__light-default.png`
- `shots-baseline/dokumenty__ksh__en__390__dark.png`
- `shots-baseline/dokumenty__ksh__en__390__light-default.png`
- `shots-baseline/dokumenty__ksh__en__768__dark.png`
- `shots-baseline/dokumenty__ksh__en__768__light-default.png`
- `shots-baseline/dokumenty__ksh__pl__1280__dark.png`
- `shots-baseline/dokumenty__ksh__pl__1280__light-default.png`
- `shots-baseline/dokumenty__ksh__pl__1440__dark.png`
- `shots-baseline/dokumenty__ksh__pl__1440__light-default.png`
- `shots-baseline/dokumenty__ksh__pl__1920__dark.png`
- `shots-baseline/dokumenty__ksh__pl__1920__light-default.png`
- `shots-baseline/dokumenty__ksh__pl__390__dark.png`
- `shots-baseline/dokumenty__ksh__pl__390__light-default.png`
- `shots-baseline/dokumenty__ksh__pl__768__dark.png`
- `shots-baseline/dokumenty__ksh__pl__768__light-default.png`
- `shots-baseline/dokumenty__ksh__sv__1280__dark.png`
- `shots-baseline/dokumenty__ksh__sv__1280__light-default.png`
- `shots-baseline/dokumenty__ksh__sv__1440__dark.png`
- `shots-baseline/dokumenty__ksh__sv__1440__light-default.png`
- `shots-baseline/dokumenty__ksh__sv__1920__dark.png`
- `shots-baseline/dokumenty__ksh__sv__1920__light-default.png`
- `shots-baseline/dokumenty__ksh__sv__390__dark.png`
- `shots-baseline/dokumenty__ksh__sv__390__light-default.png`
- `shots-baseline/dokumenty__ksh__sv__768__dark.png`
- `shots-baseline/dokumenty__ksh__sv__768__light-default.png`
- `shots-baseline/dokumenty__scx__en__1280__dark-default.png`
- `shots-baseline/dokumenty__scx__en__1280__light.png`
- `shots-baseline/dokumenty__scx__en__1440__dark-default.png`
- `shots-baseline/dokumenty__scx__en__1440__light.png`
- `shots-baseline/dokumenty__scx__en__1920__dark-default.png`
- `shots-baseline/dokumenty__scx__en__1920__light.png`
- `shots-baseline/dokumenty__scx__en__390__dark-default.png`
- `shots-baseline/dokumenty__scx__en__390__light.png`
- `shots-baseline/dokumenty__scx__en__768__dark-default.png`
- `shots-baseline/dokumenty__scx__en__768__light.png`
- `shots-baseline/dokumenty__scx__pl__1280__dark-default.png`
- `shots-baseline/dokumenty__scx__pl__1280__light.png`
- `shots-baseline/dokumenty__scx__pl__1440__dark-default.png`
- `shots-baseline/dokumenty__scx__pl__1440__light.png`
- `shots-baseline/dokumenty__scx__pl__1920__dark-default.png`
- `shots-baseline/dokumenty__scx__pl__1920__light.png`
- `shots-baseline/dokumenty__scx__pl__390__dark-default.png`
- `shots-baseline/dokumenty__scx__pl__390__light.png`
- `shots-baseline/dokumenty__scx__pl__768__dark-default.png`
- `shots-baseline/dokumenty__scx__pl__768__light.png`
- `shots-baseline/dokumenty__scx__sv__1280__dark-default.png`
- `shots-baseline/dokumenty__scx__sv__1280__light.png`
- `shots-baseline/dokumenty__scx__sv__1440__dark-default.png`
- `shots-baseline/dokumenty__scx__sv__1440__light.png`
- `shots-baseline/dokumenty__scx__sv__1920__dark-default.png`
- `shots-baseline/dokumenty__scx__sv__1920__light.png`
- `shots-baseline/dokumenty__scx__sv__390__dark-default.png`
- `shots-baseline/dokumenty__scx__sv__390__light.png`
- `shots-baseline/dokumenty__scx__sv__768__dark-default.png`
- `shots-baseline/dokumenty__scx__sv__768__light.png`
- `shots-baseline/faktury-przychodowe__hhl__en__1280__dark-default.png`
- `shots-baseline/faktury-przychodowe__hhl__en__1280__light.png`
- `shots-baseline/faktury-przychodowe__hhl__en__1440__dark-default.png`
- `shots-baseline/faktury-przychodowe__hhl__en__1440__light.png`
- `shots-baseline/faktury-przychodowe__hhl__en__1920__dark-default.png`
- `shots-baseline/faktury-przychodowe__hhl__en__1920__light.png`
- `shots-baseline/faktury-przychodowe__hhl__en__390__dark-default.png`
- `shots-baseline/faktury-przychodowe__hhl__en__390__light.png`
- `shots-baseline/faktury-przychodowe__hhl__en__768__dark-default.png`
- `shots-baseline/faktury-przychodowe__hhl__en__768__light.png`
- `shots-baseline/faktury-przychodowe__hhl__pl__1280__dark-default.png`
- `shots-baseline/faktury-przychodowe__hhl__pl__1280__light.png`
- `shots-baseline/faktury-przychodowe__hhl__pl__1440__dark-default.png`
- `shots-baseline/faktury-przychodowe__hhl__pl__1440__light.png`
- `shots-baseline/faktury-przychodowe__hhl__pl__1920__dark-default.png`
- `shots-baseline/faktury-przychodowe__hhl__pl__1920__light.png`
- `shots-baseline/faktury-przychodowe__hhl__pl__390__dark-default.png`
- `shots-baseline/faktury-przychodowe__hhl__pl__390__light.png`
- `shots-baseline/faktury-przychodowe__hhl__pl__768__dark-default.png`
- `shots-baseline/faktury-przychodowe__hhl__pl__768__light.png`
- `shots-baseline/faktury-przychodowe__hhl__sv__1280__dark-default.png`
- `shots-baseline/faktury-przychodowe__hhl__sv__1280__light.png`
- `shots-baseline/faktury-przychodowe__hhl__sv__1440__dark-default.png`
- `shots-baseline/faktury-przychodowe__hhl__sv__1440__light.png`
- `shots-baseline/faktury-przychodowe__hhl__sv__1920__dark-default.png`
- `shots-baseline/faktury-przychodowe__hhl__sv__1920__light.png`
- `shots-baseline/faktury-przychodowe__hhl__sv__390__dark-default.png`
- `shots-baseline/faktury-przychodowe__hhl__sv__390__light.png`
- `shots-baseline/faktury-przychodowe__hhl__sv__768__dark-default.png`
- `shots-baseline/faktury-przychodowe__hhl__sv__768__light.png`
- `shots-baseline/faktury__hhl__en__1280__dark-default.png`
- `shots-baseline/faktury__hhl__en__1280__light.png`
- `shots-baseline/faktury__hhl__en__1440__dark-default.png`
- `shots-baseline/faktury__hhl__en__1440__light.png`
- `shots-baseline/faktury__hhl__en__1920__dark-default.png`
- `shots-baseline/faktury__hhl__en__1920__light.png`
- `shots-baseline/faktury__hhl__en__390__dark-default.png`
- `shots-baseline/faktury__hhl__en__390__light.png`
- `shots-baseline/faktury__hhl__en__768__dark-default.png`
- `shots-baseline/faktury__hhl__en__768__light.png`
- `shots-baseline/faktury__hhl__pl__1280__dark-default.png`
- `shots-baseline/faktury__hhl__pl__1280__light.png`
- `shots-baseline/faktury__hhl__pl__1440__dark-default.png`
- `shots-baseline/faktury__hhl__pl__1440__light.png`
- `shots-baseline/faktury__hhl__pl__1920__dark-default.png`
- `shots-baseline/faktury__hhl__pl__1920__light.png`
- `shots-baseline/faktury__hhl__pl__390__dark-default.png`
- `shots-baseline/faktury__hhl__pl__390__light.png`
- `shots-baseline/faktury__hhl__pl__768__dark-default.png`
- `shots-baseline/faktury__hhl__pl__768__light.png`
- `shots-baseline/faktury__hhl__sv__1280__dark-default.png`
- `shots-baseline/faktury__hhl__sv__1280__light.png`
- `shots-baseline/faktury__hhl__sv__1440__dark-default.png`
- `shots-baseline/faktury__hhl__sv__1440__light.png`
- `shots-baseline/faktury__hhl__sv__1920__dark-default.png`
- `shots-baseline/faktury__hhl__sv__1920__light.png`
- `shots-baseline/faktury__hhl__sv__390__dark-default.png`
- `shots-baseline/faktury__hhl__sv__390__light.png`
- `shots-baseline/faktury__hhl__sv__768__dark-default.png`
- `shots-baseline/faktury__hhl__sv__768__light.png`
- `shots-baseline/faktury__ksh__en__1280__dark.png`
- `shots-baseline/faktury__ksh__en__1280__light-default.png`
- `shots-baseline/faktury__ksh__en__1440__dark.png`
- `shots-baseline/faktury__ksh__en__1440__light-default.png`
- `shots-baseline/faktury__ksh__en__1920__dark.png`
- `shots-baseline/faktury__ksh__en__1920__light-default.png`
- `shots-baseline/faktury__ksh__en__390__dark.png`
- `shots-baseline/faktury__ksh__en__390__light-default.png`
- `shots-baseline/faktury__ksh__en__768__dark.png`
- `shots-baseline/faktury__ksh__en__768__light-default.png`
- `shots-baseline/faktury__ksh__pl__1280__dark.png`
- `shots-baseline/faktury__ksh__pl__1280__light-default.png`
- `shots-baseline/faktury__ksh__pl__1440__dark.png`
- `shots-baseline/faktury__ksh__pl__1440__light-default.png`
- `shots-baseline/faktury__ksh__pl__1920__dark.png`
- `shots-baseline/faktury__ksh__pl__1920__light-default.png`
- `shots-baseline/faktury__ksh__pl__390__dark.png`
- `shots-baseline/faktury__ksh__pl__390__light-default.png`
- `shots-baseline/faktury__ksh__pl__768__dark.png`
- `shots-baseline/faktury__ksh__pl__768__light-default.png`
- `shots-baseline/faktury__ksh__sv__1280__dark.png`
- `shots-baseline/faktury__ksh__sv__1280__light-default.png`
- `shots-baseline/faktury__ksh__sv__1440__dark.png`
- `shots-baseline/faktury__ksh__sv__1440__light-default.png`
- `shots-baseline/faktury__ksh__sv__1920__dark.png`
- `shots-baseline/faktury__ksh__sv__1920__light-default.png`
- `shots-baseline/faktury__ksh__sv__390__dark.png`
- `shots-baseline/faktury__ksh__sv__390__light-default.png`
- `shots-baseline/faktury__ksh__sv__768__dark.png`
- `shots-baseline/faktury__ksh__sv__768__light-default.png`
- `shots-baseline/faktury__scx__en__1280__dark-default.png`
- `shots-baseline/faktury__scx__en__1280__light.png`
- `shots-baseline/faktury__scx__en__1440__dark-default.png`
- `shots-baseline/faktury__scx__en__1440__light.png`
- `shots-baseline/faktury__scx__en__1920__dark-default.png`
- `shots-baseline/faktury__scx__en__1920__light.png`
- `shots-baseline/faktury__scx__en__390__dark-default.png`
- `shots-baseline/faktury__scx__en__390__light.png`
- `shots-baseline/faktury__scx__en__768__dark-default.png`
- `shots-baseline/faktury__scx__en__768__light.png`
- `shots-baseline/faktury__scx__pl__1280__dark-default.png`
- `shots-baseline/faktury__scx__pl__1280__light.png`
- `shots-baseline/faktury__scx__pl__1440__dark-default.png`
- `shots-baseline/faktury__scx__pl__1440__light.png`
- `shots-baseline/faktury__scx__pl__1920__dark-default.png`
- `shots-baseline/faktury__scx__pl__1920__light.png`
- `shots-baseline/faktury__scx__pl__390__dark-default.png`
- `shots-baseline/faktury__scx__pl__390__light.png`
- `shots-baseline/faktury__scx__pl__768__dark-default.png`
- `shots-baseline/faktury__scx__pl__768__light.png`
- `shots-baseline/faktury__scx__sv__1280__dark-default.png`
- `shots-baseline/faktury__scx__sv__1280__light.png`
- `shots-baseline/faktury__scx__sv__1440__dark-default.png`
- `shots-baseline/faktury__scx__sv__1440__light.png`
- `shots-baseline/faktury__scx__sv__1920__dark-default.png`
- `shots-baseline/faktury__scx__sv__1920__light.png`
- `shots-baseline/faktury__scx__sv__390__dark-default.png`
- `shots-baseline/faktury__scx__sv__390__light.png`
- `shots-baseline/faktury__scx__sv__768__dark-default.png`
- `shots-baseline/faktury__scx__sv__768__light.png`
- `shots-baseline/finanse__hhl__en__1280__dark-default.png`
- `shots-baseline/finanse__hhl__en__1280__light.png`
- `shots-baseline/finanse__hhl__en__1440__dark-default.png`
- `shots-baseline/finanse__hhl__en__1440__light.png`
- `shots-baseline/finanse__hhl__en__1920__dark-default.png`
- `shots-baseline/finanse__hhl__en__1920__light.png`
- `shots-baseline/finanse__hhl__en__390__dark-default.png`
- `shots-baseline/finanse__hhl__en__390__light.png`
- `shots-baseline/finanse__hhl__en__768__dark-default.png`
- `shots-baseline/finanse__hhl__en__768__light.png`
- `shots-baseline/finanse__hhl__pl__1280__dark-default.png`
- `shots-baseline/finanse__hhl__pl__1280__light.png`
- `shots-baseline/finanse__hhl__pl__1440__dark-default.png`
- `shots-baseline/finanse__hhl__pl__1440__light.png`
- `shots-baseline/finanse__hhl__pl__1920__dark-default.png`
- `shots-baseline/finanse__hhl__pl__1920__light.png`
- `shots-baseline/finanse__hhl__pl__390__dark-default.png`
- `shots-baseline/finanse__hhl__pl__390__light.png`
- `shots-baseline/finanse__hhl__pl__768__dark-default.png`
- `shots-baseline/finanse__hhl__pl__768__light.png`
- `shots-baseline/finanse__hhl__sv__1280__dark-default.png`
- `shots-baseline/finanse__hhl__sv__1280__light.png`
- `shots-baseline/finanse__hhl__sv__1440__dark-default.png`
- `shots-baseline/finanse__hhl__sv__1440__light.png`
- `shots-baseline/finanse__hhl__sv__1920__dark-default.png`
- `shots-baseline/finanse__hhl__sv__1920__light.png`
- `shots-baseline/finanse__hhl__sv__390__dark-default.png`
- `shots-baseline/finanse__hhl__sv__390__light.png`
- `shots-baseline/finanse__hhl__sv__768__dark-default.png`
- `shots-baseline/finanse__hhl__sv__768__light.png`
- `shots-baseline/harmonogram__hhl__en__1280__dark-default.png`
- `shots-baseline/harmonogram__hhl__en__1280__light.png`
- `shots-baseline/harmonogram__hhl__en__1440__dark-default.png`
- `shots-baseline/harmonogram__hhl__en__1440__light.png`
- `shots-baseline/harmonogram__hhl__en__1920__dark-default.png`
- `shots-baseline/harmonogram__hhl__en__1920__light.png`
- `shots-baseline/harmonogram__hhl__en__390__dark-default.png`
- `shots-baseline/harmonogram__hhl__en__390__light.png`
- `shots-baseline/harmonogram__hhl__en__768__dark-default.png`
- `shots-baseline/harmonogram__hhl__en__768__light.png`
- `shots-baseline/harmonogram__hhl__pl__1280__dark-default.png`
- `shots-baseline/harmonogram__hhl__pl__1280__light.png`
- `shots-baseline/harmonogram__hhl__pl__1440__dark-default.png`
- `shots-baseline/harmonogram__hhl__pl__1440__light.png`
- `shots-baseline/harmonogram__hhl__pl__1920__dark-default.png`
- `shots-baseline/harmonogram__hhl__pl__1920__light.png`
- `shots-baseline/harmonogram__hhl__pl__390__dark-default.png`
- `shots-baseline/harmonogram__hhl__pl__390__light.png`
- `shots-baseline/harmonogram__hhl__pl__768__dark-default.png`
- `shots-baseline/harmonogram__hhl__pl__768__light.png`
- `shots-baseline/harmonogram__hhl__sv__1280__dark-default.png`
- `shots-baseline/harmonogram__hhl__sv__1280__light.png`
- `shots-baseline/harmonogram__hhl__sv__1440__dark-default.png`
- `shots-baseline/harmonogram__hhl__sv__1440__light.png`
- `shots-baseline/harmonogram__hhl__sv__1920__dark-default.png`
- `shots-baseline/harmonogram__hhl__sv__1920__light.png`
- `shots-baseline/harmonogram__hhl__sv__390__dark-default.png`
- `shots-baseline/harmonogram__hhl__sv__390__light.png`
- `shots-baseline/harmonogram__hhl__sv__768__dark-default.png`
- `shots-baseline/harmonogram__hhl__sv__768__light.png`
- `shots-baseline/harmonogram__ksh__en__1280__dark.png`
- `shots-baseline/harmonogram__ksh__en__1280__light-default.png`
- `shots-baseline/harmonogram__ksh__en__1440__dark.png`
- `shots-baseline/harmonogram__ksh__en__1440__light-default.png`
- `shots-baseline/harmonogram__ksh__en__1920__dark.png`
- `shots-baseline/harmonogram__ksh__en__1920__light-default.png`
- `shots-baseline/harmonogram__ksh__en__390__dark.png`
- `shots-baseline/harmonogram__ksh__en__390__light-default.png`
- `shots-baseline/harmonogram__ksh__en__768__dark.png`
- `shots-baseline/harmonogram__ksh__en__768__light-default.png`
- `shots-baseline/harmonogram__ksh__pl__1280__dark.png`
- `shots-baseline/harmonogram__ksh__pl__1280__light-default.png`
- `shots-baseline/harmonogram__ksh__pl__1440__dark.png`
- `shots-baseline/harmonogram__ksh__pl__1440__light-default.png`
- `shots-baseline/harmonogram__ksh__pl__1920__dark.png`
- `shots-baseline/harmonogram__ksh__pl__1920__light-default.png`
- `shots-baseline/harmonogram__ksh__pl__390__dark.png`
- `shots-baseline/harmonogram__ksh__pl__390__light-default.png`
- `shots-baseline/harmonogram__ksh__pl__768__dark.png`
- `shots-baseline/harmonogram__ksh__pl__768__light-default.png`
- `shots-baseline/harmonogram__ksh__sv__1280__dark.png`
- `shots-baseline/harmonogram__ksh__sv__1280__light-default.png`
- `shots-baseline/harmonogram__ksh__sv__1440__dark.png`
- `shots-baseline/harmonogram__ksh__sv__1440__light-default.png`
- `shots-baseline/harmonogram__ksh__sv__1920__dark.png`
- `shots-baseline/harmonogram__ksh__sv__1920__light-default.png`
- `shots-baseline/harmonogram__ksh__sv__390__dark.png`
- `shots-baseline/harmonogram__ksh__sv__390__light-default.png`
- `shots-baseline/harmonogram__ksh__sv__768__dark.png`
- `shots-baseline/harmonogram__ksh__sv__768__light-default.png`
- `shots-baseline/harmonogram__scx__en__1280__dark-default.png`
- `shots-baseline/harmonogram__scx__en__1280__light.png`
- `shots-baseline/harmonogram__scx__en__1440__dark-default.png`
- `shots-baseline/harmonogram__scx__en__1440__light.png`
- `shots-baseline/harmonogram__scx__en__1920__dark-default.png`
- `shots-baseline/harmonogram__scx__en__1920__light.png`
- `shots-baseline/harmonogram__scx__en__390__dark-default.png`
- `shots-baseline/harmonogram__scx__en__390__light.png`
- `shots-baseline/harmonogram__scx__en__768__dark-default.png`
- `shots-baseline/harmonogram__scx__en__768__light.png`
- `shots-baseline/harmonogram__scx__pl__1280__dark-default.png`
- `shots-baseline/harmonogram__scx__pl__1280__light.png`
- `shots-baseline/harmonogram__scx__pl__1440__dark-default.png`
- `shots-baseline/harmonogram__scx__pl__1440__light.png`
- `shots-baseline/harmonogram__scx__pl__1920__dark-default.png`
- `shots-baseline/harmonogram__scx__pl__1920__light.png`
- `shots-baseline/harmonogram__scx__pl__390__dark-default.png`
- `shots-baseline/harmonogram__scx__pl__390__light.png`
- `shots-baseline/harmonogram__scx__pl__768__dark-default.png`
- `shots-baseline/harmonogram__scx__pl__768__light.png`
- `shots-baseline/harmonogram__scx__sv__1280__dark-default.png`
- `shots-baseline/harmonogram__scx__sv__1280__light.png`
- `shots-baseline/harmonogram__scx__sv__1440__dark-default.png`
- `shots-baseline/harmonogram__scx__sv__1440__light.png`
- `shots-baseline/harmonogram__scx__sv__1920__dark-default.png`
- `shots-baseline/harmonogram__scx__sv__1920__light.png`
- `shots-baseline/harmonogram__scx__sv__390__dark-default.png`
- `shots-baseline/harmonogram__scx__sv__390__light.png`
- `shots-baseline/harmonogram__scx__sv__768__dark-default.png`
- `shots-baseline/harmonogram__scx__sv__768__light.png`
- `shots-baseline/kokpit__hhl__en__1280__dark-default.png`
- `shots-baseline/kokpit__hhl__en__1280__light.png`
- `shots-baseline/kokpit__hhl__en__1440__dark-default.png`
- `shots-baseline/kokpit__hhl__en__1440__light.png`
- `shots-baseline/kokpit__hhl__en__1920__dark-default.png`
- `shots-baseline/kokpit__hhl__en__1920__light.png`
- `shots-baseline/kokpit__hhl__en__390__dark-default.png`
- `shots-baseline/kokpit__hhl__en__390__light.png`
- `shots-baseline/kokpit__hhl__en__768__dark-default.png`
- `shots-baseline/kokpit__hhl__en__768__light.png`
- `shots-baseline/kokpit__hhl__pl__1280__dark-default.png`
- `shots-baseline/kokpit__hhl__pl__1280__light.png`
- `shots-baseline/kokpit__hhl__pl__1440__dark-default.png`
- `shots-baseline/kokpit__hhl__pl__1440__light.png`
- `shots-baseline/kokpit__hhl__pl__1920__dark-default.png`
- `shots-baseline/kokpit__hhl__pl__1920__light.png`
- `shots-baseline/kokpit__hhl__pl__390__dark-default.png`
- `shots-baseline/kokpit__hhl__pl__390__light.png`
- `shots-baseline/kokpit__hhl__pl__768__dark-default.png`
- `shots-baseline/kokpit__hhl__pl__768__light.png`
- `shots-baseline/kokpit__hhl__sv__1280__dark-default.png`
- `shots-baseline/kokpit__hhl__sv__1280__light.png`
- `shots-baseline/kokpit__hhl__sv__1440__dark-default.png`
- `shots-baseline/kokpit__hhl__sv__1440__light.png`
- `shots-baseline/kokpit__hhl__sv__1920__dark-default.png`
- `shots-baseline/kokpit__hhl__sv__1920__light.png`
- `shots-baseline/kokpit__hhl__sv__390__dark-default.png`
- `shots-baseline/kokpit__hhl__sv__390__light.png`
- `shots-baseline/kokpit__hhl__sv__768__dark-default.png`
- `shots-baseline/kokpit__hhl__sv__768__light.png`
- `shots-baseline/kokpit__ksh__en__1280__dark.png`
- `shots-baseline/kokpit__ksh__en__1280__light-default.png`
- `shots-baseline/kokpit__ksh__en__1440__dark.png`
- `shots-baseline/kokpit__ksh__en__1440__light-default.png`
- `shots-baseline/kokpit__ksh__en__1920__dark.png`
- `shots-baseline/kokpit__ksh__en__1920__light-default.png`
- `shots-baseline/kokpit__ksh__en__390__dark.png`
- `shots-baseline/kokpit__ksh__en__390__light-default.png`
- `shots-baseline/kokpit__ksh__en__768__dark.png`
- `shots-baseline/kokpit__ksh__en__768__light-default.png`
- `shots-baseline/kokpit__ksh__pl__1280__dark.png`
- `shots-baseline/kokpit__ksh__pl__1280__light-default.png`
- `shots-baseline/kokpit__ksh__pl__1440__dark.png`
- `shots-baseline/kokpit__ksh__pl__1440__light-default.png`
- `shots-baseline/kokpit__ksh__pl__1920__dark.png`
- `shots-baseline/kokpit__ksh__pl__1920__light-default.png`
- `shots-baseline/kokpit__ksh__pl__390__dark.png`
- `shots-baseline/kokpit__ksh__pl__390__light-default.png`
- `shots-baseline/kokpit__ksh__pl__768__dark.png`
- `shots-baseline/kokpit__ksh__pl__768__light-default.png`
- `shots-baseline/kokpit__ksh__sv__1280__dark.png`
- `shots-baseline/kokpit__ksh__sv__1280__light-default.png`
- `shots-baseline/kokpit__ksh__sv__1440__dark.png`
- `shots-baseline/kokpit__ksh__sv__1440__light-default.png`
- `shots-baseline/kokpit__ksh__sv__1920__dark.png`
- `shots-baseline/kokpit__ksh__sv__1920__light-default.png`
- `shots-baseline/kokpit__ksh__sv__390__dark.png`
- `shots-baseline/kokpit__ksh__sv__390__light-default.png`
- `shots-baseline/kokpit__ksh__sv__768__dark.png`
- `shots-baseline/kokpit__ksh__sv__768__light-default.png`
- `shots-baseline/kokpit__scx__en__1280__dark-default.png`
- `shots-baseline/kokpit__scx__en__1280__light.png`
- `shots-baseline/kokpit__scx__en__1440__dark-default.png`
- `shots-baseline/kokpit__scx__en__1440__light.png`
- `shots-baseline/kokpit__scx__en__1920__dark-default.png`
- `shots-baseline/kokpit__scx__en__1920__light.png`
- `shots-baseline/kokpit__scx__en__390__dark-default.png`
- `shots-baseline/kokpit__scx__en__390__light.png`
- `shots-baseline/kokpit__scx__en__768__dark-default.png`
- `shots-baseline/kokpit__scx__en__768__light.png`
- `shots-baseline/kokpit__scx__pl__1280__dark-default.png`
- `shots-baseline/kokpit__scx__pl__1280__light.png`
- `shots-baseline/kokpit__scx__pl__1440__dark-default.png`
- `shots-baseline/kokpit__scx__pl__1440__light.png`
- `shots-baseline/kokpit__scx__pl__1920__dark-default.png`
- `shots-baseline/kokpit__scx__pl__1920__light.png`
- `shots-baseline/kokpit__scx__pl__390__dark-default.png`
- `shots-baseline/kokpit__scx__pl__390__light.png`
- `shots-baseline/kokpit__scx__pl__768__dark-default.png`
- `shots-baseline/kokpit__scx__pl__768__light.png`
- `shots-baseline/kokpit__scx__sv__1280__dark-default.png`
- `shots-baseline/kokpit__scx__sv__1280__light.png`
- `shots-baseline/kokpit__scx__sv__1440__dark-default.png`
- `shots-baseline/kokpit__scx__sv__1440__light.png`
- `shots-baseline/kokpit__scx__sv__1920__dark-default.png`
- `shots-baseline/kokpit__scx__sv__1920__light.png`
- `shots-baseline/kokpit__scx__sv__390__dark-default.png`
- `shots-baseline/kokpit__scx__sv__390__light.png`
- `shots-baseline/kokpit__scx__sv__768__dark-default.png`
- `shots-baseline/kokpit__scx__sv__768__light.png`
- `shots-baseline/mapa__hhl__en__1280__dark-default.png`
- `shots-baseline/mapa__hhl__en__1280__light.png`
- `shots-baseline/mapa__hhl__en__1440__dark-default.png`
- `shots-baseline/mapa__hhl__en__1440__light.png`
- `shots-baseline/mapa__hhl__en__1920__dark-default.png`
- `shots-baseline/mapa__hhl__en__1920__light.png`
- `shots-baseline/mapa__hhl__en__390__dark-default.png`
- `shots-baseline/mapa__hhl__en__390__light.png`
- `shots-baseline/mapa__hhl__en__768__dark-default.png`
- `shots-baseline/mapa__hhl__en__768__light.png`
- `shots-baseline/mapa__hhl__pl__1280__dark-default.png`
- `shots-baseline/mapa__hhl__pl__1280__light.png`
- `shots-baseline/mapa__hhl__pl__1440__dark-default.png`
- `shots-baseline/mapa__hhl__pl__1440__light.png`
- `shots-baseline/mapa__hhl__pl__1920__dark-default.png`
- `shots-baseline/mapa__hhl__pl__1920__light.png`
- `shots-baseline/mapa__hhl__pl__390__dark-default.png`
- `shots-baseline/mapa__hhl__pl__390__light.png`
- `shots-baseline/mapa__hhl__pl__768__dark-default.png`
- `shots-baseline/mapa__hhl__pl__768__light.png`
- `shots-baseline/mapa__hhl__sv__1280__dark-default.png`
- `shots-baseline/mapa__hhl__sv__1280__light.png`
- `shots-baseline/mapa__hhl__sv__1440__dark-default.png`
- `shots-baseline/mapa__hhl__sv__1440__light.png`
- `shots-baseline/mapa__hhl__sv__1920__dark-default.png`
- `shots-baseline/mapa__hhl__sv__1920__light.png`
- `shots-baseline/mapa__hhl__sv__390__dark-default.png`
- `shots-baseline/mapa__hhl__sv__390__light.png`
- `shots-baseline/mapa__hhl__sv__768__dark-default.png`
- `shots-baseline/mapa__hhl__sv__768__light.png`
- `shots-baseline/mapa__ksh__en__1280__dark.png`
- `shots-baseline/mapa__ksh__en__1280__light-default.png`
- `shots-baseline/mapa__ksh__en__1440__dark.png`
- `shots-baseline/mapa__ksh__en__1440__light-default.png`
- `shots-baseline/mapa__ksh__en__1920__dark.png`
- `shots-baseline/mapa__ksh__en__1920__light-default.png`
- `shots-baseline/mapa__ksh__en__390__dark.png`
- `shots-baseline/mapa__ksh__en__390__light-default.png`
- `shots-baseline/mapa__ksh__en__768__dark.png`
- `shots-baseline/mapa__ksh__en__768__light-default.png`
- `shots-baseline/mapa__ksh__pl__1280__dark.png`
- `shots-baseline/mapa__ksh__pl__1280__light-default.png`
- `shots-baseline/mapa__ksh__pl__1440__dark.png`
- `shots-baseline/mapa__ksh__pl__1440__light-default.png`
- `shots-baseline/mapa__ksh__pl__1920__dark.png`
- `shots-baseline/mapa__ksh__pl__1920__light-default.png`
- `shots-baseline/mapa__ksh__pl__390__dark.png`
- `shots-baseline/mapa__ksh__pl__390__light-default.png`
- `shots-baseline/mapa__ksh__pl__768__dark.png`
- `shots-baseline/mapa__ksh__pl__768__light-default.png`
- `shots-baseline/mapa__ksh__sv__1280__dark.png`
- `shots-baseline/mapa__ksh__sv__1280__light-default.png`
- `shots-baseline/mapa__ksh__sv__1440__dark.png`
- `shots-baseline/mapa__ksh__sv__1440__light-default.png`
- `shots-baseline/mapa__ksh__sv__1920__dark.png`
- `shots-baseline/mapa__ksh__sv__1920__light-default.png`
- `shots-baseline/mapa__ksh__sv__390__dark.png`
- `shots-baseline/mapa__ksh__sv__390__light-default.png`
- `shots-baseline/mapa__ksh__sv__768__dark.png`
- `shots-baseline/mapa__ksh__sv__768__light-default.png`
- `shots-baseline/mapa__scx__en__1280__dark-default.png`
- `shots-baseline/mapa__scx__en__1280__light.png`
- `shots-baseline/mapa__scx__en__1440__dark-default.png`
- `shots-baseline/mapa__scx__en__1440__light.png`
- `shots-baseline/mapa__scx__en__1920__dark-default.png`
- `shots-baseline/mapa__scx__en__1920__light.png`
- `shots-baseline/mapa__scx__en__390__dark-default.png`
- `shots-baseline/mapa__scx__en__390__light.png`
- `shots-baseline/mapa__scx__en__768__dark-default.png`
- `shots-baseline/mapa__scx__en__768__light.png`
- `shots-baseline/mapa__scx__pl__1280__dark-default.png`
- `shots-baseline/mapa__scx__pl__1280__light.png`
- `shots-baseline/mapa__scx__pl__1440__dark-default.png`
- `shots-baseline/mapa__scx__pl__1440__light.png`
- `shots-baseline/mapa__scx__pl__1920__dark-default.png`
- `shots-baseline/mapa__scx__pl__1920__light.png`
- `shots-baseline/mapa__scx__pl__390__dark-default.png`
- `shots-baseline/mapa__scx__pl__390__light.png`
- `shots-baseline/mapa__scx__pl__768__dark-default.png`
- `shots-baseline/mapa__scx__pl__768__light.png`
- `shots-baseline/mapa__scx__sv__1280__dark-default.png`
- `shots-baseline/mapa__scx__sv__1280__light.png`
- `shots-baseline/mapa__scx__sv__1440__dark-default.png`
- `shots-baseline/mapa__scx__sv__1440__light.png`
- `shots-baseline/mapa__scx__sv__1920__dark-default.png`
- `shots-baseline/mapa__scx__sv__1920__light.png`
- `shots-baseline/mapa__scx__sv__390__dark-default.png`
- `shots-baseline/mapa__scx__sv__390__light.png`
- `shots-baseline/mapa__scx__sv__768__dark-default.png`
- `shots-baseline/mapa__scx__sv__768__light.png`
- `shots-baseline/moje-stawki__scx__en__1280__dark-default.png`
- `shots-baseline/moje-stawki__scx__en__1280__light.png`
- `shots-baseline/moje-stawki__scx__en__1440__dark-default.png`
- `shots-baseline/moje-stawki__scx__en__1440__light.png`
- `shots-baseline/moje-stawki__scx__en__1920__dark-default.png`
- `shots-baseline/moje-stawki__scx__en__1920__light.png`
- `shots-baseline/moje-stawki__scx__en__390__dark-default.png`
- `shots-baseline/moje-stawki__scx__en__390__light.png`
- `shots-baseline/moje-stawki__scx__en__768__dark-default.png`
- `shots-baseline/moje-stawki__scx__en__768__light.png`
- `shots-baseline/moje-stawki__scx__pl__1280__dark-default.png`
- `shots-baseline/moje-stawki__scx__pl__1280__light.png`
- `shots-baseline/moje-stawki__scx__pl__1440__dark-default.png`
- `shots-baseline/moje-stawki__scx__pl__1440__light.png`
- `shots-baseline/moje-stawki__scx__pl__1920__dark-default.png`
- `shots-baseline/moje-stawki__scx__pl__1920__light.png`
- `shots-baseline/moje-stawki__scx__pl__390__dark-default.png`
- `shots-baseline/moje-stawki__scx__pl__390__light.png`
- `shots-baseline/moje-stawki__scx__pl__768__dark-default.png`
- `shots-baseline/moje-stawki__scx__pl__768__light.png`
- `shots-baseline/moje-stawki__scx__sv__1280__dark-default.png`
- `shots-baseline/moje-stawki__scx__sv__1280__light.png`
- `shots-baseline/moje-stawki__scx__sv__1440__dark-default.png`
- `shots-baseline/moje-stawki__scx__sv__1440__light.png`
- `shots-baseline/moje-stawki__scx__sv__1920__dark-default.png`
- `shots-baseline/moje-stawki__scx__sv__1920__light.png`
- `shots-baseline/moje-stawki__scx__sv__390__dark-default.png`
- `shots-baseline/moje-stawki__scx__sv__390__light.png`
- `shots-baseline/moje-stawki__scx__sv__768__dark-default.png`
- `shots-baseline/moje-stawki__scx__sv__768__light.png`
- `shots-baseline/moje-zadania__scx__en__1280__dark-default.png`
- `shots-baseline/moje-zadania__scx__en__1280__light.png`
- `shots-baseline/moje-zadania__scx__en__1440__dark-default.png`
- `shots-baseline/moje-zadania__scx__en__1440__light.png`
- `shots-baseline/moje-zadania__scx__en__1920__dark-default.png`
- `shots-baseline/moje-zadania__scx__en__1920__light.png`
- `shots-baseline/moje-zadania__scx__en__390__dark-default.png`
- `shots-baseline/moje-zadania__scx__en__390__light.png`
- `shots-baseline/moje-zadania__scx__en__768__dark-default.png`
- `shots-baseline/moje-zadania__scx__en__768__light.png`
- `shots-baseline/moje-zadania__scx__pl__1280__dark-default.png`
- `shots-baseline/moje-zadania__scx__pl__1280__light.png`
- `shots-baseline/moje-zadania__scx__pl__1440__dark-default.png`
- `shots-baseline/moje-zadania__scx__pl__1440__light.png`
- `shots-baseline/moje-zadania__scx__pl__1920__dark-default.png`
- `shots-baseline/moje-zadania__scx__pl__1920__light.png`
- `shots-baseline/moje-zadania__scx__pl__390__dark-default.png`
- `shots-baseline/moje-zadania__scx__pl__390__light.png`
- `shots-baseline/moje-zadania__scx__pl__768__dark-default.png`
- `shots-baseline/moje-zadania__scx__pl__768__light.png`
- `shots-baseline/moje-zadania__scx__sv__1280__dark-default.png`
- `shots-baseline/moje-zadania__scx__sv__1280__light.png`
- `shots-baseline/moje-zadania__scx__sv__1440__dark-default.png`
- `shots-baseline/moje-zadania__scx__sv__1440__light.png`
- `shots-baseline/moje-zadania__scx__sv__1920__dark-default.png`
- `shots-baseline/moje-zadania__scx__sv__1920__light.png`
- `shots-baseline/moje-zadania__scx__sv__390__dark-default.png`
- `shots-baseline/moje-zadania__scx__sv__390__light.png`
- `shots-baseline/moje-zadania__scx__sv__768__dark-default.png`
- `shots-baseline/moje-zadania__scx__sv__768__light.png`
- `shots-baseline/opcje__hhl__en__1280__dark-default.png`
- `shots-baseline/opcje__hhl__en__1280__light.png`
- `shots-baseline/opcje__hhl__en__1440__dark-default.png`
- `shots-baseline/opcje__hhl__en__1440__light.png`
- `shots-baseline/opcje__hhl__en__1920__dark-default.png`
- `shots-baseline/opcje__hhl__en__1920__light.png`
- `shots-baseline/opcje__hhl__en__390__dark-default.png`
- `shots-baseline/opcje__hhl__en__390__light.png`
- `shots-baseline/opcje__hhl__en__768__dark-default.png`
- `shots-baseline/opcje__hhl__en__768__light.png`
- `shots-baseline/opcje__hhl__pl__1280__dark-default.png`
- `shots-baseline/opcje__hhl__pl__1280__light.png`
- `shots-baseline/opcje__hhl__pl__1440__dark-default.png`
- `shots-baseline/opcje__hhl__pl__1440__light.png`
- `shots-baseline/opcje__hhl__pl__1920__dark-default.png`
- `shots-baseline/opcje__hhl__pl__1920__light.png`
- `shots-baseline/opcje__hhl__pl__390__dark-default.png`
- `shots-baseline/opcje__hhl__pl__390__light.png`
- `shots-baseline/opcje__hhl__pl__768__dark-default.png`
- `shots-baseline/opcje__hhl__pl__768__light.png`
- `shots-baseline/opcje__hhl__sv__1280__dark-default.png`
- `shots-baseline/opcje__hhl__sv__1280__light.png`
- `shots-baseline/opcje__hhl__sv__1440__dark-default.png`
- `shots-baseline/opcje__hhl__sv__1440__light.png`
- `shots-baseline/opcje__hhl__sv__1920__dark-default.png`
- `shots-baseline/opcje__hhl__sv__1920__light.png`
- `shots-baseline/opcje__hhl__sv__390__dark-default.png`
- `shots-baseline/opcje__hhl__sv__390__light.png`
- `shots-baseline/opcje__hhl__sv__768__dark-default.png`
- `shots-baseline/opcje__hhl__sv__768__light.png`
- `shots-baseline/rozliczenia__ksh__en__1280__dark.png`
- `shots-baseline/rozliczenia__ksh__en__1280__light-default.png`
- `shots-baseline/rozliczenia__ksh__en__1440__dark.png`
- `shots-baseline/rozliczenia__ksh__en__1440__light-default.png`
- `shots-baseline/rozliczenia__ksh__en__1920__dark.png`
- `shots-baseline/rozliczenia__ksh__en__1920__light-default.png`
- `shots-baseline/rozliczenia__ksh__en__390__dark.png`
- `shots-baseline/rozliczenia__ksh__en__390__light-default.png`
- `shots-baseline/rozliczenia__ksh__en__768__dark.png`
- `shots-baseline/rozliczenia__ksh__en__768__light-default.png`
- `shots-baseline/rozliczenia__ksh__pl__1280__dark.png`
- `shots-baseline/rozliczenia__ksh__pl__1280__light-default.png`
- `shots-baseline/rozliczenia__ksh__pl__1440__dark.png`
- `shots-baseline/rozliczenia__ksh__pl__1440__light-default.png`
- `shots-baseline/rozliczenia__ksh__pl__1920__dark.png`
- `shots-baseline/rozliczenia__ksh__pl__1920__light-default.png`
- `shots-baseline/rozliczenia__ksh__pl__390__dark.png`
- `shots-baseline/rozliczenia__ksh__pl__390__light-default.png`
- `shots-baseline/rozliczenia__ksh__pl__768__dark.png`
- `shots-baseline/rozliczenia__ksh__pl__768__light-default.png`
- `shots-baseline/rozliczenia__ksh__sv__1280__dark.png`
- `shots-baseline/rozliczenia__ksh__sv__1280__light-default.png`
- `shots-baseline/rozliczenia__ksh__sv__1440__dark.png`
- `shots-baseline/rozliczenia__ksh__sv__1440__light-default.png`
- `shots-baseline/rozliczenia__ksh__sv__1920__dark.png`
- `shots-baseline/rozliczenia__ksh__sv__1920__light-default.png`
- `shots-baseline/rozliczenia__ksh__sv__390__dark.png`
- `shots-baseline/rozliczenia__ksh__sv__390__light-default.png`
- `shots-baseline/rozliczenia__ksh__sv__768__dark.png`
- `shots-baseline/rozliczenia__ksh__sv__768__light-default.png`
- `shots-baseline/ryzyka__hhl__en__1280__dark-default.png`
- `shots-baseline/ryzyka__hhl__en__1280__light.png`
- `shots-baseline/ryzyka__hhl__en__1440__dark-default.png`
- `shots-baseline/ryzyka__hhl__en__1440__light.png`
- `shots-baseline/ryzyka__hhl__en__1920__dark-default.png`
- `shots-baseline/ryzyka__hhl__en__1920__light.png`
- `shots-baseline/ryzyka__hhl__en__390__dark-default.png`
- `shots-baseline/ryzyka__hhl__en__390__light.png`
- `shots-baseline/ryzyka__hhl__en__768__dark-default.png`
- `shots-baseline/ryzyka__hhl__en__768__light.png`
- `shots-baseline/ryzyka__hhl__pl__1280__dark-default.png`
- `shots-baseline/ryzyka__hhl__pl__1280__light.png`
- `shots-baseline/ryzyka__hhl__pl__1440__dark-default.png`
- `shots-baseline/ryzyka__hhl__pl__1440__light.png`
- `shots-baseline/ryzyka__hhl__pl__1920__dark-default.png`
- `shots-baseline/ryzyka__hhl__pl__1920__light.png`
- `shots-baseline/ryzyka__hhl__pl__390__dark-default.png`
- `shots-baseline/ryzyka__hhl__pl__390__light.png`
- `shots-baseline/ryzyka__hhl__pl__768__dark-default.png`
- `shots-baseline/ryzyka__hhl__pl__768__light.png`
- `shots-baseline/ryzyka__hhl__sv__1280__dark-default.png`
- `shots-baseline/ryzyka__hhl__sv__1280__light.png`
- `shots-baseline/ryzyka__hhl__sv__1440__dark-default.png`
- `shots-baseline/ryzyka__hhl__sv__1440__light.png`
- `shots-baseline/ryzyka__hhl__sv__1920__dark-default.png`
- `shots-baseline/ryzyka__hhl__sv__1920__light.png`
- `shots-baseline/ryzyka__hhl__sv__390__dark-default.png`
- `shots-baseline/ryzyka__hhl__sv__390__light.png`
- `shots-baseline/ryzyka__hhl__sv__768__dark-default.png`
- `shots-baseline/ryzyka__hhl__sv__768__light.png`
- `shots-baseline/ryzyka__ksh__en__1280__dark.png`
- `shots-baseline/ryzyka__ksh__en__1280__light-default.png`
- `shots-baseline/ryzyka__ksh__en__1440__dark.png`
- `shots-baseline/ryzyka__ksh__en__1440__light-default.png`
- `shots-baseline/ryzyka__ksh__en__1920__dark.png`
- `shots-baseline/ryzyka__ksh__en__1920__light-default.png`
- `shots-baseline/ryzyka__ksh__en__390__dark.png`
- `shots-baseline/ryzyka__ksh__en__390__light-default.png`
- `shots-baseline/ryzyka__ksh__en__768__dark.png`
- `shots-baseline/ryzyka__ksh__en__768__light-default.png`
- `shots-baseline/ryzyka__ksh__pl__1280__dark.png`
- `shots-baseline/ryzyka__ksh__pl__1280__light-default.png`
- `shots-baseline/ryzyka__ksh__pl__1440__dark.png`
- `shots-baseline/ryzyka__ksh__pl__1440__light-default.png`
- `shots-baseline/ryzyka__ksh__pl__1920__dark.png`
- `shots-baseline/ryzyka__ksh__pl__1920__light-default.png`
- `shots-baseline/ryzyka__ksh__pl__390__dark.png`
- `shots-baseline/ryzyka__ksh__pl__390__light-default.png`
- `shots-baseline/ryzyka__ksh__pl__768__dark.png`
- `shots-baseline/ryzyka__ksh__pl__768__light-default.png`
- `shots-baseline/ryzyka__ksh__sv__1280__dark.png`
- `shots-baseline/ryzyka__ksh__sv__1280__light-default.png`
- `shots-baseline/ryzyka__ksh__sv__1440__dark.png`
- `shots-baseline/ryzyka__ksh__sv__1440__light-default.png`
- `shots-baseline/ryzyka__ksh__sv__1920__dark.png`
- `shots-baseline/ryzyka__ksh__sv__1920__light-default.png`
- `shots-baseline/ryzyka__ksh__sv__390__dark.png`
- `shots-baseline/ryzyka__ksh__sv__390__light-default.png`
- `shots-baseline/ryzyka__ksh__sv__768__dark.png`
- `shots-baseline/ryzyka__ksh__sv__768__light-default.png`
- `shots-baseline/ryzyka__scx__en__1280__dark-default.png`
- `shots-baseline/ryzyka__scx__en__1280__light.png`
- `shots-baseline/ryzyka__scx__en__1440__dark-default.png`
- `shots-baseline/ryzyka__scx__en__1440__light.png`
- `shots-baseline/ryzyka__scx__en__1920__dark-default.png`
- `shots-baseline/ryzyka__scx__en__1920__light.png`
- `shots-baseline/ryzyka__scx__en__390__dark-default.png`
- `shots-baseline/ryzyka__scx__en__390__light.png`
- `shots-baseline/ryzyka__scx__en__768__dark-default.png`
- `shots-baseline/ryzyka__scx__en__768__light.png`
- `shots-baseline/ryzyka__scx__pl__1280__dark-default.png`
- `shots-baseline/ryzyka__scx__pl__1280__light.png`
- `shots-baseline/ryzyka__scx__pl__1440__dark-default.png`
- `shots-baseline/ryzyka__scx__pl__1440__light.png`
- `shots-baseline/ryzyka__scx__pl__1920__dark-default.png`
- `shots-baseline/ryzyka__scx__pl__1920__light.png`
- `shots-baseline/ryzyka__scx__pl__390__dark-default.png`
- `shots-baseline/ryzyka__scx__pl__390__light.png`
- `shots-baseline/ryzyka__scx__pl__768__dark-default.png`
- `shots-baseline/ryzyka__scx__pl__768__light.png`
- `shots-baseline/ryzyka__scx__sv__1280__dark-default.png`
- `shots-baseline/ryzyka__scx__sv__1280__light.png`
- `shots-baseline/ryzyka__scx__sv__1440__dark-default.png`
- `shots-baseline/ryzyka__scx__sv__1440__light.png`
- `shots-baseline/ryzyka__scx__sv__1920__dark-default.png`
- `shots-baseline/ryzyka__scx__sv__1920__light.png`
- `shots-baseline/ryzyka__scx__sv__390__dark-default.png`
- `shots-baseline/ryzyka__scx__sv__390__light.png`
- `shots-baseline/ryzyka__scx__sv__768__dark-default.png`
- `shots-baseline/ryzyka__scx__sv__768__light.png`
- `shots-baseline/strefy__hhl__en__1280__dark-default.png`
- `shots-baseline/strefy__hhl__en__1280__light.png`
- `shots-baseline/strefy__hhl__en__1440__dark-default.png`
- `shots-baseline/strefy__hhl__en__1440__light.png`
- `shots-baseline/strefy__hhl__en__1920__dark-default.png`
- `shots-baseline/strefy__hhl__en__1920__light.png`
- `shots-baseline/strefy__hhl__en__390__dark-default.png`
- `shots-baseline/strefy__hhl__en__390__light.png`
- `shots-baseline/strefy__hhl__en__768__dark-default.png`
- `shots-baseline/strefy__hhl__en__768__light.png`
- `shots-baseline/strefy__hhl__pl__1280__dark-default.png`
- `shots-baseline/strefy__hhl__pl__1280__light.png`
- `shots-baseline/strefy__hhl__pl__1440__dark-default.png`
- `shots-baseline/strefy__hhl__pl__1440__light.png`
- `shots-baseline/strefy__hhl__pl__1920__dark-default.png`
- `shots-baseline/strefy__hhl__pl__1920__light.png`
- `shots-baseline/strefy__hhl__pl__390__dark-default.png`
- `shots-baseline/strefy__hhl__pl__390__light.png`
- `shots-baseline/strefy__hhl__pl__768__dark-default.png`
- `shots-baseline/strefy__hhl__pl__768__light.png`
- `shots-baseline/strefy__hhl__sv__1280__dark-default.png`
- `shots-baseline/strefy__hhl__sv__1280__light.png`
- `shots-baseline/strefy__hhl__sv__1440__dark-default.png`
- `shots-baseline/strefy__hhl__sv__1440__light.png`
- `shots-baseline/strefy__hhl__sv__1920__dark-default.png`
- `shots-baseline/strefy__hhl__sv__1920__light.png`
- `shots-baseline/strefy__hhl__sv__390__dark-default.png`
- `shots-baseline/strefy__hhl__sv__390__light.png`
- `shots-baseline/strefy__hhl__sv__768__dark-default.png`
- `shots-baseline/strefy__hhl__sv__768__light.png`
- `shots-baseline/ustawienia__ksh__en__1280__dark.png`
- `shots-baseline/ustawienia__ksh__en__1280__light-default.png`
- `shots-baseline/ustawienia__ksh__en__1440__dark.png`
- `shots-baseline/ustawienia__ksh__en__1440__light-default.png`
- `shots-baseline/ustawienia__ksh__en__1920__dark.png`
- `shots-baseline/ustawienia__ksh__en__1920__light-default.png`
- `shots-baseline/ustawienia__ksh__en__390__dark.png`
- `shots-baseline/ustawienia__ksh__en__390__light-default.png`
- `shots-baseline/ustawienia__ksh__en__768__dark.png`
- `shots-baseline/ustawienia__ksh__en__768__light-default.png`
- `shots-baseline/ustawienia__ksh__pl__1280__dark.png`
- `shots-baseline/ustawienia__ksh__pl__1280__light-default.png`
- `shots-baseline/ustawienia__ksh__pl__1440__dark.png`
- `shots-baseline/ustawienia__ksh__pl__1440__light-default.png`
- `shots-baseline/ustawienia__ksh__pl__1920__dark.png`
- `shots-baseline/ustawienia__ksh__pl__1920__light-default.png`
- `shots-baseline/ustawienia__ksh__pl__390__dark.png`
- `shots-baseline/ustawienia__ksh__pl__390__light-default.png`
- `shots-baseline/ustawienia__ksh__pl__768__dark.png`
- `shots-baseline/ustawienia__ksh__pl__768__light-default.png`
- `shots-baseline/ustawienia__ksh__sv__1280__dark.png`
- `shots-baseline/ustawienia__ksh__sv__1280__light-default.png`
- `shots-baseline/ustawienia__ksh__sv__1440__dark.png`
- `shots-baseline/ustawienia__ksh__sv__1440__light-default.png`
- `shots-baseline/ustawienia__ksh__sv__1920__dark.png`
- `shots-baseline/ustawienia__ksh__sv__1920__light-default.png`
- `shots-baseline/ustawienia__ksh__sv__390__dark.png`
- `shots-baseline/ustawienia__ksh__sv__390__light-default.png`
- `shots-baseline/ustawienia__ksh__sv__768__dark.png`
- `shots-baseline/ustawienia__ksh__sv__768__light-default.png`
- `shots-baseline/ustawienia__scx__en__1280__dark-default.png`
- `shots-baseline/ustawienia__scx__en__1280__light.png`
- `shots-baseline/ustawienia__scx__en__1440__dark-default.png`
- `shots-baseline/ustawienia__scx__en__1440__light.png`
- `shots-baseline/ustawienia__scx__en__1920__dark-default.png`
- `shots-baseline/ustawienia__scx__en__1920__light.png`
- `shots-baseline/ustawienia__scx__en__390__dark-default.png`
- `shots-baseline/ustawienia__scx__en__390__light.png`
- `shots-baseline/ustawienia__scx__en__768__dark-default.png`
- `shots-baseline/ustawienia__scx__en__768__light.png`
- `shots-baseline/ustawienia__scx__pl__1280__dark-default.png`
- `shots-baseline/ustawienia__scx__pl__1280__light.png`
- `shots-baseline/ustawienia__scx__pl__1440__dark-default.png`
- `shots-baseline/ustawienia__scx__pl__1440__light.png`
- `shots-baseline/ustawienia__scx__pl__1920__dark-default.png`
- `shots-baseline/ustawienia__scx__pl__1920__light.png`
- `shots-baseline/ustawienia__scx__pl__390__dark-default.png`
- `shots-baseline/ustawienia__scx__pl__390__light.png`
- `shots-baseline/ustawienia__scx__pl__768__dark-default.png`
- `shots-baseline/ustawienia__scx__pl__768__light.png`
- `shots-baseline/ustawienia__scx__sv__1280__dark-default.png`
- `shots-baseline/ustawienia__scx__sv__1280__light.png`
- `shots-baseline/ustawienia__scx__sv__1440__dark-default.png`
- `shots-baseline/ustawienia__scx__sv__1440__light.png`
- `shots-baseline/ustawienia__scx__sv__1920__dark-default.png`
- `shots-baseline/ustawienia__scx__sv__1920__light.png`
- `shots-baseline/ustawienia__scx__sv__390__dark-default.png`
- `shots-baseline/ustawienia__scx__sv__390__light.png`
- `shots-baseline/ustawienia__scx__sv__768__dark-default.png`
- `shots-baseline/ustawienia__scx__sv__768__light.png`
- `tests/__screenshots__/kokpit-hhl-pl-1920-dark-default.png`
- `tests/__screenshots__/kokpit-hhl-pl-1920-light.png`
- `tests/__screenshots__/mapa-hhl-pl-1920-dark-default.png`
- `tests/__screenshots__/mapa-hhl-pl-1920-light.png`
- `tests/__screenshots__/stan-blad-dark.png`
- `tests/__screenshots__/stan-fokus-dark.png`
- `tests/__screenshots__/stan-fokus-light.png`
- `tests/__screenshots__/stan-ladowanie-dark.png`
- `tests/__screenshots__/stan-najechanie-dark.png`
- `tests/__screenshots__/stan-najechanie-light.png`
- `tests/__screenshots__/stan-pusty-dark.png`
- `tests/__screenshots__/stan-pusty-light.png`
- `tests/__screenshots__/stan-walidacja-dark.png`
- `tests/__screenshots__/stan-wcisniety-dark.png`
- `tests/__screenshots__/stan-zablokowany-dark.png`

### 2026-10-03 — jeden wzorzec mapy

Odświeżono wyłącznie `shots-baseline/mapa__hhl__pl__1920__light.png` w środowisku bramy. Powód: zmiana kafelka u dostawcy map. Pozostałych 839 ujęć nie odświeżano.

### 2026-10-03 — B-1

Mapa w produkcji: znacznik pojazdu tylko z ostatniej pozycji GPS (`load_track`). Brak pozycji — komunikat „Brak danych — pozycji pojazdów”, bez punktu ze statusu. Strefy, porty, korytarz, promy i sytuacje drogowe bez zmian, nadal włączane checkboxami. Tryb demo (makieta) bez zmian.

### 2026-10-04 13:47 — liczby bramy lokalnej (`tests/db/gate.sh`)

Polecenie: liczby dopiero po `age` (pakiet `age` 1.2.1, są `age` i `age-keygen`) i po tym, jak brama sama tworzy bazę `tower`. Szablon `tower_boot` (atrapa, migracje, seed) jest klonowany przed każdym zestawem, który łączy się z bazą o nazwie `tower`, i kasowany po przebiegu. Zestawy: dec5, dec6, adm10, hist11, dec-auto. dec2 i dec3 były w przebiegu 4:29 (24 i 13) i same tworzą bazę — weszły do `gate.sh`, bo lokalna brama ich nie uruchamiała.

| Zestaw | Było w gate.sh | Jest | Który commit dodał testy |
|---|---|---|---|
| nullguard | 389 | 528 | `e2947d7` podniósł bramę 379→389 o liczbę nowych wierszy listy (10: 7 GUARD + 3 EMPTY: admin_audit_history, admin_impersonate_start, admin_impersonate_stop, admin_set_eta_calibration_frozen, apply_eta_calibration_version, fee_catalog_hints, load_agreed_fee_add, load_dwell_info, real_app_role, real_app_user_id), a nie o asercje (4 odmowy na wiersz). `383560e` dodał `insurance_policy_approve` (GUARD). Macierz pełnej listy = 528, jak brama hosted i przebieg lokalny 4.10. |
| i2 | 521 | 526 | `e2947d7`: plik 510→524, brama tylko 510→519 (zabrakło 5). `324ab95`: plik +2 (panel SE, 526). `2492f64` podniósł bramę tylko o te 2 (519→521). Zostaje 521→526. |
| workflows | 46 | 47 | `383560e`: chk „T-BOOM zakolejkowany”. |
| insurance | 33 | 42 | W poleceniu stara liczba padła jako 42, w pliku było 33. `e2947d7` (D-30, migracja 0125): 33→43 linii chk/val/err, jedna w if/else `cron.job` (zawsze jedna), więc 42. |
| dec2 | nie było w gate.sh | 24 | Przebieg 4.10: 24/24. `e2947d7` dał 18 (z ręcznym escalate). `5fa5441` (L-2) dodał 6 asercji → 24. |
| dec3 | nie było | 13 | `e2947d7` / 0127, przebieg 4.10: 13/13. Plik: 13 chk/val/err. |
| dec5 | nie było | 11 | Plik: 11 val/err. Wymaga bazy `tower`. |
| dec6 | nie było | 15 | `7b25502`: 13 val/err + 2 ręczne OK (admin_auth_login_log, system_broadcast_current). |
| adm10 | nie było | 8 | Plik: 8. Nowy zestaw przy 0117 (`e2947d7`). |
| hist11 | nie było | 11 | Plik: 11. Nowy zestaw przy 0118 (`e2947d7`). |
| dec-auto | nie było | 39 | `e9fe090` miał 24. `f8d80a5` (L-3) dodał 15 → 39. |
| backup | 29 | 29, bez zmiany | Przebieg 4.10: 17 OK i 12 FAIL (razem 29) przez brak `age`. Po pakiecie oczekiwane zostaje 29/29. |
| security, status, storage, money, release, session, archive, watchdog, invite, risks, import, i30, i31 | bez zmiany | jak w gate.sh | Przebieg 4.10 zgodny z liczbą w skrypcie. |

Liczby bez wyjaśnienia nie były ruszane. `insurance` w poleceniu było opisane jako „42 wobec 42”; w skrypcie stało 33, więc zmiana 33→42 jest opisana wyżej, a nie pominięta.

Backup po instalacji `age`: liczba zostaje 29. Dwa czerwone testy nie były brakiem `age`. (1) `scripts/restore.sh` przy `--into-public` składał `set session_replication_role` i `\copy` w jednym `psql -c` — psql zgłasza błąd składni przy `\`. Poprawka: jedna sesja, najpierw SET, potem `\copy` (klient czyta plik, nie serwer). (2) Asercja I-33 oczekiwała `ERROR/t/t`, a sklejenie `||` w Postgresie 17 daje `ERROR/true/true`. Po obu poprawkach `backup.sh` daje 29 OK, 0 FAIL.

Pełna brama lokalna 2026-10-04 14:05 czasu warszawskiego: kod 0, 4 min 56 s (296 s). Wszystkie zestawy 0 FAIL, w tym backup 29/29 i dec-auto 39/39. Bazy tower i tower_boot usunięte po przebiegu.

Wdrożenie po scaleniu #16 idzie z tego commita, bo squash #16 ma autora konta GitHub, a plan Hobby puszcza tylko sebastian.bozekq@gmail.com.

### 2026-10-04 14:14 — dec-auto L-1b

| Zestaw | Było | Jest | Skąd |
|---|---|---|---|
| dec-auto | 39 | 64 | Ta paczka (migracja 0145) dodaje 25 asercji: zniknięcie wiersza, konflikt numeru HHL, plik nieczytelny, SEFS brak źródła / w tabeli / ponad tabelę, KR 3 i 4, brak danych, oraz brak funkcji `l1b_dwell_check`. NO_AWIZACJA nie jest liczona drugi raz (zostaje w 0143 / L-3). |

DWELL_OVER_FREE nie wchodzi: czas wolny nie jest w `ops_thresholds`, a I-32 zostawia „od kiedy” do wyjaśnienia. Sztywne 360 i 240 minut nie otwierają decyzji.

| nullguard | 528 | 533 | Ta sama paczka L-1b: `l1b_ksh_file_unreadable` jest GRANT dla authenticated, więc `null-guard-calls.txt` dostaje jeden wpis GUARD. To 4 odmowy (nieaktywny HHL, KSH, SCX, brak konta) i 1 kontrola pozytywna aktywnego HHL. 528+5=533. |

### 2026-10-04 17:06 — poczta, tydzień produkcji (odczyt, nie szacunek)

Tydzień od poniedziałku 2026-09-28 (liczony do niedzieli 2026-10-04). Wiersze `notifications` kanał EMAIL na produkcji, odczyt 2026-10-04 około 17:20 czasu warszawskiego. To stan sprzed włączenia skrótów (status DIGEST = 0). Szacunek szczytu po skrócie: 34.

| Dzień | od razu (PENDING+SENT) | skrót | wstrzymane | wiersze e-mail |
|---|---|---|---|---|
| 2026-10-01 | 37 | 0 | 0 | 37 |
| 2026-10-02 | 20 | 0 | 0 | 20 |
| 2026-10-03 | 55 | 0 | 0 | 55 |
| 2026-10-04 | 267 | 0 | 0 | 325 |

Średnia z tych czterech dni: 94,75 od razu. Maksimum: 267 (4.10, jeszcze bez skrótu). Krytycznych osobno stary zapis nie rozdziela. Skrót: 0. Strażnik 80 (`integration_runs` job `email-budget`) w tym tygodniu: 0 razy. Próg „więcej niż dwa razy” nie zapalił się.

Od następnego tygodnia ten sam odczyt ma iść tu co tydzień, już ze skrótem i z krytycznymi, obok 34.

### 2026-10-05 08:11 — poczta, tydzień produkcji 28.09–04.10 (licznik tygodniowy)

Odczyt z produkcji 2026-10-05 08:11 czasu warszawskiego, transakcja tylko do odczytu. Tabela `notifications`, kanał EMAIL, dzień według czasu warszawskiego. „Od razu” to PENDING+SENT bez zaproszeń i resetu hasła, tak jak liczy `l13_email_counts`. „Krytyczne” to część „od razu”, dla której `l13_email_is_critical` zwraca prawdę. Wysyłki nie ruszano.

| Dzień | od razu | w tym krytyczne | skrót | wstrzymane (SUPPRESSED) | błąd (ERROR) | wiersze e-mail |
|---|---|---|---|---|---|---|
| 2026-09-28 – 2026-09-30 | 0 | 0 | 0 | 0 | 0 | 0 |
| 2026-10-01 | 37 | 0 | 0 | 0 | 0 | 37 |
| 2026-10-02 | 20 | 20 | 0 | 0 | 0 | 20 |
| 2026-10-03 | 55 | 0 | 0 | 0 | 0 | 55 |
| 2026-10-04 | 268 | 130 | 0 | 15 | 58 | 341 |

Średnia na dobę: 54,3 od razu w całym tygodniu (380 / 7), 95,0 w czterech dniach z pocztą. Maksimum: 268 (04.10). Krytyczne razem: 150 (02.10: 20 RISK_SEVERITY; 04.10: 110 RISK_OPEN i 20 RISK_SEVERITY). Skróty w tym tygodniu: 0, bo skrót działa od 04.10 17:06 i pierwsze wiersze DIGEST są z 05.10. Szacunek szczytu po skrócie: 34. Średnia tygodnia jest 1,6 razy wyższa od szacunku, maksimum 7,9 razy. Cały ten tydzień to stan sprzed skrótu, więc porównanie z 34 da się zrobić uczciwie dopiero za tydzień.

Strażnik 80 (`integration_runs`, job `email-budget`, jeden wpis na dobę): w tym tygodniu 1 raz, 04.10 o 18:00, poziom `critical_only`, 267 operacyjnych. Próg „więcej niż dwa razy w tygodniu” nie zapalił się. Poprawka do wpisu 04.10 17:06: tamten odczyt (17:20) był przed zapaleniem strażnika, stąd tam 0, a 04.10 domknął się na 268 od razu zamiast 267.

Błędy wysyłki w tym tygodniu: 58 × RISK_OPEN 04.10 o 13:10, Resend 429 `daily_quota_exceeded` (dzienny limit darmowego planu).

Poniedziałek 05.10 do 08:11: od razu 0, skrót 4 (RISK_OPEN), błąd 8. Te 8 to SMS_GATEWAY_SILENT między 03:55 a 06:43, wszystkie z błędem „Resend 200 restricted_api_key: This API key is restricted to only send emails”. Resend odpowiedział 200, a wiersz dostał ERROR, więc nie wiadomo, czy te e-maile doszły. Do sprawdzenia w `send-notifications`, bez zmiany wysyłki w tym kroku.

2026-10-04 — HERE_API_KEY dodany do sekretów Supabase produkcji (projekt nglnnrmzmhusvxslousq) i do .env.local. Wartość nie jest zapisana w repozytorium.

### 2026-10-04 19:29 — H-0 uzupełnienie (bez zmian aplikacji)

Polecenie właściciela z 19:29 czasu warszawskiego. Zestaw próbny, bo wymiary 94 transportów są puste: wysokość 4,2 m, szerokość 3,0 m, długość 25 m, masa 52 t, 6 osi. Współrzędne z repozytorium, nie z głowy: Śrem 52.07391, 17.02460 (`docs/watch-tower/ADDRESSES.md`), Gdańsk Westerplatte 54.40372, 18.68130 (migracja 0017), Nynäshamn 58.90453, 17.95621 (ADDRESSES), Boden 65.80539, 21.75914 (ADDRESSES), Karlskrona Stena 56.16460, 15.63080 (migracja 0120). Odpytanie HERE Routing v8, `transportMode=truck`, odjazd niedziela 2026-10-04 około 19:33 czasu warszawskiego. Klucza nie ma w tym pliku. Zapytań routingu 14 (4 z nich HERE odrzucił kodem E605013, bo brakowało polilinii przy spanach) i 6 odwrotnych geokodowań. Kosztu nie liczę — cennika konta tu nie czytałem.

Pomiar tego wieczora wobec liczb z H-0: Śrem–Gdańsk 346,1 km i 4,61 h (346116 m, 16584 s z ruchem; czas bazowy 16486 s) wobec 346,7 km / 4,7 h. Nynäshamn–Boden 989,4 km i 12,78 h (989400 m, 46018 s) wobec 991,7 km / 13,2 h. Karlskrona–Boden trasą krótką 1384,1 km (1384107 m): z ruchem 18,35 h (66073 s), bez zależności od godziny (`departureTime=any`) 18,20 h (65511 s), wobec 1385,6 km / 18,6 h.

#### 1. Trzy limity 400 cm, Śrem–Gdańsk

To nie są trzy budowle. HERE dał trzy komunikaty `violatedAdminWideVehicleRestriction`, waga `info` (nie `critical`), typ `adminWideRestriction`: limit wysokości 400 cm na całe województwo. Zestaw ma 420 cm. Komunikat wisi na całym odcinku w województwie, bez dziur. Rodzaj dla każdego: ani wiadukt, ani most, ani tunel. Atrybut `tunnel` jest na 52 m S5 przy wejściu w drugi odcinek, atrybut `bridge` na 219 m A1 przy wejściu w trzeci. To cecha jezdni, nie przyczyna limitu.

| # | Kod HERE | Co mówi geokoder | Odcinek z komunikatem | Droga | Współrzędne początku → końca |
|---|---|---|---|---|---|
| 1 | województwo `30` | oba końce: woj. wielkopolskie (początek ul. Grunwaldzka, Śrem; koniec S5, Mieleszyn) | 99,989 km, 48 spanów | początek bez numeru: ul. Staszica, ul. Gostyńska; dalej głównie S5 i E261, krócej 434, S11, A2/E30 | 52.07369, 17.02378 → 52.65487, 17.63049 |
| 2 | województwo `04` | koniec odcinka: A1, Nowe, woj. kujawsko-pomorskie. Początek to ten sam punkt graniczny, geokoder stawia go jeszcze w wielkopolskim | 156,341 km | głównie S5 i E261, dalej A1 i E75 | 52.65487, 17.63049 → 53.67647, 18.63650 |
| 3 | województwo `22` | koniec: ul. Sucharskiego, Gdańsk, woj. pomorskie. Początek geokoder stawia jeszcze przy A1, Nowe, kujawsko-pomorskie | 89,786 km | głównie A1 i E75 (Autostrada Bursztynowa), krócej 89, S6, S7, E77 | 53.67647, 18.63650 → 54.40380, 18.68149 |

Pole `state` w HERE to druga część ISO 3166-2. Geokoder zgadza się z PL-30, PL-04 i PL-22.

Objazd bez tych komunikatów: nie ma. Osiem tras (4 szybkie, 4 krótkie) — każda ma co najmniej dwa z trzech. Najkrótsza, 336,3 km i 4,62 h, nadal ma wszystkie trzy. Jedyna, która omija kod `04`, ma 385,0 km i 6,32 h i zostawia kody `30` i `22`. Wobec 346,7 km / 4,7 h byłoby to +38,3 km i +1,62 h, ale to nie jest trasa bez naruszeń, więc różnicy objazdu bez naruszeń nie podaję. Czystej nie ma, bo początek leży w województwie `30`, a koniec w `22`.

#### 2. Karlskrona–Boden, ograniczenie czasowe

Nie ma go w odpowiedzi. Trasa krótka, ta od 1385,6 km, ma dziś 1384,1 km. Brak `violatedVehicleRestriction`, brak `restrictedTimes`, brak `potentialTimeDependentViolations`. Sprawdzone odjazdy: niedziela 19:33 z ruchem, `departureTime=any`, poniedziałek 2026-10-05 06:00, sobota 2026-10-10 10:00, wtorek 2026-10-06 22:00 (czas warszawski). Jest 24 incydentów drogowych (roboty, zamknięty pas) z datami ważności. To nie zakaz jazdy zestawu i nie podaję go jako ograniczenia czasowego. Miejsca i godzin zakazu nie ma, bo HERE ich nie zwrócił.

#### 3. Nynäshamn–Boden, BK1–BK4

Tak, klasy są w odpowiedzi tej trasy (989,4 km). Indeks spanu wskazuje klasę z listy sekcji: BK1, BK2, BK4. BK3 na liście nie ma. Naruszenia masy ani klasy nie ma — 52 t i 6 osi przejechały bez komunikatu.

- BK1: 43,5 km. Naruszenia nie ma.
- BK2: 1,6 km, jeden odcinek, Svartbyleden, od 65.79788, 21.73910. Naruszenia nie ma.
- BK3: 0 km. Tej klasy na wybranej drodze nie ma. To nie jest wynik „dozwolone”.
- BK4: 943,8 km. Naruszenia nie ma.
- Bez klasy: 0,5 km na wyjeździe z terminalu w Nynäshamn (Hamnterminalen, Skyttens hälls väg, Nynäsvägen).

Kontrola widzi klasę na odcinku. Nie daje osobnego werdyktu „ta klasa puszcza 52 t”.

#### 4. Zwykła ciężarówka wobec D-9 i propozycja H-4

D-9 (PLAN, POSTEP I-D9 i I-15): PL_ROAD 7,5 h, check-in 3 h, przeprawa 18 h, SE_ROAD 17 h, odpoczynek dobowy 11 h, przerwy 2 h. Razem noga szwedzka 30 h. Karlskrona–Boden nie ma własnej liczby w D-9.

| Odcinek | HERE, zwykła ciężarówka | D-9 |
|---|---|---|
| Śrem–Gdańsk | H-0 4,7 h; dziś 4,61 h | 7,5 h samej jazdy w modelu, bez przerwy UE |
| Nynäshamn–Boden | H-0 13,2 h; dziś 12,78 h | 17 h jazdy, a z odpoczynkiem i przerwami 30 h |
| Karlskrona–Boden | H-0 18,6 h; dziś 18,35 h z ruchem, 18,20 h bez godziny | brak odcinka |

Model D-9 jest wolniejszy od samej jazdy HERE: na PL o około 2,9 h (7,5 wobec 4,61), na SE o około 4,2 h samej jazdy (17 wobec 12,78) i o około 17 h, gdy liczyć 30 h z odpoczynkiem.

Propozycja H-4, bez budowy, do akceptacji:

ETA dalej tylko z pozycji GPS (D-80). HERE liczy czas jazdy z tej pozycji, profilem zestawu z D-83 i parametrem `vehicle[speedCap]` w metrach na sekundę. Ten parametr nie skraca czasu względem zwykłej ciężarówki, może go tylko wydłużyć. Liczbę km/h ustala właściciel w Opcjach jako wartość wstępną. Sam jej nie przyjmuję.

Przerwy i odpoczynki zostają w Watch Tower, nie w HERE. Przepis UE (rozporządzenie 561/2006 ze zmianami pakietu mobilności): po 4,5 h jazdy przerwa 45 min (albo 15 min i potem 30 min); jazda dobowa 9 h, a 10 h co najwyżej dwa razy w tygodniu, jeśli właściciel to włączy; potem odpoczynek dobowy 11 h. Prom zostaje odpoczynkiem dobowym jak w D-9 i nie doliczamy drugiego. HERE ma `driver[schedule]` (pary „jazda, postój” w sekundach) i samo wstawia postoje, ale nie zna limitu 9 h ani wyjątku promu: przeprawa dłuższa niż 15 min nie liczy się tam ani jako jazda, ani jako odpoczynek. Dlatego harmonogramu HERE nie bierzemy za przepis. Tabela D-9 i silnik OSM bez zmian — zapas, gdy HERE nie działa albo budżet się skończy (D-77).

Ilustracja reguły na dzisiejszej jeździe, to nie jest nowe ETA: Śrem–Gdańsk 4,61 h jazdy plus jedna przerwa 45 min daje 5,36 h, a D-9 ma 7,5 h. Nynäshamn–Boden 12,78 h jazdy: przerwa 45 min po 4,5 h, po 9 h odpoczynek 11 h, zostaje 3,78 h jazdy, razem 24,53 h, a D-9 ma 30 h.

#### Czego nie ruszam

H-4 nie budowane. H-1, H-2 i H-3 w planie są dopiero po L-12, a wymiary ma podać właściciel (D-83) — nie startuję. L-6 jest następną otwartą pozycją listy L, ale to zmiana mechanizmu kopii, a to polecenie każe stanąć, gdy następne nie jest jednoznaczne. Kodu aplikacji nie zmieniałem. Wdrożenia aplikacji nie ma.

## 2026-10-04 20:06 (czas warszawski) — POCZTA-3, L-13, L-6, D-85

Żadnego e-maila w tym kroku.

### Limity Resend

Odczyt użycia, bez wysyłki. Ostatni odczyt około 20:05: dziennie 203 / 100, miesięcznie 429 / 3000. Wtyczka nie podaje daty dziennej właściciela.

- Limit dzienny odnawia się **5 października 2026 o 01:00** (właściciel, z panelu, polecenie 20:04).
- Limit miesięczny odnawia się **25 października 2026 o 01:00** (właściciel, polecenie 20:06). Zegar z odczytu użycia (około 02:03 czasu warszawskiego) nie zastępuje tej godziny.

### Testowy e-mail z 19:01

2026-10-04 19:01:53 czasu warszawskiego, na sebastian@log-mar.pl. Temat: test, nie prawdziwa decyzja. Identyfikator Resend `01a107dd-6859-7bf3-813c-4bb10518762e`. Status **failed**. Identyfikator wiadomości pusty. W logu API `POST /emails` dał HTTP 200 w tej samej sekundzie. Aplikacja brała 200 za „wysłany”. To był błąd L-13.

### L-13 na produkcji

Status wyłącznie z odpowiedzi Resend. Samo HTTP 200 i samo id to `PENDING`, nie `SENT`. `last_event` failed, bounced albo complained, albo nazwa błędu Resend, to `ERROR`. Migracja `email_status_from_resend` jest na produkcji. `email_budget_status()` liczy `SUPPRESSED` i `ERROR` jako „nie wyszło”. Funkcja `send-notifications` jest w wersji 16, `verify_jwt` włączone: po samym id dopytuje `GET /emails/{id}` i bierze `last_event`. Brak statusu zostawia wiersz `PENDING` (klucz idempotencji `tower-notif-${id}`, następny cron nie wysyła drugi raz). Treść błędu jest krótka i bez klucza.

### Testy nie wysyłają

Potwierdzone, bez zmiany kodu. Zestawy bazy i `tests/db/gate.sh` idą na lokalny Postgres. SIM-1 (`scripts/sim1-full-transport.mjs`, `scripts/sim1-sms-only.mjs`) nie woła Resend. Test statusu Resend jest czysty. Test żywy keep-alive zeruje klucz i woła tylko `beat()`. Playwright idzie w lokalne logowanie, nie na api.resend.com.

### L-6 na produkcji

PR #26 scalony. `main` to `419c5bb`. Brama lokalna zielona przed scaleniem (log `/tmp/gate-l6.txt`). Wdrożenie `dpl_DzV56mBDm5K1vCrjuwoiBNL6rq55`. Obie domeny, tower.log-mar.pl i watch-tower-makieta.vercel.app, zwróciły 200 na tej wersji (04.10.2026, około 20:06). Migracja `l6_backup_retry` jest na produkcji: „Ponów kopię” woła ten sam `backup-export` co cron. Brak pg_net albo Vault zostawia wiersz ERROR, bez sekretu w tekście.

### D-85

Propozycja H-4 z limitem km/h w Opcjach jest nieaktualna. Decyzja D-85: ETA w pełni automatyczne, zero ręcznego wpisu, także prędkości. Opis i plan testu są w `ZLECENIE_HERE.md` (H-4) i w rejestrze (D-85). H-4 nie budowane. H-1 też nie: komunikat HERE o limicie 400 cm na województwo to przepis, nie przeszkoda. Ryzyko tylko dla konkretnego wiaduktu, mostu albo tunelu.

## 2026-10-04 21:40 (czas warszawski) — H-1 zbudowane, wyłączone

Kontrola trasy jest w kodzie i zostaje wyłączona. `security_flags.H1_ROUTE_CHECK` jest false. Nie ma crona i nic na produkcji nie woła HERE dla tej kontroli. Puste wymiary nie są uzupełniane wymiarami przykładowymi z H-0. Komunikat o limicie wysokości województwa to „wymaga zezwolenia”, nie przeszkoda. Ryzyko `ROUTE_OBSTACLE` powstaje tylko dla wiaduktu, mostu albo tunelu z miejscem i tylko gdy kontrola jest włączona. H-2, H-3 i część B nie są ruszane. R-0 i R-1 bez zmian.

## 2026-10-04 — H-3 przeszkody wzdłuż korytarza, wyłączone

Katalog ograniczeń dla ciężarówek w pasie 3 km wzdłuż korytarza jest w kodzie i zostaje wyłączony. `security_flags.H3_CORRIDOR_OBSTACLES` jest false. Nie ma crona i nic na produkcji nie woła HERE dla tego katalogu. Puste wymiary nie są uzupełniane. Podświetlenie w podglądzie działa dopiero po włączeniu flagi i tylko dla wymiarów tego zestawu. Brak wymiarów albo pusta odpowiedź = „Brak danych”. `H1_ROUTE_CHECK` zostaje false. Surowe dane HERE kasowane po 30 dniach, podsumowanie zostaje. Szacunek kosztu atrybutów mapy to sufit 0,01 USD za zapytanie, bo cennik publiczny tej usługi nie podaje stawki.

## 2026-10-05 07:16 (czas warszawski) — korekta Q-18, AIS dla Polferries, część B

Teraz: — (stop po B-7a/B-7b, raport) · Zrobione: krok 0, Q18-V2, AIS-POLF, diagnoza 5 promów, B-7a, B-7b, propozycje B-7c / B-8 (filtry, statusy) / B-9 / Q-9 · Następne: B-8 (część bez filtrów i statusów).

### 1. Q18-V2 — nowa reguła widoczności (PR #64)

Prom widoczny w strefie portu PL (Gdańsk, Gdynia), w rejsie PL→SE i w strefie portu SE (Nynäshamn, Karlskrona). Znika po wyjściu ze strefy SE, wraca po wejściu w strefę PL. `ferryPhase` / `ferryVisible` / `visibleFerryMarkers` w `supabase/functions/_shared/map/draw.ts` (ten sam kod w aplikacji). Testy kroków właściciela: `tests/bmapa.test.ts` (Gdańsk → wypływa → Nynäshamn → wypływa do Polski → Gdańsk; Gdynia/Karlskrona; kolejność wierszy; pozycje zostają w zbiorze). Brak strefy w 48 h: kierunek z kursu ostatniej pozycji (północ = do Szwecji), bez kursu niewidoczny. Pozycje w bazie bez zmian, ETA / II-9 / L-9 z pełnych danych.

### 2. AIS-POLF — diagnoza i naprawa (PR #64, migracja 0163)

- Cron `tower-ferry-ais` działał co 3 min, funkcja ok. 10 s, klucz był, WebSocket się łączył. W bazie 0 wierszy AISSTREAM dla wszystkich 5 statków (także dla Sten na morzu).
- **Przyczyna 1:** aisstream wysyła ramki **binarne**. W Deno `ev.data` to Blob, `String(Blob)` = „[object Blob]”, `JSON.parse` padał i kod po cichu odrzucał każdą ramkę. Sprawdzone lokalnie: 14/14 ramek binarnych.
- **Przyczyna 2:** 8 s nasłuchu. Statek przy nabrzeżu nadaje co 3 min (Wawel 05:19:23 i 05:22:23 UTC), więc 8 s prawie nigdy go nie łapało.
- Bbox obejmuje Gdańsk i Nynäshamn. Porównanie MMSI (liczba w MetaData → tekst) było poprawne. Filtr `FiltersShipMMSI` działa, gdy MMSI są tekstem (sprawdzone: tylko nasze statki).
- **Naprawa:** `binaryType = arraybuffer` + dekodowanie UTF-8 (także Blob), jawny parser `time_utc`, subskrypcja z `FiltersShipMMSI`, typy pozycji klasy A i B. Nowa funkcja Edge `ferry-ais-listen`: cron co minutę, nasłuch 50 s (limit ścienny funkcji 150 s), zapis każdej pozycji ze źródłem AISSTREAM. `ferry-ais` (co 3 min) nie otwiera już WebSocket — bierze pozycje AISSTREAM z bazy (≤ 10 min) do „nowsza wygrywa” i ryzyk. Bez wydatków (plus ok. 43 tys. wywołań funkcji miesięcznie; wszystkie crony razem ok. 190 tys., limit planu Free 500 tys.).
- Dowód: Nova Star AISSTREAM 2026-10-05 05:35:14 UTC, 54,40467 N 18,67377 E (Gdańsk), wiek 1,6 min przy odczycie 05:36:50 UTC. Stena Spirit i Stena Ebba też z AISSTREAM (wiek < 1 min o 05:45 UTC).
- Wawel: do 05:45 UTC bez pozycji AISSTREAM w bazie. aisstream w tym czasie nie przekazał żadnej ramki Wawel ani Nova Star — sprawdzone osobnym nasłuchem 200 s (05:42–05:45 UTC, tylko te dwa MMSI): 0 ramek. Funkcja produkcyjna w tych minutach też 0. To luka odbioru aisstream przy nabrzeżu, nie błąd zapisu. Digitraffic zostaje zapasem (Wawel 21:19 UTC 4.10, Nynäshamn, znacznik wyszarzony).

### 3. Diagnoza pustej mapy (05.10 ok. 05:40 UTC)

Stara reguła wymagała zobaczenia wyjścia ze strefy portu PL w 48 h. Steny mają pozycje dopiero od 4.10 23:01 UTC (bez wyjścia z PL w historii), Wawel stał w Nynäshamn, Nova Star ostatnio płynęła do Polski. Wynik: 0 z 5 widocznych. Nowa reguła na tych samych danych (ten sam kod co mapa):

| Prom | Ostatnia pozycja (UTC) | Źródło | Strefa | Widoczny wg reguły |
|---|---|---|---|---|
| Nova Star | 05.10 05:35:14 | AISSTREAM | port Gdańsk | tak |
| Wawel | 04.10 21:19:21 | DIGITRAFFIC | port Nynäshamn | tak (znacznik wyszarzony, sygnał > 15 min) |
| Stena Estelle | 05.10 05:32:59 | STENA | port Karlskrona | tak |
| Stena Spirit | 05.10 05:44:40 | AISSTREAM | morze, kurs 304° (do Karlskrony) | tak |
| Stena Ebba | 05.10 05:44:40 | AISSTREAM | morze, kurs 191° (do Gdyni) | nie — rejs do Polski, wróci w strefie Gdyni |

Paczka produkcyjna zawiera nową regułę (`ferryVisible` w `index-*.js`). Mapy po zalogowaniu nie oglądałem (brak konta w tym przebiegu).

### 4. Część B

- **B-7a** zrobione: wysokość mapy z wysokości okna, nie z tabeli. **B-7b** zrobione: na ekranie ≤ 768 px pas warstw nad mapą. Test `tests/b7-map.spec.ts` (6 rozmiarów, 12/12).
- Zrzuty wizualne mapy się zmienią (90 ujęć `mapa__*` w pełnym wzorcu, 2 w `tests/__screenshots__`). Wzorców nie odświeżono — decyzja właściciela.
- Propozycje na piśmie: `PROPOZYCJE_B_05_10.md` (B-7c, B-8 filtry i statusy, zmiana ciągnika, B-9, Q-9). B-3a czeka na wymiary.

Kontrole: H1 / H3 / H6 false, 94 transporty, bez SMS, bez usunięć, bez wydatków.

## 2026-10-05 07:57 (czas warszawski) — wzorce map (B-MAPA / B-7a / B-7b), potem część B

Teraz: wzorce map → B-2a · Zrobione w tym kroku: dopisek POLECENIA 07:57, odświeżenie 90× `mapa__*` + 2 smoke mapa · Następne: B-2a według PLAN.md (B-1 już na main od PR #4).

### Wzorzec mapy

Przyczyna zamierzona (właściciel 07:57): B-MAPA (podkład HERE / zapas z etykietami), B-7a (stały rozmiar mapy), B-7b (warstwy na telefonie w pasie nad mapą). Opis: `G4_WZORZEC.md` §B-MAPA/B-7a/B-7b.

- `shots-baseline/mapa__*` — 90/90 odświeżone (FILTER=mapa, demo build, port 4189).
- `shots-baseline/kokpit__*` — 78 ujęć odświeżonych (wbudowana mapa z B-MAPA); pozostałe bez różnicy.
- `tests/__screenshots__/`: mapa 2 + kokpit 2 odświeżone.
- Strefy / opcje / harmonogram / stany: bez odświeżenia (różnice stref w kolumnach tabeli, nie z mapy).
- Po odświeżeniu: mapa 90/90 i kokpit 90/90 identyczne; smoke visual 4/4 zielone.

B-1: już na main (PR #4, 03.10). B-MAPA, PL-PLURAL, B-7a, B-7b: zrobione wcześniej 05.10. Czekają na właściciela: B-7c, filtry/statusy B-8, B-9, Q-9. B-3a czeka na wymiary D-83.

### Wdrożenie wzorców

PR #66 scalony (`9b77bcb`). Wdrożenie z commita Sebastiana `640a162` (to samo drzewo co main): `dpl_CjysPKxU2eLWYkCLm21ne1S4zFhW`. Obie domeny 200 (tower.log-mar.pl, watch-tower-makieta.vercel.app). Pusty commit Hobby: PR #68.


## 2026-10-05 (czas warszawski) — B-2a wypłynięcia Steny w Ryzykach

Teraz: B-2a · Przyczyna: panel Ryzyka filtrował wyłącznie `GDN-NYN` (Polferries). Stena (`GDY-KAA`) nie wchodziła do tabeli wypłynięć.

Naprawa: `upcomingOutboundSailings` — obie linie do Szwecji z lookback 3 h; UI: sekcje Gdańsk→Nynäshamn i Gdynia→Karlskrona. Test `tests/b2a-stena-sailings.test.ts`. Bez migracji, bez SMS, bez wydatków.

## 2026-10-05 (czas warszawski) — B-2c Centrum decyzji

Opis, nie budowa UI. `LOGIKA_SYSTEMU.md` §1: Centrum ≠ kafelek „Wymaga decyzji”; panel tylko w trybie supabase; od L-1/L-1b/L-3 decyzje otwiera `decision_open_from_event`. Na produkcji 05.10: 45 otwartych (NO_AWIZACJA, DOC_MISSING, SEFS_OUT_OF_TABLE…). Pusty wygląd = demo / rola KSH / RLS przewoźnika / brak otwartych po filtrze statusu — nie awaria odświeżania.

B-2a wdrożone: PR #69, `f77de74`, dpl_YMvYgchmv4QPdnJzhEJA1Ea9SjZ8, obie domeny 200. H1/H3 false, H6_MAP_OBSTACLES false. Następne: B-3a czeka na wymiary D-83 — pomijam; B-4a.

## 2026-10-05 (czas warszawski) — B-4a Finanse bez pilotażu w przychodzie

Usunięte z widoku Finanse wiersze przychodu „Pilotaż i dodatki” / „Przychód — pilotaż i dodatki” (KSH i HHL). Suma przychodu i marży bez zmian (nadal z `revTotal`). Po stronie kosztu SCX wiersz zostaje. Test `tests/b4a-fin-no-pilot.test.ts`. B-3a pominięte — czeka na wymiary D-83.

## 2026-10-05 (czas warszawski) — B-4b załącznik = CMR

W Faktury i BillsPanel lista/wgrywanie tylko CMR (bez POD). Etykiety PL/EN/SV. Test `tests/b4b-cmr-only.test.ts`. Odświeżone ujęcia `faktury*` ze zmianą zamierzoną.

## 2026-10-05 ~08:30 (czas warszawski) — raport: wzorce map + część B do B-4b

### Wzorce map (polecenie 07:57)
- PR #66 (`640a162` / merge `9b77bcb`), wdrożenie `dpl_CjysPKxU2eLWYkCLm21ne1S4zFhW`
- 90× mapa__* + 78× kokpit__* + 4 smoke; przyczyna: B-MAPA, B-7a, B-7b
- smoke visual 4/4; mapa/kokpit 90/90 vs wzorzec

### Część B
| ID | Status | PR / SHA / deploy |
|---|---|---|
| B-1 | już na main (03.10) | PR #4 |
| B-2a | zrobione | PR #69 `f77de74` / `dpl_YMvYgchmv4QPdnJzhEJA1Ea9SjZ8` |
| B-2c | zrobione (opis) | PR #70 `62d5c22` / `dpl_GQBM6RLoeUtoLJtUjDPzB38PwaS5` |
| B-3a | pominięte — czeka na wymiary D-83 | — |
| B-4a | zrobione | PR #71 `bfc7ed9` / deploy Hobby z tego SHA |
| B-4b | zrobione | PR #72 `63f6086` / deploy na tower.log-mar.pl |
| B-5… | następne według PLAN | — |

Pominięte propozycje: B-7c, filtry/statusy B-8, B-9, Q-9. B-7a/B-7b wcześniej.

Kontrole: H1_ROUTE_CHECK false, H3_CORRIDOR_OBSTACLES false, H6_MAP_OBSTACLES false; 94 transporty aktywne; bez SMS, bez usunięć, bez wydatków.

## 2026-10-05 ~09:05 (czas warszawski) — część B: B-5 i B-6a…B-6i

Polecenie 05.10 ~08:35 (POLECENIA_KOORDYNATORA). PR #74: `8144d8b` (B-5 test), `f9580c6` (B-6a…i), `238247a` (skrypt 0164); merge `afe9f1e`. Wdrożenie Hobby z drzewa main: `dpl_GDQUstA58xFQ1gKxTeKmshnKHeBk`. Obie domeny 200.

| ID | Status | Uwagi |
|---|---|---|
| B-5 | zrobione (test) | w produkcji już `historyOnly` od ed59ef8; makieta demo nadal pokazuje kreator (wewnętrzna) |
| B-6a/b/c | zrobione | „Jak to działa” w sekcjach |
| B-6d | zrobione | pulpit Stanu systemu |
| B-6e | zrobione | 0164 na prod (dry-run ROLLBACK → transakcja, `schema_migrations` 0164); 9 wpisów uzupełnionych, wyzwalacz 1, RLS, brak uprawnień anon/authenticated |
| B-6f | zrobione | „200” = licznik wczytanych wierszy, usunięty |
| B-6g, B-6i | zrobione | bez rozjazdu w prawo (1440 i 390) |
| B-6h | opis + odczyt dzienny | ceny nie zbierają się same; prod 0 odczytów; automat = propozycja (regulaminy OKQ8/ORLEN) |

Brama: vitest 755/755; gitleaks 0; npm audit --omit=dev high 0; `tests/db/gate.sh` PG17 :5433 — 33 zestawy OK (dec6 23/23, backup 29/29), 0 FAIL.

Wizualnie: 120 ujęć opcje/automatyzacje/ustawienia z B-6 = identyczne z main `badfe4c`. Wzorców nie odświeżałem. Uwaga: 18 ujęć `opcje__hhl__*` różni się od wzorca z 03.10 już na main (sekcja „Czas wolny i przestój” z 43e41fb, 04.10), nie przez B-6.

Stop: B-3a (D-83); propozycje B-7c, filtry/statusy B-8, B-9, Q-9.

Kontrole: H1_ROUTE_CHECK false, H3_CORRIDOR_OBSTACLES false, H6_MAP_OBSTACLES false; 94 transporty aktywne; bez SMS, usunięć, wydatków.

| CSP-RO+D-3 | CSP Report-Only 7 dni + D-3 retencja dokumentów | **DONE** 05.10 | (PR tej paczki) | migracja **0180** PROD+TEST; ZAP Baseline prod High=0 | CSP-RO do 2026-10-12; naruszenia w Stanie systemu; CMR/POD/zdjęcia 3 lata, PDF faktur 5 lat; I-7 bez zmian; TELM true; H1/H3/H6 false |
| AUD-STEP0 | audyt pełny 06.10 — kopia audytu, polecenie, PLAN AUD-01…18 | **DONE** 06.10 10:41 | PR #136 (`f87e338`) | docs | P2-TILES odłożone (gałąź `feat/p2-tiles-06-10`, `3deb252`) |
| AUD-01 | Mapa — czas ładowania (A1) | **DONE** 06.10 11:20 (pomiar prod po zalogowaniu czeka na sesję) | PR #137 (`f291c84`); 0190 PROD; `here-raster` wdrożona; Vercel `dpl_Hv5CtFjKrs3TDbtnMAVRW36MsJmJ` | vitest 847/0, aud01 11/11; DB gate OK (i2 540, nullguard 597); gate:visual 280/280 zmienione=0; fresh-smoke OK; gitleaks 0; npm audit 0 | makieta: Mapa 195 → 4 zapytań, kokpit 123 → 28, panel 12 → 8; `load_track` 188/94/2 → 0; obie domeny 200; `/tiles/…` → funkcja (401 bez sesji, `no-store`) |
| AUD-01c | awaria mapy na produkcji (polecenie właściciela 06.10 13:45) | **DONE** 06.10 16:20 | PR #140 (`6e93d2d`); Vercel `dpl_GWYpijKvAdJhBjKefkm8z81w1BWJ`; `here-raster` z `6e93d2d`; bez migracji | vitest 852/0; gate:visual 280/280 (24 ciemne ujęcia odświeżone, przyczyna `2122418`); fresh-smoke OK; gitleaks 0; npm audit 0 | `/tiles/logistics.day|night` 200 PNG na obu domenach; MISS→HIT 24/24; `X-Sb-Edge-Region: eu-central-1`, Vercel fra1; `latest_vehicle_fixes` 94 id 37 ms, 0×500 od 12:02; s-maxage 24 h (HERE); CARTO wymaga klucza → Esri + filtr; obie domeny 200 |
| AUD-01d | Podkład — bez wspólnej pamięci brzegu, HERE wprost (decyzja 06.10 16:28) | **WDROŻONE** 06.10 17:25; czeka klucz przeglądarkowy HERE (właściciel) | PR #142 (`55849da`); 0191 PROD; `here-raster` v8; Vercel alias tower.log-mar.pl | vitest 859/0, aud01d 7/7; DB gate OK (bmapa 33, nullguard 602, security 88); curl: private, bez s-maxage, MISS/MISS/MISS |
| AUD-01e | Jedna mapa na sesję (z AUD-01d) | **WDROŻONE** 06.10 18:29 | PR #144 (`e9d8bf7`); Vercel `dpl_7q3eE1oPS5bmitnHkUHcJS5NRJ6N` | vitest 863/0; pool spec 1/1; gate:visual OK 280/280; powrót Mapa 33–42 ms, 0 nowych kafelków |
| AUD-02 | Dzwonek (A2) | **ZROBIONE** 06.10 19:43 (prod `dpl_HDXx6Teob8JTLRRobwtfDstxS4UX`) | #146 → `e658d11` | vitest 869/0, aud02 6/6; tsc; lint 0 błędów; gate:visual OK 280/280, 0 zmienionych; fresh-smoke OK; gitleaks 0; audit 0 | 1 812 pozycji z kodem szablonu → 0; 2 539 nieprzeczytanych → 1 974 pozycji po grupowaniu |
| AUD-03 | KSH — panel zlecenia (A3) | **ZROBIONE** 07.10 00:27 (prod `dpl_6d2fJgQAiCDsJ3D4ZoQ6E8fCbEHz`) | #148 → `151754d`; 0192 PROD | vitest 879/0 (aud03 9/9); Playwright aud03 4/4; DB aud03 25/25 (gate OK, session/l13 dług); tsc; lint 0 błędów; gate:visual OK 280/280, 0 zmienionych; fresh-smoke OK; gitleaks 0; audit 0 | KshSideMenu usunięty; „Edytuj” → 4 pola dat; Historia „// KSH”, DEC-4, ETA/BAF, I-10; „Zmień ciągnik” ukryty; prod SQL: RPC bez konta → 42501; obie domeny 200; test kontem KSH na prod niewykonany (brak logowania bez przeglądarki) |
| P0-CI | narzędzia na Windows (D-86, D-87; dopiski D-20261011-2135-01, D-20261011-2254-01, D-20261012-0105-01; R1–R6) | **DONE** 12.10.2026 ~01:33 | PR #152 → HEAD `07c99696` (df975e88 workflows+backup-core; e50c4a48 R1 service_role; b16a9108 R2 D14; ac92c785 R3 maxWorkers win32; 07c99696 R4 TZ/PGTZ + R5 baf + R6 bmapa) | unit 901/35 skip (Windows hak + CI); unit CI https://github.com/Spawn2018/testowe-do-migracji/actions/runs/38184171848 (1 m 2 s) + https://github.com/Spawn2018/testowe-do-migracji/actions/runs/38184173964 (53 s); db https://github.com/Spawn2018/testowe-do-migracji/actions/runs/38184173968 (8 m 15 s) — `[db] i2 540/540 OK`, `[db] insurance 42/42 OK`, `[db] baf 46/46 OK`, `[db] bmapa 33/33 OK`; visual https://github.com/Spawn2018/testowe-do-migracji/actions/runs/38184176295 (5 m 46 s); etap5-ui `--repeat-each=20` 100/100; gitleaks 0; npm audit --omit=dev high 0 | R2: `useRouteSync` — HashRouter w `startTransition` odkładał lokację; URL→sklep przez `useLayoutEffect` + `hashchange` (wstecz zamyka szufladę). R4: `TZ`/`PGTZ=Europe/Warsaw` w `db.yml`. R5/R6: `fresh_price` w baf; `here_note_service` w bmapa. Krok 8: nocna brama wizualna na tym komputerze **nie** (brak `/workspace/wt-gate-visual/history.log` i zadań Harmonogramu); psql OMNIROUTE 16.15; gh auth Spawn2018 (gist, read:org, repo, workflow). Dopiski w `docs/handover/dopiski/` (3 pliki). |

## 2026-10-12 — P0a — komplet dokumentów z 08–09.10.2026

Gałąź `pakiet/P0a-komplet`. Tylko dokumenty (bez `src/`, `supabase/`, `scripts/`, `tests/`). Hash scalenia wpisze pierwszy commit P0b.

### Przeniesienia
- skrypt `P0a_przeniesienia.sh`: **279** plików do `docs/archiwum/2026-10-08/` (brakujących: 0) + `stare-instrukcje/` (5: `AGENTS.md.txt` + 4 reguły `.mdc.txt`); łącznie **284** pliki w archiwum;
- 3 pliki z kwotami poza repozytorium: `D:\Watch Tower\dane\archiwum-2026-10-08\` (`RAPORT_BAF_CENY_94_05_10.md`, `WIP_BAF_CENY_05_10.md`, `BAF_SPEC.txt`);
- na miejsca: `AGENTS.md`, 4 reguły `.cursor/rules/*.mdc`, `PLAN.md`, konstytucja, rejestr, inwentarz, indeks, 7 procedur `08_SKILLE/`, folder audytu, 4 dopiski z kompletu;
- w `docs/handover/dopiski/` **7** plików D-* (4 z kompletu włączone do planu; D-20261011-2135-01, D-20261011-2254-01, D-20261012-0105-01 — włączy Sesja 1 / P0b).

### Testy przed PR
- `npm run test:unit` — 901 passed / 35 skipped;
- `npm run lint:css` — zielone;
- gitleaks (zmiany w gicie) — 0; `npm audit --omit=dev --audit-level=high` — 0;
- przed scaleniem: check `visual` w PR (D-87); `db` nie startuje (bez SQL).

### Stan dawnych pozycji (P0a pkt 5)
| ID | Stan | Dowód |
|---|---|---|
| L-1b | zrobione | PR #18 `edd2509b` / merge `6cbc72b4`; migracja `0021_driver_token.sql`; POSTEP „dec-auto L-1b” |
| L-4 | zrobione | PR #20 `43e41fb1`; cele kliknięć; AUD-02 `e658d11f` (cel L-4) |
| L-5 | zrobione | PR #21 `2af2e469` (dzwonek L-5); smoke B-SMOKE-DRIFT `55eccc4b` |
| L-9 | zrobione (część); reszta P6 E7-5 | PR #32 `6ba8d01d` (rejsy z bazy); FERRY-STATUS PR #58 `63de6190` |
| L-13 | zrobione | PR #22 `e143dd57` / merge `94efe0b6`; POSTEP „L-13 na produkcji” 04.10 |
| L-12 | zrobione | PR #35 `4126b39c` / merge `cd870897` (kreator stref) |
| TELM-EMTRACK-WEB 5–6 | części pokryte E23/E27/E32; monitoring 72 h — do sprawdzenia przy P10a/P4 | PR #88 `c2bb800d`, #90 `ad5e942a` (LIVE); flaga/API — W15 |
| P1-LINT | zrobione | `npm run lint:css` zielone 12.10; PR #3 `fix/p1-font` |
| P1-FONT | zrobione | PR #3 `141c917d`; `public/fonts/barlow*.woff2` + `barlow.css` w repo |
| AUD-04 | zrobione | PR #150 `5f6111cc`, #151 `90c5df40` |
| SG-03 raport po rozładunku | zastąpione audytem | PLAN §7 → testy E15/E26/E42 (P4, P8) |
| SMS-KSH-1H | docs/STOP — strefa Śrem ≠ D-37 | PR #42 `027e0b47`; do sprawdzenia przy P8 |
| H-2-PL | zrobione | PR #86 `98200036` (HERE Traffic PL) |
| ZEZW-13 | czeka na właściciela (wymiary) | POSTEP: W / D-83; B-3a pominięte |
| B-3a | niezrobione — czeka D-83 | POSTEP 05.10: pominięte |
| H-6 | flaga false; do sprawdzenia przy paczce mapy | H6_MAP_OBSTACLES false (POSTEP 05.10) |
| D-83 | czeka na właściciela | wymiary zestawów — STOP B-3a/H-* |
| pozycje D4–D12 audytu | zamknięte | brak treści w starym planie (P0a_WGRANIE pkt 5) |
| SG-01 driver_token usunięcie | do P1 | PLAN §7; nie potwierdzono usunięcia wiersza w P0a |

Zmienione ścieżki: `AGENTS.md`, `.cursor/rules/**`, `docs/**` (w tym archiwum i audyt). `PLAN.md` §4 P0a → „NA PRODUKCJI — dokumenty, bez wdrożenia aplikacji”.

## 2026-10-12 — P3-APK — uzupełnienie W21 (pin SHA) — NA PRODUKCJI

- **W21 dostarczone 12.10.2026, 02:38** — token GitHub ma uprawnienie `workflow` (sprawdzone 11.10 w P0-CI; `gh auth status`: gist, read:org, repo, workflow).
- Gałąź `pakiet/P3-APK-uzupelnienie-W21` → PR #154 → merge **`e8351fc3`** (12.10.2026 03:07).
- SHA (koordynator 12.10, `git ls-remote` + `^{}`): checkout `11d5960a…`, setup-java `cf277c60…` (v4 przestarzała — ostrzeżenie OK), setup-android `9fc6c4e9…` + `packages: platform-tools`, setup-gradle `ed408507…`, upload-artifact `ea165f8d…`.
- CI: `TOWER_APK_KEYSTORE_PROPS=/nonexistent/…` (domyślna ścieżka Windows ze spacją psuje URI na runnerze).
- Odbiór: build https://github.com/Spawn2018/testowe-do-migracji/actions/runs/38190237518 zielony, artefakt `sms-gateway-debug` 5 763 768 B; unit ×2 zielone; visual https://github.com/Spawn2018/testowe-do-migracji/actions/runs/38190241026 zielony; gitleaks/audit OK. Bez migracji, bez wdrożenia aplikacji.
- Czas pracy ~0,5 h (pin + poprawki CI); poprawki: packages tools, keystore path. Powrót do P0b.

## 2026-10-12 — P0b start: włączenie dopisków D-86/D-87 (Sesja 1)

- **Dzień 1 = 12.10.2026** (data sesji 0 / start P0a według PLAN §0; sesja uruchomiona 12.10).
- **Hash scalenia P0a:** `0aaf412b` (PR #153, `Merge pull request #153 from Spawn2018/pakiet/P0a-komplet`).
- **Hash scalenia P0-CI:** `9b0f3dc8` (PR #152).
- Pierwszy commit P0b: `plan: dopiski D-20261011-2135-01, D-20261011-2254-01 i D-20261012-0105-01` — włączenie do AGENTS, PLAN (§1, §3, §4 P0-CI + P0b, §5 W9/W32/W33, §8), rejestr D-86/D-87, skille tower-wdrozenie (R7) i tower-migracja-bazy (R8), reguły, G-15.

## 2026-10-12 — P0b · narzędzia bramy (Sesja 1, ciąg dalszy)

- Gałąź `pakiet/P0b-narzedzia-bramy` @ po `6a670980`.
- **git lfs:** 3.7.1 OK; **core.hooksPath:** `.githooks` OK (bez wpisu §5).
- `scripts/lib/gate-suites.mjs`: `EXPECTED_LOCAL` (= gate.sh) + `EXPECTED_TEST` (security 84, risks 21; reszta = LOCAL; nullguard 602, i2 540); brakujące zestawy (dwell…baf, backup); `KNOWN_DEBT` session/l13; CLI `--local-expected` / `--check`.
- `tests/db/gate.sh`: czyta liczby z gate-suites; `SUITES=a,b` filtruje zestawy.
- Konta 5 rodzajów: `FIVE_ROLE_USERS` + `ensureFiveRoleAccounts` po `prep`; `scripts/auth/seed-test-users.mjs` (odmowa prod); fixture `SEED_AUTH_USERS` (3 UUID) bez zmian.
- PLAN §4 P3-APK → „NA PRODUKCJI — scalenie e8351fc3 (PR #154), build APK zielony”.
- Pomiary CI / pełna brama TEST — po PR i przebiegu na `main` (dopisek niżej).

## 2026-10-12 — P0b na main (merge PR #155)

- Merge **`7fd5a3f3`** (PR #155). Hak pre-push: unit 901/35 skip ~41 s; lint:css OK.
- CI PR: unit ~52–59 s; visual 5 m 26 s; db 8 m 10 s — wszystkie zielone.
- `npm audit --omit=dev --audit-level=high`: 0.
- TEST zajęte: P0b (brama w częściach po merge).

## 2026-10-12 — P0b brama TEST (przerwana) + poprawka i2-4

- HEAD w trakcie bramy: `f834217a` (po PR #157/#158: 5 ról po resecie; session/l13 = KNOWN-DEBT).
- Do i2-3 zielone (nullguard 602/602; security/status/storage/money/release/archive/watchdog/invite/risks/import OK).
- **i2-4 czerwone:** `transport z oknem: delay_minutes = ETA z GPS − koniec okna` — `eta_site` NULL.
- **Przyczyna:** przy `TOWER_I2_PART=4` pomijana jest część 1, która wstawia pierwszą pozycję GPS dla L2; INSERT w I-25 kopiuje `source` z `positions` L2 → 0 wierszy (ten sam wzorzec co część 2, linie 234–243).
- **TEST wolne** (brama na `f834217a` niekompletna / czerwona na i2-4).
- Poprawka: `tests/db/i2.sh` — bootstrap pozycji w części 4 gdy brak wierszy (jak część 2; `DRIVER_PWA` przy `TOWER_HOSTED_READY`). Gałąź `pakiet/P0b-i2-part4-bootstrap`.
- Merge poprawki: **`a5b46607`** (PR #159).
- **TEST zajęte: P0b, od 09:38** (pełna brama w częściach na `a5b46607`; = odbiór P0b / brama z Dnia 1).
- Merge docs TEST zajęte: **`708bf6af`** (PR #160). Brama na tym SHA: do i2-4 zielone (poprawka bootstrap); **dec6 19 OK / 4 FAIL** (wstawki `auth.sessions` dla kont seeda — FK → `auth.users` na hosted). Pętla przerwana na polecenie koordynatora 12.10 12:30 (ten sam FAIL 2×). **TEST zajęte** zostaje do scalenia poprawki SKIP + pełnej bramy od zera na nowym SHA.

## 2026-10-12 — P0b zamknięte: pełna brama TEST zielona

- Merge poprawki backup SKIP: **`832cca5a`** (PR #162; wcześniej dec6 SKIP `f79d8d22` / PR #161, i2-4 `a5b46607` / PR #159).
- **TEST wolne** (od 21:42). Pełna brama w częściach na `832cca5a` + migracja `0192_aud03_ksh_panel_dates.sql`: **BRAMA ZIELONA**.
- Start pętli 18:06 → komplet ~21:42 (~3,6 h). Wszystkie zestawy OK wg `EXPECTED_TEST` (m.in. dec6 19/19 +4 SKIP; backup 21/21 +8 SKIP; nullguard 602/602; i2 540/540).
- Check `db` na `main` po #162: zielony (run 38275045276, ~8 m 47 s). `gh workflow run db.yml --ref main -f suites=security`: uruchomiony 21:43 (run 38299522527).
- Hak / CI (PR #162): unit 901/35 skip; visual zielony; `npm audit --omit=dev --audit-level=high`: 0.
- Produkcja: bez migracji aplikacji w P0b; `tower.log-mar.pl` i makieta Vercel → 200.
- PLAN §4 P0b → NA PRODUKCJI (narzędzia). Następna paczka: **P1**.

## 2026-10-12 — R1 D-20261012-2210-01: przerwana pętla bramy TEST

- 12.10 22:02–ok. 22:20: pętla bramy TEST po komplecie na `832cca5a` ruszyła ponownie od `prep` na zmienionym HEAD; przerwana (D-20261012-2210-01 R1); ostatnie czyszczenie TEST 22:19:33; wyniki tego przebiegu nieważne; odbiór P0b bez zmian; TEST wolne od 22:32.
- Pętla (`run-loop.pid` 15116) i monitor (`chat-status.pid` 19670) martwe; `test-db-gate-step` nie działa. Odczyty `pg_stat_activity` (postgres, active, bez własnego pid): 22:27 = 0, 22:32 = 0.

## 2026-10-12 — P1 · zestaw e18 16/16

- 12.10 **22:20:05**, baza **TEST** (hosted): `[db] e18 16/16 OK`, migracja `0193_e18_porzadki.sql`, krok `node scripts/test-db-gate-step.mjs e18` (log `tmp-gate/e18-full.log`). Nie GitHub Actions i nie lokalny Postgres.
- Gałąź `pakiet/P1-e18`, HEAD wtedy `b3da6dbc`. Pliki `0193_e18_porzadki.sql` i `tests/db/e18.sh` były tylko w drzewie roboczym, bez commita. Ten wynik nie jest bramą do scalenia.
- GitHub `db` na `cc206d48` (run 38307558150, zestawy e18,security,status,nullguard): security 88/88, status 44/44, nullguard 602/602, **e18 2/16**. Przyczyna: lokalny CI nie ma `auth.users`; `delete` w 0193 przerywał zestaw. Poprawka: brak tabeli jest pomijany, jak brak uprawnień na hosted.
- GitHub `db` na `a827de61` (run 38308278607, 12.10 23:04, te same zestawy): **e18 16/16**, security 88/88, status 44/44, nullguard 602/602. Lokalny Postgres 17 w CI, nie TEST. 0193 nie zmienia innych zestawów (na pustym seedzie nic nie rusza).
- Pełne checki PR #164 na `27ec3c3b` (unit, db, visual) zielone. Nie scalono — dopisek D-20261012-2335-01 zmienia migrację.

## 2026-10-12 — P1 · D5 K1–K9 (D-20261012-2335-01)

- K1–K9 w migracji `0193`, `scripts/e18/kopia.mjs` i `tests/db/e18.sh`. Liczba zestawu `e18` w `scripts/lib/gate-suites.mjs`: **41**. Pozycja D5 w PLAN §4, wiersz w §8.
- Brama GitHub i potwierdzenie na TEST: jeszcze nie na tej głowie. Próba z ROLLBACK na produkcji: jeszcze nie. Bez scalenia #164.
- GitHub `db` na `79e891a1` (run 38313075911, zestawy e18,security,status,nullguard): security 88/88, status 44/44, nullguard 602/602, **e18 39/41**. Pełny check `db` na PR #164 (run 38312970245) też czerwony. Unit i visual zielone.
- GitHub `db` na `3652268f` (run 38314196509): znowu **e18 39/41**. Oba czerwone sprawdzenia: `pg_trigger.tgenabled` (typ `"char"`) bez rzutowania na tekst, zapytanie się nie wykonuje. Reszta K8 zielona.
- GitHub `db` na `9b4e3c16` (run 38315461054, 13.10 ok. 00:15, zestawy e18,security,status,nullguard, lokalny Postgres 17, nie TEST): **e18 41/41**, security 88/88, status 44/44, nullguard 602/602. Checki głowy PR #164 na tym SHA: unit, visual i pełny `db` (run 38315467215) zielone. Bez scalenia.
- TEST zajęte: P1, od 13.10 00:28 — potwierdzenie w kopii roboczej według R2 (SHA `9b4e3c16`; zestawy security, status, e18, nullguard, potem testy logowania).
- TEST 13.10 00:30–00:52, SHA `9b4e3c16`, kopia `/d/Watch Tower/brama-test`: security 84/84 (+2 SKIP), status 44/44, **e18 40/41**. Jedno czerwone: „4 konta auth.users” — przygotowanie wstawiało wiersz bez zaproszenia, wyzwalacz `handle_new_auth_user` zwraca `TOWER_NO_INVITE`. nullguard i testy logowania nie ruszyły. Pętla skończyła się sama (drugi FAIL). TEST wolne od 00:52. Kopia robocza zdjęta.
- GitHub `db` na `09d43e5e` (run 38319498611, zestawy e18,security,status,nullguard; pełny check PR run 38319503803): security 88/88, status 44/44, nullguard 602/602, **e18 40/41**. Przygotowanie kont `auth.users` pisało log do `tmp-gate/`, którego nie ma w czystym CI (katalog w `.gitignore`). Unit i visual zielone. Bez scalenia.
- GitHub `db` na `1d72a26f` (run 38320359925, te same zestawy; pełny check PR run 38320365051): znowu **e18 40/41**. Zapytanie rodzaju `auth.users` używało `'auth.users'::regclass`, które pada przy planowaniu, gdy tabeli nie ma. Reszta zestawów zielona. Unit i visual zielone. Bez scalenia.
- GitHub `db` na `a24c05e0` (run 38321283995, 13.10 ok. 01:18, zestawy e18,security,status,nullguard, lokalny Postgres 17, nie TEST): **e18 41/41**, security 88/88, status 44/44, nullguard 602/602. Checki głowy PR #164 na tym SHA: unit, visual i pełny `db` (run 38321287705, 8 min 12 s) zielone. Bez scalenia.
- **TEST zajęte: P1, od 13.10 01:26** — potwierdzenie w kopii roboczej według R2 (SHA `a24c05e0`; zestawy security, status, e18, nullguard-1…4, potem testy logowania).
- TEST 13.10 01:26–03:32, SHA `a24c05e0`, kopia `/d/Watch Tower/brama-test`, raport `D:/Watch Tower/raporty/brama-test-a24c05e07573f6c2970d33ed08e78b7f274e2278.json`. Zestawy: security 84/84 (+2 SKIP), status 44/44, **e18 41/41**, nullguard 161+136+188+117 = 602/602. Logowanie: `verify.mjs` 21/21. BK3 po poprawce kodu projektu: 12/14 (M10 i M12 wymagają fixture spoza seedu: brak statku Wawel i rejsów POLFERRIES). PKCE 7/8 — administrator API przyjmuje hasło krótsze niż 12 znaków. Stary test przeglądarki szuka tekstu „Wyślij link do logowania”, a ekran ma przycisk „Zaloguj”. BK5: 5/8 (przewoźnik, własny numer zlecenia: HTTP 403), 2 nie ruszyły. **TEST wolne od 03:32.** Kopia robocza zdjęta. Bez scalenia #164.
- **TEST zajęte: P1 (testy na żywo), od 03:50** — SHA głowy PR po D6.
- TEST 13.10 03:50–04:12, SHA `c1b18f8d`, build `/tmp/wt-sb-dist` z `TEST_SUPABASE_URL` / `TEST_ANON_KEY`. Hasło: produkcja `password_min_length=12`, `password_required_characters=""`; TEST przed: 6 / `""`, po: 12 / `""` (`sync-test-password-policy.mjs`). Logowanie: verify **21/21**, BK3 **14/14**, PKCE **8/8**, `e2e-browser.mjs` **20/20**, BK5 **8/8**. `git diff origin/main -- src/` puste. L6: diff `a24c05e0`…`c1b18f8d` w `supabase tests/db scripts/lib scripts/e18 src` pusty. **TEST wolne od 04:12.**
- Checki głowy #164 `9b9f948c`: unit, `db`, visual zielone. Scalenie #164 → `08c18747` (13.10 04:25).
- Kopia produkcji: `D:\Watch Tower\dane\e18\kopia-e18-2026-10-13-02-27-44.json`, SHA-256 `6d0396e84a82ed97698dad777f78919822c9d75febf6522448b95248ea8a6a55`. Liczby: app_users 6, audit wskazujący 11, powiadomienia kont 2951, odczyty 10, „Działaj jako” 1, zaproszenia 3, auth.users 3, polisy 2, faktura 1, pozycje 1, spory 2, wiadomości 4, SG-24 stany stref 2 i sprawy 2, pozycje SG-03 po wyjeździe 103, P13 4, token SG-01 1.
- R3 (`99772e11`, potem #165 → `1840d87c`): dry-run ROLLBACK, apply COMMIT. Usunięte znaczniki: 20261004180552 email_status_from_resend, 20261004180725 l6_backup_retry, 20261004192928 l12_geofence_creator, 20261005003650 ferry_status, 20261005011518 pl_data, 20261005103503 h2pl_here_traffic, 20261005105010 d78_here_pools_confirmed, 20261005105317 telm_emtrack_web, 20261006145638 0191_aud01d_here_tiles_report, 20261006222552 0192_aud03_ksh_panel_dates. Dopisane: 0171, 0172, 0173, 0191, 0192. `_check-mig-parity` przed 0193: `missing_in_repo —`, `missing_on_prod 0193`.
- R4 13.10 04:32: próba z ROLLBACK — konta 6, auth.users 3→0, zaproszenia 3, dziennik 11, P13=4, SG-03 pozycje=103, cutoff `2026-10-07 10:19:54+00` (12:19:54 czasu polskiego). Powiadomienia obce 8992=8992, SMS 27=27, HTTP 877=877. `--dry-run` tylko `0193_e18_porzadki.sql`. `db push` nałożył 0193; drugi raz: „Remote database is up to date.” Parytet **MATCH YES** (193/193).
- Odbiór po migracji: konta +tower 0, zaproszenia 0, dziennik już nie wskazuje tych kont, wpisy migracji 11 (żaden stary wpis nie skasowany). Polisa `436000430439` = ERGO Hestia, `OCP-SCX-2026-WT` 0. Faktura testowa 0. Wiadomości 29/31/32/33 = 0, 34 i 35 zostają. Token SG-01 = 0, SG-24 = 2. SG-24: PLANNED, bez numeru HHL, kierowcy i rejsu; strefy 0, otwarte sprawy 0. SG-03: 281 pozycji, ostatnia 07.10 12:19:54. ETA przed wyjazdem z opóźnieniem: 0. Wyzwalacze `trg_loads_eta`, `trg_loads_status_matrix_notify`, `trg_risk_matrix_notify` włączone. Odczyt chwilę po COMMIT: notifications 8999, sms 27, http 879 (w transakcji równość; różnica to ruch po COMMIT).

**P1 NA PRODUKCJI — commit `08c18747`, 13.10.2026 04:32.** Następna paczka: P2.

## 2026-10-13 — P2 · fundament ekranów

- TEST zajęte: P2, od 13.10 12:27 — potwierdzenie w kopii `/d/Watch Tower/brama-test` na SHA `eb49590d` (zestawy security, status, e41, nullguard). Checki PR #167 na tym SHA: unit, visual i `db` zielone.
- TEST 13.10 12:28–13:17, SHA `eb49590d`, migracja `0194_e41_nazwa_formaty.sql`. security 84/84 (+2 SKIP), status 44/44, **e41 16/16**, nullguard 161+136+192+118 = **607/607**. Raport `D:/Watch Tower/raporty/brama-test-eb49590d717ee9210d334e61aa750b12faa06f7e.json`. To potwierdzenie paczki, nie pełna brama tygodniowa (reszta zestawów nie była uruchamiana). **TEST wolne od 13:17.**
- Produkcja 13.10 13:33–13:35, merge `35abe70b`. Parytet przed migracją: `missing_in_repo —`, `missing_on_prod 0194`. Kopia tytułów poza repozytorium: `D:\Watch Tower\dane\p2\kopia-e18-p15-2026-10-13.csv`, 88 wierszy danych, SHA-256 `fc9ee0db9fb7be3b653c62a072e001a16af55aed0b39dfe630211a9916a8d963`. Próba z ROLLBACK: `e18_p15_apply` 49, drugi raz 0, po ROLLBACK funkcja 0 i migracja 0. `db push` nałożył 0194; drugi raz: „Remote database is up to date.” Po COMMIT: migracja 0194 jest, funkcje 3, „Nieznany kod źródła drogowego” otwarte 39, kopie w dzienniku 49, tytuły „Zakaz ruchu…” 13. `tower.log-mar.pl` i `watch-tower-makieta.vercel.app` zwracają 200.

- Q1 (D-20261013-1400-01), wdrożenie aplikacji z `main` `bea31774` według R7, 13.10.2026 14:08. Identyfikator `dpl_CqK5DSotFYHT8QyeFwLzMUixdBCs`. Plik JS przed: `assets/index-DtP8UgG7.js` (wdrożenie z 12.10 05:07). Po: `assets/index-h0t0ItfK.js` — ta sama nazwa w logu buildu Vercel (`dist/assets/index-h0t0ItfK.js`) i w `tower.log-mar.pl`. `tower.log-mar.pl` i `watch-tower-makieta.vercel.app` zwracają 200. 63 pliki JS z tego buildu: 0 wystąpień `service_role`. Build produkcyjny doszedł do końca (strażnik paczki w `vite.config.ts` nie zatrzymał). Kopia wdrożeniowa usunięta.

**P2 NA PRODUKCJI — commit `35abe70b`, wdrożenie `dpl_CqK5DSotFYHT8QyeFwLzMUixdBCs`, 13.10.2026 14:08.** Następna pozycja: poprawki P2 (Q2), potem P3.

- TEST 13.10 14:30–15:20, SHA `ccf0d68c`, migracja `0195_e18_p15_poprawka.sql`. security 84/84 (+2 SKIP), status 44/44, **e41 26/26**, nullguard 161+136+192+118 = **607/607**. Raport `D:/Watch Tower/raporty/brama-test-ccf0d68c2a994b00122805b30d626d5d86ddfac4.json`. **TEST wolne od 15:20.**
- Produkcja 13.10 15:31–15:33, merge `c410799a`. Parytet przed: `missing_on_prod 0195`. Kopia 13 wierszy: `D:\Watch Tower\dane\p2\kopia-e18-p15-poprawka-2026-10-13.csv`, SHA-256 `80139c845d206fba319df6b9be5e09ceb260d21e29239793166cbb49712f4148`. Próba z ROLLBACK: pierwsze `e18_p15_poprawka` 13, drugie 0, otwarte „Zakaz…” w transakcji 0, wpisy poprawki 13; po ROLLBACK funkcja 0, migracja 0, powiadomienia 9638, SMS 27. `--dry-run` tylko `0195_e18_p15_poprawka.sql`. `db push` nałożył 0195; drugi raz: „Remote database is up to date.” Parytet **MATCH YES** (195/195). Po COMMIT: otwarte „Zakaz ruchu ciężarówek w Szwecji” 0, `E18_P15_POPRAWKA` 13, powiadomienia 9638, SMS 27.
- Wdrożenie aplikacji z `main` `c410799a` według R7, 13.10.2026 15:35, `dpl_6FkHhuRasJEFybtjDRbLY72P8kvv`. Plik JS przed i po: `assets/index-h0t0ItfK.js` (moduł tytułów nie wchodzi do paczki, bo aplikacja go nie importuje; nazwa równa `dist/assets/index-h0t0ItfK.js` z tego wdrożenia). Oba adresy 200. 63 pliki JS: 0 × `service_role`. Kopia wdrożeniowa usunięta.

**P2-poprawki NA PRODUKCJI — commit `c410799a`, migracja 0195, wdrożenie `dpl_6FkHhuRasJEFybtjDRbLY72P8kvv`, 13.10.2026 15:35.** Następna paczka: P3.

## PAUZA 2026-10-13 16:20

- Gałąź `pakiet/P2-wyglad`, SHA przed tym commitem `02de6300` (main po scaleniu planu, PR #171). Produkcji ten krok nie zmienia. Bramy TEST nie było.
- **Zrobione z dopisków D-20261013-1535-01 i D-20261013-1550-01:** Z8 (konstytucja VIII, rejestr `WYGLAD-RAPORT`), Z9 (`AGENTS.md`, `.cursor/rules`, PLAN §0, §1 pkt 5, nagłówek §4), V5 w P3, V6 w P7, Z12 w P11 — scalone na `main` (`02de6300`). Dopisków D-20261013-1525-01 i D-20261013-1615-01 nie wykonywano.
- **W drzewie, bez sprawdzenia:** V1 (kolumna „Wysyłka” = sam kod), V2 (liczba tylko przy Ryzykach na dolnym pasku — CSS), V3 (szkic kart, tekstu i celów oraz `tests/e8-phone-gate.spec.ts`). Brama E8 nieodpalona. `fresh-smoke.sh` jeszcze bez tego testu. V4 (zrzuty `docs/handover/odbior/P2/`) nie zaczęte.
- **Następny krok:** dokończyć V1–V3 na `pakiet/P2-wyglad` (lint CSS, brama E8 do 0/0/0, podpięcie w `fresh-smoke.sh`), potem V4 według Z10–Z11, migawki, scalenie i wdrożenie przed P3.
- GitHub Actions w toku: brak. Ostatnie zakończone: unit `main` run 38410368819 (zielony, `02de6300`); PR #171 unit 38409319769, unit 38409332585, visual 38409329474 (zielone).
- TEST wolne (od 13.10 15:20, po Q2).

## WZNOWIENIE 2026-10-13 17:10

- Gałąź `pakiet/P2-wyglad`, SHA `ec9e5fe4`, 0 niezapisanych zmian. Autor lokalny: Sebastian Bożek / sebastian.bozekq@gmail.com.
- Przebiegi z pauzy zielone, żaden nie został w toku: unit `main` 38410368819; PR #171 unit 38409319769, unit 38409332585, visual 38409329474.
- TEST wolne. Bramy TEST nie wznawiam. Dopiski 1535-01 i 1550-01 są na `main` (`02de6300`) — nie włączam ich drugi raz.
- Dalej: V1–V3 (lint CSS, brama E8, `fresh-smoke.sh`), potem V4.
- V1–V3 lokalnie, 13.10 17:20: `lint:css` zielony; brama E8 i test V1–V2: 2/2 (9 widoków × 360/390/430, trzy liczby = 0). V4: 30 zrzutów w `docs/handover/odbior/P2/`. Migawki stanów Harmonogramu odświeżone (run 38421964162, 8 plików). Checki PR #172: unit i visual zielone (visual run 38424836023).
- Wdrożenie z `main` `4627c8f5` według R7, 13.10.2026 17:56, `dpl_F55udKq2cMiUWyM1CXdY9Kh4sz8r`. Plik JS przed: `assets/index-h0t0ItfK.js`. Po: `assets/index-BwXKwh8r.js` — ta sama nazwa na `tower.log-mar.pl` i `watch-tower-makieta.vercel.app`. Oba adresy 200. 63 pliki JS: 0 × `service_role`. Kopia wdrożeniowa usunięta. Bez migracji.

**P2-wyglad NA PRODUKCJI — commit `4627c8f5`, wdrożenie `dpl_F55udKq2cMiUWyM1CXdY9Kh4sz8r`, 13.10.2026 17:56.** Następna paczka: P3.

## 2026-10-13 — D-20261013-1835-01 (FRONT-KOORDYNATOR) + start P3 (F5)

- Plan: merge **`59165fc2`** (PR #174) — rejestr `FRONT-KOORDYNATOR`, `AGENTS.md` §3/§4, `front.mdc`, PLAN §1 pkt 5, §3, §4 (Poprawki P2 — wygląd 2 na `wyglad/P2-2`, P3, P5 kolor marży), §8. D-20261013-1815-01 nie wykonywany (F4 — koordynator).
- Gałąź `pakiet/P3-uprawnienia` (PR #175). Bez zmian wyglądu ekranów (F5).
- Logika: E14 (rola z onChange), 5 ról, migracja `0196` (E9/E14/E19/G-20), Podgląd E9-7/G-07 (`isPreviewReadOnly`, strażnik `writeThrough`, `PreviewBanner`).
- `db.yml` money/invite zielone; security 86/88 → poprawka testów E19 (SELECT+RLS zamiast permission denied).
- TEST wolne.

## 2026-10-13 — Poprawki P2 — wygląd 2 (`wyglad/P2-2`)

- PR #176 scalony → `b9ae3d37` (13.10.2026 19:00 UTC). unit + visual zielone; gitleaks 0 (opis PR); `npm audit --omit=dev --audit-level=high` = 0; bez migracji (F8 OK).
- Wdrożenie R7 z `main` `b9ae3d37`, 13.10.2026 19:04, `dpl_2S9uAEnAqEdv2sgTCUQWC3gDqtaL`.
- Plik JS przed: `assets/index-BwXKwh8r.js`. Po: `assets/index-DjH-U2rD.js` — ta sama nazwa na `tower.log-mar.pl` i `watch-tower-makieta.vercel.app`. Oba adresy 200. 60 plików JS: 0 × `service_role`. Kopia wdrożeniowa usunięta. Bez migracji.

**Poprawki P2 — wygląd 2 NA PRODUKCJI — commit `b9ae3d37`, wdrożenie `dpl_2S9uAEnAqEdv2sgTCUQWC3gDqtaL`, 13.10.2026 19:04.** Następna: dokończenie P3 (po rebase na `main`).

## 2026-10-13 — P3 WIP (po rebase)

- PR #175: unit/visual/db (pełna brama) zielone; menu SCX bez `tasks` (E9); kafelek i linki → `risk`.
- Rebase na `main` po #177. TEST wolne. Bez wdrożenia P3 (jeszcze nie koniec paczki).

## 2026-10-13 — Poprawki P2 — wygląd 2-popr (`wyglad/P2-2-popr`)

- PR #177 scalony → `770960fd` (13.10.2026 ~19:45 UTC). unit + visual zielone; gitleaks 0 (opis PR); `npm audit --omit=dev --audit-level=high` = 0; bez migracji (F8 OK). F3 pkt 5 po niezależnym sprawdzeniu #176.
- Wdrożenie R7 z `main` `770960fd`, 13.10.2026 19:53, `dpl_ESWeHnmtc375vwNpyZMZsH7CSCCH`.
- Plik JS przed: `assets/index-DjH-U2rD.js`. Po: `assets/index-FTeLpkaa.js` — ta sama nazwa na `tower.log-mar.pl` i `watch-tower-makieta.vercel.app`. Oba adresy 200. 60 plików JS: 0 × `service_role`. Kopia wdrożeniowa usunięta. Bez migracji.

**Poprawki P2 — wygląd 2-popr NA PRODUKCJI — commit `770960fd`, wdrożenie `dpl_ESWeHnmtc375vwNpyZMZsH7CSCCH`, 13.10.2026 19:53.** Dalej P3 (logika/baza).

## 2026-10-13 — P3 E6 konta (logika/baza)

- Migracja **0197**: `first_name`/`last_name`, telefon E.164, `admin_user_profile_set`, zaproszenie z imieniem/nazwiskiem/telefonem, `my_profile` + pola, sync `full_name`, `handle_new_auth_user` jak 0046 (relink, bez `accepted_at`).
- UI (bez przebudowy wyglądu): Opcje › Moje konto, formularz zaproszenia i lista z „Zadzwoń”; nullguard **617**.
- TEST wolne. Bez wdrożenia P3 (paczka w toku).

## 2026-10-13 — P3 E12-A (logika)

- Migracja **0198**: `is_hhl_admin()`; zapisy Opcji (`rate_card_save`, SEFS/paliwo, bramka SMS) tylko Administrator HHL.
- Opcje UI: Operacje bez Użytkowników (admin), Logowań, Historii zmian; Moje konto / 2FA / urządzenia zostają.

## 2026-10-13 — P3 G-18 (matryca dat)

- Migracja **0199**: `matrix_notify` — IN_APP dla `PLAN_DATES_CHANGED` zawsze dla HHL_ADMIN, HHL_OPS, CARRIER_DISPATCH, CARRIER_USER; e-mail/push wg macierzy.

## 2026-10-13 — P3 E5-1

- Migracja **0200**: `notification_matrix.email = false` wszędzie (start E5-1).

## 2026-10-13 — P3 E13 → koordynator

- CSS E13 wycofany z gałęzi logiki (F1/F5). Dopisek **D-20261013-2130-01** do `wyglad/P3`.

## 2026-10-13 — P3 E11 macierz 5 ról

- Migracja **0201**: `notification_matrix` po `role` (5 rodzajów); archiwum `notification_matrix_org_kind`; RPC `p_role` (DROP przed CREATE — Postgres nie zmienia nazwy argumentu); UI kolumny ról.

## 2026-10-13 — P3 E5-2 + E19-4 (logika/baza)

- Migracja **0202**: kolumna `notification_matrix.push` (telefon); start RISK_FERRY_WEATHER + DECISION; `matrix_notify` WEB_PUSH wg `push`.
- Migracja **0203**: `security_advisor_snapshots`, cron `tower-security-advisor`, RPC odczytu dla HHL_ADMIN; Edge `security-advisor-snapshot`.
- `tests/db/advisor-exceptions.txt` + `scripts/security-advisor-check.mjs` (E19 pkt 6).
- nullguard **622** (+ `security_advisor_snapshot_latest`).
- Bez CSS; dopisek D-20261013-2130-01 do `wyglad/P3`.


## 2026-10-13 — P3 TEST przed scaleniem

- TEST zajęte: P3 (security, status, nullguard, dec3) na `14663cad`.

## 2026-10-13 — P3 logika/baza NA PRODUKCJI

- Scalenie PR #175 → `d3cbe4d8`; poprawka idempotentności 0201 PR #179 → `567fcc5a`.
- Migracje **0196–0203** na produkcji (`db push` ×2: drugi „up to date”). Próba ROLLBACK ×2 OK (snap_ok, 25 ról macierzy, 10 push).
- Edge `security-advisor-snapshot` wdrożona (prod).
- TEST przed scaleniem: security 84/84, status 44/44, nullguard 161+136+204+121, dec3 13/13; doradca security 0 nowych (po wyjątkach).
- CI: unit/visual/db zielone na SHA paczki.
- Wdrożenie R7 z `main` `567fcc5a`, 13.10.2026 23:32, `dpl_9tAM8dDaeXZ2awdpHD6RCNwdkLPP`.
- Plik JS: `assets/index-_PKBum7P.js` na `tower.log-mar.pl` i `watch-tower-makieta.vercel.app` (oba 200). 9 plików JS z HTML: 0 × `service_role`. Kopia wdrożeniowa usunięta.
- TEST wolne.
- Wygląd P3 (Z4/Z11, V5, E13 CSS): koordynator na `wyglad/P3` (dopisek D-20261013-2130-01).

**P3 (logika/baza) NA PRODUKCJI — commit `567fcc5a`, migracje 0196–0203, wdrożenie `dpl_9tAM8dDaeXZ2awdpHD6RCNwdkLPP`, 13.10.2026 23:32.** Następna: P4 (logika); wygląd P3 osobno.

## 2026-10-14 — wyglad/P3-a (pasek E37 + E13) — NA PRODUKCJI

- Dopisek `D-20261013-2255-01` w `docs/handover/dopiski/` (G1–G5).
- Przed scaleniem: `unit` i `visual` zielone na `981c93d`; gitleaks 0 na zakresie PR; `npm audit --omit=dev --audit-level=high` 0.
- Scalenie PR #178 (`wyglad/P3`) → merge `25b71bca` (14.10.2026 00:10). Bez migracji.
- Wdrożenie R7 z `main` `25b71bca`, 14.10.2026 00:12, `dpl_FBYjeG86cptLjWvXiRmURHH5kKkt`.
- Plik JS przed: `assets/index-_PKBum7P.js`. Po: `assets/index-lVQ_YtiK.js` — ta sama nazwa na `tower.log-mar.pl`, `watch-tower-makieta.vercel.app` i w `dist/` buildu. Oba adresy 200. 64 pliki JS: 0 × `service_role`. Kopia wdrożeniowa usunięta.
- G3 (uchwyty): `#themeBtn` w menu konta; `[data-auth="session"]` na `#accountBtn`; `.nav-session` usunięte; `#roleSeg` bez zmian (napisy HHL/KSH/SCX, „Podgląd”).
- G4 (podłączenie, bez zmiany wyglądu): `last_sign_in_at` z sesji Auth w `AuthGate`; typ `real_full_name` + `ImpersonationBanner` (fallback `real_email`); migracja `my_profile` (`last_sign_in_at` z `auth.users` dla eff, `real_full_name`) — przy rebase P4 (numer wolny); G4.2 „Moje konto” KSH/SCX — po P3-c. PR #182 → `2d467649`; wdrożenie G4 R7 14.10.2026 00:29, `dpl_GVhiKpCETFTpzECiS8QwsRRaKGxo`; JS `assets/index-CCGb6sOq.js` (oba adresy 200, 0 × `service_role`).
- PLAN §4 P3: P3-a / P3-b / P3-c; §8 wiersz dopisku.

**wyglad/P3-a NA PRODUKCJI — commit `25b71bca`, wdrożenie `dpl_FBYjeG86cptLjWvXiRmURHH5kKkt`, 14.10.2026 00:12.** G4 na produkcji: commit `2d467649`, `dpl_GVhiKpCETFTpzECiS8QwsRRaKGxo`, 14.10.2026 00:29.

## 2026-10-14 — Poprawki P3: TEST przed scaleniem

- TEST zajęte: P3-poprawki (security, status, nullguard, g20) na `97c02d59` / potwierdzenie `10d21b5b`.
- Wynik TEST: security 84/84, status 44/44, nullguard 622, g20 15/15.
- Doradca security TEST: 0 nowych (po wyjątkach). Doradca prod (odczyt): ostrzeżenie `auth_leaked_password_protection` — W1 (właściciel włącza w panelu).
- **STOP §1 pkt 12.2 / W34:** GitHub Actions nie startuje jobów (płatność / limit wydatków konta). Checki na `10d21b5b` fail 2–3 s, 0 kroków; adnotacja: „recent account payments have failed or your spending limit needs to be increased”. Wcześniejsze checki na `97c02d59` były zielone.
- PR #184 gotowy do scalenia po W34 (unit/visual/db na głowie). Migracja **0204** w gałęzi; wdrożenie i `db push` po zielonych checkach.
- TEST wolne.

**CZEKA NA WŁAŚCICIELA: W34 — GitHub Actions billing / spending limit.** Po „W34 gotowe” — checki, merge #184, migracja 0204, Edge `web-push-send`, sygnał P3-poprawki NA PRODUKCJI. Wracam do P4 (bez wdrożenia migracji P4 do po Poprawkach P3).

## 2026-10-14 — W34 dostarczone; Poprawki P3 — ponowienie bram

- W34 dostarczone 14.10.2026, 01:55 (właściciel: GitHub Actions działa).
- Ponowienie checków PR #184 na głowie; TEST z `10d21b5b` nadal ważny (późniejsze commity tylko `docs/**`).

## 2026-10-14 — Poprawki P3 NA PRODUKCJI

- CI na `dcb2d28e`: unit, visual, db zielone; gitleaks 0 (zakres PR); `npm audit --omit=dev --audit-level=high` 0.
- Scalenie PR #184 → `38711bd7`.
- Próba ROLLBACK 0204 na produkcji: mig_ok, DECISION×CLIENT_USER push=false, import_schedule z import_ctx; ROLLBACK.
- `db push` 0204; drugi raz „up to date”; parytet MATCH YES (0001…0204).
- Edge `web-push-send` wdrożona (prod).
- Doradca security prod (odczyt): ostrzeżenie `auth_leaked_password_protection` — W1 (panel właściciela).
- Wdrożenie R7 z `main` `38711bd7`, 14.10.2026 02:40, `dpl_DHp28HQMcy6D5PHZmMWCcvRcqKUF`.
- Plik JS: `assets/index-CCGb6sOq.js` (bez zmian w `src/` aplikacji — tylko baza/Edge); oba adresy 200; 0 × `service_role`. Kopia wdrożeniowa usunięta.

**P3-poprawki NA PRODUKCJI — commit `38711bd7`, migracja 0204, wdrożenie `dpl_DHp28HQMcy6D5PHZmMWCcvRcqKUF`, 14.10.2026 02:40.**

## 2026-10-14 — wyglad/P3-b NA PRODUKCJI

- Dopisek D-20261014-0215-01 włączony (PR #186).
- CI na `2eca59f`: unit i visual zielone; gitleaks 0; `npm audit --omit=dev --audit-level=high` 0.
- Scalenie PR #185 → `50b23eb0` (po #186). Bez migracji.
- Wdrożenie R7 z `main` `50b23eb0`, 14.10.2026 02:53, `dpl_Go31sqkke7v66cur6AxKfkuDwDWj`.
- Plik JS przed: `assets/index-CCGb6sOq.js`. Po: `assets/index-aVxTzmYJ.js` — ta sama nazwa na `tower.log-mar.pl` i w logu buildu Vercel. Oba adresy 200. 0 × `service_role`. Kopia wdrożeniowa usunięta.

**wyglad/P3-b NA PRODUKCJI — commit `50b23eb0`, wdrożenie `dpl_Go31sqkke7v66cur6AxKfkuDwDWj`, 14.10.2026 02:53.**

## 2026-10-14 — wyglad/P4-a NA PRODUKCJI

- Dopisek D-20261014-0315-01 włączony w gałęzi P4 (H5).
- CI PR #188: unit i visual zielone; gitleaks 0; `npm audit --omit=dev --audit-level=high` 0. Bez migracji.
- Scalenie PR #188 → `cb140085`.
- Wdrożenie R7 z `main` `cb140085`, 14.10.2026 04:54, `dpl_DYK297WxbcnC9y5CXTQMXN7CvzWg`.
- Plik JS przed: `assets/index-aVxTzmYJ.js`. Po: `assets/index-CJKv76X6.js`. Oba adresy 200.

**wyglad/P4-a NA PRODUKCJI — commit `cb140085`, wdrożenie `dpl_DYK297WxbcnC9y5CXTQMXN7CvzWg`, 14.10.2026 04:54.**

## 2026-10-14 — wyglad/P3-c NA PRODUKCJI

- Dopisek D-20261014-0700-01 (w PR #190; włączenie do planu w `pakiet/P3-c-konto`).
- CI na `70756d9`: unit i visual zielone; gitleaks = znana atrapa `H3_CORRIDOR_OBSTACLES` w `demo.tsx` (jak 0154; odcisk w `.gitleaksignore` w commicie włączającym); `npm audit --omit=dev --audit-level=high` 0. Bez migracji.
- Scalenie PR #190 → `980c5a6f`.
- Wdrożenie R7 z `main` `980c5a6f`, 14.10.2026 11:33, `dpl_88oQ2pwsRC1aavsiSmFmcMzwUPKe`.
- Plik JS przed: `assets/index-CJKv76X6.js`. Po: `assets/index-gD-kQcbR.js` — ta sama nazwa na `tower.log-mar.pl` i `watch-tower-makieta.vercel.app`. Oba adresy 200. 0 × `service_role` (9 plików JS z HTML). Kopia wdrożeniowa usunięta.

**wyglad/P3-c NA PRODUKCJI — commit `980c5a6f`, wdrożenie `dpl_88oQ2pwsRC1aavsiSmFmcMzwUPKe`, 14.10.2026 11:33.**


## 2026-10-14 — P3-c J3 pkt 1 (Moje konto) NA PRODUKCJI

- Włączenie D-20261014-0700-01: PLAN §4 P3 (P3-c NA PRODUKCJI, J3, J4), P8 (J3 pkt 12), §8.
- `LiveAccountScreen`: `AccountScreen` ← `my_profile` / `admin_user_profile_set`, `MfaSetup`, `my_sessions`; Podgląd = bez zapisów RPC (`isPreviewReadOnly`).
- Opcje HHL i Ustawienia KSH/SCX: zamiast MyAccount+Mfa+MyDevices / „Brak źródła danych.”
- J5: testy lokalne `iii9`/`i2`/`i19`/`i3`/`i27` → `[data-opt-nav]`; `i5-mfa` pod LiveAccount.
- `.gitleaksignore`: atrapa `H3_CORRIDOR_OBSTACLES` w `demo.tsx`.
- Scalenie PR #191 → `fdfb0caa`. unit + visual zielone; gitleaks 0; audit 0. Bez migracji.
- Wdrożenie R7 z `main` `fdfb0caa`, 14.10.2026 11:57, `dpl_sd7RM5S4cfWemmi7zjpF8uPKip45`.
- Plik JS przed: `assets/index-gD-kQcbR.js`. Po: `assets/index-TI93uCIy.js`. Oba adresy 200. 0 × `service_role`.

**P3-c J3.1 (Moje konto) NA PRODUKCJI — commit `fdfb0caa`, wdrożenie `dpl_sd7RM5S4cfWemmi7zjpF8uPKip45`, 14.10.2026 11:57.**


## 2026-10-14 — P4 H1/H2 (D-20261014-0640-01) — TEST

- **TEST zajęte: P4**, od 14.10.2026 12:35 — potwierdzenie security, status, nullguard, e25 na `cf4b673d` (PR #181).
- TEST: security **84/84** (+2 SKIP), status **44/44**, e25 **21/21**, nullguard **161+136+208+122 = 627/627**; doradca security TEST: 0 nowych (po wyjątku `load_status_set` / `load_status_rank`).
- CI PR #181 na `cf4b673d`: unit, visual, db zielone; gitleaks 0 (zakres vs main); `npm audit --omit=dev --audit-level=high` 0.
- **TEST wolne** od 14.10.2026 13:25.

## 2026-10-14 — P4 H1/H2 (logika/baza E25) NA PRODUKCJI

- Dopisek D-20261014-0640-01 włączony (H1/H2 w PR #181; H3/H4 zostają w P4).
- Scalenie PR #181 → `3dd72256`. Migracja **0205** (`db push` ×2: drugi „up to date”); próba ROLLBACK: chk_ok=1, fn_ok=1, enum_ok=2.
- TEST przed scaleniem (`cf4b673d` / head z wyjątkami doradcy): security 84, status 44, e25 21/21, nullguard 627, doradca 0 nowych.
- Wdrożenie R7 z `main` `3dd72256`, 14.10.2026 13:43, `dpl_AffqVNywWVnTJTtTYxVnNs1xjKmD`.
- Plik JS: `assets/index-B9wDrCrF.js`. Oba adresy 200. 0 × `service_role`.
- PR #189 (`wyglad/P4-b`) — draft; scalenie po oznaczeniu gotowości przez koordynatora.

**P4 H1/H2 (E25 statusy) NA PRODUKCJI — commit `3dd72256`, migracja 0205, wdrożenie `dpl_AffqVNywWVnTJTtTYxVnNs1xjKmD`, 14.10.2026 13:43.**

## 2026-10-14 — P3-c poprawka (D-20261014-1420-01 R1–R2/R4–R5/R7) NA PRODUKCJI

- R1: `accountMfaEnabled` — 2FA UI tylko przy verified TOTP (bez `satisfied`).
- R2: `MyMfa` pod AccountScreen przy ≥1 TOTP (nie Podgląd).
- R4: `auth_pw_changed` = „Hasło zmienione.”
- R5: i5-mfa **13/13** (w tym 2× R1); i2-facade I-5+I-17 przywrócone (przebieg na żywo — po R3 / TEST).
- R7: PLAN P3-d po P4; J4 = Kokpit.
- Scalenie PR #195 → `50d4fc3e`. Bez migracji.
- Wdrożenie R7 z `main` `50d4fc3e`, 14.10.2026 14:45, `dpl_54y7p76dguMDSCjfNwApqGkfaFDB`.
- Plik JS: `assets/index-CdyCUXOf.js`. Oba adresy 200. 0 × `service_role`.

**P3-c poprawka NA PRODUKCJI — commit `50d4fc3e`, 14.10.2026 14:45.**

## 2026-10-14 — P3-c-sesja (D-20261014-1420-01 R3) — TEST + NA PRODUKCJI

- **TEST zajęte: P3-c-sesja**, od 14.10.2026 ~15:02 — security, nullguard, doradca (session w CI `db`).
- TEST na `c7e8a368` / migracja **0206**: security **84/84** (+2 SKIP), nullguard **161+136+212+123 = 632/632**; doradca security TEST: **0 nowych** (wyjątek `my_session_revoke`).
- CI PR #197 na `c7e8a368`: unit, visual, db zielone; gitleaks 0 (zakres vs main); `npm audit --omit=dev --audit-level=high` 0.
- **TEST wolne** od 14.10.2026 15:40.
- Scalenie PR #197 → `12b72b00`.
- Próba ROLLBACK 0206 na produkcji: fn_ok=1, definer_ok=1, grant_auth=1, no_anon=1; ROLLBACK.
- `db push` 0206; drugi raz „up to date”; 206 migracji; `my_session_revoke` na produkcji.
- Wdrożenie R7 z `main` `12b72b00`, 14.10.2026 15:43, `dpl_3BeJ9Y55vxh15noTNpevBabdV7aT`.
- Plik JS: `assets/index-DqC_epNn.js` (chunk `LiveAccountScreen-*.js` z `my_session_revoke`). Oba adresy 200. 0 × `service_role` (9 plików JS z HTML + crawl). Kopia wdrożeniowa usunięta.

**P3-c-sesja NA PRODUKCJI — commit `12b72b00`, migracja 0206, wdrożenie `dpl_3BeJ9Y55vxh15noTNpevBabdV7aT`, 14.10.2026 15:43.**

## 2026-10-14 — wyglad/P4-b NA PRODUKCJI

- Dopisek D-20261014-1320-01 włączony (PR #199 → `5ba9d5ca`): PLAN §4 P4 Ekrany P4-a/b/c, K2, P6 E7 `DeliveredCheckCard`; odwołania do D-20261014-1145-01 w 1420-01 → K1.
- Sygnał koordynatora 14.10.2026 14:49: „#189 GOTOWE DO SCALENIA” (głowa `832fe9a`, 4 commity P4-b po przeniesieniu na main po #181).
- Scalenie PR #189 → `c7dd55aa`. unit + visual zielone; gitleaks 0 (4 commity); `npm audit --omit=dev --audit-level=high` 0. Bez migracji.
- Wdrożenie R7 z `main` `c7dd55aa`, 14.10.2026 17:19, `dpl_AvsXQY2ZyiUDJuc3wpttzzgKQusq`.
- Plik JS: `assets/index-o__amAGp.js` (oba adresy 200). 0 × `service_role` (9 plików JS z HTML). Kopia wdrożeniowa usunięta.
- PR #193 (`wyglad/P4-c`) — draft; scalenie po sygnale „#193 GOTOWE DO SCALENIA”.

**wyglad/P4-b NA PRODUKCJI — commit `c7dd55aa`, wdrożenie `dpl_AvsXQY2ZyiUDJuc3wpttzzgKQusq`, 14.10.2026 17:19.**

## 2026-10-14 — wyglad/P4-c NA PRODUKCJI

- Sygnał właściciela 14.10.2026 ~18:13: scalić #193 i wdrożyć; dane K2 według D-20261014-1320-01.
- Scalenie PR #193 → `bb55884f` (głowa po przeniesieniu na main: `938760a`). unit + visual zielone; gitleaks 0; `npm audit --omit=dev --audit-level=high` 0. Bez migracji.
- Wdrożenie R7 z `main` `bb55884f`, 14.10.2026 18:17, `dpl_6EEFjRMh516nGexue6GZPyv8sEeK`.
- Plik JS: `assets/index-CS7-22Du.js` (oba adresy 200). 0 × `service_role` (JS z HTML). Kopia wdrożeniowa usunięta.
- Dalej: K2 (dane P4-c) + H3/H4 (0640) + R6 (1420) w paczce P4.

**wyglad/P4-c NA PRODUKCJI — commit `bb55884f`, wdrożenie `dpl_6EEFjRMh516nGexue6GZPyv8sEeK`, 14.10.2026 18:17.**

## 2026-10-14 — wyglad/P5 NA PRODUKCJI

- Dopisek D-20261014-2005-01 w `docs/handover/dopiski/`; PLAN §4 P5 Ekrany (S1–S5) + §8.
- Scalenie PR #201 → `6631eb8a` (głowa `5e3dc21`). unit + visual zielone; gitleaks 0; `npm audit --omit=dev --audit-level=high` 0. Bez migracji (bez `db` / TEST).
- Wdrożenie R7 z `main` `6631eb8a`, 14.10.2026 20:49, `dpl_6BupPHfhnDTw2sBdpgEpJqVZ9v5x`.
- Plik JS: `assets/index-LoAtWpmu.js` (oba adresy 200). 0 × `service_role` (25 plików JS z HTML). Kopia wdrożeniowa usunięta.
- Dane pod wygląd: w P5 według PLAN §4 P5 i D-20261014-2005-01 S1–S5 (`p5Source.ts`).

**wyglad/P5 NA PRODUKCJI — commit `6631eb8a`, wdrożenie `dpl_6BupPHfhnDTw2sBdpgEpJqVZ9v5x`, 14.10.2026 20:49.**

## 2026-10-14 — wyglad/P6-a NA PRODUKCJI

- Dopisek D-20261014-2145-01 w `docs/handover/dopiski/`; PLAN §4 P6 Ekrany (T1–T6) + §8.
- Scalenie PR #205 → `49d05641` (głowa `93b83cb`). unit + visual zielone; gitleaks 0; `npm audit --omit=dev --audit-level=high` 0. Bez migracji (bez `db` / TEST).
- Wdrożenie R7 z `main` `49d05641`, 14.10.2026 22:07, `dpl_9PFrMuYyTVXRymWBp63t2vGZapnc`.
- Plik JS: `assets/index-C4kdLq0M.js` (oba adresy 200). 0 × `service_role` (25 plików JS z HTML). Kopia wdrożeniowa usunięta.
- Dane pod wygląd: w P6 według PLAN §4 P6 i D-20261014-2145-01 T1–T6 (`p6Source.ts`).

**wyglad/P6-a NA PRODUKCJI — commit `49d05641`, wdrożenie `dpl_9PFrMuYyTVXRymWBp63t2vGZapnc`, 14.10.2026 22:07.**

## 2026-10-15 — wyglad/P6-b NA PRODUKCJI

- Dopisek D-20261014-2300-01 w `docs/handover/dopiski/`; PLAN §4 P6 Ekrany (H1–H4 / `p6bSource.ts` razem z E17) + Odbiór + §8 (PR #208).
- Scalenie PR #207 → `adeda6e7` (głowa `35489c22`). unit + visual zielone; gitleaks 0; `npm audit --omit=dev --audit-level=high` 0. Bez migracji (bez `db` / TEST).
- Wdrożenie R7 z `main` `adeda6e7`, 15.10.2026 00:14, `dpl_DQ5qsdYwuib3m5sXHLSGWMC3FZoy`.
- Plik JS: `assets/index-tzPPF_z_.js` (oba adresy 200). 0 × `service_role` (27 plików JS z HTML). Kopia wdrożeniowa usunięta.
- Dane pod wygląd: w P6 razem z E17 według PLAN §4 P6 i D-20261014-2300-01 H1–H4 (`p6bSource.ts`).
- Konflikt / nakładanie z gałęzią `pakiet/P4-k2-h3-r6` (PR #203): **nie rozwiązywałem** (D-20261014-2300-01); #207 weszło na `main` merge’em; rebase P4 na nowy `main` — poza tą paczką (koordynator przenosi wygląd na main).

**wyglad/P6-b NA PRODUKCJI — commit `adeda6e7`, wdrożenie `dpl_DQ5qsdYwuib3m5sXHLSGWMC3FZoy`, 15.10.2026 00:14.**

## 2026-10-15 — Poprawki audyt A (D-20261015-0300-01 / D-0330) NA PRODUKCJI

- Dopiski: D-20261015-0300-01 (A1–A6), D-20261015-0330-01 (A2 widoczność, W35–W40), D-20261015-0400-01 (P6 E2 po C1) — włączane w PR dokumentów.
- PR #212 → `fa840b51` (migracje 0207–0213 + testy); PR #215 → `034a993d` (fix 0207 alias `fr`, 0211 wyłącza append-only przy korekcie SG-03).
- TEST (przed wdrożeniem): security **84**, status **44**, e41 **36**, e25 **26**, nullguard **161+136+212+123**; CI `db` / `unit` / `visual` zielone na #215.
- Kopia przed produkcją: `D:\Watch Tower\dane\audyt-A\kopia-audyt-a-2026-10-15T03-50-07-263Z.json`, SHA256 `3dfc8a23e04678bda846e15439052b2d0e8c3ad8ce46591048e052ec83ad32d7`.
- Produkcja: ROLLBACK OK → `supabase db push` (pooler) 0207–0213; weryfikacja: Orlen w `fuel_index_readings`, SG-03 DELIVERED `2026-10-07 12:19:54` Europe/Warsaw, `has_column_privilege(authenticated, loads.order_*)` = false.
- W39 SELECT (po A): `notification_matrix` `LOAD_STATUS × HHL_ADMIN` = `in_app=true, email=false, push=false` (już cofnięte).
- Wdrożenie aplikacji z `main` `034a993d`: `dpl_HPasjkw4nWBTeY5w2AVF93dLW8eN`, JS `assets/index-BmAE31XS.js`, oba adresy 200, 0 × `service_role` (27 plików JS).
- PR #210 (raport Zmiany 11.10/15.10) scalony → `6c8971a3` przed PR dokumentów.
- Czas plan ~5 h A; poprawki migracji/testów (#215) wliczone.

**POPRAWKI-AUDYT-A NA PRODUKCJI — commit `034a993d`, migracje 0207–0213, wdrożenie `dpl_HPasjkw4nWBTeY5w2AVF93dLW8eN`, 15.10.2026 06:11.**

**CZEKA NA WŁAŚCICIELA: W37 — emtrack: nowe dane logowania od SCX (sekrety `EMTRACK_LOGIN` / `EMTRACK_PASSWORD`).**

## 2026-10-15 — P4 / PR #203 — B (D-0300) NA PRODUKCJI

- Gałąź `pakiet/P4-k2-h3-r6` → merge #203 `ea10b1bc`; hotfix #219 `readyGaps` → `3c676d96`.
- Wygląd #213 → #214 → #217 wcześniej; P4 logika: `dpl_Dvv2rR9aHYN4nVSv6QZAskxBGf5b` (15.10 ~15:39).
- **B1–B11:** deliveredCheck; Kokpit morze/`READY_TO_INVOICE`/siteSince; tracker_on STATUS_AUTO; readyGaps piloci z `permit.plPilotsRequired` + usedBy/POLICY_SCX; RIO URL wklejony; progi E15 w `ops_thresholds` (SILENT_MIN=30); `SE_APPROACH_SG03`; stan śledzenia PDF; anulowanie HHL_ADMIN + CANCELLED dla HHL; `telm_infer` bez FERRY; kotwica czasu i2.sh.
- **H3.6:** terminowość = dzień rozładunku ≤ dzień dostawy z planu; marża = suma marży / suma przychodu.
- **TEST (przed wdrożeniem, SHA przed hotfixem):** security **84/84** (+2 SKIP), status **44/44**, nullguard **161+136+216+124 = 637/637**, dec6 **21/21** (+4 SKIP), risks **21/21** (+2 SKIP), e25 **26/26**, dec-auto **64/64**; doradca security TEST: **4** zgłoszenia, **0 nowych** (parser CLI `results` — `security-advisor-check.mjs`).
- **B12 produkcja:** doradca security po 0214–0216: **5** zgłoszeń, **0 nowych**; Edge `security-advisor-snapshot` + `backup-export` wdrożone; `advisor_ok=false` → `integration_runs.ok=false` / „Brak pomiaru”.
- **B13:** unit `i5-mfa` **13/13** (CI unit zielony); `i2-facade.local` I-5/I-17 w tej sesji nie uruchamiano (Windows bez lokalnego Supabase) — wpisy I-5/I-17 DONE historycznie w POSTEP; uzupełnienie facade na TEST przy bramie niedzielnej.
- **B14 czasy (orientacyjnie z godzin commitów / POSTEP):** P1 ~8 h plan + poprawki e18/auth; P2 ~6 h; P3 ~10 h (+ Poprawki P3 / W34); Poprawki P3 (0015) ~4 h do STOP W34; P4 (B, wznowienie 12:33→15:40) ~3 h plan + ~1 h poprawki (TDZ DashboardView, readyGaps TS, doradca CLI).
- CI merge #203 / #219: unit + visual + db zielone; `npm audit --omit=dev --audit-level=high` 0.
- Produkcja: ROLLBACK OK → `db push` 0214–0216; JS `assets/index-0TxiZS0x.js`; tower / makieta **200**; 0 × `service_role` w index.
- Dowód wyglądu P4-a (wstecz, Q3): wcześniej `cb140085` / `dpl_DYK297…` — index z wdrożenia = produkcja, 0 × `service_role` (POSTEP 14.10).

**P4 NA PRODUKCJI — commit `3c676d96`, migracje 0214–0216, wdrożenie `dpl_Dvv2rR9aHYN4nVSv6QZAskxBGf5b`, 15.10.2026 15:39.**

## 2026-10-15 — wyglad/A5 (PR #218) NA PRODUKCJI

- Scalenie PR #218 → `12e3efd7` (okno „Zmień status”: CMR / faktury, E25). unit + visual zielone; bez migracji.
- Wdrożenie z `main` `12e3efd7`: `dpl_4ndnWfvyNcHWgfEdHP3qC9Na3zYY`, JS `assets/index-DvW5-7T4.js`.
- tower.log-mar.pl i watch-tower-makieta.vercel.app **200**; 0 × `service_role`.

**wyglad/A5 NA PRODUKCJI — commit `12e3efd7`, wdrożenie `dpl_4ndnWfvyNcHWgfEdHP3qC9Na3zYY`, 15.10.2026 17:30.**

## 2026-10-15 — Poprawki P2–P3 (PR #221) — TEST

- **TEST zajęte: Poprawki P2–P3**, od 15.10.2026 17:30 — potwierdzenie security, status, nullguard, risks na `e39ccb47`/`4fc44255` (migracje 0217–0218).
- TEST: security **84/84** (+2 SKIP), status **44/44**, risks **25/25** (+2 SKIP), nullguard **161+136+216+124 = 637/637**. Doradca TEST: **149** zgłoszeń, **0 nowych**.
- CI `db` / `unit` / `visual` zielone na `4fc44255` (session 33, risks 27, l13 34).
- **TEST wolne** od 15.10.2026 18:25.

## 2026-10-15 — Poprawki P2–P3: C1 / C12 / C14 NA PRODUKCJI (paczka W TOKU → C2…)

- Merge PR #221 → `2a315a4d` (0217 C1 dzwonek, 0218 session/l13, C12 DOC_MISSING, C14 ADVISOR_MGMT_TOKEN).
- Kopia przed C1: `D:\Watch Tower\dane\poprawki-p2-p3-c1\kopia-c1-bell-2026-10-15T16-27-50-905Z.json`, n=**6872**, SHA256 `50e5f2521a01675cc3962907110a1f698585268fab43e401bbf1169547bd11d4`.
- Produkcja: ROLLBACK OK → `db push` 0217–0218; po: `unread RISK_* bez load_id` = **0**; `truck_ban_holidays` = `current_app_role() IS NOT NULL`; audit `C1_BELL_MARK_READ_NO_LOAD`.
- Edge `security-advisor-snapshot` wdrożona (C14). Doradca produkcja: ostrzeżenie `auth_leaked_password_protection` (W1 — włączenie w panelu Auth; nie z migracji).
- Wdrożenie aplikacji: `dpl_BVVAGR5vymg7EXbMjVEj6jrSYZV2`, JS `assets/index-DwXAzakW.js`; tower / makieta **200**; 0 × `service_role`.
- PR #218 wyglad/A5 wcześniej: `12e3efd7` / `dpl_4ndnWfvyNcHWgfEdHP3qC9Na3zYY`.
- Następne w paczce: **C2** (pushDevicesOf / sw.js / web-push-send).

**C1+C12+C14 NA PRODUKCJI — commit `2a315a4d`, migracje 0217–0218, wdrożenie `dpl_BVVAGR5vymg7EXbMjVEj6jrSYZV2`, 15.10.2026 18:30.** (paczka Poprawki P2–P3 nadal W TOKU — C2–C15, C11/C13 wygląd)

## 2026-10-15 — Poprawki P2–P3: C2 NA PRODUKCJI

- Merge PR #223 → `e49285c5`. Bez migracji. unit + visual + db zielone; `npm audit` 0.
- Edge: `web-push-test`, `web-push-send` (cel z payload).
- Aplikacja: `dpl_BGubwMaao7NTm9wauFLPcShYkTQr`; tower / makieta **200**.
- Odbiór C2 na Androidzie (≤ 10 s) → potem W24.

**C2 NA PRODUKCJI — commit `e49285c5`, wdrożenie `dpl_BGubwMaao7NTm9wauFLPcShYkTQr`, 15.10.2026 ~19:00.** Następne: C3–C15.

## 2026-10-15 — C16-N1 NA PRODUKCJI (BLOKER C2 / D-20261015-1955-01)

- Przyczyna: przycisk testu → tylko `OPTIONS … web-push-test → 405` (brak CORS), zero POST.
- PR #227 → `2b9c3679` (`d3fde479`): CORS, `{ ok, status, reason, sent_at }`, `urgency: high`, `TTL: 60`, kod z `e.statusCode`.
- PR #226 → `0f5075ef` (wyglad/push-telefon): ekran „Sprawdź ten telefon”, powód porażki, badge-96; dopisek D-20261015-1955-01.
- Edge `web-push-test` wdrożona (prod) ~20:37; aplikacja `dpl_GQnkaNkuBj4TeXNrg8y1br8vCDvj` ~20:40; JS `assets/index-CUhhGQCv.js`; tower / makieta **200**; 0 × `service_role` (20 plików JS).
- unit: `push-fail-reason` 2/2 (+ HMAC w N2); CI unit/visual/db #227 zielone; `npm audit` 0.
- PLAN: C16 przed C3; W42 = e-mail; W43 iPhone; W24 czeka do odbioru C16 na S24.
- Czas plan ~0,5 h N1; poprawki: 0.
- **Następne:** C16 N2–N8 (send/ack/fallback/sw/sync/migracja 0219).

**C16-N1 NA PRODUKCJI — 20:37 (funkcja) / 20:40 (aplikacja), właściciel może testować S24.** commit `0f5075ef`, wdrożenie `dpl_GQnkaNkuBj4TeXNrg8y1br8vCDvj`.

- **W24 (Android S24) dostarczone 15.10.2026, 20:50** — właściciel: powiadomienie odebrane w telefonie (N1; pełny odbiór C16 po N3 z `delivered_at` / „Doszło na urządzenie”). iPhone = W43.

## 2026-10-15 — C16 N2–N8 TEST

- **TEST zajęte: C16 N2–N8**, od 15.10.2026 21:16 — security, status, nullguard, c16-push, risks na `a82ccc9e` (PR #229, migracja 0219).

### C16 N2–N8 — TEST (0219) przed poprawkami przeglądu

| zestaw | wynik |
|---|---|
| prep | ok |
| security | 84/84 (+2 SKIP) |
| status | 44/44 |
| c16-push | 10/10 |
| risks | 25/25 (+2 SKIP) |
| nullguard | 161+136+216+124 = 637/637 |

SHA TEST: `b5e65f4c`. Potem poprawki przeglądu (sw click/openWindow, HMAC `nid\|sid`, `verify_jwt=false`) → `ee689452`.

### C16 N2–N8 — TEST na `ee689452` (przed scaleniem #229)

| zestaw | wynik |
|---|---|
| prep | ok |
| security | 84/84 (+2 SKIP) |
| status | 44/44 |
| c16-push | 10/10 |
| nullguard | 161+136+216+124 = 637/637 |
| doradca security TEST | 167 zgłoszeń, **0 nowych** |

CI #229 na `ee689452`: unit / visual / `db` zielone; `npm audit --omit=dev --audit-level=high` 0.
**TEST wolne** od 15.10.2026 23:32.

| punkt | zrobione / odbiór |
|---|---|
| C16 N2–N8 TEST | zrobione 23:32 — security 84, status 44, c16-push 10, nullguard 637, doradca 0 nowych; commit `ee689452` |

## 2026-10-15 — C16 N2–N8 NA PRODUKCJI (D-20261015-1955-01)

- Merge PR #229 → `456a7a14` (merge commit); głowa treści `94dc8ae7` / poprawki `ee689452`.
- Migracja **0219**: ROLLBACK OK → `db push` (drugi: up to date); `schema_migrations` …0219.
- Edge: `web-push-send`, `web-push-test`; `web-push-ack` / `web-push-resub` z `verify_jwt=false` (lista funkcji potwierdzona); OPTIONS → **200** + CORS (`Access-Control-Allow-Origin: https://tower.log-mar.pl`).
- Aplikacja: `dpl_7ngsrbV8JXwDHvDCEBRjdWVS2dLw`, JS `assets/index-s00c_A3-.js`, `sw.js` z openWindow po błędzie navigate; tower / makieta **200**; 0 × `service_role` (19 plików JS).
- CI #229: unit / visual / `db` zielone; `npm audit` 0; TEST: security 84, status 44, c16-push 10, nullguard 637, doradca 0 nowych.
- Czas plan N2–N8 ~3 h; poprawki przeglądu (N5 openWindow, JWT off, HMAC nid\|sid) wliczone.
- **Odbiór C16 (pkt 1–7) — czeka na właściciela:** ponowny test S24 z potwierdzeniem „Doszło na urządzenie…” ≤ 10 s; zablokowany ekran; klik → cel; Samsung Internet + komputer; wypięcie → 410 → e-mail W42. iPhone = W43.

| punkt | zrobione / odbiór |
|---|---|
| C16 N2–N8 produkcja | zrobione 23:52 — commit `456a7a14`, migracja 0219, dpl `dpl_7ngsrbV8JXwDHvDCEBRjdWVS2dLw`; odbiór S24 **czeka** |
| W24 Android S24 | dostarczone 20:50 (N1); pełny odbiór po tym wdrożeniu |

**C16 NA PRODUKCJI — 456a7a14, 23:52; właściciel: test S24 z potwierdzeniem.**

## 2026-10-16 — wygląd P5-b / P5-c / P6-c / P6-d NA PRODUKCJI (F2)

| punkt | zrobione / odbiór |
|---|---|
| #222 wyglad/P5-b | scalone `668e00ea`; dpl `dpl_3MdW736TrSGugPp2kdarLVnLWbED` ~00:10; tower/makieta 200 |
| #225 wyglad/P5-c | scalone `3d20f53a`; dpl `dpl_9zVg9fWHNcMUGS6VZsycee3ftxBX` ~00:12; tower/makieta 200 |
| #228 wyglad/P6-c | scalone `fd5562ff`; dpl `dpl_8Zn7b5LUwhjXeYot2aAFodPNFGD8` ~00:14; tower/makieta 200 |
| #230 wyglad/P6-d | scalone `d6fc9ae8`; dpl `dpl_BfZ9gPTzdhMpbw5ZMKqNe5Jmpqb2` ~00:17; dopisek C17 w repo; tower/makieta 200 |

unit + visual zielone przed każdym scaleniem; `npm audit` 0. #209/#231 (P7) — sobota (D-20261015-0130-01).

**wyglad/P5-b NA PRODUKCJI — 668e00ea.**  
**wyglad/P5-c NA PRODUKCJI — 3d20f53a.**  
**wyglad/P6-c NA PRODUKCJI — fd5562ff.**  
**wyglad/P6-d NA PRODUKCJI — d6fc9ae8.**

## 2026-10-16 — C17 NA PRODUKCJI (D-20261015-2110-01)

- Merge PR #235 → `e7595541` (merge); treść `1d6207ff` (release DELIVERED) / migracja 0220.
- CI #235 na `1d6207ff`: unit / visual / `db` zielone (release po C17: DELIVERED); `npm audit` 0; doradca TEST security: 149, **0 nowych**.
- Kopia: `D:\Watch Tower\dane\p2\kopia-c17-loads-2026-10-16.csv` (3 wiersze + nagłówek), SHA-256 `fd93120ff9ab24a99c58c1bada67681d5c8525fc82895a9cf3101579bb1abbd1`.
- Próba ROLLBACK 0220: 15048 READY_TO_INVOICE, 15060 INVOICED, UNLOADED=0, backfill `{unloaded_to_delivered:1,to_ready_to_invoice:1,to_invoiced:1}` → ROLLBACK; potem `db push` ×2 (drugi: up to date); parytet **MATCH YES** 0001…0220.
- Po COMMIT: 15048 READY_TO_INVOICE, 15060 INVOICED, 15062 DELIVERED, UNLOADED=0; 3× STATUS_AUTO z `przebieg=jednorazowy C17`.
- Aplikacja R7: `dpl_HRCPmDoD3Ghiumi6tXDkaxcSzRfs`, JS `assets/index-DpEvn83_.js`; tower / makieta **200**; 0 × `service_role`.
- Odbiór C17 (SELECT): OK. C17 zamknięte przed BLOKEREM C16-H — zakładka niepotrzebna.

| punkt | zrobione / odbiór |
|---|---|
| C17.1 CMR → READY_TO_INVOICE | zrobione — 0220 |
| C17.2 faktury → INVOICED | zrobione — 0220 |
| C17.3 reguły wspólne | zrobione — 0220 |
| C17.4 UNLOADED → DELIVERED | zrobione — 0× UNLOADED |
| C17.5 przebieg jednorazowy | zrobione — backfill 1/1/1 |
| C17.6 testy status/e25/release | zrobione — CI db zielone |
| C17.7 wygląd (wykonawca) | bez zmian |
| C17 odbiór produkcja | zrobione 02:02 — SELECT OK |

**C17 NA PRODUKCJI — e7595541, 02:02.**

## 2026-10-16 — C16-H NA PRODUKCJI (D-20261016-0100-01)

- Merge PR #238 → `8bae03be`; treść `3b71b56e`.
- CI #238: unit / visual / `db` zielone; `npm audit` 0.
- TEST: security 84/84, status 55/55, c16-push 18/18, nullguard 161+136+216+124 = 637/637 (nullguard-4 ponowiony 124/124); doradca 149, **0 nowych**.
- Kopia PENDING push_fallback: `D:\Watch Tower\dane\p2\kopia-c16h-pending-fallback-2026-10-16.csv` (0 wierszy danych), SHA-256 `1283ff25df934c3475e683021322c071b20afa990e7c87ebecab6c2caebd010c`.
- Przed: PENDING push_fallback=0; WEB_PUSH sprzed granicy bez fallbacku=933.
- ROLLBACK 0221 OK → `db push` ×2; parytet **MATCH YES** 0001…0221; audit `C16H_PUSH_FALLBACK_CANCEL` cancelled_pending=0.
- Po: tick=0; new_fb_for_old=0; pending_fb=0.
- H3: `send-notifications` v24→**v26** (notifyTemplates PL); web-push-* już z C16.
- H4: sekret `APP_URL=https://tower.log-mar.pl` (bez logowania innych sekretów).
- Odbiór pkt 1 (SELECT): OK. Pkt 2 (test właściciela G-14) — po wdrożeniu.

| punkt | zrobione / odbiór |
|---|---|
| H1 tick / enqueue | zrobione — 0221 |
| H2 CANCEL PENDING starych | zrobione — 0 PENDING |
| H3 send-notifications | zrobione — v26 |
| H4 APP_URL | zrobione |
| H5 testy | zrobione — c16-push 18, unit temat |

**C16-H NA PRODUKCJI — 8bae03be, 10:02.**

## 2026-10-16 — dopiski włączone do planu (0200 / 0230 / 0250 / 0310 / 0315)

Tabela sprawdzalności (prompt 16.10):

| dopisek | punkt | paczka | pozycja w PLAN |
|---|---|---|---|
| D-20261016-0200-01 | Z1 wymiary/pilot/zezwolenie z tabeli | P5 | D1 |
| D-20261016-0200-01 | Z2 polisa HHL + zezwolenie 13/GD/2026 | P5 | D2 |
| D-20261016-0200-01 | Z3 usunięcie H-1 / H-3 | P9 | H-1 i H-3 — usunięcie |
| D-20261016-0200-01 | Z4 KPD / SMS SG-03 / D-21 | P6 E2-1; P8 E42; dokumenty | zamknięte bez nowej pracy |
| D-20261016-0200-01 | Z5 W19 | §5 | zastąpione przez 0230 (W19 zamknięte) |
| D-20261016-0230-01 | Z1–Z6 E49 wiatr/objazd/śliskość | P6 | E49 |
| D-20261016-0230-01 | Z3 pkt 8 linia objazdu | P9 | E45 uzupełnienie |
| D-20261016-0230-01 | Z5 Wiatr — SMHI | P10a | E23 |
| D-20261016-0230-01 | Z7 W19 / W45 / D-84 | §5 / rejestr | W19 zamknięte; W45; D-84=20 |
| D-20261016-0250-01 | Cz1–Cz12 | P6 | E17 Czat — dane |
| D-20261016-0250-01 | Cz11 wygląd | P6 | wyglad/P6-d |
| D-20261016-0310-01 | Cz13 | C3 | wiersz „Wiadomość w czacie” |
| D-20261016-0310-01 | Cz14–Cz24 | P6 | E17 Czat — dane |
| D-20261016-0310-01 | Cz23 wygląd | P6 | wyglad/P6-e |
| D-20261016-0310-01 | Cz24 pkt 12 iPhone | §5 | W43 |
| D-20261016-0315-01 | Cz25 | C3 | przy Cz13 |
| D-20261016-0315-01 | Cz26–Cz33 | P6 | E17 Czat — dane |
| D-20261016-0220-01 | Z1–Z3 E35 Automatyzacje | P8 | E35 — **włączone po #239** (`3bbb480e`) |

## 2026-10-16 — dopiski włączone do planu (0305…1020)

Tabela sprawdzalności (prompt 16.10, 11:30 i 11:40). Pliki dopisków wchodzą z PR wyglądu — nie kopiowane osobno.

| dopisek | PR | paczka i pozycja w PLAN | punkty | test odbioru |
|---|---|---|---|---|
| D-20261016-0305-01 | #240 `wyglad/E49` | P6 E49 | pkt 1–5 (z 0230 Z1–Z4, Z6) | Z6 + zestaw `e49` |
| D-20261016-0330-01 | #241 `wyglad/P6-e`; #242 `wyglad/P6-f` | P6 E17 Czat — dane; C3 wartości startowe | pkt 1–7 | Cz12, Cz24, Cz33; bloki `wyglad/P6-e`, `wyglad/P6-b`, `p6-history` |
| D-20261016-0405-01 | #243 `wyglad/2fa` | P3-d Moje konto (pkt 1) i Przełączniki (pkt 8) | pkt 1–2 | pkt 3 |
| D-20261016-0430-01 | #244 `wyglad/P10a-a` | P10a E22 | pkt 1–3 | pkt 4 (E22 pkt 5) |
| D-20261016-0445-01 | #245 `wyglad/P9-a` | P9 E24 | pkt 1–4 | P9 Odbiór pkt 4 |
| D-20261016-0530-01 | #246 `wyglad/P10b-a` | P10b E37 | pkt 1–4 | P10b Odbiór: testy z pkt 1–4 |
| D-20261016-0615-01 | #248 `wyglad/P9-c` | P9 E29 | pkt 1–4 | P9 Odbiór pkt 6 (E29 pkt 11) |
| D-20261016-0635-01 | #249 `wyglad/P9-d` | P9 E1 | zrobione w wyglądzie | — (dane bez zmian zakresu) |
| D-20261016-0715-01 | #250 `wyglad/P9-e` | P9 E45 grupowanie | pkt 1–2 | P9 Odbiór pkt 4 |
| D-20261016-0740-01 | #251 `wyglad/P9-f` | P9 Przegląd w panelu | pkt 1–2 | P9 Odbiór pkt 4 |
| D-20261016-0810-01 | #252 `wyglad/P10b-b` | P10b Pomoc i „Co nowego” | pkt 1–2 | P10b Odbiór pkt 4 |
| D-20261016-0845-01 | #253 `wyglad/P10b-c` | P10a E23 i E47; P10b E23 i E47; P11 E46 | pkt 1–6 | P10a/P10b Odbiór pkt 8; E46 do pierwszego testu „bez pomiaru” |
| D-20261016-0930-01 | #254 `wyglad/P10b-d` | P10b E37 pierwsze wejście | pkt 1–4 | P10b Odbiór pkt 6 |
| D-20261016-1020-01 | #256 `wyglad/P7-c` | P7 E38, E30, E20 | pkt 1–6 | TEST: 1366 px, eksport „t40–t41”, układ na drugim komputerze, telefon 390, kwoty i kolumny według firmy, waga elementu, „ZMIANA NUMERACJI” |

E49 miejsca w kodzie → P6.  
Czat — miejsca w kodzie, Cz14 → P6.  
2FA urządzenia → P3-d.  
E22 → wygląd (P10a-a), dane P10a.  
E24-1 zapis zgłoszenia → P9.  
E37 pkt 4 i 7 — dane → P10b.  
E29 dane → P9.  
E1 → wygląd (P9-d).  
E45 grupowanie → wygląd (P9-e), dane P9.  
E32 pkt 3 → wygląd (P9-f), dane P9.  
E37 Pomoc → wygląd (P10b-b), dane P10b.  
E23/E47/E19 pkt 7/E46 ekran Stan systemu → wygląd (P10b-c), dane P10a/P11.  
E37 pierwsze wejście → wygląd (P10b-d), dane P10b.  
E38 1A / E30 / E20 Harmonogram → wygląd (P7-c), dane P7.

**Następny krok po tym commicie:** kolejka wyglądu #240 → #241 → #242 → #243 → #244 → #245 → #246 → #248 → #249 → #250 → #251 → #252 → #253 → #254 → #256, potem sobota #209 → #231 → #247. Potem C3…C15 → P3-d → P5 → P6 → …

## PAUZA — 2026-10-16 10:21 — **WZNOWIONE 10:59** (hasło „ruszamy”)

**ZAKŁADKA — przerwane tu:** scalenie PR dokumentacji #255; potem sygnały dopisków; potem kolejka PR wyglądu.

### Stan w chwili pauzy
| pozycja | stan |
|---|---|
| C17 | **zamknięte** — `e7595541`, 0220, dpl `dpl_HRCPmDoD3Ghiumi6tXDkaxcSzRfs`, 02:02 |
| C16-H | **NA PRODUKCJI** — merge `8bae03be`, migracja **0221**, `send-notifications` **v26**, `APP_URL=https://tower.log-mar.pl`, tick starych=0, pending_fb=0; TEST security 84 / status 55 / c16-push 18 / nullguard 637; CI #238 zielone |
| Gałąź lokalna | `docs/dopiski-20261016-plan` @ `442281ca` (wypchnięta) |
| PR #255 | OPEN, MERGEABLE, unit+visual **SUCCESS** — **następny krok: `gh pr merge 255 --merge`**, potem `git checkout main && git pull` |
| Untracked | `docs/handover/dopiski_nowe/` (kopie źródłowe; treść już w `docs/handover/dopiski/`) — nie commitować osobno |

### Po scaleniu #255 — sygnały (jeszcze nie wysłane)
1. `DOPISKI 0200 / 0230 / 0250 / 0310 / 0315 WŁĄCZONE — commit <hash merge lub 442281ca>`
2. `DOPISEK 0250 WŁĄCZONY — commit …, P6: E17 Czat — dane, Cz1–Cz12`
3. `DOPISEK 0310 WŁĄCZONY — commit …, C3: Cz13; P6: Cz14–Cz24`
4. `DOPISEK 0315 WŁĄCZONY — commit …, C3: Cz25; P6: Cz26–Cz33`
5. (już w POSTEP) `C16-H NA PRODUKCJI — 8bae03be, 10:02` — powtórz właścicielowi jeśli nie dostał

Tabela sprawdzalności punktów jest w POSTEP powyżej („dopiski włączone do planu”).

### Kolejka po sygnałach (bez zmian)
1. Wygląd D-20261016-0045-01 **+ #239**: `#232` → `#233` → `#236` → `#239` → `#237` — po każdym zielone unit+visual, merge; **jedno wdrożenie R7** na końcu; sygnał `P8-a, P8-b, P8-c, push-w42…` według dopisku (oraz P8-d z #239).
2. Po #239: dopisek **D-20261016-0220-01** → wpis P8 E35 w PLAN (w commicie po scaleniu #239) + wiersz w tabeli POSTEP.
3. Potem `wyglad/E49` (**PR #240**), scal jak wygląd.
4. Dalej: **C3…C15** → **P3-d** → P5 → P6 → … według PLAN.md (nic z 0200 przed P5; czat Cz* w C3/P6; E49 w P6).

### Nie zaczynaj przy wznowieniu
- Nie wracaj do C16-H / C17 (zamknięte).
- Nie rób punktów z dopisków 0200/0230/0250/0310/0315 poza wpisami w PLAN (wykonanie dopiero w paczkach).
- Jedna rzecz naraz; G-15 przy bramach.

### Komendy startowe po „ruszamy”
```bash
cd "/d/Watch Tower/repo"
git checkout docs/dopiski-20261016-plan && git pull
gh pr checks 255   # jeśli nadal zielone:
gh pr merge 255 --merge
git checkout main && git pull --ff-only origin main
# sygnały dopisków → kolejka #232…
```

## 2026-10-16 — wygląd P8-a…d + push-w42 NA PRODUKCJI (D-0045 + #239)

| punkt | zrobione / odbiór |
|---|---|
| #255 docs dopiski | scalone `b1ba78cd` (treść `fbf995f4`) |
| #232 wyglad/P8-a | scalone `9df8beb6` |
| #233 wyglad/P8-b | scalone `455d6558` |
| #236 wyglad/P8-c | scalone `58ffd907` (rebase main) |
| #239 wyglad/P8-d | scalone `3bbb480e`; D-0220 w PLAN P8 E35 |
| #237 wyglad/push-w42 | scalone `a300b29b` |
| wdrożenie R7 | `dpl_9tVs4DubP7G6Do8KX43zZz1qnKxK`, JS `assets/index-XNiL2Qy9.js`; tower/makieta 200; 0× service_role |

**DOPISKI 0200 / 0230 / 0250 / 0310 / 0315 WŁĄCZONE — commit b1ba78cd (treść 442281ca / fbf995f4).**  
**DOPISEK 0250 WŁĄCZONY — commit b1ba78cd, P6: E17 Czat — dane, Cz1–Cz12.**  
**DOPISEK 0310 WŁĄCZONY — commit b1ba78cd, C3: Cz13; P6: Cz14–Cz24.**  
**DOPISEK 0315 WŁĄCZONY — commit b1ba78cd, C3: Cz25; P6: Cz26–Cz33.**  
**DOPISEK 0220 WŁĄCZONY — commit (ten docs) / #239 `3bbb480e`, P8: E35 Z1–Z3.**  
**C16-H NA PRODUKCJI — 8bae03be, 10:02.**  
**P8-a, P8-b, P8-c, P8-d, push-w42 NA PRODUKCJI (wygląd) — a300b29b, 11:20; dpl_9tVs4DubP7G6Do8KX43zZz1qnKxK.**

## 2026-10-16 — dopisek D-20261016-2130-01 w planie

Kolejka wyglądu: `wyglad/W-dane` PR #274. Wpisane 16.10; scalone i wdrożone 17.10.2026 00:38 po C3 (szczegóły w sekcji niżej). Bez bazy (F8). Plik dopisku wszedł z PR.

| punkt | gdzie | stan |
|---|---|---|
| kolejka #274 | PLAN §4 | scalone i wdrożone 17.10.2026 00:38 (`7db7282f`) |
| P5 pkt 3.1 | rodzaj OTHER, wiele plików bez wersji, HHL i SCX wgrywają, KSH i Podgląd odmowa, na końcu `otherDocsOn()` = true | do zrobienia w P5, z testem odbioru |
| P9 pkt 3.2 | geometria objazdu HERE przy sprawie; `detourLinesOf()` czyta `{ loadId, line, via, addKm, addMin }` | do zrobienia w P9, z testem odbioru |
| P9 pkt 3.3 | najpierw TEST: czy HERE ma odcinek promowy; jeśli tak — `ferries` w `map_display_state`; jeśli nie — wpis W | do zrobienia w P9, z testem odbioru |
| Podgląd W38 | bez zmian w planie | bez zmian |

## 2026-10-17 — C3 na produkcji, potem wygląd #274

- Scalenie C3: `2938ae96` (PR #273), 17.10.2026 00:28. Migracja `0222_c3_matrix_events.sql`.
- Próba na produkcji: ROLLBACK — macierz 25 → w transakcji 100 wierszy i kolumna `event_key`, po wycofaniu z powrotem 25 wierszy i 0 kolumn `event_key`.
- `supabase db push`: pierwszy nałożył 0222, drugi „Remote database is up to date”. Parytet: LOCAL 222 = PROD 222, MATCH YES. Po nałożeniu: 100 wierszy, 23 zdarzenia.
- TEST na `394cba01` (ten sam plik 0222, przed dopisaniem wyjątków doradcy w `f7c151e0`): security 84/84 (+2 SKIP), status 55/55, nullguard 647/647, c3 15/15, risks 25/25 (+2 SKIP). Doradca security po wyjątkach `my_notify_get` / `my_notify_set`: 151 zgłoszeń, 0 nowych.
- Check na `f7c151e0`: unit, visual, `db` zielone.
- `send-notifications` wdrożona (`--no-verify-jwt`, szablony C3).
- Wdrożenie C3: `dpl_4iugo2qyvCYt9gNgHUpmjjH3hivi`, 17.10.2026 00:34. `tower.log-mar.pl` i `watch-tower-makieta.vercel.app` → 200, `assets/index-B_buB0CA.js` (445473 B, zgodny z lokalnym `dist/`), 0× `service_role`.
- Wygląd #274: scalenie `7db7282f`, 17.10.2026 00:36; wdrożenie `dpl_CaHR42SHedxQesLr1Q6W6hXPusA1`, 00:38. Oba adresy 200, `assets/index-Bv_J4hjW.js` (445544 B), 0× `service_role`. Bez bazy. `otherDocsOn()` zostaje false do P5, `detourLinesOf()` zostaje puste do P9.
- #259: unit i visual zielone, scalenie zatrzymane — konflikt z `main`. Bez wdrożenia.
- Dalej kolejka (po D-20261017-0730-01): **C3-p → B1 → … → A6**, potem C4… (nie od razu C4).

## 2026-10-17 — C3-p NA PRODUKCJI

- Gałąź `pakiet/audyt-17`; PR #278; merge `17be0998` (treść `161d1f19`).
- Migracja `0223_c3p_chat_matrix_fixes.sql`: czat bez `critical` / bez e-maila zapasowego; title/body na telefon; `C3_MATRIX_KOPIA`; osobne `pre_arrival_site` / `pre_arrival_srem` / `src_back`; usunięcie `AUTOMATIC_DECISION_EMAIL`.
- CI: unit, visual, `db` (pełna brama) zielone na `161d1f19`.
- TEST (SHA `161d1f19`): security 84/84 (+2 SKIP), status 55/55, nullguard 161+136+224+126 = **647/647**, c3 **26/26**; doradca security TEST: 151 zgłoszeń, 0 nowych (wyjątki 166).
- Próba prod ROLLBACK: matrix 100 → w TX 107 / 25 event_key / AUTOMATIC=0 / KOPIA=1; po ROLLBACK z powrotem 100 / AUTOMATIC=1.
- `supabase db push`: 0223 nałożona. Po: matrix 107, 25 zdarzeń, KOPIA=1, AUTOMATIC=0.
- SELECT pkt 6: `src_down` × HHL_ADMIN email=true push=true in_app=true; `zone`/`cmr` × CLIENT_USER in_app=false; chat push bez e-maila = 5.
- Wdrożenie: `dpl_2xXvmtEXdvCnUp8WWW6DzNodae9G`, 17.10.2026 11:18; tower/makieta 200; `assets/index-C_gl0fhW.js`; 0× `service_role`.
- **TEST wolne** od 17.10.2026 11:14.
- Dalej: B1 (po dopiskach 0800/0930/0915 i scaleniu #277…).

## 2026-10-17 — DOPISEK D-20261017-0730-01 WŁĄCZONY

Audyt 17.10 przyjęty przez właściciela; decyzje 07:20: **1A, 2C, 3A, 4B, 5B, 6A, 7A, 8A**.

### Kolejka od teraz
**C3-p → B1 → B2 → B6 → A8 → A1 → A2 → A3 → A7 → A9 → A4 → A5 → B4 → B5 → B7 → B8 → B9 → A6** → C4–C11, C13 → **P4-u** → P3-d → P5 → P6 → P7 → P8 → P10a → P9 → P10b → P11.

Termin `release-1.0`: **środa 28.10.2026, 20:00** (bez cięcia zakresu; „Rezerwa” usunięta).

### Prostowanie statusów
- **P4** było zapisane jako „NA PRODUKCJI” — poprawione na **CZĘŚCIOWO** (commit `3c676d96`). Brakuje: E26 → A2; E27 okno serwer → A1; „Gotowy” w bazie → A9; E15 pkt 1–3, E44 pkt 2–8, L17 → P4-u.
- **„B5 RIO URL wklejony”** (wcześniejszy wpis P4): zrobione były tylko kolumny i maskowanie — nie pełne E44 pkt 2–8 (to w P4-u).

### Właściciel — już zrobione / w drodze
- W1 — ustawienia hasła 17.10, 07:28 → B2: `auth_leaked_password_protection` ma zniknąć.
- W36 — `ADVISOR_MGMT_TOKEN` w Secrets Supabase 17.10, 07:28 → B2: jedno wywołanie, `advisor_ok = true`.
- W44 — pliki D1/D2 w `D:\Watch Tower\dane\` (07:20).
- W27 — zamknięte (4B).
- W37 — emtrack od SCX w drodze; A8 bez czekania.

### Liczby do uzupełnienia przy odbiorze
- C3-p pkt 6 — **uzupełnione** (wyżej): src_down HHL_ADMIN e-mail+telefon; KSH zone/cmr wyłączone.
- B2: `advisor_ok`, liczba zgłoszeń vs `advisor-exceptions.txt`; potwierdzenie braku `auth_leaked_password_protection`.
- B8: liczby nieprzeczytanych `IN_APP` przed i po (starsze niż 7 dni).

### #275
Scalone `1eb7f395` (odbiór C3 + #274) — same dokumenty, bez wdrożenia.

## 2026-10-17 — DOPISKI D-20261017-0800-01 / 0930-01 / 0915-01 W PLANIE

Kolejka PR wyglądu: **#277 `wyglad/W-audyt` → #279 `wyglad/W-demo` → #280 `wyglad/W-pl`**. Scalanie w przerwach między pozycjami; wdrożenie po scaleniu. `serverRuleOn`: TRACKING_WINDOW (A1), SITE_EXIT_DELIVERED (A2), WIND_E49 / DETOUR_E49 (P6 E49), ROAD_PL_HERE (P6 E2), ROAD_SITUATIONS_MAP (P9 E29 pkt 3). Zadania: EUR przy pierwszym logowaniu; teksty serwera bez `upper(` (C3-p/C6); P5 kurs `fx_rates` + usunięcie `invoices` demo; P4-u `delayed`; P11 ujęcia z TEST; B9 DeepL + język; P8 `sms_render` PL. VISUAL #279 / #280 — czekają na wzorce koordynatora (unit zielone, visual czerwone przed odświeżeniem).

## 2026-10-17 — B1 NA PRODUKCJI

- Gałąź `pakiet/audyt-17-b1`; PR #283; merge `92117abd` (treść `31038de3`).
- Migracja `0224_b1_security_flags_select.sql`: GRANT SELECT + RLS `is_hhl()`; `security_flags_list()` dla HHL_ADMIN / HHL_OPS.
- CI: unit, visual, `db` (security/nullguard) zielone na `31038de3`.
- TEST (SHA `31038de3` / migracja 0224): security **92/92** (+2 SKIP), status **55/55**, nullguard 161+136+228+127 = **652/652**.
- Próba prod ROLLBACK: SELECT=true, polityka 1, funkcja `security_flags_list` — OK; ROLLBACK.
- `supabase db push`: 0224 nałożona (`schema_migrations` = 0224).
- Wdrożenie: `dpl_2mB55evGPQh5RUT4LUCLsP31kFRv`, 17.10.2026 13:08; tower/makieta 200; `assets/index-VhdqXegf.js`; 0× `service_role`.
- **TEST wolne** od 17.10.2026 13:05.
- Dalej: dopisek 1100 + #282, potem **B2**.

## 2026-10-17 — DOPISEK D-20261017-1100-01 W PLANIE

Kolejka PR wyglądu (po #280): **#282 `wyglad/W-eta`**. Scalanie w przerwie między pozycjami; wdrożenie po scaleniu. P4-u: `fmt_eta_duration` + „przyjazd nocą” w e-mail/SMS; dane ekranu Kalibracja ETA (§3 pkt 1–9). E15 kalibracja po 5 dostawach (3A) — wygląd W-eta, dane §3.

### Sprawdzenia koordynatora (dopisek §1)
- audyt 03 N6 (C16-H, sekret `APP_URL`): **OK** — e-mail systemowy z 17.10.2026, 02:15 prowadzi do `https://tower.log-mar.pl/#/…`;
- audyt 03 N5 (C16, potwierdzenie z telefonu poza testem): **czeka** — od 16.10, 10:01 brak nowych WEB_PUSH; ostatnie potwierdzenie 16.10, 16:42 (Android).

## 2026-10-17 — #282 `wyglad/W-eta` NA PRODUKCJI

- PR #282; merge `a5da99ba`. Bez migracji.
- Wdrożenie: `dpl_H6KzHnyockMQ6BGX3XtBACDHuuD8`, 17.10.2026 13:34; tower/makieta 200; `assets/index-B6b4ep5J.js`; 0× `service_role`.
- Dane Kalibracji ETA — P4-u (dopisek §3); produkcja: „Brak źródła danych.”

## 2026-10-17 — B2 NA PRODUKCJI

- Pierwsze wywołanie `security-advisor-snapshot` (sekret W36 już w Edge): HTTP 200, `advisor_ok = true`, migawka 6, 171 zgłoszeń. Obiekty zapisane jako `public.*` — API doradcy nie zwraca `findings[]`.
- PR #286; merge `9ccf2a8d` (treść `a61bdd5b`): odczyt `metadata` z wiersza lintu. Funkcja wdrożona ponownie na produkcji.
- Drugie wywołanie: migawka 7, `advisor_ok = true`, 171 zgłoszeń, 165 unikalnych obiektów, 0 × `public.*`.
- **W1:** `auth_leaked_password_protection` — **brak** na liście doradcy produkcji.
- Jedno zgłoszenie spoza `advisor-exceptions.txt`: `authenticated_security_definer_function_executable` / `public.security_flags_list` (B1, rola w funkcji) — dopisane do wyjątków.
- `rls_enabled_no_policy` dla `security_flags` zniknęło (polityka SELECT z B1).
- Dalej: **B6**.

## 2026-10-17 — DOPISEK D-20261017-1220-01 W PLANIE

Kolejka PR wyglądu (po #282, już na produkcji): **#284 `wyglad/W-konta`**. Scalanie w przerwie między pozycjami; wdrożenie po scaleniu. W PR: rodzaj konta w demo, `accountRole`, Pomoc bez fałszywego braku, SMS przy miejscach do odczytu u Operacji, C8 N2 (formularze; w C8 zostaje strona bazy). Nowe sprawdzenia uprawnień (A2, A4, B5 i dalej) przez `accountRole(role)`. B7: bez geolokalizacji kierowcy — tylko CSP Report-Only `frame-src` (właściciel 17.10, 12:25: aplikacja kierowcy porzucona, zostaje w kodzie).

B2 zamknięte w dokumentach: merge `27daa36a` (PR #287).

## 2026-10-17 — #284 `wyglad/W-konta` NA PRODUKCJI

- PR #284; merge `54af2ca9`. Bez migracji.
- Wdrożenie: `dpl_4GnUJaM7HSSZJ5hA7ZPP8Ur5muTU`, 17.10.2026 15:00; tower/makieta 200; `assets/index-CHxNPYB5.js`; 0× `service_role`.
- Dalej: **B6**.

## 2026-10-17 — B6, uwagi D-20261017-1530-01

PR #290 (`pakiet/audyt-17-b6`, migracja 0225, jeszcze bez scalenia). Uwagi koordynatora D-20261017-1530-01 pkt 1–4 — zrobione:
1. `revoke insert, update` na `loads` dla `authenticated` i grant kolumn bez `rio_secret`; kopia uprawnień w `audit_log` (`B6_LOADS_GRANTS`).
2. Licznik anon: IP z `cf-connecting-ip`, potem `x-forwarded-for`, na końcu `inet_client_addr()`; przeglądarka z `user-agent`.
3. Tytuł „Limit e-maili na dziś”, treść z `{n}`, klucz `EMAIL_BUDGET` w `notification_copy`.
4. `payload.push_fallback` poza limitem 20/5, licznik `*pilne*`.
Zaproszenia i reset hasła (`AUTH_INVITE`, `AUTH_PASSWORD_RESET`) zostają w rezerwie L-13, poza limitem 5 na rodzaj.
Bez zmian merytorycznych: `guard_invoice_update`, `loads_read` bez SITE.
Testy w `security.sh` (oczekiwane 115 lokalnie / 111 na TEST). Brama `db` i scalenie B6 — po tym commicie.

## 2026-10-17 — B6 NA PRODUKCJI

- PR #290; merge `57f8b30b` (treść `68f1e2b1`). Migracja `0225_b6_email_budget_guards.sql`.
- CI na `68f1e2b1`: unit, visual, `db` zielone.
- TEST: security **111/111** (+2 SKIP), status **55/55**, nullguard 161+136+228+127 = **652/652**.
- Doradca security na TEST: jedno nowe zgłoszenie `rls_enabled_no_policy` / `public.anon_call_window` — tabela zamknięta, odczyt przez funkcje właściciela; wpis w `advisor-exceptions.txt`. Przyjęte.
- Próba prod ROLLBACK: `rio_secret` update/insert = false, `status` update = true, `EMAIL_BUDGET` wstawiony; ROLLBACK.
- `supabase db push`: 0225 nałożona. Po: `schema_migrations` = 0225, uprawnienia jak w próbie, `notification_copy` EMAIL_BUDGET = 1.
- Wdrożenie: `dpl_73Af9uhvezSDLCwe4KnUFVcQnjYi`, 17.10.2026 18:13; tower/makieta 200; `assets/index-CHxNPYB5.js` (ten sam plik co #284, B6 nie zmienia JS).
- **TEST wolne** od 17.10.2026 17:16 (koniec nullguard-4).
- Uwagi D-20261017-1530-01 pkt 1–4 — zrobione.
- Dalej: **A8**.

## 2026-10-17 — #289 `wyglad/W-naprawy` NA PRODUKCJI

- PR #289; merge `7639e1c8`. Bez migracji.
- Wdrożenie: `dpl_Aou8wXFk82yjJahazFPnu4SYekUx`, 17.10.2026 18:15; tower/makieta 200; `assets/index-Dr68_XrG.js`; 0× `service_role`.
- `INVOICE_A4` zostaje wyłączone do wdrożenia A4.
- Dalej: **A8**.

## 2026-10-17 — DOPISEK D-20261017-1450-01 W PLANIE

Kolejka PR wyglądu (po #284, już na produkcji): **#289 `wyglad/W-naprawy`**. Scalanie po skończonym punkcie (po B6 albo później), przy zielonych `unit` i `visual`; wdrożenie po scaleniu bezpieczne przed A4 (`INVOICE_A4` zostaje wyłączone do wdrożenia A4). Wzorce `visual` odświeża koordynator; czerwony `visual` przed jego commitem z wzorcami — sygnał „VISUAL #289”.

Przy A4: kreator, „Do wystawienia”, menu i Kokpit z tego PR; baza `register_invoice` + przestawienie `INVOICE_A4`. Przy B5: `payload.preview_as`. Przy A2: `DELIVERED_CHECK`. Przy A3: `CMR_UPLOAD` albo `DOC_MISSING` bez nowego kodu. Przy A6: `KSH_DATES_CHECK`. `billReady` = lustro `c17_cmr_after_delivery` — zmiana warunku w bazie to sygnał do widoku. A5 bez zmian z tego dopisku.

## 2026-10-17 — DOPISEK D-20261017-1715-01 W PLANIE

Kolejka PR wyglądu: **#291 `wyglad/W-naprawy-2`** (baza `main`; #289 już scalony). Scalanie po skończonym punkcie, przy zielonych `unit` i `visual`. Wdrożenie po scaleniu jest bezpieczne przed A5, A6, A8, A9 i C11 — pola od wykonawcy są opcjonalne. Wzorce `visual` odświeża koordynator; czerwony `visual` przed jego commitem z wzorcami — sygnał „VISUAL #291”. Plik dopisku wchodzi z tym PR.

Twoja część, w swojej kolejności, bez zmiany wyglądu (F1):
- **C11:** Auth ustawił właściciel (W1, 17.10.2026 07:28). Tylko test na TEST: „111111111111” i „ąęśćżźółń1234” → odmowa; „Haslo-testowe-12” → przyjęte. Gdy serwer przyjmie hasło bez litery a–z albo bez cyfry — sygnał „C11 — Auth”.
- **A9:** `awiz_missing(load)` → `load.readyGaps`. Klucze i słowa dokładnie z D-20261017-1715-01 §2 pkt 2 (`AWIZ`, `SAILING`, `PILOTS`, `ORDER_SCX`, `ORDER_HHL`, `POLICY_SCX`, `PERMIT`).
- **A5:** `sailing_id` wymagany do „Gotowy”. W bazie ta sama reguła wczesnego rejsu co widok: nie wcześniej niż późniejsze z okna awizacji i dnia załadunku z planu.
- **A6:** parser wypełnia `ImportDiff.skippedCarrier`, `skippedEmpty`, `datesToCheck` (także 0). Komunikat po imporcie z `standardSkipMessage(…, { carrier, empty })`. Sprawa dat: `KSH_DATES_CHECK`.
- **A8:** `nextTryAt` = `skipped_until` emtrack w danych Stanu systemu. Gdy te dane na produkcji jeszcze nie są podłączone — pole wchodzi razem z nimi.
- **A2:** przestawienie `SITE_EXIT_DELIVERED` przy wdrożeniu zmienia też zdania w Strefach (plac i załadunek).

Bieżąca pozycja w chwili wpisu: **A8**. #291 jeszcze niescalony.



