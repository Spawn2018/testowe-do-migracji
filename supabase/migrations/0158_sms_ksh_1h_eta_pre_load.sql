-- =====================================================================
-- TOWER — Migracja 0158: SMS-KSH-1H i ETA-PRE-LOAD
--
-- D-37 / D-64: jeden SMS na transport i koniec trasy, gdy czas jazdy
-- z bieżącego GPS do placu (Śrem albo Boden) wynosi <= 60 min.
-- Koło 50 km (PRE_ARRIVAL) przestaje wysyłać SMS. Wjazd na plac zostaje.
-- Brak GPS = brak SMS. Powtórna pozycja nie dubluje (dedup listy).
-- HERE tylko gdy H1_ROUTE_CHECK jest włączone i budżet < 100 USD.
-- Flagi H1 i H3 ta migracja nie zmienia. Sieci nie woła.
--
-- ETA-PRE-LOAD (D-80): przed opuszczeniem strefy placu w Śremie eta_site
-- zostaje puste (w interfejsie sam „–”). Po wyjeździe ETA liczy się z pozycji,
-- od teraz, nie z planu załadunku.
-- =====================================================================

create or replace function sms_render(p_kind text, p_locale text, p jsonb) returns text
language plpgsql immutable set search_path = public as $$
declare t text; k text;
begin
  t := case p_kind || ':' || coalesce(p_locale, 'pl')
    when 'DRIVER_LINK:pl' then 'Watch Tower {nr}: link kierowcy {url} Nie udostepniaj.'
    when 'DRIVER_LINK:en' then 'Watch Tower {nr}: driver link {url} Do not share.'
    when 'DRIVER_LINK:sv' then 'Watch Tower {nr}: forarlank {url} Dela inte.'
    when 'WINDOW_CHANGE:pl' then 'Watch Tower {nr}: ZMIANA okna {okno_pl}: {dt}-{t2} (czas lokalny).'
    when 'WINDOW_CHANGE:en' then 'Watch Tower {nr}: CHANGED {okno_en} window: {dt}-{t2} (local time).'
    when 'WINDOW_CHANGE:sv' then 'Watch Tower {nr}: ANDRAT {okno_sv}: {dt}-{t2} (lokal tid).'
    when 'SAILING_CHANGE:pl' then 'Watch Tower {nr}: ZMIANA PROMU: {statek}, Gdansk {dt}, rezerwacja {ref}.'
    when 'SAILING_CHANGE:en' then 'Watch Tower {nr}: FERRY CHANGED: {statek}, Gdansk {dt}, booking {ref}.'
    when 'SAILING_CHANGE:sv' then 'Watch Tower {nr}: NY FARJA: {statek}, Gdansk {dt}, bokning {ref}.'
    when 'SAILING_CANCELLED:pl' then 'Watch Tower {nr}: PROM {statek} {dt} ODWOLANY. Czekaj na nowy rejs.'
    when 'SAILING_CANCELLED:en' then 'Watch Tower {nr}: FERRY {statek} {dt} CANCELLED. Wait for a new sailing.'
    when 'SAILING_CANCELLED:sv' then 'Watch Tower {nr}: FARJA {statek} {dt} INSTALLD. Vanta pa ny avgang.'
    when 'LOAD_CANCELLED:pl' then 'Watch Tower {nr}: TRANSPORT ANULOWANY.'
    when 'LOAD_CANCELLED:en' then 'Watch Tower {nr}: TRANSPORT CANCELLED.'
    when 'LOAD_CANCELLED:sv' then 'Watch Tower {nr}: TRANSPORT INSTALLD.'
    when 'GPS_SILENT:pl' then 'Watch Tower {nr}: brak pozycji GPS od {min} min. Otworz link i zostaw strone wlaczona.'
    when 'GPS_SILENT:en' then 'Watch Tower {nr}: no GPS position for {min} min. Open your link and keep the page open.'
    when 'GPS_SILENT:sv' then 'Watch Tower {nr}: ingen GPS-position pa {min} min. Oppna lankken och lat sidan vara oppen.'
    when 'UNLOAD_CONFIRM:pl' then 'Watch Tower {nr}: jestes na placu Stegra Boden. Po rozladunku potwierdz ROZLADOWANO w linku.'
    when 'UNLOAD_CONFIRM:en' then 'Watch Tower {nr}: you are at Stegra Boden. After unloading confirm UNLOADED in your link.'
    when 'UNLOAD_CONFIRM:sv' then 'Watch Tower {nr}: du ar pa Stegra Boden. Bekrafta LOSSAD i lankken efter lossning.'
    when 'TEST:pl' then 'Watch Tower: SMS testowy bramki.'
    when 'TEST:en' then 'Watch Tower: gateway test SMS.'
    when 'TEST:sv' then 'Watch Tower: test-SMS fran gatewayen.'
    when 'ZONE_APPROACH:pl' then '{kto}, rej. {rej}, przyjazd {eta}'
    when 'ZONE_APPROACH:en' then '{kto}, reg. {rej}, arrival {eta}'
    when 'ZONE_APPROACH:sv' then '{kto}, reg. {rej}, ankomst {eta}'
    when 'ZONE_ENTER:pl' then 'Auto {rej} z {wysylka} wjechalo na {miejsce}'
    when 'ZONE_ENTER:en' then 'Truck {rej} from {wysylka} entered {miejsce}'
    when 'ZONE_ENTER:sv' then 'Lastbil {rej} fran {wysylka} korde in pa {miejsce}'
  end;
  if t is null then raise exception 'Nieznany szablon SMS: % / %', p_kind, p_locale; end if;
  if p ? 'okno' then
    p := p || case p->>'okno' when 'LOAD' then '{"okno_pl":"zaladunku","okno_en":"loading","okno_sv":"lastningsfonster"}'::jsonb
                              else '{"okno_pl":"rozladunku","okno_en":"unloading","okno_sv":"lossningsfonster"}'::jsonb end;
  end if;
  for k in select jsonb_object_keys(p) loop
    t := replace(t, '{' || k || '}', coalesce(left(p->>k, 120), ''));
  end loop;
  if t ~ '\{[a-z0-9_]+\}' then raise exception 'Szablon SMS % bez wartości: %', p_kind, substring(t from '\{[a-z0-9_]+\}'); end if;
  t := sms_strip_pl(t);
  if char_length(t) > 160 then t := left(t, 160); end if;
  return t;
