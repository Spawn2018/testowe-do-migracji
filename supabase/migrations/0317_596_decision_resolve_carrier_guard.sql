-- =====================================================================
-- TOWER — Migracja 0317: #596 strażnik decision_resolve dla KSH_CARRIER_CHANGED
-- Po 0316 (BN0). Przed P4-k #581 (tam 0317→0318 po rebase).
--
-- Problem: decision_types.options ma efekty CARRIER_CANCEL/CARRIER_REMOVE;
-- ogólne decision_resolve zamyka decyzję i woła decision_apply_effect, które
-- tych efektów nie obsługuje → RESOLVED bez zmiany transportu.
--
-- Rozwiązanie: przekazanie do decision_resolve_carrier_change + wyjątek
-- w decision_apply_effect dla CARRIER_* (bezpiecznik).
-- =====================================================================

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
  v_actor_label text;
  v_decider text;
  v_by_org text;
  v_vis org_kind[];
  v_base jsonb;
begin
  select * into d from decisions where id = p_decision;
  if not found then
    return jsonb_build_object('effect', p_effect, 'applied', false, 'error', 'missing');
  end if;

  -- #384 pkt 8: aktor w payload DECISION_* (jak daty 0235).
  -- decider = decision_types.decider_role (CLIENT|CARRIER|HHL|ADMIN);
  -- by_org = current_org_kind (CLIENT|CARRIER|FORWARDER|…|SYSTEM) — kto kliknął (dwa słowniki celowo).
  -- visible_to NULL = wszyscy w projekcie (w tym KSH); decyzja właściciela 20.10 / F7 r2–r3.
  select t.decider_role into v_decider from decision_types t where t.code = d.type_code;
  v_by_org := coalesce(current_org_kind()::text, 'SYSTEM');
  select coalesce(nullif(btrim(u.full_name), ''), split_part(u.email::text, '@', 1), '—')
         || ' // ' || case coalesce(o.kind::text, v_by_org)
              when 'CARRIER' then 'SCX'
              when 'CLIENT' then 'KSH'
              when 'FORWARDER' then 'HHL'
              else coalesce(o.kind::text, v_by_org)
            end
    into v_actor_label
    from app_users u
    left join organizations o on o.id = u.org_id
   where u.id = v_actor;
  v_actor_label := coalesce(v_actor_label, 'system');
  v_vis := null;
  v_base := jsonb_build_object(
    'actor', v_actor_label,
    'decider', v_decider,
    'by_org', v_by_org
  );
  -- „Działaj jako”: prawdziwy wykonawca w payload (historia)
  if real_app_user_id() is not null and real_app_user_id() is distinct from v_actor then
    v_base := v_base || jsonb_build_object('real_app_user_id', real_app_user_id());
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
        insert into load_events (load_id, event_type, occurred_at, actor_id, payload, visible_to, dedup_key)
        values (
          d.load_id, 'DECISION_EFFECT', now(), v_actor,
          v_base || jsonb_build_object(
            'decision_id', d.id, 'effect', p_effect, 'option', p_option,
            'note', nullif(trim(coalesce(p_note, '')), ''), 'type', d.type_code,
            'proposal', v_prop
          ),
          v_vis,
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
          -- F7: wspólna delta względem plan_load_date (od i do razem); strażnik do > od
          v_delta := v_ld - l.plan_load_date;
          v_lf := l.plan_load_from + make_interval(days => v_delta);
          v_lt := case when l.plan_load_to is not null then
            l.plan_load_to + make_interval(days => v_delta)
          else null end;
          if v_lt is not null and v_lf is not null and v_lt <= v_lf then
            v_lt := null;
          end if;
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
          v_delta := v_dd - l.plan_delivery_date;
          v_df := l.plan_delivery_from + make_interval(days => v_delta);
          v_dt := case when l.plan_delivery_to is not null then
            l.plan_delivery_to + make_interval(days => v_delta)
          else null end;
          if v_dt is not null and v_df is not null and v_dt <= v_df then
            v_df := null;
          end if;
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
        insert into load_events (load_id, event_type, occurred_at, actor_id, payload, visible_to, dedup_key)
        values (
          d.load_id, 'DECISION_EFFECT', now(), v_actor,
          v_base || jsonb_build_object(
            'decision_id', d.id, 'effect', p_effect, 'option', p_option,
            'note', nullif(trim(coalesce(p_note, '')), ''), 'type', d.type_code,
            'proposal_applied', v_prop
          ),
          v_vis,
          'dec-fx:' || d.id::text || ':' || p_option
        )
        on conflict (dedup_key) where dedup_key is not null do nothing;
        v_result := v_result || jsonb_build_object('dates_applied', true, 'proposal', v_prop);
      elsif d.load_id is not null then
        insert into load_events (load_id, event_type, occurred_at, actor_id, payload, visible_to, dedup_key)
        values (
          d.load_id, 'DECISION_EFFECT', now(), v_actor,
          v_base || jsonb_build_object(
            'decision_id', d.id, 'effect', p_effect, 'option', p_option,
            'note', nullif(trim(coalesce(p_note, '')), ''), 'type', d.type_code
          ),
          v_vis,
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
        insert into load_events (load_id, event_type, occurred_at, actor_id, payload, visible_to, dedup_key)
        values (
          d.load_id, 'DECISION_HOLD', now(), v_actor,
          v_base || jsonb_build_object('decision_id', d.id, 'note', p_note, 'option', p_option),
          v_vis,
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
        insert into load_events (load_id, event_type, occurred_at, actor_id, payload, visible_to, dedup_key)
        values (
          d.load_id, 'DECISION_SAILING', now(), v_actor,
          v_base || jsonb_build_object('decision_id', d.id, 'sailing_id', v_sid, 'option', p_option),
          v_vis,
          'dec-sail:' || d.id::text
        )
        on conflict (dedup_key) where dedup_key is not null do nothing;
      end if;

    when p_effect = 'KEEP_TOWER' then
      if d.load_id is not null then
        insert into load_events (load_id, event_type, occurred_at, actor_id, payload, visible_to, dedup_key)
        values (
          d.load_id, 'DECISION_KEEP_TOWER', now(), v_actor,
          v_base || jsonb_build_object('decision_id', d.id, 'detail', d.detail),
          v_vis,
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

    when p_effect in ('CARRIER_CANCEL', 'CARRIER_REMOVE') then
      -- #596: efekty zmiany przewoźnika tylko przez decision_resolve_carrier_change
      raise exception 'Ta decyzja ma własne rozstrzygnięcie'
        using errcode = '22023';

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

comment on function public.decision_apply_effect(uuid, text, text, text, jsonb) is
  '#384 pkt 8 + #596: DECISION_* z actor/decider/by_org; CARRIER_CANCEL/REMOVE → wyjątek (własne rozstrzygnięcie).';

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
  -- #596: jedna ścieżka — ogólne resolve nie zamyka bez skutku CARRIER_*
  if d.type_code = 'KSH_CARRIER_CHANGED' then
    return public.decision_resolve_carrier_change(p_decision, upper(btrim(p_option)));
  end if;
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

comment on function public.decision_resolve(uuid, text, text, jsonb) is
  '#384 + #596: KSH_CARRIER_CHANGED → decision_resolve_carrier_change (jedna ścieżka ze skutkiem).';
