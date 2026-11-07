-- C5 (D-20261015-0300-01 / D-20261019-0930-01): payload.code = load_sms_code (shipment),
-- nigdy order_no / hhl_order_no / UUID. Luki po DP-205/206.

begin;

create or replace function public.trg_risk_matrix_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_group text;
  v_tpl text;
  v_proj uuid;
  v_n int;
  v_url text;
  v_code text;
  v_payload jsonb;
  v_dedup text;
begin
  if new.load_id is null
     and new.kind::text in ('FERRY', 'WEATHER', 'ROAD_SE', 'ROAD_PL') then
    return null;
  end if;
  if new.load_id is null
     and new.kind::text in ('ROAD_LT', 'ROAD_LV', 'ROAD_EE', 'ROAD_FI')
     and new.severity::text not in ('HIGH', 'CRITICAL') then
    if tg_op = 'UPDATE'
       and old.severity::text in ('HIGH', 'CRITICAL') then
      perform public.notify_mark_case_closed('sprawa zamknięta', null, new.id);
    end if;
    return null;
  end if;
  if new.kind::text in ('ROAD_LT', 'ROAD_LV', 'ROAD_EE', 'ROAD_FI', 'ROAD_SE')
     and coalesce(new.detail->>'obok_trasy', '') = 'true' then
    if tg_op = 'UPDATE'
       and old.severity::text in ('HIGH', 'CRITICAL') then
      perform public.notify_mark_case_closed('sprawa zamknięta', null, new.id);
    end if;
    return null;
  end if;
  if current_setting('tower.escalate_overdue', true) = '1'
     and coalesce(new.dedup_key, '') like 'decision-overdue:%' then
    return null;
  end if;

  v_group := case
    when new.kind::text in ('FERRY', 'WEATHER', 'ETA_BREACH') then 'RISK_FERRY_WEATHER'
    when new.kind::text in ('INVOICE_MISMATCH') then 'MONEY'
    when new.kind::text in ('USAGE_LIMIT', 'JOB_FAILURE') then 'SYSTEM'
    else 'SYSTEM'
  end;

  if tg_op = 'INSERT' then
    v_tpl := 'RISK_OPEN';
  elsif new.severity is distinct from old.severity then
    v_tpl := 'RISK_SEVERITY';
  elsif new.resolved_at is not null and old.resolved_at is null then
    v_n := public.notify_mark_case_closed('sprawa zamknięta', null, new.id);
    insert into public.audit_log (user_id, action, entity, entity_id, old_value, new_value)
    values (
      null, 'C1_RISK_RESOLVE_MARK_READ', 'risk_signals', new.id::text,
      jsonb_build_object('template', 'RISK_RESOLVED_skipped'),
      jsonb_build_object('marked', v_n, 'hotfix', '0256')
    );
    return null;
  else
    return null;
  end if;

  if v_tpl = 'RISK_SEVERITY'
     and new.severity::text = 'CRITICAL'
     and coalesce(new.detail->>'l3_level', '') = 'critical' then
    return null;
  end if;

  v_proj := new.project_id;
  if v_proj is null and new.load_id is not null then
    select project_id into v_proj from loads where id = new.load_id;
  end if;
  /* C5: kod wysyłki, nie order_no / hhl_order_no (KSH nigdy numeru zlecenia). */
  if new.load_id is not null then
    v_code := nullif(nullif(btrim(public.load_sms_code(new.load_id)), ''), '—');
  end if;
  v_payload := jsonb_build_object(
    'risk_id', new.id, 'kind', new.kind, 'severity', new.severity,
    'title', new.title, 'title_key', new.title_key,
    'code', v_code, 'load_id', new.load_id,
    'risk_audience', new.audience::text
  );
  v_url := public.notify_click_url(v_tpl, v_payload, new.load_id);
  v_payload := v_payload || jsonb_build_object('url', v_url);
  v_dedup := 'risk:' || v_tpl || ':' || new.id::text || ':' || new.severity::text;

  if new.audience = 'HHL' then
    perform public.matrix_notify(v_group, v_tpl, new.load_id, v_proj, v_payload, v_dedup, 'FORWARDER');
  elsif new.audience = 'HHL_PRZEWOZNIK' then
    perform public.matrix_notify(v_group, v_tpl, new.load_id, v_proj, v_payload, v_dedup, 'FORWARDER');
    perform public.matrix_notify(v_group, v_tpl, new.load_id, v_proj, v_payload, v_dedup, 'CARRIER');
  elsif new.audience = 'HHL_KLIENT' then
    perform public.matrix_notify(v_group, v_tpl, new.load_id, v_proj, v_payload, v_dedup, 'FORWARDER');
    perform public.matrix_notify(v_group, v_tpl, new.load_id, v_proj, v_payload, v_dedup, 'CLIENT');
  else
    perform public.matrix_notify(v_group, v_tpl, new.load_id, v_proj, v_payload, v_dedup);
  end if;
  return null;
