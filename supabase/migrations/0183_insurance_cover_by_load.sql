-- 0183: cover polisy dla jednego transportu (szuflada) — bez odczytu projects.

create or replace function public.load_insurance_cover_one(p_load uuid)
returns table (
  load_id uuid,
  covered boolean,
  policy_id uuid,
  policy_no text,
  insurer text,
  valid_until date
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_project uuid;
begin
  if (current_app_user_id() is not null) is not true then
    raise exception 'Brak aktywnego konta' using errcode = '42501';
  end if;
  if (p_load is not null) is not true then
    raise exception 'Brak id transportu' using errcode = '22023';
  end if;
  select l.project_id into v_project from loads l where l.id = p_load;
  if (v_project is not null) is not true then
    return;
  end if;
  return query
    select c.* from public.load_insurance_cover(v_project) c where c.load_id = p_load;
end;
$$;

revoke all on function public.load_insurance_cover_one(uuid) from public, anon;
grant execute on function public.load_insurance_cover_one(uuid) to authenticated;
