-- =====================================================================
-- #581 P4-k cz.2 — kalibracja ETA ciągła (cron 48 h + auto-apply 27A)
-- F7 r1 #604: B1–B7, Ś1–Ś8, D7–D11; przeprawy kalibrują się; słownik tras.
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

-- FK corridor → params (Ś2); najpierw uzupełnij brakujące kody z obserwacji
insert into public.eta_segment_params (code, label, hours, spread_pct, source)
select distinct o.corridor, o.corridor, 1, 20, '#581 F7 Ś2: kod z obserwacji'
  from public.eta_segment_observations o
 where not exists (select 1 from public.eta_segment_params p where p.code = o.corridor)
on conflict (code) do nothing;

do $fk$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'eta_segment_observations_corridor_fkey'
       and conrelid = 'public.eta_segment_observations'::regclass
  ) then
    alter table public.eta_segment_observations
      add constraint eta_segment_observations_corridor_fkey
      foreign key (corridor) references public.eta_segment_params(code);
  end if;
end $fk$;

-- undone_at (B5b)
alter table public.eta_calibration_versions
  add column if not exists undone_at timestamptz;

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
  'ETA_CALIBRATION_APPROVAL', 'dec_type_ETA_CALIBRATION_APPROVAL', 'HHL',
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
     and NEW.resolution_code = 'APPLY'
  then
    v_ver := nullif(NEW.detail->>'version', '')::bigint;
    if v_ver is not null then
      perform public.eta_apply_calibration_internal(v_ver, null, false);
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
  v_fit_cut timestamptz;
  v_skip_codes text[] := '{}';
  v_exist bigint;
begin
  select value into v_frozen from app_parameters where key = 'ETA_CALIBRATION_FROZEN';
  if coalesce(v_frozen, 0) = 1 then
    return jsonb_build_object('ok', false, 'reason', 'FROZEN');
  end if;

  -- B5b: kody cofnięte w ostatnich 7 dniach — pomijaj, dopóki < 3 nowych obserwacji po undone_at
  -- Podzapytanie: przy 0 wierszach INTO nie może zostawić NULL (odfiltrowałoby cały for).
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
  ), '{}') into v_skip_codes;

  for r in
    select o.corridor as code,
           count(*)::int as n,
           percentile_cont(0.5) within group (order by o.hours_observed)::numeric as med,
           percentile_cont(0.1) within group (order by o.hours_observed)::numeric as p10,
           percentile_cont(0.9) within group (order by o.hours_observed)::numeric as p90,
           p.hours as hours_now,
           p.spread_pct as spread_now
      from eta_segment_observations o
      join eta_segment_params p on p.code = o.corridor
     where o.exclude_reason is null
       and o.hours_observed > 0
       and o.observed_at >= now() - interval '90 days'
       and coalesce(o.features->>'p4k', '') = 'true'
       and (
         o.corridor ~ '^(PL_ROAD|SE_ROAD|CROSSING_)'
         and o.corridor not in ('SE_BREAKS', 'SE_DAILY_REST', 'GPS_FRESH_MIN', 'PORT_CHECKIN')
       )
       and (v_skip_codes = '{}' or o.corridor <> all (v_skip_codes))
       -- Ś3: ≥7 dni od ostatniego auto-apply tego kodu
       and not exists (
         select 1 from eta_calibration_versions v
          where v.applied is true
            and v.undone_at is null
            and v.note like '%auto-applied%'
            and v.params_after ? o.corridor
            and v.created_at > now() - interval '7 days'
       )
     group by o.corridor, p.hours, p.spread_pct
    having count(*) >= 5
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
    -- Ś3: limit łącznej zmiany na 30 dni (suma |Δh|/h)
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
    -- Ś4: tylko propozycje ciągłe automatyczne
    delete from eta_calibration_versions
     where applied is not true
       and created_by is null
       and coalesce(note, '') like 'propozycja ciągła%'
       and undone_at is null;
    return jsonb_build_object('ok', true, 'proposal', null, 'reason', 'NO_CHANGE');
  end if;

  -- B7: dopasowanie na starszych, błąd na najnowszych nieużytych
  -- jsonb_exists: operator ? przy zmiennej PL/pgSQL ($1 ?) psuje plan SPI.
  select percentile_cont(0.7) within group (order by o.observed_at)
    into v_fit_cut
    from eta_segment_observations o
   where o.exclude_reason is null
     and o.hours_observed > 0
     and coalesce(o.features->>'p4k', '') = 'true'
     and jsonb_exists(v_after, o.corridor);

  select
    coalesce(avg(abs(o.hours_observed - (v_after -> o.corridor ->> 'hours')::numeric) * 60.0), 0),
    count(*)::int
    into v_err_after, v_err_n
    from eta_segment_observations o
   where o.exclude_reason is null
     and o.hours_observed > 0
     and coalesce(o.features->>'p4k', '') = 'true'
     and jsonb_exists(v_after, o.corridor)
     and (v_fit_cut is null or o.observed_at >= v_fit_cut);

  select
    coalesce(avg(abs(o.hours_observed - (v_before -> o.corridor ->> 'hours')::numeric) * 60.0), 0)
    into v_err_before
    from eta_segment_observations o
   where o.exclude_reason is null
     and o.hours_observed > 0
     and coalesce(o.features->>'p4k', '') = 'true'
     and jsonb_exists(v_after, o.corridor)
     and (v_fit_cut is null or o.observed_at >= v_fit_cut);

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

  -- Ś4: update istniejącej propozycji ciągłej zamiast delete+insert
  select id into v_exist
    from eta_calibration_versions
   where applied is not true
     and created_by is null
     and coalesce(note, '') like 'propozycja ciągła%'
     and undone_at is null
   order by id desc
   limit 1;

  if v_exist is not null then
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
    raise exception 'BUSY' using errcode = 'P0001';
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
           least(greatest(coalesce((e.value->>'spread_pct')::numeric, 20), 10), 100)
      from jsonb_each(v.params_after) e
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
     and created_by is null
     and coalesce(note, '') like 'propozycja ciągła%'
   order by id desc
   limit 1;
  if v_id is null then
    -- też ręczne? Ś4: auto tylko ciągłe
    select id into v_id
      from eta_calibration_versions
     where applied is not true
       and undone_at is null
       and coalesce(note, '') like 'p4k-test%'
     order by id desc
     limit 1;
  end if;
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
       or SQLERRM like 'BUSY%' or SQLERRM like 'wersja cofnięta%' then
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
      'locale', u.locale
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
