-- 0160 — FERRY-STATUS: żywy rozkład Steny, komunikat armatora, pogoda obu tras,
-- korytarz E22 i ETA alternatywy (dojazd + rejs + droga SE + czas pracy).
-- H1_ROUTE_CHECK i H3_CORRIDOR_OBSTACLES nie są ruszane (zostają false).
-- Bez kasowania transportów.

alter table public.corridor_polylines drop constraint if exists corridor_polylines_code_check;
alter table public.corridor_polylines add constraint corridor_polylines_code_check
  check (code in ('PL_ROAD', 'SE_E4', 'SE_E22'));

alter table public.corridor_conditions drop constraint if exists corridor_conditions_corridor_check;
alter table public.corridor_conditions add constraint corridor_conditions_corridor_check
  check (corridor in ('SE_E4', 'SE_E22'));

alter table public.marine_conditions drop constraint if exists marine_conditions_corridor_check;
alter table public.marine_conditions add constraint marine_conditions_corridor_check
  check (corridor in ('BALTIC_GDN_NYN', 'BALTIC_GDY_KAA'));

alter table public.eta_segment_params drop constraint if exists eta_segment_params_code_check;
alter table public.eta_segment_params add constraint eta_segment_params_code_check
  check (code in (
    'PL_ROAD', 'PL_ROAD_GDY', 'PORT_CHECKIN', 'CROSSING_DEFAULT',
    'SE_ROAD', 'SE_ROAD_KAA', 'SE_DAILY_REST', 'SE_BREAKS', 'GPS_FRESH_MIN'
  ));

insert into public.eta_segment_params (code, label, hours, spread_pct, source)
values
  ('PL_ROAD_GDY', 'Droga PL: KSH Śrem → terminal Gdynia', 8.2, 25,
   'FERRY-STATUS: Śrem–Gdynia dłuższe niż Śrem–Gdańsk; zezwolenie obejmuje obie trasy (D-45)'),
  ('SE_ROAD_KAA', 'Droga SE: Karlskrona → E22 → E4 → Boden', 21.5, 20,
   'FERRY-STATUS: Karlskrona–Boden przez E22 do E4, dłużej niż Nynäshamn–E4')
on conflict (code) do update set
  hours = excluded.hours,
  spread_pct = excluded.spread_pct,
  label = excluded.label,
  source = excluded.source,
  updated_at = now();

insert into public.corridor_polylines (code, geom, total_km, source)
values (
  'SE_E22',
  st_setsrid(st_makeline(array[
    st_makepoint(15.5866, 56.1616), st_makepoint(14.862, 56.170), st_makepoint(16.366, 56.663),
    st_makepoint(16.637, 57.758), st_makepoint(16.320, 58.480), st_makepoint(16.183, 58.594),
    st_makepoint(18.0686, 59.3293), st_makepoint(17.6389, 59.8586), st_makepoint(17.1413, 60.6749),
    st_makepoint(17.1056, 61.7274), st_makepoint(17.3069, 62.3908), st_makepoint(17.9379, 62.6323),
    st_makepoint(18.7153, 63.2909), st_makepoint(20.2630, 63.8258), st_makepoint(20.9528, 64.7507),
    st_makepoint(21.4794, 65.3172), st_makepoint(22.1547, 65.5848), st_makepoint(21.7591, 65.8054)
  ]), 4326),
  round((st_length(st_setsrid(st_makeline(array[
    st_makepoint(15.5866, 56.1616), st_makepoint(14.862, 56.170), st_makepoint(16.366, 56.663),
    st_makepoint(16.637, 57.758), st_makepoint(16.320, 58.480), st_makepoint(16.183, 58.594),
    st_makepoint(18.0686, 59.3293), st_makepoint(17.6389, 59.8586), st_makepoint(17.1413, 60.6749),
    st_makepoint(17.1056, 61.7274), st_makepoint(17.3069, 62.3908), st_makepoint(17.9379, 62.6323),
    st_makepoint(18.7153, 63.2909), st_makepoint(20.2630, 63.8258), st_makepoint(20.9528, 64.7507),
    st_makepoint(21.4794, 65.3172), st_makepoint(22.1547, 65.5848), st_makepoint(21.7591, 65.8054)
  ]), 4326)::geography) / 1000.0)::numeric, 2),
  'OSM / ODbL — Karlskrona → E22 → Norrköping → E4 → Boden (FERRY-STATUS)'
)
on conflict (code) do update set
  geom = excluded.geom, total_km = excluded.total_km, source = excluded.source, updated_at = now();

