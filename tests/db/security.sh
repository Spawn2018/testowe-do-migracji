#!/usr/bin/env bash
# TOWER — test bezpieczeństwa bazy. Podszywa się pod HHL, KSH i SCX
# i sprawdza, czego baza NIE pozwala zobaczyć ani zmienić.
# Użycie: PGURL=postgres://postgres@localhost:5433/tower bash tests/db/security.sh
. "$(git rev-parse --show-toplevel)/tests/db/refuse-prod.sh"
PSQL="psql ${PGURL:-postgres://postgres@localhost:5433/tower} -Atq"
HHL=11111111-0000-0000-0000-000000000001; KSH=11111111-0000-0000-0000-000000000002; SCX=11111111-0000-0000-0000-000000000003
INVK=44444444-0000-0000-0000-00000000000c; INVP=44444444-0000-0000-0000-0000000000ee
L1=33333333-0000-0000-0000-000000000001; L2=33333333-0000-0000-0000-000000000002
ok=0; fail=0
run() { # uid, sql, commit?  → stdout, kod wyjścia
  local end="rollback"; [ "$3" = "commit" ] && end="commit"
  $PSQL -v ON_ERROR_STOP=1 -c "begin; set local role authenticated; set local request.jwt.claim.sub='$1'; $2; $end;" 2>&1
}
val()  { out=$(run "$2" "$3" "$5" | grep -v -E '^(BEGIN|SET|ROLLBACK|COMMIT)$' | tail -1)
         if [ "$out" = "$4" ]; then ok=$((ok+1)); echo "  OK    $1"; else fail=$((fail+1)); echo "  FAIL  $1  (otrzymano: $out, oczekiwano: $4)"; fi; }
err()  { out=$(run "$2" "$3"); if echo "$out" | grep -qiE "$4"; then ok=$((ok+1)); echo "  OK    $1"; else fail=$((fail+1)); echo "  FAIL  $1  →  $(echo "$out" | tail -1)"; fi; }
sys()  { $PSQL -v ON_ERROR_STOP=1 -c "$1" 2>&1; }

echo; echo "[1] Widoczność faktur"
val "HHL widzi obie faktury"                         $HHL "select count(*) from invoices" 2
val "KSH widzi tylko fakturę HHL (przychodową)"      $KSH "select string_agg(direction,',') from invoices" PRZYCHOD
val "SCX widzi tylko swoją fakturę (kosztową)"       $SCX "select string_agg(direction,',') from invoices" KOSZT
val "KSH nie widzi pozycji faktury kosztowej"        $KSH "select count(*) from invoice_lines where direction='KOSZT'" 0
val "SCX nie widzi pozycji faktury przychodowej"     $SCX "select count(*) from invoice_lines where direction='PRZYCHOD'" 0

echo; echo "[2] Rozdzielenie cen (z migracji 0001; E19/P3 0196: SELECT + RLS zamiast permission denied)"
val "KSH nie widzi wierszy w load_cost (RLS)"        $KSH "select count(*) from load_cost" 0
val "SCX nie widzi wierszy w load_revenue (RLS)"     $SCX "select count(*) from load_revenue" 0

echo; echo "[3] Kto może zmieniać co na fakturze"
err "KSH nie zmieni kwoty faktury HHL"               $KSH "update invoices set net_total=1 where id='$INVP'" "weryfikowa|KSH nie|Edytuj fakturę"
val "KSH może oznaczyć fakturę HHL jako sporną"      $KSH "with u as (update invoices set verification_status='SPORNA', dispute_note='test' where id='$INVP' returning 1) select count(*) from u" 1
val "KSH nie dosięgnie faktury kosztowej"            $KSH "with u as (update invoices set dispute_note='x' where id='$INVK' returning 1) select count(*) from u" 0
err "SCX nie zweryfikuje własnej faktury"            $SCX "update invoices set verification_status='ZAAKCEPTOWANA' where id='$INVK'" "Wystawca nie weryfikuje"

echo; echo "[4] Status Opłacona — wyłącznie HHL"
err "SCX nie zmieni statusu płatności bezpośrednio"  $SCX "update invoices set payment_status='OPLACONA' where id='$INVK'" "permission denied"
err "SCX nie wywoła oznaczenia płatności"            $SCX "select mark_invoice_paid('$INVK','2026-10-20')" "wyłącznie HHL"
err "KSH nie wywoła oznaczenia płatności"            $KSH "select mark_invoice_paid('$INVP','2026-10-20')" "wyłącznie HHL"
run $HHL "select mark_invoice_paid('$INVK','2026-10-20')" commit >/dev/null
val "HHL oznacza fakturę kosztową jako opłaconą"     $HHL "select payment_status||' '||paid_at from invoices where id='$INVK'" "OPLACONA 2026-10-20"
val "wpis w dzienniku audytu"                        $HHL "select count(*) from audit_log where action='INVOICE_MARK_PAID'" 1
err "cofnięcie bez powodu odrzucone"                 $HHL "select unmark_invoice_paid('$INVK','')" "powód"

echo; echo "[5] Termin płatności"
err "użytkownik nie wywoła odświeżania terminów"      $HHL "select refresh_payment_status('2099-01-01')" "permission denied"
out=$(sys "select refresh_payment_status('2026-10-29')"); [ "$(echo "$out"|tail -1)" = "1" ] && { ok=$((ok+1)); echo "  OK    zadanie systemowe: nieopłacona po terminie → PO_TERMINIE"; } || { fail=$((fail+1)); echo "  FAIL  odświeżenie: $out"; }
sys "update invoices set due_date='2026-11-15' where id='$INVP'" >/dev/null
out=$(sys "select refresh_payment_status('2026-10-29')"); [ "$(sys "select payment_status from invoices where id='$INVP'")" = "NIEOPLACONA" ] && { ok=$((ok+1)); echo "  OK    termin przesunięty z dokumentu → wraca do NIEOPLACONA"; } || { fail=$((fail+1)); echo "  FAIL  powrót statusu"; }
val "opłacona nie przechodzi na PO_TERMINIE"         $HHL "select payment_status from invoices where id='$INVK'" OPLACONA

echo; echo "[6] Numery zleceń obowiązkowe"
out=$(sys "update loads set status='READY' where id='$L2'"); echo "$out" | grep -q "numeru zlecenia HHL" && { ok=$((ok+1)); echo "  OK    status READY bez numeru HHL odrzucony"; } || { fail=$((fail+1)); echo "  FAIL  READY bez numeru HHL: $out"; }
sys "update loads set hhl_order_no='HHL/2026/0002', status='READY' where id='$L2'" >/dev/null
out=$(sys "update loads set status='AT_LOADING' where id='$L2'"); echo "$out" | grep -q "przewoźnika" && { ok=$((ok+1)); echo "  OK    załadunek bez numeru przewoźnika odrzucony"; } || { fail=$((fail+1)); echo "  FAIL  $out"; }
val "SCX wpisuje swój numer zlecenia"                $SCX "with u as (update loads set carrier_order_no='SCX-7781' where id='$L2' returning 1) select count(*) from u" 1 commit
val "KSH nie wpisze numeru przewoźnika"              $KSH "with u as (update loads set carrier_order_no='X' where id='$L2' returning 1) select count(*) from u" 0
out=$(sys "update loads set hhl_order_no='HHL/2026/0002' where id='$L1'"); echo "$out" | grep -qi "duplicate\|unique" && { ok=$((ok+1)); echo "  OK    numer zlecenia HHL unikalny w projekcie"; } || { fail=$((fail+1)); echo "  FAIL  duplikat numeru: $out"; }

echo; echo "[7] Podwójne fakturowanie"
out=$(sys "insert into invoice_lines (invoice_id, load_id, direction) values ('$INVP','$L1','KOSZT')"); echo "$out" | grep -qi "duplicate\|unique" && { ok=$((ok+1)); echo "  OK    ten sam transport dwa razy po stronie kosztu — zablokowane"; } || { fail=$((fail+1)); echo "  FAIL  $out"; }

echo; echo "[8] Waluty"
val "KSH ustawia sobie wyświetlanie w PLN"           $KSH "with i as (insert into user_preferences (user_id, display_currency) select id,'PLN' from app_users where auth_id='$KSH' returning 1) select count(*) from i" 1 commit
run $HHL "insert into user_preferences (user_id) select id from app_users where auth_id='$HHL'" commit >/dev/null
val "KSH widzi wyłącznie własne ustawienia"          $KSH "select count(*) from user_preferences" 1
err "waluta wyświetlania SEK odrzucona"              $KSH "update user_preferences set display_currency='SEK'" "check constraint"
out=$(sys "update invoices set currency='SEK' where id='$INVP'"); echo "$out" | grep -qi "check constraint" && { ok=$((ok+1)); echo "  OK    faktura w SEK odrzucona"; } || { fail=$((fail+1)); echo "  FAIL  $out"; }
val "faktura w PLN dopuszczona"                      $HHL "select currency from invoices where id='$INVK'" PLN

echo; echo "[9] Spór i weryfikacja — decyzje Q7 i Q14"
err "spór bez uzasadnienia odrzucony"                $KSH "update invoices set verification_status='SPORNA', dispute_note=null where id='$INVP'" "uzasadnienia"
err "HHL nie zmieni statusu weryfikacji własnej faktury dla KSH" $HHL "update invoices set verification_status='ZAAKCEPTOWANA' where id='$INVP'" "Wystawca nie weryfikuje"
val "HHL weryfikuje fakturę kosztową od SCX"         $HHL "with u as (update invoices set verification_status='ZGODNA' where id='$INVK' returning 1) select count(*) from u" 1

echo; echo "[10] Warunki płatności — 30 dni KSH, 35 dni SCX, widoczne tylko stronom"
val "HHL widzi obie relacje"                         $HHL "select string_agg(term_days::text,',' order by term_days) from payment_terms" "30,35"
val "KSH widzi tylko swoją relację (30 dni)"         $KSH "select string_agg(term_days::text,',') from payment_terms" 30
val "SCX widzi tylko swoją relację (35 dni)"         $SCX "select string_agg(term_days::text,',') from payment_terms" 35
val "KSH nie zmieni warunków płatności"              $KSH "with u as (update payment_terms set term_days=90 returning 1) select count(*) from u" 0

echo; echo "[11] Kto zmienia co w transporcie — ślepa plamka testów do 24.09"
err "SCX nie zmieni numeru zlecenia HHL"              $SCX "update loads set hhl_order_no='PODROBIONY' where id='$L2'" "nie może zmieniać: hhl_order_no"
err "SCX nie zmieni numeru zlecenia KSH"              $SCX "update loads set order_no='PODROBIONY' where id='$L2'" "nie może zmieniać: order_no"
err "SCX nie przepnie transportu do innego projektu"  $SCX "update loads set project_id=gen_random_uuid() where id='$L2'" "nie może zmieniać"
err "SCX nie zmieni planowanego okna dostawy"         $SCX "update loads set plan_delivery_from='2026-10-20 08:00+00' where id='$L2'" "nie może zmieniać: plan_delivery_from"
err "SCX nie zmieni planowanego okna załadunku"       $SCX "update loads set plan_load_to='2026-10-20 08:00+00' where id='$L2'" "nie może zmieniać: plan_load_to"
val "SCX zmienia dane kierowcy we własnym transporcie" $SCX "with u as (update loads set driver_name='Jonas Lindqvist' where id='$L2' returning 1) select count(*) from u" 1
err "SCX nie anuluje transportu"                       $SCX "update loads set status='CANCELLED' where id='$L2'" "wyłącznie HHL|load_status_set|cancel_load"
# D-1525 (#364): HHL_ADMIN może carrier_order_no; HHL_OPS nie; SCX — trailer_swap + SE
OPS_D1525=11111111-0000-0000-0000-0000000000d5
sys "insert into app_users (auth_id, org_id, email, role, active)
     values ('$OPS_D1525','00000000-0000-0000-0000-00000000a001','ops-d1525@test','HHL_OPS',true)
     on conflict (auth_id) do update set role='HHL_OPS', active=true, org_id=excluded.org_id" >/dev/null
val "HHL_ADMIN ustawia carrier_order_no (D-1525)"      $HHL "with u as (update loads set carrier_order_no='HHL-ADMIN-SCX' where id='$L2' returning 1) select count(*) from u" 1 commit
val "HHL_ADMIN czyści carrier_order_no (D-1525)"       $HHL "with u as (update loads set carrier_order_no=null where id='$L2' returning 1) select count(*) from u" 1 commit
err "HHL_OPS nie zmieni carrier_order_no (D-1525)"     $OPS_D1525 "update loads set carrier_order_no='OPS-X' where id='$L2'" "wyłącznie przewoźnik"
# Puste SE: name/phone/plate null; phone_country NOT NULL — ekran zawsze 'PL'/'SE' (F7 #367 B1).
val "SCX zapisuje trailer_swap z pustym SE (D-1525)"   $SCX "with u as (update loads set trailer_swap=true, driver_delivery_name=null, driver_delivery_phone=null, driver_delivery_phone_country='PL', tractor_delivery_plate=null, driver_phone_country='PL' where id='$L2' returning 1) select count(*) from u" 1 commit
val "SCX zapisuje trailer_swap z SE (D-1525)"          $SCX "with u as (update loads set trailer_swap=true, driver_delivery_name='Erik SE', driver_delivery_phone='0700111222', driver_delivery_phone_country='SE', tractor_delivery_plate='ABC123', driver_phone_country='PL' where id='$L2' returning 1) select count(*) from u" 1 commit
val "HHL zmienia swój numer zlecenia"                  $HHL "with u as (update loads set hhl_order_no='HHL/2026/0777' where id='$L2' returning 1) select count(*) from u" 1
err "rozładunek bez daty / bezpośredni UPDATE (A5)"   $HHL "update loads set status='UNLOADED' where id='$L1'" "wymaga daty rozładunku|load_status_set"
err "SCX nie zmieni daty rozładunku transportu na fakturze" $SCX "update loads set actual_delivery_at='2026-09-20 10:00+00' where id='$L1'" "zamrożona|load_status_set"
# A5: actual_delivery_at tylko przez load_status_set; DELIVERED wymaga numerów (enforce_order_numbers)
sys "update loads set hhl_order_no='HHL/SEC-L1', carrier_order_no='SCX/SEC-L1' where id='$L1'" >/dev/null
val "HHL zmienia datę rozładunku zafakturowanego — z audytem" $HHL "select load_status_set('$L1','DELIVERED',timestamptz '2026-09-24 10:00+00','korekta daty'); select 1" 1 commit
val "zmiana daty rozładunku zapisana w dzienniku"      $HHL "select count(*) from audit_log where action='LOAD_STATUS_SET' and entity_id='$L1'" 1

