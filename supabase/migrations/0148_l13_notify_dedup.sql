-- =====================================================================
-- TOWER — Migracja 0148: L-13 zalew powiadomień
--
-- SIM-1: 155 powiadomień na jeden transport. Klucze dedup statusu, ryzyka
-- i strefy miały znacznik zegara, więc to samo zdarzenie w innej minucie
-- wchodziło drugi raz.
--
-- To samo zdarzenie = ten sam klucz, bez zegara:
--   status: load-st:{transport}:{z}:{do}
--   ryzyko: risk:{szablon}:{id ryzyka}:{poziom}
--   strefa: zone:{wjazd|wyjazd}:{transport}:{id strefy}
-- Drugi zapis tego klucza nie dodaje wiersza (on conflict do nothing).
--
-- Plan L-13 nie wymienia odbiorców nowego kanału. Decyzje automatyczne
-- zostają tylko IN_APP (0138). E-mail z macierzy, który już był włączony,
-- dla zdarzeń niekrytycznych dostaje status DIGEST (worker bierze tylko
-- PENDING) — skrót raz na firmę na dobę, bez wysyłki do czasu OK.
-- Krytyczne (czerwona decyzja, odwołany prom): PENDING, dopóki licznik
-- doby < 100. Przy 80 ostrzeżenie w Stanie systemu. Przy 95 niekrytyczne
-- nie wchodzą nawet do skrótu. Limit Resend: 100 na wszystko.
-- =====================================================================

create or replace function public.l13_email_is_critical(p_template text, p_payload jsonb)
returns boolean
language sql
immutable
as $$
  select coalesce(p_template, '') in ('DECISION_ESCALATED', 'FERRY_CANCELLED')
      or coalesce(p_payload->>'type', '') = 'FERRY_CANCELLED'
      or coalesce(p_payload->>'level', '') = 'critical'
      or coalesce(p_payload->>'severity', '') = 'CRITICAL'
      or coalesce(p_payload->>'event', '') = 'critical';
$$;
comment on function public.l13_email_is_critical(text, jsonb) is
  'L-13: krytyczne = czerwona decyzja albo odwołany prom. Reszta idzie w skrót.';
revoke all on function public.l13_email_is_critical(text, jsonb) from public, anon, authenticated;

create or replace function public.l13_email_counts(p_now timestamptz default now())
returns table(day date, immediate_n int, digest_n int, suppressed_n int, level text)
language sql
stable
security definer
set search_path = public
as $$
  with b as (
    select (p_now at time zone 'Europe/Warsaw')::date as day
  ),
  c as (
    select
      count(*) filter (where n.status in ('PENDING', 'SENT'))::int as immediate_n,
      count(*) filter (where n.status = 'DIGEST')::int as digest_n,
      count(*) filter (where n.status = 'SUPPRESSED')::int as suppressed_n
    from notifications n
    cross join b
    where n.channel = 'EMAIL'
      and (n.created_at at time zone 'Europe/Warsaw')::date = b.day
  )
  select b.day,
         coalesce(c.immediate_n, 0),
         coalesce(c.digest_n, 0),
         coalesce(c.suppressed_n, 0),
         case
           when coalesce(c.immediate_n, 0) >= 95 then 'critical_only'
           when coalesce(c.immediate_n, 0) >= 80 then 'warn'
           else 'ok'
         end
    from b
    cross join c;
$$;
revoke all on function public.l13_email_counts(timestamptz) from public, anon, authenticated;

create or replace function public.l13_email_slot(p_critical boolean, p_now timestamptz default now())
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  n int;
begin
  select immediate_n into n from l13_email_counts(p_now);
  n := coalesce(n, 0);
  if n >= 100 then
    return 'skip';
  end if;
  if p_critical then
    return 'immediate';
  end if;
  if n >= 95 then
    return 'skip';
  end if;
  -- Szacunek floty po odsieaniu przekracza 60 na dobę, więc niekrytyczne
  -- nie idą jako osobny e-mail. DIGEST nie jest PENDING: worker go nie wyśle.
  return 'digest';
