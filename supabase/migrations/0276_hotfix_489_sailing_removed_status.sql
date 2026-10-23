-- #489 / PILNE: po odpięciu rejsu status FERRY (z AIS/SCHEDULE) wraca do poprzedniego.
-- Trigger na loads.sailing_id → null lub inny rejs; bez powiadomień i spraw.
-- Naprawa SG-18 + inne z sailing_id null i statusem z rejsu. Migracja 0276.

-- ---------------------------------------------------------------------------
-- 1. Cofnięcie statusu z odpiętego rejsu (wspólne: trigger + naprawa danych)
-- ---------------------------------------------------------------------------
create or replace function public.revert_status_after_sailing_removed(
  p_load uuid,
  p_old_sailing uuid,
  p_ts timestamptz default now(),
  p_actor text default null
) returns boolean
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_status text;
  v_ev_id bigint;
  v_from text;
  v_from_st public.load_status;
  v_src text;
  v_sail text;
  v_prev text;
  v_actor text;
  v_ok boolean := false;
  v_ts timestamptz := coalesce(p_ts, now());
begin
  if p_load is null or p_old_sailing is null then
    return false;
  end if;

  select l.status::text into v_status from public.loads l where l.id = p_load;
  if v_status is null
     or v_status not in ('FERRY', 'AT_PORT_GDANSK', 'AT_PORT_NYNASHAMN') then
    return false;
  end if;

  /* Najświeższy aktywny wpis osi dla bieżącego statusu. */
  select e.id,
         e.payload->>'from',
         e.payload->>'source',
         e.payload->>'sailing_id'
    into v_ev_id, v_from, v_src, v_sail
    from public.load_events e
   where e.load_id = p_load
     and (
       (e.event_type = 'STATUS_AUTO' and e.payload->>'to' = v_status)
       or e.event_type = 'STATUS_' || v_status
     )
     and not exists (
       select 1 from public.load_events z
        where z.load_id = e.load_id
          and z.payload->>'zastepuje' = e.id::text
     )
   order by e.id desc
   limit 1;

  if v_ev_id is null then
    return false;
  end if;

  /* Ręczny STATUS_<status> albo GPS — nie cofać. */
  if v_src is null
     or v_src not in ('AIS', 'SCHEDULE', 'SCHEDULE_ASSUMED') then
    return false;
  end if;

  /* Status z innego rejsu — nie ten odpięty. */
  if v_sail is not null and v_sail is distinct from p_old_sailing::text then
    return false;
  end if;

  if v_from is null then
    return false;
  end if;
  begin
    v_from_st := v_from::public.load_status;
  exception when others then
    return false;
  end;

  v_actor := nullif(btrim(coalesce(p_actor, '')), '');
  if v_actor is null then
    begin
      select coalesce(nullif(btrim(u.full_name), ''), split_part(u.email::text, '@', 1), '—')
             || ' // ' || coalesce(nullif(btrim(o.name), ''), nullif(btrim(o.code), ''), '—')
        into v_actor
        from public.app_users u
        left join public.organizations o on o.id = u.org_id
       where u.id = public.current_app_user_id();
    exception when others then
      v_actor := null;
    end;
  end if;
  v_actor := coalesce(v_actor, 'system');

  v_prev := current_setting('tower.bulk_quiet', true);
  perform set_config('tower.bulk_quiet', 'on', true);

  v_ok := public.auto_set_status(
    p_load,
    v_status::public.load_status,
    v_from_st,
    'rejs odpięty — powrót do poprzedniego statusu',
    v_ts,
    jsonb_build_object(
      'source', 'SAILING_REMOVED',
      'sailing_id', p_old_sailing,
      'zastepuje', v_ev_id,
      'cofniete', true,
      'actor', v_actor
    )
  );

  perform set_config('tower.bulk_quiet', coalesce(v_prev, ''), true);
  return coalesce(v_ok, false);
end
$fn$;

revoke all on function public.revert_status_after_sailing_removed(uuid, uuid, timestamptz, text)
  from public, anon, authenticated;
grant execute on function public.revert_status_after_sailing_removed(uuid, uuid, timestamptz, text)
  to service_role;
comment on function public.revert_status_after_sailing_removed(uuid, uuid, timestamptz, text) is
  '#489: cofnięcie FERRY/portu z AIS/SCHEDULE po odpięciu rejsu; bez powiadomień.';

-- ---------------------------------------------------------------------------
-- 2. Trigger: zmiana sailing_id (null albo inny rejs)
-- ---------------------------------------------------------------------------
create or replace function public.trg_loads_sailing_removed_status()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $trg$
declare
  v_actor text;
begin
  if tg_op is distinct from 'UPDATE' then
    return new;
  end if;
  if old.sailing_id is null then
    return new;
  end if;
  if new.sailing_id is not distinct from old.sailing_id then
    return new;
  end if;

  begin
    select coalesce(nullif(btrim(u.full_name), ''), split_part(u.email::text, '@', 1), '—')
           || ' // ' || coalesce(nullif(btrim(o.name), ''), nullif(btrim(o.code), ''), '—')
      into v_actor
      from public.app_users u
      left join public.organizations o on o.id = u.org_id
     where u.id = public.current_app_user_id();
  exception when others then
    v_actor := null;
  end;

  perform public.revert_status_after_sailing_removed(
    new.id, old.sailing_id, now(), v_actor
  );
  return new;
