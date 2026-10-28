-- #588 / brama bezpieczeństwa 28.10: cron nie zapisuje „Brak pomiaru” przed Edge.
-- Przyczyna: security_advisor_snapshot_tick → capture(phase=flags, bez advisor_ok)
-- → v_ok=false → integration_runs ok=false „Brak pomiaru”, choć Edge po chwili
-- uzupełnia findings (security-advisor-snapshot-edge ok=true). Stan systemu pokazuje
-- fałszywy brak pomiaru codziennie od ~18.10.
--
-- Fix: phase=flags = tylko szkielet migawki (bez integration_runs);
--      set_findings dopisuje wynik zadania security-advisor-snapshot z advisor_ok.
-- F7 r1: domknięcie szkieletów bez Edge; tick przy braku sekretów; watchdog 26 h;
--      idempotencja set_findings; source z wiersza; advisor_error → result.error.

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
  v_ok boolean := case
    when lower(coalesce(p_meta ->> 'advisor_ok', '')) in ('t', 'true', '1', 'yes', 'y') then true
    else false
  end;
  v_phase text := nullif(trim(coalesce(p_meta ->> 'phase', '')), '');
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

  -- Szkielet crona (phase=flags): bez wpisu bieżącego — wynik po set_findings / Edge.
  -- Domknij poprzednie nieuzupełnione szkielety (cisza gdy Edge nie doszedł).
  if v_phase = 'flags' then
    insert into integration_runs (job, ran_at, ok, result)
    select 'security-advisor-snapshot', now(), false,
           jsonb_build_object(
             'snapshot_id', s.id,
             'source', 'cron',
             'advisor_ok', false,
             'detail', 'Brak pomiaru: Edge nie uzupełnił migawki'
           )
      from security_advisor_snapshots s
     where s.source = 'cron'
       and s.meta->>'phase' = 'flags'
       and s.id <> v_id
       and s.captured_at > now() - interval '48 hours'
       and not exists (
         select 1 from integration_runs r
          where r.job = 'security-advisor-snapshot'
            and r.result->>'snapshot_id' = s.id::text
       );
    return v_id;
  end if;

  insert into integration_runs (job, ran_at, ok, result)
  values (
    'security-advisor-snapshot',
    now(),
    v_ok,
    jsonb_build_object(
      'snapshot_id', v_id,
      'source', v_src,
      'findings', jsonb_array_length(coalesce(p_findings, '[]'::jsonb)),
      'flags', (select count(*)::int from security_flags),
      'advisor_ok', v_ok,
      'detail', case when v_ok then 'doradca security' else 'Brak pomiaru' end
    )
  );

  return v_id;
end $$;

revoke all on function public.security_advisor_snapshot_capture(jsonb, text, jsonb)
  from public, anon, authenticated;
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
declare
  v_ok boolean := case
    when lower(coalesce(p_meta ->> 'advisor_ok', '')) in ('t', 'true', '1', 'yes', 'y') then true
    else false
  end;
  v_n int := jsonb_array_length(coalesce(p_findings, '[]'::jsonb));
  v_flags int;
  v_src text;
  v_err text;
  v_result jsonb;
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

  select coalesce((meta ->> 'flag_count')::int, 0), source,
         nullif(trim(coalesce(meta ->> 'advisor_error', '')), '')
    into v_flags, v_src, v_err
    from security_advisor_snapshots
   where id = p_id;

  v_result := jsonb_build_object(
    'snapshot_id', p_id,
    'source', coalesce(v_src, 'edge'),
    'findings', v_n,
    'flags', v_flags,
    'advisor_ok', v_ok,
    'detail', case when v_ok then 'doradca security' else 'Brak pomiaru' end
  );
  if v_err is not null then
    v_result := v_result || jsonb_build_object('error', v_err);
  end if;

  -- D1: idempotencja przy retry; ewentualnie podnieś wcześniejsze ok=false (domknięcie crona).
  if exists (
    select 1 from integration_runs r
     where r.job = 'security-advisor-snapshot'
       and r.result->>'snapshot_id' = p_id::text
  ) then
    update integration_runs
       set ok = v_ok, ran_at = now(), result = v_result
     where job = 'security-advisor-snapshot'
       and result->>'snapshot_id' = p_id::text
       and ok is not true;
    return;
  end if;

  insert into integration_runs (job, ran_at, ok, result)
  values ('security-advisor-snapshot', now(), v_ok, v_result);
