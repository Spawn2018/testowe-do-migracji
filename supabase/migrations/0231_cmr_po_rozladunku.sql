-- D-20261018-1740-01: CMR tylko po rozładunku (AFTER_UNLOAD / 24 h).
-- Przed „Dostarczone” CMR nie jest OVERDUE. Kotwica AT_LOAD dla CMR odrzucona.

-- 1. Seed nowych projektów
create or replace function public.doc_requirements_seed(p_project uuid) returns void
language sql security definer set search_path = public as $$
  insert into doc_requirements (project_id, category, required, responsible, anchor, offset_hours)
  select p_project, v.category::doc_category, true, v.responsible::org_kind, v.anchor, v.offset_hours
    from (values
      ('PERMIT_PL',     'CARRIER', 'BEFORE_LOAD',  24),
      ('PERMIT_SE',     'CARRIER', 'BEFORE_FERRY', 24),
      ('CMR',           'CARRIER', 'AFTER_UNLOAD', 24),
      ('LASHING_PHOTO', 'CARRIER', 'AT_LOAD',       2),
      ('POD',           'CARRIER', 'AFTER_UNLOAD', 24),
      ('INSURANCE',     'CARRIER', 'ORG',           0),
      ('SPEC',          'CLIENT',  'BEFORE_LOAD',  72)
    ) as v(category, responsible, anchor, offset_hours)
  on conflict (project_id, category) do nothing
$$;
revoke all on function public.doc_requirements_seed(uuid) from public, anon, authenticated;

