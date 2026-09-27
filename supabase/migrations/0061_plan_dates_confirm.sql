-- 0061 — I-18 (D-12): status daty planu WSTĘPNA | POTWIERDZONA. Ostateczne daty załadunku i rozładunku podaje KSH.
--   loads.plan_dates_status / plan_dates_confirmed_by / plan_dates_confirmed_at;
--   ksh_confirm_dates(...) — KSH (organizacja klienta projektu) potwierdza daty, może je przy tym zmienić; do wjazdu na załadunek;
--   zmiana daty POTWIERDZONEJ (przez kogokolwiek) = zdarzenie PLAN_DATES_CHANGED + powiadomienie (w aplikacji i e-mail) HHL,
--     przewoźnika i KSH — bez autora zmiany; zmiana przez HHL/import cofa status do WSTĘPNA (KSH potwierdza ponownie);
--   import_schedule: daty potwierdzonej NIE nadpisuje bez zgody (p_file.overwrite_confirmed — kody); wynik 'confirmed';
--   app_parameters.DATE_CONFIRM_DAYS (N, domyślnie 5 — do uzgodnienia) + detect_unconfirmed_dates() (cron co godzinę):
--     transport przed załadunkiem, data WSTĘPNA, załadunek za ≤ N dni → ryzyko DATES_UNCONFIRMED (HHL + KSH);
--   ANEKS 2 bez zmian: przewoźnik nadal nie zmienia okien KSH (guard_load_update).
-- Idempotentna, niedestrukcyjna (istniejące transporty: WSTĘPNA).

alter type risk_kind add value if not exists 'DATES_UNCONFIRMED';

alter table loads add column if not exists plan_dates_status text not null default 'WSTEPNA';
alter table loads add column if not exists plan_dates_confirmed_by uuid references app_users(id);
alter table loads add column if not exists plan_dates_confirmed_at timestamptz;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'loads_plan_dates_status_chk') then
    alter table loads add constraint loads_plan_dates_status_chk check (plan_dates_status in ('WSTEPNA', 'POTWIERDZONA'));
  end if;
end $$;

-- nowe typy zdarzeń systemowych (tylko funkcje; polityka insert dla API bez zmian — 0032)
alter table public.load_events drop constraint if exists load_events_event_type_known;
alter table public.load_events add constraint load_events_event_type_known check (event_type in (
    'NOTE', 'DOC_UPLOADED', 'PERMIT_MISMATCH', 'AWIZACJA_UPDATED', 'RESOURCES_UPDATED', 'ORDER_NO_UPDATED',
    'FERRY_UPDATED', 'SAILING_ASSIGNED', 'SCX_ASSIGNED', 'PLAN_B_ACTIVATED', 'READY_BLOCKED',
    'SCHEDULE_IMPORTED', 'SCHEDULE_DATE_CRITICAL', 'STATUS_APPROACHING_SITE', 'STATUS_AT_LOADING',
    'STATUS_AT_PORT', 'STATUS_AT_PORT_GDANSK', 'STATUS_AT_PORT_NYNASHAMN', 'STATUS_AT_SITE',
    'STATUS_CANCELLED', 'STATUS_DELAYED', 'STATUS_DELIVERED', 'STATUS_DOCS_PENDING', 'STATUS_DOC_MISSING',
    'STATUS_FERRY', 'STATUS_IN_TRANSIT_PL', 'STATUS_IN_TRANSIT_SE', 'STATUS_LOADING', 'STATUS_ON_FERRY',
    'STATUS_PLANNED', 'STATUS_READY', 'STATUS_RESOURCES_PENDING', 'STATUS_SILENT', 'STATUS_UNLOADED',
    'STATUS_UNLOADING', 'MILESTONE_LOADED', 'MILESTONE_UNLOADED', 'DRIVER_ON_FERRY', 'DRIVER_PROBLEM',
    'GEOFENCE_ENTER', 'GEOFENCE_EXIT', 'GEOFENCE_DWELL', 'STATUS_AUTO', 'POSITION_SHARED',
    'POSITION_SHARE_DENIED', 'DELAY_DETECTED', 'RISK_RAISED', 'SILENT_VEHICLE',
    'PLAN_DATES_CONFIRMED', 'PLAN_DATES_CHANGED'
));

