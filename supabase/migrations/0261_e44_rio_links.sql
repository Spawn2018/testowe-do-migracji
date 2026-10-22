-- 0261 — E44 (#437): odczyt pozycji z linku RIO — kolumna streak + cron tower-rio-links.
-- Zgoda RIO na piśmie — właściciel, 22.10.2026 09:02 (dokument u właściciela).
-- Adapter: _shared/telematics/rioPositionSharing.ts; Edge: rio-links; job: rio-links.

alter table public.loads
  add column if not exists rio_error_streak integer not null default 0;

comment on column public.loads.rio_error_streak is
  'E44 pkt 7: kolejne błędy 5xx/timeout/format; ≥3 → SOURCE_DOWN:RIO';

-- Nowa kolumna loads → grant SELECT (bez rio_secret).
grant select (rio_error_streak) on public.loads to authenticated;

do $m$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron')
     and exists (select 1 from pg_extension where extname = 'pg_net') then

    perform cron.unschedule(jobid) from cron.job where jobname = 'tower-rio-links';
    perform cron.schedule('tower-rio-links', '*/2 * * * *', $c$
      select net.http_post(
        url     := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/rio-links',
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
          'Content-Type', 'application/json'),
        body    := '{}'::jsonb,
        timeout_milliseconds := 60000)
    $c$);

  else
    raise notice '0261: pg_cron lub pg_net niedostępne — cron tower-rio-links do zaplanowania ręcznie';
  end if;
end
$m$;
