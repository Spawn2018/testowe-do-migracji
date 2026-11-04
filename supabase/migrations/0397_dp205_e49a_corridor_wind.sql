-- DP-205 E49-a cz.2 (#783): prognoza wiatru SMHI/FMI na punktach korytarza (co 25 km).
-- Cron co 1 h → Edge corridor-wind; tylko korytarze z transportem w oknie śledzenia.

begin;

create table if not exists public.corridor_wind_forecast (
  corridor     text not null,
  km           numeric(8,2) not null,
  lon          double precision not null,
  lat          double precision not null,
  bearing_deg  numeric(5,1) not null,
  source       text not null check (source in ('SMHI', 'FMI')),
  samples      jsonb not null default '[]'::jsonb,
  fetched_at   timestamptz not null default now(),
  primary key (corridor, km)
);

comment on table public.corridor_wind_forecast is
  'E49-a: prognoza porywów SMHI/FMI na punktach korytarza (co ~25 km); czyta ETA/Z2.';

alter table public.corridor_wind_forecast enable row level security;
revoke all on public.corridor_wind_forecast from public, anon, authenticated;
grant select on public.corridor_wind_forecast to authenticated;
grant select, insert, update, delete on public.corridor_wind_forecast to service_role;

drop policy if exists corridor_wind_forecast_read on public.corridor_wind_forecast;
create policy corridor_wind_forecast_read on public.corridor_wind_forecast
  for select to authenticated
  using (current_app_user_id() is not null);

-- Korytarze transportów w oknie śledzenia — osobno dla każdego transportu (E27 / #783 pkt 6, F7 #785 r1 pkt 6).
-- Odcinek PL = ferry_routes.road_corridor_pre, odcinek SE/FI = road_corridor_post trasy TEGO transportu
-- (jak rdzeń ETA 0389: load_route_family + here_road_legs; brak trasy → PL_ROAD / SE_E4).
-- AT_SITE, FERRY i statusy po rozładunku nie uruchamiają pobierania prognozy.
-- from_km = postęp auta na korytarzu (tylko odcinek bieżący, świeża pozycja ≤ 2 h), inaczej 0.
-- current_leg = transport jedzie tym odcinkiem teraz (tylko dla niego Z2 otwiera sprawy);
-- pozostałe odcinki trasy służą ETA (Z1) i pobraniu prognozy.
create or replace function public.e49_wind_load_corridors(p_now timestamptz default now())
returns table(load_id uuid, code text, leg text, from_km numeric, current_leg boolean)
language sql
stable
security definer
set search_path = public
as $$
  with base as (
    select l.id,
           l.status::text as st,
           coalesce(hpre.corridor_code, 'PL_ROAD') as pre_code,
           coalesce(hpost.corridor_code, 'SE_E4') as post_code,
           (select coalesce(p.geom_snapped, p.geom_raw)
              from positions p
             where p.load_id = l.id
               and p.ts >= p_now - interval '2 hours'
             order by p.ts desc
             limit 1) as g
      from loads l
      left join ferry_routes fr
        on fr.active and fr.code = upper(btrim(public.load_route_family(l.id)))
      left join here_road_legs hpre on hpre.leg = fr.road_corridor_pre
      left join here_road_legs hpost on hpost.leg = fr.road_corridor_post
     where l.status::text in (
             'READY', 'AT_LOADING', 'IN_TRANSIT_PL', 'AT_PORT_GDANSK',
             'AT_PORT_NYNASHAMN', 'IN_TRANSIT_SE'
           )
       and public.load_in_tracking_window(l.id, p_now) is true
  ), legs as (
    select b.id, b.st, 'PL'::text as leg, b.pre_code as code, b.g,
           true as cur
      from base b
     where b.st in ('READY', 'AT_LOADING', 'IN_TRANSIT_PL')
    union all
    select b.id, b.st, 'SE'::text, b.post_code, b.g,
           (b.st in ('AT_PORT_NYNASHAMN', 'IN_TRANSIT_SE'))
      from base b
    union all
    -- Stena KAA: rdzeń wybiera E22 / inland / track po pozycji — prognoza dla wariantów tej samej trasy.
    select b.id, b.st, 'SE'::text, k.code, b.g, false
      from base b
      cross join (values ('SE_KAA_INLAND'), ('SE_KAA_TRACK')) as k(code)
     where b.post_code = 'SE_E22'
  )
  select x.id, x.code, x.leg,
         coalesce(
           case
             when x.cur and x.g is not null and x.st in ('IN_TRANSIT_PL', 'IN_TRANSIT_SE') then (
               select greatest(0, cp.total_km - cp.remaining_km)
                 from public.corridor_progress(x.code, x.g) cp
                 limit 1
             )
           end,
           0
         )::numeric as from_km,
         x.cur
    from legs x
   where x.code is not null
     and exists (select 1 from corridor_polylines cpl where cpl.code = x.code);
$$;

revoke all on function public.e49_wind_load_corridors(timestamptz) from public, anon, authenticated;
grant execute on function public.e49_wind_load_corridors(timestamptz) to service_role;

comment on function public.e49_wind_load_corridors(timestamptz) is
  'E49-a: korytarze (PL / SE-FI) z geometrią per transport w oknie śledzenia; bez AT_SITE/FERRY.';

-- Lista kodów do pobrania prognozy (SMHI/FMI): tylko korytarze, którymi jedzie jakiś transport.
create or replace function public.e49_wind_active_corridors(p_now timestamptz default now())
returns table(code text)
language sql
stable
security definer
set search_path = public
as $$
  select distinct c.code from public.e49_wind_load_corridors(p_now) c;
$$;

revoke all on function public.e49_wind_active_corridors(timestamptz) from public, anon, authenticated;
grant execute on function public.e49_wind_active_corridors(timestamptz) to service_role;

comment on function public.e49_wind_active_corridors(timestamptz) is
  'E49-a: kody corridor_polylines z trasy konkretnych transportów w oknie śledzenia — bez zapytań SMHI/FMI poza listą.';

create or replace function public.corridor_polyline_geojson(p_code text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select st_asgeojson(geom)::jsonb
    from corridor_polylines
   where code = p_code
   limit 1;
$$;

revoke all on function public.corridor_polyline_geojson(text) from public, anon, authenticated;
grant execute on function public.corridor_polyline_geojson(text) to service_role;

-- Cron Edge corridor-wind (co godzinę, minutę 27 — nie koliduje z ferry-weather :15 / route-hazards :17)
create or replace function public.tower_cron_corridor_wind_invoke()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_key text;
begin
  if to_regclass('vault.decrypted_secrets') is null then
    raise notice 'tower_cron_corridor_wind_invoke: brak vault.decrypted_secrets';
    return;
  end if;
  if to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is null then
    raise notice 'tower_cron_corridor_wind_invoke: brak net.http_post';
    return;
  end if;
  execute $q$
    select max(decrypted_secret) filter (where name = 'project_url'),
           max(decrypted_secret) filter (where name = 'service_role_key')
      from vault.decrypted_secrets
  $q$ into v_url, v_key;
  if v_url is null or v_url = '' or v_key is null or v_key = '' then
    raise notice 'tower_cron_corridor_wind_invoke: brak project_url/service_role_key';
    return;
  end if;
  perform net.http_post(
    url     := rtrim(v_url, '/') || '/functions/v1/corridor-wind',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_key,
      'Content-Type', 'application/json'),
    body    := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
end;
$$;

revoke all on function public.tower_cron_corridor_wind_invoke() from public, anon, authenticated;
grant execute on function public.tower_cron_corridor_wind_invoke() to postgres;

do $body$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron')
     and to_regprocedure('cron.schedule(text,text,text)') is not null
  then
    perform cron.unschedule(jobid) from cron.job where jobname = 'tower-corridor-wind';
    perform cron.schedule(
      'tower-corridor-wind',
      '27 * * * *',
      $c$select public.tower_cron_corridor_wind_invoke();$c$
    );
  else
    raise notice '0397: pg_cron niedostępne — tower-corridor-wind do zaplanowania ręcznie';
  end if;
end
$body$;

commit;
