# Bezpieczeństwo bazy — decyzje, których nie wolno „poprawiać” automatycznie

## 1. Widoki cenowe działają z uprawnieniami twórcy (security definer) — CELOWO
Widoki `v_load_financials_hhl`, `v_load_price_carrier`, `v_load_price_client` (migracja `0010_money_v2.sql`)
mają `security_invoker = false, security_barrier = true`. Audyt Supabase (Security Advisor, „Security Definer View”)
oznacza je jako błąd — **to fałszywy alarm**.

**Dlaczego tak:** tabele `load_cost` i `load_revenue` są zamknięte dla klienta i przewoźnika (RLS; test
`security.sh`: „KSH nie odczyta tabeli kosztów”, „SCX nie odczyta tabeli przychodów”). Widok udostępnia każdej
stronie wyłącznie jej cenę — nigdy marży ani ceny drugiej strony. Czyta tabele jako właściciel (`postgres`),
a **wiersze filtruje sam** warunkiem w `WHERE`:

| Widok | Warunek (stan produkcji 26.09.2026) |
|---|---|
| `v_load_financials_hhl` | `can_see_margin()` — tylko HHL z prawem do marży |
| `v_load_price_carrier` | `is_hhl()` albo przewoźnik: `current_org_kind()='CARRIER'`, własny `carrier_org_id`, rola `CARRIER_DISPATCH` |
| `v_load_price_client` | `is_hhl()` albo klient: `current_org_kind()='CLIENT'`, własny projekt (`client_org_id`) |

`security_barrier = true` — warunki z zapytania użytkownika nie są wykonywane przed filtrem widoku (brak wycieku
przez funkcje w `WHERE`). Uprawnienia: `anon` — brak; `authenticated` — odczyt (widoki nie są aktualizowalne:
`is_updatable = NO`, brak wyzwalaczy INSTEAD OF, więc nadmiarowe uprawnienia zapisu z domyślnych praw nie działają).
Testy: `tests/db/money.sh` (130) i `security.sh`.

**ZAKAZ:** przełączenie tych widoków na `security_invoker = true` bez przeprojektowania. Skutek: albo klient i
przewoźnik przestają widzieć swoje ceny (RLS tabel bazowych), albo — przy „naprawie” przez otwarcie `load_cost` /
`load_revenue` — każdy zalogowany widzi koszt i przychód, czyli marżę HHL. Zmiana wymaga nowego projektu
(np. osobne tabele cen per strona z własnym RLS) i zgody właściciela.

## 2. Tabele z RLS bez polityk (8) — zamknięte dla interfejsu celowo
`rate_cards`, `rate_rules`, `baf_definitions`, `baf_index_values`, `driver_tokens`, `system_heartbeat` —
bez uprawnienia SELECT dla `anon`/`authenticated`; czytane wyłącznie przez funkcje `security definer`
(silnik stawek, token kierowcy — skrót SHA-256, podtrzymanie bazy).
**Stan po 0081/0086:** `permits` ma politykę odczytu `permits_read` (HHL + strony widzące powiązany transport), authenticated tylko SELECT; zapis wyłącznie RPC: `permit_save` (przewoźnik tylko w projekcie, w którym ma transport), `load_permit_save` (zapis + powiązanie, HHL albo przewoźnik transportu), `load_permit_link`, `load_permit_unlink` (tylko przed READY) — każde z wpisem w audit_log. Opis poniżej dotyczy stanu sprzed 0081 i pozostaje dla `insurance_policies`.
`load_escorts` (0087, pojazdy pilotujące): RLS odczytu jak `loads` (HHL + strony widzące transport), authenticated tylko SELECT, anon nic; zapis wyłącznie `load_escorts_set` (HHL albo przewoźnik transportu, audit_log ESCORTS_SET — bez danych osobowych, tylko znacznik „kontakt”). **0090 (D-22):** imię i telefon kierowcy pilota (`driver_name`, `driver_phone`) — SELECT kolumnowy authenticated BEZ tych kolumn (jak `loads` w 0076); odczyt wyłącznie `load_escort_contacts()` (HHL wszystkie, przewoźnik własne transporty, KSH/SITE_VIEWER/nieaktywni 0 wierszy); retencja 90 dni w `purge_personal_data` (licznik `piloci`). Nie przywracać tabelowego SELECT na `load_escorts`.
`permits`, `insurance_policies` — dane strukturalne (wymiary z zezwolenia, zakres polisy) na przyszły silnik
zgodności; interfejs ich nie czyta (0 wierszy dla każdego zalogowanego). **HHL widzi zezwolenia i polisy w aplikacji
jako dokumenty** (`documents`, kategorie `PERMIT_PL`, `PERMIT_SE`, `INSURANCE`; polityka `docs_read`: `is_hhl()`
widzi wszystko) — test `security.sh` [3.2f]. Jeśli strukturalne dane mają trafić do interfejsu: polityka odczytu
HHL w nowej migracji + test.

