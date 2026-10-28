-- =====================================================================
-- #581 P4-k cz.2 — kalibracja ETA ciągła (cron 48 h + auto-apply 27A)
--
--   1) Usuń wrappery 0/4-arg (F7 N1: „function is not unique”)
--   2) eta_propose_calibration — mediana n≥5, odchylenie >10 %
--   3) eta_apply_calibration_internal — apply + audyt (HHL / „automat kalibracji”)
--   4) auto ≤15 % + test wsteczny; >15 % czeka; zamrożenie wstrzymuje
--   5) eta_calibration_undo — cofnięcie auto (HHL_ADMIN)
--   6) eta_calibration_tick + cron co 1 h (rebuild 48 h + propose + auto)
-- =====================================================================

-- ---------------------------------------------------------------------------
-- 1. Jednoznaczne sygnatury (F7 r2 N1)
-- ---------------------------------------------------------------------------
drop function if exists public.eta_rebuild_segment_observations();
drop function if exists public.eta_seg_event_at(uuid, text, text, timestamptz);
drop function if exists public.eta_upsert_segment_observation(uuid, text, timestamptz, timestamptz);

comment on function public.eta_rebuild_segment_observations(timestamptz) is
  '#581 P4-k: odbudowa pomiarów GPS; p_since null = 30 dni. Cron cz.2: now()-48h.';

-- ---------------------------------------------------------------------------
-- 2. Propozycja z obserwacji GPS (reguła RAPORT_KALIBRACJI / D-1100 §3 pkt 5)
--    Kalibrujemy drogi: PL_ROAD*, SE_ROAD* — bez CROSSING_*, PORT_*, SE_DAILY_REST,
--    SE_BREAKS, GPS_FRESH_MIN.
-- ---------------------------------------------------------------------------
create or replace function public.eta_propose_calibration()
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_frozen numeric;
  v_before jsonb := '{}'::jsonb;
  v_after jsonb := '{}'::jsonb;
  v_n int := 0;
  v_n_codes int := 0;
  v_err_before numeric := 0;
  v_err_after numeric := 0;
  v_err_n int := 0;
  v_max_chg numeric := 0;
  v_id bigint;
  r record;
  v_spread numeric;
  v_dev numeric;
  v_old numeric;
