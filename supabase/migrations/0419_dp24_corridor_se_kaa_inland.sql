-- DP-24 (#667 F7 r1 N3): SE-KAA-INLAND w corridor_fetches / corridor_obstacles
-- i h3_replace_leg — gdy przeszkody H3 obejmą wariant śródlądowy Karlskrona→Boden.

alter table public.corridor_fetches
  drop constraint if exists corridor_fetches_leg_check;
alter table public.corridor_fetches
  add constraint corridor_fetches_leg_check
  check (leg in ('PL-GDN', 'PL-GDY', 'SE-NYN', 'SE-KAA', 'SE-KAA-INLAND'));

alter table public.corridor_obstacles
  drop constraint if exists corridor_obstacles_leg_check;
alter table public.corridor_obstacles
  add constraint corridor_obstacles_leg_check
  check (leg in ('PL-GDN', 'PL-GDY', 'SE-NYN', 'SE-KAA', 'SE-KAA-INLAND'));

create or replace function public.h3_replace_leg(
  p_leg text,
  p_fetched_at timestamptz,
  p_status text,
  p_summary text,
  p_replace boolean,
  p_items jsonb,
  p_raw jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if (p_leg in ('PL-GDN', 'PL-GDY', 'SE-NYN', 'SE-KAA', 'SE-KAA-INLAND')) is not true then
    raise exception 'Zła noga korytarza' using errcode = '22023';
  end if;
  if (p_status in ('ok', 'bez_here', 'blad')) is not true then
    raise exception 'Zły stan pobrania' using errcode = '22023';
  end if;
  if p_summary is null or length(btrim(p_summary)) = 0 then
    raise exception 'Brak podsumowania' using errcode = '22023';
  end if;
  if p_replace then
    delete from corridor_obstacles where leg = p_leg;
    insert into corridor_obstacles (
      leg, link_id, kind, place, lat, lng,
      max_height_cm, max_width_cm, max_length_cm, max_weight_kg, max_axle_kg, fetched_at
    )
    select
      p_leg,
      e->>'linkId',
      e->>'kind',
      e->>'place',
      nullif(e->>'lat', '')::numeric,
      nullif(e->>'lng', '')::numeric,
      nullif(e->>'maxHeightCm', '')::integer,
      nullif(e->>'maxWidthCm', '')::integer,
      nullif(e->>'maxLengthCm', '')::integer,
      nullif(e->>'maxWeightKg', '')::integer,
      nullif(e->>'maxAxleKg', '')::integer,
      p_fetched_at
    from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) e
    where coalesce(e->>'linkId', '') <> ''
      and coalesce(e->>'place', '') <> ''
      and e->>'kind' in ('wiadukt', 'most', 'tunel', 'ograniczenie');
  end if;
  insert into corridor_fetches (leg, fetched_at, status, summary, raw_response, raw_expires_at)
  values (
    p_leg, p_fetched_at, p_status, p_summary, p_raw,
    case when p_raw is null then null else p_fetched_at + interval '30 days' end
  )
  on conflict (leg) do update
    set fetched_at = excluded.fetched_at,
        status = excluded.status,
        summary = excluded.summary,
        raw_response = excluded.raw_response,
        raw_expires_at = excluded.raw_expires_at;
end $$;

revoke all on function public.h3_replace_leg(text, timestamptz, text, text, boolean, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.h3_replace_leg(text, timestamptz, text, text, boolean, jsonb, jsonb)
  to service_role;

comment on function public.h3_replace_leg(text, timestamptz, text, text, boolean, jsonb, jsonb) is
  'H-3: zapis przeszkód korytarza. DP-24: leg SE-KAA-INLAND (śródlądowy Karlskrona→Boden).';

-- GDY-KAA / KAA-GDY: uwzględnij też przeszkody SE-KAA-INLAND (wariant śródlądowy).
create or replace function public.h3_highlighted(p_load uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_route text;
  v_legs text[];
  v_h numeric;
  v_w numeric;
  v_l numeric;
  v_mass numeric;
  v_axles numeric;
  v_axle numeric;
  v_h_cm int;
  v_w_cm int;
  v_l_cm int;
  v_mass_kg int;
  v_axle_kg int;
  v_total int;
  v_items jsonb;
begin
  if p_load is null or not exists (select 1 from loads l where l.id = p_load) then
    raise exception 'Brak dostępu' using errcode = '42501';
  end if;
  if auth.uid() is not null and current_app_user_id() is null then
    raise exception 'Brak aktywnego konta' using errcode = '42501';
  end if;
  if auth.uid() is not null
     and (is_hhl()) is not true
     and current_org_kind() is distinct from 'SITE'
     and not exists (
       select 1 from loads l
        where l.id = p_load
          and current_org_kind() = 'CARRIER'
          and l.carrier_org_id = current_org_id()
     )
     and not exists (
       select 1 from loads l
       join projects pr on pr.id = l.project_id
        where l.id = p_load
          and current_org_kind() = 'CLIENT'
          and pr.client_org_id = current_org_id()
     )
  then
    raise exception 'Brak dostępu' using errcode = '42501';
  end if;
  if public.h3_corridor_enabled() is not true then
    return jsonb_build_object('status', 'wylaczone', 'total', 0, 'items', '[]'::jsonb);
  end if;

  select s.route,
         l.combo_height_m, l.combo_width_m, l.combo_length_m, l.combo_weight_t,
         l.combo_axle_count, l.combo_axle_load_t
    into v_route, v_h, v_w, v_l, v_mass, v_axles, v_axle
    from loads l
    left join sailings s on s.id = l.sailing_id
   where l.id = p_load;

  v_legs := case v_route
    when 'GDN-NYN' then array['PL-GDN', 'SE-NYN']
    when 'NYN-GDN' then array['PL-GDN', 'SE-NYN']
    when 'GDY-KAA' then array['PL-GDY', 'SE-KAA', 'SE-KAA-INLAND']
    when 'KAA-GDY' then array['PL-GDY', 'SE-KAA', 'SE-KAA-INLAND']
    else null
  end;

  if v_legs is null
     or v_h is null or v_h <= 0
     or v_w is null or v_w <= 0
     or v_l is null or v_l <= 0
     or v_mass is null or v_mass <= 0
     or v_axles is null or v_axles <= 0
     or v_axle is null or v_axle <= 0
     or not exists (
       select 1 from corridor_fetches f
        where f.leg = any (v_legs) and f.status = 'ok'
     )
     or not exists (
       select 1 from corridor_obstacles o
        where o.leg = any (v_legs)
     )
  then
    return jsonb_build_object('status', 'brak_danych', 'total', 0, 'items', '[]'::jsonb);
  end if;

  v_h_cm := round(v_h * 100)::int;
  v_w_cm := round(v_w * 100)::int;
  v_l_cm := round(v_l * 100)::int;
  v_mass_kg := round(v_mass * 1000)::int;
  v_axle_kg := round(v_axle * 1000)::int;

  -- F7 #836 r1: dedup po link_id (albo place+lat/lng) — SE-KAA ∩ SE-KAA-INLAND bez podwójnego total.
  with raw_hit as (
    select o.link_id, o.kind, o.place, o.lat, o.lng,
      concat_ws('; ',
        case when o.max_height_cm is not null and v_h_cm > o.max_height_cm then o.max_height_cm::text || ' cm wysokości' end,
        case when o.max_width_cm is not null and v_w_cm > o.max_width_cm then o.max_width_cm::text || ' cm szerokości' end,
        case when o.max_length_cm is not null and v_l_cm > o.max_length_cm then o.max_length_cm::text || ' cm długości' end,
        case when o.max_weight_kg is not null and v_mass_kg > o.max_weight_kg
          then trim(to_char(o.max_weight_kg / 1000.0, 'FM999990.0')) || ' t masy' end,
        case when o.max_axle_kg is not null and v_axle_kg > o.max_axle_kg
          then trim(to_char(o.max_axle_kg / 1000.0, 'FM999990.0')) || ' t na oś' end
      ) as limit_text,
      concat_ws('; ',
        case when o.max_height_cm is not null and v_h_cm > o.max_height_cm then v_h_cm::text || ' cm' end,
        case when o.max_width_cm is not null and v_w_cm > o.max_width_cm then v_w_cm::text || ' cm' end,
        case when o.max_length_cm is not null and v_l_cm > o.max_length_cm then v_l_cm::text || ' cm' end,
        case when o.max_weight_kg is not null and v_mass_kg > o.max_weight_kg
          then trim(to_char(v_mass_kg / 1000.0, 'FM999990.0')) || ' t' end,
        case when o.max_axle_kg is not null and v_axle_kg > o.max_axle_kg
          then trim(to_char(v_axle_kg / 1000.0, 'FM999990.0')) || ' t' end
      ) as set_text
    from corridor_obstacles o
    where o.leg = any (v_legs)
      and (
        (o.max_height_cm is not null and v_h_cm > o.max_height_cm)
        or (o.max_width_cm is not null and v_w_cm > o.max_width_cm)
        or (o.max_length_cm is not null and v_l_cm > o.max_length_cm)
        or (o.max_weight_kg is not null and v_mass_kg > o.max_weight_kg)
        or (o.max_axle_kg is not null and v_axle_kg > o.max_axle_kg)
      )
  ),
  hit as (
    select distinct on (
      coalesce(
        nullif(link_id, ''),
        place || '|' || coalesce(lat::text, '') || '|' || coalesce(lng::text, '')
      )
    )
      kind, place, lat, lng, limit_text, set_text
    from raw_hit
    order by
      coalesce(
        nullif(link_id, ''),
        place || '|' || coalesce(lat::text, '') || '|' || coalesce(lng::text, '')
      ),
      place
  )
  select count(*)::int,
         coalesce((
           select jsonb_agg(jsonb_build_object(
             'kind', s.kind,
             'place', s.place,
             'limitText', s.limit_text,
             'setText', s.set_text,
             'lat', s.lat,
             'lng', s.lng
           ) order by s.place)
           from (select * from hit order by place limit 200) s
         ), '[]'::jsonb)
    into v_total, v_items
  from hit;

  if coalesce(v_total, 0) = 0 then
    return jsonb_build_object('status', 'bez_przeszkod', 'total', 0, 'items', '[]'::jsonb);
  end if;
  return jsonb_build_object('status', 'podswietlone', 'total', v_total, 'items', v_items);
end $$;

revoke all on function public.h3_highlighted(uuid) from public, anon;
grant execute on function public.h3_highlighted(uuid) to authenticated;
