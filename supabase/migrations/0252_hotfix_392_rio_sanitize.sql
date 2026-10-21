-- 0252 — HOTFIX #392: loads_rio_sanitize czyści RIO przy zmianie linku na nie-RIO
-- oraz przy zmianie identyfikatora RIO (bez przenoszenia starego secret).
-- Jednorazowo: transporty z „przyklejonym” RIO (m.in. SG-18) — rio_* puste, audit bez klucza.

create or replace function public.loads_rio_sanitize()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ref text;
  v_id text;
  v_secret text;
  v_old_id text;
  v_id_changed boolean;
begin
  v_ref := nullif(btrim(coalesce(new.telematics_vehicle_id, '')), '');
  if TG_OP = 'UPDATE' then
    v_old_id := nullif(btrim(coalesce(old.rio_tracking_id, '')), '');
  else
    v_old_id := null;
  end if;

  if v_ref is null then
    new.rio_tracking_id := null;
    new.rio_secret := null;
    new.rio_check_state := null;
    new.rio_check_at := null;
    new.rio_asset_name := null;
    new.rio_tracker_on := null;
    new.rio_valid_from := null;
    new.rio_valid_to := null;
    new.rio_last_fix_at := null;
    return new;
  end if;

  if v_ref ~* '^rio:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    v_id := lower(substring(v_ref from 5));
    new.telematics_vehicle_id := 'rio:' || v_id;
    v_id_changed := (v_old_id is distinct from v_id);
    new.rio_tracking_id := v_id;
    -- Forma rio:<uuid> nie niesie secret — przy zmianie id wyczyść stary klucz.
    if v_id_changed then
      new.rio_secret := null;
      new.rio_check_state := 'pending';
      new.rio_check_at := now();
      new.rio_asset_name := null;
      new.rio_tracker_on := null;
      new.rio_valid_from := null;
      new.rio_valid_to := null;
      new.rio_last_fix_at := null;
    end if;
    return new;
  end if;

  if v_ref ~* 'position-sharing\.rio\.cloud' or v_ref ~* '[?&]secret=' then
    v_id := (regexp_match(v_ref, '([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})', 'i'))[1];
    v_secret := (regexp_match(v_ref, '[?&]secret=([^&\s#]+)', 'i'))[1];
    if (v_id is not null) is not true then
      raise exception 'Link RIO bez identyfikatora' using errcode = '22023';
    end if;
    v_id := lower(v_id);
    v_id_changed := (v_old_id is distinct from v_id);
    new.rio_tracking_id := v_id;
    new.telematics_vehicle_id := 'rio:' || v_id;
    if v_secret is not null then
      new.rio_secret := v_secret;
    elsif v_id_changed then
      -- Nowy lokalizator bez klucza w linku — nie łącz starego secret z nowym id.
      new.rio_secret := null;
    end if;
    if v_id_changed or new.rio_check_state is null then
      new.rio_check_state := 'pending';
      new.rio_check_at := now();
    end if;
    if v_id_changed then
      new.rio_asset_name := null;
      new.rio_tracker_on := null;
      new.rio_valid_from := null;
      new.rio_valid_to := null;
      new.rio_last_fix_at := null;
    end if;
    return new;
  end if;

  -- Link inny niż RIO (emtrack, numer, URL) — wyczyść wszystkie pola RIO (#392).
  new.rio_tracking_id := null;
  new.rio_secret := null;
  new.rio_check_state := null;
  new.rio_check_at := null;
  new.rio_asset_name := null;
  new.rio_tracker_on := null;
  new.rio_valid_from := null;
  new.rio_valid_to := null;
  new.rio_last_fix_at := null;
  return new;
end;
$$;

revoke all on function public.loads_rio_sanitize() from public, anon, authenticated;

-- Jednorazowo: „przyklejone” RIO przy linku nie-RIO (SG-18 i ewentualne inne).
-- Przez UPDATE telematics_vehicle_id = itself → wyzwalacz z nową logiką.
do $fix$
declare
  r record;
  n int := 0;
begin
  for r in
    select id, telematics_vehicle_id, rio_tracking_id is not null as had_id,
           rio_secret is not null as had_secret, rio_check_state
      from public.loads
     where rio_tracking_id is not null
       and (
         telematics_vehicle_id is null
         or (
           telematics_vehicle_id !~* '^rio:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
           and telematics_vehicle_id !~* 'position-sharing\.rio\.cloud'
           and telematics_vehicle_id !~* '[?&]secret='
         )
       )
  loop
    update public.loads
       set telematics_vehicle_id = telematics_vehicle_id
     where id = r.id;
    insert into public.audit_log (user_id, action, entity, entity_id, new_value)
    values (
      null,
      'HOTFIX_392_RIO_CLEAR',
      'loads',
      r.id::text,
      jsonb_build_object(
        'hotfix', '0252',
        'telematics_vehicle_id', left(coalesce(r.telematics_vehicle_id, ''), 80),
        'had_rio_tracking_id', r.had_id,
        'had_rio_secret', r.had_secret,
        'rio_check_state_before', r.rio_check_state
        -- bez wartości rio_secret
      )
    );
    n := n + 1;
  end loop;
  raise notice '0252: wyczyszczono przyklejone RIO na % transportach', n;
end
$fix$;
