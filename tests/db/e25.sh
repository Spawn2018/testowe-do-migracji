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
# A5 ręcznie: CMR sprzed dostawy (C17 auto nie rusza) → STATUS_READY_TO_INVOICE
sys "delete from documents where load_id='$L2' and category='CMR' and storage_path like 'test/e25-cmr%'" >/dev/null
sys "insert into documents (project_id, load_id, category, storage_path, file_name, mime_type, size_bytes, uploaded_at)
     values ('$P','$L2','CMR','test/e25-cmr-early.pdf','cmr.pdf','application/pdf',100,
             timestamptz '2026-10-06 08:00:00+00')" >/dev/null
sval "C17 wczesny CMR: nadal DELIVERED" "select status::text from loads where id='$L2'" DELIVERED
val "SCX → READY_TO_INVOICE + zdarzenie" $SCX "select load_status_set('$L2','READY_TO_INVOICE',now(),null); select status::text || '|' || (select count(*)::text from load_events where load_id='$L2' and event_type='STATUS_READY_TO_INVOICE') from loads where id='$L2'" "READY_TO_INVOICE|1" commit
# C17: CMR po dostawie na świeżym DELIVERED → STATUS_AUTO (cofnięcie ręczne + supersede wczesnego)
val "HHL cofa do DELIVERED (A5)" $HHL "select load_status_set('$L2','DELIVERED',timestamptz '2026-10-07 10:19:54+00','cofka e25'); select status::text from loads where id='$L2'" DELIVERED commit
sys "update documents set superseded_at=now() where load_id='$L2' and category='CMR' and superseded_at is null" >/dev/null
sys "insert into documents (project_id, load_id, category, storage_path, file_name, mime_type, size_bytes, uploaded_at)
     values ('$P','$L2','CMR','test/e25-cmr-auto.pdf','cmr.pdf','application/pdf',100,
             timestamptz '2026-10-07 12:00:00+00')" >/dev/null
sval "C17 CMR po dostawie → READY STATUS_AUTO" "select status::text || '|' || (select count(*)::text from load_events where load_id='$L2' and event_type='STATUS_AUTO' and payload->>'to'='READY_TO_INVOICE') from loads where id='$L2'" "READY_TO_INVOICE|1"
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
sval "A9: brak telefonu SE w awiz_missing" "select exists (
  select 1 from jsonb_array_elements(awiz_missing('33333333-0000-0000-0000-00000000a901')) g,
               jsonb_array_elements_text(g->'items') i
   where g->>'kind'='AWIZ' and i='telefon SE')" t
sval "A9: detect_resource_deadlines = 0" "select detect_resource_deadlines()" 0
# CI bez pg_cron: CASE WHEN nie chroni przed parse cron.job — jak insurance.sh / workflows.sh.
if [ "$(sys "select to_regclass('cron.job') is not null" | tail -1)" = "t" ]; then
  sval "A9: cron tower-zasoby wyłączony" "select count(*) from cron.job where jobname='tower-zasoby'" 0
else
  ok=$((ok+1)); echo "  OK    A9: cron tower-zasoby wyłączony"
fi
val "A9: HHL widzi load_ready_gaps" $HHL "select (gaps @> '[{\"kind\":\"AWIZ\"}]')::text from load_ready_gaps() where load_id='33333333-0000-0000-0000-00000000a901'" true
sval "A9: SAILING gdy brak sailing_id" "select exists (
  select 1 from jsonb_array_elements(awiz_missing('33333333-0000-0000-0000-00000000a901')) g
   where g->>'kind'='SAILING')" t
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
# F7 P8: EXPIRED — wstaw, puść zamknięcie A3 (tylko NEW/ASSIGNED/SNOOZED), status zostaje.
sys "delete from decisions where id in ('33333333-0000-0000-0000-00000000ex01','33333333-0000-0000-0000-00000000ex02')" >/dev/null
sys "insert into decisions (id, project_id, type_code, title, status, expired_reason, detail)
     values ('33333333-0000-0000-0000-00000000ex01','$P','DOC_MISSING','CMR po terminie','EXPIRED','termin minął',
             '{\"category\":\"CMR\",\"event_key\":\"e25:exp:doc\"}'::jsonb),
            ('33333333-0000-0000-0000-00000000ex02','$P','NO_AWIZACJA','brak awizacji','EXPIRED','termin minął',
             '{\"event_key\":\"e25:exp:awiz\"}'::jsonb)" >/dev/null
sys "update decisions d set status='RESOLVED', resolved_at=now(), resolution_code='A3_STALE_REQ', expired_reason=null, updated_at=now()
     where d.type_code='DOC_MISSING' and d.status in ('NEW','ASSIGNED','SNOOZED')
       and coalesce(d.detail->>'category','') in ('POD','SPEC','LASHING_PHOTO','PERMIT_SE','CMR')" >/dev/null