insert into public.corridor_conditions (corridor, slowdown_mult, reason, detail, source)
values ('SE_E22', 1.00, null, jsonb_build_object('drogi', jsonb_build_array('E22', 'E4'), 'status', 'start'), 'TRAFIKVERKET')
on conflict (corridor) do nothing;

insert into public.marine_conditions (corridor, max_wave_m, max_gust_kn, risk, sources, attribution, detail)
values (
  'BALTIC_GDY_KAA', null, null, 'niskie', '',
  'Dane: FMI / DMI / SMHI (CC BY 4.0)',
  jsonb_build_object('status', 'start — brak odczytu', 'punkty', jsonb_build_array('Gdynia', 'środek', 'Karlskrona'))
)
on conflict (corridor) do nothing;

comment on table public.marine_conditions is
  'II-8 / FERRY-STATUS: pogoda Gdańsk–Nynäshamn i Gdynia–Karlskrona. Progi D-39 (3,8 m / 40 kn) włączone — nie czekają na II-3.';

update public.app_parameters
   set label = 'II-8: odczyt pogody morskiej FMI+DMI+SMHI, alarmy D-39 włączone (nie odkładane do II-3)',
       value = 1
 where key = 'MARINE_WEATHER_ENABLED' and (value is distinct from 1 or label not like '%D-39%');

create table if not exists public.operator_notices (
  id            uuid primary key default gen_random_uuid(),
  sailing_id    uuid not null references public.sailings(id),
  operator      text not null check (operator in ('POLFERRIES', 'STENA')),
  kind          text not null check (kind in ('ODWOLANY', 'OPOZNIONY', 'ZMIANA_GODZINY')),
  new_departure timestamptz,
  note          text,
  created_by    uuid not null references public.app_users(id),
  created_at    timestamptz not null default now()
);
comment on table public.operator_notices is
  'FERRY-STATUS: ręczny komunikat armatora. Skutki jak status automatyczny (ETA, FERRY_CANCELLED). Historia: kto i kiedy.';
alter table public.operator_notices enable row level security;
revoke all on public.operator_notices from public, anon, authenticated;
grant select on public.operator_notices to authenticated;
grant select, insert, update, delete on public.operator_notices to service_role;
drop policy if exists operator_notices_read on public.operator_notices;
create policy operator_notices_read on public.operator_notices
  for select to authenticated
  using (current_app_user_id() is not null);

create or replace function public.operator_notice_apply(
  p_sailing uuid, p_kind text, p_new_departure timestamptz, p_note text
) returns uuid
language plpgsql security definer set search_path = public as $fn$
declare
  v_user uuid;
  v_route text;
  v_op text;
  v_dep timestamptz;
  v_arr timestamptz;
  v_id uuid;
  v_delta interval;
begin
  if (current_app_role() in ('HHL_ADMIN', 'CARRIER_DISPATCH')) is not true then
    raise exception 'Komunikat armatora — wyłącznie administrator albo dyspozytor przewoźnika' using errcode = '42501';
  end if;
  v_user := current_app_user_id();
  if v_user is null then
    raise exception 'Brak aktywnego konta' using errcode = '42501';
  end if;
  if p_sailing is null or p_kind is null or p_kind not in ('ODWOLANY', 'OPOZNIONY', 'ZMIANA_GODZINY') then
    raise exception 'Brak rejsu albo nieznany typ komunikatu' using errcode = '22023';
  end if;
  if p_kind <> 'ODWOLANY' and p_new_departure is null then
    raise exception 'Nowa godzina jest wymagana' using errcode = '22023';
  end if;
  select route, coalesce(delayed_departure_at, departure_at), coalesce(delayed_arrival_at, arrival_at)
    into v_route, v_dep, v_arr
    from sailings where id = p_sailing;
  if v_route is null then
    raise exception 'Brak rejsu' using errcode = '22023';
  end if;
  v_op := case when v_route in ('GDY-KAA', 'KAA-GDY') then 'STENA' else 'POLFERRIES' end;
  insert into operator_notices (sailing_id, operator, kind, new_departure, note, created_by)
  values (p_sailing, v_op, p_kind, p_new_departure, nullif(btrim(coalesce(p_note, '')), ''), v_user)
  returning id into v_id;
  if p_kind = 'ODWOLANY' then
    update sailings set status = 'ODWOLANY', source = 'RECZNIE' where id = p_sailing;
  else
    v_delta := p_new_departure - v_dep;
    update sailings set
      status = 'OPOZNIONY',
      source = 'RECZNIE',
      delayed_departure_at = p_new_departure,
      delayed_arrival_at = v_arr + v_delta
    where id = p_sailing;
  end if;
  return v_id;
