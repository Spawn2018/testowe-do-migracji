-- 0034 — zaproszenie ważne 7 dni (decyzja właściciela 26.09.2026). disable_signup=false zostaje:
-- konto powstaje wyłącznie z aktywnego zaproszenia (wyzwalacz na auth.users). Ponowne zaproszenie
-- (admin_invite_user → on conflict … created_at = now()) odnawia termin. Idempotentna.
create or replace function public.invite_valid_days() returns int language sql immutable set search_path = '' as $$ select 7 $$;
revoke all on function public.invite_valid_days() from public, anon, authenticated;

create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare inv public.user_invites%rowtype;
begin
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
  update public.user_invites set accepted_at = now() where id = inv.id;
  insert into public.audit_log (user_id, action, entity, entity_id, new_value)
  values (inv.invited_by, 'USER_ACCEPTED_INVITE', 'app_users', new.id::text,
          jsonb_build_object('org_id', inv.org_id, 'role', inv.role));
  return new;
end $$;
