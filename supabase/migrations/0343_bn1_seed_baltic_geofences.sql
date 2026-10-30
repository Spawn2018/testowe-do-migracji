-- BN1 / #648 / 0343: jedna funkcja seedu stref bałtyckich + active=false (promote) tylko HHL_ADMIN.
-- Współrzędne 1:1 z 0338 (bez edycji nałożonej migracji). e2e TLLA-HEL w status.sh.
-- Po #656: numer 0342 zajęty przez dzwonek importu.

begin;

-- ---------------------------------------------------------------------------
-- 1) Seed stref bałtyckich — jedna kopia współrzędnych
-- ---------------------------------------------------------------------------
create or replace function public.bn1_seed_baltic_geofences(p_project uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  n int := 0;
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
   where not exists (
     select 1 from public.geofences g
      where g.project_id = p_project and g.name = z.name
   );

  get diagnostics n = row_count;
  return n;
end;
$$;

comment on function public.bn1_seed_baltic_geofences(uuid) is
  'BN1/#648: strefy PRE_PORT/PORT_OUT/PORT_IN bałtyckie — jedna kopia współrzędnych (migracja + seed.sql).';

revoke all on function public.bn1_seed_baltic_geofences(uuid) from public, anon, authenticated;
grant execute on function public.bn1_seed_baltic_geofences(uuid) to service_role;

-- Produkcja / CI po migracjach: uzupełnij gdy projekt już istnieje (0338 mógł nic nie wstawić).
select public.bn1_seed_baltic_geofences(p.id)
  from public.projects p
 where p.code in ('STEGRA_BODEN', 'STEGRA');

-- ---------------------------------------------------------------------------
-- 2) ferry_routes.active — tylko HHL_ADMIN (promote już filtruje fr.active)
-- ---------------------------------------------------------------------------
create or replace function public.ferry_route_set_active(p_code text, p_active boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_code text := upper(btrim(coalesce(p_code, '')));
  v_prev boolean;
begin
  perform public.assert_not_preview();
  if (public.current_app_role() = 'HHL_ADMIN') is not true then
    raise exception 'Wyłącznie administrator HHL' using errcode = '42501';
  end if;
  if v_code = '' then
    raise exception 'Brak kodu trasy' using errcode = '22023';
  end if;
  if p_active is null then
    raise exception 'active wymagane' using errcode = '22023';
  end if;

  select fr.active into v_prev
    from public.ferry_routes fr
   where fr.code = v_code
   for update;
  if not found then
    raise exception 'Nieznana trasa %', v_code using errcode = 'P0002';
  end if;

  if v_prev is not distinct from p_active then
    return;
  end if;

  update public.ferry_routes
     set active = p_active
   where code = v_code;

  insert into public.audit_log (user_id, action, entity, entity_id, new_value)
  values (
    public.current_app_user_id(),
    'FERRY_ROUTE_ACTIVE_SET',
    'ferry_routes',
    v_code,
    jsonb_build_object('active', p_active, 'previous', v_prev)
  );
end;
$$;

comment on function public.ferry_route_set_active(text, boolean) is
  'BN1/#648: włącza/wyłącza trasę (active=false → promote pomija); tylko HHL_ADMIN.';

revoke all on function public.ferry_route_set_active(text, boolean) from public, anon;
grant execute on function public.ferry_route_set_active(text, boolean) to authenticated;

-- FK sailings.route → ferry_routes: odłożone (fixture OTHER w status.sh dropa CHECK).
-- FK source: DANE_STARTOWE/RECZNIE poza ferry_operators — zostaje CHECK z 0338.

commit;
