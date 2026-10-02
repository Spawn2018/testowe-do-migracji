-- II-8 — ferry-weather co 1 h (FMI/DMI/SMHI; +15 min luzu w godzinie).
-- NA PRODUKCJI; wymaga pg_net i Vault ('project_url', 'service_role_key'). Idempotentne.
select cron.unschedule(jobid) from cron.job where jobname = 'tower-ferry-weather';
select cron.schedule('tower-ferry-weather', '15 * * * *', $$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/ferry-weather',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
                                  'Content-Type', 'application/json'),
    body    := '{}'::jsonb,
    timeout_milliseconds := 90000)
$$);
