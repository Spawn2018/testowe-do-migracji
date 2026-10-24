-- #422 / D-20261022-0113-01 — Stan systemu › Wydajność i Błędy aplikacji: źródło w bazie.
-- Tabela perf_results + RPC odczytu; zasilanie: zapis service_role (Lighthouse po deploy-main),
-- p95 list z pg_stat_statements (cron dzienny), równoczesność = „brak pomiaru” bez testu obciążenia.
-- Błędy: app_errors_recent() — 7 dni, grupowanie po komunikacie, tylko HHL.

select set_config('tower.audit_source', 'migracja 0283 (#422 perf + app errors)', true);

create table if not exists public.perf_results (
  id            bigint generated always as identity primary key,
  measured_at   timestamptz not null default now(),
  metric_id     text not null check (metric_id ~ '^[a-z0-9_]{1,40}$'),
  what          text not null check (char_length(what) between 1 and 200),
  how           text not null check (char_length(how) between 1 and 120),
  result_text   text not null check (char_length(result_text) between 1 and 200),
  limit_text    text not null check (char_length(limit_text) between 1 and 200),
  ok            boolean,
  source        text not null check (char_length(source) between 1 and 80)
);

create index if not exists perf_results_metric_at
  on public.perf_results (metric_id, measured_at desc);

alter table public.perf_results enable row level security;
revoke all on table public.perf_results from public, anon, authenticated;
grant select on table public.perf_results to authenticated;

drop policy if exists perf_results_hhl_read on public.perf_results;
create policy perf_results_hhl_read on public.perf_results
  for select to authenticated
  using ((public.is_hhl()) is true);

comment on table public.perf_results is
  '#422 E46: pomiary wydajności (Lighthouse / p95 / równoczesność); zapis tylko funkcją service_role.';
comment on policy perf_results_hhl_read on public.perf_results is
  '#422: odczyt dla HHL_ADMIN i HHL_OPS; KSH/SCX bez wierszy.';

-- Ostatni wynik każdego metric_id (HHL).
create or replace function public.perf_results_latest()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_rows jsonb;
  v_at   timestamptz;
begin
  if (public.is_hhl()) is not true then
    raise exception 'Wydajność — tylko HHL' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(
           jsonb_build_object(
             'id', r.metric_id,
             'what', r.what,
             'how', r.how,
             'result', r.result_text,
             'limit', r.limit_text,
             'ok', r.ok,
             'source', r.source,
             'measured_at', r.measured_at
           )
           order by r.metric_id
         ), '[]'::jsonb),
         max(r.measured_at)
    into v_rows, v_at
    from (
      select distinct on (metric_id)
             metric_id, what, how, result_text, limit_text, ok, source, measured_at
        from public.perf_results
       order by metric_id, measured_at desc
    ) r;
  return jsonb_build_object('at', v_at, 'rows', v_rows);
end $$;

revoke all on function public.perf_results_latest() from public, anon;
grant execute on function public.perf_results_latest() to authenticated;
comment on function public.perf_results_latest() is
  '#422: ostatni pomiar każdego metric_id dla HHL; KSH/SCX — 42501.';

-- Zapis pomiaru (Lighthouse CI / cron p95) — wyłącznie service_role.
create or replace function public.perf_result_record(
  p_metric_id text,
  p_what text,
  p_how text,
  p_result_text text,
  p_limit_text text,
  p_ok boolean,
  p_source text,
  p_measured_at timestamptz default now()
) returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint;
  v_jwt_role text := '';
begin
  -- Brama nie ma auth.role() — wywołanie od razu rzuca 42883, zanim dojdzie sesja postgres.
  -- Cron i brama: session_user postgres/supabase_admin. PostgREST: auth.role() = service_role.
  if session_user not in ('postgres', 'supabase_admin') then
    if to_regprocedure('auth.role()') is not null then
      execute 'select auth.role()' into v_jwt_role;
    end if;
    if (coalesce(v_jwt_role, '') = 'service_role') is not true then
      raise exception 'Zapis pomiaru wydajności — tylko usługa' using errcode = '42501';
    end if;
  end if;
  if (p_metric_id ~ '^[a-z0-9_]{1,40}$') is not true then
    raise exception 'Nieprawidłowy metric_id' using errcode = '22023';
  end if;
  insert into public.perf_results (measured_at, metric_id, what, how, result_text, limit_text, ok, source)
  values (
    coalesce(p_measured_at, now()),
    p_metric_id,
    left(btrim(p_what), 200),
    left(btrim(p_how), 120),
    left(btrim(p_result_text), 200),
    left(btrim(p_limit_text), 200),
    p_ok,
    left(btrim(p_source), 80)
  )
  returning id into v_id;
  return v_id;
end $$;