end $$;

create or replace function sms_zone_enqueue_for_event(
  p_load uuid, p_list text, p_kind text, p_place text, p_eta text default null
) returns int
language plpgsql security definer set search_path = public as $$
declare
  r record; n int := 0; v_to text; v_id uuid; v_plate text; v_code text; v_eta text; v_who text;
begin
  if (p_list in ('LOAD_SREM', 'UNLOAD_BODEN')) is not true then return 0; end if;
  if (p_kind in ('ZONE_APPROACH', 'ZONE_ENTER')) is not true then return 0; end if;
  if p_kind = 'ZONE_APPROACH' and coalesce((select enabled from security_flags where key = 'SMS_ZONE_APPROACH'), false) is not true then
    return 0;
  end if;
  if p_kind = 'ZONE_ENTER' and coalesce((select enabled from security_flags where key = 'SMS_ZONE_ENTER'), false) is not true then
    return 0;
  end if;
  if sms_zone_daily_count() >= 150 then
    insert into notifications (channel, recipient, user_id, load_id, template, payload, dedup_key)
    select 'EMAIL', u.email, u.id, p_load, 'SMS_FALLBACK',
           jsonb_build_object('kind', 'ZONE_LIMIT', 'text', 'Limit 150 SMS stref na dobe wyczerpany'),
           'smszone-limit:' || to_char(now(), 'YYYYMMDD') || ':' || u.id::text
    from app_users u
    where u.role = 'HHL_ADMIN' and u.active and u.email is not null
    on conflict do nothing;
    return 0;
  end if;

  select coalesce(nullif(l.tractor_plate, ''), '?'),
         coalesce(nullif(l.order_no, ''), left(l.id::text, 8)),
         coalesce(nullif(btrim(l.driver_name), ''), nullif(btrim(l.order_no), ''), 'transport')
    into v_plate, v_code, v_who from loads l where l.id = p_load;
  v_eta := coalesce(nullif(p_eta, ''), '—');

  for r in
    select * from sms_zone_recipients
    where list_key = p_list and active is true
    order by slot
  loop
    v_to := sms_zone_e164(r.phone_national, r.country);
    if v_to is null then continue; end if;
    v_id := sms_enqueue(
      p_kind, p_load, v_to, case when r.country = 'SE' then 'sv' else 'pl' end,
      jsonb_build_object(
        'kto', sms_strip_pl(v_who),
        'rej', sms_strip_pl(v_plate),
        'wysylka', sms_strip_pl(v_code),
        'miejsce', sms_strip_pl(p_place),
        'eta', sms_strip_pl(v_eta)
      ),
      80,
      p_kind || ':' || p_load::text || ':' || p_list || ':' || r.slot::text,
      false
    );
    if v_id is not null then n := n + 1; end if;
  end loop;
  return n;
