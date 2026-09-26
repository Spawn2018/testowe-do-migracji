-- =====================================================================
-- TOWER — Migracja 0019: ANEKS 3 §2.1 — import nie kasuje transportów
--
--   1. Zakaz DELETE na loads dla ról API (anon, authenticated, service_role):
--      odebrane uprawnienie + wyzwalacz (druga linia obrony). Polityka
--      loads_write_hhl („for all" = także DELETE) zastąpiona insert + update.
--   2. Usunięcie przez import = anulowanie (status CANCELLED), wiersz zostaje.
--      import_cancel_loads(): wyłącznie PLANNED, RESOURCES_PENDING, DOCS_PENDING,
--      READY; transport na jakiejkolwiek fakturze — zablokowany niezależnie
--      od statusu. import_removal_check(): ten sam werdykt bez zmian (podgląd).
--   3. cancel_load(): HHL ręcznie, z powodem, wpis w audit_log (także w drodze).
--   4. guard_load_update(): przejście do CANCELLED tylko przez (2) albo (3);
--      ciało = 0008 + blok anulowania.
--   Idempotentna, niedestrukcyjna.
-- =====================================================================

-- 1. DELETE
revoke delete on loads from anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'revoke delete on loads from service_role';
  end if;
end $$;

create or replace function forbid_load_delete() returns trigger
language plpgsql as $$
begin
  if current_user in ('anon', 'authenticated', 'service_role') then
    raise exception 'Transportu nie można skasować — anuluj go (status CANCELLED)';
  end if;
  return old;
end $$;
drop trigger if exists loads_no_delete on loads;
create trigger loads_no_delete before delete on loads
  for each row execute function forbid_load_delete();

drop policy if exists loads_write_hhl on loads;
drop policy if exists loads_insert_hhl on loads;
drop policy if exists loads_update_hhl on loads;
create policy loads_insert_hhl on loads for insert to authenticated with check (is_hhl());
create policy loads_update_hhl on loads for update to authenticated using (is_hhl()) with check (is_hhl());

-- 4. Wyzwalacz
create or replace function guard_load_update() returns trigger
language plpgsql security definer set search_path = public as $$
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
  -- Okna planowe (plan_load_*, plan_delivery_*) — decyzja właściciela
  -- 24.09.2026: przewoźnik ich NIE zmienia. Plan pochodzi z harmonogramu KSH.
begin
  -- ANEKS 3 §2.1: anulowanie wyłącznie przez import (warunki) albo ręcznie przez HHL z powodem
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
      null;  -- cancel_load(): HHL + powód + wpis w audit_log
    elsif auth.uid() is not null then
      raise exception 'Anulować transport może wyłącznie HHL — przez cancel_load() z powodem albo import harmonogramu';
    end if;
  end if;

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

-- 2. Import: werdykt (podgląd) i anulowanie
create or replace function import_removal_check(p_load_ids uuid[])
returns table (load_id uuid, order_no text, status load_status, verdict text, reason text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_hhl() then raise exception 'Import harmonogramu wyłącznie HHL'; end if;
  return query
    select l.id, l.order_no, l.status,
           case when l.status = 'CANCELLED' then 'ALREADY'
                when exists (select 1 from invoice_lines il where il.load_id = l.id) then 'BLOCKED_INVOICED'
                when l.status not in ('PLANNED','RESOURCES_PENDING','DOCS_PENDING','READY') then 'BLOCKED_STATUS'
                else 'CANCEL' end,
           case when l.status = 'CANCELLED' then 'Już anulowany'
                when exists (select 1 from invoice_lines il where il.load_id = l.id) then 'Transport jest na fakturze'
                when l.status not in ('PLANNED','RESOURCES_PENDING','DOCS_PENDING','READY')
                  then 'Transport od wjazdu na załadunek — anuluje wyłącznie HHL ręcznie, z powodem'
                else 'Zostanie anulowany (wiersz zostaje)' end
      from loads l
     where l.id = any (p_load_ids);
end $$;

create or replace function import_cancel_loads(p_load_ids uuid[], p_reason text default 'Usunięty z harmonogramu (import)')
returns table (load_id uuid, order_no text, status load_status, verdict text, reason text)
language plpgsql security definer set search_path = public as $$
declare r record; v_user uuid;
begin
  if not is_hhl() then raise exception 'Import harmonogramu wyłącznie HHL'; end if;
  select id into v_user from app_users where auth_id = auth.uid();
  for r in select * from import_removal_check(p_load_ids) loop
    if r.verdict = 'CANCEL' then
      perform set_config('tower.cancel_ctx', 'IMPORT', true);
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
end $$;

-- 3. Ręczne anulowanie przez HHL
create or replace function cancel_load(p_load_id uuid, p_reason text)
returns load_status language plpgsql security definer set search_path = public as $$
declare v_old load_status;
begin
  if not is_hhl() then raise exception 'Anulować transport może wyłącznie HHL'; end if;
  if p_reason is null or length(btrim(p_reason)) < 3 then
    raise exception 'Anulowanie wymaga powodu';
  end if;
  select l.status into v_old from loads l where l.id = p_load_id for update;
  if not found then raise exception 'Nieznany transport'; end if;
  if v_old = 'CANCELLED' then return v_old; end if;
  perform set_config('tower.cancel_ctx', 'MANUAL', true);
  update loads set status = 'CANCELLED', updated_at = now() where id = p_load_id;
  perform set_config('tower.cancel_ctx', '', true);
  insert into audit_log (user_id, action, entity, entity_id, old_value, new_value)
  values ((select id from app_users where auth_id = auth.uid()), 'LOAD_CANCEL_MANUAL', 'loads', p_load_id::text,
          jsonb_build_object('status', v_old), jsonb_build_object('status', 'CANCELLED', 'reason', btrim(p_reason)));
  return 'CANCELLED';
end $$;

revoke execute on function import_removal_check(uuid[]) from public, anon;
revoke execute on function import_cancel_loads(uuid[], text) from public, anon;
revoke execute on function cancel_load(uuid, text) from public, anon;
grant execute on function import_removal_check(uuid[]) to authenticated;
grant execute on function import_cancel_loads(uuid[], text) to authenticated;
grant execute on function cancel_load(uuid, text) to authenticated;
