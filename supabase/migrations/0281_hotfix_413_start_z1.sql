-- #413 / E35 Z1 — porządki reguł START-1…7 (D-20261021-2057-01, D-20261016-0220-01).
-- Soft-delete (`removed_at`): przebiegi i historia zostają (FK workflow_runs ON DELETE CASCADE).
-- START-1/2 → macierz E11 (pre_arrival_*/pre_port) + F7 B1: trg_geofence_matrix_notify przekazuje kind/country;
-- START-3…7 zbędne (wbudowane / bez POD). Cofnięcie START wymaga migracji (strażnik blokuje też service_role).

select set_config('tower.audit_source', 'migracja 0281 (#413 E35 Z1 START)', true);

alter table public.workflows add column if not exists removed_at timestamptz;
comment on column public.workflows.removed_at is
  '#413 E35 Z1: soft-delete — reguła znika z listy; przebiegi i audit zostają.';

-- Nie włączaj ponownie usuniętej START; nie czyść removed_at z UI.
create or replace function public.wf_guard_start_removed() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (old.code like 'START-%' and old.removed_at is not null) is true then
    if (new.removed_at is null) is true then
      raise exception 'workflows: reguły START po usunięciu (E35 Z1) nie przywraca się';
    end if;
    if (new.enabled is true) is true then
      raise exception 'workflows: reguły START po usunięciu (E35 Z1) nie włącza się';
    end if;
  end if;
  return new;
end $$;
revoke all on function public.wf_guard_start_removed() from public, anon, authenticated;
drop trigger if exists workflows_guard_start_removed on public.workflows;
create trigger workflows_guard_start_removed
  before update on public.workflows
  for each row execute function public.wf_guard_start_removed();

-- Enqueue: pomijaj removed_at (obok enabled).
create or replace function public.wf_enqueue_event() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if current_setting('tower.bulk_quiet', true) = 'on' then
    return null;
  end if;
  if (coalesce(new.payload->>'korekta', '') = 'true') is true then
    return null;
  end if;
  insert into workflow_runs (workflow_id, load_id, event_id, status, attempts, next_attempt_at, dedup_key, payload)
  select w.id, new.load_id, new.id, 'QUEUED', 0, now(), 'wf:' || w.id || ':ev:' || new.id,
         jsonb_build_object('event_type', new.event_type, 'occurred_at', new.occurred_at, 'payload', new.payload)
    from workflows w join loads l on l.id = new.load_id
   where w.enabled and w.removed_at is null
     and w.trigger_type = new.event_type and w.project_id = l.project_id
  on conflict (dedup_key) where dedup_key is not null do nothing;
  return null;
exception when others then
  raise warning 'wf_enqueue_event: %', sqlerrm;
  return null;
end $$;
revoke all on function public.wf_enqueue_event() from public, anon, authenticated;

create or replace function public.wf_enqueue_status() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if current_setting('tower.bulk_quiet', true) = 'on' then
    return null;
  end if;
  if new.status is not distinct from old.status then return null; end if;
  insert into workflow_runs (workflow_id, load_id, status, attempts, next_attempt_at, dedup_key, payload)
  select w.id, new.id, 'QUEUED', 0, now(),
         'wf:' || w.id || ':st:' || new.id || ':' || new.status || ':' || (extract(epoch from clock_timestamp()) * 1000)::bigint,
         jsonb_build_object('event_type', 'STATUS_CHANGED', 'occurred_at', now(),
                            'payload', jsonb_build_object('status', new.status, 'old_status', old.status))
    from workflows w
   where w.enabled and w.removed_at is null
     and w.trigger_type = 'STATUS_CHANGED' and w.project_id = new.project_id
  on conflict (dedup_key) where dedup_key is not null do nothing;
  return null;
exception when others then
  raise warning 'wf_enqueue_status: %', sqlerrm;
  return null;
end $$;
revoke all on function public.wf_enqueue_status() from public, anon, authenticated;

create or replace function public.wf_enqueue_risk() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.load_id is null or coalesce(new.dedup_key, '') like 'WF:%' then return null; end if;
  insert into workflow_runs (workflow_id, load_id, status, attempts, next_attempt_at, dedup_key, payload)
  select w.id, new.load_id, 'QUEUED', 0, now(), 'wf:' || w.id || ':risk:' || new.id,
         jsonb_build_object('event_type', 'RISK_RAISED', 'occurred_at', now(),
                            'payload', jsonb_build_object('risk_id', new.id, 'kind', new.kind, 'severity', new.severity,
                                                          'title_key', new.title_key))
    from workflows w
   where w.enabled and w.removed_at is null
     and w.trigger_type = 'RISK_RAISED' and w.project_id = new.project_id
  on conflict (dedup_key) where dedup_key is not null do nothing;
  return null;
