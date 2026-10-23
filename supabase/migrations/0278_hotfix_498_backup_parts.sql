-- =====================================================================
-- TOWER — Migracja 0278: #498 — kopia w częściach + postęp I-33 (10 min)
--   Duże tabele (integration_runs ~70k) kończyły Edge (CPU / I-33 30 min).
--   progress / progress_at / parts na backup_runs; strażnik: brak postępu 10 min;
--   cron tower-backup-continue co 1 min (samowywołanie continue_run).
--   Idempotentna.
-- =====================================================================

alter table public.backup_runs
  add column if not exists progress jsonb,
  add column if not exists progress_at timestamptz,
  add column if not exists parts jsonb;

comment on column public.backup_runs.progress is
  '#498: stan niedokończonej tabeli {table, after_ctid, next_part, n0, rows_so_far, parts[]}';
comment on column public.backup_runs.progress_at is
  '#498: ostatni postęp (część / tabela); I-33 liczy od tego, nie od started_at';
comment on column public.backup_runs.parts is
  '#498: ukończone części do manifestu { tabela: [{part, rows, key}, ...] }';

-- I-33: brak postępu > 10 min (nie 30 min od startu całego przebiegu).
create or replace function public.backup_stale_watchdog(
  p_now timestamptz default now(),
  p_stale interval default interval '10 minutes'
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_n int := 0;
  v_ids bigint[] := '{}';
  v_new int := 0;
  v_proj record;
  v_key text;
  v_title text;
  v_detail jsonb;
  v_mail text := 'BEZ_ZMIAN';
  v_url text; v_from text; v_to text;
  v_err text;
  v_anchor timestamptz;
begin
  if (p_stale is null) is not true and (p_stale > interval '0') is not true then
    raise exception 'backup_stale_watchdog: p_stale musi być > 0';
  end if;

  for r in
    select id, started_at, progress_at, bytes, tables, progress
      from backup_runs
     where status = 'RUNNING'
       and coalesce(progress_at, started_at) < p_now - p_stale
     order by started_at
     for update
  loop
    v_anchor := coalesce(r.progress_at, r.started_at);
    v_err := 'przerwany: brak postępu w ' || p_stale::text
          || ' (strażnik I-33; ostatni postęp '
          || to_char(v_anchor at time zone 'UTC', 'YYYY-MM-DD HH24:MI UTC')
          || ')';
    update backup_runs
       set status = 'ERROR',
           finished_at = p_now,
           error = case
             when error is null or btrim(error) = '' then v_err
             else error || ' · ' || v_err
           end
     where id = r.id;
    v_n := v_n + 1;
    v_ids := array_append(v_ids, r.id);

    v_title := 'Kopia zapasowa bez postępu (> 10 min)';
    v_detail := jsonb_build_object(
      'job', 'backup',
      'run_id', r.id,
      'started_at', r.started_at,
      'progress_at', r.progress_at,
      'stale', p_stale::text,
      'bytes', r.bytes,
      'tables', coalesce(r.tables, '{}'::jsonb),
      'progress', coalesce(r.progress, '{}'::jsonb),
      'text', 'Przebieg kopii id=' || r.id
           || ' bez postępu dłużej niż ' || p_stale::text
           || '. Oznaczono ERROR. Sprawdź Edge backup-export i Worker R2.',
      'next_action', 'Sprawdź backup_runs, logi funkcji Edge backup-export i Worker tower-backup-writer; uruchom ponownie kopię po naprawie.',
      'params', jsonb_build_object(
        'label', 'kopia zapasowa (backup-export)',
        'label_key', 'job_label_backup_stale',
        'run_id', r.id::text,
        'window', p_stale::text
      ),
      'text_key', 'rk_backup_stale_text',
      'next_action_key', 'rk_backup_stale_next'
    );
    for v_proj in select id from projects loop
      v_key := 'backup-stale:' || r.id || ':' || v_proj.id;
      if not exists (select 1 from risk_signals where dedup_key = v_key and resolved_at is null) then
        insert into risk_signals (project_id, kind, severity, title, title_key, detail, dedup_key, detected_at)
        values (v_proj.id, 'JOB_FAILURE', 'HIGH', v_title, 'rk_job_failure', v_detail, v_key, p_now);
        v_new := v_new + 1;
      end if;
    end loop;
  end loop;

  if v_new > 0 then
    v_mail := 'BRAK_SEKRETOW';
    if to_regclass('vault.decrypted_secrets') is not null
       and to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is not null then
      execute $q$select max(decrypted_secret) filter (where name = 'resend_api_key'),
                        max(decrypted_secret) filter (where name = 'mail_from'),
                        max(decrypted_secret) filter (where name = 'alert_email_to')
                   from vault.decrypted_secrets$q$ into v_url, v_from, v_to;
      if v_url is not null and v_from is not null and v_to is not null then
        execute $q$select net.http_post(
                   url := 'https://api.resend.com/emails',
                   headers := jsonb_build_object('Authorization', 'Bearer ' || $1, 'Content-Type', 'application/json'),
                   body := jsonb_build_object(
                     'from', $2,
                     'to', to_jsonb(string_to_array($3, ',')),
                     'subject', '[Watch Tower] ALARM: ' || $4,
                     'text', $4 || E'\n' || ($5->>'text') || E'\nCo zrobić: ' || ($5->>'next_action')))$q$
          using v_url, v_from, v_to, v_title, v_detail;
        v_mail := 'WYSLANY_DO_KOLEJKI';
      end if;
    end if;
  end if;

  return jsonb_build_object(
    'przerwane', v_n,
    'run_ids', to_jsonb(v_ids),
    'nowe_ryzyka', v_new,
    'email', v_mail
  );
end;
$$;

comment on function public.backup_stale_watchdog(timestamptz, interval) is
  '#498 / I-33: RUNNING bez postępu (progress_at|started_at) > 10 min → ERROR + JOB_FAILURE';

revoke all on function public.backup_stale_watchdog(timestamptz, interval) from public, anon, authenticated;

-- Automatyczne continue_run dla RUNNING (gdy waitUntil Edge padnie).
create or replace function public.backup_continue_pending()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_url text;
  v_key text;
  v_n int := 0;
  v_req bigint;
  v_ids bigint[] := '{}';
begin
  if to_regnamespace('net') is null or to_regnamespace('vault') is null then
    return jsonb_build_object('continued', 0, 'error', 'missing_net_or_vault');
  end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'service_role_key';
  if v_url is null or v_key is null or length(v_url) = 0 or length(v_key) = 0 then
    return jsonb_build_object('continued', 0, 'error', 'missing_vault');
  end if;

  for r in
    select id from backup_runs
     where status = 'RUNNING'
       and prefix is not null
     order by started_at
     limit 3
  loop
    select net.http_post(
      url := rtrim(v_url, '/') || '/functions/v1/backup-export',
      body := jsonb_build_object('continue_run', r.id),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_key,
        'apikey', v_key
      ),
      timeout_milliseconds := 120000
    ) into v_req;
    v_n := v_n + 1;
    v_ids := array_append(v_ids, r.id);
  end loop;

  return jsonb_build_object('continued', v_n, 'ids', to_jsonb(v_ids));
exception when others then
  return jsonb_build_object('continued', v_n, 'error', 'http_post_failed');
end;
$$;

comment on function public.backup_continue_pending() is
  '#498: co 1 min woła backup-export {continue_run} dla RUNNING — bez ręcznej pomocy';
revoke all on function public.backup_continue_pending() from public, anon, authenticated;

do $cron$
begin
  if to_regnamespace('cron') is null then
    raise notice '0278: brak pg_cron — pomijam tower-backup-continue';
    return;
  end if;
  perform cron.unschedule(jobid) from cron.job where jobname = 'tower-backup-continue';
  perform cron.schedule(
    'tower-backup-continue',
    '* * * * *',
    $job$select public.backup_continue_pending()$job$
  );
end;
$cron$;
