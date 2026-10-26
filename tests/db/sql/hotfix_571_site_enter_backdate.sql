create or replace function public.hotfix_571_site_enter_backdate()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_load     uuid;
  v_enter    timestamptz;
  v_pt       geometry;
  v_gid      uuid;
  v_gname    text;
  v_notify   text[];
  v_tpl      text;
  v_row      record;
  v_first    timestamptz;
  v_first_pt geometry;
  v_fresh    boolean;
  v_prev     text;
begin
  /* SG-23: kod w shipment_items / load_sms_code — order_no bywa NULL. */
  select l.id into v_load
    from loads l
    join shipment_items si on si.load_id = l.id
   where si.shipment_code = 'SG-23'
   order by si.shipment_code
   limit 1;

  if v_load is null then
    select l.id into v_load
      from loads l
     where public.load_sms_code(l.id) = 'SG-23'
     order by l.created_at desc nulls last
     limit 1;
  end if;

  if v_load is null then
    raise notice '#571: SG-23 nie znaleziony (shipment_code / load_sms_code) — pomijam backdate';
  else
    select p.ts, p.geom_raw, g.id, g.name, g.notify_orgs, g.message_tpl
      into v_enter, v_pt, v_gid, v_gname, v_notify, v_tpl
      from positions p
      join geofence_states gs on gs.load_id = p.load_id
      join geofences g on g.id = gs.geofence_id and g.kind = 'SITE' and g.active is true
     where p.load_id = v_load
       and coalesce((p.raw->>'stale_point')::boolean, false) is not true
       and st_contains(g.geom, p.geom_raw::geometry)
     order by p.ts
     limit 1;

    if v_enter is null then
      raise exception '#571: SG-23 bez swiezej pozycji w SITE — nie moge backdate';
    end if;

    v_prev := current_setting('tower.bulk_quiet', true);
    perform set_config('tower.bulk_quiet', 'on', true);

    alter table load_events disable trigger trg_load_events_immutable;
    begin
      update load_events e set
        occurred_at = v_enter,
        geom = coalesce(v_pt, e.geom),
        payload = coalesce(e.payload, '{}'::jsonb)
                  || jsonb_build_object(
                       'confirm', 'hotfix_571_backdate',
                       'first_fix_at', v_enter::text,
                       'geofence_id', coalesce(e.payload->>'geofence_id', v_gid::text),
                       'geofence_kind', 'SITE',
                       'geofence_name', coalesce(e.payload->>'geofence_name', v_gname),
                       'notify_orgs', coalesce(e.payload->'notify_orgs', to_jsonb(v_notify)),
                       'message_tpl', coalesce(e.payload->>'message_tpl', v_tpl)
                     )
      where e.load_id = v_load
        and e.event_type = 'GEOFENCE_ENTER'
        and coalesce(e.payload->>'geofence_kind', '') = 'SITE'
        and e.occurred_at is distinct from v_enter;

      update load_events e set
        occurred_at = v_enter,
        payload = coalesce(e.payload, '{}'::jsonb)
                  || jsonb_build_object('confirm', 'hotfix_571_backdate')
      where e.load_id = v_load
        and e.event_type = 'STATUS_AUTO'
        and e.payload->>'to' = 'AT_SITE'
        and e.occurred_at is distinct from v_enter
        and not exists (
          select 1 from load_events z
           where z.load_id = e.load_id
             and z.event_type like 'STATUS_%'
             and z.payload->>'zastepuje' = e.id::text
        );

      update load_events e set
        payload = coalesce(e.payload, '{}'::jsonb)
                  || jsonb_build_object('entered_at', v_enter)
      where e.load_id = v_load
        and e.event_type = 'GEOFENCE_DWELL'
        and coalesce(e.payload->>'geofence_kind', '') = 'SITE';

      alter table load_events enable trigger trg_load_events_immutable;
    exception when others then
      alter table load_events enable trigger trg_load_events_immutable;
      raise;
    end;

    /* F7 r3: OUTSIDE nie wraca na plac; state tylko z PENDING_IN;
       entered_at tylko INSIDE / PENDING_OUT (czas zdarzeń bez zmiany stanu). */
    update geofence_states gs set
      entered_at = case
        when gs.state in ('INSIDE', 'PENDING_OUT') then v_enter
        else gs.entered_at
      end,
      state = case when gs.state = 'PENDING_IN' then 'INSIDE' else gs.state end,
      consec_fixes = case when gs.state = 'PENDING_IN' then 0 else gs.consec_fixes end,
      last_eval_at = greatest(gs.last_eval_at, v_enter)
    from geofences g
    where gs.load_id = v_load
      and g.id = gs.geofence_id
      and g.kind = 'SITE'
      and (
        (gs.state in ('INSIDE', 'PENDING_OUT') and gs.entered_at is distinct from v_enter)
        or gs.state = 'PENDING_IN'
      );

    perform set_config('tower.bulk_quiet', coalesce(v_prev, ''), true);
  end if;

  /* Inne: PENDING_IN na SITE → ENTER z czasem pierwszej pozycji po ostatnim EXIT. */
  for v_row in
    select gs.load_id, gs.geofence_id, g.name as geofence_name, g.geom,
           g.notify_orgs, g.message_tpl
      from geofence_states gs
      join geofences g on g.id = gs.geofence_id
      join loads l on l.id = gs.load_id
     where gs.state = 'PENDING_IN'
       and g.kind = 'SITE'
       and g.active is true
       and l.status::text not in ('UNLOADED', 'DELIVERED', 'READY_TO_INVOICE', 'INVOICED', 'CANCELLED')
  loop
    select p.ts, p.geom_raw into v_first, v_first_pt
      from positions p
     where p.load_id = v_row.load_id
       and coalesce((p.raw->>'stale_point')::boolean, false) is not true
       and st_contains(v_row.geom, p.geom_raw::geometry)
       and p.ts > coalesce((
             select max(e.occurred_at) from load_events e
              where e.load_id = v_row.load_id
                and e.event_type = 'GEOFENCE_EXIT'
                and (e.payload->>'geofence_id')::uuid = v_row.geofence_id
           ), '-infinity'::timestamptz)
     order by p.ts
     limit 1;

    if v_first is null then
      continue;
    end if;

    v_fresh := (now() - v_first) < interval '2 hours';
    v_prev := current_setting('tower.bulk_quiet', true);
    if v_fresh is not true then
      perform set_config('tower.bulk_quiet', 'on', true);
    end if;

    update geofence_states set
      state = 'INSIDE',
      consec_fixes = 0,
      entered_at = v_first,
      last_eval_at = now()
    where load_id = v_row.load_id
      and geofence_id = v_row.geofence_id
      and state = 'PENDING_IN';

    if found then
      insert into load_events (load_id, event_type, occurred_at, source, geom, payload, dedup_key)
      values (
        v_row.load_id, 'GEOFENCE_ENTER', v_first, 'TELEMATICS_API', v_first_pt,
        jsonb_build_object(
          'geofence_id', v_row.geofence_id,
          'geofence_kind', 'SITE',
          'geofence_name', v_row.geofence_name,
          'notify_orgs', to_jsonb(v_row.notify_orgs),
          'message_tpl', v_row.message_tpl,
          'confirm', 'hotfix_571_site_pending'
        ),
        'GEOFENCE_ENTER:' || v_row.load_id::text || ':' || v_row.geofence_id::text || ':'
          || to_char(v_first at time zone 'UTC', 'YYYYMMDDHH24MI')
      )
      on conflict (dedup_key) where dedup_key is not null do nothing;
    end if;

    perform set_config('tower.bulk_quiet', coalesce(v_prev, ''), true);
  end loop;
end;
$$;
