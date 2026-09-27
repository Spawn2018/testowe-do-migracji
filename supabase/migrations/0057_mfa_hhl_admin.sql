-- 0057 — I-5: weryfikacja dwuetapowa (TOTP) wymagana dla HHL_ADMIN, egzekwowana w bazie przez `aal2`.
-- Punkt egzekwowania: helpery tożsamości (current_app_role, current_app_user_id, current_org_id, current_org_kind).
-- HHL_ADMIN z sesją aal1 przy włączonym wymaganiu = jak konto bez dostępu: RLS 0 wierszy, każda RPC z listy
-- dozwolonych odmawia (strażniki „is not true”, I-SEC). Dopisanie drugiego składnika (enroll/challenge) odbywa się
-- w Supabase Auth (GoTrue) — działa przy aal1, więc blokada nie uniemożliwia zapisu TOTP.
-- Przełącznik `security_flags.MFA_HHL_ADMIN`: przy wdrożeniu włączany WYŁĄCZNIE, gdy każdy aktywny HHL_ADMIN ma
-- zweryfikowany składnik TOTP (inaczej zablokowalibyśmy jedynego administratora). Włączenie/wyłączenie później:
-- admin_set_mfa_enforcement — tylko HHL_ADMIN w sesji aal2. Idempotentna, niedestrukcyjna.
create table if not exists public.security_flags (
  key        text primary key check (key in ('MFA_HHL_ADMIN')),
  enabled    boolean not null default false,
  note       text,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.app_users(id)
);
alter table public.security_flags enable row level security;
revoke all on table public.security_flags from anon, authenticated;

do $$
declare v_ready boolean := false;
begin
  if to_regclass('auth.mfa_factors') is not null then
    execute $q$
      select exists (select 1 from public.app_users where role = 'HHL_ADMIN' and active)
         and not exists (
           select 1 from public.app_users u
            where u.role = 'HHL_ADMIN' and u.active
              and not exists (select 1 from auth.mfa_factors f
                               where f.user_id = u.auth_id and f.factor_type::text = 'totp' and f.status::text = 'verified'))
    $q$ into v_ready;
  end if;
  insert into public.security_flags (key, enabled, note)
  values ('MFA_HHL_ADMIN', coalesce(v_ready, false),
          case when coalesce(v_ready, false) then 'włączone przy wdrożeniu 0057 — każdy aktywny HHL_ADMIN ma TOTP'
               else 'wyłączone przy wdrożeniu 0057 — nie każdy aktywny HHL_ADMIN ma TOTP (włączy administrator po zapisaniu TOTP)' end)
  on conflict (key) do nothing;
end $$;

-- poziom uwierzytelnienia z JWT (PostgREST: request.jwt.claims; środowisko testowe: request.jwt.claim.aal)
create or replace function public.current_aal() returns text
language sql stable set search_path = public as $$
  select coalesce(nullif(current_setting('request.jwt.claim.aal', true), ''),
                  nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'aal',
                  'aal1')
$$;
revoke all on function public.current_aal() from public, anon, authenticated;

create or replace function public.mfa_satisfied(p_role user_role) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(p_role is distinct from 'HHL_ADMIN'::user_role
      or not coalesce((select enabled from public.security_flags where key = 'MFA_HHL_ADMIN'), false)
      or public.current_aal() = 'aal2', false)
$$;
revoke all on function public.mfa_satisfied(user_role) from public, anon, authenticated;

create or replace function public.current_app_role() returns user_role
language sql stable security definer set search_path = public, extensions as $$
  select role from app_users where auth_id = auth.uid() and active and mfa_satisfied(role)
$$;
create or replace function public.current_app_user_id() returns uuid
language sql stable security definer set search_path = public, extensions as $$
  select id from app_users where auth_id = auth.uid() and active and mfa_satisfied(role)
$$;
create or replace function public.current_org_id() returns uuid
language sql stable security definer set search_path = public, extensions as $$
  select org_id from app_users where auth_id = auth.uid() and active and mfa_satisfied(role)
$$;
create or replace function public.current_org_kind() returns org_kind
language sql stable security definer set search_path = public, extensions as $$
  select o.kind from app_users u join organizations o on o.id = u.org_id
   where u.auth_id = auth.uid() and u.active and mfa_satisfied(u.role)
$$;

-- stan dla interfejsu (działa także przy aal1 — ekran zapisu/weryfikacji TOTP)
create or replace function public.my_mfa_status() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'role', u.role,
    'aal', public.current_aal(),
    'enforced', coalesce((select enabled from public.security_flags where key = 'MFA_HHL_ADMIN'), false),
    'required', coalesce(u.role = 'HHL_ADMIN' and u.active and coalesce((select enabled from public.security_flags where key = 'MFA_HHL_ADMIN'), false), false),
    'satisfied', coalesce(u.active and public.mfa_satisfied(u.role), false))
    from (select null::int as one) x
    left join app_users u on u.auth_id = auth.uid()
$$;
revoke all on function public.my_mfa_status() from public, anon;
grant execute on function public.my_mfa_status() to authenticated;

create or replace function public.admin_set_mfa_enforcement(p_enabled boolean) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_old boolean;
begin
  if (current_app_role() = 'HHL_ADMIN') is not true then
    raise exception 'Wymaganie 2FA zmienia wyłącznie administrator HHL' using errcode = '42501';
  end if;
  if (public.current_aal() = 'aal2') is not true then
    raise exception 'Wymagana weryfikacja dwuetapowa (aal2) — potwierdź kod TOTP' using errcode = '42501';
  end if;
  if (p_enabled is not null) is not true then
    raise exception 'Brak wartości przełącznika' using errcode = '22023';
  end if;
  select enabled into v_old from security_flags where key = 'MFA_HHL_ADMIN' for update;
  update security_flags set enabled = p_enabled, updated_at = now(), updated_by = current_app_user_id(),
         note = case when p_enabled then 'włączone przez administratora' else 'wyłączone przez administratora' end
   where key = 'MFA_HHL_ADMIN';
  insert into audit_log (user_id, action, entity, entity_id, old_value, new_value)
  values (current_app_user_id(), 'MFA_ENFORCEMENT_SET', 'security_flags', 'MFA_HHL_ADMIN',
          jsonb_build_object('enabled', v_old), jsonb_build_object('enabled', p_enabled));
  return p_enabled;
end $$;
revoke all on function public.admin_set_mfa_enforcement(boolean) from public, anon;
grant execute on function public.admin_set_mfa_enforcement(boolean) to authenticated;
