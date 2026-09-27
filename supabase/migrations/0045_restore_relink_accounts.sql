-- =====================================================================
-- TOWER — Migracja 0045: PR2-B — konta po odtworzeniu kopii do NOWEGO projektu.
--   Kopia obejmuje schemat public bez auth.users. Po `scripts/restore.sh --into-public` wiersze app_users
--   wskazują auth_id kont, których w nowym projekcie nie ma, a zaproszenia są już przyjęte — bez tej
--   migracji logowanie kończyłoby się TOWER_NO_INVITE (albo konfliktem e-maila w app_users).
--   1. account_relink_pending: adresy kont z kopii czekające na połączenie (wypełnia WYŁĄCZNIE
--      restore_mark_relink() wywoływane przez restore.sh jako właściciel bazy; brak dostępu dla anon/authenticated).
--   2. handle_new_auth_user: nowe konto auth z adresem z listy, a dotychczasowe auth_id nie istnieje w auth.users
--      → app_users.auth_id = nowe konto (rola, organizacja, aktywność bez zmian), usunięcie z listy,
--      audit USER_RELINKED_AFTER_RESTORE. Poza listą — zasady zaproszeń bez zmian (0039).
--   Bezpieczeństwo: łączy tylko adres z listy i tylko osierocony wiersz; konto auth z tym adresem może
--   zalogować się wyłącznie właściciel skrzynki (link z e-maila), więc nikt nie przejmie cudzego konta.
--   Idempotentna, niedestrukcyjna.
-- =====================================================================
create table if not exists account_relink_pending (
  email       citext primary key,
  app_user_id uuid not null,
  old_auth_id uuid not null,
  marked_at   timestamptz not null default now()
);
alter table account_relink_pending enable row level security;
revoke all on account_relink_pending from anon, authenticated;

-- Wywołuje restore.sh po --into-public. Zwraca liczbę kont oczekujących na połączenie.
create or replace function public.restore_mark_relink() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if to_regclass('auth.users') is null then return 0; end if;
  execute $q$
    insert into public.account_relink_pending (email, app_user_id, old_auth_id)
    select lower(u.email)::citext, u.id, u.auth_id from public.app_users u
     where not exists (select 1 from auth.users a where a.id = u.auth_id)
    on conflict (email) do update set app_user_id = excluded.app_user_id, old_auth_id = excluded.old_auth_id, marked_at = now()$q$;
  select count(*) into n from public.account_relink_pending;
  return n;
end $$;
revoke all on function public.restore_mark_relink() from public, anon, authenticated;

create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare inv public.user_invites%rowtype; p public.account_relink_pending%rowtype;
begin
  -- PR2-B: konto z odtworzonej kopii → połączenie po adresie e-mail
  select * into p from public.account_relink_pending where email = lower(new.email)::citext for update;
  if found then
    update public.app_users u set auth_id = new.id
     where u.id = p.app_user_id and u.auth_id = p.old_auth_id
       and not exists (select 1 from auth.users a where a.id = p.old_auth_id);
    if found then
      delete from public.account_relink_pending where email = p.email;
      insert into public.audit_log (user_id, action, entity, entity_id, new_value)
      values (null, 'USER_RELINKED_AFTER_RESTORE', 'app_users', p.app_user_id::text,
              jsonb_build_object('old_auth_id', p.old_auth_id, 'new_auth_id', new.id));
      return new;
    end if;
  end if;
  select * into inv from public.user_invites
   where email = lower(new.email)::citext and accepted_at is null
   for update;
  if not found then
    raise exception 'TOWER_NO_INVITE: konto tylko na zaproszenie administratora HHL'
      using errcode = '42501';
  end if;
  if inv.created_at < now() - make_interval(days => public.invite_valid_days()) then
    raise exception 'TOWER_INVITE_EXPIRED: zaproszenie wygasło (ważne % dni) — poproś administratora HHL o nowe',
      public.invite_valid_days() using errcode = '42501';
  end if;
  insert into public.app_users (auth_id, org_id, email, full_name, role, locale)
  values (new.id, inv.org_id, lower(new.email), inv.full_name, inv.role, inv.locale);
  return new;
end $$;
