-- =====================================================================
-- TOWER — Migracja 0239: D-20261020-1118-01 (#353) — zezwolenie Firma/Trasa, piloci awizacji
--   1. permit_fits: DIMS_UNKNOWN tylko L×W×H; masa z combo → shipment_items → symbol_specs;
--      bez masy — limit masy nie jest naruszeniem; KIND gdy scope FIRMA a transport TRASA.
--   2. load_permit_status + trg_loads_permit_gate: przy FIRMA wystarczy ważne zezwolenie FIRMA.
--   3. awiz_pilots_set: pola awizacji Pilot PL/SE; bez zmiany loads.escort_vehicles;
--      audit/load_events bez imion (D-22); tylko scope PL/SE.
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
  /* scope bywa NULL (stare PL/SE) — obecność zezwolenia = valid_from. */
  if (v_load_id is not null and v_valid_from is not null) is not true then
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

-- ---------------------------------------------------------------------
-- load_permit_status: FIRMA → brak krajów PL/SE; brak FIRMA = missing FIRMA
-- ---------------------------------------------------------------------
create or replace function public.load_permit_status()
returns table (load_id uuid, permits_linked int, ok boolean, breaches text[], missing_countries text[])
language sql
stable
security invoker
set search_path = public
as $$
  select l.id,
         count(lp.permit_id)::int,
         coalesce(bool_and(f.ok), true),
         coalesce(array_remove(array_agg(distinct b.x), null), '{}'),
         case
           when coalesce(
             l.permit_kind,
             (select ss.permit_kind from public.symbol_specs ss where ss.symbol = l.symbol)
           ) = 'FIRMA' then
             case
               when exists (
                 select 1
                   from public.load_permits lp3
                   join public.permits p3 on p3.id = lp3.permit_id
                  where lp3.load_id = l.id
                    and p3.scope = 'FIRMA'
                    and coalesce(l.plan_load_date, current_date)
                        between p3.valid_from and p3.valid_until
               ) then '{}'::text[]
               else array['FIRMA']::text[]
             end
           else
             /* TRASA albo brak kind/symbol — jak dotąd PL/SE (testy 6.5, stare zezwolenia). */
             array(
               select c from unnest(array['PL', 'SE']) c
                where not exists (
                  select 1
                    from public.load_permits lp2
                    join public.permits p2 on p2.id = lp2.permit_id
                   where lp2.load_id = l.id
                     and p2.country = c
                     and coalesce(p2.scope, 'TRASA') = 'TRASA'
                )
             )
         end
    from public.loads l
    left join public.load_permits lp on lp.load_id = l.id
    left join lateral public.permit_fits(l.id, lp.permit_id) f on lp.permit_id is not null
    left join lateral unnest(coalesce(f.breaches, '{}')) b(x) on true
   where l.status <> 'CANCELLED'
   group by l.id, l.permit_kind, l.symbol, l.plan_load_date
$$;

revoke all on function public.load_permit_status() from public, anon;
grant execute on function public.load_permit_status() to authenticated;

comment on function public.load_permit_status() is
  'D-1118: missing_countries — TRASA PL/SE; FIRMA jedno zezwolenie firmowe.';

-- ---------------------------------------------------------------------
-- trg_loads_permit_gate: przy FIRMA wystarczy ważne zezwolenie FIRMA
-- ---------------------------------------------------------------------
create or replace function public.trg_loads_permit_gate() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bad text;
  v_missing text;
  v_kind text;
  v_anchor date;
begin
  if new.status is not distinct from old.status then return new; end if;
  if new.status in ('PLANNED', 'RESOURCES_PENDING', 'DOCS_PENDING', 'CANCELLED') then return new; end if;
  if old.status not in ('PLANNED', 'RESOURCES_PENDING', 'DOCS_PENDING') then return new; end if;
  select string_agg(distinct coalesce(p.country, p.scope, '?') || ' ' || p.permit_no || ': ' || array_to_string(f.breaches, ','), '; ')
    into v_bad
    from public.load_permits lp
    join public.permits p on p.id = lp.permit_id
    cross join lateral public.permit_fits(new.id, lp.permit_id) f
   where lp.load_id = new.id and f.ok is not true;
  if v_bad is not null then
    raise exception 'Zezwolenie niezgodne z zestawem — transport zablokowany (%)', v_bad
      using errcode = '23514';
  end if;
  if public.permit_required_enabled() and public.load_needs_permit(new.id) then
    v_kind := coalesce(
      new.permit_kind,
      (select ss.permit_kind from public.symbol_specs ss where ss.symbol = new.symbol)
    );
    v_anchor := coalesce(new.plan_load_date, current_date);
    if v_kind = 'FIRMA' then
      if not exists (
        select 1
          from public.load_permits lp
          join public.permits p on p.id = lp.permit_id
         where lp.load_id = new.id
           and p.scope = 'FIRMA'
           and v_anchor between p.valid_from and p.valid_until
      ) then
        raise exception 'Brak zezwolenia (Firma) — transport ponadnormatywny nie może być „Gotowy”'
          using errcode = '23514';
      end if;
    else
      /* TRASA albo brak kind — wymóg PL+SE jak I-27. */
      select string_agg(c, ', ' order by c) into v_missing
        from unnest(array['PL', 'SE']) c
       where not exists (
         select 1
           from public.load_permits lp
           join public.permits p on p.id = lp.permit_id
          where lp.load_id = new.id
            and p.country = c
            and coalesce(p.scope, 'TRASA') = 'TRASA'
            and v_anchor between p.valid_from and p.valid_until
       );
      if v_missing is not null then
        raise exception 'Brak zezwolenia (%) — transport ponadnormatywny nie może być „Gotowy”', v_missing
          using errcode = '23514';
      end if;
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.trg_loads_permit_gate() from public, anon, authenticated;

comment on function public.trg_loads_permit_gate() is
  'D-1118 + I-27: blokada READY — FIRMA jedno zezwolenie firmowe; TRASA PL+SE.';

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
  v_seq int;
begin
  v_role := current_app_role()::text;
  v_pl_plate := nullif(upper(btrim(coalesce(p_pl_plate, ''))), '');
  v_pl_name := nullif(btrim(coalesce(p_pl_name, '')), '');
  v_se_plate := nullif(upper(btrim(coalesce(p_se_plate, ''))), '');
  v_se_name := nullif(btrim(coalesce(p_se_name, '')), '');

  /* Rola przed „Brak transportu” — nie ujawnia istnienia id. */
  if (
    v_role = 'HHL_ADMIN'
    or current_org_kind() = 'CARRIER'
  ) is not true then
    raise exception 'Pilotów awizuje Administrator HHL albo przewoźnik transportu'
      using errcode = '42501';
  end if;

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
    raise exception 'Pilotów awizuje Administrator HHL albo przewoźnik transportu'
      using errcode = '42501';
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

  /* Imię bez tablicy — komunikat, nie ciche pominięcie (F7 P7). */
  if v_pl_name is not null and v_pl_plate is null then
    raise exception 'podaj numer rejestracyjny pilota PL' using errcode = '22023';
  end if;
  if v_se_name is not null and v_se_plate is null then
    raise exception 'podaj numer rejestracyjny pilota SE' using errcode = '22023';
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

  /* Audit/zdarzenie: plate + kontakt; imię = „[dane osobowe]” (D-22 / 0090). */
  select coalesce(jsonb_agg(jsonb_build_object(
      'seq', e.seq,
      'scope', e.scope,
      'plate', e.plate,
      'kontakt', case when e.driver_name is not null then 'tak' else 'nie' end,
      'driver_name', case when e.driver_name is not null then '[dane osobowe]' else null end
    ) order by e.seq), '[]'::jsonb)
    into v_old
    from public.load_escorts e
   where e.load_id = p_load
     and e.scope in ('PL', 'SE');

  /* Tylko PL/SE z tej funkcji — nie kasujemy PL_SE z load_escorts_set. */
  delete from public.load_escorts
   where load_id = p_load
     and scope in ('PL', 'SE');

  select coalesce(max(e.seq), 0) into v_seq
    from public.load_escorts e
   where e.load_id = p_load;

  if v_pl_plate is not null then
    v_seq := v_seq + 1;
    insert into public.load_escorts (load_id, seq, company, plate, scope, driver_name, updated_by)
    values (p_load, v_seq, 'Pilot', v_pl_plate, 'PL', v_pl_name, current_app_user_id());
  end if;
  if v_se_plate is not null then
    v_seq := v_seq + 1;
    insert into public.load_escorts (load_id, seq, company, plate, scope, driver_name, updated_by)
    values (p_load, v_seq, 'Pilot', v_se_plate, 'SE', v_se_name, current_app_user_id());
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
      'seq', e.seq,
      'scope', e.scope,
      'plate', e.plate,
      'kontakt', case when e.driver_name is not null then 'tak' else 'nie' end,
      'driver_name', case when e.driver_name is not null then '[dane osobowe]' else null end
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
  'D-1118: awizacja Pilot PL/SE; bez zmiany escort_vehicles; audit bez imion; tylko HHL_ADMIN lub przewoźnik.';
