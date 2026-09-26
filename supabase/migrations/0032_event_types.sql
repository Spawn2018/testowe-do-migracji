-- 0032 — W2 (WYSOKA): zdarzeń systemowych nie da się dopisać przez API; status ze strefy wg tabeli geofences.
-- Idempotentne. Istniejące wiersze produkcji sprawdzone przed wdrożeniem (NOTE, STATUS_AUTO, GEOFENCE_ENTER,
-- GEOFENCE_EXIT, DOC_UPLOADED, AWIZACJA_UPDATED — wszystkie na liście). Tabela typ → kto tworzy: docs/handover/SECURITY.md §6.

-- 1. CHECK: wszystkie znane typy (48). Nowy typ = nowa migracja.
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
    'POSITION_SHARE_DENIED', 'DELAY_DETECTED', 'RISK_RAISED', 'SILENT_VEHICLE'
));

-- 2. Reguła ról API: LISTA DOZWOLONYCH (nowy typ systemowy domyślnie zamknięty).
--    Funkcje systemowe (process_position, driver_post_event, auto_set_status) działają z uprawnieniami twórcy.
drop policy if exists events_insert on public.load_events;
create policy events_insert on public.load_events for insert to authenticated with check (
  exists (select 1 from public.loads l where l.id = load_events.load_id)
  and (
    load_events.event_type in (
      'NOTE', 'DOC_UPLOADED', 'PERMIT_MISMATCH', 'AWIZACJA_UPDATED', 'RESOURCES_UPDATED', 'ORDER_NO_UPDATED',
      'FERRY_UPDATED', 'SAILING_ASSIGNED', 'SCX_ASSIGNED', 'PLAN_B_ACTIVATED', 'READY_BLOCKED',
      'SCHEDULE_IMPORTED', 'SCHEDULE_DATE_CRITICAL', 'STATUS_APPROACHING_SITE', 'STATUS_AT_LOADING',
      'STATUS_AT_PORT', 'STATUS_AT_PORT_GDANSK', 'STATUS_AT_PORT_NYNASHAMN', 'STATUS_AT_SITE',
      'STATUS_CANCELLED', 'STATUS_DELAYED', 'STATUS_DELIVERED', 'STATUS_DOCS_PENDING', 'STATUS_DOC_MISSING',
      'STATUS_FERRY', 'STATUS_IN_TRANSIT_PL', 'STATUS_IN_TRANSIT_SE', 'STATUS_LOADING', 'STATUS_ON_FERRY',
      'STATUS_PLANNED', 'STATUS_READY', 'STATUS_RESOURCES_PENDING', 'STATUS_SILENT', 'STATUS_UNLOADED',
      'STATUS_UNLOADING'
    )
    or (load_events.event_type = 'MILESTONE_LOADED'
        and (public.is_hhl()
             or exists (select 1 from public.loads l where l.id = load_events.load_id
                         and public.current_org_kind() = 'CARRIER' and l.carrier_org_id = public.current_org_id())))
  )
);

-- 3. apply_geofence_status(): rodzaj i kraj strefy WYŁĄCZNIE z tabeli geofences po identyfikatorze
--    (payload->>'geofence_kind' od nadawcy ignorowany; nieznana strefa → brak zmiany statusu).
create or replace function public.apply_geofence_status() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_kind    geofence_kind;
  v_gid     uuid;
  v_country char(2);
  v_status  load_status;
  v_detail  jsonb;
begin
  select status into v_status from loads where id = new.load_id;
  if v_status in ('CANCELLED','UNLOADED','DELIVERED') then return null; end if;
  begin
    v_gid := (new.payload->>'geofence_id')::uuid;
  exception when others then
    return null;
  end;
  select g.kind, g.country into v_kind, v_country from geofences g where g.id = v_gid;
  if v_kind is null then return null; end if;
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
