-- =====================================================================
-- TOWER — Migracja 0046: PR2-C — ważność listy account_relink_pending (0045).
--   Lista kont do połączenia po odtworzeniu kopii jest ważna relink_valid_days() = 30 dni od wpisu
--   (restore.sh --into-public). Starszy wpis: wyzwalacz go pomija (zasady zaproszeń jak dla obcego adresu),
--   a zadanie dzienne 'tower-wygasanie-listy-kont' (02:45 UTC) usuwa go z audytem RELINK_PENDING_EXPIRED.
--   Po 30 dniach konto, które się nie zalogowało, wraca na zwykłą ścieżkę: ponowne zaproszenie przez HHL.
--   Połączenie nie zmienia app_users.active — konto nieaktywne w kopii zostaje nieaktywne (test invite.sh).
--   Idempotentna, niedestrukcyjna (usuwa wyłącznie przeterminowane wpisy listy przejściowej).
-- =====================================================================
create or replace function public.relink_valid_days() returns int language sql immutable set search_path = '' as $$ select 30 $$;
revoke all on function public.relink_valid_days() from public, anon, authenticated;

create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare inv public.user_invites%rowtype; p public.account_relink_pending%rowtype;
begin
  -- PR2-B: konto z odtworzonej kopii → połączenie po adresie e-mail (active bez zmian: nieaktywne zostaje nieaktywne)
  select * into p from public.account_relink_pending
   where email = lower(new.email)::citext
     and marked_at >= now() - make_interval(days => public.relink_valid_days())   -- 0046: lista ważna 30 dni
   for update;
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

create or replace function public.expire_relink_pending(p_now timestamptz default now()) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  with d as (delete from public.account_relink_pending
              where marked_at < p_now - make_interval(days => public.relink_valid_days()) returning email)
  select count(*) into n from d;
  if n > 0 then
    insert into public.audit_log (user_id, action, entity, entity_id, new_value)
    values (null, 'RELINK_PENDING_EXPIRED', 'account_relink_pending', null,
            jsonb_build_object('usuniete', n, 'valid_days', public.relink_valid_days()));
  end if;
  return n;
end $$;
revoke all on function public.expire_relink_pending(timestamptz) from public, anon, authenticated;

do $cron$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'tower-wygasanie-listy-kont';
    perform cron.schedule('tower-wygasanie-listy-kont', '45 2 * * *', 'select public.expire_relink_pending()');
  else
    raise notice 'pg_cron niedostępny — tower-wygasanie-listy-kont do zaplanowania ręcznie (środowisko testowe)';
  end if;
end $cron$;