exception when others then
  raise warning 'wf_enqueue_risk: %', sqlerrm;
  return null;
end $$;
revoke all on function public.wf_enqueue_risk() from public, anon, authenticated;

create or replace function public.wf_enqueue_sailing() returns trigger
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
     and w.enabled and w.removed_at is null and w.trigger_type = 'FERRY_STATUS'
  on conflict (dedup_key) where dedup_key is not null do nothing;
  return null;
exception when others then
  raise warning 'wf_enqueue_sailing: %', sqlerrm;
  return null;
end $$;
revoke all on function public.wf_enqueue_sailing() from public, anon, authenticated;

create or replace function public.wf_enqueue_daily(p_now timestamptz default now()) returns int
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
   where w.enabled and w.removed_at is null and w.trigger_type = 'CRON_DAILY_06'
     and l.status not in ('CANCELLED', 'DELIVERED')
  on conflict (dedup_key) where dedup_key is not null do nothing;
  get diagnostics v_n = row_count;
  return v_n;
end $$;
revoke all on function public.wf_enqueue_daily(timestamptz) from public, anon, authenticated;

create or replace function public.workflow_worker(p_limit int default 50, p_now timestamptz default now()) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r workflow_runs; w workflows; v_ctx jsonb; v_out jsonb; v_act jsonb;
        n_ok int := 0; n_skip int := 0; n_retry int := 0; n_dead int := 0;
begin
  if (p_limit between 1 and 500) is not true then raise exception 'workflow_worker: p_limit 1–500'; end if;
  if p_now is null then raise exception 'workflow_worker: p_now wymagane'; end if;
  for r in select * from workflow_runs
            where status in ('QUEUED', 'RETRY') and coalesce(next_attempt_at, ran_at) <= p_now
            order by id limit p_limit for update skip locked loop
    select * into w from workflows where id = r.workflow_id;
    if w.id is null or w.enabled is not true or w.removed_at is not null then
      update workflow_runs set status = 'SKIPPED', finished_at = p_now,
             result = jsonb_build_object('reason', 'reguła wyłączona') where id = r.id;
      n_skip := n_skip + 1; continue;
    end if;
    begin
      v_ctx := coalesce(r.payload, '{}'::jsonb) || jsonb_build_object('load', coalesce(wf_load_context(r.load_id), '{}'::jsonb));
      if wf_truthy(wf_logic(w.condition, v_ctx)) is not true then
        update workflow_runs set status = 'SKIPPED', attempts = r.attempts + 1, finished_at = p_now,
               result = jsonb_build_object('reason', 'warunek niespełniony') where id = r.id;
        n_skip := n_skip + 1; continue;
      end if;
      v_out := '[]'::jsonb;
      for v_act in select * from jsonb_array_elements(w.actions) loop
        v_out := v_out || jsonb_build_array(wf_action(w, r, v_act, v_ctx));
      end loop;
      update workflow_runs set status = 'OK', attempts = r.attempts + 1, finished_at = p_now,
             result = jsonb_build_object('actions', v_out) where id = r.id;
      n_ok := n_ok + 1;
    exception when others then
      if r.attempts + 1 >= 5 then
        update workflow_runs set status = 'DEAD', attempts = r.attempts + 1, finished_at = p_now,
               result = jsonb_build_object('error', sqlerrm) where id = r.id;
        n_dead := n_dead + 1;
      else
        update workflow_runs set status = 'RETRY', attempts = r.attempts + 1,
               next_attempt_at = p_now + make_interval(mins => (2 ^ (r.attempts + 1))::int),
               result = jsonb_build_object('error', sqlerrm) where id = r.id;
        n_retry := n_retry + 1;
      end if;
    end;
  end loop;
  return jsonb_build_object('ok', n_ok, 'skipped', n_skip, 'retry', n_retry, 'dead', n_dead);
end $$;
revoke all on function public.workflow_worker(int, timestamptz) from public, anon, authenticated;

-- Soft-delete START + wpisy historii z powodami (E35 pkt 2 / demo HIST).
do $z1$
declare
  r record;
  v_reason text;
  v_what text;
  v_n int := 0;
