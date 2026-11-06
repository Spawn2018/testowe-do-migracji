-- DP-228 / F7 #841: odrzucenie nowego pobrania HERE przy zachowanej starej linii
-- musi być widoczne w Stanie systemu (geom_reject), bez kasowania points / geom_ok.

comment on column public.here_road_geometry.geom_reject is
  'DP-227/DP-228: powód odrzucenia z serwera. geom_ok=false → bieżące points złe; '
  'geom_ok=true + geom_reject → stara linia OK, ostatnie pobranie odrzucone (Stan systemu).';

-- Backfill: aktywny retry_after przy pełnych points = ostatni odrzut niewidoczny w geom_reject.
update public.here_road_geometry
   set geom_reject = left(nullif(btrim(summary), ''), 240)
 where points is not null
   and jsonb_typeof(points) = 'array'
   and jsonb_array_length(points) >= 2
   and geom_ok is true
   and retry_after is not null
   and (geom_reject is null or btrim(geom_reject) = '');

-- ---------------------------------------------------------------------------
-- here_store_road — przy p_points null: summary + retry_after + geom_reject
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
  v_reject text;
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
    -- Odrzut crona: zostaw dotychczasowe points i geom_ok (test #572 / DP-228);
    -- ustaw geom_reject, żeby Stan systemu widział odrzut przy starej linii.
    v_reject := left(btrim(p_summary), 240);
    insert into here_road_geometry (
      leg, points, summary, fetched_at, retry_after, length_m, duration_s, geom_reject
    )
    values (
      p_leg, null, v_reject, '-infinity'::timestamptz, p_now, null, null, v_reject
    )
    on conflict (leg) do update
      set summary = excluded.summary,
          retry_after = excluded.retry_after,
          geom_reject = excluded.geom_reject;
    return;
  end if;
  v_n := jsonb_array_length(p_points);
  v_geom := public.here_road_line_from_points(p_points);
  v_display := public.here_road_points_display_from_geom(v_geom);
  insert into here_road_geometry (
    leg, points, summary, fetched_at, retry_after, length_m, duration_s,
    geom, n_points, points_display, geom_ok, geom_reject
  )
  values (
    p_leg, p_points, left(p_summary, 240), p_now, null, p_length_m, p_duration_s,
    v_geom, v_n, v_display, true, null
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
        points_display = excluded.points_display,
        geom_ok = true,
        geom_reject = null;
end;
$$;

revoke all on function public.here_store_road(text, jsonb, text, timestamptz, double precision, double precision)
  from public, anon, authenticated;
grant execute on function public.here_store_road(text, jsonb, text, timestamptz, double precision, double precision)
  to service_role;

-- ---------------------------------------------------------------------------
-- map_display_state — wersja uwzględnia geom_reject (cache LS po odrzucie)
-- ---------------------------------------------------------------------------
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
               g.leg || ':' || coalesce(g.fetched_at::text, '') || ':' || coalesce(g.n_points::text, '0')
                 || ':' || coalesce(g.geom_ok::text, '')
                 || ':' || coalesce(g.geom_reject, ''),
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
      'duration_s', g.duration_s,
      'geom_ok', g.geom_ok,
      'geom_reject', g.geom_reject
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
  'DP-224/DP-227/DP-228/BN7: roads (points_display + geom_ok/geom_reject) + roads_version; wersja liczy geom_reject.';