end
$fn$;
revoke all on function public.operator_notice_apply(uuid, text, timestamptz, text) from public, anon;
grant execute on function public.operator_notice_apply(uuid, text, timestamptz, text) to authenticated;

create or replace function public.trg_sailing_cancelled_loads()
returns trigger
language plpgsql security definer set search_path = public as $fn$
declare
  r record;
  v_vessel text;
  v_dep timestamptz;
begin
  if (new.status = 'ODWOLANY') is not true then
    return new;
  end if;
  if old.status is not distinct from 'ODWOLANY' then
    return new;
  end if;
  select name into v_vessel from vessels where id = new.vessel_id;
  v_dep := coalesce(new.delayed_departure_at, new.departure_at);
  for r in
    select id from loads
     where sailing_id = new.id
       and status not in ('CANCELLED', 'UNLOADED', 'DELIVERED')
  loop
    perform raise_risk(
      r.id, 'FERRY', 'HIGH',
      format('Rejs %s z %s odwołany — transport wymaga nowego rejsu', coalesce(v_vessel, 'prom'),
             to_char(v_dep at time zone 'Europe/Warsaw', 'DD.MM HH24:MI')),
      jsonb_build_object(
        'sailing_id', new.id,
        'title_key', 'rk_sailing_cancelled',
        'route', new.route,
        'params', jsonb_build_object(
          'vessel', coalesce(v_vessel, 'prom'),
          'dep', to_char(v_dep at time zone 'Europe/Warsaw', 'DD.MM HH24:MI'))),
      'SAILING_CANCELLED:' || r.id || ':' || new.id);
  end loop;
  return new;
end
$fn$;
drop trigger if exists trg_sailing_cancelled_loads on public.sailings;
create trigger trg_sailing_cancelled_loads
  after update of status on public.sailings
  for each row execute function public.trg_sailing_cancelled_loads();

create or replace function public.crossing_route_plan(p_route text, p_dep timestamptz, p_arr timestamptz)
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'pl_h', case when p_route in ('GDY-KAA', 'KAA-GDY')
      then (select hours from eta_segment_params where code = 'PL_ROAD_GDY')
      else (select hours from eta_segment_params where code = 'PL_ROAD') end,
    'crossing_h', case when p_dep is null or p_arr is null then null
      else round((extract(epoch from (p_arr - p_dep)) / 3600.0)::numeric, 2) end,
    'se_h', case when p_route in ('GDY-KAA', 'KAA-GDY')
      then (select hours from eta_segment_params where code = 'SE_ROAD_KAA')
      else (select hours from eta_segment_params where code = 'SE_ROAD') end,
    'rest_h', (select hours from eta_segment_params where code = 'SE_DAILY_REST'),
    'breaks_h', (select hours from eta_segment_params where code = 'SE_BREAKS'),
    'permit_warning', false
  );
$$;
revoke all on function public.crossing_route_plan(text, timestamptz, timestamptz) from public, anon, authenticated;

do $m$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron')
     and exists (select 1 from pg_extension where extname = 'pg_net') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'tower-ferry-status';
    perform cron.schedule('tower-ferry-status', '*/10 * * * *', $c$
      select net.http_post(
        url     := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/ferry-status',
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
          'Content-Type', 'application/json'),
        body    := '{}'::jsonb,
        timeout_milliseconds := 120000)
    $c$);
  else
    raise notice '0160: pg_cron lub pg_net niedostępne — tower-ferry-status co 10 min do zaplanowania ręcznie';
  end if;
