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
    when 'CODE' then 'CODE'
    else 'HHL'
  end;
begin
  if v = '' then
    return v;
  end if;
  -- Samo „SEFS:” w tytule sprawy. Zdania o odczycie paliwa zostają (D1).
  if v ~* '(^|[[:space:]])SEFS:' and v !~* 'odczytu paliwa' then
    v := regexp_replace(v, 'SEFS:', 'Opłata paliwowa:', 'gi');
  end if;
  if p_load is not null and v ~* '[0-9a-f]{8}:' then
    select l.hhl_order_no, l.carrier_order_no into v_hhl, v_scx
      from loads l where l.id = p_load;
    v_code := public.load_sms_code(p_load);
    v_rest := btrim(regexp_replace(v, '[0-9a-f]{8}:\s*', '', 'gi'));
    v_rest := btrim(regexp_replace(v_rest, ':\s*:', ': ', 'g'));
    if v_party = 'CODE' and v_code is not null and v_code <> '—' then
      v := v_code;
    elsif v_party in ('HHL', 'SCX', 'KSH') and v_code is not null and v_code <> '—' then
      v := public.transport_label(v_code, v_hhl, v_scx, v_party, 'plain');
    else
      v := case when v_code is null or v_code = '—' then '' else v_code end;
    end if;
    if v <> '' and v_rest <> '' then
      if v_rest ~* '^Decyzja po terminie:' then
        v := regexp_replace(v_rest, '^Decyzja po terminie:\s*', 'Decyzja po terminie: ' || v || ' — ');
      else
        v := v || ' — ' || v_rest;
      end if;
    elsif v_rest <> '' then
      v := v_rest;
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
    -- Zapisany tytuł bez numeru jednej firmy. Numer dokłada powiadomienie dla odbiorcy (E41).
    v_party := 'CODE';
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
  h record;
  u record;
  n int := 0;
  v_key text;
  v_stamp text := to_char(now(), 'YYYYMMDDHH24MISSMS');
  v_ids jsonb;
  v_types int;
  v_type text;
  v_label text;
  v_title text;
  v_payload jsonb;
