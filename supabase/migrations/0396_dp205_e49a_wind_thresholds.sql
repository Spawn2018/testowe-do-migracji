-- DP-205 E49-a (D-20261104-0105-01 / #783): progi wiatru Z1 pkt 5 w ops_thresholds.
-- D-84 = 20 m/s (16.10). WIND_E49 włączamy w froncie po podłączeniu ETA (ten PR: fundament).

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
    'SILENT_MIN','SILENT_MIN_EMTRACK','OFFROUTE_KM',
    'DWELL_FREE_LOAD_H','DWELL_FREE_UNLOAD_H','DWELL_HOURLY_EUR','DWELL_DAILY_EUR',
    'DWELL_START_LATER','DWELL_FULL_HOUR','DWELL_DAY_AFTER_H',
    'ETA_CONF_HIGH_MIN','ETA_CONF_MED_MIN','GEOFENCE_EDGE_M','SILENT_STOP_H',
    'import_quiet_hours',
    'WIND_SLOW_MS','WIND_CROSS_PCT','WIND_HEAD_PCT',
    'WIND_HOLD_MS','WIND_RESUME_MS','WIND_RESUME_MIN'
  ));

insert into public.ops_thresholds (key, value_num, unit, label_pl) values
  ('WIND_SLOW_MS', 20, 'm/s', 'Wiatr: próg spowolnienia ETA (porywy)'),
  ('WIND_CROSS_PCT', 15, '%', 'Wiatr: dodatek czasu z boku (20–24 m/s)'),
  ('WIND_HEAD_PCT', 5, '%', 'Wiatr: dodatek czasu z przodu (20–24 m/s)'),
  ('WIND_HOLD_MS', 25, 'm/s', 'Wiatr: próg postoju ETA'),
  ('WIND_RESUME_MS', 20, 'm/s', 'Wiatr: próg ruszenia po postoju'),
  ('WIND_RESUME_MIN', 30, 'min', 'Wiatr: bufor po spadku poniżej progu ruszenia')
on conflict (key) do nothing;

create or replace function public.admin_ops_threshold_set(p_key text, p_value numeric)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid;
  v_role text;
  v_old numeric;
begin
  perform public.assert_not_preview();
  select id, role::text into v_me, v_role from app_users where auth_id = auth.uid() and active;
  if (v_me is not null and v_role = 'HHL_ADMIN') is not true then
    raise exception 'Progi — wyłącznie administrator HHL' using errcode = '42501';
  end if;
  if (p_key in (
    'WAVE_M','GUST_KN','DELAY_MIN','LEAD_DAYS',
    'AWIZ_EARLY_H','AWIZ_LATE_H','DOC_WARN_H','DOC_CRIT_H',
    'SILENT_MIN','SILENT_MIN_EMTRACK','OFFROUTE_KM',
    'DWELL_FREE_LOAD_H','DWELL_FREE_UNLOAD_H','DWELL_HOURLY_EUR','DWELL_DAILY_EUR',
    'DWELL_START_LATER','DWELL_FULL_HOUR','DWELL_DAY_AFTER_H',
    'ETA_CONF_HIGH_MIN','ETA_CONF_MED_MIN','GEOFENCE_EDGE_M','SILENT_STOP_H',
    'import_quiet_hours',
    'WIND_SLOW_MS','WIND_CROSS_PCT','WIND_HEAD_PCT',
    'WIND_HOLD_MS','WIND_RESUME_MS','WIND_RESUME_MIN'
  )) is not true then
    raise exception 'Nieznany próg' using errcode = '22023';
  end if;
  if p_key = 'import_quiet_hours' then
    if (p_value is not null and p_value in (0, 1)) is not true then
      raise exception 'import_quiet_hours: 0 lub 1' using errcode = '22023';
    end if;
  elsif (p_value is not null and p_value > 0) is not true then
    raise exception 'Wartość progu musi być > 0' using errcode = '22023';
  end if;

  select value_num into v_old from ops_thresholds where key = p_key for update;
  if (v_old is not null) is not true then
    raise exception 'Brak wiersza progu' using errcode = 'P0002';
  end if;

  if (v_old is distinct from p_value) is not true then
    return;
  end if;

  update ops_thresholds
     set value_num = p_value, updated_at = now(), updated_by = v_me
   where key = p_key;

  insert into audit_log (user_id, action, entity, entity_id, old_value, new_value)
  values (
    v_me,
    'OPS_THRESHOLD_SET',
    'ops_thresholds',
    p_key,
    jsonb_build_object('value', v_old),
    jsonb_build_object('value', p_value)
  );
end;
$$;

revoke all on function public.admin_ops_threshold_set(text, numeric) from public, anon;
grant execute on function public.admin_ops_threshold_set(text, numeric) to authenticated;

comment on function public.admin_ops_threshold_set(text, numeric) is
  'C4 + DP-205: progi ops_thresholds (w tym WIND_* E49); audit old_value/new_value.';