end $$;
revoke all on function public.l13_email_slot(boolean, timestamptz) from public, anon, authenticated;

create table if not exists public.email_budget_day (
  day date primary key,
  warned_at timestamptz not null
);
revoke all on public.email_budget_day from public, anon, authenticated;

create or replace function public.l13_email_guard_note(p_now timestamptz default now())
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day date;
  v_level text;
  v_n int;
begin
  select day, level, immediate_n into v_day, v_level, v_n from l13_email_counts(p_now);
  if v_level = 'ok' then
    return 'ok';
  end if;
  if exists (select 1 from email_budget_day where day = v_day) then
    return v_level;
  end if;
  insert into email_budget_day (day, warned_at) values (v_day, p_now);
  insert into integration_runs (job, ran_at, ok, result)
  values (
    'email-budget',
    p_now,
    false,
    jsonb_build_object(
      'level', v_level,
      'immediate', v_n,
      'warn_at', 80,
      'critical_only_at', 95,
      'resend_limit', 100,
      'note', 'L-13: poczta zbliża się do limitu Resend. Decyzje automatyczne bez e-maila.'
    )
  );
  return v_level;
end $$;
revoke all on function public.l13_email_guard_note(timestamptz) from public, anon, authenticated;


create or replace function public.matrix_notify(
  p_event_group text,
  p_template text,
  p_load_id uuid,
  p_project_id uuid,
  p_payload jsonb,
  p_dedup_prefix text,
  p_only_org_kind text default null
) returns int
language plpgsql security definer set search_path = public as $$
declare
  n int := 0;
  v_payload jsonb;
  v_slot text;