**0091 (D-23):** `carrier_ratings` — RLS: HHL wszystkie, przewoźnik własne; SELECT kolumnowy authenticated bez `comment` i `rated_by` (notatka HHL wewnętrzna); notatka tylko przez `carrier_rating_detail()` (wyłącznie HHL). `carrier_scorecard` — przewoźnik dostaje wyłącznie własny wiersz. Nie przywracać tabelowego SELECT.

## 3. Funkcje (stan po 0030)
- każda funkcja `public` ma ustaloną `search_path` (`public, extensions`) — test `security.sh` [3.2d];
- `anon` wywołuje wyłącznie: `driver_get_instructions`, `driver_post_event`, `driver_post_position`, `keep_alive`
  (lista: `tests/db/function-allowlist.txt`; funkcja spoza listy = test czerwony);
- `current_app_role`, `current_app_user_id`, `current_org_id`, `current_org_kind`, `is_hhl`, `can_see_margin` — bez `anon`;
- `loaded_confirmed` — tylko wewnętrznie (`apply_geofence_status`), bez `authenticated`.
- **0092 (III-10):** `fuel_wob_enabled`, `fuel_wob_ingest` — wyłącznie `service_role` (funkcja Edge `fuel-wob`), bez `authenticated`; ingest odmawia przy wyłączonym `security_flags.FUEL_WOB_INGEST` i przyjmuje tylko kody WOB oraz źródło `https://energy.ec.europa.eu/`. Nie nadawać `authenticated` — ręczne odczyty HHL idą przez `fuel_add_reading`.

## 4. `spatial_ref_sys` — tylko do odczytu dla ról API (W1, migracja 0031)
Na produkcji tabela i jej uprawnienia należą do `supabase_admin`: `anon` i `authenticated` miały INSERT/UPDATE/
DELETE/TRUNCATE, a REVOKE/ALTER TABLE z roli `postgres` nie działają (grantor `supabase_admin`). Rola `postgres` ma
jednak prawo TRIGGER, więc 0031 dodaje wyzwalacz na poziomie instrukcji `spatial_ref_sys_readonly`
(BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE, FOR EACH STATEMENT) → funkcja `forbid_spatial_ref_sys_mutation()`
(`search_path=''`, bez EXECUTE dla ról API) zgłasza **42501** dla `current_user` = `anon`/`authenticated`, także
gdy instrukcja nie trafia w żaden wiersz. Odczyt zostaje (PostGIS czyta tabelę z uprawnieniami wywołującego przy
`ST_Buffer`/`ST_Transform` — nie odbierać SELECT). Test bez dotykania danych: `delete … where srid = -1` jako
anon i authenticated → 42501, jako postgres → `DELETE 0` (security.sh, sekcja [W1]; produkcja sprawdzona 26.09.2026).
Nie usuwać wyzwalacza; docelowo można przenieść PostGIS do schematu `extensions` (okno serwisowe, decyzja właściciela).

## 5. Rejestracja i logowanie
Konta wyłącznie na zaproszenie: wyzwalacz `tower_on_auth_user_created` (`handle_new_auth_user`) odrzuca każdy
nowy wpis w `auth.users` bez niezaakceptowanego zaproszenia (`TOWER_NO_INVITE`) — sprawdzone 26.09 na produkcji:
link dla adresu bez zaproszenia → HTTP 500, 0 nowych kont. Ustawienie Auth „Allow new users to sign up” jest
WŁĄCZONE, bo zaproszenie działa przez `signInWithOtp(shouldCreateUser: true)` po wpisie w `user_invites`
(`UsersAdmin`); wyłączenie go zablokowałoby zapraszanie. Zob. `KOPIE_ZAPASOWE.md` / POSTEP 3.2a.

**Hasło kont „tylko link” (B, 26.09):** konto powstaje w chwili wysłania linku (`POST /auth/v1/otp`, `create_user`),
a GoTrue zakłada je ze swoim losowym hasłem tymczasowym (`internal/api/magic_link.go`: nowy lub niepotwierdzony
użytkownik → `crypto.GeneratePassword(..., 33)` → `Signup`, hasło nigdzie nie zwracane, zapis jako bcrypt `$2a$`).
My hasła nie ustawiamy (brak `admin/users` z hasłem w kodzie i skryptach); `invited_at` = NULL potwierdza, że to nie
`inviteUserByEmail`/`generateLink(invite)`. Hasło nie jest używane — logowanie wyłącznie linkiem.

