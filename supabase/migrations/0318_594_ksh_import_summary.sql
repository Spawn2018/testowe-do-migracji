-- #594: zbiorcze powiadomienie IN_APP po imporcie KSH + migawka ksh_import_summaries.
-- Jedno KSH_IMPORT_SUMMARY na konto (zastępuje poprzednie); filtr pól w RPC wg roli.
-- Hook: trigger po update stats w schedule_imports (bez odtwarzania import_schedule).

begin;

-- ---------------------------------------------------------------------------
-- 1. Tabela migawki
-- ---------------------------------------------------------------------------
create table if not exists public.ksh_import_summaries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id),
  import_id uuid references public.schedule_imports(id) on delete set null,
  imported_at timestamptz not null default now(),
  file_name text,
  file_hash text,
  changes jsonb not null default '[]'::jsonb,
  stats jsonb not null default '{}'::jsonb,
  constraint ksh_import_summaries_changes_arr check (jsonb_typeof(changes) = 'array')
);

create index if not exists ksh_import_summaries_project_at_idx
  on public.ksh_import_summaries (project_id, imported_at desc);

comment on table public.ksh_import_summaries is
  '#594: migawka zmian z importu KSH (kształt jak ksh_sync_preview); retencja 30/projekt.';

alter table public.ksh_import_summaries enable row level security;
revoke all on table public.ksh_import_summaries from public, anon, authenticated;
-- Odczyt wyłącznie przez RPC (SECURITY DEFINER); zapis przez publish.

-- ---------------------------------------------------------------------------
-- 2. Macierz: dzwonek dla HHL / KSH / SCX; bez e-mail/SMS/push
-- ---------------------------------------------------------------------------
insert into public.notification_matrix (
  event_key, event_group, role, in_app, email, push,
  fixed_in_app, fixed_email, fixed_push, risks_only, label_pl
) values
  ('ksh_import', 'LOAD_STATUS', 'HHL_ADMIN', true, false, false, true, true, true, false,
   'Zmiany z pliku KSH (zbiorcze)'),
  ('ksh_import', 'LOAD_STATUS', 'HHL_OPS', true, false, false, true, true, true, false,
   'Zmiany z pliku KSH (zbiorcze)'),
  ('ksh_import', 'LOAD_STATUS', 'CLIENT_USER', true, false, false, true, true, true, false,
   'Zmiany z pliku KSH (zbiorcze)'),
  ('ksh_import', 'LOAD_STATUS', 'CARRIER_DISPATCH', true, false, false, true, true, true, false,
   'Zmiany z pliku KSH (zbiorcze)'),
  ('ksh_import', 'LOAD_STATUS', 'CARRIER_USER', true, false, false, true, true, true, false,
   'Zmiany z pliku KSH (zbiorcze)')
on conflict (event_key, role) do update set
  in_app = excluded.in_app,
  email = excluded.email,
  push = excluded.push,
  fixed_in_app = excluded.fixed_in_app,
  fixed_email = excluded.fixed_email,
  fixed_push = excluded.fixed_push,
  label_pl = excluded.label_pl;

-- ---------------------------------------------------------------------------
-- 3. Mapowanie szablonu → macierz (oraz zapas payload.matrix_event)
-- ---------------------------------------------------------------------------
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
    when p_template in ('DOC_MISSING', 'CMR_MISSING') then 'cmr'
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

