-- D-20261019-0005-01: Administrator HHL — daty i godziny bez ograniczeń.
-- HHL_OPS / KSH / SCX bez zmian. Historia: audit_log + W30 (acting_as).
-- F7 #313: DECISION_HOLD w CHECK; admin bez sprawy KSH_DATES_CHECK; load_status_set przez current_app_*.

insert into decision_types (code, title_key, decider_role, options, due_hours, due_note, severity_default, sort_order)
values (
  'KSH_DATES_CHECK',
  'dec_type_KSH_DATES_CHECK',
  'HHL',
  '[{"code":"DATES_OK","label_key":"dec_opt_DATES_OK","requires_comment":false,"effect":"ACCEPT"},{"code":"ASK_FIX","label_key":"dec_opt_ASK_FIX","requires_comment":false,"effect":"HOLD"}]'::jsonb,
  48,
  'daty planu do sprawdzenia (kolejność / odstęp)',
  'WARNING',
  34
)
on conflict (code) do nothing;

-- B1: ASK_FIX / HOLD wstawia DECISION_HOLD — typ musi być w CHECK (uśpione od 0126).
alter table public.load_events drop constraint if exists load_events_event_type_known;
alter table public.load_events add constraint load_events_event_type_known check (event_type in (
    'NOTE', 'DOC_UPLOADED', 'PERMIT_MISMATCH', 'AWIZACJA_UPDATED', 'RESOURCES_UPDATED', 'ORDER_NO_UPDATED',
    'FERRY_UPDATED', 'SAILING_ASSIGNED', 'SCX_ASSIGNED', 'PLAN_B_ACTIVATED', 'READY_BLOCKED',
    'SCHEDULE_IMPORTED', 'SCHEDULE_DATE_CRITICAL', 'STATUS_APPROACHING_SITE', 'STATUS_AT_LOADING',
    'STATUS_AT_PORT', 'STATUS_AT_PORT_GDANSK', 'STATUS_AT_PORT_NYNASHAMN', 'STATUS_AT_SITE',
    'STATUS_CANCELLED', 'STATUS_DELAYED', 'STATUS_DELIVERED', 'STATUS_DOCS_PENDING', 'STATUS_DOC_MISSING',
    'STATUS_FERRY', 'STATUS_IN_TRANSIT_PL', 'STATUS_IN_TRANSIT_SE', 'STATUS_LOADING', 'STATUS_ON_FERRY',
    'STATUS_PLANNED', 'STATUS_READY', 'STATUS_RESOURCES_PENDING', 'STATUS_SILENT', 'STATUS_UNLOADED',
    'STATUS_UNLOADING', 'STATUS_READY_TO_INVOICE', 'STATUS_INVOICED',
    'MILESTONE_LOADED', 'MILESTONE_UNLOADED', 'DRIVER_ON_FERRY', 'DRIVER_PROBLEM',
    'GEOFENCE_ENTER', 'GEOFENCE_EXIT', 'GEOFENCE_DWELL', 'STATUS_AUTO', 'POSITION_SHARED',
    'POSITION_SHARE_DENIED', 'DELAY_DETECTED', 'RISK_RAISED', 'SILENT_VEHICLE',
    'PLAN_DATES_CONFIRMED', 'PLAN_DATES_CHANGED', 'DECISION_HOLD'
));

create or replace function public.guard_load_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_changed  text[];
  v_bad      text[];
  v_ctx      text;
  v_carrier  text[] := array[
    'tractor_plate','trailer_plate','trailer_type','driver_name','driver_phone',
    'escort_vehicles','telematics_vehicle_id','telematics_provider',
    'ferry_booking_ref','sailing_id','carrier_order_no',
    'combo_length_m','combo_width_m','combo_height_m','combo_weight_t',
    'actual_load_at','actual_delivery_at','status','updated_at'];
