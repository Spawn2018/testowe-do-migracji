-- 0041 — RETENCJA-RUNS (decyzja właściciela 26.09.2026 18:30): dziennik integration_runs rośnie ok. 430 wierszy
-- na dobę. Dzienne zadanie pg_cron 'tower-retencja-przebiegow' (02:50 UTC) usuwa przebiegi udane starsze niż
-- 30 dni i nieudane starsze niż 180 dni. Nigdy nie usuwa ostatniego udanego przebiegu danego zadania —
-- strażnik (0035, job_last_success) musi go widzieć. Idempotentna, niedestrukcyjna dla schematu.
create or replace function public.purge_integration_runs(p_now timestamptz default now())
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  with keep as (
    select distinct on (job) id from integration_runs where ok order by job, ran_at desc, id desc
  )
  delete from integration_runs r
   where ((r.ok and r.ran_at < p_now - interval '30 days')
       or (not r.ok and r.ran_at < p_now - interval '180 days'))
     and r.id not in (select id from keep);
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.purge_integration_runs(timestamptz) from public, anon, authenticated;

do $cron$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'tower-retencja-przebiegow';
    perform cron.schedule('tower-retencja-przebiegow', '50 2 * * *', 'select public.purge_integration_runs()');
  else
    raise notice 'pg_cron niedostępny — tower-retencja-przebiegow do zaplanowania ręcznie (środowisko testowe)';
  end if;
end $cron$;
