#!/usr/bin/env bash
# L-1 — zdarzenie otwiera decyzję, drugie wykrycie nie dubluje, brak danych nie otwiera.
. "$(git rev-parse --show-toplevel)/tests/db/refuse-prod.sh"
PSQL="psql ${PGURL:-postgres://postgres@localhost:5433/tower} -v ON_ERROR_STOP=1 -Atq"
P=22222222-0000-0000-0000-000000000001
L=33333333-0000-0000-0000-00000000da01
LA=33333333-0000-0000-0000-00000000da02
LB=33333333-0000-0000-0000-00000000da03
ok=0; fail=0
val() {
  out=$($PSQL -c "$2" | tail -1 | tr -d '\r')
  if [ "$out" = "$3" ]; then ok=$((ok+1)); echo "  OK    $1"; else fail=$((fail+1)); echo "  FAIL  $1 (otrzymano: $out, oczekiwano: $3)"; fi
}
risk() {
  # $1 kind  $2 title_key  $3 dedup  $4 load
  $PSQL -c "insert into risk_signals (project_id, load_id, kind, severity, title, title_key, detail, dedup_key)
    values ('$P', '$4', '$1', 'HIGH', 'dec-auto $1', '$2', '{\"source\":\"dec-auto\"}'::jsonb, '$3')
    on conflict (dedup_key) where dedup_key is not null and resolved_at is null do nothing" >/dev/null
}
echo; echo "[dec-auto] otwarcie i brak duplikatu"
$PSQL -c "insert into loads (id, project_id, order_no, status) values
  ('$L','$P','DEC-AUTO','PLANNED'),
  ('$LA','$P','DEC-AUTO-A','PLANNED'),
  ('$LB','$P','DEC-AUTO-B','PLANNED')
  on conflict (id) do nothing" >/dev/null
$PSQL -c "set session_replication_role=replica; update loads set status='READY' where id='$LA'; set session_replication_role=origin;" >/dev/null

risk DOC_MISSING rk_res_docs decauto:doc "$L"
val "DOC_MISSING → decyzja" "select count(*) from decisions where detail->>'event_key' = 'decauto:doc'" 1
risk DOC_MISSING rk_res_docs decauto:doc "$L"
val "DOC_MISSING drugie wykrycie → jedna" "select count(*) from decisions where detail->>'event_key' = 'decauto:doc'" 1

risk INSURANCE rk_generic decauto:ins "$L"
val "INSURANCE → decyzja" "select count(*) from decisions where detail->>'event_key' = 'decauto:ins'" 1
risk INSURANCE rk_generic decauto:ins "$L"
val "INSURANCE drugie wykrycie → jedna" "select count(*) from decisions where detail->>'event_key' = 'decauto:ins'" 1

risk ETA_BREACH rk_eta_breach decauto:eta "$LA"
val "ETA przy awizacji (READY) → decyzja" "select count(*) from decisions where detail->>'event_key' = 'decauto:eta'" 1
risk ETA_BREACH rk_eta_breach decauto:eta "$LA"
val "ETA drugie wykrycie → jedna" "select count(*) from decisions where detail->>'event_key' = 'decauto:eta'" 1

risk ETA_BREACH rk_eta_breach decauto:eta-bare "$LB"
val "ETA bez pozycji i bez awizacji → bez decyzji" "select count(*) from decisions where detail->>'event_key' = 'decauto:eta-bare'" 0

risk LATE_DATE_CHANGE rk_late_date_change decauto:date "$L"
val "LATE_DATE_CHANGE → decyzja" "select count(*) from decisions where detail->>'event_key' = 'decauto:date'" 1
risk LATE_DATE_CHANGE rk_late_date_change decauto:date "$L"
val "data drugie wykrycie → jedna" "select count(*) from decisions where detail->>'event_key' = 'decauto:date'" 1

