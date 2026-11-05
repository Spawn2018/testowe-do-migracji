-- DP-224 (#817): map_display_state bez purge w odczycie; punkty do rysowania
-- uproszczone (~50 m) osobno od pełnej geometrii HERE; wersja sieci; purge w cronie.

begin;

-- ---------------------------------------------------------------------------
-- 1) Punkty do mapy z LineString (Douglas–Peucker ~50 m na 55–66°N)
-- ---------------------------------------------------------------------------
create or replace function public.here_road_points_display_from_geom(p_geom geometry)
returns jsonb
language plpgsql
immutable
parallel safe
security invoker
set search_path = public
as $$
declare
  v_simple geometry;
  v_out jsonb;
begin
  if (p_geom is not null and st_npoints(p_geom) >= 2) is not true then
    return null;
  end if;
  -- 100 jednostek Web Mercator ≈ 40–55 m na 55–66°N (cel rysowania, nie ETA)
  v_simple := st_transform(st_simplify(st_transform(p_geom, 3857), 100), 4326);
  if v_simple is null or st_npoints(v_simple) < 2 then
    v_simple := p_geom;
  end if;
  select coalesce(
           jsonb_agg(
             jsonb_build_array(
               round(st_y(d.geom)::numeric, 5),
               round(st_x(d.geom)::numeric, 5)
             )
             order by d.path[1]
           ),
           '[]'::jsonb
         )
    into v_out
    from st_dumppoints(v_simple) as d;
  if v_out is null or jsonb_array_length(v_out) < 2 then
    return null;
  end if;
  return v_out;
end;
$$;

comment on function public.here_road_points_display_from_geom(geometry) is
  'DP-224: [lat,lon] do mapy z geom (st_simplify 100 w 3857 ≈ 50 m); pełne points zostają do ETA/korytarza.';

revoke all on function public.here_road_points_display_from_geom(geometry)
  from public, anon, authenticated;
grant execute on function public.here_road_points_display_from_geom(geometry) to service_role;

alter table public.here_road_geometry
  add column if not exists points_display jsonb;

comment on column public.here_road_geometry.points_display is
  'DP-224: uproszczona polilinia do map_display_state (≤ ~50 m); osobno od points/geom ETA.';

-- ---------------------------------------------------------------------------
-- 2) here_store_road — ustawia points_display
-- ---------------------------------------------------------------------------
create or replace function public.here_store_road(
  p_leg text,
  p_points jsonb,
  p_summary text,
  p_now timestamptz default now(),
  p_length_m double precision default null,
  p_duration_s double precision default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n int;
  v_geom geometry;
  v_display jsonb;
begin
  if (exists (select 1 from here_road_legs h where h.leg = p_leg)) is not true then
    raise exception 'Zła noga trasy' using errcode = '22023';
  end if;
  if p_points is not null and (jsonb_typeof(p_points) = 'array' and jsonb_array_length(p_points) >= 2) is not true then
    raise exception 'Zła geometria' using errcode = '22023';
  end if;
  if (p_summary is not null and length(btrim(p_summary)) > 0) is not true then
    raise exception 'Brak podsumowania' using errcode = '22023';
  end if;
  if p_points is null then
    insert into here_road_geometry (leg, points, summary, fetched_at, retry_after, length_m, duration_s)
    values (p_leg, null, left(p_summary, 240), '-infinity'::timestamptz, p_now, null, null)
    on conflict (leg) do update
      set summary = excluded.summary,
          retry_after = excluded.retry_after;
    return;
  end if;
  v_n := jsonb_array_length(p_points);
  v_geom := public.here_road_line_from_points(p_points);
  v_display := public.here_road_points_display_from_geom(v_geom);
  insert into here_road_geometry (
    leg, points, summary, fetched_at, retry_after, length_m, duration_s, geom, n_points, points_display
  )
  values (
    p_leg, p_points, left(p_summary, 240), p_now, null, p_length_m, p_duration_s, v_geom, v_n, v_display
  )
  on conflict (leg) do update
    set points = excluded.points,
        summary = excluded.summary,
        fetched_at = excluded.fetched_at,
        retry_after = null,
        length_m = excluded.length_m,
        duration_s = excluded.duration_s,
        geom = excluded.geom,
        n_points = excluded.n_points,
        points_display = excluded.points_display;
end;
$$;

revoke all on function public.here_store_road(text, jsonb, text, timestamptz, double precision, double precision)
  from public, anon, authenticated;
grant execute on function public.here_store_road(text, jsonb, text, timestamptz, double precision, double precision)
  to service_role;

-- ---------------------------------------------------------------------------
-- 3) purge — też points_display
-- ---------------------------------------------------------------------------
create or replace function public.purge_here_road_geometry(p_now timestamptz default now())
returns int
language plpgsql
security definer
set search_path = public
as $$
declare n int;
begin
  update here_road_geometry
     set points = null,
         geom = null,
         n_points = null,
         points_display = null
   where (points is not null or geom is not null or n_points is not null or points_display is not null)
     and fetched_at < p_now - interval '30 days';
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.purge_here_road_geometry(timestamptz)
  from public, anon, authenticated;
