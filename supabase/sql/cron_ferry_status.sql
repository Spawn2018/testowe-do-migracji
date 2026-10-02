-- II-5 / STENA-3 — ferry-status co 15 min (nie częściej — ZRODLA_DANYCH §1.1).
-- NA PRODUKCJI; wymaga pg_net i Vault ('project_url', 'service_role_key'). Idempotentne.
select cron.unschedule(jobid) from cron.job where jobname = 'tower-ferry-status';
select cron.schedule('tower-ferry-status', '*/15 * * * *', $$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/ferry-status',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
                                  'Content-Type', 'application/json'),
    body    := '{}'::jsonb,
    timeout_milliseconds := 60000)
$$);