risk SILENT_VEHICLE rk_silent_vehicle decauto:silent "$L"
val "SILENT_VEHICLE → decyzja" "select count(*) from decisions where detail->>'event_key' = 'decauto:silent'" 1
risk SILENT_VEHICLE rk_silent_vehicle decauto:silent "$L"
val "cisza drugie wykrycie → jedna" "select count(*) from decisions where detail->>'event_key' = 'decauto:silent'" 1

risk INVOICE_MISMATCH rk_generic decauto:inv "$L"
val "INVOICE_MISMATCH → decyzja" "select count(*) from decisions where detail->>'event_key' = 'decauto:inv'" 1
risk INVOICE_MISMATCH rk_generic decauto:inv "$L"
val "faktura drugie wykrycie → jedna" "select count(*) from decisions where detail->>'event_key' = 'decauto:inv'" 1

risk WEATHER rk_generic decauto:wx "$L"
val "WEATHER → decyzja rejsu" "select count(*) from decisions where detail->>'event_key' = 'decauto:wx'" 1
risk WEATHER rk_generic decauto:wx "$L"
val "pogoda drugie wykrycie → jedna" "select count(*) from decisions where detail->>'event_key' = 'decauto:wx'" 1

risk FERRY rk_generic decauto:ferry-plain "$L"
val "FERRY bez odwołania rejsu → bez decyzji" "select count(*) from decisions where detail->>'event_key' = 'decauto:ferry-plain'" 0

risk ROAD_PL rk_off_corridor decauto:off "$L"
val "zjazd z trasy → decyzja" "select count(*) from decisions where detail->>'event_key' = 'decauto:off'" 1
risk ROAD_PL rk_off_corridor decauto:off "$L"
val "zjazd drugie wykrycie → jedna" "select count(*) from decisions where detail->>'event_key' = 'decauto:off'" 1

risk ROAD_PL rk_generic decauto:road-plain "$L"
val "droga bez zjazdu → bez decyzji" "select count(*) from decisions where detail->>'event_key' = 'decauto:road-plain'" 0

risk SEQUENCE rk_generic decauto:seq "$L"
val "SEQUENCE (grupa C) → bez decyzji" "select count(*) from decisions where detail->>'event_key' = 'decauto:seq'" 0

risk JOB_FAILURE rk_generic decauto:job "$L"
val "JOB_FAILURE poza kopią → bez decyzji" "select count(*) from decisions where detail->>'event_key' = 'decauto:job'" 0

echo; echo "[dec-auto] kopia"
BID=$($PSQL -c "insert into backup_runs (status) values ('RUNNING') returning id")
$PSQL -c "update backup_runs set status='ERROR', error='dec-auto' where id=$BID" >/dev/null
val "kopia ERROR → decyzja" "select count(*) from decisions where detail->>'event_key' = 'backup-run:$BID'" 1
$PSQL -c "update backup_runs set status='OK' where id=$BID" >/dev/null
$PSQL -c "update backup_runs set status='ERROR', error='dec-auto drugi' where id=$BID" >/dev/null
val "kopia drugi ERROR → jedna decyzja" "select count(*) from decisions where detail->>'event_key' = 'backup-run:$BID'" 1

val "poza aplikacją decyzja idzie tylko e-mailem" "select count(*) from notifications where template='DECISION_OPEN' and channel not in ('IN_APP','EMAIL')" 0

