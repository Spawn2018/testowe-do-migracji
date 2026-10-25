-- A6 · SharePoint: stan synchronizacji + cron Edge ksh-sharepoint-sync (co 5 min)
-- Zapis do pliku: write_enabled domyślnie false (produkcja po akceptacji właściciela).
-- Import z pliku: import_enabled domyślnie false (F7 #556 — najpierw dry_run / podgląd).
-- Projekt: stały kod STEGRA_BODEN (nie order by id limit 1).
begin;

-- ---------------------------------------------------------------------
-- 1. Stan synchronizacji (jedna witryna / projekt KSH–Stegra)
-- ---------------------------------------------------------------------
create table if not exists public.ksh_sync_state (
  project_id uuid primary key references public.projects (id) on delete cascade,
  last_read_at timestamptz,
  last_write_at timestamptz,
  write_enabled boolean not null default false,
  import_enabled boolean not null default false,
  source_ok boolean not null default false,
  -- Data ważności sekretu — wpis po wdrożeniu; w publicznym repo bez prawdziwej daty (F7).
  secret_expires_on date default null,
  last_run jsonb,
  last_error text,
  -- Migawka HH: kod → skrót pól dat/godzin (konflikt zapisu); bez danych osobowych.
  snapshot jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Idempotentnie gdy tabela powstała ze starszej wersji 0304 w gałęzi.
alter table public.ksh_sync_state
  add column if not exists import_enabled boolean not null default false;
alter table public.ksh_sync_state
  alter column secret_expires_on drop not null;
alter table public.ksh_sync_state
  alter column secret_expires_on set default null;

comment on table public.ksh_sync_state is
  'A6 E38: stan odczytu/zapisu pliku KSH (SharePoint). last_run = liczby+hash; snapshot bez PII.';
comment on column public.ksh_sync_state.import_enabled is
  'A6 F7: false = Edge tylko dry_run (podgląd zmian); true = import_schedule z zapisem.';

alter table public.ksh_sync_state enable row level security;

revoke all on table public.ksh_sync_state from public, anon;
grant select on table public.ksh_sync_state to authenticated;
-- Zapis tylko service_role / SECURITY DEFINER (Edge + RPC admin).
grant select, insert, update on table public.ksh_sync_state to service_role;

drop policy if exists ksh_sync_state_hhl_read on public.ksh_sync_state;
create policy ksh_sync_state_hhl_read on public.ksh_sync_state
  for select to authenticated
  using (public.is_hhl() is true);

-- Wiersz startowy: produkcja STEGRA_BODEN; seed/CI czasem STEGRA (ten sam projekt).
insert into public.ksh_sync_state (project_id)
select p.id from public.projects p
where p.code in ('STEGRA_BODEN', 'STEGRA')
order by case p.code when 'STEGRA_BODEN' then 0 else 1 end
limit 1
on conflict (project_id) do nothing;

-- ---------------------------------------------------------------------
-- 2. Odczyt dla frontu (kształt kshSharePointSync)
-- ---------------------------------------------------------------------
create or replace function public.ksh_sync_state_get()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  r public.ksh_sync_state%rowtype;
  v_pid uuid;
begin
  if public.is_hhl() is not true then
    return null;
  end if;
  select id into v_pid from public.projects
   where code in ('STEGRA_BODEN', 'STEGRA')
   order by case code when 'STEGRA_BODEN' then 0 else 1 end
   limit 1;
  if v_pid is not null then
    select * into r from public.ksh_sync_state where project_id = v_pid;
  end if;
  -- F7 #556: bez fallbacku „ostatni wiersz bez filtra projektu”.
  if r.project_id is null then
    return null;
  end if;
  return jsonb_build_object(
    'lastReadAt', r.last_read_at,
    'lastWriteAt', r.last_write_at,
    'writeEnabled', r.write_enabled,
    'importEnabled', r.import_enabled,
    'sourceOk', r.source_ok,
    'secretExpiresOn', r.secret_expires_on,
    'lastRun', r.last_run
  );
end;
$$;

revoke all on function public.ksh_sync_state_get() from public, anon;
grant execute on function public.ksh_sync_state_get() to authenticated;

comment on function public.ksh_sync_state_get() is
  'A6: stan SharePoint dla HHL (pole kshSharePointSync); inni → null.';

-- Przełącznik zapisu WT→plik (tylko HHL_ADMIN + 2FA)
create or replace function public.ksh_sync_write_set(p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid;
  v_role public.user_role;
  v_pid uuid;
begin
  perform public.assert_not_preview();
  select id, role into v_me, v_role
    from public.app_users
   where auth_id = auth.uid() and active;
  if (v_me is not null and v_role = 'HHL_ADMIN' and public.mfa_satisfied(v_role) is true) is not true then
    raise exception 'Tylko Administrator HHL z 2FA' using errcode = '42501';
  end if;
  select id into v_pid from public.projects
   where code in ('STEGRA_BODEN', 'STEGRA')
   order by case code when 'STEGRA_BODEN' then 0 else 1 end
   limit 1;
  if v_pid is null then
    raise exception 'Brak projektu KSH (STEGRA_BODEN)' using errcode = 'P0002';
  end if;
  insert into public.ksh_sync_state (project_id, write_enabled)
  values (v_pid, coalesce(p_enabled, false))
  on conflict (project_id) do update
    set write_enabled = excluded.write_enabled, updated_at = now();
  insert into public.audit_log (user_id, action, entity, entity_id, new_value)
  values (
    v_me, 'KSH_SYNC_WRITE_SET', 'ksh_sync_state', v_pid::text,
    jsonb_build_object('write_enabled', coalesce(p_enabled, false))
  );
end;
$$;

revoke all on function public.ksh_sync_write_set(boolean) from public, anon;
grant execute on function public.ksh_sync_write_set(boolean) to authenticated;

comment on function public.ksh_sync_write_set(boolean) is
  'A6: przełącznik zapisu WT→plik (domyślnie wyłączony); tylko HHL_ADMIN + 2FA.';

-- Przełącznik importu z pliku (F7 #556 — domyślnie wyłączony = tylko dry_run)
create or replace function public.ksh_sync_import_set(p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid;
  v_role public.user_role;
  v_pid uuid;
begin
  perform public.assert_not_preview();
  select id, role into v_me, v_role
    from public.app_users
   where auth_id = auth.uid() and active;
  if (v_me is not null and v_role = 'HHL_ADMIN' and public.mfa_satisfied(v_role) is true) is not true then
    raise exception 'Tylko Administrator HHL z 2FA' using errcode = '42501';
  end if;
  select id into v_pid from public.projects
   where code in ('STEGRA_BODEN', 'STEGRA')
   order by case code when 'STEGRA_BODEN' then 0 else 1 end
   limit 1;
  if v_pid is null then
    raise exception 'Brak projektu KSH (STEGRA_BODEN)' using errcode = 'P0002';
  end if;
  insert into public.ksh_sync_state (project_id, import_enabled)
  values (v_pid, coalesce(p_enabled, false))
  on conflict (project_id) do update
    set import_enabled = excluded.import_enabled, updated_at = now();
  insert into public.audit_log (user_id, action, entity, entity_id, new_value)
  values (
    v_me, 'KSH_SYNC_IMPORT_SET', 'ksh_sync_state', v_pid::text,
    jsonb_build_object('import_enabled', coalesce(p_enabled, false))
  );
end;
$$;

revoke all on function public.ksh_sync_import_set(boolean) from public, anon;
grant execute on function public.ksh_sync_import_set(boolean) to authenticated;

comment on function public.ksh_sync_import_set(boolean) is
  'A6 F7: przełącznik importu SharePoint→WT (domyślnie wyłączony = dry_run); tylko HHL_ADMIN + 2FA.';

-- ---------------------------------------------------------------------
-- 3. Zapis stanu z Edge (service_role)
-- ---------------------------------------------------------------------
create or replace function public.ksh_sync_state_upsert(
  p_project uuid,
  p_source_ok boolean,
  p_last_read_at timestamptz default null,
  p_last_write_at timestamptz default null,
  p_last_run jsonb default null,
  p_last_error text default null,
  p_snapshot jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_jwt_role text;
begin
  if session_user not in ('postgres', 'supabase_admin') then
    if to_regprocedure('auth.role()') is not null then
      execute 'select auth.role()' into v_jwt_role;
    end if;
    if (coalesce(v_jwt_role, '') = 'service_role') is not true then
      raise exception 'ksh_sync_state_upsert — tylko Edge (service_role)' using errcode = '42501';
    end if;
  end if;
  if p_project is null then
    raise exception 'project wymagany' using errcode = '22023';
  end if;
  insert into public.ksh_sync_state as s (
    project_id, source_ok, last_read_at, last_write_at, last_run, last_error, snapshot, updated_at
  ) values (
    p_project,
    coalesce(p_source_ok, false),
    p_last_read_at,
    p_last_write_at,
    p_last_run,
    left(p_last_error, 500),
    coalesce(p_snapshot, '{}'::jsonb),
    now()
  )
  on conflict (project_id) do update set
    source_ok = excluded.source_ok,
    last_read_at = coalesce(excluded.last_read_at, s.last_read_at),
    last_write_at = coalesce(excluded.last_write_at, s.last_write_at),
    last_run = coalesce(excluded.last_run, s.last_run),
    last_error = excluded.last_error,
    snapshot = case
      when p_snapshot is null then s.snapshot
      else excluded.snapshot
    end,
    updated_at = now();
end;
$$;

revoke all on function public.ksh_sync_state_upsert(uuid, boolean, timestamptz, timestamptz, jsonb, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.ksh_sync_state_upsert(uuid, boolean, timestamptz, timestamptz, jsonb, text, jsonb)
  to service_role;

comment on function public.ksh_sync_state_upsert(uuid, boolean, timestamptz, timestamptz, jsonb, text, jsonb) is
  'A6: Edge zapisuje wynik przebiegu sync (bez PII w last_error dłużej niż 500 znaków).';

-- ---------------------------------------------------------------------
-- 4. Cron co 5 min → Edge ksh-sharepoint-sync
-- ---------------------------------------------------------------------
do $m$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron')
     and exists (select 1 from pg_extension where extname = 'pg_net') then

    perform cron.unschedule(jobid) from cron.job where jobname = 'tower-ksh-sharepoint';
    perform cron.schedule('tower-ksh-sharepoint', '*/5 * * * *', $c$
      select net.http_post(
        url     := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
                   || '/functions/v1/ksh-sharepoint-sync',
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
          'Content-Type', 'application/json'),
        body    := '{}'::jsonb,
        timeout_milliseconds := 120000)
    $c$);

  else
    raise notice '0304: pg_cron lub pg_net niedostępne — cron tower-ksh-sharepoint do zaplanowania ręcznie';
  end if;
end
$m$;

commit;
