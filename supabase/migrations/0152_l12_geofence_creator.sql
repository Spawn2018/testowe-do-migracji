-- =====================================================================
-- TOWER — Migracja 0152: L-12 kreator stref
--
-- Kraj strefy wraca w widoku i w zapisie okręgu (kolumna jest od 0004).
-- Usuwanie strefy: tylko HHL_ADMIN, przez RLS (security invoker).
-- Stary podpis upsert_geofence_circle zostaje wywoływalny: kraj ma wartość
-- domyślną NULL i przy zmianie nie kasuje kraju już zapisanego.
-- =====================================================================

create or replace view v_geofences_circle with (security_invoker = true) as
select g.id, g.project_id, g.name, g.kind, g.hysteresis_m, g.dwell_seconds, g.debounce_fixes,
       g.notify_enter, g.notify_exit, g.notify_dwell, g.notify_orgs, g.active, g.sort_order,
       st_y(st_centroid(g.geom))                                           as lat,
       st_x(st_centroid(g.geom))                                           as lng,
       round(st_distance(st_centroid(g.geom)::geography,
             st_pointn(st_exteriorring(g.geom), 1)::geography))::int       as radius_m,
       g.country
  from geofences g;

drop function if exists upsert_geofence_circle(
  uuid, uuid, text, geofence_kind, double precision, double precision,
  int, int, int, int, boolean, boolean, boolean, uuid[], boolean);

create function upsert_geofence_circle(
  p_id uuid, p_project uuid, p_name text, p_kind geofence_kind,
  p_lat double precision, p_lng double precision, p_radius_m int,
  p_hysteresis_m int, p_dwell_seconds int, p_debounce_fixes int,
  p_notify_enter boolean, p_notify_exit boolean, p_notify_dwell boolean,
  p_notify_orgs uuid[], p_active boolean, p_country char(2) default null)
returns uuid language plpgsql security invoker set search_path = public, extensions as $$
declare v_geom geometry; v_id uuid; v_country char(2);
begin
  if p_radius_m is null or p_radius_m < 10 or p_radius_m > 200000 then
    raise exception 'Promień strefy poza zakresem 10 m – 200 km';
  end if;
  if p_country is not null and p_country not in ('PL', 'SE', 'LT', 'DE') then
    raise exception 'Kraj strefy: PL, SE, LT albo DE' using errcode = '22023';
  end if;
  v_country := p_country;
  v_geom := st_buffer(st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography, p_radius_m, 32)::geometry;
  if p_id is null then
    insert into geofences (project_id, name, kind, geom, hysteresis_m, dwell_seconds, debounce_fixes,
                           notify_enter, notify_exit, notify_dwell, notify_orgs, active, country)
    values (p_project, p_name, p_kind, v_geom, p_hysteresis_m, p_dwell_seconds, p_debounce_fixes,
            p_notify_enter, p_notify_exit, p_notify_dwell, coalesce(p_notify_orgs, '{}'), p_active, v_country)
    returning id into v_id;
  else
    update geofences set name = p_name, kind = p_kind, geom = v_geom, hysteresis_m = p_hysteresis_m,
           dwell_seconds = p_dwell_seconds, debounce_fixes = p_debounce_fixes,
           notify_enter = p_notify_enter, notify_exit = p_notify_exit, notify_dwell = p_notify_dwell,
           notify_orgs = coalesce(p_notify_orgs, '{}'), active = p_active,
           country = coalesce(v_country, country)
     where id = p_id
    returning id into v_id;
  end if;
  if v_id is null then raise exception 'Brak uprawnień lub nieznana strefa' using errcode = '42501'; end if;
  return v_id;
end $$;

revoke all on function upsert_geofence_circle(
  uuid, uuid, text, geofence_kind, double precision, double precision,
  int, int, int, int, boolean, boolean, boolean, uuid[], boolean, char)
  from public, anon;
grant execute on function upsert_geofence_circle(
  uuid, uuid, text, geofence_kind, double precision, double precision,
  int, int, int, int, boolean, boolean, boolean, uuid[], boolean, char)
  to authenticated;

create function delete_geofence(p_id uuid) returns void
language plpgsql security invoker set search_path = public as $$
declare n int;
begin
  if p_id is null then
    raise exception 'Brak uprawnień lub nieznana strefa' using errcode = '42501';
  end if;
  delete from geofences where id = p_id;
  get diagnostics n = row_count;
  if n = 0 then
    raise exception 'Brak uprawnień lub nieznana strefa' using errcode = '42501';
  end if;
end $$;

revoke all on function delete_geofence(uuid) from public, anon;
grant execute on function delete_geofence(uuid) to authenticated;
