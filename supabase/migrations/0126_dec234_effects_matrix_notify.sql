-- =====================================================================
-- TOWER — Migracja 0126: DEC-2 skutki opcji + DEC-3/4 powiadomienia z macierzy
--
--   1. decision_apply_effect — skutek w systemie po decision_resolve
--      (CANCEL, CHANGE_SAILING, NOTIFY, HOLD, TAKE_FILE, zamknięcie ryzyka, …).
--   2. matrix_notify — wspólny zapis IN_APP/EMAIL wg notification_matrix (DEC-4).
--   3. Wyzwalacze: zmiana statusu transportu, nowe/zmiana ryzyka, wjazd/wyjazd strefy.
--   Idempotentna.
-- =====================================================================

-- ---------- DEC-4 / DEC-3: wspólny helper macierzy ----------
-- p_only_org_kind: NULL = wszystkie firmy z macierzy; inaczej tylko FORWARDER|CARRIER|CLIENT
create or replace function public.matrix_notify(
  p_event_group text,
  p_template text,
  p_load_id uuid,
  p_project_id uuid,
  p_payload jsonb,
  p_dedup_prefix text,
  p_only_org_kind text default null
) returns int
language plpgsql security definer set search_path = public as $$
declare
  n int := 0;
begin
  if (p_event_group in ('LOAD_STATUS','RISK_FERRY_WEATHER','DECISION','MONEY','SYSTEM')) is not true then
    return 0;
  end if;
  if (p_template is not null and length(trim(p_template)) > 0) is not true then
    return 0;
  end if;
  if p_only_org_kind is not null
     and (p_only_org_kind in ('FORWARDER','CARRIER','CLIENT')) is not true then
    return 0;
  end if;

  -- IN_APP według macierzy
  insert into notifications (channel, recipient, user_id, load_id, template, payload, dedup_key)
  select 'IN_APP', coalesce(u.email::text, u.id::text), u.id, p_load_id, p_template,
         coalesce(p_payload, '{}'::jsonb) || jsonb_build_object('locale', u.locale, 'event_group', p_event_group),
         left(p_dedup_prefix || ':IN:' || u.id::text, 200)
    from app_users u
    join organizations o on o.id = u.org_id
    join notification_matrix m
      on m.event_group = p_event_group and m.org_kind = o.kind::text and m.in_app
   where u.active
     and (p_only_org_kind is null or o.kind::text = p_only_org_kind)
     and (
       o.kind = 'FORWARDER'
       or (o.kind = 'CARRIER' and (
            p_load_id is null
            or exists (select 1 from loads l where l.id = p_load_id and l.carrier_org_id = o.id)))
       or (o.kind = 'CLIENT' and (
            p_project_id is null
            or exists (select 1 from projects p where p.id = p_project_id and p.client_org_id = o.id)
            or exists (select 1 from loads l join projects p on p.id = l.project_id
                        where l.id = p_load_id and p.client_org_id = o.id)))
     )
  on conflict (dedup_key) where dedup_key is not null do nothing;
  get diagnostics n = row_count;

  -- EMAIL (kolejka send-notifications) — tylko gdy macierz pozwala
  insert into notifications (channel, recipient, user_id, load_id, template, payload, dedup_key)
  select 'EMAIL', coalesce(u.email::text, u.id::text), u.id, p_load_id, p_template,
         coalesce(p_payload, '{}'::jsonb) || jsonb_build_object('locale', u.locale, 'event_group', p_event_group),
         left(p_dedup_prefix || ':EM:' || u.id::text, 200)
    from app_users u
    join organizations o on o.id = u.org_id
    join notification_matrix m
      on m.event_group = p_event_group and m.org_kind = o.kind::text and m.email
   where u.active and u.email is not null
     and (p_only_org_kind is null or o.kind::text = p_only_org_kind)
     and (
       o.kind = 'FORWARDER'
       or (o.kind = 'CARRIER' and (
            p_load_id is null
            or exists (select 1 from loads l where l.id = p_load_id and l.carrier_org_id = o.id)))
       or (o.kind = 'CLIENT' and (
            p_project_id is null
            or exists (select 1 from projects p where p.id = p_project_id and p.client_org_id = o.id)
            or exists (select 1 from loads l join projects p on p.id = l.project_id
                        where l.id = p_load_id and p.client_org_id = o.id)))
     )
  on conflict (dedup_key) where dedup_key is not null do nothing;

  return n;
end $$;
revoke all on function public.matrix_notify(text, text, uuid, uuid, jsonb, text, text)
  from public, anon, authenticated;

-- Przepisz decision_notify na matrix_notify (KSH gdy macierz DECISION.CLIENT.in_app)
create or replace function public.decision_notify(p_decision uuid, p_event text)
returns int
language plpgsql security definer set search_path = public as $$
declare
  d decisions%rowtype;
  v_role text;
  v_tpl text;
  n int := 0;
  v_dedup text;
