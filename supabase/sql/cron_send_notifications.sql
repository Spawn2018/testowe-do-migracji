-- ANEKS 3/4 2.2 — send-notifications co 5 min: wysyłka kolejki notifications (channel=EMAIL, status=PENDING) przez Resend.
-- Każdy przebieg zapisuje integration_runs (job = send-notifications); strażnik zadań (0036) pilnuje okna 30 min.
-- NA PRODUKCJI; wymaga pg_net i Vault ('project_url', 'service_role_key') jak cron_usage.sql. Idempotentne.
-- timeout 90 s: jedyny historyczny fail (28.09) = Gateway Timeout przy 60 s.
select cron.unschedule(jobid) from cron.job where jobname = 'tower-send-notifications';
select cron.schedule('tower-send-notifications', '*/5 * * * *', $$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/send-notifications',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
                                  'Content-Type', 'application/json'),
    body    := '{}'::jsonb,
    timeout_milliseconds := 90000)
$$);
