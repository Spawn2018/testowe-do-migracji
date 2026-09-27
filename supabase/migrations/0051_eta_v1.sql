-- =====================================================================
-- TOWER — Migracja 0051: I-2d — ETA v1 w bazie (M12 / 5.12)
--
--   Dotąd ETA liczyła przeglądarka z samego statusu (lib/eta.ts) — kolumny loads.eta_site i
--   eta_confidence_min istniały, ale nic ich nie wyliczało (audyt C2). Od 0051:
--     • eta_segment_params — czasy odcinków (założenia M12, źródło jawne; zmienia HHL);
--     • compute_load_eta(load) — bieżący odcinek (status + pozycja) + czasy odcinków + odejście
--       i przypłynięcie przypisanego rejsu z `sailings` (czas po opóźnieniu, gdy odnotowany);
--       bez przypisanego rejsu — najbliższy rejs z rozkładu jako ZAŁOŻENIE (szersze pasmo);
--     • pole ufności eta_confidence_min (± minut) z niepewności odcinków: rozkład armatora ±30 min,
--       odcinek drogowy ±spread z parametrów, brak świeżej pozycji / rejs zagrożony / brak rejsu → szerzej;
--     • loads.eta_basis — skąd liczba: odcinki, rejs, flagi (UI pokazuje powód, nie udaje pewności);
--     • przeliczenie przy każdym zdarzeniu: load_events (INSERT), zmiana statusu/rejsu/planu (loads),
--       zmiana rejsu w rozkładzie (sailings), nowa pozycja (positions).
--   Idempotentna i niedestrukcyjna: IF NOT EXISTS, CREATE OR REPLACE, DROP TRIGGER IF EXISTS + CREATE,
--   parametry wstawiane ON CONFLICT DO NOTHING (zmiany HHL nie są nadpisywane).
--   guard_load_update: przeliczenie ETA (tower.eta_ctx) może zmienić WYŁĄCZNIE kolumny eta_* —
--   każda inna zmiana w tym kontekście = wyjątek (strażnik „is not true”).
-- =====================================================================

alter table loads add column if not exists eta_basis jsonb;
comment on column loads.eta_site is 'ETA v1 na placu budowy — compute_load_eta() (0051); NULL = brak podstaw (anulowany)';
comment on column loads.eta_confidence_min is 'Pasmo ufności ETA ± minut — suma niepewności odcinków (0051)';
comment on column loads.eta_basis is 'Podstawa ETA v1: odcinki, rejs, flagi (0051)';

create table if not exists eta_segment_params (
  code        text primary key check (code in ('PL_ROAD','PORT_CHECKIN','CROSSING_DEFAULT','SE_ROAD','SE_BREAKS','GPS_FRESH_MIN')),
  label       text not null,
  hours       numeric(6,2) not null check (hours >= 0),
  spread_pct  numeric(5,2) not null default 20 check (spread_pct between 0 and 200),
  source      text not null,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references app_users(id)
);
insert into eta_segment_params (code, label, hours, spread_pct, source) values
  ('PL_ROAD',          'Droga PL: KSH Śrem → terminal Gdańsk',            4.5, 20, 'założenie M12 — do potwierdzenia z przewoźnikiem (17.14)'),
  ('PORT_CHECKIN',     'Check-in przed odejściem promu',                   2.0, 0,  'założenie M12 — cutoff do potwierdzenia z przewoźnikiem (17.14)'),
  ('CROSSING_DEFAULT', 'Przeprawa GDN→NYN, gdy brak rejsu w rozkładzie',  18.0, 15, 'założenie M12 — używane tylko bez rejsu w `sailings`'),
  ('SE_ROAD',          'Droga SE: Nynäshamn → plac budowy Boden',         14.0, 25, 'założenie M12 — do potwierdzenia z przewoźnikiem (17.14)'),
  ('SE_BREAKS',        'Przerwy 561/2006 na odcinku SE',                   4.5, 30, 'założenie M12 — rozporządzenie 561/2006'),
  ('GPS_FRESH_MIN',    'Pozycja świeża, jeśli młodsza niż (h)',            1.5, 0,  'próg jak w automacie ciszy (90 min)')
on conflict (code) do nothing;

alter table eta_segment_params enable row level security;
revoke insert, update, delete, truncate on eta_segment_params from anon, authenticated;
drop policy if exists eta_params_read on eta_segment_params;
create policy eta_params_read on eta_segment_params for select to authenticated using (current_org_id() is not null);
grant select on eta_segment_params to authenticated;

