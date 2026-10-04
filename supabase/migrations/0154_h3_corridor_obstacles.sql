-- =====================================================================
-- TOWER — Migracja 0154: H-3 przeszkody wzdłuż korytarza
--
-- Funkcja jest zbudowana i WYŁĄCZONA. security_flags.H3_CORRIDOR_OBSTACLES = false.
-- Włączy ją właściciel, gdy poda wymiary zestawu (D-83). Brak crona.
-- Nic na produkcji nie woła HERE dla tego katalogu, dopóki flaga jest false.
-- Podświetlenie w podglądzie tylko dla wymiarów tego transportu, i tylko gdy flaga jest włączona.
-- Puste wymiary nie są uzupełniane. H-1 zostaje wyłączone.
-- Surowe dane HERE kasowane po 30 dniach. Podsumowanie zostaje.
-- =====================================================================


alter table security_flags drop constraint if exists security_flags_key_check;
alter table security_flags add constraint security_flags_key_check
  check (key in (
    'MFA_HHL_ADMIN', 'EXTERNAL_MESSAGING', 'PERMIT_REQUIRED_NON_STANDARD', 'FUEL_WOB_INGEST',
    'SMS_ZONE_APPROACH', 'SMS_ZONE_ENTER', 'DRIVER_LINK_ACCEPT', 'AUTOMATIC_DECISION_EMAIL',
    'H1_ROUTE_CHECK', 'H3_CORRIDOR_OBSTACLES'
  ));

insert into security_flags (key, enabled, note)
values (
  'H3_CORRIDOR_OBSTACLES', false,
  'H-3: przeszkody wzdłuż korytarza. Wyłączone, dopóki właściciel nie poda wymiarów zestawu (D-83).'
)
on conflict (key) do nothing;

create or replace function public.h3_corridor_enabled()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select enabled from security_flags where key = 'H3_CORRIDOR_OBSTACLES'), false)
$$;
revoke all on function public.h3_corridor_enabled() from public, anon, authenticated;

create or replace function public.h3_corridor_state()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and current_app_user_id() is null then
    raise exception 'Brak aktywnego konta' using errcode = '42501';
  end if;
  return public.h3_corridor_enabled();
end $$;
revoke all on function public.h3_corridor_state() from public, anon;
grant execute on function public.h3_corridor_state() to authenticated;

alter table public.here_usage drop constraint if exists here_usage_service_check;
alter table public.here_usage add constraint here_usage_service_check
  check (service in ('routing', 'attributes'));

create or replace function public.here_note_service(
  p_service text,
  p_n integer,
  p_usd numeric,
  p_now timestamptz default now()
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_month date;
begin
  if p_service not in ('routing', 'attributes') then
    raise exception 'Zła usługa HERE' using errcode = '22023';
  end if;
  if p_n is null or p_n < 0 or p_usd is null or p_usd < 0 then
    raise exception 'Zły zapis zużycia HERE' using errcode = '22023';
  end if;
  v_month := (date_trunc('month', p_now at time zone 'Europe/Warsaw'))::date;
  insert into here_usage (month, service, requests, estimated_usd)
  values (v_month, p_service, p_n, p_usd)
  on conflict (month, service) do update
    set requests = here_usage.requests + excluded.requests,
        estimated_usd = here_usage.estimated_usd + excluded.estimated_usd;
end $$;
revoke all on function public.here_note_service(text, integer, numeric, timestamptz) from public, anon, authenticated;

create or replace function public.here_month_spend(p_now timestamptz default now())
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select sum(estimated_usd) from here_usage
     where month = (date_trunc('month', p_now at time zone 'Europe/Warsaw'))::date
  ), 0)
$$;

create or replace function public.here_budget_view()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_usd numeric; v_n integer; v_on boolean; v_level text;
begin
  if (is_hhl()) is not true then
    raise exception 'Stan HERE widzi wyłącznie HHL' using errcode = '42501';
  end if;
  v_on := public.h1_route_check_enabled();
  select coalesce(sum(requests), 0), coalesce(sum(estimated_usd), 0)
    into v_n, v_usd
    from here_usage
   where month = (date_trunc('month', now() at time zone 'Europe/Warsaw'))::date;
  v_n := coalesce(v_n, 0);
  v_usd := coalesce(v_usd, 0);
  v_level := case
    when v_on is not true then 'off'
    when v_usd >= 100 then 'stop'
    when v_usd >= 80 then 'high'
    when v_usd >= 50 then 'warn'
    else 'ok'
  end;
  return jsonb_build_object(
    'enabled', v_on,
    'requests', v_n,
    'estimated_usd', v_usd,
    'budget_usd', 100,
    'level', v_level
  );
end $$;

create table if not exists public.corridor_fetches (
  leg text primary key check (leg in ('PL-GDN', 'PL-GDY', 'SE-NYN', 'SE-KAA')),
  fetched_at timestamptz not null,
  status text not null check (status in ('ok', 'bez_here', 'blad')),
  summary text not null,
  raw_response jsonb,
  raw_expires_at timestamptz,
  check (raw_response is null or raw_expires_at is not null)
);

create table if not exists public.corridor_obstacles (
  id uuid primary key default gen_random_uuid(),
  leg text not null check (leg in ('PL-GDN', 'PL-GDY', 'SE-NYN', 'SE-KAA')),
  link_id text not null,
  kind text not null check (kind in ('wiadukt', 'most', 'tunel', 'ograniczenie')),
  place text not null,
  lat numeric(9,5),
  lng numeric(9,5),
  max_height_cm integer,
  max_width_cm integer,
  max_length_cm integer,
  max_weight_kg integer,
  max_axle_kg integer,
  fetched_at timestamptz not null,
  unique (leg, link_id),
  check (max_height_cm is null or max_height_cm > 0),
  check (max_width_cm is null or max_width_cm > 0),
  check (max_length_cm is null or max_length_cm > 0),
  check (max_weight_kg is null or max_weight_kg > 0),
  check (max_axle_kg is null or max_axle_kg > 0)
);
create index if not exists corridor_obstacles_leg_idx on public.corridor_obstacles (leg);

alter table public.corridor_fetches enable row level security;
alter table public.corridor_obstacles enable row level security;
revoke all on table public.corridor_fetches from anon, authenticated;
revoke all on table public.corridor_obstacles from anon, authenticated;

create or replace function public.purge_here_corridor_raw(p_now timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_n integer;
begin
  update corridor_fetches
     set raw_response = null
   where raw_response is not null
     and raw_expires_at is not null
     and raw_expires_at <= p_now;
  get diagnostics v_n = row_count;
  return v_n;
end $$;
revoke all on function public.purge_here_corridor_raw(timestamptz) from public, anon, authenticated;

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
  if p_leg not in ('PL-GDN', 'PL-GDY', 'SE-NYN', 'SE-KAA') then
    raise exception 'Zła noga korytarza' using errcode = '22023';
  end if;
  if p_status not in ('ok', 'bez_here', 'blad') then
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
    when 'GDY-KAA' then array['PL-GDY', 'SE-KAA']
    when 'KAA-GDY' then array['PL-GDY', 'SE-KAA']
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

  with hit as (
    select o.kind, o.place, o.lat, o.lng,
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

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.here_note_service(text, integer, numeric, timestamptz) to service_role;
    grant execute on function public.here_month_spend(timestamptz) to service_role;
    grant execute on function public.purge_here_corridor_raw(timestamptz) to service_role;
    grant execute on function public.h3_replace_leg(text, timestamptz, text, text, boolean, jsonb, jsonb) to service_role;
    grant execute on function public.h3_corridor_enabled() to service_role;
  end if;
end $$;
