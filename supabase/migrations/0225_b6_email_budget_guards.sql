-- B6 (D-20261017-0730-01): bezpiecznik e-maili na osobę, płatność tylko HHL,
-- rio_secret bez UPDATE z API, limit funkcji bez logowania, loads_read bez SITE.

-- 1. Licznik na użytkownika w email_budget_day (wiersze L13: user_id is null).
alter table public.email_budget_day add column if not exists user_id uuid;
alter table public.email_budget_day add column if not exists kind text not null default '';
alter table public.email_budget_day add column if not exists n int not null default 0;
alter table public.email_budget_day add column if not exists digest_at timestamptz;
alter table public.email_budget_day alter column warned_at drop not null;

alter table public.email_budget_day drop constraint if exists email_budget_day_pkey;
create unique index if not exists email_budget_day_legacy
  on public.email_budget_day (day) where user_id is null and kind = '';
create unique index if not exists email_budget_day_user_kind
  on public.email_budget_day (day, user_id, kind) where user_id is not null;

create or replace function public.l13_email_guard_note(p_now timestamptz default now())
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day date;
  v_level text;
  v_n int;
begin
  select day, level, immediate_n into v_day, v_level, v_n from l13_email_counts(p_now);
  if v_level = 'ok' then
    return 'ok';
  end if;
  if exists (
    select 1 from email_budget_day
     where day = v_day and user_id is null and kind = ''
  ) then
    return v_level;
  end if;
  insert into email_budget_day (day, warned_at, kind) values (v_day, p_now, '');
  insert into integration_runs (job, ran_at, ok, result)
  values (
    'email-budget',
    p_now,
    false,
    jsonb_build_object(
      'level', v_level,
      'immediate', v_n,
      'warn_at', 80,
      'critical_only_at', 95,
      'resend_limit', 100,
      'note', 'L-13: poczta zbliża się do limitu Resend. Decyzje automatyczne bez e-maila.'
    )
  );
  return v_level;
end $$;
revoke all on function public.l13_email_guard_note(timestamptz) from public, anon, authenticated;

create or replace function public.notifications_email_budget()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day date := (now() at time zone 'Europe/Warsaw')::date;
  v_kind text := left(coalesce(new.template, ''), 80);
  v_kind_n int;
  v_day_n int;
  v_key text;
  v_n_txt text;
  v_title text;
  v_body text;
begin
  if new.channel is distinct from 'EMAIL' or new.status is distinct from 'PENDING' then
    return new;
  end if;
  if new.user_id is null or new.template = 'EMAIL_BUDGET'
     or coalesce(new.dedup_key, '') like 'budget:%' then
    return new;
  end if;

  select coalesce(sum(n), 0) into v_day_n
    from email_budget_day
   where day = v_day and user_id = new.user_id
     and kind not in ('*zbiorczy*', '*pilne*');
  select coalesce(n, 0) into v_kind_n
    from email_budget_day
   where day = v_day and user_id = new.user_id and kind = v_kind;

  if coalesce(new.payload->>'push_fallback', '') = 'true' then
    update email_budget_day
       set n = n + 1
     where day = v_day and user_id = new.user_id and kind = '*pilne*';
    if not found then
      insert into email_budget_day (day, user_id, kind, n)
      values (v_day, new.user_id, '*pilne*', 1);
    end if;
    return new;
  end if;

  if v_day_n >= 20 or v_kind_n >= 5 then
    v_key := left('budget:' || v_day::text || ':' || new.user_id::text, 200);
    select subject_pl, body_pl into v_title, v_body
      from notification_copy where id = 'EMAIL_BUDGET';
    v_title := coalesce(v_title, 'Limit e-maili na dziś');
    v_body := coalesce(v_body, 'Dziś dostałeś już {n} e-maili z Watch Tower. Kolejne powiadomienia z dzisiaj są w dzwonku i w aplikacji na telefonie. E-maile wrócą jutro.');
    if v_day_n >= 20 then
      v_n_txt := v_day_n::text;
      v_body := replace(v_body, '{n}', v_n_txt);
    else
      v_n_txt := '5 e-maili «' || v_kind || '»';
      v_body := replace(v_body, '{n} e-maili', v_n_txt);
    end if;
    insert into notifications (channel, recipient, user_id, template, payload, dedup_key, status)
    values (
      'EMAIL', new.recipient, new.user_id, 'EMAIL_BUDGET',
      jsonb_build_object('title', v_title, 'body', v_body, 'n', v_n_txt),
      v_key, 'PENDING'
    )
    on conflict (dedup_key) where dedup_key is not null do nothing;
    update email_budget_day
       set digest_at = coalesce(digest_at, now())
     where day = v_day and user_id = new.user_id and kind = '*zbiorczy*';
    if not found then
      insert into email_budget_day (day, user_id, kind, n, digest_at)
      values (v_day, new.user_id, '*zbiorczy*', 0, now());
    end if;
    return null;
  end if;

  update email_budget_day
     set n = n + 1
   where day = v_day and user_id = new.user_id and kind = v_kind;
  if not found then
    insert into email_budget_day (day, user_id, kind, n)
    values (v_day, new.user_id, v_kind, 1);
  end if;
  return new;
