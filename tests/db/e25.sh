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
# P1: SCX — czas wcześniej niż poprzedni STATUS_* → odmowa (HHL_ADMIN może).
err "SCX: czas wcześniej niż poprzedni status (P1)" $SCX "select load_status_set('$L1','IN_TRANSIT_PL',now(),null); select load_status_set('$L1','AT_PORT_GDANSK',(select max(occurred_at)-interval '1 minute' from load_events where load_id='$L1' and event_type like 'STATUS_%'),null)" "wcześniej niż poprzedni"
# Ta sama transakcja: najpierw do przodu, potem próba wstecz (osobny rollback zostawiałby READY→READY = no-op).
err "SCX wstecz" $SCX "select load_status_set('$L1','IN_TRANSIT_PL',now(),null); select load_status_set('$L1','READY',now(),'cofka')" "tylko do przodu"
err "HHL_ADMIN wstecz bez powodu" $HHL "select load_status_set('$L1','IN_TRANSIT_PL',now(),null); select load_status_set('$L1','READY',now(),null)" "powodu"
val "HHL_ADMIN wstecz z powodem" $HHL "select load_status_set('$L1','IN_TRANSIT_PL',now(),null); select load_status_set('$L1','READY',now(),'korekta'); select status::text from loads where id='$L1'" READY

echo; echo "[e25] UNLOADED→DELIVERED, READY_TO_INVOICE/INVOICED (H1), actor i czas (H2)"
# commit: actual_delivery_at i audit sprawdzane osobnym zapytaniem poza transakcją testu
val "UNLOADED → DELIVERED" $HHL "select load_status_set('$L2','UNLOADED',now(),null); select status::text from loads where id='$L2'" DELIVERED commit
sval "actual_delivery_at po Dostarczone" "select (actual_delivery_at is not null) from loads where id='$L2'" t
sval "A3: po Dostarczone bez CMR → sprawa CMR_UPLOAD" "select count(*) from decisions where load_id='$L2' and type_code='CMR_UPLOAD' and status in ('NEW','ASSIGNED','SNOOZED')" 1
sval "A3: typ CMR_UPLOAD ma opcję UPLOAD_CMR" "select options->0->>'code' from decision_types where code='CMR_UPLOAD'" UPLOAD_CMR
# F7 P4: przed C17 — klik UPLOAD_CMR tylko otwiera okno, sprawa zostaje NEW.
val "A3: UPLOAD_CMR nie zamyka sprawy" $SCX "select (decision_resolve(
  (select id from decisions where load_id='$L2' and type_code='CMR_UPLOAD' and status in ('NEW','ASSIGNED','SNOOZED') limit 1),
  'UPLOAD_CMR')->>'kept_open')||'|'||(select status::text from decisions where load_id='$L2' and type_code='CMR_UPLOAD' order by created_at desc limit 1)" "true|NEW" commit
# A5: DELIVERED nadpisuje wybraną godzinę (W3)
val "DELIVERED: korekta dopiskiem i actual_delivery_at" $HHL "select load_status_set('$L2','DELIVERED',timestamptz '2026-10-07 10:19:54+00','korekta godziny'); select (
  (select actual_delivery_at = timestamptz '2026-10-07 10:19:54+00' from loads where id='$L2')
  and (select count(*) from load_events where load_id='$L2' and event_type='STATUS_DELIVERED') = 2
  and (select payload->>'korekta' = 'true' and occurred_at = timestamptz '2026-10-07 10:19:54+00' from load_events where load_id='$L2' and event_type='STATUS_DELIVERED' order by id desc limit 1)
)::text" true commit
val "SCX: godzina DELIVERED na własnym transporcie (P2)" $SCX "select load_status_set('$L2','DELIVERED',timestamptz '2026-10-07 11:00:00+00',null); select (
  (select status::text = 'DELIVERED' and actual_delivery_at = timestamptz '2026-10-07 11:00:00+00' from loads where id='$L2')
  and (select count(*) from load_events where load_id='$L2' and event_type='STATUS_DELIVERED') = 2
)::text" true commit
# A5: READY_TO_INVOICE bez CMR
err "READY_TO_INVOICE bez CMR" $SCX "select load_status_set('$L2','READY_TO_INVOICE',now(),null)" "CMR"
# A4: CMR sprzed dostawy nie wystarcza także przy ręcznym READY (jak C17)
sys "delete from documents where load_id='$L2' and category='CMR' and storage_path like 'test/e25-cmr%'" >/dev/null
sys "insert into documents (project_id, load_id, category, storage_path, file_name, mime_type, size_bytes, uploaded_at)
     values ('$P','$L2','CMR','test/e25-cmr-early.pdf','cmr.pdf','application/pdf',100,
             timestamptz '2026-10-06 08:00:00+00')" >/dev/null
sval "C17 wczesny CMR: nadal DELIVERED" "select status::text from loads where id='$L2'" DELIVERED
err "A4: READY_TO_INVOICE z CMR sprzed dostawy — odmowa" $SCX "select load_status_set('$L2','READY_TO_INVOICE',now(),null)" "CMR"
# C17: CMR po dostawie → STATUS_AUTO READY_TO_INVOICE
sys "update documents set superseded_at=now() where load_id='$L2' and category='CMR' and superseded_at is null" >/dev/null
sys "insert into documents (project_id, load_id, category, storage_path, file_name, mime_type, size_bytes, uploaded_at)
     values ('$P','$L2','CMR','test/e25-cmr-auto.pdf','cmr.pdf','application/pdf',100,
             timestamptz '2026-10-07 12:00:00+00')" >/dev/null
