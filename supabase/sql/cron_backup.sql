-- ANEKS 4 PR2 — harmonogram kopii zapasowej 02:30 czasu polskiego.
-- pg_cron liczy w UTC: '30 0 * * *' = 02:30 czasu letniego (CEST), 01:30 zimowego (CET).
-- Uruchamia właściciel/Grok NA PRODUKCJI po: włączeniu pg_cron i pg_net, wdrożeniu funkcji backup-export
-- i zapisaniu klucza service role w Vault jako 'service_role_key' oraz adresu projektu jako 'project_url'.
select cron.schedule('tower-backup-export', '30 0 * * *', $$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/backup-export',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')),
    timeout_milliseconds := 300000)
$$);
