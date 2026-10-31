-- #667 E / DP-23: słownik legów drogowych HERE (BN7 gotowy do rysowania).
-- Zamiast CHECK IN (…) / ROAD_LEGS w kodzie — tabela here_road_legs + FK.
-- BN7: PL-TLL, PL-MUU, PL-PLD, FI-HEL, FI-VUO, SE-STO, SE-KPS (browser_fetch=false).

begin;

create table if not exists public.here_road_legs (
  leg             text primary key,
  origin_lat      double precision not null,
  origin_lng      double precision not null,
  dest_lat        double precision not null,
  dest_lng        double precision not null,
  spec            text not null
                  check (spec in ('pl', 'se', 'kaa', 'loose')),
  summary         text not null,
  corridor_code   text,
  browser_fetch   boolean not null default true,
  map_group       text not null default 'core'
                  check (map_group in ('core', 'bn7')),
  active          boolean not null default true,
  sort_order      integer not null default 0
);

comment on table public.here_road_legs is
  '#667 E/DP-23: słownik nóg pomarańczowych; BN7 map_group=bn7, browser_fetch=false.';

alter table public.here_road_legs enable row level security;
revoke all on public.here_road_legs from public, anon, authenticated;
grant select on public.here_road_legs to authenticated;
grant select, insert, update, delete on public.here_road_legs to service_role;

drop policy if exists here_road_legs_read on public.here_road_legs;
create policy here_road_legs_read on public.here_road_legs
  for select to authenticated
  using (public.current_app_user_id() is not null);

insert into public.here_road_legs (
  leg, origin_lat, origin_lng, dest_lat, dest_lng, spec, summary, corridor_code,
  browser_fetch, map_group, active, sort_order
) values
  ('PL-GDN', 52.07391, 17.0246, 54.40372, 18.6813, 'pl',
   'Trasa drogowa Śrem–Gdańsk', null, true, 'core', true, 10),
  ('SE-NYN', 58.90453, 17.95621, 65.80539, 21.75914, 'se',
   'Trasa drogowa Nynäshamn–Boden', null, true, 'core', true, 20),
  ('PL-GDY', 52.07391, 17.0246, 54.53321, 18.54425, 'loose',
   'Trasa drogowa Śrem–Gdynia', null, true, 'core', true, 30),
  ('SE-KAA', 56.1646, 15.6308, 65.80539, 21.75914, 'kaa',
   'Trasa drogowa Karlskrona–Boden (E22 / wybrzeże)', 'SE_E22', true, 'core', true, 40),
  ('SE-KAA-INLAND', 56.1646, 15.6308, 65.80539, 21.75914, 'kaa',
   'Trasa drogowa Karlskrona–Boden (śródlądowa)', 'SE_KAA_INLAND', true, 'core', true, 50),
  -- BN7: do portu EE (#573) — Śrem → Tallinn D / Muuga / Paldiski
  ('PL-TLL', 52.07391, 17.0246, 59.44000, 24.77500, 'loose',
   'Trasa drogowa Śrem–Tallinn (Terminal D)', null, false, 'bn7', true, 60),
  ('PL-MUU', 52.07391, 17.0246, 59.50500, 24.95800, 'loose',
   'Trasa drogowa Śrem–Muuga', null, false, 'bn7', true, 70),
  ('PL-PLD', 52.07391, 17.0246, 59.33300, 24.08300, 'loose',
   'Trasa drogowa Śrem–Paldiski', null, false, 'bn7', true, 80),
  -- BN7: z portu FI → Boden
  ('FI-HEL', 60.15400, 24.91400, 65.80539, 21.75914, 'loose',
   'Trasa drogowa Helsinki (West Harbour)–Boden', null, false, 'bn7', true, 90),
  ('FI-VUO', 60.21200, 25.18800, 65.80539, 21.75914, 'loose',
   'Trasa drogowa Vuosaari–Boden', null, false, 'bn7', true, 100),
  -- BN7: z portu SE (Tallink/DFDS) → Boden
  ('SE-STO', 59.35000, 18.11000, 65.80539, 21.75914, 'loose',
   'Trasa drogowa Sztokholm (Värtahamnen)–Boden', null, false, 'bn7', true, 110),
  ('SE-KPS', 59.72300, 19.06600, 65.80539, 21.75914, 'loose',
   'Trasa drogowa Kapellskär–Boden', null, false, 'bn7', true, 120)
on conflict (leg) do update
  set origin_lat = excluded.origin_lat,
      origin_lng = excluded.origin_lng,
      dest_lat = excluded.dest_lat,
      dest_lng = excluded.dest_lng,
      spec = excluded.spec,
      summary = excluded.summary,
      corridor_code = excluded.corridor_code,
      browser_fetch = excluded.browser_fetch,
      map_group = excluded.map_group,
      active = excluded.active,
      sort_order = excluded.sort_order;

alter table public.here_road_geometry drop constraint if exists here_road_geometry_leg_check;
alter table public.here_road_geometry
  drop constraint if exists here_road_geometry_leg_fkey;
alter table public.here_road_geometry
  add constraint here_road_geometry_leg_fkey
  foreign key (leg) references public.here_road_legs (leg);

insert into public.here_road_geometry (leg, points, summary, fetched_at, retry_after)
select
  l.leg,
  null,
  l.summary || ' — oczekuje na HERE',
  '-infinity'::timestamptz,
  null
from public.here_road_legs l
where l.map_group = 'bn7'
on conflict (leg) do nothing;

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
  -- #667 E/DP-23: leg ze słownika (bez IN (…)).
  if (exists (select 1 from here_road_legs h where h.leg = p_leg)) is not true then
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
  '#572/#667 E: odchyłka korytarz↔HERE; leg w here_road_legs (bez IN).';

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
    insert into here_road_geometry (leg, points, summary, fetched_at, retry_after)
    values (p_leg, null, left(p_summary, 240), '-infinity'::timestamptz, p_now)
    on conflict (leg) do update
      set summary = excluded.summary,
          retry_after = excluded.retry_after;
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
grant execute on function public.here_store_road(text, jsonb, text, timestamptz) to service_role;

revoke all on function public.here_road_corridor_dev_m(text, text) from public, anon, authenticated;
grant execute on function public.here_road_corridor_dev_m(text, text) to service_role;

-- RPC: drogi z aktywnymi legami + spec/browser_fetch/map_group ze słownika.
create or replace function public.map_display_state()
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare v_roads jsonb;
begin
  if (public.current_app_user_id() is null) then
    raise exception 'Brak aktywnego konta' using errcode = '42501';
  end if;
  perform public.purge_here_road_geometry(now());
  select coalesce(jsonb_agg(jsonb_build_object(
    'leg', g.leg,
    'points', g.points,
    'summary', g.summary,
    'fetched_at', g.fetched_at,
    'spec', l.spec,
    'corridor_code', l.corridor_code,
    'browser_fetch', l.browser_fetch,
    'map_group', l.map_group
  ) order by l.sort_order, g.leg), '[]'::jsonb)
    into v_roads
    from here_road_geometry g
    join here_road_legs l on l.leg = g.leg
   where l.active;
  return jsonb_build_object(
    'tiles_open', public.here_tiles_open(now()),
    'month', (date_trunc('month', now() at time zone 'Europe/Warsaw'))::date,
    'h6', public.h6_map_enabled(),
    'roads', v_roads
  );
end;
$$;

revoke all on function public.map_display_state() from public, anon;
grant execute on function public.map_display_state() to authenticated;

comment on function public.map_display_state() is
  '#667 E/DP-23: roads = active here_road_legs + geometry + spec/browser_fetch/map_group.';

commit;
