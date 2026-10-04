-- =====================================================================
-- TOWER — Migracja 0145: L-1b — typy decyzji z katalogu §2
--
-- NO_AWIZACJA zostaje w 0143. Tu:
-- KSH_ROW_GONE — wiersz jest w bazie, a w nowym pliku Excela go nie ma
-- TOWER_KSH_CONFLICT — numer HHL wpisany w Watch Tower różni się od pliku
--   (katalog §2.7, przykład „nr HHL”; innych pól katalog nie wymienia)
-- KSH_FILE_ERROR — pliku nie da się odczytać (osobne wywołanie z aplikacji)
-- SEFS_OUT_OF_TABLE — brak odczytów poprzedniego tygodnia albo średnia
--   ponad ostatni próg tabeli projektu (ten sam warunek co sefs_compute_hybrid;
--   tabela handlowa ma 51 progów, kod nie wpisuje liczby 51)
-- KR_OVER_3 — więcej niż 3 ładunki rodziny KR jednego dnia załadunku
--   (ta sama definicja co kr_convoy_count; 3 jest w typie decyzji, nie w Opcjach)
--
-- STOP: DWELL_OVER_FREE. Czas wolny 6 h / 4 h jest w cenniku (I-32) i w
-- load_dwell_info, ale „od kiedy” nie jest ustalone, a Opcje nie mają
-- tego progu. Sztywne 360/240 nie wchodzą. Brak progu w Opcjach = brak alarmu.
--
-- Jedno zdarzenie = jedna decyzja (decision_open_from_event).
-- Brak danych (pusty kod, pusty numer HHL, brak daty) = brak decyzji.
-- Czas: daty z pliku są datami kalendarzowymi; godzina załadunku w imporcie
-- jest Europe/Warsaw (schedule_cell_ts, bez zmian w tym pliku).
-- =====================================================================

