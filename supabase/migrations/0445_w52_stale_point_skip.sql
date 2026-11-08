-- #566 / W52: stare punkty emtrack (raw.stale_point=true) nie zmieniają ETA, SMS 1 h,
-- ciszy GPS, mapy (latest_vehicle_fixes / latest_vehicle_positions) ani śladu (load_track).
-- Warunek jak w process_position: coalesce((raw->>'stale_point')::boolean, false) is not true.
select set_config('tower.audit_source', 'migracja 0445 (#566 W52 stale_point)', true);

-- 1) ETA — ta sama funkcja na load_events i positions (trg_positions_eta)
create or replace function public.trg_eta_after_event() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- load_events nie ma kolumny raw; filtr tylko na positions
  if tg_table_name = 'positions'
     and coalesce((new.raw->>'stale_point')::boolean, false) is true then
    return null;
  end if;
  perform public.refresh_load_eta(new.load_id);
  return null;
end;
$$;

revoke all on function public.trg_eta_after_event() from public, anon, authenticated;
comment on function public.trg_eta_after_event() is
  'ETA po INSERT load_events/positions; #566: na positions pomija raw.stale_point=true.';

-- 2) SMS KSH 1 h — wyzwalacz trg_sms_ksh_1h_position
create or replace function public.sms_ksh_1h_on_position() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce((new.raw->>'stale_point')::boolean, false) is true then
    return null;
  end if;
  perform public.sms_ksh_1h_consider(new.load_id, coalesce(new.ts, now()));
  return null;
end;
$$;

revoke all on function public.sms_ksh_1h_on_position() from public, anon, authenticated;
comment on function public.sms_ksh_1h_on_position() is
  'SMS strefa 1 h po pozycji; #566: pomija raw.stale_point=true.';

-- 3) Cisza GPS — ostatni punkt bez stale_point (baza 0270 + filtr)
create or replace function public.detect_silent_vehicles(p_minutes integer default 90)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n int := 0;
  r record;
  v_min int;
  v_em int;
  v_connected boolean;
  v_moving boolean;
  v_last_ts timestamptz;
  v_src text;
  v_em_due boolean;
  v_rid uuid;
  v_rows int;
begin
  perform public.assert_not_preview();
  perform l1b_scan();
  perform dwell_scan(null, now());
  v_min := l3_ops('SILENT_MIN')::int;
  v_em := coalesce(l3_ops('SILENT_MIN_EMTRACK')::int, 720);
  if v_min is null then
    return 0;
  end if;

  for r in
    select s.id, s.dedup_key
      from risk_signals s
      join loads l on s.dedup_key = 'SILENT:' || l.id::text
     where s.resolved_at is null
       and public.load_in_tracking_window(l.id, now()) is not true
  loop
    update risk_signals set resolved_at = now() where id = r.id;
    perform l3_lapse(r.dedup_key, now());
  end loop;

  for r in
    select l.id, l.project_id, l.tractor_plate, l.status, l.telematics_vehicle_id
      from loads l
     where public.load_in_tracking_window(l.id, now())
  loop
    if exists (
      select 1 from risk_signals s
       where s.dedup_key = 'RIO_NO_POSITION:' || r.id::text
         and s.resolved_at is null
    ) then
      update risk_signals set resolved_at = now()
       where dedup_key = 'SILENT:' || r.id and resolved_at is null;
      perform l3_lapse('SILENT:' || r.id, now());
      continue;
    end if;

    v_moving := r.status in ('IN_TRANSIT_PL', 'AT_PORT_GDANSK', 'AT_PORT_NYNASHAMN', 'IN_TRANSIT_SE');
    select p.ts, p.source::text
      into v_last_ts, v_src
      from positions p
     where p.load_id = r.id
       and coalesce((p.raw->>'stale_point')::boolean, false) is not true
     order by p.ts desc
     limit 1;
    v_connected := r.telematics_vehicle_id is not null or v_last_ts is not null;

    if v_src = 'EMTRACK_WEB' then
      v_em_due := v_moving is true
        and v_em is not null
        and (v_last_ts is null or v_last_ts < now() - make_interval(mins => v_em));
      if v_em_due is not true then
        update risk_signals set resolved_at = now()
         where dedup_key = 'SILENT:' || r.id and resolved_at is null;
        if found then
          perform l3_lapse('SILENT:' || r.id, now());
        end if;
        continue;
      end if;
      select id into v_rid
        from risk_signals
       where dedup_key = 'SILENT:' || r.id and resolved_at is null
       limit 1;
      if v_rid is null then
        insert into risk_signals (
          project_id, load_id, kind, severity, title, title_key, detail, dedup_key, detected_at
        ) values (
          r.project_id, r.id, 'SILENT_VEHICLE', 'LOW',
          format('Brak pozycji naczepy (emtrack) %s od %s h',
                 coalesce(r.tractor_plate, '?'), round(v_em / 60.0)::int),
          'rk_silent_vehicle',
          jsonb_build_object(
            'emtrack_trailer', '1',
            'last_fix', v_last_ts,
            'threshold_min', v_em,
            'params', jsonb_build_object(
              'plate', coalesce(r.tractor_plate, '?'),
              'minutes', v_em,
              'source', 'EMTRACK_WEB'
            )
          ),
          'SILENT:' || r.id,
          now()
        )
        on conflict (dedup_key) where dedup_key is not null and resolved_at is null do nothing;
        get diagnostics v_rows = row_count;
        n := n + v_rows;
      else
        update risk_signals
           set severity = 'LOW',
               title = format('Brak pozycji naczepy (emtrack) %s od %s h',
                              coalesce(r.tractor_plate, '?'), round(v_em / 60.0)::int),
               detail = coalesce(detail, '{}'::jsonb) || jsonb_build_object(
                 'emtrack_trailer', '1',
                 'last_fix', v_last_ts,
                 'threshold_min', v_em,
                 'params', jsonb_build_object(
                   'plate', coalesce(r.tractor_plate, '?'),
                   'minutes', v_em,
                   'source', 'EMTRACK_WEB'
                 )
               )
         where id = v_rid;
      end if;
      perform l3_lapse('SILENT:' || r.id, now());
      continue;
    end if;

    if l3_silent_alarm(v_last_ts, now(), v_connected, v_moving) is not true then
      update risk_signals set resolved_at = now()
       where dedup_key = 'SILENT:' || r.id and resolved_at is null and detail->>'l3' = '1';
      if found then
        perform l3_lapse('SILENT:' || r.id, now());
      end if;
      continue;
    end if;
    n := n + l3_upsert_alarm(
      r.project_id, r.id, 'SILENT_VEHICLE', 'SILENT:' || r.id,
      format('Brak pozycji pojazdu %s od %s min', coalesce(r.tractor_plate, '?'), v_min),
      'rk_silent_vehicle',
      true,
      true,
      now() + interval '1 hour',
      jsonb_build_object(
        'last_fix', v_last_ts, 'threshold_min', v_min,
        'params', jsonb_build_object('plate', coalesce(r.tractor_plate, '?'), 'minutes', v_min)
      ),
      now()
    );
  end loop;
  return n;
