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
-- pkt 6: l2_may_resolve — CLIENT (projekt) + HHL_OPS po eskalacji tylko CARRIER/HHL
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
    when p_role = 'CLIENT'
         and current_org_kind() = 'CLIENT'
         and p_decision is not null
         and exists (
           select 1
             from decisions d
             join projects p on p.id = d.project_id
            where d.id = p_decision
              and p.client_org_id = current_org_id()
         ) then true
    -- F7 #389: po terminie/eskalacji tylko sprawy CARRIER albo HHL (bez ADMIN / CLIENT)
    when current_app_role() = 'HHL_OPS'
         and p_role in ('CARRIER', 'HHL')
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
  'L-2 + #384 pkt 6 / F7 #389: CLIENT tylko własny projekt; HHL_OPS po terminie wyłącznie CARRIER/HHL.';
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
  l loads%rowtype;
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
  v_lt timestamptz;
  v_df timestamptz;
  v_dt timestamptz;
  v_counter uuid;
  v_label text;
  v_actor uuid := current_app_user_id();
  v_parent uuid;
  v_has_lf boolean;
  v_has_df boolean;
  v_delta integer;
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
      -- p_payload już oczyszczony w decision_resolve (4 klucze)
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
      -- F7 #389: KSH_DATE_COUNTER + Przyjmuję → ta sama ścieżka co ksh_confirm_dates
      if p_effect = 'ACCEPT' and d.type_code = 'KSH_DATE_COUNTER' and d.load_id is not null then
        v_prop := coalesce(d.detail->'proposal', '{}'::jsonb);
        v_ld := nullif(btrim(coalesce(v_prop->>'load_date', '')), '')::date;
        if v_ld is null then
          raise exception 'Propozycja bez daty załadunku' using errcode = '22023';
        end if;
        select * into l from loads where id = d.load_id for update;
        if not found then
          raise exception 'Transport nie istnieje' using errcode = '42501';
        end if;
        v_dd := nullif(btrim(coalesce(v_prop->>'delivery_date', '')), '')::date;
        -- Samej load_date: przesuń dostawę o różnicę dni (inaczej v_dd < v_ld → wyjątek w ksh_confirm_dates).
        if v_dd is null and l.plan_load_date is not null and v_ld is distinct from l.plan_load_date
           and l.plan_delivery_date is not null then
          v_delta := v_ld - l.plan_load_date;
          v_dd := l.plan_delivery_date + v_delta;
        end if;
        v_dd := coalesce(v_dd, l.plan_delivery_date, v_ld);
        v_has_lf := nullif(btrim(coalesce(v_prop->>'load_from', '')), '') is not null;
        v_has_df := nullif(btrim(coalesce(v_prop->>'delivery_from', '')), '') is not null;
        if v_has_lf then
          begin
            v_lf := (v_prop->>'load_from')::timestamptz;
          exception when others then
            raise exception 'Niepoprawna godzina załadunku' using errcode = '22023';
          end;
          v_lt := l.plan_load_to;
          if v_lt is not null and l.plan_load_from is not null then
            v_lt := v_lt + (v_lf - l.plan_load_from);
          end if;
        elsif l.plan_load_from is not null and l.plan_load_date is not null
              and v_ld is distinct from l.plan_load_date then
          -- F7: przy samej load_date przesuń od/do o różnicę dni (jak okno 4a)
          v_lf := l.plan_load_from + make_interval(days => (
            v_ld - (l.plan_load_from at time zone 'Europe/Warsaw')::date));
          v_lt := case when l.plan_load_to is not null then
            l.plan_load_to + make_interval(days => (
              v_ld - (l.plan_load_to at time zone 'Europe/Warsaw')::date))
          else null end;
        else
          v_lf := l.plan_load_from;
          v_lt := l.plan_load_to;
        end if;
        if v_has_df then
          begin
            v_df := (v_prop->>'delivery_from')::timestamptz;
          exception when others then
            raise exception 'Niepoprawna godzina dostawy' using errcode = '22023';
          end;
          v_dt := l.plan_delivery_to;
          if v_dt is not null and l.plan_delivery_from is not null then
            v_dt := v_dt + (v_df - l.plan_delivery_from);
          end if;
        elsif l.plan_delivery_from is not null and l.plan_delivery_date is not null
              and v_dd is distinct from l.plan_delivery_date then
          v_df := l.plan_delivery_from + make_interval(days => (
            v_dd - (l.plan_delivery_from at time zone 'Europe/Stockholm')::date));
          v_dt := case when l.plan_delivery_to is not null then
            l.plan_delivery_to + make_interval(days => (
              v_dd - (l.plan_delivery_to at time zone 'Europe/Stockholm')::date))
          else null end;
        else
          v_df := l.plan_delivery_from;
          v_dt := l.plan_delivery_to;
        end if;
        -- bez LATE_DATE_CHANGE przy uzgodnionej propozycji
        perform set_config('tower.counter_accept', 'on', true);
        begin
          perform public.ksh_confirm_dates(d.load_id, v_ld, v_dd, v_lf, v_lt, v_df, v_dt);
        exception when others then
          perform set_config('tower.counter_accept', '', true);
          raise;
        end;
        perform set_config('tower.counter_accept', '', true);
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
      -- F7: wynik licznika → przewoźnik transportu (nie resolved_by; HHL po terminie nie dostaje)
      if d.type_code = 'KSH_DATE_COUNTER' and p_effect in ('ACCEPT', 'SKIP') and d.load_id is not null then
        v_parent := nullif(btrim(coalesce(d.detail->>'parent_decision_id', '')), '')::uuid;
        insert into notifications (channel, recipient, user_id, load_id, template, payload, dedup_key)
        select 'IN_APP', coalesce(u.email::text, u.id::text), u.id, d.load_id,
               'KSH_DATE_COUNTER_RESULT',
               jsonb_build_object(
                 'decision_id', d.id, 'parent_decision_id', v_parent,
                 'option', p_option, 'effect', p_effect,
                 'title', case when p_effect = 'ACCEPT'
                           then 'KSH przyjęła propozycję terminu'
                           else 'KSH odrzuciła propozycję terminu' end,
                 'locale', u.locale
               ),
               'ksh-counter-res:' || d.id::text || ':' || p_option || ':' || u.id::text
          from app_users u
          join loads ld on ld.id = d.load_id
         where ld.carrier_org_id is not null
           and u.org_id = ld.carrier_org_id
           and u.role in ('CARRIER_DISPATCH', 'CARRIER_USER')
           and u.active
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
    declare
      v_ld date;
      v_dd date;
      v_lf timestamptz;
      v_df timestamptz;
      v_today date := (now() at time zone 'Europe/Warsaw')::date;
    begin
      if nullif(btrim(coalesce(p_payload->>'load_date', '')), '') is null then
        raise exception 'Propozycja wymaga daty załadunku' using errcode = '22023';
      end if;
      begin
        v_ld := (p_payload->>'load_date')::date;
      exception when others then
        raise exception 'Niepoprawna data załadunku' using errcode = '22023';
      end;
      if (v_ld > v_today) is not true then
        raise exception 'Data załadunku musi być w przyszłości' using errcode = '22023';
      end if;
      if nullif(btrim(coalesce(p_payload->>'delivery_date', '')), '') is not null then
        begin
          v_dd := (p_payload->>'delivery_date')::date;
        exception when others then
          raise exception 'Niepoprawna data dostawy' using errcode = '22023';
        end;
        if (v_dd >= v_ld) is not true then
          raise exception 'Data dostawy przed datą załadunku' using errcode = '22023';
        end if;
      end if;
      if nullif(btrim(coalesce(p_payload->>'load_from', '')), '') is not null then
        begin
          v_lf := (p_payload->>'load_from')::timestamptz;
        exception when others then
          raise exception 'Niepoprawna godzina załadunku' using errcode = '22023';
        end;
      end if;
      if nullif(btrim(coalesce(p_payload->>'delivery_from', '')), '') is not null then
        begin
          v_df := (p_payload->>'delivery_from')::timestamptz;
        exception when others then
          raise exception 'Niepoprawna godzina dostawy' using errcode = '22023';
        end;
      end if;
      if v_lf is not null and v_df is not null and (v_df >= v_lf) is not true then
        raise exception 'Rozładunek przed załadunkiem' using errcode = '22023';
      end if;
      -- F7: zapis tylko 4 dozwolonych kluczy
      p_payload := jsonb_strip_nulls(jsonb_build_object(
        'load_date', to_char(v_ld, 'YYYY-MM-DD'),
        'delivery_date', case when v_dd is not null then to_char(v_dd, 'YYYY-MM-DD') else null end,
        'load_from', case when v_lf is not null then v_lf else null end,
        'delivery_from', case when v_df is not null then v_df else null end
      ));
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

  -- F7 #389: najpierw l2_may_resolve, potem „brak sprawy” (KSH/OPS → 42501, nie wyciek istnienia).
  select id into d_id
    from decisions
   where load_id = p_load
     and type_code = 'DELIVERED_CHECK'
     and status in ('NEW', 'ASSIGNED', 'SNOOZED')
   order by created_at desc
   limit 1
   for update;
  if (public.l2_may_resolve('CARRIER', d_id)) is not true then
    raise exception 'Rozstrzygnięcie — tylko wskazana firma albo administrator' using errcode = '42501';
  end if;
  if d_id is null then
    raise exception 'Brak otwartej sprawy „czy dostarczono?”' using errcode = '22023';
  end if;
  return public.delivered_check_apply(d_id, p_yes, p_note);