create table if not exists app_parameters (
  key        text primary key,
  value      numeric not null,
  label      text not null,
  source     text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references app_users(id)
);
alter table app_parameters enable row level security;
revoke all on app_parameters from anon, authenticated;
grant select on app_parameters to authenticated;
drop policy if exists app_parameters_read on app_parameters;
create policy app_parameters_read on app_parameters for select to authenticated using (current_app_user_id() is not null);
insert into app_parameters (key, value, label, source) values
  ('DATE_CONFIRM_DAYS', 5, 'Potwierdzenie dat przez KSH — najpóźniej N dni przed załadunkiem', 'D-12 (27.09): termin do uzgodnienia, domyślnie 5 dni')
on conflict (key) do nothing;

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
  -- Okna planowe (plan_load_*, plan_delivery_*) — decyzja właściciela
  -- 24.09.2026: przewoźnik ich NIE zmienia. Plan pochodzi z harmonogramu KSH.
begin
  -- I-2d (0051): przeliczenie ETA (refresh_load_eta, kontekst tower.eta_ctx) zmienia WYŁĄCZNIE kolumny eta_* (+ delay_minutes = ETA vs koniec okna planu)
  if current_setting('tower.eta_ctx', true) = 'on' then
    select coalesce(array_agg(n.key), '{}') into v_changed
      from jsonb_each(to_jsonb(new)) n
     where n.value is distinct from (to_jsonb(old) -> n.key);
    if (v_changed <@ array['eta_site','eta_confidence_min','eta_basis','eta_computed_at','delay_minutes','updated_at']::text[]) is not true then
      raise exception 'Przeliczenie ETA może zmienić wyłącznie kolumny eta_* (zmienione: %)', array_to_string(v_changed, ', ');
    end if;
    return new;
  end if;

  -- I-18 (0061): potwierdzenie dat przez KSH (ksh_confirm_dates, kontekst tower.dates_ctx) — WYŁĄCZNIE daty planu i ich status
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
  -- I-18: status dat (WSTĘPNA/POTWIERDZONA) ustawia wyłącznie potwierdzenie KSH albo automat (zmiana daty → WSTĘPNA)
  if auth.uid() is not null and (new.plan_dates_status, new.plan_dates_confirmed_by, new.plan_dates_confirmed_at)
       is distinct from (old.plan_dates_status, old.plan_dates_confirmed_by, old.plan_dates_confirmed_at) then
    raise exception 'Status dat planu zmienia wyłącznie potwierdzenie KSH („Potwierdź daty”)';
  end if;

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

  if auth.uid() is null then return new; end if;   -- zadania systemowe, automat statusów

  select coalesce(array_agg(n.key), '{}') into v_changed
    from jsonb_each(to_jsonb(new)) n
   where n.value is distinct from (to_jsonb(old) -> n.key);

  if is_hhl() is true then
    -- W12: każda strona wpisuje SWÓJ numer zlecenia
    if new.carrier_order_no is distinct from old.carrier_order_no then
      raise exception 'Numer zlecenia przewoźnika wpisuje wyłącznie przewoźnik';
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

