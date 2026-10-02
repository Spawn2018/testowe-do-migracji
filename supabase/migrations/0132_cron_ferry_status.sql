-- =====================================================================
-- TOWER — Migracja 0132: cron ferry-status co 15 min
--
--   II-5 / STENA-3: status rejsów Polferries+Stena LIVE.
--   Zgodnie z scripts/ferry/cron-edge.sql i ZRODLA_DANYCH (§1.1 — nie częściej).
-- =====================================================================

do $m$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron')
     and exists (select 1 from pg_extension where extname = 'pg_net') then

    perform cron.unschedule(jobid) from cron.job where jobname = 'tower-ferry-status';
    perform cron.schedule('tower-ferry-status', '*/15 * * * *', $c$
      select net.http_post(
        url     := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/ferry-status',
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
          'Content-Type', 'application/json'),
        body    := '{}'::jsonb,
        timeout_milliseconds := 60000)
    $c$);

  else
    raise notice '0132: pg_cron lub pg_net niedostępne — tower-ferry-status do zaplanowania ręcznie';
  end if;
end
$m$;
