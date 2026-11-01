-- DP-137 (F7 #708 / #712): etykiety FI + assign.
-- Enum zostaje IN_TRANSIT_SE / AT_PORT_NYNASHAMN (decyzja 25A: UI „Droga do placu” /
-- „Port przypłynięcia — …” przez routeStatusLabel).
-- apply_ferry_se_from_position jest tylko dla przyjazdu SE (0344); dla FI działa
-- apply_ferry_ais_arrival_backup. Assign woła se_from_position wyłącznie gdy
-- ostatnia pozycja jest na lądzie SE — dla samego FI nie (bez fałszywego „Droga SE”).

begin;

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
  v_on_se boolean := false;
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

  -- DP-136/137: ostatnia pozycja na lądzie SE albo FI.
  select st_y(p.geom_raw::geometry), st_x(p.geom_raw::geometry), p.ts,
         st_covers(public.sweden_land_geom(), p.geom_raw::geometry)
    into v_lat, v_lon, v_pts, v_on_se
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
      -- FI i SE: AIS backup (0368) — etykiety kraju w powodzie (FI/SE).
      perform public.apply_ferry_ais_arrival_backup(p_load_id, v_lat, v_lon, v_pts);
      -- DP-137: Port SE / Droga SE tylko przy lądzie SE (0344 early-return dla FI i tak,
      -- ale nie wołamy se_from_position przy samym FI).
      if v_on_se is true then
        perform public.apply_ferry_se_from_position(p_load_id, v_lat, v_lon, v_pts);
      end if;
    exception when others then
      raise warning '#557 assign SE/FI rule: %', sqlerrm;
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
  'BN1/DP-137: HHL_ADMIN+2FA; outbound PL; AIS backup SE|FI; se_from_position tylko ląd SE.';

commit;