CREATE OR REPLACE FUNCTION public.risk_audience_for(p_kind text, p_detail jsonb)
 RETURNS risk_audience
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_dir text; v_inv text;
begin
  -- 0049: zalogowany bez aktywnego konta (nieaktywny / bez app_users) — odmowa; anon i zadania systemowe bez zmian
  if auth.uid() is not null and current_app_user_id() is null then
    raise exception 'Brak aktywnego konta' using errcode = '42501';
  end if;
  if p_kind in ('FERRY', 'ROAD_SE', 'ROAD_PL', 'WEATHER', 'ETA_BREACH') then
    return 'WSZYSCY';
  end if;
  if p_kind = 'RESOURCE_MISSING' and coalesce(p_detail->>'rule', '') = 'ORDER_NO'
     and coalesce(p_detail->>'side', '') = 'HHL' then
    return 'HHL';                       -- §2.4: numer HHL — sprawa wyłącznie HHL
  end if;
  if p_kind in ('SILENT_VEHICLE', 'AUTO_STATUS', 'LOADING_UNCONFIRMED', 'RESOURCE_MISSING',
                'DOC_MISSING', 'PERMIT', 'INSURANCE') then
    return 'HHL_PRZEWOZNIK';
  end if;
  if p_kind in ('SEQUENCE', 'DATES_UNCONFIRMED') then
    return 'HHL_KLIENT';
  end if;
  if p_kind = 'INVOICE_MISMATCH' then
    v_dir := upper(coalesce(p_detail->>'direction', ''));
    v_inv := p_detail->>'invoice_id';
    if v_dir = '' and v_inv ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      select i.direction::text into v_dir from invoices i where i.id = v_inv::uuid;
    end if;
    return case coalesce(v_dir, '')
             when 'KOSZT' then 'HHL_PRZEWOZNIK'
             when 'PRZYCHOD' then 'HHL_KLIENT'
             else 'HHL' end;
  end if;
  return 'HHL';                         -- zamknięte drzwi: rodzaj nieprzypisany widzi tylko HHL
end $function$;

CREATE OR REPLACE FUNCTION public.import_schedule(p_project uuid, p_rows jsonb, p_cancel_codes text[] DEFAULT '{}'::text[], p_file jsonb DEFAULT '{}'::jsonb, p_dry_run boolean DEFAULT true)
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
  v_fnames    text[] := array['item_type','cargo_class','length_m','width_m','height_m','unit_weight_t','qty','total_weight_t',
                              'load_date','load_time','delivery_date','delivery_time','order_no','assembly_seq'];
