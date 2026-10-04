-- ANEKS 5 3.2b — ferry-ais co 3 min (Digitraffic, bez klucza; zawsze tryb LIVE, bez danych demonstracyjnych).
-- Zapisuje: integration_runs (przebieg) oraz ryzyko INFO „AIS: <statek> w porcie Nynäshamn” tylko przy prawdziwym
-- sygnale AIS dla rejsu GDN-NYN w toku; brak sygnału / brak MMSI → tylko obserwacja w wyniku przebiegu.
-- NA PRODUKCJI; wymaga pg_net i Vault ('project_url', 'service_role_key') jak cron_usage.sql. Idempotentne.
select cron.unschedule(jobid) from cron.job where jobname = 'tower-ferry-ais';
select cron.schedule('tower-ferry-ais', '*/3 * * * *', $$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/ferry-ais',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
                                  'Content-Type', 'application/json'),
    body    := '{}'::jsonb,
    timeout_milliseconds := 60000)
$$);
