-- BN1 (#573 / #640): słowniki armatorów, portów i tras promowych + strefy bałtyckie.
-- Zachowanie Stena/Polferries bez zmian (regresja = bloker). CASE-y w funkcjach ETA/AIS
-- i front FerryRoute → kolejne kroki tej pozycji (po słownikach).
-- Współrzędne terminali: publiczne (orientacyjne, jak 0119 Stena).

begin;

-- ---------------------------------------------------------------------------
-- 1) Słowniki
-- ---------------------------------------------------------------------------
create table if not exists public.ferry_operators (
  code        text primary key
    check (code ~ '^[A-Z][A-Z0-9_]{0,31}$'),
  name        text not null,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

comment on table public.ferry_operators is
  'BN1: armatorzy promów (STENA, POLFERRIES, TALLINK, …).';

create table if not exists public.ferry_ports (
  code        text primary key
    check (code ~ '^[A-Z][A-Z0-9_]{0,31}$'),
  name        text not null,
  terminal    text,
  country     char(2) not null
    check (country ~ '^[A-Z]{2}$'),
  lat         double precision not null,
  lon         double precision not null,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  check (lat between -90 and 90),
  check (lon between -180 and 180)
);

comment on table public.ferry_ports is
  'BN1: porty / terminale (kraj = ląd przed/po przeprawie).';

create table if not exists public.ferry_routes (
  code              text primary key
    check (code ~ '^[A-Z][A-Z0-9_-]{0,62}$'),
  port_from         text not null references public.ferry_ports(code),
  port_to           text not null references public.ferry_ports(code),
  family_key        text not null
    check (family_key ~ '^[A-Z][A-Z0-9_-]{0,62}$'),
  road_corridor_pre text,
  road_corridor_post text,
  active            boolean not null default true,
  notes             text,
  created_at        timestamptz not null default now(),
  check (port_from is distinct from port_to)
);

comment on table public.ferry_routes is
  'BN1: trasy AAA-BBB; family_key = kanoniczna rodzina (jak eta_route_aliases.route_key).';

create table if not exists public.ferry_route_operators (
  route_code     text not null references public.ferry_routes(code) on delete cascade,
  operator_code  text not null references public.ferry_operators(code),
  is_primary     boolean not null default false,
  primary key (route_code, operator_code)
);

comment on table public.ferry_route_operators is
  'BN1: armatorzy na trasie; TLL-HEL = operator×terminal (Tallink D vs Viking/Eckerö A).';

alter table public.ferry_operators enable row level security;
alter table public.ferry_ports enable row level security;
alter table public.ferry_routes enable row level security;
alter table public.ferry_route_operators enable row level security;

revoke all on public.ferry_operators from public, anon, authenticated;
revoke all on public.ferry_ports from public, anon, authenticated;
revoke all on public.ferry_routes from public, anon, authenticated;
revoke all on public.ferry_route_operators from public, anon, authenticated;

grant select on public.ferry_operators to authenticated;
grant select on public.ferry_ports to authenticated;
grant select on public.ferry_routes to authenticated;
grant select on public.ferry_route_operators to authenticated;

grant select, insert, update, delete on public.ferry_operators to service_role;
grant select, insert, update, delete on public.ferry_ports to service_role;
grant select, insert, update, delete on public.ferry_routes to service_role;
grant select, insert, update, delete on public.ferry_route_operators to service_role;

-- Jak 0028: zdezaktywowany JWT nie czyta słowników (session.sh t_visible_rows = 0).
drop policy if exists ferry_operators_read on public.ferry_operators;
create policy ferry_operators_read on public.ferry_operators
  for select to authenticated using (current_app_role() is not null);

drop policy if exists ferry_ports_read on public.ferry_ports;
create policy ferry_ports_read on public.ferry_ports
  for select to authenticated using (current_app_role() is not null);

drop policy if exists ferry_routes_read on public.ferry_routes;
create policy ferry_routes_read on public.ferry_routes
  for select to authenticated using (current_app_role() is not null);

drop policy if exists ferry_route_operators_read on public.ferry_route_operators;
create policy ferry_route_operators_read on public.ferry_route_operators
  for select to authenticated using (current_app_role() is not null);

-- ---------------------------------------------------------------------------
-- 2) Seed: armatorzy
-- ---------------------------------------------------------------------------
insert into public.ferry_operators (code, name) values
  ('POLFERRIES', 'Polferries'),
  ('STENA',      'Stena Line'),
  ('TALLINK',    'Tallink'),
  ('VIKING',     'Viking Line'),
  ('ECKERO',     'Eckerö Line'),
  ('DFDS',       'DFDS')
on conflict (code) do update set name = excluded.name, active = true;

-- ---------------------------------------------------------------------------
-- 3) Seed: porty (istniejące + bałtyckie)
-- ---------------------------------------------------------------------------
-- Współrzędne GDN/NYN jak 0017 (terminal); Paldiski = South Harbour (F7 B6).
-- on conflict do nothing — nie nadpisuj zmian HHL (F7).
insert into public.ferry_ports (code, name, terminal, country, lat, lon) values
  ('GDN', 'Gdańsk',           'Polferries',              'PL', 54.40372, 18.68130),
  ('GDY', 'Gdynia',           'Stena Line',              'PL', 54.53321, 18.54425),
  ('NYN', 'Nynäshamn',        null,                      'SE', 58.90453, 17.95621),
  ('KAA', 'Karlskrona',       'Stena Line',              'SE', 56.16460, 15.63080),
  -- A = Viking/Eckerö (zachód); D = Tallink (wschód Old City Harbour, F7).
  ('TLL_A', 'Tallinn',        'Terminal A',              'EE', 59.44400, 24.76800),
  ('TLL_D', 'Tallinn',        'Terminal D',              'EE', 59.44000, 24.77500),
  ('MUU', 'Muuga',            'HHLA',                    'EE', 59.50500, 24.95800),
  ('PLD', 'Paldiski',         'South Harbour',           'EE', 59.33300, 24.08300),
  ('HEL_T2', 'Helsinki',      'West Harbour T2',         'FI', 60.15400, 24.91400),
  ('HEL_KAT', 'Helsinki',     'Katajanokka',             'FI', 60.16600, 24.96800),
  ('VUO', 'Vuosaari',         null,                      'FI', 60.21200, 25.18800),
  ('STO', 'Stockholm',        'Värtahamnen',             'SE', 59.35000, 18.11000),
  ('KPS', 'Kapellskär',       null,                      'SE', 59.72300, 19.06600),
  ('MHN', 'Mariehamn',        null,                      'AX', 60.09700, 19.92800)
on conflict (code) do nothing;

-- ---------------------------------------------------------------------------
-- 4) Seed: trasy + armatorzy
-- ---------------------------------------------------------------------------
insert into public.ferry_routes (code, port_from, port_to, family_key, notes) values
  ('GDN-NYN', 'GDN', 'NYN', 'GDN-NYN', 'Polferries'),
  ('NYN-GDN', 'NYN', 'GDN', 'GDN-NYN', 'Polferries powrót'),
  ('GDY-KAA', 'GDY', 'KAA', 'GDY-KAA', 'Stena Line'),
  ('KAA-GDY', 'KAA', 'GDY', 'GDY-KAA', 'Stena Line powrót'),
  -- TLL-HEL = operator×terminal (F7): Tallink D→T2; Viking/Eckerö A→Katajanokka.
  ('TLL-HEL',  'TLL_D',  'HEL_T2',  'TLL-HEL', 'Tallink Terminal D → West Harbour T2'),
  ('TLLA-HEL', 'TLL_A',  'HEL_KAT', 'TLL-HEL', 'Viking/Eckerö Terminal A → Katajanokka'),
  ('HEL-TLL',  'HEL_T2', 'TLL_D',   'TLL-HEL', null),
  ('HELA-TLL', 'HEL_KAT','TLL_A',   'TLL-HEL', null),
  ('MUU-VUO', 'MUU', 'VUO', 'MUU-VUO', 'Finbo Cargo'),
  ('VUO-MUU', 'VUO', 'MUU', 'MUU-VUO', null),
  ('TLL-STO', 'TLL_D', 'STO', 'TLL-STO', 'przez Mariehamn'),
  ('STO-TLL', 'STO', 'TLL_D', 'TLL-STO', null),
  ('PLD-KPS', 'PLD', 'KPS', 'PLD-KPS', 'DFDS'),
  ('KPS-PLD', 'KPS', 'PLD', 'PLD-KPS', null)