begin
  select value into v_frozen from app_parameters where key = 'ETA_CALIBRATION_FROZEN';
  if coalesce(v_frozen, 0) = 1 then
    return jsonb_build_object('ok', false, 'reason', 'FROZEN');
  end if;

  for r in
    select o.corridor as code,
           count(*)::int as n,
           percentile_cont(0.5) within group (order by o.hours_observed)::numeric as med,
           percentile_cont(0.1) within group (order by o.hours_observed)::numeric as p10,
           percentile_cont(0.9) within group (order by o.hours_observed)::numeric as p90,
           p.hours as hours_now,
           p.spread_pct as spread_now
      from eta_segment_observations o
      join eta_segment_params p on p.code = o.corridor
     where o.exclude_reason is null
       and o.hours_observed > 0
       and o.corridor ~ '^(PL_ROAD|SE_ROAD)'
       and o.corridor not in ('SE_BREAKS', 'SE_DAILY_REST', 'GPS_FRESH_MIN')
     group by o.corridor, p.hours, p.spread_pct
    having count(*) >= 5
  loop
    v_old := nullif(r.hours_now, 0);
    if v_old is null or r.med is null then
      continue;
    end if;
    v_dev := abs(r.med - r.hours_now) / v_old;
    if v_dev <= 0.10 then
      continue;
    end if;
    v_spread := greatest(abs(r.p90 - r.med), abs(r.med - r.p10))
                / nullif(r.med, 0) * 100.0;
    v_before := v_before || jsonb_build_object(
      r.code, jsonb_build_object('hours', r.hours_now, 'spread_pct', r.spread_now)
    );
    v_after := v_after || jsonb_build_object(
      r.code, jsonb_build_object(
        'hours', round(r.med, 3),
        'spread_pct', round(coalesce(v_spread, r.spread_now), 1)
      )
    );
    v_n := v_n + r.n;
    v_n_codes := v_n_codes + 1;
    v_max_chg := greatest(v_max_chg, abs(r.med - r.hours_now) / v_old);
  end loop;

  if v_n_codes = 0 then
    -- usuń zaległą niezatwierdzoną, jeśli już nie ma podstaw
    delete from eta_calibration_versions
     where applied is not true
       and coalesce(note, '') not like 'auto-applied%';
    return jsonb_build_object('ok', true, 'proposal', null, 'reason', 'NO_CHANGE');
  end if;

  -- test wsteczny: średni |obs − param| w minutach (przed / po medianie)
  select
    coalesce(avg(abs(o.hours_observed - (v_before -> o.corridor ->> 'hours')::numeric) * 60.0), 0),
    coalesce(avg(abs(o.hours_observed - (v_after  -> o.corridor ->> 'hours')::numeric) * 60.0), 0),
    count(*)::int
    into v_err_before, v_err_after, v_err_n
    from eta_segment_observations o
   where o.exclude_reason is null
     and o.hours_observed > 0
     and v_after ? o.corridor;

  if v_err_n > 0 and v_err_after >= v_err_before then
    return jsonb_build_object(
      'ok', true, 'proposal', null, 'reason', 'BACKTEST_WORSE',
      'error_before_min', round(v_err_before, 2),
      'error_after_min', round(v_err_after, 2)
    );
  end if;

  -- jedna aktywna propozycja: zastąp poprzednią niezatwierdzoną
  delete from eta_calibration_versions
   where applied is not true
     and coalesce(note, '') not like 'auto-applied%';

  insert into eta_calibration_versions (
    created_by, params_before, params_after, n_obs,
    error_before_min, error_after_min, applied, frozen, note
  ) values (
    null, v_before, v_after, v_n,
    round(v_err_before, 2), round(v_err_after, 2),
    false, false,
    format('propozycja ciągła #581; max_chg=%.1f%%; kody=%s', v_max_chg * 100.0, v_n_codes)
  )
  returning id into v_id;

  return jsonb_build_object(
    'ok', true,
    'proposal', v_id,
    'n_obs', v_n,
    'n_codes', v_n_codes,
    'max_change_pct', round(v_max_chg * 100.0, 1),
    'error_before_min', round(v_err_before, 2),
    'error_after_min', round(v_err_after, 2)
  );
end;
$$;

revoke all on function public.eta_propose_calibration() from public, anon, authenticated;
grant execute on function public.eta_propose_calibration() to service_role;

comment on function public.eta_propose_calibration() is
  '#581 P4-k cz.2: propozycja z mediana n≥5, odchylenie >10 %, test wsteczny; bez CROSSING/SE_DAILY_REST.';

-- ---------------------------------------------------------------------------
-- 3. Wspólne zastosowanie wersji (HHL_ADMIN albo automat)
-- ---------------------------------------------------------------------------
create or replace function public.eta_apply_calibration_internal(
  p_version bigint,
  p_actor text default null,
  p_auto boolean default false
) returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v record;
  v_frozen numeric;
  k text; h numeric; sp numeric;
  v_label text := coalesce(nullif(trim(p_actor), ''), 'HHL_ADMIN');
  v_max_chg numeric := 0;
  v_chg numeric;
  r record;
