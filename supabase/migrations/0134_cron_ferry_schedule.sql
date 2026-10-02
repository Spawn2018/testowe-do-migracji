-- =====================================================================
-- TOWER — Migracja 0134: cron tygodniowy ferry-schedule
--
--   Rozkład cargo Polferries + Stena — raz w tygodniu (poniedziałek 05:00 UTC).
--   Zgoda właściciela 02.10.2026 (OSTATNIE POLECENIE).
-- =====================================================================

do $m$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron')
     and exists (select 1 from pg_extension where extname = 'pg_net') then

    perform cron.unschedule(jobid) from cron.job where jobname = 'tower-ferry-schedule';
    perform cron.schedule('tower-ferry-schedule', '0 5 * * 1', $c$
      select net.http_post(
        url     := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/ferry-schedule',
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
          'Content-Type', 'application/json'),
        body    := '{}'::jsonb,
        timeout_milliseconds := 120000)
    $c$);

  else
    raise notice '0134: pg_cron lub pg_net niedostępne — tower-ferry-schedule do zaplanowania ręcznie';
  end if;
end
$m$;
