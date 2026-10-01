-- =====================================================================
-- TOWER — Migracja 0113: DATY-67 (PO_SPOTKANIU §6–7)
--   Plik KSH = źródło dat i godzin. Usunięte „Potwierdź daty” (I-18 UI).
--   Opóźnienie nadal od plan_delivery_to (I-25). Godzina z pliku → okno.
--   Zmiana daty < N dni przed załadunkiem → ryzyko LATE_DATE_CHANGE + powiadomienie.
--   Tranzyt docelowy 4 dni (parametr; odcinek rezerwy uczony w II-7b — bez zmiany compute_load_eta).
-- Idempotentna. Nie rusza bramki SMS ani flag SMS_ZONE_*.
-- =====================================================================

-- 1) Godzina z komórki pliku → timestamptz w strefie korytarza
create or replace function public.schedule_cell_ts(p_date date, p_time text, p_tz text)
returns timestamptz
language sql
immutable
set search_path = public
as $$
  select case
    when p_date is null then null
    when nullif(btrim(coalesce(p_time, '')), '') is null then null
    when btrim(p_time) ~ '^\d{1,2}:\d{2}' then
      ((p_date::text || ' ' ||
        lpad(split_part(btrim(p_time), ':', 1), 2, '0') || ':' ||
        left(split_part(btrim(p_time), ':', 2) || '00', 2) || ':00')::timestamp
       at time zone p_tz)
    else null
  end;
$$;
revoke all on function public.schedule_cell_ts(date, text, text) from public, anon, authenticated;

-- 2) Ryzyko „późna zmiana”
alter type risk_kind add value if not exists 'LATE_DATE_CHANGE';

-- 3) Parametry: N dni (było DATE_CONFIRM_DAYS) + cel tranzytu 4 dni
update app_parameters
   set label = 'Późna zmiana daty w pliku KSH — ryzyko gdy załadunek za ≤ N dni (DATY-67 / D-12)',
       source = 'DATY-67 (01.10): N=5; wcześniej I-18 potwierdzenie dat',
       updated_at = now()
 where key = 'DATE_CONFIRM_DAYS';

insert into app_parameters (key, value, label, source)
values (
  'TRANSIT_TARGET_DAYS', 4,
  'Docelowy tranzyt Śrem→Boden [dni]; 5 przy ciężkiej pogodzie SE (II-8). Rezerwa operacyjna — II-7b.',
  'DATY-67 / PO_SPOTKANIU §6'
)
on conflict (key) do update
  set value = excluded.value,
      label = excluded.label,
      source = excluded.source,
      updated_at = now()
 where (app_parameters.value, app_parameters.label, app_parameters.source)
   is distinct from (excluded.value, excluded.label, excluded.source);

-- 4) Audience: późna zmiana → HHL + przewoźnik (dostosowanie)
create or replace function public.risk_audience_for(p_kind text, p_detail jsonb)
returns risk_audience
language plpgsql
stable
security definer
set search_path = public
as $function$
declare v_dir text; v_inv text;
begin
  if auth.uid() is not null and current_app_user_id() is null then
    raise exception 'Brak aktywnego konta' using errcode = '42501';
  end if;
  if p_kind in ('FERRY', 'ROAD_SE', 'ROAD_PL', 'WEATHER', 'ETA_BREACH') then
    return 'WSZYSCY';
  end if;
  if p_kind = 'RESOURCE_MISSING' and coalesce(p_detail->>'rule', '') = 'ORDER_NO'
     and coalesce(p_detail->>'side', '') = 'HHL' then
    return 'HHL';
  end if;
  if p_kind in ('SILENT_VEHICLE', 'AUTO_STATUS', 'LOADING_UNCONFIRMED', 'RESOURCE_MISSING',
                'DOC_MISSING', 'PERMIT', 'INSURANCE', 'LATE_DATE_CHANGE') then
    return 'HHL_PRZEWOZNIK';
  end if;
  if p_kind in ('SEQUENCE', 'DATES_UNCONFIRMED') then
    return 'HHL_KLIENT';
  end if;
  if p_kind = 'INVOICE_MISMATCH' then
    v_dir := upper(coalesce(p_detail->>'direction', ''));
    v_inv := p_detail->>'invoice_id';
    if v_dir = '' and v_inv ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      select i.direction::text into v_dir from invoices i where i.id = v_inv::uuid;
    end if;
    return case coalesce(v_dir, '')
             when 'KOSZT' then 'HHL_PRZEWOZNIK'
             when 'PRZYCHOD' then 'HHL_KLIENT'
             else 'HHL' end;
  end if;
  return 'HHL';
