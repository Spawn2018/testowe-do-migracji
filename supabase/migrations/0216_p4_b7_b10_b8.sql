-- 0216 — P4 / D-20261015-0300-01 B7, B8, B10, B4 (część)
-- B7: progi E15 w ops_thresholds (SILENT_MIN 30, pewność ETA, skraj strefy, postój 3 h)
-- B8 / L57: geometria dojazdu SG-03 (drogi 356/383 → 65,80638 / 21,80238)
-- B10: faza z pozycji tylko Droga PL / Droga SE — bez prostokąta FERRY
-- B4: STATUS_AUTO z TELM_PHASE_INFER zawiera tracker_on / trackerPlate z loads

-- ── B7: progi ──────────────────────────────────────────────────────────────
do $$
declare
  c text;
begin
  select con.conname into c
    from pg_constraint con
   where con.conrelid = 'public.ops_thresholds'::regclass
     and con.contype = 'c'
     and pg_get_constraintdef(con.oid) like '%WAVE_M%';
  if c is not null then
    execute format('alter table public.ops_thresholds drop constraint %I', c);
  end if;
end $$;

alter table public.ops_thresholds
  add constraint ops_thresholds_key_check check (key in (
    'WAVE_M','GUST_KN','DELAY_MIN','LEAD_DAYS',
    'AWIZ_EARLY_H','AWIZ_LATE_H','DOC_WARN_H','DOC_CRIT_H',
    'SILENT_MIN','OFFROUTE_KM',
    'DWELL_FREE_LOAD_H','DWELL_FREE_UNLOAD_H','DWELL_HOURLY_EUR','DWELL_DAILY_EUR',
    'DWELL_START_LATER','DWELL_FULL_HOUR','DWELL_DAY_AFTER_H',
    'ETA_CONF_HIGH_MIN','ETA_CONF_MED_MIN','GEOFENCE_EDGE_M','SILENT_STOP_H'
  ));

insert into public.ops_thresholds (key, value_num, unit, label_pl) values
  ('ETA_CONF_HIGH_MIN', 30,  'min', 'Pewność ETA — Wysoka do'),
  ('ETA_CONF_MED_MIN',  120, 'min', 'Pewność ETA — Średnia do'),
  ('GEOFENCE_EDGE_M',   300, 'm',   'Skraj strefy'),
  ('SILENT_STOP_H',     3,   'h',   'Postój bez sygnału — informacja po')
on conflict (key) do update
  set value_num = excluded.value_num,
      unit = excluded.unit,
      label_pl = excluded.label_pl,
      updated_at = now();

-- E15 pkt 4: cisza w ruchu po 30 min (było 15)
update public.ops_thresholds
   set value_num = 30,
       label_pl = 'Brak GPS w ruchu',
       updated_at = now()
 where key = 'SILENT_MIN'
   and value_num is distinct from 30;

create or replace function public.admin_ops_threshold_set(p_key text, p_value numeric)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid;
  v_role text;
  v_old numeric;
begin
  select id, role::text into v_me, v_role from app_users where auth_id = auth.uid() and active;
  if (v_me is not null and v_role = 'HHL_ADMIN') is not true then
    raise exception 'Progi — wyłącznie administrator HHL' using errcode = '42501';
  end if;
  if (p_key in (
    'WAVE_M','GUST_KN','DELAY_MIN','LEAD_DAYS',
    'AWIZ_EARLY_H','AWIZ_LATE_H','DOC_WARN_H','DOC_CRIT_H',
    'SILENT_MIN','OFFROUTE_KM',
    'DWELL_FREE_LOAD_H','DWELL_FREE_UNLOAD_H','DWELL_HOURLY_EUR','DWELL_DAILY_EUR',
    'DWELL_START_LATER','DWELL_FULL_HOUR','DWELL_DAY_AFTER_H',
    'ETA_CONF_HIGH_MIN','ETA_CONF_MED_MIN','GEOFENCE_EDGE_M','SILENT_STOP_H'
  )) is not true then
    raise exception 'Nieznany próg' using errcode = '22023';
  end if;
  if (p_value is not null and p_value > 0) is not true then
    raise exception 'Wartość progu musi być > 0' using errcode = '22023';
  end if;

  select value_num into v_old from ops_thresholds where key = p_key for update;
  if (v_old is not null) is not true then
    raise exception 'Brak wiersza progu' using errcode = 'P0002';
  end if;

  update ops_thresholds
     set value_num = p_value, updated_at = now(), updated_by = v_me
   where key = p_key;

  insert into audit_log (user_id, action, entity, entity_id, new_value)
  values (v_me, 'OPS_THRESHOLD_SET', 'ops_thresholds', p_key,
          jsonb_build_object('from', v_old, 'to', p_value));
end;
$$;

revoke all on function public.admin_ops_threshold_set(text, numeric) from public, anon;
grant execute on function public.admin_ops_threshold_set(text, numeric) to authenticated;

-- Odczyt progów ETA / ciszy dla wszystkich zalogowanych (słowa pewności w panelu)
drop policy if exists ops_thresholds_read on public.ops_thresholds;
create policy ops_thresholds_read on public.ops_thresholds for select to authenticated using (
  exists (
    select 1 from app_users u
    where u.auth_id = auth.uid() and u.active
      and (
        u.role in ('HHL_ADMIN','HHL_OPS')
        or key in (
          'ETA_CONF_HIGH_MIN','ETA_CONF_MED_MIN','GEOFENCE_EDGE_M',
          'SILENT_MIN','SILENT_STOP_H','DELAY_MIN'
        )
      )
  )
);

