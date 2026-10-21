-- PALIWO-AUTO-B / D-1300 F7-2 — cron co godzinę o :15; funkcja fuel-prices
-- sama sprawdza godzinę Europe/Warsaw (7 / 9 / 13). Ponowienie pomija źródło już zapisane.
-- NA PRODUKCJI po wdrożeniu funkcji fuel-prices i migracji 0168/0245 (Vault: project_url, service_role_key).
select cron.unschedule(jobid) from cron.job where jobname in (
  'tower-fuel-prices', 'tower-fuel-prices-0915', 'tower-fuel-prices-1315'
);

select cron.schedule('tower-fuel-prices', '15 * * * *', $$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/fuel-prices',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')),
    timeout_milliseconds := 240000)
$$);
