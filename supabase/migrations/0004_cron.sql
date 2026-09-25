-- 0004_cron.sql — harmonogram pg_cron (ZLECENIE_FINAL §7 Etap 3, BK1).
-- Idempotentne: cron.schedule z nazwą zadania nadpisuje istniejące zadanie.
-- Czasy w UTC (pg_cron na Supabase działa w UTC).

create extension if not exists pg_cron with schema pg_catalog;

-- detect_sequence_risk wymaga p_project — wrapper dla wszystkich projektów.
create or replace function public.detect_sequence_risk_all()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare r record;
begin
  for r in select id from public.projects loop
    perform public.detect_sequence_risk(r.id);
  end loop;
end;
$$;
revoke all on function public.detect_sequence_risk_all() from public, anon, authenticated;

select cron.schedule('tower_refresh_payment_status', '15 2 * * *',  $$select public.refresh_payment_status()$$);
select cron.schedule('tower_purge_personal_data',    '30 2 * * *',  $$select public.purge_personal_data()$$);
select cron.schedule('tower_detect_silent_vehicles', '*/15 * * * *', $$select public.detect_silent_vehicles()$$);
select cron.schedule('tower_detect_sequence_risk',   '45 2 * * *',  $$select public.detect_sequence_risk_all()$$);
