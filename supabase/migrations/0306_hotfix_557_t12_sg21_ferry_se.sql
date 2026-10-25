-- #557 PILNE: T-12 nadal FERRY po dopłynięciu; SG-21 zły rejs (Nova Star) + AT_PORT_GDANSK.
-- Krótki PR: korekta danych (rejs SG-21 = Wawel T-12; przejście SE z pozycji).
-- Reguły awaryjne (AIS-dopłynięcie, stary punkt emtrack, zły rejs) — osobny PR.
-- Strefy 10/10 już aktywne (właściciel 25.10) — bez zmiany geofences.
-- TEST bez tych kodów → no-op. Produkcja: kopia R2 przed db push (jak inne hotfixy).

do $fix557$
declare
  v_prev   text;
  v_t12    uuid;
  v_sg21   uuid;
  v_wawel  uuid;
  v_old_s  uuid;
  v_st     text;
  v_arr    timestamptz;
  v_dep    timestamptz;
  v_lat    double precision;
  v_lon    double precision;
  v_ts     timestamptz;
  v_before text;
  v_ok     boolean;
  r        record;
  n_fix   int := 0;
begin
  v_prev := current_setting('tower.bulk_quiet', true);
  perform set_config('tower.bulk_quiet', 'on', true);

  select l.id, l.sailing_id
    into v_t12, v_wawel
    from public.loads l
    join public.shipment_items si on si.load_id = l.id and si.shipment_code = 'T-12'
   order by si.shipment_code
   limit 1;

  select l.id, l.sailing_id, l.status::text
    into v_sg21, v_old_s, v_st
    from public.loads l
    join public.shipment_items si on si.load_id = l.id and si.shipment_code = 'SG-21'
   order by si.shipment_code
   limit 1;

  /* Bez T-12 / Wawel na TEST — koniec. */
  if v_t12 is null or v_wawel is null then
    perform set_config('tower.bulk_quiet', coalesce(v_prev, ''), true);
    return;
  end if;

  select s.actual_arrival_at,
         coalesce(s.actual_departure_at, s.delayed_departure_at, s.departure_at)
    into v_arr, v_dep
    from public.sailings s
   where s.id = v_wawel;

  /* 1) SG-21 → ten sam rejs co T-12 (Wawel 24.10). */
  if v_sg21 is not null and v_old_s is distinct from v_wawel then
    insert into public.audit_log (user_id, action, entity, entity_id, new_value)
    values (
      null, 'HOTFIX_557_BEFORE', 'loads', v_sg21::text,
      jsonb_build_object(
        'code', 'SG-21',
        'status', v_st,
        'sailing_id', v_old_s,
        'target_sailing_id', v_wawel,
        'hotfix', '0306'
      )
    );

    update public.loads
       set sailing_id = v_wawel,
           updated_at = now()
     where id = v_sg21;

    insert into public.load_events (load_id, event_type, occurred_at, payload)
    values (
      v_sg21,
      'SAILING_ASSIGNED',
      now(),
      jsonb_build_object(
        'sailing_id', v_wawel,
        'from_sailing_id', v_old_s,
        'note', 'korekta: auto popłynęło Wawelem 24.10 (pozycja emtrack w Nynäshamn 25.10)',
        'actor', 'system',
        'hotfix', '0306'
      )
    );

    insert into public.audit_log (user_id, action, entity, entity_id, new_value)
    values (
      null, 'HOTFIX_557_SAILING', 'loads', v_sg21::text,
      jsonb_build_object(
        'code', 'SG-21',
        'from_sailing_id', v_old_s,
        'to_sailing_id', v_wawel,
        'hotfix', '0306'
      )
    );
    n_fix := n_fix + 1;

    select l.status::text into v_st from public.loads l where l.id = v_sg21;
  end if;

  /* 2) SG-21 w AT_PORT_GDANSK mimo wypłynięcia Wawelu → FERRY (jak T-12). */
  if v_sg21 is not null
     and v_dep is not null
     and v_st = 'AT_PORT_GDANSK'
     and public.load_status_rank('AT_PORT_GDANSK'::public.load_status)
         < public.load_status_rank('FERRY'::public.load_status) then
    v_ok := public.auto_set_status(
      v_sg21,
      'AT_PORT_GDANSK'::public.load_status,
      'FERRY'::public.load_status,
      'wypłynięcie rejsu (AIS) — korekta #557 (Wawel 24.10)',
      v_dep,
      jsonb_build_object(
        'actor', 'system',
        'source', 'AIS',
        'hotfix', '0306',
        'sailing_id', v_wawel
      )
    );
    insert into public.audit_log (user_id, action, entity, entity_id, new_value)
    values (
      null, 'HOTFIX_557_FERRY', 'loads', v_sg21::text,
      jsonb_build_object('code', 'SG-21', 'ok', v_ok, 'hotfix', '0306')
    );
    if v_ok is true then
      n_fix := n_fix + 1;
    end if;
  end if;

  /* 3) T-12 i SG-21: FERRY → Port SE / Droga SE z pozycji SE (#485). */
  for r in
    select l.id as load_id, l.status::text as status, si.shipment_code as code
      from public.loads l
      join public.shipment_items si on si.load_id = l.id
     where si.shipment_code in ('T-12', 'SG-21')
       and l.status in ('FERRY', 'AT_PORT_NYNASHAMN')
  loop
    v_lat := null;
    v_lon := null;
    v_ts := null;

    select st_y(p.geom_raw::geometry), st_x(p.geom_raw::geometry), p.ts
      into v_lat, v_lon, v_ts
      from public.positions p
     where p.load_id = r.load_id
       and (v_arr is null or p.ts >= v_arr)
       and st_covers(public.sweden_land_geom(), p.geom_raw::geometry)
     order by p.ts asc
     limit 1;

    /* Bez pozycji po arrival — najnowsza na lądzie SE (strefa była wyłączona). */
    if v_lat is null then
      select st_y(p.geom_raw::geometry), st_x(p.geom_raw::geometry), p.ts
        into v_lat, v_lon, v_ts
        from public.positions p
       where p.load_id = r.load_id
         and st_covers(public.sweden_land_geom(), p.geom_raw::geometry)
       order by p.ts desc
       limit 1;
    end if;

    if v_lat is null then
      continue;
    end if;

    v_before := r.status;
    insert into public.audit_log (user_id, action, entity, entity_id, new_value)
    values (
      null, 'HOTFIX_557_SE_BEFORE', 'loads', r.load_id::text,
      jsonb_build_object(
        'code', r.code, 'status', v_before, 'lat', v_lat, 'lon', v_lon,
        'pos_at', v_ts, 'arrival', v_arr, 'hotfix', '0306'
      )
    );

    perform public.apply_ferry_se_from_position(r.load_id, v_lat, v_lon, v_ts);

    insert into public.audit_log (user_id, action, entity, entity_id, new_value)
    values (
      null, 'HOTFIX_557_SE_AFTER', 'loads', r.load_id::text,
      jsonb_build_object(
        'code', r.code,
        'from', v_before,
        'to', (select status::text from public.loads where id = r.load_id),
        'hotfix', '0306',
        'pos_at', v_ts
      )
    );
    n_fix := n_fix + 1;
  end loop;

  insert into public.audit_log (user_id, action, entity, entity_id, new_value)
  values (
    null, 'HOTFIX_557_DONE', 'migration', '0306',
    jsonb_build_object('n_fix', n_fix, 't12', v_t12, 'sg21', v_sg21, 'wawel', v_wawel)
  );

  perform set_config('tower.bulk_quiet', coalesce(v_prev, ''), true);
end $fix557$;
