-- #572 BN0: Karlskrona→Boden (SE-KAA) zgodna z korytarzem SE_E22 (via z przejazdu).
-- Punkty korytarza dla Edge here-roads; odchyłka linii HERE od SE_E22 (test ≤ 2 km).

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
  '#572 BN0: wierzchołki corridor_polylines jako [[lat,lng],…] dla Edge here-roads (SE-KAA via).';

revoke all on function public.here_corridor_points(text) from public, anon, authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.here_corridor_points(text) to service_role;
  end if;
end $$;

-- Maksymalna odległość (m) wierzchołków korytarza od linii HERE (leg).
-- NULL gdy brak geometrii.
create or replace function public.here_road_corridor_dev_m(p_leg text, p_corridor text)
returns double precision
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_road geography;
  v_max double precision;
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
    into v_road
    from here_road_geometry h
   cross join lateral jsonb_array_elements(h.points) with ordinality as t(p, ord)
   where h.leg = p_leg
     and h.points is not null
     and jsonb_typeof(h.points) = 'array'
     and jsonb_array_length(h.points) >= 2;

  if v_road is null then
    return null;
  end if;

  select max(st_distance(v_road, dp.geom::geography))
    into v_max
    from corridor_polylines c
   cross join lateral st_dumppoints(c.geom) as dp
   where c.code = p_corridor;

  return v_max;
end;
$$;

comment on function public.here_road_corridor_dev_m(text, text) is
  '#572 BN0: max metrów od wierzchołków korytarza do linii here_road_geometry (odbiór ≤ 2000 m).';

revoke all on function public.here_road_corridor_dev_m(text, text) from public, anon, authenticated;