begin
  perform set_config('tower.escalate_overdue', '1', true);
  create temporary table if not exists esc_hit (
    user_id uuid,
    decision_id uuid,
    load_id uuid,
    type_code text,
    raw_title text,
    bell boolean,
    mail boolean,
    recipient text,
    locale text,
    party text
  ) on commit drop;
  delete from esc_hit;

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
    v_title := public.tower_public_title(r.load_id, r.title, 'CODE');
    v_key := 'decision-overdue:' || r.id::text;
    if not exists (
      select 1 from risk_signals where dedup_key = v_key and resolved_at is null
    ) then
      insert into risk_signals (project_id, load_id, kind, severity, title, title_key, detail, dedup_key, audience)
      values (
        r.project_id, r.load_id, 'JOB_FAILURE', 'HIGH',
        'Decyzja po terminie: ' || v_title,
        'rk_decision_overdue',
        jsonb_build_object(
          'decision_id', r.id, 'type', r.type_code,
          'params', jsonb_build_object('title', v_title)
        ),
        v_key,
        'HHL'
      )
      on conflict (dedup_key) where dedup_key is not null and resolved_at is null do nothing;
    end if;
    insert into esc_hit (user_id, decision_id, load_id, type_code, raw_title, bell, mail, recipient, locale, party)
    select u.id, r.id, r.load_id, r.type_code, r.title,
           public.notify_person_on(u.id, 'dec_late', 'bell', m.in_app, m.fixed_in_app),
           public.notify_person_on(u.id, 'dec_late', 'mail', m.email, m.fixed_email)
             and u.email is not null,
           coalesce(u.email::text, u.id::text),
           u.locale,
           case o.kind::text when 'CARRIER' then 'SCX' when 'CLIENT' then 'KSH' else 'HHL' end
      from app_users u
      join organizations o on o.id = u.org_id
      join notification_matrix m
        on m.event_key = 'dec_late' and m.role = u.role and m.risks_only is not true
     where u.active
       and u.role in ('HHL_ADMIN','HHL_OPS','CLIENT_USER','CARRIER_DISPATCH','CARRIER_USER')
       and (
         public.notify_person_on(u.id, 'dec_late', 'bell', m.in_app, m.fixed_in_app)
         or (public.notify_person_on(u.id, 'dec_late', 'mail', m.email, m.fixed_email) and u.email is not null)
       )
       and (
         o.kind = 'FORWARDER'
         or (o.kind = 'CARRIER' and (
              r.load_id is null
              or exists (select 1 from loads l where l.id = r.load_id and l.carrier_org_id = o.id)))
         or (o.kind = 'CLIENT' and (
              r.project_id is null
              or exists (select 1 from projects p where p.id = r.project_id and p.client_org_id = o.id)
              or exists (select 1 from loads l join projects p on p.id = l.project_id
                          where l.id = r.load_id and p.client_org_id = o.id)))
       );
    n := n + 1;
  end loop;

  for u in
    select user_id, count(*)::int as cnt,
           bool_or(bell) as bell, bool_or(mail) as mail,
           min(recipient) as recipient, min(locale) as locale
      from esc_hit
     group by user_id
    having count(*) > 5
  loop
    select coalesce(jsonb_agg(distinct decision_id::text), '[]'::jsonb),
           count(distinct type_code), min(type_code)
      into v_ids, v_types, v_type
      from esc_hit
     where user_id = u.user_id;
    v_label := 'Po terminie: ' || u.cnt || ' decyzji';
    if v_types = 1 and v_type = 'SEFS_OUT_OF_TABLE' then
      v_label := v_label || ' · Opłata paliwowa';
    end if;
    v_payload := jsonb_build_object(
      'title', v_label, 'decision', v_label, 'path', '/ryzyka',
      'n', u.cnt, 'event', 'ESCALATE', 'locale', u.locale,
      'decision_ids', v_ids
    );
    if u.bell is true then
      insert into notifications (channel, recipient, user_id, template, payload, dedup_key)
      values (
        'IN_APP', u.recipient, u.user_id, 'DECISION_ESCALATED_BATCH', v_payload,
        left('ESC_BATCH:' || u.user_id::text || ':' || v_stamp || ':IN', 200)
      )
      on conflict (dedup_key) where dedup_key is not null do nothing;
    end if;
    if u.mail is true then
      perform public.l13_queue_email(
        'critical', 'DECISION_ESCALATED_BATCH', u.user_id, u.recipient,
        null, null, v_payload,
        left('ESC_BATCH:' || u.user_id::text || ':' || v_stamp || ':EM', 200),
        null
      );
    end if;
  end loop;

  for h in
    select * from esc_hit e
     where e.user_id not in (
       select user_id from esc_hit group by user_id having count(*) > 5
     )
  loop
    v_title := public.tower_public_title(h.load_id, h.raw_title, h.party);
    v_payload := jsonb_build_object(
      'decision_id', h.decision_id, 'type', h.type_code, 'title', v_title,
      'decision', v_title, 'event', 'ESCALATE', 'locale', h.locale
    );
    if h.bell is true and not exists (
      select 1 from notifications
       where user_id = h.user_id
         and dedup_key = left('dec:ESCALATE:' || h.decision_id::text || ':IN:' || h.user_id::text, 200)
    ) then
      insert into notifications (channel, recipient, user_id, load_id, template, payload, dedup_key)
      values (
        'IN_APP', h.recipient, h.user_id, h.load_id, 'DECISION_ESCALATED', v_payload,
        left('dec:ESCALATE:' || h.decision_id::text || ':IN:' || h.user_id::text, 200)
      )
      on conflict (dedup_key) where dedup_key is not null do nothing;
    end if;
    if h.mail is true and not exists (
      select 1 from notifications
       where user_id = h.user_id
         and dedup_key = left('dec:ESCALATE:' || h.decision_id::text || ':EM:' || h.user_id::text, 200)
    ) then
      perform public.l13_queue_email(
        'critical', 'DECISION_ESCALATED', h.user_id, h.recipient,
        h.load_id, null, v_payload,
        left('dec:ESCALATE:' || h.decision_id::text || ':EM:' || h.user_id::text, 200),
        null
      );
    end if;
  end loop;
  perform set_config('tower.escalate_overdue', '', true);
  return n;
end $$;
revoke all on function public.decision_escalate_overdue() from public, anon, authenticated;

-- B3: powód jednorazowego zamknięcia SOURCE. Test bramy woła tę funkcję.
create or replace function public.sefs_source_expire_reason(p_project uuid, p_detail jsonb)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_today date := (timezone('Europe/Warsaw', now()))::date;
  v_open boolean;
  v_priced boolean;
