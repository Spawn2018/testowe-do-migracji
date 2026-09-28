-- =====================================================================
-- TOWER — Migracja 0088: III-5 (SCOPE 5.13) odtwarzanie przebiegu w czasie
--   load_track(p_load, p_limit): pozycje GPS transportu w kolejności czasu (punkt po przyciągnięciu do drogi, a bez
--   niego surowy), prędkość i źródło — do odtwarzania na mapie. Security invoker: widoczność = RLS `positions_read`
--   (strony widzące transport); anon bez EXECUTE. Limit 1–5000 punktów (domyślnie 5000; PR5: 4 doby ≈ 1424).
--   Retencja GPS bez zmian (I-7: 30 dni po rozładunku). Idempotentna.
-- =====================================================================
create or replace function load_track(p_load uuid, p_limit int default 5000)
returns table (ts timestamptz, lat double precision, lng double precision, speed_kmh numeric, source text)
language sql stable security invoker set search_path = public, extensions as $$
  select t.ts, t.lat, t.lng, t.speed_kmh, t.source
    from (select p.ts, st_y(coalesce(p.geom_snapped, p.geom_raw)) as lat, st_x(coalesce(p.geom_snapped, p.geom_raw)) as lng,
                 p.speed_kmh, p.source::text as source
            from positions p
           where p.load_id = p_load
           order by p.ts desc
           limit least(greatest(coalesce(p_limit, 5000), 1), 5000)) t
   order by t.ts
$$;
revoke all on function load_track(uuid, int) from public, anon;
grant execute on function load_track(uuid, int) to authenticated;
