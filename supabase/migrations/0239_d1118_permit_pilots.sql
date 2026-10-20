-- =====================================================================
-- TOWER — Migracja 0239: D-20261020-1118-01 (#353) — zezwolenie Firma/Trasa, piloci awizacji
--   1. permit_fits: DIMS_UNKNOWN tylko L×W×H; masa z combo → shipment_items → symbol_specs;
--      bez masy — limit masy nie jest naruszeniem; KIND gdy scope FIRMA a transport TRASA.
--   2. awiz_pilots_set: pola awizacji Pilot PL/SE; bez zmiany loads.escort_vehicles.
--   Idempotentna.
-- =====================================================================

create or replace function public.permit_fits(p_load_id uuid, p_permit_id uuid)
returns table (ok boolean, breaches text[])
language plpgsql
stable
set search_path = public, extensions
as $$
declare
  /* Bez select * — driver_* nie są w GRANT SELECT na loads (0076). */
  v_load_id uuid;
  v_permit_kind text;
  v_symbol text;
  v_len numeric;
  v_wid numeric;
  v_hei numeric;
  v_wgt numeric;
  v_plan_load date;
  v_scope text;
  v_max_len numeric;
  v_max_wid numeric;
  v_max_hei numeric;
  v_max_wgt numeric;
  v_valid_from date;
  v_valid_until date;
  v_kind text;
  v_breaches text[] := '{}';
  v_dims_unknown boolean := false;
begin
  select l.id, l.permit_kind, l.symbol, l.combo_length_m, l.combo_width_m, l.combo_height_m,
         l.combo_weight_t, l.plan_load_date
    into v_load_id, v_permit_kind, v_symbol, v_len, v_wid, v_hei, v_wgt, v_plan_load
    from public.loads l
   where l.id = p_load_id;
  select p.scope, p.max_length_m, p.max_width_m, p.max_height_m, p.max_weight_t,
         p.valid_from, p.valid_until
    into v_scope, v_max_len, v_max_wid, v_max_hei, v_max_wgt, v_valid_from, v_valid_until
    from public.permits p
   where p.id = p_permit_id;
  if (v_load_id is not null and v_scope is not null) is not true then
    return query select false, array['MISSING']::text[];
    return;
  end if;

  v_kind := coalesce(
    v_permit_kind,
    (select ss.permit_kind from public.symbol_specs ss where ss.symbol = v_symbol),
    'FIRMA'
  );

  /* Rodzaj: zezwolenie firmowe tylko przy permit_kind FIRMA (KR + 13/GD → KIND). */
  if v_scope = 'FIRMA' and (v_kind = 'FIRMA') is not true then
    v_breaches := array_append(v_breaches, 'KIND');
  end if;

  if v_max_len is not null and v_len is null then
    v_dims_unknown := true;
  elsif v_max_len is not null and v_len > v_max_len then
    v_breaches := array_append(v_breaches, 'LENGTH');
  end if;

  if v_max_wid is not null and v_wid is null then
    v_dims_unknown := true;
  elsif v_max_wid is not null and v_wid > v_max_wid then
    v_breaches := array_append(v_breaches, 'WIDTH');
  end if;

  if v_max_hei is not null and v_hei is null then
    v_dims_unknown := true;
  elsif v_max_hei is not null and v_hei > v_max_hei then
    v_breaches := array_append(v_breaches, 'HEIGHT');
  end if;

  if v_dims_unknown then
    v_breaches := array_append(v_breaches, 'DIMS_UNKNOWN');
  end if;

  /* Masa: combo → suma pozycji → cargo z tabeli symboli; brak masy ≠ naruszenie. */
  if v_wgt is null then
    select nullif(sum(si.total_weight_t), 0) into v_wgt
      from public.shipment_items si
     where si.load_id = v_load_id;
  end if;
  if v_wgt is null and v_symbol is not null then
    select ss.cargo_weight_t into v_wgt
      from public.symbol_specs ss
     where ss.symbol = v_symbol;
  end if;
  if v_max_wgt is not null and v_wgt is not null and v_wgt > v_max_wgt then
    v_breaches := array_append(v_breaches, 'WEIGHT');
  end if;

  if (coalesce(v_plan_load, current_date) between v_valid_from and v_valid_until) is not true then
    v_breaches := array_append(v_breaches, 'VALIDITY');
  end if;

  return query select (cardinality(v_breaches) = 0), v_breaches;
end;
$$;

revoke all on function public.permit_fits(uuid, uuid) from public, anon;
grant execute on function public.permit_fits(uuid, uuid) to authenticated;

comment on function public.permit_fits(uuid, uuid) is
  'D-1118: zgodność zezwolenia z zestawem; DIMS_UNKNOWN tylko L×W×H; masa z fallbackiem; KIND dla FIRMA vs TRASA.';

-- PILOTS_SET musi być w CHECK load_events (0234).
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
    'PLAN_DATES_CONFIRMED', 'PLAN_DATES_CHANGED', 'DECISION_HOLD', 'PILOTS_SET'
));

