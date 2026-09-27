-- =====================================================================
-- TOWER — Migracja 0052: I-2f — prawdziwy formularz BAF/SEFS dla HHL (zamiast fasady F2.4)
--
--   Mechanizm projektu: SEFS hybrid_min — mnożnik = min(mnożnik z tabeli SEK, mnożnik z tabeli PLN)
--   dla ceny indeksu OKQ8 (SEK/l) i ORLEN (PLN/l). Tabela baf_definitions (0001) opisuje inny wzór
--   i zostaje nieużywana. Od 0052:
--     • sefs_parameters — wersjonowane parametry (bazy SEK/PLN, indeksy, adresy źródeł, cykl, tablice
--       mnożników, uzgodnienie z przewoźnikiem); każda zmiana = nowa wersja (nigdy UPDATE/DELETE);
--     • fuel_index_readings — odczyty indeksu (okres, data odczytu, wartość, WYMAGANY adres źródła);
--       korekta = nowy wiersz wskazujący poprawiany (z powodem), nigdy nadpisanie;
--     • dziennik zmian — audit_log (SEFS_PARAMS_VERSION, FUEL_READING_ADD, FUEL_READING_CORRECT)
--       + baf_change_log() dla HHL;
--     • zapis wyłącznie przez RPC dla HHL (strażnik „is not true”); odczyt tabel: HHL (RLS).
--   Wartości wpisuje właściciel po uzgodnieniu z przewoźnikiem — migracja NIE wstawia żadnych liczb.
--   Idempotentna i niedestrukcyjna: IF NOT EXISTS, CREATE OR REPLACE, DROP POLICY/TRIGGER IF EXISTS + CREATE.
-- =====================================================================

create table if not exists sefs_parameters (
  id                  bigserial primary key,
  project_id          uuid not null references projects(id),
  version             int  not null,
  valid_from          date not null,
  rule                text not null default 'hybrid_min' check (rule in ('hybrid_min')),
  base_sek            numeric(10,4) not null check (base_sek > 0),
  base_pln            numeric(10,4) not null check (base_pln > 0),
  index_sek           text not null check (length(trim(index_sek)) > 0),
  index_pln           text not null check (length(trim(index_pln)) > 0),
  source_url_sek      text not null check (source_url_sek ~ '^https?://'),
  source_url_pln      text not null check (source_url_pln ~ '^https?://'),
  cycle               text not null default 'MONTHLY' check (cycle in ('WEEKLY','MONTHLY')),
  tiers_sek           jsonb not null,
  tiers_pln           jsonb not null,
  agreed_with_carrier boolean not null default false,
  agreement_ref       text,
  note                text,
  created_by          uuid references app_users(id),
  created_at          timestamptz not null default now(),
  unique (project_id, version)
);

create table if not exists fuel_index_readings (
  id                bigserial primary key,
  project_id        uuid not null references projects(id),
  index_code        text not null check (index_code in ('SEK','PLN')),
  period            text not null check (period ~ '^[0-9]{4}-(0[1-9]|1[0-2]|W(0[1-9]|[1-4][0-9]|5[0-3]))$'),
  reading_date      date not null,
  value             numeric(10,4) not null check (value > 0 and value < 1000),
  source_url        text not null check (source_url ~ '^https?://'),
  source_note       text,
  corrects_id       bigint references fuel_index_readings(id),
  correction_reason text,
  entered_by        uuid references app_users(id),
  entered_at        timestamptz not null default now(),
  check ((corrects_id is null) = (correction_reason is null))
);
create index if not exists fuel_index_readings_period_idx on fuel_index_readings (project_id, index_code, period);
create unique index if not exists fuel_index_readings_one_correction on fuel_index_readings (corrects_id) where corrects_id is not null;

-- tylko dopisywanie
create or replace function forbid_baf_mutation() returns trigger
language plpgsql as $$
begin raise exception '% jest append-only — zmiana = nowa wersja / korekta', tg_table_name; end $$;
drop trigger if exists trg_sefs_parameters_immutable on sefs_parameters;
create trigger trg_sefs_parameters_immutable before update or delete on sefs_parameters
  for each row execute function forbid_baf_mutation();