on conflict (code) do update set
  port_from = excluded.port_from,
  port_to = excluded.port_to,
  family_key = excluded.family_key,
  notes = excluded.notes,
  active = true;

insert into public.ferry_route_operators (route_code, operator_code, is_primary) values
  ('GDN-NYN', 'POLFERRIES', true),
  ('NYN-GDN', 'POLFERRIES', true),
  ('GDY-KAA', 'STENA', true),
  ('KAA-GDY', 'STENA', true),
  ('TLL-HEL',  'TALLINK', true),
  ('TLLA-HEL', 'VIKING',  true),
  ('TLLA-HEL', 'ECKERO',  false),
  ('HEL-TLL',  'TALLINK', true),
  ('HELA-TLL', 'VIKING',  true),
  ('HELA-TLL', 'ECKERO',  false),
  ('MUU-VUO', 'ECKERO', true),
  ('VUO-MUU', 'ECKERO', true),
  ('TLL-STO', 'TALLINK', true),
  ('STO-TLL', 'TALLINK', true),
  ('PLD-KPS', 'DFDS', true),
  ('KPS-PLD', 'DFDS', true)
on conflict (route_code, operator_code) do update set is_primary = excluded.is_primary;

-- F7 B5: BEZ self-aliasów bałtyckich (alias_key = route_key).
-- compute_load_eta „założony rejs” bierze alias_key = route_key — self-alias
-- TLL-HEL wpuściłby rejs Tallinka do ładunku Stena/Polferries bez rejsu.
-- Kierunki i nazwy armatorów (alias ≠ route_key) — OK dla ferry_route_primary_operator.
insert into public.eta_route_aliases (alias_key, route_key, operator) values
  ('HEL-TLL',  'TLL-HEL', 'TALLINK'),
  ('HELA-TLL', 'TLL-HEL', 'VIKING'),
  ('TLLA-HEL', 'TLL-HEL', 'VIKING'),
  ('TALLINK',  'TLL-HEL', 'TALLINK'),
  ('VUO-MUU',  'MUU-VUO', 'ECKERO'),
  ('ECKERO',   'MUU-VUO', 'ECKERO'),
  ('STO-TLL',  'TLL-STO', 'TALLINK'),
  ('KPS-PLD',  'PLD-KPS', 'DFDS'),
  ('DFDS',     'PLD-KPS', 'DFDS'),
  ('VIKING',   'TLL-HEL', 'VIKING')
on conflict (alias_key) do update set
  route_key = excluded.route_key,
  operator = excluded.operator;

-- ---------------------------------------------------------------------------
-- 5) Trasa + źródło rejsu: otwarte na bałtyckie (regex tras jak 0320; + armatorzy)
-- ---------------------------------------------------------------------------
-- Upewnij się, że nie został stary CHECK z zamkniętą listą PL (0004/0119).
do $rte$
declare c name;
begin
  for c in
    select con.conname
      from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
      join pg_namespace n on n.oid = rel.relnamespace
     where n.nspname = 'public' and rel.relname = 'sailings'
       and con.contype = 'c'
       and pg_get_constraintdef(con.oid) ilike '%GDN-NYN%'
       and pg_get_constraintdef(con.oid) ilike '%route%'
       and pg_get_constraintdef(con.oid) not ilike '%~%'
  loop
    execute format('alter table public.sailings drop constraint %I', c);
  end loop;
end $rte$;

alter table public.sailings drop constraint if exists sailings_route_check;
alter table public.sailings
  add constraint sailings_route_check
  check (route ~ '^[A-Z][A-Z0-9_-]{0,62}$');

do $src$
declare c name;
begin
  select con.conname into c
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace n on n.oid = rel.relnamespace
   where n.nspname = 'public' and rel.relname = 'sailings'
     and con.contype = 'c'
     and pg_get_constraintdef(con.oid) ilike '%source%'
     and pg_get_constraintdef(con.oid) ilike '%POLFERRIES%'
   limit 1;
  if c is not null then
    execute format('alter table public.sailings drop constraint %I', c);
  end if;
end $src$;

alter table public.sailings drop constraint if exists sailings_source_check;
alter table public.sailings
  add constraint sailings_source_check
  check (source in (
    'DANE_STARTOWE', 'RECZNIE',
    'POLFERRIES', 'STENA',
    'TALLINK', 'VIKING', 'ECKERO', 'DFDS'
  ));

-- ---------------------------------------------------------------------------
-- 6) Funkcje słownika (rodzina / operator / porty / kraj z trasy)
-- ---------------------------------------------------------------------------
-- Rodzina trasy: najpierw ferry_routes.family_key (TLLA-HEL→TLL-HEL), potem aliasy.
-- Bez tego Viking/Eckerö (TLLA-HEL) nie trafiają w strefy z route=TLL-HEL.
create or replace function public.eta_obs_route_family(p_route text)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when p_route is null or btrim(p_route) = '' then null
    else coalesce(
      (select fr.family_key
         from ferry_routes fr
        where fr.code = upper(btrim(p_route))
           or fr.family_key = upper(btrim(p_route))
        order by case when fr.code = upper(btrim(p_route)) then 0 else 1 end
        limit 1),
      (select a.route_key from eta_route_aliases a
        where a.alias_key = upper(btrim(p_route))),
      upper(btrim(p_route))
    )
  end;
$$;

comment on function public.eta_obs_route_family(text) is
  'BN1: kanoniczna rodzina trasy — ferry_routes.family_key, potem eta_route_aliases.';

revoke all on function public.eta_obs_route_family(text) from public, anon, authenticated;
grant execute on function public.eta_obs_route_family(text) to service_role;

-- Model A (bałtyk): geofences.route = kod/rodzina (TLL-HEL). Model B (PL): armator.
-- Dopasowanie zawsze po rodzinie trasy ładunku — nie po primary operator
-- (Viking/Eckerö na TLLA-HEL; Tallink też TLL-STO ≠ TLL-HEL).
create or replace function public.ferry_geofence_matches_route(
  p_fence_route text,
  p_load_route text
) returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when p_load_route is null or btrim(p_load_route) = '' then
      public.eta_obs_route_family(coalesce(nullif(btrim(p_fence_route), ''), 'POLFERRIES'))
        = public.eta_obs_route_family('POLFERRIES')
    else
      public.eta_obs_route_family(coalesce(nullif(btrim(p_fence_route), ''), 'POLFERRIES'))
        = public.eta_obs_route_family(p_load_route)
  end;
$$;

comment on function public.ferry_geofence_matches_route(text, text) is
  'BN1: strefa portowa pasuje do rejsu po rodzinie trasy (nie po primary operator).';

revoke all on function public.ferry_geofence_matches_route(text, text)
  from public, anon, authenticated;
grant execute on function public.ferry_geofence_matches_route(text, text) to service_role;

create or replace function public.ferry_route_primary_operator(p_route text)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select fro.operator_code
       from ferry_routes fr
       join ferry_route_operators fro on fro.route_code = fr.code and fro.is_primary
      where fr.code = upper(btrim(p_route))
         or fr.family_key = upper(btrim(p_route))
      order by case when fr.code = upper(btrim(p_route)) then 0 else 1 end
      limit 1),
    (select a.operator from eta_route_aliases a where a.alias_key = upper(btrim(p_route))),
    (select a.operator from eta_route_aliases a
      where a.route_key = public.eta_obs_route_family(p_route) limit 1),
    upper(btrim(p_route))
  );
$$;

comment on function public.ferry_route_primary_operator(text) is
  'BN1: główny armator trasy ze słownika ferry_*; fallback eta_route_aliases.';

revoke all on function public.ferry_route_primary_operator(text) from public, anon, authenticated;
grant execute on function public.ferry_route_primary_operator(text) to service_role;

