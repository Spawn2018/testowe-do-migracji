-- 0060 — I-17: drugie urządzenie uwierzytelniające (2FA). Supabase Auth pozwala na kilka składników TOTP na konto;
-- każdy działa niezależnie (osobny sekret). Baza:
--   mfa_factor_count()  — liczba ZWERYFIKOWANYCH składników TOTP bieżącego konta (auth.mfa_factors; bez tabeli → 0);
--   my_mfa_status()     — dodatkowo 'factors' (liczba urządzeń) dla panelu w Opcjach;
--   admin_set_mfa_enforcement(true) — NOWE: włączenie wymagania tylko, gdy administrator ma ≥ 2 urządzenia
--                         (utrata jednego telefonu nie odcina konta; decyzja D-11: włączenie po I-17). Wyłączenie bez zmian.
-- Idempotentna, niedestrukcyjna.

create or replace function public.mfa_factor_count() returns int
language plpgsql stable security definer set search_path = public as $$
declare n int := 0;
begin
  if auth.uid() is null or to_regclass('auth.mfa_factors') is null then return 0; end if;
  execute $q$select count(*)::int from auth.mfa_factors where user_id = $1 and factor_type::text = 'totp' and status::text = 'verified'$q$
    into n using auth.uid();
  return n;
end $$;
revoke all on function public.mfa_factor_count() from public, anon, authenticated;

create or replace function public.my_mfa_status() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'role', u.role,
    'aal', public.current_aal(),
    'enforced', coalesce((select enabled from public.security_flags where key = 'MFA_HHL_ADMIN'), false),
    'required', coalesce(u.role = 'HHL_ADMIN' and u.active and coalesce((select enabled from public.security_flags where key = 'MFA_HHL_ADMIN'), false), false),
    'satisfied', coalesce(u.active and public.mfa_satisfied(u.role), false),
    'factors', case when u.id is null then 0 else public.mfa_factor_count() end)
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
  if p_enabled and (public.mfa_factor_count() >= 2) is not true then
    raise exception 'Najpierw zapisz drugie urządzenie uwierzytelniające (zapasowe) — potem włącz wymaganie' using errcode = '42501';
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