end $$;
comment on function public.delivered_check_resolve(uuid, boolean, text) is
  'A2/L14 + #384 pkt 6 / F7 #389: najpierw uprawnienie, potem brak sprawy; HHL_OPS po eskalacji/terminie.';
revoke all on function public.delivered_check_resolve(uuid, boolean, text) from public, anon;
grant execute on function public.delivered_check_resolve(uuid, boolean, text) to authenticated;

-- ---------------------------------------------------------------------------
-- F7 #389: ksh_confirm_dates — wejście z ACCEPT licznika (tower.counter_accept)
-- ---------------------------------------------------------------------------
create or replace function public.ksh_confirm_dates(
  p_load uuid,
  p_load_date date default null,
  p_delivery_date date default null,
  p_load_from timestamptz default null,
  p_load_to timestamptz default null,
  p_delivery_from timestamptz default null,
  p_delivery_to timestamptz default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  l loads%rowtype;
  v_client uuid;
  v_ld date; v_dd date;
  v_lf timestamptz; v_lt timestamptz; v_df timestamptz; v_dt timestamptz;
  v_changed boolean;
  v_actor uuid := current_app_user_id();
  v_label text;
  v_code text;
  v_awiz boolean;
  v_stamp text := to_char(clock_timestamp(), 'YYYYMMDDHH24MISSUS');
  v_payload jsonb;
  v_admin boolean := (current_app_role() = 'HHL_ADMIN');
  v_from_counter boolean := (current_setting('tower.counter_accept', true) = 'on');
  v_dates_odd boolean := false;
  v_by text;
begin
  if (v_actor is not null) is not true then
    raise exception 'Brak aktywnego konta' using errcode = '42501';
  end if;
  if v_from_counter is not true then
    -- G-20: CLIENT_USER albo Administrator HHL (D-20261019-0005-01)
    if (v_admin or current_app_role() = 'CLIENT_USER') is not true then
      raise exception 'Daty i godziny zmienia wyłącznie KSH Użytkownik' using errcode = '42501';
    end if;
    if v_admin is not true then
      if (current_org_kind() = 'CLIENT') is not true then
        raise exception 'Daty i godziny w tym oknie zmienia wyłącznie KSH (zamawiający)' using errcode = '42501';
      end if;
    end if;
  end if;
  if p_load is null then raise exception 'Brak transportu' using errcode = '22023'; end if;
  select * into l from loads where id = p_load for update;
  if not found then raise exception 'Transport nie istnieje' using errcode = '42501'; end if;
  select client_org_id into v_client from projects where id = l.project_id;
  if v_from_counter is not true then
    if v_admin is not true and (v_client = current_org_id()) is not true then
      raise exception 'Daty i godziny w tym oknie zmienia wyłącznie KSH (zamawiający)' using errcode = '42501';
    end if;
    if v_admin is not true
       and (l.status in ('PLANNED','RESOURCES_PENDING','DOCS_PENDING','READY')) is not true then
      raise exception 'Po wjeździe na załadunek (albo po anulowaniu) daty planu nie zmienia się w tym oknie' using errcode = '42501';
    end if;
  elsif current_app_role() = 'CLIENT_USER' then
    if (v_client = current_org_id()) is not true then
      raise exception 'Daty i godziny w tym oknie zmienia wyłącznie KSH (zamawiający)' using errcode = '42501';
    end if;
    if (l.status in ('PLANNED','RESOURCES_PENDING','DOCS_PENDING','READY')) is not true then
      raise exception 'Po wjeździe na załadunek (albo po anulowaniu) daty planu nie zmienia się w tym oknie' using errcode = '42501';
    end if;
  end if;
  v_ld := coalesce(p_load_date, (p_load_from at time zone 'Europe/Warsaw')::date, l.plan_load_date);
  v_dd := coalesce(p_delivery_date, (p_delivery_from at time zone 'Europe/Stockholm')::date, l.plan_delivery_date);
  v_lf := coalesce(p_load_from, l.plan_load_from);
  v_lt := coalesce(p_load_to, l.plan_load_to);
  v_df := coalesce(p_delivery_from, l.plan_delivery_from);
  v_dt := coalesce(p_delivery_to, l.plan_delivery_to);
  if (v_ld is not null and v_dd is not null) is not true then
    raise exception 'Brak daty załadunku albo rozładunku' using errcode = '22023';
  end if;
  if (v_dd >= v_ld) is not true
     or (v_lf <= v_lt) is false
     or (v_df <= v_dt) is false
     or (v_df >= v_lf) is false then
    v_dates_odd := true;
  end if;
  if v_dates_odd and v_admin is not true then
    if (v_dd >= v_ld) is not true then
      raise exception 'Data rozładunku przed datą załadunku' using errcode = '22023';
    end if;
    if (v_lf <= v_lt) is false or (v_df <= v_dt) is false then
      raise exception 'Początek okna po jego końcu' using errcode = '22023';
    end if;
    if (v_df >= v_lf) is false then
      raise exception 'Rozładunek przed załadunkiem' using errcode = '22023';
    end if;
  end if;
  v_changed := (v_ld, v_dd, v_lf, v_lt, v_df, v_dt)
               is distinct from (l.plan_load_date, l.plan_delivery_date, l.plan_load_from, l.plan_load_to, l.plan_delivery_from, l.plan_delivery_to);
  if v_changed is not true then
    return jsonb_build_object('changed', false);
  end if;

  v_by := case
    when v_admin then 'HHL_ADMIN'
    else 'KSH'
  end;
  if v_by = 'HHL_ADMIN' then
    select coalesce(nullif(btrim(u.full_name), ''), split_part(u.email::text, '@', 1), '—') || ' // HHL'
      into v_label from app_users u where u.id = v_actor;
  else
    select coalesce(nullif(btrim(u.full_name), ''), split_part(u.email::text, '@', 1), '—') || ' // KSH'
      into v_label from app_users u where u.id = v_actor;
  end if;
  perform set_config('tower.dates_actor', v_label, true);
  perform set_config('tower.dates_ctx', 'on', true);
  update loads set plan_load_date = v_ld, plan_delivery_date = v_dd,
         plan_load_from = v_lf, plan_load_to = v_lt, plan_delivery_from = v_df, plan_delivery_to = v_dt,
         plan_dates_status = 'POTWIERDZONA', plan_dates_confirmed_by = v_actor, plan_dates_confirmed_at = now(),
         updated_at = now()
   where id = p_load;
  perform set_config('tower.dates_ctx', '', true);
  perform set_config('tower.dates_actor', '', true);

  v_code := public.load_sms_code(p_load);
  v_payload := jsonb_build_object(
    'code', v_code, 'by', v_by, 'status', 'POTWIERDZONA',
    'load_date', v_ld, 'delivery_date', v_dd,
    'before_load_date', l.plan_load_date, 'before_delivery_date', l.plan_delivery_date,
    'before_load_from', l.plan_load_from, 'before_load_to', l.plan_load_to,
    'before_delivery_from', l.plan_delivery_from, 'before_delivery_to', l.plan_delivery_to);
  perform matrix_notify('LOAD_STATUS', 'PLAN_DATES_CHANGED', p_load, l.project_id, v_payload,
                        'PLAN_DATES:' || p_load || ':' || v_stamp);
  delete from notifications
   where user_id = v_actor and load_id = p_load and dedup_key like 'PLAN_DATES:' || p_load || ':' || v_stamp || ':%';
  if v_by = 'HHL_ADMIN' then
    delete from notifications n
     using app_users u, organizations o
     where n.user_id = u.id and u.org_id = o.id and o.kind = 'CLIENT'
       and n.load_id = p_load
       and n.dedup_key like 'PLAN_DATES:' || p_load || ':' || v_stamp || ':%';
  end if;

  if v_dates_odd and v_by = 'KSH' then
    perform decision_open_from_event(
      l.project_id,
      'KSH_DATES_CHECK',
      'ksh-dates:' || p_load::text || ':' || v_stamp,
      public.l3_headed(v_code, 'daty KSH do sprawdzenia'),
      jsonb_build_object(
        'rule', 'D_0005', 'code', v_code,
        'load_date', v_ld, 'delivery_date', v_dd,
        'by', v_by
      ),
      p_load,
      null
    );
  end if;

  v_awiz := l.status = 'READY' or l.sailing_id is not null
            or nullif(btrim(l.ferry_booking_ref), '') is not null
            or (nullif(btrim(l.driver_name), '') is not null and nullif(btrim(l.tractor_plate), '') is not null);
  if v_awiz and (v_ld, v_dd, v_lf, v_df) is distinct from (l.plan_load_date, l.plan_delivery_date, l.plan_load_from, l.plan_delivery_from) then
    insert into load_events (load_id, event_type, occurred_at, actor_id, payload)
    values (p_load, 'SCHEDULE_DATE_CRITICAL', now(), v_actor,
            jsonb_build_object('code', v_code, 'by', v_by, 'actor', v_label,
                               'fields', to_jsonb(array['load_date','delivery_date']),
                               'before', jsonb_build_object('load_date', l.plan_load_date, 'delivery_date', l.plan_delivery_date),
                               'after', jsonb_build_object('load_date', v_ld, 'delivery_date', v_dd)));
    insert into notifications (channel, recipient, user_id, load_id, template, payload, dedup_key)
    select 'IN_APP', coalesce(u.email::text, u.id::text), u.id, p_load, 'SCHEDULE_DATE_CRITICAL',
           jsonb_build_object('code', v_code, 'fields', to_jsonb(array['load_date','delivery_date']),
                              'load_date', v_ld, 'delivery_date', v_dd, 'locale', u.locale),
           'SCHED_CRIT:KSH:' || p_load || ':' || v_stamp || ':' || u.id
      from app_users u join organizations o on o.id = u.org_id
     where u.active and (o.kind = 'FORWARDER' or (l.carrier_org_id is not null and u.org_id = l.carrier_org_id))
    on conflict (dedup_key) where dedup_key is not null do nothing;
  end if;

  return jsonb_build_object('changed', true, 'awizowany', v_awiz, 'load_date', v_ld, 'delivery_date', v_dd,
                            'dates_check', v_dates_odd);
end $$;

revoke all on function public.ksh_confirm_dates(uuid, date, date, timestamptz, timestamptz, timestamptz, timestamptz) from public, anon;
grant execute on function public.ksh_confirm_dates(uuid, date, date, timestamptz, timestamptz, timestamptz, timestamptz) to authenticated;
comment on function public.ksh_confirm_dates(uuid, date, date, timestamptz, timestamptz, timestamptz, timestamptz) is
  'G-20 + D-0005 + D-0930 + F7 #389: counter_accept omija kontrolę roli (już w decision_resolve).';

-- F7: ACCEPT licznika nie otwiera LATE_DATE_CHANGE
create or replace function public.trg_plan_dates_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := current_app_user_id();
  v_by text;
  v_payload jsonb;
  v_client uuid;
  v_stamp text := to_char(clock_timestamp(), 'YYYYMMDDHH24MISSUS');
  v_code text := public.load_sms_code(new.id);
begin
  if current_setting('tower.bulk_quiet', true) = 'on' then
    return null;
  end if;
  if (new.plan_load_date, new.plan_load_from, new.plan_load_to, new.plan_delivery_date, new.plan_delivery_from, new.plan_delivery_to)
     is not distinct from (old.plan_load_date, old.plan_load_from, old.plan_load_to, old.plan_delivery_date, old.plan_delivery_from, old.plan_delivery_to) then
    return null;
  end if;
  v_by := case
    when current_setting('tower.dates_ctx', true) = 'on'
      and current_app_role() = 'HHL_ADMIN' then 'HHL_ADMIN'
    when current_setting('tower.dates_ctx', true) = 'on' then 'KSH'
    when auth.uid() is null then 'SYSTEM'
    else 'HHL'
  end;
  select client_org_id into v_client from projects where id = new.project_id;
  insert into load_events (load_id, event_type, occurred_at, actor_id, payload)
  values (new.id, 'PLAN_DATES_CHANGED', now(), v_actor, jsonb_build_object(
    'code', v_code, 'by', v_by, 'status', new.plan_dates_status,
    'load_date', new.plan_load_date, 'delivery_date', new.plan_delivery_date,
    'before_load_date', old.plan_load_date, 'before_delivery_date', old.plan_delivery_date,
    'before_load_from', old.plan_load_from, 'before_load_to', old.plan_load_to,
    'before_delivery_from', old.plan_delivery_from, 'before_delivery_to', old.plan_delivery_to,
    'load_from', new.plan_load_from, 'load_to', new.plan_load_to,
    'delivery_from', new.plan_delivery_from, 'delivery_to', new.plan_delivery_to)
    || case when v_by in ('KSH', 'HHL_ADMIN') and nullif(current_setting('tower.dates_actor', true), '') is not null
            then jsonb_build_object('actor', current_setting('tower.dates_actor', true)) else '{}'::jsonb end);
  v_payload := jsonb_build_object(
    'code', v_code, 'by', v_by, 'status', new.plan_dates_status,
    'load_date', new.plan_load_date, 'delivery_date', new.plan_delivery_date,
    'before_load_date', old.plan_load_date, 'before_delivery_date', old.plan_delivery_date,
    'before_load_from', old.plan_load_from, 'before_load_to', old.plan_load_to,
    'before_delivery_from', old.plan_delivery_from, 'before_delivery_to', old.plan_delivery_to);
  if v_by not in ('KSH', 'HHL_ADMIN') then
    insert into notifications (channel, recipient, user_id, load_id, template, payload, dedup_key)
    select 'IN_APP', coalesce(u.email::text, u.id::text), u.id, new.id, 'PLAN_DATES_CHANGED',
           v_payload || jsonb_build_object('locale', u.locale),
           'PLAN_DATES:' || new.id || ':' || v_stamp || ':' || u.id
      from app_users u join organizations o on o.id = u.org_id
     where u.active and u.id is distinct from v_actor
       and (o.kind = 'FORWARDER'
            or (new.carrier_org_id is not null and u.org_id = new.carrier_org_id)
            or (v_client is not null and u.org_id = v_client))
    on conflict (dedup_key) where dedup_key is not null do nothing;
  end if;
  if current_setting('tower.counter_accept', true) is distinct from 'on'
     and ((new.plan_load_date, new.plan_load_from) is distinct from (old.plan_load_date, old.plan_load_from)
          or old.plan_load_date is null) then
    perform l3_ksh_lead(new, old.plan_load_date, old.plan_load_from, now());
  end if;
  return null;
end $$;
revoke all on function public.trg_plan_dates_notify() from public, anon, authenticated;
