-- =====================================================================
-- TOWER — Migracja 0138: L-1 — automatyczne otwieranie decyzji
--
-- Katalog 16 typów (0102) istnieje, ale nic go nie otwierało (LOGIKA §1).
-- DEC-CLICK (a): LOADING_UNCONFIRMED, SEQUENCE, DATES_UNCONFIRMED,
-- USAGE_LIMIT i JOB_FAILURE (poza kopią) NIE dostają typu decyzji.
-- Reszta: tylko tam, gdzie zdarzenie w kodzie jest wprost tą sytuacją
-- z katalogu. Jedno zdarzenie (event_key) = jedna decyzja.
-- Zamknięcie ryzyka nie rusza decyzji (brak ON DELETE CASCADE na tym torze).
-- =====================================================================

create or replace function public.l1_decision_type(p_kind text, p_detail jsonb)
returns text
language sql
stable
as $$
  select case
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
comment on function public.l1_decision_type(text, jsonb) is
  'L-1: typ decyzji albo NULL. Grupa C DEC-CLICK (bez nowego typu) zwraca NULL.';
revoke all on function public.l1_decision_type(text, jsonb) from public, anon, authenticated;

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
  -- Do L-13: tylko aplikacja. Bez e-maila (macierz DECISION ma e-mail dla HHL) i bez SMS.
  insert into notifications (channel, recipient, user_id, load_id, template, payload, dedup_key)
  select 'IN_APP', coalesce(u.email::text, u.id::text), u.id, p_load, 'DECISION_OPEN',
         jsonb_build_object(
           'decision_id', v_id, 'type', p_type, 'title', p_title,
           'status', 'NEW', 'event', 'OPEN', 'locale', u.locale, 'event_group', 'DECISION'
         ),
         left('dec:OPEN:' || v_id::text || ':IN:' || u.id::text, 200)
    from app_users u
    join organizations o on o.id = u.org_id
    join notification_matrix m
      on m.event_group = 'DECISION' and m.org_kind = o.kind::text and m.in_app
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
  return v_id;
end $$;
comment on function public.decision_open_from_event(uuid, text, text, text, jsonb, uuid, uuid) is
  'L-1: otwiera decyzję. Ten sam event_key nie dubluje. Do L-13 powiadomienie tylko IN_APP, bez e-maila i SMS.';
revoke all on function public.decision_open_from_event(uuid, text, text, text, jsonb, uuid, uuid) from public, anon, authenticated;

create unique index if not exists decisions_event_key_uidx
  on decisions ((detail->>'event_key'))
  where detail ? 'event_key';

create or replace function public.trg_l1_risk_opens_decision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type text;
  v_key text;
begin
  -- title_key schodzi z detail do kolumny (0042) zanim ten wyzwalacz zobaczy wiersz
  v_type := l1_decision_type(new.kind::text, coalesce(new.detail, '{}'::jsonb) || jsonb_build_object('title_key', new.title_key));
  if v_type is null then
    return new;
  end if;
  v_key := coalesce(nullif(btrim(new.dedup_key), ''), 'risk:' || new.id::text);
  perform decision_open_from_event(
    new.project_id, v_type, v_key, new.title, new.detail, new.load_id, new.id
  );
  return new;
end $$;
revoke all on function public.trg_l1_risk_opens_decision() from public, anon, authenticated;

drop trigger if exists trg_l1_risk_opens_decision on risk_signals;
create trigger trg_l1_risk_opens_decision
  after insert on risk_signals
  for each row execute function public.trg_l1_risk_opens_decision();

create or replace function public.trg_l1_backup_failed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project uuid;
begin
  if new.status is distinct from 'ERROR' then
    return new;
  end if;
  if old.status is not distinct from 'ERROR' then
    return new;
  end if;
  select id into v_project from projects order by created_at limit 1;
  if v_project is null then
    return new;
  end if;
  perform decision_open_from_event(
    v_project,
    'BACKUP_FAILED',
    'backup-run:' || new.id::text,
    'Kopia zapasowa nieudana',
    jsonb_build_object('backup_run_id', new.id, 'error', left(coalesce(new.error, ''), 500)),
    null,
    null
  );
  return new;
end $$;
revoke all on function public.trg_l1_backup_failed() from public, anon, authenticated;

drop trigger if exists trg_l1_backup_failed on backup_runs;
create trigger trg_l1_backup_failed
  after update of status on backup_runs
  for each row execute function public.trg_l1_backup_failed();