end $$;
revoke all on function sms_zone_enqueue_for_event(uuid, text, text, text, text) from public, anon, authenticated;

create or replace function sms_zone_on_geofence_enter() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_kind text; v_name text; v_country char(2); v_list text; v_sms_kind text; v_place text;
  v_gid uuid;
begin
  if new.event_type is distinct from 'GEOFENCE_ENTER' then return null; end if;
  v_kind := new.payload->>'geofence_kind';
  v_name := coalesce(new.payload->>'geofence_name', '');
  begin
    v_gid := nullif(new.payload->>'geofence_id', '')::uuid;
  exception when others then
    v_gid := null;
  end;
  if v_gid is not null then
    select g.country into v_country from geofences g where g.id = v_gid;
  end if;

  v_list := null; v_sms_kind := null;
  -- SMS-KSH-1H: PRE_ARRIVAL (koło 50 km) nie wysyła SMS. Zostaje wjazd na plac.
  if v_kind = 'LOADING' and coalesce(v_country, 'PL') = 'PL' then
    v_list := 'LOAD_SREM'; v_sms_kind := 'ZONE_ENTER'; v_place := 'zaladunek Srem';
  elsif v_kind = 'SITE' and coalesce(v_country, 'SE') = 'SE' then
    v_list := 'UNLOAD_BODEN'; v_sms_kind := 'ZONE_ENTER'; v_place := 'plac Stegra Boden';
  end if;

  if v_list is not null then
    perform sms_zone_enqueue_for_event(new.load_id, v_list, v_sms_kind, v_place, null);
  end if;
  return null;
end $$;

create or replace function public.yard_drive_quote(
  p_load uuid, p_yard text, p_now timestamptz default now()
) returns table(minutes numeric, eta timestamptz, engine text)
language plpgsql stable security definer set search_path = public as $$
declare
  v_pos geometry;
  v_yard geometry;
  v_km numeric;
  v_h numeric;
  v_slow numeric := 1;
  v_kmh numeric;
  v_min numeric;
  v_here boolean := false;
  cp record;
  v_code text;
  v_seg text;
