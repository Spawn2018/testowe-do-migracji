-- BN7 (#718): via/min/max/cron_fetch/spec=dict; korytarze OSM; ETA bałtyckie;
-- ferry_routes.road_corridor_* = legi; map_display_state.route_legs.
-- cron_fetch=true dopiero po froncie koordynatora (kolejność §5).

begin;

-- ---------------------------------------------------------------------------
-- 1) here_road_legs: via / min_km / max_km / cron_fetch / spec dict
-- ---------------------------------------------------------------------------
alter table public.here_road_legs
  drop constraint if exists here_road_legs_spec_check;
alter table public.here_road_legs
  add constraint here_road_legs_spec_check
  check (spec in ('pl', 'se', 'kaa', 'loose', 'dict'));

alter table public.here_road_legs
  add column if not exists via_points jsonb not null default '[]'::jsonb,
  add column if not exists min_km numeric(8,2),
  add column if not exists max_km numeric(8,2),
  add column if not exists cron_fetch boolean not null default true;

comment on column public.here_road_legs.via_points is
  'BN7: [[lat,lng],…] passThrough HERE; puste = bez via (kaa bierze z korytarza).';
comment on column public.here_road_legs.min_km is
  'BN7 dict: min. długość linii HERE [km].';
comment on column public.here_road_legs.max_km is
  'BN7 dict: max. długość linii HERE [km].';
comment on column public.here_road_legs.cron_fetch is
  'BN7: cron here-roads bierze leg tylko gdy true (DP-55); start false dla bn7.';

alter table public.here_road_geometry
  add column if not exists length_m double precision,
  add column if not exists duration_s double precision;

comment on column public.here_road_geometry.length_m is
  'BN7: summary.length z HERE Routing v8 [m].';
comment on column public.here_road_geometry.duration_s is
  'BN7: summary.duration z HERE Routing v8 [s].';

-- BN7 legi: dict + via + limity + corridor_code; cron_fetch=false
update public.here_road_legs set
  spec = 'dict',
  cron_fetch = false,
  browser_fetch = false,
  via_points = '[
    [53.13,23.16],[54.10,22.93],[54.90,23.90],
    [56.41,24.19],[57.87,24.36],[58.39,24.50]
  ]'::jsonb,
  min_km = 1250, max_km = 1400,
  corridor_code = 'PL_EE_E67',
  summary = 'Trasa drogowa Śrem–Tallinn (Terminal D) — BN7 dict'
where leg = 'PL-TLL';

update public.here_road_legs set
  spec = 'dict', cron_fetch = false, browser_fetch = false,
  via_points = '[
    [53.13,23.16],[54.10,22.93],[54.90,23.90],
    [56.41,24.19],[57.87,24.36],[58.39,24.50]
  ]'::jsonb,
  min_km = 1250, max_km = 1400,
  corridor_code = 'PL_EE_E67',
  summary = 'Trasa drogowa Śrem–Muuga — BN7 dict'
where leg = 'PL-MUU';

update public.here_road_legs set
  spec = 'dict', cron_fetch = false, browser_fetch = false,
  via_points = '[
    [53.13,23.16],[54.10,22.93],[54.90,23.90],
    [56.41,24.19],[57.87,24.36],[58.39,24.50]
  ]'::jsonb,
  min_km = 1300, max_km = 1450,
  corridor_code = 'PL_EE_E67',
  summary = 'Trasa drogowa Śrem–Paldiski — BN7 dict'
where leg = 'PL-PLD';

update public.here_road_legs set
  spec = 'dict', cron_fetch = false, browser_fetch = false,
  via_points = '[
    [62.24,25.75],[65.01,25.47],[65.85,24.15],[65.85,23.15]
  ]'::jsonb,
  min_km = 880, max_km = 950,
  corridor_code = 'FI_E75',
  summary = 'Trasa drogowa Helsinki–Boden — BN7 dict (HEL_T2/HEL_KAT)'
where leg = 'FI-HEL';

update public.here_road_legs set
  spec = 'dict', cron_fetch = false, browser_fetch = false,
  via_points = '[
    [62.24,25.75],[65.01,25.47],[65.85,24.15],[65.85,23.15]
  ]'::jsonb,
  min_km = 880, max_km = 950,
  corridor_code = 'FI_E75',
  summary = 'Trasa drogowa Vuosaari–Boden — BN7 dict'
