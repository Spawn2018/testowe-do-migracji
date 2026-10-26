-- A6 · SharePoint zapis WT→plik (D-20261019-1420-01): kolejka outbound + konflikt.
-- F7 #560: If-Match/etag, import_ctx przy zasobach, plan_delivery_to, schedule_row po PUT,
-- patch||, unikalny pending, próby/failed, historia przy done, STEGRA_*.
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
  patch jsonb not null,
  expected_file jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'done', 'conflict', 'skipped', 'failed')),
  attempts int not null default 0,
  created_at timestamptz not null default now(),
  created_by uuid references public.app_users (id),
  done_at timestamptz,
  last_error text
);

-- F7: status failed + attempts (gdy tabela powstała wcześniej bez kolumn).
alter table public.ksh_sync_outbound drop constraint if exists ksh_sync_outbound_status_check;
alter table public.ksh_sync_outbound
  add constraint ksh_sync_outbound_status_check
  check (status in ('pending', 'done', 'conflict', 'skipped', 'failed'));
alter table public.ksh_sync_outbound
  add column if not exists attempts int not null default 0;
-- F7 r3 N4: wersja wiersza (list→PUT→ack); podbijana przy każdej zmianie pending.
alter table public.ksh_sync_outbound
  add column if not exists rev int not null default 1;
comment on column public.ksh_sync_outbound.rev is
  'A6 F7 N4: wersja kolejki; ack(id,rev,sent); przy rozjeździe → pending z różnicą WT≠sent.';

create index if not exists ksh_sync_outbound_pending_idx
  on public.ksh_sync_outbound (project_id, id)
  where status = 'pending';

-- F7 BLOKER 5: jeden pending na load + scalanie łat.
create unique index if not exists ksh_sync_outbound_one_pending_uidx
  on public.ksh_sync_outbound (load_id)
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

-- service_role jak 0304/0305 (brama lokalna bez auth.jwt()).
create or replace function public.ksh_sync_require_service()
returns void
language plpgsql
stable
set search_path = public
as $$
declare
  v_jwt_role text;
begin
  if session_user in ('postgres', 'supabase_admin') then
    return;
  end if;
  begin
    if to_regprocedure('auth.role()') is not null then
      execute 'select auth.role()' into v_jwt_role;
    else
      v_jwt_role := nullif(current_setting('request.jwt.claim.role', true), '');
    end if;
  exception when others then
    v_jwt_role := null;
  end;
  if (coalesce(v_jwt_role, '') = 'service_role') is not true then
    raise exception 'Tylko synchronizacja' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.ksh_sync_require_service() from public, anon, authenticated;
