-- TOWER — 0211: A6 (D-20261015-0300-01) — SG-03 → DELIVERED 07.10.2026 12:19:54 Europe/Warsaw;
-- zdarzenie 301 oznaczone jako poprawione; pozycje po tej chwili usunięte; przeliczenie FX/opłaty.
-- Dane jednorazowe: kopia w R2 / D:\Watch Tower\dane\audyt-A przed nałożeniem na produkcję.
-- L11 w PR #203: nie duplikować SG-03 (zostaje tylko SG-01 / W3).

do $$
declare
  v_load uuid;
  v_when timestamptz := timestamptz '2026-10-07 10:19:54+00'; -- 12:19:54 Europe/Warsaw (CEST)
  v_old_status text;
  v_old_at timestamptz;
  v_pos int;
begin
  select l.id, l.status::text, l.actual_delivery_at
    into v_load, v_old_status, v_old_at
    from loads l
    join shipment_items si on si.load_id = l.id
   where si.shipment_code = 'SG-03'
   order by si.shipment_code
   limit 1;

  if v_load is null then
    raise notice '0211: brak SG-03 — pomijam';
    return;
  end if;

  -- Idempotencja: już poprawione.
  if v_old_status = 'DELIVERED' and v_old_at is not distinct from v_when then
    raise notice '0211: SG-03 już DELIVERED z właściwą godziną';
  else
    update loads
       set status = 'DELIVERED',
           actual_delivery_at = v_when,
           updated_at = now()
     where id = v_load;

    insert into audit_log (user_id, action, entity, entity_id, old_value, new_value)
    values (
      null, 'SG03_DELIVERY_FIX', 'loads', v_load::text,
      jsonb_build_object('status', v_old_status, 'actual_delivery_at', v_old_at),
      jsonb_build_object(
        'status', 'DELIVERED',
        'actual_delivery_at', v_when,
        'source', '0211_audyt_a6',
        'note', 'Dostarczone 07.10.2026 12:19:54 Europe/Warsaw (GEOFENCE_EXIT)'
      )
    );
  end if;

  -- Zdarzenie 301 (STATUS_UNLOADING „Rozładowano → POD”) — oznacz jako poprawione, bez kasowania.
  update load_events
     set payload = coalesce(payload, '{}'::jsonb) || jsonb_build_object(
           'corrected', true,
           'corrected_at', now(),
           'corrected_reason', 'A6 D-20261015-0300-01: właściwa data DELIVERED = GEOFENCE_EXIT 07.10 12:19:54',
           'correct_actual_delivery_at', v_when
         )
   where id = 301
     and load_id = v_load
     and (payload->>'corrected') is distinct from 'true';

  -- Usuń pozycje po chwili realizacji (na produkcji 15.10: 0 — idempotentne).
  delete from positions
   where load_id = v_load
     and ts > v_when;
  get diagnostics v_pos = row_count;

  -- Przeliczenie kursu NBP / opłaty (wyzwalacz FX przy zmianie actual_delivery_at; dociągnij paliwo).
  perform public.fx_snapshot_load(v_load);
  update load_cost
     set fuel_status = 'PROGNOZA'
   where load_id = v_load and fuel_status = 'OSTATECZNY' and invoiced_total_eur is null;
  update load_revenue
     set fuel_status = 'PROGNOZA'
   where load_id = v_load and fuel_status = 'OSTATECZNY' and invoiced_total_eur is null;
  perform public.load_price_compute(v_load);

  insert into audit_log (user_id, action, entity, entity_id, new_value)
  values (
    null, 'SG03_DELIVERY_FIX_DONE', 'loads', v_load::text,
    jsonb_build_object('positions_deleted', v_pos, 'source', '0211_audyt_a6')
  );
end $$;
