-- 0058 — I-6: monitoring błędów przeglądarki do własnej tabeli + alarm.
--   client_errors            — błędy JS z przeglądarki (window.onerror, unhandledrejection); jeden wiersz na odcisk
--                              (fingerprint) w oknie 10 min — kolejne wystąpienia zwiększają `hits`.
--   report_client_error(...) — jedyna droga zapisu. anon (PWA kierowcy, ekran logowania) i zalogowani z aktywnym kontem;
--                              zalogowany bez aktywnego konta = odmowa (jak keep_alive). Limity: długości pól, 60 nowych
--                              wierszy / min globalnie (nadmiar odrzucany cicho), tokeny kierowcy i JWT wycinane z treści.
--   client_error_watch()     — co 15 min: błąd w ostatnich 15 min i brak otwartego alarmu → ryzyko HHL (JOB_FAILURE,
--                              rk_client_errors) + e-mail na ALERT_EMAIL_TO (Resend przez pg_net, jak job_watchdog);
--                              24 h bez błędów → alarm zamknięty. Retencja 30 dni (cron 03:05 UTC).
--   Odczyt: wyłącznie HHL_ADMIN (RLS). Idempotentna, niedestrukcyjna.

create table if not exists client_errors (
  id            bigint generated always as identity primary key,
  fingerprint   text not null,
  kind          text not null check (kind in ('error','rejection')),
  message       text not null check (length(message) <= 1000),
  stack         text check (length(stack) <= 4000),
  path          text check (length(path) <= 300),
  build         text check (length(build) <= 60),
  user_agent    text check (length(user_agent) <= 300),
  app_role      text,
  user_id       uuid references app_users(id) on delete set null,
  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  hits          int not null default 1
);
create index if not exists client_errors_fp on client_errors (fingerprint, last_seen_at desc);
create index if not exists client_errors_first on client_errors (first_seen_at desc);
alter table client_errors enable row level security;
revoke all on client_errors from anon, authenticated;
grant select on client_errors to authenticated;
drop policy if exists client_errors_read on client_errors;
create policy client_errors_read on client_errors for select to authenticated using (current_app_role() = 'HHL_ADMIN');

create or replace function public.client_error_scrub(p text) returns text
language sql immutable set search_path = public as $$
  select regexp_replace(regexp_replace(regexp_replace(coalesce(p, ''),
    'wt_[0-9a-fA-F]{16,}', 'wt_…', 'g'),
    'eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}', 'jwt…', 'g'),
    '(access_token|refresh_token|token|code)=[^&#\s]+', '\1=…', 'gi')
$$;
revoke all on function public.client_error_scrub(text) from public, anon, authenticated;

create or replace function public.report_client_error(p_kind text, p_message text, p_stack text default null,
  p_path text default null, p_build text default null, p_ua text default null) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_msg text; v_stack text; v_fp text; v_id bigint;
begin
  if auth.uid() is not null and current_app_user_id() is null then
    raise exception 'Brak aktywnego konta' using errcode = '42501';
  end if;
  if (p_kind in ('error','rejection')) is not true then
    raise exception 'Nieznany rodzaj błędu' using errcode = '22023';
  end if;
  if (length(btrim(p_message)) > 0) is not true then
    raise exception 'Pusty komunikat błędu' using errcode = '22023';
  end if;
  v_msg := left(client_error_scrub(p_message), 1000);
  v_stack := nullif(left(client_error_scrub(p_stack), 4000), '');
  v_fp := md5(p_kind || '|' || v_msg || '|' || coalesce(split_part(v_stack, E'\n', 2), ''));
  update client_errors set hits = hits + 1, last_seen_at = now()
   where id = (select id from client_errors where fingerprint = v_fp and last_seen_at > now() - interval '10 minutes'
                order by last_seen_at desc limit 1)
  returning id into v_id;
  if v_id is not null then return true; end if;
  if (select count(*) from client_errors where first_seen_at > now() - interval '1 minute') >= 60 then
    return false;                                       -- zalew: nadmiar odrzucany cicho
  end if;
  insert into client_errors (fingerprint, kind, message, stack, path, build, user_agent, app_role, user_id)
  values (v_fp, p_kind, v_msg, v_stack, nullif(left(client_error_scrub(p_path), 300), ''),
          nullif(left(p_build, 60), ''), nullif(left(p_ua, 300), ''), current_app_role()::text, current_app_user_id());
  return true;
