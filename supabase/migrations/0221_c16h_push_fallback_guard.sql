-- C16-H (D-20261016-0100-01): e-mail zapasowy tylko po erze potwierdzeń;
-- bez dublowania limit 80; bez RISK_RESOLVED; CANCEL PENDING dla starych WEB_PUSH.

-- Granica: nałożenie 0219 na produkcji (~15.10.2026 21:45 UTC, pierwszy cron fallback 21:48 UTC).
-- Starsze WEB_PUSH nigdy nie dostają e-maila zapasowego (telefon nie mógł ich potwierdzić).
create or replace function public.c16h_web_push_ack_boundary()
returns timestamptz
language sql
immutable
set search_path = public
as $$
  select timestamptz '2026-10-15 21:40:00+00';
$$;

revoke all on function public.c16h_web_push_ack_boundary() from public, anon, authenticated;
grant execute on function public.c16h_web_push_ack_boundary() to service_role;

comment on function public.c16h_web_push_ack_boundary() is
  'C16-H: WEB_PUSH utworzone przed tą chwilą nie dostają e-maila zapasowego (D-20261016-0100-01).';

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
  select n.id, n.user_id, n.recipient, n.load_id, n.template, n.payload, n.status, n.delivered_at, n.created_at
    into r
    from notifications n
   where n.id = p_notification_id
     and n.channel = 'WEB_PUSH';
  if not found then
    return false;
  end if;
  -- H1: tylko po granicy potwierdzeń
  if r.created_at < public.c16h_web_push_ack_boundary() then
    return false;
  end if;
  -- H1: tylko pilne (C1); RISK_RESOLVED nie jest pilne
  if r.template = 'RISK_RESOLVED' then
    return false;
  end if;
  if coalesce(r.payload->>'critical', '') is distinct from 'true'
     and r.template not in ('FERRY_CANCELLED', 'SCHEDULE_DATE_CRITICAL', 'SOURCE_DOWN', 'JOB_FAILURE')
     and r.template not ilike '%CRITICAL%' then
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
  v_bound timestamptz := public.c16h_web_push_ack_boundary();
begin
  for rec in
    select id from notifications n
     where channel = 'WEB_PUSH'
       and status = 'ERROR'
       and (error = 'no_sub' or error like 'push_%')
       and delivered_at is null
       and created_at >= v_bound
       and created_at > now() - interval '7 days'
       and template is distinct from 'RISK_RESOLVED'
       and (
         coalesce(payload->>'critical', '') = 'true'
         or template in ('FERRY_CANCELLED', 'SCHEDULE_DATE_CRITICAL', 'SOURCE_DOWN', 'JOB_FAILURE')
         or template ilike '%CRITICAL%'
       )
       and not exists (
         select 1 from notifications f
          where f.dedup_key = 'push_fallback:' || n.id::text
       )
     order by id
     limit 80
  loop
    ok := web_push_enqueue_fallback(rec.id);
    if ok then n := n + 1; end if;
  end loop;

  for rec in
    select id from notifications n
     where channel = 'WEB_PUSH'
       and status = 'SENT'
       and delivered_at is null
       and sent_at is not null
       and sent_at <= now() - interval '5 minutes'
       and sent_at > now() - interval '7 days'
       and created_at >= v_bound
       and template is distinct from 'RISK_RESOLVED'
       and (
         coalesce(payload->>'critical', '') = 'true'
         or template in ('FERRY_CANCELLED', 'SCHEDULE_DATE_CRITICAL', 'SOURCE_DOWN', 'JOB_FAILURE')
         or template ilike '%CRITICAL%'
       )
       and not exists (
         select 1 from notifications f
          where f.dedup_key = 'push_fallback:' || n.id::text
       )
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
  'C16-H / W42: EMAIL zapasowy tylko dla WEB_PUSH po granicy potwierdzeń, pilnych, bez RISK_RESOLVED.';
comment on function public.web_push_fallback_tick() is
  'C16-H: no_sub/push_fail od razu; SENT bez delivered_at po 5 min; NOT EXISTS push_fallback; po granicy 0219.';

-- H2: anuluj PENDING e-maile zapasowe dla WEB_PUSH sprzed granicy (jak 0071 CANCELLED)
do $h2$
declare
  n_cancel int;
begin
  update notifications f
     set status = 'CANCELLED',
         error = 'C16 H2: powiadomienie sprzed potwierdzeń (D-20261016-0100-01)'
   where f.channel = 'EMAIL'
     and f.status = 'PENDING'
     and f.dedup_key like 'push_fallback:%'
     and f.dedup_key not like 'push_fallback:nosub:%'
     and exists (
       select 1
         from notifications n
        where n.channel = 'WEB_PUSH'
          and n.id = nullif(substring(f.dedup_key from length('push_fallback:') + 1), '')::bigint
          and n.created_at < public.c16h_web_push_ack_boundary()
     );
  get diagnostics n_cancel = row_count;

  insert into audit_log (user_id, action, entity, entity_id, new_value)
  values (
    null,
    'C16H_PUSH_FALLBACK_CANCEL',
    'notifications',
    'batch',
    jsonb_build_object(
      'cancelled_pending', n_cancel,
      'boundary', public.c16h_web_push_ack_boundary()
    )
  );
end;
$h2$;
