-- #557 PR2 — reguły po dopłynięciu (D-20261025-1630-01) + F7 r2/r3 (#562):
-- 1) AIS: FERRY/AT_PORT_NYNASHAMN → Port SE / Droga SE bez g.active; aktywna PORT_IN → return
-- 2) overdue w detect_ferry_overdue; bez osobnego crona; skip po ręcznym zamknięciu
-- 3) stary punkt emtrack: raw.stale_point
-- 4) zły rejs: dedup z sailing_id; assign HHL_ADMIN+2FA + FERRY quiet

-- ---------------------------------------------------------------------------
-- 1. Awaryjne: FERRY / AT_PORT_NYNASHAMN → Port SE / Droga SE
-- ---------------------------------------------------------------------------
create or replace function public.apply_ferry_ais_arrival_backup(
  p_load_id uuid,
  p_lat double precision,
  p_lon double precision,
  p_ts timestamptz
) returns boolean
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_status     load_status;
  v_project    uuid;
  v_arr        timestamptz;
  v_route      text;
  v_op         text;
  v_pt         geometry(Point, 4326);
  v_port       record;
  v_in_port    boolean := false;
  v_port_m     double precision;
  v_on_land_se boolean := false;
  v_prev       text;
  v_detail     jsonb;
  v_ok         boolean := false;
begin
  if p_lat is null or p_lon is null then
    return false;
  end if;

  select l.status, l.project_id, s.actual_arrival_at, s.route
    into v_status, v_project, v_arr, v_route
    from public.loads l
    left join public.sailings s on s.id = l.sailing_id
   where l.id = p_load_id;

  if v_status is null or v_status not in ('FERRY', 'AT_PORT_NYNASHAMN') then
    return false;
  end if;
  if v_status = 'FERRY'
     and (v_arr is not null and coalesce(p_ts, now()) > v_arr) is not true then
    return false;
  end if;

  if v_route in ('GDY-KAA', 'KAA-GDY') then
    v_op := 'STENA';
  elsif v_route in ('GDN-NYN', 'NYN-GDN') then
    v_op := 'POLFERRIES';
  elsif v_route is null then
    v_op := 'POLFERRIES';
  else
    return false;
  end if;

  -- Aktywna PORT_IN → 0298 (histereza); backup tylko gdy strefa wyłączona.
  if exists (
    select 1 from public.geofences g
     where g.project_id = v_project
       and g.active
       and g.kind = 'PORT_IN'
       and g.country = 'SE'
       and coalesce(g.route, 'POLFERRIES') = v_op
  ) then
    return false;
  end if;

  v_pt := st_setsrid(st_makepoint(p_lon, p_lat), 4326);

  -- Geometria PORT_IN bez g.active (najbliższa). „W porcie” przed lądem SE (F7 r3).
  select g.id, g.name, g.geom
    into v_port
    from public.geofences g
   where g.project_id = v_project
     and g.kind = 'PORT_IN'
     and g.country = 'SE'
     and coalesce(g.route, 'POLFERRIES') = v_op
   order by st_distance(g.geom::geography, v_pt::geography)
   limit 1;

  v_detail := jsonb_build_object(
    'geofence_id', v_port.id,
    'geofence_name', v_port.name,
    'geofence_kind', 'PORT_IN',
    'source', 'AIS_ARRIVAL_BACKUP',
    'zdarzenie', 'POSITION',
    'without_geofence', true
  );

  if v_port.id is not null then
    v_in_port := st_contains(v_port.geom, v_pt);
    v_port_m := st_distance(v_port.geom::geography, v_pt::geography);
  end if;

  if v_status = 'FERRY' and v_in_port then
    v_ok := public.auto_set_status(
      p_load_id, 'FERRY', 'AT_PORT_NYNASHAMN',
      format('pozycja w strefie portu SE (%s)', coalesce(v_port.name, v_op)),
      coalesce(p_ts, now()),
      v_detail
    );
    if v_ok then
      update public.risk_signals
         set resolved_at = now()
       where load_id = p_load_id
         and dedup_key like 'FERRY_OVERDUE:' || p_load_id::text || '%'
         and resolved_at is null;
    end if;
    return coalesce(v_ok, false);
  end if;

  v_on_land_se := st_covers(public.sweden_land_geom(), v_pt);
  if v_on_land_se is not true then
    return false;
  end if;

  if v_port.id is not null and (v_port_m >= 2000) is not true then
    return false;
  end if;

  -- AT_PORT_NYNASHAMN + ≥2 km → Droga SE (F7 r3 pkt 1).
  if v_status = 'AT_PORT_NYNASHAMN' then
    v_ok := public.auto_set_status(
      p_load_id, 'AT_PORT_NYNASHAMN', 'IN_TRANSIT_SE',
      'pozycja na trasie SE po promie',
      coalesce(p_ts, now()),
      v_detail || jsonb_build_object('powod', 'pozycja na trasie SE po promie')
    );
    if coalesce(v_ok, false) then
      update public.risk_signals
         set resolved_at = now()
       where load_id = p_load_id
         and dedup_key like 'FERRY_OVERDUE:' || p_load_id::text || '%'
         and resolved_at is null;
    end if;
    return coalesce(v_ok, false);
  end if;

  -- FERRY + ≥2 km: jak 0298 — syntetyczny Port SE (quiet) + Droga SE.
  v_prev := current_setting('tower.bulk_quiet', true);
  perform set_config('tower.bulk_quiet', 'on', true);
  v_ok := public.auto_set_status(
    p_load_id, 'FERRY', 'AT_PORT_NYNASHAMN',
    'pozycja na trasie SE po promie — uzupełniony Port SE',
    least(coalesce(v_arr, p_ts), coalesce(p_ts, now())),
    v_detail || jsonb_build_object(
      'synthetic', true,
      'synthetic_port_se', true,
      'powod', 'pozycja na trasie SE po promie'
    )
  );
  perform set_config('tower.bulk_quiet', coalesce(v_prev, ''), true);

  select status into v_status from public.loads where id = p_load_id;
  if v_status = 'AT_PORT_NYNASHAMN' then
    v_ok := public.auto_set_status(
      p_load_id, 'AT_PORT_NYNASHAMN', 'IN_TRANSIT_SE',
      'pozycja na trasie SE po promie',
      coalesce(p_ts, now()),
      v_detail || jsonb_build_object('powod', 'pozycja na trasie SE po promie')
    );
  end if;

  if coalesce(v_ok, false) then
    update public.risk_signals
       set resolved_at = now()
     where load_id = p_load_id
       and dedup_key like 'FERRY_OVERDUE:' || p_load_id::text || '%'
       and resolved_at is null;
  end if;
  return coalesce(v_ok, false);