grant execute on function public.ksh_sync_require_service() to service_role;

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
  if p_patch = '{}'::jsonb then
    return null;
  end if;
  select l.project_id, public.load_sms_code(l.id), current_app_user_id()
    into v_proj, v_code, v_actor
    from loads l where l.id = p_load;
  if v_proj is null then
    raise exception 'Nieznany transport' using errcode = '22023';
  end if;
  -- F7 BLOKER 5: patch = patch || p_patch; ON CONFLICT na unikalnym pending.
  insert into public.ksh_sync_outbound (
    project_id, load_id, shipment_code, patch, expected_file, created_by
  ) values (
    v_proj, p_load, coalesce(nullif(btrim(v_code), ''), p_load::text),
    p_patch, p_expected_file, v_actor
  )
  on conflict (load_id) where (status = 'pending')
  do update set
    patch = public.ksh_sync_outbound.patch || excluded.patch,
    -- F7 r2: zachowaj najstarszą migawkę (existing, nie excluded).
    expected_file = coalesce(public.ksh_sync_outbound.expected_file, excluded.expected_file),
    shipment_code = excluded.shipment_code,
    created_at = now(),
    created_by = excluded.created_by,
    last_error = null,
    rev = public.ksh_sync_outbound.rev + 1
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.ksh_sync_outbound_enqueue(uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.ksh_sync_outbound_enqueue(uuid, jsonb, jsonb) to service_role;

-- Edge: lista pending (bez PII poza kodem transportu) + wszystkie kody SI.
create or replace function public.ksh_sync_outbound_list(p_project uuid, p_limit int default 50)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.ksh_sync_require_service();
  if p_project is null then
    return '[]'::jsonb;
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', o.id,
      'load_id', o.load_id,
      'code', o.shipment_code,
      'codes', coalesce((
        select jsonb_agg(si.shipment_code order by si.shipment_code)
          from public.shipment_items si
         where si.load_id = o.load_id
           and nullif(btrim(si.shipment_code), '') is not null
      ), jsonb_build_array(o.shipment_code)),
      'patch', o.patch,
      'expected_file', o.expected_file,
      'attempts', o.attempts,
      'rev', o.rev
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

-- F7 r3 N4: ack przyjmuje pary (id, rev, sent); done tylko przy zgodnym rev.
drop function if exists public.ksh_sync_outbound_ack(bigint[], text, text);

create or replace function public.ksh_sync_outbound_apply_sent(p_exp jsonb, p_sent jsonb)
returns jsonb
language plpgsql
immutable
set search_path = public
as $$
declare
  v jsonb := coalesce(p_exp, '{}'::jsonb);
begin
  if p_sent is null or jsonb_typeof(p_sent) is distinct from 'object' then
    return v;
  end if;
  if p_sent ? 'load_date' then
    v := jsonb_set(v, '{ld}', coalesce(to_jsonb(p_sent->>'load_date'), 'null'::jsonb));
  end if;
  if p_sent ? 'load_time' then
    v := jsonb_set(v, '{lt}', coalesce(to_jsonb(p_sent->>'load_time'), 'null'::jsonb));
  end if;
  if p_sent ? 'delivery_date' then
    v := jsonb_set(v, '{dd}', coalesce(to_jsonb(p_sent->>'delivery_date'), 'null'::jsonb));
  end if;
  if p_sent ? 'delivery_time' then
    v := jsonb_set(v, '{dt}', coalesce(to_jsonb(p_sent->>'delivery_time'), 'null'::jsonb));
  end if;
  if p_sent ? 'carrier_order_no' then
    v := jsonb_set(v, '{co}', coalesce(to_jsonb(p_sent->>'carrier_order_no'), 'null'::jsonb));
  end if;
  if p_sent ? 'hhl_order_no' then
    v := jsonb_set(v, '{ho}', coalesce(to_jsonb(p_sent->>'hhl_order_no'), 'null'::jsonb));
  end if;
  return v;
end;
$$;

revoke all on function public.ksh_sync_outbound_apply_sent(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.ksh_sync_outbound_apply_sent(jsonb, jsonb) to service_role;

-- Różnica WT ↔ stan pliku po sent (klucze outbound); NULL nie czyści komórki.
create or replace function public.ksh_sync_outbound_wt_diff(p_load uuid, p_file jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  l record;
  v_patch jsonb := '{}'::jsonb;
  v_lt text;
  v_dt text;
  v_co text;
  v_ho text;
begin
  select * into l from public.loads where id = p_load;
  if l.id is null then
    return '{}'::jsonb;
  end if;
  v_co := nullif(btrim(l.carrier_order_no), '');
  v_ho := nullif(btrim(l.hhl_order_no), '');
  if l.plan_load_from is not null then
    v_lt := to_char(l.plan_load_from at time zone 'Europe/Warsaw', 'HH24:MI');
  end if;
  if l.plan_delivery_to is not null then
    v_dt := to_char(l.plan_delivery_to at time zone 'Europe/Stockholm', 'HH24:MI');
  end if;

  if l.plan_load_date is not null
     and (p_file->>'ld') is distinct from l.plan_load_date::text then
    v_patch := v_patch || jsonb_build_object('load_date', l.plan_load_date);
  end if;
  if v_lt is not null and (p_file->>'lt') is distinct from v_lt then
    v_patch := v_patch || jsonb_build_object('load_time', v_lt);
  end if;
  if l.plan_delivery_date is not null
     and (p_file->>'dd') is distinct from l.plan_delivery_date::text then
    v_patch := v_patch || jsonb_build_object('delivery_date', l.plan_delivery_date);
  end if;
  if v_dt is not null and (p_file->>'dt') is distinct from v_dt then
    v_patch := v_patch || jsonb_build_object('delivery_time', v_dt);
  end if;
  if v_co is not null and (p_file->>'co') is distinct from v_co then
    v_patch := v_patch || jsonb_build_object('carrier_order_no', v_co);
  end if;
  if v_ho is not null and (p_file->>'ho') is distinct from v_ho then
    v_patch := v_patch || jsonb_build_object('hhl_order_no', v_ho);
  end if;
  return v_patch;
end;
$$;

revoke all on function public.ksh_sync_outbound_wt_diff(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.ksh_sync_outbound_wt_diff(uuid, jsonb) to service_role;

create or replace function public.ksh_sync_outbound_ack(
  p_acks jsonb,
  p_status text,
  p_error text default null
) returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  n int := 0;
  a jsonb;
  v_id bigint;
  v_rev int;
  v_sent jsonb;
  r record;
  v_patch jsonb;
  v_code text;
  v_file jsonb;
  v_diff jsonb;
begin
  perform public.ksh_sync_require_service();
  if (p_status in ('done', 'conflict', 'skipped', 'failed')) is not true then
    raise exception 'Zły status' using errcode = '22023';
  end if;
  if p_acks is null or jsonb_typeof(p_acks) is distinct from 'array'
     or jsonb_array_length(p_acks) = 0 then
    return 0;
  end if;

  for a in select value from jsonb_array_elements(p_acks)
  loop
    v_id := nullif(a->>'id', '')::bigint;
    v_rev := nullif(a->>'rev', '')::int;
    v_sent := case
      when a ? 'sent' and jsonb_typeof(a->'sent') = 'object' then a->'sent'
      else null
    end;
    if v_id is null or v_rev is null then
      continue;
    end if;

    select o.* into r from public.ksh_sync_outbound o where o.id = v_id;
    if r.id is null then
      continue;
    end if;

    -- F7 r3 N4: rozjazd rev przy done → pending z różnicą WT≠sent, expected_file z sent.
    if p_status = 'done' and r.rev is distinct from v_rev then
      v_file := public.ksh_sync_outbound_apply_sent(r.expected_file, coalesce(v_sent, '{}'::jsonb));
      v_diff := public.ksh_sync_outbound_wt_diff(r.load_id, v_file);
      if v_diff = '{}'::jsonb then
        update public.ksh_sync_outbound
           set status = 'skipped',
               done_at = now(),
               last_error = 'rev_mismatch_empty',
               expected_file = v_file,
               patch = '{}'::jsonb,
               rev = rev + 1
         where id = r.id;
      else
        update public.ksh_sync_outbound
           set status = 'pending',
               done_at = null,
               last_error = 'rev_mismatch',
               expected_file = v_file,
               patch = v_diff,
               rev = rev + 1
         where id = r.id;
      end if;
      n := n + 1;
      continue;
    end if;

    -- conflict / skipped / failed / done przy zgodnym rev — tylko pending.
    if (r.status = 'pending' and r.rev is not distinct from v_rev) is not true then
      continue;
    end if;

    if p_status = 'failed' then
      update public.ksh_sync_outbound
         set attempts = attempts + 1,
             last_error = left(p_error, 500),
             status = case when attempts + 1 >= 5 then 'failed' else status end,
             done_at = case when attempts + 1 >= 5 then now() else done_at end,
             rev = rev + 1
       where id = r.id and status = 'pending' and rev = v_rev;
      if found then
        n := n + 1;
      end if;
      continue;
    end if;

    update public.ksh_sync_outbound
       set status = p_status,
           done_at = now(),
           last_error = left(p_error, 500),
           rev = rev + 1
     where id = r.id and status = 'pending' and rev = v_rev;
    if not found then
      continue;
    end if;
    n := n + 1;

    -- F7 N4: schedule_row z sent (to, co Edge zapisał), nie z bieżącego patch.
    if p_status = 'done' then
      v_patch := coalesce(v_sent, r.patch, '{}'::jsonb);
      update public.shipment_items si
         set schedule_row = coalesce(si.schedule_row, '{}'::jsonb)
           || jsonb_strip_nulls(jsonb_build_object(
                'load_date', v_patch->'load_date',
                'load_time', v_patch->'load_time',
                'delivery_date', v_patch->'delivery_date',
                'delivery_time', v_patch->'delivery_time',
                'carrier_order_no', v_patch->'carrier_order_no',
                'hhl_order_no', v_patch->'hhl_order_no',
                'scxOrderNo', v_patch->'carrier_order_no',
                'hhlOrderNo', v_patch->'hhl_order_no'
              )),
             updated_at = now()
       where si.load_id = r.load_id;

      v_code := r.shipment_code;
      insert into load_events (load_id, event_type, occurred_at, actor_id, payload)
      values (
        r.load_id, 'KSH_FILE_OUTBOUND', now(), r.created_by,
        jsonb_build_object('code', v_code, 'after', v_patch, 'outbound_id', r.id)
      );
    end if;
  end loop;
  return n;
end;
$$;

revoke all on function public.ksh_sync_outbound_ack(jsonb, text, text) from public, anon, authenticated;
grant execute on function public.ksh_sync_outbound_ack(jsonb, text, text) to service_role;

-- Sprawa: plik zmienił się od odczytu (nie nadpisuj).
create or replace function public.l1b_note_file_changed(
  p_project uuid, p_load uuid, p_code text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.ksh_sync_require_service();
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

-- Ryzyko po 5 nieudanych próbach zapisu.
create or replace function public.l1b_note_outbound_failed(
  p_project uuid, p_load uuid, p_code text, p_reason text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.ksh_sync_require_service();
  if p_project is null or p_load is null or nullif(btrim(p_code), '') is null then
    return null;
  end if;
  return decision_open_from_event(
    p_project, 'TOWER_KSH_CONFLICT',
    'l1b:outbound-failed:' || p_project::text || ':' || btrim(p_code),
    'Zapis do pliku KSH nieudany',
    jsonb_build_object(
      'code', btrim(p_code),
      'reason', left(coalesce(p_reason, 'outbound_failed'), 120)
    ),
    p_load, null
  );
end;
$$;

revoke all on function public.l1b_note_outbound_failed(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.l1b_note_outbound_failed(uuid, uuid, text, text) to service_role;

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
  v_clear text[] := '{}'::text[];
  v_exp jsonb;
  v_snap jsonb;
  v_code text;
  v_proj_code text;
  v_load_time text;
  v_deliv_time text;
  v_k text;
begin
  if current_setting('tower.import_ctx', true) = 'on' then
    return new;
  end if;

  -- F7: tylko projekt KSH–Stegra.
  select p.code into v_proj_code from public.projects p where p.id = new.project_id;
  if (v_proj_code in ('STEGRA_BODEN', 'STEGRA')) is not true then
    return new;
  end if;

  -- F7 r2 BLOKER 4: migawka pliku — pomiń pole gdy nowa wartość = plik (echo TAKE_FILE itd.).
  v_code := public.load_sms_code(new.id);
  select s.snapshot -> v_code into v_snap
    from public.ksh_sync_state s where s.project_id = new.project_id;
  if v_snap is not null then
    v_exp := v_snap;
  end if;

  if current_setting('tower.dates_ctx', true) = 'on' then
    -- Tylko zmienione pola; NULL nie czyści komórki (pomijamy klucz).
    if new.plan_load_date is distinct from old.plan_load_date then
      if new.plan_load_date is not null
         and (v_snap is null or (v_snap->>'ld') is distinct from new.plan_load_date::text) then
        v_patch := v_patch || jsonb_build_object('load_date', new.plan_load_date);
      elsif v_snap is not null
         and (v_snap->>'ld') is not distinct from new.plan_load_date::text then
        -- F7 r2b N1: powrót do wartości z pliku → usuń klucz z pending.
        v_clear := array_append(v_clear, 'load_date');
      end if;
    end if;
    if new.plan_load_from is distinct from old.plan_load_from then
      if new.plan_load_from is not null then
        v_load_time := to_char(new.plan_load_from at time zone 'Europe/Warsaw', 'HH24:MI');
        if (v_snap is null or (v_snap->>'lt') is distinct from v_load_time) then
          v_patch := v_patch || jsonb_build_object('load_time', v_load_time);
        elsif v_snap is not null and (v_snap->>'lt') is not distinct from v_load_time then
          v_clear := array_append(v_clear, 'load_time');
        end if;
      end if;
    end if;
    if new.plan_delivery_date is distinct from old.plan_delivery_date then
      if new.plan_delivery_date is not null
         and (v_snap is null or (v_snap->>'dd') is distinct from new.plan_delivery_date::text) then
        v_patch := v_patch || jsonb_build_object('delivery_date', new.plan_delivery_date);
      elsif v_snap is not null
         and (v_snap->>'dd') is not distinct from new.plan_delivery_date::text then
        v_clear := array_append(v_clear, 'delivery_date');
      end if;
    end if;
    -- F7 BLOKER 3: rozładunek = plan_delivery_to (Europe/Stockholm), nie from.
    if new.plan_delivery_to is distinct from old.plan_delivery_to then
      if new.plan_delivery_to is not null then
        v_deliv_time := to_char(new.plan_delivery_to at time zone 'Europe/Stockholm', 'HH24:MI');
        if (v_snap is null or (v_snap->>'dt') is distinct from v_deliv_time) then
          v_patch := v_patch || jsonb_build_object('delivery_time', v_deliv_time);
        elsif v_snap is not null and (v_snap->>'dt') is not distinct from v_deliv_time then
          v_clear := array_append(v_clear, 'delivery_time');
        end if;
      end if;
    end if;
  end if;

  if new.carrier_order_no is distinct from old.carrier_order_no then
    if nullif(btrim(new.carrier_order_no), '') is not null
       and (v_snap is null or (v_snap->>'co') is distinct from new.carrier_order_no) then
      v_patch := v_patch || jsonb_build_object('carrier_order_no', new.carrier_order_no);
    elsif v_snap is not null
       and (v_snap->>'co') is not distinct from new.carrier_order_no then
      v_clear := array_append(v_clear, 'carrier_order_no');
    end if;
  end if;
  if new.hhl_order_no is distinct from old.hhl_order_no then
    if nullif(btrim(new.hhl_order_no), '') is not null
       and (v_snap is null or (v_snap->>'ho') is distinct from new.hhl_order_no) then
      v_patch := v_patch || jsonb_build_object('hhl_order_no', new.hhl_order_no);
    elsif v_snap is not null
       and (v_snap->>'ho') is not distinct from new.hhl_order_no then
      v_clear := array_append(v_clear, 'hhl_order_no');
    end if;
  end if;

  -- F7 r2b N1: usuń z pending klucze przywrócone do migawki; pusty patch → skipped.
  -- F7 r3 N4: każda zmiana pending podbija rev (wyścig list→PUT→ack).
  if cardinality(v_clear) > 0 then
    foreach v_k in array v_clear loop
      update public.ksh_sync_outbound
         set patch = patch - v_k,
             rev = rev + 1
       where load_id = new.id and status = 'pending' and patch ? v_k;
    end loop;
    update public.ksh_sync_outbound
       set status = 'skipped',
           done_at = now(),
           last_error = 'reverted_to_file',
           rev = rev + 1
     where load_id = new.id and status = 'pending' and patch = '{}'::jsonb;
  end if;

  if v_patch = '{}'::jsonb then
    return new;
  end if;

  perform public.ksh_sync_outbound_enqueue(new.id, v_patch, v_exp);
  -- Historia KSH_FILE_OUTBOUND dopiero przy ack('done') — F7.
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
  'A6 G-20: kolejka zapisu do pliku KSH po zmianie dat (dates_ctx) lub numerów; nie przy import_ctx; STEGRA_*.';

-- F7 r2: write_test_ok_at — prod dopiero po udanym zapisie testowym.
alter table public.ksh_sync_state
  add column if not exists write_test_ok_at timestamptz;
comment on column public.ksh_sync_state.write_test_ok_at is
  'A6 F7: czas udanego PUT w trybie test; bez niego tryb prod nie pisze.';

-- F7: przy włączeniu zapisu — zaległe pending → skipped (bez backlogu).
-- F7 r2: zapis tylko gdy import_enabled = true.
create or replace function public.ksh_sync_write_set(p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid;
  v_role public.user_role;
  v_pid uuid;
  v_import boolean;
begin
  perform public.assert_not_preview();
  select id, role into v_me, v_role
    from public.app_users
   where auth_id = auth.uid() and active;
  if (v_me is not null and v_role = 'HHL_ADMIN' and public.mfa_satisfied(v_role) is true) is not true then
    raise exception 'Tylko Administrator HHL z 2FA' using errcode = '42501';
  end if;
  select id into v_pid from public.projects
   where code in ('STEGRA_BODEN', 'STEGRA')
   order by case code when 'STEGRA_BODEN' then 0 else 1 end
   limit 1;
  if v_pid is null then
    raise exception 'Brak projektu KSH (STEGRA_BODEN)' using errcode = 'P0002';
  end if;
  if p_enabled is true then
    select import_enabled into v_import from public.ksh_sync_state where project_id = v_pid;
    if v_import is not true then
      raise exception 'Włącz najpierw import z pliku' using errcode = '22023';
    end if;
  end if;
  insert into public.ksh_sync_state (project_id, write_enabled)
  values (v_pid, coalesce(p_enabled, false))
  on conflict (project_id) do update
    set write_enabled = excluded.write_enabled, updated_at = now();
  if p_enabled is true then
    update public.ksh_sync_outbound
       set status = 'skipped',
           done_at = now(),
           last_error = 'write_enabled_on',
           rev = rev + 1
     where project_id = v_pid and status = 'pending';
  end if;
  insert into public.audit_log (user_id, action, entity, entity_id, new_value)
  values (
    v_me, 'KSH_SYNC_WRITE_SET', 'ksh_sync_state', v_pid::text,
    jsonb_build_object('write_enabled', coalesce(p_enabled, false))
  );
end;
$$;

revoke all on function public.ksh_sync_write_set(boolean) from public, anon;
grant execute on function public.ksh_sync_write_set(boolean) to authenticated;

comment on function public.ksh_sync_write_set(boolean) is
  'A6: przełącznik zapisu WT→plik; wymaga import_enabled; przy true zaległe pending→skipped; HHL_ADMIN+2FA.';

-- F7 r2b N3: wyłączenie importu wyłącza też zapis + czyści pending (bez zaległości).
create or replace function public.ksh_sync_import_set(p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid;
  v_role public.user_role;
  v_pid uuid;
begin
  perform public.assert_not_preview();
  select id, role into v_me, v_role
    from public.app_users
   where auth_id = auth.uid() and active;
  if (v_me is not null and v_role = 'HHL_ADMIN' and public.mfa_satisfied(v_role) is true) is not true then
    raise exception 'Tylko Administrator HHL z 2FA' using errcode = '42501';
  end if;
  select id into v_pid from public.projects
   where code in ('STEGRA_BODEN', 'STEGRA')
   order by case code when 'STEGRA_BODEN' then 0 else 1 end
   limit 1;
  if v_pid is null then
    raise exception 'Brak projektu KSH (STEGRA_BODEN)' using errcode = 'P0002';
  end if;
  if coalesce(p_enabled, false) is not true then
    insert into public.ksh_sync_state (project_id, import_enabled, write_enabled)
    values (v_pid, false, false)
    on conflict (project_id) do update
      set import_enabled = false,
          write_enabled = false,
          updated_at = now();
    update public.ksh_sync_outbound
       set status = 'skipped',
           done_at = now(),
           last_error = 'import_disabled',
           rev = rev + 1
     where project_id = v_pid and status = 'pending';
  else
    insert into public.ksh_sync_state (project_id, import_enabled)
    values (v_pid, true)
    on conflict (project_id) do update
      set import_enabled = true, updated_at = now();
  end if;
  insert into public.audit_log (user_id, action, entity, entity_id, new_value)
  values (
    v_me, 'KSH_SYNC_IMPORT_SET', 'ksh_sync_state', v_pid::text,
    jsonb_build_object(
      'import_enabled', coalesce(p_enabled, false),
      'write_enabled_cleared', (coalesce(p_enabled, false) is not true)
    )
  );
end;
$$;

revoke all on function public.ksh_sync_import_set(boolean) from public, anon;
grant execute on function public.ksh_sync_import_set(boolean) to authenticated;

comment on function public.ksh_sync_import_set(boolean) is
  'A6 F7: przełącznik importu SharePoint→WT; przy false także write_enabled=false i pending→skipped; HHL_ADMIN+2FA.';

commit;


-- F7 BLOKER 2: import_schedule z import_ctx przy UPDATE zasobów/numerów.
begin;
create or replace FUNCTION public.import_schedule(p_project uuid, p_rows jsonb, p_cancel_codes text[] DEFAULT '{}'::text[], p_file jsonb DEFAULT '{}'::jsonb, p_dry_run boolean DEFAULT true, p_quiet boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  t0          timestamptz := clock_timestamp();
  v_user      uuid;
  v_carrier   uuid;
  v_carrier_n text;
  v_import    uuid;
  v_version   int;
  v_n         int;
  r           record;
  c           record;
  v_load      uuid;
  v_fields    text[];
  v_crit      text[];
  v_added     jsonb := '[]';
  v_changed   jsonb := '[]';
  v_unchanged int := 0;
  v_cands     jsonb := '[]';
  v_blocked   jsonb := '[]';
  v_cancelled jsonb := '[]';
  v_critical  jsonb := '[]';
  v_confirmed jsonb := '[]';
  v_keep      boolean;
  v_over      text[];
  v_skipped   int := 0;
  v_quiet_on  boolean := false;
  v_quiet_fill boolean := false;
  v_prev_quiet text;
  v_historic boolean := false;
  v_cmap jsonb := '{}'::jsonb;
  v_has_hhl_col boolean := false;
  v_run_quiet boolean := false;
  v_prev_run_quiet text;
  v_new_load_date date;
  v_new_del_date date;
  v_new_load_from timestamptz;
  v_new_load_to timestamptz;
  v_new_del_from timestamptz;
  v_new_del_to timestamptz;
  v_today date := (now() at time zone 'Europe/Warsaw')::date;
  v_fnames    text[] := array['item_type','cargo_class','length_m','width_m','height_m','unit_weight_t','qty','total_weight_t',
                              'load_date','load_time','delivery_date','delivery_time','order_no','assembly_seq',
                              'hhl_order_no','carrier_order_no','driver_name','driver_phone',
                              'driver_delivery_name','driver_delivery_phone',
                              'tractor_plate','tractor_delivery_plate','trailer_plate'];
  v_crit_suppressed int := 0;
  v_dates_odd boolean := false;
  v_dates_check_n int := 0;
  v_renum_from text;
  v_stamp text;
  v_res_fields text[] := array['hhl_order_no','carrier_order_no','driver_name','driver_phone',
                               'driver_delivery_name','driver_delivery_phone',
                               'tractor_plate','tractor_delivery_plate','trailer_plate'];
  v_jwt_role text;
  v_service boolean := false;
  v_source text;
  v_hash text;
begin
  perform public.assert_not_preview();
  -- A6/0305: cron Edge (service_role) albo HHL (jak dotąd).
  -- Produkcja: auth.role(); brama bez auth.role — claim.role (jak uid w stub).
  -- F7: zwykły authenticated z claim.role=authenticated nie dostaje ścieżki service.
  begin
    if to_regprocedure('auth.role()') is not null then
      execute 'select auth.role()' into v_jwt_role;
    else
      v_jwt_role := nullif(current_setting('request.jwt.claim.role', true), '');
    end if;
    v_service := (coalesce(v_jwt_role, '') = 'service_role');
  exception when others then
    v_service := false;
  end;
  if v_service is not true then
    -- is_hhl() zwraca NULL dla konta nieaktywnego / bez wiersza app_users — NULL nie może przepuścić
    if is_hhl() is not true then raise exception 'Import harmonogramu wyłącznie HHL'; end if;
    if p_quiet is true and (current_app_role() = 'HHL_ADMIN') is not true then
      raise exception 'Import bez powiadomień wyłącznie dla Administratora HHL';
    end if;
  end if;
  -- F7 #556: źródło UPLOAD | SHAREPOINT (domyślnie UPLOAD).
  v_source := upper(nullif(btrim(coalesce(p_file->>'source', '')), ''));
  if v_source is null or v_source not in ('UPLOAD', 'SHAREPOINT') then
    v_source := 'UPLOAD';
  end if;
  v_hash := nullif(btrim(coalesce(p_file->>'hash', '')), '');
  -- F7 BLOKER 2: ten sam hash po realnym imporcie → bez nowego schedule_imports.
  -- dry_run w last_run nie blokuje (po włączeniu import_enabled trzeba zapisać ten sam plik).
  if v_source = 'SHAREPOINT'
     and v_hash is not null
     and p_dry_run is false
     and exists (
       select 1 from public.ksh_sync_state s
        where s.project_id = p_project
          and s.source_ok is true
          and s.last_run->>'hash' = v_hash
          and coalesce((s.last_run->>'dry_run')::boolean, false) is not true
     ) then
    return jsonb_build_object(
      'dry_run', p_dry_run,
      'unchanged_file', true,
      'unchanged', 0,
      'added', '[]'::jsonb,
      'changed', '[]'::jsonb,
      'rows', coalesce(jsonb_array_length(p_rows), 0),
      'skipped_standard', coalesce((p_file->>'skipped_standard')::int, 0),
      'skipped_carrier', coalesce((p_file->>'skipped_carrier')::int, 0),
      'skipped_empty', coalesce((p_file->>'skipped_empty')::int, 0),
      'dates_check', 0);
  end if;
  v_run_quiet := (p_quiet is true);
  if v_run_quiet then
    v_prev_run_quiet := current_setting('tower.bulk_quiet', true);
    perform set_config('tower.bulk_quiet', 'on', true);
  end if;
  if not exists (select 1 from projects where id = p_project) then raise exception 'Nieznany projekt'; end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then raise exception 'Wiersze importu: oczekiwana tablica'; end if;
  perform pg_advisory_xact_lock(hashtext('import_schedule:' || p_project::text));
  select id into v_user from app_users where auth_id = auth.uid();
  select coalesce((select value_num = 1 from ops_thresholds where key = 'import_quiet_hours'), false)
    into v_quiet_on;
  v_cmap := coalesce(p_file->'column_map', '{}'::jsonb);
  -- HOTFIX #384 pkt 3: kolumna HHL w mapie (A6: hhlOrderNo); bez niej nie wolamy konfliktu.
  v_has_hhl_col := (nullif(btrim(coalesce(v_cmap->>'hhlOrderNo', v_cmap->>'hhl_order_no', '')), '') is not null);

  -- przewoźnik nowych transportów: jedyny przewoźnik w systemie (inaczej HHL przypisuje ręcznie)
  select case when count(*) = 1 then min(id::text)::uuid end, case when count(*) = 1 then min(name) end
    into v_carrier, v_carrier_n from organizations where kind = 'CARRIER';

  -- walidacja wejścia (druga linia za parserem w przeglądarce): błąd = cała transakcja wycofana
  create temp table if not exists _imp (code text primary key, row jsonb not null) on commit drop;
  truncate _imp;
  for r in select value as v, ordinality as i from jsonb_array_elements(p_rows) with ordinality loop
    -- B-8-IMP: TYP = STANDARD (klasa albo item_type) to ładunek NTG — pomijamy, nie błąd, nie zapis
    if upper(btrim(coalesce(r.v->>'cargo_class', ''))) = 'STANDARD'
       or upper(btrim(coalesce(r.v->>'item_type', ''))) = 'STANDARD' then
      v_skipped := v_skipped + 1;
      continue;
    end if;
    if coalesce(btrim(r.v->>'code'), '') = '' then raise exception 'Wiersz %: brak kodu „Wysyłka”', r.i; end if;
    begin
      c := null;
      select schedule_row_canon(r.v) as canon into c;
    exception when others then
      raise exception 'Wiersz % (%): nieprawidłowa wartość — %', r.i, r.v->>'code', sqlerrm;
    end;
    -- I-2C: klasa ładunku — STANDARD (normatywny) bez wymiarów; każda inna klasa: wymiary wymagane i dodatnie
    if coalesce(upper(btrim(r.v->>'cargo_class')), 'DIMENSIONED') not in ('STANDARD', 'DIMENSIONED') then
      raise exception 'Wiersz % (%): nieznana klasa ładunku %', r.i, r.v->>'code', r.v->>'cargo_class';
    end if;
    if c.canon->>'cargo_class' = 'STANDARD' then
      if coalesce(c.canon->>'length_m', c.canon->>'width_m', c.canon->>'height_m') is not null then
        raise exception 'Wiersz % (%): klasa STANDARD — wymiary muszą być puste', r.i, r.v->>'code';
      end if;
    elsif ((c.canon->>'length_m')::numeric > 0 and (c.canon->>'width_m')::numeric > 0
           and (c.canon->>'height_m')::numeric > 0) is not true then
      raise exception 'Wiersz % (%): wymiary muszą być dodatnie (wymagane dla klasy innej niż STANDARD)', r.i, r.v->>'code';
    end if;
    if (c.canon->>'qty')::int <= 0 then raise exception 'Wiersz % (%): ilość musi być dodatnia', r.i, r.v->>'code'; end if;
    -- A6 L31: nie odrzucaj złych dat — sprawa KSH_DATES_CHECK przy zapisie.
    v_dates_odd := public.a6_import_dates_odd(
      (c.canon->>'load_date')::date, (c.canon->>'delivery_date')::date);
    if v_dates_odd is not true and lower(coalesce(r.v->>'dates_to_check', '')) in ('true', 't', '1') then
      v_dates_odd := true;
    end if;
    c.canon := c.canon || jsonb_build_object(
      'dates_to_check', v_dates_odd,
      'hhl_order_no', nullif(btrim(coalesce(r.v->>'hhl_order_no', r.v->>'hhlOrderNo', '')), ''),
      'carrier_order_no', nullif(btrim(coalesce(r.v->>'carrier_order_no', r.v->>'carrierOrderNo', '')), ''),
      'driver_name', nullif(btrim(coalesce(r.v->>'driver_name', '')), ''),
      'driver_phone', nullif(btrim(coalesce(r.v->>'driver_phone', '')), ''),
      'driver_delivery_name', nullif(btrim(coalesce(r.v->>'driver_delivery_name', '')), ''),
      'driver_delivery_phone', nullif(btrim(coalesce(r.v->>'driver_delivery_phone', '')), ''),
      'tractor_plate', nullif(btrim(coalesce(r.v->>'tractor_plate', '')), ''),
      'tractor_delivery_plate', nullif(btrim(coalesce(r.v->>'tractor_delivery_plate', '')), ''),
      'trailer_plate', nullif(btrim(coalesce(r.v->>'trailer_plate', '')), ''),
      'comment', nullif(btrim(coalesce(r.v->>'comment', '')), ''));
    begin
      insert into _imp values (btrim(r.v->>'code'), c.canon);
    exception when unique_violation then
      raise exception 'Kod % występuje w pliku więcej niż raz', btrim(r.v->>'code');
    end;
  end loop;

  -- DATY-67: plik KSH = źródło dat — zawsze nadpisuje (bez overwrite_confirmed)
  v_over := '{}'::text[];

  -- A6: mapa renumeracji z komentarza „Wcześniej to był SG-…”
  create temp table if not exists _renum (
    new_code text primary key,
    old_code text not null,
    item_id uuid not null,
    load_id uuid not null
  ) on commit drop;
  truncate _renum;
  for r in
    select i.code, i.row as inc
      from _imp i
     where not exists (
       select 1 from shipment_items si
        where si.project_id = p_project and si.shipment_code = i.code)
  loop
    v_renum_from := public.a6_renumber_from_comment(r.inc->>'comment');
    if v_renum_from is null then
      continue;
    end if;
    if exists (select 1 from _imp x where x.code = v_renum_from) then
      continue;
    end if;
    insert into _renum (new_code, old_code, item_id, load_id)
    select r.code, v_renum_from, si.id, si.load_id
      from shipment_items si
     where si.project_id = p_project and si.shipment_code = v_renum_from
    on conflict do nothing;
  end loop;

  -- wersja (tylko przy zapisie; nadawana dopiero, gdy są zmiany)
  if p_dry_run is false then
    select coalesce(max(version), 0) + 1 into v_version from schedule_imports where project_id = p_project;
  end if;

  -- nowe i zmienione (także po renumeracji: stary kod → nowy)
  for r in
    select i.code, i.row as inc,
           si.id as item_id,
           si.load_id as load_id,
           rn.old_code as renum_from,
           l.status, l.carrier_org_id, l.hhl_order_no,
           l.plan_load_date, l.plan_delivery_date,
           l.plan_load_from, l.plan_load_to, l.plan_delivery_from, l.plan_delivery_to,
           coalesce(l.plan_dates_status = 'POTWIERDZONA', false) as confirmed,
           (l.plan_load_from is not null or l.plan_load_to is not null
            or l.plan_delivery_from is not null or l.plan_delivery_to is not null
            or l.status in ('READY','AT_LOADING','IN_TRANSIT_PL','AT_PORT_GDANSK','FERRY','AT_PORT_NYNASHAMN','IN_TRANSIT_SE','AT_SITE')) as awizowany,
           coalesce(si.schedule_row, case when si.id is not null then jsonb_build_object(
             'item_type', si.item_type, 'cargo_class', case when si.cargo_class = 'STANDARD' then 'STANDARD' end,
             'length_m', round(si.length_m, 2), 'width_m', round(si.width_m, 2),
             'height_m', round(si.height_m, 2), 'unit_weight_t', round(si.unit_weight_t, 3), 'qty', si.qty,
             'total_weight_t', round(si.total_weight_t, 3), 'load_date', l.plan_load_date, 'load_time', null,
             'delivery_date', l.plan_delivery_date, 'delivery_time', null, 'order_no', l.order_no,
             'assembly_seq', si.assembly_seq,
             'hhl_order_no', l.hhl_order_no, 'carrier_order_no', l.carrier_order_no,
             'driver_name', l.driver_name, 'driver_phone', l.driver_phone,
             'driver_delivery_name', l.driver_delivery_name, 'driver_delivery_phone', l.driver_delivery_phone,
             'tractor_plate', l.tractor_plate, 'tractor_delivery_plate', l.tractor_delivery_plate,
             'trailer_plate', l.trailer_plate) end) as prev
      from _imp i
      left join _renum rn on rn.new_code = i.code
      left join shipment_items si on si.project_id = p_project
        and (si.shipment_code = i.code or si.id = rn.item_id)
      left join loads l on l.id = si.load_id
     order by i.code
  loop
    v_historic := false;
    if r.item_id is null or r.load_id is null then
      v_added := v_added || jsonb_build_object('code', r.code);
      -- F7: dry_run też liczy dates_check (bez otwierania sprawy)
      if coalesce((r.inc->>'dates_to_check')::boolean, false) is true then
        v_dates_check_n := v_dates_check_n + 1;
      end if;
      if p_dry_run is false then
        if v_import is null then
          insert into schedule_imports (project_id, version, source, file_path, file_hash, file_name, column_map, stats, imported_by)
          values (p_project, v_version, v_source, p_file->>'path', p_file->>'hash', p_file->>'name',
                  coalesce(p_file->'column_map', '{}'::jsonb), '{}'::jsonb, v_user)
          returning id into v_import;
        end if;
        insert into loads (
            project_id, order_no, hhl_order_no, carrier_order_no, carrier_org_id, status,
            plan_load_date, plan_delivery_date, plan_load_from, plan_delivery_to,
            plan_dates_status, plan_dates_confirmed_at,
            driver_name, driver_phone, driver_delivery_name, driver_delivery_phone,
            tractor_plate, tractor_delivery_plate, trailer_plate)
        values (
            p_project,
            nullif(btrim(coalesce(r.inc->>'order_no', '')), ''),
            nullif(btrim(coalesce(r.inc->>'hhl_order_no', '')), ''),
            nullif(btrim(coalesce(r.inc->>'carrier_order_no', '')), ''),
            v_carrier, 'PLANNED',
            (r.inc->>'load_date')::date, (r.inc->>'delivery_date')::date,
            public.schedule_cell_ts((r.inc->>'load_date')::date, r.inc->>'load_time', 'Europe/Warsaw'),
            public.schedule_cell_ts((r.inc->>'delivery_date')::date, r.inc->>'delivery_time', 'Europe/Stockholm'),
            'POTWIERDZONA', now(),
            nullif(btrim(coalesce(r.inc->>'driver_name', '')), ''),
            nullif(btrim(coalesce(r.inc->>'driver_phone', '')), ''),
            nullif(btrim(coalesce(r.inc->>'driver_delivery_name', '')), ''),
            nullif(btrim(coalesce(r.inc->>'driver_delivery_phone', '')), ''),
            nullif(btrim(coalesce(r.inc->>'tractor_plate', '')), ''),
            nullif(btrim(coalesce(r.inc->>'tractor_delivery_plate', '')), ''),
            nullif(btrim(coalesce(r.inc->>'trailer_plate', '')), ''))
        returning id into v_load;
        if coalesce((r.inc->>'dates_to_check')::boolean, false) is true and v_run_quiet is not true then
          perform decision_open_from_event(
            p_project, 'KSH_DATES_CHECK',
            'ksh-dates-imp:' || v_load::text,
            public.l3_headed(r.code, 'daty KSH do sprawdzenia'),
            jsonb_build_object(
              'rule', 'A6_L31', 'code', r.code, 'by', 'IMPORT',
              'load_date', r.inc->>'load_date', 'delivery_date', r.inc->>'delivery_date'),
            v_load, null);
        end if;
        if r.item_id is null then
          insert into shipment_items (project_id, load_id, shipment_code, item_type, cargo_class, length_m, width_m, height_m,
                                      unit_weight_t, qty, total_weight_t, assembly_seq, schedule_row,
                                      first_seen_import, last_seen_import)
          values (p_project, v_load, r.code, r.inc->>'item_type', coalesce(r.inc->>'cargo_class', 'DIMENSIONED'), (r.inc->>'length_m')::numeric, (r.inc->>'width_m')::numeric,
                  (r.inc->>'height_m')::numeric, (r.inc->>'unit_weight_t')::numeric, (r.inc->>'qty')::int,
                  (r.inc->>'total_weight_t')::numeric, (r.inc->>'assembly_seq')::int, r.inc, v_import, v_import);
        else
          update shipment_items set load_id = v_load, schedule_row = r.inc, last_seen_import = v_import, updated_at = now()
           where id = r.item_id;
        end if;
        insert into load_events (load_id, event_type, occurred_at, actor_id, payload)
        values (v_load, 'SCHEDULE_IMPORTED', now(), v_user,
                jsonb_build_object('action', 'ADDED', 'code', r.code, 'version', v_version, 'file', p_file->>'name',
                                   'quiet', v_run_quiet));
      end if;
      continue;
    end if;

    -- A6: renumeracja kodu przy zapisie (Historia było → jest)
    if p_dry_run is false and r.renum_from is not null then
      if v_import is null then
        insert into schedule_imports (project_id, version, source, file_path, file_hash, file_name, column_map, stats, imported_by)
        values (p_project, v_version, v_source, p_file->>'path', p_file->>'hash', p_file->>'name',
                coalesce(p_file->'column_map', '{}'::jsonb), '{}'::jsonb, v_user)
        returning id into v_import;
      end if;
      update shipment_items
         set shipment_code = r.code,
             renumbered_from = r.renum_from,
             updated_at = now()
       where id = r.item_id and shipment_code is distinct from r.code;
      insert into load_events (load_id, event_type, occurred_at, actor_id, payload)
      values (r.load_id, 'SCHEDULE_IMPORTED', now(), v_user,
              jsonb_build_object(
                'action', 'RENUMBER', 'before', r.renum_from, 'after', r.code,
                'marker', 'ZMIANA NUMERACJI', 'version', v_version, 'file', p_file->>'name'));
      insert into audit_log (user_id, action, entity, entity_id, old_value, new_value)
      values (v_user, 'SHIPMENT_RENUMBER', 'shipment_items', r.item_id::text,
              jsonb_build_object('shipment_code', r.renum_from),
              jsonb_build_object('shipment_code', r.code, 'renumbered_from', r.renum_from));
    end if;

    select coalesce(array_agg(f order by f), '{}') into v_fields
      from unnest(v_fnames) f where coalesce(r.inc -> f, 'null'::jsonb) is distinct from coalesce(r.prev -> f, 'null'::jsonb);
    if r.renum_from is not null and not ('shipment_code' = any (v_fields)) then
      v_fields := array['shipment_code'] || coalesce(v_fields, '{}'::text[]);
    end if;
    -- L-1b / HOTFIX #384 pkt 3: konflikt tylko gdy mapa ma kolumne HHL i plik ma niepusta wartosc.
    -- F7 #2: przy p_quiet nie otwieraj spraw TOWER_KSH_CONFLICT.
    if p_dry_run is false
       and v_run_quiet is not true
       and v_has_hhl_col
       and nullif(btrim(r.hhl_order_no), '') is not null
       and nullif(btrim(coalesce(r.inc->>'hhl_order_no', r.inc->>'hhlOrderNo', '')), '') is not null
       and nullif(btrim(r.hhl_order_no), '') is distinct from
           nullif(btrim(coalesce(r.inc->>'hhl_order_no', r.inc->>'hhlOrderNo', '')), '') then
      perform l1b_note_conflict(
        p_project, r.load_id, r.code, r.hhl_order_no,
        coalesce(r.inc->>'hhl_order_no', r.inc->>'hhlOrderNo'));
    end if;
    if cardinality(v_fields) = 0 then v_unchanged := v_unchanged + 1; continue; end if;

    if r.status = 'CANCELLED' then
      v_blocked := v_blocked || jsonb_build_object('code', r.code, 'load_id', r.load_id, 'reason', 'CANCELLED',
                     'message', 'Transport anulowany — przywrócenie wyłącznie ręcznie przez HHL');
      continue;
    end if;

    -- DATY-67: daty z pliku zawsze stosowane; informacyjnie lista zmian dat (bez blokady)
    v_keep := false;
    if ('load_date' = any (v_fields) or 'delivery_date' = any (v_fields)
        or 'load_time' = any (v_fields) or 'delivery_time' = any (v_fields)) then
      v_confirmed := v_confirmed || jsonb_build_object('code', r.code, 'load_id', r.load_id,
                       'before', jsonb_build_object('load_date', r.prev->'load_date', 'delivery_date', r.prev->'delivery_date',
                                                    'load_time', r.prev->'load_time', 'delivery_time', r.prev->'delivery_time'),
                       'after', jsonb_build_object('load_date', r.inc->'load_date', 'delivery_date', r.inc->'delivery_date',
                                                   'load_time', r.inc->'load_time', 'delivery_time', r.inc->'delivery_time'),
                       'overwrite', true);
    end if;

    -- D-20261020-1157-01: ciche pierwsze uzupelnienie pustych godzin (import_quiet_hours).
    -- B1 F7: puste takze w loads (nie tylko w schedule_row) — godziny wpisane przez KSH/HHL nie nadpisywac cicho.
    v_quiet_fill := v_quiet_on
      and cardinality(v_fields) > 0
      and v_fields <@ array['load_time','delivery_time']::text[]
      and (
        not ('load_time' = any (v_fields))
        or (nullif(btrim(r.prev->>'load_time'), '') is null
            and nullif(btrim(r.inc->>'load_time'), '') is not null
            and r.plan_load_from is null and r.plan_load_to is null)
      )
      and (
        not ('delivery_time' = any (v_fields))
        or (nullif(btrim(r.prev->>'delivery_time'), '') is null
            and nullif(btrim(r.inc->>'delivery_time'), '') is not null
            and r.plan_delivery_from is null and r.plan_delivery_to is null)
      );
    -- HOTFIX #384 pkt 4b: cicho gdy status ≠ DELIVERED albo stara i nowa dostawa minione.
    v_historic := (
      (r.status is not null
        and public.load_status_rank(r.status) >= public.load_status_rank('DELIVERED'::public.load_status))
      or (
        r.plan_delivery_date is not null
        and r.plan_delivery_date < v_today
        and nullif(btrim(r.inc->>'delivery_date'), '') is not null
        and (r.inc->>'delivery_date')::date < v_today
      )
    );
    -- F7 #7: w dry_run pokazuj critical także przy quiet; wycisz zdarzenia dopiero przy zapisie.
    v_crit := case
      when v_quiet_fill or v_historic then '{}'::text[]
      when r.awizowany then
        array(select f from unnest(v_fields) f where f in ('load_date','load_time','delivery_date','delivery_time'))
      else '{}'::text[]
    end;
    if v_run_quiet and p_dry_run is false and cardinality(v_crit) > 0 then
      v_crit_suppressed := v_crit_suppressed + 1;
    end if;
    v_changed := v_changed || jsonb_build_object('code', r.code, 'load_id', r.load_id, 'fields', to_jsonb(v_fields),
                   'before', (select jsonb_object_agg(f, r.prev -> f) from unnest(v_fields) f),
                   'after',  (select jsonb_object_agg(f, r.inc -> f) from unnest(v_fields) f),
                   'critical', cardinality(v_crit) > 0,
                   'quiet_hours', v_quiet_fill,
                   'quiet_hist', v_historic);
    if cardinality(v_crit) > 0 then v_critical := v_critical || jsonb_build_object('code', r.code, 'fields', to_jsonb(v_crit)); end if;

    -- F7: dry_run też liczy dates_check (zmiana istniejącego)
    if coalesce((r.inc->>'dates_to_check')::boolean, false) is true then
      v_dates_check_n := v_dates_check_n + 1;
    end if;

    if p_dry_run is false then
      if v_import is null then
        insert into schedule_imports (project_id, version, source, file_path, file_hash, file_name, column_map, stats, imported_by)
        values (p_project, v_version, v_source, p_file->>'path', p_file->>'hash', p_file->>'name',
                coalesce(p_file->'column_map', '{}'::jsonb), '{}'::jsonb, v_user)
        returning id into v_import;
      end if;
      update shipment_items set
        item_type = r.inc->>'item_type', cargo_class = coalesce(r.inc->>'cargo_class', 'DIMENSIONED'), length_m = (r.inc->>'length_m')::numeric, width_m = (r.inc->>'width_m')::numeric,
        height_m = (r.inc->>'height_m')::numeric, unit_weight_t = (r.inc->>'unit_weight_t')::numeric,
        qty = (r.inc->>'qty')::int, total_weight_t = (r.inc->>'total_weight_t')::numeric,
        assembly_seq = (r.inc->>'assembly_seq')::int,
        -- zachowana data potwierdzona: w schedule_row zostają poprzednie daty, więc różnica (i ostrzeżenie) wraca przy kolejnym imporcie
        schedule_row = r.inc,
        last_seen_import = v_import, updated_at = now()
       where id = r.item_id;
      if 'load_date' = any (v_fields) or 'delivery_date' = any (v_fields) or 'order_no' = any (v_fields)
         or 'load_time' = any (v_fields) or 'delivery_time' = any (v_fields) then
        -- G-20 / D-20261014-0015-01 R1: kontekst importu — strażnik przepuszcza daty z pliku
        perform set_config('tower.import_ctx', 'on', true);
        if v_quiet_fill or v_historic then
          v_prev_quiet := current_setting('tower.bulk_quiet', true);
          perform set_config('tower.bulk_quiet', 'on', true);
        end if;
        -- status dat ustawia trg_plan_dates_before (POTWIERDZONA = z pliku); nie w UPDATE (guard)
        v_new_load_date := coalesce((r.inc->>'load_date')::date, r.plan_load_date);
        v_new_del_date := coalesce((r.inc->>'delivery_date')::date, r.plan_delivery_date);
        -- #384 F7 r2/r3: pusta komórka godziny = bez zmiany (nie null).
        -- Zmiana daty bez godziny → wspólna delta (v_new_date - plan_*_date) dla od i do; strażnik do > od.
        if nullif(btrim(r.inc->>'load_time'), '') is not null then
          v_new_load_from := public.schedule_cell_ts(v_new_load_date, r.inc->>'load_time', 'Europe/Warsaw');
          v_new_load_to := case
            when v_new_load_from is null then null
            when r.plan_load_to is not null
                 and (r.plan_load_to at time zone 'Europe/Warsaw')::date = v_new_load_date
                 and r.plan_load_to > v_new_load_from
              then r.plan_load_to
            when r.plan_load_to is not null and r.plan_load_date is not null and v_new_load_date is not null then
              r.plan_load_to + make_interval(days => (v_new_load_date - r.plan_load_date))
            else null
          end;
          if v_new_load_to is not null and v_new_load_from is not null and v_new_load_to <= v_new_load_from then
            v_new_load_to := null;
          end if;
        elsif v_new_load_date is distinct from r.plan_load_date
              and r.plan_load_date is not null and v_new_load_date is not null then
          v_new_load_from := case when r.plan_load_from is not null then
            r.plan_load_from + make_interval(days => (v_new_load_date - r.plan_load_date))
          else null end;
          v_new_load_to := case when r.plan_load_to is not null then
            r.plan_load_to + make_interval(days => (v_new_load_date - r.plan_load_date))
          else null end;
          if v_new_load_from is not null and v_new_load_to is not null and v_new_load_to <= v_new_load_from then
            v_new_load_to := null;
          end if;
        else
          v_new_load_from := r.plan_load_from;
          v_new_load_to := r.plan_load_to;
        end if;
        if nullif(btrim(r.inc->>'delivery_time'), '') is not null then
          v_new_del_to := public.schedule_cell_ts(v_new_del_date, r.inc->>'delivery_time', 'Europe/Stockholm');
          v_new_del_from := case
            when v_new_del_to is null then null
            when r.plan_delivery_from is not null
                 and (r.plan_delivery_from at time zone 'Europe/Stockholm')::date = v_new_del_date
                 and r.plan_delivery_from < v_new_del_to
              then r.plan_delivery_from
            when r.plan_delivery_from is not null and r.plan_delivery_date is not null and v_new_del_date is not null then
              r.plan_delivery_from + make_interval(days => (v_new_del_date - r.plan_delivery_date))
            else null
          end;
          if v_new_del_from is not null and v_new_del_to is not null and v_new_del_from >= v_new_del_to then
            v_new_del_from := null;
          end if;
        elsif v_new_del_date is distinct from r.plan_delivery_date
              and r.plan_delivery_date is not null and v_new_del_date is not null then
          v_new_del_to := case when r.plan_delivery_to is not null then
            r.plan_delivery_to + make_interval(days => (v_new_del_date - r.plan_delivery_date))
          else null end;
          v_new_del_from := case when r.plan_delivery_from is not null then
            r.plan_delivery_from + make_interval(days => (v_new_del_date - r.plan_delivery_date))
          else null end;
          if v_new_del_from is not null and v_new_del_to is not null and v_new_del_from >= v_new_del_to then
            v_new_del_from := null;
          end if;
        else
          v_new_del_to := r.plan_delivery_to;
          v_new_del_from := r.plan_delivery_from;
        end if;
        -- Jak 0267: daty + order_no; zasoby A6 poniżej (osobny UPDATE gdy są w v_fields).
        update loads set
          plan_load_date = coalesce(v_new_load_date, plan_load_date),
          plan_delivery_date = coalesce(v_new_del_date, plan_delivery_date),
          plan_load_from = v_new_load_from,
          plan_load_to = v_new_load_to,
          plan_delivery_from = v_new_del_from,
          plan_delivery_to = v_new_del_to,
          order_no = coalesce(nullif(btrim(coalesce(r.inc->>'order_no', '')), ''), order_no),
          updated_at = now()
         where id = r.load_id;
        if v_quiet_fill or v_historic then
          perform set_config('tower.bulk_quiet', coalesce(v_prev_quiet, ''), true);
        end if;
        perform set_config('tower.import_ctx', '', true);
      end if;
      -- A6: zasoby/numery (samodzielnie albo razem ze zmianą dat)
      if (v_fields && v_res_fields) then
        -- F7 BLOKER 2 (#560): import_ctx także wokół UPDATE zasobów/numerów (bez echa do pliku).
        perform set_config('tower.import_ctx', 'on', true);
        update loads set
          hhl_order_no = coalesce(nullif(btrim(coalesce(r.inc->>'hhl_order_no', '')), ''), hhl_order_no),
          carrier_order_no = coalesce(nullif(btrim(coalesce(r.inc->>'carrier_order_no', '')), ''), carrier_order_no),
          driver_name = coalesce(nullif(btrim(coalesce(r.inc->>'driver_name', '')), ''), driver_name),
          driver_phone = coalesce(nullif(btrim(coalesce(r.inc->>'driver_phone', '')), ''), driver_phone),
          driver_delivery_name = coalesce(nullif(btrim(coalesce(r.inc->>'driver_delivery_name', '')), ''), driver_delivery_name),
          driver_delivery_phone = coalesce(nullif(btrim(coalesce(r.inc->>'driver_delivery_phone', '')), ''), driver_delivery_phone),
          tractor_plate = coalesce(nullif(btrim(coalesce(r.inc->>'tractor_plate', '')), ''), tractor_plate),
          tractor_delivery_plate = coalesce(nullif(btrim(coalesce(r.inc->>'tractor_delivery_plate', '')), ''), tractor_delivery_plate),
          trailer_plate = coalesce(nullif(btrim(coalesce(r.inc->>'trailer_plate', '')), ''), trailer_plate),
          updated_at = now()
         where id = r.load_id;
        perform set_config('tower.import_ctx', '', true);
      end if;
      if coalesce((r.inc->>'dates_to_check')::boolean, false) is true and v_run_quiet is not true then
        perform decision_open_from_event(
          p_project, 'KSH_DATES_CHECK',
          'ksh-dates-imp:' || r.load_id::text,
          public.l3_headed(r.code, 'daty KSH do sprawdzenia'),
          jsonb_build_object(
            'rule', 'A6_L31', 'code', r.code, 'by', 'IMPORT',
            'load_date', r.inc->>'load_date', 'delivery_date', r.inc->>'delivery_date'),
          r.load_id, null);
      end if;
      insert into load_events (load_id, event_type, occurred_at, actor_id, payload)
      values (r.load_id, 'SCHEDULE_IMPORTED', now(), v_user,
              jsonb_build_object('action', 'CHANGED', 'code', r.code, 'version', v_version, 'fields', to_jsonb(v_fields),
                                 'before', (select jsonb_object_agg(f, r.prev -> f) from unnest(v_fields) f),
                                 'after',  (select jsonb_object_agg(f, r.inc -> f) from unnest(v_fields) f),
                                 'quiet', v_run_quiet));
      if cardinality(v_crit) > 0 and v_historic is not true and v_run_quiet is not true then
        insert into load_events (load_id, event_type, occurred_at, actor_id, payload)
        values (r.load_id, 'SCHEDULE_DATE_CRITICAL', now(), v_user,
                jsonb_build_object('code', r.code, 'version', v_version, 'fields', to_jsonb(v_crit),
                                   'before', (select jsonb_object_agg(f, r.prev -> f) from unnest(v_crit) f),
                                   'after',  (select jsonb_object_agg(f, r.inc -> f) from unnest(v_crit) f)));
        insert into notifications (channel, recipient, user_id, load_id, template, payload, dedup_key)
        select 'IN_APP', coalesce(u.email::text, u.id::text), u.id, r.load_id, 'SCHEDULE_DATE_CRITICAL',
               jsonb_build_object('code', r.code, 'fields', to_jsonb(v_crit),
                                  'load_date', r.inc->>'load_date', 'delivery_date', r.inc->>'delivery_date',
                                  'locale', u.locale),
               'SCHED_CRIT:' || r.load_id || ':' || v_version || ':' || u.id
          from app_users u join organizations o on o.id = u.org_id
         where u.active and (o.kind = 'FORWARDER' or (r.carrier_org_id is not null and u.org_id = r.carrier_org_id))
        on conflict (dedup_key) where dedup_key is not null do nothing;
      end if;
    end if;
  end loop;

  -- nieobecne w pliku: kandydaci do anulowania (tylko gdy plik ma przyjęte wiersze)
  if jsonb_array_length(p_rows) > 0 then
    for c in
      select si.shipment_code as code, l.id as load_id, l.status,
             exists (select 1 from invoice_lines il where il.load_id = l.id) as invoiced
        from shipment_items si join loads l on l.id = si.load_id
       where si.project_id = p_project and l.status <> 'CANCELLED'
         and si.cargo_class is distinct from 'STANDARD'
         and not exists (select 1 from _imp i where i.code = si.shipment_code)
       order by si.shipment_code
    loop
      -- F7 #2: przy p_quiet nie otwieraj spraw KSH_ROW_GONE.
      if p_dry_run is false and v_run_quiet is not true then
        perform l1b_note_row_gone(p_project, c.load_id, c.code);
      end if;
      if c.invoiced then
        v_blocked := v_blocked || jsonb_build_object('code', c.code, 'load_id', c.load_id, 'reason', 'INVOICED',
                       'message', 'Transport jest na fakturze');
      elsif c.status not in ('PLANNED','RESOURCES_PENDING','DOCS_PENDING','READY') then
        v_blocked := v_blocked || jsonb_build_object('code', c.code, 'load_id', c.load_id, 'reason', 'STATUS',
                       'message', 'Transport od wjazdu na załadunek — anuluje wyłącznie HHL ręcznie, z powodem');
      else
        v_cands := v_cands || jsonb_build_object('code', c.code, 'load_id', c.load_id);
        if p_dry_run is false and c.code = any (coalesce(p_cancel_codes, '{}')) then
          if v_import is null then
            insert into schedule_imports (project_id, version, source, file_path, file_hash, file_name, column_map, stats, imported_by)
            values (p_project, v_version, v_source, p_file->>'path', p_file->>'hash', p_file->>'name',
                    coalesce(p_file->'column_map', '{}'::jsonb), '{}'::jsonb, v_user)
            returning id into v_import;
          end if;
          perform set_config('tower.cancel_ctx', 'IMPORT', true);
          update loads set status = 'CANCELLED', updated_at = now() where id = c.load_id;
          perform set_config('tower.cancel_ctx', '', true);
          insert into audit_log (user_id, action, entity, entity_id, old_value, new_value)
          values (v_user, 'LOAD_CANCEL_IMPORT', 'loads', c.load_id::text, jsonb_build_object('status', c.status),
                  jsonb_build_object('status', 'CANCELLED', 'reason', 'Usunięty z harmonogramu (' || coalesce(p_file->>'name', 'import') || ')',
                                     'version', v_version));
          insert into load_events (load_id, event_type, occurred_at, actor_id, payload)
          values (c.load_id, 'STATUS_CANCELLED', now(), v_user,
                  jsonb_build_object('code', c.code, 'version', v_version, 'reason', 'Usunięty z harmonogramu', 'file', p_file->>'name',
                                     'quiet', v_run_quiet));
          v_cancelled := v_cancelled || jsonb_build_object('code', c.code, 'load_id', c.load_id);
        end if;
      end if;
    end loop;
  end if;

  -- F7 #2: przy p_quiet nie otwieraj spraw KR_OVER_3.
  if p_dry_run is false and v_run_quiet is not true then
    for r in
      select distinct (i.row->>'load_date')::date as d
        from _imp i
       where nullif(i.row->>'load_date', '') is not null
    loop
      perform l1b_kr_check(p_project, r.d);
    end loop;
  end if;

  if v_import is not null then
    update schedule_imports set stats = jsonb_build_object(
        'added', jsonb_array_length(v_added), 'changed', jsonb_array_length(v_changed),
        'unchanged', v_unchanged, 'cancelled', jsonb_array_length(v_cancelled),
        'blocked', jsonb_array_length(v_blocked), 'critical', jsonb_array_length(v_critical),
        'confirmed_kept', (select count(*) from jsonb_array_elements(v_confirmed) x where not (x->>'overwrite')::boolean),
        'rows', jsonb_array_length(p_rows), 'rejected', coalesce((p_file->>'rejected')::int, 0),
        'skipped_standard', v_skipped + coalesce((p_file->>'skipped_standard')::int, 0),
        'skipped_carrier', coalesce((p_file->>'skipped_carrier')::int, 0),
        'skipped_empty', coalesce((p_file->>'skipped_empty')::int, 0),
        'dates_check', v_dates_check_n,
        'quiet', v_run_quiet)
     where id = v_import;
  end if;

  -- F7 #5: audyt tylko gdy coś zapisano; import_id / cancelled / critical_suppressed.
  if v_run_quiet and p_dry_run is false and v_import is not null then
    insert into audit_log (user_id, action, entity, entity_id, new_value)
    values (
      v_user,
      'SCHEDULE_IMPORT_QUIET',
      'schedule_imports',
      v_import::text,
      jsonb_build_object(
        'note', 'import bez powiadomień',
        'import_id', v_import,
        'project_id', p_project,
        'version', v_version,
        'file', p_file->>'name',
        'added', jsonb_array_length(v_added),
        'changed', jsonb_array_length(v_changed),
        'cancelled', jsonb_array_length(v_cancelled),
        'critical_suppressed', v_crit_suppressed
      )
    );
  end if;
  if v_run_quiet then
    perform set_config('tower.bulk_quiet', coalesce(v_prev_run_quiet, ''), true);
  end if;

  return jsonb_build_object(
    'dry_run', p_dry_run,
    'quiet', v_run_quiet,
    'version', case when v_import is not null then v_version end,
    'import_id', v_import,
    'rows', jsonb_array_length(p_rows),
    'added', v_added, 'changed', v_changed, 'unchanged', v_unchanged,
    'cancel_candidates', v_cands, 'blocked', v_blocked, 'cancelled', v_cancelled, 'critical', v_critical, 'confirmed', v_confirmed,
    'carrier', v_carrier_n,
    'skipped_standard', v_skipped + coalesce((p_file->>'skipped_standard')::int, 0),
    'skipped_carrier', coalesce((p_file->>'skipped_carrier')::int, 0),
    'skipped_empty', coalesce((p_file->>'skipped_empty')::int, 0),
    'dates_check', v_dates_check_n,
    'ms', round(extract(epoch from clock_timestamp() - t0) * 1000));
end $function$;

REVOKE ALL ON FUNCTION public.import_schedule(uuid, jsonb, text[], jsonb, boolean, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.import_schedule(uuid, jsonb, text[], jsonb, boolean, boolean) TO authenticated;
DO $g$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.import_schedule(uuid, jsonb, text[], jsonb, boolean, boolean) TO service_role;
  END IF;
END $g$;

COMMENT ON FUNCTION public.import_schedule(uuid, jsonb, text[], jsonb, boolean, boolean) IS
  'I-1 import KSH. A6/0308 F7: import_ctx wokół UPDATE zasobów; service_role/HHL; SHAREPOINT; L31/zasoby/renumber/p_quiet/B5.';
commit;

