-- TOWER — dane startowe projektu Stegra Boden (produkcja).
-- Decyzje właściciela 24.09.2026: termin od WYSTAWIENIA faktury;
-- KSH płaci HHL w 30 dni, HHL płaci SCX w 35 dni.
-- Kraj SCX nie jest ustalony — pole zostaje z wartością domyślną do potwierdzenia.
insert into organizations (code, name, kind, default_invoice_currency) values
  ('HHL', 'H&H Logistics',        'FORWARDER', 'EUR'),
  ('KSH', 'KSH',                  'CLIENT',    'EUR'),
  ('SCX', 'Scandinavian Express', 'CARRIER',   'EUR')
on conflict (code) do nothing;

insert into projects (code, name, client_org_id)
select 'STEGRA_BODEN', 'Stegra Boden', id from organizations where code = 'KSH'
on conflict (code) do nothing;

-- faktury HHL → KSH: płaci KSH, 30 dni od wystawienia
insert into payment_terms (project_id, payer_org_id, payee_org_id, term_days, basis)
select p.id, payer.id, payee.id, 30, 'WYSTAWIENIE'
  from projects p, organizations payer, organizations payee
 where p.code = 'STEGRA_BODEN' and payer.code = 'KSH' and payee.code = 'HHL'
on conflict do nothing;

-- faktury SCX → HHL: płaci HHL, 35 dni od wystawienia
insert into payment_terms (project_id, payer_org_id, payee_org_id, term_days, basis)
select p.id, payer.id, payee.id, 35, 'WYSTAWIENIE'
  from projects p, organizations payer, organizations payee
 where p.code = 'STEGRA_BODEN' and payer.code = 'HHL' and payee.code = 'SCX'
on conflict do nothing;

-- ---------------------------------------------------------------------
-- STREFY KORYTARZA — decyzja: porty PL i SE mają swoje strefy,
-- wjazd = automatyczna zmiana statusu (migracja 0004).
-- WSPÓŁRZĘDNE DO WERYFIKACJI Z MAPĄ PRZED PRODUKCJĄ (pozycja M9 zlecenia) —
-- Research zgłosił terminale jako przybliżone.
-- Strefy ZAŁADUNKU: z adresów w docs/watch-tower/ADDRESSES.md — dopisuje
-- wykonawca, nie zgadujemy współrzędnych.
-- ---------------------------------------------------------------------
insert into geofences (project_id, name, kind, geom, hysteresis_m, dwell_seconds, debounce_fixes, notify_enter, country)
select p.id, z.name, z.kind::geofence_kind, make_circle_fence(z.lat, z.lon, z.r),
       z.hyst, z.dwell, 2, true, z.country
  from projects p,
       (values
         ('Bufor 20 km przed Gdańskiem', 'PRE_PORT',    54.4030, 18.6800, 20000,  500,   0, 'PL'),
         ('Terminal Polferries Gdańsk',  'PORT_OUT',    54.4030, 18.6800,   800,  200, 900, 'PL'),
         ('Terminal Nynäshamn',          'PORT_IN',     58.9350, 17.9500,   800,  200, 600, 'SE'),
         ('Bufor 50 km przed Boden',     'PRE_ARRIVAL', 65.8054, 21.7591, 50000, 1000,   0, 'SE'),
         ('Plac budowy Stegra Boden',    'SITE',        65.8054, 21.7591,  1500,  300, 600, 'SE')
       ) as z(name, kind, lat, lon, r, hyst, dwell, country)
 where p.code = 'STEGRA_BODEN'
   and not exists (select 1 from geofences g where g.project_id = p.id and g.name = z.name);

-- Statki linii Gdańsk – Nynäshamn. Operator od 30.03.2026 działa w ramach
-- POLSCA Baltic Ferries. Nova Star: MMSI i IMO potwierdzone w rejestrze
-- Digitraffic 25.09.2026. Wawel: nieobecny w rejestrze — MMSI do potwierdzenia.
-- Rejsy: import z rozkładu cargo armatora (ZRODLA_DANYCH.md, sekcja 1).
insert into vessels (name, operator, mmsi, imo) values
  ('M/F Wawel',     'POLSCA Baltic Ferries (Polferries)', null,      null),
  ('M/F Nova Star', 'POLSCA Baltic Ferries (Polferries)', 311000787, 9462067)
on conflict (name) do nothing;
