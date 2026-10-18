-- D-20261018-1610-01.
-- L-1 nie otwiera SOURCE, gdy tydzień wskaźników jeszcze trwa albo się nie zaczął.
-- Jednorazowo zamyka takie otwarte sprawy, bez powiadomień.
-- Eskalacja: jeden wpis na zdarzenie i osobę; powyżej dwóch w jednym przebiegu — jeden zbiorczy.
-- Tytuły bez ośmiu znaków identyfikatora i bez skrótu SEFS.

create or replace function public.tower_public_title(p_load uuid, p_title text, p_party text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v text := btrim(coalesce(p_title, ''));
  v_code text;
  v_hhl text;
  v_scx text;
  v_rest text;
  v_party text := case coalesce(p_party, '')
    when 'SCX' then 'SCX'
    when 'CARRIER' then 'SCX'
    when 'KSH' then 'KSH'
    when 'CLIENT' then 'KSH'
    else 'HHL'
  end;
begin
  if v = '' then
    return v;
  end if;
  if v ~* 'SEFS' then
    v := regexp_replace(v, 'SEFS', 'Opłata paliwowa', 'gi');
  end if;
  if p_load is not null and v ~ '^[0-9a-f]{8}:' then
    select l.hhl_order_no, l.carrier_order_no into v_hhl, v_scx
      from loads l where l.id = p_load;
    v_code := public.load_sms_code(p_load);
    v_rest := btrim(regexp_replace(v, '^[0-9a-f]{8}:\s*', ''));
    v := public.transport_label(v_code, v_hhl, v_scx, v_party, 'plain');
    if v_rest <> '' then
      v := v || ' — ' || v_rest;
    end if;
  end if;
  return v;
end $$;
revoke all on function public.tower_public_title(uuid, text, text) from public, anon, authenticated;

create or replace function public.trg_tower_public_title()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_party text := 'HHL';
  v_role text;
begin
  if tg_table_name = 'decisions' then
    select decider_role into v_role from decision_types where code = new.type_code;
    v_party := case v_role when 'CARRIER' then 'SCX' when 'CLIENT' then 'KSH' else 'HHL' end;
  end if;
  new.title := public.tower_public_title(new.load_id, new.title, v_party);
  return new;
end $$;
revoke all on function public.trg_tower_public_title() from public, anon, authenticated;

drop trigger if exists trg_decisions_public_title on decisions;
create trigger trg_decisions_public_title
  before insert or update of title on decisions
  for each row
  execute function public.trg_tower_public_title();

drop trigger if exists trg_risks_public_title on risk_signals;
create trigger trg_risks_public_title
  before insert or update of title on risk_signals
  for each row
  execute function public.trg_tower_public_title();

create or replace function public.l1b_sefs_note(p_project uuid, p_load_date date)
returns text
language plpgsql
security definer
set search_path = public
as $l1b$
declare
  v_res jsonb;
  v_reason text;
  v_prev_start date;
  v_final boolean;
  v_title text;
begin
  if p_project is null or p_load_date is null then
    return null;
  end if;
  v_res := sefs_week_calc(p_project, p_load_date);
  v_prev_start := (p_load_date - ((extract(isodow from p_load_date)::int) - 1)) - 7;
  v_final := coalesce((v_res->>'final')::boolean, false)
    or coalesce(v_res->>'status', '') = 'OSTATECZNY';
  if coalesce(v_res->>'ok', '') <> 'true' then
    v_reason := 'SOURCE';
  elsif coalesce((v_res->>'over_table_sek')::boolean, false) or coalesce((v_res->>'over_table_pln')::boolean, false) then
    v_reason := 'OVER';
  else
    v_reason := 'OK';
  end if;
  -- Tydzień, który jeszcze trwa albo się nie zaczął: brak cen jest prognozą, nie sprawą.
  if v_reason = 'SOURCE' and v_final is not true then
    return v_reason;
  end if;
  if v_reason in ('SOURCE', 'OVER') then
    v_title := case
      when v_reason = 'SOURCE' then
        'Opłata paliwowa: brak cen paliwa z tygodnia t'
        || ltrim(to_char(v_prev_start, 'IW'), '0')
        || ' (' || to_char(v_prev_start, 'DD.MM') || '–' || to_char(v_prev_start + 6, 'DD.MM') || ')'
      else 'Opłata paliwowa: indeks poza tabelą progów'
    end;
    perform decision_open_from_event(
      p_project, 'SEFS_OUT_OF_TABLE',
      'l1b:sefs:' || p_project::text || ':' || v_prev_start::text || ':' || v_reason,
      v_title,
      jsonb_build_object('reason', v_reason, 'prev_week_start', v_prev_start, 'load_date', p_load_date),
      null, null);
  end if;
  return v_reason;
end
$l1b$;
revoke all on function public.l1b_sefs_note(uuid, date) from public, anon, authenticated;

create or replace function public.decision_escalate_overdue()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  u record;
  n int := 0;
  v_key text;
  v_from timestamptz := now();
  v_ids uuid[];
  v_types int;
  v_type text;
  v_label text;
  v_email text;
  v_emails int;
begin
  for r in
    select d.id, d.project_id, d.type_code, d.title, d.load_id, d.due_at
      from decisions d
     where d.status in ('NEW','ASSIGNED','SNOOZED')
       and d.due_at is not null
       and d.due_at < now()
       and d.escalated_at is null
       and (d.status <> 'SNOOZED' or d.snooze_until is null or d.snooze_until < now())
  loop
    update decisions set escalated_at = now(), updated_at = now() where id = r.id;
    insert into decision_events (decision_id, actor_id, action, payload)
    values (r.id, null, 'ESCALATE', jsonb_build_object('due_at', r.due_at, 'type', r.type_code));
    v_key := 'decision-overdue:' || r.id::text;
    if not exists (
      select 1 from risk_signals where dedup_key = v_key and resolved_at is null
    ) then
      insert into risk_signals (project_id, load_id, kind, severity, title, title_key, detail, dedup_key, audience)
      values (
        r.project_id, r.load_id, 'JOB_FAILURE', 'HIGH',
        'Decyzja po terminie: ' || r.title,
        'rk_decision_overdue',
        jsonb_build_object('decision_id', r.id, 'type', r.type_code, 'params', jsonb_build_object('title', r.title)),
        v_key,
        'HHL'
      )
      on conflict (dedup_key) where dedup_key is not null and resolved_at is null do nothing;
    end if;
    if not exists (
      select 1 from notifications
       where dedup_key like 'dec:ESCALATE:' || r.id::text || ':%'
    ) then
      perform decision_notify(r.id, 'ESCALATE');
    end if;
    n := n + 1;
  end loop;

  for u in
    select user_id, count(*)::int as cnt
      from notifications
     where channel = 'IN_APP'
       and template = 'DECISION_ESCALATED'
       and created_at >= v_from
       and dedup_key like 'dec:ESCALATE:%'
     group by user_id
    having count(*) > 2
  loop
    select coalesce(array_agg(distinct (payload->>'decision_id')::uuid), '{}'::uuid[])
      into v_ids
      from notifications
     where user_id = u.user_id
       and channel = 'IN_APP'
       and template = 'DECISION_ESCALATED'
       and created_at >= v_from
       and dedup_key like 'dec:ESCALATE:%'
       and (payload->>'decision_id') ~* '^[0-9a-f-]{36}$';
    select count(distinct d.type_code), min(d.type_code)
      into v_types, v_type
      from decisions d
     where d.id = any(v_ids);
    v_label := 'Po terminie: ' || u.cnt || ' decyzji';
    if v_types = 1 and v_type = 'SEFS_OUT_OF_TABLE' then
      v_label := v_label || ' · Opłata paliwowa';
    end if;
    select count(*) into v_emails
      from notifications
     where user_id = u.user_id
       and channel = 'EMAIL'
       and template = 'DECISION_ESCALATED'
       and created_at >= v_from
       and dedup_key like 'dec:ESCALATE:%';
    delete from notifications
     where user_id = u.user_id
       and created_at >= v_from
       and template = 'DECISION_ESCALATED'
       and dedup_key like 'dec:ESCALATE:%';
    select coalesce(email::text, id::text) into v_email
      from app_users where id = u.user_id;
    insert into notifications (channel, recipient, user_id, template, payload, dedup_key)
    values (
      'IN_APP', v_email, u.user_id, 'DECISION_ESCALATED',
      jsonb_build_object(
        'title', v_label,
        'decision', v_label,
        'path', '/ryzyka',
        'n', u.cnt,
        'event', 'ESCALATE'
      ),
      left('ESC_BATCH:' || u.user_id::text || ':' || to_char(v_from, 'YYYYMMDDHH24MISSMS') || ':IN', 200)
    )
    on conflict (dedup_key) where dedup_key is not null do nothing;
    if v_emails > 0 then
      insert into notifications (channel, recipient, user_id, template, payload, dedup_key, status)
      values (
        'EMAIL', v_email, u.user_id, 'DECISION_ESCALATED',
        jsonb_build_object(
          'title', v_label,
          'decision', v_label,
          'path', '/ryzyka',
          'n', u.cnt,
          'event', 'ESCALATE'
        ),
        left('ESC_BATCH:' || u.user_id::text || ':' || to_char(v_from, 'YYYYMMDDHH24MISSMS') || ':EM', 200),
        'PENDING'
      )
      on conflict (dedup_key) where dedup_key is not null do nothing;
    end if;
  end loop;
  return n;
end $$;
revoke all on function public.decision_escalate_overdue() from public, anon, authenticated;

-- Jednorazowo: SOURCE dla tygodnia, który jeszcze nie jest zamknięty.
do $m$
declare
  r record;
begin
  for r in
    select d.id
      from decisions d
     where d.type_code = 'SEFS_OUT_OF_TABLE'
       and d.status in ('NEW', 'ASSIGNED', 'SNOOZED')
       and coalesce(d.detail->>'reason', '') = 'SOURCE'
       and (d.detail->>'prev_week_start') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
       and (d.detail->>'prev_week_start')::date + 6 >= (timezone('Europe/Warsaw', now()))::date
  loop
    perform public.decision_expire(r.id, 'nie dotyczy — tydzień wskaźników jeszcze trwa');
  end loop;
end
$m$;

update decisions d
   set title = public.tower_public_title(
         d.load_id,
         d.title,
         case (select t.decider_role from decision_types t where t.code = d.type_code)
           when 'CARRIER' then 'SCX'
           when 'CLIENT' then 'KSH'
           else 'HHL'
         end
       ),
       updated_at = now()
 where d.status in ('NEW', 'ASSIGNED', 'SNOOZED')
   and (d.title ~ '^[0-9a-f]{8}:' or d.title ilike '%SEFS%');

update risk_signals s
   set title = public.tower_public_title(s.load_id, s.title, 'HHL')
 where s.resolved_at is null
   and (s.title ~ '^[0-9a-f]{8}:' or s.title ilike '%SEFS%');

update notifications n
   set payload = n.payload
       || case
            when coalesce(n.payload->>'title', '') ~ '^[0-9a-f]{8}:' or coalesce(n.payload->>'title', '') ilike '%SEFS%'
              then jsonb_build_object('title', public.tower_public_title(
                n.load_id, n.payload->>'title',
                case o.kind when 'CARRIER' then 'SCX' when 'CLIENT' then 'KSH' else 'HHL' end))
            else '{}'::jsonb
          end
       || case
            when coalesce(n.payload->>'decision', '') ~ '^[0-9a-f]{8}:' or coalesce(n.payload->>'decision', '') ilike '%SEFS%'
              then jsonb_build_object('decision', public.tower_public_title(
                n.load_id, n.payload->>'decision',
                case o.kind when 'CARRIER' then 'SCX' when 'CLIENT' then 'KSH' else 'HHL' end))
            else '{}'::jsonb
          end
  from app_users u
  join organizations o on o.id = u.org_id
 where n.user_id = u.id
   and (
     coalesce(n.payload->>'title', '') ~ '^[0-9a-f]{8}:'
     or coalesce(n.payload->>'title', '') ilike '%SEFS%'
     or coalesce(n.payload->>'decision', '') ~ '^[0-9a-f]{8}:'
     or coalesce(n.payload->>'decision', '') ilike '%SEFS%'
   );
