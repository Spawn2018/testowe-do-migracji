-- TOWER — Migracja 0203: P3 E19-4 — dzienny zapis doradcy „security” i stanu przełączników.
-- Kafelek Stanu systemu (P10b) czyta security_advisor_snapshot_latest().

create table if not exists public.security_advisor_snapshots (
  id          bigserial primary key,
  captured_at timestamptz not null default now(),
  source      text not null default 'cron',
  findings    jsonb not null default '[]'::jsonb,
  flags       jsonb not null default '{}'::jsonb,
  meta        jsonb not null default '{}'::jsonb,
  check (source in ('cron', 'gate', 'manual', 'edge'))
);

alter table public.security_advisor_snapshots enable row level security;
revoke all on public.security_advisor_snapshots from anon, authenticated;
revoke all on sequence public.security_advisor_snapshots_id_seq from anon, authenticated;

comment on table public.security_advisor_snapshots is
  'E19-4: wynik doradcy security + security_flags; kafelek Bezpieczeństwo (P10b).';

create or replace function public.security_advisor_snapshot_capture(
  p_findings jsonb default '[]'::jsonb,
  p_source text default 'cron',
  p_meta jsonb default '{}'::jsonb
) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_id bigint;
  v_flags jsonb;
  v_src text := coalesce(nullif(trim(p_source), ''), 'cron');
begin
  if (v_src in ('cron', 'gate', 'manual', 'edge')) is not true then
    raise exception 'Nieznane źródło migawki doradcy' using errcode = '22023';
  end if;

  select coalesce(jsonb_object_agg(key, jsonb_build_object(
           'enabled', enabled,
           'note', note,
           'updated_at', updated_at
         )), '{}'::jsonb)
    into v_flags
    from security_flags;

  insert into security_advisor_snapshots (source, findings, flags, meta)
  values (
    v_src,
    coalesce(p_findings, '[]'::jsonb),
    v_flags,
    coalesce(p_meta, '{}'::jsonb) || jsonb_build_object('flag_count', (select count(*)::int from security_flags))
  )
  returning id into v_id;

  insert into integration_runs (job, ran_at, ok, result)
  values (
    'security-advisor-snapshot',
    now(),
    true,
    jsonb_build_object(
      'snapshot_id', v_id,
      'source', v_src,
      'findings', jsonb_array_length(coalesce(p_findings, '[]'::jsonb)),
      'flags', (select count(*)::int from security_flags)
    )
  );

  return v_id;
end $$;

revoke all on function public.security_advisor_snapshot_capture(jsonb, text, jsonb) from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.security_advisor_snapshot_capture(jsonb, text, jsonb) to service_role;
  end if;
end $$;

create or replace function public.security_advisor_snapshot_set_findings(
  p_id bigint,
  p_findings jsonb,
  p_meta jsonb default '{}'::jsonb
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if (p_id is not null) is not true then
    raise exception 'Brak id migawki doradcy' using errcode = '22023';
  end if;
  update security_advisor_snapshots
     set findings = coalesce(p_findings, '[]'::jsonb),
         meta = coalesce(meta, '{}'::jsonb) || coalesce(p_meta, '{}'::jsonb),
         source = case when source = 'cron' then 'edge' else source end
   where id = p_id;
  if not found then
    raise exception 'Nieznana migawka doradcy' using errcode = 'P0002';
  end if;
end $$;

revoke all on function public.security_advisor_snapshot_set_findings(bigint, jsonb, jsonb)
  from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.security_advisor_snapshot_set_findings(bigint, jsonb, jsonb) to service_role;
  end if;
end $$;

create or replace function public.security_advisor_snapshot_latest()
returns table (
  id bigint,
  captured_at timestamptz,
  source text,
  findings jsonb,
  flags jsonb,
  meta jsonb
)
language plpgsql security definer set search_path = public as $$
declare
  v_role text;
begin
  select role::text into v_role from app_users where auth_id = auth.uid() and active;
  if (v_role = 'HHL_ADMIN') is not true then
    raise exception 'Migawka doradcy — wyłącznie administrator HHL' using errcode = '42501';
  end if;

  return query
  select s.id, s.captured_at, s.source, s.findings, s.flags, s.meta
    from security_advisor_snapshots s
   order by s.captured_at desc, s.id desc
   limit 1;
end $$;

revoke all on function public.security_advisor_snapshot_latest() from public, anon;
grant execute on function public.security_advisor_snapshot_latest() to authenticated;

-- Cron: najpierw zapis flag; Edge uzupełnia findings gdy jest token zarządzania.
create or replace function public.security_advisor_snapshot_tick()
returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_id bigint;
  v_url text;
  v_key text;
begin
  v_id := public.security_advisor_snapshot_capture('[]'::jsonb, 'cron', jsonb_build_object('phase', 'flags'));

  if to_regclass('vault.decrypted_secrets') is not null
     and to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is not null then
    execute $q$select max(decrypted_secret) filter (where name = 'project_url'),
                      max(decrypted_secret) filter (where name = 'service_role_key')
                 from vault.decrypted_secrets$q$ into v_url, v_key;
    if v_url is not null and v_key is not null then
      perform net.http_post(
        url := rtrim(v_url, '/') || '/functions/v1/security-advisor-snapshot',
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || v_key,
          'Content-Type', 'application/json'
        ),
        body := jsonb_build_object('snapshot_id', v_id)
      );
    end if;
  end if;

  return v_id;
end $$;

revoke all on function public.security_advisor_snapshot_tick() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'tower-security-advisor';
    perform cron.schedule(
      'tower-security-advisor',
      '20 4 * * *',
      'select public.security_advisor_snapshot_tick()'
    );
  end if;
exception when others then
  raise notice '0203 cron: %', sqlerrm;
end $$;
