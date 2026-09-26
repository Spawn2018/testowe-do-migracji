-- =====================================================================
-- 0018 — M12: integracje danych zewnętrznych (ZRODLA_DANYCH.md). Idempotentna, bez usuwania danych.
--  1) raise_integration_risk() — ryzyko z funkcji Edge (service_role): projektowe (źródło niedostępne,
--     drogi ROAD_SE/ROAD_PL) albo transportu (TomTom przy aucie); deduplikacja jak raise_risk.
--  2) latest_vehicle_positions() — ostatnia pozycja aut w trasie drogowej (dla traffic-flow), service_role.
--  3) Pierwszeństwo źródeł rejsu RECZNIE > POLFERRIES > DANE_STARTOWE egzekwuje baza: każdy zapis
--     rejsu przez użytkownika (sesja z auth.uid()) oznacza źródło RECZNIE; zadania systemowe
--     (service_role, bez auth.uid()) zapisują POLFERRIES i nie nadpisują wierszy RECZNIE.
-- Harmonogram (pg_cron → pg_net → funkcje Edge) wymaga sekretu z kluczem — krok właściciela W-M12-1
-- (scripts/ferry/cron-edge.sql), nie ta migracja.
-- =====================================================================

create or replace function raise_integration_risk(
  p_project uuid, p_load uuid, p_kind risk_kind, p_sev risk_severity, p_title text, p_detail jsonb,
  p_dedup text, p_source_url text default null, p_valid_until timestamptz default null
) returns boolean language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if p_dedup is null or length(p_dedup) = 0 then raise exception 'raise_integration_risk: wymagany klucz deduplikacji'; end if;
  insert into risk_signals (project_id, load_id, kind, severity, title, detail, source_url, valid_until, dedup_key)
  values (coalesce((select project_id from loads where id = p_load), p_project), p_load, p_kind, p_sev, p_title,
          coalesce(p_detail, '{}'::jsonb), p_source_url, p_valid_until, p_dedup)
  on conflict (dedup_key) where dedup_key is not null and resolved_at is null do nothing;
  get diagnostics n = row_count;
  return n > 0;
end $$;
revoke execute on function raise_integration_risk(uuid, uuid, risk_kind, risk_severity, text, jsonb, text, text, timestamptz) from public, anon, authenticated;

create or replace function latest_vehicle_positions(p_max_age_min int default 30)
returns table (load_id uuid, code text, lat double precision, lon double precision, ts timestamptz)
language sql stable security definer set search_path = public as $$
  select distinct on (p.load_id) p.load_id,
         coalesce((select min(si.shipment_code) from shipment_items si where si.load_id = l.id), l.order_no),
         st_y(coalesce(p.geom_snapped, p.geom_raw)), st_x(coalesce(p.geom_snapped, p.geom_raw)), p.ts
    from positions p join loads l on l.id = p.load_id
   where l.status in ('IN_TRANSIT_PL', 'IN_TRANSIT_SE')
     and p.ts > now() - make_interval(mins => greatest(p_max_age_min, 1))
   order by p.load_id, p.ts desc
$$;
revoke execute on function latest_vehicle_positions(int) from public, anon, authenticated;

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function raise_integration_risk(uuid, uuid, risk_kind, risk_severity, text, jsonb, text, text, timestamptz) to service_role;
    grant execute on function latest_vehicle_positions(int) to service_role;
  end if;
end $$;

create or replace function sailings_manual_source() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then
    new.source := 'RECZNIE';
    new.updated_by := (select id from app_users where auth_id = auth.uid());
    new.updated_at := now();
  end if;
  return new;
end $$;
drop trigger if exists sailings_manual_source on sailings;
create trigger sailings_manual_source before insert or update on sailings
  for each row execute function sailings_manual_source();

-- Dziennik przebiegów zadań integracji: kontrola częstotliwości (ferry-status nie częściej niż co 15 min)
-- i widoczność dla HHL (brak cichej pustki). Zapis wyłącznie service_role (brak polityk zapisu).
create table if not exists integration_runs (
  id      bigserial primary key,
  job     text not null,
  ran_at  timestamptz not null default now(),
  ok      boolean not null,
  result  jsonb not null default '{}'::jsonb
);
create index if not exists integration_runs_job_idx on integration_runs (job, ran_at desc);
alter table integration_runs enable row level security;
drop policy if exists integration_runs_read_hhl on integration_runs;
create policy integration_runs_read_hhl on integration_runs for select to authenticated using (is_hhl());