echo; echo "[6.1] EXECUTE — lista dozwolonych funkcji (tests/db/function-allowlist.txt)"
CAT=$(psql "$PGURL" -Atq -c "select r||' '||p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace cross join unnest(array['anon','authenticated']) r where n.nspname='public' and not exists (select 1 from pg_depend d where d.objid=p.oid and d.deptype='e') and has_function_privilege(r, p.oid, 'execute') group by 1 order by 1" | tr -d '\r')
LIST=$(grep -vE '^\s*(#|$)' tests/db/function-allowlist.txt | awk '{print $1" "$2}' | tr -d '\r' | sort -u)
EXTRA=$(comm -23 <(echo "$CAT" | sort -u) <(echo "$LIST") | tr '\n' ';')
chk6() { if [ "$2" = "$3" ]; then ok=$((ok+1)); echo "  OK    $1"; else fail=$((fail+1)); echo "  FAIL  $1  (otrzymano: $2, oczekiwano: $3)"; fi; }
chk6 "anon/authenticated wywołają wyłącznie funkcje z listy" "${EXTRA:-brak}" "brak"
chk6 "PUBLIC nie wywoła żadnej funkcji public (poza rozszerzeniami)" "$(psql "$PGURL" -Atq -c "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and not exists (select 1 from pg_depend d where d.objid=p.oid and d.deptype='e') and exists (select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a where a.grantee = 0 and a.privilege_type='EXECUTE')")" 0
psql "$PGURL" -q -c "create function public.t_nowa_funkcja() returns int language sql as 'select 1'" >/dev/null 2>&1
chk6 "nowa funkcja (domyślne uprawnienia): anon i authenticated bez EXECUTE" "$(psql "$PGURL" -Atq -c "select has_function_privilege('anon','public.t_nowa_funkcja()','execute')||':'||has_function_privilege('authenticated','public.t_nowa_funkcja()','execute')")" "false:false"
psql "$PGURL" -q -c "drop function public.t_nowa_funkcja()" >/dev/null 2>&1
# I-26 (0083): anon bez uprawnień tabelowych w public (poza spatial_ref_sys), authenticated bez TRUNCATE/REFERENCES/TRIGGER
chk6 "I-26: anon — 0 uprawnień do tabel/widoków public (poza spatial_ref_sys)" "$(psql "$PGURL" -Atq -c "select count(*) from information_schema.role_table_grants where grantee='anon' and table_schema='public' and table_name <> 'spatial_ref_sys'")" 0
chk6 "I-26: anon — 0 uprawnień do sekwencji public" "$(psql "$PGURL" -Atq -c "select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='S' and (has_sequence_privilege('anon', c.oid, 'usage') or has_sequence_privilege('anon', c.oid, 'select') or has_sequence_privilege('anon', c.oid, 'update'))")" 0
chk6 "I-26: authenticated — 0 × TRUNCATE/REFERENCES/TRIGGER w public (poza spatial_ref_sys)" "$(psql "$PGURL" -Atq -c "select count(*) from information_schema.role_table_grants where grantee='authenticated' and table_schema='public' and table_name <> 'spatial_ref_sys' and privilege_type in ('TRUNCATE','REFERENCES','TRIGGER')")" 0
psql "$PGURL" -q -c "create table public.t_nowa_tabela (id int); create sequence public.t_nowa_sekw" >/dev/null 2>&1
chk6 "I-26: nowa tabela i sekwencja (domyślne uprawnienia): anon nic, authenticated bez TRUNCATE" "$(psql "$PGURL" -Atq -c "select has_table_privilege('anon','public.t_nowa_tabela','select,insert,update,delete,truncate')::text||':'||has_sequence_privilege('anon','public.t_nowa_sekw','usage')::text||':'||has_table_privilege('authenticated','public.t_nowa_tabela','truncate')::text")" "false:false:false"
psql "$PGURL" -q -c "drop table public.t_nowa_tabela; drop sequence public.t_nowa_sekw" >/dev/null 2>&1
err "I-26: anon INSERT do loads → permission denied" "" "set local role anon; insert into loads (id) values (gen_random_uuid())" "permission denied"
chk6 "purge_personal_data: brak EXECUTE dla anon i authenticated" "$(psql "$PGURL" -Atq -c "select has_function_privilege('anon','purge_personal_data(int)','execute')||':'||has_function_privilege('authenticated','purge_personal_data(int)','execute')")" "false:false"

echo; echo "[3.2d] Higiena funkcji (0030)"
chk6 "każda funkcja public ma ustaloną search_path" "$(psql "$PGURL" -Atq -c "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind in ('f','p') and not exists (select 1 from unnest(coalesce(p.proconfig,'{}')) c where c like 'search_path=%') and not exists (select 1 from pg_depend d where d.objid=p.oid and d.deptype='e')")" 0
chk6 "anon nie wywoła current_app_role/current_app_user_id/current_org_id/current_org_kind" "$(psql "$PGURL" -Atq -c "select bool_or(has_function_privilege('anon', f, 'execute')) from unnest(array['current_app_role()','current_app_user_id()','current_org_id()','current_org_kind()']::regprocedure[]) f")" f
chk6 "zalogowany nie wywoła loaded_confirmed (tylko wewnętrzna)" "$(psql "$PGURL" -Atq -c "select has_function_privilege('authenticated','loaded_confirmed(uuid)','execute')")" f

echo; echo "[3.2f] Zezwolenia i polisy — HHL widzi je jako dokumenty; tabele strukturalne zamknięte dla interfejsu"
psql "$PGURL" -q -c "insert into documents (project_id, load_id, category, storage_path, file_name) values
  ('22222222-0000-0000-0000-000000000001','33333333-0000-0000-0000-000000000001','PERMIT_PL','dokumenty/t/p.pdf','zezwolenie.pdf'),
  ('22222222-0000-0000-0000-000000000001',null,'INSURANCE','dokumenty/t/i.pdf','polisa.pdf')" >/dev/null 2>&1
val "HHL widzi zezwolenie i polisę (documents)"          $HHL "select count(*) from documents where category in ('PERMIT_PL','INSURANCE')" 2
# A7: seed 13/GD/2026 — HHL widzi zezwolenia (permits_read / is_hhl, 0081); polisy nadal bez SELECT tabeli.
val "permits: 1 wiersz dla HHL (A7 FIRMA); insurance_policies: bez SELECT dla authenticated (0097 — tylko przez listę)" $HHL "select (select count(*) from permits)||':'||has_table_privilege('authenticated','public.insurance_policies','select')::text" "1:false"
chk6 "driver_tokens, system_heartbeat: brak SELECT dla anon/authenticated; rate_cards, rate_rules: brak SELECT dla anon (I-19/0065: authenticated czyta, RLS tylko HHL); baf_* usunięte (I-14/0066)" "$(psql "$PGURL" -Atq -c "select bool_or(has_table_privilege(r, 'public.'||t, 'select')) or (select bool_or(has_table_privilege('anon', 'public.'||t, 'select')) from unnest(array['rate_cards','rate_rules']) t) or to_regclass('public.baf_definitions') is not null from unnest(array['driver_tokens','system_heartbeat']) t cross join unnest(array['anon','authenticated']) r")" f

echo; echo "[W1] spatial_ref_sys tylko do odczytu dla ról API (0031) — test bez dotykania danych"
if [ -n "${TOWER_HOSTED_READY:-}" ]; then
  # Hosted free: brak TRIGGER/OWNER na spatial_ref_sys → migracja 0031 nie zakłada wyzwalacza.
  # Asercji lokalnych NIE luzujemy — tu jawny SKIP (nie FAIL).
  echo "  SKIP  anon/authenticated DELETE/UPDATE spatial_ref_sys (hosted free: brak uprawnień do triggera 0031)"
  echo "  SKIP  postgres DELETE spatial_ref_sys (hosted free: permission denied dla właściciela PostGIS)"
  chk6 "odczyt spatial_ref_sys dla authenticated działa (PostGIS)"  "$(psql "$PGURL" -Atq -c "begin; set local role authenticated; select count(*) > 0 from public.spatial_ref_sys where srid = 4326; rollback;" 2>&1 | grep -vE '^(BEGIN|SET|ROLLBACK)$' | tr -d '\r')" t
  # Raport dla bramy: czy trigger istnieje (na hosted free zwykle nie)
  if [ "$(psql "$PGURL" -Atq -c "select count(*) from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='spatial_ref_sys' and t.tgname='spatial_ref_sys_readonly'" | tr -d '\r')" = "0" ]; then
    echo "  RAPORT  spatial_ref_sys_readonly: brak na hosted — asercja zapisu niesprawdzalna tutaj (lokalnie nadal wymagana)"
  fi
else
  err "anon: DELETE spatial_ref_sys (0 wierszy) → 42501"          "" "set local role anon; delete from public.spatial_ref_sys where srid = -1" "tylko do odczytu"
  err "authenticated: DELETE spatial_ref_sys (0 wierszy) → 42501" $HHL "delete from public.spatial_ref_sys where srid = -1" "tylko do odczytu"
  err "authenticated: UPDATE/INSERT/TRUNCATE → 42501"               $HHL "update public.spatial_ref_sys set auth_name = auth_name where srid = -1" "tylko do odczytu"
  chk6 "postgres: DELETE (0 wierszy) przechodzi"                    "$(psql "$PGURL" -Atq -c "begin; delete from public.spatial_ref_sys where srid = -1; rollback;" 2>&1 | tr -d '\n')" ""
  chk6 "odczyt spatial_ref_sys dla authenticated działa (PostGIS)"  "$(psql "$PGURL" -Atq -c "begin; set local role authenticated; select count(*) > 0 from public.spatial_ref_sys where srid = 4326; rollback;" 2>&1 | grep -vE '^(BEGIN|SET|ROLLBACK)$')" t
fi

echo; echo "[W2] Zdarzenia: lista dozwolonych typów dla ról API, CHECK, strefa z tabeli (0032)"
err "KSH: GEOFENCE_ENTER do swojego transportu — odrzucone"       $KSH "insert into load_events (load_id,event_type,occurred_at) values ('$L1','GEOFENCE_ENTER',now())" "row-level security"
err "przewoźnik: GEOFENCE_ENTER do swojego transportu — odrzucone" $SCX "insert into load_events (load_id,event_type,occurred_at) values ('$L1','GEOFENCE_ENTER',now())" "row-level security"
err "przewoźnik: STATUS_AUTO — odrzucone"                         $SCX "insert into load_events (load_id,event_type,occurred_at) values ('$L1','STATUS_AUTO',now())" "row-level security"
err "przewoźnik: MILESTONE_UNLOADED — odrzucone"                  $SCX "insert into load_events (load_id,event_type,occurred_at) values ('$L1','MILESTONE_UNLOADED',now())" "row-level security"
val "przewoźnik: NOTE nadal dozwolone"                            $SCX "with i as (insert into load_events (load_id,event_type,occurred_at) values ('$L1','NOTE',now()) returning 1) select count(*) from i" 1
val "KSH: DOC_UPLOADED nadal dozwolone"                           $KSH "with i as (insert into load_events (load_id,event_type,occurred_at) values ('$L1','DOC_UPLOADED',now()) returning 1) select count(*) from i" 1
out=$(sys "begin; insert into load_events (load_id,event_type,occurred_at) values ('$L1','COKOLWIEK',now()); rollback;"); echo "$out" | grep -q "load_events_event_type_known" && { ok=$((ok+1)); echo "  OK    nieznany typ odrzucony przez CHECK (także dla postgres)"; } || { fail=$((fail+1)); echo "  FAIL  nieznany typ: $out"; }
GW="insert into geofences (id,project_id,name,kind,geom,hysteresis_m,dwell_seconds,debounce_fixes,country) values
 ('99999999-0000-0000-0000-0000000000a1','22222222-0000-0000-0000-000000000001','W2 załadunek','LOADING',make_circle_fence(52.09,17.02,800),200,0,2,'PL'),
 ('99999999-0000-0000-0000-0000000000a2','22222222-0000-0000-0000-000000000001','W2 plac','SITE',make_circle_fence(65.80,21.75,1500),300,0,2,'SE');
 insert into loads (id,project_id,carrier_org_id,order_no,hhl_order_no,carrier_order_no,status) values
 ('99999999-0000-0000-0000-0000000000b1','22222222-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000a003','KSH/W2','HHL/W2','SCX/W2','READY');"
out=$(sys "begin; $GW insert into load_events (load_id,event_type,occurred_at,payload) values ('99999999-0000-0000-0000-0000000000b1','GEOFENCE_ENTER',now(),
 '{\"geofence_id\":\"99999999-0000-0000-0000-0000000000a1\",\"geofence_kind\":\"SITE\"}'); select status from loads where id='99999999-0000-0000-0000-0000000000b1'; rollback;" | grep -vE '^(BEGIN|ROLLBACK|INSERT.*)$' | tail -1)