end $$;

revoke all on function public.notifications_email_budget() from public, anon, authenticated;

drop trigger if exists trg_notifications_email_budget on public.notifications;
create trigger trg_notifications_email_budget
  before insert on public.notifications
  for each row execute function public.notifications_email_budget();

-- 2. Płatność faktury zmienia tylko HHL (także gdy kolumna byłaby przyznana).
create or replace function public.guard_invoice_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  org uuid := current_org_id();
  issuer_changed boolean :=
       new.invoice_number is distinct from old.invoice_number
    or new.issue_date     is distinct from old.issue_date
    or new.receipt_date   is distinct from old.receipt_date
    or new.week_key       is distinct from old.week_key
    or new.currency       is distinct from old.currency
    or new.net_total      is distinct from old.net_total
    or new.vat_total      is distinct from old.vat_total
    or new.gross_total    is distinct from old.gross_total
    or new.due_date       is distinct from old.due_date
    or new.document_id    is distinct from old.document_id
    or new.issuer_org_id  is distinct from old.issuer_org_id
    or new.recipient_org_id is distinct from old.recipient_org_id
    or new.direction      is distinct from old.direction;
  verifier_changed boolean :=
       new.verification_status is distinct from old.verification_status
    or new.dispute_note        is distinct from old.dispute_note;
  payment_changed boolean :=
       new.payment_status is distinct from old.payment_status
    or new.paid_at is distinct from old.paid_at
    or new.paid_marked_by is distinct from old.paid_marked_by
    or new.paid_marked_at is distinct from old.paid_marked_at;
begin
  if new.verification_status = 'SPORNA'
     and (new.dispute_note is null or btrim(new.dispute_note) = '') then
    raise exception 'Status SPORNA wymaga uzasadnienia';
  end if;
  if auth.uid() is null then return new; end if;
  if (org is not null) is not true then
    raise exception 'Brak aktywnego konta' using errcode = '42501';
  end if;
  if payment_changed and (is_hhl() is not true) then
    raise exception 'Status płatności zmienia tylko HHL' using errcode = '42501';
  end if;
  if is_hhl() is true then
    if org = old.issuer_org_id and verifier_changed then
      raise exception 'Wystawca nie weryfikuje własnej faktury — spór klienta rozstrzyga rozmowa, nie przycisk wystawcy';
    end if;
    return new;
  end if;
  if org = old.recipient_org_id and issuer_changed then
    raise exception 'Odbiorca faktury może ją weryfikować, nie zmieniać jej treści';
  end if;
  if org = old.issuer_org_id and verifier_changed then
    raise exception 'Wystawca nie weryfikuje własnej faktury';
  end if;
  return new;
end $$;

-- 3. rio_secret: revoke UPDATE/INSERT na całej tabeli (revoke kolumny nie zdejmuje prawa tabeli),
-- potem grant kolumn pisanych przez aplikację — wszystkich poza rio_secret.
-- Zapis sekretu zostaje w loads_rio_sanitize (wyzwalacz właściciela).
do $$
declare
  v_old jsonb;
  v_cols text;
