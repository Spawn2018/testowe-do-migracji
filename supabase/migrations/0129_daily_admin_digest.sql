-- TOWER — Migracja 0129: DAILY-1 — codzienny e-mail 07:00 PL tylko do administratora
-- (kopie, integracje, bramka SMS, błędy z ostatniej doby).
-- Wysyłka Resend przez pg_net + Vault (jak job_watchdog). Bez EXECUTE dla ról API.

create or replace function public.daily_admin_digest(p_now timestamptz default now())
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_since timestamptz := p_now - interval '24 hours';
  v_backup_ok int;
  v_backup_err int;
  v_backup_last timestamptz;
  v_int_fail int;
  v_int_jobs text;
  v_sms_queued int;
  v_sms_failed int;
  v_sms_hb timestamptz;
  v_err_hits int;
  v_err_distinct int;
  v_body text;
  v_subj text;
  v_key text;
  v_from text;
  v_to text;
  v_mail text := 'BRAK_SEKRETOW';
begin
  select
    count(*) filter (where status = 'OK'),
    count(*) filter (where status in ('ERROR', 'FAILED')),
    max(finished_at) filter (where status = 'OK')
  into v_backup_ok, v_backup_err, v_backup_last
  from backup_runs
  where started_at >= v_since;

  select count(*) into v_int_fail
  from integration_runs
  where ran_at >= v_since and ok is not true;

  select string_agg(distinct job, ', ' order by job) into v_int_jobs
  from integration_runs
  where ran_at >= v_since and ok is not true;

  select
    count(*) filter (where status = 'QUEUED'),
    count(*) filter (where status = 'FAILED')
  into v_sms_queued, v_sms_failed
  from sms_outbox
  where created_at >= v_since;

  select max(at) into v_sms_hb from sms_heartbeats;

  select coalesce(sum(hits), 0), count(*)
  into v_err_hits, v_err_distinct
  from client_errors
  where last_seen_at >= v_since;

  v_subj := '[Watch Tower] Raport dzienny '
    || to_char(p_now at time zone 'Europe/Warsaw', 'DD.MM.YYYY');

  v_body := 'Raport z ostatnich 24 h (czas PL).' || E'\n\n'
    || 'KOPIE:' || E'\n'
    || '  OK: ' || coalesce(v_backup_ok, 0)::text
    || '  ERROR: ' || coalesce(v_backup_err, 0)::text
    || '  ostatni OK: ' || coalesce(to_char(v_backup_last at time zone 'Europe/Warsaw', 'DD.MM.YYYY HH24:MI'), 'brak')
    || E'\n\n'
    || 'INTEGRACJE (nieudane przebiegi): ' || coalesce(v_int_fail, 0)::text
    || case when v_int_jobs is not null then ' (' || v_int_jobs || ')' else '' end
    || E'\n\n'
    || 'BRAMKA SMS:' || E'\n'
    || '  kolejka QUEUED: ' || coalesce(v_sms_queued, 0)::text
    || '  FAILED: ' || coalesce(v_sms_failed, 0)::text
    || '  ostatni heartbeat: ' || coalesce(to_char(v_sms_hb at time zone 'Europe/Warsaw', 'DD.MM.YYYY HH24:MI'), 'brak')
    || E'\n\n'
    || 'BLEDY PRZEGLADARKI: ' || coalesce(v_err_distinct, 0)::text
    || ' typow / ' || coalesce(v_err_hits, 0)::text || ' trafien'
    || E'\n\n'
    || 'Watch Tower — automatyczny raport (DAILY-1).';

  if to_regclass('vault.decrypted_secrets') is not null
     and to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is not null then
    execute $q$select max(decrypted_secret) filter (where name = 'resend_api_key'),
                      max(decrypted_secret) filter (where name = 'mail_from'),
                      max(decrypted_secret) filter (where name = 'alert_email_to')
                 from vault.decrypted_secrets$q$ into v_key, v_from, v_to;
    if v_key is not null and v_from is not null and v_to is not null then
      execute $q$select net.http_post(
        url := 'https://api.resend.com/emails',
        headers := jsonb_build_object('Authorization', 'Bearer ' || $1, 'Content-Type', 'application/json'),
        body := jsonb_build_object(
          'from', $2,
          'to', to_jsonb(string_to_array($3, ',')),
          'subject', $4,
          'text', $5
        )
      )$q$ using v_key, v_from, v_to, v_subj, v_body;
      v_mail := 'WYSLANY_DO_KOLEJKI';
    end if;
  end if;

  insert into integration_runs (job, ran_at, ok, result)
  values (
    'daily-admin-digest',
    p_now,
    (v_mail = 'WYSLANY_DO_KOLEJKI'),
    jsonb_build_object(
      'email', v_mail,
      'backup_ok', coalesce(v_backup_ok, 0),
      'backup_err', coalesce(v_backup_err, 0),
      'integration_fail', coalesce(v_int_fail, 0),
      'sms_queued', coalesce(v_sms_queued, 0),
      'sms_failed', coalesce(v_sms_failed, 0),
      'client_error_types', coalesce(v_err_distinct, 0)
    )
  );

  return jsonb_build_object(
    'email', v_mail,
    'subject', v_subj,
    'backup_ok', coalesce(v_backup_ok, 0),
    'backup_err', coalesce(v_backup_err, 0),
    'integration_fail', coalesce(v_int_fail, 0),
    'sms_queued', coalesce(v_sms_queued, 0),
    'sms_failed', coalesce(v_sms_failed, 0),
    'client_error_types', coalesce(v_err_distinct, 0)
  );
end;
$$;

revoke all on function public.daily_admin_digest(timestamptz) from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'tower-daily-admin-digest';
    perform cron.schedule(
      'tower-daily-admin-digest',
      '0 5 * * *',
      'select public.daily_admin_digest()'
    );
  end if;
exception when others then
  raise notice '0129 cron: %', sqlerrm;
end $$;
