-- ferry-schedule codziennie 05:00 UTC — rozkład cargo (#421 / 0258).
-- NA PRODUKCJI; wymaga pg_net i Vault ('project_url', 'service_role_key'). Idempotentne.
select cron.unschedule(jobid) from cron.job where jobname = 'tower-ferry-schedule';
select cron.schedule('tower-ferry-schedule', '0 5 * * *', $$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/ferry-schedule',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
                                  'Content-Type', 'application/json'),
    body    := '{}'::jsonb,
    timeout_milliseconds := 120000)
$$);
