-- II-6 — road-se co 15 min (Trafikverket RoadCondition + WeatherMeasurepoint → corridor_conditions + ROAD_SE).
-- NA PRODUKCJI; wymaga pg_net i Vault ('project_url', 'service_role_key'). Idempotentne.
select cron.unschedule(jobid) from cron.job where jobname = 'tower-road-se';
select cron.schedule('tower-road-se', '*/15 * * * *', $$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/road-se',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
                                  'Content-Type', 'application/json'),
    body    := '{}'::jsonb,
    timeout_milliseconds := 60000)
$$);