[ "$out" = "AT_LOADING" ] && { ok=$((ok+1)); echo "  OK    strefa LOADING z treścią SITE → AT_LOADING (wg tabeli)"; } || { fail=$((fail+1)); echo "  FAIL  niezgodny geofence_kind (1): $out"; }
out=$(sys "begin; $GW insert into load_events (load_id,event_type,occurred_at,payload) values ('99999999-0000-0000-0000-0000000000b1','GEOFENCE_ENTER',now(),
 '{\"geofence_id\":\"99999999-0000-0000-0000-0000000000a2\",\"geofence_kind\":\"LOADING\"}'); select status from loads where id='99999999-0000-0000-0000-0000000000b1'; rollback;" | grep -vE '^(BEGIN|ROLLBACK|INSERT.*)$' | tail -1)
# A10 F7: status nie z automatu nie jest cofany — READY zostaje; SITE≠LOADING → bez zmian.
[ "$out" = "READY" ] && { ok=$((ok+1)); echo "  OK    strefa SITE z treścią LOADING → status bez zmian (wg tabeli)"; } || { fail=$((fail+1)); echo "  FAIL  niezgodny geofence_kind (2): $out"; }

echo; echo "[0034] Zaproszenie ważne 7 dni (wyzwalacz nowego konta; atrapa auth.users w transakcji)"
if [ -n "${TOWER_HOSTED_READY:-}" ]; then
  # Hosted: prawdziwa auth.users (bez CREATE TABLE w schemacie auth). Wyzwalacz z migracji 0006.
  AU="drop trigger if exists tower_on_auth_user_created on auth.users;
 create trigger tower_on_auth_user_created after insert on auth.users for each row execute function public.handle_new_auth_user();"
else
  AU="create table if not exists auth.users (id uuid primary key default gen_random_uuid(), email text);
 drop trigger if exists tower_on_auth_user_created on auth.users;
 create trigger tower_on_auth_user_created after insert on auth.users for each row execute function public.handle_new_auth_user();"
fi
INV="insert into user_invites (email, org_id, role, created_at) values ('nowy@test', '00000000-0000-0000-0000-00000000a001', 'HHL_OPS', now() - interval"
out=$(sys "begin; $AU $INV '8 days'); insert into auth.users (id, email) values (gen_random_uuid(), 'nowy@test'); rollback;")
echo "$out" | grep -q "TOWER_INVITE_EXPIRED" && { ok=$((ok+1)); echo "  OK    zaproszenie sprzed 8 dni → odrzucone (TOWER_INVITE_EXPIRED)"; } || { fail=$((fail+1)); echo "  FAIL  wygasłe zaproszenie: $out"; }
out=$(sys "begin; $AU $INV '6 days 23 hours'); insert into auth.users (id, email) values (gen_random_uuid(), 'nowy@test'); select role from app_users where email='nowy@test'; rollback;" | grep -vE '^(BEGIN|ROLLBACK|INSERT.*|CREATE.*|DROP.*)$' | tail -1)
[ "$out" = "HHL_OPS" ] && { ok=$((ok+1)); echo "  OK    zaproszenie sprzed 6 dni 23 h → konto z rolą z zaproszenia"; } || { fail=$((fail+1)); echo "  FAIL  ważne zaproszenie: $out"; }
out=$(sys "begin; $AU insert into auth.users (id, email) values (gen_random_uuid(), 'obcy@test'); rollback;")
echo "$out" | grep -q "TOWER_NO_INVITE" && { ok=$((ok+1)); echo "  OK    bez zaproszenia → odrzucone (TOWER_NO_INVITE)"; } || { fail=$((fail+1)); echo "  FAIL  bez zaproszenia: $out"; }

echo; echo "[W3] Wiadomości i pozycje wg transportu/projektu (0037)"
W3="reset role;
 insert into organizations (id, code, name, kind) values ('00000000-0000-0000-0000-00000000a004','CAR2','Drugi przewoźnik','CARRIER'),
   ('00000000-0000-0000-0000-00000000a005','KL2','Drugi klient','CLIENT');
 insert into projects (id, code, name, client_org_id) values ('22222222-0000-0000-0000-000000000009','P2','Projekt 2','00000000-0000-0000-0000-00000000a005');
 insert into loads (id, project_id, carrier_org_id, order_no) values ('33333333-0000-0000-0000-000000000009','22222222-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000a004','KSH/W3');
 insert into load_messages (load_id, author_id, body) select '33333333-0000-0000-0000-000000000009', id, 'obcy' from app_users where email='hhl@test';
 insert into load_messages (load_id, author_id, body) select '$L1', id, 'swoj' from app_users where email='hhl@test';
 insert into shipment_items (project_id, load_id, shipment_code, length_m, width_m, height_m) values
   ('22222222-0000-0000-0000-000000000001','$L1','W3-SWOJ',1,1,1),
   ('22222222-0000-0000-0000-000000000001','33333333-0000-0000-0000-000000000009','W3-OBCY',1,1,1),
   ('22222222-0000-0000-0000-000000000001',null,'W3-BEZ',1,1,1),
   ('22222222-0000-0000-0000-000000000009',null,'W3-P2',1,1,1);
 set local role authenticated;"
val "przewoźnik: wiadomości tylko swoich transportów"           $SCX "$W3 select string_agg(body, ',' order by body) from load_messages where body in ('obcy','swoj')" swoj
val "przewoźnik: pozycje tylko na swoich transportach"          $SCX "$W3 select string_agg(shipment_code, ',' order by shipment_code) from shipment_items where shipment_code like 'W3-%'" W3-SWOJ
val "klient: pozycje tylko swojego projektu (także bez transportu)" $KSH "$W3 select string_agg(shipment_code, ',' order by shipment_code) from shipment_items where shipment_code like 'W3-%'" "W3-BEZ,W3-OBCY,W3-SWOJ"
val "HHL: wszystkie pozycje i wiadomości"                        $HHL "$W3 select (select count(*) from shipment_items where shipment_code like 'W3-%') || '/' || (select count(*) from load_messages where body in ('obcy','swoj'))" 4/2

echo; echo "[B1] security_flags — SELECT HHL, odmowa KSH/SCX; lista dla Operacji (0224)"
OPS=11111111-0000-0000-0000-0000000000b1
sys "insert into app_users (auth_id, org_id, email, role, active)
     values ('$OPS','00000000-0000-0000-0000-00000000a001','ops-b1@test','HHL_OPS',true)
     on conflict (auth_id) do update set role='HHL_OPS', active=true, org_id=excluded.org_id" >/dev/null
val "HHL_ADMIN widzi przełączniki" $HHL "select count(*) > 0 from security_flags" t
val "HHL_OPS widzi przełączniki" $OPS "select count(*) > 0 from security_flags" t
val "KSH 0 wierszy security_flags" $KSH "select count(*) from security_flags" 0
val "SCX 0 wierszy security_flags" $SCX "select count(*) from security_flags" 0
val "HHL_ADMIN security_flags_list niepuste" $HHL "select jsonb_array_length(security_flags_list()) > 0" t
val "HHL_OPS security_flags_list niepuste" $OPS "select jsonb_array_length(security_flags_list()) > 0" t
err "KSH security_flags_list odmowa" $KSH "select security_flags_list()" "tylko HHL"
err "SCX security_flags_list odmowa" $SCX "select security_flags_list()" "tylko HHL"

echo; echo "[B6] e-mail na osobę, płatność, rio_secret, limit anon, loads_read (0225)"
HHLID=$(sys "select id from app_users where email='hhl@test'")
# #402 F7: migracja nie włącza dates.email — test włącza jak c16-push/money/import.
# Bramka (a_gate przed budżetem) wymaga event_key — B6T* przez matrix_event=dates.
sys "update notification_matrix set email=true where event_key='dates' and role='HHL_ADMIN'" >/dev/null
sys "update notification_matrix set email=true where event_key='email_budget' and role='HHL_ADMIN'" >/dev/null
sys "
do \$\$
declare i int; u uuid := '$HHLID';
begin
  for i in 1..25 loop
    insert into notifications (channel, recipient, user_id, template, payload, dedup_key, status)
    values ('EMAIL', 'hhl@test', u, 'B6T' || ((i - 1) / 5)::text,
            jsonb_build_object('matrix_event', 'dates'), 'b6mail:' || i, 'PENDING');
  end loop;
end \$\$;
" >/dev/null
val "B6: 20 e-maili na osobę na dobę" $HHL "select count(*) from notifications where user_id='$HHLID' and channel='EMAIL' and template like 'B6T%' and status is distinct from 'SUPPRESSED'" 20
val "B6: 1 wiadomość zbiorcza" $HHL "select count(*) from notifications where user_id='$HHLID' and template='EMAIL_BUDGET'" 1
val "B6: tytuł limitu" $HHL "select payload->>'title' from notifications where user_id='$HHLID' and template='EMAIL_BUDGET'" "Limit e-maili na dziś"
val "B6: treść limitu" $HHL "select payload->>'body' from notifications where user_id='$HHLID' and template='EMAIL_BUDGET'" "Dziś dostałeś już 20 e-maili z Watch Tower. Kolejne powiadomienia z dzisiaj są w dzwonku i w aplikacji na telefonie. E-maile wrócą jutro."
val "B6: EMAIL_BUDGET w treściach" $HHL "select subject_pl from notification_copy where id='EMAIL_BUDGET'" "Limit e-maili na dziś"
sys "insert into notifications (channel, recipient, user_id, template, payload, dedup_key, status)
     values ('EMAIL', 'hhl@test', '$HHLID', 'B6PILNY',
             '{\"push_fallback\":true,\"matrix_event\":\"dates\"}'::jsonb, 'b6mail:pilny', 'PENDING')" >/dev/null
val "B6: e-mail zapasowy poza limitem" $HHL "select count(*) from notifications where user_id='$HHLID' and template='B6PILNY' and status is distinct from 'SUPPRESSED'" 1

out=$(sys "begin; grant update (paid_at) on invoices to authenticated; set local role authenticated; set local request.jwt.claim.sub='$KSH'; update invoices set paid_at=current_date where id='$INVP'; rollback;")
echo "$out" | grep -q "tylko HHL" && { ok=$((ok+1)); echo "  OK    B6: KSH nie zmieni paid_at"; } || { fail=$((fail+1)); echo "  FAIL  B6 paid_at: $out"; }
out=$(sys "begin; grant update (paid_marked_at) on invoices to authenticated; set local role authenticated; set local request.jwt.claim.sub='$SCX'; update invoices set paid_marked_at=now() where id='$INVK'; rollback;")
echo "$out" | grep -q "tylko HHL" && { ok=$((ok+1)); echo "  OK    B6: SCX nie zmieni paid_marked_at"; } || { fail=$((fail+1)); echo "  FAIL  B6 paid_marked: $out"; }

val "B6: authenticated bez UPDATE rio_secret" $HHL "select has_column_privilege('authenticated','loads','rio_secret','update')::text" false
val "B6: authenticated bez INSERT rio_secret" $HHL "select has_column_privilege('authenticated','loads','rio_secret','insert')::text" false
val "B6: authenticated ma UPDATE status" $HHL "select has_column_privilege('authenticated','loads','status','update')::text" true
err "B6: SCX nie zapisze rio_secret wprost" $SCX "update loads set rio_secret='tajne' where id='$L2'" "permission denied"
sys "update loads set telematics_vehicle_id='https://position-sharing.rio.cloud/x?id=aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee&secret=klucz-b6' where id='$L1'" >/dev/null
out=$(sys "select rio_secret from loads where id='$L1'")
echo "$out" | grep -qx "klucz-b6" && { ok=$((ok+1)); echo "  OK    B6: sanitizer nadal zapisuje rio_secret"; } || { fail=$((fail+1)); echo "  FAIL  B6 sanitizer: $out"; }

echo; echo "[#442] listRioLoadsForPoll — kolumny selectu istnieją w loads (bez shipment_code)"
# Edge store.ts listRioLoadsForPoll: te same nazwy co w select — MemStore tego nie łapie.
# Sprawdzenie przez sys (postgres): authenticated nie widzi rio_secret (revoke 0214) ani
# tracking_opened_at (brak grant select) w information_schema.columns — Edge i tak idzie service_role.
RIO_POLL_COLS='id,rio_tracking_id,rio_secret,rio_check_state,rio_check_at,rio_valid_from,rio_valid_to,rio_asset_name,rio_tracker_on,rio_last_fix_at,rio_error_streak,trailer_plate,tractor_plate,tractor_delivery_plate,status,plan_load_date,tracking_opened_at,telematics_vehicle_id'
out=$(sys "select count(*) from information_schema.columns where table_schema='public' and table_name='loads' and column_name = any(string_to_array('$RIO_POLL_COLS',','))")
[ "$out" = "18" ] && { ok=$((ok+1)); echo "  OK    #442: 18 kolumn poll RIO w loads"; } || { fail=$((fail+1)); echo "  FAIL  #442: 18 kolumn poll RIO w loads  (otrzymano: $out, oczekiwano: 18)"; }
out=$(sys "select count(*) from information_schema.columns where table_schema='public' and table_name='loads' and column_name='shipment_code'")
[ "$out" = "0" ] && { ok=$((ok+1)); echo "  OK    #442: loads bez shipment_code"; } || { fail=$((fail+1)); echo "  FAIL  #442: loads bez shipment_code  (otrzymano: $out, oczekiwano: 0)"; }