end
$trg$;

drop trigger if exists trg_loads_sailing_removed_status on public.loads;
create trigger trg_loads_sailing_removed_status
  after update of sailing_id on public.loads
  for each row
  execute function public.trg_loads_sailing_removed_status();

revoke all on function public.trg_loads_sailing_removed_status() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Naprawa danych: SG-18 + inne (sailing_id null, status z rejsu)
-- ---------------------------------------------------------------------------
do $fix489$
declare
  v_prev text;
  r record;
  v_load uuid;
  v_status text;
  v_from text;
  v_sail uuid;
  v_ev bigint;
  v_ok boolean;
  v_ts timestamptz := timestamptz '2026-10-23 11:05:13+00';
  n_fix int := 0;
begin
  v_prev := current_setting('tower.bulk_quiet', true);
  perform set_config('tower.bulk_quiet', 'on', true);

  /* SG-18 — godzina odpięcia z zgłoszenia. */
  select l.id, l.status::text
    into v_load, v_status
    from public.loads l
    join public.shipment_items si on si.load_id = l.id and si.shipment_code = 'SG-18'
   order by si.shipment_code
   limit 1;

  if v_load is not null and v_status = 'FERRY' then
    select e.id,
           nullif(e.payload->>'from', ''),
           nullif(e.payload->>'sailing_id', '')::uuid
      into v_ev, v_from, v_sail
      from public.load_events e
     where e.load_id = v_load
       and e.event_type = 'STATUS_AUTO'
       and e.payload->>'to' = 'FERRY'
       and e.payload->>'source' in ('AIS', 'SCHEDULE', 'SCHEDULE_ASSUMED')
       and not exists (
         select 1 from public.load_events z
          where z.load_id = e.load_id
            and z.payload->>'zastepuje' = e.id::text
       )
     order by e.id desc
     limit 1;

    /* 0270 mógł zapisać FERRY bez sailing_id w payload — wtedy placeholder. */
    if v_ev is not null then
      v_sail := coalesce(v_sail, '00000000-0000-0000-0000-000000000489'::uuid);
      insert into public.audit_log (user_id, action, entity, entity_id, new_value)
      values (
        null, 'HOTFIX_489_BEFORE', 'loads', v_load::text,
        jsonb_build_object(
          'code', 'SG-18', 'status', v_status, 'from', v_from,
          'sailing_id', v_sail, 'ev', v_ev
        )
      );
      v_ok := public.revert_status_after_sailing_removed(v_load, v_sail, v_ts, 'system');
      if v_ok is true then
        n_fix := n_fix + 1;
      end if;
      insert into public.audit_log (user_id, action, entity, entity_id, new_value)
      values (
        null, 'HOTFIX_489_SG18', 'loads', v_load::text,
        jsonb_build_object('ok', v_ok, 'to', coalesce(v_from, 'IN_TRANSIT_PL'), 'at', v_ts, 'hotfix', '0276')
      );
    end if;
  end if;

  /* Inne: sailing_id null + aktywny STATUS_AUTO z rejsu. */
  for r in
    select l.id as load_id,
           l.status::text as status,
           e.id as ev_id,
           e.payload->>'from' as prev_from,
           nullif(e.payload->>'sailing_id', '')::uuid as sailing_id
      from public.loads l
      join lateral (
        select e.*
          from public.load_events e
         where e.load_id = l.id
           and e.event_type = 'STATUS_AUTO'
           and e.payload->>'to' = l.status::text
           and e.payload->>'source' in ('AIS', 'SCHEDULE', 'SCHEDULE_ASSUMED')
           and not exists (
             select 1 from public.load_events z
              where z.load_id = e.load_id
                and z.payload->>'zastepuje' = e.id::text
           )
         order by e.id desc
         limit 1
      ) e on true
     where l.sailing_id is null
       and l.status in ('FERRY', 'AT_PORT_GDANSK', 'AT_PORT_NYNASHAMN')
       and (v_load is null or l.id is distinct from v_load)
  loop
    insert into public.audit_log (user_id, action, entity, entity_id, new_value)
    values (
      null, 'HOTFIX_489_BEFORE', 'loads', r.load_id::text,
      jsonb_build_object(
        'status', r.status, 'from', r.prev_from,
        'sailing_id', r.sailing_id, 'ev', r.ev_id
      )
    );
    v_ok := public.revert_status_after_sailing_removed(
      r.load_id,
      coalesce(r.sailing_id, '00000000-0000-0000-0000-000000000489'::uuid),
      now(),
      'system'
    );
    if v_ok is true then
      n_fix := n_fix + 1;
    end if;
  end loop;

  insert into public.audit_log (user_id, action, entity, entity_id, new_value)
  values (
    null, 'HOTFIX_489', 'migration', '0276',
    jsonb_build_object('fixed', n_fix, 'hotfix', '0276')
  );

  perform set_config('tower.bulk_quiet', coalesce(v_prev, ''), true);
end
$fix489$;
