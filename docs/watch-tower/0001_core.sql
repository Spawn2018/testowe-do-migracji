-- =====================================================================
-- TOWER — Control Tower dla projektu KSH / Stegra Boden
-- Migracja 0001: rdzeń schematu + model bezpieczeństwa
--
-- ZASADA NADRZĘDNA TEGO PLIKU:
-- RLS w PostgreSQL jest WIERSZOWA, nie kolumnowa. Sama polityka RLS
-- NIE ukryje kolumny z marżą przed klientem. Dlatego:
--   1) koszt i przychód siedzą w OSOBNYCH tabelach,
--   2) tabele bazowe mają REVOKE ALL dla ról API,
--   3) dostęp idzie wyłącznie przez widoki z security_invoker,
--   4) edycja pól przez przewoźnika to GRANT UPDATE (kolumny).
-- =====================================================================

create extension if not exists postgis;
create extension if not exists pgcrypto;
create extension if not exists btree_gist;

-- ---------------------------------------------------------------------
-- 1. TYPY
-- ---------------------------------------------------------------------

create type org_kind as enum ('FORWARDER', 'CLIENT', 'CARRIER', 'SITE');

create type user_role as enum (
  'HHL_ADMIN',      -- Sebastian / H&H — pełny dostęp, marża, workflow
  'HHL_OPS',        -- operacje H&H — bez zarządzania użytkownikami
  'CLIENT_ADMIN',   -- KSH — harmonogram + ceny przychodowe
  'CLIENT_USER',    -- KSH — tylko podgląd
  'CARRIER_DISPATCH', -- Scandinavian Express — edycja + ceny kosztowe
  'CARRIER_USER',   -- SCX — edycja bez cen
  'SITE_VIEWER'     -- plac budowy Stegra — read-only, bez finansów
);

create type load_status as enum (
  'PLANNED', 'RESOURCES_PENDING', 'DOCS_PENDING', 'READY',
  'AT_LOADING', 'IN_TRANSIT_PL', 'AT_PORT_GDANSK', 'FERRY',
  'AT_PORT_NYNASHAMN', 'IN_TRANSIT_SE', 'AT_SITE',
  'UNLOADED', 'DELIVERED', 'CANCELLED'
);

-- Kody przyczyn opóźnień — taksonomia uzgadniana z przewoźnikiem.
-- Kod determinuje, KTO ponosi koszt. Nie zmieniaj bez aneksu do umowy.
create type delay_code as enum (
  'A_CLIENT',      -- klient: załadunek, plac, dokumenty klienta
  'B_CARRIER',     -- przewoźnik: pojazd, kierowca, awaria, brak zasobu
  'C_FORWARDER',   -- spedytor: dyspozycja, zlecenie, awizacja
  'D_FERRY',       -- prom / port: odwołany rejs, brak miejsca, odprawa
  'E_FORCE',       -- siła wyższa: sztorm, zamknięcie drogi, kolonnkörning
  'F_ADMIN'        -- administracja: zezwolenie, kontrola, granica
);

create type geofence_kind as enum (
  'LOADING', 'PRE_PORT', 'PORT_OUT', 'PORT_IN',
  'CHECKPOINT', 'PRE_ARRIVAL', 'SITE', 'REST', 'CUSTOM'
);

create type geofence_state_kind as enum ('OUTSIDE', 'PENDING_IN', 'INSIDE', 'PENDING_OUT');

create type doc_category as enum (
  'PERMIT_PL', 'PERMIT_SE', 'INSURANCE', 'CMR', 'POD',
  'LASHING_PHOTO', 'SPEC', 'INVOICE', 'FERRY_BOOKING', 'OTHER'
);

create type risk_kind as enum (
  'FERRY', 'WEATHER', 'ROAD_SE', 'ROAD_PL', 'PERMIT', 'INSURANCE',
  'SILENT_VEHICLE', 'ETA_BREACH', 'DOC_MISSING', 'RESOURCE_MISSING',
  'SEQUENCE', 'INVOICE_MISMATCH'
);

