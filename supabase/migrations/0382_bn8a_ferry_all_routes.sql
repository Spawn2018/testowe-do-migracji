-- BN8a (#720): statusy/mismatch/overdue/OFF_CORRIDOR dla wszystkich tras.
-- loads.ferry_route + load_route_family; kraje ze słownika; assume_dep/overdue per trasa;
-- OFF_CORRIDOR z road_corridor_*→corridor_code (brak = bez alarmu); regresja PL/SE: kody core.
-- BN8b (compute_load_eta) osobno.

begin;

-- ---------------------------------------------------------------------------
-- 1) Schema
-- ---------------------------------------------------------------------------
alter table public.loads
  add column if not exists ferry_route text;

comment on column public.loads.ferry_route is
  'BN8a/#720: trasa promu bez rejsu (awizacja / plik KSH). Null = zachowanie jak dotąd.';

alter table public.loads drop constraint if exists loads_ferry_route_chk;
alter table public.loads
  add constraint loads_ferry_route_chk
  check (ferry_route is null or ferry_route ~ '^[A-Z][A-Z0-9_-]{0,62}$') not valid;
alter table public.loads validate constraint loads_ferry_route_chk;

grant select (ferry_route) on table public.loads to authenticated;
-- W4/F7: tylko nowa kolumna — bez przebudowy grantów całej loads (nazwy tokenów poza diffem).
grant insert (ferry_route), update (ferry_route) on table public.loads to authenticated;

alter table public.ferry_routes
  add column if not exists assume_dep_min integer not null default 60,
  add column if not exists overdue_tolerance_min integer not null default 120;

alter table public.ferry_routes drop constraint if exists ferry_routes_assume_dep_min_chk;
alter table public.ferry_routes
  add constraint ferry_routes_assume_dep_min_chk
  check (assume_dep_min >= 1 and assume_dep_min <= 24 * 60);

alter table public.ferry_routes drop constraint if exists ferry_routes_overdue_tol_chk;
alter table public.ferry_routes
  add constraint ferry_routes_overdue_tol_chk
  check (overdue_tolerance_min >= 1 and overdue_tolerance_min <= 24 * 60);

comment on column public.ferry_routes.assume_dep_min is
  'BN8a: minuty po planie do SCHEDULE_ASSUMED (domyślnie 60).';
comment on column public.ferry_routes.overdue_tolerance_min is
  'BN8a: tolerancja FERRY_OVERDUE (domyślnie 120).';

-- Krótkie przeprawy EE–FI — wartości startowe do kalibracji (#720 pkt 2.4).
update public.ferry_routes
   set assume_dep_min = 20, overdue_tolerance_min = 45
 where family_key in ('TLL-HEL', 'MUU-VUO')
   and assume_dep_min = 60
   and overdue_tolerance_min = 120;

-- Regresja OFF_CORRIDOR PL/SE: legi core muszą mieć corridor_code.
update public.here_road_legs set corridor_code = 'PL_ROAD'
 where leg in ('PL-GDN', 'PL-GDY') and corridor_code is null;
update public.here_road_legs set corridor_code = 'SE_E4'
 where leg = 'SE-NYN' and corridor_code is null;

-- ---------------------------------------------------------------------------
-- 2) Helpery kraju + rodzina trasy ładunku
-- ---------------------------------------------------------------------------
create or replace function public.ferry_route_departure_country(p_route text)
returns char(2)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select pf.country
    from ferry_routes fr
    join ferry_ports pf on pf.code = fr.port_from
   where fr.active
     and (
       fr.code = upper(btrim(p_route))
       or fr.family_key = public.eta_obs_route_family(p_route)
     )
   order by case when fr.code = upper(btrim(p_route)) then 0 else 1 end, fr.code
   limit 1;
$$;

create or replace function public.ferry_route_arrival_country(p_route text)
returns char(2)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select pt.country
    from ferry_routes fr
    join ferry_ports pt on pt.code = fr.port_to
   where fr.active
     and (
       fr.code = upper(btrim(p_route))
       or fr.family_key = public.eta_obs_route_family(p_route)
     )
   order by case when fr.code = upper(btrim(p_route)) then 0 else 1 end, fr.code
   limit 1;
$$;

comment on function public.ferry_route_departure_country(text) is
  'BN8a/#720: kraj portu wyjścia ze słownika ferry_ports.';
comment on function public.ferry_route_arrival_country(text) is
  'BN8a/#720: kraj portu przypłynięcia ze słownika ferry_ports.';

revoke all on function public.ferry_route_departure_country(text) from public, anon, authenticated;
revoke all on function public.ferry_route_arrival_country(text) from public, anon, authenticated;
grant execute on function public.ferry_route_departure_country(text) to service_role;
grant execute on function public.ferry_route_arrival_country(text) to service_role;

create or replace function public.load_route_family(p_load uuid)
returns text
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v text;
begin
  select s.route into v
    from loads l
    left join sailings s on s.id = l.sailing_id
   where l.id = p_load;
  if v is not null then
    return public.eta_obs_route_family(v);
  end if;

  select l.ferry_route into v from loads l where l.id = p_load;
  if v is not null then
    return public.eta_obs_route_family(v);
  end if;

  -- W2/F7: tylko load_id (bez skanu detached); UUID tylko po regexie (nie-UUID w payload nie wywala).
  select coalesce(g.route, e.payload->>'route') into v
    from load_events e
    left join geofences g
      on g.id = case
           when (e.payload->>'geofence_id')
                ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
           then (e.payload->>'geofence_id')::uuid
           else null
         end
   where e.load_id = p_load
     and e.event_type in ('GEOFENCE_ENTER', 'GEOFENCE_EXIT')
     and coalesce(g.kind::text, e.payload->>'geofence_kind') in ('PORT_OUT', 'PRE_PORT')
     and coalesce(g.route, e.payload->>'route') is not null
   order by e.occurred_at desc
   limit 1;
  if v is not null then
    return public.eta_obs_route_family(v);
  end if;
  return null;
end;
$$;

comment on function public.load_route_family(uuid) is
  'BN8a/#720: rejs → loads.ferry_route → strefy PORT_OUT/PRE_PORT; null = jak dawniej.';

