-- DP-237 / decyzja 114 (F7 #885): backfill — ZAPLANOWANY/OPOZNIONY bez ATD+ATA
-- + późniejszy ATD tego samego statku → ZAMKNIETY_BEZ_POTWIERDZENIA (nie DOPLYNAL).
-- W_REJSIE bez ATA + późniejszy ATD → ten sam znacznik. Bez arrival+6h (61b).
-- Bez RECZNIE. Otwarte podejrzenie odwołania (CANCEL_SUSPECT) — pomijamy.
begin;

update public.sailings s
   set status = 'ZAMKNIETY_BEZ_POTWIERDZENIA'
 where s.status in ('ZAPLANOWANY', 'OPOZNIONY', 'W_REJSIE')
   and s.actual_arrival_at is null
   and s.source is distinct from 'RECZNIE'
   and (
     (s.status in ('ZAPLANOWANY', 'OPOZNIONY') and s.actual_departure_at is null)
     or s.status = 'W_REJSIE'
   )
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

-- Szum AIS_DEP_DELAY na domkniętych rejsach (pkt 5 propozycji DP-140 / decyzja 114).
update public.risk_signals r
   set resolved_at = now()
 where r.resolved_at is null
   and r.dedup_key like 'AIS_DEP_DELAY:%'
   and exists (
     select 1
       from public.sailings s
      where s.id::text = substr(r.dedup_key, length('AIS_DEP_DELAY:') + 1)
        and s.status = 'ZAMKNIETY_BEZ_POTWIERDZENIA'
   );

commit;