-- ---------------------------------------------------------------------------
-- 4. Widoczność pól wg roli (karta transportu)
-- ---------------------------------------------------------------------------
create or replace function public.ksh_import_summary_field_visible(p_field text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_kind text;
begin
  if p_field is null or btrim(p_field) = '' then
    return true; -- wiersze added/missing bez pola
  end if;
  if public.ksh_sync_preview_field_allowed(p_field) is not true then
    return false;
  end if;
  select o.kind::text into v_kind
    from public.app_users u
    join public.organizations o on o.id = u.org_id
   where u.id = public.current_app_user_id() and u.active;
  if v_kind is null then
    return false;
  end if;
  -- KSH: bez numerów HHL–SCX / HHL–KSH i bez kosztów przewoźnika
  if v_kind = 'CLIENT' then
    return p_field not in (
      'hhl_order_no', 'carrier_order_no',
      'agreed_fee', 'carrier_rate', 'carrier_price', 'cost', 'margin', 'sefs'
    );
  end if;
  -- SCX: bez numeru HHL–KSH i bez przychodu klienta
  if v_kind = 'CARRIER' then
    return p_field not in (
      'hhl_order_no',
      'client_price', 'revenue', 'agreed_fee_client', 'margin', 'sefs'
    );
  end if;
  return true; -- FORWARDER (HHL)
end;
$$;

revoke all on function public.ksh_import_summary_field_visible(text) from public, anon, authenticated;
comment on function public.ksh_import_summary_field_visible(text) is
  '#594: filtr pól migawki — KSH bez numerów zleceń i kosztów SCX; SCX bez HHL–KSH i przychodu.';

-- ---------------------------------------------------------------------------
-- 5. Budowa listy zmian z load_events danej wersji importu
-- ---------------------------------------------------------------------------
create or replace function public.ksh_import_summary_build_changes(
  p_project uuid, p_version int
) returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_rows jsonb := '[]'::jsonb;
  r record;
  f text;
  v_skip jsonb;
  v_sr text;
begin
  if p_project is null or p_version is null then
    return '[]'::jsonb;
  end if;

  -- Nowe w pliku
  for r in
    select e.load_id, e.payload->>'code' as code
      from public.load_events e
      join public.loads l on l.id = e.load_id
     where l.project_id = p_project
       and e.event_type = 'SCHEDULE_IMPORTED'
       and e.payload->>'action' = 'ADDED'
       and (e.payload->>'version')::int = p_version
     order by e.payload->>'code'
  loop
    v_rows := v_rows || jsonb_build_object(
      'code', r.code, 'load_id', r.load_id, 'kind', 'added'
    );
  end loop;

  -- Zmiany pól
  for r in
    select e.load_id, e.payload->>'code' as code, e.payload as payload
      from public.load_events e
      join public.loads l on l.id = e.load_id
     where l.project_id = p_project
       and e.event_type = 'SCHEDULE_IMPORTED'
       and e.payload->>'action' = 'CHANGED'
       and (e.payload->>'version')::int = p_version
     order by e.payload->>'code'
  loop
    v_skip := coalesce(r.payload->'skip_reason', '{}'::jsonb);
    for f in
      select jsonb_array_elements_text(coalesce(r.payload->'fields', '[]'::jsonb))
    loop
      if public.ksh_sync_preview_field_allowed(f) is not true then
        continue;
      end if;
      v_sr := nullif(v_skip->>f, '');
      v_rows := v_rows || jsonb_strip_nulls(jsonb_build_object(
        'code', r.code,
        'load_id', r.load_id,
        'field', f,
        'field_label', public.ksh_sync_preview_field_label(f),
        'wt', r.payload->'before'->>f,
        'file', r.payload->'after'->>f,
        'kind', 'changed',
        'skip_reason', v_sr
      ));
    end loop;
  end loop;

  -- Anulowane / usunięte z pliku
  for r in
    select e.load_id, coalesce(e.payload->>'code', si.shipment_code) as code
      from public.load_events e
      join public.loads l on l.id = e.load_id
      left join lateral (
        select s.shipment_code from public.shipment_items s
         where s.load_id = e.load_id order by s.shipment_code limit 1
      ) si on true
     where l.project_id = p_project
       and e.event_type = 'STATUS_CANCELLED'
       and (e.payload->>'version')::int = p_version
       and coalesce(e.payload->>'reason', '') ilike '%harmonogram%'
     order by 2
  loop
    v_rows := v_rows || jsonb_build_object(
      'code', r.code, 'load_id', r.load_id, 'kind', 'missing'
    );
  end loop;

  return v_rows;
end;
$$;

revoke all on function public.ksh_import_summary_build_changes(uuid, int) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. Publikacja migawki + jedno IN_APP na konto
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
  v_n_codes int;
  v_n_fields int;
  v_n_added int;
  v_n_missing int;
  v_title text;
  v_short text;
  v_payload jsonb;
  u record;
begin
  perform public.assert_not_preview();
  if p_project is null or p_import_id is null or p_version is null then
    return null;
  end if;

  -- Blokada projektu — bez duplikatów przy równoległych przebiegach
  perform pg_advisory_xact_lock(hashtextextended(p_project::text, 594));

  v_changes := public.ksh_import_summary_build_changes(p_project, p_version);
  if jsonb_array_length(v_changes) = 0 then
    return null;
  end if;

  select count(distinct c->>'code'),
         count(*) filter (where c->>'kind' = 'changed'),
         count(*) filter (where c->>'kind' = 'added'),
         count(*) filter (where c->>'kind' = 'missing')
    into v_n_codes, v_n_fields, v_n_added, v_n_missing
    from jsonb_array_elements(v_changes) c;

  insert into public.ksh_import_summaries (
    project_id, import_id, imported_at, file_name, file_hash, changes, stats
  ) values (
    p_project, p_import_id, v_at, p_file_name, p_file_hash, v_changes,
    jsonb_build_object(
      'transports', v_n_codes,
      'fields', v_n_fields,
      'added', v_n_added,
      'cancelled', v_n_missing
    )
  ) returning id into v_id;

  -- Retencja: ostatnie 30 migawek na projekt
  delete from public.ksh_import_summaries s
   where s.project_id = p_project
     and s.id not in (
       select x.id from public.ksh_import_summaries x
        where x.project_id = p_project
        order by x.imported_at desc, x.id desc
        limit 30
     );

  v_title := 'Zmiany z pliku KSH — '
    || to_char(v_at at time zone 'Europe/Warsaw', 'DD.MM.YYYY HH24:MI');
  v_short := format(
    'Transporty: %s · pola: %s · nowe: %s · anulowane/usunięte: %s',
    v_n_codes, v_n_fields, v_n_added, v_n_missing
  );
  v_payload := jsonb_build_object(
    'title', v_title,
    'summary', v_short,
    'summary_id', v_id,
    'imported_at', v_at,
    'file_name', p_file_name,
    'transports', v_n_codes,
    'fields', v_n_fields,
    'added', v_n_added,
    'cancelled', v_n_missing,
    'matrix_event', 'ksh_import'
  );

  for u in
    select au.id, coalesce(au.email::text, au.id::text) as recipient
      from public.app_users au
      join public.organizations o on o.id = au.org_id
     where au.active
       and (
         o.kind = 'FORWARDER'
         or (o.kind = 'CLIENT' and exists (
               select 1 from public.projects pr
                where pr.id = p_project and pr.client_org_id = o.id))
         or (o.kind = 'CARRIER' and exists (
               select 1 from public.loads l
                where l.project_id = p_project and l.carrier_org_id = o.id
                  and l.status is distinct from 'CANCELLED'
                  and l.removed_at is null))
       )
  loop
    insert into public.notifications (
      channel, recipient, user_id, load_id, template, payload, dedup_key, read_at, status
    ) values (
      'IN_APP', u.recipient, u.id, null, 'KSH_IMPORT_SUMMARY', v_payload,
      'KSH_IMPORT_SUMMARY:' || u.id::text, null, 'PENDING'
    )
    on conflict (dedup_key) where dedup_key is not null
    do update set
      payload = excluded.payload,
      recipient = excluded.recipient,
      read_at = null,
      status = 'PENDING',
      error = null,
      sent_at = null,
      created_at = now();
  end loop;

  return v_id;
end;
$$;

revoke all on function public.ksh_import_summary_publish(uuid, uuid, int, text, text)
  from public, anon, authenticated;

comment on function public.ksh_import_summary_publish(uuid, uuid, int, text, text) is
  '#594: migawka + jedno IN_APP KSH_IMPORT_SUMMARY na konto HHL/SCX/KSH projektu.';

-- ---------------------------------------------------------------------------
-- 7. Trigger po zapisie stats (import_schedule kończy update)
-- ---------------------------------------------------------------------------
create or replace function public.trg_ksh_import_summary_on_stats()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n int;
begin
  if tg_op is distinct from 'UPDATE' then
    return new;
  end if;
  if new.stats is not distinct from old.stats then
    return new;
  end if;
  -- p_quiet: import bez powiadomień (IQ-426 / SCHEDULE_IMPORT_QUIET)
  if coalesce((new.stats->>'quiet')::boolean, false) is true then
    return new;
  end if;
  v_n := coalesce((new.stats->>'added')::int, 0)
       + coalesce((new.stats->>'changed')::int, 0)
       + coalesce((new.stats->>'cancelled')::int, 0);
  if v_n > 0 then
    perform public.ksh_import_summary_publish(
      new.project_id, new.id, new.version, new.file_name, new.file_hash
    );
  end if;
  return new;
end;
$$;

revoke all on function public.trg_ksh_import_summary_on_stats() from public, anon, authenticated;

drop trigger if exists trg_ksh_import_summary_on_stats on public.schedule_imports;
create trigger trg_ksh_import_summary_on_stats
  after update of stats on public.schedule_imports
  for each row execute function public.trg_ksh_import_summary_on_stats();

-- ---------------------------------------------------------------------------
-- 8. RPC odczytu z filtrem pól
-- ---------------------------------------------------------------------------
create or replace function public.ksh_import_summary_get(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  s public.ksh_import_summaries%rowtype;
  v_me uuid := public.current_app_user_id();
  v_kind text;
  v_org uuid;
  v_out jsonb := '[]'::jsonb;
  c jsonb;
  v_field text;
  v_ok boolean;
begin
  if p_id is null or v_me is null then
    return null;
  end if;
  select * into s from public.ksh_import_summaries where id = p_id;
  if not found then
    return null;
  end if;

  select o.kind::text, o.id into v_kind, v_org
    from public.app_users u
    join public.organizations o on o.id = u.org_id
   where u.id = v_me and u.active;
  if v_kind is null then
    return null;
  end if;

  -- Dostęp: HHL; KSH projektu; SCX z transportem w projekcie
  if v_kind = 'FORWARDER' then
    null;
  elsif v_kind = 'CLIENT' then
    if not exists (
      select 1 from public.projects pr
       where pr.id = s.project_id and pr.client_org_id = v_org
    ) then
      return null;
    end if;
  elsif v_kind = 'CARRIER' then
    if not exists (
      select 1 from public.loads l
       where l.project_id = s.project_id and l.carrier_org_id = v_org
    ) then
      return null;
    end if;
  else
    return null;
  end if;

  for c in select * from jsonb_array_elements(coalesce(s.changes, '[]'::jsonb))
  loop
    v_field := c->>'field';
    if v_field is null or btrim(v_field) = '' then
      v_ok := true; -- added / missing
    else
      v_ok := public.ksh_import_summary_field_visible(v_field);
    end if;
    if v_ok is true then
      v_out := v_out || c;
    end if;
  end loop;

  -- Wiersz transportu, w którym zostały same niewidoczne pola — już pominięty (per pole).
  -- Gdy po filtrze brak wierszy: i tak zwróć nagłówek (puste changes).
  return jsonb_build_object(
    'id', s.id,
    'project_id', s.project_id,
    'imported_at', s.imported_at,
    'file_name', s.file_name,
    'stats', s.stats,
    'changes', v_out,
    'n', jsonb_array_length(v_out)
  );
end;
$$;

revoke all on function public.ksh_import_summary_get(uuid) from public, anon;
grant execute on function public.ksh_import_summary_get(uuid) to authenticated;
comment on function public.ksh_import_summary_get(uuid) is
  '#594: odczyt migawki importu KSH z filtrem pól wg roli; Podgląd OK (tylko odczyt).';

commit;
