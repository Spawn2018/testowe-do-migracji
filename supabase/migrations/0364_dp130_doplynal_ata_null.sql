-- DP-130 (F7 #703 r2): trigger 0264 nie cofa jawnego DOPLYNAL przy ATA null.
-- closeStaleFiToEeWithoutAta ustawia status=DOPLYNAL bez actual_arrival_at; stary
-- trigger widział ATD i wymuszał W_REJSIE — 23 rejsy utknięte (HEL-TLL/HELA-TLL/
-- STO-TLL/KAA-GDY). Porządek: jawny DOPLYNAL zostaje; migracja danych dla
-- rejsów W_REJSIE >3 h po planowym przypłynięciu bez ATA i bez transportów.

create or replace function public.sailings_set_status_from_actual()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is not distinct from 'ODWOLANY' then
    return new;
  end if;
  if new.actual_arrival_at is not null then
    new.status := 'DOPLYNAL';
  elsif new.status is not distinct from 'DOPLYNAL' then
    /* DP-130: jawny DOPLYNAL (closeStale bez ATA) — nie cofaj do W_REJSIE. */
    return new;
  elsif new.actual_departure_at is not null then
    new.status := 'W_REJSIE';
  end if;
  return new;
end;
$$;

comment on function public.sailings_set_status_from_actual() is
  '#446/F7 + DP-130: actual_* → W_REJSIE/DOPLYNAL; jawny DOPLYNAL przy ATA null zostaje; ODWOLANY bez zmian.';

begin;

do $dp130$
declare
  v_prev text;
  v_n int;
begin
  select count(*)::int into v_n
    from public.sailings s
   where s.status = 'W_REJSIE'
     and s.actual_arrival_at is null
     and s.actual_departure_at is not null
     and s.arrival_at < now() - interval '3 hours'
     and s.route in ('HEL-TLL', 'HELA-TLL', 'STO-TLL', 'KAA-GDY')
     and s.source is distinct from 'RECZNIE'
     and not exists (
       select 1 from public.loads l where l.sailing_id = s.id
     );

  /* SELECT koordynatora 01.11: 23; próg ×3 na wypadek narostu do wdrożenia. */
  if v_n > 80 then
    raise exception 'DP-130: za szeroki porządek (%) — STOP', v_n;
  end if;

  if v_n = 0 then
    return;
  end if;

  v_prev := current_setting('tower.bulk_quiet', true);
  perform set_config('tower.bulk_quiet', 'on', true);

  update public.sailings s
     set status = 'DOPLYNAL',
         updated_at = now()
   where s.status = 'W_REJSIE'
     and s.actual_arrival_at is null
     and s.actual_departure_at is not null
     and s.arrival_at < now() - interval '3 hours'
     and s.route in ('HEL-TLL', 'HELA-TLL', 'STO-TLL', 'KAA-GDY')
     and s.source is distinct from 'RECZNIE'
     and not exists (
       select 1 from public.loads l where l.sailing_id = s.id
     );

  insert into public.audit_log (user_id, action, entity, entity_id, new_value)
  values (
    null,
    'DP130_STALE_W_REJSIE',
    'sailings',
    null,
    jsonb_build_object(
      'matched', v_n,
      'status_after', 'DOPLYNAL',
      'reason', 'DP-130: W_REJSIE >3h po ETA bez ATA — trigger 0264 cofał closeStale'
    )
  );

  perform set_config('tower.bulk_quiet', coalesce(v_prev, ''), true);
end
$dp130$;

commit;