drop trigger if exists trg_fuel_readings_immutable on fuel_index_readings;
create trigger trg_fuel_readings_immutable before update or delete on fuel_index_readings
  for each row execute function forbid_baf_mutation();
revoke execute on function forbid_baf_mutation() from public, anon, authenticated;

alter table sefs_parameters enable row level security;
alter table fuel_index_readings enable row level security;
revoke insert, update, delete, truncate on sefs_parameters, fuel_index_readings from anon, authenticated;
revoke all on sefs_parameters, fuel_index_readings from anon;
grant select on sefs_parameters, fuel_index_readings to authenticated;
drop policy if exists sefs_parameters_read on sefs_parameters;
create policy sefs_parameters_read on sefs_parameters for select to authenticated using (is_hhl());
drop policy if exists fuel_index_readings_read on fuel_index_readings;
create policy fuel_index_readings_read on fuel_index_readings for select to authenticated using (is_hhl());

-- walidacja tablicy mnożników: [{lte, mult}], lte rosnąco, 1…200 progów, mnożnik 0,5–2
create or replace function sefs_tiers_valid(p jsonb) returns boolean
language sql immutable set search_path = public as $$
  select jsonb_typeof(p) = 'array' and jsonb_array_length(p) between 1 and 200
     and not exists (
       select 1 from jsonb_array_elements(p) with ordinality e(v, i)
        where jsonb_typeof(v->'lte') <> 'number' or jsonb_typeof(v->'mult') <> 'number'
           or (v->>'lte')::numeric <= 0 or (v->>'mult')::numeric not between 0.5 and 2
           or (i > 1 and (v->>'lte')::numeric <= (p->(i::int - 2)->>'lte')::numeric))
$$;
revoke execute on function sefs_tiers_valid(jsonb) from public, anon, authenticated;

