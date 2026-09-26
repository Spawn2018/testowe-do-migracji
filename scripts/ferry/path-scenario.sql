-- M10 — kryterium: ścieżka jednego transportu port Gdańsk → PROM → plac budowy (hosted).
-- Idempotentne: transport TEST-M10 (stały fixture jak TEST-BK3-A/B) przechodzi ścieżkę raz;
-- ponowne uruchomienie niczego nie zmienia (status tylko do przodu, zdarzenia z kluczem deduplikacji).
-- Pozycje przez process_position() (telematyka / zadanie systemowe), odejście przez promote_ferry_departures().
-- Użycie: psql "$SUPABASE_DB_POOLER_URL" -v ON_ERROR_STOP=1 -f scripts/ferry/path-scenario.sql
\set QUIET on
do $$
declare
  v_project uuid; v_carrier uuid; v_vessel uuid; v_load uuid; v_sail uuid; v_t0 timestamptz;
begin
  select id into v_project from projects where code = 'STEGRA_BODEN';
  select id into v_carrier from organizations where kind = 'CARRIER' order by code limit 1;
  select id into v_vessel from vessels where name = 'M/F Wawel';
  select id into v_load from loads where order_no = 'TEST-M10';
  if v_load is null then
    insert into loads (project_id, carrier_org_id, order_no, hhl_order_no, carrier_order_no, status, plan_load_date)
    values (v_project, v_carrier, 'TEST-M10', 'HHL/TEST-M10', 'SCX/TEST-M10', 'READY', current_date)
    returning id into v_load;
  end if;
  if (select status from loads where id = v_load) <> 'READY' then
    raise notice 'TEST-M10 już przeszedł ścieżkę (status %), bez zmian', (select status from loads where id = v_load);
    return;
  end if;
  v_t0 := date_trunc('minute', now()) - interval '4 hours';
  insert into sailings (project_id, vessel_id, route, departure_at, arrival_at, status, source)
  values (v_project, v_vessel, 'GDN-NYN', v_t0 + interval '1 hour', v_t0 + interval '19 hours', 'ZAPLANOWANY', 'RECZNIE')
  on conflict (vessel_id, departure_at) do update set status = excluded.status
  returning id into v_sail;
  update loads set sailing_id = v_sail, ferry_booking_ref = 'PF-TEST-M10' where id = v_load;
  -- port Gdańsk (Westerplatte): dwa fixy → wjazd → AT_PORT_GDANSK (bez potwierdzenia załadunku — ryzyko średnie)
  perform * from process_position(v_load, 54.40372, 18.68130, v_t0, 'TELEMATICS_API');
  perform * from process_position(v_load, 54.40380, 18.68140, v_t0 + interval '5 minutes', 'TELEMATICS_API');
  -- odejście rejsu: auto było w strefie portu w chwili odejścia → FERRY
  perform promote_ferry_departures(v_t0 + interval '1 hour 1 minute');
  -- Nynäshamn (Färjeterminal): wjazd z PROM → AT_PORT_NYNASHAMN
  perform * from process_position(v_load, 58.90453, 17.95621, v_t0 + interval '3 hours', 'TELEMATICS_API');
  perform * from process_position(v_load, 58.90460, 17.95630, v_t0 + interval '3 hours 5 minutes', 'TELEMATICS_API');
  -- plac budowy Stegra Boden → AT_SITE
  perform * from process_position(v_load, 65.80539, 21.75914, v_t0 + interval '3 hours 50 minutes', 'TELEMATICS_API');
  perform * from process_position(v_load, 65.80545, 21.75920, v_t0 + interval '3 hours 55 minutes', 'TELEMATICS_API');
  raise notice 'TEST-M10: status %', (select status from loads where id = v_load);
end $$;
select l.status, (select string_agg(e.payload->>'to', '>' order by e.occurred_at) from load_events e where e.load_id = l.id and e.event_type = 'STATUS_AUTO') as auto
  from loads l where l.order_no = 'TEST-M10';