echo; echo "[#392] RIO sanitize — zmiana linku czyści / resetuje pola RIO (0252)"
sys "update loads set telematics_vehicle_id='https://emtrack.eu/app/' where id='$L1'" >/dev/null
out=$(sys "select (rio_tracking_id is null and rio_check_state is null)::text from loads where id='$L1'")
[ "$out" = "true" ] && { ok=$((ok+1)); echo "  OK    392: RIO→emtrack — rio_tracking_id i check_state puste"; } || { fail=$((fail+1)); echo "  FAIL  392 RIO→emtrack pola: $out"; }
out=$(sys "select rio_secret from loads where id='$L1'")
[ -z "$out" ] && { ok=$((ok+1)); echo "  OK    392: RIO→emtrack — rio_secret puste"; } || { fail=$((fail+1)); echo "  FAIL  392 rio_secret po emtrack: $out"; }
sys "update loads set telematics_vehicle_id='https://position-sharing.rio.cloud/x?id=aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee&secret=klucz-a' where id='$L1'" >/dev/null
sys "update loads set telematics_vehicle_id='https://position-sharing.rio.cloud/x?id=bbbbbbbb-bbbb-cccc-dddd-eeeeeeeeeeee' where id='$L1'" >/dev/null
out=$(sys "select coalesce(rio_secret,'') || '|' || coalesce(rio_check_state,'') || '|' || coalesce(rio_tracking_id,'') from loads where id='$L1'")
[ "$out" = "|pending|bbbbbbbb-bbbb-cccc-dddd-eeeeeeeeeeee" ] && { ok=$((ok+1)); echo "  OK    392: RIO A→B bez klucza — secret null, pending, id B"; } || { fail=$((fail+1)); echo "  FAIL  392 A→B: $out"; }
sys "update loads set telematics_vehicle_id='https://position-sharing.rio.cloud/x?id=aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee&secret=klucz-same' where id='$L1'" >/dev/null
sys "update loads set telematics_vehicle_id='rio:aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' where id='$L1'" >/dev/null
out=$(sys "select rio_secret from loads where id='$L1'")
echo "$out" | grep -qx "klucz-same" && { ok=$((ok+1)); echo "  OK    392: rio: ten sam id — secret bez zmian"; } || { fail=$((fail+1)); echo "  FAIL  392 ten sam rio:: $out"; }
sys "update loads set telematics_vehicle_id=null where id='$L1'" >/dev/null
out=$(sys "select (rio_tracking_id is null and rio_secret is null and rio_check_state is null)::text from loads where id='$L1'")
[ "$out" = "true" ] && { ok=$((ok+1)); echo "  OK    392: RIO→pusty — pola RIO puste"; } || { fail=$((fail+1)); echo "  FAIL  392 RIO→pusty: $out"; }

out=$(sys "select position('SITE' in pg_get_expr(polqual, polrelid)) from pg_policy where polname='loads_read'")
[ "$out" = "0" ] && { ok=$((ok+1)); echo "  OK    B6: loads_read bez SITE"; } || { fail=$((fail+1)); echo "  FAIL  B6 loads_read: $out"; }

out=$(sys "begin; set local request.headers='{\"cf-connecting-ip\":\"203.0.113.9\",\"user-agent\":\"ua-b6\"}'; select report_client_error('error','licznik a',null,null,null,'przegladarka-1'); select report_client_error('error','licznik b',null,null,null,'przegladarka-2'); select (count(*)=1 and max(n)=2)::text from anon_call_window where fn='report_client_error' and ip='203.0.113.9' and ua='ua-b6'; rollback;" | grep -v -E '^(BEGIN|SET|ROLLBACK)$' | tail -1)
[ "$out" = "true" ] && { ok=$((ok+1)); echo "  OK    B6: inny p_ua przy tym samym nagłówku — jeden licznik"; } || { fail=$((fail+1)); echo "  FAIL  B6: jeden licznik (otrzymano: $out)"; }
out=$(sys "begin; set local request.headers='{\"cf-connecting-ip\":\"203.0.113.9\",\"user-agent\":\"ua-b6\"}'; select report_client_error('error','licznik a',null,null,null,'przegladarka-1'); set local request.headers='{\"x-forwarded-for\":\"198.51.100.8, 10.0.0.1\",\"user-agent\":\"ua-b6\"}'; select report_client_error('error','licznik c',null,null,null,'przegladarka-1'); select count(*) from anon_call_window where fn='report_client_error' and ua='ua-b6'; rollback;" | grep -v -E '^(BEGIN|SET|ROLLBACK)$' | tail -1)
[ "$out" = "2" ] && { ok=$((ok+1)); echo "  OK    B6: inny adres w x-forwarded-for — osobny licznik"; } || { fail=$((fail+1)); echo "  FAIL  B6: osobny licznik (otrzymano: $out)"; }
sys "insert into anon_call_window (fn, ip, ua, n, window_start) values
     ('report_client_error','203.0.113.50','ua-b6',60,now()),
     ('keep_alive','203.0.113.50','ua-b6',60,now()),
     ('report_csp_violation','203.0.113.50','ua-b6',60,now())
     on conflict (fn, ip, ua) do update set n=60, window_start=now()" >/dev/null
HDR="set local request.headers='{\"cf-connecting-ip\":\"203.0.113.50\",\"user-agent\":\"ua-b6\"}'"
val "B6: report_client_error limit 60/15 min" $HHL "$HDR; select report_client_error('error','test b6',null,null,null,'inny-parametr')::text" false
val "B6: keep_alive limit" $HHL "$HDR; select (keep_alive('worker')->>'limited')::text" true
val "B6: report_csp_violation limit" $HHL "$HDR; select report_csp_violation('script-src',null,null,null,null,null,null,null,'report','inny-parametr',null)::text" false

chk6 "A8: anon bez SELECT emtrack_login_state" "$(psql "$PGURL" -Atq -c "select has_table_privilege('anon','public.emtrack_login_state','select')::text")" false
chk6 "A8: authenticated bez SELECT emtrack_login_state" "$(psql "$PGURL" -Atq -c "select has_table_privilege('authenticated','public.emtrack_login_state','select')::text")" false
chk6 "A8: zero otwartych SOURCE_DOWN:EMTRACK_WEB z datą w kluczu" "$(psql "$PGURL" -Atq -c "select count(*) from risk_signals where resolved_at is null and dedup_key like 'SOURCE_DOWN:EMTRACK_WEB:%'")" 0

echo; echo "[B4] visible_to czatu — RLS i odbiorcy (0247, Cz1–Cz3/Cz25)"
run $HHL "insert into load_messages (load_id, body, visible_to) values ('$L1', 'b4-tylko-hhl-scx', '{FORWARDER,CARRIER}')" commit >/dev/null
val "B4: KSH nie widzi wiadomości tylko HHL+SCX" $KSH "select count(*) from load_messages where body='b4-tylko-hhl-scx'" 0
val "B4: SCX widzi wiadomość tylko HHL+SCX" $SCX "select count(*) from load_messages where body='b4-tylko-hhl-scx'" 1
val "B4: HHL widzi wiadomość tylko HHL+SCX" $HHL "select count(*) from load_messages where body='b4-tylko-hhl-scx'" 1
val "B4: list_ui KSH bez HHL+SCX" $KSH "select count(*) from list_load_messages_ui() where body='b4-tylko-hhl-scx'" 0
val "B4: list_ui SCX widzi HHL+SCX" $SCX "select count(*) from list_load_messages_ui() where body='b4-tylko-hhl-scx'" 1
val "B4: list_ui zwraca visible_to bez CLIENT" $HHL "select (visible_to = '{FORWARDER,CARRIER}'::org_kind[])::text from list_load_messages_ui() where body='b4-tylko-hhl-scx'" true
err "B4: HHL nie ustawi visible_to bez CARRIER" $HHL "insert into load_messages (load_id, body, visible_to) values ('$L1', 'b4-zla', '{FORWARDER,CLIENT}')" "Widoczność|dozwolone|tylko HHL|check constraint|visible_to"
err "B4: puste visible_to odrzucone" $HHL "insert into load_messages (load_id, body, visible_to) values ('$L1', 'b4-puste', '{}')" "Widoczność|dozwolone|check constraint|visible_to"
err "B4: SITE w visible_to odrzucone" $HHL "insert into load_messages (load_id, body, visible_to) values ('$L1', 'b4-site', '{FORWARDER,CARRIER,SITE}')" "Widoczność|dozwolone|check constraint|visible_to"
run $SCX "insert into load_messages (load_id, body, visible_to) values ('$L1', 'b4-scx-hhl-scx', '{FORWARDER,CARRIER}')" commit >/dev/null
val "B4: SCX wysyła HHL+SCX" $SCX "select count(*) from load_messages where body='b4-scx-hhl-scx'" 1
val "B4: SCX nie zmieni visible_to (0 wierszy)" $SCX "with u as (update load_messages set visible_to='{FORWARDER,CLIENT,CARRIER}' where body='b4-tylko-hhl-scx' returning 1) select count(*) from u" 0
run $KSH "insert into load_messages (load_id, body, visible_to) values ('$L1', 'b4-ksh-force', '{FORWARDER,CARRIER}')" commit >/dev/null
val "B4: KSH zawsze ALL mimo żądania HHL+SCX" $HHL "select ('CLIENT'::org_kind = any (visible_to))::text from load_messages where body='b4-ksh-force'" true
B4MID=$(sys "select id from load_messages where body='b4-tylko-hhl-scx' limit 1" | tr -d '\r')
err "B4: KSH nie oznaczy HHL+SCX jako przeczytanej" $KSH "select mark_load_message_read($B4MID)" "niedostęp|42501|Wiadomość"
# Drugi przewoźnik: fixture przez sys (commit) — val domyślnie rollback, więc B4W w val ginął przed cz.2
sys "insert into organizations (id, code, name, kind) values ('00000000-0000-0000-0000-00000000a014','CAR2B4','Drugi przewoźnik B4','CARRIER') on conflict (id) do nothing;
 insert into loads (id, project_id, carrier_org_id, order_no) values
   ('33333333-0000-0000-0000-000000000019','22222222-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000a014','KSH/B4')
   on conflict (id) do nothing;
 insert into load_messages (load_id, author_id, body, visible_to)
   select '33333333-0000-0000-0000-000000000019', id, 'b4-cudzy-all', '{FORWARDER,CLIENT,CARRIER}'
     from app_users where email='hhl@test'
    and not exists (select 1 from load_messages where body='b4-cudzy-all');" >/dev/null
val "B4: list_ui SCX bez wiadomości cudzego transportu" $SCX "select count(*) from list_load_messages_ui() where body='b4-cudzy-all'" 0
# Macierz chat: zapamiętaj → HHL+SCX → 0 dla KSH; ALL → ≥1; przywróć
B4MAT=$(sys "select coalesce(in_app,false)::text||'|'||coalesce(push,false)::text||'|'||coalesce(email,false)::text from notification_matrix where event_key='chat' and role='CLIENT_USER'" | tr -d '\r')
B4MAT_IN=$(echo "$B4MAT" | cut -d'|' -f1); B4MAT_PU=$(echo "$B4MAT" | cut -d'|' -f2); B4MAT_EM=$(echo "$B4MAT" | cut -d'|' -f3)
sys "update notification_matrix set in_app=true, push=true, email=false where event_key='chat' and role='CLIENT_USER'" >/dev/null
KSHU=$(sys "select id from app_users where email='ksh@test'" | tr -d '\r')
run $HHL "insert into load_messages (load_id, body, visible_to) values ('$L1', 'b4-matrix-ksh', '{FORWARDER,CARRIER}')" commit >/dev/null
out=$(sys "select count(*) from notifications n join load_messages m on n.dedup_key like 'CHAT:'||m.id::text||':%' where m.body='b4-matrix-ksh' and n.user_id='$KSHU'")
[ "$out" = "0" ] && { ok=$((ok+1)); echo "  OK    B4: macierz KSH włączona → 0 powiadomień HHL+SCX"; } || { fail=$((fail+1)); echo "  FAIL  B4: powiadomienia KSH (otrzymano: $out)"; }
run $HHL "insert into load_messages (load_id, body, visible_to) values ('$L1', 'b4-matrix-all', '{FORWARDER,CLIENT,CARRIER}')" commit >/dev/null
out=$(sys "select count(*) from notifications n join load_messages m on n.dedup_key like 'CHAT:'||m.id::text||':%' where m.body='b4-matrix-all' and n.user_id='$KSHU'")
[ "$out" != "0" ] && { ok=$((ok+1)); echo "  OK    B4: wiadomość ALL → powiadomienie KSH ($out)"; } || { fail=$((fail+1)); echo "  FAIL  B4: brak powiadomienia KSH przy ALL"; }
sys "update notification_matrix set in_app='$B4MAT_IN'::boolean, push='$B4MAT_PU'::boolean, email='$B4MAT_EM'::boolean where event_key='chat' and role='CLIENT_USER'" >/dev/null

echo; echo "[B4 cz.2] dokumenty visible_to + odczyty z dostępem do transportu (0248)"
run $HHL "insert into load_messages (load_id, body, visible_to) values ('$L1', 'b4-all-own', '{FORWARDER,CLIENT,CARRIER}')" commit >/dev/null
val "B4: KSH widzi wiadomość ALL ze swojego transportu" $KSH "select count(*) from load_messages where body='b4-all-own'" 1
val "B4: list_ui KSH widzi ALL ze swojego transportu" $KSH "select count(*) from list_load_messages_ui() where body='b4-all-own'" 1
B4ALL=$(sys "select id from load_messages where body='b4-all-own' limit 1" | tr -d '\r')
run $KSH "select mark_load_message_read($B4ALL)" commit >/dev/null
val "B4: KSH widzi własny odczyt ALL (reads + transport)" $KSH "select count(*) from load_message_reads where message_id=$B4ALL" 1
# SCX (przewoźnik L1) nie wstawia odczytu wiadomości ALL z cudzego transportu (CAR2B4)
B4CUDZY=$(sys "select id from load_messages where body='b4-cudzy-all' limit 1" | tr -d '\r')
err "B4: SCX nie wstawi odczytu wiadomości cudzego transportu" $SCX \
  "insert into load_message_reads (message_id, user_id) select $B4CUDZY, id from app_users where email='scx@test'" \
  "row-level security|policy|42501"
