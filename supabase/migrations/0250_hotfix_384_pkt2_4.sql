-- 0250 - HOTFIX #384 / D-20261021-1130-01 pkt 2-4
-- 2) l3_ksh_lead: tylko NOWA data w przyszlosci i < LEAD_DAYS; zamkniecie starych AUTO_CLOSED
-- 3) l1b_note_conflict: puste p_file = brak konfliktu; import tylko przy kolumnie HHL w mapie;
--    zamkniecie otwartych TOWER_KSH_CONFLICT z file null + powiadomienia przeczytane
-- 4) import: (a) brak godziny do nie kasuje okna; (b) historyczne/dostarczone -> bulk_quiet

create or replace function public.l3_ksh_lead(p_load loads, p_old_date date, p_old_from timestamptz, p_now timestamptz default now())
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new timestamptz;
  v_days int;
  v_n int;
  v_code text;
begin
  v_new := l3_anchor(p_load.plan_load_date, p_load.plan_load_from);
  -- HOTFIX #384: tylko NOWA data załadunku w przyszłości i mniej niż LEAD_DAYS od teraz.
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
  if v_days < 0 or v_days >= v_n then
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
revoke all on function public.l3_ksh_lead(loads, date, timestamptz, timestamptz) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- pkt 3: l1b_note_conflict — puste p_file to nie konflikt
-- ---------------------------------------------------------------------------
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
  -- HOTFIX #384 pkt 3: pusta wartość w pliku = Watch Tower zostaje, bez sprawy.
  if nullif(btrim(p_file), '') is null then
    return null;
  end if;
  if nullif(btrim(p_tower), '') is not distinct from nullif(btrim(p_file), '') then
    return null;
  end if;
  return decision_open_from_event(
    p_project, 'TOWER_KSH_CONFLICT',
    'l1b:conflict:' || p_project::text || ':' || btrim(p_code) || ':hhl_order_no',
    'Numer HHL w Watch Tower różni się od pliku KSH',
    jsonb_build_object('code', btrim(p_code), 'tower', btrim(p_tower), 'file', btrim(p_file)),
    p_load, null
  );
