-- I-8 — wolumen projektu na LOKALNYM Supabase (nigdy produkcja): 300 transportów „PERF/…” (−120…+60 dni),
-- 20 w trasie + 75 rozładowanych w ostatnich 30 dniach z pełnym śladem GPS wg PR5 (1 424 punkty = 4 doby × 356),
-- razem ≈ 135 000 pozycji = stan ustalony z prognozy PR5 (LIMITY_PLANU_DARMOWEGO.md). Usuwanie: scripts/i8/clean.sql.
set session_replication_role = replica;
with p as (select id from projects where code = 'STEGRA_BODEN'), c as (select id from organizations where code = 'SCX'),
g as (select g, current_date - 120 + (g * 180 / 300) as d from generate_series(1, 300) g)
insert into loads (project_id, carrier_org_id, order_no, status, plan_load_date, plan_delivery_date, actual_delivery_at,
                   tractor_plate, trailer_plate, driver_name, driver_phone, combo_weight_t)
select p.id, c.id, 'PERF/' || lpad(g::text, 3, '0'),
  (case when g <= 205 then 'UNLOADED' when g <= 225 then (array['IN_TRANSIT_PL','AT_PORT_GDANSK','FERRY','IN_TRANSIT_SE'])[1 + g % 4] else 'PLANNED' end)::load_status,
  d, d + 3,
  case when g <= 205 then (d + 3 + time '10:00') at time zone 'Europe/Stockholm' end,
  'GD ' || (1000 + g), 'GD ' || (5000 + g), 'Kierowca ' || g, '+4860000' || lpad(g::text, 4, '0'), 20 + g % 40
from g, p, c;

-- ślad GPS: 20 w trasie + 75 ostatnich rozładowanych; 1 424 punkty co ~4 min (średnio 356/dobę), trasa Śrem → Boden
insert into positions (load_id, ts, geom_raw, speed_kmh, heading_deg, ignition, source, raw)
select l.id, coalesce(l.actual_delivery_at, now()) - interval '4 days' + k * interval '4 minutes 3 seconds',
       st_setsrid(st_makepoint(17.0 + k * 0.0035, 52.1 + k * 0.0098), 4326), 72, 10, true, 'DRIVER_PWA', '{"via":"perf"}'
from (select id, actual_delivery_at from loads where order_no like 'PERF/%' and
        (status in ('IN_TRANSIT_PL','AT_PORT_GDANSK','FERRY','IN_TRANSIT_SE')
         or (status = 'UNLOADED' and actual_delivery_at > now() - interval '30 days'))
      order by order_no desc limit 95) l,
     generate_series(1, 1424) k;
set session_replication_role = origin;
analyze loads; analyze positions;
