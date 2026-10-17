-- A8 (C15): pauza logowania emtrack i jedna sprawa SOURCE_DOWN:EMTRACK_WEB bez daty w kluczu.
-- Stare sprawy z datą w kluczu: kopia w audit_log, zamknięcie. Zostaje najstarsza jako jeden wiersz.

create table if not exists public.emtrack_login_state (
  id int primary key,
  fail_streak int not null default 0,
  skipped_until timestamptz,
  secret_fp text,
  updated_at timestamptz not null default now(),
  constraint emtrack_login_state_one check (id = 1)
);

insert into public.emtrack_login_state (id)
values (1)
on conflict (id) do nothing;

alter table public.emtrack_login_state enable row level security;
revoke all on table public.emtrack_login_state from public, anon, authenticated;

comment on table public.emtrack_login_state is
  'A8: po 3 błędach logowania emtrack jedna próba na 6 h. Zapis tylko z Edge (service_role). Zmiana sekretu zeruje licznik.';

do $$
declare
  v_since timestamptz;
  v_project uuid;
  v_n int;
begin
  insert into audit_log (action, entity, entity_id, old_value)
  select 'A8_EMTRACK_SOURCE_DOWN_CLOSE', 'risk_signals', id::text,
         jsonb_build_object(
           'dedup_key', dedup_key,
           'detected_at', detected_at,
           'title', title,
           'detail', detail
         )
    from risk_signals
   where resolved_at is null
     and dedup_key like 'SOURCE_DOWN:EMTRACK_WEB:%';

  select count(*) into v_n
    from risk_signals
   where resolved_at is null
     and dedup_key like 'SOURCE_DOWN:EMTRACK_WEB:%';

  select min(detected_at) into v_since
    from risk_signals
   where resolved_at is null
     and dedup_key like 'SOURCE_DOWN:EMTRACK_WEB:%';

  select project_id into v_project
    from risk_signals
   where resolved_at is null
     and dedup_key like 'SOURCE_DOWN:EMTRACK_WEB:%'
   order by detected_at
   limit 1;

  if v_n > 0 and v_project is not null and v_since is not null then
    insert into risk_signals (project_id, kind, severity, title, title_key, detail, dedup_key, detected_at)
    select v_project, 'JOB_FAILURE', 'MEDIUM',
           'Źródło niedostępne: telematyka naczep (emtrack web) od '
             || to_char(v_since at time zone 'Europe/Warsaw', 'DD.MM.YYYY HH24:MI')
             || ' — HHL weryfikuje ręcznie',
           'rk_source_down',
           jsonb_build_object(
             'zrodlo', 'EMTRACK_WEB',
             'od_kiedy', v_since,
             'params', jsonb_build_object(
               'source', 'telematyka naczep (emtrack web)',
               'source_key', 'rk_src_EMTRACK_WEB'
             )
           ),
           'SOURCE_DOWN:EMTRACK_WEB',
           v_since
     where (exists (
       select 1 from risk_signals
        where dedup_key = 'SOURCE_DOWN:EMTRACK_WEB' and resolved_at is null
     )) is not true;
  end if;

  update risk_signals
     set resolved_at = now()
   where resolved_at is null
     and dedup_key like 'SOURCE_DOWN:EMTRACK_WEB:%';
end $$;
