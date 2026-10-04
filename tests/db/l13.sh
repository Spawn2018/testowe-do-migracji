#!/usr/bin/env bash
# L-13 — zalew: odsiadanie, raport, szacunek poczty. Bez wysyłki e-maila i SMS.
. "$(git rev-parse --show-toplevel)/tests/db/refuse-prod.sh"
PSQL="psql ${PGURL:-postgres://postgres@localhost:5433/tower} -Atq"
P=22222222-0000-0000-0000-000000000001
L=33333333-0000-0000-0000-00000000d13a
G1=a1300000-0000-4000-8000-000000000001
G2=a1300000-0000-4000-8000-000000000002
ok=0; fail=0
sys() { $PSQL -v ON_ERROR_STOP=1 -c "$1" 2>&1; }
val() {
  out=$(sys "$2" | grep -v -E '^(BEGIN|SET|ROLLBACK|COMMIT)$' | tail -1)
  if [ "$out" = "$3" ]; then ok=$((ok+1)); echo "  OK    $1"; else fail=$((fail+1)); echo "  FAIL  $1 (otrzymano: $out, oczekiwano: $3)"; fi
}
sys "set session_replication_role=replica;
 delete from decision_events where decision_id in (select id from decisions where load_id='$L');
 delete from notifications where load_id='$L' or dedup_key like 'l13-%';
 delete from decisions where load_id='$L';
 delete from risk_signals where load_id='$L' or dedup_key like 'L13:%';
 delete from load_events where load_id='$L';
 delete from loads where id='$L';
 delete from email_budget_day;
 delete from integration_runs where job='email-budget';
 set session_replication_role=origin;" >/dev/null
sys "insert into loads (id, project_id, carrier_org_id, order_no, hhl_order_no, carrier_order_no, status)
 values ('$L','$P','00000000-0000-0000-0000-00000000a003','KSH/L13','HHL/L13','SCX/L13','PLANNED')" >/dev/null

# Dobowy ruch jednego transportu (fixture, nie cała wielodniowa SIM-1).
sys "update loads set status='READY' where id='$L'" >/dev/null
sys "update loads set status='IN_TRANSIT_PL' where id='$L'" >/dev/null
sys "update loads set status='AT_PORT_GDANSK' where id='$L'" >/dev/null
sys "insert into load_events (load_id, event_type, occurred_at, payload) values
 ('$L','GEOFENCE_ENTER','2026-10-04 08:00+02','{\"geofence_id\":\"$G1\",\"geofence_kind\":\"PORT_OUT\",\"geofence_name\":\"SIM1 Port\"}'),
 ('$L','GEOFENCE_EXIT','2026-10-04 08:10+02','{\"geofence_id\":\"$G1\",\"geofence_kind\":\"PORT_OUT\",\"geofence_name\":\"SIM1 Port\"}'),
 ('$L','GEOFENCE_ENTER','2026-10-04 09:00+02','{\"geofence_id\":\"$G2\",\"geofence_kind\":\"PORT_OUT\",\"geofence_name\":\"SIM1 Bufor\"}'),
 ('$L','GEOFENCE_EXIT','2026-10-04 09:10+02','{\"geofence_id\":\"$G2\",\"geofence_kind\":\"PORT_OUT\",\"geofence_name\":\"SIM1 Bufor\"}')" >/dev/null
sys "insert into risk_signals (project_id, load_id, kind, severity, title, title_key, detail, dedup_key)
 values ('$P','$L','ETA_BREACH','HIGH','L13 ETA','rk_eta','{\"l13\":\"1\"}','L13:ETA:$L')" >/dev/null
N0=$(sys "select count(*) from notifications where load_id='$L'" | tail -1)
sys "insert into load_events (load_id, event_type, occurred_at, payload) values
 ('$L','GEOFENCE_ENTER','2026-10-04 18:00+02','{\"geofence_id\":\"$G1\",\"geofence_kind\":\"PORT_OUT\",\"geofence_name\":\"SIM1 Port\"}'),
 ('$L','GEOFENCE_EXIT','2026-10-04 18:10+02','{\"geofence_id\":\"$G1\",\"geofence_kind\":\"PORT_OUT\",\"geofence_name\":\"SIM1 Port\"}')" >/dev/null
val "drugi wjazd do tej samej strefy nie dodaje wpisu" "select count(*) from notifications where load_id='$L'" "$N0"
sys "update loads set status='FERRY' where id='$L'" >/dev/null
sys "update loads set status='AT_PORT_GDANSK' where id='$L'" >/dev/null
N1=$(sys "select count(*) from notifications where load_id='$L'" | tail -1)
sys "update loads set status='FERRY' where id='$L'" >/dev/null
val "powtórne przejście na prom nie dodaje wpisu" "select count(*) from notifications where load_id='$L'" "$N1"
val "decyzja automatyczna tylko w aplikacji" "select coalesce(string_agg(distinct channel, ','), '') from notifications where load_id='$L' and template='DECISION_OPEN'" "IN_APP"
val "brak e-maila decyzji automatycznej" "select count(*) from notifications where load_id='$L' and template='DECISION_OPEN' and channel='EMAIL'" 0
val "brak SMS z fixture" "select count(*) from sms_outbox where load_id='$L'" 0
val "raport = liczba wierszy (bez ukrytego dubla)" "select (notification_flood_report('$L')->>'total') = (select count(*)::text from notifications where load_id='$L' and channel='IN_APP')" t
val "raport ma firmę, typ i odbiorcę" "select (count(*) > 0) from jsonb_array_elements(notification_flood_report('$L')->'breakdown') e where e->>'company'='HHL' and e->>'template'='LOAD_STATUS_CHANGED' and e->>'recipient'='hhl@test'" t
val "na transport i firmę: trzy firmy" "select string_agg(x.company, ',' order by x.company) from jsonb_to_recordset(notification_flood_report('$L')->'per_company') as x(company text, n int)" "HHL,KSH,SCX"

