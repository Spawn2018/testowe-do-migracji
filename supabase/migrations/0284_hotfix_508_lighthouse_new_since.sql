-- #508 / #422 c.d. — Lighthouse po deploy-main (p1–p3) + „nowe od wdrożenia” w Błędach aplikacji.
-- newSince = ostatni udany wpis integration_runs.job='deploy-main'; newCount = grupy z first_seen_at >= newSince.
-- Bez wpisu deploy-main: newSince/newCount zostają JSON null (jak 0283).

select set_config('tower.audit_source', 'migracja 0284 (#508 lighthouse + newSince)', true);

-- Znacznik udanego wdrożenia (deploy-main po Vercel) — tylko usługa / sesja postgres.
create or replace function public.deploy_success_record(
  p_ran_at timestamptz default now(),
  p_result jsonb default '{}'::jsonb
) returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint;
  v_jwt_role text := '';
begin
  if session_user not in ('postgres', 'supabase_admin') then
    if to_regprocedure('auth.role()') is not null then
      execute 'select auth.role()' into v_jwt_role;
    end if;
    if (coalesce(v_jwt_role, '') = 'service_role') is not true then
      raise exception 'Zapis wdrożenia — tylko usługa' using errcode = '42501';
    end if;
  end if;
  insert into public.integration_runs (job, ran_at, ok, result)
  values (
    'deploy-main',
    coalesce(p_ran_at, now()),
    true,
    coalesce(p_result, '{}'::jsonb)
  )
  returning id into v_id;
  return v_id;
end $$;

revoke all on function public.deploy_success_record(timestamptz, jsonb)
  from public, anon, authenticated;
grant execute on function public.deploy_success_record(timestamptz, jsonb)
  to service_role;
comment on function public.deploy_success_record(timestamptz, jsonb) is
  '#508: znacznik udanego deploy-main (newSince w app_errors_recent); tylko service_role / postgres.';

create or replace function public.app_errors_recent(p_days int default 7)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_days int;
  v_groups jsonb;
  v_total int;
  v_since timestamptz;
  v_new_since timestamptz;
  v_new_count int;
begin
  if (public.is_hhl_admin()) is not true then
    raise exception 'Błędy aplikacji — tylko Administrator HHL' using errcode = '42501';
  end if;
  v_days := greatest(1, least(coalesce(p_days, 7), 30));
  v_since := now() - make_interval(days => v_days);

  select coalesce(sum(hits), 0)::int
    into v_total
    from public.client_errors
   where last_seen_at >= v_since;

  select coalesce(jsonb_agg(
           jsonb_build_object(
             'id', g.msg_key,
             'message', g.message,
             'where', coalesce(g.path, '—'),
             'people', g.people,
             'count', g.hits,
             'builds', g.builds,
             'firstAt', g.first_seen_at,
             'lastAt', g.last_seen_at,
             'state', null,
             'stack', left(g.stack, 500)
           )
           order by g.hits desc, g.last_seen_at desc
         ), '[]'::jsonb)
    into v_groups
    from (
      select md5(c.message) as msg_key,
             c.message,
             (
               select p.path
                 from public.client_errors p
                where p.last_seen_at >= v_since
                  and p.message = c.message
                group by p.path
                order by sum(p.hits) desc nulls last, max(p.last_seen_at) desc
                limit 1
             ) as path,
             max(c.stack) as stack,
             count(distinct c.user_id) filter (where c.user_id is not null)::int as people,
             sum(c.hits)::int as hits,
             count(distinct nullif(c.build, ''))::int as builds,
             min(c.first_seen_at) as first_seen_at,
             max(c.last_seen_at) as last_seen_at
        from public.client_errors c
       where c.last_seen_at >= v_since
       group by c.message
       order by sum(c.hits) desc, max(c.last_seen_at) desc
       limit 100
    ) g;

  select max(ran_at)
    into v_new_since
    from public.integration_runs
   where job = 'deploy-main'
     and ok is true;

  if v_new_since is null then
    return jsonb_build_object(
      'groups', v_groups,
      'total7d', coalesce(v_total, 0),
      'newSince', null,
      'newCount', null,
      'days', v_days
    );
  end if;

  select count(*)::int
    into v_new_count
    from (
      select c.message
        from public.client_errors c
       where c.last_seen_at >= v_since
       group by c.message
      having min(c.first_seen_at) >= v_new_since
    ) n;

  return jsonb_build_object(
    'groups', v_groups,
    'total7d', coalesce(v_total, 0),
    'newSince', v_new_since,
    'newCount', coalesce(v_new_count, 0),
    'days', v_days
  );
end $$;

revoke all on function public.app_errors_recent(int) from public, anon;
grant execute on function public.app_errors_recent(int) to authenticated;
comment on function public.app_errors_recent(int) is
  '#422/#508 E47: client_errors 7 dni; newSince/newCount od deploy-main; tylko HHL_ADMIN (0058).';
