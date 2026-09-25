-- 0005_cron.sql — harmonogram pg_cron (BK1), po ANEKSIE 1.
-- Historia: w BK1 ten plik był `0004_cron.sql` i planował 4 zadania `tower_*`
-- oraz wrapper `detect_sequence_risk_all()`. Aneks 1 wprowadził kanoniczną
-- `0004_statusy_automatyczne.sql`, która sama planuje komplet zadań
-- (`tower-prom`, `tower-prom-opoznienie`, `tower-cisza-gps`, `tower-terminy`,
-- `tower-rodo`, `tower-kolejnosc`) — ONA jest autorytatywna.
-- Ten plik usuwa duplikaty z BK1 (idempotentnie; bez pg_cron — nic nie robi).

do $cron$
declare j text;
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    foreach j in array array['tower_refresh_payment_status','tower_purge_personal_data',
                             'tower_detect_silent_vehicles','tower_detect_sequence_risk'] loop
      if exists (select 1 from cron.job where jobname = j) then
        perform cron.unschedule(j);
      end if;
    end loop;
  end if;
end $cron$;

-- Wrapper zbędny: 0004 wywołuje `detect_sequence_risk(id) from projects`.
drop function if exists public.detect_sequence_risk_all();
