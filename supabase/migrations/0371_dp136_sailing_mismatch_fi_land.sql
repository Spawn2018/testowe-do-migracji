-- DP-136 (F7 #708 r1): przepięcie rejsu — ląd przypłynięcia SE|FI.
-- 0344:417–424 i propose_id patrzyły tylko na sweden_land_geom;
-- po przypięciu rejsu do FI (HEL/VUO) AIS backup nie dostawał pozycji z lądu FI.

begin;

-- ---------------------------------------------------------------------------
-- 1) sailing_mismatch_propose_id — pierwsze ląd SE|FI
-- ---------------------------------------------------------------------------
create or replace function public.sailing_mismatch_propose_id(p_load_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_project uuid;
  v_route   text;
  v_last_pl timestamptz;
  v_first_land timestamptz;
  v_prop    uuid;
begin
  select l.project_id, s.route
    into v_project, v_route
    from public.loads l
    left join public.sailings s on s.id = l.sailing_id
   where l.id = p_load_id;
  if v_project is null then
    return null;
  end if;

  select min(p.ts) into v_first_land
    from public.positions p
   where p.load_id = p_load_id
     and coalesce((p.raw->>'stale_point')::boolean, false) is not true
     and (
       st_covers(public.sweden_land_geom(), p.geom_raw::geometry)
       or st_covers(public.finland_land_geom(), p.geom_raw::geometry)
     );

  if v_first_land is null then
    return null;
  end if;

  -- Ostatni punkt w PL (bbox lądu ≤54.45°N albo PORT_OUT/LOADING — bez PRE_PORT/zatoki).
  select max(p.ts) into v_last_pl
    from public.positions p
   where p.load_id = p_load_id
     and p.ts < v_first_land
     and coalesce((p.raw->>'stale_point')::boolean, false) is not true
     and (
       (st_x(p.geom_raw::geometry) between 14.0 and 24.2
        and st_y(p.geom_raw::geometry) between 49.0 and 54.45)
       or exists (
         select 1 from public.geofences g
          where g.project_id = v_project
            and g.country = 'PL'
            and g.kind in ('PORT_OUT', 'LOADING')
            and st_covers(g.geom, p.geom_raw::geometry)
       )
     );

  -- BN1: outbound ze słownika (PL→SE/FI); przy braku rejsu ładunku — tylko z PL
  select s.id into v_prop
    from public.sailings s
   where s.project_id = v_project
     and s.status is distinct from 'ODWOLANY'
     and s.actual_departure_at is not null
     and public.ferry_route_is_outbound(s.route)
     and exists (
       select 1
         from public.ferry_routes fr
         join public.ferry_ports pf on pf.code = fr.port_from
        where fr.code = upper(btrim(s.route))
          and fr.active
          and pf.country = 'PL'
     )
     and (v_route is null
          or public.eta_obs_route_family(s.route)
             = public.eta_obs_route_family(v_route))
     and (v_last_pl is null or s.actual_departure_at >= v_last_pl)
     and s.actual_departure_at <= v_first_land
     and (s.actual_arrival_at is null or s.actual_arrival_at <= v_first_land)
   order by s.actual_departure_at desc, s.id
   limit 1;

  return v_prop;
end $function$;

revoke all on function public.sailing_mismatch_propose_id(uuid)
  from public, anon, authenticated;
grant execute on function public.sailing_mismatch_propose_id(uuid) to service_role;
comment on function public.sailing_mismatch_propose_id(uuid) is
  'BN1/DP-136: rejs outbound PL→SE/FI w oknie PL→ląd SE|FI; bez ODWOLANY.';

-- ---------------------------------------------------------------------------
-- 2) sailing_mismatch_assign — ostatnia pozycja na lądzie SE|FI
-- ---------------------------------------------------------------------------
create or replace function public.sailing_mismatch_assign(p_load_id uuid, p_sailing_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_old uuid;
  v_actor uuid;
  v_role public.user_role;
  v_status load_status;
  v_route text;
  v_sail_status text;
  v_dep_eff timestamptz;
  v_actual_dep timestamptz;
  v_plan_dep timestamptz;
  v_ferry_src text;
  v_lat double precision;
  v_lon double precision;
  v_pts timestamptz;
  v_prev text;
begin
  perform public.assert_not_preview();
  select id, role into v_actor, v_role
    from public.app_users
   where auth_id = auth.uid() and active;
  if (v_actor is not null and v_role = 'HHL_ADMIN' and public.mfa_satisfied(v_role) is true) is not true then
    raise exception 'Tylko Administrator HHL z 2FA' using errcode = '42501';
  end if;
  if p_load_id is null or p_sailing_id is null then
    raise exception 'load i sailing wymagane';
  end if;

  select sailing_id, status into v_old, v_status
    from public.loads where id = p_load_id for update;
  if not found then
    raise exception 'Nieznany ładunek';
  end if;

  select s.route, s.status::text,
         s.actual_departure_at,
         coalesce(s.delayed_departure_at, s.departure_at),
         coalesce(s.actual_departure_at, s.delayed_departure_at, s.departure_at)
    into v_route, v_sail_status, v_actual_dep, v_plan_dep, v_dep_eff
    from public.sailings s
   where s.id = p_sailing_id
     and s.project_id = (select project_id from public.loads where id = p_load_id);
  if not found then
    raise exception 'Rejs spoza projektu';
  end if;
  if v_sail_status = 'ODWOLANY' then
    raise exception 'Rejs odwołany';
  end if;
  -- BN1 F7: tylko wyjazd z portem wyjścia w PL (jak propose_id; bałtyckie w BN8).
  if (
    public.ferry_route_is_outbound(v_route) is true
    and exists (
      select 1
        from public.ferry_routes fr
        join public.ferry_ports pf on pf.code = fr.port_from
       where fr.code = upper(btrim(v_route))
         and fr.active
         and pf.country = 'PL'
    )
  ) is not true then
    raise exception 'Tylko trasa wyjazdowa z portem w PL (słownik ferry_routes)';
  end if;

  update public.loads
     set sailing_id = p_sailing_id, updated_at = now()
   where id = p_load_id;

  insert into public.load_events (load_id, event_type, occurred_at, actor_id, payload)
  values (
    p_load_id, 'SAILING_ASSIGNED', now(), v_actor,
    jsonb_build_object(
      'sailing_id', p_sailing_id,
      'from_sailing_id', v_old,
      'powod', 'przypięcie rejsu (korekta mismatch #557)',
      'source', 'SAILING_MISMATCH_ASSIGN'
    )
  );

  update public.risk_signals
     set resolved_at = coalesce(resolved_at, now()),
         resolved_by = coalesce(resolved_by, v_actor)
   where load_id = p_load_id
     and dedup_key like 'SAILING_MISMATCH:' || p_load_id::text || '%'
     and (resolved_at is null or resolved_by is null);

  insert into public.audit_log (user_id, action, entity, entity_id, old_value, new_value)
  values (
    v_actor, 'SAILING_MISMATCH_ASSIGN', 'loads', p_load_id::text,
    jsonb_build_object('sailing_id', v_old),
    jsonb_build_object('sailing_id', p_sailing_id)
  );

  select status into v_status from public.loads where id = p_load_id;
  if v_status in ('IN_TRANSIT_PL', 'AT_PORT_GDANSK')
     and v_dep_eff is not null
     and v_dep_eff <= now() then
    if v_actual_dep is not null and v_actual_dep <= now() then
      v_ferry_src := 'AIS';
    elsif v_plan_dep is not null and v_plan_dep <= now() then
      v_ferry_src := 'SCHEDULE';
    else
      v_ferry_src := null;
    end if;
    if v_ferry_src is not null then
      begin
        v_prev := current_setting('tower.bulk_quiet', true);
        perform set_config('tower.bulk_quiet', 'on', true);
        perform public.auto_set_status(
          p_load_id, v_status, 'FERRY',
          'przypięcie rejsu — ' || v_ferry_src,
          v_dep_eff,
          jsonb_build_object(
            'source', v_ferry_src,
            'sailing_id', p_sailing_id,
            'powod', 'SAILING_MISMATCH_ASSIGN'
          )
        );
        perform set_config('tower.bulk_quiet', coalesce(v_prev, ''), true);
      exception when others then
        perform set_config('tower.bulk_quiet', coalesce(v_prev, ''), true);
        raise warning '#557 assign auto FERRY: %', sqlerrm;
      end;
    end if;
  else
    begin
      perform public.a10_try_ferry_backup(p_load_id, now());
    exception when others then
      raise warning '#557 assign ferry_backup: %', sqlerrm;
    end;
  end if;

  -- DP-136: ostatnia pozycja na lądzie SE albo FI (AIS backup FI/SE).
  select st_y(p.geom_raw::geometry), st_x(p.geom_raw::geometry), p.ts
    into v_lat, v_lon, v_pts
    from public.positions p
   where p.load_id = p_load_id
     and coalesce((p.raw->>'stale_point')::boolean, false) is not true
     and (
       st_covers(public.sweden_land_geom(), p.geom_raw::geometry)
       or st_covers(public.finland_land_geom(), p.geom_raw::geometry)
     )
   order by p.ts desc
   limit 1;

  if v_lat is not null then
    begin
      perform public.apply_ferry_ais_arrival_backup(p_load_id, v_lat, v_lon, v_pts);
      perform public.apply_ferry_se_from_position(p_load_id, v_lat, v_lon, v_pts);
    exception when others then
      raise warning '#557 assign SE rule: %', sqlerrm;
    end;
  end if;

  return jsonb_build_object(
    'ok', true,
    'from_sailing_id', v_old,
    'to_sailing_id', p_sailing_id
  );
end $function$;

revoke all on function public.sailing_mismatch_assign(uuid, uuid) from public, anon;
grant execute on function public.sailing_mismatch_assign(uuid, uuid) to authenticated;
comment on function public.sailing_mismatch_assign(uuid, uuid) is
  'BN1/DP-136: HHL_ADMIN+2FA; outbound PL; FERRY quiet + ląd SE|FI; audit.';

commit;