sval "C17 CMR po dostawie → READY STATUS_AUTO" "select status::text || '|' || (select count(*)::text from load_events where load_id='$L2' and event_type='STATUS_AUTO' and payload->>'to'='READY_TO_INVOICE') from loads where id='$L2'" "READY_TO_INVOICE|1"
# A4: ręczne READY przy CMR po dostawie (HHL cofa, SCX ustawia READY)
val "HHL cofa do DELIVERED (A4)" $HHL "select load_status_set('$L2','DELIVERED',timestamptz '2026-10-07 10:19:54+00','cofka e25'); select status::text from loads where id='$L2'" DELIVERED commit
val "A4: SCX → READY_TO_INVOICE przy CMR po dostawie" $SCX "select load_status_set('$L2','READY_TO_INVOICE',now(),null); select status::text || '|' || (select count(*)::text from load_events where load_id='$L2' and event_type='STATUS_READY_TO_INVOICE') from loads where id='$L2'" "READY_TO_INVOICE|1" commit
sval "A3: C17 zamyka CMR_UPLOAD" "select count(*) from decisions where load_id='$L2' and type_code='CMR_UPLOAD' and status in ('NEW','ASSIGNED','SNOOZED')" 0
# A5: INVOICED bez faktur
sys "delete from invoice_lines where load_id='$L2'" >/dev/null
err "INVOICED bez faktur" $HHL "select load_status_set('$L2','INVOICED',now(),null)" "brak faktury"
# C17: obie faktury z plikiem → INVOICED STATUS_AUTO; potem ręczna ścieżka z actor
HHLO=00000000-0000-0000-0000-00000000a001
KSHO=00000000-0000-0000-0000-00000000a002
sys "insert into documents (id, project_id, load_id, category, storage_path, file_name, mime_type, size_bytes)
     values ('aaaaaaaa-0000-4000-8000-00000000e25d','$P','$L2','INVOICE','test/e25-inv-k.pdf','k.pdf','application/pdf',100),
            ('aaaaaaaa-0000-4000-8000-00000000e25e','$P','$L2','INVOICE','test/e25-inv-p.pdf','p.pdf','application/pdf',100)
     on conflict (id) do nothing" >/dev/null
sys "insert into invoices (id, project_id, carrier_org_id, period_start, period_end, currency, direction, issuer_org_id, recipient_org_id, invoice_number, issue_date, week_key, document_id, status)
     values ('aaaaaaaa-0000-4000-8000-00000000e251','$P','$SCXO','2026-10-06','2026-10-12','EUR','KOSZT','$SCXO','$HHLO','E25/K/1','2026-10-13','2026-W41','aaaaaaaa-0000-4000-8000-00000000e25d','SUBMITTED')
     on conflict (id) do update set document_id=excluded.document_id, status='SUBMITTED'" >/dev/null
sys "insert into invoices (id, project_id, carrier_org_id, period_start, period_end, currency, direction, issuer_org_id, recipient_org_id, invoice_number, issue_date, week_key, document_id, status)
     values ('aaaaaaaa-0000-4000-8000-00000000e252','$P','$SCXO','2026-10-06','2026-10-12','EUR','PRZYCHOD','$HHLO','$KSHO','E25/P/1','2026-10-13','2026-W41','aaaaaaaa-0000-4000-8000-00000000e25e','SUBMITTED')
     on conflict (id) do update set document_id=excluded.document_id, status='SUBMITTED'" >/dev/null
sys "insert into invoice_lines (invoice_id, load_id, direction, expected_amount, invoiced_amount)
     values ('aaaaaaaa-0000-4000-8000-00000000e251','$L2','KOSZT',1,1)
     on conflict (invoice_id, load_id) do update set direction=excluded.direction" >/dev/null
sys "insert into invoice_lines (invoice_id, load_id, direction, expected_amount, invoiced_amount)
     values ('aaaaaaaa-0000-4000-8000-00000000e252','$L2','PRZYCHOD',1,1)
     on conflict (invoice_id, load_id) do update set direction=excluded.direction" >/dev/null