revoke all on function public.load_route_family(uuid) from public, anon, authenticated;
grant execute on function public.load_route_family(uuid) to service_role;


-- ---------------------------------------------------------------------------
-- 3) apply_geofence_status
-- ---------------------------------------------------------------------------
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
  if v_status in ('CANCELLED','REMOVED','UNLOADED','DELIVERED','READY_TO_INVOICE','INVOICED') then
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
  v_op := null;
  v_load_route := null;
  select public.eta_obs_operator_key(s.route),
         coalesce(s.route, public.load_route_family(l.id))
    into v_op, v_load_route from loads l left join sailings s on s.id = l.sailing_id
   where l.id = new.load_id;
  -- BN8a: bez fallbacku POLFERRIES; kraj przypłynięcia ze słownika portów.
  v_op := nullif(v_op, '');

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
           format('wjazd w strefę portu wyjścia (%s)', coalesce(v_name, v_op, v_load_route)),
           new.occurred_at, v_detail)
         and loaded_confirmed(new.load_id) is not true then
        perform raise_risk(new.load_id, 'LOADING_UNCONFIRMED', 'MEDIUM',
          format('Pojazd w porcie wyjścia (%s) bez potwierdzenia załadunku', coalesce(v_name, v_op, v_load_route)),
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
          'wjazd do portu przypłynięcia — uzupełniony status Na promie',
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
          format('wjazd w strefę portu przypłynięcia (%s)', coalesce(v_name, v_op, v_load_route)),
          new.occurred_at, v_detail);
      end if;

    elsif v_kind = 'SITE'
          and public.load_status_rank(v_status) >= public.load_status_rank('AT_LOADING')
          and public.load_status_rank(v_status) < public.load_status_rank('AT_SITE') then
      perform auto_set_status(new.load_id, v_status, 'AT_SITE',
        'wjazd na plac budowy', new.occurred_at, v_detail);

    -- Awaryjnie: GPS zgubił wyjazd z portu SE albo cały pobyt w porcie
    -- (sygnał wraca dopiero na lądzie). Auto na drogach SE nie może być na promie.
    elsif v_kind in ('CHECKPOINT','PRE_ARRIVAL')
          and v_country = coalesce(public.ferry_route_arrival_country(v_load_route), 'SE')
          and v_status in ('FERRY','AT_PORT_NYNASHAMN') then
      perform auto_set_status(new.load_id, v_status, 'IN_TRANSIT_SE',
        format('pozycja na trasie %s — wyjazd z portu niezarejestrowany',
               coalesce(public.ferry_route_arrival_country(v_load_route), 'SE')),
        new.occurred_at, v_detail);
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
        format('wyjazd ze strefy portu przypłynięcia (%s)', coalesce(v_name, v_op, v_load_route)),
        new.occurred_at, v_detail);
    end if;
    -- Wyjazd ze strefy portu Gdańsk po przełączeniu na PROM (statek
    -- odpływa) celowo niczego nie zmienia.
  end if;
  return null;
end $function$;

-- ---------------------------------------------------------------------------
-- 4) promote_ferry_departures
-- ---------------------------------------------------------------------------
create or replace function public.promote_ferry_departures(p_now timestamp with time zone default now())
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  r record;
  v_op text;
  v_dep timestamptz;
  v_src text;
  v_reason text;
  v_prev text;
  v_ev bigint;
  v_ev_at timestamptz;
  v_ev_src text;
  n int := 0;