end $function$;

revoke all on function public.apply_ferry_ais_arrival_backup(uuid, double precision, double precision, timestamptz)
  from public, anon, authenticated;
grant execute on function public.apply_ferry_ais_arrival_backup(uuid, double precision, double precision, timestamptz)
  to service_role;
comment on function public.apply_ferry_ais_arrival_backup(uuid, double precision, double precision, timestamptz) is
  '#557 F7 r3: FERRY/AT_PORT→Port SE/Droga SE; w porcie przed lądem; bez g.active.';

-- ---------------------------------------------------------------------------
-- 2. detect_ferry_overdue — plan + actual_arrival+2h bez SE; zamykanie po SE
-- ---------------------------------------------------------------------------
create or replace function public.detect_ferry_overdue(
  p_now timestamptz default now(),
  p_grace interval default interval '2 hours'
) returns integer
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  r record;
  n int := 0;
  v_code text;
  v_title text;
  v_params jsonb;
begin
  -- Zamknij overdue po przejściu do SE.
  update public.risk_signals rs
     set resolved_at = coalesce(p_now, now())
   where rs.resolved_at is null
     and rs.dedup_key like 'FERRY_OVERDUE:%'
     and exists (
       select 1 from public.loads l
        where l.id = rs.load_id
          and public.load_status_rank(l.status)
              >= public.load_status_rank('AT_PORT_NYNASHAMN'::public.load_status)
     );

  for r in
    select l.id as load_id, l.project_id, s.id as sailing_id, v.name as vessel,
           coalesce(s.delayed_arrival_at, s.arrival_at) as plan_arr,
           s.actual_arrival_at as act_arr,
           case
             when s.actual_arrival_at is not null
                  and s.actual_arrival_at + coalesce(p_grace, interval '2 hours')
                      < coalesce(p_now, now())
                  and not exists (
                    select 1 from public.positions p
                     where p.load_id = l.id
                       and p.ts > s.actual_arrival_at
                       and coalesce((p.raw->>'stale_point')::boolean, false) is not true
                       and st_covers(public.sweden_land_geom(), p.geom_raw::geometry)
                  )
             then 'actual'
             when coalesce(s.delayed_arrival_at, s.arrival_at) + coalesce(p_grace, interval '2 hours')
                  < coalesce(p_now, now())
             then 'plan'
             else null
           end as why
      from public.loads l
      join public.sailings s on s.id = l.sailing_id
      join public.vessels v on v.id = s.vessel_id
     where l.status = 'FERRY'
  loop
    if r.why is null then
      continue;
    end if;
    -- F7 r3: po ręcznym zamknięciu nie wraca.
    if exists (
      select 1 from public.risk_signals
       where dedup_key = 'FERRY_OVERDUE:' || r.load_id || ':' || r.sailing_id
         and resolved_at is not null
    ) then
      continue;
    end if;
    v_code := coalesce(
      nullif(nullif(btrim(public.load_sms_code(r.load_id)), ''), '—'),
      'transport'
    );
    if r.why = 'actual' then
      v_title := format('Sprawdź %s po dopłynięciu', v_code);
      v_params := jsonb_build_object('code', v_code, 'vessel', r.vessel,
        'arr', to_char(r.act_arr at time zone 'Europe/Warsaw', 'DD.MM HH24:MI'));
      perform public.raise_risk(
        r.load_id, 'FERRY', 'MEDIUM', v_title,
        jsonb_build_object(
          'sailing_id', r.sailing_id,
          'title_key', 'rk_ferry_check_after_arrival',
          'params', v_params,
          'why', r.why,
          'actual_arrival_at', r.act_arr
        ),
        'FERRY_OVERDUE:' || r.load_id || ':' || r.sailing_id
      );
    else
      v_title := format(
        'Transport nadal w statusie PROM, choć %s miał przypłynąć %s',
        r.vessel,
        to_char(r.plan_arr at time zone 'Europe/Warsaw', 'DD.MM HH24:MI')
      );
      v_params := jsonb_build_object('vessel', r.vessel,
        'arr', to_char(r.plan_arr at time zone 'Europe/Warsaw', 'DD.MM HH24:MI'));
      perform public.raise_risk(
        r.load_id, 'FERRY', 'MEDIUM', v_title,
        jsonb_build_object(
          'sailing_id', r.sailing_id,
          'title_key', 'rk_ferry_overdue',
          'params', v_params,
          'why', r.why,
          'actual_arrival_at', r.act_arr
        ),
        'FERRY_OVERDUE:' || r.load_id || ':' || r.sailing_id
      );
    end if;
    n := n + 1;
  end loop;
  return n;
