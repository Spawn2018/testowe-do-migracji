-- PALIWO-AUTO-B — codzienne pobranie OKQ8 + Orlen o 07:15 czasu polskiego (05:15 UTC latem).
-- NA PRODUKCJI po wdrożeniu funkcji fuel-prices i migracji 0168 (Vault: project_url, service_role_key).
select cron.schedule('tower-fuel-prices', '15 5 * * *', $$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/fuel-prices',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')),
    timeout_milliseconds := 60000)
$$);