grant execute on function public.purge_here_road_geometry(timestamptz) to service_role;

comment on function public.purge_here_road_geometry(timestamptz) is
  'D-81 / DP-184 / DP-224: po 30 dniach kasuje points, geom, n_points, points_display; summary zostaje. Cron, nie odczyt mapy.';

-- Backfill display z istniejącego geom
update public.here_road_geometry g
   set points_display = public.here_road_points_display_from_geom(g.geom)
 where g.geom is not null
   and st_npoints(g.geom) >= 2
   and (g.points_display is null
        or jsonb_typeof(g.points_display) is distinct from 'array'
        or jsonb_array_length(g.points_display) < 2);

-- ---------------------------------------------------------------------------
-- 4) map_display_state(p_known_version) — bez purge; points = display; wersja
--    Gdy p_known_version = bieżąca wersja → roads/route_legs = null (cache klienta).
-- ---------------------------------------------------------------------------
drop function if exists public.map_display_state();

create or replace function public.map_display_state(p_known_version text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_roads jsonb;
  v_route_legs jsonb;
  v_version text;
  v_unchanged boolean := false;
begin
  if (public.current_app_user_id() is null) then
    raise exception 'Brak aktywnego konta' using errcode = '42501';
  end if;

  select coalesce(
           md5(
             string_agg(
               g.leg || ':' || coalesce(g.fetched_at::text, '') || ':' || coalesce(g.n_points::text, '0'),
               '|' order by g.leg
             )
           ),
           'empty'
         )
    into v_version
    from here_road_geometry g
    join here_road_legs l on l.leg = g.leg
   where l.active;

  if p_known_version is not null
     and length(btrim(p_known_version)) > 0
     and p_known_version = v_version then
    v_unchanged := true;
  end if;

  if v_unchanged is not true then
    select coalesce(jsonb_agg(jsonb_build_object(
      'leg', g.leg,
      'points', coalesce(g.points_display, g.points),
      'summary', g.summary,
      'fetched_at', g.fetched_at,
      'spec', l.spec,
      'corridor_code', l.corridor_code,
      'browser_fetch', l.browser_fetch,
      'map_group', l.map_group,
      'cron_fetch', l.cron_fetch,
      'via_points', l.via_points,
      'min_km', l.min_km,
      'max_km', l.max_km,
      'length_m', g.length_m,
      'duration_s', g.duration_s
    ) order by l.sort_order, g.leg), '[]'::jsonb)
      into v_roads
      from here_road_geometry g
      join here_road_legs l on l.leg = g.leg
     where l.active;

    select coalesce(jsonb_agg(jsonb_build_object(
      'route', fr.code,
      'pre', fr.road_corridor_pre,
      'post', fr.road_corridor_post
    ) order by fr.code), '[]'::jsonb)
      into v_route_legs
      from ferry_routes fr
     where fr.active
       and (fr.road_corridor_pre is not null or fr.road_corridor_post is not null);
  end if;

  return jsonb_build_object(
    'tiles_open', public.here_tiles_open(now()),
    'month', (date_trunc('month', now() at time zone 'Europe/Warsaw'))::date,
    'h6', public.h6_map_enabled(),
    'roads_version', v_version,
    'roads_unchanged', v_unchanged,
    'roads', v_roads,
    'route_legs', v_route_legs
  );
end;
$$;

revoke all on function public.map_display_state(text) from public, anon;
grant execute on function public.map_display_state(text) to authenticated;

comment on function public.map_display_state(text) is
  'DP-224/BN7: roads (points_display) + roads_version; p_known_version → roads_unchanged bez punktów; bez purge w odczycie.';

-- ---------------------------------------------------------------------------
-- 5) Cron purge (było w każdym odczycie mapy)
-- ---------------------------------------------------------------------------
do $cron224$
begin
  if to_regclass('cron.job') is not null
     and to_regprocedure('cron.schedule(text,text,text)') is not null then
    perform cron.unschedule(j.jobid)
      from cron.job j where j.jobname = 'tower-here-road-purge';
    perform cron.schedule(
      'tower-here-road-purge',
      '18 3 * * *',
      $c$select public.purge_here_road_geometry(now());$c$
    );
  end if;
exception when others then
  raise warning 'DP-224 cron tower-here-road-purge: %', sqlerrm;
end $cron224$;

commit;