echo; echo "[dec-auto] L-3 moment progu zależy od Opcji"
ANCHOR="2026-12-10 12:00:00+01"
val "awizacja 48 h" "select l3_moment(timestamptz '$ANCHOR', 'AWIZ_EARLY_H') = timestamptz '$ANCHOR' - interval '48 hours'" t
$PSQL -c "update ops_thresholds set value_num = 36 where key = 'AWIZ_EARLY_H'" >/dev/null
val "zmiana AWIZ_EARLY_H przesuwa moment" "select l3_moment(timestamptz '$ANCHOR', 'AWIZ_EARLY_H') = timestamptz '$ANCHOR' - interval '36 hours'" t
$PSQL -c "update ops_thresholds set value_num = 48 where key = 'AWIZ_EARLY_H'" >/dev/null
val "brak daty = brak momentu" "select l3_moment(null, 'AWIZ_EARLY_H') is null" t
val "ETA bez danych = bez alarmu" "select l3_eta_alarm(now(), now() - interval '2 hours', false)" f
val "ETA po progu 30 min" "select l3_eta_alarm(timestamptz '2026-12-10 15:00+01', timestamptz '2026-12-10 14:00+01', true)" t
$PSQL -c "update ops_thresholds set value_num = 120 where key = 'DELAY_MIN'" >/dev/null
val "większy próg ETA gasi alarm" "select l3_eta_alarm(timestamptz '2026-12-10 15:00+01', timestamptz '2026-12-10 14:00+01', true)" f
$PSQL -c "update ops_thresholds set value_num = 30 where key = 'DELAY_MIN'" >/dev/null
val "KSH mniej niż 5 dni" "select l3_lead_alarm(now() + interval '4 days', now())" t
$PSQL -c "update ops_thresholds set value_num = 3 where key = 'LEAD_DAYS'" >/dev/null
val "krótsze wyprzedzenie KSH gasi alarm" "select l3_lead_alarm(now() + interval '4 days', now())" f
$PSQL -c "update ops_thresholds set value_num = 5 where key = 'LEAD_DAYS'" >/dev/null
# #384 pkt 2: miniona / ≥5 dni — bez alarmu
val "KSH miniona data → bez alarmu" "select l3_lead_alarm(now() - interval '1 day', now())" f
val "KSH za 10 dni → bez alarmu" "select l3_lead_alarm(now() + interval '10 days', now())" f
val "cisza GPS tylko przy źródle i ruchu" "select l3_silent_alarm(now() - interval '30 minutes', now(), false, true)" f
# B7 / E15: SILENT_MIN = 30; alarm gdy cisza > progu
val "cisza 45 min przy progu 30" "select l3_silent_alarm(now() - interval '45 minutes', now(), true, true)" t
$PSQL -c "update ops_thresholds set value_num = 60 where key = 'SILENT_MIN'" >/dev/null
val "dłuższy próg ciszy gasi alarm" "select l3_silent_alarm(now() - interval '45 minutes', now(), true, true)" f
$PSQL -c "update ops_thresholds set value_num = 30 where key = 'SILENT_MIN'" >/dev/null
val "zjazd: jedna pozycja nie alarmuje" "select l3_deviation_alarm(5000, 1, 20, false)" f
val "zjazd: dwie pozycje, 10 min, ponad 2 km" "select l3_deviation_alarm(5000, 2, 10, false)" t
$PSQL -c "update ops_thresholds set value_num = 9 where key = 'OFFROUTE_KM'" >/dev/null
val "większy próg zjazdu gasi alarm" "select l3_deviation_alarm(5000, 2, 10, false)" f
$PSQL -c "update ops_thresholds set value_num = 2 where key = 'OFFROUTE_KM'" >/dev/null
val "prom i port bez zjazdu" "select l3_deviation_alarm(5000, 2, 10, true)" f
$PSQL -c "insert into loads (id, project_id, order_no, status, plan_load_date) values
  ('33333333-0000-0000-0000-00000000d930','$P','123456/2026/KSH','PLANNED','2026-10-21')
  on conflict (id) do update set order_no=excluded.order_no, status='PLANNED', plan_load_date=excluded.plan_load_date" >/dev/null
$PSQL -c "insert into shipment_items (project_id, load_id, shipment_code, length_m, width_m, height_m)
  select '$P','33333333-0000-0000-0000-00000000d930','SG-D930',1,1,1
   where not exists (select 1 from shipment_items where project_id='$P' and shipment_code='SG-D930')" >/dev/null