begin
  if (select count(*) from notification_matrix
        where event_key in ('pre_arrival_site', 'pre_arrival_srem', 'pre_port')) < 10 then
    raise exception '0281: brak zdarzeń E11 dla START-1/2 (pre_arrival_*/pre_port)';
  end if;

  for r in
    select id, code, name, project_id from workflows
     where code like 'START-%' and removed_at is null
  loop
    v_what := null;
    case
      when r.code in ('START-1', 'START-2') then
        v_reason := 'przeniesione do „Kto co dostaje”: „Auto 50 km przed placem / przed Śremem”, „Auto 20 km przed portem”';
        v_what := 'ci sami odbiorcy co dziś';
      when r.code = 'START-3' then
        v_reason := 'bez POD — podpisany CMR jest w Dokumentach (decyzja właściciela)';
      when r.code in ('START-4', 'START-5', 'START-6') then
        v_reason := 'wbudowane automaty robią to samo';
      when r.code = 'START-7' then
        v_reason := 'anulowanie liczy dopłatę i powiadamia według „Kto co dostaje”, bez sprawy „brak zasobów”';
      else
        v_reason := 'E35 Z1 — porządki reguł START';
    end case;

    update workflows
       set enabled = false, removed_at = now()
     where id = r.id;

    insert into audit_log (user_id, action, entity, entity_id, old_value, new_value, source)
    values (
      null, 'ROW_DELETE', 'workflows', r.id::text,
      jsonb_build_object('code', r.code, 'name', r.name),
      jsonb_build_object('removed', true, 'reason', v_reason, 'what', v_what, 'code', r.code, 'name', r.name),
      'migracja 0281 (#413 E35 Z1)'
    );
    v_n := v_n + 1;
  end loop;

  if (select count(*) from workflows where code like 'START-%' and removed_at is null) <> 0 then
    raise exception '0281: zostały aktywne reguły START';
  end if;
  if (select count(*) from workflows where code like 'START-%' and enabled) <> 0 then
    raise exception '0281: START nie mogą być włączone';
  end if;
  -- Idempotentnie: brak START (świeży seed bez 0094) = v_n=0, bez wyjątku.
end $z1$;

-- F7 #495 runda 2 B1: payload do macierzy z geofence_kind + geofence_country
-- (notify_event_key → pre_arrival_site / pre_arrival_srem / pre_port zamiast zone).
create or replace function public.trg_geofence_matrix_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_proj uuid;
  v_tpl text;
  v_fence text;
  v_gid uuid;
  v_kind text;
  v_country text;
  v_name text;
begin
  if new.event_type not in ('GEOFENCE_ENTER', 'GEOFENCE_EXIT') then
    return null;
  end if;
  v_tpl := case new.event_type when 'GEOFENCE_ENTER' then 'ZONE_ENTER' else 'ZONE_EXIT' end;

  begin
    v_gid := nullif(new.payload->>'geofence_id', '')::uuid;
  exception when others then
    v_gid := null;
  end;

  if v_gid is not null then
    select g.kind::text, g.country, g.name
      into v_kind, v_country, v_name
      from geofences g
     where g.id = v_gid;
  end if;

  v_kind := coalesce(nullif(v_kind, ''), nullif(new.payload->>'geofence_kind', ''));
  v_country := coalesce(
    nullif(v_country, ''),
    nullif(new.payload->>'geofence_country', ''),
    nullif(new.payload->>'country', '')
  );
  v_name := coalesce(
    nullif(v_name, ''),
    nullif(new.payload->>'geofence_name', ''),
    nullif(new.payload->>'name', '')
  );

  v_fence := coalesce(
    nullif(new.payload->>'geofence_id', ''),
    coalesce(v_kind, '') || ':' || coalesce(v_name, ''),
    'x'
  );
  select project_id into v_proj from loads where id = new.load_id;
  perform public.matrix_notify(
    'LOAD_STATUS', v_tpl, new.load_id, v_proj,
    jsonb_build_object(
      'load_id', new.load_id,
      'event', new.event_type,
      'geofence_id', new.payload->>'geofence_id',
      'geofence_name', v_name,
      'geofence_kind', v_kind,
      'geofence_country', v_country
    ),
    'zone:' || new.event_type || ':' || new.load_id::text || ':' || v_fence
  );
  return null;
end $$;
revoke all on function public.trg_geofence_matrix_notify() from public, anon, authenticated;
comment on function public.trg_geofence_matrix_notify() is
  '#413 F7: ZONE_* z geofence_kind/country → pre_arrival_*/pre_port w macierzy E11.';
