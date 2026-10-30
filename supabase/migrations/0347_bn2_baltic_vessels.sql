-- BN2 (#573 / #640): rejestr statków korytarza bałtyckiego (Tallink, Viking, Eckerö/Finbo, DFDS).
-- MMSI/IMO tylko zweryfikowane (Digitraffic Portnet 30.10.2026); reszta null do uzupełnienia.

insert into public.vessels (name, operator, mmsi, imo) values
  ('M/F Megastar',       'Tallink',      276829000, 9773064),
  ('M/F MyStar',         'Tallink',      276859000, 9892690),
  ('M/F Victoria I',     'Tallink',      null,       null),
  ('M/F Baltic Queen',   'Tallink',      276779000, 9443255),
  ('M/F Viking XPRS',    'Viking Line',  null,       null),
  ('M/F Finlandia',      'Eckerö Line',  230628000, 9214379),
  ('M/F Finbo Cargo',    'Eckerö Line',  null,       null),
  ('M/F Sirena Seaways', 'DFDS',         null,       null)
on conflict (name) do update set
  operator = excluded.operator,
  mmsi = coalesce(excluded.mmsi, public.vessels.mmsi),
  imo = coalesce(excluded.imo, public.vessels.imo);