-- ---------------------------------------------------------------------
-- compute_load_eta — czysta ocena (bez zapisu). Wewnętrzna: brak EXECUTE dla ról API.
-- ---------------------------------------------------------------------
create or replace function compute_load_eta(p_load uuid, p_now timestamptz default now())
returns table (eta timestamptz, conf_min int, basis jsonb)
language plpgsql stable security definer set search_path = public as $$
declare
  l          record;
  s          record;
  p          record;
  h_pl       numeric; sp_pl numeric;
  h_ci       numeric;
  h_cross    numeric; sp_cross numeric;
  h_se       numeric; sp_se numeric;
  fresh_h    numeric;
  v_status   load_status;
  v_eta      timestamptz;
  v_conf     numeric := 0;
  v_segs     jsonb := '[]'::jsonb;
  v_flags    text[] := '{}';
  v_seg      text;
  v_start    timestamptz;
  v_frac     numeric;
  v_rem      numeric;
  v_dep      timestamptz;
  v_arr      timestamptz;
  v_sail_src text := null;
  v_has      boolean := false;
  g_load geometry; g_pout geometry; g_pin geometry; g_site geometry;
begin
  select * into l from loads where id = p_load;
  if not found then return; end if;
  v_status := l.status;

  select hours, spread_pct / 100 into h_pl, sp_pl from eta_segment_params where code = 'PL_ROAD';
  select hours into h_ci from eta_segment_params where code = 'PORT_CHECKIN';
  select hours, spread_pct / 100 into h_cross, sp_cross from eta_segment_params where code = 'CROSSING_DEFAULT';
  select sum(hours), max(spread_pct) / 100 into h_se, sp_se from eta_segment_params where code in ('SE_ROAD','SE_BREAKS');
  select hours into fresh_h from eta_segment_params where code = 'GPS_FRESH_MIN';
  h_pl := coalesce(h_pl, 4.5); sp_pl := coalesce(sp_pl, 0.2); h_ci := coalesce(h_ci, 2);
  h_cross := coalesce(h_cross, 18); sp_cross := coalesce(sp_cross, 0.15);
  h_se := coalesce(h_se, 18.5); sp_se := coalesce(sp_se, 0.3); fresh_h := coalesce(fresh_h, 1.5);

  -- punkty odniesienia: centra stref projektu (LOADING, PORT_OUT, PORT_IN, SITE)
  select st_centroid(geom) into g_load from geofences where project_id = l.project_id and kind = 'LOADING' and active order by sort_order limit 1;
  select st_centroid(geom) into g_pout from geofences where project_id = l.project_id and kind = 'PORT_OUT' and active order by sort_order limit 1;
  select st_centroid(geom) into g_pin  from geofences where project_id = l.project_id and kind = 'PORT_IN'  and active order by sort_order limit 1;
  select st_centroid(geom) into g_site from geofences where project_id = l.project_id and kind = 'SITE'     and active order by sort_order limit 1;
  select ts, coalesce(geom_snapped, geom_raw) as g into p from positions where load_id = p_load order by ts desc limit 1;

  -- 1) stany końcowe
  if v_status = 'CANCELLED' then
    return query select null::timestamptz, null::int, jsonb_build_object('method','ETA v1 (baza)','segment','CANCELLED','flags',jsonb_build_array('anulowany'),'computed_at',p_now);
    return;
  end if;
  if v_status in ('UNLOADED','DELIVERED') then
    return query select coalesce(l.actual_delivery_at, p_now), 0, jsonb_build_object('method','ETA v1 (baza)','segment','DONE','flags',jsonb_build_array('rozładowany — data rozładunku'),'computed_at',p_now);
    return;
  end if;
  if v_status = 'AT_SITE' then
    select max(occurred_at) into v_eta from load_events where load_id = p_load and payload->>'to' = 'AT_SITE';
    return query select coalesce(v_eta, p_now), 0, jsonb_build_object('method','ETA v1 (baza)','segment','AT_SITE','flags',jsonb_build_array('na placu budowy'),'computed_at',p_now);
    return;
  end if;

  -- 2) odcinek SE (po przypłynięciu)
  if v_status in ('AT_PORT_NYNASHAMN','IN_TRANSIT_SE') then
    v_frac := 1;
    if v_status = 'IN_TRANSIT_SE' then
      if p.ts is not null and p.ts >= p_now - make_interval(mins => (fresh_h * 60)::int) and g_site is not null and g_pin is not null
         and st_distance(g_pin::geography, g_site::geography) > 0 then
        v_frac := least(1, greatest(0, st_distance(p.g::geography, g_site::geography) / st_distance(g_pin::geography, g_site::geography)));
        v_flags := array_append(v_flags, 'pozycja GPS — odległość do placu w linii prostej'::text);
      else
        v_frac := 0.5; v_conf := v_conf + h_se * 60 * 0.25;
        v_flags := array_append(v_flags, 'brak świeżej pozycji — połowa odcinka SE'::text);
      end if;
    end if;
    v_rem := h_se * v_frac;
    v_eta := p_now + make_interval(secs => (v_rem * 3600)::int);
    v_conf := v_conf + v_rem * 60 * sp_se;
    v_segs := v_segs || jsonb_build_object('code','SE_ROAD','hours',round(v_rem, 1),'spread_pct',round(sp_se * 100));
    v_seg := v_status::text;
  else
    -- 3) przed promem albo na promie: rejs przypisany z `sailings`
    select coalesce(x.delayed_departure_at, x.departure_at) as dep, coalesce(x.delayed_arrival_at, x.arrival_at) as arr,
           x.status, x.id, (x.delayed_departure_at is not null or x.status = 'OPOZNIONY') as delayed
      into s from sailings x where x.id = l.sailing_id;
    v_has := found;
    if v_has and s.status = 'ODWOLANY' then
      v_flags := array_append(v_flags, 'przypisany rejs odwołany'::text); v_has := false;
    elsif v_has and v_status < 'FERRY' and s.dep < p_now then
      v_flags := array_append(v_flags, 'przypisany rejs odpłynął bez transportu'::text); v_has := false;
    end if;

    if v_status = 'FERRY' then
      if v_has then
        v_arr := s.arr; v_sail_src := 'przypisany';
        v_conf := v_conf + 30 + (case when s.delayed then 60 else 0 end);
      else
        v_arr := p_now + make_interval(secs => (h_cross * 0.5 * 3600)::int);
        v_conf := v_conf + h_cross * 60 * 0.5;
        v_flags := array_append(v_flags, 'na promie bez rejsu w rozkładzie — połowa przeprawy'::text);
      end if;
      v_seg := 'FERRY';
    else
      -- czas dojazdu do check-inu w Gdańsku
      v_start := greatest(p_now, coalesce(l.plan_load_to, l.plan_load_from, (l.plan_load_date + time '12:00') at time zone 'Europe/Warsaw', p_now));
      v_frac := case when v_status = 'AT_PORT_GDANSK' then 0 when v_status = 'IN_TRANSIT_PL' then 0.5 else 1 end;
      if v_status = 'IN_TRANSIT_PL' then
        if p.ts is not null and p.ts >= p_now - make_interval(mins => (fresh_h * 60)::int) and g_pout is not null and g_load is not null
           and st_distance(g_load::geography, g_pout::geography) > 0 then
          v_frac := least(1, greatest(0, st_distance(p.g::geography, g_pout::geography) / st_distance(g_load::geography, g_pout::geography)));
          v_flags := array_append(v_flags, 'pozycja GPS — odległość do portu w linii prostej'::text);
        else
          v_flags := array_append(v_flags, 'brak świeżej pozycji — połowa odcinka PL'::text);
          v_conf := v_conf + h_pl * 60 * 0.25;
        end if;
      end if;
      if v_status < 'IN_TRANSIT_PL' and v_start > p_now then v_flags := array_append(v_flags, 'przed załadunkiem — start z planu załadunku'::text); end if;
      v_segs := v_segs || jsonb_build_object('code','PL_ROAD','hours',round(h_pl * v_frac, 1),'spread_pct',round(sp_pl * 100));
      v_start := v_start + make_interval(secs => ((h_pl * v_frac + (case when v_status = 'AT_PORT_GDANSK' then 0 else h_ci end)) * 3600)::int);
      if v_has then
        v_dep := s.dep; v_arr := s.arr; v_sail_src := 'przypisany';
        v_conf := v_conf + 30 + (case when s.delayed then 60 else 0 end);
        if v_start > v_dep then
          v_flags := array_append(v_flags, 'rejs zagrożony — dojazd i check-in po odejściu'::text);
          v_conf := v_conf + 12 * 60;
        end if;
      else
        -- bez przypisanego rejsu: najbliższy rejs GDN-NYN po dojeździe i check-inie — ZAŁOŻENIE
        select coalesce(x.delayed_departure_at, x.departure_at), coalesce(x.delayed_arrival_at, x.arrival_at)
          into v_dep, v_arr
          from sailings x
         where x.project_id = l.project_id and x.route = 'GDN-NYN' and x.status <> 'ODWOLANY'
           and coalesce(x.delayed_departure_at, x.departure_at) >= v_start
         order by coalesce(x.delayed_departure_at, x.departure_at) limit 1;
        if v_dep is not null then
          v_sail_src := 'założony (najbliższy w rozkładzie)';
          v_flags := array_append(v_flags, 'brak przypisanego rejsu — założony najbliższy z rozkładu'::text);
          v_conf := v_conf + 6 * 60;
        else
          v_dep := v_start; v_arr := v_start + make_interval(secs => (h_cross * 3600)::int);
          v_flags := array_append(v_flags, 'brak rejsu w rozkładzie — przeprawa z założenia'::text);
          v_conf := v_conf + 12 * 60 + h_cross * 60 * sp_cross;
        end if;
      end if;
      v_seg := v_status::text;
    end if;
    v_segs := v_segs || jsonb_build_object('code','CROSSING','departure',v_dep,'arrival',v_arr,'source',coalesce(v_sail_src,'założenie'));
    v_segs := v_segs || jsonb_build_object('code','SE_ROAD','hours',round(h_se, 1),'spread_pct',round(sp_se * 100));
    v_eta := v_arr + make_interval(secs => (h_se * 3600)::int);
    v_conf := v_conf + h_se * 60 * sp_se + (case when v_status < 'FERRY' then h_pl * 60 * sp_pl else 0 end);
  end if;

  return query select v_eta, round(v_conf)::int, jsonb_build_object(
    'method', 'ETA v1 (baza)', 'segment', v_seg, 'segments', v_segs,
    'flags', to_jsonb(v_flags), 'sailing', v_sail_src, 'computed_at', p_now);