val "l3_scan: params.code to kod transportu" "select l3_scan(timestamptz '2026-10-20 12:00+00'); select detail#>>'{params,code}' from risk_signals where dedup_key='l3:NO_AWIZACJA:33333333-0000-0000-0000-00000000d930' and resolved_at is null" "SG-D930"
$PSQL -c "update risk_signals set detail = jsonb_set(detail, '{params,code}', '\"SG-D930\"') where dedup_key='l3:NO_AWIZACJA:33333333-0000-0000-0000-00000000d930'" >/dev/null
val "l3_upsert_alarm nie nadpisuje kodu identyfikatorem" "update risk_signals set severity='HIGH', detail = jsonb_set(jsonb_set(coalesce(detail,'{}'::jsonb), '{params,code}', '\"SG-D930\"'), '{l3_level}', '\"warning\"') where dedup_key='l3:NO_AWIZACJA:33333333-0000-0000-0000-00000000d930'; select l3_upsert_alarm((select project_id from loads where id='33333333-0000-0000-0000-00000000d930'), '33333333-0000-0000-0000-00000000d930', 'RESOURCE_MISSING', 'l3:NO_AWIZACJA:33333333-0000-0000-0000-00000000d930', '33333333: zly', 'rk_res_driver', true, true, now(), jsonb_build_object('params', jsonb_build_object('code', left('33333333-0000-0000-0000-00000000d930'::text, 8))), now()); select detail#>>'{params,code}' from risk_signals where dedup_key='l3:NO_AWIZACJA:33333333-0000-0000-0000-00000000d930' and resolved_at is null" "SG-D930"


echo; echo "[dec-auto] L-1b"
val "zniknięcie bez kodu → bez decyzji" "select (l1b_note_row_gone('$P','$L','') is null)" t
val "zniknięcie wiersza → decyzja" "select (l1b_note_row_gone('$P','$L','SG-GONE') is not null)" t
$PSQL -c "select l1b_note_row_gone('$P','$L','SG-GONE')" >/dev/null
val "zniknięcie drugie → jedna" "select count(*) from decisions where detail->>'event_key'='l1b:row-gone:$P:SG-GONE'" 1
val "import woła zniknięcie wiersza" "select (position('l1b_note_row_gone' in pg_get_functiondef('import_schedule(uuid,jsonb,text[],jsonb,boolean,boolean)'::regprocedure)) > 0)" t

val "konflikt bez numeru HHL → bez decyzji" "select (l1b_note_conflict('$P','$L','SG-C','','KSH/2') is null)" t
val "konflikt numeru HHL → decyzja" "select (l1b_note_conflict('$P','$L','SG-C','HHL/1','KSH/2') is not null)" t
$PSQL -c "select l1b_note_conflict('$P','$L','SG-C','HHL/1','KSH/2')" >/dev/null
val "konflikt drugie → jedna" "select count(*) from decisions where detail->>'event_key'='l1b:conflict:$P:SG-C:hhl_order_no'" 1
val "ten sam numer → bez decyzji" "select (l1b_note_conflict('$P','$L','SG-C2','HHL/1','HHL/1') is null)" t
# #384 pkt 3: pusta wartość w pliku ≠ konflikt
val "konflikt puste file → bez decyzji" "select (l1b_note_conflict('$P','$L','SG-C3','HHL/9','') is null)" t
val "konflikt file null → bez decyzji" "select (l1b_note_conflict('$P','$L','SG-C4','HHL/9',null) is null)" t
# #611: hhl_order_no poza importem — konflikt plik↔WT tylko przez l1b_note_file_changed (daty).
val "import woła konflikt" "select (position('l1b_note_file_changed' in pg_get_functiondef('import_schedule(uuid,jsonb,text[],jsonb,boolean,boolean)'::regprocedure)) > 0)" t
val "import sprawdza column_map hhlOrderNo" "select (position('hhlOrderNo' in pg_get_functiondef('import_schedule(uuid,jsonb,text[],jsonb,boolean,boolean)'::regprocedure)) > 0)" t

val "plik nieczytelny → decyzja" "select (l1b_ksh_file_unreadable('$P','zly.xlsx') is not null)" t
$PSQL -c "select l1b_ksh_file_unreadable('$P','zly.xlsx')" >/dev/null
val "plik drugi → jedna" "select count(*) from decisions where detail->>'event_key'='l1b:file:$P:zly.xlsx'" 1

