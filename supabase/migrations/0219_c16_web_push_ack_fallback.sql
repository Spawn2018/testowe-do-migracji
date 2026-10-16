-- C16 (D-20261015-1955-01): potwierdzenie odbioru, stan urządzenia, zapas e-mail (W42),
-- wysyłka od razu po WEB_PUSH (pg_net), cron web-push jako zapas.
-- matrix_notify = 0218 + EMAIL push_fallback:nosub gdy brak urządzenia.

alter table public.notifications
  add column if not exists delivered_at timestamptz;

comment on column public.notifications.delivered_at is
  'C16 N3: chwila potwierdzenia z telefonu (web-push-ack).';

alter table public.push_subscriptions
  add column if not exists last_seen_at timestamptz,
  add column if not exists last_ok_at timestamptz,
  add column if not exists last_error text,
  add column if not exists last_ack_at timestamptz;

comment on column public.push_subscriptions.last_seen_at is 'C16 N7: ostatni upsert / sync z aplikacji';
comment on column public.push_subscriptions.last_ok_at is 'C16 N7: ostatnia udana wysyłka do usługi push';
comment on column public.push_subscriptions.last_error is 'C16 N7: ostatni błąd push_<kod>';
comment on column public.push_subscriptions.last_ack_at is 'C16 N3/N7: ostatnie potwierdzenie z telefonu';

create or replace function public.push_subscribe(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_ua text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid;
  v_id uuid;
begin
  v_me := current_app_user_id();
  if (v_me is not null) is not true then
    raise exception 'Brak aktywnego konta' using errcode = '42501';
  end if;
  if (char_length(trim(coalesce(p_endpoint, ''))) between 8 and 2000) is not true then
    raise exception 'Zły endpoint' using errcode = '22023';
  end if;
  if (char_length(trim(coalesce(p_p256dh, ''))) between 8 and 500) is not true
     or (char_length(trim(coalesce(p_auth, ''))) between 8 and 500) is not true then
    raise exception 'Złe klucze push' using errcode = '22023';
  end if;
  insert into push_subscriptions (user_id, endpoint, p256dh, auth, user_agent, last_seen_at)
  values (v_me, trim(p_endpoint), trim(p_p256dh), trim(p_auth), left(coalesce(p_ua, ''), 300), now())
  on conflict (endpoint) do update
    set user_id = excluded.user_id,
        p256dh = excluded.p256dh,
        auth = excluded.auth,
        user_agent = excluded.user_agent,
        last_seen_at = now()
  returning id into v_id;
  return v_id;
end $$;

revoke all on function public.push_subscribe(text, text, text, text) from public, anon;
grant execute on function public.push_subscribe(text, text, text, text) to authenticated;

-- N4 / W42: EMAIL zapasowy dla jednego WEB_PUSH (dedup push_fallback:<id>)
create or replace function public.web_push_enqueue_fallback(p_notification_id bigint)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_dedup text;
  v_url text;
  v_title text;
  v_body text;
  v_ins int;
begin
  select n.id, n.user_id, n.recipient, n.load_id, n.template, n.payload, n.status, n.delivered_at
    into r
    from notifications n
   where n.id = p_notification_id
     and n.channel = 'WEB_PUSH';
  if not found then
    return false;
  end if;
  if r.delivered_at is not null then
    return false;
  end if;
  if (r.user_id is not null) is not true
     or (r.recipient is not null and length(trim(r.recipient)) >= 3) is not true then
    return false;
  end if;
  if r.status is distinct from 'ERROR' and r.status is distinct from 'SENT' then
    return false;
  end if;

  v_dedup := left('push_fallback:' || r.id::text, 200);
  v_title := coalesce(r.payload->>'title', 'Watch Tower');
  v_body := coalesce(r.payload->>'body', r.template);
  v_url := coalesce(nullif(r.payload->>'url', ''), nullif(r.payload->>'href', ''), '/');
  if v_url like '%/brak' then
    v_url := '/';
  end if;

  insert into notifications (channel, recipient, user_id, load_id, template, payload, dedup_key, status)
  values (
    'EMAIL',
    trim(r.recipient),
    r.user_id,
    r.load_id,
    r.template,
    coalesce(r.payload, '{}'::jsonb) || jsonb_build_object(
      'title', v_title,
      'body', v_body,
      'url', v_url,
      'push_fallback', true
    ),
    v_dedup,
    'PENDING'
  )
  on conflict (dedup_key) where dedup_key is not null do nothing;
  get diagnostics v_ins = row_count;
  return v_ins > 0;
end $$;

revoke all on function public.web_push_enqueue_fallback(bigint) from public, anon, authenticated;
grant execute on function public.web_push_enqueue_fallback(bigint) to service_role;

create or replace function public.web_push_fallback_tick()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  n int := 0;
  rec record;
  ok boolean;
begin
  for rec in
    select id from notifications
     where channel = 'WEB_PUSH'
       and status = 'ERROR'
       and (error = 'no_sub' or error like 'push_%')
       and delivered_at is null
       and created_at > now() - interval '7 days'
     order by id
     limit 80
  loop
    ok := web_push_enqueue_fallback(rec.id);
    if ok then n := n + 1; end if;
  end loop;

  for rec in
    select id from notifications
     where channel = 'WEB_PUSH'
       and status = 'SENT'
       and delivered_at is null
       and sent_at is not null
       and sent_at <= now() - interval '5 minutes'
       and sent_at > now() - interval '7 days'
     order by id
     limit 80
  loop
    ok := web_push_enqueue_fallback(rec.id);
    if ok then n := n + 1; end if;
  end loop;

  return n;
end $$;

revoke all on function public.web_push_fallback_tick() from public, anon, authenticated;
grant execute on function public.web_push_fallback_tick() to service_role;

comment on function public.web_push_enqueue_fallback(bigint) is
  'C16 N4 / W42: EMAIL zapasowy dla WEB_PUSH (dedup push_fallback:<id>), bez SMS.';
comment on function public.web_push_fallback_tick() is
  'C16 N4: no_sub/push_fail od razu; SENT bez delivered_at po 5 min.';

create or replace function public.trg_web_push_send_now()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT'
     and new.channel = 'WEB_PUSH'
     and new.status = 'PENDING'
     and exists (select 1 from pg_extension where extname = 'pg_net')
     and to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is not null then
    begin
      perform net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
               || '/functions/v1/web-push-send',
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
          'Content-Type', 'application/json'),
        body := jsonb_build_object('source', 'trigger', 'id', new.id),
        timeout_milliseconds := 25000
      );
    exception when others then
      null;
    end;
  end if;
  return new;
