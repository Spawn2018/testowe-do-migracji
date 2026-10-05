-- 0182 B-3a (część polisy) / lista 3.2: polisa OCP APPROVED przewoźnika automatycznie pokrywa każdy jego transport.
-- Zezwolenia per wymiary (3.1) — nadal ⛔ D-83.
-- SECURITY DEFINER: insurance_policies bez SELECT dla authenticated (jak 0097/0125).

create or replace function public.load_insurance_cover(p_project uuid)
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
begin
  if (current_app_user_id() is not null) is not true then
    raise exception 'Brak aktywnego konta' using errcode = '42501';
  end if;
  -- HHL / przewoźnik / KSH: widzą cover transportów, które i tak widzą przez RLS na loads
  return query
  select
    l.id as load_id,
    (p.id is not null) as covered,
    p.id as policy_id,
    p.policy_no,
    p.insurer,
    p.valid_until
  from loads l
  left join lateral (
    select ip.id, ip.policy_no, ip.insurer, ip.valid_until
      from insurance_policies ip
     where ip.org_id = l.carrier_org_id
       and ip.approval_status = 'APPROVED'
       and ip.valid_from <= coalesce(l.plan_load_date, (timezone('Europe/Warsaw', now()))::date)
       and ip.valid_until >= coalesce(l.plan_load_date, (timezone('Europe/Warsaw', now()))::date)
     order by ip.valid_until desc
     limit 1
  ) p on true
  where l.project_id = p_project
    and l.status <> 'CANCELLED';
end;
$$;

revoke all on function public.load_insurance_cover(uuid) from public, anon;
grant execute on function public.load_insurance_cover(uuid) to authenticated;

comment on function public.load_insurance_cover(uuid) is
  '0182: cover polisą OCP APPROVED przewoźnika (DEFINER — tabela polis bez SELECT dla API).';