create or replace function public.eta_obs_operator_key(p_route text)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.ferry_route_primary_operator(p_route);
$$;

revoke all on function public.eta_obs_operator_key(text) from public, anon, authenticated;
grant execute on function public.eta_obs_operator_key(text) to service_role;

create or replace function public.ferry_route_port_countries(p_route text)
returns table(country_from char(2), country_to char(2), port_from text, port_to text)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  -- Jak ferry_track_sample (0268): bez app_users → 42501 (nullguard GUARD).
  if public.current_app_user_id() is null then
    raise exception 'Brak aktywnego konta' using errcode = '42501';
  end if;
  return query
  select pf.country, pt.country, fr.port_from, fr.port_to
    from ferry_routes fr
    join ferry_ports pf on pf.code = fr.port_from
    join ferry_ports pt on pt.code = fr.port_to
   where fr.code = upper(btrim(p_route))
      or fr.family_key = public.eta_obs_route_family(p_route)
   order by case when fr.code = upper(btrim(p_route)) then 0 else 1 end
   limit 1;
end;
$$;

comment on function public.ferry_route_port_countries(text) is
  'BN1: kraje lądu przed/po przeprawie (zamiast hardcodu PL→SE).';

revoke all on function public.ferry_route_port_countries(text) from public, anon;
grant execute on function public.ferry_route_port_countries(text) to authenticated;
grant execute on function public.ferry_route_port_countries(text) to service_role;

-- Odczyt słownika dla frontu (bez PII)
create or replace function public.ferry_dict_snapshot()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  -- Jak ferry_track_sample (0268): bez app_users → 42501 (nullguard GUARD).
  if public.current_app_user_id() is null then
    raise exception 'Brak aktywnego konta' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'operators', coalesce((
      select jsonb_agg(jsonb_build_object('code', code, 'name', name) order by code)
        from ferry_operators where active
    ), '[]'::jsonb),
    'ports', coalesce((
      select jsonb_agg(jsonb_build_object(
        'code', code, 'name', name, 'terminal', terminal,
        'country', country, 'lat', lat, 'lon', lon
      ) order by code)
        from ferry_ports where active
    ), '[]'::jsonb),
    'routes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'code', fr.code,
        'port_from', fr.port_from,
        'port_to', fr.port_to,
        'family_key', fr.family_key,
        'operators', coalesce((
          select jsonb_agg(fro.operator_code order by fro.is_primary desc, fro.operator_code)
            from ferry_route_operators fro where fro.route_code = fr.code
        ), '[]'::jsonb)
      ) order by fr.code)
        from ferry_routes fr where fr.active
    ), '[]'::jsonb)
  );
end;
$$;

comment on function public.ferry_dict_snapshot() is
  'BN1: słownik tras/portów/armatorów dla UI (RPC).';

revoke all on function public.ferry_dict_snapshot() from public, anon;
grant execute on function public.ferry_dict_snapshot() to authenticated;
grant execute on function public.ferry_dict_snapshot() to service_role;

-- ---------------------------------------------------------------------------
-- 7) Strefy PRE_PORT / PORT_OUT / PORT_IN — porty bałtyckie (jak 0119)
-- ---------------------------------------------------------------------------
-- 0004: country tylko PL/SE/LT/DE — BN1 dokłada EE/FI (Estonia/Finlandia).
do $geo_cty$
declare
  c name;
begin
  select con.conname into c
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace n on n.oid = rel.relnamespace
   where n.nspname = 'public' and rel.relname = 'geofences'
     and con.contype = 'c'
     and pg_get_constraintdef(con.oid) ilike '%country%'
     and pg_get_constraintdef(con.oid) ilike '%PL%'
   limit 1;
  if c is not null then
    execute format('alter table public.geofences drop constraint %I', c);
  end if;
end $geo_cty$;

-- F7 B1: ISO-2 (EE/FI/AX…); produkcja miała tylko PL/SE/LT/DE.
alter table public.geofences
  drop constraint if exists geofences_country_check;
alter table public.geofences
  add constraint geofences_country_check
  check (country is null or country ~ '^[A-Z]{2}$');

insert into public.geofences (
  project_id, name, kind, geom, hysteresis_m, dwell_seconds, debounce_fixes,
  notify_enter, country, route
)
select p.id, z.name, z.kind::geofence_kind, make_circle_fence(z.lat, z.lon, z.r),
       z.hyst, z.dwell, 2, true, z.country, z.route
  from projects p,
       (values
         -- Tallinn A (Viking/Eckerö → FI); r=250 — rozłączne z D (~590 m)
         ('Bufor 20 km przed Tallinn A',       'PRE_PORT', 59.44400, 24.76800, 20000, 500, 0,   'EE', 'TLL-HEL'),
         ('Terminal Tallinn A',                'PORT_OUT', 59.44400, 24.76800,   250, 100, 900, 'EE', 'TLL-HEL'),
         -- Tallinn D Tallink → HEL (F7: 59.440/24.775)
         ('Bufor 20 km przed Tallinn D HEL',   'PRE_PORT', 59.44000, 24.77500, 20000, 500, 0,   'EE', 'TLL-HEL'),
         ('Terminal Tallinn D HEL',            'PORT_OUT', 59.44000, 24.77500,   250, 100, 900, 'EE', 'TLL-HEL'),
         -- Tallinn D Tallink → STO
         ('Bufor 20 km przed Tallinn D',       'PRE_PORT', 59.44000, 24.77500, 20000, 500, 0,   'EE', 'TLL-STO'),
         ('Terminal Tallinn D',                'PORT_OUT', 59.44000, 24.77500,   250, 100, 900, 'EE', 'TLL-STO'),
         -- Muuga
         ('Bufor 20 km przed Muuga',           'PRE_PORT', 59.50500, 24.95800, 20000, 500, 0,   'EE', 'MUU-VUO'),
         ('Terminal Muuga HHLA',               'PORT_OUT', 59.50500, 24.95800,   800, 200, 900, 'EE', 'MUU-VUO'),
         -- Paldiski South Harbour (F7 B6)
         ('Bufor 20 km przed Paldiski',        'PRE_PORT', 59.33300, 24.08300, 20000, 500, 0,   'EE', 'PLD-KPS'),
         ('Terminal Paldiski',                 'PORT_OUT', 59.33300, 24.08300,   800, 200, 900, 'EE', 'PLD-KPS'),
         -- Helsinki T2 / Katajanokka
         ('Terminal Helsinki West Harbour T2', 'PORT_IN',  60.15400, 24.91400,   800, 200, 600, 'FI', 'TLL-HEL'),
         ('Terminal Helsinki Katajanokka',     'PORT_IN',  60.16600, 24.96800,   800, 200, 600, 'FI', 'TLL-HEL'),
         -- Vuosaari
         ('Terminal Vuosaari',                 'PORT_IN',  60.21200, 25.18800,   800, 200, 600, 'FI', 'MUU-VUO'),
         -- Stockholm Värtahamnen / Kapellskär
         ('Terminal Stockholm Värtahamnen',    'PORT_IN',  59.35000, 18.11000,   800, 200, 600, 'SE', 'TLL-STO'),
         ('Terminal Kapellskär',               'PORT_IN',  59.72300, 19.06600,   800, 200, 600, 'SE', 'PLD-KPS')
       ) as z(name, kind, lat, lon, r, hyst, dwell, country, route)
 -- CI seed: code=STEGRA; produkcja: STEGRA_BODEN (jak 0304).
 where p.code in ('STEGRA_BODEN', 'STEGRA')
   and not exists (
     select 1 from geofences g
      where g.project_id = p.id and g.name = z.name
   );

-- ---------------------------------------------------------------------------
-- 8) Status / ETA: filtr stref po rodzinie trasy (nie primary operator)
-- ---------------------------------------------------------------------------
-- generated patches for BN1 route-family geofence match