where leg = 'FI-VUO';

update public.here_road_legs set
  spec = 'dict', cron_fetch = false, browser_fetch = false,
  via_points = '[
    [59.86,17.64],[60.67,17.14],[62.39,17.31],[63.83,20.26]
  ]'::jsonb,
  min_km = 950, max_km = 1050,
  corridor_code = 'SE_E4_STO',
  summary = 'Trasa drogowa Sztokholm–Boden — BN7 dict'
where leg = 'SE-STO';

update public.here_road_legs set
  spec = 'dict', cron_fetch = false, browser_fetch = false,
  via_points = '[
    [59.76,18.70],[59.86,17.64],[60.67,17.14],[62.39,17.31],[63.83,20.26]
  ]'::jsonb,
  min_km = 950, max_km = 1050,
  corridor_code = 'SE_E18_KPS',
  summary = 'Trasa drogowa Kapellskär–Boden — BN7 dict'
where leg = 'SE-KPS';

-- core: cron_fetch zostaje true (default)
update public.here_road_legs
   set cron_fetch = true
 where map_group = 'core';

-- ---------------------------------------------------------------------------
-- 2) corridor_polylines — nowe kody BN7 (przybliżenie OSM z miast publicznych)
-- ---------------------------------------------------------------------------
alter table public.corridor_polylines drop constraint if exists corridor_polylines_code_check;
alter table public.corridor_polylines
  add constraint corridor_polylines_code_check
  check (code in (
    'PL_ROAD', 'SE_E4', 'SE_E22', 'SE_APPROACH_SG03', 'SE_KAA_TRACK', 'SE_KAA_INLAND',
    'PL_EE_E67', 'FI_E75', 'SE_E4_STO', 'SE_E18_KPS'
  ));

-- PL→EE E67 (Śrem → Białystok → Suwałki → Kowno → Bauska → Ikla → Tallinn)
with g as (
  select st_setsrid(st_makeline(array[
    st_makepoint(17.0246, 52.0739), -- Śrem
    st_makepoint(16.93, 52.41),    -- Poznań
    st_makepoint(18.01, 53.12),    -- Toruń
    st_makepoint(19.46, 52.98),    -- Płońsk / S7
    st_makepoint(21.01, 52.23),    -- Warszawa
    st_makepoint(22.15, 52.70),
    st_makepoint(23.16, 53.13),    -- Białystok
    st_makepoint(22.93, 54.10),    -- Suwałki
    st_makepoint(23.35, 54.56),    -- Marijampolė
    st_makepoint(23.90, 54.90),    -- Kaunas
    st_makepoint(24.15, 55.30),
    st_makepoint(24.35, 55.73),    -- Panevėžys
    st_makepoint(24.19, 56.41),    -- Bauska
    st_makepoint(24.10, 56.95),    -- Rīga A7/A1
    st_makepoint(24.40, 57.35),
    st_makepoint(24.36, 57.87),    -- Ikla–Ainaži
    st_makepoint(24.50, 58.39),    -- Pärnu
    st_makepoint(24.43, 58.90),
    st_makepoint(24.75, 59.44)     -- Tallinn
  ]), 4326) as geom
)
insert into public.corridor_polylines (code, geom, total_km, source, attribution)
select 'PL_EE_E67', g.geom,
       round((st_length(g.geom::geography) / 1000.0)::numeric, 2),
       'OSM / ODbL — Śrem→E67→Tallinn (BN7 start; uproszczenie miast ~30–50 km)',
       '© OpenStreetMap contributors'
  from g
on conflict (code) do update set
  geom = excluded.geom,
  total_km = excluded.total_km,
  source = excluded.source,
  updated_at = now();

