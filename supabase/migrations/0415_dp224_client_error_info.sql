-- DP-224 C / F7 #822 B2: new_version_shown nie otwiera alarmu HHL ani nie liczy się jako „nowe”.
-- kind='info' + wykluczenie w client_error_watch i newCount w app_errors_recent; Stan systemu: state=known.

do $$
declare r record;
begin
  for r in
    select c.conname
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
     where n.nspname = 'public' and t.relname = 'client_errors' and c.contype = 'c'
       and pg_get_constraintdef(c.oid) ilike '%kind%'
  loop
    execute format('alter table public.client_errors drop constraint %I', r.conname);
  end loop;
end $$;
alter table public.client_errors
  add constraint client_errors_kind_check check (kind in ('error', 'rejection', 'info'));

create or replace function public.report_client_error(
  p_kind text, p_message text, p_stack text default null,
  p_path text default null, p_build text default null, p_ua text default null
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_msg text; v_stack text; v_fp text; v_id bigint;
begin
  if auth.uid() is not null and current_app_user_id() is null then
    raise exception 'Brak aktywnego konta' using errcode = '42501';
  end if;
  if (public.anon_rate_ok('report_client_error', p_ua) is not true) then
    return false;
  end if;
  if (p_kind in ('error', 'rejection', 'info')) is not true then
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
    return false;
  end if;
  insert into client_errors (fingerprint, kind, message, stack, path, build, user_agent, app_role, user_id)
  values (v_fp, p_kind, v_msg, v_stack, nullif(left(client_error_scrub(p_path), 300), ''),
          nullif(left(p_build, 60), ''), nullif(left(p_ua, 300), ''), current_app_role()::text, current_app_user_id());
  return true;
end $$;

create or replace function public.client_error_watch(p_now timestamptz default now()) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_n int; v_hits int; v_top text; v_proj record; v_key text; v_new int := 0; v_title text; v_detail jsonb;
  v_api text; v_from text; v_to text; v_mail text := 'BEZ_ZMIAN'; v_id uuid;
begin
  /* DP-224: kind=info / new_version_shown:% — informacja, nie alarm JOB_FAILURE */
  select count(*), coalesce(sum(hits), 0)
    into v_n, v_hits
    from client_errors
   where last_seen_at > p_now - interval '15 minutes'
     and kind in ('error', 'rejection')
     and message not like 'new_version_shown:%';
  if v_n = 0 then
    if not exists (
      select 1 from client_errors
       where last_seen_at > p_now - interval '24 hours'
         and kind in ('error', 'rejection')
         and message not like 'new_version_shown:%'
    ) then
      update risk_signals set resolved_at = p_now
       where kind = 'JOB_FAILURE' and resolved_at is null and detail->>'job' = 'client-errors';
    end if;
    return jsonb_build_object('stan', 'OK', 'bledy_15min', 0);
  end if;
  select message into v_top
    from client_errors
   where last_seen_at > p_now - interval '15 minutes'
     and kind in ('error', 'rejection')
     and message not like 'new_version_shown:%'
   order by hits desc, last_seen_at desc
   limit 1;
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
             'state', case
               when g.kind = 'info' or g.message like 'new_version_shown:%'
                 then 'known'
               else null
             end,
             'stateNote', case
               when g.kind = 'info' or g.message like 'new_version_shown:%'
                 then 'znane / informacja — pasek „Jest nowa wersja”'
               else null
             end,
             'stack', left(g.stack, 500)
           )
           order by g.hits desc, g.last_seen_at desc
         ), '[]'::jsonb)
    into v_groups
    from (
      select md5(c.message) as msg_key,
             c.message,
             max(c.kind) as kind,
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

  /* DP-224: info / new_version_shown nie wchodzą do licznika „nowych” */
  select count(*)::int
    into v_new_count
    from (
      select c.message
        from public.client_errors c
       where c.last_seen_at >= v_since
         and c.kind in ('error', 'rejection')
         and c.message not like 'new_version_shown:%'
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
  '#422/#508/DP-224: client_errors 7 dni; info/new_version_shown = known, poza newCount; tylko HHL_ADMIN.';
