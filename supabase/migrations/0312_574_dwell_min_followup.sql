-- #574-nast (F7 #574 r2 pkt 5–6): cron dwell — dolna granica first pos;
-- SG-23 GEOFENCE_DWELL: przelicz dwell_min/minutes po backdate ENTER.

-- ---------------------------------------------------------------------------
-- 1. geofence_confirm_pending_dwell — greatest(ostatni EXIT, entered_at)
-- ---------------------------------------------------------------------------
create or replace function public.geofence_confirm_pending_dwell(
  p_now timestamptz default now()
) returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row        record;
  v_first_ts   timestamptz;
  v_first_geom geometry;
  v_first_src  position_source;
  v_last_geom  geometry;
  v_pending_at timestamptz;
  v_emit_at    timestamptz;
  v_dedup      text;
  v_payload    jsonb;
  v_n          int := 0;
  v_quiet      boolean;
  v_lower      timestamptz;
  v_last_exit  timestamptz;
begin
  for v_row in
    select gs.load_id, gs.geofence_id, gs.entered_at, gs.last_eval_at, gs.consec_fixes,
           g.name as geofence_name, g.kind as geofence_kind, g.geom, g.dwell_seconds,
           g.notify_orgs, g.message_tpl, g.hysteresis_m
      from geofence_states gs
      join geofences g on g.id = gs.geofence_id
     where gs.state = 'PENDING_IN'
       and g.active is true
       and g.kind is distinct from 'SITE'
       and g.dwell_seconds > 0
  loop
    v_first_ts := null;
    v_first_geom := null;
    v_first_src := null;
    v_last_geom := null;

    /* F7 #574-nast: nie cofaj czasu ENTER przez niepotwierdzony wcześniejszy przejazd
       (PENDING_IN→OUTSIDE bez GEOFENCE_EXIT). Dolna granica = greatest(EXIT, entered_at). */
    select max(e.occurred_at) into v_last_exit
      from load_events e
     where e.load_id = v_row.load_id
       and e.event_type = 'GEOFENCE_EXIT'
       and (e.payload->>'geofence_id')::uuid = v_row.geofence_id;

    v_lower := greatest(
      coalesce(v_last_exit, '-infinity'::timestamptz),
      coalesce(v_row.entered_at, '-infinity'::timestamptz)
    );

    select p.ts, p.geom_raw, p.source
      into v_first_ts, v_first_geom, v_first_src
      from positions p
     where p.load_id = v_row.load_id
       and coalesce((p.raw->>'stale_point')::boolean, false) is not true
       and st_contains(v_row.geom, p.geom_raw::geometry)
       and p.ts >= v_lower
     order by p.ts
     limit 1;

    v_pending_at := coalesce(v_first_ts, v_row.entered_at, v_row.last_eval_at);
    if v_pending_at is null then
      continue;
    end if;
    if p_now - v_pending_at < make_interval(secs => v_row.dwell_seconds) then
      continue;
    end if;

    select p.geom_raw into v_last_geom
      from positions p
     where p.load_id = v_row.load_id
       and coalesce((p.raw->>'stale_point')::boolean, false) is not true
     order by p.ts desc
     limit 1;

    if v_last_geom is null
       or st_contains(v_row.geom, v_last_geom::geometry) is not true then
      continue;
    end if;

    if v_first_geom is null then
      v_first_geom := v_last_geom;
    end if;

    v_emit_at := v_pending_at;
    v_dedup := 'GEOFENCE_ENTER:' || v_row.load_id || ':' || v_row.geofence_id || ':'
               || to_char(v_emit_at at time zone 'UTC', 'YYYYMMDDHH24MI');
    v_payload := jsonb_build_object(
      'geofence_id',   v_row.geofence_id,
      'geofence_name', v_row.geofence_name,
      'geofence_kind', v_row.geofence_kind,
      'notify_orgs',   to_jsonb(v_row.notify_orgs),
      'message_tpl',   v_row.message_tpl,
      'confirm',       'dwell',
      'dwell_seconds', v_row.dwell_seconds
    );

    update geofence_states set
      state        = 'INSIDE',
      consec_fixes = 0,
      entered_at   = v_emit_at,
      last_eval_at = p_now
    where load_id = v_row.load_id
      and geofence_id = v_row.geofence_id
      and state = 'PENDING_IN';

    if not found then
      continue;
    end if;

    v_quiet := (p_now - v_emit_at >= interval '2 hours');
    if v_quiet then
      perform set_config('tower.bulk_quiet', 'on', true);
    end if;

    insert into load_events (load_id, event_type, occurred_at, source, geom, payload, dedup_key)
    values (
      v_row.load_id, 'GEOFENCE_ENTER', v_emit_at, coalesce(v_first_src, 'TELEMATICS_API'),
      v_first_geom, v_payload, v_dedup
    )
    on conflict (dedup_key) where dedup_key is not null do nothing;

    if v_quiet then
      perform set_config('tower.bulk_quiet', '', true);
    end if;

    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;

