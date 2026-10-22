-- HOTFIX #384 zaległe / D-20261022-0130-01 (#425): pkt 7–8 + okno importu + dane SG.
-- Migracja 0267 (po #446: 0262–0266 zajęte; wcześniej 0261/0262). SMS×bulk_quiet już w 0259.
-- 1) decisions_read: CARRIER tylko własne transporty (carrier_org_id); load_id null → po projekcie
-- 2) decision_apply_effect: actor/decider/by_org; visible_to NULL (wszyscy w projekcie, w tym KSH)
-- 3) import_schedule: zmiana daty bez godziny → przesuń okno; pusta godzina = bez zmiany
-- 4) jednorazowo: plan_load_to / plan_delivery_from SG-01/02/T-01 z historii PLAN_DATES_CHANGED

-- ---------------------------------------------------------------------------
-- 1) RLS decisions_read — przewoźnik tylko swoje load_id
-- ---------------------------------------------------------------------------
drop policy if exists decisions_read on public.decisions;
create policy decisions_read on public.decisions for select to authenticated using (
  current_app_user_id() is not null
  and (
    is_hhl()
    or (current_org_kind() = 'CARRIER' and exists (
          select 1 from decision_types t
           where t.code = decisions.type_code
             and t.decider_role in ('CARRIER', 'HHL')
             and (
               -- F7 drobne: decyzje bez load_id — tylko gdy przewoźnik ma transport w projekcie
               (decisions.load_id is null
                and exists (
                  select 1 from loads l
                   where l.project_id = decisions.project_id
                     and l.carrier_org_id = current_org_id()))
               or exists (
                 select 1 from loads l
                  where l.id = decisions.load_id
                    and l.carrier_org_id = current_org_id()))))
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
-- 2) decision_apply_effect — aktor w DECISION_*
-- ---------------------------------------------------------------------------
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
  '#384 pkt 8: DECISION_* z actor/decider/by_org (decider=rola z katalogu, by_org=org_kind klikającego); visible_to NULL = wszyscy w projekcie; przy „Działaj jako” real_app_user_id w payload.';

-- ---------------------------------------------------------------------------
-- 3) import_schedule — przesunięcie okna przy zmianie daty bez godziny
-- ---------------------------------------------------------------------------
create or replace FUNCTION public.import_schedule(p_project uuid, p_rows jsonb, p_cancel_codes text[] DEFAULT '{}'::text[], p_file jsonb DEFAULT '{}'::jsonb, p_dry_run boolean DEFAULT true, p_quiet boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  t0          timestamptz := clock_timestamp();
  v_user      uuid;
  v_carrier   uuid;
  v_carrier_n text;
  v_import    uuid;
  v_version   int;
  v_n         int;
  r           record;
  c           record;
  v_load      uuid;
  v_fields    text[];
  v_crit      text[];
  v_added     jsonb := '[]';
  v_changed   jsonb := '[]';
  v_unchanged int := 0;
  v_cands     jsonb := '[]';
  v_blocked   jsonb := '[]';
  v_cancelled jsonb := '[]';
  v_critical  jsonb := '[]';
  v_confirmed jsonb := '[]';
  v_keep      boolean;
  v_over      text[];
  v_skipped   int := 0;
  v_quiet_on  boolean := false;
  v_quiet_fill boolean := false;
  v_prev_quiet text;
  v_historic boolean := false;
  v_cmap jsonb := '{}'::jsonb;
  v_has_hhl_col boolean := false;
  v_run_quiet boolean := false;
  v_prev_run_quiet text;
  v_new_load_date date;
  v_new_del_date date;
  v_new_load_from timestamptz;
  v_new_load_to timestamptz;
  v_new_del_from timestamptz;
  v_new_del_to timestamptz;
  v_today date := (now() at time zone 'Europe/Warsaw')::date;
  v_fnames    text[] := array['item_type','cargo_class','length_m','width_m','height_m','unit_weight_t','qty','total_weight_t',
                              'load_date','load_time','delivery_date','delivery_time','order_no','assembly_seq'];
  v_crit_suppressed int := 0;
begin
  -- is_hhl() zwraca NULL dla konta nieaktywnego / bez wiersza app_users — NULL nie może przepuścić
  if is_hhl() is not true then raise exception 'Import harmonogramu wyłącznie HHL'; end if;
  if p_quiet is true and (current_app_role() = 'HHL_ADMIN') is not true then
    raise exception 'Import bez powiadomień wyłącznie dla Administratora HHL';
  end if;
  v_run_quiet := (p_quiet is true);
  if v_run_quiet then
    v_prev_run_quiet := current_setting('tower.bulk_quiet', true);
    perform set_config('tower.bulk_quiet', 'on', true);
  end if;
  if not exists (select 1 from projects where id = p_project) then raise exception 'Nieznany projekt'; end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then raise exception 'Wiersze importu: oczekiwana tablica'; end if;
  perform pg_advisory_xact_lock(hashtext('import_schedule:' || p_project::text));
  select id into v_user from app_users where auth_id = auth.uid();
  select coalesce((select value_num = 1 from ops_thresholds where key = 'import_quiet_hours'), false)
    into v_quiet_on;
  v_cmap := coalesce(p_file->'column_map', '{}'::jsonb);
  -- HOTFIX #384 pkt 3: kolumna HHL w mapie (A6: hhlOrderNo); bez niej nie wolamy konfliktu.
  v_has_hhl_col := (nullif(btrim(coalesce(v_cmap->>'hhlOrderNo', v_cmap->>'hhl_order_no', '')), '') is not null);

  -- przewoźnik nowych transportów: jedyny przewoźnik w systemie (inaczej HHL przypisuje ręcznie)
  select case when count(*) = 1 then min(id::text)::uuid end, case when count(*) = 1 then min(name) end
    into v_carrier, v_carrier_n from organizations where kind = 'CARRIER';

  -- walidacja wejścia (druga linia za parserem w przeglądarce): błąd = cała transakcja wycofana
  create temp table if not exists _imp (code text primary key, row jsonb not null) on commit drop;
  truncate _imp;
  for r in select value as v, ordinality as i from jsonb_array_elements(p_rows) with ordinality loop
    -- B-8-IMP: TYP = STANDARD (klasa albo item_type) to ładunek NTG — pomijamy, nie błąd, nie zapis
    if upper(btrim(coalesce(r.v->>'cargo_class', ''))) = 'STANDARD'
       or upper(btrim(coalesce(r.v->>'item_type', ''))) = 'STANDARD' then
      v_skipped := v_skipped + 1;
      continue;
    end if;
    if coalesce(btrim(r.v->>'code'), '') = '' then raise exception 'Wiersz %: brak kodu „Wysyłka”', r.i; end if;
    begin
      c := null;
      select schedule_row_canon(r.v) as canon into c;
    exception when others then
      raise exception 'Wiersz % (%): nieprawidłowa wartość — %', r.i, r.v->>'code', sqlerrm;
    end;
    -- I-2C: klasa ładunku — STANDARD (normatywny) bez wymiarów; każda inna klasa: wymiary wymagane i dodatnie
    if coalesce(upper(btrim(r.v->>'cargo_class')), 'DIMENSIONED') not in ('STANDARD', 'DIMENSIONED') then
      raise exception 'Wiersz % (%): nieznana klasa ładunku %', r.i, r.v->>'code', r.v->>'cargo_class';
    end if;
    if c.canon->>'cargo_class' = 'STANDARD' then
      if coalesce(c.canon->>'length_m', c.canon->>'width_m', c.canon->>'height_m') is not null then
        raise exception 'Wiersz % (%): klasa STANDARD — wymiary muszą być puste', r.i, r.v->>'code';
      end if;
    elsif ((c.canon->>'length_m')::numeric > 0 and (c.canon->>'width_m')::numeric > 0
           and (c.canon->>'height_m')::numeric > 0) is not true then
      raise exception 'Wiersz % (%): wymiary muszą być dodatnie (wymagane dla klasy innej niż STANDARD)', r.i, r.v->>'code';
    end if;
    if (c.canon->>'qty')::int <= 0 then raise exception 'Wiersz % (%): ilość musi być dodatnia', r.i, r.v->>'code'; end if;
    if (c.canon->>'delivery_date')::date < (c.canon->>'load_date')::date then
      raise exception 'Wiersz % (%): data dostawy przed datą załadunku', r.i, r.v->>'code';
    end if;
    begin
      insert into _imp values (btrim(r.v->>'code'), c.canon);
    exception when unique_violation then
      raise exception 'Kod % występuje w pliku więcej niż raz', btrim(r.v->>'code');
    end;
  end loop;

  -- DATY-67: plik KSH = źródło dat — zawsze nadpisuje (bez overwrite_confirmed)
  v_over := '{}'::text[];

  -- wersja (tylko przy zapisie; nadawana dopiero, gdy są zmiany)
  if p_dry_run is false then
    select coalesce(max(version), 0) + 1 into v_version from schedule_imports where project_id = p_project;
  end if;

  -- nowe i zmienione
  for r in
    select i.code, i.row as inc, si.id as item_id, si.load_id, l.status, l.carrier_org_id, l.hhl_order_no,
           l.plan_load_date, l.plan_delivery_date,
           l.plan_load_from, l.plan_load_to, l.plan_delivery_from, l.plan_delivery_to,
           coalesce(l.plan_dates_status = 'POTWIERDZONA', false) as confirmed,
           (l.plan_load_from is not null or l.plan_load_to is not null
            or l.plan_delivery_from is not null or l.plan_delivery_to is not null
            or l.status in ('READY','AT_LOADING','IN_TRANSIT_PL','AT_PORT_GDANSK','FERRY','AT_PORT_NYNASHAMN','IN_TRANSIT_SE','AT_SITE')) as awizowany,
           coalesce(si.schedule_row, case when si.id is not null then jsonb_build_object(
             'item_type', si.item_type, 'cargo_class', case when si.cargo_class = 'STANDARD' then 'STANDARD' end,
             'length_m', round(si.length_m, 2), 'width_m', round(si.width_m, 2),
             'height_m', round(si.height_m, 2), 'unit_weight_t', round(si.unit_weight_t, 3), 'qty', si.qty,
             'total_weight_t', round(si.total_weight_t, 3), 'load_date', l.plan_load_date, 'load_time', null,
             'delivery_date', l.plan_delivery_date, 'delivery_time', null, 'order_no', l.order_no,
             'assembly_seq', si.assembly_seq) end) as prev
      from _imp i
      left join shipment_items si on si.project_id = p_project and si.shipment_code = i.code
      left join loads l on l.id = si.load_id
     order by i.code
  loop
    v_historic := false;
    if r.item_id is null or r.load_id is null then
      v_added := v_added || jsonb_build_object('code', r.code);
      if p_dry_run is false then
        if v_import is null then
          insert into schedule_imports (project_id, version, source, file_path, file_hash, file_name, column_map, stats, imported_by)
          values (p_project, v_version, 'UPLOAD', p_file->>'path', p_file->>'hash', p_file->>'name',
                  coalesce(p_file->'column_map', '{}'::jsonb), '{}'::jsonb, v_user)
          returning id into v_import;
        end if;
        insert into loads (project_id, order_no, carrier_org_id, status, plan_load_date, plan_delivery_date,
                               plan_load_from, plan_delivery_to, plan_dates_status, plan_dates_confirmed_at)
        values (p_project, r.inc->>'order_no', v_carrier, 'PLANNED',
                (r.inc->>'load_date')::date, (r.inc->>'delivery_date')::date,
                public.schedule_cell_ts((r.inc->>'load_date')::date, r.inc->>'load_time', 'Europe/Warsaw'),
                public.schedule_cell_ts((r.inc->>'delivery_date')::date, r.inc->>'delivery_time', 'Europe/Stockholm'),
                'POTWIERDZONA', now())
        returning id into v_load;
        if r.item_id is null then
          insert into shipment_items (project_id, load_id, shipment_code, item_type, cargo_class, length_m, width_m, height_m,
                                      unit_weight_t, qty, total_weight_t, assembly_seq, schedule_row,
                                      first_seen_import, last_seen_import)
          values (p_project, v_load, r.code, r.inc->>'item_type', coalesce(r.inc->>'cargo_class', 'DIMENSIONED'), (r.inc->>'length_m')::numeric, (r.inc->>'width_m')::numeric,
                  (r.inc->>'height_m')::numeric, (r.inc->>'unit_weight_t')::numeric, (r.inc->>'qty')::int,
                  (r.inc->>'total_weight_t')::numeric, (r.inc->>'assembly_seq')::int, r.inc, v_import, v_import);
        else
          update shipment_items set load_id = v_load, schedule_row = r.inc, last_seen_import = v_import, updated_at = now()
           where id = r.item_id;
        end if;
        insert into load_events (load_id, event_type, occurred_at, actor_id, payload)
        values (v_load, 'SCHEDULE_IMPORTED', now(), v_user,
                jsonb_build_object('action', 'ADDED', 'code', r.code, 'version', v_version, 'file', p_file->>'name',
                                   'quiet', v_run_quiet));
      end if;
      continue;
    end if;

    select coalesce(array_agg(f order by f), '{}') into v_fields
      from unnest(v_fnames) f where coalesce(r.inc -> f, 'null'::jsonb) is distinct from coalesce(r.prev -> f, 'null'::jsonb);
    -- L-1b / HOTFIX #384 pkt 3: konflikt tylko gdy mapa ma kolumne HHL i plik ma niepusta wartosc.
    -- F7 #2: przy p_quiet nie otwieraj spraw TOWER_KSH_CONFLICT.
    if p_dry_run is false
       and v_run_quiet is not true
       and v_has_hhl_col
       and nullif(btrim(r.hhl_order_no), '') is not null
       and nullif(btrim(coalesce(r.inc->>'hhl_order_no', r.inc->>'hhlOrderNo', '')), '') is not null
       and nullif(btrim(r.hhl_order_no), '') is distinct from
           nullif(btrim(coalesce(r.inc->>'hhl_order_no', r.inc->>'hhlOrderNo', '')), '') then
      perform l1b_note_conflict(
        p_project, r.load_id, r.code, r.hhl_order_no,
        coalesce(r.inc->>'hhl_order_no', r.inc->>'hhlOrderNo'));
    end if;
    if cardinality(v_fields) = 0 then v_unchanged := v_unchanged + 1; continue; end if;

    if r.status = 'CANCELLED' then
      v_blocked := v_blocked || jsonb_build_object('code', r.code, 'load_id', r.load_id, 'reason', 'CANCELLED',
                     'message', 'Transport anulowany — przywrócenie wyłącznie ręcznie przez HHL');
      continue;
    end if;

    -- DATY-67: daty z pliku zawsze stosowane; informacyjnie lista zmian dat (bez blokady)
    v_keep := false;
    if ('load_date' = any (v_fields) or 'delivery_date' = any (v_fields)
        or 'load_time' = any (v_fields) or 'delivery_time' = any (v_fields)) then
      v_confirmed := v_confirmed || jsonb_build_object('code', r.code, 'load_id', r.load_id,
                       'before', jsonb_build_object('load_date', r.prev->'load_date', 'delivery_date', r.prev->'delivery_date',
                                                    'load_time', r.prev->'load_time', 'delivery_time', r.prev->'delivery_time'),
                       'after', jsonb_build_object('load_date', r.inc->'load_date', 'delivery_date', r.inc->'delivery_date',
                                                   'load_time', r.inc->'load_time', 'delivery_time', r.inc->'delivery_time'),
                       'overwrite', true);
    end if;

    -- D-20261020-1157-01: ciche pierwsze uzupelnienie pustych godzin (import_quiet_hours).
    -- B1 F7: puste takze w loads (nie tylko w schedule_row) — godziny wpisane przez KSH/HHL nie nadpisywac cicho.
    v_quiet_fill := v_quiet_on
      and cardinality(v_fields) > 0
      and v_fields <@ array['load_time','delivery_time']::text[]
      and (
        not ('load_time' = any (v_fields))
        or (nullif(btrim(r.prev->>'load_time'), '') is null
            and nullif(btrim(r.inc->>'load_time'), '') is not null
            and r.plan_load_from is null and r.plan_load_to is null)
      )
      and (
        not ('delivery_time' = any (v_fields))
        or (nullif(btrim(r.prev->>'delivery_time'), '') is null
            and nullif(btrim(r.inc->>'delivery_time'), '') is not null
            and r.plan_delivery_from is null and r.plan_delivery_to is null)
      );
    -- HOTFIX #384 pkt 4b: cicho gdy status ≥ DELIVERED albo stara i nowa dostawa minione.
    v_historic := (
      (r.status is not null
        and public.load_status_rank(r.status) >= public.load_status_rank('DELIVERED'::public.load_status))
      or (
        r.plan_delivery_date is not null
        and r.plan_delivery_date < v_today
        and nullif(btrim(r.inc->>'delivery_date'), '') is not null
        and (r.inc->>'delivery_date')::date < v_today
      )
    );
    -- F7 #7: w dry_run pokazuj critical także przy quiet; wycisz zdarzenia dopiero przy zapisie.
    v_crit := case
      when v_quiet_fill or v_historic then '{}'::text[]
      when r.awizowany then
        array(select f from unnest(v_fields) f where f in ('load_date','load_time','delivery_date','delivery_time'))
      else '{}'::text[]
    end;
    if v_run_quiet and p_dry_run is false and cardinality(v_crit) > 0 then
      v_crit_suppressed := v_crit_suppressed + 1;
    end if;
    v_changed := v_changed || jsonb_build_object('code', r.code, 'load_id', r.load_id, 'fields', to_jsonb(v_fields),
                   'before', (select jsonb_object_agg(f, r.prev -> f) from unnest(v_fields) f),
                   'after',  (select jsonb_object_agg(f, r.inc -> f) from unnest(v_fields) f),
                   'critical', cardinality(v_crit) > 0,
                   'quiet_hours', v_quiet_fill,
                   'quiet_hist', v_historic);
    if cardinality(v_crit) > 0 then v_critical := v_critical || jsonb_build_object('code', r.code, 'fields', to_jsonb(v_crit)); end if;

    if p_dry_run is false then
      if v_import is null then
        insert into schedule_imports (project_id, version, source, file_path, file_hash, file_name, column_map, stats, imported_by)
        values (p_project, v_version, 'UPLOAD', p_file->>'path', p_file->>'hash', p_file->>'name',
                coalesce(p_file->'column_map', '{}'::jsonb), '{}'::jsonb, v_user)
        returning id into v_import;
      end if;
      update shipment_items set
        item_type = r.inc->>'item_type', cargo_class = coalesce(r.inc->>'cargo_class', 'DIMENSIONED'), length_m = (r.inc->>'length_m')::numeric, width_m = (r.inc->>'width_m')::numeric,
        height_m = (r.inc->>'height_m')::numeric, unit_weight_t = (r.inc->>'unit_weight_t')::numeric,
        qty = (r.inc->>'qty')::int, total_weight_t = (r.inc->>'total_weight_t')::numeric,
        assembly_seq = (r.inc->>'assembly_seq')::int,
        -- zachowana data potwierdzona: w schedule_row zostają poprzednie daty, więc różnica (i ostrzeżenie) wraca przy kolejnym imporcie
        schedule_row = r.inc,
        last_seen_import = v_import, updated_at = now()
       where id = r.item_id;
      if 'load_date' = any (v_fields) or 'delivery_date' = any (v_fields) or 'order_no' = any (v_fields)
         or 'load_time' = any (v_fields) or 'delivery_time' = any (v_fields) then
        -- G-20 / D-20261014-0015-01 R1: kontekst importu — strażnik przepuszcza daty z pliku
        perform set_config('tower.import_ctx', 'on', true);
        if v_quiet_fill or v_historic then
          v_prev_quiet := current_setting('tower.bulk_quiet', true);
          perform set_config('tower.bulk_quiet', 'on', true);
        end if;
        -- status dat ustawia trg_plan_dates_before (POTWIERDZONA = z pliku); nie w UPDATE (guard)
        v_new_load_date := coalesce((r.inc->>'load_date')::date, r.plan_load_date);
        v_new_del_date := coalesce((r.inc->>'delivery_date')::date, r.plan_delivery_date);
        -- #384 F7 r2/r3: pusta komórka godziny = bez zmiany (nie null).
        -- Zmiana daty bez godziny → wspólna delta (v_new_date − plan_*_date) dla od i do; strażnik do > od.
        if nullif(btrim(r.inc->>'load_time'), '') is not null then
          v_new_load_from := public.schedule_cell_ts(v_new_load_date, r.inc->>'load_time', 'Europe/Warsaw');
          v_new_load_to := case
            when v_new_load_from is null then null
            when r.plan_load_to is not null
                 and (r.plan_load_to at time zone 'Europe/Warsaw')::date = v_new_load_date
                 and r.plan_load_to > v_new_load_from
              then r.plan_load_to
            when r.plan_load_to is not null and r.plan_load_date is not null and v_new_load_date is not null then
              r.plan_load_to + make_interval(days => (v_new_load_date - r.plan_load_date))
            else null
          end;
          if v_new_load_to is not null and v_new_load_from is not null and v_new_load_to <= v_new_load_from then
            v_new_load_to := null;
          end if;
        elsif v_new_load_date is distinct from r.plan_load_date
              and r.plan_load_date is not null and v_new_load_date is not null then
          v_new_load_from := case when r.plan_load_from is not null then
            r.plan_load_from + make_interval(days => (v_new_load_date - r.plan_load_date))
          else null end;
          v_new_load_to := case when r.plan_load_to is not null then
            r.plan_load_to + make_interval(days => (v_new_load_date - r.plan_load_date))
          else null end;
          if v_new_load_from is not null and v_new_load_to is not null and v_new_load_to <= v_new_load_from then
            v_new_load_to := null;
          end if;
        else
          v_new_load_from := r.plan_load_from;
          v_new_load_to := r.plan_load_to;
        end if;
        if nullif(btrim(r.inc->>'delivery_time'), '') is not null then
          v_new_del_to := public.schedule_cell_ts(v_new_del_date, r.inc->>'delivery_time', 'Europe/Stockholm');
          v_new_del_from := case
            when v_new_del_to is null then null
            when r.plan_delivery_from is not null
                 and (r.plan_delivery_from at time zone 'Europe/Stockholm')::date = v_new_del_date
                 and r.plan_delivery_from < v_new_del_to
              then r.plan_delivery_from
            when r.plan_delivery_from is not null and r.plan_delivery_date is not null and v_new_del_date is not null then
              r.plan_delivery_from + make_interval(days => (v_new_del_date - r.plan_delivery_date))
            else null
          end;
          if v_new_del_from is not null and v_new_del_to is not null and v_new_del_from >= v_new_del_to then
            v_new_del_from := null;
          end if;
        elsif v_new_del_date is distinct from r.plan_delivery_date
              and r.plan_delivery_date is not null and v_new_del_date is not null then
          v_new_del_to := case when r.plan_delivery_to is not null then
            r.plan_delivery_to + make_interval(days => (v_new_del_date - r.plan_delivery_date))
          else null end;
          v_new_del_from := case when r.plan_delivery_from is not null then
            r.plan_delivery_from + make_interval(days => (v_new_del_date - r.plan_delivery_date))
          else null end;
          if v_new_del_from is not null and v_new_del_to is not null and v_new_del_from >= v_new_del_to then
            v_new_del_from := null;
          end if;
        else
          v_new_del_to := r.plan_delivery_to;
          v_new_del_from := r.plan_delivery_from;
        end if;
        update loads set
          plan_load_date = coalesce(v_new_load_date, plan_load_date),
          plan_delivery_date = coalesce(v_new_del_date, plan_delivery_date),
          plan_load_from = v_new_load_from,
          plan_load_to = v_new_load_to,
          plan_delivery_from = v_new_del_from,
          plan_delivery_to = v_new_del_to,
          order_no = coalesce(r.inc->>'order_no', order_no),
          updated_at = now()
         where id = r.load_id;
        if v_quiet_fill or v_historic then
          perform set_config('tower.bulk_quiet', coalesce(v_prev_quiet, ''), true);
        end if;
        perform set_config('tower.import_ctx', '', true);
      end if;
      insert into load_events (load_id, event_type, occurred_at, actor_id, payload)
      values (r.load_id, 'SCHEDULE_IMPORTED', now(), v_user,
              jsonb_build_object('action', 'CHANGED', 'code', r.code, 'version', v_version, 'fields', to_jsonb(v_fields),
                                 'before', (select jsonb_object_agg(f, r.prev -> f) from unnest(v_fields) f),
                                 'after',  (select jsonb_object_agg(f, r.inc -> f) from unnest(v_fields) f),
                                 'quiet', v_run_quiet));
      if cardinality(v_crit) > 0 and v_historic is not true and v_run_quiet is not true then
        insert into load_events (load_id, event_type, occurred_at, actor_id, payload)
        values (r.load_id, 'SCHEDULE_DATE_CRITICAL', now(), v_user,
                jsonb_build_object('code', r.code, 'version', v_version, 'fields', to_jsonb(v_crit),
                                   'before', (select jsonb_object_agg(f, r.prev -> f) from unnest(v_crit) f),
                                   'after',  (select jsonb_object_agg(f, r.inc -> f) from unnest(v_crit) f)));
        insert into notifications (channel, recipient, user_id, load_id, template, payload, dedup_key)
        select 'IN_APP', coalesce(u.email::text, u.id::text), u.id, r.load_id, 'SCHEDULE_DATE_CRITICAL',
               jsonb_build_object('code', r.code, 'fields', to_jsonb(v_crit),
                                  'load_date', r.inc->>'load_date', 'delivery_date', r.inc->>'delivery_date',
                                  'locale', u.locale),
               'SCHED_CRIT:' || r.load_id || ':' || v_version || ':' || u.id
          from app_users u join organizations o on o.id = u.org_id
         where u.active and (o.kind = 'FORWARDER' or (r.carrier_org_id is not null and u.org_id = r.carrier_org_id))
        on conflict (dedup_key) where dedup_key is not null do nothing;
      end if;
    end if;
  end loop;

  -- nieobecne w pliku: kandydaci do anulowania (tylko gdy plik ma przyjęte wiersze)
  if jsonb_array_length(p_rows) > 0 then
    for c in
      select si.shipment_code as code, l.id as load_id, l.status,
             exists (select 1 from invoice_lines il where il.load_id = l.id) as invoiced
        from shipment_items si join loads l on l.id = si.load_id
       where si.project_id = p_project and l.status <> 'CANCELLED'
         and si.cargo_class is distinct from 'STANDARD'
         and not exists (select 1 from _imp i where i.code = si.shipment_code)
       order by si.shipment_code
    loop
      -- F7 #2: przy p_quiet nie otwieraj spraw KSH_ROW_GONE.
      if p_dry_run is false and v_run_quiet is not true then
        perform l1b_note_row_gone(p_project, c.load_id, c.code);
      end if;
      if c.invoiced then
        v_blocked := v_blocked || jsonb_build_object('code', c.code, 'load_id', c.load_id, 'reason', 'INVOICED',
                       'message', 'Transport jest na fakturze');
      elsif c.status not in ('PLANNED','RESOURCES_PENDING','DOCS_PENDING','READY') then
        v_blocked := v_blocked || jsonb_build_object('code', c.code, 'load_id', c.load_id, 'reason', 'STATUS',
                       'message', 'Transport od wjazdu na załadunek — anuluje wyłącznie HHL ręcznie, z powodem');
      else
        v_cands := v_cands || jsonb_build_object('code', c.code, 'load_id', c.load_id);
        if p_dry_run is false and c.code = any (coalesce(p_cancel_codes, '{}')) then
          if v_import is null then
            insert into schedule_imports (project_id, version, source, file_path, file_hash, file_name, column_map, stats, imported_by)
            values (p_project, v_version, 'UPLOAD', p_file->>'path', p_file->>'hash', p_file->>'name',
                    coalesce(p_file->'column_map', '{}'::jsonb), '{}'::jsonb, v_user)
            returning id into v_import;
          end if;
          perform set_config('tower.cancel_ctx', 'IMPORT', true);
          update loads set status = 'CANCELLED', updated_at = now() where id = c.load_id;
          perform set_config('tower.cancel_ctx', '', true);
          insert into audit_log (user_id, action, entity, entity_id, old_value, new_value)
          values (v_user, 'LOAD_CANCEL_IMPORT', 'loads', c.load_id::text, jsonb_build_object('status', c.status),
                  jsonb_build_object('status', 'CANCELLED', 'reason', 'Usunięty z harmonogramu (' || coalesce(p_file->>'name', 'import') || ')',
                                     'version', v_version));
          insert into load_events (load_id, event_type, occurred_at, actor_id, payload)
          values (c.load_id, 'STATUS_CANCELLED', now(), v_user,
                  jsonb_build_object('code', c.code, 'version', v_version, 'reason', 'Usunięty z harmonogramu', 'file', p_file->>'name',
                                     'quiet', v_run_quiet));
          v_cancelled := v_cancelled || jsonb_build_object('code', c.code, 'load_id', c.load_id);
        end if;
      end if;
    end loop;
  end if;

  -- F7 #2: przy p_quiet nie otwieraj spraw KR_OVER_3.
  if p_dry_run is false and v_run_quiet is not true then
    for r in
      select distinct (i.row->>'load_date')::date as d
        from _imp i
       where nullif(i.row->>'load_date', '') is not null
    loop
      perform l1b_kr_check(p_project, r.d);
    end loop;
  end if;

  if v_import is not null then
    update schedule_imports set stats = jsonb_build_object(
        'added', jsonb_array_length(v_added), 'changed', jsonb_array_length(v_changed),
        'unchanged', v_unchanged, 'cancelled', jsonb_array_length(v_cancelled),
        'blocked', jsonb_array_length(v_blocked), 'critical', jsonb_array_length(v_critical),
        'confirmed_kept', (select count(*) from jsonb_array_elements(v_confirmed) x where not (x->>'overwrite')::boolean),
        'rows', jsonb_array_length(p_rows), 'rejected', coalesce((p_file->>'rejected')::int, 0),
        'skipped_standard', v_skipped + coalesce((p_file->>'skipped_standard')::int, 0),
        'quiet', v_run_quiet)
     where id = v_import;
  end if;

  -- F7 #5: audyt tylko gdy coś zapisano; import_id / cancelled / critical_suppressed.
  if v_run_quiet and p_dry_run is false and v_import is not null then
    insert into audit_log (user_id, action, entity, entity_id, new_value)
    values (
      v_user,
      'SCHEDULE_IMPORT_QUIET',
      'schedule_imports',
      v_import::text,
      jsonb_build_object(
        'note', 'import bez powiadomień',
        'import_id', v_import,
        'project_id', p_project,
        'version', v_version,
        'file', p_file->>'name',
        'added', jsonb_array_length(v_added),
        'changed', jsonb_array_length(v_changed),
        'cancelled', jsonb_array_length(v_cancelled),
        'critical_suppressed', v_crit_suppressed
      )
    );
  end if;
  if v_run_quiet then
    perform set_config('tower.bulk_quiet', coalesce(v_prev_run_quiet, ''), true);
  end if;

  return jsonb_build_object(
    'dry_run', p_dry_run,
    'quiet', v_run_quiet,
    'version', case when v_import is not null then v_version end,
    'import_id', v_import,
    'rows', jsonb_array_length(p_rows),
    'added', v_added, 'changed', v_changed, 'unchanged', v_unchanged,
    'cancel_candidates', v_cands, 'blocked', v_blocked, 'cancelled', v_cancelled, 'critical', v_critical, 'confirmed', v_confirmed,
    'carrier', v_carrier_n,
    'skipped_standard', v_skipped + coalesce((p_file->>'skipped_standard')::int, 0),
    'ms', round(extract(epoch from clock_timestamp() - t0) * 1000));
end $function$;

REVOKE ALL ON FUNCTION public.import_schedule(uuid, jsonb, text[], jsonb, boolean, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.import_schedule(uuid, jsonb, text[], jsonb, boolean, boolean) TO authenticated;

COMMENT ON FUNCTION public.import_schedule(uuid, jsonb, text[], jsonb, boolean, boolean) IS
  'I-1 import KSH. #426+#384: p_quiet HHL_ADMIN; zmiana daty bez godziny przesuwa okno (wspólna delta); pusta godzina = bez zmiany; dry_run pokazuje critical.';

-- ---------------------------------------------------------------------------
-- 4) Przywrócenie okien SG-01 / SG-02 / T-01 (import 21.10 skasował do/od).
--    Funkcja testowalna; DO woła raz przy migracji (produkcja). F7 P4–P9.
-- ---------------------------------------------------------------------------
create or replace function public.hotfix_384_restore_windows()
returns integer
language plpgsql
security definer
set search_path = public
as $restore_fn$
declare
  v_prev text;
  v_prev_dates text;
  v_prev_import text;
  v_n int := 0;
  v_cnt int;
  v_proj uuid;
  r record;
  v_to timestamptz;
  v_df timestamptz;
  v_status text;
  v_confirmed_by uuid;
  v_confirmed_at timestamptz;
begin
  select id into v_proj
    from projects
   where code in ('STEGRA_BODEN', 'STEGRA')
   order by case code when 'STEGRA_BODEN' then 0 else 1 end
   limit 1;
  if v_proj is null then
    raise notice '0267: brak projektu STEGRA_BODEN/STEGRA — pomijam przywrócenie okien';
    return 0;
  end if;

  select count(distinct l.id) into v_cnt
    from loads l
    join shipment_items si on si.load_id = l.id
   where l.project_id = v_proj
     and si.shipment_code in ('SG-01', 'SG-02', 'T-01');
  if v_cnt > 3 then
    raise exception '0267: przywrócenie okien — za dużo dopasowań (%) dla SG-01/02/T-01', v_cnt
      using errcode = 'P0001';
  end if;

  v_prev := current_setting('tower.bulk_quiet', true);
  v_prev_dates := current_setting('tower.dates_ctx', true);
  v_prev_import := current_setting('tower.import_ctx', true);
  perform set_config('tower.bulk_quiet', 'on', true);
  perform set_config('tower.import_ctx', 'on', true);
  -- F7 P7: dates_ctx → trg_plan_dates_before nie zmienia statusu / confirmed_*
  perform set_config('tower.dates_ctx', 'on', true);

  for r in
    select distinct on (l.id)
           l.id, l.plan_load_to, l.plan_delivery_from, l.plan_load_from, l.plan_delivery_to,
           l.plan_load_date, l.plan_delivery_date,
           l.plan_dates_status, l.plan_dates_confirmed_by, l.plan_dates_confirmed_at,
           si.shipment_code
      from loads l
      join shipment_items si on si.load_id = l.id
     where l.project_id = v_proj
       and si.shipment_code in ('SG-01', 'SG-02', 'T-01')
       and (l.plan_load_to is null or l.plan_delivery_from is null)
     order by l.id, si.shipment_code
  loop
    -- F7 P5: per pole ostatnia niepusta before_* tylko z PLAN_DATES_CHANGED
    -- (JSON null przechodzi przez ? 'before_load_to'; SCHEDULE_* nie ma before_*)
    select nullif(e.payload->>'before_load_to', '')::timestamptz
      into v_to
      from load_events e
     where e.load_id = r.id
       and e.event_type = 'PLAN_DATES_CHANGED'
       and nullif(e.payload->>'before_load_to', '') is not null
     order by e.occurred_at desc
     limit 1;

    select nullif(e.payload->>'before_delivery_from', '')::timestamptz
      into v_df
      from load_events e
     where e.load_id = r.id
       and e.event_type = 'PLAN_DATES_CHANGED'
       and nullif(e.payload->>'before_delivery_from', '') is not null
     order by e.occurred_at desc
     limit 1;

    -- F7 P6: spójność z bieżącą datą planu i do > od
    if v_to is not null then
      if r.plan_load_date is null
         or (v_to at time zone 'Europe/Warsaw')::date is distinct from r.plan_load_date
         or (r.plan_load_from is not null and v_to <= r.plan_load_from) then
        raise notice '0267: pomijam plan_load_to dla % (%) — niespójne z datą/od',
          r.shipment_code, r.id;
        v_to := null;
      end if;
    end if;
    if v_df is not null then
      if r.plan_delivery_date is null
         or (v_df at time zone 'Europe/Stockholm')::date is distinct from r.plan_delivery_date
         or (r.plan_delivery_to is not null and v_df >= r.plan_delivery_to) then
        raise notice '0267: pomijam plan_delivery_from dla % (%) — niespójne z datą/do',
          r.shipment_code, r.id;
        v_df := null;
      end if;
    end if;

    if (r.plan_load_to is null and v_to is not null)
       or (r.plan_delivery_from is null and v_df is not null) then
      v_status := r.plan_dates_status;
      v_confirmed_by := r.plan_dates_confirmed_by;
      v_confirmed_at := r.plan_dates_confirmed_at;
      update loads set
        plan_load_to = case when plan_load_to is null then v_to else plan_load_to end,
        plan_delivery_from = case when plan_delivery_from is null then v_df else plan_delivery_from end,
        plan_dates_status = coalesce(v_status, plan_dates_status),
        plan_dates_confirmed_by = v_confirmed_by,
        plan_dates_confirmed_at = v_confirmed_at,
        updated_at = now()
       where id = r.id;
      v_n := v_n + 1;
      insert into audit_log (action, entity, entity_id, new_value)
      values (
        'HOTFIX_384_RESTORE_WINDOW', 'loads', r.id::text,
        jsonb_build_object(
          'code', r.shipment_code,
          'plan_load_to', v_to,
          'plan_delivery_from', v_df
        )
      );
    end if;
  end loop;

  perform set_config('tower.dates_ctx', coalesce(v_prev_dates, ''), true);
  perform set_config('tower.import_ctx', coalesce(v_prev_import, ''), true);
  perform set_config('tower.bulk_quiet', coalesce(v_prev, ''), true);
  raise notice '0267: przywrócono okno dla % transportów SG-01/02/T-01', v_n;
  return v_n;
end
$restore_fn$;

revoke all on function public.hotfix_384_restore_windows() from public, anon, authenticated;

comment on function public.hotfix_384_restore_windows() is
  '#384 F7: jednorazowe / testowalne przywrócenie plan_load_to i plan_delivery_from SG-01/02/T-01 w STEGRA_BODEN (lub STEGRA).';

do $restore$
begin
  perform public.hotfix_384_restore_windows();
end
$restore$;