create or replace function public.apply_geofence_status()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_kind    geofence_kind;
  v_gid     uuid;
  v_country char(2);
  v_name    text;
  v_status  load_status;
  v_detail  jsonb;
  v_entered timestamptz;
  v_dwell_min numeric;
  v_project uuid;
  v_title   text;
  v_code    text;
  v_route   text;
  v_op      text;
  v_load_route text;
  v_gaps    jsonb;
  v_gaps_txt text;
  v_dep     timestamptz;
  v_prev    text;
begin
  select status, project_id into v_status, v_project from loads where id = new.load_id;
  if v_status in ('CANCELLED','UNLOADED','DELIVERED','READY_TO_INVOICE','INVOICED') then
    return null;
  end if;
  begin
    v_gid := (new.payload->>'geofence_id')::uuid;
  exception when others then
    return null;
  end;
  select g.kind, g.country, g.name, g.route into v_kind, v_country, v_name, v_route
    from geofences g where g.id = v_gid;
  if v_kind is null then return null; end if;
  v_op := 'POLFERRIES';
  v_load_route := null;
  select public.eta_obs_operator_key(s.route), s.route
    into v_op, v_load_route from loads l left join sailings s on s.id = l.sailing_id
   where l.id = new.load_id;
  v_op := coalesce(v_op, 'POLFERRIES');

  if coalesce(new.payload->>'synthetic', '') = 'true'
     or coalesce((new.payload->>'actual_load')::boolean, true) is false then
    return null;
  end if;

  v_detail := jsonb_build_object(
    'geofence_id', new.payload->>'geofence_id',
    'geofence_kind', v_kind,
    'geofence_name', coalesce(nullif(new.payload->>'geofence_name', ''), v_name),
    'zdarzenie', new.event_type,
    'source', 'GPS'
  );

  if new.event_type = 'GEOFENCE_ENTER' then

    if v_kind = 'LOADING'
       and v_status in ('PLANNED','RESOURCES_PENDING','DOCS_PENDING','READY') then
      v_gaps := public.awiz_missing(new.load_id);
      if v_status is distinct from 'READY'
         or exists (
           select 1
             from jsonb_array_elements(coalesce(v_gaps, '[]'::jsonb)) g
            where g->>'kind' in ('ORDER_SCX', 'ORDER_HHL')
         ) then
        v_gaps_txt := public.a10_prep_gaps_text(v_gaps);
        perform raise_risk(new.load_id, 'AUTO_STATUS', 'HIGH',
          case when coalesce(v_gaps_txt, '') = '' then
            format('Załadunek bez gotowości (status %s)', v_status)
          else
            format('Załadunek bez gotowości: %s', v_gaps_txt)
          end,
          v_detail || jsonb_build_object(
            'title_key', 'rk_loading_not_ready',
            'params', jsonb_build_object('status', v_status, 'gaps', coalesce(v_gaps_txt, '')),
            'gaps', v_gaps
          ),
          'LOADING_NOT_READY:' || new.load_id);
      end if;
      perform auto_set_status(new.load_id, v_status, 'AT_LOADING',
        'wjazd w strefę załadunku', new.occurred_at, v_detail);

    elsif v_kind = 'PORT_OUT'
          and public.load_status_rank(v_status) >= public.load_status_rank('READY')
          and public.load_status_rank(v_status) <= public.load_status_rank('IN_TRANSIT_PL')
          and public.ferry_geofence_matches_route(v_route, v_load_route) then
      if auto_set_status(new.load_id, v_status, 'AT_PORT_GDANSK',
           format('wjazd w strefę portu PL (%s)', coalesce(v_name, v_op)),
           new.occurred_at, v_detail)
         and loaded_confirmed(new.load_id) is not true then
        perform raise_risk(new.load_id, 'LOADING_UNCONFIRMED', 'MEDIUM',
          format('Pojazd w porcie PL (%s) bez potwierdzenia załadunku', coalesce(v_name, v_op)),
          v_detail || jsonb_build_object('title_key', 'rk_port_no_loaded', 'params', '{}'::jsonb),
          'PORT_NO_LOADED:' || new.load_id);
      end if;

    elsif v_kind = 'PORT_IN'
          and public.load_status_rank(v_status) < public.load_status_rank('AT_PORT_NYNASHAMN')
          and public.load_status_rank(v_status) >= public.load_status_rank('AT_LOADING')
          and public.ferry_geofence_matches_route(v_route, v_load_route) then
      if v_status is distinct from 'FERRY' then
        select coalesce(s.delayed_departure_at, s.departure_at) into v_dep
          from loads l left join sailings s on s.id = l.sailing_id
         where l.id = new.load_id;
        v_prev := current_setting('tower.bulk_quiet', true);
        perform set_config('tower.bulk_quiet', 'on', true);
        perform auto_set_status(
          new.load_id, v_status, 'FERRY',
          'wjazd do portu SE — uzupełniony status Na promie',
          least(coalesce(v_dep, new.occurred_at), new.occurred_at),
          v_detail || jsonb_build_object(
            'source', 'SCHEDULE',
            'synthetic_ferry', true
          )
        );
        perform set_config('tower.bulk_quiet', coalesce(v_prev, ''), true);
        select status into v_status from loads where id = new.load_id;
      end if;
      if v_status = 'FERRY' then
        perform auto_set_status(new.load_id, v_status, 'AT_PORT_NYNASHAMN',
          format('wjazd w strefę portu SE (%s)', coalesce(v_name, v_op)),
          new.occurred_at, v_detail);
      end if;

    elsif v_kind = 'SITE'
          and public.load_status_rank(v_status) >= public.load_status_rank('AT_LOADING')
          and public.load_status_rank(v_status) < public.load_status_rank('AT_SITE') then
      perform auto_set_status(new.load_id, v_status, 'AT_SITE',
        'wjazd na plac budowy', new.occurred_at, v_detail);

    -- Awaryjnie: GPS zgubił wyjazd z portu SE albo cały pobyt w porcie
    -- (sygnał wraca dopiero na lądzie). Auto na drogach SE nie może być na promie.
    elsif v_kind in ('CHECKPOINT','PRE_ARRIVAL') and v_country = 'SE'
          and v_status in ('FERRY','AT_PORT_NYNASHAMN') then
      perform auto_set_status(new.load_id, v_status, 'IN_TRANSIT_SE',
        'pozycja na trasie SE — wyjazd z portu niezarejestrowany', new.occurred_at, v_detail);
    end if;

  elsif new.event_type = 'GEOFENCE_EXIT' then

    select s.entered_at into v_entered
      from geofence_states s
     where s.load_id = new.load_id and s.geofence_id = v_gid;
    if v_entered is null and new.payload ? 'entered_at' then
      begin
        v_entered := (new.payload->>'entered_at')::timestamptz;
      exception when others then
        v_entered := null;
      end;
    end if;
    if v_entered is not null then
      v_dwell_min := round(extract(epoch from (new.occurred_at - v_entered)) / 60.0);
    elsif new.payload ? 'dwell_min' then
      v_dwell_min := (new.payload->>'dwell_min')::numeric;
    else
      v_dwell_min := null;
    end if;
    if v_dwell_min is not null then
      v_detail := v_detail || jsonb_build_object('dwell_min', v_dwell_min, 'entered_at', v_entered);
    end if;

    if v_kind = 'LOADING' and v_status = 'AT_LOADING' then
      if v_entered is null then
        null;
      elsif v_dwell_min is not null and v_dwell_min >= 5 then
        if auto_set_status(
             new.load_id, v_status, 'IN_TRANSIT_PL',
             'wyjazd ze strefy załadunku po postoju ≥ 5 min',
             new.occurred_at,
             v_detail
           ) then
          perform set_config('tower.status_ctx', 'on', true);
          update loads
             set actual_load_at = coalesce(actual_load_at, new.occurred_at),
                 updated_at = now()
           where id = new.load_id;
        end if;
      end if;

    elsif v_kind = 'SITE' and v_status = 'AT_SITE' then
      if v_dwell_min is not null and v_dwell_min >= 10 then
        if auto_set_status(
             new.load_id, v_status, 'DELIVERED',
             format('wyjazd z placu po %s min', v_dwell_min::int),
             new.occurred_at,
             v_detail
           ) then
          perform set_config('tower.status_ctx', 'on', true);
          update loads
             set actual_delivery_at = coalesce(actual_delivery_at, new.occurred_at),
                 updated_at = now()
           where id = new.load_id;
        end if;
      elsif v_dwell_min is not null and v_dwell_min < 10 then
        select public.load_sms_code(new.load_id) into v_code;
        v_title := format(
          '%s: wyjazd z placu po %s min — czy dostarczono?',
          coalesce(nullif(v_code, ''), 'transport'),
          v_dwell_min::int
        );
        perform decision_open_from_event(
          v_project,
          'DELIVERED_CHECK',
          'L14:' || new.load_id::text || ':' || v_gid::text || ':'
            || to_char(new.occurred_at at time zone 'UTC', 'YYYYMMDDHH24MI'),
          v_title,
          v_detail || jsonb_build_object(
            'exit_at', new.occurred_at,
            'threshold_min', 10,
            'zone', coalesce(nullif(new.payload->>'geofence_name', ''), v_name)
          ),
          new.load_id,
          null
        );
      end if;

    elsif v_kind = 'PORT_IN' and v_status = 'AT_PORT_NYNASHAMN'
          and public.ferry_geofence_matches_route(v_route, v_load_route) then
      perform auto_set_status(new.load_id, v_status, 'IN_TRANSIT_SE',
        format('wyjazd ze strefy portu SE (%s)', coalesce(v_name, v_op)),
        new.occurred_at, v_detail);
    end if;
    -- Wyjazd ze strefy portu Gdańsk po przełączeniu na PROM (statek
    -- odpływa) celowo niczego nie zmienia.
  end if;
  return null;
