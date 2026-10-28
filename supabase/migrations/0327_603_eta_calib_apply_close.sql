-- #603 / F7 #607 + F7 r1/r2 #616: apply zamyka decyzję; macierz eta_calib; labels+summary; D5 spread jak 0320.
-- Po #597 (0326). Nie edytuj nałożonej migracji.
begin;

-- B2: HHL_OPS nie dostaje „Możesz cofnąć” (cofanie tylko HHL_ADMIN) — usuń wiersz macierzy.
delete from public.user_notify_pref
 where event_key = 'eta_calib'
   and user_id in (select id from public.app_users where role = 'HHL_OPS');
delete from public.notification_matrix
 where event_key = 'eta_calib'
   and role = 'HHL_OPS';

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
  v_n_codes int := 0;
  v_dec uuid;
  v_me uuid;
  v_note text;
begin
  if pg_try_advisory_xact_lock(hashtext('eta_calib')) is not true then
    raise exception 'ETA_CALIB_BUSY' using errcode = 'P0001';
  end if;

  select value into v_frozen from app_parameters where key = 'ETA_CALIBRATION_FROZEN';
  if coalesce(v_frozen, 0) = 1 then
    raise exception 'ETA_FROZEN' using errcode = 'P0001';
  end if;

  -- D1: p_auto=true = cron; false = ekran Opcji.
  v_note := case
    when p_auto then 'zastosowano automatycznie'
    else 'zastosowano z Opcji'
  end;

  select * into v from eta_calibration_versions where id = p_version;
  if not found then
    raise exception 'ETA_APPLY_MISSING' using errcode = 'P0001';
  end if;
  if v.applied is true and v.undone_at is null then
    -- Idempotentnie domknij decyzję, gdy APPLY z Opcji wyprzedził RESOLVE.
    v_me := case when p_auto then null else current_app_user_id() end;
    for v_dec in
      select d.id
        from decisions d
       where d.type_code = 'ETA_CALIBRATION_APPROVAL'
         and d.status in ('NEW', 'ASSIGNED', 'SNOOZED')
         and d.detail->>'event_key' = 'ETA_CALIB_VER:' || p_version::text
    loop
      update decisions
         set status = 'RESOLVED',
             resolved_at = now(),
             resolved_by = v_me,
             resolution_code = 'APPLY',
             resolution_note = v_note,
             snooze_until = null,
             updated_at = now()
       where id = v_dec;
      insert into decision_events (decision_id, actor_id, action, payload)
      values (
        v_dec, v_me, 'RESOLVE',
        jsonb_build_object(
          'option', 'APPLY', 'effect', 'ACCEPT',
          'note', v_note,
          'source', 'eta_apply_calibration_internal',
          'version', p_version, 'already_applied', true
        )
      );
      insert into audit_log (user_id, action, entity, entity_id, new_value)
      values (
        v_me, 'DECISION_RESOLVE', 'decisions', v_dec::text,
        jsonb_build_object(
          'option', 'APPLY', 'effect', 'ACCEPT',
          'type', 'ETA_CALIBRATION_APPROVAL',
          'source', 'eta_apply_calibration_internal',
          'version', p_version, 'already_applied', true
        )
      );
    end loop;
    return true;
  end if;
  if v.undone_at is not null then
    raise exception 'ETA_APPLY_UNDONE' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from eta_calibration_versions n
     where n.applied is true
       and n.undone_at is null
       and n.id > p_version
       and exists (
         select 1 from jsonb_object_keys(n.params_after) k1
          where jsonb_exists(v.params_after, k1)
       )
  ) then
    raise exception 'ETA_APPLY_NEWER' using errcode = 'P0001';
  end if;

  select count(*)::int into v_n_codes
    from jsonb_object_keys(v.params_after);

  -- #603 / F7 r2 D5: jak 0320 pending — rozrzut NULL→N liczony od 0 (do decyzji, bezpieczniej).
  for r in
    select e.key as code,
           (e.value->>'hours')::numeric as h_new,
           (b.value->>'hours')::numeric as h_old,
           (e.value->>'spread_pct')::numeric as sp_new,
           (b.value->>'spread_pct')::numeric as sp_old
      from jsonb_each(v.params_after) e
      join jsonb_each(v.params_before) b on b.key = e.key
  loop
    if nullif(r.h_old, 0) is null then
      continue;
    end if;
    v_chg := abs(r.h_new - r.h_old) / r.h_old;
    v_chg := greatest(
      v_chg,
      abs(coalesce(r.sp_new, 0) - coalesce(r.sp_old, 0)) / 100.0
    );
    v_max_chg := greatest(v_max_chg, v_chg);
  end loop;

  if p_auto is true then
    if coalesce(v.n_obs, 0) < 10 then
      raise exception 'AUTO_NEEDS_APPROVAL: n_obs < 10';
    end if;
    if v_max_chg > 0.15 then
      raise exception 'AUTO_NEEDS_APPROVAL: zmiana % %% > 15%%',
        round(v_max_chg * 100.0, 1)::text;
    end if;
    if v.error_after_min is not null
       and v.error_before_min is not null
       and v.error_after_min >= v.error_before_min then
      raise exception 'AUTO_NEEDS_APPROVAL: test wsteczny nie poprawia błędu';
    end if;
    v_label := 'automat kalibracji';
  elsif (current_app_role() = 'HHL_ADMIN') is not true then
    raise exception 'ETA_NOT_ADMIN' using errcode = '42501';
  end if;

  for k, h, sp in
    select e.key,
           (e.value->>'hours')::numeric,
           case
             when (e.value->>'spread_pct') is null then null
             when (b.value->>'spread_pct') is not null
                  and (e.value->>'spread_pct')::numeric
                      is not distinct from (b.value->>'spread_pct')::numeric
               then (e.value->>'spread_pct')::numeric
             else least(greatest((e.value->>'spread_pct')::numeric, 10), 100)
           end
      from jsonb_each(v.params_after) e
      left join jsonb_each(v.params_before) b on b.key = e.key
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
         undone_at = null,
         note = case
           when p_auto and coalesce(note, '') not like '%auto-applied%'
             then coalesce(note || '; ', '') || 'auto-applied'
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

  -- #603 pkt 1: zamknięcie otwartej ETA_CALIBRATION_APPROVAL (event_key ETA_CALIB_VER:…).
  -- Wersja już applied → trigger APPLY wraca no-op (bez pętli).
  v_me := case when p_auto then null else current_app_user_id() end;
  for v_dec in
    select d.id
      from decisions d
     where d.type_code = 'ETA_CALIBRATION_APPROVAL'
       and d.status in ('NEW', 'ASSIGNED', 'SNOOZED')
       and d.detail->>'event_key' = 'ETA_CALIB_VER:' || p_version::text
  loop
    update decisions
       set status = 'RESOLVED',
           resolved_at = now(),
           resolved_by = v_me,
           resolution_code = 'APPLY',
           resolution_note = v_note,
           snooze_until = null,
           updated_at = now()
     where id = v_dec;
    insert into decision_events (decision_id, actor_id, action, payload)
    values (
      v_dec,
      v_me,
      'RESOLVE',
      jsonb_build_object(
        'option', 'APPLY',
        'effect', 'ACCEPT',
        'note', v_note,
        'source', 'eta_apply_calibration_internal',
        'version', p_version
      )
    );
    -- D1: ta sama ścieżka audytu co decision_resolve.
    insert into audit_log (user_id, action, entity, entity_id, new_value)
    values (
      v_me, 'DECISION_RESOLVE', 'decisions', v_dec::text,
      jsonb_build_object(
        'option', 'APPLY', 'effect', 'ACCEPT',
        'type', 'ETA_CALIBRATION_APPROVAL',
        'source', 'eta_apply_calibration_internal',
        'version', p_version
      )
    );
  end loop;

  return true;