begin
  select value into v_frozen from app_parameters where key = 'ETA_CALIBRATION_FROZEN';
  if coalesce(v_frozen, 0) = 1 then
    raise exception 'kalibracja zamrożona — odmroź przed zastosowaniem wersji';
  end if;

  select * into v from eta_calibration_versions where id = p_version;
  if not found then
    raise exception 'brak wersji %', p_version;
  end if;
  if v.applied is true then
    return true;
  end if;

  if p_auto is true then
    for r in
      select e.key as code,
             (e.value->>'hours')::numeric as h_new,
             (b.value->>'hours')::numeric as h_old
        from jsonb_each(v.params_after) e
        join jsonb_each(v.params_before) b on b.key = e.key
    loop
      if nullif(r.h_old, 0) is null then
        continue;
      end if;
      v_chg := abs(r.h_new - r.h_old) / r.h_old;
      v_max_chg := greatest(v_max_chg, v_chg);
    end loop;
    if v_max_chg > 0.15 then
      raise exception 'AUTO_NEEDS_APPROVAL: zmiana %.1f%% > 15%%', v_max_chg * 100.0;
    end if;
    if v.error_after_min is not null
       and v.error_before_min is not null
       and v.error_after_min >= v.error_before_min then
      raise exception 'AUTO_NEEDS_APPROVAL: test wsteczny nie poprawia błędu';
    end if;
    v_label := 'automat kalibracji';
  elsif (current_app_role() = 'HHL_ADMIN') is not true then
    raise exception 'wyłącznie HHL_ADMIN';
  end if;

  for k, h, sp in
    select e.key, (e.value->>'hours')::numeric, (e.value->>'spread_pct')::numeric
      from jsonb_each(v.params_after) e
  loop
    update eta_segment_params
       set hours = h,
           spread_pct = coalesce(sp, spread_pct),
           updated_at = now(),
           updated_by = case when p_auto then null else current_app_user_id() end,
           source = case
             when p_auto then 'automat kalibracji #' || p_version
             else 'kalibracja wersja ' || p_version
           end
     where code = k;
  end loop;

  update eta_calibration_versions
     set applied = true,
         note = case
           when p_auto then coalesce(note || '; ', '') || 'auto-applied'
           else note
         end
   where id = p_version;

  insert into audit_log (user_id, action, entity, entity_id, new_value)
  values (
    case when p_auto then null else current_app_user_id() end,
    'ETA_CALIBRATION_APPLY',
    'eta_calibration_versions',
    p_version::text,
    jsonb_build_object(
      'version', p_version,
      'auto', p_auto,
      'actor', v_label,
      'max_change_pct', round(v_max_chg * 100.0, 1)
    )
  );
  return true;
end;
$$;

revoke all on function public.eta_apply_calibration_internal(bigint, text, boolean)
  from public, anon, authenticated;
grant execute on function public.eta_apply_calibration_internal(bigint, text, boolean) to service_role;

-- HHL_ADMIN: dotychczasowe API
create or replace function public.apply_eta_calibration_version(p_version bigint)
returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if (current_app_role() = 'HHL_ADMIN') is not true then
    raise exception 'wyłącznie HHL_ADMIN';
  end if;
  return public.eta_apply_calibration_internal(p_version, null, false);
end;
$$;

revoke all on function public.apply_eta_calibration_version(bigint) from public, anon;
grant execute on function public.apply_eta_calibration_version(bigint) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Auto-apply najnowszej propozycji (≤15 % + wsteczny lepszy) + powiadomienie
-- ---------------------------------------------------------------------------
create or replace function public.eta_auto_apply_pending()
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_id bigint;
  v_max numeric := 0;
  v_ok boolean;
  v_prev bigint;
begin
  select id into v_id
    from eta_calibration_versions
   where applied is not true
   order by id desc
   limit 1;
  if v_id is null then
    return jsonb_build_object('ok', true, 'applied', null, 'reason', 'NO_PENDING');
  end if;

  select coalesce(max(
           abs((a.value->>'hours')::numeric - (b.value->>'hours')::numeric)
           / nullif((b.value->>'hours')::numeric, 0)
         ), 0)
    into v_max
    from eta_calibration_versions v
    cross join lateral jsonb_each(v.params_after) a
    join lateral jsonb_each(v.params_before) b on b.key = a.key
   where v.id = v_id;

  if v_max > 0.15 then
    return jsonb_build_object(
      'ok', true, 'applied', null, 'reason', 'NEEDS_APPROVAL',
      'version', v_id, 'max_change_pct', round(v_max * 100.0, 1)
    );
  end if;

  begin
    v_ok := public.eta_apply_calibration_internal(v_id, 'automat kalibracji', true);
  exception when others then
    if SQLERRM like 'AUTO_NEEDS_APPROVAL%' or SQLERRM like 'kalibracja zamrożona%' then
      return jsonb_build_object(
        'ok', true, 'applied', null, 'reason', 'BLOCKED',
        'version', v_id, 'msg', left(SQLERRM, 200)
      );
    end if;
    raise;
  end;

  -- poprzednia zastosowana (do cofnięcia)
  select id into v_prev
    from eta_calibration_versions
   where applied is true and id < v_id
   order by id desc
   limit 1;

  insert into notifications (channel, recipient, user_id, template, payload, dedup_key)
  select
    'IN_APP',
    coalesce(u.email::text, u.id::text),
    u.id,
    'ETA_CALIBRATION_AUTO',
    jsonb_build_object(
      'version', v_id,
      'undo_version', v_prev,
      'max_change_pct', round(v_max * 100.0, 1),
      'locale', u.locale
    ),
    left('ETA_CALIB_AUTO:' || v_id::text || ':' || u.id::text, 200)
  from app_users u
  where u.active is true
    and u.role = 'HHL_ADMIN'
  on conflict (dedup_key) where dedup_key is not null do nothing;

  return jsonb_build_object(
    'ok', true, 'applied', v_id, 'max_change_pct', round(v_max * 100.0, 1),
    'undo_version', v_prev
  );
