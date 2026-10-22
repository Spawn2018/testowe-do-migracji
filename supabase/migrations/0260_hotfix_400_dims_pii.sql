-- =====================================================================
-- TOWER — Migracja 0260: #400 / D-20261021-1929-01 (pilne)
--   A. permit_fits: wymiary L×W×H pole po polu
--      coalesce(loads.combo_*_m, symbol_specs.combo_*_m) — jak masa.
--   B. audit_row_change: bez maski „[dane osobowe]” na PII;
--      rio_secret nadal „••••”. Starych wpisów nie odtwarzamy.
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

  /* #400: wymiary zestawu — transport, potem tabela symboli (pole po polu). */
  if v_symbol is not null then
    v_len := coalesce(v_len, (select ss.combo_length_m from public.symbol_specs ss where ss.symbol = v_symbol));
    v_wid := coalesce(v_wid, (select ss.combo_width_m from public.symbol_specs ss where ss.symbol = v_symbol));
    v_hei := coalesce(v_hei, (select ss.combo_height_m from public.symbol_specs ss where ss.symbol = v_symbol));
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
  'D-1118+#400: L×W×H coalesce(load, symbol_specs); masa z fallbackiem; KIND dla FIRMA vs TRASA.';

-- ---------------------------------------------------------------------
-- audit_row_change: D-1243 / #400 — PII jawne; tylko rio_secret maskowany
-- ---------------------------------------------------------------------
create or replace function public.audit_row_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_old jsonb; v_new jsonb; o jsonb; n jsonb; k text;
  v_skip constant text[] := array[
    'updated_at', 'eta_site', 'eta_confidence_min', 'eta_basis', 'eta_computed_at',
    'delay_minutes', 'fetched_at', 'beat_at', 'beats', 'last_seen_at'
  ];
  v_id text; v_user uuid; v_source text; v_row jsonb;
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

  /* Tylko rio_secret (E44) — bez „[dane osobowe]” (D-1243 / #400). */
  if v_old ? 'rio_secret' and jsonb_typeof(v_old -> 'rio_secret') <> 'null' then
    v_old := jsonb_set(v_old, array['rio_secret'], '"••••"'::jsonb);
  end if;
  if v_new ? 'rio_secret' and jsonb_typeof(v_new -> 'rio_secret') <> 'null' then
    v_new := jsonb_set(v_new, array['rio_secret'], '"••••"'::jsonb);
  end if;

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

  v_source := nullif(btrim(current_setting('tower.audit_source', true)), '');
  if v_user is null then
    v_source := coalesce(v_source, 'system');
  end if;

  insert into audit_log (user_id, action, entity, entity_id, old_value, new_value, source)
    values (v_user, 'ROW_' || tg_op, tg_table_name, v_id, v_old, v_new, v_source);
  return null;
end $$;

revoke all on function public.audit_row_change() from public, anon, authenticated;

comment on function public.audit_row_change() is
  'HIST-11 + A7 + #400 (D-1243): rio_secret = ••••; PII (kierowca/kontakt) bez maski.';