end $$;

drop trigger if exists notifications_web_push_send_now on public.notifications;
create trigger notifications_web_push_send_now
  after insert on public.notifications
  for each row
  execute function public.trg_web_push_send_now();

do $m$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron')
     and exists (select 1 from pg_extension where extname = 'pg_net') then

    perform cron.unschedule(jobid) from cron.job where jobname = 'tower-web-push-send';
    perform cron.schedule('tower-web-push-send', '*/5 * * * *', $c$
      select net.http_post(
        url     := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/web-push-send',
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
          'Content-Type', 'application/json'),
        body    := '{}'::jsonb,
        timeout_milliseconds := 90000)
    $c$);

    perform cron.unschedule(jobid) from cron.job where jobname = 'tower-web-push-fallback';
    perform cron.schedule('tower-web-push-fallback', '* * * * *',
      $c$ select public.web_push_fallback_tick() $c$);

  else
    raise notice '0219: pg_cron lub pg_net niedostępne — cron web-push do zaplanowania ręcznie';
  end if;
end
$m$;

-- matrix_notify = 0218 + C16 N4 nosub fallback (bez zmiany reguł C1 / L-13)
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
  v_critical boolean;
  v_plan_dates boolean := (p_template = 'PLAN_DATES_CHANGED');
  v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
  v_decision text := coalesce(nullif(v_payload->>'decision_id', ''), nullif(v_payload->>'decisionId', ''));
  v_needs_transport boolean;
  v_source_alarm boolean;
  v_has_push_target boolean;
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

  if p_template = 'RISK_RESOLVED' then
    return 0;
  end if;

  if p_load_id is null and p_template in ('RISK_OPEN', 'RISK_SEVERITY') then
    if coalesce(v_payload->>'kind', '') not in ('USAGE_LIMIT', 'JOB_FAILURE')
       and coalesce(v_payload->>'title_key', '') is distinct from 'rk_source_down'
       and p_dedup_prefix not like 'SOURCE_DOWN%' then
      return 0;
    end if;
  end if;
  v_needs_transport := p_template in (
    'ZONE_ENTER', 'ZONE_EXIT', 'LOAD_STATUS_CHANGED',
    'PLAN_DATES_CHANGED', 'STATUS_CHANGE', 'LOAD_CHAT_MESSAGE', 'FEE_PROPOSED', 'FEE_DECIDED',
    'RESOURCE_MISSING', 'RESOURCE_DEADLINE', 'ORDER_NO_MISSING', 'HHL_ORDER_MISSING',
    'CARRIER_ORDER_MISSING', 'LOADING_UNCONFIRMED', 'AUTO_STATUS', 'DATES_UNCONFIRMED', 'SEQUENCE'
  );
  if v_needs_transport and p_load_id is null then
    return 0;
  end if;
  if (p_event_group = 'DECISION' or p_template like 'DECISION%')
     and v_decision is null and p_load_id is null then
    return 0;
  end if;

  v_payload := v_payload
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
    left join notification_matrix m
      on m.event_group = p_event_group and m.role = u.role
   where u.active
     and u.role in ('HHL_ADMIN','HHL_OPS','CLIENT_USER','CARRIER_DISPATCH','CARRIER_USER')
     and (p_only_org_kind is null or o.kind::text = p_only_org_kind)
     and (
       (v_plan_dates and u.role in ('HHL_ADMIN','HHL_OPS','CARRIER_DISPATCH','CARRIER_USER'))
       or (v_plan_dates is not true and m.in_app is true)
     )
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
        on m.event_group = p_event_group and m.role = u.role and m.email
     where u.active and u.email is not null
       and u.role in ('HHL_ADMIN','HHL_OPS','CLIENT_USER','CARRIER_DISPATCH','CARRIER_USER')
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
      case when v_kind = 'critical' then v_bundle else null end
    );
  end loop;
  perform public.l13_email_guard_note(now());

  v_critical := (
    coalesce(v_payload->>'severity', '') = 'CRITICAL'
    or p_template ilike '%CRITICAL%'
    or p_template in ('FERRY_CANCELLED', 'SCHEDULE_DATE_CRITICAL')
  );
  v_source_alarm := (
    p_dedup_prefix like 'SOURCE_DOWN%'
    or coalesce(v_payload->>'title_key', '') = 'rk_source_down'
    or coalesce(v_payload->>'kind', '') in ('JOB_FAILURE', 'SOURCE_DOWN')
    or p_template in ('SOURCE_DOWN', 'JOB_FAILURE')
  );
  v_has_push_target := p_load_id is not null or v_decision is not null or v_source_alarm;
  if v_critical is true and v_has_push_target is true then
  insert into notifications (channel, recipient, user_id, load_id, template, payload, dedup_key, status)
  select 'WEB_PUSH', coalesce(u.email::text, u.id::text), u.id, p_load_id, p_template,
         v_payload || jsonb_build_object('locale', u.locale, 'critical', true),
         left(p_dedup_prefix || ':WP:' || u.id::text, 200),
         'PENDING'
    from app_users u
    join organizations o on o.id = u.org_id
    join notification_matrix m
      on m.event_group = p_event_group and m.role = u.role and m.push is true
    left join user_preferences pref on pref.user_id = u.id
   where u.active
     and u.role in ('HHL_ADMIN','HHL_OPS','CLIENT_USER','CARRIER_DISPATCH','CARRIER_USER')
     and coalesce(pref.web_push_enabled, true) is true
     and exists (select 1 from push_subscriptions ps where ps.user_id = u.id)
     and (p_only_org_kind is null or o.kind::text = p_only_org_kind)
     and (
       v_source_alarm is not true
       or (o.kind = 'FORWARDER' and u.role in ('HHL_ADMIN', 'HHL_OPS'))
     )
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

  -- C16 N4 / W42: bez urządzenia → EMAIL zapasowy od razu (PENDING, poza L-13)
  insert into notifications (channel, recipient, user_id, load_id, template, payload, dedup_key, status)
  select 'EMAIL', coalesce(u.email::text, u.id::text), u.id, p_load_id, p_template,
         v_payload || jsonb_build_object('locale', u.locale, 'critical', true, 'push_fallback', true),
         left('push_fallback:nosub:' || p_dedup_prefix || ':' || u.id::text, 200),
         'PENDING'
    from app_users u
    join organizations o on o.id = u.org_id
    join notification_matrix m
      on m.event_group = p_event_group and m.role = u.role and m.push is true
    left join user_preferences pref on pref.user_id = u.id
   where u.active and u.email is not null
     and u.role in ('HHL_ADMIN','HHL_OPS','CLIENT_USER','CARRIER_DISPATCH','CARRIER_USER')
     and coalesce(pref.web_push_enabled, true) is true
     and not exists (select 1 from push_subscriptions ps where ps.user_id = u.id)
     and (p_only_org_kind is null or o.kind::text = p_only_org_kind)
     and (
       v_source_alarm is not true
       or (o.kind = 'FORWARDER' and u.role in ('HHL_ADMIN', 'HHL_OPS'))
     )
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

  return n;
end $$;

comment on function public.matrix_notify(text, text, uuid, uuid, jsonb, text, text) is
  'E11/E5 C1 + C16 N4: L-13 e-mail; WEB_PUSH krytyczne; bez urządzenia → EMAIL push_fallback:nosub (W42).';
