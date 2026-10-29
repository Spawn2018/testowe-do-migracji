-- #645 / #637: błędy przejściowe Graph (423/429/503/504/409) = pending + backoff.
-- 5→15→30→60 min; sprawa HHL >4 h; po udanym zapisie clear.
-- Numer 0336 (F7 #646 B6: 0335 zostaje dla #638 ETA).

begin;

alter table public.ksh_sync_outbound
  add column if not exists retry_after timestamptz,
  add column if not exists locked_since timestamptz;

comment on column public.ksh_sync_outbound.retry_after is
  '#645: nie bierz do zapisu przed tą chwilą (backoff po błędzie przejściowym).';
comment on column public.ksh_sync_outbound.locked_since is
  '#645: pierwszy błąd przejściowy w serii; sprawa HHL gdy > 4 h.';

-- B5: przywróć failed/paused z 423 / workbook_* tylko gdy nie ma nowszej łatki.
update public.ksh_sync_outbound o
   set status = 'pending',
       done_at = null,
       retry_after = null,
       locked_since = coalesce(o.locked_since, o.done_at, o.created_at, now() - interval '1 hour'),
       last_error = coalesce(nullif(btrim(o.last_error), ''), 'upload_http_423'),
       rev = o.rev + 1
 where o.status in ('failed', 'skipped')
   and (
     o.last_error in ('upload_http_423', 'paused_423_file_locked')
     or o.last_error like 'workbook_http_%'
   )
   and not exists (
     select 1 from public.ksh_sync_outbound p
      where p.load_id = o.load_id and p.status = 'pending'
   )
   and not exists (
     select 1 from public.ksh_sync_outbound n
      where n.load_id = o.load_id and n.id > o.id
   )
   and o.id = (
     select x.id from public.ksh_sync_outbound x
      where x.load_id = o.load_id
        and x.status in ('failed', 'skipped')
        and (
          x.last_error in ('upload_http_423', 'paused_423_file_locked')
          or x.last_error like 'workbook_http_%'
        )
      order by x.id desc
      limit 1
   );

create or replace function public.ksh_sync_outbound_list(p_project uuid, p_limit int default 50)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.ksh_sync_require_service();
  if p_project is null then
    return '[]'::jsonb;
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', o.id,
      'load_id', o.load_id,
      'code', o.shipment_code,
      'codes', coalesce((
        select jsonb_agg(si.shipment_code order by si.shipment_code)
          from public.shipment_items si
         where si.load_id = o.load_id
           and nullif(btrim(si.shipment_code), '') is not null
      ), jsonb_build_array(o.shipment_code)),
      'patch', o.patch,
      'expected_file', o.expected_file,
      'attempts', o.attempts,
      'rev', o.rev,
      'locked_since', o.locked_since,
      'retry_after', o.retry_after
    ) order by o.id)
    from (
      select * from public.ksh_sync_outbound
       where project_id = p_project
         and status = 'pending'
         and (retry_after is null or retry_after <= now())
       order by id
       limit greatest(1, least(coalesce(p_limit, 50), 200))
    ) o
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.ksh_sync_outbound_list(uuid, int) from public, anon, authenticated;
grant execute on function public.ksh_sync_outbound_list(uuid, int) to service_role;

-- 423: zostaje pending; backoff; sprawa dopiero po 4 h (jedna na serię locked_since — B3).
create or replace function public.ksh_sync_outbound_note_423(p_acks jsonb)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  a jsonb;
  r record;
  v_id bigint;
  v_rev int;
  v_n int := 0;
  v_attempts int;
  v_delay interval;
  v_locked timestamptz;
  v_code text;
  v_load_id uuid;
  v_event_key text;
