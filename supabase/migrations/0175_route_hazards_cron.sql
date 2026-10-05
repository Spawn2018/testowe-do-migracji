-- H-10 / H-12 — cron Edge route-hazards co 60 min
do $m$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron')
     and exists (select 1 from pg_extension where extname = 'pg_net') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'tower-route-hazards';
    perform cron.schedule('tower-route-hazards', '17 * * * *', $c$
      select net.http_post(
        url     := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/route-hazards',
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
          'Content-Type', 'application/json'),
        body    := '{}'::jsonb,
        timeout_milliseconds := 60000)
    $c$);
  else
    raise notice '0175: pg_cron/pg_net niedostępne';
  end if;
end
$m$;