-- ── B8: dojazd SG-03 (L57) ─────────────────────────────────────────────────
alter table public.corridor_polylines drop constraint if exists corridor_polylines_code_check;
alter table public.corridor_polylines
  add constraint corridor_polylines_code_check
  check (code in ('PL_ROAD', 'SE_E4', 'SE_APPROACH_SG03'));

insert into public.corridor_polylines (code, geom, total_km, source)
values (
  'SE_APPROACH_SG03',
  st_setsrid(st_makeline(array[
    /* dojazd od północy: drogi 356 / 383 → wjazd na plac (E15 / E45 / L57) */
    st_makepoint(21.78812, 65.82178),
    st_makepoint(21.79500, 65.81500),
    st_makepoint(21.80050, 65.81000),
    st_makepoint(21.80238, 65.80638)
  ]), 4326),
  round((st_length(st_setsrid(st_makeline(array[
    st_makepoint(21.78812, 65.82178),
    st_makepoint(21.79500, 65.81500),
    st_makepoint(21.80050, 65.81000),
    st_makepoint(21.80238, 65.80638)
  ]), 4326)::geography) / 1000.0)::numeric, 2),
  'E15/E45/L57 — ostatni odcinek SG-03 (356/383, wjazd od północy; P4 B8; rysowanie w P9)'
)
on conflict (code) do update set
  geom = excluded.geom,
  total_km = excluded.total_km,
  source = excluded.source,
  updated_at = now();

-- ── B10 + B4: faza z pozycji bez FERRY; tracker_on w STATUS_AUTO ────────────
create or replace function public.telm_infer_phase_from_position(
  p_load uuid, p_lat float8, p_lon float8, p_ts timestamptz default now()
) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_status load_status;
  v_phase text;
  v_ok boolean := false;
  v_ts timestamptz := coalesce(p_ts, now());
  v_gid uuid;
  v_tracker text;
  v_plate text;
begin
  if p_load is null or p_lat is null or p_lon is null then return null; end if;
  select status, rio_tracker_on, coalesce(nullif(btrim(trailer_plate), ''), nullif(btrim(tractor_plate), ''))
    into v_status, v_tracker, v_plate
    from loads where id = p_load;
  if v_status is null or v_status in (
    'CANCELLED', 'UNLOADED', 'DELIVERED', 'AT_SITE',
    'IN_TRANSIT_SE', 'AT_PORT_NYNASHAMN', 'FERRY'
  ) then
    return null;
  end if;

  /* B10: tylko Droga PL / Droga SE — bez prostokąta FERRY (D-0300 B10) */
  if p_lat >= 55.0 and p_lon >= 11.0 and p_lon <= 25.0 and p_lat <= 70.0 then
    v_phase := 'IN_TRANSIT_SE';
  elsif p_lat >= 49.0 and p_lat < 55.0 and p_lon >= 14.0 and p_lon <= 25.0 then
    v_phase := 'IN_TRANSIT_PL';
  else
    return null;
  end if;

  insert into telm_attach_phase (load_id, phase, observed_at, lat, lon)
  values (p_load, v_phase, v_ts, p_lat, p_lon)
  on conflict (load_id) do nothing;

  select id into v_gid from geofences
   where kind = 'LOADING' and active
   order by sort_order nulls last, name
   limit 1;
  insert into load_events (load_id, event_type, occurred_at, payload, dedup_key)
  values (
    p_load, 'GEOFENCE_EXIT', v_ts,
    jsonb_build_object(
      'geofence_id', v_gid,
      'geofence_kind', 'LOADING',
      'synthetic', true,
      'zrodlo', 'TELM_PHASE_INFER',
      'powod', 'faza z pozycji przy podłączeniu',
      'actual_load', false
    ),
    'TELM_PHASE_EXIT_LOAD:' || p_load::text
  )
  on conflict (dedup_key) where dedup_key is not null do nothing;

  v_ok := auto_set_status(
    p_load, v_status, v_phase::load_status,
    'faza z pozycji przy podłączeniu',
    v_ts,
    jsonb_build_object(
      'zrodlo', 'TELM_PHASE_INFER',
      'lat', p_lat, 'lon', p_lon,
      'powod', 'faza z pozycji przy podłączeniu',
      'tracker_on', v_tracker,
      'trackerPlate', v_plate
    )
  );

  insert into load_events (load_id, event_type, occurred_at, payload, dedup_key)
  values (
    p_load, 'STATUS_AUTO', v_ts,
    jsonb_build_object(
      'from', v_status,
      'to', case when v_ok then v_phase else v_status::text end,
      'target_phase', v_phase,
      'status_applied', v_ok,
      'powod', 'faza z pozycji przy podłączeniu',
      'zrodlo', 'TELM_PHASE_INFER',
      'lat', p_lat, 'lon', p_lon,
      'tracker_on', v_tracker,
      'trackerPlate', v_plate
    ),
    'TELM_PHASE_INFER:' || p_load::text || ':' || v_phase
  )
  on conflict (dedup_key) where dedup_key is not null do nothing;

  begin
    perform public.refresh_load_eta(p_load);
  exception when others then
    null;
  end;

  return v_phase;
end $$;

revoke all on function public.telm_infer_phase_from_position(uuid, float8, float8, timestamptz)
  from public, anon, authenticated;
grant execute on function public.telm_infer_phase_from_position(uuid, float8, float8, timestamptz)
  to service_role;
