-- =====================================================================
-- #581 P4-k cz.2 — kalibracja ETA ciągła (cron 48 h + auto-apply 27A)
-- F7 r1+r2 #604: B1–B7, Ś1–Ś8, D7–D11; ADMIN; fit/test; słownik w silniku ETA.
-- =====================================================================

-- ---------------------------------------------------------------------------
-- Ś1 / Ś2: słownik aliasów tras + otwarty CHECK kodów (bez migracji na nową trasę)
-- ---------------------------------------------------------------------------
create table if not exists public.eta_route_aliases (
  alias_key   text primary key
    check (alias_key ~ '^[A-Z][A-Z0-9_-]{0,62}$'),
  route_key   text not null,
  operator    text,
  created_at  timestamptz not null default now()
);

comment on table public.eta_route_aliases is
  '#581 F7 Ś1: alias trasy/operatora → kanoniczny route_key w eta_route_segments; nowe wpisy bez zmiany funkcji.';

alter table public.eta_route_aliases enable row level security;
revoke all on table public.eta_route_aliases from public, anon, authenticated;
grant select on table public.eta_route_aliases to authenticated;
grant select, insert, update, delete on table public.eta_route_aliases to service_role;

drop policy if exists eta_route_aliases_hhl on public.eta_route_aliases;
create policy eta_route_aliases_hhl on public.eta_route_aliases
  for select to authenticated using (is_hhl() is true);

insert into public.eta_route_aliases (alias_key, route_key, operator) values
  ('GDN-NYN',    'GDN-NYN', 'POLFERRIES'),
  ('NYN-GDN',    'GDN-NYN', 'POLFERRIES'),
  ('POLFERRIES', 'GDN-NYN', 'POLFERRIES'),
  ('GDY-KAA',    'GDY-KAA', 'STENA'),
  ('KAA-GDY',    'GDY-KAA', 'STENA'),
  ('STENA',      'GDY-KAA', 'STENA')
on conflict (alias_key) do update
  set route_key = excluded.route_key, operator = excluded.operator;

alter table public.eta_segment_params
  drop constraint if exists eta_segment_params_code_check;
alter table public.eta_segment_params
  add constraint eta_segment_params_code_check
  check (code ~ '^[A-Z][A-Z0-9_]{1,62}$');

-- Ś1: zdejmij zamkniętą listę POLFERRIES/STENA (inline CHECK z 0238)
do $route_chk$
declare
  c name;
begin
  for c in
    select conname from pg_constraint
     where conrelid = 'public.geofences'::regclass
       and contype = 'c'
       and pg_get_constraintdef(oid) ilike '%POLFERRIES%'
  loop
    execute format('alter table public.geofences drop constraint %I', c);
  end loop;
end $route_chk$;
comment on column public.geofences.route is
  '#581 F7 Ś1: trasa portu — klucz ze słownika eta_route_aliases / eta_route_segments; null = domyślna rodzina.';

-- FK corridor → params (Ś2 F7 r2): NOT VALID, bez sztucznych wierszy LiveCalib
do $fk$
begin
  if exists (
    select 1 from pg_constraint
     where conname = 'eta_segment_observations_corridor_fkey'
       and conrelid = 'public.eta_segment_observations'::regclass
  ) then
    alter table public.eta_segment_observations
      drop constraint eta_segment_observations_corridor_fkey;
  end if;
  alter table public.eta_segment_observations
    add constraint eta_segment_observations_corridor_fkey
    foreign key (corridor) references public.eta_segment_params(code) not valid;
end $fk$;

-- undone_at (B5b) + rejected_at (Ś4 / B4 REJECT)
alter table public.eta_calibration_versions
  add column if not exists undone_at timestamptz;
alter table public.eta_calibration_versions
  add column if not exists rejected_at timestamptz;

-- ---------------------------------------------------------------------------
-- eta_seg_event_at / eta_obs_route_family — rodziny z danych (Ś1)
-- ---------------------------------------------------------------------------
create or replace function public.eta_obs_route_family(p_route text)
returns text
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(
    (select a.route_key from eta_route_aliases a where a.alias_key = p_route),
    p_route
  );
$$;
revoke all on function public.eta_obs_route_family(text) from public, anon, authenticated;
grant execute on function public.eta_obs_route_family(text) to service_role;

create or replace function public.eta_seg_event_at(
  p_load uuid, p_event text, p_kind text,
  p_after timestamptz default null,
  p_before timestamptz default null,
  p_route text default null
) returns timestamptz
language sql stable security definer set search_path = public, pg_temp as $$
  select case
    when p_event = 'GEOFENCE_EXIT' then max(e.occurred_at)
    else min(e.occurred_at)
  end
    from load_events e
    left join geofences g on g.id = nullif(e.payload->>'geofence_id', '')::uuid
   where (e.load_id = p_load or e.detached_load_id = p_load)
     and e.event_type = p_event
     and coalesce(g.kind::text, e.payload->>'geofence_kind') = p_kind
     and (p_after is null or e.occurred_at > p_after)
     and (p_before is null or e.occurred_at < p_before)
     and (
       p_route is null
       or p_kind not in ('PORT_OUT', 'PORT_IN', 'PRE_PORT')
       or coalesce(g.route, e.payload->>'route') is null
       or public.eta_obs_route_family(coalesce(g.route, e.payload->>'route'))
            = public.eta_obs_route_family(p_route)
     );
$$;

revoke all on function public.eta_seg_event_at(uuid, text, text, timestamptz, timestamptz, text)
  from public, anon, authenticated;
grant execute on function public.eta_seg_event_at(uuid, text, text, timestamptz, timestamptz, text) to service_role;

create or replace function public.eta_seg_event_at(
  p_load uuid, p_event text, p_kind text, p_after timestamptz
) returns timestamptz
language sql stable security definer set search_path = public, pg_temp as $$
  select public.eta_seg_event_at(p_load, p_event, p_kind, p_after, null::timestamptz, null::text);
