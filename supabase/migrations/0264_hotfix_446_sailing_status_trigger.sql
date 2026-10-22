-- 0264 — #446 pkt 1 / F7: trigger + backfill po wartościach enum z 0263.
-- Przy actual_departure_at → W_REJSIE, przy actual_arrival_at → DOPLYNAL
-- (bez zmiany przy ODWOLANY). Trigger także na UPDATE status: actual_*
-- nie daje się nadpisać OPOZNIONY (operator_notice_apply / sync).
-- ETA: compute_load_eta uznaje opóźnienie po delayed_departure_at albo
-- status=OPOZNIONY; po W_REJSIE zostaje delayed_departure_at (sync ustawia
-- je razem z OPOZNIONY przed wypłynięciem).

create or replace function public.sailings_set_status_from_actual()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is not distinct from 'ODWOLANY' then
    return new;
  end if;
  if new.actual_arrival_at is not null then
    new.status := 'DOPLYNAL';
  elsif new.actual_departure_at is not null then
    new.status := 'W_REJSIE';
  end if;
  return new;
end;
$$;

comment on function public.sailings_set_status_from_actual() is
  '#446/F7: actual_* → W_REJSIE/DOPLYNAL; chroni przed OPOZNIONY; ODWOLANY bez zmian. ETA: delayed_departure_at.';

drop trigger if exists trg_sailings_actual_status on public.sailings;
create trigger trg_sailings_actual_status
  before insert or update of status, actual_departure_at, actual_arrival_at
  on public.sailings
  for each row
  execute function public.sailings_set_status_from_actual();

-- Jednorazowo: istniejące rejsy z actual_* (bez ODWOLANY).
update public.sailings
   set status = 'DOPLYNAL'
 where actual_arrival_at is not null
   and status is distinct from 'ODWOLANY'
   and status is distinct from 'DOPLYNAL';

update public.sailings
   set status = 'W_REJSIE'
 where actual_departure_at is not null
   and actual_arrival_at is null
   and status is distinct from 'ODWOLANY'
   and status is distinct from 'W_REJSIE';
