-- =====================================================================
-- TOWER — Migracja 0021: ANEKS 3 §2.3 + ANEKS 4 PR6 — kierowca bez logowania, na tokenie
--
--   Token: losowy (2 × gen_random_uuid() = 244 bity z pg_strong_random, ≥ 128), zwracany
--   jawnie JEDEN raz przy wydaniu; w bazie wyłącznie skrót SHA-256.
--   Jeden token = jeden transport. Ważność: do 24 h po rozładunku, maksymalnie 14 dni od wydania.
--   Odwołuje przewoźnik transportu albo HHL; nowy token unieważnia poprzedni.
--   Kierowca (rola anon przez API bazy — bez funkcji Edge, PR6):
--     driver_post_position(token, load, …) — pozycja → process_position() (strefy, automat)
--     driver_post_event(token, load, rodzaj, …) — zdarzenia etapów (lista zamknięta)
--     driver_get_instructions(token)       — wyłącznie instrukcje, żadnych cen
--   Limit zapytań w SQL: 120 wywołań na godzinę na token (pozycja co 2 min = 30/h).
--   Zdjęcia — funkcja Edge `driver-photo` (supabase/functions), token sprawdza driver_token_load().
--   Idempotentna, niedestrukcyjna.
-- =====================================================================

create table if not exists driver_tokens (
  id           uuid primary key default gen_random_uuid(),
  load_id      uuid not null references loads(id),
  token_hash   bytea not null unique,
  issued_by    uuid references app_users(id),
  issued_at    timestamptz not null default now(),
  expires_at   timestamptz not null,
  revoked_at   timestamptz,
  revoked_by   uuid references app_users(id),
  window_start timestamptz not null default now(),
  window_count int not null default 0,
  last_used_at timestamptz
);
create index if not exists driver_tokens_load on driver_tokens (load_id) where revoked_at is null;
alter table driver_tokens enable row level security;
revoke all on driver_tokens from anon, authenticated;   -- wyłącznie przez funkcje poniżej

create or replace function driver_token_hash(p_token text) returns bytea
language sql immutable as $$ select sha256(convert_to(coalesce(p_token, ''), 'UTF8')) $$;

-- Wydanie: przewoźnik transportu albo HHL. Zwraca token jawnie — jedyny raz.
create or replace function issue_driver_token(p_load_id uuid) returns text
language plpgsql security definer set search_path = public as $$
declare v_load loads%rowtype; v_token text; v_user uuid;
begin
  select * into v_load from loads where id = p_load_id;
  if not found then raise exception 'Nieznany transport'; end if;
  if not (is_hhl() or (current_org_kind() = 'CARRIER' and v_load.carrier_org_id = current_org_id())) then
    raise exception 'Token kierowcy wydaje wyłącznie przewoźnik transportu albo HHL';
  end if;
  if v_load.status = 'CANCELLED' then raise exception 'Transport anulowany — token niedostępny'; end if;
  if v_load.actual_delivery_at is not null and v_load.actual_delivery_at + interval '24 hours' <= now() then
    raise exception 'Ponad 24 h po rozładunku — token niedostępny';
  end if;
  select id into v_user from app_users where auth_id = auth.uid();
  update driver_tokens set revoked_at = now(), revoked_by = v_user
   where load_id = p_load_id and revoked_at is null;             -- nowy unieważnia poprzedni
  v_token := 'wt_' || encode(uuid_send(gen_random_uuid()) || uuid_send(gen_random_uuid()), 'hex');
  insert into driver_tokens (load_id, token_hash, issued_by, expires_at)
  values (p_load_id, driver_token_hash(v_token), v_user,
          least(now() + interval '14 days',
                coalesce(v_load.actual_delivery_at + interval '24 hours', now() + interval '14 days')));
  insert into audit_log (user_id, action, entity, entity_id, new_value)
  values (v_user, 'DRIVER_TOKEN_ISSUE', 'loads', p_load_id::text, jsonb_build_object('revoked_previous', true));
  return v_token;
end $$;