begin
  select * into d from decisions where id = p_decision;
  if not found then return 0; end if;
  select decider_role into v_role from decision_types where code = d.type_code;
  v_tpl := case p_event
    when 'OPEN' then 'DECISION_OPEN'
    when 'RESOLVE' then 'DECISION_RESOLVED'
    when 'ESCALATE' then 'DECISION_ESCALATED'
    else 'DECISION_EVENT'
  end;
  v_dedup := 'dec:' || p_event || ':' || d.id::text;

  -- HHL (macierz FORWARDER)
  n := n + public.matrix_notify(
    'DECISION', v_tpl, d.load_id, d.project_id,
    jsonb_build_object(
      'decision_id', d.id, 'type', d.type_code, 'title', d.title,
      'status', d.status, 'event', p_event, 'resolution', d.resolution_code
    ),
    v_dedup, 'FORWARDER'
  );

  -- Przewoźnik gdy decyduje CARRIER
  if v_role = 'CARRIER' then
    n := n + public.matrix_notify(
      'DECISION', v_tpl, d.load_id, d.project_id,
      jsonb_build_object(
        'decision_id', d.id, 'type', d.type_code, 'title', d.title,
        'status', d.status, 'event', p_event, 'resolution', d.resolution_code
      ),
      v_dedup, 'CARRIER'
    );
  end if;

  -- KSH tylko gdy macierz CLIENT.in_app (DEC-4)
  n := n + public.matrix_notify(
    'DECISION', v_tpl, d.load_id, d.project_id,
    jsonb_build_object(
      'decision_id', d.id, 'type', d.type_code, 'title', d.title,
      'status', d.status, 'event', p_event, 'resolution', d.resolution_code
    ),
    v_dedup, 'CLIENT'
  );

  return n;
end $$;
revoke all on function public.decision_notify(uuid, text) from public, anon, authenticated;

