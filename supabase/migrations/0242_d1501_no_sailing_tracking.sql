-- 0242 — D-20261020-1501-01 (#362) + D-20261020-1525-01 cz.2 (#364):
-- NO_SAILING / NO_TRACKING (l3_scan), rejs historyczny tylko HHL_ADMIN,
-- SE nie w awiz_missing / load_ready_gaps (sprawa NO_AWIZ_SE, próg AWIZ_EARLY_H).
-- Bazuje na: awiz_missing 0237, l3_scan 0236, l3_upsert_alarm 0235,
-- guard_load_update 0240, l1_decision_type 0143, risk_is_predelivery 0229.

-- ---------------------------------------------------------------------
-- 1. Katalog decyzji (jak NO_AWIZACJA)
-- ---------------------------------------------------------------------
insert into decision_types (code, title_key, decider_role, options, due_hours, due_note, severity_default, sort_order)
values
 (
   'NO_SAILING', 'dec_type_NO_SAILING', 'CARRIER',
   '[{"code":"ADD_AWIZACJA","label_key":"dec_opt_ADD_AWIZACJA","requires_comment":false,"effect":"OPEN_AWIZACJA"},{"code":"REPORT_PROBLEM","label_key":"dec_opt_REPORT_PROBLEM","requires_comment":true,"effect":"ESCALATE"}]'::jsonb,
   null, 'termin awizacji', 'WARNING', 40
 ),
 (
   'NO_TRACKING', 'dec_type_NO_TRACKING', 'CARRIER',
   '[{"code":"ADD_AWIZACJA","label_key":"dec_opt_ADD_AWIZACJA","requires_comment":false,"effect":"OPEN_AWIZACJA"},{"code":"REPORT_PROBLEM","label_key":"dec_opt_REPORT_PROBLEM","requires_comment":true,"effect":"ESCALATE"}]'::jsonb,
   null, 'start okna śledzenia + 2 h', 'WARNING', 41
 ),
 (
   'NO_AWIZ_SE', 'dec_type_NO_AWIZ_SE', 'CARRIER',
   '[{"code":"ADD_AWIZACJA","label_key":"dec_opt_ADD_AWIZACJA","requires_comment":false,"effect":"OPEN_AWIZACJA"},{"code":"REPORT_PROBLEM","label_key":"dec_opt_REPORT_PROBLEM","requires_comment":true,"effect":"ESCALATE"}]'::jsonb,
   null, 'AWIZ_EARLY_H przed dostawą', 'WARNING', 42
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

create or replace function public.l1_decision_type(p_kind text, p_detail jsonb)
returns text
language sql
stable
set search_path = public
as $$
  select case
    when p_kind = 'RESOURCE_MISSING' and coalesce(p_detail->>'rule', '') = 'L3_AWIZ' then 'NO_AWIZACJA'
    when p_kind = 'RESOURCE_MISSING' and coalesce(p_detail->>'rule', '') = 'L3_NO_SAILING' then 'NO_SAILING'
    when p_kind = 'RESOURCE_MISSING' and coalesce(p_detail->>'rule', '') = 'L3_NO_TRACKING' then 'NO_TRACKING'
    when p_kind = 'RESOURCE_MISSING' and coalesce(p_detail->>'rule', '') = 'L3_NO_AWIZ_SE' then 'NO_AWIZ_SE'
    when p_kind = 'DOC_MISSING' and coalesce(p_detail->>'rule', '') = 'L3_DOC' then 'DOC_MISSING'
    when p_kind = 'DOC_MISSING' then 'DOC_MISSING'
    when p_kind = 'PERMIT' then 'DOC_MISSING'
    when p_kind = 'INSURANCE' then 'INSURANCE_EXPIRING'
    when p_kind = 'ETA_BREACH' then 'ETA_AFTER_LATEST'
    when p_kind = 'LATE_DATE_CHANGE' then 'KSH_DATE_LT_5D'
    when p_kind = 'SILENT_VEHICLE' then 'NO_POSITION'
    when p_kind = 'INVOICE_MISMATCH' then 'SEFS_INVOICE_DIFF'
    when p_kind = 'WEATHER' then 'FERRY_CANCELLED'
    when p_kind = 'FERRY' and coalesce(p_detail->>'title_key', '') = 'rk_sailing_cancelled' then 'FERRY_CANCELLED'
    when p_kind in ('ROAD_PL', 'ROAD_SE') and coalesce(p_detail->>'title_key', '') = 'rk_off_corridor' then 'ROUTE_DEVIATION'
    when p_kind = 'JOB_FAILURE' and coalesce(p_detail->>'source', '') = 'backup' then 'BACKUP_FAILED'
    else null
  end;
$$;
revoke all on function public.l1_decision_type(text, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. title_key w l3_upsert_alarm
-- ---------------------------------------------------------------------
create or replace function public.l3_upsert_alarm(
  p_project uuid,
  p_load uuid,
  p_kind risk_kind,
  p_key text,
  p_title text,
  p_title_key text,
  p_active boolean,
  p_critical boolean,
  p_due timestamptz,
  p_detail jsonb,
  p_now timestamptz
) returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_sev text;
  v_old text;
  v_detail jsonb;
  v_level text;
  v_key text;
  v_code text;
  v_kept text;
  v_in text;
  v_bad boolean;
begin
  if p_active is not true then
    update risk_signals
       set resolved_at = p_now
     where dedup_key = p_key and resolved_at is null and detail->>'l3' = '1';
    if found then
      perform l3_lapse(p_key, p_now);
    end if;
    return 0;
  end if;
  v_level := case when p_critical then 'critical' else 'warning' end;
  v_sev := case when p_critical then 'CRITICAL' else 'HIGH' end;
  v_detail := coalesce(p_detail, '{}'::jsonb) || jsonb_build_object(
    'l3', '1',
    'l3_level', v_level,
    'l3_due', p_due,
    'title_key', p_title_key
  );
  v_key := p_key;
  select id, severity::text, detail#>>'{params,code}' into v_id, v_old, v_kept
    from risk_signals
   where dedup_key = v_key and resolved_at is null;
  v_code := case when p_load is null then null else public.load_sms_code(p_load) end;
  v_in := v_detail #>> '{params,code}';
  v_bad := p_load is not null and v_in is not null and (
    lower(v_in) = lower(left(p_load::text, 8))
    or exists (
      select 1 from loads l
       where l.id = p_load and nullif(btrim(l.order_no), '') is not null and l.order_no = v_in
    )
  );
  if v_kept is not null
     and (p_load is null or lower(v_kept) is distinct from lower(left(p_load::text, 8)))
     and not exists (
       select 1 from loads l
        where l.id = p_load and nullif(btrim(l.order_no), '') is not null and l.order_no = v_kept
     )
     and (v_bad is true or v_code is null or v_code = '—')
     and v_detail ? 'params' then
    v_detail := jsonb_set(v_detail, '{params,code}', to_jsonb(v_kept), true);
  elsif v_code is not null and v_code is distinct from '—' and v_detail ? 'params'
        and (v_bad is true or v_in is not null) then
    v_detail := jsonb_set(v_detail, '{params,code}', to_jsonb(v_code), true);
  end if;
  if v_id is null then
    insert into risk_signals (project_id, load_id, kind, severity, title, title_key, detail, dedup_key, detected_at)
    values (
      p_project, p_load, p_kind, v_sev::risk_severity, p_title,
      case p_title_key
        when 'rk_res_driver' then 'rk_res_driver'
        when 'rk_res_docs' then 'rk_res_docs'
        when 'rk_silent_vehicle' then 'rk_silent_vehicle'
        when 'rk_eta_breach' then 'rk_eta_breach'
        when 'rk_off_corridor' then 'rk_off_corridor'
        when 'rk_no_sailing' then 'rk_no_sailing'
        when 'rk_no_tracking' then 'rk_no_tracking'
        when 'rk_no_awiz_se' then 'rk_no_awiz_se'
        else null
      end,
      v_detail, v_key, p_now
    )
    on conflict (dedup_key) where dedup_key is not null and resolved_at is null do nothing;
    update decisions
       set due_at = coalesce(p_due, due_at),
           detail = detail || jsonb_build_object('l3', true, 'level', v_level)
     where detail->>'event_key' = p_key
       and status in ('NEW', 'ASSIGNED', 'SNOOZED');
    return 1;
  end if;
  if v_old is distinct from v_sev or (select detail->>'l3_level' from risk_signals where id = v_id) is distinct from v_level then
    update risk_signals
       set severity = v_sev::risk_severity,
           detail = detail || v_detail,
           title = p_title
     where id = v_id;
    if p_critical and v_old is distinct from 'CRITICAL' then
      perform l3_critical_notify(p_key, p_now);
      return 1;
    end if;
  end if;
  return 0;
end $$;
revoke all on function public.l3_upsert_alarm(uuid, uuid, risk_kind, text, text, text, boolean, boolean, timestamptz, jsonb, timestamptz) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. awiz_missing — SE → AWIZ_SE (poza AWIZ)
-- ---------------------------------------------------------------------
create or replace function public.awiz_missing(p_load uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  l public.loads%rowtype;
  gaps jsonb := '[]'::jsonb;
  awiz text[] := array[]::text[];
  v_pilots int;
  v_escorts int;
  v_items jsonb;
  v_anchor date;
  v_has_policy boolean;
  v_permit_missing boolean;
  v_kind text;
begin
  select * into l from public.loads where id = p_load;
  if l.id is null then
    return '[]'::jsonb;
  end if;
  if l.status::text not in ('PLANNED', 'RESOURCES_PENDING', 'DOCS_PENDING') then
    return '[]'::jsonb;
  end if;

  if l.carrier_org_id is null then
    gaps := gaps || jsonb_build_array(jsonb_build_object(
      'kind', 'CARRIER', 'items', jsonb_build_array('Brak przewoźnika'), 'who', 'HHL'
    ));
  end if;

  if coalesce(btrim(l.driver_name), '') = '' then awiz := array_append(awiz, 'kierowca'); end if;
  if coalesce(btrim(l.driver_phone), '') = '' then awiz := array_append(awiz, 'telefon'); end if;
  if coalesce(btrim(l.tractor_plate), '') = '' then awiz := array_append(awiz, 'ciągnik'); end if;
  if coalesce(btrim(l.trailer_plate), '') = '' then awiz := array_append(awiz, 'naczepa'); end if;
  if coalesce(array_length(awiz, 1), 0) > 0 then
    gaps := gaps || jsonb_build_array(jsonb_build_object(
      'kind', 'AWIZ', 'items', to_jsonb(awiz), 'who', 'SCX'
    ));
  end if;

  /* F7 B4: SE nie wraca w lukach Gotowy — sprawa l3:NO_AWIZ_SE w l3_scan. */

  if l.sailing_id is null then
    gaps := gaps || jsonb_build_array(jsonb_build_object('kind', 'SAILING', 'who', 'SCX'));
  end if;

  select coalesce(max(p.escort_required), 0) into v_pilots
    from public.load_permits lp
    join public.permits p on p.id = lp.permit_id
   where lp.load_id = l.id;
  select count(*)::int into v_escorts from public.load_escorts e where e.load_id = l.id;
  if v_pilots < coalesce(l.escort_vehicles, 0) then
    v_pilots := coalesce(l.escort_vehicles, 0);
  end if;
  if v_pilots > 0 and v_escorts < v_pilots then
    v_items := case
      when v_pilots > 1 then jsonb_build_array('pilot ×' || v_pilots::text)
      else jsonb_build_array('pilot')
    end;
    gaps := gaps || jsonb_build_array(jsonb_build_object(
      'kind', 'PILOTS', 'items', v_items, 'who', 'SCX'
    ));
  end if;

  if coalesce(btrim(l.carrier_order_no), '') = '' then
    gaps := gaps || jsonb_build_array(jsonb_build_object('kind', 'ORDER_SCX', 'who', 'SCX'));
  end if;
  if coalesce(btrim(l.hhl_order_no), '') = '' then
    gaps := gaps || jsonb_build_array(jsonb_build_object('kind', 'ORDER_HHL', 'who', 'HHL'));
  end if;

  v_anchor := coalesce(l.plan_load_date, (now() at time zone 'Europe/Warsaw')::date);
  if l.carrier_org_id is not null then
    v_has_policy := exists (
      select 1 from public.insurance_policies ip
       where ip.org_id = l.carrier_org_id
         and ip.approval_status = 'APPROVED'
         and ip.valid_from <= v_anchor
         and ip.valid_until >= v_anchor
    );
    if v_has_policy is not true then
      gaps := gaps || jsonb_build_array(jsonb_build_object('kind', 'POLICY_SCX', 'who', 'SCX'));
    end if;
  end if;

  v_kind := coalesce(l.permit_kind, (public.symbol_spec_of(l.id)).permit_kind, 'FIRMA');
  if public.permit_required_enabled() is true
     and public.load_needs_permit(l.id) is true then
    if v_kind = 'TRASA' then
      v_permit_missing := exists (
        select 1 from unnest(array['PL', 'SE']) c
         where not exists (
           select 1
             from public.load_permits lp
             join public.permits p on p.id = lp.permit_id
            where lp.load_id = l.id
              and p.country = c
              and coalesce(p.scope, 'TRASA') = 'TRASA'
              and v_anchor between p.valid_from and p.valid_until
         )
      );
    else
      v_permit_missing := not exists (
        select 1
          from public.load_permits lp
          join public.permits p on p.id = lp.permit_id
         where lp.load_id = l.id
           and p.scope = 'FIRMA'
           and v_anchor between p.valid_from and p.valid_until
      );
    end if;
    if v_permit_missing is true then
      gaps := gaps || jsonb_build_array(jsonb_build_object(
        'kind', 'PERMIT',
        'items', case when v_kind = 'TRASA'
          then jsonb_build_array('Trasa')
          else jsonb_build_array('Firma') end,
        'who', 'SCX'
      ));
    end if;
  end if;

  return gaps;
end $$;

revoke all on function public.awiz_missing(uuid) from public, anon, authenticated;
comment on function public.awiz_missing(uuid) is
  'A9+A7+D-1525/F7 B4: braki do Gotowy (bez SE); PERMIT Firma/Trasa.';

-- F7 B4: dowolna luka w awiz_missing blokuje Gotowy; SE = sprawa L3, nie luka.
create or replace function public.a9_try_ready(p_load uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status public.load_status;
  v_gaps jsonb;
begin
  if current_setting('tower.dates_ctx', true) = 'on' then
    return false;
  end if;
  select status into v_status from public.loads where id = p_load for update;
  if not found then
    return false;
  end if;
  if v_status::text not in ('PLANNED', 'RESOURCES_PENDING', 'DOCS_PENDING') then
    return false;
  end if;
  v_gaps := public.awiz_missing(p_load);
  if jsonb_array_length(v_gaps) > 0 then
    return false;
  end if;
  return public.auto_set_status(
    p_load,
    v_status,
    'READY'::public.load_status,
    'Awizacja kompletna',
    now(),
    jsonb_build_object('actor', 'system', 'source', 'A9', 'gaps', v_gaps)
  );
end $$;

revoke all on function public.a9_try_ready(uuid) from public, anon, authenticated;
comment on function public.a9_try_ready(uuid) is
  'A9: → READY gdy awiz_missing puste (F7 B4: SE poza lukami).';

-- ---------------------------------------------------------------------
-- 4. l3_scan — NO_SAILING / NO_TRACKING / NO_AWIZ_SE
-- ---------------------------------------------------------------------
create or replace function public.l3_scan(p_now timestamptz default now())
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  n int := 0;
  v_code text;
  v_anchor timestamptz;
  v_missing boolean;
  v_permit boolean;
  v_policy boolean;
  v_warn timestamptz;
  v_crit timestamptz;
  v_gaps jsonb;
  v_sail_missing boolean;
  v_track_missing boolean;
  v_se boolean;
  v_due timestamptz;
begin
  if p_now is null or l3_ops('AWIZ_EARLY_H') is null or l3_ops('DOC_WARN_H') is null then
    return 0;
  end if;
  for r in
    select l.*
      from public.loads l
     where l.status not in ('CANCELLED', 'DELIVERED', 'UNLOADED', 'READY_TO_INVOICE', 'INVOICED')
  loop
    v_code := public.load_sms_code(r.id);
    v_anchor := l3_anchor(r.plan_load_date, r.plan_load_from);
    v_gaps := public.awiz_missing(r.id);

    v_missing := exists (
      select 1 from jsonb_array_elements(v_gaps) g
       where g ->> 'kind' in ('AWIZ', 'PILOTS')
    );
    v_warn := l3_moment(v_anchor, 'AWIZ_EARLY_H');
    v_crit := l3_moment(v_anchor, 'AWIZ_LATE_H');
    n := n + l3_upsert_alarm(
      r.project_id, r.id, 'RESOURCE_MISSING', 'l3:NO_AWIZACJA:' || r.id,
      public.l3_headed(v_code, 'brak awizacji przed załadunkiem'),
      'rk_res_driver',
      v_anchor is not null and v_missing and p_now >= v_warn,
      v_crit is not null and p_now >= v_crit,
      v_crit,
      jsonb_build_object('rule', 'L3_AWIZ', 'resource', 'LOAD', 'due', v_anchor,
        'params', jsonb_build_object('code', v_code, 'h', l3_ops('AWIZ_EARLY_H'))),
      p_now
    );

    /* D-1501 / F7 D2: brak rejsu — tylko przed FERRY; progi jak AWIZ. */
    v_sail_missing := r.sailing_id is null and r.status < 'FERRY';
    v_warn := l3_moment(v_anchor, 'AWIZ_EARLY_H');
    v_crit := l3_moment(v_anchor, 'AWIZ_LATE_H');
    n := n + l3_upsert_alarm(
      r.project_id, r.id, 'RESOURCE_MISSING', 'l3:NO_SAILING:' || r.id,
      public.l3_headed(v_code, 'brak rejsu promu w awizacji'),
      'rk_no_sailing',
      v_anchor is not null and v_sail_missing and p_now >= v_warn,
      v_crit is not null and p_now >= v_crit,
      v_crit,
      jsonb_build_object('rule', 'L3_NO_SAILING', 'due', v_anchor,
        'params', jsonb_build_object('code', v_code, 'h', l3_ops('AWIZ_EARLY_H'))),
      p_now
    );

    /* D-1501 / F7 N4+N5+N6: przed AT_SITE, w oknie śledzenia;
       N5: do #368 — bez plan_load_date w przyszłości (fałszywe okno);
       N4: due = start okna + 2 h (CRITICAL od wtedy, wcześniej HIGH);
       N6: pozycja wycisza tylko telematykę (nie MANUAL / DRIVER_PWA). */
    v_track_missing := r.status < 'AT_SITE'
      and r.plan_load_date is not null
      and r.plan_load_date <= (p_now at time zone 'Europe/Warsaw')::date
      and public.load_in_tracking_window(r.id, p_now) is true
      and nullif(btrim(r.telematics_vehicle_id), '') is null
      and not exists (
        select 1 from public.positions p
         where p.load_id = r.id
           and p.ts >= p_now - interval '6 hours'
           and p.source not in ('MANUAL', 'DRIVER_PWA')
      );
    v_warn := coalesce(r.tracking_opened_at, public.tracking_window_start(r.plan_load_date));
    v_crit := case when v_warn is not null then v_warn + interval '2 hours' else null end;
    n := n + l3_upsert_alarm(
      r.project_id, r.id, 'RESOURCE_MISSING', 'l3:NO_TRACKING:' || r.id,
      public.l3_headed(v_code, 'brak linku śledzenia'),
      'rk_no_tracking',
      v_track_missing and v_warn is not null and p_now >= v_warn,
      v_crit is not null and p_now >= v_crit,
      v_crit,
      jsonb_build_object('rule', 'L3_NO_TRACKING', 'due', v_crit,
        'params', jsonb_build_object('code', v_code, 'h', 2)),
      p_now
    );

    /* D-1525 / F7 B4+B5+D3: SE z pól; termin = l3_anchor(dostawa) − AWIZ_EARLY_H. */
    v_se := r.trailer_swap is true
      and (
        coalesce(btrim(r.driver_delivery_name), '') = ''
        or coalesce(btrim(r.driver_delivery_phone), '') = ''
        or coalesce(btrim(r.tractor_delivery_plate), '') = ''
      );
    v_due := l3_moment(l3_anchor(r.plan_delivery_date, r.plan_delivery_from), 'AWIZ_EARLY_H');
    v_warn := case when v_due is not null then v_due - interval '36 hours' else null end;
    n := n + l3_upsert_alarm(
      r.project_id, r.id, 'RESOURCE_MISSING', 'l3:NO_AWIZ_SE:' || r.id,
      public.l3_headed(v_code, 'brak danych odcinka SE przed dostawą'),
      'rk_no_awiz_se',
      v_due is not null and v_se and p_now >= v_warn,
      v_due is not null and p_now >= v_due,
      v_due,
      jsonb_build_object('rule', 'L3_NO_AWIZ_SE', 'due', v_due,
        'params', jsonb_build_object('code', v_code, 'h', l3_ops('AWIZ_EARLY_H'))),
      p_now
    );

    v_permit := exists (
      select 1 from jsonb_array_elements(v_gaps) g where g ->> 'kind' = 'PERMIT'
    );
    v_policy := exists (
      select 1 from jsonb_array_elements(v_gaps) g where g ->> 'kind' = 'POLICY_SCX'
    );
    v_warn := l3_moment(v_anchor, 'DOC_WARN_H');
    v_crit := l3_moment(v_anchor, 'DOC_CRIT_H');
    n := n + l3_upsert_alarm(
      r.project_id, r.id, 'DOC_MISSING', 'l3:DOC_MISSING:' || r.id,
      public.l3_headed(v_code, 'brak wymaganego dokumentu przed załadunkiem'),
      'rk_res_docs',
      v_anchor is not null and (v_permit or v_policy) and p_now >= v_warn,
      v_crit is not null and p_now >= v_crit,
      v_crit,
      jsonb_build_object('rule', 'L3_DOC', 'permit', v_permit, 'policy', v_policy, 'due', v_anchor,
        'params', jsonb_build_object('code', v_code, 'h', l3_ops('DOC_WARN_H'))),
      p_now
    );
  end loop;
  return n;
end $$;
revoke all on function public.l3_scan(timestamptz) from public, anon, authenticated;
comment on function public.l3_scan(timestamptz) is
  'L3: NO_AWIZACJA / NO_SAILING / NO_TRACKING / NO_AWIZ_SE / DOC_MISSING (D-1501, D-1525).';

-- ---------------------------------------------------------------------
-- 5. Predelivery — nowe klucze
-- ---------------------------------------------------------------------
create or replace function public.risk_is_predelivery_alarm(p_dedup text, p_title_key text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select coalesce(p_dedup, '') like 'l3:NO_AWIZACJA:%'
      or coalesce(p_dedup, '') like 'l3:NO_SAILING:%'
      or coalesce(p_dedup, '') like 'l3:NO_TRACKING:%'
      or coalesce(p_dedup, '') like 'l3:NO_AWIZ_SE:%'
      or coalesce(p_dedup, '') like 'l3:DOC_MISSING:%'
      or coalesce(p_dedup, '') like 'RES:DRIVER:%'
      or coalesce(p_dedup, '') like 'RES:VEHICLE:%'
      or coalesce(p_dedup, '') like 'RES:ESCORT:%'
      or coalesce(p_dedup, '') like 'ORDERNO:HHL:%'
      or coalesce(p_dedup, '') like 'ORDERNO:CARRIER:%'
      or coalesce(p_dedup, '') like 'AUTOSTATUS:%'
      or coalesce(p_dedup, '') like 'SILENT:%'
      or coalesce(p_dedup, '') like 'ETA_BREACH:%'
      or coalesce(p_dedup, '') like 'OFF_CORRIDOR:%'
      or coalesce(p_title_key, '') in ('rk_res_vehicle', 'rk_res_escort', 'rk_auto_status_blocked');
$$;
revoke all on function public.risk_is_predelivery_alarm(text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 6. guard_load_update — rejs vs rola
-- ---------------------------------------------------------------------
create or replace function public.guard_load_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_changed  text[];
  v_bad      text[];
  v_ctx      text;
  v_sail_st  text;
  v_dep      timestamptz;
  v_carrier  text[] := array[
    'tractor_plate','trailer_plate','trailer_type','driver_name','driver_phone',
    'driver_phone_country',
    'driver_delivery_name','driver_delivery_phone','driver_delivery_phone_country',
    'tractor_delivery_plate','trailer_swap',
    'escort_vehicles','telematics_vehicle_id','telematics_provider',
    'ferry_booking_ref','sailing_id','carrier_order_no',
    'combo_length_m','combo_width_m','combo_height_m','combo_weight_t',
    'actual_load_at','actual_delivery_at','status','updated_at'];
begin
  if current_setting('tower.eta_ctx', true) = 'on' then
    select coalesce(array_agg(n.key), '{}') into v_changed
      from jsonb_each(to_jsonb(new)) n
     where n.value is distinct from (to_jsonb(old) -> n.key);
    if (v_changed <@ array['eta_site','eta_confidence_min','eta_basis','eta_computed_at','delay_minutes','updated_at']::text[]) is not true then
      raise exception 'Przeliczenie ETA może zmienić wyłącznie kolumny eta_* (zmienione: %)', array_to_string(v_changed, ', ');
    end if;
    return new;
  end if;

  if current_setting('tower.track_ctx', true) = 'on' then
    select coalesce(array_agg(n.key), '{}') into v_changed
      from jsonb_each(to_jsonb(new)) n
     where n.value is distinct from (to_jsonb(old) -> n.key);
    if (v_changed <@ array['tracking_opened_at','updated_at']::text[]) is not true then
      raise exception 'Okno śledzenia może zmienić wyłącznie tracking_opened_at (zmienione: %)', array_to_string(v_changed, ', ');
    end if;
    return new;
  end if;

  if current_setting('tower.dates_ctx', true) = 'on' then
    select coalesce(array_agg(n.key), '{}') into v_changed
      from jsonb_each(to_jsonb(new)) n
     where n.value is distinct from (to_jsonb(old) -> n.key);
    if (v_changed <@ array['plan_load_date','plan_load_from','plan_load_to','plan_delivery_date','plan_delivery_from','plan_delivery_to',
                           'plan_dates_status','plan_dates_confirmed_by','plan_dates_confirmed_at','tracking_opened_at','updated_at']::text[]) is not true then
      raise exception 'Potwierdzenie dat może zmienić wyłącznie daty planu (zmienione: %)', array_to_string(v_changed, ', ');
    end if;
    return new;
  end if;

  if auth.uid() is not null and (new.plan_dates_status, new.plan_dates_confirmed_by, new.plan_dates_confirmed_at)
       is distinct from (old.plan_dates_status, old.plan_dates_confirmed_by, old.plan_dates_confirmed_at) then
    raise exception 'Status dat planu zmienia wyłącznie potwierdzenie KSH („Potwierdź daty”)';
  end if;

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
      null;
    elsif auth.uid() is not null then
      raise exception 'Anulować transport może wyłącznie HHL — przez cancel_load() z powodem albo import harmonogramu';
    end if;
  end if;

  if new.status = 'UNLOADED' and new.actual_delivery_at is null then
    raise exception 'Status UNLOADED wymaga daty rozładunku — to data realizacji usługi';
  end if;

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

  if auth.uid() is null then return new; end if;

  v_ctx := coalesce(current_setting('tower.cancel_ctx', true), '');
  if (
    (new.status is distinct from old.status or new.actual_delivery_at is distinct from old.actual_delivery_at)
    and current_setting('tower.status_ctx', true) is distinct from 'on'
    and v_ctx not in ('MANUAL', 'IMPORT')
  ) then
    raise exception 'Status i datę rozładunku zmienia wyłącznie load_status_set albo automat'
      using errcode = '42501';
  end if;

  /* D-1501 / F7 B3+N2: nie-HHL_ADMIN — żadnej zmiany sailing_id po FERRY
     albo gdy dotychczasowy rejs już wypłynął (wyjątek: ODWOLANY — FERRY_CANCELLED). */
  if new.sailing_id is distinct from old.sailing_id then
    if current_app_role() is distinct from 'HHL_ADMIN' then
      if old.status >= 'FERRY' then
        raise exception 'Zmiana rejsu po wypłynięciu — wyłącznie HHL Administrator';
      end if;
      if old.sailing_id is not null then
        select s.status::text, coalesce(s.delayed_departure_at, s.departure_at)
          into v_sail_st, v_dep
          from public.sailings s where s.id = old.sailing_id;
        if v_sail_st is distinct from 'ODWOLANY'
           and v_dep is not null and v_dep <= now() then
          raise exception 'Zmiana rejsu po wypłynięciu — wyłącznie HHL Administrator';
        end if;
      end if;
    end if;
    if new.sailing_id is not null then
      select s.status::text, coalesce(s.delayed_departure_at, s.departure_at)
        into v_sail_st, v_dep
        from public.sailings s where s.id = new.sailing_id;
      if not found or v_dep is null then
        raise exception 'Nie znaleziono rejsu';
      end if;
      if v_sail_st = 'ODWOLANY' then
        raise exception 'Rejs odwołany — nie można przypisać';
      end if;
      if current_app_role() is distinct from 'HHL_ADMIN' and v_dep <= now() then
        raise exception 'Przewoźnik i Operacje HHL przypisują tylko rejs, który jeszcze nie wypłynął';
      end if;
    end if;
  end if;

  select coalesce(array_agg(n.key), '{}') into v_changed
    from jsonb_each(to_jsonb(new)) n
   where n.value is distinct from (to_jsonb(old) -> n.key);

  if is_hhl() is true then
    if new.carrier_order_no is distinct from old.carrier_order_no
       and current_app_role() is distinct from 'HHL_ADMIN' then
      raise exception 'Numer zlecenia przewoźnika wpisuje wyłącznie przewoźnik';
    end if;
    if (
      (new.plan_load_date, new.plan_load_from, new.plan_load_to,
       new.plan_delivery_date, new.plan_delivery_from, new.plan_delivery_to)
      is not distinct from
      (old.plan_load_date, old.plan_load_from, old.plan_load_to,
       old.plan_delivery_date, old.plan_delivery_from, old.plan_delivery_to)
      or current_setting('tower.import_ctx', true) = 'on'
      or current_app_role() = 'HHL_ADMIN'
    ) is not true then
      raise exception 'Daty i godziny załadunku i rozładunku zmienia wyłącznie KSH Użytkownik (G-20)'
        using errcode = '42501';
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
        if current_setting('tower.invoice_edit', true) = 'on'
           and old.status = 'INVOICED'
           and new.status = 'READY_TO_INVOICE' then
          null;
        else
          raise exception 'Status nie może się cofnąć: % → %', old.status, new.status;
        end if;
      end if;
    end if;
    return new;
  end if;

  raise exception 'Brak uprawnień do zmiany transportu';
end $$;

comment on function public.guard_load_update() is
  'D-1501/0242: rejs historyczny tylko HHL_ADMIN; F7 B3 blokada po FERRY; D-1525 biała lista SCX.';

-- F7 D2+N3: decision_open_from_event respektuje tower.bulk_quiet (bez DECISION_OPEN).
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
  if v_hours is not null then
    v_due := now() + (v_hours::text || ' hours')::interval;
  end if;
  v_detail := coalesce(p_detail, '{}'::jsonb) || jsonb_build_object('event_key', p_event_key, 'opened_by', 'L-1');
  begin
    insert into decisions (project_id, type_code, title, detail, load_id, risk_id, due_at)
    values (p_project, p_type, p_title, v_detail, p_load, p_risk, v_due)
    returning id into v_id;
  exception when unique_violation then
    select id into v_id from decisions where detail->>'event_key' = p_event_key limit 1;
    return v_id;
  end;
  insert into decision_events (decision_id, actor_id, action, payload)
  values (v_id, null, 'OPEN', jsonb_build_object('type', p_type, 'event_key', p_event_key));
  /* F7 N3: przy bulk_quiet bez dzwonka IN_APP (e-mail wycisza l13_decision_email).
     Join po roli jak po 0201 (nie org_kind z 0149). */
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
         or (o.kind = 'CARRIER' and v_role = 'CARRIER' and (
              p_load is null
              or exists (select 1 from loads l where l.id = p_load and l.carrier_org_id = o.id)))
         or (o.kind = 'CLIENT' and (
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
  'L-1: otwiera decyzję. F7 N3/0242: bulk_quiet = bez DECISION_OPEN IN_APP.';
revoke all on function public.decision_open_from_event(uuid, text, text, text, jsonb, uuid, uuid) from public, anon, authenticated;

-- F7 N3: wspólny mechanizm pierwszego skanu (migracja + test i2).
-- escalated_at tylko gdy due_at <= now(); bez DELETE na notifications.
create or replace function public.l3_scan_first_deploy_quiet(p_now timestamptz default now())
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prev text;
  v_n int;
  /* now() = created_at w tej transakcji; clock_timestamp() psuje filtr (F7 N3). */
  v_t0 timestamptz := now();
begin
  v_prev := current_setting('tower.bulk_quiet', true);
  perform set_config('tower.bulk_quiet', 'on', true);
  v_n := public.l3_scan(coalesce(p_now, now()));
  perform set_config('tower.bulk_quiet', coalesce(v_prev, ''), true);

  update public.decisions d
     set escalated_at = coalesce(d.escalated_at, now()),
         updated_at = now()
   where d.type_code in ('NO_SAILING', 'NO_TRACKING', 'NO_AWIZ_SE')
     and d.status in ('NEW', 'ASSIGNED', 'SNOOZED')
     and d.created_at >= v_t0
     and d.due_at is not null
     and d.due_at <= now();

  /* Pas bezpieczeństwa: gdyby dzwonek powstał inną ścieżką — przeczytany, bez DELETE. */
  update public.notifications n
     set read_at = coalesce(n.read_at, now()),
         payload = coalesce(n.payload, '{}'::jsonb)
                   || jsonb_build_object('quiet_first_scan', true, 'reason', '0242 first l3_scan')
   where n.template = 'DECISION_OPEN'
     and n.created_at >= v_t0
     and (
       exists (
         select 1 from public.decisions d
          where d.id = nullif(n.payload->>'decision_id', '')::uuid
            and d.type_code in ('NO_SAILING', 'NO_TRACKING', 'NO_AWIZ_SE')
            and d.created_at >= v_t0
       )
       or n.load_id in (
         select d.load_id from public.decisions d
          where d.type_code in ('NO_SAILING', 'NO_TRACKING', 'NO_AWIZ_SE')
            and d.status in ('NEW', 'ASSIGNED', 'SNOOZED')
            and d.created_at >= v_t0
       )
     );

  update public.workflow_runs wr
     set status = 'SKIPPED',
         finished_at = now(),
         result = jsonb_build_object('reason', '0242 first l3_scan quiet (F7 N3)')
   where wr.status = 'QUEUED'
     and wr.ran_at >= v_t0
     and exists (
       select 1 from public.risk_signals rs
        where rs.detected_at >= v_t0
          and rs.dedup_key like 'l3:NO_%'
          and wr.dedup_key = 'wf:' || wr.workflow_id::text || ':risk:' || rs.id::text
     );

  return v_n;
end $$;
revoke all on function public.l3_scan_first_deploy_quiet(timestamptz) from public, anon, authenticated;
comment on function public.l3_scan_first_deploy_quiet(timestamptz) is
  'D-1501/0242 F7 N3: l3_scan z bulk_quiet; escalated_at tylko po terminie; bez DELETE.';

do $d1501scan$
declare
  v_n int;
begin
  v_n := public.l3_scan_first_deploy_quiet(now());
  raise notice '0242 D-1501: l3_scan_first_deploy_quiet=%', v_n;
end
$d1501scan$;
