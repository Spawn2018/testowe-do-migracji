-- =====================================================================
-- TOWER — Migracja 0147: DWELL_OVER_FREE (decyzja nr 15)
--
-- Polecenie właściciela 2026-10-04 14:43 (czas warszawski).
-- Parametry wyłącznie w ops_thresholds, sekcja „Czas wolny i przestój".
-- Wartości domyślne WSTĘPNE. Brak wiersza w Opcjach = brak decyzji
-- (bez sztywnych 360/240).
-- Dopłata NIE jest zapisywana. Decyzja trzyma hint_eur. Kwotę wpisuje
-- HHL ręcznie (load_agreed_fee_add, OPL-8).
-- a) DWELL_START_LATER = 1 → start = późniejsze z wjazdu i planu; 2 → od wjazdu
-- b) DWELL_FULL_HOUR = 1 → rozpoczęta godzina w całości; 2 → ułamek godziny
-- c) postój (minuty od startu) > DWELL_DAY_AFTER_H → stawka dobowa za
--    każdą rozpoczętą dobę (24 h), zamiast stawki godzinowej
-- =====================================================================

do $$
declare c text;
begin
  select con.conname into c
    from pg_constraint con
   where con.conrelid = 'public.ops_thresholds'::regclass
     and con.contype = 'c'
     and pg_get_constraintdef(con.oid) like '%WAVE_M%';
  if c is not null then
    execute format('alter table public.ops_thresholds drop constraint %I', c);
  end if;
end $$;

alter table public.ops_thresholds
  add constraint ops_thresholds_key_check check (key in (
    'WAVE_M','GUST_KN','DELAY_MIN','LEAD_DAYS',
    'AWIZ_EARLY_H','AWIZ_LATE_H','DOC_WARN_H','DOC_CRIT_H',
    'SILENT_MIN','OFFROUTE_KM',
    'DWELL_FREE_LOAD_H','DWELL_FREE_UNLOAD_H','DWELL_HOURLY_EUR','DWELL_DAILY_EUR',
    'DWELL_START_LATER','DWELL_FULL_HOUR','DWELL_DAY_AFTER_H'
  ));

insert into public.ops_thresholds (key, value_num, unit, label_pl) values
  ('DWELL_FREE_LOAD_H',   6,   'h',     'Czas wolny załadunek (WSTĘPNE)'),
  ('DWELL_FREE_UNLOAD_H', 4,   'h',     'Czas wolny rozładunek (WSTĘPNE)'),
  ('DWELL_HOURLY_EUR',    75,  'EUR/h', 'Godzina ponad czas wolny (WSTĘPNE)'),
  ('DWELL_DAILY_EUR',     750, 'EUR/d', 'Przestój za rozpoczętą dobę (WSTĘPNE)'),
  ('DWELL_START_LATER',   1,   '1=później 2=wjazd', 'Start liczenia: 1 późniejsze z wjazdu i planu (WSTĘPNE)'),
  ('DWELL_FULL_HOUR',     1,   '1=cała godzina 2=ułamek', 'Rozpoczęta godzina liczy się w całości (WSTĘPNE)'),
  ('DWELL_DAY_AFTER_H',   24,  'h',     'Powyżej tylu godzin stawka dobowa (WSTĘPNE)')
on conflict (key) do nothing;

create or replace function public.admin_ops_threshold_set(p_key text, p_value numeric)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid;
  v_role text;
  v_old numeric;
begin
  select id, role::text into v_me, v_role from app_users where auth_id = auth.uid() and active;
  if (v_me is not null and v_role = 'HHL_ADMIN') is not true then
    raise exception 'Progi — wyłącznie administrator HHL' using errcode = '42501';
  end if;
  if (p_key in (
    'WAVE_M','GUST_KN','DELAY_MIN','LEAD_DAYS',
    'AWIZ_EARLY_H','AWIZ_LATE_H','DOC_WARN_H','DOC_CRIT_H',
    'SILENT_MIN','OFFROUTE_KM',
    'DWELL_FREE_LOAD_H','DWELL_FREE_UNLOAD_H','DWELL_HOURLY_EUR','DWELL_DAILY_EUR',
    'DWELL_START_LATER','DWELL_FULL_HOUR','DWELL_DAY_AFTER_H'
  )) is not true then
    raise exception 'Nieznany próg' using errcode = '22023';
  end if;
  if (p_value is not null and p_value > 0) is not true then
    raise exception 'Wartość progu musi być > 0' using errcode = '22023';
  end if;
  select value_num into v_old from ops_thresholds where key = p_key for update;
  if (v_old is not null) is not true then
    raise exception 'Brak wiersza progu' using errcode = 'P0002';
  end if;
  update ops_thresholds
     set value_num = p_value, updated_at = now(), updated_by = v_me
   where key = p_key;
  insert into audit_log (user_id, action, entity, entity_id, new_value)
  values (v_me, 'OPS_THRESHOLD_SET', 'ops_thresholds', p_key,
          jsonb_build_object('from', v_old, 'to', p_value));
