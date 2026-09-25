-- =====================================================================
-- TOWER — Migracja 0011: kurs NBP na żywo + migawka przy rozładunku (M3)
--
-- Reguła W3 (MECHANIZM_PIENIEDZY §3), bez zmian:
--   1. dzień rozładunku = data LOKALNA (Europe/Warsaw), nigdy UTC
--   2. pobierz tabele A dla EUR z przedziału [dzień − 14, dzień − 1]
--   3. weź ostatnią z datą ŚCIŚLE WCZEŚNIEJSZĄ niż dzień rozładunku
--   4. brak tabeli → błąd, nigdy zgadywanie
-- Zapytanie o pojedynczy dzień bez publikacji zwraca 404 — zawsze przedział.
--
-- Pobieranie: rozszerzenie `http` (synchroniczne, w bazie) wywoływane z pg_cron
-- — bez funkcji Edge i bez sekretów (API NBP jest publiczne, bez klucza).
-- Na czystym Postgresie (tests/db) bez `http`: pobieranie pomijane z komunikatem,
-- parser `fx_ingest_nbp(jsonb)` i migawka działają i są testowane.
--
-- Migawka: ustawienie `loads.actual_delivery_at` → kurs i data opłaty paliwowej
-- zapisane na load_cost / load_revenue (poziom REALIZACJA), o ile strona nie jest
-- zafakturowana (Z1). Zmiana planu nie rusza migawki; nowe tabele w fx_rates też nie.
--
-- IDEMPOTENTNA, niedestrukcyjna.
-- =====================================================================

do $ext$
begin
  if exists (select 1 from pg_available_extensions where name = 'http') then
    create extension if not exists http with schema extensions;
  else
    raise notice 'rozszerzenie http niedostępne — pobieranie NBP pominięte (środowisko testowe)';
  end if;
end $ext$;

-- 1. fx_rates: odczyt dla zalogowanych (dane publiczne), zapis wyłącznie funkcjami systemowymi
alter table fx_rates enable row level security;
drop policy if exists fx_rates_read on fx_rates;
create policy fx_rates_read on fx_rates for select to authenticated using (true);
revoke insert, update, delete, truncate on fx_rates from anon, authenticated;
revoke all on fx_rates from anon;
grant select on fx_rates to authenticated;

-- 2. Parser odpowiedzi API NBP (tabela A, EUR) → fx_rates. Zwraca liczbę tabel.
create or replace function fx_ingest_nbp(p_json jsonb, p_source text default null)
returns int language plpgsql security definer set search_path = public as $$
declare n int := 0; r jsonb;
begin
  if p_json is null or jsonb_typeof(p_json -> 'rates') <> 'array' then return 0; end if;
  if coalesce(p_json ->> 'code', 'EUR') <> 'EUR' then
    raise exception 'fx_ingest_nbp: oczekiwano EUR, jest %', p_json ->> 'code';
  end if;
  for r in select * from jsonb_array_elements(p_json -> 'rates') loop
    insert into fx_rates (currency, rate_date, rate_pln, table_no, source_url, fetched_at)
    values ('EUR', (r ->> 'effectiveDate')::date, (r ->> 'mid')::numeric, r ->> 'no', p_source, now())
    on conflict (currency, rate_date) do update
      set rate_pln = excluded.rate_pln, table_no = excluded.table_no,
          source_url = coalesce(excluded.source_url, fx_rates.source_url), fetched_at = now();
    n := n + 1;
  end loop;
  return n;
end $$;