end $$;

-- Zapis ETA do loads — wyłącznie kolumny eta_* (kontekst tower.eta_ctx sprawdzany w guard_load_update)
create or replace function refresh_load_eta(p_load uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  select * into r from compute_load_eta(p_load);
  perform set_config('tower.eta_ctx', 'on', true);
  update loads l set eta_site = r.eta, eta_confidence_min = r.conf_min, eta_basis = r.basis, eta_computed_at = now(),
         delay_minutes = case
           when r.eta is null then null
           when coalesce(l.plan_delivery_to, ((l.plan_delivery_date + 1)::timestamp at time zone 'Europe/Stockholm')) is null then null
           else greatest(0, round(extract(epoch from (r.eta - coalesce(l.plan_delivery_to,
                  ((l.plan_delivery_date + 1)::timestamp at time zone 'Europe/Stockholm')))) / 60))::int end
   where l.id = p_load
     and (l.eta_site is distinct from r.eta or l.eta_confidence_min is distinct from r.conf_min
          or (l.eta_basis - 'computed_at') is distinct from (r.basis - 'computed_at')
          or l.delay_minutes is null and r.eta is not null);
  perform set_config('tower.eta_ctx', '', true);
end $$;

revoke execute on function compute_load_eta(uuid, timestamptz) from public, anon, authenticated;
revoke execute on function refresh_load_eta(uuid) from public, anon, authenticated;

-- Wyzwalacze przeliczenia
create or replace function trg_eta_after_event() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform refresh_load_eta(new.load_id);
  return null;
end $$;

create or replace function trg_eta_after_sailing() returns trigger
language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  for v in select id from loads where sailing_id = new.id and status not in ('CANCELLED','UNLOADED','DELIVERED') loop
    perform refresh_load_eta(v);
  end loop;
  return null;
end $$;

-- zmiana statusu / rejsu / planu / rozładunku → przeliczenie po zapisie (własny zapis ETA pomijany)
create or replace function trg_eta_after_load() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if current_setting('tower.eta_ctx', true) = 'on' then return null; end if;  -- własny zapis ETA
  perform refresh_load_eta(new.id);
  return null;
end $$;

revoke execute on function trg_eta_after_event() from public, anon, authenticated;
revoke execute on function trg_eta_after_sailing() from public, anon, authenticated;
revoke execute on function trg_eta_after_load() from public, anon, authenticated;

drop trigger if exists trg_load_events_eta on load_events;
create trigger trg_load_events_eta after insert on load_events
  for each row execute function trg_eta_after_event();
drop trigger if exists trg_positions_eta on positions;
create trigger trg_positions_eta after insert on positions
  for each row execute function trg_eta_after_event();
drop trigger if exists trg_sailings_eta on sailings;
create trigger trg_sailings_eta after update of departure_at, arrival_at, delayed_departure_at, delayed_arrival_at, status on sailings
  for each row execute function trg_eta_after_sailing();
drop trigger if exists trg_loads_eta on loads;
create trigger trg_loads_eta after insert or update of status, sailing_id, plan_load_date, plan_load_from, plan_load_to, plan_delivery_date, actual_delivery_at on loads
  for each row execute function trg_eta_after_load();

-- guard_load_update: jak w 0049 + kontekst przeliczenia ETA
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

-- ETA dla istniejących transportów (produkcja 27.09.2026: 0 transportów — blok bez skutku)
do $$ declare v uuid; begin
  for v in select id from loads loop perform refresh_load_eta(v); end loop;
end $$;
