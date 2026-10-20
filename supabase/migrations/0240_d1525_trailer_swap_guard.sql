-- 0240 — D-20261020-1525-01 (#364): HOTFIX guard_load_update —
-- biała lista przewoźnika: trailer_swap + pola SE / telefon;
-- HHL_ADMIN może carrier_order_no (HHL_OPS nadal nie).
-- Bazuje na 0237 (ostatnia redefinicja). Część 2 (NO_AWIZ_SE) — ten sam dopisek / #362.

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
    'driver_phone_country',
    'driver_delivery_name','driver_delivery_phone','driver_delivery_phone_country',
    'tractor_delivery_plate','trailer_swap',
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

  if auth.uid() is null then return new; end if;

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
    /* D-1525: HHL_ADMIN awizuje jak SCX — może Nr zlecenia SCX; HHL_OPS nie. */
    if new.carrier_order_no is distinct from old.carrier_order_no
       and current_app_role() is distinct from 'HHL_ADMIN' then
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
        /* Edycja faktury: usunięcie pozycji wraca INVOICED → READY_TO_INVOICE. */
        if current_setting('tower.invoice_edit', true) = 'on'
           and old.status = 'INVOICED'
           and new.status = 'READY_TO_INVOICE' then
          null;
        else
          raise exception 'Status nie może się cofnąć: % → %', old.status, new.status;
        end if;
      end if;
    end if;
    if new.sailing_id is distinct from old.sailing_id and old.status >= 'FERRY' then
      raise exception 'Zmiana rejsu po wypłynięciu — wyłącznie HHL';
    end if;
    return new;
  end if;

  raise exception 'Brak uprawnień do zmiany transportu';
end $$;

comment on function public.guard_load_update() is
  'D-1525 / 0240: SCX — trailer_swap + SE; HHL_ADMIN — carrier_order_no; reszta jak 0237.';
