-- =====================================================================
-- TOWER — Migracja 0133: częściowe zniesienie BLOCKED_R2 (R-1/R-2 RODO)
--
--   Właściciel: umowy RODO/zgody załatwione; konta dodaje sam w aplikacji.
--   EXTERNAL_MESSAGING pozostaje WYŁĄCZONE (SMS do kierowców nadal zablokowane).
--   E-mail (notifications EMAIL) wychodzi gdy odbiorca:
--     • domena log-mar.pl, ALBO
--     • jest w app_users (konto dodane przez właściciela), ALBO
--     • ma aktywne zaproszenie w user_invites (accepted_at is null).
--   Odblokowuje istniejące BLOCKED_R2 spełniające powyższe.
-- =====================================================================

create or replace function trg_notifications_r2_gate() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_email text;
  v_domain text;
  v_allowed boolean := false;
begin
  if new.channel = 'EMAIL' and new.status = 'PENDING' and not external_messaging_enabled() then
    v_email := lower(trim(coalesce(new.recipient, '')));
    v_domain := split_part(v_email, '@', 2);
    if v_domain = 'log-mar.pl' then
      v_allowed := true;
    elsif exists (
      select 1 from app_users u
       where lower(u.email::text) = v_email
         and (u.active is not false)
    ) then
      v_allowed := true;
    elsif exists (
      select 1 from user_invites i
       where lower(i.email::text) = v_email
         and i.accepted_at is null
    ) then
      v_allowed := true;
    end if;
    if (v_allowed) is not true then
      new.status := 'BLOCKED_R2';
      new.error := 'E-mail poza log-mar.pl tylko do kont/zaproszeń dodanych przez właściciela (0133); pełne EXTERNAL_MESSAGING nadal wyłączone';
    end if;
  end if;
  return new;
end $$;

update security_flags
   set note = 'EXTERNAL_MESSAGING wyłączone: SMS do kierowców zablokowane. E-mail: log-mar.pl + konta app_users + aktywne zaproszenia (0133). Pełne włączenie: admin_set_external_messaging po decyzji HHL.',
       updated_at = now()
 where key = 'EXTERNAL_MESSAGING';

-- Odblokuj kolejkę: e-maile do kont/zaproszeń właściciela (nie SMS).
update notifications n
   set status = 'PENDING',
       error = null
 where n.channel = 'EMAIL'
   and n.status = 'BLOCKED_R2'
   and (
     lower(split_part(coalesce(n.recipient, ''), '@', 2)) = 'log-mar.pl'
     or exists (
       select 1 from app_users u
        where lower(u.email::text) = lower(trim(n.recipient))
          and (u.active is not false)
     )
     or exists (
       select 1 from user_invites i
        where lower(i.email::text) = lower(trim(n.recipient))
          and i.accepted_at is null
     )
   );
