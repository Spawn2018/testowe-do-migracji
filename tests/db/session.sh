#!/usr/bin/env bash
# TOWER — ANEKS 5 §4.5: sesja użytkownika 365 dni, odwoływanie, dezaktywacja (czysty Postgres + atrapa auth.sessions).
# Użycie: PGADMIN=postgres://postgres@localhost:5433/postgres bash tests/db/session.sh
set -e
cd "$(git rev-parse --show-toplevel)"
ADMIN=${PGADMIN:-postgres://postgres@localhost:5433/postgres}
DB=tower_test_session; URL="${ADMIN%/*}/$DB"
psql "$ADMIN" -q -c "drop database if exists $DB" -c "create database $DB"
psql "$URL" -q -v ON_ERROR_STOP=1 -f tests/db/supabase_stub.sql
for f in supabase/migrations/*.sql; do psql "$URL" -q -v ON_ERROR_STOP=1 -f "$f" >/dev/null 2>&1 || { echo "MIGRACJA $f: błąd"; exit 1; }; done
psql "$URL" -q -v ON_ERROR_STOP=1 -f tests/db/seed.sql
set +e
PSQL="psql $URL -Atq"
HHL=11111111-0000-0000-0000-000000000001; KSH=11111111-0000-0000-0000-000000000002; SCX=11111111-0000-0000-0000-000000000003
DRV=11111111-0000-0000-0000-0000000000d1
ok=0; fail=0
run() { local end="rollback"; [ "$3" = "commit" ] && end="commit"
  $PSQL -v ON_ERROR_STOP=1 -c "begin; set local role ${ROLE:-authenticated}; set local request.jwt.claim.sub='$1'; set local request.jwt.claims='${CLAIMS:-{\}}'; $2; $end;" 2>&1; }
val() { out=$(run "$2" "$3" "$5" | grep -v -E '^(BEGIN|SET|ROLLBACK|COMMIT)$' | tail -1)
  if [ "$out" = "$4" ]; then ok=$((ok+1)); echo "  OK    $1"; else fail=$((fail+1)); echo "  FAIL  $1  (otrzymano: $out, oczekiwano: $4)"; fi; }
err() { out=$(run "$2" "$3"); if echo "$out" | grep -qiE "$4"; then ok=$((ok+1)); echo "  OK    $1"; else fail=$((fail+1)); echo "  FAIL  $1  →  $(echo "$out" | tail -1)"; fi; }
Q() { $PSQL -c "$1" 2>&1 | tail -1; }
chk() { if [ "$2" = "$3" ]; then ok=$((ok+1)); echo "  OK    $1"; else fail=$((fail+1)); echo "  FAIL  $1  (otrzymano: $2, oczekiwano: $3)"; fi; }

S_OLD=aaaaaaaa-0000-0000-0000-000000000001; S_NEW=aaaaaaaa-0000-0000-0000-000000000002
$PSQL -c "insert into auth.sessions (id, user_id, created_at, user_agent) values
  ('$S_OLD', '$HHL', now() - interval '366 days', 'Firefox stary laptop'),
  ('$S_NEW', '$HHL', now() - interval '364 days', 'Chrome biuro'),
  (gen_random_uuid(), '$KSH', now() - interval '1 day', 'Safari'), (gen_random_uuid(), '$KSH', now(), 'Edge'),
  (gen_random_uuid(), '$SCX', now(), 'Chrome telefon')" >/dev/null

echo; echo "[A5-SESJA-ROK] Rok od logowania — zadanie pg_cron"
err "anon nie wywoła purge_expired_sessions"            "" "set local role anon; select purge_expired_sessions()" "permission denied"
err "zalogowany (HHL) nie wywoła purge_expired_sessions" $HHL "select purge_expired_sessions()" "permission denied"
chk "zadanie usuwa 1 sesję (> 365 dni)"                  "$(Q "select purge_expired_sessions()")" 1
chk "sesja 366 dni usunięta"                             "$(Q "select count(*) from auth.sessions where id='$S_OLD'")" 0
chk "sesja 364 dni nietknięta"                           "$(Q "select count(*) from auth.sessions where id='$S_NEW'")" 1
chk "pozostałe sesje nietknięte (4)"                     "$(Q "select count(*) from auth.sessions")" 4
chk "JWT (token dostępu) = 3600 s w konfiguracji"        "$(grep -E '^jwt_expiry' supabase/config.toml | tr -d ' ')" "jwt_expiry=3600"
chk "link z e-maila ważny ≤ 3600 s (otp_expiry)"         "$(awk -F= '/^otp_expiry/{gsub(/ /,"",$2); print ($2<=3600)?"t":"f"}' supabase/config.toml)" t

echo; echo "[A5-SESJA-ROK] Moje urządzenia"
CLAIMS="{\"session_id\":\"$S_NEW\"}" val "HHL widzi 1 urządzenie, bieżące oznaczone" $HHL "select count(*)||':'||bool_and(is_current) from my_sessions()" "1:true"
val "wygaśnięcie = logowanie + 365 dni"                  $HHL "select bool_and(expires_at = created_at + interval '365 days') from my_sessions()" t
val "przeglądarka widoczna"                              $HHL "select user_agent from my_sessions()" "Chrome biuro"
val "KSH widzi tylko swoje (2)"                          $KSH "select count(*) from my_sessions()" 2
err "anon nie wywoła my_sessions"                        "" "set local role anon; select * from my_sessions()" "permission denied"

echo; echo "[A5-SESJA-ROK] Odwoływanie"
U_SCX=$(Q "select id from app_users where auth_id='$SCX'"); U_HHL=$(Q "select id from app_users where auth_id='$HHL'")
err "KSH nie wyloguje SCX"                               $KSH "select revoke_user_sessions('$U_SCX')" "wyłącznie HHL"
err "przewoźnik nie wyloguje HHL"                        $SCX "select revoke_user_sessions('$U_HHL')" "wyłącznie HHL"
val "KSH: wyloguj ze wszystkich urządzeń (2 sesje)"      $KSH "select revoke_user_sessions()" 2 commit
chk "KSH: 0 sesji"                                       "$(Q "select count(*) from auth.sessions where user_id='$KSH'")" 0
val "HHL wylogowuje przewoźnika (zgubiony laptop)"       $HHL "select revoke_user_sessions('$U_SCX')" 1 commit
chk "SCX: 0 sesji; HHL: sesja nietknięta"                "$(Q "select count(*) filter (where user_id='$SCX')||':'||count(*) filter (where user_id='$HHL') from auth.sessions")" "0:1"
chk "wylogowania w dzienniku audytu (2)"                 "$(Q "select count(*) from audit_log where action='SESSIONS_REVOKE'")" 2

echo; echo "[A5-SESJA-ROK] Dezaktywacja odcina dane natychmiast"
$PSQL -c "insert into app_users (auth_id, org_id, email, role) values ('$DRV','00000000-0000-0000-0000-00000000a003','dysp2@test','CARRIER_DISPATCH');
  insert into auth.sessions (user_id, user_agent) values ('$DRV','A'),('$DRV','B')" >/dev/null
$PSQL -c "create or replace function public.t_visible_rows() returns bigint language plpgsql as \$f\$
  declare t record; n bigint := 0; c bigint;
  begin for t in select c2.relname from pg_class c2 join pg_namespace ns on ns.oid=c2.relnamespace
                  where ns.nspname='public' and c2.relkind in ('r','v','p') and c2.relname not in ('spatial_ref_sys','geometry_columns','geography_columns') loop
    begin execute format('select count(*) from public.%I', t.relname) into c; n := n + c;
    exception when insufficient_privilege then null; end; end loop; return n; end \$f\$;
  grant execute on function public.t_visible_rows() to authenticated" >/dev/null
val "przed dezaktywacją: dyspozytor widzi dane (> 0 wierszy)" $DRV "select t_visible_rows() > 0" t
$PSQL -c "update app_users set active = false where auth_id='$DRV'" >/dev/null
chk "dezaktywacja: sesje usunięte od razu"               "$(Q "select count(*) from auth.sessions where user_id='$DRV'")" 0
val "zdezaktywowany z ważnym tokenem: 0 wierszy we wszystkich tabelach" $DRV "select t_visible_rows()" 0
val "zdezaktywowany: Moje urządzenia puste"              $DRV "select count(*) from my_sessions()" 0
err "zdezaktywowany nie wywoła wylogowania"              $DRV "select revoke_user_sessions()" "Brak aktywnego konta"
echo; echo "WYNIK: $ok OK, $fail FAIL"
