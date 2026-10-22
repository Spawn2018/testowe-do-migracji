-- 0263 — #446 pkt 1 / D-20261022-1235 (kolejka po #445): status rejsu po wypłynięciu/dopłynięciu.
-- Rejsy z actual_departure_at zostawały ZAPLANOWANY. Przy actual_departure_at → W_REJSIE,
-- przy actual_arrival_at → DOPLYNAL (bez zmiany przy ODWOLANY). Trigger + Edge ferry-departures.

alter type public.sailing_status add value if not exists 'W_REJSIE';
alter type public.sailing_status add value if not exists 'DOPLYNAL';

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
  '#446: actual_departure_at → W_REJSIE, actual_arrival_at → DOPLYNAL; ODWOLANY bez zmian.';

drop trigger if exists trg_sailings_actual_status on public.sailings;
create trigger trg_sailings_actual_status
  before insert or update of actual_departure_at, actual_arrival_at
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
