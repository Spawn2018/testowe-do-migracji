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
err "KSH nie zmieni kwoty faktury HHL"               $KSH "update invoices set net_total=1 where id='$INVP'" "weryfikowa"
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
err "HHL nie zmieni numeru zlecenia przewoźnika"       $HHL "update loads set carrier_order_no='ZMIENIONY' where id='$L2'" "wyłącznie przewoźnik"
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
sys "
do \$\$
declare i int; u uuid := '$HHLID';
begin
  for i in 1..25 loop
    insert into notifications (channel, recipient, user_id, template, payload, dedup_key, status)
    values ('EMAIL', 'hhl@test', u, 'B6T' || ((i - 1) / 5)::text, '{}'::jsonb, 'b6mail:' || i, 'PENDING');
  end loop;
end \$\$;
" >/dev/null
val "B6: 20 e-maili na osobę na dobę" $HHL "select count(*) from notifications where user_id='$HHLID' and channel='EMAIL' and template like 'B6T%'" 20
val "B6: 1 wiadomość zbiorcza" $HHL "select count(*) from notifications where user_id='$HHLID' and template='EMAIL_BUDGET'" 1
val "B6: tytuł limitu" $HHL "select payload->>'title' from notifications where user_id='$HHLID' and template='EMAIL_BUDGET'" "Limit e-maili na dziś"
val "B6: treść limitu" $HHL "select payload->>'body' from notifications where user_id='$HHLID' and template='EMAIL_BUDGET'" "Dziś dostałeś już 20 e-maili z Watch Tower. Kolejne powiadomienia z dzisiaj są w dzwonku i w aplikacji na telefonie. E-maile wrócą jutro."
val "B6: EMAIL_BUDGET w treściach" $HHL "select subject_pl from notification_copy where id='EMAIL_BUDGET'" "Limit e-maili na dziś"
sys "insert into notifications (channel, recipient, user_id, template, payload, dedup_key, status)
     values ('EMAIL', 'hhl@test', '$HHLID', 'B6PILNY', '{\"push_fallback\":true}'::jsonb, 'b6mail:pilny', 'PENDING')" >/dev/null
val "B6: e-mail zapasowy poza limitem" $HHL "select count(*) from notifications where user_id='$HHLID' and template='B6PILNY'" 1

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

echo; echo "WYNIK: $ok OK, $fail FAIL"
[ "$fail" -eq 0 ]