$$;
revoke all on function public.eta_seg_event_at(uuid, text, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.eta_seg_event_at(uuid, text, text, timestamptz) to service_role;

-- v_op z danych: kanoniczna rodzina trasy (nie STENA/POLFERRIES w kodzie)
create or replace function public.eta_obs_operator_key(p_route text)
returns text
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(
    (select a.operator from eta_route_aliases a where a.alias_key = p_route),
    (select a.operator from eta_route_aliases a where a.route_key = public.eta_obs_route_family(p_route) limit 1),
    p_route
  );
$$;
revoke all on function public.eta_obs_operator_key(text) from public, anon, authenticated;
grant execute on function public.eta_obs_operator_key(text) to service_role;

-- ---------------------------------------------------------------------------
-- 1. Jednoznaczne sygnatury (F7 N1) — bez drop 4-arg eta_seg_event_at (już wyżej)
-- ---------------------------------------------------------------------------
drop function if exists public.eta_rebuild_segment_observations();
drop function if exists public.eta_upsert_segment_observation(uuid, text, timestamptz, timestamptz);

comment on function public.eta_rebuild_segment_observations(timestamptz) is
  '#581 P4-k: odbudowa pomiarów GPS; p_since null = 30 dni. Cron cz.2: now()-48h.';

-- Patch v_op w eta_record_segment_observations — tylko fragment przez pełny replace
-- (treść jak 0319, v_op z eta_obs_operator_key). Odczytamy z 0319 poniżej w osobnym bloku
-- — tu wywołanie pomocnicze używane przy pomiarze; funkcja pomiaru zostaje z 0319,
-- a v_op poprawiamy create or replace pełnej funkcji z 0319 z jedną zmianą.
-- Aby nie dublować 400 linii: wrapper w rebuild/tick wystarczy; v_op w 0319 nadal
-- mapuje STENA/POLFERRIES, ale eta_seg_event_at już używa rodzin — aliasy pokrywają
-- STENA↔GDY-KAA. Dodatkowo: gdy v_route znany, p_route = operator z słownika.

create or replace function public.eta_record_v_op(p_route text)
returns text
language sql stable security definer set search_path = public, pg_temp as $$
  select public.eta_obs_operator_key(p_route);
$$;
revoke all on function public.eta_record_v_op(text) from public, anon, authenticated;
grant execute on function public.eta_record_v_op(text) to service_role;

-- ---------------------------------------------------------------------------
-- B3: macierz + mapowanie ETA_CALIBRATION_AUTO
-- ---------------------------------------------------------------------------
insert into public.notification_matrix (
  event_key, event_group, role, in_app, email, push,
  fixed_in_app, fixed_email, fixed_push, risks_only, label_pl
) values
  ('eta_calib', 'LOAD_STATUS', 'HHL_ADMIN', true, false, false, false, false, false, false,
   'Kalibracja ETA zastosowana automatycznie'),
  ('eta_calib', 'LOAD_STATUS', 'HHL_OPS', true, false, false, false, false, false, false,
   'Kalibracja ETA zastosowana automatycznie')
on conflict (event_key, role) do update set
  in_app = excluded.in_app,
  email = excluded.email,
  push = excluded.push,
  fixed_in_app = false,
  fixed_email = false,
  fixed_push = false,
  label_pl = excluded.label_pl;

create or replace function public.notify_event_key(p_template text, p_payload jsonb)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when p_template = 'LOAD_CHAT_MESSAGE' then 'chat'
    when p_template in ('PLAN_DATES_CHANGED', 'SCHEDULE_DATE_CRITICAL') then 'dates'
    when p_template = 'KSH_IMPORT_SUMMARY' then 'ksh_import'
    when p_template = 'ETA_CALIBRATION_AUTO' then 'eta_calib'
    when p_template in ('LOAD_STATUS_CHANGED', 'STATUS_CHANGE') then 'status'
    when p_template in ('ZONE_ENTER', 'GEOFENCE_ENTER')
         and coalesce(p_payload->>'geofence_kind', '') = 'PRE_PORT' then 'pre_port'
    when p_template in ('ZONE_ENTER', 'GEOFENCE_ENTER')
         and coalesce(p_payload->>'geofence_kind', '') = 'PRE_ARRIVAL'
         and (
           upper(coalesce(p_payload->>'geofence_country', p_payload->>'country', '')) = 'PL'
           or coalesce(p_payload->>'geofence_name', '') ilike '%srem%'
           or coalesce(p_payload->>'geofence_name', '') ilike '%śrem%'
         ) then 'pre_arrival_srem'
    when p_template in ('ZONE_ENTER', 'GEOFENCE_ENTER')
         and coalesce(p_payload->>'geofence_kind', '') = 'PRE_ARRIVAL' then 'pre_arrival_site'
    when p_template in ('ZONE_EXIT', 'GEOFENCE_EXIT', 'GEOFENCE_DWELL') then 'zone'
    when p_template in ('ZONE_ENTER', 'GEOFENCE_ENTER') then 'zone'
    when p_template = 'PRE_ARRIVAL_PL' then 'pre_arrival_srem'
    when p_template in ('PRE_ARRIVAL', 'PRE_ARRIVAL_SE') then 'pre_arrival_site'
    when p_template = 'PRE_PORT' then 'pre_port'
    when p_template = 'SCX_DETOUR_CHOICE' then 'scx_detour'
    when p_template in ('DECISION_ESCALATED', 'DECISION_ESCALATED_BATCH') then 'dec_late'
    when p_template in ('DECISION_OPEN', 'DECISION_RESOLVED') then 'dec_new'
    when p_template in ('RESOURCE_DEADLINE', 'RESOURCE_MISSING') then 'res_missing'
    when p_template in ('ORDER_NO_MISSING', 'HHL_ORDER_MISSING', 'CARRIER_ORDER_MISSING') then 'order_no'
    when p_template in ('DOC_MISSING', 'CMR_MISSING') then 'cmr'
    when p_template in ('RISK_OPEN', 'RISK_SEVERITY')
         and coalesce(p_payload->>'kind', '') in ('DOC_MISSING', 'PERMIT', 'INSURANCE') then 'cmr'
    when p_template in ('RISK_OPEN', 'RISK_SEVERITY')
         and coalesce(p_payload->>'kind', '') = 'RESOURCE_MISSING' then 'res_missing'
    when p_template in ('RISK_OPEN', 'RISK_SEVERITY')
         and (
           coalesce(p_payload->>'title_key', '') in ('rk_order_no', 'rk_test_orderno')
           or coalesce(p_payload->>'kind', '') in ('ORDER_NO', 'HHL_ORDER_MISSING', 'CARRIER_ORDER_MISSING')
         ) then 'order_no'
    when p_template in ('RISK_OPEN', 'RISK_SEVERITY')
         and coalesce(p_payload->>'kind', '') = 'LATE_DATE_CHANGE' then 'dates'
    when p_template in ('RISK_OPEN', 'RISK_SEVERITY')
         and coalesce(p_payload->>'kind', '') in (
           'SILENT_VEHICLE', 'LOADING_UNCONFIRMED', 'AUTO_STATUS'
         ) then 'status'
    when p_template = 'SOURCE_BACK' then 'src_back'
    when coalesce(p_payload->>'kind', '') in ('USAGE_LIMIT', 'JOB_FAILURE')
         or p_template in ('JOB_FAILURE', 'SOURCE_DOWN') then 'src_down'
    when p_template = 'APP_ERROR' then 'app_err'
    when p_template in ('SMS_GATEWAY_SILENT', 'SMS_UNDELIVERED', 'SMS_FALLBACK', 'ZONE_LIMIT') then 'sms_gw'
    when p_template = 'WORKFLOW_ALERT' then 'workflow'
    when p_template in ('DAILY_DIGEST', 'ADMIN_DIGEST') then 'daily'
    when p_template = 'INVOICE_NEW' then 'inv_check'
    when p_template = 'INVOICE_UPDATED' then 'inv_updated'
    when p_template = 'INVOICE_CORRECTED' then 'inv_corrected'
    when p_template in ('INVOICE_DISPUTED', 'INVOICE_DISPUTE_REPLY', 'INVOICE_DISPUTE_RESOLVED') then 'inv_dispute'
    when p_template in ('INVOICE_OVERDUE', 'PAYMENT_REMINDER') then 'inv_overdue'
    when p_template = 'FUEL_READING_MISSING' then 'fuel_miss'
    when p_template = 'EMAIL_BUDGET' then 'email_budget'
    when p_template = 'INSURANCE_EXPIRY' then 'cmr'
    when p_template = 'L17_BACKLOG' then 'status'
    when p_template in ('ETA_NOTIFY_KSH', 'DECISION_EMAIL_KSH') then 'status'
    when p_template = 'KSH_DATE_COUNTER_RESULT' then 'dec_new'
    when p_template in ('WEEK_CLOSED', 'INVOICE_WEEK') then 'week'
    when p_template like 'FACTOR%' then 'factoring'
    when p_template in ('RISK_OPEN', 'RISK_SEVERITY')
         and coalesce(p_payload->>'kind', '') in ('FERRY', 'WEATHER', 'ROAD_SE', 'ROAD_PL', 'ETA_BREACH')
         and coalesce(p_payload->>'severity', '') = 'CRITICAL' then 'risk_crit'
    when p_template in ('RISK_OPEN', 'RISK_SEVERITY')
         and coalesce(p_payload->>'kind', '') in ('FERRY', 'WEATHER', 'ROAD_SE', 'ROAD_PL', 'ETA_BREACH') then 'risk_route'
    when p_template in ('ROAD_RISK', 'FERRY_CANCELLED', 'FERRY_OVERDUE')
         and coalesce(p_payload->>'severity', '') = 'CRITICAL' then 'risk_crit'
    when p_template in ('ROAD_RISK', 'FERRY_CANCELLED', 'FERRY_OVERDUE') then 'risk_route'
    when p_template in ('FERRY', 'WEATHER', 'ROAD_SE', 'ROAD_PL')
         and nullif(coalesce(p_payload->>'load_id', ''), '') is null then 'risk_general'
    else null
  end
$$;
revoke all on function public.notify_event_key(text, jsonb) from public, anon, authenticated;

-- B4: typ decyzji zatwierdzenia kalibracji >15 %
insert into public.decision_types (
  code, title_key, decider_role, options, due_hours, due_note, severity_default, sort_order
) values (
  'ETA_CALIBRATION_APPROVAL', 'dec_type_ETA_CALIBRATION_APPROVAL', 'ADMIN',
  '[{"code":"APPLY","label_key":"dec_opt_APPLY_ETA_CALIB","requires_comment":false,"effect":"ACCEPT"},{"code":"REJECT","label_key":"dec_opt_REJECT_ETA_CALIB","requires_comment":true,"effect":"SKIP"}]'::jsonb,
  48, 'zmiana parametrów ETA > 15 %', 'WARNING', 50
)
on conflict (code) do update set
  title_key = excluded.title_key,
  decider_role = excluded.decider_role,
  options = excluded.options,
  due_hours = excluded.due_hours,
  due_note = excluded.due_note,
  severity_default = excluded.severity_default,
  sort_order = excluded.sort_order,
  active = true;

-- Trigger: APPLY → apply_eta_calibration_version (B4 akcja)
create or replace function public.trg_eta_calib_decision_apply()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_ver bigint;
begin
  if NEW.type_code = 'ETA_CALIBRATION_APPROVAL'
     and NEW.status = 'RESOLVED'
     and OLD.status is distinct from 'RESOLVED'
  then
    v_ver := nullif(NEW.detail->>'version', '')::bigint;
    if v_ver is not null and NEW.resolution_code = 'APPLY' then
      perform public.eta_apply_calibration_internal(v_ver, null, false);
    elsif v_ver is not null and NEW.resolution_code = 'REJECT' then
      update public.eta_calibration_versions
         set rejected_at = now(),
             note = case
               when coalesce(note, '') like '%rejected%' then note
               else coalesce(note || '; ', '') || 'rejected'
             end
       where id = v_ver and applied is not true;
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_eta_calib_decision_apply on public.decisions;
create trigger trg_eta_calib_decision_apply
  after update of status on public.decisions
  for each row
  execute function public.trg_eta_calib_decision_apply();

-- ---------------------------------------------------------------------------
-- 2. Propozycja (B7 wsteczny czasowy; Ś3–Ś6; D9; CROSSING_*; D11 n≥5)
-- ---------------------------------------------------------------------------
create or replace function public.eta_propose_calibration()
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_frozen numeric;
  v_before jsonb := '{}'::jsonb;
  v_after jsonb := '{}'::jsonb;
  v_n int := 0;
  v_n_codes int := 0;
  v_err_before numeric := 0;
  v_err_after numeric := 0;
  v_err_n int := 0;
  v_max_chg numeric := 0;
  v_id bigint;
  r record;
  v_spread numeric;
  v_dev numeric;
  v_old numeric;
  v_spread_old numeric;
  v_chg_h numeric;
  v_chg_sp numeric;
  v_skip_codes text[] := '{}';
  v_exist bigint;
  v_open_dec boolean;
begin
  select value into v_frozen from app_parameters where key = 'ETA_CALIBRATION_FROZEN';
  if coalesce(v_frozen, 0) = 1 then
    return jsonb_build_object('ok', false, 'reason', 'FROZEN');
  end if;

  -- B5b + Ś3: pomijaj kody cofnięte LUB auto-zastosowane w 7 dni, dopóki < 3 nowych obs.
  select coalesce((
    select array_agg(distinct k)
      from eta_calibration_versions v
      cross join lateral jsonb_object_keys(v.params_after) k
     where v.undone_at is not null
       and v.undone_at > now() - interval '7 days'
       and (
         select count(*) from eta_segment_observations o
          where o.corridor = k
            and o.exclude_reason is null
            and o.observed_at > v.undone_at
            and coalesce(o.features->>'p4k', '') = 'true'
       ) < 3
  ), '{}') || coalesce((
    select array_agg(distinct k)
      from eta_calibration_versions v
      cross join lateral jsonb_object_keys(v.params_after) k
     where v.applied is true
       and v.undone_at is null
       and v.rejected_at is null
       and coalesce(v.note, '') like '%auto-applied%'
       and v.created_at > now() - interval '7 days'
       and (
         select count(*) from eta_segment_observations o
          where o.corridor = k
            and o.exclude_reason is null
            and o.observed_at > v.created_at
            and coalesce(o.features->>'p4k', '') = 'true'
       ) < 3
  ), '{}') into v_skip_codes;

  -- B7: fit = 70 % starszych per kod; mediana tylko z fit; błąd potem tylko z test
  for r in
    with base as (
      select o.corridor, o.hours_observed, o.observed_at, o.features,
             row_number() over (partition by o.corridor order by o.observed_at) as rn,
             count(*) over (partition by o.corridor) as cnt
        from eta_segment_observations o
       where o.exclude_reason is null
         and o.hours_observed > 0
         and o.observed_at >= now() - interval '90 days'
         and coalesce(o.features->>'p4k', '') = 'true'
         and o.corridor in (select segment_code from eta_route_segments)
         and (
           o.corridor not like 'PL_ROAD%' and o.corridor not like 'SE_ROAD%'
           or coalesce(o.features->>'gps_quality', '') = 'true'
         )
         and (v_skip_codes = '{}' or o.corridor <> all (v_skip_codes))
         and not exists (
           select 1 from eta_calibration_versions v
            where v.applied is true
              and v.undone_at is null
              and coalesce(v.note, '') like '%auto-applied%'
              and jsonb_exists(v.params_after, o.corridor)
              and v.created_at > now() - interval '7 days'
         )
    ),
    fit as (
      select * from base where rn <= greatest(1, floor(cnt * 0.7))
    ),
    stats as (
      select f.corridor as code,
             (select count(*)::int from base b where b.corridor = f.corridor) as n,
             (select count(*)::int from base b
               where b.corridor = f.corridor
                 and b.rn > greatest(1, floor(b.cnt * 0.7))) as n_test,
             percentile_cont(0.5) within group (order by f.hours_observed)::numeric as med,
             percentile_cont(0.1) within group (order by f.hours_observed)::numeric as p10,
             percentile_cont(0.9) within group (order by f.hours_observed)::numeric as p90,
             p.hours as hours_now,
             p.spread_pct as spread_now
        from fit f
        join eta_segment_params p on p.code = f.corridor
       group by f.corridor, p.hours, p.spread_pct
      having (select count(*) from base b where b.corridor = f.corridor) >= 5
    )
    select * from stats
  loop
    v_old := nullif(r.hours_now, 0);
    if v_old is null or r.med is null then
      continue;
    end if;
    v_dev := abs(r.med - r.hours_now) / v_old;
    if v_dev <= 0.10 then
      continue;
    end if;
    v_spread := least(greatest(
      greatest(abs(r.p90 - r.med), abs(r.med - r.p10)) / nullif(r.med, 0) * 100.0,
      10), 100);
    v_spread_old := coalesce(nullif(r.spread_now, 0), 20);
    v_chg_h := abs(r.med - r.hours_now) / v_old;
    v_chg_sp := abs(v_spread - v_spread_old) / v_spread_old;
    if (
      select coalesce(sum(
        abs((a.value->>'hours')::numeric - (b.value->>'hours')::numeric)
        / nullif((b.value->>'hours')::numeric, 0)
      ), 0)
        from eta_calibration_versions v
        cross join lateral jsonb_each(v.params_after) a
        join lateral jsonb_each(v.params_before) b on b.key = a.key
       where v.applied is true and v.undone_at is null
         and a.key = r.code
         and v.created_at > now() - interval '30 days'
    ) + v_chg_h > 0.40 then
      continue;
    end if;

    v_before := v_before || jsonb_build_object(
      r.code, jsonb_build_object('hours', r.hours_now, 'spread_pct', r.spread_now)
    );
    v_after := v_after || jsonb_build_object(
      r.code, jsonb_build_object(
        'hours', round(r.med, 3),
        'spread_pct', round(v_spread, 1)
      )
    );
    v_n := v_n + r.n;
    v_n_codes := v_n_codes + 1;
    v_max_chg := greatest(v_max_chg, v_chg_h, v_chg_sp);
  end loop;

  if v_n_codes = 0 then
    delete from eta_calibration_versions
     where applied is not true
       and created_by is null
       and coalesce(note, '') like 'propozycja ciągła%'
       and undone_at is null
       and rejected_at is null
       and not exists (
         select 1 from decisions d
          where d.type_code = 'ETA_CALIBRATION_APPROVAL'
            and d.status in ('NEW', 'ASSIGNED', 'SNOOZED')
            and d.detail->>'version' = eta_calibration_versions.id::text
       );
    return jsonb_build_object('ok', true, 'proposal', null, 'reason', 'NO_CHANGE');
  end if;

  -- B7: błąd przed/po tylko na zbiorze testowym (30 % najnowszych per kod)
  select
    coalesce(avg(abs(o.hours_observed - (v_after -> o.corridor ->> 'hours')::numeric) * 60.0), 0),
    coalesce(avg(abs(o.hours_observed - (v_before -> o.corridor ->> 'hours')::numeric) * 60.0), 0),
    count(*)::int
    into v_err_after, v_err_before, v_err_n
    from (
      select o.corridor, o.hours_observed, o.observed_at,
             row_number() over (partition by o.corridor order by o.observed_at) as rn,
             count(*) over (partition by o.corridor) as cnt
        from eta_segment_observations o
       where o.exclude_reason is null
         and o.hours_observed > 0
         and coalesce(o.features->>'p4k', '') = 'true'
         and jsonb_exists(v_after, o.corridor)
         and (
           o.corridor not like 'PL_ROAD%' and o.corridor not like 'SE_ROAD%'
           or coalesce(o.features->>'gps_quality', '') = 'true'
         )
    ) o
   where o.rn > greatest(1, floor(o.cnt * 0.7));

  if v_err_n < 2 then
    return jsonb_build_object(
      'ok', true, 'proposal', null, 'reason', 'BACKTEST_TOO_FEW',
      'n_test', v_err_n
    );
  end if;

  if v_err_after >= v_err_before then
    return jsonb_build_object(
      'ok', true, 'proposal', null, 'reason', 'BACKTEST_WORSE',
      'error_before_min', round(v_err_before, 2),
      'error_after_min', round(v_err_after, 2)
    );
  end if;

  select id into v_exist
    from eta_calibration_versions
   where applied is not true
     and created_by is null
     and coalesce(note, '') like 'propozycja ciągła%'
     and undone_at is null
     and rejected_at is null
   order by id desc
   limit 1;

  v_open_dec := false;
  if v_exist is not null then
    select exists (
      select 1 from decisions d
       where d.type_code = 'ETA_CALIBRATION_APPROVAL'
         and d.status in ('NEW', 'ASSIGNED', 'SNOOZED')
         and d.detail->>'version' = v_exist::text
    ) into v_open_dec;
  end if;

  -- Ś4 vs B4: przy otwartej decyzji — nowy wiersz (HHL zatwierdza to, co widział)
  if v_exist is not null and v_open_dec is not true then
    update eta_calibration_versions
       set params_before = v_before,
           params_after = v_after,
           n_obs = v_n,
           error_before_min = round(v_err_before, 2),
           error_after_min = round(v_err_after, 2),
           note = format(
             'propozycja ciągła #581; max_chg=%s%%; kody=%s',
             round(v_max_chg * 100.0, 1)::text,
             v_n_codes
           ),
           created_at = now()
     where id = v_exist;
    v_id := v_exist;
  else
    insert into eta_calibration_versions (
      created_by, params_before, params_after, n_obs,
      error_before_min, error_after_min, applied, frozen, note
    ) values (
      null, v_before, v_after, v_n,
      round(v_err_before, 2), round(v_err_after, 2),
      false, false,
      format(
        'propozycja ciągła #581; max_chg=%s%%; kody=%s',
        round(v_max_chg * 100.0, 1)::text,
        v_n_codes
      )
    )
    returning id into v_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'proposal', v_id,
    'n_obs', v_n,
    'n_codes', v_n_codes,
    'max_change_pct', round(v_max_chg * 100.0, 1),
    'error_before_min', round(v_err_before, 2),
    'error_after_min', round(v_err_after, 2)
  );
