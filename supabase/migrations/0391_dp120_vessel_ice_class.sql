-- DP-120 / F7 #694 r1 + F7 #777 r1: klasa lodowa w vessels (porównanie z IBNet).
-- Źródła klas: Digitraffic port-call/v1/vessel-details (iceClassCode), Deltamarin.
-- Bez zgadywania: brak publicznego źródła → NULL (informacyjne „sprawdź klasę”).

alter table public.vessels
  add column if not exists ice_class text;

comment on column public.vessels.ice_class is
  'Klasa lodowa fińsko-szwedzka (np. 1A Super, 1A, 1C); NULL = nieznana — ryzyko FERRY_ICE informacyjne.';

-- Nadpisanie (bez `is null`): poprawka seedu przed scaleniem nie utrwala błędu.
update public.vessels set ice_class = v.ice_class
  from (values
    /* Portnet IA (nie IAS) */
    ('M/F Megastar',          '1A'),
    ('M/F MyStar',            '1A'),
    ('M/F Finlandia',         '1A'),
    ('M/F Finbo Cargo',       '1A'),
    /* Portnet IAS */
    ('M/F Victoria I',        '1A Super'),
    ('M/F Baltic Queen',      '1A Super'),
    ('M/F Viking XPRS',       '1A Super'),
    ('M/F Viking Cinderella', '1A Super'),
    ('M/F Gabriella',         '1A Super'),
    /* Deltamarin: Ice class 1C */
    ('M/F Stena Estelle',     '1C'),
    ('M/F Stena Ebba',        '1C')
  ) as v(name, ice_class)
 where public.vessels.name = v.name;

-- Brak wiarygodnego źródła → NULL (także gdy wcześniejszy seed wpisał zgadywaną klasę).
update public.vessels
   set ice_class = null
 where name in (
   'M/F Sirena Seaways',
   'M/F Stena Spirit',
   'M/F Wawel',
   'M/F Nova Star'
 );
