-- =====================================================================
-- TOWER — Migracja 0260: #400 / D-20261021-1929-01 (pilne)
--   A. permit_fits: wymiary L×W×H pole po polu
--      coalesce(nullif(loads.combo_*_m,0), symbol_specs.combo_*_m) — jak masa.
--   B. audit_row_change: jawne tylko driver_name/driver_phone na loads
--      i load_escorts (D-1243); pozostałe PII z 0215 nadal „[dane osobowe]”;
--      rio_secret nadal „••••”; źródło tower.audit_source='rodo' maskuje też
--      kierowcę (purge). Starych wpisów nie odtwarzamy.
--   C. purge_personal_data: czyści driver_* w audit_log po retencji;
--      własne UPDATE-y z audit_source=rodo.
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
  v_sym_len numeric;
  v_sym_wid numeric;
  v_sym_hei numeric;
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

  /* #400: wymiary zestawu — transport, potem tabela symboli (pole po polu). */
  if v_symbol is not null then
    select ss.combo_length_m, ss.combo_width_m, ss.combo_height_m
      into v_sym_len, v_sym_wid, v_sym_hei
      from public.symbol_specs ss
     where ss.symbol = v_symbol;
    v_len := coalesce(nullif(v_len, 0), v_sym_len);
    v_wid := coalesce(nullif(v_wid, 0), v_sym_wid);
    v_hei := coalesce(nullif(v_hei, 0), v_sym_hei);
  end if;

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
  'D-1118+#400: L×W×H coalesce(nullif(load,0), symbol_specs); masa z fallbackiem; KIND dla FIRMA vs TRASA.';

-- ---------------------------------------------------------------------
-- audit_row_change: D-1243 / #400 — jawne driver_* tylko loads/load_escorts;
-- pozostałe PII z 0215 zamaskowane; rio_secret = ••••; źródło rodo maskuje też kierowcę.
-- ---------------------------------------------------------------------
create or replace function public.audit_row_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_old jsonb; v_new jsonb; o jsonb; n jsonb; k text;
  v_skip constant text[] := array[
    'updated_at', 'eta_site', 'eta_confidence_min', 'eta_basis', 'eta_computed_at',
    'delay_minutes', 'fetched_at', 'beat_at', 'beats', 'last_seen_at'
  ];
  v_pii  constant text[] := array[
    'driver_name', 'driver_phone', 'phone_national', 'phone', 'contact_phone',
    'contact_name', 'email_personal', 'rio_secret'
  ];
  v_id text; v_user uuid; v_source text; v_row jsonb;
  v_mask text;
  v_driver_clear boolean;
