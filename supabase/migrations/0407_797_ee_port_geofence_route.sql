-- #797 PILNE: strefy portów EE miały country='SE' / route='POLFERRIES'
-- (seed 0338/0343 wstawiał poprawne wartości tylko gdy nazwa nie istniała —
--  wcześniejsze wiersze UI/seedu zostawały z Polferries). Bez match → brak AT_PORT.
-- Poprawka danych + backfill INSIDE PORT_OUT → AT_PORT_GDANSK; seed upsert country/route.

begin;

-- ---------------------------------------------------------------------------
-- 1) Popraw country + route po nazwie (PORT_OUT / PRE_PORT / PORT_IN bałtyckie)
-- ---------------------------------------------------------------------------
update public.geofences g
   set country = z.country,
       route   = z.route
  from (values
    ('Bufor 20 km przed Tallinn A',       'EE', 'TLL-HEL'),
    ('Terminal Tallinn A',                'EE', 'TLL-HEL'),
    ('Bufor 20 km przed Tallinn D HEL',   'EE', 'TLL-HEL'),
    ('Terminal Tallinn D HEL',            'EE', 'TLL-HEL'),
    ('Bufor 20 km przed Tallinn D',       'EE', 'TLL-STO'),
    ('Terminal Tallinn D',                'EE', 'TLL-STO'),
    ('Bufor 20 km przed Muuga',           'EE', 'MUU-VUO'),
    ('Terminal Muuga HHLA',               'EE', 'MUU-VUO'),
    ('Bufor 20 km przed Paldiski',        'EE', 'PLD-KPS'),
    ('Terminal Paldiski',                 'EE', 'PLD-KPS'),
    ('Terminal Helsinki West Harbour T2', 'FI', 'TLL-HEL'),
    ('Terminal Helsinki Katajanokka',     'FI', 'TLL-HEL'),
    ('Terminal Vuosaari',                 'FI', 'MUU-VUO'),
    ('Terminal Stockholm Värtahamnen',    'SE', 'TLL-STO'),
    ('Terminal Kapellskär',               'SE', 'PLD-KPS')
  ) as z(name, country, route)
 where g.name = z.name
   and (g.country is distinct from z.country or g.route is distinct from z.route);

