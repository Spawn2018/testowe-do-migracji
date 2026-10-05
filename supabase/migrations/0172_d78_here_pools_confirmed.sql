-- 0172 — D-78: potwierdzone pule HERE (konto właściciela, 05.10).
-- NIE zmienia 0170. Wartości bez zmiany (30000 / 5000); opis i źródło bez „wstępna”.
-- Idempotentna.

update app_parameters
   set value = 30000,
       label = 'Darmowa pula Advanced Raster Tile HERE / miesiąc (Europe/Warsaw)',
       source = 'konto HERE właściciela, 05.10',
       updated_at = now()
 where key = 'HERE_TILES_FREE';

update app_parameters
   set value = 5000,
       label = 'Darmowa pula Routing Truck HERE / miesiąc (Europe/Warsaw)',
       source = 'konto HERE właściciela, 05.10',
       updated_at = now()
 where key = 'HERE_ROUTES_FREE';

-- Gdyby wierszy brakowało (świeża baza po częściowym restore) — wstaw.
insert into app_parameters (key, value, label, source) values
  ('HERE_TILES_FREE', 30000, 'Darmowa pula Advanced Raster Tile HERE / miesiąc (Europe/Warsaw)', 'konto HERE właściciela, 05.10'),
  ('HERE_ROUTES_FREE', 5000, 'Darmowa pula Routing Truck HERE / miesiąc (Europe/Warsaw)', 'konto HERE właściciela, 05.10')
on conflict (key) do update
  set value = excluded.value,
      label = excluded.label,
      source = excluded.source,
      updated_at = now();
