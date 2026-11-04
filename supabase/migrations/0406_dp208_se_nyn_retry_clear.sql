-- DP-208 (#788): po nowej kontroli SE-NYN (via ≤1 km, len ±10%, max 35 km od SE_E4)
-- wyczyść retry_after, żeby cron here-roads spróbował od razu (zamiast czekać 24 h).
select set_config('tower.audit_source', 'migracja 0406 (DP-208 SE-NYN retry_after)', true);

update public.here_road_geometry
   set retry_after = null
 where leg = 'SE-NYN'
   and retry_after is not null;