begin
  if (p_yard in ('SREM', 'BODEN')) is not true then
    return;
  end if;
  select p.geom_raw into v_pos
    from positions p
   where p.load_id = p_load
   order by p.ts desc
   limit 1;
  if v_pos is null then
    return query select null::numeric, null::timestamptz, 'brak_gps'::text;
    return;
  end if;

  if p_yard = 'SREM' then
    v_code := 'PL_ROAD'; v_seg := 'PL_ROAD';
    select st_centroid(g.geom) into v_yard
      from geofences g
      join loads l on l.project_id = g.project_id
     where l.id = p_load and g.kind = 'LOADING' and g.country = 'PL' and g.active
     order by g.sort_order
     limit 1;
    if v_yard is null then
      v_yard := st_setsrid(st_makepoint(17.0246, 52.07391), 4326);
    end if;
  else
    v_code := 'SE_E4'; v_seg := 'SE_ROAD';
    select st_centroid(g.geom) into v_yard
      from geofences g
      join loads l on l.project_id = g.project_id
     where l.id = p_load and g.kind = 'SITE' and g.country = 'SE' and g.active
     order by g.sort_order
     limit 1;
    if v_yard is null then
      v_yard := st_setsrid(st_makepoint(21.7591, 65.8054), 4326);
    end if;
    select slowdown_mult into v_slow from corridor_conditions where corridor = 'SE_E4';
    v_slow := coalesce(v_slow, 1);
  end if;

  select c.total_km, e.hours into v_km, v_h
    from corridor_polylines c
    join eta_segment_params e on e.code = v_seg
   where c.code = v_code;
  if v_km is null or v_h is null or v_h = 0 then
    return query select null::numeric, null::timestamptz, 'brak_silnika'::text;
    return;
  end if;
  v_h := v_h * v_slow;
  v_kmh := v_km / v_h;

  v_here := coalesce((select enabled from security_flags where key = 'H1_ROUTE_CHECK'), false) is true
    and coalesce(public.here_month_spend(p_now), 0) < 100;
  -- Brak wywołania HERE (koszt). Cache czasu przejazdu nie jest jeszcze zapisywany.
  if (v_here) is true then
    null;
  end if;

  if p_yard = 'BODEN' then
    select * into cp from corridor_progress('SE_E4', v_pos);
    if cp.off_m is not null and cp.off_m < 30000 and cp.remaining_frac is not null then
      v_min := cp.remaining_frac * v_h * 60;
      return query select round(v_min, 1), p_now + make_interval(secs => round(v_min * 60)::int),
        case when (v_here) is true then 'wlasny_po_here' else 'wlasny' end;
      return;
    end if;
  end if;

  v_min := st_distance(v_pos::geography, v_yard::geography) / 1000.0 / v_kmh * 60;
  return query select round(v_min, 1), p_now + make_interval(secs => round(v_min * 60)::int),
    case when (v_here) is true then 'wlasny_po_here' else 'wlasny' end;
end $$;
revoke all on function public.yard_drive_quote(uuid, text, timestamptz) from public, anon, authenticated;

create or replace function public.sms_ksh_1h_consider(p_load uuid, p_now timestamptz default now())
returns int
language plpgsql security definer set search_path = public as $$
declare
  v_min numeric;
  v_eta timestamptz;
  v_engine text;
  v_txt text;
  n int := 0;
  v_zone text;
begin
  if p_load is null then
    return 0;
  end if;
  for v_zone in select unnest(array['SREM', 'BODEN']) loop
    select q.minutes, q.eta, q.engine into v_min, v_eta, v_engine
      from public.yard_drive_quote(p_load, v_zone, p_now) q;
    if v_min is null or v_min > 60 then
      continue;
    end if;
    v_txt := to_char(
      v_eta at time zone case when v_zone = 'SREM' then 'Europe/Warsaw' else 'Europe/Stockholm' end,
      'DD.MM HH24:MI'
    );
    n := n + public.sms_zone_enqueue_for_event(
      p_load,
      case when v_zone = 'SREM' then 'LOAD_SREM' else 'UNLOAD_BODEN' end,
      'ZONE_APPROACH',
      case when v_zone = 'SREM' then 'Srem' else 'Boden' end,
      v_txt
    );
  end loop;
  return n;
end $$;
revoke all on function public.sms_ksh_1h_consider(uuid, timestamptz) from public, anon, authenticated;

create or replace function public.sms_ksh_1h_on_position() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.sms_ksh_1h_consider(new.load_id, coalesce(new.ts, now()));
  return null;
end $$;

drop trigger if exists trg_sms_ksh_1h_position on positions;
create trigger trg_sms_ksh_1h_position
  after insert on positions
  for each row execute function public.sms_ksh_1h_on_position();

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
           x.status, x.id, (x.delayed_departure_at is not null or x.status = 'OPOZNIONY') as delayed
      into s from sailings x where x.id = l.sailing_id;
    v_has := found;
    if v_has and s.status = 'ODWOLANY' then
      v_flags := array_append(v_flags, 'przypisany rejs odwołany'::text); v_has := false;
    elsif v_has and v_status < 'FERRY' and s.dep < p_now then
      v_flags := array_append(v_flags, 'przypisany rejs odpłynął bez transportu'::text); v_has := false;
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
        select coalesce(x.delayed_departure_at, x.departure_at), coalesce(x.delayed_arrival_at, x.arrival_at)
          into v_dep, v_arr
          from sailings x
         where x.project_id = l.project_id
           and x.route in ('GDN-NYN', 'GDY-KAA') and x.status <> 'ODWOLANY'
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


revoke execute on function public.compute_load_eta(uuid, timestamptz) from public, anon, authenticated;
