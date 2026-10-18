-- D-20261018-1215-01 §2.
-- Decyzja, która schodzi z NEW / ASSIGNED / SNOOZED, zamyka sygnał „Decyzja po terminie”
-- (dedup decision-overdue:<id>). Transport dostarczony, gotowy do faktury, zafakturowany
-- albo anulowany zamyka alarmy sprzed dostawy i w drodze.
-- Brak kierowcy zamyka się po prefiksie RES:DRIVER: (przegląd #305). Sam title_key rk_res_driver nie.
-- Spraw po dostawie (faktura
-- po terminie, L14, postoje, różnica SEFS) nie ruszamy. Bez powiadomień.

create or replace function public.risk_is_predelivery_alarm(p_dedup text, p_title_key text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select coalesce(p_dedup, '') like 'l3:NO_AWIZACJA:%'
      or coalesce(p_dedup, '') like 'l3:DOC_MISSING:%'
      or coalesce(p_dedup, '') like 'RES:DRIVER:%'
      or coalesce(p_dedup, '') like 'RES:VEHICLE:%'
      or coalesce(p_dedup, '') like 'RES:ESCORT:%'
      or coalesce(p_dedup, '') like 'ORDERNO:HHL:%'
      or coalesce(p_dedup, '') like 'ORDERNO:CARRIER:%'
      or coalesce(p_dedup, '') like 'AUTOSTATUS:%'
      or coalesce(p_dedup, '') like 'SILENT:%'
      or coalesce(p_dedup, '') like 'ETA_BREACH:%'
      or coalesce(p_dedup, '') like 'OFF_CORRIDOR:%'
      or coalesce(p_title_key, '') in ('rk_res_vehicle', 'rk_res_escort', 'rk_auto_status_blocked');
$$;

revoke all on function public.risk_is_predelivery_alarm(text, text) from public, anon, authenticated;

create or replace function public.decisions_close_overdue_signal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status in ('NEW', 'ASSIGNED', 'SNOOZED')
     and new.status is distinct from old.status
     and new.status not in ('NEW', 'ASSIGNED', 'SNOOZED') then
    update risk_signals
       set resolved_at = now()
     where dedup_key = 'decision-overdue:' || new.id::text
       and resolved_at is null;
  end if;
  return new;
end $$;

revoke all on function public.decisions_close_overdue_signal() from public, anon, authenticated;

drop trigger if exists trg_decisions_close_overdue_signal on decisions;
create trigger trg_decisions_close_overdue_signal
  after update of status on decisions
  for each row
  execute function public.decisions_close_overdue_signal();

create or replace function public.loads_close_delivery_unconfirmed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_code text;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  if new.status in ('DELIVERED', 'UNLOADED', 'READY_TO_INVOICE', 'INVOICED') then
    update decisions
       set status = 'RESOLVED',
           resolved_at = now(),
           resolution_code = 'DELIVERED',
           updated_at = now()
     where load_id = new.id
       and type_code = 'DELIVERY_UNCONFIRMED'
       and status in ('NEW', 'ASSIGNED', 'SNOOZED');
  end if;

  if new.status in ('DELIVERED', 'UNLOADED', 'READY_TO_INVOICE', 'INVOICED', 'CANCELLED') then
    v_code := case when new.status = 'CANCELLED' then 'CANCELLED' else 'DELIVERED' end;
    for r in
      update decisions
         set status = 'RESOLVED',
             resolved_at = now(),
             resolution_code = v_code,
             updated_at = now()
       where load_id = new.id
         and type_code = 'DELIVERED_CHECK'
         and status in ('NEW', 'ASSIGNED', 'SNOOZED')
      returning id
    loop
      insert into decision_events (decision_id, actor_id, action, payload)
      values (
        r.id,
        current_app_user_id(),
        'RESOLVE',
        jsonb_build_object('option', v_code, 'via', 'status', 'status', new.status)
      );
    end loop;
  end if;

  if new.status in ('DELIVERED', 'READY_TO_INVOICE', 'INVOICED', 'CANCELLED') then
    update risk_signals
       set resolved_at = now()
     where load_id = new.id
       and resolved_at is null
       and public.risk_is_predelivery_alarm(dedup_key, title_key);
  end if;

  return new;
end $$;

revoke all on function public.loads_close_delivery_unconfirmed() from public, anon, authenticated;

-- Jednorazowo: te same reguły na wierszach otwartych w chwili nałożenia.
update risk_signals s
   set resolved_at = now(),
       detail = coalesce(s.detail, '{}'::jsonb) || jsonb_build_object('closed_by', 'D-20261018-1215-01')
 where s.resolved_at is null
   and (
     (
       s.dedup_key like 'decision-overdue:%'
       and exists (
         select 1 from decisions d
          where s.dedup_key = 'decision-overdue:' || d.id::text
            and d.status not in ('NEW', 'ASSIGNED', 'SNOOZED')
       )
     )
     or exists (
       select 1 from loads l
        where l.id = s.load_id
          and l.status in ('DELIVERED', 'READY_TO_INVOICE', 'INVOICED', 'CANCELLED')
          and public.risk_is_predelivery_alarm(s.dedup_key, s.title_key)
     )
   );