begin
  select jsonb_build_object(
    'table', coalesce((
      select jsonb_agg(jsonb_build_object('privilege', privilege_type) order by privilege_type)
        from information_schema.role_table_grants
       where table_schema = 'public' and table_name = 'loads' and grantee = 'authenticated'
    ), '[]'::jsonb),
    'columns', coalesce((
      select jsonb_agg(jsonb_build_object('column', column_name, 'privilege', privilege_type)
                        order by column_name, privilege_type)
        from information_schema.column_privileges
       where table_schema = 'public' and table_name = 'loads' and grantee = 'authenticated'
    ), '[]'::jsonb)
  ) into v_old;

  insert into audit_log (action, entity, entity_id, old_value, new_value)
  values (
    'B6_LOADS_GRANTS', 'loads', 'authenticated', v_old,
    jsonb_build_object('note', 'przed revoke insert i update na loads')
  );

  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
    into v_cols
    from information_schema.columns
   where table_schema = 'public' and table_name = 'loads'
     and column_name <> 'rio_secret';

  execute 'revoke insert, update on table public.loads from authenticated';
  execute format('grant insert (%s) on table public.loads to authenticated', v_cols);
  execute format('grant update (%s) on table public.loads to authenticated', v_cols);
end $$;

-- 4. Limit 60 / 15 min na IP i przeglądarkę.
create table if not exists public.anon_call_window (
  fn text not null,
  ip text not null,
  ua text not null,
  n int not null default 0,
  window_start timestamptz not null default now(),
  primary key (fn, ip, ua)
);
alter table public.anon_call_window enable row level security;
revoke all on public.anon_call_window from public, anon, authenticated;