revoke all on function public.perf_result_record(text, text, text, text, text, boolean, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.perf_result_record(text, text, text, text, text, boolean, text, timestamptz)
  to service_role;
comment on function public.perf_result_record(text, text, text, text, text, boolean, text, timestamptz) is
  '#422: zapis wiersza perf_results (deploy-main Lighthouse / cron p95); tylko service_role.';

-- p95 funkcji list (pg_stat_statements) albo „brak pomiaru”; równoczesność bez testu = brak pomiaru.
create or replace function public.perf_p95_lists_ingest(p_now timestamptz default now())
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ms numeric;
  v_txt text;
  v_ok boolean;
  v_src text;
  v_id bigint;
  v_jwt_role text := '';
begin
  if session_user not in ('postgres', 'supabase_admin') then
    if to_regprocedure('auth.role()') is not null then
      execute 'select auth.role()' into v_jwt_role;
    end if;
    if (coalesce(v_jwt_role, '') = 'service_role') is not true then
      raise exception 'Zasilanie p95 — tylko usługa / cron' using errcode = '42501';
    end if;
  end if;

  v_ms := null;
  if exists (select 1 from pg_extension where extname = 'pg_stat_statements') then
    begin
      if to_regclass('extensions.pg_stat_statements') is not null then
        execute $q$
          select percentile_cont(0.95) within group (order by mean_exec_time)
            from extensions.pg_stat_statements
           where query ~* 'list_loads|map_display_state|list_load_messages|a7_permits_list|load_ready_gaps'
             and calls >= 5
        $q$ into v_ms;
      elsif to_regclass('public.pg_stat_statements') is not null then
        execute $q$
          select percentile_cont(0.95) within group (order by mean_exec_time)
            from public.pg_stat_statements
           where query ~* 'list_loads|map_display_state|list_load_messages|a7_permits_list|load_ready_gaps'
             and calls >= 5
        $q$ into v_ms;
      end if;
    exception
      when others then
        v_ms := null;
    end;
  end if;

  if v_ms is null then
    v_txt := 'brak pomiaru';
    v_ok := null;
    v_src := 'pg_stat_statements:brak';
  else
    v_txt := replace(to_char(round(v_ms)::int, 'FM999999'), '.', '') || ' ms';
    v_ok := (v_ms <= 500);
    v_src := 'pg_stat_statements';
  end if;

  v_id := public.perf_result_record(
    'p4',
    'Funkcje list w bazie',
    'p95',
    v_txt,
    'p95 ≤ 500 ms',
    v_ok,
    v_src,
    p_now
  );

  -- Równoczesność: brak testu obciążenia → zawsze „brak pomiaru” (dopisek).
  perform public.perf_result_record(
    'p5',
    'Równoczesność',
    '20 sesji przez 10 min',
    'brak pomiaru',
    '0 błędów',
    null,
    'loadtest:brak',
    p_now
  );

  return jsonb_build_object('p4_id', v_id, 'p4_result', v_txt, 'p4_ok', v_ok, 'source', v_src);
end $$;

revoke all on function public.perf_p95_lists_ingest(timestamptz) from public, anon, authenticated;
grant execute on function public.perf_p95_lists_ingest(timestamptz) to service_role;
comment on function public.perf_p95_lists_ingest(timestamptz) is
  '#422: dzienny p95 list + wiersz równoczesności „brak pomiaru”; service_role / cron.';

-- Cron dzienny (gdy pg_cron dostępny).
do $cron$
begin
  if to_regclass('cron.job') is not null
     and to_regprocedure('cron.schedule(text,text,text)') is not null then
    perform cron.unschedule(jobid) from cron.job where jobname = 'tower-perf-p95';
    perform cron.schedule(
      'tower-perf-p95',
      '20 3 * * *',
      $c$select public.perf_p95_lists_ingest()$c$
    );
  else
    raise notice '0283: brak pg_cron — pomijam harmonogram tower-perf-p95';
  end if;
end $cron$;

-- Błędy aplikacji: 7 dni, grupowanie po komunikacie (HHL).
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
begin
  if (public.is_hhl()) is not true then
    raise exception 'Błędy aplikacji — tylko HHL' using errcode = '42501';
  end if;
  v_days := greatest(1, least(coalesce(p_days, 7), 30));
  v_since := now() - make_interval(days => v_days);

  select coalesce(jsonb_agg(
           jsonb_build_object(
             'id', g.fingerprint,
             'message', g.message,
             'where', coalesce(g.path, '—'),
             'people', g.people,
             'count', g.hits,
             'builds', g.builds,
             'firstAt', g.first_seen_at,
             'lastAt', g.last_seen_at,
             'state', 'watch',
             'stack', left(g.stack, 500)
           )
           order by g.hits desc, g.last_seen_at desc
         ), '[]'::jsonb),
         coalesce(sum(g.hits), 0)::int
    into v_groups, v_total
    from (
      select fingerprint,
             max(message) as message,
             max(path) as path,
             max(stack) as stack,
             count(distinct user_id) filter (where user_id is not null)::int as people,
             sum(hits)::int as hits,
             count(distinct nullif(build, ''))::int as builds,
             min(first_seen_at) as first_seen_at,
             max(last_seen_at) as last_seen_at
        from public.client_errors
       where last_seen_at >= v_since
       group by fingerprint
       order by sum(hits) desc, max(last_seen_at) desc
       limit 100
    ) g;

  return jsonb_build_object(
    'groups', v_groups,
    'total7d', v_total,
    'newSince', null,
    'newCount', 0,
    'days', v_days
  );
end $$;

revoke all on function public.app_errors_recent(int) from public, anon;
grant execute on function public.app_errors_recent(int) to authenticated;
comment on function public.app_errors_recent(int) is
  '#422 E47: błędy client_errors z 7 dni (grupowanie); tylko HHL.';

-- Wiersz startowy równoczesności (brak testu obciążenia).
do $seed$
begin
  if not exists (select 1 from public.perf_results where metric_id = 'p5') then
    insert into public.perf_results (metric_id, what, how, result_text, limit_text, ok, source)
    values (
      'p5',
      'Równoczesność',
      '20 sesji przez 10 min',
      'brak pomiaru',
      '0 błędów',
      null,
      'loadtest:brak'
    );
  end if;
end $seed$;
