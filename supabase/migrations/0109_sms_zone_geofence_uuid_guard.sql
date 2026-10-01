-- 0109 — I-2l/DEC-5: wyzwalacz SMS stref nie może wywalić INSERT load_events
-- przy niepoprawnym geofence_id (np. testowy „g-test”). Cast UUID w wyjątku.
-- Idempotentna, niedestrukcyjna.

create or replace function sms_zone_on_geofence_enter() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_kind text; v_name text; v_country char(2); v_list text; v_sms_kind text; v_place text;
  v_gid uuid;
begin
  if new.event_type is distinct from 'GEOFENCE_ENTER' then return null; end if;
  v_kind := new.payload->>'geofence_kind';
  v_name := coalesce(new.payload->>'geofence_name', '');
  begin
    v_gid := nullif(new.payload->>'geofence_id', '')::uuid;
  exception when others then
    v_gid := null;
  end;
  if v_gid is not null then
    select g.country into v_country from geofences g where g.id = v_gid;
  end if;

  v_list := null; v_sms_kind := null;
  if v_kind = 'LOADING' and coalesce(v_country, 'PL') = 'PL' then
    v_list := 'LOAD_SREM'; v_sms_kind := 'ZONE_ENTER'; v_place := 'zaladunek Srem';
  elsif v_kind = 'PRE_ARRIVAL' and coalesce(v_country, 'PL') = 'PL' then
    v_list := 'LOAD_SREM'; v_sms_kind := 'ZONE_APPROACH'; v_place := 'Srem';
  elsif v_kind = 'SITE' and coalesce(v_country, 'SE') = 'SE' then
    v_list := 'UNLOAD_BODEN'; v_sms_kind := 'ZONE_ENTER'; v_place := 'plac Stegra Boden';
  elsif v_kind = 'PRE_ARRIVAL' and coalesce(v_country, 'SE') = 'SE' then
    v_list := 'UNLOAD_BODEN'; v_sms_kind := 'ZONE_APPROACH'; v_place := 'Boden';
  elsif v_name ilike '%Srem%' and v_kind = 'CUSTOM' then
    v_list := 'LOAD_SREM'; v_sms_kind := 'ZONE_APPROACH'; v_place := 'Srem';
  end if;

  if v_list is not null then
    perform sms_zone_enqueue_for_event(new.load_id, v_list, v_sms_kind, v_place, null);
  end if;
  return null;
end $$;