# Dokument HHL+SCX: KSH 0 w SELECT (= paczka/eksport nie dostanie pliku)
B4DOC=$(sys "select gen_random_uuid()" | tr -d '\r')
sys "insert into documents (id, project_id, load_id, category, storage_path, file_name, mime_type, size_bytes, visible_to)
     values ('$B4DOC','22222222-0000-0000-0000-000000000001','$L1','OTHER','test/b4-hhl-scx.pdf','b4-doc-hhl-scx.pdf','application/pdf',100,'{FORWARDER,CARRIER}')" >/dev/null
val "B4: KSH nie widzi dokumentu HHL+SCX (paczka/eksport)" $KSH "select count(*) from documents where file_name='b4-doc-hhl-scx.pdf'" 0
val "B4: SCX widzi dokument HHL+SCX" $SCX "select count(*) from documents where file_name='b4-doc-hhl-scx.pdf'" 1
val "B4: HHL widzi dokument HHL+SCX" $HHL "select count(*) from documents where file_name='b4-doc-hhl-scx.pdf'" 1
B4DOC2=$(sys "select gen_random_uuid()" | tr -d '\r')
sys "insert into documents (id, project_id, load_id, category, storage_path, file_name, mime_type, size_bytes, visible_to)
     values ('$B4DOC2','22222222-0000-0000-0000-000000000001','$L1','OTHER','test/b4-all.pdf','b4-doc-all.pdf','application/pdf',100,'{FORWARDER,CLIENT,CARRIER}')" >/dev/null
val "B4: KSH widzi dokument ALL (paczka tygodnia)" $KSH "select count(*) from documents where file_name='b4-doc-all.pdf'" 1
err "B4: puste visible_to dokumentu odrzucone" $HHL \
  "insert into documents (project_id, load_id, category, storage_path, file_name, mime_type, size_bytes, visible_to)
   values ('22222222-0000-0000-0000-000000000001','$L1','OTHER','test/b4-empty.pdf','b4-empty.pdf','application/pdf',1,'{}')" \
  "check constraint|visible_to|documents_visible_to|Widoczność"
err "B4: CHECK odrzuca {CLIENT} samego" $HHL \
  "insert into documents (project_id, load_id, category, storage_path, file_name, mime_type, size_bytes, visible_to)
   values ('22222222-0000-0000-0000-000000000001','$L1','OTHER','test/b4-client.pdf','b4-client-only.pdf','application/pdf',1,'{CLIENT}')" \
  "check constraint|visible_to|documents_visible_to|Widoczność"
err "B4: CHECK odrzuca {FORWARDER,CLIENT}" $HHL \
  "insert into documents (project_id, load_id, category, storage_path, file_name, mime_type, size_bytes, visible_to)
   values ('22222222-0000-0000-0000-000000000001','$L1','OTHER','test/b4-fc.pdf','b4-fwd-client.pdf','application/pdf',1,'{FORWARDER,CLIENT}')" \
  "check constraint|visible_to|documents_visible_to|Widoczność"
# KSH zawsze ALL (wyzwalacz), SCX może HHL+SCX
run $KSH "insert into documents (project_id, load_id, category, storage_path, file_name, mime_type, size_bytes, visible_to)
   values ('22222222-0000-0000-0000-000000000001','$L1','OTHER','test/b4-ksh-fc.pdf','b4-ksh-force-hhl-scx.pdf','application/pdf',1,'{FORWARDER,CARRIER}')" commit >/dev/null
val "B4: KSH wstawia HHL+SCX → ALL" $HHL \
  "select ('CLIENT'::org_kind = any (visible_to))::text from documents where file_name='b4-ksh-force-hhl-scx.pdf'" true
run $KSH "insert into documents (project_id, load_id, category, storage_path, file_name, mime_type, size_bytes, visible_to)
   values ('22222222-0000-0000-0000-000000000001','$L1','OTHER','test/b4-ksh-hide.pdf','b4-ksh-force-hide.pdf','application/pdf',1,'{FORWARDER,CLIENT}')" commit >/dev/null
val "B4: KSH wstawia FORWARDER+CLIENT → ALL" $HHL \
  "select (cardinality(visible_to)=3 and 'CARRIER'::org_kind = any (visible_to))::text from documents where file_name='b4-ksh-force-hide.pdf'" true
run $SCX "insert into documents (project_id, load_id, category, storage_path, file_name, mime_type, size_bytes, visible_to)
   values ('22222222-0000-0000-0000-000000000001','$L1','OTHER','test/b4-scx-hs.pdf','b4-scx-hhl-scx.pdf','application/pdf',1,'{FORWARDER,CARRIER}')" commit >/dev/null
val "B4: SCX wstawia HHL+SCX → zostaje" $HHL \
  "select (visible_to = '{FORWARDER,CARRIER}'::org_kind[])::text from documents where file_name='b4-scx-hhl-scx.pdf'" true
# DOC_UPLOADED HHL+SCX: KSH nie widzi zdarzenia (ani nazwy pliku na osi)
run $HHL "insert into load_events (load_id, event_type, occurred_at, payload)
   values ('$L1','DOC_UPLOADED',now(), jsonb_build_object('documentId','$B4DOC','filename','b4-doc-hhl-scx.pdf','category','OTHER'))" commit >/dev/null
val "B4: KSH nie widzi DOC_UPLOADED dokumentu HHL+SCX" $KSH \
  "select count(*) from load_events where event_type='DOC_UPLOADED' and payload->>'filename'='b4-doc-hhl-scx.pdf'" 0
val "B4: SCX widzi DOC_UPLOADED dokumentu HHL+SCX" $SCX \
  "select count(*) from load_events where event_type='DOC_UPLOADED' and payload->>'filename'='b4-doc-hhl-scx.pdf'" 1
val "B4: HHL widzi DOC_UPLOADED dokumentu HHL+SCX" $HHL \
  "select count(*) from load_events where event_type='DOC_UPLOADED' and payload->>'filename'='b4-doc-hhl-scx.pdf'" 1

echo; echo "[#422] Wydajność (perf_results) i Błędy aplikacji (app_errors_recent)"
OPS422=11111111-0000-0000-0000-0000000000a1
sys "insert into app_users (auth_id, org_id, email, role, active)
     values ('$OPS422','00000000-0000-0000-0000-00000000a001','ops-422@test','HHL_OPS',true)
     on conflict (auth_id) do update set role='HHL_OPS', active=true, org_id=excluded.org_id" >/dev/null
val "#422: HHL_ADMIN czyta perf_results_latest (p5)" $HHL \
  "select (perf_results_latest()->'rows' @> '[{\"id\":\"p5\"}]')::text" true
val "#422: HHL_OPS czyta perf_results_latest" $OPS422 \
  "select (jsonb_typeof(perf_results_latest()->'rows') = 'array')::text" true
err "#422: KSH nie czyta perf_results_latest" $KSH "select perf_results_latest()" "tylko HHL|42501"
err "#422: SCX nie czyta perf_results_latest" $SCX "select perf_results_latest()" "tylko HHL|42501"
chk6 "#422: anon bez SELECT/INSERT na perf_results" "$(sys "select has_table_privilege('anon','perf_results','select')::text||has_table_privilege('anon','perf_results','insert')::text||has_table_privilege('authenticated','perf_results','insert')::text" | tail -1)" "falsefalsefalse"
chk6 "#422: anon bez EXECUTE perf_results_latest / app_errors_recent" "$(sys "select has_function_privilege('anon','perf_results_latest()','execute')::text||has_function_privilege('anon','app_errors_recent(int)','execute')::text" | tail -1)" "falsefalse"
chk6 "#422: authenticated bez EXECUTE record / ingest" "$(sys "select has_function_privilege('authenticated','perf_result_record(text,text,text,text,text,boolean,text,timestamptz)','execute')::text||has_function_privilege('authenticated','perf_p95_lists_ingest(timestamptz)','execute')::text" | tail -1)" "falsefalse"
err "#422: HHL nie wstawi wiersza bezpośrednio" $HHL \
  "insert into perf_results (metric_id, what, how, result_text, limit_text, ok, source) values ('p1','x','y','z','l',true,'t')" \
  "permission denied|42501"
err "#422: HHL nie wywoła perf_result_record" $HHL \
  "select perf_result_record('p1','x','y','z','l',true,'t')" \
  "permission denied|42501"
err "#422: HHL nie wywoła perf_p95_lists_ingest" $HHL \
  "select perf_p95_lists_ingest()" \
  "permission denied|42501"
val "#422: HHL_ADMIN app_errors_recent ma groups" $HHL \
  "select (jsonb_typeof(app_errors_recent(7)->'groups') = 'array')::text" true
val "#422: app_errors_recent newCount null (brak danych)" $HHL \
  "select (jsonb_typeof(app_errors_recent(7)->'newCount') = 'null')::text" true
err "#422: HHL_OPS nie czyta app_errors_recent" $OPS422 "select app_errors_recent(7)" "Administrator HHL|42501"
err "#422: KSH nie czyta app_errors_recent" $KSH "select app_errors_recent(7)" "Administrator HHL|42501"
err "#422: SCX nie czyta app_errors_recent" $SCX "select app_errors_recent(7)" "Administrator HHL|42501"
out=$(sys "select perf_p95_lists_ingest()->>'p4_result'"); echo "$out" | grep -qiE 'brak pomiaru|[0-9]+ ms' \
  && { ok=$((ok+1)); echo "  OK    #422: ingest zapisuje p4 (max_exec_time)"; } \
  || { fail=$((fail+1)); echo "  FAIL  #422: ingest: $out"; }
val "#422: po ingest HHL widzi p4 w latest" $HHL \
  "select (perf_results_latest()->'rows' @> '[{\"id\":\"p4\"}]')::text" true

echo; echo "[#508] Lighthouse p1–p3 + newSince od deploy-main"
chk6 "#508: authenticated bez EXECUTE deploy_success_record" "$(sys "select has_function_privilege('authenticated','deploy_success_record(timestamptz,jsonb)','execute')::text" | tail -1)" "false"
err "#508: HHL nie wywoła deploy_success_record" $HHL \
  "select deploy_success_record()" \
  "permission denied|42501|tylko usługa"
sys "select deploy_success_record(now() - interval '1 hour', '{\"test\":true}'::jsonb)" >/dev/null
sys "insert into client_errors (fingerprint, kind, message, path, first_seen_at, last_seen_at, hits)
     values ('508-new','error','#508 nowy blad po deploy','/login', now() - interval '30 minutes', now(), 1)" >/dev/null
sys "insert into client_errors (fingerprint, kind, message, path, first_seen_at, last_seen_at, hits)
     values ('508-old','error','#508 stary blad przed deploy','/login', now() - interval '2 hours', now() - interval '90 minutes', 1)" >/dev/null
val "#508: newSince ustawione po deploy-main" $HHL \
  "select (jsonb_typeof(app_errors_recent(7)->'newSince') = 'string')::text" true
val "#508: newCount = 1 (tylko grupy po wdrożeniu)" $HHL \
  "select (app_errors_recent(7)->>'newCount')" 1
sys "select perf_result_record('p1','Logowanie · telefon','LCP · CLS · TBT','2,0 s · 0,01 · 100 ms','LCP ≤ 2,5 s · CLS ≤ 0,1 · TBT ≤ 300 ms',true,'lighthouse:/:mobile');
     select perf_result_record('p2','Offline · telefon','LCP · CLS · TBT','2,1 s · 0,02 · 120 ms','LCP ≤ 2,5 s · CLS ≤ 0,1 · TBT ≤ 300 ms',true,'lighthouse:/offline.html:mobile');
     select perf_result_record('p3','Logowanie · komputer','LCP · CLS · TBT','2,2 s · 0,02 · 150 ms','LCP ≤ 2,5 s · CLS ≤ 0,1 · TBT ≤ 300 ms',false,'lighthouse:/:desktop')" >/dev/null
val "#508: perf_results_latest ma p1–p3" $HHL \
  "select ((perf_results_latest()->'rows' @> '[{\"id\":\"p1\"}]') and (perf_results_latest()->'rows' @> '[{\"id\":\"p2\"}]') and (perf_results_latest()->'rows' @> '[{\"id\":\"p3\"}]'))::text" true
val "#508: at z pomiaru ok is not null (p1)" $HHL \
  "select ((perf_results_latest()->'rows' @> '[{\"id\":\"p1\",\"ok\":true}]') and (perf_results_latest()->'at' is not null))::text" true
# Ten sam message sprzed wdrożenia nie wchodzi do newCount; ok=false w integration_runs ignorowany.
sys "insert into integration_runs (job, ran_at, ok, result)
     values ('deploy-main', now() - interval '10 minutes', false, '{\"fail\":true}'::jsonb)" >/dev/null
sys "insert into client_errors (fingerprint, kind, message, path, first_seen_at, last_seen_at, hits)
     values ('508-same','error','#508 stary blad przed deploy','/login', now() - interval '2 hours', now() - interval '5 minutes', 2)" >/dev/null
val "#508: newCount bez grupy istniejącej przed wdrożeniem" $HHL \
  "select (app_errors_recent(7)->>'newCount')" 1

echo; echo "[#412] E40 terminy płatności i adresy księgowości"
OPS412=11111111-0000-0000-0000-0000000000a2
sys "insert into app_users (auth_id, org_id, email, role, active)
     values ('$OPS412','00000000-0000-0000-0000-00000000a001','ops-412@test','HHL_OPS',true)
     on conflict (auth_id) do update set role='HHL_OPS', active=true, org_id=excluded.org_id" >/dev/null
