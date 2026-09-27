-- 0056 — I-10: e-mail o zmianie daty awizowanego transportu (SCHEDULE_DATE_CRITICAL).
-- import_schedule (0047/0050) tworzy powiadomienia IN_APP dla aktywnych kont HHL i przewoźnika transportu.
-- Wyzwalacz dokłada bliźniaczy wiersz EMAIL (ten sam odbiorca z app_users.email, ta sama treść) — wysyła go
-- funkcja Edge `send-notifications` (Resend, cron co 5 min). Bez zmian w import_schedule. Idempotentna:
-- dedup_key 'EMAIL:' || dedup IN_APP. Konto nieaktywne albo bez adresu → brak e-maila.
create or replace function public.notify_schedule_critical_email() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into notifications (channel, recipient, user_id, load_id, template, payload, dedup_key)
  select 'EMAIL', u.email::text, u.id, new.load_id, new.template, new.payload,
         'EMAIL:' || coalesce(new.dedup_key, new.id::text)
    from app_users u
   where u.id = new.user_id and u.active and coalesce(btrim(u.email::text), '') <> ''
  on conflict (dedup_key) where dedup_key is not null do nothing;
  return null;
end $$;
revoke all on function public.notify_schedule_critical_email() from public, anon, authenticated;

drop trigger if exists notifications_schedule_critical_email on public.notifications;
create trigger notifications_schedule_critical_email after insert on public.notifications
  for each row when (new.channel = 'IN_APP' and new.template = 'SCHEDULE_DATE_CRITICAL')
  execute function public.notify_schedule_critical_email();