-- FI E75 Helsinki/Vuosaari → Oulu → Tornio → Boden
with g as (
  select st_setsrid(st_makeline(array[
    st_makepoint(24.914, 60.154),  -- HEL West Harbour
    st_makepoint(25.188, 60.212),  -- Vuosaari (wspólny korytarz)
    st_makepoint(25.10, 60.45),
    st_makepoint(25.75, 62.24),    -- Jyväskylä
    st_makepoint(25.70, 62.90),
    st_makepoint(25.47, 65.01),    -- Oulu
    st_makepoint(24.55, 65.74),    -- Kemi
    st_makepoint(24.15, 65.85),    -- Tornio
    st_makepoint(23.15, 65.85),    -- Kalix
    st_makepoint(21.759, 65.805)   -- Boden
  ]), 4326) as geom
)
insert into public.corridor_polylines (code, geom, total_km, source, attribution)
select 'FI_E75', g.geom,
       round((st_length(g.geom::geography) / 1000.0)::numeric, 2),
       'OSM / ODbL — Helsinki/Vuosaari→E75→Boden (BN7 start)',
       '© OpenStreetMap contributors'
  from g
on conflict (code) do update set
  geom = excluded.geom,
  total_km = excluded.total_km,
  source = excluded.source,
  updated_at = now();

-- SE E4 ze Sztokholmu (Värtahamnen) → Boden
with g as (
  select st_setsrid(st_makeline(array[
    st_makepoint(18.110, 59.350),  -- STO Värtahamnen
    st_makepoint(17.64, 59.86),    -- Uppsala
    st_makepoint(17.14, 60.67),    -- Gävle
    st_makepoint(17.31, 62.39),    -- Sundsvall
    st_makepoint(17.94, 62.63),
    st_makepoint(18.72, 63.29),
    st_makepoint(20.26, 63.83),    -- Umeå
    st_makepoint(20.95, 64.75),
    st_makepoint(21.48, 65.32),
    st_makepoint(21.759, 65.805)   -- Boden
  ]), 4326) as geom
)
insert into public.corridor_polylines (code, geom, total_km, source, attribution)
select 'SE_E4_STO', g.geom,
       round((st_length(g.geom::geography) / 1000.0)::numeric, 2),
       'OSM / ODbL — Sztokholm→E4→Boden (BN7 start)',
       '© OpenStreetMap contributors'
  from g
on conflict (code) do update set
  geom = excluded.geom,
  total_km = excluded.total_km,
  source = excluded.source,
  updated_at = now();

-- SE E18 Kapellskär → Norrtälje → E4 → Boden
with g as (
  select st_setsrid(st_makeline(array[
    st_makepoint(19.066, 59.723),  -- KPS
    st_makepoint(18.70, 59.76),    -- Norrtälje
    st_makepoint(17.64, 59.86),    -- Uppsala
    st_makepoint(17.14, 60.67),
    st_makepoint(17.31, 62.39),
    st_makepoint(20.26, 63.83),
    st_makepoint(21.48, 65.32),
    st_makepoint(21.759, 65.805)
  ]), 4326) as geom
)
insert into public.corridor_polylines (code, geom, total_km, source, attribution)
select 'SE_E18_KPS', g.geom,
       round((st_length(g.geom::geography) / 1000.0)::numeric, 2),
       'OSM / ODbL — Kapellskär→E18/E4→Boden (BN7 start)',
       '© OpenStreetMap contributors'
  from g
on conflict (code) do update set
  geom = excluded.geom,
  total_km = excluded.total_km,
  source = excluded.source,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- 3) ETA: parametry + mapa rodzin bałtyckich