val "SEFS bez daty → bez decyzji" "select (l1b_sefs_note('$P', null) is null)" t
val "SEFS przyszły tydzień → bez decyzji" "select l1b_sefs_note('$P','2026-11-16')" SOURCE
val "SEFS przyszły tydzień nie otwiera" "select count(*) from decisions where detail->>'event_key' like 'l1b:sefs:$P:%:SOURCE'" 0
val "SEFS zamknięty tydzień bez cen → decyzja" "select l1b_sefs_note('$P','2020-06-15')" SOURCE
val "SEFS tytuł bez skrótu" "select (title like 'Opłata paliwowa:%' and title not like '%SEFS%') from decisions where detail->>'event_key' like 'l1b:sefs:$P:2020-06-08:SOURCE'" t
$PSQL -c "select l1b_sefs_note('$P','2020-06-15')" >/dev/null
val "SEFS zamknięty tydzień drugi raz → jedna" "select count(*) from decisions where detail->>'event_key' like 'l1b:sefs:$P:2020-06-08:SOURCE'" 1
# B-N3 / D-0930: wygaszenie woła sefs_source_expire_once (kod migracji 0230), nie ręczny UPDATE.
$PSQL -c "update decisions set detail = coalesce(detail,'{}'::jsonb) || jsonb_build_object('prev_week_start', (timezone('Europe/Warsaw', now()))::date::text) where detail->>'event_key' = 'l1b:sefs:$P:2020-06-08:SOURCE'" >/dev/null
$PSQL -c "select sefs_source_expire_once()" >/dev/null
val "SEFS po wygaszeniu → nowa sprawa" "select l1b_sefs_note('$P','2020-06-15')" SOURCE
val "SEFS po wygaszeniu świeży klucz" "select count(*) from decisions where detail->>'event_key' = 'l1b:sefs:$P:2020-06-08:SOURCE' and status in ('NEW','ASSIGNED','SNOOZED')" 1
val "SEFS wygaszony klucz zostaje" "select count(*) from decisions where detail->>'event_key' = 'l1b:sefs:$P:2020-06-08:SOURCE:expired-0230' and status = 'EXPIRED'" 1
$PSQL -c "insert into sefs_parameters (project_id, version, valid_from, base_sek, base_pln, index_sek, index_pln, source_url_sek, source_url_pln, cycle, tiers_sek, tiers_pln)
  select '$P', 91, '2026-01-01', 1, 1, 'OKQ8', 'ORLEN', 'https://example.com/sek', 'https://example.com/pln', 'WEEKLY',
          '[{\"lte\":100,\"mult\":1}]'::jsonb, '[{\"lte\":100,\"mult\":1}]'::jsonb
   where not exists (select 1 from sefs_parameters where project_id='$P' and version=91)" >/dev/null
# 0189: l1b woła sefs_week_calc bez p_today → OSTATECZNY tylko gdy prev tydzień zamknięty względem «dziś».
# Odczyty w zamkniętym prev tygodniu bieżącego tygodnia ISO (pn–nd przed bieżącym poniedziałkiem).
$PSQL -c "insert into fuel_index_readings (project_id, index_code, period, reading_date, value, source_url, published_on)
  select v.project_id, v.index_code, v.period, v.reading_date, v.value, v.source_url, v.reading_date
    from (values
      ('$P'::uuid,'SEK', to_char((date_trunc('week', (timezone('Europe/Warsaw', now()))::date) - interval '7 days')::date,'YYYY-MM-DD'),
             (date_trunc('week', (timezone('Europe/Warsaw', now()))::date) - interval '7 days')::date, 10::numeric, 'https://example.com/sek'),
      ('$P'::uuid,'PLN', to_char((date_trunc('week', (timezone('Europe/Warsaw', now()))::date) - interval '7 days')::date,'YYYY-MM-DD'),
             (date_trunc('week', (timezone('Europe/Warsaw', now()))::date) - interval '7 days')::date, 10::numeric, 'https://example.com/pln')
    ) as v(project_id, index_code, period, reading_date, value, source_url)
   where not exists (
     select 1 from fuel_index_readings r
      where r.project_id=v.project_id and r.index_code=v.index_code and r.period=v.period and r.corrects_id is null
   )" >/dev/null
