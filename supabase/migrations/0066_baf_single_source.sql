-- =====================================================================
-- TOWER — Migracja 0066: I-14 — jedno źródło prawdy dopłaty paliwowej
--
--   Od 0052 parametry dopłaty są w sefs_parameters (wersje, applies_to od 0063), a odczyty indeksu
--   w fuel_index_readings. Tabele z 0001 — baf_definitions (inny wzór: udział paliwa × zmiana indeksu)
--   i baf_index_values — nigdy nie były używane (0 wierszy na produkcji 27.09.2026, brak odwołań
--   w aplikacji i funkcjach). Kolumna rate_cards.baf_id wskazywała baf_definitions (0 niepustych).
--   Usuwamy je, żeby nie było dwóch miejsc na parametry i dwóch na odczyty.
--   Strażnik: jeśli w którejkolwiek jest choć jeden wiersz (albo baf_id niepusty) — migracja przerywa
--   się błędem i niczego nie usuwa (dane trzeba najpierw przenieść do sefs_parameters/fuel_index_readings).
--   Idempotentna: IF EXISTS.
-- =====================================================================
do $$
declare n bigint := 0;
begin
  if to_regclass('public.baf_index_values') is not null then
    execute 'select count(*) from baf_index_values' into n;
    if n > 0 then raise exception 'I-14: baf_index_values ma % wierszy — przenieś do fuel_index_readings przed usunięciem', n; end if;
  end if;
  if to_regclass('public.baf_definitions') is not null then
    execute 'select count(*) from baf_definitions' into n;
    if n > 0 then raise exception 'I-14: baf_definitions ma % wierszy — przenieś do sefs_parameters przed usunięciem', n; end if;
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'rate_cards' and column_name = 'baf_id') then
    execute 'select count(*) from rate_cards where baf_id is not null' into n;
    if n > 0 then raise exception 'I-14: % cenników wskazuje baf_definitions — najpierw usuń powiązanie', n; end if;
  end if;
end $$;

alter table rate_cards drop column if exists baf_id;
drop table if exists baf_index_values;
drop table if exists baf_definitions;

comment on table sefs_parameters is 'Jedyne źródło parametrów dopłaty paliwowej (SEFS hybrid_min, wersje; I-14/0066).';
comment on table fuel_index_readings is 'Jedyne źródło odczytów indeksu paliwa (OKQ8 SEK/l, ORLEN PLN/l; I-14/0066).';