end $$;

revoke all on function public.trg_risk_matrix_notify() from public, anon, authenticated;
comment on function public.trg_risk_matrix_notify() is
  'DP-156/203 + F7 #785 r2 + C5 0436: audience bez KSH przy HHL; payload.code = load_sms_code.';

create or replace function public.e49_detour_decide(
  p_case uuid,
  p_pick text,
  p_note text default null
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_case public.e49_detour_cases%rowtype;
  v_load public.loads%rowtype;
  v_pick text := upper(btrim(coalesce(p_pick, '')));
  v_choice text;
  v_hist text;
  v_via text;
  v_code text;
  v_payload jsonb;
  v_detour jsonb;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_who text;
  v_is_admin boolean;
  v_is_carrier boolean;
  v_payload_hhl jsonb;
  v_payload_ksh jsonb;
  v_carrier_ok boolean := false;
begin
  perform public.assert_not_preview();
  v_uid := public.current_app_user_id();
  if (v_uid is not null) is not true then
    raise exception 'Brak aktywnego konta' using errcode = '42501';
  end if;
  if v_pick not in ('HOLD', 'DETOUR') then
    raise exception 'e49_detour_decide: pick HOLD|DETOUR';
  end if;
  if v_note is not null and char_length(v_note) > 500 then
    raise exception 'e49_detour_decide: uwagi za długie (max 500)';
  end if;

  v_is_admin := (public.is_hhl_admin()) is true;
  select l.* into v_load
    from public.e49_detour_cases c
    join public.loads l on l.id = c.load_id
   where c.id = p_case;
  v_carrier_ok := found and (
    public.current_org_kind() = 'CARRIER'
    and v_load.carrier_org_id = public.current_org_id()
  );
  if (v_is_admin or v_carrier_ok) is not true then
    raise exception 'e49_detour_decide: brak uprawnień';
  end if;
  if not found then
    raise exception 'e49_detour_decide: brak sprawy';
  end if;

  select * into v_case from public.e49_detour_cases where id = p_case for update;
  if not found then
    raise exception 'e49_detour_decide: brak sprawy';
  end if;
  if v_case.closed_at is not null or v_case.decision is not null then
    raise exception 'e49_detour_decide: sprawa już rozstrzygnięta';
  end if;

  select * into v_load from public.loads where id = v_case.load_id;
  if not found then
    raise exception 'e49_detour_decide: brak transportu';
  end if;

  v_is_carrier := (
    public.current_org_kind() = 'CARRIER'
    and v_load.carrier_org_id = public.current_org_id()
  );
  if (v_is_admin or v_is_carrier) is not true then
    raise exception 'e49_detour_decide: brak uprawnień';
  end if;

  if v_pick = 'DETOUR' and coalesce(v_case.payload->'detour'->>'none', '') = 'true' then
    raise exception 'e49_detour_decide: brak objazdu dla zestawu — tylko postój';
  end if;

  v_detour := coalesce(v_case.payload->'detour', '{}'::jsonb);
  v_via := coalesce(v_detour->>'via', 'objazd');
  v_choice := case when v_pick = 'HOLD' then 'postój' else 'objazd' end;
  /* C5: kod wysyłki — nie order_no ani UUID. */
  v_code := nullif(nullif(btrim(public.load_sms_code(v_case.load_id)), ''), '—');
  v_who := case when v_is_admin then 'Administrator HHL' else 'SCX' end;

  if v_pick = 'HOLD' then
    v_hist := format(
      '%s: postój%s — %s zamknięty',
      v_who,
      case
        when v_case.payload->'hold'->>'untilIso' is not null
          then ' do ' || left(v_case.payload->'hold'->>'untilIso', 16)
        else ' do odwołania'
      end,
      v_case.place
    );
  else
    v_hist := format(
      '%s: objazd %s, +%s km, +%s min — %s zamknięty',
      v_who,
      v_via,
      coalesce(v_detour->>'addKm', '0'),
      coalesce(v_detour->>'addMin', '0'),
      v_case.place
    );
  end if;
  if v_note is not null then
    v_hist := v_hist || ' · uwagi: ' || v_note;
  end if;

  v_payload := jsonb_build_object(
    'pick', v_pick,
    'by', v_uid::text,
    'byRole', case when v_is_admin then 'HHL_ADMIN' else 'CARRIER' end,
    'atIso', now(),
    'note', v_note
  );

  update public.e49_detour_cases
     set decision = v_payload,
         decided_at = now(),
         decided_by = v_uid,
         closed_at = now(),
         close_reason = 'decided',
         updated_at = now()
   where id = p_case;

  insert into public.load_events (load_id, event_type, occurred_at, actor_id, payload, visible_to, dedup_key)
  values (
    v_case.load_id,
    'E49_DETOUR_DECISION',
    now(),
    v_uid,
    jsonb_build_object(
      'case_id', p_case,
      'pick', v_pick,
      'place', v_case.place,
      'text', v_hist,
      'note', v_note,
      'byRole', case when v_is_admin then 'HHL_ADMIN' else 'CARRIER' end
    ),
    array['FORWARDER', 'CARRIER']::org_kind[],
    'e49-detour:' || p_case::text || ':' || v_pick
  )
  on conflict (dedup_key) where dedup_key is not null do nothing;

  v_payload_hhl := jsonb_build_object(
    'code', v_code,
    'choice', v_choice,
    'closure', v_case.place,
    'who', v_who,
    'author', coalesce(
      (select nullif(btrim(u.full_name), '') from public.app_users u where u.id = v_uid),
      (select nullif(btrim(u.email::text), '') from public.app_users u where u.id = v_uid),
      v_uid::text
    ),
    'pick', v_pick,
    'case_id', p_case,
    'note', v_note,
    'via', v_via,
    'addKm', v_detour->>'addKm',
    'addMin', v_detour->>'addMin',
    'holdUntil', v_case.payload->'hold'->>'untilIso',
    'etaIso', coalesce(
      v_case.payload->'detour'->>'etaIso',
      v_case.payload->'hold'->>'etaIso'
    )
  );
  v_payload_ksh := (v_payload_hhl - 'note') - 'author';

  perform public.matrix_notify(
    'DECISION',
    'SCX_DETOUR_CHOICE',
    v_case.load_id,
    v_load.project_id,
    v_payload_hhl,
    'e49-detour-n:' || p_case::text,
    'FORWARDER'
  );
  perform public.matrix_notify(
    'DECISION',
    'SCX_DETOUR_CHOICE',
    v_case.load_id,
    v_load.project_id,
    v_payload_hhl,
    'e49-detour-n:' || p_case::text,
    'CARRIER'
  );
  perform public.matrix_notify(
    'DECISION',
    'SCX_DETOUR_CHOICE',
    v_case.load_id,
    v_load.project_id,
    v_payload_ksh,
    'e49-detour-n:' || p_case::text,
    'CLIENT'
  );

  return true;
end;
$$;

revoke all on function public.e49_detour_decide(uuid, text, text) from public, anon;
grant execute on function public.e49_detour_decide(uuid, text, text) to authenticated, service_role;

comment on function public.e49_detour_decide(uuid, text, text) is
  'E49-b F7 r4 + C5 0436: payload.code = load_sms_code; KSH bez author.';

commit;
