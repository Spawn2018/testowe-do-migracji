-- #653: po imporcie KSH — tylko KSH_IMPORT_SUMMARY w dzwonku (bez PLAN_DATES_CHANGED /
-- SCHEDULE_DATE_CRITICAL / RISK_OPEN / DECISION_OPEN per transport). Sprawy i decyzje zostają;
-- workflow (wf_enqueue) działa (bez bulk_quiet we wrapperze — F7 #656).
-- Scalenie po #655 (0341). Numer 0342.
begin;

-- ---------------------------------------------------------------------------
-- 1. Trigger: wycisz wymienione szablony gdy tower.import_bell_quiet=on
-- ---------------------------------------------------------------------------
create or replace function public.trg_notifications_import_bell_quiet()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('tower.import_bell_quiet', true) = 'on'
     and new.template in (
       'PLAN_DATES_CHANGED',
       'SCHEDULE_DATE_CRITICAL',
       'RISK_OPEN',
       'RISK_SEVERITY',
       'DECISION_OPEN'
     ) then
    return null;
  end if;
  return new;
end;
$$;

revoke all on function public.trg_notifications_import_bell_quiet() from public, anon, authenticated;

drop trigger if exists trg_notifications_import_bell_quiet on public.notifications;
create trigger trg_notifications_import_bell_quiet
  before insert on public.notifications
  for each row execute function public.trg_notifications_import_bell_quiet();

comment on function public.trg_notifications_import_bell_quiet() is
  '#653/#594: przy imporcie KSH bez pojedynczych dzwonków dat/spraw/decyzji — zostaje KSH_IMPORT_SUMMARY.';

-- ---------------------------------------------------------------------------
-- 2. trg_plan_dates_notify: przy import_bell_quiet — zdarzenie + l3, bez IN_APP
-- ---------------------------------------------------------------------------
create or replace function public.trg_plan_dates_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := current_app_user_id();
  v_by text;
  v_payload jsonb;
  v_client uuid;
  v_stamp text := to_char(clock_timestamp(), 'YYYYMMDDHH24MISSUS');
  v_code text := public.load_sms_code(new.id);
  v_bell_quiet boolean := (current_setting('tower.import_bell_quiet', true) = 'on');
begin
  -- Zwykły bulk_quiet (nie import) — pełna cisza jak dotąd.
  if current_setting('tower.bulk_quiet', true) = 'on' and v_bell_quiet is not true then
    return null;
  end if;
  if (new.plan_load_date, new.plan_load_from, new.plan_load_to, new.plan_delivery_date, new.plan_delivery_from, new.plan_delivery_to)
     is not distinct from (old.plan_load_date, old.plan_load_from, old.plan_load_to, old.plan_delivery_date, old.plan_delivery_from, old.plan_delivery_to) then
    return null;
  end if;
  v_by := case
    when current_setting('tower.dates_ctx', true) = 'on'
      and current_app_role() = 'HHL_ADMIN' then 'HHL_ADMIN'
    when current_setting('tower.dates_ctx', true) = 'on' then 'KSH'
    when auth.uid() is null then 'SYSTEM'
    else 'HHL'
  end;
  select client_org_id into v_client from projects where id = new.project_id;
  insert into load_events (load_id, event_type, occurred_at, actor_id, payload)
  values (new.id, 'PLAN_DATES_CHANGED', now(), v_actor, jsonb_build_object(
    'code', v_code, 'by', v_by, 'status', new.plan_dates_status,
    'load_date', new.plan_load_date, 'delivery_date', new.plan_delivery_date,
    'before_load_date', old.plan_load_date, 'before_delivery_date', old.plan_delivery_date,
    'before_load_from', old.plan_load_from, 'before_load_to', old.plan_load_to,
    'before_delivery_from', old.plan_delivery_from, 'before_delivery_to', old.plan_delivery_to,
    'load_from', new.plan_load_from, 'load_to', new.plan_load_to,
    'delivery_from', new.plan_delivery_from, 'delivery_to', new.plan_delivery_to)
    || case when v_by in ('KSH', 'HHL_ADMIN') and nullif(current_setting('tower.dates_actor', true), '') is not null
            then jsonb_build_object('actor', current_setting('tower.dates_actor', true)) else '{}'::jsonb end);
  v_payload := jsonb_build_object(
    'code', v_code, 'by', v_by, 'status', new.plan_dates_status,
    'load_date', new.plan_load_date, 'delivery_date', new.plan_delivery_date,
    'before_load_date', old.plan_load_date, 'before_delivery_date', old.plan_delivery_date,
    'before_load_from', old.plan_load_from, 'before_load_to', old.plan_load_to,
    'before_delivery_from', old.plan_delivery_from, 'before_delivery_to', old.plan_delivery_to);
  -- #653: przy imporcie bez IN_APP (zbiorcze KSH_IMPORT_SUMMARY).
  if v_bell_quiet is not true and v_by not in ('KSH', 'HHL_ADMIN') then
    insert into notifications (channel, recipient, user_id, load_id, template, payload, dedup_key)
    select 'IN_APP', coalesce(u.email::text, u.id::text), u.id, new.id, 'PLAN_DATES_CHANGED',
           v_payload || jsonb_build_object('locale', u.locale),
           'PLAN_DATES:' || new.id || ':' || v_stamp || ':' || u.id
      from app_users u join organizations o on o.id = u.org_id
     where u.active and u.id is distinct from v_actor
       and (o.kind = 'FORWARDER'
            or (new.carrier_org_id is not null and u.org_id = new.carrier_org_id)
            or (v_client is not null and u.org_id = v_client))
    on conflict (dedup_key) where dedup_key is not null do nothing;
  end if;
  if current_setting('tower.counter_accept', true) is distinct from 'on'
     and ((new.plan_load_date, new.plan_load_from) is distinct from (old.plan_load_date, old.plan_load_from)
          or old.plan_load_date is null) then
    perform l3_ksh_lead(new, old.plan_load_date, old.plan_load_from, now());
  end if;
  return null;
end $$;
revoke all on function public.trg_plan_dates_notify() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Wrapper import_schedule: tylko import_bell_quiet (bez bulk_quiet — F7 #656)
-- ---------------------------------------------------------------------------
alter function public.import_schedule(uuid, jsonb, text[], jsonb, boolean, boolean)
  rename to import_schedule_impl;

create or replace function public.import_schedule(
  p_project uuid,
  p_rows jsonb,
  p_cancel_codes text[] default '{}'::text[],
  p_file jsonb default '{}'::jsonb,
  p_dry_run boolean default true,
  p_quiet boolean default false
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prev_bell text;
  v_result jsonb;
begin
  v_prev_bell := current_setting('tower.import_bell_quiet', true);
  -- #653/#594 F7: przy p_quiet=false — dzwonek tylko zbiorczy; sprawy/decyzje/wf zostają
  -- (bez bulk_quiet — 0325 ustawia go tylko dla wierszy historycznych/dostarczonych).
  -- Przy p_quiet=true — bez bell_quiet (pełna cisza jak #426, w tym bulk z impl).
  if p_quiet is not true then
    perform set_config('tower.import_bell_quiet', 'on', true);
  end if;
  begin
    v_result := public.import_schedule_impl(
      p_project, p_rows, p_cancel_codes, p_file, p_dry_run, p_quiet);
  exception when others then
    perform set_config('tower.import_bell_quiet', coalesce(v_prev_bell, ''), true);
    raise;
  end;
  perform set_config('tower.import_bell_quiet', coalesce(v_prev_bell, ''), true);
  return v_result;
end;
$$;

revoke all on function public.import_schedule(uuid, jsonb, text[], jsonb, boolean, boolean)
  from public, anon;
grant execute on function public.import_schedule(uuid, jsonb, text[], jsonb, boolean, boolean)
  to authenticated;
do $g$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.import_schedule(uuid, jsonb, text[], jsonb, boolean, boolean)
      to service_role;
    grant execute on function public.import_schedule_impl(uuid, jsonb, text[], jsonb, boolean, boolean)
      to service_role;
  end if;
end $g$;
revoke all on function public.import_schedule_impl(uuid, jsonb, text[], jsonb, boolean, boolean)
  from public, anon, authenticated;

comment on function public.import_schedule(uuid, jsonb, text[], jsonb, boolean, boolean) is
  '#653: wrapper — import_bell_quiet (bez bulk_quiet); p_quiet steruje SUMMARY/#426.';
comment on function public.import_schedule_impl(uuid, jsonb, text[], jsonb, boolean, boolean) is
  'Implementacja import_schedule (0325); wołana wyłącznie przez wrapper #653.';

-- ---------------------------------------------------------------------------
-- 3b. l13_decision_email: wycisz też przy import_bell_quiet (zamiast bulk_quiet)
-- ---------------------------------------------------------------------------
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
  -- F7 #656: import_bell_quiet wycisza e-mail (bulk_quiet zostaje dla hist/quiet #426).
  if current_setting('tower.bulk_quiet', true) = 'on'
     or current_setting('tower.import_bell_quiet', true) = 'on' then
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
         (o.kind = 'FORWARDER' and (v_role is distinct from 'ADMIN' or u.role = 'HHL_ADMIN'))
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
  'C3-p + #581 + #653: e-mail decyzji; ADMIN → HHL_ADMIN; cisza przy bulk_quiet/import_bell_quiet.';

-- ---------------------------------------------------------------------------
-- 4. KSH_IMPORT_SUMMARY: „w tym: N spraw, M decyzji” wg widoczności odbiorcy
-- ---------------------------------------------------------------------------
create or replace function public.ksh_import_summary_publish(
  p_project uuid,
  p_import_id uuid,
  p_version int,
  p_file_name text,
  p_file_hash text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_changes jsonb;
  v_id uuid;
  v_at timestamptz := now();
  v_stats jsonb;
  v_title text;
  v_short text;
  v_payload jsonb;
  v_filtered jsonb;
  v_fstats jsonb;
  u record;
  c jsonb;
  v_ok boolean;
  v_risks int := 0;
  v_decs int := 0;
  v_risks_hhl int := 0;
  v_decs_hhl int := 0;
  v_load_ids uuid[];
begin
  perform public.assert_not_preview();
  if p_project is null or p_import_id is null or p_version is null then
    return null;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_project::text, 594));

  v_changes := public.ksh_import_summary_build_changes(p_project, p_version, v_at);
  if jsonb_array_length(v_changes) = 0 then
    return null;
  end if;

  v_stats := public.ksh_import_summary_stats_of(v_changes);

  if exists (
    select 1 from public.ksh_import_summaries where import_id = p_import_id
  ) then
    return null;
  end if;

  select coalesce(array_agg(distinct (ch->>'load_id')::uuid)
                    filter (where nullif(ch->>'load_id', '') is not null), '{}'::uuid[])
    into v_load_ids
    from jsonb_array_elements(v_changes) ch;

  -- Sprawy / decyzje otwarte w tej samej transakcji importu (okno >= v_at).
  select count(*)::int into v_risks_hhl
    from public.risk_signals rs
   where rs.project_id = p_project
     and rs.resolved_at is null
     and rs.load_id = any (v_load_ids)
     and rs.detected_at >= v_at;

  select count(*)::int into v_decs_hhl
    from public.decisions d
   where d.project_id = p_project
     and d.status in ('NEW', 'ASSIGNED', 'SNOOZED')
     and d.load_id = any (v_load_ids)
     and d.created_at >= v_at;

  insert into public.ksh_import_summaries (
    project_id, import_id, imported_at, file_name, file_hash, changes, stats
  ) values (
    p_project, p_import_id, v_at, p_file_name, p_file_hash, v_changes,
    v_stats || jsonb_build_object('risks', v_risks_hhl, 'decisions', v_decs_hhl)
  ) returning id into v_id;

  delete from public.ksh_import_summaries s
   where s.project_id = p_project
     and s.id in (
       select z.id from (
         select x.id
           from public.ksh_import_summaries x
          where x.project_id = p_project
          order by x.imported_at desc, x.id desc
          offset 30
       ) z
     );

  v_title := 'Zmiany z pliku KSH — '
    || to_char(v_at at time zone 'Europe/Warsaw', 'DD.MM.YYYY HH24:MI');

  for u in
    select au.id, coalesce(au.email::text, au.id::text) as recipient,
           o.kind::text as org_kind, o.id as org_id
      from public.app_users au
      join public.organizations o on o.id = au.org_id
     where au.active
       and (
         o.kind = 'FORWARDER'
         or (o.kind = 'CLIENT' and exists (
               select 1 from public.projects pr
                where pr.id = p_project and pr.client_org_id = o.id))
         or (o.kind = 'CARRIER' and exists (
               select 1
                 from jsonb_array_elements(v_changes) ch
                 join public.loads l on l.id = (ch->>'load_id')::uuid
                where l.carrier_org_id = o.id))
       )
     order by au.id
  loop
    v_filtered := '[]'::jsonb;
    for c in select * from jsonb_array_elements(v_changes)
    loop
      if u.org_kind = 'CARRIER' then
        if not exists (
          select 1 from public.loads l
           where l.id = (c->>'load_id')::uuid and l.carrier_org_id = u.org_id
        ) then
          continue;
        end if;
      end if;
      v_ok := public.ksh_import_summary_field_visible(c->>'field', u.org_kind);
      if v_ok is true then
        v_filtered := v_filtered || c;
      end if;
    end loop;
    if jsonb_array_length(v_filtered) = 0 and u.org_kind = 'CARRIER' then
      continue;
    end if;
    v_fstats := public.ksh_import_summary_stats_of(v_filtered);

    -- Liczby spraw/decyzji wg widoczności odbiorcy (F7 #656: SCX/KSH bez spraw tylko-HHL).
    if u.org_kind = 'FORWARDER' then
      v_risks := v_risks_hhl;
      v_decs := v_decs_hhl;
    elsif u.org_kind = 'CARRIER' then
      select count(*)::int into v_risks
        from public.risk_signals rs
        join public.loads l on l.id = rs.load_id
       where rs.project_id = p_project
         and rs.resolved_at is null
         and rs.load_id = any (v_load_ids)
         and rs.detected_at >= v_at
         and l.carrier_org_id = u.org_id
         and rs.audience in ('WSZYSCY', 'HHL_PRZEWOZNIK');
      select count(*)::int into v_decs
        from public.decisions d
        join public.decision_types dt on dt.code = d.type_code
        join public.loads l on l.id = d.load_id
       where d.project_id = p_project
         and d.status in ('NEW', 'ASSIGNED', 'SNOOZED')
         and d.load_id = any (v_load_ids)
         and d.created_at >= v_at
         and l.carrier_org_id = u.org_id
         and d.type_code not in ('KSH_CARRIER_CHANGED', 'KSH_REMOVED_BACK', 'ETA_CALIBRATION_APPROVAL')
         and dt.decider_role is distinct from 'ADMIN';
    else
      -- CLIENT (KSH)
      select count(*)::int into v_risks
        from public.risk_signals rs
       where rs.project_id = p_project
         and rs.resolved_at is null
         and rs.load_id = any (v_load_ids)
         and rs.detected_at >= v_at
         and rs.audience in ('WSZYSCY', 'HHL_KLIENT');
      select count(*)::int into v_decs
        from public.decisions d
        join public.decision_types dt on dt.code = d.type_code
       where d.project_id = p_project
         and d.status in ('NEW', 'ASSIGNED', 'SNOOZED')
         and d.load_id = any (v_load_ids)
         and d.created_at >= v_at
         and d.type_code not in ('KSH_CARRIER_CHANGED', 'KSH_REMOVED_BACK', 'ETA_CALIBRATION_APPROVAL')
         and dt.decider_role is distinct from 'ADMIN';
    end if;

    v_short := format(
      'Transporty: %s · pola: %s · nowe: %s · anulowane/usunięte: %s',
      v_fstats->>'transports', v_fstats->>'fields',
      v_fstats->>'added', v_fstats->>'cancelled'
    );
    if v_risks > 0 or v_decs > 0 then
      v_short := v_short || format(' · w tym: %s spraw, %s decyzji', v_risks, v_decs);
    end if;
    v_payload := jsonb_build_object(
      'title', v_title,
      'summary', v_short,
      'summary_id', v_id,
      'project_id', p_project,
      'imported_at', v_at,
      'file_name', p_file_name,
      'transports', (v_fstats->>'transports')::int,
      'fields', (v_fstats->>'fields')::int,
      'added', (v_fstats->>'added')::int,
      'cancelled', (v_fstats->>'cancelled')::int,
      'risks', v_risks,
      'decisions', v_decs,
      'matrix_event', 'ksh_import'
    );

    delete from public.notifications
     where dedup_key = 'KSH_IMPORT_SUMMARY:' || u.id::text;
    insert into public.notifications (
      channel, recipient, user_id, load_id, template, payload, dedup_key, read_at, status
    ) values (
      'IN_APP', u.recipient, u.id, null, 'KSH_IMPORT_SUMMARY', v_payload,
      'KSH_IMPORT_SUMMARY:' || u.id::text, null, 'PENDING'
    );
  end loop;

  return v_id;
end;
$$;

revoke all on function public.ksh_import_summary_publish(uuid, uuid, int, text, text)
  from public, anon, authenticated;

comment on function public.ksh_import_summary_publish(uuid, uuid, int, text, text) is
  '#594+#653: migawka + jedno IN_APP; liczby spraw/decyzji wg widoczności odbiorcy.';

-- ---------------------------------------------------------------------------
-- 5. Jednorazowo: oznacz zalanie z 00:56:06Z jako przeczytane (bez zamykania spraw)
-- ---------------------------------------------------------------------------
update public.notifications n
   set read_at = coalesce(n.read_at, timestamptz '2026-10-30 01:15:00+00')
 where n.template in (
         'PLAN_DATES_CHANGED',
         'SCHEDULE_DATE_CRITICAL',
         'RISK_OPEN',
         'DECISION_OPEN'
       )
   and n.channel in ('IN_APP', 'WEB_PUSH')
   and n.created_at >= timestamptz '2026-10-30 00:56:00+00'
   and n.created_at <  timestamptz '2026-10-30 00:57:00+00'
   and n.read_at is null;

commit;
