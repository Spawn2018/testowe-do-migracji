-- #312 / D-1740 B1: has_doc dla CMR jak C17 (uploaded_at >= actual_delivery_at, purged_at is null).
-- CMR wgrany przed „Dostarczone” nie liczy się jako OK.

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
      case
        when req.category = 'CMR' then
          exists (
            select 1 from documents d
             where d.load_id = ld.id
               and d.category = 'CMR'
               and d.superseded_at is null
               and d.purged_at is null
               and ld.actual_delivery_at is not null
               and d.uploaded_at >= ld.actual_delivery_at
          )
        else
          exists (
            select 1 from documents d
             where d.load_id = ld.id
               and d.category = req.category
               and d.superseded_at is null
          )
      end as has_doc,
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
