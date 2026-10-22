-- 0258 — HOTFIX #421 / D-20261022-0105-01: promy AIS + rozkład codzienny.
-- 1) ferry-schedule: cron codziennie 05:00 UTC (było: poniedziałek).
-- 2) Zamknięcie otwartych AIS_GAP (dopisek: bez ryzyka o starej pozycji).
-- Edge (ten sam PR): zapis wszystkich źródeł AIS; Stena IRM bez cache 3 min;
-- rozkład po zmianie statusu; delayed_* z pozycji; integration_runs ferry-departures.

do $body$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron')
     and to_regprocedure('cron.schedule(text,text,text)') is not null
     and to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is not null
  then
    perform cron.unschedule(jobid) from cron.job where jobname = 'tower-ferry-schedule';
    perform cron.schedule('tower-ferry-schedule', '0 5 * * *', $c$
      select net.http_post(
        url     := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/ferry-schedule',
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
          'Content-Type', 'application/json'),
        body    := '{}'::jsonb
      );
    $c$);
  else
    raise notice '0258: pg_cron lub pg_net niedostępne — tower-ferry-schedule codziennie do zaplanowania ręcznie';
  end if;
end
$body$;

update risk_signals
   set resolved_at = coalesce(resolved_at, now())
 where resolved_at is null
   and (dedup_key like 'AIS_GAP:%' or title_key = 'rk_ais_gap');