create or replace function public.l1b_note_row_gone(p_project uuid, p_load uuid, p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $l1b$
begin
  if p_project is null or p_load is null or nullif(btrim(p_code), '') is null then
    return null;
  end if;
  return decision_open_from_event(
    p_project, 'KSH_ROW_GONE',
    'l1b:row-gone:' || p_project::text || ':' || btrim(p_code),
    'Wiersz zniknął z pliku KSH',
    jsonb_build_object('code', btrim(p_code)),
    p_load, null
  );
end
$l1b$;
revoke all on function public.l1b_note_row_gone(uuid, uuid, text) from public, anon, authenticated;

create or replace function public.l1b_note_conflict(
  p_project uuid, p_load uuid, p_code text, p_tower text, p_file text
) returns uuid
language plpgsql
security definer
set search_path = public
as $l1b$
begin
  if p_project is null or p_load is null or nullif(btrim(p_code), '') is null then
    return null;
  end if;
  if nullif(btrim(p_tower), '') is null then
    return null;
  end if;
  if nullif(btrim(p_tower), '') is not distinct from nullif(btrim(p_file), '') then
    return null;
  end if;
  return decision_open_from_event(
    p_project, 'TOWER_KSH_CONFLICT',
    'l1b:conflict:' || p_project::text || ':' || btrim(p_code) || ':hhl_order_no',
    'Numer HHL w Watch Tower różni się od pliku KSH',
    jsonb_build_object('code', btrim(p_code), 'tower', btrim(p_tower), 'file', nullif(btrim(p_file), '')),
    p_load, null
  );
end
$l1b$;
revoke all on function public.l1b_note_conflict(uuid, uuid, text, text, text) from public, anon, authenticated;

create or replace function public.l1b_ksh_file_unreadable(p_project uuid, p_file_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $l1b$
begin
  if auth.uid() is not null and (is_hhl()) is not true then
    raise exception 'Plik KSH — wyłącznie HHL' using errcode = '42501';
  end if;
  if p_project is null or nullif(btrim(p_file_name), '') is null then
    raise exception 'Brak projektu albo nazwy pliku' using errcode = '22023';
  end if;
  return decision_open_from_event(
    p_project, 'KSH_FILE_ERROR',
    'l1b:file:' || p_project::text || ':' || btrim(p_file_name),
    'Pliku KSH nie da się odczytać',
    jsonb_build_object('file', btrim(p_file_name)),
    null, null
  );
end
$l1b$;
revoke all on function public.l1b_ksh_file_unreadable(uuid, text) from public, anon;
grant execute on function public.l1b_ksh_file_unreadable(uuid, text) to authenticated;

create or replace function public.l1b_sefs_note(p_project uuid, p_load_date date)
returns text
language plpgsql
security definer
set search_path = public
as $l1b$
declare
  v_week_start date;
  v_prev_start date;
  v_prev_end date;
  v_n_sek int;
  v_n_pln int;
  v_avg_sek numeric;
  v_avg_pln numeric;
  v_tiers_sek jsonb;
  v_tiers_pln jsonb;
  v_max_sek numeric;
  v_max_pln numeric;
  v_reason text;
begin
  if p_project is null or p_load_date is null then
    return null;
  end if;
  v_week_start := p_load_date - ((extract(isodow from p_load_date)::int) - 1);
  v_prev_start := v_week_start - 7;
  v_prev_end := v_week_start - 1;
  select avg(value), count(*) into v_avg_sek, v_n_sek
    from fuel_index_readings r
   where r.project_id = p_project and r.index_code = 'SEK' and r.corrects_id is null
     and r.period ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
     and r.period::date between v_prev_start and v_prev_end;
  select avg(value), count(*) into v_avg_pln, v_n_pln
    from fuel_index_readings r
   where r.project_id = p_project and r.index_code = 'PLN' and r.corrects_id is null
     and r.period ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
     and r.period::date between v_prev_start and v_prev_end;
  select sp.tiers_sek, sp.tiers_pln into v_tiers_sek, v_tiers_pln
    from sefs_parameters sp
   where sp.project_id = p_project
   order by sp.version desc
   limit 1;
  if (v_n_sek > 0 and v_n_pln > 0 and v_avg_sek is not null and v_avg_pln is not null and v_tiers_sek is not null) is not true then
    v_reason := 'SOURCE';
  else
    select max((t->>'lte')::numeric) into v_max_sek from jsonb_array_elements(v_tiers_sek) t;
    select max((t->>'lte')::numeric) into v_max_pln from jsonb_array_elements(v_tiers_pln) t;
    if v_max_sek is null or v_max_pln is null or v_avg_sek > v_max_sek or v_avg_pln > v_max_pln then
      v_reason := case when v_max_sek is null or v_max_pln is null then 'SOURCE' else 'OVER' end;
    else
      v_reason := 'OK';
    end if;
  end if;
  if v_reason in ('SOURCE', 'OVER') then
    perform decision_open_from_event(
      p_project, 'SEFS_OUT_OF_TABLE',
      'l1b:sefs:' || p_project::text || ':' || v_prev_start::text || ':' || v_reason,
      case when v_reason = 'SOURCE' then 'SEFS: brak źródła indeksu' else 'SEFS: indeks poza tabelą progów' end,
      jsonb_build_object('reason', v_reason, 'prev_week_start', v_prev_start, 'load_date', p_load_date),
      null, null
    );
  end if;
  return v_reason;
end
$l1b$;
revoke all on function public.l1b_sefs_note(uuid, date) from public, anon, authenticated;

create or replace function public.l1b_kr_check(p_project uuid, p_day date)
returns int
language plpgsql
security definer
set search_path = public
as $l1b$
declare
  v_n int;
begin
  if p_project is null or p_day is null then
    return null;
  end if;
  select count(distinct l.id)::int into v_n
    from loads l
    join shipment_items si on si.load_id = l.id
   where l.project_id = p_project
     and l.plan_load_date = p_day
     and l.status is distinct from 'CANCELLED'
     and shipment_family(si.shipment_code) = 'KR';
  if v_n > 3 then
    perform decision_open_from_event(
      p_project, 'KR_OVER_3',
      'l1b:kr:' || p_project::text || ':' || p_day::text,
      'Więcej niż 3 ładunki KR jednego dnia',
      jsonb_build_object('day', p_day, 'count', v_n),
      null, null
    );
  end if;
  return v_n;
end
$l1b$;
revoke all on function public.l1b_kr_check(uuid, date) from public, anon, authenticated;

create or replace function public.l1b_scan()
returns int
language plpgsql
security definer
set search_path = public
as $l1b$
declare
  r record;
  n int := 0;
begin
  for r in
    select distinct l.project_id, l.plan_load_date as d
      from loads l
      join shipment_items si on si.load_id = l.id
     where l.plan_load_date is not null
       and l.status is distinct from 'CANCELLED'
       and shipment_family(si.shipment_code) = 'KR'
  loop
    perform l1b_kr_check(r.project_id, r.d);
    n := n + 1;
  end loop;
  for r in
    select distinct l.project_id, l.plan_load_date as d
      from loads l
     where l.plan_load_date is not null
       and l.status is distinct from 'CANCELLED'
  loop
    perform l1b_sefs_note(r.project_id, r.d);
    n := n + 1;
  end loop;
  return n;
end
$l1b$;
revoke all on function public.l1b_scan() from public, anon, authenticated;


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
  v_skipped   int := 0;
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
    select i.code, i.row as inc, si.id as item_id, si.load_id, l.status, l.carrier_org_id, l.hhl_order_no,
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
    -- L-1b: numer HHL wpisany w Watch Tower różni się od numeru w pliku (katalog §2.7).
    if p_dry_run is false
       and nullif(btrim(r.hhl_order_no), '') is not null
       and nullif(btrim(r.hhl_order_no), '') is distinct from nullif(btrim(r.inc->>'order_no'), '') then
      perform l1b_note_conflict(p_project, r.load_id, r.code, r.hhl_order_no, r.inc->>'order_no');
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
         and si.cargo_class is distinct from 'STANDARD'
         and not exists (select 1 from _imp i where i.code = si.shipment_code)
       order by si.shipment_code
    loop
      if p_dry_run is false then
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
                  jsonb_build_object('code', c.code, 'version', v_version, 'reason', 'Usunięty z harmonogramu', 'file', p_file->>'name'));
          v_cancelled := v_cancelled || jsonb_build_object('code', c.code, 'load_id', c.load_id);
        end if;
      end if;
    end loop;
  end if;

  if p_dry_run is false then
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
        'skipped_standard', v_skipped + coalesce((p_file->>'skipped_standard')::int, 0))
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
    'skipped_standard', v_skipped + coalesce((p_file->>'skipped_standard')::int, 0),
    'ms', round(extract(epoch from clock_timestamp() - t0) * 1000));
