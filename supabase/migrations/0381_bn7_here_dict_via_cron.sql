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
  add column if not exists cron_fetch boolean not null default false;

-- F7 #738 B2: default false (także gdy kolumna już istniała z default true).
alter table public.here_road_legs
  alter column cron_fetch set default false;

comment on column public.here_road_legs.via_points is
  'BN7: [[lat,lng],…] passThrough HERE; puste = bez via (kaa bierze z korytarza).';
comment on column public.here_road_legs.min_km is
  'BN7 dict: min. długość linii HERE [km].';
comment on column public.here_road_legs.max_km is
  'BN7 dict: max. długość linii HERE [km].';
comment on column public.here_road_legs.cron_fetch is
  'BN7: cron here-roads bierze leg tylko gdy true (DP-55); default false; core = true.';

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
  min_km = 1250, max_km = 1500,
  corridor_code = 'PL_EE_E67',
  summary = 'Trasa drogowa Śrem–Tallinn (Terminal D)'
where leg = 'PL-TLL';

update public.here_road_legs set
  spec = 'dict', cron_fetch = false, browser_fetch = false,
  via_points = '[
    [53.13,23.16],[54.10,22.93],[54.90,23.90],
    [56.41,24.19],[57.87,24.36],[58.39,24.50]
  ]'::jsonb,
  min_km = 1250, max_km = 1500,
  corridor_code = 'PL_EE_E67',
  summary = 'Trasa drogowa Śrem–Muuga'
where leg = 'PL-MUU';

update public.here_road_legs set
  spec = 'dict', cron_fetch = false, browser_fetch = false,
  via_points = '[
    [53.13,23.16],[54.10,22.93],[54.90,23.90],
    [56.41,24.19],[57.87,24.36],[58.39,24.50]
  ]'::jsonb,
  min_km = 1300, max_km = 1450,
  corridor_code = 'PL_EE_E67',
  summary = 'Trasa drogowa Śrem–Paldiski'
where leg = 'PL-PLD';

update public.here_road_legs set
  spec = 'dict', cron_fetch = false, browser_fetch = false,
  via_points = '[
    [62.24,25.75],[65.01,25.47],[65.85,24.15],[65.85,23.15]
  ]'::jsonb,
  min_km = 880, max_km = 950,
  corridor_code = 'FI_E75',
  summary = 'Trasa drogowa Helsinki–Boden (oba terminale)'
where leg = 'FI-HEL';

update public.here_road_legs set
  spec = 'dict', cron_fetch = false, browser_fetch = false,
  via_points = '[
    [62.24,25.75],[65.01,25.47],[65.85,24.15],[65.85,23.15]
  ]'::jsonb,
  min_km = 880, max_km = 950,
  corridor_code = 'FI_E75',
  summary = 'Trasa drogowa Vuosaari–Boden'
where leg = 'FI-VUO';

update public.here_road_legs set
  spec = 'dict', cron_fetch = false, browser_fetch = false,
  via_points = '[
    [59.86,17.64],[60.67,17.14],[62.39,17.31],[63.83,20.26]
  ]'::jsonb,
  min_km = 950, max_km = 1050,
  corridor_code = 'SE_E4_STO',
  summary = 'Trasa drogowa Sztokholm–Boden'
where leg = 'SE-STO';

update public.here_road_legs set
  spec = 'dict', cron_fetch = false, browser_fetch = false,
  via_points = '[
    [59.76,18.70],[59.86,17.64],[60.67,17.14],[62.39,17.31],[63.83,20.26]
  ]'::jsonb,
  min_km = 950, max_km = 1050,
  corridor_code = 'SE_E18_KPS',
  summary = 'Trasa drogowa Kapellskär–Boden'
where leg = 'SE-KPS';

