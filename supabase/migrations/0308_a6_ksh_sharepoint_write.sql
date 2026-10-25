-- A6 · SharePoint zapis WT→plik (D-20261019-1420-01): kolejka outbound + konflikt.
-- KSH_ROW_GONE już z import_schedule (l1b_note_row_gone). write_enabled w 0304.
begin;

alter table public.load_events drop constraint if exists load_events_event_type_known;
alter table public.load_events add constraint load_events_event_type_known check (event_type in (
    'NOTE', 'DOC_UPLOADED', 'PERMIT_MISMATCH', 'AWIZACJA_UPDATED', 'RESOURCES_UPDATED', 'ORDER_NO_UPDATED',
    'FERRY_UPDATED', 'SAILING_ASSIGNED', 'SCX_ASSIGNED', 'PLAN_B_ACTIVATED', 'READY_BLOCKED',
    'SCHEDULE_IMPORTED', 'SCHEDULE_DATE_CRITICAL', 'STATUS_APPROACHING_SITE', 'STATUS_AT_LOADING',
    'STATUS_AT_PORT', 'STATUS_AT_PORT_GDANSK', 'STATUS_AT_PORT_NYNASHAMN', 'STATUS_AT_SITE',
    'STATUS_CANCELLED', 'STATUS_DELAYED', 'STATUS_DELIVERED', 'STATUS_DOCS_PENDING', 'STATUS_DOC_MISSING',
    'STATUS_FERRY', 'STATUS_IN_TRANSIT_PL', 'STATUS_IN_TRANSIT_SE', 'STATUS_LOADING', 'STATUS_ON_FERRY',
    'STATUS_PLANNED', 'STATUS_READY', 'STATUS_RESOURCES_PENDING', 'STATUS_SILENT', 'STATUS_UNLOADED',
    'STATUS_UNLOADING', 'STATUS_READY_TO_INVOICE', 'STATUS_INVOICED',
    'MILESTONE_LOADED', 'MILESTONE_UNLOADED', 'DRIVER_ON_FERRY', 'DRIVER_PROBLEM',
    'GEOFENCE_ENTER', 'GEOFENCE_EXIT', 'GEOFENCE_DWELL', 'STATUS_AUTO', 'POSITION_SHARED',
    'POSITION_SHARE_DENIED', 'DELAY_DETECTED', 'RISK_RAISED', 'SILENT_VEHICLE',
    'PLAN_DATES_CONFIRMED', 'PLAN_DATES_CHANGED', 'DECISION_HOLD', 'PILOTS_SET',
    'DECISION_EFFECT', 'DECISION_SAILING', 'DECISION_KEEP_TOWER',
    'KSH_FILE_OUTBOUND'
));

-- ---------------------------------------------------------------------
-- 1. Kolejka zapisów (daty G-20 + numery E38)
-- ---------------------------------------------------------------------
create table if not exists public.ksh_sync_outbound (
  id bigserial primary key,
  project_id uuid not null references public.projects (id) on delete cascade,
  load_id uuid not null references public.loads (id) on delete cascade,
  shipment_code text not null,
  -- Pola do zapisu (ISO daty, HH:MM, numery) — bez nazwisk/telefonów.
  patch jsonb not null,
  -- Migawka dat/godzin w pliku w chwili enqueue (konflikt = plik ≠ expected).
  expected_file jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'done', 'conflict', 'skipped')),
  created_at timestamptz not null default now(),
  created_by uuid references public.app_users (id),
  done_at timestamptz,
  last_error text
);

create index if not exists ksh_sync_outbound_pending_idx
  on public.ksh_sync_outbound (project_id, id)
  where status = 'pending';

comment on table public.ksh_sync_outbound is
  'A6 E38: kolejka WT→plik KSH (daty/godziny + numery). Bez PII.';