end
$l1b$;
revoke all on function public.l1b_note_conflict(uuid, uuid, text, text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Jednorazowo: zamknięcie spraw poza warunkiem (pkt 2) i fałszywych konfliktów (pkt 3)
-- ---------------------------------------------------------------------------
do $cleanup$
declare
  r record;
  v_ids uuid[] := '{}';
  v_n int;
  v_lead int;
  v_anchor timestamptz;
  v_now timestamptz := now();
begin
  v_lead := coalesce(public.l3_ops('LEAD_DAYS')::int, 5);

  -- pkt 2: otwarte LATE_DATE_CHANGE / KSH_DATE_LT_5D poza oknem
  for r in
    select s.id as risk_id, s.load_id, d.id as decision_id, l.plan_load_date, l.plan_load_from, l.status
      from risk_signals s
      left join loads l on l.id = s.load_id
      left join decisions d on d.risk_id = s.id and d.status in ('NEW','ASSIGNED','SNOOZED')
     where s.kind = 'LATE_DATE_CHANGE' and s.resolved_at is null
  loop
    v_anchor := public.l3_anchor(r.plan_load_date, r.plan_load_from);
    if v_anchor is null
       or v_anchor <= v_now
       or (v_anchor at time zone 'Europe/Warsaw')::date - (v_now at time zone 'Europe/Warsaw')::date >= v_lead
       or (r.status is not null and r.status::text not in ('PLANNED','RESOURCES_PENDING','DOCS_PENDING','READY'))
    then
      update risk_signals set resolved_at = v_now where id = r.risk_id and resolved_at is null;
      if r.decision_id is not null then
        update decisions
           set status = 'RESOLVED', resolution_code = 'AUTO_CLOSED', resolved_at = v_now, updated_at = v_now
         where id = r.decision_id and status in ('NEW','ASSIGNED','SNOOZED');
        insert into decision_events (decision_id, actor_id, action, payload)
        values (r.decision_id, null, 'RESOLVE', jsonb_build_object('option', 'AUTO_CLOSED', 'effect', 'AUTO_CLOSED', 'hotfix', '0250'));
        insert into audit_log (user_id, action, entity, entity_id, new_value)
        values (null, 'DECISION_AUTO_CLOSED', 'decisions', r.decision_id::text,
                jsonb_build_object('reason', 'KSH_DATE_LT_5D poza oknem', 'hotfix', '0250', 'risk_id', r.risk_id));
      else
        insert into audit_log (user_id, action, entity, entity_id, new_value)
        values (null, 'RISK_AUTO_CLOSED', 'risk_signals', r.risk_id::text,
                jsonb_build_object('reason', 'LATE_DATE_CHANGE poza oknem', 'hotfix', '0250'));
      end if;
    end if;
  end loop;

  -- także otwarte decyzje KSH_DATE_LT_5D bez ryzyka / już bez LATE_DATE
  for r in
    select d.id, d.load_id, l.plan_load_date, l.plan_load_from, l.status
      from decisions d
      left join loads l on l.id = d.load_id
     where d.type_code = 'KSH_DATE_LT_5D'
       and d.status in ('NEW','ASSIGNED','SNOOZED')
  loop
    v_anchor := public.l3_anchor(r.plan_load_date, r.plan_load_from);
    if v_anchor is null
       or v_anchor <= v_now
       or (v_anchor at time zone 'Europe/Warsaw')::date - (v_now at time zone 'Europe/Warsaw')::date >= v_lead
       or (r.status is not null and r.status::text not in ('PLANNED','RESOURCES_PENDING','DOCS_PENDING','READY'))
    then
      update decisions
         set status = 'RESOLVED', resolution_code = 'AUTO_CLOSED', resolved_at = v_now, updated_at = v_now
       where id = r.id and status in ('NEW','ASSIGNED','SNOOZED');
      insert into decision_events (decision_id, actor_id, action, payload)
      values (r.id, null, 'RESOLVE', jsonb_build_object('option', 'AUTO_CLOSED', 'effect', 'AUTO_CLOSED', 'hotfix', '0250'));
      insert into audit_log (user_id, action, entity, entity_id, new_value)
      values (null, 'DECISION_AUTO_CLOSED', 'decisions', r.id::text,
              jsonb_build_object('reason', 'KSH_DATE_LT_5D poza oknem', 'hotfix', '0250'));
    end if;
  end loop;

  -- pkt 3: TOWER_KSH_CONFLICT z pustym file
  for r in
    select d.id
      from decisions d
     where d.type_code = 'TOWER_KSH_CONFLICT'
       and d.status in ('NEW','ASSIGNED','SNOOZED')
       and nullif(btrim(coalesce(d.detail->>'file', '')), '') is null
  loop
    update decisions
       set status = 'RESOLVED', resolution_code = 'AUTO_CLOSED', resolved_at = v_now, updated_at = v_now
     where id = r.id and status in ('NEW','ASSIGNED','SNOOZED');
    insert into decision_events (decision_id, actor_id, action, payload)
    values (r.id, null, 'RESOLVE', jsonb_build_object('option', 'AUTO_CLOSED', 'effect', 'AUTO_CLOSED', 'hotfix', '0250'));
    v_ids := array_append(v_ids, r.id);
    insert into audit_log (user_id, action, entity, entity_id, new_value)
    values (null, 'DECISION_AUTO_CLOSED', 'decisions', r.id::text,
            jsonb_build_object('reason', 'TOWER_KSH_CONFLICT puste file', 'hotfix', '0250'));
  end loop;

  if cardinality(v_ids) > 0 then
    with marked as (
      update notifications n
         set read_at = coalesce(n.read_at, v_now)
       where n.channel = 'IN_APP'
         and n.read_at is null
         and (
           n.payload->>'decision_id' = any (select x::text from unnest(v_ids) x)
           or n.dedup_key like any (select '%:' || x::text || '%' from unnest(v_ids) x)
         )
      returning n.id
    )
    select count(*) into v_n from marked;
    insert into audit_log (user_id, action, entity, entity_id, new_value)
    values (null, 'AUDYT17_MARK_READ', 'notifications', 'hotfix-0250',
            jsonb_build_object('count', coalesce(v_n, 0), 'decision_ids', to_jsonb(v_ids), 'hotfix', '0250'));
  end if;
end
$cleanup$;

-- ---------------------------------------------------------------------------
-- pkt 3–4: import_schedule
-- ---------------------------------------------------------------------------
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
  v_quiet_on  boolean := false;
  v_quiet_fill boolean := false;
  v_prev_quiet text;
  v_historic boolean := false;
  v_cmap jsonb := '{}'::jsonb;
  v_has_hhl_col boolean := false;
  v_fnames    text[] := array['item_type','cargo_class','length_m','width_m','height_m','unit_weight_t','qty','total_weight_t',
                              'load_date','load_time','delivery_date','delivery_time','order_no','assembly_seq'];
begin
  -- is_hhl() zwraca NULL dla konta nieaktywnego / bez wiersza app_users â€” NULL nie moĹĽe przepuĹ›ciÄ‡
  if is_hhl() is not true then raise exception 'Import harmonogramu wyĹ‚Ä…cznie HHL'; end if;
  if not exists (select 1 from projects where id = p_project) then raise exception 'Nieznany projekt'; end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then raise exception 'Wiersze importu: oczekiwana tablica'; end if;
  perform pg_advisory_xact_lock(hashtext('import_schedule:' || p_project::text));
  select id into v_user from app_users where auth_id = auth.uid();
  select coalesce((select value_num = 1 from ops_thresholds where key = 'import_quiet_hours'), false)
    into v_quiet_on;
  v_cmap := coalesce(p_file->'column_map', '{}'::jsonb);
  -- HOTFIX #384 pkt 3: kolumna HHL w mapie (A6: hhlOrderNo); bez niej nie wolamy konfliktu.
  v_has_hhl_col := (nullif(btrim(coalesce(v_cmap->>'hhlOrderNo', v_cmap->>'hhl_order_no', '')), '') is not null);

  -- przewoĹşnik nowych transportĂłw: jedyny przewoĹşnik w systemie (inaczej HHL przypisuje rÄ™cznie)
  select case when count(*) = 1 then min(id::text)::uuid end, case when count(*) = 1 then min(name) end
    into v_carrier, v_carrier_n from organizations where kind = 'CARRIER';

  -- walidacja wejĹ›cia (druga linia za parserem w przeglÄ…darce): bĹ‚Ä…d = caĹ‚a transakcja wycofana
  create temp table if not exists _imp (code text primary key, row jsonb not null) on commit drop;
  truncate _imp;
  for r in select value as v, ordinality as i from jsonb_array_elements(p_rows) with ordinality loop
    -- B-8-IMP: TYP = STANDARD (klasa albo item_type) to Ĺ‚adunek NTG â€” pomijamy, nie bĹ‚Ä…d, nie zapis
    if upper(btrim(coalesce(r.v->>'cargo_class', ''))) = 'STANDARD'
       or upper(btrim(coalesce(r.v->>'item_type', ''))) = 'STANDARD' then
      v_skipped := v_skipped + 1;
      continue;
    end if;
    if coalesce(btrim(r.v->>'code'), '') = '' then raise exception 'Wiersz %: brak kodu â€žWysyĹ‚kaâ€ť', r.i; end if;
    begin
      c := null;
      select schedule_row_canon(r.v) as canon into c;
    exception when others then
      raise exception 'Wiersz % (%): nieprawidĹ‚owa wartoĹ›Ä‡ â€” %', r.i, r.v->>'code', sqlerrm;
    end;
    -- I-2C: klasa Ĺ‚adunku â€” STANDARD (normatywny) bez wymiarĂłw; kaĹĽda inna klasa: wymiary wymagane i dodatnie
    if coalesce(upper(btrim(r.v->>'cargo_class')), 'DIMENSIONED') not in ('STANDARD', 'DIMENSIONED') then
      raise exception 'Wiersz % (%): nieznana klasa Ĺ‚adunku %', r.i, r.v->>'code', r.v->>'cargo_class';
    end if;
    if c.canon->>'cargo_class' = 'STANDARD' then
      if coalesce(c.canon->>'length_m', c.canon->>'width_m', c.canon->>'height_m') is not null then
        raise exception 'Wiersz % (%): klasa STANDARD â€” wymiary muszÄ… byÄ‡ puste', r.i, r.v->>'code';
      end if;
    elsif ((c.canon->>'length_m')::numeric > 0 and (c.canon->>'width_m')::numeric > 0
           and (c.canon->>'height_m')::numeric > 0) is not true then
      raise exception 'Wiersz % (%): wymiary muszÄ… byÄ‡ dodatnie (wymagane dla klasy innej niĹĽ STANDARD)', r.i, r.v->>'code';
    end if;
    if (c.canon->>'qty')::int <= 0 then raise exception 'Wiersz % (%): iloĹ›Ä‡ musi byÄ‡ dodatnia', r.i, r.v->>'code'; end if;
    if (c.canon->>'delivery_date')::date < (c.canon->>'load_date')::date then
      raise exception 'Wiersz % (%): data dostawy przed datÄ… zaĹ‚adunku', r.i, r.v->>'code';
    end if;
    begin
      insert into _imp values (btrim(r.v->>'code'), c.canon);
    exception when unique_violation then
      raise exception 'Kod % wystÄ™puje w pliku wiÄ™cej niĹĽ raz', btrim(r.v->>'code');
    end;
  end loop;

  -- DATY-67: plik KSH = ĹşrĂłdĹ‚o dat â€” zawsze nadpisuje (bez overwrite_confirmed)
  v_over := '{}'::text[];

  -- wersja (tylko przy zapisie; nadawana dopiero, gdy sÄ… zmiany)
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
                jsonb_build_object('action', 'ADDED', 'code', r.code, 'version', v_version, 'file', p_file->>'name'));
      end if;
      continue;
    end if;

    select coalesce(array_agg(f order by f), '{}') into v_fields
      from unnest(v_fnames) f where coalesce(r.inc -> f, 'null'::jsonb) is distinct from coalesce(r.prev -> f, 'null'::jsonb);
    -- L-1b / HOTFIX #384 pkt 3: konflikt tylko gdy mapa ma kolumnÄ™ HHL i plik ma niepustÄ… wartoĹ›Ä‡.
    if p_dry_run is false
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
                     'message', 'Transport anulowany â€” przywrĂłcenie wyĹ‚Ä…cznie rÄ™cznie przez HHL');
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
    -- B1 F7: puste takze w loads (nie tylko w schedule_row) â€” godziny wpisane przez KSH/HHL nie nadpisywac cicho.
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
    v_crit := case
      when v_quiet_fill then '{}'::text[]
      when r.awizowany then
        array(select f from unnest(v_fields) f where f in ('load_date','load_time','delivery_date','delivery_time'))
      else '{}'::text[]
    end;
    v_changed := v_changed || jsonb_build_object('code', r.code, 'load_id', r.load_id, 'fields', to_jsonb(v_fields),
                   'before', (select jsonb_object_agg(f, r.prev -> f) from unnest(v_fields) f),
                   'after',  (select jsonb_object_agg(f, r.inc -> f) from unnest(v_fields) f),
                   'critical', cardinality(v_crit) > 0,
                   'quiet_hours', v_quiet_fill);
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
        -- zachowana data potwierdzona: w schedule_row zostajÄ… poprzednie daty, wiÄ™c rĂłĹĽnica (i ostrzeĹĽenie) wraca przy kolejnym imporcie
        schedule_row = r.inc,
        last_seen_import = v_import, updated_at = now()
       where id = r.item_id;
      if 'load_date' = any (v_fields) or 'delivery_date' = any (v_fields) or 'order_no' = any (v_fields)
         or 'load_time' = any (v_fields) or 'delivery_time' = any (v_fields) then
        -- G-20 / D-20261014-0015-01 R1: kontekst importu â€” straĹĽnik przepuszcza daty z pliku
        perform set_config('tower.import_ctx', 'on', true);
        -- HOTFIX #384 pkt 4b: historyczne / dostarczone â€” cicho.
        v_historic := (
          (r.plan_delivery_date is not null
            and r.plan_delivery_date < (now() at time zone 'Europe/Warsaw')::date)
          or (r.status is not null
            and public.load_status_rank(r.status) >= public.load_status_rank('DELIVERED'::public.load_status))
        );
        if v_quiet_fill or v_historic then
          v_prev_quiet := current_setting('tower.bulk_quiet', true);
          perform set_config('tower.bulk_quiet', 'on', true);
        end if;
        -- status dat ustawia trg_plan_dates_before (POTWIERDZONA = z pliku); nie w UPDATE (guard)
        -- HOTFIX #384 pkt 4a: brak godziny do w pliku nie kasuje istniejÄ…cej.
        update loads set
          plan_load_date = coalesce((r.inc->>'load_date')::date, plan_load_date),
          plan_delivery_date = coalesce((r.inc->>'delivery_date')::date, plan_delivery_date),
          plan_load_from = case
            when nullif(btrim(r.inc->>'load_time'), '') is not null
              then public.schedule_cell_ts(coalesce((r.inc->>'load_date')::date, plan_load_date), r.inc->>'load_time', 'Europe/Warsaw')
            when 'load_time' = any (v_fields) then null
            else plan_load_from end,
          plan_load_to = plan_load_to,
          plan_delivery_from = plan_delivery_from,
          plan_delivery_to = case
            when nullif(btrim(r.inc->>'delivery_time'), '') is not null
              then public.schedule_cell_ts(coalesce((r.inc->>'delivery_date')::date, plan_delivery_date), r.inc->>'delivery_time', 'Europe/Stockholm')
            when 'delivery_time' = any (v_fields) then null
            else plan_delivery_to end,
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
                                 'after',  (select jsonb_object_agg(f, r.inc -> f) from unnest(v_fields) f)));
      if cardinality(v_crit) > 0 and v_historic is not true then
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

  -- nieobecne w pliku: kandydaci do anulowania (tylko gdy plik ma przyjÄ™te wiersze)
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
                       'message', 'Transport od wjazdu na zaĹ‚adunek â€” anuluje wyĹ‚Ä…cznie HHL rÄ™cznie, z powodem');
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
                  jsonb_build_object('status', 'CANCELLED', 'reason', 'UsuniÄ™ty z harmonogramu (' || coalesce(p_file->>'name', 'import') || ')',
                                     'version', v_version));
          insert into load_events (load_id, event_type, occurred_at, actor_id, payload)
          values (c.load_id, 'STATUS_CANCELLED', now(), v_user,
                  jsonb_build_object('code', c.code, 'version', v_version, 'reason', 'UsuniÄ™ty z harmonogramu', 'file', p_file->>'name'));
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


