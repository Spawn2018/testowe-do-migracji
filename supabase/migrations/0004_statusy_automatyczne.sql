-- =====================================================================
-- TOWER — Migracja 0004: statusy z pozycji, rejsy, automatyczny PROM
--
-- DECYZJE WŁAŚCICIELA 24.09.2026:
--  - statusy zmieniają się na podstawie pozycji
--  - port PL (Gdańsk) i port SE (Nynäshamn) mają swoje strefy;
--    wjazd auta w strefę = automatyczna aktualizacja statusu
--  - PROM: auto w strefie portu Gdańsk + nadchodzi czas wypłynięcia
--    przypisanego mu rejsu wg rozkładu armatora → system sam przełącza
--    status na PROM
--
-- ZASADY AUTOMATYKI:
--  1. Pozycja mówi, GDZIE jest auto. Brak potwierdzeń (załadunek,
--     dokumenty, numery zleceń) to osobne ryzyka, nie blokada ruchu —
--     z jednym wyjątkiem: wyjazd ze strefy załadunku bez potwierdzenia
--     załadunku NIE daje „w drodze", bo auto mogło odjechać puste
--  2. Status wyłącznie do przodu. Nigdy wstecz, nigdy z CANCELLED,
--     UNLOADED, DELIVERED
--  3. ROZŁADUNEK NIGDY AUTOMATYCZNIE. To data realizacji usługi — od niej
--     zależą opłata paliwowa, kurs NBP i tydzień faktury. Obecność na
--     placu budowy to AT_SITE, nie UNLOADED
--  4. Nieudana zmiana statusu (np. blokada numeru zlecenia z 0003) NIGDY
--     nie przerywa zapisu pozycji — zostaje ryzyko z przyczyną
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. REJSY I PRZYPISANIE REJSU DO TRANSPORTU
-- ---------------------------------------------------------------------
create type sailing_status as enum ('ZAPLANOWANY', 'OPOZNIONY', 'ODWOLANY');

create table vessels (
  id        uuid primary key default gen_random_uuid(),
  name      text not null unique,
  operator  text not null
);

create table sailings (
  id                   uuid primary key default gen_random_uuid(),
  project_id           uuid not null references projects(id),
  vessel_id            uuid not null references vessels(id),
  route                text not null default 'GDN-NYN' check (route in ('GDN-NYN','NYN-GDN')),
  departure_at         timestamptz not null,     -- rozkład armatora
  arrival_at           timestamptz not null,     -- rozkład armatora
  delayed_departure_at timestamptz,              -- gdy odnotowano opóźnienie
  delayed_arrival_at   timestamptz,
  status               sailing_status not null default 'ZAPLANOWANY',
  source               text not null default 'RECZNIE'
                       check (source in ('DANE_STARTOWE','RECZNIE','POLFERRIES')),
  updated_by           uuid references app_users(id),
  updated_at           timestamptz not null default now(),
  check (arrival_at > departure_at),
  unique (vessel_id, departure_at)
);
comment on column sailings.delayed_departure_at is
  'Czas odejścia po opóźnieniu. Automat PROM używa coalesce(delayed_departure_at, departure_at).';

alter table loads add column sailing_id uuid references sailings(id);
-- ferry_booking_ref istnieje od 0001 i zostaje.
-- Statek i godzina odejścia jako WOLNY TEKST przy transporcie — usunięte.
-- Jedno źródło prawdy o rejsie: sailings przez sailing_id. Dwie kopie danych
-- o rejsie to dokładnie usterka z D4 (odwrócone statki w SAIL_ROWS).
alter table loads drop column ferry_vessel;
alter table loads drop column ferry_departure;
create index loads_sailing_idx on loads (sailing_id) where sailing_id is not null;

alter table vessels  enable row level security;
alter table sailings enable row level security;
-- Rozkład rejsów widzą wszyscy uczestnicy projektu — nie jest poufny
create policy vessels_read  on vessels  for select to authenticated using (true);
create policy sailings_read on sailings for select to authenticated using (true);
create policy vessels_write_hhl  on vessels  for all to authenticated using (is_hhl()) with check (is_hhl());
create policy sailings_write_hhl on sailings for all to authenticated using (is_hhl()) with check (is_hhl());
-- Przypisanie rejsu: HHL i przewoźnik transportu — kto co zmienia, pilnuje
-- wyzwalacz guard_load_update (sekcja 6).

-- Kraj strefy — potrzebny do rozpoznania, że auto jest już na drogach SE
alter table geofences add column country char(2) check (country in ('PL','SE','LT','DE'));