sval "A3: EXPIRED DOC_MISSING nietknięty (B1/P8)" "select status::text||'|'||coalesce(expired_reason,'') from decisions where id='33333333-0000-0000-0000-00000000ex01'" "EXPIRED|termin minął"
sval "A3: EXPIRED NO_AWIZACJA nietknięty (B1/P8)" "select status::text||'|'||coalesce(expired_reason,'') from decisions where id='33333333-0000-0000-0000-00000000ex02'" "EXPIRED|termin minął"
sval "A9: brak telefonu SE → dokładnie 1 pozycja AWIZ" "select jsonb_array_length(g->'items') from jsonb_array_elements(awiz_missing('33333333-0000-0000-0000-00000000a901')) g where g->>'kind'='AWIZ'" 1
# Komplet → Gotowy: uzupełnij braki a901 (telefon SE, rejs, polisa); PERMIT wyłączony w teście.
sys "insert into vessels (id, name, operator) values ('55555555-0000-0000-0000-000000000001','Nova Star','Polferries') on conflict (id) do nothing" >/dev/null
sys "insert into sailings (id, project_id, vessel_id, departure_at, arrival_at)
     values ('33333333-0000-0000-0000-00000000s901','$P','55555555-0000-0000-0000-000000000001',
             '2026-10-21 20:00:00+00','2026-10-22 08:00:00+00')
     on conflict (id) do nothing" >/dev/null
sys "insert into insurance_policies (org_id, policy_no, insurer, valid_from, valid_until, approval_status)
     select '$SCXO', 'POL-E25-A901', 'Test', '2026-01-01', '2027-12-31', 'APPROVED'
     where not exists (
       select 1 from insurance_policies where org_id='$SCXO' and approval_status='APPROVED'
         and valid_from<='2026-10-20' and valid_until>='2026-10-20')" >/dev/null
sys "update loads set driver_delivery_phone='0700111222', sailing_id='33333333-0000-0000-0000-00000000s901'
     where id='33333333-0000-0000-0000-00000000a901'" >/dev/null
sval "A9: po komplecie awiz_missing puste" "select coalesce(jsonb_array_length(awiz_missing('33333333-0000-0000-0000-00000000a901')),0)" 0
# Wyzwalacz a9_trg_loads_ready ustawia READY przy UPDATE; a9_try_ready potem = 0 zmian.
sval "A9: komplet → Gotowy sam" "select status::text from loads where id='33333333-0000-0000-0000-00000000a901'" READY
sval "A9: drugi a9_try_ready = 0 zmian" "select a9_try_ready('33333333-0000-0000-0000-00000000a901')" f
# CMR_UPLOAD widoczna dla SCX + reopen EXPIRED + idempotentność.
sys "insert into loads (id, project_id, carrier_org_id, order_no, status, plan_load_date, plan_delivery_date)
     values ('33333333-0000-0000-0000-00000000a903','$P','$SCXO','123456/2026/A903','DELIVERED','2026-10-10','2026-10-15')
     on conflict (id) do update set status='DELIVERED', carrier_org_id=excluded.carrier_org_id" >/dev/null
sys "select a3_ensure_cmr_upload('33333333-0000-0000-0000-00000000a903')" >/dev/null
val "A3: CMR_UPLOAD widoczna dla SCX" $SCX "select count(*) from decisions where load_id='33333333-0000-0000-0000-00000000a903' and type_code='CMR_UPLOAD' and status in ('NEW','ASSIGNED','SNOOZED')" 1
sys "update decisions set status='EXPIRED', expired_reason='termin minął', resolved_at=now()
     where load_id='33333333-0000-0000-0000-00000000a903' and type_code='CMR_UPLOAD'" >/dev/null
sval "A3: reopen EXPIRED CMR_UPLOAD → NEW bez expired_reason" "select (a3_ensure_cmr_upload('33333333-0000-0000-0000-00000000a903') is not null)::text||'|'||(
  select status::text||'|'||(expired_reason is null)::text from decisions
   where load_id='33333333-0000-0000-0000-00000000a903' and type_code='CMR_UPLOAD'
   order by updated_at desc limit 1)" "true|NEW|true"
sval "A3: drugi a3_ensure na otwartej = null (0 zmian)" "select a3_ensure_cmr_upload('33333333-0000-0000-0000-00000000a903') is null" t
sval "A9: brak otwartych RES:* (Do zrobienia spójne)" "select count(*) from decisions
  where status in ('NEW','ASSIGNED','SNOOZED')
    and (coalesce(detail->>'event_key','') like 'RES:%' or coalesce(detail->>'event_key','') like 'l3:RES:%')" 0

echo; echo "WYNIK: $ok OK, $fail FAIL${bad}"
[ "$fail" -eq 0 ]
