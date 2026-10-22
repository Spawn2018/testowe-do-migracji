-- 0258 — HOTFIX #421 / D-20261022-0105-01: promy AIS + rozkład codzienny.
-- 1) ferry-schedule: cron codziennie 05:00 UTC (było: poniedziałek).
-- 2) Zamknięcie otwartych AIS_GAP (dopisek: bez ryzyka o starej pozycji).
-- 3) RPC ferry_sailings_map — rejs + porty lat/lon + ostatni AIS bez filtra świeżości (#429 A+C).
-- Edge (ten sam PR): zapis wszystkich źródeł AIS; Stena IRM bez cache 3 min;
-- rozkład po zmianie statusu; delayed_* z pozycji; integration_runs ferry-departures.

do $body$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron')
     and to_regprocedure('cron.schedule(text,text,text)') is not null
     and to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is not null
  then
    perform cron.unschedule(jobid) from cron.job where jobname = 'tower-ferry-schedule';
    perform cron.schedule('tower-ferry-schedule', '0 5 * * *', $c$
      select net.http_post(
        url     := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/ferry-schedule',
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
          'Content-Type', 'application/json'),
        body    := '{}'::jsonb
      );
    $c$);
  else
    raise notice '0258: pg_cron lub pg_net niedostępne — tower-ferry-schedule codziennie do zaplanowania ręcznie';
  end if;
end
$body$;

update risk_signals
   set resolved_at = coalesce(resolved_at, now())
 where resolved_at is null
   and (dedup_key like 'AIS_GAP:%' or title_key = 'rk_ais_gap');

-- #429 A+C: odczyt rejsów do mapy (departed_at/arrived_at, plan, porty, ostatni AIS bez filtra wieku).
create or replace function public.ferry_sailings_map()
returns table (
  sailing_id uuid,
  vessel_id uuid,
  vessel_name text,
  mmsi bigint,
  route text,
  status text,
  departure_at timestamptz,
  arrival_at timestamptz,
  departed_at timestamptz,
  arrived_at timestamptz,
  dep_port text,
  arr_port text,
  dep_lat double precision,
  dep_lon double precision,
  arr_lat double precision,
  arr_lon double precision,
  ais_lat double precision,
  ais_lon double precision,
  ais_observed_at timestamptz,
  ais_source text,
  ais_sog_kn real
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if (public.current_app_user_id() is null) then
    raise exception 'Brak aktywnego konta' using errcode = '42501';
  end if;
  return query
  with ports as (
    select * from (values
      ('GDN', 54.40372::float8, 18.68130::float8),
      ('GDY', 54.53321::float8, 18.54425::float8),
      ('NYN', 58.90453::float8, 17.95621::float8),
      ('KAA', 56.16460::float8, 15.63080::float8)
    ) as t(code, lat, lon)
  ),
  base as (
    select
      s.id as sailing_id,
      s.vessel_id,
      ves.name as vessel_name,
      ves.mmsi,
      s.route,
      s.status::text as status,
      s.departure_at,
      s.arrival_at,
      s.delayed_departure_at as departed_at,
      s.delayed_arrival_at as arrived_at,
      case
        when s.route = 'GDY-KAA' then 'GDY'
        when s.route = 'KAA-GDY' then 'KAA'
        when s.route = 'NYN-GDN' then 'NYN'
        else 'GDN'
      end as dep_port,
      case
        when s.route = 'GDY-KAA' then 'KAA'
        when s.route = 'KAA-GDY' then 'GDY'
        when s.route = 'NYN-GDN' then 'GDN'
        else 'NYN'
      end as arr_port
    from sailings s
    join vessels ves on ves.id = s.vessel_id
    where s.status is distinct from 'ODWOLANY'
      and coalesce(s.delayed_departure_at, s.departure_at) <= now() + interval '6 hours'
      and coalesce(s.delayed_arrival_at, s.arrival_at) >= now() - interval '6 hours'
  ),
  latest_ais as (
    select distinct on (vp.vessel_id)
      vp.vessel_id,
      vp.lat,
      vp.lon,
      vp.observed_at,
      vp.source::text as source,
      vp.sog_kn
    from vessel_positions vp
    where vp.vessel_id in (select b.vessel_id from base b)
    order by vp.vessel_id, vp.observed_at desc, vp.id desc
  )
  select
    b.sailing_id,
    b.vessel_id,
    b.vessel_name,
    b.mmsi,
    b.route,
    b.status,
    b.departure_at,
    b.arrival_at,
    b.departed_at,
    b.arrived_at,
    b.dep_port,
    b.arr_port,
    pd.lat,
    pd.lon,
    pa.lat,
    pa.lon,
    la.lat,
    la.lon,
    la.observed_at,
    la.source,
    la.sog_kn
  from base b
  join ports pd on pd.code = b.dep_port
  join ports pa on pa.code = b.arr_port
  left join latest_ais la on la.vessel_id = b.vessel_id
  order by coalesce(b.departed_at, b.departure_at);
end
$$;

revoke all on function public.ferry_sailings_map() from public, anon;
grant execute on function public.ferry_sailings_map() to authenticated;

comment on function public.ferry_sailings_map() is
  '#421/#429: rejsy do mapy — departed_at/arrived_at (= delayed_*), plan, porty lat/lon, ostatni AIS bez filtra świeżości (szacowana pozycja = front).';