end $$;

revoke all on function public.security_advisor_snapshot_set_findings(bigint, jsonb, jsonb)
  from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.security_advisor_snapshot_set_findings(bigint, jsonb, jsonb) to service_role;
  end if;
end $$;

-- tick: brak sekretów / pg_net → od razu ok=false (bez ciszy).
create or replace function public.security_advisor_snapshot_tick()
returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_id bigint;
  v_url text;
  v_key text;
  v_flags int;
begin
  v_id := public.security_advisor_snapshot_capture('[]'::jsonb, 'cron', jsonb_build_object('phase', 'flags'));

  if to_regclass('vault.decrypted_secrets') is null
     or to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is null then
    select coalesce((meta ->> 'flag_count')::int, 0) into v_flags
      from security_advisor_snapshots where id = v_id;
    insert into integration_runs (job, ran_at, ok, result)
    select 'security-advisor-snapshot', now(), false,
           jsonb_build_object(
             'snapshot_id', v_id,
             'source', 'cron',
             'findings', 0,
             'flags', v_flags,
             'advisor_ok', false,
             'detail', 'Brak pomiaru: brak sekretów/pg_net'
           )
     where not exists (
       select 1 from integration_runs r
        where r.job = 'security-advisor-snapshot'
          and r.result->>'snapshot_id' = v_id::text
     );
    return v_id;
  end if;

  execute $q$select max(decrypted_secret) filter (where name = 'project_url'),
                    max(decrypted_secret) filter (where name = 'service_role_key')
               from vault.decrypted_secrets$q$ into v_url, v_key;

  if v_url is null or v_key is null then
    select coalesce((meta ->> 'flag_count')::int, 0) into v_flags
      from security_advisor_snapshots where id = v_id;
    insert into integration_runs (job, ran_at, ok, result)
    select 'security-advisor-snapshot', now(), false,
           jsonb_build_object(
             'snapshot_id', v_id,
             'source', 'cron',
             'findings', 0,
             'flags', v_flags,
             'advisor_ok', false,
             'detail', 'Brak pomiaru: brak sekretów/pg_net'
           )
     where not exists (
       select 1 from integration_runs r
        where r.job = 'security-advisor-snapshot'
          and r.result->>'snapshot_id' = v_id::text
     );
    return v_id;
  end if;

  perform net.http_post(
    url := rtrim(v_url, '/') || '/functions/v1/security-advisor-snapshot',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_key,
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object('snapshot_id', v_id)
  );

  return v_id;
end $$;

revoke all on function public.security_advisor_snapshot_tick() from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.security_advisor_snapshot_tick() to service_role;
  end if;
end $$;

-- job_watchdog: ostatnia wersja (0049) + security-advisor-snapshot 26 h.
-- 0300 nie wstrzykiwało assert_not_preview do tej funkcji (tylko service_role / cron).
create or replace function public.job_watchdog(p_now timestamp with time zone default now())
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  w record; v_last timestamptz; v_bad boolean; v_new int; v_out jsonb := '[]'::jsonb;
  v_key text; v_title text; v_detail jsonb; v_proj record; v_mail text; v_from text; v_to text; v_url text;