**Przyjęcie i wygasanie zaproszeń (0039):** przyjęcie (`user_invites.accepted_at`, audyt `USER_ACCEPTED_INVITE`) =
pierwsze logowanie (`auth.users.last_sign_in_at` NULL → wartość, wyzwalacz `tower_on_auth_user_first_sign_in`), nie
utworzenie konta. Zadanie `tower-wygasanie-zaproszen` (02:40 UTC) wyłącza (`active = false`, audyt
`USER_INVITE_EXPIRED`) konta bez logowania starsze niż 7 dni od ostatniego zaproszenia — nieaktywne konto widzi 0
wierszy. Ponowne zaproszenie (`admin_invite_user`) reaktywuje takie konto i odnawia termin (audyt `USER_REINVITED`);
konta, które się już logowały, nie da się „zaprosić ponownie”. Wygasłe konto logujące się starym linkiem nie zostaje
przyjęte i nadal nic nie widzi.

## 6. Zdarzenia transportu (`load_events`) — lista dozwolonych typów (W2, migracja 0032)
Zdarzenia stref zmieniają status (`apply_geofence_status`), więc typy systemowe **nie mogą** przyjść przez API.
Reguła `events_insert` to **lista dozwolonych** (nowy typ = domyślnie zamknięty), `CHECK load_events_event_type_known`
wymienia wszystkie znane typy (dotyczy też `postgres` i funkcji systemowych). Nowy typ = nowa migracja z wpisem tutaj.

| Typ | Tworzy (kod) | Przez API (rola `authenticated`, transport widoczny) |
|---|---|---|
| `NOTE` | notatka w szufladzie — HHL, KSH, przewoźnik | tak |
| `MILESTONE_LOADED` | przewoźnik swojego transportu, HHL; kierowca przez `driver_post_event` (token) | tak — tylko HHL i przewoźnik transportu |
| `DOC_UPLOADED`, `PERMIT_MISMATCH` | wgranie dokumentu (`attachDocumentFile`, `addStoredDocument`) — każda rola z dostępem do dokumentów | tak |
| `AWIZACJA_UPDATED` | `updateAwizacja` w szufladzie (HHL, przewoźnik) — zapis danych chroni `loads_update` | tak (dziennik) |
| `RESOURCES_UPDATED`, `ORDER_NO_UPDATED`, `FERRY_UPDATED`, `SAILING_ASSIGNED` | szuflada: zasoby, numer zlecenia, prom/rejs — HHL, przewoźnik | tak (dziennik) |
| `SCX_ASSIGNED`, `PLAN_B_ACTIVATED`, `READY_BLOCKED`, `SCHEDULE_IMPORTED`, `SCHEDULE_DATE_CRITICAL` | przypisanie przewoźnika, plan B, blokada GOTOWY, import harmonogramu (HHL, KSH) | tak (dziennik) |
| `STATUS_<status>` (statusy UI i bazy, 24 wartości; bez `STATUS_AUTO`) | ręczna zmiana statusu (`setLoadStatus`) — sam status chroni `loads_update` | tak (dziennik) |
| `GEOFENCE_ENTER`, `GEOFENCE_EXIT`, `GEOFENCE_DWELL` | tylko `process_position` (definer) | **nigdy** |
| `STATUS_AUTO` | tylko `auto_set_status` (definer) | **nigdy** |
| `MILESTONE_UNLOADED`, `DRIVER_ON_FERRY`, `DRIVER_PROBLEM` | tylko `driver_post_event` (token kierowcy, definer) | **nigdy** |
| `POSITION_SHARED`, `POSITION_SHARE_DENIED` | tylko tryb demo (PWA bez serwera; w trybie serwera pozycje idą przez RPC) | **nigdy** |
| `DELAY_DETECTED`, `RISK_RAISED`, `SILENT_VEHICLE` | zarezerwowane (czyta je `kpi_exception_detection_lag`) | **nigdy** |

`apply_geofence_status()` bierze rodzaj i kraj strefy **wyłącznie z `geofences` po `payload->>'geofence_id'`**;
`geofence_kind` z treści jest ignorowany, nieznana strefa lub zły identyfikator → brak zmiany statusu.
Przycisk „Zdarzenie strefy” w szufladzie jest tylko w trybie demo. Produkcja 26.09.2026: 40 istniejących zdarzeń
(NOTE 22, STATUS_AUTO 5, GEOFENCE_ENTER 5, DOC_UPLOADED 3, GEOFENCE_EXIT 3, AWIZACJA_UPDATED 2) — 0 niezgodnych z CHECK.