create or replace function revoke_driver_token(p_load_id uuid) returns int
language plpgsql security definer set search_path = public as $$
declare v_carrier uuid; n int; v_user uuid;
begin
  select carrier_org_id into v_carrier from loads where id = p_load_id;
  if not found then raise exception 'Nieznany transport'; end if;
  if not (is_hhl() or (current_org_kind() = 'CARRIER' and v_carrier = current_org_id())) then
    raise exception 'Token kierowcy odwołuje wyłącznie przewoźnik transportu albo HHL';
  end if;
  select id into v_user from app_users where auth_id = auth.uid();
  update driver_tokens set revoked_at = now(), revoked_by = v_user
   where load_id = p_load_id and revoked_at is null;
  get diagnostics n = row_count;
  insert into audit_log (user_id, action, entity, entity_id, new_value)
  values (v_user, 'DRIVER_TOKEN_REVOKE', 'loads', p_load_id::text, jsonb_build_object('revoked', n));
  return n;
end $$;

-- Sprawdzenie tokenu (+ limit zapytań). Zwraca transport tokenu albo błąd.
create or replace function driver_token_load(p_token text, p_cost int default 1) returns uuid
language plpgsql security definer set search_path = public as $$
declare t driver_tokens%rowtype; v_status load_status; v_delivered timestamptz;
begin
  select * into t from driver_tokens where token_hash = driver_token_hash(p_token) for update;
  if not found then raise exception 'Token kierowcy nieważny'; end if;
  if t.revoked_at is not null then raise exception 'Token kierowcy odwołany'; end if;
  if t.expires_at <= now() then raise exception 'Token kierowcy wygasł'; end if;
  select status, actual_delivery_at into v_status, v_delivered from loads where id = t.load_id;
  if v_status = 'CANCELLED' then raise exception 'Token kierowcy nieważny — transport anulowany'; end if;
  if v_delivered is not null and v_delivered + interval '24 hours' <= now() then
    raise exception 'Token kierowcy wygasł — ponad 24 h po rozładunku';
  end if;
  if p_cost > 0 then
    if t.window_start <= now() - interval '1 hour' then
      update driver_tokens set window_start = now(), window_count = p_cost, last_used_at = now() where id = t.id;
    elsif t.window_count + p_cost > 120 then
      raise exception 'Limit zapytań tokenu kierowcy: 120 na godzinę';
    else
      update driver_tokens set window_count = window_count + p_cost, last_used_at = now() where id = t.id;
    end if;
  end if;
  return t.load_id;
end $$;

create or replace function driver_post_position(
  p_token    text,
  p_load_id  uuid,
  p_lat      float8,
  p_lon      float8,
  p_ts       timestamptz,
  p_accuracy numeric default null,
  p_speed    numeric default null,
  p_heading  numeric default null
) returns table (event_type text, geofence_id uuid, geofence_name text)
language plpgsql security definer set search_path = public as $$
declare v_load uuid;
begin
  v_load := driver_token_load(p_token);
  if v_load is distinct from p_load_id then
    raise exception 'Token kierowcy nie dotyczy tego transportu';
  end if;
  if p_lat is null or p_lon is null or abs(p_lat) > 90 or abs(p_lon) > 180 then
    raise exception 'Niepoprawne współrzędne';
  end if;
  if p_ts is null or p_ts > now() + interval '5 minutes' then
    raise exception 'Czas pozycji z przyszłości';
  end if;
  if p_accuracy is not null and p_accuracy > 250 then return; end if;
  return query
    select r.event_type, r.geofence_id, r.geofence_name
      from process_position(v_load, p_lat, p_lon, p_ts, 'DRIVER_PWA'::position_source,
                            p_speed, p_heading, null,
                            jsonb_build_object('accuracy_m', p_accuracy, 'via', 'driver_token')) r;
end $$;

create or replace function driver_post_event(
  p_token      text,
  p_load_id    uuid,
  p_event_type text,
  p_ts         timestamptz default now(),
  p_note       text default null
) returns text
language plpgsql security definer set search_path = public as $$
declare v_load uuid; v_status load_status;
begin
  v_load := driver_token_load(p_token);
  if v_load is distinct from p_load_id then
    raise exception 'Token kierowcy nie dotyczy tego transportu';
  end if;
  if p_event_type not in ('MILESTONE_LOADED', 'DRIVER_ON_FERRY', 'DRIVER_PROBLEM', 'MILESTONE_UNLOADED') then
    raise exception 'Niedozwolone zdarzenie kierowcy: %', p_event_type;
  end if;
  if p_ts is null or p_ts > now() + interval '5 minutes' then
    raise exception 'Czas zdarzenia z przyszłości';
  end if;
  insert into load_events (load_id, event_type, occurred_at, source, payload)
  values (v_load, p_event_type, p_ts, 'DRIVER_PWA',
          jsonb_build_object('via', 'driver_token') || case when p_note is null then '{}'::jsonb
                                                        else jsonb_build_object('note', left(p_note, 500)) end);
  if p_event_type = 'MILESTONE_UNLOADED' then
    select status into v_status from loads where id = v_load;
    if v_status >= 'AT_LOADING' and v_status < 'UNLOADED' then
      update loads set status = 'UNLOADED', actual_delivery_at = p_ts, updated_at = now() where id = v_load;
    end if;
  end if;
  return p_event_type;
