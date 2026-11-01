-- DP-133 (F7 #705): osobny cron dla detect_ferry_gps_stuck_at_departure.
-- Dotąd obie funkcje w jednym poleceniu tower-prom-opoznienie — wyjątek w jednej
-- wycofywał transakcję i pomijał drugą. Job: tower-prom-gps-port (*/10).

do $cron133$
begin
  if to_regclass('cron.job') is not null
     and to_regprocedure('cron.schedule(text,text,text)') is not null then
    -- overdue: tylko detect_ferry_overdue
    perform cron.unschedule(j.jobid)
      from cron.job j where j.jobname = 'tower-prom-opoznienie';
    perform cron.schedule(
      'tower-prom-opoznienie',
      '*/10 * * * *',
      $c$select public.detect_ferry_overdue();$c$
    );

    -- GPS stuck: osobny job (osobna transakcja)
    perform cron.unschedule(j.jobid)
      from cron.job j where j.jobname = 'tower-prom-gps-port';
    perform cron.schedule(
      'tower-prom-gps-port',
      '*/10 * * * *',
      $c$select public.detect_ferry_gps_stuck_at_departure();$c$
    );
  end if;
exception when others then
  raise warning 'DP-133 cron tower-prom-gps-port: %', sqlerrm;
end $cron133$;
