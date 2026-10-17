-- B1 (D-20261017-0730-01): security_flags — SELECT dla HHL (bez 403); lista dla Operacji HHL (C8).

grant select on table public.security_flags to authenticated;

drop policy if exists security_flags_hhl_read on public.security_flags;
create policy security_flags_hhl_read on public.security_flags
  for select to authenticated
  using ((public.is_hhl()) is true);

comment on policy security_flags_hhl_read on public.security_flags is
  'B1: HHL Administrator i Operacje — odczyt przełączników; KSH/SCX bez wierszy (RLS).';

create or replace function public.security_flags_list()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role text;
  v_rows jsonb;
begin
  select role::text into v_role
    from app_users
   where auth_id = auth.uid() and active;
  if (v_role in ('HHL_ADMIN', 'HHL_OPS')) is not true then
    raise exception 'Przełączniki bezpieczeństwa — tylko HHL' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(
           jsonb_build_object(
             'key', f.key,
             'enabled', f.enabled,
             'note', f.note,
             'updated_at', f.updated_at,
             'updated_by', f.updated_by
           )
           order by f.key
         ), '[]'::jsonb)
    into v_rows
    from security_flags f;
  return v_rows;
end $$;

revoke all on function public.security_flags_list() from public, anon;
grant execute on function public.security_flags_list() to authenticated;
comment on function public.security_flags_list() is
  'B1 / C8: lista przełączników dla HHL_ADMIN i HHL_OPS; KSH/SCX — odmowa.';
