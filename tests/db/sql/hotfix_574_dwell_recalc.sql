-- #574-nast: przelicz GEOFENCE_DWELL.payload (dwell_min/minutes/entered_at) per strefa.
-- Wołane z migracji 0312 i z tests/db/status.sh ($PSQL -f).
create or replace function public.hotfix_574_dwell_recalc()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_load   uuid := '95ab7218-69cc-490d-8b68-b379c3ed9aae';
  v_dwell  record;
  v_enter  timestamptz;
  v_min    numeric;
  v_n      int := 0;
  v_need   int := 0;
  v_code   text;
begin
  if not exists (select 1 from loads where id = v_load) then
    raise notice '#574-nast: SG-23 (%) nie znaleziony — pomijam przeliczenie DWELL', v_load;
    return;
  end if;

  v_code := public.load_sms_code(v_load);
  if v_code is distinct from 'SG-23' then
    raise exception '#574-nast: ładunek % ma load_sms_code=% (oczekiwano SG-23)', v_load, v_code;
  end if;

  select count(*) into v_need
    from load_events e
   where e.load_id = v_load
     and e.event_type = 'GEOFENCE_DWELL'
     and e.payload->>'geofence_kind' = 'SITE'
     and exists (
           select 1 from load_events en
            where en.load_id = v_load
              and en.event_type = 'GEOFENCE_ENTER'
              and en.payload->>'geofence_kind' = 'SITE'
              and en.payload->>'geofence_id' is not distinct from e.payload->>'geofence_id'
              and en.occurred_at <= e.occurred_at
         )
     and (
       (e.payload->>'entered_at')::timestamptz is distinct from (
         select max(en.occurred_at) from load_events en
          where en.load_id = v_load
            and en.event_type = 'GEOFENCE_ENTER'
            and en.payload->>'geofence_kind' = 'SITE'
            and en.payload->>'geofence_id' is not distinct from e.payload->>'geofence_id'
            and en.occurred_at <= e.occurred_at
       )
       or (e.payload->>'dwell_min')::numeric is distinct from round(
         extract(epoch from (
           e.occurred_at - (
             select max(en.occurred_at) from load_events en
              where en.load_id = v_load
                and en.event_type = 'GEOFENCE_ENTER'
                and en.payload->>'geofence_kind' = 'SITE'
                and en.payload->>'geofence_id' is not distinct from e.payload->>'geofence_id'
                and en.occurred_at <= e.occurred_at
           )
         )) / 60.0
       )
     );

  if v_need = 0 then
    raise notice '#574-nast: SG-23 DWELL bez zmian (0 wierszy)';
    return;
  end if;

  alter table public.load_events disable trigger trg_load_events_immutable;

  for v_dwell in
    select e.id, e.occurred_at, e.payload
      from load_events e
     where e.load_id = v_load
       and e.event_type = 'GEOFENCE_DWELL'
       and e.payload->>'geofence_kind' = 'SITE'
  loop
    select max(en.occurred_at) into v_enter
      from load_events en
     where en.load_id = v_load
       and en.event_type = 'GEOFENCE_ENTER'
       and en.payload->>'geofence_kind' = 'SITE'
       and en.payload->>'geofence_id' is not distinct from v_dwell.payload->>'geofence_id'
       and en.occurred_at <= v_dwell.occurred_at;

    if v_enter is null then
      continue;
    end if;

    v_min := round(extract(epoch from (v_dwell.occurred_at - v_enter)) / 60.0);

    update load_events e
       set payload = e.payload
         || jsonb_build_object(
              'entered_at', v_enter,
              'dwell_min', v_min,
              'minutes', v_min
            )
     where e.id = v_dwell.id
       and (
         (e.payload->>'entered_at')::timestamptz is distinct from v_enter
         or (e.payload->>'dwell_min')::numeric is distinct from v_min
       );

    if found then
      v_n := v_n + 1;
    end if;
  end loop;

  alter table public.load_events enable trigger trg_load_events_immutable;
  raise notice '#574-nast: SG-23 DWELL przeliczony, wierszy=%', v_n;
exception
  when others then
    begin
      alter table public.load_events enable trigger trg_load_events_immutable;
    exception when others then
      null;
    end;
    raise;
end;
$$;
