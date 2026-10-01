-- 0119 — STENA-3 (§3): słowniki Stena Line Gdynia–Karlskrona + strefy terminali.
-- Trasy GDY-KAA / KAA-GDY obok GDN-NYN. Statki: MMSI/IMO z rejestrów (VesselFinder /
-- MarineTraffic, 01.10.2026) — Spirit / Estelle / Ebba. Współrzędne terminali z
-- stron Stena Line (orientacyjne, do potwierdzenia mapą).
-- Rozkład automatyczny / AIS / ETA / komunikaty = II-5, II-7, II-8, II-9 (osobne pozycje).
-- Idempotentna.

-- 1) Trasy rejsów: + Gdynia↔Karlskrona
do $$
declare
  c name;
begin
  select con.conname into c
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace n on n.oid = rel.relnamespace
   where n.nspname = 'public' and rel.relname = 'sailings'
     and con.contype = 'c'
     and pg_get_constraintdef(con.oid) ilike '%GDN-NYN%';
  if c is not null then
    execute format('alter table public.sailings drop constraint %I', c);
  end if;
end $$;

alter table public.sailings
  add constraint sailings_route_check
  check (route in ('GDN-NYN', 'NYN-GDN', 'GDY-KAA', 'KAA-GDY'));

-- źródło: + STENA (rozklad/komunikaty II-5)
do $$
declare c name;
begin
  select con.conname into c
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace n on n.oid = rel.relnamespace
   where n.nspname = 'public' and rel.relname = 'sailings'
     and con.contype = 'c'
     and pg_get_constraintdef(con.oid) ilike '%POLFERRIES%'
     and pg_get_constraintdef(con.oid) ilike '%source%';
  if c is not null then
    execute format('alter table public.sailings drop constraint %I', c);
  end if;
end $$;
alter table public.sailings
  add constraint sailings_source_check
  check (source in ('DANE_STARTOWE', 'RECZNIE', 'POLFERRIES', 'STENA'));

-- 2) Statki Stena Line
insert into public.vessels (name, operator, mmsi, imo) values
  ('M/F Stena Spirit',  'Stena Line', 311058100, 7907661),
  ('M/F Stena Estelle', 'Stena Line', 219030885, 9862994),
  ('M/F Stena Ebba',    'Stena Line', 219031310, 9863003)
on conflict (name) do update
  set operator = excluded.operator,
      mmsi = coalesce(excluded.mmsi, vessels.mmsi),
      imo = coalesce(excluded.imo, vessels.imo);

-- 3) Strefy terminali (projekt STEGRA_BODEN) + bufor przed Gdynią
insert into public.geofences (project_id, name, kind, geom, hysteresis_m, dwell_seconds, debounce_fixes, notify_enter, country)
select p.id, z.name, z.kind::geofence_kind, make_circle_fence(z.lat, z.lon, z.r),
       z.hyst, z.dwell, 2, true, z.country
  from projects p,
       (values
         ('Bufor 20 km przed Gdynia',     'PRE_PORT', 54.53321, 18.54425, 20000, 500, 0, 'PL'),
         ('Terminal Stena Line Gdynia',   'PORT_OUT', 54.53321, 18.54425,   800, 200, 900, 'PL'),
         ('Terminal Stena Line Karlskrona','PORT_IN', 56.16460, 15.63080,   800, 200, 600, 'SE')
       ) as z(name, kind, lat, lon, r, hyst, dwell, country)
 where p.code = 'STEGRA_BODEN'
   and not exists (select 1 from geofences g where g.project_id = p.id and g.name = z.name);

-- 4) Parametr: czas Śrem→Gdynia + odprawa (orientacyjnie; ETA = II-7)
insert into public.app_parameters (key, value, label, source) values
  ('STENA_PORT_CLEARANCE_H', 16,
   'Śrem → Gdynia + odprawa (h) — orientacyjnie do II-7',
   'STENA-3 §3 (01.10.2026)')
on conflict (key) do nothing;
