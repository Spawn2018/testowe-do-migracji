-- ANEKS 4 PR4 — usage-check codziennie 07:00 czasu polskiego (05:00 UTC latem). NA PRODUKCJI, po wdrożeniu funkcji
-- usage-check i zapisaniu 'project_url' / 'service_role_key' w Vault (jak cron_backup.sql).
select cron.schedule('tower-usage-check', '0 5 * * *', $$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/usage-check',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')),
    timeout_milliseconds := 60000)
$$);
