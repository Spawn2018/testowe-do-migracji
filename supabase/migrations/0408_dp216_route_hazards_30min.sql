-- DP-216 / D-20261016-0230-01 Z3 pkt 7: przeliczenie „Objazd czy postój?” co 30 min.
-- route-hazards: 17 i 47 po każdej godzinie (było tylko :17).
-- Koszt HERE: DETOUR_HERE_MAX_PER_RUN=8 × 2 przebiegi/h → max 16 zapytań/h przy otwartych sprawach;
-- licznik po tygodniu (POSTEP / 11.11). Wind Z2 i H-12 idą w tym samym jobie — akceptowalne.

do $m$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron')
     and exists (select 1 from pg_extension where extname = 'pg_net') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'tower-route-hazards';
    perform cron.schedule('tower-route-hazards', '17,47 * * * *', $c$
      select net.http_post(
        url     := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/route-hazards',
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
          'Content-Type', 'application/json'),
        body    := '{}'::jsonb,
        timeout_milliseconds := 60000)
    $c$);
  else
    raise notice '0408: pg_cron/pg_net niedostępne';
  end if;
end
$m$;