begin
  if (p_event_group in ('LOAD_STATUS','RISK_FERRY_WEATHER','DECISION','MONEY','SYSTEM')) is not true then
    return 0;
  end if;
  if (p_template is not null and length(trim(p_template)) > 0) is not true then
    return 0;
  end if;
  if p_only_org_kind is not null
     and (p_only_org_kind in ('FORWARDER','CARRIER','CLIENT')) is not true then
    return 0;
  end if;

  v_payload := coalesce(p_payload, '{}'::jsonb)
    || jsonb_build_object('event_group', p_event_group, 'event_key', p_dedup_prefix);

  insert into notifications (channel, recipient, user_id, load_id, template, payload, dedup_key)
  select 'IN_APP', coalesce(u.email::text, u.id::text), u.id, p_load_id, p_template,
         v_payload || jsonb_build_object('locale', u.locale),
         left(p_dedup_prefix || ':IN:' || u.id::text, 200)
    from app_users u
    join organizations o on o.id = u.org_id
    join notification_matrix m
      on m.event_group = p_event_group and m.org_kind = o.kind::text and m.in_app
   where u.active
     and (p_only_org_kind is null or o.kind::text = p_only_org_kind)
     and (
       o.kind = 'FORWARDER'
       or (o.kind = 'CARRIER' and (
            p_load_id is null
            or exists (select 1 from loads l where l.id = p_load_id and l.carrier_org_id = o.id)))
       or (o.kind = 'CLIENT' and (
            p_project_id is null
            or exists (select 1 from projects p where p.id = p_project_id and p.client_org_id = o.id)
            or exists (select 1 from loads l join projects p on p.id = l.project_id
                        where l.id = p_load_id and p.client_org_id = o.id)))
     )
  on conflict (dedup_key) where dedup_key is not null do nothing;
  get diagnostics n = row_count;

  v_slot := public.l13_email_slot(public.l13_email_is_critical(p_template, v_payload), now());
  if v_slot <> 'skip' then
    insert into notifications (channel, recipient, user_id, load_id, template, payload, dedup_key, status)
    select 'EMAIL', coalesce(u.email::text, u.id::text), u.id, p_load_id, p_template,
           v_payload || jsonb_build_object('locale', u.locale, 'l13_slot', v_slot),
           left(p_dedup_prefix || ':EM:' || u.id::text, 200),
           case when v_slot = 'immediate' then 'PENDING' else 'DIGEST' end
      from app_users u
      join organizations o on o.id = u.org_id
      join notification_matrix m
        on m.event_group = p_event_group and m.org_kind = o.kind::text and m.email
     where u.active and u.email is not null
       and (p_only_org_kind is null or o.kind::text = p_only_org_kind)
       and (
         o.kind = 'FORWARDER'
         or (o.kind = 'CARRIER' and (
              p_load_id is null
              or exists (select 1 from loads l where l.id = p_load_id and l.carrier_org_id = o.id)))
         or (o.kind = 'CLIENT' and (
              p_project_id is null
              or exists (select 1 from projects p where p.id = p_project_id and p.client_org_id = o.id)
              or exists (select 1 from loads l join projects p on p.id = l.project_id
                          where l.id = p_load_id and p.client_org_id = o.id)))
       )
    on conflict (dedup_key) where dedup_key is not null do nothing;
  else
    insert into notifications (channel, recipient, user_id, load_id, template, payload, dedup_key, status)
    select 'EMAIL', coalesce(u.email::text, u.id::text), u.id, p_load_id, p_template,
           v_payload || jsonb_build_object('locale', u.locale, 'l13_slot', 'skip'),
           left(p_dedup_prefix || ':EM:' || u.id::text, 200),
           'SUPPRESSED'
      from app_users u
      join organizations o on o.id = u.org_id
      join notification_matrix m
        on m.event_group = p_event_group and m.org_kind = o.kind::text and m.email
     where u.active and u.email is not null
       and (p_only_org_kind is null or o.kind::text = p_only_org_kind)
       and (
         o.kind = 'FORWARDER'
         or (o.kind = 'CARRIER' and (
              p_load_id is null
              or exists (select 1 from loads l where l.id = p_load_id and l.carrier_org_id = o.id)))
         or (o.kind = 'CLIENT' and (
              p_project_id is null
              or exists (select 1 from projects p where p.id = p_project_id and p.client_org_id = o.id)
              or exists (select 1 from loads l join projects p on p.id = l.project_id
                          where l.id = p_load_id and p.client_org_id = o.id)))
       )
    on conflict (dedup_key) where dedup_key is not null do nothing;
  end if;
  perform public.l13_email_guard_note(now());

  return n;
end $$;
revoke all on function public.matrix_notify(text, text, uuid, uuid, jsonb, text, text)
  from public, anon, authenticated;

create or replace function public.trg_load_status_matrix_notify() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status is not distinct from old.status then
    return null;
  end if;
  perform public.matrix_notify(
    'LOAD_STATUS', 'LOAD_STATUS_CHANGED', new.id, new.project_id,
    jsonb_build_object(
      'load_id', new.id, 'from', old.status, 'to', new.status,
      'order_no', new.order_no, 'hhl_order_no', new.hhl_order_no
    ),
    'load-st:' || new.id::text || ':' || coalesce(old.status::text, '-') || '>' || new.status::text
  );
  return null;
end $$;
revoke all on function public.trg_load_status_matrix_notify() from public, anon, authenticated;

create or replace function public.trg_risk_matrix_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_group text;
  v_tpl text;
  v_proj uuid;
