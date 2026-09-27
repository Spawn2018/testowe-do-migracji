-- =====================================================================
-- TOWER — Migracja 0068: blokada wiadomości do osób zewnętrznych przed R-2 (umowy RODO, D-5)
--
--   security_flags.EXTERNAL_MESSAGING (domyślnie WYŁĄCZONE). Dopóki wyłączone:
--     • e-mail (notifications, channel EMAIL) na adres spoza domeny log-mar.pl dostaje status BLOCKED_R2
--       — send-notifications wysyła wyłącznie PENDING, więc nie wychodzi (dotyczy też e-maili zastępczych SMS);
--     • telefon-bramka pobiera (sms_pull) wyłącznie SMS testowe (kind TEST) na numery z listy
--       sms_test_numbers (numery wewnętrzne HHL); SMS do kierowców zostają w kolejce, wygasają i idą
--       e-mailem zastępczym — też tylko do adresów log-mar.pl.
--   Włączenie: admin_set_external_messaging(true) — tylko HHL_ADMIN, z wpisem w audit_log; po R-2.
--   Idempotentna.
-- =====================================================================
alter table security_flags drop constraint if exists security_flags_key_check;
alter table security_flags add constraint security_flags_key_check check (key in ('MFA_HHL_ADMIN', 'EXTERNAL_MESSAGING'));
insert into security_flags (key, enabled, note)
values ('EXTERNAL_MESSAGING', false, 'wyłączone do R-2 (umowy RODO, D-5): e-mail tylko na log-mar.pl, SMS tylko testowe na numery wewnętrzne')
on conflict (key) do nothing;

create or replace function external_messaging_enabled() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select enabled from security_flags where key = 'EXTERNAL_MESSAGING'), false)
$$;
revoke all on function external_messaging_enabled() from public, anon, authenticated;

