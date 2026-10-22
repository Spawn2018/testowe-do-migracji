-- HOTFIX #426 / D-20261022-0138-01: import_schedule(p_quiet) — HHL_ADMIN, tower.bulk_quiet.
-- F7: SMS z 0111+quiet; 0 decyzji L1b; l3_ksh_lead×quiet; wf_enqueue_event×quiet.
-- Migracja 0259.
-- Uwaga: l3_scan (cron) może później otworzyć NO_AWIZ / NO_TRACKING ze stanu danych — dopuszczalne.

-- 1) SMS: treść z 0111 (TEL-1 e164) + wyjście przy tower.bulk_quiet
CREATE OR REPLACE FUNCTION public.trg_sms_load_changes() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $sms$
declare
  s record;
  v_nr text;
  v_to text;
begin
  if current_setting('tower.bulk_quiet', true) = 'on' then
    return new;
  end if;
  if (new.driver_phone is not null and sms_has_driver_link(new.id)) is not true then return new; end if;
  v_to := driver_phone_e164(new.driver_phone, new.driver_phone_country);
  if (v_to is not null) is not true then return new; end if;
  v_nr := coalesce(new.order_no, '—');
  if new.status = 'CANCELLED' and old.status is distinct from 'CANCELLED' then
    perform sms_enqueue('LOAD_CANCELLED', new.id, v_to, new.driver_locale, jsonb_build_object('nr', v_nr),
                        100, 'LOAD_CANCELLED:' || new.id);
    return new;
  end if;
  if new.status in ('CANCELLED', 'UNLOADED', 'DELIVERED') then return new; end if;
  if new.plan_load_from is not null and new.plan_load_to is not null
     and (abs(extract(epoch from (new.plan_load_from - coalesce(old.plan_load_from, new.plan_load_from)))) >= 1800
          or abs(extract(epoch from (new.plan_load_to - coalesce(old.plan_load_to, new.plan_load_to)))) >= 1800)
     and new.status in ('PLANNED', 'RESOURCES_PENDING', 'DOCS_PENDING', 'READY') then
    perform sms_enqueue('WINDOW_CHANGE', new.id, v_to, new.driver_locale,
      jsonb_build_object('nr', v_nr, 'okno', 'LOAD', 'dt', sms_fmt_dt(new.plan_load_from), 't2', to_char(new.plan_load_to at time zone 'Europe/Warsaw', 'HH24:MI')),
      100, 'WINDOW_CHANGE:LOAD:' || new.id || ':' || new.plan_load_from || ':' || new.plan_load_to);
  end if;
  if new.plan_delivery_from is not null and new.plan_delivery_to is not null
     and (abs(extract(epoch from (new.plan_delivery_from - coalesce(old.plan_delivery_from, new.plan_delivery_from)))) >= 1800
          or abs(extract(epoch from (new.plan_delivery_to - coalesce(old.plan_delivery_to, new.plan_delivery_to)))) >= 1800) then
    perform sms_enqueue('WINDOW_CHANGE', new.id, v_to, new.driver_locale,
      jsonb_build_object('nr', v_nr, 'okno', 'DELIVERY', 'dt', sms_fmt_dt(new.plan_delivery_from), 't2', to_char(new.plan_delivery_to at time zone 'Europe/Warsaw', 'HH24:MI')),
      100, 'WINDOW_CHANGE:DELIVERY:' || new.id || ':' || new.plan_delivery_from || ':' || new.plan_delivery_to);
  end if;
  if new.sailing_id is distinct from old.sailing_id and new.sailing_id is not null then
    select v.name as statek, coalesce(sa.delayed_departure_at, sa.departure_at) as dep into s
      from sailings sa left join vessels v on v.id = sa.vessel_id where sa.id = new.sailing_id;
    perform sms_enqueue('SAILING_CHANGE', new.id, v_to, new.driver_locale,
      jsonb_build_object('nr', v_nr, 'statek', coalesce(s.statek, '—'), 'dt', coalesce(sms_fmt_dt(s.dep), '—'), 'ref', coalesce(new.ferry_booking_ref, '—')),
      100, 'SAILING_CHANGE:' || new.id || ':' || new.sailing_id || ':' || coalesce(s.dep::text, ''));
  end if;
  return new;
end
$sms$;

REVOKE ALL ON FUNCTION public.trg_sms_load_changes() FROM public, anon, authenticated;