begin
  if current_setting('tower.eta_ctx', true) = 'on' then
    select coalesce(array_agg(n.key), '{}') into v_changed
      from jsonb_each(to_jsonb(new)) n
     where n.value is distinct from (to_jsonb(old) -> n.key);
    if (v_changed <@ array['eta_site','eta_confidence_min','eta_basis','eta_computed_at','delay_minutes','updated_at']::text[]) is not true then
      raise exception 'Przeliczenie ETA może zmienić wyłącznie kolumny eta_* (zmienione: %)', array_to_string(v_changed, ', ');
    end if;
    return new;
  end if;

  if current_setting('tower.track_ctx', true) = 'on' then
    select coalesce(array_agg(n.key), '{}') into v_changed
      from jsonb_each(to_jsonb(new)) n
     where n.value is distinct from (to_jsonb(old) -> n.key);
    if (v_changed <@ array['tracking_opened_at','updated_at']::text[]) is not true then
      raise exception 'Okno śledzenia może zmienić wyłącznie tracking_opened_at (zmienione: %)', array_to_string(v_changed, ', ');
    end if;
    return new;
  end if;

  if current_setting('tower.dates_ctx', true) = 'on' then
    select coalesce(array_agg(n.key), '{}') into v_changed
      from jsonb_each(to_jsonb(new)) n
     where n.value is distinct from (to_jsonb(old) -> n.key);
    if (v_changed <@ array['plan_load_date','plan_load_from','plan_load_to','plan_delivery_date','plan_delivery_from','plan_delivery_to',
                           'plan_dates_status','plan_dates_confirmed_by','plan_dates_confirmed_at','tracking_opened_at','updated_at']::text[]) is not true then
      raise exception 'Potwierdzenie dat może zmienić wyłącznie daty planu (zmienione: %)', array_to_string(v_changed, ', ');
    end if;
    return new;
  end if;

  if auth.uid() is not null and (new.plan_dates_status, new.plan_dates_confirmed_by, new.plan_dates_confirmed_at)
       is distinct from (old.plan_dates_status, old.plan_dates_confirmed_by, old.plan_dates_confirmed_at) then
    raise exception 'Status dat planu zmienia wyłącznie potwierdzenie KSH („Potwierdź daty”)';
  end if;

  if new.status = 'CANCELLED' and old.status is distinct from 'CANCELLED' then
    v_ctx := coalesce(current_setting('tower.cancel_ctx', true), '');
    if v_ctx = 'IMPORT' then
      if exists (select 1 from invoice_lines where load_id = old.id) then
        raise exception 'Import nie anuluje transportu na fakturze (%)', coalesce(old.order_no, left(old.id::text, 8));
      end if;
      if old.status not in ('PLANNED','RESOURCES_PENDING','DOCS_PENDING','READY') then
        raise exception 'Import nie anuluje transportu w statusie % — od AT_LOADING wyłącznie HHL ręcznie, z powodem', old.status;
      end if;
    elsif v_ctx = 'MANUAL' then
      null;
    elsif auth.uid() is not null then
      raise exception 'Anulować transport może wyłącznie HHL — przez cancel_load() z powodem albo import harmonogramu';
    end if;
  end if;

  if new.status = 'UNLOADED' and new.actual_delivery_at is null then
    raise exception 'Status UNLOADED wymaga daty rozładunku — to data realizacji usługi';
  end if;

  if new.actual_delivery_at is distinct from old.actual_delivery_at then
    if auth.uid() is not null and is_hhl() is not true
       and exists (select 1 from invoice_lines where load_id = old.id) then
      raise exception 'Data rozładunku transportu na fakturze jest zamrożona — zmiana wyłącznie przez HHL';
    end if;
    insert into audit_log (user_id, action, entity, entity_id, old_value, new_value)
    values ((select id from app_users where auth_id = auth.uid()),
            'LOAD_DELIVERY_DATE_CHANGE', 'loads', old.id::text,
            jsonb_build_object('actual_delivery_at', old.actual_delivery_at),
            jsonb_build_object('actual_delivery_at', new.actual_delivery_at));
  end if;

  -- Automat / migracja (bez JWT) — bez dalszych ograniczeń roli.
  if auth.uid() is null then return new; end if;

  -- A5: sesja użytkownika — load_status_set (status_ctx) albo automat/anulowanie (cancel_ctx).
  v_ctx := coalesce(current_setting('tower.cancel_ctx', true), '');
  if (
    (new.status is distinct from old.status or new.actual_delivery_at is distinct from old.actual_delivery_at)
    and current_setting('tower.status_ctx', true) is distinct from 'on'
    and v_ctx not in ('MANUAL', 'IMPORT')
  ) then
    raise exception 'Status i datę rozładunku zmienia wyłącznie load_status_set albo automat'
      using errcode = '42501';
  end if;

  select coalesce(array_agg(n.key), '{}') into v_changed
    from jsonb_each(to_jsonb(new)) n
   where n.value is distinct from (to_jsonb(old) -> n.key);

  if is_hhl() is true then
    if new.carrier_order_no is distinct from old.carrier_order_no then
      raise exception 'Numer zlecenia przewoźnika wpisuje wyłącznie przewoźnik';
    end if;
    if (
      (new.plan_load_date, new.plan_load_from, new.plan_load_to,
       new.plan_delivery_date, new.plan_delivery_from, new.plan_delivery_to)
      is not distinct from
      (old.plan_load_date, old.plan_load_from, old.plan_load_to,
       old.plan_delivery_date, old.plan_delivery_from, old.plan_delivery_to)
      or current_setting('tower.import_ctx', true) = 'on'
      or current_app_role() = 'HHL_ADMIN'
    ) is not true then
      raise exception 'Daty i godziny załadunku i rozładunku zmienia wyłącznie KSH Użytkownik (G-20)'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if (current_org_kind() = 'CARRIER' and old.carrier_org_id = current_org_id()) is true then
    select coalesce(array_agg(c), '{}') into v_bad from unnest(v_changed) c where c <> all (v_carrier);
    if cardinality(v_bad) > 0 then
      raise exception 'Przewoźnik nie może zmieniać: %', array_to_string(v_bad, ', ');
    end if;
    if new.status is distinct from old.status then
      if new.status = 'CANCELLED' then
        raise exception 'Anulować transport może wyłącznie HHL';
      end if;
      if old.status <> 'CANCELLED' and new.status < old.status then
        raise exception 'Status nie może się cofnąć: % → %', old.status, new.status;
      end if;
    end if;
    if new.sailing_id is distinct from old.sailing_id and old.status >= 'FERRY' then
      raise exception 'Zmiana rejsu po wypłynięciu — wyłącznie HHL';
    end if;
    return new;
  end if;

  raise exception 'Brak uprawnień do zmiany transportu';
