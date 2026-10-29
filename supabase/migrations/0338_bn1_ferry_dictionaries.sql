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
  ('HEL-TLL', 'TLL-HEL', 'TALLINK'),
  ('TALLINK', 'TLL-HEL', 'TALLINK'),
  ('VUO-MUU', 'MUU-VUO', 'ECKERO'),
  ('ECKERO',  'MUU-VUO', 'ECKERO'),
  ('STO-TLL', 'TLL-STO', 'TALLINK'),
  ('KPS-PLD', 'PLD-KPS', 'DFDS'),
  ('DFDS',    'PLD-KPS', 'DFDS'),
  ('VIKING',  'TLL-HEL', 'VIKING')
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
-- 6) Funkcje słownika (operator / porty / kraj z trasy)
-- ---------------------------------------------------------------------------
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

commit;