-- 3. Reguła W3: ostatnia tabela ŚCIŚLE przed dniem lokalnym. Brak → błąd.
create or replace function fx_rate_before(p_local_date date, p_currency char(3) default 'EUR')
returns table (table_no text, rate_date date, rate_pln numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  return query
    select f.table_no, f.rate_date, f.rate_pln from fx_rates f
    where f.currency = p_currency and f.rate_date < p_local_date
      and f.rate_date >= p_local_date - 14
    order by f.rate_date desc limit 1;
  if not found then
    raise exception 'Brak tabeli A NBP przed % (przedział [dzień − 14, dzień − 1]) — nie zgaduj kursu', p_local_date;
  end if;
end $$;

-- 4. Pobranie przedziału [dzień − 14, dzień − 1] z API NBP (http w bazie).
create or replace function fx_sync_nbp(p_day date default ((now() at time zone 'Europe/Warsaw')::date + 1))
returns int language plpgsql security definer set search_path = public, extensions as $$
declare
  v_url text := format('https://api.nbp.pl/api/exchangerates/rates/a/eur/%s/%s/?format=json', p_day - 14, p_day - 1);
  v_status int; v_body text;
begin
  if not exists (select 1 from pg_extension where extname = 'http') then
    raise notice 'fx_sync_nbp: brak rozszerzenia http'; return 0;
  end if;
  execute 'select status, content from extensions.http_get($1)' into v_status, v_body using v_url;
  if v_status = 404 then return 0; end if;           -- brak publikacji w przedziale
  if v_status <> 200 then raise exception 'NBP % dla %', v_status, v_url; end if;
  return fx_ingest_nbp(v_body::jsonb, v_url);
end $$;

-- 5. Migawka kursu i daty opłaty paliwowej dla transportu (rozładunek)
create or replace function fx_snapshot_load(p_load uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_at timestamptz; v_day date; v_rate record;
begin
  select actual_delivery_at into v_at from loads where id = p_load;
  if v_at is null then return false; end if;
  v_day := (v_at at time zone 'Europe/Warsaw')::date;           -- Z2: dzień lokalny
  begin
    select * into v_rate from fx_rate_before(v_day);
  exception when others then
    -- brak tabeli: migawka czeka (prowizoryczna), uzupełni fx_apply_pending() po pobraniu
    update load_cost set pricing_tier = 'REALIZACJA', fuel_ref_date = v_day, fx_provisional = true
      where load_id = p_load and invoiced_total_eur is null;
    update load_revenue set pricing_tier = 'REALIZACJA', fuel_ref_date = v_day, fx_provisional = true
      where load_id = p_load and invoiced_total_eur is null;
    return false;
  end;
  update load_cost set pricing_tier = 'REALIZACJA', fuel_ref_date = v_day,
         fx_table_no = v_rate.table_no, fx_effective_date = v_rate.rate_date, fx_rate_pln = v_rate.rate_pln,
         fx_date = v_rate.rate_date, fx_provisional = false
    where load_id = p_load and invoiced_total_eur is null;
  update load_revenue set pricing_tier = 'REALIZACJA', fuel_ref_date = v_day,
         fx_table_no = v_rate.table_no, fx_effective_date = v_rate.rate_date, fx_rate_pln = v_rate.rate_pln,
         fx_date = v_rate.rate_date, fx_provisional = false
    where load_id = p_load and invoiced_total_eur is null;
  return true;
end $$;

create or replace function trg_fx_snapshot_on_unload() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.actual_delivery_at is not null
     and new.actual_delivery_at is distinct from old.actual_delivery_at then
    perform fx_snapshot_load(new.id);
  end if;
  return null;
end $$;

drop trigger if exists trg_loads_fx_snapshot on loads;
create trigger trg_loads_fx_snapshot after update of actual_delivery_at on loads
  for each row execute function trg_fx_snapshot_on_unload();

-- 6. Uzupełnienie migawek czekających na tabelę (po pobraniu kursów)
create or replace function fx_apply_pending() returns int
language plpgsql security definer set search_path = public as $$
declare n int := 0; l record;
begin
  for l in
    select distinct x.load_id from (
      select load_id from load_cost where fx_provisional and pricing_tier = 'REALIZACJA' and invoiced_total_eur is null
      union
      select load_id from load_revenue where fx_provisional and pricing_tier = 'REALIZACJA' and invoiced_total_eur is null
    ) x
  loop
    if fx_snapshot_load(l.load_id) then n := n + 1; end if;
  end loop;
  return n;
end $$;

-- Uprawnienia: pobieranie, parser i migawki — tylko system (cron / właściciel).
revoke all on function fx_ingest_nbp(jsonb, text) from public, anon, authenticated;
revoke all on function fx_sync_nbp(date) from public, anon, authenticated;
revoke all on function fx_snapshot_load(uuid) from public, anon, authenticated;
revoke all on function fx_apply_pending() from public, anon, authenticated;
revoke all on function trg_fx_snapshot_on_unload() from public, anon, authenticated;
revoke all on function fx_rate_before(date, char) from public, anon;
grant execute on function fx_rate_before(date, char) to authenticated;

-- 7. Harmonogram: codziennie po publikacji tabeli (NBP ~11:45–12:15 czasu PL; cron w UTC)
do $cron$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('tower-kurs-nbp', '30 10,14 * * *',
      'select fx_sync_nbp(); select fx_apply_pending();');
  else
    raise notice 'pg_cron niedostępny — tower-kurs-nbp do zaplanowania ręcznie (środowisko testowe)';
  end if;
end $cron$;