end;
$$;

revoke all on function public.eta_propose_calibration() from public, anon, authenticated;
grant execute on function public.eta_propose_calibration() to service_role;

comment on function public.eta_propose_calibration() is
  '#581 P4-k cz.2 F7: mediana n≥5, >10 %, wsteczny czasowy, p4k, CROSSING_*, histereza 90d/7d.';

-- ---------------------------------------------------------------------------
-- 3. Apply internal + wrapper (B2 assert; Ś7 lock; Ś8 freeze tylko apply)
-- ---------------------------------------------------------------------------
create or replace function public.eta_apply_calibration_internal(
  p_version bigint,
  p_actor text default null,
  p_auto boolean default false
) returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v record;
  v_frozen numeric;
  k text; h numeric; sp numeric;
  v_label text := coalesce(nullif(trim(p_actor), ''), 'HHL_ADMIN');
  v_max_chg numeric := 0;
  v_chg numeric;
  r record;
  v_n_codes int := 0;
begin
  if pg_try_advisory_xact_lock(hashtext('eta_calib')) is not true then
    raise exception 'ETA_CALIB_BUSY' using errcode = 'P0001';
  end if;

  select value into v_frozen from app_parameters where key = 'ETA_CALIBRATION_FROZEN';
  if coalesce(v_frozen, 0) = 1 then
    raise exception 'kalibracja zamrożona — odmroź przed zastosowaniem wersji';
  end if;

  select * into v from eta_calibration_versions where id = p_version;
  if not found then
    raise exception 'brak wersji %', p_version;
  end if;
  if v.applied is true and v.undone_at is null then
    return true;
  end if;
  if v.undone_at is not null then
    raise exception 'wersja cofnięta — nie stosuj ponownie';
  end if;

  select count(*)::int into v_n_codes
    from jsonb_object_keys(v.params_after);

  if p_auto is true then
    -- D11: auto tylko przy n≥10 obserwacjach w wersji
    if coalesce(v.n_obs, 0) < 10 then
      raise exception 'AUTO_NEEDS_APPROVAL: n_obs < 10';
    end if;
    for r in
      select e.key as code,
             (e.value->>'hours')::numeric as h_new,
             (b.value->>'hours')::numeric as h_old,
             (e.value->>'spread_pct')::numeric as sp_new,
             (b.value->>'spread_pct')::numeric as sp_old
        from jsonb_each(v.params_after) e
        join jsonb_each(v.params_before) b on b.key = e.key
    loop
      if nullif(r.h_old, 0) is null then
        continue;
      end if;
      v_chg := abs(r.h_new - r.h_old) / r.h_old;
      if nullif(r.sp_old, 0) is not null and r.sp_new is not null then
        v_chg := greatest(v_chg, abs(r.sp_new - r.sp_old) / r.sp_old);
      end if;
      v_max_chg := greatest(v_max_chg, v_chg);
    end loop;
    if v_max_chg > 0.15 then
      raise exception 'AUTO_NEEDS_APPROVAL: zmiana % %% > 15%%',
        round(v_max_chg * 100.0, 1)::text;
    end if;
    if v.error_after_min is not null
       and v.error_before_min is not null
       and v.error_after_min >= v.error_before_min then
      raise exception 'AUTO_NEEDS_APPROVAL: test wsteczny nie poprawia błędu';
    end if;
    v_label := 'automat kalibracji';
  elsif (current_app_role() = 'HHL_ADMIN') is not true then
    raise exception 'wyłącznie HHL_ADMIN';
  end if;

  for k, h, sp in
    select e.key,
           (e.value->>'hours')::numeric,
           case
             when (e.value->>'spread_pct') is null then null
             when (b.value->>'spread_pct') is not null
                  and (e.value->>'spread_pct')::numeric
                      is not distinct from (b.value->>'spread_pct')::numeric
               then (e.value->>'spread_pct')::numeric  -- bez zmian — nie podnoś seed <10
             else least(greatest((e.value->>'spread_pct')::numeric, 10), 100)
           end
      from jsonb_each(v.params_after) e
      left join jsonb_each(v.params_before) b on b.key = e.key
  loop
    update eta_segment_params
       set hours = h,
           spread_pct = coalesce(sp, spread_pct),
           updated_at = now(),
           updated_by = case when p_auto then null else current_app_user_id() end,
           source = case
             when p_auto then 'automat kalibracji #' || p_version
             else 'kalibracja wersja ' || p_version
           end
     where code = k;
  end loop;

  update eta_calibration_versions
     set applied = true,
         undone_at = null,
         note = case
           when p_auto and coalesce(note, '') not like '%auto-applied%'
             then coalesce(note || '; ', '') || 'auto-applied'
           else note
         end
   where id = p_version;

  insert into audit_log (user_id, action, entity, entity_id, new_value)
  values (
    case when p_auto then null else current_app_user_id() end,
    'ETA_CALIBRATION_APPLY',
    'eta_calibration_versions',
    p_version::text,
    jsonb_build_object(
      'version', p_version,
      'auto', p_auto,
      'actor', v_label,
      'max_change_pct', round(v_max_chg * 100.0, 1)
    )
  );
  return true;
end;
$$;

revoke all on function public.eta_apply_calibration_internal(bigint, text, boolean)
  from public, anon, authenticated;
grant execute on function public.eta_apply_calibration_internal(bigint, text, boolean) to service_role;

create or replace function public.apply_eta_calibration_version(p_version bigint)
returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.assert_not_preview();
  if (current_app_role() = 'HHL_ADMIN') is not true then
    raise exception 'wyłącznie HHL_ADMIN';
  end if;
  return public.eta_apply_calibration_internal(p_version, null, false);
end;
$$;

revoke all on function public.apply_eta_calibration_version(bigint) from public, anon;
grant execute on function public.apply_eta_calibration_version(bigint) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Auto-apply + powiadomienie (B3) + decyzja >15 % (B4); D11 n≥10
-- ---------------------------------------------------------------------------
create or replace function public.eta_auto_apply_pending()
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_id bigint;
  v_max numeric := 0;
  v_ok boolean;
  v_dec uuid;
  v_proj uuid;
