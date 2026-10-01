-- M12 — KROK WŁAŚCICIELA W-M12-1: harmonogram funkcji Edge integracji (pg_cron → pg_net).
-- Przed uruchomieniem: 1) wdrożyć funkcje: npx supabase functions deploy ferry-schedule ferry-status ferry-ais road-se road-pl traffic-flow
--                      2) włączyć rozszerzenie pg_net (panel → Database → Extensions)
--                      3) zapisać w Vault: select vault.create_secret('<SERVICE_ROLE_KEY>', 'tower_service_key');
--                                          select vault.create_secret('https://<ref>.supabase.co', 'tower_url');
-- Klucze wyłącznie w Vault / sekretach funkcji — nigdy w repozytorium.
-- Częstotliwości wg ZLECENIE_FINAL AN2 · M12 (funkcje dodatkowo pilnują odstępu przez integration_runs).
do $$
declare j record;
begin
  for j in select * from (values
    ('tower-ferry-schedule', '0 5 * * 1',     'ferry-schedule'),   -- raz w tygodniu (pon. 05:00 UTC) + ręcznie HHL
    ('tower-ferry-status',   '*/15 * * * *',  'ferry-status'),     -- co 15 min, nie częściej
    ('tower-ferry-ais',      '*/10 * * * *',  'ferry-ais'),
    ('tower-road-se',        '*/10 * * * *',  'road-se'),          -- bez TRAFIKVERKET_API_KEY: tryb DEMO
    ('tower-road-pl',        '*/10 * * * *',  'road-pl'),          -- bez KPD_DATEX_URL: tryb DEMO
    ('tower-traffic-flow',   '*/15 * * * *',  'traffic-flow')      -- CLEAN-TT-HERE: zawsze DEMO (TomTom wycofany)
  ) as t(jobname, schedule, fn) loop
    perform cron.unschedule(jobname) from cron.job where jobname = j.jobname;
    perform cron.schedule(j.jobname, j.schedule, format($f$
      select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'tower_url') || '/functions/v1/%s',
        headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'tower_service_key'),
                                      'Content-Type', 'application/json'),
        body := '{}'::jsonb, timeout_milliseconds := 30000)
    $f$, j.fn));
  end loop;
end $$;
