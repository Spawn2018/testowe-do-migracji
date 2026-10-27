-- #572 BN0 / F7 #585 r2: SE-KAA z korytarza SE_KAA_TRACK (ślad GPS), nie SE_E22.
-- N4: bez literałów GPS w repo. N8: SE_E22 bez zmian (OFF_CORRIDOR/ETA STENA).
-- Via = najbliższy wierzchołek śladu co ~100 km; odchyłka dwukierunkowa ≤ 2 km;
-- odrzucenie nie kasuje points; wymuszenie przeliczenia SE-KAA.

alter table public.corridor_polylines drop constraint if exists corridor_polylines_code_check;
alter table public.corridor_polylines
  add constraint corridor_polylines_code_check
  check (code in ('PL_ROAD', 'SE_E4', 'SE_E22', 'SE_APPROACH_SG03', 'SE_KAA_TRACK'));

create or replace function public.here_corridor_points(p_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_out jsonb;
begin
  if (p_code is not null and length(btrim(p_code)) > 0) is not true then
    raise exception 'Brak kodu korytarza' using errcode = '22023';
  end if;
  select coalesce(
    jsonb_agg(
      jsonb_build_array(
        round(st_y(dp.geom)::numeric, 6),
        round(st_x(dp.geom)::numeric, 6)
      )
      order by dp.path[1]
    ),
    '[]'::jsonb
  )
    into v_out
    from public.corridor_polylines c
   cross join lateral st_dumppoints(c.geom) as dp
   where c.code = p_code;
  if (v_out is null) then
    return '[]'::jsonb;
  end if;
  return v_out;
end;
$$;

comment on function public.here_corridor_points(text) is
  '#572 BN0: wierzchołki corridor_polylines jako [[lat,lng],…] (debug / test).';

revoke all on function public.here_corridor_points(text) from public, anon, authenticated;

-- Via: najbliższy rzeczywisty wierzchołek śladu przy kolejnych 100 km (metry geography).
create or replace function public.here_corridor_via_points(p_code text, p_max integer default 14)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_len double precision;
  v_n integer;
  v_max integer;
  v_out jsonb := '[]'::jsonb;
  v_i integer;
  v_target double precision;
  v_pt geometry;
begin
  if (p_code is not null and length(btrim(p_code)) > 0) is not true then
    raise exception 'Brak kodu korytarza' using errcode = '22023';
  end if;
  v_max := greatest(1, least(coalesce(p_max, 14), 14));
  select st_length(c.geom::geography) into v_len
    from public.corridor_polylines c where c.code = p_code;
  if (v_len is not null and v_len >= 50000) is not true then
    return '[]'::jsonb;
  end if;
  v_n := least(v_max, greatest(0, floor(v_len / 100000.0)::int - 1));
  if v_n < 1 and v_len >= 200000 then
    v_n := 1;
  end if;
  if v_n < 1 then
    return '[]'::jsonb;
  end if;

  for v_i in 1..v_n loop
    v_target := v_len * (v_i::double precision / (v_n + 1)::double precision);
    with pts as (
      select (dp).path[1] as i, (dp).geom as g
        from public.corridor_polylines c
       cross join lateral st_dumppoints(c.geom) as dp
       where c.code = p_code
    ),
    steps as (
      select i, g,
             coalesce(st_distance(lag(g) over (order by i)::geography, g::geography), 0) as step_m
        from pts
    ),
    cum as (
      select i, g, sum(step_m) over (order by i) as cum_m from steps
    )
    select g into v_pt
      from cum
     order by abs(cum_m - v_target)
     limit 1;
    if v_pt is not null then
      v_out := v_out || jsonb_build_array(
        jsonb_build_array(
          round(st_y(v_pt)::numeric, 6),
          round(st_x(v_pt)::numeric, 6)
        )
      );
    end if;
  end loop;
  return v_out;
end;
$$;

comment on function public.here_corridor_via_points(text, integer) is
  '#572 F7: via passThrough co ~100 km — najbliższy wierzchołek śladu (metry), nie interpolacja cięciwy.';

revoke all on function public.here_corridor_via_points(text, integer) from public, anon, authenticated;

-- Odchyłka dwukierunkowa (m): max(korytarz→HERE, HERE→korytarz). NULL gdy brak geometrii.
create or replace function public.here_road_corridor_dev_m(p_leg text, p_corridor text)
returns double precision
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_road_g geography;
  v_corr_g geography;
  v_c2r double precision;
  v_r2c double precision;
begin
  if (p_leg in ('PL-GDN', 'PL-GDY', 'SE-NYN', 'SE-KAA')) is not true then
    raise exception 'Zła noga trasy' using errcode = '22023';
  end if;
  if (p_corridor is not null and length(btrim(p_corridor)) > 0) is not true then
    raise exception 'Brak kodu korytarza' using errcode = '22023';
  end if;

  select st_setsrid(
           st_makeline(
             array_agg(
               st_makepoint((p->>1)::float8, (p->>0)::float8)
               order by ord
             )
           ),
           4326
         )::geography
    into v_road_g
    from here_road_geometry h
   cross join lateral jsonb_array_elements(h.points) with ordinality as t(p, ord)
   where h.leg = p_leg
     and h.points is not null
     and jsonb_typeof(h.points) = 'array'
     and jsonb_array_length(h.points) >= 2;

  select c.geom::geography into v_corr_g
    from corridor_polylines c
   where c.code = p_corridor;

  if v_road_g is null or v_corr_g is null then
    return null;
  end if;

  -- punkt korytarza → linia HERE (geography)
  select max(st_distance(v_road_g, dp.geom::geography))
    into v_c2r
    from corridor_polylines c
   cross join lateral st_dumppoints(c.geom) as dp
   where c.code = p_corridor;

  -- punkt HERE → linia korytarza (geography)
  select max(st_distance(v_corr_g, st_setsrid(st_makepoint((p->>1)::float8, (p->>0)::float8), 4326)::geography))
    into v_r2c
    from here_road_geometry h
   cross join lateral jsonb_array_elements(h.points) as t(p)
   where h.leg = p_leg
     and h.points is not null
     and jsonb_typeof(h.points) = 'array';

  return greatest(coalesce(v_c2r, 0), coalesce(v_r2c, 0));
end;
$$;

comment on function public.here_road_corridor_dev_m(text, text) is
  '#572 F7: max metrów odchyłki dwukierunkowej korytarz↔HERE (odbiór ≤ 2000 m).';

revoke all on function public.here_road_corridor_dev_m(text, text) from public, anon, authenticated;

-- Odrzucenie: p_points null → zostaw dotychczasowe points (F7 #585).
create or replace function public.here_store_road(
  p_leg text,
  p_points jsonb,
  p_summary text,
  p_now timestamptz default now()
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if (p_leg in ('PL-GDN', 'PL-GDY', 'SE-NYN', 'SE-KAA')) is not true then
    raise exception 'Zła noga trasy' using errcode = '22023';
  end if;
  if p_points is not null and (jsonb_typeof(p_points) = 'array' and jsonb_array_length(p_points) >= 2) is not true then
    raise exception 'Zła geometria' using errcode = '22023';
  end if;
  if (p_summary is not null and length(btrim(p_summary)) > 0) is not true then
    raise exception 'Brak podsumowania' using errcode = '22023';
  end if;
  insert into here_road_geometry (leg, points, summary, fetched_at)
  values (p_leg, p_points, left(p_summary, 240), p_now)
  on conflict (leg) do update
    set points = case
                   when excluded.points is null then here_road_geometry.points
                   else excluded.points
                 end,
        summary = excluded.summary,
        fetched_at = excluded.fetched_at;
end;
$$;

revoke all on function public.here_store_road(text, jsonb, text, timestamptz) from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.here_corridor_points(text) to service_role;
    grant execute on function public.here_corridor_via_points(text, integer) to service_role;
    grant execute on function public.here_road_corridor_dev_m(text, text) to service_role;
    grant execute on function public.here_store_road(text, jsonb, text, timestamptz) to service_role;
  end if;
end $$;

-- N4/N8: SE_E22 bez zmian. SE_KAA_TRACK tylko z positions (gdy brak — nic).
-- UUID SG-23 pinned; skoki po prędkości >150 km/h; przycięcie port→plac; postoje; simplify.
do $$
declare
  v_load uuid := '95ab7218-69cc-490d-8b68-b379c3ed9aae';
  v_geom geometry;
  v_n int;
  v_origin geography := st_setsrid(st_makepoint(15.6308, 56.1646), 4326)::geography;
  v_dest geography := st_setsrid(st_makepoint(21.75914, 65.80539), 4326)::geography;
begin
  if not exists (select 1 from loads where id = v_load) then
    return;
  end if;

  with raw as (
    select coalesce(geom_snapped, geom_raw)::geometry as g,
           ts,
           speed_kmh,
           lag(coalesce(geom_snapped, geom_raw)::geometry) over (order by ts) as prev_g,
           lag(ts) over (order by ts) as prev_ts
      from positions
     where load_id = v_load
       and coalesce(geom_snapped, geom_raw) is not null
  ),
  speed_ok as (
    select g, ts, speed_kmh
      from raw
     where prev_g is null
        or prev_ts is null
        or (extract(epoch from (ts - prev_ts)) > 0
            and (st_distance(prev_g::geography, g::geography)
                 / greatest(extract(epoch from (ts - prev_ts)), 1)) * 3.6 <= 150)
  ),
  -- wyjazd z portu (~2 km od Verkö) → wjazd na plac (~2 km od Boden)
  numbered as (
    select g, ts, speed_kmh,
           row_number() over (order by ts) as rn,
           st_distance(g::geography, v_origin) as d_origin,
           st_distance(g::geography, v_dest) as d_dest
      from speed_ok
  ),
  bounds as (
    select
      coalesce((select min(rn) from numbered where d_origin > 2000), 1) as rn_start,
      coalesce((select min(rn) from numbered where d_dest <= 2000),
               (select max(rn) from numbered)) as rn_end
  ),
  trimmed as (
    select n.g, n.ts, n.speed_kmh, n.rn
      from numbered n, bounds b
     where n.rn >= b.rn_start and n.rn <= b.rn_end
  ),
  -- usuń postoje: speed≈0 albo skupisko <300 m względem poprzedniego zatrzymania
  moving as (
    select g, ts, speed_kmh, rn,
           lag(g) over (order by ts) as prev_g,
           lag(speed_kmh) over (order by ts) as prev_spd
      from trimmed
  ),
  kept as (
    select g, ts from moving
     where coalesce(speed_kmh, 1) > 1
        or prev_g is null
        or st_distance(g::geography, prev_g::geography) >= 300
  ),
  agg as (
    select count(*)::int as n,
           st_simplify(st_makeline(array_agg(g order by ts)), 0.00045) as geom
      from kept
  )
  select n, geom into v_n, v_geom from agg;

  if (v_n is not null and v_n >= 50 and v_geom is not null and st_npoints(v_geom) >= 10) is not true then
    return;
  end if;

  insert into public.corridor_polylines (code, geom, total_km, source, updated_at)
  values (
    'SE_KAA_TRACK',
    st_setsrid(v_geom, 4326),
    round((st_length(v_geom::geography) / 1000.0)::numeric, 2),
    'GPS track rebuild #572 F7 (SE_KAA_TRACK)',
    now()
  )
  on conflict (code) do update
    set geom = excluded.geom,
        total_km = excluded.total_km,
        source = excluded.source,
        updated_at = now();
end $$;

update public.here_road_geometry
   set fetched_at = '-infinity'::timestamptz
 where leg = 'SE-KAA';