end
$m$;

create or replace function public.compute_load_eta(p_load uuid, p_now timestamp with time zone DEFAULT now())
 returns table(eta timestamp with time zone, conf_min integer, basis jsonb)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  l          record;
  s          record;
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
  v_break_h numeric := 0;
  v_weather_pct numeric := 0;
  v_fresh boolean := false;
  v_alat double precision;
  v_alon double precision;
  v_sog real;
  v_obs timestamptz;
  v_sea_h numeric;
  v_left boolean := false;
  h_pl_gdy numeric; sp_pl_gdy numeric; h_se_kaa numeric; sp_se_kaa numeric;
  v_route text := null;
  v_slow_kaa numeric := 1;
begin
  select * into l from loads where id = p_load;
  if not found then return; end if;
  v_status := l.status;

  select hours, spread_pct / 100 into h_pl, sp_pl from eta_segment_params where code = 'PL_ROAD';
  select hours into h_ci from eta_segment_params where code = 'PORT_CHECKIN';
  select hours, spread_pct / 100 into h_cross, sp_cross from eta_segment_params where code = 'CROSSING_DEFAULT';
  select hours, spread_pct / 100 into h_road, sp_road from eta_segment_params where code = 'SE_ROAD';
  select hours, spread_pct / 100 into h_rest, sp_rest from eta_segment_params where code = 'SE_DAILY_REST';
  select hours, spread_pct / 100 into h_brk, sp_brk from eta_segment_params where code = 'SE_BREAKS';
  h_road := coalesce(h_road, 17); sp_road := coalesce(sp_road, 0.2);
  h_rest := coalesce(h_rest, 11); sp_rest := coalesce(sp_rest, 0);
  h_brk := coalesce(h_brk, 2); sp_brk := coalesce(sp_brk, 0.5);
  select hours into fresh_h from eta_segment_params where code = 'GPS_FRESH_MIN';
  h_pl := coalesce(h_pl, 4.5); sp_pl := coalesce(sp_pl, 0.2); h_ci := coalesce(h_ci, 2);
  select hours, spread_pct / 100 into h_pl_gdy, sp_pl_gdy from eta_segment_params where code = 'PL_ROAD_GDY';
  select hours, spread_pct / 100 into h_se_kaa, sp_se_kaa from eta_segment_params where code = 'SE_ROAD_KAA';
  h_pl_gdy := coalesce(h_pl_gdy, h_pl); sp_pl_gdy := coalesce(sp_pl_gdy, sp_pl);
  h_se_kaa := coalesce(h_se_kaa, h_road); sp_se_kaa := coalesce(sp_se_kaa, sp_road);
  select slowdown_mult into v_slow_kaa from corridor_conditions where corridor = 'SE_E22';
  v_slow_kaa := coalesce(v_slow_kaa, 1);
  h_cross := coalesce(h_cross, 18); sp_cross := coalesce(sp_cross, 0.15);
  fresh_h := coalesce(fresh_h, 1.5);

  select slowdown_mult, reason into v_slow, v_slow_reason
    from corridor_conditions where corridor = 'SE_E4';
  v_slow := coalesce(v_slow, 1.00);
  if v_slow > 1.00 then
    v_weather_pct := round((v_slow - 1) * 100);
    v_flags := array_append(v_flags, format('spowolnienie SE ×%s (%s)', v_slow, coalesce(v_slow_reason, 'II-6')));
  end if;
  h_road_eff := h_road * v_slow;
  h_se := h_road_eff + h_rest + h_brk;

  select attribution into v_attr from corridor_polylines where code = 'PL_ROAD' limit 1;
  v_attr := coalesce(v_attr, '© OpenStreetMap contributors');

  select st_centroid(geom) into g_load from geofences where project_id = l.project_id and kind = 'LOADING' and active order by sort_order limit 1;
  select st_centroid(geom) into g_pout from geofences where project_id = l.project_id and kind = 'PORT_OUT' and active order by sort_order limit 1;
  select st_centroid(geom) into g_pin  from geofences where project_id = l.project_id and kind = 'PORT_IN'  and active order by sort_order limit 1;
  select st_centroid(geom) into g_site from geofences where project_id = l.project_id and kind = 'SITE'     and active order by sort_order limit 1;
  v_left := v_status in ('IN_TRANSIT_PL','AT_PORT_GDANSK','FERRY','AT_PORT_NYNASHAMN','IN_TRANSIT_SE','AT_SITE','UNLOADED','DELIVERED')
    or exists (
      select 1 from load_events e
      where e.load_id = p_load
        and e.event_type = 'GEOFENCE_EXIT'
        and e.payload->>'geofence_kind' = 'LOADING'
    );

  select ts, coalesce(geom_snapped, geom_raw) as g into p from positions where load_id = p_load order by ts desc limit 1;

  if v_status = 'CANCELLED' then
    return query select null::timestamptz, null::int, jsonb_build_object(
      'method','ETA v2 (OSM)','segment','CANCELLED','flags',jsonb_build_array('anulowany'),
      'attribution', v_attr, 'computed_at', p_now);
    return;
  end if;
  if v_status in ('UNLOADED','DELIVERED') then
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
        'ferry_eta','waits_for_ais','plan_eta', false,
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
      'ferry_eta','ais','plan_eta', false,
      'sailing', null,
      'attribution', v_attr, 'computed_at', p_now);
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
        select * into cp from corridor_progress('SE_E4', p.g);
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
    v_rem := h_se * v_frac;
    v_eta := p_now + make_interval(secs => (v_rem * 3600)::int);
    v_drive_h := round(h_road_eff * v_frac, 2);
    v_rest_h := round(h_rest * v_frac, 2);
    v_break_h := round(h_brk * v_frac, 2);
    v_var := v_var + (h_road_eff * v_frac * 60 * sp_road)^2; v_sum := v_sum + (h_road_eff * v_frac * 60 * sp_road);
    v_comp := v_comp || jsonb_build_object('code','SE_ROAD','min',round(h_road_eff * v_frac * 60 * sp_road));
    v_var := v_var + (h_rest * v_frac * 60 * sp_rest)^2; v_sum := v_sum + (h_rest * v_frac * 60 * sp_rest);
    v_comp := v_comp || jsonb_build_object('code','SE_DAILY_REST','min',round(h_rest * v_frac * 60 * sp_rest));
    v_var := v_var + (h_brk * v_frac * 60 * sp_brk)^2; v_sum := v_sum + (h_brk * v_frac * 60 * sp_brk);
    v_comp := v_comp || jsonb_build_object('code','SE_BREAKS','min',round(h_brk * v_frac * 60 * sp_brk));
    v_segs := v_segs || jsonb_build_object('code','SE_ROAD','hours',round(h_road_eff * v_frac, 1),'spread_pct',round(sp_road * 100),'slowdown_mult',v_slow)
                     || jsonb_build_object('code','SE_DAILY_REST','hours',round(h_rest * v_frac, 1),'spread_pct',round(sp_rest * 100))
                     || jsonb_build_object('code','SE_BREAKS','hours',round(h_brk * v_frac, 1),'spread_pct',round(sp_brk * 100));
    v_seg := v_status::text;
  else
    select coalesce(x.delayed_departure_at, x.departure_at) as dep, coalesce(x.delayed_arrival_at, x.arrival_at) as arr,
           x.status, x.id, (x.delayed_departure_at is not null or x.status = 'OPOZNIONY') as delayed, x.route
      into s from sailings x where x.id = l.sailing_id;
    v_has := found;
    if v_has and s.status = 'ODWOLANY' then
      v_flags := array_append(v_flags, 'przypisany rejs odwołany'::text); v_has := false;
    elsif v_has and v_status < 'FERRY' and s.dep < p_now then
      v_flags := array_append(v_flags, 'przypisany rejs odpłynął bez transportu'::text); v_has := false;
    end if;
    if v_has then
      v_route := s.route;
    else
      select x.route into v_route
        from sailings x
       where x.project_id = l.project_id
         and x.route in ('GDN-NYN', 'GDY-KAA') and x.status <> 'ODWOLANY'
         and coalesce(x.delayed_departure_at, x.departure_at) >= p_now
       order by coalesce(x.delayed_departure_at, x.departure_at) limit 1;
    end if;
    if v_route in ('GDY-KAA', 'KAA-GDY') then
      h_pl := h_pl_gdy; sp_pl := sp_pl_gdy;
      h_road := h_se_kaa; sp_road := sp_se_kaa;
      v_slow := v_slow_kaa;
      h_road_eff := h_road * v_slow;
      h_se := h_road_eff + h_rest + h_brk;
      v_flags := array_append(v_flags, 'trasa Gdynia–Karlskrona: dojazd, rejs i droga E22–E4; zezwolenie obejmuje obie przeprawy'::text);
    end if;

    if v_status = 'FERRY' then
      if v_has then
        v_arr := s.arr; v_sail_src := 'przypisany';
        v_var := v_var + (30)^2; v_sum := v_sum + (30); v_comp := v_comp || jsonb_build_object('code','SAILING','min',round(30));
        if s.delayed then v_var := v_var + (60)^2; v_sum := v_sum + (60); v_comp := v_comp || jsonb_build_object('code','SAILING_DELAYED','min',round(60)); end if;
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
        v_dep := s.dep; v_arr := s.arr; v_sail_src := 'przypisany';
        v_var := v_var + (30)^2; v_sum := v_sum + (30); v_comp := v_comp || jsonb_build_object('code','SAILING','min',round(30));
        if s.delayed then v_var := v_var + (60)^2; v_sum := v_sum + (60); v_comp := v_comp || jsonb_build_object('code','SAILING_DELAYED','min',round(60)); end if;
        if v_start > v_dep then
          v_flags := array_append(v_flags, 'rejs zagrożony — dojazd i check-in po odejściu'::text);
          v_var := v_var + (12 * 60)^2; v_sum := v_sum + (12 * 60); v_comp := v_comp || jsonb_build_object('code','SAILING_AT_RISK','min',round(12 * 60));
        end if;
      else
        -- II-7 / STENA-3: najbliższy rejs GDN-NYN lub GDY-KAA
        select coalesce(x.delayed_departure_at, x.departure_at), coalesce(x.delayed_arrival_at, x.arrival_at), x.route
          into v_dep, v_arr, v_route
          from sailings x
         where x.project_id = l.project_id
           and x.route in ('GDN-NYN', 'GDY-KAA') and x.status <> 'ODWOLANY'
           and (v_route is null or x.route = v_route)
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
    v_segs := v_segs || jsonb_build_object('code','SE_ROAD','hours',round(h_road_eff, 1),'spread_pct',round(sp_road * 100),'slowdown_mult',v_slow)
                     || jsonb_build_object('code','SE_DAILY_REST','hours',round(h_rest, 1),'spread_pct',round(sp_rest * 100))
                     || jsonb_build_object('code','SE_BREAKS','hours',round(h_brk, 1),'spread_pct',round(sp_brk * 100));
    v_drive_h := coalesce(v_drive_h, 0) + h_road_eff;
    v_rest_h := h_rest;
    v_break_h := h_brk;
    v_eta := v_arr + make_interval(secs => (h_se * 3600)::int);
    v_var := v_var + (h_road_eff * 60 * sp_road)^2; v_sum := v_sum + (h_road_eff * 60 * sp_road);
    v_comp := v_comp || jsonb_build_object('code','SE_ROAD','min',round(h_road_eff * 60 * sp_road));
    v_var := v_var + (h_rest * 60 * sp_rest)^2; v_sum := v_sum + (h_rest * 60 * sp_rest);
    v_comp := v_comp || jsonb_build_object('code','SE_DAILY_REST','min',round(h_rest * 60 * sp_rest));
    v_var := v_var + (h_brk * 60 * sp_brk)^2; v_sum := v_sum + (h_brk * 60 * sp_brk);
    v_comp := v_comp || jsonb_build_object('code','SE_BREAKS','min',round(h_brk * 60 * sp_brk));
    if v_status < 'FERRY' then
      v_var := v_var + (h_pl * 60 * sp_pl)^2; v_sum := v_sum + (h_pl * 60 * sp_pl);
      v_comp := v_comp || jsonb_build_object('code','PL_ROAD','min',round(h_pl * 60 * sp_pl));
    end if;
  end if;

  v_causes := jsonb_build_object(
    'drive_h', v_drive_h,
    'checkin_h', v_checkin_h,
    'rest_h', v_rest_h,
    'breaks_h', v_break_h,
    'weather_slowdown_pct', v_weather_pct,
    'progress', v_progress,
    'remaining_km', v_rem_km,
    'off_corridor_m', v_off
  );

  return query select v_eta, round(sqrt(v_var))::int, jsonb_build_object(
    'method', 'ETA v2 (OSM)', 'segment', v_seg, 'segments', v_segs,
    'band', jsonb_build_object('method', 'RSS', 'min', round(sqrt(v_var)), 'linear_sum_min', round(v_sum),
                               'components', (select coalesce(jsonb_agg(c), '[]'::jsonb) from jsonb_array_elements(v_comp) c where (c->>'min')::numeric > 0)),
    'flags', to_jsonb(v_flags), 'sailing', v_sail_src,
    'attribution', v_attr, 'causes', v_causes, 'computed_at', p_now);