# Stary klucz ze znacznikiem minuty liczy się raz.
HHL=$(sys "select id from app_users where email='hhl@test'" | tail -1)
sys "insert into notifications (channel, recipient, user_id, load_id, template, payload, dedup_key) values
 ('IN_APP','hhl@test','$HHL','$L','ZONE_ENTER','{}','zone:GEOFENCE_ENTER:$L:$G1:202610040800:IN:$HHL'),
 ('IN_APP','hhl@test','$HHL','$L','ZONE_ENTER','{}','zone:GEOFENCE_ENTER:$L:$G1:202610041801:IN:$HHL')" >/dev/null
val "dwa stare klucze z zegarem = jeden w raporcie" "select (select count(*) from notifications where load_id='$L') - (notification_flood_report('$L')->>'total')::int" 1

# Szacunek: gdyby każdy wpis IN_APP był e-mailem. 1 skrzynka na firmę.
sys "update risk_signals set severity='CRITICAL' where dedup_key='L13:ETA:$L'" >/dev/null
PROJ=$(sys "select l13_email_projection((
  select jsonb_agg(jsonb_build_object('company', company, 'noncritical', noncritical, 'critical', critical))
  from (
    select o.code as company,
           count(*) filter (where not l13_email_is_critical(n.template, n.payload))::int as noncritical,
           count(*) filter (where l13_email_is_critical(n.template, n.payload))::int as critical
    from notifications n
    join app_users u on u.id = n.user_id
    join organizations o on o.id = u.org_id
    where n.load_id='$L' and n.channel='IN_APP'
      and coalesce(n.dedup_key,'') not like 'zone:GEOFENCE_ENTER:$L:$G1:20261004%'
    group by o.code
  ) s
), 94, 10)::text" | tail -1)
echo "  RAPORT $PROJ"
val "szacunek ponad 60 na dobę" "select ('$PROJ'::jsonb->>'over_60')" true
val "e-mail decyzji automatycznych wyłączony" "select ('$PROJ'::jsonb->>'automatic_decision_email')" false
val "szczyt 10 w ruchu, osobno, ponad 100" "select (('$PROJ'::jsonb->>'one_each_peak_10')::int > 100)" t
val "94 transporty, osobno, ponad limit Resend" "select (('$PROJ'::jsonb->>'one_each_fleet_94')::int > 100)" t
val "ze skrótem szczyt mieści się w 100" "select (('$PROJ'::jsonb->>'digest_peak_10')::int < 100)" t
val "94 z krytycznym przekracza 100 i jest cięte do limitu" "select (('$PROJ'::jsonb->>'digest_fleet_uncapped')::int > 100) and (('$PROJ'::jsonb->>'digest_fleet_capped')::int = 100)" t

# Macierz: niekrytyczny e-mail = DIGEST, nie PENDING. Nic nie wychodzi do Resend.
sys "select matrix_notify('DECISION','DECISION_RESOLVED','$L','$P','{\"title\":\"l13\"}'::jsonb,'l13-nc','FORWARDER')" >/dev/null
val "niekrytyczny e-mail macierzy to skrót" "select status from notifications where dedup_key like 'l13-nc:EM:%'" DIGEST

sys "insert into notifications (channel, recipient, template, status, dedup_key)
 select 'EMAIL','hhl@test','L13_FILL','SENT','l13-fill-'||g from generate_series(1,80) g" >/dev/null
sys "select l13_email_guard_note()" >/dev/null
val "przy 80 ostrzeżenie w przebiegu Stanu systemu" "select level||'/'||(select count(*) from integration_runs where job='email-budget' and ok is false) from l13_email_counts()" "warn/1"
sys "insert into notifications (channel, recipient, template, status, dedup_key)
 select 'EMAIL','hhl@test','L13_FILL','SENT','l13-fill-b-'||g from generate_series(1,15) g" >/dev/null
sys "select matrix_notify('DECISION','DECISION_OPEN','$L','$P','{\"title\":\"l13b\"}'::jsonb,'l13-nc2','FORWARDER')" >/dev/null
val "przy 95 niekrytyczny e-mail wstrzymany" "select status from notifications where dedup_key like 'l13-nc2:EM:%'" SUPPRESSED
sys "select matrix_notify('DECISION','DECISION_ESCALATED','$L','$P','{\"level\":\"critical\",\"type\":\"FERRY_CANCELLED\"}'::jsonb,'l13-crit','FORWARDER')" >/dev/null
val "krytyczny (odwołany prom) jeszcze wychodzi jako kolejka" "select status from notifications where dedup_key like 'l13-crit:EM:%'" PENDING
sys "insert into notifications (channel, recipient, template, status, dedup_key)
 select 'EMAIL','hhl@test','L13_FILL','SENT','l13-fill-c-'||g from generate_series(1,4) g" >/dev/null
sys "select matrix_notify('DECISION','DECISION_ESCALATED','$L','$P','{\"level\":\"critical\",\"type\":\"FERRY_CANCELLED\"}'::jsonb,'l13-crit2','FORWARDER')" >/dev/null
val "przy 100 także krytyczny stoi (limit Resend)" "select status from notifications where dedup_key like 'l13-crit2:EM:%'" SUPPRESSED
val "drugie ostrzeżenie tego dnia nie dubluje wpisu" "select count(*) from integration_runs where job='email-budget'" 1

echo; echo "WYNIK: $ok OK, $fail FAIL"
[ "$fail" -eq 0 ]
