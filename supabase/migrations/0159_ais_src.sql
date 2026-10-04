-- 0159 — AIS-SRC: źródło pozycji (DIGITRAFFIC / AISSTREAM / STENA), ETA ze Steny, MMSI Spirit.
-- MMSI Stena Spirit 219031605 ze źródła IRM (properties.mmsi, IMO 7907661), nie zgadywane.
-- 0119 miało 311058100. Q-18 (filtr kierunku) nie jest w tej migracji.
-- Cron ferry-ais co 3 min (pozycja na mapie nie starsza niż 5 min). Idempotentna.

alter table public.vessel_positions drop constraint if exists vessel_positions_source_check;
alter table public.vessel_positions
  add constraint vessel_positions_source_check
  check (source in ('DIGITRAFFIC', 'AISSTREAM', 'STENA'));

alter table public.vessel_positions add column if not exists eta_at timestamptz;
comment on column public.vessel_positions.eta_at is
  'AIS-SRC: properties.eta ze Stena IRM (UTC). Dodatkowe wejście ETA promu (D-85), obok rozkładu i statusu. Nie nadpisuje surowej pozycji.';

update public.vessels
   set mmsi = 219031605
 where imo = 7907661
   and name = 'M/F Stena Spirit'
   and mmsi is distinct from 219031605;

do $m$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron')
     and exists (select 1 from pg_extension where extname = 'pg_net') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'tower-ferry-ais';
    perform cron.schedule('tower-ferry-ais', '*/3 * * * *', $c$
      select net.http_post(
        url     := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/ferry-ais',
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
          'Content-Type', 'application/json'),
        body    := '{}'::jsonb,
        timeout_milliseconds := 60000)
    $c$);
  else
    raise notice '0159: pg_cron lub pg_net niedostępne — tower-ferry-ais co 3 min do zaplanowania ręcznie';
  end if;
end
$m$;