create table if not exists sms_test_numbers (
  to_e164    text primary key check (to_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  label      text not null,
  created_by uuid references app_users(id),
  created_at timestamptz not null default now()
);
alter table sms_test_numbers enable row level security;
revoke all on sms_test_numbers from anon, authenticated;
grant select on sms_test_numbers to authenticated;
drop policy if exists sms_test_numbers_read on sms_test_numbers;
create policy sms_test_numbers_read on sms_test_numbers for select to authenticated using (is_hhl());

create or replace function trg_notifications_r2_gate() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.channel = 'EMAIL' and new.status = 'PENDING' and not external_messaging_enabled()
     and lower(split_part(coalesce(new.recipient, ''), '@', 2)) is distinct from 'log-mar.pl' then
    new.status := 'BLOCKED_R2';
    new.error := 'Przed R-2 (umowy RODO) e-mail wyłącznie na adresy log-mar.pl';
  end if;
  return new;
end $$;
revoke all on function trg_notifications_r2_gate() from public, anon, authenticated;
drop trigger if exists trg_notifications_r2_gate on notifications;
create trigger trg_notifications_r2_gate before insert or update of status, recipient on notifications
  for each row execute function trg_notifications_r2_gate();

-- telefon: przed R-2 wyłącznie SMS testowe na numery wewnętrzne
create or replace function sms_pull(p_token text default null, p_limit int default 5)
returns table (id uuid, to_e164 text, body text, attempts smallint, expires_at timestamptz)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare v_dev uuid; v_left int; v_paused boolean; v_ext boolean;
begin
  v_dev := sms_device_auth(p_token);
  v_ext := external_messaging_enabled();
  update sms_outbox o set status = case when o.attempts >= 3 then 'FAILED'::sms_status else 'QUEUED'::sms_status end,
         error = case when o.attempts >= 3 then 'brak raportu z telefonu po 3 próbach' else o.error end
   where o.status = 'CLAIMED' and o.claimed_at < now() - interval '3 minutes';
  select greatest(day_limit - day_sent, 0), paused into v_left, v_paused from sms_devices where id = v_dev;
  if v_paused then return; end if;
  return query
  with c as (
    select o.id from sms_outbox o
     where o.status = 'QUEUED' and o.not_before <= now() and o.expires_at > now()
       and (v_ext or (o.kind = 'TEST' and exists (select 1 from sms_test_numbers t where t.to_e164 = o.to_e164)))
     order by o.priority desc, o.created_at
     limit least(greatest(coalesce(p_limit, 5), 0), 5, v_left)
     for update skip locked)
  update sms_outbox o set status = 'CLAIMED', device_id = v_dev, claimed_at = now(), attempts = o.attempts + 1
    from c where o.id = c.id
  returning o.id, o.to_e164, o.body, o.attempts, o.expires_at;
end $$;
revoke all on function sms_pull(text, int) from public, authenticated;
grant execute on function sms_pull(text, int) to anon;

-- HHL: numer testowy i SMS testowy
create or replace function sms_add_test_number(p_to text, p_label text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if (is_hhl()) is not true then raise exception 'Numery testowe bramki SMS dodaje wyłącznie HHL' using errcode = '42501'; end if;
  if (p_to ~ '^\+[1-9][0-9]{7,14}$') is not true then raise exception 'Numer w formacie E.164, np. +48600000000' using errcode = '22023'; end if;
  insert into sms_test_numbers (to_e164, label, created_by) values (p_to, coalesce(nullif(trim(p_label), ''), 'test'), current_app_user_id())
  on conflict (to_e164) do nothing;
  insert into audit_log (user_id, action, entity, entity_id) values (current_app_user_id(), 'SMS_TEST_NUMBER_ADD', 'sms_test_numbers', right(p_to, 3));
  return found;
end $$;

create or replace function sms_send_test(p_to text) returns uuid
language plpgsql security definer set search_path = public as $$
begin
  if (is_hhl()) is not true then raise exception 'SMS testowy wysyła wyłącznie HHL' using errcode = '42501'; end if;
  if (exists (select 1 from sms_test_numbers where to_e164 = p_to)) is not true then
    raise exception 'SMS testowy tylko na numer z listy numerów testowych' using errcode = '22023';
  end if;
  return sms_enqueue('TEST', null, p_to, null, '{}'::jsonb, 100, null, false);
end $$;

create or replace function admin_set_external_messaging(p_enabled boolean) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_old boolean;
begin
  if (current_app_role() = 'HHL_ADMIN') is not true then
    raise exception 'Wiadomości do osób zewnętrznych włącza wyłącznie administrator HHL (po R-2)' using errcode = '42501';
  end if;
  if (p_enabled is not null) is not true then raise exception 'Podaj true albo false' using errcode = '22023'; end if;
  select enabled into v_old from security_flags where key = 'EXTERNAL_MESSAGING' for update;
  update security_flags set enabled = p_enabled, updated_at = now(), updated_by = current_app_user_id() where key = 'EXTERNAL_MESSAGING';
  insert into audit_log (user_id, action, entity, entity_id, old_value, new_value)
  values (current_app_user_id(), 'EXTERNAL_MESSAGING_SET', 'security_flags', 'EXTERNAL_MESSAGING',
          jsonb_build_object('enabled', v_old), jsonb_build_object('enabled', p_enabled));
  return p_enabled;
end $$;
revoke all on function sms_add_test_number(text, text) from public, anon;
revoke all on function sms_send_test(text) from public, anon;
revoke all on function admin_set_external_messaging(boolean) from public, anon;
grant execute on function sms_add_test_number(text, text) to authenticated;
grant execute on function sms_send_test(text) to authenticated;
grant execute on function admin_set_external_messaging(boolean) to authenticated;

create or replace function sms_external_messaging_state() returns boolean
language plpgsql stable security definer set search_path = public as $$
begin
  if (is_hhl()) is not true then raise exception 'Stan bramki SMS widzi wyłącznie HHL' using errcode = '42501'; end if;
  return external_messaging_enabled();
end $$;
revoke all on function sms_external_messaging_state() from public, anon;
grant execute on function sms_external_messaging_state() to authenticated;
