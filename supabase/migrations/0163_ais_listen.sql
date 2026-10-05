-- 0163 — AIS-POLF (05.10.2026): nasłuch aisstream co minutę (funkcja Edge ferry-ais-listen, ~50 s).
-- Przyczyna braku pozycji AISSTREAM: ramki binarne (Blob w Deno) odrzucane w JSON.parse oraz 8 s nasłuchu
-- w ferry-ais, gdy statek przy nabrzeżu nadaje co 3 min. ferry-ais (co 3 min) zostaje: Stena IRM, Digitraffic,
-- ryzyka; pozycje AISSTREAM bierze z bazy. Bez zmian schematu i danych. Idempotentna.

do $m$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron')
     and exists (select 1 from pg_extension where extname = 'pg_net') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'tower-ferry-ais-listen';
    perform cron.schedule('tower-ferry-ais-listen', '* * * * *', $c$
      select net.http_post(
        url     := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/ferry-ais-listen',
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
          'Content-Type', 'application/json'),
        body    := '{}'::jsonb,
        timeout_milliseconds := 70000)
    $c$);
  else
    raise notice '0163: pg_cron lub pg_net niedostępne — tower-ferry-ais-listen co minutę do zaplanowania ręcznie';
  end if;
end
$m$;