end $function$;



revoke all on function public.compute_load_eta(uuid, timestamptz) from public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.promote_ferry_departures(p_now timestamp with time zone DEFAULT now())
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r record; v_inside boolean; n int := 0;
begin
  for r in
    select l.id as load_id, l.project_id, l.status, s.id as sailing_id,
           s.status as sailing_status, v.name as vessel,
           coalesce(s.delayed_departure_at, s.departure_at) as dep
      from loads l
      join sailings s on s.id = l.sailing_id and s.route in ('GDN-NYN', 'GDY-KAA')
      join vessels  v on v.id = s.vessel_id
     where coalesce(s.delayed_departure_at, s.departure_at) <= p_now
       and l.status in ('PLANNED','RESOURCES_PENDING','DOCS_PENDING','READY',
                        'AT_LOADING','IN_TRANSIT_PL','AT_PORT_GDANSK')
  loop
    if r.sailing_status = 'ODWOLANY' then
      perform raise_risk(r.load_id, 'FERRY', 'HIGH',
        format('Rejs %s z %s odwołany — transport wymaga nowego rejsu', r.vessel,
               to_char(r.dep at time zone 'Europe/Warsaw', 'DD.MM HH24:MI')),
        jsonb_build_object('sailing_id', r.sailing_id, 'title_key', 'rk_sailing_cancelled', 'params', jsonb_build_object('vessel', r.vessel,
          'dep', to_char(r.dep at time zone 'Europe/Warsaw', 'DD.MM HH24:MI'))), 'SAILING_CANCELLED:' || r.load_id || ':' || r.sailing_id);
      continue;
    end if;

    select exists (
      select 1 from geofence_states gs
        join geofences g on g.id = gs.geofence_id
       where gs.load_id = r.load_id and g.project_id = r.project_id
         and g.kind = 'PORT_OUT' and g.active
         and gs.entered_at is not null and gs.entered_at <= r.dep
         and (gs.state in ('INSIDE','PENDING_OUT')
              or (gs.exited_at is not null and gs.exited_at >= r.dep))
    ) into v_inside;

    if r.status = 'AT_PORT_GDANSK' and v_inside then
      if auto_set_status(r.load_id, 'AT_PORT_GDANSK', 'FERRY', 'odejście przypisanego rejsu', r.dep,
           jsonb_build_object('sailing_id', r.sailing_id, 'statek', r.vessel, 'odejscie', r.dep)) then
        n := n + 1;
      end if;
    else
      perform raise_risk(r.load_id, 'FERRY', 'HIGH',
        format('Brak potwierdzenia pozycją, że transport był w porcie Gdańsk w chwili odejścia rejsu %s %s',
               r.vessel, to_char(r.dep at time zone 'Europe/Warsaw', 'DD.MM HH24:MI')),
        jsonb_build_object('sailing_id', r.sailing_id, 'status', r.status, 'title_key', 'rk_missed_sailing', 'params', jsonb_build_object('vessel', r.vessel,
          'dep', to_char(r.dep at time zone 'Europe/Warsaw', 'DD.MM HH24:MI'))),
        'MISSED_SAILING:' || r.load_id || ':' || r.sailing_id);
    end if;
  end loop;
  return n;
end $function$;