end $function$;

-- 5) Guard: status dat — import/system (bez „Potwierdź daty”)
--    Zachowujemy blokadę ręcznego PATCH przez UI; import i wyzwalacz mogą zmieniać przez przed-trigger.
create or replace function public.trg_plan_dates_before() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if current_setting('tower.dates_ctx', true) = 'on' then return new; end if;
  if (new.plan_load_date, new.plan_load_from, new.plan_load_to, new.plan_delivery_date, new.plan_delivery_from, new.plan_delivery_to)
     is distinct from (old.plan_load_date, old.plan_load_from, old.plan_load_to, old.plan_delivery_date, old.plan_delivery_from, old.plan_delivery_to) then
    -- DATY-67: daty z pliku/importu = źródło → oznacz jako POTWIERDZONA (bez autora KSH w UI)
    new.plan_dates_status := 'POTWIERDZONA';
    new.plan_dates_confirmed_by := null;
    new.plan_dates_confirmed_at := now();
  end if;
  return new;
end $$;
revoke all on function public.trg_plan_dates_before() from public, anon, authenticated;

-- 6) Powiadomienie przy każdej zmianie dat + ryzyko późnej zmiany
create or replace function public.trg_plan_dates_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := current_app_user_id();
  v_by text;
  v_payload jsonb;
  v_client uuid;
  v_stamp text := to_char(clock_timestamp(), 'YYYYMMDDHH24MISSUS');
  v_n int;
  v_today date := (now() at time zone 'Europe/Warsaw')::date;
  v_days int;
  v_code text;
  v_rid uuid;
begin
  if (new.plan_load_date, new.plan_load_from, new.plan_load_to, new.plan_delivery_date, new.plan_delivery_from, new.plan_delivery_to)
     is not distinct from (old.plan_load_date, old.plan_load_from, old.plan_load_to, old.plan_delivery_date, old.plan_delivery_from, old.plan_delivery_to) then
    return null;
  end if;
  v_by := case
    when current_setting('tower.dates_ctx', true) = 'on' then 'KSH'
    when auth.uid() is null then 'SYSTEM'
    else 'HHL'
  end;
  select client_org_id into v_client from projects where id = new.project_id;
  v_code := coalesce(new.order_no, left(new.id::text, 8));
  v_payload := jsonb_build_object(
    'code', v_code, 'by', v_by, 'status', new.plan_dates_status,
    'load_date', new.plan_load_date, 'delivery_date', new.plan_delivery_date,
    'before_load_date', old.plan_load_date, 'before_delivery_date', old.plan_delivery_date,
    'load_from', new.plan_load_from, 'load_to', new.plan_load_to,
    'delivery_from', new.plan_delivery_from, 'delivery_to', new.plan_delivery_to);
  insert into load_events (load_id, event_type, occurred_at, actor_id, payload)
  values (new.id, 'PLAN_DATES_CHANGED', now(), v_actor, v_payload);
  insert into notifications (channel, recipient, user_id, load_id, template, payload, dedup_key)
  select 'IN_APP', coalesce(u.email::text, u.id::text), u.id, new.id, 'PLAN_DATES_CHANGED',
         v_payload || jsonb_build_object('locale', u.locale),
         'PLAN_DATES:' || new.id || ':' || v_stamp || ':' || u.id
    from app_users u join organizations o on o.id = u.org_id
   where u.active and u.id is distinct from v_actor
     and (o.kind = 'FORWARDER'
          or (new.carrier_org_id is not null and u.org_id = new.carrier_org_id)
          or (v_client is not null and u.org_id = v_client))
  on conflict (dedup_key) where dedup_key is not null do nothing;

  -- późna zmiana: załadunek za ≤ N dni
  select value::int into v_n from app_parameters where key = 'DATE_CONFIRM_DAYS';
  v_n := coalesce(v_n, 5);
  if new.plan_load_date is not null
     and new.status in ('PLANNED','RESOURCES_PENDING','DOCS_PENDING','READY')
     and new.plan_load_date <= v_today + v_n
     and (new.plan_load_date, new.plan_delivery_date)
         is distinct from (old.plan_load_date, old.plan_delivery_date) then
    v_days := new.plan_load_date - v_today;
    insert into risk_signals (project_id, load_id, kind, severity, title, title_key, detail, dedup_key, detected_at)
    values (
      new.project_id, new.id, 'LATE_DATE_CHANGE',
      (case when v_days <= 2 then 'HIGH' else 'MEDIUM' end)::risk_severity,
      v_code || ': późna zmiana daty — załadunek ' || to_char(new.plan_load_date, 'DD.MM.YYYY'),
      'rk_late_date_change',
      jsonb_build_object(
        'params', jsonb_build_object('code', v_code, 'date', to_char(new.plan_load_date, 'DD.MM.YYYY'), 'days', v_n,
                                     'before', to_char(old.plan_load_date, 'DD.MM.YYYY'),
                                     'after', to_char(new.plan_load_date, 'DD.MM.YYYY')),
        'text', 'Zmiana daty w pliku KSH na ' || v_days || ' dni przed załadunkiem (próg ' || v_n || ')',
        'text_key', 'rk_late_date_change_text',
        'next_action_key', 'rk_late_date_change_next',
        'next_action', 'Przewoźnik: sprawdź awizację i zasoby; HHL: potwierdź z KSH'),
      'late_date:' || new.id || ':' || coalesce(new.plan_load_date::text, '') || ':' || coalesce(new.plan_delivery_date::text, ''),
      now())
    on conflict (dedup_key) where dedup_key is not null and resolved_at is null do nothing
    returning id into v_rid;
  end if;
  return null;