begin
  v_group := case
    when new.kind::text in ('FERRY', 'WEATHER', 'ETA_BREACH') then 'RISK_FERRY_WEATHER'
    when new.kind::text in ('INVOICE_MISMATCH') then 'MONEY'
    when new.kind::text in ('USAGE_LIMIT', 'JOB_FAILURE') then 'SYSTEM'
    else 'SYSTEM'
  end;
  if tg_op = 'INSERT' then
    v_tpl := 'RISK_OPEN';
  elsif new.severity is distinct from old.severity then
    v_tpl := 'RISK_SEVERITY';
  elsif new.resolved_at is not null and old.resolved_at is null then
    v_tpl := 'RISK_RESOLVED';
  else
    return null;
  end if;
  v_proj := new.project_id;
  if v_proj is null and new.load_id is not null then
    select project_id into v_proj from loads where id = new.load_id;
  end if;
  perform public.matrix_notify(
    v_group, v_tpl, new.load_id, v_proj,
    jsonb_build_object(
      'risk_id', new.id, 'kind', new.kind, 'severity', new.severity,
      'title', new.title, 'title_key', new.title_key
    ),
    'risk:' || v_tpl || ':' || new.id::text || ':' || new.severity::text
  );
  return null;
end $$;
revoke all on function public.trg_risk_matrix_notify() from public, anon, authenticated;

create or replace function public.trg_geofence_matrix_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_proj uuid;
  v_tpl text;
  v_fence text;
begin
  if new.event_type not in ('GEOFENCE_ENTER', 'GEOFENCE_EXIT') then
    return null;
  end if;
  v_tpl := case new.event_type when 'GEOFENCE_ENTER' then 'ZONE_ENTER' else 'ZONE_EXIT' end;
  v_fence := coalesce(
    nullif(new.payload->>'geofence_id', ''),
    nullif(new.payload->>'geofence_kind', '') || ':' || coalesce(new.payload->>'geofence_name', ''),
    'x'
  );
  select project_id into v_proj from loads where id = new.load_id;
  perform public.matrix_notify(
    'LOAD_STATUS', v_tpl, new.load_id, v_proj,
    jsonb_build_object(
      'load_id', new.load_id, 'event', new.event_type,
      'geofence_id', new.payload->>'geofence_id',
      'geofence_name', coalesce(new.payload->>'geofence_name', new.payload->>'name')
    ),
    'zone:' || new.event_type || ':' || new.load_id::text || ':' || v_fence
  );
  return null;
end $$;
revoke all on function public.trg_geofence_matrix_notify() from public, anon, authenticated;

-- Tożsamość zdarzenia: obcina stary znacznik zegara (12+ cyfr na końcu klucza).
create or replace function public.notification_event_identity(p_dedup text)
returns text
language sql
immutable
as $$
  select regexp_replace(
           regexp_replace(
             regexp_replace(coalesce(p_dedup, ''), ':[0-9]{12,}:IN:', ':IN:'),
             ':[0-9]{12,}:EM:', ':EM:'),
           ':[0-9]{12,}$', '');
$$;
comment on function public.notification_event_identity(text) is
  'L-13: to samo zdarzenie bez znacznika minuty albo mikrosekundy.';
revoke all on function public.notification_event_identity(text) from public, anon, authenticated;

