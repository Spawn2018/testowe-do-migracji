-- A6 · import_schedule: zasoby/numery, KSH_DATES_CHECK (L31), renumbered_from (E38)
-- Po 0302. Nie edytować nałożonej migracji.

-- ---------------------------------------------------------------------------
-- Kolumna renumeracji + helpery
-- ---------------------------------------------------------------------------
alter table public.shipment_items
  add column if not exists renumbered_from text;

comment on column public.shipment_items.renumbered_from is
  'A6/E38: poprzedni kod Wysyłka przy „Wcześniej to był SG-…”';

create or replace function public.a6_import_dates_odd(p_load date, p_deliv date)
returns boolean
language sql
immutable
set search_path = public
as $$
  select case
    when p_load is null or p_deliv is null then false
    when p_deliv < p_load then true
    when p_deliv = p_load then true
    when p_deliv > p_load + 14 then true
    else false
  end;
$$;

comment on function public.a6_import_dates_odd(date, date) is
  'A6 L31: dostawa przed / w dniu / >14 dni po załadunku → sprawa KSH_DATES_CHECK.';

revoke all on function public.a6_import_dates_odd(date, date) from public, anon, authenticated;

create or replace function public.a6_renumber_from_comment(p_comment text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  v text;
begin
  if p_comment is null or btrim(p_comment) = '' then
    return null;
  end if;
  -- „Wcześniej to był SG-11” / „Wczesniej to byl SG-11” (bez ogonków)
  v := (regexp_match(
    p_comment,
    'wcze[sś]niej[[:space:]]+to[[:space:]]+by[łl][[:space:]]+([A-Za-z0-9._/-]+)',
    'i'
  ))[1];
  if v is null or btrim(v) = '' then
    return null;
  end if;
  return btrim(v);
end;
$$;

comment on function public.a6_renumber_from_comment(text) is
  'A6/E38: wyciąga stary kod z komentarza „Wcześniej to był …”';

revoke all on function public.a6_renumber_from_comment(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- schedule_row_canon — pola zasobów/numerów do porównania
-- ---------------------------------------------------------------------------
create or replace function public.schedule_row_canon(r jsonb) returns jsonb
language sql
immutable
set search_path = public
as $$
  select jsonb_build_object(
    'item_type',      nullif(btrim(r->>'item_type'), ''),
    'cargo_class',    case when upper(btrim(r->>'cargo_class')) = 'STANDARD' then 'STANDARD' end,
    'length_m',       round((nullif(r->>'length_m', ''))::numeric, 2),
    'width_m',        round((nullif(r->>'width_m', ''))::numeric, 2),
    'height_m',       round((nullif(r->>'height_m', ''))::numeric, 2),
    'unit_weight_t',  round((nullif(r->>'unit_weight_t', ''))::numeric, 3),
    'qty',            coalesce((nullif(r->>'qty', ''))::int, 1),
    'total_weight_t', round((nullif(r->>'total_weight_t', ''))::numeric, 3),
    'load_date',      (nullif(r->>'load_date', ''))::date,
    'load_time',      nullif(r->>'load_time', ''),
    'delivery_date',  (nullif(r->>'delivery_date', ''))::date,
    'delivery_time',  nullif(r->>'delivery_time', ''),
    'order_no',       nullif(btrim(r->>'order_no'), ''),
    'assembly_seq',   (nullif(r->>'assembly_seq', ''))::int,
    'hhl_order_no',   nullif(btrim(coalesce(r->>'hhl_order_no', r->>'hhlOrderNo', '')), ''),
    'carrier_order_no', nullif(btrim(coalesce(r->>'carrier_order_no', r->>'carrierOrderNo', '')), ''),
    'driver_name',    nullif(btrim(r->>'driver_name'), ''),
    'driver_phone',   nullif(btrim(r->>'driver_phone'), ''),
    'driver_delivery_name', nullif(btrim(r->>'driver_delivery_name'), ''),
    'driver_delivery_phone', nullif(btrim(r->>'driver_delivery_phone'), ''),
    'tractor_plate',  nullif(btrim(r->>'tractor_plate'), ''),
    'tractor_delivery_plate', nullif(btrim(r->>'tractor_delivery_plate'), ''),
    'trailer_plate',  nullif(btrim(r->>'trailer_plate'), ''),
    'comment',        nullif(btrim(r->>'comment'), ''));
$$;

revoke all on function public.schedule_row_canon(jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- import_schedule (A6)
-- ---------------------------------------------------------------------------

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
begin
  perform public.assert_not_preview();
  -- is_hhl() zwraca NULL dla konta nieaktywnego / bez wiersza app_users — NULL nie może przepuścić
  if is_hhl() is not true then raise exception 'Import harmonogramu wyłącznie HHL'; end if;
  if p_quiet is true and (current_app_role() = 'HHL_ADMIN') is not true then
    raise exception 'Import bez powiadomień wyłącznie dla Administratora HHL';
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
          values (p_project, v_version, 'UPLOAD', p_file->>'path', p_file->>'hash', p_file->>'name',
                  coalesce(p_file->'column_map', '{}'::jsonb), '{}'::jsonb, v_user)
          returning id into v_import;
        end if;
        insert into loads (
            project_id, hhl_order_no, carrier_order_no, carrier_org_id, status,
            plan_load_date, plan_delivery_date, plan_load_from, plan_delivery_to,
            plan_dates_status, plan_dates_confirmed_at,
            driver_name, driver_phone, driver_delivery_name, driver_delivery_phone,
            tractor_plate, tractor_delivery_plate, trailer_plate)
        values (
            p_project,
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
        values (p_project, v_version, 'UPLOAD', p_file->>'path', p_file->>'hash', p_file->>'name',
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
    -- HOTFIX #384 pkt 4b: cicho gdy status ≥ DELIVERED albo stara i nowa dostawa minione.
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
        -- Zmiana daty bez godziny → wspólna delta (v_new_date − plan_*_date) dla od i do; strażnik do > od.
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
        update loads set
          plan_load_date = coalesce(v_new_load_date, plan_load_date),
          plan_delivery_date = coalesce(v_new_del_date, plan_delivery_date),
          plan_load_from = v_new_load_from,
          plan_load_to = v_new_load_to,
          plan_delivery_from = v_new_del_from,
          plan_delivery_to = v_new_del_to,
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
        if v_quiet_fill or v_historic then
          perform set_config('tower.bulk_quiet', coalesce(v_prev_quiet, ''), true);
        end if;
        perform set_config('tower.import_ctx', '', true);
      elsif v_fields && v_res_fields then
        -- A6: same zasoby/numery (bez zmiany dat)
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

COMMENT ON FUNCTION public.import_schedule(uuid, jsonb, text[], jsonb, boolean, boolean) IS
  'I-1 import KSH. A6/0303: L31 bez raise -> KSH_DATES_CHECK; zasoby/numery; renumber; #426+#384 p_quiet HHL_ADMIN; B5 assert_not_preview; skipped_carrier/empty w stats.';

