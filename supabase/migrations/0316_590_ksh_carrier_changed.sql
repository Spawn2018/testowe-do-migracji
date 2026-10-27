-- =====================================================================
-- TOWER — Migracja 0316: #590 KSH_CARRIER_CHANGED (zmiana przewoźnika w pliku)
-- Po 0314 (#583). 0315 zarezerwowane dla BN0 #585 (przenumerowanie 0313→0315).
-- =====================================================================

alter table public.loads
  add column if not exists removed_at timestamptz,
  add column if not exists removed_reason text,
  add column if not exists removed_prev_status public.load_status;

comment on column public.loads.removed_at is
  '#590: miękkie usunięcie z harmonogramu (HHL); null = widoczny';

grant select (removed_at, removed_reason, removed_prev_status) on public.loads to authenticated;

insert into public.decision_types (
  code, title_key, decider_role, options, due_hours, due_note, severity_default, sort_order
) values (
  'KSH_CARRIER_CHANGED',
  'dec_type_KSH_CARRIER_CHANGED',
  'HHL',
  '[
    {"code":"CANCEL","label_key":"dec_opt_CARRIER_CANCEL","requires_comment":false,"effect":"CARRIER_CANCEL"},
    {"code":"REMOVE","label_key":"dec_opt_CARRIER_REMOVE","requires_comment":false,"effect":"CARRIER_REMOVE"},
    {"code":"SNOOZE_2H","label_key":"dec_opt_CARRIER_SNOOZE","requires_comment":false,"effect":"SNOOZE"}
  ]'::jsonb,
  24, null, 'WARNING', 48
) on conflict (code) do update set
  title_key = excluded.title_key,
  options = excluded.options,
  severity_default = excluded.severity_default,
  decider_role = excluded.decider_role;

create or replace function public.l1b_note_carrier_changed(
  p_project uuid,
  p_load uuid,
  p_code text,
  p_carrier_file text,
  p_file_name text,
  p_file_read_at timestamptz default now()
) returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_id uuid;
  v_key text;
  v_title text;
  v_detail jsonb;
  v_sev text := 'WARNING';
  v_plan date;
  v_carrier_wt text;
begin
  if p_project is null or p_load is null or nullif(btrim(p_code), '') is null then
    return null;
  end if;
  select l.plan_load_date,
         coalesce(
           (select o.name from organizations o where o.id = l.carrier_org_id),
           'Scandinavian Express'
         )
    into v_plan, v_carrier_wt
    from loads l where l.id = p_load;
  if v_plan is not null and v_plan <= (timezone('Europe/Warsaw', now()))::date + 2 then
    v_sev := 'CRITICAL';
  end if;
  v_key := 'ksh-carrier:' || p_load::text;
  v_title := format(
    '%s: zmiana przewoźnika w pliku KSH (%s → %s)',
    btrim(p_code),
    coalesce(v_carrier_wt, '—'),
    coalesce(nullif(btrim(p_carrier_file), ''), '—')
  );
  v_detail := jsonb_build_object(
    'event_key', v_key,
    'code', btrim(p_code),
    'carrier_wt', v_carrier_wt,
    'carrier_file', nullif(btrim(p_carrier_file), ''),
    'file_name', nullif(btrim(p_file_name), ''),
    'file_read_at', p_file_read_at,
    'plan_load_date', v_plan,
    'severity_hint', v_sev
  );
  select d.id into v_id
    from decisions d
   where d.project_id = p_project
     and d.type_code = 'KSH_CARRIER_CHANGED'
     and d.status in ('NEW', 'ASSIGNED', 'SNOOZED')
     and d.detail->>'event_key' = v_key
   order by d.created_at desc
   limit 1;
  if v_id is not null then
    update decisions
       set detail = coalesce(detail, '{}'::jsonb) || v_detail,
           title = v_title,
           updated_at = now()
     where id = v_id;
    return v_id;
  end if;
  v_id := decision_open_from_event(
    p_project, 'KSH_CARRIER_CHANGED', v_key, v_title, v_detail, p_load, null
  );
  return v_id;
end
$fn$;
revoke all on function public.l1b_note_carrier_changed(uuid, uuid, text, text, text, timestamptz)
  from public, anon, authenticated;

create or replace function public.import_apply_carrier_skips(
  p_project uuid,
  p_file jsonb,
  p_dry_run boolean,
  p_quiet boolean,
  p_user uuid
) returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  s jsonb;
  v_code text;
  v_carrier text;
  v_load uuid;
begin
  for s in select value from jsonb_array_elements(coalesce(p_file->'skipped_carrier_rows', '[]'::jsonb))
  loop
    v_code := nullif(btrim(s->>'code'), '');
    v_carrier := nullif(btrim(s->>'carrier_text'), '');
    if v_code is null then continue; end if;
    select l.id into v_load
      from shipment_items si
      join loads l on l.id = si.load_id
     where si.project_id = p_project
       and si.shipment_code = v_code
       and l.status <> 'CANCELLED'
       and l.removed_at is null
     limit 1;
    if v_load is null then continue; end if;
    if p_quiet is true then
      perform set_config('tower.bulk_quiet', '1', true);
    end if;
    perform l1b_note_carrier_changed(
      p_project, v_load, v_code, v_carrier,
      p_file->>'name', now()
    );
    if p_quiet is true then
      perform set_config('tower.bulk_quiet', '', true);
    end if;
  end loop;
