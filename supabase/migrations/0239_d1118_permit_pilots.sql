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
  l public.loads%rowtype;
  p public.permits%rowtype;
  v_kind text;
  v_wgt numeric;
  v_breaches text[] := '{}';
  v_dims_unknown boolean := false;
begin
  select * into l from public.loads where id = p_load_id;
  select * into p from public.permits where id = p_permit_id;
  if (l.id is not null and p.id is not null) is not true then
    return query select false, array['MISSING']::text[];
    return;
  end if;

  v_kind := coalesce(
    l.permit_kind,
    (select ss.permit_kind from public.symbol_specs ss where ss.symbol = l.symbol),
    'FIRMA'
  );

  /* Rodzaj: zezwolenie firmowe tylko przy permit_kind FIRMA (KR + 13/GD → KIND). */
  if p.scope = 'FIRMA' and (v_kind = 'FIRMA') is not true then
    v_breaches := array_append(v_breaches, 'KIND');
  end if;

  if p.max_length_m is not null and l.combo_length_m is null then
    v_dims_unknown := true;
  elsif p.max_length_m is not null and l.combo_length_m > p.max_length_m then
    v_breaches := array_append(v_breaches, 'LENGTH');
  end if;

  if p.max_width_m is not null and l.combo_width_m is null then
    v_dims_unknown := true;
  elsif p.max_width_m is not null and l.combo_width_m > p.max_width_m then
    v_breaches := array_append(v_breaches, 'WIDTH');
  end if;

  if p.max_height_m is not null and l.combo_height_m is null then
    v_dims_unknown := true;
  elsif p.max_height_m is not null and l.combo_height_m > p.max_height_m then
    v_breaches := array_append(v_breaches, 'HEIGHT');
  end if;

  if v_dims_unknown then
    v_breaches := array_append(v_breaches, 'DIMS_UNKNOWN');
  end if;

  /* Masa: combo → suma pozycji → cargo z tabeli symboli; brak masy ≠ naruszenie. */
  v_wgt := l.combo_weight_t;
  if v_wgt is null then
    select nullif(sum(si.total_weight_t), 0) into v_wgt
      from public.shipment_items si
     where si.load_id = l.id;
  end if;
  if v_wgt is null and l.symbol is not null then
    select ss.cargo_weight_t into v_wgt
      from public.symbol_specs ss
     where ss.symbol = l.symbol;
  end if;
  if p.max_weight_t is not null and v_wgt is not null and v_wgt > p.max_weight_t then
    v_breaches := array_append(v_breaches, 'WEIGHT');
  end if;

  if (coalesce(l.plan_load_date, current_date) between p.valid_from and p.valid_until) is not true then
    v_breaches := array_append(v_breaches, 'VALIDITY');
  end if;

  return query select (cardinality(v_breaches) = 0), v_breaches;
end;
$$;

revoke all on function public.permit_fits(uuid, uuid) from public, anon;
grant execute on function public.permit_fits(uuid, uuid) to authenticated;

comment on function public.permit_fits(uuid, uuid) is
  'D-1118: zgodność zezwolenia z zestawem; DIMS_UNKNOWN tylko L×W×H; masa z fallbackiem; KIND dla FIRMA vs TRASA.';

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
  v_load public.loads%rowtype;
  v_role text := current_app_role()::text;
  v_pilot text;
  v_old jsonb;
  v_new jsonb;
  v_pl_plate text := nullif(upper(btrim(coalesce(p_pl_plate, ''))), '');
  v_pl_name text := nullif(btrim(coalesce(p_pl_name, '')), '');
  v_se_plate text := nullif(upper(btrim(coalesce(p_se_plate, ''))), '');
  v_se_name text := nullif(btrim(coalesce(p_se_name, '')), '');
begin
  select * into v_load from public.loads where id = p_load;
  if (v_load.id is not null) is not true then
    raise exception 'Brak transportu' using errcode = '22023';
  end if;

  if (
    v_role = 'HHL_ADMIN'
    or (
      current_org_kind() = 'CARRIER'
      and v_load.carrier_org_id = current_org_id()
    )
  ) is not true then
    raise exception 'Pilotów awizuje Administrator HHL albo przewoźnik transportu' using errcode = '42501';
  end if;

  if v_load.status in (
    'UNLOADED', 'DELIVERED', 'CANCELLED', 'READY_TO_INVOICE', 'INVOICED'
  ) then
    raise exception 'Transport zakończony albo anulowany — awizacja pilotów zamknięta'
      using errcode = '22023';
  end if;

  select ss.pilot into v_pilot
    from public.symbol_specs ss
   where ss.symbol = v_load.symbol;
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