begin
  /* Odwołany rejs — jak dotąd, względem planu (nie AIS). */
  for r in
    select l.id as load_id, l.project_id, l.status, s.id as sailing_id,
           s.route as sailing_route, v.name as vessel,
           coalesce(s.delayed_departure_at, s.departure_at) as plan_dep
      from loads l
      join sailings s on s.id = l.sailing_id and public.ferry_route_is_outbound(s.route)
      join vessels  v on v.id = s.vessel_id
     where s.status = 'ODWOLANY'
       and coalesce(s.delayed_departure_at, s.departure_at) <= p_now
       and l.status in ('PLANNED','RESOURCES_PENDING','DOCS_PENDING','READY',
                        'AT_LOADING','IN_TRANSIT_PL','AT_PORT_GDANSK')
  loop
    perform raise_risk(r.load_id, 'FERRY', 'HIGH',
      format('Rejs %s z %s odwołany — transport wymaga nowego rejsu', r.vessel,
             to_char(r.plan_dep at time zone 'Europe/Warsaw', 'DD.MM HH24:MI')),
      jsonb_build_object(
        'sailing_id', r.sailing_id,
        'title_key', 'rk_sailing_cancelled',
        'params', jsonb_build_object(
          'vessel', r.vessel,
          'dep', to_char(r.plan_dep at time zone 'Europe/Warsaw', 'DD.MM HH24:MI'))),
      'SAILING_CANCELLED:' || r.load_id || ':' || r.sailing_id);
  end loop;

  /* Prom: AIS albo plan+1 h (brak odwołania). Bez spraw MISSED/NO_DEPARTURE.
     F7: tylko READY…AT_PORT_GDANSK (+ FERRY do korekty AIS) — nie PLANNED/DOCS/RESOURCES. */
  for r in
    select l.id as load_id, l.project_id, l.status, s.id as sailing_id,
           s.route as sailing_route, v.name as vessel,
           s.actual_departure_at as actual_dep,
           coalesce(s.delayed_departure_at, s.departure_at) as plan_dep,
           coalesce(fr.assume_dep_min, 60) as assume_dep_min
      from loads l
      join sailings s on s.id = l.sailing_id and public.ferry_route_is_outbound(s.route)
      join vessels  v on v.id = s.vessel_id
      left join ferry_routes fr on fr.code = upper(btrim(s.route)) and fr.active
     where s.status is distinct from 'ODWOLANY'
       and l.status in ('READY','AT_LOADING','IN_TRANSIT_PL','AT_PORT_GDANSK','FERRY')
  loop
    v_dep := null;
    v_src := null;
    v_reason := null;
    v_ev := null;
    v_ev_at := null;
    v_ev_src := null;

    if r.actual_dep is not null and r.actual_dep <= p_now then
      v_dep := r.actual_dep;
      v_src := 'AIS';
      v_reason := 'wypłynięcie rejsu (AIS)';
    elsif r.plan_dep is not null
          and r.plan_dep + make_interval(mins => greatest(coalesce(r.assume_dep_min, 60), 1)) <= p_now
          and r.actual_dep is null then
      v_dep := r.plan_dep + make_interval(mins => greatest(coalesce(r.assume_dep_min, 60), 1));
      v_src := 'SCHEDULE_ASSUMED';
      v_reason := 'wypłynięcie przyjęte z rozkładu (brak AIS, brak odwołania)';
    end if;

    if v_dep is null then
      continue;
    end if;

    v_op := public.eta_obs_operator_key(r.sailing_route); -- BN8a: bez fallbacku POLFERRIES

    /* Już Prom — AIS koryguje godzinę osi (bez powiadomień, jak 0235). */
    if r.status = 'FERRY' and v_src = 'AIS' then
      begin
        select e.id, e.occurred_at, e.payload->>'source'
          into v_ev, v_ev_at, v_ev_src
          from load_events e
         where e.load_id = r.load_id
           and (
             e.event_type = 'STATUS_FERRY'
             or (e.event_type = 'STATUS_AUTO' and e.payload->>'to' = 'FERRY')
           )
           and not exists (
             select 1 from load_events z
              where z.load_id = e.load_id
                and z.payload->>'zastepuje' = e.id::text
           )
         order by e.id desc
         limit 1;
        if v_ev is not null
           and (v_ev_at is distinct from v_dep or coalesce(v_ev_src, '') is distinct from 'AIS') then
          v_prev := current_setting('tower.bulk_quiet', true);
          perform set_config('tower.bulk_quiet', 'on', true);
          insert into load_events (load_id, event_type, occurred_at, payload)
          values (
            r.load_id,
            'STATUS_AUTO',
            v_dep,
            jsonb_build_object(
              'from', 'FERRY',
              'to', 'FERRY',
              'reason', v_reason,
              'sailing_id', r.sailing_id,
              'statek', r.vessel,
              'odejscie', v_dep,
              'route', r.sailing_route,
              'operator', v_op,
              'source', 'AIS',
              'korekta', true,
              'zastepuje', v_ev,
              'poprzednio', v_ev_at,
              'actor', 'system'
            )
          );
          perform set_config('tower.bulk_quiet', coalesce(v_prev, ''), true);
        end if;
      exception when others then
        raise exception 'promote_ferry_departures AIS korekta load=%: %', r.load_id, sqlerrm;
      end;
      continue;
    end if;

    if r.status = 'FERRY' then
      continue;
    end if;

    /* #461: bez dzwonka przy AIS / SCHEDULE_ASSUMED (trg_load_status_matrix_notify × bulk_quiet). */
    v_prev := current_setting('tower.bulk_quiet', true);
    perform set_config('tower.bulk_quiet', 'on', true);
    if public.auto_set_status(
         r.load_id, r.status, 'FERRY', v_reason, v_dep,
         jsonb_build_object(
           'sailing_id', r.sailing_id,
           'statek', r.vessel,
           'odejscie', v_dep,
           'route', r.sailing_route,
           'operator', v_op,
           'source', v_src,
           'actor', 'system'
         )
       ) then
      n := n + 1;
    end if;
    perform set_config('tower.bulk_quiet', coalesce(v_prev, ''), true);
  end loop;
  return n;
end $function$;

-- ---------------------------------------------------------------------------
-- 5) detect_ferry_overdue
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
           coalesce(fr.overdue_tolerance_min, 120) as tol_min,
           public.ferry_route_arrival_country(s.route) as arr_country,
           case
             -- Powrót (arrival PL): bez gałęzi „actual” — ląd docelowy to PL, nie SE|FI.
             when s.actual_arrival_at is not null
                  and public.ferry_route_arrival_country(s.route) in ('SE', 'FI')
                  and s.actual_arrival_at
                      + make_interval(mins => greatest(coalesce(fr.overdue_tolerance_min, 120), 1))
                      < coalesce(p_now, now())
                  and not exists (
                    select 1 from public.positions p
                     where p.load_id = l.id
                       and p.ts > s.actual_arrival_at
                       and coalesce((p.raw->>'stale_point')::boolean, false) is not true
                       and (
                         (public.ferry_route_arrival_country(s.route) = 'FI'
                          and st_covers(public.finland_land_geom(), p.geom_raw::geometry))
                         or (public.ferry_route_arrival_country(s.route) = 'SE'
                             and st_covers(public.sweden_land_geom(), p.geom_raw::geometry))
                       )
                  )
             then 'actual'
             when coalesce(s.delayed_arrival_at, s.arrival_at)
                  + make_interval(mins => greatest(coalesce(fr.overdue_tolerance_min, 120), 1))
                  < coalesce(p_now, now())
             then 'plan'
             else null
           end as why
      from public.loads l
      join public.sailings s on s.id = l.sailing_id
      join public.vessels v on v.id = s.vessel_id
      left join public.ferry_routes fr on fr.code = upper(btrim(s.route)) and fr.active
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
  'BN8a/#720: overdue_tolerance_min per trasa; ląd kraju przypłynięcia SE|FI; dedup sailing_id.';

-- ---------------------------------------------------------------------------
-- 6) sailing_mismatch_propose_id / assign
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
  select l.project_id, coalesce(s.route, l.ferry_route)
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

  -- BN8a: ostatni punkt w kraju wyjścia (PL bbox albo EE/PL strefy PORT_OUT/LOADING).
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
            and g.country in ('PL', 'EE')
            and g.kind in ('PORT_OUT', 'LOADING')
            and st_covers(g.geom, p.geom_raw::geometry)
       )
     );

  -- BN8a: outbound PL/EE → SE/FI; bez ograniczenia do samego PL.
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
          and pf.country in ('PL', 'EE')
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
  'BN8a/#720: outbound PL/EE→SE/FI; filtr rodziny z coalesce(sailing, ferry_route); ląd SE|FI.';

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
  -- BN8a: outbound PL/EE → SE/FI (ferry_route_is_outbound).
  if (public.ferry_route_is_outbound(v_route) is true) is not true then
    raise exception 'Tylko trasa wyjazdowa PL/EE → SE/FI (słownik ferry_routes)';
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
revoke all on function public.sailing_mismatch_assign(uuid, uuid)
  from public, anon;
