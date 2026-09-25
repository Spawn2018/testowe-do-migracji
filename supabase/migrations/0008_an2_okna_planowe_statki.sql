-- =====================================================================
-- TOWER — Migracja 0008: delta Aneksu 2 dla baz, na których 0004 już jest
--
-- Aneks 2 zmienił treść 0004_statusy_automatyczne.sql (okna planowe poza
-- listą przewoźnika; vessels.mmsi / vessels.imo). Baza hostowana miała 0004
-- zastosowaną wcześniej (AN1), więc tę samą zmianę wnosi ta migracja —
-- bez resetu i bez ponownego uruchamiania 0004 (nieidempotentna: create
-- type / create table / cron).
--
-- IDEMPOTENTNA: na świeżej bazie (0004 z Aneksu 2 już zawiera te zmiany)
-- nic nie zmienia — kolumny "if not exists", funkcja identyczna z 0004.
-- Treść guard_load_update() = 1:1 z 0004 (Aneks 2).
-- =====================================================================

alter table vessels add column if not exists mmsi bigint unique;  -- AIS (Digitraffic); ZRODLA_DANYCH.md
alter table vessels add column if not exists imo  int unique;

-- Seed stegra.sql wstawia statki "on conflict do nothing" — na bazie z seedem
-- sprzed Aneksu 2 dane armatora i Nova Star uzupełnia ta aktualizacja
-- (tylko wiersze ze starym operatorem / bez MMSI; idempotentna).
update vessels set operator = 'POLSCA Baltic Ferries (Polferries)'
 where name in ('M/F Wawel', 'M/F Nova Star') and operator = 'Polferries';
update vessels set mmsi = 311000787, imo = 9462067
 where name = 'M/F Nova Star' and mmsi is null and imo is null;

create or replace function guard_load_update() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_changed  text[];
  v_bad      text[];
  v_carrier  text[] := array[
    'tractor_plate','trailer_plate','trailer_type','driver_name','driver_phone',
    'escort_vehicles','telematics_vehicle_id','telematics_provider',
    'ferry_booking_ref','sailing_id','carrier_order_no',
    'combo_length_m','combo_width_m','combo_height_m','combo_weight_t',
    'actual_load_at','actual_delivery_at','status','updated_at'];
  -- Okna planowe (plan_load_*, plan_delivery_*) — decyzja właściciela
  -- 24.09.2026: przewoźnik ich NIE zmienia. Plan pochodzi z harmonogramu KSH.
begin
  -- Realizacja = rozładunek: status UNLOADED bez daty rozładunku jest niemożliwy
  if new.status = 'UNLOADED' and new.actual_delivery_at is null then
    raise exception 'Status UNLOADED wymaga daty rozładunku — to data realizacji usługi';
  end if;

  -- Data rozładunku steruje kursem NBP, opłatą paliwową i tygodniem faktury.
  -- Każda zmiana w dzienniku audytu; po zafakturowaniu — wyłącznie HHL.
  if new.actual_delivery_at is distinct from old.actual_delivery_at then
    if auth.uid() is not null and not is_hhl()
       and exists (select 1 from invoice_lines where load_id = old.id) then
      raise exception 'Data rozładunku transportu na fakturze jest zamrożona — zmiana wyłącznie przez HHL';
    end if;
    insert into audit_log (user_id, action, entity, entity_id, old_value, new_value)
    values ((select id from app_users where auth_id = auth.uid()),
            'LOAD_DELIVERY_DATE_CHANGE', 'loads', old.id::text,
            jsonb_build_object('actual_delivery_at', old.actual_delivery_at),
            jsonb_build_object('actual_delivery_at', new.actual_delivery_at));
  end if;

  if auth.uid() is null then return new; end if;   -- zadania systemowe, automat statusów

  select coalesce(array_agg(n.key), '{}') into v_changed
    from jsonb_each(to_jsonb(new)) n
   where n.value is distinct from (to_jsonb(old) -> n.key);

  if is_hhl() then
    -- W12: każda strona wpisuje SWÓJ numer zlecenia
    if new.carrier_order_no is distinct from old.carrier_order_no then
      raise exception 'Numer zlecenia przewoźnika wpisuje wyłącznie przewoźnik';
    end if;
    return new;
  end if;

  if current_org_kind() = 'CARRIER' and old.carrier_org_id = current_org_id() then
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