end $function$;

revoke all on function public.detect_ferry_overdue(timestamptz, interval)
  from public, anon, authenticated;
grant execute on function public.detect_ferry_overdue(timestamptz, interval)
  to service_role;
comment on function public.detect_ferry_overdue(timestamptz, interval) is
  '#557 F7: plan overdue + actual_arrival+2h bez SE; dedup sailing_id; zamyka po SE.';

-- Usuń osobny cron / funkcję arrival_check (F7 pkt 10).
do $cron557$
begin
  if to_regclass('cron.job') is not null then
    perform cron.unschedule(j.jobid)
      from cron.job j where j.jobname = 'tower-ferry-arrival-check';
  end if;
exception when others then
  raise warning '#557 unschedule ferry-arrival-check: %', sqlerrm;
end $cron557$;

drop function if exists public.ferry_check_arrival_overdue(timestamptz);

-- ---------------------------------------------------------------------------
-- 3. Propozycja / wykrywanie złego rejsu
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
  v_first_se timestamptz;
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

  select min(p.ts) into v_first_se
    from public.positions p
   where p.load_id = p_load_id
     and coalesce((p.raw->>'stale_point')::boolean, false) is not true
     and st_covers(public.sweden_land_geom(), p.geom_raw::geometry);

  if v_first_se is null then
    return null;
  end if;

  -- Ostatni punkt w PL (bbox lądu ≤54.45°N albo PORT_OUT/LOADING — bez PRE_PORT/zatoki).
  select max(p.ts) into v_last_pl
    from public.positions p
   where p.load_id = p_load_id
     and p.ts < v_first_se
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

  select s.id into v_prop
    from public.sailings s
   where s.project_id = v_project
     and s.status is distinct from 'ODWOLANY'
     and s.actual_departure_at is not null
     and s.route in ('GDN-NYN', 'GDY-KAA')
     and (v_route is null
          or (v_route in ('GDN-NYN', 'NYN-GDN') and s.route = 'GDN-NYN')
          or (v_route in ('GDY-KAA', 'KAA-GDY') and s.route = 'GDY-KAA'))
     and (v_last_pl is null or s.actual_departure_at >= v_last_pl)
     and s.actual_departure_at <= v_first_se
     and (s.actual_arrival_at is null or s.actual_arrival_at <= v_first_se)
   order by s.actual_departure_at desc, s.id
   limit 1;

  return v_prop;
