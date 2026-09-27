-- 0053 — I-2j: pozycje promów z AIS (zadanie ferry-ais, Digitraffic) zapisywane w bazie, żeby mapa w produkcji
-- pokazywała pozycję z bazy z czasem odczytu (albo „brak źródła danych”), a nie pozycje przykładowe.
-- Idempotentna, niedestrukcyjna: nowa tabela, polityka odczytu, retencja 30 dni (pg_cron).
-- Zapis wyłącznie zadanie ferry-ais (klucz serwisowy po stronie Supabase); rola API nie ma INSERT/UPDATE/DELETE.
-- Dane publiczne (AIS, licencja CC BY 4.0 — atrybucja w interfejsie), nie osobowe → w kopii zapasowej (katalog).
create table if not exists public.vessel_positions (
  id          bigint generated always as identity primary key,
  vessel_id   uuid not null references public.vessels(id),
  lat         double precision not null check (lat between -90 and 90),
  lon         double precision not null check (lon between -180 and 180),
  sog_kn      real,
  cog         real,
  nav_stat    smallint,
  observed_at timestamptz not null,               -- czas sygnału AIS (timestampExternal)
  fetched_at  timestamptz not null default now(), -- czas odczytu przez zadanie
  source      text not null default 'DIGITRAFFIC' check (source in ('DIGITRAFFIC')),
  unique (vessel_id, observed_at)
);
comment on table public.vessel_positions is
  'I-2j: pozycje promów z AIS (ferry-ais → Digitraffic, CC BY 4.0). Zapis tylko zadanie serwisowe; odczyt — aktywne konto; retencja 30 dni.';
create index if not exists vessel_positions_latest_idx on public.vessel_positions (vessel_id, observed_at desc);

alter table public.vessel_positions enable row level security;
revoke all on table public.vessel_positions from anon, authenticated;
grant select on table public.vessel_positions to authenticated;
drop policy if exists vessel_positions_read on public.vessel_positions;
create policy vessel_positions_read on public.vessel_positions for select to authenticated
  using (current_app_role() is not null);

create or replace function public.purge_vessel_positions(p_now timestamptz default now())
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  -- ostatnia pozycja każdego statku zostaje zawsze (mapa pokazuje ją z czasem odczytu)
  with keep as (
    select distinct on (vessel_id) id from vessel_positions order by vessel_id, observed_at desc, id desc
  )
  delete from vessel_positions p
   where p.observed_at < p_now - interval '30 days'
     and p.id not in (select id from keep);
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.purge_vessel_positions(timestamptz) from public, anon, authenticated;

do $cron$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'tower-retencja-pozycji-promow';
    perform cron.schedule('tower-retencja-pozycji-promow', '55 2 * * *', 'select public.purge_vessel_positions()');
  else
    raise notice 'pg_cron niedostępny — tower-retencja-pozycji-promow do zaplanowania ręcznie (środowisko testowe)';
  end if;
end $cron$;