-- ---------------------------------------------------------------------
-- 2. RYZYKA AUTOMATU
-- ---------------------------------------------------------------------
alter type risk_kind add value if not exists 'AUTO_STATUS';
alter type risk_kind add value if not exists 'LOADING_UNCONFIRMED';

create or replace function raise_risk(
  p_load uuid, p_kind risk_kind, p_sev risk_severity, p_title text, p_detail jsonb, p_dedup text
) returns void language plpgsql security definer set search_path = public as $$
begin
  insert into risk_signals (project_id, load_id, kind, severity, title, detail, dedup_key)
  select project_id, p_load, p_kind, p_sev, p_title, coalesce(p_detail, '{}'::jsonb), p_dedup
    from loads where id = p_load
  on conflict (dedup_key) where dedup_key is not null and resolved_at is null do nothing;
end $$;

create or replace function loaded_confirmed(p_load uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from load_events
                  where load_id = p_load and event_type = 'MILESTONE_LOADED')
$$;

-- Zmiana statusu z pełną ochroną: blokada (np. brak numeru zlecenia)
-- zamienia się w ryzyko, nie przerywa zapisu pozycji.
create or replace function auto_set_status(
  p_load uuid, p_from load_status, p_to load_status,
  p_reason text, p_ts timestamptz, p_detail jsonb
) returns boolean language plpgsql security definer set search_path = public as $$
begin
  begin
    update loads set status = p_to where id = p_load and status = p_from;
    if not found then return false; end if;
  exception when others then
    perform raise_risk(p_load, 'AUTO_STATUS', 'HIGH',
      format('Automatyczna zmiana statusu %s → %s zablokowana: %s', p_from, p_to, sqlerrm),
      coalesce(p_detail, '{}'::jsonb) || jsonb_build_object('from', p_from, 'to', p_to, 'blad', sqlerrm),
      'AUTOSTATUS:' || p_load || ':' || p_to);
    return false;
  end;
  insert into load_events (load_id, event_type, occurred_at, payload, dedup_key)
  values (p_load, 'STATUS_AUTO', p_ts,
          coalesce(p_detail, '{}'::jsonb) || jsonb_build_object('from', p_from, 'to', p_to, 'powod', p_reason),
          'STATUS_AUTO:' || p_load || ':' || p_to)
  on conflict (dedup_key) where dedup_key is not null do nothing;
  return true;
end $$;

-- ---------------------------------------------------------------------
-- 3. STATUS Z WJAZDU I WYJAZDU ZE STREFY
-- ---------------------------------------------------------------------
create or replace function apply_geofence_status() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_kind    geofence_kind := (new.payload->>'geofence_kind')::geofence_kind;
  v_country char(2);
  v_status  load_status;
  v_detail  jsonb;
