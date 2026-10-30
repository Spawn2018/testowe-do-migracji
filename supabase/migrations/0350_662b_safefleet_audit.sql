-- #662-b — SafeFleet: mniej audytu polla, maska URL w audit_log, ok=false w przebiegu.
-- Źródło: F7 #663 (po 2941001). Przed powrotem do #661 BN2.

begin;

-- ---------------------------------------------------------------------
-- audit_row_change: v_skip pól polla SafeFleet (+ safefleet_token w v_secret).
-- Bazuje na 0314 (#583).
-- ---------------------------------------------------------------------
create or replace function public.audit_row_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_old jsonb; v_new jsonb; o jsonb; n jsonb; k text;
  v_skip constant text[] := array[
    'updated_at', 'eta_site', 'eta_confidence_min', 'eta_basis', 'eta_computed_at',
    'delay_minutes', 'fetched_at', 'beat_at', 'beats', 'last_seen_at',
    'rio_check_at', 'rio_last_fix_at',
    'safefleet_check_at', 'safefleet_last_fix_at', 'safefleet_error_streak',
    'safefleet_check_state', 'safefleet_trajectory_done'
  ];
  v_secret constant text[] := array['rio_secret', 'safefleet_token'];
  v_pii constant text[] := array[
    'driver_name', 'driver_phone', 'phone_national', 'phone', 'contact_phone',
    'contact_name', 'email_personal'
  ];
  v_keep_fee constant text[] := array['side', 'status', 'proposed_by_kind', 'load_id', 'amount_eur', 'kind'];
  v_keep_doc constant text[] := array['visible_to', 'category', 'load_id', 'file_name', 'uploaded_by'];
  v_id text; v_user uuid; v_source text; v_full jsonb;
  v_mask text;
  v_rodo boolean;
  v_reason text;
  v_load uuid;
  v_carrier uuid;
  v_client uuid;
begin
  o := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  n := case when tg_op in ('UPDATE', 'INSERT') then to_jsonb(new) end;
  if tg_op = 'UPDATE' then
    v_old := '{}'; v_new := '{}';
    for k in select key from jsonb_each(n) loop
      if (n -> k) is distinct from (o -> k) and (k = any(v_skip)) is not true then
        v_old := v_old || jsonb_build_object(k, o -> k);
        v_new := v_new || jsonb_build_object(k, n -> k);
      end if;
    end loop;
    if v_new = '{}'::jsonb then return null; end if;
    -- #583 F7 r3: sam schedule_row (odświeżenie snapshotu importu) — bez wpisu audytu
    if tg_table_name = 'shipment_items'
       and (select count(*) from jsonb_object_keys(v_new)) = 1
       and (v_new ? 'schedule_row') then
      return null;
    end if;
    if tg_table_name = 'load_agreed_fees' then
      foreach k in array v_keep_fee loop
        if o ? k and (v_old ? k) is not true then
          v_old := v_old || jsonb_build_object(k, o -> k);
        end if;
        if n ? k and (v_new ? k) is not true then
          v_new := v_new || jsonb_build_object(k, n -> k);
        end if;
      end loop;
    end if;
    if tg_table_name = 'documents' then
      foreach k in array v_keep_doc loop
        if o ? k and (v_old ? k) is not true then
          v_old := v_old || jsonb_build_object(k, o -> k);
        end if;
        if n ? k and (v_new ? k) is not true then
          v_new := v_new || jsonb_build_object(k, n -> k);
        end if;
      end loop;
    end if;
    if tg_table_name in ('loads', 'load')
       and (o ->> 'carrier_org_id') is distinct from (n ->> 'carrier_org_id') then
      v_old := v_old || jsonb_build_object('carrier_org_id', o -> 'carrier_org_id');
      v_new := v_new || jsonb_build_object('carrier_org_id', n -> 'carrier_org_id');
    end if;
  else
    v_old := o; v_new := n;
  end if;

  v_reason := nullif(btrim(current_setting('tower.audit_reason', true)), '');
  if v_reason is not null then
    v_new := coalesce(v_new, '{}'::jsonb) || jsonb_build_object('_reason', v_reason);
  end if;

  v_source := nullif(btrim(current_setting('tower.audit_source', true)), '');
  v_rodo := (v_source = 'rodo') is true;

  foreach k in array (v_secret || v_pii) loop
    if k = any (v_secret) then
      v_mask := '"••••"';
    elsif v_rodo and k = any (v_pii) then
      v_mask := '"[dane osobowe]"';
    else
      v_mask := null;
    end if;
    if v_mask is not null then
      if v_old ? k and jsonb_typeof(v_old -> k) <> 'null' then
        v_old := jsonb_set(v_old, array[k], v_mask::jsonb);
      end if;
      if v_new ? k and jsonb_typeof(v_new -> k) <> 'null' then
        v_new := jsonb_set(v_new, array[k], v_mask::jsonb);
      end if;
    end if;
  end loop;

  v_full := coalesce(n, o);
  v_id := coalesce(
    v_full ->> 'id',
    v_full ->> 'key',
    v_full ->> 'kind',
    nullif((v_full ->> 'invoice_id') || ':' || (v_full ->> 'load_id'), ':'),
    nullif((v_full ->> 'load_id') || ':' || (v_full ->> 'permit_id'), ':'),
    nullif((v_full ->> 'event_group') || ':' || (v_full ->> 'org_kind'), ':'),
    nullif((v_full ->> 'currency') || ':' || (v_full ->> 'rate_date'), ':'),
    nullif((v_full ->> 'project_id') || ':' || (v_full ->> 'category'), ':'),
    nullif((v_full ->> 'list_key') || ':' || (v_full ->> 'slot'), ':'),
    case when public.audit_history_try_uuid(v_full ->> 'load_id') is not null
      then v_full ->> 'load_id' end,
    tg_table_name
  );

  select s.out_load, s.out_carrier, s.out_client
    into v_load, v_carrier, v_client
    from public.audit_history_compute_scope(
      tg_table_name, v_id, v_old, v_new, null, null, null
    ) s;
  if v_load is null then
    v_load := public.audit_history_try_uuid(v_full ->> 'load_id');
  end if;
  if v_load is null and tg_table_name in ('loads', 'load') then
    v_load := public.audit_history_try_uuid(v_full ->> 'id');
  end if;

  begin
    v_user := public.current_app_user_id();
  exception when others then
    v_user := null;
  end;

  if v_user is null then
    v_source := coalesce(v_source, 'system');
  end if;

  insert into audit_log (
    user_id, action, entity, entity_id, old_value, new_value, source,
    load_id, scope_carrier_org_id, scope_client_org_id
  ) values (
    v_user, 'ROW_' || tg_op, tg_table_name, v_id, v_old, v_new, v_source,
    v_load, v_carrier, v_client
  );
  return null;
end $$;

revoke all on function public.audit_row_change() from public, anon, authenticated;

comment on function public.audit_row_change() is
  'HIST-11 + #466 + #505 + #484 + #583 + #662-b: PII; scope; skip safefleet_* poll; safefleet_token ••••.';

-- ---------------------------------------------------------------------
-- Maska URL SafeFleet w audit_log (telematics_vehicle_id → safefleet:<6>).
-- ---------------------------------------------------------------------
create or replace function public.audit_mask_safefleet_url_in_jsonb(p jsonb)
returns jsonb
language plpgsql
immutable
set search_path = public
as $$
declare
  v_ref text;
  v_token text;
begin
  if p is null or (p ? 'telematics_vehicle_id') is not true then
    return p;
  end if;
  if jsonb_typeof(p -> 'telematics_vehicle_id') <> 'string' then
    return p;
  end if;
  v_ref := p ->> 'telematics_vehicle_id';
  v_token := (regexp_match(
    v_ref,
    'https://portal\.safefleet\.pl/safefleet/temporary_link/view/([0-9a-f]{32})/?',
    'i'
  ))[1];
  if v_token is null then
    return p;
  end if;
  return jsonb_set(
    p,
    '{telematics_vehicle_id}',
    to_jsonb(('safefleet:' || lower(right(v_token, 6)))::text)
  );
end;
$$;

revoke all on function public.audit_mask_safefleet_url_in_jsonb(jsonb)
  from public, anon, authenticated;

create or replace function public.audit_mask_safefleet_token()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.old_value is not null
     and new.old_value ? 'safefleet_token'
     and jsonb_typeof(new.old_value -> 'safefleet_token') <> 'null' then
    new.old_value := jsonb_set(new.old_value, '{safefleet_token}', '"••••"'::jsonb);
  end if;
  if new.new_value is not null
     and new.new_value ? 'safefleet_token'
     and jsonb_typeof(new.new_value -> 'safefleet_token') <> 'null' then
    new.new_value := jsonb_set(new.new_value, '{safefleet_token}', '"••••"'::jsonb);
  end if;
  new.old_value := public.audit_mask_safefleet_url_in_jsonb(new.old_value);
  new.new_value := public.audit_mask_safefleet_url_in_jsonb(new.new_value);
  return new;
end;
$$;

revoke all on function public.audit_mask_safefleet_token() from public, anon, authenticated;

comment on function public.audit_mask_safefleet_token() is
  '#662/#662-b: safefleet_token → ••••; pełny URL telematics_vehicle_id → safefleet:<6>.';

-- Jednorazowo: istniejące wpisy (w tym z migracji 0349) z pełnym URL SafeFleet.
update public.audit_log
   set old_value = public.audit_mask_safefleet_url_in_jsonb(old_value),
       new_value = public.audit_mask_safefleet_url_in_jsonb(new_value)
 where (old_value::text ~* 'portal\.safefleet\.pl/safefleet/temporary_link/view/[0-9a-f]{32}')
    or (new_value::text ~* 'portal\.safefleet\.pl/safefleet/temporary_link/view/[0-9a-f]{32}');

commit;