begin
  o := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  n := case when tg_op in ('UPDATE', 'INSERT') then to_jsonb(new) end;
  if tg_op = 'UPDATE' then
    v_old := '{}'; v_new := '{}';
    for k in select key from jsonb_each(n) loop
      if (n -> k) is distinct from (o -> k) and (k = any(v_skip)) is not true then
        v_old := v_old || jsonb_build_object(k, o -> k);
        v_new := v_new || jsonb_build_object(k, n -> k);
      end if;
    end loop;
    if v_new = '{}'::jsonb then return null; end if;
  else
    v_old := o; v_new := n;
  end if;

  v_source := nullif(btrim(current_setting('tower.audit_source', true)), '');
  /* D-1243: imię/telefon kierowcy i pilota jawne — tylko loads/load_escorts, nie przy purge. */
  v_driver_clear := tg_table_name in ('loads', 'load_escorts')
    and (v_source = 'rodo') is not true;

  foreach k in array v_pii loop
    if k = 'rio_secret' then
      v_mask := '"••••"';
    elsif k in ('driver_name', 'driver_phone') and v_driver_clear then
      v_mask := null; /* D-1243: bez maski */
    else
      v_mask := '"[dane osobowe]"';
    end if;
    if v_mask is not null then
      if v_old ? k and jsonb_typeof(v_old -> k) <> 'null' then
        v_old := jsonb_set(v_old, array[k], v_mask::jsonb);
      end if;
      if v_new ? k and jsonb_typeof(v_new -> k) <> 'null' then
        v_new := jsonb_set(v_new, array[k], v_mask::jsonb);
      end if;
    end if;
  end loop;

  v_row := coalesce(n, o);
  v_id := coalesce(
    v_row ->> 'id',
    v_row ->> 'key',
    v_row ->> 'kind',
    nullif((v_row ->> 'invoice_id') || ':' || (v_row ->> 'load_id'), ':'),
    nullif((v_row ->> 'load_id') || ':' || (v_row ->> 'permit_id'), ':'),
    nullif((v_row ->> 'event_group') || ':' || (v_row ->> 'org_kind'), ':'),
    nullif((v_row ->> 'currency') || ':' || (v_row ->> 'rate_date'), ':'),
    nullif((v_row ->> 'project_id') || ':' || (v_row ->> 'category'), ':'),
    nullif((v_row ->> 'list_key') || ':' || (v_row ->> 'slot'), ':'),
    tg_table_name
  );

  begin
    v_user := public.current_app_user_id();
  exception when others then
    v_user := null;
  end;

  if v_user is null then
    v_source := coalesce(v_source, 'system');
  end if;

  insert into audit_log (user_id, action, entity, entity_id, old_value, new_value, source)
    values (v_user, 'ROW_' || tg_op, tg_table_name, v_id, v_old, v_new, v_source);
  return null;
end $$;

revoke all on function public.audit_row_change() from public, anon, authenticated;

comment on function public.audit_row_change() is
  'HIST-11 + A7 + #400: rio••••; driver_* jawne na loads/load_escorts (nie przy source=rodo); reszta PII zamaskowana.';

-- ---------------------------------------------------------------------
-- purge_personal_data: audit_source=rodo + scrub driver_* w audit_log po retencji
-- ---------------------------------------------------------------------
create or replace function public.purge_personal_data(p_days integer default 90)
returns integer
language plpgsql
set search_path to 'public', 'extensions'
as $function$
declare
  n int; n_c int; n_pos int; n_pos_c int; n_pos_d int; n_tok int; n_esc int; n_aud int := 0;
  v_prev_source text;
