-- =====================================================================
-- 0016 — M7: terminy i przypomnienia o płatnościach (ZLECENIE §8 M7, Q5, W10).
--   send_payment_reminders(dzień) — zadanie systemowe (cron, po refresh_payment_status):
--     kadencja −3 / 0 / +1 / +7 / +14 dni względem terminu (payment_terms relacji, domyślnie ta),
--     odbiorcy WYŁĄCZNIE płatnik (odbiorca faktury) i wierzyciel (wystawca) — nigdy trzecia strona,
--     dwa kanały: IN_APP (centrum powiadomień) i EMAIL (kolejka → funkcja send-notifications / Resend),
--     język odbiorcy (app_users.locale), kwota w walucie faktury; opłacona → cisza.
--   Oznaczenie „Opłacona” anuluje niewysłane e-maile przypomnień tej faktury.
--   notifications.read_at + mark_notifications_read(ids) — odczyt w centrum powiadomień (własne wiersze).
--   Idempotentna, niedestrukcyjna.
-- =====================================================================

alter table notifications add column if not exists read_at timestamptz;

create or replace function send_payment_reminders(p_today date default (now() at time zone 'Europe/Warsaw')::date)
returns int language plpgsql security definer set search_path = public as $$
declare v_n int := 0; v_k int;
begin
  perform refresh_payment_status(p_today);
  with inv as (
    select i.*, (p_today - i.due_date) as off,
           coalesce((select t.reminder_cadence from payment_terms t
                      where t.project_id = i.project_id and t.payer_org_id = i.recipient_org_id
                        and t.payee_org_id = i.issuer_org_id and t.valid_from <= i.issue_date
                      order by t.valid_from desc limit 1), '{-3,0,1,7,14}'::int[]) as cadence
      from invoices i
     where i.direction is not null and i.due_date is not null
       and i.payment_status <> 'OPLACONA' and i.paid_at is null
  ), due as (
    select inv.* from inv where inv.off = any(inv.cadence)
  ), who as (
    select d.id as invoice_id, d.invoice_number, d.due_date, d.off, d.currency, d.gross_total, d.direction,
           u.id as user_id, u.email::text as email, u.locale,
           case when u.org_id = d.recipient_org_id then 'PAYER' else 'PAYEE' end as party
      from due d join app_users u on u.active and u.org_id in (d.recipient_org_id, d.issuer_org_id)
  ), ch as (
    select w.*, c.channel from who w cross join (values ('IN_APP'), ('EMAIL')) c(channel)
     where c.channel = 'IN_APP' or coalesce(w.email, '') <> ''
  )
  insert into notifications (channel, recipient, user_id, template, payload, dedup_key)
  select ch.channel, coalesce(ch.email, ch.user_id::text), ch.user_id, 'PAYMENT_REMINDER',
         jsonb_build_object('invoice_id', ch.invoice_id, 'number', ch.invoice_number, 'due', ch.due_date,
                            'offset', ch.off, 'currency', ch.currency, 'gross', ch.gross_total,
                            'direction', ch.direction, 'party', ch.party, 'locale', coalesce(ch.locale, 'pl')),
         'PAYMENT_REMINDER:' || ch.invoice_id || ':' || ch.off || ':' || ch.user_id || ':' || ch.channel
    from ch
  on conflict (dedup_key) where dedup_key is not null do nothing;
  get diagnostics v_k = row_count;
  v_n := v_n + v_k;
  return v_n;
end $$;
revoke execute on function send_payment_reminders(date) from public, anon, authenticated;
do $g$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function send_payment_reminders(date) to service_role;
  end if;
end $g$;

-- Opłacona → cisza: niewysłane e-maile przypomnień tej faktury anulowane (w aplikacji zostaje historia).
create or replace function invoices_paid_silence() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.payment_status = 'OPLACONA' and old.payment_status is distinct from 'OPLACONA' then
    update notifications set status = 'CANCELLED', error = 'opłacona'
     where template = 'PAYMENT_REMINDER' and channel = 'EMAIL' and status = 'PENDING'
       and payload->>'invoice_id' = new.id::text;
  end if;
  return new;
end $$;
revoke execute on function invoices_paid_silence() from public, anon, authenticated;
drop trigger if exists trg_invoices_paid_silence on invoices;
create trigger trg_invoices_paid_silence after update of payment_status on invoices
  for each row execute function invoices_paid_silence();

-- Centrum powiadomień: oznaczenie przeczytania własnych wierszy (bez prawa UPDATE do tabeli).
create or replace function mark_notifications_read(p_ids bigint[])
returns int language plpgsql security definer set search_path = public as $$
declare v int;
begin
  update notifications set read_at = coalesce(read_at, now())
   where id = any(p_ids) and user_id = current_app_user_id() and channel = 'IN_APP';
  get diagnostics v = row_count;
  return v;
end $$;
revoke execute on function mark_notifications_read(bigint[]) from public, anon;
grant execute on function mark_notifications_read(bigint[]) to authenticated;

do $cron$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'tower-przypomnienia') then
      perform cron.unschedule('tower-przypomnienia');
    end if;
    perform cron.schedule('tower-przypomnienia', '15 0 * * *', 'select send_payment_reminders()');
  else
    raise notice 'pg_cron niedostępny — tower-przypomnienia do zaplanowania ręcznie';
  end if;
end $cron$;