begin
  -- is_hhl() zwraca NULL dla konta nieaktywnego / bez wiersza app_users — NULL nie może przepuścić
  if is_hhl() is not true then raise exception 'Import harmonogramu wyłącznie HHL'; end if;
  if not exists (select 1 from projects where id = p_project) then raise exception 'Nieznany projekt'; end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then raise exception 'Wiersze importu: oczekiwana tablica'; end if;
  perform pg_advisory_xact_lock(hashtext('import_schedule:' || p_project::text));
  select id into v_user from app_users where auth_id = auth.uid();

  -- przewoźnik nowych transportów: jedyny przewoźnik w systemie (inaczej HHL przypisuje ręcznie)
  select case when count(*) = 1 then min(id::text)::uuid end, case when count(*) = 1 then min(name) end
    into v_carrier, v_carrier_n from organizations where kind = 'CARRIER';

  -- walidacja wejścia (druga linia za parserem w przeglądarce): błąd = cała transakcja wycofana
  create temp table if not exists _imp (code text primary key, row jsonb not null) on commit drop;
  truncate _imp;
  for r in select value as v, ordinality as i from jsonb_array_elements(p_rows) with ordinality loop
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

  -- I-18: kody, dla których HHL świadomie nadpisuje daty POTWIERDZONE przez KSH (osobne ostrzeżenie + zgoda w interfejsie)
  v_over := array(select jsonb_array_elements_text(coalesce(p_file->'overwrite_confirmed', '[]'::jsonb)));

  -- wersja (tylko przy zapisie; nadawana dopiero, gdy są zmiany)
  if p_dry_run is false then
    select coalesce(max(version), 0) + 1 into v_version from schedule_imports where project_id = p_project;
  end if;

  -- nowe i zmienione
  for r in
    select i.code, i.row as inc, si.id as item_id, si.load_id, l.status, l.carrier_org_id,
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
    if r.item_id is null or r.load_id is null then
      v_added := v_added || jsonb_build_object('code', r.code);
      if p_dry_run is false then
        if v_import is null then
          insert into schedule_imports (project_id, version, source, file_path, file_hash, file_name, column_map, stats, imported_by)
          values (p_project, v_version, 'UPLOAD', p_file->>'path', p_file->>'hash', p_file->>'name',
                  coalesce(p_file->'column_map', '{}'::jsonb), '{}'::jsonb, v_user)
          returning id into v_import;
        end if;
        insert into loads (project_id, order_no, carrier_org_id, status, plan_load_date, plan_delivery_date)
        values (p_project, r.inc->>'order_no', v_carrier, 'PLANNED',
                (r.inc->>'load_date')::date, (r.inc->>'delivery_date')::date)
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
                jsonb_build_object('action', 'ADDED', 'code', r.code, 'version', v_version, 'file', p_file->>'name'));
      end if;
      continue;
    end if;

    select coalesce(array_agg(f order by f), '{}') into v_fields
      from unnest(v_fnames) f where coalesce(r.inc -> f, 'null'::jsonb) is distinct from coalesce(r.prev -> f, 'null'::jsonb);
    if cardinality(v_fields) = 0 then v_unchanged := v_unchanged + 1; continue; end if;

    if r.status = 'CANCELLED' then
      v_blocked := v_blocked || jsonb_build_object('code', r.code, 'load_id', r.load_id, 'reason', 'CANCELLED',
                     'message', 'Transport anulowany — przywrócenie wyłącznie ręcznie przez HHL');
      continue;
    end if;

    -- I-18: data potwierdzona przez KSH — bez zgody (overwrite_confirmed) import jej NIE nadpisuje
    v_keep := false;
    if r.confirmed and ('load_date' = any (v_fields) or 'delivery_date' = any (v_fields)) then
      v_keep := not (r.code = any (v_over));
      v_confirmed := v_confirmed || jsonb_build_object('code', r.code, 'load_id', r.load_id,
                       'before', jsonb_build_object('load_date', r.prev->'load_date', 'delivery_date', r.prev->'delivery_date'),
                       'after', jsonb_build_object('load_date', r.inc->'load_date', 'delivery_date', r.inc->'delivery_date'),
                       'overwrite', not v_keep);
    end if;

    v_crit := case when r.awizowany and not v_keep then
      array(select f from unnest(v_fields) f where f in ('load_date','load_time','delivery_date','delivery_time')) else '{}' end;
    v_changed := v_changed || jsonb_build_object('code', r.code, 'load_id', r.load_id, 'fields', to_jsonb(v_fields),
                   'before', (select jsonb_object_agg(f, r.prev -> f) from unnest(v_fields) f),
                   'after',  (select jsonb_object_agg(f, r.inc -> f) from unnest(v_fields) f),
                   'critical', cardinality(v_crit) > 0);
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
        schedule_row = case when v_keep then r.inc || jsonb_build_object('load_date', r.prev->'load_date', 'delivery_date', r.prev->'delivery_date')
                            else r.inc end,
        last_seen_import = v_import, updated_at = now()
       where id = r.item_id;
      if v_keep then
        if 'order_no' = any (v_fields) then
          update loads set order_no = r.inc->>'order_no', updated_at = now() where id = r.load_id;
        end if;
      elsif 'load_date' = any (v_fields) or 'delivery_date' = any (v_fields) or 'order_no' = any (v_fields) then
        update loads set plan_load_date = (r.inc->>'load_date')::date, plan_delivery_date = (r.inc->>'delivery_date')::date,
                         order_no = r.inc->>'order_no', updated_at = now()
         where id = r.load_id;
      end if;
      insert into load_events (load_id, event_type, occurred_at, actor_id, payload)
      values (r.load_id, 'SCHEDULE_IMPORTED', now(), v_user,
              jsonb_build_object('action', 'CHANGED', 'code', r.code, 'version', v_version, 'fields', to_jsonb(v_fields),
                                 'before', (select jsonb_object_agg(f, r.prev -> f) from unnest(v_fields) f),
                                 'after',  (select jsonb_object_agg(f, r.inc -> f) from unnest(v_fields) f)));
      if cardinality(v_crit) > 0 then
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
         and not exists (select 1 from _imp i where i.code = si.shipment_code)
       order by si.shipment_code
    loop
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
                  jsonb_build_object('code', c.code, 'version', v_version, 'reason', 'Usunięty z harmonogramu', 'file', p_file->>'name'));
          v_cancelled := v_cancelled || jsonb_build_object('code', c.code, 'load_id', c.load_id);
        end if;
      end if;
    end loop;
  end if;

  if v_import is not null then
    update schedule_imports set stats = jsonb_build_object(
        'added', jsonb_array_length(v_added), 'changed', jsonb_array_length(v_changed),
        'unchanged', v_unchanged, 'cancelled', jsonb_array_length(v_cancelled),
        'blocked', jsonb_array_length(v_blocked), 'critical', jsonb_array_length(v_critical),
        'confirmed_kept', (select count(*) from jsonb_array_elements(v_confirmed) x where not (x->>'overwrite')::boolean),
        'rows', jsonb_array_length(p_rows), 'rejected', coalesce((p_file->>'rejected')::int, 0))
     where id = v_import;
  end if;

  return jsonb_build_object(
    'dry_run', p_dry_run,
    'version', case when v_import is not null then v_version end,
    'import_id', v_import,
    'rows', jsonb_array_length(p_rows),
    'added', v_added, 'changed', v_changed, 'unchanged', v_unchanged,
    'cancel_candidates', v_cands, 'blocked', v_blocked, 'cancelled', v_cancelled, 'critical', v_critical, 'confirmed', v_confirmed,
    'carrier', v_carrier_n,
    'ms', round(extract(epoch from clock_timestamp() - t0) * 1000));
