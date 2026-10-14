#!/usr/bin/env bash
# E25 (P4) — load_status_set: role, kierunek, UNLOADED→DELIVERED, czas, audit.
. "$(git rev-parse --show-toplevel)/tests/db/refuse-prod.sh"
PSQL="psql ${PGURL:-postgres://postgres@localhost:5433/tower} -Atq"
HHL=11111111-0000-0000-0000-000000000001
KSH=11111111-0000-0000-0000-000000000002
SCX=11111111-0000-0000-0000-000000000003
OPS=11111111-0000-0000-0000-000000000004
L1=33333333-0000-0000-0000-000000000001
L2=33333333-0000-0000-0000-000000000002
P=22222222-0000-0000-0000-000000000001
SCXO=00000000-0000-0000-0000-00000000a003
ok=0; fail=0; bad=""
run() { local end="rollback"; [ "$3" = "commit" ] && end="commit"
  $PSQL -v ON_ERROR_STOP=1 -c "begin; set local role authenticated; set local request.jwt.claim.sub='$1'; $2; $end;" 2>&1; }
val()  { out=$(run "$2" "$3" "$5" | grep -v -E '^(BEGIN|SET|ROLLBACK|COMMIT)$' | tail -1)
         if [ "$out" = "$4" ]; then ok=$((ok+1)); echo "  OK    $1"; else fail=$((fail+1)); bad="${bad} [$1 => ${out}]"; echo "  FAIL  $1  (otrzymano: $out, oczekiwano: $4)"; fi; }
err()  { out=$(run "$2" "$3" | grep -v -E '^(BEGIN|SET|ROLLBACK|COMMIT)$' | tr '\n' ' ')
         if echo "$out" | grep -q "$4"; then ok=$((ok+1)); echo "  OK    $1"; else fail=$((fail+1)); bad="${bad} [$1 => ${out}]"; echo "  FAIL  $1  (brak: $4; było: $out)"; fi; }
sys()  { $PSQL -v ON_ERROR_STOP=1 -c "$1" 2>&1; }
sval() { out=$(sys "$2" | tail -1); if [ "$out" = "$3" ]; then ok=$((ok+1)); echo "  OK    $1"; else fail=$((fail+1)); bad="${bad} [$1 => ${out}]"; echo "  FAIL  $1  (otrzymano: $out, oczekiwano: $3)"; fi; }

sys "insert into app_users (auth_id, org_id, email, role, active)
     values ('$OPS','00000000-0000-0000-0000-00000000a001','ops-e25@test','HHL_OPS',true)
     on conflict (auth_id) do update set role='HHL_OPS', active=true, org_id=excluded.org_id" >/dev/null
sys "update loads set status='READY', carrier_org_id='$SCXO',
     hhl_order_no=coalesce(hhl_order_no,'HHL/E25'), carrier_order_no=coalesce(carrier_order_no,'SCX/E25')
     where id='$L1'" >/dev/null
sys "update loads set status='AT_SITE', carrier_org_id='$SCXO',
     hhl_order_no=coalesce(hhl_order_no,'HHL/E25b'), carrier_order_no=coalesce(carrier_order_no,'SCX/E25b')
     where id='$L2'" >/dev/null

echo; echo "[e25] enum i ranga"
sval "READY_TO_INVOICE w enum" "select count(*) from pg_enum e join pg_type t on t.oid=e.enumtypid where t.typname='load_status' and e.enumlabel='READY_TO_INVOICE'" 1
sval "INVOICED w enum" "select count(*) from pg_enum e join pg_type t on t.oid=e.enumtypid where t.typname='load_status' and e.enumlabel='INVOICED'" 1
sval "UNLOADED i DELIVERED ta sama ranga" "select (load_status_rank('UNLOADED'::load_status)=load_status_rank('DELIVERED'::load_status))" t

