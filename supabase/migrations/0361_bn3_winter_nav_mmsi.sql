-- BN3 pkt 8 (#573 / decyzja 61): MMSI promów bałtyckich (zweryfikowane Digitraffic vessel-details 01.11.2026).
-- XPRS / Finbo były null w 0347; Finlandia / MyStar / Megastar — potwierdzenie tych samych wartości.

update public.vessels set mmsi = 230705000, imo = coalesce(imo, 9375654)
 where name = 'M/F Viking XPRS' and (mmsi is distinct from 230705000 or imo is null);

update public.vessels set mmsi = 230685000, imo = coalesce(imo, 9181106)
 where name = 'M/F Finbo Cargo' and (mmsi is distinct from 230685000 or imo is null);

update public.vessels set mmsi = 230628000
 where name = 'M/F Finlandia' and mmsi is distinct from 230628000;

update public.vessels set mmsi = 276859000
 where name = 'M/F MyStar' and mmsi is distinct from 276859000;

update public.vessels set mmsi = 276829000
 where name = 'M/F Megastar' and mmsi is distinct from 276829000;