-- 2. Zapis: CMR tylko AFTER_UNLOAD
create or replace function public.doc_requirement_set(
  p_project uuid, p_category doc_category, p_required boolean, p_responsible org_kind, p_anchor text, p_offset_hours integer
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_user uuid; v_old jsonb;
begin
  if (is_hhl()) is not true then
    raise exception 'Wymagalność dokumentów ustawia wyłącznie HHL' using errcode = '42501';
  end if;
  if (p_anchor in ('BEFORE_LOAD', 'AT_LOAD', 'BEFORE_FERRY', 'AFTER_UNLOAD', 'ORG')) is not true then
    raise exception 'Nieznane zdarzenie odniesienia: %', coalesce(p_anchor, '—') using errcode = '22023';
  end if;
  if p_category = 'CMR' and p_anchor is distinct from 'AFTER_UNLOAD' then
    raise exception 'CMR tylko po rozładunku (AFTER_UNLOAD)' using errcode = '22023';
  end if;
  if (p_offset_hours between 0 and 720) is not true then
    raise exception 'Przesunięcie terminu 0–720 h' using errcode = '22023';
  end if;
  if (p_required is not null and p_responsible is not null and p_category is not null) is not true then
    raise exception 'Brak kategorii, wymagalności albo strony odpowiedzialnej' using errcode = '22023';
  end if;
  if (exists (select 1 from projects where id = p_project)) is not true then raise exception 'Nieznany projekt'; end if;
  v_user := current_app_user_id();
  select to_jsonb(r) - 'id' - 'updated_at' - 'updated_by' into v_old from doc_requirements r
    where project_id = p_project and category = p_category;
  insert into doc_requirements (project_id, category, required, responsible, anchor, offset_hours, updated_by, updated_at)
  values (p_project, p_category, p_required, p_responsible, p_anchor, p_offset_hours, v_user, now())
  on conflict (project_id, category) do update
    set required = excluded.required, responsible = excluded.responsible, anchor = excluded.anchor,
        offset_hours = excluded.offset_hours, updated_by = excluded.updated_by, updated_at = now()
  returning id into v_id;
  insert into audit_log (user_id, action, entity, entity_id, old_value, new_value)
  values (v_user, 'DOC_REQUIREMENT_SET', 'doc_requirements', v_id::text, v_old,
          jsonb_build_object('category', p_category, 'required', p_required, 'responsible', p_responsible,
                             'anchor', p_anchor, 'offset_hours', p_offset_hours));
  return v_id;
end $$;
revoke all on function public.doc_requirement_set(uuid, doc_category, boolean, org_kind, text, integer) from public, anon;
grant execute on function public.doc_requirement_set(uuid, doc_category, boolean, org_kind, text, integer) to authenticated;

-- 3. Stan: CMR liczy termin od faktycznego „Dostarczone”; przed dostawą bez wiersza (chyba że jest plik)
create or replace function public.doc_requirements_status(p_project uuid)
returns table (load_id uuid, category doc_category, responsible org_kind, due_at timestamptz, has_doc boolean, state text)
language sql stable security invoker set search_path = public as $$
  with req as (
    select r.* from doc_requirements r where r.project_id = p_project and r.required and r.anchor <> 'ORG'
  ), ld as (
    select l.id, l.plan_load_from, l.plan_load_to, l.plan_load_date, l.plan_delivery_from, l.plan_delivery_to,
           l.plan_delivery_date, l.actual_delivery_at,
           coalesce(s.delayed_departure_at, s.departure_at) as ferry_at
      from loads l left join sailings s on s.id = l.sailing_id
     where l.project_id = p_project and l.status <> 'CANCELLED'
  ), x as (
    select ld.id as load_id, req.category, req.responsible, req.anchor,
      case
        when req.category = 'CMR' and req.anchor = 'AFTER_UNLOAD' then
          case when ld.actual_delivery_at is not null
            then ld.actual_delivery_at + make_interval(hours => req.offset_hours)
            else null
          end
        when req.anchor = 'BEFORE_LOAD' then coalesce(ld.plan_load_from, (ld.plan_load_date + time '06:00') at time zone 'Europe/Warsaw')
                                 - make_interval(hours => req.offset_hours)
        when req.anchor = 'AT_LOAD' then coalesce(ld.plan_load_to, ld.plan_load_from, (ld.plan_load_date + time '18:00') at time zone 'Europe/Warsaw')
                                 + make_interval(hours => req.offset_hours)
        when req.anchor = 'BEFORE_FERRY' then ld.ferry_at - make_interval(hours => req.offset_hours)
        when req.anchor = 'AFTER_UNLOAD' then coalesce(ld.plan_delivery_to, ld.plan_delivery_from,
                                 (ld.plan_delivery_date + time '23:59') at time zone 'Europe/Stockholm')
                                 + make_interval(hours => req.offset_hours)
      end as due_at,
      exists (select 1 from documents d where d.load_id = ld.id and d.category = req.category and d.superseded_at is null) as has_doc,
      ld.actual_delivery_at
    from ld cross join req
  )
  select x.load_id, x.category, x.responsible, x.due_at, x.has_doc,
         case when x.has_doc then 'OK' when x.due_at is not null and x.due_at < now() then 'OVERDUE' else 'MISSING' end
    from x
   where not (
     x.category = 'CMR' and x.anchor = 'AFTER_UNLOAD'
     and x.has_doc is not true
     and x.actual_delivery_at is null
   )
$$;
revoke all on function public.doc_requirements_status(uuid) from public, anon;
grant execute on function public.doc_requirements_status(uuid) to authenticated;

-- 4. Jednorazowo: istniejące CMR → AFTER_UNLOAD / 24
do $m$
declare
  r record;
  n int := 0;
begin
  for r in
    select id, project_id, anchor, offset_hours, required, responsible
      from doc_requirements
     where category = 'CMR'
       and (anchor is distinct from 'AFTER_UNLOAD' or offset_hours is distinct from 24)
  loop
    update doc_requirements
       set anchor = 'AFTER_UNLOAD',
           offset_hours = 24,
           updated_at = now()
     where id = r.id;
    insert into audit_log (user_id, action, entity, entity_id, old_value, new_value)
    values (
      null, 'DOC_REQUIREMENT_SET', 'doc_requirements', r.id::text,
      jsonb_build_object('category', 'CMR', 'anchor', r.anchor, 'offset_hours', r.offset_hours,
                         'required', r.required, 'responsible', r.responsible, 'via', '0231'),
      jsonb_build_object('category', 'CMR', 'anchor', 'AFTER_UNLOAD', 'offset_hours', 24,
                         'required', r.required, 'responsible', r.responsible, 'via', '0231')
    );
    n := n + 1;
  end loop;
  if n > 20 then
    raise exception '0231: zbyt wiele wierszy CMR do poprawy (%) — przerwane', n;
  end if;
end
$m$;

-- 5. Zabezpieczenie CHECK (po update)
alter table public.doc_requirements drop constraint if exists doc_requirements_cmr_after_unload;
alter table public.doc_requirements
  add constraint doc_requirements_cmr_after_unload
  check (category <> 'CMR' or anchor = 'AFTER_UNLOAD');