-- ---------------------------------------------------------------------------
-- 2) Seed: przy ponownym wywołaniu poprawia też istniejące wiersze
-- ---------------------------------------------------------------------------
create or replace function public.bn1_seed_baltic_geofences(p_project uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  n int := 0;
  u int := 0;
begin
  if p_project is null then
    return 0;
  end if;

  insert into public.geofences (
    project_id, name, kind, geom, hysteresis_m, dwell_seconds, debounce_fixes,
    notify_enter, country, route
  )
  select p_project, z.name, z.kind::geofence_kind, make_circle_fence(z.lat, z.lon, z.r),
         z.hyst, z.dwell, 2, true, z.country, z.route
    from (values
      ('Bufor 20 km przed Tallinn A',       'PRE_PORT', 59.44400, 24.76800, 20000, 500, 0,   'EE', 'TLL-HEL'),
      ('Terminal Tallinn A',                'PORT_OUT', 59.44400, 24.76800,   250, 100, 900, 'EE', 'TLL-HEL'),
      ('Bufor 20 km przed Tallinn D HEL',   'PRE_PORT', 59.44000, 24.77500, 20000, 500, 0,   'EE', 'TLL-HEL'),
      ('Terminal Tallinn D HEL',            'PORT_OUT', 59.44000, 24.77500,   250, 100, 900, 'EE', 'TLL-HEL'),
      ('Bufor 20 km przed Tallinn D',       'PRE_PORT', 59.44000, 24.77500, 20000, 500, 0,   'EE', 'TLL-STO'),
      ('Terminal Tallinn D',                'PORT_OUT', 59.44000, 24.77500,   250, 100, 900, 'EE', 'TLL-STO'),
      ('Bufor 20 km przed Muuga',           'PRE_PORT', 59.50500, 24.95800, 20000, 500, 0,   'EE', 'MUU-VUO'),
      ('Terminal Muuga HHLA',               'PORT_OUT', 59.50500, 24.95800,   800, 200, 900, 'EE', 'MUU-VUO'),
      ('Bufor 20 km przed Paldiski',        'PRE_PORT', 59.33300, 24.08300, 20000, 500, 0,   'EE', 'PLD-KPS'),
      ('Terminal Paldiski',                 'PORT_OUT', 59.33300, 24.08300,   800, 200, 900, 'EE', 'PLD-KPS'),
      ('Terminal Helsinki West Harbour T2', 'PORT_IN',  60.15400, 24.91400,   800, 200, 600, 'FI', 'TLL-HEL'),
      ('Terminal Helsinki Katajanokka',     'PORT_IN',  60.16600, 24.96800,   800, 200, 600, 'FI', 'TLL-HEL'),
      ('Terminal Vuosaari',                 'PORT_IN',  60.21200, 25.18800,   800, 200, 600, 'FI', 'MUU-VUO'),
      ('Terminal Stockholm Värtahamnen',    'PORT_IN',  59.35000, 18.11000,   800, 200, 600, 'SE', 'TLL-STO'),
      ('Terminal Kapellskär',               'PORT_IN',  59.72300, 19.06600,   800, 200, 600, 'SE', 'PLD-KPS')
    ) as z(name, kind, lat, lon, r, hyst, dwell, country, route)
   where not exists (
     select 1 from public.geofences g
      where g.project_id = p_project and g.name = z.name
   );
  get diagnostics n = row_count;

  update public.geofences g
     set country = z.country,
         route   = z.route
    from (values
      ('Bufor 20 km przed Tallinn A',       'EE', 'TLL-HEL'),
      ('Terminal Tallinn A',                'EE', 'TLL-HEL'),
      ('Bufor 20 km przed Tallinn D HEL',   'EE', 'TLL-HEL'),
      ('Terminal Tallinn D HEL',            'EE', 'TLL-HEL'),
      ('Bufor 20 km przed Tallinn D',       'EE', 'TLL-STO'),
      ('Terminal Tallinn D',                'EE', 'TLL-STO'),
      ('Bufor 20 km przed Muuga',           'EE', 'MUU-VUO'),
      ('Terminal Muuga HHLA',               'EE', 'MUU-VUO'),
      ('Bufor 20 km przed Paldiski',        'EE', 'PLD-KPS'),
      ('Terminal Paldiski',                 'EE', 'PLD-KPS'),
      ('Terminal Helsinki West Harbour T2', 'FI', 'TLL-HEL'),
      ('Terminal Helsinki Katajanokka',     'FI', 'TLL-HEL'),
      ('Terminal Vuosaari',                 'FI', 'MUU-VUO'),
      ('Terminal Stockholm Värtahamnen',    'SE', 'TLL-STO'),
      ('Terminal Kapellskär',               'SE', 'PLD-KPS')
    ) as z(name, country, route)
   where g.project_id = p_project
     and g.name = z.name
     and (g.country is distinct from z.country or g.route is distinct from z.route);
  get diagnostics u = row_count;

  return n + u;
end;
$$;

comment on function public.bn1_seed_baltic_geofences(uuid) is
  'BN1/#648 + #797: strefy bałtyckie; insert brakujących + poprawa country/route istniejących.';

-- ---------------------------------------------------------------------------
-- 3) Backfill: INSIDE PORT_OUT + match trasy + READY…IN_TRANSIT_PL → AT_PORT
-- ---------------------------------------------------------------------------
do $bf$
declare
  r record;
  v_load_route text;
  v_status load_status;
  n int := 0;
begin
  for r in
    select gs.load_id, gs.geofence_id, gs.entered_at, g.name as gname, g.route as groute
      from public.geofence_states gs
      join public.geofences g on g.id = gs.geofence_id
     where gs.state = 'INSIDE'
       and g.kind = 'PORT_OUT'
  loop
    select l.status,
           coalesce(s.route, public.load_route_family(l.id))
      into v_status, v_load_route
      from public.loads l
      left join public.sailings s on s.id = l.sailing_id
     where l.id = r.load_id;

    if v_status is null then
      continue;
    end if;
    if public.load_status_rank(v_status) < public.load_status_rank('READY')
       or public.load_status_rank(v_status) > public.load_status_rank('IN_TRANSIT_PL') then
      continue;
    end if;
    if public.ferry_geofence_matches_route(r.groute, v_load_route) is not true then
      continue;
    end if;

    if public.auto_set_status(
         r.load_id,
         v_status,
         'AT_PORT_GDANSK',
         format('wjazd w strefę portu wyjścia (%s)', coalesce(r.gname, r.groute, v_load_route)),
         coalesce(r.entered_at, now()),
         jsonb_build_object(
           'geofence_id', r.geofence_id,
           'geofence_kind', 'PORT_OUT',
           'geofence_name', r.gname,
           'source', 'GPS',
           'backfill', '#797'
         )
       ) then
      n := n + 1;
    end if;
  end loop;

  raise notice '#797 backfill AT_PORT_GDANSK: % transportów', n;
end;
$bf$;

commit;