sval "C17 obie faktury → INVOICED STATUS_AUTO" "select status::text || '|' || (select count(*)::text from load_events where load_id='$L2' and event_type='STATUS_AUTO' and payload->>'to'='INVOICED') from loads where id='$L2'" "INVOICED|1"
val "HHL ręcznie INVOICED + actor" $HHL "select load_status_set('$L2','READY_TO_INVOICE',now(),'cofka e25'); select load_status_set('$L2','INVOICED',now(),null); select (payload->>'actor' like '% // %')::text from load_events where load_id='$L2' and event_type='STATUS_INVOICED' order by id desc limit 1" true commit
val "HHL_ADMIN: czas wstecz dozwolony (0234)" $HHL "select load_status_set('$L2','READY_TO_INVOICE',(select max(occurred_at)-interval '1 second' from load_events where load_id='$L2' and event_type like 'STATUS_%'),'test cofniecia czasu'); select status::text from loads where id='$L2'" READY_TO_INVOICE commit
val "HHL_ADMIN: przywróć INVOICED" $HHL "select load_status_set('$L2','INVOICED',now(),null); select status::text from loads where id='$L2'" INVOICED commit
# P4: ten sam status — korekta czasu wpisu osi + actual_delivery_at
val "HHL_ADMIN: korekta czasu — nowy wpis, stary zostaje (P4)" $HHL "select load_status_set('$L2','INVOICED',timestamptz '2026-10-08 09:00:00+00','korekta osi'); select (
  (select count(*) from load_events where load_id='$L2' and event_type='STATUS_INVOICED' and coalesce(payload->>'korekta','') <> 'true')
  = (select count(*) - 1 from load_events where load_id='$L2' and event_type='STATUS_INVOICED')
  and (select occurred_at = timestamptz '2026-10-08 09:00:00+00' and payload->>'korekta' = 'true' and payload->>'przez' = 'HHL_ADMIN'
       from load_events where load_id='$L2' and event_type='STATUS_INVOICED' order by id desc limit 1)
)::text" true commit
err "SCX: korekta czasu tego samego statusu" $SCX "select load_status_set('$L2','INVOICED',timestamptz '2026-10-08 08:00:00+00',null)" "Korektę czasu"
sval "P4: audit time_only" "select (new_value->>'time_only') from audit_log where action='LOAD_STATUS_SET' and entity_id='$L2' and new_value->>'time_only'='true' order by created_at desc limit 1" true
val "HHL_ADMIN: czas w przyszłości dozwolony (0234)" $HHL "select load_status_set('$L1','AT_LOADING',now()+interval '2 hours',null); select status::text from loads where id='$L1'" AT_LOADING commit
err "SCX: czas w przyszłości odrzucony" $SCX "select load_status_set('$L1','IN_TRANSIT_PL',now()+interval '3 hours',null)" "przyszłości"
err "anulowanie bez powodu" $HHL "select load_status_set('$L1','CANCELLED',now(),null)" "powodu"
err "SCX nie anuluje" $SCX "select load_status_set('$L1','CANCELLED',now(),'x')" "Anulowanie"
val "HHL anuluje z powodem" $HHL "select load_status_set('$L1','CANCELLED',now(),'test e25'); select status::text from loads where id='$L1'" CANCELLED commit
# P1: korekta czasu nie kolejkuje STATUS_CANCELLED (automatyzacja włączona tylko w teście).
# Reguły START-* powstają w 0094, zanim seed wstawi projekt — w zestawie tower trzeba je dopisać.
sys "insert into workflows (project_id, code, name, description, trigger_type, condition, actions, enabled)
     select '$P', 'START-7', 'Transport anulowany', 'test e25', 'STATUS_CANCELLED', 'true'::jsonb,
            '[{\"type\":\"notify\",\"audience\":\"CARRIER\"}]'::jsonb, true
      where not exists (select 1 from workflows where project_id='$P' and code='START-7')" >/dev/null
sys "update workflows set enabled=true where code='START-7' and project_id='$P'" >/dev/null
sys "insert into load_events (load_id, event_type, occurred_at, payload) values ('$L1','STATUS_CANCELLED',now(),'{}'::jsonb)" >/dev/null
sval "STATUS_CANCELLED bez korekty kolejkuje przebieg" "select count(*) from workflow_runs r join workflows w on w.id=r.workflow_id where w.code='START-7' and r.load_id='$L1'" 1
val "HHL_ADMIN: korekta czasu CANCELLED" $HHL "select load_status_set('$L1','CANCELLED',timestamptz '2026-10-09 08:00:00+00','korekta osi'); select (payload->>'korekta') from load_events where load_id='$L1' and event_type='STATUS_CANCELLED' order by id desc limit 1" true commit
sval "korekta CANCELLED nie dodaje przebiegu" "select count(*) from workflow_runs r join workflows w on w.id=r.workflow_id where w.code='START-7' and r.load_id='$L1'" 1
sval "audit LOAD_STATUS_SET" "select count(*)>=1 from audit_log where action='LOAD_STATUS_SET' and entity_id='$L2'" t
# D-2315 / F7 #340: druga korekta wskazuje dopisek; korekta po STATUS_AUTO; imię i firma.
sys "update app_users set full_name='Anna Admin' where auth_id='$HHL'" >/dev/null
sys "insert into loads (id, project_id, carrier_org_id, order_no, status, hhl_order_no, carrier_order_no)
     values ('33333333-0000-0000-0000-00000000d931','$P','$SCXO','123456/2026/D931','PLANNED','HHL/D931','SCX/D931'),
            ('33333333-0000-0000-0000-00000000d932','$P','$SCXO','123456/2026/D932','PLANNED','HHL/D932','SCX/D932'),
            ('33333333-0000-0000-0000-00000000d933','$P','$SCXO','123456/2026/D933','PLANNED','HHL/D933','SCX/D933'),
            ('33333333-0000-0000-0000-00000000d934','$P','$SCXO','123456/2026/D934','AT_SITE','HHL/D934','SCX/D934')
     on conflict (id) do update set status=excluded.status, carrier_org_id=excluded.carrier_org_id,
       hhl_order_no=excluded.hhl_order_no, carrier_order_no=excluded.carrier_order_no" >/dev/null
sys "insert into load_events (load_id, event_type, occurred_at, payload)
     values ('33333333-0000-0000-0000-00000000d934','STATUS_AUTO',timestamptz '2026-10-07 10:00:00+00','{\"to\":\"AT_SITE\"}'::jsonb)" >/dev/null
