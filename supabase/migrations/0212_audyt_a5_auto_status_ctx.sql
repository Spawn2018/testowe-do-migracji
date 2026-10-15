-- TOWER — 0212: A5 (D-20261015-0300-01) — automat i anulowanie ustawiają tower.status_ctx.
-- Bez tego geofence (auto_set_status), cancel_load, import i driver_post_event
-- wywołane przy sesji użytkownika padały na guardzie z 0210.
-- Guard: cancel_ctx MANUAL/IMPORT też przepuszcza zmianę statusu (import_schedule z 0204).

CREATE OR REPLACE FUNCTION public.guard_load_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  if current_setting('tower.dates_ctx', true) = 'on' then
    select coalesce(array_agg(n.key), '{}') into v_changed
      from jsonb_each(to_jsonb(new)) n
     where n.value is distinct from (to_jsonb(old) -> n.key);
    if (v_changed <@ array['plan_load_date','plan_load_from','plan_load_to','plan_delivery_date','plan_delivery_from','plan_delivery_to',
                           'plan_dates_status','plan_dates_confirmed_by','plan_dates_confirmed_at','updated_at']::text[]) is not true then
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
end $function$;

create or replace function public.auto_set_status(
  p_load uuid,
  p_from load_status,
  p_to load_status,
  p_reason text,
  p_ts timestamp with time zone,
  p_detail jsonb
) returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  begin
    perform set_config('tower.status_ctx', 'on', true);
    update loads set status = p_to where id = p_load and status = p_from;
    if not found then return false; end if;
  exception when others then
    perform raise_risk(p_load, 'AUTO_STATUS', 'HIGH',
      format('Automatyczna zmiana statusu %s → %s zablokowana: %s', p_from, p_to, sqlerrm),
      coalesce(p_detail, '{}'::jsonb) || jsonb_build_object('from', p_from, 'to', p_to, 'blad', sqlerrm,
        'title_key', 'rk_auto_status_blocked', 'params', jsonb_build_object('from', p_from, 'to', p_to, 'error', sqlerrm)),
      'AUTOSTATUS:' || p_load || ':' || p_to);
    return false;
  end;
  insert into load_events (load_id, event_type, occurred_at, payload, dedup_key)
  values (p_load, 'STATUS_AUTO', p_ts,
          coalesce(p_detail, '{}'::jsonb) || jsonb_build_object('from', p_from, 'to', p_to, 'powod', p_reason),
          'STATUS_AUTO:' || p_load || ':' || p_to)
  on conflict (dedup_key) where dedup_key is not null do nothing;
  return true;
end $function$;

create or replace function public.cancel_load(p_load_id uuid, p_reason text)
returns load_status
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_old load_status;
begin
  if is_hhl() is not true then raise exception 'Anulować transport może wyłącznie HHL'; end if;
  if p_reason is null or length(btrim(p_reason)) < 3 then
    raise exception 'Anulowanie wymaga powodu';
  end if;
  select l.status into v_old from loads l where l.id = p_load_id for update;
  if not found then raise exception 'Nieznany transport'; end if;
  if v_old = 'CANCELLED' then return v_old; end if;
  perform set_config('tower.cancel_ctx', 'MANUAL', true);
  perform set_config('tower.status_ctx', 'on', true);
  update loads set status = 'CANCELLED', updated_at = now() where id = p_load_id;
  perform set_config('tower.cancel_ctx', '', true);
  insert into audit_log (user_id, action, entity, entity_id, old_value, new_value)
  values ((select id from app_users where auth_id = auth.uid()), 'LOAD_CANCEL_MANUAL', 'loads', p_load_id::text,
          jsonb_build_object('status', v_old), jsonb_build_object('status', 'CANCELLED', 'reason', btrim(p_reason)));
  return 'CANCELLED';
end $function$;

create or replace function public.import_cancel_loads(
  p_load_ids uuid[],
  p_reason text default 'Usunięty z harmonogramu (import)'::text
)
returns table(load_id uuid, order_no text, status load_status, verdict text, reason text)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare r record; v_user uuid;
begin
  if is_hhl() is not true then raise exception 'Import harmonogramu wyłącznie HHL'; end if;
  select id into v_user from app_users where auth_id = auth.uid();
  for r in select * from import_removal_check(p_load_ids) loop
    if r.verdict = 'CANCEL' then
      perform set_config('tower.cancel_ctx', 'IMPORT', true);
      perform set_config('tower.status_ctx', 'on', true);
      update loads set status = 'CANCELLED', updated_at = now() where id = r.load_id;
      perform set_config('tower.cancel_ctx', '', true);
      insert into audit_log (user_id, action, entity, entity_id, old_value, new_value)
      values (v_user, 'LOAD_CANCEL_IMPORT', 'loads', r.load_id::text,
              jsonb_build_object('status', r.status),
              jsonb_build_object('status', 'CANCELLED', 'reason', p_reason));
      load_id := r.load_id; order_no := r.order_no; status := 'CANCELLED'; verdict := 'CANCELLED'; reason := p_reason;
    else
      load_id := r.load_id; order_no := r.order_no; status := r.status; verdict := r.verdict; reason := r.reason;
    end if;
    return next;
  end loop;
end $function$;

create or replace function public.driver_post_event(
  p_token      text,
  p_load_id    uuid,
  p_event_type text,
  p_ts         timestamptz default now(),
  p_note       text default null
) returns text
language plpgsql security definer set search_path = public as $$
declare v_load uuid; v_status load_status;
begin
  v_load := driver_token_load(p_token);
  if v_load is distinct from p_load_id then
    raise exception 'Token kierowcy nie dotyczy tego transportu';
  end if;
  if p_event_type not in ('MILESTONE_LOADED', 'DRIVER_ON_FERRY', 'DRIVER_PROBLEM', 'MILESTONE_UNLOADED') then
    raise exception 'Niedozwolone zdarzenie kierowcy: %', p_event_type;
  end if;
  if p_ts is null or p_ts > now() + interval '5 minutes' then
    raise exception 'Czas zdarzenia z przyszłości';
  end if;
  insert into load_events (load_id, event_type, occurred_at, source, payload)
  values (v_load, p_event_type, p_ts, 'DRIVER_PWA',
          jsonb_build_object('via', 'driver_token') || case when p_note is null then '{}'::jsonb
                                                        else jsonb_build_object('note', left(p_note, 500)) end);
  if p_event_type = 'MILESTONE_UNLOADED' then
    select status into v_status from loads where id = v_load;
    if v_status >= 'AT_LOADING' and v_status < 'UNLOADED' then
      perform set_config('tower.status_ctx', 'on', true);
      update loads set status = 'UNLOADED', actual_delivery_at = p_ts, updated_at = now() where id = v_load;
    end if;
  end if;
  return p_event_type;
end $$;
