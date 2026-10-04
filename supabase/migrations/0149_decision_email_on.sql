-- =====================================================================
-- TOWER — Migracja 0149: e-mail decyzji automatycznych (OK właściciela 04.10.2026 17:06)
--
-- automatic_decision_email = true.
-- Krytyczne: jedno zdarzenie (bundle_key) = jeden e-mail na odbiorcę,
-- lista transportów w payload.transports.
-- Niekrytyczne: jeden skrót na odbiorcę na dobę (DIGEST).
-- Limit operacyjny 90 (100 Resend minus 10 na zaproszenia i reset hasła).
-- Od 80 ostrzeżenie. Od 85 tylko krytyczne. Od 90 stoi też krytyczne.
-- Przy kolejce: najpierw krytyczne (PENDING), skrót rusza dopiero gdy
-- nie ma krytycznego w kolejce i jest miejsce poniżej 85.
-- Po wyczerpaniu limitu wpis IN_APP zostaje. SUPPRESSED widać w Stanie systemu.
-- =====================================================================

alter table security_flags drop constraint if exists security_flags_key_check;
alter table security_flags add constraint security_flags_key_check
  check (key in (
    'MFA_HHL_ADMIN', 'EXTERNAL_MESSAGING', 'PERMIT_REQUIRED_NON_STANDARD', 'FUEL_WOB_INGEST',
    'SMS_ZONE_APPROACH', 'SMS_ZONE_ENTER', 'DRIVER_LINK_ACCEPT', 'AUTOMATIC_DECISION_EMAIL'
  ));

insert into security_flags (key, enabled, note)
values (
  'AUTOMATIC_DECISION_EMAIL', true,
  '04.10.2026 17:06: e-mail decyzji automatycznych włączony. Niekrytyczne w skrócie. 10 na dobę zostaje na zaproszenia i reset hasła.'
)
on conflict (key) do update
  set enabled = true,
      note = excluded.note,
      updated_at = now();

create or replace function public.l13_automatic_decision_email()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select enabled from security_flags where key = 'AUTOMATIC_DECISION_EMAIL'), false);
$$;
revoke all on function public.l13_automatic_decision_email() from public, anon, authenticated;

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
      count(*) filter (
        where n.status in ('PENDING', 'SENT')
          and n.template not in ('AUTH_INVITE', 'AUTH_PASSWORD_RESET')
      )::int as immediate_n,
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
           when coalesce(c.immediate_n, 0) >= 85 then 'critical_only'
           when coalesce(c.immediate_n, 0) >= 80 then 'warn'
           else 'ok'
         end
    from b
    cross join c;
$$;
revoke all on function public.l13_email_counts(timestamptz) from public, anon, authenticated;

create or replace function public.l13_email_slot_kind(p_kind text, p_now timestamptz default now())
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  op int;
  auth int;
begin
  select count(*) filter (
           where status in ('PENDING', 'SENT')
             and template not in ('AUTH_INVITE', 'AUTH_PASSWORD_RESET')
         )::int,
         count(*) filter (
           where status in ('PENDING', 'SENT')
             and template in ('AUTH_INVITE', 'AUTH_PASSWORD_RESET')
         )::int
    into op, auth
    from notifications
   where channel = 'EMAIL'
     and (created_at at time zone 'Europe/Warsaw')::date = (p_now at time zone 'Europe/Warsaw')::date;
  op := coalesce(op, 0);
  auth := coalesce(auth, 0);
  if p_kind = 'auth' then
    if auth >= 10 or op + auth >= 100 then
      return 'skip';
    end if;
    return 'immediate';
  end if;
  if op >= 90 then
    return 'skip';
  end if;
  if p_kind = 'critical' then
    return 'immediate';
  end if;
  if op >= 85 then
    return 'skip';
  end if;
  return 'digest';
end $$;
revoke all on function public.l13_email_slot_kind(text, timestamptz) from public, anon, authenticated;