# załadunek w bieżącym tygodniu → prev zamknięty → OSTATECZNY z odczytów powyżej
$PSQL -c "select set_config('decauto.sefs_load', (date_trunc('week', (timezone('Europe/Warsaw', now()))::date))::date::text, false)" >/dev/null
val "SEFS w tabeli → bez decyzji" "select l1b_sefs_note('$P', (date_trunc('week', (timezone('Europe/Warsaw', now()))::date))::date)" OK
val "SEFS w tabeli nie otwiera" "select count(*) from decisions where detail->>'event_key' like 'l1b:sefs:$P:' || (date_trunc('week', (timezone('Europe/Warsaw', now()))::date) - interval '7 days')::date::text || ':%'" 0
val "SOURCE z cenami → powód zamknięcia" "select sefs_source_expire_reason('$P'::uuid, jsonb_build_object('load_date', (date_trunc('week', (timezone('Europe/Warsaw', now()))::date))::date::text, 'prev_week_start', '2020-01-06'))" "nie dotyczy — ceny tygodnia są już w bazie"
val "SOURCE otwarty tydzień → powód" "select sefs_source_expire_reason('$P'::uuid, jsonb_build_object('prev_week_start', (timezone('Europe/Warsaw', now()))::date::text))" "nie dotyczy — tydzień wskaźników jeszcze trwa"
# ponad tabelę: korekta append-only (0166) — value 150 poza tabelą lte:100
$PSQL -c "insert into fuel_index_readings (project_id, index_code, period, reading_date, value, source_url, published_on, corrects_id, correction_reason)
  select r.project_id, r.index_code, r.period, r.reading_date, 150, r.source_url, r.published_on, r.id, 'dec-auto OVER'
    from fuel_index_readings r
   where r.project_id='$P' and r.corrects_id is null and r.source_url like 'https://example.com/%'
     and r.period = to_char((date_trunc('week', (timezone('Europe/Warsaw', now()))::date) - interval '7 days')::date,'YYYY-MM-DD')" >/dev/null
val "SEFS ponad tabelę → decyzja" "select l1b_sefs_note('$P', (date_trunc('week', (timezone('Europe/Warsaw', now()))::date))::date)" OVER
$PSQL -c "select l1b_sefs_note('$P', (date_trunc('week', (timezone('Europe/Warsaw', now()))::date))::date)" >/dev/null
val "SEFS ponad tabelę drugie → jedna" "select count(*) from decisions where detail->>'event_key'='l1b:sefs:$P:' || (date_trunc('week', (timezone('Europe/Warsaw', now()))::date) - interval '7 days')::date::text || ':OVER'" 1

val "KR bez dnia → bez decyzji" "select (l1b_kr_check('$P', null) is null)" t
$PSQL -c "insert into loads (id, project_id, order_no, status, plan_load_date) values
  ('33333333-0000-0000-0000-0000000000a1','$P','KR-1','PLANNED','2026-12-01'),
  ('33333333-0000-0000-0000-0000000000a2','$P','KR-2','PLANNED','2026-12-01'),
  ('33333333-0000-0000-0000-0000000000a3','$P','KR-3','PLANNED','2026-12-01')
  on conflict (id) do nothing" >/dev/null
