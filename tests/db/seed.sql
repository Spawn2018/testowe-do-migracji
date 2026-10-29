-- Dane testowe: trzy firmy, trzej użytkownicy, projekt, dwa transporty,
-- faktura kosztowa SCX→HHL w PLN i faktura przychodowa HHL→KSH w EUR.
insert into organizations (id, code, name, kind) values
 ('00000000-0000-0000-0000-00000000a001','HHL','H&H Logistics','FORWARDER'),
 ('00000000-0000-0000-0000-00000000a002','KSH','KSH','CLIENT'),
 ('00000000-0000-0000-0000-00000000a003','SCX','Scandinavian Express','CARRIER');
insert into app_users (auth_id, org_id, email, role) values
 ('11111111-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000a001','hhl@test','HHL_ADMIN'),
 ('11111111-0000-0000-0000-000000000002','00000000-0000-0000-0000-00000000a002','ksh@test','CLIENT_USER'),
 ('11111111-0000-0000-0000-000000000003','00000000-0000-0000-0000-00000000a003','scx@test','CARRIER_DISPATCH');
insert into projects (id, code, name, client_org_id) values
 ('22222222-0000-0000-0000-000000000001','STEGRA','Stegra Boden','00000000-0000-0000-0000-00000000a002');
insert into loads (id, project_id, carrier_org_id, order_no) values
 ('33333333-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000a003','KSH/1'),
 ('33333333-0000-0000-0000-000000000002','22222222-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000a003','KSH/2');
insert into load_cost (load_id, base_amount) values ('33333333-0000-0000-0000-000000000001', 2000);
insert into load_revenue (load_id, base_amount) values ('33333333-0000-0000-0000-000000000001', 2500);
insert into invoices (id, project_id, carrier_org_id, period_start, period_end, direction,
  issuer_org_id, recipient_org_id, invoice_number, currency, net_total, gross_total, due_date) values
 ('44444444-0000-0000-0000-00000000000c','22222222-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000a003',
  '2026-09-21','2026-09-27','KOSZT','00000000-0000-0000-0000-00000000a003','00000000-0000-0000-0000-00000000a001','SCX/9/2026','PLN',10095.03,10095.03,'2026-10-28'),
 ('44444444-0000-0000-0000-0000000000ee','22222222-0000-0000-0000-000000000001',null,
  '2026-09-21','2026-09-27','PRZYCHOD','00000000-0000-0000-0000-00000000a001','00000000-0000-0000-0000-00000000a002','HHL/9/2026','EUR',3000,3000,'2026-10-28');
insert into invoice_lines (invoice_id, load_id, direction) values
 ('44444444-0000-0000-0000-00000000000c','33333333-0000-0000-0000-000000000001','KOSZT'),
 ('44444444-0000-0000-0000-0000000000ee','33333333-0000-0000-0000-000000000001','PRZYCHOD');
insert into payment_terms (project_id, payer_org_id, payee_org_id, term_days, basis) values
 ('22222222-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000a002','00000000-0000-0000-0000-00000000a001',30,'WYSTAWIENIE'),
 ('22222222-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000a001','00000000-0000-0000-0000-00000000a003',35,'WYSTAWIENIE');

-- DEC-5: bufor przed Śremem (migracja 0106 tworzy go tylko gdy projekt już istnieje — na świeżej bazie testowej po seedzie)
insert into geofences (
  project_id, name, kind, country, geom, hysteresis_m, dwell_seconds, debounce_fixes,
  notify_enter, notify_exit, notify_dwell, notify_orgs, active, sort_order
)
select
  '22222222-0000-0000-0000-000000000001', 'Bufor przed Sremem', 'PRE_ARRIVAL', 'PL',
  make_circle_fence(52.07391, 17.0246, 50000),
  1000, 0, 2, true, false, false, '{}', true, 5
where not exists (
  select 1 from geofences where name = 'Bufor przed Sremem'
);

-- BN1: strefy bałtyckie (0338 wstawia przy STEGRA_BODEN; CI ma code=STEGRA — jak Bufor przed Śremem)
insert into geofences (
  project_id, name, kind, geom, hysteresis_m, dwell_seconds, debounce_fixes,
  notify_enter, country, route
)
select '22222222-0000-0000-0000-000000000001', z.name, z.kind::geofence_kind,
       make_circle_fence(z.lat, z.lon, z.r), z.hyst, z.dwell, 2, true, z.country, z.route
  from (values
    ('Bufor 20 km przed Tallinn A',       'PRE_PORT', 59.44400, 24.76800, 20000, 500, 0,   'EE', 'TLL-HEL'),
    ('Terminal Tallinn A',                'PORT_OUT', 59.44400, 24.76800,   250, 100, 900, 'EE', 'TLL-HEL'),
    ('Bufor 20 km przed Tallinn D HEL',   'PRE_PORT', 59.44000, 24.77500, 20000, 500, 0,   'EE', 'TLL-HEL'),
    ('Terminal Tallinn D HEL',            'PORT_OUT', 59.44000, 24.77500,   250, 100, 900, 'EE', 'TLL-HEL'),
    ('Bufor 20 km przed Tallinn D',       'PRE_PORT', 59.44000, 24.77500, 20000, 500, 0,   'EE', 'TLL-STO'),
    ('Terminal Tallinn D',                'PORT_OUT', 59.44000, 24.77500,   250, 100, 900, 'EE', 'TLL-STO'),
    ('Bufor 20 km przed Muuga',           'PRE_PORT', 59.50500, 24.95800, 20000, 500, 0,   'EE', 'MUU-VUO'),
    ('Terminal Muuga HHLA',               'PORT_OUT', 59.50500, 24.95800,   800, 200, 900, 'EE', 'MUU-VUO'),
    ('Bufor 20 km przed Paldiski',        'PRE_PORT', 59.33300, 24.08300, 20000, 500, 0,   'EE', 'PLD-KPS'),
    ('Terminal Paldiski',                 'PORT_OUT', 59.33300, 24.08300,   800, 200, 900, 'EE', 'PLD-KPS'),
    ('Terminal Helsinki West Harbour T2', 'PORT_IN',  60.15400, 24.91400,   800, 200, 600, 'FI', 'TLL-HEL'),
    ('Terminal Helsinki Katajanokka',     'PORT_IN',  60.16600, 24.96800,   800, 200, 600, 'FI', 'TLL-HEL'),
    ('Terminal Vuosaari',                 'PORT_IN',  60.21200, 25.18800,   800, 200, 600, 'FI', 'MUU-VUO'),
    ('Terminal Stockholm Värtahamnen',    'PORT_IN',  59.35000, 18.11000,   800, 200, 600, 'SE', 'TLL-STO'),
    ('Terminal Kapellskär',               'PORT_IN',  59.72300, 19.06600,   800, 200, 600, 'SE', 'PLD-KPS')
  ) as z(name, kind, lat, lon, r, hyst, dwell, country, route)
 where not exists (
   select 1 from geofences g where g.name = z.name
 );

-- A7: zezwolenie firmowe + polisa HHL (0237 przy pustej bazie nic nie wstawia — orgs/projekty są tu)
select a7_seed_firm_assets();
select doc_requirements_seed(id) from projects;

-- #402: w bramie testowej kanały firmy włączone (na produkcji właściciel ma wyłączone w org_kind).
update notification_matrix_org_kind set in_app = true, email = true;