begin
  v_open := (p_detail->>'prev_week_start') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    and (p_detail->>'prev_week_start')::date + 6 >= v_today;
  v_priced := p_project is not null
    and (p_detail->>'load_date') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    and coalesce(public.sefs_week_calc(p_project, (p_detail->>'load_date')::date)->>'ok', '') = 'true';
  if v_open is true then
    return 'nie dotyczy — tydzień wskaźników jeszcze trwa';
  end if;
  if v_priced is true then
    return 'nie dotyczy — ceny tygodnia są już w bazie';
  end if;
  return null;
end $$;
revoke all on function public.sefs_source_expire_reason(uuid, jsonb) from public, anon, authenticated;

-- Jednorazowo: SOURCE, gdy tydzień jeszcze trwa, albo ceny tego tygodnia już są.
do $m$
declare
  r record;
  v_reason text;
begin
  for r in
    select d.id, d.project_id, d.detail
      from decisions d
     where d.type_code = 'SEFS_OUT_OF_TABLE'
       and d.status in ('NEW', 'ASSIGNED', 'SNOOZED')
       and coalesce(d.detail->>'reason', '') = 'SOURCE'
  loop
    v_reason := public.sefs_source_expire_reason(r.project_id, r.detail);
    if v_reason is not null then
      perform public.decision_expire(r.id, v_reason);
    end if;
  end loop;
end
$m$;

update decisions d
   set title = public.tower_public_title(d.load_id, d.title, 'CODE'),
       updated_at = now()
 where d.status in ('NEW', 'ASSIGNED', 'SNOOZED')
   and (d.title ~* '[0-9a-f]{8}:' or d.title ~* '(^|[[:space:]])SEFS:');