-- ---------------------------------------------------------------------------
insert into public.eta_segment_params (code, label, hours, spread_pct, source) values
  ('PL_ROAD_EE', 'Droga PL/LT/LV/EE: Śrem → port EE', 22.0, 20,
   'HERE summary — do kalibracji (start przed pierwszym fetch BN7)'),
  ('FI_ROAD', 'Droga FI: Helsinki/Vuosaari → Boden', 16.0, 20,
   'HERE summary — do kalibracji (start przed pierwszym fetch BN7)'),
  ('SE_ROAD_STO', 'Droga SE: Sztokholm → Boden', 17.0, 20,
   'HERE summary — do kalibracji (start przed pierwszym fetch BN7)'),
  ('SE_ROAD_KPS', 'Droga SE: Kapellskär → Boden', 16.0, 20,
   'HERE summary — do kalibracji (start przed pierwszym fetch BN7)'),
  ('PORT_CHECKIN_TLL', 'Check-in Tallinn przed rejsem', 2.0, 0,
   'założenie — decyzja 82-C (PORT_CHECKIN 2 h)'),
  ('PORT_CHECKIN_MUU', 'Check-in Muuga przed rejsem', 2.0, 0,
   'założenie — decyzja 82-C (PORT_CHECKIN 2 h)'),
  ('PORT_CHECKIN_PLD', 'Check-in Paldiski przed rejsem', 2.0, 0,
   'założenie — decyzja 82-C (PORT_CHECKIN 2 h)'),
  ('CROSSING_TLL_HEL', 'Przeprawa Tallinn → Helsinki', 2.00, 10,
   'rozkład 60 dni — do kalibracji'),
  ('CROSSING_HEL_TLL', 'Przeprawa Helsinki → Tallinn', 2.00, 10,
   'rozkład 60 dni — do kalibracji'),
  ('CROSSING_TLLA_HEL', 'Przeprawa Tallinn A → Helsinki Katajanokka', 2.50, 10,
   'rozkład 60 dni — do kalibracji'),
  ('CROSSING_HELA_TLL', 'Przeprawa Helsinki Katajanokka → Tallinn A', 2.50, 10,
   'rozkład 60 dni — do kalibracji'),
  ('CROSSING_MUU_VUO', 'Przeprawa Muuga → Vuosaari', 2.75, 10,
   'rozkład 60 dni — do kalibracji'),
  ('CROSSING_VUO_MUU', 'Przeprawa Vuosaari → Muuga', 2.40, 10,
   'rozkład 60 dni — do kalibracji'),
  ('CROSSING_TLL_STO', 'Przeprawa Tallinn → Sztokholm', 17.50, 10,
   'rozkład 60 dni — do kalibracji'),
  ('CROSSING_STO_TLL', 'Przeprawa Sztokholm → Tallinn', 16.50, 10,
   'rozkład 60 dni — do kalibracji'),
  ('CROSSING_PLD_KPS', 'Przeprawa Paldiski → Kapellskär', 10.50, 10,
   'rozkład 60 dni — do kalibracji'),
  ('CROSSING_KPS_PLD', 'Przeprawa Kapellskär → Paldiski', 9.75, 10,
   'rozkład 60 dni — do kalibracji')
on conflict (code) do update set
  label = excluded.label,
  hours = excluded.hours,
  spread_pct = excluded.spread_pct,
  source = excluded.source,
  updated_at = now();

