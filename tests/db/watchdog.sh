#!/usr/bin/env bash
# TOWER — 0035 strażnik wyniku zadań: brak udanego przebiegu w oknie → ryzyko HHL (+ e-mail, gdy są sekrety Vault).
# Użycie: PGADMIN=postgres://postgres@localhost:5433/postgres bash tests/db/watchdog.sh
set -e
cd "$(git rev-parse --show-toplevel)"
ADMIN=${PGADMIN:-postgres://postgres@localhost:5433/postgres}
DB=tower_test_watchdog; URL="${ADMIN%/*}/$DB"
psql "$ADMIN" -q -c "drop database if exists $DB" -c "create database $DB"
psql "$URL" -q -v ON_ERROR_STOP=1 -f tests/db/supabase_stub.sql
for f in supabase/migrations/*.sql; do psql "$URL" -q -v ON_ERROR_STOP=1 -f "$f" >/dev/null 2>&1 || { echo "MIGRACJA $f: błąd"; exit 1; }; done
psql "$URL" -q -v ON_ERROR_STOP=1 -f tests/db/seed.sql
set +e
PSQL="psql $URL -Atq"
KSH=11111111-0000-0000-0000-000000000002; HHL=11111111-0000-0000-0000-000000000001
ok=0; fail=0
Q() { $PSQL -c "$1" 2>&1 | tail -1; }
chk() { if [ "$2" = "$3" ]; then ok=$((ok+1)); echo "  OK    $1"; else fail=$((fail+1)); echo "  FAIL  $1  (otrzymano: $2, oczekiwano: $3)"; fi; }
st() { Q "select string_agg((e->>'job')||'='||(e->>'stan'), ',' order by e->>'job') from jsonb_array_elements(job_watchdog('$1')) e"; }
open() { Q "select count(*) from risk_signals where kind='JOB_FAILURE' and resolved_at is null ${1:+and detail->>'job'='$1'}"; }
T="2026-10-01 12:00+02"

echo; echo "[0035] Strażnik wyniku zadań"
chk "okres startowy usage-check (przed 27.09 06:00 + 26 h, brak przebiegów)" "$(Q "select e->>'stan' from jsonb_array_elements(job_watchdog('2026-09-27 10:00+02')) e where e->>'job'='usage-check'")" OKRES_STARTOWY
chk "brak jakichkolwiek przebiegów: ferry-ais, send-notifications i usage-check ALARM, kopia nieuzbrojona (bez R2)" "$(st "$T")" "backup=NIEUZBROJONY (brak pierwszej udanej kopii),ferry-ais=ALARM,send-notifications=ALARM,usage-check=ALARM"
chk "3 ryzyka JOB_FAILURE (1 projekt × 3 zadania)"                  "$(open)" 3
chk "ponowne wywołanie przy trwającym alarmie: bez drugiego e-maila"  "$(Q "select e->>'email' from jsonb_array_elements(job_watchdog('$T')) e where e->>'job'='ferry-ais'")" BEZ_ZMIAN
chk "ponowne wywołanie: bez duplikatów"                              "$(open)" 3
chk "send-notifications: okres startowy do 26.09 17:30 PL"           "$(Q "select e->>'stan' from jsonb_array_elements(job_watchdog('2026-09-26 17:20+02')) e where e->>'job'='send-notifications'")" OKRES_STARTOWY
chk "ryzyko widzi tylko HHL (audience)"                              "$(Q "select string_agg(distinct audience::text, ',') from risk_signals where kind='JOB_FAILURE'")" HHL
chk "KSH nie widzi ryzyka zadania"                                   "$($PSQL -c "begin; set local role authenticated; set local request.jwt.claim.sub='$KSH'; select count(*) from risk_signals where kind='JOB_FAILURE'; rollback;" 2>&1 | grep -E '^[0-9]+$')" 0
chk "HHL widzi ryzyka zadań"                                         "$($PSQL -c "begin; set local role authenticated; set local request.jwt.claim.sub='$HHL'; select count(*) from risk_signals where kind='JOB_FAILURE'; rollback;" 2>&1 | grep -E '^[0-9]+$')" 3
Q "insert into integration_runs (job, ran_at, ok) values ('ferry-ais', timestamptz '$T' - interval '10 minutes', true)" >/dev/null
chk "udany przebieg ferry-ais → OK, ryzyko zamknięte"                "$(st "$T" | tr ',' '\n' | grep ferry)" "ferry-ais=OK"
chk "otwarte ryzyka ferry-ais: 0"                                    "$(open ferry-ais)" 0
# symulowany błąd funkcji: kolejne przebiegi kończą się błędem (ok=false) — jak 403/500 z funkcji Edge
Q "insert into integration_runs (job, ran_at, ok, result) select 'ferry-ais', timestamptz '$T' + g * interval '10 minutes', false, '{\"error\":\"symulacja 500\"}' from generate_series(0,5) g" >/dev/null
chk "błąd od 12:00, strażnik 12:17 (27 min od sukcesu) → jeszcze OK"  "$(st "2026-10-01 12:17+02" | tr ',' '\n' | grep ferry)" "ferry-ais=OK"
chk "strażnik 13:07 (najbliższy cogodzinny przebieg) → ALARM; bez sekretów Vault e-mail pominięty" "$(Q "select (e->>'stan')||'/'||(e->>'email') from jsonb_array_elements(job_watchdog('2026-10-01 13:07+02')) e where e->>'job'='ferry-ais'")" "ALARM/BRAK_SEKRETOW"
chk "nowe ryzyko ferry-ais: 1"                                        "$(open ferry-ais)" 1
chk "przebiegi z błędem (ok=false) nie liczą się jako sukces"         "$(Q "select job_last_success('ferry-ais') = timestamptz '$T' - interval '10 minutes'")" t
Q "insert into backup_runs (started_at, finished_at, status) values (timestamptz '$T' - interval '27 hours', timestamptz '$T' - interval '27 hours', 'OK')" >/dev/null
chk "kopia uzbrojona po pierwszym sukcesie; 27 h bez kopii → ALARM"  "$(st "$T" | tr ',' '\n' | grep backup)" "backup=ALARM"
Q "insert into backup_runs (started_at, finished_at, status) values (timestamptz '$T' - interval '2 hours', timestamptz '$T' - interval '2 hours', 'ERROR')" >/dev/null
chk "kopia z błędem nie zamyka alarmu"                                "$(st "$T" | tr ',' '\n' | grep backup)" "backup=ALARM"
Q "insert into backup_runs (started_at, finished_at, status) values (timestamptz '$T' - interval '1 hour', timestamptz '$T' - interval '1 hour', 'OK')" >/dev/null
chk "udana kopia → OK, ryzyko zamknięte"                              "$(st "$T" | tr ',' '\n' | grep backup)-$(open backup)" "backup=OK-0"
chk "authenticated nie wywoła strażnika"                              "$($PSQL -c "begin; set local role authenticated; select job_watchdog(); rollback;" 2>&1 | grep -oE 'permission denied' | head -1)" "permission denied"
chk "anon nie wywoła strażnika"                                       "$($PSQL -c "begin; set local role anon; select job_watchdog(); rollback;" 2>&1 | grep -oE 'permission denied' | head -1)" "permission denied"
echo; echo "WYNIK: $ok OK, $fail FAIL"
