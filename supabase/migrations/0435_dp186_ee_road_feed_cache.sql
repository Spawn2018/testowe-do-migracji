-- DP-186 (C5 / F7 #753): EE RESTRICTIONS/SAFETY — ostatnia dobra lista w bazie
-- (pamięć procesu Edge ginie przy cold start → ee_*_source=cache niewidoczne).
-- Zapis/odczyt tylko service_role (job road-ee); bez UI.

begin;

create table if not exists public.ee_road_feed_cache (
  feed_code  text primary key
               check (feed_code in ('RESTRICTIONS', 'SAFETY')),
  events     jsonb not null default '[]'::jsonb,
  n_events   int not null default 0
               check (n_events >= 0),
  fetched_at timestamptz not null
);

comment on table public.ee_road_feed_cache is
  'DP-186: ostatnia dobra kopia EE DATEX RESTRICTIONS/SAFETY (job road-ee; cold start).';

alter table public.ee_road_feed_cache enable row level security;
revoke all on public.ee_road_feed_cache from public, anon, authenticated;
grant select, insert, update, delete on public.ee_road_feed_cache to service_role;

commit;