end;
$$;

revoke all on function public.eta_auto_apply_pending() from public, anon, authenticated;
grant execute on function public.eta_auto_apply_pending() to service_role;

-- ---------------------------------------------------------------------------
-- 5. Cofnięcie auto — przywróć params_before wskazanej wersji (HHL_ADMIN)
-- ---------------------------------------------------------------------------
create or replace function public.eta_calibration_undo(p_version bigint)
returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v record;
  v_frozen numeric;
  k text; h numeric; sp numeric;
begin
  if (current_app_role() = 'HHL_ADMIN') is not true then
    raise exception 'wyłącznie HHL_ADMIN';
  end if;
  select value into v_frozen from app_parameters where key = 'ETA_CALIBRATION_FROZEN';
  if coalesce(v_frozen, 0) = 1 then
    raise exception 'kalibracja zamrożona — odmroź przed cofnięciem';
  end if;
  select * into v from eta_calibration_versions where id = p_version and applied is true;
  if not found then
    raise exception 'brak zastosowanej wersji %', p_version;
  end if;

  for k, h, sp in
    select e.key, (e.value->>'hours')::numeric, (e.value->>'spread_pct')::numeric
      from jsonb_each(v.params_before) e
  loop
    update eta_segment_params
       set hours = h,
           spread_pct = coalesce(sp, spread_pct),
           updated_at = now(),
           updated_by = current_app_user_id(),
           source = 'cofnięcie kalibracji #' || p_version
     where code = k;
  end loop;

  update eta_calibration_versions
     set note = coalesce(note || '; ', '') || 'undone'
   where id = p_version;

  insert into audit_log (user_id, action, entity, entity_id, new_value)
  values (
    current_app_user_id(),
    'ETA_CALIBRATION_UNDO',
    'eta_calibration_versions',
    p_version::text,
    jsonb_build_object('version', p_version, 'actor', 'HHL_ADMIN')
  );
  return true;
end;
$$;

revoke all on function public.eta_calibration_undo(bigint) from public, anon;
grant execute on function public.eta_calibration_undo(bigint) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Tick godzinowy: pomiar 48 h + propozycja + auto
-- ---------------------------------------------------------------------------
create or replace function public.eta_calibration_tick()
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_rebuild jsonb;
  v_prop jsonb;
  v_auto jsonb;
begin
  v_rebuild := public.eta_rebuild_segment_observations(now() - interval '48 hours');
  v_prop := public.eta_propose_calibration();
  v_auto := public.eta_auto_apply_pending();
  insert into integration_runs (job, ok, result)
  values (
    'eta_calib_tick',
    true,
    jsonb_build_object('rebuild', v_rebuild, 'propose', v_prop, 'auto', v_auto)
  );
  return jsonb_build_object('rebuild', v_rebuild, 'propose', v_prop, 'auto', v_auto);
exception when others then
  insert into integration_runs (job, ok, result)
  values (
    'eta_calib_tick',
    false,
    jsonb_build_object('sqlstate', SQLSTATE, 'msg', left(SQLERRM, 200))
  );
  raise;
end;
$$;

revoke all on function public.eta_calibration_tick() from public, anon, authenticated;
grant execute on function public.eta_calibration_tick() to service_role;

comment on function public.eta_calibration_tick() is
  '#581 P4-k cz.2: co 1 h — rebuild dostaw z 48 h, propozycja, auto-apply ≤15 % (27A).';

do $cron$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron')
     and to_regprocedure('cron.schedule(text,text,text)') is not null then
    perform cron.unschedule(jobid)
      from cron.job where jobname = 'tower-eta-calibration';
    perform cron.schedule(
      'tower-eta-calibration',
      '15 * * * *',
      $job$select public.eta_calibration_tick()$job$
    );
  else
    raise notice '#581: pg_cron niedostępny — tower-eta-calibration do zaplanowania ręcznie';
  end if;
end $cron$;
