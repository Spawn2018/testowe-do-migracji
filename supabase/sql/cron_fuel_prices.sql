-- PALIWO-AUTO-B / D-1300 — pobranie OKQ8 + Orlen o 07:15, 09:15 i 13:15 czasu polskiego
-- (UTC lato: 05:15 / 07:15 / 11:15). Ponowienie pomija źródło już zapisane tego dnia.
-- NA PRODUKCJI po wdrożeniu funkcji fuel-prices i migracji 0168/0245 (Vault: project_url, service_role_key).
select cron.unschedule(jobid) from cron.job where jobname in (
  'tower-fuel-prices', 'tower-fuel-prices-0915', 'tower-fuel-prices-1315'
);

select cron.schedule('tower-fuel-prices', '15 5 * * *', $$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/fuel-prices',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')),
    timeout_milliseconds := 180000)
$$);

select cron.schedule('tower-fuel-prices-0915', '15 7 * * *', $$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/fuel-prices',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')),
    timeout_milliseconds := 180000)
$$);

select cron.schedule('tower-fuel-prices-1315', '15 11 * * *', $$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/fuel-prices',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')),
    timeout_milliseconds := 180000)
$$);