end $function$;


-- zmiana daty: WSTĘPNA po zmianie przez HHL/import (poza potwierdzeniem KSH)
create or replace function public.trg_plan_dates_before() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if current_setting('tower.dates_ctx', true) = 'on' then return new; end if;
  if old.plan_dates_status = 'POTWIERDZONA'
     and (new.plan_load_date, new.plan_load_from, new.plan_load_to, new.plan_delivery_date, new.plan_delivery_from, new.plan_delivery_to)
         is distinct from (old.plan_load_date, old.plan_load_from, old.plan_load_to, old.plan_delivery_date, old.plan_delivery_from, old.plan_delivery_to) then
    new.plan_dates_status := 'WSTEPNA'; new.plan_dates_confirmed_by := null; new.plan_dates_confirmed_at := null;
  end if;
  return new;
end $$;
revoke all on function public.trg_plan_dates_before() from public, anon, authenticated;
drop trigger if exists trg_loads_plan_dates on loads;
create trigger trg_loads_plan_dates before update of plan_load_date, plan_load_from, plan_load_to, plan_delivery_date, plan_delivery_from, plan_delivery_to on loads
  for each row execute function public.trg_plan_dates_before();

-- zmiana daty POTWIERDZONEJ: zdarzenie + powiadomienia (HHL, przewoźnik, KSH — bez autora)
create or replace function public.trg_plan_dates_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_actor uuid := current_app_user_id(); v_by text; v_payload jsonb; v_client uuid; v_stamp text := to_char(clock_timestamp(), 'YYYYMMDDHH24MISSUS');
begin
  if old.plan_dates_status is distinct from 'POTWIERDZONA' then return null; end if;
  if (new.plan_load_date, new.plan_load_from, new.plan_load_to, new.plan_delivery_date, new.plan_delivery_from, new.plan_delivery_to)
     is not distinct from (old.plan_load_date, old.plan_load_from, old.plan_load_to, old.plan_delivery_date, old.plan_delivery_from, old.plan_delivery_to) then
    return null;
  end if;
  v_by := case when current_setting('tower.dates_ctx', true) = 'on' then 'KSH' when auth.uid() is null then 'SYSTEM' else 'HHL' end;
  select client_org_id into v_client from projects where id = new.project_id;
  v_payload := jsonb_build_object('code', coalesce(new.order_no, left(new.id::text, 8)), 'by', v_by, 'status', new.plan_dates_status,
    'load_date', new.plan_load_date, 'delivery_date', new.plan_delivery_date,
    'before_load_date', old.plan_load_date, 'before_delivery_date', old.plan_delivery_date,
    'load_from', new.plan_load_from, 'load_to', new.plan_load_to, 'delivery_from', new.plan_delivery_from, 'delivery_to', new.plan_delivery_to);
  insert into load_events (load_id, event_type, occurred_at, actor_id, payload)
  values (new.id, 'PLAN_DATES_CHANGED', now(), v_actor, v_payload);
  insert into notifications (channel, recipient, user_id, load_id, template, payload, dedup_key)
  select 'IN_APP', coalesce(u.email::text, u.id::text), u.id, new.id, 'PLAN_DATES_CHANGED', v_payload || jsonb_build_object('locale', u.locale),
         'PLAN_DATES:' || new.id || ':' || v_stamp || ':' || u.id
    from app_users u join organizations o on o.id = u.org_id
   where u.active and u.id is distinct from v_actor
     and (o.kind = 'FORWARDER' or (new.carrier_org_id is not null and u.org_id = new.carrier_org_id) or (v_client is not null and u.org_id = v_client))
  on conflict (dedup_key) where dedup_key is not null do nothing;
  return null;
