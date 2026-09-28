-- 0096 — SCOPE 9.1/9.4 (uzupełnienie 0094): dwa wyzwalacze z kreatora reguł, które baza dotąd odrzucała.
--   FERRY_STATUS   zmiana rejsu (status ZAPLANOWANY/OPOZNIONY/ODWOLANY albo czas odejścia/przypłynięcia po opóźnieniu)
--                  → przebieg w kolejce dla każdego nieanulowanego i niedostarczonego transportu przypisanego do rejsu.
--                  Działa od razu (wyzwalacz na sailings), tak jak zdarzenia transportu.
--   CRON_DAILY_06  codzienny przegląd: wf_enqueue_daily(p_now) kolejkuje jeden przebieg na regułę i aktywny transport na dzień
--                  (dzień wg Europe/Warsaw, klucz odsiewu — ponowne wywołanie tego dnia nic nie dodaje).
--                  Funkcja tylko dla service_role; ZADANIA CYKLICZNEGO NIE TWORZYMY — uruchomienie (06:00 Europe/Warsaw)
--                  razem z workflow_worker = decyzja właściciela „START” (PLAN §4).
--   Wykonanie jak w 0094: workflow_worker() (warunek JSONLogic na payload + load, akcje notify/risk, email/sms zablokowane do R-2).
--   Idempotentna i nieniszcząca: create or replace funkcji, wyzwalacz drop/create; bez zmian danych.

create or replace function wf_trigger_types() returns text[]
language sql immutable set search_path = public as $$
  select array['GEOFENCE_ENTER','GEOFENCE_EXIT','GEOFENCE_DWELL','MILESTONE_LOADED','MILESTONE_UNLOADED','STATUS_AUTO',
               'STATUS_AT_SITE','SILENT_VEHICLE','DELAY_DETECTED','DRIVER_ON_FERRY','SCHEDULE_IMPORTED',
               'SCHEDULE_DATE_CRITICAL','STATUS_CANCELLED','PLAN_DATES_CONFIRMED','PLAN_DATES_CHANGED',
               'FERRY_STATUS','CRON_DAILY_06']
$$;
revoke all on function wf_trigger_types() from public, anon, authenticated;

-- FERRY_STATUS: zmiana rejsu → kolejka (błąd kolejkowania nie blokuje zapisu rejsu)
create or replace function wf_enqueue_sailing() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_sig text;
begin
  if (new.status is distinct from old.status
      or new.delayed_departure_at is distinct from old.delayed_departure_at
      or new.delayed_arrival_at is distinct from old.delayed_arrival_at
      or new.departure_at is distinct from old.departure_at) is not true then
    return null;
  end if;
  v_sig := md5(concat_ws('|', new.status, new.departure_at, new.delayed_departure_at, new.delayed_arrival_at));
  insert into workflow_runs (workflow_id, load_id, status, attempts, next_attempt_at, dedup_key, payload)
  select w.id, l.id, 'QUEUED', 0, now(), 'wf:' || w.id || ':ferry:' || new.id || ':' || l.id || ':' || v_sig,
         jsonb_build_object('event_type', 'FERRY_STATUS', 'occurred_at', now(), 'payload', jsonb_build_object(
           'sailing_id', new.id, 'route', new.route, 'vessel', (select v.name from vessels v where v.id = new.vessel_id),
           'status', new.status, 'old_status', old.status,
           'departure_at', coalesce(new.delayed_departure_at, new.departure_at),
           'arrival_at', coalesce(new.delayed_arrival_at, new.arrival_at),
           'delay_min', coalesce(round(extract(epoch from (new.delayed_departure_at - new.departure_at)) / 60), 0)))
    from loads l join workflows w on w.project_id = l.project_id
   where l.sailing_id = new.id and l.status not in ('CANCELLED', 'DELIVERED')
     and w.enabled and w.trigger_type = 'FERRY_STATUS'
  on conflict (dedup_key) where dedup_key is not null do nothing;
  return null;
exception when others then
  raise warning 'wf_enqueue_sailing: %', sqlerrm;
  return null;
end $$;
revoke all on function wf_enqueue_sailing() from public, anon, authenticated;
drop trigger if exists sailings_workflows on sailings;
create trigger sailings_workflows after update on sailings for each row execute function wf_enqueue_sailing();

-- CRON_DAILY_06: codzienny przegląd aktywnych transportów (wywołuje tylko service_role; bez zadania cyklicznego)
create or replace function wf_enqueue_daily(p_now timestamptz default now()) returns int
language plpgsql security definer set search_path = public as $$
declare v_day date; v_n int;
begin
  if p_now is null then raise exception 'wf_enqueue_daily: p_now wymagane'; end if;
  v_day := (p_now at time zone 'Europe/Warsaw')::date;
  insert into workflow_runs (workflow_id, load_id, status, attempts, next_attempt_at, dedup_key, payload)
  select w.id, l.id, 'QUEUED', 0, p_now, 'wf:' || w.id || ':day:' || v_day || ':' || l.id,
         jsonb_build_object('event_type', 'CRON_DAILY_06', 'occurred_at', p_now,
                            'payload', jsonb_build_object('day', v_day))
    from workflows w join loads l on l.project_id = w.project_id
   where w.enabled and w.trigger_type = 'CRON_DAILY_06' and l.status not in ('CANCELLED', 'DELIVERED')
  on conflict (dedup_key) where dedup_key is not null do nothing;
  get diagnostics v_n = row_count;
  return v_n;
end $$;
revoke all on function wf_enqueue_daily(timestamptz) from public, anon, authenticated;

do $g$
begin
  if (select count(*) from pg_trigger where tgname = 'sailings_workflows' and not tgisinternal) <> 1 then
    raise exception '0096: brak wyzwalacza sailings_workflows';
  end if;
  if (select bool_and(prosecdef) from pg_proc where proname in ('wf_enqueue_sailing', 'wf_enqueue_daily')) is not true then
    raise exception '0096: funkcje kolejkowania muszą być SECURITY DEFINER';
  end if;
  if (select bool_or(has_function_privilege(r, 'wf_enqueue_daily(timestamptz)', 'execute'))
        from unnest(array['anon', 'authenticated']) r) is not false then
    raise exception '0096: wf_enqueue_daily tylko dla service_role';
  end if;
  if (array['FERRY_STATUS', 'CRON_DAILY_06'] <@ wf_trigger_types()) is not true then
    raise exception '0096: katalog wyzwalaczy bez FERRY_STATUS / CRON_DAILY_06';
  end if;
  if to_regclass('cron.job') is not null then
    if exists (select 1 from cron.job where command ilike '%wf_enqueue_daily%' or command ilike '%workflow_worker%') then
      raise exception '0096: zadanie cykliczne silnika reguł istnieje — włączenie wyłącznie decyzją właściciela';
    end if;
  end if;
end $g$;
