-- 0188 — TELM: podłączenie śledzenia w trasie NIE ustawia rzeczywistego załadunku
-- Polecenie koordynatora 05.10.2026 ~22:31 (Europe/Warsaw), zasada na stałe
-- (poprawka „transport już w trasie” z 0176):
-- * faza ustalona z pozycji (np. IN_TRANSIT_SE) zapisywana osobno
--   (telm_attach_phase), adnotacja „faza z pozycji przy podłączeniu”;
-- * loads.actual_load_at tylko z wyjazdu ze strefy załadunku (GPS, zdarzenie
--   niesyntetyczne) albo ręcznie przez dyspozytora; gdy nieznany — BAF i daty
--   z planu KSH (D-12: fuel_load_date bierze plan_load_date);
-- * syntetyczny GEOFENCE_EXIT LOADING (TELM_PHASE_INFER) zostaje wyłącznie dla
--   ETA (pre_load), nie jest rzeczywistym załadunkiem;
-- * korekta danych: transporty, którym 0176 wpisała actual_load_at = chwila
--   podłączenia → actual_load_at = null (przelicza wycenę, trigger 0187).

create table if not exists public.telm_attach_phase (
  load_id      uuid primary key references public.loads(id) on delete cascade,
  phase        text not null,
  observed_at  timestamptz not null,
  lat          double precision,
  lon          double precision,
  note         text not null default 'faza z pozycji przy podłączeniu',
  source       text not null default 'TELM_PHASE_INFER',
  created_at   timestamptz not null default now()
);
comment on table public.telm_attach_phase is
  'TELM (0188): faza transportu ustalona z pozycji przy podłączeniu śledzenia w trasie. Nie jest rzeczywistym załadunkiem (actual_load_at).';
alter table public.telm_attach_phase enable row level security;
revoke all on public.telm_attach_phase from anon, authenticated;
grant select on public.telm_attach_phase to authenticated;
drop policy if exists telm_attach_phase_read on public.telm_attach_phase;
create policy telm_attach_phase_read on public.telm_attach_phase
  for select to authenticated using (is_hhl());

create or replace function public.telm_infer_phase_from_position(
  p_load uuid, p_lat float8, p_lon float8, p_ts timestamptz default now()
) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_status load_status;
  v_phase text;
  v_ok boolean := false;
  v_ts timestamptz := coalesce(p_ts, now());
  v_gid uuid;
begin
  if p_load is null or p_lat is null or p_lon is null then return null; end if;
  select status into v_status from loads where id = p_load;
  if v_status is null or v_status in ('CANCELLED', 'UNLOADED', 'DELIVERED', 'AT_SITE', 'IN_TRANSIT_SE', 'AT_PORT_NYNASHAMN', 'FERRY') then
    return null;
  end if;

  if p_lat >= 55.0 and p_lon >= 11.0 and p_lon <= 25.0 and p_lat <= 70.0 then
    v_phase := 'IN_TRANSIT_SE';
  elsif p_lat >= 54.2 and p_lat < 55.0 and p_lon >= 17.0 and p_lon <= 20.5 then
    v_phase := 'FERRY';
  else
    return null;
  end if;

  -- Faza z pozycji — osobno, z adnotacją (0188). Nie rusza actual_load_at.
  insert into telm_attach_phase (load_id, phase, observed_at, lat, lon)
  values (p_load, v_phase, v_ts, p_lat, p_lon)
  on conflict (load_id) do nothing;

  -- ETA-PRE-LOAD: syntetyczny GEOFENCE_EXIT LOADING tylko dla ETA (synthetic=true,
  -- nie jest rzeczywistym załadunkiem).
  select id into v_gid from geofences
   where kind = 'LOADING' and active
   order by sort_order nulls last, name
   limit 1;
  insert into load_events (load_id, event_type, occurred_at, payload, dedup_key)
  values (
    p_load, 'GEOFENCE_EXIT', v_ts,
    jsonb_build_object(
      'geofence_id', v_gid,
      'geofence_kind', 'LOADING',
      'synthetic', true,
      'zrodlo', 'TELM_PHASE_INFER',
      'powod', 'faza z pozycji przy podłączeniu',
      'actual_load', false
    ),
    'TELM_PHASE_EXIT_LOAD:' || p_load::text
  )
  on conflict (dedup_key) where dedup_key is not null do nothing;

  v_ok := auto_set_status(
    p_load, v_status, v_phase::load_status,
    'faza z pozycji przy podłączeniu',
    v_ts,
    jsonb_build_object(
      'zrodlo', 'TELM_PHASE_INFER',
      'lat', p_lat, 'lon', p_lon,
      'powod', 'faza z pozycji przy podłączeniu'
    )
  );

  insert into load_events (load_id, event_type, occurred_at, payload, dedup_key)
  values (
    p_load, 'STATUS_AUTO', v_ts,
    jsonb_build_object(
      'from', v_status,
      'to', case when v_ok then v_phase else v_status::text end,
      'target_phase', v_phase,
      'status_applied', v_ok,
      'powod', 'faza z pozycji przy podłączeniu',
      'zrodlo', 'TELM_PHASE_INFER',
      'lat', p_lat, 'lon', p_lon
    ),
    'TELM_PHASE_INFER:' || p_load::text || ':' || v_phase
  )
  on conflict (dedup_key) where dedup_key is not null do nothing;

  begin
    perform public.refresh_load_eta(p_load);
  exception when others then
    null;
  end;

  return v_phase;
