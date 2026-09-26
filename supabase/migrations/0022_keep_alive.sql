-- =====================================================================
-- TOWER — Migracja 0022: ANEKS 4 PR1 — podtrzymanie darmowego projektu (usypianie po 7 dniach)
--   system_heartbeat: jeden wiersz, znacznik zapisywany przez keep_alive().
--   keep_alive() wywołuje Cloudflare Worker (workers/keep-alive, cron co 6 h) przez API bazy —
--   prawdziwy zapis, nie ping adresu; NIE przez pg_cron (zadania w bazie mogą nie liczyć się
--   jako aktywność użytkowników). Zapis najwyżej raz na 60 s (ochrona przed zasypaniem).
--   Idempotentna, niedestrukcyjna.
-- =====================================================================

create table if not exists system_heartbeat (
  id       smallint primary key default 1 check (id = 1),
  beat_at  timestamptz not null default now(),
  source   text not null default 'init',
  beats    bigint not null default 0
);
alter table system_heartbeat enable row level security;
revoke all on system_heartbeat from anon, authenticated;
insert into system_heartbeat (id) values (1) on conflict (id) do nothing;

create or replace function keep_alive(p_source text default 'worker') returns jsonb
language plpgsql security definer set search_path = public as $$
declare h system_heartbeat%rowtype;
begin
  update system_heartbeat
     set beat_at = now(), source = left(coalesce(p_source, 'worker'), 40), beats = beats + 1
   where id = 1 and beat_at <= now() - interval '60 seconds';
  select * into h from system_heartbeat where id = 1;
  return jsonb_build_object('ok', true, 'beat_at', h.beat_at, 'beats', h.beats, 'db_now', now());
end $$;
revoke execute on function keep_alive(text) from public;
grant execute on function keep_alive(text) to anon, authenticated;
