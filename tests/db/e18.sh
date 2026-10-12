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
ok=0; fail=0
chk() {
  local got="$2" exp="$3"
  got=$(printf '%s' "$got" | tr -d '\r')
  if [ "$got" = "$exp" ]; then ok=$((ok+1)); echo "  OK    $1";
  else fail=$((fail+1)); echo "  FAIL  $1  (otrzymano: $got, oczekiwano: $exp)"; fi
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

insert into risk_signals (project_id, load_id, kind, severity, title, dedup_key) values
  ('$P', '$L24', 'ETA_BREACH', 'HIGH', 'Opóźnienie 5400 min — fixture', 'e18-eta-5400'),
  ('$P', '$L24', 'JOB_FAILURE', 'HIGH', 'Decyzja po terminie: Opóźnienie 5400 min — fixture', 'e18-jf-5400'),
  ('$P', null, 'JOB_FAILURE', 'HIGH', 'SMS bez potwierdzenia doręczenia — fixture 1', 'e18-sms-1'),
  ('$P', null, 'JOB_FAILURE', 'HIGH', 'SMS bez potwierdzenia doręczenia — fixture 2', 'e18-sms-2'),
  ('$P', null, 'JOB_FAILURE', 'HIGH', 'SMS bez potwierdzenia doręczenia — fixture 3', 'e18-sms-3'),
  ('$P', null, 'JOB_FAILURE', 'HIGH', 'SMS bez potwierdzenia doręczenia — fixture 4', 'e18-sms-4'),
  ('$P', null, 'JOB_FAILURE', 'MEDIUM', 'Błędy w przeglądarce użytkowników: 1 rodzaj(e), 1 wystąpień w 15 min', 'e18-browser');

-- drugi transport SG-03 (seed ma często 1 load); DELIVERED wymaga numerów zleceń (enforce_order_numbers)
insert into loads (id, project_id, status, hhl_order_no, carrier_order_no, plan_load_date, plan_delivery_date)
values ('c1111111-e018-4000-8000-000000000003', '$P', 'DELIVERED', 'E18/SG-03', 'SCX/E18-03',
        current_date - 10, current_date - 8)
on conflict (id) do nothing;
insert into shipment_items (project_id, load_id, shipment_code, cargo_class, length_m, width_m, height_m, unit_weight_t, qty, total_weight_t)
select '$P', 'c1111111-e018-4000-8000-000000000003', 'SG-03', 'DIMENSIONED', 12, 2, 1, 10, 1, 10
where not exists (select 1 from shipment_items where shipment_code = 'SG-03');

insert into load_events (load_id, event_type, occurred_at, payload)
values ('c1111111-e018-4000-8000-000000000003', 'GEOFENCE_EXIT', timestamptz '2026-10-07 10:19:54+00',
        '{"zone_kind":"SITE","zone_name":"Plac budowy Stegra Boden"}'::jsonb);
delete from positions where load_id = 'c1111111-e018-4000-8000-000000000003' and ts >= timestamptz '2026-10-07 10:19:54+00';
insert into positions (load_id, geom_raw, ts, source) values
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

# Hosted shim no-opuje supabase/migrations/* bez TOWER_ALLOW_MIG_REAPPLY (jak workflows.sh).
export TOWER_ALLOW_MIG_REAPPLY=1
psql "$URL" -q -v ON_ERROR_STOP=1 -f "$ROOT/supabase/migrations/0193_e18_porzadki.sql" >"$MIG_LOG" 2>&1
MIG_RC=$?
chk "migracja 0193 na fixture" "$MIG_RC" "0"
if [ "$MIG_RC" != "0" ]; then tail -25 "$MIG_LOG"; fi

chk "0 kont +tower-*" "$(PSQL -c "select count(*) from app_users where email ilike '%+tower-%'")" "0"
chk "polisa testowa usunięta" "$(PSQL -c "select count(*) from insurance_policies where policy_no='OCP-SCX-2026-WT'")" "0"
chk "ERGO Hestia" "$(PSQL -c "select insurer from insurance_policies where policy_no='436000430439' limit 1")" "ERGO Hestia"
chk "faktura testowa usunięta" "$(PSQL -c "select count(*) from invoices where invoice_number='WT-TEST-P6-20261005'")" "0"
chk "SG-24 PLANNED bez HHL" "$(PSQL -c "select status||'/'||coalesce(hhl_order_no,'') from loads l join shipment_items si on si.load_id=l.id where si.shipment_code='SG-24' limit 1")" "PLANNED/"
chk "SG-24 sprawy 5400 zamknięte" "$(PSQL -c "select count(*) from risk_signals rs join shipment_items si on si.load_id=rs.load_id where si.shipment_code='SG-24' and rs.resolved_at is null and coalesce(title,'') like '%5400%'")" "0"
chk "pozycje SG-03 po wyjeździe 0" "$(PSQL -c "select count(*) from positions p join shipment_items si on si.load_id=p.load_id where si.shipment_code='SG-03' and p.ts > timestamptz '2026-10-07 10:19:54+00'")" "0"
chk "P13 zamknięte" "$(PSQL -c "select count(*) from risk_signals where resolved_at is null and kind='JOB_FAILURE' and (title like 'SMS bez potwierdzenia%' or title like 'Błędy w przeglądarce%')")" "0"
chk "audit odpięty" "$(PSQL -c "select count(*) from audit_log where user_id = 'a1111111-e018-4000-8000-000000000001' or acting_as_user_id = 'a1111111-e018-4000-8000-000000000001'")" "0"
chk "E18_AUDIT_DETACH" "$(PSQL -c "select (count(*) > 0) from audit_log where action='E18_AUDIT_DETACH'")" "t"
psql "$URL" -q -v ON_ERROR_STOP=1 -f "$ROOT/supabase/migrations/0193_e18_porzadki.sql" >/dev/null 2>&1
chk "2. uruchomienie 0193" "$?" "0"
chk "po 2. uruchomieniu 0 +tower-*" "$(PSQL -c "select count(*) from app_users where email ilike '%+tower-%'")" "0"

# 12 wpisów audit → wyjątek
psql "$URL" -v ON_ERROR_STOP=1 -c "
insert into app_users (id, auth_id, org_id, email, role, active, full_name)
values ('b1111111-e018-4000-8000-000000000099', 'b1111111-e018-4000-8000-000000000099', '$HHL', 'sebastian+tower-test-extra@example.test', 'HHL_OPS', true, 'x');
insert into audit_log (user_id, action, entity, entity_id, source)
select 'b1111111-e018-4000-8000-000000000099', 'X', 'app_users', n::text, 'e18-wide' from generate_series(1,12) n;
" >/dev/null 2>&1
OUT=$(psql "$URL" -v ON_ERROR_STOP=1 -f "$ROOT/supabase/migrations/0193_e18_porzadki.sql" 2>&1 | tr -d '\r')
unset TOWER_ALLOW_MIG_REAPPLY
if echo "$OUT" | grep -q '0193 przerwane: E18 W22'; then
  ok=$((ok+1)); echo "  OK    12 wpisów audit → wyjątek W22"
else
  fail=$((fail+1)); echo "  FAIL  12 wpisów audit → wyjątek W22 ($(echo "$OUT" | tail -1))"
fi
psql "$URL" -c "delete from audit_log where source='e18-wide'; delete from app_users where id='b1111111-e018-4000-8000-000000000099';" >/dev/null 2>&1

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

echo; echo "WYNIK: $ok OK, $fail FAIL"
[ "$fail" -eq 0 ]