end;
$$;

revoke all on function public.eta_apply_calibration_internal(bigint, text, boolean)
  from public, anon, authenticated;
grant execute on function public.eta_apply_calibration_internal(bigint, text, boolean) to service_role;

create or replace function public.eta_auto_apply_pending()
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_id bigint;
  v_max numeric := 0;
  v_ok boolean;
  v_dec uuid;
  v_proj uuid;
  v_labels jsonb;
  v_codes text;
  v_pct_txt text;
  v_payload jsonb;
begin
  if pg_try_advisory_xact_lock(hashtext('eta_calib')) is not true then
    return jsonb_build_object('ok', false, 'reason', 'BUSY');
  end if;

  select id into v_id
    from eta_calibration_versions
   where applied is not true
     and undone_at is null
     and rejected_at is null
     and created_by is null
     and coalesce(note, '') like 'propozycja ciągła%'
   order by id desc
   limit 1;
  if v_id is null then
    return jsonb_build_object('ok', true, 'applied', null, 'reason', 'NO_PENDING');
  end if;

  -- F7 r2 D5: reguła 0320 — coalesce(spread,0); NULL→40 → NEEDS_APPROVAL (jak front maxChangeRaw).
  select coalesce(max(
           greatest(
             abs((a.value->>'hours')::numeric - (b.value->>'hours')::numeric)
               / nullif((b.value->>'hours')::numeric, 0),
             abs(coalesce((a.value->>'spread_pct')::numeric, 0)
                 - coalesce((b.value->>'spread_pct')::numeric, 0))
               / 100.0
           )
         ), 0)
    into v_max
    from eta_calibration_versions v
    cross join lateral jsonb_each(v.params_after) a
    join lateral jsonb_each(v.params_before) b on b.key = a.key
   where v.id = v_id;

  if v_max > 0.15 then
    select id into v_proj from projects
     where code in ('STEGRA_BODEN', 'STEGRA')
     order by case code when 'STEGRA_BODEN' then 0 else 1 end
     limit 1;
    if v_proj is null then
      select id into v_proj from projects order by created_at nulls last limit 1;
    end if;
    v_dec := public.decision_open_from_event(
      v_proj,
      'ETA_CALIBRATION_APPROVAL',
      'ETA_CALIB_VER:' || v_id::text,
      'Kalibracja ETA wymaga zatwierdzenia (zmiana > 15 %)',
      jsonb_build_object(
        'version', v_id,
        'action', 'apply_eta_calibration_version',
        'max_change_pct', round(v_max * 100.0, 1),
        'severity_override', 'WARNING'
      ),
      null,
      null
    );
    return jsonb_build_object(
      'ok', true, 'applied', null, 'reason', 'NEEDS_APPROVAL',
      'version', v_id, 'max_change_pct', round(v_max * 100.0, 1),
      'decision_id', v_dec
    );
  end if;

  begin
    v_ok := public.eta_apply_calibration_internal(v_id, 'automat kalibracji', true);
  exception when others then
    if SQLERRM like 'AUTO_NEEDS_APPROVAL%' or SQLERRM like 'ETA_FROZEN%'
       or SQLERRM like 'kalibracja zamrożona%'
       or SQLERRM like 'ETA_CALIB_BUSY%' or SQLERRM like 'BUSY%'
       or SQLERRM like 'ETA_APPLY_%' or SQLERRM like 'wersja cofnięta%' then
      return jsonb_build_object(
        'ok', true, 'applied', null, 'reason', 'BLOCKED',
        'version', v_id, 'msg', left(SQLERRM, 200)
      );
    end if;
    raise;
  end;

  select coalesce(
           (select jsonb_object_agg(k, coalesce(p.label, k))
              from eta_calibration_versions v
              cross join lateral jsonb_object_keys(v.params_after) k
              left join eta_segment_params p on p.code = k
             where v.id = v_id),
           '{}'::jsonb
         ),
         coalesce(
           (select string_agg(k, ', ' order by k)
              from eta_calibration_versions v
              cross join lateral jsonb_object_keys(v.params_after) k
             where v.id = v_id),
           '—'
         )
    into v_labels, v_codes;

  -- E21: przecinek dziesiętny w summary (12,4% nie 12.4%).
  v_pct_txt := replace(round(v_max * 100.0, 1)::text, '.', ',');

  v_payload := jsonb_build_object(
    'version', v_id,
    'undo_version', v_id,
    'max_change_pct', round(v_max * 100.0, 1),
    'matrix_event', 'eta_calib',
    'title', 'Kalibracja ETA zastosowana automatycznie',
    'summary', format(
      'Zastosowano wersję %s (zmiana do %s%%, kody: %s). Możesz cofnąć.',
      v_id::text, v_pct_txt, v_codes
    ),
    'codes', (
      select coalesce(jsonb_agg(k order by k), '[]'::jsonb)
        from eta_calibration_versions v
        cross join lateral jsonb_object_keys(v.params_after) k
       where v.id = v_id
    ),
    'labels', v_labels
  );

  -- B1/B2: tylko HHL_ADMIN; kanał 'bell' + notify_channel_allowed (firma→macierz→osoba).
  insert into notifications (channel, recipient, user_id, template, payload, dedup_key)
  select
    'IN_APP',
    coalesce(u.email::text, u.id::text),
    u.id,
    'ETA_CALIBRATION_AUTO',
    v_payload || jsonb_build_object('locale', u.locale),
    left('ETA_CALIB_AUTO:' || v_id::text || ':' || u.id::text, 200)
  from app_users u
 where u.active is true
   and u.role = 'HHL_ADMIN'
   and public.notify_channel_allowed(
         u.id, 'ETA_CALIBRATION_AUTO', v_payload, 'bell'
       ) is true
  on conflict (dedup_key) where dedup_key is not null do nothing;

  return jsonb_build_object(
    'ok', true, 'applied', v_id, 'max_change_pct', round(v_max * 100.0, 1),
    'undo_version', v_id
  );
end;
$$;

revoke all on function public.eta_auto_apply_pending() from public, anon, authenticated;
grant execute on function public.eta_auto_apply_pending() to service_role;

comment on function public.eta_apply_calibration_internal(bigint, text, boolean) is
  '#603 F7 r2: APPLY zamyka decyzję + DECISION_RESOLVE; max_change jak 0320 (spread NULL→0); note auto≠ekran.';
comment on function public.eta_auto_apply_pending() is
  '#603 F7 r2: HHL_ADMIN + notify_channel_allowed(bell); D5 spread coalesce(0); labels; summary E21; bez HHL_OPS.';

commit;