end $$;
revoke all on function public.trg_plan_dates_notify() from public, anon, authenticated;

-- 7) „Potwierdź daty” wyłączone — plik jest źródłem
create or replace function public.ksh_confirm_dates(
  p_load uuid,
  p_load_date date default null,
  p_delivery_date date default null,
  p_load_from timestamptz default null,
  p_load_to timestamptz default null,
  p_delivery_from timestamptz default null,
  p_delivery_to timestamptz default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if (current_app_user_id() is not null) is not true then
    raise exception 'Brak aktywnego konta' using errcode = '42501';
  end if;
  raise exception 'DATY-67: „Potwierdź daty” usunięte — daty i godziny pochodzą z pliku KSH (SharePoint / import)'
    using errcode = 'P0001';
end $$;
revoke all on function public.ksh_confirm_dates(uuid, date, date, timestamptz, timestamptz, timestamptz, timestamptz) from public, anon;
grant execute on function public.ksh_confirm_dates(uuid, date, date, timestamptz, timestamptz, timestamptz, timestamptz) to authenticated;

-- 8) Wykrywanie niepotwierdzonych dat — wyłączone (zamyka otwarte)
create or replace function public.detect_unconfirmed_dates(p_now timestamptz default now()) returns int
language plpgsql security definer set search_path = public as $$
begin
  update risk_signals
     set resolved_at = p_now
   where kind::text = 'DATES_UNCONFIRMED' and resolved_at is null;
  return 0;
end $$;
revoke all on function public.detect_unconfirmed_dates(timestamptz) from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'tower-potwierdzenie-dat';
  end if;
exception when others then
  null; -- brak uprawnień cron na hosted — ignoruj
end $$;

-- 9) import_schedule — DATY-67

CREATE OR REPLACE FUNCTION public.import_schedule(p_project uuid, p_rows jsonb, p_cancel_codes text[] DEFAULT '{}'::text[], p_file jsonb DEFAULT '{}'::jsonb, p_dry_run boolean DEFAULT true)
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
  v_fnames    text[] := array['item_type','cargo_class','length_m','width_m','height_m','unit_weight_t','qty','total_weight_t',
                              'load_date','load_time','delivery_date','delivery_time','order_no','assembly_seq'];