end $function$;

revoke all on function public.sailing_mismatch_propose_id(uuid)
  from public, anon, authenticated;
grant execute on function public.sailing_mismatch_propose_id(uuid) to service_role;
comment on function public.sailing_mismatch_propose_id(uuid) is
  '#557 F7: rejs GDN-NYN/GDY-KAA z actual_dep w oknie PL→SE; bez ODWOLANY.';

create or replace function public.detect_sailing_mismatch(
  p_load_id uuid,
  p_ts timestamptz default now()
) returns boolean
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_project uuid;
  v_sail    uuid;
  v_status  load_status;
  v_dep_eff timestamptz;
  v_prop    uuid;
  v_code    text;
  v_key     text;
begin
  select l.project_id, l.sailing_id, l.status,
         coalesce(s.actual_departure_at, s.delayed_departure_at, s.departure_at)
    into v_project, v_sail, v_status, v_dep_eff
    from public.loads l
    left join public.sailings s on s.id = l.sailing_id
   where l.id = p_load_id;

  if v_project is null or v_sail is null then
    return false;
  end if;
  -- Także Port SE / Droga SE: ENTER (debounce=1 w prod) zdąży zmienić status
  -- zanim wykrycie po pętli stref — nadal mismatch, gdy rejs nie wypłynął.
  if v_status not in (
    'IN_TRANSIT_PL', 'AT_PORT_GDANSK', 'FERRY',
    'AT_PORT_NYNASHAMN', 'IN_TRANSIT_SE'
  ) then
    return false;
  end if;
  if public.loaded_confirmed(p_load_id) is not true then
    return false;
  end if;

  -- Wypłynął (AIS lub SCHEDULE_ASSUMED) ≤ pozycja SE → OK.
  if v_dep_eff is not null and v_dep_eff <= coalesce(p_ts, now()) then
    return false;
  end if;

  v_key := 'SAILING_MISMATCH:' || p_load_id::text || ':' || v_sail::text;
  -- Najpierw otwarte ryzyko; potem propozycja.
  if exists (
    select 1 from public.risk_signals
     where dedup_key = v_key and resolved_at is null
  ) then
    return true;
  end if;
  -- F7 r3: po ręcznym zamknięciu nie wraca przy każdej pozycji SE.
  if exists (
    select 1 from public.risk_signals
     where dedup_key = v_key and resolved_at is not null
  ) then
    return false;
  end if;

  v_prop := public.sailing_mismatch_propose_id(p_load_id);
  v_code := public.load_sms_code(p_load_id);
  if v_code is null or btrim(v_code) = '' or v_code = '—' then
    v_code := 'transport';
  end if;

  insert into public.risk_signals (
    project_id, load_id, kind, severity, title, title_key, detail, dedup_key, audience
  ) values (
    v_project, p_load_id, 'FERRY', 'HIGH',
    'Auto w SE, a przypisany rejs jeszcze nie wypłynął',
    'rk_sailing_mismatch',
    jsonb_build_object(
      'title_key', 'rk_sailing_mismatch',
      'params', jsonb_build_object('code', v_code),
      'assigned_sailing_id', v_sail,
      'proposed_sailing_id', v_prop,
      'pos_at', coalesce(p_ts, now())
    ),
    v_key,
    'HHL'
  )
  on conflict (dedup_key) where dedup_key is not null and resolved_at is null do nothing;

  return true;
