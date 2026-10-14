-- TOWER — Migracja 0205: P4 E25 — kody READY_TO_INVOICE / INVOICED; RPC ręcznej zmiany statusu.
-- UNLOADED zostaje w enum (historia); nowe zapisy i ręczne „Dostarczone” = DELIVERED.
-- Dane jednorazowe SG-01 UNLOADED→DELIVERED — po potwierdzeniu daty przez HHL (§5), nie w tej migracji.

alter type public.load_status add value if not exists 'READY_TO_INVOICE' after 'DELIVERED';
alter type public.load_status add value if not exists 'INVOICED' after 'READY_TO_INVOICE';

comment on type public.load_status is
  'E25: PLANNED…DELIVERED + READY_TO_INVOICE + INVOICED; UNLOADED = historyczny synonim Dostarczone.';

-- Kolejność statusów (do przodu dla SCX; HHL_ADMIN może cofnąć z powodem).
-- Porównanie przez ::text: nowe wartości enum w tej samej transakcji co ALTER TYPE
-- (Postgres 55P04 „unsafe use of new value” przy case na typie enum).
create or replace function public.load_status_rank(p_status load_status)
returns int
language sql immutable parallel safe set search_path = public as $$
  select case p_status::text
    when 'PLANNED' then 10
    when 'RESOURCES_PENDING' then 20
    when 'DOCS_PENDING' then 30
    when 'READY' then 40
    when 'AT_LOADING' then 50
    when 'IN_TRANSIT_PL' then 60
    when 'AT_PORT_GDANSK' then 70
    when 'FERRY' then 80
    when 'AT_PORT_NYNASHAMN' then 90
    when 'IN_TRANSIT_SE' then 100
    when 'AT_SITE' then 110
    when 'UNLOADED' then 120
    when 'DELIVERED' then 120
    when 'READY_TO_INVOICE' then 130
    when 'INVOICED' then 140
    when 'CANCELLED' then 999
    else 0
  end;
$$;

revoke all on function public.load_status_rank(load_status) from public, anon;
grant execute on function public.load_status_rank(load_status) to authenticated;

-- H1 (D-20261014-0640-01): STATUS_READY_TO_INVOICE / STATUS_INVOICED w CHECK
-- (pełna lista jak 0061 + dwa nowe typy z load_status_set).
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
    'PLAN_DATES_CONFIRMED', 'PLAN_DATES_CHANGED'
));

create or replace function public.load_status_set(
  p_load uuid,
  p_status text,
  p_occurred_at timestamptz,
  p_note text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid;
  v_role text;
  v_org uuid;
  v_load loads%rowtype;
  v_new load_status;
  v_when timestamptz;
  v_note text := nullif(trim(coalesce(p_note, '')), '');
  v_actor text;
  v_prev_at timestamptz;
begin
  select id, role::text, org_id into v_me, v_role, v_org
    from app_users where auth_id = auth.uid() and active;
  if (v_me is not null) is not true then
    raise exception 'Brak aktywnego konta' using errcode = '42501';
  end if;
  if (v_role in ('HHL_ADMIN', 'CARRIER_DISPATCH', 'CARRIER_USER')) is not true then
    raise exception 'Zmiana statusu — tylko Administrator HHL albo SCX' using errcode = '42501';
  end if;

  if (p_load is not null) is not true then
    raise exception 'Brak transportu' using errcode = '22023';
  end if;
  if (p_status is not null and length(trim(p_status)) > 0) is not true then
    raise exception 'Brak statusu' using errcode = '22023';
  end if;

  begin
    v_new := trim(p_status)::load_status;
  exception when others then
    raise exception 'Nieznany status' using errcode = '22023';
  end;

  if v_new = 'UNLOADED' then
    v_new := 'DELIVERED';
  end if;

  v_when := coalesce(p_occurred_at, now());
  if v_when > now() + interval '1 minute' then
    raise exception 'Czas statusu nie może być w przyszłości' using errcode = '22023';
  end if;

  select * into v_load from loads where id = p_load for update;
  if not found then
    raise exception 'Nieznany transport' using errcode = 'P0002';
  end if;

  if v_role in ('CARRIER_DISPATCH', 'CARRIER_USER') then
    if (v_load.carrier_org_id is not null and v_load.carrier_org_id = v_org) is not true then
      raise exception 'Status — tylko własny transport SCX' using errcode = '42501';
    end if;
    if v_new = 'CANCELLED' then
      raise exception 'Anulowanie — tylko Administrator HHL' using errcode = '42501';
    end if;
    if public.load_status_rank(v_new) < public.load_status_rank(v_load.status) then
      raise exception 'SCX zmienia status tylko do przodu' using errcode = '22023';
    end if;
  end if;

  if v_new = 'CANCELLED' and (v_note is not null) is not true then
    raise exception 'Anulowanie wymaga powodu' using errcode = '22023';
  end if;

  if public.load_status_rank(v_new) < public.load_status_rank(v_load.status)
     and v_role = 'HHL_ADMIN'
     and (v_note is not null) is not true then
    raise exception 'Cofnięcie statusu wymaga powodu' using errcode = '22023';
  end if;

  if v_load.status is not distinct from v_new then
    return;
  end if;

  -- H2: nie wcześniej niż poprzedni status (STATUS_* / STATUS_AUTO)
  select max(occurred_at) into v_prev_at
    from load_events
   where load_id = p_load
     and event_type like 'STATUS_%';
  if v_prev_at is not null and v_when < v_prev_at then
    raise exception 'Czas statusu nie wcześniej niż poprzedni status' using errcode = '22023';
  end if;

  select coalesce(nullif(btrim(u.full_name), ''), split_part(u.email::text, '@', 1), '—')
         || ' // ' || coalesce(nullif(btrim(o.name), ''), nullif(btrim(o.code), ''), '—')
    into v_actor
    from app_users u
    left join organizations o on o.id = u.org_id
   where u.id = v_me;

  -- ANEKS 3 §2.1 / guard_load_update: CANCELLED tylko z tower.cancel_ctx (IMPORT|MANUAL)
  if v_new = 'CANCELLED' then
    perform set_config('tower.cancel_ctx', 'MANUAL', true);
  end if;

  update loads
     set status = v_new,
         actual_delivery_at = case
           when v_new = 'DELIVERED' then coalesce(actual_delivery_at, v_when)
           else actual_delivery_at
         end,
         updated_at = now()
   where id = p_load;

  insert into load_events (load_id, event_type, occurred_at, payload)
  values (
    p_load,
    'STATUS_' || v_new::text,
    v_when,
    jsonb_build_object(
      'actor', v_actor,
      'actor_user_id', v_me,
      'from', v_load.status::text,
      'to', v_new::text,
      'note', v_note,
      'manual', true
    )
  );

  insert into audit_log (user_id, action, entity, entity_id, old_value, new_value)
  values (
    v_me,
    'LOAD_STATUS_SET',
    'loads',
    p_load::text,
    jsonb_build_object('status', v_load.status::text),
    jsonb_build_object('status', v_new::text, 'occurred_at', v_when, 'note', v_note)
  );
end $$;

revoke all on function public.load_status_set(uuid, text, timestamptz, text) from public, anon;
grant execute on function public.load_status_set(uuid, text, timestamptz, text) to authenticated;

comment on function public.load_status_set(uuid, text, timestamptz, text) is
  'E25: ręczna zmiana statusu z czasem; HHL_ADMIN + SCX; UNLOADED→DELIVERED.';