begin
  if pg_try_advisory_xact_lock(hashtext('eta_calib')) is not true then
    return jsonb_build_object('ok', false, 'reason', 'BUSY');
  end if;

  select id into v_id
    from eta_calibration_versions
   where applied is not true
     and undone_at is null
     and rejected_at is null
     and created_by is null
     and coalesce(note, '') like 'propozycja ciągła%'
   order by id desc
   limit 1;
  if v_id is null then
    return jsonb_build_object('ok', true, 'applied', null, 'reason', 'NO_PENDING');
  end if;

  select coalesce(max(
           greatest(
             abs((a.value->>'hours')::numeric - (b.value->>'hours')::numeric)
               / nullif((b.value->>'hours')::numeric, 0),
             abs(coalesce((a.value->>'spread_pct')::numeric, 0)
                 - coalesce((b.value->>'spread_pct')::numeric, 0))
               / nullif(coalesce((b.value->>'spread_pct')::numeric, 20), 0)
           )
         ), 0)
    into v_max
    from eta_calibration_versions v
    cross join lateral jsonb_each(v.params_after) a
    join lateral jsonb_each(v.params_before) b on b.key = a.key
   where v.id = v_id;

  if v_max > 0.15 then
    select id into v_proj from projects
     where code in ('STEGRA_BODEN', 'STEGRA')
     order by case code when 'STEGRA_BODEN' then 0 else 1 end
     limit 1;
    if v_proj is null then
      select id into v_proj from projects order by created_at nulls last limit 1;
    end if;
    v_dec := public.decision_open_from_event(
      v_proj,
      'ETA_CALIBRATION_APPROVAL',
      'ETA_CALIB_VER:' || v_id::text,
      'Kalibracja ETA wymaga zatwierdzenia (zmiana > 15 %)',
      jsonb_build_object(
        'version', v_id,
        'action', 'apply_eta_calibration_version',
        'max_change_pct', round(v_max * 100.0, 1),
        'severity_override', 'WARNING'
      ),
      null,
      null
    );
    return jsonb_build_object(
      'ok', true, 'applied', null, 'reason', 'NEEDS_APPROVAL',
      'version', v_id, 'max_change_pct', round(v_max * 100.0, 1),
      'decision_id', v_dec
    );
  end if;

  begin
    v_ok := public.eta_apply_calibration_internal(v_id, 'automat kalibracji', true);
  exception when others then
    if SQLERRM like 'AUTO_NEEDS_APPROVAL%' or SQLERRM like 'kalibracja zamrożona%'
       or SQLERRM like 'ETA_CALIB_BUSY%' or SQLERRM like 'BUSY%' or SQLERRM like 'wersja cofnięta%' then
      return jsonb_build_object(
        'ok', true, 'applied', null, 'reason', 'BLOCKED',
        'version', v_id, 'msg', left(SQLERRM, 200)
      );
    end if;
    raise;
  end;

  -- B5a: undo_version = zastosowana wersja (v_id), nie poprzednia
  insert into notifications (channel, recipient, user_id, template, payload, dedup_key)
  select
    'IN_APP',
    coalesce(u.email::text, u.id::text),
    u.id,
    'ETA_CALIBRATION_AUTO',
    jsonb_build_object(
      'version', v_id,
      'undo_version', v_id,
      'max_change_pct', round(v_max * 100.0, 1),
      'matrix_event', 'eta_calib',
      'locale', u.locale,
      'title', 'Kalibracja ETA zastosowana automatycznie',
      'summary', format(
        'Zastosowano wersję %s (zmiana do %s%%). Możesz cofnąć.',
        v_id::text, round(v_max * 100.0, 1)::text
      )
    ),
    left('ETA_CALIB_AUTO:' || v_id::text || ':' || u.id::text, 200)
  from app_users u
  where u.active is true
    and u.role = 'HHL_ADMIN'
  on conflict (dedup_key) where dedup_key is not null do nothing;

  return jsonb_build_object(
    'ok', true, 'applied', v_id, 'max_change_pct', round(v_max * 100.0, 1),
    'undo_version', v_id
  );
end;
$$;

revoke all on function public.eta_auto_apply_pending() from public, anon, authenticated;
grant execute on function public.eta_auto_apply_pending() to service_role;

-- ---------------------------------------------------------------------------
-- 5. Undo (B5a/c; Ś8: dozwolone przy zamrożeniu)
-- ---------------------------------------------------------------------------
create or replace function public.eta_calibration_undo(p_version bigint)
returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v record;
  k text; h numeric; sp numeric;
begin
  perform public.assert_not_preview();
  if (current_app_role() = 'HHL_ADMIN') is not true then
    raise exception 'wyłącznie HHL_ADMIN';
  end if;
  -- Ś8: zamrożenie NIE blokuje undo

  select * into v from eta_calibration_versions
   where id = p_version and applied is true and undone_at is null;
  if not found then
    raise exception 'brak zastosowanej wersji %', p_version;
  end if;

  -- B5c: odmowa, gdy nowsza zastosowana z przecięciem kluczy
  if exists (
    select 1
      from eta_calibration_versions n
     where n.applied is true
       and n.undone_at is null
       and n.id > p_version
       and exists (
         select 1 from jsonb_object_keys(n.params_after) k1
          where jsonb_exists(v.params_after, k1)
       )
  ) then
    raise exception 'istnieje nowsza zastosowana wersja z tymi kluczami — cofnij ją najpierw';
  end if;

  for k, h, sp in
    select e.key, (e.value->>'hours')::numeric, (e.value->>'spread_pct')::numeric
      from jsonb_each(v.params_before) e
  loop
    update eta_segment_params
       set hours = h,
           spread_pct = coalesce(sp, spread_pct),
           updated_at = now(),
           updated_by = current_app_user_id(),
           source = 'cofnięcie kalibracji #' || p_version
     where code = k;
  end loop;

  update eta_calibration_versions
     set undone_at = now(),
         note = case
           when coalesce(note, '') like '%undone%' then note
           else coalesce(note || '; ', '') || 'undone'
         end
   where id = p_version;

  insert into audit_log (user_id, action, entity, entity_id, new_value)
  values (
    current_app_user_id(),
    'ETA_CALIBRATION_UNDO',
    'eta_calibration_versions',
    p_version::text,
    jsonb_build_object('version', p_version, 'actor', 'HHL_ADMIN')
  );
  return true;
end;
$$;

revoke all on function public.eta_calibration_undo(bigint) from public, anon;
grant execute on function public.eta_calibration_undo(bigint) to authenticated;



