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

-- Korytarze z geometrią, na których jest transport w oknie śledzenia (E27 / #783 pkt 6).
create or replace function public.e49_wind_active_corridors(p_now timestamptz default now())
returns table(code text)
language sql
stable
security definer
set search_path = public
as $$
  select distinct x.code
  from (
    select h.corridor_code as code
      from loads l
      join sailings s on s.id = l.sailing_id
      join ferry_routes fr on fr.active and fr.code = upper(btrim(s.route))
      join here_road_legs h on h.leg in (fr.road_corridor_pre, fr.road_corridor_post)
     where public.load_in_tracking_window(l.id, p_now) is true
       and (h.corridor_code is not null)
    union
    select cp.code
      from corridor_polylines cp
     where cp.code in (
             'PL_ROAD', 'SE_E4', 'SE_E22', 'SE_KAA_INLAND', 'SE_KAA_TRACK',
             'PL_EE_E67', 'FI_E75', 'SE_E4_STO', 'SE_E18_KPS'
           )
       and exists (
         select 1
           from loads l
          where public.load_in_tracking_window(l.id, p_now) is true
            and (
              (cp.code like 'SE%' and l.status in (
                 'AT_PORT_NYNASHAMN', 'IN_TRANSIT_SE', 'AT_SITE'
               ))
              or (cp.code like 'PL%' and l.status in (
                 'READY', 'AT_LOADING', 'IN_TRANSIT_PL', 'AT_PORT_GDANSK'
               ))
              or (cp.code like 'FI%' and l.status in (
                 'AT_PORT_NYNASHAMN', 'IN_TRANSIT_SE', 'AT_SITE',
                 'IN_TRANSIT_PL', 'AT_PORT_GDANSK'
               ))
            )
       )
  ) x
  where x.code is not null
    and exists (select 1 from corridor_polylines cp where cp.code = x.code);
$$;

revoke all on function public.e49_wind_active_corridors(timestamptz) from public, anon, authenticated;
grant execute on function public.e49_wind_active_corridors(timestamptz) to service_role;

comment on function public.e49_wind_active_corridors(timestamptz) is
  'E49-a: kody corridor_polylines z transportem w oknie śledzenia — bez zapytań SMHI/FMI poza listą.';

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
