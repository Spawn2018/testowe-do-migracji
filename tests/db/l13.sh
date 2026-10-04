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
val "decyzja automatyczna zostaje w aplikacji" "select count(*) > 0 from notifications where load_id='$L' and template='DECISION_OPEN' and channel='IN_APP'" t
val "e-mail decyzji niekrytycznej to skrót" "select status from notifications where channel='EMAIL' and dedup_key like 'digest:%'" DIGEST
val "brak SMS z fixture" "select count(*) from sms_outbox where load_id='$L'" 0
val "raport = liczba wierszy (bez ukrytego dubla)" "select (notification_flood_report('$L')->>'total') = (select count(*)::text from notifications where load_id='$L')" t
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
val "e-mail decyzji automatycznych włączony" "select ('$PROJ'::jsonb->>'automatic_decision_email')" true
val "szczyt 10 w ruchu, osobno, ponad 100" "select (('$PROJ'::jsonb->>'one_each_peak_10')::int > 100)" t
val "94 transporty, osobno, ponad limit Resend" "select (('$PROJ'::jsonb->>'one_each_fleet_94')::int > 100)" t
val "ze skrótem szczyt mieści się w 100" "select (('$PROJ'::jsonb->>'digest_peak_10')::int < 100)" t
val "94 z krytycznym przekracza 90 i jest cięte do limitu operacyjnego" "select (('$PROJ'::jsonb->>'digest_fleet_uncapped')::int > 90) and (('$PROJ'::jsonb->>'digest_fleet_capped')::int = 90)" t

# Macierz: niekrytyczny e-mail = DIGEST, nie PENDING. Nic nie wychodzi do Resend.
sys "select matrix_notify('DECISION','DECISION_RESOLVED','$L','$P','{\"title\":\"l13\"}'::jsonb,'l13-nc','FORWARDER')" >/dev/null
val "niekrytyczny e-mail macierzy to jeden skrót" "select count(*)||status from notifications where channel='EMAIL' and dedup_key like 'digest:%' group by status" "1DIGEST"

sys "insert into notifications (channel, recipient, template, status, dedup_key)
 select 'EMAIL','hhl@test','L13_FILL','SENT','l13-fill-'||g from generate_series(1,80) g" >/dev/null
sys "select l13_email_guard_note()" >/dev/null
val "przy 80 ostrzeżenie w przebiegu Stanu systemu" "select level||'/'||(select count(*) from integration_runs where job='email-budget' and ok is false) from l13_email_counts()" "warn/1"
sys "delete from notifications where channel='EMAIL' and dedup_key like 'digest:%'" >/dev/null
sys "insert into notifications (channel, recipient, template, status, dedup_key)
 select 'EMAIL','hhl@test','L13_FILL','SENT','l13-fill-b-'||g from generate_series(1,5) g" >/dev/null
sys "select matrix_notify('DECISION','DECISION_OPEN','$L','$P','{\"title\":\"l13b\"}'::jsonb,'l13-nc2','FORWARDER')" >/dev/null
val "przy 85 niekrytyczny e-mail wstrzymany" "select status from notifications where dedup_key like 'digest:%'" SUPPRESSED
sys "select matrix_notify('DECISION','DECISION_ESCALATED','$L','$P','{\"level\":\"critical\",\"type\":\"FERRY_CANCELLED\"}'::jsonb,'l13-crit','FORWARDER')" >/dev/null
val "krytyczny jeszcze wychodzi jako kolejka" "select status from notifications where dedup_key like 'l13-crit:EM:%'" PENDING
sys "insert into notifications (channel, recipient, template, status, dedup_key)
 select 'EMAIL','hhl@test','L13_FILL','SENT','l13-fill-c-'||g from generate_series(1,4) g" >/dev/null
sys "select matrix_notify('DECISION','DECISION_ESCALATED','$L','$P','{\"level\":\"critical\",\"type\":\"FERRY_CANCELLED\"}'::jsonb,'l13-crit2','FORWARDER')" >/dev/null
val "przy 90 także krytyczny stoi" "select status from notifications where dedup_key like 'l13-crit2:EM:%'" SUPPRESSED
val "drugie ostrzeżenie tego dnia nie dubluje wpisu" "select count(*) from integration_runs where job='email-budget'" 1


# Jedno zdarzenie, pięć transportów, jeden e-mail na odbiorcę.
sys "delete from notifications where channel='EMAIL' or dedup_key like 'bundle:sail-%' or load_id in (select id from loads where order_no like 'L13-B%');
 delete from decision_events where decision_id in (select id from decisions where detail->>'bundle_key' in ('sail-9','sail-full'));
 delete from decisions where detail->>'bundle_key' in ('sail-9','sail-full');
 delete from loads where order_no like 'L13-B%';" >/dev/null