val "korekta 14:00 → 12:30 → 13:00 wskazuje dopisek" $HHL "select load_status_set('33333333-0000-0000-0000-00000000d931','DELIVERED',timestamptz '2026-10-07 14:00:00+00',null); select load_status_set('33333333-0000-0000-0000-00000000d931','DELIVERED',timestamptz '2026-10-07 12:30:00+00','k1'); select load_status_set('33333333-0000-0000-0000-00000000d931','DELIVERED',timestamptz '2026-10-07 13:00:00+00','k2'); select (
  (e2.payload->>'zastepuje') = e1.id::text
  and (e2.payload->>'poprzednio')::timestamptz = timestamptz '2026-10-07 12:30:00+00'
  and e2.payload->>'actor' = 'Anna Admin // H&H Logistics'
  and e2.payload->>'actor_id' = current_app_user_id()::text
  and e2.payload->>'note' = 'k2'
)::text
from load_events e2
join load_events e1 on e1.id::text = e2.payload->>'zastepuje'
where e2.load_id='33333333-0000-0000-0000-00000000d931'
  and e2.occurred_at = timestamptz '2026-10-07 13:00:00+00'" true commit
val "korekta po STATUS_AUTO zapisuje dopisek" $HHL "select load_status_set('33333333-0000-0000-0000-00000000d934','AT_SITE',timestamptz '2026-10-07 11:00:00+00','powod auto'); select (
  e.payload->>'korekta' = 'true'
  and e.payload->>'zastepuje' = a.id::text
  and (e.payload->>'poprzednio')::timestamptz = timestamptz '2026-10-07 10:00:00+00'
  and e.payload->>'note' = 'powod auto'
  and e.payload->>'actor' = 'Anna Admin // H&H Logistics'
)::text
from load_events e
join load_events a on a.load_id = e.load_id and a.event_type = 'STATUS_AUTO'
where e.load_id='33333333-0000-0000-0000-00000000d934'
  and e.event_type='STATUS_AT_SITE'
  and e.payload->>'korekta' = 'true'" true commit
sys "insert into loads (id, project_id, carrier_org_id, order_no, status, actual_delivery_at, hhl_order_no, carrier_order_no)
     values ('33333333-0000-0000-0000-00000000d935','$P','$SCXO','123456/2026/D935','DELIVERED',timestamptz '2026-10-07 09:00:00+00','HHL/D935','SCX/D935')
     on conflict (id) do update set status=excluded.status, actual_delivery_at=excluded.actual_delivery_at" >/dev/null
val "korekta bez wpisu: zastepuje null, poprzednio z actual" $HHL "select load_status_set('33333333-0000-0000-0000-00000000d935','DELIVERED',timestamptz '2026-10-07 09:30:00+00','bez wpisu'); select (
  e.payload->>'zastepuje' is null
  and (e.payload->>'poprzednio')::timestamptz = timestamptz '2026-10-07 09:00:00+00'
)::text
from load_events e
where e.load_id='33333333-0000-0000-0000-00000000d935'
  and e.event_type='STATUS_DELIVERED'
  and e.payload->>'korekta' = 'true'" true commit
val "HHL koryguje D932 do 12:30" $HHL "select load_status_set('33333333-0000-0000-0000-00000000d932','DELIVERED',timestamptz '2026-10-07 14:00:00+00',null); select load_status_set('33333333-0000-0000-0000-00000000d932','DELIVERED',timestamptz '2026-10-07 12:30:00+00','k1'); select (actual_delivery_at = timestamptz '2026-10-07 12:30:00+00')::text from loads where id='33333333-0000-0000-0000-00000000d932'" true commit
val "SCX: DELIVERED 12:30 bez błędu" $SCX "select load_status_set('33333333-0000-0000-0000-00000000d932','DELIVERED',timestamptz '2026-10-07 12:30:00+00',null); select (actual_delivery_at = timestamptz '2026-10-07 12:30:00+00')::text from loads where id='33333333-0000-0000-0000-00000000d932'" true commit
val "SCX: DELIVERED 12:45 nadpisuje godzinę" $SCX "select load_status_set('33333333-0000-0000-0000-00000000d932','DELIVERED',timestamptz '2026-10-07 12:45:00+00',null); select (actual_delivery_at = timestamptz '2026-10-07 12:45:00+00')::text from loads where id='33333333-0000-0000-0000-00000000d932'" true commit
val "HHL: READY 09:00 potem 08:00" $HHL "select load_status_set('33333333-0000-0000-0000-00000000d933','READY',timestamptz '2026-10-07 09:00:00+00',null); select load_status_set('33333333-0000-0000-0000-00000000d933','READY',timestamptz '2026-10-07 08:00:00+00','korekta ready'); select status::text from loads where id='33333333-0000-0000-0000-00000000d933'" READY commit
val "SCX przyjmuje LOADING o 08:30" $SCX "select load_status_set('33333333-0000-0000-0000-00000000d933','AT_LOADING',timestamptz '2026-10-07 08:30:00+00',null); select status::text from loads where id='33333333-0000-0000-0000-00000000d933'" AT_LOADING commit
# A5: bezpośredni UPDATE statusu z sesji — odmowa
err "HHL bezpośredni UPDATE statusu" $HHL "update loads set status='IN_TRANSIT_PL' where id='$L1'" "load_status_set"
err "SCX bezpośredni UPDATE statusu" $SCX "update loads set status='IN_TRANSIT_PL' where id='$L1'" "load_status_set"

