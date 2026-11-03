-- DP-120 / F7 #694 r1: klasa lodowa w vessels (porównanie z ograniczeniem IBNet).
-- Ro-pax bałtyckie zwykle 1A Super — spełnia typowe „I 2000” / „II 2000”.

alter table public.vessels
  add column if not exists ice_class text;

comment on column public.vessels.ice_class is
  'Klasa lodowa fińsko-szwedzka (np. 1A Super, 1A, 1B, II); NULL = nieznana — ryzyko FERRY_ICE informacyjne.';

update public.vessels set ice_class = v.ice_class
  from (values
    ('M/F Megastar',       '1A Super'),
    ('M/F MyStar',         '1A Super'),
    ('M/F Victoria I',     '1A Super'),
    ('M/F Baltic Queen',   '1A Super'),
    ('M/F Viking XPRS',    '1A Super'),
    ('M/F Finlandia',      '1A Super'),
    ('M/F Finbo Cargo',    '1A Super'),
    ('M/F Sirena Seaways', '1A'),
    ('M/F Stena Spirit',   '1A'),
    ('M/F Stena Estelle',  '1A Super'),
    ('M/F Stena Ebba',     '1A Super'),
    ('M/F Wawel',          '1A'),
    ('M/F Nova Star',      '1A'),
    ('M/F Cracovia',       '1A')
  ) as v(name, ice_class)
 where public.vessels.name = v.name
   and public.vessels.ice_class is null;
