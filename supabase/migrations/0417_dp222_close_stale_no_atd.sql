-- DP-222 drobne (#814): GDN-NYN ZAPLANOWANY/OPOZNIONY bez ATD i bez ATA,
-- gdy ten sam statek ma późniejszy rejs z ATD → DOPLYNAL (Wawel 03.11).
-- Etap: C2 / BN9-c2. Bez zgadywania ATD/ATA; 61b — bez domknięcia samym upływem czasu.
begin;

update public.sailings s
   set status = 'DOPLYNAL'
 where s.route = 'GDN-NYN'
   and s.status in ('ZAPLANOWANY', 'OPOZNIONY')
   and s.actual_departure_at is null
   and s.actual_arrival_at is null
   and s.source is distinct from 'RECZNIE'
   and exists (
     select 1
       from public.sailings x
      where x.vessel_id = s.vessel_id
        and x.id <> s.id
        and x.actual_departure_at is not null
        and x.departure_at > s.departure_at
   );

commit;
