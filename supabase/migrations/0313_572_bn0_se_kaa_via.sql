-- #572 BN0 / F7 #585: SE-KAA zgodna ze śladem GPS SG-23 (SE_E22).
-- Via co ~100 km na drodze (nie centra miast); odchyłka dwukierunkowa ≤ 2 km;
-- odrzucenie nie kasuje dobrej geometrii; wymuszenie przeliczenia SE-KAA.

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

-- Via dla HERE Routing: punkty na linii korytarza co ~100 km (max 14), bez końców.
create or replace function public.here_corridor_via_points(p_code text, p_max integer default 14)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_geom geometry;
  v_len double precision;
  v_n integer;
  v_max integer;
  v_out jsonb := '[]'::jsonb;
  v_i integer;
  v_frac double precision;
  v_pt geometry;
begin
  if (p_code is not null and length(btrim(p_code)) > 0) is not true then
    raise exception 'Brak kodu korytarza' using errcode = '22023';
  end if;
  v_max := greatest(1, least(coalesce(p_max, 14), 14));
  select c.geom into v_geom from public.corridor_polylines c where c.code = p_code;
  if v_geom is null then
    return '[]'::jsonb;
  end if;
  v_len := st_length(v_geom::geography);
  if (v_len is not null and v_len >= 50000) is not true then
    return '[]'::jsonb;
  end if;
  -- ~100 km: liczba via = min(p_max, floor(km/100)-1), co najmniej 1 przy ≥200 km
  v_n := least(v_max, greatest(0, floor(v_len / 100000.0)::int - 1));
  if v_n < 1 and v_len >= 200000 then
    v_n := 1;
  end if;
  if v_n < 1 then
    return '[]'::jsonb;
  end if;
  for v_i in 1..v_n loop
    v_frac := v_i::double precision / (v_n + 1)::double precision;
    v_pt := st_lineinterpolatepoint(v_geom, v_frac);
    v_out := v_out || jsonb_build_array(
      jsonb_build_array(
        round(st_y(v_pt)::numeric, 6),
        round(st_x(v_pt)::numeric, 6)
      )
    );
  end loop;
  return v_out;
end;
$$;

comment on function public.here_corridor_via_points(text, integer) is
  '#572 F7: via passThrough co ~100 km na SE_E22 (nie wierzchołki miast).';

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

  select max(st_distance(v_road_g, dp.geom::geography))
    into v_c2r
    from corridor_polylines c
   cross join lateral st_dumppoints(c.geom) as dp
   where c.code = p_corridor;

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
    grant execute on function public.here_store_road(text, jsonb, text, timestamptz) to service_role;
  end if;
end $$;