echo; echo "[e25] A9 awiz_missing / Gotowy"
sys "insert into loads (id, project_id, carrier_org_id, order_no, status, plan_load_date,
     driver_name, driver_phone, tractor_plate, trailer_plate, trailer_swap,
     driver_delivery_name, driver_delivery_phone, tractor_delivery_plate,
     hhl_order_no, carrier_order_no)
     values ('33333333-0000-0000-0000-00000000a901','$P','$SCXO','123456/2026/A901','PLANNED','2026-10-20',
     'Jan A9','600111222','WGM1A9','GDA1A9',true,
     'Erik A9',null,'ABC1A9',
     'HHL/A901','SCX/A901')
     on conflict (id) do update set status='PLANNED', trailer_swap=true,
       driver_delivery_phone=null, hhl_order_no=excluded.hhl_order_no, carrier_order_no=excluded.carrier_order_no" >/dev/null
# F7 B4: AWIZ_SE nie wraca w awiz_missing / load_ready_gaps (sprawa L3 NO_AWIZ_SE).
sval "A9: brak AWIZ_SE w awiz_missing (F7 B4)" "select exists (
  select 1 from jsonb_array_elements(awiz_missing('33333333-0000-0000-0000-00000000a901')) g
   where g->>'kind'='AWIZ_SE')" f
sval "A9: detect_resource_deadlines = 0" "select detect_resource_deadlines()" 0
# CI bez pg_cron: CASE WHEN nie chroni przed parse cron.job — jak insurance.sh / workflows.sh.
if [ "$(sys "select to_regclass('cron.job') is not null" | tail -1)" = "t" ]; then
  sval "A9: cron tower-zasoby wyłączony" "select count(*) from cron.job where jobname='tower-zasoby'" 0
else
  ok=$((ok+1)); echo "  OK    A9: cron tower-zasoby wyłączony"
fi
val "A9: HHL bez AWIZ_SE w load_ready_gaps (F7 B4)" $HHL "select (gaps @> '[{\"kind\":\"AWIZ_SE\"}]')::text from load_ready_gaps() where load_id='33333333-0000-0000-0000-00000000a901'" false
# A10 F7: rejs poza lukami Przygotowania (NO_SAILING z #370, nie blokada Gotowy).
sval "A10: SAILING poza awiz_missing" "select exists (
  select 1 from jsonb_array_elements(awiz_missing('33333333-0000-0000-0000-00000000a901')) g
   where g->>'kind'='SAILING')" f
# F7 P3/P8: bez fałszywego POLICY_SCX gdy brak przewoźnika; UPLOAD_CMR nie zamyka.
sys "insert into loads (id, project_id, carrier_org_id, order_no, status, plan_load_date,
     driver_name, driver_phone, tractor_plate, trailer_plate, trailer_swap,
     hhl_order_no, carrier_order_no)
     values ('33333333-0000-0000-0000-00000000a902','$P',null,'123456/2026/A902','PLANNED','2026-10-20',
     'Jan A9b','600111223','WGM1A2','GDA1A2',false,
     'HHL/A902','SCX/A902')
     on conflict (id) do update set status='PLANNED', carrier_org_id=null" >/dev/null
sval "A9: bez POLICY_SCX gdy brak carrier" "select exists (
  select 1 from jsonb_array_elements(awiz_missing('33333333-0000-0000-0000-00000000a902')) g
   where g->>'kind'='POLICY_SCX')" f
sval "A9: CARRIER gdy brak przewoźnika (F7 P3)" "select exists (
  select 1 from jsonb_array_elements(awiz_missing('33333333-0000-0000-0000-00000000a902')) g
   where g->>'kind'='CARRIER')" t
# F7 P8: EXPIRED — UUID tylko hex (bez „x”); zamknięcie A3 nie rusza EXPIRED.
sys "delete from decisions where id in ('33333333-0000-0000-0000-00000000ee01','33333333-0000-0000-0000-00000000ee02')" >/dev/null
sys "insert into decisions (id, project_id, type_code, title, status, expired_reason, detail)
     values ('33333333-0000-0000-0000-00000000ee01','$P','DOC_MISSING','CMR po terminie','EXPIRED','termin minął',
             '{\"category\":\"CMR\",\"event_key\":\"e25:exp:doc\"}'::jsonb),
            ('33333333-0000-0000-0000-00000000ee02','$P','NO_AWIZACJA','brak awizacji','EXPIRED','termin minął',
             '{\"event_key\":\"e25:exp:awiz\"}'::jsonb)" >/dev/null
sys "update decisions d set status='RESOLVED', resolved_at=now(), resolution_code='A3_STALE_REQ', expired_reason=null, updated_at=now()
     where d.type_code='DOC_MISSING' and d.status in ('NEW','ASSIGNED','SNOOZED')
       and coalesce(d.detail->>'category','') in ('POD','SPEC','LASHING_PHOTO','PERMIT_SE','CMR')" >/dev/null
