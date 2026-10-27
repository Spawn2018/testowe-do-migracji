-- #572 BN0 / F7 #585 r3: SE-KAA z korytarza SE_KAA_TRACK (ślad GPS), nie SE_E22.
-- N4: bez literałów GPS w repo. N8: SE_E22 bez zmian (OFF_CORRIDOR/ETA STENA).
-- N1: via = najbliższy wierzchołek śladu co ~100 km.
-- NOWE-1/2: kolumna retry_after; odrzucenie nie cofa fetched_at (bez pętli HERE / purge).
-- N3: start śladu = po ostatnim pobycie ≤2 km od Verkö.
-- NOWE-3: odchyłka korytarz→HERE ≤2 km; HERE→korytarz ≤ max(2 km; 0,15×L odcinka).

alter table public.corridor_polylines drop constraint if exists corridor_polylines_code_check;
alter table public.corridor_polylines
  add constraint corridor_polylines_code_check
  check (code in ('PL_ROAD', 'SE_E4', 'SE_E22', 'SE_APPROACH_SG03', 'SE_KAA_TRACK'));

alter table public.here_road_geometry
  add column if not exists retry_after timestamptz;

comment on column public.here_road_geometry.retry_after is
  '#572 F7 r3: po odrzuceniu geometrii — nie wołaj HERE przed tą chwilą; fetched_at = ostatni sukces.';

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

-- Odchyłka NOWE-3 (m): korytarz→HERE surowa; HERE→korytarz z tolerancją 0,15×L (nadmiar ponad allowed).
-- Odbiór OK gdy wynik ≤ 2000.
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
  v_r2c_excess double precision;
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

  -- punkt korytarza → linia HERE (strict ≤ 2 km)
  select max(st_distance(v_road_g, dp.geom::geography))
    into v_c2r
    from corridor_polylines c
   cross join lateral st_dumppoints(c.geom) as dp
   where c.code = p_corridor;

  -- punkt HERE → odcinek korytarza; excess ponad max(2000, 0.15×L)
  with corr_pts as (
    select (dp).path[1] as i, (dp).geom as g
      from corridor_polylines c
     cross join lateral st_dumppoints(c.geom) as dp
     where c.code = p_corridor
  ),
  segs as (
    select st_makeline(a.g, b.g)::geography as seg_g,
           st_distance(a.g::geography, b.g::geography) as seg_m
      from corr_pts a
      join corr_pts b on b.i = a.i + 1
  ),
  road_pts as (
    select st_setsrid(st_makepoint((p->>1)::float8, (p->>0)::float8), 4326)::geography as g
      from here_road_geometry h
     cross join lateral jsonb_array_elements(h.points) as t(p)
     where h.leg = p_leg
       and h.points is not null
       and jsonb_typeof(h.points) = 'array'
  ),
  per_pt as (
    select rp.g,
           (select s.seg_g from segs s order by st_distance(s.seg_g, rp.g) limit 1) as nearest_seg,
           (select s.seg_m from segs s order by st_distance(s.seg_g, rp.g) limit 1) as nearest_m
      from road_pts rp
  )
  select coalesce(max(
           greatest(0,
             st_distance(nearest_seg, g)
             - greatest(2000.0, 0.15 * coalesce(nearest_m, 0))
           )
         ), 0)
    into v_r2c_excess
    from per_pt
   where nearest_seg is not null;

  return greatest(coalesce(v_c2r, 0), coalesce(v_r2c_excess, 0));
end;
$$;

comment on function public.here_road_corridor_dev_m(text, text) is
  '#572 F7 r3 NOWE-3: max(m) — korytarz→HERE surowa; HERE→korytarz nadmiar ponad max(2km;0,15×L). OK ≤ 2000.';

revoke all on function public.here_road_corridor_dev_m(text, text) from public, anon, authenticated;

