-- DP-184 (F7 #749 r3 N2): here_road_geometry.geom + n_points;
-- ustawiane w here_store_road, zerowane z points w purge (D-81);
-- świeżość BN8b bez jsonb_array_length.

begin;

alter table public.here_road_geometry
  add column if not exists geom geometry(Geometry, 4326),
  add column if not exists n_points integer;

comment on column public.here_road_geometry.geom is
  'DP-184: LineString HERE (st_simplify ~20 m w 3857). Tylko w tej tabeli — D-81, kasowane z points.';
comment on column public.here_road_geometry.n_points is
  'DP-184: liczba punktów JSON przy zapisie; świeżość bez jsonb_array_length.';

-- ---------------------------------------------------------------------------
-- Pomocnicza: LineString z points [lat,lon] + uproszczenie ~20 m
-- ---------------------------------------------------------------------------
create or replace function public.here_road_line_from_points(p_points jsonb)
returns geometry
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_line geometry;
  v_simple geometry;
begin
  if (p_points is not null and jsonb_typeof(p_points) = 'array'
      and jsonb_array_length(p_points) >= 2) is not true then
    return null;
  end if;
  select st_setsrid(
           st_makeline(
             array_agg(
               st_makepoint((p->>1)::float8, (p->>0)::float8)
               order by ord
             )
           ),
           4326
         )
    into v_line
    from jsonb_array_elements(p_points) with ordinality as t(p, ord);
  if v_line is null or st_npoints(v_line) < 2 then
    return null;
  end if;
  -- ~20 m w Web Mercator; krótka linia / degeneracja → oryginał
  v_simple := st_transform(st_simplify(st_transform(v_line, 3857), 20), 4326);
  if v_simple is null or st_npoints(v_simple) < 2 then
    return v_line;
  end if;
  return v_simple;
end;
$$;

comment on function public.here_road_line_from_points(jsonb) is
  'DP-184: LineString z points HERE [lat,lon], st_simplify ~20 m (3857).';
revoke all on function public.here_road_line_from_points(jsonb)
  from public, anon, authenticated;
grant execute on function public.here_road_line_from_points(jsonb) to service_role;

-- Backfill istniejących wierszy (ta sama transakcja).
update public.here_road_geometry g
   set n_points = jsonb_array_length(g.points),
       geom = public.here_road_line_from_points(g.points)
 where g.points is not null
   and jsonb_typeof(g.points) = 'array'
   and jsonb_array_length(g.points) >= 2
   and (g.geom is null or g.n_points is null);

-- ---------------------------------------------------------------------------
-- here_store_road — ustawia geom + n_points
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
    -- Odrzut: zostaw points/geom/n_points (jak dotychczas points).
    insert into here_road_geometry (leg, points, summary, fetched_at, retry_after, length_m, duration_s)
    values (p_leg, null, left(p_summary, 240), '-infinity'::timestamptz, p_now, null, null)
    on conflict (leg) do update
      set summary = excluded.summary,
          retry_after = excluded.retry_after;
    return;
  end if;
  v_n := jsonb_array_length(p_points);
  v_geom := public.here_road_line_from_points(p_points);
  insert into here_road_geometry (leg, points, summary, fetched_at, retry_after, length_m, duration_s, geom, n_points)
  values (p_leg, p_points, left(p_summary, 240), p_now, null, p_length_m, p_duration_s, v_geom, v_n)
  on conflict (leg) do update
    set points = excluded.points,
        summary = excluded.summary,
        fetched_at = excluded.fetched_at,
        retry_after = null,
        length_m = excluded.length_m,
        duration_s = excluded.duration_s,
        geom = excluded.geom,
        n_points = excluded.n_points;
end;
$$;

revoke all on function public.here_store_road(text, jsonb, text, timestamptz, double precision, double precision)
  from public, anon, authenticated;
grant execute on function public.here_store_road(text, jsonb, text, timestamptz, double precision, double precision)
  to service_role;

-- ---------------------------------------------------------------------------
-- purge — kasuje points + geom + n_points (D-81)
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
         n_points = null
   where (points is not null or geom is not null or n_points is not null)
     and fetched_at < p_now - interval '30 days';
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.purge_here_road_geometry(timestamptz)
  from public, anon, authenticated;
grant execute on function public.purge_here_road_geometry(timestamptz) to service_role;

comment on function public.purge_here_road_geometry(timestamptz) is
  'D-81 / DP-184: po 30 dniach kasuje points, geom i n_points; summary zostaje.';

-- ---------------------------------------------------------------------------
-- BN8b: świeżość i linia na geom / n_points (bez jsonb_array_length)
-- ---------------------------------------------------------------------------
create or replace function public.bn8b_here_leg_fresh(p_leg text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.here_road_geometry g
     where g.leg = p_leg
       and g.n_points is not null
       and g.n_points >= 2
       and g.fetched_at is not null
       and g.fetched_at >= now() - interval '7 days'
  );
$$;

comment on function public.bn8b_here_leg_fresh(text) is
  'BN8b/#720 DP-184: świeża HERE po n_points≥2 i fetched_at ≤7 dni (bez jsonb_array_length).';
revoke all on function public.bn8b_here_leg_fresh(text) from public, anon, authenticated;
grant execute on function public.bn8b_here_leg_fresh(text) to service_role;

create or replace function public.bn8b_here_leg_line(p_leg text)
returns geometry
language sql
stable
security definer
set search_path = public
as $$
  -- Preferuj gotowe geom (DP-184); fallback z points gdy brak (np. insert testowy).
  select coalesce(
           g.geom,
           public.here_road_line_from_points(g.points)
         )
    from public.here_road_geometry g
   where g.leg = p_leg
     and g.fetched_at is not null
     and g.fetched_at >= now() - interval '7 days'
     and (
       (g.n_points is not null and g.n_points >= 2)
       or (
         g.points is not null
         and jsonb_typeof(g.points) = 'array'
         and jsonb_array_length(g.points) >= 2
       )
     );
$$;

comment on function public.bn8b_here_leg_line(text) is
  'BN8b/#720 DP-184: LineString z here_road_geometry.geom (fallback points). Bez zapisu.';
revoke all on function public.bn8b_here_leg_line(text) from public, anon, authenticated;
grant execute on function public.bn8b_here_leg_line(text) to service_role;

create or replace function public.bn8b_here_leg_progress(p_leg text, p_geom geometry)
returns table (remaining_frac numeric, off_m numeric, remaining_km numeric, total_km numeric, fetched_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_line geometry;
  v_fetched timestamptz;
begin
  if p_geom is null or p_leg is null then
    return;
  end if;
  select g.fetched_at into v_fetched
    from public.here_road_geometry g
   where g.leg = p_leg
     and g.fetched_at is not null
     and g.fetched_at >= now() - interval '7 days'
     and (
       (g.n_points is not null and g.n_points >= 2)
       or (
         g.points is not null
         and jsonb_typeof(g.points) = 'array'
         and jsonb_array_length(g.points) >= 2
       )
     );
  v_line := public.bn8b_here_leg_line(p_leg);
  return query
    select * from public.bn8b_here_leg_progress_on_line(v_line, p_geom, v_fetched);
end;
$$;

comment on function public.bn8b_here_leg_progress(text, geometry) is
  'BN8b/#720 DP-184: postęp/odległość na geom HERE legu (st_length raz w progress_on_line).';
revoke all on function public.bn8b_here_leg_progress(text, geometry)
  from public, anon, authenticated;
grant execute on function public.bn8b_here_leg_progress(text, geometry) to service_role;

commit;
