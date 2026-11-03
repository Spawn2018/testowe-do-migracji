-- BN7 (#718): włącz cron_fetch dla 7 legów bałtyckich.
-- Front BN9-c5 (#740) i DP-171/172 na produkcji — kolejność §5: filtr tras przed pobieraniem.
-- Pierwsze punkty: cron tower-here-roads ~04:15 UTC (bez wymuszenia, DP-70).

update public.here_road_legs
   set cron_fetch = true
 where map_group = 'bn7'
   and active is true
   and cron_fetch is not true;

comment on column public.here_road_legs.cron_fetch is
  'BN7/#718: true = cron tower-here-roads pobiera leg (core + 7× bn7). Default kolumny false.';