create or replace function public.anon_rate_ok(p_fn text, p_ua text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_headers jsonb;
  v_fwd text;
  v_ip text;
  v_ua text;
  v_n int;
  v_start timestamptz;
begin
  -- p_ua zostaje w sygnaturze (zapis błędu), ale nie jest kluczem licznika.
  v_headers := coalesce(nullif(current_setting('request.headers', true), '')::jsonb, '{}'::jsonb);
  v_fwd := nullif(btrim(split_part(coalesce(v_headers->>'x-forwarded-for', ''), ',', 1)), '');
  v_ip := left(coalesce(
    nullif(btrim(v_headers->>'cf-connecting-ip'), ''),
    v_fwd,
    inet_client_addr()::text,
    'local'
  ), 80);
  v_ua := left(coalesce(nullif(btrim(v_headers->>'user-agent'), ''), 'brak'), 160);
  if (p_fn in ('keep_alive', 'report_client_error', 'report_csp_violation')) is not true then
    return false;
  end if;
  select n, window_start into v_n, v_start
    from anon_call_window
   where fn = p_fn and ip = v_ip and ua = v_ua
   for update;
  if not found then
    insert into anon_call_window (fn, ip, ua, n, window_start)
    values (p_fn, v_ip, v_ua, 1, now());
    return true;
  end if;
  if v_start < now() - interval '15 minutes' then
    update anon_call_window set n = 1, window_start = now()
     where fn = p_fn and ip = v_ip and ua = v_ua;
    return true;
  end if;
  if v_n >= 60 then
    return false;
  end if;
  update anon_call_window set n = n + 1
   where fn = p_fn and ip = v_ip and ua = v_ua;
  return true;
end $$;
revoke all on function public.anon_rate_ok(text, text) from public, anon, authenticated;

create or replace function public.keep_alive(p_source text default 'worker')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare h system_heartbeat%rowtype;
begin
  if auth.uid() is not null and current_app_user_id() is null then
    raise exception 'Brak aktywnego konta' using errcode = '42501';
  end if;
  if (public.anon_rate_ok('keep_alive', p_source) is not true) then
    return jsonb_build_object('ok', false, 'limited', true);
  end if;
  update system_heartbeat
     set beat_at = now(), source = left(coalesce(p_source, 'worker'), 40), beats = beats + 1
   where id = 1 and beat_at <= now() - interval '60 seconds';
  select * into h from system_heartbeat where id = 1;
  return jsonb_build_object('ok', true, 'beat_at', h.beat_at, 'beats', h.beats, 'db_now', now());
end $$;

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
    return false;
  end if;
  insert into client_errors (fingerprint, kind, message, stack, path, build, user_agent, app_role, user_id)
  values (v_fp, p_kind, v_msg, v_stack, nullif(left(client_error_scrub(p_path), 300), ''),
          nullif(left(p_build, 60), ''), nullif(left(p_ua, 300), ''), current_app_role()::text, current_app_user_id());
  return true;
end $$;

create or replace function public.report_csp_violation(
  p_effective text,
  p_blocked text default null,
  p_document text default null,
  p_violated text default null,
  p_policy text default null,
  p_source text default null,
  p_line int default null,
  p_col int default null,
  p_disposition text default 'report',
  p_ua text default null,
  p_build text default null
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_eff text; v_blocked text; v_fp text; v_id bigint; v_disp text;
begin
  if auth.uid() is not null and current_app_user_id() is null then
    raise exception 'Brak aktywnego konta' using errcode = '42501';
  end if;
  if (public.anon_rate_ok('report_csp_violation', p_ua) is not true) then
    return false;
  end if;
  v_eff := left(btrim(coalesce(p_effective, '')), 80);
  if v_eff = '' then return false; end if;
  v_blocked := nullif(left(client_error_scrub(coalesce(p_blocked, '')), 500), '');
  v_disp := case when p_disposition in ('report','enforce') then p_disposition else 'report' end;
  v_fp := md5(v_eff || '|' || coalesce(v_blocked, '') || '|' || coalesce(left(p_source, 200), ''));
  update csp_violations set hits = hits + 1, last_seen_at = now()
   where id = (select id from csp_violations
                where fingerprint = v_fp and last_seen_at > now() - interval '10 minutes'
                order by last_seen_at desc limit 1)
  returning id into v_id;
  if v_id is not null then return true; end if;
  if (select count(*) from csp_violations where first_seen_at > now() - interval '1 minute') >= 60 then
    return false;
  end if;
  insert into csp_violations (
    fingerprint, effective_directive, blocked_uri, document_uri, violated_directive,
    original_policy, source_file, line_number, column_number, disposition,
    user_agent, build, app_role, user_id
  ) values (
    v_fp, v_eff, v_blocked,
    nullif(left(client_error_scrub(coalesce(p_document, '')), 500), ''),
    nullif(left(coalesce(p_violated, ''), 200), ''),
    nullif(left(coalesce(p_policy, ''), 2000), ''),
    nullif(left(client_error_scrub(coalesce(p_source, '')), 500), ''),
    p_line, p_col, v_disp,
    nullif(left(coalesce(p_ua, ''), 300), ''),
    nullif(left(coalesce(p_build, ''), 60), ''),
    current_app_role()::text, current_app_user_id()
  );
  return true;
end $$;

-- 5. loads_read: bez martwej ścieżki SITE.
drop policy if exists loads_read on public.loads;
create policy loads_read on public.loads
  for select to authenticated
  using (
    (is_hhl()) is true
    or (current_org_kind() = 'CLIENT'
        and exists (select 1 from projects p
                    where p.id = loads.project_id and p.client_org_id = current_org_id()))
    or (current_org_kind() = 'CARRIER' and loads.carrier_org_id = current_org_id())
  );

insert into public.notification_copy (id, subject_pl, body_pl) values
  ('EMAIL_BUDGET', 'Limit e-maili na dziś',
   'Dziś dostałeś już {n} e-maili z Watch Tower. Kolejne powiadomienia z dzisiaj są w dzwonku i w aplikacji na telefonie. E-maile wrócą jutro.')
on conflict (id) do update
  set subject_pl = excluded.subject_pl, body_pl = excluded.body_pl;