begin
  select status into v_status from loads where id = new.load_id;
  if v_status in ('CANCELLED','UNLOADED','DELIVERED') then return null; end if;
  select country into v_country from geofences where id = (new.payload->>'geofence_id')::uuid;
  v_detail := jsonb_build_object('geofence_id', new.payload->>'geofence_id',
                                 'geofence_kind', v_kind, 'zdarzenie', new.event_type);

  if new.event_type = 'GEOFENCE_ENTER' then

    if v_kind = 'LOADING' then
      if v_status = 'READY' then
        perform auto_set_status(new.load_id, v_status, 'AT_LOADING', 'wjazd w strefę załadunku', new.occurred_at, v_detail);
      elsif v_status in ('PLANNED','RESOURCES_PENDING','DOCS_PENDING') then
        perform raise_risk(new.load_id, 'AUTO_STATUS', 'HIGH',
          format('Pojazd w strefie załadunku, a transport niegotowy (status %s)', v_status),
          v_detail, 'LOADING_NOT_READY:' || new.load_id);
      end if;

    elsif v_kind = 'PORT_OUT' and v_status in ('READY','AT_LOADING','IN_TRANSIT_PL') then
      if auto_set_status(new.load_id, v_status, 'AT_PORT_GDANSK', 'wjazd w strefę portu Gdańsk', new.occurred_at, v_detail)
         and not loaded_confirmed(new.load_id) then
        perform raise_risk(new.load_id, 'LOADING_UNCONFIRMED', 'MEDIUM',
          'Pojazd w porcie Gdańsk bez potwierdzenia załadunku', v_detail, 'PORT_NO_LOADED:' || new.load_id);
      end if;

    elsif v_kind = 'PORT_IN' and v_status = 'FERRY' then
      perform auto_set_status(new.load_id, v_status, 'AT_PORT_NYNASHAMN', 'wjazd w strefę portu Nynäshamn', new.occurred_at, v_detail);

    elsif v_kind = 'SITE' and v_status in ('FERRY','AT_PORT_NYNASHAMN','IN_TRANSIT_SE') then
      perform auto_set_status(new.load_id, v_status, 'AT_SITE', 'wjazd na plac budowy', new.occurred_at, v_detail);

    -- Awaryjnie: GPS zgubił wyjazd z portu SE albo cały pobyt w porcie
    -- (sygnał wraca dopiero na lądzie). Auto na drogach SE nie może być na promie.
    elsif v_kind in ('CHECKPOINT','PRE_ARRIVAL') and v_country = 'SE'
          and v_status in ('FERRY','AT_PORT_NYNASHAMN') then
      perform auto_set_status(new.load_id, v_status, 'IN_TRANSIT_SE',
        'pozycja na trasie SE — wyjazd z portu niezarejestrowany', new.occurred_at, v_detail);
    end if;

  elsif new.event_type = 'GEOFENCE_EXIT' then

    if v_kind = 'LOADING' and v_status = 'AT_LOADING' then
      if loaded_confirmed(new.load_id) then
        perform auto_set_status(new.load_id, v_status, 'IN_TRANSIT_PL', 'wyjazd ze strefy załadunku', new.occurred_at, v_detail);
      else
        perform raise_risk(new.load_id, 'LOADING_UNCONFIRMED', 'HIGH',
          'Pojazd opuścił strefę załadunku bez potwierdzenia załadunku — status bez zmian',
          v_detail, 'LEFT_LOADING_UNCONFIRMED:' || new.load_id);
      end if;

    elsif v_kind = 'PORT_IN' and v_status = 'AT_PORT_NYNASHAMN' then
      perform auto_set_status(new.load_id, v_status, 'IN_TRANSIT_SE', 'wyjazd ze strefy portu Nynäshamn', new.occurred_at, v_detail);
    end if;
    -- Wyjazd ze strefy portu Gdańsk po przełączeniu na PROM (statek
    -- odpływa) celowo niczego nie zmienia.
  end if;
  return null;
end $$;

create trigger trg_load_events_geofence_status
  after insert on load_events
  for each row when (new.event_type in ('GEOFENCE_ENTER','GEOFENCE_EXIT'))
  execute function apply_geofence_status();

-- ---------------------------------------------------------------------
-- 4. PROM — przełączenie w chwili odejścia przypisanego rejsu
--
-- Warunek: status AT_PORT_GDANSK i auto BYŁO w strefie portu Gdańsk
-- W CHWILI ODEJŚCIA. Sprawdzamy stan na moment odejścia, nie na „teraz" —
-- zadanie uruchomione z opóźnieniem, gdy statek jest już na morzu
-- (auto poza strefą), nadal przełącza poprawnie.
-- Czas odejścia = coalesce(opóźnione, rozkładowe).
-- ---------------------------------------------------------------------
create or replace function promote_ferry_departures(p_now timestamptz default now())
returns int language plpgsql security definer set search_path = public as $$
declare r record; v_inside boolean; n int := 0;
begin
  for r in
    select l.id as load_id, l.project_id, l.status, s.id as sailing_id,
           s.status as sailing_status, v.name as vessel,
           coalesce(s.delayed_departure_at, s.departure_at) as dep
      from loads l
      join sailings s on s.id = l.sailing_id and s.route = 'GDN-NYN'
      join vessels  v on v.id = s.vessel_id
     where coalesce(s.delayed_departure_at, s.departure_at) <= p_now
       and l.status in ('PLANNED','RESOURCES_PENDING','DOCS_PENDING','READY',
                        'AT_LOADING','IN_TRANSIT_PL','AT_PORT_GDANSK')
  loop
    if r.sailing_status = 'ODWOLANY' then
      perform raise_risk(r.load_id, 'FERRY', 'HIGH',
        format('Rejs %s z %s odwołany — transport wymaga nowego rejsu', r.vessel,
               to_char(r.dep at time zone 'Europe/Warsaw', 'DD.MM HH24:MI')),
        jsonb_build_object('sailing_id', r.sailing_id), 'SAILING_CANCELLED:' || r.load_id || ':' || r.sailing_id);
      continue;
    end if;

    select exists (
      select 1 from geofence_states gs
        join geofences g on g.id = gs.geofence_id
       where gs.load_id = r.load_id and g.project_id = r.project_id
         and g.kind = 'PORT_OUT' and g.active
         and gs.entered_at is not null and gs.entered_at <= r.dep
         and (gs.state in ('INSIDE','PENDING_OUT')
              or (gs.exited_at is not null and gs.exited_at >= r.dep))
    ) into v_inside;

    if r.status = 'AT_PORT_GDANSK' and v_inside then
      if auto_set_status(r.load_id, 'AT_PORT_GDANSK', 'FERRY', 'odejście przypisanego rejsu', r.dep,
           jsonb_build_object('sailing_id', r.sailing_id, 'statek', r.vessel, 'odejscie', r.dep)) then
        n := n + 1;
      end if;
    else
      perform raise_risk(r.load_id, 'FERRY', 'HIGH',
        format('Brak potwierdzenia pozycją, że transport był w porcie Gdańsk w chwili odejścia rejsu %s %s',
               r.vessel, to_char(r.dep at time zone 'Europe/Warsaw', 'DD.MM HH24:MI')),
        jsonb_build_object('sailing_id', r.sailing_id, 'status', r.status),
        'MISSED_SAILING:' || r.load_id || ':' || r.sailing_id);
    end if;
  end loop;
  return n;
