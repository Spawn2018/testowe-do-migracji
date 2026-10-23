-- 0272 — #464 / #425 poz. 4b: a7_permits_list — KSH tylko Firma/Trasa swoich transportów.
-- Było: CLIENT dostawał wszystkie scope=FIRMA (także nieprzypięte) i zero TRASA;
--       loads = count(*) ze wszystkich load_permits.
-- Jest: KSH tylko zezwolenia z load_permits → loads projektu klienta; loads liczone
--       tylko z jego transportów. HHL i SCX bez zmian reguł widoczności.

create or replace function public.a7_permits_list()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_out jsonb;
begin
  if (current_app_user_id() is not null) is not true then
    raise exception 'Brak aktywnego konta' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id,
    'scope', coalesce(p.scope, 'TRASA'),
    'country', p.country,
    'number', p.permit_no,
    'validFrom', p.valid_from,
    'validTo', p.valid_until,
    'limits', jsonb_build_object(
      'l', p.max_length_m, 'w', p.max_width_m, 'h', p.max_height_m
    ),
    'pilot', case when p.escort_required > 0 then 'PL + SE' else null end,
    'appliesTo', case when p.scope = 'FIRMA' then 'Firma' else coalesce(p.route_desc, 'Trasa') end,
    'loads', case
      when current_org_kind() = 'CLIENT' then (
        select count(*)::int
          from public.load_permits lp
          join public.loads l on l.id = lp.load_id
          join public.projects pr on pr.id = l.project_id
         where lp.permit_id = p.id
           and pr.client_org_id = current_org_id()
      )
      else (
        select count(*)::int from public.load_permits lp where lp.permit_id = p.id
      )
    end
  ) order by p.valid_until desc nulls last), '[]'::jsonb)
    into v_out
    from public.permits p
   where is_hhl()
      or (current_org_kind() = 'CARRIER' and exists (
            select 1 from public.loads l
             where l.carrier_org_id = current_org_id()
               and l.project_id = p.project_id
          ))
      or (current_org_kind() = 'CLIENT' and exists (
            select 1
              from public.load_permits lp
              join public.loads l on l.id = lp.load_id
              join public.projects pr on pr.id = l.project_id
             where lp.permit_id = p.id
               and pr.client_org_id = current_org_id()
          ));
  return v_out;
end $$;

revoke all on function public.a7_permits_list() from public, anon;
grant execute on function public.a7_permits_list() to authenticated;

comment on function public.a7_permits_list() is
  '#464: KSH — Firma i Trasa tylko z load_permits własnych transportów; loads = tylko własne.';
