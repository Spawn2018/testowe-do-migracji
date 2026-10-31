-- #667 B: dwie pomarańczowe drogi Karlskrona→Boden (SE-KAA = E22/wybrzeże; SE-KAA-INLAND).
-- Edge/refresh: SE-KAA ← SE_E22; SE-KAA-INLAND ← jawnie SE_KAA_INLAND (F7 r1 B3; nie TRACK).
-- Numer 0352: 0351 zajęte przez #666 (PR #668); przy rebase bez #668 — sprawdź wolny numer.

begin;

alter table public.here_road_geometry drop constraint if exists here_road_geometry_leg_check;
alter table public.here_road_geometry
  add constraint here_road_geometry_leg_check
  check (leg in ('PL-GDN', 'PL-GDY', 'SE-NYN', 'SE-KAA', 'SE-KAA-INLAND'));

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
  if (p_leg in ('PL-GDN', 'PL-GDY', 'SE-NYN', 'SE-KAA', 'SE-KAA-INLAND')) is not true then
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
  '#572/#667: max(m) — korytarz→HERE surowa; HERE→korytarz nadmiar ponad max(2km;0,15×L). OK ≤ 2000. Legi: PL-GDN, PL-GDY, SE-NYN, SE-KAA, SE-KAA-INLAND.';

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
  if (p_leg in ('PL-GDN', 'PL-GDY', 'SE-NYN', 'SE-KAA', 'SE-KAA-INLAND')) is not true then
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

insert into public.here_road_geometry (leg, points, summary, fetched_at, retry_after)
values (
  'SE-KAA-INLAND',
  null,
  'Trasa drogowa Karlskrona–Boden (śródlądowa) — oczekuje na HERE',
  '-infinity'::timestamptz,
  null
)
on conflict (leg) do nothing;

-- SE-KAA: jeśli nigdy nie pobrane — zostaw; nie kasuj świeżych punktów.
update public.here_road_geometry
   set summary = case
     when points is null then 'Trasa drogowa Karlskrona–Boden (E22 / wybrzeże) — oczekuje na HERE'
     else summary
   end
 where leg = 'SE-KAA'
   and points is null
   and fetched_at = '-infinity'::timestamptz;

commit;