echo; echo "[e25] role"
err "HHL_OPS odmowa" $OPS "select load_status_set('$L1','IN_TRANSIT_PL',now(),null)" "Zmiana statusu"
err "KSH odmowa" $KSH "select load_status_set('$L1','IN_TRANSIT_PL',now(),null)" "Zmiana statusu"
val "HHL_ADMIN do przodu" $HHL "select load_status_set('$L1','AT_LOADING',now(),null); select status::text from loads where id='$L1'" AT_LOADING
val "SCX do przodu" $SCX "select load_status_set('$L1','IN_TRANSIT_PL',now(),null); select status::text from loads where id='$L1'" IN_TRANSIT_PL
# Ta sama transakcja: najpierw do przodu, potem próba wstecz (osobny rollback zostawiałby READY→READY = no-op).
err "SCX wstecz" $SCX "select load_status_set('$L1','IN_TRANSIT_PL',now(),null); select load_status_set('$L1','READY',now(),'cofka')" "tylko do przodu"
err "HHL_ADMIN wstecz bez powodu" $HHL "select load_status_set('$L1','IN_TRANSIT_PL',now(),null); select load_status_set('$L1','READY',now(),null)" "powodu"
val "HHL_ADMIN wstecz z powodem" $HHL "select load_status_set('$L1','IN_TRANSIT_PL',now(),null); select load_status_set('$L1','READY',now(),'korekta'); select status::text from loads where id='$L1'" READY

echo; echo "[e25] UNLOADED→DELIVERED, READY_TO_INVOICE/INVOICED (H1), actor i czas (H2)"
# commit: actual_delivery_at i audit sprawdzane osobnym zapytaniem poza transakcją testu
val "UNLOADED → DELIVERED" $HHL "select load_status_set('$L2','UNLOADED',now(),null); select status::text from loads where id='$L2'" DELIVERED commit
sval "actual_delivery_at po Dostarczone" "select (actual_delivery_at is not null) from loads where id='$L2'" t
# H1: CHECK zna STATUS_READY_TO_INVOICE / STATUS_INVOICED (D-20261014-0640-01)
val "SCX → READY_TO_INVOICE + zdarzenie" $SCX "select load_status_set('$L2','READY_TO_INVOICE',now(),null); select status::text || '|' || (select count(*)::text from load_events where load_id='$L2' and event_type='STATUS_READY_TO_INVOICE') from loads where id='$L2'" "READY_TO_INVOICE|1" commit
val "HHL → INVOICED + zdarzenie" $HHL "select load_status_set('$L2','INVOICED',now(),null); select status::text || '|' || (select count(*)::text from load_events where load_id='$L2' and event_type='STATUS_INVOICED') from loads where id='$L2'" "INVOICED|1" commit
# H2: actor w payload; nie wcześniej niż poprzedni status
sval "actor w payload" "select (payload->>'actor' like '% // %') from load_events where load_id='$L2' and event_type='STATUS_INVOICED' order by id desc limit 1" t
err "wcześniej niż poprzedni status" $HHL "select load_status_set('$L2','READY_TO_INVOICE',(select max(occurred_at)-interval '1 second' from load_events where load_id='$L2' and event_type like 'STATUS_%'),'test cofniecia czasu')" "wcześniej"
err "czas w przyszłości" $HHL "select load_status_set('$L1','AT_LOADING',now()+interval '2 hours',null)" "przyszłości"
err "anulowanie bez powodu" $HHL "select load_status_set('$L1','CANCELLED',now(),null)" "powodu"
err "SCX nie anuluje" $SCX "select load_status_set('$L1','CANCELLED',now(),'x')" "Anulowanie"
val "HHL anuluje z powodem" $HHL "select load_status_set('$L1','CANCELLED',now(),'test e25'); select status::text from loads where id='$L1'" CANCELLED
sval "audit LOAD_STATUS_SET" "select count(*)>=1 from audit_log where action='LOAD_STATUS_SET' and entity_id='$L2'" t

echo; echo "WYNIK: $ok OK, $fail FAIL${bad}"
[ "$fail" -eq 0 ]
