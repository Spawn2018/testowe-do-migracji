-- =====================================================================
-- 0017 — M9: aplikacja kierowcy — pozycja ciągła, zgoda, zdarzenia etapów (STATUSY_AUTOMATYCZNE §5–§6).
--   1. report_position(...) — jedyna droga pozycji z aplikacji (zalogowany przewoźnik własnego
--      transportu albo HHL): źródło DRIVER_PWA, odrzuca słabe fixy (dokładność > 250 m) i czas
--      z przyszłości, potem process_position() (histereza, czas przebywania, odbicie).
--   2. USTERKA BEZPIECZEŃSTWA: process_position() (security definer) miał domyślne EXECUTE dla
--      PUBLIC/anon/authenticated — każdy, także niezalogowany, mógł „przesunąć” dowolny transport
--      pozycjami i wyzwolić automat statusów. Zostaje wyłącznie dla ról systemowych (telematyka).
--   3. MILESTONE_LOADED (warunek wyjazdu z załadunku → IN_TRANSIT_PL) zapisuje wyłącznie przewoźnik
--      transportu albo HHL — nie klient.
--   4. Strefy: współrzędne terminali zweryfikowane z mapą 26.09.2026 (OSM/Nominatim + ferryguide):
--      Gdańsk — Terminal Promowy Westerplatte, ul. Sucharskiego 70: 54.40372, 18.68130 (było 54.4030, 18.6800, ~100 m);
--      Nynäshamn — Färjeterminal, Nynäsvägen (kaj 2 Polferries): 58.90453, 17.95621
--      (było 58.9350, 17.9500 — ~3,4 km na północ, przy Norvik; strefa 800 m nigdy by nie zadziałała).
--      Strefa załadunku KSH Śrem · Grunwaldzka 27C z docs/watch-tower/ADDRESSES.md: 52.07391, 17.02460.
--   Idempotentna, niedestrukcyjna.
-- =====================================================================

create or replace function report_position(
  p_load_id  uuid,
  p_lat      float8,
  p_lon      float8,
  p_ts       timestamptz,
  p_accuracy numeric default null,
  p_speed    numeric default null,
  p_heading  numeric default null
) returns table (event_type text, geofence_id uuid, geofence_name text)
language plpgsql security definer set search_path = public as $$
declare v_carrier uuid;
begin
  select l.carrier_org_id into v_carrier from loads l where l.id = p_load_id;
  if not found then raise exception 'Nieznany transport'; end if;
  if not (is_hhl() or (current_org_kind() = 'CARRIER' and v_carrier = current_org_id())) then
    raise exception 'Pozycję transportu zgłasza wyłącznie jego przewoźnik albo HHL';
  end if;
  if p_lat is null or p_lon is null or abs(p_lat) > 90 or abs(p_lon) > 180 then
    raise exception 'Niepoprawne współrzędne';
  end if;
  if p_ts is null or p_ts > now() + interval '5 minutes' then
    raise exception 'Czas pozycji z przyszłości';
  end if;
  -- słaby fix (sieć komórkowa, wnętrze budynku) nie może otwierać ani zamykać stref
  if p_accuracy is not null and p_accuracy > 250 then return; end if;
  return query
    select r.event_type, r.geofence_id, r.geofence_name
      from process_position(p_load_id, p_lat, p_lon, p_ts, 'DRIVER_PWA'::position_source,
                            p_speed, p_heading, null,
                            jsonb_build_object('accuracy_m', p_accuracy, 'via', 'report_position')) r;
end $$;

revoke execute on function report_position(uuid, float8, float8, timestamptz, numeric, numeric, numeric) from public, anon;
grant execute on function report_position(uuid, float8, float8, timestamptz, numeric, numeric, numeric) to authenticated;

revoke execute on function process_position(uuid, float8, float8, timestamptz, position_source, numeric, numeric, boolean, jsonb)
  from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function process_position(uuid, float8, float8, timestamptz, position_source, numeric, numeric, boolean, jsonb) to service_role;
  end if;
end $$;

-- MILESTONE_LOADED — tylko przewoźnik transportu albo HHL
drop policy if exists events_insert on load_events;
create policy events_insert on load_events for insert to authenticated with check (
  exists (select 1 from loads l where l.id = load_events.load_id)
  and (
    load_events.event_type <> 'MILESTONE_LOADED'
    or is_hhl()
    or exists (select 1 from loads l where l.id = load_events.load_id
                and current_org_kind() = 'CARRIER' and l.carrier_org_id = current_org_id())
  )
);

-- Strefy: poprawione współrzędne terminali (tylko gdy nadal stare — nie nadpisuje zmian HHL)
update geofences set geom = make_circle_fence(54.40372, 18.68130, 800)
 where name = 'Terminal Polferries Gdańsk'
   and st_dwithin(st_centroid(geom)::geography, st_setsrid(st_makepoint(18.6800, 54.4030), 4326)::geography, 30);
update geofences set geom = make_circle_fence(54.40372, 18.68130, 20000)
 where name = 'Bufor 20 km przed Gdańskiem'
   and st_dwithin(st_centroid(geom)::geography, st_setsrid(st_makepoint(18.6800, 54.4030), 4326)::geography, 30);
update geofences set geom = make_circle_fence(58.90453, 17.95621, 800)
 where name = 'Terminal Nynäshamn'
   and st_dwithin(st_centroid(geom)::geography, st_setsrid(st_makepoint(17.9500, 58.9350), 4326)::geography, 30);

-- Strefa załadunku (adres z ADDRESSES.md, bez zgadywania)
insert into geofences (project_id, name, kind, geom, hysteresis_m, dwell_seconds, debounce_fixes, notify_enter, country)
select p.id, 'KSH Śrem · Grunwaldzka 27C', 'LOADING'::geofence_kind, make_circle_fence(52.07391, 17.02460, 600),
       150, 300, 2, true, 'PL'
  from projects p
 where p.code = 'STEGRA_BODEN'
   and not exists (select 1 from geofences g where g.project_id = p.id and g.name = 'KSH Śrem · Grunwaldzka 27C');