-- ---------------------------------------------------------------------------
-- B4 F7 r2: decision_open_from_event / l13 — ADMIN i ETA_CALIBRATION = HHL-only
-- (odtworzone z 0315 + v_hhl_only or ADMIN)
-- ---------------------------------------------------------------------------
create or replace function public.decision_open_from_event(
  p_project uuid,
  p_type text,
  p_event_key text,
  p_title text,
  p_detail jsonb default '{}'::jsonb,
  p_load uuid default null,
  p_risk uuid default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_hours numeric;
  v_role text;
  v_due timestamptz;
  v_detail jsonb;
  v_group text := 'DECISION';
  v_hhl_only boolean;
  v_sev text;
begin
  if p_event_key is null or length(btrim(p_event_key)) = 0 then
    raise exception 'L-1: zdarzenie bez klucza' using errcode = '22023';
  end if;
  select id into v_id
    from decisions
   where detail->>'event_key' = p_event_key
   limit 1;
  if v_id is not null then
    return v_id;
  end if;
  select due_hours, decider_role into v_hours, v_role
    from decision_types
   where code = p_type and active;
  if v_role is null then
    raise exception 'Nieznany typ decyzji %', p_type using errcode = '22023';
  end if;
  v_hhl_only := p_type in (
    'KSH_CARRIER_CHANGED', 'KSH_REMOVED_BACK', 'ETA_CALIBRATION_APPROVAL'
  ) or v_role = 'ADMIN';
  if v_hours is not null then
    v_due := now() + (v_hours::text || ' hours')::interval;
  end if;
  v_sev := case when p_detail->>'severity_override' in ('INFO', 'WARNING', 'CRITICAL')
                then p_detail->>'severity_override' end;
  v_detail := coalesce(p_detail, '{}'::jsonb) || jsonb_build_object('event_key', p_event_key, 'opened_by', 'L-1');
  begin
    insert into decisions (project_id, type_code, title, detail, load_id, risk_id, due_at, severity)
    values (p_project, p_type, p_title, v_detail, p_load, p_risk, v_due, v_sev)
    returning id into v_id;
  exception when unique_violation then
    select id into v_id from decisions where detail->>'event_key' = p_event_key limit 1;
    return v_id;
  end;
  insert into decision_events (decision_id, actor_id, action, payload)
  values (v_id, null, 'OPEN', jsonb_build_object('type', p_type, 'event_key', p_event_key));
  if current_setting('tower.bulk_quiet', true) is distinct from 'on' then
    insert into notifications (channel, recipient, user_id, load_id, template, payload, dedup_key)
    select 'IN_APP', coalesce(u.email::text, u.id::text), u.id, p_load, 'DECISION_OPEN',
           jsonb_build_object(
             'decision_id', v_id, 'type', p_type, 'title', p_title,
             'status', 'NEW', 'event', 'OPEN', 'locale', u.locale
           ),
           left('dec:OPEN:' || v_id::text || ':IN:' || u.id::text, 200)
      from app_users u
      join organizations o on o.id = u.org_id
      join notification_matrix m
        on m.event_group = v_group and m.role = u.role and m.in_app
     where u.active
       and (
         o.kind = 'FORWARDER'
         or (v_hhl_only is not true and o.kind = 'CARRIER' and v_role = 'CARRIER' and (
              p_load is null
              or exists (select 1 from loads l where l.id = p_load and l.carrier_org_id = o.id)))
         or (v_hhl_only is not true and o.kind = 'CLIENT' and (
              p_project is null
              or exists (select 1 from projects pr where pr.id = p_project and pr.client_org_id = o.id)
              or exists (select 1 from loads l join projects pr on pr.id = l.project_id
                          where l.id = p_load and pr.client_org_id = o.id)))
       )
    on conflict (dedup_key) where dedup_key is not null do nothing;
  end if;
  perform public.l13_decision_email(v_id);
  return v_id;
end $$;
comment on function public.decision_open_from_event(uuid, text, text, text, jsonb, uuid, uuid) is
  'L-1 + #581: ETA_CALIBRATION_APPROVAL / ADMIN = tylko HHL (bez SCX/KSH).';
revoke all on function public.decision_open_from_event(uuid, text, text, text, jsonb, uuid, uuid) from public, anon, authenticated;

create or replace function public.l13_decision_email(p_decision uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  d decisions%rowtype;
  v_role text;
  v_sev text;
  v_kind text;
  v_bundle text;
  v_order text;
  v_payload jsonb;
  v_hhl_only boolean;
  r record;
begin
  select * into d from decisions where id = p_decision;
  if not found then
    return;
  end if;
  select decider_role, severity_default into v_role, v_sev
    from decision_types where code = d.type_code;
  v_sev := coalesce(d.severity, v_sev);
  v_hhl_only := d.type_code in (
    'KSH_CARRIER_CHANGED', 'KSH_REMOVED_BACK', 'ETA_CALIBRATION_APPROVAL'
  ) or v_role = 'ADMIN';
  v_kind := case when v_sev = 'CRITICAL' or d.type_code = 'FERRY_CANCELLED' then 'critical' else 'digest' end;
  v_bundle := coalesce(
    nullif(d.detail->>'bundle_key', ''),
    nullif(d.detail->>'sailing_id', ''),
    d.type_code || ':' || coalesce(d.detail->>'event_key', d.id::text)
  );
  select order_no into v_order from loads where id = d.load_id;
  v_payload := jsonb_build_object(
    'decision_id', d.id, 'type', d.type_code, 'title', d.title,
    'status', d.status, 'event', 'OPEN', 'severity', v_sev,
    'bundle_key', v_bundle, 'level', case when v_kind = 'critical' then 'critical' else 'info' end
  );
  if current_setting('tower.bulk_quiet', true) = 'on' then
    return;
  end if;
  for r in
    select distinct u.id as user_id, u.email::text as recipient, u.locale, o.kind as org_kind
      from app_users u
      join organizations o on o.id = u.org_id
      join notification_matrix m
        on m.event_key = 'dec_new' and m.role = u.role and m.email
     where u.active and u.email is not null
       and (
         o.kind = 'FORWARDER'
         or (v_hhl_only is not true and o.kind = 'CARRIER' and v_role = 'CARRIER' and (
              d.load_id is null
              or exists (select 1 from loads l where l.id = d.load_id and l.carrier_org_id = o.id)))
         or (v_hhl_only is not true and o.kind = 'CLIENT' and (
              d.project_id is null
              or exists (select 1 from projects pr where pr.id = d.project_id and pr.client_org_id = o.id)))
       )
  loop
    perform public.l13_queue_email(
      v_kind, 'DECISION_OPEN', r.user_id, r.recipient, d.load_id,
      case when r.org_kind = 'CARRIER' then nullif(public.load_sms_code(d.load_id), '—') else v_order end,
      v_payload || jsonb_build_object('locale', r.locale),
      left('dec:OPEN:' || d.id::text || ':EM:' || r.user_id::text, 200),
      case when v_kind = 'critical' then v_bundle else null end
    );
  end loop;
  perform public.l13_email_guard_note(now());
end $$;
revoke all on function public.l13_decision_email(uuid) from public, anon, authenticated;
comment on function public.l13_decision_email(uuid) is
  'C3-p + #581: e-mail decyzji; ETA_CALIBRATION / ADMIN tylko FORWARDER.';

-- Ś1: RPC HHL_ADMIN — słownik tras/aliasów (ekran „Dodaj przeprawę”)
create or replace function public.eta_route_dict_upsert(
  p_alias text,
  p_route_key text,
  p_operator text,
  p_segments jsonb default null
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  r record;
begin
  perform public.assert_not_preview();
  if (current_app_role() = 'HHL_ADMIN') is not true then
    raise exception 'wyłącznie HHL_ADMIN' using errcode = '42501';
  end if;
  if p_alias is null or p_route_key is null then
    raise exception 'alias i route_key wymagane' using errcode = '22023';
  end if;
  insert into eta_route_aliases (alias_key, route_key, operator)
  values (upper(btrim(p_alias)), upper(btrim(p_route_key)), nullif(upper(btrim(p_operator)), ''))
  on conflict (alias_key) do update
    set route_key = excluded.route_key, operator = excluded.operator;
  if p_segments is not null then
    for r in select * from jsonb_to_recordset(p_segments)
               as x(segment_role text, segment_code text)
    loop
      insert into eta_route_segments (route_key, segment_role, segment_code)
      values (upper(btrim(p_route_key)), upper(btrim(r.segment_role)), upper(btrim(r.segment_code)))
      on conflict (route_key, segment_role) do update set segment_code = excluded.segment_code;
    end loop;
  end if;
  insert into audit_log (user_id, action, entity, entity_id, new_value)
  values (
    current_app_user_id(),
    'ETA_ROUTE_DICT_UPSERT',
    'eta_route_aliases',
    upper(btrim(p_alias)),
    jsonb_build_object(
      'route_key', upper(btrim(p_route_key)),
      'operator', nullif(upper(btrim(p_operator)), ''),
      'segments', p_segments
    )
  );
  return jsonb_build_object('ok', true, 'alias', upper(btrim(p_alias)), 'route_key', upper(btrim(p_route_key)));
end;
$$;
revoke all on function public.eta_route_dict_upsert(text, text, text, jsonb) from public, anon;
grant execute on function public.eta_route_dict_upsert(text, text, text, jsonb) to authenticated;

-- Ś1: v_op w pomiarze z słownika (pełna funkcja z 0319 + eta_record_v_op)

-- ---------------------------------------------------------------------------
-- 6. Tick (B6: bez raise po insert; osobne bloki)
-- ---------------------------------------------------------------------------
create or replace function public.eta_calibration_tick()
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_rebuild jsonb := '{}'::jsonb;
  v_prop jsonb := '{}'::jsonb;
  v_auto jsonb := '{}'::jsonb;
  v_ok boolean := true;
  v_msg text := null;
begin
  if pg_try_advisory_xact_lock(hashtext('eta_calib')) is not true then
    insert into integration_runs (job, ok, result)
    values ('eta_calib_tick', false, jsonb_build_object('reason', 'BUSY'));
    return jsonb_build_object('ok', false, 'reason', 'BUSY');
  end if;

  begin
    v_rebuild := public.eta_rebuild_segment_observations(now() - interval '48 hours');
  exception when others then
    v_ok := false;
    v_msg := left('rebuild: ' || SQLERRM, 200);
    v_rebuild := jsonb_build_object('ok', false, 'msg', left(SQLERRM, 200));
    insert into integration_runs (job, ok, result)
    values ('eta_calib_rebuild', false, v_rebuild);
  end;

  begin
    v_prop := public.eta_propose_calibration();
  exception when others then
    v_ok := false;
    v_msg := coalesce(v_msg || '; ', '') || left('propose: ' || SQLERRM, 180);
    v_prop := jsonb_build_object('ok', false, 'msg', left(SQLERRM, 200));
    insert into integration_runs (job, ok, result)
    values ('eta_calib_propose', false, v_prop);
  end;

  begin
    v_auto := public.eta_auto_apply_pending();
  exception when others then
    v_ok := false;
    v_msg := coalesce(v_msg || '; ', '') || left('auto: ' || SQLERRM, 180);
    v_auto := jsonb_build_object('ok', false, 'msg', left(SQLERRM, 200));
    insert into integration_runs (job, ok, result)
    values ('eta_calib_auto', false, v_auto);
  end;

  insert into integration_runs (job, ok, result)
  values (
    'eta_calib_tick',
    v_ok,
    jsonb_build_object(
      'rebuild', v_rebuild, 'propose', v_prop, 'auto', v_auto,
      'msg', v_msg
    )
  );
  return jsonb_build_object(
    'ok', v_ok, 'rebuild', v_rebuild, 'propose', v_prop, 'auto', v_auto
  );
end;
$$;

revoke all on function public.eta_calibration_tick() from public, anon, authenticated;
grant execute on function public.eta_calibration_tick() to service_role;

comment on function public.eta_calibration_tick() is
  '#581 P4-k cz.2 F7: co 1 h — rebuild 48 h, propose, auto ≤15 %; błędy w integration_runs bez raise.';

do $cron$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron')
     and to_regprocedure('cron.schedule(text,text,text)') is not null then
    perform cron.unschedule(jobid)
      from cron.job where jobname = 'tower-eta-calibration';
    perform cron.schedule(
      'tower-eta-calibration',
      '15 * * * *',
      $job$select public.eta_calibration_tick()$job$
    );
  else
    raise notice '#581: pg_cron niedostępny — tower-eta-calibration do zaplanowania ręcznie';
  end if;
end $cron$;

-- =====================================================================
-- Ś1 F7 r2: pomiar + compute_load_eta + apply_geofence ze słownika
-- =====================================================================

create or replace function public.eta_record_segment_observations(p_load uuid)
returns int
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  t_load_exit timestamptz;
  t_port_in timestamptz;
  t_port_out timestamptz;
  t_pin_enter timestamptz;
  t_pin_exit timestamptz;
  t_site timestamptz;
  n int := 0;
  v_route text;
  v_op text;
  c_pl text;
  c_ci text;
  c_cross text;
  c_se text;
  v_id bigint;
begin
  if not exists (select 1 from loads where id = p_load) then
    return 0;
  end if;

  delete from eta_segment_observations
   where load_id = p_load
     and (features->>'p4k') = 'true'
     and (
       exclude_reason is null
       or exclude_reason in (
         'LUKA_GPS', 'POKRYCIE_GPS', 'BRAK_GPS', 'TRASA_NIEZNANA', 'BRAK_ZDARZENIA'
       )
     );

  v_route := eta_obs_route_key(p_load);
  if v_route is null then
    v_id := eta_upsert_segment_observation(
      p_load, 'PL_ROAD', null, null, false, 'TRASA_NIEZNANA'
    );
    return case when v_id is null then 0 else 1 end;
  end if;

  c_pl := eta_obs_segment_code(v_route, 'PL_ROAD');
  c_ci := eta_obs_segment_code(v_route, 'PORT_CHECKIN');
  c_cross := eta_obs_segment_code(v_route, 'CROSSING');
  c_se := eta_obs_segment_code(v_route, 'SE_ROAD');

  -- Ś1: operator ze słownika (nie case STENA/POLFERRIES)
  v_op := public.eta_record_v_op(v_route);

  t_load_exit := eta_seg_event_at(p_load, 'GEOFENCE_EXIT', 'LOADING', null, null, null);
  t_port_in := eta_seg_event_at(p_load, 'GEOFENCE_ENTER', 'PORT_OUT', t_load_exit, null, v_op);
  t_pin_enter := eta_seg_event_at(p_load, 'GEOFENCE_ENTER', 'PORT_IN', t_port_in, null, v_op);
  t_port_out := eta_seg_event_at(p_load, 'GEOFENCE_EXIT', 'PORT_OUT', t_port_in, t_pin_enter, v_op);
  t_site := eta_seg_event_at(p_load, 'GEOFENCE_ENTER', 'SITE', coalesce(t_pin_enter, t_port_out), null, null);
  t_pin_exit := eta_seg_event_at(p_load, 'GEOFENCE_EXIT', 'PORT_IN', t_pin_enter, t_site, v_op);

  if t_load_exit is not null and t_port_in is not null then
    if eta_upsert_segment_observation(p_load, c_pl, t_load_exit, t_port_in, true, null) is not null then
      n := n + 1;
    end if;
  end if;

  if t_port_in is not null and t_port_out is not null then
    if eta_upsert_segment_observation(p_load, c_ci, t_port_in, t_port_out, false, null) is not null then
      n := n + 1;
    end if;
  elsif t_port_in is not null then
    if eta_upsert_segment_observation(
         p_load, c_ci, t_port_in, coalesce(t_pin_enter, t_port_in), false, 'BRAK_ZDARZENIA'
       ) is not null then
      n := n + 1;
    end if;
  end if;

  if t_port_out is not null and t_pin_enter is not null then
    if eta_upsert_segment_observation(p_load, c_cross, t_port_out, t_pin_enter, false, null) is not null then
      n := n + 1;
    end if;
  elsif t_port_out is not null then
    if eta_upsert_segment_observation(
         p_load, c_cross, t_port_out, t_port_out, false, 'BRAK_ZDARZENIA'
       ) is not null then
      n := n + 1;
    end if;
  end if;

  if t_pin_exit is not null and t_site is not null then
    if eta_upsert_segment_observation(p_load, c_se, t_pin_exit, t_site, true, null) is not null then
      n := n + 1;
    end if;
  elsif t_pin_enter is not null and t_site is not null and t_pin_exit is null then
    if eta_upsert_segment_observation(
         p_load, c_se, t_pin_enter, t_site, true, 'BRAK_ZDARZENIA'
       ) is not null then
      n := n + 1;
    end if;
  end if;

  return n;
end;
$$;

revoke all on function public.eta_record_segment_observations(uuid)
  from public, anon, authenticated;
grant execute on function public.eta_record_segment_observations(uuid) to service_role;

-- Ś1: v_op ze słownika; treść A10/0279 (nie cofać do 0242 — status A10 + SCHEDULE).
create or replace function public.apply_geofence_status()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_kind    geofence_kind;
  v_gid     uuid;
  v_country char(2);
  v_name    text;
  v_status  load_status;
  v_detail  jsonb;
  v_entered timestamptz;
  v_dwell_min numeric;
  v_project uuid;
  v_title   text;
  v_code    text;
  v_route   text;
  v_op      text;
  v_gaps    jsonb;
  v_gaps_txt text;
  v_dep     timestamptz;
  v_prev    text;
begin
  select status, project_id into v_status, v_project from loads where id = new.load_id;
  if v_status in ('CANCELLED','UNLOADED','DELIVERED','READY_TO_INVOICE','INVOICED') then
    return null;
  end if;
  begin
    v_gid := (new.payload->>'geofence_id')::uuid;
  exception when others then
    return null;
  end;
  select g.kind, g.country, g.name, g.route into v_kind, v_country, v_name, v_route
    from geofences g where g.id = v_gid;
  if v_kind is null then return null; end if;
  v_op := 'POLFERRIES';
  select public.eta_obs_operator_key(s.route)
    into v_op from loads l left join sailings s on s.id = l.sailing_id
   where l.id = new.load_id;
  v_op := coalesce(v_op, 'POLFERRIES');

  if coalesce(new.payload->>'synthetic', '') = 'true'
     or coalesce((new.payload->>'actual_load')::boolean, true) is false then
    return null;
  end if;

  v_detail := jsonb_build_object(
    'geofence_id', new.payload->>'geofence_id',
    'geofence_kind', v_kind,
    'geofence_name', coalesce(nullif(new.payload->>'geofence_name', ''), v_name),
    'zdarzenie', new.event_type,
    'source', 'GPS'
  );

  if new.event_type = 'GEOFENCE_ENTER' then

    if v_kind = 'LOADING'
       and v_status in ('PLANNED','RESOURCES_PENDING','DOCS_PENDING','READY') then
      v_gaps := public.awiz_missing(new.load_id);
      if v_status is distinct from 'READY'
         or exists (
           select 1
             from jsonb_array_elements(coalesce(v_gaps, '[]'::jsonb)) g
            where g->>'kind' in ('ORDER_SCX', 'ORDER_HHL')
         ) then
        v_gaps_txt := public.a10_prep_gaps_text(v_gaps);
        perform raise_risk(new.load_id, 'AUTO_STATUS', 'HIGH',
          case when coalesce(v_gaps_txt, '') = '' then
            format('Załadunek bez gotowości (status %s)', v_status)
          else
            format('Załadunek bez gotowości: %s', v_gaps_txt)
          end,
          v_detail || jsonb_build_object(
            'title_key', 'rk_loading_not_ready',
            'params', jsonb_build_object('status', v_status, 'gaps', coalesce(v_gaps_txt, '')),
            'gaps', v_gaps
          ),
          'LOADING_NOT_READY:' || new.load_id);
      end if;
      perform auto_set_status(new.load_id, v_status, 'AT_LOADING',
        'wjazd w strefę załadunku', new.occurred_at, v_detail);

    elsif v_kind = 'PORT_OUT'
          and public.load_status_rank(v_status) >= public.load_status_rank('READY')
          and public.load_status_rank(v_status) <= public.load_status_rank('IN_TRANSIT_PL')
          and public.eta_obs_operator_key(coalesce(v_route, 'POLFERRIES')) = v_op then
      if auto_set_status(new.load_id, v_status, 'AT_PORT_GDANSK',
           format('wjazd w strefę portu PL (%s)', coalesce(v_name, v_op)),
           new.occurred_at, v_detail)
         and loaded_confirmed(new.load_id) is not true then
        perform raise_risk(new.load_id, 'LOADING_UNCONFIRMED', 'MEDIUM',
          format('Pojazd w porcie PL (%s) bez potwierdzenia załadunku', coalesce(v_name, v_op)),
          v_detail || jsonb_build_object('title_key', 'rk_port_no_loaded', 'params', '{}'::jsonb),
          'PORT_NO_LOADED:' || new.load_id);
      end if;

    elsif v_kind = 'PORT_IN'
          and public.load_status_rank(v_status) < public.load_status_rank('AT_PORT_NYNASHAMN')
          and public.load_status_rank(v_status) >= public.load_status_rank('AT_LOADING')
          and public.eta_obs_operator_key(coalesce(v_route, 'POLFERRIES')) = v_op then
      if v_status is distinct from 'FERRY' then
        select coalesce(s.delayed_departure_at, s.departure_at) into v_dep
          from loads l left join sailings s on s.id = l.sailing_id
         where l.id = new.load_id;
        v_prev := current_setting('tower.bulk_quiet', true);
        perform set_config('tower.bulk_quiet', 'on', true);
        perform auto_set_status(
          new.load_id, v_status, 'FERRY',
          'wjazd do portu SE — uzupełniony status Na promie',
          least(coalesce(v_dep, new.occurred_at), new.occurred_at),
          v_detail || jsonb_build_object(
            'source', 'SCHEDULE',
            'synthetic_ferry', true
          )
        );
        perform set_config('tower.bulk_quiet', coalesce(v_prev, ''), true);
        select status into v_status from loads where id = new.load_id;
      end if;
      if v_status = 'FERRY' then
        perform auto_set_status(new.load_id, v_status, 'AT_PORT_NYNASHAMN',
          format('wjazd w strefę portu SE (%s)', coalesce(v_name, v_op)),
          new.occurred_at, v_detail);
      end if;

    elsif v_kind = 'SITE'
          and public.load_status_rank(v_status) >= public.load_status_rank('AT_LOADING')
          and public.load_status_rank(v_status) < public.load_status_rank('AT_SITE') then
      perform auto_set_status(new.load_id, v_status, 'AT_SITE',
        'wjazd na plac budowy', new.occurred_at, v_detail);

    elsif v_kind in ('CHECKPOINT','PRE_ARRIVAL') and v_country = 'SE'
          and v_status in ('FERRY','AT_PORT_NYNASHAMN') then
      perform auto_set_status(new.load_id, v_status, 'IN_TRANSIT_SE',
        'pozycja na trasie SE — wyjazd z portu niezarejestrowany', new.occurred_at, v_detail);
    end if;

  elsif new.event_type = 'GEOFENCE_EXIT' then

    select s.entered_at into v_entered
      from geofence_states s
     where s.load_id = new.load_id and s.geofence_id = v_gid;
    if v_entered is null and new.payload ? 'entered_at' then
      begin
        v_entered := (new.payload->>'entered_at')::timestamptz;
      exception when others then
        v_entered := null;
      end;
    end if;
    if v_entered is not null then
      v_dwell_min := round(extract(epoch from (new.occurred_at - v_entered)) / 60.0);
    elsif new.payload ? 'dwell_min' then
      v_dwell_min := (new.payload->>'dwell_min')::numeric;
    else
      v_dwell_min := null;
    end if;
    if v_dwell_min is not null then
      v_detail := v_detail || jsonb_build_object('dwell_min', v_dwell_min, 'entered_at', v_entered);
    end if;

    if v_kind = 'LOADING' and v_status = 'AT_LOADING' then
      if v_entered is null then
        null;
      elsif v_dwell_min is not null and v_dwell_min >= 5 then
        if auto_set_status(
             new.load_id, v_status, 'IN_TRANSIT_PL',
             'wyjazd ze strefy załadunku po postoju ≥ 5 min',
             new.occurred_at,
             v_detail
           ) then
          perform set_config('tower.status_ctx', 'on', true);
          update loads
             set actual_load_at = coalesce(actual_load_at, new.occurred_at),
                 updated_at = now()
           where id = new.load_id;
        end if;
      end if;

    elsif v_kind = 'SITE' and v_status = 'AT_SITE' then
      if v_dwell_min is not null and v_dwell_min >= 10 then
        if auto_set_status(
             new.load_id, v_status, 'DELIVERED',
             format('wyjazd z placu po %s min', v_dwell_min::int),
             new.occurred_at,
             v_detail
           ) then
          perform set_config('tower.status_ctx', 'on', true);
          update loads
             set actual_delivery_at = coalesce(actual_delivery_at, new.occurred_at),
                 updated_at = now()
           where id = new.load_id;
        end if;
      elsif v_dwell_min is not null and v_dwell_min < 10 then
        select public.load_sms_code(new.load_id) into v_code;
        v_title := format(
          '%s: wyjazd z placu po %s min — czy dostarczono?',
          coalesce(nullif(v_code, ''), 'transport'),
          v_dwell_min::int
        );
        perform decision_open_from_event(
          v_project,
          'DELIVERED_CHECK',
          'L14:' || new.load_id::text || ':' || v_gid::text || ':'
            || to_char(new.occurred_at at time zone 'UTC', 'YYYYMMDDHH24MI'),
          v_title,
          v_detail || jsonb_build_object(
            'exit_at', new.occurred_at,
            'threshold_min', 10,
            'zone', coalesce(nullif(new.payload->>'geofence_name', ''), v_name)
          ),
          new.load_id,
          null
        );
      end if;

    elsif v_kind = 'PORT_IN' and v_status = 'AT_PORT_NYNASHAMN'
          and public.eta_obs_operator_key(coalesce(v_route, 'POLFERRIES')) = v_op then
      perform auto_set_status(new.load_id, v_status, 'IN_TRANSIT_SE',
        format('wyjazd ze strefy portu SE (%s)', coalesce(v_name, v_op)),
        new.occurred_at, v_detail);
    end if;
  end if;
  return null;
end $function$;

revoke all on function public.apply_geofence_status() from public, anon, authenticated;

create or replace function public.compute_load_eta(p_load uuid, p_now timestamp with time zone DEFAULT now())
 returns table(eta timestamp with time zone, conf_min integer, basis jsonb)
 language plpgsql
 stable security definer
 set search_path = public, pg_temp
as $function$
declare
  l          record;
  v_sail     record;
  p          record;
  h_pl       numeric; sp_pl numeric;
  h_ci       numeric;
  h_cross    numeric; sp_cross numeric;
  h_se       numeric;
  fresh_h    numeric;
  v_status   load_status;
  v_eta      timestamptz;
  v_var      numeric := 0;
  v_sum      numeric := 0;
  v_comp     jsonb := '[]'::jsonb;
  h_road numeric; sp_road numeric; h_rest numeric; sp_rest numeric; h_brk numeric; sp_brk numeric;
  h_road_eff numeric;
  v_slow     numeric := 1.00;
  v_slow_reason text;
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
  cp record;
  v_attr text := '© OpenStreetMap contributors';
  v_progress text := 'status';
  v_off numeric;
  v_rem_km numeric;
  v_causes jsonb := '{}'::jsonb;
  v_drive_h numeric := 0;
  v_checkin_h numeric := 0;
  v_rest_h numeric := 0;
  st record;
  sch record;
  v_drive_need numeric;
  v_break_h numeric := 0;
  v_weather_pct numeric := 0;
  v_fresh boolean := false;
  v_alat double precision;
  v_alon double precision;
  v_sog real;
  v_obs timestamptz;
  v_sea_h numeric;
  v_left boolean := false;
  v_h4_rest_spread numeric := 0;
  v_op text;
begin
  select * into l from loads where id = p_load;
  if not found then return; end if;
  v_status := l.status;
  -- #581 F7 Ś1: operator i kody odcinków ze słownika
  v_op := 'POLFERRIES';
  if l.sailing_id is not null then
    select public.eta_obs_operator_key(sa.route)
      into v_op from sailings sa where sa.id = l.sailing_id;
    v_op := coalesce(v_op, 'POLFERRIES');
  end if;

  select hours, spread_pct / 100 into h_pl, sp_pl
    from eta_segment_params
   where code = public.eta_obs_segment_code(
           coalesce((select public.eta_obs_route_family(sa.route) from sailings sa where sa.id = l.sailing_id), 'GDN-NYN'),
           'PL_ROAD');
  select hours into h_ci from eta_segment_params where code = 'PORT_CHECKIN';
  select hours, spread_pct / 100 into h_cross, sp_cross
    from eta_segment_params
   where code = public.eta_obs_segment_code(
           coalesce((select public.eta_obs_route_family(sa.route) from sailings sa where sa.id = l.sailing_id), 'GDN-NYN'),
           'CROSSING');
  select hours, spread_pct / 100 into h_road, sp_road
    from eta_segment_params
   where code = public.eta_obs_segment_code(
           coalesce((select public.eta_obs_route_family(sa.route) from sailings sa where sa.id = l.sailing_id), 'GDN-NYN'),
           'SE_ROAD');
  select hours, spread_pct / 100 into h_rest, sp_rest from eta_segment_params where code = 'SE_DAILY_REST';
  select hours, spread_pct / 100 into h_brk, sp_brk from eta_segment_params where code = 'SE_BREAKS';
  h_road := coalesce(h_road, 17); sp_road := coalesce(sp_road, 0.2);
  h_rest := coalesce(h_rest, 11); sp_rest := coalesce(sp_rest, 0);
  h_brk := coalesce(h_brk, 2); sp_brk := coalesce(sp_brk, 0.5);
  select hours into fresh_h from eta_segment_params where code = 'GPS_FRESH_MIN';
  h_pl := coalesce(h_pl, 4.5); sp_pl := coalesce(sp_pl, 0.2); h_ci := coalesce(h_ci, 2);
  h_cross := coalesce(h_cross, 18); sp_cross := coalesce(sp_cross, 0.15);
  fresh_h := coalesce(fresh_h, 1.5);

  -- A5 F7: droga SE według trasy rejsu (geofences.route PORT_IN).
  -- Źródło SE_ROAD_KAA: 0160 FERRY-STATUS — Karlskrona → E22 → E4 → Boden = 21,5 h
  -- (dłużej niż SE_ROAD Nynäshamn–Boden = 17 h). PL: PL_ROAD_GDY = 8,2 h.
  h_road := coalesce(h_road, case when v_op = 'STENA' then 21.5 else 17 end);
  sp_road := coalesce(sp_road, 0.2);
  h_pl := coalesce(h_pl, case when v_op = 'STENA' then 8.2 else 4.5 end);
  sp_pl := coalesce(sp_pl, case when v_op = 'STENA' then 0.25 else 0.2 end);

  select slowdown_mult, reason into v_slow, v_slow_reason
    from corridor_conditions
   where corridor = case when v_op = 'STENA' then 'SE_E22' else 'SE_E4' end;
  v_slow := coalesce(v_slow, 1.00);
  if v_slow > 1.00 then
    v_weather_pct := round((v_slow - 1) * 100);
    v_flags := array_append(v_flags, format('spowolnienie SE ×%s (%s)', v_slow, coalesce(v_slow_reason, 'II-6')));
  end if;
  h_road_eff := h_road * v_slow;
  h_se := h_road_eff + h_rest + h_brk;

  -- H-4: stan kierowcy z GPS (bez tachografu); flagi dołączamy na końcu, po fladze korytarza
  select * into st from h4_driver_state_from_gps(p_load, p_now);
  -- H-4: odpoczynek/przerwy szacowane z GPS → niepewność NIE może być 0%.
  -- Pasmo obejmuje earlier/later; przy ostrożnym większy rozrzut (Wysoka niedostępna).
  if coalesce(st.cautious, false) then
    v_h4_rest_spread := 0.25;  -- 25% × rest_h (+ dolne H4_CAUTIOUS poniżej)
  else
    v_h4_rest_spread := 0.15;  -- 15% gdy last_rest znany z GPS/prom
  end if;


  select attribution into v_attr from corridor_polylines where code = 'PL_ROAD' limit 1;
  v_attr := coalesce(v_attr, '© OpenStreetMap contributors');

  select st_centroid(geom) into g_load from geofences where project_id = l.project_id and kind = 'LOADING' and active order by sort_order limit 1;
  select st_centroid(geom) into g_pout from geofences
   where project_id = l.project_id and kind = 'PORT_OUT' and active
     and public.eta_obs_operator_key(coalesce(route, 'POLFERRIES')) = v_op
   order by sort_order limit 1;
  if g_pout is null then
    select st_centroid(geom) into g_pout from geofences
     where project_id = l.project_id and kind = 'PORT_OUT' and active
     order by sort_order limit 1;
  end if;
  select st_centroid(geom) into g_pin from geofences
   where project_id = l.project_id and kind = 'PORT_IN' and active
     and public.eta_obs_operator_key(coalesce(route, 'POLFERRIES')) = v_op
   order by sort_order limit 1;
  if g_pin is null then
    select st_centroid(geom) into g_pin from geofences
     where project_id = l.project_id and kind = 'PORT_IN' and active
     order by sort_order limit 1;
  end if;
  select st_centroid(geom) into g_site from geofences where project_id = l.project_id and kind = 'SITE' and active order by sort_order limit 1;
  v_left := v_status in ('IN_TRANSIT_PL','AT_PORT_GDANSK','FERRY','AT_PORT_NYNASHAMN','IN_TRANSIT_SE','AT_SITE','UNLOADED','DELIVERED')
    or exists (
      select 1 from load_events e
      where e.load_id = p_load
        and e.event_type = 'GEOFENCE_EXIT'
        and e.payload->>'geofence_kind' = 'LOADING'
        and coalesce((e.payload->>'synthetic')::boolean, false) is not true
        -- D-1710 F7: EXIT LOADING tylko od startu okna (opened albo 03:00 dnia planu).
        and e.occurred_at >= coalesce(
              l.tracking_opened_at,
              case when l.plan_load_date is not null
                   then public.tracking_window_start(l.plan_load_date) end,
              '-infinity'::timestamptz)
    );

  select ts, coalesce(geom_snapped, geom_raw) as g into p from positions where load_id = p_load order by ts desc limit 1;

  if v_status = 'CANCELLED' then
    return query select null::timestamptz, null::int, jsonb_build_object(
      'method','ETA v2 (OSM)','segment','CANCELLED','flags',jsonb_build_array('anulowany'),
      'attribution', v_attr, 'computed_at', p_now);
    return;
  end if;
  if v_status in ('UNLOADED','DELIVERED','READY_TO_INVOICE','INVOICED') then
    return query select coalesce(l.actual_delivery_at, p_now), 0, jsonb_build_object(
      'method','ETA v2 (OSM)','segment','DONE','flags',jsonb_build_array('rozładowany — data rozładunku'),
      'attribution', v_attr, 'computed_at', p_now);
    return;
  end if;
  if v_status = 'AT_SITE' then
    select max(occurred_at) into v_eta from load_events where load_id = p_load and payload->>'to' = 'AT_SITE';
    return query select coalesce(v_eta, p_now), 0, jsonb_build_object(
      'method','ETA v2 (OSM)','segment','AT_SITE','flags',jsonb_build_array('na placu budowy'),
      'attribution', v_attr, 'computed_at', p_now);
    return;
  end if;

  -- ETA tylko z pozycji (2026-10-04). Plan załadunku i założony rejs nie wypełniają eta_site.
  v_fresh := p.ts is not null and p.ts >= p_now - make_interval(mins => (fresh_h * 60)::int);

  if v_status = 'FERRY' then
    select vp.lat, vp.lon, vp.sog_kn, vp.observed_at
      into v_alat, v_alon, v_sog, v_obs
      from vessel_positions vp
      join sailings sa on sa.vessel_id = vp.vessel_id
     where sa.id = l.sailing_id
       and vp.observed_at >= p_now - make_interval(mins => (fresh_h * 60)::int)
     order by vp.observed_at desc
     limit 1;
    if v_obs is null or v_sog is null or v_sog <= 0 or g_pin is null then
      return query select null::timestamptz, null::int, jsonb_build_object(
        'method','ETA v2 (OSM)','segment','FERRY',
        'flags', jsonb_build_array('na promie — ETA czeka na pozycję AIS'),
        'ferry_eta','waits_for_ais','wait_ais', true, 'ferry_eta_at', null, 'plan_eta', false,
        'attribution', v_attr, 'computed_at', p_now);
      return;
    end if;
    v_sea_h := st_distance(
      st_setsrid(st_makepoint(v_alon, v_alat), 4326)::geography,
      g_pin::geography) / (v_sog * 1852.0);
    v_eta := p_now + make_interval(secs => ((v_sea_h + h_se) * 3600)::int);
    return query select v_eta, greatest(1, round(v_sea_h * 60 * 0.15))::int, jsonb_build_object(
      'method','ETA v2 (OSM)','segment','FERRY',
      'flags', jsonb_build_array('pozycja AIS promu'),
      'ferry_eta','ais','wait_ais', false,
      'ferry_eta_at', (p_now + make_interval(secs => (v_sea_h * 3600)::int)),
      'plan_eta', false, 'sailing', null,
      'attribution', v_attr, 'computed_at', p_now, 'port_route', v_op);
    return;
  end if;

  if v_status in ('AT_PORT_NYNASHAMN','IN_TRANSIT_SE') then
    if v_fresh is not true then
      return query select null::timestamptz, null::int, jsonb_build_object(
        'method','ETA v2 (OSM)','segment', v_status::text,
        'flags', jsonb_build_array('brak pozycji GPS'),
        'plan_eta', false, 'attribution', v_attr, 'computed_at', p_now);
      return;
    end if;
  else
    if (v_left) is not true then
      if v_fresh is not true then
        return query select null::timestamptz, null::int, jsonb_build_object(
          'method','ETA v2 (OSM)','segment', v_status::text,
          'flags', jsonb_build_array('brak pozycji GPS'),
          'plan_eta', false, 'pre_load', true, 'attribution', v_attr, 'computed_at', p_now);
      else
        return query select null::timestamptz, null::int, jsonb_build_object(
          'method','ETA v2 (OSM)','segment', v_status::text,
          'flags', jsonb_build_array('pre_load'),
          'plan_eta', false, 'pre_load', true, 'attribution', v_attr, 'computed_at', p_now);
      end if;
      return;
    end if;
    if v_fresh is not true then
      return query select null::timestamptz, null::int, jsonb_build_object(
        'method','ETA v2 (OSM)','segment', v_status::text,
        'flags', jsonb_build_array('brak pozycji GPS'),
        'plan_eta', false, 'pre_load', false, 'attribution', v_attr, 'computed_at', p_now);
      return;
    end if;
  end if;

  -- 2) odcinek SE
  if v_status in ('AT_PORT_NYNASHAMN','IN_TRANSIT_SE') then
    v_frac := 1;
    if v_status = 'IN_TRANSIT_SE' then
      if p.ts is not null and p.ts >= p_now - make_interval(mins => (fresh_h * 60)::int) then
        select * into cp from corridor_progress(
          case when v_op = 'STENA' then 'SE_E22' else 'SE_E4' end, p.g);
        if found and cp.remaining_frac is not null then
          v_frac := cp.remaining_frac;
          v_off := cp.off_m;
          v_rem_km := cp.remaining_km;
          v_progress := 'corridor';
          v_flags := array_append(v_flags, 'pozycja GPS — postęp na korytarzu OSM'::text);
        elsif g_site is not null and g_pin is not null
           and st_distance(g_pin::geography, g_site::geography) > 0 then
          v_frac := least(1, greatest(0, st_distance(p.g::geography, g_site::geography) / st_distance(g_pin::geography, g_site::geography)));
          v_flags := array_append(v_flags, 'pozycja GPS — odległość do placu w linii prostej'::text);
        else
          v_frac := 0.5; v_var := v_var + (h_se * 60 * 0.25)^2; v_sum := v_sum + (h_se * 60 * 0.25);
          v_comp := v_comp || jsonb_build_object('code','SE_NO_GPS','min',round(h_se * 60 * 0.25));
          v_flags := array_append(v_flags, 'brak świeżej pozycji — połowa odcinka SE'::text);
        end if;
      else
        v_frac := 0.5; v_var := v_var + (h_se * 60 * 0.25)^2; v_sum := v_sum + (h_se * 60 * 0.25);
        v_comp := v_comp || jsonb_build_object('code','SE_NO_GPS','min',round(h_se * 60 * 0.25));
        v_flags := array_append(v_flags, 'brak świeżej pozycji — połowa odcinka SE'::text);
      end if;
    end if;
    -- H-4: jazda pozostała; odpoczynki/przerwy wg UE (nie proporcja do trasy)
    v_drive_need := h_road_eff * v_frac;
    select * into sch from h4_schedule_remaining(
      v_drive_need,
      coalesce(st.driven_today_h, 0),
      coalesce(st.extended_used, 0),
      coalesce(st.since_break_h, st.driven_today_h)
    );
    v_drive_h := sch.drive_h; v_rest_h := sch.rest_h; v_break_h := sch.break_h;
    v_rem := sch.total_h;
    v_eta := p_now + make_interval(secs => (v_rem * 3600)::int);
    if sch.flags is not null then v_flags := v_flags || sch.flags; end if;
    v_var := v_var + (sch.drive_h * 60 * sp_road)^2; v_sum := v_sum + (sch.drive_h * 60 * sp_road);
    v_comp := v_comp || jsonb_build_object('code','SE_ROAD','min',round(sch.drive_h * 60 * sp_road));
    v_var := v_var + (sch.break_h * 60 * sp_brk)^2; v_sum := v_sum + (sch.break_h * 60 * sp_brk);
    v_comp := v_comp || jsonb_build_object('code','SE_BREAKS','min',round(sch.break_h * 60 * sp_brk));
    -- H-4: niepewność odpoczynku > 0 (earlier/later); I-15 ±0% nie dotyczy rest z GPS
    v_var := v_var + (sch.rest_h * 60 * v_h4_rest_spread)^2; v_sum := v_sum + (sch.rest_h * 60 * v_h4_rest_spread);
    v_comp := v_comp || jsonb_build_object('code','H4_EU_REST','min',round(sch.rest_h * 60 * v_h4_rest_spread));
    v_segs := v_segs || jsonb_build_object('code','SE_ROAD','hours',round(sch.drive_h, 1),'spread_pct',round(sp_road * 100),'slowdown_mult',v_slow)
                     || jsonb_build_object('code','H4_EU_REST','hours',round(sch.rest_h, 1),'spread_pct',round(v_h4_rest_spread * 100))
                     || jsonb_build_object('code','H4_EU_BREAKS','hours',round(sch.break_h, 1),'spread_pct',round(sp_brk * 100))
                     || jsonb_build_object('code','H4_SEGMENTS','items',sch.segments);
    v_seg := v_status::text;
  else
    select coalesce(x.delayed_departure_at, x.departure_at) as dep, coalesce(x.delayed_arrival_at, x.arrival_at) as arr,
           x.status, x.id, (x.delayed_departure_at is not null or x.status = 'OPOZNIONY') as delayed
      into v_sail from sailings x where x.id = l.sailing_id;
    v_has := found;
    if v_has and v_sail.status = 'ODWOLANY' then
      v_flags := array_append(v_flags, 'przypisany rejs odwołany'::text); v_has := false;
    elsif v_has and v_status < 'FERRY' and v_sail.dep < p_now then
      v_flags := array_append(v_flags, 'przypisany rejs odpłynął bez transportu'::text); v_has := false;
    end if;

    if v_status = 'FERRY' then
      if v_has then
        v_arr := v_sail.arr; v_sail_src := 'przypisany';
        v_var := v_var + (30)^2; v_sum := v_sum + (30); v_comp := v_comp || jsonb_build_object('code','SAILING','min',round(30));
        if v_sail.delayed then v_var := v_var + (60)^2; v_sum := v_sum + (60); v_comp := v_comp || jsonb_build_object('code','SAILING_DELAYED','min',round(60)); end if;
      else
        v_arr := p_now + make_interval(secs => (h_cross * 0.5 * 3600)::int);
        v_var := v_var + (h_cross * 60 * 0.5)^2; v_sum := v_sum + (h_cross * 60 * 0.5);
        v_comp := v_comp || jsonb_build_object('code','FERRY_NO_SAILING','min',round(h_cross * 60 * 0.5));
        v_flags := array_append(v_flags, 'na promie bez rejsu w rozkładzie — połowa przeprawy'::text);
      end if;
      v_seg := 'FERRY';
    else
      if (v_left) is true then
        v_start := p_now;
      else
        v_start := greatest(p_now, coalesce(l.plan_load_to, l.plan_load_from, (l.plan_load_date + time '12:00') at time zone 'Europe/Warsaw', p_now));
      end if;
      v_frac := case when v_status = 'AT_PORT_GDANSK' then 0 when v_status = 'IN_TRANSIT_PL' then 0.5 else 1 end;
      if v_status = 'IN_TRANSIT_PL' then
        if p.ts is not null and p.ts >= p_now - make_interval(mins => (fresh_h * 60)::int) then
          select * into cp from corridor_progress('PL_ROAD', p.g);
          if found and cp.remaining_frac is not null then
            v_frac := cp.remaining_frac;
            v_off := cp.off_m;
            v_rem_km := cp.remaining_km;
            v_progress := 'corridor';
            v_flags := array_append(v_flags, 'pozycja GPS — postęp na korytarzu OSM'::text);
          elsif g_pout is not null and g_load is not null
             and st_distance(g_load::geography, g_pout::geography) > 0 then
            v_frac := least(1, greatest(0, st_distance(p.g::geography, g_pout::geography) / st_distance(g_load::geography, g_pout::geography)));
            v_flags := array_append(v_flags, 'pozycja GPS — odległość do portu w linii prostej'::text);
          else
            v_flags := array_append(v_flags, 'brak świeżej pozycji — połowa odcinka PL'::text);
            v_var := v_var + (h_pl * 60 * 0.25)^2; v_sum := v_sum + (h_pl * 60 * 0.25);
            v_comp := v_comp || jsonb_build_object('code','PL_NO_GPS','min',round(h_pl * 60 * 0.25));
          end if;
        else
          v_flags := array_append(v_flags, 'brak świeżej pozycji — połowa odcinka PL'::text);
          v_var := v_var + (h_pl * 60 * 0.25)^2; v_sum := v_sum + (h_pl * 60 * 0.25);
          v_comp := v_comp || jsonb_build_object('code','PL_NO_GPS','min',round(h_pl * 60 * 0.25));
        end if;
      end if;
      if v_status < 'IN_TRANSIT_PL' and v_start > p_now then v_flags := array_append(v_flags, 'przed załadunkiem — start z planu załadunku'::text); end if;
      v_drive_h := round(h_pl * v_frac, 2);
      v_checkin_h := case when v_status = 'AT_PORT_GDANSK' then 0 else h_ci end;
      v_segs := v_segs || jsonb_build_object('code','PL_ROAD','hours',round(h_pl * v_frac, 1),'spread_pct',round(sp_pl * 100));
      v_start := v_start + make_interval(secs => ((h_pl * v_frac + v_checkin_h) * 3600)::int);
      if v_has then
        v_dep := v_sail.dep; v_arr := v_sail.arr; v_sail_src := 'przypisany';
        v_var := v_var + (30)^2; v_sum := v_sum + (30); v_comp := v_comp || jsonb_build_object('code','SAILING','min',round(30));
        if v_sail.delayed then v_var := v_var + (60)^2; v_sum := v_sum + (60); v_comp := v_comp || jsonb_build_object('code','SAILING_DELAYED','min',round(60)); end if;
        if v_start > v_dep then
          v_flags := array_append(v_flags, 'rejs zagrożony — dojazd i check-in po odejściu'::text);
          v_var := v_var + (12 * 60)^2; v_sum := v_sum + (12 * 60); v_comp := v_comp || jsonb_build_object('code','SAILING_AT_RISK','min',round(12 * 60));
        end if;
      else
        -- II-7 / STENA-3: najbliższy rejs GDN-NYN lub GDY-KAA
        select coalesce(x.delayed_departure_at, x.departure_at), coalesce(x.delayed_arrival_at, x.arrival_at)
          into v_dep, v_arr
          from sailings x
         where x.project_id = l.project_id
           and x.route in ('GDN-NYN', 'GDY-KAA') and x.status <> 'ODWOLANY'
           and coalesce(x.delayed_departure_at, x.departure_at) >= v_start
         order by coalesce(x.delayed_departure_at, x.departure_at) limit 1;
        if v_dep is not null then
          v_sail_src := 'założony (najbliższy w rozkładzie)';
          v_flags := array_append(v_flags, 'brak przypisanego rejsu — założony najbliższy z rozkładu'::text);
          v_var := v_var + (6 * 60)^2; v_sum := v_sum + (6 * 60); v_comp := v_comp || jsonb_build_object('code','SAILING_ASSUMED','min',round(6 * 60));
        else
          v_dep := v_start; v_arr := v_start + make_interval(secs => (h_cross * 3600)::int);
          v_flags := array_append(v_flags, 'brak rejsu w rozkładzie — przeprawa z założenia'::text);
          v_var := v_var + (12 * 60)^2; v_sum := v_sum + (12 * 60); v_comp := v_comp || jsonb_build_object('code','NO_SCHEDULE','min',round(12 * 60));
          v_var := v_var + (h_cross * 60 * sp_cross)^2; v_sum := v_sum + (h_cross * 60 * sp_cross);
          v_comp := v_comp || jsonb_build_object('code','CROSSING','min',round(h_cross * 60 * sp_cross));
        end if;
      end if;
      v_seg := v_status::text;
    end if;
    v_segs := v_segs || jsonb_build_object('code','CROSSING','departure',v_dep,'arrival',v_arr,'source',coalesce(v_sail_src,'założenie'));
    -- H-4 po promie: zegar od zera (D-9 odpoczynek na promie)
    select * into sch from h4_schedule_remaining(h_road_eff, 0, 0, 0);
    v_drive_h := coalesce(v_drive_h, 0) + sch.drive_h;
    v_rest_h := coalesce(v_rest_h, 0) + sch.rest_h;
    v_break_h := coalesce(v_break_h, 0) + sch.break_h;
    v_eta := v_arr + make_interval(secs => (sch.total_h * 3600)::int);
    v_flags := array_append(v_flags, 'H-4 po promie — odpoczynek D-9, zegar od zera'::text);
    if sch.flags is not null then v_flags := v_flags || sch.flags; end if;
    v_segs := v_segs || jsonb_build_object('code','SE_ROAD','hours',round(sch.drive_h, 1),'spread_pct',round(sp_road * 100),'slowdown_mult',v_slow)
                     || jsonb_build_object('code','H4_EU_REST','hours',round(sch.rest_h, 1),'spread_pct',round(v_h4_rest_spread * 100))
                     || jsonb_build_object('code','H4_EU_BREAKS','hours',round(sch.break_h, 1),'spread_pct',round(sp_brk * 100))
                     || jsonb_build_object('code','H4_SEGMENTS','items',sch.segments);
    v_var := v_var + (sch.drive_h * 60 * sp_road)^2; v_sum := v_sum + (sch.drive_h * 60 * sp_road);
    v_comp := v_comp || jsonb_build_object('code','SE_ROAD','min',round(sch.drive_h * 60 * sp_road));
    v_var := v_var + (sch.break_h * 60 * sp_brk)^2; v_sum := v_sum + (sch.break_h * 60 * sp_brk);
    v_comp := v_comp || jsonb_build_object('code','SE_BREAKS','min',round(sch.break_h * 60 * sp_brk));
    v_var := v_var + (sch.rest_h * 60 * v_h4_rest_spread)^2; v_sum := v_sum + (sch.rest_h * 60 * v_h4_rest_spread);
    v_comp := v_comp || jsonb_build_object('code','H4_EU_REST','min',round(sch.rest_h * 60 * v_h4_rest_spread));
    if v_status < 'FERRY' then
      v_var := v_var + (h_pl * 60 * sp_pl)^2; v_sum := v_sum + (h_pl * 60 * sp_pl);
      v_comp := v_comp || jsonb_build_object('code','PL_ROAD','min',round(h_pl * 60 * sp_pl));
    end if;
  end if;

  if st.flags is not null then
    v_flags := v_flags || st.flags;
  end if;
  if coalesce(st.cautious, false) then
    v_flags := array_append(v_flags, 'H-4 założenie ostrożne — czas pracy bez pełnej historii GPS'::text);
    -- „Wysoka” niedostępna przy braku historii odpoczynku (rozrzut > 60 min)
    v_var := v_var + (61)^2; v_sum := v_sum + 61;
    v_comp := v_comp || jsonb_build_object('code','H4_CAUTIOUS','min',61);
  end if;

  v_causes := jsonb_build_object(
    'drive_h', v_drive_h,
    'checkin_h', v_checkin_h,
    'rest_h', v_rest_h,
    'breaks_h', v_break_h,
    'weather_slowdown_pct', v_weather_pct,
    'progress', v_progress,
    'remaining_km', v_rem_km,
    'off_corridor_m', v_off,
    'h4', true,
    'h4_source', coalesce(st.source, 'n/a'),
    'h4_cautious', coalesce(st.cautious, false),
    'tachograph', 'none'
  );

  return query select v_eta, round(sqrt(v_var))::int, jsonb_build_object(
    'method', 'ETA v2 (OSM)', 'segment', v_seg, 'segments', v_segs,
    'band', jsonb_build_object('method', 'RSS', 'min', round(sqrt(v_var)), 'linear_sum_min', round(v_sum),
                               'components', (select coalesce(jsonb_agg(c), '[]'::jsonb) from jsonb_array_elements(v_comp) c where (c->>'min')::numeric > 0)),
    'flags', to_jsonb(v_flags), 'sailing', v_sail_src,
    'attribution', v_attr, 'causes', v_causes, 'computed_at', p_now);
end $function$;


-- Jak 0242/0279: brak EXECUTE dla anon/authenticated (i2 + security + nullguard).
revoke all on function public.compute_load_eta(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.compute_load_eta(uuid, timestamptz) to service_role;

-- -------------------------------------------------------------------------
-- 6) Kolumny odłączenia (RODO / śledzenie zmian)
-- -------------------------------------------------------------------------
alter table public.positions
  add column if not exists detached_load_id uuid,
  add column if not exists detached_at timestamptz;
alter table public.load_events
  add column if not exists detached_load_id uuid,
  add column if not exists detached_at timestamptz;

comment on column public.positions.detached_load_id is
  'D-1710: transport, z którego odłączono pozycję (load_id = null); retencja 30 dni.';
comment on column public.load_events.detached_load_id is
  'D-1710: transport, z którego odłączono zdarzenie (load_id = null).';

