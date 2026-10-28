-- C4 (D-20261015-0300-01): admin_ops_threshold_set zapisuje old_value (było → jest).
-- Dotąd „from/to” było tylko w new_value → Historia pokazywała puste „było”.
-- Alerty stref/ryzyk w przeglądarce usuwane w store (macierz + my_notify).
-- B5: pierwsza instrukcja po begin = perform assert_not_preview (CREATE OR REPLACE
-- zdejmuje wstrzyknięcie z 0300; komentarz przed perform łamie strażnik security).

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
    'import_quiet_hours'
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
  'C4: zmiana progu ops_thresholds — audit old_value/new_value (value); bez wpisu przy braku zmiany.';