create or replace function public.l13_email_slot(p_critical boolean, p_now timestamptz default now())
returns text
language sql
stable
security definer
set search_path = public
as $$
  select public.l13_email_slot_kind(case when p_critical then 'critical' else 'digest' end, p_now);
$$;
revoke all on function public.l13_email_slot(boolean, timestamptz) from public, anon, authenticated;

create or replace function public.l13_queue_email(
  p_kind text,
  p_template text,
  p_user uuid,
  p_recipient text,
  p_load uuid,
  p_order text,
  p_payload jsonb,
  p_dedup text,
  p_bundle text
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slot text;
  v_status text;
  v_id bigint;
  v_payload jsonb;
  v_key text;
  v_day date;
  v_item jsonb;
begin
  if p_user is null or coalesce(p_recipient, '') = '' then
    return 'skip';
  end if;
  v_slot := public.l13_email_slot_kind(p_kind, now());
  v_status := case v_slot
    when 'immediate' then 'PENDING'
    when 'digest' then 'DIGEST'
    else 'SUPPRESSED'
  end;
  v_day := (now() at time zone 'Europe/Warsaw')::date;
  v_item := jsonb_build_object('load_id', p_load, 'order_no', p_order, 'template', p_template);

  if p_kind = 'critical' and coalesce(p_bundle, '') <> '' then
    v_key := left('bundle:' || p_bundle || ':EM:' || p_user::text, 200);
    select id, payload into v_id, v_payload from notifications where dedup_key = v_key;
    if v_id is not null then
      if not exists (
        select 1
          from jsonb_array_elements(coalesce(v_payload->'transports', '[]'::jsonb)) e
         where e->>'load_id' is not distinct from p_load::text
      ) then
        update notifications
           set payload = jsonb_set(
             payload,
             '{transports}',
             coalesce(payload->'transports', '[]'::jsonb) || jsonb_build_array(v_item),
             true
           )
         where id = v_id;
      end if;
      return (select status from notifications where id = v_id);
    end if;
    insert into notifications (channel, recipient, user_id, load_id, template, payload, dedup_key, status)
    values (
      'EMAIL', p_recipient, p_user, p_load, p_template,
      coalesce(p_payload, '{}'::jsonb) || jsonb_build_object(
        'l13_slot', v_slot, 'bundle_key', p_bundle, 'transports', jsonb_build_array(v_item)
      ),
      v_key, v_status
    )
    on conflict (dedup_key) where dedup_key is not null do nothing;
    return v_status;
  end if;

  if p_kind = 'digest' then
    v_key := left('digest:' || v_day::text || ':EM:' || p_user::text, 200);
    select id, payload into v_id, v_payload from notifications where dedup_key = v_key;
    if v_id is not null then
      if not exists (
        select 1
          from jsonb_array_elements(coalesce(v_payload->'events', '[]'::jsonb)) e
         where e->>'dedup' is not distinct from p_dedup
      ) then
        update notifications
           set payload = jsonb_set(
             payload,
             '{events}',
             coalesce(payload->'events', '[]'::jsonb) || jsonb_build_array(v_item || jsonb_build_object('dedup', p_dedup)),
             true
           )
         where id = v_id;
      end if;
      return (select status from notifications where id = v_id);
    end if;
    insert into notifications (channel, recipient, user_id, load_id, template, payload, dedup_key, status)
    values (
      'EMAIL', p_recipient, p_user, p_load, p_template,
      coalesce(p_payload, '{}'::jsonb) || jsonb_build_object(
        'l13_slot', v_slot,
        'events', jsonb_build_array(v_item || jsonb_build_object('dedup', p_dedup))
      ),
      v_key, v_status
    )
    on conflict (dedup_key) where dedup_key is not null do nothing;
    return v_status;
  end if;

  v_key := left(coalesce(p_dedup, 'auth:' || p_template || ':' || p_user::text), 200);
  insert into notifications (channel, recipient, user_id, load_id, template, payload, dedup_key, status)
  values (
    'EMAIL', p_recipient, p_user, p_load, p_template,
    coalesce(p_payload, '{}'::jsonb) || jsonb_build_object('l13_slot', v_slot),
    v_key, v_status
  )
  on conflict (dedup_key) where dedup_key is not null do nothing;
  return v_status;
end $$;
revoke all on function public.l13_queue_email(text, text, uuid, text, uuid, text, jsonb, text, text)
  from public, anon, authenticated;

create or replace function public.l13_promote_digests()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  op int;
  room int;
  n int;
begin
  if exists (
    select 1 from notifications
     where channel = 'EMAIL' and status = 'PENDING'
       and public.l13_email_is_critical(template, payload)
  ) then
    return 0;
  end if;
  select immediate_n into op from l13_email_counts(now());
  op := coalesce(op, 0);
  room := 85 - op;
  if room <= 0 then
    return 0;
  end if;
  with picked as (
    select id
      from notifications
     where channel = 'EMAIL' and status = 'DIGEST'
       and template not in ('AUTH_INVITE', 'AUTH_PASSWORD_RESET')
     order by created_at, id
     limit room
  )
  update notifications set status = 'PENDING'
   where id in (select id from picked);
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.l13_promote_digests() from public, anon, authenticated;

create or replace function public.l13_auth_email_book(p_template text, p_recipient text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
begin
  if p_template not in ('AUTH_INVITE', 'AUTH_PASSWORD_RESET') then
    raise exception 'L-13: zła rezerwa poczty' using errcode = '22023';
  end if;
  if coalesce(p_recipient, '') = '' then
    raise exception 'L-13: brak odbiorcy' using errcode = '22023';
  end if;
  select id into v_user from app_users where email = p_recipient limit 1;
  return public.l13_queue_email(
    'auth', p_template, v_user, p_recipient, null, null,
    jsonb_build_object('template', p_template),
    'auth:' || p_template || ':' || p_recipient || ':' || (now() at time zone 'Europe/Warsaw')::date::text || ':' || gen_random_uuid()::text,
    null
  );
end $$;
revoke all on function public.l13_auth_email_book(text, text) from public, anon, authenticated;

-- matrix_notify: IN_APP bez zmian. E-mail idzie przez kolejkę z limitem.
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
  v_kind text;
  v_order text;
  v_bundle text;
  r record;
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
  select order_no into v_order from loads where id = p_load_id;
  v_bundle := nullif(v_payload->>'bundle_key', '');
  v_kind := case
    when public.l13_email_is_critical(p_template, v_payload) then 'critical'
    else 'digest'
  end;

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

  for r in
    select u.id as user_id, u.email::text as recipient, u.locale
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
  loop
    perform public.l13_queue_email(
      v_kind, p_template, r.user_id, r.recipient, p_load_id, v_order,
      v_payload || jsonb_build_object('locale', r.locale),
      left(p_dedup_prefix || ':EM:' || r.user_id::text, 200),
      v_bundle
    );
  end loop;
  perform public.l13_email_guard_note(now());
  return n;
end $$;
revoke all on function public.matrix_notify(text, text, uuid, uuid, jsonb, text, text)
  from public, anon, authenticated;

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
  r record;
begin
  if public.l13_automatic_decision_email() is not true then
    return;
  end if;
  select * into d from decisions where id = p_decision;
  if not found then
    return;
  end if;
  select decider_role, severity_default into v_role, v_sev
    from decision_types where code = d.type_code;
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
  for r in
    select u.id as user_id, u.email::text as recipient, u.locale
      from app_users u
      join organizations o on o.id = u.org_id
      join notification_matrix m
        on m.event_group = 'DECISION' and m.org_kind = o.kind::text and m.email
     where u.active and u.email is not null
       and (
         o.kind = 'FORWARDER'
         or (o.kind = 'CARRIER' and v_role = 'CARRIER' and (
              d.load_id is null
              or exists (select 1 from loads l where l.id = d.load_id and l.carrier_org_id = o.id)))
         or (o.kind = 'CLIENT' and (
              d.project_id is null
              or exists (select 1 from projects pr where pr.id = d.project_id and pr.client_org_id = o.id)))
       )
  loop
    perform public.l13_queue_email(
      v_kind, 'DECISION_OPEN', r.user_id, r.recipient, d.load_id, v_order,
      v_payload || jsonb_build_object('locale', r.locale),
      left('dec:OPEN:' || d.id::text || ':EM:' || r.user_id::text, 200),
      case when v_kind = 'critical' then v_bundle else null end
    );
  end loop;
  perform public.l13_email_guard_note(now());
end $$;
revoke all on function public.l13_decision_email(uuid) from public, anon, authenticated;

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
      on m.event_group = v_group and m.org_kind = o.kind::text and m.in_app
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
  perform public.l13_decision_email(v_id);
  return v_id;
end $$;
comment on function public.decision_open_from_event(uuid, text, text, text, jsonb, uuid, uuid) is
  'L-1: otwiera decyzję. E-mail według AUTOMATIC_DECISION_EMAIL. Aplikacja zawsze.';
revoke all on function public.decision_open_from_event(uuid, text, text, text, jsonb, uuid, uuid) from public, anon, authenticated;

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
    'assumption', '1 skrzynka na firmę (fixture). Skrót = 1 e-mail na odbiorcę na dobę. Krytyczne: 1 e-mail na zdarzenie na odbiorcę, nie na transport. Rezerwa 10 na zaproszenia i reset. Decyzje automatyczne z e-mailem.',
    'per_transport', v_one,
    'critical_per_transport', v_crit,
    'one_each_peak_10', v_peak_one,
    'one_each_fleet_94', v_fleet_one,
    'digest_peak_10', v_peak_digest,
    'digest_fleet_uncapped', v_fleet_digest,
    'digest_fleet_capped', least(v_fleet_digest, 90),
    'over_60', (v_peak_one > 60 or v_fleet_one > 60),
    'resend_limit', 100,
    'operational_limit', 90,
    'auth_reserve', 10,
    'warn_at', 80,
    'critical_only_at', 85,
    'automatic_decision_email', public.l13_automatic_decision_email()
  );
end $$;
comment on function public.l13_email_projection(jsonb, int, int) is
  'Szacunek e-maili. Nie wysyła. automatic_decision_email czyta przełącznik.';
revoke all on function public.l13_email_projection(jsonb, int, int) from public, anon, authenticated;

create or replace function public.email_budget_status()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_who jsonb;
begin
  if (is_hhl()) is not true then
    return null;
  end if;
  select * into r from l13_email_counts(now());
  select coalesce(jsonb_agg(jsonb_build_object('recipient', recipient, 'n', n) order by recipient), '[]'::jsonb)
    into v_who
    from (
      select recipient, count(*)::int as n
        from notifications
       where channel = 'EMAIL'
         and status = 'SUPPRESSED'
         and (created_at at time zone 'Europe/Warsaw')::date = r.day
       group by recipient
    ) s;
  return jsonb_build_object(
    'day', r.day,
    'immediate_n', r.immediate_n,
    'digest_n', r.digest_n,
    'suppressed_n', r.suppressed_n,
    'suppressed_to', v_who,
    'level', r.level,
    'resend_limit', 100,
    'operational_limit', 90,
    'auth_reserve', 10,
    'warn_at', 80,
    'critical_only_at', 85,
    'automatic_decision_email', public.l13_automatic_decision_email()
  );
end $$;
comment on function public.email_budget_status() is
  'Stan poczty. Pokazuje, ile e-maili nie wyszło i do kogo. Nie wysyła.';
revoke all on function public.email_budget_status() from public, anon;
grant execute on function public.email_budget_status() to authenticated;

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
      'operational', v_n,
      'warn_at', 80,
      'critical_only_at', 85,
      'operational_limit', 90,
      'auth_reserve', 10,
      'resend_limit', 100,
      'note', 'Poczta operacyjna zbliża się do limitu. 10 na dobę zostaje na zaproszenia i reset hasła.'
    )
  );
  return v_level;
end $$;
revoke all on function public.l13_email_guard_note(timestamptz) from public, anon, authenticated;
