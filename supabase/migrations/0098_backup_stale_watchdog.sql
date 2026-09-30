-- =====================================================================
-- TOWER — Migracja 0098: I-33 — strażnik zawieszonej kopii zapasowej.
--   Problem 29.09: backup_runs id=10 status RUNNING od 00:30 UTC, finished_at puste
--   przez ~24 h (Edge/Worker urwał się w trakcie COPY; postęp: 12 tabel, 8062 B).
--   backup_run_begin() oznacza stale RUNNING → ERROR dopiero przy NASTĘPNYM starcie
--   (noc 30.09). Do tego czasu zero alarmu.
--   Rozwiązanie: backup_stale_watchdog() co 5 min — RUNNING > 30 min → ERROR +
--   ryzyko JOB_FAILURE HHL + e-mail (Vault/Resend, jak job_watchdog). Dedup po
--   run_id. Po udanej kopii ryzyko zamyka job_watchdog (detail.job = backup).
--   Idempotentna.
-- =====================================================================

create or replace function public.backup_stale_watchdog(
  p_now timestamptz default now(),
  p_stale interval default interval '30 minutes'
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
begin
  if (p_stale is null) is not true and (p_stale > interval '0') is not true then
    raise exception 'backup_stale_watchdog: p_stale musi być > 0';
  end if;

  for r in
    select id, started_at, bytes, tables
      from backup_runs
     where status = 'RUNNING'
       and started_at < p_now - p_stale
     order by started_at
     for update
  loop
    v_err := 'przerwany: brak zakończenia w ' || p_stale::text
          || ' (strażnik I-33; start '
          || to_char(r.started_at at time zone 'UTC', 'YYYY-MM-DD HH24:MI UTC')
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

    v_title := 'Kopia zapasowa zawieszona (RUNNING > 30 min)';
    v_detail := jsonb_build_object(
      'job', 'backup',
      'run_id', r.id,
      'started_at', r.started_at,
      'stale', p_stale::text,
      'bytes', r.bytes,
      'tables', coalesce(r.tables, '{}'::jsonb),
      'text', 'Przebieg kopii id=' || r.id
           || ' trwa dłużej niż ' || p_stale::text
           || ' bez finished_at. Oznaczono ERROR. Sprawdź Edge backup-export i Worker R2.',
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

revoke all on function public.backup_stale_watchdog(timestamptz, interval) from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'tower-backup-stale';
    perform cron.schedule(
      'tower-backup-stale',
      '*/5 * * * *',
      'select public.backup_stale_watchdog()'
    );
  end if;
end $$;