create or replace function public.notification_flood_report(p_load uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with base as (
    select n.load_id,
           n.template,
           n.channel,
           n.recipient,
           coalesce(o.code, '?') as company,
           public.notification_event_identity(
             coalesce(nullif(n.payload->>'event_key', ''), n.dedup_key)
           ) as event_key
      from notifications n
      left join app_users u on u.id = n.user_id
      left join organizations o on o.id = u.org_id
     where p_load is null or n.load_id = p_load
  ),
  distinct_events as (
    select load_id, template, channel, recipient, company, event_key
      from base
     group by 1, 2, 3, 4, 5, 6
  ),
  breakdown as (
    select company, template, recipient, channel, count(*)::int as n
      from distinct_events
     group by 1, 2, 3, 4
  ),
  per_company as (
    select company, sum(n)::int as n
      from breakdown
     group by 1
  ),
  per_load_company as (
    select load_id, company, count(*)::int as n
      from distinct_events
     group by 1, 2
  )
  select jsonb_build_object(
    'load_id', p_load,
    'per_load_company', coalesce((
      select jsonb_agg(jsonb_build_object('load_id', load_id, 'company', company, 'n', n)
                       order by load_id, company)
        from per_load_company
    ), '[]'::jsonb),
    'per_company', coalesce((
      select jsonb_agg(jsonb_build_object('company', company, 'n', n) order by company)
        from per_company
    ), '[]'::jsonb),
    'breakdown', coalesce((
      select jsonb_agg(jsonb_build_object(
               'company', company, 'template', template,
               'recipient', recipient, 'channel', channel, 'n', n
             ) order by company, template, recipient, channel)
        from breakdown
    ), '[]'::jsonb),
    'total', coalesce((select sum(n)::int from per_company), 0)
  );
$$;
comment on function public.notification_flood_report(uuid) is
  'L-13: rozbicie powiadomień według typu, odbiorcy i firmy. Ten sam klucz zdarzenia liczy się raz.';
revoke all on function public.notification_flood_report(uuid) from public, anon, authenticated;

create or replace function public.l13_email_projection(p_companies jsonb, p_fleet int, p_moving int)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_one int := 0;
  v_crit int := 0;
  v_digest_firms int := 0;
  v_admin int := 1;
  r record;
  v_peak_one int;
  v_fleet_one int;
  v_peak_digest int;
  v_fleet_digest int;
begin
  for r in
    select value as row from jsonb_array_elements(coalesce(p_companies, '[]'::jsonb))
  loop
    v_one := v_one + coalesce((r.row->>'noncritical')::int, 0) + coalesce((r.row->>'critical')::int, 0);
    v_crit := v_crit + coalesce((r.row->>'critical')::int, 0);
    if coalesce((r.row->>'noncritical')::int, 0) > 0 then
      v_digest_firms := v_digest_firms + 1;
    end if;
  end loop;
  v_peak_one := v_one * p_moving + v_admin;
  v_fleet_one := v_one * p_fleet + v_admin;
  v_peak_digest := v_digest_firms + v_crit * p_moving + v_admin;
  v_fleet_digest := v_digest_firms + v_crit * p_fleet + v_admin;
  return jsonb_build_object(
    'assumption', '1 skrzynka na firmę (fixture). Przed OK pomnożyć przez liczbę aktywnych skrzynek. Skrót = 1 e-mail rano na firmę. Raport admina = 1. Krytyczne razy liczba transportów to górna półka, gdy każde ma nowe zdarzenie krytyczne tego dnia. Decyzje automatyczne bez e-maila.',
    'per_transport', v_one,
    'critical_per_transport', v_crit,
    'one_each_peak_10', v_peak_one,
    'one_each_fleet_94', v_fleet_one,
    'digest_peak_10', v_peak_digest,
    'digest_fleet_uncapped', v_fleet_digest,
    'digest_fleet_capped', least(v_fleet_digest, 100),
    'over_60', (v_peak_one > 60 or v_fleet_one > 60),
    'resend_limit', 100,
    'warn_at', 80,
    'critical_only_at', 95,
    'automatic_decision_email', false
  );
end $$;
comment on function public.l13_email_projection(jsonb, int, int) is
  'L-13: szacunek e-maili. Nie wysyła. automatic_decision_email = false.';
revoke all on function public.l13_email_projection(jsonb, int, int) from public, anon, authenticated;

create or replace function public.email_budget_status()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  if (is_hhl()) is not true then
    return null;
  end if;
  select * into r from l13_email_counts(now());
  return jsonb_build_object(
    'day', r.day,
    'immediate_n', r.immediate_n,
    'digest_n', r.digest_n,
    'suppressed_n', r.suppressed_n,
    'level', r.level,
    'resend_limit', 100,
    'warn_at', 80,
    'critical_only_at', 95,
    'automatic_decision_email', false
  );
end $$;
comment on function public.email_budget_status() is
  'L-13: licznik poczty dla Stanu systemu. Nie włącza e-maili decyzji.';
revoke all on function public.email_budget_status() from public, anon;
grant execute on function public.email_budget_status() to authenticated;

alter function public.l13_email_is_critical(text, jsonb) set search_path = public;
alter function public.notification_event_identity(text) set search_path = public;