end $function$;

revoke all on function public.apply_geofence_status() from public, anon, authenticated;

create or replace function public.compute_load_eta(p_load uuid, p_now timestamp with time zone DEFAULT now())
 returns table(eta timestamp with time zone, conf_min integer, basis jsonb)
 language plpgsql
 stable security definer
 set search_path = public, pg_temp
as $function$
declare
  l          record;
  v_sail     record;
  p          record;
  h_pl       numeric; sp_pl numeric;
  h_ci       numeric;
  h_cross    numeric; sp_cross numeric;
  h_se       numeric;
  fresh_h    numeric;
  v_status   load_status;
  v_eta      timestamptz;
  v_var      numeric := 0;
  v_sum      numeric := 0;
  v_comp     jsonb := '[]'::jsonb;
  h_road numeric; sp_road numeric; h_rest numeric; sp_rest numeric; h_brk numeric; sp_brk numeric;
  h_road_eff numeric;
  v_slow     numeric := 1.00;
  v_slow_reason text;
  v_segs     jsonb := '[]'::jsonb;
  v_flags    text[] := '{}';
  v_seg      text;
  v_start    timestamptz;
  v_frac     numeric;
  v_rem      numeric;
  v_dep      timestamptz;
  v_arr      timestamptz;
  v_sail_src text := null;
  v_has      boolean := false;
  g_load geometry; g_pout geometry; g_pin geometry; g_site geometry;
  cp record;
  v_attr text := '© OpenStreetMap contributors';
  v_progress text := 'status';
  v_off numeric;
  v_rem_km numeric;
  v_causes jsonb := '{}'::jsonb;
  v_drive_h numeric := 0;
  v_checkin_h numeric := 0;
  v_rest_h numeric := 0;
  st record;
  sch record;
  v_drive_need numeric;
  v_break_h numeric := 0;
  v_weather_pct numeric := 0;
  v_fresh boolean := false;
  v_alat double precision;
  v_alon double precision;
  v_sog real;
  v_obs timestamptz;
  v_sea_h numeric;
  v_left boolean := false;
  v_h4_rest_spread numeric := 0;
  v_op text;
  v_load_route text;
  v_se_corr text;          -- 27B:C korytarz OSM SE (SE_E22 / inland / SE_E4)
  v_se_road_code text;     -- 27B:C kod godzin SE_ROAD(_KAA[_INLAND])
  v_is_kaa boolean := false;
