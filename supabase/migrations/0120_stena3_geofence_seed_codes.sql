-- 0120 — STENA-3: strefy także dla projektu seed testowego (`STEGRA`).
-- 0119 wstawiało tylko przy code=STEGRA_BODEN (seed produkcji). Idempotentna.

insert into public.geofences (project_id, name, kind, geom, hysteresis_m, dwell_seconds, debounce_fixes, notify_enter, country)
select p.id, z.name, z.kind::geofence_kind, make_circle_fence(z.lat, z.lon, z.r),
       z.hyst, z.dwell, 2, true, z.country
  from projects p,
       (values
         ('Bufor 20 km przed Gdynia',      'PRE_PORT', 54.53321, 18.54425, 20000, 500, 0, 'PL'),
         ('Terminal Stena Line Gdynia',    'PORT_OUT', 54.53321, 18.54425,   800, 200, 900, 'PL'),
         ('Terminal Stena Line Karlskrona','PORT_IN',  56.16460, 15.63080,   800, 200, 600, 'SE')
       ) as z(name, kind, lat, lon, r, hyst, dwell, country)
 where p.code in ('STEGRA_BODEN', 'STEGRA')
   and not exists (select 1 from geofences g where g.project_id = p.id and g.name = z.name);
