-- DP-139 (F7 #715): MMSI/IMO Victoria I + Sirena Seaways (null w 0347).
-- Źródło: Digitraffic AIS vessels 01.11.2026 (nazwa AIS „VICTORIA 1” / „SIRENA SEAWAYS”).
-- Etap: BN4 domknięcie przed BN5 (#714).

update public.vessels
   set mmsi = 276519000,
       imo = coalesce(imo, 9281281)
 where name = 'M/F Victoria I'
   and (mmsi is distinct from 276519000 or imo is null);

update public.vessels
   set mmsi = 277569000,
       imo = coalesce(imo, 9212163)
 where name = 'M/F Sirena Seaways'
   and (mmsi is distinct from 277569000 or imo is null);
