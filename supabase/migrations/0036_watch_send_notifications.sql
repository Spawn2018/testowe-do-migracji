-- 0036 — 2.2: send-notifications co 5 min (supabase/sql/cron_send_notifications.sql) pod strażnikiem zadań:
-- okno 30 min, uzbrojone od 26.09 17:00 PL. Funkcja zapisuje każdy przebieg w integration_runs (ok = 0 błędów wysyłki).
-- Treść job_watchdog() = 0035 + jeden wiersz. Idempotentna.
create or replace function public.job_watchdog(p_now timestamptz default now()) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  w record; v_last timestamptz; v_bad boolean; v_new int; v_out jsonb := '[]'::jsonb;
  v_key text; v_title text; v_detail jsonb; v_proj record; v_mail text; v_from text; v_to text; v_url text;
begin
  for w in select * from (values
      ('ferry-ais',   interval '30 minutes', timestamptz '2026-09-26 16:30+02', false, 'AIS promów (ferry-ais)'),
      ('usage-check', interval '26 hours',   timestamptz '2026-09-27 06:00+02', false, 'kontrola limitów (usage-check)'),
      ('send-notifications', interval '30 minutes', timestamptz '2026-09-26 17:00+02', false, 'wysyłka powiadomień e-mail (send-notifications)'),
      ('backup',      interval '26 hours',   null::timestamptz,                 true,  'kopia zapasowa (backup-export)')
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
    if not v_bad then
      update risk_signals set resolved_at = p_now where kind = 'JOB_FAILURE' and resolved_at is null
         and detail->>'job' = w.job;
      v_out := v_out || jsonb_build_object('job', w.job, 'stan', 'OK', 'ostatni_sukces', v_last);
      continue;
    end if;
    v_title := 'Zadanie systemowe bez udanego przebiegu: ' || w.label;
    v_detail := jsonb_build_object('job', w.job, 'okno', w.win::text, 'ostatni_sukces', v_last,
      'text', 'Brak udanego przebiegu od ' || coalesce(to_char(v_last at time zone 'Europe/Warsaw', 'DD.MM.YYYY HH24:MI'), 'początku')
              || ' (okno ' || w.win::text || ')',
      'next_action', 'Sprawdź integration_runs / backup_runs i net._http_response (kod odpowiedzi funkcji Edge)');
    v_new := 0;
    for v_proj in select id from projects loop
      v_key := 'job:' || w.job || ':' || v_proj.id;
      if not exists (select 1 from risk_signals where dedup_key = v_key and resolved_at is null) then
        insert into risk_signals (project_id, kind, severity, title, detail, dedup_key, detected_at)
        values (v_proj.id, 'JOB_FAILURE', 'HIGH', v_title, v_detail, v_key, p_now);
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
end $$;

revoke all on function public.job_watchdog(timestamptz) from public, anon, authenticated;