end $$;
revoke all on function public.admin_ops_threshold_set(text, numeric) from public, anon;
grant execute on function public.admin_ops_threshold_set(text, numeric) to authenticated;

create or replace function public.fee_catalog_hints()
returns table (
  code text,
  label_pl text,
  hint_text text,
  amount_eur numeric,
  unit text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if current_app_user_id() is null then
    return;
  end if;
  return query
  select t.code, t.label_pl, t.hint_text, t.amount_eur, t.unit
    from (
      select 'FREE_LOAD'::text as code,
             'Czas wolny załadunek'::text as label_pl,
             'WSTĘPNE — z Opcji; dalsze godziny uzgodnić'::text as hint_text,
             (select value_num from ops_thresholds where key = 'DWELL_FREE_LOAD_H') as amount_eur,
             'h'::text as unit
      union all
      select 'FREE_UNLOAD', 'Czas wolny rozładunek', 'WSTĘPNE — z Opcji; dalsze godziny uzgodnić',
             (select value_num from ops_thresholds where key = 'DWELL_FREE_UNLOAD_H'), 'h'
      union all
      select 'HOURLY', 'Godzina ponad czas wolny', 'WSTĘPNE — podpowiedź z Opcji, nie automat',
             (select value_num from ops_thresholds where key = 'DWELL_HOURLY_EUR'), 'EUR/h'
      union all
      select 'DAILY', 'Przestój dobowy', 'WSTĘPNE — podpowiedź z Opcji, nie automat',
             (select value_num from ops_thresholds where key = 'DWELL_DAILY_EUR'), 'EUR/d'
      union all
      select * from (values
        ('CANCEL_5', 'Anulowanie ≥5 dni', '0% frachtu (podpowiedź)', 0::numeric, '%'),
        ('CANCEL_4', 'Anulowanie 4 dni', '15% frachtu (podpowiedź)', 15::numeric, '%'),
        ('CANCEL_3', 'Anulowanie 3 dni', '25% frachtu (podpowiedź)', 25::numeric, '%'),
        ('CANCEL_1', 'Anulowanie 1 dzień', '50% frachtu (podpowiedź)', 50::numeric, '%'),
        ('CANCEL_0', 'Anulowanie w dniu załadunku', '100% frachtu (podpowiedź)', 100::numeric, '%')
      ) as c(code, label_pl, hint_text, amount_eur, unit)
    ) t;
end $$;
revoke all on function public.fee_catalog_hints() from public, anon;
grant execute on function public.fee_catalog_hints() to authenticated;

-- Pomiar postoju. Bez EXECUTE dla ról API.
create or replace function public.dwell_measure(p_load uuid, p_now timestamptz default now())
returns table (
  zone_kind text,
  entered_at timestamptz,
  start_at timestamptz,
  exited_at timestamptz,
  dwell_minutes numeric,
  free_minutes numeric,
  over_minutes numeric,
  mode text,
  hint_eur numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_free_load numeric := l3_ops('DWELL_FREE_LOAD_H');
  v_free_unload numeric := l3_ops('DWELL_FREE_UNLOAD_H');
  v_hourly numeric := l3_ops('DWELL_HOURLY_EUR');
  v_daily numeric := l3_ops('DWELL_DAILY_EUR');
  v_start_mode numeric := l3_ops('DWELL_START_LATER');
  v_full numeric := l3_ops('DWELL_FULL_HOUR');
  v_day_after numeric := l3_ops('DWELL_DAY_AFTER_H');
begin
  if v_free_load is null or v_free_unload is null or v_hourly is null or v_daily is null
     or v_start_mode is null or v_full is null or v_day_after is null then
    return;
  end if;
  return query
  with enters as (
    select e.occurred_at as entered_at,
           coalesce(e.payload->>'geofence_kind', g.kind::text) as zone_kind,
           case
             when e.payload->>'geofence_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
               then (e.payload->>'geofence_id')::uuid
           end as gid
      from load_events e
      left join geofences g on g.id = case
             when e.payload->>'geofence_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
               then (e.payload->>'geofence_id')::uuid
           end
     where e.load_id = p_load
       and e.event_type = 'GEOFENCE_ENTER'
       and coalesce(e.payload->>'geofence_kind', g.kind::text) in ('LOADING', 'SITE')
  ),
  paired as (
    select en.zone_kind,
           en.entered_at,
           (
             select min(x.occurred_at) from load_events x
              where x.load_id = p_load
                and x.event_type = 'GEOFENCE_EXIT'
                and x.occurred_at > en.entered_at
                and (
                  (en.gid is not null and case
                    when x.payload->>'geofence_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                      then (x.payload->>'geofence_id')::uuid
                  end = en.gid)
                  or en.gid is null
                )
           ) as exited_at
      from enters en
  ),
  plan as (
    select
      case
        when l.plan_load_from is not null then l.plan_load_from
        else l3_anchor(l.plan_load_date, l.plan_load_to)
      end as load_plan,
      case
        when l.plan_delivery_from is not null then l.plan_delivery_from
        else l3_anchor(l.plan_delivery_date, l.plan_delivery_to)
      end as unload_plan
      from loads l where l.id = p_load
  ),
  timed as (
    select p.zone_kind,
           p.entered_at,
           p.exited_at,
           case
             when v_start_mode = 1 and p.zone_kind = 'LOADING' and (select load_plan from plan) is not null
               then greatest(p.entered_at, (select load_plan from plan))
             when v_start_mode = 1 and p.zone_kind = 'SITE' and (select unload_plan from plan) is not null
               then greatest(p.entered_at, (select unload_plan from plan))
             else p.entered_at
           end as start_at
      from paired p
  ),
  mins as (
    select t.zone_kind, t.entered_at, t.start_at, t.exited_at,
           coalesce(t.exited_at, p_now) as end_at,
           case when t.zone_kind = 'LOADING' then v_free_load * 60 else v_free_unload * 60 end as free_m
      from timed t
  )
  select m.zone_kind,
         m.entered_at,
         m.start_at,
         m.exited_at,
         case when m.end_at <= m.start_at then 0
              else round(extract(epoch from (m.end_at - m.start_at)) / 60.0, 1)
         end as dwell_minutes,
         m.free_m as free_minutes,
         greatest(0, round(extract(epoch from (greatest(m.end_at, m.start_at) - m.start_at)) / 60.0, 1) - m.free_m) as over_minutes,
         case
           when m.end_at <= m.start_at then 'NONE'
           when extract(epoch from (m.end_at - m.start_at)) / 60.0 > v_day_after * 60 then 'DAILY'
           when extract(epoch from (m.end_at - m.start_at)) / 60.0 > m.free_m then 'HOURLY'
           else 'NONE'
         end as mode,
         case
           when m.end_at <= m.start_at then 0
           when extract(epoch from (m.end_at - m.start_at)) / 60.0 > v_day_after * 60 then
             ceil(extract(epoch from (m.end_at - m.start_at)) / 60.0 / 1440.0) * v_daily
           when extract(epoch from (m.end_at - m.start_at)) / 60.0 > m.free_m then
             (case when v_full = 1
                   then ceil((extract(epoch from (m.end_at - m.start_at)) / 60.0 - m.free_m) / 60.0)
                   else (extract(epoch from (m.end_at - m.start_at)) / 60.0 - m.free_m) / 60.0
              end) * v_hourly
           else 0
         end as hint_eur
    from mins m
   order by m.entered_at;
end $$;
revoke all on function public.dwell_measure(uuid, timestamptz) from public, anon, authenticated;

create or replace function public.load_dwell_info(p_load uuid)
returns table (
  zone_kind text,
  entered_at timestamptz,
  exited_at timestamptz,
  dwell_minutes numeric,
  free_minutes numeric,
  over_free_minutes numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and current_app_user_id() is null then
    raise exception 'Brak aktywnego konta' using errcode = '42501';
  end if;
  if (is_hhl() is true
      or exists (select 1 from loads l where l.id = p_load and l.carrier_org_id = current_org_id())
      or exists (
           select 1 from loads l join projects p on p.id = l.project_id
            where l.id = p_load and p.client_org_id = current_org_id()
         )
     ) is not true then
    raise exception 'Brak dostępu do transportu' using errcode = '42501';
  end if;
  return query
  select d.zone_kind, d.entered_at, d.exited_at, d.dwell_minutes, d.free_minutes, d.over_minutes
    from dwell_measure(p_load, now()) d;
end $$;
revoke all on function public.load_dwell_info(uuid) from public, anon;
grant execute on function public.load_dwell_info(uuid) to authenticated;

create or replace function public.dwell_scan(p_load uuid default null, p_now timestamptz default now())
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  d record;
  n int := 0;
  v_id uuid;
begin
  for r in
    select l.id, l.project_id, coalesce(l.order_no, left(l.id::text, 8)) as code
      from loads l
     where l.status is distinct from 'CANCELLED'
       and (p_load is null or l.id = p_load)
  loop
    for d in
      select * from dwell_measure(r.id, p_now) m
       where m.mode in ('HOURLY', 'DAILY') and m.hint_eur > 0
    loop
      v_id := decision_open_from_event(
        r.project_id, 'DWELL_OVER_FREE',
        'dwell:' || r.id::text || ':' || d.zone_kind || ':' || d.entered_at::text,
        'Postój ponad czas wolny',
        jsonb_build_object(
          'code', r.code,
          'zone', d.zone_kind,
          'entered_at', d.entered_at,
          'start_at', d.start_at,
          'exited_at', d.exited_at,
          'dwell_minutes', d.dwell_minutes,
          'free_minutes', d.free_minutes,
          'over_minutes', d.over_minutes,
          'mode', d.mode,
          'hint_eur', d.hint_eur,
          'preliminary', true,
          'note', 'Podpowiedź z Opcji (WSTĘPNE). Dopłatę wpisuje HHL ręcznie.'
        ),
        r.id, null
      );
      if v_id is not null then
        n := n + 1;
      end if;
    end loop;
  end loop;
  return n;
end $$;
revoke all on function public.dwell_scan(uuid, timestamptz) from public, anon, authenticated;

create or replace function public.dwell_on_zone_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.event_type in ('GEOFENCE_ENTER', 'GEOFENCE_EXIT') then
    perform dwell_scan(new.load_id, coalesce(new.occurred_at, now()));
  end if;
  return new;
end $$;
revoke all on function public.dwell_on_zone_event() from public, anon, authenticated;

drop trigger if exists trg_dwell_zone on public.load_events;
create trigger trg_dwell_zone
  after insert on public.load_events
  for each row
  when (new.event_type in ('GEOFENCE_ENTER', 'GEOFENCE_EXIT'))
  execute function public.dwell_on_zone_event();
create or replace function public.detect_silent_vehicles(p_minutes integer default 90)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n int := 0;
  r record;
  v_min int;
  v_connected boolean;
  v_moving boolean;
begin
  perform l1b_scan();
  perform dwell_scan(null, now());
  v_min := l3_ops('SILENT_MIN')::int;
  if v_min is null then
    return 0;
  end if;
  for r in
    select l.id, l.project_id, l.tractor_plate, l.status, l.telematics_vehicle_id,
           max(p.ts) as last_fix
      from loads l
      left join positions p on p.load_id = l.id
     group by l.id
  loop
    v_moving := r.status in ('IN_TRANSIT_PL', 'AT_PORT_GDANSK', 'AT_PORT_NYNASHAMN', 'IN_TRANSIT_SE');
    v_connected := r.telematics_vehicle_id is not null or exists (
      select 1 from positions p
       where p.load_id = r.id and p.source in ('TELEMATICS_API', 'RFMS', 'DRIVER_PWA')
    );
    if l3_silent_alarm(r.last_fix, now(), v_connected, v_moving) is not true then
      update risk_signals set resolved_at = now()
       where dedup_key = 'SILENT:' || r.id and resolved_at is null and detail->>'l3' = '1';
      if found then
        perform l3_lapse('SILENT:' || r.id, now());
      end if;
      continue;
    end if;
    n := n + l3_upsert_alarm(
      r.project_id, r.id, 'SILENT_VEHICLE', 'SILENT:' || r.id,
      format('Brak pozycji pojazdu %s od %s min', coalesce(r.tractor_plate, '?'), v_min),
      'rk_silent_vehicle',
      true,
      true,
      now() + interval '1 hour',
      jsonb_build_object(
        'last_fix', r.last_fix, 'threshold_min', v_min,
        'params', jsonb_build_object('plate', coalesce(r.tractor_plate, '?'), 'minutes', v_min)
      ),
      now()
    );
  end loop;
  return n;
end $$;

revoke all on function public.detect_silent_vehicles(integer) from public, anon, authenticated;