alter table public.ksh_sync_outbound enable row level security;
revoke all on table public.ksh_sync_outbound from public, anon;
grant select on table public.ksh_sync_outbound to authenticated;
grant select, insert, update on table public.ksh_sync_outbound to service_role;

drop policy if exists ksh_sync_outbound_hhl_read on public.ksh_sync_outbound;
create policy ksh_sync_outbound_hhl_read on public.ksh_sync_outbound
  for select to authenticated
  using (public.is_hhl() is true);

-- ---------------------------------------------------------------------
-- 2. Enqueue (z wyzwalacza dat / numerów — nie z importu)
-- ---------------------------------------------------------------------
create or replace function public.ksh_sync_outbound_enqueue(
  p_load uuid,
  p_patch jsonb,
  p_expected_file jsonb default null
) returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_proj uuid;
  v_code text;
  v_actor uuid;
  v_id bigint;
begin
  if p_load is null or p_patch is null or jsonb_typeof(p_patch) is distinct from 'object' then
    raise exception 'Brak transportu albo łatki' using errcode = '22023';
  end if;
  select l.project_id, public.load_sms_code(l.id), current_app_user_id()
    into v_proj, v_code, v_actor
    from loads l where l.id = p_load;
  if v_proj is null then
    raise exception 'Nieznany transport' using errcode = '22023';
  end if;
  -- Jeden pending na load: nadpisz łatę (ostatnia wygrywa).
  update public.ksh_sync_outbound
     set patch = p_patch,
         expected_file = coalesce(p_expected_file, expected_file),
         created_at = now(),
         created_by = v_actor,
         last_error = null
   where load_id = p_load and status = 'pending'
  returning id into v_id;
  if v_id is not null then
    return v_id;
  end if;
  insert into public.ksh_sync_outbound (
    project_id, load_id, shipment_code, patch, expected_file, created_by
  ) values (
    v_proj, p_load, coalesce(nullif(btrim(v_code), ''), p_load::text),
    p_patch, p_expected_file, v_actor
  ) returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.ksh_sync_outbound_enqueue(uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.ksh_sync_outbound_enqueue(uuid, jsonb, jsonb) to service_role;

-- Edge: lista pending (bez PII poza kodem transportu).
create or replace function public.ksh_sync_outbound_list(p_project uuid, p_limit int default 50)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := coalesce(auth.jwt() ->> 'role', '');
begin
  if v_role is distinct from 'service_role' then
    raise exception 'Tylko synchronizacja' using errcode = '42501';
  end if;
  if p_project is null then
    return '[]'::jsonb;
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', o.id,
      'load_id', o.load_id,
      'code', o.shipment_code,
      'patch', o.patch,
      'expected_file', o.expected_file
    ) order by o.id)
    from (
      select * from public.ksh_sync_outbound
       where project_id = p_project and status = 'pending'
       order by id
       limit greatest(1, least(coalesce(p_limit, 50), 200))
    ) o
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.ksh_sync_outbound_list(uuid, int) from public, anon, authenticated;
grant execute on function public.ksh_sync_outbound_list(uuid, int) to service_role;

create or replace function public.ksh_sync_outbound_ack(
  p_ids bigint[],
  p_status text,
  p_error text default null
) returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := coalesce(auth.jwt() ->> 'role', '');
  n int;
begin
  if v_role is distinct from 'service_role' then
    raise exception 'Tylko synchronizacja' using errcode = '42501';
  end if;
  if (p_status in ('done', 'conflict', 'skipped')) is not true then
    raise exception 'Zły status' using errcode = '22023';
  end if;
  update public.ksh_sync_outbound
     set status = p_status,
         done_at = now(),
         last_error = left(p_error, 500)
   where id = any (p_ids) and status = 'pending';
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.ksh_sync_outbound_ack(bigint[], text, text) from public, anon, authenticated;
grant execute on function public.ksh_sync_outbound_ack(bigint[], text, text) to service_role;