for i in 1 2 3 4 5; do
  sys "insert into loads (id, project_id, carrier_org_id, order_no, hhl_order_no, carrier_order_no, status)
   values ('33333333-0000-0000-0000-00000000b10$i','$P','00000000-0000-0000-0000-00000000a003','L13-B$i','HHL/B$i','SCX/B$i','PLANNED')" >/dev/null
  sys "select decision_open_from_event('$P','FERRY_CANCELLED','l13-sail-$i','Prom odwołany','{\"bundle_key\":\"sail-9\"}'::jsonb,'33333333-0000-0000-0000-00000000b10$i',null)" >/dev/null
done
val "5 transportów → 1 e-mail na odbiorcę" "select count(*) from notifications where channel='EMAIL' and dedup_key like 'bundle:sail-9:EM:%'" 1
val "lista ma 5 transportów" "select jsonb_array_length(payload->'transports') from notifications where dedup_key like 'bundle:sail-9:EM:%'" 5
KSHU=$(sys "select id from app_users where email='ksh@test'" | tail -1)
for i in 1 2 3 4 5; do
  sys "select l13_queue_email('critical','DECISION_OPEN','$KSHU','ksh@test','33333333-0000-0000-0000-00000000b10$i','L13-B$i','{}'::jsonb,'l13-ksh-$i','sail-9')" >/dev/null
done
val "drugi odbiorca dostaje swój jeden e-mail" "select count(*) from notifications where channel='EMAIL' and dedup_key like 'bundle:sail-9:EM:%'" 2
IN0=$(sys "select count(*) from notifications where channel='IN_APP' and template='DECISION_OPEN' and load_id='33333333-0000-0000-0000-00000000b101'" | tail -1)
sys "insert into notifications (channel, recipient, template, status, dedup_key)
 select 'EMAIL','hhl@test','L13_FILL','SENT','l13-cap-'||g from generate_series(1,90) g" >/dev/null
sys "select decision_open_from_event('$P','FERRY_CANCELLED','l13-sail-full','Prom odwołany','{\"bundle_key\":\"sail-full\"}'::jsonb,'33333333-0000-0000-0000-00000000b101',null)" >/dev/null
val "po limicie aplikacja dalej dostaje wpis" "select count(*) > $IN0 from notifications where channel='IN_APP' and template='DECISION_OPEN' and load_id='33333333-0000-0000-0000-00000000b101'" t
HHL=11111111-0000-0000-0000-000000000001
val "po limicie e-mail nie wychodzi" "select status from notifications where dedup_key like 'bundle:sail-full:EM:%'" SUPPRESSED
val "stan systemu: ile i do kogo" "begin; select set_config('request.jwt.claim.sub','$HHL',true); set local role authenticated; select ((email_budget_status()->>'suppressed_n')::int > 0 and (email_budget_status()->'suppressed_to')::text like '%hhl@test%')::text; rollback" true
# Rezerwa 10. Najpierw krytyczne, potem skrót.
sys "delete from notifications where channel='EMAIL' and (template in ('L13_FILL','AUTH_INVITE') or status in ('PENDING','DIGEST','SUPPRESSED'));" >/dev/null
sys "insert into notifications (channel, recipient, template, status, dedup_key)
 select 'EMAIL','hhl@test','L13_FILL','SENT','l13-ord-'||g from generate_series(1,84) g" >/dev/null
sys "select matrix_notify('DECISION','DECISION_RESOLVED','$L','$P','{\"title\":\"skrot\"}'::jsonb,'l13-ord-d','FORWARDER')" >/dev/null
sys "select matrix_notify('DECISION','DECISION_ESCALATED','$L','$P','{\"level\":\"critical\"}'::jsonb,'l13-ord-c','FORWARDER')" >/dev/null
val "przy limicie skrót czeka" "select status from notifications where dedup_key like 'digest:%'" DIGEST
val "przy limicie krytyczny jest pierwszy w kolejce" "select status from notifications where dedup_key like 'l13-ord-c:EM:%'" PENDING
val "skrót nie rusza, póki krytyczny czeka" "select l13_promote_digests()" 0
sys "update notifications set status='SENT' where dedup_key like 'l13-ord-c:EM:%'" >/dev/null
val "po krytycznym, przy 85, skrót nadal czeka" "select l13_promote_digests()" 0
for i in $(seq 1 10); do
  sys "select l13_auth_email_book('AUTH_INVITE','hhl@test')" >/dev/null
done
val "10 zaproszeń mieści się w rezerwie" "select count(*) from notifications where template='AUTH_INVITE' and status='PENDING'" 10
val "11. zaproszenie stoi" "select l13_auth_email_book('AUTH_PASSWORD_RESET','hhl@test')" SUPPRESSED

sys "insert into notifications (channel, recipient, template, status, dedup_key) values ('EMAIL','odrzucony@test','L13_REJECT','ERROR','l13-reject-1')" >/dev/null
val "odrzucenie Resend liczy się jako nie wyszło" "begin; select set_config('request.jwt.claim.sub','$HHL',true); set local role authenticated; select ((email_budget_status()->'suppressed_to')::text like '%odrzucony@test%')::text; rollback" true

echo; echo "WYNIK: $ok OK, $fail FAIL"
[ "$fail" -eq 0 ]
