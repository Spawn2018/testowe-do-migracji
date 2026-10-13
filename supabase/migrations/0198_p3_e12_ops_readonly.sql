-- TOWER — Migracja 0198: P3 E12-A — Operacje HHL w Opcjach tylko odczyt (DECYZJE 08.10 pkt 33).
-- Zapisy ustawień Opcji: wyłącznie HHL_ADMIN. Odczyt (is_hhl) bez zmian. Idempotentna.

create or replace function public.is_hhl_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from app_users
     where auth_id = auth.uid() and active and role = 'HHL_ADMIN'
  )
$$;

revoke all on function public.is_hhl_admin() from public, anon, authenticated;

-- Podmiana straży is_hhl() → is_hhl_admin() w funkcjach zapisu Opcji (E12 lista).
do $$
declare
  r record;
  src text;
  nxt text;
begin
  for r in
    select p.oid, p.proname
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in (
         'rate_card_save',
         'sefs_save_parameters',
         'fuel_add_reading',
         'sms_issue_device',
         'sms_revoke_device',
         'sms_set_paused',
         'sms_add_test_number',
         'sms_send_test'
       )
  loop
    src := pg_get_functiondef(r.oid);
    nxt := replace(src, 'is_hhl()', 'is_hhl_admin()');
    if nxt is distinct from src then
      execute nxt;
    end if;
  end loop;
end $$;