end $$;
revoke all on function public.telm_infer_phase_from_position(uuid, float8, float8, timestamptz) from public, anon, authenticated;
grant execute on function public.telm_infer_phase_from_position(uuid, float8, float8, timestamptz) to service_role;
comment on function public.telm_infer_phase_from_position(uuid, float8, float8, timestamptz) is
  'TELM (0188): podłączenie w trasie — faza z pozycji do telm_attach_phase + status + syntetyczny EXIT dla ETA. Nie ustawia actual_load_at.';

-- Korekta: actual_load_at wpisany przez 0176 = chwila podłączenia (syntetyczny EXIT),
-- bez niesyntetycznego wyjazdu ze strefy załadunku → null. Zwraca listę poprawionych.
create or replace function public.telm_fix_attach_actual_load()
returns table (load_id uuid, order_no text, cleared_actual_load_at timestamptz, phase text, fuel_load_date date)
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in
    select l.id, l.order_no, l.actual_load_at, e.occurred_at, e.payload,
           (select s.payload->>'target_phase' from load_events s
             where s.load_id = l.id and s.dedup_key like 'TELM_PHASE_INFER:%'
             order by s.occurred_at limit 1) as ph
      from loads l
      join load_events e on e.load_id = l.id and e.dedup_key = 'TELM_PHASE_EXIT_LOAD:' || l.id::text
     where l.actual_load_at is not null
       and l.actual_load_at = e.occurred_at
       and not exists (
         select 1 from load_events g
          where g.load_id = l.id and g.event_type = 'GEOFENCE_EXIT'
            and coalesce(g.payload->>'geofence_kind', '') = 'LOADING'
            and coalesce(g.payload->>'synthetic', 'false') <> 'true')
  loop
    insert into telm_attach_phase (load_id, phase, observed_at, lat, lon)
    values (r.id, coalesce(r.ph, 'IN_TRANSIT_SE'), r.occurred_at, null, null)
    on conflict on constraint telm_attach_phase_pkey do nothing;

    update loads set actual_load_at = null, updated_at = now() where id = r.id;

    -- historia zmian: trigger audytu loads (0118)

    load_id := r.id; order_no := r.order_no; cleared_actual_load_at := r.actual_load_at;
    phase := coalesce(r.ph, 'IN_TRANSIT_SE'); fuel_load_date := public.fuel_load_date(r.id);
    return next;
  end loop;
end $$;
revoke all on function public.telm_fix_attach_actual_load() from public, anon, authenticated;

select * from public.telm_fix_attach_actual_load();
