#!/usr/bin/env bash
# TOWER — P1 / E18: porządki danych (migracja 0193) — asercje na danych zmyślonych.
set -e
ADMIN=${PGADMIN:-postgres://postgres@localhost:5433/postgres}
. "$(git rev-parse --show-toplevel)/tests/db/local-only.sh"
ROOT=$(git rev-parse --show-toplevel)
if [ "${TOWER_HOSTED_READY:-}" = "1" ]; then
  URL="$ADMIN"
else
  DB=tower_test_e18; URL="${ADMIN%/*}/$DB"
  psql "$ADMIN" -q -c "drop database if exists $DB" -c "create database $DB"
  psql "$URL" -q -v ON_ERROR_STOP=1 -f tests/db/supabase_stub.sql
  for f in supabase/migrations/*.sql; do
    psql "$URL" -q -v ON_ERROR_STOP=1 -f "$f" >/dev/null 2>&1 || {
      echo "MIGRACJA $f: błąd"; psql "$URL" -q -v ON_ERROR_STOP=1 -f "$f" 2>&1 | tail -5; exit 1;
    }
  done
  psql "$URL" -q -v ON_ERROR_STOP=1 -f tests/db/seed.sql
fi
set +e

PSQL() { psql "$URL" -v ON_ERROR_STOP=1 -Atq "$@"; }
ok=0; fail=0; fails=""
chk() {
  local got="$2" exp="$3"
  got=$(printf '%s' "$got" | tr -d '\r')
  if [ "$got" = "$exp" ]; then ok=$((ok+1)); echo "  OK    $1";
  else fail=$((fail+1)); fails="${fails} [${1}: ${got}!=${exp}]"; echo "  FAIL  $1  (otrzymano: $got, oczekiwano: $exp)"; fi
}

echo; echo "[E18] fixture + ponowienie 0193"

P=$(PSQL -c "select id from projects limit 1")
ORG=$(PSQL -c "select id from organizations where code='SCX' limit 1")
L24=$(PSQL -c "select load_id from shipment_items where shipment_code='SG-24' limit 1")
[ -z "$L24" ] && L24=$(PSQL -c "select id from loads order by created_at limit 1")
L03=$(PSQL -c "select load_id from shipment_items where shipment_code='SG-03' limit 1")
[ -z "$L03" ] && L03=$(PSQL -c "select id from loads order by created_at offset 1 limit 1")
[ -z "$L03" ] && L03=$L24
HHL=$(PSQL -c "select id from organizations where code='HHL' limit 1")
KSH=$(PSQL -c "select id from organizations where code='KSH' limit 1")

FIX=$(mktemp)
cat >"$FIX" <<SQLEOF
begin;
-- audit przed app_users (FK audit_log_user_id_fkey)
delete from audit_log where source in ('e18-fixture','e18-wide','migration-0193')
   or user_id in (select id from app_users where email ilike '%+tower-%@example.test')
   or acting_as_user_id in (select id from app_users where email ilike '%+tower-%@example.test')
   or action in ('E18_AUDIT_DETACH','E18_P2_P3','E18_P6','E18_HSTIA','E18_P7','E18_P8','E18_P9','E18_P10','E18_P11','E18_P13');
delete from notifications where user_id in (select id from app_users where email ilike '%+tower-%@example.test');
delete from user_invites where email ilike '%+tower-test%@example.test' or email ilike '%+tower-sec%@example.test';
delete from app_users where email ilike '%+tower-%@example.test';
delete from insurance_policies where policy_no = 'OCP-SCX-2026-WT';
delete from insurance_policies where policy_no = '436000430439' and insurer in ('Hstia','ERGO Hestia','Test OCP');
delete from invoices where invoice_number = 'WT-TEST-P6-20261005';
delete from decision_events where decision_id in (
  select d.id from decisions d join risk_signals rs on rs.id = d.risk_id where rs.dedup_key like 'e18-%');
delete from decisions where risk_id in (select id from risk_signals where dedup_key like 'e18-%');
delete from risk_signals where dedup_key like 'e18-%';

insert into app_users (id, auth_id, org_id, email, role, active, full_name)
values
  ('a1111111-e018-4000-8000-000000000001', 'a1111111-e018-4000-8000-000000000001', '$HHL', 'sebastian+tower-sec-a@example.test', 'HHL_OPS', true, 'e18'),
  ('a1111111-e018-4000-8000-000000000002', 'a1111111-e018-4000-8000-000000000002', '$HHL', 'sebastian+tower-sec-b@example.test', 'HHL_OPS', true, 'e18'),
  ('a1111111-e018-4000-8000-000000000003', 'a1111111-e018-4000-8000-000000000003', '$HHL', 'sebastian+tower-sec-c@example.test', 'HHL_OPS', true, 'e18'),
  ('a1111111-e018-4000-8000-000000000004', 'a1111111-e018-4000-8000-000000000004', '$HHL', 'sebastian+tower-test-hhl@example.test', 'HHL_OPS', true, 'e18'),
  ('a1111111-e018-4000-8000-000000000005', 'a1111111-e018-4000-8000-000000000005', '$KSH', 'sebastian+tower-test-ksh@example.test', 'CLIENT_USER', true, 'e18'),
  ('a1111111-e018-4000-8000-000000000006', 'a1111111-e018-4000-8000-000000000006', '$ORG', 'sebastian+tower-test-scx@example.test', 'CARRIER_USER', true, 'e18');

insert into audit_log (user_id, action, entity, entity_id, source)
select u, 'USER_INVITED', 'app_users', u::text, 'e18-fixture'
from unnest(array[
  'a1111111-e018-4000-8000-000000000001'::uuid,
  'a1111111-e018-4000-8000-000000000002'::uuid,
  'a1111111-e018-4000-8000-000000000003'::uuid,
  'a1111111-e018-4000-8000-000000000004'::uuid,
  'a1111111-e018-4000-8000-000000000005'::uuid,
  'a1111111-e018-4000-8000-000000000006'::uuid,
  'a1111111-e018-4000-8000-000000000001'::uuid,
  'a1111111-e018-4000-8000-000000000002'::uuid,
  'a1111111-e018-4000-8000-000000000003'::uuid
]::uuid[]) as u;

insert into audit_log (acting_as_user_id, action, entity, entity_id, source)
values
  ('a1111111-e018-4000-8000-000000000001', 'IMPERSONATE_START', 'app_users', 'x', 'e18-fixture'),
  ('a1111111-e018-4000-8000-000000000004', 'ROW_UPDATE', 'app_users', 'y', 'e18-fixture');

insert into notifications (user_id, channel, recipient, template, payload, status)
values ('a1111111-e018-4000-8000-000000000004', 'IN_APP', 'sebastian+tower-test-hhl@example.test',
        'E18_TEST', '{}'::jsonb, 'PENDING');

insert into user_invites (email, org_id, role, invited_by) values
  ('sebastian+tower-test-hhl@example.test', '$HHL', 'HHL_OPS', 'a1111111-e018-4000-8000-000000000001'),
  ('sebastian+tower-test-ksh@example.test', '$KSH', 'CLIENT_USER', 'a1111111-e018-4000-8000-000000000001'),
  ('sebastian+tower-test-scx@example.test', '$ORG', 'CARRIER_USER', 'a1111111-e018-4000-8000-000000000001');

insert into insurance_policies (org_id, policy_no, insurer, valid_from, valid_until, sum_insured, currency, covers_oversize, covers_sweden, approval_status)
values
  ('$ORG', 'OCP-SCX-2026-WT', 'Test OCP', current_date, current_date + 30, 5000000, 'EUR', true, true, 'APPROVED'),
  ('$ORG', '436000430439', 'Hstia', current_date, current_date + 365, 5000000, 'EUR', true, true, 'APPROVED');

insert into invoices (project_id, carrier_org_id, direction, status, invoice_number, currency, period_start, period_end, net_total)
select '$P', '$ORG', 'KOSZT', 'SUBMITTED', 'WT-TEST-P6-20261005', 'EUR', current_date, current_date, 1
where not exists (select 1 from invoices where invoice_number = 'WT-TEST-P6-20261005');

-- seed często nie ma shipment_items — jeden wiersz SG-24 na L24
insert into shipment_items (project_id, load_id, shipment_code, cargo_class, length_m, width_m, height_m, unit_weight_t, qty, total_weight_t)
select '$P', '$L24', 'SG-24', 'DIMENSIONED', 12, 2, 1, 10, 1, 10
where not exists (select 1 from shipment_items where shipment_code = 'SG-24');
update shipment_items set load_id = '$L24' where shipment_code = 'SG-24' and load_id is distinct from '$L24'::uuid;
update loads set status = 'READY', hhl_order_no = 'Tx/1/2026', tractor_plate = 'GGH666',
  trailer_plate = 'TGGG1111', driver_name = 'Test', driver_phone = '48111', ferry_booking_ref = '01'
where id = '$L24';

insert into geofence_states (load_id, geofence_id, state, consec_fixes, entered_at, last_eval_at)
select '$L24', g.id, 'INSIDE', 1, now(), now() from geofences g limit 1
on conflict (load_id, geofence_id) do update set state = 'INSIDE';

insert into risk_signals (project_id, load_id, kind, severity, title, dedup_key, detected_at) values
  ('$P', '$L24', 'ETA_BREACH', 'HIGH', 'Opóźnienie 5400 min — fixture', 'e18-eta-5400', timestamptz '2026-10-01 20:21:00+00'),
  ('$P', '$L24', 'JOB_FAILURE', 'HIGH', 'Decyzja po terminie: Opóźnienie 5400 min — fixture', 'e18-jf-5400', timestamptz '2026-10-01 20:21:00+00'),
  ('$P', null, 'JOB_FAILURE', 'HIGH', 'SMS bez potwierdzenia doręczenia — fixture 1', 'e18-sms-1', timestamptz '2026-10-01 17:12:00+00'),
  ('$P', null, 'JOB_FAILURE', 'HIGH', 'SMS bez potwierdzenia doręczenia — fixture 2', 'e18-sms-2', timestamptz '2026-10-01 17:12:00+00'),
  ('$P', null, 'JOB_FAILURE', 'HIGH', 'SMS bez potwierdzenia doręczenia — fixture 3', 'e18-sms-3', timestamptz '2026-10-01 17:12:00+00'),
  ('$P', null, 'JOB_FAILURE', 'HIGH', 'SMS bez potwierdzenia doręczenia — fixture 4', 'e18-sms-4', timestamptz '2026-10-01 17:12:00+00'),
  ('$P', null, 'JOB_FAILURE', 'MEDIUM', 'Błędy w przeglądarce użytkowników: 1 rodzaj(e), 1 wystąpień w 15 min', 'e18-browser', timestamptz '2026-10-03 17:30:00+00'),
  ('$P', null, 'JOB_FAILURE', 'HIGH', 'SMS bez potwierdzenia doręczenia — poza oknem', 'e18-sms-out', timestamptz '2026-10-02 17:12:00+00');

-- drugi transport SG-03 (seed ma często 1 load); DELIVERED wymaga numerów zleceń (enforce_order_numbers)
insert into loads (id, project_id, status, hhl_order_no, carrier_order_no, plan_load_date, plan_delivery_date)
values ('c1111111-e018-4000-8000-000000000003', '$P', 'DELIVERED', 'E18/SG-03', 'SCX/E18-03',
        current_date - 10, current_date - 8)
on conflict (id) do nothing;
insert into shipment_items (project_id, load_id, shipment_code, cargo_class, length_m, width_m, height_m, unit_weight_t, qty, total_weight_t)
select '$P', 'c1111111-e018-4000-8000-000000000003', 'SG-03', 'DIMENSIONED', 12, 2, 1, 10, 1, 10
where not exists (select 1 from shipment_items where shipment_code = 'SG-03');

insert into load_events (load_id, event_type, occurred_at, payload) values
  ('c1111111-e018-4000-8000-000000000003', 'GEOFENCE_EXIT', timestamptz '2026-10-05 08:00:00+00',
   '{"geofence_kind":"LOADING"}'::jsonb),
  ('c1111111-e018-4000-8000-000000000003', 'GEOFENCE_EXIT', timestamptz '2026-10-07 08:00:00+00',
   '{"geofence_kind":"SITE","geofence_name":"Inne miejsce"}'::jsonb),
  ('c1111111-e018-4000-8000-000000000003', 'GEOFENCE_EXIT', timestamptz '2026-10-07 10:19:54+00',
   '{"geofence_kind":"SITE","geofence_name":"Plac budowy Stegra Boden"}'::jsonb);
delete from positions where load_id = 'c1111111-e018-4000-8000-000000000003';
insert into positions (load_id, geom_raw, ts, source) values
  ('c1111111-e018-4000-8000-000000000003', st_setsrid(st_makepoint(18.4,54.2),4326), timestamptz '2026-10-07 10:00:00+00', 'DRIVER_PWA'),
  ('c1111111-e018-4000-8000-000000000003', st_setsrid(st_makepoint(18.5,54.3),4326), timestamptz '2026-10-07 10:19:54+00', 'DRIVER_PWA'),
  ('c1111111-e018-4000-8000-000000000003', st_setsrid(st_makepoint(18.6,54.4),4326), timestamptz '2026-10-07 12:00:00+00', 'DRIVER_PWA');

-- osobny PLANNED z ETA
insert into loads (id, project_id, status, plan_load_date, plan_delivery_date, eta_site, delay_minutes, eta_basis)
values ('c1111111-e018-4000-8000-0000000000a1', '$P', 'PLANNED', current_date + 1, current_date + 3,
        now() + interval '1 day', 10, '{"stale":true}'::jsonb)
on conflict (id) do update set eta_site = excluded.eta_site, delay_minutes = 10;
insert into shipment_items (project_id, load_id, shipment_code, cargo_class, length_m, width_m, height_m, unit_weight_t, qty, total_weight_t)
select '$P', 'c1111111-e018-4000-8000-0000000000a1', 'KR-04', 'DIMENSIONED', 12, 2, 1, 10, 1, 10
where not exists (select 1 from shipment_items where load_id = 'c1111111-e018-4000-8000-0000000000a1');
insert into risk_signals (project_id, load_id, kind, severity, title, dedup_key)
values ('$P', 'c1111111-e018-4000-8000-0000000000a1', 'ETA_BREACH', 'HIGH', 'Opóźnienie przed wyjazdem', 'e18-eta-planned');

insert into loads (id, project_id, status, hhl_order_no, carrier_order_no, plan_load_date, plan_delivery_date, eta_basis)
values ('c1111111-e018-4000-8000-0000000000b2', '$P', 'DELIVERED', 'E18/SG-02', 'SCX/E18-02',
        current_date - 5, current_date - 3,
        '{"pre_load":true,"computed_at":"2026-10-06T21:07:00+00"}'::jsonb)
on conflict (id) do update set eta_basis = excluded.eta_basis, status = 'DELIVERED';
insert into shipment_items (project_id, load_id, shipment_code, cargo_class, length_m, width_m, height_m, unit_weight_t, qty, total_weight_t)
select '$P', 'c1111111-e018-4000-8000-0000000000b2', 'SG-02', 'DIMENSIONED', 12, 2, 1, 10, 1, 10
where not exists (select 1 from shipment_items where shipment_code = 'SG-02');
update loads set eta_basis = '{"pre_load":true,"computed_at":"2026-10-06T21:07:00+00"}'::jsonb
where id in (select load_id from shipment_items where shipment_code = 'SG-02');

insert into loads (id, project_id, status, hhl_order_no, carrier_order_no, plan_load_date, plan_delivery_date)
values ('c1111111-e018-4000-8000-000000000001', '$P', 'DELIVERED', 'E18/SG-01', 'SCX/E18-01',
        current_date - 20, current_date - 18)
on conflict (id) do nothing;
insert into shipment_items (project_id, load_id, shipment_code, cargo_class, length_m, width_m, height_m, unit_weight_t, qty, total_weight_t)
select '$P', 'c1111111-e018-4000-8000-000000000001', 'SG-01', 'DIMENSIONED', 12, 2, 1, 10, 1, 10
where not exists (select 1 from shipment_items where shipment_code = 'SG-01');
insert into driver_tokens (load_id, token_hash, expires_at, issued_at)
select si.load_id, decode('aa01e180','hex'), timestamptz '2026-10-08 00:00:00+00', timestamptz '2026-10-01 20:08:00+00'
from shipment_items si where si.shipment_code = 'SG-01'
  and not exists (select 1 from driver_tokens t where t.token_hash = decode('aa01e180','hex'));
insert into driver_tokens (load_id, token_hash, expires_at, issued_at)
select '$L24', decode('bb24e180','hex'), timestamptz '2026-10-08 00:00:00+00', timestamptz '2026-10-02 12:00:00+00'
where not exists (select 1 from driver_tokens t where t.token_hash = decode('bb24e180','hex'));

insert into load_messages (id, load_id, author_id, body)
select x.id, '$L24', u.id, 'e18-msg-' || x.id
from (values (29),(31),(32),(33),(34),(35)) as x(id)
cross join lateral (
  select id from app_users where email not ilike '%+tower-%' order by email limit 1
) u
on conflict (id) do update set body = excluded.body, load_id = excluded.load_id, author_id = excluded.author_id;
select setval(pg_get_serial_sequence('load_messages','id'), greatest((select coalesce(max(id), 1) from load_messages), 35));

insert into invoice_lines (invoice_id, load_id, direction)
select i.id, 'c1111111-e018-4000-8000-000000000003', 'KOSZT'
from invoices i
where i.invoice_number = 'WT-TEST-P6-20261005'
on conflict do nothing;
insert into invoice_dispute_events (invoice_id, kind, note)
select i.id, v.k, 'e18'
from invoices i
cross join (values ('OPENED'), ('REPLY')) as v(k)
where i.invoice_number = 'WT-TEST-P6-20261005';

insert into notifications (user_id, channel, recipient, template, payload, status)
select id, 'IN_APP', 'hhl@test', 'E18_KEEP', '{}'::jsonb, 'PENDING'
from app_users where email = 'hhl@test'
  and not exists (select 1 from notifications where template = 'E18_KEEP');

commit;
SQLEOF

FIX_LOG="${ROOT}/tmp-gate/e18-fix.out"
MIG_LOG="${ROOT}/tmp-gate/e18-mig.out"
mkdir -p "${ROOT}/tmp-gate"
psql "$URL" -v ON_ERROR_STOP=1 -f "$FIX" >"$FIX_LOG" 2>&1
FIX_RC=$?
rm -f "$FIX"
chk "fixture OK" "$FIX_RC" "0"
if [ "$FIX_RC" != "0" ]; then tail -25 "$FIX_LOG"; fi

# Sumy kontrolne wierszy, których 0193 nie rusza. Tabela znika na końcu zestawu.
psql "$URL" -q -v ON_ERROR_STOP=1 <<'SQL' >"$FIX_LOG.keep" 2>&1 || { echo "FAIL snapshot"; tail -20 "$FIX_LOG.keep"; exit 1; }
drop table if exists e18_keep;
drop function if exists e18_row_digest();
create table e18_keep (tag text not null, id text not null, primary key (tag, id));
insert into e18_keep (tag, id)
select 'user', u.id::text from app_users u
 where u.email not ilike '%+tower-sec%' and u.email not ilike '%+tower-test%';
insert into e18_keep (tag, id)
select 'audit', a.id::text from audit_log a
 where not exists (
   select 1 from app_users u
   where u.id in (a.user_id, a.acting_as_user_id)
     and (u.email ilike '%+tower-sec%' or u.email ilike '%+tower-test%'));
insert into e18_keep (tag, id)
select 'notif', n.id::text from notifications n
 where not exists (
   select 1 from app_users u where u.id = n.user_id
     and (u.email ilike '%+tower-sec%' or u.email ilike '%+tower-test%'));
insert into e18_keep (tag, id)
select 'invite', i.id::text from user_invites i where i.email not ilike '%+tower-test%';
insert into e18_keep (tag, id)
select 'policy', p.id::text from insurance_policies p
 where p.policy_no not in ('OCP-SCX-2026-WT', '436000430439');
insert into e18_keep (tag, id)
select 'invoice', i.id::text from invoices i where i.invoice_number is distinct from 'WT-TEST-P6-20261005';
insert into e18_keep (tag, id)
select 'line', il.invoice_id::text || ':' || il.load_id::text
from invoice_lines il
join invoices i on i.id = il.invoice_id
where i.invoice_number is distinct from 'WT-TEST-P6-20261005';
insert into e18_keep (tag, id)
select 'dispute', e.id::text from invoice_dispute_events e
join invoices i on i.id = e.invoice_id
where i.invoice_number is distinct from 'WT-TEST-P6-20261005';
insert into e18_keep (tag, id)
select 'msg', m.id::text from load_messages m where m.id not in (29, 31, 32, 33);
insert into e18_keep (tag, id)
select 'load', l.id::text from loads l
 where l.status is distinct from 'PLANNED'
   and not exists (select 1 from shipment_items si where si.load_id = l.id and si.shipment_code = 'SG-24');
insert into e18_keep (tag, id)
select 'geo', gs.load_id::text || ':' || gs.geofence_id::text from geofence_states gs
 where not exists (select 1 from shipment_items si where si.load_id = gs.load_id and si.shipment_code = 'SG-24');
insert into e18_keep (tag, id)
select 'risk', rs.id::text from risk_signals rs
 where not (
   rs.resolved_at is null and rs.kind = 'JOB_FAILURE' and (
     (coalesce(rs.title, '') like 'SMS bez potwierdzenia doręczenia%'
       and rs.detected_at >= timestamptz '2026-10-01 17:00:00+00'
       and rs.detected_at < timestamptz '2026-10-01 18:00:00+00')
     or (coalesce(rs.title, '') like 'Błędy w przeglądarce użytkowników%'
       and rs.detected_at >= timestamptz '2026-10-03 17:00:00+00'
       and rs.detected_at < timestamptz '2026-10-03 18:00:00+00'))
 )
 and not (
   rs.resolved_at is null and (
     (rs.kind = 'ETA_BREACH' and coalesce(rs.title, '') like 'Opóźnienie 5400 min%')
     or (rs.kind = 'JOB_FAILURE' and coalesce(rs.title, '') like 'Decyzja po terminie: Opóźnienie 5400 min%')
   )
   and exists (select 1 from shipment_items si where si.load_id = rs.load_id and si.shipment_code = 'SG-24')
 )
 and not (
   rs.resolved_at is null and rs.kind = 'ETA_BREACH'
   and exists (select 1 from loads l where l.id = rs.load_id and l.status = 'PLANNED')
 );
insert into e18_keep (tag, id)
select 'pos', p.id::text from positions p
 where not (
   exists (select 1 from shipment_items si where si.load_id = p.load_id and si.shipment_code = 'SG-03')
   and p.ts > timestamptz '2026-10-07 10:19:54+00'
 );
insert into e18_keep (tag, id)
select 'token', t.id::text from driver_tokens t
 where not (
   exists (select 1 from shipment_items si where si.load_id = t.load_id and si.shipment_code = 'SG-01')
   and t.issued_at >= timestamptz '2026-10-01 20:00:00+00'
   and t.issued_at < timestamptz '2026-10-01 21:00:00+00'
 );
create function e18_row_digest() returns text language sql volatile as $$
  select md5(string_agg(bucket, '|' order by bucket)) from (
    select 'user:' || coalesce(md5(string_agg(md5(u::text), ',' order by u.id::text)), '-') bucket
      from app_users u where u.id::text in (select id from e18_keep where tag = 'user')
    union all
    select 'audit:' || coalesce(md5(string_agg(md5(a::text), ',' order by a.id::text)), '-')
      from audit_log a where a.id::text in (select id from e18_keep where tag = 'audit')
    union all
    select 'notif:' || coalesce(md5(string_agg(md5(n::text), ',' order by n.id::text)), '-')
      from notifications n where n.id::text in (select id from e18_keep where tag = 'notif')
    union all
    select 'invite:' || coalesce(md5(string_agg(md5(i::text), ',' order by i.id::text)), '-')
      from user_invites i where i.id::text in (select id from e18_keep where tag = 'invite')
    union all
    select 'policy:' || coalesce(md5(string_agg(md5(p::text), ',' order by p.id::text)), '-')
      from insurance_policies p where p.id::text in (select id from e18_keep where tag = 'policy')
    union all
    select 'invoice:' || coalesce(md5(string_agg(md5(i::text), ',' order by i.id::text)), '-')
      from invoices i where i.id::text in (select id from e18_keep where tag = 'invoice')
    union all
    select 'line:' || coalesce(md5(string_agg(md5((il.invoice_id::text || il.load_id::text || coalesce(il.direction,''))), ',' order by il.invoice_id::text, il.load_id::text)), '-')
      from invoice_lines il where (il.invoice_id::text || ':' || il.load_id::text) in (select id from e18_keep where tag = 'line')
    union all
    select 'dispute:' || coalesce(md5(string_agg(md5(e::text), ',' order by e.id::text)), '-')
      from invoice_dispute_events e where e.id::text in (select id from e18_keep where tag = 'dispute')
    union all
    select 'msg:' || coalesce(md5(string_agg(md5(m::text), ',' order by m.id::text)), '-')
      from load_messages m where m.id::text in (select id from e18_keep where tag = 'msg')
    union all
    select 'load:' || coalesce(md5(string_agg(md5(l::text), ',' order by l.id::text)), '-')
      from loads l where l.id::text in (select id from e18_keep where tag = 'load')
    union all
    select 'geo:' || coalesce(md5(string_agg(md5(gs::text), ',' order by gs.load_id::text, gs.geofence_id::text)), '-')
      from geofence_states gs where (gs.load_id::text || ':' || gs.geofence_id::text) in (select id from e18_keep where tag = 'geo')
    union all
    select 'risk:' || coalesce(md5(string_agg(md5(rs::text), ',' order by rs.id::text)), '-')
      from risk_signals rs where rs.id::text in (select id from e18_keep where tag = 'risk')
    union all
    select 'pos:' || coalesce(md5(string_agg(md5(p::text), ',' order by p.id::text)), '-')
      from positions p where p.id::text in (select id from e18_keep where tag = 'pos')
    union all
    select 'token:' || coalesce(md5(string_agg(md5(t::text), ',' order by t.id::text)), '-')
      from driver_tokens t where t.id::text in (select id from e18_keep where tag = 'token')
  ) s;
$$;
SQL
cleanup_keep() {
  psql "$URL" -q -c "drop table if exists e18_keep; drop function if exists e18_row_digest();" >/dev/null 2>&1 || true
}
trap cleanup_keep EXIT

DIG=$(PSQL -c "select e18_row_digest()")
N_BEFORE=$(PSQL -c "select count(*) from notifications n where not exists (select 1 from app_users u where u.id = n.user_id and (u.email ilike '%+tower-test%' or u.email ilike '%+tower-sec%'))")
SMS_BEFORE=$(PSQL -c "select count(*) from sms_outbox")

# Hosted shim no-opuje supabase/migrations/* bez TOWER_ALLOW_MIG_REAPPLY (jak workflows.sh).
export TOWER_ALLOW_MIG_REAPPLY=1
psql "$URL" -q -v ON_ERROR_STOP=1 -f "$ROOT/supabase/migrations/0193_e18_porzadki.sql" >"$MIG_LOG" 2>&1
MIG_RC=$?
chk "migracja 0193 na fixture" "$MIG_RC" "0"
if [ "$MIG_RC" != "0" ]; then tail -40 "$MIG_LOG"; fi

TRIG=$(PSQL -c "select string_agg(tgname||':'||tgenabled, ',' order by tgname) from pg_trigger where tgname in ('trg_risk_matrix_notify','trg_loads_status_matrix_notify','trg_loads_eta') and not tgisinternal")
P13_IN="select count(*) from risk_signals where resolved_at is null and kind='JOB_FAILURE' and ((title like 'SMS bez potwierdzenia doręczenia%' and detected_at >= timestamptz '2026-10-01 17:00:00+00' and detected_at < timestamptz '2026-10-01 18:00:00+00') or (title like 'Błędy w przeglądarce użytkowników%' and detected_at >= timestamptz '2026-10-03 17:00:00+00' and detected_at < timestamptz '2026-10-03 18:00:00+00'))"

chk "0 kont +tower-*" "$(PSQL -c "select count(*) from app_users where email ilike '%+tower-%'")" "0"
chk "polisa testowa usunięta" "$(PSQL -c "select count(*) from insurance_policies where policy_no='OCP-SCX-2026-WT'")" "0"
chk "ERGO Hestia" "$(PSQL -c "select insurer from insurance_policies where policy_no='436000430439' limit 1")" "ERGO Hestia"
chk "faktura testowa usunięta" "$(PSQL -c "select count(*) from invoices where invoice_number='WT-TEST-P6-20261005'")" "0"
chk "SG-24 PLANNED bez HHL" "$(PSQL -c "select status||'/'||coalesce(hhl_order_no,'') from loads l join shipment_items si on si.load_id=l.id where si.shipment_code='SG-24' limit 1")" "PLANNED/"
chk "SG-24 sprawy 5400 zamknięte" "$(PSQL -c "select count(*) from risk_signals rs join shipment_items si on si.load_id=rs.load_id where si.shipment_code='SG-24' and rs.resolved_at is null and coalesce(title,'') like '%5400%'")" "0"
chk "pozycje SG-03 po wyjeździe 0" "$(PSQL -c "select count(*) from positions p join shipment_items si on si.load_id=p.load_id where si.shipment_code='SG-03' and p.ts > timestamptz '2026-10-07 10:19:54+00'")" "0"
chk "pozycja przed wyjazdem zostaje" "$(PSQL -c "select count(*) from positions p join shipment_items si on si.load_id=p.load_id where si.shipment_code='SG-03' and p.ts = timestamptz '2026-10-07 10:00:00+00'")" "1"
chk "P13 w oknie zamknięte" "$(PSQL -c "$P13_IN")" "0"
chk "P13 poza oknem zostaje" "$(PSQL -c "select count(*) from risk_signals where dedup_key='e18-sms-out' and resolved_at is null")" "1"
chk "wiadomości 29,31,32,33 usunięte" "$(PSQL -c "select count(*) from load_messages where id in (29,31,32,33)")" "0"
chk "wiadomości 34 i 35 zostają" "$(PSQL -c "select count(*) from load_messages where id in (34,35)")" "2"
chk "token SG-01 usunięty" "$(PSQL -c "select count(*) from driver_tokens t join shipment_items si on si.load_id=t.load_id where si.shipment_code='SG-01' and t.issued_at >= timestamptz '2026-10-01 20:00:00+00' and t.issued_at < timestamptz '2026-10-01 21:00:00+00'")" "0"
chk "token SG-24 zostaje" "$(PSQL -c "select count(*) from driver_tokens where token_hash=decode('bb24e180','hex')")" "1"
chk "0 PLANNED z eta_site" "$(PSQL -c "select count(*) from loads where status='PLANNED' and eta_site is not null")" "0"
chk "0 PLANNED z delay_minutes>0" "$(PSQL -c "select count(*) from loads where status='PLANNED' and coalesce(delay_minutes,0) > 0")" "0"
chk "ETA_BREACH PLANNED zamknięte" "$(PSQL -c "select count(*) from risk_signals rs join loads l on l.id=rs.load_id where rs.kind='ETA_BREACH' and rs.resolved_at is null and l.status='PLANNED'")" "0"
chk "computed_at = czas migracji" "$(PSQL -c "select ((eta_basis->>'pre_load')='true' and (eta_basis->>'computed_at')::timestamptz > now() - interval '15 minutes') from loads where id='c1111111-e018-4000-8000-0000000000a1'")" "t"
chk "audit odpięty" "$(PSQL -c "select count(*) from audit_log where user_id = 'a1111111-e018-4000-8000-000000000001' or acting_as_user_id = 'a1111111-e018-4000-8000-000000000001'")" "0"
chk "E18_AUDIT_DETACH" "$(PSQL -c "select (count(*) > 0) from audit_log where action='E18_AUDIT_DETACH'")" "t"
chk "powiadomienia poza kontami bez zmian" "$(PSQL -c "select count(*) from notifications n where not exists (select 1 from app_users u where u.id = n.user_id and (u.email ilike '%+tower-test%' or u.email ilike '%+tower-sec%'))")" "$N_BEFORE"
chk "sms_outbox bez zmian" "$(PSQL -c "select count(*) from sms_outbox")" "$SMS_BEFORE"
chk "sumy kontrolne bez zmian" "$(PSQL -c "select e18_row_digest()")" "$DIG"
chk "wyzwalacze włączone" "$TRIG" "trg_loads_eta:O,trg_loads_status_matrix_notify:O,trg_risk_matrix_notify:O"

psql "$URL" -q -v ON_ERROR_STOP=1 -f "$ROOT/supabase/migrations/0193_e18_porzadki.sql" >/dev/null 2>&1
chk "2. uruchomienie 0193" "$?" "0"
chk "po 2. uruchomieniu 0 +tower-*" "$(PSQL -c "select count(*) from app_users where email ilike '%+tower-%'")" "0"
chk "2. uruchomienie bez zmian sumy" "$(PSQL -c "select e18_row_digest()")" "$DIG"

# Wyjątek i 0 zmian: znacznik po przygotowaniu zostaje, suma wierszy spoza klucza też.
abort_case() {
  local name="$1" needle="$2" still="$3"
  local before after dig
  before=$(PSQL -c "$still")
  OUT=$(psql "$URL" -v ON_ERROR_STOP=1 -f "$ROOT/supabase/migrations/0193_e18_porzadki.sql" 2>&1 | tr -d '\r' || true)
  after=$(PSQL -c "$still")
  dig=$(PSQL -c "select e18_row_digest()")
  if echo "$OUT" | grep -F -q -- "$needle" && [ "$before" = "$after" ] && [ "$dig" = "$DIG" ]; then
    ok=$((ok+1)); echo "  OK    $name"
  else
    fail=$((fail+1))
    fails="${fails} [${name}: przed=${before} po=${after} suma=$([ "$dig" = "$DIG" ] && echo ok || echo INNA)]"
    echo "  FAIL  $name (przed=$before po=$after suma=$([ "$dig" = "$DIG" ] && echo taka-sama || echo INNA))"
    echo "$OUT" | tail -4 | sed 's/^/        /'
  fi
}

psql "$URL" -v ON_ERROR_STOP=1 -c "
insert into app_users (id, auth_id, org_id, email, role, active, full_name)
values ('b1111111-e018-4000-8000-000000000099', 'b1111111-e018-4000-8000-000000000099', '$HHL', 'sebastian+tower-test-extra@example.test', 'HHL_OPS', true, 'x');
insert into audit_log (user_id, action, entity, entity_id, source)
select 'b1111111-e018-4000-8000-000000000099', 'X', 'app_users', n::text, 'e18-wide' from generate_series(1,12) n;
" >/dev/null 2>&1
abort_case "12 wpisów audit → wyjątek i 0 zmian" "E18 W22" \
  "select count(*) from audit_log where user_id='b1111111-e018-4000-8000-000000000099'"
psql "$URL" -c "delete from audit_log where source='e18-wide'; delete from app_users where id='b1111111-e018-4000-8000-000000000099';" >/dev/null 2>&1

psql "$URL" -v ON_ERROR_STOP=1 -c "
insert into app_users (id, auth_id, org_id, email, role, active, full_name)
values ('b1111111-e018-4000-8000-000000000098', 'b1111111-e018-4000-8000-000000000098', '$HHL', 'sebastian+tower-test-dec@example.test', 'HHL_OPS', true, 'x');
insert into decisions (project_id, type_code, status, title, assignee_id)
values ('$P', 'FERRY_CANCELLED', 'ASSIGNED', 'e18-wide', 'b1111111-e018-4000-8000-000000000098');
" >/dev/null 2>&1
abort_case "decisions.assignee_id → wyjątek i 0 zmian" "decisions wskazuje konto testowe" \
  "select count(*) from decisions where assignee_id='b1111111-e018-4000-8000-000000000098'"
psql "$URL" -c "delete from decisions where assignee_id='b1111111-e018-4000-8000-000000000098'; delete from app_users where id='b1111111-e018-4000-8000-000000000098';" >/dev/null 2>&1

psql "$URL" -v ON_ERROR_STOP=1 -c "
insert into app_users (id, auth_id, org_id, email, role, active, full_name)
select ('b2222222-e018-4000-8000-00000000000'||n)::uuid,
       ('b2222222-e018-4000-8000-00000000000'||n)::uuid,
       '$HHL', 'w'||n||'+tower-test@example.test', 'HHL_OPS', true, 'x'
from generate_series(1,7) n;
" >/dev/null 2>&1
abort_case "7 kont +tower → wyjątek i 0 zmian" "kont +tower-*" \
  "select count(*) from app_users where email like 'w%+tower-test@example.test'"
psql "$URL" -c "delete from app_users where email like 'w%+tower-test@example.test';" >/dev/null 2>&1

psql "$URL" -v ON_ERROR_STOP=1 -c "
insert into insurance_policies (org_id, policy_no, insurer, valid_from, valid_until, sum_insured, currency, covers_oversize, covers_sweden, approval_status)
select '$ORG', 'OCP-SCX-2026-WT', 'Test OCP', current_date, current_date + 30, 5000000, 'EUR', true, true, 'APPROVED'
from generate_series(1,2);
" >/dev/null 2>&1
abort_case "2 polisy testowe → wyjątek i 0 zmian" "polis OCP-SCX-2026-WT" \
  "select count(*) from insurance_policies where policy_no='OCP-SCX-2026-WT'"
psql "$URL" -c "delete from insurance_policies where policy_no='OCP-SCX-2026-WT';" >/dev/null 2>&1

psql "$URL" -v ON_ERROR_STOP=1 -c "
insert into risk_signals (project_id, kind, severity, title, dedup_key, detected_at)
select '$P', 'JOB_FAILURE', 'HIGH', 'SMS bez potwierdzenia doręczenia — wide '||n,
       'e18-wide-p13-'||n, timestamptz '2026-10-01 17:20:00+00'
from generate_series(1,6) n;
" >/dev/null 2>&1
abort_case "6 spraw P13 w oknie → wyjątek i 0 zmian" "spraw w oknie" "$P13_IN"
psql "$URL" -c "delete from risk_signals where dedup_key like 'e18-wide-p13-%';" >/dev/null 2>&1

psql "$URL" -v ON_ERROR_STOP=1 -c "
insert into projects (id, code, name, client_org_id)
values ('d1111111-e018-4000-8000-000000000001', 'E18-WIDE', 'e18 wide', '$KSH');
insert into loads (id, project_id, status, plan_load_date, plan_delivery_date)
values ('d1111111-e018-4000-8000-000000000002', 'd1111111-e018-4000-8000-000000000001', 'PLANNED', current_date, current_date + 1);
insert into shipment_items (project_id, load_id, shipment_code, cargo_class, length_m, width_m, height_m, unit_weight_t, qty, total_weight_t)
values ('d1111111-e018-4000-8000-000000000001', 'd1111111-e018-4000-8000-000000000002', 'SG-24', 'DIMENSIONED', 12, 2, 1, 10, 1, 10);
" >/dev/null 2>&1
abort_case "2 transporty SG-24 → wyjątek i 0 zmian" "transportów SG-24" \
  "select count(distinct load_id) from shipment_items where shipment_code='SG-24'"
psql "$URL" -c "
delete from shipment_items where load_id='d1111111-e018-4000-8000-000000000002';
delete from loads where id='d1111111-e018-4000-8000-000000000002';
delete from projects where id='d1111111-e018-4000-8000-000000000001';
" >/dev/null 2>&1

psql "$URL" -v ON_ERROR_STOP=1 -c "
insert into geofences (id, project_id, name, kind, geom)
select ('e1111111-e018-4000-8000-00000000000'||n)::uuid, g.project_id, 'e18-wide-g'||n, g.kind, g.geom
from geofences g, generate_series(1,3) n
where g.id = (select id from geofences order by id limit 1);
insert into geofence_states (load_id, geofence_id, state, consec_fixes, last_eval_at)
select '$L24', id, 'INSIDE', 1, now() from geofences where name like 'e18-wide-g%'
on conflict do nothing;
" >/dev/null 2>&1
abort_case "3 stany stref SG-24 → wyjątek i 0 zmian" "geofence_states SG-24" \
  "select count(*) from geofence_states gs join shipment_items si on si.load_id=gs.load_id where si.shipment_code='SG-24'"
psql "$URL" -c "
delete from geofence_states where geofence_id in (select id from geofences where name like 'e18-wide-g%');
delete from geofences where name like 'e18-wide-g%';
" >/dev/null 2>&1

psql "$URL" -v ON_ERROR_STOP=1 -c "
insert into risk_signals (project_id, load_id, kind, severity, title, dedup_key)
select '$P', '$L24', 'ETA_BREACH', 'HIGH', 'Opóźnienie 5400 min — wide '||n, 'e18-wide-5400-'||n
from generate_series(1,3) n;
" >/dev/null 2>&1
abort_case "3 sprawy 5400 → wyjątek i 0 zmian" "spraw 5400 min" \
  "select count(*) from risk_signals where load_id='$L24' and resolved_at is null and title like 'Opóźnienie 5400 min%'"
psql "$URL" -c "delete from risk_signals where dedup_key like 'e18-wide-5400-%';" >/dev/null 2>&1

psql "$URL" -v ON_ERROR_STOP=1 -c "
insert into user_invites (email, org_id, role, invited_by)
select 'w-inv'||n||'+tower-test@example.test', '$HHL', 'HHL_OPS',
       (select id from app_users where email='hhl@test' limit 1)
from generate_series(1,4) n;
" >/dev/null 2>&1
abort_case "4 zaproszenia +tower-test → wyjątek i 0 zmian" "zaproszeń +tower-test" \
  "select count(*) from user_invites where email ilike '%+tower-test%'"
psql "$URL" -c "delete from user_invites where email like 'w-inv%+tower-test@example.test';" >/dev/null 2>&1

psql "$URL" -v ON_ERROR_STOP=1 <<'SQL' >/dev/null 2>&1
do $w$
declare
  i int;
  rec record;
  collist text;
  vallist text;
begin
  if to_regclass('auth.users') is null then
    execute 'create table auth.users (id uuid primary key, email text)';
  end if;
  for i in 1..4 loop
    begin
      execute format(
        'insert into auth.users (id, email) values (%L::uuid, %L)',
        'f1111111-e018-4000-8000-00000000000' || i,
        'w-auth' || i || '+tower-test@example.test');
    exception when not_null_violation then
      collist := 'id, email';
      vallist := format('%L::uuid, %L',
        'f1111111-e018-4000-8000-00000000000' || i,
        'w-auth' || i || '+tower-test@example.test');
      for rec in
        select column_name, data_type, udt_name
        from information_schema.columns
        where table_schema = 'auth' and table_name = 'users'
          and is_nullable = 'NO' and column_default is null
          and column_name not in ('id', 'email')
      loop
        collist := collist || ', ' || quote_ident(rec.column_name);
        vallist := vallist || ', ' || case
          when rec.data_type = 'uuid' then quote_literal('00000000-0000-0000-0000-000000000000') || '::uuid'
          when rec.data_type = 'boolean' then 'false'
          when rec.data_type in ('integer', 'bigint', 'smallint') then '0'
          when rec.data_type in ('jsonb', 'json') then '''{}''::jsonb'
          when rec.data_type like 'timestamp%' then 'now()'
          else quote_literal('')
        end;
      end loop;
      execute 'insert into auth.users (' || collist || ') values (' || vallist || ')';
    end;
  end loop;
end
$w$;
SQL
abort_case "4 konta auth.users → wyjątek i 0 zmian" "kont auth.users +tower" \
  "select count(*) from auth.users where email ilike 'w-auth%+tower-test@example.test'"
psql "$URL" -q <<'SQL' >/dev/null 2>&1
delete from auth.users where email like 'w-auth%+tower-test@example.test';
do $$
begin
  if to_regclass('auth.users') is not null
     and not exists (select 1 from auth.users)
     and not exists (
       select 1 from information_schema.columns
       where table_schema = 'auth' and table_name = 'users' and column_name = 'aud')
  then
    drop table auth.users;
  end if;
end $$;
SQL

chk "wyzwalacze po wyjątku" "$(PSQL -c "select string_agg(tgname||':'||tgenabled, ',' order by tgname) from pg_trigger where tgname in ('trg_risk_matrix_notify','trg_loads_status_matrix_notify','trg_loads_eta') and not tgisinternal")" "trg_loads_eta:O,trg_loads_status_matrix_notify:O,trg_risk_matrix_notify:O"

unset TOWER_ALLOW_MIG_REAPPLY
REFUSE=$(node --input-type=module -e "
import { refuseProdUrls } from './scripts/auth/env.mjs';
try {
  refuseProdUrls({ VITE_SUPABASE_URL: 'https://nglnnrmzmhusvxslousq.supabase.co' });
  console.log('no-throw');
} catch (e) {
  console.log(/ODMOWA/.test(String(e.message)) ? 'ok' : 'bad');
}
")
chk "refuseProdUrls blokuje produkcję" "$REFUSE" "ok"

cleanup_keep
echo; echo "WYNIK: $ok OK, $fail FAIL${fails}"
[ "$fail" -eq 0 ]