begin
  -- is_hhl() zwraca NULL dla konta nieaktywnego / bez wiersza app_users — NULL nie może przepuścić
  if is_hhl() is not true then raise exception 'Import harmonogramu wyłącznie HHL'; end if;
  if not exists (select 1 from projects where id = p_project) then raise exception 'Nieznany projekt'; end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then raise exception 'Wiersze importu: oczekiwana tablica'; end if;
  perform pg_advisory_xact_lock(hashtext('import_schedule:' || p_project::text));
  select id into v_user from app_users where auth_id = auth.uid();

  -- przewoźnik nowych transportów: jedyny przewoźnik w systemie (inaczej HHL przypisuje ręcznie)
  select case when count(*) = 1 then min(id::text)::uuid end, case when count(*) = 1 then min(name) end
    into v_carrier, v_carrier_n from organizations where kind = 'CARRIER';

  -- walidacja wejścia (druga linia za parserem w przeglądarce): błąd = cała transakcja wycofana
  create temp table if not exists _imp (code text primary key, row jsonb not null) on commit drop;
  truncate _imp;
  for r in select value as v, ordinality as i from jsonb_array_elements(p_rows) with ordinality loop
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
    if (c.canon->>'delivery_date')::date < (c.canon->>'load_date')::date then
      raise exception 'Wiersz % (%): data dostawy przed datą załadunku', r.i, r.v->>'code';
    end if;
    begin
      insert into _imp values (btrim(r.v->>'code'), c.canon);
    exception when unique_violation then
      raise exception 'Kod % występuje w pliku więcej niż raz', btrim(r.v->>'code');
    end;
  end loop;

  -- DATY-67: plik KSH = źródło dat — zawsze nadpisuje (bez overwrite_confirmed)
  v_over := '{}'::text[];

  -- wersja (tylko przy zapisie; nadawana dopiero, gdy są zmiany)
  if p_dry_run is false then
    select coalesce(max(version), 0) + 1 into v_version from schedule_imports where project_id = p_project;
  end if;

  -- nowe i zmienione
  for r in
    select i.code, i.row as inc, si.id as item_id, si.load_id, l.status, l.carrier_org_id,
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
             'assembly_seq', si.assembly_seq) end) as prev
      from _imp i
      left join shipment_items si on si.project_id = p_project and si.shipment_code = i.code
      left join loads l on l.id = si.load_id
     order by i.code
  loop
    if r.item_id is null or r.load_id is null then
      v_added := v_added || jsonb_build_object('code', r.code);
      if p_dry_run is false then
        if v_import is null then
          insert into schedule_imports (project_id, version, source, file_path, file_hash, file_name, column_map, stats, imported_by)
          values (p_project, v_version, 'UPLOAD', p_file->>'path', p_file->>'hash', p_file->>'name',
                  coalesce(p_file->'column_map', '{}'::jsonb), '{}'::jsonb, v_user)
          returning id into v_import;
        end if;
        insert into loads (project_id, order_no, carrier_org_id, status, plan_load_date, plan_delivery_date,
                               plan_load_from, plan_delivery_to, plan_dates_status, plan_dates_confirmed_at)
        values (p_project, r.inc->>'order_no', v_carrier, 'PLANNED',
                (r.inc->>'load_date')::date, (r.inc->>'delivery_date')::date,
                public.schedule_cell_ts((r.inc->>'load_date')::date, r.inc->>'load_time', 'Europe/Warsaw'),
                public.schedule_cell_ts((r.inc->>'delivery_date')::date, r.inc->>'delivery_time', 'Europe/Stockholm'),
                'POTWIERDZONA', now())
        returning id into v_load;
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
                jsonb_build_object('action', 'ADDED', 'code', r.code, 'version', v_version, 'file', p_file->>'name'));
      end if;
      continue;
    end if;

    select coalesce(array_agg(f order by f), '{}') into v_fields
      from unnest(v_fnames) f where coalesce(r.inc -> f, 'null'::jsonb) is distinct from coalesce(r.prev -> f, 'null'::jsonb);
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

    v_crit := case when r.awizowany then
      array(select f from unnest(v_fields) f where f in ('load_date','load_time','delivery_date','delivery_time')) else '{}' end;
    v_changed := v_changed || jsonb_build_object('code', r.code, 'load_id', r.load_id, 'fields', to_jsonb(v_fields),
                   'before', (select jsonb_object_agg(f, r.prev -> f) from unnest(v_fields) f),
                   'after',  (select jsonb_object_agg(f, r.inc -> f) from unnest(v_fields) f),
                   'critical', cardinality(v_crit) > 0);
    if cardinality(v_crit) > 0 then v_critical := v_critical || jsonb_build_object('code', r.code, 'fields', to_jsonb(v_crit)); end if;

    if p_dry_run is false then
      if v_import is null then
        insert into schedule_imports (project_id, version, source, file_path, file_hash, file_name, column_map, stats, imported_by)
        values (p_project, v_version, 'UPLOAD', p_file->>'path', p_file->>'hash', p_file->>'name',
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
        -- status dat ustawia trg_plan_dates_before (POTWIERDZONA = z pliku); nie w UPDATE (guard)
        update loads set
          plan_load_date = coalesce((r.inc->>'load_date')::date, plan_load_date),
          plan_delivery_date = coalesce((r.inc->>'delivery_date')::date, plan_delivery_date),
          plan_load_from = case
            when nullif(btrim(r.inc->>'load_time'), '') is not null
              then public.schedule_cell_ts(coalesce((r.inc->>'load_date')::date, plan_load_date), r.inc->>'load_time', 'Europe/Warsaw')
            when 'load_time' = any (v_fields) then null
            else plan_load_from end,
          plan_load_to = case when 'load_time' = any (v_fields) then null else plan_load_to end,
          plan_delivery_from = case when 'delivery_time' = any (v_fields) then null else plan_delivery_from end,
          plan_delivery_to = case
            when nullif(btrim(r.inc->>'delivery_time'), '') is not null
              then public.schedule_cell_ts(coalesce((r.inc->>'delivery_date')::date, plan_delivery_date), r.inc->>'delivery_time', 'Europe/Stockholm')
            when 'delivery_time' = any (v_fields) then null
            else plan_delivery_to end,
          order_no = coalesce(r.inc->>'order_no', order_no),
          updated_at = now()
         where id = r.load_id;
      end if;
      insert into load_events (load_id, event_type, occurred_at, actor_id, payload)
      values (r.load_id, 'SCHEDULE_IMPORTED', now(), v_user,
              jsonb_build_object('action', 'CHANGED', 'code', r.code, 'version', v_version, 'fields', to_jsonb(v_fields),
                                 'before', (select jsonb_object_agg(f, r.prev -> f) from unnest(v_fields) f),
                                 'after',  (select jsonb_object_agg(f, r.inc -> f) from unnest(v_fields) f)));
      if cardinality(v_crit) > 0 then
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
         and not exists (select 1 from _imp i where i.code = si.shipment_code)
       order by si.shipment_code
    loop
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
            values (p_project, v_version, 'UPLOAD', p_file->>'path', p_file->>'hash', p_file->>'name',
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
                  jsonb_build_object('code', c.code, 'version', v_version, 'reason', 'Usunięty z harmonogramu', 'file', p_file->>'name'));
          v_cancelled := v_cancelled || jsonb_build_object('code', c.code, 'load_id', c.load_id);
        end if;
      end if;
    end loop;
  end if;

  if v_import is not null then
    update schedule_imports set stats = jsonb_build_object(
        'added', jsonb_array_length(v_added), 'changed', jsonb_array_length(v_changed),
        'unchanged', v_unchanged, 'cancelled', jsonb_array_length(v_cancelled),
        'blocked', jsonb_array_length(v_blocked), 'critical', jsonb_array_length(v_critical),
        'confirmed_kept', (select count(*) from jsonb_array_elements(v_confirmed) x where not (x->>'overwrite')::boolean),
        'rows', jsonb_array_length(p_rows), 'rejected', coalesce((p_file->>'rejected')::int, 0))
     where id = v_import;
  end if;

  return jsonb_build_object(
    'dry_run', p_dry_run,
    'version', case when v_import is not null then v_version end,
    'import_id', v_import,
    'rows', jsonb_array_length(p_rows),
    'added', v_added, 'changed', v_changed, 'unchanged', v_unchanged,
    'cancel_candidates', v_cands, 'blocked', v_blocked, 'cancelled', v_cancelled, 'critical', v_critical, 'confirmed', v_confirmed,
    'carrier', v_carrier_n,
    'ms', round(extract(epoch from clock_timestamp() - t0) * 1000));
end $function$;

-- 10) Komunikat guard_load_update (bez „Potwierdź daty”)
do $guard$
declare
  def text := pg_get_functiondef('public.guard_load_update()'::regprocedure);
begin
  if def like '%Potwierdź daty%' then
    def := replace(def,
      'Status dat planu zmienia wyłącznie potwierdzenie KSH („Potwierdź daty”)',
      'Status dat planu ustawia import z pliku KSH (DATY-67) — nie przez PATCH');
    execute def;
  end if;
end $guard$;

-- Zamknij otwarte ryzyka DATES_UNCONFIRMED (mechanizm wyłączony)
update risk_signals set resolved_at = now()
 where kind::text = 'DATES_UNCONFIRMED' and resolved_at is null;