end $function$;

create or replace function public.detect_silent_vehicles(p_minutes integer default 90)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n int := 0;
  r record;
  v_min int;
  v_connected boolean;
  v_moving boolean;
begin
  -- L-1b: KR i SEFS nie zależą od GPS. Postój DWELL_OVER_FREE tu nie wchodzi (STOP).
  perform l1b_scan();
  v_min := l3_ops('SILENT_MIN')::int;
  if v_min is null then
    return 0;
  end if;
  for r in
    select l.id, l.project_id, l.tractor_plate, l.status, l.telematics_vehicle_id,
           max(p.ts) as last_fix
      from loads l
      left join positions p on p.load_id = l.id
     group by l.id
  loop
    v_moving := r.status in ('IN_TRANSIT_PL', 'AT_PORT_GDANSK', 'AT_PORT_NYNASHAMN', 'IN_TRANSIT_SE');
    v_connected := r.telematics_vehicle_id is not null or exists (
      select 1 from positions p
       where p.load_id = r.id and p.source in ('TELEMATICS_API', 'RFMS', 'DRIVER_PWA')
    );
    if l3_silent_alarm(r.last_fix, now(), v_connected, v_moving) is not true then
      update risk_signals set resolved_at = now()
       where dedup_key = 'SILENT:' || r.id and resolved_at is null and detail->>'l3' = '1';
      if found then
        perform l3_lapse('SILENT:' || r.id, now());
      end if;
      continue;
    end if;
    n := n + l3_upsert_alarm(
      r.project_id, r.id, 'SILENT_VEHICLE', 'SILENT:' || r.id,
      format('Brak pozycji pojazdu %s od %s min', coalesce(r.tractor_plate, '?'), v_min),
      'rk_silent_vehicle',
      true,
      true,
      now() + interval '1 hour',
      jsonb_build_object(
        'last_fix', r.last_fix, 'threshold_min', v_min,
        'params', jsonb_build_object('plate', coalesce(r.tractor_plate, '?'), 'minutes', v_min)
      ),
      now()
    );
  end loop;
  return n;
end $$;
