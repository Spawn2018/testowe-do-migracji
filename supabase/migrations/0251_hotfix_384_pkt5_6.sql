-- HOTFIX #384 / D-20261021-1130-01 pkt 5–6
-- 5: PROPOSE_DATE + p_payload → KSH_DATE_COUNTER (KSH: Przyjmuję / Odrzucam / Eskaluj)
-- 6: po eskalacji lub po terminie l2_may_resolve dopuszcza HHL_OPS
-- Sygnatura RPC (ekran wyglad/*):
--   decision_resolve(p_decision uuid, p_option text, p_note text default null, p_payload jsonb default null)
--   p_payload: { load_date date, load_from?, delivery_date?, delivery_from? }
--   dla effect PROPOSE: load_date wymagana

-- ---------------------------------------------------------------------------
-- Katalog: CLIENT jako decydent + typ KSH_DATE_COUNTER
-- ---------------------------------------------------------------------------
do $$
declare
  c_name text;
begin
  select con.conname into c_name
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace n on n.oid = rel.relnamespace
   where n.nspname = 'public'
     and rel.relname = 'decision_types'
     and con.contype = 'c'
     and pg_get_constraintdef(con.oid) like '%decider_role%';
  if c_name is not null then
    execute format('alter table public.decision_types drop constraint %I', c_name);
  end if;
end $$;

alter table public.decision_types
  add constraint decision_types_decider_role_check
  check (decider_role in ('HHL', 'CARRIER', 'ADMIN', 'CLIENT'));

insert into public.decision_types (
  code, title_key, decider_role, options, due_hours, due_note, severity_default, sort_order
) values (
  'KSH_DATE_COUNTER',
  'dec_type_KSH_DATE_COUNTER',
  'CLIENT',
  '[
    {"code":"ACCEPT","label_key":"dec_opt_ACCEPT","requires_comment":false,"effect":"ACCEPT"},
    {"code":"REJECT","label_key":"dec_opt_REJECT_DATE","requires_comment":false,"effect":"SKIP"},
    {"code":"ESCALATE_HHL","label_key":"dec_opt_ESCALATE_HHL","requires_comment":false,"effect":"ESCALATE"}
  ]'::jsonb,
  24,
  null,
  'WARNING',
  24
)
on conflict (code) do update set
  title_key = excluded.title_key,
  decider_role = excluded.decider_role,
  options = excluded.options,
  due_hours = excluded.due_hours,
  severity_default = excluded.severity_default,
  sort_order = excluded.sort_order,
  active = true;

-- ---------------------------------------------------------------------------
-- RLS: KSH widzi decyzje CLIENT własnego projektu
-- ---------------------------------------------------------------------------
drop policy if exists decisions_read on public.decisions;
create policy decisions_read on public.decisions for select to authenticated using (
  current_app_user_id() is not null
  and (
    is_hhl()
    or (current_org_kind() = 'CARRIER' and exists (
          select 1 from decision_types t
           where t.code = decisions.type_code
             and t.decider_role in ('CARRIER', 'HHL')))
    or (current_org_kind() = 'CLIENT' and exists (
          select 1 from decision_types t
           where t.code = decisions.type_code
             and t.decider_role = 'CLIENT'
             and exists (
               select 1 from projects p
                where p.id = decisions.project_id
                  and p.client_org_id = current_org_id())))
  )
);

-- ---------------------------------------------------------------------------
-- pkt 6: l2_may_resolve — CLIENT + HHL_OPS po eskalacji / po terminie
-- ---------------------------------------------------------------------------
drop function if exists public.l2_may_resolve(text);

create or replace function public.l2_may_resolve(p_role text, p_decision uuid default null)
returns boolean
language sql
stable
set search_path = public
as $$
  select case
    when current_app_role() = 'HHL_ADMIN' then true
    when p_role = 'HHL' and current_org_kind() = 'FORWARDER' then true
    when p_role = 'CARRIER' and current_org_kind() = 'CARRIER' then true
    when p_role = 'CLIENT' and current_org_kind() = 'CLIENT' then true
    when current_app_role() = 'HHL_OPS'
         and p_decision is not null
         and exists (
           select 1 from decisions d
            where d.id = p_decision
              and (
                d.escalated_at is not null
                or (d.due_at is not null and d.due_at < now())
              )
         ) then true
    else false
  end;
$$;
comment on function public.l2_may_resolve(text, uuid) is
  'L-2 + #384 pkt 6: firma z katalogu, HHL_ADMIN, albo HHL_OPS po eskalacji/terminie; CLIENT dla KSH_DATE_COUNTER.';
revoke all on function public.l2_may_resolve(text, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- decision_apply_effect — PROPOSE osobno + ACCEPT na KSH_DATE_COUNTER → dates_ctx
-- ---------------------------------------------------------------------------
drop function if exists public.decision_apply_effect(uuid, text, text, text);

create or replace function public.decision_apply_effect(
  p_decision uuid, p_effect text, p_option text, p_note text, p_payload jsonb default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  d decisions%rowtype;
  v_result jsonb := jsonb_build_object('effect', p_effect, 'option', p_option, 'applied', true);
  v_ui text := null;
  v_sid uuid;
  v_field text;
  v_val text;
  v_reason text;
  v_prop jsonb;
  v_ld date;
  v_dd date;
  v_lf timestamptz;
  v_df timestamptz;
  v_counter uuid;
  v_label text;
  v_actor uuid := current_app_user_id();
begin
  select * into d from decisions where id = p_decision;
  if not found then
    return jsonb_build_object('effect', p_effect, 'applied', false, 'error', 'missing');
  end if;

  if d.risk_id is not null then
    update risk_signals
       set resolved_at = coalesce(resolved_at, now())
     where id = d.risk_id and resolved_at is null;
  end if;

  case
    when p_effect = 'PROPOSE' then
      v_prop := coalesce(p_payload, '{}'::jsonb);
      if d.load_id is not null then
        insert into load_events (load_id, event_type, occurred_at, actor_id, payload, dedup_key)
        values (
          d.load_id, 'DECISION_EFFECT', now(), v_actor,
          jsonb_build_object(
            'decision_id', d.id, 'effect', p_effect, 'option', p_option,
            'note', nullif(trim(coalesce(p_note, '')), ''), 'type', d.type_code,
            'proposal', v_prop
          ),
          'dec-fx:' || d.id::text || ':' || p_option
        )
        on conflict (dedup_key) where dedup_key is not null do nothing;
      end if;
      v_counter := public.decision_open_from_event(
        d.project_id,
        'KSH_DATE_COUNTER',
        'ksh-counter:' || d.id::text,
        'Propozycja innego terminu',
        jsonb_build_object(
          'parent_decision_id', d.id,
          'proposal', v_prop,
          'note', nullif(trim(coalesce(p_note, '')), '')
        ),
        d.load_id,
        null
      );
      v_result := v_result || jsonb_build_object('counter_decision_id', v_counter, 'proposal', v_prop);
      v_ui := 'KSH_DATE_COUNTER';

    when p_effect in (
      'ACCEPT','SKIP','DETOUR','MANUAL_STATUS','SEFS_EXTEND','SEFS_LAST',
      'PRICE_CAP3','MANUAL_PRICE','DISPUTE'
    ) then
      -- KSH_DATE_COUNTER + Przyjmuję → daty z propozycji przez dates_ctx (G-20)
      if p_effect = 'ACCEPT' and d.type_code = 'KSH_DATE_COUNTER' and d.load_id is not null then
        v_prop := coalesce(d.detail->'proposal', '{}'::jsonb);
        v_ld := nullif(btrim(coalesce(v_prop->>'load_date', '')), '')::date;
        if v_ld is null then
          return jsonb_build_object('effect', p_effect, 'applied', false, 'error', 'missing_load_date');
        end if;
        v_dd := nullif(btrim(coalesce(v_prop->>'delivery_date', '')), '')::date;
        begin
          v_lf := nullif(btrim(coalesce(v_prop->>'load_from', '')), '')::timestamptz;
        exception when others then
          v_lf := null;
        end;
        begin
          v_df := nullif(btrim(coalesce(v_prop->>'delivery_from', '')), '')::timestamptz;
        exception when others then
          v_df := null;
        end;
        select coalesce(nullif(btrim(u.full_name), ''), split_part(u.email::text, '@', 1), '—')
               || case when current_org_kind() = 'CLIENT' then ' // KSH' else ' // HHL' end
          into v_label
          from app_users u where u.id = v_actor;
        perform set_config('tower.dates_actor', coalesce(v_label, '—'), true);
        perform set_config('tower.dates_ctx', 'on', true);
        update loads set
          plan_load_date = v_ld,
          plan_delivery_date = coalesce(v_dd, plan_delivery_date),
          plan_load_from = coalesce(v_lf, plan_load_from),
          plan_delivery_from = coalesce(v_df, plan_delivery_from),
          plan_dates_status = 'POTWIERDZONA',
          plan_dates_confirmed_by = v_actor,
          plan_dates_confirmed_at = now(),
          updated_at = now()
         where id = d.load_id;
        perform set_config('tower.dates_ctx', '', true);
        perform set_config('tower.dates_actor', '', true);
        insert into load_events (load_id, event_type, occurred_at, actor_id, payload, dedup_key)
        values (
          d.load_id, 'DECISION_EFFECT', now(), v_actor,
          jsonb_build_object(
            'decision_id', d.id, 'effect', p_effect, 'option', p_option,
            'note', nullif(trim(coalesce(p_note, '')), ''), 'type', d.type_code,
            'proposal_applied', v_prop
          ),
          'dec-fx:' || d.id::text || ':' || p_option
        )
        on conflict (dedup_key) where dedup_key is not null do nothing;
        v_result := v_result || jsonb_build_object('dates_applied', true, 'proposal', v_prop);
      elsif d.load_id is not null then
        insert into load_events (load_id, event_type, occurred_at, actor_id, payload, dedup_key)
        values (
          d.load_id, 'DECISION_EFFECT', now(), v_actor,
          jsonb_build_object(
            'decision_id', d.id, 'effect', p_effect, 'option', p_option,
            'note', nullif(trim(coalesce(p_note, '')), ''), 'type', d.type_code
          ),
          'dec-fx:' || d.id::text || ':' || p_option
        )
        on conflict (dedup_key) where dedup_key is not null do nothing;
      end if;

    when p_effect = 'NOTIFY' then
      perform public.matrix_notify(
        'LOAD_STATUS', 'ETA_NOTIFY_KSH', d.load_id, d.project_id,
        jsonb_build_object(
          'decision_id', d.id, 'title', d.title, 'note', p_note,
          'eta', d.detail->'eta', 'type', d.type_code
        ),
        'dec-notify:' || d.id::text, 'CLIENT'
      );

    when p_effect = 'EMAIL_KSH' then
      perform public.matrix_notify(
        'LOAD_STATUS', 'DECISION_EMAIL_KSH', d.load_id, d.project_id,
        jsonb_build_object('decision_id', d.id, 'title', d.title, 'note', p_note, 'type', d.type_code),
        'dec-email-ksh:' || d.id::text, 'CLIENT'
      );

    when p_effect = 'ESCALATE' then
      perform public.matrix_notify(
        'DECISION', 'DECISION_ESCALATED', d.load_id, d.project_id,
        jsonb_build_object('decision_id', d.id, 'title', d.title, 'from_option', p_option, 'note', p_note),
        'dec-esc-opt:' || d.id::text, 'FORWARDER'
      );

    when p_effect = 'HOLD' then
      if d.load_id is not null then
        insert into load_events (load_id, event_type, occurred_at, actor_id, payload, dedup_key)
        values (
          d.load_id, 'DECISION_HOLD', now(), v_actor,
          jsonb_build_object('decision_id', d.id, 'note', p_note, 'option', p_option),
          'dec-hold:' || d.id::text
        )
        on conflict (dedup_key) where dedup_key is not null do nothing;
      end if;
      v_ui := 'HOLD';

    when p_effect = 'CANCEL' then
      if d.load_id is null then
        v_result := v_result || jsonb_build_object('applied', false, 'error', 'no_load');
      elsif (is_hhl()) is not true then
        raise exception 'Anulowanie z decyzji — wyłącznie HHL' using errcode = '42501';
      else
        v_reason := coalesce(nullif(trim(p_note), ''), 'Decyzja: ' || p_option);
        perform cancel_load(d.load_id, v_reason);
      end if;

    when p_effect = 'CHANGE_SAILING' then
      v_sid := nullif(d.detail->>'sailing_id', '')::uuid;
      if d.load_id is null then
        v_result := v_result || jsonb_build_object('applied', false, 'error', 'no_load');
      elsif v_sid is null then
        v_ui := 'PICK_SAILING';
        v_result := v_result || jsonb_build_object('pending', 'sailing_id');
      else
        update loads set sailing_id = v_sid, updated_at = now() where id = d.load_id;
        insert into load_events (load_id, event_type, occurred_at, actor_id, payload, dedup_key)
        values (
          d.load_id, 'DECISION_SAILING', now(), v_actor,
          jsonb_build_object('decision_id', d.id, 'sailing_id', v_sid, 'option', p_option),
          'dec-sail:' || d.id::text
        )
        on conflict (dedup_key) where dedup_key is not null do nothing;
      end if;

    when p_effect = 'KEEP_TOWER' then
      if d.load_id is not null then
        insert into load_events (load_id, event_type, occurred_at, actor_id, payload, dedup_key)
        values (
          d.load_id, 'DECISION_KEEP_TOWER', now(), v_actor,
          jsonb_build_object('decision_id', d.id, 'detail', d.detail),
          'dec-keep:' || d.id::text
        )
        on conflict (dedup_key) where dedup_key is not null do nothing;
      end if;

    when p_effect = 'TAKE_FILE' then
      v_field := d.detail->>'field';
      v_val := d.detail->>'file_value';
      if d.load_id is null or (v_field is not null and v_val is not null) is not true then
        v_ui := 'RESOLVE_CONFLICT';
        v_result := v_result || jsonb_build_object('pending', 'file_value');
      elsif v_field = 'hhl_order_no' then
        update loads set hhl_order_no = v_val, updated_at = now() where id = d.load_id;
      elsif v_field = 'order_no' then
        update loads set order_no = v_val, updated_at = now() where id = d.load_id;
      elsif v_field = 'carrier_order_no' then
        update loads set carrier_order_no = v_val, updated_at = now() where id = d.load_id;
      else
        v_result := v_result || jsonb_build_object('applied', false, 'error', 'unknown_field');
      end if;

    when p_effect = 'OPEN_AWIZACJA' then
      v_ui := 'OPEN_AWIZACJA';
    when p_effect = 'OPEN_DOC' then
      v_ui := 'OPEN_DOC';
    when p_effect = 'ADD_FEE' then
      v_ui := 'ADD_FEE';

    when p_effect = 'BACKUP_RETRY' then
      insert into audit_log (user_id, action, entity, entity_id, new_value)
      values (
        v_actor, 'BACKUP_RETRY_REQUESTED', 'decisions', p_decision::text,
        jsonb_build_object('option', p_option, 'note', p_note)
      );
      v_ui := 'BACKUP_RETRY';
      v_result := v_result || public.request_backup_export();

    else
      v_result := v_result || jsonb_build_object('applied', false, 'error', 'unknown_effect');
  end case;

  if v_ui is not null then
    v_result := v_result || jsonb_build_object('ui_hint', v_ui);
  end if;
  return v_result;
end $$;
revoke all on function public.decision_apply_effect(uuid, text, text, text, jsonb)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- decision_resolve — p_payload + walidacja PROPOSE + l2_may_resolve z decyzją
-- ---------------------------------------------------------------------------
drop function if exists public.decision_resolve(uuid, text, text);

create or replace function public.decision_resolve(
  p_decision uuid,
  p_option text,
  p_note text default null,
  p_payload jsonb default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid; d decisions%rowtype; v_opt jsonb; v_need boolean;
  v_role text;
  v_fx jsonb;
  v_effect text;
begin
  if (current_app_user_id() is not null) is not true then
    raise exception 'Rozstrzygnięcie — tylko wskazana firma albo administrator' using errcode = '42501';
  end if;
  select id into v_me from app_users where id = current_app_user_id() and active;
  select * into d from decisions where id = p_decision for update;
  if not found then raise exception 'Brak decyzji' using errcode = '22023'; end if;
  if (d.status in ('NEW','ASSIGNED','SNOOZED')) is not true then
    raise exception 'Decyzja już zamknięta' using errcode = '22023';
  end if;
  select decider_role into v_role from decision_types where code = d.type_code;
  if (public.l2_may_resolve(v_role, p_decision)) is not true then
    raise exception 'Rozstrzygnięcie — tylko wskazana firma albo administrator' using errcode = '42501';
  end if;
  select o into v_opt
    from decision_types t, jsonb_array_elements(t.options) o
   where t.code = d.type_code and o->>'code' = p_option;
  if v_opt is null then
    raise exception 'Nieznana opcja %', p_option using errcode = '22023';
  end if;
  v_need := coalesce((v_opt->>'requires_comment')::boolean, false);
  if v_need and length(coalesce(nullif(trim(p_note), ''), '')) < 3 then
    raise exception 'Ta opcja wymaga komentarza' using errcode = '22023';
  end if;
  v_effect := coalesce(v_opt->>'effect', 'ACCEPT');
  if v_effect = 'PROPOSE' then
    if nullif(btrim(coalesce(p_payload->>'load_date', '')), '') is null then
      raise exception 'Propozycja wymaga daty załadunku' using errcode = '22023';
    end if;
    begin
      perform (p_payload->>'load_date')::date;
    exception when others then
      raise exception 'Niepoprawna data załadunku' using errcode = '22023';
    end;
  end if;
  if d.type_code = 'DELIVERED_CHECK' then
    return public.delivered_check_apply(d.id, p_option = 'DELIVERED_YES', p_note);
  end if;
  if d.type_code = 'CMR_UPLOAD' and p_option = 'UPLOAD_CMR' then
    v_fx := jsonb_build_object('ui_hint', 'OPEN_DOC', 'applied', false, 'kept_open', true);
    insert into decision_events (decision_id, actor_id, action, payload)
    values (p_decision, v_me, 'HINT',
            jsonb_build_object('option', p_option, 'effect', 'OPEN_DOC', 'note', p_note, 'result', v_fx));
    return v_fx;
  end if;
  update decisions set status = 'RESOLVED', resolved_at = now(), resolved_by = v_me,
    resolution_code = p_option, resolution_note = nullif(trim(p_note), ''),
    snooze_until = null, updated_at = now()
   where id = p_decision;
  v_fx := public.decision_apply_effect(p_decision, v_effect, p_option, p_note, p_payload);
  insert into decision_events (decision_id, actor_id, action, payload)
  values (p_decision, v_me, 'RESOLVE',
          jsonb_build_object(
            'option', p_option, 'effect', v_effect, 'note', p_note,
            'payload', p_payload, 'result', v_fx
          ));
  insert into audit_log (user_id, action, entity, entity_id, new_value)
  values (v_me, 'DECISION_RESOLVE', 'decisions', p_decision::text,
          jsonb_build_object(
            'option', p_option, 'effect', v_effect, 'type', d.type_code,
            'payload', p_payload, 'result', v_fx
          ));
  perform decision_notify(p_decision, 'RESOLVE');
  return v_fx;
end $$;
revoke all on function public.decision_resolve(uuid, text, text, jsonb) from public, anon;
grant execute on function public.decision_resolve(uuid, text, text, jsonb) to authenticated;

-- delivered_check_resolve: l2 z id decyzji (pkt 6 — HHL_OPS po terminie)
create or replace function public.delivered_check_resolve(
  p_load uuid,
  p_yes boolean,
  p_note text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid;
  d_id uuid;
begin
  if (current_app_user_id() is not null) is not true then
    raise exception 'Rozstrzygnięcie — tylko wskazana firma albo administrator' using errcode = '42501';
  end if;
  select id into v_me from app_users where id = current_app_user_id() and active;
  if v_me is null then
    raise exception 'Brak aktywnego konta' using errcode = '42501';
  end if;

  select id into d_id
    from decisions
   where load_id = p_load
     and type_code = 'DELIVERED_CHECK'
     and status in ('NEW', 'ASSIGNED', 'SNOOZED')
   order by created_at desc
   limit 1
   for update;
  if d_id is null then
    raise exception 'Brak otwartej sprawy „czy dostarczono?”' using errcode = '22023';
  end if;
  if (public.l2_may_resolve('CARRIER', d_id)) is not true then
    raise exception 'Rozstrzygnięcie — tylko wskazana firma albo administrator' using errcode = '42501';
  end if;
  return public.delivered_check_apply(d_id, p_yes, p_note);
end $$;
comment on function public.delivered_check_resolve(uuid, boolean, text) is
  'A2/L14 + #384 pkt 6: SCX / HHL_ADMIN / HHL_OPS po eskalacji lub po terminie.';
revoke all on function public.delivered_check_resolve(uuid, boolean, text) from public, anon;
grant execute on function public.delivered_check_resolve(uuid, boolean, text) to authenticated;