revoke all on function public.geofence_confirm_pending_dwell(timestamptz) from public, anon, authenticated;
grant execute on function public.geofence_confirm_pending_dwell(timestamptz) to service_role;
comment on function public.geofence_confirm_pending_dwell(timestamptz) is
  '#574-nast: PENDING_IN (bez SITE); first pos >= greatest(EXIT, entered_at); bulk_quiet ≥2h; service_role.';

-- bulk_quiet wokół INSERT GEOFENCE_ENTER (cron ≥2 h) musi wyciszyć ZONE_* z macierzy
-- (0281 nie sprawdzał ustawienia — stąd FAIL #574i: 4 powiadomienia).
create or replace function public.trg_geofence_matrix_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_proj uuid;
  v_tpl text;
  v_fence text;
  v_gid uuid;
  v_kind text;
  v_country text;
  v_name text;
begin
  if current_setting('tower.bulk_quiet', true) = 'on' then
    return null;
  end if;
  if new.event_type not in ('GEOFENCE_ENTER', 'GEOFENCE_EXIT') then
    return null;
  end if;
  v_tpl := case new.event_type when 'GEOFENCE_ENTER' then 'ZONE_ENTER' else 'ZONE_EXIT' end;

  begin
    v_gid := nullif(new.payload->>'geofence_id', '')::uuid;
  exception when others then
    v_gid := null;
  end;

  if v_gid is not null then
    select g.kind::text, g.country, g.name
      into v_kind, v_country, v_name
      from geofences g
     where g.id = v_gid;
  end if;

  v_kind := coalesce(nullif(v_kind, ''), nullif(new.payload->>'geofence_kind', ''));
  v_country := coalesce(
    nullif(v_country, ''),
    nullif(new.payload->>'geofence_country', ''),
    nullif(new.payload->>'country', '')
  );
  v_name := coalesce(
    nullif(v_name, ''),
    nullif(new.payload->>'geofence_name', ''),
    nullif(new.payload->>'name', '')
  );

  v_fence := coalesce(
    nullif(new.payload->>'geofence_id', ''),
    coalesce(v_kind, '') || ':' || coalesce(v_name, ''),
    'x'
  );
  select project_id into v_proj from loads where id = new.load_id;
  perform public.matrix_notify(
    'LOAD_STATUS', v_tpl, new.load_id, v_proj,
    jsonb_build_object(
      'load_id', new.load_id,
      'event', new.event_type,
      'geofence_id', new.payload->>'geofence_id',
      'geofence_name', v_name,
      'geofence_kind', v_kind,
      'geofence_country', v_country
    ),
    'zone:' || new.event_type || ':' || new.load_id::text || ':' || v_fence
  );
  return null;
end $$;
revoke all on function public.trg_geofence_matrix_notify() from public, anon, authenticated;
comment on function public.trg_geofence_matrix_notify() is
  '#574-nast: ZONE_* z macierzy; tower.bulk_quiet=on → cisza (cron dwell ≥2 h).';

-- ---------------------------------------------------------------------------
-- 2. SG-23: GEOFENCE_DWELL payload po backdate ENTER (F7 #574 pkt 6 / odbiór)
-- ---------------------------------------------------------------------------
do $dwell$
declare
  v_load   uuid;
  v_enter  timestamptz;
  v_n      int := 0;
begin
  select l.id into v_load
    from loads l
   where public.load_sms_code(l.id) = 'SG-23'
      or exists (
           select 1 from shipment_items si
            where si.load_id = l.id and si.shipment_code = 'SG-23'
         )
   order by l.created_at desc nulls last
   limit 1;

  if v_load is null then
    raise notice '#574-nast: SG-23 nie znaleziony — pomijam przeliczenie DWELL';
    return;
  end if;

  select e.occurred_at into v_enter
    from load_events e
   where e.load_id = v_load
     and e.event_type = 'GEOFENCE_ENTER'
     and e.payload->>'geofence_kind' = 'SITE'
   order by e.occurred_at
   limit 1;

  if v_enter is null then
    raise notice '#574-nast: SG-23 bez GEOFENCE_ENTER SITE — pomijam DWELL';
    return;
  end if;

  alter table public.load_events disable trigger trg_load_events_immutable;

  update load_events e
     set payload = e.payload
       || jsonb_build_object(
            'entered_at', v_enter,
            'dwell_min', round(extract(epoch from (e.occurred_at - v_enter)) / 60.0),
            'minutes', round(extract(epoch from (e.occurred_at - v_enter)) / 60.0)
          )
   where e.load_id = v_load
     and e.event_type = 'GEOFENCE_DWELL'
     and e.payload->>'geofence_kind' = 'SITE'
     and (
       (e.payload->>'entered_at')::timestamptz is distinct from v_enter
       or (e.payload->>'dwell_min')::numeric
            is distinct from round(extract(epoch from (e.occurred_at - v_enter)) / 60.0)
     );

  get diagnostics v_n = row_count;
  alter table public.load_events enable trigger trg_load_events_immutable;

  raise notice '#574-nast: SG-23 DWELL przeliczony, wierszy=%', v_n;
exception
  when others then
    begin
      alter table public.load_events enable trigger trg_load_events_immutable;
    exception when others then
      null;
    end;
    raise;
end $dwell$;