end $$;

-- Transport nadal „na promie" długo po planowanym przypłynięciu:
-- auto zostało w porcie, albo GPS milczy po zejściu na ląd.
create or replace function detect_ferry_overdue(
  p_now timestamptz default now(), p_grace interval default interval '2 hours'
) returns int language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  for r in
    select l.id as load_id, s.id as sailing_id, v.name as vessel,
           coalesce(s.delayed_arrival_at, s.arrival_at) as arr
      from loads l
      join sailings s on s.id = l.sailing_id
      join vessels  v on v.id = s.vessel_id
     where l.status = 'FERRY'
       and coalesce(s.delayed_arrival_at, s.arrival_at) + p_grace < p_now
  loop
    perform raise_risk(r.load_id, 'FERRY', 'MEDIUM',
      format('Transport nadal w statusie PROM, choć %s miał przypłynąć %s', r.vessel,
             to_char(r.arr at time zone 'Europe/Warsaw', 'DD.MM HH24:MI')),
      jsonb_build_object('sailing_id', r.sailing_id), 'FERRY_OVERDUE:' || r.load_id || ':' || r.sailing_id);
    n := n + 1;
  end loop;
  return n;
end $$;

-- Zadania systemowe — użytkownicy nie wywołują ich z dowolną datą
revoke execute on function promote_ferry_departures(timestamptz)        from public, anon, authenticated;
revoke execute on function detect_ferry_overdue(timestamptz, interval)  from public, anon, authenticated;
revoke execute on function auto_set_status(uuid, load_status, load_status, text, timestamptz, jsonb) from public, anon, authenticated;
revoke execute on function raise_risk(uuid, risk_kind, risk_severity, text, jsonb, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 6. KTO ZMIENIA CO W TRANSPORCIE
--
-- USTERKA OD 0001, wykryta testem na Postgres 16: Supabase nadaje rolom
-- prawo UPDATE do całej tabeli, więc lista kolumn przewoźnika z 0001 NICZEGO
-- nie ograniczała — przewoźnik zmieniał we własnym transporcie numer zlecenia
-- HHL i numer zlecenia KSH. Przywileje kolumnowe i tak nie odróżniają HHL
-- od przewoźnika (ta sama rola bazodanowa), więc regułę egzekwuje wyzwalacz,
-- tak samo jak na fakturach w 0003.
-- ---------------------------------------------------------------------
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
    'plan_load_from','plan_load_to','plan_delivery_from','plan_delivery_to',
    'actual_load_at','actual_delivery_at','status','updated_at'];
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

create trigger trg_loads_guard
  before update on loads
  for each row execute function guard_load_update();

-- ---------------------------------------------------------------------
-- 5. HARMONOGRAM ZADAŃ — wykonywany tylko tam, gdzie jest pg_cron
--    (Supabase: włącz rozszerzenie pg_cron w panelu przed migracją)
-- ---------------------------------------------------------------------
do $cron$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('tower-prom',            '* * * * *',    'select promote_ferry_departures()');
    perform cron.schedule('tower-prom-opoznienie', '*/10 * * * *', 'select detect_ferry_overdue()');
    perform cron.schedule('tower-cisza-gps',       '*/15 * * * *', 'select detect_silent_vehicles()');
    perform cron.schedule('tower-terminy',         '5 0 * * *',    'select refresh_payment_status()');
    perform cron.schedule('tower-rodo',            '15 2 * * *',   'select purge_personal_data()');
    perform cron.schedule('tower-kolejnosc',       '30 5 * * *',   'select detect_sequence_risk(id) from projects');
  else
    raise notice 'pg_cron niedostępny — zadania do zaplanowania ręcznie (środowisko testowe)';
  end if;
end $cron$;