end $$;
revoke all on function public.report_client_error(text, text, text, text, text, text) from public;
grant execute on function public.report_client_error(text, text, text, text, text, text) to anon, authenticated;

create or replace function public.client_error_watch(p_now timestamptz default now()) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_n int; v_hits int; v_top text; v_proj record; v_key text; v_new int := 0; v_title text; v_detail jsonb;
  v_api text; v_from text; v_to text; v_mail text := 'BEZ_ZMIAN'; v_id uuid;
begin
  select count(*), coalesce(sum(hits), 0) into v_n, v_hits from client_errors where last_seen_at > p_now - interval '15 minutes';
  if v_n = 0 then
    if not exists (select 1 from client_errors where last_seen_at > p_now - interval '24 hours') then
      update risk_signals set resolved_at = p_now where kind = 'JOB_FAILURE' and resolved_at is null and detail->>'job' = 'client-errors';
    end if;
    return jsonb_build_object('stan', 'OK', 'bledy_15min', 0);
  end if;
  select message into v_top from client_errors where last_seen_at > p_now - interval '15 minutes' order by hits desc, last_seen_at desc limit 1;
  v_title := 'Błędy w przeglądarce użytkowników: ' || v_n || ' rodzaj(e), ' || v_hits || ' wystąpień w 15 min';
  v_detail := jsonb_build_object('job', 'client-errors', 'kinds', v_n, 'hits', v_hits, 'top', left(v_top, 200),
    'text', 'Najczęstszy: ' || left(v_top, 200),
    'next_action', 'Sprawdź tabelę client_errors (komunikat, stos, ścieżka, wersja) i popraw kod',
    'params', jsonb_build_object('kinds', v_n, 'hits', v_hits, 'top', left(v_top, 200)),
    'text_key', 'rk_client_errors_text', 'next_action_key', 'rk_client_errors_next');
  for v_proj in select id from projects loop
    v_key := 'client-errors:' || v_proj.id;
    v_id := null;
    insert into risk_signals (project_id, kind, severity, title, title_key, detail, dedup_key, detected_at)
    values (v_proj.id, 'JOB_FAILURE', 'HIGH', v_title, 'rk_client_errors', v_detail, v_key, p_now)
    on conflict (dedup_key) where dedup_key is not null and resolved_at is null do nothing
    returning id into v_id;
    if v_id is not null then v_new := v_new + 1; end if;
  end loop;
  if v_new > 0 then
    v_mail := 'BRAK_SEKRETOW';
    if to_regclass('vault.decrypted_secrets') is not null and to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is not null then
      execute $q$select max(decrypted_secret) filter (where name = 'resend_api_key'),
                        max(decrypted_secret) filter (where name = 'mail_from'),
                        max(decrypted_secret) filter (where name = 'alert_email_to')
                   from vault.decrypted_secrets$q$ into v_api, v_from, v_to;
      if v_api is not null and v_from is not null and v_to is not null then
        execute $q$select net.http_post(url := 'https://api.resend.com/emails',
                   headers := jsonb_build_object('Authorization', 'Bearer ' || $1, 'Content-Type', 'application/json'),
                   body := jsonb_build_object('from', $2, 'to', to_jsonb(string_to_array($3, ',')),
                                              'subject', '[Watch Tower] ALARM: ' || $4,
                                              'text', $4 || E'\n' || ($5->>'text') || E'\nCo zrobić: ' || ($5->>'next_action')))$q$
          using v_api, v_from, v_to, v_title, v_detail;
        v_mail := 'WYSLANY_DO_KOLEJKI';
      end if;
    end if;
  end if;
  return jsonb_build_object('stan', 'ALARM', 'bledy_15min', v_n, 'wystapienia', v_hits, 'nowe_ryzyka', v_new, 'email', v_mail);
end $$;
revoke all on function public.client_error_watch(timestamptz) from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname in ('tower-bledy-przegladarki', 'tower-bledy-retencja');
    perform cron.schedule('tower-bledy-przegladarki', '*/15 * * * *', 'select public.client_error_watch()');
    perform cron.schedule('tower-bledy-retencja', '5 3 * * *', $c$delete from public.client_errors where last_seen_at < now() - interval '30 days'$c$);
  end if;
end $$;