create type risk_severity as enum ('INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

create type position_source as enum ('TELEMATICS_API', 'RFMS', 'DRIVER_PWA', 'MANUAL');

-- ---------------------------------------------------------------------
-- 2. ORGANIZACJE I UŻYTKOWNICY
-- ---------------------------------------------------------------------

create table organizations (
  id          uuid primary key default gen_random_uuid(),
  code        text unique not null,           -- HHL | KSH | SCX | STEGRA
  name        text not null,
  kind        org_kind not null,
  country     char(2) not null default 'PL',
  created_at  timestamptz not null default now()
);

create table app_users (
  id          uuid primary key default gen_random_uuid(),
  auth_id     uuid unique not null,           -- = auth.users.id (Supabase)
  org_id      uuid not null references organizations(id),
  email       citext,
  full_name   text,
  role        user_role not null,
  locale      char(2) not null default 'pl',  -- pl | en | sv
  phone       text,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
create index on app_users (org_id);

-- Funkcje pomocnicze: SECURITY DEFINER + STABLE + search_path.
-- SECURITY DEFINER jest KONIECZNE — bez niego polityka RLS odpytująca
-- app_users (która sama ma RLS) wpada w nieskończoną rekurencję.
create or replace function current_app_role() returns user_role
language sql stable security definer set search_path = public as $$
  select role from app_users where auth_id = auth.uid() and active
$$;

create or replace function current_org_id() returns uuid
language sql stable security definer set search_path = public as $$
  select org_id from app_users where auth_id = auth.uid() and active
$$;

create or replace function current_org_kind() returns org_kind
language sql stable security definer set search_path = public as $$
  select o.kind from app_users u join organizations o on o.id = u.org_id
  where u.auth_id = auth.uid() and u.active
$$;

create or replace function is_hhl() returns boolean
language sql stable as $$ select current_app_role() in ('HHL_ADMIN','HHL_OPS') $$;

create or replace function can_see_margin() returns boolean
language sql stable as $$ select current_app_role() = 'HHL_ADMIN' $$;

-- ---------------------------------------------------------------------
-- 3. PROJEKT, ELEMENTY, TRANSPORTY
--    Model DWUPOZIOMOWY: element (shipment_item) N:1 transport (load).
--    Jeden zestaw może wieźć SG-01 i SG-02 razem — jedna tabela by to zabiła.
-- ---------------------------------------------------------------------

create table projects (
  id            uuid primary key default gen_random_uuid(),
  code          text unique not null,          -- STEGRA_BODEN
  name          text not null,
  client_org_id uuid not null references organizations(id),
  origin_country char(2) not null default 'PL',
  dest_country   char(2) not null default 'SE',
  created_at    timestamptz not null default now()
);

create table schedule_imports (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references projects(id),
  version       int  not null,
  source        text not null,                 -- UPLOAD | MS_GRAPH
  file_path     text,                          -- surowy XLSX w Storage (audyt)
  file_hash     text,
  column_map    jsonb not null,                -- zapisany szablon mapowania
  stats         jsonb not null,                -- {added, changed, removed, rejected}
  imported_by   uuid references app_users(id),
  imported_at   timestamptz not null default now(),
  unique (project_id, version)
);

create table loads (
  id                 uuid primary key default gen_random_uuid(),
  project_id         uuid not null references projects(id),
  order_no           text,                     -- "Nr zlecenia" z Excela
  carrier_org_id     uuid references organizations(id),
  status             load_status not null default 'PLANNED',

  -- plan (z Excela KSH) — AWIZACJA JAKO OKNO, nie punkt
  plan_load_date     date,
  plan_load_from     timestamptz,
  plan_load_to       timestamptz,
  plan_delivery_date date,
  plan_delivery_from timestamptz,
  plan_delivery_to   timestamptz,

  -- fakty
  actual_load_at     timestamptz,
  actual_delivery_at timestamptz,

  -- zasoby (uzupełnia przewoźnik)
  tractor_plate      text,
  trailer_plate      text,
  trailer_type       text,                     -- teleskopowa | niskopodwoziowa | ...
  driver_name        text,                     -- DANE OSOBOWE — patrz retencja
  driver_phone       text,                     -- E.164
  escort_vehicles    int  not null default 0,
  telematics_vehicle_id text,
  telematics_provider   text,

  -- prom
  ferry_booking_ref  text,
  ferry_vessel       text,                     -- WAWEL | NOVA_STAR | ...
  ferry_departure    timestamptz,

  -- wymiary ZESTAWU (nie elementu!) — do walidacji zezwoleń
  combo_length_m     numeric(6,2),
  combo_width_m      numeric(6,2),
  combo_height_m     numeric(6,2),
  combo_weight_t     numeric(8,2),

  -- odchylenia
  delay_minutes      int,
  delay_code         delay_code,
  delay_owner        org_kind,
  delay_note         text,

  -- ETA
  eta_site           timestamptz,
  eta_confidence_min int,                      -- +/- minut
  eta_computed_at    timestamptz,

  -- ESG (faza 2, ISO 14083)
  co2_kg             numeric(10,2),

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index on loads (project_id, status);
create index on loads (carrier_org_id);
create index on loads (plan_load_date);
create index on loads (plan_delivery_date);

create table shipment_items (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid not null references projects(id),
  load_id          uuid references loads(id) on delete set null,

  -- KLUCZ NATURALNY = kolumna "Wysyłka" (SG-01, T-01).
  -- "Lp." jest niestabilne przy re-imporcie i celowo go nie ma.
  shipment_code    text not null,
  item_type        text,                       -- "Typ"

  length_m         numeric(6,2) not null,
  width_m          numeric(6,2) not null,
  height_m         numeric(6,2) not null,
  unit_weight_t    numeric(8,3),
  qty              int not null default 1,
  total_weight_t   numeric(8,3),

  assembly_seq     int,                        -- kolejność montażowa u KSH
  oversize_flags   text[] not null default '{}',-- {LENGTH_PL, WEIGHT_SE, ...}

  first_seen_import uuid references schedule_imports(id),
  last_seen_import  uuid references schedule_imports(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (project_id, shipment_code)
);
create index on shipment_items (load_id);
create index on shipment_items (project_id, assembly_seq);

-- Walidacja spójności wag: waga_transportu ~= ilosc * waga_elementu +/-5%.
-- W próbce KSH ta reguła wywala T-01 (55 "sztuk" przy 20,17 t) — i dobrze,
-- bo to przesunięta kolumna, a nie prawdziwy 55-tonowy ładunek.
alter table shipment_items add constraint chk_weight_consistency check (
  unit_weight_t is null
  or total_weight_t is null
  or abs(total_weight_t - (qty * unit_weight_t)) <= greatest(0.05 * total_weight_t, 0.10)
) not valid;   -- NOT VALID: istniejące błędne dane wpadają do raportu, nie blokują migracji

-- ---------------------------------------------------------------------
-- 4. STRUMIEŃ ZDARZEŃ — append-only, źródło prawdy o stanie
-- ---------------------------------------------------------------------

create table load_events (
  id           bigserial primary key,
  load_id      uuid not null references loads(id) on delete cascade,
  event_type   text not null,
  occurred_at  timestamptz not null,
  recorded_at  timestamptz not null default now(),
  source       position_source,
  actor_id     uuid references app_users(id),
  geom         geometry(Point, 4326),
  payload      jsonb not null default '{}'::jsonb,
  dedup_key    text
);
create unique index on load_events (dedup_key) where dedup_key is not null;
create index on load_events (load_id, occurred_at desc);
create index on load_events (event_type, occurred_at desc);

-- Blokada UPDATE/DELETE: historia jest niezmienna.
create or replace function forbid_mutation() returns trigger
language plpgsql as $$
begin raise exception 'load_events jest append-only'; end $$;

create trigger trg_load_events_immutable
  before update or delete on load_events
  for each row execute function forbid_mutation();

-- ---------------------------------------------------------------------
-- 5. POZYCJE — surowy GPS NIGDY nie jest nadpisywany snapowanym
-- ---------------------------------------------------------------------

create table positions (
  id            bigserial primary key,
  load_id       uuid not null references loads(id) on delete cascade,
  ts            timestamptz not null,
  geom_raw      geometry(Point, 4326) not null,   -- surowy odczyt, nietykalny
  geom_snapped  geometry(Point, 4326),            -- po snapowaniu do sieci drogowej
  speed_kmh     numeric(5,1),
  heading_deg   numeric(5,1),
  ignition      boolean,
  source        position_source not null,
  raw           jsonb,
  inserted_at   timestamptz not null default now(),
  unique (load_id, ts, source)                    -- idempotencja przy retry crona
);
create index on positions using gist (geom_raw);
create index on positions using brin (ts);
create index on positions (load_id, ts desc);

-- ---------------------------------------------------------------------
-- 6. GEOFENCE
-- ---------------------------------------------------------------------

create table geofences (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references projects(id),
  name            text not null,
  kind            geofence_kind not null,
  geom            geometry(Polygon, 4326) not null,  -- okrąg zapisujemy jako bufor
  hysteresis_m    int  not null default 200,
  dwell_seconds   int  not null default 0,
  debounce_fixes  int  not null default 2,           -- N kolejnych próbek
  notify_enter    boolean not null default true,
  notify_exit     boolean not null default false,
  notify_dwell    boolean not null default false,
  notify_orgs     uuid[] not null default '{}',
  message_tpl     text,
  active          boolean not null default true,
  sort_order      int not null default 0,
  created_at      timestamptz not null default now()
);
create index on geofences using gist (geom);
create index on geofences (project_id, active);

create table geofence_states (
  load_id       uuid not null references loads(id) on delete cascade,
  geofence_id   uuid not null references geofences(id) on delete cascade,
  state         geofence_state_kind not null default 'OUTSIDE',
  consec_fixes  int not null default 0,
  entered_at    timestamptz,
  exited_at     timestamptz,
  last_eval_at  timestamptz,
  primary key (load_id, geofence_id)
);

-- ---------------------------------------------------------------------
-- 7. DOKUMENTY, ZEZWOLENIA, POLISY
-- ---------------------------------------------------------------------

create table documents (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references projects(id),
  load_id       uuid references loads(id) on delete cascade,
  category      doc_category not null,
  storage_path  text not null,
  file_name     text not null,
  mime_type     text,
  size_bytes    bigint,
  version       int not null default 1,
  valid_until   date,
  visible_to    org_kind[] not null default '{FORWARDER,CLIENT,CARRIER}',
  uploaded_by   uuid references app_users(id),
  uploaded_at   timestamptz not null default now()
);
create index on documents (load_id, category);
create index on documents (project_id, category);

create table permits (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references projects(id),
  country        char(2) not null,
  permit_no      text not null,
  authority      text,
  category       text,
  max_length_m   numeric(6,2),
  max_width_m    numeric(6,2),
  max_height_m   numeric(6,2),
  max_weight_t   numeric(8,2),
  route_desc     text,
  route_geom     geometry(LineString, 4326),
  escort_required int not null default 0,
  valid_from     date not null,
  valid_until    date not null,
  document_id    uuid references documents(id),
  created_at     timestamptz not null default now()
);

create table load_permits (
  load_id   uuid references loads(id) on delete cascade,
  permit_id uuid references permits(id) on delete cascade,
  primary key (load_id, permit_id)
);

-- Walidator: czy zestaw mieści się w zezwoleniu.
-- To jest funkcja, która ratuje przed zawróceniem auta na granicy.
create or replace function permit_fits(p_load_id uuid, p_permit_id uuid)
returns table (ok boolean, breaches text[])
language sql stable as $$
  select
    coalesce(bool_and(t.pass), false) as ok,
    array_remove(array_agg(case when not t.pass then t.label end), null) as breaches
  from loads l
  join permits p on p.id = p_permit_id
  cross join lateral (values
    ('LENGTH',  coalesce(l.combo_length_m,0) <= coalesce(p.max_length_m, 9999)),
    ('WIDTH',   coalesce(l.combo_width_m ,0) <= coalesce(p.max_width_m , 9999)),
    ('HEIGHT',  coalesce(l.combo_height_m,0) <= coalesce(p.max_height_m, 9999)),
    ('WEIGHT',  coalesce(l.combo_weight_t,0) <= coalesce(p.max_weight_t, 9999)),
    ('VALIDITY',coalesce(l.plan_load_date, current_date) between p.valid_from and p.valid_until)
  ) as t(label, pass)
  where l.id = p_load_id;
$$;

create table insurance_policies (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations(id),
  policy_no     text not null,
  insurer       text,
  scope         text,
  sum_insured   numeric(14,2),
  currency      char(3) not null default 'EUR',
  covers_oversize boolean not null default false,
  covers_sweden   boolean not null default false,
  valid_from    date not null,
  valid_until   date not null,
  document_id   uuid references documents(id)
);

-- ---------------------------------------------------------------------
-- 8. CENNIK, BAF, WALUTY, MARŻA
--    Koszt i przychód w OSOBNYCH tabelach — to jest cała ochrona.
-- ---------------------------------------------------------------------

create table fx_rates (                 -- NBP tabela A
  currency   char(3) not null,
  rate_date  date not null,
  rate_pln   numeric(12,6) not null,
  table_no   text,
  source_url text,
  fetched_at timestamptz not null default now(),
  primary key (currency, rate_date)
);

create table baf_definitions (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid not null references projects(id),
  name             text not null,
  index_source     text not null,       -- EC_WEEKLY_OIL_BULLETIN | ORLEN_WHOLESALE | ...
  index_currency   char(3) not null default 'PLN',
  base_value       numeric(12,4) not null,
  base_date        date not null,
  fuel_share       numeric(5,4) not null,   -- np. 0.2800
  trigger_threshold numeric(5,4) not null default 0.0150,
  rounding_step    numeric(5,4) not null default 0.0050,
  floor_pct        numeric(6,4),
  cap_pct          numeric(6,4),
  revision_cycle   text not null default 'WEEKLY',
  active           boolean not null default true
);

create table baf_index_values (
  id           bigserial primary key,
  baf_id       uuid not null references baf_definitions(id),
  value_date   date not null,
  value        numeric(12,4) not null,
  source_url   text not null,           -- DOWÓD dla przewoźnika przy sporze
  fetched_at   timestamptz not null default now(),
  unique (baf_id, value_date)
);

create table rate_cards (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects(id),
  side        text not null check (side in ('COST','REVENUE')),
  org_id      uuid not null references organizations(id),
  currency    char(3) not null default 'PLN',
  baf_id      uuid references baf_definitions(id),
  valid_from  date not null,
  valid_until date,
  version     int not null default 1
);

create table rate_rules (
  id            uuid primary key default gen_random_uuid(),
  rate_card_id  uuid not null references rate_cards(id) on delete cascade,
  length_from   numeric(6,2) not null default 0,
  length_to     numeric(6,2) not null default 9999,
  width_from    numeric(6,2) not null default 0,
  width_to      numeric(6,2) not null default 9999,
  height_from   numeric(6,2) not null default 0,
  height_to     numeric(6,2) not null default 9999,
  weight_from   numeric(8,2) not null default 0,
  weight_to     numeric(8,2) not null default 9999,
  base_rate     numeric(12,2) not null,
  note          text
);

-- Snapshoty cen na transporcie. Rozdzielone celowo.
create table load_cost (
  load_id       uuid primary key references loads(id) on delete cascade,
  rate_card_id  uuid references rate_cards(id),
  currency      char(3) not null default 'PLN',
  base_amount   numeric(12,2) not null default 0,
  baf_pct       numeric(6,4) not null default 0,
  baf_amount    numeric(12,2) not null default 0,
  extras        jsonb not null default '[]'::jsonb,  -- pilotaż, prom, postojowe
  extras_amount numeric(12,2) not null default 0,
  total_amount  numeric(12,2) generated always as (base_amount + baf_amount + extras_amount) stored,
  fx_date       date,
  fx_rate_pln   numeric(12,6),
  total_pln     numeric(12,2),
  computed_at   timestamptz not null default now()
);

create table load_revenue (
  load_id       uuid primary key references loads(id) on delete cascade,
  rate_card_id  uuid references rate_cards(id),
  currency      char(3) not null default 'PLN',
  base_amount   numeric(12,2) not null default 0,
  baf_pct       numeric(6,4) not null default 0,
  baf_amount    numeric(12,2) not null default 0,
  extras        jsonb not null default '[]'::jsonb,
  extras_amount numeric(12,2) not null default 0,
  total_amount  numeric(12,2) generated always as (base_amount + baf_amount + extras_amount) stored,
  fx_date       date,
  fx_rate_pln   numeric(12,6),
  total_pln     numeric(12,2),
  computed_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 9. FAKTURY ZBIORCZE (cykl tygodniowy)
-- ---------------------------------------------------------------------

create table invoices (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references projects(id),
  carrier_org_id  uuid not null references organizations(id),
  period_start    date not null,
  period_end      date not null,
  currency        char(3) not null default 'PLN',
  expected_amount numeric(14,2),          -- wyliczone z cennika
  invoiced_amount numeric(14,2),          -- wpisane przez przewoźnika
  variance        numeric(14,2) generated always as (invoiced_amount - expected_amount) stored,
  status          text not null default 'DRAFT',  -- DRAFT|SUBMITTED|MATCHED|DISPUTED|APPROVED
  document_id     uuid references documents(id),
  submitted_by    uuid references app_users(id),
  submitted_at    timestamptz,
  decided_by      uuid references app_users(id),
  decided_at      timestamptz,
  dispute_note    text
);

create table invoice_lines (
  invoice_id      uuid references invoices(id) on delete cascade,
  load_id         uuid references loads(id),
  expected_amount numeric(12,2),
  invoiced_amount numeric(12,2),
  primary key (invoice_id, load_id)
);

-- ---------------------------------------------------------------------
-- 10. RYZYKA, WORKFLOW, POWIADOMIENIA, CZAT, AUDYT
-- ---------------------------------------------------------------------

create table risk_signals (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects(id),
  load_id     uuid references loads(id) on delete cascade,
  kind        risk_kind not null,
  severity    risk_severity not null,
  title       text not null,
  detail      jsonb not null default '{}'::jsonb,
  source_url  text,
  detected_at timestamptz not null default now(),
  valid_until timestamptz,
  resolved_at timestamptz,
  resolved_by uuid references app_users(id),
  dedup_key   text
);
create unique index on risk_signals (dedup_key) where dedup_key is not null and resolved_at is null;
create index on risk_signals (project_id, severity, detected_at desc) where resolved_at is null;

create table workflows (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references projects(id),
  name         text not null,
  trigger_type text not null,             -- typ z katalogu load_events lub CRON
  condition    jsonb not null default 'true'::jsonb,   -- JSONLogic
  actions      jsonb not null,            -- [{type, params}]
  enabled      boolean not null default true,
  created_by   uuid references app_users(id),
  created_at   timestamptz not null default now()
);

create table workflow_runs (
  id          bigserial primary key,
  workflow_id uuid not null references workflows(id) on delete cascade,
  load_id     uuid references loads(id),
  event_id    bigint references load_events(id),
  status      text not null,              -- OK | SKIPPED | ERROR
  result      jsonb,
  ran_at      timestamptz not null default now()
);

create table notifications (
  id          bigserial primary key,
  channel     text not null,              -- EMAIL | SMS | IN_APP | WEBHOOK
  recipient   text not null,
  user_id     uuid references app_users(id),
  load_id     uuid references loads(id),
  template    text not null,
  payload     jsonb not null default '{}'::jsonb,
  status      text not null default 'PENDING',
  dedup_key   text,
  sent_at     timestamptz,
  error       text,
  created_at  timestamptz not null default now()
);
create unique index on notifications (dedup_key) where dedup_key is not null;

create table load_messages (            -- czat per transport
  id         bigserial primary key,
  load_id    uuid not null references loads(id) on delete cascade,
  author_id  uuid not null references app_users(id),
  body       text not null,
  visible_to org_kind[] not null default '{FORWARDER,CLIENT,CARRIER}',
  created_at timestamptz not null default now()
);
create index on load_messages (load_id, created_at desc);

create table audit_log (
  id         bigserial primary key,
  user_id    uuid references app_users(id),
  action     text not null,
  entity     text not null,
  entity_id  text,
  old_value  jsonb,
  new_value  jsonb,
  ip_address inet,
  created_at timestamptz not null default now()
);
create index on audit_log (entity, entity_id, created_at desc);

-- ---------------------------------------------------------------------
-- 11. RLS + BLOKADA TABEL BAZOWYCH
-- ---------------------------------------------------------------------

alter table organizations      enable row level security;
alter table app_users          enable row level security;
alter table projects           enable row level security;
alter table loads              enable row level security;
alter table shipment_items     enable row level security;
alter table load_events        enable row level security;
alter table positions          enable row level security;
alter table geofences          enable row level security;
alter table documents          enable row level security;
alter table permits            enable row level security;
alter table insurance_policies enable row level security;
alter table rate_cards         enable row level security;
alter table rate_rules         enable row level security;
alter table load_cost          enable row level security;
alter table load_revenue       enable row level security;
alter table invoices           enable row level security;
alter table invoice_lines      enable row level security;
alter table risk_signals       enable row level security;
alter table workflows          enable row level security;
alter table load_messages      enable row level security;
alter table audit_log          enable row level security;

-- KLUCZOWE: zabieramy dostęp do tabel bazowych rolom API PostgREST.
-- Bez tego klient odpyta /rest/v1/load_cost?select=* i zobaczy Twój koszt.
revoke all on load_cost, load_revenue, rate_cards, rate_rules,
               baf_definitions, baf_index_values, audit_log
  from anon, authenticated;

-- loads: odczyt wg organizacji
create policy loads_read on loads for select to authenticated using (
  is_hhl()
  or (current_org_kind() = 'CLIENT'
      and exists (select 1 from projects p
                  where p.id = loads.project_id and p.client_org_id = current_org_id()))
  or (current_org_kind() = 'CARRIER' and loads.carrier_org_id = current_org_id())
  or (current_org_kind() = 'SITE')
);

create policy loads_write_hhl on loads for all to authenticated
  using (is_hhl()) with check (is_hhl());

-- Przewoźnik: może modyfikować TYLKO swoje wiersze...
create policy loads_update_carrier on loads for update to authenticated
  using (current_org_kind() = 'CARRIER' and carrier_org_id = current_org_id())
  with check (current_org_kind() = 'CARRIER' and carrier_org_id = current_org_id());

-- ...i TYLKO te kolumny (to jest przywilej kolumnowy Postgresa, nie RLS).
grant update (
  tractor_plate, trailer_plate, trailer_type,
  driver_name, driver_phone, escort_vehicles,
  telematics_vehicle_id, telematics_provider,
  ferry_booking_ref, ferry_vessel, ferry_departure,
  combo_length_m, combo_width_m, combo_height_m, combo_weight_t,
  plan_load_from, plan_load_to, plan_delivery_from, plan_delivery_to,
  actual_load_at, actual_delivery_at, status
) on loads to authenticated;

grant select on loads to authenticated;

-- CENY: koszt widzą tylko H&H i przewoźnik-właściciel
create policy cost_read on load_cost for select to authenticated using (
  is_hhl()
  or exists (select 1 from loads l where l.id = load_cost.load_id
             and current_org_kind() = 'CARRIER'
             and l.carrier_org_id = current_org_id()
             and current_app_role() = 'CARRIER_DISPATCH')
);
create policy cost_write on load_cost for all to authenticated
  using (is_hhl()) with check (is_hhl());

-- PRZYCHÓD: widzą tylko H&H i klient
create policy revenue_read on load_revenue for select to authenticated using (
  is_hhl()
  or exists (select 1 from loads l join projects p on p.id = l.project_id
             where l.id = load_revenue.load_id
             and current_org_kind() = 'CLIENT'
             and p.client_org_id = current_org_id())
);
create policy revenue_write on load_revenue for all to authenticated
  using (is_hhl()) with check (is_hhl());

-- shipment_items / events / positions / documents / risks / messages
create policy items_read on shipment_items for select to authenticated using (
  is_hhl()
  or exists (select 1 from projects p where p.id = shipment_items.project_id
             and (current_org_kind() in ('CLIENT','SITE') or current_org_kind() = 'CARRIER'))
);
create policy items_write on shipment_items for all to authenticated
  using (is_hhl()) with check (is_hhl());

create policy events_read on load_events for select to authenticated using (
  exists (select 1 from loads l where l.id = load_events.load_id)
);
create policy events_insert on load_events for insert to authenticated with check (true);

create policy positions_read on positions for select to authenticated using (
  exists (select 1 from loads l where l.id = positions.load_id)
);

create policy geofences_read on geofences for select to authenticated using (true);
create policy geofences_write on geofences for all to authenticated
  using (current_app_role() = 'HHL_ADMIN') with check (current_app_role() = 'HHL_ADMIN');

create policy docs_read on documents for select to authenticated using (
  is_hhl() or current_org_kind() = any (documents.visible_to)
);
create policy docs_insert on documents for insert to authenticated with check (
  is_hhl() or current_org_kind() in ('CARRIER','CLIENT')
);

create policy risks_read on risk_signals for select to authenticated using (true);
create policy risks_write on risk_signals for all to authenticated
  using (is_hhl()) with check (is_hhl());

create policy msgs_read on load_messages for select to authenticated using (
  is_hhl() or current_org_kind() = any (load_messages.visible_to)
);
create policy msgs_insert on load_messages for insert to authenticated with check (true);

create policy wf_all on workflows for all to authenticated
  using (current_app_role() = 'HHL_ADMIN') with check (current_app_role() = 'HHL_ADMIN');

create policy invoices_read on invoices for select to authenticated using (
  is_hhl() or (current_org_kind() = 'CARRIER' and carrier_org_id = current_org_id())
);
create policy invoices_carrier on invoices for insert to authenticated with check (
  current_org_kind() = 'CARRIER' and carrier_org_id = current_org_id()
);
create policy invoices_hhl on invoices for update to authenticated
  using (is_hhl()) with check (is_hhl());

create policy users_self on app_users for select to authenticated using (
  auth_id = auth.uid() or is_hhl()
);
create policy orgs_read on organizations for select to authenticated using (true);
create policy projects_read on projects for select to authenticated using (true);
create policy audit_read on audit_log for select to authenticated using (
  current_app_role() = 'HHL_ADMIN'
);

-- ---------------------------------------------------------------------
-- 12. WIDOKI ROLOWE — jedyna droga do danych finansowych
--     security_invoker = true => RLS tabel bazowych obowiązuje
-- ---------------------------------------------------------------------

create view v_load_financials_hhl with (security_invoker = true) as
select
  l.id as load_id, l.order_no, l.status,
  c.currency as cost_currency, c.total_amount as cost_total, c.total_pln as cost_pln,
  r.currency as rev_currency,  r.total_amount as rev_total,  r.total_pln as rev_pln,
  (r.total_pln - c.total_pln) as margin_pln,
  case when coalesce(r.total_pln,0) = 0 then null
       else round((r.total_pln - c.total_pln) / r.total_pln * 100, 2) end as margin_pct
from loads l
left join load_cost    c on c.load_id = l.id
left join load_revenue r on r.load_id = l.id
where can_see_margin();

create view v_load_price_carrier with (security_invoker = true) as
select l.id as load_id, l.order_no,
       c.currency, c.base_amount, c.baf_pct, c.baf_amount,
       c.extras, c.extras_amount, c.total_amount
from loads l join load_cost c on c.load_id = l.id;

create view v_load_price_client with (security_invoker = true) as
select l.id as load_id, l.order_no,
       r.currency, r.base_amount, r.baf_pct, r.baf_amount,
       r.extras, r.extras_amount, r.total_amount
from loads l join load_revenue r on r.load_id = l.id;

grant select on v_load_financials_hhl, v_load_price_carrier, v_load_price_client
  to authenticated;

-- ---------------------------------------------------------------------
-- 13. RETENCJA DANYCH OSOBOWYCH (RODO)
--     Uruchamiane cronem. Dane kierowcy znikają po dostawie + N dni.
-- ---------------------------------------------------------------------

create or replace function purge_personal_data(p_days int default 90)
returns int language plpgsql as $$
declare n int;
begin
  update loads set driver_name = null, driver_phone = null
  where actual_delivery_at is not null
    and actual_delivery_at < now() - make_interval(days => p_days)
    and (driver_name is not null or driver_phone is not null);
  get diagnostics n = row_count;

  delete from positions
  where ts < now() - make_interval(days => p_days)
    and exists (select 1 from loads l where l.id = positions.load_id
                and l.actual_delivery_at is not null);
  return n;
end $$;