insert into public.eta_route_segments (route_key, segment_role, segment_code) values
  ('TLL-HEL',  'PL_ROAD', 'PL_ROAD_EE'),
  ('TLL-HEL',  'PORT_CHECKIN', 'PORT_CHECKIN_TLL'),
  ('TLL-HEL',  'CROSSING', 'CROSSING_TLL_HEL'),
  ('TLL-HEL',  'SE_ROAD', 'FI_ROAD'),
  ('HEL-TLL',  'PL_ROAD', 'FI_ROAD'),
  ('HEL-TLL',  'PORT_CHECKIN', 'PORT_CHECKIN_TLL'),
  ('HEL-TLL',  'CROSSING', 'CROSSING_HEL_TLL'),
  ('HEL-TLL',  'SE_ROAD', 'PL_ROAD_EE'),
  ('TLLA-HEL', 'PL_ROAD', 'PL_ROAD_EE'),
  ('TLLA-HEL', 'PORT_CHECKIN', 'PORT_CHECKIN_TLL'),
  ('TLLA-HEL', 'CROSSING', 'CROSSING_TLLA_HEL'),
  ('TLLA-HEL', 'SE_ROAD', 'FI_ROAD'),
  ('HELA-TLL', 'PL_ROAD', 'FI_ROAD'),
  ('HELA-TLL', 'PORT_CHECKIN', 'PORT_CHECKIN_TLL'),
  ('HELA-TLL', 'CROSSING', 'CROSSING_HELA_TLL'),
  ('HELA-TLL', 'SE_ROAD', 'PL_ROAD_EE'),
  ('MUU-VUO',  'PL_ROAD', 'PL_ROAD_EE'),
  ('MUU-VUO',  'PORT_CHECKIN', 'PORT_CHECKIN_MUU'),
  ('MUU-VUO',  'CROSSING', 'CROSSING_MUU_VUO'),
  ('MUU-VUO',  'SE_ROAD', 'FI_ROAD'),
  ('VUO-MUU',  'PL_ROAD', 'FI_ROAD'),
  ('VUO-MUU',  'PORT_CHECKIN', 'PORT_CHECKIN_MUU'),
  ('VUO-MUU',  'CROSSING', 'CROSSING_VUO_MUU'),
  ('VUO-MUU',  'SE_ROAD', 'PL_ROAD_EE'),
  ('TLL-STO',  'PL_ROAD', 'PL_ROAD_EE'),
  ('TLL-STO',  'PORT_CHECKIN', 'PORT_CHECKIN_TLL'),
  ('TLL-STO',  'CROSSING', 'CROSSING_TLL_STO'),
  ('TLL-STO',  'SE_ROAD', 'SE_ROAD_STO'),
  ('STO-TLL',  'PL_ROAD', 'SE_ROAD_STO'),
  ('STO-TLL',  'PORT_CHECKIN', 'PORT_CHECKIN_TLL'),
  ('STO-TLL',  'CROSSING', 'CROSSING_STO_TLL'),
  ('STO-TLL',  'SE_ROAD', 'PL_ROAD_EE'),
  ('PLD-KPS',  'PL_ROAD', 'PL_ROAD_EE'),
  ('PLD-KPS',  'PORT_CHECKIN', 'PORT_CHECKIN_PLD'),
  ('PLD-KPS',  'CROSSING', 'CROSSING_PLD_KPS'),
  ('PLD-KPS',  'SE_ROAD', 'SE_ROAD_KPS'),
  ('KPS-PLD',  'PL_ROAD', 'SE_ROAD_KPS'),
  ('KPS-PLD',  'PORT_CHECKIN', 'PORT_CHECKIN_PLD'),
  ('KPS-PLD',  'CROSSING', 'CROSSING_KPS_PLD'),
  ('KPS-PLD',  'SE_ROAD', 'PL_ROAD_EE'),
  ('TALLINK',  'PL_ROAD', 'PL_ROAD_EE'),
  ('TALLINK',  'PORT_CHECKIN', 'PORT_CHECKIN_TLL'),
  ('TALLINK',  'CROSSING', 'CROSSING_TLL_HEL'),
  ('TALLINK',  'SE_ROAD', 'FI_ROAD'),
  ('ECKERO',   'PL_ROAD', 'PL_ROAD_EE'),
  ('ECKERO',   'PORT_CHECKIN', 'PORT_CHECKIN_MUU'),
  ('ECKERO',   'CROSSING', 'CROSSING_MUU_VUO'),
  ('ECKERO',   'SE_ROAD', 'FI_ROAD'),
  ('DFDS',     'PL_ROAD', 'PL_ROAD_EE'),
  ('DFDS',     'PORT_CHECKIN', 'PORT_CHECKIN_PLD'),
  ('DFDS',     'CROSSING', 'CROSSING_PLD_KPS'),
  ('DFDS',     'SE_ROAD', 'SE_ROAD_KPS')
on conflict (route_key, segment_role) do update
  set segment_code = excluded.segment_code;

-- ---------------------------------------------------------------------------
-- 4) ferry_routes.road_corridor_pre/post = kody legów (FK)
-- ---------------------------------------------------------------------------
alter table public.ferry_routes
  drop constraint if exists ferry_routes_road_corridor_pre_fkey;
alter table public.ferry_routes
  drop constraint if exists ferry_routes_road_corridor_post_fkey;

update public.ferry_routes set road_corridor_pre = 'PL-GDN', road_corridor_post = 'SE-NYN'
 where code in ('GDN-NYN');
update public.ferry_routes set road_corridor_pre = 'SE-NYN', road_corridor_post = 'PL-GDN'
 where code in ('NYN-GDN');
update public.ferry_routes set road_corridor_pre = 'PL-GDY', road_corridor_post = 'SE-KAA'
 where code in ('GDY-KAA');
update public.ferry_routes set road_corridor_pre = 'SE-KAA', road_corridor_post = 'PL-GDY'
 where code in ('KAA-GDY');
