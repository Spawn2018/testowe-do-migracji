-- #685-b / decyzja 63b + 74 + #685-c: historia + MFA dla Edge viking-schedule-import.
-- Zapis rejsów w Edge (`applyVikingFileSchedule`, nie applySailings). Ekran: BN9-c1 koordynator.

begin;

create table if not exists public.viking_schedule_imports (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references public.projects (id),
  imported_by     uuid not null references public.app_users (id),
  imported_at     timestamptz not null default now(),
  file_name       text,
  file_hash       text,
  sailing_count   integer not null default 0,
  from_at         timestamptz,
  to_at           timestamptz,
  stats           jsonb not null default '{}'::jsonb
);

comment on table public.viking_schedule_imports is
  '#685-b: historia importu rozkładu Viking z pliku HTML (HHL_ADMIN+2FA).';

alter table public.viking_schedule_imports enable row level security;
revoke all on public.viking_schedule_imports from public, anon, authenticated;
grant select on public.viking_schedule_imports to authenticated;
grant select, insert, update, delete on public.viking_schedule_imports to service_role;

drop policy if exists viking_schedule_imports_hhl_read on public.viking_schedule_imports;
create policy viking_schedule_imports_hhl_read on public.viking_schedule_imports
  for select to authenticated
  using (public.is_hhl());

-- Bramka MFA przed podglądem/zapisem w Edge.
create or replace function public.viking_schedule_import_assert()
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_me uuid;
  v_role public.user_role;
begin
  perform public.assert_not_preview();
  select id, role into v_me, v_role
    from public.app_users
   where auth_id = auth.uid() and active;
  if (v_me is not null and v_role = 'HHL_ADMIN' and public.mfa_satisfied(v_role) is true) is not true then
    raise exception 'Tylko Administrator HHL z 2FA' using errcode = '42501';
  end if;
  return v_me;
end;
$$;

comment on function public.viking_schedule_import_assert() is
  '#685-b: HHL_ADMIN+2FA — zwraca app_users.id przed Edge viking-schedule-import.';

revoke all on function public.viking_schedule_import_assert() from public, anon;
grant execute on function public.viking_schedule_import_assert() to authenticated;

-- Wpis historii + audyt po udanym apply w Edge.
create or replace function public.viking_schedule_import_record(
  p_file_name text,
  p_file_hash text,
  p_sailing_count integer,
  p_from_at timestamptz,
  p_to_at timestamptz,
  p_stats jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_me uuid;
  v_role public.user_role;
  v_project uuid;
  v_id uuid;
begin
  perform public.assert_not_preview();
  select id, role into v_me, v_role
    from public.app_users
   where auth_id = auth.uid() and active;
  if (v_me is not null and v_role = 'HHL_ADMIN' and public.mfa_satisfied(v_role) is true) is not true then
    raise exception 'Tylko Administrator HHL z 2FA' using errcode = '42501';
  end if;

  select p.id into v_project
    from public.projects p
   where p.code = 'STEGRA_BODEN'
   limit 1;
  if v_project is null then
    raise exception 'Brak projektu STEGRA_BODEN' using errcode = 'P0002';
  end if;

  insert into public.viking_schedule_imports (
    project_id, imported_by, file_name, file_hash,
    sailing_count, from_at, to_at, stats
  ) values (
    v_project, v_me,
    nullif(btrim(coalesce(p_file_name, '')), ''),
    nullif(btrim(coalesce(p_file_hash, '')), ''),
    coalesce(p_sailing_count, 0),
    p_from_at, p_to_at,
    coalesce(p_stats, '{}'::jsonb)
  ) returning id into v_id;

  insert into public.audit_log (user_id, action, entity, entity_id, new_value)
  values (
    v_me,
    'VIKING_SCHEDULE_IMPORT',
    'viking_schedule_imports',
    v_id::text,
    jsonb_build_object(
      'file_name', p_file_name,
      'file_hash', p_file_hash,
      'sailing_count', p_sailing_count,
      'from_at', p_from_at,
      'to_at', p_to_at,
      'stats', coalesce(p_stats, '{}'::jsonb)
    )
  );

  return v_id;
end;
$$;

comment on function public.viking_schedule_import_record(text, text, integer, timestamptz, timestamptz, jsonb) is
  '#685-b: zapis historii importu Viking + audit_log (HHL_ADMIN+2FA).';

revoke all on function public.viking_schedule_import_record(text, text, integer, timestamptz, timestamptz, jsonb)
  from public, anon;
grant execute on function public.viking_schedule_import_record(text, text, integer, timestamptz, timestamptz, jsonb)
  to authenticated;

commit;