val "#412: HHL_ADMIN czyta terminy 30/35" $HHL \
  "select (payment_terms_options()->>'kshDays')||'/'||(payment_terms_options()->>'scxDays')" "30/35"
val "#412: HHL_OPS czyta terminy" $OPS412 \
  "select (payment_terms_options()->>'kshDays')::text" 30
err "#412: KSH nie czyta terminów" $KSH "select payment_terms_options()" "tylko HHL|42501"
err "#412: SCX nie czyta terminów" $SCX "select payment_terms_options()" "tylko HHL|42501"
# Wersjonowanie: seed ma valid_from=dziś — cofnij, żeby insert dziś zostawił starą wersję (issue_date sprzed zmiany).
sys "update payment_terms set valid_from = current_date - 7
       where project_id = '22222222-0000-0000-0000-000000000001'
         and payer_org_id = '00000000-0000-0000-0000-00000000a002'
         and payee_org_id = '00000000-0000-0000-0000-00000000a001'" >/dev/null
val "#412: HHL_ADMIN ustawia termin KSH=45" $HHL \
  "select payment_terms_options_set('KSH', 45); select (payment_terms_options()->>'kshDays')" 45 commit
val "#412: issue_date sprzed zmiany ma stary termin" $HHL \
  "select t.term_days::text from payment_terms t
     where t.project_id = '22222222-0000-0000-0000-000000000001'
       and t.payer_org_id = '00000000-0000-0000-0000-00000000a002'
       and t.payee_org_id = '00000000-0000-0000-0000-00000000a001'
       and t.valid_from <= (current_date - 1)
     order by t.valid_from desc limit 1" 30
val "#412: audit PAYMENT_TERMS_SET" $HHL \
  "select count(*) from audit_log where action='PAYMENT_TERMS_SET' and new_value->>'days'='45'" 1
err "#412: HHL_OPS nie ustawi terminu" $OPS412 "select payment_terms_options_set('SCX', 40)" "Administrator HHL|42501"
err "#412: KSH nie ustawi terminu" $KSH "select payment_terms_options_set('KSH', 40)" "Administrator HHL|42501"
err "#412: dni poza 1–120" $HHL "select payment_terms_options_set('KSH', 0)" "1–120|22023"
val "#412: przywróć termin KSH=30" $HHL \
  "select payment_terms_options_set('KSH', 30); select (payment_terms_options()->>'kshDays')" 30 commit
sys "delete from payment_terms
       where project_id = '22222222-0000-0000-0000-000000000001'
         and payer_org_id = '00000000-0000-0000-0000-00000000a002'
         and payee_org_id = '00000000-0000-0000-0000-00000000a001'
         and valid_from < current_date" >/dev/null
val "#412: HHL czyta adresy startowe" $HHL \
  "select (accounting_addresses_get()->'HHL'->>0)" "ksiegowosc@hhlogistics.pl"
val "#412: HHL_OPS czyta adresy" $OPS412 \
  "select (accounting_addresses_get()->'KSH'->>0)" "faktury@ksh.pl"
err "#412: KSH nie czyta adresów" $KSH "select accounting_addresses_get()" "tylko HHL|42501"
err "#412: SCX nie czyta adresów" $SCX "select accounting_addresses_get()" "tylko HHL|42501"
val "#412: KSH SELECT accounting_addresses = 0" $KSH "select count(*) from accounting_addresses" 0
val "#412: SCX SELECT accounting_addresses = 0" $SCX "select count(*) from accounting_addresses" 0
# Adresy @test.pl — fikcyjne (F7: nie firmowe); regex wymaga TLD (≥2 litery).
val "#412: HHL_ADMIN zapisuje 2 adresy HHL (@test.pl)" $HHL \
  "select accounting_addresses_set('HHL', array['ksiegowosc@test.pl','biuro@test.pl']); select jsonb_array_length(accounting_addresses_get()->'HHL')" 2 commit
val "#412: audit ACCOUNTING_ADDRESSES_SET" $HHL \
  "select count(*) from audit_log where action='ACCOUNTING_ADDRESSES_SET' and entity_id='HHL'" 1
err "#412: HHL_OPS nie zapisze adresów" $OPS412 \
  "select accounting_addresses_set('KSH', array['a@test.pl'])" "Administrator HHL|42501"
err "#412: KSH nie ustawi adresów" $KSH \
  "select accounting_addresses_set('KSH', array['a@test.pl'])" "Administrator HHL|42501"
err "#412: zły e-mail odrzucony" $HHL \
  "select accounting_addresses_set('HHL', array['nie-email'])" "Nieprawidłowy|22023"
err "#412: e-mail z średnikiem odrzucony" $HHL \
  "select accounting_addresses_set('HHL', array['a@b.pl;x'])" "Nieprawidłowy|22023"
chk6 "#412: anon bez SELECT/INSERT accounting_addresses" "$(sys "select has_table_privilege('anon','accounting_addresses','select')::text||has_table_privilege('anon','accounting_addresses','insert')::text||has_table_privilege('authenticated','accounting_addresses','insert')::text" | tail -1)" "falsefalsefalse"
err "#412: HHL nie wstawi wiersza bezpośrednio" $HHL \
  "insert into accounting_addresses (pack_key, emails) values ('X', '{x@test.pl}')" \
  "permission denied|42501"
# Przywróć seed migracji (adresy działowe) po testach @test.
run $HHL "select accounting_addresses_set('HHL', array['ksiegowosc@hhlogistics.pl'])" commit >/dev/null

echo; echo "[#412] E40 paczka tygodnia — dziennik (0286)"
# Faktury seed (W41) + PDF + CMR + akceptacja KOSZT — wymóg serwera (F7 #512).
# UUID tylko hex (…pk01/…cm01 padały na invalid uuid → Brak faktury w CI).
PACK_P=22222222-0000-0000-0000-000000000001
PACK_L=33333333-0000-0000-0000-000000000001
PACK_DOC=aaaaaaaa-0412-4000-8000-00000000a401
PACK_CMR=aaaaaaaa-0412-4000-8000-00000000a402
sys "insert into documents (id, project_id, load_id, category, storage_path, file_name, mime_type, size_bytes)
       values ('$PACK_DOC','$PACK_P',null,'INVOICE','test/pack-412-fv.pdf','fv.pdf','application/pdf',100),
              ('$PACK_CMR','$PACK_P','$PACK_L','CMR','test/pack-412-cmr.pdf','cmr.pdf','application/pdf',100)
     on conflict (id) do nothing"
sys "update invoices set week_key='2026-W41', document_id='$PACK_DOC',
            verification_status=case when direction='KOSZT' then 'ZAAKCEPTOWANA'
              when direction='PRZYCHOD' then 'DO_WERYFIKACJI' else verification_status end
      where id in ('44444444-0000-0000-0000-00000000000c','44444444-0000-0000-0000-0000000000ee')"
val "#412p: HHL czyta config (adresy)" $HHL \
  "select (accounting_pack_config()->'addresses'->'HHL'->>0)" "ksiegowosc@hhlogistics.pl"
val "#412p: HHL_OPS czyta config" $OPS412 \
  "select (accounting_pack_config()->'addresses'->'KSH'->>0)" "faktury@ksh.pl"
err "#412p: KSH nie czyta config" $KSH "select accounting_pack_config()" "tylko HHL|42501"
err "#412p: SCX nie czyta config" $SCX "select accounting_pack_config()" "tylko HHL|42501"
val "#412p: HHL_ADMIN zleca paczkę KSH (ZLECONO)" $HHL \
  "select (accounting_pack_send('KSH','2026-W41')->>'status')" "ZLECONO" commit
val "#412p: config.sent po zleceniu" $HHL \
  "select (accounting_pack_config()->'sent'->'2026-W41:KSH'->>'status')" "ZLECONO"
val "#412p: audit ACCOUNTING_PACK_SEND" $HHL \
  "select count(*) from audit_log where action='ACCOUNTING_PACK_SEND' and new_value->>'week'='2026-W41'" 1
err "#412p: ponowienie bez p_resend odmowa" $HHL \
  "select accounting_pack_send('KSH','2026-W41')" "już zlecona|P0001"
val "#412p: HHL_OPS zleca paczkę HHL" $OPS412 \
  "select (accounting_pack_send('HHL','2026-W41')->>'to')::text" 1 commit
err "#412p: KSH nie wyśle" $KSH "select accounting_pack_send('KSH','2026-W41')" "tylko HHL|42501"
err "#412p: SCX nie wyśle" $SCX "select accounting_pack_send('HHL','2026-W41')" "tylko HHL|42501"
err "#412p: zły tydzień" $HHL "select accounting_pack_send('KSH','2026W41')" "Tydzień ISO|22023"
err "#412p: W00 poza 01–53" $HHL "select accounting_pack_send('KSH','2026-W00')" "Tydzień ISO|22023"
err "#412p: W99 poza 01–53" $HHL "select accounting_pack_send('KSH','2026-W99')" "Tydzień ISO|22023"
err "#412p: brak faktury w tygodniu" $HHL "select accounting_pack_send('KSH','2026-W42')" "Brak faktury|P0002"
run $HHL "select accounting_addresses_set('HHL', '{}'::text[])" commit >/dev/null
err "#412p: brak adresu blokuje" $HHL "select accounting_pack_send('HHL','2026-W41', '{}'::text[], true)" "Brak adresu|P0002"
run $HHL "select accounting_addresses_set('HHL', array['ksiegowosc@hhlogistics.pl'])" commit >/dev/null
val "#412p: ponowienie z p_resend" $HHL \
  "select (accounting_pack_send('KSH','2026-W41', '{}'::text[], true)->>'status')" "ZLECONO" commit
val "#412p: dwa wpisy KSH po resend" $HHL \
  "select count(*) from accounting_pack_sends where week_key='2026-W41' and pack_key='KSH'" 2
# Edge: ZLECONO → WYSLANO (session_user postgres w bramie = jak service_role).
PACK_ID=$(sys "select id::text from accounting_pack_sends where week_key='2026-W41' and pack_key='KSH' order by sent_at desc limit 1" | grep -vE '^(BEGIN|SET|ROLLBACK|COMMIT)$' | tail -1 | tr -d '\r')
out=$(sys "select accounting_pack_send_set_status('$PACK_ID'::uuid, 'WYSLANO'); select status from accounting_pack_sends where id='$PACK_ID'")
[ "$(echo "$out" | grep -vE '^(BEGIN|SET|ROLLBACK|COMMIT)$' | tail -1)" = "WYSLANO" ] \
  && { ok=$((ok+1)); echo "  OK    #412p: set_status → WYSLANO"; } \
  || { fail=$((fail+1)); echo "  FAIL  #412p: set_status → WYSLANO  (otrzymano: $out)"; }
err "#412p: authenticated bez set_status" $HHL \
  "select accounting_pack_send_set_status('$PACK_ID'::uuid, 'DORECZONO')" "permission denied|42501|service_role"
val "#412p: KSH SELECT pack_sends = 0" $KSH "select count(*) from accounting_pack_sends" 0
val "#412p: SCX SELECT pack_sends = 0" $SCX "select count(*) from accounting_pack_sends" 0
chk6 "#412p: anon bez SELECT/INSERT pack_sends" "$(sys "select has_table_privilege('anon','accounting_pack_sends','select')::text||has_table_privilege('anon','accounting_pack_sends','insert')::text||has_table_privilege('authenticated','accounting_pack_sends','insert')::text" | tail -1)" "falsefalsefalse"
err "#412p: HHL nie wstawi wiersza bezpośrednio" $HHL \
  "insert into accounting_pack_sends (week_key, pack_key, to_count, emails, status, by_user_id, by_name)
     values ('2026-W41','KSH',1,'{a@test.pl}','ZLECONO','$HHL','x')" \
  "permission denied|42501"

echo; echo "[#412] E4b faktoring — oferta + wybór + wypłata (0287)"
val "#412f: HHL_ADMIN czyta ofertę 1%/48h" $HHL \
  "select (factoring_offer_get()->>'feePct')||'/'||(factoring_offer_get()->>'hours')" "1.00/48"
val "#412f: HHL_OPS czyta ofertę" $OPS412 \
  "select (factoring_offer_get()->>'version')::text" 1
val "#412f: SCX czyta ofertę (wybór przy fakturze)" $SCX \
  "select (factoring_offer_get()->>'from')" "2026-10-07"
err "#412f: KSH nie czyta oferty" $KSH "select factoring_offer_get()" "tylko HHL|SCX|42501"
val "#412f: HHL_ADMIN ustawia prowizję 1,5%" $HHL \
  "select (factoring_offer_set(true, 1.5, 48)->>'feePct')" "1.50" commit
val "#412f: audit FACTORING_OFFER_SET" $HHL \
  "select count(*) from audit_log where action='FACTORING_OFFER_SET' and new_value->>'feePct'='1.50'" 1
err "#412f: HHL_OPS nie zmieni oferty" $OPS412 \
  "select factoring_offer_set(true, 2, 48)" "Administrator HHL|42501"
err "#412f: KSH nie zmieni oferty" $KSH \
  "select factoring_offer_set(true, 2, 48)" "Administrator HHL|42501"
err "#412f: prowizja poza zakresem" $HHL \
  "select factoring_offer_set(true, 0, 48)" "0,01–20|22023"
run $HHL "select factoring_offer_set(true, 1, 48)" commit >/dev/null
sys "update invoices set factoring_selected=false, factoring_fee_pct=null, factoring_fee_amount=null,
       factoring_net_payout=null, factoring_hours=null, factoring_offer_version=null,
       factoring_accepted_at=null, factoring_due_at=null, factoring_paid_at=null,
       payment_status='NIEOPLACONA', paid_at=null,
       verification_status='DO_WERYFIKACJI'
     where id='$INVK'" >/dev/null