update public.ferry_routes set road_corridor_pre = 'PL-TLL', road_corridor_post = 'FI-HEL'
 where code in ('TLL-HEL', 'TLLA-HEL');
update public.ferry_routes set road_corridor_pre = 'FI-HEL', road_corridor_post = 'PL-TLL'
 where code in ('HEL-TLL', 'HELA-TLL');
update public.ferry_routes set road_corridor_pre = 'PL-MUU', road_corridor_post = 'FI-VUO'
 where code = 'MUU-VUO';
update public.ferry_routes set road_corridor_pre = 'FI-VUO', road_corridor_post = 'PL-MUU'
 where code = 'VUO-MUU';
update public.ferry_routes set road_corridor_pre = 'PL-TLL', road_corridor_post = 'SE-STO'
 where code = 'TLL-STO';
update public.ferry_routes set road_corridor_pre = 'SE-STO', road_corridor_post = 'PL-TLL'
 where code = 'STO-TLL';
update public.ferry_routes set road_corridor_pre = 'PL-PLD', road_corridor_post = 'SE-KPS'
 where code = 'PLD-KPS';
update public.ferry_routes set road_corridor_pre = 'SE-KPS', road_corridor_post = 'PL-PLD'
 where code = 'KPS-PLD';

alter table public.ferry_routes
  add constraint ferry_routes_road_corridor_pre_fkey
  foreign key (road_corridor_pre) references public.here_road_legs (leg);
alter table public.ferry_routes
  add constraint ferry_routes_road_corridor_post_fkey
  foreign key (road_corridor_post) references public.here_road_legs (leg);

comment on column public.ferry_routes.road_corridor_pre is
  'BN7: leg HERE przed przeprawą (FK here_road_legs).';
comment on column public.ferry_routes.road_corridor_post is
  'BN7: leg HERE po przeprawie (FK here_road_legs).';

-- ---------------------------------------------------------------------------
-- 5) here_store_road — length_m / duration_s
-- ---------------------------------------------------------------------------
drop function if exists public.here_store_road(text, jsonb, text, timestamptz);

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
    insert into here_road_geometry (leg, points, summary, fetched_at, retry_after, length_m, duration_s)
    values (p_leg, null, left(p_summary, 240), '-infinity'::timestamptz, p_now, null, null)
    on conflict (leg) do update
      set summary = excluded.summary,
          retry_after = excluded.retry_after;
    return;
  end if;
  insert into here_road_geometry (leg, points, summary, fetched_at, retry_after, length_m, duration_s)
  values (p_leg, p_points, left(p_summary, 240), p_now, null, p_length_m, p_duration_s)
  on conflict (leg) do update
    set points = excluded.points,
        summary = excluded.summary,
        fetched_at = excluded.fetched_at,
        retry_after = null,
        length_m = excluded.length_m,
        duration_s = excluded.duration_s;
end;
$$;

revoke all on function public.here_store_road(text, jsonb, text, timestamptz, double precision, double precision)
  from public, anon, authenticated;
grant execute on function public.here_store_road(text, jsonb, text, timestamptz, double precision, double precision)
  to service_role;

-- ---------------------------------------------------------------------------
-- 6) map_display_state + route_legs
-- ---------------------------------------------------------------------------
create or replace function public.map_display_state()
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_roads jsonb;
  v_route_legs jsonb;
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
    'map_group', l.map_group,
    'cron_fetch', l.cron_fetch,
    'via_points', l.via_points,
    'min_km', l.min_km,
    'max_km', l.max_km,
    'length_m', g.length_m,
    'duration_s', g.duration_s
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

  return jsonb_build_object(
    'tiles_open', public.here_tiles_open(now()),
    'month', (date_trunc('month', now() at time zone 'Europe/Warsaw'))::date,
    'h6', public.h6_map_enabled(),
    'roads', v_roads,
    'route_legs', v_route_legs
  );
end;
$$;

revoke all on function public.map_display_state() from public, anon;
grant execute on function public.map_display_state() to authenticated;

comment on function public.map_display_state() is
  'BN7/#667: roads + route_legs (ferry_routes→legi HERE); cron_fetch=false do frontu koordynatora.';

commit;
