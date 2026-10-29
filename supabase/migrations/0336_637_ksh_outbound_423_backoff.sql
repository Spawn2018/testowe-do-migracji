-- #637 F7: HTTP 423 (plik otwarty) = stan przejściowy, nie błąd.
-- pending z rosnącym odstępem 5→15→30→60 min; sprawa HHL dopiero po 4 h;
-- po udanym zapisie sprawa zamyka się sama. Numer 0336 (0335 = 27B ETA na #638).

begin;

alter table public.ksh_sync_outbound
  add column if not exists retry_after timestamptz,
  add column if not exists locked_since timestamptz;

comment on column public.ksh_sync_outbound.retry_after is
  '#637: nie bierz do zapisu przed tą chwilą (backoff po 423).';
comment on column public.ksh_sync_outbound.locked_since is
  '#637: pierwszy 423 w bieżącej serii; sprawa HHL gdy > 4 h.';

-- Przywróć failed z 423 do kolejki (reguła: 423 ≠ failed).
update public.ksh_sync_outbound
   set status = 'pending',
       done_at = null,
       retry_after = null,
       locked_since = coalesce(locked_since, updated_at, now() - interval '1 hour'),
       last_error = 'upload_http_423',
       rev = rev + 1
 where status = 'failed'
   and last_error = 'upload_http_423';

-- Także wstrzymane ręcznie przy 423 (paused) → z powrotem pending.
update public.ksh_sync_outbound
   set status = 'pending',
       done_at = null,
       retry_after = null,
       locked_since = coalesce(locked_since, updated_at, now() - interval '1 hour'),
       last_error = 'upload_http_423',
       rev = rev + 1
 where status = 'skipped'
   and last_error = 'paused_423_file_locked';

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

-- 423: zostaje pending; backoff; sprawa dopiero po 4 h (jedna na projekt).
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
      perform decision_open_from_event(
        r.project_id, 'TOWER_KSH_CONFLICT',
        'l1b:file-locked:' || r.project_id::text,
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

-- Po udanym PUT: wyczyść backoff (inne pending) i zamknij sprawę file-locked.
create or replace function public.ksh_sync_outbound_clear_423(p_project uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
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
  update public.decisions
     set status = 'RESOLVED',
         resolution_code = 'AUTO_CLOSED',
         resolved_at = now(),
         updated_at = now()
   where status is distinct from 'RESOLVED'
     and detail->>'event_key' = 'l1b:file-locked:' || p_project::text;
end;
$$;

revoke all on function public.ksh_sync_outbound_clear_423(uuid) from public, anon, authenticated;
grant execute on function public.ksh_sync_outbound_clear_423(uuid) to service_role;

commit;
