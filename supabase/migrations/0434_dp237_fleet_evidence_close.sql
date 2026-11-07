-- DP-237 / decyzja 114 (F7 #885) + r2 przegląd #886:
-- B1: trigger nie cofa ZAMKNIETY_BEZ_POTWIERDZENIA (jak DP-130 dla DOPLYNAL).
-- B2: W_REJSIE z ATD + późniejszy ATD → DOPLYNAL; ZAPLANOWANY/OPOZNIONY bez ATD
--     + późniejszy ATD → ZAMKNIETY_BEZ_POTWIERDZENIA. Bez arrival+6h (61b). Bez RECZNIE.
-- Otwarte CANCEL_SUSPECT — pomijamy. Resolve AIS_DEP_DELAY na domkniętych.

begin;

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
  elsif new.status is not distinct from 'ZAMKNIETY_BEZ_POTWIERDZENIA' then
    /* DP-237 B1: jawny znacznik floty — nie cofaj do W_REJSIE przy ATD. */
    return new;
  elsif new.actual_departure_at is not null then
    new.status := 'W_REJSIE';
  end if;
  return new;
end;
$$;

comment on function public.sailings_set_status_from_actual() is
  '#446/F7 + DP-130 + DP-237: actual_* → W_REJSIE/DOPLYNAL; jawny DOPLYNAL i ZAMKNIETY_BEZ_POTWIERDZENIA przy ATA null zostają; ODWOLANY bez zmian.';

-- B2: W_REJSIE z ATD + późniejszy ATD tego samego statku → DOPLYNAL (bez ATA).
update public.sailings s
   set status = 'DOPLYNAL'
 where s.status = 'W_REJSIE'
   and s.actual_arrival_at is null
   and s.actual_departure_at is not null
   and s.source is distinct from 'RECZNIE'
   and exists (
     select 1
       from public.sailings x
      where x.vessel_id = s.vessel_id
        and x.id <> s.id
        and x.actual_departure_at is not null
        and x.departure_at > s.departure_at
   )
   and not exists (
     select 1
       from public.risk_signals r
      where r.resolved_at is null
        and r.dedup_key = ('FERRY_CANCEL_SUSPECT:AIS:' || s.id::text)
   );

-- B2: ZAPLANOWANY/OPOZNIONY bez ATD+ATA + późniejszy ATD → ZAMKNIETY_BEZ_POTWIERDZENIA.
-- B3: pomijamy rejsy z niezakończonym transportem (ryzyko podnosi job Edge).
update public.sailings s
   set status = 'ZAMKNIETY_BEZ_POTWIERDZENIA'
 where s.status in ('ZAPLANOWANY', 'OPOZNIONY')
   and s.actual_arrival_at is null
   and s.actual_departure_at is null
   and s.source is distinct from 'RECZNIE'
   and exists (
     select 1
       from public.sailings x
      where x.vessel_id = s.vessel_id
        and x.id <> s.id
        and x.actual_departure_at is not null
        and x.departure_at > s.departure_at
   )
   and not exists (
     select 1
       from public.risk_signals r
      where r.resolved_at is null
        and r.dedup_key = ('FERRY_CANCEL_SUSPECT:AIS:' || s.id::text)
   )
   and not exists (
     select 1
       from public.loads l
      where l.sailing_id = s.id
        and l.status not in (
          'CANCELLED', 'REMOVED', 'UNLOADED', 'DELIVERED',
          'READY_TO_INVOICE', 'INVOICED'
        )
   );

-- Szum AIS_DEP_DELAY na domkniętych rejsach (pkt 5 / decyzja 114).
update public.risk_signals r
   set resolved_at = now()
 where r.resolved_at is null
   and r.dedup_key like 'AIS_DEP_DELAY:%'
   and exists (
     select 1
       from public.sailings s
      where s.id::text = substr(r.dedup_key, length('AIS_DEP_DELAY:') + 1)
        and s.status in ('ZAMKNIETY_BEZ_POTWIERDZENIA', 'DOPLYNAL')
   );

commit;