end $function$;

revoke all on function public.detect_sailing_mismatch(uuid, timestamptz)
  from public, anon, authenticated;
grant execute on function public.detect_sailing_mismatch(uuid, timestamptz) to service_role;
comment on function public.detect_sailing_mismatch(uuid, timestamptz) is
  '#557 F7: SE + rejs niewypłynięty; status PL/port/FERRY/Port SE/Droga SE + loaded.';

-- Zamykanie SAILING_MISMATCH przy każdej zmianie sailing_id.
create or replace function public.trg_loads_sailing_mismatch_resolve()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $trg$
begin
  if tg_op is distinct from 'UPDATE' then
    return new;
  end if;
  if old.sailing_id is not distinct from new.sailing_id then
    return new;
  end if;
  update public.risk_signals
     set resolved_at = now(),
         resolved_by = public.current_app_user_id()
   where load_id = new.id
     and dedup_key like 'SAILING_MISMATCH:' || new.id::text || '%'
     and resolved_at is null;
  return new;
end
$trg$;

drop trigger if exists trg_loads_sailing_mismatch_resolve on public.loads;
create trigger trg_loads_sailing_mismatch_resolve
  after update of sailing_id on public.loads
  for each row
  when (old.sailing_id is distinct from new.sailing_id)
  execute function public.trg_loads_sailing_mismatch_resolve();

