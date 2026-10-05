-- 0180 — CSP Report-Only (7 dni) + D-3 retencja dokumentów.
-- CSP: tabela naruszeń, RPC report_csp_violation (anon+auth), widok dla Stanu systemu.
-- D-3: CMR/POD/LASHING_PHOTO 3 lata, INVOICE (PDF faktur) 5 lat od rozładunku/uploaded;
--      I-7 purge_personal_data (kierowca 90 dni) BEZ ZMIAN.
-- Idempotentna.

-- ========== 0. app_parameters (gdy TEST bez pełnej historii migracji) ==========
create table if not exists public.app_parameters (
  key        text primary key,
  value      numeric not null,
  label      text not null,
  source     text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

-- ========== 1. CSP Report-Only ==========
create table if not exists public.csp_violations (
  id            bigint generated always as identity primary key,
  fingerprint   text not null,
  effective_directive text not null check (length(effective_directive) <= 80),
  blocked_uri   text check (length(blocked_uri) <= 500),
  document_uri  text check (length(document_uri) <= 500),
  violated_directive text check (length(violated_directive) <= 200),
  original_policy text check (length(original_policy) <= 2000),
  source_file   text check (length(source_file) <= 500),
  line_number   int,
  column_number int,
  disposition   text check (disposition in ('report','enforce') or disposition is null),
  user_agent    text check (length(user_agent) <= 300),
  build         text check (length(build) <= 60),
  app_role      text,
  user_id       uuid references app_users(id) on delete set null,
  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  hits          int not null default 1
);
create index if not exists csp_violations_fp on csp_violations (fingerprint, last_seen_at desc);
create index if not exists csp_violations_last on csp_violations (last_seen_at desc);
alter table csp_violations enable row level security;
revoke all on csp_violations from anon, authenticated;
grant select on csp_violations to authenticated;
drop policy if exists csp_violations_read on csp_violations;
create policy csp_violations_read on csp_violations for select to authenticated
  using (current_app_role() = 'HHL_ADMIN');

-- Okno Report-Only: 7 dni od wdrożenia (Europe/Warsaw). value = dni; label = data końca.
insert into app_parameters (key, value, label, source) values (
  'CSP_REPORT_ONLY_UNTIL',
  7,
  'CSP Report-Only do ' || to_char((now() at time zone 'Europe/Warsaw' + interval '7 days'), 'YYYY-MM-DD')
    || ' (Europe/Warsaw); potem lista źródeł → enforce przed SEC-OWASP/pilotaż',
  'decyzja właściciela 05.10 ~13:53'
)
on conflict (key) do update set
  value = excluded.value,
  label = excluded.label,
  source = excluded.source,
  updated_at = now();

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
language plpgsql security definer set search_path = public as $$
declare
  v_eff text; v_blocked text; v_fp text; v_id bigint; v_disp text;
begin
  if auth.uid() is not null and current_app_user_id() is null then
    raise exception 'Brak aktywnego konta' using errcode = '42501';
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
revoke all on function public.report_csp_violation(text, text, text, text, text, text, int, int, text, text, text) from public;
grant execute on function public.report_csp_violation(text, text, text, text, text, text, int, int, text, text, text) to anon, authenticated;

-- Widok dla Stanu systemu (HHL_ADMIN przez RLS tabeli).
create or replace function public.csp_status_view()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_until text;
  v_n int;
  v_hits int;
  v_top text;
begin
  if current_app_role() is distinct from 'HHL_ADMIN' then
    raise exception 'CSP status widzi wyłącznie HHL' using errcode = '42501';
  end if;
  select regexp_replace(coalesce(label, ''), '.*do ([0-9]{4}-[0-9]{2}-[0-9]{2}).*', '\1') into v_until
    from app_parameters where key = 'CSP_REPORT_ONLY_UNTIL';
  select count(*), coalesce(sum(hits), 0) into v_n, v_hits
    from csp_violations where last_seen_at > now() - interval '7 days';
  select effective_directive || ' → ' || coalesce(blocked_uri, '—') into v_top
    from csp_violations where last_seen_at > now() - interval '7 days'
   order by hits desc, last_seen_at desc limit 1;
  return jsonb_build_object(
    'mode', 'report-only',
    'until', coalesce(v_until, ''),
    'violations_7d', v_n,
    'hits_7d', v_hits,
    'top', left(coalesce(v_top, ''), 200),
    'level', case when v_n = 0 then 'ok' when v_n < 10 then 'warn' else 'bad' end
  );
end $$;
revoke all on function public.csp_status_view() from public, anon, authenticated;
grant execute on function public.csp_status_view() to authenticated;

-- Retencja naruszeń CSP 90 dni.
create or replace function public.purge_csp_violations(p_days int default 90)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if (p_days >= 0) is not true then raise exception 'p_days ≥ 0' using errcode = '22023'; end if;
  delete from csp_violations where first_seen_at < now() - make_interval(days => p_days);
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.purge_csp_violations(int) from public, anon, authenticated;

-- ========== 2. D-3 retencja dokumentów ==========
-- CMR, POD, LASHING_PHOTO: 3 lata od actual_delivery_at (albo uploaded_at gdy brak rozładunku / bez load).
-- INVOICE: 5 lat. Inne kategorie: 5 lat (bezpieczny domyślny).
-- Soft-delete: archived_at + usunięcie ścieżki Storage zostaje w osobnym przebiegu Edge gdy R2;
-- tu: oznaczenie purged_at i storage_path='-' (bajty kasuje cron z service_role gdy Storage dostępne).

alter table documents add column if not exists purged_at timestamptz;

create or replace function public.document_retention_years(p_category doc_category)
returns int language sql immutable as $$
  select case p_category
    when 'CMR' then 3
    when 'POD' then 3
    when 'LASHING_PHOTO' then 3
    when 'INVOICE' then 5
    else 5
  end
$$;

create or replace function public.purge_expired_documents(p_now timestamptz default now())
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  n_cmr int := 0; n_pod int := 0; n_photo int := 0; n_inv int := 0; n_other int := 0;
  r record;
begin
  for r in
    select d.id, d.category, d.storage_path
      from documents d
      left join loads l on l.id = d.load_id
     where d.purged_at is null
       and d.storage_path is distinct from '-'
       and coalesce(l.actual_delivery_at, d.uploaded_at) < p_now
             - make_interval(years => document_retention_years(d.category))
  loop
    update documents
       set purged_at = p_now,
           archive_path = coalesce(archive_path, storage_path),
           storage_path = '-'
     where id = r.id and purged_at is null;
    if found then
      if r.category = 'CMR' then n_cmr := n_cmr + 1;
      elsif r.category = 'POD' then n_pod := n_pod + 1;
      elsif r.category = 'LASHING_PHOTO' then n_photo := n_photo + 1;
      elsif r.category = 'INVOICE' then n_inv := n_inv + 1;
      else n_other := n_other + 1;
      end if;
    end if;
  end loop;

  insert into integration_runs (job, ok, result)
  values ('doc-retention', true, jsonb_build_object(
    'cmr_3y', n_cmr, 'pod_3y', n_pod, 'zdjecia_3y', n_photo,
    'faktury_5y', n_inv, 'inne_5y', n_other,
    'zrodlo', 'D-3 decyzja właściciela 05.10 ~13:53'
  ));

  return jsonb_build_object(
    'cmr', n_cmr, 'pod', n_pod, 'photos', n_photo, 'invoices', n_inv, 'other', n_other
  );
end $$;
revoke all on function public.purge_expired_documents(timestamptz) from public, anon, authenticated;

-- Cron: codziennie 02:20 UTC (po tower-rodo 02:15).
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'tower-retencja-dokumentow';
    perform cron.schedule(
      'tower-retencja-dokumentow',
      '20 2 * * *',
      $c$select public.purge_expired_documents()$c$
    );
  end if;
exception when others then
  raise notice 'pg_cron niedostępny — pomijam harmonogram retencji dokumentów: %', sqlerrm;
end $$;

-- Parametry retencji (widoczne w Opcjach / audycie).
insert into app_parameters (key, value, label, source) values
  ('DOC_RETENTION_CMR_POD_YEARS', 3, 'D-3: CMR, POD, zdjęcia mocowania — lata', 'decyzja właściciela 05.10 ~13:53'),
  ('DOC_RETENTION_INVOICE_YEARS', 5, 'D-3: PDF faktur — lata', 'decyzja właściciela 05.10 ~13:53')
on conflict (key) do update set
  value = excluded.value,
  label = excluded.label,
  source = excluded.source,
  updated_at = now();

comment on function public.purge_personal_data(integer) is
  'I-7: retencja danych kierowcy 90 dni — BEZ ZMIAN przy D-3 (dokumenty osobno: purge_expired_documents).';