update risk_signals s
   set title = public.tower_public_title(s.load_id, s.title, 'HHL'),
       detail = case
         when coalesce(s.detail#>>'{params,title}', '') ~* '[0-9a-f]{8}:'
           or (
             coalesce(s.detail#>>'{params,title}', '') ~* '(^|[[:space:]])SEFS:'
             and coalesce(s.detail#>>'{params,title}', '') !~* 'odczytu paliwa'
           )
         then jsonb_set(
           s.detail, '{params,title}',
           to_jsonb(public.tower_public_title(s.load_id, s.detail#>>'{params,title}', 'HHL')),
           true
         )
         else s.detail
       end
 where s.resolved_at is null
   and (
     s.title ~* '[0-9a-f]{8}:'
     or s.title ~* '(^|[[:space:]])SEFS:'
     or coalesce(s.detail#>>'{params,title}', '') ~* '[0-9a-f]{8}:'
     or coalesce(s.detail#>>'{params,title}', '') ~* '(^|[[:space:]])SEFS:'
   );

update notifications n
   set payload = n.payload
       || case
            when coalesce(n.payload->>'title', '') ~* '[0-9a-f]{8}:'
              or (coalesce(n.payload->>'title', '') ~* '(^|[[:space:]])SEFS:'
                  and coalesce(n.payload->>'title', '') !~* 'odczytu paliwa')
              then jsonb_build_object('title', public.tower_public_title(
                n.load_id, n.payload->>'title',
                case o.kind when 'CARRIER' then 'SCX' when 'CLIENT' then 'KSH' else 'HHL' end))
            else '{}'::jsonb
          end
       || case
            when coalesce(n.payload->>'decision', '') ~* '[0-9a-f]{8}:'
              or (coalesce(n.payload->>'decision', '') ~* '(^|[[:space:]])SEFS:'
                  and coalesce(n.payload->>'decision', '') !~* 'odczytu paliwa')
              then jsonb_build_object('decision', public.tower_public_title(
                n.load_id, n.payload->>'decision',
                case o.kind when 'CARRIER' then 'SCX' when 'CLIENT' then 'KSH' else 'HHL' end))
            else '{}'::jsonb
          end
  from app_users u
  join organizations o on o.id = u.org_id
 where n.user_id = u.id
   and (
     n.channel = 'IN_APP'
     or (n.channel = 'EMAIL' and n.status is distinct from 'SENT')
   )
   and (
     coalesce(n.payload->>'title', '') ~* '[0-9a-f]{8}:'
     or coalesce(n.payload->>'title', '') ~* '(^|[[:space:]])SEFS:'
     or coalesce(n.payload->>'decision', '') ~* '[0-9a-f]{8}:'
     or coalesce(n.payload->>'decision', '') ~* '(^|[[:space:]])SEFS:'
   );

-- B1 / P6: L-3 nie dokłada wpisu, gdy eskalacja albo zbiorczy już doszedł do tej osoby.
create or replace function public.l3_critical_notify(p_event_key text, p_now timestamptz)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  d decisions%rowtype;
  v_role text;
begin
  select * into d from decisions
   where detail->>'event_key' = p_event_key
     and status in ('NEW', 'ASSIGNED', 'SNOOZED')
   limit 1;
  if not found then
    return;
  end if;
  update decisions
     set detail = detail || jsonb_build_object('l3', true, 'level', 'critical'),
         escalated_at = coalesce(escalated_at, p_now),
         updated_at = p_now
   where id = d.id;
  insert into decision_events (decision_id, actor_id, action, payload)
  values (d.id, null, 'ESCALATE', jsonb_build_object('level', 'critical', 'via', 'L-3', 'at', p_now));
  select decider_role into v_role from decision_types where code = d.type_code;
  insert into notifications (channel, recipient, user_id, load_id, template, payload, dedup_key)
  select 'IN_APP', coalesce(u.email::text, u.id::text), u.id, d.load_id, 'DECISION_ESCALATED',
         jsonb_build_object(
           'decision_id', d.id, 'type', d.type_code, 'title',
           public.tower_public_title(
             d.load_id, d.title,
             case o.kind::text when 'CARRIER' then 'SCX' when 'CLIENT' then 'KSH' else 'HHL' end
           ),
           'status', d.status, 'event', 'critical', 'level', 'critical', 'locale', u.locale
         ),
         left('l3crit:' || d.id::text || ':IN:' || u.id::text, 200)
    from app_users u
    join organizations o on o.id = u.org_id
    join notification_matrix m
      on m.event_key = 'dec_late' and m.role = u.role and m.in_app is true
   where u.active
     and not exists (
       select 1 from notifications n
        where n.user_id = u.id
          and (
            n.dedup_key = left('dec:ESCALATE:' || d.id::text || ':IN:' || u.id::text, 200)
            or n.dedup_key = left('dec:ESCALATE:' || d.id::text || ':EM:' || u.id::text, 200)
            or (
              n.template = 'DECISION_ESCALATED_BATCH'
              and coalesce(n.payload->'decision_ids', '[]'::jsonb) ? d.id::text
            )
          )
     )
     and (
       o.kind = 'FORWARDER'
       or (o.kind = 'CARRIER' and v_role = 'CARRIER' and (
            d.load_id is null
            or exists (select 1 from loads l where l.id = d.load_id and l.carrier_org_id = o.id)))
       or (o.kind = 'CLIENT' and (
            d.project_id is null
            or exists (select 1 from projects pr where pr.id = d.project_id and pr.client_org_id = o.id)
            or exists (select 1 from loads l join projects pr on pr.id = l.project_id
                        where l.id = d.load_id and pr.client_org_id = o.id)))
     )
  on conflict (dedup_key) where dedup_key is not null do nothing;
end $$;
revoke all on function public.l3_critical_notify(text, timestamptz) from public, anon, authenticated;

create or replace function public.trg_risk_matrix_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_group text;
  v_tpl text;
  v_proj uuid;
  v_n int;
begin
  if new.load_id is null
     and new.kind::text in ('FERRY', 'WEATHER', 'ROAD_SE', 'ROAD_PL') then
    return null;
  end if;
  -- Eskalacja po terminie sama składa wpis. Ryzyko decision-overdue nie dokłada RISK_OPEN.
  if current_setting('tower.escalate_overdue', true) = '1'
     and coalesce(new.dedup_key, '') like 'decision-overdue:%' then
    return null;
  end if;

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
    update public.notifications n
       set read_at = coalesce(n.read_at, now()),
           payload = coalesce(n.payload, '{}'::jsonb)
                     || jsonb_build_object('risk_resolved_at', now(), 'c1_resolved', true)
     where n.channel = 'IN_APP'
       and n.template = 'RISK_OPEN'
       and (n.payload->>'risk_id') = new.id::text;
    get diagnostics v_n = row_count;
    insert into public.audit_log (user_id, action, entity, entity_id, old_value, new_value)
    values (
      null, 'C1_RISK_RESOLVE_MARK_READ', 'risk_signals', new.id::text,
      jsonb_build_object('template', 'RISK_RESOLVED_skipped'),
      jsonb_build_object('marked_in_app', v_n)
    );
    return null;
  else
    return null;
  end if;

  -- L-3 przy krytycznym alarmie sam wysyła decyzję. Bez drugiego RISK_SEVERITY.
  if v_tpl = 'RISK_SEVERITY'
     and new.severity::text = 'CRITICAL'
     and coalesce(new.detail->>'l3_level', '') = 'critical' then
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
