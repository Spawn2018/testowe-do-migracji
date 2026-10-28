-- #613 PILNE: korekta BS-01 — wymiary 11,95×2,45×1,30, 21,37 t → symbol BS-A + wycena.
-- Jak 0306/0309: logika w hotfix_613_apply(); CI bez BS-01 = no-op; TEST z fiksturą w status.sh.
-- Kwot cennika nie wpisujemy — load_price_compute czyta rate_rules z bazy.
-- Historia: NOTE (visible_to NULL) bez kwot; NOTE (FORWARDER+CARRIER) tylko koszt; przychód w audit_log.
-- Produkcja: kopia R2 przed db push. Tylko shipment_code = BS-01 (wyjątek przy ≠1 wierszu).
-- F7 r1: drop funkcji po SELECT (jak 0309/0312); status.sh odtwarza z BEGIN/END HOTFIX613.

-- BEGIN HOTFIX613
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
  v_status  text;
  v_before  jsonb;
  v_after   jsonb;
  v_pub_b   jsonb;
  v_pub_a   jsonb;
  v_cost_b  jsonb;
  v_cost_a  jsonb;
  v_sym     text;
  v_combo_h numeric;
  v_rev     numeric;
  v_cost    numeric;
  v_inv     int;
  n_fix     int := 0;
begin
  select count(*) into v_n_items
    from public.shipment_items si
   where si.shipment_code = 'BS-01';

  if v_n_items = 0 then
    return 0;
  end if;

  if v_n_items <> 1 then
    raise exception 'HOTFIX #613: oczekiwano 1 wiersz BS-01, jest % — przerwano', v_n_items
      using errcode = 'P0001';
  end if;

  select si.id, si.load_id, l.status::text
    into v_item, v_load, v_status
    from public.shipment_items si
    join public.loads l on l.id = si.load_id
   where si.shipment_code = 'BS-01';

  /* Już docelowe (wymiary + qty + waga) — bez zmian (idempotencja). */
  if exists (
    select 1 from public.shipment_items si
     where si.id = v_item
       and si.length_m = 11.95
       and si.width_m = 2.45
       and si.height_m = 1.30
       and si.qty = 2
       and si.total_weight_t = 21.37
  ) then
    return 0;
  end if;

  /* Skip: anulowany / usunięty / zafakturowany albo linie faktury. */
  select count(*) into v_inv
    from public.invoice_lines il
   where il.load_id = v_load;

  if v_status in ('CANCELLED', 'REMOVED', 'INVOICED') or v_inv > 0 then
    insert into public.audit_log (user_id, action, entity, entity_id, new_value)
    values (
      null, 'HOTFIX_613_SKIPPED', 'loads', v_load::text,
      jsonb_build_object(
        'reason', case
          when v_inv > 0 then 'invoice_lines'
          else v_status
        end,
        'status', v_status,
        'invoice_lines', v_inv,
        'hotfix', '0324',
        'issue', 613
      )
    );
    raise notice 'HOTFIX #613: skip BS-01 status=% invoice_lines=%', v_status, v_inv;
    return 0;
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
           'revenue_total', rv.total_amount,
           'cost_base', lc.base_amount,
           'cost_total', lc.total_amount
         )
    into v_before
    from public.shipment_items si
    join public.loads l on l.id = si.load_id
    left join public.load_revenue rv on rv.load_id = l.id
    left join public.load_cost lc on lc.load_id = l.id
   where si.id = v_item;

  /* Tylko dokładnie stan produkcji 28.10 (BS-B): inaczej skip bez wyjątku. */
  if not (
       (v_before->>'length_m')::numeric = 14.95
   and (v_before->>'width_m')::numeric = 2.45
   and (v_before->>'height_m')::numeric = 1.80
   and (v_before->>'qty')::numeric = 2
   and (v_before->>'total_weight_t')::numeric = 31.02
  ) then
    insert into public.audit_log (user_id, action, entity, entity_id, new_value)
    values (
      null, 'HOTFIX_613_SKIPPED', 'loads', v_load::text,
      jsonb_build_object(
        'reason', 'unexpected_before',
        'before', v_before,
        'hotfix', '0324',
        'issue', 613
      )
    );
    raise notice 'HOTFIX #613: skip BS-01 — stan ≠ 14.95×2.45×1.80/2/31.02';
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
           'revenue_total', rv.total_amount,
           'cost_base', lc.base_amount,
           'cost_total', lc.total_amount
         )
    into v_after
    from public.shipment_items si
    join public.loads l on l.id = si.load_id
    left join public.load_revenue rv on rv.load_id = l.id
    left join public.load_cost lc on lc.load_id = l.id
   where si.id = v_item;

  /* Historia — bez wycieku cen: KSH widzi wymiary; HHL+SCX osobno koszt. */
  v_pub_b := jsonb_build_object(
    'length_m', v_before->>'length_m',
    'width_m', v_before->>'width_m',
    'height_m', v_before->>'height_m',
    'qty', v_before->>'qty',
    'unit_weight_t', v_before->>'unit_weight_t',
    'total_weight_t', v_before->>'total_weight_t',
    'symbol', v_before->>'symbol',
    'combo_length_m', v_before->>'combo_length_m',
    'combo_width_m', v_before->>'combo_width_m',
    'combo_height_m', v_before->>'combo_height_m'
  );
  v_pub_a := jsonb_build_object(
    'length_m', v_after->>'length_m',
    'width_m', v_after->>'width_m',
    'height_m', v_after->>'height_m',
    'qty', v_after->>'qty',
    'unit_weight_t', v_after->>'unit_weight_t',
    'total_weight_t', v_after->>'total_weight_t',
    'symbol', v_after->>'symbol',
    'combo_length_m', v_after->>'combo_length_m',
    'combo_width_m', v_after->>'combo_width_m',
    'combo_height_m', v_after->>'combo_height_m'
  );
  v_cost_b := jsonb_build_object(
    'cost_base', v_before->'cost_base',
    'cost_total', v_before->'cost_total'
  );
  v_cost_a := jsonb_build_object(
    'cost_base', v_after->'cost_base',
    'cost_total', v_after->'cost_total'
  );

  insert into public.load_events (load_id, event_type, occurred_at, payload, visible_to)
  values (
    v_load,
    'NOTE',
    now(),
    jsonb_build_object(
      'note', 'Korekta wymiarów i wagi BS-01 (HOTFIX #613): 11,95×2,45×1,30, 21,37 t → symbol BS-A',
      'before', v_pub_b,
      'after', v_pub_a,
      'actor', 'system',
      'hotfix', '0324',
      'issue', 613
    ),
    null
  );

  insert into public.load_events (load_id, event_type, occurred_at, payload, visible_to)
  values (
    v_load,
    'NOTE',
    now(),
    jsonb_build_object(
      'note', 'Korekta kosztu BS-01 po zmianie symbolu na BS-A (HOTFIX #613)',
      'before', v_cost_b,
      'after', v_cost_a,
      'actor', 'system',
      'hotfix', '0324',
      'issue', 613,
      'kind', 'cost'
    ),
    array['FORWARDER', 'CARRIER']::org_kind[]
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
-- END HOTFIX613

revoke all on function public.hotfix_613_apply() from public, anon, authenticated;
grant execute on function public.hotfix_613_apply() to service_role;
comment on function public.hotfix_613_apply() is
  '#613: korekta BS-01 wymiary/waga → BS-A + load_price_compute; idempotentna; bez BS-01 = 0; drop po SELECT.';

select public.hotfix_613_apply();
drop function public.hotfix_613_apply();