-- core: jawne cron_fetch=true (default kolumny = false — F7 #738 B2)
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

-- PL→EE E67 (Śrem → A2 → S8 → S61 Budzisko → E67 → Tallinn; ≤15 km)
-- F7 #738 B4: trasa A2/S8/S61 (nie Poznań→Bydgoszcz); korytarz nadpisany po cron_fetch=true (linia HERE).
with g as (
  select st_setsrid(st_makeline(array[
    st_makepoint(17.0246, 52.0739),
    st_makepoint(17.0023, 52.197),
    st_makepoint(16.98, 52.32),
    st_makepoint(17.175, 52.3217),
    st_makepoint(17.37, 52.3233),
    st_makepoint(17.565, 52.325),
    st_makepoint(17.7175, 52.3075),
    st_makepoint(17.87, 52.29),
    st_makepoint(18.0605, 52.2565),
    st_makepoint(18.251, 52.223),
    st_makepoint(18.4455, 52.2115),
    st_makepoint(18.64, 52.2),
    st_makepoint(18.8267, 52.1933),
    st_makepoint(19.0133, 52.1867),
    st_makepoint(19.2, 52.18),
    st_makepoint(19.335, 52.0873),
    st_makepoint(19.47, 51.9947),
    st_makepoint(19.605, 51.902),
    st_makepoint(19.72, 51.968),
    st_makepoint(19.835, 52.034),
    st_makepoint(19.95, 52.1),
    st_makepoint(20.094, 52.1645),
    st_makepoint(20.238, 52.229),
    st_makepoint(20.4035, 52.2343),
    st_makepoint(20.569, 52.2395),
    st_makepoint(20.7345, 52.2447),
    st_makepoint(20.9, 52.25),
    st_makepoint(21.01, 52.285),
    st_makepoint(21.12, 52.32),
    st_makepoint(21.18, 52.42),
    st_makepoint(21.319, 52.506),
    st_makepoint(21.458, 52.592),
    st_makepoint(21.6037, 52.662),
    st_makepoint(21.7493, 52.732),
    st_makepoint(21.895, 52.802),
    st_makepoint(22.011, 52.863),
    st_makepoint(22.127, 52.924),
    st_makepoint(22.243, 52.985),
    st_makepoint(22.4272, 53.0144),
    st_makepoint(22.6114, 53.0438),
    st_makepoint(22.7956, 53.0732),
    st_makepoint(22.9798, 53.1026),
    st_makepoint(23.164, 53.132),
    st_makepoint(23.041, 53.223),
    st_makepoint(22.918, 53.314),
    st_makepoint(22.797, 53.407),
    st_makepoint(22.8428, 53.516),
    st_makepoint(22.8885, 53.625),
    st_makepoint(22.9342, 53.734),
    st_makepoint(22.98, 53.843),
    st_makepoint(22.9565, 53.972),
    st_makepoint(22.933, 54.101),
    st_makepoint(22.914, 54.203),
    st_makepoint(22.895, 54.305),
    st_makepoint(23.0467, 54.39),
    st_makepoint(23.1983, 54.475),
    st_makepoint(23.35, 54.56),
    st_makepoint(23.4875, 54.645),
    st_makepoint(23.625, 54.73),
    st_makepoint(23.7625, 54.815),
    st_makepoint(23.9, 54.9),
    st_makepoint(23.9625, 55),
    st_makepoint(24.025, 55.1),
    st_makepoint(24.0875, 55.2),
    st_makepoint(24.15, 55.3),
    st_makepoint(24.2, 55.4075),
    st_makepoint(24.25, 55.515),
    st_makepoint(24.3, 55.6225),
    st_makepoint(24.35, 55.73),
    st_makepoint(24.3233, 55.8433),
    st_makepoint(24.2967, 55.9567),
    st_makepoint(24.27, 56.07),
    st_makepoint(24.2433, 56.1833),
    st_makepoint(24.2167, 56.2967),
    st_makepoint(24.19, 56.41),
    st_makepoint(24.172, 56.518),
    st_makepoint(24.154, 56.626),
    st_makepoint(24.136, 56.734),
    st_makepoint(24.118, 56.842),
    st_makepoint(24.1, 56.95),
    st_makepoint(24.175, 57.05),
    st_makepoint(24.25, 57.15),
    st_makepoint(24.325, 57.25),
    st_makepoint(24.4, 57.35),
    st_makepoint(24.39, 57.48),
    st_makepoint(24.38, 57.61),
    st_makepoint(24.37, 57.74),
    st_makepoint(24.36, 57.87),
    st_makepoint(24.395, 58),
    st_makepoint(24.43, 58.13),
    st_makepoint(24.465, 58.26),
    st_makepoint(24.5, 58.39),
    st_makepoint(24.4825, 58.5175),
    st_makepoint(24.465, 58.645),
    st_makepoint(24.4475, 58.7725),
    st_makepoint(24.43, 58.9),
    st_makepoint(24.4946, 59.0074),
    st_makepoint(24.5592, 59.1148),
    st_makepoint(24.6238, 59.2222),
    st_makepoint(24.6884, 59.3296),
    st_makepoint(24.753, 59.437)
  ]), 4326) as geom
)
insert into public.corridor_polylines (code, geom, total_km, source, attribution)
select 'PL_EE_E67', g.geom,
       round((st_length(g.geom::geography) / 1000.0)::numeric, 2),
       'OSM / ODbL — Śrem→A2→S8→S61→E67→Tallinn (BN7; ≤15 km; nadpisanie po cron_fetch)',
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
  -- N2 F7 #738: 2,40 h = mediana rzeczywista VUO→MUU (n=1, SELECT 02.11); nie ujednolicamy do 2,75.
  ('CROSSING_VUO_MUU', 'Przeprawa Vuosaari → Muuga', 2.40, 10,
   'rozkład 60 dni — mediana VUO→MUU n=1 (02.11) — do kalibracji'),
  ('CROSSING_TLL_STO', 'Przeprawa Tallinn → Sztokholm', 17.50, 10,
   'rozkład 60 dni — do kalibracji'),
  ('CROSSING_STO_TLL', 'Przeprawa Sztokholm → Tallinn', 16.50, 10,
   'rozkład 60 dni — do kalibracji'),
  ('CROSSING_PLD_KPS', 'Przeprawa Paldiski → Kapellskär', 10.50, 10,
   'rozkład 60 dni — do kalibracji'),
  ('CROSSING_KPS_PLD', 'Przeprawa Kapellskär → Paldiski', 9.75, 10,
   'rozkład 60 dni — do kalibracji')
-- F7 #738 B5: nie nadpisuj godzin/źródeł już skalibrowanych.
on conflict (code) do nothing;

-- F7 #738 B3: konwencja prod (jak NYN-GDN = te same kody co GDN-NYN); bez zamiany ról
-- na powrotach; bez kluczy operatorskich (TALLINK/ECKERO/DFDS — martwe dla family_key).
delete from public.eta_route_segments
 where route_key in ('TALLINK', 'ECKERO', 'DFDS');

insert into public.eta_route_segments (route_key, segment_role, segment_code) values
  ('TLL-HEL',  'PL_ROAD', 'PL_ROAD_EE'),
  ('TLL-HEL',  'PORT_CHECKIN', 'PORT_CHECKIN_TLL'),
  ('TLL-HEL',  'CROSSING', 'CROSSING_TLL_HEL'),
  ('TLL-HEL',  'SE_ROAD', 'FI_ROAD'),
  ('HEL-TLL',  'PL_ROAD', 'PL_ROAD_EE'),
  ('HEL-TLL',  'PORT_CHECKIN', 'PORT_CHECKIN_TLL'),
  ('HEL-TLL',  'CROSSING', 'CROSSING_TLL_HEL'),
  ('HEL-TLL',  'SE_ROAD', 'FI_ROAD'),
  ('TLLA-HEL', 'PL_ROAD', 'PL_ROAD_EE'),
  ('TLLA-HEL', 'PORT_CHECKIN', 'PORT_CHECKIN_TLL'),
  ('TLLA-HEL', 'CROSSING', 'CROSSING_TLL_HEL'),
  ('TLLA-HEL', 'SE_ROAD', 'FI_ROAD'),
  ('HELA-TLL', 'PL_ROAD', 'PL_ROAD_EE'),
  ('HELA-TLL', 'PORT_CHECKIN', 'PORT_CHECKIN_TLL'),
  ('HELA-TLL', 'CROSSING', 'CROSSING_TLL_HEL'),
  ('HELA-TLL', 'SE_ROAD', 'FI_ROAD'),
  ('MUU-VUO',  'PL_ROAD', 'PL_ROAD_EE'),
  ('MUU-VUO',  'PORT_CHECKIN', 'PORT_CHECKIN_MUU'),
  ('MUU-VUO',  'CROSSING', 'CROSSING_MUU_VUO'),
  ('MUU-VUO',  'SE_ROAD', 'FI_ROAD'),
  ('VUO-MUU',  'PL_ROAD', 'PL_ROAD_EE'),
  ('VUO-MUU',  'PORT_CHECKIN', 'PORT_CHECKIN_MUU'),
  ('VUO-MUU',  'CROSSING', 'CROSSING_MUU_VUO'),
  ('VUO-MUU',  'SE_ROAD', 'FI_ROAD'),
  ('TLL-STO',  'PL_ROAD', 'PL_ROAD_EE'),
  ('TLL-STO',  'PORT_CHECKIN', 'PORT_CHECKIN_TLL'),
  ('TLL-STO',  'CROSSING', 'CROSSING_TLL_STO'),
  ('TLL-STO',  'SE_ROAD', 'SE_ROAD_STO'),
  ('STO-TLL',  'PL_ROAD', 'PL_ROAD_EE'),
  ('STO-TLL',  'PORT_CHECKIN', 'PORT_CHECKIN_TLL'),
  ('STO-TLL',  'CROSSING', 'CROSSING_TLL_STO'),
  ('STO-TLL',  'SE_ROAD', 'SE_ROAD_STO'),
  ('PLD-KPS',  'PL_ROAD', 'PL_ROAD_EE'),
  ('PLD-KPS',  'PORT_CHECKIN', 'PORT_CHECKIN_PLD'),
  ('PLD-KPS',  'CROSSING', 'CROSSING_PLD_KPS'),
  ('PLD-KPS',  'SE_ROAD', 'SE_ROAD_KPS'),
  ('KPS-PLD',  'PL_ROAD', 'PL_ROAD_EE'),
  ('KPS-PLD',  'PORT_CHECKIN', 'PORT_CHECKIN_PLD'),
  ('KPS-PLD',  'CROSSING', 'CROSSING_PLD_KPS'),
  ('KPS-PLD',  'SE_ROAD', 'SE_ROAD_KPS')
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