grant execute on function public.sailing_mismatch_assign(uuid, uuid) to authenticated;
comment on function public.sailing_mismatch_assign(uuid, uuid) is
  'BN8a/#720: HHL_ADMIN+2FA; assign outbound PL/EE→SE/FI; FI AIS-only, SE + se_from_position.';

-- ---------------------------------------------------------------------------
-- 7) process_position — ląd kraju przypłynięcia
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
  v_emit_at   timestamptz;
  v_raw       jsonb;
  v_on_se     boolean;
  v_arr_country char(2);
  v_route_key text;
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

  if current_setting('tower.pos_budget_bypass', true) is distinct from 'on'
     and exists (select 1 from positions
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

  -- BN8a: ląd kraju przypłynięcia (SE/FI); bez trasy — SE|FI jak propose_id.
  -- W2/F7: wyjątek — błąd helpera nie wycofuje zapisu pozycji.
  begin
    select public.load_route_family(p_load_id) into v_route_key;
    v_arr_country := public.ferry_route_arrival_country(v_route_key);
  exception when others then
    v_route_key := null;
    v_arr_country := null;
  end;
  if v_arr_country = 'FI' then
    v_on_se := st_covers(public.finland_land_geom(), v_pt);
  elsif v_arr_country = 'SE' then
    v_on_se := st_covers(public.sweden_land_geom(), v_pt);
  else
    v_on_se := st_covers(public.sweden_land_geom(), v_pt)
           or st_covers(public.finland_land_geom(), v_pt);
  end if;

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
  if coalesce((v_raw->>'stale_point')::boolean, false) is true then
    v_stale := true;
  end if;
  if v_stale then
    v_raw := v_raw || jsonb_build_object(
      'stale_point', true,
      'stale_reason', coalesce(nullif(v_raw->>'stale_reason', ''), 'identical_pl_after_ferry')
    );
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
    v_emit_at := null;

    if v_state.state = 'OUTSIDE' then
      if v_inside then
        /* #571 F7: SITE — 1. swieza pozycja w promieniu (nie histereza); bez PENDING_IN. */
        if v_fence.kind = 'SITE'
           or v_state.consec_fixes + 1 >= v_fence.debounce_fixes then
          v_new_state := 'INSIDE';
          v_emit := 'GEOFENCE_ENTER';
          v_emit_at := p_ts;
        else
          v_new_state := 'PENDING_IN';
        end if;
      end if;

    elsif v_state.state = 'PENDING_IN' then
      /* #571: SITE (legacy PENDING_IN) od razu; inaczej debounce albo dwell. */
      if v_inside then
        if v_fence.kind = 'SITE' then
          v_new_state := 'INSIDE';
          v_emit := 'GEOFENCE_ENTER';
          v_emit_at := coalesce(v_state.entered_at, p_ts);
        elsif v_state.consec_fixes + 1 >= v_fence.debounce_fixes then
          v_new_state := 'INSIDE';
          v_emit := 'GEOFENCE_ENTER';
          v_emit_at := p_ts;
        elsif v_fence.dwell_seconds > 0
              and v_state.entered_at is not null
              and p_ts - v_state.entered_at >= make_interval(secs => v_fence.dwell_seconds) then
          v_new_state := 'INSIDE';
          v_emit := 'GEOFENCE_ENTER';
          v_emit_at := v_state.entered_at;
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
                and case
                      when (e.payload->>'geofence_id')
                           ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                      then (e.payload->>'geofence_id')::uuid
                      else null
                    end = v_fence.id
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
      entered_at   = case
                       /* OUTSIDE→PENDING_IN / OUTSIDE→INSIDE: czas tej wizyty. */
                       when v_new_state = 'PENDING_IN' and v_state.state = 'OUTSIDE' then p_ts
                       when v_emit = 'GEOFENCE_ENTER' and v_state.state = 'OUTSIDE' then p_ts
                       /* PENDING_IN→INSIDE: czas pierwszej pozycji (entered_at). */
                       when v_emit = 'GEOFENCE_ENTER' then coalesce(v_state.entered_at, p_ts)
                       /* Wyjazd / powrót do OUTSIDE — zeruj (F7 #574: dwell_min, GEOFENCE_DWELL). */
                       when v_emit = 'GEOFENCE_EXIT' then null
                       when v_new_state = 'OUTSIDE' then null
                       else v_state.entered_at
                     end,
      exited_at    = case when v_emit = 'GEOFENCE_EXIT'  then p_ts else v_state.exited_at end,
      last_eval_at = p_ts
    where load_id = p_load_id and geofence_id = v_fence.id;

    if v_emit is not null then
      v_emit_at := coalesce(v_emit_at, p_ts);
      v_dedup := v_emit || ':' || p_load_id || ':' || v_fence.id || ':'
                 || to_char(v_emit_at at time zone 'UTC', 'YYYYMMDDHH24MI');
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
        p_load_id, v_emit, v_emit_at, p_source, v_pt,
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
revoke all on function public.process_position(uuid, double precision, double precision, timestamptz, position_source, numeric, numeric, boolean, jsonb) from public, anon, authenticated;
grant execute on function public.process_position(uuid, double precision, double precision, timestamptz, position_source, numeric, numeric, boolean, jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- 8) refresh_load_eta — OFF_CORRIDOR ze słownika legów
-- ---------------------------------------------------------------------------
create or replace function public.refresh_load_eta(p_load uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  r record;
  l record;
  v_end timestamptz;
  v_delay int;
  v_has boolean;
  v_kind risk_kind;
  v_off numeric;
  v_max_off numeric := null;
  v_span numeric := 0;
  v_samples int := 0;
  v_blocked boolean := false;
  v_corr text;
  v_eta_ok boolean;
  v_op text;
  v_route text;
  v_stena_dual boolean := false;
begin
  select * into r from compute_load_eta(p_load);
  select * into l from loads where id = p_load;
  if not found then return; end if;

  select load_delivery_deadline(l.plan_delivery_date, l.plan_delivery_to) into v_end;
  v_delay := case when r.eta is null or v_end is null then null
                  else greatest(0, round(extract(epoch from (r.eta - v_end)) / 60))::int end;

  perform set_config('tower.eta_ctx', 'on', true);
  update loads set eta_site = r.eta, eta_confidence_min = r.conf_min, eta_basis = r.basis, eta_computed_at = now(),
         delay_minutes = v_delay
   where id = p_load
     and (eta_site is distinct from r.eta or eta_confidence_min is distinct from r.conf_min
          or (eta_basis - 'computed_at') is distinct from (r.basis - 'computed_at')
          or delay_minutes is distinct from v_delay);
  perform set_config('tower.eta_ctx', '', true);

  v_has := exists (select 1 from positions p where p.load_id = p_load)
    or l.status in (
      'READY','AT_LOADING','IN_TRANSIT_PL','AT_PORT_GDANSK',
      'FERRY','AT_PORT_NYNASHAMN','IN_TRANSIT_SE','AT_SITE'
    );
  -- #590: wyklucz CANCELLED i REMOVED (strażnik import.sh; 0315 przepisało 0298 — nie zgub przy replace)
  v_eta_ok := l3_eta_alarm(r.eta, v_end, v_has)
    and l.actual_delivery_at is null
    and l.status::text not in ('CANCELLED', 'REMOVED')
    and public.load_status_rank(l.status) < public.load_status_rank('AT_SITE'::public.load_status);

  if v_eta_ok then
    perform l3_upsert_alarm(l.project_id, p_load, 'ETA_BREACH', 'ETA_BREACH:' || p_load,
      format('Opóźnienie %s min wobec planu dostawy (próg %s)', v_delay, l3_ops('DELAY_MIN')),
      'rk_eta_breach', true, true, now() + interval '2 hours',
      jsonb_build_object('params', jsonb_build_object('minutes', v_delay, 'threshold', l3_ops('DELAY_MIN'))),
      now());
  else
    perform l3_upsert_alarm(l.project_id, p_load, 'ETA_BREACH', 'ETA_BREACH:' || p_load,
      'ETA', 'rk_eta_breach', false, false, null, '{}'::jsonb, now());
    update risk_signals set resolved_at = now()
     where load_id = p_load and kind = 'ETA_BREACH' and resolved_at is null
       and dedup_key = 'ETA_BREACH:' || p_load and coalesce(detail->>'l3', '') <> '1';
  end if;

  v_blocked := l.status = 'FERRY' or l.status not in ('IN_TRANSIT_PL', 'IN_TRANSIT_SE');
  v_op := null;
  v_route := null;
  v_route := public.load_route_family(p_load);
  v_op := public.eta_obs_operator_key(v_route);

  -- BN8a: korytarz z ferry_routes.road_corridor_* → here_road_legs.corridor_code;
  -- brak kodu = brak alarmu (v_blocked). Regresja PL/SE: corridor_code legów core.
  if l.status = 'IN_TRANSIT_SE' then
    v_kind := 'ROAD_SE'::risk_kind;
    select h.corridor_code into v_corr
      from public.ferry_routes fr
      join public.here_road_legs h on h.leg = fr.road_corridor_post
     where fr.active
       and fr.family_key = public.eta_obs_route_family(v_route)
       and public.ferry_route_is_outbound(fr.code)
     order by fr.code
     limit 1;
    if v_corr is null and v_route is not null then
      select h.corridor_code into v_corr
        from public.ferry_routes fr
        join public.here_road_legs h on h.leg = fr.road_corridor_post
       where fr.active and fr.code = upper(btrim(v_route))
       limit 1;
    end if;
    if v_corr in ('SE_E22', 'SE_KAA_INLAND') or v_op = 'STENA' then
      v_stena_dual := true;
      v_corr := coalesce(nullif(v_corr, 'SE_KAA_INLAND'), 'SE_E22');
    end if;
  elsif l.status = 'IN_TRANSIT_PL' then
    v_kind := 'ROAD_PL'::risk_kind;
    select h.corridor_code into v_corr
      from public.ferry_routes fr
      join public.here_road_legs h on h.leg = fr.road_corridor_pre
     where fr.active
       and fr.family_key = public.eta_obs_route_family(v_route)
       and public.ferry_route_is_outbound(fr.code)
     order by fr.code
     limit 1;
    if v_corr is null and v_route is not null then
      select h.corridor_code into v_corr
        from public.ferry_routes fr
        join public.here_road_legs h on h.leg = fr.road_corridor_pre
       where fr.active and fr.code = upper(btrim(v_route))
       limit 1;
    end if;
  else
    v_kind := 'ROAD_PL'::risk_kind;
    v_corr := null;
  end if;

  -- W1/F7: bez trasy — PL_ROAD tylko w prostokącie PL (jak propose_id);
  -- SE bez trasy → null (0339: brak v_op ⇒ brak v_corr; nie SE_E4 na Stena/FI).
  -- Znana rodzina bez corridor_code → brak alarmu (Bałtyk LT/LV, #720).
  if v_corr is null and v_route is null and l.status = 'IN_TRANSIT_PL' then
    select 'PL_ROAD' into v_corr
      from public.positions p
     where p.load_id = p_load
       and coalesce((p.raw->>'stale_point')::boolean, false) is not true
       and st_x(p.geom_raw::geometry) between 14.0 and 24.2
       and st_y(p.geom_raw::geometry) between 49.0 and 54.45
     order by p.ts desc
     limit 1;
  end if;

  -- B3/F7 BN8a: alarm OFF_CORRIDOR tylko rdzeń (PL_ROAD / SE_E4 / Stena dual).
  -- Kody BN7 (PL_EE_E67, FI_E75, SE_E4_STO, SE_E18_KPS) → BN8b (§3); tu bez alarmu.
  if v_stena_dual is not true
     and v_corr is distinct from 'PL_ROAD'
     and v_corr is distinct from 'SE_E4' then
    v_blocked := true;
    v_samples := 0;
    v_max_off := 0;
    v_span := 0;
  elsif v_stena_dual is not true
     and (v_corr is null
          or not exists (
            select 1 from corridor_polylines cp
             where cp.code = v_corr and coalesce(cp.total_km, 0) > 0
          )) then
    v_blocked := true;
    v_samples := 0;
    v_max_off := 0;
    v_span := 0;
  elsif v_stena_dual is true
        and not exists (
          select 1 from corridor_polylines cp
           where cp.code = 'SE_E22' and coalesce(cp.total_km, 0) > 0
        )
        and not exists (
          select 1 from corridor_polylines cp
           where cp.code = public.stena_se_inland_corridor_code()
             and coalesce(cp.total_km, 0) > 0
        ) then
    v_blocked := true;
    v_samples := 0;
    v_max_off := 0;
    v_span := 0;
  else
    if v_stena_dual is true then
      select count(*)::int,
             max(n.off_m),
             min(n.off_m),
             coalesce(extract(epoch from (max(s.ts) - min(s.ts))) / 60.0, 0),
             coalesce(bool_or(l3_in_port_or_yard(s.g)), false),
             (array_agg(n.corridor_code order by s.ts desc))[1]
        into v_samples, v_max_off, v_off, v_span, v_has, v_corr
        from (
          select ts, coalesce(geom_snapped, geom_raw) as g
            from positions
           where load_id = p_load
           order by ts desc
           limit 2
        ) s
        cross join lateral stena_se_corridor_nearest(s.g) n;
    else
      select count(*)::int,
             max(cp.off_m),
             min(cp.off_m),
             coalesce(extract(epoch from (max(s.ts) - min(s.ts))) / 60.0, 0),
             coalesce(bool_or(l3_in_port_or_yard(s.g)), false)
        into v_samples, v_max_off, v_off, v_span, v_has
        from (
          select ts, coalesce(geom_snapped, geom_raw) as g
            from positions
           where load_id = p_load
           order by ts desc
           limit 2
        ) s
        cross join lateral corridor_progress(v_corr, s.g) cp;
    end if;
    if coalesce(v_off, 0) <= l3_ops('OFFROUTE_KM') * 1000 then
      v_max_off := 0;
    end if;
    v_blocked := v_blocked or coalesce(v_has, false);
  end if;

  if l3_deviation_alarm(v_max_off, v_samples, v_span, v_blocked) then
    perform l3_upsert_alarm(l.project_id, p_load, v_kind, 'OFF_CORRIDOR:' || p_load,
      format('Zjazd z trasy z zezwolenia: %s m od korytarza OSM (próg %s m)', round(v_max_off), l3_ops('OFFROUTE_KM') * 1000),
      'rk_off_corridor', true, true, now() + interval '1 hour',
      jsonb_build_object('params', jsonb_build_object(
        'meters', round(v_max_off), 'threshold', l3_ops('OFFROUTE_KM') * 1000, 'corridor', v_corr)),
      now());
  else
    update risk_signals set resolved_at = now()
     where load_id = p_load and resolved_at is null and dedup_key = 'OFF_CORRIDOR:' || p_load;
    perform l3_lapse('OFF_CORRIDOR:' || p_load, now());
  end if;
end $$;


-- ferry_sailings_map: bez zmian względem 0370 (DP-134) — nie cofaj coalesce GDN ani fr.active.
-- (wcześniejsza wersja w tej migracji psuła BN4/DP-134; przywrócona jawnie.)
create or replace function public.ferry_sailings_map()
returns table (
  sailing_id uuid,
  vessel_id uuid,
  vessel_name text,
  mmsi bigint,
  route text,
  status text,
  departure_at timestamptz,
  arrival_at timestamptz,
  departed_at timestamptz,
  arrived_at timestamptz,
  dep_port text,
  arr_port text,
  dep_lat double precision,
  dep_lon double precision,
  arr_lat double precision,
  arr_lon double precision,
  ais_lat double precision,
  ais_lon double precision,
  ais_observed_at timestamptz,
  ais_source text,
  ais_sog_kn real
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if (public.current_app_user_id() is null) then
    raise exception 'Brak aktywnego konta' using errcode = '42501';
  end if;
  return query
  with base as (
    select
      s.id as sailing_id,
      s.vessel_id,
      ves.name as vessel_name,
      ves.mmsi,
      s.route,
      s.status::text as status,
      s.departure_at,
      s.arrival_at,
      s.actual_departure_at as departed_at,
      s.actual_arrival_at as arrived_at,
      fr.port_from as dep_port,
      fr.port_to as arr_port
    from sailings s
    join vessels ves on ves.id = s.vessel_id
    join ferry_routes fr on fr.code = s.route
    where s.status is distinct from 'ODWOLANY'
      and coalesce(s.actual_departure_at, s.delayed_departure_at, s.departure_at) <= now() + interval '6 hours'
      and coalesce(s.actual_arrival_at, s.delayed_arrival_at, s.arrival_at) >= now() - interval '6 hours'
  ),
  latest_ais as (
    select distinct on (vp.vessel_id)
      vp.vessel_id,
      vp.lat,
      vp.lon,
      vp.observed_at,
      vp.source::text as source,
      vp.sog_kn
    from vessel_positions vp
    where vp.vessel_id in (select b.vessel_id from base b)
    order by vp.vessel_id, vp.observed_at desc, vp.id desc
  )
  select
    b.sailing_id,
    b.vessel_id,
    b.vessel_name,
    b.mmsi,
    b.route,
    b.status,
    b.departure_at,
    b.arrival_at,
    b.departed_at,
    b.arrived_at,
    b.dep_port,
    b.arr_port,
    pd.lat,
    pd.lon,
    pa.lat,
    pa.lon,
    la.lat,
    la.lon,
    la.observed_at,
    la.source,
    la.sog_kn
  from base b
  join ferry_ports pd on pd.code = b.dep_port
  join ferry_ports pa on pa.code = b.arr_port
  left join latest_ais la on la.vessel_id = b.vessel_id
  order by coalesce(b.departed_at, b.departure_at);
end
$$;

revoke all on function public.ferry_sailings_map() from public, anon;
grant execute on function public.ferry_sailings_map() to authenticated;
comment on function public.ferry_sailings_map() is
  'BN4/DP-134: rejsy mapy + AIS; join ferry_routes bez fr.active (wyłączona trasa zostaje na mapie).';


revoke all on function public.apply_geofence_status() from public, anon, authenticated;

revoke all on function public.promote_ferry_departures(timestamptz) from public, anon, authenticated;
grant execute on function public.promote_ferry_departures(timestamptz) to service_role;
comment on function public.promote_ferry_departures(timestamptz) is
  'BN1: FERRY po AIS/plan+1h; trasy outbound ze słownika; operator = eta_obs_operator_key.';

revoke all on function public.apply_ferry_ais_arrival_backup(uuid, double precision, double precision, timestamptz)
  from public, anon, authenticated;
grant execute on function public.apply_ferry_ais_arrival_backup(uuid, double precision, double precision, timestamptz)
  to service_role;
comment on function public.apply_ferry_ais_arrival_backup(uuid, double precision, double precision, timestamptz) is
  'BN1: Port SE/Droga SE; operator i strefa z ferry_* (rodzina trasy).';

revoke all on function public.refresh_load_eta(uuid) from public, anon, authenticated;
grant execute on function public.refresh_load_eta(uuid) to service_role;
comment on function public.refresh_load_eta(uuid) is
  'BN8a/#720: OFF_CORRIDOR tylko core PL_ROAD/SE_E4/Stena dual; BN7 kody→bez alarmu (BN8b); bez trasy→PL_ROAD w bbox PL, SE null.';

-- ---------------------------------------------------------------------------
-- 9) eta_record_segment_observations — filtr po trasie
-- ---------------------------------------------------------------------------
create or replace function public.eta_record_segment_observations(p_load uuid)
returns int
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  t_load_exit timestamptz;
  t_port_in timestamptz;
  t_port_out timestamptz;
  t_pin_enter timestamptz;
  t_pin_exit timestamptz;
  t_site timestamptz;
  t_site_bound timestamptz;
  t_delivery timestamptz;
  t_exit_before timestamptz;
  t_cross_end timestamptz;
  t_window_end timestamptz;
  n int := 0;
  v_route text;
  v_op text;
  c_pl text;
  c_ci text;
  c_cross text;
  c_se text;
  v_id bigint;
  v_port_out_src text;
  v_pin_src text;
  v_pin_late_h numeric;
  v_actual timestamptz;
  v_delayed timestamptz;
  v_arrival timestamptz;
  v_eff_dep timestamptz;
  v_feat jsonb;
  v_sailing_ok boolean := false;
  v_sailing_mismatch boolean := false;
begin
  if not exists (select 1 from loads where id = p_load) then
    return 0;
  end if;

  delete from eta_segment_observations
   where load_id = p_load
     and (features->>'p4k') = 'true'
     and (
       exclude_reason is null
       or exclude_reason in (
         'LUKA_GPS', 'POKRYCIE_GPS', 'BRAK_GPS', 'TRASA_NIEZNANA', 'BRAK_ZDARZENIA'
       )
     );

  v_route := eta_obs_route_key(p_load);
  if v_route is null then
    v_id := eta_upsert_segment_observation(
      p_load, 'PL_ROAD', null, null, false, 'TRASA_NIEZNANA'
    );
    return case when v_id is null then 0 else 1 end;
  end if;

  c_pl := eta_obs_segment_code(v_route, 'PL_ROAD');
  c_ci := eta_obs_segment_code(v_route, 'PORT_CHECKIN');
  c_cross := eta_obs_segment_code(v_route, 'CROSSING');
  c_se := eta_obs_segment_code(v_route, 'SE_ROAD');

  v_op := public.eta_record_v_op(v_route);

  t_load_exit := eta_seg_event_at(p_load, 'GEOFENCE_EXIT', 'LOADING', null, null, null);
  -- BN8a: filtr zdarzeń portowych po trasie (nie operatorze) — TLL-STO itd.
  t_port_in := eta_seg_event_at(p_load, 'GEOFENCE_ENTER', 'PORT_OUT', t_load_exit, null, v_route);
  t_pin_enter := eta_seg_event_at(p_load, 'GEOFENCE_ENTER', 'PORT_IN', t_port_in, null, v_route);

  t_site_bound := eta_seg_event_at(p_load, 'GEOFENCE_ENTER', 'SITE', t_port_in, null, null);
  select l.actual_delivery_at into t_delivery from loads l where l.id = p_load;

  select s.actual_departure_at, s.delayed_departure_at, s.actual_arrival_at
    into v_actual, v_delayed, v_arrival
    from loads l
    left join sailings s on s.id = l.sailing_id
   where l.id = p_load;

  v_eff_dep := coalesce(v_actual, v_delayed);

  -- F7 r2 P2: EXIT w [ENTER, PIN−1µs] — bez górnej granicy z rejsu
  if t_pin_enter is not null then
    t_exit_before := t_pin_enter - interval '1 microsecond';
  else
    t_exit_before := coalesce(t_site_bound, t_delivery);
  end if;

  t_port_out := eta_seg_event_at(
    p_load, 'GEOFENCE_EXIT', 'PORT_OUT', t_port_in, t_exit_before, v_route
  );
  v_port_out_src := case when t_port_out is not null then 'EVENT' else null end;

  -- #626 pkt 1: EXIT ≥ PIN → odrzuć
  if t_port_out is not null
     and t_pin_enter is not null
     and t_port_out >= t_pin_enter then
    t_port_out := null;
    v_port_out_src := null;
  end if;

  -- F7 r2: 1) jest EVENT EXIT < PIN → pasuje ⇔ abs(EXIT−eff_dep) ≤ 1 h
  if t_port_out is not null then
    if v_eff_dep is not null
       and abs(extract(epoch from (t_port_out - v_eff_dep))) <= 3600 then
      v_sailing_ok := true;
    else
      v_sailing_ok := false;
      if v_eff_dep is not null then
        v_sailing_mismatch := true;
      end if;
    end if;
  else
    -- 2) brak EVENT EXIT < PIN: eff_dep w oknie ENTER < dep < coalesce(PIN,SITE,delivery)
    -- actual poza oknem → BRAK bez fallbacku na delayed (#624)
    t_window_end := coalesce(t_pin_enter, t_site_bound, t_delivery);
    if t_port_in is not null and v_actual is not null then
      if v_actual > t_port_in
         and (t_window_end is null or v_actual < t_window_end) then
        t_port_out := v_actual;
        v_port_out_src := 'SAILING_ACTUAL';
        v_sailing_ok := true;
      end if;
    elsif t_port_in is not null and v_delayed is not null then
      if v_delayed > t_port_in
         and (t_window_end is null or v_delayed < t_window_end) then
        t_port_out := v_delayed;
        v_port_out_src := 'SAILING_DELAYED';
        v_sailing_ok := true;
      end if;
    end if;
  end if;

  t_site := eta_seg_event_at(p_load, 'GEOFENCE_ENTER', 'SITE', coalesce(t_pin_enter, t_port_out), null, null);
  t_pin_exit := eta_seg_event_at(p_load, 'GEOFENCE_EXIT', 'PORT_IN', t_pin_enter, t_site, v_route);

  if t_load_exit is not null and t_port_in is not null then
    v_id := eta_upsert_segment_observation(p_load, c_pl, t_load_exit, t_port_in, true, null);
    if v_id is not null then
      n := n + 1;
    end if;
  end if;

  if t_port_in is not null and t_port_out is not null and t_port_out > t_port_in then
    v_id := eta_upsert_segment_observation(p_load, c_ci, t_port_in, t_port_out, false, null);
    if v_id is not null then
      n := n + 1;
      v_feat := jsonb_build_object();
      if v_port_out_src is not null then
        v_feat := v_feat || jsonb_build_object('port_out_src', v_port_out_src);
      end if;
      if v_sailing_mismatch is true then
        v_feat := v_feat || jsonb_build_object('sailing_mismatch', true);
      end if;
      if v_feat <> '{}'::jsonb then
        update eta_segment_observations
           set features = features || v_feat
         where id = v_id;
      end if;
    end if;
  elsif t_port_in is not null then
    v_id := eta_upsert_segment_observation(
      p_load, c_ci, t_port_in, coalesce(t_pin_enter, t_port_in), false, 'BRAK_ZDARZENIA'
    );
    if v_id is not null then
      n := n + 1;
    end if;
  end if;

  -- F7 r2 pkt 3: CROSSING trim tylko gdy rejs pasuje
  t_cross_end := t_pin_enter;
  v_pin_src := case when t_pin_enter is not null then 'EVENT' else null end;
  v_pin_late_h := null;
  if v_sailing_ok is true and t_pin_enter is not null and v_arrival is not null then
    if t_pin_enter > v_arrival + interval '1 hour' then
      t_cross_end := v_arrival + interval '1 hour';
      v_pin_src := 'SAILING_ACTUAL_ARR';
    end if;
    if t_pin_enter > v_arrival + interval '6 hours' then
      v_pin_late_h := round(
        (extract(epoch from (t_pin_enter - v_arrival)) / 3600.0)::numeric, 2
      );
    end if;
  end if;

  -- actual_arrival < EXIT → CROSSING BRAK (tylko gdy rejs pasuje; F7 r3)
  if t_port_out is not null
     and v_sailing_ok is true
     and v_arrival is not null
     and v_arrival < t_port_out then
    v_id := eta_upsert_segment_observation(
      p_load, c_cross, t_port_out, t_port_out, false, 'BRAK_ZDARZENIA'
    );
    if v_id is not null then
      n := n + 1;
    end if;
  elsif t_port_out is not null
     and t_cross_end is not null
     and t_cross_end > t_port_out
     and t_port_out > t_port_in then
    v_id := eta_upsert_segment_observation(p_load, c_cross, t_port_out, t_cross_end, false, null);
    if v_id is not null then
      n := n + 1;
      v_feat := jsonb_build_object();
      if v_port_out_src is not null then
        v_feat := v_feat || jsonb_build_object('port_out_src', v_port_out_src);
      end if;
      if v_pin_src is not null then
        v_feat := v_feat || jsonb_build_object('pin_src', v_pin_src);
      end if;
      if v_pin_late_h is not null then
        v_feat := v_feat || jsonb_build_object('pin_late_h', v_pin_late_h);
      end if;
      if v_sailing_mismatch is true then
        v_feat := v_feat || jsonb_build_object('sailing_mismatch', true);
      end if;
      if v_feat <> '{}'::jsonb then
        update eta_segment_observations
           set features = features || v_feat
         where id = v_id;
      end if;
    end if;
  elsif t_port_out is not null then
    v_id := eta_upsert_segment_observation(
      p_load, c_cross, t_port_out, t_port_out, false, 'BRAK_ZDARZENIA'
    );
    if v_id is not null then
      n := n + 1;
    end if;
  end if;

  -- SE_ROAD: start od EXIT PORT_IN; pin_late_h tylko gdy rejs pasuje
  if t_pin_exit is not null and t_site is not null then
    v_id := eta_upsert_segment_observation(p_load, c_se, t_pin_exit, t_site, true, null);
    if v_id is not null then
      n := n + 1;
      if v_pin_late_h is not null then
        update eta_segment_observations
           set features = features || jsonb_build_object('pin_late_h', v_pin_late_h)
         where id = v_id;
      end if;
    end if;
  elsif t_pin_enter is not null and t_site is not null and t_pin_exit is null then
    v_id := eta_upsert_segment_observation(
      p_load, c_se, t_pin_enter, t_site, true, 'BRAK_ZDARZENIA'
    );
    if v_id is not null then
      n := n + 1;
      if v_pin_late_h is not null then
        update eta_segment_observations
           set features = features || jsonb_build_object('pin_late_h', v_pin_late_h)
         where id = v_id;
      end if;
    end if;
  end if;

  return n;
end;
$$;
revoke all on function public.eta_record_segment_observations(uuid)
  from public, anon, authenticated;
grant execute on function public.eta_record_segment_observations(uuid) to service_role;
comment on function public.eta_record_segment_observations(uuid) is
  'BN8a/#720: eta_seg_event_at z v_route (nie operatorem); reszta jak #626.';

comment on function public.apply_geofence_status() is
  'BN8a/#720: kraj przypłynięcia ze słownika; bez fallbacku POLFERRIES; awaryjne CHECKPOINT/PRE_ARRIVAL.';

commit;