begin
  if (p_days >= 0) is not true then raise exception 'p_days musi być ≥ 0' using errcode = '22023'; end if;

  v_prev_source := nullif(btrim(current_setting('tower.audit_source', true)), '');
  perform set_config('tower.audit_source', 'rodo', true);

  update loads set driver_name = null, driver_phone = null
  where actual_delivery_at is not null
    and actual_delivery_at < now() - make_interval(days => p_days)
    and (driver_name is not null or driver_phone is not null);
  get diagnostics n = row_count;

  update loads set driver_name = null, driver_phone = null
  where status = 'CANCELLED' and actual_delivery_at is null
    and updated_at < now() - make_interval(days => p_days)
    and (driver_name is not null or driver_phone is not null);
  get diagnostics n_c = row_count;

  update load_escorts e set driver_name = null, driver_phone = null
    from loads l
   where l.id = e.load_id
     and (e.driver_name is not null or e.driver_phone is not null)
     and ((l.actual_delivery_at is not null and l.actual_delivery_at < now() - make_interval(days => p_days))
       or (l.status = 'CANCELLED' and l.actual_delivery_at is null and l.updated_at < now() - make_interval(days => p_days)));
  get diagnostics n_esc = row_count;

  /* Po trzech UPDATE-ach przywróć poprzednie źródło (scrub dziennika bez wyzwalacza). */
  perform set_config('tower.audit_source', coalesce(v_prev_source, ''), true);

  /* Retencja dziennika od created_at wpisu — jeden UPDATE (bez pętli). */
  update public.audit_log a
     set old_value = case when a.old_value is null then null else
           a.old_value
           || case when a.old_value ? 'driver_name'
                    and jsonb_typeof(a.old_value -> 'driver_name') <> 'null'
                    and a.old_value ->> 'driver_name' is distinct from '[dane osobowe]'
               then jsonb_build_object('driver_name', '[dane osobowe]') else '{}'::jsonb end
           || case when a.old_value ? 'driver_phone'
                    and jsonb_typeof(a.old_value -> 'driver_phone') <> 'null'
                    and a.old_value ->> 'driver_phone' is distinct from '[dane osobowe]'
               then jsonb_build_object('driver_phone', '[dane osobowe]') else '{}'::jsonb end
         end,
         new_value = case when a.new_value is null then null else
           a.new_value
           || case when a.new_value ? 'driver_name'
                    and jsonb_typeof(a.new_value -> 'driver_name') <> 'null'
                    and a.new_value ->> 'driver_name' is distinct from '[dane osobowe]'
               then jsonb_build_object('driver_name', '[dane osobowe]') else '{}'::jsonb end
           || case when a.new_value ? 'driver_phone'
                    and jsonb_typeof(a.new_value -> 'driver_phone') <> 'null'
                    and a.new_value ->> 'driver_phone' is distinct from '[dane osobowe]'
               then jsonb_build_object('driver_phone', '[dane osobowe]') else '{}'::jsonb end
         end
   where a.entity in ('loads', 'load_escorts')
     and a.created_at < now() - make_interval(days => p_days)
     and (
       (a.old_value ? 'driver_name' and jsonb_typeof(a.old_value -> 'driver_name') <> 'null'
         and a.old_value ->> 'driver_name' is distinct from '[dane osobowe]')
       or (a.old_value ? 'driver_phone' and jsonb_typeof(a.old_value -> 'driver_phone') <> 'null'
         and a.old_value ->> 'driver_phone' is distinct from '[dane osobowe]')
       or (a.new_value ? 'driver_name' and jsonb_typeof(a.new_value -> 'driver_name') <> 'null'
         and a.new_value ->> 'driver_name' is distinct from '[dane osobowe]')
       or (a.new_value ? 'driver_phone' and jsonb_typeof(a.new_value -> 'driver_phone') <> 'null'
         and a.new_value ->> 'driver_phone' is distinct from '[dane osobowe]')
     );
  get diagnostics n_aud = row_count;

  delete from positions p
  using loads l
  where l.id = p.load_id
    and l.actual_delivery_at is not null
    and l.actual_delivery_at < now() - interval '30 days';
  get diagnostics n_pos = row_count;

  delete from positions p
  using loads l
  where l.id = p.load_id and l.status = 'CANCELLED' and l.actual_delivery_at is null
    and l.updated_at < now() - make_interval(days => p_days);
  get diagnostics n_pos_c = row_count;

  -- D-1710: odłączone pozycje — 30 dni od detached_at
  delete from positions
   where detached_load_id is not null
     and load_id is null
     and detached_at is not null
     and detached_at < now() - interval '30 days';
  get diagnostics n_pos_d = row_count;

  delete from driver_tokens
  where coalesce(revoked_at, expires_at) < now() - make_interval(days => p_days);
  get diagnostics n_tok = row_count;

  insert into integration_runs (job, ok, result)
  values ('rodo', true, jsonb_build_object('dni', p_days, 'kierowcy_rozladowane', n, 'kierowcy_anulowane', n_c,
          'piloci', n_esc, 'pozycje_rozladowane', n_pos, 'pozycje_anulowane', n_pos_c,
          'pozycje_odlaczone', n_pos_d, 'linki_kierowcy', n_tok, 'audit_kierowca', n_aud));
  return n + n_c + n_esc;
end $function$;

revoke all on function public.purge_personal_data(integer) from public, anon, authenticated;

comment on function public.purge_personal_data(integer) is
  'I-7 + D-1710 + #400: retencja kierowcy/pilota; scrub driver_* w audit_log od created_at wpisu; UPDATE z audit_source=rodo.';