val "#412f: SCX wybiera faktoring na KOSZT" $SCX \
  "select invoice_factoring_set('$INVK', true); select factoring_fee_amount::text from invoices where id='$INVK'" "100.95" commit
val "#412f: snapshot wypłaty (brutto−prowizja)" $SCX \
  "select factoring_net_payout::text from invoices where id='$INVK'" "9994.08"
err "#412f: KSH nie wybierze faktoringu" $KSH \
  "select invoice_factoring_set('$INVK', true)" "przewoźnik|42501"
err "#412f: HHL nie wybierze faktoringu na KOSZT SCX" $HHL \
  "select invoice_factoring_set('$INVK', true)" "przewoźnik|42501"
# F7: drugi przewoźnik nie wybiera cudzej faktury SCX.
CAR2F=11111111-0000-0000-0000-0000000000c2
sys "insert into organizations (id, code, name, kind)
       values ('00000000-0000-0000-0000-00000000a004','CAR2','Drugi przewoźnik','CARRIER')
       on conflict (id) do nothing;
     insert into app_users (auth_id, org_id, email, role, active)
       values ('$CAR2F','00000000-0000-0000-0000-00000000a004','car2-412f@test','CARRIER_DISPATCH',true)
       on conflict (auth_id) do update set role='CARRIER_DISPATCH', active=true,
         org_id='00000000-0000-0000-0000-00000000a004'" >/dev/null
err "#412f: drugi przewoźnik nie wybierze faktoringu SCX" $CAR2F \
  "select invoice_factoring_set('$INVK', true)" "przewoźnik|42501"
# F7: wypłata przed akceptacją.
err "#412f: wypłata przed akceptacją odmowa" $HHL \
  "select factoring_mark_paid('$INVK')" "Najpierw akceptacja|22023"
# F7: rezygnacja przed akceptacją.
val "#412f: SCX rezygnuje z faktoringu" $SCX \
  "select invoice_factoring_set('$INVK', false); select factoring_selected::text from invoices where id='$INVK'" "false" commit
run $SCX "select invoice_factoring_set('$INVK', true)" commit >/dev/null
sys "delete from notifications where template like 'FACTOR%' and payload->>'invoice_id'='$INVK'" >/dev/null
val "#412f: akceptacja HHL startuje 48 h" $HHL \
  "update invoices set verification_status='ZAAKCEPTOWANA' where id='$INVK'; select (factoring_due_at is not null)::text from invoices where id='$INVK'" true commit
err "#412f: zmiana wyboru po akceptacji odmowa" $SCX \
  "select invoice_factoring_set('$INVK', false)" "Po akceptacji|22023"
chk6 "#412f: dzwonek FACTORING_ACCEPTED IN_APP HHL" "$(sys "select count(*) from notifications n join app_users u on u.id=n.user_id where n.channel='IN_APP' and n.template='FACTORING_ACCEPTED' and n.payload->>'invoice_id'='$INVK' and u.role='HHL_ADMIN'" | tail -1)" 1
chk6 "#412f: dzwonek FACTORING_ACCEPTED IN_APP SCX" "$(sys "select count(*) from notifications n join app_users u on u.id=n.user_id where n.channel='IN_APP' and n.template='FACTORING_ACCEPTED' and n.payload->>'invoice_id'='$INVK' and u.auth_id='$SCX'" | tail -1)" 1
chk6 "#412f: drugi przewoźnik bez dzwonka akceptacji" "$(sys "select count(*) from notifications n join app_users u on u.id=n.user_id where n.template='FACTORING_ACCEPTED' and n.payload->>'invoice_id'='$INVK' and u.auth_id='$CAR2F'" | tail -1)" 0
val "#412f: HHL widzi zadanie wypłaty" $HHL \
  "select jsonb_array_length(factoring_tasks())" 1
val "#412f: HHL_OPS widzi zadania" $OPS412 \
  "select (factoring_tasks()->0->>'number')" "SCX/9/2026"
err "#412f: KSH nie czyta zadań" $KSH "select factoring_tasks()" "tylko HHL|42501"
err "#412f: SCX nie czyta zadań" $SCX "select factoring_tasks()" "tylko HHL|42501"
val "#412f: HHL oznacza wypłatę" $HHL \
  "select factoring_mark_paid('$INVK'); select payment_status||'|'||(factoring_paid_at is not null)::text from invoices where id='$INVK'" "OPLACONA|true" commit
chk6 "#412f: dzwonek FACTORING_PAID IN_APP HHL+SCX" "$(sys "select count(*) from notifications where channel='IN_APP' and template='FACTORING_PAID' and payload->>'invoice_id'='$INVK'" | tail -1)" 2
val "#412f: po wypłacie lista pusta" $HHL "select jsonb_array_length(factoring_tasks())" 0
val "#412f: audit FACTORING_MARK_PAID" $HHL \
  "select count(*) from audit_log where action='FACTORING_MARK_PAID' and entity_id='$INVK'" 1
err "#412f: ponowna wypłata odmowa" $HHL "select factoring_mark_paid('$INVK')" "opłacona|P0001"
err "#412f: SCX nie oznaczy wypłaty" $SCX "select factoring_mark_paid('$INVK')" "wyłącznie HHL|42501"
err "#412f: KSH nie oznaczy wypłaty" $KSH "select factoring_mark_paid('$INVK')" "wyłącznie HHL|42501"
val "#412f: unmark czyści factoring_paid_at" $HHL \
  "select unmark_invoice_paid('$INVK', 'test cofnięcia faktoringu'); select (factoring_paid_at is null and payment_status='NIEOPLACONA')::text from invoices where id='$INVK'" "true" commit
# Kolejność odwrotna: najpierw mark_invoice_paid, potem factoring.
sys "update invoices set factoring_selected=true, factoring_fee_pct=1, factoring_fee_amount=100.95,
       factoring_net_payout=9994.08, factoring_hours=48, factoring_offer_version=1,
       factoring_accepted_at=now(), factoring_due_at=now()+interval '48 hours', factoring_paid_at=null,
       payment_status='NIEOPLACONA', paid_at=null, verification_status='ZAAKCEPTOWANA'
     where id='$INVK'" >/dev/null
run $HHL "select mark_invoice_paid('$INVK', current_date)" commit >/dev/null
val "#412f: po mark_invoice_paid brak zadań" $HHL \
  "select jsonb_array_length(factoring_tasks())" 0
err "#412f: factoring_mark_paid po OPLACONA odmowa" $HHL \
  "select factoring_mark_paid('$INVK')" "opłacona|P0001"
err "#412f: invoice_factoring_set na opłaconej odmowa" $SCX \
  "select invoice_factoring_set('$INVK', false)" "opłacona|P0001"
# Przeliczenie przy edycji kwot (zachowany %).
sys "update invoices set factoring_selected=true, factoring_fee_pct=1, factoring_fee_amount=100.95,
       factoring_net_payout=9994.08, factoring_hours=48, factoring_offer_version=1,
       factoring_accepted_at=null, factoring_due_at=null, factoring_paid_at=null,
       payment_status='NIEOPLACONA', paid_at=null, verification_status='DO_WERYFIKACJI',
       net_total=10095.03, gross_total=10095.03, currency='PLN'
     where id='$INVK'" >/dev/null
run $SCX "select invoice_factoring_set('$INVK', true)" commit >/dev/null
sys "update invoices set net_total=24600, gross_total=24600, currency='EUR' where id='$INVK'" >/dev/null
val "#412f: po edycji kwot przeliczona prowizja" $SCX \
  "select factoring_fee_amount::text||'/'||factoring_net_payout::text from invoices where id='$INVK'" "246.00/24354.00"
run $HHL "select factoring_offer_set(false, 1, 48)" commit >/dev/null
err "#412f: set przy ofercie wyłączonej" $SCX \
  "select invoice_factoring_set('$INVK', true)" "wyłączony|wyłączona|oferta|P0001"
val "#412f: HHL widzi ofertę enabled=false" $HHL \
  "select (factoring_offer_get()->>'enabled')" "false"
run $HHL "select factoring_offer_set(true, 1, 48)" commit >/dev/null
sys "update invoices set verification_status='SPORNA', dispute_note='test sporu faktoringu',
       factoring_selected=false where id='$INVK'" >/dev/null
err "#412f: SPORNA bez faktoringu" $SCX \
  "select invoice_factoring_set('$INVK', true)" "sporze|SPORNA|22023"
# F7: po terminie 48 h — dzwonek OVERDUE (due_at osobno: trigger akceptacji nadpisuje now()+48h).
sys "update invoices set verification_status='ZAAKCEPTOWANA', factoring_selected=true,
       factoring_fee_pct=1, factoring_fee_amount=100.95, factoring_net_payout=9994.08,
       factoring_hours=48, factoring_offer_version=1, factoring_paid_at=null,
       payment_status='NIEOPLACONA', paid_at=null, dispute_note=null,
       net_total=10095.03, gross_total=10095.03, currency='PLN'
     where id='$INVK'" >/dev/null
sys "update invoices set factoring_accepted_at=now()-interval '3 days',
       factoring_due_at=now()-interval '1 day' where id='$INVK'" >/dev/null
sys "delete from notifications where template='FACTORING_OVERDUE' and payload->>'invoice_id'='$INVK'" >/dev/null
sys "select factoring_overdue_notify()" >/dev/null
chk6 "#412f: dzwonek FACTORING_OVERDUE po terminie" "$(sys "select (count(*) >= 1)::text from notifications where channel='IN_APP' and template='FACTORING_OVERDUE' and payload->>'invoice_id'='$INVK'" | tail -1)" true
sys "update invoices set verification_status='DO_WERYFIKACJI', factoring_selected=false,
       factoring_fee_pct=null, factoring_fee_amount=null, factoring_net_payout=null,
       factoring_hours=null, factoring_offer_version=null, factoring_accepted_at=null,
       factoring_due_at=null, factoring_paid_at=null, payment_status='NIEOPLACONA', paid_at=null,
       net_total=10095.03, gross_total=10095.03, currency='PLN'
     where id='$INVK'" >/dev/null
chk6 "#412f: anon bez SELECT/INSERT factoring_offers" "$(sys "select has_table_privilege('anon','factoring_offers','select')::text||has_table_privilege('anon','factoring_offers','insert')::text||has_table_privilege('authenticated','factoring_offers','insert')::text" | tail -1)" "falsefalsefalse"
err "#412f: HHL nie wstawi oferty bezpośrednio" $HHL \
  "insert into factoring_offers (version, enabled, fee_pct, hours, valid_from) values (99, true, 1, 48, '2099-01-01')" \
  "permission denied|42501"

echo; echo "[#412] E16 próg marży + E11 urządzenia push (0288)"
val "#412m: HHL_ADMIN czyta próg 4%" $HHL \
  "select (margin_threshold_get()->>'pct')" "4.0"
val "#412m: HHL_OPS czyta próg" $OPS412 \
  "select (margin_threshold_get()->>'pct')" "4.0"
err "#412m: KSH nie czyta progu" $KSH "select margin_threshold_get()" "tylko HHL|42501"
err "#412m: SCX nie czyta progu" $SCX "select margin_threshold_get()" "tylko HHL|42501"
val "#412m: HHL_ADMIN ustawia 5,5%" $HHL \
  "select (margin_threshold_set(5.55)->>'pct')" "5.6" commit
val "#412m: audit MARGIN_THRESHOLD_SET" $HHL \
  "select count(*) from audit_log where action='MARGIN_THRESHOLD_SET' and new_value->>'pct'='5.6'" 1
err "#412m: HHL_OPS nie ustawi progu" $OPS412 \
  "select margin_threshold_set(6)" "Administrator HHL|42501"
err "#412m: KSH nie ustawi progu" $KSH \
  "select margin_threshold_set(6)" "Administrator HHL|42501"
err "#412m: próg poza 0–100" $HHL \
  "select margin_threshold_set(101)" "0–100|22023"
val "#412m: HHL_ADMIN wyłącza próg (null)" $HHL \
  "select (margin_threshold_set(null)->'pct')::text" "null" commit
val "#412m: po wyłączeniu pct null" $HHL \
  "select (margin_threshold_get()->'pct')::text" "null"
val "#412m: przywróć 4%" $HHL \
  "select (margin_threshold_set(4)->>'pct')" "4.0" commit
chk6 "#412m: anon bez SELECT/INSERT margin_threshold" "$(sys "select has_table_privilege('anon','margin_threshold','select')::text||has_table_privilege('anon','margin_threshold','insert')::text||has_table_privilege('authenticated','margin_threshold','insert')::text" | tail -1)" "falsefalsefalse"
err "#412m: HHL nie wstawi progu bezpośrednio" $HHL \
  "insert into margin_threshold (id, pct) values (true, 9) on conflict (id) do update set pct=9" \
  "permission denied|42501"
val "#412psh: HHL_ADMIN czyta liczbę urządzeń" $HHL \
  "select (push_devices_count()->>'own')||'/'||(push_devices_count()->>'all')" "0/0"
val "#412psh: HHL_OPS czyta liczbę urządzeń" $OPS412 \
  "select (push_devices_count()->>'all')::text" 0
err "#412psh: KSH nie czyta liczby urządzeń" $KSH "select push_devices_count()" "tylko HHL|42501"
err "#412psh: SCX nie czyta liczby urządzeń" $SCX "select push_devices_count()" "tylko HHL|42501"

echo; echo "[#412] E43 treści wiadomości (0289)"
val "#412e43: lista pusta na starcie" $HHL \
  "select jsonb_array_length(message_texts_list())" 0
val "#412e43: HHL_OPS czyta listę" $OPS412 \
  "select jsonb_array_length(message_texts_list())" 0