-- ---------------------------------------------------------------------
-- awiz_pilots_set — pola awizacji Pilot PL / Pilot SE
-- ---------------------------------------------------------------------
create or replace function public.awiz_pilots_set(
  p_load uuid,
  p_pl_plate text,
  p_pl_name text,
  p_se_plate text,
  p_se_name text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_load_id uuid;
  v_status text;
  v_carrier uuid;
  v_symbol text;
  v_role text;
  v_pilot text;
  v_old jsonb;
  v_new jsonb;
  v_pl_plate text;
  v_pl_name text;
  v_se_plate text;
  v_se_name text;
begin
  v_role := current_app_role()::text;
  v_pl_plate := nullif(upper(btrim(coalesce(p_pl_plate, ''))), '');
  v_pl_name := nullif(btrim(coalesce(p_pl_name, '')), '');
  v_se_plate := nullif(upper(btrim(coalesce(p_se_plate, ''))), '');
  v_se_name := nullif(btrim(coalesce(p_se_name, '')), '');

  select l.id, l.status::text, l.carrier_org_id, l.symbol
    into v_load_id, v_status, v_carrier, v_symbol
    from public.loads l
   where l.id = p_load;
  if (v_load_id is not null) is not true then
    raise exception 'Brak transportu' using errcode = '22023';
  end if;

  if (
    v_role = 'HHL_ADMIN'
    or (
      current_org_kind() = 'CARRIER'
      and v_carrier = current_org_id()
    )
  ) is not true then
    raise exception 'Pilotów awizuje Administrator HHL albo przewoźnik transportu' using errcode = '42501';
  end if;

  if v_status in (
    'UNLOADED', 'DELIVERED', 'CANCELLED', 'READY_TO_INVOICE', 'INVOICED'
  ) then
    raise exception 'Transport zakończony albo anulowany — awizacja pilotów zamknięta'
      using errcode = '22023';
  end if;

  select ss.pilot into v_pilot
    from public.symbol_specs ss
   where ss.symbol = v_symbol;
  if (coalesce(v_pilot, 'BRAK') = 'PL_SE') is not true then
    raise exception 'Transport bez wymogu pilotów' using errcode = '22023';
  end if;

  if v_pl_plate is not null and (v_pl_plate ~ '^[A-Z0-9 -]{2,15}$') is not true then
    raise exception 'Nieprawidłowa tablica pilota PL' using errcode = '22023';
  end if;
  if v_se_plate is not null and (v_se_plate ~ '^[A-Z0-9 -]{2,15}$') is not true then
    raise exception 'Nieprawidłowa tablica pilota SE' using errcode = '22023';
  end if;
  if (v_pl_name is null or length(v_pl_name) between 1 and 120) is not true then
    raise exception 'Imię i nazwisko pilota PL do 120 znaków' using errcode = '22023';
  end if;
  if (v_se_name is null or length(v_se_name) between 1 and 120) is not true then
    raise exception 'Imię i nazwisko pilota SE do 120 znaków' using errcode = '22023';
  end if;
  /* Imię bez tablicy — nie zapisujemy wiersza (kolumna plate NOT NULL). */
  if v_pl_plate is null then v_pl_name := null; end if;
  if v_se_plate is null then v_se_name := null; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
      'seq', e.seq, 'scope', e.scope, 'plate', e.plate, 'driver_name', e.driver_name
    ) order by e.seq), '[]'::jsonb)
    into v_old
    from public.load_escorts e
   where e.load_id = p_load
     and e.scope in ('PL', 'SE');

  /* Czyścimy PL/SE i zwalniamy seq 1–2; escort_vehicles bez zmian (wymóg z tabeli symboli). */
  delete from public.load_escorts
   where load_id = p_load
     and (scope in ('PL', 'SE') or seq in (1, 2));

  if v_pl_plate is not null then
    insert into public.load_escorts (load_id, seq, company, plate, scope, driver_name, updated_by)
    values (p_load, 1, 'Pilot', v_pl_plate, 'PL', v_pl_name, current_app_user_id());
  end if;
  if v_se_plate is not null then
    insert into public.load_escorts (load_id, seq, company, plate, scope, driver_name, updated_by)
    values (p_load, 2, 'Pilot', v_se_plate, 'SE', v_se_name, current_app_user_id());
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
      'seq', e.seq, 'scope', e.scope, 'plate', e.plate, 'driver_name', e.driver_name
    ) order by e.seq), '[]'::jsonb)
    into v_new
    from public.load_escorts e
   where e.load_id = p_load
     and e.scope in ('PL', 'SE');

  insert into public.audit_log (user_id, action, entity, entity_id, old_value, new_value)
  values (
    current_app_user_id(), 'AWIZ_PILOTS_SET', 'loads', p_load::text, v_old, v_new
  );

  insert into public.load_events (load_id, event_type, occurred_at, payload)
  values (
    p_load, 'PILOTS_SET', now(),
    jsonb_build_object('old', v_old, 'new', v_new)
  );

  return jsonb_build_object('ok', true, 'escorts', v_new);
end;
$$;

revoke all on function public.awiz_pilots_set(uuid, text, text, text, text) from public, anon;
grant execute on function public.awiz_pilots_set(uuid, text, text, text, text) to authenticated;

comment on function public.awiz_pilots_set(uuid, text, text, text, text) is
  'D-1118: awizacja Pilot PL/SE; bez zmiany escort_vehicles; tylko HHL_ADMIN lub przewoźnik transportu.';