create or replace function sefs_save_parameters(p_project uuid, p jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare v_ver int; v_me uuid;
begin
  if (is_hhl()) is not true then
    raise exception 'Parametry SEFS zapisuje wyłącznie HHL';
  end if;
  if (sefs_tiers_valid(p->'tiers_sek') and sefs_tiers_valid(p->'tiers_pln')) is not true then
    raise exception 'Tablice mnożników: 1–200 progów {lte, mult}, lte rosnąco, mnożnik 0,5–2';
  end if;
  select id into v_me from app_users where auth_id = auth.uid() and active;
  perform pg_advisory_xact_lock(hashtext('sefs_parameters:' || p_project::text));
  select coalesce(max(version), 0) + 1 into v_ver from sefs_parameters where project_id = p_project;
  insert into sefs_parameters (project_id, version, valid_from, base_sek, base_pln, index_sek, index_pln,
                               source_url_sek, source_url_pln, cycle, tiers_sek, tiers_pln,
                               agreed_with_carrier, agreement_ref, note, created_by)
  values (p_project, v_ver, (p->>'valid_from')::date, (p->>'base_sek')::numeric, (p->>'base_pln')::numeric,
          p->>'index_sek', p->>'index_pln', p->>'source_url_sek', p->>'source_url_pln',
          coalesce(p->>'cycle', 'MONTHLY'), p->'tiers_sek', p->'tiers_pln',
          coalesce((p->>'agreed_with_carrier')::boolean, false), nullif(trim(p->>'agreement_ref'), ''),
          nullif(trim(p->>'note'), ''), v_me);
  insert into audit_log (user_id, action, entity, entity_id, old_value, new_value)
  values (v_me, 'SEFS_PARAMS_VERSION', 'sefs_parameters', p_project::text || ':v' || v_ver,
          (select to_jsonb(x) - 'id' - 'created_at' - 'created_by' from sefs_parameters x
            where project_id = p_project and version = v_ver - 1),
          (select to_jsonb(x) - 'id' - 'created_at' - 'created_by' from sefs_parameters x
            where project_id = p_project and version = v_ver));
  return v_ver;
end $$;

create or replace function fuel_add_reading(
  p_project uuid, p_index text, p_period text, p_reading_date date, p_value numeric,
  p_source_url text, p_note text default null, p_corrects bigint default null, p_reason text default null
) returns bigint
language plpgsql security definer set search_path = public as $$
declare v_id bigint; v_me uuid; v_old fuel_index_readings;
begin
  if (is_hhl()) is not true then
    raise exception 'Odczyty indeksu paliwa wpisuje wyłącznie HHL';
  end if;
  if (p_source_url ~ '^https?://') is not true then
    raise exception 'Odczyt bez adresu źródła (http/https) jest niedozwolony — to dowód przy sporze';
  end if;
  if (p_reading_date <= current_date) is not true then
    raise exception 'Data odczytu nie może być z przyszłości';
  end if;
  if p_corrects is not null then
    select * into v_old from fuel_index_readings where id = p_corrects and project_id = p_project;
    if (found and v_old.index_code = p_index and v_old.period = p_period) is not true then
      raise exception 'Korekta musi wskazywać odczyt tego samego indeksu i okresu';
    end if;
    if (length(trim(coalesce(p_reason, ''))) >= 3) is not true then
      raise exception 'Korekta wymaga powodu';
    end if;
  elsif exists (select 1 from fuel_index_readings r where r.project_id = p_project and r.index_code = p_index
                  and r.period = p_period and not exists (select 1 from fuel_index_readings c where c.corrects_id = r.id)) then
    raise exception 'Odczyt % za % już istnieje — popraw go korektą z powodem', p_index, p_period;
  end if;
  select id into v_me from app_users where auth_id = auth.uid() and active;
  insert into fuel_index_readings (project_id, index_code, period, reading_date, value, source_url, source_note,
                                   corrects_id, correction_reason, entered_by)
  values (p_project, p_index, p_period, p_reading_date, p_value, p_source_url, nullif(trim(p_note), ''),
          p_corrects, case when p_corrects is null then null else trim(p_reason) end, v_me)
  returning id into v_id;
  insert into audit_log (user_id, action, entity, entity_id, old_value, new_value)
  values (v_me, case when p_corrects is null then 'FUEL_READING_ADD' else 'FUEL_READING_CORRECT' end,
          'fuel_index_readings', v_id::text,
          case when p_corrects is null then null else to_jsonb(v_old) - 'entered_by' end,
          (select to_jsonb(r) - 'entered_by' from fuel_index_readings r where r.id = v_id));
  return v_id;
end $$;

-- Dziennik zmian BAF/SEFS (audit_log jest niedostępny dla ról API — odczyt przez tę funkcję, tylko HHL)
create or replace function baf_change_log(p_project uuid, p_limit int default 100)
returns table (at timestamptz, actor text, action text, entity_id text, old_value jsonb, new_value jsonb)
language plpgsql stable security definer set search_path = public as $$
begin
  if (is_hhl()) is not true then
    raise exception 'Dziennik zmian SEFS widzi wyłącznie HHL';
  end if;
  return query
    select a.created_at, coalesce(u.email::text, 'system'), a.action, a.entity_id, a.old_value, a.new_value
      from audit_log a left join app_users u on u.id = a.user_id
     where a.action in ('SEFS_PARAMS_VERSION','FUEL_READING_ADD','FUEL_READING_CORRECT')
       and (a.entity_id like p_project::text || ':%'
            or exists (select 1 from fuel_index_readings r where r.id::text = a.entity_id and r.project_id = p_project))
     order by a.created_at desc, a.id desc
     limit least(greatest(coalesce(p_limit, 100), 1), 500);
end $$;

revoke execute on function sefs_save_parameters(uuid, jsonb) from public, anon;
revoke execute on function fuel_add_reading(uuid, text, text, date, numeric, text, text, bigint, text) from public, anon;
revoke execute on function baf_change_log(uuid, int) from public, anon;
grant execute on function sefs_save_parameters(uuid, jsonb) to authenticated;
grant execute on function fuel_add_reading(uuid, text, text, date, numeric, text, text, bigint, text) to authenticated;
grant execute on function baf_change_log(uuid, int) to authenticated;