end $$;
revoke all on function public.trg_plan_dates_notify() from public, anon, authenticated;
drop trigger if exists trg_loads_plan_dates_notify on loads;
create trigger trg_loads_plan_dates_notify after update of plan_load_date, plan_load_from, plan_load_to, plan_delivery_date, plan_delivery_from, plan_delivery_to on loads
  for each row execute function public.trg_plan_dates_notify();

-- e-mail (I-10) także dla zmiany daty potwierdzonej
drop trigger if exists notifications_schedule_critical_email on public.notifications;
create trigger notifications_schedule_critical_email after insert on public.notifications
  for each row when (new.channel = 'IN_APP' and new.template in ('SCHEDULE_DATE_CRITICAL', 'PLAN_DATES_CHANGED'))
  execute function public.notify_schedule_critical_email();

-- KSH: „Potwierdź daty” (z możliwością zmiany). NULL = bez zmiany danego pola.
create or replace function public.ksh_confirm_dates(p_load uuid, p_load_date date default null, p_delivery_date date default null,
  p_load_from timestamptz default null, p_load_to timestamptz default null,
  p_delivery_from timestamptz default null, p_delivery_to timestamptz default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare l loads%rowtype; v_client uuid; v_ld date; v_dd date; v_changed boolean; v_prev text;
begin
  if (current_app_user_id() is not null) is not true then
    raise exception 'Brak aktywnego konta' using errcode = '42501';
  end if;
  if (current_org_kind() = 'CLIENT') is not true then
    raise exception 'Daty potwierdza wyłącznie KSH (zamawiający)' using errcode = '42501';
  end if;
  select * into l from loads where id = p_load for update;
  if not found then raise exception 'Transport nie istnieje' using errcode = '42501'; end if;
  select client_org_id into v_client from projects where id = l.project_id;
  if (v_client = current_org_id()) is not true then
    raise exception 'Daty potwierdza wyłącznie KSH (zamawiający)' using errcode = '42501';
  end if;
  if (l.status in ('PLANNED','RESOURCES_PENDING','DOCS_PENDING','READY')) is not true then
    raise exception 'Po wjeździe na załadunek (albo po anulowaniu) daty zmienia wyłącznie HHL' using errcode = '42501';
  end if;
  v_ld := coalesce(p_load_date, l.plan_load_date); v_dd := coalesce(p_delivery_date, l.plan_delivery_date);
  if (v_ld is not null and v_dd is not null) is not true then
    raise exception 'Brak daty załadunku albo dostawy' using errcode = '22023';
  end if;
  if (v_dd >= v_ld) is not true then
    raise exception 'Data dostawy przed datą załadunku' using errcode = '22023';
  end if;
  if (coalesce(p_load_from, l.plan_load_from) <= coalesce(p_load_to, l.plan_load_to)) is false
     or (coalesce(p_delivery_from, l.plan_delivery_from) <= coalesce(p_delivery_to, l.plan_delivery_to)) is false then
    raise exception 'Początek okna po jego końcu' using errcode = '22023';
  end if;
  v_changed := (v_ld, v_dd, coalesce(p_load_from, l.plan_load_from), coalesce(p_load_to, l.plan_load_to),
                coalesce(p_delivery_from, l.plan_delivery_from), coalesce(p_delivery_to, l.plan_delivery_to))
               is distinct from (l.plan_load_date, l.plan_delivery_date, l.plan_load_from, l.plan_load_to, l.plan_delivery_from, l.plan_delivery_to);
  v_prev := l.plan_dates_status;
  perform set_config('tower.dates_ctx', 'on', true);
  update loads set plan_load_date = v_ld, plan_delivery_date = v_dd,
         plan_load_from = coalesce(p_load_from, plan_load_from), plan_load_to = coalesce(p_load_to, plan_load_to),
         plan_delivery_from = coalesce(p_delivery_from, plan_delivery_from), plan_delivery_to = coalesce(p_delivery_to, plan_delivery_to),
         plan_dates_status = 'POTWIERDZONA', plan_dates_confirmed_by = current_app_user_id(), plan_dates_confirmed_at = now(), updated_at = now()
   where id = p_load;
  perform set_config('tower.dates_ctx', '', true);
  insert into load_events (load_id, event_type, occurred_at, actor_id, payload)
  values (p_load, 'PLAN_DATES_CONFIRMED', now(), current_app_user_id(),
          jsonb_build_object('code', l.order_no, 'load_date', v_ld, 'delivery_date', v_dd, 'changed', v_changed, 'previous_status', v_prev));
  update risk_signals set resolved_at = now() where kind::text = 'DATES_UNCONFIRMED' and load_id = p_load and resolved_at is null;
  return jsonb_build_object('status', 'POTWIERDZONA', 'changed', v_changed, 'previous_status', v_prev);
end $$;
revoke all on function public.ksh_confirm_dates(uuid, date, date, timestamptz, timestamptz, timestamptz, timestamptz) from public, anon;
grant execute on function public.ksh_confirm_dates(uuid, date, date, timestamptz, timestamptz, timestamptz, timestamptz) to authenticated;

-- ryzyko: brak potwierdzenia N dni przed załadunkiem
create or replace function public.detect_unconfirmed_dates(p_now timestamptz default now()) returns int
language plpgsql security definer set search_path = public as $$
declare v_n int; v_today date := (p_now at time zone 'Europe/Warsaw')::date; v_new int := 0; r record; v_id uuid;
begin
  select value::int into v_n from app_parameters where key = 'DATE_CONFIRM_DAYS';
  v_n := coalesce(v_n, 5);
  update risk_signals s set resolved_at = p_now
    from loads l
   where s.kind::text = 'DATES_UNCONFIRMED' and s.resolved_at is null and l.id = s.load_id
     and (l.plan_dates_status = 'POTWIERDZONA' or l.status not in ('PLANNED','RESOURCES_PENDING','DOCS_PENDING','READY'));
  for r in
    select l.id, l.project_id, coalesce(l.order_no, left(l.id::text, 8)) as code, l.plan_load_date, (l.plan_load_date - v_today) as days
      from loads l
     where l.plan_dates_status = 'WSTEPNA' and l.status in ('PLANNED','RESOURCES_PENDING','DOCS_PENDING','READY')
       and l.plan_load_date is not null and l.plan_load_date <= v_today + v_n
  loop
    v_id := null;
    insert into risk_signals (project_id, load_id, kind, severity, title, title_key, detail, dedup_key, detected_at)
    values (r.project_id, r.id, 'DATES_UNCONFIRMED', (case when r.days <= 2 then 'HIGH' else 'MEDIUM' end)::risk_severity,
            r.code || ': daty niepotwierdzone przez KSH — załadunek ' || to_char(r.plan_load_date, 'DD.MM.YYYY'),
            'rk_dates_unconfirmed',
            jsonb_build_object('params', jsonb_build_object('code', r.code, 'date', to_char(r.plan_load_date, 'DD.MM.YYYY'), 'days', v_n),
                               'text', 'Załadunek za ' || r.days || ' dni; próg potwierdzenia: ' || v_n || ' dni',
                               'text_key', 'rk_dates_unconfirmed_text', 'next_action_key', 'rk_dates_unconfirmed_next',
                               'next_action', 'KSH: szuflada transportu → „Potwierdź daty”'),
            'dates:' || r.id, p_now)
    on conflict (dedup_key) where dedup_key is not null and resolved_at is null do nothing
    returning id into v_id;
    if v_id is not null then v_new := v_new + 1; end if;
  end loop;
  return v_new;
end $$;
revoke all on function public.detect_unconfirmed_dates(timestamptz) from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'tower-potwierdzenie-dat';
    perform cron.schedule('tower-potwierdzenie-dat', '25 * * * *', 'select public.detect_unconfirmed_dates()');
  end if;
end $$;
