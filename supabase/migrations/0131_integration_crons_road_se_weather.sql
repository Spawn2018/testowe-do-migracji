-- =====================================================================
-- TOWER — Migracja 0131: harmonogramy Edge road-se + ferry-weather
--
--   road-se co 15 min (II-6, klucz Trafikverket już w sekretach Edge).
--   ferry-weather co 1 h (było co 6 h — zbyt rzadko względem okna rejsu).
--   send-notifications: timeout HTTP 90 s (jedyny historyczny fail = Gateway Timeout).
-- =====================================================================

do $m$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron')
     and exists (select 1 from pg_extension where extname = 'pg_net') then

    perform cron.unschedule(jobid) from cron.job where jobname = 'tower-road-se';
    perform cron.schedule('tower-road-se', '*/15 * * * *', $c$
      select net.http_post(
        url     := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/road-se',
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
          'Content-Type', 'application/json'),
        body    := '{}'::jsonb,
        timeout_milliseconds := 60000)
    $c$);

    perform cron.unschedule(jobid) from cron.job where jobname = 'tower-ferry-weather';
    perform cron.schedule('tower-ferry-weather', '15 * * * *', $c$
      select net.http_post(
        url     := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/ferry-weather',
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
          'Content-Type', 'application/json'),
        body    := '{}'::jsonb,
        timeout_milliseconds := 90000)
    $c$);

    perform cron.unschedule(jobid) from cron.job where jobname = 'tower-send-notifications';
    perform cron.schedule('tower-send-notifications', '*/5 * * * *', $c$
      select net.http_post(
        url     := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/send-notifications',
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
          'Content-Type', 'application/json'),
        body    := '{}'::jsonb,
        timeout_milliseconds := 90000)
    $c$);

  else
    raise notice '0131: pg_cron lub pg_net niedostępne — cron Edge do zaplanowania ręcznie';
  end if;
end
$m$;
