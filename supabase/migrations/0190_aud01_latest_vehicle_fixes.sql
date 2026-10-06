-- =====================================================================
-- TOWER — Migracja 0190: AUD-01 (audyt 06.10, A1) — ostatnia pozycja GPS wielu transportów jednym zapytaniem
--   latest_vehicle_fixes(p_loads uuid[]): dla podanych transportów zwraca wyłącznie te, które mają pozycję GPS
--   (ostatni punkt: przyciągnięty do drogi, a bez niego surowy). Zastępuje N × load_track(id, 1) z Mapy/kokpitu/panelu
--   (dziś 2 × 94 wywołania przy otwarciu Mapy). Security invoker: widoczność = RLS `positions_read` — jak load_track.
--   Maks. 500 identyfikatorów (reszta pomijana); anon bez EXECUTE. Indeks positions(load_id, ts desc) z 0001. Idempotentna.
-- =====================================================================
create or replace function latest_vehicle_fixes(p_loads uuid[])
returns table (load_id uuid, ts timestamptz, lat double precision, lng double precision)
language sql stable security invoker set search_path = public, extensions as $$
  select l.id, f.ts, f.lat, f.lng
    from (select distinct u.id from unnest(coalesce(p_loads, '{}'::uuid[])) with ordinality u(id, n)
           where u.n <= 500 and u.id is not null) l
    cross join lateral (
      select p.ts, st_y(coalesce(p.geom_snapped, p.geom_raw)) as lat, st_x(coalesce(p.geom_snapped, p.geom_raw)) as lng
        from positions p
       where p.load_id = l.id
       order by p.ts desc
       limit 1) f
$$;
revoke all on function latest_vehicle_fixes(uuid[]) from public, anon;
grant execute on function latest_vehicle_fixes(uuid[]) to authenticated;