-- 2) LATE_DATE_CHANGE / ryzyka z insertu — bez zapisu przy tower.bulk_quiet (F7 #3)
CREATE OR REPLACE FUNCTION public.l3_ksh_lead(p_load loads, p_old_date date, p_old_from timestamptz, p_now timestamptz default now())
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  v_new timestamptz;
  v_days int;
  v_n int;
  v_code text;
begin
  if current_setting('tower.bulk_quiet', true) = 'on' then
    return;
  end if;
  v_new := l3_anchor(p_load.plan_load_date, p_load.plan_load_from);
  if v_new is null or v_new <= p_now then
    return;
  end if;
  if l3_lead_alarm(v_new, p_now) is not true then
    return;
  end if;
  if p_load.status not in ('PLANNED', 'RESOURCES_PENDING', 'DOCS_PENDING', 'READY') then
    return;
  end if;
  v_n := l3_ops('LEAD_DAYS')::int;
  v_days := (v_new at time zone 'Europe/Warsaw')::date - (p_now at time zone 'Europe/Warsaw')::date;
  if v_days >= v_n then
    return;
  end if;
  v_code := public.load_sms_code(p_load.id);
  insert into risk_signals (project_id, load_id, kind, severity, title, title_key, detail, dedup_key, detected_at)
  values (
    p_load.project_id, p_load.id, 'LATE_DATE_CHANGE',
    (case when v_days <= 2 then 'HIGH' else 'MEDIUM' end)::risk_severity,
    public.l3_headed(v_code, 'późna zmiana daty — załadunek ' || coalesce(to_char(p_load.plan_load_date, 'DD.MM.YYYY'), to_char(v_new at time zone 'Europe/Warsaw', 'DD.MM.YYYY HH24:MI'))),
    'rk_late_date_change',
    jsonb_build_object(
      'params', jsonb_build_object('code', v_code, 'date', to_char(p_load.plan_load_date, 'DD.MM.YYYY'), 'days', v_n,
                                   'before', to_char(p_old_date, 'DD.MM.YYYY'),
                                   'after', to_char(p_load.plan_load_date, 'DD.MM.YYYY')),
      'text', 'Zmiana daty w pliku KSH, do wcześniejszej daty załadunku zostało mniej niż ' || v_n || ' dni',
      'text_key', 'rk_late_date_change_text',
      'next_action_key', 'rk_late_date_change_next',
      'next_action', 'Przewoźnik: sprawdź awizację i zasoby; HHL: potwierdź z KSH'),
    'late_date:' || p_load.id || ':' || coalesce(p_load.plan_load_date::text, '') || ':' || coalesce(p_load.plan_delivery_date::text, ''),
    p_now)
  on conflict (dedup_key) where dedup_key is not null and resolved_at is null do nothing;
end $$;
REVOKE ALL ON FUNCTION public.l3_ksh_lead(loads, date, timestamptz, timestamptz) FROM public, anon, authenticated;

-- 3) workflow z load_events — bez kolejki przy tower.bulk_quiet (F7 #4; jak wf_enqueue_status)
CREATE OR REPLACE FUNCTION public.wf_enqueue_event() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
begin
  if current_setting('tower.bulk_quiet', true) = 'on' then
    return null;
  end if;
  if (coalesce(new.payload->>'korekta', '') = 'true') is true then
    return null;
  end if;
  insert into workflow_runs (workflow_id, load_id, event_id, status, attempts, next_attempt_at, dedup_key, payload)
  select w.id, new.load_id, new.id, 'QUEUED', 0, now(), 'wf:' || w.id || ':ev:' || new.id,
         jsonb_build_object('event_type', new.event_type, 'occurred_at', new.occurred_at, 'payload', new.payload)
    from workflows w join loads l on l.id = new.load_id
   where w.enabled and w.trigger_type = new.event_type and w.project_id = l.project_id
  on conflict (dedup_key) where dedup_key is not null do nothing;
  return null;
exception when others then
  raise warning 'wf_enqueue_event: %', sqlerrm;
  return null;
end $$;
REVOKE ALL ON FUNCTION public.wf_enqueue_event() FROM public, anon, authenticated;
COMMENT ON FUNCTION public.wf_enqueue_event() IS
  'D-0005 P1 + #426 F7: bulk_quiet bez workflow_runs; korekta bez kolejki; reszta jak 0094/0234.';

-- 4) import_schedule: nowy parametr p_quiet (stara sygnatura 5-arg → DROP)
DROP FUNCTION IF EXISTS public.import_schedule(uuid, jsonb, text[], jsonb, boolean);

CREATE OR REPLACE FUNCTION public.import_schedule(p_project uuid, p_rows jsonb, p_cancel_codes text[] DEFAULT '{}'::text[], p_file jsonb DEFAULT '{}'::jsonb, p_dry_run boolean DEFAULT true, p_quiet boolean DEFAULT false)
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
                              'load_date','load_time','delivery_date','delivery_time','order_no','assembly_seq'];
  v_crit_suppressed int := 0;