## 7. Strażnik wyniku zadań (migracja 0035)
`cron.job_run_details` = „succeeded” oznacza tylko wysłanie zapytania pg_net (ferry-ais z 403 był „succeeded”).
Źródło prawdy: `integration_runs.ok` (ferry-*, road-*, traffic-flow, **usage-check** — zapisuje od 26.09) i
`backup_runs.status='OK'`. Zadanie cron `tower-straznik-zadan` (co godzinę, :07) → `job_watchdog()`:
ferry-ais 30 min, usage-check 26 h (uzbrojony od 27.09 06:00 PL), kopia 26 h — **uzbrajana po pierwszej udanej
kopii** (R2 nieskonfigurowane → brak fałszywych alarmów; po włączeniu R2 i pierwszej kopii pilnuje sam).
Alarm: ryzyko `JOB_FAILURE` HIGH (widzi tylko HHL), jeden na incydent, zamykane po powrocie udanych przebiegów;
e-mail przez pg_net → Resend (Vault: `resend_api_key`, `mail_from`, `alert_email_to`) — niezależny od funkcji Edge.
Funkcje bez EXECUTE dla ról API. Test: `tests/db/watchdog.sh` (19), produkcja — transakcja wycofana.

## 8. Widoczność wiadomości i pozycji harmonogramu (W3, 0037) oraz limity zasobników (W4, 0038)
`msgs_read`: HHL albo (rodzaj firmy w `visible_to` **i** transport widoczny przez RLS `loads`).
`items_read`: HHL; klient — pozycje projektów, których jest klientem (także bez transportu); przewoźnik — tylko pozycje
na swoich transportach (pozycji bez transportu nie widzi). Zasobniki: `zdjecia` 2 MB, `dokumenty` 10 MB, `faktury` 10 MB
(0040, decyzja właściciela 26.09: jak wszystkie PDF; `create_document` i kreator faktury — błąd `PDF_SIZE` — też 10 MB).

## 9. Retencja dziennika przebiegów (0041)
`tower-retencja-przebiegow` (02:50 UTC, `purge_integration_runs`): `integration_runs` udane > 30 dni i nieudane > 180 dni
są usuwane; ostatni udany przebieg każdego zadania zostaje zawsze (strażnik 0035 liczy od niego okno). Funkcja tylko
dla zadań systemowych (bez EXECUTE dla anon/authenticated).

## 10. SharePoint KSH (A6, E38) — sekrety tylko po stronie serwera
Nazwy w `.env.local` i w sekretach Edge (bez `VITE_`): `SHAREPOINT_TENANT_ID`, `SHAREPOINT_CLIENT_ID`, `SHAREPOINT_CLIENT_SECRET`, `SHAREPOINT_FILE_URL`, `SHAREPOINT_TEST_FILE_URL`. Opcjonalnie `SHAREPOINT_FILE_MODE=test` na TEST (wtedy odczyt z pliku testowego). Wartości nigdy w repozytorium, zgłoszeniach, logach CI, `POSTEP` ani w paczce przeglądarki. Logi Edge: tylko status HTTP i liczby bajtów (stałe powody `network_*` / `file_too_large` — bez URL i `e.message`). Zapis do pliku: `ksh_sync_state.write_enabled` (domyślnie wyłączony; kolejka `ksh_sync_outbound` — daty/numery bez PII; konflikt gdy wiersz pliku ≠ expected → sprawa, bez nadpisania). Import z pliku: `import_enabled` (domyślnie wyłączony = tylko dry_run). Brak sekretów → przebieg `DEMO` ok, bez `SOURCE_DOWN`. Projekt synchronizacji: stały kod `STEGRA_BODEN` (fallback `STEGRA` w seed/CI) — nie `order by id limit 1`. `ksh_sync_state_get` tylko dla projektu o tym kodzie (bez „ostatniego wiersza” bez filtra). Dedup hasha pliku tylko po **udanym** przebiegu; błąd importu/parse zapisuje `failed_hash`, żeby ten sam plik był ponowiony. `SOURCE_DOWN:KSH_SHAREPOINT` — 30 min od `first_error_at` w `last_run` (nie od razu przy pierwszym nieudanym po wdrożeniu sekretów). Job `ksh-sharepoint-sync` zapisuje wiersz `integration_runs` także przy pliku bez zmian (co 5 min, jak inne joby) — retencja jak w §9 (`purge_integration_runs`: udane > 30 dni, nieudane > 180 dni).
