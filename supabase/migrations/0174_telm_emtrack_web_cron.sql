-- =====================================================================
-- TOWER — Migracja 0174: cron Edge emtrack-web (TELM-EMTRACK-WEB / D-36)
--
--   Co 2 min (PR5: ruch 2 min / postój 15 min — throttle w jobie).
--   Flaga TELM_EMTRACK_WEB=false → Edge kończy bez zapisu pozycji.
-- =====================================================================

do $m$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron')
     and exists (select 1 from pg_extension where extname = 'pg_net') then

    perform cron.unschedule(jobid) from cron.job where jobname = 'tower-emtrack-web';
    perform cron.schedule('tower-emtrack-web', '*/2 * * * *', $c$
      select net.http_post(
        url     := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/emtrack-web',
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
          'Content-Type', 'application/json'),
        body    := '{}'::jsonb,
        timeout_milliseconds := 60000)
    $c$);

  else
    raise notice '0174: pg_cron lub pg_net niedostępne — cron emtrack-web do zaplanowania ręcznie';
  end if;
end
$m$;