err "#412e43: KSH nie czyta treści" $KSH "select message_texts_list()" "tylko HHL|42501"
err "#412e43: SCX nie czyta treści" $SCX "select message_texts_list()" "tylko HHL|42501"
val "#412e43: HHL_ADMIN zapisuje SMS_C" $HHL \
  "select message_texts_set('SMS_C', null, '{{code}}: auto {{trailer}} stoi przy {{place}} od {{dwell}}.'); select jsonb_array_length(message_texts_list())" 1 commit
val "#412e43: audit MESSAGE_TEXT_SET" $HHL \
  "select count(*) from audit_log where action='MESSAGE_TEXT_SET' and entity_id='SMS_C'" 1
err "#412e43: HHL_OPS nie zapisze" $OPS412 \
  "select message_texts_set('SMS_A', null, '{{code}}: test.')" "Administrator HHL|42501"
err "#412e43: KSH nie zapisze" $KSH \
  "select message_texts_set('SMS_A', null, '{{code}}: test.')" "Administrator HHL|42501"
err "#412e43: SMS za długi" $HHL \
  "select message_texts_set('SMS_A', null, repeat('x', 161))" "160 znakow|160 znaków|22023"
err "#412e43: SMS place×6 >160 (SMS_WORST)" $HHL \
  "select message_texts_set('SMS_A', null, repeat('{{place}}', 6))" "160 znakow|160 znaków|22023"
err "#412e43: SMS spoza GSM" $HHL \
  "select message_texts_set('SMS_A', null, 'test ' || chr(1103))" "alfabet GSM|niedozwolony|22023"
err "#412e43: SMS [×81 (GSM_EXT ×2)" $HHL \
  "select message_texts_set('SMS_A', null, repeat('[', 81))" "160 znakow|160 znaków|22023"
err "#412e43: niedozwolony znacznik" $HHL \
  "select message_texts_set('SMS_A', null, '{{secret}} x')" "Niedozwolony|znacznik|22023"
err "#412e43: {{button}} tylko LOGIN" $HHL \
  "select message_texts_set('SMS_A', null, '{{code}} {{button}}')" "Niedozwolony|znacznik|22023"
err "#412e43: nieznany kind" $HHL \
  "select message_texts_set('NO_SUCH', 't', 'b')" "Nieznany|22023"
err "#412e43: LOGIN bez przycisku" $HHL \
  "select message_texts_set('INVITE', 'Temat', 'Tresc bez przycisku')" "Przycisk|22023"
err "#412e43: e-mail bez tematu" $HHL \
  "select message_texts_set('RISK_OPEN', null, 'Tresc')" "Temat|22023"
err "#412e43: temat za długi" $HHL \
  "select message_texts_set('RISK_OPEN', repeat('t', 201), 'Tresc')" "200 znakow|200 znaków|22023"
err "#412e43: temat ze znakami sterującymi" $HHL \
  "select message_texts_set('RISK_OPEN', E'temat\r\nBcc: x', 'Tresc')" "sterujac|sterując|22023"
err "#412e43: treść za długa" $HHL \
  "select message_texts_set('RISK_OPEN', 'Temat', repeat('b', 5001))" "5000 znakow|5000 znaków|22023"
val "#412e43: HHL_ADMIN zapisuje INVITE z przyciskiem" $HHL \
  "select (message_texts_set('INVITE', 'Watch Tower — zaproszenie', 'Witaj {{name}}. {{button}} Link {{validity}}.')->>'id')" "INVITE" commit
val "#412e43: lista ma 2 nadpisania" $HHL \
  "select jsonb_array_length(message_texts_list())" 2
val "#412e43: zapis bez zmiany bez audytu" $HHL \
  "select message_texts_set('INVITE', 'Watch Tower — zaproszenie', 'Witaj {{name}}. {{button}} Link {{validity}}.'); select count(*) from audit_log where action='MESSAGE_TEXT_SET' and entity_id='INVITE'" 1
val "#412e43: drugi zapis — old_value" $HHL \
  "select message_texts_set('INVITE', 'Watch Tower — zaproszenie 2', 'Witaj {{name}}. {{button}} Link {{validity}}.'); select (old_value->>'subject') from audit_log where action='MESSAGE_TEXT_SET' and entity_id='INVITE' order by created_at desc, id desc limit 1" "Watch Tower — zaproszenie" commit
err "#412e43: HHL_OPS reset → 42501" $OPS412 \
  "select message_texts_reset('INVITE')" "Administrator HHL|42501"
err "#412e43: SCX zapis → 42501" $SCX \
  "select message_texts_set('SMS_A', null, '{{code}}: test.')" "Administrator HHL|42501"
val "#412e43: przywróć SMS_C" $HHL \
  "select (message_texts_reset('SMS_C')->>'ok')::text" "true" commit
val "#412e43: audit MESSAGE_TEXT_RESET" $HHL \
  "select count(*) from audit_log where action='MESSAGE_TEXT_RESET' and entity_id='SMS_C'" 1
val "#412e43: po resecie 1 nadpisanie" $HHL \
  "select jsonb_array_length(message_texts_list())" 1
val "#412e43: sprzątanie INVITE" $HHL \
  "select (message_texts_reset('INVITE')->>'ok')::text" "true" commit
chk6 "#412e43: anon bez SELECT/INSERT message_texts" "$(sys "select has_table_privilege('anon','message_texts','select')::text||has_table_privilege('anon','message_texts','insert')::text||has_table_privilege('authenticated','message_texts','insert')::text" | tail -1)" "falsefalsefalse"
err "#412e43: HHL nie wstawi bezpośrednio" $HHL \
  "insert into message_texts (kind, channel, body) values ('SMS_A', 'SMS', 'x')" \
  "permission denied|42501"
val "#412e43: KSH SELECT message_texts = 0" $KSH "select count(*) from message_texts" 0

echo; echo "[#484] Historia zmian — zakres HHL_OPS / KSH / SCX (F7 #526)"
OPS484=11111111-0000-0000-0000-0000000000c4
ORG_HHL=00000000-0000-0000-0000-00000000a001
ORG_KSH=00000000-0000-0000-0000-00000000a002
ORG_SCX=00000000-0000-0000-0000-00000000a003
ORG_B=00000000-0000-0000-0000-00000000a004
SCXB=11111111-0000-0000-0000-0000000000c5
sys "insert into organizations (id, code, name, kind) values
     ('$ORG_B','CXB','Przewoznik B','CARRIER')
     on conflict (id) do update set code=excluded.code, name=excluded.name, kind=excluded.kind" >/dev/null
sys "insert into app_users (auth_id, org_id, email, role, active)
     values ('$OPS484','$ORG_HHL','ops-484@test','HHL_OPS',true),
            ('$SCXB','$ORG_B','scxb-484@test','CARRIER_DISPATCH',true)
     on conflict (auth_id) do update set role=excluded.role, active=true, org_id=excluded.org_id" >/dev/null
sys "delete from audit_log where action like 'HIST484_%'" >/dev/null
sys "insert into audit_log (action, entity, entity_id, old_value, new_value, load_id, scope_carrier_org_id, scope_client_org_id) values
     ('HIST484_OWN','loads','$L1','{}',
      jsonb_build_object('status','READY','hhl_order_no','HHL-HIDE','carrier_order_no','SCX-HIDE','order_no','KSH/1','margin',12.5,'pricing',jsonb_build_object('margin_eur',9)),
      '$L1','$ORG_SCX','$ORG_KSH'),
     ('HIST484_OWN','load_cost','$L1','{}', jsonb_build_object('amount',999),
      '$L1','$ORG_SCX','$ORG_KSH'),
     ('HIST484_OWN','load_revenue','$L1','{}', jsonb_build_object('amount',888,'margin',10),
      '$L1','$ORG_SCX','$ORG_KSH'),
     ('HIST484_FEE_REV','load_agreed_fees','$L1','{}',
      jsonb_build_object('side','REVENUE','amount_eur',777),
      '$L1','$ORG_SCX','$ORG_KSH'),
     ('HIST484_FEE_COST','load_agreed_fees','$L1','{}',
      jsonb_build_object('side','COST','amount_eur',666),
      '$L1','$ORG_SCX','$ORG_KSH'),
     ('HIST484_DOC','documents','$L1','{}',
      jsonb_build_object('file_name','Zlecenie_SCX.pdf','visible_to',jsonb_build_array('FORWARDER','CARRIER')),
      '$L1','$ORG_SCX','$ORG_KSH'),
     ('HIST484_RATE','carrier_ratings','$L1','{}',
      jsonb_build_object('score',5,'comment','wewnętrzny'),
      '$L1','$ORG_SCX','$ORG_KSH'),
     ('HIST484_B','loads','$L1','{}',
      jsonb_build_object('status','READY','carrier_order_no','B-ORD-999','driver_name','Jan B'),
      '$L1','$ORG_B','$ORG_KSH'),
     ('HIST484_FOREIGN','loads','33333333-0000-0000-0000-000000000009','{}',
      jsonb_build_object('status','READY'),
      '33333333-0000-0000-0000-000000000009','$ORG_SCX',null)" >/dev/null
val "#484: HHL_OPS widzi wpis" $OPS484 \
  "select count(*) > 0 from admin_audit_history(null,null,null,null,'HIST484_OWN',null,20,0)" t
val "#484: KSH widzi swój loads" $KSH \
  "select count(*) from admin_audit_history(null,null,null,'loads','HIST484_OWN',null,20,0)" 1
val "#484: KSH nie widzi obcego transportu" $KSH \
  "select count(*) from admin_audit_history(null,null,null,null,'HIST484_FOREIGN',null,20,0)" 0
val "#484: KSH bez hhl/carrier order_no" $KSH \
  "select ((new_value ? 'hhl_order_no') is false and (new_value ? 'carrier_order_no') is false)::text from admin_audit_history(null,null,null,'loads','HIST484_OWN',null,5,0) limit 1" true
val "#484: KSH widzi własny order_no" $KSH \
  "select new_value->>'order_no' from admin_audit_history(null,null,null,'loads','HIST484_OWN',null,5,0) limit 1" "KSH/1"
val "#484: KSH nie widzi load_cost" $KSH \
  "select count(*) from admin_audit_history(null,null,null,'load_cost','HIST484_OWN',null,20,0)" 0
val "#484: KSH nie widzi oceny przewoźnika" $KSH \
  "select count(*) from admin_audit_history(null,null,null,null,'HIST484_RATE',null,20,0)" 0
val "#484: KSH nie widzi doc HHL+SCX" $KSH \
  "select count(*) from admin_audit_history(null,null,null,null,'HIST484_DOC',null,20,0)" 0
val "#484: KSH szukaj nie czyta ukrytego numeru" $KSH \
  "select count(*) from admin_audit_history(null,null,null,null,null,'HHL-HIDE',20,0)" 0
val "#484: SCX widzi swój loads" $SCX \
  "select count(*) from admin_audit_history(null,null,null,'loads','HIST484_OWN',null,20,0)" 1
val "#484: SCX nie widzi load_revenue" $SCX \
  "select count(*) from admin_audit_history(null,null,null,'load_revenue','HIST484_OWN',null,20,0)" 0
val "#484: SCX marża usunięta z loads" $SCX \
  "select ((new_value ? 'margin') is false and (new_value->'pricing' ? 'margin_eur') is not true)::text from admin_audit_history(null,null,null,'loads','HIST484_OWN',null,5,0) limit 1" true
val "#484: SCX nie widzi dopłaty REVENUE" $SCX \
  "select count(*) from admin_audit_history(null,null,null,null,'HIST484_FEE_REV',null,20,0)" 0
val "#484: SCX widzi dopłatę COST" $SCX \
  "select count(*) from admin_audit_history(null,null,null,null,'HIST484_FEE_COST',null,20,0)" 1
val "#484: SCX nie widzi historii B po przepięciu" $SCX \
  "select count(*) from admin_audit_history(null,null,null,null,'HIST484_B',null,20,0)" 0
val "#484: B widzi swoją historię" $SCXB \
  "select count(*) from admin_audit_history(null,null,null,null,'HIST484_B',null,20,0)" 1
sys "insert into audit_log (action, entity, entity_id, old_value, new_value, load_id, scope_carrier_org_id, scope_client_org_id, user_id)
     select 'HIST484_MAIL','loads','$L1','{}'::jsonb, jsonb_build_object('status','X'), '$L1','$ORG_SCX','$ORG_KSH', id
       from app_users where auth_id='$SCX' limit 1" >/dev/null
val "#484: KSH autor SCX → nazwa firmy" $KSH \
  "select user_email from admin_audit_history(null,null,null,null,'HIST484_MAIL',null,5,0) limit 1" "Scandinavian Express"
# wydajność: dużo wpisów obcych — filtr po scope_client, limit 8 s (Supabase)
sys "insert into audit_log (action, entity, entity_id, old_value, new_value, load_id, scope_carrier_org_id, scope_client_org_id)
     select 'HIST484_NOISE','loads','33333333-0000-0000-0000-000000000009','{}'::jsonb,'{}'::jsonb,
            '33333333-0000-0000-0000-000000000009','$ORG_SCX','$ORG_KSH'
       from generate_series(1, 4000)" >/dev/null
val "#484: KSH strona < 8 s przy szumie" $KSH \
  "select (extract(epoch from (clock_timestamp() - statement_timestamp())) < 8)::text
     from admin_audit_history(null,null,null,'loads','HIST484_OWN',null,50,0) limit 1" true
err "#484: anon admin_audit_history → 42501" "00000000-0000-0000-0000-000000000000" \
  "select * from admin_audit_history(null,null,null,null,null,null,5,0)" "Brak|42501|administrator|dostępu"

echo; echo "WYNIK: $ok OK, $fail FAIL"
[ "$fail" -eq 0 ]