end $$;

-- Instrukcje dla kierowcy: lista pól zamknięta — żadnych cen, żadnych innych transportów.
create or replace function driver_get_instructions(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_load uuid; r record;
begin
  v_load := driver_token_load(p_token);
  select l.id, l.order_no, l.status, l.plan_load_from, l.plan_load_to, l.plan_delivery_from, l.plan_delivery_to,
         l.tractor_plate, l.trailer_plate, l.ferry_booking_ref,
         s.departure_at as sailing_departure, v.name as vessel
    into r
    from loads l
    left join sailings s on s.id = l.sailing_id
    left join vessels v on v.id = s.vessel_id
   where l.id = v_load;
  return jsonb_build_object(
    'load_id', r.id, 'order_no', r.order_no, 'status', r.status,
    'plan_load_from', r.plan_load_from, 'plan_load_to', r.plan_load_to,
    'plan_delivery_from', r.plan_delivery_from, 'plan_delivery_to', r.plan_delivery_to,
    'tractor_plate', r.tractor_plate, 'trailer_plate', r.trailer_plate,
    'ferry_booking_ref', r.ferry_booking_ref, 'vessel', r.vessel, 'sailing_departure', r.sailing_departure,
    'report_every_s', jsonb_build_object('moving', 120, 'stopped', 900, 'stopped_below_kmh', 5));
end $$;

revoke execute on function driver_token_hash(text) from public, anon, authenticated;
revoke execute on function driver_token_load(text, int) from public, anon, authenticated;
revoke execute on function issue_driver_token(uuid) from public, anon;
revoke execute on function revoke_driver_token(uuid) from public, anon;
grant execute on function issue_driver_token(uuid) to authenticated;
grant execute on function revoke_driver_token(uuid) to authenticated;
grant execute on function driver_post_position(text, uuid, float8, float8, timestamptz, numeric, numeric, numeric) to anon, authenticated;
grant execute on function driver_post_event(text, uuid, text, timestamptz, text) to anon, authenticated;
grant execute on function driver_get_instructions(text) to anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function driver_token_load(text, int) to service_role;
  end if;
end $$;

-- Zdjęcia i skany kierowcy: funkcja Edge `driver-photo` (klucz service_role wyłącznie w sekretach
-- funkcji) rejestruje dokument tą funkcją, potem wgrywa obiekt pod zwróconą ścieżkę.
create or replace function driver_create_document(
  p_token text, p_load_id uuid, p_category doc_category, p_file_name text, p_mime text, p_size bigint
) returns table (id uuid, bucket text, object_path text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare v_load uuid; v_id uuid; v_path text; v_bucket text;
begin
  v_load := driver_token_load(p_token);
  if v_load is distinct from p_load_id then
    raise exception 'Token kierowcy nie dotyczy tego transportu';
  end if;
  if p_category not in ('CMR', 'POD', 'LASHING_PHOTO') then
    raise exception 'Kierowca wgrywa wyłącznie CMR, POD i zdjęcia mocowania';
  end if;
  if p_mime not in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp') then
    raise exception 'Nieobsługiwany typ pliku: %', coalesce(p_mime, '—');
  end if;
  if p_size is null or p_size <= 0 or p_size > 10485760 then
    raise exception 'Plik za duży albo pusty (limit 10 MB)';
  end if;
  v_bucket := doc_bucket(p_category);
  insert into documents (project_id, load_id, category, storage_path, file_name, mime_type, size_bytes)
  select l.project_id, l.id, p_category, '-', p_file_name, p_mime, p_size from loads l where l.id = v_load
  returning documents.id, documents.storage_path into v_id, v_path;
  return query select v_id, v_bucket, substr(v_path, length(v_bucket) + 2);
end $$;
revoke execute on function driver_create_document(text, uuid, doc_category, text, text, bigint) from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function driver_create_document(text, uuid, doc_category, text, text, bigint) to service_role;
  end if;
end $$;