$PSQL -c "insert into shipment_items (project_id, load_id, shipment_code, length_m, width_m, height_m)
  select v.project_id, v.load_id, v.shipment_code, 1, 1, 1
    from (values
      ('$P'::uuid,'33333333-0000-0000-0000-0000000000a1'::uuid,'KR-01'),
      ('$P'::uuid,'33333333-0000-0000-0000-0000000000a2'::uuid,'KR-02'),
      ('$P'::uuid,'33333333-0000-0000-0000-0000000000a3'::uuid,'KR-03')
    ) as v(project_id, load_id, shipment_code)
   where not exists (select 1 from shipment_items si where si.project_id=v.project_id and si.shipment_code=v.shipment_code)" >/dev/null
val "3 ładunki KR → bez decyzji" "select l1b_kr_check('$P','2026-12-01')" 3
val "3 KR nie otwiera" "select count(*) from decisions where detail->>'event_key'='l1b:kr:$P:2026-12-01'" 0
$PSQL -c "insert into loads (id, project_id, order_no, status, plan_load_date) values
  ('33333333-0000-0000-0000-0000000000a4','$P','KR-4','PLANNED','2026-12-01')
  on conflict (id) do nothing" >/dev/null
$PSQL -c "insert into shipment_items (project_id, load_id, shipment_code, length_m, width_m, height_m)
  select '$P','33333333-0000-0000-0000-0000000000a4','KR-04',1,1,1
   where not exists (select 1 from shipment_items where project_id='$P' and shipment_code='KR-04')" >/dev/null
val "4 ładunki KR → decyzja" "select l1b_kr_check('$P','2026-12-01')" 4
$PSQL -c "select l1b_kr_check('$P','2026-12-01')" >/dev/null
val "KR drugie → jedna" "select count(*) from decisions where detail->>'event_key'='l1b:kr:$P:2026-12-01'" 1
val "import woła próg KR" "select (position('l1b_kr_check' in pg_get_functiondef('import_schedule(uuid,jsonb,text[],jsonb,boolean,boolean)'::regprocedure)) > 0)" t
val "postój nie ma funkcji z sztywnym progiem" "select count(*) from pg_proc where proname='l1b_dwell_check'" 0

echo; echo "[dec-auto] D-0930 kod transportu w powiadomieniu SCX"
$PSQL -c "insert into loads (id, project_id, carrier_org_id, order_no, status, plan_load_date, plan_delivery_date)
  values ('33333333-0000-0000-0000-00000000d930','$P','00000000-0000-0000-0000-00000000a003','KSHLEAK9301','PLANNED','2026-12-02','2026-12-06')
  on conflict (id) do update set order_no=excluded.order_no, status='PLANNED', carrier_org_id=excluded.carrier_org_id,
    plan_load_date=excluded.plan_load_date, plan_delivery_date=excluded.plan_delivery_date" >/dev/null
$PSQL -c "insert into shipment_items (project_id, load_id, shipment_code, length_m, width_m, height_m)
  select '$P','33333333-0000-0000-0000-00000000d930','SG-D930',1,1,1
   where not exists (select 1 from shipment_items where project_id='$P' and shipment_code='SG-D930')" >/dev/null
$PSQL -c "begin; set local role authenticated; set local request.jwt.claim.sub='11111111-0000-0000-0000-000000000002'; select ksh_confirm_dates('33333333-0000-0000-0000-00000000d930','2026-12-03','2026-12-07'); commit;" >/dev/null
val "SCX dostał kod SG-D930" "select (count(*)>=1) from notifications n join app_users u on u.id=n.user_id join organizations o on o.id=u.org_id where n.load_id='33333333-0000-0000-0000-00000000d930' and o.kind='CARRIER' and position('SG-D930' in n.payload::text)>0" t
val "SCX po ksh_confirm bez numeru KSH" "select count(*) from notifications n join app_users u on u.id=n.user_id join organizations o on o.id=u.org_id where n.load_id='33333333-0000-0000-0000-00000000d930' and o.kind='CARRIER' and position('KSHLEAK9301' in n.payload::text)>0" 0