begin
  perform public.ksh_sync_require_service();
  if p_acks is null or jsonb_typeof(p_acks) is distinct from 'array' then
    return 0;
  end if;

  for a in
    select el.value
      from jsonb_array_elements(p_acks) el(value)
      left join public.ksh_sync_outbound o
        on o.id = nullif(el.value->>'id', '')::bigint
     order by o.load_id nulls last, o.id nulls last
  loop
    v_id := nullif(a->>'id', '')::bigint;
    v_rev := nullif(a->>'rev', '')::int;
    if v_id is null or v_rev is null then
      continue;
    end if;

    select o.load_id into v_load_id from public.ksh_sync_outbound o where o.id = v_id;
    if v_load_id is null then
      continue;
    end if;
    perform 1 from public.loads where id = v_load_id for update;
    select o.* into r from public.ksh_sync_outbound o where o.id = v_id for update;
    if r.id is null
       or (r.status = 'pending' and r.rev is not distinct from v_rev) is not true then
      continue;
    end if;

    v_attempts := coalesce(r.attempts, 0) + 1;
    v_delay := case
      when v_attempts <= 1 then interval '5 minutes'
      when v_attempts = 2 then interval '15 minutes'
      when v_attempts = 3 then interval '30 minutes'
      else interval '60 minutes'
    end;
    v_locked := coalesce(r.locked_since, now());

    update public.ksh_sync_outbound
       set attempts = v_attempts,
           last_error = 'upload_http_423',
           locked_since = v_locked,
           retry_after = now() + v_delay,
           rev = rev + 1
     where id = r.id and status = 'pending' and rev = v_rev;
    if not found then
      continue;
    end if;
    v_n := v_n + 1;

    if v_locked <= now() - interval '4 hours' then
      v_code := nullif(btrim(coalesce(r.shipment_code, '')), '');
      if v_code is null then
        select nullif(btrim(si.shipment_code), '') into v_code
          from public.shipment_items si
         where si.load_id = r.load_id
         order by si.shipment_code
         limit 1;
      end if;
      -- B3: klucz z serią (epoch locked_since) — jedna sprawa na serię, nie na każdą próbę.
      v_event_key := 'l1b:file-locked:' || r.project_id::text
        || ':' || floor(extract(epoch from v_locked))::bigint::text;
      perform decision_open_from_event(
        r.project_id, 'TOWER_KSH_CONFLICT',
        v_event_key,
        'Plik KSH otwarty — zapis czeka',
        jsonb_build_object(
          'code', coalesce(v_code, ''),
          'reason', 'upload_http_423',
          'locked_since', v_locked
        ),
        r.load_id, null
      );
    end if;
  end loop;
  return v_n;
end;
$$;

revoke all on function public.ksh_sync_outbound_note_423(jsonb) from public, anon, authenticated;
grant execute on function public.ksh_sync_outbound_note_423(jsonb) to service_role;

-- B4: wyczyść backoff; zamknij sprawy file-locked (prefiks) jak 0295.
create or replace function public.ksh_sync_outbound_clear_423(p_project uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_now timestamptz := now();
  v_note text := 'Zapis do pliku KSH wznowiony — sprawa file-locked zamknięta';
  v_prefix text;
begin
  perform public.ksh_sync_require_service();
  if p_project is null then
    return;
  end if;
  update public.ksh_sync_outbound
     set locked_since = null,
         retry_after = null
   where project_id = p_project
     and status = 'pending'
     and (locked_since is not null or retry_after is not null);

  v_prefix := 'l1b:file-locked:' || p_project::text;
  for r in
    select id
      from public.decisions
     where status in ('NEW', 'ASSIGNED', 'SNOOZED')
       and (
         detail->>'event_key' = v_prefix
         or detail->>'event_key' like v_prefix || ':%'
       )
     for update
  loop
    update public.decisions
       set status = 'RESOLVED',
           resolution_code = 'AUTO_CLOSED',
           resolution_note = v_note,
           resolved_at = v_now,
           updated_at = v_now
     where id = r.id
       and status in ('NEW', 'ASSIGNED', 'SNOOZED');
    if found then
      insert into public.decision_events (decision_id, actor_id, action, payload)
      values (
        r.id,
        null,
        'RESOLVE',
        jsonb_build_object(
          'option', 'AUTO_CLOSED',
          'effect', 'AUTO_CLOSED',
          'hotfix', '0336',
          'reason', v_note
        )
      );
      insert into public.audit_log (user_id, action, entity, entity_id, new_value)
      values (
        null,
        'DECISION_AUTO_CLOSED',
        'decisions',
        r.id::text,
        jsonb_build_object(
          'reason', v_note,
          'hotfix', '0336'
        )
      );
    end if;
  end loop;
end;
$$;

revoke all on function public.ksh_sync_outbound_clear_423(uuid) from public, anon, authenticated;
grant execute on function public.ksh_sync_outbound_clear_423(uuid) to service_role;

commit;