sval "A3: EXPIRED DOC_MISSING nietknięty (B1/P8)" "select status::text||'|'||coalesce(expired_reason,'') from decisions where id='33333333-0000-0000-0000-00000000ee01'" "EXPIRED|termin minął"
sval "A3: EXPIRED NO_AWIZACJA nietknięty (B1/P8)" "select status::text||'|'||coalesce(expired_reason,'') from decisions where id='33333333-0000-0000-0000-00000000ee02'" "EXPIRED|termin minął"
sval "A9: SE poza lukami — 0× AWIZ_SE (F7 B4)" "select count(*) from jsonb_array_elements(awiz_missing('33333333-0000-0000-0000-00000000a901')) g where g->>'kind'='AWIZ_SE'" 0
sval "A9: SE poza AWIZ — brak kind AWIZ przy pełnym PL" "select exists (select 1 from jsonb_array_elements(awiz_missing('33333333-0000-0000-0000-00000000a901')) g where g->>'kind'='AWIZ')" f
# Komplet → Gotowy: rejs + polisa; SE nie w lukach (F7 B4); PERMIT wyłączony.
# UUID rejsu tylko hex (s901 było nielegalne → cast uuid → „^” w logu CI).
sys "update security_flags set enabled=false where key='PERMIT_REQUIRED_NON_STANDARD'" >/dev/null
sys "delete from shipment_items where load_id='33333333-0000-0000-0000-00000000a901' and shipment_code='E25-A901';
     insert into shipment_items (project_id, load_id, shipment_code, cargo_class, length_m, width_m, height_m)
     values ('$P','33333333-0000-0000-0000-00000000a901','E25-A901','STANDARD',null,null,null)" >/dev/null
sys "insert into vessels (id, name, operator) values ('55555555-0000-0000-0000-00000000e25a','E25 A901','Polferries')
     on conflict (id) do update set name=excluded.name, operator=excluded.operator" >/dev/null
sys "insert into sailings (id, project_id, vessel_id, route, departure_at, arrival_at, source)
     values ('33333333-0000-0000-0000-00000000f901','$P','55555555-0000-0000-0000-00000000e25a','GDN-NYN',
             '2026-12-15 20:00:00+00','2026-12-16 08:00:00+00','RECZNIE')
     on conflict (id) do update set vessel_id=excluded.vessel_id, departure_at=excluded.departure_at,
       arrival_at=excluded.arrival_at, route=excluded.route" >/dev/null
sval "A9: rejs f901 w bazie" "select count(*) from sailings where id='33333333-0000-0000-0000-00000000f901'" 1
# Polisa na datę załadunku a901 (nie sztywne 2026-10-20 — F7 koordynator po ed161f7).
sys "delete from insurance_policies where policy_no='POL-E25-A901';
     insert into insurance_policies (org_id, policy_no, insurer, valid_from, valid_until, approval_status)
     select '$SCXO', 'POL-E25-A901', 'Test',
            coalesce((select plan_load_date from loads where id='33333333-0000-0000-0000-00000000a901'), current_date) - 30,
            coalesce((select plan_load_date from loads where id='33333333-0000-0000-0000-00000000a901'), current_date) + 400,
            'APPROVED'" >/dev/null
# Bez telefonu SE (AWIZ_SE) + rejs + polisa → READY (AWIZ_SE nie blokuje Gotowy).
# A10 F7: sys na wyzwalaczu nie rusza PLANNED — jawne a9_try_ready (bez a10_trg).
sys "update loads set sailing_id='33333333-0000-0000-0000-00000000f901', escort_vehicles=0
     where id='33333333-0000-0000-0000-00000000a901'" >/dev/null
sval "A9: a9_try_ready po komplecie" "select a9_try_ready('33333333-0000-0000-0000-00000000a901')" t
sval "A9: komplet bez SE → Gotowy (D-1525)" "select status::text from loads where id='33333333-0000-0000-0000-00000000a901'" READY
sval "A9: drugi a9_try_ready = 0 zmian" "select a9_try_ready('33333333-0000-0000-0000-00000000a901')" f
# A10: demotion READY → RESOURCES_PENDING po usunięciu kierowcy; ponowny READY = nowy STATUS_AUTO.
# Usunięcie kierowcy: sys na wyzwalaczu — last STATUS_AUTO pozwala cofnąć.
sys "update loads set driver_name=null where id='33333333-0000-0000-0000-00000000a901'" >/dev/null
sval "A10: bez kierowcy → RESOURCES_PENDING" "select status::text from loads where id='33333333-0000-0000-0000-00000000a901'" RESOURCES_PENDING
sys "update loads set driver_name='Jan A9' where id='33333333-0000-0000-0000-00000000a901'" >/dev/null
sval "A10: kierowca z powrotem → READY" "select status::text from loads where id='33333333-0000-0000-0000-00000000a901'" READY
sval "A10: ponowny READY ma ≥2 STATUS_AUTO→READY" "select count(*) >= 2 from load_events
  where load_id='33333333-0000-0000-0000-00000000a901' and event_type='STATUS_AUTO'
    and payload->>'to'='READY'" t
# A10 F7: ręczny READY + edycja awizacji → bez cofnięcia.
sys "select set_config('tower.status_ctx','on',true); update loads set status='READY', driver_name='Jan A9'
     where id='33333333-0000-0000-0000-00000000a901';
     insert into load_events (load_id, event_type, occurred_at, payload)
     values ('33333333-0000-0000-0000-00000000a901','STATUS_READY',now(),
             jsonb_build_object('manual', true, 'to', 'READY'));
     select set_config('tower.status_ctx','',true)" >/dev/null