-- ---------- DEC-2: skutki opcji ----------
create or replace function public.decision_apply_effect(
  p_decision uuid, p_effect text, p_option text, p_note text
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
begin
  select * into d from decisions where id = p_decision;
  if not found then
    return jsonb_build_object('effect', p_effect, 'applied', false, 'error', 'missing');
  end if;

  -- zamknij powiązane ryzyko (każda rozstrzygnięta decyzja)
  if d.risk_id is not null then
    update risk_signals
       set resolved_at = coalesce(resolved_at, now())
     where id = d.risk_id and resolved_at is null;
  end if;

  case
    when p_effect in (
      'ACCEPT','SKIP','PROPOSE','DETOUR','MANUAL_STATUS','SEFS_EXTEND','SEFS_LAST',
      'PRICE_CAP3','MANUAL_PRICE','DISPUTE'
    ) then
      if d.load_id is not null then
        insert into load_events (load_id, event_type, occurred_at, actor_id, payload, dedup_key)
        values (
          d.load_id, 'DECISION_EFFECT', now(), current_app_user_id(),
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
          d.load_id, 'DECISION_HOLD', now(), current_app_user_id(),
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
          d.load_id, 'DECISION_SAILING', now(), current_app_user_id(),
          jsonb_build_object('decision_id', d.id, 'sailing_id', v_sid, 'option', p_option),
          'dec-sail:' || d.id::text
        )
        on conflict (dedup_key) where dedup_key is not null do nothing;
      end if;

    when p_effect = 'KEEP_TOWER' then
      if d.load_id is not null then
        insert into load_events (load_id, event_type, occurred_at, actor_id, payload, dedup_key)
        values (
          d.load_id, 'DECISION_KEEP_TOWER', now(), current_app_user_id(),
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
        current_app_user_id(), 'BACKUP_RETRY_REQUESTED', 'decisions', p_decision::text,
        jsonb_build_object('option', p_option, 'note', p_note)
      );
      v_ui := 'BACKUP_RETRY';

    else
      v_result := v_result || jsonb_build_object('applied', false, 'error', 'unknown_effect');
  end case;

  if v_ui is not null then
    v_result := v_result || jsonb_build_object('ui_hint', v_ui);
  end if;
  return v_result;
end $$;
revoke all on function public.decision_apply_effect(uuid, text, text, text)
  from public, anon, authenticated;

-- decision_resolve: po zapisie statusu → skutek (zmiana void → jsonb wymaga DROP)
drop function if exists public.decision_resolve(uuid, text, text);
create or replace function decision_resolve(p_decision uuid, p_option text, p_note text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid; d decisions%rowtype; v_opt jsonb; v_need boolean;
  v_fx jsonb;
begin
  if (is_hhl() or current_org_kind() = 'CARRIER') is not true then
    raise exception 'Rozstrzygnięcie — HHL lub przewoźnik' using errcode = '42501';
  end if;
  select id into v_me from app_users where auth_id = auth.uid() and active;
  select * into d from decisions where id = p_decision for update;
  if not found then raise exception 'Brak decyzji' using errcode = '22023'; end if;
  if (d.status in ('NEW','ASSIGNED','SNOOZED')) is not true then
    raise exception 'Decyzja już zamknięta' using errcode = '22023';
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
  update decisions set status = 'RESOLVED', resolved_at = now(), resolved_by = v_me,
    resolution_code = p_option, resolution_note = nullif(trim(p_note), ''),
    snooze_until = null, updated_at = now()
   where id = p_decision;
  v_fx := public.decision_apply_effect(p_decision, coalesce(v_opt->>'effect', 'ACCEPT'), p_option, p_note);
  insert into decision_events (decision_id, actor_id, action, payload)
  values (p_decision, v_me, 'RESOLVE',
          jsonb_build_object('option', p_option, 'effect', v_opt->>'effect', 'note', p_note, 'result', v_fx));
  insert into audit_log (user_id, action, entity, entity_id, new_value)
  values (v_me, 'DECISION_RESOLVE', 'decisions', p_decision::text,
          jsonb_build_object('option', p_option, 'effect', v_opt->>'effect', 'type', d.type_code, 'result', v_fx));
  perform decision_notify(p_decision, 'RESOLVE');
  return v_fx;
end $$;
revoke all on function decision_resolve(uuid, text, text) from public, anon;
grant execute on function decision_resolve(uuid, text, text) to authenticated;

-- ---------- DEC-3: wyzwalacze status / ryzyko / strefa ----------
create or replace function public.trg_load_status_matrix_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_stamp text := to_char(clock_timestamp(), 'YYYYMMDDHH24MI');
begin
  if new.status is not distinct from old.status then
    return null;
  end if;
  perform public.matrix_notify(
    'LOAD_STATUS', 'LOAD_STATUS_CHANGED', new.id, new.project_id,
    jsonb_build_object(
      'load_id', new.id, 'from', old.status, 'to', new.status,
      'order_no', new.order_no, 'hhl_order_no', new.hhl_order_no
    ),
    'load-st:' || new.id::text || ':' || new.status::text || ':' || v_stamp
  );
  return null;
end $$;
revoke all on function public.trg_load_status_matrix_notify() from public, anon, authenticated;

drop trigger if exists trg_loads_status_matrix_notify on loads;
create trigger trg_loads_status_matrix_notify
  after update of status on loads
  for each row execute function public.trg_load_status_matrix_notify();

create or replace function public.trg_risk_matrix_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_group text;
  v_tpl text;
  v_proj uuid;
  v_stamp text;
begin
  -- mapowanie kind → grupa macierzy
  v_group := case
    when new.kind::text in ('FERRY','WEATHER') then 'RISK_FERRY_WEATHER'
    when new.kind::text in ('USAGE_LIMIT','JOB_FAILURE') then 'SYSTEM'
    when new.kind::text in ('INVOICE_MISMATCH') then 'MONEY'
    else 'RISK_FERRY_WEATHER'
  end;
  if tg_op = 'INSERT' then
    v_tpl := 'RISK_OPEN';
  elsif new.severity is distinct from old.severity then
    v_tpl := 'RISK_SEVERITY';
  elsif new.resolved_at is not null and old.resolved_at is null then
    v_tpl := 'RISK_RESOLVED';
  else
    return null;
  end if;
  v_proj := new.project_id;
  if v_proj is null and new.load_id is not null then
    select project_id into v_proj from loads where id = new.load_id;
  end if;
  v_stamp := to_char(clock_timestamp(), 'YYYYMMDDHH24MISSUS');
  perform public.matrix_notify(
    v_group, v_tpl, new.load_id, v_proj,
    jsonb_build_object(
      'risk_id', new.id, 'kind', new.kind, 'severity', new.severity,
      'title', new.title, 'title_key', new.title_key
    ),
    'risk:' || v_tpl || ':' || new.id::text || ':' || v_stamp
  );
  return null;
end $$;
revoke all on function public.trg_risk_matrix_notify() from public, anon, authenticated;

drop trigger if exists trg_risk_matrix_notify on risk_signals;
create trigger trg_risk_matrix_notify
  after insert or update of severity, resolved_at on risk_signals
  for each row execute function public.trg_risk_matrix_notify();

create or replace function public.trg_geofence_matrix_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_proj uuid;
  v_tpl text;
begin
  if new.event_type not in ('GEOFENCE_ENTER', 'GEOFENCE_EXIT') then
    return null;
  end if;
  v_tpl := case new.event_type when 'GEOFENCE_ENTER' then 'ZONE_ENTER' else 'ZONE_EXIT' end;
  select project_id into v_proj from loads where id = new.load_id;
  perform public.matrix_notify(
    'LOAD_STATUS', v_tpl, new.load_id, v_proj,
    jsonb_build_object(
      'load_id', new.load_id, 'event', new.event_type,
      'geofence_id', new.payload->>'geofence_id',
      'geofence_name', coalesce(new.payload->>'geofence_name', new.payload->>'name')
    ),
    'zone:' || new.event_type || ':' || new.load_id::text || ':' || coalesce(new.payload->>'geofence_id', 'x') || ':' || to_char(new.occurred_at, 'YYYYMMDDHH24MI')
  );
  return null;
end $$;
revoke all on function public.trg_geofence_matrix_notify() from public, anon, authenticated;

drop trigger if exists trg_geofence_matrix_notify on load_events;
create trigger trg_geofence_matrix_notify
  after insert on load_events
  for each row execute function public.trg_geofence_matrix_notify();