echo; echo "[dec-auto] D-0040 numer KSH poza e-mailem SCX"
$PSQL -c "insert into loads (id, project_id, carrier_org_id, order_no, status)
  values ('33333333-0000-0000-0000-00000000d940','$P','00000000-0000-0000-0000-00000000a003','KSHLEAK0040','PLANNED')
  on conflict (id) do update set order_no=excluded.order_no, carrier_org_id=excluded.carrier_org_id, status='PLANNED'" >/dev/null
$PSQL -c "insert into shipment_items (project_id, load_id, shipment_code, length_m, width_m, height_m)
  select '$P','33333333-0000-0000-0000-00000000d940','SG-D040',1,1,1
   where not exists (select 1 from shipment_items where project_id='$P' and shipment_code='SG-D040')" >/dev/null
$PSQL -c "update notification_matrix set email=true where event_key='dec_new' and role='CARRIER_DISPATCH'" >/dev/null
$PSQL -c "select public.decision_open_from_event('$P','FERRY_CANCELLED','d040-ferry','Prom odwolany','{\"bundle_key\":\"d040-ferry\"}'::jsonb,'33333333-0000-0000-0000-00000000d940',null)" >/dev/null
val "FERRY_CANCELLED do SCX: kod, nie numer KSH" "select coalesce((
  select bool_and(
    e->>'order_no' = 'SG-D040'
    and e->>'order_no' is distinct from 'KSHLEAK0040'
    and e->>'order_no' is distinct from left(l.id::text, 8)
  )::text
  from notifications n
  join app_users u on u.id = n.user_id
  join organizations o on o.id = u.org_id
  join loads l on l.id = n.load_id
  cross join lateral jsonb_array_elements(coalesce(n.payload->'transports', '[]'::jsonb)) e
  where n.channel = 'EMAIL' and n.template = 'DECISION_OPEN' and o.kind = 'CARRIER'
    and n.load_id = '33333333-0000-0000-0000-00000000d940'
), 'false')" true
$PSQL -c "insert into workflows (project_id, code, name, trigger_type, condition, actions, enabled)
  select '$P', 'D040-MAIL', 'D040 mail SCX', 'DELAY_DETECTED', 'true'::jsonb,
         '[{\"type\":\"email\",\"audience\":\"CARRIER\",\"critical\":true}]'::jsonb, true
   where not exists (select 1 from workflows where project_id='$P' and code='D040-MAIL')" >/dev/null
$PSQL -c "insert into workflow_runs (workflow_id, load_id, status, dedup_key)
  select w.id, '33333333-0000-0000-0000-00000000d940', 'QUEUED', 'wf:d040:email'
    from workflows w where w.project_id='$P' and w.code='D040-MAIL'
  on conflict (dedup_key) where dedup_key is not null do nothing" >/dev/null
$PSQL -c "select public.wf_action(w, r, '{\"type\":\"email\",\"audience\":\"CARRIER\",\"critical\":true,\"text\":\"t\"}'::jsonb,
            jsonb_build_object('event_type','MANUAL','load', public.wf_load_context(r.load_id)))
          from workflows w
          join workflow_runs r on r.workflow_id = w.id
         where w.code='D040-MAIL' and r.dedup_key='wf:d040:email'" >/dev/null
val "workflow e-mail SCX bez numeru KSH i bez hex" "select coalesce((
  select bool_and(
    n.payload->>'code' = 'SG-D040'
    and e->>'order_no' = 'SG-D040'
    and position('KSHLEAK0040' in n.payload::text) = 0
    and n.payload->>'code' is distinct from left(l.id::text, 8)
  )::text
  from notifications n
  join app_users u on u.id = n.user_id
  join organizations o on o.id = u.org_id
  join loads l on l.id = n.load_id
  cross join lateral jsonb_array_elements(coalesce(n.payload->'transports', '[]'::jsonb)) e
  where n.channel = 'EMAIL' and n.template = 'WORKFLOW_ALERT' and o.kind = 'CARRIER'
    and n.load_id = '33333333-0000-0000-0000-00000000d940'
), 'false')" true

echo; echo "WYNIK: $ok OK, $fail FAIL"
[ "$fail" -eq 0 ]