sys "update loads set driver_phone=null where id='33333333-0000-0000-0000-00000000a901'" >/dev/null
sval "A10: ręczny READY + edycja → bez cofnięcia" "select status::text from loads where id='33333333-0000-0000-0000-00000000a901'" READY
sys "update loads set driver_phone='600111222' where id='33333333-0000-0000-0000-00000000a901'" >/dev/null
# A10 F7: automat nie ustawia READY bez hhl_order_no (W12) — ryzyko rk_auto_status_blocked (risks.sh).
sys "update loads set status='PLANNED', hhl_order_no=null where id='33333333-0000-0000-0000-00000000a902'" >/dev/null
sval "A10: auto READY bez HHL → zablokowane" "select auto_set_status('33333333-0000-0000-0000-00000000a902','PLANNED'::load_status,'READY'::load_status,'test W12',now(),'{}'::jsonb)" f
sval "A10: ryzyko rk_auto_status_blocked" "select count(*) from risk_signals where load_id='33333333-0000-0000-0000-00000000a902' and title_key='rk_auto_status_blocked'" 1
# A10 F7: PLANNED bez daty załadunku — skan nie przenosi do Brak zasobów.
sys "insert into loads (id, project_id, carrier_org_id, order_no, status, plan_load_date,
     hhl_order_no, carrier_order_no)
     values ('33333333-0000-0000-0000-00000000a904','$P','$SCXO','123456/2026/A904','PLANNED',null,
     'HHL/A904','SCX/A904')
     on conflict (id) do update set status='PLANNED', plan_load_date=null,
       hhl_order_no=excluded.hhl_order_no, carrier_order_no=excluded.carrier_order_no" >/dev/null
sval "A10: PLANNED bez daty → target PLANNED" "select a10_prep_target_status('33333333-0000-0000-0000-00000000a904')::text" PLANNED
sval "A10: skan PLANNED bez daty = bez zmian" "select set_config('tower.a10_prep_scan','on',true);
  select a10_try_prep_status('33333333-0000-0000-0000-00000000a904')" f
sval "A10: PLANNED bez daty zostaje" "select status::text from loads where id='33333333-0000-0000-0000-00000000a904'" PLANNED
# A10 F7: auto w sesji SCX z request.jwt.claims (jak PostgREST) — bez „Status nie może się cofnąć”.
sys "select set_config('tower.status_ctx','on',true);
     update loads set status='READY', driver_name='Jan A9', driver_phone='600111222'
       where id='33333333-0000-0000-0000-00000000a901';
     insert into load_events (load_id, event_type, occurred_at, payload, dedup_key)
     values ('33333333-0000-0000-0000-00000000a901','STATUS_AUTO',now(),
             jsonb_build_object('from','RESOURCES_PENDING','to','READY','powod','setup F7 claims'),
             'STATUS_AUTO:33333333-0000-0000-0000-00000000a901:READY:f7claims');
     select set_config('tower.status_ctx','off',true)" >/dev/null
sval "A10: SCX+claims auto cofa bez ryzyka" "begin;
  set local role authenticated;
  set local request.jwt.claim.sub='$SCX';
  set local request.jwt.claims='{\"sub\":\"$SCX\",\"role\":\"authenticated\"}';
  update loads set driver_name=null where id='33333333-0000-0000-0000-00000000a901';
  select status::text || '|' || (
    select count(*)::text from risk_signals
     where load_id='33333333-0000-0000-0000-00000000a901'
       and title_key='rk_auto_status_blocked'
       and coalesce(detail->>'blad','') ilike '%cofn%')
  from loads where id='33333333-0000-0000-0000-00000000a901';
commit" "RESOURCES_PENDING|0"
# CMR_UPLOAD widoczna dla SCX + reopen EXPIRED + idempotentność.
# DELIVERED wymaga hhl_order_no + carrier_order_no (0003) — bez nich INSERT padał i SCX widział 0 spraw.
sys "insert into loads (id, project_id, carrier_org_id, order_no, status, plan_load_date, plan_delivery_date,
     hhl_order_no, carrier_order_no, actual_delivery_at)
     values ('33333333-0000-0000-0000-00000000a903','$P','$SCXO','123456/2026/A903','DELIVERED','2026-10-10','2026-10-15',
     'HHL/A903','SCX/A903', timestamptz '2026-10-15 12:00:00+00')
     on conflict (id) do update set status='DELIVERED', carrier_org_id=excluded.carrier_org_id,
       hhl_order_no=excluded.hhl_order_no, carrier_order_no=excluded.carrier_order_no,
       actual_delivery_at=excluded.actual_delivery_at" >/dev/null
sys "select a3_ensure_cmr_upload('33333333-0000-0000-0000-00000000a903')" >/dev/null
val "A3: CMR_UPLOAD widoczna dla SCX" $SCX "select count(*) from decisions where load_id='33333333-0000-0000-0000-00000000a903' and type_code='CMR_UPLOAD' and status in ('NEW','ASSIGNED','SNOOZED')" 1
# CHECK 0102: EXPIRED ⇒ expired_reason NOT NULL; RESOLVED ⇔ resolved_at — resolved_at przy EXPIRED psuje UPDATE.
sys "select decision_expire(d.id, 'termin minal') from decisions d
     where d.load_id='33333333-0000-0000-0000-00000000a903' and d.type_code='CMR_UPLOAD'
       and d.status in ('NEW','ASSIGNED','SNOOZED')" >/dev/null
