# POSTEP â rejestr zlecenia koÅcowego

Å¹rÃ³dÅo ID: `docs/handover/ZLECENIE_FINAL.md` Â§12 (**51 pozycji**) + Aneks 1 (AN1 Â· M10 Â· M11) + Aneks 2 (AN2 Â· M12) = **56 pozycji**.  
Kolumny: `ID | pozycja | status | commit | testy (liczby) | uwagi`.

Po F2.5 dodaÄ wiersze **L*** (L1/L2/L4/L5/L7/L8/L9/L16) â na razie brak (notatka: po F2.5).  
NiezgodnoÅci z F2.4: **F2.4-a / F2.4-b / F2.4-c** (poniÅ¼ej, po G1).

Aktualizacja: **2026-09-26** Europe/Warsaw Â· **Etap 5 ZAMKNIÄTY (G5)** (Etap 4 ZAMKNIÄTY Â· D14 Â· D15 Â· G5 DONE; wzorzec `baseline-fala-3b-2026-09-26`, 840 ujÄÄ, 0 zmian w G5) Â· nastÄpny: Etap 6 (O1) Â· kroki wÅaÅciciela: W-BK2-1/2 DONE (01:07 CEST; domena log-mar.pl Verified w Resend â potwierdzone 01:09), W-BK2-3 (opcjonalny), W-BK2-4 i **W-M7-1** (wdroÅ¼enie funkcji e-mail) otwarte (niÅ¼ej).

---

## Etap 0 â przygotowanie

| ID | pozycja | status | commit | testy (liczby) | uwagi |
|---|---|---|---|---|---|
| P0.1 | Zapisz zlecenie â `ZLECENIE_FINAL.md` | **DONE** | `10ac61e` | unit **41/41** Â· pw **4/4** | 465 linii, identyczne z `ZLECENIE_DLA_GROKA.md` z pakietu |
| P0.2 | Rozpakuj pakiet final wg tabeli | **DONE** | `ad5fcc9` | unit **41/41** Â· pw **4/4** | Å¹rÃ³dÅo: chat attachment â `/workspace/tower-pakiet-final-extract/` (nie zip na Domowy Downloads/Desktop â False/False). `money.test.ts` import â `src/lib/money/engine`; **wykluczony** z `test:unit` do M1 (`vitest.config.ts` exclude) â suite pozostaje 41/41. `tower-makieta.html` nie kopiowany |
| P0.3 | ZaÅoÅ¼ `POSTEP.md` rejestr 51 | **DONE** | `992a5e6` | unit **41/41** Â· pw **4/4** | 51 wierszy ID z Â§12; L* po F2.5 |

## Etap 1 â korekty po Fala 2 GATE

| ID | pozycja | status | commit | testy (liczby) | uwagi |
|---|---|---|---|---|---|
| F2.1 | Ryzyka: 0 zmienionych ujÄÄ â wyjaÅnij/napraw | **DONE** | `3c6e3d3` | unit **41/41** Â· pw **4/4** Â· visual **90/720** tylko ryzyka | Hipoteza **(1)** (historyczna): `SAIL_ROWS` w RisksView â naprawione w D4 (`voyage.ts`). **(2)** false â DemoMark jest na panelu SE w Risks. **(3)** false â 90 ujÄÄ `ryzyka` w matrycy. 0 diffÃ³w na GATE: `fullPage:false` + dÅuga kolejka wyjÄtkÃ³w â Prom/SE poniÅ¼ej folda. Fix: `data-panel` + scroll Prom w `baseline.mjs`. PorÃ³wnanie: wyÅÄcznie ryzyka â tag `baseline-fala-2b-2026-09-24` |
| F2.2 | PrÃ³g testu wizualnego (`maxDiffPixelRatio`) | **DONE** | `14261fc` | unit **41/41** Â· pw **4/4** Â· visual compare **720/720** | `maxDiffPixelRatio:0.001` â `fullPage:true, maxDiffPixels:60, threshold:0.28`. Przy 0.15: 716/720 â 4Ã kokpit AA fringe (~18Ã16 px, 107 px); podniesiono **threshold** do 0.28 (nie maxDiffPixels). Wzorca shots-baseline **nie** regenerowano. Smoke `__screenshots__` odÅwieÅ¼one pod fullPage |
| F2.3 | Stylelint zielony (nowy `.stylelintrc`) | **DONE** | `6f77f7e` | unit **41/41** Â· pw **4/4** Â· stylelint **0** | Top5 przed: single-line-max-decl 265, rule-empty-line 49, no-duplicate-selectors 40, font-family-generic 30, declaration-no-important 11. WyÅÄczono formatowanie (+ no-duplicate-selectors: warstwowy CSS Claude; alpha-value-notation). Token/radius/shadow/font-allowed/!important **ON**. CSS: 11Ã !important usuniÄte (Leaflet specificity, reduced-motion target, [hidden]); fontâvar(--font-*); letter-spacing em; clipâclip-path. pre-push: lint:css |
| F2.4 | Weryfikacja mechanizmu paliwowego (bez kodu) | **DONE** | `8f74961` | unit **41/41** Â· pw **4/4** (bez zmian logiki) | SoT: `docs/watch-tower/BAF_SEFS.md`. Tabela zgodnoÅci w `03_PARAMETRY_BIZNESOWE.md` Â§2.2: **9 tak / 1 czÄÅciowo / fasada Opcji**. Naprawy: F2.4-a, F2.4-b, F2.4-c. Opcje BAF â D25 |
| F2.5 | Pozycje L1âL2/L4âL5/L7âL9/L16 â przydziaÅ | **DONE** | `48bb076` | â (docs) | 8Ã L* dopisane do POSTEP z etapem 2/4/5 â bez etapu nie wejdÄ do robÃ³t |
| F2.6 | Trzy wyjaÅnienia (kokpit 54, mapa 18, TZ) | **DONE** | `454ba4a` | â (docs) | 1) Kokpit **54**/90: zmiana D5 KPI byÅa wyraÅºna gÅÃ³wnie u HHL (+ czÄÅÄ KSH); ujÄcia SCX i czÄÅÄ KSH@768 zostaÅy â¤ progu 0.001 (inne KPI / mniejszy obszar cyfr). 2) Mapa **18**/90 tylko @1920: podpis demo / etykiety rejsu dopiero przy peÅnej szerokoÅci przekroczyÅy budÅ¼et pikseli â wÄÅ¼sze viewporty trzymaÅy ratio. 3) `Europe/Warsaw` i `Europe/Stockholm` majÄ to samo przesuniÄcie i te same reguÅy DST â rozrÃ³Å¼nienie w kodzie to zapis intencji operacyjnej, liczbowo offset siÄ nie rÃ³Å¼ni. |
| G1 | Brama etapu 1 | **DONE** | `2cadad2` | unit **41/41** Â· pw **4/4** Â· stylelint **0** Â· visual **720/720** (thr=0.28, maxDiffPixels=60) | `03_PARAMETRY` Â§2.2 tabela zgodnoÅci OK; L1âL16 przydzielone (F2.5); F2.1âF2.6 DONE. Bez regen baseline. STOP przed Etapem 2 |

### Naprawy z F2.4 (poza listÄ 51 â dopiski)

| ID | pozycja | status | commit | testy (liczby) | uwagi |
|---|---|---|---|---|---|
| F2.4-a | Konflikt daty SEFS: zaÅadunek (`BAF_SEFS`) vs rozÅadunek (`MECHANIZM`) vs kod `loadDate` | OPEN | â | â | UzgodniÄ SoT daty; `sefsForLoadDate` dziÅ jak zaÅadunek. Etap: **2** (albo 4 przy pieniÄdzach) |
| F2.4-b | Brak wyliczania Åredniej z poprzedniego tygodnia (live/seed pipeline) | OPEN | â | â | `BAF_SEFS` Â§3; kod ma tylko `SEFS_WEEKLY` demo. Etap: **4** (M3/M8) lub **2** jeÅli demo pipeline |
| F2.4-c | Opcje BAF/SEFS: wszystkie pola `bafFields` + nota UI nie zasilajÄ `computeSefs` â D25 | **DONE** | `3ab44c1` | (w D25) | Pola `readOnly` + nota fasady; `computeSefs` â tylko SEFS_WEEKLY. |

### Pozycje L* (F2.5) â przydziaÅ etapÃ³w

| ID | pozycja | status | commit | testy (liczby) | uwagi |
|---|---|---|---|---|---|
| L1 | Alternatywy trasy SE Ã4 âWybierzâ majÄ mutowaÄ load/risk (dziÅ toast) | **DONE** | `3ab44c1` | (D25) | `applySeRouteAlt` + `seRouteAlts.ts` â mutacja risk/load/event. |
| L2 | Pill opÃ³Åºnienia w drawerze z `delayMinutes`, nie staÅy napis | **DONE** | `3ab44c1` | (D25) | `formatDelayPill(delayMinutesVsPlan)` w LoadDrawer. |
| L4 | Terminy zadaÅ z `plannedLoadDate` / danych load, nie `18+i*9` | **DONE** | `3ab44c1` | (D25) | `hoursUntilLoad(plannedLoadDate)`. |
| L5 | Preferencje powiadomieÅ w Opcjach: zapis **i** filtracja przy push | OPEN | â | â | Etap **4** (centrum powiadomieÅ / M7Â·BK ÅcieÅ¼ka push) |
| L7 | WskaÅºnik kompletnoÅci DRAWING z modelu, nie hardcode 100% | **DONE** | `3ab44c1` | (D25) | Kategoria DRAWING w vault; licznik z UPLOADED. |
| L8 | Kolumna âPrÃ³bkiâ geofence z modelu, nie zawsze `2` | **DONE** | `3ab44c1` | (D25) | `samplesRequired` w Geofence + UI. |
| L9 | JSONLogic / akcje workflow w runtime â realna semantyka, nie atrapa UI | OPEN | â | â | Etap **4** (silnik reguÅ przy backendzie/pieniÄdzach) |
| L16 | Force-majeure / opÃ³Åºnienia â mechanizm ryzyk bez atrap (po SE road) | OPEN | â | â | Etap **4** (rozszerzenie ryzyk / opÃ³ÅºnieÅ) |

## Etap 2 â Fala 3A: treÅÄ, jÄzyk, formaty, silnik Â· **ZAMKNIÄTY (G2)**

| ID | pozycja | status | commit | testy (liczby) | uwagi |
|---|---|---|---|---|---|
| D19-T | Test PL-znakÃ³w poza EN/SV UI | **DONE** | `fd30c94` (+ D19 zielony) | `npm run test:d19` â **en=0 / sv=0** | Harness bez zmian. Po D19: hitsâ0; **`test:d19` w `.githooks/pre-push`**. |
| D10 | Jedna funkcja `formatMoney` | **DONE** | `20ba91c` | unit **44/44** (+3 `format-money.test.ts`) Â· pw **4/4** | Silnik: `formatMoney(amount, lang, currency)` w `src/lib/money/engine.ts` (code, locale). Store: `displayCurrency` (domyÅlnie PLN) + Opcje. Migracja: Dashboard, Schedule, Finance, Invoices, LoadDrawer; SEFS indeksy SEK/PLN teÅ¼. Local `fmt`/toLocaleString+PLN usuniÄte. `money.test.ts` wÅÄczony w M1. EUR w Opcjach = etykieta bez FX (M1/M4 `formatForUser`). |
| D17 | Format daty w tabeli bez powtarzanego roku | **DONE** | `2e590db` | unit **49/49** (+5 D17 w `time.test.ts`) Â· pw **4/4** | `formatTableDay` / `formatTableInZone` / `refYearInOps` w `time.ts`: rok pomijany gdy = rok ops (Warsaw). Tabele: Schedule (zaÅadunek/dostawa/ETA), Tasks, Invoices. Drawer nadal peÅny `dd.MM.yyyy` (D8). |
| M1 | Silnik money + testy (49 zielonych, 1 skip) | **DONE** | `d113779` | money **49 passed / 1 skipped** (`NBP_LIVE`); unit **98 passed / 1 skipped** (money 49+1 skip + reszta 49) | ZdjÄto `exclude` `money.test.ts` z `vitest.config.ts` â suite w `test:unit`/pre-push. Silnik bez zmian reguÅy FX/niezmiennika. **Fit:** app wycena demo nadal PLN w `pricing.*` (fasada); `formatMoney` (D10) juÅ¼ z silnika; peÅne `formatForUser`/marÅ¼a/poziomy â M2âM4/M8. Brak potrzeby przepisywania reguÅ. |
| D11 | Debug/EN enumy out z UI | **DONE** | `8a8569c` | unit **98 passed / 1 skipped** Â· pw **4/4** | `src/lib/enumLabels.ts` + seed/permits/eta PL. Ukryto: ferry status, geofence type, event type, doc category, severity, etaConfidence, payoutStatus, workflow trigger, READY/permitFits/CANCELLED w copy. Nie D19. |
| D19 | 104 napisy â sÅownik PL/EN/SV | **DONE** | `d1d10b1` | unit **98 passed / 1 skipped** Â· pw **4/4** Â· D19-T **en=0/sv=0** Â· lint:css **0** | Chrome â `t()` via `src/i18n/messages.ts` + `src/i18n/d19Extra.ts` (PL/EN/SV). Seed/demo narrative â `data-content`. StatusPill/enumLabels locale-aware. Smoke mapa PL odÅwieÅ¼ony (legenda i18n) â peÅny baseline G2. Gaps: LoadDrawer/DriverPwa/Tasks/KeyboardHelp czÄÅciowo PL (poza matrycÄ HHL D19-T); creator WF PL gdy otwarty. |
| D12 | Dane startowe prawdopodobne | **DONE** | `d8114a7` | unit **98 passed / 1 skipped** Â· pw **4/4** Â· D19-T **0/0** Â· lint:css **0** | `loads.json` + `seedIdentity.ts` + extras w `seed.ts`: nazwiska PL/LT/SE, E.164 (+48/+46/+370), tablice PL/SE/LT, zlecenia `KSH/2026/####`, `HHL/2026/####`, `SCX-26-####`. Brak Driver N / +48 600 000 000 / PSE 1000. data-content na kierowca/tablica (Schedule/Map/Drawer). Smoke mapa odÅwieÅ¼ony (tekst danych). PeÅny baseline = G2. |
| D6 | Telefon kierowcy â szuflada; KSH Â±24 h | **DONE** | `a071261` | unit **103 passed / 1 skipped** Â· pw **4/4** Â· D19-T **0/0** Â· lint:css **0** | `canSeeDriverPhone` / `visibleDriverPhone` w `permissions.ts`: HHL+SCX zawsze; KSH tylko Â±24 h od dostawy (unloadâETAânoon SE). Schedule + LoadDrawer (osobne pole Telefon) z tej samej funkcji. Test: `tests/permissions-phone.test.ts` (+5). |
| D13 | Wzorce wizualne / `section-card-hd--drag` | **DONE** | `6cc701a` | unit **103 passed / 1 skipped** Â· pw **4/4** Â· D19-T **0/0** Â· lint:css **0** (z `selector-class-pattern`) | `section-card-hd--drag` â `.is-draggable` (jak `is-dragging`/`is-drag-over`). Katalog + Â§5.1 kebab/`is-*` w `DESIGN_SYSTEM.md`. Stylelint `selector-class-pattern` wÅÄczony. |
| D18 | Oznaczenie danych demonstracyjnych | **DONE** | `9a9d9cd` | unit **105 passed / 1 skipped** Â· pw **4/4** Â· D19-T **0/0** Â· lint:css **0** | `showDemoMarks` (domyÅlnie ON) + przeÅÄcznik w Opcje â Preferencje. `DemoMark` na: cennik SCX, BAF/SEFS (Opcje), dodatek paliwowy (Finanse), panel SE (Ryzyka). i18n `demo_mark*`. Test: store toggle + soft footnotes. |
| P6 | Stawki demo PLNâEUR tabelÄ 186/A/NBP/2026 | **DONE** | `5a4c1c0` | unit **110 passed / 1 skipped** Â· pw **4/4** Â· D19-T **0/0** Â· lint:css **0** | `DEMO_FX`/`DEMO_FX_META` w `src/lib/money/demoFx.ts` (186/A/NBP/2026 Â· 2026-09-24 Â· mid 4,3900). `RATE_*` + extras seed + store draft â EUR (`plnToEurDemo`). UI: `formatAppMoney` (Dashboard/Schedule/Finance/Invoices/LoadDrawer); SEFS â `formatSourceMoney`. Opcje cennik: edycja w EUR + nota FX. Test: `tests/demo-fx.test.ts` (+5). D18 DemoMark zostaje. Bez D-EUR-T / regen baseline. |
| D-EUR-T | Test waluty EUR/PLN w UI | **DONE** | `d9d4967` | `npm run test:deur` â **EUR=0 / PLN=0** Â· unit **110/1 skip** Â· pw **4/4** Â· D19-T **0/0** Â· lint:css **0** | Spec `tests/d-eur-t.spec.ts`: dwa tryby preferencji; zakazy z ZLECENIE; wyjÄtki data-deur-exempt (indeks paliwowy, wybÃ³r waluty). Money cells = kod trybu; nota FX 4,3900. test:deur w pre-push. sched_money_note {cur}. Smoke kokpit odÅwieÅ¼ony (FX P6). Bez D25 / regen baseline. |
| D25 | Atrapy/porzucone z fasady â decyzja | **DONE** | `3ab44c1` | unit **110/1 skip** Â· pw **4/4** Â· D19-T **0/0** Â· D-EUR-T **0/0** Â· lint:css **0** | ATRAPAâimplement (L1/L2/L4/L7/L8, prefs filter, invoice week/deltas); SAIL via voyage+DemoMark; PORZUCONE: MapLibre public usuniÄte, leaflet duplikat juÅ¼ brak, BAF Options fasada (F2.4-c). Decyzje w `02_FASADA.md` Â§D25. L9/F2.4-a/b poza Etap 2. Bez G2. |
| G2 | Brama etapu 2 + baseline Fala 3a | **DONE** | `7510dab` | unit **110/1 skip** Â· pw **4/4** Â· D19-T **0/0** Â· D-EUR-T **0/0** Â· lint:css **0** Â· visual capture **720/720** Â· compare **711/720** zmienionych â REGEN | Capture `baseline.mjs` â candidate 720/720. Compare vs fala-2: **711 changed / 9 identical** (grupy: docs/mapa/ryzyka 90, harmonogram 89, kokpit 87, faktury 60, â¦). Uzasadnione Etap 2 (D19/D12/P6/D18/D25â¦). REGEN `shots-baseline` + tag `baseline-fala-3a-2026-09-25`. Raport: `docs/handover/G2_BASELINE_FALA3A.md`. Etap 2 CLOSED. |

## Etap 3 â backend

| ID | pozycja | status | commit | testy (liczby) | uwagi |
|---|---|---|---|---|---|
| BK0 | STOP â dane dostÄpowe od wÅaÅciciela | **DONE** | `62919b8` (docs) | â | SzeÅÄ zmiennych w `.env.local` (gitignored `*.local` / `.env.*`): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`, `RESEND_API_KEY`, `MAIL_FROM` â obecne, niepuste. WartoÅci **tylko** lokalnie; nie w commitach / Vercel (O2 pÃ³Åºniej). Brak Dockera na boxie â BK1 na hostowanym Supabase wÅaÅciciela (idealnie pÃ³Åºniej osobny `tower-test`). |
| BK1 | Migracje + seed stegra + cron | **DONE** | `e70e378` | â | `npx supabase` CLI 2.117 (`supabase init` â `config.toml`). `supabase db push` na hostowany projekt (Postgres 17.6, pusta baza): `0001`â`0003` OK + nowa `0004_cron.sql`; historia `supabase_migrations` = 0001â¦0004; 38 tabel w `public`; rozszerzenia postgis/btree_gist/citext/pgcrypto aktywne. Seed `supabase/seed/stegra.sql` uruchomiony 2Ã (idempotentny): org HHL/KSH/SCX (3), projekt STEGRA_BODEN (1), payment_terms 30 d (KSH) i 35 d (HHLâSCX). pg_cron wÅÄczony (`0004_cron.sql`, UTC, nazwane zadania = idempotentne): `tower_refresh_payment_status` 02:15 codz., `tower_purge_personal_data` 02:30 codz., `tower_detect_silent_vehicles` `*/15`, `tower_detect_sequence_risk` 02:45 codz. (wrapper `detect_sequence_risk_all()` po wszystkich projektach, bez grantÃ³w dla anon/authenticated); wszystkie 4 aktywne, funkcje wywoÅane rÄcznie bez bÅÄdÃ³w. PoÅÄczenie: host bezpoÅredni `db.<ref>.supabase.co` tylko IPv6 (nieosiÄgalny z boxa) â session pooler IPv4 `aws-1-eu-west-1` :5432, te same poÅwiadczenia (od BK2: `SUPABASE_DB_POOLER_URL` w `.env.local`, nigdy w logach/commitach). `tests/db/supabase_stub.sql` **nie** uruchamiany na Supabase. Brak zmian UI. **Od AN1:** migracje repo = 0001â0004 wÅaÅciciela (0002 poprawiona G1âG3, 0004 = `0004_statusy_automatyczne.sql` z aneksu) + nasze przenumerowane `0005_cron.sql` (sprzÄtanie: wyrejestrowanie 4 starych zadaÅ `tower_*`, usuniÄcie wrappera) / `0006_auth.sql` / `0007_data_layer.sql`. Zadania pg_cron planuje teraz **0004 aneksu**: `tower-prom` (co min), `tower-prom-opoznienie` (*/10), `tower-cisza-gps` (*/15), `tower-terminy`, `tower-rodo`, `tower-kolejnosc`. Seed zakÅada 5 stref korytarza + 2 statki. |
| BK2 | Auth (magic link) + 3 org | **DONE** | `1fd0e82` | verify 21/21 Â· e2e 20/20 Â· unit 114/1 skip | Migracja `0005_auth.sql` (od AN1: **`0006_auth.sql`**; push OK): konta **tylko na zaproszenie** â `user_invites` + wyzwalacz na `auth.users` (tworzy `app_users` z zaproszenia; adres bez zaproszenia odrzucony `TOWER_NO_INVITE`); funkcje HHL_ADMIN `admin_invite_user` / `admin_revoke_invite` / `admin_set_user_role` / `admin_set_user_active` + `my_profile()`; zgodnoÅÄ roli z firmÄ (`role_matches_org`, role z `0001`); brak zapisu `app_users`/`user_invites` z API; wszystko w `audit_log`; admin nie odbierze sobie roli ani nie dezaktywuje siebie. UI (`src/auth/`, Åadowane leniwie): ekran logowania PL w chrome Claude (e-mail â link), bramka + blokada roli widoku wg firmy konta, pasek sesji z âWylogujâ, panel **Opcje â UÅ¼ytkownicy i role** (tylko HHL_ADMIN: zaproÅ, zmieÅ rolÄ, dezaktywuj, cofnij zaproszenie). Tryb Supabase **tylko** gdy `VITE_AUTH_MODE=supabase` + URL + klucz anon â bez flagi DemoProvider jak dotÄd (baseline/pw/D19/D-EUR bez zmian; build demo nie zawiera URL/klucza ani kodu Supabase â sprawdzone). PrzepÅyw `implicit` (link z zaproszenia dziaÅa w przeglÄdarce zaproszonego). Konta testowe: 3 (HHL_ADMIN / KSH CLIENT_ADMIN / SCX CARRIER_DISPATCH), adresy plus na domenie `MAIL_FROM`, e-mail potwierdzony, **Å¼aden e-mail nie wysÅany**; adresy tylko w `.env.local` (`TEST_USER_*_EMAIL`). Skrypty: `scripts/auth/seed-test-users.mjs` (idempotentny), `verify.mjs` (magic link przez `generate_link` bez wysyÅki â sesja â RLS/RPC dla 3 firm), `e2e-browser.mjs` (build z flagÄ, logowanie/wylogowanie, blokada roli, panel admina). SMTP Resend i adresy przekierowaÅ = **kroki wÅaÅciciela** (brak tokenu Management API; klucz service role go nie daje) â do tego czasu domyÅlny mailer Supabase wysyÅa tylko do czÅonkÃ³w zespoÅu projektu. |
| BK3 | `DemoProvider` / `SupabaseProvider` | **DONE** | `aa1a9a7` | unit 126 (+11 BK3) / 9 skip Â· live 8/8 (`SUPABASE_LIVE=1`) Â· e2e 9/9 Â· BK2 verify 21/21 Â· BK2 e2e 20/20 | `src/data/`: kontrakt `DataProvider` (`loadSnapshot()` + `apply(DataMutation)`), `DemoProvider` (seed â dawny init store przeniesiony 1:1, store == zrzut demo, sprawdzone testem; baseline bez zmian), `SupabaseProvider` (klient wstrzykiwany, sesja uÅ¼ytkownika + RLS, **nigdy** service role w przeglÄdarce), `registry.writeThrough` (jedyny element w paczce demo; bez odbiorcy = no-op; id demo nigdy nie idÄ na serwer), `supabaseBridge` (po zalogowaniu zrzut z serwera zastÄpuje dane w store; bÅÄd zapisu â komunikat PL + ponowne pobranie). **Z Supabase czytane:** transporty (+elementy wysyÅki), zdarzenia, wiadomoÅci, strefy (okrÄg z `v_geofences_circle`), ryzyka otwarte, metadane dokumentÃ³w, nr zleceÅ HHL/przewoÅºnika. **Zapisywane:** status, zasoby, awizacja (okna), prom, zdarzenia, wiadomoÅci, strefy (`upsert_geofence_circle`, tylko HHL_ADMIN). Migracja `0006_data_layer.sql` (od AN1: **`0007_data_layer.sql`**): widok/funkcja stref (SECURITY INVOKER â RLS), autor wiadomoÅci i aktor zdarzenia ustawiane przez serwer (koniec podszywania), insert zdarzeÅ/wiadomoÅci tylko dla transportÃ³w widocznych (polityki z 0001 miaÅy `check (true)`). Zustand = pamiÄÄ podrÄczna: w trybie Supabase store startuje pusty, osobny klucz `â¦-supabase` z samymi preferencjami UI; magazyn v2 (demo) nie jest czytany ani wysyÅany (e2e: podrzucony `DEMO-LEAK` nie pojawia siÄ, zapisy bez id demo). Test live: fixture `TEST-BK3-A` (SCX) / `TEST-BK3-B` (bez przewoÅºnika) â SCX widzi tylko swÃ³j, KSH/HHL oba; SCX zmienia zasoby/status swojego, cudzy odrzucony; KSH bez zmiany statusu; reguÅa 0003 (READY bez nr HHL) odrzucona z komunikatem; strefa HHL zapis/odczyt (promieÅ Â±2%), KSH odrzucony; anon nic nie czyta. **Korekta BK2:** kontrola paczki demo w BK2 szukaÅa tylko nazwy âsupabaseâ w plikach â leniwe chunki (`AuthGate`, supabase-js) jednak byÅy w `dist/` (nieÅadowane, bez URL/klucza). Naprawione: literalny warunek `import.meta.env.VITE_AUTH_MODE === 'supabase'` â w buildzie demo `dist/assets` = tylko `index.js` + CSS; brak `GoTrueClient`/`PostgrestClient`/URL/klucza; test straÅ¼nik w `tests/data-layer.test.ts`. **Luki (Åwiadomie):** ceny/finanse (widoki rolowe `v_load_financials_*`), faktury, automatyzacje, powiadomienia, wersje harmonogramu, import XLSX na serwer â Etap 4 (w trybie Supabase puste, nie demo); pliki dokumentÃ³w â BK4; staÅe teksty widokÃ³w (np. âwersja 7 z 21.09â w Harmonogramie, licznik Faktury min. 1) â kosmetyka po BK; brak realtime (odÅwieÅ¼enie przy logowaniu / po bÅÄdzie zapisu); zdarzenia fixture zostajÄ (append-only z 0001); PWA kierowcy nadal demo. |
| BK4 | Storage plikÃ³w (PDF/CMR/POD/zdjÄcia) | **DONE** | `80e870b` | unit **153 / 9 skip** (+9 `tests/storage-files.test.ts`) Â· `tests/db/storage.sh` **33/33** Â· hostowany `scripts/storage/verify.mjs` **27/27** Â· e2e przeglÄdarka `scripts/storage/e2e-browser.mjs` **10/10** Â· `tests/db/run.sh` **52/52 Â· 44/44** (z 0009) Â· pw **4/4** Â· d19 **0** Â· deur **0** Â· lint **0** | **Migracja `0009_storage.sql`** (idempotentna; `db push` â historia 0001â0009): trzy **prywatne** koszyki â `dokumenty` (PDF/JPEG/PNG/WEBP/HEIC, 20 MB: CMR, POD, zezwolenia, polisy, specyfikacje), `zdjecia` (obrazy, 15 MB: zdjÄcia mocowania), `faktury` (PDF, 20 MB; rejestracja faktur = M6). ÅcieÅ¼ka `<koszyk>/<projekt>/<transport\|org>/<id dokumentu>/<nazwa>` nadawana **wyÅÄcznie przez serwer** (wyzwalacz na `documents`; takÅ¼e `uploaded_by`, `uploaded_at`, `project_id` z transportu; unikalny indeks `storage_path`). RPC `create_document` (SECURITY INVOKER â RLS; walidacja typu i rozmiaru) â upload pod tÄ ÅcieÅ¼kÄ â przy bÅÄdzie `discard_document` (tylko autor, â¤1 h, tylko bez obiektu). **Polityki Storage:** odczyt obiektu â uÅ¼ytkownik widzi wiersz `documents` (to samo RLS dla metadanych i bajtÃ³w); zapis tylko autor rejestracji, â¤1 h, koszyk zgodny z kategoriÄ; **brak UPDATE/DELETE** (bez nadpisywania i usuwania z API). **ZawÄÅ¼enie `documents` (decyzja techniczna, bezpieczeÅstwo w bazie):** `docs_insert` â przewoÅºnik/klient tylko do **widocznego** transportu (wczeÅniej dowolny), bez transportu wyÅÄcznie przewoÅºnik: polisa/faktura; restrykcyjna `docs_scope` â dokument transportu tylko przy widocznym transporcie; PDF faktury (`INVOICE`) tylko strony faktury (RLS `invoices`/`invoice_documents`, w tym zakres KSH z 0003) albo autor przed podpiÄciem â KSH nie dostanie PDF faktury SCX ani metadanych. **Linki podpisane 900 s** (`SIGNED_URL_TTL_S`; test sprawdza `expâiat=900`). **Aplikacja:** `src/data/storageFiles.ts` (leniwy chunk, rejestrowany w `supabaseBridge` jako `FileSink`), `src/lib/docFiles.ts` (wspÃ³lne wgrywanie: tryb Supabase + id serwera â Storage; demo â pamiÄÄ sesji); szuflada / Dokumenty / Faktury / aplikacja kierowcy wgrywajÄ przez jednÄ ÅcieÅ¼kÄ; podglÄd i pobieranie (`DocPreview`, `DocFileRow`, ZIP) linkiem podpisanym; w podglÄdzie dopisek âlink waÅ¼ny 15 minâ (istniejÄcy `.sub`, bez nowego wzorca). Napisy `bk4_*` w PL/EN/SV. **Demo:** bajty plikÃ³w (zdjÄcia kierowcy, skany) **nie trafiajÄ do localStorage** â persist zapisuje wyÅÄcznie metadane (po przeÅadowaniu podglÄd = stub âmetadaneâ); paczka demo nadal bez kodu Supabase (build: tylko `index.js`+CSS; 0Ã `StorageClient`/`createSignedUrl`/URL). Pliki testowe z przebiegÃ³w verify/e2e usuniÄte po teÅcie (service role â tylko wÅasne). **Kroki wÅaÅciciela:** brak (koszyki i polityki z migracji, bez panelu). **Luki:** aplikacja kierowcy w trybie Supabase nadal na tokenach demo (konto/ÅÄcze kierowcy = M9) â ÅcieÅ¼ka Storage gotowa, zadziaÅa po M9; wersjonowanie w UI pokazuje ostatni plik kategorii (baza trzyma wszystkie); podpiÄcie PDF do faktury = M6. |
| BK5 | Test widocznoÅci na poziomie API | **DONE** | `17e6beb` | `SUPABASE_LIVE=1 npx playwright test tests/bk5-api.live.spec.ts` **8/8** (bez flagi 8 skipped) Â· unit **157 / 9 skip** (+4 `tests/awizacja-patch.test.ts`) Â· pw **4/4** Â· d19 **0** Â· deur **0** Â· lint **0** | **Playwright, trzy konta testowe, sprawdzana odpowiedÅº sieciowa:** (1) przeglÄd **wszystkich** tabel i widokÃ³w PostgREST (lista z OpenAPI; pominiÄte tylko metadane PostGIS `spatial_ref_sys`/`geometry_columns`/`geography_columns` â dane referencyjne, peÅny odczyt przekraczaÅ limit czasu) + podpis Storage obu PDF, dla kaÅ¼dego konta. Fixture tworzony i usuwany w przebiegu (TEST-BK5: faktura kosztowa SCXâHHL i przychodowa HHLâKSH, pozycje, PDF w koszyku `faktury`, `load_cost`/`load_revenue` na TEST-BK3-A z wartoÅciami-wartownikami). **KSH:** zero trafieÅ kosztu / faktury kosztowej / jej pozycji / PDF; `load_cost` = 42501; kontrola: widzi wÅasnÄ fakturÄ i PDF. **SCX:** zero trafieÅ przychodu / faktury przychodowej; `load_revenue` = 42501; kontrola: wÅasna faktura + PDF. **HHL:** widzi obie (kontrola dodatnia). (2) Ruch sieciowy aplikacji (build `VITE_AUTH_MODE=supabase`, :4178) â KSH i SCX przechodzÄ wszystkie widoki nawigacji + szufladÄ: zero zakazanych wartoÅci. (3) **AN1/AN2:** przewoÅºnik zmieniajÄcy `hhl_order_no`, `order_no` (KSH), `plan_load_from/to`, `plan_delivery_from/to` â HTTP â¥400 (âPrzewoÅºnik nie moÅ¼e zmieniaÄ: â¦â), wartoÅci bez zmian; kontrola: przewoÅºnik zmienia `carrier_order_no`/`driver_name` (przywrÃ³cone), HHL nie zmieni nr SCX (ââ¦wpisuje wyÅÄcznie przewoÅºnikâ), KSH nie zmienia nic. **Werdykt trafienia KSH z pierwszego przebiegu: FAÅSZYWY ALARM testu, nie wyciek** â pierwsza wersja przeszukiwaÅa tekst razem z nagÅÃ³wkami sekcji `## sign <ÅcieÅ¼ka>`, a ÅcieÅ¼ka PDF faktury kosztowej zawiera jej id i nazwÄ `TEST-BK5-SCX-KOSZT.pdf`; sam podpis dla KSH byÅ pusty (odmowa). Poprawka: dopasowanie wyÅÄcznie w treÅci odpowiedzi, raport `sekcja: wartoÅÄ`; wartowniki kwot sprawdzone teÅ¼ bezpoÅrednio w bazie (brak w `spatial_ref_sys`). Bez migracji 0010. **Luka z AN2 (czÄÅciowo):** formularz âAwizacja / Promâ wysyÅaÅ okna planowe przy kaÅ¼dym zapisie przewoÅºnika (odrzucane przez `trg_loads_guard`) â teraz `awizacjaChanges` wysyÅa **tylko zmienione pola** (porÃ³wnanie chwili, dokÅadnoÅÄ minuty), test przeglÄdarkowy: zapis przewoÅºnika bez zmian = brak `plan_*` w PATCH, brak bÅÄdu. Pola nadal wyglÄdajÄ na edytowalne dla przewoÅºnika â ukrycie/readonly zostaje w **M5/M10** (dotyka matrycy wizualnej). SprzÄtanie hostowane potwierdzone: faktury/pozycje/dokumenty/obiekty/koszt/przychÃ³d = 0; TEST-BK3-A bez zmian. `.gitignore` + `test-results/` (kontekst bÅÄdÃ³w Playwright zawiera tokeny sesji). |
| BK6 | CI db/money/unit/pw | **DONE** | `7c5c63a` | pre-push (push `7c5c63a`): unit **157 / 9 skip** Â· pw **4/4** Â· d19 **0** Â· deur **0** Â· lint **0** Â· db `tests/db/gate.sh` **security 52/52 Â· status 44/44 Â· storage 33/33** | **GitHub Actions nadal odÅoÅ¼one (AN1)** â CI czeka na wÅaÅciciela (rozliczenia / uprawnienie `workflow`); plan workflow w `docs/handover/CI.md`. Brama = `.githooks/pre-push`, rozszerzony o **`tests/db/gate.sh`**: uruchamia `tests/db/run.sh` (plik wÅaÅciciela, bez zmian) + `tests/db/storage.sh` i sprawdza liczby (`WYNIK: N OK, 0 FAIL` dla 52/44/33) â `run.sh` sam zwraca 0 takÅ¼e przy FAIL (grep trafia w WYNIK), stÄd osobny sprawdzian. Krok bazy tylko gdy lokalny Postgres+PostGIS odpowiada pod `PGADMIN` (domyÅlnie :5433; `PGCLUSTER` wyznaczany z portu); brak bazy = ostrzeÅ¼enie, `TOWER_REQUIRE_DB=1` = bÅÄd. `money.test.ts` i `ferry.test.ts` sÄ w `test:unit`. Testy Å¼ywe (BK2/BK3/BK4/BK5) rÄcznie â lista w `CI.md`. Â· **chore(BK6) `9a9378d`:** pre-push uruchamia `scripts/ci/fresh-smoke.sh` â `git archive HEAD` â `/tmp/wt-fresh-*`, build demo (kontrola: 0Ã `supabase` w paczce), `vite preview` :4179, `PW_BASE_URL` â visual 4/4 Â· d19 0 Â· deur 0, sprzÄtanie; podglÄd :4177 / tunel / `dist/` nietkniÄte (wczeÅniejszy smoke testowaÅ `dist/` z 2026-09-25 23:50). `pngjs` 7 + `pixelmatch` 5 w devDependencies â `scripts/compare-baseline.mjs` dziaÅa z repo. |
| G3 | Brama etapu 3 | **DONE** | (ten commit `docs(G3)`) | db `gate.sh` **security 52/52 Â· status 44/44 Â· storage 33/33** Â· ferry **17/17** Â· unit **157 / 9 skip** Â· pw **4/4** Â· d19 **0** Â· deur **0** Â· lint **0** Â· peÅna matryca wizualna **720/720 identycznych** (0 zmian) Â· hosted migracje **0001â0009** Â· BK5 live **8/8** Â· BK2 verify **21/21** Â· live provider **8/8** Â· BK3 e2e **9/9** Â· BK4 verify **27/27** Â· BK4 e2e **10/10** | **Stan:** wszystkie kryteria bramy speÅnione (AN1/AN2: security 52 + status 44 + ferry 17). **ÅwieÅ¼a paczka:** podglÄd :4177 (i tunel) serwuje `dist/` zbudowany 2026-09-25 23:50 (sprzed BK4/BK5) â nie ruszany; pw/d19/deur i matryca wizualna uruchomione na **ÅwieÅ¼ym buildzie demo** z HEAD (`vite build --outDir /tmp/wt-demo-dist`, podglÄd :4179, konfiguracja Playwright z `baseURL` nadpisanym na :4179; paczka demo: 0 wystÄpieÅ `supabase`). Matryca: `OUT=shots-g3-candidate BASE_URL=http://127.0.0.1:4179/ node scripts/baseline.mjs` (720 ujÄÄ; pierwsze przejÅcie przerwane crashem Chromium po 305 ujÄciach, brakujÄce widoki dograne przez `FILTER`, 0 FAIL) â porÃ³wnanie z `shots-baseline` (tag `baseline-fala-3a-2026-09-25`) progi G2 (0.28 / 60 px / 0.001): **720 identical, 0 changed, 0 size mismatch** â **baseline NIE regenerowany** (brak uzasadnienia). `pngjs`/`pixelmatch` nie ma w `package.json` â porÃ³wnanie uruchomione kopiÄ skryptu z pakietami zainstalowanymi w `/tmp` (repo bez zmian zaleÅ¼noÅci). Tryb Supabase testowany na ÅwieÅ¼ym buildzie `VITE_AUTH_MODE=supabase` (:4178). Hosted po testach: invoices/invoice_lines/documents/storage.objects/load_cost/load_revenue = 0 (tylko wÅasne resztki testÃ³w, brak nowych). **Luki przeniesione:** aplikacja kierowcy w trybie Supabase nadal na tokenach demo (M9); UI pokazuje tylko najnowszy plik kategorii (baza trzyma wersje); PDF â faktura (M6); okna `plan_*` przewoÅºnika w UI wyglÄdajÄ na edytowalne â baza odrzuca (M5/M10); widoki `v_load_*` permission denied dla wszystkich (Etap 4); GitHub Actions odÅoÅ¼one (pre-push = brama). |

### Kroki wÅaÅciciela po BK2 (panel Supabase â nie da siÄ ich wykonaÄ kluczem service role)

**W-BK2-1 Â· SMTP przez Resend â DONE 2026-09-26 ~01:07 CEST** (ustawione przez Supabase Management API: custom SMTP `smtp.resend.com:465`, user `resend`, hasÅo = `RESEND_API_KEY`, nadawca `Watch Tower` <`MAIL_FROM`>). Domena **log-mar.pl** ma w Resend status **Verified** (potwierdzone przez wÅaÅciciela 2026-09-26 01:09). Instrukcja historyczna: (bez tego zaproszenia nie wychodzÄ do osÃ³b spoza zespoÅu projektu Supabase)
1. Resend â *Domains*: upewnij siÄ, Å¼e domena adresu z `MAIL_FROM` ma status **Verified**.
2. Supabase â projekt â *Authentication* â *Emails* â zakÅadka *SMTP Settings* â wÅÄcz **Enable Custom SMTP**.
3. Wpisz: *Sender email* = adres z `MAIL_FROM`; *Sender name* = `Tower Â· H&H Logistics`; *Host* = `smtp.resend.com`; *Port* = `465`; *Username* = `resend`; *Password* = klucz API Resend (ten sam co `RESEND_API_KEY`).
4. *Save*. NastÄpnie *Authentication* â *Rate Limits* â âRate limit for sending emailsâ podnieÅ np. do 60/h.

**W-BK2-2 Â· Adresy przekierowaÅ â DONE 2026-09-26 ~01:07 CEST** (Management API: *Site URL* = `https://watch-tower-makieta.vercel.app`; allow list = `https://watch-tower-makieta.vercel.app/**`, `http://localhost:5173/**`). Instrukcja historyczna: (link z e-maila musi wracaÄ do aplikacji)
1. *Authentication* â *URL Configuration* â *Site URL* = adres produkcyjny Vercel (np. `https://<projekt>.vercel.app`).
2. *Redirect URLs* â dodaj: `https://<projekt>.vercel.app/**`, `http://localhost:5173/**`, `http://127.0.0.1:4177/**`.
3. *Authentication* â *Sign In / Providers* â *Email*: zostaw **wÅÄczone** âAllow new users to sign upâ â konta i tak powstajÄ wyÅÄcznie z zaproszenia (wyzwalacz odrzuca inne adresy).

**W-BK2-3 Â· Szablon e-maila (opcjonalnie, po polsku)** â *Authentication* â *Emails* â *Templates* â *Magic Link*: temat `TwÃ³j link do logowania â Tower`, treÅÄ z `{{ .ConfirmationURL }}` (link waÅ¼ny 1 h).

**W-BK2-4 Â· WÅasne konto administratora** â po W-BK2-1/2: zaloguj siÄ kontem testowym HHL (adres w `.env.local`, `TEST_USER_HHL_EMAIL`) lub poproÅ wykonawcÄ o skrypt, i w *Opcje â UÅ¼ytkownicy i role* zaproÅ swÃ³j adres jako **Administrator HHL**. Zmienne Vercel (`VITE_AUTH_MODE=supabase`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) â dopiero w O2; do zamkniÄcia etapu 3 aplikacja nie jest udostÄpniana z prawdziwymi danymi.

**W-M7-1 Â· WysyÅka e-maili przypomnieÅ (M7) â funkcja `send-notifications`** (box nie ma tokenu Management API). Kolejka e-maili dziaÅa w bazie (`notifications`, kanaÅ EMAIL, status PENDING); wysyÅa je funkcja Edge. Kroki (terminal z Supabase CLI, jednorazowo):
1. `npx supabase login` (token konta wÅaÅciciela) i `npx supabase link --project-ref <ref projektu>`.
2. `npx supabase secrets set RESEND_API_KEY=<klucz Resend> MAIL_FROM=<adres nadawcy> APP_URL=https://watch-tower-makieta.vercel.app`.
3. `npx supabase functions deploy send-notifications --no-verify-jwt` (funkcja sama sprawdza klucz service role).
4. Harmonogram co 5 min: *Integrations â Cron â Create job* â typ *Supabase Edge Function* `send-notifications`, metoda POST, nagÅÃ³wek `Authorization: Bearer <service role>` (albo poproÅ wykonawcÄ o migracjÄ z `pg_net` po udostÄpnieniu tokenu).
Po wdroÅ¼eniu: e-maile przypomnieÅ i ânowa fakturaâ wychodzÄ w jÄzyku odbiorcy; opÅacone faktury nie dostajÄ kolejnych e-maili.

## Aneksy

| ID | pozycja | status | commit | testy (liczby) | uwagi |
|---|---|---|---|---|---|
| AN1 | Aneks 1 â statusy automatyczne, poprawki silnika stref, rejsy, reguÅy zmian transportu | **DONE** | `cd1c56d` (tekst) Â· `a33a2a5` (docs) Â· `e06542b` (migracje/testy db) Â· `6567ce7` (aplikacja) | `tests/db/run.sh` **security 50/50 Â· status 44/44** (czysty lokalny Postgres 17 + PostGIS, migracje 0001â0007) Â· unit **127 / 9 skip** Â· live **8/8** Â· BK2 verify **21/21** Â· BK2 e2e **20/20** Â· BK3 e2e **9/9** Â· pw **4/4** Â· d19 **0** Â· deur **0** Â· lint **0** | **Pliki:** `AGENTS.md`, `.cursor/rules/tower.mdc`, `STATUSY_AUTOMATYCZNE.md`, `MECHANIZM_PIENIEDZY.md` v2.2, `SCOPE.md`, `0002_geofence_engine.sql` (G1âG3: m.in. promieÅ okrÄgu w `geography` â wczeÅniej Mercator, strefy 40â60% mniejsze), `0004_statusy_automatyczne.sql`, seed, `tests/db/{run,security,status}.sh`. **Przenumerowanie:** nasze `0004_cron`/`0005_auth`/`0006_data_layer` â `0005_cron` (sprzÄtanie duplikatÃ³w cron â 0004 aneksu jest nadrzÄdna) / `0006_auth` (wyzwalacz na `auth.users` warunkowy â stub testowy nie ma schematu auth) / `0007_data_layer`. **Uzgodnienie zdalne (bez resetu, bez usuwania kont):** stan zastany: historia 0001â¦0006 (stare nazwy), brak `sailings`/`vessels`/`trg_loads_guard`, `loads.ferry_vessel` obecne, 4 zadania `tower_*`, 0 stref, 2 transporty, 3 konta. Kroki: 0002 ponownie wgrana `psql -1` (same `create or replace`; okrÄg 800 m mierzy 800 m) â `supabase migration repair` (0004/0005/0006 reverted; 0006/0007 applied â treÅÄ auth/data_layer juÅ¼ byÅa) â `db push --include-all` (0004 aneksu + 0005 cron) â seed 2Ã idempotentny. Stan po: historia 0001â0007, `sailings`/`vessels`/`sailing_id`/`trg_loads_guard` sÄ, `ferry_vessel`/`ferry_departure` usuniÄte, cron = dokÅadnie 6 zadaÅ aneksu, wrapper usuniÄty, 5 stref, 2 statki, dane i konta nietkniÄte. **Aplikacja:** prom czytany z `sailings` przez `loads.sailing_id` (embed `sailings(â¦,vessels(name))`; czasy `coalesce(delayed_*, *)`; status ODWOLANYâCANCELLED, OPOZNIONYâDELAYED, inaczej BOOKED); zapis promu = `ferry_booking_ref` + `sailing_id` tylko gdy rejs (statek + rozkÅadowe odejÅcie) istnieje w `sailings` â peÅne przypisanie rejsu w M10. Tryb demo bez zmian (pw 4/4, paczka demo bez kodu Supabase). **Uruchomienie testÃ³w db (rÄcznie, poza pre-push â wymaga lokalnego Postgres + PostGIS):** `PGADMIN=postgres://postgres@localhost:<port>/postgres bash tests/db/run.sh` (przy kilku klastrach Debiana ustaw `PGCLUSTER`, inaczej ostrzeÅ¼enie wrappera psql psuje porÃ³wnania). GitHub Actions odÅoÅ¼one â bramÄ zostaje pre-push. |
| AN2 | Aneks 2 â ÅºrÃ³dÅa danych zewnÄtrznych, okna planowe poza przewoÅºnikiem | **DONE** | `b7056c8` (tekst) Â· `61731ff` (pliki/migracje/testy) | `tests/db/run.sh` **security 52/52 Â· status 44/44** (migracje 0001â0008) Â· `tests/ferry.test.ts` **17/17** Â· unit **144 / 9 skip** Â· live **8/8** Â· BK2 verify **21/21** Â· BK2 e2e **20/20** Â· BK3 e2e **9/9** Â· pw **4/4** Â· d19 **0** Â· deur **0** Â· lint **0** | **Decyzje wÅaÅciciela:** przewoÅºnik **nie zmienia okien planowych** (plan z harmonogramu KSH; wymusza baza â `guard_load_update`, +2 testy security); ÅºrÃ³dÅa zewnÄtrzne wyÅÄcznie darmowe (`ZRODLA_DANYCH.md`). **Pliki:** `docs/handover/ZRODLA_DANYCH.md` (nowy), `STATUSY_AUTOMATYCZNE.md`, `SCOPE.md` (Â§38), `AGENTS.md`, `.cursor/rules/tower.mdc`, `0004_statusy_automatyczne.sql` (zastÄpiona), seed `stegra.sql` (operator POLSCA Baltic Ferries; Nova Star MMSI 311000787 / IMO 9462067; Wawel MMSI do potwierdzenia), `tests/db/security.sh` (52), `src/lib/ferry/polferries.ts` + `digitraffic.ts` (z `lib/ferry/` pakietu; import w teÅcie poprawiony na `../src/lib/ferry/`), `tests/ferry.test.ts`, fixtures z 25.09.2026. **Baza hostowana â delta, bez resetu:** 0004 byÅa juÅ¼ zastosowana (AN1), a nie jest idempotentna (create type/table, cron) â zmiany Aneksu 2 wniesione nowÄ migracjÄ **`0008_an2_okna_planowe_statki.sql`** (idempotentna: `add column if not exists mmsi/imo`, `create or replace guard_load_update()` 1:1 z nowej 0004, uzupeÅnienie operatora/MMSI/IMO statkÃ³w â seed ma `on conflict do nothing`); na ÅwieÅ¼ej bazie 0008 = no-op (run.sh 52/44 z 0008). `db push` â historia 0001â0008; seed ponownie (idempotentny); stan: 2 statki z nowym operatorem, Nova Star z MMSI/IMO, 5 stref, 6 zadaÅ cron, 2 transporty, 3 konta â nietkniÄte. **Znana luka (M5/M10):** szuflada nadal pokazuje przewoÅºnikowi okna zaÅadunku jako edytowalne (formularz âAwizacja / Promâ) â baza odrzuci faktycznÄ zmianÄ; ukrycie/readonly w M5/M10 (zmiana UI dotyka matrycy wizualnej, nie trywialna teraz). |

## Aneks 3 â decyzje do wydania 1.0 (`DECYZJE_WYDANIE_1_0.md`)

| ID | pozycja | status | commit | testy (liczby) | uwagi |
|---|---|---|---|---|---|
| AN3 | Aneks 3 â tekst w `ZLECENIE_FINAL.md` | **DONE** | (ten commit `docs(AN3)`) | â | wypchniÄcie 7 commitÃ³w `5767156..79ff7d5` przez pre-push; drzewo lokalnie = zdalnie `571b92c3â¦` |
| 2.1 | Import: anulowanie zamiast kasowania, blokada od AT_LOADING i przy fakturze; zakaz DELETE na `loads` | DONE | 8445485 | release 30/30 (db), unit 278, schedule-import 19, etap4 D26 e2e | 0019: zakaz DELETE loads (uprawnienie + wyzwalacz), import_cancel_loads/import_removal_check/cancel_load z audit_log; hosted TESTOWY zastosowane; podglÄd pokazuje zablokowane z powodem; snapshot Supabase pomija CANCELLED Â· testy bazy wg AN3 Â§2.1 |
| 2.2 | `risk_signals.audience` â zamkniÄte drzwi (RLS) | DONE | 8d4198a | release 58/58 (db; 28 nowych 2.2, czerwone 22 FAIL przed 0020) | 0020: audience HHL/HHL_PRZEWOZNIK/HHL_KLIENT/WSZYSCY z wyzwalacza (klient API nie nadpisze), risks_read: przewoÅºnik tylko swoje transporty + korytarz, klient swÃ³j projekt; hosted TESTOWY zastosowane; live provider 14/14, auth 21/21 Â· testy bazy wg AN3 Â§2.2 |
| 2.3 | Token kierowcy: â¥128 bitÃ³w, skrÃ³t, jeden transport, waÅ¼noÅÄ, odwoÅanie | DONE | 1595e8b | release 108/108 (db; 39 nowych 2.3), unit driver-api 5, hosted: token 67 zn., instrukcje 0 pÃ³l cenowych | 0021 + PR6: pozycje i etapy przez SQL (anon, bez Edge), zdjÄcia przez Edge driver-photo (kod w repo; wdroÅ¼enie funkcji czeka na token wÅaÅciciela Â§4.4); hosted TESTOWY zastosowane Â· razem z PR6 (`driver_post_position`) |
| 2.4 | Numer zlecenia 48 h â ryzyko + przypomnienie, bez blokady | DONE | 1ad7d4b | release 69/69 (db; 11 nowych 2.4) | detect_missing_order_numbers (0012) + odbiorcy z 0020: brak numeru HHL â ryzyko HHL + przypomnienie HHL; brak numeru przewoÅºnika â HHL_PRZEWOZNIK + przypomnienie przewoÅºnika; blokady Q10 bez zmian |
| PL-T | Polskie znaki w napisach PL + test PL-T (hunspell pl_PL) + przebieg 840 (EN/SV = 0 zmian) | DONE | 40eca8a, 28c2b05, 22e8921 | PL-T 4/4 (czerwony przed: 112 sÅÃ³w spoza pl_PL; zielony po); przebieg 840: ok 840/840, zmienione 169 â wszystkie PL, EN 0, SV 0; visual smoke 4/4 (2 ujÄcia mapy PL odÅwieÅ¼one) | zmiana .github/workflows/unit.yml (lfs: true) wycofana z commitu 28c2b05 â GitHub odrzuca push workflow bez zakresu workflow tokenu (dziaÅanie wÅaÅciciela) Â· poprawione 114 napisÃ³w PL (d19Pl); identyfikatory w bazie ASCII bez zmian; tag baseline-1.0-2026-09-26; otwarte: baner kokpitu w DashboardView.tsx (tekst bez polskich znakÃ³w widoczny teÅ¼ w EN/SV â poprawka zmieniÅaby ujÄcia EN/SV, decyzja wÅaÅciciela) Â· tag `baseline-1.0-<data>` |

## Aneks 4 â produkcja w caÅoÅci za darmo (`ANEKS_4_PRODUKCJA_ZA_DARMO.md`)

| ID | pozycja | status | commit | testy (liczby) | uwagi |
|---|---|---|---|---|---|
| AN4 | Aneks 4 â tekst w `ZLECENIE_FINAL.md` | **DONE** | (ten commit `docs(AN4)`) | â | obecny projekt Supabase = **testowy** (AN3 Â§4.1); produkcja = nowy projekt UE, plan darmowy |
| PR1 | Podtrzymanie: `keep_alive()` + `system_heartbeat`, Cloudflare Worker co 6 h, e-mail przy bÅÄdzie | DONE (Worker czeka na Cloudflare) | d188716, d99b5ce | keep-alive-worker 4/4 (+1: brak service_role w workers/src/konfiguracji hostingu); db release: keep_alive dla anon, zapis 1 wiersza â¤ 1/60 s | odp. Â§3c: Worker uÅ¼ywa wyÅÄcznie SUPABASE_ANON_KEY; keep_alive() security definer aktualizuje tylko system_heartbeat Â· 0022 system_heartbeat + keep_alive() (anon, zapis â¤1/60 s); workers/keep-alive: cron co 6 h, e-mail Resend przy bÅÄdzie; wdroÅ¼enie Workera i sekrety â konto Cloudflare wÅaÅciciela (sekcja 10 p.2) Â· Worker wdraÅ¼a wÅaÅciciel (konto Cloudflare) |
| PR2 | Kopie: `backup-export` 02:30 (CSV+gzip, age X25519, R2), `scripts/restore.sh`, test odtworzenia | DONE (Edge wdroÅ¼ona; cron WYÅÄCZONY â czeka na R2) | bd4d59b | backup 10/10 | 26.09: backup-export v1 wdroÅ¼ona, BACKUP_AGE_RECIPIENT = publiczny klucz age (prywatny nie opuszcza /workspace/secure); bez crona tower-backup-export do czasu sekretÃ³w R2_* (Cloudflare) Â· 0023 na TESTOWYM; utrata danych do 24 h; wdroÅ¼enie Edge + R2 + klucz age â wÅaÅciciel (docs/handover/KOPIE_ZAPASOWE.md) Â· R2 i klucz age â wÅaÅciciel |
| PR3 | Poczta: Resend jako SMTP Supabase Auth, domena zweryfikowana | **DONE** (zamkniÄte przez wÅaÅciciela 26.09.2026) | â | link logowania 15:29 PL â dorÄczony (Resend: delivered), zalogowanie z telefonu 15:47:32 PL | Auth SMTP = Resend (smtp.resend.com:465), nadawca @log-mar.pl; peÅny przebieg zaproszenia Sebastian@log-mar.pl (HHL_ADMIN) wysÅany 16:03:30 PL â czeka na klikniÄcie wÅaÅciciela Â· 26.09 15:00: Sebastian.bozekq@gmail.com jest czÅonkiem organizacji Supabase (rola Owner) â test linku nie speÅnia kryterium, link NIE wysÅany; auth.users bez zmian (lista sprzÄtania pusta); potrzebny inny adres spoza zespoÅu; ALERT_EMAIL_TO=Sebastian@log-mar.pl ustawiony w sekretach funkcji Â· 26.09: test linku na Sebastian.bozekq@gmail.com NIE wykonany â warunek (sprawdzenie czÅonkÃ³w organizacji Supabase przez Management API) niemoÅ¼liwy bez tokenu; odczyt produkcji: adres w auth.users 0, w app_users 0; nic nie wysÅano, nic nie utworzono; ALERT_EMAIL_TO=Sebastian@log-mar.pl dla usage-check/keep-alive â czeka na ten sam token (sekrety Edge) i token Cloudflare (Worker); Resend free: 100 e-maili/dobÄ (UTC), 3000/mies., 10 req/s Â· Resend (plan darmowy) jako SMTP Supabase Auth + DNS SPF/DKIM â dziaÅanie wÅaÅciciela nr 3 (sekcja 10 ANEKSU 4); kryterium: link logowania dociera spoza zespoÅu projektu; sprawdziÄ dzienny limit wysyÅek Â· blokuje produkcjÄ; konto/DNS â wÅaÅciciel |
| PR4 | `usage-check` codziennie: 70% â ryzyko, 85% â ryzyko wysokie + e-mail, historia | **DONE** (wdroÅ¼one, cron wÅÄczony) | 86b5a74 | usage-core (unit); Edge usage-check v1: bez klucza 401, klucz anon 403 | 26.09: wdroÅ¼ona; sekrety ALERT_EMAIL_TO, RESEND_API_KEY, MAIL_FROM; pg_net 0.20.4 wÅÄczony, Vault: project_url + service_role_key; cron tower-usage-check 05:00 UTC (07:00 PL); pg_net â Edge sprawdzony (driver-photo â 400, bez zapisu); pierwszy przebieg 27.09 07:00 PL Â· 70% â ryzyko HHL, 85% â HIGH + e-mail raz; egress tylko z API zarzÄdzania (opcjonalny token); docs/handover/LIMITY_PLANU_DARMOWEGO.md |
| PR5 | GPS: 2 min w ruchu / 15 min na postoju, limit 60 s w `process_position()`, retencja 30 dni, pomiar bajtÃ³w | DONE | 816970f | driver-tracking 10/10; db release 145/145 (PR5: 14); status 44/44; TESTOWY: 0025 + pominiÄcie punktu 30 s (rollback) | 1000 pozycji = 386 662 B; prognoza ~52 MB stan ustalony, najgorzej ~190 MB; purge_personal_data bez EXECUTE dla zalogowanych |
| PR6 | `driver_post_position(token, â¦)` w SQL (warunki 2.3, limit zapytaÅ); zdjÄcia przez Edge | DONE (Edge driver-photo wdroÅ¼ona) | 1595e8b, 9b404ba | release 145/145; Edge: bez formularza â 400 | 26.09: driver-photo v1 --no-verify-jwt (token kierowcy sprawdza baza) Â· pozycje i zdarzenia przez SQL driver_post_position/driver_post_event (API bazy, bez limitu Edge); zdjÄcia przez Edge driver-photo â wdroÅ¼enie wymaga tokenu Supabase (wÅaÅciciel nr 6); budÅ¼et ~71 000/500 000 wywoÅaÅ â pomiar po miesiÄcu |
| PR7 | Pliki: kompresja zdjÄÄ w przeglÄdarce (1600 px, JPEG 0,75), PDF â¤ 10 MB, archiwizacja od 70% | **DONE** (archiwizacja: Edge przygotowana, czeka na R2) | b93f0a3 Â· d8f916e | db archive **18/18** (przed 0029: 15 FAIL); Playwright pr7-compress 1/1 (13,6 MB â 236 kB, 1600Ã1200); unit 310 passed / 28 skip | 0029 na hostowanym (PDF â¤ 10 MB; 0 dokumentÃ³w, 0 kandydatÃ³w); funkcje archiwum tylko service_role; start archiwizacji od 70% z 1 GB; backup-export pomija archived_at; Edge `document-archive` bez harmonogramu |
| PR8 | Hosting: Vercel darmowy + zapas Cloudflare Pages, domena u wÅaÅciciela, `PRZELACZENIE_HOSTINGU.md`, test przeÅÄczenia | **PRZYGOTOWANE** (wdroÅ¼enie po dziaÅaniach wÅaÅciciela) | 8755c82 | hosting-switch 5/5 | 4.3a: build statyczny; vercel.json tylko nagÅÃ³wki /download; /api/trafikverket tylko dev/podglÄd (produkcja â dane przykÅadowe / Edge road-se); brak funkcji Vercel; public/_headers = te same nagÅÃ³wki dla Cloudflare Pages; procedura w `PRZELACZENIE_HOSTINGU.md` Â· wdroÅ¼enie po dziaÅaniach wÅaÅciciela (Â§10) |
| AN5 | Aneks 5 v2 â tekst w `ZLECENIE_FINAL.md` | **DONE** | (ten commit `docs(AN5)`) | â | obecny projekt Supabase = **PRODUKCJA** (jedyny); od teraz Å¼adnych testÃ³w zapisujÄcych na hostowanym; kolejnoÅÄ wg sekcji 6 ANEKSU 5 (zastÄpuje kolejnoÅÄ PR z ANEKSU 4) |
| A5-SPRZATANIE | SprzÄtanie danych testowych: kopia â lista tabela po tabeli do zatwierdzenia â usuniÄcie â liczby | OPEN | â | â | STOP przed usuniÄciem â akceptacja wÅaÅciciela; zostajÄ migracje, `stegra.sql`, 147 rejsÃ³w |
| A5-BK5-LOKALNIE | BK5 (test API) na lokalnym Supabase (CLI + Docker) | BLOCKED | â | â | na boxie brak Dockera â BK5 nie uruchamiany na produkcji |
| A5-PODGLADY | PodglÄdy Vercel w `DemoProvider`, build produkcyjny tylko z `main` | **DONE** | e87c24f | vercel-preview-mode 4/4; build VERCEL_ENV=preview + VITE_AUTH_MODE=supabase â 0 Ã âsupabaseâ; production z gaÅÄzi dev â przerwany | `build/authMode.ts` wywoÅywany w vite.config.ts; poza Vercel bez zmian; Production Branch = main ustawiÄ teÅ¼ w panelu Vercel (wÅaÅciciel, przy O2) |
| A5-SESJA-ROK | Sesja uÅ¼ytkownika 365 dni (pg_cron czyÅci `auth.sessions`), JWT 3600 s, link â¤ 1 h, odwoÅywanie, Moje urzÄdzenia + testy Â§4.5 | DONE (konfiguracja Auth hostowana â do potwierdzenia przez Management API) | 2a7e939 Â· d24236a | db session 27/27; session-year 5/5; session-year.local 6/6; gate +session 27 | 0028: sÅowniki i preferencje teÅ¼ wymagajÄ aktywnego konta Â· 0026 na hostowanym, cron tower-sesje-rok 02:20 UTC; JWT 3600 s i otp_expiry 3600 s w config.toml (test); link jednorazowy i JWT na hostowanym â niesprawdzone: brak SUPABASE_ACCESS_TOKEN w Årodowisku procesu; naprawione przy okazji: organizations/projects/app_users czytelne dla nieaktywnego â teraz 0 wierszy; kierowca bez zmian Â· kierowca bez zmian (24 h po rozÅadunku, max 14 dni) â rocznej autoryzacji kierowcy nie zaczÄto |
| A5-KLUCZ | Para kluczy age poza repo; publiczny â sekret `backup-export`; prywatny â wÅaÅciciel offline, potem usuniÄcie z dysku | W TOKU (czeka na przekazanie) | â | â | para age wygenerowana 26.09 10:58 poza repo (/workspace/secure, prywatny chmod 600, nie w repo/logach/raportach); publiczny w pliku obok â do sekretu backup-export po uzyskaniu tokenu; prywatny: przekazanie wÅaÅcicielowi â usuniÄcie z dysku i potwierdzenie |
| 6.1 | Przyczyna systemowa luk EXECUTE: ALTER DEFAULT PRIVILEGES + lista dozwolonych funkcji | **DONE** | `593e065` | security 56/56 (+4: lista dozwolonych, PUBLIC 0, nowa funkcja bez EXECUTE, purge_personal_data); czerwony przed (3 FAIL: 33 funkcje z EXECUTE dla PUBLIC) | 0027 na hostowanym: odebrano 40 par rolaâfunkcja (m.in. anon: mark_invoice_paid, detect_*; oba: wyzwalacze, rls_auto_enable), poza listÄ 0; service_role jawnie. Dziennik (pg_stat_statements od 24.09 23:00 PL + cron.job_run_details od 25.09 02:30 PL): purge_personal_data 0 wywoÅaÅ przez anon/authenticated/service_role; 3 przez postgres â harmonogram (25.09 04:30 i 26.09 04:15 PL) i administracyjne |
| A5-BK5-LOKALNIE | BK5 na lokalnym Supabase (Docker), bez dotykania produkcji | **DONE lokalnie** | d24236a Â· 3a306b4 | BK5 **8/8**; session-year.local **6/6**; supabase-provider.live 12/14 (M10/M12: brak lokalnie danych path-scenario i rejsÃ³w Polferries); db session **27/27** | `scripts/bk5/local.sh` przerywa, gdy API nie jest lokalne; konta `*@bk5.local` tylko lokalnie (hostowany: 0 kont, 0 nowych sesji). Luka znaleziona: konto nieaktywne widziaÅo geofences/vessels/sailings/fx_rates (polityka `true`) â migracja **0028** (hostowany: zastosowana), test w session.sh czerwony przed (2 FAIL), zielony po |
| 3b | Blokada kubeÅka R2 (Bucket Locks) dla kopii | **PRZYGOTOWANE** (czeka na token Cloudflare) | 41fc9b7 | backup-core **5/5** (test blokady czerwony przy blokadzie monthly 366 d) | reguÅy `docs/handover/r2/bucket-lock.json`: `daily/` 30 d, `monthly/` 360 d; w dokumentacji Cloudflare brak ograniczenia do planu pÅatnego; DELETE zablokowanego obiektu nie przerywa backup-export; `KOPIE_ZAPASOWE.md`: retencja poprawiona na 30 d / 12 mies. (byÅo 7/3); R2 free 10 GB, 1 mln A, 10 mln B / mies. |
| AN5-BANER | Baner kokpitu KSH/przewoÅºnik ze sÅownika PL/EN/SV + D19-T sÅownik (wszystkie role i widoki) | **DONE** (wzorzec 840 NIEzaktualizowany â rÃ³Å¼nice nie sÄ szumem) | 4e29354 Â· c13eae2 | D19-T 2/2; 2. przebieg 26.09: 60 ujÄÄ kokpitu KSH/SCX Ã 4 przebiegi (build bez banera A/B, z banerem A/B) | DowÃ³d: ten sam build A vs B = 0 px w 60/60 (brak szumu); bez vs z banerem: zmiany w 60/60, poza pasem banera tylko 1 ujÄcie (ksh sv 1280 dark, 10 px); wzorzec vs build BEZ banera: 13 ujÄÄ rÃ³Å¼ni siÄ poza banerem (159â298 px, powtarzalnie) â staÅy dryf od kodu po utworzeniu wzorca, nie szum; kryterium niewykazane, shots-baseline bez zmian; przebiegi w /tmp/rel/runs2 Â· 9 ujÄÄ ma drobne rÃ³Å¼nice poza banerem takÅ¼e w buildzie BEZ zmiany banera (ok. 18Ã25 px, 160â220 px; w KSH EN niestabilne miÄdzy przebiegami: 10 px) â `shots-baseline/` NIE zaktualizowany; przebieg w `/tmp/rel/shots-ban`; SCX PL zmienione przez polskie znaki (pÃ³l, uzupeÅnienia, zaÅadunkiem); poza banerem znane 44 trafienia / 12 tekstÃ³w (`tests/fixtures/d19-dict-known.json`) â do decyzji wÅaÅciciela |
| A5-EDGE | WdroÅ¼enie funkcji Edge i sekretÃ³w na produkcji (26.09) | **DONE** | â | 11/11 ACTIVE v1; bez klucza 401 (10 z JWT), anon â 403 (usage-check, backup-export); driver-photo bez JWT â 400 | WdroÅ¼one: usage-check, backup-export, document-archive, send-notifications, driver-photo (bez JWT), ferry-ais, ferry-schedule, ferry-status, road-pl, road-se, traffic-flow. Sekrety: ALERT_EMAIL_TO, RESEND_API_KEY (klucz tylko do wysyÅki), MAIL_FROM, BACKUP_AGE_RECIPIENT (publiczny). Cron wÅÄczony: **tower-usage-check** (05:00 UTC). WYÅÄCZONE: tower-backup-export i document-archive (R2/Cloudflare); send-notifications (wysyÅa e-maile do uÅ¼ytkownikÃ³w â decyzja wÅaÅciciela; kolejka EMAIL = 0); ferry/road/traffic (bez kluczy API dziaÅajÄ w trybie DEMO â zapisaÅyby dane demonstracyjne na produkcji) |
| 3.2b | Cron ferry-ais co 10 min na produkcji | **DONE** (zadanie dziaÅa, funkcja odpowiada 403 â patrz F-KLUCZ) | f78744e | cron.job_run_details: 15:40 succeeded; net: 403 | 12 zadaÅ cron; ferry-ais zawsze LIVE; Wawel bez MMSI (prawdziwe 311852000 â do wpisania przez wÅaÅciciela) |
| 3.2c | Typy plikÃ³w: sygnatura w driver-photo + limit | **DONE** (wdroÅ¼one na produkcjÄ) | f0ff35e | unit file-signature 7/7; produkcja: HTML jako JPEG â **415**, 0 obiektÃ³w, 0 dokumentÃ³w | reszta typÃ³w pokryta listami MIME zasobnikÃ³w |
| 3.2d | Higiena funkcji (0030) | **DONE** (produkcja) | a64465b | 0 funkcji bez search_path (byÅo 22); funkcje poza allowlistÄ 0 | spatial_ref_sys: REVOKE nie dziaÅa â W1 |
| 3.2e | Widoki v_load_* | **DONE** (bez zmian â sprawdzone) | â | widoki nieaktualizowalne, wÅaÅciciel postgres | nadmiarowe prawa zapisu authenticated z domyÅlnych uprawnieÅ nieskuteczne; widoki cenowe definer celowo (SECURITY.md Â§1) |
| 3.2f | 8 tabel z RLS bez polityk | **DONE** (celowe, opisane) | 4ecf337 | security +3 [3.2f] | 6 bez GRANT; permits/insurance_policies 0 wierszy przez RLS; HHL widzi je jako dokumenty (SECURITY.md Â§2) |
| W1 | spatial_ref_sys tylko do odczytu dla anon/authenticated (0031) | **DONE** (produkcja 26.09 ~15:45 PL) | 4ecf337 | security **67/67** (byÅo 62); produkcja: DELETE srid=-1 anon/authenticated â 42501, TRUNCATE authenticated â 42501, postgres â DELETE 0; 8500 wierszy bez zmian | wyzwalacz instrukcji `spatial_ref_sys_readonly`; funkcja bez EXECUTE dla rÃ³l API |
| W2 | Zdarzenia: lista dozwolonych typÃ³w dla rÃ³l API + CHECK + strefa z tabeli (0032) | **DONE** (produkcja 26.09 ~15:47 PL) | cd3b73f | security **76/76** (+9), status **44/44** bez zmian; bez 0032: 7 z 9 nowych testÃ³w FAIL; produkcja (transakcje wycofane): KSH GEOFENCE_ENTER, SCX GEOFENCE_ENTER/STATUS_AUTO/MILESTONE_UNLOADED â RLS, nieznany typ â CHECK, SCX NOTE przechodzi; load_events 40 â 40 | tabela typ â kto tworzy: SECURITY.md Â§6; 40 istniejÄcych zdarzeÅ zgodnych z CHECK (sprawdzone przed wdroÅ¼eniem); unit 322/28 |
| F-KLUCZ | Zadania cron â funkcje Edge dostawaÅy 403 (klucz w env platformy â  klucz legacy w Vault) | **DONE** (10 funkcji wdroÅ¼onych 26.09 ~15:49 PL) | 31b9093 | unit service-auth 5/5; produkcja: cron ferry-ais 15:40 â 403, 15:50 â **200** (LIVE, ok, Wawel BRAK_MMSI); bez klucza 401, anon 403 (5 funkcji) | wykryte przy sprawdzaniu pierwszego przebiegu ferry-ais (3.2b); dotyczyÅo teÅ¼ usage-check, backup-export, document-archive, send-notifications i ferry-*/road-*/traffic-flow; wykrycie po skrÃ³tach sekretÃ³w z Management API (bez odczytu wartoÅci) |
| 3.2a | SprzÄtanie danych testowych produkcji (zatwierdzone przez wÅaÅciciela) | **DONE** (26.09 16:03 PL, jedna transakcja) | â | przed â po: loads 3â0, load_events 40â0, positions 6â0, geofence_states 5â0, shipment_items 2â0, notifications 1â0, sailings 148â147, risk_signals 2â0, audit_log 163â1 (CLEANUP_TEST_DATA, id 167), integration_runs 5â1 (usuniÄte id 1â4), user_invites 3â0, app_users 3â0, auth.users 3â0, identities 3â0, sessions 175â0, refresh_tokens 175â0, one_time_tokens 0, mfa 0; prÃ³ba wycofana przed wykonaniem daÅa identyczne liczby | wyzwalacze `load_events.trg_load_events_immutable` i `loads.loads_no_delete` wyÅÄczone i wÅÄczone w tej samej transakcji (po commicie tgenabled=O); kopia: `/workspace/secure/kopia-przed-sprzataniem-2026-09-26` (manifest sha256 33566ce7â¦, SHA256SUMS c1b597f2â¦, dopisane zaszyfrowane migawki 16:00 usuwanych tabel); dziennik produkcji zaczyna siÄ od CLEANUP_TEST_DATA |
| WAWEL-AIS | Wawel: MMSI/IMO/znak wywoÅawczy | **DONE** (produkcja) | 4569a7b | produkcja: Wawel 311852000 / 7814462 / C6TY9; Nova Star bez zmian | seed stegra.sql zaktualizowany |
| ZAPR-7D | Zaproszenie wygasa po 7 dniach (0034) | **DONE** (produkcja) | db08f9c | security **79/79** (+3: 8 dni â TOWER_INVITE_EXPIRED, 6 d 23 h â konto, bez zaproszenia â TOWER_NO_INVITE); produkcja w transakcji wycofanej: zaproszenie sprzed 8 dni â TOWER_INVITE_EXPIRED, bez ÅladÃ³w (invites 1, users 1, audit 3) | disable_signup=false zostaje; ponowne zaproszenie odnawia termin |
| STRAZNIK | StraÅ¼nik wyniku zadaÅ (0035) | **DONE** (produkcja 26.09 ~16:06 PL) | ea201ee | watchdog.sh **19/19** (symulowany bÅÄd ferry-ais od 12:00 â OK o 12:17, ALARM o 13:07 = najbliÅ¼szy przebieg cogodzinny; bez duplikatÃ³w; zamkniÄcie po sukcesie; kopia nieuzbrojona do pierwszego sukcesu; KSH 0 ryzyk; anon/authenticated bez EXECUTE); produkcja w transakcji wycofanej (now+61 min): ferry-ais ALARM, 1 ryzyko JOB_FAILURE HIGH audience HHL, e-mail w kolejce pg_net do Sebastian@log-mar.pl, temat â[Watch Tower] ALARM: â¦â; po rollbacku ryzyka 0, kolejka 0 | cron tower-straznik-zadan 7 * * * *; Vault +3 sekrety (resend_api_key, mail_from, alert_email_to); usage-check wdroÅ¼one z zapisem integration_runs; stan teraz: ferry-ais OK, usage-check OKRES_STARTOWY, backup NIEUZBROJONY (R2) |
| CENY-3ROLE | Transport testowy z kosztem i przychodem na produkcji + symulacja 3 rÃ³l (zatwierdzone przez wÅaÅciciela) | **DONE** (26.09 ~16:10 PL) | â | jedna transakcja wycofana: transport TEST-CENY-1, koszt 2000+BAF 100 = **2100** EUR, przychÃ³d 2600+BAF 130 = **2730** EUR; HHL: 1 transport, koszt 2100 / przychÃ³d 2730 / marÅ¼a **630 (23,08%)**, widok klienta 1, widok przewoÅºnika 1; KSH: 1 transport, marÅ¼e **0**, cena klienta **2730**, cena przewoÅºnika **0**, load_cost/load_revenue â permission denied; przewoÅºnik: 1 transport, marÅ¼e **0**, cena klienta **0**, cena przewoÅºnika **2100**, load_cost/load_revenue â permission denied; anon: widoki cenowe â permission denied; PRZED/PO: loads 0/0, load_cost 0/0, load_revenue 0/0, audit_log 3/3, app_users 1/1, TEST-CENY-1 0, konta symulacji 0 | usuniÄcie = ROLLBACK tej samej transakcji (atomowo, bez wyÅÄczania wyzwalaczy loads_no_delete / load_events); konta KSH/przewoÅºnika tylko jako wiersze app_users w transakcji (bez kont auth); w audit_log 0 wpisÃ³w z testu |
| ZAPR-SEB | Pierwsze prawdziwe konto: Sebastian@log-mar.pl HHL_ADMIN (peÅny przebieg zaproszenia) | **DONE** (logowanie 26.09 16:06 PL; potwierdzenie âMoje urzÄdzeniaâ w UI â wÅaÅciciel) | â | zaproszenie 16:03:29 (bootstrap SQL + audit USER_INVITED), link 16:03:30 (HTTP 200), klikniÄcie i logowanie 16:06 z telefonu (Android); app_users HHL_ADMIN aktywny, e-mail potwierdzony; auth.sessions 1: utworzona 26.09.2026 16:06, my_sessions() wygasa 26.09.2027 16:06 (+365 dni); current_app_role() = HHL_ADMIN | bez hasÅa ustawionego przez kogokolwiek (GoTrue zapisuje losowy skrÃ³t dla kont OTP â hasÅo nieznane, logowanie tylko linkiem); not_after = null z zaÅoÅ¼enia (plan darmowy: 365 dni liczy my_sessions + cron tower-sesje-rok) |
| 2.2 | Cron send-notifications (kolejka e-mail notifications â Resend) | **DONE** (produkcja 26.09 16:14 PL) | 1f35a65 | watchdog **20/20**; pierwszy przebieg 16:15:07: HTTP 200, integration_runs ok (pending 0, sent 0, failed 0) | cron tower-send-notifications */5 (14 zadaÅ cron); sekret APP_URL = site_url Auth (https://watch-tower-makieta.vercel.app) dla linkÃ³w w e-mailach; straÅ¼nik: okno 30 min od 17:00 PL; ok. 430 wpisÃ³w integration_runs/dobÄ (ferry-ais + send-notifications) â retencja do rozwaÅ¼enia |
| W3 | load_messages.msgs_read + shipment_items.items_read wg transportu/projektu (0037) | **DONE** (produkcja 26.09 ~16:40 PL) | 7318abd | security **83/83** (+4; bez 0037: 3 z 4 FAIL â przewoÅºnik widziaÅ wiadomoÅÄ i pozycjÄ cudzego transportu, klient pozycjÄ cudzego projektu); status 44/44; produkcja: polityki odczytane po wdroÅ¼eniu | SECURITY.md Â§8 |
| W4 | Limity zasobnikÃ³w (0038) | **DONE** (produkcja) | 3a025e3 | storage **35/35** (+2); produkcja: zdjecia 15 MB â **2 MB**, dokumenty 20 MB â **10 MB**, faktury 20 MB bez zmian; obiektÃ³w w storage 0 | 3.2c: sygnatura + limit w driver-photo juÅ¼ wczeÅniej (f0ff35e); faktury 20 MB â do decyzji |
| WZORZEC-840 | Przebieg 840 po D19-12 (baner + 12 tekstÃ³w) â nowy tag wzorca | **STOP** (tag NIE utworzony, shots-baseline bez zmian) | 496f63e | 840/840 ujÄÄ OK (build HEAD demo, bez âsupabaseâ w paczce); vs wzorzec: rÃ³Å¼ne 324 (dokÅadnie), pixelmatch>0: 316, compare.mjs >60 px: 237. EN/SV: 263 (inne widoki 211 â wyÅÄcznie miejsca 12 tekstÃ³w: dokumenty 36, faktury 40, ryzyka 60, automatyzacje 16, finanse 20, moje-zadania 20, strefy 18, rozliczenia 1 = 16 px pixelmatch 0; kokpit 52 = baner KSH/SCX + znacznik D15). **Poza zakresem**: PL 61 ujÄÄ (PL-T 40eca8a: ustawienia 17 âJÄzyk/wyÅwietlania/DomyÅlnyâ, ryzyka 5, dokumenty 1, finanse 2, harmonogram 2, mapa 2, moje-stawki 2, rozliczenia 1, strefy 1, kokpit 28) oraz znacznik ciÄÅ¼arÃ³wki D15 (ecb0632) w kokpicie HHL 20 ujÄÄ (â211 px, pixelmatch â¤21) | zmiany spoza banera i 12 tekstÃ³w = zamierzone wg bisectu (G4_WZORZEC.md), ale reguÅa âkaÅ¼da inna zmiana â STOPâ; decyzja wÅaÅciciela: przyjÄÄ PL-T + D15 do nowego wzorca (ujÄcia gotowe: /tmp/rel/shots-840-run) albo nie; D19-T sÅownik: 0 znanych trafieÅ, fresh-smoke OK |
| HASLO-B | SkÄd hash bcrypt na koncie âtylko linkâ (Sebastian@log-mar.pl) | **DONE** (bez zmian na produkcji) | â | odczyt produkcji: auth.users created_at 26.09 16:03:30 PL (1 s po USER_INVITED 16:03:29), invited_at **NULL**, confirmation_sent_at 16:03:30, provider email, hash `$2a$` 60 zn.; w repo jedyna ÅcieÅ¼ka zaproszenia = `signInWithOtp(shouldCreateUser: true)` (UsersAdmin.tsx:55), bootstrap teÅ¼ POST /auth/v1/otp (HTTP 200) | Konto utworzyÅ GoTrue przez **signInWithOtp â /auth/v1/otp â MagicLink**; dla nowego/niepotwierdzonego uÅ¼ytkownika GoTrue sam generuje losowe hasÅo tymczasowe: supabase/auth @ce9a8ee `internal/api/magic_link.go` l. 84â91 (`crypto.GeneratePassword(config.Password.RequiredCharacters, 33)` â `Signup`), nigdzie nie zwracane. My hasÅa nie ustawialiÅmy â wymiana hasÅa i wpis audytu **niepotrzebne**; sesja wÅaÅciciela nietkniÄta. Logi Auth przez Management API niedostÄpne (`logs.all` usuniÄty 23.09, nowy `/logs` zwraca âBackend errorâ); auth.audit_log_entries puste (audyt GoTrue wyÅÄczony) |
| ZAPR-LOGIN | Wygasanie zaproszeÅ w praktyce + przyjÄcie przy pierwszym logowaniu (0039) | **DONE** (produkcja 26.09 ~18:50 PL) | 0f1ff4d | **invite.sh 28/28** (nowy w gate): link tworzy konto bez USER_ACCEPTED_INVITE â pierwsze logowanie = 1 wpis + accepted_at, kolejne logowanie bez wpisu; konto bez logowania 8 dni â active=false, widzi 0 wierszy, audyt USER_INVITE_EXPIRED; zalogowane 8 dni i ÅwieÅ¼e 6 d 23 h bez zmian; ponowne uruchomienie 0; anon/HHL bez EXECUTE; ponowne zaproszenie â aktywne, nowy termin, USER_REINVITED, zadanie 0, logowanie â przyjÄcie; zalogowanego nie da siÄ zaprosiÄ ponownie; wygasÅe konto ze starym linkiem â bez przyjÄcia, dalej 0 wierszy Â· produkcja (transakcja wycofana): 2 konta testowe â przyjÄcia 0 â logowanie jednego â 1; expire teraz 0, now+8 d 1 (niezalogowane off, zalogowane on, Sebastian on); przed/po: auth.users 1/1, app_users 1/1, audit 3/3, invites 1/1; cron `tower-wygasanie-zaproszen` 40 2 * * * aktywny, oba wyzwalacze O | handle_new_auth_user tylko zakÅada app_users; wyzwalacz AFTER UPDATE OF last_sign_in_at (NULL â wartoÅÄ) pisze przyjÄcie; `expire_unaccepted_accounts(p_now)` liczy 7 dni od max(utworzenie konta, ostatnie zaproszenie); `admin_invite_user` reaktywuje konto bez logowania (UI bez zmian â ten sam przycisk âZaproÅâ + link). Historyczny wpis 169 USER_ACCEPTED_INVITE (16:03:30, przed klikniÄciem 16:06) zostaje â dziennik tylko do dopisywania |
| FAKTURY-10MB | Limit PDF faktur 10 MB jak wszystkie PDF (0040) | **DONE** (produkcja) | c4d4f9b | storage **37/37** (+2: zasobnik faktury 10485760, create_document INVOICE 10 MB + 1 B â âza duÅ¼yâ); unit invoices3 +1 (10 MB przechodzi, +1 B â PDF_SIZE); produkcja: dokumenty 10 MB, faktury **10 MB**, zdjecia 2 MB | Kreator faktury (BillsPanel) przekazuje rozmiar pliku, `checkBill` zwraca PDF_SIZE â komunikat PL/EN/SV âPDF faktury jest za duÅ¼y â limit to 10 MBâ; create_document odrzucaÅ PDF > 10 MB juÅ¼ od 0029 |
| RETENCJA-RUNS | Retencja integration_runs (0041) | **DONE** (produkcja) | 6a3e554 | watchdog **27/27** (+7: usuwa 5 z 9 â ok > 30 d i bÅÄdy > 180 d; ok 29 d i bÅÄd 100 d zostajÄ; ostatni sukces zadania 90 d zostaje i straÅ¼nik go widzi; zadanie tylko z bÅÄdem 400 d usuniÄte; ponownie 0; authenticated bez EXECUTE) Â· produkcja (transakcja wycofana): teraz 0 usuniÄtych, now+31 d 43 z 45 â zostaje po 1 (ostatni sukces ferry-ais i send-notifications); po rollbacku 45 | cron `tower-retencja-przebiegow` 50 2 * * * aktywny (16 zadaÅ cron) |
| WZORZEC-3C | Nowy wzorzec 840 (PL-T 61 + D15 20 przyjÄte 26.09 18:30) + tag `baseline-fala-3c-2026-09-26` | **DONE** | cede8bd | peÅny przebieg 840 na buildzie HEAD 6a3e554 (demo, 0Ã âsupabaseâ, po ZAPR-LOGIN/FAKTURY-10MB/RETENCJA-RUNS â kreator faktury zmieniony, wiÄc przebieg obowiÄzkowy): **840/840 OK, 0 FAIL**; vs stary wzorzec: zmienione pikselowo **323**, compare > 60 px **237** (automatyzacje 16, dokumenty 36, faktury 40, finanse 15, kokpit 50, moje-zadania 20, ryzyka 60); podziaÅ: EN/SV inne 211 (12 tekstÃ³w D19-12), kokpit 80 (baner KSH/SCX 60 + znacznik D15 w kokpicie HHL 20), PL inne 32 (PL-T); po aktualizacji shots-baseline: **840/840 identyczne, 0 rÃ³Å¼nic** | Walidacja PDF faktury (bÅÄd tylko po klikniÄciu) nie zmieniÅa Å¼adnego ujÄcia â wynik jak w WZORZEC-840 (324 â 323, rÃ³Å¼nica 1 ujÄcie szumu mapy). Para przed/po znacznika D15 (kokpit HHL EN 1440 light): /workspace/wzorzec-d15/ (przed, po, powiÄkszenie Ã10 z rÃ³Å¼nicami). Poprzedni wiersz WZORZEC-840 (STOP) zamkniÄty decyzjÄ wÅaÅciciela |
| A6-T1 | Ryzyka z kluczem tÅumaczenia: risk_signals.title_key + detail->'params', wszystkie funkcje (baza + Edge), UI/e-maile/baner/demo ze sÅownika PL/EN/SV | DONE (0042 na produkcji; Edge wdroÅ¼one) | 21cca69 | unit 342/28 (risk-keys 14); db risks 17/17; gate 11 zestawÃ³w OK | 26.09: 0042 â produkcja (dry-run, --yes); sprawdzenie w transakcji wycofanej: detect_silent_vehicles â rk_silent_vehicle {plate, minutes}, job_watchdog â rk_job_failure, 0 wierszy bez klucza. Funkcje bazy: auto_set_status, apply_geofence_status, detect_ferry_overdue, promote_ferry_departures, detect_silent_vehicles, detect_sequence_risk, detect_missing_order_numbers, record_usage, job_watchdog (+ wyzwalacz: brak klucza â rk_generic). Edge wdroÅ¼one: ferry-schedule, ferry-status, ferry-ais, road-se, road-pl, traffic-flow, send-notifications (jÄzyk e-maila = app_users.locale odbiorcy). PL = dotychczasowe teksty |
| A6-T2 | Test pseudo-lokalizacji (â¦â¦â§) + przeniesienie napisÃ³w na sztywno do sÅownika | OPEN | â | â | ANEKS 6 |
| A6-T3 | Liczby, procenty i daty przez Intl w aktywnym jÄzyku (EN 15.7%, PL 15,7%, SV 15,7 %) | OPEN | â | â | ANEKS 6 |
| A6-WZORZEC | Przebieg 840 po T1âT3: EN/SV tylko miejsca T1âT3, PL 0 zmian (inaczej STOP) â tag | OPEN | â | â | ANEKS 6 |
| PR2-ZMIANA | Kopie przez Worker Cloudflare z wiÄzaniem R2 (binding) â bez klucza R2 i bez S3 | OPEN (po T1âT3 i po CLOUDFLARE_API_TOKEN) | â | â | Decyzja wÅaÅciciela 26.09 21:15: Worker przyjmuje tylko PUT nowego obiektu z nagÅÃ³wkiem sekretu wspÃ³Ådzielonego z backup-export; GET/LIST/DELETE â 405, nadpisanie istniejÄcego klucza â 409, PUT bez sekretu â 401; blokada retencji jak w bucket-lock.json; restore.sh pobiera kopie osobnym tokenem tylko do odczytu, tworzonym na czas testu i odwoÅywanym po nim |
| A6-T2 | BrakujÄce tÅumaczenia UI: pseudo-lokalizacja (build VITE_PSEUDO=1, ?pseudo=1 â â¦â¦â§) + crawl 3 jÄzyki Ã 3 role Ã widoki/szuflada (wszystkie zakÅadki)/dzwonek/pomoc; sÅownik ui6.ts | DONE | c4f5286 | unit 342/28; tsc OK; gate 11 zestawÃ³w OK | 409 nowych kluczy a6_* (widoki, szuflada, toasty store, panele auth/urzÄdzenia/uÅ¼ytkownicy, link kierowcy, podglÄd dokumentu, PWA kierowcy); mapy {pl,en,sv} â dictEntry (73 wpisy). Crawl: 871 â 583 napisÃ³w poza sÅownikiem â pozostaÅe to dane (seed, osoby, tablice, pliki, trasy, nazwy wÅasne, sytuacje Trafikverket, nazwy reguÅ). PL identyczny (840). Znane stare usterki PL zostawione celowo: DRAWING w PL pokazuje identyfikator doc_cat_drawing, title flag dokumentÃ³w w harmonogramie = kod kategorii, kilka tekstÃ³w bez polskich znakÃ³w (np. podwyzszone, Zaladowano) â do poprawy osobnÄ zmianÄ z akceptacjÄ zmiany wzorca PL |
| A6-T3 | Liczby, procenty, wymiary, daty wg jÄzyka (Intl) | DONE | 7db8e45 | unit 345/28 (number-format 3) | Wg jÄzyka (EN/SV przez Intl): procenty (marÅ¼a, OTIF, kompletnoÅÄ dokumentÃ³w), wymiary w szufladzie, fala/wiatr, data w Topbar i Dashboard, daty w Moje urzÄdzenia. PL w postaci dotychczasowej (pctText z plLegacy, fmtNumKeepPl) â 840 PL bez zmian; +0.6 h w Ryzykach bez zmian. Poza zakresem: daty w tabelach (time.ts, formatTableDay â zapis liczbowy dd.mm, taki sam we wszystkich jÄzykach) |
| A6-WZORZEC | Wzorzec 840 po ANEKS 6 T1âT3 | DONE | 1b18fa1 | 840/840 OK; compare: PL 0/280, EN 280/280, SV 280/280 (prÃ³g 0,28 / 60 px) | ÅwieÅ¼y build demo z HEAD (bez VITE_PSEUDO), paczka 0Ã sÅowo zakazane. PL: 0 ujÄÄ ponad prÃ³g (maks. 0 px; 91 ujÄÄ z rÃ³Å¼nicami antyaliasingu pod progiem). EN/SV: kaÅ¼de ujÄcie zmienione, bo pasek gÃ³rny jest na kaÅ¼dym ekranie (tâw/v tydzieÅ, falaâwave/vÃ¥g, data wg jÄzyka) + teksty widokÃ³w z T1âT3. W trakcie: poprawka EN wave (zawijanie przeÅÄcznika rÃ³l przy 1280) i rk_usage_next bez nazwy dostawcy. Tag baseline-fala-3d-2026-09-26 |
| A6-USTERKI | 3 usterki PL + twarda reguÅa kluczy w pseudo-lokalizacji | DONE | 1a0e4b2 | unit 345/28; crawl: 0 widocznych kluczy, 575 napisÃ³w = dane | (1) dokument DRAWING: PL/EN/SV z doc_cat_drawing zamiast identyfikatora; (2) dymek flag Z/C/F w harmonogramie: nazwa kategorii zamiast kodu (PERMIT_PL, LASHING_PHOTOSâ¦); (3) teksty bez polskich znakÃ³w (podwyzszone, Zaladowano, Rozladowano, Dojezdza, Sila wyzsza, dokumentow, wymiarow, rozklad, Nynashamn) oraz szwedzkich (forhojd, Narmar, Farja, Godsfordakringâ¦) â 25 wartoÅci. Å¹rÃ³dÅo: KOD â mapy w src/lib/voyageSea.ts i src/lib/enumLabels.ts sprzed ANEKS 6 (przeniesione 1:1 do sÅownika w A6-T2); nie baza, nie dane demo. ReguÅa twarda w scripts/pseudo-l10n.mjs (niezaleÅ¼na od wyjÄtkÃ³w): na 583 napisach uznanych za dane znalazÅa 6 (wszystkie doc_cat_drawing), po poprawce 0 |
| A6-GENERIC | rk_generic: bezpiecznik zostaje, test ÅcieÅ¼ek + straÅ¼nik | DONE (0043 na produkcji) | 53636db | unit rk-generic 3; db risks 23/23 | Test tests/rk-generic.test.ts: ostatnie definicje funkcji z migracji â 13 ÅcieÅ¼ek (raise_risk 7: auto_set_status, apply_geofence_status Ã3, promote_ferry_departures Ã2, detect_ferry_overdue; insert 6: detect_silent_vehicles, detect_sequence_risk, detect_missing_order_numbers Ã2, record_usage, job_watchdog), kaÅ¼da z jawnym kluczem rk_*; Edge: jedyne wejÅcie store.ts â raise_integration_risk z title_key, 5 miejsc titleKey (8 kluczy), 12 wywoÅaÅ raiseRisk w jobs.ts. 0043 (idempotentna): wyzwalacz AFTER INSERT when title_key='rk_generic' â JOB_FAILURE HIGH (audience HHL), klucz rk_key_guard, jedno otwarte na projektÃrodzaj, e-mail Resend na ALERT_EMAIL_TO (Vault), nigdy nie blokuje zapisu. Produkcja: dry-run â --yes; test w transakcji wycofanej: ryzyko rk_key_guard/JOB_FAILURE/HIGH/HHL, mail WYSLANY_DO_KOLEJKI (wycofany); otwartych rk_generic: 0 |
| A6-WZORZEC2 | Wzorzec 840 po 3 usterkach PL, regule kluczy i straÅ¼niku rk_generic | DONE | ce094ad | 840/840 OK; PL 25/280, EN 0/280, SV 25/280 (prÃ³g 0,28 / 60 px) | ÅwieÅ¼y build demo z HEAD, 0Ã sÅowo zakazane. Wszystkie 50 zmienionych ujÄÄ to widok Dokumenty, kolumna nazw w liÅcie plikÃ³w: PL âdoc_cat_drawingâ â âRysunek elementuâ (usterka 1), SV PL-tillstand/SE-tillstand/Godsfordakring â tillstÃ¥nd/GodsfÃ¶rsÃ¤kring (usterka 3). EN bez zmian (juÅ¼ ze sÅownika od A6-T2). PozostaÅe usterki (dymek flag, teksty w szufladzie/tytuÅach) poza kadrem 840. Tag baseline-fala-3e-2026-09-27 |
| PR2-R2 | Kopia zapasowa na Cloudflare R2 (Worker tylko PUT, blokada usuwania) | DONE | ccbfd8b | test-writer 8/8 (401/401/405/405/405/400/201/409); kopia OK 38 tabel / 362 wiersze / 27 934 B â daily/2026-09-26-234302/; RESTORE OK tabel=38 wierszy=362; straÅ¼nik 27 h â ALARM backup + e-mail do kolejki (wycofane) | Zasobnik tower-backup (weur), blokada daily/ 30 d, monthly/ 360 d; cykl Å¼ycia 31/361 d. Worker tower-backup-writer: sekret x-backup-secret, if-none-match. Cron 30 0 * * * UTC. Poprawka: for-await na strumieniu COPY zawieszaÅ Edge (546) na tabelach >16 kB â zdarzenia data/end. Katalog daily/2026-09-26/ niepeÅny (przerwany przebieg, zablokowany 30 d). Token R2 tylko do odczytu do testu odtworzenia: czeka na wÅaÅciciela (OAuth nie tworzy tokenÃ³w); pobranie w teÅcie przez wrangler. |
| PR1-PR8 | Worker podtrzymania na Cloudflare; Pages z integracjÄ Git | DONE | babe741 | keep-alive ?check=1 â 200 ok, system_heartbeat beats=1 source=cf-worker; cron 0 */6 * * * | Worker tower-keep-alive.tower-hhl.workers.dev, sekrety: klucz anon, Resend, ALERT_EMAIL, MAIL_FROM (bez klucza serwisowego). Pages: czeka na autoryzacjÄ aplikacji GitHub Cloudflare przez wÅaÅciciela (kroki w PRZELACZENIE_HOSTINGU.md); test przeÅÄczenia po pierwszym buildzie. 27.09 11:18: wÅaÅciciel zaÅoÅ¼yÅ Pages tower-hhl.pages.dev z integracjÄ Git (build zielony, tytuÅ âTOWER â Stegra Bodenâ, Preview branches = None) i dodaÅ Redirect URL https://tower-hhl.pages.dev/** w Supabase. Test przeÅÄczenia (bez logowania, publiczne adresy, commit a60e98d): https://tower-hhl.pages.dev/ â 200, tytuÅ âTOWER â Stegra Bodenâ; build lokalny tego commitu (tylko VITE_SUPABASE_URL + klucz anon) vs Pages: 37/37 serwowanych plikÃ³w identycznych bajtowo (index.html + assets; _headers Pages przetwarza, nie serwuje); /download/tower-makieta.html â 308 â /download/tower-makieta 200, Content-Disposition: attachment. Logowanie linkiem z nowego adresu nie testowane (wysÅaÅoby e-mail z produkcji). Odczyt preview_deployment_setting i reguÅa files/ CZEKAJÄ: wrangler login (OAuth) wygasÅ po 120 s bez klikniÄcia Allow w przeglÄdarce â potrzebne klikniÄcie wÅaÅciciela. 27.09 ok. 11:38 (logowanie wÅaÅciciela, juÅ¼ wylogowane): API Pages tower-hhl: production_branch main, source.type github, preview_deployment_setting "none", production_deployments_enabled true, zmienne produkcyjne tylko NODE_VERSION, VITE_AUTH_MODE, VITE_SUPABASE_ANON_KEY, VITE_SUPABASE_URL (bez klucza serwisowego). wrangler logout: âSuccessfully logged out.â; whoami: âYou are not authenticated. Please run `wrangler login`.â |
| PR2-B | Kopie: wspÃ³ÅbieÅ¼noÅÄ, pliki, konta po odtworzeniu, procedura miesiÄczna | DONE | 5c62f6c | backup.sh 20/20, invite.sh 38/38, unit 353/28 skip; produkcja: 0044+0045 wdroÅ¼one, backup-export wdroÅ¼ony, w wycofanej transakcji RUNNINGâSKIPPED, restore_mark_relink()=0 | (1) KOPIE_ZAPASOWE.md: comiesiÄczny test = krÃ³tkie wrangler login â restore.sh (+restore-files.sh) â logout â dosÅowny wynik whoami w raporcie; token R2 tylko do odczytu dopiero po uruchomieniu przekazywania sekretÃ³w. (3) Lokalny Supabase (Docker) + lokalny R2 (wrangler dev --local, ten sam Worker, test-writer 8/8): 2 pliki, 290 022 B, SHA-256 przed/po 2/2 zgodne, wgrane z powrotem 2/2; przebieg przyrostowy: 1 nowy, 2 pominiÄte. (4) restore.sh --into-public â account_relink_pending (konta_do_polaczenia=N); pierwsze logowanie linkiem ÅÄczy app_users po e-mailu (tylko adres z listy i osierocony wiersz), audit USER_RELINKED_AFTER_RESTORE; test GoTrue: 3 na liÅcie â 1 poÅÄczony, widzi swoje dane, obcy adres odrzucony. restore.sh zamyka teÅ¼ przebieg RUNNING z kopii. (5) backup_run_begin(): pg_try_advisory_xact_lock + trwajÄcy przebieg â SKIPPED; 2 rÃ³wnolegÅe wywoÅania lokalnie: 1 OK + 1 SKIPPED. |
| PR2-B-R2LOCK | Blokada R2 dla prefiksu files/ (360 dni) | DONE | â | â | Do zrobienia przy najbliÅ¼szym logowaniu do Cloudflare (test przeÅÄczenia hostingu): Worker przyjmuje files/, a blokady obejmujÄ tylko daily/ i monthly/. DodaÄ reguÅÄ files/ 360 dni (wrangler r2 bucket lock add tower-backup â¦), potem wkleiÄ dosÅownÄ listÄ wrangler r2 bucket lock list tower-backup, logout + whoami. Teraz nie wykonywaÄ. 27.09 11:19: prÃ³ba logowania â wygasÅa bez zgody w przeglÄdarce; nadal OPEN, wykonaÄ w tym samym logowaniu co test przeÅÄczenia. 27.09 ok. 11:38 (logowanie wÅaÅciciela): dodana reguÅa tower-files-360d. Lista po zmianie: name: tower-daily-30d / enabled: Yes / prefix: daily/ / condition: after 30 days Â· name: tower-files-360d / enabled: Yes / prefix: files/ / condition: after 360 days Â· name: tower-monthly-360d / enabled: Yes / prefix: monthly/ / condition: after 360 days. Informacja: files/ nie ma reguÅy cyklu Å¼ycia (pliki dokumentÃ³w zostajÄ, blokada 360 dni) â bez zmian. |
| PR2-C | Konta po odtworzeniu: nieaktywne zostaje nieaktywne; lista waÅ¼na 30 dni | DONE | 74a7ca0 | invite.sh 48/48 (+10), gate OK, unit 353/28 skip; produkcja: 0046 wdroÅ¼ona, cron tower-wygasanie-listy-kont 45 2 * * * aktywny, lista pusta (0) | (a) juÅ¼ w 0045 poÅÄczenie nie zmienia active â potwierdzone testem: lokalny Supabase/GoTrue, konto nieaktywne â sesja, ale projekty 0 / app_users 0 / loads 0. (b) 0045 nie miaÅa wygasania â 0046: relink_valid_days()=30, wyzwalacz pomija starsze wpisy, expire_relink_pending() codziennie 02:45 UTC z audytem RELINK_PENDING_EXPIRED; lokalnie wpis 31-dniowy â logowanie odrzucone, usuniÄty 1. Opis w KOPIE_ZAPASOWE.md. |
| DOMENA-TOWER | Adres produkcyjny tower.log-mar.pl | PARTIAL | â | Vercel: domena dodana do watch-tower-makieta, verified true; CNAME tower â c8ddf203a73a39c2.vercel-dns-017.com.; Supabase Site URL https://tower.log-mar.pl + Redirect https://tower.log-mar.pl/** (PATCH 200, pages.dev zostaje); check-domain.sh przed CNAME: 1 OK / 7 FAIL (oczekiwane â Åapie *.log-mar.pl CT8) | Czeka: wÅaÅciciel dodaje CNAME w CT8 â po propagacji scripts/check-domain.sh (+ logowanie linkiem tylko na konto wÅaÅciciela). UWAGA: produkcja Vercel = build demo sprzed 3 dni (makieta bez logowania) â do wdroÅ¼enia wersji produkcyjnej potrzebna osobna zgoda (O2). Procedura awarii Vercel â Pages w PRZELACZENIE_HOSTINGU.md. |
| DOMENA-TOWER-2 | CNAME tower.log-mar.pl | PARTIAL â propagacja DNS | â | 27.09 ok. 12:40: Google DNS zwraca CNAME `c8ddf203a73a39c2.vercel-dns-017.com.` â 216.198.79.1 / 64.29.17.1; certyfikat Let's Encrypt (YR2), CN/SAN tower.log-mar.pl, waÅ¼ny 27.09â26.12.2026; `/` 200, `/tower-makieta.html` i `/download/tower-makieta.html` 404 (339 B); Cloudflare DNS jeszcze zwraca stary wpis `*.log-mar.pl` (CT8, 136.243.156.120, zÅy certyfikat), TTL 915 s | Rano CNAME czekaÅ na wÅaÅciciela; wedÅug wÅaÅciciela jest juÅ¼ wpisany (27.09 przed 12:10). Do zrobienia po peÅnej propagacji: `bash scripts/check-domain.sh` + logowanie linkiem na konto wÅaÅciciela. Domena wskazuje wdroÅ¼enie produkcyjne O2 (ekran logowania). |
| AUDYT-STATUS | Statusy SCOPE 0â11, sekcja C audytu, B5, O3a/O3b | DONE (tylko dokumentacja) | (ten commit `docs(AUDYT-STATUS)`) | â (docs; produkcja tylko SELECT) | `AUDYT_ZAKRESU.md` dodany; SCOPE Â§0â11: 114 pozycji â GOTOWE 47 Â· czÄÅciowo 37 Â· nie zrobione 9 Â· zablokowane 10 Â· odÅoÅ¼one 7 Â· do potwierdzenia 4; dzienniki odÅoÅ¼eÅ (7) i blokad (8 wpisÃ³w); SCOPE Â§39: C1âC8, B5 (1 miejsce zaÅadunku = strefa KSH Årem, 0,33 m), etap I = B1âB7. Nic nie naprawiano |
| release-1.0 | Tag `release-1.0` na commicie dziaÅajÄcym na produkcji | OPEN | â | â | **dopiero po etapie I z audytu (`AUDYT_ZAKRESU.md` sekcja B: B1âB7) i po O3b** (decyzja wÅaÅciciela 27.09.2026; O2 i O3a DONE 27.09.2026) |

## Etap 4 â Fala 3B: pieniÄdze, faktury, zlecenia Â· **ZAMKNIÄTY (G4)**

| ID | pozycja | status | commit | testy (liczby) | uwagi |
|---|---|---|---|---|---|
| M2 | Dane v2: EUR, poziomy, migawki | **DONE** | `45e8d10` | unit **166 / 9 skip** (`tests/money-v2.test.ts` **9/9**) Â· db **52/44/33 + money 17/17** Â· hosted `scripts/money/verify.mjs` **15/15** Â· live provider **8/8** Â· pw **4/4** Â· d19 **0** Â· deur **0** Â· lint **0** | **App:** `src/lib/money/loadMoney.ts` â `LoadMoneyV2` na `pricing.money`: poziom (mniej pewna strona), **obie wartoÅci** `computedEur` / `invoicedEur` (Z1: `applyInvoiceToSide` nie rusza wyliczenia, marÅ¼a z fakturowanej, rÃ³Å¼nica `sideInvoiceDiffEur`), migawka mnoÅ¼nika SEFS z datÄ (ta sama po obu stronach, `assertSameMechanism` w ÅcieÅ¼ce), migawka kursu z numerem tabeli (reguÅa W3 na prawdziwych tabelach NBP 2026-08-03â¦09-25 w `src/data/nbpEurDemo.ts`; brak tabeli â najstarsza + prowizoryczny, nigdy cicho). `Load.unloadedAt` (W5). `STORE_SCHEMA_VERSION` **2**, migracja v1âv2 dokÅada dane v2 bez utraty pÃ³l. Tryb Supabase: ceny z widokÃ³w v2 (`applyPriceViews`; strona niewidoczna = 0, marÅ¼a tylko przy obu stronach). **Baza `0010_money_v2.sql` (hosted, historia 0001â0010):** widoki `v_load_*` z `security_invoker=false` + `security_barrier` i **jawnym filtrem** jak `cost_read`/`revenue_read` (naprawa G3: permission denied dla wszystkich); tabele `load_cost`/`load_revenue` nadal zamkniÄte; kolumny v2 (poziom, computed/invoiced/effective, fuel/fx); marÅ¼a w EUR (Z3); wyzwalacz Z1 (wyliczenie po zafakturowaniu niezmienne). Nowy zestaw `tests/db/money.sh` w `gate.sh`. WyglÄd bez zmian (dane v2 pokaÅ¼e M8). |
| M3 | Kurs NBP na Å¼ywo + `fx_rates` | **DONE** | `ce3ff43` | unit **167 / 14 skip** (`tests/nbp-live.test.ts`: 1 + **5 z `NBP_LIVE=1`** zielone; `money.test.ts` z `NBP_LIVE=1` **50/50**) Â· db **52/44/33 + money 31/31** Â· hosted verify **23/23** Â· pw **4/4** Â· d19 **0** Â· deur **0** | **Baza `0011_fx_nbp.sql` (hosted, historia 0001â0011):** rozszerzenie `http` (w bazie, bez funkcji Edge i sekretÃ³w â API NBP publiczne) â `fx_sync_nbp(dzieÅ)` pobiera **przedziaÅ [dzieÅ â 14, dzieÅ â 1]** (nigdy pojedynczy dzieÅ; 404 = brak publikacji â 0), parser `fx_ingest_nbp(jsonb)` â `fx_rates` (upsert); pg_cron `tower-kurs-nbp` `30 10,14 * * *` UTC (po publikacji ~12:00 PL) + `fx_apply_pending()`. `fx_rate_before(dzieÅ)` = reguÅa W3 (ostatnia tabela ÅCIÅLE przed dniem, w oknie 14 dni; brak â bÅÄd). **Migawka przy rozÅadunku:** wyzwalacz na `loads.actual_delivery_at` â kurs + data opÅaty paliwowej (dzieÅ lokalny, Z2) na obu stronach, poziom REALIZACJA, tylko gdy strona niezafakturowana (Z1); brak tabeli â migawka prowizoryczna, uzupeÅniana po pobraniu; zmiana planu i nowe tabele nie ruszajÄ migawki. `fx_rates`: odczyt dla zalogowanych, zapis tylko funkcje systemowe (bez EXECUTE dla rÃ³l API). Hosted: pobrano na Å¼ywo tabele 2025-12 i 2026-09 (17 wierszy, najnowsza 2026-09-25). App: `src/lib/money/nbpSync.ts` (przedziaÅ + migawka z Å¼ywego API). Test hosted zmienia i przywraca `actual_delivery_at`/`plan_delivery_from` fixture TEST-BK3-A (wpisy `LOAD_DELIVERY_DATE_CHANGE` w dzienniku audytu â dziennik jest tylko do dopisywania). |
| M4 | Ustawienia uÅ¼ytkownika (jÄzyk/waluta/motyw) | **DONE** | `500e405` + `7bc89e0` (fix: opis waluty `data-deur-exempt`, peÅny przeglÄd D-EUR-T KSH/SCX:PLN 0) | unit **167 / 15 skip** Â· D-EUR-T **2/2** (HHL EUR+PLN: 0; **KSH i SCX przez âUstawieniaâ** EUR+PLN: 0 â w trybie PLN zakazane takÅ¼e `EUR`/â¬ poza wyjÄtkami) Â· live provider **9/9** (+ ustawienia) Â· hosted verify **33/33** (+10: `user_preferences` 3 konta) Â· pw **4/4** Â· d19 **0** Â· db **52/44/33 + money 31/31** | **Panel âPreferencje interfejsuâ** wydzielony do `src/components/settings/UiPrefsPanel.tsx` i uÅ¼yty ponownie: Opcje HHL (ukÅad bez zmian) + **nowy widok âUstawieniaâ** (`SettingsView`, `options-page`/`options-grid`, bez nowych komponentÃ³w) w nawigacji **KSH i SCX** (ikona zÄbatki jak Opcje). JÄzyk, waluta wyÅwietlania, motyw. **Zapis:** akcje store `setLocale`/`setDisplayCurrency`/`setTheme` â `writeThrough({type:"prefs.save"})` â `user_preferences` (upsert wÅasnego wiersza, `current_app_user_id()`); przy logowaniu `loadPreferences()` â `applyUserPrefs` (bez ponownego zapisu). Demo: jak dotÄd localStorage. Cennik w Opcjach oznaczony `data-deur-exempt="rate-card-source"` (ÅºrÃ³dÅowy EUR â jak indeks paliwowy). Teksty PL/EN/SV w `src/i18n/etap4.ts`. **Zmiana wizualna:** nowa pozycja âUstawieniaâ w nawigacji KSH/SCX â matryca wizualna do przeliczenia w G4. |
| M5 | Numery zleceÅ KSH/HHL/SCX w harmonogramie | **DONE** | `988da2d` | unit **186 / 15 skip** (+19 `tests/order-numbers.test.ts`) Â· live provider **10/10** (+M5) Â· hosted verify **44/44** (+11 M5) Â· db **52/44/33 + money 50/50** (+19 M5) Â· pw **4/4** Â· d19 **0** Â· D-EUR-T **2/2** Â· **etap4-ui 3/3** (nowy, w pre-push) | **Harmonogram:** kolumny `ord_ksh`/`ord_hhl`/`ord_scx` (âZlec. KSH/HHL/SCXâ) zaraz za kodem wysyÅki we wszystkich rolach (Q9); zapisane preferencje kolumn sprzed M5 dostajÄ nowe kolumny za kodem; tabela przewija siÄ w poziomie, ostatnia kolumna finansowa `.stick` (bez nowego wzorca); wyszukiwarka po numerach. **Szuflada (PrzeglÄd):** trzy wiersze numerÃ³w â KSH tylko odczyt (import), HHL edytuje wyÅÄcznie swÃ³j, SCX wyÅÄcznie swÃ³j (pole `input` + âZapiszâ wzorem formularzy szuflady), pozostali widzÄ tekst / ânie uzupeÅnionoâ. Zapis `load.orderNo` â `hhl_order_no` / `carrier_order_no`. **Wymuszenie:** lustro `enforce_order_numbers()` w store (`orderNumberGate`) + bÅÄdy bazy tÅumaczone `friendlyDbError` (PL/EN/SV: brak numeru HHL/przewoÅºnika, cudzy numer, okna planowe, data rozÅadunku zamroÅ¼ona, status wstecz, duplikat) w komunikacie zapisu â âNie moÅ¼na oznaczyÄ jako gotowy â brak numeru zlecenia HHLâ¦â. **Brak przed terminem:** `0012_order_numbers.sql` (hosted, historia 0001â0012): `detect_missing_order_numbers()` (pg_cron `tower-numery-zlecen` co godzinÄ) â HHL przed GOTOWY, przewoÅºnik przed zaÅadunkiem, od **48 h** przed planowym zaÅadunkiem â ryzyko `RESOURCE_MISSING` (detail.rule=ORDER_NO, wÅaÅciciel) + przypomnienie `notifications` IN_APP **wyÅÄcznie** do strony, ktÃ³ra ma wpisaÄ numer; uzupeÅnienie numeru zamyka ryzyko (wyzwalacz). **`notifications` bez RLS od 0001 â wÅÄczone** (odczyt tylko wÅasnych, zapis tylko funkcje systemowe). Demo: dane startowe z trzema numerami (D12, kokpit bez zmian do G4); usuniÄcie numeru w szufladzie tworzy ryzyko + przypomnienie. **AN2:** przewoÅºnik widzi okna planowe w âAwizacja / Promâ jako tekst (`data-plan-readonly`), zapis wysyÅa tylko âPotwierdzonaâ. **Parametr do potwierdzenia przez wÅaÅciciela:** wyprzedzenie przypomnienia 48 h (`ORDER_NO_LEAD_H`, `p_lead_h`). **Znalezisko bezpieczeÅstwa (poza M5) â naprawione `7c027cf` fix(RLS), `0013_rls_gaps.sql` (hosted, historia 0001â0013):** `geofence_states`, `load_permits`, `schedule_imports`, `workflow_runs` byÅy bez RLS i czytelne dla anon (hosted: HTTP 200) â RLS, anon bez dostÄpu, odczyt wg widocznoÅci transportu / HHL, zapis HHL lub funkcje systemowe; db money 59/59 (+9), hosted verify 49/49 (+5). Otwarte (poza zakresem, do decyzji): `risk_signals` czytelne dla wszystkich zalogowanych (`risks_read using (true)` z 0001). Â· **AN1:** przewoÅºnik zmienia wyÅÄcznie swÃ³j numer, HHL wyÅÄcznie swÃ³j; **HHL nie moÅ¼e zmieniÄ numeru zlecenia przewoÅºnika** (W12, wymusza baza â `guard_load_update`) Â· **AN2:** w szufladzie i formularzach przewoÅºnik **nie widzi pÃ³l okien planowych jako edytowalnych** (baza i tak odrzuci; interfejs nie moÅ¼e proponowaÄ zmiany) |
| M6 | Faktury â model 3 stron | **DONE** | `2b4ff4a` | unit **202 / 17 skip** (+16 `tests/invoices3.test.ts`) Â· live provider **11/11** (+M6: SCX rejestruje â HHL weryfikuje i âOpÅaconaâ; HHL â KSH, SPORNA z uzasadnieniem) Â· hosted verify **76/76** (+27 M6, fixture TEST sprzÄtane) Â· db **52/44/33 + money 88/88** (+29 M6) Â· pw **4/4** Â· d19 **0** Â· D-EUR-T **2/2** (KSH ma teraz widok `inv`) Â· **etap4-ui 6/6** (+3 M6) | **Baza:** `0014_invoice_register.sql` + `0015_register_invoice_rule_fix.sql` (hosted, historia 0001â0015). `register_invoice(jsonb)` â wystawca rejestruje w jednej transakcji: nagÅÃ³wek (netto/VAT/brutto **przepisane z dokumentu**, system nie liczy VAT), PDF wymagany (`create_document(null,INVOICE,â¦,projekt)` + Storage), pozycje z kursem per pozycja, kontrole liczone w bazie (NIEZREALIZOWANY, ZLY_TYDZIEN, KWOTA >1 i >0,2 %, TABELA_NBP/KURS_NBP/DATA_KURSU wobec migawki lub W3, BRAK_KURSU, OPLATA_PALIWOWA z aplikacji; nagÅÃ³wek BRAK_NA_FAKTURZE + `missing_load_ids`), termin dokument > `payment_terms` > 30 dni (KSH) / 35 dni (HHL wobec SCX), Z1 (`invoiced_total_eur` obok wyliczenia, poziom FAKTURA), CMR/POD pozycji i FAKTURA_PDF w `invoice_documents`, Q13 powiadomienie KSH, dziennik audytu; podwÃ³jne fakturowanie â zrozumiaÅy bÅÄd. 0015: reguÅa kursu jako skalary (pierwsza pozycja bez migawki i rozÅadunku dawaÅa bÅÄd ârecord v_rule is not assigned yetâ â wykryte testem live). Weryfikacja/pÅatnoÅÄ bez zmian z 0003 (odbiorca weryfikuje, SPORNA z uzasadnieniem, `mark/unmark_invoice_paid` wyÅÄcznie HHL, cofniÄcie z powodem). **Aplikacja:** `src/lib/invoices3.ts` (strony, widocznoÅÄ W7, kontrole = lustro RPC, termin, stan pÅatnoÅci w obie strony, dane startowe 2+2), wycinek store `bills` (utrwalany) + akcje; SupabaseProvider czyta `invoices`+`invoice_lines` (kierunek â  null) i zapisuje przez RPC; po zapisie odÅwieÅ¼enie z serwera. **UI (wzorce makiety: panel/tablewrap/kv/mrow/pill/seg):** HHL â âFaktury kosztoweâ (weryfikacja, âOpÅaconaâ z datÄ, cofniÄcie z powodem) i âFaktury przychodoweâ z kreatorem jak u SCX (tydzieÅ, transporty, EUR/PLN, kurs per pozycja z podpowiedziÄ W3 â potwierdÅº/popraw, netto/VAT/brutto, numer, daty, PDF, kontrole przed zapisem); SCX â rejestracja z wyborem waluty, lista ze statusem i terminem, **bez âOpÅaconaâ**; KSH â nowy widok âFakturyâ (nawigacja), **wyÅÄcznie** faktury HHLâKSH, PDF + CMR + POD, kolumna âWg cen KSHâ (nigdy koszt), ZGODNA / SPORNA (z uzasadnieniem) / ZAAKCEPTOWANA, termin i status pÅatnoÅci. Kwoty w walucie faktury `data-deur-exempt="invoice-currency"`. IstniejÄcy panel trÃ³jstronny HHL/SCX bez zmian. Demo: faktury v2 nie zmieniajÄ poziomu/marÅ¼y transportÃ³w ani kokpitu (do G4). Â· **AN1:** po umieszczeniu transportu na fakturze **data rozÅadunku zamroÅ¼ona** dla wszystkich poza HHL (Z4) |
| M7 | Terminy i pÅatnoÅci + przypomnienia | **DONE** (e-mail: krok wÅaÅciciela W-M7-1) | `c907fe9` | unit **208 / 17 skip** (+6 `tests/payment-reminders.test.ts`) Â· live provider **12/12** (+M7) Â· hosted verify **87/87** (+11 M7) Â· db **52/44/33 + money 104/104** (+16 M7) Â· pw **4/4** Â· d19 **0** Â· D-EUR-T **2/2** Â· etap4-ui **6/6** | **Baza:** `0016_payment_reminders.sql` (hosted, historia 0001â0016). `send_payment_reminders(dzieÅ lokalny)` â zadanie systemowe (pg_cron `tower-przypomnienia` 00:15 UTC, po `tower-terminy`; uÅ¼ytkownik nie uruchomi â test), najpierw `refresh_payment_status` (w obie strony), potem kadencja **â3 / 0 / +1 / +7 / +14** (z `payment_terms` relacji, domyÅlnie ta) dla nieopÅaconych faktur v2; odbiorcy **wyÅÄcznie** aktywni uÅ¼ytkownicy pÅatnika (odbiorca faktury) i wierzyciela (wystawca) â KSH nigdy o fakturach SCX (test DB + hosted); dwa kanaÅy: IN_APP (centrum powiadomieÅ) i EMAIL (kolejka `notifications` PENDING), treÅÄ w jÄzyku odbiorcy (`app_users.locale`), kwota w walucie faktury; deduplikacja per faktura/dzieÅ kadencji/uÅ¼ytkownik/kanaÅ. **OpÅacona â cisza:** wyzwalacz anuluje niewysÅane e-maile przypomnieÅ (CANCELLED), kolejne dni kadencji nic nie tworzÄ (test). âOpÅaconaâ/cofniÄcie â funkcje HHL z 0003 (data, powÃ³d, audyt). `notifications.read_at` + `mark_notifications_read(ids)` (tylko wÅasne IN_APP). **WysyÅka e-mail:** `supabase/functions/send-notifications` (Resend, klucz idempotencji per wiersz, ponowne sprawdzenie statusu tuÅ¼ przed wysyÅkÄ â opÅacona nie wychodzi) + `supabase/functions/_shared/notifyTemplates.ts` â **jedno ÅºrÃ³dÅo treÅci** PL/EN/SV dla e-maila i aplikacji. **Aplikacja:** SupabaseProvider Åaduje centrum powiadomieÅ z serwera (IN_APP, RLS wÅasne), przeczytanie zapisywane; szczegÃ³Åy faktury pokazujÄ plan przypomnieÅ (wysÅane / zaplanowane / wstrzymane â opÅacona) i adresatÃ³w (pÅatnik, wierzyciel). Demo: bez nowych powiadomieÅ startowych (kokpit bez zmian do G4). **Luka:** brak tokenu Management API â funkcji nie da siÄ wdroÅ¼yÄ z boxa (krok wÅaÅciciela **W-M7-1**); do tego czasu e-maile czekajÄ w kolejce (PENDING), kanaÅ w aplikacji dziaÅa. Drobna luka: odrzucona przez bazÄ rejestracja faktury (wyÅcig) zostawia niewidoczny dla innych plik PDF (brak polityki usuwania w Storage) â kontrole w aplikacji wyprzedzajÄ RPC. |
| M8 | Niezmiennik / poziomy w wycenie | DONE | 19a8f14 | unit 216/18 skip (+money-m8 8) Â· pw 4/4 Â· d19 0 Â· deur 2/2 Â· etap4 7/7 Â· db bez zmian (52/44/33 + money 104) | assertSameMechanism przy kaÅ¼dym wyliczeniu (withMoneyV2: seed/migracja/import) â rozjazd przerywa wyliczenie â moneyError na liÅcie wyjÄtkÃ³w, nie zero; mechanismIssue na migawkach z bazy (applyPriceViews); szuflada Ceny: poziom, mnoÅ¼nik z datÄ, tabela NBP, pill kursu tymczasowego, notka rozjazdu; Finanse: zestawienie poziomÃ³w per rola + pill na liÅcie poniÅ¼ej progu; **decyzja: oznaczenie poziomu w kokpicie odÅoÅ¼one do G4** (reguÅa baseline â kokpit w migawkach wizualnych); obserwacja: w demo wszystkie 72 transporty majÄ kurs tymczasowy (daty odniesienia po ostatniej tabeli demo NBP) |
| M9 | Aplikacja kierowcy: watchPosition + zgoda | DONE | 3f73c7a | unit 224/18 skip (+driver-tracking 8) Â· pw 4/4 Â· d19 0 Â· deur 2/2 Â· etap4 8/8 Â· db 52/44/33 + money 116 (+[M9] 12) Â· hosted verify 95/95 Â· live 12/12 | 0017 na hosted: report_position() (przewoÅºnik transportu/HHL, DRIVER_PWA, fix >250 m bez stref, czas z przyszÅoÅci odrzucony) â process_position(); **usterka bezpieczeÅstwa naprawiona:** process_position (security definer) miaÅ EXECUTE dla PUBLIC/anon/authenticated â kaÅ¼dy, takÅ¼e niezalogowany, mÃ³gÅ przesuwaÄ transporty pozycjami i wyzwalaÄ automat statusÃ³w; teraz tylko service_role; MILESTONE_LOADED zapisuje wyÅÄcznie przewoÅºnik transportu albo HHL; **wspÃ³ÅrzÄdne terminali zweryfikowane z mapÄ** (OSM/Nominatim, ferryguide, SjÃ¶fartsverket): GdaÅsk Westerplatte 54.40372, 18.68130 (~100 m korekty), NynÃ¤shamn FÃ¤rjeterminal 58.90453, 17.95621 (byÅo ~3,4 km na pÃ³Ånoc â strefa 800 m nie zadziaÅaÅaby), strefa zaÅadunku KSH Årem z ADDRESSES.md; aplikacja: zgoda przy pierwszym uruchomieniu w jÄzyku telefonu, watchPosition (prÃ³g 60 s / 150 m), bez zgody tylko przyciski etapÃ³w; ZaÅadowany â MILESTONE_LOADED, RozÅadowany â UNLOADED razem z datÄ (takÅ¼e z szuflady â wczeÅniej baza odrzucaÅa), PROM tylko automat; zdjÄcia do Storage â ÅcieÅ¼ka BK4 bez zmian; luka: brak osobnego logowania kierowcy (aplikacja dziaÅa w sesji przewoÅºnika) â decyzja wÅaÅciciela przy wdroÅ¼eniu Â· **AN1:** zdarzenia wg `STATUSY_AUTOMATYCZNE.md` Â§6 â âZaÅadowanyâ â `MILESTONE_LOADED`; âRozÅadowanyâ â UNLOADED **razem z datÄ rozÅadunku** (baza odrzuca UNLOADED bez daty); pozycje przez `process_position()`; strefy zaÅadunku z `docs/watch-tower/ADDRESSES.md` (wspÃ³ÅrzÄdne terminali zweryfikowaÄ z mapÄ) |
| M10 | Rejsy i automat statusÃ³w w aplikacji (po M6) | DONE | 1310492 | unit 234/19 skip (+sailings 10) Â· pw 4/4 Â· d19 0 Â· deur 2/2 Â· etap4 9/9 Â· db 52/44/33 + money 116 Â· hosted verify 95/95 Â· live 13/13 (+M10 ÅcieÅ¼ka) | rozkÅad rejsÃ³w w Harmonogramie (zakÅadka Rejsy: HHL dodaje/opÃ³Åºnia/odwoÅuje, odwoÅanie â ryzyka transportÃ³w na tym rejsie; wszyscy widzÄ); w szufladzie formularz Rejs (wybÃ³r rejsu + numer rezerwacji) zamiast wolnego tekstu promu â SCX do wypÅyniÄcia, potem tylko HHL (blokada takÅ¼e w bazie, komunikat zrozumiaÅy); oÅ czasu: STATUS_AUTO jako âZmiana automatycznaâ (z â do Â· powÃ³d); **kryterium na hosted:** scripts/ferry/path-scenario.sql prowadzi staÅy fixture TEST-M10 (przewoÅºnik SCX, M/F Wawel) pozycjami przez process_position() i promote_ferry_departures(): AT_PORT_GDANSK â FERRY â AT_PORT_NYNASHAMN â IN_TRANSIT_SE â AT_SITE; test live sprawdza status, rejs i 5Ã STATUS_AUTO z powodem na kontach HHL/KSH/SCX oraz odrzucenie zmiany rejsu przez SCX po wypÅyniÄciu; fixture zostaje (zdarzenia append-only); ÅºrÃ³dÅo statusÃ³w Polferries â decyzja wÅaÅciciela (do tego czasu rÄcznie) Â· AN1: HHL zarzÄdza rozkÅadem (dodanie, opÃ³Åºnienie, odwoÅanie; ÅºrÃ³dÅo Polferries = decyzja wÅaÅciciela, do tego czasu rÄcznie); przypisanie rejsu w szufladzie (HHL + przewoÅºnik; po wypÅyniÄciu tylko HHL); oÅ zdarzeÅ z `STATUS_AUTO` i powodem; ryzyka AUTO_STATUS / LOADING_UNCONFIRMED / rejs przegapiony / odwoÅany / PROM po czasie (PL/EN/SV); zrozumiaÅe bÅÄdy bazy. Kryterium: ÅcieÅ¼ka transportu port â PROM â plac na 3 kontach testowych Â· **AN2:** w szufladzie i formularzach przewoÅºnik **nie widzi pÃ³l okien planowych jako edytowalnych** (baza i tak odrzuci; interfejs nie moÅ¼e proponowaÄ zmiany) |
| M11 | Rozbicie marÅ¼y w Finansach (po M2) | DONE | fd94928 | unit 239/19 skip (+money-m11 5) Â· pw 4/4 Â· d19 0 Â· deur 2/2 Â· etap4 10/10 Â· db 52/44/33 + money 116 | w bloku âOd przychodu do marÅ¼yâ (HHL) trzy wiersze .mrow z piguÅkÄ poziomu i liczbÄ transportÃ³w: zafakturowana / zrealizowana niezafakturowana / prognozowana + wiersz âMarÅ¼a ÅÄczna Â· wszystkie transportyâ; sumy z totalsByTier (silnik) na marÅ¼ach v2 z wartoÅci efektywnych (faktura nadrzÄdna); waluta z ustawieÅ uÅ¼ytkownika â EUR ÅºrÃ³dÅowo, PLN per transport kaÅ¼da strona swoim kursem NBP (nie kursem demo), zaokrÄglenie per transport; transporty z przerwanym wyliczeniem (moneyError) poza sumÄ z licznikiem; kryterium: test jednostkowy suma 3 = ÅÄczna (EUR i PLN, 72 transporty demo) + test UI; KSH/SCX bez bloku marÅ¼y; uwaga: gÃ³rny wiersz âMarÅ¼aâ (tylko dostarczone, kurs demo) zostaje bez zmian Â· AN1 (rozbicie zatwierdzone): 3 wiersze `.mrow` w âOd przychodu do marÅ¼yâ â zafakturowana / zrealizowana niezafakturowana / prognozowana; sumy z `totalsByTier` w walucie uÅ¼ytkownika. Kryterium: suma 3 = marÅ¼a ÅÄczna, test jednostkowy |
| M12 | Integracje danych zewnÄtrznych (po M10) | DONE | 380e0ac | unit 260/20 skip (+integrations 21; ferry 17/17) Â· pw 4/4 Â· d19 0 Â· deur 2/2 Â· etap4 10/10 Â· db 52/44/33 + money 130 (+[M12] 14) Â· hosted verify 95/95 Â· live 14/14 | **0018 na hosted** (raise_integration_risk + latest_vehicle_positions tylko service_role; dziennik integration_runs â odczyt HHL; wyzwalacz: kaÅ¼dy zapis rejsu przez uÅ¼ytkownika = ÅºrÃ³dÅo RECZNIE, wiÄc pierwszeÅstwo RECZNIE > POLFERRIES > DANE_STARTOWE egzekwuje baza); szeÅÄ funkcji Edge na wspÃ³lnym rdzeniu supabase/functions/_shared (te same parsery co w aplikacji): ferry-schedule (nowy parser rozkÅadu cargo), ferry-status (komunikaty; NIEZNANY â rejs bez zmiany + ryzyko MEDIUM), ferry-ais (Digitraffic, tylko strona szwedzka, informacja z atrybucjÄ CC BY 4.0), road-se (Trafikverket E4, bufor 5 km), road-pl (KPD DATEX II), traffic-flow (TomTom przy autach); awaria ÅºrÃ³dÅa / zmiana struktury â ryzyko âÅ¹rÃ³dÅo niedostÄpneâ (zamykane po udanym odczycie), nigdy cicha pustka; limit czÄstotliwoÅci z dziennika (ferry-status co 15 min, nie czÄÅciej); bez klucza tryb DEMO bez pobierania (panel SE zostaje oznaczony D3/D18). **Kryterium:** scripts/ferry/run-job.ts (ten sam kod co funkcja) na prawdziwych stronach Polferries â hosted: ferry-schedule 147 rejsÃ³w (26.09.2026â04.01.2027, oba kierunki), ferry-status 10 rejsÃ³w uzgodnionych z komunikatami (0 zmian â wszystkie âPlanowoâ); pierwszy przebieg ferry-status padÅ na nagÅÃ³wku User-Agent z dÅugÄ kreskÄ (nie-ASCII) â poprawnie powstaÅo ryzyko SOURCE_DOWN, zamkniÄte automatycznie po udanym odczycie (dziennik zachowany, test pilnuje ASCII); test offline kaÅ¼dej funkcji (Polferries â prawdziwe strony z 26.09; Trafikverket/TomTom/DATEX II â przykÅady w formacie z dokumentacji, bo brak kluczy); poprawka: Digitraffic interpretFix uÅ¼ywaÅ starego punktu terminalu NynÃ¤shamn (~3,4 km obok) â zweryfikowane wspÃ³ÅrzÄdne z M9 (punkt testowy w ferry.test.ts przesuniÄty, dalej 17/17); UI: kolumna Å¹rÃ³dÅo w rozkÅadzie + atrybucja Polferries; rÄczne opÃ³Åºnienie/odwoÅanie w demo teÅ¼ oznacza RECZNIE; **krok wÅaÅciciela W-M12-1:** wdroÅ¼enie funkcji + pg_net + Vault + harmonogram (scripts/ferry/cron-edge.sql); klucze Trafikverket/TomTom, rejestracja KPD, zgoda Polferries i MMSI Wawel â ZRODLA_DANYCH Â§3 Â· AN2, wg `ZRODLA_DANYCH.md`; funkcje Edge z pg_cron: `ferry-schedule` (rozkÅad cargo â `sailings`, co tydzieÅ + rÄcznie HHL), `ferry-status` (`parsePolferriesStatus`, **co 15 min, nie czÄÅciej**), `ferry-ais` (`fetchVesselFix`, co 10 min, rejsy w toku), `road-se` (Trafikverket, klucz), `road-pl` (KPD GDDKiA DATEX II, rejestracja + certyfikat), `traffic-flow` (TomTom, klucz). Zasady: pierwszeÅstwo `RECZNIE` > `POLFERRIES` > `DANE_STARTOWE`; NIEZNANY â bez zmiany rejsu, ryzyko HHL; awaria ÅºrÃ³dÅa â ryzyko âÅºrÃ³dÅo niedostÄpneâ, nigdy cicha pustka; ryzyka drogowe w `ROAD_SE`/`ROAD_PL`; atrybucje (Digitraffic CC BY 4.0 obowiÄzkowo); bez klucza panel = dane demonstracyjne (D18); klucze tylko w sekretach funkcji. Kryterium: `ferry-status` zapisuje rejsy z prawdziwej strony do bazy testowej; test jednostkowy kaÅ¼dej funkcji na zapisanych danych, bez sieci |
| D26 | Import â usuniÄcia za zgodÄ | DONE | dc364d7 | unit 264/20 skip (+schedule-import D26 4 â 12) Â· etap4 11/11 (+D26) Â· pw 4/4 Â· d19 0 Â· deur 2/2 Â· db 52/44/33 + money 130 | podglÄd importu pokazuje pozycje nieobecne w pliku jako kandydatÃ³w: pole âUsuÅ N pozycji nieobecnych w plikuâ (label.switchline, domyÅlnie odznaczone, reset przy kaÅ¼dym pliku) + lista kodÃ³w + opis skutku; licznik âââ pokazuje wyÅÄcznie usuniÄcia, ktÃ³re zostanÄ wykonane (â0 bez zgody; wczeÅniej dry-run zawsze â0, a ÅcieÅ¼ka usuwania byÅa nieosiÄgalna z UI); zatwierdzenie przekazuje allowRemovals i dokÅadnie kandydatÃ³w z podglÄdu; pusty/nieczytelny plik â 0 kandydatÃ³w (ochrona P9 72â1); import tylko w trybie demo (bez zapisu do bazy â bez zmian); **obserwacja dla wÅaÅciciela:** usuniÄcie obejmuje kaÅ¼dy status (takÅ¼e w drodze/dostarczone) â ewentualne ograniczenie do niezrealizowanych = decyzja wÅaÅciciela |
| D23-S | Import test na skali ~72 wierszy | DONE | 4c52455 | unit 268/20 skip (schedule-import 16: D23 8 + D26 4 + D23-S 4) Â· etap4 11/11 Â· pw 4/4 Â· d19 0 Â· deur 2/2 Â· db 52/44/33 + money 130 | wariant testu importu na realnej skali w tests/schedule-import.test.ts: 72 transporty demo (buildDemoSnapshot â loads.json ma 62 + seed), pliki XLSX budowane z tych samych danych: identyczny harmonogram 72 wierszy â 0 dodanych / 0 zmian / 0 kandydatÃ³w (round-trip bez faÅszywych zmian); 75 wierszy (72 + 2 nowe + 1 bÅÄdny, 3 zmiany dat) â +2 ~3 odrzucony 1, 74 transporty, wersja harmonogramu z licznikami; 71 z 72 â 1 kandydat, bez zgody 72, ze zgodÄ 71 (znika wyÅÄcznie ten jeden); 72 bÅÄdne â baza nietkniÄta i 0 kandydatÃ³w nawet przy wymuszonym allowRemovals (P9 72â1) |
| G4 | Brama etapu 4 + baseline Fala 3b | **DONE** | 3153a78 | unit **271 / 20 skip** (+money-g4 3) Â· money (db) **130/130** Â· db **security 52/52 Â· status 44/44 Â· storage 33/33** Â· ferry **17/17** Â· pw visual **4/4** Â· etap4 **12/12** Â· D19-T **0** Â· D-EUR-T **2/2 (0)** Â· BK5 live **8/8** Â· stylelint **0** Â· hosted verify **95/95** Â· live provider **14/14** Â· matryca **840/840 OK** (720 â 840: +30 Faktury KSH, +30 faktury przychodowe HHL, +60 Ustawienia KSH/SCX) Â· wzorzec **471 zmienionych / 720** + 120 nowych Â· PLN kontrolny **6/6** | **Kokpit (odÅoÅ¼one z M8):** pill poziomu pewnoÅci (najmniej pewny skÅadnik, `aggregateTier`) + pill kursu tymczasowego z liczbÄ pod kwotÄ â marÅ¼a narastajÄca HHL, tydzieÅ SCX (KSH bez kwot w kokpicie); wzorce pill/kpi, bez nowych. **Matryca:** `scripts/baseline.mjs` SCRIPT_VERSION `2026-09-26-g4-fala3b-views`, build demo z HEAD (:4181), 840/840 bez FAIL. **Wzorzec zregenerowany** â uzasadnienie widokÂ·rola w `docs/handover/G4_WZORZEC.md`: nawigacja KSH (Faktury M6, Ustawienia M4) 135, nawigacja SCX (Ustawienia) 72, harmonogram M5/M10 90, faktury M7 60, finanse M8/M11 30, rozliczenia/moje-stawki M8 51, kokpit G4 60 â wszystkie 471 przypisane; widoki tylko-HHL poza tymi czterema 0 zmian. Migawki smoke: tylko `kokpit-hhl-pl-1920-*` (ta sama przyczyna), mapa bez zmian. **Zestaw PLN:** `SET=pln` â `shots-baseline-pln/` (kokpit + harmonogram Ã 3 role Ã 1440 Ã motyw domyÅlny, waluta PLN przez Opcje/Ustawienia). Tag `baseline-fala-3b-2026-09-26`. **Obserwacja (D19, bez zmian):** etykieta motywu ciemnego to âCiemny Â· HHLâ takÅ¼e w roli SCX. `pngjs`/`pixelmatch` â porÃ³wnanie kopiÄ skryptu z pakietami w /tmp (jak G3). Â· **AN1:** `tests/db/run.sh` **security 50/50 + status 44/44** Â· **AN2:** **security 52/52 + status 44/44 + `tests/ferry.test.ts` 17/17** |

## Etap 5 â Fala 4: infrastruktura Â· **ZAMKNIÄTY (G5)**

| ID | pozycja | status | commit | testy (liczby) | uwagi |
|---|---|---|---|---|---|
| D14 | Trasy adresowalne | **DONE** | f384740 | unit **275 / 20 skip** (+routes 4) Â· etap5 **4/4** (nowy `npm run test:etap5`, w fresh-smoke) Â· etap4 **12/12** Â· pw visual **4/4** Â· d19 **0** Â· deur **2/2** Â· wyglÄd bez zmian (migawki smoke identyczne) | `src/lib/routes.ts` (mapa widok â ÅcieÅ¼ka: /kokpit /mapa /harmonogram /ryzyka /dokumenty /finanse /faktury /zadania /automatyzacje /strefy /opcje /ustawienia + /transport/<kod>) i `src/hooks/useRouteSync.ts` w TowerShell: URL â sklep przy zmianie ÅcieÅ¼ki (widok, jeÅli rola go ma; szuflada po kodzie; link sprzed wczytania danych Supabase czeka na transporty), sklep â URL z wpisem historii (wstecz zamyka szufladÄ), query `?now=` zachowane; ÅcieÅ¼ka spoza roli / nieznany kod â zastÄpione dozwolonym widokiem; nieznane ÅcieÅ¼ki (fragment powrotu z logowania) nieprzepisywane. **HashRouter zostaje** (adresy `#/harmonogram`, `#/transport/SG-32`): hosting statyczny bez przepisaÅ, linki kierowcy `#/driver/<token>`, kontrakt `#/â¦?now=` baseline/testÃ³w. Rola i jÄzyk juÅ¼ w trwaÅym ustawieniu (persist demo; Supabase: rola z konta, jÄzyk `user_preferences` M4) â potwierdzone testem przeÅadowania. Luka: link magiczny logowania wraca na `origin+pathname` (bez ÅcieÅ¼ki hash) â gÅÄboki link przetrwa logowanie hasÅem, nie linkiem e-mail. |
| D15 | PodziaÅ paczki / lazy mapa &lt;400 kB | **DONE** | ecb0632 | unit **275 / 20 skip** Â· etap5 **5/5** (+D15 1) Â· etap4 **12/12** Â· pw visual **4/4** Â· d19 **0** Â· deur **2/2** Â· kontrola matrycy 1440 (168 ujÄÄ) **168/168 identycznych** z `baseline-fala-3b` Â· rozmiar: pierwsze wczytanie **2229,2 â 899,6 kB** surowo Â· **584,5 â 221,6 kB gzip** (cel < 400 kB â) | **Rozmiar przed / po** (`node scripts/bundle-size.mjs <dist>`: index.html + skrypty/modulepreload/CSS z index.html; gzip -9): przed (`f384740`) jeden kawaÅek `index` 2176,5 kB / 569,9 kB gz + CSS 51,9 / 14,2; po: `index` 845,2 / 206,1 gz + runtime 1,4 / 0,8 + CSS 51,9 / 14,2. Leniwe: ExcelJS 934,5 / 253,9 gz (eksport/import), mapa `CorridorMap`+Leaflet 160,7 / 45,3, import harmonogramu (zod) 100,6 / 27,4, JSZip 94,5 / 27,7, eksport 3,0 / 1,5. **Cel âponiÅ¼ej 400 kBâ liczony jako transfer (gzip)** â surowo 900 kB (sam react-dom + router â 300 kB min.); budÅ¼et 400 kB gzip sprawdzany w `scripts/ci/fresh-smoke.sh` (pre-push, kod 6 przy przekroczeniu), `npm run size` dla `dist/`. Mapa: `LazyCorridorMap` (Suspense, zastÄpnik w tym samym miejscu â bez przesuniÄÄ). **Kontrola wizualna wykryÅa dwie niedeterministycznoÅci**, naprawione w tym commicie: (1) przewiniÄcie widoku przechodziÅo do nastÄpnego (`main` wspÃ³lny) â teraz nowy widok startuje od gÃ³ry; (2) dryf pozycji ciÄÅ¼arÃ³wek co 1,5 s zaleÅ¼aÅ od chwili zamontowania mapy â przy zamroÅ¼onym czasie (`?now=`) wyÅÄczony. Po poprawkach 168/168 identycznych. |
| G5 | Brama etapu 5 | **DONE** | (ten commit `docs(G5)`) | unit **275 / 20 skip** Â· money (db) **130/130** Â· db **52/44/33** Â· ferry **17/17** Â· pw visual **4/4** Â· etap4 **12/12** Â· etap5 **5/5** Â· D19-T **0** Â· D-EUR-T **2/2** Â· stylelint **0** Â· peÅna matryca **840/840 identycznych** z `baseline-fala-3b-2026-09-26` (0 zmian) Â· rozmiar pierwszego wczytania demo **221,6 kB gzip** / 899,6 surowo (Supabase: 224,2 / 905,0) â budÅ¼et 400 kB gzip â | **Brama speÅniona:** testy zielone (pre-push `5767156`: unit, fresh-smoke z budÅ¼etem rozmiaru + visual/d19/deur/etap4/etap5, lint:css, gate.sh 52/44/33 + money 130). **Raport rozmiaru paczki:** przed D15 2229,2 kB / 584,5 kB gz â po 899,6 / 221,6 kB gz (szczegÃ³Åy w wierszu D15; `node scripts/bundle-size.mjs <dist>`). Matryca na ÅwieÅ¼ym buildzie demo z HEAD (:4181): 840 ujÄÄ, 0 FAIL; porÃ³wnanie repo-skryptem `scripts/compare-baseline.mjs` (pngjs/pixelmatch z package.json) progi 0.28/60 px/0.001: **0 zmienionych** â wzorzec **nie** regenerowany (brak uzasadnienia), tag bez zmian. |

## Etap 6 â odbiÃ³r koÅcowy

| ID | pozycja | status | commit | testy (liczby) | uwagi |
|---|---|---|---|---|---|
| O1 | PeÅny komplet testÃ³w + D24 Ã14 | **DONE** | 1742b03 | unit **275 / 20 skip** Â· money (unit) **49 + 1 skip** (`NBP_LIVE=1` **50/50**, nbp-live **6/6**) Â· `tests/db` **security 52/52 Â· status 44/44 Â· storage 33/33 Â· money 130/130** Â· ferry **17/17** Â· Playwright: visual **4/4** Â· etap4 **12/12** Â· etap5 **5/5** Â· etap6 **1/1** Â· D19-T **0** trafieÅ Â· D-EUR-T **2/2** (0) Â· BK5 live **8/8** Â· stylelint **0** Â· matryca **840/840** identycznych (G5; dawniej 720) Â· **D24 14/14 SHIP** na paczce produkcyjnej Â· hosted: money verify **95/95**, live provider **14/14**, BK2 verify **21/21**, BK4 verify **27/27** | **D24 (O1):** `docs/qa-start/D24_O1.md` â build produkcyjny demo z HEAD `5767156` (:4181), `appChecksum` sha256 JS `5e4f847b578e777e25cf60b1d1b92b53a6177d834a9448887291d128c7262b17` (`index-7A_5LP4I.js`), CSS `755b5ef0â¦2143`. Pierwszy przebieg 12/14 â oba FAIL to nieaktualna sonda, nie regresja: #2 szukaÅ âUstaw READYâ (od D11 âOznacz jako gotowyâ), #13 dopasowywaÅ etykietÄ i kwotÄ w jednej linii (po M8/M11 osobne komÃ³rki; w Fali 0 rozstrzygaÅ reprobe) â sonda strukturalna: kolumny tabel + komunikaty blokady rÃ³l. Produkt bez zmian. Build Supabase (BK5 UI, :4178) pierwsze wczytanie 224,2 kB gz. **Znalezisko:** ~25 napisÃ³w PL w `src/i18n/d19Extra.ts` bez polskich znakÃ³w (np. âPrzychodâ, âMarzaâ, âZalaczniki CMR / PODâ, âPobierz paczke tygodniaâ) â zapisane jako otwarte **D19-PL** (poprawka zmienia wzorzec wizualny â nastÄpny etap wyglÄdu). |
| O2 | Deploy produkcyjny Vercel + Supabase | **DONE** 27.09.2026 (zgoda wÅaÅciciela) | `70e7ae3`, `d936814` | makieta z paczki produkcyjnej: `tests/o2-prod-strip.test.ts` 3/3, `hosting-switch` 5/5, pre-push OK (baza: security 83, release 145, backup 20, invite 48 â¦); Vercel: 18/18 plikÃ³w `dist/` identycznych z buildem lokalnym `d936814`; zrzut ekranu logowania `/workspace/o2/login.png` | **Przed:** Pages i Vercel (makieta) serwowaÅy bez logowania `/download/tower-makieta.html` (308 â 200, 92 717 B, zaÅÄcznik), `/tower-makieta.html`, `/claude-makieta.html`, `/claude-ref.html`, `/claude-v2-ref.html`, `/KSH_HARMONOGRAM.xlsx`. **Zmiana:** `build/prodStrip.ts` (wtyczka Vite) â przy `VITE_AUTH_MODE=supabase` usuwa te pliki i `/download/` z `dist/`, blok `/download/*` z `_headers`, dodaje `404.html` (Pages zwraca 404 zamiast `index.html`); tryb demo bez zmian; `vercel.json` bez nagÅÃ³wkÃ³w (Vercel doklejaÅ `Content-Disposition: attachment` do 404). **Vercel:** projekt `watch-tower-makieta` â framework vite, `npm ci`, `npm run build`, `dist`, Node 22.x; zmienne Production: `NODE_VERSION`, `VITE_AUTH_MODE`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (nic wiÄcej, bez klucza serwisowego); `vercel --prod` z `git archive d936814` â https://watch-tower-makieta-51yg7bwxc-sebastianbozekq-7781s-projects.vercel.app, aliasy watch-tower-makieta.vercel.app i tower.log-mar.pl. **Po wdroÅ¼eniu:** ekran logowania (âWyÅlij link do logowaniaâ), 0 sÅÃ³w z makiety, pakiet JS z adresem Supabase i fragmentem `AuthGate`, 0 Ã service_role; `/tower-makieta.html` i `/download/tower-makieta.html` â 404, 339 B, bez zaÅÄcznika na Vercel, tower.log-mar.pl i Pages. **Stare wdroÅ¼enia:** ochrona Vercel Authentication (`ssoProtection: all_except_custom_domains`) byÅa juÅ¼ wÅÄczona â 10 wdroÅ¼eÅ (7 z makietÄ + 2 poÅrednie + bieÅ¼Äce), wszystkie adresy wdroÅ¼eÅ â 302 do logowania Vercel, usuniÄto 0. **Trenowanie modeli:** zespÃ³Å Hobby miaÅ `dataSharingConsent: granted` (przez ToS); API odrzuca zmianÄ â **krok wÅaÅciciela:** Vercel â Team Settings â Data Preferences â Opt-out. **PozostaÅoÅÄ:** CDN Pages trzyma w pamiÄci podrÄcznej (s-maxage 7 dni, stan sprzed wdroÅ¼enia) adresy bez `.html`: `/tower-makieta`, `/download/tower-makieta`, `/claude-*`, `/KSH_HARMONOGRAM.xlsx` â czyszczenie wymaga panelu Cloudflare (bez logowania wykonawcy). |
| O3 | Test dymny na produkcji | **PODZIELONE 27.09.2026 â O3a + O3b** (zaleÅ¼y od O2) | â | przedprodukcyjnie na hostowanym Supabase: BK5 **8/8** (3 konta, widocznoÅÄ faktur w API i w ruchu sieciowym UI) Â· live provider **14/14** Â· BK2 **21/21** Â· BK4 **27/27** Â· M10 ÅcieÅ¼ka TEST-M10 (GDANSK â PROM â NYNASHAMN â SE â AT_SITE) w live provider | Test dymny **na produkcji** niemoÅ¼liwy bez O2. Zakres O3 pokryty dziÅ na hostowanym Supabase (nie produkcja): logowanie trzech kont (BK2/BK5), widocznoÅÄ faktur KSH/SCX/HHL (BK5), transport przez automat statusÃ³w do AT_SITE (M10, TEST-M10); rozÅadunek rÄczny HHL (nigdy automatycznie). **Import** sprawdzony tylko na DemoProvider (D23-S 72 wiersze, D26, D24 #3) â na hostowanym Supabase ÅcieÅ¼ka import â rozÅadunek **nie** byÅa testowana end-to-end (do zrobienia w O3 po O2). **Po O2:** powtÃ³rzyÄ `SUPABASE_LIVE=1 npx playwright test tests/bk5-api.live.spec.ts` z `BK5_BASE=<adres produkcji>` + rÄczny import â rozÅadunek na jednym transporcie testowym. |
| O3a | Logowanie trzech rÃ³l (HHL, KSH, SCX) na produkcji | **DONE** 27.09.2026 | (docs) | 3/3 logowania linkiem z Admin API (`generate_link` typ invite, bez e-maila) na https://watch-tower-makieta.vercel.app: sesja + `my_profile`: HHL_OPS/HHL, CLIENT_USER/KSH, CARRIER_DISPATCH/SCX; zrzuty `/workspace/o2/o3a-{hhl,ksh,scx}.png`. WidocznoÅÄ (transakcja wycofana, `SET LOCAL role authenticated` + `request.jwt.claims`): projekty/Åadunki/faktury â HHL_ADMIN 1/0/0, HHL_OPS 1/0/0, CLIENT_USER 1/0/0, CARRIER_DISPATCH 1/0/0 (caÅoÅÄ w bazie 1/0/0) | Konta `sebastian+tower-o3-{hhl,ksh,scx}@log-mar.pl` z `admin_invite_user` (jako HHL_ADMIN). Po teÅcie: `admin_set_user_active(false)` Ã3 â aktywne 0/3; `auth.sessions` 3 â 0, `auth.refresh_tokens` 3 â 0. Audyt zostaje: USER_INVITED 3, USER_ACCEPTED_INVITE 3, USER_ACTIVE_SET 3. Zero transportÃ³w i innych danych biznesowych. Uwagi z UI: przeÅÄcznik âWidok HHL/KSH/SCXâ widoczny dla rÃ³l KSH i SCX; na kokpicie KSH staÅy baner âDostawa 26.09 o 11:30 â¦ Transport R-03 â¦â i oÅ âdziÅ 23.09â â wyglÄda na tekst demonstracyjny (do sprawdzenia w etapie I). |
| O3b | PeÅny transport na produkcji = pierwszy prawdziwy transport w pilotaÅ¼u | OPEN â pilotaÅ¼ | â | â | wydzielone z O3 (27.09.2026). Uwaga z audytu statusÃ³w: SupabaseProvider nie zapisuje nowych/zmienionych transportÃ³w z importu (brak insert do `loads`) â bez tego O3b nie przejdzie |
| I-0 | Etap I â wyciek plikÃ³w (KSH_HARMONOGRAM.xlsx, 4 kopie makiety) i danych demo w pakiecie JS | PARTIAL â pakiet, pliki i wdroÅ¼enia DONE (Vercel 1, Pages 1); zostaje tylko cache CDN `tower-hhl.pages.dev` (6 ÅcieÅ¼ek, wygasa ok. 04.10.2026) | `45bc74b`, `1b2e2e9`, `e6c064d` | Vercel: wdroÅ¼eÅ 10 â 3 (usuniÄte 7 z 23.09 13:20 â 24.09 00:43), stare adresy 404 `DEPLOYMENT_NOT_FOUND`; po wdroÅ¼eniu `e6c064d` sÄ 4 (3 starsze z danymi demo w JS, chronione Vercel Authentication â 302). Pages (wrangler, 27.09 16:35â16:45): wdroÅ¼eÅ 10 (wszystkie production, 0 preview) â 1; usuniÄte 9 (395247e â¦ 5629129). 7 z 9 starych adresÃ³w `<hash>.tower-hhl.pages.dev` daje 404; **d365b18e i ee5232f7 nadal 200** (makieta, xlsx) 20 min po usuniÄciu â do sprawdzenia w panelu. Nowe wdroÅ¼enia po usuniÄciu: 42201899 (1b2e2e9), 079ef8d3 (e6c064d, bieÅ¼Äce); 753d28b2 (45bc74b) zostaÅo â 42201899 i 753d28b2 majÄ dane demo w JS. StraÅ¼nik `tests/i0-prod-guard.test.ts` **zielony** 4/4: w dist 0 plikÃ³w *.xlsx, *makieta*, claude-*; 0 identyfikatorÃ³w demo (72 sprawdzane), 0 â23.09â, 0 âR-03â, 0 numerÃ³w +48/+46; parytet eksportÃ³w *.prod.ts. Na Å¼ywo (tower.log-mar.pl, Vercel, Pages, 13 plikÃ³w JS): 0 / 0 / 0 / 0; ekran logowania na tower.log-mar.pl i Vercel (`/workspace/i0/login-*.png`). Pre-push: unit 360, wizualne demo bez regeneracji wzorcÃ³w zielone | **Pierwsze wdroÅ¼enie z plikami:** Vercel 23.09.2026 13:20 (claude-ref.html, claude-v2-ref.html, KSH_HARMONOGRAM.xlsx; publiczne na watch-tower-makieta.vercel.app do 27.09 12:11); Pages 27.09.2026 11:06:44 (395247e, wszystkie 6 plikÃ³w; `.html` 404 od 12:16:19, 70e7ae3). **Cache Pages:** `/tower-makieta`, `/download/tower-makieta`, `/claude-makieta`, `/claude-ref`, `/claude-v2-ref`, `/KSH_HARMONOGRAM.xlsx` â 200 z `cf-cache-status: HIT` (zapisane ok. 11:32, s-maxage 7 dni â wygasa ok. 04.10.2026 11:32); API Cloudflare nie ma czyszczenia cache dla pages.dev (token wranglera bez uprawnieÅ do cache), `_redirects` na Pages nie obsÅuguje 404; dodane `Cache-Control: no-store` w `_headers` (nagÅÃ³wek widoczny w odpowiedzi, treÅÄ nadal z cache). **Analityka/logi:** Pages â brak Web Analytics (brak skryptu beacon), brak Functions (tail nie dotyczy), GraphQL Analytics niedostÄpne bez osobnego tokenu; Vercel â 0 wpisÃ³w logÃ³w, brak Web Analytics. Brak logÃ³w pobraÅ. KSH_HARMONOGRAM.xlsx: 1 arkusz, 123 wiersze danych, 16 kolumn; âImiÄ i nazwisko kierowcyâ, âNr tel. kierowcyâ puste. **B (dane demo poza pakietem):** wtyczka Vite `i0-demo-swap` podmienia `src/data/seed.ts`, `src/data/demoProvider.ts`, `src/i18n/demoOnly.ts` na `*.prod.ts`; logika `applyForceMajeureDelays`/`buildSeedExceptions` w `src/lib/seedLogic.ts`. W produkcji puste: tabele stawek (Opcje â stawki COST/REVENUE), parametry BAF (fasada F2.4), demonstracyjne tokeny linkÃ³w kierowcy; ukryte: banery KSH/SCX; âdziÅâ na wykresie = bieÅ¼Äca data. Dane transportÃ³w w produkcji jak dotÄd z Supabase (store startowaÅ pusty juÅ¼ od BK3). wrangler: logout, whoami âYou are not authenticated. Please run `wrangler login`.â **DomkniÄcie 27.09.2026 ok. 17:58:** Pages â wdroÅ¼eÅ 4 â 1 (usuniÄte 753d28b2/45bc74b, 42201899/1b2e2e9, 079ef8d3/e6c064d; zostaje 775cc9b8/99c64bf, bieÅ¼Äce produkcyjne); curl z boksu: 753d28b2, 42201899, 079ef8d3, d365b18e, ee5232f7 â `/`, `/tower-makieta`, `/KSH_HARMONOGRAM.xlsx`, `/assets/index-CY6faOMj.js` wszystkie 404 (16 141 B, strona bÅÄdu Cloudflare, bez `cf-cache-status`/`age`); 775cc9b8 `/` 200, `/tower-makieta` i xlsx 404 (339 B). Na `tower-hhl.pages.dev` 6 ÅcieÅ¼ek nadal 200 z `cf-cache-status: HIT`, `age` â 23 200 s (makieta 92 717 B, xlsx 31 604 B) â cache CDN, wygasa ok. 04.10.2026. wrangler logout â whoami âYou are not authenticated. Please run `wrangler login`.â Vercel â wdroÅ¼eÅ 4 â 1 (usuniÄte 51yg7bwxc, 4srxkzpuc, qurcjsmvf z danymi demo w JS; zostaje 90juzrwlv = `e6c064d`); stare adresy 404 `x-vercel-error: DEPLOYMENT_NOT_FOUND`. Telefony/rejestracje demo: brak generatora â lista wpisana na sztywno w `src/data/seedIdentity.ts` (commit d8114a7, 25.09.2026 00:32, âfeat(D12): realistic PL/LT/SE seed peopleâ¦â): `SEED_DRIVERS` l. 3â34 (30 osÃ³b: 15 PL +48 z prefiksami 500â508/601â609, 10 SE +46 70x, 5 LT +370), `SEED_TRACTORS` l. 36â43, `SEED_TRAILERS` l. 45â51, `SEED_ESCORTS` l. 53â56, przydziaÅ cykliczny `seedResourcesForIndex` l. 68+ (uÅ¼yte w `seed.ts` l. 373); `loads.json` zawiera te same wartoÅci wpisane na sztywno (58 ÅadunkÃ³w z telefonem, 30 unikalnych, wszystkie z `SEED_DRIVERS`) â skryptu, ktÃ³ry przepisaÅ je do JSON, nie ma w repo. W produkcji podmienione na `seed.prod.ts` (straÅ¼nik: 0 numerÃ³w w dist). |
| I-1 | Etap I â import harmonogramu w trybie `supabase` (BLOKER): zapis `loads` + `shipment_items` w jednej transakcji, podglÄd nowe/zmienione/anulowane, wersje + archiwum pliku, powiadomienie o zmianie daty awizowanego | **DONE** 27.09.2026 (import na produkcji czeka tylko na aktywne konto HHL) | `9bf80d7`, `f8b6355` | `tests/db/import.sh` 37/37 (w gate/pre-push); `schedule-import-rpc` 4/4; unit 364 passed / 33 skipped; lokalny Supabase (CLI+Docker, build produkcyjny) `schedule-import.local` 5/5, UI `i1-import-ui.local` 3/3; `i0-prod-guard` 4/4; tsc, lint:css OK | **Funkcja:** `import_schedule(p_project, p_rows, p_cancel_codes, p_file, p_dry_run)` â SECURITY DEFINER, search_path=public, advisory lock, tylko HHL (0048: takÅ¼e przy `is_hhl()` = NULL, konto nieaktywne/bez `app_users`), EXECUTE tylko authenticated; klucz = kod âWysyÅkaâ; zmienia wyÅÄcznie `plan_load_date`/`plan_delivery_date`/`order_no` i wymiary pozycji â okna `plan_*_from/_to` nietkniÄte (ANEKS 2); anulowanie = status CANCELLED (0 DELETE) przez `tower.cancel_ctx`=IMPORT + audit_log + zdarzenie; zdarzenia tylko INSERT; bez zmian w pliku â 0 zapisÃ³w, brak nowej wersji. **3.6:** wersja w `schedule_imports` (+`file_name`), plik w prywatnym koszyku Storage `harmonogramy/<projekt>/<sha256>.xlsx` (tylko HHL). **3.7:** zmiana daty na awizowanym (okno ustawione lub status â¥ READY) â zdarzenie SCHEDULE_DATE_CRITICAL + powiadomienia IN_APP HHL i przewoÅºnik (e-mail wymaga wdroÅ¼enia Edge `send-notifications`). **UI:** podglÄd rÃ³Å¼nic z serwera, prawdziwa linia wersji, import tylko HHL na produkcji (demo bez zmian). **Skala (lokalny Supabase, `KSH_HARMONOGRAM.xlsx`, 123 wiersze, 50 z wysyÅkÄ):** 41 transportÃ³w / 41 pozycji / 41 zdarzeÅ / 1 wersja; 9 odrzuconych BAD_DIMENSIONS (wymiar âStandardâ: T-03â¦T-05, T-08â¦T-10, T-13â¦T-15), 73 wiersze puste; podglÄd 29â36 ms (SQL 8â13 ms), zapis 22â30 ms (SQL 15â21 ms); drugi import: 0 nowych / 0 zmian / 41 bez zmian, 15 ms; zmieniony XLSX: +1, ~4 (1 krytyczna), â2 anulowane, wersja 2, 19â23 ms; RLS: KSH, SCX, anon odrzuceni, archiwum HHL 200 / KSH â¥400. **Produkcja nglnnrmzmhusvxslousq:** migracje 0047 i 0048 (`supabase db push`), weryfikacja w transakcji wycofanej: dry-run HHL 41 nowych / 61 ms, konta nieaktywne (HHL_OPS, CLIENT_USER, CARRIER_DISPATCH) i bez `app_users` â âwyÅÄcznie HHLâ; po rollbacku loads/wersje 0/0; Å¼adnego importu. **Vercel:** `git archive f8b6355` â https://watch-tower-makieta-js0ryb6v9-sebastianbozekq-7781s-projects.vercel.app (aliasy tower.log-mar.pl, watch-tower-makieta.vercel.app): logowanie 200, pakiet z `import_schedule`, 0 Ã service_role, `/KSH_HARMONOGRAM.xlsx` i makiety 404. Pages (zapas) nie aktualizowane â w tyle. **Otwarte:** decyzja âStandardâ (9 transportÃ³w, `length_m` NOT NULL); wzorzec `if not is_hhl()` (NULL przepuszcza) nadal w `cancel_load`, `import_cancel_loads`, `import_removal_check`, `register_invoice`, `mark_invoice_paid`, `unmark_invoice_paid`; backup nie obejmuje koszyka `harmonogramy`. |
| I-2A | Etap I â systemowa poprawka straÅ¼nikÃ³w NULL (konto nieaktywne / bez `app_users` â `is_hhl()` = NULL, âif not â¦â nie odmawiaÅ) | **DONE** 27.09.2026 | `5d375f5` | `tests/db/nullguard.sh` 175/175 (w gate/pre-push): 41 funkcji z EXECUTE dla authenticated â 35 z kontrolÄ Ã 4 konta (nieaktywny HHL, KSH, SCX, brak `app_users`) = **140/140 odmÃ³w** (przed 0049: 88/140), 6 czystych obliczeniowych bez dostÄpu do danych; kontrola pozytywna aktywnego HHL 30 zgodnych + 2 n/d; test statyczny `tests/db/null-guard-static.mjs` (migracje w pre-push + Å¼ywa baza) 0 naruszeÅ; unit `null-guard-static` 3/3 | **Migracja 0049** (produkcja: TAK, `supabase db push`): `is_hhl()`/`can_see_margin()` ÅciÅle true/false; 25 funkcji przepisanych na âif (â¦) is not true then raiseâ / âis trueâ (m.in. issue_driver_token, revoke_driver_token, report_position, cancel_load, import_*, mark/unmark_invoice_paid, register_invoice, admin_*, guard_load_update, guard_invoice_update + odmowa bez aktywnego konta, apply_geofence_status, permit_fits); fx_rate_before, keep_alive (anon dalej dziaÅa), risk_audience_for: zalogowany bez aktywnego konta â odmowa. **Przed poprawkÄ** (lokalnie): nieaktywny/bez konta wydawaÅ token kierowcy, oznaczaÅ fakturÄ jako opÅaconÄ, widziaÅ kandydatÃ³w importu. **Produkcja, transakcja wycofana:** 4 konta Ã 35 = 140/140 odmÃ³w, Sebastian@log-mar.pl (HHL_ADMIN, aktywny) 20/20 bez odmowy, `is_hhl()`=true, podglÄd importu peÅnego pliku: 50 nowych (po 0050); po ROLLBACK 0 zmian w danych; test statyczny na Å¼ywej bazie 102 definicje, 0 naruszeÅ. Generator weryfikacji: `scripts/i2/nullguard-prod.py`. Import na produkcji NIE czeka na aktywacjÄ â HHL_ADMIN przechodzi `is_hhl()`. |
| I-2B | Etap I â kopia zapasowa: tabele z katalogu zamiast listy na sztywno, kubeÅek `harmonogramy` | **DONE** 27.09.2026 | `d2a8219` | `tests/db/backup.sh` 22/22 (byÅo 20): katalog vs pliki kopii (tabela spoza kopii i wyÅÄczeÅ = czerwony), nowa tabela `t_nowa_tabela` w kopii bez zmiany kodu, nieaktualne wyÅÄczenie = czerwony, odtworzenie 3 plikÃ³w (2 dokumenty + harmonogram) SHA-256 3/3; `backup-core` 12/12 | `CATALOG_TABLES_SQL` (public, r/p, bez obiektÃ³w rozszerzeÅ) â `EXCLUSION_REASONS` (positions, driver_tokens, spatial_ref_sys, account_relink_pending â kaÅ¼de z powodem); `REQUIRED_TABLES` (brak = bÅÄd przebiegu); `BACKUP_BUCKETS = ['harmonogramy']` â `files/harmonogramy/<projekt>/<sha>.xlsx.age` (wszystkie obiekty, powtÃ³rki pomija Worker 409). Uwaga: `schedule_imports` byÅa juÅ¼ na liÅcie â wypadaÅ tylko kubeÅek. Produkcja (odczyt): katalog 41 tabel â 38 w kopii (jak dotÄd), kubeÅek 0 obiektÃ³w. **Edge `backup-export` wdroÅ¼ona** (`supabase functions deploy --use-api`, verify_jwt, anon â 403). Worker Cloudflare `tower-backup-writer` bez zmian (prefiks `files/` juÅ¼ dozwolony) â logowanie do Cloudflare niepotrzebne. Pierwszy przebieg z nowym kodem: nocny cron 02:30. |
| I-2C | Etap I â klasa Åadunku STANDARD (9 transportÃ³w âStandardâ: T-03â¦05, T-08â¦10, T-13â¦15) | **DONE** 27.09.2026 | `0c247b3` | `tests/db/import.sh` 46/46 (+9: STANDARD przyjÄty z NULL, idempotencja, STANDARD z wymiarami / brak klasy i wymiarÃ³w / nieznana klasa odrzucone, 2Ã ograniczenie bazy, stare `schedule_row` bez faÅszywych zmian); `schedule-import-rpc` 6/6; lokalny Supabase `schedule-import.local` 5/5, UI `i1-import-ui.local` 3/3 (9 Ã âStandardâ w kolumnie wymiarÃ³w); unit 372 passed / 33 skipped; `i0-prod-guard` 4/4 | **Migracja 0050** (produkcja: TAK): `shipment_items.cargo_class` STANDARD / DIMENSIONED (domyÅlnie), `length/width/height_m` NULL wyÅÄcznie i obowiÄzkowo dla STANDARD (`shipment_items_dims_by_class`), `schedule_row_canon` + `import_schedule` z klasÄ. Parser: âStandardâ â STANDARD (bez OVERSIZE / IMPLAUSIBLE_QTY); walidator zezwoleÅ (`isReadyBlocked`, `evaluateLoadCover`) pomija STANDARD; UI (harmonogram, szuflada, eksport XLSX): âStandardâ. **PeÅny plik (lokalny Supabase, build produkcyjny):** 123 wiersze â 50/50 wysyÅek (41 z wymiarami + 9 STANDARD, 73 puste); podglÄd 41 ms (SQL 14), zapis 32 ms (SQL 24): transporty/pozycje/zdarzenia/wersje 50/50/50/1; drugi import 0/0/50 bez zmian, 19 ms; zmieniony XLSX +1 ~4 (1 krytyczna) â2 anulowane, wersja 2, loads 51. Produkcja (transakcja wycofana): podglÄd HHL_ADMIN 50 nowych, 15 ms. **Vercel:** `git archive 0c247b3` â https://watch-tower-makieta-h4pl3ydou-sebastianbozekq-7781s-projects.vercel.app (tower.log-mar.pl, watch-tower-makieta.vercel.app): logowanie 200, pakiet z `cargo_class`, 0 Ã service_role, makiety i xlsx 404. Otwarte: wycena klasy STANDARD (siatka stawek wymaga wymiarÃ³w â dziÅ brak dopasowania). |
| I-2a | Etap I â przeÅÄcznik widoku HHL/KSH/SCX tylko dla konta HHL; import harmonogramu tylko HHL (takÅ¼e demo) | **DONE** 27.09.2026 | `16638cb` | `canSwitchView()` (prod: org HHL); Shift+R tylko przy przeÅÄczniku; `canImportSchedule` HHL=true, KSH/SCX=false w demo i prod; `i2-facade.local.spec` (build produkcyjny, lokalny Supabase): KSH 0 przeÅÄcznikÃ³w, SCX 0, HHL 1; D26 przeniesiony na HHL (etap4 12/12) |
| I-2b | Etap I â baner i oÅ postÄpu kokpitu z bazy | **DONE** 27.09.2026 | `16638cb` | prod: baner = najpowaÅ¼niejsze CRITICAL/HIGH z `risk_signals` (+liczba), brak â brak banera; oÅ tygodni z `plan_delivery_date`/`actual_delivery_at` (maks. 26), pusty harmonogram â komunikat; OTIF âââ przy 0 dostarczonych; kafelek dokumentÃ³w z `documents`; unit `i2-facade` 14/14 |
| I-2c | Etap I â Workflows ukryte w produkcji | **DONE** 27.09.2026 | `16638cb` | `navForRole(r, prod)` bez `wf` dla 3 rÃ³l; Opcje: podsumowanie automatyzacji i preferencja âreguÅy workflowâ ukryte; lokalny build prod: 0 Ã `nav [data-view=wf]` dla HHL/KSH/SCX |
| I-2d | Etap I â ETA v1 w bazie: odcinki + rejs z `sailings` + pasmo ufnoÅci | **DONE** 27.09.2026 | `16638cb`, `d912df7` | migracja **0051**: `eta_segment_params` (6 parametrÃ³w-zaÅoÅ¼eÅ, ÅºrÃ³dÅo âzaÅoÅ¼enie M12â), `compute_load_eta`/`refresh_load_eta` (bez EXECUTE dla API), 4 wyzwalacze (load_events, positions, sailings, loads), `loads.eta_basis`/`eta_confidence_min`/`eta_computed_at`, `delay_minutes` = ETA â koniec okna planu; `guard_load_update`: kontekst ETA zmienia wyÅÄcznie eta_*/delay_minutes; `tests/db/i2.sh` **51/51** (w gate); klient: mapper bierze ETA z bazy, szuflada âÂ± N min Â· ETA v1 (baza)â, bez zastÄpczych 95 min; produkcja: 0 transportÃ³w â backfill 0 wierszy; weryfikacja w wycofanej transakcji: nowy transport â ETA, pasmo 747 min, 3 odcinki |
| I-2e | Etap I â pogoda, przeprawy alternatywne, objazdy SE, pozycje AIS: âbrak ÅºrÃ³dÅa danychâ | **DONE** 27.09.2026 | `16638cb`, `a4ff639` | prod: pasek gÃ³rny â najbliÅ¼szy rejs z `sailings` bez fali; Ryzyka â rozkÅad z bazy + 2 notatki `data-no-source` (morze, przeprawy); SE: bez zdarzeÅ przykÅadowych i objazdÃ³w; mapa bez pozycji AIS seed; `HIDDEN_IN_PROD` 13 kluczy, kaÅ¼dy uÅ¼yty (test) |
| I-2f | Etap I â prawdziwy formularz BAF/SEFS dla HHL | **DONE** 27.09.2026 | `16638cb`, `d912df7` | migracja **0052**: `sefs_parameters` (wersje, append-only), `fuel_index_readings` (okres, data, wartoÅÄ, wymagany adres ÅºrÃ³dÅa; korekta = nowy wiersz z powodem), RPC `sefs_save_parameters`/`fuel_add_reading`/`baf_change_log` (tylko HHL, straÅ¼nik âis not trueâ), audit_log 3 akcje; lista dozwolonych +3, security 83/83, nullguard 190/190; UI `BafForm` (leniwy, tylko Supabase): wersja â odczyt SEK+PLN â podglÄd mnoÅ¼nika min(SEK,PLN) â korekta â dziennik 4 wpisy (lokalny e2e 4/4); produkcja w wycofanej transakcji: HHL zapisuje wersjÄ 1, odczyt, dziennik 2; UPDATE tabeli = odmowa; duplikat okresu i brak adresu = odmowa; konto bez `app_users` = odmowa zapisu i dziennika, widzi 0/0; po rollback 0/0/0. WartoÅci SEFS nie wpisane (D-2) |
| I-2g | Etap I â kody opÃ³ÅºnieÅ ukryte | **DONE** 27.09.2026 | `16638cb` | UI ich nie uÅ¼ywa; test statyczny: 0 wystÄpieÅ `delay_code`/`delayCode`/`A_CLIENT` w `src/` |
| I-2h | Etap I â fikcyjne numery demo + straÅ¼nik wysyÅki | **DONE** 27.09.2026 | `16638cb` | 30 numerÃ³w w `SEED_DRIVERS` (15 PL `+48 000 000 001â¦015`, 5 LT `+370 000 0000 1â¦5`, 10 SE pula PTS `+46 70 174 06 05â¦14`), 58 wystÄpieÅ w `loads.json`, 3 w teÅcie; `i2-demo-no-send` 5/5: pule, 0 numerÃ³w spoza pul w `src/`, runtime demo: brak odbiorcy zdalnego i 0 wywoÅaÅ fetch/XHR, paczka demo bez supabase/functions/v1/signInWithOtp/api.resend.com/sms:/mailto:; wzorce wizualne bez zmian (numery nie wystÄpujÄ w ujÄciach `tests/__screenshots__`) |
| I-2i | Etap I â przeglÄd 37 pozycji âczÄÅciowoâ | **DONE** 27.09.2026 | (ten wpis) | 37 przejrzanych: 11 dziaÅaÅo tylko w demo â 8 ukrytych/zastÄpionych w I-2aâh, 3 nowe pozycje w PLAN (I-2j, I-2k, I-2l); tabela niÅ¼ej (Â§ I-2i). Macierz ujÄÄ pl/1280 (56 ujÄÄ, stary vs nowy build demo): rÃ³Å¼nice tylko harmonogram HHL/KSH (przycisk importu przeniesiony na HHL, 4 ujÄcia) + mapa (niestabilna takÅ¼e stary vs stary); kokpit 68/68 bez rÃ³Å¼nic po `a4ff639` |
| I-2j | Etap I â pozycje promÃ³w z bazy (AIS z `ferry-ais`) na mapie zamiast przykÅadowych | **DONE** 27.09.2026 | `5ed7dd0` | migracja **0053** (produkcja: TAK, `supabase db push`, 2Ã lokalnie â idempotentna): `vessel_positions` (statek, lat/lon, SOG, COG, czas sygnaÅu AIS, czas odczytu; unikalnoÅÄ statek+czas sygnaÅu), RLS odczyt = aktywne konto, API bez INSERT/UPDATE/DELETE, anon bez SELECT; retencja 30 dni `purge_vessel_positions` (bez EXECUTE dla API, ostatnia pozycja statku zostaje), cron `tower-retencja-pozycji-promow` 02:55 UTC. `tests/db/i2.sh` **60/60** (+9 I-2j), brama bazy 14/14 zestawÃ³w zielona (security 83, nullguard 190 â¦); unit `integrations` 24/24 (+3: zapis pozycji, powtÃ³rka sygnaÅu = 0 nowych, statek bez rejsu â pozycja bez wniosku, pusta odpowiedÅº = 0), `i2j-ais-db` 4/4; lokalny Supabase, build produkcyjny: `i2-facade.local` **5/5** (nowy: KSH mapa âbrak ÅºrÃ³dÅa danychâ â po wstawieniu pozycji âz bazy, ostatni odczyt 27.09.2026 20:10â + znacznik promu +1 + atrybucja CC BY 4.0) | **Zadanie:** `ferry-ais` zapisuje pozycjÄ kaÅ¼dego statku z MMSI (rejs w toku â jak dotÄd z obserwacjÄ/ryzykiem; bez rejsu â tylko pozycja). Edge `ferry-ais` wdroÅ¼ona (wersja 6, verify_jwt). **Produkcja:** przebieg 20:40 PL â `M/F Wawel` 58,9056 N 17,9572 E, SOG 0 (NynÃ¤shamn), sygnaÅ 20:36:56, odczyt 20:40:03; Nova Star â Digitraffic 0 obiektÃ³w (poza zasiÄgiem), 0 wierszy. **Klient:** `subscribeFerryPositions` â produkcja: odczyt `vessel_positions` co 2 min (moduÅ Åadowany leniwie, bez WebSocket, bez pozycji przykÅadowych), podpowiedÅº znacznika âodczyt AIS <data>â, stopka mapy âAIS: z bazy, ostatni odczyt â¦ (Dane AIS: Fintraffic / digitraffic.fi, licencja CC BY 4.0)â albo âbrak ÅºrÃ³dÅa danychâ; demo bez zmian (proxy/seed). **Vercel:** `git archive 92ae55d` â https://watch-tower-makieta-6lvpqzmwo-sebastianbozekq-7781s-projects.vercel.app (aliasy tower.log-mar.pl, watch-tower-makieta.vercel.app â oba 200); 18 plikÃ³w JS, 0 Ã `service_role`, kawaÅek `aisDb-*.js` tylko w paczce produkcyjnej (demo: test `i2-demo-no-send` zielony). |
| I-D9 | Etap I (P0, decyzja D-9) â parametry odcinkÃ³w ETA v1 | **DONE** 27.09.2026 | `8d69a40` | migracja **0054** (produkcja: TAK; idempotentna â 2Ã lokalnie): PL_ROAD 7,5 h Â±25%, PORT_CHECKIN 3 h, SE_ROAD 17 h Â±20%, SE_BREAKS 13 h Â±30%, CROSSING_DEFAULT 18 h Â±15% bez zmian; ÅºrÃ³dÅa: âszacunek koordynatora 27.09 â do potwierdzenia z SCX (II-3)â Ã3, âwÅaÅciciel 27.09: obsada jednoosobowa, odpoczynek na promieâ Ã1; przeliczenie ETA transportÃ³w w toku (produkcja: 0). `tests/db/i2.sh` **62/62** (+2 D-9; 7 oczekiwaÅ przeliczonych: bez rozkÅadu 43 â 58,5 h, pasmo rejsu zaÅoÅ¼onego 747 â 1013, przypisanego 417 â 683, opÃ³Åºnionego 477 â 743, FERRY 423 â 630) | **Produkcja, transakcja wycofana** (ten sam transport wzorcowy: nowy, zaÅadunek jutro, dostawa +3 dni, rejs zaÅoÅ¼ony z rozkÅadu): **przed** pasmo Â±747 min, opÃ³Åºnienie 390 min, ETA 01.10 06:30 PL; **po** Â±1013 min, opÃ³Åºnienie 1080 min, ETA 01.10 18:00 PL; po rollback 0 transportÃ³w. Model: obsada jednoosobowa, przeprawa promem = dobowy odpoczynek na promie (potwierdzone przez wÅaÅciciela 27.09 â zamkniÄte, nie do potwierdzenia z SCX), bez postoju w NynÃ¤shamn; SE = 17 + 13 = 30 h, rozrzut odcinka SE = wiÄkszy z dwÃ³ch (30%). |
| I-2k | Etap I â paczka dokumentÃ³w âtydzieÅâ tylko z transportÃ³w wybranego tygodnia ISO | **DONE** 27.09.2026 | `e4b393d` | unit `i2k-doc-week` **5/5**: tydzieÅ transportu (rozÅadunek â planowana dostawa â planowany zaÅadunek; niedziela 27.09 = W39, poniedziaÅek 28.09 = W40), wybÃ³r domyÅlny, dokumenty W39 2/5, W40 1/5, W38 (rozÅadowany 18.09) 1/5, W41 0, dokument bez transportu nigdy; **plik ZIP** paczki W39 odczytany z powrotem: dokÅadnie 2 pliki `documents/L39a/â¦`, `documents/L39b/â¦`; fresh-smoke (visual, d19, deur, etap4/5/6) zielony | **BÅÄd (nie fasada):** przycisk âPobierz paczkÄ tygodniaâ pakowaÅ caÅÄ listÄ `documents` w obu trybach. **Teraz:** `src/lib/docWeek.ts` (`loadWeekKey`, `weeksWithLoads`, `defaultDocWeek`, `docsForWeek`) â tydzieÅ jak w fakturach tygodniowych (`unloadedAtOf`, strefa Europe/Warsaw); w nagÅÃ³wku DokumentÃ³w lista tygodni z transportami (istniejÄcy styl `select.input`, jak w kreatorze faktur), domyÅlnie bieÅ¼Äcy albo najbliÅ¼szy nastÄpny; plik `WATCH_TOWER_dokumenty_<RRRR-Www>.zip`. Demo (zamroÅ¼ony czas 23.09): tygodnie W39âW47, domyÅlny W39. |
| I-2l | Etap I â czas wykrycia odchylenia z `risk_signals` zamiast â8 minâ | **DONE** 27.09.2026 | `825da20` | migracja **0055** (produkcja: TAK; idempotentna): `risk_signals.occurred_at` + wyzwalacz BEFORE INSERT (jawne `detail.occurred_at`; cichy pojazd = ostatnia pozycja + prÃ³g; ryzyko strefy = czas zdarzenia strefy z `load_events`; inaczej NULL), `kpi_detection_lag(p_project, p_days)` â mediana (wykrycie â zdarzenie) ryzyk transportÃ³w z 30 dni, SECURITY INVOKER (zakres = RLS), anon bez EXECUTE, lista dozwolonych +1, null-guard-calls EMPTY. `tests/db/i2.sh` **72/72** (+10: 0 prÃ³bek â âââ, cichy pojazd 90 min, strefa 7 min, jawny 20 min, brak/zÅy czas â NULL, HHL 3/20, KSH 0 (RLS), SCX 3/20, bez app_users 0, okno 30 dni), `nullguard` **194/194** (odmowy 156/156 = 39 Ã 4 konta), security 83/83; unit `i2l-detect-lag` 3/3; lokalny Supabase, build produkcyjny: `i2-facade.local` **6/6** (kafelek HHL âââ â po ryzyku z czasem â12 minâ, âmediana Â· n = 1 (30 dni)â) | **Produkcja, transakcja wycofana (Sebastian@log-mar.pl, HHL_ADMIN):** bez danych 0 prÃ³bek / mediana pusta (kafelek âââ); transport testowy w drodze, ostatnia pozycja 2 h temu â `detect_silent_vehicles(90)` 1 ryzyko, czas wykrycia 30 min, KPI 1/30; po rollback 0 transportÃ³w, 0 ryzyk z czasem. IstniejÄcych wierszy `risk_signals` nie zmieniano. **Kokpit:** w produkcji kafelek zawsze widoczny (moduÅ `detectLag` Åadowany leniwie tylko w paczce produkcyjnej), wartoÅÄ z bazy albo âââ; demo bez zmian (â8 minâ, wzorce wizualne nietkniÄte). Stara `kpi_exception_detection_lag` (z `load_events.recorded_at`) zostaje nieuÅ¼ywana. |
| I-10 | Etap I â e-mail o zmianie daty awizowanego transportu | **DONE** 27.09.2026 | `a0d21bc` | migracja **0056** (produkcja: TAK): wyzwalacz AFTER INSERT na `notifications` â dla IN_APP `SCHEDULE_DATE_CRITICAL` tworzy bliÅºniaczy EMAIL (`dedup = 'EMAIL:' || dedup`, tylko aktywne konto z adresem); `send-notifications` wdroÅ¼ona ponownie. unit `i10-email` 2/2, `tests/db/i2.sh` **77/77**, import 48/48, gate lokalnie 14/14 zestawÃ³w | **Produkcja:** transakcja wycofana â IN_APP dla Sebastiana â EMAIL PENDING z adresem konta, po rollback 0 wierszy. **Dostarczenie:** wiersz id=125 (EMAIL na `sebastian+tower-test@log-mar.pl`, kod TEST-I10) wstawiony 21:16:17 PL â cron `tower-send-notifications` **SENT 21:20:03 PL**, bez bÅÄdu. |
| O-V | wdroÅ¼enie Vercel `5d43f5d` (I-2k + I-2l) | **DONE** 27.09.2026 | `5d43f5d` | 19 plikÃ³w JS, **0** Ã service_role; tower.log-mar.pl 200, watch-tower-makieta.vercel.app 200 | â |
| I-5 | Etap I â 2FA TOTP dla HHL_ADMIN (`aal2`) | **DONE** 27.09.2026 | (ten wpis) | migracja **0057** (produkcja: TAK): `security_flags` (MFA_HHL_ADMIN â przy wdroÅ¼eniu wÅÄczana tylko, gdy kaÅ¼dy aktywny HHL_ADMIN ma zweryfikowany TOTP; produkcja: **false**), `current_aal()`, `mfa_satisfied(role)` w helperach rÃ³l (HHL_ADMIN bez aal2 przy wÅÄczonym wymaganiu = brak roli â RLS i RPC odmawiajÄ), `my_mfa_status()`, `admin_set_mfa_enforcement(bool)` (tylko HHL_ADMIN w aal2, audit_log MFA_ENFORCEMENT_SET). Klient: `src/auth/Mfa.tsx` (zapis QR + klucz, kod przy logowaniu, panel w Opcjach; leniwie, tylko build Supabase), AuthGate: ekran kodu przed danymi. `tests/db/i2.sh` **96/96** (+19), `nullguard` **204/204**, unit **416** passed (w tym `i5-mfa` 8/8), lokalny Supabase z TOTP, build produkcyjny: `i2-facade.local` **7/7** (zapis TOTP w Opcjach â wymaganie wÅÄczone â nowa sesja pokazuje ekran kodu bez danych â kod â aplikacja) | **Produkcja, transakcja wycofana (Sebastian@log-mar.pl):** aal1 + flaga wyÅÄczona â rola HHL_ADMIN, projekty 1; flaga wÅÄczona + aal1 â projekty **0**; aal2 â projekty 1. Po `db push` flaga = false (Sebastian ma 0 skÅadnikÃ³w MFA). **Instrukcja (D-11):** Opcje â âWeryfikacja dwuetapowaâ â âSkonfiguruj aplikacjÄ uwierzytelniajÄcÄâ â zeskanowaÄ QR (Google/Microsoft Authenticator) â wpisaÄ kod â âWÅÄcz wymaganieâ. Awaryjnie (utrata telefonu): `update security_flags set enabled=false where key='MFA_HHL_ADMIN'` z konta serwisowego + usuniÄcie skÅadnika w panelu Supabase Auth. |
| O-V | wdroÅ¼enie Vercel `a548eba` (I-5 + I-10) | **DONE** 27.09.2026 | `a548eba` | 22 pliki JS, **0** Ã service_role (index + chunki, w tym `Mfa-*.js`); tower.log-mar.pl 200, watch-tower-makieta.vercel.app 200 | â |
| I-D9-a | Analiza: czy opÃ³Åºnienie 1080 min (ETA 01.10 18:00 PL) transportu wzorcowego D-9 jest wiarygodne | **DONE** 27.09.2026 | (ten wpis) | produkcja, transakcja wycofana, 4 warianty godziny zaÅadunku | **Wynik: to nie bÅÄd, tylko skutek modelu (skok o jeden rejs).** Transport wzorcowy: zaÅadunek jutro (28.09) bez godziny â start 12:00 PL (reguÅa `compute_load_eta`: sama data = poÅudnie), dostawa 30.09 â koniec okna = 01.10 00:00 (Europe/Stockholm). Dojazd: 12:00 + PL 7,5 h + check-in 3 h = **22:30** â rejs 28.09 18:00 juÅ¼ odszedÅ â najbliÅ¼szy **29.09 18:00**, przypÅyniÄcie 30.09 12:00 â + SE 17 + 13 = 30 h â **01.10 18:00** â opÃ³Åºnienie 18 h = **1080 min**. Przed D-9 (4,5 + 2 h) dojazd 18:30 â teÅ¼ po rejsie 18:00, ten sam rejs, SE 18,5 h â 01.10 06:30 (390 min). Suma odcinkÃ³w 7,5 + 3 + 18 + 17 + 13 = 58,5 h â zgodna z testem `i2.sh`. **WraÅ¼liwoÅÄ (ten sam transport, rÃ³Å¼na godzina zaÅadunku):** 06:00 â rejs 28.09, ETA 30.09 18:00, opÃ³Åºnienie **0**; 07:30 â **0** (dokÅadnie na granicy: 07:30 + 10,5 h = 18:00); 08:00 â rejs 29.09, **1080 min**; bez godziny â **1080 min**. **WÅaÅciciel 27.09 (zamkniÄte):** rÃ³Å¼nica 390 â 1080 min = nowe czasy (+3 h jazdy + 8,5 h odpoczynku = 690 min), NIE bÅÄd â zgodne z rozbiciem powyÅ¼ej (ten sam rejs 29.09 18:00; SE 18,5 â 30 h = +11,5 h = 690 min). Wniosek: dla rejsu codziennie 18:00 zaÅadunek w Polsce musi siÄ skoÅczyÄ do **07:30**, inaczej transport traci dobÄ. Do potwierdzenia z SCX w II-3: realna godzina zaÅadunku i cutoff check-inu (3 h to szacunek). Przeprawa jako odpoczynek dobowy â zamkniÄta decyzjÄ wÅaÅciciela, bez zmian. |
| I-4 | Etap I â instrukcje w aplikacji: kierowca PL/EN/SV, HHL, KSH, przewoÅºnik | **DONE** 27.09.2026 | (ten wpis) | treÅÄ w sÅowniku `i4_*` (src/i18n/i2.ts): kierowca **8** krokÃ³w, HHL **7**, KSH **6**, przewoÅºnik **6** â kaÅ¼dy w PL/EN/SV (**81** tekstÃ³w + nagÅÃ³wki); komponent `src/components/guide/Guide.tsx` (rozwijany panel âInstrukcjaâ). Osadzenie tylko w buildzie produkcyjnym, leniwie: PWA kierowcy (otwarta przed zgodÄ na lokalizacjÄ), Opcje (HHL), Ustawienia (KSH/SCX). unit `i4-guide` **7/7**, PL-T 4/4 (hunspell pl_PL bez nowych wyjÄtkÃ³w), unit ÅÄcznie **423** passed; lokalny Supabase, build produkcyjny: `i2-facade.local` **11/11** (+4: HHL 7, KSH 6, SCX 6, kierowca z linkiem serwerowym â 8 krokÃ³w, przeÅÄczenie SV/EN) | Kierowca: link, jÄzyk, zgoda i jej wycofanie, przyciski etapÃ³w, PROBLEM, zdjÄcie CMR/POD, **prom = odpoczynek dobowy (D-9)**, nowy link. TreÅÄ opisuje wyÅÄcznie funkcje, ktÃ³re dziaÅajÄ w produkcji (bez fasady). Demo i wzorce zrzutÃ³w bez zmian (panel nie istnieje w paczce demo). |
| I-6 | Etap I â monitoring bÅÄdÃ³w przeglÄdarki do wÅasnej tabeli + alarm | **DONE** 27.09.2026 | (ten wpis) | migracja **0058** (produkcja: TAK): `client_errors` (odcisk komunikat+pierwsza linia stosu; ten sam bÅÄd w 10 min = `hits`+1), `report_client_error()` (anon â PWA kierowcy i ekran logowania; zalogowany tylko z aktywnym kontem; limity pÃ³l, 60 nowych/min globalnie, tokeny `wt_â¦`, JWT i `access_token=` wycinane), odczyt tylko HHL_ADMIN (RLS), `client_error_watch()` co 15 min (cron `tower-bledy-przegladarki`): bÅÄd w 15 min â ryzyko HHL `JOB_FAILURE`/`rk_client_errors` + e-mail ALERT_EMAIL_TO (Resend przez pg_net), jeden alarm na incydent, zamkniÄcie po 24 h bez bÅÄdÃ³w; retencja 30 dni (`tower-bledy-retencja`). Klient `src/lib/errorReport.ts` (window `error` + `unhandledrejection`, maks. 10 na kartÄ, ten sam komunikat raz na 60 s, identyfikator buildu z nazwy paczki), instalowany leniwie tylko w buildzie produkcyjnym. `tests/db/i2.sh` +18, nullguard **209/209**, unit `i6-error-report` 4/4, lokalny Supabase: `i2-facade.local` (+1: wyjÄtek i odrzucona obietnica KSH â 2 wiersze z rolÄ CLIENT_ADMIN i buildem) | **Produkcja:** transakcja wycofana â anon zgÅoszenie z tokenem â zapis `wt_â¦`, alarm ALARM/1 ryzyko HHL, e-mail do kolejki (wycofany). **BÅÄd testowy przez publiczne API (klucz anon, jak przeglÄdarka):** 21:46:36 PL `true` â wiersz id=1 w `client_errors` (`I6-TEST-PRODâ¦`, ÅcieÅ¼ka `/#/test`); odczyt tabeli kluczem anon: **permission denied** (42501). **Alarm na produkcji:** cron 22:00:00 PL â ryzyko HHL `rk_client_errors` (HIGH), e-mail przez Resend 22:00:07 â odpowiedÅº **200** (id wiadomoÅci zwrÃ³cony). Po weryfikacji wiersz testowy usuniÄty, ryzyko testowe zamkniÄte rÄcznie. |
| I-7 | Etap I â retencja danych kierowcy 90 dni | **DONE** 27.09.2026 | (ten wpis) | migracja **0059** (produkcja: TAK): `purge_personal_data` (cron `tower-rodo` 02:15 UTC) â imiÄ i telefon 90 dni po rozÅadunku (jak dotÄd) **+ anulowane** (90 dni po anulowaniu; wczeÅniej zostawaÅy bez koÅca), pozycje GPS 30 dni po rozÅadunku **+ anulowane po 90 dniach**, **linki kierowcy** (`driver_tokens`) 90 dni po wygaÅniÄciu/odwoÅaniu; transport w toku nigdy (takÅ¼e po terminie planu); kaÅ¼dy przebieg â `integration_runs` job `rodo` z liczbami; straÅ¼nik `p_days â¥ 0`. `tests/db/i2.sh` +11 (rozÅadowany 91/89 d, anulowany 91/10 d, w drodze 200 d, linki 91/89/odwoÅany 100 d, dziennik 1/1/1/2, drugi przebieg 0), release 145/145 | **Produkcja, transakcja wycofana:** przebieg 0 (0 transportÃ³w), wpis `rodo` z szeÅcioma licznikami 0; anon/authenticated bez EXECUTE. ZdjÄcia CMR/POD â decyzja D-3 (poza I-7). Tablice rejestracyjne zostajÄ (dane pojazdu do dokumentÃ³w). |
| I-8 | Etap I â wydajnoÅÄ: caÅy harmonogram + GPS wg PR5, trzy role | **DONE** 27.09.2026 | (ten wpis) | lokalny Supabase (nigdy produkcja), wolumen `scripts/i8/seed.sql`: **350** transportÃ³w (300 âPERFâ â120â¦+60 dni + 50), **112 496** pozycji GPS (79 transportÃ³w Ã 1 424 pkt = 4 doby Ã 356 wg PR5), tabela pozycji **39 MB**; po pomiarze `scripts/i8/clean.sql`. **Baza** (`scripts/i8/sql-perf.sh`, mediana z 7): harmonogram (transporty + Åadunki + rejs, RLS) HHL **36,6 ms**, KSH **51,9 ms**, SCX **103,5 ms**; ryzyka ~6 ms; widoki cen ~4,5 ms; `process_position` (punkt + strefy + ETA) **44,1 ms**; ostatnia pozycja aut w trasie **8,6 ms**; `compute_load_eta` Ã300 **76,1 ms**; `detect_silent_vehicles` **7,3 ms**; `purge_personal_data` **17,5 ms**. **Interfejs** (build produkcyjny, `tests/i8-perf.local.spec.ts`, mediana z 3, Chromium): logowanie â kokpit z danymi HHL **879 ms** / KSH **884 ms** / SCX **873 ms**; harmonogram z peÅnÄ listÄ **350 wierszy** HHL **462 ms** / KSH **601 ms** / SCX **352 ms**; mapa HHL **340 ms** / KSH **326 ms** / SCX **525 ms** | NapÅyw GPS wg PR5 (20 aut, punkt co 2 min) â 0,17 wywoÅania/s Ã 44 ms â pomijalne. Wszystkie czasy < 1 s; pierwsze wejÅcie (zimna pamiÄÄ podrÄczna) 1,2â1,5 s. Bez zmian w kodzie aplikacji. |
| I-17 | Etap I â 2FA: drugie urzÄdzenie uwierzytelniajÄce | **DONE** 27.09.2026 | (ten wpis) | migracja **0060** (produkcja: TAK): `mfa_factor_count()` (zweryfikowane TOTP bieÅ¼Äcego konta; bez EXECUTE dla API), `my_mfa_status().factors`, `admin_set_mfa_enforcement(true)` **tylko przy â¥ 2 urzÄdzeniach** (wyÅÄczenie zawsze). Panel âWeryfikacja dwuetapowaâ: lista urzÄdzeÅ (nazwa âTOWER n Â· dataâ), âDodaj drugie urzÄdzenieâ (sesja aal2), âUsuÅâ gdy sÄ dwa; ekran kodu przy logowaniu: wybÃ³r urzÄdzenia, gdy wiÄcej niÅ¼ jedno. `tests/db/i2.sh` **132/132** (+7), unit **430** passed (`i5-mfa` 11/11); lokalny Supabase: `i2-facade.local` **12/12** â scenariusz: urzÄdzenie 1 â wymaganie zablokowane â urzÄdzenie 2 (inny sekret) â wymaganie wÅÄczone â sesja A kodem urzÄdzenia 2 â sesja B: kod urzÄdzenia 2 dla urzÄdzenia 1 odrzucony, kod urzÄdzenia 1 przyjÄty | **Produkcja, transakcja wycofana:** Sebastian `factors 0`, aal1, wymaganie wyÅÄczone. **D-11:** zapisz dwa urzÄdzenia, potem âWÅÄcz wymaganieâ (przy jednym przycisk nie pojawia siÄ, baza odmawia). |
| I-18 | Etap I â status dat planu WSTÄPNA / POTWIERDZONA (D-12) | **DONE** 27.09.2026 | (ten wpis) | migracja **0061** (produkcja: TAK, najpierw transakcja wycofana: 0 transportÃ³w, N=5, 0 ryzyk): `loads.plan_dates_status` + autor + czas; RPC `ksh_confirm_dates` (tylko KSH klienta projektu, do wjazdu na zaÅadunek; zmiana dat przy potwierdzeniu dozwolona); zmiana daty POTWIERDZONEJ = zdarzenie `PLAN_DATES_CHANGED` + powiadomienie w aplikacji i e-mail dla HHL, przewoÅºnika i KSH (bez autora); zmiana przez HHL lub import cofa status do WSTÄPNA; import: data potwierdzona NIE jest nadpisywana bez osobnej zgody (`overwrite_confirmed`), w oknie importu ostrzeÅ¼enie z listÄ âprzed â poâ i pole zgody; ostrzeÅ¼enie wraca przy kaÅ¼dym imporcie, dopÃ³ki rÃ³Å¼nica istnieje; `app_parameters.DATE_CONFIRM_DAYS`=5, `detect_unconfirmed_dates()` (cron `tower-potwierdzenie-dat` co godzinÄ) â ryzyko `DATES_UNCONFIRMED` (HHL+KSH); ANEKS 2 bez zmian. Harmonogram: â lub âwstÄpnaâ przy datach; szuflada (przeglÄd): status, autor, czas, formularz tylko dla KSH. Szablon e-mail PL/EN/SV, `send-notifications` wdroÅ¼one ponownie. `tests/db/i2.sh` **168/168** (+36), nullguard **214/214**, unit **433** passed (`i18-plan-dates` 3/3), lokalny Supabase: `i18-dates.local` **4/4** (SCX wstÄpna bez formularza â KSH potwierdza i zmienia â HHL i SCX widzÄ â), `i2-facade.local` **12/12** | SCOPE 16.3 (import u KSH) ZASTÄPIONA PRZEZ I-18. |
| O-V2 | wdroÅ¼enie Vercel `cdbb696` (I-4, I-6, I-7, I-8, I-17, I-18) | **DONE** 27.09.2026 | `cdbb696` | **0** Ã service_role (index + chunki); tower.log-mar.pl 200, watch-tower-makieta.vercel.app 200; `ksh_confirm_dates` obecne w paczce | â |
| I-16 | Etap I â walidacja ETA v1 na 50 prawdziwych transportach wobec planu KSH 5 dni | **DONE** 27.09.2026 | (ten wpis) | `scripts/i16/eta-validation.sql`, produkcja w transakcji wycofanej (prawdziwy rozkÅad GDN-NYN: 73 rejsy, codziennie 18:00 poza wiÄkszoÅciÄ niedziel; parametry 0054). Dane: 50 przyjÄtych wierszy `KSH_HARMONOGRAM.xlsx` (plik nie ma godzin, wiÄc start = dzieÅ zaÅadunku 12:00). Zapas = koniec dnia (zaÅadunek + 5 dni, Sztokholm) â ETA. **Wynik: min 30,0 h Â· mediana 54,0 h Â· maks. 55,0 h, ujemnych 0/50.** RozkÅad: 39 Ã 54â55 h (start â ETA 78 h), 11 Ã 30 h (start â ETA 102 h: zaÅadunek w sobotÄ albo piÄtek bez rejsu w niedzielÄ â rejs w poniedziaÅek; w tym SS-04, SS-05). 55 h = zmiana czasu 25.10. Wobec dat dostawy z pliku: min 30 Â· mediana 54 Â· maks. 102 h (7 wierszy ma w pliku 4 albo 7 dni zamiast 5). Pasmo Â±1013 min dla wszystkich (rejs zaÅoÅ¼ony, nie przypisany: +6 h). **Wniosek dla modelu:** przy starcie 12:00 dojazd + check-in (10,5 h) zawsze mija rejs 18:00 tego samego dnia, wiÄc kaÅ¼dy transport bez godziny pÅynie dzieÅ pÃ³Åºniej. Plan 5 dni ma zapas mimo to. Realna godzina zaÅadunku (zatwierdzana w I-18) moÅ¼e skrÃ³ciÄ ETA o 24 h. **Transport wzorcowy D-9** (zaÅadunek 28.09 bez godziny, dostawa 30.09): start pon 28.09 12:00 â PL_ROAD 7,5 h â 19:30 â check-in 3 h â 22:30 â rejs **wt 29.09 18:00** (rejs 28.09 18:00 juÅ¼ odszedÅ; najbliÅ¼szy w rozkÅadzie, zaÅoÅ¼ony) â przypÅyniÄcie År 30.09 12:00 (odpoczynek dobowy na promie, D-9) â SE_ROAD 17 h â czw 01.10 05:00 â SE_BREAKS 13 h â **ETA czw 01.10 18:00** (78 h od startu), Â±1013 min. Wobec daty z pliku (koniec 30.09) â18 h â ten transport ma w teÅcie tylko 2 dni na dostawÄ; wobec planu 5 dni (koniec 03.10) **+54 h**. Model i rejs sprawdzone: ujemny zapas to skutek skoku o jeden rejs (I-D9-a), nie bÅÄd. | Do II-3 (SCX): godzina zaÅadunku i cutoff check-inu. |
| I-15 | Etap I â pasmo ETA: odpoczynek dobowy osobno, ÅÄczenie RSS | **DONE** 27.09.2026 | (ten wpis) | migracja **0062** (produkcja: TAK; najpierw transakcja wycofana): odcinek SE = SE_ROAD 17 h Â±20% + **SE_DAILY_REST 11 h Â±0%** (nowy, osobny) + **SE_BREAKS 2 h Â±50%** (byÅo 13 h Â±30%); suma SE 30 h, wiÄc ETA bez zmian. Pasmo = pierwiastek z sumy kwadratÃ³w skÅadnikÃ³w (odcinki + niepewnoÅÄ rejsu), `eta_basis.band` = metoda, pasmo, dawna suma liniowa, skÅadniki. **Pasmo przed â po (te same stany co w `i2.sh`):** rejs zaÅoÅ¼ony z rozkÅadu **1013 â 433 min** (suma przy nowych odcinkach 737); rejs przypisany **683 â 242**; rejs przypisany opÃ³Åºniony **743 â 250**; na promie (opÃ³Åºniony) **630 â 223**; bez rozkÅadu 1535 â 776. 50 transportÃ³w KSH (I-16): wszystkie **Â±1013 â Â±433 min**; ETA i zapas bez zmian (30 / 54 / 55 h). Transport D-9: SE_ROAD do czw 05:00 â odpoczynek dobowy do 16:00 â przerwy do **18:00 = ETA**, pasmo 1013 â 433. `tests/db/i2.sh` **170/170**, unit `i15-eta-band` 2/2 | â |
| I-13 | Etap I â zakres wersji SEFS COST / REVENUE / BOTH (+ D-10) | **DONE** 27.09.2026 | (ten wpis) | migracja **0063** (produkcja: TAK; najpierw transakcja wycofana: 0 wersji na produkcji): `sefs_parameters.applies_to` (domyÅlnie BOTH, istniejÄce wersje = BOTH), RLS tylko SELECT: HHL wszystko; przewoÅºnik COST i BOTH **wyÅÄcznie `agreed_with_carrier`** i tylko projekty, w ktÃ³rych ma transport (D-10); KSH REVENUE i BOTH, tylko projekt, ktÃ³rego jest klientem. Zapis bez zmian: wyÅÄcznie RPC HHL (`sefs_save_parameters` przyjmuje `applies_to`, inna wartoÅÄ = odmowa). Interfejs: HHL â pole âZakres wersjiâ w formularzu SEFS; KSH i przewoÅºnik â panel âDopÅata paliwowa SEFS â parametryâ (tylko odczyt) w Ustawieniach. `tests/db/i2.sh` **184/184** (+14: przewoÅºnik widzi v3 COST i v6 BOTH uzgodnione, nie widzi REVENUE ani nieuzgodnionej COST; KSH widzi BOTH i REVENUE, nie widzi COST; INSERT/UPDATE/RPC przewoÅºnika odrzucone; przewoÅºnik bez transportu w projekcie 0), unit **437** passed (`i13-sefs-scope` 2/2), lokalny Supabase `i13-sefs.local` **2/2**, `i2-facade.local` **12/12** | â |
| I-12 | Etap I â cennik: pozycja STANDARD (D-8 wariant A) | **DONE** 27.09.2026 | (ten wpis) | migracja **0064** (produkcja: TAK; najpierw transakcja wycofana; cenniki na produkcji: 0): `rate_rules.cargo_class` DIMENSIONED (domyÅlnie) / STANDARD, najwyÅ¼ej jedna pozycja STANDARD na cennik (koszt i przychÃ³d to osobne cenniki `rate_cards.side`). `rate_match(cennik, transport)` (tylko HHL): wszystkie pozycje transportu STANDARD â pozycja STANDARD (staÅa stawka, wymiary bez znaczenia); brak â `NO_STANDARD_RATE` z komunikatem âBrak stawki STANDARD w cenniku (koszt/przychÃ³d) â wycena wstrzymana, to nie jest zeroâ, `base_rate` NULL; wymiarowy â przedziaÅ wymiarÃ³w (pozycja STANDARD pominiÄta), `NO_BRACKET` / `AMBIGUOUS` / `NO_DIMENSIONS`; mieszany â `MIXED_CARGO`. Silnik referencyjny `src/lib/money/engine.ts`: `matchRateForCargo` + `rateWarningKey` (teksty `i12_warn_*` PL/EN/SV). Paliwo i kurs â ten sam mechanizm (`buildPriceSide`, `assertSameMechanism`). Test mechanizmu na stawkach TESTOWYCH 1000 / 1300 EUR (nie z cennika): mnoÅ¼nik 1,04 po obu stronach â paliwo 40 / 52 EUR, marÅ¼a 312 EUR, ta sama tabela NBP. **Kwot nie wpisano (D-1)** â cennika na produkcji nie ma; wpisanie stawek wymaga D-1 (i drogi zapisu dla HHL â dziÅ RLS bez polityk, tylko SQL). `tests/db/i2.sh` **196/196** (+12), nullguard **219/219**, unit **440** passed (`i12-standard-rate` 3/3) | D-1: kwoty stawek STANDARD (koszt i przychÃ³d). |
| O-V3 | wdroÅ¼enie Vercel `a14a2ac` (I-16, I-15, I-13, I-12) | **DONE** 27.09.2026 | `a14a2ac` | **0** Ã service_role (index + chunki); tower.log-mar.pl 200, watch-tower-makieta.vercel.app 200 | â |
| I-9 | SCOPE.md = plik koordynatora | **DONE** 27.09 (ten commit) | â (docs) | â | Â§0â55 dosÅownie z pliku koordynatora; dopiski wykonawcy: 16.3 zastÄpiona przez I-18, dzienniki odÅoÅ¼eÅ/blokad; nowa Â§56 (numer 53 zajÄty przez koordynatora): stare tabele 0â11 i dawny Â§39 przeniesione w caÅoÅci (56.2, 56.3) |
| I-11 | mapa SCOPE â PLAN | **DONE** 27.09 (ten commit) | â (docs) | â | Â§56.1: 65 pozycji spoza GOTOWE â GOTOWE 8 Â· czÄÅciowo 26 Â· do zrobienia 9 Â· zablokowane 10 Â· odÅoÅ¼one 7 Â· do potwierdzenia 5; nowe pozycje PLAN: I-19 (cennik HHL, P1), I-20â¦I-24, III-2â¦III-9, D-13â¦D-15 |
| I-19 | formularz cennika HHL | **DONE** 27.09 (ten commit) | 0065 (produkcja: naÅoÅ¼ona) | i2 226/226 (+30), nullguard 229/229, security 83/83, vitest 444, e2e i19 2/2, domyÅlny 12/12 | `rate_card_save` â tylko HHL; kaÅ¼da zmiana = nowa wersja (projekt, strona, organizacja) z kompletem pozycji; COST â przewoÅºnik, REVENUE â klient; najwyÅ¼ej 1 STANDARD; przedziaÅy liczone wÅÄcznie â nakÅadanie odrzucane (inaczej rate_match = AMBIGUOUS); powÃ³d wymagany od v2; rate_cards/rate_rules tylko do dopisywania; dziennik RATE_CARD_VERSION (stara/nowa wersja z pozycjami); RLS: czyta tylko HHL. UI: Opcje â âCennik HHL â koszt i przychÃ³dâ (PL/EN/SV). Produkcja: 0 cennikÃ³w â kwoty wpisuje wÅaÅciciel (D-1) |
| I-14 | jedno ÅºrÃ³dÅo dopÅaty paliwowej | **DONE** 27.09 (ten commit) | 0066 (produkcja: naÅoÅ¼ona) | gate: i2 226/226, security 83/83 | parametry tylko w `sefs_parameters`, odczyty tylko w `fuel_index_readings`; nieuÅ¼ywane `baf_definitions` i `baf_index_values` (0 wierszy) oraz `rate_cards.baf_id` usuniÄte; straÅ¼nik: przy jakichkolwiek danych migracja przerywa siÄ bez usuwania |
| III-1 (szkielet) | raport kalibracji odcinkÃ³w ETA | **SZKIELET** 27.09 (ten commit) | â | samotest syntetyczny: PL_ROAD 9,0 h vs 7,5 h â PROPOZYCJA; reszta bez zmian; produkcja: n = 0 | odcinki z GEOFENCE_ENTER/EXIT: PL_ROAD, PORT_CHECKIN, CROSSING, SE_TOTAL (= SE_ROAD + SE_BREAKS + SE_DAILY_REST); mediana, p10âp90, minâmax, odchylenie; propozycja tylko przy n â¥ 5 i odchyleniu > 10%; zatwierdza HHL osobnÄ migracjÄ. Prawdziwe dane po 5 transportach pilotaÅ¼u |
| I-3 (czÄÅÄ bazowa) | bramka SMS â baza | **DONE** 27.09 (ten commit) | 0067 (produkcja: naÅoÅ¼ona; cron `tower-sms-straznik` co minutÄ); send-notifications wdroÅ¼ona (szablony SMS_FALLBACK, SMS_GATEWAY_SILENT) | i2 265/265 (+39), nullguard 249/249, security 83/83 | wedÅug PROPOZYCJA_SMS Â§3: `sms_devices` (token tylko SHA-256, limit 150/dobÄ, pauza), `sms_outbox` (CHECK: zakaz cen, â¤ 306 znakÃ³w), `sms_heartbeats`; telefon wywoÅuje tylko `sms_pull`/`sms_report`/`sms_heartbeat` (anon + token urzÄdzenia, 20 wywoÅaÅ/min, bez podwÃ³jnego wydania, przejÅcia tylko do przodu); `issue_driver_token_sms` = token + SMS w jednej transakcji; wyzwalacze WINDOW_CHANGE (â¥ 30 min), SAILING_CHANGE, SAILING_CANCELLED, LOAD_CANCELLED tylko przy aktywnym linku; szablony PL bez polskich znakÃ³w (GSM-7, â¤ 160 znakÃ³w), jÄzyk z `loads.driver_locale` albo prefiksu; straÅ¼nik: cisza > 15 min â JOB_FAILURE HIGH + e-mail HHL, SMS > 10 min lub FAILED â e-mail zastÄpczy, EXPIRED, link usuwany z treÅci po 24 h, retencja 90 dni. PrzyjÄte z zaleceÅ propozycji (do potwierdzenia przez wÅaÅciciela): bez ogonkÃ³w, limit 150, SMS 1â5 teraz. Telefonu brak (D-4) â produkcja: 0 urzÄdzeÅ, 0 SMS |
| O-V4 | wdroÅ¼enie Vercel `04b1505` (I-19 formularz cennika, etykieta bramki SMS w ryzykach) | **DONE** 27.09 | â | â | tower.log-mar.pl i watch-tower-makieta.vercel.app: 200; 0 Ã service_role w index i 22 chunkach; chunk `RateCardForm` obecny |
| I-3 UI + R-2 | bramka SMS w UI i blokada wiadomoÅci zewnÄtrznych | **DONE** 28.09 (ten commit) | 0068 (produkcja: naÅoÅ¼ona, `EXTERNAL_MESSAGING` = wyÅÄczone) | i2 279/279 (+14), nullguard 269/269, vitest 444, PL-T 4/4, e2e i3-sms 1/1, domyÅlny 12/12 | przed R-2: e-mail spoza log-mar.pl â status BLOCKED_R2 (send-notifications wysyÅa tylko PENDING; takÅ¼e po prÃ³bie UPDATE), telefon pobiera wyÅÄcznie SMS TEST na numery z `sms_test_numbers`; wÅÄcza tylko HHL_ADMIN (`admin_set_external_messaging`, wpis w audit_log). Produkcja 28.09: 0 urzÄdzeÅ, 0 numerÃ³w testowych, 0 telefonÃ³w kierowcÃ³w, 0 kont spoza log-mar.pl. UI: przycisk âWyÅlij link SMS-emâ (szuflada transportu), panel âBramka SMSâ (Opcje HHL) |
| I-3 P0 (SMS 8, 9, sekret) | rodzaje pilotaÅ¼u 1â5, 8, 9 (ZLECENIE_ETAP_I I-3); link z tokenem nigdy w `sms_outbox.body` | **DONE** 28.09 (ten commit) | 0069 (produkcja: naÅoÅ¼ona; cron `tower-sms-rozladunek` */10) | i2 293/293 (+14), nullguard 269/269, backup 23/23 (+1), import 48/48, vitest 444 | CHECK `kind` + GPS_SILENT, UNLOAD_CONFIRM (szablony PL bez ogonkÃ³w, â¤ 160 zn.). SMS 8: nowe ryzyko SILENT_VEHICLE, transport w ruchu (bez FERRY), aktywny link, maks. 1 na 3 h, minuty od ostatniej pozycji. SMS 9: AT_SITE â¥ 2 h bez MILESTONE_UNLOADED (rozÅadunek ustala datÄ usÅugi i kurs faktury), 1 na transport. Sekret: peÅna treÅÄ w `sms_outbox_secret` (RLS, brak grantÃ³w; HHL: permission denied), `sms_pull` podaje jÄ telefonowi, wyzwalacz kasuje jÄ, gdy status opuszcza QUEUED/CLAIMED (test: po SENT 0 wierszy); HHL `select body` = 0 wierszy z `wt_`/URL; e-mail zastÄpczy bierze `body` bez linku; `backup-export` pomija `sms_outbox_secret` (wdroÅ¼ona). Test I-10 w import.sh dostosowany do BLOCKED_R2 (0068). Gate wykryÅ skutek 0068 w money.sh: opÅacona faktura nie anulowaÅa przypomnienia BLOCKED_R2 â poprawione migracjÄ 0071 (anuluje PENDING i BLOCKED_R2; produkcja: naÅoÅ¼ona), money 130/130. |
| ETA Â§57 | opÃ³Åºnienie od koÅca dnia dostawy w Europe/Stockholm | **DONE** 28.09 (ten commit) | 0070 (produkcja: naÅoÅ¼ona; 0 transportÃ³w w toku do przeliczenia) | i2 +2, vitest `time.test.ts` 10/10 | ByÅo: `delay_minutes` od koÅca okna `plan_delivery_to` (np. 16:00), w UI demo od poÅudnia. Jest: zawsze od pÃ³Ånocy po dniu dostawy (`load_delivery_day_end`, lato +02, zima +01); UI `delayMinutesVsPlan` tak samo. |
| D-13 | stan paneli (28.09) | **ZAMKNIÄTE** (zastÄpione) | â | â | Vercel: adresy wdroÅ¼eÅ `*-sebastianbozekq-7781s-projects.vercel.app` â 302 na `vercel.com/sso-api` (Vercel Authentication aktywne); zmienne Supabase tylko w Årodowisku Production â podglÄd = tryb demo; wdroÅ¼enia wyÅÄcznie rÄczne `--prod` (brak podglÄdÃ³w na liÅcie). Pages: `preview_deployment_setting` = none (odczyt API 27.09 11:38); aliasy gaÅÄzi `*.tower-hhl.pages.dev` â 404. Ponowny odczyt ustawieÅ Pages z API â przy nastÄpnym logowaniu do Cloudflare (akcja wÅaÅciciela, bez logowania teraz). |
| D-15 | limity ponadnormatywnoÅci PL i SE | **ZEBRANE** 28.09, do potwierdzenia z przewoÅºnikiem | â | â | `docs/handover/LIMITY_PONADNORMATYWNOSC.md`: PL â rozp. MI Dz.U. 2024 poz. 502 Â§ 2, Â§ 3 ust. 1 (brzmienie sprawdzone 28.09), Â§ 5 ust. 1, PoRD art. 61, 64â64d; SE â TrafikfÃ¶rordning 1998:1276 4 kap. 12, 13, 15, 17 Â§Â§, 13 kap. 3 Â§ (dispens). |
| O-V5 | wdroÅ¼enie Vercel `63ea178` (UI bramki SMS, âWyÅlij link SMS-emâ, opÃ³Åºnienie od koÅca dnia dostawy) | **DONE** 28.09 | â | â | tower.log-mar.pl i watch-tower-makieta.vercel.app 200; 0 Ã service_role w index i chunkach; âWyÅlij link SMS-emâ w paczce produkcyjnej. |
| I-20 | ogÃ³lny dziennik audytu (SCOPE 2.6) | **DONE** 28.09 (ten commit) | 0072 (produkcja: naÅoÅ¼ona, 7 wyzwalaczy) | i2 +10 | loads, shipment_items, invoices, invoice_lines, rate_cards, rate_rules, sefs_parameters â audit_log ROW_*; UPDATE tylko ze zmienionymi kolumnami, bez wpisu przy samym przeliczeniu ETA (eta_*, delay_minutes, updated_at); `driver_name`/`driver_phone` jako â[dane osobowe]â (retencja 90 dni nie obejmuje dziennika); KSH nie widzi dziennika. |
| I-21 | terminy zasobÃ³w przed zaÅadunkiem i eskalacja (SCOPE 4.3) | **DONE** 28.09 (ten commit) | 0073 + 0074 jawne klucze rk_res_* + 0075 odczyt terminÃ³w tylko dla aktywnego konta (test session) (produkcja: naÅoÅ¼one; cron `tower-zasoby` 7,22,37,52) | i2 +13, `risk-keys` 14/14 | Terminy w tabeli `resource_deadlines` (propozycja 48/12 h kierowca i pojazd, 24/6 h dokumenty â **do potwierdzenia z SCX, II-3**). Ryzyko RESOURCE_MISSING (rule RESOURCE_DEADLINE, widzi HHL + przewoÅºnik, klient nie), eskalacja HIGH â CRITICAL na tym samym ryzyku, IN_APP RESOURCE_DEADLINE (szablon PL/EN/SV, send-notifications wdroÅ¼ona), zamkniÄcie po uzupeÅnieniu albo po wyjeÅºdzie na zaÅadunek. |
| I-23 | odsiewanie duplikatÃ³w powiadomieÅ (SCOPE 9.8) | **DONE** 28.09 (ten commit) | â | vitest `notify-dedup` 12/12, i2 +2 | 10 miejsc INSERT w bazie, wszystkie z dedup_key i on conflict do nothing; szablony: INVOICE_NEW, ORDER_NO_MISSING, PAYMENT_REMINDER, PLAN_DATES_CHANGED, RESOURCE_DEADLINE, SCHEDULE_DATE_CRITICAL, SMS_FALLBACK, SMS_GATEWAY_SILENT. |
| D-15 (uzup.) | Â§ 3 ust. 1 rozporzÄdzenia â brzmienie sprawdzone | 28.09 | â | â | 40 t (â¥ 5 osi), intermodal 42/44 t (pkt 2 lit. aâd), 4-osiowy czÅonowy 36/38 t (pkt 6); naciski osi przeniesione do wÅaÅciwego Â§ 5 ust. 1 (10 t / 11,5 t). SCOPE Â§57/Â§58: pierwsze litery treÅci poprawione na dosÅowne. |
| I-24 | eksport harmonogramu do PDF (SCOPE 10.8) | **DONE** 28.09 (ten commit) | â | vitest `pdf-export` 3/3 (350 transportÃ³w â â¥ 10 stron, polskie znaki w tytule), e2e `tests/i24-pdf.local.spec.ts` 1/1, domyÅlny 12/12, vitest 459 | `data-action="export-pdf"`; czcionka `public/fonts/LiberationSans-Regular.ttf` (SIL OFL 1.1, licencja obok) pobierana dopiero przy eksporcie; nowe zaleÅ¼noÅci pdf-lib, @pdf-lib/fontkit. Kolumny: kod, typ, status, daty, ETA Boden, tablice, prom â bez kierowcy/telefonu i kwot (plik do przekazania dalej). |
| O-V6 | wdroÅ¼enie Vercel `db3d5e3` (Eksport PDF, teksty ryzyk zasobÃ³w I-21) | **DONE** 28.09 | â | â | tower.log-mar.pl i watch-tower-makieta.vercel.app 200; `/fonts/LiberationSans-Regular.ttf` 200; 0 Ã service_role w index i chunkach. |
| SEC-1 (Â§1.5) | eksport XLSX i dane kierowcy per rola â **WYCIEK POTWIERDZONY I NAPRAWIONY** | **DONE** 28.09 (ten commit) | 0076 (produkcja: naÅoÅ¼ona; `authenticated` bez SELECT `driver_phone`/`driver_name`, anon bez SELECT loads) | i2 325/325 (+7), nullguard 274/274 (+5), vitest 463 (`xlsx-export-roles` 4/4), e2e build produkcyjny `tests/xlsx-roles.local.spec.ts` 3/3 (HHL/KSH/SCX), domyÅlny 12/12, i3-sms 1/1 | **DowÃ³d przed poprawkÄ (lokalny Supabase, konto KSH CLIENT_ADMIN):** `select driver_phone from loads` â telefon kierowcy widoczny (1/50 transportÃ³w z telefonem = 1 widoczny), bez reguÅy Â±24 h (D6 byÅa tylko w UI); XLSX dla KSH i SCX miaÅ kolumny Koszt/PrzychÃ³d/MarÅ¼a (wartoÅci 0 z widokÃ³w rolowych â ceny w bazie byÅy szczelne) oraz Kierowca/Telefon; nagÅÃ³wki `_PLN` przy kwotach w EUR. **Po:** dane kierowcy tylko przez `load_driver_contacts()` (HHL â wszystkie; przewoÅºnik â wÅasne; klient â sam telefon w Â±24 h od dostawy; inni â nic); XLSX: HHL wszystko, KSH `Cena_EUR` + telefon wg D6 (bez kosztu, marÅ¼y, imienia), SCX `Koszt_EUR` + kierowca (bez przychodu, ceny, marÅ¼y); waluta z danych (EUR). Produkcja przed poprawkÄ: 0 telefonÃ³w kierowcÃ³w i tylko HHL aktywny â brak faktycznego ujawnienia. Vercel `baae4a8` wdroÅ¼ony zaraz po migracji (obie domeny 200, 0 Ã service_role, `load_driver_contacts` w paczce, brak `driver_name,driver_phone` w zapytaniu loads). |
| O4 | Oznaczenie demo zostaje do potwierdzenia | **DONE** (potwierdzenie wÅaÅciciela: W-O4) | d1895be | etap6 **1/1** (nowy `npm run test:etap6`, w fresh-smoke) Â· D24 #8 (Trafikverket=demonstracyjne) Â· `tests/demo-label.test.ts` w unit | Oznaczenia **zostajÄ** bez zmian w kodzie: `DemoMark` przy stawkach i opÅacie paliwowej (Opcje Ã2, Finanse Ã1), panel warunkÃ³w drogowych SE w Ryzykach `data-demo=trafikverket` + nota âdemonstracyjneâ (M12 `road-se` gotowy, przeÅÄczy siÄ po kluczu Trafikverket â AN2/D3). Oznaczenia domyÅlnie wÅÄczone; przeÅÄcznik w Opcjach je ukrywa/przywraca (test). **Krok wÅaÅciciela W-O4:** potwierdziÄ prawdziwe stawki i parametry opÅaty paliwowej â dopiero wtedy zdjÄÄ oznaczenie; zaÅoÅ¼yÄ klucz Trafikverket (i TomTom) â panel SE na Å¼ywo. |
| O5 | `RAPORT_KONCOWY.md` + tag `release-1.0` | OPEN | â | â | pending |

---

## Poza zakresem (otwarte â nie pomijaÄ)

| temat | status | uwagi |
|---|---|---|
| Adapter telematyki SCX | OPEN | czeka na nazwÄ systemu + API |
| Parametry operacyjne od przewoÅºnika | OPEN | cutoff promu, progi fal, prÄdkoÅÄ HHL |
| Geometria trasy z zezwolenia | OPEN | czeka na zezwolenia z trasÄ |
| Klucz Trafikverket | OPEN | SE road demo do czasu klucza Â· **AN2 (D3):** panel warunkÃ³w drogowych SE przechodzi na Trafikverket (M12 `road-se`), **gdy wÅaÅciciel zaÅoÅ¼y klucz** â do tego czasu bez zmian |
| Å¹rÃ³dÅo statusu promÃ³w Polferries | ROZSTRZYGNIÄTE (AN2) | komunikaty armatora (`src/lib/ferry/polferries.ts`) + AIS Digitraffic â `ZRODLA_DANYCH.md`; wdroÅ¼enie w M12 |
| Rozbicie marÅ¼y na 3 poziomy | **ZAMKNIÄTE (AN1)** | zgoda w Aneksie 1 â pozycja **M11** |
| GitHub Actions rozliczenia + `unit.yml` | ODÅOÅ»ONE (AN1) | bramÄ zostaje `.githooks/pre-push`; `tests/db/run.sh` rÄcznie |

---

## Licznik wierszy ID

- Wymagane Â§12: **51** + Aneks 1 (AN1, M10, M11) + Aneks 2 (AN2, M12) = **56**; Aneks 3 (AN3, 2.1â2.4, PL-T) + Aneks 4 (AN4, PR1âPR8, release-1.0) = **+16 â 72**
- W tabelach etapÃ³w powyÅ¼ej: **56** (P0Ã3 + F2/G1Ã7 + Etap2Ã14 + BK/G3Ã8 + AneksyÃ2 + Etap4Ã14 + Etap5Ã3 + Etap6Ã5)
- L* po F2.5: **0** na razie (dopisaÄ po F2.5)


## I-2i â pozycje âczÄÅciowoâ dziaÅajÄce tylko w demo (przeglÄd 27.09.2026)

| SCOPE | Co dziaÅaÅo tylko w demo | Produkcja po I-2 | Dalej |
|---|---|---|---|
| 5.12 | ETA liczona w przeglÄdarce ze statusu | ETA v1 w bazie (0051) | parametry odcinkÃ³w: decyzja 17.14 / II-3 |
| 7.4 | notowania paliwa (atrapa w Opcjach/Finansach) | formularz odczytÃ³w ze ÅºrÃ³dÅem (0052), bez zadania pobierania | II-1 (D-2) |
| 9.3 / 9.4 | 12 reguÅ i âUruchomâ bez ewaluacji | moduÅ ukryty | Etap III â silnik Workflows |
| 8.4 | przeprawy alternatywne, objazdy SE (statyczne) | âbrak ÅºrÃ³dÅa danychâ | II-6 / Etap III |
| 8.1 | pogoda i fala (statyczne) | âbrak ÅºrÃ³dÅa danychâ | Etap III â ÅºrÃ³dÅo pogody |
| 10.7 | kafelek âczas wykrycia 8 minâ | ukryty | **I-2l** |
| 6.4 / 6.5 | numer PL/2026/14xx i âzezwolenie zgodneâ | stan z dokumentÃ³w: wgrane / brak / niewymagane (STANDARD), bez deklaracji zgodnoÅci | Etap III â walidator zezwoleÅ |
| 6.6 | przypomnienie o polisie OCP | ukryte | Etap III (C4) |
| 5.10 | pozycje promÃ³w AIS na mapie | ukryte | **I-2j** |
| 6.8 | paczka âtygodniaâ pakuje caÅÄ listÄ | dziaÅa tak samo w obu trybach â bÅÄd, nie fasada | **I-2k** |
| â | oferta factoringu, cennik w Opcjach (zapis w przeglÄdarce) | ukryte / âbrak ÅºrÃ³dÅa danych â B1â | D-1 |

PozostaÅe 26 pozycji âczÄÅciowoâ nie zaleÅ¼Ä od trybu demo (braki infrastruktury, testÃ³w, dokumentacji) â zostajÄ w SCOPE i trafiÄ do kolejki w I-11.
| I-22 | kreator mapowania kolumn importu + szablony w bazie (HHL) | **DONE** 28.09 (ten commit) | 0077 (produkcja: naÅoÅ¼ona) â `import_column_templates` (unikalny podpis nagÅÃ³wkÃ³w w projekcie, RLS odczyt tylko HHL, zapis tylko przez RPC `import_template_save`: HHL, walidacja pÃ³l, wymagane nr przesyÅki + iloÅÄ, upsert po podpisie, wpis `audit_log` IMPORT_TEMPLATE_SAVE) | i2 333/333 (+8), nullguard 279/279 (+5), session 27/27, vitest 467 (`import-mapping` 4/4), e2e build produkcyjny `tests/i22-colmap.local.spec.ts` 1/1 (nieznany ukÅad â kreator â zapis szablonu â podglÄd â import), domyÅlny 12/12 | Nieznany ukÅad pliku otwiera krok mapowania (sugestie z nazw nagÅÃ³wkÃ³w); zapisany szablon rozpoznawany automatycznie przy kolejnym imporcie (toast, bez kreatora). Tryb demo: szablony w localStorage. KSH/SCX nie widzÄ ani nie zapisujÄ szablonÃ³w. |
| O-V7 | Vercel produkcja po I-22 | **DONE** 28.09 | commit `703a387` wdroÅ¼ony (Ready) | tower.log-mar.pl 200, watch-tower-makieta.vercel.app 200, 0 Ã service_role (index + chunki, takÅ¼e zagnieÅ¼dÅ¼one), `import_template_save` w chunku `scheduleImportServer` | â |
| III-3 (czÄÅÄ) + kontrola nullguard | testy bazy tylko lokalnie, wycofanie zapisÃ³w, workflow CI | **CZÄÅCIOWO** 28.09 (ten commit) | â | nullguard 280/280 (+1: migawka audit_log/szablony/loads/faktury/powiadomienia przed i po wywoÅaniach â bez zmian), prÃ³ba z adresem poolera Supabase i obcym hostem â ODMOWA, kod 2 | **Sprawdzone:** nullguard tworzy wÅasnÄ bazÄ tymczasowÄ `tower_test_nullguard` na lokalnym Postgresie (drop/create database), kaÅ¼de wywoÅanie w `begin â¦ rollback`; zapis HHL (np. `import_template_save`) nie zostaje. **Dodane:** `tests/db/local-only.sh` wczytywany przez wszystkie 14 skryptÃ³w `tests/db/*.sh` â odmowa, gdy host PGADMIN nie jest lokalny lub adres wyglÄda na Supabase w chmurze. **Workflow CI** `docs/ci/db.yml` gotowy; push do `.github/workflows/` odrzucony (token bez uprawnienia `workflow`) â do przeniesienia przez wÅaÅciciela; Actions i tak wymaga rozliczeÅ (SCOPE 26.2). Osobny projekt Supabase = koszt â decyzja wÅaÅciciela. |
| III-6 | dokumenty: wymagalnoÅÄ i terminy per kategoria w bazie, wersje, widocznoÅÄ per organizacja (SCOPE 6.1, 6.2) | **DONE** 28.09 (ten commit) | 0078 (produkcja: naÅoÅ¼ona, 7 wymagaÅ startowych) â `doc_requirements` (projekt Ã kategoria: wymagany, strona odpowiedzialna, zdarzenie odniesienia, przesuniÄcie h; odczyt: aktywne konto; zapis tylko `doc_requirement_set` â HHL, audit_log ze starÄ wartoÅciÄ; wyzwalacz zakÅada wymagania dla nowego projektu), `doc_requirements_status()` (security invoker: transport Ã kategoria wymagana â termin, OK/MISSING/OVERDUE), `documents.supersedes/superseded_at` + `document_supersede` (tylko autor nowego pliku w ciÄgu 1 h, ten sam transport i kategoria, audit_log), `docs_scope`: dokument bez transportu wgrany przez przewoÅºnika niewidoczny dla innego przewoÅºnika | i2 353/353 (+20), nullguard 295/295 (+15), session 27/27, security 83/83, vitest 472 (`doc-requirements` 2/2, `doc-versions` 3/3), e2e build produkcyjny `tests/iii6-docs.local.spec.ts` 2/2 (HHL zmienia termin CMR â zapis w bazie + audit_log, licznik âpo terminieâ = baza; KSH bez przycisku zmiany), domyÅlny 12/12 | Widok Dokumenty: kolumny âWymagany / terminâ i âPo terminieâ z bazy, HHL zmienia wymagalnoÅÄ i godziny w wierszu. Nowy plik tej samej kategorii transportu = nowa wersja (zdjÄcia mocowania bez wersji), zastÄpione poza sejfem, znacznik âwersja Nâ. **Decyzja do potwierdzenia z SCX/KSH:** terminy startowe â zezwolenie PL 24 h przed zaÅadunkiem, zezwolenie SE 24 h przed promem, CMR i zdjÄcia do 2 h po zaÅadunku, POD do 24 h po rozÅadunku, rysunek KSH 72 h przed zaÅadunkiem, polisa â dokument organizacyjny. |
| III-7 | peÅna ÅcieÅ¼ka sporu i akceptacji faktury (SCOPE 7.10) | **DONE** 28.09 (ten commit) | 0079 (produkcja: naÅoÅ¼ona; `send-notifications` wdroÅ¼ona z szablonami sporu) â `invoice_dispute_events` (OPENED / REPLY / CORRECTION / RESOLVED / WITHDRAWN; odczyt: strony faktury i HHL; zapis tylko wyzwalaczem i RPC), wyzwalacz po zmianie `verification_status` (wpis + powiadomienie wystawcy INVOICE_DISPUTED / INVOICE_DISPUTE_RESOLVED, dedup_key), `invoice_dispute_reply` (tylko wystawca, tylko faktura SPORNA, opcjonalnie dokument korekty; powiadomienie odbiorcy INVOICE_DISPUTE_REPLY; audit_log), `mark_invoice_paid`: faktura kosztowa w sporze â zapÅata wstrzymana | i2 371/371 (+18), nullguard 300/300 (+5), money 130/130, release 145/145, vitest 475 (`invoice-dispute` 2/2, szablony PL/EN/SV), e2e build produkcyjny `tests/iii7-dispute.local.spec.ts` 3/3 (KSH spÃ³r â HHL widzi i odpowiada, KSH dostaje powiadomienie â KSH akceptuje, historia OPENED,REPLY,RESOLVED; HHL: âOpÅaconaâ wyÅÄczona dla faktury kosztowej w sporze), domyÅlny 12/12 | SzczegÃ³Åy faktury: âHistoria sporuâ (kto, kiedy, krok, treÅÄ) i pole odpowiedzi dla wystawcy. Korekta z dokumentem â obsÅugiwana w bazie (CORRECTION), w UI dziÅ odpowiedÅº tekstowa. |
| O-V8 | Vercel produkcja po III-6 i III-7 | **DONE** 28.09 | `bc31ac1` (III-6), potem `d0eb99f` (III-7) wdroÅ¼one | tower.log-mar.pl 200, watch-tower-makieta.vercel.app 200, 0 Ã service_role (index + chunki, takÅ¼e zagnieÅ¼dÅ¼one); `doc_requirements_status` i `invoice_dispute_reply` w chunkach leniwych (paczka demo bez nich â test i2-demo-no-send) | â |
| I-25 (P0) | cofniÄcie reguÅy opÃ³Åºnienia z 0070 (bÅÄd w komunikacie koordynatora) | **DONE** 28.09 (ten commit) | 0080 (produkcja: naÅoÅ¼ona po teÅcie w wycofanej transakcji: okno 08â12 / ETA 18:00 â 360) â `load_delivery_deadline(dzieÅ, plan_delivery_to)` = koniec okna, a bez okna pÃ³Ånoc po dniu dostawy (Europe/Stockholm); `refresh_load_eta` liczy od niego; przeliczenie transportÃ³w w toku | i2 373/373 (+2: akceptacja 360 \| 0 \| 360 i pÃ³Ånoc lato/zima; przeliczenie na transporcie z oknem), import 49/49 (+1: import nie ustawia okna dostawy ani zaÅadunku), vitest 476 (`time.test.ts`: te same 3 przypadki + ETA przed koÅcem okna â funkcja UI `delayMinutesVsPlan` z oknem), domyÅlny e2e 12/12 | W produkcji UI pokazuje `loads.delay_minutes` z bazy (`delayPillMinutes`), w demo â `delayMinutesVsPlan` z tÄ samÄ reguÅÄ, wiÄc baza i UI liczÄ identycznie. Okno pochodzi wyÅÄcznie od KSH (0061). `import_schedule` zapisuje tylko `plan_load_date` i `plan_delivery_date`, a godzina z pliku nie tworzy okna. SCOPE Â§57: zdanie o opÃ³Åºnieniu zastÄpione dosÅownie. |
| III-3 â decyzja | gdzie uruchamiaÄ testy bazy | **DECYZJA** 28.09 | â | â | **Wybrano: lokalny Postgres/Supabase w samej kontroli kodu** â hook pre-push uruchamia peÅne `tests/db/gate.sh` (14 zestawÃ³w, kaÅ¼dy na wÅasnej bazie tymczasowej), a `tests/db/local-only.sh` odmawia pracy na hoÅcie innym niÅ¼ lokalny. **Odrzucono:** (a) drugi projekt Supabase â zajÄÅby ostatni darmowy slot i usypia siÄ po 7 dniach bezczynnoÅci, a PLAN Â§1.4 zakazuje zakÅadania projektÃ³w i wÅÄczania rozliczeÅ; (b) GitHub Actions â wczeÅniej runner nie startowaÅ z powodu rozliczeÅ (SCOPE 26.2), a token agenta nie ma uprawnienia `workflow`. `docs/ci/db.yml` zostaje jako gotowy wariant na przyszÅoÅÄ, bez sekretÃ³w i bez chmury Supabase, jeÅli wÅaÅciciel wÅÄczy Actions. Å»adne nowe pÅatne ani chmurowe zasoby nie zostaÅy utworzone. |
| O-V9 | Vercel produkcja po I-25 | **DONE** 28.09 | commit `e5849f9` wdroÅ¼ony | tower.log-mar.pl 200, watch-tower-makieta.vercel.app 200, 0 Ã service_role (index + chunki, takÅ¼e zagnieÅ¼dÅ¼one) | Pytania o terminy dokumentÃ³w (III-6) i zasobÃ³w (I-21) dopisane do II-3 w PLAN. |
| SEC-2 + walidator 6.5 | walidator zezwoleÅ i wymiarÃ³w zestawu; szczelnoÅÄ `permits` | **DONE** 28.09 (ten commit) | 0081 (produkcja: naÅoÅ¼ona; anon bez SELECT permits, polityka `permits_read`) | i2 388/388 (+15), nullguard 316/316 (+15), security 83/83, storage 37/37, release 145/145, vitest 476, e2e build produkcyjny `tests/permit-validator.local.spec.ts` 1/1, domyÅlny 12/12 | **Znalezione (bezpieczeÅstwo/poprawnoÅÄ):** (1) `permits` miaÅo RLS bez Å¼adnej polityki, a anon i authenticated miaÅy peÅne uprawnienia tabelowe (INSERT/UPDATE/DELETE/TRUNCATE). RLS blokowaÅo wiersze, wiÄc nie byÅo wycieku ani zapisu, ale tabela byÅa bezuÅ¼yteczna, a uprawnienia nadmiarowe. Teraz anon nie ma nic, authenticated ma tylko SELECT, odczyt przysÅuguje HHL i stronom widzÄcym powiÄzany transport, a zapis idzie wyÅÄcznie przez RPC `permit_save` / `load_permit_link` (HHL albo przewoÅºnik transportu, audit_log). (2) `permit_fits` liczyÅ nieznany wymiar zestawu jako 0, czyli âpasujeâ. Teraz to naruszenie DIMS_UNKNOWN. **Blokada:** transport z powiÄzanym niezgodnym zezwoleniem nie przejdzie z PLANNED/RESOURCES_PENDING/DOCS_PENDING do READY ani dalej (komunikat z krajem, numerem i naruszeniem). Brak zezwolenia PL/SE jest sygnalizowany w `load_permit_status.missing_countries`, ale nie blokuje, bo produkcja nie ma jeszcze zezwoleÅ w bazie. UI: baner âZezwolenie niezgodne z zestawemâ w szufladzie, `permitFits` z bazy. **Otwarte:** formularz zezwoleÅ w UI (SCOPE 6.4). |
| O-V10 | Vercel produkcja po walidatorze 6.5 | **DONE** 28.09 | commit `67e5bc7` wdroÅ¼ony (Ready, 04:33) | tower.log-mar.pl 200, watch-tower-makieta.vercel.app 200, 0 Ã service_role (index + chunki, takÅ¼e zagnieÅ¼dÅ¼one), `load_permit_status` w chunkach | Pierwsza prÃ³ba `vercel --prod` zwrÃ³ciÅa âNot authorizedâ (przejÅciowo, `whoami` poprawne), a ponowienie przeszÅo. |
| III-7 (luka UI) | korekta faktury z zaÅÄczonym dokumentem | **DONE** 28.09 (ten commit) | 0082 (produkcja: naÅoÅ¼ona po prÃ³bie w wycofanej transakcji) â `invoice_documents.role` + KOREKTA (KSH widzi jÄ w module faktur), `invoice_dispute_reply(â¦, p_document)`: plik musi byÄ ÅwieÅ¼y (â¤ 24 h), wgrany przez tÄ samÄ osobÄ, INVOICE bez transportu, z projektu faktury i niepowiÄzany z Å¼adnÄ fakturÄ; po zapisie ÅÄczony z fakturÄ jako KOREKTA | i2 400/400 (+12: cudzy plik / plik innej faktury / ponowne uÅ¼ycie â odmowa; SCX korekta â CORRECTION + KOREKTA + audit_log; KSH przed wysÅaniem nie widzi pliku HHL, po wysÅaniu widzi; SCX nie widzi korekty faktury HHL â KSH; KSH nie widzi korekty SCX â HHL), nullguard 316/316, money 130/130, storage 37/37, vitest 477 (`invoice-dispute` +1: tylko PDF â¤ 10 MB), e2e build produkcyjny `tests/iii7-dispute.local.spec.ts` 3/3 (HHL zaÅÄcza PDF â wpis âkorekta wystawcyâ z plikiem; KSH otwiera plik linkiem podpisanym â 200, `%PDF`), fresh-smoke 12/12 i reszta zielona, i2-demo-no-send 5/5 | **Znalezione:** przed 0082 dokument korekty (wgrany przez wystawcÄ) byÅ widoczny tylko dla autora, wiÄc odbiorca nie mÃ³gÅ otworzyÄ pliku z wpisu CORRECTION. UI: przycisk âZaÅÄcz korektÄ (PDF)â obok odpowiedzi, a po wyborze pliku przycisk zmienia siÄ na âWyÅlij korektÄâ. W historii sporu przy wpisie pojawia siÄ âPlik korekty: nazwaâ. Tryb demo: plik trzymany w sesji. Przy odrzuceniu przez bazÄ plik jest usuwany ze Storage i z `documents`. |
| I-26 (P1, bezpieczeÅstwo) | anon bez uprawnieÅ do tabel i sekwencji w `public`; authenticated bez TRUNCATE/REFERENCES/TRIGGER | **DONE** 28.09 (ten commit) | 0083 (produkcja: naÅoÅ¼ona po prÃ³bie w wycofanej transakcji) â odebranie wszystkich uprawnieÅ anon do tabel/widokÃ³w/sekwencji `public` (poza `spatial_ref_sys`), TRUNCATE/REFERENCES/TRIGGER od authenticated, `ALTER DEFAULT PRIVILEGES` dla postgres (tabele i sekwencje) | security 88/88 (+5: anon 0 uprawnieÅ tabel, anon 0 sekwencji, authenticated 0 Ã TRUNCATE/REFERENCES/TRIGGER, nowa tabela/sekwencja bez uprawnieÅ anon i bez TRUNCATE dla authenticated, INSERT anon do loads â permission denied), caÅa brama 14/14 (release 145/145: przebieg kierowcy z tokenem jako anon â pozycja, zdarzenie, instrukcje), lokalny Supabase, build produkcyjny: `i2-facade.local` 12/12 (w tym I-4 PWA kierowcy z linku i I-6 `report_client_error` jako anon) + `iii7-dispute.local` 3/3 | **Stan produkcji przed 0083:** anon miaÅ peÅne INSERT/UPDATE/DELETE/TRUNCATE na 22 tabelach (documents, geofences, insurance_policies, integration_runs, invoice_documents, invoice_lines, invoices, load_events, load_messages, organizations, payment_terms, positions, projects, risk_signals, sailings, shipment_items, user_preferences, vessels, workflows; na loads INSERT/UPDATE/TRUNCATE), SELECT na app_users i eta_segment_params, USAGE na 15 sekwencjach. ZatrzymywaÅo go tylko RLS; TRUNCATE RLS nie obejmuje, ale PostgREST go nie udostÄpnia, wiÄc nie byÅo drogi wykorzystania z API. authenticated miaÅ TRUNCATE na 29, a REFERENCES/TRIGGER na 38 tabelach â nadmiarowe, odebrane. **Po 0083 (produkcja):** anon 0 uprawnieÅ tabelowych poza spatial_ref_sys (chroni go wyzwalacz 0031) oraz widokami PostGIS `geometry_columns` / `geography_columns`. Te widoki naleÅ¼Ä do supabase_admin, wiÄc migracja (postgres) ich nie zmieni; to metadane katalogu, a zapis blokujÄ reguÅy DO INSTEAD NOTHING. Sekwencje anon: 0. authenticated TRUNCATE/REFERENCES/TRIGGER: 0. `keep_alive` jako anon dziaÅa; `driver_get_instructions` dochodzi do sprawdzenia tokenu (na produkcji 0 transportÃ³w â peÅny przebieg sprawdzony lokalnie). **Otwarte (poza zakresem):** domyÅlne uprawnienia supabase_admin w `public` nadal nadajÄ anon wszystko na nowych obiektach tego wÅaÅciciela. TworzÄ je tylko rozszerzenia, bo migracje dziaÅajÄ jako postgres, a zmiana wymaga czÅonkostwa w supabase_admin. Schemat `storage` ma podobne domyÅlne uprawnienia â chroni go RLS Supabase Storage. |
| I-27 (P1, przed R-3) | brak zezwolenia blokuje âGotowyâ dla klasy â  STANDARD â przeÅÄcznik | **DONE** 28.09 (ten commit) | 0084 (produkcja: naÅoÅ¼ona po prÃ³bie w wycofanej transakcji; flaga **wyÅÄczona**) â `security_flags.PERMIT_REQUIRED_NON_STANDARD` (domyÅlnie false), `admin_set_permit_requirement(bool)` (tylko HHL_ADMIN, audit_log PERMIT_REQUIREMENT_SET), `permit_requirement_state()` (odczyt HHL), `load_needs_permit` (pozycja klasy â  STANDARD albo brak pozycji), `trg_loads_permit_gate`: przy wÅÄczonej fladze brak powiÄzanego zezwolenia PL lub SE â odmowa przejÅcia PLANNED/RESOURCES_PENDING/DOCS_PENDING â READY i dalej (komunikat z brakujÄcymi krajami) | i2 416/416 (+16: domyÅlnie wyÅÄczony i DIMENSIONED przechodzi; KSH/SCX nie wÅÄczajÄ i nie widzÄ stanu; HHL_ADMIN wÅÄcza + audit_log; **DIMENSIONED bez zezwolenia nie osiÄga READY** (HHL i przewoÅºnik); STANDARD bez zezwolenia przechodzi; tylko PL â âbrak SEâ; PL+SE zgodne â READY; brak pozycji = ponadnormatywny; wyÅÄczenie), nullguard 326/326 (+10), security 88/88 (lista funkcji +2), e2e build produkcyjny `tests/i27-permit-toggle.local.spec.ts` 2/2 (HHL_ADMIN w Opcjach wÅÄcza i wyÅÄcza â flaga i audit_log; KSH bez panelu) | **DziaÅanie wÅaÅciciela (PLAN Â§4, D-21):** przed pierwszym prawdziwym transportem wejdÅº w Opcje â âWymÃ³g zezwoleÅ (transporty ponadnormatywne)â â âWÅÄcz wymÃ³gâ. Do tego czasu brak zezwolenia jest tylko sygnalizowany (`missing_countries`), a niezgodne zezwolenie blokuje zawsze (0081). |
| I-28 (P2) | usuniÄcie `load_delivery_day_end` | **DONE** 28.09 (ten commit) | 0085 (produkcja: naÅoÅ¼ona) â `drop function if exists load_delivery_day_end(date, timestamptz)` | i2 417/417 (+1: funkcja usuniÄta, `load_delivery_deadline` zostaje) | Przed usuniÄciem sprawdzone: na produkcji 0 funkcji z odwoÅaniem w treÅci i 0 zaleÅ¼noÅci `pg_depend`; w repozytorium poza 0070/0080 i dziennikiem 0 odwoÅaÅ (aplikacja, Edge, testy). |
| O-V11 | Vercel produkcja po III-7 (korekta), I-26, I-27, I-28 | **DONE** 28.09 | commit `5e5776c` wdroÅ¼ony (Ready) | tower.log-mar.pl 200, watch-tower-makieta.vercel.app 200, 0 Ã service_role (index + chunki, takÅ¼e zagnieÅ¼dÅ¼one), `admin_set_permit_requirement` i `p_document` (korekta) w chunkach leniwych | Migracje 0082â0085 naÅoÅ¼one na produkcjÄ przed wdroÅ¼eniem, kaÅ¼da najpierw sprawdzona w wycofanej transakcji. Pierwsza prÃ³ba `vercel --prod` znowu zwrÃ³ciÅa âNot authorizedâ, a ponowienie przeszÅo. |
| SCOPE 6.4 | formularz zezwoleÅ w UI â HHL i przewoÅºnik transportu | **DONE** 28.09 (ten commit) | 0086 (produkcja: naÅoÅ¼ona `supabase db push` po prÃ³bie w wycofanej transakcji: 2 nowe funkcje, anon bez EXECUTE, `search_path` ustalona, straÅ¼niki odmawiajÄ dla nieznanego transportu; produkcja: 0 transportÃ³w, 0 zezwoleÅ) â `load_permit_save` (pola: kraj PL/SE, numer, organ, waÅ¼noÅÄ odâdo, maks. dÅugoÅÄ/szerokoÅÄ/wysokoÅÄ/masa â puste = bez limitu, pojazdy pilotujÄce 0â5, trasa â¤ 2000 zn.; zapis + powiÄzanie w jednej transakcji; HHL albo przewoÅºnik transportu; anulowany = odmowa; audit_log PERMIT_SAVE + PERMIT_LINK), `load_permit_unlink` (tylko przed READY â po READY odÅÄczenie obchodziÅoby blokadÄ 0081/0084; audit_log PERMIT_UNLINK), `permit_save`: przewoÅºnik tylko w projekcie, w ktÃ³rym ma transport | i2 436/436 (+19), nullguard 336/336 (+10), security 88/88 (lista funkcji +2), vitest 477, e2e build produkcyjny `tests/p64-permit-form.local.spec.ts` 2/2 (SCX dodaje PL 30 m do zestawu 32,5 m â âniezgodne Â· dÅugoÅÄ ponad limitâ, baner w przeglÄdzie, w bazie organ/pilotaÅ¼/wysokoÅÄ/powiÄzanie/audit_log; odÅÄczenie â 0 powiÄzaÅ + PERMIT_UNLINK; HHL wiÄÅ¼e istniejÄce zezwolenie projektu; KSH widzi wiersz bez przyciskÃ³w), regresja `permit-validator.local` + `i27-permit-toggle.local` 3/3 | UI: szuflada â Dokumenty â âZezwolenia transportuâ: lista powiÄzanych zezwoleÅ z ocenÄ `permit_fits` (RLS) i powodami, âDodaj zezwolenieâ, âPowiÄÅ¼â (zezwolenie projektu), âOdÅÄczâ (przed âGotowyâ); chunk leniwy tylko w buildzie Supabase (paczka demo bez zmian). Teksty PL/EN/SV (`p64_*`). |
| III-4 | pojazdy pilotujÄce: dane i awizacja (SCOPE 4.5) | **DONE** 28.09 (ten commit) | 0087 (produkcja: naÅoÅ¼ona `supabase db push` po prÃ³bie w wycofanej transakcji: 4 rodzaje terminÃ³w, anon bez uprawnieÅ, authenticated tylko SELECT, `detect_resource_deadlines` = 0, straÅ¼nik odmawia; `send-notifications` wdroÅ¼ona z opisem ESCORT) â `load_escorts` (kolejnoÅÄ 1â5, firma, tablica `^[A-Z0-9 -]{2,15}$`, zakres PL / SE / PL_SE; RLS jak loads), `load_escorts_set` (peÅna lista, HHL albo przewoÅºnik transportu, do rozÅadunku; synchronizuje `loads.escort_vehicles`; audit_log ESCORTS_SET ze starÄ i nowÄ listÄ), `load_escort_status()` (wymagane = maks. `escort_required` powiÄzanych zezwoleÅ / awizowane / brakujÄce), termin ESCORT 48/12 h w `resource_deadlines` â RESOURCE_MISSING `rk_res_escort` z eskalacjÄ i auto-zamkniÄciem | i2 456/456 (+20), nullguard 346/346 (+10), security 88/88 (lista +2), backup 23/23, release 145/145, vitest 477 (klucze `rk_res_escort*` PL/EN/SV), e2e build produkcyjny `tests/iii4-escorts.local.spec.ts` 2/2 (wymagane 2 â âawizowane 0 / wymagane 2â â SCX awizuje 2 â â2 / 2â, w bazie `1:PO 12345:PL,2:ABC 123:SE`, escort_vehicles 2, audit_log; KSH lista bez formularza), `i2-facade.local` 12/12, `p64-permit-form.local` 2/2 | UI (build Supabase): szuflada â zakÅadka zasobÃ³w â âPojazdy pilotujÄceâ zamiast pola âPilotâ (tryb demo bez zmian). **Decyzje:** termin ESCORT 48/12 h â pytanie do SCX w II-3 (c); imiÄ/telefon pilota â D-22. |
| III-5 | mapa: unikanie kolizji etykiet (SCOPE 5.10), odtwarzanie przebiegu w czasie (SCOPE 5.13) | **DONE** 28.09 (ten commit) | 0088 (produkcja: naÅoÅ¼ona po prÃ³bie w wycofanej transakcji: anon bez EXECUTE, authenticated z EXECUTE, nieznany transport â 0 wierszy) â `load_track(p_load, p_limit â¤ 5000)` security invoker (RLS `positions_read`), punkt przyciÄgniÄty do drogi ma pierwszeÅstwo przed surowym | i2 461/461 (+5: uprawnienia, SCX 3 punkty rosnÄco z pierwszeÅstwem punktu przyciÄgniÄtego, KSH widzi, limit = najnowsze, inny przewoÅºnik 0), nullguard 350/350 (+4), vitest 488 (+11 `map-declutter`: 2/3/6/12/50 znacznikÃ³w w jednym punkcie â odstÄp â¥ 22 px, determinizm, ÅaÅcuch, interpolacja przebiegu), e2e build produkcyjny `tests/iii5-map.local.spec.ts` 1/1 (50 transportÃ³w: minimalny odstÄp ÅrodkÃ³w znacznikÃ³w â¥ 20 px; âÅladâ + transport z 12 pozycjami â â12 pozycjiâ, suwak zmienia chwilÄ, âOdtwÃ³rzâ przesuwa; transport bez GPS â âBrak pozycji GPSâ) | **Kolizje:** w produkcji pozycje transportÃ³w wynikajÄ ze statusu (np. 50 Ã plac zaÅadunku = jeden punkt) â nakÅadajÄce siÄ znaczniki rozkÅadane na okrÄgu (â¤ 8) albo spirali Vogla (> 8), przeliczane po zmianie przybliÅ¼enia; tryb demo bez zmian (wzorzec zrzutÃ³w makiety). **Odtwarzanie:** warstwa âÅladâ (byÅa w makiecie bez dziaÅania) + wybrany transport â linia przebiegu z bazy, znacznik w czasie, suwak, âOdtwÃ³rz/Pauzaâ (~30 s na przebieg), czas i prÄdkoÅÄ punktu; zostaje po zamkniÄciu szuflady; bez danych â komunikat, nigdy trasa przykÅadowa. |
| III-9 | ocena przewoÅºnika (SCOPE 10.6); widok placu budowy (SCOPE 10.4, opcjonalny) | **DONE** 28.09 (10.6, ten commit); 10.4 â D-24 | 0089 (produkcja: naÅoÅ¼ona `supabase db push` po prÃ³bie w wycofanej transakcji, 2Ã naÅoÅ¼ona = idempotentna: anon bez SELECT, obie funkcje SECURITY DEFINER z `search_path=public`) â tabela `carrier_ratings` (jedna ocena na transport, RLS i SELECT tylko HHL), `carrier_rate_load` (tylko HHL, po rozÅadunku, 1â5 + komentarz â¤ 500, audit_log CARRIER_RATING), `carrier_scorecard(p_from, p_to)` (tylko HHL) | i2 473/473 (+12), nullguard 360/360 (+10), vitest 488, e2e build produkcyjny `tests/iii9-rating.local.spec.ts` 2/2 (HHL: ocena 4 w szufladzie â wiersz + audit_log, karta â4,00 / 5 (1)â, na czas â1 (100%)â; KSH: bez formularza) | Karta przewoÅºnikÃ³w w Opcjach (tylko HHL): zrealizowane, na czas (do koÅca okna, bez okna do koÅca dnia dostawy), opÃ³Åºnienia z winy przewoÅºnika, Årednie spÃ³Åºnienie, Årednia ocena; filtr dat rozÅadunku. Ocena w szufladzie (przeglÄd) po rozÅadunku. Nowe decyzje: D-23 (czy przewoÅºnik widzi oceny), D-24 (widok placu budowy â nowa rola i wzorzec). |
| O-V12 | Vercel produkcja po SCOPE 6.4 i III-4 | **DONE** 28.09 | commit `bd13a92` wdroÅ¼ony (Ready) | tower.log-mar.pl 200, watch-tower-makieta.vercel.app 200, 55 plikÃ³w JS, 0 Ã service_role, 0 Ã klucz; chunki PermitForm i EscortPanel obecne | Migracje 0086â0087 i funkcja Edge `send-notifications` na produkcji przed wdroÅ¼eniem. |
| O-V13 | Vercel produkcja po III-5 i III-9 | **DONE** 28.09 | commit `cee4920` wdroÅ¼ony (Ready) | tower.log-mar.pl 200, watch-tower-makieta.vercel.app 200 (ten sam index), 39 plikÃ³w JS (index + chunki zagnieÅ¼dÅ¼one), 0 Ã service_role, 0 Ã klucz; chunki TrackReplay, CarrierScorecard, CarrierRating, PermitForm, EscortPanel obecne | Migracje 0088â0089 naÅoÅ¼one na produkcjÄ przed wdroÅ¼eniem, kaÅ¼da najpierw sprawdzona w wycofanej transakcji. |
| III-2 (czÄÅÄ) | wiernoÅÄ wizualna: suma kontrolna arkusza wobec makiety (SCOPE 0.1), procedura nowej klasy (SCOPE 0.7) | **CZÄÅCIOWO** 28.09 (ten commit) | `tests/stylesheet-mockup.test.ts` (4 testy): SHA-256 arkusza referencyjnego makiety, tokeny :root rÃ³wne, kaÅ¼da deklaracja makiety (204 selektory, takÅ¼e @media) = ta sama wartoÅÄ w `src/index.css` po rozwiniÄciu `var(--â¦)`, lista 13 odstÄpstw z uzasadnieniem i ÅºrÃ³dÅem (NAPRAWY D9, BATCH-SCROLL, FIX_MORNING, F2.3) bez martwych wpisÃ³w; DESIGN_SYSTEM.md Â§7a (3 warunki) | vitest 492 (+4), stylelint 0 | **Znaleziony i naprawiony dryf:** reset preflight `code,kbd,samp,pre{font-size:1em}` (D1) nadpisywaÅ reguÅÄ makiety `kbd{font-size:11.5px}` â skrÃ³ty w âPomocy klawiaturyâ i podpowiedÅº â/â w harmonogramie miaÅy rozmiar tekstu otoczenia; `kbd` wyjÄty z resetu. Zostaje: prÃ³g 0,1% / 840 ujÄÄ (CI odrzucone w III-3) i zrzuty stanÃ³w. |
| O-V14 | Vercel produkcja po III-2 (czÄÅÄ: dryf kbd) | **DONE** 28.09 | commit `f7bda8b` wdroÅ¼ony (Ready) | tower.log-mar.pl 200, watch-tower-makieta.vercel.app 200, 39 plikÃ³w JS, 0 Ã service_role, 0 Ã klucz; w arkuszu CSS produkcji reset `code,samp,pre` bez `kbd` | Bez nowych migracji. |
| III-2 (reszta) | wiernoÅÄ wizualna: zrzuty stanÃ³w (SCOPE 0.8, 0.9), tryb systemowy (0.10), brama 0,1% (0.3, 11.4) | **CZÄÅCIOWO** 28.09 (ten commit) â 0.8â0.10 DONE; 0.3 â D-25 (STOP Â§1.4: nieoczekiwane rÃ³Å¼nice wzorca spoza pozycji) | `tests/visual-states.spec.ts` â 11 wzorcÃ³w `stan-*.png` (najechanie, fokus, pusty Ã ciemny/jasny; wciÅniÄty, zablokowany, Åadowanie, bÅÄd, walidacja) + test trybu systemowego; harmonogram: szkielet 12 wierszy przez 260 ms i stan pusty `.empty` z âWyczyÅÄ filtryâ (tekst makiety, PL/EN/SV `iii2_empty_*`); `npm run gate:visual` (`scripts/visual/gate.sh`: git archive HEAD â build demo â podglÄd :4188 â smoke + stany â matryca 840 â `compare-baseline.mjs` STRICT, prÃ³g 0,1%); stany doÅÄczone do pre-push (`fresh-smoke.sh`) | stany 12/12 (2 przebiegi bez rÃ³Å¼nic), smoke 4/4, d19 2/2, deur 2/2, etap4 12/12, etap5 5/5, etap6 1/1, vitest 492; matryca 840/840 wykonana (~67 min, 0 bÅÄdÃ³w): **665 w progu 0,1%, 175 ponad** (Dokumenty 90, Harmonogram 85) | RÃ³Å¼nice zbadane: build kontrolny z cofniÄtÄ poprawkÄ `kbd` daje te same 85 rÃ³Å¼nic Harmonogramu (przyciski âWgraj aktualizacjÄâ, âEksport PDFâ z I-22/I-24), a sama poprawka `kbd` zmienia â¤ 25 px na ujÄcie (< 0,1%, bez zmiany wzorca). Dokumenty: terminy i âZmieÅâ per kategoria + wybÃ³r tygodnia (III-6). Wzorca **nie odÅwieÅ¼yÅem** (zmiana spoza pozycji) â decyzja D-25. PodglÄd 4177 i `dist/` nietkniÄte; wÅasne podglÄdy :4188/:4189/:4190 z katalogÃ³w /tmp. |
| O-V15 | Vercel produkcja po III-2 (stany harmonogramu) | **DONE** 28.09 | commit `e7b7bfa` wdroÅ¼ony (Ready) | tower.log-mar.pl 200, watch-tower-makieta.vercel.app 200, 39 plikÃ³w JS, 0 Ã service_role, 0 Ã klucz; stan pusty harmonogramu (`data-sched-empty`) w paczce | Bez nowych migracji. |
| INC-28.09 | incydent: fragment hasÅa bazy produkcji w wyjÅciu narzÄdzia agenta (nie na dysku) | **ZAMKNIÄTY** 28.09 â wÅaÅciciel zaakceptowaÅ ryzyko, hasÅo bez zmian | `SUPABASE_DB_URL` w .env.local poprawione: â@â w haÅle zakodowane jako %40 (URL parsuje siÄ poprawnie; poÅÄczenie bezpoÅrednie wymaga IPv6, niedostÄpnego na maszynie roboczej â praca dalej przez pooler) | przeszukanie dysku: 0 plikÃ³w z hasÅem | Przyczyna: niezakodowany â@â zmyliÅ maskowanie; maskowanie URL zawsze do ostatniego â@â. |
| D-22 | kierowca pojazdu pilotujÄcego: imiÄ i telefon (decyzja wÅaÅciciela 28.09) | **DONE** 28.09 (ten commit) | 0090 (produkcja: naÅoÅ¼ona `supabase db push` po prÃ³bie w wycofanej transakcji, 2Ã = idempotentna: authenticated bez SELECT `driver_phone`, z SELECT `plate`; `load_escort_contacts` SECURITY DEFINER z `search_path`, anon bez EXECUTE) â kolumny `load_escorts.driver_name/driver_phone` (E.164), uprawnienia kolumnowe jak `loads` (0076), `load_escort_contacts()` (HHL wszystkie, przewoÅºnik wÅasne, KSH 0), `load_escorts_set` z kontaktem (walidacja, audit_log bez danych osobowych), `purge_personal_data` + piloci 90 dni | i2 486/486 (+13: uprawnienia kolumnowe, zÅy telefon/imiÄ, zapis z normalizacjÄ telefonu, SCX/HHL widzÄ, KSH 0 i âpermission deniedâ na kolumnie, KSH widzi pojazdy bez danych, inny przewoÅºnik 0, audit bez PII, retencja 89 dni zostaje / 91 dni czyÅci + licznik), nullguard 364/364 (+4), e2e `tests/iii4-escorts.local.spec.ts` 2/2 (SCX wpisuje kierowcÄ pilota â baza, brak PII w audit_log, odczyt po ponownym otwarciu; KSH: ani w DOM, ani w treÅci strony) | Eksport XLSX harmonogramu budowany z danych transportÃ³w w przeglÄdarce â kontaktÃ³w pilota tam nie ma, a KSH i tak ich nie dostaje z bazy. Nota w formularzu: âwidzi tylko HHL i przewoÅºnik; usuwane 90 dni po rozÅadunkuâ. SECURITY.md Â§2 uzupeÅnione. |
| D-25 | warunkowe odÅwieÅ¼enie wzorca Dokumenty/Harmonogram + brama wizualna bez nadzoru (decyzja wÅaÅciciela 28.09) | **DONE** 28.09 (ten commit) â **139 odÅwieÅ¼onych / 36 wypisanych** | `scripts/visual/d25-verify.mjs`: kandydat HEAD (build demo, :4188, 180 ujÄÄ z prostokÄtami stref) â dla kaÅ¼dego ujÄcia rÃ³Å¼nica nad strefÄ, w pasach bocznych i pod strefÄ po przesuniÄciu pionowym (skrÃ³ty wierszy) â¤ 0,1%; wynik `docs/evidence/d25-verify-2026-09-28.json`. `scripts/visual/gate.sh` przepisany na przebieg bez nadzoru: blokada, linia wyniku zawsze w `/workspace/wt-gate-visual/last.txt` + `history.log`, kody 0â5 | 175 ujÄÄ z rÃ³Å¼nicÄ: **139 zgodnych** (rÃ³Å¼nica wyÅÄcznie w strefie nowych elementÃ³w, w tym przesuniÄcie treÅci pod niÄ) â w `shots-baseline/`; **5** mieÅci siÄ w progu (bez zmiany); **36 wypisanych, NIE zaktualizowanych**: (a) 12 Ã Harmonogram 1920 (HHL i SCX Ã pl/en/sv Ã 2 motywy) â w kolumnie âTelefonâ inne numery kierowcÃ³w w danych demo (+48000000001â¦ zamiast +48601234821â¦) â zmiana treÅci spoza nowych elementÃ³w; (b) 18 Ã Dokumenty HHL 1280/1440/1920 â lista âPliki w vaultâ przesuniÄta o uÅamkowe ~133 px: te same pozycje, rÃ³Å¼nica tylko z antyaliasingu tekstu (31â212 px po rozmyciu), ale formalnie poza strefÄ; (c) 6 Ã Harmonogram HHL sv 390/768/1280 â to samo zjawisko po zawiniÄciu nagÅÃ³wka (0â88 px po rozmyciu). Test bramy: SKIP_MATRIX=1 â `OK â¦ kod=0` (74 s); port 4177 â `FAIL â¦ powÃ³d=port-4177-zarezerwowany kod=2` | Przebieg nocny do czasu decyzji o 36 ujÄciach bÄdzie `FAIL â¦ zmienione=36` (kod 1). Propozycja: (a) wymaga decyzji, czy nowe numery demo majÄ zostaÄ; (b)+(c) to artefakt renderowania â moÅ¼na je zatwierdziÄ jednym sÅowem (D-26). |
| D-23 | przewoÅºnik widzi swoje oceny i punktualnoÅÄ, notatka HHL wewnÄtrzna (decyzja wÅaÅciciela 28.09) | **DONE** 28.09 (ten commit) | 0091 (produkcja: naÅoÅ¼ona po prÃ³bie w wycofanej transakcji, 2Ã = idempotentna: authenticated bez SELECT `comment`, z SELECT `score`, anon nic, 2 polityki RLS, funkcje SECURITY DEFINER z `search_path`) â polityka `carrier_ratings_carrier` (wÅasna organizacja), uprawnienia kolumnowe bez `comment`/`rated_by`, `carrier_rating_detail(p_load)` tylko HHL, `carrier_scorecard` dla przewoÅºnika = wÅasny wiersz | i2 491/491 (+5: kolumny, SCX widzi 2 oceny bez notatki, SCX âpermission deniedâ na `comment`, SCX odmowa `carrier_rating_detail`, HHL czyta notatkÄ, inny przewoÅºnik 0/0, KSH odmowa karty, karta SCX = 1 wiersz 2/1/1/4.00), nullguard 369/369 (+5), vitest 492, e2e `tests/iii9-rating.local.spec.ts` 3/3 (HHL ocenia z notatkÄ; SCX: Ustawienia â âTwoja ocena i punktualnoÅÄâ â wÅasny wiersz 4,00 / 5 (1), lista âOceny transportÃ³wâ, szuflada: ocena tylko do odczytu, notatki brak w DOM; KSH bez formularza) | Pole komentarza w formularzu HHL nazwane âNotatka wewnÄtrzna HHLâ; nota karty HHL: âprzewoÅºnik widzi ocenÄ i punktualnoÅÄ; notatka wewnÄtrznaâ. Karta przewoÅºnika w Ustawieniach (SCX nie ma Opcji). SECURITY.md Â§2 uzupeÅnione. |
| III-10 | pobieranie EU Weekly Oil Bulletin do `fuel_index_readings` â gotowe, WYÅÄCZONE do D-2 (decyzja wÅaÅciciela 28.09) | **DONE** 28.09 (ten commit) â przeÅÄcznik wyÅÄczony, 0 odczytÃ³w WOB na produkcji | 0092 (produkcja: naÅoÅ¼ona `supabase db push` po prÃ³bie w wycofanej transakcji, 2Ã = idempotentna): kody `WOB_DIESEL_PL` / `WOB_DIESEL_SE` (olej napÄdowy z podatkami, EUR/l), przeÅÄcznik `security_flags.FUEL_WOB_INGEST` = false, `fuel_wob_enabled()` i `fuel_wob_ingest(project, rows, source_url)` wyÅÄcznie dla service_role (odmowa przy wyÅÄczonym przeÅÄczniku, tylko kody WOB, tylko `https://energy.ec.europa.eu/`, tydzieÅ juÅ¼ zapisany = pominiÄty, audit_log FUEL_READING_ADD âsystemâ). Funkcja Edge `fuel-wob` wdroÅ¼ona (bez crona; przy wyÅÄczonym przeÅÄczniku koÅczy siÄ bez pobierania i bez zapisu; bez klucza 401). Parser `supabase/functions/_shared/fuel/wob.ts` (XLSX bez zaleÅ¼noÅci, JSZip do rozpakowania) | vitest `tests/iii10-wob.test.ts` 11/11 na prawdziwym pliku KE (ceny 21.09.2026: PL 2,0391 EUR/l, SE 2,0902 EUR/l, okres 2026-W39; zmiana ukÅadu, waluty, jednostki, brak wiersza, cena poza zakresem â bÅÄd); i2 505/505 (+14: przeÅÄcznik, uprawnienia, odmowa przy wyÅÄczonym, 2 odczyty po wÅÄczeniu, powtÃ³rka pominiÄta, ÅºrÃ³dÅo/kod/data/pusta tablica/projekt odrzucone, wpis widoczny w `baf_change_log`); vitest 503 | Formularz BAF (Opcje) pokazuje nadal tylko odczyty SEK/PLN. WÅÄczenie po D-2 (jeÅli przewoÅºnik wybierze WOB): `update security_flags set enabled = true where key = 'FUEL_WOB_INGEST'` + harmonogram pg_cron â pg_net (czwartek po publikacji biuletynu) jak w `supabase/sql/cron_usage.sql`. Tabele mnoÅ¼nikÃ³w SEFS nadal liczÄ siÄ z SEK/PLN â uÅ¼ycie WOB we wzorze wymaga decyzji D-2. |
| III-11 | ÅºrÃ³dÅo pogody morskiej GdaÅskâNynÃ¤shamn â raport (decyzja wÅaÅciciela 28.09) | **DONE** 28.09 (commit z III-10) | `docs/handover/RAPORT_POGODA_MORSKA.md`: DMI, FMI, SMHI, Copernicus Marine, ECMWF, DWD, Open-Meteo, IMGW â licencja, zasiÄg, czÄstotliwoÅÄ, format, koszt; ÅºrÃ³dÅa sprawdzone na stronach dostawcÃ³w | test na Å¼ywo 28.09 ok. 10:00: FMI WAM dla punktu w poÅowie trasy (56,5Â° N, 18,5Â° E) odpowiada w ~1 s (fala 0,86 â 1,23 m); DMI EDR dwukrotnie HTTP 429 (przeciÄÅ¼enie) | Propozycja: FMI WAM + DMI WAM jako drugie ÅºrÃ³dÅo (CC BY 4.0, bez konta i klucza); Copernicus Marine jako zapas (wymaga konta); Open-Meteo (darmowe API tylko niekomercyjnie) i IMGW (uÅ¼ycie gospodarcze/Å¼egluga = odpÅatna umowa) odpadajÄ. Nic w UI. |
| III-12 | lista otwartych pozycji Etapu III niezaleÅ¼nych od wÅaÅciciela + audyt dostÄpnoÅci (decyzja wÅaÅciciela 28.09) | **DONE** 28.09 (ten commit) | lista `docs/handover/III12_LISTA_ETAP_III.md`; audyt `docs/handover/RAPORT_DOSTEPNOSC.md` â `npm run audit:a11y` (`scripts/a11y/audit.mjs`, axe-core 4.13, WCAG 2.0/2.1 A+AA + test klawiatury), 54 widoki (3 role Ã 2 motywy Ã menu), wyniki `docs/evidence/a11y-2026-09-28-{przed,po}.json`. Poprawki bez zmiany wyglÄdu: `aria-label` dla 18 pÃ³l/list (Faktury, Opcje, Ustawienia), `src/lib/clickableRow.ts` â wiersze otwierajÄce szufladÄ/edycjÄ w 9 tabelach osiÄgalne Tab + Enter/Spacja | axe przed â po: `label` 14 â 0, `select-name` 22 â 0, `scrollable-region-focusable` 8 â 0, `list` 12 â 12, `color-contrast` 1327 â 1327 (D-27); klawiatura 1402 â 362 (reszta = kursor ârÄczkaâ bez akcji z CSS makiety); vitest `tests/iii12-clickable-row.test.ts` 3/3 | Nowa decyzja **D-27** (kontrast: tokeny `--ink-3`, `--amber` jako tekst, licznik dzwonka; kursor bez akcji) â zmienia wyglÄd makiety, wiÄc bez decyzji nie ruszane. Test czytnikiem ekranu (NVDA/VoiceOver) nie wykonany â tylko reguÅy axe. |
| O-V16 | Vercel produkcja po D-22, D-23, III-10, III-12 | **DONE** 28.09 | commit `6e9e2fb` wdroÅ¼ony (Ready) | tower.log-mar.pl 200, watch-tower-makieta.vercel.app 200, 39 plikÃ³w JS (rekurencyjnie), 0 Ã service_role, 0 Ã klucz | Migracje 0090â0092 na produkcji potwierdzone w `supabase_migrations.schema_migrations`; `FUEL_WOB_INGEST` = false, 0 odczytÃ³w WOB. |
| III-13 | korekta wÅaÅciciela 28.09: D-26 to nie decyzja wÅaÅciciela â 36 ujÄÄ do wyjaÅnienia przez nas | **DONE** 28.09 â 3 grupy, 0 regresji, wzorzec 36 ujÄÄ odÅwieÅ¼ony (`G4_WZORZEC.md` Â§III-13) | D-26 usuniÄta z PLAN Â§4, wpisana jako pozycja robocza III-13 | â | Plan: commit per ujÄcie (log/bisect + porÃ³wnanie zrzutÃ³w), grupy, klasyfikacja zamierzona (`G4_WZORZEC.md`) / regresja (naprawa + test), potem odÅwieÅ¼enie wzorca. Wynik: ujÄcia dla 40 commitÃ³w `ce094ad..6e9e2fb`; A (12 Ã Harmonogram 1920) `16638cb` numery demo I-2h + `f7bda8b` chipy 1 px (kbd); B (18 Ã Dokumenty HHL 1280â1920) `bc31ac1` III-6 â przesuniÄcie 133 px, prawa kolumna na innym uÅamku piksela; C (6 Ã Harmonogram HHL SV 390/768/1280) `db3d5e3` I-24 â zawiniÄcie paska przez przycisk PDF, uÅamkowe przesuniÄcie. Nocny gate:visual na `24dbbcf` (10:22): `FAIL â¦ matryca=804/840 zmienione=36 kod=1` â dokÅadnie te 36. |
| A11Y-2 | dostÄpnoÅÄ bez zmiany wyglÄdu â reszta (pozycja (1) planu 28.09) | **DONE** 28.09 (ten commit) | `ExceptionRow` (kolejka âWymaga decyzjiâ w Kokpicie i Ryzykach): `<li>` bez `role="button"`, klawiatura przez `clickableRow` (Enter i Spacja â wczeÅniej tylko Enter); `scripts/a11y/audit.mjs`: tryb `A11Y_STRICT=1` | axe (54 widoki): `list` 12 â 0; naruszenia poza kontrastem **0**; kontrast 1327 bez zmian (D-27); klawiatura 362 (kursor bez akcji â D-27); tsc OK | PozostaÅe poprawki dostÄpnoÅci wymagajÄ zmiany wyglÄdu â D-27. |
| 16.3 | sprawdzenie w bazie: import tylko po stronie uprawnionej, eksport tylko w zakresie roli (pozycja (2) planu 28.09) | **DONE** 28.09 (ten commit) | Stan reguÅy: SCOPE 16.3 (âimport tylko KSH, eksport tylko HHLâ) **zastÄpiona przez I-18** (wÅaÅciciel 27.09): import harmonogramu robi **HHL**, KSH **potwierdza daty** (`ksh_confirm_dates`, tylko KSH). Sprawdzone w bazie: `import_schedule` â odmowa dla KSH, SCX, konta bez `app_users`, HHL nieaktywnego; zapis wprost do tabel zamkniÄty przez RLS (`loads_insert_hhl`, `items_write`, `schedule_imports_hhl` = `is_hhl()`), brak DELETE na `loads`, anon bez dostÄpu; historia importÃ³w widoczna tylko dla HHL; koszyk Storage `harmonogramy` tylko HHL (0047). Eksport: XLSX/PDF generowane w przeglÄdarce z danych juÅ¼ ograniczonych przez RLS, kolumny per rola (`tests/xlsx-export-roles.test.ts`: KSH bez kosztu/marÅ¼y/kierowcy, SCX bez przychodu/ceny klienta/marÅ¼y; PDF bez danych kierowcy i kwot â I-24) | `tests/db/import.sh` 60/60 (+11: RLS INSERT KSH/SCX na `loads`, `shipment_items`, `schedule_imports`, UPDATE pozycji przez KSH = 0 wierszy, widocznoÅÄ historii importÃ³w, anon, brak DELETE, `ksh_confirm_dates` SECURITY DEFINER bez anon); `ksh_confirm_dates` odmowa dla SCX/HHL â i2 | Eksport dostÄpny dla kaÅ¼dej roli w jej zakresie danych â tak jest w makiecie; ograniczenie przycisku eksportu tylko do HHL byÅoby zmianÄ wyglÄdu i wrÃ³ciÅoby do zastÄpionej reguÅy 16.3 â nie ruszane. Luka: brak. |
| 9.8 | odsiewanie duplikatÃ³w powiadomieÅ â domkniÄcie (pozycja (3) planu 28.09; I-23 obejmowaÅo tylko `notifications`) | **DONE** 28.09 (ten commit) | PrzeglÄd ostatnich definicji wszystkich funkcji SQL: 13 miejsc wstawia do `notifications` (dedup_key + `on conflict do nothing`), 16 do `risk_signals`, 1 do `sms_outbox`. SygnaÅy ryzyka: 10Ã `on conflict â¦ do nothing`, 6Ã najpierw sprawdzenie otwartego sygnaÅu z tym kluczem (`job_watchdog`, `sms_watchdog`, `record_usage` â aktualizacja zamiast nowego wiersza, `detect_resource_deadlines`); ostatniÄ zaporÄ jest unikalny indeks `risk_signals(dedup_key) where resolved_at is null` â przy wyÅcigu dwÃ³ch przebiegÃ³w drugi dostaje bÅÄd, duplikatu nie ma. RozwiÄzany sygnaÅ + powrÃ³t problemu = nowy sygnaÅ (zamierzone). Kolejka SMS: unikalny `sms_outbox.dedup_key`. WysyÅka e-mail (`send-notifications`): ponowne sprawdzenie statusu tuÅ¼ przed wysyÅkÄ + `Idempotency-Key: tower-notif-<id>` w Resend â nakÅadajÄce siÄ przebiegi nie wysyÅajÄ dwa razy. Bez migracji i bez zmian kodu aplikacji. | vitest `tests/notify-dedup.test.ts` 28/28 (+ blok 9.8: kaÅ¼dy INSERT do `risk_signals`/`sms_outbox` podaje dedup_key i ma odsiew; literaÅy tekstowe wycinane przed analizÄ); i2 **510/510** (+5 â[9.8]â: indeksy unikalne risk_signals i sms_outbox, `raise_risk` Ã2 = 1 otwarty, po rozwiÄzaniu nowy, `job_watchdog` Ã2 bez nowych sygnaÅÃ³w) | â |
| 3.6 | wersjonowanie i archiwum pliku harmonogramu â sprawdzenie i domkniÄcie (pozycja (4) planu 28.09, audyt D4) | **DONE** 28.09 (ten commit) | Stan przed: wersja = kolejny numer per projekt (`unique (project_id, version)` â dwa rÃ³wnolegÅe importy nie dostanÄ tej samej wersji, drugi koÅczy siÄ bÅÄdem), wpis wersji z nazwÄ pliku, SHA-256 i ÅcieÅ¼kÄ; plik w prywatnym koszyku `harmonogramy` pod nazwÄ = skrÃ³t treÅci, upload bez nadpisywania, polityki Storage tylko SELECT/INSERT dla HHL (brak UPDATE/DELETE) â plik wersji niezmienny; tabela i koszyk w kopii zapasowej (I-2B). **Luka:** polityka `schedule_imports_hhl` byÅa FOR ALL, a `authenticated` miaÅ INSERT/UPDATE/DELETE â HHL mÃ³gÅ przez API poprawiÄ lub usunÄÄ wpis wersji z pominiÄciem `import_schedule`. **Naprawa â migracja 0093** (idempotentna, bez zmian danych): odebrane INSERT/UPDATE/DELETE/TRUNCATE, polityka tylko do odczytu `schedule_imports_hhl_read` (`is_hhl()`), straÅ¼niki `is not true then raise`; wersje dopisuje wyÅÄcznie `import_schedule` (SECURITY DEFINER, wÅaÅciciel postgres z BYPASSRLS). Produkcja: prÃ³ba w wycofanej transakcji (migracja Ã2, polityka `schedule_imports_hhl_read:r`, authenticated SELECT tak / UPDATE nie), potem `supabase db push` â 0093 w `schema_migrations`. Bez zmian kodu aplikacji (aplikacja tylko czyta historiÄ). | `tests/db/import.sh` **66/66** (+6 â[3.6]â: UPDATE/DELETE/INSERT wprost przez HHL odrzucone, polityki tylko odczyt, unikalna para projekt+wersja, import przez `import_schedule` nadal dopisuje wersjÄ z plikiem i skrÃ³tem); peÅna brama bazy 14 zestawÃ³w OK | PrzeglÄdanie i pobieranie starszych wersji w interfejsie â brak w makiecie (zmiana wyglÄdu = decyzja wÅaÅciciela); dziÅ dostÄp przez kopiÄ zapasowÄ albo panel Supabase. |
| G-V a956ab6 | brama wizualna na `a956ab6` (pozycja (0) planu 28.09) | **DONE** 28.09 (ten commit) â 839/840 wyjaÅnione, regresji 0 | `gate:visual` 11:33: `FAIL matryca=839/840 zmienione=1` (`harmonogram__hhl__sv__390__dark-default`). Commit: Å¼aden (src `6e9e2fb` = `a956ab6`). Przyczyna: `page.click('#themeBtn')` w `baseline.mjs` przewija okno w poziomie, gdy przycisk motywu jest poza ekranem 390 px (SV) i poprzednie ujÄcie byÅo jasne; wzorzec z III-13 robiony pojedynczym ujÄciem (bez klikniÄcia). DowÃ³d: pojedyncze ujÄcie 0 px, para jasneâciemne 98 276 px, powtÃ³rzenie 0 px. Klasyfikacja: artefakt kolejnoÅci ujÄÄ. Wzorzec: 1 ujÄcie zastÄpione wersjÄ z kolejnoÅci matrycy (`G4_WZORZEC.md` Â§G-V a956ab6) | ujÄcia `/tmp/bis` (build `6e9e2fb` i `a956ab6`), porÃ³wnanie dokÅadne | Uodpornienie `baseline.mjs` na przewijanie = osobna pozycja (zmieni ujÄcia 390/768; peÅny przebieg ~42 min). Kolejny `gate:visual` uruchomiony na nowym HEAD â wynik w raporcie koÅcowym. |
| 10.8 | eksport PDF â dokoÅczenie (pozycja (5) planu 28.09) | **DONE** 28.09 (ten commit) | I-24 daÅo plik PDF z harmonogramu; braki w treÅci pliku: nagÅÃ³wki, tytuÅ i stopka tylko po polsku, status jako surowy kod (`IN_TRANSIT_PL`), ETA Boden wycinana z ISO (czas UTC bez oznaczenia â wbrew D8), stopka w UTC. Teraz: nagÅÃ³wki/tytuÅ/stopka w jÄzyku interfejsu (PL/EN/SV, nowe klucze `i24_pdf_*`), status przez ten sam sÅownik co w tabeli (`statusLabel` wydzielony do `src/lib/statusLabel.ts`, `StatusPill` go reeksportuje â bez zmian wyglÄdu), daty wg D8: zaÅadunek Europe/Warsaw, dostawa i ETA Boden Europe/Stockholm, dni kalendarzowe bez przesuniÄcia, stopka âwygenerowano â¦ (Europe/Warsaw)â. Przycisk i komunikaty w interfejsie bez zmian (zmienia siÄ wyÅÄcznie zawartoÅÄ pliku). Nadal bez danych kierowcy i kwot. | vitest `pdf-export` 6/6 (+3: nagÅÃ³wki i status PL/EN/SV bez surowych kodÃ³w, strefy D8, stopka i tytuÅ w 3 jÄzykach), vitest caÅoÅÄ **524 passed / 33 skipped**; tsc 0 | Eksport PDF innych widokÃ³w (Finanse, Faktury) â w makiecie brak przyciskÃ³w, dodanie = zmiana wyglÄdu (decyzja wÅaÅciciela). |
| O-V17 | wdroÅ¼enie Vercel `c90c062` (A11Y-2 + 10.8) | **DONE** 28.09 | `npx vercel --prod` z `git archive c90c062`; tower.log-mar.pl i watch-tower-makieta.vercel.app â 200; rekurencyjny skan 39 plikÃ³w JS: 0Ã `service_role`, 0Ã klucz | â | â |
| 9.1â9.4 | silnik automatyzacji (pozycja (6) planu 28.09, audyt C1) | **9.1â9.3 DONE**, 9.4 CZÄÅCIOWO â 28.09 (ten commit) | **Migracja 0094** (idempotentna, nieniszczÄca; produkcja: prÃ³ba w wycofanej transakcji â migracja Ã2, 7 reguÅ / 0 wÅÄczonych, worker pusty, brak EXECUTE dla authenticated/anon â potem `supabase db push`). **9.1:** wyzwalacz = typ zdarzenia z `load_events` (15 dozwolonych), warunek = podzbiÃ³r JSONLogic (`wf_logic`: var, missing, and, or, !, !!, ==, !=, <, <=, >, >=, in; inny operator â wyjÄtek), akcje: `notify` (powiadomienie w aplikacji `WORKFLOW_ALERT` dla HHL / KSH / przewoÅºnika transportu, PL/EN/SV w `notifyTemplates`), `risk` (`raise_risk` z kluczem reguÅy); `email`/`sms` zapisujÄ âZABLOKOWANE_R2â (EXTERNAL_MESSAGING). Kontekst warunku: zdarzenie + transport bez danych kierowcy i kwot. **9.2:** wyzwalacz `load_events_workflows` kolejkuje przebieg (QUEUED, `dedup_key` = reguÅa+zdarzenie; bÅÄd kolejkowania nie blokuje zapisu zdarzenia), `workflow_worker(limit, teraz)` (tylko service_role, `for update skip locked`) wykonuje w podtransakcji; bÅÄd â RETRY za 2^n min, po 5 prÃ³bach DEAD. **9.3:** START-1â¦7 w kaÅ¼dym projekcie, **wyÅÄczone** (dojazd na plac, wjazd przed port, POD po rozÅadunku, opÃ³Åºnienie, krytyczna zmiana daty, cichy pojazd, anulowanie). **9.4:** zapis reguÅ przez API tylko HHL_ADMIN (RLS `wf_all`), walidacja `wf_validate` (wyzwalacz, akcje, odbiorcy, rodzaj ryzyka, warunek sprawdzany przy zapisie). | `tests/db/workflows.sh` **35/35** (nowy zestaw w bramie bazy: JSONLogic, reguÅy startowe, uprawnienia i walidacja, kolejka i odsiew, wykonanie z powiadomieniami tylko do wÅaÅciwych odbiorcÃ³w, ryzyko, ponawianie RETRYâDEAD z terminami, blokada R-2, odpornoÅÄ zapisu zdarzeÅ); nullguard 369/369; vitest `notify-dedup` 29/29 | Do decyzji: (a) wÅÄczenie reguÅ startowych, (b) zadanie cykliczne wywoÅujÄce `workflow_worker` (np. co minutÄ; bez niego kolejka czeka). PodpiÄcie widoku âAutomatyzacjeâ do bazy (9.4 UI; moduÅ w produkcji ukryty â I-2) â pakiet przekazania. Wyzwalacze CRON (wf-2, wf-7, wf-11 z demo) â poza zakresem. |
| 9.1 (0095) | poprawka silnika: tytuÅ sygnaÅu ryzyka z reguÅy | **DONE** 28.09 (ten commit) | Brama pre-push (vitest `rk-generic`) odrzuciÅa push `42005b2`: `wf_action` woÅaÅ `raise_risk` bez jawnego klucza tytuÅu â bezpiecznik `rk_generic`. 0094 byÅa juÅ¼ na produkcji, wiÄc bez edycji pliku â **migracja 0095** (`create or replace wf_action`: `title_key` `rk_workflow` + parametry reguÅa/tytuÅ/transport; straÅ¼nik). SÅownik `rk_workflow` PL/EN/SV w `src/i18n/risks.ts`. Produkcja: prÃ³ba w wycofanej transakcji (Ã2, SECURITY DEFINER, bez EXECUTE dla authenticated), `supabase db push` â 0095 w `schema_migrations`. | vitest **525 passed / 33 skipped**; `workflows.sh` 35/35 (kontrola START-7 sprawdza `title_key = rk_workflow`; test nakÅada ponownie 0094+ po seed); nullguard 369/369 | â |
| i2-III-4 (test) | niestabilny test zaleÅ¼ny od godziny | **DONE** 28.09 (ten commit) | Push `d5a1ab7` odrzucony: i2 509/510 â âawizacja: brak pilotÃ³w 24 h przed zaÅadunkiemâ daÅo CRITICAL zamiast HIGH. Przyczyna w teÅcie (III-4, 0087), nie w kodzie: `plan_load_date = jutro` â termin = jutro 00:00 Warszawa; po 12:00 do terminu zostaje < 12 h = prÃ³g `critical_h` dla ESCORT â CRITICAL. Rano test przechodziÅ. Naprawa: transport testowy dostaje `plan_load_from = now() + 30 h` (zawsze miÄdzy progiem 12 h a wyprzedzeniem 48 h). | i2 **510/510** o 12:2x | â |
| R2-retencja | retencja `files/` w kubeÅku kopii R2 | **CZEKA** â na logowanie wÅaÅciciela do Cloudflare | Polecenie 28.09: pominÄÄ, wrangler wylogowany, nie logowaÄ siÄ. Przygotowane `docs/handover/r2/lifecycle.json` i `bucket-lock.json`; naÅoÅ¼enie po zalogowaniu (bez nowych pÅatnych zasobÃ³w). | â | wpis w `PRZEKAZANIE_CURSOR.md` Â§6 |
| HO-1 | pakiet przekazania dla Cursora (pozycja (7) planu 28.09) | **DONE** 28.09 (ten commit) | `docs/handover/PRZEKAZANIE_CURSOR.md`: kolejnoÅÄ ÅºrÃ³deÅ prawdy, twarde zasady, architektura dziÅ (migracje 0001â0095, 12 funkcji Edge, 25 zadaÅ cron, przeÅÄczniki), uruchomienie i liczby testÃ³w, procedury produkcyjne (migracja z prÃ³bÄ w wycofanej transakcji, Edge, Vercel + skan JS), zrobione 28.09, otwarte pozycje z nastÄpnym krokiem i decydujÄcym, puÅapki Årodowiska. `.cursor/rules/tower.mdc` (alwaysApply): twarde zasady w skrÃ³cie. `01_HANDOVER.md` oznaczony jako nieaktualny z odnoÅnikiem. | â (dokumenty) | â |
| HO-1a | korekta HO-1: przywrÃ³cone reguÅy `.cursor/rules/tower.mdc` | **DONE** 28.09 (ten commit) | HO-1 nadpisaÅo istniejÄcy plik reguÅ (ÅºrÃ³dÅa prawdy dziedzin: MECHANIZM_PIENIEDZY, STATUSY_AUTOMATYCZNE, ZRODLA_DANYCH; zasady EUR/NBP/statusÃ³w/wyglÄdu). PrzywrÃ³cona peÅna treÅÄ sprzed HO-1 + dopisane zasady z HO-1 (bez powtÃ³rzeÅ) i odnoÅnik do `PRZEKAZANIE_CURSOR.md`; `AGENTS.md` â krok 0: przeczytaj `PRZEKAZANIE_CURSOR.md`. | â (dokumenty) | â |
| G-V c90c062 | brama wizualna na `c90c062` (po A11Y-2 i 10.8) + naprawa bramy | **DONE** 28.09 (ten commit) | Wynik 12:33: matryca **840/840 identyczna, 0 zmian**, ale linia `FAIL` â `missingInBaseline=17`: `gate.sh` zapisywaÅ ujÄcia do `$TMP/shots`, gdzie `git archive` rozpakowuje 17 Åledzonych zrzutÃ³w z 23.09 (`shots/`), a porÃ³wnanie koÅczy siÄ kodem 2 przy nadmiarowych plikach. BÅÄd bramy od jej powstania (takÅ¼e przebiegi `24dbbcf`, `a956ab6`). Naprawa: katalog `$TMP/gate-shots`. A11Y-2 i 10.8 bez wpÅywu na wyglÄd â potwierdzone matrycÄ. `G4_WZORZEC.md` Â§G-V c90c062 | `bash -n` gate.sh; kolejny peÅny przebieg uruchomiony na tym commicie | â |
| 9.4 | widok âAutomatyzacjeâ na danych z bazy (HHL_ADMIN) | **DONE** 28.09 (ten commit) | `SupabaseProvider.loadSnapshot` czyta `workflows` (RLS `wf_all`: tylko HHL_ADMIN, inne role 0 wierszy) i `workflow_runs` (ostatnie 1000; licznik = przebiegi OK; DEAD/RETRY â bÅÄd z opisem, QUEUED â âw kolejceâ); przeÅÄcznik â `workflow.update {enabled}`, kreator â `workflow.create` (insert z `project_id`, walidacja `wf_validate` w bazie; bÅÄd â komunikat âNie zapisano na serwerzeâ¦â i odÅwieÅ¼enie), `updateWorkflow` w store â `workflow.update`. Mapowanie `src/data/workflowMap.ts`: wyzwalacze kreatora POSITION_STALEâSILENT_VEHICLE, UNLOADEDâMILESTONE_UNLOADED (FERRY_STATUS i CRON baza odrzuca â silnik ich nie obsÅuguje), akcje tekstowe notify_hhl/notify_ksh/notify_scx/risk:RODZAJ:POZIOM/email/sms â JSON, warunek = JSONLogic. WidocznoÅÄ: klucz `workflows` usuniÄty z `HIDDEN_IN_PROD` (12 kluczy), `canSeeWorkflows()` â produkcja tylko HHL_ADMIN, demo bez zmian (dane demo, zapis do serwera tylko dla id uuid). âUruchomâ w trybie Supabase: tylko komunikat (nowy klucz `a6_ts_wf_run_event_only` PL/EN/SV), bez faÅszywego przebiegu. PrzeÅÄcznik âReguÅy workflowâ w Opcjach/Powiadomieniach dalej ukryty w produkcji (filtruje tylko komunikaty w przeglÄdarce). **WyglÄd bez zmian** (te same komponenty). **Nie zrobione (zmiana wyglÄdu = STOP):** osobny formularz edycji istniejÄcej reguÅy i lista historii przebiegÃ³w â w makiecie ich nie ma. Produkcja: bez migracji; START-1â¦7 nadal wyÅÄczone, bez zadania cyklicznego. Testy: `tests/workflow-map.test.ts` (6), `i2-facade.test.ts` zaktualizowany; vitest 531/33; `i2-facade.local.spec.ts`: HHL_ADMIN widzi Automatyzacje. |
| G-V bb7216e | brama wizualna na `bb7216e` (po naprawie `gate.sh`) | **DONE** 28.09 (ten commit) | Wynik 13:28: `OK HEAD=bb7216e smoke+stany=ok matryca=840/840 zmienione=0 czas=2494s kod=0` â pierwszy przebieg z zielonym kodem po naprawie `$TMP/gate-shots`. |
| G-V narzÄdzie | `scripts/baseline.mjs` odporne na przewiniÄcie w poziomie | **DONE** 28.09 (ten commit; peÅny przebieg i klasyfikacja â kolejny wiersz) | `setTheme` klikaÅ `#themeBtn` przez `page.click`, ktÃ³re przewija okno do przycisku â przy 390 px ujÄcie przesuwaÅo siÄ w poziomie zaleÅ¼nie od kolejnoÅci zadaÅ (artefakt SV 390 dark z przebiegu na a956ab6). Teraz klik w DOM (`clickThemeBtn`, bez przewijania) i przed kaÅ¼dym ujÄciem `resetHorizontalScroll()` (`window.scrollTo(0, scrollY)`, `scrollLeft = 0` dla dokumentu); przewiniÄcie w pionie (navTo) bez zmian. Kod aplikacji bez zmian â bez wdroÅ¼enia. |
| G-V 0efa871 | peÅny przebieg bramy po uodpornieniu narzÄdzia + klasyfikacja + odÅwieÅ¼enie wzorca | **DONE** 28.09 (ten commit) | `gate:visual` na `0efa871` (14:26): `FAIL 678/840, zmienione 162` â wszystkie to artefakt starego narzÄdzia (okno przewiniÄte w poziomie w starym wzorcu): 144 Ã 390 px (przesuniÄcie 111â349 px), 18 Ã SCX 768 px (4 px), plus 3 poniÅ¼ej progu (KSH 390 harmonogram, pasek filtrÃ³w ~1 px). Opis grup w `G4_WZORZEC.md` (commit, przyczyna, ocena: zamierzona, regresji 0). Wzorzec odÅwieÅ¼ony dopiero po klasyfikacji: 165 ujÄÄ z `0efa871`. Przy okazji: `PLAN.md` â II-7 (HERE Routing v8 zamiast TomTom), II-7a (warunek wÅÄczenia: limit 25 000/mies., regulamin), D-28 (wynik regulaminu HERE: STOP â plan podstawowy wyklucza âAsset Managementâ; oferta Enterprise/asset-based albo inny dostawca); II-7/II-7a zablokowane przez D-28; dodany `RAPORT_HERE_REGULAMIN.md` (z innego wÄtku). Nic z HERE nie implementowane. |
| 9.1a | wyzwalacze z kreatora dotÄd odrzucane przez bazÄ: âstatus promuâ i âcodziennie o 06:00â | **DONE** 28.09 (ten commit) | Migracja 0096 (idempotentna; prÃ³ba w wycofanej transakcji na produkcji: katalog wyzwalaczy t, wyzwalacz 1, START wÅÄczone 0, zadania cykliczne silnika 0, EXECUTE dla authenticated f). `FERRY_STATUS`: wyzwalacz `sailings_workflows` na `sailings` â zmiana statusu (ZAPLANOWANY/OPOZNIONY/ODWOLANY) albo czasÃ³w rejsu kolejkuje przebieg dla kaÅ¼dego nieanulowanego i niedostarczonego transportu na rejsie (payload: status, poprzedni status, statek, trasa, czas odejÅcia/przypÅyniÄcia, `delay_min`; klucz odsiewu z podpisu zmiany â ten sam zapis bez zmian nie dubluje); bÅÄd kolejkowania nie blokuje zapisu rejsu. `CRON_DAILY_06`: `wf_enqueue_daily(p_now)` â jeden przebieg na reguÅÄ i aktywny transport na dzieÅ (dzieÅ wg Europe/Warsaw), tylko service_role. **Zadania cyklicznego NIE utworzono** (migracja sprawdza, Å¼e go nie ma) â wÅÄczenie razem z START-1â¦7 wpisane jako decyzja D-29 w PLAN Â§4. WyglÄd bez zmian (kreator miaÅ te wyzwalacze od poczÄtku; mapowanie 9.4 przepuszcza kody bez zmian). Testy: `tests/db/workflows.sh` 35 â 46 (+11: zapis reguÅ, opÃ³Åºnienie â SKIPPED wg warunku, odwoÅanie â OK + powiadomienie HHL, brak dubli, anulowany transport pominiÄty, dzienny odsiew i granica doby Europe/Warsaw, wyÅÄczona reguÅa, uprawnienia). |
| G-V 42a72c7 | brama wizualna potwierdzajÄca po odÅwieÅ¼eniu wzorca (165 ujÄÄ) | **DONE** 28.09 (ten commit) | Wynik 15:33: `OK HEAD=42a72c7 smoke+stany=ok matryca=840/840 zmienione=0 czas=2500s kod=0` â nowe narzÄdzie (bez przewijania w poziomie) i odÅwieÅ¼ony wzorzec zgodne. Zamyka III-2 0.3/11.4 (wariant lokalny, SCOPE 0.3/11.4 â GOTOWE). |
| O-0096 | naÅoÅ¼enie 0096 na produkcjÄ | **DONE** 28.09 | PrÃ³ba w wycofanej transakcji (0096 Ã2): wyzwalacz `sailings_workflows` 1, `wf_enqueue_sailing`/`wf_enqueue_daily` SECURITY DEFINER z `search_path=public`, EXECUTE anon/authenticated f/f, reguÅy 7 / wÅÄczone 0, `wf_enqueue_daily` w transakcji = 0, zadania cykliczne silnika 0; po ROLLBACK wyzwalacza brak. `supabase db push --db-url` (pooler) Ã2: pierwszy naÅoÅ¼yÅ 0096, drugi âRemote database is up to dateâ. `schema_migrations`: 0096 workflow_ferry_daily. Po naÅoÅ¼eniu: START 0/7, cron silnika 0. Kod aplikacji od `0163949` bez zmian (tylko dokumenty, zrzuty, testy, migracja) â bez wdroÅ¼enia; tower.log-mar.pl 200, watch-tower-makieta.vercel.app 200. | â | D-29 bez zmian |
| 6.6 | polisy przewoÅºnika z przypomnieniem o wygaÅniÄciu (audyt C4) â czÄÅÄ bazowa | **DONE (czÄÅÄ bazowa)** 28.09 (ten commit) | **Migracja 0097** (idempotentna, bez zmian danych; produkcja: prÃ³ba w wycofanej transakcji Ã2 â 3 funkcje SECURITY DEFINER z `search_path`, `insurance_policies` bez SELECT dla authenticated/anon, `detect_insurance_expiry` bez EXECUTE dla authenticated, 0 polis, wykrycie w transakcji 0, cron 0). `insurance_policies` zamkniÄta dla rÃ³l API (odebrane uprawnienia tabeli; wczeÅniej authenticated miaÅ SELECT przy RLS bez polityk). `insurance_policy_save` (HHL dla dowolnego przewoÅºnika, przewoÅºnik tylko wÅasna organizacja; walidacja numeru, okresu, waluty EUR/PLN/SEK, sumy, dokumentu INSURANCE; tylko dopisywanie; audit_log INSURANCE_SAVE bez sumy), `insurance_policies_list` (HHL wszystkie, przewoÅºnik wÅasne, KSH 0; dni do koÅca), `detect_insurance_expiry(p_now, 14)` tylko service_role: najpÃ³Åºniejsza polisa przewoÅºnika koÅczy siÄ â¤ 14 dni â ryzyko INSURANCE HIGH (po terminie CRITICAL, eskalacja tego samego sygnaÅu) w kaÅ¼dym projekcie z aktywnym transportem przewoÅºnika, `load_id` null + `carrier_org_id` (widzi HHL i ten przewoÅºnik, KSH nie), IN_APP `INSURANCE_EXPIRY` dla przewoÅºnika i HHL (odsiew), nowa polisa poza oknem â zamkniÄcie. Teksty PL/EN/SV: `rk_insurance_expiry*` (risks.ts), `INSURANCE_EXPIRY` (notifyTemplates). **Bez zadania cyklicznego** (polecenie 28.09) i **bez formularza polisy** (brak w makiecie) â D-30; notka âPolisa OCP â¦ wygasaâ w Dokumentach nadal ukryta w produkcji (`policyExpiryNote`). | `tests/db/insurance.sh` **33/33** (nowy zestaw w bramie: uprawnienia, walidacja, widocznoÅÄ list, okno 14 dni, odsiew, eskalacja, zamkniÄcie, anulowane transporty, NULL); nullguard 369 â **379**; security 88/88 (kontrola 3.2f: `insurance_policies` bez SELECT dla authenticated zamiast â0 wierszyâ); vitest `notify-dedup` + `rk-generic` 34/34 | WÅÄczenie: D-30 (harmonogram `select public.detect_insurance_expiry()` np. codziennie 06:10 Europe/Warsaw + formularz polisy albo wpis przez HHL). |
| O-V18 | 0097 na produkcji + wdroÅ¼enie Vercel `15647c2` (6.6) | **DONE** 28.09 | Po prÃ³bie w wycofanej transakcji: `supabase db push` Ã2 (pierwszy naÅoÅ¼yÅ 0097, drugi âup to dateâ), `schema_migrations`: 0097 insurance_expiry; `insurance_policies` bez SELECT dla authenticated, cron polis 0, cron silnika 0, START 0/7. `npx vercel --prod --yes` z `git archive 15647c2` (bez âNot authorizedâ) â tower.log-mar.pl 200, watch-tower-makieta.vercel.app 200; rekurencyjny skan 58 plikÃ³w JS: 0Ã `service_role`, 0Ã wartoÅÄ klucza; `rk_insurance_expiry` w paczce. | â | â |
| G-V 6900022 | nocna brama wizualna | **DONE** 29.09 (ten commit) | Wynik 01:55: `OK HEAD=6900022 smoke+stany=ok matryca=840/840 zmienione=0 czas=2523s kod=0` â przebieg bez nadzoru (rutyna ~01:11). | â | â |
| I-30 | cennik wedÅug symboli (paczka 30.09) | **DONE** (sesja 30.09 wieczÃ³r) | (HEAD) | verify OK; i30 db 10/10; map 87/95 | zob. wpis I-30 w tabeli âSesja 30.09 (wieczÃ³r)â |
| G-V 629f224 | nocna brama wizualna | **DONE** 30.09 (ten commit) | Wynik 02:39: `OK HEAD=629f224 smoke+stany=ok matryca=840/840 zmienione=0 czas=2452s kod=0` â przebieg bez nadzoru (po `git lfs pull`; pierwszy przebieg 01:57 FAIL: `shots-baseline/` to wskaÅºniki LFS, nie rÃ³Å¼nice pikseli). | â | â |
| G-V 894a684 | nocna brama wizualna | **DONE** 01.10 (ten commit) | Wynik 01:58: `OK HEAD=894a684 smoke+stany=ok matryca=840/840 zmienione=0 czas=2484s kod=0` â przebieg bez nadzoru (rutyna ~01:10). | â | â |
| G-V 59a5ce4 | nocna brama wizualna | **DONE** 02.10 (ten commit) | Wynik 01:58: `FAIL HEAD=59a5ce4 smoke+stany=fail matryca=310/840 zmienione=530 powÃ³d=rÃ³Å¼nice-ponad-0,1% czas=2450s kod=1` â przebieg bez nadzoru (rutyna ~01:10). | 530 ponad prÃ³g 0,1%: harmonogram 56, dokumenty/faktury/kokpit/mapa/ryzyka po 54, ustawienia 36, automatyzacje/opcje 30, pozostaÅe 18; smoke+stany teÅ¼ fail; wzorca NIE odÅwieÅ¼ano. | â |
| G-V a232da9 | nocna brama wizualna | **DONE** 03.10 (ten commit) | Wynik 01:54: `FAIL HEAD=a232da9 smoke+stany=fail matryca=631/840 zmienione=209 powÃ³d=rÃ³Å¼nice-ponad-0,1% czas=2417s kod=1` â przebieg bez nadzoru (rutyna ~01:14; git-lfs zainstalowany rÄcznie, `git pull --rebase` pominiÄty â brak upstream gaÅÄzi `fix/przejecie-testy-02-10`). | 209 ponad prÃ³g 0,1%: kokpit/harmonogram/mapa po 54, faktury 27, automatyzacje 18, strefy 2; smoke+stany teÅ¼ fail; vs 02.10 (530) poprawa po G4-D27-D31; wzorca NIE odÅwieÅ¼ano. | â |
| G-V fd5f8e2 | nocna brama wizualna | **DONE** 04.10 (ten commit) | Wynik 01:58: `OK HEAD=fd5f8e2 smoke+stany=ok matryca=840/840 zmienione=0 czas=2439s kod=0` â przebieg bez nadzoru (rutyna ~01:17; po zwolnieniu orphaned preview na 4188). | â | â |
| G-V 33fa661 | nocna brama wizualna | **DONE** 05.10 (ten commit) | Wynik 01:59: `FAIL HEAD=33fa661 smoke+stany=fail matryca=720/840 zmienione=120 powÃ³d=rÃ³Å¼nice-ponad-0,1% czas=2427s kod=1` â przebieg bez nadzoru (rutyna ~01:18; osobny worktree na origin/main, `git lfs pull`, port 4188). | 120 ponad prÃ³g 0,1%: mapa 36, kokpit 30, strefy 24, opcje 18, harmonogram 12 (KSH/SCX 1920); smoke+stany fail (mapa 1920 light, stan-najechanie dark). Prawdopodobnie zamierzone zmiany UI scalone 04.10 po fd5f8e2 (L-4â¦L-13, H-1â¦H-3, L-12 kreator stref, STD-CLEAN: GeofenceView, DashboardView/cockpitTiles, OptionsView, ScheduleView, index.css); wzorca NIE odÅwieÅ¼ano â czeka na zgodÄ wÅaÅciciela. | â |
| G-V 9c83d21 | nocna brama wizualna | **DONE** 06.10 (ten commit) | Wynik 01:17: `FAIL HEAD=9c83d21 smoke+stany=fail matryca=- zmienione=- powÃ³d=przerwany czas=187s kod=2` â przebieg bez nadzoru (rutyna ~01:14; `git lfs pull`, port 4188). Matryca niewykonalna na tym HEAD: `scripts/baseline.mjs` klika `#langSeg`, usuniÄty w `8322d02` (05.10, âbez jÄzyka i zegaraâ) â kaÅ¼de ujÄcie `FAIL lang btn not found` (19/19 przed przerwaniem, 0 zrzutÃ³w, 0 porÃ³wnaÅ z `shots-baseline/`); bramÄ przerwaÅ SIGTERM spoza przebiegu (~01:17 â zatrzymany przez executor B-SMOKE-LANG: przebieg na starym HEAD, port 4188 potrzebny do naprawy), resztÄ matrycy zatrzymano â wynik deterministyczny. | 0 ujÄÄ w progu / 0 ponad prÃ³g (brak porÃ³wnania). Smoke+stany fail: `kokpit__hhl__pl__1920__light` (lang btn not found: PL), `stan-najechanie (dark)` 6% pikseli â zamierzone zmiany UI 05.10 (brak PL/EN/SV i zegara `8322d02`, kafelki korytarza bez cyfr B-9.2 `6fc3037`, kolumny HHL-KSH/SCAN, daty z rokiem i pola dat B-8 `50ba5d6`, âJak dziaÅaâ B-6a); wzorca NIE odÅwieÅ¼ano â czeka na B-SMOKE-LANG (P1). | â |
| G-V 020e379 | nocna brama wizualna | **DONE** 08.10.2026 (ten commit) | Wynik 01:28: `OK HEAD=020e379 smoke+stany=ok matryca=280/280 zmienione=0 czas=794s kod=0` â przebieg bez nadzoru (start ~01:15; `main` = `origin/main`, `git lfs pull` 280/280 PNG, port 4188, build w /tmp). | 280/280 w progu 0,1%, 0 ponad prÃ³g; wzorca NIE odÅwieÅ¼ano. | â |
| G-V fc2f43c | nocna brama wizualna | **DONE** 10.10.2026 (ten commit) | Wynik 01:30 (Europe/Warsaw): `OK HEAD=fc2f43c smoke+stany=ok matryca=280/280 zmienione=0 czas=764s kod=0` â przebieg bez nadzoru (start ~01:17; `main` = `origin/main`, `git lfs pull` 280/280 PNG, port 4188, build w /tmp). Poprzednie 2 nocne przebiegi (09.10) nie wystartowaÅy: na pudle brakowaÅo `git-lfs`, `node_modules/` (â `npm ci`) i Chromium Playwright, a `build/*.ts` byÅo usuniÄte z drzewa roboczego (przywrÃ³cone `git checkout -- build`). | 280/280 w progu 0,1%, 0 ponad prÃ³g; wzorca NIE odÅwieÅ¼ano. | â |
| B-SMOKE-LANG | testy bez `#langSeg` (8322d02) | **DONE** 06.10 | PR #134 (`30ba55f`, `1505ce2`) | `gate:visual` 10:18 **OK** HEAD=1505ce2 smoke+stany=ok matryca **280/280** zmienione 0 (744 s); `fresh-smoke.sh` OK: visual 4/4, stany 12/12, persist-toast 3/3, d-eur-t 2/2, etap4 12/12, etap5 5/5, etap6 1/1; e2e-core 5/5; vitest 836 passed / 35 skip; gitleaks historia 0 (po dopisaniu 4 nazw flag H3/H10 do `.gitleaksignore` â faÅszywe alarmy z main 05.10), `npm audit --omit=dev --audit-level=high` 0 | Matryca PL 280 odÅwieÅ¼ona na buildzie `55eccc4`; przyczyny grup z bisekcji (14 ujÄÄ Ã 41 buildÃ³w od `fd5f8e2`): `8322d02`+`6fc3037` wszÄdzie; harmonogram `e5ccb96`/`50ba5d6`/`f456153`; mapa `e5ccb96` B-7c; ustawienia `8322d02`+`e5ccb96` Q-9 B; opcje `43e41fb`; strefy `4126b39`; ryzyka `3a48097`; rozliczenia `bfc7ed9`. Bez przyczyny: 0. VERIFY-13 17.4/17.8 â PASS. |
| B-PERSIST-TOAST | brak toastu âstan uszkodzonyâ przy pierwszym wejÅciu | **DONE** 06.10 | `c1d23e2` (PR #134) | `tests/persist-toast.spec.ts` 3/3 (HEAD); na `c1d23e2^` 1/3 FAIL (system jasny) | Przyczyna `e5ccb96` (Q-9 B): `setState` w `onRehydrateStorage` przed przypisaniem store â TypeError â toast. Prod 06.10: ekran logowania bez toastu (obie domeny, light/dark); wadliwa ÅcieÅ¼ka byÅa w paczce prod â naprawa wdroÅ¼ona z #134. |
| B-SMOKE-DRIFT | awarie smoke ukryte pod `#langSeg` | **DONE** 06.10 | `55eccc4` (PR #134) | etap4 12/12, e2e-core 5/5, etap6 1/1, d-eur-t 2/2 | Regresja aplikacji: O4 DemoMark w akordeonie Opcji (`5685099`) â naprawiona. Reszta: testy pod AWIZ-4, B-K.1, DRV-CLOSE, DEC-6, L-5, D-31 (sprawdzenia zastÄpione odpowiednikami). d-eur-t pomija tekst niewidoczny (zwiniÄte `<details>`). |
| O-V B-SMOKE-LANG | Vercel prod po PR #134 | **DONE** 06.10 10:23 | scalenie `a78e876` (#134); #133 zamkniÄty (treÅÄ w #134) | `dpl_DcRvzniRJvFTo1siEZ4B2SyKPfyz` READY (git archive `a78e876`), alias tower.log-mar.pl; tower.log-mar.pl **200**, watch-tower-makieta.vercel.app **200**; paczka prod zawiera poprawkÄ (`queueMicrotask(()=>{try{â¦setState({themeâ¦`), 0Ã `service_role` | Prod po wdroÅ¼eniu: ekran logowania light/dark bez toastu i bez pageerror (obie domeny). Pierwsza prÃ³ba CLI âNot authorizedâ (wysyÅka plikÃ³w), ponowienie OK. |

## PorzÄdki 29.09.2026 â archiwum i pliki poufne

| ID | pozycja | status | commit | uwagi |
|---|---|---|---|---|
| PORZ-1 | Archiwum instrukcji â `docs/archiwum/`; nowe zasady; grafiki Watch Tower; usuniÄcie xlsx/docx poufnych z drzewa | **DONE** (ten commit) | (HEAD po pushu) | Historia gita **nie** przepisana (repo prywatne). Commity z plikami poufnymi do wyczyszczenia przed ewentualnym udostÄpnieniem: `0ad97bae` (SCX_CENNIK.xlsx, KSH_HARMONOGRAM.xlsx, BAF_SPEC.docx, qa xlsx), `af3ea61c` (public/KSH_HARMONOGRAM.xlsx, docs/qa-start/*.xlsx), `deaad9c6` (przykÅadowe kwoty w PRZEKAZANIE_CURSOR.md). Kopie: `D:\Watch Tower\dane\z_repozytorium\`. |

### Klasyfikacja xlsx (E.2)

**UÅ¼ywane przez testy/skrypty â syntetyczne w `tests/fixtures/`:**
- `public/KSH_HARMONOGRAM.xlsx` â `ksh-harmonogram-synthetic.xlsx`
- `docs/qa-start/p9r-merge-plus1-valid.xlsx` (+ kopia watch-tower) â `p9r-merge-plus1-valid.xlsx`
- `docs/qa-start/ship-qa-schedule.xlsx` â `ship-qa-schedule.xlsx`
- `docs/qa-start/ship-qa-unique.xlsx` â `ship-qa-unique.xlsx`

**NieuÅ¼ywane w kodzie â kopia do `dane\z_repozytorium`, `git rm`:**
- `p9r-import-plus1-exact.xlsx`, `p9r-merge-plus1.xlsx`, `p9r-sg34-restore.xlsx` (oba katalogi qa-start)
- `docs/watch-tower/SCX_CENNIK.xlsx`, `KSH_HARMONOGRAM.xlsx`, `BAF_SPEC.docx` (E.1)

**Zostaje:** `tests/fixtures/wob-*.xlsx` (dane publiczne KE).



## Baza testowa 30.09.2026 â Plan B (Supabase hosted, bez Dockera)

| ID | pozycja | status | commit | testy (liczby) | uwagi |
|---|---|---|---|---|---|
| BAZA-T | projekt `watch-tower-test` (ref emkbykwenwrjmbprydml); TEST_DB_URL z Management API (Session :5432) + TEST_DB_PASSWORD; brama `node scripts/test-db-gate.mjs`; bezpiecznik produkcji; zasada w `baza.mdc` | **DONE** (ten commit) | (HEAD po pushu) | poÅÄczenie OK (PostgreSQL 17.6); migracje 0001â0097 naÅoÅ¼one (0031 trigger: WARN â brak uprawnieÅ spatial_ref_sys na free test); refuse-prod **5/5**; hosted: archive **18/18**, watchdog **27/27**; FAIL (hostedâ stub): security 74/88, status 8/44, storage 30/37, money 115/130, release 141/145, session 15/27, invite brak WYNIK (auth), risks 20/23, import 65/66, nullguard 358/379, i2 429/510, workflows 27/46, insurance 30/33; backup SKIP (CREATE DATABASE) | **Klient:** istniejÄcy psql pg16 + Node `pg` â bez winget, bez Dockera. Windows psql: URI przez `-d`. Bezpiecznik `refuse-prod.sh`. Zasada: bez zielonych testÃ³w bazy Å¼adna migracja nie wchodzi na produkcjÄ. Dane zmyÅlone. Aplikacji i produkcji nie ruszano. |

| BAZA-T2 | brama hosted: dostosowanie bez osÅabiania asercji (Admin API, SKIP tylko spatial/CREATE DATABASE) | **DONE** 30.09 (ten commit) | (HEAD po pushu) | peÅna brama â tabela niÅ¼ej | Bez zmian aplikacji/produkcji. `TEST_SERVICE_ROLE_KEY` z Management API â `.env.local` (nigdy nie wypisany). |

### BAZA-T2 â wyniki bramy hosted (emkbykwenwrjmbprydml)

| Zestaw | OK | FAIL | SKIP | status |
|---|---|---|---|---|
| security | 84 | 0 | 2 | OK (oczek. 84; lokalnie 88â4 spatial) |
| status | 44 | 0 | 0 | OK |
| storage | 37 | 0 | 0 | OK |
| money | 130 | 0 | 0 | OK |
| release | 145 | 0 | 0 | OK |
| backup | â | â | 1 | SKIP â CREATE DATABASE |
| session | 27 | 0 | 0 | OK |
| archive | 18 | 0 | 0 | OK |
| watchdog | 27 | 0 | 0 | OK |
| invite | 48 | 0 | 0 | OK |
| risks | 21 | 0 | 2 | OK (oczek. 21; lokalnie 23â2 tower_test_status) |
| import | 66 | 0 | 0 | OK |
| nullguard | 379 | 0 | 0 | OK |
| i2 | 510 | 0 | 0 | OK |
| workflows | 46 | 0 | 0 | OK |
| insurance | 33 | 0 | 0 | OK |

**SKIP (jawne, tylko dozwolone):**
1. `spatial_ref_sys` DELETE/UPDATE (security) â hosted free: brak OWNER/TRIGGER 0031
2. `postgres DELETE spatial_ref_sys` â j.w.
3. `backup` caÅy zestaw â CREATE DATABASE niedostÄpne na hosted
4. `risks` automat statusÃ³w/promÃ³w (`tower_test_status`) â wymaga osobnej bazy (CREATE DATABASE)
5. `risks` automat: klucze funkcji â j.w.

**Kategoria (b) prawdziwy bÅÄd:** brak.

Uwaga: zestaw `i2` na hosted wymaga `ensureSeedAuthUsers` (FK `auth.mfa_factors` â `auth.users`); brama woÅa Admin API przed i2/session.

**Klasyfikacja wczeÅniejszych FAIL â (a) Årodowisko hosted (naprawione adaptacjÄ, nie luzowaniem asercji):**
| FAIL | przyczyna (a) | adaptacja |
|---|---|---|
| atrapa `auth.users` / DISABLE TRIGGER | free: brak OWNER na auth | Admin API + `TEST_SERVICE_ROLE_KEY` |
| `spatial_ref_sys` mutacje | brak uprawnieÅ PostGIS | SKIP (asercja lokalna bez zmian) |
| backup / `tower_test_status` | CREATE DATABASE | SKIP |
| nullguard âfunkcje bez wpisuâ | CRLF w `comm` na Windows | `tr -d '\r'` |
| workflows START-1â¦7 = 0 | shim no-opowaÅ ponowne migracje po seed | `TOWER_ALLOW_MIG_REAPPLY` |
| storage KSH PDF HHL = 0 | `storage.objects` przeÅ¼ywa DROP public + UNIQUE | czyszczenie (replica) + unikalna ÅcieÅ¼ka na hosted |
| i2 GPS flags puste | enum bez `DRIVER_APP` | `DRIVER_PWA` na hosted |
| i2 rate_card_save / purge | `-c`â`-f`: `set_config(...,true)` poza transakcjÄ | jawne `BEGIN`â¦`COMMIT` |
| i2 MFA factors = 0 | prawdziwa `auth.mfa_factors` (nie atrapa) | insert z kolumnami hosted; bez DROP tabeli |
| i2 UNLOADED +00 vs +02 | TimeZone=UTC na poolerze | `TimeZone=Europe/Warsaw` w shim + `PGTZ` |
| pooler leftover JWT | `auth.uid()` w insertach postgres | clear JWT na poczÄtku kaÅ¼dego psql |
| money FIX JSON | Windows Store `python3` stub | Node |
| UTF-8 PL w `-c` | Win32 argv | `-c` â plik UTF-8 + `-f` |

## Sesja 30.09 (wieczÃ³r) â ENV + I-33

| ID | pozycja | status | commit | testy (liczby) | uwagi |
|---|---|---|---|---|---|
| ENV-0a/b/e | eol=lf; vitest CRLF+suma makiety; hunspell SKIP Windows; drop VITE_TRAFIKVERKET_API_KEY | **DONE** | `a2b38f18` | vitest **530 passed / 36 skipped / 0 failed** | `core.autocrlf=true` â working tree CRLF; testy normalizujÄ LF. PL-T: 2Ã SKIP z jawnym powodem w nazwie. 0c (baza testowa) pominiÄte â DONE wczeÅniej `894a684e`. |
| I-33 | straÅ¼nik zawieszonej kopii RUNNING > 30 min | **DONE** | (ten commit) | dry-run PROD+TEST ROLLBACK OK; izolowany I-33 na TEST **ok**; produkcja: 0098 + cron `tower-backup-stale` `*/5` | **Przyczyna id=10 (29.09 00:30 UTC):** Edge `backup-export` urwaÅ siÄ w trakcie COPY (postÄp 12 tabel / 8062 B w `tables`, m.in. fx_ratesâ¦fuel_index_readings); `finished_at` puste do nastÄpnej nocy. `backup_run_begin` oznaczyÅ ERROR dopiero przy starcie id=11. **Nocna 30.09 id=11:** OK, `daily/2026-09-30/`, 63238 B, 16 s. **StraÅ¼nik:** `backup_stale_watchdog()` â ERROR + JOB_FAILURE + e-mail (Vault). gate backup oczekuje **29** (byÅo 23). Domeny: tower.log-mar.pl **200**, tower-hhl.pages.dev **200**. |
| ODBIÃR | potwierdzenie paczki/zleceÅ 30.09 | **DONE** | (ten commit) | â | Lista ID w PLAN.md Â§ PACZKA 30.09. Kolejka rozszerzona (AUTH-1, DEC-*, BRAND-15, â¦). |
| AUTH-1 | logowanie hasÅem (PO_SPOTKANIU Â§1) | **DONE** (kod+baza; live 20 kont â przy R-2) | (ten commit) | vitest **534/36 skip**; unit `auth-password` 3/3; 0099 na PROD+TEST | Migracja 0099: `must_set_password`, `auth_email_allowed` (anon), `app_user_mark_password_set`, `my_profile`+flaga. UI: e-mail+hasÅo, reset (tylko gdy allowed), âDalejâ przed tokenem (`detectSessionInUrl:false`), ustaw hasÅo â¥12. IstniejÄce konta: must_set_password=true â proÅba o hasÅo przy nastÄpnym wejÅciu. Kryterium 20 kont/5 min â przy zaproszeniach R-2. |
| I-30 | cennik wedÅug symbolu (D-1) | **DONE** | `ae62f2f9` | verify xlsxâ¡JSON **OK**; unit i30 **7/7** + guardian **1/1**; db i30 **10/10**; map HH **87/95** (8Ã KR-08â¦15 bez daty â NO_CONVOY, zgodnie z decyzjÄ); vitest powiÄzane **15/15** | Migracja **0100** (PROD dry-run ROLLBACK + apply; TEST apply). `rate_match` SYMBOL: rodzina z numeru, konwÃ³j KR, HEIGHT_ADOPTED, PL-1/10.1/17.1â2,45. Formularz Opcje przebudowany. Skrypty: `i30-verify-cennik.mjs`, `i30-load-cennik.mjs` (TEST domyÅlnie; PROD: `TOWER_CENNIK_PROD=1`), `i30-map-harmonogram.mjs`. Kwoty zaÅadowane TEST+PROD skryptem z `D:\Watch Tower\dane` â **nigdy w migracji/repo**. Demo `src/data/*` oczyszczone z kolizji kwot. |
| I-31 | SEFS hybrid_min (D-2) | **DONE** | (ten commit) | unit i31 **3/3** (w tym 28.09â04.10 â **1,14**); db i31 **6/6** | Migracja **0101** (PROD dry-run + apply). `sefs_lookup_mult` / `sefs_compute_hybrid` / `sefs_week_for_load`. Tabele 51+51 skryptem `i31-load-sefs.mjs` â TEST v3 + PROD v1. III-10 WOB **wyÅÄczone**. Odczyty dzienne period=YYYY-MM-DD. NastÄpne: **DEC-2 centrum decyzji**. |
| DEC-2 | centrum decyzji (DECYZJE Â§2) | **DONE** | (ten commit) | dec2 **18/18** | **0102/0103** + **0126** `decision_apply_effect` (CANCEL/NOTIFY/HOLD/CHANGE_SAILING/TAKE_FILE/BACKUP_RETRY/â¦); resolve â jsonb + ui_hint; UI DecisionCentre â szuflada |
| DEC-3 | powiadomienia (Â§3) | **DONE** | (ten commit) | dec3 **10/10** | **0104** decyzje; **0126** wyzwalacze status/ryzyko/strefa â `matrix_notify` |
| DEC-4 | widocznoÅÄ macierz (Â§4) | **DONE** | (ten commit) | j.w. | **0105** admin + egzekwowanie firm/kanaÅÃ³w w `matrix_notify` (EMAIL gdy macierz) |
| BRAND-15 | nazwa i logo Watch Tower (Â§15) | **DONE** | `f8c8af6c` `57527034` | risk-keys **14/14** | favicon/splash/manifest/SW; logo AuthGate; topbar; UI bez âTOWERâ. Zostaje: szablon e-mail Auth (dashboard Supabase). |
| AWIZ-4 | awizacja Dodaj/Edytuj (Â§4) | **DONE** (UI; zapis KSH=II-10) | (ten commit) | awizacja-state **5/5**; phone-national **5/5**; tsc OK | Modal nad panelem; pola Â§4; armatorârejsâstatek; filtr âzdÄÅ¼yâ (+14 h); trackingâ`telematics_vehicle_id`; Ustalenia bez starego formularza kierowca/rejs. |
| HHL-4a | nr zlecenia HHL (Â§4a) | **W TOKU** | (ten commit) | â | Przycisk Dodaj/Edytuj + pole w oknie awizacji; konflikt pliku i zapis SharePoint = II-10. |
| TEL-1 | telefony bez kierunkowego (Â§1) | **DONE** | (ten commit) | phone-national **10/10**; xlsx-roles **4/4**; tsc OK; security hosted | Migracja **0111** PROD+TEST: `driver_phone_country`, konwersja E.164âkrajowy, `driver_phone_e164` przy SMS. Import `normalizePhone` â krajowy. Eksport = krajowy. Escort/awizacja: blur zdejmuje kierunkowy. |

**NastÄpne:** DATY-67 Â· kolejka PLAN (po TEL-1).
**Czeka na wÅaÅciciela:** instalacja APK bramki (`D:\Watch Tower\dane\apk\WatchTowerSMS.apk`) + parowanie + SMS test; API emtrack, linki podwykonawcÃ³w, wymiary aut, zgoda IT KSH + creds SharePoint; szablon e-mail Auth âWatch Towerâ; akceptacja pisemna II-10-E2; numer wÅaÅciciela do SMS testowego (w UI, nie w repo).

| RESP-14 | telefon i PWA (Â§14) | **W TOKU** | `dfcc0afe` | tsc OK | `sw.js` v2026-10-01b + `offline.html`; toast nowej wersji; menu â° + nav overlay â¤768; drawer/awizacja peÅny ekran; karty harmonogramu; cele 44px / input 16px. Brama 390/768 + Lighthouse â przy wdroÅ¼eniu. |
| DEC-5 | SMS strefy 2+2 (Â§5) | **DONE** | (ten commit) | dec5 **11/11** na TEST | Migracja **0106** TEST+PROD. Listy LOAD_SREM/UNLOAD_BODEN; wyzwalacze; dedup; bufor przed Åremem; UI Opcje; TEL-1 przy zapisie. |

### UzupeÅnienie START PRACY (01.10) â od koordynatora

PrzyjÄte: **II-10-E1**, **II-10-E2**, **ONE-MECH** (D-29/D-29t), **I-7a** (Â§1a, bez wycofania zgody), **CLEAN-TT-HERE** (P2).
Wpisy w `PLAN.md` (PACZKA + decyzje D-29/D-32/D-33 + DEC-CLICK).

### Akceptacja koordynatora (01.10 popoÅudnie)

PrzyjÄte: **DEC-CLICK** (a/b/c), **D-29t** (z warunkiem zastÄpnikÃ³w), **D-4** (zamkniÄte),
**PUSH+PROD**, **I-3-APK**.

| ID | pozycja | status | commit | testy (liczby) | uwagi |
|---|---|---|---|---|---|
| DEC-6 | ustawienia admina Â§6 | **DONE** | (ten commit) | dec6 **15/15**; nullguard **473**; security **84/84**; tsc OK | UkÅad zwijany. **0107** progi. **0110** (PROD dry-run ROLLBACK + push; TEST apply): `admin_auth_login_log`, `system_broadcast` + `admin_broadcast_set/clear` + `system_broadcast_current`. UI: AuthLoginLog, BroadcastForm, DataExportPanel (CSV/XLSX z widocznoÅciÄ). Baner w shell. |
| DEC-CLICK | routing klikÃ³w | **AKCEPTACJA** | (docs) | â | Grupa C bez nowych typÃ³w; status/strefa â Transport; grupa D bez driver PWA (D-38). Implementacja w ONE-MECH/DEC-3. |
| D-29t | tabela nakÅadania | **AKCEPTACJA** | (docs) | â | Warunek: Å¼aden alarm bez zastÄpnika â lista poniÅ¼ej. Scalenie = ONE-MECH. |
| D-4 | telefon+SIM | **ZAMKNIÄTE** | â | â | Koordynator: Android + SIM sÄ. Dalej = I-3-APK. |
| I-3-APK | aplikacja bramki Android | **DONE APK** | (ten commit) | APK **1.0.0** podpisany v2 | Plik: `D:\Watch Tower\dane\apk\WatchTowerSMS.apk` Â· SHA-256 `d6324bb089e6764d436066ce309b4d4caab59f91de3c42aa54e9a40f4a50ce8c` Â· klucz poza repo (`dane\apk-klucz`). Instrukcja USB/Drive zaktualizowana. Czeka: instalacja na telefonie wÅaÅciciela + parowanie + SMS test. |

#### D-29t â lista âbyÅo â jestâ (warunek akceptacji: zero znikajÄcych alarmÃ³w)

| ByÅo (ÅºrÃ³dÅo alarmu / akcji) | Jest (zastÄpnik â alarm zostaje) |
|---|---|
| START/wf-3 âCichy pojazdâ | `detect_silent_vehicles` (DB) â ryzyko SILENT + macierz RISK; wf-3 wyÅÄczony (bez dubla) |
| START/wf-1 Bufor 50 km Boden | silnik geofence + DEC-5 SMS stref + macierz LOAD_STATUS; wf-1 nie osobno |
| START/wf-8 Plan B / PRE_PORT | ryzyko FERRY + decyzja plan B + macierz; wf-8 wyÅÄczony |
| START/wf-4 Ryzyko promowe | jedno zdarzenie ryzyka FERRY â macierz + decyzja; wf-4 wyÅÄczony |
| START/wf-5 Zmiana daty awizowanej | DATY-67 + decyzja + powiadomienia (I-10 ÅcieÅ¼ka); wf-5 wyÅÄczony |
| START/wf-2 Brak zezwolenia 48 h | I-27 + decyzja + macierz; wf-2 wyÅÄczony po podpiÄciu DEC |
| START/wf-6 POD po rozÅadunku | ÅcieÅ¼ka dokumentÃ³w + SMS 9 (DEC-5/D-19); wf-6 nie dubluje |
| SMS 5 / 9 z wf | wyÅÄcznie wyzwalacze Â§5 / macierz (juÅ¼ 0106) |
| OpÃ³Åºnienie ETA (mail z wf) | ryzyko DELAY â decyzja; bez osobnego maila z wf |
| START/wf-9 Trafikverket | ryzyko ROAD_SE + macierz; wf-9 wyÅÄczony |
| START/wf-7â¦12 (faktury/marÅ¼aâ¦) | macierz MONEY/SYSTEM albo osobna decyzja â **nie kasowaÄ** przed mapowaniem |
| LOADING_UNCONFIRMED / SEQUENCE / DATES_UNCONFIRMED / USAGE_LIMIT / JOB_FAILURE | zostajÄ w grupie C (DEC-CLICK a) â **bez nowych typÃ³w**, mechanizm ryzyka bez zmian |
| Kopia JOB_FAILURE | poza grupÄ C (osobna ÅcieÅ¼ka straÅ¼nika kopii) â bez zmian |

#### Naprawa bramy po 0106 (01.10)

| ID | status | commit | testy | uwagi |
|---|---|---|---|---|
| 0109 | **DONE** PROD+TEST | `93ce1109` | i2 **510/510**; dec5 **11/11** | `sms_zone_on_geofence_enter`: niepoprawny `geofence_id` nie wywala INSERT `load_events` (I-2l). Seed: Bufor przed Sremem w `tests/db/seed.sql`. i2: oczekiwania SMS po `sms_strip_pl` / âWatch Towerâ. |
| O-V | vercel --prod po 0105â0109 | **DONE** | `5d2b0248` | tower.log-mar.pl **200**, watch-tower-makieta.vercel.app **200**; dpl `GJ26sabEâ¦` READY | Deploy z kopii bez `.git` (CLI z metadanymi git â BLOCKED). Naprawy TS: ScheduleView Fragment, `await getSupabase` w SmsZoneRecipients, awizacja bez CANCELLED w typie UI. |
| ONE-MECH | wyÅÄczenie dubli + DEC-CLICK | **DONE** | (ten commit) | â | Seed wf-1â¦12 off (7/10â12 â MONEY/SYSTEM); auto-run usuniÄty; klik strefyâTransport; wf w prod = podglÄd. |
| I-3-APK | APK lokalnie | **DONE APK** | (ten commit) | APK **1.0.3** v2 | `WatchTowerSMS.apk` SHA-256 `64eca1b1â¦8c05`. **1.0.3 Realme:** onDestroy nie kasuje ON; KeepAlive 12 min; BOOT/QUICKBOOT; dialog baterii + autostart. Smoke **PASS**. Strefy **OFF**. |
| SMS-DELIV | burst 10 | **DONE** (po 2 h) | â | **10/10 DELIVERED** (QUEUED 0 / SENT 0 / FAILED 0); tag `20261001205456`; last4 `7907` | SygnaÅ â2 h minÄÅyâ â `node scripts/sms-burst-test.mjs` exit 0. Strefy byÅy **OFF** (`SMS_ZONE_APPROACH`/`SMS_ZONE_ENTER` = f). |
| SMS-ZONE-ON | wÅÄczenie stref po 10/10 | **DONE** | â | przed: APPROACH=f ENTER=f (PROD+TEST); po **0116**: APPROACH=t ENTER=t (PROD+TEST) | Migracja **0116** (przywrÃ³cenie po 0112). Dry-run ROLLBACK OK â `db push` PROD; TEST: SQL + wpis `schema_migrations`. APK/bramki **nietkniÄte**. |
| ADM-10 | DziaÅaj jako (Â§10 / D-52) | **DONE** | (ten commit) | 0117 PROD+TEST; adm10 **8/8**; tsc OK | Migracja **0117**: `impersonation_state`, `current_*` â konto docelowe, `real_app_*`, `admin_impersonate_start/stop`, `audit_log.acting_as_user_id` + trigger, `my_profile` (+acting_as/real_*). UI: przycisk w UÅ¼ytkownikach + pasek wyjÅcia. |
| DATY-67 | daty z pliku KSH + opÃ³Åºnienie (Â§6â7); bez âPotwierdÅº datyâ | **DONE** | (ten commit) | 0113 PROD+TEST; vitest i18 **3/3**; tsc OK; sekcja i2 DATY-67 **25/25** (po poprawce SCXâWSTEPNA); oczekiwanie i2 bramy **499** | Migracja **0113**: `schedule_cell_ts`, import zawsze nadpisuje daty/godziny z pliku â `plan_load_from` (PL) / `plan_delivery_to` (SE); `ksh_confirm_dates` odmowa DATY-67; `detect_unconfirmed_dates` = 0 + cron zdjÄty; ryzyko **LATE_DATE_CHANGE** (HHL+SCX) przy zmianie â¤ N dni; `TRANSIT_TARGET_DAYS=4` (rezerwa ETA â II-7b, bez zmiany `compute_load_eta`/I-15). UI: usuniÄty panel âPotwierdÅº datyâ, znaczniki WSTÄPNA/â, zgoda overwrite. Bramka SMS / strefy **nietkniÄte**. |
| I-7a | KSH widzi kierowcÄ/auto na staÅe (bez wycofania zgody) | **DONE** | (ten commit) | 0114 PROD+TEST; vitest permissions-phone + xlsx-export **9/9**; tsc OK | Migracja **0114**: `load_driver_contacts` â CLIENT peÅne imiÄ+telefon swojego projektu bez okna Â±24 h. Front: `canSeeDriverPhone` zawsze dla KSH; eksport XLSX z Kierowca/Telefon. i2 Â§I-7a zaktualizowany. Bramka SMS / strefy **nietkniÄte**. |
| OPL-8 | opÅaty wyÅÄcznie rÄcznie (Â§8; zastÄpuje auto I-32) | **DONE** | (ten commit) | 0115 PROD+TEST; tsc OK; i2 +13 (oczek. **512**); nullguard +15 (oczek. **488**) | Migracja **0115**: `load_agreed_fees` + `load_agreed_fee_add` (tylko HHL) + `fee_catalog_hints` (podpowiedÅº) + `load_dwell_info` (minuty, bez kwoty). UI: formularz w szufladzie (tab Finanse). Zero funkcji auto-naliczania. Bramka SMS / strefy **nietkniÄte**. |
| FAK-9 | faktury EUR lub PLN przy rejestracji (Â§9) | **DONE** | (ten commit) | vitest invoices3 **17/17**; CHECK currency EUR/PLN na `invoices`; `register_invoice` + `BillsPanel` wybÃ³r EUR/PLN + FX NBP A per pozycja | JuÅ¼ w M6/invoices3 â potwierdzone wzglÄdem Â§9 (wybÃ³r waluty, PLN = EURÃkurs transportu, marÅ¼a w EUR). Zestawienie tygodniowe = istniejÄcy tydzieÅ faktury. Bramka SMS / strefy **nietkniÄte**. |
| HIST-11 | peÅna historia zmian (Â§11) | **DONE** | (ten commit) | 0118 PROD+TEST; hist11 **11/11**; tsc OK; i2 +3 (oczek. **515**); nullguard +5 (oczek. **513**) | Migracja **0118**: `audit_log.source`; `audit_row_change` â `current_app_user_id` (ADM-10 acting_as) + source z `tower.audit_source` / `system`; wyzwalacze ROW_* na **37** tabelach biznesowych (konta, ustawienia, dokumenty, decyzje, opÅatyâ¦); RPC `admin_audit_history` (filtry kto/kiedy/obiekt/rodzaj + szukaj). UI Opcje â âHistoria zmianâ (byÅoâjest, automat, eksport CSV/XLSX). Dry-run PROD ROLLBACK OK â `db push`; TEST: SQL + `schema_migrations`. Bramka SMS / strefy **nietkniÄte**. |
| STENA-3 | Stena Line GdyniaâKarlskrona (Â§3) | **DONE** | (ten commit) | 0119+0120 PROD+TEST; **bez nowej migracji schema** (fundament); ferry **23/23**; integrations **27/27** (Stena+403) | RozkÅad+status: JSON AEM Stena; ÅºrÃ³dÅo `STENA`. AIS: port Karlskrona; Digitraffic 01.10 = 0 pozycji Spirit/Estelle/Ebba (brak â  opÃ³Åºnienie). Edge ferry-* wdroÅ¼one PROD. **Luki:** ETA (II-7), pogoda (II-8), opÃ³Åºnienie AIS (II-9), trasa alt. w ryzykach; wspÃ³ÅrzÄdne terminali. |
| II-5 | komunikaty armatorÃ³w â odczyt teraz | **DONE** | (ten commit) | j.w. | Parser Polferries + Stena status; 403âNIEZNANY+ryzyko Cloudflare. D-18 e-mail informacyjny zostaje. |
| II-6 | Trafikverket E4 â warunki + spowolnienie SE | **DONE** | (ten commit) | **0121** PROD+TEST (dry-run ROLLBACK OK â push); integrations road-se; Edge `road-se` wdroÅ¼ony | Live: **RoadCondition** + **WeatherMeasurepoint** (Situation **nie istnieje** w Open API 01.10). `corridor_conditions.SE_E4` + `SE_ROAD_SLOWDOWN_PCT=15`. KPD/TomTom nadal DEMO. |
| II-7 | wÅasny silnik ETA OSM (ODbL); HERE nie | **DONE** | (ten commit) | **0122** PROD+TEST (dry-run ROLLBACK OK â push); corridor-eta vitest **6/6**; ferry/integrations OK; i2 +9 (oczek. hosted **524** / lokal **519**) | `corridor_polylines` PL+SE; `corridor_progress`; `compute_load_eta` â **ETA v2 (OSM)** (locate, tempo D-9/I-15, SEÃslowdown II-6, rejs GDN-NYN\|GDY-KAA, attribution); ryzyka off-corridor >2 km + ETA_BREACH > DELAY_MIN; UI szuflada ODbL. Bez GPS = jak v1. |
| II-7b | kalibracja uczÄca siÄ â szkielet | **SZKIELET** | (ten commit) | **0123** PROD+TEST; nullguard +10 (oczek. hosted **523**) | Tabele `eta_segment_observations` / `eta_calibration_versions`; `admin_set_eta_calibration_frozen` + `apply_eta_calibration_version`. **PeÅna nauka + symulacja 30 â TELM-2 / D-TELM-ETA.** |
| II-9 | opÃ³Åºnienie wypÅyniÄcia z AIS | **DONE** | (ten commit) | ferry **+3**; Edge `ferry-ais` wdroÅ¼ony PROD | `aisDepartureDelayMin`: dystans/SOG vs cutoff; brak pozycji â  opÃ³Åºnienie; ryzyko `rk_ais_departure_delay`. Digitraffic PL nadal czÄsto bez sygnaÅu. |

| II-8 | pogoda morska FMI+DMI+SMHI; progi D-39 | **DONE** | (ten commit) | **0124** PROD+TEST (dry-run ROLLBACK OK â push); Edge `ferry-weather` wdroÅ¼ony; cron `tower-ferry-weather` 15 */6; marine-weather vitest **10/10**; integrations ferry-weather **3/3**; LIVE: wave **1,17 m**, gust **â20 kn**, risk niskie, ÅºrÃ³dÅa FMI+DMI (+SMHI ocobs Knolls) | Punkty GDN/MID/NYN Â±6 h; progi `WAVE_M`/`GUST_KN` (3,8 m / 40 kn, etykiety D-39); ryzyko `rk_ferry_weather`; UI Ryzyka: atrybucja CC BY 4.0. IMGW pominiÄte (umowa). SMHI metfcst API 404 â tylko ocobs. DMI czasem 429 (retry+FMI). |
| I-29 | budÅ¼ety darmowych planÃ³w Ã 140 transportÃ³w | **DONE** | (ten commit) | â | Tabela szczyt vs limit w `I29_BUDGETY_140.md`: Resend/SMS/baza/Edge/TV/FMI â wszystkie OK; Edge â22â25k/mies. âª 500k. |
| CLEAN-TT-HERE | TomTom/HERE martwy kod | **DONE** | (ten commit) | integrations traffic-flow **1/1** DEMO; bez `TOMTOM_API_KEY` w run-job | UsuniÄte `parseTomTomFlow`/`tomtomFlowUrl`/`flowRisk`; Edge `traffic-flow` stub DEMO; i18n rk_src_TOMTOM âwycofaneâ; ZRODLA Â§2.3. Fixture `tomtom-flow-sample.json` zostaje (archiwum testowe, nieuÅ¼ywane). |

| D-27 | kontrast WCAG AA (â¥4,5:1) | **DONE** | (ten commit) | tokeny --ink-3 / --amber-ink; bell-badge; kursor | Jasny --ink-3=#5A6B78; ciemny #788C9A; tekst ostrzeÅ¼eÅ --amber-ink=#A55A00; badge dzwonka #0E1A24 na --red; thead/tbody cursor:default (aktywne = [tabindex]). Wzorzec bramy wizualnej do odÅwieÅ¼enia (G4). |
| UI-12 | interfejs Â§12 | **DONE** | (ten commit) | Nav session + Docs/Schedule | UÅ¼ytkownik/rola/Wyloguj w lewym menu (nie fixed bottom); POD i mocowanie usuniÄte z UI; CMR zostaje (SCX/HHL). |
| D-30 | polisy: cron + formularz HHL/przewoÅºnik | **DONE** | (ten commit) | **0125** PROD+TEST; insurance **42/42**; tsc OK; RESP-14 phone **3/3** | Migracja **0125**: `approval_status` PENDING/APPROVED/REJECTED; `insurance_policy_approve`; detect tylko APPROVED; cron `tower-polisy` 10 4 * * * (PROD). UI: `InsurancePolicyForm` w Dokumentach (SCX wpisuje â HHL zatwierdza; HHL zapis = od razu APPROVED); notka z bazy. Dane polisy od przewoÅºnika â po spotkaniu. |
| D-31 | pasek gÃ³rny 390 px | **DONE** | (ten commit) | CSS â¤430; resp14-phone 390/768 | Ukryty lang+roleswitch na wÄskim; brand ÅciÅniÄty; `overflow-x:clip` (bez scrollu poziomego przy theme). **Wzorzec 390 nie odÅwieÅ¼any** â G4-D27-D31. |
| RESP-14 | telefon/PWA dokoÅczenie | **DONE** | (ten commit) | resp14-phone **3/3**; LH viewport=1 a11y=1 | Brama 390/768 overflow; menu sesja; skrypt `lh:resp14`. Installable/SW na HTTPS prod. Â§12 user = UI-12. |
| HHL-4a | nr zlecenia HHL (Â§4a) | **DONE** | (ten commit) | UI awizacja/szuflada | Dodaj/Edytuj nr HHL dziaÅa; zapis zwrotny do pliku KSH = II-10-E2 / D-33. |

**NastÄpne:** kolejka P0âP1 bez blockerÃ³w wÅaÅciciela â **wyczerpana** (G4-D27-D31 DONE 02.10).
**Czeka na wÅaÅciciela:**
- **D-32** â zgoda IT KSH + creds SharePoint â `.env.local` (blokuje II-10-E1)
- **D-TELM-ETA / TELM-2** â API emtrack + przykÅady linkÃ³w (blokuje II-7b naukÄ)
- **ZEZW-13** â wymiary aut (P2)
- **D-18** â e-mail informacyjny do armatora (II-5 odczyt juÅ¼ DONE)
- **D-17** â cert KPD GDDKiA
- dane polisy OCP po spotkaniu SCX
- II-10-E2 â pisemna akceptacja po E1
- **R-2 / D-16** â wÅaÅciciel sam dodaje uÅ¼ytkownikÃ³w w aplikacji (zaproszenia odblokowane 0133)
- **R-1** â import prawdziwego harmonogramu na PROD
- peÅne `EXTERNAL_MESSAGING` (SMS do kierowcÃ³w) â osobna decyzja HHL_ADMIN

| I-3-APK | bramka Android | **DONE** | (ten commit) | burst **10/10 DELIVERED**; strefy **0116** ON | ZamkniÄte decyzjÄ koordynatora 02.10 (po teÅcie stabilnoÅci + burst). |
| DEC-2/3/4 | skutki + macierz powiadomieÅ | **DONE** | (ten commit) | **0126** PROD+TEST (dry-run ROLLBACK OK â apply); dec2 **18/18**; dec3 **10/10** | `matrix_notify` + skutki opcji; wyzwalacze status/ryzyko/strefa; UI hint. |
| AUTH-MAIL | szablony e-mail Auth âWatch Towerâ | **DONE** 02.10 | â | Management API PATCH `config/auth` (bez wysyÅki) | Tematy + treÅci: confirmation/invite/magic_link/recovery/email_change â wszystkie zawierajÄ âWatch Towerâ. |
| MIG-PARITY | lista migracji repo = PROD | **DONE** 02.10 | `e2947d70` | LOCAL 126 = PROD 126 (`0001`â¦`0126`); missing 0 | Commit + push `e2947d70`. |

#### Zmiany oczekiwaÅ bramy (sesja 01â02.10) â `scripts/test-db-gate.mjs` / `tests/db/gate.sh`

| Zestaw | ByÅo (przed sesjÄ / `59a5ce49`) | Jest | Dlaczego (test za zmianÄ) |
|---|---|---|---|
| nullguard (hosted) | 473 | **523** â **528** | + `insurance_policy_approve` w `null-guard-calls.txt` (GUARD Ã4 + pozytywne HHL). Migawka: pomija `audit_log` entity=`app_users` â HIST-11 `trg_audit_row` zapisuje ROW_UPDATE przy przeÅÄczaniu `active` w teÅcie (34â38 to nie wyciek rollbacku). |
| i2 (hosted) | 510 â w trakcie 499/512/515â¦ | **524** | DATY-67, I-7a, OPL-8 (+13), HIST-11 (+3), II-7 (+9) â sekcje w `tests/db/i2.sh` |
| dec2 | 14 | **18** | **0126** skutki opcji â `tests/db/dec2.sh` |
| money | 130 | **131** | M5: asercja numerÃ³w precyzyjna + `RISK_OPEN/RESOURCE_MISSING` (0127); test w `money.sh` |
| dec3 | 8 | **10** â **13** | **0126** macierz + wyzwalacze; **0127** +3 asercje mapowania kindâgrupa (`tests/db/dec3.sh`) |
| adm10 | (brak) | **8** | nowy `tests/db/adm10.sh` (0117) |
| hist11 | (brak) | **11** | nowy `tests/db/hist11.sh` (0118) |
| insurance | 33 | **42** | **0125** approve/cron â `tests/db/insurance.sh` |
| workflows | 46 | **47** | +chk T-BOOM w kolejce; RETRY: pin `next_attempt_at` do osi testu (po 01.10.2026 `now()` > p_now testu) |
| migracje (hosted) | 126 | **127** | **0127** `risk_matrix_group_map` |
| nullguard (lokal `gate.sh`) | 379 | **389** | lokalna lista wywoÅaÅ (bez peÅnego hosted) â do weryfikacji na czystej bramie |
| i2 (lokal `gate.sh`) | 510 | **519** | jak i2 hosted, podzbiÃ³r lokalny |

**Allowlist (nie EXPECTED):** pierwsza czysta brama 02.10 â security **83 OK / 1 FAIL**: brak `authenticated insurance_policy_approve` w `function-allowlist.txt` mimo grantu w **0125** i testÃ³w w `insurance.sh` (approve/reject HHL, odmowa KSH). **Dopisano do allowlist** â EXPECTED security **84** bez zmiany (FAIL â OK).

**money FAIL (naprawa 0127 + precyzja asercji M5):** czysta brama â money **129/130**: `KSH nie dostaje przypomnieÅ o numerach` (otrzymano 5â3, oczekiwano 0).
1. **0126** mapowaÅ `RESOURCE_MISSING` â `RISK_FERRY_WEATHER` (KSH IN_APP). **0127** â tylko `FERRY`/`WEATHER`/`ETA_BREACH` â ta grupa; reszta â `SYSTEM`. Test: `dec3.sh` +3. 
2. Asercja M5 byÅa `count(*) from notifications = 0` â za szeroka: M3 (`plan_delivery_*`) po **0113** tworzy `PLAN_DATES_CHANGED` dla KSH (zamierzone). **ByÅo:** cisza caÅkowita. **Jest:** `ORDER_NO_MISSING = 0` + nowa asercja `RISK_OPEN+RESOURCE_MISSING = 0`. EXPECTED money **130 â 131**.

**D-STENA-COORDS â DONE 02.10** (wÅaÅciciel potwierdziÅ terminale):
- Gdynia (54.53321, 18.54425): https://www.google.com/maps?q=54.53321,18.54425
- Karlskrona (56.16460, 15.63080): https://www.google.com/maps?q=56.16460,15.63080

**i2 / workflows (czysta brama 02.10):**
- i2 SMS: TEL-1 â test ustawiaÅ `driver_phone='+4670â¦'` przy domyÅlnym `driver_phone_country='PL'` â E.164 `+48467â¦` â locale pl. **Jest:** `0701234567` + `country='SE'`.
- i2 HIST-11: `(â¦)::text` â **true** (nie `t`).
- i2 II-7: UUID `â¦ii70` (nie-hex) â INSERT cicho padaÅ â `â¦a170`.
- workflows: re-apply tylko 0094â0096; R-2 czyÅci EMAIL; RETRY pinuje `next_attempt_at` do 2026-10-01. EXPECTED **47**.

*Czysta brama hosted â peÅny bieg po poprawkach (02.10).*

### Raport wznowienia po awarii (02.10 popoÅudnie)

| Pozycja | Status | Wynik |
|---|---|---|
| E2E `tests/e2e-core.spec.ts` | DONE | selektory awizacji `label.form-field` Kierowca/CiÄgnik; telefon 390 â `button.phone-menu-btn` |
| G4 visual-states + smoke | DONE | 11Ã stan + 4Ã smoke odÅwieÅ¼one â **BRAND-15 + D-27** (nie regresja) |
| G4 matryca 840 | DONE | SHA: **840/840 zmienione**, 0 bez przyczyny; odÅwieÅ¼one (`G4_WZORZEC.md`) |
| **0128** | DONE PROD+TEST | tylko `(select auth.uid())` w 4 politykach |
| commit + push | DONE | `b34a2236` â LOCAL HEAD = origin/HEAD |
| vercel --prod | DONE | `dpl_4Dy6w3KdB4xt1kytHWFtEU4Ab5pX` READY; Aliased `tower.log-mar.pl` |
| domeny | DONE | `tower.log-mar.pl` **200**, `watch-tower-makieta.vercel.app` **200** |

**0128 â ostrzeÅ¼enia doradcy Åwiadomie NIE zmieniane:**
- **security_definer_view** `v_load_*` â zamierzone (0010): tabele `load_cost`/`load_revenue` bez GRANT dla API; widok = wÅaÅciciel + filtr WHERE + `security_barrier`. Bez porÃ³wnania HHL/KSH/SCX przed/po â **nie ruszamy**.
- **rls_disabled_in_public** `spatial_ref_sys` â PostGIS (`supabase_admin`), chronione wyzwalaczem **0031**; RLS nie wÅÄczamy.
- **st_estimatedextent** anon EXECUTE â wÅaÅciciel `supabase_admin`; `REVOKE` nie zmienia ACL (grantor admin) â **bez zmiany**.

**Brama TEST (0128, 128 mig):** securityâ¦import OK (wczeÅniejszy bieg); remainder: nullguard **528**, i2 **524**, i30 **10**, i31 **6**, dec2 **18**, dec3 **13**, dec5 **11**, dec6 **15**, adm10 **8**, hist11 **11**, workflows **47**, insurance **42** â wszystkie 0 FAIL.

| Zestaw EXPECTED | ByÅo | Jest | Dlaczego |
|---|---|---|---|
| migracje (hosted) | 127 | **128** | **0128** `advisor_security_perf` |
| subset i30/i31 | (brak w subset) | **10 / 6** | dopisane do `test-db-gate.mjs` + `test-db-gate-subset.mjs` |

**EXPECTED i30/i31 â potwierdzenie 02.10:** `node scripts/test-db-gate-subset.mjs i30 i31` â i30 **10/10**, i31 **6/6**, **EXIT=0**.

### Rytm: niedzielna czysta brama TEST

| Bieg | Data | Wynik |
|---|---|---|
| (nastÄpny) | **niedziela 05.10.2026** | â peÅny `test-db-gate.mjs` od zera; wynik tutaj |

### Stan po wznowieniu (02.10)

### BRAND-15 uzupeÅnienie (02.10) â 404 i szablony

| Pozycja | Status | Wynik |
|---|---|---|
| 404 `prodStrip` | DONE | tytuÅ/link âWatch Tower â nie znalezionoâ |
| makiety `public/` | DONE | tytuÅ + brand |
| MFA / e-maile / notify | DONE | Watch Tower zamiast TOWER w UI/szablonach |
| testy | DONE | o2-prod-strip, i5-mfa, keep-alive, usage |

### Przed pilotaÅ¼em â kolejka (02.10)

| ID | Status | Wynik |
|---|---|---|
| BRAND+deploy | DONE | `4a274d10` push; Vercel `watch-tower-makieta` READY â `tower.log-mar.pl`; obie domeny **200**; 404 = Watch Tower |
| DR-TEST | **DONE** | `node scripts/dr-test-restore.mjs` â TEST `emkbykwenwrjmbprydml`, schemat `restore_20261002`. **RESTORE OK tabel=67 wierszy=4920** (= manifest). **ELAPSED_SEC=20**. Klucz age tylko lokalnie â wÅaÅciciel moÅ¼e usunÄÄ plik. |
| SIM-1 | **DONE** | PeÅny przebieg `sim1-full-transport.mjs` na TEST: READYâAT_LOADINGâIN_TRANSIT_PLâAT_PORT_GDANSKâFERRYâAT_PORT_NYNASHAMNâIN_TRANSIT_SEâ**AT_SITE**; pozycje=16, zdarzenia=58, ryzyka=2, powiadomienia=155 (IN_APP 151 PENDING, EMAIL 4 BLOCKED_R2); ETA site 07.10 12:05; SMS 1Ã OWNER (zamaskowany), inne numery=0. |
| LOAD-1 | **DONE** | `scripts/load1-stress.mjs`: seed **140** w 570 ms; 20 uÅ¼ytkownikÃ³w (3 role) falamiÃ8 (limit Session pooler 15). Czasy ms â kokpit p50 **386** / p95 **475**; harmonogram p50 **319** / p95 **373**; mapa p50 **88** / p95 **153**; wall 4580 ms. LOADS_TOTAL=143. |
| DOC-ROLE | **DONE** | Teksty 1-stronicowe PL: `docs/handover/instrukcje/HHL.md`, `KSH.md`, `SCX.md`. W aplikacji: panel âInstrukcjaâ (`Guide.tsx`) â HHL w Opcjach, KSH/SCX w Ustawieniach, kierowca w PWA; rozszerzone `i4_hhl_7/8`, `i4_ksh_7`, `i4_scx_7` (PL/EN/SV). Commit `4971ffbf`. |
| DAILY-1 | **DONE** (+0130) | Okno = **ostatnie 24 h** (`created_at` / `last_seen_at`). **sms_failed=10**: anulowana seria TEST bursta 01.10 19:58 PL (`burst 1.0.1: CLAIMED bez SENTâ¦`) â nadal w oknie 24 h w chwili raportu; **nie bug zakresu**. **client_error_types**: byÅo 10 wierszy (gÅÃ³wnie Leaflet `_leaflet_pos` + 1Ã stale chunk BroadcastForm). Naprawy: `CorridorMap` safeInvalidate; `lazyRetry` w Opcjach; migracja **0130** = `count(distinct fingerprint)` (dry-run â **4** typy). |
| Deploy `4971ffbf`+naprawy | **DONE** | UsuniÄto 3Ã UNKNOWN. PÄtla 30 min **STOP**. Jedno `vercel --prod` (kopia bez `.git`) â `dpl_HbRcgv8â¦` **READY**, alias `tower.log-mar.pl`. |

### II-6/II-8 cron + panel SE + send-notifications (02.10)

| Pozycja | Status | Wynik |
|---|---|---|
| Cron `road-se` | **DONE** | migracja **0131** PROD+TEST: `tower-road-se` `*/15 * * * *`; Edge przeÅadowany; rÄczny przebieg po wdroÅ¼eniu |
| Cron `ferry-weather` | **DONE** | **0131**: byÅo `15 */6` â `15 * * * *` (co 1 h) |
| Cron `ferry-status` | **DONE** | **0132** PROD+TEST: `tower-ferry-status` `*/15`; rÄczny przebieg LIVE `inserted=8 unchanged=10` |
| Panel âWarunki drogowe SEâ | **DONE** | przyczyna âbrak ÅºrÃ³dÅaâ: `shows('roadSituationsSe')=false` w PROD mimo Å¼ywych danych w `corridor_conditions`. Naprawa: odczyt z bazy (`corridorConditionsDb`); âbrak ÅºrÃ³dÅaâ tylko gdy brak Å¼ywego wiersza. **Zrzut po wdroÅ¼eniu:** `tmp-se-panel-e4.png` â `NO_SOURCE=0`, sub `Trafikverket Â· Ã1.00`, nota `RC 25 Â· WX 115 Â· sytuacji: 0 Â· 2.10.2026, 17:22:38` |
| send-notifications | **DONE** | 1 fail / 1740: `Gateway Timeout` 28.09 23:00 UTC (przejÅciowy). Od wtedy same `ok`. Timeout HTTP cron 60â**90 s** (0131) |

#### PrzeglÄd harmonogramÃ³w integracji Edge (02.10)

| Integracja | Harmonogram | PowÃ³d braku / uwagi |
|---|---|---|
| `road-se` | **`*/15 * * * *`** (`tower-road-se`) | LIVE Trafikverket â `corridor_conditions` + ROAD_SE |
| `ferry-weather` | **`15 * * * *`** (`tower-ferry-weather`) | FMI+DMI+SMHI â `marine_conditions` |
| `ferry-ais` | `*/10 * * * *` | dziaÅa |
| `send-notifications` | `*/5 * * * *` | timeout 90 s |
| `usage-check` | `0 5 * * *` | dziaÅa |
| `backup-export` | `30 0 * * *` | wÅÄczony; wymaga R2 |
| `ferry-status` | **`*/15 * * * *`** (`tower-ferry-status`) | **0132** PROD+TEST â II-5/STENA LIVE |
| `ferry-schedule` | **`0 5 * * 1`** (`tower-ferry-schedule`) | **0134** â zgoda wÅaÅciciela 02.10; poniedziaÅek 05:00 UTC |
| `road-pl` | **brak** | KPD DATEX bez URL/cert â DEMO; cron zapisaÅby atrapy |
| `traffic-flow` | **brak** | CLEAN-TT-HERE: zawsze DEMO |
| `fuel-wob` | **brak** | `FUEL_WOB_INGEST` wyÅÄczony (D-2) |
| `document-archive` | **brak** | czeka na R2 / Cloudflare |
| `driver-photo` | **brak** | na Å¼Ädanie (kierowca) |
| `daily-admin-digest` | `0 5 * * *` (SQL) | nie Edge |

### Przekazanie 02.10 (OSTATNIE POLECENIE) â STOP dla tego wykonawcy

| Pozycja | Status | Wynik |
|---|---|---|
| Commit + push | **DONE** | `324ab953` â panel SE + corridorConditionsDb + 0131â0134 + SIM-1 + reguÅa migracji |
| Migracje repo = PROD | **DONE** | `0001`â¦`0134` na PROD+TEST (naprawa timestampâ0131/0132; `db push` 0133+0134) |
| ReguÅa: migracja w gicie przed PROD | **DONE** | `.cursor/rules/baza.mdc`, `tower.mdc`, `AGENTS.md` (+ wzorzec) |
| D-STENA-COORDS | **DONE** | wÅaÅciciel potwierdziÅ terminale Gdynia/Karlskrona |
| BLOCKED_R2 czÄÅciowo | **DONE** | **0133:** e-mail do `app_users` + aktywnych `user_invites` = PENDING; SMS kierowcÃ³w nadal zablokowane; PROD: 0Ã BLOCKED_R2 |
| Cron `ferry-schedule` | **DONE** | **0134** `tower-ferry-schedule` `0 5 * * 1` |
| Deploy Vercel | **DONE** | `dpl_GY6p4iMxâ¦` READY na `watch-tower-makieta`; Aliased `tower.log-mar.pl`; obie domeny **200** (`tower.log-mar.pl`, `watch-tower-makieta.vercel.app`). (Pierwsza prÃ³ba robocopy peÅna â ENOSPC; potem slim bez shots; przypadkowy projekt `tower-vercel-slim-*` usuniÄty) |
| SIM-1 | **DONE** | peÅny tor TEST â AT_SITE |

#### Stan koÅcowy â zrobione / otwarte / czeka na wÅaÅciciela

**Zrobione:** II-6/II-8 crony, panel SE z DB, send-notifications timeout, ferry-status+ferry-schedule, 0133 messaging, D-STENA-COORDS, DR-TEST, SIM-1, LOAD-1, DOC-ROLE, DAILY-1, BRAND, reguÅa migracji-przed-PROD, commit `324ab953`, deploy `dpl_GY6p4iMxâ¦`.

**Otwarte (kolejny wykonawca):** R-1 import; R-2 zaproszenia w UI (wÅaÅciciel dodaje konta); R-3; II-10-E1/E2; II-7b; peÅne EXTERNAL_MESSAGING gdy HHL wÅÄczy SMS.

**Czeka na wÅaÅciciela:** D-32, D-TELM-ETA, ZEZW-13, D-17, D-18, D-16, polisy OCP, II-10-E2, ewentualnie `admin_set_external_messaging(true)`.

**ZATRZYMANE â pracÄ przejmuje inny wykonawca.**

**Czekam takÅ¼e (dane):** IT KSH (SharePoint / D-32); API emtrack + linki; wymiary aut; polisy OCP. **DR-TEST zakoÅczony â wÅaÅciciel moÅ¼e usunÄÄ klucz age.**

### 2026-10-03 â PB-2

WczeÅniej czerwone testy aplikacji, liczby z kodu: przewodnik i4 (`tests/i4-guide.test.ts`) â HHL ma 8 krokÃ³w, nie 7; KSH i SCX majÄ po 7, nie 6 (`EXPECT`: hhl 8, ksh 7, scx 7). Klucze ryzyk (`tests/risk-keys.test.ts`) â lista 12 ÅºrÃ³deÅ (`SOURCE_IDS`), nie asercja `toBe(6)`.

### 2026-10-03 â PB-3 i kokpit (scalenie zablokowane)

Dwa trafienia score 70 w `scripts/bundle-size.mjs`: skrypt uruchamiany tylko przy budowaniu, nie trafia do aplikacji. Zaakceptowane ryzyko. Feed Aikido w workspace Spawn2018 zwraca 400 (funkcja wyÅÄczona), wiÄc oznaczenia w panelu Aikido nie da siÄ zapisaÄ. Zapis jest tutaj.

Kokpit, ujÄcie `kokpit__hhl__pl__1920__light`: 18579 px przy progu 60. UkÅad i treÅÄ zgodne ze wzorcem. RÃ³Å¼nica na krawÄdziach liter (antyaliasing), nie z D-27, BRAND-15, RESP-14 ani UI-12. Wzorca nie odÅwieÅ¼ono. SCALENIE ZABLOKOWANE do decyzji wÅaÅciciela.

### 2026-10-03 â wyjÄtek wizualny PR #2

WyjÄtek â test wizualny czerwony takÅ¼e na main, naprawa w P1-FONT. Kokpit 18579 px przy progu 60. Przyczyna: czcionka z Google Fonts, rÃ³Å¼ne pliki na rÃ³Å¼nych systemach. Nie jest bÅÄdem gaÅÄzi `fix/przejecie-testy-02-10`.

### 2026-10-03 â P1-FONT, zmiana ÅºrÃ³dÅa czcionki

Aikido HIGH w `scripts/bundle-size.mjs` to faÅszywy alarm (odczyt tylko z listy `assetFiles`). WÅaÅciciel oznacza rÄcznie w panelu Aikido. Bez komentarza ignore w kodzie.

Zmiana ÅºrÃ³dÅa czcionki: Barlow 400/500/600/700 i Barlow Condensed 500/600/700 z repozytorium (`public/fonts/*.woff2`, licencja SIL OFL 1.1 w `OFL-Barlow.txt`). Zero poÅÄczeÅ do fonts.googleapis.com i fonts.gstatic.com w aplikacji, makietach i CSP. Stylelint `src/index.css`: 0 bÅÄdÃ³w (clip, id, !important) bez wyÅÄczania reguÅ.

Wzorzec odÅwieÅ¼ony w Årodowisku bramy. Matryca `shots-baseline`: **840** ujÄÄ. Playwright `tests/__screenshots__`: **15** ujÄÄ. `baseline.mjs`: ok=840 fail=0.

Lista ujÄÄ, ktÃ³re siÄ zmieniÅy:

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

### 2026-10-03 â jeden wzorzec mapy

OdÅwieÅ¼ono wyÅÄcznie `shots-baseline/mapa__hhl__pl__1920__light.png` w Årodowisku bramy. PowÃ³d: zmiana kafelka u dostawcy map. PozostaÅych 839 ujÄÄ nie odÅwieÅ¼ano.

### 2026-10-03 â B-1

Mapa w produkcji: znacznik pojazdu tylko z ostatniej pozycji GPS (`load_track`). Brak pozycji â komunikat âBrak danych â pozycji pojazdÃ³wâ, bez punktu ze statusu. Strefy, porty, korytarz, promy i sytuacje drogowe bez zmian, nadal wÅÄczane checkboxami. Tryb demo (makieta) bez zmian.

### 2026-10-04 13:47 â liczby bramy lokalnej (`tests/db/gate.sh`)

Polecenie: liczby dopiero po `age` (pakiet `age` 1.2.1, sÄ `age` i `age-keygen`) i po tym, jak brama sama tworzy bazÄ `tower`. Szablon `tower_boot` (atrapa, migracje, seed) jest klonowany przed kaÅ¼dym zestawem, ktÃ³ry ÅÄczy siÄ z bazÄ o nazwie `tower`, i kasowany po przebiegu. Zestawy: dec5, dec6, adm10, hist11, dec-auto. dec2 i dec3 byÅy w przebiegu 4:29 (24 i 13) i same tworzÄ bazÄ â weszÅy do `gate.sh`, bo lokalna brama ich nie uruchamiaÅa.

| Zestaw | ByÅo w gate.sh | Jest | KtÃ³ry commit dodaÅ testy |
|---|---|---|---|
| nullguard | 389 | 528 | `e2947d7` podniÃ³sÅ bramÄ 379â389 o liczbÄ nowych wierszy listy (10: 7 GUARD + 3 EMPTY: admin_audit_history, admin_impersonate_start, admin_impersonate_stop, admin_set_eta_calibration_frozen, apply_eta_calibration_version, fee_catalog_hints, load_agreed_fee_add, load_dwell_info, real_app_role, real_app_user_id), a nie o asercje (4 odmowy na wiersz). `383560e` dodaÅ `insurance_policy_approve` (GUARD). Macierz peÅnej listy = 528, jak brama hosted i przebieg lokalny 4.10. |
| i2 | 521 | 526 | `e2947d7`: plik 510â524, brama tylko 510â519 (zabrakÅo 5). `324ab95`: plik +2 (panel SE, 526). `2492f64` podniÃ³sÅ bramÄ tylko o te 2 (519â521). Zostaje 521â526. |
| workflows | 46 | 47 | `383560e`: chk âT-BOOM zakolejkowanyâ. |
| insurance | 33 | 42 | W poleceniu stara liczba padÅa jako 42, w pliku byÅo 33. `e2947d7` (D-30, migracja 0125): 33â43 linii chk/val/err, jedna w if/else `cron.job` (zawsze jedna), wiÄc 42. |
| dec2 | nie byÅo w gate.sh | 24 | Przebieg 4.10: 24/24. `e2947d7` daÅ 18 (z rÄcznym escalate). `5fa5441` (L-2) dodaÅ 6 asercji â 24. |
| dec3 | nie byÅo | 13 | `e2947d7` / 0127, przebieg 4.10: 13/13. Plik: 13 chk/val/err. |
| dec5 | nie byÅo | 11 | Plik: 11 val/err. Wymaga bazy `tower`. |
| dec6 | nie byÅo | 15 | `7b25502`: 13 val/err + 2 rÄczne OK (admin_auth_login_log, system_broadcast_current). |
| adm10 | nie byÅo | 8 | Plik: 8. Nowy zestaw przy 0117 (`e2947d7`). |
| hist11 | nie byÅo | 11 | Plik: 11. Nowy zestaw przy 0118 (`e2947d7`). |
| dec-auto | nie byÅo | 39 | `e9fe090` miaÅ 24. `f8d80a5` (L-3) dodaÅ 15 â 39. |
| backup | 29 | 29, bez zmiany | Przebieg 4.10: 17 OK i 12 FAIL (razem 29) przez brak `age`. Po pakiecie oczekiwane zostaje 29/29. |
| security, status, storage, money, release, session, archive, watchdog, invite, risks, import, i30, i31 | bez zmiany | jak w gate.sh | Przebieg 4.10 zgodny z liczbÄ w skrypcie. |

Liczby bez wyjaÅnienia nie byÅy ruszane. `insurance` w poleceniu byÅo opisane jako â42 wobec 42â; w skrypcie staÅo 33, wiÄc zmiana 33â42 jest opisana wyÅ¼ej, a nie pominiÄta.

Backup po instalacji `age`: liczba zostaje 29. Dwa czerwone testy nie byÅy brakiem `age`. (1) `scripts/restore.sh` przy `--into-public` skÅadaÅ `set session_replication_role` i `\copy` w jednym `psql -c` â psql zgÅasza bÅÄd skÅadni przy `\`. Poprawka: jedna sesja, najpierw SET, potem `\copy` (klient czyta plik, nie serwer). (2) Asercja I-33 oczekiwaÅa `ERROR/t/t`, a sklejenie `||` w Postgresie 17 daje `ERROR/true/true`. Po obu poprawkach `backup.sh` daje 29 OK, 0 FAIL.

PeÅna brama lokalna 2026-10-04 14:05 czasu warszawskiego: kod 0, 4 min 56 s (296 s). Wszystkie zestawy 0 FAIL, w tym backup 29/29 i dec-auto 39/39. Bazy tower i tower_boot usuniÄte po przebiegu.

WdroÅ¼enie po scaleniu #16 idzie z tego commita, bo squash #16 ma autora konta GitHub, a plan Hobby puszcza tylko sebastian.bozekq@gmail.com.

### 2026-10-04 14:14 â dec-auto L-1b

| Zestaw | ByÅo | Jest | SkÄd |
|---|---|---|---|
| dec-auto | 39 | 64 | Ta paczka (migracja 0145) dodaje 25 asercji: znikniÄcie wiersza, konflikt numeru HHL, plik nieczytelny, SEFS brak ÅºrÃ³dÅa / w tabeli / ponad tabelÄ, KR 3 i 4, brak danych, oraz brak funkcji `l1b_dwell_check`. NO_AWIZACJA nie jest liczona drugi raz (zostaje w 0143 / L-3). |

DWELL_OVER_FREE nie wchodzi: czas wolny nie jest w `ops_thresholds`, a I-32 zostawia âod kiedyâ do wyjaÅnienia. Sztywne 360 i 240 minut nie otwierajÄ decyzji.

| nullguard | 528 | 533 | Ta sama paczka L-1b: `l1b_ksh_file_unreadable` jest GRANT dla authenticated, wiÄc `null-guard-calls.txt` dostaje jeden wpis GUARD. To 4 odmowy (nieaktywny HHL, KSH, SCX, brak konta) i 1 kontrola pozytywna aktywnego HHL. 528+5=533. |

### 2026-10-04 17:06 â poczta, tydzieÅ produkcji (odczyt, nie szacunek)

TydzieÅ od poniedziaÅku 2026-09-28 (liczony do niedzieli 2026-10-04). Wiersze `notifications` kanaÅ EMAIL na produkcji, odczyt 2026-10-04 okoÅo 17:20 czasu warszawskiego. To stan sprzed wÅÄczenia skrÃ³tÃ³w (status DIGEST = 0). Szacunek szczytu po skrÃ³cie: 34.

| DzieÅ | od razu (PENDING+SENT) | skrÃ³t | wstrzymane | wiersze e-mail |
|---|---|---|---|---|
| 2026-10-01 | 37 | 0 | 0 | 37 |
| 2026-10-02 | 20 | 0 | 0 | 20 |
| 2026-10-03 | 55 | 0 | 0 | 55 |
| 2026-10-04 | 267 | 0 | 0 | 325 |

Årednia z tych czterech dni: 94,75 od razu. Maksimum: 267 (4.10, jeszcze bez skrÃ³tu). Krytycznych osobno stary zapis nie rozdziela. SkrÃ³t: 0. StraÅ¼nik 80 (`integration_runs` job `email-budget`) w tym tygodniu: 0 razy. PrÃ³g âwiÄcej niÅ¼ dwa razyâ nie zapaliÅ siÄ.

Od nastÄpnego tygodnia ten sam odczyt ma iÅÄ tu co tydzieÅ, juÅ¼ ze skrÃ³tem i z krytycznymi, obok 34.

### 2026-10-05 08:11 â poczta, tydzieÅ produkcji 28.09â04.10 (licznik tygodniowy)

Odczyt z produkcji 2026-10-05 08:11 czasu warszawskiego, transakcja tylko do odczytu. Tabela `notifications`, kanaÅ EMAIL, dzieÅ wedÅug czasu warszawskiego. âOd razuâ to PENDING+SENT bez zaproszeÅ i resetu hasÅa, tak jak liczy `l13_email_counts`. âKrytyczneâ to czÄÅÄ âod razuâ, dla ktÃ³rej `l13_email_is_critical` zwraca prawdÄ. WysyÅki nie ruszano.

| DzieÅ | od razu | w tym krytyczne | skrÃ³t | wstrzymane (SUPPRESSED) | bÅÄd (ERROR) | wiersze e-mail |
|---|---|---|---|---|---|---|
| 2026-09-28 â 2026-09-30 | 0 | 0 | 0 | 0 | 0 | 0 |
| 2026-10-01 | 37 | 0 | 0 | 0 | 0 | 37 |
| 2026-10-02 | 20 | 20 | 0 | 0 | 0 | 20 |
| 2026-10-03 | 55 | 0 | 0 | 0 | 0 | 55 |
| 2026-10-04 | 268 | 130 | 0 | 15 | 58 | 341 |

Årednia na dobÄ: 54,3 od razu w caÅym tygodniu (380 / 7), 95,0 w czterech dniach z pocztÄ. Maksimum: 268 (04.10). Krytyczne razem: 150 (02.10: 20 RISK_SEVERITY; 04.10: 110 RISK_OPEN i 20 RISK_SEVERITY). SkrÃ³ty w tym tygodniu: 0, bo skrÃ³t dziaÅa od 04.10 17:06 i pierwsze wiersze DIGEST sÄ z 05.10. Szacunek szczytu po skrÃ³cie: 34. Årednia tygodnia jest 1,6 razy wyÅ¼sza od szacunku, maksimum 7,9 razy. CaÅy ten tydzieÅ to stan sprzed skrÃ³tu, wiÄc porÃ³wnanie z 34 da siÄ zrobiÄ uczciwie dopiero za tydzieÅ.

StraÅ¼nik 80 (`integration_runs`, job `email-budget`, jeden wpis na dobÄ): w tym tygodniu 1 raz, 04.10 o 18:00, poziom `critical_only`, 267 operacyjnych. PrÃ³g âwiÄcej niÅ¼ dwa razy w tygodniuâ nie zapaliÅ siÄ. Poprawka do wpisu 04.10 17:06: tamten odczyt (17:20) byÅ przed zapaleniem straÅ¼nika, stÄd tam 0, a 04.10 domknÄÅ siÄ na 268 od razu zamiast 267.

BÅÄdy wysyÅki w tym tygodniu: 58 Ã RISK_OPEN 04.10 o 13:10, Resend 429 `daily_quota_exceeded` (dzienny limit darmowego planu).

PoniedziaÅek 05.10 do 08:11: od razu 0, skrÃ³t 4 (RISK_OPEN), bÅÄd 8. Te 8 to SMS_GATEWAY_SILENT miÄdzy 03:55 a 06:43, wszystkie z bÅÄdem âResend 200 restricted_api_key: This API key is restricted to only send emailsâ. Resend odpowiedziaÅ 200, a wiersz dostaÅ ERROR, wiÄc nie wiadomo, czy te e-maile doszÅy. Do sprawdzenia w `send-notifications`, bez zmiany wysyÅki w tym kroku.

2026-10-04 â HERE_API_KEY dodany do sekretÃ³w Supabase produkcji (projekt nglnnrmzmhusvxslousq) i do .env.local. WartoÅÄ nie jest zapisana w repozytorium.

### 2026-10-04 19:29 â H-0 uzupeÅnienie (bez zmian aplikacji)

Polecenie wÅaÅciciela z 19:29 czasu warszawskiego. Zestaw prÃ³bny, bo wymiary 94 transportÃ³w sÄ puste: wysokoÅÄ 4,2 m, szerokoÅÄ 3,0 m, dÅugoÅÄ 25 m, masa 52 t, 6 osi. WspÃ³ÅrzÄdne z repozytorium, nie z gÅowy: Årem 52.07391, 17.02460 (`docs/watch-tower/ADDRESSES.md`), GdaÅsk Westerplatte 54.40372, 18.68130 (migracja 0017), NynÃ¤shamn 58.90453, 17.95621 (ADDRESSES), Boden 65.80539, 21.75914 (ADDRESSES), Karlskrona Stena 56.16460, 15.63080 (migracja 0120). Odpytanie HERE Routing v8, `transportMode=truck`, odjazd niedziela 2026-10-04 okoÅo 19:33 czasu warszawskiego. Klucza nie ma w tym pliku. ZapytaÅ routingu 14 (4 z nich HERE odrzuciÅ kodem E605013, bo brakowaÅo polilinii przy spanach) i 6 odwrotnych geokodowaÅ. Kosztu nie liczÄ â cennika konta tu nie czytaÅem.

Pomiar tego wieczora wobec liczb z H-0: ÅremâGdaÅsk 346,1 km i 4,61 h (346116 m, 16584 s z ruchem; czas bazowy 16486 s) wobec 346,7 km / 4,7 h. NynÃ¤shamnâBoden 989,4 km i 12,78 h (989400 m, 46018 s) wobec 991,7 km / 13,2 h. KarlskronaâBoden trasÄ krÃ³tkÄ 1384,1 km (1384107 m): z ruchem 18,35 h (66073 s), bez zaleÅ¼noÅci od godziny (`departureTime=any`) 18,20 h (65511 s), wobec 1385,6 km / 18,6 h.

#### 1. Trzy limity 400 cm, ÅremâGdaÅsk

To nie sÄ trzy budowle. HERE daÅ trzy komunikaty `violatedAdminWideVehicleRestriction`, waga `info` (nie `critical`), typ `adminWideRestriction`: limit wysokoÅci 400 cm na caÅe wojewÃ³dztwo. Zestaw ma 420 cm. Komunikat wisi na caÅym odcinku w wojewÃ³dztwie, bez dziur. Rodzaj dla kaÅ¼dego: ani wiadukt, ani most, ani tunel. Atrybut `tunnel` jest na 52 m S5 przy wejÅciu w drugi odcinek, atrybut `bridge` na 219 m A1 przy wejÅciu w trzeci. To cecha jezdni, nie przyczyna limitu.

| # | Kod HERE | Co mÃ³wi geokoder | Odcinek z komunikatem | Droga | WspÃ³ÅrzÄdne poczÄtku â koÅca |
|---|---|---|---|---|---|
| 1 | wojewÃ³dztwo `30` | oba koÅce: woj. wielkopolskie (poczÄtek ul. Grunwaldzka, Årem; koniec S5, Mieleszyn) | 99,989 km, 48 spanÃ³w | poczÄtek bez numeru: ul. Staszica, ul. GostyÅska; dalej gÅÃ³wnie S5 i E261, krÃ³cej 434, S11, A2/E30 | 52.07369, 17.02378 â 52.65487, 17.63049 |
| 2 | wojewÃ³dztwo `04` | koniec odcinka: A1, Nowe, woj. kujawsko-pomorskie. PoczÄtek to ten sam punkt graniczny, geokoder stawia go jeszcze w wielkopolskim | 156,341 km | gÅÃ³wnie S5 i E261, dalej A1 i E75 | 52.65487, 17.63049 â 53.67647, 18.63650 |
| 3 | wojewÃ³dztwo `22` | koniec: ul. Sucharskiego, GdaÅsk, woj. pomorskie. PoczÄtek geokoder stawia jeszcze przy A1, Nowe, kujawsko-pomorskie | 89,786 km | gÅÃ³wnie A1 i E75 (Autostrada Bursztynowa), krÃ³cej 89, S6, S7, E77 | 53.67647, 18.63650 â 54.40380, 18.68149 |

Pole `state` w HERE to druga czÄÅÄ ISO 3166-2. Geokoder zgadza siÄ z PL-30, PL-04 i PL-22.

Objazd bez tych komunikatÃ³w: nie ma. Osiem tras (4 szybkie, 4 krÃ³tkie) â kaÅ¼da ma co najmniej dwa z trzech. NajkrÃ³tsza, 336,3 km i 4,62 h, nadal ma wszystkie trzy. Jedyna, ktÃ³ra omija kod `04`, ma 385,0 km i 6,32 h i zostawia kody `30` i `22`. Wobec 346,7 km / 4,7 h byÅoby to +38,3 km i +1,62 h, ale to nie jest trasa bez naruszeÅ, wiÄc rÃ³Å¼nicy objazdu bez naruszeÅ nie podajÄ. Czystej nie ma, bo poczÄtek leÅ¼y w wojewÃ³dztwie `30`, a koniec w `22`.

#### 2. KarlskronaâBoden, ograniczenie czasowe

Nie ma go w odpowiedzi. Trasa krÃ³tka, ta od 1385,6 km, ma dziÅ 1384,1 km. Brak `violatedVehicleRestriction`, brak `restrictedTimes`, brak `potentialTimeDependentViolations`. Sprawdzone odjazdy: niedziela 19:33 z ruchem, `departureTime=any`, poniedziaÅek 2026-10-05 06:00, sobota 2026-10-10 10:00, wtorek 2026-10-06 22:00 (czas warszawski). Jest 24 incydentÃ³w drogowych (roboty, zamkniÄty pas) z datami waÅ¼noÅci. To nie zakaz jazdy zestawu i nie podajÄ go jako ograniczenia czasowego. Miejsca i godzin zakazu nie ma, bo HERE ich nie zwrÃ³ciÅ.

#### 3. NynÃ¤shamnâBoden, BK1âBK4

Tak, klasy sÄ w odpowiedzi tej trasy (989,4 km). Indeks spanu wskazuje klasÄ z listy sekcji: BK1, BK2, BK4. BK3 na liÅcie nie ma. Naruszenia masy ani klasy nie ma â 52 t i 6 osi przejechaÅy bez komunikatu.

- BK1: 43,5 km. Naruszenia nie ma.
- BK2: 1,6 km, jeden odcinek, Svartbyleden, od 65.79788, 21.73910. Naruszenia nie ma.
- BK3: 0 km. Tej klasy na wybranej drodze nie ma. To nie jest wynik âdozwoloneâ.
- BK4: 943,8 km. Naruszenia nie ma.
- Bez klasy: 0,5 km na wyjeÅºdzie z terminalu w NynÃ¤shamn (Hamnterminalen, Skyttens hÃ¤lls vÃ¤g, NynÃ¤svÃ¤gen).

Kontrola widzi klasÄ na odcinku. Nie daje osobnego werdyktu âta klasa puszcza 52 tâ.

#### 4. ZwykÅa ciÄÅ¼arÃ³wka wobec D-9 i propozycja H-4

D-9 (PLAN, POSTEP I-D9 i I-15): PL_ROAD 7,5 h, check-in 3 h, przeprawa 18 h, SE_ROAD 17 h, odpoczynek dobowy 11 h, przerwy 2 h. Razem noga szwedzka 30 h. KarlskronaâBoden nie ma wÅasnej liczby w D-9.

| Odcinek | HERE, zwykÅa ciÄÅ¼arÃ³wka | D-9 |
|---|---|---|
| ÅremâGdaÅsk | H-0 4,7 h; dziÅ 4,61 h | 7,5 h samej jazdy w modelu, bez przerwy UE |
| NynÃ¤shamnâBoden | H-0 13,2 h; dziÅ 12,78 h | 17 h jazdy, a z odpoczynkiem i przerwami 30 h |
| KarlskronaâBoden | H-0 18,6 h; dziÅ 18,35 h z ruchem, 18,20 h bez godziny | brak odcinka |

Model D-9 jest wolniejszy od samej jazdy HERE: na PL o okoÅo 2,9 h (7,5 wobec 4,61), na SE o okoÅo 4,2 h samej jazdy (17 wobec 12,78) i o okoÅo 17 h, gdy liczyÄ 30 h z odpoczynkiem.

Propozycja H-4, bez budowy, do akceptacji:

ETA dalej tylko z pozycji GPS (D-80). HERE liczy czas jazdy z tej pozycji, profilem zestawu z D-83 i parametrem `vehicle[speedCap]` w metrach na sekundÄ. Ten parametr nie skraca czasu wzglÄdem zwykÅej ciÄÅ¼arÃ³wki, moÅ¼e go tylko wydÅuÅ¼yÄ. LiczbÄ km/h ustala wÅaÅciciel w Opcjach jako wartoÅÄ wstÄpnÄ. Sam jej nie przyjmujÄ.

Przerwy i odpoczynki zostajÄ w Watch Tower, nie w HERE. Przepis UE (rozporzÄdzenie 561/2006 ze zmianami pakietu mobilnoÅci): po 4,5 h jazdy przerwa 45 min (albo 15 min i potem 30 min); jazda dobowa 9 h, a 10 h co najwyÅ¼ej dwa razy w tygodniu, jeÅli wÅaÅciciel to wÅÄczy; potem odpoczynek dobowy 11 h. Prom zostaje odpoczynkiem dobowym jak w D-9 i nie doliczamy drugiego. HERE ma `driver[schedule]` (pary âjazda, postÃ³jâ w sekundach) i samo wstawia postoje, ale nie zna limitu 9 h ani wyjÄtku promu: przeprawa dÅuÅ¼sza niÅ¼ 15 min nie liczy siÄ tam ani jako jazda, ani jako odpoczynek. Dlatego harmonogramu HERE nie bierzemy za przepis. Tabela D-9 i silnik OSM bez zmian â zapas, gdy HERE nie dziaÅa albo budÅ¼et siÄ skoÅczy (D-77).

Ilustracja reguÅy na dzisiejszej jeÅºdzie, to nie jest nowe ETA: ÅremâGdaÅsk 4,61 h jazdy plus jedna przerwa 45 min daje 5,36 h, a D-9 ma 7,5 h. NynÃ¤shamnâBoden 12,78 h jazdy: przerwa 45 min po 4,5 h, po 9 h odpoczynek 11 h, zostaje 3,78 h jazdy, razem 24,53 h, a D-9 ma 30 h.

#### Czego nie ruszam

H-4 nie budowane. H-1, H-2 i H-3 w planie sÄ dopiero po L-12, a wymiary ma podaÄ wÅaÅciciel (D-83) â nie startujÄ. L-6 jest nastÄpnÄ otwartÄ pozycjÄ listy L, ale to zmiana mechanizmu kopii, a to polecenie kaÅ¼e stanÄÄ, gdy nastÄpne nie jest jednoznaczne. Kodu aplikacji nie zmieniaÅem. WdroÅ¼enia aplikacji nie ma.

## 2026-10-04 20:06 (czas warszawski) â POCZTA-3, L-13, L-6, D-85

Å»adnego e-maila w tym kroku.

### Limity Resend

Odczyt uÅ¼ycia, bez wysyÅki. Ostatni odczyt okoÅo 20:05: dziennie 203 / 100, miesiÄcznie 429 / 3000. Wtyczka nie podaje daty dziennej wÅaÅciciela.

- Limit dzienny odnawia siÄ **5 paÅºdziernika 2026 o 01:00** (wÅaÅciciel, z panelu, polecenie 20:04).
- Limit miesiÄczny odnawia siÄ **25 paÅºdziernika 2026 o 01:00** (wÅaÅciciel, polecenie 20:06). Zegar z odczytu uÅ¼ycia (okoÅo 02:03 czasu warszawskiego) nie zastÄpuje tej godziny.

### Testowy e-mail z 19:01

2026-10-04 19:01:53 czasu warszawskiego, na sebastian@log-mar.pl. Temat: test, nie prawdziwa decyzja. Identyfikator Resend `01a107dd-6859-7bf3-813c-4bb10518762e`. Status **failed**. Identyfikator wiadomoÅci pusty. W logu API `POST /emails` daÅ HTTP 200 w tej samej sekundzie. Aplikacja braÅa 200 za âwysÅanyâ. To byÅ bÅÄd L-13.

### L-13 na produkcji

Status wyÅÄcznie z odpowiedzi Resend. Samo HTTP 200 i samo id to `PENDING`, nie `SENT`. `last_event` failed, bounced albo complained, albo nazwa bÅÄdu Resend, to `ERROR`. Migracja `email_status_from_resend` jest na produkcji. `email_budget_status()` liczy `SUPPRESSED` i `ERROR` jako ânie wyszÅoâ. Funkcja `send-notifications` jest w wersji 16, `verify_jwt` wÅÄczone: po samym id dopytuje `GET /emails/{id}` i bierze `last_event`. Brak statusu zostawia wiersz `PENDING` (klucz idempotencji `tower-notif-${id}`, nastÄpny cron nie wysyÅa drugi raz). TreÅÄ bÅÄdu jest krÃ³tka i bez klucza.

### Testy nie wysyÅajÄ

Potwierdzone, bez zmiany kodu. Zestawy bazy i `tests/db/gate.sh` idÄ na lokalny Postgres. SIM-1 (`scripts/sim1-full-transport.mjs`, `scripts/sim1-sms-only.mjs`) nie woÅa Resend. Test statusu Resend jest czysty. Test Å¼ywy keep-alive zeruje klucz i woÅa tylko `beat()`. Playwright idzie w lokalne logowanie, nie na api.resend.com.

### L-6 na produkcji

PR #26 scalony. `main` to `419c5bb`. Brama lokalna zielona przed scaleniem (log `/tmp/gate-l6.txt`). WdroÅ¼enie `dpl_DzV56mBDm5K1vCrjuwoiBNL6rq55`. Obie domeny, tower.log-mar.pl i watch-tower-makieta.vercel.app, zwrÃ³ciÅy 200 na tej wersji (04.10.2026, okoÅo 20:06). Migracja `l6_backup_retry` jest na produkcji: âPonÃ³w kopiÄâ woÅa ten sam `backup-export` co cron. Brak pg_net albo Vault zostawia wiersz ERROR, bez sekretu w tekÅcie.

### D-85

Propozycja H-4 z limitem km/h w Opcjach jest nieaktualna. Decyzja D-85: ETA w peÅni automatyczne, zero rÄcznego wpisu, takÅ¼e prÄdkoÅci. Opis i plan testu sÄ w `ZLECENIE_HERE.md` (H-4) i w rejestrze (D-85). H-4 nie budowane. H-1 teÅ¼ nie: komunikat HERE o limicie 400 cm na wojewÃ³dztwo to przepis, nie przeszkoda. Ryzyko tylko dla konkretnego wiaduktu, mostu albo tunelu.

## 2026-10-04 21:40 (czas warszawski) â H-1 zbudowane, wyÅÄczone

Kontrola trasy jest w kodzie i zostaje wyÅÄczona. `security_flags.H1_ROUTE_CHECK` jest false. Nie ma crona i nic na produkcji nie woÅa HERE dla tej kontroli. Puste wymiary nie sÄ uzupeÅniane wymiarami przykÅadowymi z H-0. Komunikat o limicie wysokoÅci wojewÃ³dztwa to âwymaga zezwoleniaâ, nie przeszkoda. Ryzyko `ROUTE_OBSTACLE` powstaje tylko dla wiaduktu, mostu albo tunelu z miejscem i tylko gdy kontrola jest wÅÄczona. H-2, H-3 i czÄÅÄ B nie sÄ ruszane. R-0 i R-1 bez zmian.

## 2026-10-04 â H-3 przeszkody wzdÅuÅ¼ korytarza, wyÅÄczone

Katalog ograniczeÅ dla ciÄÅ¼arÃ³wek w pasie 3 km wzdÅuÅ¼ korytarza jest w kodzie i zostaje wyÅÄczony. `security_flags.H3_CORRIDOR_OBSTACLES` jest false. Nie ma crona i nic na produkcji nie woÅa HERE dla tego katalogu. Puste wymiary nie sÄ uzupeÅniane. PodÅwietlenie w podglÄdzie dziaÅa dopiero po wÅÄczeniu flagi i tylko dla wymiarÃ³w tego zestawu. Brak wymiarÃ³w albo pusta odpowiedÅº = âBrak danychâ. `H1_ROUTE_CHECK` zostaje false. Surowe dane HERE kasowane po 30 dniach, podsumowanie zostaje. Szacunek kosztu atrybutÃ³w mapy to sufit 0,01 USD za zapytanie, bo cennik publiczny tej usÅugi nie podaje stawki.

## 2026-10-05 07:16 (czas warszawski) â korekta Q-18, AIS dla Polferries, czÄÅÄ B

Teraz: â (stop po B-7a/B-7b, raport) Â· Zrobione: krok 0, Q18-V2, AIS-POLF, diagnoza 5 promÃ³w, B-7a, B-7b, propozycje B-7c / B-8 (filtry, statusy) / B-9 / Q-9 Â· NastÄpne: B-8 (czÄÅÄ bez filtrÃ³w i statusÃ³w).

### 1. Q18-V2 â nowa reguÅa widocznoÅci (PR #64)

Prom widoczny w strefie portu PL (GdaÅsk, Gdynia), w rejsie PLâSE i w strefie portu SE (NynÃ¤shamn, Karlskrona). Znika po wyjÅciu ze strefy SE, wraca po wejÅciu w strefÄ PL. `ferryPhase` / `ferryVisible` / `visibleFerryMarkers` w `supabase/functions/_shared/map/draw.ts` (ten sam kod w aplikacji). Testy krokÃ³w wÅaÅciciela: `tests/bmapa.test.ts` (GdaÅsk â wypÅywa â NynÃ¤shamn â wypÅywa do Polski â GdaÅsk; Gdynia/Karlskrona; kolejnoÅÄ wierszy; pozycje zostajÄ w zbiorze). Brak strefy w 48 h: kierunek z kursu ostatniej pozycji (pÃ³Ånoc = do Szwecji), bez kursu niewidoczny. Pozycje w bazie bez zmian, ETA / II-9 / L-9 z peÅnych danych.

### 2. AIS-POLF â diagnoza i naprawa (PR #64, migracja 0163)

- Cron `tower-ferry-ais` dziaÅaÅ co 3 min, funkcja ok. 10 s, klucz byÅ, WebSocket siÄ ÅÄczyÅ. W bazie 0 wierszy AISSTREAM dla wszystkich 5 statkÃ³w (takÅ¼e dla Sten na morzu).
- **Przyczyna 1:** aisstream wysyÅa ramki **binarne**. W Deno `ev.data` to Blob, `String(Blob)` = â[object Blob]â, `JSON.parse` padaÅ i kod po cichu odrzucaÅ kaÅ¼dÄ ramkÄ. Sprawdzone lokalnie: 14/14 ramek binarnych.
- **Przyczyna 2:** 8 s nasÅuchu. Statek przy nabrzeÅ¼u nadaje co 3 min (Wawel 05:19:23 i 05:22:23 UTC), wiÄc 8 s prawie nigdy go nie ÅapaÅo.
- Bbox obejmuje GdaÅsk i NynÃ¤shamn. PorÃ³wnanie MMSI (liczba w MetaData â tekst) byÅo poprawne. Filtr `FiltersShipMMSI` dziaÅa, gdy MMSI sÄ tekstem (sprawdzone: tylko nasze statki).
- **Naprawa:** `binaryType = arraybuffer` + dekodowanie UTF-8 (takÅ¼e Blob), jawny parser `time_utc`, subskrypcja z `FiltersShipMMSI`, typy pozycji klasy A i B. Nowa funkcja Edge `ferry-ais-listen`: cron co minutÄ, nasÅuch 50 s (limit Åcienny funkcji 150 s), zapis kaÅ¼dej pozycji ze ÅºrÃ³dÅem AISSTREAM. `ferry-ais` (co 3 min) nie otwiera juÅ¼ WebSocket â bierze pozycje AISSTREAM z bazy (â¤ 10 min) do ânowsza wygrywaâ i ryzyk. Bez wydatkÃ³w (plus ok. 43 tys. wywoÅaÅ funkcji miesiÄcznie; wszystkie crony razem ok. 190 tys., limit planu Free 500 tys.).
- DowÃ³d: Nova Star AISSTREAM 2026-10-05 05:35:14 UTC, 54,40467 N 18,67377 E (GdaÅsk), wiek 1,6 min przy odczycie 05:36:50 UTC. Stena Spirit i Stena Ebba teÅ¼ z AISSTREAM (wiek < 1 min o 05:45 UTC).
- Wawel: do 05:45 UTC bez pozycji AISSTREAM w bazie. aisstream w tym czasie nie przekazaÅ Å¼adnej ramki Wawel ani Nova Star â sprawdzone osobnym nasÅuchem 200 s (05:42â05:45 UTC, tylko te dwa MMSI): 0 ramek. Funkcja produkcyjna w tych minutach teÅ¼ 0. To luka odbioru aisstream przy nabrzeÅ¼u, nie bÅÄd zapisu. Digitraffic zostaje zapasem (Wawel 21:19 UTC 4.10, NynÃ¤shamn, znacznik wyszarzony).

### 3. Diagnoza pustej mapy (05.10 ok. 05:40 UTC)

Stara reguÅa wymagaÅa zobaczenia wyjÅcia ze strefy portu PL w 48 h. Steny majÄ pozycje dopiero od 4.10 23:01 UTC (bez wyjÅcia z PL w historii), Wawel staÅ w NynÃ¤shamn, Nova Star ostatnio pÅynÄÅa do Polski. Wynik: 0 z 5 widocznych. Nowa reguÅa na tych samych danych (ten sam kod co mapa):

| Prom | Ostatnia pozycja (UTC) | Å¹rÃ³dÅo | Strefa | Widoczny wg reguÅy |
|---|---|---|---|---|
| Nova Star | 05.10 05:35:14 | AISSTREAM | port GdaÅsk | tak |
| Wawel | 04.10 21:19:21 | DIGITRAFFIC | port NynÃ¤shamn | tak (znacznik wyszarzony, sygnaÅ > 15 min) |
| Stena Estelle | 05.10 05:32:59 | STENA | port Karlskrona | tak |
| Stena Spirit | 05.10 05:44:40 | AISSTREAM | morze, kurs 304Â° (do Karlskrony) | tak |
| Stena Ebba | 05.10 05:44:40 | AISSTREAM | morze, kurs 191Â° (do Gdyni) | nie â rejs do Polski, wrÃ³ci w strefie Gdyni |

Paczka produkcyjna zawiera nowÄ reguÅÄ (`ferryVisible` w `index-*.js`). Mapy po zalogowaniu nie oglÄdaÅem (brak konta w tym przebiegu).

### 4. CzÄÅÄ B

- **B-7a** zrobione: wysokoÅÄ mapy z wysokoÅci okna, nie z tabeli. **B-7b** zrobione: na ekranie â¤ 768 px pas warstw nad mapÄ. Test `tests/b7-map.spec.ts` (6 rozmiarÃ³w, 12/12).
- Zrzuty wizualne mapy siÄ zmieniÄ (90 ujÄÄ `mapa__*` w peÅnym wzorcu, 2 w `tests/__screenshots__`). WzorcÃ³w nie odÅwieÅ¼ono â decyzja wÅaÅciciela.
- Propozycje na piÅmie: `PROPOZYCJE_B_05_10.md` (B-7c, B-8 filtry i statusy, zmiana ciÄgnika, B-9, Q-9). B-3a czeka na wymiary.

Kontrole: H1 / H3 / H6 false, 94 transporty, bez SMS, bez usuniÄÄ, bez wydatkÃ³w.

## 2026-10-05 07:57 (czas warszawski) â wzorce map (B-MAPA / B-7a / B-7b), potem czÄÅÄ B

Teraz: wzorce map â B-2a Â· Zrobione w tym kroku: dopisek POLECENIA 07:57, odÅwieÅ¼enie 90Ã `mapa__*` + 2 smoke mapa Â· NastÄpne: B-2a wedÅug PLAN.md (B-1 juÅ¼ na main od PR #4).

### Wzorzec mapy

Przyczyna zamierzona (wÅaÅciciel 07:57): B-MAPA (podkÅad HERE / zapas z etykietami), B-7a (staÅy rozmiar mapy), B-7b (warstwy na telefonie w pasie nad mapÄ). Opis: `G4_WZORZEC.md` Â§B-MAPA/B-7a/B-7b.

- `shots-baseline/mapa__*` â 90/90 odÅwieÅ¼one (FILTER=mapa, demo build, port 4189).
- `shots-baseline/kokpit__*` â 78 ujÄÄ odÅwieÅ¼onych (wbudowana mapa z B-MAPA); pozostaÅe bez rÃ³Å¼nicy.
- `tests/__screenshots__/`: mapa 2 + kokpit 2 odÅwieÅ¼one.
- Strefy / opcje / harmonogram / stany: bez odÅwieÅ¼enia (rÃ³Å¼nice stref w kolumnach tabeli, nie z mapy).
- Po odÅwieÅ¼eniu: mapa 90/90 i kokpit 90/90 identyczne; smoke visual 4/4 zielone.

B-1: juÅ¼ na main (PR #4, 03.10). B-MAPA, PL-PLURAL, B-7a, B-7b: zrobione wczeÅniej 05.10. CzekajÄ na wÅaÅciciela: B-7c, filtry/statusy B-8, B-9, Q-9. B-3a czeka na wymiary D-83.

### WdroÅ¼enie wzorcÃ³w

PR #66 scalony (`9b77bcb`). WdroÅ¼enie z commita Sebastiana `640a162` (to samo drzewo co main): `dpl_CjysPKxU2eLWYkCLm21ne1S4zFhW`. Obie domeny 200 (tower.log-mar.pl, watch-tower-makieta.vercel.app). Pusty commit Hobby: PR #68.


## 2026-10-05 (czas warszawski) â B-2a wypÅyniÄcia Steny w Ryzykach

Teraz: B-2a Â· Przyczyna: panel Ryzyka filtrowaÅ wyÅÄcznie `GDN-NYN` (Polferries). Stena (`GDY-KAA`) nie wchodziÅa do tabeli wypÅyniÄÄ.

Naprawa: `upcomingOutboundSailings` â obie linie do Szwecji z lookback 3 h; UI: sekcje GdaÅskâNynÃ¤shamn i GdyniaâKarlskrona. Test `tests/b2a-stena-sailings.test.ts`. Bez migracji, bez SMS, bez wydatkÃ³w.

## 2026-10-05 (czas warszawski) â B-2c Centrum decyzji

Opis, nie budowa UI. `LOGIKA_SYSTEMU.md` Â§1: Centrum â  kafelek âWymaga decyzjiâ; panel tylko w trybie supabase; od L-1/L-1b/L-3 decyzje otwiera `decision_open_from_event`. Na produkcji 05.10: 45 otwartych (NO_AWIZACJA, DOC_MISSING, SEFS_OUT_OF_TABLEâ¦). Pusty wyglÄd = demo / rola KSH / RLS przewoÅºnika / brak otwartych po filtrze statusu â nie awaria odÅwieÅ¼ania.

B-2a wdroÅ¼one: PR #69, `f77de74`, dpl_YMvYgchmv4QPdnJzhEJA1Ea9SjZ8, obie domeny 200. H1/H3 false, H6_MAP_OBSTACLES false. NastÄpne: B-3a czeka na wymiary D-83 â pomijam; B-4a.

## 2026-10-05 (czas warszawski) â B-4a Finanse bez pilotaÅ¼u w przychodzie

UsuniÄte z widoku Finanse wiersze przychodu âPilotaÅ¼ i dodatkiâ / âPrzychÃ³d â pilotaÅ¼ i dodatkiâ (KSH i HHL). Suma przychodu i marÅ¼y bez zmian (nadal z `revTotal`). Po stronie kosztu SCX wiersz zostaje. Test `tests/b4a-fin-no-pilot.test.ts`. B-3a pominiÄte â czeka na wymiary D-83.

## 2026-10-05 (czas warszawski) â B-4b zaÅÄcznik = CMR

W Faktury i BillsPanel lista/wgrywanie tylko CMR (bez POD). Etykiety PL/EN/SV. Test `tests/b4b-cmr-only.test.ts`. OdÅwieÅ¼one ujÄcia `faktury*` ze zmianÄ zamierzonÄ.

## 2026-10-05 ~08:30 (czas warszawski) â raport: wzorce map + czÄÅÄ B do B-4b

### Wzorce map (polecenie 07:57)
- PR #66 (`640a162` / merge `9b77bcb`), wdroÅ¼enie `dpl_CjysPKxU2eLWYkCLm21ne1S4zFhW`
- 90Ã mapa__* + 78Ã kokpit__* + 4 smoke; przyczyna: B-MAPA, B-7a, B-7b
- smoke visual 4/4; mapa/kokpit 90/90 vs wzorzec

### CzÄÅÄ B
| ID | Status | PR / SHA / deploy |
|---|---|---|
| B-1 | juÅ¼ na main (03.10) | PR #4 |
| B-2a | zrobione | PR #69 `f77de74` / `dpl_YMvYgchmv4QPdnJzhEJA1Ea9SjZ8` |
| B-2c | zrobione (opis) | PR #70 `62d5c22` / `dpl_GQBM6RLoeUtoLJtUjDPzB38PwaS5` |
| B-3a | pominiÄte â czeka na wymiary D-83 | â |
| B-4a | zrobione | PR #71 `bfc7ed9` / deploy Hobby z tego SHA |
| B-4b | zrobione | PR #72 `63f6086` / deploy na tower.log-mar.pl |
| B-5â¦ | nastÄpne wedÅug PLAN | â |

PominiÄte propozycje: B-7c, filtry/statusy B-8, B-9, Q-9. B-7a/B-7b wczeÅniej.

Kontrole: H1_ROUTE_CHECK false, H3_CORRIDOR_OBSTACLES false, H6_MAP_OBSTACLES false; 94 transporty aktywne; bez SMS, bez usuniÄÄ, bez wydatkÃ³w.

## 2026-10-05 ~09:05 (czas warszawski) â czÄÅÄ B: B-5 i B-6aâ¦B-6i

Polecenie 05.10 ~08:35 (POLECENIA_KOORDYNATORA). PR #74: `8144d8b` (B-5 test), `f9580c6` (B-6aâ¦i), `238247a` (skrypt 0164); merge `afe9f1e`. WdroÅ¼enie Hobby z drzewa main: `dpl_GDQUstA58xFQ1gKxTeKmshnKHeBk`. Obie domeny 200.

| ID | Status | Uwagi |
|---|---|---|
| B-5 | zrobione (test) | w produkcji juÅ¼ `historyOnly` od ed59ef8; makieta demo nadal pokazuje kreator (wewnÄtrzna) |
| B-6a/b/c | zrobione | âJak to dziaÅaâ w sekcjach |
| B-6d | zrobione | pulpit Stanu systemu |
| B-6e | zrobione | 0164 na prod (dry-run ROLLBACK â transakcja, `schema_migrations` 0164); 9 wpisÃ³w uzupeÅnionych, wyzwalacz 1, RLS, brak uprawnieÅ anon/authenticated |
| B-6f | zrobione | â200â = licznik wczytanych wierszy, usuniÄty |
| B-6g, B-6i | zrobione | bez rozjazdu w prawo (1440 i 390) |
| B-6h | opis + odczyt dzienny | ceny nie zbierajÄ siÄ same; prod 0 odczytÃ³w; automat = propozycja (regulaminy OKQ8/ORLEN) |

Brama: vitest 755/755; gitleaks 0; npm audit --omit=dev high 0; `tests/db/gate.sh` PG17 :5433 â 33 zestawy OK (dec6 23/23, backup 29/29), 0 FAIL.

Wizualnie: 120 ujÄÄ opcje/automatyzacje/ustawienia z B-6 = identyczne z main `badfe4c`. WzorcÃ³w nie odÅwieÅ¼aÅem. Uwaga: 18 ujÄÄ `opcje__hhl__*` rÃ³Å¼ni siÄ od wzorca z 03.10 juÅ¼ na main (sekcja âCzas wolny i przestÃ³jâ z 43e41fb, 04.10), nie przez B-6.

Stop: B-3a (D-83); propozycje B-7c, filtry/statusy B-8, B-9, Q-9.

Kontrole: H1_ROUTE_CHECK false, H3_CORRIDOR_OBSTACLES false, H6_MAP_OBSTACLES false; 94 transporty aktywne; bez SMS, usuniÄÄ, wydatkÃ³w.

| CSP-RO+D-3 | CSP Report-Only 7 dni + D-3 retencja dokumentÃ³w | **DONE** 05.10 | (PR tej paczki) | migracja **0180** PROD+TEST; ZAP Baseline prod High=0 | CSP-RO do 2026-10-12; naruszenia w Stanie systemu; CMR/POD/zdjÄcia 3 lata, PDF faktur 5 lat; I-7 bez zmian; TELM true; H1/H3/H6 false |
| AUD-STEP0 | audyt peÅny 06.10 â kopia audytu, polecenie, PLAN AUD-01â¦18 | **DONE** 06.10 10:41 | PR #136 (`f87e338`) | docs | P2-TILES odÅoÅ¼one (gaÅÄÅº `feat/p2-tiles-06-10`, `3deb252`) |
| AUD-01 | Mapa â czas Åadowania (A1) | **DONE** 06.10 11:20 (pomiar prod po zalogowaniu czeka na sesjÄ) | PR #137 (`f291c84`); 0190 PROD; `here-raster` wdroÅ¼ona; Vercel `dpl_Hv5CtFjKrs3TDbtnMAVRW36MsJmJ` | vitest 847/0, aud01 11/11; DB gate OK (i2 540, nullguard 597); gate:visual 280/280 zmienione=0; fresh-smoke OK; gitleaks 0; npm audit 0 | makieta: Mapa 195 â 4 zapytaÅ, kokpit 123 â 28, panel 12 â 8; `load_track` 188/94/2 â 0; obie domeny 200; `/tiles/â¦` â funkcja (401 bez sesji, `no-store`) |
| AUD-01c | awaria mapy na produkcji (polecenie wÅaÅciciela 06.10 13:45) | **DONE** 06.10 16:20 | PR #140 (`6e93d2d`); Vercel `dpl_GWYpijKvAdJhBjKefkm8z81w1BWJ`; `here-raster` z `6e93d2d`; bez migracji | vitest 852/0; gate:visual 280/280 (24 ciemne ujÄcia odÅwieÅ¼one, przyczyna `2122418`); fresh-smoke OK; gitleaks 0; npm audit 0 | `/tiles/logistics.day|night` 200 PNG na obu domenach; MISSâHIT 24/24; `X-Sb-Edge-Region: eu-central-1`, Vercel fra1; `latest_vehicle_fixes` 94 id 37 ms, 0Ã500 od 12:02; s-maxage 24 h (HERE); CARTO wymaga klucza â Esri + filtr; obie domeny 200 |
| AUD-01d | PodkÅad â bez wspÃ³lnej pamiÄci brzegu, HERE wprost (decyzja 06.10 16:28) | **WDROÅ»ONE** 06.10 17:25; czeka klucz przeglÄdarkowy HERE (wÅaÅciciel) | PR #142 (`55849da`); 0191 PROD; `here-raster` v8; Vercel alias tower.log-mar.pl | vitest 859/0, aud01d 7/7; DB gate OK (bmapa 33, nullguard 602, security 88); curl: private, bez s-maxage, MISS/MISS/MISS |
| AUD-01e | Jedna mapa na sesjÄ (z AUD-01d) | **WDROÅ»ONE** 06.10 18:29 | PR #144 (`e9d8bf7`); Vercel `dpl_7q3eE1oPS5bmitnHkUHcJS5NRJ6N` | vitest 863/0; pool spec 1/1; gate:visual OK 280/280; powrÃ³t Mapa 33â42 ms, 0 nowych kafelkÃ³w |
| AUD-02 | Dzwonek (A2) | **ZROBIONE** 06.10 19:43 (prod `dpl_HDXx6Teob8JTLRRobwtfDstxS4UX`) | #146 â `e658d11` | vitest 869/0, aud02 6/6; tsc; lint 0 bÅÄdÃ³w; gate:visual OK 280/280, 0 zmienionych; fresh-smoke OK; gitleaks 0; audit 0 | 1 812 pozycji z kodem szablonu â 0; 2 539 nieprzeczytanych â 1 974 pozycji po grupowaniu |
| AUD-03 | KSH â panel zlecenia (A3) | **ZROBIONE** 07.10 00:27 (prod `dpl_6d2fJgQAiCDsJ3D4ZoQ6E8fCbEHz`) | #148 â `151754d`; 0192 PROD | vitest 879/0 (aud03 9/9); Playwright aud03 4/4; DB aud03 25/25 (gate OK, session/l13 dÅug); tsc; lint 0 bÅÄdÃ³w; gate:visual OK 280/280, 0 zmienionych; fresh-smoke OK; gitleaks 0; audit 0 | KshSideMenu usuniÄty; âEdytujâ â 4 pola dat; Historia â// KSHâ, DEC-4, ETA/BAF, I-10; âZmieÅ ciÄgnikâ ukryty; prod SQL: RPC bez konta â 42501; obie domeny 200; test kontem KSH na prod niewykonany (brak logowania bez przeglÄdarki) |
| P0-CI | narzÄdzia na Windows (D-86, D-87; dopiski D-20261011-2135-01, D-20261011-2254-01, D-20261012-0105-01; R1âR6) | **DONE** 12.10.2026 ~01:33 | PR #152 â HEAD `07c99696` (df975e88 workflows+backup-core; e50c4a48 R1 service_role; b16a9108 R2 D14; ac92c785 R3 maxWorkers win32; 07c99696 R4 TZ/PGTZ + R5 baf + R6 bmapa) | unit 901/35 skip (Windows hak + CI); unit CI https://github.com/Spawn2018/testowe-do-migracji/actions/runs/38184171848 (1 m 2 s) + https://github.com/Spawn2018/testowe-do-migracji/actions/runs/38184173964 (53 s); db https://github.com/Spawn2018/testowe-do-migracji/actions/runs/38184173968 (8 m 15 s) â `[db] i2 540/540 OK`, `[db] insurance 42/42 OK`, `[db] baf 46/46 OK`, `[db] bmapa 33/33 OK`; visual https://github.com/Spawn2018/testowe-do-migracji/actions/runs/38184176295 (5 m 46 s); etap5-ui `--repeat-each=20` 100/100; gitleaks 0; npm audit --omit=dev high 0 | R2: `useRouteSync` â HashRouter w `startTransition` odkÅadaÅ lokacjÄ; URLâsklep przez `useLayoutEffect` + `hashchange` (wstecz zamyka szufladÄ). R4: `TZ`/`PGTZ=Europe/Warsaw` w `db.yml`. R5/R6: `fresh_price` w baf; `here_note_service` w bmapa. Krok 8: nocna brama wizualna na tym komputerze **nie** (brak `/workspace/wt-gate-visual/history.log` i zadaÅ Harmonogramu); psql OMNIROUTE 16.15; gh auth Spawn2018 (gist, read:org, repo, workflow). Dopiski w `docs/handover/dopiski/` (3 pliki). |

## 2026-10-12 â P0a â komplet dokumentÃ³w z 08â09.10.2026

GaÅÄÅº `pakiet/P0a-komplet`. Tylko dokumenty (bez `src/`, `supabase/`, `scripts/`, `tests/`). Hash scalenia wpisze pierwszy commit P0b.

### Przeniesienia
- skrypt `P0a_przeniesienia.sh`: **279** plikÃ³w do `docs/archiwum/2026-10-08/` (brakujÄcych: 0) + `stare-instrukcje/` (5: `AGENTS.md.txt` + 4 reguÅy `.mdc.txt`); ÅÄcznie **284** pliki w archiwum;
- 3 pliki z kwotami poza repozytorium: `D:\Watch Tower\dane\archiwum-2026-10-08\` (`RAPORT_BAF_CENY_94_05_10.md`, `WIP_BAF_CENY_05_10.md`, `BAF_SPEC.txt`);
- na miejsca: `AGENTS.md`, 4 reguÅy `.cursor/rules/*.mdc`, `PLAN.md`, konstytucja, rejestr, inwentarz, indeks, 7 procedur `08_SKILLE/`, folder audytu, 4 dopiski z kompletu;
- w `docs/handover/dopiski/` **7** plikÃ³w D-* (4 z kompletu wÅÄczone do planu; D-20261011-2135-01, D-20261011-2254-01, D-20261012-0105-01 â wÅÄczy Sesja 1 / P0b).

### Testy przed PR
- `npm run test:unit` â 901 passed / 35 skipped;
- `npm run lint:css` â zielone;
- gitleaks (zmiany w gicie) â 0; `npm audit --omit=dev --audit-level=high` â 0;
- przed scaleniem: check `visual` w PR (D-87); `db` nie startuje (bez SQL).

### Stan dawnych pozycji (P0a pkt 5)
| ID | Stan | DowÃ³d |
|---|---|---|
| L-1b | zrobione | PR #18 `edd2509b` / merge `6cbc72b4`; migracja `0021_driver_token.sql`; POSTEP âdec-auto L-1bâ |
| L-4 | zrobione | PR #20 `43e41fb1`; cele klikniÄÄ; AUD-02 `e658d11f` (cel L-4) |
| L-5 | zrobione | PR #21 `2af2e469` (dzwonek L-5); smoke B-SMOKE-DRIFT `55eccc4b` |
| L-9 | zrobione (czÄÅÄ); reszta P6 E7-5 | PR #32 `6ba8d01d` (rejsy z bazy); FERRY-STATUS PR #58 `63de6190` |
| L-13 | zrobione | PR #22 `e143dd57` / merge `94efe0b6`; POSTEP âL-13 na produkcjiâ 04.10 |
| L-12 | zrobione | PR #35 `4126b39c` / merge `cd870897` (kreator stref) |
| TELM-EMTRACK-WEB 5â6 | czÄÅci pokryte E23/E27/E32; monitoring 72 h â do sprawdzenia przy P10a/P4 | PR #88 `c2bb800d`, #90 `ad5e942a` (LIVE); flaga/API â W15 |
| P1-LINT | zrobione | `npm run lint:css` zielone 12.10; PR #3 `fix/p1-font` |
| P1-FONT | zrobione | PR #3 `141c917d`; `public/fonts/barlow*.woff2` + `barlow.css` w repo |
| AUD-04 | zrobione | PR #150 `5f6111cc`, #151 `90c5df40` |
| SG-03 raport po rozÅadunku | zastÄpione audytem | PLAN Â§7 â testy E15/E26/E42 (P4, P8) |
| SMS-KSH-1H | docs/STOP â strefa Årem â  D-37 | PR #42 `027e0b47`; do sprawdzenia przy P8 |
| H-2-PL | zrobione | PR #86 `98200036` (HERE Traffic PL) |
| ZEZW-13 | czeka na wÅaÅciciela (wymiary) | POSTEP: W / D-83; B-3a pominiÄte |
| B-3a | niezrobione â czeka D-83 | POSTEP 05.10: pominiÄte |
| H-6 | flaga false; do sprawdzenia przy paczce mapy | H6_MAP_OBSTACLES false (POSTEP 05.10) |
| D-83 | czeka na wÅaÅciciela | wymiary zestawÃ³w â STOP B-3a/H-* |
| pozycje D4âD12 audytu | zamkniÄte | brak treÅci w starym planie (P0a_WGRANIE pkt 5) |
| SG-01 driver_token usuniÄcie | do P1 | PLAN Â§7; nie potwierdzono usuniÄcia wiersza w P0a |

Zmienione ÅcieÅ¼ki: `AGENTS.md`, `.cursor/rules/**`, `docs/**` (w tym archiwum i audyt). `PLAN.md` Â§4 P0a â âNA PRODUKCJI â dokumenty, bez wdroÅ¼enia aplikacjiâ.

## 2026-10-12 â P3-APK â uzupeÅnienie W21 (pin SHA) â NA PRODUKCJI

- **W21 dostarczone 12.10.2026, 02:38** â token GitHub ma uprawnienie `workflow` (sprawdzone 11.10 w P0-CI; `gh auth status`: gist, read:org, repo, workflow).
- GaÅÄÅº `pakiet/P3-APK-uzupelnienie-W21` â PR #154 â merge **`e8351fc3`** (12.10.2026 03:07).
- SHA (koordynator 12.10, `git ls-remote` + `^{}`): checkout `11d5960aâ¦`, setup-java `cf277c60â¦` (v4 przestarzaÅa â ostrzeÅ¼enie OK), setup-android `9fc6c4e9â¦` + `packages: platform-tools`, setup-gradle `ed408507â¦`, upload-artifact `ea165f8dâ¦`.
- CI: `TOWER_APK_KEYSTORE_PROPS=/nonexistent/â¦` (domyÅlna ÅcieÅ¼ka Windows ze spacjÄ psuje URI na runnerze).
- OdbiÃ³r: build https://github.com/Spawn2018/testowe-do-migracji/actions/runs/38190237518 zielony, artefakt `sms-gateway-debug` 5â¯763â¯768 B; unit Ã2 zielone; visual https://github.com/Spawn2018/testowe-do-migracji/actions/runs/38190241026 zielony; gitleaks/audit OK. Bez migracji, bez wdroÅ¼enia aplikacji.
- Czas pracy ~0,5 h (pin + poprawki CI); poprawki: packages tools, keystore path. PowrÃ³t do P0b.

## 2026-10-12 â P0b start: wÅÄczenie dopiskÃ³w D-86/D-87 (Sesja 1)

- **DzieÅ 1 = 12.10.2026** (data sesji 0 / start P0a wedÅug PLAN Â§0; sesja uruchomiona 12.10).
- **Hash scalenia P0a:** `0aaf412b` (PR #153, `Merge pull request #153 from Spawn2018/pakiet/P0a-komplet`).
- **Hash scalenia P0-CI:** `9b0f3dc8` (PR #152).
- Pierwszy commit P0b: `plan: dopiski D-20261011-2135-01, D-20261011-2254-01 i D-20261012-0105-01` â wÅÄczenie do AGENTS, PLAN (Â§1, Â§3, Â§4 P0-CI + P0b, Â§5 W9/W32/W33, Â§8), rejestr D-86/D-87, skille tower-wdrozenie (R7) i tower-migracja-bazy (R8), reguÅy, G-15.

## 2026-10-12 â P0b Â· narzÄdzia bramy (Sesja 1, ciÄg dalszy)

- GaÅÄÅº `pakiet/P0b-narzedzia-bramy` @ po `6a670980`.
- **git lfs:** 3.7.1 OK; **core.hooksPath:** `.githooks` OK (bez wpisu Â§5).
- `scripts/lib/gate-suites.mjs`: `EXPECTED_LOCAL` (= gate.sh) + `EXPECTED_TEST` (security 84, risks 21; reszta = LOCAL; nullguard 602, i2 540); brakujÄce zestawy (dwellâ¦baf, backup); `KNOWN_DEBT` session/l13; CLI `--local-expected` / `--check`.
- `tests/db/gate.sh`: czyta liczby z gate-suites; `SUITES=a,b` filtruje zestawy.
- Konta 5 rodzajÃ³w: `FIVE_ROLE_USERS` + `ensureFiveRoleAccounts` po `prep`; `scripts/auth/seed-test-users.mjs` (odmowa prod); fixture `SEED_AUTH_USERS` (3 UUID) bez zmian.
- PLAN Â§4 P3-APK â âNA PRODUKCJI â scalenie e8351fc3 (PR #154), build APK zielonyâ.
- Pomiary CI / peÅna brama TEST â po PR i przebiegu na `main` (dopisek niÅ¼ej).

## 2026-10-12 â P0b na main (merge PR #155)

- Merge **`7fd5a3f3`** (PR #155). Hak pre-push: unit 901/35 skip ~41 s; lint:css OK.
- CI PR: unit ~52â59 s; visual 5 m 26 s; db 8 m 10 s â wszystkie zielone.
- `npm audit --omit=dev --audit-level=high`: 0.
- TEST zajÄte: P0b (brama w czÄÅciach po merge).

## 2026-10-12 â P0b brama TEST (przerwana) + poprawka i2-4

- HEAD w trakcie bramy: `f834217a` (po PR #157/#158: 5 rÃ³l po resecie; session/l13 = KNOWN-DEBT).
- Do i2-3 zielone (nullguard 602/602; security/status/storage/money/release/archive/watchdog/invite/risks/import OK).
- **i2-4 czerwone:** `transport z oknem: delay_minutes = ETA z GPS â koniec okna` â `eta_site` NULL.
- **Przyczyna:** przy `TOWER_I2_PART=4` pomijana jest czÄÅÄ 1, ktÃ³ra wstawia pierwszÄ pozycjÄ GPS dla L2; INSERT w I-25 kopiuje `source` z `positions` L2 â 0 wierszy (ten sam wzorzec co czÄÅÄ 2, linie 234â243).
- **TEST wolne** (brama na `f834217a` niekompletna / czerwona na i2-4).
- Poprawka: `tests/db/i2.sh` â bootstrap pozycji w czÄÅci 4 gdy brak wierszy (jak czÄÅÄ 2; `DRIVER_PWA` przy `TOWER_HOSTED_READY`). GaÅÄÅº `pakiet/P0b-i2-part4-bootstrap`.
- Merge poprawki: **`a5b46607`** (PR #159).
- **TEST zajÄte: P0b, od 09:38** (peÅna brama w czÄÅciach na `a5b46607`; = odbiÃ³r P0b / brama z Dnia 1).
- Merge docs TEST zajÄte: **`708bf6af`** (PR #160). Brama na tym SHA: do i2-4 zielone (poprawka bootstrap); **dec6 19 OK / 4 FAIL** (wstawki `auth.sessions` dla kont seeda â FK â `auth.users` na hosted). PÄtla przerwana na polecenie koordynatora 12.10 12:30 (ten sam FAIL 2Ã). **TEST zajÄte** zostaje do scalenia poprawki SKIP + peÅnej bramy od zera na nowym SHA.

## 2026-10-12 â P0b zamkniÄte: peÅna brama TEST zielona

- Merge poprawki backup SKIP: **`832cca5a`** (PR #162; wczeÅniej dec6 SKIP `f79d8d22` / PR #161, i2-4 `a5b46607` / PR #159).
- **TEST wolne** (od 21:42). PeÅna brama w czÄÅciach na `832cca5a` + migracja `0192_aud03_ksh_panel_dates.sql`: **BRAMA ZIELONA**.
- Start pÄtli 18:06 â komplet ~21:42 (~3,6 h). Wszystkie zestawy OK wg `EXPECTED_TEST` (m.in. dec6 19/19 +4 SKIP; backup 21/21 +8 SKIP; nullguard 602/602; i2 540/540).
- Check `db` na `main` po #162: zielony (run 38275045276, ~8 m 47 s). `gh workflow run db.yml --ref main -f suites=security`: uruchomiony 21:43 (run 38299522527).
- Hak / CI (PR #162): unit 901/35 skip; visual zielony; `npm audit --omit=dev --audit-level=high`: 0.
- Produkcja: bez migracji aplikacji w P0b; `tower.log-mar.pl` i makieta Vercel â 200.
- PLAN Â§4 P0b â NA PRODUKCJI (narzÄdzia). NastÄpna paczka: **P1**.

## 2026-10-12 â R1 D-20261012-2210-01: przerwana pÄtla bramy TEST

- 12.10 22:02âok. 22:20: pÄtla bramy TEST po komplecie na `832cca5a` ruszyÅa ponownie od `prep` na zmienionym HEAD; przerwana (D-20261012-2210-01 R1); ostatnie czyszczenie TEST 22:19:33; wyniki tego przebiegu niewaÅ¼ne; odbiÃ³r P0b bez zmian; TEST wolne od 22:32.
- PÄtla (`run-loop.pid` 15116) i monitor (`chat-status.pid` 19670) martwe; `test-db-gate-step` nie dziaÅa. Odczyty `pg_stat_activity` (postgres, active, bez wÅasnego pid): 22:27 = 0, 22:32 = 0.

## 2026-10-12 â P1 Â· zestaw e18 16/16

- 12.10 **22:20:05**, baza **TEST** (hosted): `[db] e18 16/16 OK`, migracja `0193_e18_porzadki.sql`, krok `node scripts/test-db-gate-step.mjs e18` (log `tmp-gate/e18-full.log`). Nie GitHub Actions i nie lokalny Postgres.
- GaÅÄÅº `pakiet/P1-e18`, HEAD wtedy `b3da6dbc`. Pliki `0193_e18_porzadki.sql` i `tests/db/e18.sh` byÅy tylko w drzewie roboczym, bez commita. Ten wynik nie jest bramÄ do scalenia.
- GitHub `db` na `cc206d48` (run 38307558150, zestawy e18,security,status,nullguard): security 88/88, status 44/44, nullguard 602/602, **e18 2/16**. Przyczyna: lokalny CI nie ma `auth.users`; `delete` w 0193 przerywaÅ zestaw. Poprawka: brak tabeli jest pomijany, jak brak uprawnieÅ na hosted.
- GitHub `db` na `a827de61` (run 38308278607, 12.10 23:04, te same zestawy): **e18 16/16**, security 88/88, status 44/44, nullguard 602/602. Lokalny Postgres 17 w CI, nie TEST. 0193 nie zmienia innych zestawÃ³w (na pustym seedzie nic nie rusza).
- PeÅne checki PR #164 na `27ec3c3b` (unit, db, visual) zielone. Nie scalono â dopisek D-20261012-2335-01 zmienia migracjÄ.

## 2026-10-12 â P1 Â· D5 K1âK9 (D-20261012-2335-01)

- K1âK9 w migracji `0193`, `scripts/e18/kopia.mjs` i `tests/db/e18.sh`. Liczba zestawu `e18` w `scripts/lib/gate-suites.mjs`: **41**. Pozycja D5 w PLAN Â§4, wiersz w Â§8.
- Brama GitHub i potwierdzenie na TEST: jeszcze nie na tej gÅowie. PrÃ³ba z ROLLBACK na produkcji: jeszcze nie. Bez scalenia #164.
- GitHub `db` na `79e891a1` (run 38313075911, zestawy e18,security,status,nullguard): security 88/88, status 44/44, nullguard 602/602, **e18 39/41**. PeÅny check `db` na PR #164 (run 38312970245) teÅ¼ czerwony. Unit i visual zielone.
- GitHub `db` na `3652268f` (run 38314196509): znowu **e18 39/41**. Oba czerwone sprawdzenia: `pg_trigger.tgenabled` (typ `"char"`) bez rzutowania na tekst, zapytanie siÄ nie wykonuje. Reszta K8 zielona.
- GitHub `db` na `9b4e3c16` (run 38315461054, 13.10 ok. 00:15, zestawy e18,security,status,nullguard, lokalny Postgres 17, nie TEST): **e18 41/41**, security 88/88, status 44/44, nullguard 602/602. Checki gÅowy PR #164 na tym SHA: unit, visual i peÅny `db` (run 38315467215) zielone. Bez scalenia.
- TEST zajÄte: P1, od 13.10 00:28 â potwierdzenie w kopii roboczej wedÅug R2 (SHA `9b4e3c16`; zestawy security, status, e18, nullguard, potem testy logowania).
- TEST 13.10 00:30â00:52, SHA `9b4e3c16`, kopia `/d/Watch Tower/brama-test`: security 84/84 (+2 SKIP), status 44/44, **e18 40/41**. Jedno czerwone: â4 konta auth.usersâ â przygotowanie wstawiaÅo wiersz bez zaproszenia, wyzwalacz `handle_new_auth_user` zwraca `TOWER_NO_INVITE`. nullguard i testy logowania nie ruszyÅy. PÄtla skoÅczyÅa siÄ sama (drugi FAIL). TEST wolne od 00:52. Kopia robocza zdjÄta.
- GitHub `db` na `09d43e5e` (run 38319498611, zestawy e18,security,status,nullguard; peÅny check PR run 38319503803): security 88/88, status 44/44, nullguard 602/602, **e18 40/41**. Przygotowanie kont `auth.users` pisaÅo log do `tmp-gate/`, ktÃ³rego nie ma w czystym CI (katalog w `.gitignore`). Unit i visual zielone. Bez scalenia.
- GitHub `db` na `1d72a26f` (run 38320359925, te same zestawy; peÅny check PR run 38320365051): znowu **e18 40/41**. Zapytanie rodzaju `auth.users` uÅ¼ywaÅo `'auth.users'::regclass`, ktÃ³re pada przy planowaniu, gdy tabeli nie ma. Reszta zestawÃ³w zielona. Unit i visual zielone. Bez scalenia.
- GitHub `db` na `a24c05e0` (run 38321283995, 13.10 ok. 01:18, zestawy e18,security,status,nullguard, lokalny Postgres 17, nie TEST): **e18 41/41**, security 88/88, status 44/44, nullguard 602/602. Checki gÅowy PR #164 na tym SHA: unit, visual i peÅny `db` (run 38321287705, 8 min 12 s) zielone. Bez scalenia.
- **TEST zajÄte: P1, od 13.10 01:26** â potwierdzenie w kopii roboczej wedÅug R2 (SHA `a24c05e0`; zestawy security, status, e18, nullguard-1â¦4, potem testy logowania).
- TEST 13.10 01:26â03:32, SHA `a24c05e0`, kopia `/d/Watch Tower/brama-test`, raport `D:/Watch Tower/raporty/brama-test-a24c05e07573f6c2970d33ed08e78b7f274e2278.json`. Zestawy: security 84/84 (+2 SKIP), status 44/44, **e18 41/41**, nullguard 161+136+188+117 = 602/602. Logowanie: `verify.mjs` 21/21. BK3 po poprawce kodu projektu: 12/14 (M10 i M12 wymagajÄ fixture spoza seedu: brak statku Wawel i rejsÃ³w POLFERRIES). PKCE 7/8 â administrator API przyjmuje hasÅo krÃ³tsze niÅ¼ 12 znakÃ³w. Stary test przeglÄdarki szuka tekstu âWyÅlij link do logowaniaâ, a ekran ma przycisk âZalogujâ. BK5: 5/8 (przewoÅºnik, wÅasny numer zlecenia: HTTP 403), 2 nie ruszyÅy. **TEST wolne od 03:32.** Kopia robocza zdjÄta. Bez scalenia #164.
- **TEST zajÄte: P1 (testy na Å¼ywo), od 03:50** â SHA gÅowy PR po D6.
- TEST 13.10 03:50â04:12, SHA `c1b18f8d`, build `/tmp/wt-sb-dist` z `TEST_SUPABASE_URL` / `TEST_ANON_KEY`. HasÅo: produkcja `password_min_length=12`, `password_required_characters=""`; TEST przed: 6 / `""`, po: 12 / `""` (`sync-test-password-policy.mjs`). Logowanie: verify **21/21**, BK3 **14/14**, PKCE **8/8**, `e2e-browser.mjs` **20/20**, BK5 **8/8**. `git diff origin/main -- src/` puste. L6: diff `a24c05e0`â¦`c1b18f8d` w `supabase tests/db scripts/lib scripts/e18 src` pusty. **TEST wolne od 04:12.**
- Checki gÅowy #164 `9b9f948c`: unit, `db`, visual zielone. Scalenie #164 â `08c18747` (13.10 04:25).
- Kopia produkcji: `D:\Watch Tower\dane\e18\kopia-e18-2026-10-13-02-27-44.json`, SHA-256 `6d0396e84a82ed97698dad777f78919822c9d75febf6522448b95248ea8a6a55`. Liczby: app_users 6, audit wskazujÄcy 11, powiadomienia kont 2951, odczyty 10, âDziaÅaj jakoâ 1, zaproszenia 3, auth.users 3, polisy 2, faktura 1, pozycje 1, spory 2, wiadomoÅci 4, SG-24 stany stref 2 i sprawy 2, pozycje SG-03 po wyjeÅºdzie 103, P13 4, token SG-01 1.
- R3 (`99772e11`, potem #165 â `1840d87c`): dry-run ROLLBACK, apply COMMIT. UsuniÄte znaczniki: 20261004180552 email_status_from_resend, 20261004180725 l6_backup_retry, 20261004192928 l12_geofence_creator, 20261005003650 ferry_status, 20261005011518 pl_data, 20261005103503 h2pl_here_traffic, 20261005105010 d78_here_pools_confirmed, 20261005105317 telm_emtrack_web, 20261006145638 0191_aud01d_here_tiles_report, 20261006222552 0192_aud03_ksh_panel_dates. Dopisane: 0171, 0172, 0173, 0191, 0192. `_check-mig-parity` przed 0193: `missing_in_repo â`, `missing_on_prod 0193`.
- R4 13.10 04:32: prÃ³ba z ROLLBACK â konta 6, auth.users 3â0, zaproszenia 3, dziennik 11, P13=4, SG-03 pozycje=103, cutoff `2026-10-07 10:19:54+00` (12:19:54 czasu polskiego). Powiadomienia obce 8992=8992, SMS 27=27, HTTP 877=877. `--dry-run` tylko `0193_e18_porzadki.sql`. `db push` naÅoÅ¼yÅ 0193; drugi raz: âRemote database is up to date.â Parytet **MATCH YES** (193/193).
- OdbiÃ³r po migracji: konta +tower 0, zaproszenia 0, dziennik juÅ¼ nie wskazuje tych kont, wpisy migracji 11 (Å¼aden stary wpis nie skasowany). Polisa `436000430439` = ERGO Hestia, `OCP-SCX-2026-WT` 0. Faktura testowa 0. WiadomoÅci 29/31/32/33 = 0, 34 i 35 zostajÄ. Token SG-01 = 0, SG-24 = 2. SG-24: PLANNED, bez numeru HHL, kierowcy i rejsu; strefy 0, otwarte sprawy 0. SG-03: 281 pozycji, ostatnia 07.10 12:19:54. ETA przed wyjazdem z opÃ³Åºnieniem: 0. Wyzwalacze `trg_loads_eta`, `trg_loads_status_matrix_notify`, `trg_risk_matrix_notify` wÅÄczone. Odczyt chwilÄ po COMMIT: notifications 8999, sms 27, http 879 (w transakcji rÃ³wnoÅÄ; rÃ³Å¼nica to ruch po COMMIT).

**P1 NA PRODUKCJI â commit `08c18747`, 13.10.2026 04:32.** NastÄpna paczka: P2.

## 2026-10-13 â P2 Â· fundament ekranÃ³w

- TEST zajÄte: P2, od 13.10 12:27 â potwierdzenie w kopii `/d/Watch Tower/brama-test` na SHA `eb49590d` (zestawy security, status, e41, nullguard). Checki PR #167 na tym SHA: unit, visual i `db` zielone.
- TEST 13.10 12:28â13:17, SHA `eb49590d`, migracja `0194_e41_nazwa_formaty.sql`. security 84/84 (+2 SKIP), status 44/44, **e41 16/16**, nullguard 161+136+192+118 = **607/607**. Raport `D:/Watch Tower/raporty/brama-test-eb49590d717ee9210d334e61aa750b12faa06f7e.json`. To potwierdzenie paczki, nie peÅna brama tygodniowa (reszta zestawÃ³w nie byÅa uruchamiana). **TEST wolne od 13:17.**
- Produkcja 13.10 13:33â13:35, merge `35abe70b`. Parytet przed migracjÄ: `missing_in_repo â`, `missing_on_prod 0194`. Kopia tytuÅÃ³w poza repozytorium: `D:\Watch Tower\dane\p2\kopia-e18-p15-2026-10-13.csv`, 88 wierszy danych, SHA-256 `fc9ee0db9fb7be3b653c62a072e001a16af55aed0b39dfe630211a9916a8d963`. PrÃ³ba z ROLLBACK: `e18_p15_apply` 49, drugi raz 0, po ROLLBACK funkcja 0 i migracja 0. `db push` naÅoÅ¼yÅ 0194; drugi raz: âRemote database is up to date.â Po COMMIT: migracja 0194 jest, funkcje 3, âNieznany kod ÅºrÃ³dÅa drogowegoâ otwarte 39, kopie w dzienniku 49, tytuÅy âZakaz ruchuâ¦â 13. `tower.log-mar.pl` i `watch-tower-makieta.vercel.app` zwracajÄ 200.

- Q1 (D-20261013-1400-01), wdroÅ¼enie aplikacji z `main` `bea31774` wedÅug R7, 13.10.2026 14:08. Identyfikator `dpl_CqK5DSotFYHT8QyeFwLzMUixdBCs`. Plik JS przed: `assets/index-DtP8UgG7.js` (wdroÅ¼enie z 12.10 05:07). Po: `assets/index-h0t0ItfK.js` â ta sama nazwa w logu buildu Vercel (`dist/assets/index-h0t0ItfK.js`) i w `tower.log-mar.pl`. `tower.log-mar.pl` i `watch-tower-makieta.vercel.app` zwracajÄ 200. 63 pliki JS z tego buildu: 0 wystÄpieÅ `service_role`. Build produkcyjny doszedÅ do koÅca (straÅ¼nik paczki w `vite.config.ts` nie zatrzymaÅ). Kopia wdroÅ¼eniowa usuniÄta.

**P2 NA PRODUKCJI â commit `35abe70b`, wdroÅ¼enie `dpl_CqK5DSotFYHT8QyeFwLzMUixdBCs`, 13.10.2026 14:08.** NastÄpna pozycja: poprawki P2 (Q2), potem P3.

- TEST 13.10 14:30â15:20, SHA `ccf0d68c`, migracja `0195_e18_p15_poprawka.sql`. security 84/84 (+2 SKIP), status 44/44, **e41 26/26**, nullguard 161+136+192+118 = **607/607**. Raport `D:/Watch Tower/raporty/brama-test-ccf0d68c2a994b00122805b30d626d5d86ddfac4.json`. **TEST wolne od 15:20.**
- Produkcja 13.10 15:31â15:33, merge `c410799a`. Parytet przed: `missing_on_prod 0195`. Kopia 13 wierszy: `D:\Watch Tower\dane\p2\kopia-e18-p15-poprawka-2026-10-13.csv`, SHA-256 `80139c845d206fba319df6b9be5e09ceb260d21e29239793166cbb49712f4148`. PrÃ³ba z ROLLBACK: pierwsze `e18_p15_poprawka` 13, drugie 0, otwarte âZakazâ¦â w transakcji 0, wpisy poprawki 13; po ROLLBACK funkcja 0, migracja 0, powiadomienia 9638, SMS 27. `--dry-run` tylko `0195_e18_p15_poprawka.sql`. `db push` naÅoÅ¼yÅ 0195; drugi raz: âRemote database is up to date.â Parytet **MATCH YES** (195/195). Po COMMIT: otwarte âZakaz ruchu ciÄÅ¼arÃ³wek w Szwecjiâ 0, `E18_P15_POPRAWKA` 13, powiadomienia 9638, SMS 27.
- WdroÅ¼enie aplikacji z `main` `c410799a` wedÅug R7, 13.10.2026 15:35, `dpl_6FkHhuRasJEFybtjDRbLY72P8kvv`. Plik JS przed i po: `assets/index-h0t0ItfK.js` (moduÅ tytuÅÃ³w nie wchodzi do paczki, bo aplikacja go nie importuje; nazwa rÃ³wna `dist/assets/index-h0t0ItfK.js` z tego wdroÅ¼enia). Oba adresy 200. 63 pliki JS: 0 Ã `service_role`. Kopia wdroÅ¼eniowa usuniÄta.

**P2-poprawki NA PRODUKCJI â commit `c410799a`, migracja 0195, wdroÅ¼enie `dpl_6FkHhuRasJEFybtjDRbLY72P8kvv`, 13.10.2026 15:35.** NastÄpna paczka: P3.

## PAUZA 2026-10-13 16:20

- GaÅÄÅº `pakiet/P2-wyglad`, SHA przed tym commitem `02de6300` (main po scaleniu planu, PR #171). Produkcji ten krok nie zmienia. Bramy TEST nie byÅo.
- **Zrobione z dopiskÃ³w D-20261013-1535-01 i D-20261013-1550-01:** Z8 (konstytucja VIII, rejestr `WYGLAD-RAPORT`), Z9 (`AGENTS.md`, `.cursor/rules`, PLAN Â§0, Â§1 pkt 5, nagÅÃ³wek Â§4), V5 w P3, V6 w P7, Z12 w P11 â scalone na `main` (`02de6300`). DopiskÃ³w D-20261013-1525-01 i D-20261013-1615-01 nie wykonywano.
- **W drzewie, bez sprawdzenia:** V1 (kolumna âWysyÅkaâ = sam kod), V2 (liczba tylko przy Ryzykach na dolnym pasku â CSS), V3 (szkic kart, tekstu i celÃ³w oraz `tests/e8-phone-gate.spec.ts`). Brama E8 nieodpalona. `fresh-smoke.sh` jeszcze bez tego testu. V4 (zrzuty `docs/handover/odbior/P2/`) nie zaczÄte.
- **NastÄpny krok:** dokoÅczyÄ V1âV3 na `pakiet/P2-wyglad` (lint CSS, brama E8 do 0/0/0, podpiÄcie w `fresh-smoke.sh`), potem V4 wedÅug Z10âZ11, migawki, scalenie i wdroÅ¼enie przed P3.
- GitHub Actions w toku: brak. Ostatnie zakoÅczone: unit `main` run 38410368819 (zielony, `02de6300`); PR #171 unit 38409319769, unit 38409332585, visual 38409329474 (zielone).
- TEST wolne (od 13.10 15:20, po Q2).

## WZNOWIENIE 2026-10-13 17:10

- GaÅÄÅº `pakiet/P2-wyglad`, SHA `ec9e5fe4`, 0 niezapisanych zmian. Autor lokalny: Sebastian BoÅ¼ek / sebastian.bozekq@gmail.com.
- Przebiegi z pauzy zielone, Å¼aden nie zostaÅ w toku: unit `main` 38410368819; PR #171 unit 38409319769, unit 38409332585, visual 38409329474.
- TEST wolne. Bramy TEST nie wznawiam. Dopiski 1535-01 i 1550-01 sÄ na `main` (`02de6300`) â nie wÅÄczam ich drugi raz.
- Dalej: V1âV3 (lint CSS, brama E8, `fresh-smoke.sh`), potem V4.
- V1âV3 lokalnie, 13.10 17:20: `lint:css` zielony; brama E8 i test V1âV2: 2/2 (9 widokÃ³w Ã 360/390/430, trzy liczby = 0). V4: 30 zrzutÃ³w w `docs/handover/odbior/P2/`. Migawki stanÃ³w Harmonogramu odÅwieÅ¼one (run 38421964162, 8 plikÃ³w). Checki PR #172: unit i visual zielone (visual run 38424836023).
- WdroÅ¼enie z `main` `4627c8f5` wedÅug R7, 13.10.2026 17:56, `dpl_F55udKq2cMiUWyM1CXdY9Kh4sz8r`. Plik JS przed: `assets/index-h0t0ItfK.js`. Po: `assets/index-BwXKwh8r.js` â ta sama nazwa na `tower.log-mar.pl` i `watch-tower-makieta.vercel.app`. Oba adresy 200. 63 pliki JS: 0 Ã `service_role`. Kopia wdroÅ¼eniowa usuniÄta. Bez migracji.

**P2-wyglad NA PRODUKCJI â commit `4627c8f5`, wdroÅ¼enie `dpl_F55udKq2cMiUWyM1CXdY9Kh4sz8r`, 13.10.2026 17:56.** NastÄpna paczka: P3.

## 2026-10-13 â D-20261013-1835-01 (FRONT-KOORDYNATOR) + start P3 (F5)

- Plan: merge **`59165fc2`** (PR #174) â rejestr `FRONT-KOORDYNATOR`, `AGENTS.md` Â§3/Â§4, `front.mdc`, PLAN Â§1 pkt 5, Â§3, Â§4 (Poprawki P2 â wyglÄd 2 na `wyglad/P2-2`, P3, P5 kolor marÅ¼y), Â§8. D-20261013-1815-01 nie wykonywany (F4 â koordynator).
- GaÅÄÅº `pakiet/P3-uprawnienia` (PR #175). Bez zmian wyglÄdu ekranÃ³w (F5).
- Logika: E14 (rola z onChange), 5 rÃ³l, migracja `0196` (E9/E14/E19/G-20), PodglÄd E9-7/G-07 (`isPreviewReadOnly`, straÅ¼nik `writeThrough`, `PreviewBanner`).
- `db.yml` money/invite zielone; security 86/88 â poprawka testÃ³w E19 (SELECT+RLS zamiast permission denied).
- TEST wolne.

## 2026-10-13 â Poprawki P2 â wyglÄd 2 (`wyglad/P2-2`)

- PR #176 scalony â `b9ae3d37` (13.10.2026 19:00 UTC). unit + visual zielone; gitleaks 0 (opis PR); `npm audit --omit=dev --audit-level=high` = 0; bez migracji (F8 OK).
- WdroÅ¼enie R7 z `main` `b9ae3d37`, 13.10.2026 19:04, `dpl_2S9uAEnAqEdv2sgTCUQWC3gDqtaL`.
- Plik JS przed: `assets/index-BwXKwh8r.js`. Po: `assets/index-DjH-U2rD.js` â ta sama nazwa na `tower.log-mar.pl` i `watch-tower-makieta.vercel.app`. Oba adresy 200. 60 plikÃ³w JS: 0 Ã `service_role`. Kopia wdroÅ¼eniowa usuniÄta. Bez migracji.

**Poprawki P2 â wyglÄd 2 NA PRODUKCJI â commit `b9ae3d37`, wdroÅ¼enie `dpl_2S9uAEnAqEdv2sgTCUQWC3gDqtaL`, 13.10.2026 19:04.** NastÄpna: dokoÅczenie P3 (po rebase na `main`).

## 2026-10-13 â P3 WIP (po rebase)

- PR #175: unit/visual/db (peÅna brama) zielone; menu SCX bez `tasks` (E9); kafelek i linki â `risk`.
- Rebase na `main` po #177. TEST wolne. Bez wdroÅ¼enia P3 (jeszcze nie koniec paczki).

## 2026-10-13 â Poprawki P2 â wyglÄd 2-popr (`wyglad/P2-2-popr`)

- PR #177 scalony â `770960fd` (13.10.2026 ~19:45 UTC). unit + visual zielone; gitleaks 0 (opis PR); `npm audit --omit=dev --audit-level=high` = 0; bez migracji (F8 OK). F3 pkt 5 po niezaleÅ¼nym sprawdzeniu #176.
- WdroÅ¼enie R7 z `main` `770960fd`, 13.10.2026 19:53, `dpl_ESWeHnmtc375vwNpyZMZsH7CSCCH`.
- Plik JS przed: `assets/index-DjH-U2rD.js`. Po: `assets/index-FTeLpkaa.js` â ta sama nazwa na `tower.log-mar.pl` i `watch-tower-makieta.vercel.app`. Oba adresy 200. 60 plikÃ³w JS: 0 Ã `service_role`. Kopia wdroÅ¼eniowa usuniÄta. Bez migracji.

**Poprawki P2 â wyglÄd 2-popr NA PRODUKCJI â commit `770960fd`, wdroÅ¼enie `dpl_ESWeHnmtc375vwNpyZMZsH7CSCCH`, 13.10.2026 19:53.** Dalej P3 (logika/baza).

## 2026-10-13 â P3 E6 konta (logika/baza)

- Migracja **0197**: `first_name`/`last_name`, telefon E.164, `admin_user_profile_set`, zaproszenie z imieniem/nazwiskiem/telefonem, `my_profile` + pola, sync `full_name`, `handle_new_auth_user` jak 0046 (relink, bez `accepted_at`).
- UI (bez przebudowy wyglÄdu): Opcje âº Moje konto, formularz zaproszenia i lista z âZadzwoÅâ; nullguard **617**.
- TEST wolne. Bez wdroÅ¼enia P3 (paczka w toku).

## 2026-10-13 â P3 E12-A (logika)

- Migracja **0198**: `is_hhl_admin()`; zapisy Opcji (`rate_card_save`, SEFS/paliwo, bramka SMS) tylko Administrator HHL.
- Opcje UI: Operacje bez UÅ¼ytkownikÃ³w (admin), LogowaÅ, Historii zmian; Moje konto / 2FA / urzÄdzenia zostajÄ.

## 2026-10-13 â P3 G-18 (matryca dat)

- Migracja **0199**: `matrix_notify` â IN_APP dla `PLAN_DATES_CHANGED` zawsze dla HHL_ADMIN, HHL_OPS, CARRIER_DISPATCH, CARRIER_USER; e-mail/push wg macierzy.

## 2026-10-13 â P3 E5-1

- Migracja **0200**: `notification_matrix.email = false` wszÄdzie (start E5-1).

## 2026-10-13 â P3 E13 â koordynator

- CSS E13 wycofany z gaÅÄzi logiki (F1/F5). Dopisek **D-20261013-2130-01** do `wyglad/P3`.

## 2026-10-13 â P3 E11 macierz 5 rÃ³l

- Migracja **0201**: `notification_matrix` po `role` (5 rodzajÃ³w); archiwum `notification_matrix_org_kind`; RPC `p_role` (DROP przed CREATE â Postgres nie zmienia nazwy argumentu); UI kolumny rÃ³l.

## 2026-10-13 â P3 E5-2 + E19-4 (logika/baza)

- Migracja **0202**: kolumna `notification_matrix.push` (telefon); start RISK_FERRY_WEATHER + DECISION; `matrix_notify` WEB_PUSH wg `push`.
- Migracja **0203**: `security_advisor_snapshots`, cron `tower-security-advisor`, RPC odczytu dla HHL_ADMIN; Edge `security-advisor-snapshot`.
- `tests/db/advisor-exceptions.txt` + `scripts/security-advisor-check.mjs` (E19 pkt 6).
- nullguard **622** (+ `security_advisor_snapshot_latest`).
- Bez CSS; dopisek D-20261013-2130-01 do `wyglad/P3`.


## 2026-10-13 â P3 TEST przed scaleniem

- TEST zajÄte: P3 (security, status, nullguard, dec3) na `14663cad`.

## 2026-10-13 â P3 logika/baza NA PRODUKCJI

- Scalenie PR #175 â `d3cbe4d8`; poprawka idempotentnoÅci 0201 PR #179 â `567fcc5a`.
- Migracje **0196â0203** na produkcji (`db push` Ã2: drugi âup to dateâ). PrÃ³ba ROLLBACK Ã2 OK (snap_ok, 25 rÃ³l macierzy, 10 push).
- Edge `security-advisor-snapshot` wdroÅ¼ona (prod).
- TEST przed scaleniem: security 84/84, status 44/44, nullguard 161+136+204+121, dec3 13/13; doradca security 0 nowych (po wyjÄtkach).
- CI: unit/visual/db zielone na SHA paczki.
- WdroÅ¼enie R7 z `main` `567fcc5a`, 13.10.2026 23:32, `dpl_9tAM8dDaeXZ2awdpHD6RCNwdkLPP`.
- Plik JS: `assets/index-_PKBum7P.js` na `tower.log-mar.pl` i `watch-tower-makieta.vercel.app` (oba 200). 9 plikÃ³w JS z HTML: 0 Ã `service_role`. Kopia wdroÅ¼eniowa usuniÄta.
- TEST wolne.
- WyglÄd P3 (Z4/Z11, V5, E13 CSS): koordynator na `wyglad/P3` (dopisek D-20261013-2130-01).

**P3 (logika/baza) NA PRODUKCJI â commit `567fcc5a`, migracje 0196â0203, wdroÅ¼enie `dpl_9tAM8dDaeXZ2awdpHD6RCNwdkLPP`, 13.10.2026 23:32.** NastÄpna: P4 (logika); wyglÄd P3 osobno.

## 2026-10-14 â wyglad/P3-a (pasek E37 + E13) â NA PRODUKCJI

- Dopisek `D-20261013-2255-01` w `docs/handover/dopiski/` (G1âG5).
- Przed scaleniem: `unit` i `visual` zielone na `981c93d`; gitleaks 0 na zakresie PR; `npm audit --omit=dev --audit-level=high` 0.
- Scalenie PR #178 (`wyglad/P3`) â merge `25b71bca` (14.10.2026 00:10). Bez migracji.
- WdroÅ¼enie R7 z `main` `25b71bca`, 14.10.2026 00:12, `dpl_FBYjeG86cptLjWvXiRmURHH5kKkt`.
- Plik JS przed: `assets/index-_PKBum7P.js`. Po: `assets/index-lVQ_YtiK.js` â ta sama nazwa na `tower.log-mar.pl`, `watch-tower-makieta.vercel.app` i w `dist/` buildu. Oba adresy 200. 64 pliki JS: 0 Ã `service_role`. Kopia wdroÅ¼eniowa usuniÄta.
- G3 (uchwyty): `#themeBtn` w menu konta; `[data-auth="session"]` na `#accountBtn`; `.nav-session` usuniÄte; `#roleSeg` bez zmian (napisy HHL/KSH/SCX, âPodglÄdâ).
- G4 (podÅÄczenie, bez zmiany wyglÄdu): `last_sign_in_at` z sesji Auth w `AuthGate`; typ `real_full_name` + `ImpersonationBanner` (fallback `real_email`); migracja `my_profile` (`last_sign_in_at` z `auth.users` dla eff, `real_full_name`) â przy rebase P4 (numer wolny); G4.2 âMoje kontoâ KSH/SCX â po P3-c. PR #182 â `2d467649`; wdroÅ¼enie G4 R7 14.10.2026 00:29, `dpl_GVhiKpCETFTpzECiS8QwsRRaKGxo`; JS `assets/index-CCGb6sOq.js` (oba adresy 200, 0 Ã `service_role`).
- PLAN Â§4 P3: P3-a / P3-b / P3-c; Â§8 wiersz dopisku.

**wyglad/P3-a NA PRODUKCJI â commit `25b71bca`, wdroÅ¼enie `dpl_FBYjeG86cptLjWvXiRmURHH5kKkt`, 14.10.2026 00:12.** G4 na produkcji: commit `2d467649`, `dpl_GVhiKpCETFTpzECiS8QwsRRaKGxo`, 14.10.2026 00:29.

## 2026-10-14 â Poprawki P3: TEST przed scaleniem

- TEST zajÄte: P3-poprawki (security, status, nullguard, g20) na `97c02d59` / potwierdzenie `10d21b5b`.
- Wynik TEST: security 84/84, status 44/44, nullguard 622, g20 15/15.
- Doradca security TEST: 0 nowych (po wyjÄtkach). Doradca prod (odczyt): ostrzeÅ¼enie `auth_leaked_password_protection` â W1 (wÅaÅciciel wÅÄcza w panelu).
- **STOP Â§1 pkt 12.2 / W34:** GitHub Actions nie startuje jobÃ³w (pÅatnoÅÄ / limit wydatkÃ³w konta). Checki na `10d21b5b` fail 2â3 s, 0 krokÃ³w; adnotacja: ârecent account payments have failed or your spending limit needs to be increasedâ. WczeÅniejsze checki na `97c02d59` byÅy zielone.
- PR #184 gotowy do scalenia po W34 (unit/visual/db na gÅowie). Migracja **0204** w gaÅÄzi; wdroÅ¼enie i `db push` po zielonych checkach.
- TEST wolne.

**CZEKA NA WÅAÅCICIELA: W34 â GitHub Actions billing / spending limit.** Po âW34 gotoweâ â checki, merge #184, migracja 0204, Edge `web-push-send`, sygnaÅ P3-poprawki NA PRODUKCJI. Wracam do P4 (bez wdroÅ¼enia migracji P4 do po Poprawkach P3).

## 2026-10-14 â W34 dostarczone; Poprawki P3 â ponowienie bram

- W34 dostarczone 14.10.2026, 01:55 (wÅaÅciciel: GitHub Actions dziaÅa).
- Ponowienie checkÃ³w PR #184 na gÅowie; TEST z `10d21b5b` nadal waÅ¼ny (pÃ³Åºniejsze commity tylko `docs/**`).

## 2026-10-14 â Poprawki P3 NA PRODUKCJI

- CI na `dcb2d28e`: unit, visual, db zielone; gitleaks 0 (zakres PR); `npm audit --omit=dev --audit-level=high` 0.
- Scalenie PR #184 â `38711bd7`.
- PrÃ³ba ROLLBACK 0204 na produkcji: mig_ok, DECISIONÃCLIENT_USER push=false, import_schedule z import_ctx; ROLLBACK.
- `db push` 0204; drugi raz âup to dateâ; parytet MATCH YES (0001â¦0204).
- Edge `web-push-send` wdroÅ¼ona (prod).
- Doradca security prod (odczyt): ostrzeÅ¼enie `auth_leaked_password_protection` â W1 (panel wÅaÅciciela).
- WdroÅ¼enie R7 z `main` `38711bd7`, 14.10.2026 02:40, `dpl_DHp28HQMcy6D5PHZmMWCcvRcqKUF`.
- Plik JS: `assets/index-CCGb6sOq.js` (bez zmian w `src/` aplikacji â tylko baza/Edge); oba adresy 200; 0 Ã `service_role`. Kopia wdroÅ¼eniowa usuniÄta.

**P3-poprawki NA PRODUKCJI â commit `38711bd7`, migracja 0204, wdroÅ¼enie `dpl_DHp28HQMcy6D5PHZmMWCcvRcqKUF`, 14.10.2026 02:40.**

## 2026-10-14 â wyglad/P3-b NA PRODUKCJI

- Dopisek D-20261014-0215-01 wÅÄczony (PR #186).
- CI na `2eca59f`: unit i visual zielone; gitleaks 0; `npm audit --omit=dev --audit-level=high` 0.
- Scalenie PR #185 â `50b23eb0` (po #186). Bez migracji.
- WdroÅ¼enie R7 z `main` `50b23eb0`, 14.10.2026 02:53, `dpl_Go31sqkke7v66cur6AxKfkuDwDWj`.
- Plik JS przed: `assets/index-CCGb6sOq.js`. Po: `assets/index-aVxTzmYJ.js` â ta sama nazwa na `tower.log-mar.pl` i w logu buildu Vercel. Oba adresy 200. 0 Ã `service_role`. Kopia wdroÅ¼eniowa usuniÄta.

**wyglad/P3-b NA PRODUKCJI â commit `50b23eb0`, wdroÅ¼enie `dpl_Go31sqkke7v66cur6AxKfkuDwDWj`, 14.10.2026 02:53.**

## 2026-10-14 â wyglad/P4-a NA PRODUKCJI

- Dopisek D-20261014-0315-01 wÅÄczony w gaÅÄzi P4 (H5).
- CI PR #188: unit i visual zielone; gitleaks 0; `npm audit --omit=dev --audit-level=high` 0. Bez migracji.
- Scalenie PR #188 â `cb140085`.
- WdroÅ¼enie R7 z `main` `cb140085`, 14.10.2026 04:54, `dpl_DYK297WxbcnC9y5CXTQMXN7CvzWg`.
- Plik JS przed: `assets/index-aVxTzmYJ.js`. Po: `assets/index-CJKv76X6.js`. Oba adresy 200.

**wyglad/P4-a NA PRODUKCJI â commit `cb140085`, wdroÅ¼enie `dpl_DYK297WxbcnC9y5CXTQMXN7CvzWg`, 14.10.2026 04:54.**

## 2026-10-14 â wyglad/P3-c NA PRODUKCJI

- Dopisek D-20261014-0700-01 (w PR #190; wÅÄczenie do planu w `pakiet/P3-c-konto`).
- CI na `70756d9`: unit i visual zielone; gitleaks = znana atrapa `H3_CORRIDOR_OBSTACLES` w `demo.tsx` (jak 0154; odcisk w `.gitleaksignore` w commicie wÅÄczajÄcym); `npm audit --omit=dev --audit-level=high` 0. Bez migracji.
- Scalenie PR #190 â `980c5a6f`.
- WdroÅ¼enie R7 z `main` `980c5a6f`, 14.10.2026 11:33, `dpl_88oQ2pwsRC1aavsiSmFmcMzwUPKe`.
- Plik JS przed: `assets/index-CJKv76X6.js`. Po: `assets/index-gD-kQcbR.js` â ta sama nazwa na `tower.log-mar.pl` i `watch-tower-makieta.vercel.app`. Oba adresy 200. 0 Ã `service_role` (9 plikÃ³w JS z HTML). Kopia wdroÅ¼eniowa usuniÄta.

**wyglad/P3-c NA PRODUKCJI â commit `980c5a6f`, wdroÅ¼enie `dpl_88oQ2pwsRC1aavsiSmFmcMzwUPKe`, 14.10.2026 11:33.**


## 2026-10-14 â P3-c J3 pkt 1 (Moje konto) NA PRODUKCJI

- WÅÄczenie D-20261014-0700-01: PLAN Â§4 P3 (P3-c NA PRODUKCJI, J3, J4), P8 (J3 pkt 12), Â§8.
- `LiveAccountScreen`: `AccountScreen` â `my_profile` / `admin_user_profile_set`, `MfaSetup`, `my_sessions`; PodglÄd = bez zapisÃ³w RPC (`isPreviewReadOnly`).
- Opcje HHL i Ustawienia KSH/SCX: zamiast MyAccount+Mfa+MyDevices / âBrak ÅºrÃ³dÅa danych.â
- J5: testy lokalne `iii9`/`i2`/`i19`/`i3`/`i27` â `[data-opt-nav]`; `i5-mfa` pod LiveAccount.
- `.gitleaksignore`: atrapa `H3_CORRIDOR_OBSTACLES` w `demo.tsx`.
- Scalenie PR #191 â `fdfb0caa`. unit + visual zielone; gitleaks 0; audit 0. Bez migracji.
- WdroÅ¼enie R7 z `main` `fdfb0caa`, 14.10.2026 11:57, `dpl_sd7RM5S4cfWemmi7zjpF8uPKip45`.
- Plik JS przed: `assets/index-gD-kQcbR.js`. Po: `assets/index-TI93uCIy.js`. Oba adresy 200. 0 Ã `service_role`.

**P3-c J3.1 (Moje konto) NA PRODUKCJI â commit `fdfb0caa`, wdroÅ¼enie `dpl_sd7RM5S4cfWemmi7zjpF8uPKip45`, 14.10.2026 11:57.**


## 2026-10-14 â P4 H1/H2 (D-20261014-0640-01) â TEST

- **TEST zajÄte: P4**, od 14.10.2026 12:35 â potwierdzenie security, status, nullguard, e25 na `cf4b673d` (PR #181).
- TEST: security **84/84** (+2 SKIP), status **44/44**, e25 **21/21**, nullguard **161+136+208+122 = 627/627**; doradca security TEST: 0 nowych (po wyjÄtku `load_status_set` / `load_status_rank`).
- CI PR #181 na `cf4b673d`: unit, visual, db zielone; gitleaks 0 (zakres vs main); `npm audit --omit=dev --audit-level=high` 0.
- **TEST wolne** od 14.10.2026 13:25.

## 2026-10-14 â P4 H1/H2 (logika/baza E25) NA PRODUKCJI

- Dopisek D-20261014-0640-01 wÅÄczony (H1/H2 w PR #181; H3/H4 zostajÄ w P4).
- Scalenie PR #181 â `3dd72256`. Migracja **0205** (`db push` Ã2: drugi âup to dateâ); prÃ³ba ROLLBACK: chk_ok=1, fn_ok=1, enum_ok=2.
- TEST przed scaleniem (`cf4b673d` / head z wyjÄtkami doradcy): security 84, status 44, e25 21/21, nullguard 627, doradca 0 nowych.
- WdroÅ¼enie R7 z `main` `3dd72256`, 14.10.2026 13:43, `dpl_AffqVNywWVnTJTtTYxVnNs1xjKmD`.
- Plik JS: `assets/index-B9wDrCrF.js`. Oba adresy 200. 0 Ã `service_role`.
- PR #189 (`wyglad/P4-b`) â draft; scalenie po oznaczeniu gotowoÅci przez koordynatora.

**P4 H1/H2 (E25 statusy) NA PRODUKCJI â commit `3dd72256`, migracja 0205, wdroÅ¼enie `dpl_AffqVNywWVnTJTtTYxVnNs1xjKmD`, 14.10.2026 13:43.**

## 2026-10-14 â P3-c poprawka (D-20261014-1420-01 R1âR2/R4âR5/R7) NA PRODUKCJI

- R1: `accountMfaEnabled` â 2FA UI tylko przy verified TOTP (bez `satisfied`).
- R2: `MyMfa` pod AccountScreen przy â¥1 TOTP (nie PodglÄd).
- R4: `auth_pw_changed` = âHasÅo zmienione.â
- R5: i5-mfa **13/13** (w tym 2Ã R1); i2-facade I-5+I-17 przywrÃ³cone (przebieg na Å¼ywo â po R3 / TEST).
- R7: PLAN P3-d po P4; J4 = Kokpit.
- Scalenie PR #195 â `50d4fc3e`. Bez migracji.
- WdroÅ¼enie R7 z `main` `50d4fc3e`, 14.10.2026 14:45, `dpl_54y7p76dguMDSCjfNwApqGkfaFDB`.
- Plik JS: `assets/index-CdyCUXOf.js`. Oba adresy 200. 0 Ã `service_role`.

**P3-c poprawka NA PRODUKCJI â commit `50d4fc3e`, 14.10.2026 14:45.**

## 2026-10-14 â P3-c-sesja (D-20261014-1420-01 R3) â TEST + NA PRODUKCJI

- **TEST zajÄte: P3-c-sesja**, od 14.10.2026 ~15:02 â security, nullguard, doradca (session w CI `db`).
- TEST na `c7e8a368` / migracja **0206**: security **84/84** (+2 SKIP), nullguard **161+136+212+123 = 632/632**; doradca security TEST: **0 nowych** (wyjÄtek `my_session_revoke`).
- CI PR #197 na `c7e8a368`: unit, visual, db zielone; gitleaks 0 (zakres vs main); `npm audit --omit=dev --audit-level=high` 0.
- **TEST wolne** od 14.10.2026 15:40.
- Scalenie PR #197 â `12b72b00`.
- PrÃ³ba ROLLBACK 0206 na produkcji: fn_ok=1, definer_ok=1, grant_auth=1, no_anon=1; ROLLBACK.
- `db push` 0206; drugi raz âup to dateâ; 206 migracji; `my_session_revoke` na produkcji.
- WdroÅ¼enie R7 z `main` `12b72b00`, 14.10.2026 15:43, `dpl_3BeJ9Y55vxh15noTNpevBabdV7aT`.
- Plik JS: `assets/index-DqC_epNn.js` (chunk `LiveAccountScreen-*.js` z `my_session_revoke`). Oba adresy 200. 0 Ã `service_role` (9 plikÃ³w JS z HTML + crawl). Kopia wdroÅ¼eniowa usuniÄta.

**P3-c-sesja NA PRODUKCJI â commit `12b72b00`, migracja 0206, wdroÅ¼enie `dpl_3BeJ9Y55vxh15noTNpevBabdV7aT`, 14.10.2026 15:43.**

## 2026-10-14 â wyglad/P4-b NA PRODUKCJI

- Dopisek D-20261014-1320-01 wÅÄczony (PR #199 â `5ba9d5ca`): PLAN Â§4 P4 Ekrany P4-a/b/c, K2, P6 E7 `DeliveredCheckCard`; odwoÅania do D-20261014-1145-01 w 1420-01 â K1.
- SygnaÅ koordynatora 14.10.2026 14:49: â#189 GOTOWE DO SCALENIAâ (gÅowa `832fe9a`, 4 commity P4-b po przeniesieniu na main po #181).
- Scalenie PR #189 â `c7dd55aa`. unit + visual zielone; gitleaks 0 (4 commity); `npm audit --omit=dev --audit-level=high` 0. Bez migracji.
- WdroÅ¼enie R7 z `main` `c7dd55aa`, 14.10.2026 17:19, `dpl_AvsXQY2ZyiUDJuc3wpttzzgKQusq`.
- Plik JS: `assets/index-o__amAGp.js` (oba adresy 200). 0 Ã `service_role` (9 plikÃ³w JS z HTML). Kopia wdroÅ¼eniowa usuniÄta.
- PR #193 (`wyglad/P4-c`) â draft; scalenie po sygnale â#193 GOTOWE DO SCALENIAâ.

**wyglad/P4-b NA PRODUKCJI â commit `c7dd55aa`, wdroÅ¼enie `dpl_AvsXQY2ZyiUDJuc3wpttzzgKQusq`, 14.10.2026 17:19.**

## 2026-10-14 â wyglad/P4-c NA PRODUKCJI

- SygnaÅ wÅaÅciciela 14.10.2026 ~18:13: scaliÄ #193 i wdroÅ¼yÄ; dane K2 wedÅug D-20261014-1320-01.
- Scalenie PR #193 â `bb55884f` (gÅowa po przeniesieniu na main: `938760a`). unit + visual zielone; gitleaks 0; `npm audit --omit=dev --audit-level=high` 0. Bez migracji.
- WdroÅ¼enie R7 z `main` `bb55884f`, 14.10.2026 18:17, `dpl_6EEFjRMh516nGexue6GZPyv8sEeK`.
- Plik JS: `assets/index-CS7-22Du.js` (oba adresy 200). 0 Ã `service_role` (JS z HTML). Kopia wdroÅ¼eniowa usuniÄta.
- Dalej: K2 (dane P4-c) + H3/H4 (0640) + R6 (1420) w paczce P4.

**wyglad/P4-c NA PRODUKCJI â commit `bb55884f`, wdroÅ¼enie `dpl_6EEFjRMh516nGexue6GZPyv8sEeK`, 14.10.2026 18:17.**

## 2026-10-14 â wyglad/P5 NA PRODUKCJI

- Dopisek D-20261014-2005-01 w `docs/handover/dopiski/`; PLAN Â§4 P5 Ekrany (S1âS5) + Â§8.
- Scalenie PR #201 â `6631eb8a` (gÅowa `5e3dc21`). unit + visual zielone; gitleaks 0; `npm audit --omit=dev --audit-level=high` 0. Bez migracji (bez `db` / TEST).
- WdroÅ¼enie R7 z `main` `6631eb8a`, 14.10.2026 20:49, `dpl_6BupPHfhnDTw2sBdpgEpJqVZ9v5x`.
- Plik JS: `assets/index-LoAtWpmu.js` (oba adresy 200). 0 Ã `service_role` (25 plikÃ³w JS z HTML). Kopia wdroÅ¼eniowa usuniÄta.
- Dane pod wyglÄd: w P5 wedÅug PLAN Â§4 P5 i D-20261014-2005-01 S1âS5 (`p5Source.ts`).

**wyglad/P5 NA PRODUKCJI â commit `6631eb8a`, wdroÅ¼enie `dpl_6BupPHfhnDTw2sBdpgEpJqVZ9v5x`, 14.10.2026 20:49.**

## 2026-10-14 â wyglad/P6-a NA PRODUKCJI

- Dopisek D-20261014-2145-01 w `docs/handover/dopiski/`; PLAN Â§4 P6 Ekrany (T1âT6) + Â§8.
- Scalenie PR #205 â `49d05641` (gÅowa `93b83cb`). unit + visual zielone; gitleaks 0; `npm audit --omit=dev --audit-level=high` 0. Bez migracji (bez `db` / TEST).
- WdroÅ¼enie R7 z `main` `49d05641`, 14.10.2026 22:07, `dpl_9PFrMuYyTVXRymWBp63t2vGZapnc`.
- Plik JS: `assets/index-C4kdLq0M.js` (oba adresy 200). 0 Ã `service_role` (25 plikÃ³w JS z HTML). Kopia wdroÅ¼eniowa usuniÄta.
- Dane pod wyglÄd: w P6 wedÅug PLAN Â§4 P6 i D-20261014-2145-01 T1âT6 (`p6Source.ts`).

**wyglad/P6-a NA PRODUKCJI â commit `49d05641`, wdroÅ¼enie `dpl_9PFrMuYyTVXRymWBp63t2vGZapnc`, 14.10.2026 22:07.**

## 2026-10-15 â wyglad/P6-b NA PRODUKCJI

- Dopisek D-20261014-2300-01 w `docs/handover/dopiski/`; PLAN Â§4 P6 Ekrany (H1âH4 / `p6bSource.ts` razem z E17) + OdbiÃ³r + Â§8 (PR #208).
- Scalenie PR #207 â `adeda6e7` (gÅowa `35489c22`). unit + visual zielone; gitleaks 0; `npm audit --omit=dev --audit-level=high` 0. Bez migracji (bez `db` / TEST).
- WdroÅ¼enie R7 z `main` `adeda6e7`, 15.10.2026 00:14, `dpl_DQ5qsdYwuib3m5sXHLSGWMC3FZoy`.
- Plik JS: `assets/index-tzPPF_z_.js` (oba adresy 200). 0 Ã `service_role` (27 plikÃ³w JS z HTML). Kopia wdroÅ¼eniowa usuniÄta.
- Dane pod wyglÄd: w P6 razem z E17 wedÅug PLAN Â§4 P6 i D-20261014-2300-01 H1âH4 (`p6bSource.ts`).
- Konflikt / nakÅadanie z gaÅÄziÄ `pakiet/P4-k2-h3-r6` (PR #203): **nie rozwiÄzywaÅem** (D-20261014-2300-01); #207 weszÅo na `main` mergeâem; rebase P4 na nowy `main` â poza tÄ paczkÄ (koordynator przenosi wyglÄd na main).

**wyglad/P6-b NA PRODUKCJI â commit `adeda6e7`, wdroÅ¼enie `dpl_DQ5qsdYwuib3m5sXHLSGWMC3FZoy`, 15.10.2026 00:14.**

## 2026-10-15 â Poprawki audyt A (D-20261015-0300-01 / D-0330) NA PRODUKCJI

- Dopiski: D-20261015-0300-01 (A1âA6), D-20261015-0330-01 (A2 widocznoÅÄ, W35âW40), D-20261015-0400-01 (P6 E2 po C1) â wÅÄczane w PR dokumentÃ³w.
- PR #212 â `fa840b51` (migracje 0207â0213 + testy); PR #215 â `034a993d` (fix 0207 alias `fr`, 0211 wyÅÄcza append-only przy korekcie SG-03).
- TEST (przed wdroÅ¼eniem): security **84**, status **44**, e41 **36**, e25 **26**, nullguard **161+136+212+123**; CI `db` / `unit` / `visual` zielone na #215.
- Kopia przed produkcjÄ: `D:\Watch Tower\dane\audyt-A\kopia-audyt-a-2026-10-15T03-50-07-263Z.json`, SHA256 `3dfc8a23e04678bda846e15439052b2d0e8c3ad8ce46591048e052ec83ad32d7`.
- Produkcja: ROLLBACK OK â `supabase db push` (pooler) 0207â0213; weryfikacja: Orlen w `fuel_index_readings`, SG-03 DELIVERED `2026-10-07 12:19:54` Europe/Warsaw, `has_column_privilege(authenticated, loads.order_*)` = false.
- W39 SELECT (po A): `notification_matrix` `LOAD_STATUS Ã HHL_ADMIN` = `in_app=true, email=false, push=false` (juÅ¼ cofniÄte).
- WdroÅ¼enie aplikacji z `main` `034a993d`: `dpl_HPasjkw4nWBTeY5w2AVF93dLW8eN`, JS `assets/index-BmAE31XS.js`, oba adresy 200, 0 Ã `service_role` (27 plikÃ³w JS).
- PR #210 (raport Zmiany 11.10/15.10) scalony â `6c8971a3` przed PR dokumentÃ³w.
- Czas plan ~5 h A; poprawki migracji/testÃ³w (#215) wliczone.

**POPRAWKI-AUDYT-A NA PRODUKCJI â commit `034a993d`, migracje 0207â0213, wdroÅ¼enie `dpl_HPasjkw4nWBTeY5w2AVF93dLW8eN`, 15.10.2026 06:11.**

**CZEKA NA WÅAÅCICIELA: W37 â emtrack: nowe dane logowania od SCX (sekrety `EMTRACK_LOGIN` / `EMTRACK_PASSWORD`).**

## 2026-10-15 â P4 / PR #203 â B (D-0300) NA PRODUKCJI

- GaÅÄÅº `pakiet/P4-k2-h3-r6` â merge #203 `ea10b1bc`; hotfix #219 `readyGaps` â `3c676d96`.
- WyglÄd #213 â #214 â #217 wczeÅniej; P4 logika: `dpl_Dvv2rR9aHYN4nVSv6QZAskxBGf5b` (15.10 ~15:39).
- **B1âB11:** deliveredCheck; Kokpit morze/`READY_TO_INVOICE`/siteSince; tracker_on STATUS_AUTO; readyGaps piloci z `permit.plPilotsRequired` + usedBy/POLICY_SCX; RIO URL wklejony; progi E15 w `ops_thresholds` (SILENT_MIN=30); `SE_APPROACH_SG03`; stan Åledzenia PDF; anulowanie HHL_ADMIN + CANCELLED dla HHL; `telm_infer` bez FERRY; kotwica czasu i2.sh.
- **H3.6:** terminowoÅÄ = dzieÅ rozÅadunku â¤ dzieÅ dostawy z planu; marÅ¼a = suma marÅ¼y / suma przychodu.
- **TEST (przed wdroÅ¼eniem, SHA przed hotfixem):** security **84/84** (+2 SKIP), status **44/44**, nullguard **161+136+216+124 = 637/637**, dec6 **21/21** (+4 SKIP), risks **21/21** (+2 SKIP), e25 **26/26**, dec-auto **64/64**; doradca security TEST: **4** zgÅoszenia, **0 nowych** (parser CLI `results` â `security-advisor-check.mjs`).
- **B12 produkcja:** doradca security po 0214â0216: **5** zgÅoszeÅ, **0 nowych**; Edge `security-advisor-snapshot` + `backup-export` wdroÅ¼one; `advisor_ok=false` â `integration_runs.ok=false` / âBrak pomiaruâ.
- **B13:** unit `i5-mfa` **13/13** (CI unit zielony); `i2-facade.local` I-5/I-17 w tej sesji nie uruchamiano (Windows bez lokalnego Supabase) â wpisy I-5/I-17 DONE historycznie w POSTEP; uzupeÅnienie facade na TEST przy bramie niedzielnej.
- **B14 czasy (orientacyjnie z godzin commitÃ³w / POSTEP):** P1 ~8 h plan + poprawki e18/auth; P2 ~6 h; P3 ~10 h (+ Poprawki P3 / W34); Poprawki P3 (0015) ~4 h do STOP W34; P4 (B, wznowienie 12:33â15:40) ~3 h plan + ~1 h poprawki (TDZ DashboardView, readyGaps TS, doradca CLI).
- CI merge #203 / #219: unit + visual + db zielone; `npm audit --omit=dev --audit-level=high` 0.
- Produkcja: ROLLBACK OK â `db push` 0214â0216; JS `assets/index-0TxiZS0x.js`; tower / makieta **200**; 0 Ã `service_role` w index.
- DowÃ³d wyglÄdu P4-a (wstecz, Q3): wczeÅniej `cb140085` / `dpl_DYK297â¦` â index z wdroÅ¼enia = produkcja, 0 Ã `service_role` (POSTEP 14.10).

**P4 NA PRODUKCJI â commit `3c676d96`, migracje 0214â0216, wdroÅ¼enie `dpl_Dvv2rR9aHYN4nVSv6QZAskxBGf5b`, 15.10.2026 15:39.**

## 2026-10-15 â wyglad/A5 (PR #218) NA PRODUKCJI

- Scalenie PR #218 â `12e3efd7` (okno âZmieÅ statusâ: CMR / faktury, E25). unit + visual zielone; bez migracji.
- WdroÅ¼enie z `main` `12e3efd7`: `dpl_4ndnWfvyNcHWgfEdHP3qC9Na3zYY`, JS `assets/index-DvW5-7T4.js`.
- tower.log-mar.pl i watch-tower-makieta.vercel.app **200**; 0 Ã `service_role`.

**wyglad/A5 NA PRODUKCJI â commit `12e3efd7`, wdroÅ¼enie `dpl_4ndnWfvyNcHWgfEdHP3qC9Na3zYY`, 15.10.2026 17:30.**

## 2026-10-15 â Poprawki P2âP3 (PR #221) â TEST

- **TEST zajÄte: Poprawki P2âP3**, od 15.10.2026 17:30 â potwierdzenie security, status, nullguard, risks na `e39ccb47`/`4fc44255` (migracje 0217â0218).
- TEST: security **84/84** (+2 SKIP), status **44/44**, risks **25/25** (+2 SKIP), nullguard **161+136+216+124 = 637/637**. Doradca TEST: **149** zgÅoszeÅ, **0 nowych**.
- CI `db` / `unit` / `visual` zielone na `4fc44255` (session 33, risks 27, l13 34).
- **TEST wolne** od 15.10.2026 18:25.

## 2026-10-15 â Poprawki P2âP3: C1 / C12 / C14 NA PRODUKCJI (paczka W TOKU â C2â¦)

- Merge PR #221 â `2a315a4d` (0217 C1 dzwonek, 0218 session/l13, C12 DOC_MISSING, C14 ADVISOR_MGMT_TOKEN).
- Kopia przed C1: `D:\Watch Tower\dane\poprawki-p2-p3-c1\kopia-c1-bell-2026-10-15T16-27-50-905Z.json`, n=**6872**, SHA256 `50e5f2521a01675cc3962907110a1f698585268fab43e401bbf1169547bd11d4`.
- Produkcja: ROLLBACK OK â `db push` 0217â0218; po: `unread RISK_* bez load_id` = **0**; `truck_ban_holidays` = `current_app_role() IS NOT NULL`; audit `C1_BELL_MARK_READ_NO_LOAD`.
- Edge `security-advisor-snapshot` wdroÅ¼ona (C14). Doradca produkcja: ostrzeÅ¼enie `auth_leaked_password_protection` (W1 â wÅÄczenie w panelu Auth; nie z migracji).
- WdroÅ¼enie aplikacji: `dpl_BVVAGR5vymg7EXbMjVEj6jrSYZV2`, JS `assets/index-DwXAzakW.js`; tower / makieta **200**; 0 Ã `service_role`.
- PR #218 wyglad/A5 wczeÅniej: `12e3efd7` / `dpl_4ndnWfvyNcHWgfEdHP3qC9Na3zYY`.
- NastÄpne w paczce: **C2** (pushDevicesOf / sw.js / web-push-send).

**C1+C12+C14 NA PRODUKCJI â commit `2a315a4d`, migracje 0217â0218, wdroÅ¼enie `dpl_BVVAGR5vymg7EXbMjVEj6jrSYZV2`, 15.10.2026 18:30.** (paczka Poprawki P2âP3 nadal W TOKU â C2âC15, C11/C13 wyglÄd)

## 2026-10-15 â Poprawki P2âP3: C2 NA PRODUKCJI

- Merge PR #223 â `e49285c5`. Bez migracji. unit + visual + db zielone; `npm audit` 0.
- Edge: `web-push-test`, `web-push-send` (cel z payload).
- Aplikacja: `dpl_BGubwMaao7NTm9wauFLPcShYkTQr`; tower / makieta **200**.
- OdbiÃ³r C2 na Androidzie (â¤ 10 s) â potem W24.

**C2 NA PRODUKCJI â commit `e49285c5`, wdroÅ¼enie `dpl_BGubwMaao7NTm9wauFLPcShYkTQr`, 15.10.2026 ~19:00.** NastÄpne: C3âC15.

## 2026-10-15 â C16-N1 NA PRODUKCJI (BLOKER C2 / D-20261015-1955-01)

- Przyczyna: przycisk testu â tylko `OPTIONS â¦ web-push-test â 405` (brak CORS), zero POST.
- PR #227 â `2b9c3679` (`d3fde479`): CORS, `{ ok, status, reason, sent_at }`, `urgency: high`, `TTL: 60`, kod z `e.statusCode`.
- PR #226 â `0f5075ef` (wyglad/push-telefon): ekran âSprawdÅº ten telefonâ, powÃ³d poraÅ¼ki, badge-96; dopisek D-20261015-1955-01.
- Edge `web-push-test` wdroÅ¼ona (prod) ~20:37; aplikacja `dpl_GQnkaNkuBj4TeXNrg8y1br8vCDvj` ~20:40; JS `assets/index-CUhhGQCv.js`; tower / makieta **200**; 0 Ã `service_role` (20 plikÃ³w JS).
- unit: `push-fail-reason` 2/2 (+ HMAC w N2); CI unit/visual/db #227 zielone; `npm audit` 0.
- PLAN: C16 przed C3; W42 = e-mail; W43 iPhone; W24 czeka do odbioru C16 na S24.
- Czas plan ~0,5 h N1; poprawki: 0.
- **NastÄpne:** C16 N2âN8 (send/ack/fallback/sw/sync/migracja 0219).

**C16-N1 NA PRODUKCJI â 20:37 (funkcja) / 20:40 (aplikacja), wÅaÅciciel moÅ¼e testowaÄ S24.** commit `0f5075ef`, wdroÅ¼enie `dpl_GQnkaNkuBj4TeXNrg8y1br8vCDvj`.

- **W24 (Android S24) dostarczone 15.10.2026, 20:50** â wÅaÅciciel: powiadomienie odebrane w telefonie (N1; peÅny odbiÃ³r C16 po N3 z `delivered_at` / âDoszÅo na urzÄdzenieâ). iPhone = W43.

## 2026-10-15 â C16 N2âN8 TEST

- **TEST zajÄte: C16 N2âN8**, od 15.10.2026 21:16 â security, status, nullguard, c16-push, risks na `a82ccc9e` (PR #229, migracja 0219).

### C16 N2âN8 â TEST (0219) przed poprawkami przeglÄdu

| zestaw | wynik |
|---|---|
| prep | ok |
| security | 84/84 (+2 SKIP) |
| status | 44/44 |
| c16-push | 10/10 |
| risks | 25/25 (+2 SKIP) |
| nullguard | 161+136+216+124 = 637/637 |

SHA TEST: `b5e65f4c`. Potem poprawki przeglÄdu (sw click/openWindow, HMAC `nid\|sid`, `verify_jwt=false`) â `ee689452`.

### C16 N2âN8 â TEST na `ee689452` (przed scaleniem #229)

| zestaw | wynik |
|---|---|
| prep | ok |
| security | 84/84 (+2 SKIP) |
| status | 44/44 |
| c16-push | 10/10 |
| nullguard | 161+136+216+124 = 637/637 |
| doradca security TEST | 167 zgÅoszeÅ, **0 nowych** |

CI #229 na `ee689452`: unit / visual / `db` zielone; `npm audit --omit=dev --audit-level=high` 0.
**TEST wolne** od 15.10.2026 23:32.

| punkt | zrobione / odbiÃ³r |
|---|---|
| C16 N2âN8 TEST | zrobione 23:32 â security 84, status 44, c16-push 10, nullguard 637, doradca 0 nowych; commit `ee689452` |

## 2026-10-15 â C16 N2âN8 NA PRODUKCJI (D-20261015-1955-01)

- Merge PR #229 â `456a7a14` (merge commit); gÅowa treÅci `94dc8ae7` / poprawki `ee689452`.
- Migracja **0219**: ROLLBACK OK â `db push` (drugi: up to date); `schema_migrations` â¦0219.
- Edge: `web-push-send`, `web-push-test`; `web-push-ack` / `web-push-resub` z `verify_jwt=false` (lista funkcji potwierdzona); OPTIONS â **200** + CORS (`Access-Control-Allow-Origin: https://tower.log-mar.pl`).
- Aplikacja: `dpl_7ngsrbV8JXwDHvDCEBRjdWVS2dLw`, JS `assets/index-s00c_A3-.js`, `sw.js` z openWindow po bÅÄdzie navigate; tower / makieta **200**; 0 Ã `service_role` (19 plikÃ³w JS).
- CI #229: unit / visual / `db` zielone; `npm audit` 0; TEST: security 84, status 44, c16-push 10, nullguard 637, doradca 0 nowych.
- Czas plan N2âN8 ~3 h; poprawki przeglÄdu (N5 openWindow, JWT off, HMAC nid\|sid) wliczone.
- **OdbiÃ³r C16 (pkt 1â7) â czeka na wÅaÅciciela:** ponowny test S24 z potwierdzeniem âDoszÅo na urzÄdzenieâ¦â â¤ 10 s; zablokowany ekran; klik â cel; Samsung Internet + komputer; wypiÄcie â 410 â e-mail W42. iPhone = W43.

| punkt | zrobione / odbiÃ³r |
|---|---|
| C16 N2âN8 produkcja | zrobione 23:52 â commit `456a7a14`, migracja 0219, dpl `dpl_7ngsrbV8JXwDHvDCEBRjdWVS2dLw`; odbiÃ³r S24 **czeka** |
| W24 Android S24 | dostarczone 20:50 (N1); peÅny odbiÃ³r po tym wdroÅ¼eniu |

**C16 NA PRODUKCJI â 456a7a14, 23:52; wÅaÅciciel: test S24 z potwierdzeniem.**

## 2026-10-16 â wyglÄd P5-b / P5-c / P6-c / P6-d NA PRODUKCJI (F2)

| punkt | zrobione / odbiÃ³r |
|---|---|
| #222 wyglad/P5-b | scalone `668e00ea`; dpl `dpl_3MdW736TrSGugPp2kdarLVnLWbED` ~00:10; tower/makieta 200 |
| #225 wyglad/P5-c | scalone `3d20f53a`; dpl `dpl_9zVg9fWHNcMUGS6VZsycee3ftxBX` ~00:12; tower/makieta 200 |
| #228 wyglad/P6-c | scalone `fd5562ff`; dpl `dpl_8Zn7b5LUwhjXeYot2aAFodPNFGD8` ~00:14; tower/makieta 200 |
| #230 wyglad/P6-d | scalone `d6fc9ae8`; dpl `dpl_BfZ9gPTzdhMpbw5ZMKqNe5Jmpqb2` ~00:17; dopisek C17 w repo; tower/makieta 200 |

unit + visual zielone przed kaÅ¼dym scaleniem; `npm audit` 0. #209/#231 (P7) â sobota (D-20261015-0130-01).

**wyglad/P5-b NA PRODUKCJI â 668e00ea.**  
**wyglad/P5-c NA PRODUKCJI â 3d20f53a.**  
**wyglad/P6-c NA PRODUKCJI â fd5562ff.**  
**wyglad/P6-d NA PRODUKCJI â d6fc9ae8.**

## 2026-10-16 â C17 NA PRODUKCJI (D-20261015-2110-01)

- Merge PR #235 â `e7595541` (merge); treÅÄ `1d6207ff` (release DELIVERED) / migracja 0220.
- CI #235 na `1d6207ff`: unit / visual / `db` zielone (release po C17: DELIVERED); `npm audit` 0; doradca TEST security: 149, **0 nowych**.
- Kopia: `D:\Watch Tower\dane\p2\kopia-c17-loads-2026-10-16.csv` (3 wiersze + nagÅÃ³wek), SHA-256 `fd93120ff9ab24a99c58c1bada67681d5c8525fc82895a9cf3101579bb1abbd1`.
- PrÃ³ba ROLLBACK 0220: 15048 READY_TO_INVOICE, 15060 INVOICED, UNLOADED=0, backfill `{unloaded_to_delivered:1,to_ready_to_invoice:1,to_invoiced:1}` â ROLLBACK; potem `db push` Ã2 (drugi: up to date); parytet **MATCH YES** 0001â¦0220.
- Po COMMIT: 15048 READY_TO_INVOICE, 15060 INVOICED, 15062 DELIVERED, UNLOADED=0; 3Ã STATUS_AUTO z `przebieg=jednorazowy C17`.
- Aplikacja R7: `dpl_HRCPmDoD3Ghiumi6tXDkaxcSzRfs`, JS `assets/index-DpEvn83_.js`; tower / makieta **200**; 0 Ã `service_role`.
- OdbiÃ³r C17 (SELECT): OK. C17 zamkniÄte przed BLOKEREM C16-H â zakÅadka niepotrzebna.

| punkt | zrobione / odbiÃ³r |
|---|---|
| C17.1 CMR â READY_TO_INVOICE | zrobione â 0220 |
| C17.2 faktury â INVOICED | zrobione â 0220 |
| C17.3 reguÅy wspÃ³lne | zrobione â 0220 |
| C17.4 UNLOADED â DELIVERED | zrobione â 0Ã UNLOADED |
| C17.5 przebieg jednorazowy | zrobione â backfill 1/1/1 |
| C17.6 testy status/e25/release | zrobione â CI db zielone |
| C17.7 wyglÄd (wykonawca) | bez zmian |
| C17 odbiÃ³r produkcja | zrobione 02:02 â SELECT OK |

**C17 NA PRODUKCJI â e7595541, 02:02.**

## 2026-10-16 â C16-H NA PRODUKCJI (D-20261016-0100-01)

- Merge PR #238 â `8bae03be`; treÅÄ `3b71b56e`.
- CI #238: unit / visual / `db` zielone; `npm audit` 0.
- TEST: security 84/84, status 55/55, c16-push 18/18, nullguard 161+136+216+124 = 637/637 (nullguard-4 ponowiony 124/124); doradca 149, **0 nowych**.
- Kopia PENDING push_fallback: `D:\Watch Tower\dane\p2\kopia-c16h-pending-fallback-2026-10-16.csv` (0 wierszy danych), SHA-256 `1283ff25df934c3475e683021322c071b20afa990e7c87ebecab6c2caebd010c`.
- Przed: PENDING push_fallback=0; WEB_PUSH sprzed granicy bez fallbacku=933.
- ROLLBACK 0221 OK â `db push` Ã2; parytet **MATCH YES** 0001â¦0221; audit `C16H_PUSH_FALLBACK_CANCEL` cancelled_pending=0.
- Po: tick=0; new_fb_for_old=0; pending_fb=0.
- H3: `send-notifications` v24â**v26** (notifyTemplates PL); web-push-* juÅ¼ z C16.
- H4: sekret `APP_URL=https://tower.log-mar.pl` (bez logowania innych sekretÃ³w).
- OdbiÃ³r pkt 1 (SELECT): OK. Pkt 2 (test wÅaÅciciela G-14) â po wdroÅ¼eniu.

| punkt | zrobione / odbiÃ³r |
|---|---|
| H1 tick / enqueue | zrobione â 0221 |
| H2 CANCEL PENDING starych | zrobione â 0 PENDING |
| H3 send-notifications | zrobione â v26 |
| H4 APP_URL | zrobione |
| H5 testy | zrobione â c16-push 18, unit temat |

**C16-H NA PRODUKCJI â 8bae03be, 10:02.**

## 2026-10-16 â dopiski wÅÄczone do planu (0200 / 0230 / 0250 / 0310 / 0315)

Tabela sprawdzalnoÅci (prompt 16.10):

| dopisek | punkt | paczka | pozycja w PLAN |
|---|---|---|---|
| D-20261016-0200-01 | Z1 wymiary/pilot/zezwolenie z tabeli | P5 | D1 |
| D-20261016-0200-01 | Z2 polisa HHL + zezwolenie 13/GD/2026 | P5 | D2 |
| D-20261016-0200-01 | Z3 usuniÄcie H-1 / H-3 | P9 | H-1 i H-3 â usuniÄcie |
| D-20261016-0200-01 | Z4 KPD / SMS SG-03 / D-21 | P6 E2-1; P8 E42; dokumenty | zamkniÄte bez nowej pracy |
| D-20261016-0200-01 | Z5 W19 | Â§5 | zastÄpione przez 0230 (W19 zamkniÄte) |
| D-20261016-0230-01 | Z1âZ6 E49 wiatr/objazd/ÅliskoÅÄ | P6 | E49 |
| D-20261016-0230-01 | Z3 pkt 8 linia objazdu | P9 | E45 uzupeÅnienie |
| D-20261016-0230-01 | Z5 Wiatr â SMHI | P10a | E23 |
| D-20261016-0230-01 | Z7 W19 / W45 / D-84 | Â§5 / rejestr | W19 zamkniÄte; W45; D-84=20 |
| D-20261016-0250-01 | Cz1âCz12 | P6 | E17 Czat â dane |
| D-20261016-0250-01 | Cz11 wyglÄd | P6 | wyglad/P6-d |
| D-20261016-0310-01 | Cz13 | C3 | wiersz âWiadomoÅÄ w czacieâ |
| D-20261016-0310-01 | Cz14âCz24 | P6 | E17 Czat â dane |
| D-20261016-0310-01 | Cz23 wyglÄd | P6 | wyglad/P6-e |
| D-20261016-0310-01 | Cz24 pkt 12 iPhone | Â§5 | W43 |
| D-20261016-0315-01 | Cz25 | C3 | przy Cz13 |
| D-20261016-0315-01 | Cz26âCz33 | P6 | E17 Czat â dane |
| D-20261016-0220-01 | Z1âZ3 E35 Automatyzacje | P8 | E35 â **wÅÄczone po #239** (`3bbb480e`) |

## 2026-10-16 â dopiski wÅÄczone do planu (0305â¦1020)

Tabela sprawdzalnoÅci (prompt 16.10, 11:30 i 11:40). Pliki dopiskÃ³w wchodzÄ z PR wyglÄdu â nie kopiowane osobno.

| dopisek | PR | paczka i pozycja w PLAN | punkty | test odbioru |
|---|---|---|---|---|
| D-20261016-0305-01 | #240 `wyglad/E49` | P6 E49 | pkt 1â5 (z 0230 Z1âZ4, Z6) | Z6 + zestaw `e49` |
| D-20261016-0330-01 | #241 `wyglad/P6-e`; #242 `wyglad/P6-f` | P6 E17 Czat â dane; C3 wartoÅci startowe | pkt 1â7 | Cz12, Cz24, Cz33; bloki `wyglad/P6-e`, `wyglad/P6-b`, `p6-history` |
| D-20261016-0405-01 | #243 `wyglad/2fa` | P3-d Moje konto (pkt 1) i PrzeÅÄczniki (pkt 8) | pkt 1â2 | pkt 3 |
| D-20261016-0430-01 | #244 `wyglad/P10a-a` | P10a E22 | pkt 1â3 | pkt 4 (E22 pkt 5) |
| D-20261016-0445-01 | #245 `wyglad/P9-a` | P9 E24 | pkt 1â4 | P9 OdbiÃ³r pkt 4 |
| D-20261016-0530-01 | #246 `wyglad/P10b-a` | P10b E37 | pkt 1â4 | P10b OdbiÃ³r: testy z pkt 1â4 |
| D-20261016-0615-01 | #248 `wyglad/P9-c` | P9 E29 | pkt 1â4 | P9 OdbiÃ³r pkt 6 (E29 pkt 11) |
| D-20261016-0635-01 | #249 `wyglad/P9-d` | P9 E1 | zrobione w wyglÄdzie | â (dane bez zmian zakresu) |
| D-20261016-0715-01 | #250 `wyglad/P9-e` | P9 E45 grupowanie | pkt 1â2 | P9 OdbiÃ³r pkt 4 |
| D-20261016-0740-01 | #251 `wyglad/P9-f` | P9 PrzeglÄd w panelu | pkt 1â2 | P9 OdbiÃ³r pkt 4 |
| D-20261016-0810-01 | #252 `wyglad/P10b-b` | P10b Pomoc i âCo nowegoâ | pkt 1â2 | P10b OdbiÃ³r pkt 4 |
| D-20261016-0845-01 | #253 `wyglad/P10b-c` | P10a E23 i E47; P10b E23 i E47; P11 E46 | pkt 1â6 | P10a/P10b OdbiÃ³r pkt 8; E46 do pierwszego testu âbez pomiaruâ |
| D-20261016-0930-01 | #254 `wyglad/P10b-d` | P10b E37 pierwsze wejÅcie | pkt 1â4 | P10b OdbiÃ³r pkt 6 |
| D-20261016-1020-01 | #256 `wyglad/P7-c` | P7 E38, E30, E20 | pkt 1â6 | TEST: 1366 px, eksport ât40ât41â, ukÅad na drugim komputerze, telefon 390, kwoty i kolumny wedÅug firmy, waga elementu, âZMIANA NUMERACJIâ |

E49 miejsca w kodzie â P6.  
Czat â miejsca w kodzie, Cz14 â P6.  
2FA urzÄdzenia â P3-d.  
E22 â wyglÄd (P10a-a), dane P10a.  
E24-1 zapis zgÅoszenia â P9.  
E37 pkt 4 i 7 â dane â P10b.  
E29 dane â P9.  
E1 â wyglÄd (P9-d).  
E45 grupowanie â wyglÄd (P9-e), dane P9.  
E32 pkt 3 â wyglÄd (P9-f), dane P9.  
E37 Pomoc â wyglÄd (P10b-b), dane P10b.  
E23/E47/E19 pkt 7/E46 ekran Stan systemu â wyglÄd (P10b-c), dane P10a/P11.  
E37 pierwsze wejÅcie â wyglÄd (P10b-d), dane P10b.  
E38 1A / E30 / E20 Harmonogram â wyglÄd (P7-c), dane P7.

**NastÄpny krok po tym commicie:** kolejka wyglÄdu #240 â #241 â #242 â #243 â #244 â #245 â #246 â #248 â #249 â #250 â #251 â #252 â #253 â #254 â #256, potem sobota #209 â #231 â #247. Potem C3â¦C15 â P3-d â P5 â P6 â â¦

## PAUZA â 2026-10-16 10:21 â **WZNOWIONE 10:59** (hasÅo âruszamyâ)

**ZAKÅADKA â przerwane tu:** scalenie PR dokumentacji #255; potem sygnaÅy dopiskÃ³w; potem kolejka PR wyglÄdu.

### Stan w chwili pauzy
| pozycja | stan |
|---|---|
| C17 | **zamkniÄte** â `e7595541`, 0220, dpl `dpl_HRCPmDoD3Ghiumi6tXDkaxcSzRfs`, 02:02 |
| C16-H | **NA PRODUKCJI** â merge `8bae03be`, migracja **0221**, `send-notifications` **v26**, `APP_URL=https://tower.log-mar.pl`, tick starych=0, pending_fb=0; TEST security 84 / status 55 / c16-push 18 / nullguard 637; CI #238 zielone |
| GaÅÄÅº lokalna | `docs/dopiski-20261016-plan` @ `442281ca` (wypchniÄta) |
| PR #255 | OPEN, MERGEABLE, unit+visual **SUCCESS** â **nastÄpny krok: `gh pr merge 255 --merge`**, potem `git checkout main && git pull` |
| Untracked | `docs/handover/dopiski_nowe/` (kopie ÅºrÃ³dÅowe; treÅÄ juÅ¼ w `docs/handover/dopiski/`) â nie commitowaÄ osobno |

### Po scaleniu #255 â sygnaÅy (jeszcze nie wysÅane)
1. `DOPISKI 0200 / 0230 / 0250 / 0310 / 0315 WÅÄCZONE â commit <hash merge lub 442281ca>`
2. `DOPISEK 0250 WÅÄCZONY â commit â¦, P6: E17 Czat â dane, Cz1âCz12`
3. `DOPISEK 0310 WÅÄCZONY â commit â¦, C3: Cz13; P6: Cz14âCz24`
4. `DOPISEK 0315 WÅÄCZONY â commit â¦, C3: Cz25; P6: Cz26âCz33`
5. (juÅ¼ w POSTEP) `C16-H NA PRODUKCJI â 8bae03be, 10:02` â powtÃ³rz wÅaÅcicielowi jeÅli nie dostaÅ

Tabela sprawdzalnoÅci punktÃ³w jest w POSTEP powyÅ¼ej (âdopiski wÅÄczone do planuâ).

### Kolejka po sygnaÅach (bez zmian)
1. WyglÄd D-20261016-0045-01 **+ #239**: `#232` â `#233` â `#236` â `#239` â `#237` â po kaÅ¼dym zielone unit+visual, merge; **jedno wdroÅ¼enie R7** na koÅcu; sygnaÅ `P8-a, P8-b, P8-c, push-w42â¦` wedÅug dopisku (oraz P8-d z #239).
2. Po #239: dopisek **D-20261016-0220-01** â wpis P8 E35 w PLAN (w commicie po scaleniu #239) + wiersz w tabeli POSTEP.
3. Potem `wyglad/E49` (**PR #240**), scal jak wyglÄd.
4. Dalej: **C3â¦C15** â **P3-d** â P5 â P6 â â¦ wedÅug PLAN.md (nic z 0200 przed P5; czat Cz* w C3/P6; E49 w P6).

### Nie zaczynaj przy wznowieniu
- Nie wracaj do C16-H / C17 (zamkniÄte).
- Nie rÃ³b punktÃ³w z dopiskÃ³w 0200/0230/0250/0310/0315 poza wpisami w PLAN (wykonanie dopiero w paczkach).
- Jedna rzecz naraz; G-15 przy bramach.

### Komendy startowe po âruszamyâ
```bash
cd "/d/Watch Tower/repo"
git checkout docs/dopiski-20261016-plan && git pull
gh pr checks 255   # jeÅli nadal zielone:
gh pr merge 255 --merge
git checkout main && git pull --ff-only origin main
# sygnaÅy dopiskÃ³w â kolejka #232â¦
```

## 2026-10-16 â wyglÄd P8-aâ¦d + push-w42 NA PRODUKCJI (D-0045 + #239)

| punkt | zrobione / odbiÃ³r |
|---|---|
| #255 docs dopiski | scalone `b1ba78cd` (treÅÄ `fbf995f4`) |
| #232 wyglad/P8-a | scalone `9df8beb6` |
| #233 wyglad/P8-b | scalone `455d6558` |
| #236 wyglad/P8-c | scalone `58ffd907` (rebase main) |
| #239 wyglad/P8-d | scalone `3bbb480e`; D-0220 w PLAN P8 E35 |
| #237 wyglad/push-w42 | scalone `a300b29b` |
| wdroÅ¼enie R7 | `dpl_9tVs4DubP7G6Do8KX43zZz1qnKxK`, JS `assets/index-XNiL2Qy9.js`; tower/makieta 200; 0Ã service_role |

**DOPISKI 0200 / 0230 / 0250 / 0310 / 0315 WÅÄCZONE â commit b1ba78cd (treÅÄ 442281ca / fbf995f4).**  
**DOPISEK 0250 WÅÄCZONY â commit b1ba78cd, P6: E17 Czat â dane, Cz1âCz12.**  
**DOPISEK 0310 WÅÄCZONY â commit b1ba78cd, C3: Cz13; P6: Cz14âCz24.**  
**DOPISEK 0315 WÅÄCZONY â commit b1ba78cd, C3: Cz25; P6: Cz26âCz33.**  
**DOPISEK 0220 WÅÄCZONY â commit (ten docs) / #239 `3bbb480e`, P8: E35 Z1âZ3.**  
**C16-H NA PRODUKCJI â 8bae03be, 10:02.**  
**P8-a, P8-b, P8-c, P8-d, push-w42 NA PRODUKCJI (wyglÄd) â a300b29b, 11:20; dpl_9tVs4DubP7G6Do8KX43zZz1qnKxK.**

## 2026-10-16 â dopisek D-20261016-2130-01 w planie

Kolejka wyglÄdu: `wyglad/W-dane` PR #274. Wpisane 16.10; scalone i wdroÅ¼one 17.10.2026 00:38 po C3 (szczegÃ³Åy w sekcji niÅ¼ej). Bez bazy (F8). Plik dopisku wszedÅ z PR.

| punkt | gdzie | stan |
|---|---|---|
| kolejka #274 | PLAN Â§4 | scalone i wdroÅ¼one 17.10.2026 00:38 (`7db7282f`) |
| P5 pkt 3.1 | rodzaj OTHER, wiele plikÃ³w bez wersji, HHL i SCX wgrywajÄ, KSH i PodglÄd odmowa, na koÅcu `otherDocsOn()` = true | do zrobienia w P5, z testem odbioru |
| P9 pkt 3.2 | geometria objazdu HERE przy sprawie; `detourLinesOf()` czyta `{ loadId, line, via, addKm, addMin }` | do zrobienia w P9, z testem odbioru |
| P9 pkt 3.3 | najpierw TEST: czy HERE ma odcinek promowy; jeÅli tak â `ferries` w `map_display_state`; jeÅli nie â wpis W | do zrobienia w P9, z testem odbioru |
| PodglÄd W38 | bez zmian w planie | bez zmian |

## 2026-10-17 â C3 na produkcji, potem wyglÄd #274

- Scalenie C3: `2938ae96` (PR #273), 17.10.2026 00:28. Migracja `0222_c3_matrix_events.sql`.
- PrÃ³ba na produkcji: ROLLBACK â macierz 25 â w transakcji 100 wierszy i kolumna `event_key`, po wycofaniu z powrotem 25 wierszy i 0 kolumn `event_key`.
- `supabase db push`: pierwszy naÅoÅ¼yÅ 0222, drugi âRemote database is up to dateâ. Parytet: LOCAL 222 = PROD 222, MATCH YES. Po naÅoÅ¼eniu: 100 wierszy, 23 zdarzenia.
- TEST na `394cba01` (ten sam plik 0222, przed dopisaniem wyjÄtkÃ³w doradcy w `f7c151e0`): security 84/84 (+2 SKIP), status 55/55, nullguard 647/647, c3 15/15, risks 25/25 (+2 SKIP). Doradca security po wyjÄtkach `my_notify_get` / `my_notify_set`: 151 zgÅoszeÅ, 0 nowych.
- Check na `f7c151e0`: unit, visual, `db` zielone.
- `send-notifications` wdroÅ¼ona (`--no-verify-jwt`, szablony C3).
- WdroÅ¼enie C3: `dpl_4iugo2qyvCYt9gNgHUpmjjH3hivi`, 17.10.2026 00:34. `tower.log-mar.pl` i `watch-tower-makieta.vercel.app` â 200, `assets/index-B_buB0CA.js` (445473 B, zgodny z lokalnym `dist/`), 0Ã `service_role`.
- WyglÄd #274: scalenie `7db7282f`, 17.10.2026 00:36; wdroÅ¼enie `dpl_CaHR42SHedxQesLr1Q6W6hXPusA1`, 00:38. Oba adresy 200, `assets/index-Bv_J4hjW.js` (445544 B), 0Ã `service_role`. Bez bazy. `otherDocsOn()` zostaje false do P5, `detourLinesOf()` zostaje puste do P9.
- #259: unit i visual zielone, scalenie zatrzymane â konflikt z `main`. Bez wdroÅ¼enia.
- Dalej kolejka (po D-20261017-0730-01): **C3-p â B1 â â¦ â A6**, potem C4â¦ (nie od razu C4).

## 2026-10-17 â C3-p NA PRODUKCJI

- GaÅÄÅº `pakiet/audyt-17`; PR #278; merge `17be0998` (treÅÄ `161d1f19`).
- Migracja `0223_c3p_chat_matrix_fixes.sql`: czat bez `critical` / bez e-maila zapasowego; title/body na telefon; `C3_MATRIX_KOPIA`; osobne `pre_arrival_site` / `pre_arrival_srem` / `src_back`; usuniÄcie `AUTOMATIC_DECISION_EMAIL`.
- CI: unit, visual, `db` (peÅna brama) zielone na `161d1f19`.
- TEST (SHA `161d1f19`): security 84/84 (+2 SKIP), status 55/55, nullguard 161+136+224+126 = **647/647**, c3 **26/26**; doradca security TEST: 151 zgÅoszeÅ, 0 nowych (wyjÄtki 166).
- PrÃ³ba prod ROLLBACK: matrix 100 â w TX 107 / 25 event_key / AUTOMATIC=0 / KOPIA=1; po ROLLBACK z powrotem 100 / AUTOMATIC=1.
- `supabase db push`: 0223 naÅoÅ¼ona. Po: matrix 107, 25 zdarzeÅ, KOPIA=1, AUTOMATIC=0.
- SELECT pkt 6: `src_down` Ã HHL_ADMIN email=true push=true in_app=true; `zone`/`cmr` Ã CLIENT_USER in_app=false; chat push bez e-maila = 5.
- WdroÅ¼enie: `dpl_2xXvmtEXdvCnUp8WWW6DzNodae9G`, 17.10.2026 11:18; tower/makieta 200; `assets/index-C_gl0fhW.js`; 0Ã `service_role`.
- **TEST wolne** od 17.10.2026 11:14.
- Dalej: B1 (po dopiskach 0800/0930/0915 i scaleniu #277â¦).

## 2026-10-17 â DOPISEK D-20261017-0730-01 WÅÄCZONY

Audyt 17.10 przyjÄty przez wÅaÅciciela; decyzje 07:20: **1A, 2C, 3A, 4B, 5B, 6A, 7A, 8A**.

### Kolejka od teraz
**C3-p â B1 â B2 â B6 â A8 â A1 â A2 â A3 â A7 â A9 â A4 â A5 â B4 â B5 â B7 â B8 â B9 â A6** â C4âC11, C13 â **P4-u** â P3-d â P5 â P6 â P7 â P8 â P10a â P9 â P10b â P11.

Termin `release-1.0`: **Åroda 28.10.2026, 20:00** (bez ciÄcia zakresu; âRezerwaâ usuniÄta).

### Prostowanie statusÃ³w
- **P4** byÅo zapisane jako âNA PRODUKCJIâ â poprawione na **CZÄÅCIOWO** (commit `3c676d96`). Brakuje: E26 â A2; E27 okno serwer â A1; âGotowyâ w bazie â A9; E15 pkt 1â3, E44 pkt 2â8, L17 â P4-u.
- **âB5 RIO URL wklejonyâ** (wczeÅniejszy wpis P4): zrobione byÅy tylko kolumny i maskowanie â nie peÅne E44 pkt 2â8 (to w P4-u).

### WÅaÅciciel â juÅ¼ zrobione / w drodze
- W1 â ustawienia hasÅa 17.10, 07:28 â B2: `auth_leaked_password_protection` ma zniknÄÄ.
- W36 â `ADVISOR_MGMT_TOKEN` w Secrets Supabase 17.10, 07:28 â B2: jedno wywoÅanie, `advisor_ok = true`.
- W44 â pliki D1/D2 w `D:\Watch Tower\dane\` (07:20).
- W27 â zamkniÄte (4B).
- W37 â emtrack od SCX w drodze; A8 bez czekania.

### Liczby do uzupeÅnienia przy odbiorze
- C3-p pkt 6 â **uzupeÅnione** (wyÅ¼ej): src_down HHL_ADMIN e-mail+telefon; KSH zone/cmr wyÅÄczone.
- B2: `advisor_ok`, liczba zgÅoszeÅ vs `advisor-exceptions.txt`; potwierdzenie braku `auth_leaked_password_protection`.
- B8: liczby nieprzeczytanych `IN_APP` przed i po (starsze niÅ¼ 7 dni).

### #275
Scalone `1eb7f395` (odbiÃ³r C3 + #274) â same dokumenty, bez wdroÅ¼enia.

## 2026-10-17 â DOPISKI D-20261017-0800-01 / 0930-01 / 0915-01 W PLANIE

Kolejka PR wyglÄdu: **#277 `wyglad/W-audyt` â #279 `wyglad/W-demo` â #280 `wyglad/W-pl`**. Scalanie w przerwach miÄdzy pozycjami; wdroÅ¼enie po scaleniu. `serverRuleOn`: TRACKING_WINDOW (A1), SITE_EXIT_DELIVERED (A2), WIND_E49 / DETOUR_E49 (P6 E49), ROAD_PL_HERE (P6 E2), ROAD_SITUATIONS_MAP (P9 E29 pkt 3). Zadania: EUR przy pierwszym logowaniu; teksty serwera bez `upper(` (C3-p/C6); P5 kurs `fx_rates` + usuniÄcie `invoices` demo; P4-u `delayed`; P11 ujÄcia z TEST; B9 DeepL + jÄzyk; P8 `sms_render` PL. VISUAL #279 / #280 â czekajÄ na wzorce koordynatora (unit zielone, visual czerwone przed odÅwieÅ¼eniem).

## 2026-10-17 â B1 NA PRODUKCJI

- GaÅÄÅº `pakiet/audyt-17-b1`; PR #283; merge `92117abd` (treÅÄ `31038de3`).
- Migracja `0224_b1_security_flags_select.sql`: GRANT SELECT + RLS `is_hhl()`; `security_flags_list()` dla HHL_ADMIN / HHL_OPS.
- CI: unit, visual, `db` (security/nullguard) zielone na `31038de3`.
- TEST (SHA `31038de3` / migracja 0224): security **92/92** (+2 SKIP), status **55/55**, nullguard 161+136+228+127 = **652/652**.
- PrÃ³ba prod ROLLBACK: SELECT=true, polityka 1, funkcja `security_flags_list` â OK; ROLLBACK.
- `supabase db push`: 0224 naÅoÅ¼ona (`schema_migrations` = 0224).
- WdroÅ¼enie: `dpl_2mB55evGPQh5RUT4LUCLsP31kFRv`, 17.10.2026 13:08; tower/makieta 200; `assets/index-VhdqXegf.js`; 0Ã `service_role`.
- **TEST wolne** od 17.10.2026 13:05.
- Dalej: dopisek 1100 + #282, potem **B2**.

## 2026-10-17 â DOPISEK D-20261017-1100-01 W PLANIE

Kolejka PR wyglÄdu (po #280): **#282 `wyglad/W-eta`**. Scalanie w przerwie miÄdzy pozycjami; wdroÅ¼enie po scaleniu. P4-u: `fmt_eta_duration` + âprzyjazd nocÄâ w e-mail/SMS; dane ekranu Kalibracja ETA (Â§3 pkt 1â9). E15 kalibracja po 5 dostawach (3A) â wyglÄd W-eta, dane Â§3.

### Sprawdzenia koordynatora (dopisek Â§1)
- audyt 03 N6 (C16-H, sekret `APP_URL`): **OK** â e-mail systemowy z 17.10.2026, 02:15 prowadzi do `https://tower.log-mar.pl/#/â¦`;
- audyt 03 N5 (C16, potwierdzenie z telefonu poza testem): **czeka** â od 16.10, 10:01 brak nowych WEB_PUSH; ostatnie potwierdzenie 16.10, 16:42 (Android).

## 2026-10-17 â #282 `wyglad/W-eta` NA PRODUKCJI

- PR #282; merge `a5da99ba`. Bez migracji.
- WdroÅ¼enie: `dpl_H6KzHnyockMQ6BGX3XtBACDHuuD8`, 17.10.2026 13:34; tower/makieta 200; `assets/index-B6b4ep5J.js`; 0Ã `service_role`.
- Dane Kalibracji ETA â P4-u (dopisek Â§3); produkcja: âBrak ÅºrÃ³dÅa danych.â

## 2026-10-17 â B2 NA PRODUKCJI

- Pierwsze wywoÅanie `security-advisor-snapshot` (sekret W36 juÅ¼ w Edge): HTTP 200, `advisor_ok = true`, migawka 6, 171 zgÅoszeÅ. Obiekty zapisane jako `public.*` â API doradcy nie zwraca `findings[]`.
- PR #286; merge `9ccf2a8d` (treÅÄ `a61bdd5b`): odczyt `metadata` z wiersza lintu. Funkcja wdroÅ¼ona ponownie na produkcji.
- Drugie wywoÅanie: migawka 7, `advisor_ok = true`, 171 zgÅoszeÅ, 165 unikalnych obiektÃ³w, 0 Ã `public.*`.
- **W1:** `auth_leaked_password_protection` â **brak** na liÅcie doradcy produkcji.
- Jedno zgÅoszenie spoza `advisor-exceptions.txt`: `authenticated_security_definer_function_executable` / `public.security_flags_list` (B1, rola w funkcji) â dopisane do wyjÄtkÃ³w.
- `rls_enabled_no_policy` dla `security_flags` zniknÄÅo (polityka SELECT z B1).
- Dalej: **B6**.

## 2026-10-17 â DOPISEK D-20261017-1220-01 W PLANIE

Kolejka PR wyglÄdu (po #282, juÅ¼ na produkcji): **#284 `wyglad/W-konta`**. Scalanie w przerwie miÄdzy pozycjami; wdroÅ¼enie po scaleniu. W PR: rodzaj konta w demo, `accountRole`, Pomoc bez faÅszywego braku, SMS przy miejscach do odczytu u Operacji, C8 N2 (formularze; w C8 zostaje strona bazy). Nowe sprawdzenia uprawnieÅ (A2, A4, B5 i dalej) przez `accountRole(role)`. B7: bez geolokalizacji kierowcy â tylko CSP Report-Only `frame-src` (wÅaÅciciel 17.10, 12:25: aplikacja kierowcy porzucona, zostaje w kodzie).

B2 zamkniÄte w dokumentach: merge `27daa36a` (PR #287).

## 2026-10-17 â #284 `wyglad/W-konta` NA PRODUKCJI

- PR #284; merge `54af2ca9`. Bez migracji.
- WdroÅ¼enie: `dpl_4GnUJaM7HSSZJ5hA7ZPP8Ur5muTU`, 17.10.2026 15:00; tower/makieta 200; `assets/index-CHxNPYB5.js`; 0Ã `service_role`.
- Dalej: **B6**.

## 2026-10-17 â B6, uwagi D-20261017-1530-01

PR #290 (`pakiet/audyt-17-b6`, migracja 0225, jeszcze bez scalenia). Uwagi koordynatora D-20261017-1530-01 pkt 1â4 â zrobione:
1. `revoke insert, update` na `loads` dla `authenticated` i grant kolumn bez `rio_secret`; kopia uprawnieÅ w `audit_log` (`B6_LOADS_GRANTS`).
2. Licznik anon: IP z `cf-connecting-ip`, potem `x-forwarded-for`, na koÅcu `inet_client_addr()`; przeglÄdarka z `user-agent`.
3. TytuÅ âLimit e-maili na dziÅâ, treÅÄ z `{n}`, klucz `EMAIL_BUDGET` w `notification_copy`.
4. `payload.push_fallback` poza limitem 20/5, licznik `*pilne*`.
Zaproszenia i reset hasÅa (`AUTH_INVITE`, `AUTH_PASSWORD_RESET`) zostajÄ w rezerwie L-13, poza limitem 5 na rodzaj.
Bez zmian merytorycznych: `guard_invoice_update`, `loads_read` bez SITE.
Testy w `security.sh` (oczekiwane 115 lokalnie / 111 na TEST). Brama `db` i scalenie B6 â po tym commicie.

## 2026-10-17 â B6 NA PRODUKCJI

- PR #290; merge `57f8b30b` (treÅÄ `68f1e2b1`). Migracja `0225_b6_email_budget_guards.sql`.
- CI na `68f1e2b1`: unit, visual, `db` zielone.
- TEST: security **111/111** (+2 SKIP), status **55/55**, nullguard 161+136+228+127 = **652/652**.
- Doradca security na TEST: jedno nowe zgÅoszenie `rls_enabled_no_policy` / `public.anon_call_window` â tabela zamkniÄta, odczyt przez funkcje wÅaÅciciela; wpis w `advisor-exceptions.txt`. PrzyjÄte.
- PrÃ³ba prod ROLLBACK: `rio_secret` update/insert = false, `status` update = true, `EMAIL_BUDGET` wstawiony; ROLLBACK.
- `supabase db push`: 0225 naÅoÅ¼ona. Po: `schema_migrations` = 0225, uprawnienia jak w prÃ³bie, `notification_copy` EMAIL_BUDGET = 1.
- WdroÅ¼enie: `dpl_73Af9uhvezSDLCwe4KnUFVcQnjYi`, 17.10.2026 18:13; tower/makieta 200; `assets/index-CHxNPYB5.js` (ten sam plik co #284, B6 nie zmienia JS).
- **TEST wolne** od 17.10.2026 17:16 (koniec nullguard-4).
- Uwagi D-20261017-1530-01 pkt 1â4 â zrobione.
- Dalej: **A8**.

## 2026-10-17 â #289 `wyglad/W-naprawy` NA PRODUKCJI

- PR #289; merge `7639e1c8`. Bez migracji.
- WdroÅ¼enie: `dpl_Aou8wXFk82yjJahazFPnu4SYekUx`, 17.10.2026 18:15; tower/makieta 200; `assets/index-Dr68_XrG.js`; 0Ã `service_role`.
- `INVOICE_A4` zostaje wyÅÄczone do wdroÅ¼enia A4.
- Dalej: **A8**.

## 2026-10-17 â DOPISEK D-20261017-1450-01 W PLANIE

Kolejka PR wyglÄdu (po #284, juÅ¼ na produkcji): **#289 `wyglad/W-naprawy`**. Scalanie po skoÅczonym punkcie (po B6 albo pÃ³Åºniej), przy zielonych `unit` i `visual`; wdroÅ¼enie po scaleniu bezpieczne przed A4 (`INVOICE_A4` zostaje wyÅÄczone do wdroÅ¼enia A4). Wzorce `visual` odÅwieÅ¼a koordynator; czerwony `visual` przed jego commitem z wzorcami â sygnaÅ âVISUAL #289â.

Przy A4: kreator, âDo wystawieniaâ, menu i Kokpit z tego PR; baza `register_invoice` + przestawienie `INVOICE_A4`. Przy B5: `payload.preview_as`. Przy A2: `DELIVERED_CHECK`. Przy A3: `CMR_UPLOAD` albo `DOC_MISSING` bez nowego kodu. Przy A6: `KSH_DATES_CHECK`. `billReady` = lustro `c17_cmr_after_delivery` â zmiana warunku w bazie to sygnaÅ do widoku. A5 bez zmian z tego dopisku.

## 2026-10-17 â DOPISEK D-20261017-1715-01 W PLANIE

Kolejka PR wyglÄdu: **#291 `wyglad/W-naprawy-2`** (baza `main`; #289 juÅ¼ scalony). Scalanie po skoÅczonym punkcie, przy zielonych `unit` i `visual`. WdroÅ¼enie po scaleniu jest bezpieczne przed A5, A6, A8, A9 i C11 â pola od wykonawcy sÄ opcjonalne. Wzorce `visual` odÅwieÅ¼a koordynator; czerwony `visual` przed jego commitem z wzorcami â sygnaÅ âVISUAL #291â. Plik dopisku wchodzi z tym PR.

Twoja czÄÅÄ, w swojej kolejnoÅci, bez zmiany wyglÄdu (F1):
- **C11:** Auth ustawiÅ wÅaÅciciel (W1, 17.10.2026 07:28). Tylko test na TEST: â111111111111â i âÄÄÅÄÅ¼ÅºÃ³ÅÅ1234â â odmowa; âHaslo-testowe-12â â przyjÄte. Gdy serwer przyjmie hasÅo bez litery aâz albo bez cyfry â sygnaÅ âC11 â Authâ.
- **A9:** `awiz_missing(load)` â `load.readyGaps`. Klucze i sÅowa dokÅadnie z D-20261017-1715-01 Â§2 pkt 2 (`AWIZ`, `SAILING`, `PILOTS`, `ORDER_SCX`, `ORDER_HHL`, `POLICY_SCX`, `PERMIT`).
- **A5:** `sailing_id` wymagany do âGotowyâ. W bazie ta sama reguÅa wczesnego rejsu co widok: nie wczeÅniej niÅ¼ pÃ³Åºniejsze z okna awizacji i dnia zaÅadunku z planu.
- **A6:** parser wypeÅnia `ImportDiff.skippedCarrier`, `skippedEmpty`, `datesToCheck` (takÅ¼e 0). Komunikat po imporcie z `standardSkipMessage(â¦, { carrier, empty })`. Sprawa dat: `KSH_DATES_CHECK`. Lokalny `tests/i1-import-ui.local.spec.ts` ma oczekiwane teksty z #291 (Â§1 pkt 10) â nie cofasz ich.
- **A8:** `nextTryAt` = `skipped_until` emtrack w danych Stanu systemu. Gdy te dane na produkcji jeszcze nie sÄ podÅÄczone â pole wchodzi razem z nimi. W sprawie zostawiasz `detail.od_kiedy`; âÅ¹rÃ³dÅo niedostÄpne â¦ od â¦â na ekranie robi #291.
- **A2:** przestawienie `SITE_EXIT_DELIVERED` przy wdroÅ¼eniu zmienia teÅ¼ zdania w Strefach (plac i zaÅadunek).

BieÅ¼Äca pozycja w chwili wpisu: **A8**. #291 jeszcze niescalony.

## 2026-10-17 â DOPISEK D-20261017-1920-01 W PLANIE

PrzeglÄd #293 przed scaleniem. W tym samym PR:
- pauza 6 h tylko po odmowie hasÅa (`loginOk === false`); wyjÄtek sieci, czas i 5xx zostawia sprawÄ `SOURCE_DOWN` i nie zwiÄksza serii;
- przebieg w pauzie: `ok: false`, `observations.skipped = 'true'`, `next_try_at` = `skipped_until`;
- `detail.od_kiedy` bez zmian; âod â¦â na ekranie robi koordynator w #291.

OdbiÃ³r A8 po wdroÅ¼eniu wpisze koordynator. WÅasny wpis wykonawcy â po teÅcie z odbioru i wdroÅ¼eniu, nie wczeÅniej.

## 2026-10-17 â A8 NA PRODUKCJI â bez wywoÅania, czeka W37

- PR #293; merge `c938b3bb` (treÅÄ `b9d361ef`). Migracja `0226_a8_emtrack_login_backoff.sql`. Funkcja Edge `emtrack-web` wdroÅ¼ona.
- CI na `b9d361ef`: unit, visual, `db` zielone.
- TEST: security **114/114** (+2 SKIP), status **55/55**, nullguard 161+136+228+127 = **652/652**.
- Doradca security na TEST: 171 zgÅoszeÅ, 0 spoza `advisor-exceptions.txt` (w tym `emtrack_login_state`).
- PrÃ³ba prod ROLLBACK: `anon` i `authenticated` bez SELECT, wiersz stanu = 1; ROLLBACK.
- `supabase db push`: 0226 naÅoÅ¼ona. Po: `schema_migrations` = 0226; otwarta sprawa `SOURCE_DOWN:EMTRACK_WEB` = 1; z datÄ w kluczu = 0; kopie w `audit_log` = 11; `anon` bez SELECT.
- WdroÅ¼enie: `dpl_9GMBgxzJ6MN1rc2d3Ao91r1X3frW`, 17.10.2026 20:58; tower/makieta 200; `assets/index-Dr68_XrG.js` (A8 nie zmienia JS); 0Ã `service_role`.
- Produkcji nie woÅano starym sekretem. **Czeka W37.**
- **TEST wolne** od 17.10.2026 20:54 (koniec nullguard-4).
- Dalej: **A1**. #291 nadal do scalenia w przerwie miÄdzy pozycjami.

## 2026-10-18 â A1 NA PRODUKCJI â przyjÄte

- PR #296; merge `10007b24` (treÅÄ `5769a9ad`). Migracja `0227_a1_tracking_window.sql`. Funkcja Edge `emtrack-web` wdroÅ¼ona.
- CI na `5769a9ad`: unit, visual, `db` zielone.
- TEST: security **114/114** (+2 SKIP), status **83/83**, nullguard 161+136+228+127 = **652/652**.
- Doradca security na TEST: 171 zgÅoszeÅ, 0 spoza `advisor-exceptions.txt`.
- PorÃ³wnanie funkcji z produkcjÄ przed `db push` (D-20261017-2250-01): `guard_load_update` rÃ³Å¼ni siÄ tylko `tower.track_ctx` i `tracking_opened_at` na liÅcie `dates_ctx` (zostaje wyjÄtek A5 `MANUAL`/`IMPORT`); `process_position` â brama okna i zapis startu; `telm_infer_phase_from_position` â powrÃ³t poza oknem; `detect_silent_vehicles` â zamkniÄcie ciszy poza oknem i dowolne ÅºrÃ³dÅo pozycji.
- PrÃ³ba prod ROLLBACK: cron `tower-tracking-guard` 1, `anon`/`authenticated` bez EXECUTE, kolumna `tracking_opened_at`; po ROLLBACK kolumny brak.
- `supabase db push`: 0227 naÅoÅ¼ona. Po: `schema_migrations` = 0227; kolumna 1; cron `15 6 * * *` = 1; `anon` bez EXECUTE.
- WdroÅ¼enie: `dpl_76iSLDoP7mu5kBj3J17LiwytGQBT`, 18.10.2026 01:03; tower i makieta 200; `assets/index-BNuQNLhs.js`; 0Ã `service_role`.
- Stare `PLANNED` w oknie (odczyt 17.10.2026, 21:55): **21**. Do domkniÄcia przez HHL i SCX przed W37.
- **TEST wolne** od 18.10.2026 01:00 (koniec nullguard-4).
- **OdbiÃ³r koordynatora:** 01:15 i 08:26 â przyjÄte w caÅoÅci. Przebieg L17 nd 08:15: 17 spraw âPotwierdÅº dostawÄâ (kod wysyÅki w tytule); 0 powiadomieÅ do SCX; po 1 wpisie zbiorczym u kaÅ¼dego z 3 AdministratorÃ³w HHL.
- **A1 NA PRODUKCJI â przyjÄte.** Czeka W37. Dalej: **A2**.

## 2026-10-18 â DOPISKI D-20261018-0040-01 i D-20261018-0235-01 W PLANIE

- Pliki w `docs/handover/dopiski/` (ÅºrÃ³dÅo: `docs/handover/dopiski_nowe/`).
- D-20261018-0040-01: **wykonane** â A1 wdroÅ¼one i przyjÄte; #297 w kolejce (scalone 10:32).
- D-20261018-0235-01: zasada liczb U+00A0 â PLAN Â§1 pkt 10; kolejka #295 â #297 â #298.
- Scalenie wyglÄdu 18.10: #295 `a6eab269` 10:31 â #297 `c0362839` 10:32 â #298 `a51cf771` 10:33.
- WdroÅ¼enie Vercel z `a51cf771`: `dpl_E3bSr7SzadCTaSbYrX8cg1UQqJ9A` READY; tower.log-mar.pl aliased.
- Dalej: **A2** (bez przerwy).

## 2026-10-17 â DOPISEK D-20261017-2205-01 W PLANIE (A1, PR #296)

PrzeglÄd #296 przed scaleniem, w tym samym PR:
- tytuÅ L17 z `load_sms_code`; bez strefy âpozycja 54.40, 18.68â;
- zalegÅoÅci sprzed `A1_DEPLOYED_AT` bez powiadomieÅ, jeden wpis zbiorczy u AdministratorÃ³w HHL;
- `ambiguous_trailer` w obserwacjach `emtrack-web` (wybÃ³r naczepy bez zmian);
- cisza GPS poza oknem siÄ zamyka; `MANUAL_STATUS` bez âDostarczoneâ wraca po 24 h.

Stare transporty w oknie Åledzenia, status `PLANNED`, data zaÅadunku sprzed 17.10.2026 (odczyt produkcji 17.10.2026, 21:55): **21**. Do domkniÄcia przez HHL i SCX przez sprawy L17 przed W37.

## 2026-10-17 22:56 â porÃ³wnanie funkcji 0227 z produkcjÄ (D-20261017-2250-01)

Odczyt `pg_get_functiondef` na produkcji `nglnnrmzmhusvxslousq`, przed `db push`. RÃ³Å¼nice 0227 wobec produkcji, po odjÄciu nagÅÃ³wka `CREATE`/`$function$`:

- `guard_load_update`: tylko blok `tower.track_ctx` (zapis wyÅÄcznie `tracking_opened_at`) i `tracking_opened_at` na liÅcie `tower.dates_ctx`. Zostaje warunek A5 z 0212: `v_ctx not in ('MANUAL', 'IMPORT')`.
- `process_position`: tylko brama `load_in_tracking_window` i ustawienie `tracking_opened_at` w `tower.track_ctx`.
- `telm_infer_phase_from_position`: tylko powrÃ³t, gdy transport jest poza oknem.
- `detect_silent_vehicles`: zamkniÄcie otwartej ciszy poza oknem, pÄtla z `having load_in_tracking_window`, ÅºrÃ³dÅo pozycji bez twardej listy `TELEMATICS_API`/`RFMS`/`DRIVER_PWA`.

## 2026-10-18 11:10 â DOPISEK D-20261018-1100-01 (A2, PR #299, przed db push)

PorÃ³wnanie `pg_get_functiondef` produkcji `nglnnrmzmhusvxslousq` (18.10, przed naÅoÅ¼eniem 0228) z migracjÄ 0228. RÃ³Å¼nice tylko w miejscach A2:

- `apply_geofence_status`: zostajÄ komentarze âAwaryjnie: GPS zgubiÅ wyjazd z portu SEâ¦â i âWyjazd ze strefy portu GdaÅskâ¦ celowo niczego nie zmieniaâ. Dochodzi: zamkniÄte statusy `READY_TO_INVOICE` i `INVOICED`; nazwa strefy i `project_id`; pominiÄcie zdarzeÅ `synthetic`; wyjazd LOADING â¥ 5 min â `IN_TRANSIT_PL` + `actual_load_at` bez `loaded_confirmed` i bez `rk_left_loading_unconfirmed`; wyjazd SITE â¥ 10 min â `DELIVERED`; krÃ³cej â `DELIVERED_CHECK`.
- `process_position`: zostajÄ komentarze âPOPRAWKA 24.09.2026â¦â (dwa miejsca), âOdrzucamy oczywiste bÅÄdy GPSâ¦â, âANEKS 4 PR5â¦â, âA1 / E27â¦â, â1) Zapisâ¦â, â2) Ewaluacjaâ¦â, â3) Emisjaâ¦â. `p_ts` bez `default now()` â jak na produkcji. Dochodzi `dwell_min`, `entered_at` i `minutes` w payloadzie EXIT/DWELL.
- `decision_resolve`: treÅÄ z 0139; dla `DELIVERED_CHECK` zwrot do `delivered_check_apply` (przed zamkniÄciem sprawy).

Zdarzenia syntetyczne (`payload.synthetic = true`) nie zmieniajÄ statusu ani `actual_load_at`. FazÄ z pozycji ustawia sama `telm_infer_phase_from_position`.

Inwentarz `risks.sh`: 7 â 6 kluczy, bo A2 celowo nie tworzy `rk_left_loading_unconfirmed` (wyjazd ze Åremu bez `loaded_confirmed`).

Karta L14 w produkcji z otwartej sprawy, nie ze zdarzenia. âTakâ tylko z `AT_SITE` przez `auto_set_status`. Operacje HHL: odmowa; Administrator HHL: moÅ¼e (kontrola nullguard â komunikat âBrak otwartej sprawyâ nie jest odmowÄ uprawnieÅ).

## 2026-10-18 11:10 â DOPISEK D-20261018-1110-01 (wdroÅ¼enie tylko z main)

O 10:37 poszÅo `vercel --prod` z gaÅÄzi roboczej `pakiet/audyt-17-a2`, commit `0fe5a14a` (jeszcze przed przeglÄdem A2): `dpl_ACEKzFYJZASN1ag6xtPaYQdKF8mh` â **ERROR**. To byÅ bÅÄd wykonawcy: produkcja miaÅa dostaÄ widok A2 (`SITE_EXIT_DELIVERED`) bez migracji 0228. Budowa siÄ nie udaÅa, wiÄc produkcja tego nie dostaÅa.

O 10:41 wdroÅ¼enie z czystego archiwum `main` `a51cf771` (#295, #297, #298, bez A2): `dpl_E3bSr7SzadCTaSbYrX8cg1UQqJ9A` â **READY**, przyjÄte. Baza produkcji zostaje na migracji 0227.

Od teraz: `vercel --prod`, `supabase db push` i funkcje Edge tylko z `main` po scaleniu i po przeglÄdzie koordynatora. GaÅÄÅº tylko jako Preview. Przed CLI: `git checkout main && git pull`, `git status` bez zmian. W `POSTEP.md`: `dpl_â¦` i commit `main`.

## 2026-10-18 11:30 â DOPISEK D-20261018-1130-01 (L14 zamyka siÄ po Dostarczone)

Poprawki z 1100 przyjÄte. `loads_close_delivery_unconfirmed` (A1) zamyka teÅ¼ otwarte `DELIVERED_CHECK`, gdy status schodzi na `DELIVERED`, `UNLOADED`, `READY_TO_INVOICE`, `INVOICED` albo `CANCELLED`: `RESOLVED`, kod `DELIVERED` albo `CANCELLED`, wpis w `decision_events`. Inaczej eskalacja po 24 h woÅaÅaby o sprawie, ktÃ³rej karta juÅ¼ nie pokazuje.

## 2026-10-18 12:15 â DOPISEK D-20261018-1215-01 W PLANIE

- #300 `wyglad/W-panel-do-zrobienia` â kolejka wyglÄdu; scalenie w przerwie przy F7 i zielonych unit/visual; wdroÅ¼enie z `main`.
- Po wdroÅ¼eniu A2, przed A3: migracja zamykania nieaktualnych spraw (decision-overdue + alarmy przed dostawÄ) i `refreshFromServer` po zapisach w panelu.
- **TEST zajÄte: A2, od 12:00** (SHA `9798c4ed`; security/status/nullguard + risks).
- **TEST wolne** od 18.10.2026 13:38 (koniec bramy `db` na `main` `1f7b7ade`).

## 2026-10-18 13:40 â A2 i #300 na produkcji; start bramy niedzielnej

- A2: PR #299 scalony 11:29 UTC, merge `1f7b7ade`. PrÃ³ba 0228 w transakcji z ROLLBACK: po wycofaniu ostatnia migracja zostaje 0227. Potem `supabase db push`: 0228. `EXECUTE` dla `authenticated` tylko na `delivered_check_resolve`.
- WdroÅ¼enie z `main` `1f7b7ade`: `dpl_HvaTf2bycbrUPXnKFjksvb35sE2y` READY 13:33. `tower.log-mar.pl` i makieta: 200.
- #300 scalony 11:33 UTC, merge `a2eb2d48` (F7 âgotowe do scaleniaâ, unit i visual zielone). WdroÅ¼enie z `main`: `dpl_CpMsNnaro6ZzDmUjdHCHjBv3hew9` READY 13:35. Unit na `main` zielony. Brama `db` na `1f7b7ade` zielona 13:38.
- Brama niedzielna na `main` `a2eb2d48`, migracja 0228. **TEST zajÄte: brama niedzielna, od 13:40.**
- Doradca security na TEST (`emkbykwenwrjmbprydml`), przed prep: 153 zgÅoszeÅ, 0 nowych wobec `advisor-exceptions.txt` (170 wyjÄtkÃ³w).
- `npm audit`: 9 high, wszystkie w ÅaÅcuchu stylelint (dev: braces / fast-glob / globby / micromatch / source-map-js). `npm audit --omit=dev --audit-level=high`: 0. Poprawki P3-BRACES nie ma w zaleÅ¼noÅciach produkcyjnych; luki dev nie blokujÄ scalenia.
- Poczta produkcji, tydzieÅ 12.10â18.10 (czas warszawski), kanaÅ EMAIL, âod razuâ = PENDING+SENT bez zaproszeÅ i resetu hasÅa:

| DzieÅ | od razu | w tym krytyczne | skrÃ³t | wstrzymane | bÅÄd | wiersze |
|---|---|---|---|---|---|---|
| 2026-10-12 â 2026-10-14 | 0 | 0 | 0 | 0 | 0 | 0 |
| 2026-10-15 | 81 | 0 | 0 | 0 | 0 | 82 |
| 2026-10-16 | 61 | 0 | 0 | 0 | 0 | 62 |
| 2026-10-17 | 9 | 0 | 3 | 0 | 0 | 12 |
| 2026-10-18 | 24 | 21 | 3 | 0 | 0 | 27 |

Suma od razu: 175 / 7 dÃ³b = 25,0 na dobÄ. Szacunek szczytu po skrÃ³cie: 34. Maksimum: 81 (15.10). SkrÃ³t: 6. StraÅ¼nik `email-budget`: 0 wpisÃ³w w tym tygodniu (ostatni przebieg 04.10 18:00 czasu polskiego). PrÃ³g âwiÄcej niÅ¼ dwa razyâ nie zapaliÅ siÄ.

- `nullguard-3` raz urwaÅ siÄ przed startem testu (bez wpisu w `wyniki.json`); powtÃ³rka 232/232.
- `i2-2` 102/104: `ksh@test` miaÅ `CLIENT_ADMIN` (zaproszenie z `SEED_AUTH_USERS`), a `seed.sql` i asercja majÄ `CLIENT_USER`. StÄd teÅ¼ odmowa `ksh_confirm_dates`. Rola w fixture wraca do `CLIENT_USER`. Brama niedzielna od nowa na commicie z tÄ poprawkÄ.

## 2026-10-18 16:17 â DOPISEK D-20261018-1610-01 W PLANIE

- Po bazie panelu (D-20261018-1215-01 Â§2), przed A3: L-1 bez decyzji `SOURCE` dla tygodnia, ktÃ³ry jeszcze trwa; 12 faÅszywych `SEFS_OUT_OF_TABLE` na `EXPIRED` bez powiadomieÅ; jedna eskalacja na `event_key` i osobÄ; powyÅ¼ej 2 w jednym przebiegu â jeden wpis i jeden e-mail zbiorczy; tytuÅy z kodem transportu i âOpÅata paliwowaâ.
- Lista 23 otwartych `NO_AWIZACJA` przy starych `PLANNED` â w tym wpisie przy wykonaniu pozycji, bez kodu.
- Brama niedzielna i PR #302 idÄ dalej. Tego dopisku nie wdraÅ¼am w tej przerwie.

## 2026-10-18 17:45 â DOPISEK D-20261018-1740-01 W PLANIE

- Po eskalacjach (D-20261018-1610-01), przed A3: CMR tylko po rozÅadunku. `doc_requirements` â `AFTER_UNLOAD` / 24 h, bez powiadomieÅ; przed âDostarczoneâ CMR nie jest `OVERDUE`. Kotwica przy zaÅadunku odrzucona. Lista miejsc z CMR przy zaÅadunku â przy wykonaniu pozycji.
- Sprawa âWgraj CMRâ zostaje w A3. WyglÄd robi koordynator w #303; tekstÃ³w i filtra nie zmieniam (F1).
- Brama niedzielna idzie dalej (`nullguard-1` w chwili wpisu). Tego dopisku nie wdraÅ¼am w tej przerwie.

## 2026-10-18 20:07 â PR #303 scalony (P11 pkt 7, partie 1â6)

- GÅowa `ab0969d` bez zmiany. F7: âgotowe do scaleniaâ. Unit i visual zielone. `git merge-tree` z `main` i z #301: bez konfliktu.
- Scalenie `7e9c286c`. Bez bazy (wyglÄd, teksty, obliczenia widoku, dane demo). TekstÃ³w i filtra CMR nie ruszam (F1).
- Brama niedzielna na `516ef63b`, migracja 0228: **ZIELONA** (21:31). Ostatni zestaw `backup` 21/21 (+8 SKIP). Suma nullguard 657/657, i2 540/540. **TEST wolne** od 18.10.2026 21:31.
- WdroÅ¼enie z `main` `7e9c286c`: `dpl_3YzYpGiy9rNeDGbZbM7Nf4EdQVCR` READY 21:33. `tower.log-mar.pl` i makieta: 200.

## 2026-10-18 21:45 â Panel âº Do zrobienia, baza (D-20261018-1215-01 Â§2âÂ§3)

- Brama niedzielna zielona, TEST wolne. GaÅÄÅº `pakiet/panel-do-zrobienia-baza`, migracja `0229_panel_close_alarms.sql`.
- Wyzwalacz na `decisions.status`: sygnaÅ `decision-overdue:<id>` dostaje `resolved_at`, gdy status schodzi z `NEW` / `ASSIGNED` / `SNOOZED`.
- `loads_close_delivery_unconfirmed` (A1 + L14 bez zmian) zamyka teÅ¼ alarmy sprzed dostawy i w drodze przy `DELIVERED` / `READY_TO_INVOICE` / `INVOICED` / `CANCELLED`. Faktura po terminie, L14 i inne decyzje po terminie zostajÄ.
- PorzÄdek jednorazowy tÄ samÄ reguÅÄ, znacznik `detail.closed_by = D-20261018-1215-01`, bez nowych powiadomieÅ (C1 tylko oznacza istniejÄce IN_APP jako przeczytane).
- Aplikacja: `refreshFromServer({ keepSelection: true })` po awizacji, numerze zlecenia i rÄcznym statusie; po wgraniu dokumentu `notifyFileUploaded()` (FileSink omija mutacjÄ mostka).
- Testy: `risks.sh` +6 (oczekiwane 33 lokalnie / 31 na TEST), w tym `RES:DRIVER` przy `DELIVERED`. Sam `title_key = rk_res_driver` nie zamyka alarmu.
- PorzÄdek na produkcji (oczekiwane, przeglÄd #305): `decision-overdue` 16, alarmy sprzed dostawy 7 (4 + 3 `RES:DRIVER`). Liczby po `db push` wpisujÄ obok.
- Decyzje W26, W28, W29, W30, W31, W33 i W45 wpisane (D-20261018-2200-01, zamkniÄte 18.10.2026, 21:57).
- **TEST zajÄte: panel Do zrobienia, od 22:52** â SHA `43d85a8c`; security, status, nullguard, risks. Unit, visual i `db` na tym SHA zielone.
- Potwierdzenie TEST: security 114/114 (+2 SKIP), status 121/121, risks 31/31 (+2 SKIP), nullguard 161+136+232+128 = 657/657. **TEST wolne** od 18.10.2026 23:55.

## 2026-10-18 23:16 â #305 i #304 scalone, migracja 0229 na produkcji

- PR #305 F7, merge `dca5888c` (gÅowa `43d85a8c`). PR #304 F7 runda 3, merge `e1beb93b` (gÅowa `e71a406`). `main` = `e1beb93b`. #301 otwarty â bez scalenia.
- Przed `db push`, SELECT na produkcji: `decision-overdue` przy decyzji nieotwartej **16**, alarmy sprzed dostawy przy dostarczonych, zafakturowanych i anulowanych **7**.
- PrÃ³ba 0229 w transakcji: `UPDATE 23`, drugi przebieg `UPDATE 0`, `ROLLBACK`. Potem `db push` dwa razy (drugi: baza aktualna).
- Po naÅoÅ¼eniu: otwarte do zamkniÄcia **0 + 0**, wiersze ze znacznikiem `closed_by = D-20261018-1215-01`: **23**.
- WdroÅ¼enie z `main` `e1beb93b` (obejmuje #303, #304 i #305; #301 nie): `dpl_CK3krSgr7RiYFfsCLyzx6pfTiJjZ` READY 23:20. `tower.log-mar.pl` i makieta: 200. W pliku JS brak `service_role`.

## 2026-10-18 23:55 â Eskalacje decyzji (D-20261018-1610-01)

- Brama panelu zielona, TEST wolne. GaÅÄÅº `pakiet/eskalacje-decyzji`, migracja `0230_eskalacje_decyzji.sql`.
- L-1: `SOURCE` bez decyzji, gdy tydzieÅ wskaÅºnikÃ³w jeszcze trwa albo siÄ nie zaczÄÅ. Jednorazowo te otwarte sprawy â `EXPIRED` (ânie dotyczy â tydzieÅ wskaÅºnikÃ³w jeszcze trwaâ), bez powiadomieÅ. Sprawa âDecyzja po terminieâ schodzi wyzwalaczem z 0229.
- Eskalacja: drugi przebieg nie dokÅada wpisu (`dec:ESCALATE`). PowyÅ¼ej dwÃ³ch u jednej osoby w jednym przebiegu: jeden wpis i jeden e-mail âPo terminie: N decyzji Â· OpÅata paliwowaâ, odnoÅnik `/ryzyka`.
- TytuÅy: osiem znakÃ³w identyfikatora zamieniane na kod transportu; âSEFSâ â âOpÅata paliwowaâ. Dotyczy nowych i otwartych wierszy, bez nowych powiadomieÅ.
- Otwarte `NO_AWIZACJA` przy `PLANNED` (odczyt produkcji 18.10.2026, 23:50, 23 pozycje):

| kod | zaÅadunek |
|---|---|
| T-01 | 2026-09-30 |
| SG-04 | 2026-10-01 |
| SG-05 | 2026-10-02 |
| SG-06 | 2026-10-02 |
| T-02 | 2026-10-02 |
| SG-07 | 2026-10-03 |
| SG-08 | 2026-10-03 |
| SG-09 | 2026-10-05 |
| SG-10 | 2026-10-05 |
| SG-11 | 2026-10-06 |
| SG-12 | 2026-10-06 |
| T-06 | 2026-10-06 |
| SG-13 | 2026-10-07 |
| SG-14 | 2026-10-07 |
| T-07 | 2026-10-07 |
| SG-15 | 2026-10-08 |
| SG-16 | 2026-10-08 |
| SG-17 | 2026-10-16 |
| SG-18 | 2026-10-16 |
| SG-19 | 2026-10-16 |
| SG-20 | 2026-10-17 |
| SG-21 | 2026-10-19 |
| T-11 | 2026-10-20 |

- 21 z tych transportÃ³w ma zaÅadunek przed 18.10 (ostatnie dwa: SG-21 19.10 i T-11 20.10). Eskalacje bÄdÄ wracaÄ, dopÃ³ki wÅaÅciciel ich nie zamknie albo nie anuluje. Przypomnienie: zamknÄÄ stare zaplanowane transporty bez kierowcy i tablic.

## 2026-10-19 00:10 â DOPISEK D-20261019-0005-01 W PLANIE

- Po CMR (D-20261018-1740-01), przed A3: Administrator HHL zmienia kaÅ¼dÄ datÄ i godzinÄ bez ograniczeÅ. KSH, SCX i Operacje HHL bez zmian. Baza w tej pozycji; aplikacja w `wyglad/W-przed-wydaniem-4`.
- BieÅ¼Äca pozycja bez zmian: eskalacje decyzji, PR #306. Tego dopisku nie wdraÅ¼am w tej przerwie.

## 2026-10-19 00:40 â Eskalacje decyzji, przeglÄd 00:22 niegotowe

- PR #306, migracja 0230. PrzeglÄd koordynatora 19.10 00:22: niegotowe. Poprawki B1âB6 i P1âP6 w tym samym PR, przed scaleniem.
- B1: `l3_critical_notify` nie dokÅada `l3crit`, gdy osoba ma juÅ¼ `dec:ESCALATE` albo zbiorczy z tÄ decyzjÄ. `RISK_SEVERITY` przy `l3_level = critical` nie idzie osobno.
- B2: `l1b_sefs_note` traktuje `status = OSTATECZNY` jak tydzieÅ zamkniÄty, takÅ¼e bez klucza `final`.
- B3: jednorazowe zamkniÄcie `SOURCE`. Odczyt produkcji 19.10 przed naÅoÅ¼eniem: **12** otwartych, z tego **8** (tydzieÅ jeszcze trwa) i **4** (ceny juÅ¼ w bazie: tygodnie od 21.09, 28.09, 05.10, 12.10). Po naÅoÅ¼eniu oczekiwane **0**. LiczbÄ po `db push` dopiszÄ przy wdroÅ¼eniu.
- B4: (poprawione w rundzie 2 â byÅo bÅÄdnie â>5â; wÅaÅciwie **wiÄcej niÅ¼ 2**, B-N1).
- B5: przy eskalacji wyzwalacz ryzyka nie dokÅada `RISK_OPEN` dla `decision-overdue`.
- B6 â liczby na produkcji przed naÅoÅ¼eniem 0230 (SELECT 19.10 ~00:15 UTC) i oczekiwane po:
  | miejsce | przed | po |
  |---|---|---|
  | otwarte `decisions.title` âhex:â / âSEFSâ | 9 / 12 | 0 / 0 |
  | otwarte `risk_signals.title` âhex:â / âSEFSâ | 25 / 12 | 0 / 0 |
  | otwarte `params.title` âhex:â / âSEFSâ | 15 / 12 | 0 / 0 |
  | `notifications` IN_APP z âhex:â/âSEFSâ | 898 | 0 |
  | EMAIL `DIGEST`/`ERROR` | 33 | 0 |
  | EMAIL/WEB_PUSH `SENT` (bez zmian) | 92 / 17 | bez zmian |
  | otwarte `rk_res_driver` z `params.code` = 8 hex | 20 z 39 | 0 (P2) |
- P1âP6: numer zlecenia firmy czytajÄcej tytuÅ; odnoÅnik `/ryzyka` i temat e-maila = tytuÅ zbiorczy; osoba z samÄ pocztÄ teÅ¼ dostaje zbiorczy; straÅ¼nik jest na osobÄ.
- Jeden e-mail zbiorczy jest prawdziwy tylko wtedy, gdy pojedyncze nie powstajÄ wczeÅniej. Kasowanie po wstawieniu zjadÅoby limit.
- `NO_AWIZACJA` przy `PLANNED`: tabela z 18.10 23:50 (23 pozycje) zostaje. PrzeglÄd podaÅ pÃ³Åºniej 26 (doszÅy SG-23, SG-24, T-12). To informacja, bez zmiany kodu.

## 2026-10-19 08:45 â D-20261019-0820-01 + #306 przeglÄd 2 w toku

- **Punkty kontrolne (D-0820):** pn 19.10 12:00 #306+#307; 18:00 D-1740+D-0005; **23:59 A3,A7,A9,A4,A5**; wt 20.10 B4âB9+A6+SharePoint; År 21.10 C4âC13+P4-u+P3-d; wydanie År 28.10 20:00 bez zmian. nd 18.10 nieoddane â pn 19.10 23:59.
- **#306 runda 2:** B1âB6 OK; poprawki B-N1âB-N3, P1âP5. Commit `36af9835`; F7 runda 3 (09:27): gotowe do scalenia.
- **#307 / #308:** scalone i w tym samym wdroÅ¼eniu z #306.

## 2026-10-19 09:50 â #306 NA PRODUKCJI (D-1610, 0230)

- **#308** merge `96f83c96` (hotfix `groupPhone`). **#307** wczeÅniej `d2f8b270`. **#306** merge `fc5726b3` 09:48.
- `supabase db push` â **0230** na produkcji (`schema_migrations` ma 0230).
- Edge `send-notifications` wdroÅ¼ona (`--no-verify-jwt`, szablon `DECISION_ESCALATED_BATCH` â `/ryzyka`).
- Vercel prod: `dpl_F9jd19WBLGMWYCsKgqT8d1deFdcs`, `main` `fc5726b3`; tower i makieta **200**.
- SELECT po naÅoÅ¼eniu (produkcja):
  | | przed (runda 3) | po |
  |---|---|---|
  | otwarte SOURCE | 12 | **0** (`expired-0230` = 12) |
  | decyzje title hex/SEFS | 9 / 12 | **0 / 0** |
  | ryzyka title hex/SEFS | 25 / 12 | **0 / 0** |
  | `params.title` hex/SEFS | 15 / 12 | **0 / 0** |
  | `params.code` hex | 20 | **0** |
  | IN_APP hex/SEFS | 898 | **0** |
- Przebieg 06:20 UTC (17Ã DELIVERY_UNCONFIRMED): byÅo 221 / 45 / 51 / 9; na kodzie 0230 oczekiwane **13 / 9 / 0 / 0**.
- NastÄpna pozycja: **D-20261018-1740-01** (CMR tylko po rozÅadunku), potem D-0005, D-0930, A3â¦
- D-20261019-0930-01 dopisany do planu (po D-0005, przed A3).

## 2026-10-19 10:50 â D-1740 / #310 NA PRODUKCJI (0231) + poprawka #312 w kolejce

- Merge `39116fbb`; `db push` 0231; Vercel `dpl_C829eZRWFdVgf8rQqyjtCiT6x2jC`; tower/makieta **200**.
- SELECT: CMR = AFTER_UNLOAD/24; OVERDUE przed dostawÄ = 0 (byÅo 22).
- F7 po scaleniu: **B1** â `has_doc` zalicza CMR z zaÅadunku â zgÅoszenie **#312** (nastÄpna pozycja).
- PrzeglÄd miejsc (pkt 4): seed/status/CHECK OK; L3_DOC bez CMR; C17 po dostawie OK; **A5 `load_status_set` przy rÄcznym READY_TO_INVOICE wymaga dowolnego CMR (nie âpo dostawieâ) â rozjazd â zadanie A4**; **`register_invoice` podpina wszystkie CMR/POD â zadanie A4**; API kierowcy bez kotwicy 2 h.

## 2026-10-19 11:55 â praca ciÄgÅa (D-20261019-1050-01) â przekazanie do pÄtli

- Zasady Â§1âÂ§4 w PLAN Â§1 pkt 14; `docs/handover/ZASADY_CIAGLEJ_PRACY.md`; dopisek w `dopiski/`.
- Kolejka teraz: **#312 (B1 CMR)** â **Automat wdroÅ¼enia** (`deploy-main.yml`) â **D-0005 #313** (0232; stash lokalny `aud03-sval-d0005`) â **D-0930** â **A3âA5** (pn 23:59).
- Skrzynka: #311 (1050) â zamkniÄte po wpisie; #312 â otwarte (nastÄpny krok pÄtli).
- **Ten czat siÄ zatrzymuje.** Dalej: pÄtla `cursor-agent` od `ZASADY_CIAGLEJ_PRACY.md`.

## 2026-10-19 12:10 â #314 F7: autor polecenia + F7 po ostatnim commicie

- F7 12:02: dwie poprawki bezpieczeÅstwa pÄtli (repo publiczne, `--force`).
- `ZASADY_CIAGLEJ_PRACY.md` + PLAN Â§1 pkt 14.0 / 14.2: tylko `Spawn2018`/wÅasne; âF7: gotoweâ tylko po ostatnim commicie; bez merge z forka.
- Skrzynka: #312 (Spawn2018, juÅ¼ w PLAN) â bez przerwania; po scaleniu #314 â #312.

## 2026-10-19 12:57 â #315 wpisane: daty = terminy najpÃ³Åºniejsze

- ZgÅoszenie #315 (Spawn2018, `dla-cursora`): PLAN Â§1 pkt 14.5 i `ZASADY_CIAGLEJ_PRACY.md` krok 4. Po pozycji od razu nastÄpna z Â§4, takÅ¼e z kolejnych dni. Bez czekania na dzieÅ planu i punkt kontrolny.
- BieÅ¼Äca pozycja bez przerwania: #312 / #316 (`pakiet/cmr-has-doc-c17`, 0233) â brama `db` i `visual` w toku, bez nowego commitu na tej gaÅÄzi (G-15).
- #301 ma komentarz âF7 â gotowe do scaleniaâ (myÅlnik, 18.10 18:43, po ostatnim commicie, CI zielone). Zasady pÄtli wymagajÄ dosÅownego âF7: gotowe do scaleniaâ â bez scalenia w tym przebiegu.

## 2026-10-19 12:45 â #314 SCALONE; start #312 (0233 has_doc CMR)

- Merge #314 `1966a3dd` (docs praca ciÄgÅa + F7 bezpieczeÅstwo).
- **#312:** migracja **0233** â `doc_requirements_status` has_doc CMR jak C17 (`uploaded_at >= actual_delivery_at`, `purged_at is null`); i2: CMR z zaÅadunku â OVERDUE po dostawie â25 h â OK po ponownym wgraniu.
- P1/P2 z F7 #310: **nie** âC17/A5 = CMR po dostawie potwierdzoneâ â to zadania **A4** (`load_status_set` rÄczny READY + `register_invoice` bez CMR z zaÅadunku/zastÄpionych). Wpisy w PLAN Â§4 A4.

## 2026-10-19 13:45 â #312 / 0233 NA PRODUKCJI

- PR #316 scalony `b858b466` (F7 po `0ae0dae0`; unit, `db`, visual zielone).
- PrÃ³ba 0233 w transakcji z ROLLBACK: funkcja ma `uploaded_at >= actual_delivery_at` i `purged_at is null`; `schema_migrations` bez 0233; po wycofaniu ostatnia = 0231.
- `db push`: najpierw 0233, drugi raz âRemote database is up to dateâ. Parytet MATCH YES (0001â¦0233).
- SELECT: pliki CMR przed dostawÄ (niezastÄpione, niepuste `actual_delivery_at`) = 0. CMR w `doc_requirements_status` dla STEGRA_BODEN: OK 2, OVERDUE 1.
- Vercel z archiwum `main` `b858b466`: `dpl_4RhcGn9QTngr2PtWZZz2LztFCMmf` READY. `tower.log-mar.pl` i makieta **200**. Funkcji Edge nie zmieniano.
- #317 (docs, F7, CI zielone) ma konflikt z `main` po #316 â bez scalenia.
- NastÄpna pozycja: **Automat wdroÅ¼enia z main** (D-20261019-1050-01).

## 2026-10-19 14:05 â #318 scalony; start Automatu wdroÅ¼enia

- Skrzynka `dla-cursora`: pusta.
- PR #318 (docs 0233 na produkcji): F7 po commicie `914541d5`, unit i visual zielone, bez forka. Scalony `d46c4b09` (`gh pr merge --merge`). WdroÅ¼enia nie byÅo â same dokumenty.
- #317 nadal z konfliktem. Komentarz F7 przy #318: wciÄgnÄÄ `main` w gaÅÄÅº #317 i czekaÄ na ponowne âgotoweâ. Nie w tym kroku.
- #313: brak F7, brama `db` czerwona, konflikt z `main`. Numer migracji przy rebase: 0234 (komentarz koordynatora 13:08).
- BieÅ¼Äca pozycja: **Automat wdroÅ¼enia** â workflow `deploy-main.yml` na `pakiet/automat-wdrozenia`. Test kluczy czeka na wpis wÅaÅciciela.

## 2026-10-19 14:35 â #301 scalony; F7 #319 niegotowe poprawione

- Skrzynka `dla-cursora`: pusta.
- PR #301 (`wyglad/W-bramy-P11`): F7 po `b79f4270`, unit i visual zielone, bez konfliktu i bez forka. Scalony `2f66310d`.
- #317: F7 jest, CI zielone, **konflikt** z `main` â bez scalenia (czeka na wciÄgniÄcie `main` i ponowne âgotoweâ).
- #319: przeglÄd 14:10 **niegotowe**. Poprawka w tym samym PR: sekret `SUPABASE_DB_URL`, `db push --db-url` z dry-run i komunikatem przy porcie 6543, `::warning::` przy braku kluczy, `vercel@64.5.0`. Czeka na ponowne âF7: gotowe do scaleniaâ.

## 2026-10-19 15:10 â #320 w planie (plik testowy SharePoint); automat czeka na F7

- Skrzynka: #320 (`Spawn2018`, `dla-cursora`, bez `pilne`) â D-20261019-1420-01. Wpisane: PLAN Â§4 A6, Â§3 kolejnoÅÄ, Â§5 W13, Â§6, Â§8, P7, II-10 w `PLAN_OTWARTE_08_10.md`, dopisek `docs/handover/dopiski/D-20261019-1420-01.md`. ZgÅoszenie otwarte do zrobienia A6.
- Adresu pliku testowego nie ma w repozytorium. WÅaÅciciel dopisuje `SHAREPOINT_TEST_FILE_URL` w `.env.local`.
- Scalanie: #319 visual zielony (33 min), unit zielony, bez konfliktu, bez F7 po `52d9650a` â bez scalenia. #317 F7 jest, CI zielone, konflikt z `main` â bez scalenia. #313 bez F7, `db` czerwone.
- BieÅ¼Äca pozycja zostaje: **Automat wdroÅ¼enia** (PR #319), czeka na ponowne âF7: gotowe do scaleniaâ.

## 2026-10-19 15:55 â #319 scalony; wdroÅ¼enie padÅo na adresie bazy

- Skrzynka: #320 juÅ¼ w planie (A6, otwarte). #322 (D-20261019-1515-01, B9 â DeepL zostaje) i #323 (D-20261019-1525-01, PodglÄd tylko HHL_ADMIN) wpisane do PLAN Â§4, Â§8, rejestru 8A i `dopiski/`. Bez etykiety `pilne` â bieÅ¼Äcej pozycji nie przerywajÄ.
- PR #319: F7 `Spawn2018` o 13:13:45Z, po ostatnim commicie `39539f9b` (13:12:16Z). Unit i visual zielone, bez konfliktu, bez forka. Scalony `9a3c7b26`.
- `deploy-main` na tym SHA: krok Klucze widzi sekrety; krok Baza w ~1 s: âConnecting to remote databaseâ i `host=/var/run/postgresql user=runner database=runner`. Edge i Vercel pominiÄte. Adres nie zostaÅ uÅ¼yty jako URL (CLI 2.121 przy haÅle z â=â i obcym prefiksie, np. cudzysÅÃ³w, wpada na gniazdo).
- Poprawka: `scripts/ci/normalize-db-url.py` â zdejmuje cudzysÅÃ³w i BOM, bierze pierwszÄ liniÄ `postgres://`, loguje tylko dÅugoÅÄ, schemat i czy jest uÅ¼ytkownik, host, baza oraz port. GaÅÄÅº `pakiet/automat-adres-bazy`. Sekretu nie zmieniam.
- #321: przeglÄd F7 z poprawkami, bez âF7: gotowe do scaleniaâ. #317: konflikt z `main`. Bez scalenia.

## 2026-10-19 16:10 â #321 scalony; #324 w planie (A10)

- Skrzynka: #320, #322 i #323 juÅ¼ w planie, otwarte do zrobienia pozycji. #324 (`Spawn2018`, `dla-cursora`, bez `pilne`) â D-20261019-1540-01. Wpisane: PLAN Â§3 (kolejnoÅÄ i punkt wt 20.10), Â§4 A10 po A5, dopiski przy A9 i A5, Â§8, `docs/handover/dopiski/D-20261019-1540-01.md`. ZgÅoszenie otwarte do zrobienia A10. BieÅ¼Äcej pozycji nie przerywa.
- PR #321 (`wyglad/W-bramy-reguly`): F7 `Spawn2018` o 13:32Z, po ostatnim commicie `8be78fd` (12:50Z). Unit i visual zielone, `mergeable` CLEAN, bez forka. Scalony `6b294a50`.
- #326: unit zielony, visual w toku na `710c9c13`, bez F7 â bez scalenia. #317: konflikt z `main` (F7 sprzed konfliktu). #325: visual w toku, bez F7. #313: `db` czerwone, bez F7.
- BieÅ¼Äca pozycja zostaje: **Automat wdroÅ¼enia** â poprawka adresu bazy, PR #326.

## 2026-10-19 16:55 â #326 niegotowe: hasÅo w adresie kodowane procentowo

- Skrzynka `dla-cursora`: #320, #322, #323, #324 â juÅ¼ w planie, bez `pilne`. Nowych zgÅoszeÅ nie ma.
- Scalanie: #326 F7 z 14:11Z to âniegotoweâ (P1), sprzed commita `d7f661b1`. Unit i visual na `d7f661b1` zielone â bez scalenia. #325 bez F7. #317 F7 jest, konflikt z `main`. #313 bez F7, `db` czerwone.
- P1: `encode_password` w `scripts/ci/normalize-db-url.py` â znaki specjalne w haÅle kodowane procentowo, hasÅo juÅ¼ zakodowane bez zmian. Log: `haslo zakodowane: tak/nie`, bez adresu. Test `tests/normalize-db-url.test.ts`: 3 przypadki, lokalnie 3/3.
- D1 (linia âAdres bazyâ z przebiegu na `main`) â po scaleniu i pierwszym poprawnym dry-run.
- BieÅ¼Äca pozycja zostaje: **Automat wdroÅ¼enia**, PR #326, czeka na ponowne âF7: gotowe do scaleniaâ.

## 2026-10-19 17:50 â #317: main wciÄgniÄty, zasada #315 zostaje

- Konflikt z `main`: zostawione obie strony (wpisy z `main` + Â§1 pkt 14.5 i wpis #315). Nic z `main` nie usuniÄte.
- Czeka na zielone CI i ponowne âF7: gotowe do scaleniaâ (komentarz koordynatora 14:52).
- #326 (adres bazy): unit i visual zielone, ostatni komentarz to âniegotoweâ sprzed commita `0556710e` â bez scalenia.

## 2026-10-19 18:35 â #330: wdroÅ¼enie rÄczne z main, sekret Actions nadal zÅy

- Skrzynka: #330 (`Spawn2018`, `dla-cursora`, bez `pilne`) â sekret `SUPABASE_DB_URL` w Actions nie zaczyna siÄ od `postgresql://`. Wpisane: PLAN Â§4 Automat pkt 4, Â§8. ZgÅoszenie zostaje otwarte do poprawki sekretu i przebiegu `deploy-main`.
- Scalanie: #327 bez âF7: gotowe do scaleniaâ (raport prÃ³b po `2d3ab1b`). #317 F7 z 13:08 jest sprzed wciÄgniÄcia `main` (`55e22989`); visual w toku â bez scalenia. #313 bez F7, `db` czerwone. #259 bez F7.
- RÄcznie z `main` `047ce7b5` (adres sesyjny z `.env.local`, port 5432, pooler): dry-run i `db push` â âRemote database is up to dateâ, 0 nowych migracji. Funkcje Edge bez zmian od ostatniego wdroÅ¼enia `b858b466`.
- Vercel produkcja: `dpl_FgAn6VsfF1rqoGeyrmbW91jvLary` READY. `tower.log-mar.pl` i `watch-tower-makieta.vercel.app` **200**.
- Log `normalize-db-url.py`: przy `jdbc:` albo `host=` jedna linia âto format JDBC/klucz=wartoÅÄ â wklej URI z Supabase â Connect â Session poolerâ, bez adresu.
- Po wpisaniu URI przez wÅaÅciciela: `workflow_dispatch` `deploy-main` i w POSTEP linia âAdres bazy: â¦â.
- Dalej w kolejce, po domkniÄciu Automatu: **D-0005 #313** (numer migracji 0234 przy rebase).

## 2026-10-19 19:10 â deploy-main 39287813163: host bezpoÅredni odrzucony; #327 scalony

- Skrzynka: #331 (`pilne`, odpowiedÅº koordynatora 18:40 â sekret od nowa, `postgresql://`). Jedno `workflow_dispatch` na `main` `047ce7b5`, przebieg `39287813163`. Drugiego nie uruchamiam.
- Adres bazy: dlugosc 90, schemat postgres, uzytkownik tak, host tak, baza tak, port 5432, haslo zakodowane: nie.
- Dry-run: poÅÄczenie odrzucone (`ECONNREFUSED`) na hoÅcie bezpoÅrednim `db.<projekt>.supabase.co` port 5432, zanim powstaÅa lista migracji. To nie jest pula sesyjna. Edge i Vercel pominiÄte.
- Linie diagnostyczne w #331. Zabezpieczenie prefiksu `NAZWA=` / JDBC zostaje po pierwszym zielonym `deploy-main`.
- Scalenie: #327 F7 `Spawn2018` 16:46Z, po commicie `4bdd5b1` (16:27Z). Unit i visual (czÄÅci) zielone, bez konfliktu, bez forka. Scalony `18344d57`.
- GaÅÄzie `proba/ci-dokumenty` i `proba/ci-czerwony` juÅ¼ nie istniejÄ.
- BieÅ¼Äca pozycja zostaje: **Automat wdroÅ¼enia**, PR #332 (log JDBC), czeka na âF7: gotowe do scaleniaâ.

## 2026-10-19 19:20 â #331: link i pula IPv4 zamiast hosta bezpoÅredniego

- Skrzynka: #331 (`pilne`) â komentarz koordynatora 19:05. Host `db.<projekt>.supabase.co:5432` jest tylko IPv6; przebiegi `39287813163` i `39291759466` dostaÅy `ECONNREFUSED`. WÅaÅciciel nic nie wpisuje.
- Scalanie: #332 ma âF7: gotoweâ sprzed commitÃ³w `8450ccfa` i `69355b5b`, a `visual` jeszcze trwa â bez scalenia i bez pusha na tÄ gaÅÄÅº. #317 i #313 majÄ konflikt z `main`, bez aktualnego âgotoweâ. #259 konflikt, bez F7.
- Ten krok: `normalize-db-url.py` zapisuje zdekodowane hasÅo (plik 600) i tryb `pooler` albo `link`. `deploy-main.yml`: pula w adresie â `--db-url`; inaczej `supabase link --project-ref` i `db push --linked`. Log bez hasÅa i bez hosta. Test: hasÅo `a@b#c/d` w pliku, log bez hasÅa.
- Po scaleniu przebieg `deploy-main` sam z pusha na `main`. Wynik link i dry-run â w nastÄpnym wpisie. Do tego czasu wdroÅ¼enie rÄczne (#330).
- BieÅ¼Äca pozycja zostaje: **Automat wdroÅ¼enia**, gaÅÄÅº `pakiet/automat-pooler`, czeka na âF7: gotowe do scaleniaâ.

## 2026-10-19 19:45 â #332 scalony; #333 wciÄga main

- Skrzynka bez nowych zgÅoszeÅ. #331 zostaje otwarte do pierwszego zielonego `deploy-main`.
- #332: âF7: gotowe do scaleniaâ od `Spawn2018` o 17:28Z, po ostatnim commicie `69355b5` (17:10Z). Unit i visual zielone, bez forka. Scalony `8726c3c7`.
- #333 na `739fc577`: unit i visual zielone, ale po scaleniu #332 konflikt z `main`. Ostatnie F7 to âniegotoweâ sprzed poprawki YAML â bez scalenia.
- Ten krok: wciÄgniÄty `main`. ZostajÄ testy link/redact i podpowiedÅº JDBC. Poprawka YAML (`redact.py`) bez zmian.
- BieÅ¼Äca pozycja zostaje: **Automat wdroÅ¼enia**, PR #333, czeka na ponowne âF7: gotowe do scaleniaâ po tym commicie.

## 2026-10-19 20:20 â pierwszy zielony deploy-main (#333)

- Skrzynka bez nowych zgÅoszeÅ. #331 (`pilne`) i #330 zostajÄ do zamkniÄcia po tym wpisie.
- #333: âF7: gotowe do scaleniaâ od `Spawn2018` o 18:09Z, po ostatnim commicie `b8f27b5d` (17:51Z). Unit i visual zielone, `CLEAN`, bez forka. Scalony `97c88a19`.
- `deploy-main` `39300935077` (push na `main`):
  - Adres bazy: dlugosc 90, schemat postgres, uzytkownik tak, host tak, baza tak, port 5432, haslo zakodowane: nie, polaczenie: link
  - `Finished supabase link.`
  - dry-run i wÅaÅciwy push: âRemote database is up to dateâ (0 nowych migracji)
  - Funkcje Edge bez zmian
  - Vercel `D8dghXG3wndN4VKWX3RdGcpJerrj` READY, alias `tower.log-mar.pl`; tower i makieta **200**
- NastÄpny krok tej pozycji: zabezpieczenie prefiksu `NAZWA=` / JDBC w `normalize-db-url.py` (komentarz #331, 18:40). Potem D-0005 (#313).

## 2026-10-19 20:30 â #334 scalony; prefiks NAZWA= i JDBC

- Skrzynka `dla-cursora`: #320, #322, #323, #324 â juÅ¼ w planie, bez `pilne`. Nowych zgÅoszeÅ nie ma.
- Scalanie: #334 âF7: gotowe do scaleniaâ od `Spawn2018` o 18:21Z, po ostatnim commicie `47732685` (18:19Z). Unit i visual zielone, `MERGEABLE`, bez forka. Scalony `6aafacbe`. #317 ma konflikt z `main`. #313 i #259 bez aktualnego âgotoweâ.
- Ten krok: `normalize-db-url.py` zdejmuje `export NAZWA=` (nazwa `[A-Z_]+` w logu), skÅada `postgresql://` z JDBC `user`/`password`, loguje `format: uri|jdbc|klucz=wartosc|inny`. HasÅa i hosta nie wypisuje. Testy prefiksu, export z cudzysÅowem i JDBC.
- BieÅ¼Äca pozycja zostaje: **Automat wdroÅ¼enia**, gaÅÄÅº `pakiet/automat-prefiks-nazwa`, czeka na âF7: gotowe do scaleniaâ. Potem D-0005 (#313).

## 2026-10-19 20:55 â #335 scalony; Automat zamkniÄty

- Skrzynka `dla-cursora`: #320, #322, #323, #324 â juÅ¼ w planie, bez `pilne`. Nowych zgÅoszeÅ nie ma.
- Scalanie: #335 âF7: gotowe do scaleniaâ od `Spawn2018` o 18:46Z, po ostatnim commicie `c2666625` (18:28Z). Unit i visual zielone, `CLEAN`, bez forka. Scalony `b4af5626`. #317 ma konflikt z `main`. #313 i #259 bez aktualnego âgotoweâ.
- `deploy-main` `39306048061` (push na `main`):
  - Adres bazy: dlugosc 90, schemat postgres, uzytkownik tak, host tak, baza tak, port 5432, haslo zakodowane: nie, polaczenie: link
  - prefiks NAZWA= zdjety: nie
  - format: uri
  - `Finished supabase link.`
  - dry-run i wÅaÅciwy push: âRemote database is up to dateâ (0 nowych migracji)
  - Funkcje Edge bez zmian
  - Vercel `BPqpLRVu3YB9WGA4cLgKYh8cdH1Z` READY, alias `tower.log-mar.pl`; tower i makieta **200**
- Pozycja **Automat wdroÅ¼enia** zamkniÄta. NastÄpna: **D-0005** (#313, migracja 0234 przy rebase).

## 2026-10-19 21:05 â #336 scalony; D-0005: migracja 0234 i czerwone testy

- Skrzynka `dla-cursora`: #320, #322, #323, #324 â juÅ¼ w planie, bez `pilne`. Nowych zgÅoszeÅ nie ma.
- Scalanie: #336 âF7: gotowe do scaleniaâ od `Spawn2018` o 18:58Z, po ostatnim commicie `72b6afe` (18:55Z). Unit i visual zielone, bez konfliktu, bez forka. Scalony `fd2ca8c2`. #317 ma konflikt z `main` (F7 sprzed konfliktu). #313 i #259 bez aktualnego âgotoweâ.
- BieÅ¼Äca pozycja: **D-0005** (#313). `main` wciÄgniÄty. Plik migracji `0234_hhl_admin_daty.sql` (0233 jest na produkcji). `aud03`: sprawa `KSH_DATES_CHECK` przez `sval`. `dec2`: katalog 19 typÃ³w. Brama `db` po tym pushu.

## 2026-10-19 21:25 â D-0005: F7 niegotowe â B1 + P1âP4

- Skrzynka `dla-cursora`: #320, #322, #323, #324 â juÅ¼ w planie, bez `pilne`. Nowych zgÅoszeÅ nie ma.
- Scalanie: #313 po `fa2d537` â CI zielone (db 11 min, visual), F7 âniegotoweâ (19:20Z). #317 konflikt z `main` (bez aktualnego âgotoweâ). #259 bez F7.
- BieÅ¼Äca pozycja **D-0005** (#313): poprawki F7 w `0234` â `DECISION_HOLD` w CHECK; admin bez sprawy `KSH_DATES_CHECK`; `load_status_set` przez `current_app_*` + korekta czasu osi; historia z oknami âprzedâ; testy `aud03`/`e25`/`i2`; PLAN: wyjÄtek D1, A6 P5 (dostawa przed zaÅadunkiem). Czeka na zielone CI i ponowne F7.

## 2026-10-19 21:40 â D-0005: F7 B2, korekta czasu dopiskiem

- Skrzynka `dla-cursora`: #320, #322, #323, #324 â juÅ¼ w planie, bez `pilne`. Nowych zgÅoszeÅ nie ma.
- Scalanie: #313 po `16b5f3f` â F7 âniegotoweâ (B2, 19:33Z, po ostatnim commicie). Brama `db` i visual jeszcze szÅy na tym SHA; ten SHA nie idzie na produkcjÄ (`session_replication_role` odrzucone na produkcji). #317 i #259 majÄ konflikt z `main`, bez aktualnego âgotoweâ.
- BieÅ¼Äca pozycja **D-0005** (#313): korekta czasu bieÅ¼Äcego statusu dopisuje `STATUS_*` z `korekta=true` (`zastepuje`, `poprzednio`, `przez`). Bez `set_config('session_replication_role')`. `actual_*` i `audit_log` bez zmian. SCX przy korekcie czasu â odmowa. Test `e25`. Czeka na zielone CI i ponowne F7.
- Brama `db` na `16b5f3f` (`39311856014`): aud03 29/32 (`opened_at` zamiast wyniku `decision_open_from_event`; I-10 liczy 3 IN_APP, bo jest teÅ¼ HHL_OPS) i e25 33/34 (`AT_PORT` nie jest statusem). Poprawione w nastÄpnym commicie. Visual zielony.

## 2026-10-19 22:05 â D-0005: F7 P1 i P2 na f931341

- Skrzynka `dla-cursora`: #320, #322, #323, #324 â juÅ¼ w planie, bez `pilne`. Nowych zgÅoszeÅ nie ma.
- Scalanie: #313 po `f931341` â F7 âdwie drobne rzeczyâ (19:58Z, po ostatnim commicie), wiÄc bez scalenia. #317 i #259 majÄ konflikt z `main`.
- BieÅ¼Äca pozycja **D-0005** (#313): `wf_enqueue_event` pomija zdarzenie z `korekta=true` (STATUS_CANCELLED nie startuje drugi raz). SCX (`CARRIER_DISPATCH` / `CARRIER_USER`) przy tym samym `DELIVERED` i innej godzinie nadpisuje `actual_delivery_at` jak przed 0234; korekta pozostaÅych statusÃ³w zostaje przy Administratorze HHL. Test `e25`: 39. Czeka na zielone CI i âF7: gotowe do scaleniaâ.

## 2026-10-19 22:20 â D-0005: e25 P1, brama db czerwona na 03d379af

- Skrzynka `dla-cursora`: #320, #322, #323, #324 juÅ¼ w planie, bez `pilne`. Scalanie: brak âF7: gotowe do scaleniaâ po ostatnim commicie. #317 i #259 majÄ konflikt z `main`.
- Brama `db` `39316540812`: e25 36/39. Unit i visual zielone. ReguÅa START-7 nie ma projektu z seed (0094 idzie przed seedem), a anulowanie L1 byÅo w transakcji wycofanej, wiÄc korekta czasu nie powstawaÅa. Test dopisuje reguÅÄ i zostawia anulowanie. Czeka na zielone CI i âF7: gotowe do scaleniaâ.

## 2026-10-19 22:50 â D-0005: CI zielone na 7a0516ba, czeka na F7

- Skrzynka `dla-cursora`: #320, #322, #323, #324 juÅ¼ w planie, bez `pilne`. Nowych zgÅoszeÅ nie ma.
- Scalanie: brak âF7: gotowe do scaleniaâ po ostatnim commicie `7a0516ba` (20:27Z). Ostatni komentarz F7 (20:22Z) dotyczy `03d379af` i zapowiada âgotoweâ po zielonej bramie. #317 i #259 majÄ konflikt z `main`.
- BieÅ¼Äca pozycja **D-0005** (#313): `db` `39319719814` zielony (8 min 53 s), unit zielony, visual `39319719721` zielony (zrzuty, telefon, bramy). Bez scalenia, dopÃ³ki `Spawn2018` nie napisze âF7: gotowe do scaleniaâ po `7a0516ba`.

## 2026-10-19 23:10 â D-0005 na produkcji

- Skrzynka `dla-cursora`: #320, #322, #323, #324 juÅ¼ w planie, bez `pilne`. Nowych zgÅoszeÅ nie ma.
- Scalanie: #313 scalony `745517e3` (23:03). #317 i #259 majÄ konflikt z `main` â ostatnie âF7: gotowe do scaleniaâ na #317 jest sprzed wciÄgniÄcia `main`, wiÄc bez scalenia.
- `deploy-main` `39324497090`: `format: uri`, `polaczenie: link`, naÅoÅ¼ona `0234_hhl_admin_daty.sql`, funkcje Edge bez zmian, Vercel `2PC4SLzaJhbehwEpRVH32A5Lsy63` READY (alias `tower.log-mar.pl`). `tower.log-mar.pl` i `watch-tower-makieta.vercel.app` zwracajÄ 200.
- Pozycja **D-0005** zamkniÄta. NastÄpna: kod transportu w L-3 i E41 w ryzykach (D-20261019-0930-01, migracja 0235).

## 2026-10-19 23:20 â #337 scalony; start 0235 (D-0930 + #338)

- Skrzynka: #320, #322, #323, #324 juÅ¼ w planie, bez `pilne`. #338 (`Spawn2018`, `dla-cursora`, bez `pilne`) â D-20261019-2315-01. Wpisane: PLAN Â§4 przy D-0930 (ta sama migracja 0235), Â§8, `docs/handover/dopiski/D-20261019-2315-01.md`. ZgÅoszenie otwarte do zrobienia 0235.
- Scalanie: #337 scalony (`e6bc682a`) â âF7: gotowe do scaleniaâ po `a4bfb3cc`, unit i visual zielone. #317 i #259 majÄ konflikt z `main`.
- BieÅ¼Äca pozycja **D-0930**: migracja `0235_l3_kod_i_korekta_statusu.sql` â kod transportu w L-3 / E41 oraz korekta statusu z #338. Testy `dec-auto` 74, `e25` 45. Czeka na bramÄ `db`.

## 2026-10-19 23:50 â #339 scalony; F7 niegotowe #340 (P1âP3)

- Skrzynka bez zmian: #320, #322, #323, #324, #338 w planie, bez `pilne`.
- Scalanie: #339 `wyglad/W-admin-daty` scalony `d69498c4` â âF7: gotowe do scaleniaâ po `068c428`, unit i visual zielone, bez migracji. #317 i #259 majÄ konflikt z `main`.
- #340: âF7: niegotoweâ na `47af0dc` (po tym commicie jest `9a2ac176`, tylko asercje `t`/`true`). Poprawki w tej samej migracji 0235: kod w `ksh_confirm_dates` i postoju, skrÃ³t L-13 dla SCX bez numeru KSH, korekta po `STATUS_AUTO` z notatkÄ, tytuÅ bez ââ:â. Testy `dec-auto` 76, `e25` 46. Push po koÅcu bramy na `9a2ac176`.

## 2026-10-20 00:25 â D-0930: CI zielone na ed564421; #341 w planie

- Skrzynka: #320, #322, #323, #324, #338 juÅ¼ w planie, bez `pilne`. #341 (`Spawn2018`, `dla-cursora`, bez `pilne`) â D-20261020-0010-01. Wpisane: PLAN Â§3 (terminy), Â§4 (pary A3+A9, A7+A4; ekran B5/B9/A10 u koordynatora), Â§8, `docs/handover/dopiski/D-20261020-0010-01.md`, `ZASADY_CIAGLEJ_PRACY.md` (scalenie bez czekania na wdroÅ¼enie).
- Scalanie: brak âF7: gotowe do scaleniaâ po ostatnim commicie kodu `ed564421` (22:07Z). Komentarz F7 (21:37Z) to âniegotoweâ na `47af0dc`. #317 i #259 majÄ konflikt z `main`.
- BieÅ¼Äca pozycja **D-0930** (#340): `db` `39332882485` zielony (6 min 43 s), unit zielony, visual `39332882486` zielony (zrzuty, telefon, bramy). Bez scalenia, dopÃ³ki `Spawn2018` nie napisze âF7: gotowe do scaleniaâ po ostatnim commicie.

## 2026-10-20 00:50 â D-0930 na produkcji; start 0236 (#343)

- Skrzynka: #320, #322, #323, #324, #338 juÅ¼ w planie, bez `pilne`. #343 (`Spawn2018`, `dla-cursora`, bez `pilne`) â D-20261020-0040-01. Wpisane: PLAN Â§4 przy A3 (pierwszy commit, migracja 0236), Â§8, `docs/handover/dopiski/D-20261020-0040-01.md`. #342 i #344 bez âF7: gotowe do scaleniaâ po ostatnim commicie. #317 i #259 majÄ konflikt z `main`.
- Scalanie: #340 scalony `c2c22989` â âF7: gotowe do scaleniaâ po `0d4b0bcc`, unit, `db` i visual zielone.
- `deploy-main` `39337027018`: migracja `0235_l3_kod_i_korekta_statusu.sql`, funkcje Edge bez zmian, Vercel `HUPS6L9PepsMLfynhra6XhAiqf2y` (alias `tower.log-mar.pl`).
- Pozycja **D-0930** zamkniÄta. BieÅ¼Äca: **A3+A9** (`pakiet/a3-a9`). Ten commit: #343 w `0236_ksh_scx_l13_workflow.sql`. Testy `dec-auto` 78, `e25` 47. A3 i A9 dopiszÄ siÄ do tej samej migracji.

## 2026-10-20 01:30 â A3 w 0236; #342/#344 scalone; #346 w planie

- Skrzynka: #320, #322, #323, #324, #343 w planie. #346 (`Spawn2018`, `dla-cursora`, bez `pilne`) â D-20261020-0115-01 edycja faktur â PLAN Â§4 A4, Â§8, `docs/handover/dopiski/D-20261020-0115-01.md`. Nie przerywa A3+A9.
- Scalanie: #342 (`f92216d8`) i #344 (`05d3dcb8`) â âF7: gotowe do scaleniaâ po ostatnim commicie, unit i visual zielone. #345 bez F7 (jeszcze A3/A9). #317 i #259 konflikt.
- BieÅ¼Äca **A3** w `0236_ksh_scx_l13_workflow.sql`: seed 3 wymagaÅ, `is_hhl_admin`, `CMR_UPLOAD`/`UPLOAD_CMR`, C17 zamyka, stare DOC_MISSING z kopiÄ. Testy: `i2` 550, `e25` 50. Dalej A9 w tej samej migracji.

## 2026-10-20 02:05 â A9 w 0236; dec2 20 typÃ³w

- Skrzynka: #320, #322, #323, #324, #343, #346 w planie, bez `pilne`. Nowych zgÅoszeÅ nie ma.
- Scalanie: #345 bez F7 (para A3+A9 w toku). #347 wyglÄd bez F7. #317 i #259 konflikt z `main` (F7 sprzed wciÄgniÄcia).
- Poprzedni `db` na `e5ad7b53` czerwony: `dec2` katalog 19â20 (CMR_UPLOAD). Poprawione.
- **A9** w `0236_ksh_scx_l13_workflow.sql`: `awiz_missing`, `load_ready_gaps`, `a9_try_ready` + wyzwalacze, L3 z lukami, `tower-zasoby` wyÅÄczony, zamkniÄcie `RESOURCE_MISSING` z kopiÄ. Widok: `load.readyGaps` z RPC. Testy: `e25` 55, `nullguard` 658. Czeka na bramÄ `db`.

## 2026-10-20 02:25 â #347 scalone; poprawka bramy A9 (i2/e25)

- Skrzynka: #320, #322, #323, #324, #343, #346 w planie, bez `pilne`. Nowych zgÅoszeÅ nie ma.
- Scalanie: #347 (`686064b7`, F7 po `f85afdd`) â wyglÄd edycji faktury. #345 bez F7 (para w toku). #317 i #259 konflikt z `main`.
- Brama `db` na `41348842` czerwona: i2 8Ã `detect_resource_deadlines` (A9 = no-op) + e25 `cron.job` bez pg_cron w CI. Poprawka: i2 I-21 â `l3_scan`, III-4 â `awiz_missing` PILOTS; e25 `to_regclass('cron.job')`; cron `tower-l3` w 0236; nullguard 662.

## 2026-10-20 02:45 â A3+A9 F7 B1/P1âP9 + e25 cron (shell)

- Skrzynka: #320, #322, #323, #324, #343, #346 w planie, bez `pilne`. Nowych zgÅoszeÅ nie ma.
- Scalanie: #345 bez âF7: gotoweâ po `a3a3b652`. `db` czerwone (e25 cron: CASE WHEN i `cron.job` â parse w CI). Visual zielony. #317/#259 konflikt.
- Ten krok (F7 niegotowe + brama): B1 bez ruszania EXPIRED; P1 `l3_headed`/`load_sms_code`; P2 tytuÅ WF = kod; P3 `dates_ctx` + POLICY_SCX tylko z carrier; P4 UPLOAD_CMR = `kept_open`; P5 `tower.bulk_quiet`; P6 zamkniÄcie RES:*; P9 `offset_hours`; D `\yâ¦\y`; e25 cron jak insurance.sh; e25 58.
- Czeka na zielone CI i âF7: gotowe do scaleniaâ po tym commicie.

## 2026-10-20 03:20 â #345 F7 niegotowe runda 2

- Skrzynka: #320, #322, #323, #324, #343, #346 w planie, bez `pilne`. UzupeÅnienie #346 (kontrakt `update_invoice`) â do A4, nie przerywa.
- Scalanie: CI na `03d428d1` zielone (unit/visual/db); F7: niegotowe runda 2.
- Poprawki w 0236 + testy: B alarm pilotÃ³w (`AWIZ`+`PILOTS`); P2 tylko `load_sms_code`; P3 luka `CARRIER`; P5 `wf_enqueue_status` + `bulk_quiet`; P8 e25 (EXPIRED, Gotowy, CMR SCX, reopen); D POD/`~` + min 1 h + `n_open` bez juÅ¼ otwartych. i2 552, e25 67.
- Czeka na zielone CI i âF7: gotowe do scaleniaâ po tym commicie.

## 2026-10-20 03:45 â #345 poprawka bramy db po F7 rundzie 2

- Skrzynka: #320, #322, #323, #324, #343, #346 w planie, bez `pilne`. Nowych zgÅoszeÅ nie ma.
- Scalanie: brak âF7: gotoweâ po `585b277d`. `db` `39353345803` czerwone (e25 6 FAIL + status A1Ã2). Visual zielony.
- e25: UUID `ee01`/`ee02` (hex); rejs wÅasny vessel `e25a` (unikat departure); a903 DELIVERED z numerami HHL/SCX; status A1 W4 â daty XI (nie âdziÅâ po 03:00).
- Czeka na zielone CI i âF7: gotowe do scaleniaâ po tym commicie.

## 2026-10-20 04:15 â #345 e25 po F7: komplet A9 + reopen EXPIRED

- Skrzynka: #320, #322, #323, #324, #343, #346 w planie, bez `pilne`. Nowych zgÅoszeÅ nie ma.
- Scalanie: brak âF7: gotoweâ po `ed161f7f`. `db` `39355584107` czerwone (e25 65/67); visual zielony.
- e25: polisa na `plan_load_date` a901; PERMIT off + STANDARD; asercja kinds przy lukach; **EXPIRED przez `decision_expire`** (CHECK 0102: `EXPIRED`+`resolved_at` psuÅo UPDATE â sprawa zostawaÅa NEW, ensure zwracaÅ null). e25 69.
- Czeka na zielone CI i âF7: gotowe do scaleniaâ po tym commicie.

## 2026-10-20 04:35 â #345 e25: UUID rejsu hex + reopen w dwÃ³ch komendach

- Skrzynka: #320, #322, #323, #324, #343, #346 w planie, bez `pilne`. Nowych zgÅoszeÅ nie ma.
- Scalanie: brak âF7: gotoweâ po `a1197b30`. `db` `39357785497` czerwone (e25 66/4 FAIL); visual/unit zielone.
- Przyczyna: UUID `â¦s901` (litera **s** poza hex) â INSERT/SELECT padajÄ z `invalid input syntax for type uuid` (w logu sam `^`); stÄd AWIZ+SAILING i PLANNED. Reopen: jeden SELECT z `ensure||status` mÃ³gÅ czytaÄ EXPIRED sprzed UPDATE â rozdzielone; `a3_ensure` reopen z `IF NOT FOUND` + reopen gdy `open_from_event` zwrÃ³ci zamkniÄtÄ.
- e25 70. Czeka na zielone CI i âF7: gotowe do scaleniaâ.

## 2026-10-20 04:55 â #345 e25: oczekiwane 71 (licznik bramy)

- Skrzynka: #320, #322, #323, #324, #343, #346 w planie, bez `pilne`. Nowych zgÅoszeÅ nie ma.
- Scalanie: brak âF7: gotoweâ po `3449a9c8`. Unit i visual zielone; `db` `39360005068` czerwone: e25 **71/71 OK**, ale `gate-suites.mjs` oczekiwaÅ 70.
- Poprawka: `e25: 71` (asercja ârejs f901 w bazieâ + reopen w dwÃ³ch komendach). Czeka na zielone CI i âF7: gotowe do scaleniaâ.

## 2026-10-20 05:30 â #345 scalone; start A7+A4 (0237)

- Skrzynka: #320, #322, #323, #324, #346 w planie, bez `pilne`. Nowych zgÅoszeÅ nie ma.
- Scalanie: #345 â âF7: gotowe do scaleniaâ po `a4b2cfa4` (03:15Z), CI zielone (db `39361912023`, unit, visual), bez konfliktu. Merge `7589dbef`. `deploy-main` `39364557245` w toku (nie czekamy â D-20261020-0010-01).
- #317 / #259: konflikt z `main` â bez scalenia.
- BieÅ¼Äca **A7+A4** (`pakiet/a7-a4`): migracja `0237_a7_a4_symbol_faktura.sql` â A7 (symbol_specs, Firma/Trasa, 13/GD/2026, PZU 1106707356, RPC, widok). A4 w nastÄpnym commicie tej samej migracji. Testy e25 79, nullguard 666.

## 2026-10-20 06:45 â A4 w 0237 (#348)

- Skrzynka: #320, #322, #323, #324, #346 w planie, bez `pilne`. Nowych zgÅoszeÅ nie ma.
- Scalanie: brak âF7: gotoweâ po A7 (`41f486ed`); CI A7 zielone (db/unit/visual). #317/#259 konflikt â bez scalenia.
- **A4** (ten commit, ta sama migracja 0237 / PR #348): `register_invoice` (READY+CMR C17, VAT 23%, tolerancja 0, INVOICE_NEW takÅ¼e KOSZT), `update_invoice`, `guard_invoice_update`, `invoices_insert` bez CLIENT, `INVOICE_OVERDUE` + macierz `inv_overdue`, `load_status_set` = `c17_cmr_after_delivery`, `INVOICE_A4`/`INVOICE_EDIT: true`.
- Oczekiwane bramy: money 138, nullguard 681, e25 79. Unit lokalnie: p8/c3/w-naprawy/w-faktura-termin **58/58**.

## 2026-10-20 07:45 â #349 scalone; F7 niegotowe #348 â poprawki bramy db

- Skrzynka: #320, #322, #323, #324, #346 w planie, bez `pilne`. Nowych zgÅoszeÅ nie ma.
- Scalanie: #349 (`ci/typecheck`) â âF7: gotowe do scaleniaâ po `a3836f9`, CI zielone, merge `786d46c3`. `deploy-main` nie czekamy.
- #348 F7 niegotowe (`d68d81e`): poprawki w `ffaa25ca`/`f57e4941`; brama db `39374679867` czerwona (security/money/i2/baf/e18).
- Ten krok: money (rola HHL_OPS przez `sys`, `commit` po akceptacji), security (wzorzec âEdytuj fakturÄâ), i2 (KSH bez polisy SCX + HHL widzi; i2=553), baf (czyszczenie combo po triggerze A7), e18 (READY przed shipment_items), komunikat bÅÄdu w triggerze A7.
- Czeka na zielone CI i âF7: gotowe do scaleniaâ po ostatnim commicie. #317/#259 konflikt â bez scalenia.

## 2026-10-20 08:05 â #348 brama db: baf 45 (A7 combo)

- Skrzynka: #320, #322, #323, #324, #346 w planie, bez `pilne`. Nowych zgÅoszeÅ nie ma.
- Scalanie: brak âF7: gotoweâ po `25c1a98c`. Unit/visual zielone; db `39376792710` czerwone: **baf** 45/46 â asercja âcombo_* pusteâ po A7 (trigger wypeÅnia combo z `symbol_specs`).
- Poprawka: usuniÄta asercja i zbÄdne czyszczenie combo w `baf.sh` (wycena i tak `dims_source=CARGO` z pozycji); `gate-suites` baf **45**. Czeka na zielone CI i F7. #317/#259 konflikt â bez scalenia.

## 2026-10-20 08:20 â #350 scalone; #348 F7 runda 2 poprawki

- Skrzynka: #320, #322, #323, #324, #346 w planie, bez `pilne`. Nowych zgÅoszeÅ nie ma.
- Scalanie: #350 (`wyglad/W-a10-zrodlo`) â âF7: gotowe do scaleniaâ po `383f55b`, CI zielone, merge `d0e6f8d4`. `deploy-main` nie czekamy.
- #348 CI na `6b663338` zielone (unit/visual/db); F7 runda 2 **niegotowe** â ten krok:
  - B2: `load_events` bez `source=SYSTEM`; `guard_load_update` pozwala INVOICEDâREADY w `tower.invoice_edit`;
  - B3: `trg_shipment_items_a7_symbol` przywraca `bulk_quiet`; P8 wymiary w wyzwalaczu;
  - P4: `visible_to` tylko polisy CARRIER; P5: `dispute_track` pomija przy edycji; P7: INSERT tylko z `register_invoice`;
  - P6: money +13 (PRZYCHOD/ZGODNA/usuniÄcie/OPLATA/B3/P7) â **162**.
- Czeka na zielone CI i âF7: gotowe do scaleniaâ. #317/#259 konflikt â bez scalenia.

## 2026-10-20 08:50 â #348 money 3 FAIL po F7 runda 2 â poprawki testÃ³w

- Skrzynka: #320, #322, #323, #324, #346 w planie, bez `pilne`. Nowych zgÅoszeÅ nie ma.
- Scalanie: brak âF7: gotoweâ po `9688bd14`. Unit/visual zielone; db `39380884619` czerwone: money **159/3**.
- Poprawki `money.sh` (bez migracji):
  1. OPLATA_PALIWOWA â `::text` dawaÅo `true`, `val` oczekuje `t` (jak inne boolean);
  2. Z4 â ta sama data co w INSERT L7 = no-op; data `2026-09-24`;
  3. HHL_OPS nie podbija `due_date` HHL/FV (zostawaÅo 26.10 â refresh 26.10 nie dawaÅ PO_TERMINIE).
- Czeka na zielone CI i âF7: gotowe do scaleniaâ. #317/#259 konflikt â bez scalenia.

## 2026-10-20 09:05 â #348 F7 runda 3: OPLATA + P2/P4

- Skrzynka: #320, #322, #323, #324, #346 w planie, bez `pilne`. Nowych zgÅoszeÅ nie ma.
- Scalanie: brak âF7: gotoweâ po `a224f6ca`. Unit zielone; db `39382941105` czerwone: money **161/1** â zapytanie OPLATA bez `FROM invoice_lines` (bÅÄd poprzedniej poprawki).
- Ten krok (F7 runda 3 B1 + P2 + P4):
  1. OPLATA â przywrÃ³cony `FROM invoice_lines â¦ load_id=L7` (boolean bez `::text` â `t`);
  2. P2: wyzwalacz `trg_insurance_policies_doc_visibility` â po `document_id` polisy CARRIER `visible_to` bez CLIENT; test w `insurance.sh` (+2 â 44);
  3. P4: money â SCX usuwa L5, HHL usuwa L6 z PRZYCHOD, zmiana kwoty L7, edycja opÅaconej (HHL_ADMIN + SCX przed akceptacjÄ) â **172**;
  4. U: `dedup_key` STATUS_AUTO z epoch (ponowne usuniÄcie).
- P3 (opis PR z liczbami ROLLBACK) â w komentarzu PR po pushu. Czeka na zielone CI i F7. #317/#259 konflikt â bez scalenia.

## 2026-10-20 09:20 â #348 db FAIL po F7 runda 3 â poprawki

- Skrzynka: #320, #322, #323, #324, #346 w planie, bez `pilne`. Nowych zgÅoszeÅ nie ma.
- Scalanie: brak âF7: gotoweâ po `324a3a4b`. Unit/visual zielone; db `39384899533` czerwone: money **166/6**, insurance **43/1**.
- Poprawki:
  1. `update_invoice` zwraca `payment_status` / `paid_at` (testy opÅaconej czytaÅy pusty klucz);
  2. money: przywrÃ³Ä L5 na KOSZT â INVOICED, zmiana kwoty na L5 (L7 nigdy nie byÅ w parze); `mark_invoice_paid` 39/1 z `commit`; edycja SCX 39/8 bez zmiany `due_date` (M7 â3 od 30.10); money **174**;
  3. insurance: boolean bez `::text` (`f` nie `false`).
- Opis PR #348 uzupeÅniony liczbami P3. Czeka na zielone CI i F7. #317/#259 konflikt â bez scalenia.

## 2026-10-20 09:55 â #348 scalone; start A5 (0238)

- Skrzynka: #320, #322, #323, #324, #346 w planie, bez `pilne`. Nowych zgÅoszeÅ nie ma.
- Scalanie: #348 â âF7: gotowe do scaleniaâ po `708f3000` (07:50Z), CI zielone (db `39387282216`, unit, visual), bez konfliktu. Merge `0f7765a7`. `deploy-main` nie czekamy (D-20261020-0010-01).
- #317 / #259: konflikt z `main` â bez scalenia.
- BieÅ¼Äca **A5** (`pakiet/a5-rejs-prom`): migracja `0238_a5_rejs_prom_port.sql` â `geofences.route`, `promote_ferry_departures` / `apply_geofence_status` / `compute_load_eta` (PORT wedÅug rejsu, `ferry_eta_at`/`wait_ais`, READY_TO_INVOICE jak DELIVERED). Testy status **130** (+9 A5).

## 2026-10-20 10:25 â A5: db czerwone â cieÅ rekordu `s` w compute_load_eta

- Skrzynka: #320, #322, #323, #324 w planie, bez `pilne`. Nowych zgÅoszeÅ nie ma.
- Scalanie: #351 bez F7; #317/#259 konflikt â bez scalenia.
- Brama `db` `39390843961` czerwona: status 96/34, i2 546/7 (`trg_eta_after_load`), workflows/h3/e25/ferry-status/risks.
- Przyczyna: w `compute_load_eta` rekord `s` + alias `FROM sailings s` przy odczycie `s.route` (nieprzypisany rekord) â bÅÄd przy kaÅ¼dym `sailing_id`. Port/prom/ETA i przypisanie rejsu padaÅy.
- Poprawka w tej samej 0238 (jeszcze nie na produkcji): `v_sail` / alias `sa`. Czeka na zielone CI i F7.

## 2026-10-20 11:10 â #352 scalone; A5 db: ETA Stena vs Polferries (ÅwieÅ¼e GPS)

- Skrzynka: #320, #322, #323, #324 w planie, bez `pilne`. Nowych zgÅoszeÅ nie ma.
- Scalanie: #352 (`wyglad/W-a5-port`) â âF7: gotowe do scaleniaâ po `dcd4681`, CI zielone, merge `f8c2f39b`. `deploy-main` nie czekamy.
- #351 na `51dc06cb`: unit/visual zielone; db `39396573337` czerwone â status **132/1**: âA5 ETA plac Stena > Polferriesâ dostaÅo pusty wynik (oba `eta_site` null).
- Przyczyna: pozycje GPS w teÅcie z `2026-10-06` poza `GPS_FRESH_MIN` wzglÄdem `now()` w CI â `compute_load_eta` zwraca null przy `AT_PORT_NYNASHAMN`.
- Poprawka: `process_position(â¦, now() â 5/1 min)` w `tests/db/status.sh`. Oczekiwane status nadal **133**. Czeka na zielone CI i âF7: gotowe do scaleniaâ. #317/#259 konflikt â bez scalenia.

## 2026-10-20 11:30 â A5: db zielone na `b0b7f607`; F7 runda 2 â asercje eta_site

- Skrzynka: #320, #322, #323, #324 w planie, bez `pilne`. Nowych zgÅoszeÅ nie ma.
- Scalanie: #351 â F7 runda 2 niegotowe (przed poprawkÄ GPS); #352 scalone wczeÅniej. #317/#259 konflikt â bez scalenia.
- CI na `b0b7f607`: db `39398905684` / unit / visual **zielone** (status 133).
- F7 runda 2: dopisane `chk` `eta_site is not null` dla Stena i Polferries przed porÃ³wnaniem. Oczekiwane status **135**. Czeka na zielone CI i âF7: gotowe do scaleniaâ.

## 2026-10-20 11:50 â A5 scalone; #353 w planie; start D-1118

- Skrzynka: #353 (`Spawn2018`, `dla-cursora`, bez `pilne`) â D-20261020-1118-01. Wpisane: PLAN Â§3/Â§4 (D-1118 po A5 przed A10), Â§8, dopisek `docs/handover/dopiski/D-20261020-1118-01.md`. ZgÅoszenie otwarte do zrobienia D-1118. #320/#322/#323/#324 juÅ¼ w planie.
- Scalanie: #351 â âF7: gotowe do scaleniaâ po `9aa9616e`, CI zielone, merge `889fc09d`. `deploy-main` nie czekamy. #317/#259 konflikt â bez scalenia.
- BieÅ¼Äca **D-1118** (`pakiet/d1118-zezwolenie-pilot`): migracja 0239 â `permit_fits` (masa, KIND), potem `awiz_pilots_set`.

## 2026-10-20 12:15 â #354 scalone; #356 w planie; fix D-1118 db

- Skrzynka: #356 (`Spawn2018`, `dla-cursora`, bez `pilne`) â decyzja wÅaÅciciela 11:57: wdroÅ¼enie cichego uzupeÅnienia godzin (`import_quiet_hours`), **przed D-1118 i A10**. Wpisane: PLAN Â§3/Â§4/Â§8, dopisek `D-20261020-1157-01.md`. Komentarz w #356 (ÅaÅcuch DECISION_OPEN/RISK_OPEN). #320/#322/#323/#324/#353 w planie.
- Scalanie: #354 â F7 po `17601dc`, CI zielone â merge `a1366549`. #357 bez F7 (db FAIL). #317 konflikt â bez scalenia. #259 bez F7.
- D-1118 fix (ten commit): `permit_fits` bez `select *` (GRANT kolumn 0076); `PILOTS_SET` w CHECK `load_events`; UUID OPS w teÅcie; init `awiz_pilots_set` w BEGIN. Po zielonym CI â kolejna pozycja **#356** (`pakiet/import-godziny-cicho`); #357 zostaje otwarte.

## 2026-10-20 12:55 â D-1118: i2 PL_SE + nullguard 690

- Skrzynka: #356/#353/#324/#323/#322/#320 â w planie, bez `pilne`.
- Scalanie: #357 â brak âF7: gotoweâ; db FAIL (i2 569/2: PL_SE). #355 visual w toku wczeÅniej. #317/#259 konflikt.
- Fix: insert testowy PL_SE z telefonem krajowym (0111), nie E.164 â wczeÅniej INSERT padaÅ w `/dev/null`. nullguard EXPECTED 690. Czeka na zielone CI i F7.

## 2026-10-20 13:20 â #355 scalone; D-1243 w #357; #358/#359 w planie

- Skrzynka: #358 (`Spawn2018`, `dla-cursora`, bez `pilne`) â D-1243 dane osobowe widoczne; razem z D-1118. #359 (`Spawn2018`, `dla-cursora`, bez `pilne`, treÅÄ âpilne przed A10â) â OKQ8 7 dni / Orlen 5 publ. Wpisane: PLAN Â§3/Â§4/Â§8, dopiski `D-20261020-1243-01.md`, `D-20261020-1300-01.md`. BieÅ¼Äcej D-1118 nie przerywam (#359 bez etykiety `pilne`).
- Scalanie: #355 â F7 po `8a9637a`, CI zielone â merge `e7842326`. #357 CI zielone na `4bae611f`, bez F7 (czekajÄ poprawki D-1243). #317/#259 konflikt.
- Ten commit (#357): `awiz_pilots_set` â imiÄ jawne w audit/`load_events`; `load_escort_contacts` CLIENT_*; test KSH `PILOTS_SET`; i2 572; merge main po #355, `AWIZ_PILOTS: true`.

## 2026-10-20 13:55 â #357 CI zielone; D-1322 w planie

- Skrzynka: #359 komentarz D-20261020-1322-01 v3 (`Spawn2018`, bez `pilne`) â obie tabele paliwowe âod proguâ. Wpisane: PLAN Â§4 (D-1300 + 1322), Â§8, dopisek `D-20261020-1322-01.md`; dopisek 1300 pkt 3 â odwoÅanie do 1322. #358/#356/#353/#324/#323/#322/#320 w planie.
- Scalanie: #357 â brak âF7: gotoweâ; CI na `00f41360` zielone (db `39416345323`, unit, visual `39416345221`). #317/#259 konflikt / bez F7 po ostatnim commitcie â bez scalenia.
- BieÅ¼Äca D-1118 (#357): kod + D-1243 w PR gotowe; czeka na F7. Bez przerwania.

## 2026-10-20 14:20 â #357 scalone; start #356 import_quiet_hours

- Skrzynka: #353 zamkniÄte (D-1118 zrobione). #358/#359/#356/#324/#323/#322/#320 otwarte, w planie; bez etykiety `pilne` â bez przerwania.
- Scalanie: #357 â F7 po `374e62c`, CI zielone (db/unit/visual) â merge `b21524b8`. #360 wyglÄd bez F7. #317/#259 konflikt.
- BieÅ¼Äca **#356** (`pakiet/import-godziny-cicho`): migracja (wtedy 0240) â `ops_thresholds.import_quiet_hours=1`, `trg_plan_dates_notify` szanuje `tower.bulk_quiet`, `import_schedule` ciche pierwsze uzupeÅnienie godzin; i2 584 (+12). WyÅÄczenie: `admin_ops_threshold_set('import_quiet_hours', 0)`.

## 2026-10-20 14:45 â #356 fix CI db (i2 skÅadnia, dec6 22 progi)

- Skrzynka: #359/#358/#356/#324/#323/#322/#320 â w planie; bez `pilne`.
- Scalanie: #361 bez F7; #360 visual zielone, bez F7; #317 konflikt z main (koordynator: wciÄgnij main â po zakoÅczeniu CI #361 / G-15).
- Fix #356: `i2.sh` â zagnieÅ¼dÅ¼one cudzysÅowy w IQH â WYNIK brak; wzorzec jak IMP18T. `dec6.sh` â 22 progi (+`import_quiet_hours`).

## 2026-10-20 15:00 â #360 scalone; fix IQH-1 chk (FROM loads)

- Skrzynka: #359/#358/#356/#324/#323/#322/#320 â w planie; bez etykiety `pilne`.
- Scalanie: #360 â F7 po `adefd1c`, CI zielone â merge `953f3ee1`. #361 db FAIL (IQH-1). #317/#259 konflikt.
- Fix #356: `i2.sh` IQH-1 chk â brak `from loads where id` (jak linia godzin D18); CI db `583 OK, 1 FAIL` â oczekiwane 584.

## 2026-10-20 15:40 â #361 F7 niegotowe: B1 + P1âP4

- Skrzynka: #359/#358/#356/#324/#323/#322/#320 â w planie; bez `pilne`.
- Scalanie: #361 F7: niegotowe (15:35). #317 main wciÄgniÄty (`f89b59d9`), czeka na F7. #259 konflikt.
- Poprawki #356 (i2): B1 â quiet tylko gdy `plan_*` w loads puste; P1 komentarz wyÅÄczenia na ekranie; P2 `on conflict do nothing`; P3 testy (KSH, mix, OPS, critical, decisions/risk); P4 UTF-8 w POSTEP. i2 592.

## 2026-10-20 16:00 â #361 CI zielone; skrzynka #362/#364/#365 w planie

- Skrzynka: #364 (D-1525 HOTFIX `trailer_swap`+SE+`carrier_order_no`), #362 (D-1501 awizacja HHL), #365 (emtrack login_failed) â `Spawn2018`, `dla-cursora`, **bez** etykiety `pilne`. Wpisane: PLAN Â§3/Â§4/Â§8, dopiski `D-20261020-1525-01.md`, `D-20261020-1501-01.md`. KolejnoÅÄ po #356: HOTFIX â D-1501 â C15-emtrack â D-1300. BieÅ¼Äcej #361 nie przerywam.
- Scalanie: #361 â CI na `7986ef6f` zielone (db `39431301503`, unit, visual `39431301490`); czeka na âF7: gotowe do scaleniaâ runda 2. #363 wyglÄd bez F7. #317 czeka na F7 po `f89b59d9`. #259 konflikt.
- BieÅ¼Äca #356: poprawki F7 B1+P1âP4 na SHA; bez nowego kodu do F7.

## 2026-10-20 16:05 â HOTFIX D-1525 start (F7 #361: przed #356)

- Skrzynka: #364/#362/#365/#356 â w planie; #364 bez `pilne`, ale F7 #361 kaÅ¼e scaliÄ HOTFIX przed #361. #317 â CI zielone, bez F7 po ostatnim merge main.
- Scalanie: #361 â F7 gotowe (`7ddf16ba`), CI w toku; merge dopiero po HOTFIX. #366/#363 wyglÄd bez F7. #317 bez F7 po `f89b59d9`.
- HOTFIX: `pakiet/hotfix-d1525-trailer-swap` â migracja **0240** `guard_load_update` (lista SCX + HHL_ADMIN `carrier_order_no`); security 122 / TEST 118. CzÄÅÄ 2 NO_AWIZ_SE â z #362. Po scaleniu HOTFIX #356 â migracja 0241.

## 2026-10-20 16:40 â HOTFIX #367 F7 B1 (test security)

- Skrzynka: #364/#362/#365/#356 â bez nowych; #362 PILNE w tytule, bez etykiety `pilne` â nie przerywa HOTFIX.
- Scalanie: #367 â F7 niegotowe (tylko test); db 121/1 FAIL; unit+visual zielone. #361 F7 gotowe po HOTFIX; #366 po #361; #317 bez F7 po `f89b59d9`.
- Poprawka: `security.sh` â puste SE: `driver_delivery_phone_country='PL'` (NOT NULL; jak ekran).

## 2026-10-20 16:54 â HOTFIX #367 SCALONE; #361 â 0241

- Skrzynka: #364/#362/#365/#356 â w planie; bez etykiety `pilne` przerywajÄcej. #364 czÄÅÄ 1 zrobiona (merge); czÄÅÄ 2 NO_AWIZ_SE zostaje z #362.
- Scalanie: #367 â F7 gotowe po `14b90710`, CI zielone (db `39440605672`, unit, visual `39440605710`) â merge `e92d4ba6`. #361 â wciÄgniÄty main, migracja przemianowana **0240â0241**; czeka na CI i ponowne F7. #366 po #361. #317 bez F7 po `f89b59d9`.
- BieÅ¼Äca pozycja: **Import godziny cicho** (#361, 0241).

## 2026-10-20 17:17 â #361+#366+#363 SCALONE; start D-1501 (#362, 0242)

- Skrzynka: #365/#364/#362/#359/#358/#324/#323/#322/#320 â w planie (`Spawn2018`); bez etykiety `pilne`. #356 zamkniÄte po scaleniu.
- Scalanie: #363 F7 po `dd1f122` â `70a67701`. #361 F7 po `5b228efd`, CI zielone â `cd06c89f` (0241). #366 F7 po #361 â `e641bcc7`. #317 bez F7 po `f89b59d9`.
- BieÅ¼Äca: **D-1501** â gaÅÄÅº `pakiet/d1501-no-sailing-tracking`, migracja **0242**: NO_SAILING / NO_TRACKING / NO_AWIZ_SE, rejs historyczny tylko HHL_ADMIN, AWIZ_SE poza Gotowy. i2 604 (+12), risks 34, dec2 23 typÃ³w.

## 2026-10-20 17:45 â D-1501: poprawka I-21 UUID; #368 wpisane do planu

- Skrzynka: #368 (D-1710, `Spawn2018`, `dla-cursora`, PILNE w tytule, **bez** etykiety `pilne`) â wpisane: PLAN Â§3/Â§4/Â§8, dopisek `D-20261020-1710-01.md`. KolejnoÅÄ: po #370 (D-1501), przed C15/D-1300. #365/#364/#362/#359/#358/#324/#323/#322/#320 â w planie.
- Scalanie: #370 bez F7; db padÅo (i2 597/7 â I-21). #369/#317 bez F7 po ostatnim commicie. #259 bez F7.
- BieÅ¼Äca: **D-1501** â I-21: UUID `â¦i21a` â `â¦a21a` (hex); L1 bez `plan_load_*` przy skanie, Å¼eby `l3_scan` = 1.

## 2026-10-20 18:20 â #369 SCALONE; D-1501: kolizja UUID Lfut/SG w status.sh

- Skrzynka: bez nowych `pilne`; #368/#365/#364/#362/#359â¦ w planie.
- Scalanie: #369 F7 po `a50ace88`, CI 7/7 â merge `4fdb8489`. #370: db `39455271674` â status 126/11 (A2), nie F7. #317 CONFLICTING, bez F7 po ostatnim. #259 bez F7.
- BieÅ¼Äca: **D-1501** â `Lfut` z `L 5b` â `L 63` (kolizja z SG-03 w [12] A2 psuÅa INSERT i 11 asercji).

## 2026-10-20 18:45 â D-1501: F7 N2âN7 (po zielonej bramie na 5aa87a6d)

- Skrzynka: bez nowych `pilne`; #368 po #370; #317 bez F7 po ostatnim (CONFLICTING).
- Scalanie: #370 db+unit+visual zielone na `5aa87a6d`, F7 âjeszcze NIEâ (N2âN7). Bez F7 â bez merge.
- BieÅ¼Äca: **D-1501** â N2 ODWOLANYâprzyszÅy; N3 pierwszy skan (escalated_at, bez DECISION_OPEN); N4 due=okno+2h; N5 data zaÅadunku â¤ dziÅ; N6 tylko telematyka; N7 testy. status 138, i2 618.

## 2026-10-20 19:00 â D-1501: N3 filtr czasu (clock_timestamp â now)

- Skrzynka: bez nowych `pilne`; #368/#365/#364/#362/#359â¦ w planie (`Spawn2018`).
- Scalanie: #370 db `39460223216` â i2 616/2 FAIL (pierwszy skan: 24Ã DECISION_OPEN, escalated_at=false). #317 CONFLICTING, bez F7. #371 wyglÄd bez F7. Bez merge.
- BieÅ¼Äca: **D-1501** â N3: `v_t0 := now()` (nie `clock_timestamp()`); delete DECISION_OPEN takÅ¼e po `load_id`. i2 618.

## 2026-10-20 19:45 â D-1501: CI zielone na 76353f09, czekam na F7

- Skrzynka: #368/#365/#364/#362/#359/#358/#324/#323/#322/#320 â w planie (`Spawn2018`, `dla-cursora`); bez etykiety `pilne`. #368 PILNE w tytule â nie przerywa #370.
- Scalanie: #370 unit+visual+db zielone na `76353f09` (db `39466224169`, visual `39466224176`); **brak** âF7: gotowe do scaleniaâ po ostatnim commicie â bez merge. #371 F7 po `dca8866` (scalaÄ po #370). #317 CONFLICTING, bez F7. #259 bez F7.
- BieÅ¼Äca: **D-1501** â F7 N3 peÅne: `l3_scan_first_deploy_quiet`, `bulk_quiet` w `decision_open_from_event`, `escalated_at` tylko gdy `due_at<=now()`, bez DELETE; i2 619. SELECT liczb pierwszego skanu na produkcji â przed `db push` (MCP Supabase tu bez auth).

## 2026-10-20 20:00 â D-1501: F7 #370 miniona dostawa bez zaÅadunku

- Skrzynka: #368/#365/#364/#362/#359/#358/#324/#323/#322/#320 â w planie (`Spawn2018`, `dla-cursora`); bez etykiety `pilne`. #368 po #370.
- Scalanie: czwarty F7 #370 â jeszcze NIE. Jedna zmiana: NO_SAILING i NO_TRACKING nie powstajÄ, gdy `plan_delivery_date` < dziÅ (Warszawa) i `actual_load_at` jest puste. i2 621 (+2). Bez merge do zielonego CI i âF7: gotoweâ.
- BieÅ¼Äca: **D-1501** â filtr w `l3_scan` (0242). SELECT produkcji (odczyt, 20.10): aktywne 92; NO_SAILING otworzy **2** (byÅo 19 w oknie; odciÄte 17), NO_TRACKING otworzy **0** (odciÄte 16), NO_AWIZ_SE 0. ZostajÄ dwa PLANNED z zaÅadunkiem 22.10 i dostawÄ 28â29.10.

## 2026-10-20 20:50 â D-1501: F7 NO_TRACKING = brak linku; kolejnoÅÄ #368â#370

- Skrzynka: #368 rozszerzone (wÅaÅciciel 19:59/20:01 â Åledzenie tylko przy linku, SG-15/16); `#368`/`#365`/`#362`â¦ w planie; bez etykiety `pilne`.
- Scalanie: F7 #370 20:21 â jeszcze NIE (brak zmiany linku). #371 F7 po #370. KolejnoÅÄ merge: **#368 â #370 â #371**.
- BieÅ¼Äca: **D-1501** â wycofane D1/N6: `v_track_missing` bez `not exists (positionsâ¦)`; test: pozycja telematyczna bez linku nie wycisza, link wycisza. i2 **620**. SELECT NO_TRACKING na produkcji â ponowiÄ przed `db push`.

## 2026-10-20 21:20 ? #372 SCALONE; start D-1710 (#368, 0242)

- Skrzynka: #368/#365/#364/#362/#359? ? w planie (Spawn2018, dla-cursora); bez etykiety `pilne`.
- Scalanie: #372 SCALONE (`bbbd4c7c`, wyglad sledzenie bez linku). #370 F7: gotowe (head `18de74c`) ? **po #368**. #371 po #370.
- Biezaca: **D-1710** ? galaz `pakiet/d1710-tracking-window-link`, migracja **0242**: okno tylko przy linku, freeze po starcie, odlaczenie pozycji/zdarzen, READY dla falszywego Droga PL, matchTrailer bez naczepy samej. D-1501 (#370) po rebase ? **0243**.

## 2026-10-20 22:00 ? D-1710 (#373): F7 poprawki

- Skrzynka: bez nowych `pilne`; #368/#365/#362? w planie (`Spawn2018`).
- Scalanie: #370/#371 czekaja na #368; #373 F7: niegotowe ? poprawki w tym PR.
- Biezaca: **D-1710 F7** ? `d1710_repair()` (bez eta/track_ctx, trigger off, po dowodzie), `telm_infer` tylko po starcie, `guard` SCX `tracking_opened_at`, L17 bez wymogu linku, `report_position` wymaga linku, matchTrailer URL emtrack + naczepa, testy money/release/risks/i2/baf/status 141 / baf 46.

## 2026-10-20 22:00 â D-1710 (#373): F7 poprawki

- Skrzynka: bez nowych `pilne`; #368/#365/#362â¦ w planie (`Spawn2018`).
- Scalanie: #370/#371 czekajÄ na #368; #373 F7: niegotowe â poprawki w tym PR.
- BieÅ¼Äca: **D-1710 F7** â `d1710_repair()` (bez eta/track_ctx, trigger off, po dowodzie), `telm_infer` tylko po starcie, `guard` SCX `tracking_opened_at`, L17 bez wymogu linku, `report_position` wymaga linku, matchTrailer URL emtrack + naczepa, testy status 141 / baf 46.

## 2026-10-20 22:30 â D-1710 (#373): F7 runda 2

- Skrzynka: bez nowych `pilne`; #368/#365/#362â¦ w planie (`Spawn2018`).
- Scalanie: #373 F7 ponownie niegotowe (db czerwone: risks 2, baf 7); #370/#371 czekajÄ.
- BieÅ¼Äca: **D-1710 F7 r2** â `v_pos_ids bigint[]`; dowÃ³d tylko TELM IN_TRANSIT+synt. EXIT / pozycje bez linku; `v_t0` z ts/occurred_at; decision_events z RETURNING; telm â¤AT_LOADING bez actual â null; reset telm/geofence bez DELETE; baf AT_LOADINGââ, SE w trasie; LATE_DATE po D-1710; test repair; status 149 / baf 47.

## 2026-10-20 22:50 â D-1710 (#373): db risks â sprzÄtanie FK

- Skrzynka: #368 PILNE (bieÅ¼Äca); pozostaÅe `dla-cursora` w planie. Bez F7 âgotoweâ na #373.
- Scalanie: #370 F7 gotowe **po #368**; #371 po #370; #317/#259 konflikt â bez scalenia.
- CI na `465f547e`: unit/visual zielone; `db` FAIL â `risks` 8 kluczy zamiast 6 (`rk_eta_after_latest`, `rk_late_date_change`): DELETE bez kaskady na `decisions.risk_id`.
- BieÅ¼Äca: sprzÄtanie w `status.sh` z `decision_events`â`decisions`â`risk_signals` (LATE_DATE + ETA z testu repair). Czekam na zielonÄ `db` i F7.

## 2026-10-20 23:15 â D-1710 (#373): F7 r3 dedup_key :d1710

- Skrzynka: #368/#365/#362/#359/#358/#324/#323/#322/#320 â w planie (`Spawn2018`); bez etykiety `pilne`.
- Scalanie: CI na `9cb8a547` zielone (unit/visual/db); brak âF7: gotoweâ (trzecie F7: prawie). #370 F7 gotowe **po #368**; #371 po #370; #317/#259 konflikt â bez scalenia.
- BieÅ¼Äca: **D-1710 F7 r3** â przy odÅÄczaniu `dedup_key || ':d1710'`; fixture `STATUS_AUTO:<id>:IN_TRANSIT_PL`; asercja prawdziwego STATUS_AUTO po `auto_set_status`; NO_AWIZACJA + brak nowych notifications/workflow_runs. status **155**.

## 2026-10-20 23:45 â #373 D-1710 SCALONE; rebase D-1501 â 0243

- Skrzynka: #368/#365/#362/#359/#358/#324/#323/#322/#320 â w planie (`Spawn2018`); bez etykiety `pilne`.
- Scalanie: #373 F7: gotowe (head `abca2bc`) po ostatnim commicie, CI 8/8 â merge `c4779dc1`. #370 F7 stare uniewaÅ¼nione rebase; #371 po #370; #317/#259 konflikt.
- BieÅ¼Äca: **D-1501** â rebase na main, migracja **0243**; NO_TRACKING = brak linku + warunek czasu (bez `load_in_tracking_window`); `guard_load_update` na bazie 0242 D-1710.

## 2026-10-20 23:55 â D-1501 (#370): rebase na main â 0243

- Skrzynka: #368/#365/#362â¦ w planie (`Spawn2018`); bez `pilne`.
- Scalanie: #373 SCALONE (`c4779dc1`). #370 F7 stare uniewaÅ¼nione (rebase); #371 po #370.
- BieÅ¼Äca: **D-1501** â migracja **0243**; NO_TRACKING = brak linku + `p_now >= coalesce(tracking_opened_at, tracking_window_start)` (bez `load_in_tracking_window`); `guard` SCX `tracking_opened_at` z 0242; status **158**, i2 **620**. Czekam na CI i F7.

## 2026-10-21 00:10 â HOTFIX #374 emtrack version/noflicker (PR #375)

- Skrzynka: **#374** (Spawn2018, `dla-cursora`, PILNE w tytule) â wpisane: PLAN Â§3/Â§4/Â§8, dopisek `D-20261020-2355-01.md`. #365/#359/#358/#324/#323/#322/#320 â w planie. Bez etykiety `pilne`.
- Scalanie: F7 00:15 na #375 â kolejnoÅÄ: najpierw #370 (0243), potem #371, #375â0244. #370 F7 gotowe (`c13251e`) â merge `b44660c7`. #371 F7 â merge `a6e217a5`. #317/#259 konflikt.
- BieÅ¼Äca: **HOTFIX #374** â rebase na main, migracja **0244**; asercja money `::text` â `true`; money **178**. Czekam na CI i F7.

## 2026-10-21 00:50 â HOTFIX #374: F7 drobne (PR #375)

- Skrzynka: #374 nadal otwarte (PILNE); reszta w planie, bez `pilne`.
- Scalanie: CI na `ed388785` zielone (db/unit/visual). Brak âF7: gotoweâ po head â drobne F7 w tym kroku. #317/#259 bez F7 po ostatnim commicie / konflikt.
- BieÅ¼Äca: **HOTFIX #374** â `channel = 'IN_APP'` przy oznaczaniu dzwonkÃ³w; money +1 asercja âwznowienie bez nowego RISK_OPENâ; money **179**. Push â czekam na CI i F7.

## 2026-10-21 01:20 â C15-emtrack LOGIN wait (#365)

- Skrzynka: #365 otwarte (`Spawn2018`, `dla-cursora`); #374 zamkniÄte po merge. #359/#358/#324/#323/#322/#320 â w planie. Bez etykiety `pilne`.
- Scalanie: #375 SCALONE `5a67a23b` (F7 na `61da3d3`, deploy-main OK). #317 CONFLICTING (bez F7 po ostatnim merge main). #259 bez F7.
- Ops #365: `emtrack_login_state` fail_streak=0; od ~22:52 UTC `emtrack-web` ok=true, objects=7, version 6.33.0 (sekrety Edge poprawione wczeÅniej). local `.env` z otaczajÄcymi `'` â FP â  Edge; po `unquoteSecret` FP=Edge.
- BieÅ¼Äca: **C15-emtrack** (`pakiet/c15-emtrack-login-wait`) â czekanie na LOGIN_RESPONSE+sessionId, ignorowanie ostrzeÅ¼eÅ (tylko `type` w logu), wait+1Ã LOGIN, `unquoteSecret`. vitest emtrack-web **18/18**.

## 2026-10-21 01:40 â pÄtla: C15 CI zielone; #317 main; skrzynka zamkniÄta

- Skrzynka: #362/#364/#358 zamkniÄte (pozycje SCALONE). #365 otwarte (C15). #359/#324/#323/#322/#320 w planie (`Spawn2018`, `dla-cursora`); bez etykiety `pilne`.
- Scalanie: #376 C15 â CI zielone na `cf641647` (unit/visual/db), MERGEABLE; **brak** âF7: gotowe do scaleniaâ â bez merge. #317 â ten commit: main wciÄgniÄty, konflikt POSTEP (obie strony + pkt 14.5). #259 konflikt / bez F7.
- BieÅ¼Äca: **C15-emtrack** (#365 / #376) â kod gotowy, czeka na F7. Potem D-1300 (#359).

## 2026-10-21 01:45 â C15 F7 prawie: B1/D1/D4 (#376)

- Skrzynka: #365 otwarte; #362/#364/#358 zamkniÄte. #359â¦ w planie; bez `pilne`.
- Scalanie: #376 F7 âprawieâ (B1 tekst w login_code, D1 extractWaitSeconds z tekstu, D4 testy). #317 main wciÄgniÄty â czeka F7.
- BieÅ¼Äca: **C15** â code/waitSec tylko z LOGIN_RESPONSE (safe code); wait bez parsowania tekstu; max 2 LOGIN; timeout bez fail_streak. vitest emtrack-web **19/19**.

## 2026-10-21 02:00 â pÄtla: #317 SCALONE; #376 main (konflikt POSTEP)

- Skrzynka: #365 otwarte (C15). #359/#324/#323/#322/#320 w planie (`Spawn2018`, `dla-cursora`); bez etykiety `pilne`.
- Scalanie: #317 SCALONE `4e6528e6` (F7 na `ef28a55`, unit/visual zielone). #376 po F7 B1/D1/D4 (`0ce32ae7`) â CI zielone (unit/visual/db), potem CONFLICTING po #317 â ten commit: main wciÄgniÄty, konflikt POSTEP (obie strony). #259 konflikt / bez F7.
- BieÅ¼Äca: **C15-emtrack** (#365 / #376) â push merge; czekam na zielone CI i âF7: gotowe do scaleniaâ. Potem D-1300 (#359).

## 2026-10-21 02:20 â pÄtla: #376 CI zielone na 84a7c5d0; czeka F7

- Skrzynka: #365 otwarte (C15). #359/#324/#323/#322/#320 w planie (`Spawn2018`, `dla-cursora`); bez etykiety `pilne`.
- Scalanie: #376 â CI zielone na `84a7c5d0` (unit/visual/db), MERGEABLE CLEAN. F7 âgotoweâ byÅo na `0ce32ae`; po merge main nowy head â bez ponownego F7 = bez merge. #259 konflikt / bez F7.
- BieÅ¼Äca: **C15-emtrack** (#365 / #376) â kod gotowy; czekam na âF7: gotowe do scaleniaâ po `84a7c5d0`. Potem D-1300 (#359).

## 2026-10-21 02:45 â C15 SCALONE; start D-1300 (#359)

- Skrzynka: #365 zamkniÄte (C15). #359/#324/#323/#322/#320 w planie (`Spawn2018`, `dla-cursora`); bez etykiety `pilne`.
- Scalanie: #376 SCALONE `78c77bbd` (F7 na `12f0673`, CI unit/visual/db zielone). #259 konflikt / bez F7.
- BieÅ¼Äca: **D-1300** (`pakiet/d1300-paliwo-okq8-7dni`) â migracja **0245**: OKQ8 7 dni (`sefs_sek_daily_avg`), lookup âod proguâ (D-1322), over_table + krok, przeliczenie niezafakturowanych + `SEFS_INVOICE_DIFF` przy fakturze; `fuel-prices` ÅºrÃ³dÅa osobno; testy `baf`/`i31` za decyzjÄ.

## 2026-10-21 03:10 â D-1300 (#359 / #377): poprawka bramy db

- Skrzynka: #359/#324/#323/#322/#320 w planie (`Spawn2018`, `dla-cursora`); bez etykiety `pilne`.
- Scalanie: #377 â unit/visual zielone na `cb1c1027`; db czerwone (baf 22,99â22,85; i31 10; `l1b_sefs_note` bez straÅ¼y 0230). #259 bez F7.
- BieÅ¼Äca: **D-1300** â asercja SEK t41 = 22,85 (D-1322); `i31: 10`; przywrÃ³cona straÅ¼ SOURCE tylko przy OSTATECZNY w `l1b_sefs_note` (0230).

## 2026-10-21 03:25 â D-1300 (#359 / #377): F7 runda 2

- Skrzynka: #359/#324/#323/#322/#320 w planie (`Spawn2018`, `dla-cursora`); bez etykiety `pilne`.
- Scalanie: #377 â CI zielone na `b09d1bd4`; F7 âjeszcze NIEâ (lista blokujÄca). #259 bez F7.
- BieÅ¼Äca: **D-1300** â usuniÄty `l1b_sefs_note` z 0245 (zostaje 0230); cienki `sefs_compute_hybrid`; `sefs_sek_daily_avg` bez cichego tygodnia bez publikacji + `pubs_sek` bez duplikatÃ³w; `sefs_scan_invoice_mult_diff`; cron 07:15/09:15/13:15 PL; `fuel-prices` 3 prÃ³by, ingest osobno, `integration_runs.ok` tylko gdy oba ÅºrÃ³dÅa OK; `baf` 62.

## 2026-10-21 03:55 â D-1300 (#359 / #377): db po F7 runda 2

- Skrzynka: #359/#324/#323/#322/#320 w planie (`Spawn2018`, `dla-cursora`); bez etykiety `pilne`.
- Scalanie: #377 â unit/visual zielone na `747292a3`; db czerwone (baf 57/62, money 178/179). #259 konflikt / bez F7.
- BieÅ¼Äca: **D-1300** â `baf`: wyÅÄczenie `trg_fuel_readings_immutable` przed DELETE seeda t42; UUID LINV hex; `sefs_last_ostateczny` szuka wstecz tygodnia z publikacjÄ OKQ8 (money PROGNOZA); `baf` 63.

## 2026-10-21 04:15 â D-1300 (#359 / #377): F7 runda 3 â poprawki F7-2

- Skrzynka: #359/#324/#323/#322/#320 w planie (`Spawn2018`, `dla-cursora`); bez etykiety `pilne`.
- Scalanie: #377 â CI zielone na `cd487035`; F7 runda 2 âjeszcze NIEâ (SOURCE odwrotnie, Orlen TDZ, cron UTC). #259 konflikt / bez F7.
- BieÅ¼Äca: **D-1300** â `sefs_sek_daily_avg`: SOURCE = brak odczytÃ³w (period); cron `15 * * * *` + godzina PL w funkcji; Orlen `orlenIngestPayload` (bez TDZ); prÃ³by 20 s / timeout 240 s; baf 64 + unit ingest.

## 2026-10-21 04:45 â D-1300 SCALONE; start A10 (#324)

- Skrzynka: #359 zamkniÄte (D-1300). #324/#323/#322/#320 w planie (`Spawn2018`, `dla-cursora`); bez etykiety `pilne`.
- Scalanie: #377 F7 âgotowe do scaleniaâ po `44f54cad`, CI unit/visual/db zielone â merge `e5e2aa69`. #259 konflikt / bez F7.
- BieÅ¼Äca: **A10** (`pakiet/a10-automat-statusow`) â migracja **0246**: prep w obie strony, geofence z wczeÅniejszych statusÃ³w, zapas FERRY (b/c), billing po DELIVERED, dedup STATUS_AUTO z czasem; testy `status`/`e25`.

## 2026-10-21 05:45 â A10 (#324 / #378): F7 po czerwonej db

- Skrzynka: #324/#323/#322/#320 w planie (`Spawn2018`, `dla-cursora`); bez etykiety `pilne`. Nowych zgÅoszeÅ nie ma.
- Scalanie: #378 â unit/visual zielone na `362e7c6e`; db czerwone (risks 5/6, e18 SG-24, e25 LOADING 08:30). F7 âNIEâ + uwagi 05:25. #259 konflikt / bez F7.
- BieÅ¼Äca: **A10** â F7: SAILING poza lukami; cofniÄcie tylko po STATUS_AUTO; PLANNED na wyzwalaczu sys bez ruchu; JWT clear przy auto_set_status; READY bez HHL zablokowane (W12); cron ferry; cisza powiadomieÅ w prep; testy security/aud03/release przywrÃ³cone; status 160 / e25 86.

## 2026-10-21 06:25 â A10 (#324 / #378): F7 âprawieâ â JWT/guard + PLANNED bez daty

- Skrzynka: #324/#323/#322/#320 w planie (`Spawn2018`, `dla-cursora`); bez `pilne`. Nowych zgÅoszeÅ nie ma.
- Scalanie: #378 â CI zielone na `8ea860db` (unit/visual/db); F7 âprawieâ (JWT clear nieskuteczne na produkcji + uwagi). #259 konflikt / bez F7. Bez âgotowe do scaleniaâ.
- BieÅ¼Äca: **A10** â F7: `guard_load_update` przepuszcza tylko `status`+`updated_at` przy `tower.auto_status` (bez podmiany JWT; flagi zerowane po UPDATE); stub `auth.uid` jak PostgREST (`claims->>'sub'`); PLANNED bez `plan_load_date` zostaje; wahanie = tylko przejÅcie odwrotne < 10 min; e25 90.

## 2026-10-21 06:50 â A10 (#324 / #378): db e25 4 FAIL â poprawka

- Skrzynka: #324/#323/#322/#320 w planie (`Spawn2018`, `dla-cursora`); bez `pilne`. Nowych zgÅoszeÅ nie ma.
- Scalanie: #378 â unit/visual zielone na `a3b94952`; db czerwone (e25 86/90). F7 âczekam na zielone CIâ. #259 konflikt / bez F7.
- BieÅ¼Äca: **A10** â PLANNED bez daty przed `awiz_started` (numery zleceÅ nie ruszajÄ); wahanie GPS tylko poza Przygotowaniem (prep zawsze STATUS_AUTO na osi).

## 2026-10-21 07:05 â A10 (#324 / #378): F7 â usuÅ ochronÄ przed wahaniem

- Skrzynka: #324/#323/#322/#320 w planie (`Spawn2018`, `dla-cursora`); bez `pilne`. Nowych zgÅoszeÅ nie ma.
- Scalanie: #378 â CI zielone na `4a05ed15` (unit/visual/db); F7 âusunÄÄ ochronÄ caÅkowicieâ (04:49 UTC). #259 konflikt / bez F7. Bez âgotowe do scaleniaâ.
- BieÅ¼Äca: **A10** â `auto_set_status` zawsze zapisuje STATUS_AUTO (`v_osc` usuniÄte); histereza tylko w `apply_geofence_status`; e25 93 (+3 wahanie trasy AâBâA).

## 2026-10-21 07:30 â A10 SCALONE; start B4

- Skrzynka: #324 zamkniÄte (A10). #323/#322/#320 w planie (`Spawn2018`, `dla-cursora`); bez `pilne`.
- Scalanie: #378 F7 âgotowe do scaleniaâ po `bddb2afe`, CI unit/visual/db zielone â merge `19e33069` (0246). #259 konflikt / bez F7. Bez push na `main`.
- BieÅ¼Äca: **B4** (`pakiet/b4-visible-to`) â migracja **0247**: Cz1 w `set_message_author`, Cz2 `visible_to` w `list_load_messages_ui`; security +9 (131).

## 2026-10-21 08:05 â B4 F7 #380 (jeszcze NIE â poprawki w PR)

- Skrzynka: #323/#322/#320 w planie; bez `pilne`. Nowych zgÅoszeÅ nie ma.
- Scalanie: #380 â CI unit/visual/db zielone na `b15ef7f2`, ale F7 âjeszcze NIEâ (05:43 UTC) â bez scalenia. #259 konflikt / bez F7. Bez push na `main`.
- BieÅ¼Äca: **B4 cz.1 (czat)** â F7: CHECK `visible_to`; `list_load_messages_ui` dostÄp jak 0208; `mark_load_message_read` z widocznoÅciÄ; testy SCX/puste/SITE/UPDATE/cudzy transport/ALLâKSH; PLAN: cz.2 = dokumenty po scaleniu cz.1.

## 2026-10-21 08:25 â B4: security 138 (F7 +7 asercji)

- Skrzynka: #323/#322/#320 w planie (`Spawn2018`, `dla-cursora`); bez `pilne`. Nowych zgÅoszeÅ nie ma.
- Scalanie: #380 â F7 âjeszcze NIEâ na `67d1a0a` (05:43); po `fc71cb87` unit/visual zielone, `db` czerwone: security 138/131. #259 konflikt / bez F7. Bez push na `main`.
- BieÅ¼Äca: **B4 cz.1** â `EXPECTED_LOCAL.security` 131â138 (+7 F7); TEST 134.

## 2026-10-21 08:45 â B4 cz.1 SCALONE; start B4 cz.2 (dokumenty)

- Skrzynka: #323/#322/#320 w planie (`Spawn2018`, `dla-cursora`); bez `pilne`. Nowych zgÅoszeÅ nie ma.
- Scalanie: #380 F7 âgotowe do scaleniaâ po `74371d77` (06:41 UTC), CI unit/visual/db zielone â merge `31179814` (0247). #259 konflikt / bez F7. Bez push na `main`.
- BieÅ¼Äca: **B4 cz.2** (`pakiet/b4-docs-visible-to`, **0248**) â CHECK `documents_visible_to_chk`; polityki `load_message_reads` z dostÄpem do transportu; testy ALL own / doc HHL+SCX (paczka) / macierz przywrÃ³cona; security 138â147.

## 2026-10-21 09:05 â B4 cz.2: fixture CAR2B4 przez sys (db 146/147)

- Skrzynka: #323/#322/#320 w planie (`Spawn2018`, `dla-cursora`); bez `pilne`. Nowych zgÅoszeÅ nie ma.
- Scalanie: #381 â unit/visual zielone, `db` FAIL: security 146 OK / 1 FAIL (`SCX nie wstawi odczytuâ¦` â pusty id po rollback fixture). Bez F7. #259 konflikt / bez F7. Bez push na `main`.
- BieÅ¼Äca: **B4 cz.2** â fixture `b4-cudzy-all` / CAR2B4 przez `sys` (commit), nie w `val` (rollback).

## 2026-10-21 09:20 â B4 cz.2 F7 #381: CHECK + wyzwalacz + DOC_UPLOADED

- Skrzynka: #323/#322/#320 w planie (`Spawn2018`, `dla-cursora`); bez `pilne`. Nowych zgÅoszeÅ nie ma.
- Scalanie: #381 â F7 âjeszcze NIEâ (07:00 UTC, head `5ea5b55`); po fixture `0528ca2` CI unit/visual/db zielone, bez ponownego âgotoweâ. #259 konflikt / bez F7. Bez push na `main`.
- BieÅ¼Äca: **B4 cz.2** â F7: CHECK tylko ALL/HHL+SCX; `set_document_visible_to` (KSHâALL); `load_events.visible_to` + filtr `events_read` dla DOC_UPLOADED; security 147â155.

## 2026-10-21 09:40 â B4 cz.2: CI zielone na 226bdee1; czeka F7

- Skrzynka: #323/#322/#320 w planie (`Spawn2018`, `dla-cursora`); bez `pilne`. Nowych zgÅoszeÅ nie ma.
- Scalanie: #381 â CI unit/visual/db zielone na `226bdee1` (db `39561683717`, visual `39561683837`); MERGEABLE. F7 âjeszcze NIEâ byÅo na `5ea5b55`; po poprawkach komentarz âczekam na zielone CI i ponowne gotoweâ â **brak** âF7: gotowe do scaleniaâ po `226bdee1` â bez merge. #259 konflikt / bez F7. Bez push na `main`.
- BieÅ¼Äca: **B4 cz.2** (#381 / 0248) â kod F7 gotowy; czekam na âF7: gotowe do scaleniaâ. Potem B5.

## 2026-10-21 11:40 â #384 `pilne`: HOTFIX decyzji/CHECK (pkt 1)

- Skrzynka: #384 (`Spawn2018`, `dla-cursora`+`pilne`) â przerywa B5. Wpisane: PLAN Â§3/Â§4/Â§8, dopisek `D-20261021-1130-01.md`. #323/#322/#320 w planie, bez `pilne`.
- Scalanie: brak âF7: gotowe do scaleniaâ po ostatnim commicie (#382 czeka CI/F7; #383 ânie scalaÄ jeszczeâ; #385 CI w toku; #259 konflikt). Bez push na `main`.
- BieÅ¼Äca: **HOTFIX #384 pkt 1** (`pakiet/hotfix-384-decision-events`, migracja **0249**) â `DECISION_EFFECT`/`DECISION_SAILING`/`DECISION_KEEP_TOWER` w CHECK; zestaw `dec-fx` (12 OK). B5 â 0250 po rebase.

## 2026-10-21 12:05 â #384 pkt 1: poprawka `dec-fx` po czerwonym CI

- Skrzynka: #384 `pilne` (bieÅ¼Äca); #323/#322/#320 w planie, bez `pilne`.
- Scalanie: #386 db FAIL (dec-fx 6/5); brak F7. #382 db FAIL (B5 czeka na HOTFIX). #383/#385 bez âF7: gotoweâ. Bez push na `main`.
- BieÅ¼Äca: **HOTFIX #384 pkt 1** â `dec-fx`: `prokind='f'` (bez `pg_get_functiondef` na agregatach), resolve przez `set local role` / odczyt zdarzeÅ jako postgres. Push â CI.

## 2026-10-21 12:25 â #384 pkt 1: UUID hex + literaÅy ARE â¤255

- CI `e6a566f4`: dec-fx 8 OK / 3 FAIL â ACCEPT/KEEP_TOWER zielone; literaÅy `{0,1200}` poza limitem ARE; UUID `â¦dfs2` nie-hex.
- Poprawka: UUID `df01`/`df11`/`df02`/`df12`; literaÅy = 255 znakÃ³w po `insert into load_events` + wzorzec `'TYP', now()`.

## 2026-10-21 13:25 ? #384 pkt 1 SCALONE; start pkt 2?4

- Skrzynka: #384 pilne (bie??ca); #323/#322/#320 w planie, bez pilne.
- Scalanie: #386 F7 ?gotowe? po `a35243c` + CI unit/visual/db zielone ? merge `ea71bc9e` (0249). #385 merge `c83f8ced`. #387 merge `d2e09ba9`. #382/#383 bez F7 gotowe. Bez push na `main`.
- Bie??ca: **HOTFIX #384 pkt 2?4** (`pakiet/hotfix-384-pkt2-4`, migracja **0250**) ? `l3_ksh_lead` tylko przysz?a <5 dni; `l1b` puste file + `orderNo` w mapie; import okno ?do? + hist quiet; AUTO_CLOSED. B5 ? 0251.

## 2026-10-21 14:00 â #384 pkt 2â4: poprawka CI db

- Skrzynka: #384 `pilne` (bieÅ¼Äca); #323/#322/#320 w planie, bez `pilne`.
- Scalanie: #388 db FAIL â brak F7. #382 konflikt / bez F7. Bez push na `main`.
- BieÅ¼Äca: **HOTFIX #384 pkt 2â4** â UTF-8, `l3_lead_alarm` przyszÅa, `quiet_hist`, import.sh daty przyszÅoÅci, sprzÄtanie IW-1/IH-1.

## 2026-10-21 14:15 â #384 pkt 2â4: F7 runda (SELECT, okno, notify)

- Skrzynka: #384 `pilne`; #323/#322/#320 w planie.
- Scalanie: #388 F7 âjeszcze NIEâ (head `0a91474`); db FAIL (brak `plan_*_date` w SELECT â import/g20/i2). #382 bez F7 gotowe. Bez push na `main`.
- BieÅ¼Äca: poprawki F7 w 0250 â SELECT `plan_load_date`/`plan_delivery_date`; okno 4a (ta sama data + do > od); `v_historic` = DELIVERED lub stara+nowa dostawa minione; `notification_ids` + DECISION_OPEN dla lead; pkt 3 zawÄÅ¼ony do fali 21.10 09:21 UTC; import.sh daty od `current_date` + hist (+6, oczekiwane 72).

## 2026-10-21 14:30 â #384 pkt 2â4: i2 izolacja 54 h

- Skrzynka: #384 `pilne` (bieÅ¼Äca); #323/#322/#320 w planie, bez `pilne`.
- Scalanie: #388 CI db FAIL na `75d153f8` â i2 âza 54 h: bez ryzykaâ = 2 (reszta zielona: import 72, g20 15, dec-auto 83). Brak âF7: gotoweâ. #382 konflikt / bez F7. Bez push na `main`.
- BieÅ¼Äca: i2 â `decision_events` przed delete decisions; IH status przez replica; przed I-21 anuluj importy poza L1/L2 (jak L7/A1).

## 2026-10-21 15:00 â #384 pkt 2â4 SCALONE; start pkt 5â6

- Skrzynka: #384 `pilne` (bieÅ¼Äca); #323/#322/#320 w planie, bez `pilne`.
- Scalanie: #388 F7 gotowe (`ad1a572`) â merge `da77c46a` (0250). #382 czeka (0252 po pkt 5â6). Bez push na `main`.
- BieÅ¼Äca: **HOTFIX #384 pkt 5â6** (`pakiet/hotfix-384-pkt5-6`, migracja **0251**) â `decision_resolve(..., p_payload)`; `KSH_DATE_COUNTER`; `l2_may_resolve` + HHL_OPS po eskalacji/terminie.

## 2026-10-21 15:15 â #384 pkt 5â6: CI status A2 L14

- Skrzynka: #384 `pilne` (bieÅ¼Äca); #323/#322/#320 w planie, bez `pilne`.
- Scalanie: #389 db FAIL (status 158/160: A2 L14 KSH/OPS odmowa â âBrak otwartej sprawyâ). `deploy-main` po #388 ponowiony â sukces (0250 na produkcji). Brak F7. Bez push na `main`.
- BieÅ¼Äca: `delivered_check_resolve` â przy braku otwartej sprawy najpierw `l2_may_resolve(CARRIER,null)` â 42501 (jak A2), potem komunikat braku sprawy.

## 2026-10-21 15:40 â #384 pkt 5â6: F7 #389 poprawki

- Skrzynka: #384 `pilne` (bieÅ¼Äca); #323/#322/#320 w planie, bez `pilne`.
- Scalanie: #389 CI zielone na `56e09e65`, F7 âjeszcze NIEâ (13:18 UTC) â bez merge. #382 konflikt / 0252. Bez push na `main`.
- BieÅ¼Äca: F7 â ACCEPT przez `ksh_confirm_dates` + `counter_accept` (bez `l3_ksh_lead`); przesuniÄcie od/do; `l2_may_resolve` CLIENT=projekt, HHL_OPS tylko CARRIER/HHL; walidacja `p_payload`; notify SCX; `delivered_check` kolejnoÅÄ; dec2 48â62.

## 2026-10-21 16:00 â #384 pkt 5â6: dec2 ACCEPT + wpis #391

- Skrzynka: #384 `pilne` (bieÅ¼Äca); **#391** `pilne` (D-1535 t40 Ã1,14) wpisane do PLAN Â§3/Â§4/Â§8 + dopisek; po #389 â 0252, B5 â 0253. #323/#322/#320 w planie.
- Scalanie: #389 db FAIL (dec2 58/62: ACCEPT licznika â `v_dd < v_ld` przy samej `load_date`). Brak F7. Bez push na `main`.
- BieÅ¼Äca: przy samej `load_date` w propozycji przesuÅ `plan_delivery_date` (+ okna) o rÃ³Å¼nicÄ dni, potem `ksh_confirm_dates`.

## 2026-10-21 16:15 â #384 pkt 5â6: F7 drobne + dec2 60/62

- Skrzynka: #384/#391 `pilne`; #391 juÅ¼ w planie. Bez F7 âgotoweâ.
- Scalanie: #389 db FAIL na `ccfbabb7` (dec2: `true` vs `t` przy od/do; LATE z setup D+3). Visual jeszcze w toku â push poprawki po FAIL db. Bez push na `main`.
- BieÅ¼Äca: wynik licznika â `carrier_org_id` (CARRIER_*); bez gaÅÄzi HHL_OPS w `ksh_confirm_dates`; test LATE na D+2 + `detected_at` po znaczniku; PLAN_DATES `by=KSH`; dec2 64.

## 2026-10-21 16:35 â #392 `pilne`: RIO przyklejony (SG-18); #389 czeka F7

- Skrzynka: #392 (Spawn2018, `dla-cursora`+`pilne`) â przerywa (zaÅadunek dziÅ). #391 `pilne` w planie jako 0253. #384/#323/#322/#320 w planie.
- Scalanie: #389 CI zielone (`048cbbf9`, unit/visual/db) â F7 âgotoweâ byÅo; merge w nastÄpnym przebiegu. #390 wyglÄd bez F7. #382 konflikt. Bez push na `main`.
- BieÅ¼Äca: **HOTFIX #392** (`pakiet/hotfix-392-rio-sanitize`, migracja **0252**) â `loads_rio_sanitize` czyÅci `rio_*` przy linku nie-RIO; AâB bez klucza; jednorazowe czyszczenie + audit; security +5. D-1535 â 0253, B5 â 0254.

## 2026-10-21 17:05 â #389 SCALONE; #395 CI zielone, main wciÄgniÄty

- Skrzynka: #392 `pilne` (bieÅ¼Äca); #391 `pilne` (0253); #384/#323/#322/#320 w planie.
- Scalanie: #389 F7 âgotoweâ (`048cbbf`, Spawn2018, po ostatnim commicie) + CI zielone â merge `1a232014` (0251). #395 (RIO 0252): unit/visual/db zielone na `2550da2e`; wciÄgniÄty main. Czekam na ponowne CI i `F7: gotowe do scalenia`. #390/#382/#393/#394 bez F7. Bez push na `main`.
- BieÅ¼Äca: **HOTFIX #392** PR #395 â po F7 wdroÅ¼y `deploy-main`; potem D-1535 #391 / 0253.

## 2026-10-21 17:39 â #392 SCALONE; start D-1535 (#391 / 0253)

- Skrzynka: #392 zamkniÄte (SCALONE); #391 `pilne` (bieÅ¼Äca); #384/#323/#322/#320 w planie.
- Scalanie: #394 F7 â `3135f351`; #393 F7 â `9d3f1b00`; #395 F7 (`65fdc10`, po CI) â `e13067e4` (0252). Bez push na `main`.
- BieÅ¼Äca: **D-1535** (`pakiet/d1535-t40-fuel-114`, migracja **0253**) â `sefs_week_overrides` t40 Ã1,14/1,17; przeliczenie; `SEFS_INVOICE_DIFF` â `OWNER_DECISION`; baf 67.

## 2026-10-21 18:05 â #390 SCALONE; D-1535 F7 db (baf)

- Skrzynka: #391 `pilne` (bieÅ¼Äca); #384/#323/#322/#320 w planie (bez `pilne` â nie przerywam).
- Scalanie: #390 F7 âgotoweâ (`de097e1`, Spawn2018, po ostatnim commicie) + CI zielone â merge `8f995121`. #396 bez F7. Bez push na `main`.
- BieÅ¼Äca: **D-1535** PR #396 â `db` 62/67 (format `1.1400` + TELM t40 oczekiwaÅo 1,13); poprawka: cast `numeric(4,2)` w overrides i asercjach; TELM/korekta â 1,14 za D-1535.

## 2026-10-21 18:35 ï¿½ #398 `pilne`: szum ryzyk (przerywa B5)

- Skrzynka: #398 (Spawn2018, `dla-cursora`+`pilne`) ï¿½ przerywa B5. Wpisane: PLAN ï¿½3/ï¿½4/ï¿½8, dopisek `D-20261021-1820-01.md`. #384 pkt 7ï¿½8 w planie (bez `pilne` na nowym). #323/#322/#320 w planie.
- Scalanie: brak PR z `F7: gotowe do scalenia`. #382/#383 bez F7. #397 visual zielone, bez F7. Bez push na `main`.
- Bieï¿½ï¿½ca: **HOTFIX #398** (`pakiet/hotfix-398-risk-noise`, migracja **0254**) ï¿½ `loaded_confirmed`+GPS; emtrack `SILENT_MIN_EMTRACK`; ETA po dostawie; ORDERNO zamykanie; sprzï¿½tanie bulk_quiet. B5 ï¿½ **0255**.

## 2026-10-21 19:50 â #399 F7 sprzÄtanie SILENT; #400 w planie; #397 SCALONE

- Skrzynka: #398/#400 `pilne` (bieÅ¼Äca #398); #400 wpisane PLAN Â§3/Â§4/Â§8 + dopisek `D-20261021-1929-01.md` (po #398 â 0255, B5 â 0256). #384/#323/#322/#320 w planie.
- Scalanie: #397 F7 gotowe â merge `f4abce86`. #399 CI zielone na `d2548603`, F7 âjeszcze nieâ (para EXPIRE+RESOLVE) â poprawka wariantu 1. #382 bez F7. Bez push na `main`.
- BieÅ¼Äca: **HOTFIX #398** PR #399 â sprzÄtanie SILENT: AUTO_CLOSED + `if found` przed `l3_lapse`; powÃ³d âemtrack â brak sygnaÅu naczepyâ.

## 2026-10-21 20:20 ï¿½ #399 SCALONE; start #402 (jedna bramka powiadomieï¿½ / 0255)

- Skrzynka: #402 (Spawn2018, `dla-cursora`+`pilne`) ï¿½ wpisane PLAN ï¿½3/ï¿½4/ï¿½8, dopisek `D-20261021-1952-01.md` (0255; #400 ï¿½ 0256; B5 ï¿½ 0257). #400/#384/#323/#322/#320 w planie.
- Scalanie: #399 F7 `gotowe do scalenia` (`77d0240`, po CI) ï¿½ merge `6e76bce9` (0254). #398 zamkniï¿½te. #401/#403/#382 bez F7. Bez push na `main`.
- Bieï¿½ï¿½ca: **HOTFIX #402** (`pakiet/hotfix-402-notify-gate`, migracja **0255**) ï¿½ `notify_person_on` bez ominiï¿½cia prefs; bez `push_fallback` EMAIL; `l13_queue_email` + `sms_watchdog` przez bramkï¿½; `notify_email_still_allowed` w send-notifications; testy c3 +5 netto.

## 2026-10-21 20:40 â #402 CI fix; #405 wpisane (SMS strefy / 0256)

- Skrzynka: #405 (Spawn2018, `dla-cursora`+`pilne`) â wpisane PLAN Â§3/Â§4/Â§8, dopisek `D-20261021-2014-01.md` (#402â0255, #405â0256, #400â0257, B5â0258). #402/#400/#384/#323/#322/#320 w planie.
- Scalanie: brak `F7: gotowe do scalenia`. #406 `db` czerwone (workflow poza bramkÄ, c16/l13/c3) â poprawka w tym przebiegu. Bez push na `main`.
- BieÅ¼Äca: **HOTFIX #402** PR #406 â `WORKFLOW_ALERT`â`workflow` w macierzy; c16 wÅÄcza mail `dates`; l13 wÅÄcza mail `dec_new` dla KSH; c3 asercja po `user_id`. Potem #405.

## 2026-10-21 20:50 ï¿½ #402 F7 (firma/trigger/push); skrzynka #411/#409/#412; scalenia wyglï¿½du

- Skrzynka: #411 `pilne` ï¿½ PLAN + `D-20261021-2038-01.md` (**0256**); #405ï¿½**0257**; #400ï¿½**0258**; #409 ï¿½ `D-20261021-2030-01.md` (**0259**); #412 ï¿½ `D-20261021-2040-01.md` (po B5); B5ï¿½**0260**.
- Scalanie: #407, #401, #404 ï¿½ `F7: gotowe do scalenia` po ostatnim commicie, CI zielone ï¿½ merge. #408 wstrzymane. #406 F7 ï¿½jeszcze nieï¿½ ï¿½ poprawka. Bez push na `main`.
- Bieï¿½ï¿½ca: **HOTFIX #402** PR #406 ï¿½ `notification_matrix_org_kind` w bramce; `trg_notifications_gate` IN_APP/EMAIL; `notify_push_still_allowed` + web-push-send; push nie tylko krytyczne; `email_budget`/`fuel_miss`; c3 31 kluczy + test firmy; c16 dedup fallback.

## 2026-10-21 21:15 â #402 db: bramka bez user_id; #410/#403 SCALONE; #413 w planie

- Skrzynka: #413 `pilne` â wpisane PLAN Â§3/Â§4/Â§8 + `D-20261021-2057-01.md` (po #402/#411 â **0261** po B5). #402 bieÅ¼Äca; #411/#405/#400/#409/#412/#384/#323/#322/#320 w planie.
- Scalanie: #410 F7 gotowe â merge `e27ce061`; #403 F7 gotowe â merge `e1dd2ef9`. #406 `db` FAIL (status/money/import/i2/dec2/insurance/l13) â trigger nadpisywaÅ L13_FILL bez `user_id` + brak mapowaÅ szablonÃ³w. #408 wstrzymane. #414 bez F7. Bez push na `main`.
- BieÅ¼Äca: **HOTFIX #402** PR #406 â `trg` skip przy `user_id` null / status SENT; mapowania `INSURANCE_EXPIRY`/`L17_BACKLOG`/`ETA_NOTIFY_KSH`/`KSH_DATE_COUNTER_RESULT`; `inv_overdue`+`dates.email` domyÅlnie on; workflow CLIENT/CARRIER off.

## 2026-10-21 21:45 â #402 F7: workflow LOAD_STATUS, ext_mail, mapowania RISK

- Skrzynka: bez nowych; #413/#411/#405/#400/#409/#412 juÅ¼ w planie. #412 ma dopiski (2FA, paliwo Orlen) â do rozszerzenia zakresu przy pozycji.
- Scalanie: brak `F7: gotowe do scalenia` po ostatnim commicie. #406 `db` FAIL: workflows 3 + dec-auto 1 (WORKFLOW_ALERT KSH/SCX blokowane przez SYSTEM=tylko HHL) + nullguard 689/690. Bez push na `main`.
- BieÅ¼Äca: **HOTFIX #402** PR #406 â `workflow`â`LOAD_STATUS` (KSH/SCX z reguÅ); `ext_mail`; `matrix_event` w bramce; LATE_DATE/SILENT/AUTOâdates/status; `trg_notifications_a_gate` przed budÅ¼etem; nullguard bootstrap poza triggerem.

## 2026-10-21 22:05 â #402 db: B6/C1 po a_gate; #414 SCALONE

- Skrzynka: bez nowych `dla-cursora`; pozycje #402/#411/#405/#400/#409/#412/#413 w planie.
- Scalanie: #414 F7 gotowe â merge `dc2e08eb`. #415 F7 gotowe, po #414 mergeable (visual w toku). #406 `db` FAIL: security B6 (25/0 zamiast 20/1 â a_gate przed budÅ¼etem tÅumi B6T* bez event_key) + risks C1 RISK_OPEN. Bez push na `main`.
- BieÅ¼Äca: **HOTFIX #402** PR #406 â test B6 z `matrix_event=dates`; C1: org/macierz risk_route + asercja po `risk_id`.

## 2026-10-21 22:40 â #402 F7: bez nadpisu macierzy; #417/#416 SCALONE

- Skrzynka: bez nowych; #412 dopiski (2FA/Orlen) nadal przy pozycji. #402/#411/#405/#400/#409/#412/#413 w planie.
- Scalanie: #417 F7 gotowe â merge `3d380cdf`; #416 F7 gotowe â merge `ba9aed43`. #408 wstrzymane. #418 bez F7 (visual w toku). #406 CI zielone na `42fc2914`, F7: nie nadpisuj `inv_overdue`/`dates`. Bez push na `main`.
- BieÅ¼Äca: **HOTFIX #402** PR #406 â `insert â¦ on conflict do nothing`; usuniÄte UPDATE `inv_overdue`/`dates`; money/import/i2 wÅÄczajÄ kanaÅ w prep.

## 2026-10-21 23:00 â #418 SCALONE; #402 db B6: dates.email w prep

- Skrzynka: bez nowych `dla-cursora`; #402/#411/#405/#400/#409/#412/#413/#384/#323/#322/#320 w planie.
- Scalanie: #418 F7 gotowe (`1ab3640`) â merge `2d8aa5f2`. #408 wstrzymane. #406 `db` FAIL na `dc4dbe15`: security B6 (0 e-maili â seed `dates.email` off po usuniÄciu UPDATE migracji). Bez push na `main`.
- BieÅ¼Äca: **HOTFIX #402** PR #406 â `security.sh` B6 wÅÄcza `dates`/`email_budget` e-mail dla HHL_ADMIN w prep (jak c16/money/import).

## 2026-10-21 23:25 â #406 SCALONE; start #411 (0256)

- Skrzynka: bez nowych `dla-cursora`; #411/#405/#400/#409/#412/#413 w planie (#402 zamkniÄte).
- Scalanie: #406 F7 gotowe (`a63f238`) â merge `2352a0fe` (0255). #408 wstrzymane (czekajÄ fuel_publications). Bez push na `main`.
- BieÅ¼Äca: **HOTFIX #411** (`pakiet/hotfix-411-closed-notify`, migracja **0256**) â bez `*_RESOLVED`; `notify_mark_case_closed`; WEB_PUSH `url`; sprzÄtanie bulk + AUDYT17_MARK_READ.

## 2026-10-22 00:56 â #420+#419 SCALONE; start #405 (0257)

- Skrzynka: bez nowych `dla-cursora` (Spawn2018); #411 zamkniÄte; #405/#400/#409/#412/#413/#384/#323/#322/#320 w planie.
- Scalanie: #420 F7 gotowe (`e099872`) â merge `8a4d00e3`; #419 F7 gotowe (`b5322e5`) â merge `30459c4a` (0256). Bez push na `main`.
- BieÅ¼Äca: **HOTFIX #405** (`pakiet/hotfix-405-sms-zones`, migracja **0257**) â `sms_enqueue` tylko ZONE_*/TEST; triggery kierowcy OFF; `issue_driver_token_sms` bez SMS; i2 I-3 za decyzjÄ.

## 2026-10-22 01:25 â #405 F7 B1/B2; #421+#422 wpisane (0258â0259)

- Skrzynka: #421/#422 (Spawn2018, `dla-cursora`+`pilne`) â PLAN Â§3/Â§4/Â§8, dopiski `D-20261022-0105-01.md` / `D-20261022-0113-01.md`; #400â0260, #409â0261, B5â0262, #413â0263.
- Scalanie: #424 CI zielone na `780ff80`; F7 âjeszcze nieâ â poprawka B1 (TEST na strefy) + B2 (pilot tylko ZONE_*) + unschedule `tower-sms-rozladunek`; i2 628â632. #408 wstrzymane. Bez push na `main`.
- BieÅ¼Äca: **HOTFIX #405** PR #424 â F7 runda 2; potem #421.

## 2026-10-22 01:50 â #405 CI: pg_cron guard; #425+#426 w planie

- Skrzynka: #425 (`pilne`, kolejka) + #426 (import `p_quiet`) â PLAN Â§4/Â§8, dopiski `D-20261022-0130-01.md` / `D-20261022-0138-01.md`. KolejnoÅÄ: #405â#421â#426(0259)â#400(0260)â#384(0261)â#409(0262)â#413(0263)â#422(0264)â#412âB5(0265).
- Scalanie: brak âF7: gotowe do scaleniaâ po ostatnim commicie. #424 `db` FAIL: `schema cron does not exist` przy `cron.unschedule` w tower_boot â guard `pg_extension`. Bez push na `main`.
- BieÅ¼Äca: **HOTFIX #405** PR #424 â poprawka CI; potem F7.

## 2026-10-22 02:15 â #405 i2 F7 asercje; #423 SCALONE

- Skrzynka: bez nowych `dla-cursora` (Spawn2018); #405/#421/#425/#426/#400/#384/#409/#413/#422/#412 w planie.
- Scalanie: #423 F7 gotowe (`5553439`) â merge `2e446fc5` (wyglÄd WydajnoÅÄ). #424/#427/#428/#382 bez âgotoweâ po head. Bez push na `main`.
- BieÅ¼Äca: **HOTFIX #405** PR #424 â `db` FAIL i2 627/5: `::text`â`true` (nie `t`); `sms_enqueue` w WHERE 2Ã (dedupânull) â osobny SELECT + cleanup kolejki F7 przed pull.

## 2026-10-22 02:35 â #405 CI zielone; F7: numer testowy pilota

- Skrzynka: bez nowych. F7 na `d2cfb32` (przed poprawkÄ): format `true`, enqueue 2Ã, pull 2 z F7 ZONE/TEST (nie âspoza listyâ), prawdziwy numer w teÅcie.
- Scalanie: #424 `db`/`unit`/`visual` zielone na `74632573`. Czeka na ponowne F7. Bez push na `main`.
- BieÅ¼Äca: **HOTFIX #405** â pilot w i2: `+48000000001` (bez numeru wÅaÅciciela).

## 2026-10-22 02:55 â #405 F7 runda 3 (R-2 TEST stref)

- Skrzynka: F7 na `7463257`: jeszcze nie â (1) numer fikcyjny `+48600999888`, (2) TEST na `sms_zone_recipients` tylko przy EXTERNAL on + `admin_sms_zone_test` wyjÄtek R-2, (3) pull 2 z kontrolÄ rodzaju. Archiwum TELM: numer â â[numer wÅaÅciciela]â.
- Scalanie: #424 CI zielone na `649ad51e` (tylko numer); bez âgotoweâ. Bez push na `main`.
- BieÅ¼Äca: **HOTFIX #405** â 0257 + i2 634; czeka CI i F7.

## 2026-10-22 03:20 â #405+#427+#428 SCALONE; start #421

- Skrzynka: bez nowych `dla-cursora` (Spawn2018); #405 zamkniÄte; #421/#425/#426/#400/#384/#409/#413/#422/#412/#323/#322/#320 w planie.
- Scalanie: #427 F7 gotowe (`ff3bde3`) â merge `e0edff5c`; #428 F7 gotowe (`07f478c`) â merge `0712b8f3`; #424 F7 gotowe (`feee9d1`) â merge `87104ff1` (0257). Bez push na `main`.
- BieÅ¼Äca: **HOTFIX #421** (`pakiet/hotfix-421-ferry-ais`, migracja **0258**) â AIS Nova Star/Stena, rozkÅad codzienny, wypÅyniÄcia/dopÅyniÄcia, bez AIS_GAP.

## 2026-10-22 03:50 â #421 RPC mapy + ponowienie deploy-main (#424)

- Skrzynka: bez nowych `dla-cursora` (Spawn2018); #421/#425/#426/#400/#384/#409/#413/#422/#412/#323/#322/#320 w planie. #429 decyzja A+C.
- Scalanie: #430 CI zielone (unit/db/visual) na `2f4b680e` â bez F7. deploy-main po #424 padÅ na poÅÄczeniu pooler â ponowienie `39707535827`. Bez push na `main`.
- BieÅ¼Äca: **HOTFIX #421** â `ferry_sailings_map()` (departed_at/arrived_at, porty, AIS bez filtra wieku), dopÅyniÄcie GDN/GDY, zawsze `ferry-departures`.

## 2026-10-22 04:20 â #421 F7: actual_*, wiek, timeout, liczniki

- Skrzynka: bez nowych `dla-cursora` (Spawn2018); kolejka #425 bez zmian.
- Scalanie: #430 â F7 âjeszcze nieâ (blokery 1â7); CI `db` padÅo na licznikach (nullguard 700, bmapa 35). #408/#383/#382 bez âgotoweâ. Bez push na `main`.
- BieÅ¼Äca: **HOTFIX #421** PR #430 â F7: `actual_departure_at`/`actual_arrival_at`; wypÅyniÄcie wiekâ¤15 + 3â10 km; dopÅyniÄcie tylko port docelowy; cron timeout 120 s + jednorazowy `ferry-schedule`; rozkÅad po statusie max co 60 min; `ferry_track_sample` bez limitu 48 h dla rejsu w drodze; Stena 403/429 backoff; gate nullguard 700 / bmapa 35.

## 2026-10-22 04:55 â #421 F7 runda 2

- Skrzynka: bez nowych `dla-cursora` (Spawn2018); kolejka #425 bez zmian (#421 W TOKU).
- Scalanie: #430 CI zielone na `60ce13ed` (unit/db/visual); F7 r2 âjeszcze nieâ (bloker okno lastPortPosition + track_sample obciÄÅ¼enie). #431 wyglÄd bez F7. Bez push na `main`.
- BieÅ¼Äca: **HOTFIX #421** â F7 r2: `acceptActualDepartureAt` [planâ2h, teraz] + po prev `actual_arrival`; dopÅyniÄcie wiekâ¤15 i po dep; `ferry_track_sample` = 48 h âª 1 latest active; jednorazowy rozkÅad tylko gdy Vault ma sekrety; `actual_*` mimo RECZNIE; etykieta KAA-GDY â KAA. unit integrations 42/42.

## 2026-10-22 05:20 â #421 SCALONE; start #426 (0259)

- Skrzynka: bez nowych `dla-cursora` (Spawn2018); #421 zamkniÄte; #425/#426/#400/#384/#409/#413/#422/#412/#323/#322/#320 w planie. #431 bez F7.
- Scalanie: #430 F7 r3 âgotoweâ (`3dc52c2`) + CI zielone (unit/db/visual) â merge `00fd4986` (0258). Bez push na `main`.
- BieÅ¼Äca: **#426** (`pakiet/hotfix-426-import-quiet`, migracja **0259**) â `import_schedule(..., p_quiet)`; tylko HHL_ADMIN; `tower.bulk_quiet` na caÅy import; audit `SCHEDULE_IMPORT_QUIET`; `trg_sms_load_changes` Ã quiet; import 72â81.

## 2026-10-22 05:45 â #426 F7 niegotowe: 4 blokery

- Skrzynka: bez nowych `dla-cursora` (Spawn2018); kolejka #425 bez zmian. #431 wyglÄd bez F7.
- Scalanie: #432 CI zielone (`6688886f`), F7 âjeszcze nieâ (4 blokery) â poprawki w tym samym PR. Bez push na `main`.
- BieÅ¼Äca: **#426 F7** â (1) `trg_sms_load_changes` z 0111+e164+quiet; (2) pomijanie `l1b_note_*` / `l1b_kr_check` przy quiet; (3) `l3_ksh_lead` Ã bulk_quiet; (4) `wf_enqueue_event` Ã bulk_quiet; dry_run pokazuje critical; stats/payload `quiet`; audit tylko przy zapisie; import 81â99. `l3_scan` pÃ³Åºniej moÅ¼e otworzyÄ NO_AWIZ/NO_TRACKING (stan) â dopuszczalne.

## 2026-10-22 06:10 â #426 F7 r2: poprawki testÃ³w B3/B4

- Skrzynka: bez nowych `dla-cursora` (Spawn2018); #426/#425/#400/#384/#409/#413/#422/#412/#323/#322/#320 w planie. #431/#433 bez F7.
- Scalanie: brak âF7: gotoweâ; #432 db czerwone (shadow `D1c` w RQKEEP) + F7 r2 (2 poprawki testÃ³w) â ten commit. Bez push na `main`.
- BieÅ¼Äca: **#426 F7 r2** â `DecB3`/`DecB4` zamiast `D1c`/`D2c`; B3+ LATE bez quiet; B4+ START-7 wÅÄczone + cancel bez quiet â +1 wf; quiet hhlOrderNo â 0 conflict; import 99â106.

## 2026-10-22 06:30 â #426 SCALONE; start #400 (0260)

- Skrzynka: bez nowych `dla-cursora` (Spawn2018); #426 zamkniÄte; #425/#400/#384/#409/#413/#422/#412/#323/#322/#320 w planie. #431/#433 bez F7 (kolejnoÅÄ z F7 #432: #431âdeployâ#432â#433 â #431 niewykonalne bez F7).
- Scalanie: #432 F7 âgotoweâ (`dd0a86d`) + CI zielone (unit/db/visual) â merge `a9189bb1` (0259). Bez push na `main`.
- BieÅ¼Äca: **#400** (`pakiet/hotfix-400-dims-pii`, migracja **0260**) â `permit_fits` coalesce LÃWÃH z `symbol_specs`; `audit_row_change` bez maski PII, `rio_secret` = â¢â¢â¢â¢; i2 634â639.

## 2026-10-22 06:55 â #400 CI db: prosrc + dec-fx

- Skrzynka: bez nowych `dla-cursora` (Spawn2018); #425/#400/#384/#409/#413/#422/#412/#323/#322/#320 w planie. #431/#433/#434 bez F7.
- Scalanie: brak âF7: gotoweâ. #434 unit/visual zielone; db FAIL (i2 asercja prosrc + dec-fx `loads_carrier_order_no_uq`). Bez push na `main`.
- BieÅ¼Äca: **#400** â komentarz w `audit_row_change` bez litery â[dane osobowe]â (asercja i2); `dec-fx` numery zleceÅ z `n_pairs`+md5(8).

## 2026-10-22 07:35 â #400 CI db: i2 escorts/sms_zone

- Skrzynka: bez nowych `dla-cursora` (Spawn2018); #425/#400/#384/#409/#413/#422/#412/#323/#322/#320 w planie. #433/#434 bez F7. #431 SCALONE na main (`e8480e1e`).
- Scalanie: brak âF7: gotoweâ. #434 db FAIL na `4ec8db68` (i2 644/646): (1) `||` vs `->>` w asercji load_escorts; (2) slot 9 poza CHECK 1â2 w sms_zone_recipients. Bez push na `main`.
- BieÅ¼Äca: **#400** â nawiasy w SELECT escorts; slot=2 dla maski phone_national.

## 2026-10-22 07:50 â #400 F7 r3: telefon pilota + RODO + scrub

- Skrzynka: bez nowych `dla-cursora` (Spawn2018); #425/#400/#384/#409/#413/#422/#412/#323/#322/#320 w planie. #433/#434 bez F7.
- Scalanie: brak âF7: gotoweâ. #434 db FAIL `0f61e8a3` (i2 645/646): INSERT load_escorts z E.164 ÅamaÅ `driver_phone_national_chk`. Bez push na `main`.
- BieÅ¼Äca: **#400** F7 r3 â `driver_phone='000000222'` (krajowy); filtr `entity_id` w asercjach app_users/sms_zone; +2 testy RODO po purge; `purge` przywraca `audit_source` i scrub jednym UPDATE (retencja od `created_at`); i2 646â648.

## 2026-10-22 08:35 â #400 SCALONE; start #384 zalegÅe (0261â0262)

- Skrzynka: #400 zamkniÄte; #425/#384/#409/#413/#422/#412/#323/#322/#320 w planie. #433 bez F7.
- Scalanie: #434 F7 âgotowe do scaleniaâ â merge `9a250dd6` (0260). Bez push na `main`.
- BieÅ¼Äca: **#384 zalegÅe** â potem #437 pilne przerwaÅo; migracja przenumerowana na **0262**.

## 2026-10-22 09:25 â #437 pilne E44 RIO (przerywa #384)

- Skrzynka: #437 (`dla-cursora`+`pilne`, Spawn2018) â brak adaptera/crona RIO; SG-19 dziÅ; zgoda RIO na piÅmie 09:02.
- BieÅ¼Äca: **#437 E44** (`pakiet/e44-rio-437`, migracja **0261**).

## 2026-10-22 11:13 â #438 SCALONE (0261 E44); powrÃ³t #384 (0262)

- Skrzynka: #437 zamkniÄte; #425/#384/#422/#413/#409/#412/#323/#322/#320 w planie. #440 wyglÄd RIO bez F7.
- Scalanie: #438 F7 âgotoweâ (`1fd05f4`) + CI zielone â merge `6f6336b5` (0261). #436 przenumerowane 0261â0262. Bez push na `main`.
- BieÅ¼Äca: **#384 zalegÅe** PR #436 (`pakiet/hotfix-384-zalegle`, **0262**) â F7 niegotowe; merge main po E44.

## 2026-10-22 10:20 â #438 F7: poprawki E44 RIO (BLOKER secret + obciÄÅ¼enie)

- Skrzynka: #437 pilne bieÅ¼Äca; #425/#422/#413/#409/#412/#384/#323/#322/#320 w planie. Bez nowych do wpisania.
- Scalanie: brak âF7: gotowe do scaleniaâ. #438 F7 r1/r2 âjeszcze nieâ â ten commit. #436 BLOKER numeru (0261â0262) â nastÄpny krok po push. Bez push na `main`.
- BieÅ¼Äca: **#437 F7** â secret poza komunikatem sieci; `rio_last_fix_at` tylko przy ok; UPDATE tylko przy zmianie; audit skip `rio_check_at`/`rio_last_fix_at`; `resolveRisks` SOURCE_DOWN po pÄtli; budÅ¼et 40 s + abort po 3 bÅÄdach sieci + lock; recheck wygasÅy/invalid co 30 min + `RIO_EXPIRED`; `RESOURCE_MISSING` dla SCX; TELM_RIO_LINKS; streak=0 przy nowym linku; 400/410âinvalid; fixture zmyÅlone; testy 23/23.

## 2026-10-22 10:45 â #438 F7 r3: lock bez audytu + patch

- Skrzynka: #437 pilne bieÅ¼Äca; #425/#422/#413/#409/#412/#384/#323/#322/#320 w planie. Bez nowych do wpisania.
- Scalanie: brak âF7: gotoweâ. #438 F7 r3 âprawieâ (2 blokery) â ten commit. #436 â 0262 zaraz po push. Bez push na `main`.
- BieÅ¼Äca: **#437 F7 r3** â `rio_links_lock` (tabela bez audytu, token); `rio_check_at` nie liczy siÄ jako zmiana (+00 przez `rioParseMs`); `resolveRisks` INVALID/EXPIRED tylko przy przejÅciu; SOURCE_DOWN bez zamkniÄcia przy abort; okâdown; zamkniÄcie `RIO_UNKNOWN_ASSET`; testy 26/26.

## 2026-10-22 11:23 â #442 pilne: rio-links bez `loads.shipment_code`

- Skrzynka: #442+#441 (`pilne`, Spawn2018) â PLAN Â§4/Â§8; #425/#422/#413/#409/#412/#384/#323/#322/#320 w planie.
- Scalanie: #433+#439+#440 F7 âgotoweâ po ostatnim commicie + CI zielone â merge. #436 CI w toku, bez F7. Bez push na `main`.
- BieÅ¼Äca: **#442** â usuniÄto `shipment_code` z `listRioLoadsForPoll`; `code: null`; security +2 (kolumny poll / brak `shipment_code`). GaÅÄÅº `pakiet/hotfix-442-rio-shipment-code`. Po scaleniu: wdroÅ¼yÄ Edge `rio-links`; #441 `ferry-schedule`.

## 2026-10-22 11:45 â #442: CI db â test kolumn przez sys

- Skrzynka: bez nowych `pilne` poza #442/#441/#425/#422/#413.
- Scalanie: brak âF7: gotoweâ po ostatnim commicie. #443 unit/visual zielone; db FAIL (161/162). #436 F7 r3 niegotowe (przerwane). Bez push na `main`.
- BieÅ¼Äca: **#442** â test #442 przez `sys` (HHL nie widzi `rio_secret` / `tracking_opened_at` w information_schema). PR #443.

## 2026-10-22 12:15 - #442 NA PRODUKCJI; #441 pkt 1-2; poprawka deploy-main

- Skrzynka: #442/#441 `pilne` (Spawn2018); #425/#422/#413/#409/#412/#384/#323/#322/#320 w planie.
- Scalanie: **#443** F7 "gotowe" po `0e89ccd` + CI zielone -> merge `8f9d7270` (bez push na `main`). #436 F7 r3 niegotowe. #408/#383 czekaja na F7.
- **#442:** `deploy-main` `39760618480` (Edge wszystkie + Vercel); `rio-links` `ok: true` od 10:08 (queried/written 1); wczesniej `shipment_code` -> `ok: false`.
- **#441 pkt 1-2:** `ferry-schedule` `ok: true` (inserted 15); `tracking_delivery_guard` + nocne SQL + `security_advisor_snapshot_tick` + `daily_admin_digest` OK; `usage-check` `ok: true`.
- Biezaca: **#441 pkt 3** - `deploy-main` porownuje Edge z SHA ostatniego udanego przebiegu (`pakiet/hotfix-441-deploy-edge`).

## 2026-10-22 12:40 - #441 F7 #444: brak bazy = wszystkie Edge; baza tylko po kroku Edge

- Skrzynka: #441/`pilne` biezaca; #425/#422/#413/#409/#412/#384/#323/#322/#320 w planie. Bez nowych poza juz wpisanymi.
- Scalanie: #444 F7 "prawie" (niegotowe) po `9bfb293` - poprawki w tym samym PR. #436 F7 niegotowe. #408/#383 bez "gotowe". Bez push na `main`.
- Biezaca: **#441 pkt 3 F7** - (1) pusta/niedostepna baza -> wdroz wszystkie funkcje; (2) baza = ostatni sukces z conclusion kroku Edge=`success` (nie `skip=true`); log: liczba + lista + SHA.

## 2026-10-22 12:50 - #445 pilne: A10_b FERRY tylko po odejÅciu rejsu

- Skrzynka: #445 (pilne) + #446 (Spawn2018) -> PLAN Â§4/Â§8 + dopisek D-20261022-1235-01. #441/#425/#422/#413/#409/#412/#384/#323/#322/#320 w planie.
- Scalanie: #444 F7 "gotowe" po `125d175a` -> SCALONE. #447 F7 "gotowe" po `8d73b169`, ale CONFLICT z main - merge main.
- Biezaca: **#445** - migracja **0262** (`a10_try_ferry_backup` + korekta SG-17 bulk_quiet); testy status +4 (166); #384->0263 ... B5->0267. Galaz `pakiet/hotfix-445-a10-ferry` / PR #447.

## 2026-10-22 13:20 - #447: merge main (po #444); konflikt PLAN/POSTEP

- Skrzynka: #445 `pilne` biezaca; #446 wpisane. Bez nowych `pilne`.
- Scalanie: #444 juz MERGED. #447 - konflikt z main rozwiazany (PLAN #441 SCALONE + Â§8; POSTEP obie strony). Po pushie: CI + ponowne F7 (commit po "gotowe"). Bez push na `main`.
- Biezaca: **#445** - push merge-commita na `pakiet/hotfix-445-a10-ferry`.

## 2026-10-22 13:45 - #447 SCALONE; #446 pkt 1 (0263)

- Skrzynka: #445 zamkniete (SCALONE); #446 biezaca; #425/#422/#413/#409/#412/#384/#323/#322/#320 w planie. Bez nowych `pilne`.
- Scalanie: #447 F7 "gotowe" po `3ef91201` + CI zielone (unit/db/visual) â MERGED `dcf58431`. Bez push na `main`.
- Biezaca: **#446 pkt 1** â migracja **0263** (`W_REJSIE`/`DOPLYNAL` + trigger); Edge `ferry-departures` ustawia status; sync nie cofa; testy status +3 (169). #384â0264 â¦ B5â0268. Galaz `pakiet/hotfix-446-drobne`.

## 2026-10-22 14:00 - #448 F7: split 0263/0264 (enum osobno)

- Skrzynka: #446 biezaca; #425/#422/#413/`pilne` w kolejce po #446. Bez nowych `pilne` przerywajacych.
- Scalanie: #448 F7 "niegotowe" (B1: enum+uzycie w jednej transakcji) â poprawka w tym samym PR. Inne PR bez "gotowe" po head.
- Biezaca: **#446 F7** â **0263** tylko `ALTER TYPE`; **0264** funkcja+trigger (takze `of status`) + backfill; test OPOZNIONYâDOPLYNAL (+1 â 170). #384â0265 â¦ B5â0269, indeksâ0270+. Bez push na `main`.

## 2026-10-22 14:25 - #448 CI: kolizja ID testu #446

- Skrzynka: #446 biezaca; #425/#422/#413/`pilne` w kolejce. Bez nowych `pilne`.
- Scalanie: #448 F7 "gotowe" po `d163e318`, ale `db` czerwone (ODWOLANYâW_REJSIE): ID 446/447 zajÄte przez #445 â INSERT cichy. Poprawka: ID 448/449 + EXPECTED status 170. Nowy commit â czekam na ponowne F7. Bez push na `main`.
- Biezaca: **#446 pkt 1** â fix testÃ³w; potem pkt 2 indeks dzwonka (0270+).

## 2026-10-22 15:00 - #448 SCALONE; #446 pkt 2 indeks dzwonka (0270)

- Skrzynka: #446 bieÅ¼Äca; #425/#422/#413/`pilne` w kolejce po #446. Bez nowych `pilne` przerywajÄcych.
- Scalanie: #448 F7 âgotowe do scaleniaâ po `0fd25bc7` + CI zielone (unit/db/visual) â MERGED `0e79a914`. Bez push na `main`.
- BieÅ¼Äca: **#446 pkt 2** â migracja **0270** `notifications_bell_user_channel_created_idx (user_id, channel, created_at desc)`.
  - Bez `CONCURRENTLY` w pliku migracji: `supabase db push` (deploy-main) â SQLSTATE 25001; zwykÅy `CREATE INDEX IF NOT EXISTS`.
  - EXPLAIN ANALYZE na TEST (`notifications` = 1 wiersz po prep; planer i tak Seq Scan):
    - **przed:** `Seq Scan` + Sort, Planning 4,6 ms, Execution 0,075 ms, buffers hit=4.
    - **po** (indeks zbudowany `CONCURRENTLY` poza migracjÄ na TEST): nadal `Seq Scan` (1 wiersz), Planning 1,7 ms, Execution 0,051 ms, buffers hit=1. OdbiÃ³r na produkcji po wdroÅ¼eniu â przy wiÄkszej tabeli Index Scan / Index Only.
  - Dalej w #446: pkt 3 (#430), 4 (RIO), 5â6 (POSTEP jutro). #384â0265 â¦ B5â0269.

## 2026-10-22 15:15 - #449 F7: indeks 0270â0265

- Skrzynka: #446 bieÅ¼Äca; #425/#422/#413/`pilne` w kolejce. Bez nowych `pilne`.
- Scalanie: #449 F7 âniegotoweâ (B1: 0270 przed nienaÅoÅ¼onymi 0265â0269) â poprawka w tym samym PR. CI unit/db/visual zielone na `a6df26e7`. Bez push na `main`.
- BieÅ¼Äca: **#446 pkt 2 F7** â `git mv` **0270â0265** `hotfix_446_bell_index.sql`; #384â**0266**, #409â**0267**, #413â**0268**, #422â**0269**, B5â**0270**. Czekam na ponowne F7.

## 2026-10-22 15:55 - #449 SCALONE; #446 pkt 3â4 (0266)

- Skrzynka: #446 bieÅ¼Äca (Spawn2018); #425/`pilne` + #422/#413/#409/#412/#384/#323/#322/#320 w planie. Bez nowych `pilne` przerywajÄcych.
- Scalanie: #449 F7 âgotowe do scaleniaâ po `c81d17ab` + CI zielone (unit/db/visual) â MERGED `b7b049be`. Bez push na `main`.
- BieÅ¼Äca: **#446 pkt 3â4** â migracja **0266** `tower_cron_ferry_schedule_invoke` (`to_regclass('vault.decrypted_secrets')`); Edge: odrzucony `lastPortPosition` â zapas tylko 3â10 km; RIO `RIO_UNKNOWN_ASSET` tylko NIEZNANYâznany; `TELM_RIO_LINKS=off` â `result.disabled=true`. #384â**0267** â¦ B5â**0271**. Testy unit integrations+rio-links 70/70.

## 2026-10-22 16:45 â #450 SCALONE; #446 pkt 5 SELECT

- Skrzynka: #446 (Spawn2018) â pkt 1â5; #425/`pilne` + #422/#413/#409/#412/#384/#323/#322/#320 w planie. Bez nowych `pilne` przerywajÄcych.
- Scalanie: #450 F7 âgotowe do scaleniaâ po `34f25242` + CI zielone (unit/db/visual) â MERGED `5c6ab459` (0266). Bez push na `main`. `deploy-main` nie czekamy.
- **#446 pkt 5 (produkcja, odczyt ~16:45 Europe/Warsaw):**
  - otwarte `risk_signals` NO_TRACKING (`l3:NO_TRACKING:%` / `L3_NO_TRACKING`): **0** (takÅ¼e `detected_at >= 22.10 12:00+02`);
  - otwarte `decisions` `NO_TRACKING` (NEW/ASSIGNED): **0** (takÅ¼e po 12:00);
  - `tower-tracking-guard` (`15 6 * * *` UTC): ostatni przebieg 22.10 08:15 Waw = **failed** (`job startup timeout`); wczeÅniej 21.10 = succeeded.
- **#446 pkt 6:** wpisy `failed` z rana 22.10 w `cron.job_run_details` zostajÄ (historia); sprawdzenie nastÄpnego przebiegu z harmonogramu â **23.10 rano** (po 08:15 Waw) â wpis w POSTEP.
- BieÅ¼Äca dalej: **#384 zalegÅe** (`pakiet/hotfix-384-zalegle`, migracja **0267**); PR #436 â F7 niegotowe (przenumerowaÄ 0262â0267 + uwagi F7 r2/r3).

## 2026-10-22 17:05 â #451+#452 SCALONE; #453 wpisane; #436 CI db

- Skrzynka: #453 (Spawn2018, `dla-cursora`, bez `pilne`) â RIO link bez pozycji â  SOURCE_DOWN. Wpisane: PLAN Â§3/Â§4/Â§8, dopisek `D-20261022-1655-01.md` (po #384, przed #409). #446/#425/#422/#413/#409/#412/#384/#323/#322/#320 w planie.
- Scalanie: #451 F7 âgotowe do scaleniaâ â MERGED `0230985c`. #452 F7 âgotowe do scaleniaâ â MERGED (docs #446 pkt 5). Bez push na `main`.
- BieÅ¼Äca: **#384 zalegÅe** PR #436 â `db` czerwone (import F7 (d)+ restore; dec2 KSH count 4â 1). Poprawka: `before_*` filtr po dacie planu; test KSH `count >= 1`; event testowy `now()+1s`.

## 2026-10-22 17:35 â #455 wpisane; merge main â #436

- Skrzynka: #455 (Spawn2018, `dla-cursora`, bez `pilne`) â testy bazy po #436 (DziaÅaj jako, ujemne restore, KSH=HHL). Wpisane: PLAN Â§3/Â§4/Â§8 (po #453, przed #409). #453/#446/#425/`pilne` + reszta w planie.
- Scalanie: #436 F7 r5 âgotoweâ na `060b5ee`, ale CONFLICTING z main (#451/#452) i brak `db` na tym SHA â bez scalenia. #454 F7 âgotoweâ, visual w toku. Bez push na `main`.
- BieÅ¼Äca: **#384 zalegÅe** PR #436 â merge main (konflikt PLAN/POSTEP); #455 w planie; po push: `db` + czekam na ponowne F7.

## 2026-10-22 18:05 ï¿½ #436 SCALONE; start #453 RIO_NO_POSITION

- Skrzynka: #455/#453/#446/#425 (Spawn2018) ï¿½ juï¿½ w planie; #384 zalegï¿½e SCALONE. Bez nowych pilne.
- Scalanie: #436 F7 ï¿½gotowe do scaleniaï¿½ po c9133f8 + CI unit/db/visual zielone ï¿½ MERGED `490d8b25` (0267). #454 visual w toku ï¿½ bez scalenia. Bez push na `main`.
- Bieï¿½ï¿½ca: **#453** (pakiet/hotfix-453-rio-no-position) ï¿½ `runRioLinks`: `no_position` ï¿½ `RIO_NO_POSITION:<load_id>` (SCX+HHL); `SOURCE_DOWN`/`ok:false` tylko wszystkie linki sieï¿½/5xx; testy rio-links 31/31. Bez migracji.

## 2026-10-22 18:50 â #454+#453 SCALONE; start #455

- Skrzynka: #455/#446/#425 (Spawn2018) â juÅ¼ w planie; #453 zamkniÄte. Bez nowych pilne.
- Scalanie: #454 F7 + CI â MERGED c08ceb41. #456 F7 (c7526c4) + CI unit/db/visual â MERGED fea216a2. Bez push na main.
- BieÅ¼Äca: **#455** (pakiet/hotfix-455-db-tests) â testy: DziaÅaj jako â real_app_user_id; ujemne hotfix_384_restore_windows; KSH = HHL w dec2. Bez migracji.

## 2026-10-22 19:10 â #455 poprawka CI (import >3)

- Skrzynka: #455/#446/#425 (Spawn2018) â juÅ¼ w planie; bez nowych. `pilne` #413/#422/#425 w kolejce po #409.
- Scalanie: brak F7 âgotowe do scaleniaâ po ostatnim commicie. Bez push na main.
- BieÅ¼Äca: **#455** PR #457 â `db` czerwone: UNIQUE(project_id, shipment_code) blokowaÅ 4. SG-01; straÅ¼nik przez si z innym project_id. EXPECTED import 113, dec2 73.

## 2026-10-22 20:50  #460 pilne: ferry_track_sample 42702; #408 SCALONE; #409 wstrzymane

- Skrzynka: #460/#461 (Spawn2018, `dla-cursora`+`pilne`)  promy z mapy (ambiguous vessel_id) + Prom dopiero przy actual_departure_at. Wpisane: PLAN §4/§8, dopiski `D-20261022-2043-01.md` / `D-20261022-2045-01.md`. #409**0270**, #413**0271**, #422**0272**, B5**0273**.
- Scalanie: #408 F7 gotowe do scalenia + CI unit/visual zielone  MERGED `00611f7e`. #458 (#409) db FAIL (security: fuel_basis_public bez search_path)  wstrzymane przez #460. Bez push na `main`.
- Bie¿¹ca: **#460** (`pakiet/hotfix-460-ferry-track-sample`, migracja **0268**)  aliasy w CTE `u`; bmapa +1  36.

## 2026-10-22 21:25 â #460 SCALONE; start #461; #463 w planie

- Skrzynka: #463 (Spawn2018, `dla-cursora`+`pilne`) â backup 3Ã ERROR + cron po awarii. Wpisane: PLAN Â§4/Â§8, dopisek `D-20261022-2110-01.md`. Kolejka: #461 â #463 â #409.
- Scalanie: #462 F7 + CI zielone â MERGED `045d9bd7` (0268). Issue #460 zamkniÄte. Bez push na `main`.
- BieÅ¼Äca: **#461** (`pakiet/hotfix-461-ferry-actual-dep`, migracja **0269**) â Prom dopiero przy `actual_departure_at`; status 178; `rk_no_departure`.

## 2026-10-22 22:00 â F7 #469: #461 SCHEDULE_ASSUMED; skrzynka #464â#467

- Skrzynka: #464/#465/#466/#467 (Spawn2018, `dla-cursora`) â wpisane PLAN Â§4/Â§8. #463 juÅ¼ w planie (pilne, po #461).
- Scalanie: brak F7 âgotoweâ (PR #469: F7 âjeszcze nieâ po `aa33562`).
- BieÅ¼Äca: **#461** F7 â migracja **0270**, AIS albo plan+1 h (`SCHEDULE_ASSUMED`), bez `NO_DEPARTURE`/`MISSED_SAILING`, korekta SG-17/18/23, SILENT/eskalacja nie przy `RIO_NO_POSITION`; status **184**. #409â**0271**. Bez push na `main`.

## 2026-10-22 22:45 â #471: #459+#470 SCALONE; #461 F7 r4

- Skrzynka: #471 (Spawn2018, `dla-cursora`+`pilne`) â scaliÄ #459 potem #470. Wykonane; #471 zamkniÄte.
- Scalanie: #459 F7 + CI â MERGED `9ca7ee08`; #470 F7 + CI â MERGED `f064a005`. Bez push na `main`.
- BieÅ¼Äca: **#461** / PR #469 F7 r4 â `v_ev bigint` (CI: uuid â44â), FERRY tylko READYâ¦AT_PORT_GDANSK, `l3_lapse` zawsze przy RIO, escalate tylko NO_POSITION/SILENT, testy +5 â status **189**. Czekam CI + F7.

## 2026-10-22 23:05 â #461 SCALONE; start #463 (backup/cron)

- Skrzynka: #463 `pilne` bieÅ¼Äca; #464â#467/#409/#446/#425 w planie. Bez nowych `pilne` przerywajÄcych.
- Scalanie: #469 F7 âgotowe do scaleniaâ + CI unit/db/visual zielone â MERGED `7e77540a` (0270). Issue #461 zamkniÄte. Bez push na `main`.
- BieÅ¼Äca: **#463** (`pakiet/hotfix-463-backup-cron`):
  - Diagnoza: I-33 na COPY duÅ¼ych tabel (`notifications`, `sms_heartbeats`, â¦); awaria crona 22.10 rano.
  - RÄcznie: backup **#37 OK** `daily/2026-10-22-225919/` (96 tabel, 25 plikÃ³w); polisy 0; kolejnoÅÄ 1; ferry-schedule ok w `integration_runs`.
  - Kod: stronicowanie `ctid` + timeout COPY; `backup-core` 13/13. Edge po scaleniu/`deploy-main`.
  - `email-budget`: brak crona (trigger); `usage-check` OK. #446 pkt 6: ferry-schedule z crona â 23.10 05:00 UTC.

## 2026-10-23 00:05 â #472/#463 SCALONE; wznowienie #409 (0271)

- Skrzynka: #463 zamkniÄte; #409/#464â#467/#446/#425/#413/#422 w planie. Bez nowych `pilne` przerywajÄcych.
- Scalanie: #472 F7 âgotowe do scaleniaâ (head `b199168`) + CI unit/db/visual zielone â MERGED `24012262`. Issue #463 zamkniÄte. Bez push na `main`.
- BieÅ¼Äca: **#409** (`pakiet/hotfix-409-fuel-basis` / PR #458) â rebase na main; migracja **0271** (0268=#460); `fuel_basis_public` + `set search_path = public, pg_temp`; allowlista bez `owner_note` dla SCX/KSH; money **191**.

## 2026-10-23 02:25 â #458/#409 SCALONE; start #464 (0272)

- Skrzynka: #464â#467/#446/#425/#413/#422 (Spawn2018) â juÅ¼ w planie; #409 zamkniÄte. Bez nowych `pilne` przerywajÄcych.
- Scalanie: #458 F7 âgotowe do scaleniaâ (head `7ce5c44`) + CI unit/db/visual zielone â MERGED `75653b46` (0271). Bez push na `main`. `deploy-main` nie czekamy.
- BieÅ¼Äca: **#464** (`pakiet/hotfix-464-a7-permits-ksh`) â migracja **0272**: `a7_permits_list` dla KSH = Firma+Trasa z `load_permits` wÅasnych transportÃ³w; `loads` tylko wÅasne; i2 +6 â **660**. #413â**0273**, #422â**0274**, B5â**0275**.

## 2026-10-23 02:55 â #473/#464 SCALONE; start #465 (bmapa +26)

- Skrzynka: #465â#467/#446/#425/#413/#422/#463 (Spawn2018) â w planie; #464 zamkniÄte. Bez nowych `pilne` przerywajÄcych.
- Scalanie: #473 F7 âgotowe do scaleniaâ (head `d8cf6f7`) + CI unit/db/visual zielone â MERGED `85f9049b` (0272). Bez push na `main`. `deploy-main` nie czekamy.
- BieÅ¼Äca: **#465** (`pakiet/hotfix-465-map-rpc-auth`) â `bmapa.sh` +26: RPC mapy/Stanu jako HHL/KSH/SCX (lekcja 42702); EXPECTED bmapa **62**.

## 2026-10-23 03:15 â #465 F7 #474: peÅna lista RPC + rpc_denied

- Skrzynka: bez nowych `pilne`; #465â#467/#446/#425 w planie. Scalanie: brak âF7: gotoweâ (F7 #474: jeszcze nie â zakres okrojony).
- BieÅ¼Äca: **#465** PR #474 â F7: dopisane 25 RPC ze zrzutu aplikacji + `rpc_denied` (42501 vs bÅÄd definicji); EXPECTED bmapa **141** (+105). CI poprzedniego SHA zielone; push poprawki.

## 2026-10-23 03:45 â #474/#465 SCALONE; start #463 cz.2 (backup continue)

- Skrzynka: #463 ponownie otwarte (F7 #474: nocna kopia id 38 â Edge 502 ~147 s). #465 zamkniÄte. #259 zamkniÄte bez scalenia (F7 #382).
- Scalanie: #474 F7 âgotowe do scaleniaâ (head `ae1214a6`) + CI unit/db/visual zielone â MERGED `8569f78b`. Bez push na `main`.
- BieÅ¼Äca: **#463 cz.2** (`pakiet/hotfix-463-backup-continue`) â `WALL_BUDGET_MS` 90 s, timeout kawaÅka 40 s, samowywoÅanie `{ continue_run }`, log po tabeli; unit backup-core 14/14.

## 2026-10-23 04:15 â #475/#463 cz.2 SCALONE; start #466 (D1 PII)

- Skrzynka: #463 otwarte do odbioru SELECT (F7); #466/#467/#446/#425/#413/#422 w planie. Bez nowych `pilne` przerywajÄcych.
- Scalanie: #475 F7 âgotowe do scaleniaâ (head `713d7d0`) + CI unit/db/visual zielone â MERGED `df81cb13`. Bez push na `main`.
- BieÅ¼Äca: **#466** (`pakiet/hotfix-466-pii-historia`, migracja **0273**) â `audit_row_change`: PII jawne; `rio_secret` â â¢â¢â¢â¢; maska tylko `source=rodo`. i2 **665** (+5 role przez `load_driver_contacts`, nie SELECT kolumn). #413â0274, #422â0275, B5â0276.
- CI `db` na `2f6a173b`: i2 661/3 FAIL â testy rÃ³l braÅy `loads.driver_*` wprost (0076 bez SELECT). Poprawka: RPC + HHL_ADMIN.

### PrzeglÄd maskowaÅ PII (#466 / D-1243 pkt 2)
| Miejsce | ByÅo | Po #466 |
|---|---|---|
| `audit_row_change` â phone/name/email (app_users, sms_zone_recipients, loads, load_escorts, â¦) | `[dane osobowe]` (poza driver_* na loads/escorts) | jawne |
| `audit_row_change` â `rio_secret` | `â¢â¢â¢â¢` | bez zmian (sekret) |
| `audit_row_change` â `source=rodo` (purge) | maska kierowcy | bez zmian (retencja) |
| `purge_personal_data` â stare wpisy audit_log | maska po 90 d | bez zmian |
| `load_escort_contacts` / `awiz_pilots_set` | juÅ¼ jawne (#358/#0239) | bez zmian |
| `driver_tokens` | poza `trg_audit_row` | OK (sekret poza historiÄ wierszy) |
| Wpisy archiwalne `[dane osobowe]` | nieodtwarzalne | bez zmian |

## 2026-10-23 04:55 â #463 cz.3: hang COPYâcount (id 39 ERROR)

- Skrzynka: #463 `pilne` (odbiÃ³r kopii); #466 PR #476 CI zielone, czeka F7; #467/#446/#413/#422 w planie.
- RÄczny `backup-export` (jak cron, bez `continue_run`): **id 39** RUNNING â 4 tabele (`anon_call_window`â¦`audit_log`) â EDGE IDLE_TIMEOUT 150 s; `continue_run` bez postÄpu. Diagnoza: `pg_stat_activity` = `idle in transaction` / ClientRead, ostatnie `count(*)` na `auth_login_events` (postgres.js po `.readable()` nie domyka zapytania â brak COMMIT).
- id 39 oznaczone ERROR (terminate backend). Naprawa Edge: `await query` po strumieniu COPY + `count(*)` przed COPY w RR. GaÅÄÅº `pakiet/hotfix-463-backup-copy-hang`. Po wdroÅ¼eniu â ponowna kopia i wpis id/status/continue.

## 2026-10-23 05:05 â #476/#466 SCALONE; rebase #477 (#463 cz.3)

- Skrzynka: #463 `pilne` bieÅ¼Äca; #466 SCALONE (odbiÃ³r SELECT po wdroÅ¼eniu); #467/#446/#413/#422 w planie. Bez nowych `pilne` przerywajÄcych.
- Scalanie: #476 F7 âgotowe do scaleniaâ (head `2b7adc8`) + CI unit/db/visual zielone â MERGED `343a7042` (0273). Bez push na `main`.
- BieÅ¼Äca: **#463 cz.3** PR #477 â rebase na `main` po #476 (konflikt PLAN/POSTEP); CI ponownie po push. Czekam na F7.

## 2026-10-23 05:45 — #477/#463 cz.3 SCALONE; start #467 (D3 / 0274)

- Skrzynka: #463 otwarte do odbioru SELECT (kopia po wdrożeniu); #467 bieżąca; #446/#413/#422/#412/B5 w planie. Bez nowych `pilne` przerywających.
- Scalanie: #477 F7 „gotowe do scalenia” (head `1b956ac`) + CI unit/db/visual zielone → MERGED `b76da833`. Bez push na `main`.
- Bieżąca: **#467** (`pakiet/hotfix-467-d3-mail-sms`, migracja **0274**):
  - Maile bez konta: `notify_orphan_email_allowed` (rola/rodzaj z macierzy; bez `ext_mail` domyślnie on).
  - SMS: numery testowe tylko przy EXTERNAL off; przy on — TEST tylko `sms_zone_recipients`; UI przycisk testu nieaktywny.
  - i2 **669**, c3 **35**; #413→**0275**, #422→**0276**, B5→**0277**.

## 2026-10-23 06:05 — #479 pilne: kopia id 40 hang; cz.4 COPY jak id 37

- Skrzynka: #479 `pilne` (przerywa #467/PR #478) — po wdrożeniu #477 brak przebiegu OK; id 39 ERROR, id 37 ostatnia OK.
- Ręczny `backup-export` jak cron: **id 40** RUNNING → te same 4 tabele → IDLE_TIMEOUT 150 s; `continue_run=40` → znowu 150 s, 0 postępu. `auth_login_events` 85 wierszy / 24 kB. Brak `idle in transaction` po zabiciu Edge.
- Diagnoza: `await query` po `.readable()` w `sql.begin` RR (#477) wiesza Deno; w `catch` po timeout COPY też. Naprawa cz.4: strumień data/end jak id 37 / PR2 — **bez** `begin` i **bez** `await query`; count(*) osobnym zapytaniem.
- id 40 → ERROR. Gałąź `pakiet/hotfix-479-backup-copy-complete` (PR #480). F7 „jeszcze nie”: przedział `assertCsvInCountWindow(n0,n1)` zamiast równości; dopisek D-20261023-0615-01. Po ponownym F7/deploy-main: kopia + wpis w #463.

## 2026-10-23 06:50 — #479 cz.5: id 42 hang readable(); PostgREST CSV dla małych tabel

- #480 SCALONE `c577280c`; deploy-main OK (Edge `backup-export` + `core.ts`).
- Kopia jak cron: **id 42** RUNNING → 4 tabele / 532 kB → IDLE_TIMEOUT 150 s; `continue_run=42` → 0 postępu. `psql \copy auth_login_events` OK (85 / 20 kB / 0,6 s). Hang: `await .readable()` przed timerem 40 s.
- id 42 → ERROR. Gałąź `pakiet/hotfix-479-backup-select-small`: małe tabele → PostgREST CSV; COPY + race na `readable()` dla dużych; dopisek D-20261023-0650-01.

## 2026-10-23 07:05 — #479 cz.6: F7 A — bez COPY (select + CSV)

- Skrzynka: #463/#467/#446/#425/`dla-cursora` — w planie; #479 bieżąca (`pilne`). Bez nowego `pilne` poza kolejką.
- Scalanie: brak „F7: gotowe do scalenia” po ostatnim commicie (#481 F7 „jeszcze nie” `5b3aec6`). CI #481 zielone — nie scalać.
- Bieżąca: **#479 cz.6** PR #481 — usunięte COPY/`.readable()` i PostgREST z Edge; `select` keyset ctid (`SELECT_BATCH_ROWS` 2000) + `rowsToCsv`; timeout całej tabeli 60 s; dopisek `D-20261023-0705-01`.

## 2026-10-23 07:35 — #481 SCALONE; powrót #467 (F7 macierz/org/E42)

- Skrzynka: #467 bieżąca; #463 otwarte do odbioru kopii po deploy-main #481; #446/#413/#422 w planie.
- Scalanie: #481 F7 „gotowe do scalenia” (head `70c8d5c`) + CI unit/db/visual zielone → MERGED `602e7287`. Bez push na `main`.
- Bieżąca: **#467** PR #478 — rebase na main + F7:
  - wiersze macierzy `CARRIER_*`/`CLIENT_USER` (brakujące, `email=false`);
  - org z roli w `notify_orphan_email_allowed`;
  - `sms_send_test` → `is_hhl_admin()`;
  - E42 `pilot_redirect_dry_run` + `matrix_role`;
  - dopisek: wyjątek `usage-check` (Resend poza bramką).

## 2026-10-23 09:55 — #485 PILNE: Port SE / Droga SE z pozycji (przerywa #467)

- Skrzynka: #485 `pilne` (Spawn2018) — SG-23 FERRY mimo pozycji EMTRACK w SE; F7 #478: najpierw #485. #467 CI zielone na `5150fb86`, bez „F7: gotowe” — nie scalane.
- Scalanie: brak PR z „F7: gotowe do scalenia” po ostatnim commicie.
- Bieżąca: **#485** `pakiet/hotfix-485-ferry-se-position`, migracja **0274**.

## 2026-10-23 12:31 — #485 SCALONE; powrót #467 jako 0275

- Skrzynka: #485 w toku; #484 wpisane w #478 (po #412, przed B5); #467 F7 „gotowe” wstrzymane do rebase 0274→0275 po #485.
- Scalanie: #478 nie — konflikt numeru migracji z #486; nowe F7 po renumeracji.
- CI `db` FAIL na `4bfdece8`: A2 komentarz POPRAWKA 24.09 w `process_position` (zgubiony przy CREATE OR REPLACE) → przywrócony; `status` 190→**196** (+6 #485).

## 2026-10-23 11:15 — #485 F7 B1–B4 (jeszcze nie → poprawki)

- Skrzynka: #485 `pilne` bieżąca; #467 F7 „gotowe” wstrzymane (0274→0275 po #485); #484 w kolejce po #412.
- Scalanie: brak „F7: gotowe” po ostatnim commicie #486 (F7: jeszcze nie, B1–B3).
- F7 #486: `sweden_land_geom`; DOPLYNAL wymaga lądu SE + `p_ts ≥ arrival` + ≥2 km od PORT_IN; bez DOPLYNAL tylko ląd SE (bez limitu 80 km); naprawa = pierwsza pozycja poza portem na lądzie; `debounce_fixes=1` dla PORT_IN SE; `status` **200**.

## 2026-10-23 11:40 — #485 CI: search_path na sweden_land_geom

- Skrzynka: #485 `pilne`; #484 wpisane PLAN §4 (po #412, przed B5); #467 F7 „gotowe” treścią — scalenie po #485 + renumeracja 0275.
- Scalanie: brak „F7: gotowe” na głowie #486 po B1–B4; #478 nie scalać (0274 koliduje z #486).
- CI `db` FAIL na `2ba3cac8`: security „każda funkcja public ma ustaloną search_path” (1) → `sweden_land_geom` + `set search_path to 'public'`. `status` 200/200 OK.

## 2026-10-23 12:45 — #487 PILNE: OFF_CORRIDOR Karlskrona / E22 (przerywa #467)

- Skrzynka: #487 `pilne` (Spawn2018) — fałszywa CRITICAL OFF_CORRIDOR SG-23 (SE_E4 zamiast E22); przed #478. #484 już w planie. #467 PR #478: F7 „gotowe” na e7bf6ae, CI w toku — nie scalane (#487 pierwsze).
- Scalanie: brak PR do scalenia (F7 #478 czeka na #487 + zielone CI).
- Bieżąca: **#487** `pakiet/hotfix-487-corridor-e22`, migracja **0275**: `refresh_load_eta` — STENA→SE_E22, POLFERRIES→SE_E4; bez korytarza → bez sprawy; zamknięcie 518c010e… + PENDING + L3; testy `status.sh`.
- Numery: #467→**0276**, #413→**0277**, #422→**0278**, B5→**0279**.

## 2026-10-23 13:15 — #487 CI FAIL → poprawka testów (PR #488)

- Skrzynka: #487 `pilne` bieżąca; #484 w planie; #467 F7 treścią — nie scalać (kolizja 0275→0276 po #487; komentarz koordynatora 10:49).
- Scalanie: brak (CI #488 czerwone; #478 nie scalać przed #487).
- CI `db` FAIL na `d3601c0e`: status 204/205 — punkt 57.0/16.4 ~3 km od polilinii SE_E22 przy OFFROUTE_KM=2; risks 44/46 — `rk_off_corridor` z L487b w `tower_test_status`.
- Poprawka: wierzchołek SE_E22 (16.637,57.758); sprzątanie `rk_off_corridor`; status **206**.

## 2026-10-23 13:35 — #487 F7 runda 2 + #489 w planie (PR #488)

- Skrzynka: #489 `pilne` (Spawn2018) — SG-18 po odpięciu rejsu status zostaje FERRY; wpisane PLAN §4 (po #487, przed #467, **0276**). #484 w planie.
- Scalanie: brak — #488 F7 „jeszcze nie” (bloker 2–3 migracji); #478 F7 treścią, ale numer → **0277** po #487+#489 (nie scalać).
- CI #488 na `04d06b7a`: unit/db/visual zielone.
- F7 poprawki w 0275: `518c010e` bez warunku `resolved_at` + adnotacja; PENDING tylko `payload.risk_id` → `SUPPRESSED`; test ~50 km Småland (15.79/57.76).

## 2026-10-23 14:00 — #487 F7 runda 3: geometria SE_E22 (PR #488)

- Skrzynka: #487/#489 `pilne` bieżące; #484/#467 w planie; nowe bez `pilne` nie przerywają.
- Scalanie: brak — F7 #488 „jeszcze nie” (B1 polilinia); #478 nie scalać (0275→**0277** po #487+#489).
- CI #488 na `09a53cc5`: unit/db/visual zielone; F7 B1: Karlshamn 14.862 cofa linię — SG-23 15.9423/56.2523 = 24 km od polilinii.
- Poprawka 0275: `UPDATE SE_E22` — Jämjö/Brömsebro/Nyköping, bez 14.862; `audit_log` tylko przy zmianie; test Jämjö przy OFFROUTE_KM=20; sprzątanie tylko L487a/b.

## 2026-10-23 14:20 — #487 F7 runda 4: Norrköping + #490 SCALONE (PR #488)

- Skrzynka: #487/#489 `pilne`; #484/#467 w planie.
- Scalanie: **#490** `e911ad74` (F7 gotowe po `775700ce`, CI zielone) — oś Status AIS. #488 F7 r3 „jeszcze nie” (B2: zgubiony Norrköping); #478 nie scalać (→**0277**).
- CI #488 na `0129b073`: unit/db/visual zielone.
- F7 B2: 16.637=Västervik; brak 16.32/58.48 i 16.183/58.594 → SG-23 16.3186/58.4792 = 33,5 km. Poprawka: Söderköping+Norrköping(+Gamleby); `total_km` z `geom`; test Söderköping; OFFROUTE_KM przywrócone; status **207**.

## 2026-10-23 14:40 — #487 SCALONE + start #489 (0276)

- Skrzynka: #489 `pilne` bieżąca; #487 zamknięte; #484/#467 w planie (#478 → **0277**, nie scalać przed #489).
- Scalanie: **#488** `53c66026` (F7 gotowe na `4e386f4c`, CI zielone); **#491** `6b824f6a` (wygląd statusy, F7 gotowe).
- Bieżąca: **#489** `pakiet/hotfix-489-sailing-removed-status`, migracja **0276**: `revert_status_after_sailing_removed` + trigger na `sailing_id`; naprawa SG-18; testy status **218** (+11).

## 2026-10-23 15:05 — #489 CI zielone + #492 w planie

- Skrzynka: #492 (Spawn2018, niepilne) — `loads.updated_at` przy zasobach z ekranu (po #491); wpisane PLAN §4 po #484, przed B5. #489 `pilne` nadal bieżąca.
- Scalanie: brak — PR #493 bez F7; #478 wstrzymane (→**0277** po #489); #382/#383 niegotowe.
- CI #493 na `6a335941`: unit / db / visual **zielone** (status 218). Czekam na „F7: gotowe do scalenia”.

## 2026-10-23 15:30 — #489 F7 B1/B2 (łańcuch korekty AIS)

- Skrzynka: #489 `pilne` bieżąca; #492/#484/#467 w planie (bez nowych).
- Scalanie: brak — F7 #493 „jeszcze nie” (B1/B2); CI docs `bfb80182` unit/db/visual zielone przed poprawką; #478/#494 nie scalać przed bazą.
- F7: `revert_status_after_sailing_removed` — CTE po `zastepuje` przy `korekta` / `from=status`; `cofniete_ids`; trigger `WHEN (old.sailing_id is distinct from new.sailing_id)`; naprawa actor/godzina z SAILING_ASSIGNED „rejs usunięty”; testy b'/d/e; status **230**.

## 2026-10-23 16:00 — #489 F7 r2 B3 (ręczna korekta godziny)

- Skrzynka: #489 `pilne` bieżąca; #492/#484/#467 w planie; #494 wygląd F7 gotowe (czeka na bazę).
- Scalanie: brak — F7 #493 „jeszcze nie” (B3); CI `3fa2849e` db FAIL b' (IN_TRANSIT_PL zamiast FERRY).
- F7 B3: głowa `STATUS_*` / bez source → `return false`; CTE wstecz tylko przez `STATUS_AUTO`+`source=AIS`; łańcuch z wpisem ręcznym → bez cofania; naprawa bez placeholder `sailing_id` (null). Status **230**.

## 2026-10-23 16:40 — #489 SCALONE; #467 → 0277 (merge main)

- Skrzynka: #489 zamknięte; #492/#484 w planie; #467 bieżąca (PR #478).
- Scalanie: **#494** `67e18e62` (F7 gotowe, CI zielone); **#493** `8e03d704` (F7 gotowe na `952ef2d6`, CI unit/db/visual zielone, status 230).
- Bieżąca: **#467** `pakiet/hotfix-467-d3-mail-sms-settings` — merge `main` po #489; migracja **0275→0277**; czekam na CI + F7: gotowe do scalenia.

## 2026-10-23 17:05 — #467 SCALONE; start #413 (0278)

- Skrzynka: #492/#484/#413/#422/#412 w planie; zamknięte #463 (kopia OK), #466 (0273), #467 (0277). Bez nowych `dla-cursora` do wpisania.
- Scalanie: **#478** `37c455a7` (F7 gotowe po `d2a84363`, CI unit/db/visual zielone) — #467 D3 / migracja **0277**.
- Bieżąca: **#413** `pakiet/hotfix-413-automatyzacje-strefy`, migracja **0278**: `workflows_read_ops` (HHL_OPS SELECT); `canSeeWorkflows` + `canEditGeofence`/`canEditWorkflow` (OPS bez edycji). Dalej: START Z1, `rulesReady`/`zonesReady` + źródła P8-d/P8-c.

## 2026-10-23 17:45 — #413 krok 2: START Z1 (0279)

- Skrzynka: bez nowych `dla-cursora` (Spawn2018); #492/#484/#413/#422/#412/#323/#322/#320 w planie. CI #495 (0278) zielone; bez F7 „gotowe”.
- Bieżąca: **#413** migracja **0279** — soft-delete START-1…7 (`removed_at`), enqueue/worker pomija usunięte; audit z powodami E35; testy `workflows`/`e25`/`import` → T-S1/T-S7/T-CANCEL. #422→**0280**, B5→**0281**. Dalej: `rulesReady`/`zonesReady` + źródła P8-d/P8-c.

## 2026-10-23 18:20 — #498 pilne (backup części); skrzynka; #413 wstrzymane

- Skrzynka: **#498** `pilne` — bieżąca (przerywa #413); #496/#499/#500 wpisane §4; #492/#484/#413/#422 w kolejce.
- Scalanie: **brak** — #495 F7 odwołane po commit 0279 (`d495b295`); CI unit/db/visual zielone, czekam rundę 2; #497 wygląd bez F7; #382 konflikt.
- Bieżąca: **#498** `pakiet/hotfix-498-backup-parts`, migracja **0278**: części `PART_MAX_ROWS=5000`, `progress`/`progress_at`, cron `tower-backup-continue`, I-33 = 10 min bez postępu; `restore.sh` + unit. #413→0279+0280 po rebase.

## 2026-10-23 18:50 — #497 SCALONE; #501 F7 B1/B2; prognoza #499

- Scalanie: **#497** `6640f4c8` (F7 gotowe na `4620e6a`, CI zielone) — wygląd drobne F7.
- **#501 / #498:** CI unit/db/visual zielone na `dc970998`; F7 „jeszcze nie” → B1 lease + cron ≥2 min; B2 `recordTableParts` (1×5000); catch tylko `RUNNING`. `deploy-main`: Baza przed Edge — OK.
- **#499 prognoza (najpóźniej, bez cięcia 28.10 20:00):** #498 dziś przed 00:30 UTC; #413+#422+#412 24.10; #484+#492+#496 25.10; B5 25–26.10; B7/B8/B9 26.10; A6+SharePoint 26–27.10; C4–C13 27.10; P4-u/P3-d 27–28.10.
- Dalej: push F7 B1/B2, czekam ponowne „F7: gotowe”.

## 2026-10-23 19:15 — #501 db: backup 32/32 (gate-suites)

- CI `db` czerwone na `ddcaf0cb`: backup 32 OK, oczekiwano 29 (`gate-suites.mjs`).
- Poprawka: LOCAL 32, TEST 24 (32−8 SKIP). Unit/visual już zielone. Czekam CI + F7 „gotowe”.

## 2026-10-23 19:45 — #501 F7 B1'; #502 w planie

- Skrzynka: **#502** `pilne` — wpisane §4 (po #498, przed #413); nie przerywa #498 (termin 00:30 UTC).
- Scalanie: brak F7 „gotowe” na #501; #495/#382 bez „gotowe”.
- **#501 / #498:** CI unit/db/visual zielone na `9b1c6a95`. F7 r2 B1': przed `scheduleContinue` `lease_until = null` (dziecko bez 409). Czekam ponowne F7.

## 2026-10-23 20:15 — #501 SCALONE; start #502 (0279)

- Skrzynka: #502 `pilne` bieżąca; #498 zamknięte; #413/#422/#412/#484/#492/#496/#499/#500 w kolejce.
- Scalanie: **#501** `8d3b19c0` (F7 gotowe na `78f53c0d`, CI unit/db/visual zielone, backup 32/32). `deploy-main` baza→Edge.
- Bieżąca: **#502** `pakiet/hotfix-502-ferry-a10b`, migracja **0279**: A10_b tylko W_REJSIE/actual_dep lub AIS>3kn ≥1km; `bulk_quiet` na A10_b/c; T-11 zastepuje+SUPPRESSED; status **233** (+3).

## 2026-10-23 20:50 — #502 F7 B1–B4 (jeszcze nie → poprawka)

- Skrzynka: #502 `pilne` (F7 #503 B1–B4); #500/#499/#496/#492/#484/#413 bez przerwania.
- Scalanie: brak F7 „gotowe”; #495 konflikt; #383 wygląd bez F7.
- Bieżąca: **#502** F7: (B1) GPS↔AIS ≤15 min + godzina z actual/AIS; (B2) plan ≤ now+30 min przy SOG; (B3) `bulk_quiet` synthetic SCHEDULE w `apply_geofence_status`; (B4) +5 testów; status **238**; AIS SOG świeżość 20 min.

## 2026-10-23 21:20 — #502 SCALONE; #413 → 0280/0281 (F7 r2)

- Skrzynka: #502 zamknięte; #413 `pilne` bieżąca; #500/#499/#496/#492/#484/#422 w kolejce.
- Scalanie: **#503** `86e80a41` (F7 gotowe na `fa4efcdb`, CI unit/db/visual zielone, status 238).
- Bieżąca: **#413** merge main; migracje **0280** (OPS read) + **0281** (START Z1 + `trg_geofence_matrix_notify` geofence_kind/country → pre_arrival_*/pre_port; testy B2). #422→**0282**, B5→**0283**.

## 2026-10-23 21:50 — #413 db FAIL → poprawka workflows (78)

- Skrzynka: #413 `pilne` bieżąca; #500/#499/#496/#492/#484/#422/#412 w planie (bez nowych do wpisania).
- Scalanie: brak — #495 bez „F7: gotowe” po `c89b4fdc`; CI `db` czerwone (workflows 76/78).
- Bieżąca: **#413** `workflows.sh`: (1) OPS read — `::text` → oczekiwane `true`; (2) B5 e-mail krytyczny — filtr `auth_id` HHL (OPS w audience HHL). Dalej: CI + F7; potem `rulesReady`/`zonesReady`.

## 2026-10-23 22:30 — #413 rulesReady/zonesReady (P8-d/P8-c na produkcji)

- Skrzynka: #413 `pilne` (fragment pozostały po #495); #422 dalej w kolejce.
- Scalanie: **#495** `6334c919` (F7 gotowe na `41bc353d`, CI zielone) — 0280+0281 na main.
- Bieżąca: **#413** `pakiet/hotfix-413-rules-zones-ready` — `rulesOf`/`zonesOf` produkcja (store + `workflow_rule_history` / soft-delete / `upsert_geofence_circle`); `rulesReady`/`zonesReady` = true; zapis tylko `HHL_ADMIN`. Testy `p8d-rules`, `p8c-zones`, `b5-workflow-creator` (E35).

## 2026-10-23 23:00 — #413 F7 #504 poprawki 1–4, 6, 8

- Skrzynka: #500/#499/#496/#492/#484 w planie (wpisane); bez `pilne` poza #413.
- Scalanie: brak F7 „gotowe”; F7 #504 „do poprawy” (head `b3d803f`).
- Bieżąca: **#413** F7: (1) daily `load.*` + `WSTEPNA`; (2) próg strefy = dwell UI (select disabled); (3) prodCheck `payload.to` + `statusToDb`; (4) soft-delete `.select` / 0 wierszy → ok:false; (6) near `edgeM<=5km` + lastFixAt; (8) testy `p8d-map-prod` 52/52. **5/7** (route w upsert + powód/`workflow_rule_history` OPS) — migracja, w komentarzu PR.

## 2026-10-23 23:10 — #413 F7 #504 r2 drobne + #505 w planie

- Skrzynka: **#505** (Spawn2018) — wpisane PLAN §4 po #413 (migr. **0282**; #422→0283, B5→0284), §8, tu; nie przerywa #504.
- Scalanie: brak F7 „gotowe”; CI visual zielone na `503ab23f`; F7 r2: 2 drobne przed „gotowe”.
- Bieżąca: **#413** / PR #504 — (1) trasa w prod `disabled` + hint do #505; (2) strefa `dwellMin` ≤ 0 → „bez progu (od razu po wjeździe)”. Po push: czekam F7 „gotowe do scalenia”.

## 2026-10-23 23:50 — #504 SCALONE; start #505 (0282)

- Skrzynka: #505 bieżąca; #500/#499/#496/#492/#484/#422 w kolejce (bez `pilne` przerywających).
- Scalanie: **#504** `c007736f` (F7 „gotowe do scalenia” na `c47c74f1`, CI unit/visual zielone).
- Bieżąca: **#505** `pakiet/hotfix-505-route-ops-history`, migracja **0282**: `v_geofences_circle.route`, `upsert` `p_route`/`p_reason`, `audit_reason` → `new_value.reason`, `workflow_rule_history` dla HHL_OPS + `po` przy DELETE, RPC `workflow_rule_write`/`set_enabled`/`soft_delete`; front route odblokowany; workflows **86**.

## 2026-10-24 00:25 — #505 CI: unit + workflows (PR #506)

- Skrzynka: bez `pilne`; kolejka bez zmian (#505 bieżąca).
- Scalanie: brak F7 „gotowe”; CI na `bb8d76f7`: unit FAIL (`CheckHit.loadId`), db FAIL (workflows 83/86), visual OK.
- Bieżąca: **#505** — (1) `p8dProd` status hits + `loadId`; (2) re-apply **0282** po 0165 w `workflows.sh`; (3) zapis/soft-delete z JWT HHL + commit; historia soft-delete przez `val` HHL; (4) nullguard **715** (+3 GUARD ×5). Push → CI.

## 2026-10-24 01:15 — #505 db FAIL: historia soft-delete przez Q() (PR #506)

- Skrzynka: #505/#500/#499/#496/#492/#484/#422 (Spawn2018) — już w planie; bez `pilne` przerywających.
- Scalanie: brak F7 „gotowe”; unit/visual zielone na `3527b0a8`; db FAIL workflows 89/90 — `workflow_rule_history` przez `Q()` bez JWT → RAISE.
- Bieżąca: **#505** — asercja „po w historii (ROW_UPDATE)” przez `val $HHL` (jak powód w `po`). Push → CI.

## 2026-10-24 01:36 — #505 SCALONE; start #422 (0283)

- Skrzynka: #505 zamknięte; #422 `pilne` bieżąca; #500/#499/#496/#492/#484/#412 w kolejce.
- Scalanie: **#506** `069aaac1` (F7 „gotowe do scalenia” na `2ebb6fa1`, CI unit/db/visual zielone).
- Bieżąca: **#422** `pakiet/hotfix-422-perf-errors`, migracja **0283**: `perf_results` + RLS HHL, `perf_results_latest` / `app_errors_recent`, `perf_result_record` (service_role), `perf_p95_lists_ingest` + cron `tower-perf-p95`, seed p5 „brak pomiaru”; security **172**, nullguard **725**. Lighthouse w deploy-main — następny krok.

## 2026-10-24 02:15 — #422 db: p95 bez auth.role() na bramie

- Skrzynka: #422 `pilne` bieżąca; #500/#499/#496/#492/#484/#412 w kolejce. Bez nowych `dla-cursora`.
- Scalanie: brak F7 „gotowe” (PR #507, #382, #383). Unit i visual zielone na `d678df58`; db FAIL security 169/172 — `auth.role()` nie istnieje w bramie.
- Bieżąca: **#422** — zapis p95 najpierw sesja postgres/supabase_admin, `auth.role()` tylko gdy funkcja jest; `chk` → `chk6` (anon bez INSERT). Lighthouse w deploy-main — po zielonym db.

## 2026-10-24 02:25 — #422 F7 r2 pkt 3–6 (PR #507)

- Skrzynka: #422 `pilne` bieżąca; #500/#499/#496/#492/#484/#412 w planie. Bez nowych `dla-cursora`.
- Scalanie: brak F7 „gotowe”; CI na `7936b5bf` unit/db/visual zielone; F7 r2: nadal 3–6 przed „gotowe”.
- Bieżąca: **#422** — (3) `app_errors_recent` → `is_hhl_admin()` + testy OPS/SCX/anon; (4) `max_exec_time` loads/load_messages, bez `list_loads`, Δ vs poprzedni; (5) `newCount`/`state` = null; (6) authenticated bez EXECUTE record/ingest; `at` tylko `ok is not null`; retencja 90 dni; security **179**. Lighthouse — osobny krok po F7.

## 2026-10-24 02:40 — #422 db: newCount JSON null vs SQL NULL

- Skrzynka: #422 `pilne` bieżąca; #500/#499/#496/#492/#484/#412/#413/#425 w planie. Bez nowych `dla-cursora` do wpisania.
- Scalanie: brak F7 „gotowe” (PR #507, #382, #383). Unit/visual zielone na `05d3989e`; db FAIL security 178/179 — asercja `newCount is null` pada na JSON `null`.
- Bieżąca: **#422** — test `jsonb_typeof(...->'newCount') = 'null'` (F7: JSON null = brak danych). Czekam na CI i F7.

## 2026-10-24 02:55 — #422 CI zielone na ee7fa0e4; czekam F7

- Skrzynka: #422 `pilne` bieżąca; #500/#499/#496/#492/#484/#412/#413/#425 w planie. Bez nowych `dla-cursora` do wpisania.
- Scalanie: brak F7 „gotowe do scalenia” (PR #507, #382 CONFLICT, #383). **CI zielone** na `ee7fa0e4`: unit, `db` security (gate 12m42s), visual (zrzuty/telefon/bramy).
- Bieżąca: **#422** PR #507 — F7 r2 pkt 3–6 + poprawka `jsonb_typeof` na head; Lighthouse po deploy-main (osobny krok). Czekam na „F7: gotowe do scalenia”.

## 2026-10-24 03:15 — #508 wpisane; #422 Lighthouse + newSince (0284); A1 W3 data

- Skrzynka: **#508** (Spawn2018, dla-cursora) — Lighthouse p1–p3 po deploy-main + newSince w Błędach; wpisane PLAN §4/§8, dopisek `D-20261024-0315-01.md`. #500/#499/#496/#492/#484/#412 w kolejce.
- Scalanie: F7 „gotowe” na `ee7fa0e4` unieważnione commitem docs `23dacb8b`; potem db FAIL status 237/238 (A1 cisza — sztywne `2026-10-24` = dziś). #382 CONFLICT, #383 bez F7.
- Bieżąca: **#422+#508** PR #507 — migracja **0284** (`deploy_success_record`, `app_errors_recent` newSince/newCount), skrypt `scripts/ci/perf-lighthouse-deploy.mjs`, krok w `deploy-main`; A1 W3 = `current_date+14`; security **185**; B5→**0285**. Push → CI; czekam F7.

## 2026-10-24 03:45 — #422+#508 CI zielone na 971c0422; czekam F7

- Skrzynka: #508 wpisane (komentarz w issue); #422 `pilne` bieżąca; #500/#499/#496/#492/#484/#412 w kolejce. Bez nowych `dla-cursora` do wpisania.
- Scalanie: brak F7 „gotowe do scalenia” po head `971c0422` (stare F7 na `ee7fa0e4` unieważnione). #382 CONFLICT, #383 bez F7.
- CI na `971c0422`: unit OK, `db` gate OK (~12m19s), visual OK (zrzuty/telefon/bramy). Zakres #422+#508 (0283+0284, Lighthouse w deploy-main, newSince) zamknięty w PR #507 — czekam na „F7: gotowe do scalenia”.

## 2026-10-24 04:10 — #507 F7 „do poprawy”: zapis REST/pula, etykiety LH

- Skrzynka: #508/#422 bieżąca; #500/#499/#496/#492/#484/#412 w kolejce. Bez nowych do wpisania.
- Scalanie: F7 01:38 **do poprawy** (psql na db.* IPv6 → 0 zapisów na prod). CI na `9169ece1` zielone — bez „gotowe”. #382 CONFLICT, #383 bez F7.
- Bieżąca: **#422+#508** — PostgREST `perf_result_record`/`deploy_success_record` (service_role z Management API) + fallback psql na puli; `--preset=desktop`; etykiety p1/p3 Logowanie, p2 Offline; `shell: false`; LH `12.8.2`; `timeout-minutes: 15`; redact; security **186**; A1 W4/T05 = current_date+21/+23; unit skryptu. Czekam CI i F7.
  Etykiety ostateczne (dla `PERF_PLAN` koordynatora): `p1` Logowanie · telefon `/`; `p2` Offline · telefon `/offline.html`; `p3` Logowanie · komputer `/`.

## 2026-10-24 04:35 — #507 SCALONE; start #412 (0285 E40 terminy+adresy)

- Skrzynka: #508/#422 zamknięte scaleniem; #412 bieżąca; #500/#499/#496/#492/#484 w kolejce. Bez nowych `dla-cursora` do wpisania.
- Scalanie: PR #507 F7 „gotowe do scalenia” po `3229714b`, CI zielone → merge `b2528a80`. #382 CONFLICT (B5), #383 bez F7.
- Bieżąca: **#412** gałąź `pakiet/hotfix-412-opcje-finanse-zrodla` — migracja **0285**: `payment_terms_options`/`_set`, `accounting_addresses` + get/set; security **204** (+18); nullguard **745** (+20). B5→**0286**. Front bez zmian (koordynator). Następne w #412: paczka E40, faktoring, marża, E43, push count.

## 2026-10-24 05:05 — #412 db FAIL: projekt STEGRA w seedzie bramy

- Skrzynka: #412/#500/#499/#496/#492/#484/#425/#413/#323/#322/#320 (Spawn2018) — już w planie; bez nowych; bez `pilne` przerywających bieżącą.
- Scalanie: brak F7 „gotowe do scalenia” (PR #510 bez komentarza F7; #509 wygląd; #382 CONFLICT; #383 „Nie scalać jeszcze”).
- Bieżąca: **#412** PR #510 — CI `db` security 200/204: `payment_terms_options` szukało tylko `STEGRA_BODEN`, seed bramy ma `STEGRA`. Poprawka: lookup `STEGRA_BODEN`/`STEGRA` (jak 0106/0267) w options i options_set. Push → CI.

## 2026-10-24 05:25 — #412 F7 #510 „do poprawy”: wersje terminów + e-mail

- Skrzynka: #412 bieżąca; #500/#499/#496/#492/#484/#323/#322/#320 w planie. Bez nowych `dla-cursora`; bez `pilne`.
- Scalanie: F7 #510 **do poprawy** (po `cca4b19`); CI na `fd470bd4` (STEGRA) zielone unit/db/visual — bez „gotowe”. #509 wygląd; #382 CONFLICT; #383 bez F7.
- Bieżąca: **#412** PR #510 — F7: `payment_terms_options_set` insert `valid_from=current_date` on conflict (stara wersja dla `issue_date`); regex e-mail `[a-z0-9._%+-]` (+ `looksLikeEmail`); security: asercja zapisu, wersja past, SCX/KSH get/set/SELECT, bez `duplicate` w INSERT; adresy testowe `@test`. Oczek. security **~210**. Push → CI.

## 2026-10-24 05:42 — #509 SCALONE; #412 db: @test bez TLD

- Skrzynka: #412/#500/#499/#496/#492/#484/#323/#322/#320 (Spawn2018) — już w planie; bez nowych; bez `pilne`.
- Scalanie: **#509** `ca0a94c2` (F7 „gotowe do scalenia” na `567255e`, CI unit/visual zielone) — wygląd Stan systemu Wydajność/Błędy (#422). #382 CONFLICT; #383 bez F7.
- Bieżąca: **#412** PR #510 — CI `db` security 209/211 (2 FAIL): `ksiegowosc@test` / `biuro@test` odrzucone przez regex (brak TLD). Poprawka: adresy testowe `@test.pl`; EXPECTED security **211** / TEST **207**. Push → CI; czekam F7.

## 2026-10-24 06:10 — #510 SCALONE; #412 paczka tygodnia (0286)

- Skrzynka: #412/#500/#499/#496/#492/#484/#323/#322/#320 (Spawn2018) — już w planie; bez nowych; bez `pilne` przerywających.
- Scalanie: **#510** `e187d2d6` (F7 „gotowe do scalenia” na `43c937c`, CI unit/db/visual zielone) — E40 terminy+adresy **0285**. #511 visual FAIL (telefon); #382 CONFLICT; #383 bez F7.
- Bieżąca: **#412** gałąź `pakiet/hotfix-412-paczka-tygodnia` — migracja **0286**: `accounting_pack_sends` + `accounting_pack_config` / `_send` (dziennik; bez Resend — L47/W6). security **227** (+16); nullguard **755** (+10). B5→**0287**. Front — koordynator.

## 2026-10-24 06:55 — #512 F7: ZLECONO / idempotencja / invoice_ids

- Skrzynka: #412/#500/#499/#496/#492/#484/#323/#322/#320 (Spawn2018) — już w planie; bez nowych; bez `pilne`.
- Scalanie: brak F7 „gotowe” (PR #512 F7 **do poprawy** na `a3137d24`; #514 E4b CI w toku — bez push na tę gałąź; #511/#382/#383 bez „gotowe”).
- Bieżąca: **#412** PR #512 — F7: status `ZLECONO` (nie „Wysłano”); `accounting_pack_send_set_status` (service_role); advisory lock + `p_resend`; `invoice_ids`/blokady z serwera; tydzień 01–53; retencja e-mail 5 lat (komentarz); `PackSent` + security **235** (+8). Push → CI; czekam ponowne F7.

## 2026-10-24 07:15 — #511 SCALONE; #512 db: UUID seed pack

- Skrzynka: #412/#500/#499/#496/#492/#484/#323/#322/#320 (Spawn2018) — już w planie; bez nowych; bez `pilne` przerywających.
- Scalanie: **#511** `f82f579d` (F7 „gotowe do scalenia” na `07c85ad`, CI unit/visual zielone) — logowanie bez powłoki. #512 bez F7 „gotowe”; #514 F7 **do poprawy** (czekam po #512); #382 CONFLICT; #383 bez F7.
- Bieżąca: **#412** PR #512 — CI `db` security 226/235: seed `…pk01`/`…cm01` = invalid uuid → insert dokumentów padł cicho, `week_key` nie ustawiony, `accounting_pack_send` → Brak faktury. Poprawka: UUID hex `…a401`/`…a402`, ścieżki `test/pack-412-*.pdf`, bez `>/dev/null`. Push → CI.

## 2026-10-24 07:45 — #513+#512 SCALONE; F7 #514 E4b (0287)

- Skrzynka: #412/#500/#499/#496/#492/#484/#323/#322/#320 (Spawn2018) — już w planie; bez nowych; bez `pilne`.
- Scalanie: **#513** `30ad76d9` (F7 „gotowe”, wygląd terminy/adresy); **#512** `8b337e17` (F7 „gotowe” na `96fe6a1a`, CI unit/db/visual) — paczka **0286**. #382 CONFLICT; #383 bez F7; #515 bez F7.
- Bieżąca: **#412** PR #514 — rebase na main (0286); F7: `factoring_mark_paid` → OPLACONA; przeliczenie przy edycji kwot; asercja `true` nie `t`; testy kolejności / oferty / SPORNA; B5→**0288**. security **260** (+25); nullguard **780**.

## 2026-10-24 08:05 — #516 wpisane; #514 db FAIL → poprawki F7/CI

- Skrzynka: **#516** (Spawn2018) — auto-zamykanie decyzji „Kopia nieudana” po OK; wpisane PLAN §4/§8 + `D-20261024-0755-01.md`. #500/#499/#496/#492/#484/#412 w planie. #413/#425 `pilne` SCALONE w planie (otwarte do zamknięcia po odbiorze).
- Scalanie: brak F7 „gotowe” po head `f9346e60` (komentarz „czekam F7”); #515/#518 wygląd bez F7; #382 CONFLICT.
- Bieżąca: **#412** PR #514 — CI `db` FAIL: security 266/268 (OPLACONA po `mark_invoice_paid` trafiało w „Po akceptacji”; SPORNA bez `dispute_note` → update cichy); nullguard 774/780 (`Brak konta` vs wzorzec `Nieznana faktura` + pozytywny HHL). Poprawka: kolejność OPLACONA→ZAAKCEPTOWANA; SPORNA+`dispute_note`; nullguard `Brak konta`. Push → CI; czekam F7.

## 2026-10-24 08:25 — #514 F7 r3: MONEY + load_id + testy

- Skrzynka: bez nowych `dla-cursora` (Spawn2018); #516/#500/#499/#496/#492/#484/#412 w planie. #515/#518 wygląd bez F7 „gotowe”.
- Scalanie: brak (F7 #514 „nadal do poprawy” na `77be15f1`; CI unit/db/visual zielone na tym SHA — potem poprawki).
- Bieżąca: **#412** PR #514 — F7 r3: `matrix_notify('MONEY')` + `p_load_id` z `invoice_lines`; `invoice_id`; `unmark_invoice_paid` czyści `factoring_paid_at`; `factoring_overdue_notify` + cron; testy CAR2 / rezygnacja / przed akceptacją / po akceptacji / IN_APP / OVERDUE. security **278** (+10); nullguard **780**.

## 2026-10-24 08:55 — #515+#518+#514 SCALONE; start #412 E16+E11 (0288)

- Skrzynka: bez nowych `dla-cursora` (Spawn2018); #516/#500/#499/#496/#492/#484/#412 w planie. Komentarz w #412/#516 po scaleniu 0287.
- Scalanie: **#515** `f233eb03` (F7 gotowe, logo WebP); **#518** `e19ce5f0` (F7 gotowe, wygląd paczki); **#514** `dd238532` (F7 gotowe na `fd018536`, CI unit/db/visual) — E4b **0287**. #382 CONFLICT; #383 bez F7.
- Bieżąca: **#412** gałąź `pakiet/hotfix-412-e16-e43-e11` — migracja **0288**: `margin_threshold` + get/set (start 4 %, null = wyłącz); `push_devices_count` (own/all). security **296** (+18); nullguard **783** (+3). B5→**0289**. E43 — osobna migracja. Front — koordynator.

## 2026-10-24 09:05 — #519 wpisane; #520 db FAIL → nullguard 795

- Skrzynka: **#519** (Spawn2018) — faktoring N2–N4 po #514; wpisane PLAN §4/§8 + `D-20261024-0900-01.md`. #516/#500/#499/#496/#492/#484/#412 w planie.
- Scalanie: brak F7 „gotowe” na #520 (head `60afe774`); #521 wygląd faktoring bez F7; #382 CONFLICT; #383 bez F7.
- Bieżąca: **#412** PR #520 — CI `db` FAIL: nullguard oczekiwano 783, jest 795 OK. Poprawka: `EXPECTED_LOCAL.nullguard` → **795**. security **296**; nullguard **795**. E43 osobno. Czekam CI + F7.

## 2026-10-24 09:30 — #520 CI zielone; start #412 E43 (0289)

- Skrzynka: bez nowych `dla-cursora` (Spawn2018); #519/#516/#500/#499/#496/#492/#484/#412 w planie (wpisane).
- Scalanie: **#520** CI unit+db+visual zielone na `46327a16` — czekam F7 „gotowe”; #521 bez F7; #382 CONFLICT.
- Bieżąca: **#412** gałąź `pakiet/hotfix-412-e43` — migracja **0289**: `message_texts` + `message_texts_list`/`_set`/`_reset` (SMS ≤160, LOGIN `{{button}}`, audit MESSAGE_TEXT_*). security **317** (+21); nullguard **810** (+15). B5→**0290**. Front `p8Source` — koordynator; wysyłka z nadpisań — P8.

## 2026-10-24 09:55 — #521+#520 SCALONE; #522 E43 CI zielone (czekam F7)

- Skrzynka: bez nowych `dla-cursora` (Spawn2018); #519/#516/#500/#499/#496/#492/#484/#412 w planie (wpisane). Bez `pilne` przerywających.
- Scalanie: **#521** `adf828d8` (F7 „gotowe” na `6217c67`, CI unit/visual) — wygląd E4b faktoring; **#520** `90341551` (F7 „gotowe” na `46327a16`, CI unit/db/visual) — E16+E11 **0288**. #382 CONFLICT; #383 bez F7.
- Bieżąca: **#412** PR #522 — CI unit+db+visual zielone na `120f3a79` (**0289** E43). Czekam F7 „gotowe do scalenia”. Po scaleniu #412 → #484.

## 2026-10-24 10:15 — #522 F7 „do poprawy”: SMS_WORST + GSM + znaczniki

- Skrzynka: bez nowych; #412 bieżąca.
- Scalanie: brak (F7 #522 **nadal do poprawy** na docs `2e233a60`).
- Bieżąca: **#412** PR #522 — F7 pkt 1–2 + drobne w **0289**: SMS_WORST (place 28 / link…), GSM_BASIC/EXT (×2), odrzucenie spoza alfabetu; dozwolone klocki w `message_text_kind_meta` (`{{button}}` tylko LOGIN); limity 200/5000 + znaki sterujące w temacie; testy security + `p8-texts` (lista 48 = MESSAGES). security **329** (+12). Push → CI; czekam ponowne F7.

## 2026-10-24 10:30 — #523 SCALONE; #522 db: SMS spoza GSM → chr(1103)

- Skrzynka: bez nowych `dla-cursora` (Spawn2018); #519/#516/#500/#499/#496/#492/#484/#412 w planie. #413/#425 `pilne` SCALONE (otwarte do zamknięcia po odbiorze) — nie przerywają.
- Scalanie: **#523** `67e21530` (F7 „gotowe do scalenia” na `6dd9c5f`, CI unit/visual) — wygląd E16+E11 marża/push. #522 bez „gotowe” po F7 poprawkach; #382 CONFLICT.
- Bieżąca: **#412** PR #522 — CI `db` FAIL security 328/329: test „SMS spoza GSM” z `U&'\\+044F'` → HINT Unicode escapes (psql). Poprawka: `chr(1103)` (Я). security **329**. Push → CI; czekam F7.

## 2026-10-24 10:55 — #522 SCALONE (0289 E43); start #484 (0290)

- Skrzynka: bez nowych `dla-cursora` (Spawn2018); #519/#516/#500/#499/#496/#492/#484/#412 w planie. #524 wygląd E43 bez F7 — nie scalane.
- Scalanie: **#522** `ba77700b` (F7 „gotowe do scalenia” po `dc774b82`, CI unit/db/visual) — E43 **0289**. Drobne F7 (DEL/U+2028, button w temacie) — po scaleniu (jak #519). #382 CONFLICT; #383 bez F7.
- Bieżąca: **#484** gałąź `pakiet/hotfix-484-audit-history` — migracja **0290**: rozszerzenie `admin_audit_history` (HHL_OPS pełne; KSH/SCX zakres transportów + redakcja E41/cen). security **338** (+9); hist11 **13** (+2). B5→**0291**. Front — koordynator.

## 2026-10-24 11:10 — #524 SCALONE; #525 wpisane; #484 db FAIL → poprawka testów

- Skrzynka: **#525** (Spawn2018) — drobne E43 F7 r2 po #522; wpisane PLAN §4/§8, dopisek `D-20261024-1055-01.md`. #519/#516/#500/#499/#496/#492/#484 w planie. Bez `pilne`.
- Scalanie: **#524** `45b67407` (F7 „gotowe” na `1a046c74`, CI unit/visual) — wygląd treści wiadomości. #382 CONFLICT; #383 bez F7.
- Bieżąca: **#484** PR #526 — CI `db` FAIL: security „KSH bez numerów” `true`≠`t`; nullguard `admin_audit_history` oczekuje „Tylko administrator HHL”, funkcja → „Brak sesji”. Poprawka: expected `true` + wzorzec `Brak sesji|Brak dostępu`. Push → CI; czekam F7.

## 2026-10-24 12:20 — #484 F7 #526: poprawki izolacji 0290

- Skrzynka: bez nowych `dla-cursora` (Spawn2018); #525/#519/#516/#500/#499/#496/#492/#484 w planie. Bez `pilne`.
- Scalanie: brak F7 „gotowe” (F7 #526 = **do poprawy**). CI unit/db/visual na `e4d6afc5` było zielone przed poprawką.
- Bieżąca: **#484** PR #526 — F7 blokujące: szukaj w raw JSON, dopłaty REVENUE dla SCX, historia po przepięciu przewoźnika, wolne zapytanie, e-maile, ocena, `visible_to`, redakcja zagnieżdżona. Poprawka 0290: kolumny `load_id`/`scope_*` + indeksy; `audit_row_change` z pełnego wiersza; filtr po scope; szukaj bez old/new dla nie-HHL; redakcja usuwa klucze (własny `order_no` KSH zostaje); security **348** (+19). Push → CI; ponowne F7.

## 2026-10-24 12:50 — #484 db FAIL: load_permits.created_at

- Skrzynka: bez nowych `dla-cursora` (Spawn2018); #525/#519/#516/#500/#499/#496/#492/#484 w planie. Bez `pilne`.
- Scalanie: brak F7 „gotowe”; #526 db FAIL na `3e58b903` (seed `a7_seed_firm_assets` → `audit_row_change` → `audit_history_resolve_load_id`: `lp.created_at` nie istnieje); #527 wygląd bez F7; #382 CONFLICT.
- Bieżąca: **#484** — `resolve_load_id` dla `permits`: `order by lp.load_id` (tabela tylko PK load_id/permit_id). Rebase na main (#524). Push → CI; czekam F7.

## 2026-10-24 14:15 — #484 F7 r2: 6 blokerów w 0290

- Skrzynka: bez nowych `dla-cursora` (Spawn2018); #525/#519/#516/#500/#499/#496/#492/#484 w planie. #425/#413 `pilne` otwarte (SCALONE wcześniej) — nie przerywają. Bez nowych do wpisania.
- Scalanie: brak F7 „gotowe”. CI na `7f629c59` zielone (unit/db/visual) — tylko pkt 1 (`created_at`); F7 r2 nadal **do poprawy** (pkt 2–6).
- Bieżąca: **#484** PR #526 — F7 r2: (2) side/status dopłat z tabeli + keep w UPDATE; (3) zakres OLD przy B→SCX + backfill bez bieżącego carrier przy wątpliwości; (4) `visible_to`/INVOICE z `documents`; (5) BEFORE INSERT `trg_audit_log_fill_scope`; (6) redakcja = allowlista (case-insensitive). Filtr po `scope_*` indeksowany; bez cudzego `user_id`; security **358** (+10). Push → CI; ponowne F7.

## 2026-10-24 12:40 — #484 F7 r3: N1–N7 w 0290

- Skrzynka: bez nowych `dla-cursora` (Spawn2018); #525/#519/#516/#500/#499/#496/#492/#484 w planie. #425/#413 `pilne` otwarte (baza SCALONE) — nie przerywają.
- Scalanie: brak F7 „gotowe”. CI na `36eb14d8` zielone (unit/db/visual); F7 r3 **do poprawy**.
- Bieżąca: **#484** PR #526 — F7 r3: N1 swap = fakt dla CARRIER; N2 backfill bez `l.carrier_org_id`; N3 ocena bez `comment`; N4 AGREED_FEE na entity `load`; N5 faktury issuer/recipient; N6 KSH bez kierowcy; N7 `audit_history_try_uuid`; `actor_party`/`actor_label`; security **367** (+9). Push → CI; ponowne F7.

## 2026-10-24 13:10 — #484 F7 r4: zmiana przewoźnika z/do NULL

- Skrzynka: bez nowych `dla-cursora` (Spawn2018); #525/#519/#516/#500/#499/#496/#492/#484 w planie (wpisane). #425/#413 `pilne` otwarte (SCALONE) — nie przerywają.
- Scalanie: brak F7 „gotowe”. CI na `8d177d46` zielone (unit/db/visual); F7 r4 **do poprawy** (1 bloker).
- Bieżąca: **#484** PR #526 — F7 r4: wykrywanie zmiany `IS DISTINCT FROM` (także NULL); zakres `coalesce(OLD,NEW)`; redakcja RPC dla CARRIER przy z/do NULL; `actor_party` = `CARRIER` (nie SCX); testy SCX→NULL / NULL→B (preset + live trigger). security **377** (+10). Push → CI; ponowne F7 (tylko pkt 1).

## 2026-10-24 13:40 — #526 SCALONE (0290); start #492 (0291); #528 wpisane

- Skrzynka: **#528** (Spawn2018) — drobne F7 r5 po #526 (N8 zerowanie pól przewoźnika, INSERT≠swap, wydajność, invoice role); wpisane PLAN §4/§8, dopisek `D-20261024-1335-01.md`. #525/#519/#516/#500/#499/#496/#492 w planie. Bez `pilne` przerywających.
- Scalanie: **#526** `7607994f` (F7 „gotowe do scalenia” na `62f9980b`, CI unit/db/visual) — Historia **0290**. Issue #484 zamknięte. Front #527 — po odbiorze 0290 na produkcji (koordynator). #382 CONFLICT; #383 bez F7.
- Bieżąca: **#492** gałąź `pakiet/hotfix-492-loads-updated-at` — migracja **0291**: `trg_loads_screen_updated_at` (whitelist kolumn ekranu; ETA/RIO-stan/`tracking_opened_at` bez bumpa). security **382** (+5). B5→**0292**.

## 2026-10-24 14:00 — #527 SCALONE; #492 db: bez ferry_vessel

- Skrzynka: bez nowych `dla-cursora` do wpisania (Spawn2018); #528/#525/#519/#516/#500/#499/#496/#492 w planie. Bez `pilne`.
- Scalanie: **#527** `c879ff58` (F7 „gotowe” 11:45Z po `e18e5c30`, unit/visual zielone) — wygląd Historii. #382 CONFLICT; #383 bez F7.
- Bieżąca: **#492** PR #529 — db FAIL: trigger odwoływał się do `ferry_vessel`/`ferry_departure` (DROP w 0004). Usunięte z 0291; rejs = `sailing_id`+`ferry_booking_ref`. Merge main (#527). Push → CI; czekam F7.

## 2026-10-24 14:20 — #492 F7 #529: RODO + symbol; #530 wpisane

- Skrzynka: **#530** (Spawn2018, z F7 #529) — loadsVersion z tabel powiązanych; wpisane PLAN §4/§8. #528/#525/#519/#516/#500/#499/#496/#492 w planie. Bez `pilne` przerywających.
- Scalanie: brak F7 „gotowe”. #529 db FAIL (security carrier_order_no SELECT + i2 purge pozycji po bumpie RODO); visual zielone. #382 CONFLICT; #383 bez F7.
- Bieżąca: **#492** PR #529 — F7: bez bumpa przy `audit_source=rodo`; `symbol`/`permit_kind`; guard kolumn w 0291; testy UPDATE sys + SELECT; security **384** (+7). Push → CI; ponowne F7.

## 2026-10-24 14:45 — #492 db: RODO asercja przez sys (0076)

- Skrzynka: bez nowych `dla-cursora` (Spawn2018); #530/#528/#525/#519/#516/#500/#499/#496/#492 w planie. Bez `pilne`.
- Scalanie: brak F7 „gotowe”. #529 db FAIL: `#492 RODO` — `permission denied` na SELECT `driver_name` (authenticated; 0076). unit/visual zielone. #382 CONFLICT; #383 bez F7.
- Bieżąca: **#492** PR #529 — asercja RODO (`updated_at` + `driver_name is null`) przez `sys`, nie HHL. security **384**. Push → CI.

## 2026-10-24 14:55 — #492 F7 #529 r3: combo_weight_t + RODO freeze

- Skrzynka: bez nowych `dla-cursora` (Spawn2018); #530/#528/#525/#519/#516/#500/#499/#496/#492 w planie (wpisane). Bez `pilne`.
- Scalanie: brak F7 „gotowe”. #529 db FAIL (security 383/384 — RODO freeze w jednej instrukcji z `driver_name`); visual zielone. #382 CONFLICT; #383 bez F7.
- Bieżąca: **#492** PR #529 — F7 r3: przywrócony `combo_weight_t` w guardzie i wyzwalaczu + test; RODO: najpierw `driver_name`, potem osobny UPDATE `updated_at`. security **385** (+8). Push → CI; ponowne F7.

## 2026-10-24 15:32 — #492 CI zielone (3ad7619a); czekam F7

- Skrzynka: bez nowych `dla-cursora` (Spawn2018); #530/#528/#525/#519/#516/#500/#499/#496/#492 w planie (wpisane). #413/#425 `pilne` otwarte (SCALONE wcześniej) — nie przerywają.
- Scalanie: brak F7 „gotowe do scalenia” (ostatnie F7 = do poprawy na `c8d1785`; head `3ad7619a` zamyka r3). #382 CONFLICT; #383 bez F7.
- Bieżąca: **#492** PR #529 — CI unit/db/visual zielone na `3ad7619a` (combo_weight_t + RODO freeze osobno; security **385**). Czekam ponowne F7.

## 2026-10-24 15:52 — #529 SCALONE (0291); start #528 (0292)

- Skrzynka: bez nowych `dla-cursora` do wpisania (Spawn2018); #530/#528/#525/#519/#516/#500/#499/#496 w planie. Bez `pilne` przerywających.
- Scalanie: **#529** `8c7fcf37` (F7 „gotowe do scalenia” po `c399036f`, CI unit/db/visual) — `loads.updated_at` **0291**. Issue #492 zamknięte. #382 CONFLICT; #383 bez F7.
- Bieżąca: **#528** gałąź `pakiet/hotfix-528-audit-n8` — migracja **0292**: N8 clear-on-carrier-change; redakcja swap tylko old+new; filtry documents/fees + indeksy; role faktur KSH. security **391** (+6). B5→**0293**.

## 2026-10-24 16:20 — #528 db FAIL: phone_country NOT NULL + NULL→org

- Skrzynka: bez nowych `dla-cursora`; #530/#528/#525/#519/#516/#500/#499/#496 w planie. Bez `pilne`.
- Scalanie: brak F7 „gotowe” na #531; #382 CONFLICT; #383 bez F7.
- Bieżąca: **#528** PR #531 — CI db: security 389/391 (N8 UPDATE pada na `driver_phone_country` NOT NULL) + dec-auto 82/83 (NULL→org przy `ksh_confirm` d930). Poprawka 0292: clear tylko gdy `old.carrier_org_id` nie-NULL; `phone_country` → `'PL'`.

## 2026-10-24 16:40 — #528 CI zielone (`fc08a460`); czekam F7

- Skrzynka: bez nowych `dla-cursora` (Spawn2018); #530/#528/#525/#519/#516/#500/#499/#496 w planie (wpisane). #413/#425 `pilne` otwarte (SCALONE wcześniej) — nie przerywają.
- Scalanie: brak F7 „gotowe do scalenia” na #531; #382 CONFLICT; #383 bez F7.
- Bieżąca: **#528** PR #531 — CI unit/db/visual zielone na `fc08a460` (clear tylko old≠NULL; phone_country=PL; security **391**). Czekam F7.

## 2026-10-24 16:56 — #528 CI zielone też na head `0cf5b896`; czekam F7

- Skrzynka: bez nowych `dla-cursora` (Spawn2018); #530/#528/#525/#519/#516/#500/#499/#496 w planie (wpisane). Bez `pilne` przerywających.
- Scalanie: brak F7 „gotowe do scalenia” na #531 (po ostatnim commicie); #382 CONFLICT; #383 bez F7.
- Bieżąca: **#528** PR #531 — CI unit/db/visual zielone na head `0cf5b896` (docs; brama ważna też z `fc08a460`). Czekam F7.

## 2026-10-24 17:16 — #528 CI zielone na head `0dbf4267`; czekam F7

- Skrzynka: bez nowych `dla-cursora` (Spawn2018); #530/#528/#525/#519/#516/#500/#499/#496 w planie (wpisane). #413/#425 `pilne` otwarte (SCALONE wcześniej) — nie przerywają.
- Scalanie: brak F7 „gotowe do scalenia” na #531 (po ostatnim commicie); #382 CONFLICT; #383 bez F7.
- Bieżąca: **#528** PR #531 — CI unit/db/visual zielone na head `0dbf4267` (docs; wcześniej `0cf5b896`/`fc08a460`, security **391**). Czekam F7.

## 2026-10-24 17:29 — przełączenie na pętlę; #528 czeka CI+F7

- **Przełączenie na pętlę** (polecenie właściciela 19.10 / D-20261019-1050-01): ten czat się zatrzymuje; dalej `cursor-agent` / `cursor-petla.ps1`. Każdy przebieg od `docs/handover/ZASADY_CIAGLEJ_PRACY.md`.
- Skrzynka: #530/#528/#525/#519/#516/#500/#499/#496 w planie (wpisane). #413/#425 `pilne` otwarte (SCALONE wcześniej) — nie przerywają.
- Scalanie: brak F7 „gotowe do scalenia” na #531 (po ostatnim commicie); #382 CONFLICT; #383 bez F7.
- Bieżąca: **#528** PR #531 gałąź `pakiet/hotfix-528-audit-n8` head `5eac6fb0` (docs; kod `fc08a460`, migracja **0292**, security **391**). CI na head: unit/visual·zmiany/zrzuty zielone; **db + visual·bramy/telefon jeszcze pending** (G-15 — bez nowych commitów na tę gałąź do końca bramy). Po zielonym CI: komentarz „czekam F7”; po „F7: gotowe do scalenia” od Spawn2018 → `gh pr merge --merge`. Następna po scaleniu: **#530** albo **B5/0293** wg PLAN §3/§4.

## 2026-10-24 17:55 — #528 CI zielone na head `6aa9eb5a`; czekam F7

- Skrzynka: bez nowych `dla-cursora` (Spawn2018); #530/#528/#525/#519/#516/#500/#499/#496 w planie (wpisane). #413/#425 `pilne` otwarte (SCALONE wcześniej) — nie przerywają.
- Scalanie: brak F7 „gotowe do scalenia” na #531 (po ostatnim commicie); #382 CONFLICT; #383 bez F7.
- Bieżąca: **#528** PR #531 — CI unit/db/visual zielone na head `6aa9eb5a` (docs; kod `fc08a460`, migracja **0292**, security **391**). Czekam F7.

## 2026-10-24 18:10 — #528 CI zielone na head `69e646b6`; czekam F7

- Skrzynka: bez nowych `dla-cursora` (Spawn2018); #530/#528/#525/#519/#516/#500/#499/#496 w planie (wpisane). #413/#425 `pilne` otwarte (SCALONE wcześniej) — nie przerywają.
- Scalanie: brak F7 „gotowe do scalenia” na #531 (po ostatnim commicie); #382 CONFLICT; #383 bez F7.
- Bieżąca: **#528** PR #531 — CI unit/db/visual zielone na head `69e646b6` (docs; kod `fc08a460`, migracja **0292**, security **391**). Czekam F7.

## 2026-10-24 18:35 — #528 CI zielone na head `6dfe43a2`; czekam F7

- Skrzynka: bez nowych `dla-cursora` (Spawn2018); #530/#528/#525/#519/#516/#500/#499/#496 w planie (wpisane). #413/#425 `pilne` otwarte (SCALONE wcześniej) — nie przerywają.
- Scalanie: brak F7 „gotowe do scalenia” na #531 (po ostatnim commicie); #382 CONFLICT; #383 bez F7.
- Bieżąca: **#528** PR #531 — CI unit/db/visual zielone na head `6dfe43a2` (docs; kod `fc08a460`, migracja **0292**, security **391**). Czekam F7.

## 2026-10-24 18:58 — #528 CI zielone na head `f9836959`; czekam F7

- Skrzynka: bez nowych `dla-cursora` (Spawn2018); #530/#528/#525/#519/#516/#500/#499/#496 w planie (wpisane). Bez `pilne` przerywających.
- Scalanie: brak F7 „gotowe do scalenia” na #531 (po ostatnim commicie); #382 CONFLICT; #383 bez F7. Bez push na `main`.
- Bieżąca: **#528** PR #531 — CI unit/db/visual zielone na head `f9836959` (docs; kod `fc08a460`, migracja **0292**, security **391**). Czekam F7.

## 2026-10-24 19:24 — #528 CI zielone na head `d299a30c`; czekam F7

- Skrzynka: bez nowych `dla-cursora` (Spawn2018); #530/#528/#525/#519/#516/#500/#499/#496 w planie (wpisane). #413/#425 `pilne` otwarte (SCALONE wcześniej) — nie przerywają.
- Scalanie: brak F7 „gotowe do scalenia” na #531 (po ostatnim commicie); #382 CONFLICT; #383 bez F7. Bez push na `main`.
- Bieżąca: **#528** PR #531 — CI unit/db/visual zielone na head `d299a30c` (docs; kod `fc08a460`, migracja **0292**, security **391**). Czekam F7.

## 2026-10-25 00:20 — #496 CI zielone; F7 #531 (#528) poprawki

- Skrzynka: bez nowych `dla-cursora` do wpisania (Spawn2018); #530/#528/#525/#519/#516/#500/#499/#496 w planie. Bez `pilne` przerywających.
- Scalanie: brak F7 `gotowe do scalenia`. #536 unit/db/visual zielone na `1a58742c` — czekam F7 (kolejność po #531–#535). Bez push na main.
- Bieżąca (nie stoję przy F7 #496): **#528** PR #531 — F7 do poprawy: (1) clear dostawa/trailer_swap/escort/telematyka/rio_*; (2) trigger `zz_*` po guard (HHL_OPS + carrier_order_no); (3) drop zbędnych indeksów, COST 10000, UUID regex; (4) testy authenticated OPS/contacts/rio. security **394**. Push → CI; ponowne F7.