begin
  for w in select * from (values
      ('ferry-ais',   interval '30 minutes', timestamptz '2026-09-26 16:30+02', false, 'AIS promów (ferry-ais)'),
      ('usage-check', interval '26 hours',   timestamptz '2026-09-27 06:00+02', false, 'kontrola limitów (usage-check)'),
      ('send-notifications', interval '30 minutes', timestamptz '2026-09-26 17:00+02', false, 'wysyłka powiadomień e-mail (send-notifications)'),
      ('backup',      interval '26 hours',   null::timestamptz,                 true,  'kopia zapasowa (backup-export)'),
      ('security-advisor-snapshot', interval '26 hours', timestamptz '2026-10-18 04:20+02', false,
         'doradca security (security-advisor-snapshot)')
    ) as t(job, win, armed_from, arm_on_first_success, label)
  loop
    v_last := job_last_success(w.job);
    if w.arm_on_first_success and v_last is null then
      v_out := v_out || jsonb_build_object('job', w.job, 'stan', 'NIEUZBROJONY (brak pierwszej udanej kopii)');
      continue;
    end if;
    if w.armed_from is not null and p_now < w.armed_from + w.win and v_last is null then
      v_out := v_out || jsonb_build_object('job', w.job, 'stan', 'OKRES_STARTOWY');
      continue;
    end if;
    v_bad := v_last is null or v_last < p_now - w.win;
    if v_bad is false then
      update risk_signals set resolved_at = p_now where kind = 'JOB_FAILURE' and resolved_at is null
         and detail->>'job' = w.job;
      v_out := v_out || jsonb_build_object('job', w.job, 'stan', 'OK', 'ostatni_sukces', v_last);
      continue;
    end if;
    v_title := 'Zadanie systemowe bez udanego przebiegu: ' || w.label;
    v_detail := jsonb_build_object('job', w.job, 'okno', w.win::text, 'ostatni_sukces', v_last,
      'text', 'Brak udanego przebiegu od ' || coalesce(to_char(v_last at time zone 'Europe/Warsaw', 'DD.MM.YYYY HH24:MI'), 'początku')
              || ' (okno ' || w.win::text || ')',
      'next_action', 'Sprawdź integration_runs / backup_runs i net._http_response (kod odpowiedzi funkcji Edge)',
      'params', jsonb_build_object('label', w.label, 'label_key', 'job_label_' || replace(w.job, '-', '_'),
        'since', coalesce(to_char(v_last at time zone 'Europe/Warsaw', 'DD.MM.YYYY HH24:MI'), ''), 'window', w.win::text),
      'text_key', case when v_last is null then 'rk_job_failure_text_never' else 'rk_job_failure_text' end,
      'next_action_key', 'rk_job_failure_next');
    v_new := 0;
    for v_proj in select id from projects loop
      v_key := 'job:' || w.job || ':' || v_proj.id;
      if not exists (select 1 from risk_signals where dedup_key = v_key and resolved_at is null) then
        insert into risk_signals (project_id, kind, severity, title, title_key, detail, dedup_key, detected_at)
        values (v_proj.id, 'JOB_FAILURE', 'HIGH', v_title, 'rk_job_failure', v_detail, v_key, p_now);
        v_new := v_new + 1;
      end if;
    end loop;
    v_mail := 'BEZ_ZMIAN';
    if v_new > 0 then
      v_mail := 'BRAK_SEKRETOW';
      if to_regclass('vault.decrypted_secrets') is not null and to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is not null then
        execute $q$select max(decrypted_secret) filter (where name = 'resend_api_key'),
                          max(decrypted_secret) filter (where name = 'mail_from'),
                          max(decrypted_secret) filter (where name = 'alert_email_to')
                     from vault.decrypted_secrets$q$ into v_url, v_from, v_to;
        if v_url is not null and v_from is not null and v_to is not null then
          execute $q$select net.http_post(url := 'https://api.resend.com/emails',
                     headers := jsonb_build_object('Authorization', 'Bearer ' || $1, 'Content-Type', 'application/json'),
                     body := jsonb_build_object('from', $2, 'to', to_jsonb(string_to_array($3, ',')),
                                                'subject', '[Watch Tower] ALARM: ' || $4,
                                                'text', $4 || E'\n' || ($5->>'text') || E'\nCo zrobić: ' || ($5->>'next_action')))$q$
            using v_url, v_from, v_to, v_title, v_detail;
          v_mail := 'WYSLANY_DO_KOLEJKI';
        end if;
      end if;
    end if;
    v_out := v_out || jsonb_build_object('job', w.job, 'stan', 'ALARM', 'ostatni_sukces', v_last, 'nowe_ryzyka', v_new, 'email', v_mail);
  end loop;
  return v_out;
end $function$;

revoke all on function public.job_watchdog(timestamptz) from public, anon, authenticated;