end;
$$;

revoke all on function public.detect_silent_vehicles(integer) from public, anon, authenticated;
grant execute on function public.detect_silent_vehicles(integer) to service_role;
comment on function public.detect_silent_vehicles(integer) is
  'Cisza GPS; #566: last_fix pomija raw.stale_point=true; assert_not_preview.';

-- 4) Mapa / kokpit — latest_vehicle_fixes
create or replace function public.latest_vehicle_fixes(p_loads uuid[])
returns table (load_id uuid, ts timestamptz, lat double precision, lng double precision)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select l.id, f.ts, f.lat, f.lng
    from (select distinct u.id from unnest(coalesce(p_loads, '{}'::uuid[])) with ordinality u(id, n)
           where u.n <= 500 and u.id is not null) l
    cross join lateral (
      select p.ts,
             st_y(coalesce(p.geom_snapped, p.geom_raw)) as lat,
             st_x(coalesce(p.geom_snapped, p.geom_raw)) as lng
        from positions p
       where p.load_id = l.id
         and coalesce((p.raw->>'stale_point')::boolean, false) is not true
       order by p.ts desc
       limit 1) f
$$;

revoke all on function public.latest_vehicle_fixes(uuid[]) from public, anon;
grant execute on function public.latest_vehicle_fixes(uuid[]) to authenticated;
comment on function public.latest_vehicle_fixes(uuid[]) is
  'Ostatnia pozycja GPS; #566: pomija raw.stale_point=true.';

-- 5) Ślad trasy — load_track
create or replace function public.load_track(p_load uuid, p_limit int default 5000)
returns table (ts timestamptz, lat double precision, lng double precision, speed_kmh numeric, source text)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select t.ts, t.lat, t.lng, t.speed_kmh, t.source
    from (select p.ts,
                 st_y(coalesce(p.geom_snapped, p.geom_raw)) as lat,
                 st_x(coalesce(p.geom_snapped, p.geom_raw)) as lng,
                 p.speed_kmh, p.source::text as source
            from positions p
           where p.load_id = p_load
             and coalesce((p.raw->>'stale_point')::boolean, false) is not true
           order by p.ts desc
           limit least(greatest(coalesce(p_limit, 5000), 1), 5000)) t
   order by t.ts
$$;

revoke all on function public.load_track(uuid, int) from public, anon;
grant execute on function public.load_track(uuid, int) to authenticated;
comment on function public.load_track(uuid, int) is
  'Ślad GPS; #566: pomija raw.stale_point=true.';

-- 6) latest_vehicle_positions (traffic-flow / Edge) — też pomija stale
create or replace function public.latest_vehicle_positions(p_max_age_min int default 30)
returns table (load_id uuid, code text, lat double precision, lon double precision, ts timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select distinct on (p.load_id) p.load_id,
         coalesce((select min(si.shipment_code) from shipment_items si where si.load_id = l.id), l.order_no),
         st_y(coalesce(p.geom_snapped, p.geom_raw)),
         st_x(coalesce(p.geom_snapped, p.geom_raw)),
         p.ts
    from positions p
    join loads l on l.id = p.load_id
   where l.status in ('IN_TRANSIT_PL', 'IN_TRANSIT_SE')
     and p.ts > now() - make_interval(mins => greatest(p_max_age_min, 1))
     and coalesce((p.raw->>'stale_point')::boolean, false) is not true
   order by p.load_id, p.ts desc
$$;

revoke all on function public.latest_vehicle_positions(int) from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.latest_vehicle_positions(int) to service_role;
  end if;
end $$;
comment on function public.latest_vehicle_positions(int) is
  'Ostatnie pozycje w trasie; #566: pomija raw.stale_point=true.';