-- Sukces: points + fetched_at + retry_after null.
-- Odrzucenie (p_points null): zostaw points i fetched_at; summary; retry_after = p_now.
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
  if p_points is null then
    -- F7 r5: przy pierwszym INSERT (brak wiersza) fetched_at = -infinity —
    -- nie p_now (= retry), bo po upływie retry wiek ~0 blokowałby HERE na 30 dni.
    insert into here_road_geometry (leg, points, summary, fetched_at, retry_after)
    values (p_leg, null, left(p_summary, 240), '-infinity'::timestamptz, p_now)
    on conflict (leg) do update
      set summary = excluded.summary,
          retry_after = excluded.retry_after;
    -- points i fetched_at bez zmian przy konflikcie
    return;
  end if;
  insert into here_road_geometry (leg, points, summary, fetched_at, retry_after)
  values (p_leg, p_points, left(p_summary, 240), p_now, null)
  on conflict (leg) do update
    set points = excluded.points,
        summary = excluded.summary,
        fetched_at = excluded.fetched_at,
        retry_after = null;
end;
$$;

revoke all on function public.here_store_road(text, jsonb, text, timestamptz) from public, anon, authenticated;

-- N3: budowa SE_KAA_TRACK ze śladu GPS (start po ostatnim Verkö ≤2 km).
create or replace function public.rebuild_se_kaa_track(p_load_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_geom geometry;
  v_n int;
  v_origin geography := st_setsrid(st_makepoint(15.6308, 56.1646), 4326)::geography;
  v_dest geography := st_setsrid(st_makepoint(21.75914, 65.80539), 4326)::geography;
begin
  if (p_load_id is not null) is not true then
    return 0;
  end if;
  if not exists (select 1 from loads where id = p_load_id) then
    return 0;
  end if;

  with raw as (
    select coalesce(geom_snapped, geom_raw)::geometry as g,
           ts,
           speed_kmh,
           lag(coalesce(geom_snapped, geom_raw)::geometry) over (order by ts) as prev_g,
           lag(ts) over (order by ts) as prev_ts
      from positions
     where load_id = p_load_id
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
  numbered as (
    select g, ts, speed_kmh,
           row_number() over (order by ts) as rn,
           st_distance(g::geography, v_origin) as d_origin,
           st_distance(g::geography, v_dest) as d_dest
      from speed_ok
  ),
  bounds as (
    select
      -- N3/F7 r5 P2: start PO Verkö; brak punktu przy porcie → rn_start NULL → 0
      -- (bez coalesce(...,0): rn > 0 dawałoby start od PL).
      (
        select min(n.rn)
          from numbered n
         where n.rn > (
                 select max(n2.rn) from numbered n2
                  where n2.d_origin <= 2000
                    and n2.rn < coalesce(
                          (select min(n3.rn) from numbered n3 where n3.d_dest <= 2000),
                          (select max(n4.rn) + 1 from numbered n4)
                        )
               )
           and n.rn <= coalesce(
                 (select min(n5.rn) from numbered n5 where n5.d_dest <= 2000),
                 (select max(n6.rn) from numbered n6)
               )
      ) as rn_start,
      coalesce(
        (select min(rn) from numbered where d_dest <= 2000),
        (select max(rn) from numbered)
      ) as rn_end
  ),
  trimmed as (
    select n.g, n.ts, n.speed_kmh, n.rn
      from numbered n, bounds b
     where b.rn_start is not null
       and n.rn >= b.rn_start and n.rn <= b.rn_end
       and b.rn_start <= b.rn_end
  ),
  moving as (
    select g, ts, speed_kmh, rn,
           lag(g) over (order by ts) as prev_g
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
    return 0;
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

  return st_npoints(v_geom);
end;
$$;

comment on function public.rebuild_se_kaa_track(uuid) is
  '#572 F7 r5: SE_KAA_TRACK ze śladu load_id; start po ostatnim Verkö ≤2 km. 0 = brak Verkö / za mało punktów.';

revoke all on function public.rebuild_se_kaa_track(uuid) from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.here_corridor_points(text) to service_role;
    grant execute on function public.here_corridor_via_points(text, integer) to service_role;
    grant execute on function public.here_road_corridor_dev_m(text, text) to service_role;
    grant execute on function public.here_store_road(text, jsonb, text, timestamptz) to service_role;
    grant execute on function public.rebuild_se_kaa_track(uuid) to service_role;
  end if;
end $$;

-- N4/N8: SE_E22 bez zmian. SE_KAA_TRACK tylko z positions (gdy brak — nic).
select public.rebuild_se_kaa_track('95ab7218-69cc-490d-8b68-b379c3ed9aae'::uuid);

update public.here_road_geometry
   set fetched_at = '-infinity'::timestamptz,
       retry_after = null
 where leg = 'SE-KAA';
