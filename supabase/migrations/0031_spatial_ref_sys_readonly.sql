-- 0031 — W1 (WYSOKA): spatial_ref_sys tylko do odczytu dla ról API.
-- Na produkcji tabela i uprawnienia należą do supabase_admin: anon/authenticated mają INSERT/UPDATE/DELETE/TRUNCATE,
-- a REVOKE ani ALTER TABLE z roli postgres nie działają. postgres ma prawo TRIGGER — wyzwalacz na poziomie
-- instrukcji blokuje każdą zmianę ról API (także dla 0 wierszy). Idempotentne; danych nie zmienia.
create or replace function public.forbid_spatial_ref_sys_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user in ('anon', 'authenticated') then
    raise exception 'spatial_ref_sys: tylko do odczytu' using errcode = '42501';
  end if;
  return null;
end $$;
revoke all on function public.forbid_spatial_ref_sys_mutation() from public, anon, authenticated;

do $$
begin
  if to_regclass('public.spatial_ref_sys') is not null then
    execute 'drop trigger if exists spatial_ref_sys_readonly on public.spatial_ref_sys';
    execute 'create trigger spatial_ref_sys_readonly
               before insert or update or delete or truncate on public.spatial_ref_sys
               for each statement execute function public.forbid_spatial_ref_sys_mutation()';
  end if;
end $$;
