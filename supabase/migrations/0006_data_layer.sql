-- 0006_data_layer.sql — BK3 Warstwa danych (SupabaseProvider).
-- 1) Geofence jako okrąg dla interfejsu: widok z centrum/promieniem + funkcja zapisu.
--    Obie SECURITY INVOKER → obowiązuje RLS geofences (zapis tylko HHL_ADMIN).
-- 2) Autor wiadomości / zdarzenia ustawiany po stronie serwera (koniec podszywania:
--    polityki insert z 0001 mają `with check (true)`).

-- 1. Geofence ------------------------------------------------------------
create or replace view v_geofences_circle with (security_invoker = true) as
select g.id, g.project_id, g.name, g.kind, g.hysteresis_m, g.dwell_seconds, g.debounce_fixes,
       g.notify_enter, g.notify_exit, g.notify_dwell, g.notify_orgs, g.active, g.sort_order,
       st_y(st_centroid(g.geom))                                           as lat,
       st_x(st_centroid(g.geom))                                           as lng,
       round(st_distance(st_centroid(g.geom)::geography,
             st_pointn(st_exteriorring(g.geom), 1)::geography))::int       as radius_m
  from geofences g;
grant select on v_geofences_circle to authenticated;
revoke all on v_geofences_circle from anon;

create or replace function upsert_geofence_circle(
  p_id uuid, p_project uuid, p_name text, p_kind geofence_kind,
  p_lat double precision, p_lng double precision, p_radius_m int,
  p_hysteresis_m int, p_dwell_seconds int, p_debounce_fixes int,
  p_notify_enter boolean, p_notify_exit boolean, p_notify_dwell boolean,
  p_notify_orgs uuid[], p_active boolean)
returns uuid language plpgsql security invoker set search_path = public, extensions as $$
declare v_geom geometry; v_id uuid;
begin
  if p_radius_m is null or p_radius_m < 10 or p_radius_m > 200000 then
    raise exception 'Promień strefy poza zakresem 10 m – 200 km';
  end if;
  v_geom := st_buffer(st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography, p_radius_m, 32)::geometry;
  if p_id is null then
    insert into geofences (project_id, name, kind, geom, hysteresis_m, dwell_seconds, debounce_fixes,
                           notify_enter, notify_exit, notify_dwell, notify_orgs, active)
    values (p_project, p_name, p_kind, v_geom, p_hysteresis_m, p_dwell_seconds, p_debounce_fixes,
            p_notify_enter, p_notify_exit, p_notify_dwell, coalesce(p_notify_orgs,'{}'), p_active)
    returning id into v_id;
  else
    update geofences set name = p_name, kind = p_kind, geom = v_geom, hysteresis_m = p_hysteresis_m,
           dwell_seconds = p_dwell_seconds, debounce_fixes = p_debounce_fixes,
           notify_enter = p_notify_enter, notify_exit = p_notify_exit, notify_dwell = p_notify_dwell,
           notify_orgs = coalesce(p_notify_orgs,'{}'), active = p_active
     where id = p_id
    returning id into v_id;
  end if;
  if v_id is null then raise exception 'Brak uprawnień lub nieznana strefa' using errcode = '42501'; end if;
  return v_id;
end $$;
revoke execute on function upsert_geofence_circle(uuid, uuid, text, geofence_kind, double precision, double precision, int, int, int, int, boolean, boolean, boolean, uuid[], boolean) from public, anon;
grant  execute on function upsert_geofence_circle(uuid, uuid, text, geofence_kind, double precision, double precision, int, int, int, int, boolean, boolean, boolean, uuid[], boolean) to authenticated;

-- 2. Autor po stronie serwera --------------------------------------------
alter table load_messages add column if not exists author_org text;

create or replace function set_message_author() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_org text;
begin
  if auth.uid() is null then return new; end if;   -- service role / cron
  select u.id, o.code into v_id, v_org
    from app_users u join organizations o on o.id = u.org_id
   where u.auth_id = auth.uid() and u.active;
  if v_id is null then raise exception 'Brak aktywnego konta' using errcode = '42501'; end if;
  new.author_id := v_id;
  new.author_org := v_org;
  new.created_at := now();
  return new;
end $$;
drop trigger if exists trg_load_messages_author on load_messages;
create trigger trg_load_messages_author before insert on load_messages
  for each row execute function set_message_author();

create or replace function set_event_actor() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then return new; end if;
  select id into v_id from app_users where auth_id = auth.uid() and active;
  if v_id is null then raise exception 'Brak aktywnego konta' using errcode = '42501'; end if;
  new.actor_id := v_id;
  new.recorded_at := now();
  return new;
end $$;
drop trigger if exists trg_load_events_actor on load_events;
create trigger trg_load_events_actor before insert on load_events
  for each row execute function set_event_actor();

revoke execute on function set_message_author() from public, anon, authenticated;
revoke execute on function set_event_actor()    from public, anon, authenticated;

-- 3. Zapis zdarzeń / wiadomości tylko dla transportów widocznych (RLS loads,
--    wyrażenie polityki działa z uprawnieniami wywołującego).
drop policy if exists events_insert on load_events;
create policy events_insert on load_events for insert to authenticated with check (
  exists (select 1 from loads l where l.id = load_events.load_id)
);
drop policy if exists msgs_insert on load_messages;
create policy msgs_insert on load_messages for insert to authenticated with check (
  exists (select 1 from loads l where l.id = load_messages.load_id)
);