sval "A3: po decision_expire status EXPIRED" "select status::text from decisions
  where load_id='33333333-0000-0000-0000-00000000a903' and type_code='CMR_UPLOAD'
  order by updated_at desc limit 1" EXPIRED
# Osobne komendy: ten sam SELECT z ensure+status potrafił czytać EXPIRED sprzed reopen (plan zapytania).
sval "A3: reopen EXPIRED CMR_UPLOAD zwraca id" "select a3_ensure_cmr_upload('33333333-0000-0000-0000-00000000a903') is not null" t
sval "A3: po reopen NEW bez expired_reason" "select status::text||'|'||(expired_reason is null)::text from decisions
  where load_id='33333333-0000-0000-0000-00000000a903' and type_code='CMR_UPLOAD'
  order by updated_at desc limit 1" "NEW|true"
sval "A3: drugi a3_ensure na otwartej = null (0 zmian)" "select a3_ensure_cmr_upload('33333333-0000-0000-0000-00000000a903') is null" t
sval "A9: brak otwartych RES:* (Do zrobienia spójne)" "select count(*) from decisions
  where status in ('NEW','ASSIGNED','SNOOZED')
    and (coalesce(detail->>'event_key','') like 'RES:%' or coalesce(detail->>'event_key','') like 'l3:RES:%')" 0

# --- A7: symbol_specs, zezwolenie firmowe, polisa HHL ---
sys "select a7_seed_firm_assets()" >/dev/null
sval "A7: symbol_specs = 10" "select count(*) from symbol_specs" 10
sval "A7: zezwolenie 13/GD/2026 FIRMA" "select count(*) from permits where permit_no='13/GD/2026' and scope='FIRMA'" 1
sval "A7: polisa HHL PZU 1106707356" "select count(*) from insurance_policies ip
  join organizations o on o.id=ip.org_id
 where ip.policy_no='1106707356' and o.kind='FORWARDER'" 1
# UUID tylko hex (a7sg/a7kr były niepoprawne → błąd składni uuid).
sys "insert into loads (id, project_id, carrier_org_id, order_no, status, plan_load_date)
     values ('33333333-0000-0000-0000-00000000a701','$P','$SCXO','123456/2026/A7SG','PLANNED','2026-06-01')
     on conflict (id) do update set status='PLANNED', plan_load_date=excluded.plan_load_date" >/dev/null
sys "delete from shipment_items where shipment_code='SG-A7';
     insert into shipment_items (project_id, load_id, shipment_code, length_m, width_m, height_m, cargo_class)
     values ('$P','33333333-0000-0000-0000-00000000a701','SG-A7',18.21,2.45,2.45,'DIMENSIONED')" >/dev/null
sys "select set_config('tower.bulk_quiet','on',true); select a7_apply_symbol('33333333-0000-0000-0000-00000000a701','e25'); select set_config('tower.bulk_quiet','',true)" >/dev/null
sval "A7: SG → symbol SG, FIRMA, wymiary" "select symbol||'|'||permit_kind||'|'||combo_length_m::text||'|'||combo_width_m::text||'|'||escort_vehicles::text
  from loads where id='33333333-0000-0000-0000-00000000a701'" "SG|FIRMA|21.69|2.45|0"
sval "A7: SG ma load_permits firmowe" "select count(*) from load_permits lp
  join permits p on p.id=lp.permit_id
 where lp.load_id='33333333-0000-0000-0000-00000000a701' and p.scope='FIRMA'" 1
sys "insert into loads (id, project_id, carrier_org_id, order_no, status, plan_load_date)
     values ('33333333-0000-0000-0000-00000000a702','$P','$SCXO','123456/2026/A7KR','PLANNED','2026-06-01')
     on conflict (id) do update set status='PLANNED', plan_load_date=excluded.plan_load_date" >/dev/null
sys "delete from shipment_items where shipment_code='KR-A7';
     insert into shipment_items (project_id, load_id, shipment_code, length_m, width_m, height_m, cargo_class)
     values ('$P','33333333-0000-0000-0000-00000000a702','KR-A7',20.20,3.52,2.60,'DIMENSIONED')" >/dev/null
sys "select set_config('tower.bulk_quiet','on',true); select a7_apply_symbol('33333333-0000-0000-0000-00000000a702','e25'); select set_config('tower.bulk_quiet','',true)" >/dev/null
sval "A7: KR → TRASA, pilot 2" "select symbol||'|'||permit_kind||'|'||escort_vehicles::text
  from loads where id='33333333-0000-0000-0000-00000000a702'" "KR|TRASA|2"
sys "update security_flags set enabled=true where key='PERMIT_REQUIRED_NON_STANDARD'" >/dev/null
sval "A7: KR bez zezwoleń trasy → PERMIT" "select count(*) from jsonb_array_elements(awiz_missing('33333333-0000-0000-0000-00000000a702')) g where g->>'kind'='PERMIT'" 1
sys "update security_flags set enabled=false where key='PERMIT_REQUIRED_NON_STANDARD'" >/dev/null

echo; echo "WYNIK: $ok OK, $fail FAIL${bad}"
[ "$fail" -eq 0 ]