-- SE_E22 ze śladu SG-23 (23.10 06:59 → 26.10 12:39), ST_Simplify ~50 m, skoki >5 km odrzucone.
-- 87 punktów, zapis poza repo: D:/Watch Tower/dane/tmp/se_e22_sg23_pts.json
update public.corridor_polylines
   set geom = st_setsrid(st_makeline(array[
         st_makepoint(15.63048, 56.16578),
         st_makepoint(15.67606, 56.20057),
         st_makepoint(15.94227, 56.25228),
         st_makepoint(16.06734, 56.39491),
         st_makepoint(16.09166, 56.56572),
         st_makepoint(16.32488, 56.6735),
         st_makepoint(16.37197, 56.8415),
         st_makepoint(16.42929, 57.01968),
         st_makepoint(16.48243, 57.12846),
         st_makepoint(16.46003, 57.29467),
         st_makepoint(16.5132, 57.4557),
         st_makepoint(16.47182, 57.61414),
         st_makepoint(16.44219, 57.66674),
         st_makepoint(16.38689, 57.89055),
         st_makepoint(16.51831, 58.01925),
         st_makepoint(16.53605, 58.18638),
         st_makepoint(16.44891, 58.34502),
         st_makepoint(16.31859, 58.47919),
         st_makepoint(16.17355, 58.57509),
         st_makepoint(16.15802, 58.69317),
         st_makepoint(16.20737, 58.85299),
         st_makepoint(16.2494, 59.00117),
         st_makepoint(16.1445, 59.13129),
         st_makepoint(16.10964, 59.29196),
         st_makepoint(16.19381, 59.41482),
         st_makepoint(16.29687, 59.40451),
         st_makepoint(16.30437, 59.49788),
         st_makepoint(16.48474, 59.61316),
         st_makepoint(16.58319, 59.70872),
         st_makepoint(16.54819, 59.88075),
         st_makepoint(16.79901, 59.93662),
         st_makepoint(16.91633, 60.08277),
         st_makepoint(16.95996, 60.2519),
         st_makepoint(16.97963, 60.41631),
         st_makepoint(16.96129, 60.57376),
         st_makepoint(17.08744, 60.68307),
         st_makepoint(17.06276, 60.86006),
         st_makepoint(17.0201, 60.90392),
         st_makepoint(16.96202, 61.0593),
         st_makepoint(17.03269, 61.23614),
         st_makepoint(16.99454, 61.40568),
         st_makepoint(16.97899, 61.58203),
         st_makepoint(17.07861, 61.74549),
         st_makepoint(17.18711, 61.89527),
         st_makepoint(17.26688, 62.04529),
         st_makepoint(17.37304, 62.20377),
         st_makepoint(17.36646, 62.36884),
         st_makepoint(17.34065, 62.46062),
         st_makepoint(17.56288, 62.53999),
         st_makepoint(17.88251, 62.61113),
         st_makepoint(17.87574, 62.70836),
         st_makepoint(17.99277, 62.84396),
         st_makepoint(18.16095, 62.98316),
         st_makepoint(18.36805, 63.08375),
         st_makepoint(18.50996, 63.23041),
         st_makepoint(18.72144, 63.29488),
         st_makepoint(19.00856, 63.31617),
         st_makepoint(19.01541, 63.31746),
         st_makepoint(19.21556, 63.44271),
         st_makepoint(19.46506, 63.57799),
         st_makepoint(19.82807, 63.61627),
         st_makepoint(20.11036, 63.73716),
         st_makepoint(20.5628, 63.89859),
         st_makepoint(20.83758, 64.0203),
         st_makepoint(20.97462, 64.18062),
         st_makepoint(21.09153, 64.29483),
         st_makepoint(21.30028, 64.39682),
         st_makepoint(21.23178, 64.5641),
         st_makepoint(21.00079, 64.70336),
         st_makepoint(20.97089, 64.72988),
         st_makepoint(21.02098, 64.82652),
         st_makepoint(21.22327, 64.96017),
         st_makepoint(21.48908, 65.09324),
         st_makepoint(21.50496, 65.14181),
         st_makepoint(21.504, 65.14221),
         st_makepoint(21.50536, 65.14199),
         st_makepoint(21.427, 65.2935),
         st_makepoint(21.58257, 65.42947),
         st_makepoint(21.8444, 65.54782),
         st_makepoint(22.0304, 65.63748),
         st_makepoint(21.97832, 65.65591),
         st_makepoint(21.7365, 65.78825),
         st_makepoint(21.78728, 65.82412),
         st_makepoint(21.7879, 65.82187),
         st_makepoint(21.8021, 65.807),
         st_makepoint(21.80438, 65.80763),
         st_makepoint(21.70654, 65.81801)
       ]), 4326),
       source = 'GPS SG-23 23–26.10.2026 (simplify ~50 m, #572 F7)',
       updated_at = now()
 where code = 'SE_E22';

update public.corridor_polylines
   set total_km = round((st_length(geom::geography) / 1000.0)::numeric, 2),
       updated_at = now()
 where code = 'SE_E22';


-- Na produkcji: przebuduj ze świeżego GPS SG-23, jeśli ≥ 50 punktów po filtrze skoków.
do $$
declare
  v_load uuid;
  v_geom geometry;
  v_n int;
begin
  select l.id into v_load
    from loads l
    join shipment_items si on si.load_id = l.id
   where si.shipment_code = 'SG-23'
   order by si.shipment_code
   limit 1;
  if v_load is null then
    return;
  end if;
  with raw as (
    select coalesce(geom_snapped, geom_raw)::geometry as g, ts
      from positions
     where load_id = v_load
       and ts >= timestamptz '2026-10-23 06:59:00+00'
       and ts <= timestamptz '2026-10-26 12:39:00+00'
       and coalesce(geom_snapped, geom_raw) is not null
  ),
  filtered as (
    select g, ts, lag(g) over (order by ts) as prev from raw
  ),
  kept as (
    select g, ts from filtered
     where prev is null or st_distance(g::geography, prev::geography) <= 5000
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
  update public.corridor_polylines
     set geom = st_setsrid(v_geom, 4326),
         source = 'GPS SG-23 23–26.10.2026 (live rebuild #572 F7)',
         total_km = round((st_length(v_geom::geography) / 1000.0)::numeric, 2),
         updated_at = now()
   where code = 'SE_E22';
end $$;

update public.here_road_geometry
   set fetched_at = '-infinity'::timestamptz
 where leg = 'SE-KAA';