end
$fn$;
revoke all on function public.import_apply_carrier_skips(uuid, jsonb, boolean, boolean, uuid)
  from public, anon, authenticated;

create or replace function public.import_close_carrier_skips_resolved(
  p_project uuid,
  p_dry_run boolean
) returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  d record;
begin
  if p_dry_run is true then return; end if;
  for d in
    select dec.id
      from decisions dec
     where dec.project_id = p_project
       and dec.type_code = 'KSH_CARRIER_CHANGED'
       and dec.status in ('NEW', 'ASSIGNED', 'SNOOZED')
       and exists (
         select 1 from _imp i
          where i.code = dec.detail->>'code'
       )
  loop
    update decisions
       set status = 'RESOLVED',
           resolved_at = now(),
           resolution_note = 'przewoźnik w pliku wrócił do Scandinavian Express',
           updated_at = now()
     where id = d.id;
  end loop;
exception
  when undefined_table then
    null;
end
$fn$;
revoke all on function public.import_close_carrier_skips_resolved(uuid, boolean)
  from public, anon, authenticated;

create or replace function public.decision_resolve_carrier_change(
  p_decision uuid,
  p_action text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  d decisions%rowtype;
  v_action text := upper(btrim(p_action));
  v_user uuid;
  v_status text;
  v_code text;
  v_carrier text;
begin
  perform assert_not_preview();
  if (current_app_user_id() is not null) is not true then
    raise exception 'Rozstrzygnięcie — tylko HHL' using errcode = '42501';
  end if;
  select id into v_user from app_users where id = current_app_user_id() and active;
  if v_user is null or (is_hhl()) is not true then
    raise exception 'Rozstrzygnięcie — tylko HHL' using errcode = '42501';
  end if;
  if p_decision is null or v_action is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into d from decisions where id = p_decision for update;
  if not found then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  if d.type_code is distinct from 'KSH_CARRIER_CHANGED' then
    raise exception 'wrong type' using errcode = '22023';
  end if;
  if d.status not in ('NEW', 'ASSIGNED', 'SNOOZED') then
    return jsonb_build_object('ok', true, 'idempotent', true, 'status', d.status);
  end if;
  v_code := d.detail->>'code';
  v_carrier := coalesce(d.detail->>'carrier_file', '—');
  select l.status into v_status from loads l where l.id = d.load_id;

  if v_action = 'SNOOZE_2H' then
    update decisions
       set status = 'SNOOZED',
           snooze_until = now() + interval '2 hours',
           updated_at = now()
     where id = d.id;
    insert into audit_log (user_id, action, entity, entity_id, new_value)
    values (v_user, 'DECISION_CARRIER_SNOOZE', 'decisions', d.id::text,
            jsonb_build_object('action', 'SNOOZE_2H', 'load_id', d.load_id, 'code', v_code));
    insert into load_events (load_id, event_type, occurred_at, actor_id, payload)
    values (d.load_id, 'DECISION_SNOOZED', now(), v_user,
            jsonb_build_object('decision_id', d.id, 'type', 'KSH_CARRIER_CHANGED', 'hours', 2));
    return jsonb_build_object('ok', true, 'status', 'SNOOZED');
  end if;

  if v_action = 'REMOVE' then
    if v_status is null or v_status not in ('PLANNED','RESOURCES_PENDING','DOCS_PENDING','READY') then
      raise exception 'Usunięcie z harmonogramu tylko przed załadunkiem (status %)', coalesce(v_status, '?')
        using errcode = '22023';
    end if;
    update loads
       set removed_at = now(),
           removed_reason = 'Zmiana przewoźnika w pliku KSH: ' || v_carrier,
           removed_prev_status = status,
           updated_at = now()
     where id = d.load_id and removed_at is null;
    update decisions
       set status = 'RESOLVED', resolved_at = now(),
           resolution_note = 'REMOVE', updated_at = now(),
           resolved_by = v_user
     where id = d.id;
    insert into audit_log (user_id, action, entity, entity_id, old_value, new_value)
    values (v_user, 'LOAD_REMOVE_CARRIER', 'loads', d.load_id::text,
            jsonb_build_object('status', v_status),
            jsonb_build_object('removed', true, 'reason', 'Zmiana przewoźnika w pliku KSH: ' || v_carrier));
    insert into load_events (load_id, event_type, occurred_at, actor_id, payload)
    values (d.load_id, 'LOAD_REMOVED', now(), v_user,
            jsonb_build_object('decision_id', d.id, 'reason', 'carrier_changed', 'carrier_file', v_carrier));
    return jsonb_build_object('ok', true, 'status', 'RESOLVED', 'effect', 'REMOVE');
  end if;

  if v_action = 'CANCEL' then
    perform set_config('tower.cancel_ctx', 'IMPORT', true);
    update loads set status = 'CANCELLED', updated_at = now()
     where id = d.load_id and status <> 'CANCELLED';
    perform set_config('tower.cancel_ctx', '', true);
    insert into audit_log (user_id, action, entity, entity_id, old_value, new_value)
    values (v_user, 'LOAD_CANCEL_IMPORT', 'loads', d.load_id::text,
            jsonb_build_object('status', v_status),
            jsonb_build_object('status', 'CANCELLED',
                               'reason', 'Zmiana przewoźnika w pliku KSH: ' || v_carrier));
    insert into load_events (load_id, event_type, occurred_at, actor_id, payload)
    values (d.load_id, 'STATUS_CANCELLED', now(), v_user,
            jsonb_build_object('decision_id', d.id, 'reason',
                               'Zmiana przewoźnika w pliku KSH: ' || v_carrier));
    update decisions
       set status = 'RESOLVED', resolved_at = now(),
           resolution_note = 'CANCEL', updated_at = now(),
           resolved_by = v_user
     where id = d.id;
    begin
      perform decision_notify(d.id, 'RESOLVE');
    exception when others then
      null;
    end;
    return jsonb_build_object('ok', true, 'status', 'RESOLVED', 'effect', 'CANCEL');
  end if;

  raise exception 'unknown action %', v_action using errcode = '22023';
end
$fn$;
revoke all on function public.decision_resolve_carrier_change(uuid, text) from public, anon;
grant execute on function public.decision_resolve_carrier_change(uuid, text) to authenticated;

create or replace function public.load_restore_removed(p_load uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_user uuid := current_app_user_id();
  v_prev public.load_status;
begin
  perform assert_not_preview();
  if (current_app_role() = 'HHL_ADMIN') is not true then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select removed_prev_status into v_prev from loads where id = p_load and removed_at is not null;
  if v_prev is null then
    return jsonb_build_object('ok', true, 'idempotent', true);
  end if;
  update loads
     set status = v_prev,
         removed_at = null,
         removed_reason = null,
         removed_prev_status = null,
         updated_at = now()
   where id = p_load;
  insert into audit_log (user_id, action, entity, entity_id, new_value)
  values (v_user, 'LOAD_RESTORE_REMOVED', 'loads', p_load::text,
          jsonb_build_object('status', v_prev));
  insert into load_events (load_id, event_type, occurred_at, actor_id, payload)
  values (p_load, 'LOAD_RESTORED', now(), v_user, jsonb_build_object('status', v_prev));
  return jsonb_build_object('ok', true, 'status', v_prev);
end
$fn$;
revoke all on function public.load_restore_removed(uuid) from public, anon;
grant execute on function public.load_restore_removed(uuid) to authenticated;

create or replace function public.decisions_wake_carrier_snoozed()
returns int
language plpgsql
security definer
set search_path = public
as $fn$
declare
  n int := 0;
begin
  with u as (
    update decisions
       set status = 'NEW',
           snooze_until = null,
           updated_at = now()
     where type_code = 'KSH_CARRIER_CHANGED'
       and status = 'SNOOZED'
       and snooze_until is not null
       and snooze_until <= now()
    returning id
  )
  select count(*)::int into n from u;
  return n;
end
$fn$;
revoke all on function public.decisions_wake_carrier_snoozed() from public, anon, authenticated;

comment on function public.decision_resolve_carrier_change(uuid, text) is
  '#590: CANCEL / REMOVE / SNOOZE_2H dla KSH_CARRIER_CHANGED; tylko HHL; assert_not_preview';
comment on function public.load_restore_removed(uuid) is
  '#590: przywrócenie transportu usuniętego z harmonogramu — tylko HHL_ADMIN';

-- import_schedule (patched from 0314) below

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
  -- F7 r5 N9 / r6 / r7 06:08 / r8
  v_pend jsonb;
  v_exp_out jsonb;
  v_out_rev int;
  v_f text;
  v_exp_val text;
  v_file_val text;
  v_pending_wt text[] := '{}';
  v_write_on boolean := false;
  v_apply_fields text[];
  v_skip_reasons jsonb := '{}'::jsonb;
  v_omit_sched text[] := '{}';
  v_sched_row jsonb;
  v_pf text;
  v_plate_fields text[] := array['tractor_plate','tractor_delivery_plate','trailer_plate'];
  -- F7 #586 BLOKER 1 + r2 C: pusta komórka = bez zmiany (wagi/item/seq z skip_reason).
  v_leave_empty text[] := array[
    'load_time','delivery_time','order_no',
    'hhl_order_no','carrier_order_no',
    'driver_name','driver_phone','driver_delivery_name','driver_delivery_phone',
    'tractor_plate','tractor_delivery_plate','trailer_plate',
    'unit_weight_t','total_weight_t','item_type','assembly_seq'
  ];
  -- F7 r2 C: te leave_empty dają wiersz podglądu ze skip_reason (nie cicho).
  v_leave_empty_note text[] := array[
    'unit_weight_t','total_weight_t','item_type','assembly_seq'
  ];
  -- F7 #586 pkt 3: pola wspólne transportu (wiele kodów na load_id).
  v_load_shared text[] := array[
    'load_date','load_time','delivery_date','delivery_time','order_no',
    'hhl_order_no','carrier_order_no',
    'driver_name','driver_phone','driver_delivery_name','driver_delivery_phone',
    'tractor_plate','tractor_delivery_plate','trailer_plate'
  ];
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
  -- F7 r8 BLOKER 2: pending-skip tylko gdy write_enabled (inaczej DATY-67 jak przed A6 zapisem).
  select coalesce(s.write_enabled, false) into v_write_on
    from public.ksh_sync_state s where s.project_id = p_project;
  v_write_on := coalesce(v_write_on, false);
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
  perform decisions_wake_carrier_snoozed();
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
    -- F7 r2 C: pusta qty w pliku (surowa komórka) ≠ canon→1 — oznacz, waliduj dopiero gdy podana.
    if nullif(btrim(coalesce(r.v->>'qty', '')), '') is null then
      c.canon := c.canon || jsonb_build_object('_qty_empty', true);
    elsif (c.canon->>'qty')::int <= 0 then
      raise exception 'Wiersz % (%): ilość musi być dodatnia', r.i, r.v->>'code';
    end if;
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
           -- #583 F7 BLOKER 2: porównanie trójstronne — prev=live WT; file_base=ostatni plik (schedule_row).
           case when si.id is null then null
             else public.import_live_prev(si.id, l.id)
           end as prev,
           si.schedule_row as file_base
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

    -- #583 F7: changed gdy inc≠live ORAZ (brak klucza w file_base LUB inc≠file_base).
    -- Pusta komórka = bez zmiany dla v_leave_empty; qty surowa pusta → _qty_empty (nie canon=1).
    select coalesce(array_agg(f order by f), '{}') into v_fields
      from unnest(v_fnames) f
     where coalesce(r.inc -> f, 'null'::jsonb) is distinct from coalesce(r.prev -> f, 'null'::jsonb)
       and (
         r.file_base is null
         or not (r.file_base ? f)
         or coalesce(r.inc -> f, 'null'::jsonb) is distinct from coalesce(r.file_base -> f, 'null'::jsonb)
       )
       and (
         f <> all (v_leave_empty)
         or nullif(btrim(coalesce(r.inc ->> f, '')), '') is not null
       )
       and not (f = 'qty' and coalesce((r.inc ->> '_qty_empty')::boolean, false));
    if r.renum_from is not null and not ('shipment_code' = any (v_fields)) then
      v_fields := array['shipment_code'] || coalesce(v_fields, '{}'::text[]);
    end if;
    -- #583: tablice — równość części WT → bez zmiany; nie-tablica → preview+skip_reason, bez zapisu
    v_skip_reasons := '{}'::jsonb;
    v_omit_sched := '{}';
    v_apply_fields := coalesce(v_fields, '{}'::text[]);
    foreach v_pf in array v_plate_fields loop
      if v_pf = any (coalesce(v_fields, '{}'::text[])) then
        if public.import_plate_file_in_wt(r.prev ->> v_pf, r.inc ->> v_pf) then
          v_fields := array(select x from unnest(v_fields) x where x is distinct from v_pf);
          v_apply_fields := array(select x from unnest(v_apply_fields) x where x is distinct from v_pf);
        elsif public.import_plate_is_valid(r.inc ->> v_pf) is not true then
          v_apply_fields := array(select x from unnest(v_apply_fields) x where x is distinct from v_pf);
          v_omit_sched := array_append(v_omit_sched, v_pf);
          v_skip_reasons := v_skip_reasons || jsonb_build_object(
            v_pf, 'wartość w pliku nie jest tablicą — pominięta');
        end if;
      end if;
    end loop;
    -- F7 r2 C / r3 pkt 3: skip_reason „pusta komórka…” tylko gdy WT ma wartość (co chronić).
    foreach v_f in array v_leave_empty_note loop
      if nullif(btrim(coalesce(r.inc ->> v_f, '')), '') is null
         and nullif(btrim(coalesce(r.prev ->> v_f, '')), '') is not null
         and (
           r.file_base is null
           or not (r.file_base ? v_f)
           or coalesce(r.inc -> v_f, 'null'::jsonb) is distinct from coalesce(r.file_base -> v_f, 'null'::jsonb)
         ) then
        if (v_f = any (coalesce(v_fields, '{}'::text[]))) is not true then
          v_fields := array_append(coalesce(v_fields, '{}'::text[]), v_f);
        end if;
        v_apply_fields := array(select x from unnest(v_apply_fields) x where x is distinct from v_f);
        v_omit_sched := array_append(v_omit_sched, v_f);
        v_skip_reasons := v_skip_reasons || jsonb_build_object(
          v_f, 'pusta komórka w pliku — pominięta');
      end if;
    end loop;
    if coalesce((r.inc ->> '_qty_empty')::boolean, false)
       and nullif(btrim(coalesce(r.prev ->> 'qty', '')), '') is not null then
      if ('qty' = any (coalesce(v_fields, '{}'::text[]))) is not true then
        v_fields := array_append(coalesce(v_fields, '{}'::text[]), 'qty');
      end if;
      v_apply_fields := array(select x from unnest(v_apply_fields) x where x is distinct from 'qty');
      v_omit_sched := array_append(v_omit_sched, 'qty');
      v_skip_reasons := v_skip_reasons || jsonb_build_object(
        'qty', 'pusta komórka w pliku — pominięta');
    end if;
    -- F7 #586 r5 pkt 5: nieczytelna godzina (schedule_cell_ts → null) = bez zmiany;
    -- skip_reason tylko gdy WT ma okno (inaczej nie ma czego chronić).
    foreach v_f in array array['load_time','delivery_time']::text[] loop
      if v_f = any (v_apply_fields)
         and nullif(btrim(coalesce(r.inc ->> v_f, '')), '') is not null
         and public.schedule_cell_ts(current_date, r.inc ->> v_f, 'UTC') is null then
        v_apply_fields := array(select x from unnest(v_apply_fields) x where x is distinct from v_f);
        if (v_f = 'load_time' and (r.plan_load_from is not null or r.plan_load_to is not null))
           or (v_f = 'delivery_time' and (r.plan_delivery_from is not null or r.plan_delivery_to is not null)) then
          if (v_f = any (coalesce(v_fields, '{}'::text[]))) is not true then
            v_fields := array_append(coalesce(v_fields, '{}'::text[]), v_f);
          end if;
          v_omit_sched := array_append(v_omit_sched, v_f);
          v_skip_reasons := v_skip_reasons || jsonb_build_object(
            v_f, 'nieczytelna godzina w pliku — pominięta');
        else
          v_fields := array(select x from unnest(coalesce(v_fields, '{}'::text[])) x
                             where x is distinct from v_f);
        end if;
      end if;
    end loop;
    -- #583 F7 pkt 3 + r2 B: konflikt multi-code — pusta leave = bez zdania; tablice po norm
    foreach v_f in array coalesce(v_fields, '{}'::text[]) loop
      if v_f = any (v_apply_fields)
         and v_f = any (v_load_shared)
         and exists (
           select 1
             from _imp i2
             join shipment_items si2
               on si2.project_id = p_project and si2.shipment_code = i2.code
            where si2.load_id = r.load_id
              and i2.code is distinct from r.code
              and case
                when v_f = any (v_plate_fields) then
                  public.import_plate_norm(i2.row ->> v_f) is not null
                  and public.import_plate_norm(r.inc ->> v_f) is not null
                  and public.import_plate_norm(i2.row ->> v_f)
                      is distinct from public.import_plate_norm(r.inc ->> v_f)
                when v_f in ('load_time', 'delivery_time') then
                  -- F7 r4: schedule_cell_ts (nie ::time — „rano”/`9-12` nie wycofuje importu);
                  -- „9:00” = „09:00”; nieczytelny tekst → null → bez konfliktu.
                  public.schedule_cell_ts(current_date, i2.row ->> v_f, 'UTC') is not null
                  and public.schedule_cell_ts(current_date, r.inc ->> v_f, 'UTC') is not null
                  and public.schedule_cell_ts(current_date, i2.row ->> v_f, 'UTC')
                      is distinct from public.schedule_cell_ts(current_date, r.inc ->> v_f, 'UTC')
                when v_f = any (v_leave_empty) then
                  nullif(btrim(coalesce(i2.row ->> v_f, '')), '') is not null
                  and nullif(btrim(coalesce(r.inc ->> v_f, '')), '') is not null
                  and nullif(btrim(i2.row ->> v_f), '')
                      is distinct from nullif(btrim(r.inc ->> v_f), '')
                else
                  coalesce(i2.row ->> v_f, '') is distinct from coalesce(r.inc ->> v_f, '')
              end
         ) then
        v_apply_fields := array(select x from unnest(v_apply_fields) x where x is distinct from v_f);
        v_omit_sched := array_append(v_omit_sched, v_f);
        v_skip_reasons := v_skip_reasons || jsonb_build_object(
          v_f, 'różne wartości w wierszach transportu');
      end if;
    end loop;

    -- F7 r7 N13 + 05:37: pending skip PRZED konfliktem numeru i confirmed/crit.
    -- F7 r8 BLOKER 2: tylko gdy write_enabled — inaczej import bierze pola jak przed zapisem A6.
    v_pend := null;
    v_exp_out := null;
    v_out_rev := null;
    v_pending_wt := '{}';
    if p_dry_run is false and v_write_on is true then
      select o.patch, o.expected_file, o.rev into v_pend, v_exp_out, v_out_rev
        from public.ksh_sync_outbound o
       where o.load_id = r.load_id and o.status = 'pending'
       order by o.id
       limit 1;
      if v_pend is not null and v_pend <> '{}'::jsonb then
        foreach v_f in array array['load_date','load_time','delivery_date','delivery_time','carrier_order_no','hhl_order_no']
        loop
          if v_f = any (v_fields) and (v_pend ? v_f) then
            v_file_val := nullif(btrim(coalesce(r.inc->>v_f, '')), '');
            v_exp_val := case v_f
              when 'load_date' then nullif(btrim(coalesce(v_exp_out->>'ld', '')), '')
              when 'load_time' then nullif(btrim(coalesce(v_exp_out->>'lt', '')), '')
              when 'delivery_date' then nullif(btrim(coalesce(v_exp_out->>'dd', '')), '')
              when 'delivery_time' then nullif(btrim(coalesce(v_exp_out->>'dt', '')), '')
              when 'carrier_order_no' then nullif(btrim(coalesce(v_exp_out->>'co', '')), '')
              when 'hhl_order_no' then nullif(btrim(coalesce(v_exp_out->>'ho', '')), '')
            end;
            -- F7 r6/r7 B1: file-changed zawsze; p_quiet tylko powiadomienia (bulk_quiet w decision_open).
            -- F7 06:08: klucz z polem i rev pozycji w kolejce.
            if v_file_val is distinct from v_exp_val then
              perform public.l1b_note_file_changed(
                p_project, r.load_id, r.code, v_f, coalesce(v_out_rev, 1));
            end if;
            v_pending_wt := array_append(v_pending_wt, v_f);
            v_fields := array_remove(v_fields, v_f);
            -- #583: zapis idzie po v_apply_fields — pending musi też je czyścić (inaczej SNAP-B nadpisuje SNAP-C).
            v_apply_fields := array_remove(v_apply_fields, v_f);
          end if;
        end loop;
      end if;
    end if;
    -- L-1b / HOTFIX #384 pkt 3: konflikt numeru tylko bez pending na hhl (sprawa :pending już wyżej).
    -- F7 r8 BLOKER 1: coalesce — przy v_pend=NULL `?` daje NULL i wyłączało sprawę.
    -- F7 #2 / #426: przy p_quiet nie otwieraj spraw TOWER_KSH_CONFLICT (bez :pending).
    if p_dry_run is false
       and v_run_quiet is not true
       and v_has_hhl_col
       and not coalesce(v_pend ? 'hhl_order_no', false)
       and nullif(btrim(r.hhl_order_no), '') is not null
       and nullif(btrim(coalesce(r.inc->>'hhl_order_no', r.inc->>'hhlOrderNo', '')), '') is not null
       and nullif(btrim(r.hhl_order_no), '') is distinct from
           nullif(btrim(coalesce(r.inc->>'hhl_order_no', r.inc->>'hhlOrderNo', '')), '') then
      perform l1b_note_conflict(
        p_project, r.load_id, r.code, r.hhl_order_no,
        coalesce(r.inc->>'hhl_order_no', r.inc->>'hhlOrderNo'));
    end if;
    -- F7 r3 drobne: pending A6 nie trafia do schedule_row (po anulowaniu kolejki wraca plik).
    if coalesce(cardinality(v_pending_wt), 0) > 0 then
      foreach v_f in array v_pending_wt loop
        if (v_f = any (coalesce(v_omit_sched, '{}'::text[]))) is not true then
          v_omit_sched := array_append(v_omit_sched, v_f);
        end if;
      end loop;
    end if;
    -- F7 r2 A / r3 pkt 2: odśwież schedule_row tylko gdy się zmienia; bez updated_at (audyt).
    v_sched_row := (coalesce(r.inc, '{}'::jsonb) - '_qty_empty');
    if coalesce(cardinality(v_omit_sched), 0) > 0 then
      v_sched_row := v_sched_row - v_omit_sched;
    end if;
    if p_dry_run is false and r.item_id is not null then
      update shipment_items
         set schedule_row = v_sched_row
       where id = r.item_id
         and schedule_row is distinct from v_sched_row;
    end if;

    if cardinality(v_fields) = 0 then v_unchanged := v_unchanged + 1; continue; end if;

    -- F7 r8 POPRAWKA 3: CANCELLED → blocked tylko gdy są zmiany pól (puste = unchanged wyżej).
    if r.status = 'CANCELLED' then
      v_blocked := v_blocked || jsonb_build_object('code', r.code, 'load_id', r.load_id, 'reason', 'CANCELLED',
                     'message', 'Transport anulowany — przywrócenie wyłącznie ręcznie przez HHL');
      continue;
    end if;

    -- DATY-67: daty z pliku zawsze stosowane; informacyjnie lista zmian dat (bez blokady)
    -- F7 r2 B: tylko pola z v_apply_fields (konflikt multi-code nie zapisuje dat „z v_fields”).
    v_keep := false;
    if ('load_date' = any (v_apply_fields) or 'delivery_date' = any (v_apply_fields)
        or 'load_time' = any (v_apply_fields) or 'delivery_time' = any (v_apply_fields)) then
      v_confirmed := v_confirmed || jsonb_build_object('code', r.code, 'load_id', r.load_id,
                       'before', jsonb_build_object('load_date', r.prev->'load_date', 'delivery_date', r.prev->'delivery_date',
                                                    'load_time', r.prev->'load_time', 'delivery_time', r.prev->'delivery_time'),
                       'after', jsonb_build_object('load_date', r.inc->'load_date', 'delivery_date', r.inc->'delivery_date',
                                                   'load_time', r.inc->'load_time', 'delivery_time', r.inc->'delivery_time'),
                       'overwrite', true);
    end if;

    -- D-20261020-1157-01: ciche pierwsze uzupelnienie pustych godzin (import_quiet_hours).
    -- B1 F7: puste takze w loads (nie tylko w schedule_row) — godziny wpisane przez KSH/HHL nie nadpisywac cicho.
    -- F7 r3 drobne: licz z v_apply_fields (pominięte wagi nie blokują quiet).
    v_quiet_fill := v_quiet_on
      and cardinality(v_apply_fields) > 0
      and v_apply_fields <@ array['load_time','delivery_time']::text[]
      and (
        not ('load_time' = any (v_apply_fields))
        or (nullif(btrim(r.prev->>'load_time'), '') is null
            and nullif(btrim(r.inc->>'load_time'), '') is not null
            and r.plan_load_from is null and r.plan_load_to is null)
      )
      and (
        not ('delivery_time' = any (v_apply_fields))
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
    -- F7 r2 B: critical tylko z v_apply_fields (pominięty konflikt dat nie jest krytyczny).
    v_crit := case
      when v_quiet_fill or v_historic then '{}'::text[]
      when r.awizowany then
        array(select f from unnest(v_apply_fields) f where f in ('load_date','load_time','delivery_date','delivery_time'))
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
                   'quiet_hist', v_historic,
                   'pending_wt', to_jsonb(v_pending_wt),
                   'skip_reason', case when v_skip_reasons = '{}'::jsonb then null else v_skip_reasons end);
    if cardinality(v_crit) > 0 then v_critical := v_critical || jsonb_build_object('code', r.code, 'fields', to_jsonb(v_crit)); end if;

    -- F7: dry_run też liczy dates_check (zmiana istniejącego)
    if coalesce((r.inc->>'dates_to_check')::boolean, false) is true then
      v_dates_check_n := v_dates_check_n + 1;
    end if;

    -- #583: bez pól do zastosowania (tylko skip tablic) — nie zapisuj
    if p_dry_run is false and cardinality(v_apply_fields) > 0 then
      if v_import is null then
        insert into schedule_imports (project_id, version, source, file_path, file_hash, file_name, column_map, stats, imported_by)
        values (p_project, v_version, v_source, p_file->>'path', p_file->>'hash', p_file->>'name',
                coalesce(p_file->'column_map', '{}'::jsonb), '{}'::jsonb, v_user)
        returning id into v_import;
      end if;
      -- F7 #586 BLOKER 1: wymiary i cargo_class tylko gdy w v_apply_fields (pusta komórka nie kasuje).
      update shipment_items set
        item_type = case when 'item_type' = any (v_apply_fields) then r.inc->>'item_type' else item_type end,
        cargo_class = case when 'cargo_class' = any (v_apply_fields)
          then coalesce(r.inc->>'cargo_class', 'DIMENSIONED') else cargo_class end,
        length_m = case when 'length_m' = any (v_apply_fields) then (r.inc->>'length_m')::numeric else length_m end,
        width_m = case when 'width_m' = any (v_apply_fields) then (r.inc->>'width_m')::numeric else width_m end,
        height_m = case when 'height_m' = any (v_apply_fields) then (r.inc->>'height_m')::numeric else height_m end,
        unit_weight_t = case when 'unit_weight_t' = any (v_apply_fields)
          then (r.inc->>'unit_weight_t')::numeric else unit_weight_t end,
        qty = case when 'qty' = any (v_apply_fields) then (r.inc->>'qty')::int else qty end,
        total_weight_t = case when 'total_weight_t' = any (v_apply_fields)
          then (r.inc->>'total_weight_t')::numeric else total_weight_t end,
        assembly_seq = case when 'assembly_seq' = any (v_apply_fields)
          then (r.inc->>'assembly_seq')::int else assembly_seq end,
        -- schedule_row odświeżone wyżej (F7 r2 A); tu tylko znacznik importu
        last_seen_import = v_import, updated_at = now()
       where id = r.item_id;
      if 'load_date' = any (v_apply_fields) or 'delivery_date' = any (v_apply_fields) or 'order_no' = any (v_apply_fields)
         or 'load_time' = any (v_apply_fields) or 'delivery_time' = any (v_apply_fields) then
        -- G-20 / D-20261014-0015-01 R1: kontekst importu — strażnik przepuszcza daty z pliku
        perform set_config('tower.import_ctx', 'on', true);
        if v_quiet_fill or v_historic then
          v_prev_quiet := current_setting('tower.bulk_quiet', true);
          perform set_config('tower.bulk_quiet', 'on', true);
        end if;
        -- F7 r2 B: data/godzina tylko z v_apply_fields (pending + konflikt multi-code).
        if 'load_date' = any (v_apply_fields) then
          v_new_load_date := coalesce((r.inc->>'load_date')::date, r.plan_load_date);
        else
          v_new_load_date := r.plan_load_date;
        end if;
        if 'delivery_date' = any (v_apply_fields) then
          v_new_del_date := coalesce((r.inc->>'delivery_date')::date, r.plan_delivery_date);
        else
          v_new_del_date := r.plan_delivery_date;
        end if;
        -- #384 F7 r2/r3: pusta komórka godziny = bez zmiany (nie null).
        -- Zmiana daty bez godziny → wspólna delta (v_new_date - plan_*_date) dla od i do; strażnik do > od.
        if 'load_time' = any (v_apply_fields) and nullif(btrim(r.inc->>'load_time'), '') is not null then
          v_new_load_from := public.schedule_cell_ts(v_new_load_date, r.inc->>'load_time', 'Europe/Warsaw');
          -- F7 r5: nieczytelna godzina nie kasuje okna (pas bezpieczeństwa przy filtrze wyżej).
          if v_new_load_from is null then
            v_new_load_from := r.plan_load_from;
            v_new_load_to := r.plan_load_to;
          else
            v_new_load_to := case
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
          end if;
        elsif 'load_date' = any (v_apply_fields)
              and v_new_load_date is distinct from r.plan_load_date
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
        if 'delivery_time' = any (v_apply_fields) and nullif(btrim(r.inc->>'delivery_time'), '') is not null then
          v_new_del_to := public.schedule_cell_ts(v_new_del_date, r.inc->>'delivery_time', 'Europe/Stockholm');
          -- F7 r5: nieczytelna godzina nie kasuje okna dostawy.
          if v_new_del_to is null then
            v_new_del_to := r.plan_delivery_to;
            v_new_del_from := r.plan_delivery_from;
          else
            v_new_del_from := case
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
          end if;
        elsif 'delivery_date' = any (v_apply_fields)
              and v_new_del_date is distinct from r.plan_delivery_date
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
        -- F7 r2 B: tylko pola z v_apply_fields (daty analogicznie do zasobów).
        update loads set
          plan_load_date = case when 'load_date' = any (v_apply_fields)
            then coalesce(v_new_load_date, plan_load_date) else plan_load_date end,
          plan_delivery_date = case when 'delivery_date' = any (v_apply_fields)
            then coalesce(v_new_del_date, plan_delivery_date) else plan_delivery_date end,
          plan_load_from = case when 'load_date' = any (v_apply_fields) or 'load_time' = any (v_apply_fields)
            then v_new_load_from else plan_load_from end,
          plan_load_to = case when 'load_date' = any (v_apply_fields) or 'load_time' = any (v_apply_fields)
            then v_new_load_to else plan_load_to end,
          plan_delivery_from = case when 'delivery_date' = any (v_apply_fields) or 'delivery_time' = any (v_apply_fields)
            then v_new_del_from else plan_delivery_from end,
          plan_delivery_to = case when 'delivery_date' = any (v_apply_fields) or 'delivery_time' = any (v_apply_fields)
            then v_new_del_to else plan_delivery_to end,
          order_no = case when 'order_no' = any (v_apply_fields)
            then coalesce(nullif(btrim(coalesce(r.inc->>'order_no', '')), ''), order_no) else order_no end,
          updated_at = now()
         where id = r.load_id;
        if v_quiet_fill or v_historic then
          perform set_config('tower.bulk_quiet', coalesce(v_prev_quiet, ''), true);
        end if;
        perform set_config('tower.import_ctx', '', true);
      end if;
      -- A6: zasoby/numery — F7 r5 N9: tylko pola z v_fields.
      if (v_apply_fields && v_res_fields) then
        -- F7 BLOKER 2 (#560): import_ctx także wokół UPDATE zasobów/numerów (bez echa do pliku).
        perform set_config('tower.import_ctx', 'on', true);
        update loads set
          hhl_order_no = case when 'hhl_order_no' = any (v_apply_fields)
            then coalesce(nullif(btrim(coalesce(r.inc->>'hhl_order_no', '')), ''), hhl_order_no) else hhl_order_no end,
          carrier_order_no = case when 'carrier_order_no' = any (v_apply_fields)
            then coalesce(nullif(btrim(coalesce(r.inc->>'carrier_order_no', '')), ''), carrier_order_no) else carrier_order_no end,
          driver_name = case when 'driver_name' = any (v_apply_fields)
            then coalesce(nullif(btrim(coalesce(r.inc->>'driver_name', '')), ''), driver_name) else driver_name end,
          driver_phone = case when 'driver_phone' = any (v_apply_fields)
            then coalesce(nullif(btrim(coalesce(r.inc->>'driver_phone', '')), ''), driver_phone) else driver_phone end,
          driver_delivery_name = case when 'driver_delivery_name' = any (v_apply_fields)
            then coalesce(nullif(btrim(coalesce(r.inc->>'driver_delivery_name', '')), ''), driver_delivery_name) else driver_delivery_name end,
          driver_delivery_phone = case when 'driver_delivery_phone' = any (v_apply_fields)
            then coalesce(nullif(btrim(coalesce(r.inc->>'driver_delivery_phone', '')), ''), driver_delivery_phone) else driver_delivery_phone end,
          tractor_plate = case when 'tractor_plate' = any (v_apply_fields)
            then coalesce(nullif(btrim(coalesce(r.inc->>'tractor_plate', '')), ''), tractor_plate) else tractor_plate end,
          tractor_delivery_plate = case when 'tractor_delivery_plate' = any (v_apply_fields)
            then coalesce(nullif(btrim(coalesce(r.inc->>'tractor_delivery_plate', '')), ''), tractor_delivery_plate) else tractor_delivery_plate end,
          trailer_plate = case when 'trailer_plate' = any (v_apply_fields)
            then coalesce(nullif(btrim(coalesce(r.inc->>'trailer_plate', '')), ''), trailer_plate) else trailer_plate end,
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

  -- #590: decyzje KSH_CARRIER_CHANGED z skipped_carrier_rows (także dry_run)
  perform import_apply_carrier_skips(p_project, p_file, p_dry_run, v_run_quiet, v_user);

  -- nieobecne w pliku: kandydaci do anulowania (tylko gdy plik ma przyjęte wiersze)
  if jsonb_array_length(p_rows) > 0 then
    for c in
      select si.shipment_code as code, l.id as load_id, l.status,
             exists (select 1 from invoice_lines il where il.load_id = l.id) as invoiced
        from shipment_items si join loads l on l.id = si.load_id
       where si.project_id = p_project and l.status <> 'CANCELLED'
         and l.removed_at is null
         and si.cargo_class is distinct from 'STANDARD'
         and not exists (select 1 from _imp i where i.code = si.shipment_code)
         and not exists (
           select 1 from jsonb_array_elements(coalesce(p_file->'skipped_carrier_rows', '[]'::jsonb)) s
            where nullif(btrim(s->>'code'), '') = si.shipment_code
         )
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

  -- #590: kod wrócił jako HH → zamknij KSH_CARRIER_CHANGED
  perform import_close_carrier_skips_resolved(p_project, p_dry_run);

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

