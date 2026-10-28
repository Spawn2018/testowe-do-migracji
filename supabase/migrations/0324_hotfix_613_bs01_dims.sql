-- #613 PILNE: korekta BS-01 — wymiary 11,95×2,45×1,30, 21,37 t → symbol BS-A + wycena.
-- Jak 0306: logika w hotfix_613_apply(); CI bez BS-01 = no-op; TEST z fiksturą w status.sh.
-- Kwot cennika nie wpisujemy — load_price_compute czyta rate_rules z bazy.
-- Produkcja: kopia R2 przed db push. Tylko shipment_code = BS-01 (wyjątek przy >1 wierszu).

create or replace function public.hotfix_613_apply()
returns integer
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $hotfix613$
declare
  v_n_items int;
  v_load    uuid;
  v_item    uuid;
  v_before  jsonb;
  v_after   jsonb;
  v_sym     text;
  v_combo_h numeric;
  v_rev     numeric;
  v_cost    numeric;
  n_fix     int := 0;
begin
  select count(*) into v_n_items
    from public.shipment_items si
   where si.shipment_code = 'BS-01';

  if v_n_items = 0 then
    return 0;
  end if;

  if v_n_items > 1 then
    raise exception 'HOTFIX #613: więcej niż jeden wiersz BS-01 (%) — przerwano', v_n_items
      using errcode = 'P0001';
  end if;

  select si.id, si.load_id into v_item, v_load
    from public.shipment_items si
   where si.shipment_code = 'BS-01';

  select jsonb_build_object(
           'shipment_code', si.shipment_code,
           'length_m', si.length_m,
           'width_m', si.width_m,
           'height_m', si.height_m,
           'qty', si.qty,
           'unit_weight_t', si.unit_weight_t,
           'total_weight_t', si.total_weight_t,
           'symbol', l.symbol,
           'combo_length_m', l.combo_length_m,
           'combo_width_m', l.combo_width_m,
           'combo_height_m', l.combo_height_m,
           'revenue_base', rv.base_amount,
           'cost_base', lc.base_amount
         )
    into v_before
    from public.shipment_items si
    join public.loads l on l.id = si.load_id
    left join public.load_revenue rv on rv.load_id = l.id
    left join public.load_cost lc on lc.load_id = l.id
   where si.id = v_item;

  /* Idempotencja: już poprawne wymiary + BS-A + waga. */
  if (v_before->>'length_m')::numeric = 11.95
     and (v_before->>'width_m')::numeric = 2.45
     and (v_before->>'height_m')::numeric = 1.30
     and (v_before->>'total_weight_t')::numeric = 21.37
     and coalesce(v_before->>'symbol', '') = 'BS-A'
  then
    return 0;
  end if;

  insert into public.audit_log (user_id, action, entity, entity_id, new_value)
  values (
    null, 'HOTFIX_613_BEFORE', 'loads', v_load::text,
    v_before || jsonb_build_object('hotfix', '0324', 'issue', 613)
  );

  /* Bez bulk_quiet na UPDATE — trg A7 (sam ustawia quiet) + trg ceny + powiadomienia jak przy zwykłej zmianie. */
  update public.shipment_items
     set length_m = 11.95,
         width_m = 2.45,
         height_m = 1.30,
         qty = 2,
         unit_weight_t = 10.685,
         total_weight_t = 21.37
   where id = v_item;

  /* Wycena z cennika (nie ręczne kwoty); trigger ceny też odpala, to domyka BAF/tydzień. */
  perform public.load_price_compute(v_load);

  select l.symbol, l.combo_height_m, rv.base_amount, lc.base_amount
    into v_sym, v_combo_h, v_rev, v_cost
    from public.loads l
    left join public.load_revenue rv on rv.load_id = l.id
    left join public.load_cost lc on lc.load_id = l.id
   where l.id = v_load;

  if v_sym is distinct from 'BS-A' then
    raise exception 'HOTFIX #613: po wymiarach oczekiwano symbolu BS-A, jest %', coalesce(v_sym, '∅')
      using errcode = 'P0001';
  end if;

  select jsonb_build_object(
           'shipment_code', si.shipment_code,
           'length_m', si.length_m,
           'width_m', si.width_m,
           'height_m', si.height_m,
           'qty', si.qty,
           'unit_weight_t', si.unit_weight_t,
           'total_weight_t', si.total_weight_t,
           'symbol', l.symbol,
           'combo_length_m', l.combo_length_m,
           'combo_width_m', l.combo_width_m,
           'combo_height_m', l.combo_height_m,
           'revenue_base', rv.base_amount,
           'cost_base', lc.base_amount
         )
    into v_after
    from public.shipment_items si
    join public.loads l on l.id = si.load_id
    left join public.load_revenue rv on rv.load_id = l.id
    left join public.load_cost lc on lc.load_id = l.id
   where si.id = v_item;

  insert into public.load_events (load_id, event_type, occurred_at, payload)
  values (
    v_load,
    'NOTE',
    now(),
    jsonb_build_object(
      'note', 'Korekta wymiarów i wagi BS-01 (HOTFIX #613): 11,95×2,45×1,30, 21,37 t → symbol BS-A i wycena z cennika',
      'before', v_before,
      'after', v_after,
      'actor', 'system',
      'hotfix', '0324',
      'issue', 613
    )
  );

  insert into public.audit_log (user_id, action, entity, entity_id, old_value, new_value)
  values (
    null, 'HOTFIX_613_AFTER', 'loads', v_load::text,
    v_before,
    v_after || jsonb_build_object('hotfix', '0324', 'issue', 613)
  );

  insert into public.audit_log (user_id, action, entity, entity_id, new_value)
  values (
    null, 'HOTFIX_613_DONE', 'migration', '0324',
    jsonb_build_object(
      'load_id', v_load,
      'symbol', v_sym,
      'combo_height_m', v_combo_h,
      'revenue_base', v_rev,
      'cost_base', v_cost,
      'issue', 613
    )
  );

  n_fix := 1;
  return n_fix;
end;
$hotfix613$;

revoke all on function public.hotfix_613_apply() from public, anon, authenticated;
grant execute on function public.hotfix_613_apply() to service_role;
comment on function public.hotfix_613_apply() is
  '#613: korekta BS-01 wymiary/waga → BS-A + load_price_compute; idempotentna; bez BS-01 = 0.';

select public.hotfix_613_apply();