begin
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
             'assembly_seq', si.assembly_seq) end) as prev
      from _imp i
      left join shipment_items si on si.project_id = p_project and si.shipment_code = i.code
      left join loads l on l.id = si.load_id
     order by i.code
  loop
    v_historic := false;
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
                jsonb_build_object('action', 'ADDED', 'code', r.code, 'version', v_version, 'file', p_file->>'name',
                                   'quiet', v_run_quiet));
      end if;
      continue;
    end if;

    select coalesce(array_agg(f order by f), '{}') into v_fields
      from unnest(v_fnames) f where coalesce(r.inc -> f, 'null'::jsonb) is distinct from coalesce(r.prev -> f, 'null'::jsonb);
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
        v_new_load_from := case
          when nullif(btrim(r.inc->>'load_time'), '') is not null
            then public.schedule_cell_ts(v_new_load_date, r.inc->>'load_time', 'Europe/Warsaw')
          when 'load_time' = any (v_fields) then null
          else r.plan_load_from end;
        -- pkt 4a: przy zmianie godziny — „do” tylko ta sama data i do > nowe od;
        -- puste od → puste do; inaczej przesuń / wyczyść. Bez godziny w pliku — okno nietknięte.
        if nullif(btrim(r.inc->>'load_time'), '') is not null or 'load_time' = any (v_fields) then
          v_new_load_to := case
            when v_new_load_from is null then null
            when r.plan_load_to is not null
                 and (r.plan_load_to at time zone 'Europe/Warsaw')::date = v_new_load_date
                 and r.plan_load_to > v_new_load_from
              then r.plan_load_to
            when r.plan_load_to is not null and r.plan_load_from is not null and v_new_load_date is not null then
              r.plan_load_to + make_interval(days => (
                v_new_load_date - (r.plan_load_from at time zone 'Europe/Warsaw')::date))
            else null
          end;
          if v_new_load_to is not null and v_new_load_to <= v_new_load_from then
            v_new_load_to := null;
          end if;
        else
          v_new_load_to := r.plan_load_to;
        end if;
        v_new_del_to := case
          when nullif(btrim(r.inc->>'delivery_time'), '') is not null
            then public.schedule_cell_ts(v_new_del_date, r.inc->>'delivery_time', 'Europe/Stockholm')
          when 'delivery_time' = any (v_fields) then null
          else r.plan_delivery_to end;
        if nullif(btrim(r.inc->>'delivery_time'), '') is not null or 'delivery_time' = any (v_fields) then
          v_new_del_from := case
            when v_new_del_to is null then null
            when r.plan_delivery_from is not null
                 and (r.plan_delivery_from at time zone 'Europe/Stockholm')::date = v_new_del_date
                 and r.plan_delivery_from < v_new_del_to
              then r.plan_delivery_from
            when r.plan_delivery_from is not null and r.plan_delivery_to is not null and v_new_del_date is not null then
              r.plan_delivery_from + make_interval(days => (
                v_new_del_date - (r.plan_delivery_to at time zone 'Europe/Stockholm')::date))
            else null
          end;
          if v_new_del_from is not null and v_new_del_from >= v_new_del_to then
            v_new_del_from := null;
          end if;
        else
          v_new_del_from := r.plan_delivery_from;
        end if;
        update loads set
          plan_load_date = coalesce(v_new_load_date, plan_load_date),
          plan_delivery_date = coalesce(v_new_del_date, plan_delivery_date),
          plan_load_from = v_new_load_from,
          plan_load_to = v_new_load_to,
          plan_delivery_from = v_new_del_from,
          plan_delivery_to = v_new_del_to,
          order_no = coalesce(r.inc->>'order_no', order_no),
          updated_at = now()
         where id = r.load_id;
        if v_quiet_fill or v_historic then
          perform set_config('tower.bulk_quiet', coalesce(v_prev_quiet, ''), true);
        end if;
        perform set_config('tower.import_ctx', '', true);
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
    'ms', round(extract(epoch from clock_timestamp() - t0) * 1000));
end $function$;

REVOKE ALL ON FUNCTION public.import_schedule(uuid, jsonb, text[], jsonb, boolean, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.import_schedule(uuid, jsonb, text[], jsonb, boolean, boolean) TO authenticated;

COMMENT ON FUNCTION public.import_schedule(uuid, jsonb, text[], jsonb, boolean, boolean) IS
  'I-1 import KSH. #426: p_quiet tylko HHL_ADMIN — cały przebieg w tower.bulk_quiet + audit SCHEDULE_IMPORT_QUIET; dry_run pokazuje critical.';