begin
  select * into l from loads where id = p_load;
  if not found then return; end if;
  v_status := l.status;
  -- #581 F7 Ś1: operator i kody odcinków ze słownika
  v_op := 'POLFERRIES';
  v_load_route := null;
  if l.sailing_id is not null then
    select public.eta_obs_operator_key(sa.route), sa.route
      into v_op, v_load_route from sailings sa where sa.id = l.sailing_id;
    v_op := coalesce(v_op, 'POLFERRIES');
  end if;

  select hours, spread_pct / 100 into h_pl, sp_pl
    from eta_segment_params
   where code = public.eta_obs_segment_code(
           coalesce((select public.eta_obs_route_family(sa.route) from sailings sa where sa.id = l.sailing_id), 'GDN-NYN'),
           'PL_ROAD');
  select hours into h_ci from eta_segment_params where code = 'PORT_CHECKIN';
  select hours, spread_pct / 100 into h_cross, sp_cross
    from eta_segment_params
   where code = public.eta_obs_segment_code(
           coalesce((select public.eta_obs_route_family(sa.route) from sailings sa where sa.id = l.sailing_id), 'GDN-NYN'),
           'CROSSING');
  select hours, spread_pct / 100 into h_road, sp_road
    from eta_segment_params
   where code = public.eta_obs_segment_code(
           coalesce((select public.eta_obs_route_family(sa.route) from sailings sa where sa.id = l.sailing_id), 'GDN-NYN'),
           'SE_ROAD');
  select hours, spread_pct / 100 into h_rest, sp_rest from eta_segment_params where code = 'SE_DAILY_REST';
  select hours, spread_pct / 100 into h_brk, sp_brk from eta_segment_params where code = 'SE_BREAKS';
  -- F7 r4: bez ogólnego coalesce(h_road,17)/(h_pl,4.5) — zasłaniały warianty ze słownika
  h_rest := coalesce(h_rest, 11); sp_rest := coalesce(sp_rest, 0);
  h_brk := coalesce(h_brk, 2); sp_brk := coalesce(sp_brk, 0.5);
  select hours into fresh_h from eta_segment_params where code = 'GPS_FRESH_MIN';
  h_ci := coalesce(h_ci, 2);
  h_cross := coalesce(h_cross, 18); sp_cross := coalesce(sp_cross, 0.15);
  fresh_h := coalesce(fresh_h, 1.5);

  -- 27B:C: korytarz SE z pozycji (przed rozwidleniem SE_E22; potem najbliższy).
  -- Godziny: inland → SE_ROAD_KAA_INLAND; E22 → SE_ROAD_KAA; Polferries → SE_ROAD.
  v_se_road_code := public.eta_obs_segment_code(
           coalesce((select public.eta_obs_route_family(sa.route) from sailings sa where sa.id = l.sailing_id), 'GDN-NYN'),
           'SE_ROAD');
  v_is_kaa := v_se_road_code like '%KAA%';
  select ts, coalesce(geom_snapped, geom_raw) as g into p from positions where load_id = p_load order by ts desc limit 1;
  if v_is_kaa then
    v_se_corr := public.stena_se_eta_corridor(p.g);
    if v_se_corr in ('SE_KAA_INLAND', 'SE_KAA_TRACK') then
      v_se_road_code := 'SE_ROAD_KAA_INLAND';
      -- F7 #638: nie nadpisuj godzin E22 nullami, gdy brak wiersza słownika.
      if exists (select 1 from eta_segment_params where code = 'SE_ROAD_KAA_INLAND') then
        select hours, spread_pct / 100 into h_road, sp_road
          from eta_segment_params where code = 'SE_ROAD_KAA_INLAND';
      end if;
    else
      v_se_corr := coalesce(v_se_corr, 'SE_E22');
    end if;
  else
    v_se_corr := 'SE_E4';
  end if;
  -- Spowolnienie: warunki dla wybranego korytarza; inland bez wiersza → SE_E22.
  select slowdown_mult, reason into v_slow, v_slow_reason
    from corridor_conditions where corridor = v_se_corr;
  if v_slow is null and v_is_kaa and v_se_corr is distinct from 'SE_E22' then
    select slowdown_mult, reason into v_slow, v_slow_reason
      from corridor_conditions where corridor = 'SE_E22';
  end if;
  v_slow := coalesce(v_slow, 1.00);
  if v_slow > 1.00 then
    v_weather_pct := round((v_slow - 1) * 100);
    v_flags := array_append(v_flags, format('spowolnienie SE ×%s (%s)', v_slow, coalesce(v_slow_reason, 'II-6')));
  end if;
  h_road_eff := h_road * v_slow;
  h_se := h_road_eff + h_rest + h_brk;

  -- H-4: stan kierowcy z GPS (bez tachografu); flagi dołączamy na końcu, po fladze korytarza
  select * into st from h4_driver_state_from_gps(p_load, p_now);
  -- H-4: odpoczynek/przerwy szacowane z GPS → niepewność NIE może być 0%.
  -- Pasmo obejmuje earlier/later; przy ostrożnym większy rozrzut (Wysoka niedostępna).
  if coalesce(st.cautious, false) then
    v_h4_rest_spread := 0.25;  -- 25% × rest_h (+ dolne H4_CAUTIOUS poniżej)
  else
    v_h4_rest_spread := 0.15;  -- 15% gdy last_rest znany z GPS/prom
  end if;


  select attribution into v_attr from corridor_polylines where code = 'PL_ROAD' limit 1;
  v_attr := coalesce(v_attr, '© OpenStreetMap contributors');

  select st_centroid(geom) into g_load from geofences where project_id = l.project_id and kind = 'LOADING' and active order by sort_order limit 1;
  select st_centroid(geom) into g_pout from geofences
   where project_id = l.project_id and kind = 'PORT_OUT' and active
     and public.ferry_geofence_matches_route(route, v_load_route)
   order by sort_order limit 1;
  if g_pout is null then
    select st_centroid(geom) into g_pout from geofences
     where project_id = l.project_id and kind = 'PORT_OUT' and active
     order by sort_order limit 1;
  end if;
  select st_centroid(geom) into g_pin from geofences
   where project_id = l.project_id and kind = 'PORT_IN' and active
     and public.ferry_geofence_matches_route(route, v_load_route)
   order by sort_order limit 1;
  if g_pin is null then
    select st_centroid(geom) into g_pin from geofences
     where project_id = l.project_id and kind = 'PORT_IN' and active
     order by sort_order limit 1;
  end if;
  select st_centroid(geom) into g_site from geofences where project_id = l.project_id and kind = 'SITE' and active order by sort_order limit 1;
  v_left := v_status in ('IN_TRANSIT_PL','AT_PORT_GDANSK','FERRY','AT_PORT_NYNASHAMN','IN_TRANSIT_SE','AT_SITE','UNLOADED','DELIVERED')
    or exists (
      select 1 from load_events e
      where e.load_id = p_load
        and e.event_type = 'GEOFENCE_EXIT'
        and e.payload->>'geofence_kind' = 'LOADING'
        and coalesce((e.payload->>'synthetic')::boolean, false) is not true
        -- D-1710 F7: EXIT LOADING tylko od startu okna (opened albo 03:00 dnia planu).
        and e.occurred_at >= coalesce(
              l.tracking_opened_at,
              case when l.plan_load_date is not null
                   then public.tracking_window_start(l.plan_load_date) end,
              '-infinity'::timestamptz)
    );

  -- pozycja p pobrana wyżej (27B:C wybór korytarza SE)

  -- F7 #638: REMOVED jak CANCELLED (regresja vs 0315/0320).
  if v_status in ('CANCELLED','REMOVED') then
    return query select null::timestamptz, null::int, jsonb_build_object(
      'method','ETA v2 (OSM)','segment','CANCELLED','flags',jsonb_build_array('anulowany'),
      'attribution', v_attr, 'computed_at', p_now);
    return;
  end if;
  if v_status in ('UNLOADED','DELIVERED','READY_TO_INVOICE','INVOICED') then
    return query select coalesce(l.actual_delivery_at, p_now), 0, jsonb_build_object(
      'method','ETA v2 (OSM)','segment','DONE','flags',jsonb_build_array('rozładowany — data rozładunku'),
      'attribution', v_attr, 'computed_at', p_now);
    return;
  end if;
  if v_status = 'AT_SITE' then
    select max(occurred_at) into v_eta from load_events where load_id = p_load and payload->>'to' = 'AT_SITE';
    return query select coalesce(v_eta, p_now), 0, jsonb_build_object(
      'method','ETA v2 (OSM)','segment','AT_SITE','flags',jsonb_build_array('na placu budowy'),
      'attribution', v_attr, 'computed_at', p_now);
    return;
  end if;

  -- ETA tylko z pozycji (2026-10-04). Plan załadunku i założony rejs nie wypełniają eta_site.
  v_fresh := p.ts is not null and p.ts >= p_now - make_interval(mins => (fresh_h * 60)::int);

  if v_status = 'FERRY' then
    select vp.lat, vp.lon, vp.sog_kn, vp.observed_at
      into v_alat, v_alon, v_sog, v_obs
      from vessel_positions vp
      join sailings sa on sa.vessel_id = vp.vessel_id
     where sa.id = l.sailing_id
       and vp.observed_at >= p_now - make_interval(mins => (fresh_h * 60)::int)
     order by vp.observed_at desc
     limit 1;
    if v_obs is null or v_sog is null or v_sog <= 0 or g_pin is null then
      return query select null::timestamptz, null::int, jsonb_build_object(
        'method','ETA v2 (OSM)','segment','FERRY',
        'flags', jsonb_build_array('na promie — ETA czeka na pozycję AIS'),
        'ferry_eta','waits_for_ais','wait_ais', true, 'ferry_eta_at', null, 'plan_eta', false,
        'attribution', v_attr, 'computed_at', p_now);
      return;
    end if;
    v_sea_h := st_distance(
      st_setsrid(st_makepoint(v_alon, v_alat), 4326)::geography,
      g_pin::geography) / (v_sog * 1852.0);
    v_eta := p_now + make_interval(secs => ((v_sea_h + h_se) * 3600)::int);
    return query select v_eta, greatest(1, round(v_sea_h * 60 * 0.15))::int, jsonb_build_object(
      'method','ETA v2 (OSM)','segment','FERRY',
      'flags', jsonb_build_array('pozycja AIS promu'),
      'ferry_eta','ais','wait_ais', false,
      'ferry_eta_at', (p_now + make_interval(secs => (v_sea_h * 3600)::int)),
      'plan_eta', false, 'sailing', null,
      'attribution', v_attr, 'computed_at', p_now, 'port_route', v_op);
    return;
  end if;

  if v_status in ('AT_PORT_NYNASHAMN','IN_TRANSIT_SE') then
    if v_fresh is not true then
      return query select null::timestamptz, null::int, jsonb_build_object(
        'method','ETA v2 (OSM)','segment', v_status::text,
        'flags', jsonb_build_array('brak pozycji GPS'),
        'plan_eta', false, 'attribution', v_attr, 'computed_at', p_now);
      return;
    end if;
  else
    if (v_left) is not true then
      if v_fresh is not true then
        return query select null::timestamptz, null::int, jsonb_build_object(
          'method','ETA v2 (OSM)','segment', v_status::text,
          'flags', jsonb_build_array('brak pozycji GPS'),
          'plan_eta', false, 'pre_load', true, 'attribution', v_attr, 'computed_at', p_now);
      else
        return query select null::timestamptz, null::int, jsonb_build_object(
          'method','ETA v2 (OSM)','segment', v_status::text,
          'flags', jsonb_build_array('pre_load'),
          'plan_eta', false, 'pre_load', true, 'attribution', v_attr, 'computed_at', p_now);
      end if;
      return;
    end if;
    if v_fresh is not true then
      return query select null::timestamptz, null::int, jsonb_build_object(
        'method','ETA v2 (OSM)','segment', v_status::text,
        'flags', jsonb_build_array('brak pozycji GPS'),
        'plan_eta', false, 'pre_load', false, 'attribution', v_attr, 'computed_at', p_now);
      return;
    end if;
  end if;

  -- 2) odcinek SE
  if v_status in ('AT_PORT_NYNASHAMN','IN_TRANSIT_SE') then
    v_frac := 1;
    if v_status = 'IN_TRANSIT_SE' then
      if p.ts is not null and p.ts >= p_now - make_interval(mins => (fresh_h * 60)::int) then
        select * into cp from corridor_progress(coalesce(v_se_corr, 'SE_E4'), p.g);
        if found and cp.remaining_frac is not null then
          v_frac := cp.remaining_frac;
          v_off := cp.off_m;
          v_rem_km := cp.remaining_km;
          v_progress := 'corridor';
          v_flags := array_append(v_flags, 'pozycja GPS — postęp na korytarzu OSM'::text);
        elsif g_site is not null and g_pin is not null
           and st_distance(g_pin::geography, g_site::geography) > 0 then
          v_frac := least(1, greatest(0, st_distance(p.g::geography, g_site::geography) / st_distance(g_pin::geography, g_site::geography)));
          v_flags := array_append(v_flags, 'pozycja GPS — odległość do placu w linii prostej'::text);
        else
          v_frac := 0.5; v_var := v_var + (h_se * 60 * 0.25)^2; v_sum := v_sum + (h_se * 60 * 0.25);
          v_comp := v_comp || jsonb_build_object('code','SE_NO_GPS','min',round(h_se * 60 * 0.25));
          v_flags := array_append(v_flags, 'brak świeżej pozycji — połowa odcinka SE'::text);
        end if;
      else
        v_frac := 0.5; v_var := v_var + (h_se * 60 * 0.25)^2; v_sum := v_sum + (h_se * 60 * 0.25);
        v_comp := v_comp || jsonb_build_object('code','SE_NO_GPS','min',round(h_se * 60 * 0.25));
        v_flags := array_append(v_flags, 'brak świeżej pozycji — połowa odcinka SE'::text);
      end if;
    end if;
    -- H-4: jazda pozostała; odpoczynki/przerwy wg UE (nie proporcja do trasy)
    v_drive_need := h_road_eff * v_frac;
    select * into sch from h4_schedule_remaining(
      v_drive_need,
      coalesce(st.driven_today_h, 0),
      coalesce(st.extended_used, 0),
      coalesce(st.since_break_h, st.driven_today_h)
    );
    v_drive_h := sch.drive_h; v_rest_h := sch.rest_h; v_break_h := sch.break_h;
    v_rem := sch.total_h;
    v_eta := p_now + make_interval(secs => (v_rem * 3600)::int);
    if sch.flags is not null then v_flags := v_flags || sch.flags; end if;
    v_var := v_var + (sch.drive_h * 60 * sp_road)^2; v_sum := v_sum + (sch.drive_h * 60 * sp_road);
    -- F7 #638: v_comp.code = ten sam kod co v_segs (SE_ROAD_KAA*).
    v_comp := v_comp || jsonb_build_object('code',coalesce(v_se_road_code,'SE_ROAD'),'min',round(sch.drive_h * 60 * sp_road));
    v_var := v_var + (sch.break_h * 60 * sp_brk)^2; v_sum := v_sum + (sch.break_h * 60 * sp_brk);
    v_comp := v_comp || jsonb_build_object('code','SE_BREAKS','min',round(sch.break_h * 60 * sp_brk));
    -- H-4: niepewność odpoczynku > 0 (earlier/later); I-15 ±0% nie dotyczy rest z GPS
    v_var := v_var + (sch.rest_h * 60 * v_h4_rest_spread)^2; v_sum := v_sum + (sch.rest_h * 60 * v_h4_rest_spread);
    v_comp := v_comp || jsonb_build_object('code','H4_EU_REST','min',round(sch.rest_h * 60 * v_h4_rest_spread));
    v_segs := v_segs || jsonb_build_object('code',coalesce(v_se_road_code,'SE_ROAD'),'hours',round(sch.drive_h, 1),'spread_pct',round(sp_road * 100),'slowdown_mult',v_slow,'corridor',v_se_corr)
                     || jsonb_build_object('code','H4_EU_REST','hours',round(sch.rest_h, 1),'spread_pct',round(v_h4_rest_spread * 100))
                     || jsonb_build_object('code','H4_EU_BREAKS','hours',round(sch.break_h, 1),'spread_pct',round(sp_brk * 100))
                     || jsonb_build_object('code','H4_SEGMENTS','items',sch.segments);
    v_seg := v_status::text;
  else
    select coalesce(x.delayed_departure_at, x.departure_at) as dep, coalesce(x.delayed_arrival_at, x.arrival_at) as arr,
           x.status, x.id, (x.delayed_departure_at is not null or x.status = 'OPOZNIONY') as delayed
      into v_sail from sailings x where x.id = l.sailing_id;
    v_has := found;
    if v_has and v_sail.status = 'ODWOLANY' then
      v_flags := array_append(v_flags, 'przypisany rejs odwołany'::text); v_has := false;
    elsif v_has and v_status < 'FERRY' and v_sail.dep < p_now then
      v_flags := array_append(v_flags, 'przypisany rejs odpłynął bez transportu'::text); v_has := false;
    end if;

    if v_status = 'FERRY' then
      if v_has then
        v_arr := v_sail.arr; v_sail_src := 'przypisany';
        v_var := v_var + (30)^2; v_sum := v_sum + (30); v_comp := v_comp || jsonb_build_object('code','SAILING','min',round(30));
        if v_sail.delayed then v_var := v_var + (60)^2; v_sum := v_sum + (60); v_comp := v_comp || jsonb_build_object('code','SAILING_DELAYED','min',round(60)); end if;
      else
        v_arr := p_now + make_interval(secs => (h_cross * 0.5 * 3600)::int);
        v_var := v_var + (h_cross * 60 * 0.5)^2; v_sum := v_sum + (h_cross * 60 * 0.5);
        v_comp := v_comp || jsonb_build_object('code','FERRY_NO_SAILING','min',round(h_cross * 60 * 0.5));
        v_flags := array_append(v_flags, 'na promie bez rejsu w rozkładzie — połowa przeprawy'::text);
      end if;
      v_seg := 'FERRY';
    else
      if (v_left) is true then
        v_start := p_now;
      else
        v_start := greatest(p_now, coalesce(l.plan_load_to, l.plan_load_from, (l.plan_load_date + time '12:00') at time zone 'Europe/Warsaw', p_now));
      end if;
      v_frac := case when v_status = 'AT_PORT_GDANSK' then 0 when v_status = 'IN_TRANSIT_PL' then 0.5 else 1 end;
      if v_status = 'IN_TRANSIT_PL' then
        if p.ts is not null and p.ts >= p_now - make_interval(mins => (fresh_h * 60)::int) then
          select * into cp from corridor_progress('PL_ROAD', p.g);
          if found and cp.remaining_frac is not null then
            v_frac := cp.remaining_frac;
            v_off := cp.off_m;
            v_rem_km := cp.remaining_km;
            v_progress := 'corridor';
            v_flags := array_append(v_flags, 'pozycja GPS — postęp na korytarzu OSM'::text);
          elsif g_pout is not null and g_load is not null
             and st_distance(g_load::geography, g_pout::geography) > 0 then
            v_frac := least(1, greatest(0, st_distance(p.g::geography, g_pout::geography) / st_distance(g_load::geography, g_pout::geography)));
            v_flags := array_append(v_flags, 'pozycja GPS — odległość do portu w linii prostej'::text);
          else
            v_flags := array_append(v_flags, 'brak świeżej pozycji — połowa odcinka PL'::text);
            v_var := v_var + (h_pl * 60 * 0.25)^2; v_sum := v_sum + (h_pl * 60 * 0.25);
            v_comp := v_comp || jsonb_build_object('code','PL_NO_GPS','min',round(h_pl * 60 * 0.25));
          end if;
        else
          v_flags := array_append(v_flags, 'brak świeżej pozycji — połowa odcinka PL'::text);
          v_var := v_var + (h_pl * 60 * 0.25)^2; v_sum := v_sum + (h_pl * 60 * 0.25);
          v_comp := v_comp || jsonb_build_object('code','PL_NO_GPS','min',round(h_pl * 60 * 0.25));
        end if;
      end if;
      if v_status < 'IN_TRANSIT_PL' and v_start > p_now then v_flags := array_append(v_flags, 'przed załadunkiem — start z planu załadunku'::text); end if;
      v_drive_h := round(h_pl * v_frac, 2);
      v_checkin_h := case when v_status = 'AT_PORT_GDANSK' then 0 else h_ci end;
      v_segs := v_segs || jsonb_build_object('code','PL_ROAD','hours',round(h_pl * v_frac, 1),'spread_pct',round(sp_pl * 100));
      v_start := v_start + make_interval(secs => ((h_pl * v_frac + v_checkin_h) * 3600)::int);
      if v_has then
        v_dep := v_sail.dep; v_arr := v_sail.arr; v_sail_src := 'przypisany';
        v_var := v_var + (30)^2; v_sum := v_sum + (30); v_comp := v_comp || jsonb_build_object('code','SAILING','min',round(30));
        if v_sail.delayed then v_var := v_var + (60)^2; v_sum := v_sum + (60); v_comp := v_comp || jsonb_build_object('code','SAILING_DELAYED','min',round(60)); end if;
        if v_start > v_dep then
          v_flags := array_append(v_flags, 'rejs zagrożony — dojazd i check-in po odejściu'::text);
          v_var := v_var + (12 * 60)^2; v_sum := v_sum + (12 * 60); v_comp := v_comp || jsonb_build_object('code','SAILING_AT_RISK','min',round(12 * 60));
        end if;
      else
        -- Ś1 F7 r5 B1: tylko trasy PL→SE (alias_key = route_key); bez powrotnych NYN-GDN/KAA-GDY
        select coalesce(x.delayed_departure_at, x.departure_at), coalesce(x.delayed_arrival_at, x.arrival_at)
          into v_dep, v_arr
          from sailings x
         where x.project_id = l.project_id
           and x.route in (
             select a.alias_key from eta_route_aliases a where a.alias_key = a.route_key
           )
           and x.status <> 'ODWOLANY'
           and coalesce(x.delayed_departure_at, x.departure_at) >= v_start
         order by coalesce(x.delayed_departure_at, x.departure_at) limit 1;
        if v_dep is not null then
          v_sail_src := 'założony (najbliższy w rozkładzie)';
          v_flags := array_append(v_flags, 'brak przypisanego rejsu — założony najbliższy z rozkładu'::text);
          v_var := v_var + (6 * 60)^2; v_sum := v_sum + (6 * 60); v_comp := v_comp || jsonb_build_object('code','SAILING_ASSUMED','min',round(6 * 60));
        else
          v_dep := v_start; v_arr := v_start + make_interval(secs => (h_cross * 3600)::int);
          v_flags := array_append(v_flags, 'brak rejsu w rozkładzie — przeprawa z założenia'::text);
          v_var := v_var + (12 * 60)^2; v_sum := v_sum + (12 * 60); v_comp := v_comp || jsonb_build_object('code','NO_SCHEDULE','min',round(12 * 60));
          v_var := v_var + (h_cross * 60 * sp_cross)^2; v_sum := v_sum + (h_cross * 60 * sp_cross);
          v_comp := v_comp || jsonb_build_object('code','CROSSING','min',round(h_cross * 60 * sp_cross));
        end if;
      end if;
      v_seg := v_status::text;
    end if;
    v_segs := v_segs || jsonb_build_object('code','CROSSING','departure',v_dep,'arrival',v_arr,'source',coalesce(v_sail_src,'założenie'));
    -- H-4 po promie: zegar od zera (D-9 odpoczynek na promie)
    select * into sch from h4_schedule_remaining(h_road_eff, 0, 0, 0);
    v_drive_h := coalesce(v_drive_h, 0) + sch.drive_h;
    v_rest_h := coalesce(v_rest_h, 0) + sch.rest_h;
    v_break_h := coalesce(v_break_h, 0) + sch.break_h;
    v_eta := v_arr + make_interval(secs => (sch.total_h * 3600)::int);
    v_flags := array_append(v_flags, 'H-4 po promie — odpoczynek D-9, zegar od zera'::text);
    if sch.flags is not null then v_flags := v_flags || sch.flags; end if;
    v_segs := v_segs || jsonb_build_object('code',coalesce(v_se_road_code,'SE_ROAD'),'hours',round(sch.drive_h, 1),'spread_pct',round(sp_road * 100),'slowdown_mult',v_slow,'corridor',v_se_corr)
                     || jsonb_build_object('code','H4_EU_REST','hours',round(sch.rest_h, 1),'spread_pct',round(v_h4_rest_spread * 100))
                     || jsonb_build_object('code','H4_EU_BREAKS','hours',round(sch.break_h, 1),'spread_pct',round(sp_brk * 100))
                     || jsonb_build_object('code','H4_SEGMENTS','items',sch.segments);
    v_var := v_var + (sch.drive_h * 60 * sp_road)^2; v_sum := v_sum + (sch.drive_h * 60 * sp_road);
    -- F7 #638: v_comp.code = ten sam kod co v_segs (SE_ROAD_KAA*).
    v_comp := v_comp || jsonb_build_object('code',coalesce(v_se_road_code,'SE_ROAD'),'min',round(sch.drive_h * 60 * sp_road));
    v_var := v_var + (sch.break_h * 60 * sp_brk)^2; v_sum := v_sum + (sch.break_h * 60 * sp_brk);
    v_comp := v_comp || jsonb_build_object('code','SE_BREAKS','min',round(sch.break_h * 60 * sp_brk));
    v_var := v_var + (sch.rest_h * 60 * v_h4_rest_spread)^2; v_sum := v_sum + (sch.rest_h * 60 * v_h4_rest_spread);
    v_comp := v_comp || jsonb_build_object('code','H4_EU_REST','min',round(sch.rest_h * 60 * v_h4_rest_spread));
    if v_status < 'FERRY' then
      v_var := v_var + (h_pl * 60 * sp_pl)^2; v_sum := v_sum + (h_pl * 60 * sp_pl);
      v_comp := v_comp || jsonb_build_object('code','PL_ROAD','min',round(h_pl * 60 * sp_pl));
    end if;
  end if;

  if st.flags is not null then
    v_flags := v_flags || st.flags;
  end if;
  if coalesce(st.cautious, false) then
    v_flags := array_append(v_flags, 'H-4 założenie ostrożne — czas pracy bez pełnej historii GPS'::text);
    -- „Wysoka” niedostępna przy braku historii odpoczynku (rozrzut > 60 min)
    v_var := v_var + (61)^2; v_sum := v_sum + 61;
    v_comp := v_comp || jsonb_build_object('code','H4_CAUTIOUS','min',61);
  end if;

  v_causes := jsonb_build_object(
    'drive_h', v_drive_h,
    'checkin_h', v_checkin_h,
    'rest_h', v_rest_h,
    'breaks_h', v_break_h,
    'weather_slowdown_pct', v_weather_pct,
    'progress', v_progress,
    'remaining_km', v_rem_km,
    'off_corridor_m', v_off,
    'se_corridor', v_se_corr,
    'se_road_code', v_se_road_code,
    'h4', true,
    'h4_source', coalesce(st.source, 'n/a'),
    'h4_cautious', coalesce(st.cautious, false),
    'tachograph', 'none'
  );

  return query select v_eta, round(sqrt(v_var))::int, jsonb_build_object(
    'method', 'ETA v2 (OSM)', 'segment', v_seg, 'segments', v_segs,
    'band', jsonb_build_object('method', 'RSS', 'min', round(sqrt(v_var)), 'linear_sum_min', round(v_sum),
                               'components', (select coalesce(jsonb_agg(c), '[]'::jsonb) from jsonb_array_elements(v_comp) c where (c->>'min')::numeric > 0)),
    'flags', to_jsonb(v_flags), 'sailing', v_sail_src,
    'attribution', v_attr, 'causes', v_causes, 'computed_at', p_now);
end $function$;

revoke all on function public.compute_load_eta(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.compute_load_eta(uuid, timestamptz) to service_role;

commit;