revoke all on function public.trg_loads_sailing_mismatch_resolve()
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. RPC: suggest (odczyt) / assign (tylko HHL_ADMIN + 2FA)
-- ---------------------------------------------------------------------------
create or replace function public.sailing_mismatch_suggest(p_load_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_sail uuid;
  v_prop uuid;
  v_label text;
  v_open boolean;
begin
  if auth.uid() is null or public.current_app_user_id() is null then
    raise exception 'Brak aktywnego konta' using errcode = '42501';
  end if;
  if (public.is_hhl()) is not true then
    raise exception 'wyłącznie HHL' using errcode = '42501';
  end if;

  select l.sailing_id into v_sail from public.loads l where l.id = p_load_id;
  if v_sail is null and not exists (select 1 from public.loads where id = p_load_id) then
    return jsonb_build_object('ok', false, 'reason', 'unknown_load');
  end if;

  v_open := exists (
    select 1 from public.risk_signals r
     where r.load_id = p_load_id
       and r.dedup_key like 'SAILING_MISMATCH:' || p_load_id::text || '%'
       and r.resolved_at is null
  );
  v_prop := public.sailing_mismatch_propose_id(p_load_id);
  if v_prop is not null then
    select coalesce(v.name, '') || ' ' || to_char(s.departure_at at time zone 'UTC', 'DD.MM HH24:MI')
      into v_label
      from public.sailings s
      left join public.vessels v on v.id = s.vessel_id
     where s.id = v_prop;
  end if;

  return jsonb_build_object(
    'ok', true,
    'mismatch', v_open,
    'assigned_sailing_id', v_sail,
    'proposed_sailing_id', v_prop,
    'proposed_label', v_label
  );
end $function$;

revoke all on function public.sailing_mismatch_suggest(uuid) from public, anon;
grant execute on function public.sailing_mismatch_suggest(uuid) to authenticated;
comment on function public.sailing_mismatch_suggest(uuid) is
  '#557 RPC odczyt: HHL (w tym OPS) — propozycja rejsu; bez assert_not_preview.';

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
  if v_route is distinct from 'GDN-NYN' and v_route is distinct from 'GDY-KAA' then
    raise exception 'Tylko trasa GDN-NYN lub GDY-KAA';
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

  -- Trigger ustawia resolved_by; tu uzupełnienie gdy trigger nie złapał.
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

  -- F7 r3: IN_TRANSIT_PL/AT_PORT_GDANSK + odejście ≤ now → FERRY quiet.
  -- actual_departure → AIS; tylko plan/opóźnienie → SCHEDULE (0276 cofa oba).
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

  select st_y(p.geom_raw::geometry), st_x(p.geom_raw::geometry), p.ts
    into v_lat, v_lon, v_pts
    from public.positions p
   where p.load_id = p_load_id
     and coalesce((p.raw->>'stale_point')::boolean, false) is not true
     and st_covers(public.sweden_land_geom(), p.geom_raw::geometry)
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
  '#557 F7 r3: HHL_ADMIN+2FA; GDN-NYN/GDY-KAA; FERRY quiet + SE; audit.';

-- ---------------------------------------------------------------------------
-- 5. process_position — stary punkt + backup AIS + mismatch (exception wrap)
-- ---------------------------------------------------------------------------
create or replace function public.process_position(
  p_load_id  uuid,
  p_lat      double precision,
  p_lon      double precision,
  p_ts       timestamptz,
  p_source   position_source default 'TELEMATICS_API',
  p_speed    numeric default null,
  p_heading  numeric default null,
  p_ignition boolean default null,
  p_raw      jsonb default '{}'::jsonb
) returns table (event_type text, geofence_id uuid, geofence_name text)
language plpgsql security definer set search_path = public as $$
-- POPRAWKA 24.09.2026: kolumny wyniku (event_type, geofence_id) mają te same
-- nazwy co kolumny tabel geofence_states i load_events. Bez tej dyrektywy
-- każde wywołanie ze strefą w zasięgu kończyło się błędem „column reference
-- is ambiguous", a cała transakcja — razem z pozycją — była wycofywana.
-- Funkcja w tej postaci nigdy nie przetworzyła punktu w strefie.
#variable_conflict use_column
declare
  v_pt        geometry(Point, 4326);
  v_project   uuid;
  v_fence     record;
  v_state     record;
  v_inside    boolean;
  v_outside_h boolean;
  v_new_state geofence_state_kind;
  v_emit      text;
  v_dedup     text;
  v_payload   jsonb;
  v_dwell_min numeric;
  v_status    load_status;
  v_dep_eff   timestamptz;
  v_stale     boolean := false;
  v_raw       jsonb;
  v_on_se     boolean;
  v_prev_geom geometry;
begin
  if p_lat is null or p_lon is null then return; end if;
  if abs(p_lat) < 0.001 and abs(p_lon) < 0.001 then return; end if;
  if p_speed is not null and p_speed > 130 then return; end if;

  if public.load_in_tracking_window(p_load_id, coalesce(p_ts, now())) is not true then
    return;
  end if;
  perform set_config('tower.track_ctx', 'on', true);
  update loads
     set tracking_opened_at = public.tracking_window_start(plan_load_date)
   where id = p_load_id
     and tracking_opened_at is null
     and plan_load_date is not null;
  perform set_config('tower.track_ctx', 'off', true);

  if exists (select 1 from positions
              where load_id = p_load_id and ts <= p_ts and ts > p_ts - interval '60 seconds') then
    return;
  end if;

  v_pt := st_setsrid(st_makepoint(p_lon, p_lat), 4326);
  select project_id, status into v_project, v_status from loads where id = p_load_id;
  if v_project is null then
    raise exception 'Nieznany load_id: %', p_load_id;
  end if;

  select coalesce(s.actual_departure_at, s.delayed_departure_at, s.departure_at)
    into v_dep_eff
    from loads l
    left join sailings s on s.id = l.sailing_id
   where l.id = p_load_id;

  v_on_se := st_covers(public.sweden_land_geom(), v_pt);

  /* #557 F7 pkt 9: stary punkt — ≥ FERRY albo AT_PORT_GDANSK po odejściu;
     jeden ostatni nie-stary z ts <= odejście. */
  if v_on_se is not true
     and (
       public.load_status_rank(v_status) >= public.load_status_rank('FERRY'::public.load_status)
       or (v_status = 'AT_PORT_GDANSK'
           and v_dep_eff is not null
           and v_dep_eff <= coalesce(p_ts, now()))
     )
  then
    select prev.geom_raw::geometry into v_prev_geom
      from positions prev
     where prev.load_id = p_load_id
       and coalesce((prev.raw->>'stale_point')::boolean, false) is not true
       and (v_dep_eff is null or prev.ts <= v_dep_eff)
     order by prev.ts desc
     limit 1;
    if v_prev_geom is not null
       and st_dwithin(v_prev_geom::geography, v_pt::geography, 5) then
      v_stale := true;
    end if;
  end if;

  v_raw := coalesce(p_raw, '{}'::jsonb);
  if v_stale then
    v_raw := v_raw || jsonb_build_object('stale_point', true, 'stale_reason', 'identical_pl_after_ferry');
  end if;

  insert into positions (load_id, ts, geom_raw, speed_kmh, heading_deg, ignition, source, raw)
  values (p_load_id, p_ts, v_pt, p_speed, p_heading, p_ignition, p_source, v_raw)
  on conflict (load_id, ts, source) do nothing;

  if v_stale then
    return;
  end if;

  -- #557: mismatch PRZED ENTER (debounce=1 PORT_IN SE w prod / 0274) —
  -- inaczej status skacze do Port SE i wykrycie na końcu nic nie robi.
  if v_on_se then
    begin
      perform public.detect_sailing_mismatch(p_load_id, coalesce(p_ts, now()));
    exception when others then
      raise warning '#557 detect_sailing_mismatch: %', sqlerrm;
    end;
  end if;

  for v_fence in
    select g.* from geofences g
    where g.project_id = v_project and g.active
      and st_dwithin(g.geom::geography, v_pt::geography, g.hysteresis_m + 50)
    union
    select g.* from geofences g
    join geofence_states s on s.geofence_id = g.id and s.load_id = p_load_id
    where g.project_id = v_project and g.active and s.state <> 'OUTSIDE'
  loop
    v_inside    := st_contains(v_fence.geom, v_pt);
    v_outside_h := not st_dwithin(v_fence.geom::geography, v_pt::geography, v_fence.hysteresis_m);

    insert into geofence_states (load_id, geofence_id, state, consec_fixes, last_eval_at)
    values (p_load_id, v_fence.id, 'OUTSIDE', 0, p_ts)
    on conflict (load_id, geofence_id) do nothing;

    select * into v_state from geofence_states
      where load_id = p_load_id and geofence_id = v_fence.id for update;

    v_new_state := v_state.state;
    v_emit := null;

    if v_state.state = 'OUTSIDE' then
      if v_inside then
        if v_state.consec_fixes + 1 >= v_fence.debounce_fixes then
          v_new_state := 'INSIDE';
          v_emit := 'GEOFENCE_ENTER';
        else
          v_new_state := 'PENDING_IN';
        end if;
      end if;

    elsif v_state.state = 'PENDING_IN' then
      if v_inside then
        if v_state.consec_fixes + 1 >= v_fence.debounce_fixes then
          v_new_state := 'INSIDE';
          v_emit := 'GEOFENCE_ENTER';
        end if;
      else
        v_new_state := 'OUTSIDE';
      end if;

    elsif v_state.state = 'INSIDE' then
      if v_outside_h then
        v_new_state := 'PENDING_OUT';
      elsif v_fence.dwell_seconds > 0
            and v_state.entered_at is not null
            and p_ts - v_state.entered_at >= make_interval(secs => v_fence.dwell_seconds)
            and not exists (
              select 1 from load_events e
              where e.load_id = p_load_id
                and e.event_type = 'GEOFENCE_DWELL'
                and (e.payload->>'geofence_id')::uuid = v_fence.id
                and e.occurred_at >= v_state.entered_at
            ) then
        v_emit := 'GEOFENCE_DWELL';
      end if;

    elsif v_state.state = 'PENDING_OUT' then
      if v_inside then
        v_new_state := 'INSIDE';
      elsif v_outside_h then
        v_new_state := 'OUTSIDE';
        v_emit := 'GEOFENCE_EXIT';
      end if;
    end if;

    update geofence_states set
      state        = v_new_state,
      consec_fixes = case
                       when v_new_state in ('PENDING_IN') then v_state.consec_fixes + 1
                       when v_new_state = 'INSIDE' and v_state.state <> 'INSIDE' then 0
                       when v_new_state = 'OUTSIDE' then 0
                       else v_state.consec_fixes
                     end,
      entered_at   = case when v_emit = 'GEOFENCE_ENTER' then p_ts else v_state.entered_at end,
      exited_at    = case when v_emit = 'GEOFENCE_EXIT'  then p_ts else v_state.exited_at end,
      last_eval_at = p_ts
    where load_id = p_load_id and geofence_id = v_fence.id;

    if v_emit is not null then
      v_dedup := v_emit || ':' || p_load_id || ':' || v_fence.id || ':'
                 || to_char(p_ts at time zone 'UTC', 'YYYYMMDDHH24MI');
      v_payload := jsonb_build_object(
        'geofence_id',   v_fence.id,
        'geofence_name', v_fence.name,
        'geofence_kind', v_fence.kind,
        'notify_orgs',   to_jsonb(v_fence.notify_orgs),
        'message_tpl',   v_fence.message_tpl
      );
      if v_emit in ('GEOFENCE_EXIT', 'GEOFENCE_DWELL') and v_state.entered_at is not null then
        v_dwell_min := round(extract(epoch from (p_ts - v_state.entered_at)) / 60.0);
        v_payload := v_payload || jsonb_build_object(
          'dwell_min', v_dwell_min,
          'entered_at', v_state.entered_at,
          'minutes', v_dwell_min
        );
      end if;

      insert into load_events (load_id, event_type, occurred_at, source, geom, payload, dedup_key)
      values (
        p_load_id, v_emit, p_ts, p_source, v_pt,
        v_payload,
        v_dedup
      )
      -- POPRAWKA 24.09.2026: indeks unikalny na dedup_key jest częściowy
      -- (where dedup_key is not null) — bez tego warunku Postgres odrzucał
      -- zapis i żadne zdarzenie wjazdu ani wyjazdu nie mogło powstać.
      on conflict (dedup_key) where dedup_key is not null do nothing;

      event_type    := v_emit;
      geofence_id   := v_fence.id;
      geofence_name := v_fence.name;
      return next;
    end if;
  end loop;

  /* #485: Port SE / Droga SE z pozycji (gdy strefa aktywna). */
  begin
    perform public.apply_ferry_se_from_position(p_load_id, p_lat, p_lon, coalesce(p_ts, now()));
  exception when others then
    raise warning '#557 apply_ferry_se_from_position: %', sqlerrm;
  end;
  /* #557: awaryjne AIS — gdy PORT_IN nieaktywny. */
  begin
    perform public.apply_ferry_ais_arrival_backup(p_load_id, p_lat, p_lon, coalesce(p_ts, now()));
  exception when others then
    raise warning '#557 apply_ferry_ais_arrival_backup: %', sqlerrm;
  end;

  return;
end $$;

revoke all on function public.process_position(uuid, double precision, double precision, timestamptz, position_source, numeric, numeric, boolean, jsonb)
  from public, anon, authenticated;
grant execute on function public.process_position(uuid, double precision, double precision, timestamptz, position_source, numeric, numeric, boolean, jsonb)
  to service_role;
comment on function public.process_position(uuid, double precision, double precision, timestamptz, position_source, numeric, numeric, boolean, jsonb) is
  '#485+#557 F7: strefy; Port SE; AIS backup; stale_point; sailing mismatch; exception wrap.';