-- Sprawa: plik zmienił się od odczytu (nie nadpisuj).
create or replace function public.l1b_note_file_changed(
  p_project uuid, p_load uuid, p_code text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_project is null or p_load is null or nullif(btrim(p_code), '') is null then
    return null;
  end if;
  return decision_open_from_event(
    p_project, 'TOWER_KSH_CONFLICT',
    'l1b:file-changed:' || p_project::text || ':' || btrim(p_code),
    'Plik KSH zmieniony — sprawdź',
    jsonb_build_object('code', btrim(p_code), 'reason', 'file_changed_since_read'),
    p_load, null
  );
end;
$$;

revoke all on function public.l1b_note_file_changed(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.l1b_note_file_changed(uuid, uuid, text) to service_role;

-- ---------------------------------------------------------------------
-- 3. Wyzwalacz: daty (dates_ctx) i numery zleceń (poza importem)
-- ---------------------------------------------------------------------
create or replace function public.trg_ksh_sync_outbound() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_patch jsonb := '{}'::jsonb;
  v_exp jsonb;
  v_snap jsonb;
  v_code text;
begin
  if current_setting('tower.import_ctx', true) = 'on' then
    return new;
  end if;

  if current_setting('tower.dates_ctx', true) = 'on' then
    if (new.plan_load_date, new.plan_load_from, new.plan_load_to,
        new.plan_delivery_date, new.plan_delivery_from, new.plan_delivery_to)
       is distinct from
       (old.plan_load_date, old.plan_load_from, old.plan_load_to,
        old.plan_delivery_date, old.plan_delivery_from, old.plan_delivery_to)
    then
      v_patch := v_patch || jsonb_build_object(
        'load_date', new.plan_load_date,
        'load_time', case when new.plan_load_from is null then null
          else to_char(new.plan_load_from at time zone 'Europe/Warsaw', 'HH24:MI') end,
        'delivery_date', new.plan_delivery_date,
        'delivery_time', case when new.plan_delivery_from is null then null
          else to_char(new.plan_delivery_from at time zone 'Europe/Warsaw', 'HH24:MI') end
      );
    end if;
  end if;

  if (new.carrier_order_no, new.hhl_order_no) is distinct from (old.carrier_order_no, old.hhl_order_no) then
    v_patch := v_patch || jsonb_build_object(
      'carrier_order_no', new.carrier_order_no,
      'hhl_order_no', new.hhl_order_no
    );
  end if;

  if v_patch = '{}'::jsonb then
    return new;
  end if;

  v_code := public.load_sms_code(new.id);
  select s.snapshot -> v_code into v_snap
    from public.ksh_sync_state s where s.project_id = new.project_id;
  if v_snap is not null then
    v_exp := v_snap;
  end if;

  perform public.ksh_sync_outbound_enqueue(new.id, v_patch, v_exp);

  insert into load_events (load_id, event_type, occurred_at, actor_id, payload)
  values (
    new.id, 'KSH_FILE_OUTBOUND', now(), current_app_user_id(),
    jsonb_build_object(
      'code', v_code,
      'before', jsonb_build_object(
        'load_date', old.plan_load_date,
        'delivery_date', old.plan_delivery_date,
        'carrier_order_no', old.carrier_order_no,
        'hhl_order_no', old.hhl_order_no
      ),
      'after', v_patch
    )
  );

  return new;
end;
$$;

drop trigger if exists trg_ksh_sync_outbound on public.loads;
create trigger trg_ksh_sync_outbound
  after update of
    plan_load_date, plan_load_from, plan_load_to,
    plan_delivery_date, plan_delivery_from, plan_delivery_to,
    carrier_order_no, hhl_order_no
  on public.loads
  for each row
  execute function public.trg_ksh_sync_outbound();

comment on function public.trg_ksh_sync_outbound() is
  'A6 G-20: kolejka zapisu do pliku KSH po zmianie dat (dates_ctx) lub numerów; nie przy import_ctx.';

commit;