end $$;

create or replace function public.load_status_set(
  p_load uuid,
  p_status text,
  p_occurred_at timestamptz,
  p_note text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := current_app_user_id();
  v_role text;
  v_org uuid;
  v_load loads%rowtype;
  v_new load_status;
  v_when timestamptz;
  v_note text := nullif(trim(coalesce(p_note, '')), '');
  v_actor text;
  v_prev_at timestamptz;
  v_missing text;
  v_ev_id bigint;
  v_ev_old timestamptz;
  v_old_load_at timestamptz;
  v_old_del_at timestamptz;
begin
  -- P3: jak ksh_confirm_dates — MFA i „Działaj jako” przez current_app_*.
  if (v_me is not null) is not true then
    raise exception 'Brak aktywnego konta' using errcode = '42501';
  end if;
  v_role := current_app_role()::text;
  select org_id into v_org from app_users where id = v_me;
  if (v_role in ('HHL_ADMIN', 'CARRIER_DISPATCH', 'CARRIER_USER')) is not true then
    raise exception 'Zmiana statusu — tylko Administrator HHL albo SCX' using errcode = '42501';
  end if;

  if (p_load is not null) is not true then
    raise exception 'Brak transportu' using errcode = '22023';
  end if;
  if (p_status is not null and length(trim(p_status)) > 0) is not true then
    raise exception 'Brak statusu' using errcode = '22023';
  end if;

  begin
    v_new := trim(p_status)::load_status;
  exception when others then
    raise exception 'Nieznany status' using errcode = '22023';
  end;

  if v_new = 'UNLOADED' then
    v_new := 'DELIVERED';
  end if;

  v_when := coalesce(p_occurred_at, now());
  if v_when > now() + interval '1 minute' and v_role is distinct from 'HHL_ADMIN' then
    raise exception 'Czas statusu nie może być w przyszłości' using errcode = '22023';
  end if;

  select * into v_load from loads where id = p_load for update;
  if not found then
    raise exception 'Nieznany transport' using errcode = 'P0002';
  end if;

  if v_role in ('CARRIER_DISPATCH', 'CARRIER_USER') then
    if (v_load.carrier_org_id is not null and v_load.carrier_org_id = v_org) is not true then
      raise exception 'Status — tylko własny transport SCX' using errcode = '42501';
    end if;
    if v_new = 'CANCELLED' then
      raise exception 'Anulowanie — tylko Administrator HHL' using errcode = '42501';
    end if;
    if public.load_status_rank(v_new) < public.load_status_rank(v_load.status) then
      raise exception 'SCX zmienia status tylko do przodu' using errcode = '22023';
    end if;
  end if;

  if v_new = 'CANCELLED' and (v_note is not null) is not true then
    raise exception 'Anulowanie wymaga powodu' using errcode = '22023';
  end if;

  if public.load_status_rank(v_new) < public.load_status_rank(v_load.status)
     and v_role = 'HHL_ADMIN'
     and (v_note is not null) is not true then
    raise exception 'Cofnięcie statusu wymaga powodu' using errcode = '22023';
  end if;

  -- A5: Gotowe do fakturowania — CMR z podpisem odbiorcy (wgrany dokument CMR).
  if v_new = 'READY_TO_INVOICE' then
    if (
      exists (
        select 1 from documents d
         where d.load_id = p_load
           and d.category = 'CMR'
           and d.superseded_at is null
      )
    ) is not true then
      raise exception 'Gotowe do fakturowania wymaga pliku CMR z podpisem odbiorcy'
        using errcode = '22023';
    end if;
  end if;

  -- A5: Zafakturowano — obie faktury (SCX→HHL KOSZT i HHL→KSH PRZYCHOD).
  if v_new = 'INVOICED' then
    v_missing := null;
    if (
      exists (select 1 from invoice_lines il where il.load_id = p_load and il.direction = 'KOSZT')
    ) is not true then
      v_missing := 'brak faktury SCX → HHL';
    end if;
    if (
      exists (select 1 from invoice_lines il where il.load_id = p_load and il.direction = 'PRZYCHOD')
    ) is not true then
      v_missing := case
        when v_missing is null then 'brak faktury HHL → KSH'
        else v_missing || ' i brak faktury HHL → KSH'
      end;
    end if;
    if v_missing is not null then
      raise exception 'Zafakturowano — %', v_missing using errcode = '22023';
    end if;
  end if;

  -- P4: HHL_ADMIN poprawia czas bieżącego wpisu osi (każdy status), nie tylko DELIVERED.
  if v_load.status is not distinct from v_new and v_role = 'HHL_ADMIN' then
    select id, occurred_at into v_ev_id, v_ev_old
      from load_events
     where load_id = p_load
       and event_type = 'STATUS_' || v_new::text
     order by occurred_at desc, id desc
     limit 1;
    v_old_load_at := v_load.actual_load_at;
    v_old_del_at := v_load.actual_delivery_at;
    if v_ev_id is not null and v_ev_old is distinct from v_when then
      perform set_config('session_replication_role', 'replica', true);
      update load_events set occurred_at = v_when where id = v_ev_id;
      perform set_config('session_replication_role', 'origin', true);
    end if;
    perform set_config('tower.status_ctx', 'on', true);
    update loads
       set actual_delivery_at = case when v_new = 'DELIVERED' then v_when else actual_delivery_at end,
           actual_load_at = case
             when v_new in ('AT_LOADING', 'IN_TRANSIT_PL') then v_when
             else actual_load_at
           end,
           updated_at = now()
     where id = p_load;
    insert into audit_log (user_id, action, entity, entity_id, old_value, new_value)
    values (
      v_me,
      'LOAD_STATUS_SET',
      'loads',
      p_load::text,
      jsonb_build_object(
        'status', v_load.status::text,
        'occurred_at', v_ev_old,
        'actual_load_at', v_old_load_at,
        'actual_delivery_at', v_old_del_at
      ),
      jsonb_build_object(
        'status', v_new::text,
        'occurred_at', v_when,
        'note', v_note,
        'time_only', true
      )
    );
    return;
  end if;

  if v_load.status is not distinct from v_new
     and (v_new is distinct from 'DELIVERED' or v_load.actual_delivery_at is not distinct from v_when) then
    return;
  end if;

  -- DELIVERED: wybrana godzina nadpisuje actual_delivery_at (W3 / A6) — może być wcześniejsza niż błędny STATUS_*.
  if v_new is distinct from 'DELIVERED' then
    select max(occurred_at) into v_prev_at
      from load_events
     where load_id = p_load
       and event_type like 'STATUS_%';
    if v_prev_at is not null and v_when < v_prev_at and v_role is distinct from 'HHL_ADMIN' then
      raise exception 'Czas statusu nie wcześniej niż poprzedni status' using errcode = '22023';
    end if;
  end if;

  select coalesce(nullif(btrim(u.full_name), ''), split_part(u.email::text, '@', 1), '—')
         || ' // ' || coalesce(nullif(btrim(o.name), ''), nullif(btrim(o.code), ''), '—')
    into v_actor
    from app_users u
    left join organizations o on o.id = u.org_id
   where u.id = v_me;

  if v_new = 'CANCELLED' then
    perform set_config('tower.cancel_ctx', 'MANUAL', true);
  end if;
  perform set_config('tower.status_ctx', 'on', true);

  update loads
     set status = v_new,
         actual_delivery_at = case
           when v_new = 'DELIVERED' then v_when
           else actual_delivery_at
         end,
         actual_load_at = case
           when v_new in ('AT_LOADING', 'IN_TRANSIT_PL') and actual_load_at is null then v_when
           else actual_load_at
         end,
         updated_at = now()
   where id = p_load;

  if v_load.status is distinct from v_new then
    insert into load_events (load_id, event_type, occurred_at, payload)
    values (
      p_load,
      'STATUS_' || v_new::text,
      v_when,
      jsonb_build_object(
        'actor', v_actor,
        'actor_user_id', v_me,
        'from', v_load.status::text,
        'to', v_new::text,
        'note', v_note,
        'manual', true
      )
    );
  end if;

  insert into audit_log (user_id, action, entity, entity_id, old_value, new_value)
  values (
    v_me,
    'LOAD_STATUS_SET',
    'loads',
    p_load::text,
    jsonb_build_object('status', v_load.status::text, 'actual_delivery_at', v_load.actual_delivery_at),
    jsonb_build_object('status', v_new::text, 'occurred_at', v_when, 'note', v_note)
  );
end $$;

revoke all on function public.load_status_set(uuid, text, timestamptz, text) from public, anon;
grant execute on function public.load_status_set(uuid, text, timestamptz, text) to authenticated;
comment on function public.load_status_set(uuid, text, timestamptz, text) is
  'A5 E25 + D-0005: HHL_ADMIN bez limitu czasu; current_app_*; korekta czasu osi; READY_TO_INVOICE=CMR; INVOICED=obie faktury.';

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
  v_dates_odd boolean := false;
  v_by text;
begin
  if (v_actor is not null) is not true then
    raise exception 'Brak aktywnego konta' using errcode = '42501';
  end if;
  -- G-20: CLIENT_USER albo Administrator HHL (D-20261019-0005-01)
  if (v_admin or current_app_role() = 'CLIENT_USER') is not true then
    raise exception 'Daty i godziny zmienia wyłącznie KSH Użytkownik' using errcode = '42501';
  end if;
  if v_admin is not true then
    if (current_org_kind() = 'CLIENT') is not true then
      raise exception 'Daty i godziny w tym oknie zmienia wyłącznie KSH (zamawiający)' using errcode = '42501';
    end if;
  end if;
  if p_load is null then raise exception 'Brak transportu' using errcode = '22023'; end if;
  select * into l from loads where id = p_load for update;
  if not found then raise exception 'Transport nie istnieje' using errcode = '42501'; end if;
  select client_org_id into v_client from projects where id = l.project_id;
  if v_admin is not true and (v_client = current_org_id()) is not true then
    raise exception 'Daty i godziny w tym oknie zmienia wyłącznie KSH (zamawiający)' using errcode = '42501';
  end if;
  if v_admin is not true
     and (l.status in ('PLANNED','RESOURCES_PENDING','DOCS_PENDING','READY')) is not true then
    raise exception 'Po wjeździe na załadunek (albo po anulowaniu) daty planu nie zmienia się w tym oknie' using errcode = '42501';
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

  v_by := case when v_admin then 'HHL_ADMIN' else 'KSH' end;
  if v_admin then
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

  v_code := coalesce(l.order_no, left(l.id::text, 8));
  v_payload := jsonb_build_object(
    'code', v_code, 'by', v_by, 'status', 'POTWIERDZONA',
    'load_date', v_ld, 'delivery_date', v_dd,
    'before_load_date', l.plan_load_date, 'before_delivery_date', l.plan_delivery_date,
    'before_load_from', l.plan_load_from, 'before_load_to', l.plan_load_to,
    'before_delivery_from', l.plan_delivery_from, 'before_delivery_to', l.plan_delivery_to);
  -- P2: admin bez powiadamiania KSH (tylko HHL/SCX z macierzy — usuń odbiorców CLIENT).
  perform matrix_notify('LOAD_STATUS', 'PLAN_DATES_CHANGED', p_load, l.project_id, v_payload,
                        'PLAN_DATES:' || p_load || ':' || v_stamp);
  delete from notifications
   where user_id = v_actor and load_id = p_load and dedup_key like 'PLAN_DATES:' || p_load || ':' || v_stamp || ':%';
  if v_admin then
    delete from notifications n
     using app_users u, organizations o
     where n.user_id = u.id and u.org_id = o.id and o.kind = 'CLIENT'
       and n.load_id = p_load
       and n.dedup_key like 'PLAN_DATES:' || p_load || ':' || v_stamp || ':%';
  end if;

  -- P2: sprawa KSH_DATES_CHECK tylko z importu (A6) albo ze zmiany KSH — nie z edycji admina.
  if v_dates_odd and v_admin is not true then
    perform decision_open_from_event(
      l.project_id,
      'KSH_DATES_CHECK',
      'ksh-dates:' || p_load::text || ':' || v_stamp,
      coalesce(v_code, '—') || ': daty KSH do sprawdzenia',
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
  'G-20 + D-0005: KSH Użytkownik albo HHL_ADMIN; sprawa KSH_DATES_CHECK nie z edycji admina (A6/KSH).';

-- Wyzwalacz historii: przy dates_ctx HHL_ADMIN → by=HHL_ADMIN (nie mylić z KSH)
create or replace function public.trg_plan_dates_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := current_app_user_id();
  v_by text;
  v_payload jsonb;
  v_client uuid;
  v_stamp text := to_char(clock_timestamp(), 'YYYYMMDDHH24MISSUS');
begin
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
    'code', coalesce(new.order_no, left(new.id::text, 8)), 'by', v_by, 'status', new.plan_dates_status,
    'load_date', new.plan_load_date, 'delivery_date', new.plan_delivery_date,
    'before_load_date', old.plan_load_date, 'before_delivery_date', old.plan_delivery_date,
    'before_load_from', old.plan_load_from, 'before_load_to', old.plan_load_to,
    'before_delivery_from', old.plan_delivery_from, 'before_delivery_to', old.plan_delivery_to,
    'load_from', new.plan_load_from, 'load_to', new.plan_load_to,
    'delivery_from', new.plan_delivery_from, 'delivery_to', new.plan_delivery_to)
    || case when v_by in ('KSH', 'HHL_ADMIN') and nullif(current_setting('tower.dates_actor', true), '') is not null
            then jsonb_build_object('actor', current_setting('tower.dates_actor', true)) else '{}'::jsonb end);
  v_payload := jsonb_build_object(
    'code', coalesce(new.order_no, left(new.id::text, 8)), 'by', v_by, 'status', new.plan_dates_status,
    'load_date', new.plan_load_date, 'delivery_date', new.plan_delivery_date,
    'before_load_date', old.plan_load_date, 'before_delivery_date', old.plan_delivery_date,
    'before_load_from', old.plan_load_from, 'before_load_to', old.plan_load_to,
    'before_delivery_from', old.plan_delivery_from, 'before_delivery_to', old.plan_delivery_to);
  -- Powiadomienia dla edycji KSH / HHL_ADMIN idą z ksh_confirm_dates (matrix_notify)
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
  if (new.plan_load_date, new.plan_load_from) is distinct from (old.plan_load_date, old.plan_load_from)
     or old.plan_load_date is null then
    perform l3_ksh_lead(new, old.plan_load_date, old.plan_load_from, now());
  end if;
  return null;
end $$;
revoke all on function public.trg_plan_dates_notify() from public, anon, authenticated;
