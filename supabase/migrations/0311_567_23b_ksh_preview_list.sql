-- #567 23B: lista zmian dry_run z pliku KSH (podgląd przed importem).
-- F7 #577: imported_at; require_service; wt z WT; pending_write; manual=user;
-- kind added/missing; Edge tylko dry_run niefatalny.
begin;

alter table public.ksh_sync_state
  add column if not exists preview jsonb;

comment on column public.ksh_sync_state.preview is
  '#567 23B: lista zmian z ostatniego dry_run (kod/pole/WT/plik/manual/kind); bez PII.';

create or replace function public.ksh_sync_preview_field_label(p_field text)
returns text
language sql
immutable
set search_path = public
as $$
  select case p_field
    when 'load_date' then 'Data załadunku'
    when 'load_time' then 'Godzina załadunku'
    when 'delivery_date' then 'Data rozładunku'
    when 'delivery_time' then 'Godzina rozładunku'
    when 'hhl_order_no' then 'Numer HHL–KSH'
    when 'carrier_order_no' then 'Numer HHL–SCX'
    when 'order_no' then 'Numer zamówienia'
    when 'tractor_plate' then 'Tablica ciągnika (PL)'
    when 'tractor_delivery_plate' then 'Tablica ciągnika (SE)'
    when 'trailer_plate' then 'Tablica naczepy'
    when 'item_type' then 'Typ ładunku'
    when 'cargo_class' then 'Klasa ładunku'
    when 'length_m' then 'Długość (m)'
    when 'width_m' then 'Szerokość (m)'
    when 'height_m' then 'Wysokość (m)'
    when 'qty' then 'Ilość'
    when 'unit_weight_t' then 'Masa jednostki (t)'
    when 'total_weight_t' then 'Masa całkowita (t)'
    when 'assembly_seq' then 'Kolejność montażu'
    when 'shipment_code' then 'Kod transportu'
    else coalesce(p_field, '')
  end;
$$;

revoke all on function public.ksh_sync_preview_field_label(text) from public, anon, authenticated;
grant execute on function public.ksh_sync_preview_field_label(text) to service_role;

create or replace function public.ksh_sync_preview_audit_keys(p_field text)
returns text[]
language sql
immutable
set search_path = public
as $$
  select case p_field
    when 'load_date' then array['plan_load_date']
    when 'load_time' then array['plan_load_from', 'plan_load_to']
    when 'delivery_date' then array['plan_delivery_date']
    when 'delivery_time' then array['plan_delivery_from', 'plan_delivery_to']
    when 'hhl_order_no' then array['hhl_order_no']
    when 'carrier_order_no' then array['carrier_order_no']
    when 'order_no' then array['order_no']
    when 'tractor_plate' then array['tractor_plate']
    when 'tractor_delivery_plate' then array['tractor_delivery_plate']
    when 'trailer_plate' then array['trailer_plate']
    else array[p_field]
  end;
$$;

revoke all on function public.ksh_sync_preview_audit_keys(text) from public, anon, authenticated;
grant execute on function public.ksh_sync_preview_audit_keys(text) to service_role;

create or replace function public.ksh_sync_preview_field_allowed(p_field text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select p_field is not null
     and p_field !~* '^(driver_|pilot_|.*phone|.*_name)$'
     and p_field not in ('driver_name', 'driver_phone', 'driver_delivery_name',
                         'driver_delivery_phone', 'pilot_name', 'pilot_phone');
$$;

revoke all on function public.ksh_sync_preview_field_allowed(text) from public, anon, authenticated;
grant execute on function public.ksh_sync_preview_field_allowed(text) to service_role;

-- F7 pkt 5: bieżąca wartość w Watch Tower (loads / shipment_items), nie before z pliku.
create or replace function public.ksh_sync_preview_wt_text(p_load uuid, p_field text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v text;
begin
  if p_load is null or p_field is null then
    return null;
  end if;
  if p_field in ('length_m','width_m','height_m','qty','unit_weight_t','total_weight_t',
                 'item_type','cargo_class','assembly_seq','shipment_code') then
    select case p_field
      when 'length_m' then to_char(round(si.length_m, 2), 'FM999999990.00')
      when 'width_m' then to_char(round(si.width_m, 2), 'FM999999990.00')
      when 'height_m' then to_char(round(si.height_m, 2), 'FM999999990.00')
      when 'unit_weight_t' then to_char(round(si.unit_weight_t, 3), 'FM999999990.000')
      when 'total_weight_t' then to_char(round(si.total_weight_t, 3), 'FM999999990.000')
      when 'qty' then si.qty::text
      when 'item_type' then si.item_type
      when 'cargo_class' then case when si.cargo_class = 'STANDARD' then 'STANDARD' else si.cargo_class end
      when 'assembly_seq' then si.assembly_seq::text
      when 'shipment_code' then si.shipment_code
    end into v
      from public.shipment_items si
     where si.load_id = p_load
     order by si.shipment_code
     limit 1;
  else
    select case p_field
      when 'load_date' then l.plan_load_date::text
      when 'delivery_date' then l.plan_delivery_date::text
      when 'load_time' then
        case when l.plan_load_from is null then null
             else to_char(l.plan_load_from at time zone 'Europe/Warsaw', 'HH24:MI') end
      when 'delivery_time' then
        case when l.plan_delivery_to is null then null
             else to_char(l.plan_delivery_to at time zone 'Europe/Stockholm', 'HH24:MI') end
      when 'hhl_order_no' then l.hhl_order_no
      when 'carrier_order_no' then l.carrier_order_no
      when 'order_no' then l.order_no
      when 'tractor_plate' then l.tractor_plate
      when 'tractor_delivery_plate' then l.tractor_delivery_plate
      when 'trailer_plate' then l.trailer_plate
      else null
    end into v
      from public.loads l
     where l.id = p_load;
  end if;
  return nullif(btrim(coalesce(v, '')), '');
end;
$$;

revoke all on function public.ksh_sync_preview_wt_text(uuid, text) from public, anon, authenticated;
grant execute on function public.ksh_sync_preview_wt_text(uuid, text) to service_role;

create or replace function public.ksh_sync_preview_build(
  p_project uuid,
  p_changed jsonb,
  p_read_at timestamptz default now(),
  p_bytes int default null,
  p_file_hash text default null,
  p_added jsonb default '[]'::jsonb,
  p_cancel_candidates jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_last_imp timestamptz;
  v_rows jsonb := '[]'::jsonb;
  v_item jsonb;
  v_fields text[];
  v_f text;
  v_lid uuid;
  v_code text;
  v_keys text[];
  v_manual boolean;
  v_pending boolean;
  v_wt text;
  v_file text;
  v_item_id uuid;
  v_entity text;
  v_entity_id text;
begin
  select max(imported_at) into v_last_imp
    from public.schedule_imports
   where project_id = p_project;

  if p_changed is not null and jsonb_typeof(p_changed) = 'array' then
    for v_item in
      select value from jsonb_array_elements(p_changed)
    loop
      v_code := coalesce(v_item->>'code', '');
      begin
        v_lid := nullif(v_item->>'load_id', '')::uuid;
      exception when others then
        v_lid := null;
      end;
      v_fields := coalesce(
        (select array_agg(x) from jsonb_array_elements_text(coalesce(v_item->'fields', '[]'::jsonb)) t(x)),
        '{}'::text[]
      );
      -- F7 pkt 4: pending_wt z kolejki (także w dry_run).
      foreach v_f in array v_fields loop
        if public.ksh_sync_preview_field_allowed(v_f) is not true then
          continue;
        end if;
        v_file := v_item #>> array['after', v_f];
        v_wt := public.ksh_sync_preview_wt_text(v_lid, v_f);
        v_manual := false;
        v_pending := false;
        if v_lid is not null then
          select exists (
            select 1 from public.ksh_sync_outbound o
             where o.load_id = v_lid and o.status = 'pending'
               and o.patch ? v_f
          ) into v_pending;
        end if;
        if v_lid is not null and v_last_imp is not null then
          v_keys := public.ksh_sync_preview_audit_keys(v_f);
          if v_f in ('length_m','width_m','height_m','qty','unit_weight_t','total_weight_t',
                     'item_type','cargo_class','assembly_seq','shipment_code') then
            select si.id into v_item_id
              from public.shipment_items si
             where si.load_id = v_lid
             order by si.shipment_code
             limit 1;
            v_entity := 'shipment_items';
            v_entity_id := v_item_id::text;
          else
            v_entity := 'loads';
            v_entity_id := v_lid::text;
          end if;
          if v_entity_id is not null then
            -- F7 pkt 6: tylko zmiany użytkownika (user_id not null).
            select exists (
              select 1
                from public.audit_log a
               where a.entity = v_entity
                 and a.entity_id = v_entity_id
                 and a.action like 'ROW_%'
                 and a.user_id is not null
                 and a.created_at > v_last_imp
                 and (
                   a.old_value ?| v_keys
                   or a.new_value ?| v_keys
                 )
            ) into v_manual;
          end if;
        end if;
        v_rows := v_rows || jsonb_build_array(jsonb_build_object(
          'code', v_code,
          'load_id', v_lid,
          'field', v_f,
          'field_label', public.ksh_sync_preview_field_label(v_f),
          'wt', v_wt,
          'file', v_file,
          'manual_after_import', coalesce(v_manual, false),
          'pending_write', coalesce(v_pending, false),
          'kind', 'changed'
        ));
      end loop;
    end loop;
  end if;

  -- F7 pkt 7: nowe w pliku / brak w pliku.
  if p_added is not null and jsonb_typeof(p_added) = 'array' then
    for v_item in select value from jsonb_array_elements(p_added) loop
      v_code := coalesce(v_item->>'code', '');
      if v_code = '' then continue; end if;
      v_rows := v_rows || jsonb_build_array(jsonb_build_object(
        'code', v_code,
        'load_id', null,
        'field', null,
        'field_label', 'Nowy w pliku',
        'wt', null,
        'file', null,
        'manual_after_import', false,
        'pending_write', false,
        'kind', 'added'
      ));
    end loop;
  end if;

  if p_cancel_candidates is not null and jsonb_typeof(p_cancel_candidates) = 'array' then
    for v_item in select value from jsonb_array_elements(p_cancel_candidates) loop
      v_code := coalesce(v_item->>'code', '');
      begin
        v_lid := nullif(v_item->>'load_id', '')::uuid;
      exception when others then
        v_lid := null;
      end;
      if v_code = '' then continue; end if;
      v_rows := v_rows || jsonb_build_array(jsonb_build_object(
        'code', v_code,
        'load_id', v_lid,
        'field', null,
        'field_label', 'Brak w pliku',
        'wt', null,
        'file', null,
        'manual_after_import', false,
        'pending_write', false,
        'kind', 'missing'
      ));
    end loop;
  end if;

  return jsonb_build_object(
    'read_at', p_read_at,
    'bytes', p_bytes,
    'hash', p_file_hash,
    'changes', v_rows,
    'n', jsonb_array_length(v_rows)
  );
end;
$$;

revoke all on function public.ksh_sync_preview_build(uuid, jsonb, timestamptz, int, text, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.ksh_sync_preview_build(uuid, jsonb, timestamptz, int, text, jsonb, jsonb)
  to service_role;

-- F7 pkt 3: bramka jak 0308 (ksh_sync_require_service).
create or replace function public.ksh_sync_preview_store(
  p_project uuid,
  p_changed jsonb,
  p_read_at timestamptz default now(),
  p_bytes int default null,
  p_file_hash text default null,
  p_added jsonb default '[]'::jsonb,
  p_cancel_candidates jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_preview jsonb;
begin
  perform public.ksh_sync_require_service();
  if p_project is null then
    raise exception 'ksh_sync_preview_store — brak projektu' using errcode = '22023';
  end if;

  v_preview := public.ksh_sync_preview_build(
    p_project, p_changed, coalesce(p_read_at, now()), p_bytes, p_file_hash,
    coalesce(p_added, '[]'::jsonb), coalesce(p_cancel_candidates, '[]'::jsonb)
  );

  insert into public.ksh_sync_state (project_id, preview, updated_at)
  values (p_project, v_preview, now())
  on conflict (project_id) do update
    set preview = excluded.preview,
        updated_at = now();

  return v_preview;
end;
$$;

revoke all on function public.ksh_sync_preview_store(uuid, jsonb, timestamptz, int, text, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.ksh_sync_preview_store(uuid, jsonb, timestamptz, int, text, jsonb, jsonb)
  to service_role;

comment on function public.ksh_sync_preview_store(uuid, jsonb, timestamptz, int, text, jsonb, jsonb) is
  '#567 23B F7: zapis preview (Edge/service); added/missing; wt z WT.';

create or replace function public.ksh_sync_preview_get()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_pid uuid;
  v_preview jsonb;
begin
  if public.is_hhl() is not true then
    return null;
  end if;
  select id into v_pid from public.projects
   where code in ('STEGRA_BODEN', 'STEGRA')
   order by case code when 'STEGRA_BODEN' then 0 else 1 end
   limit 1;
  if v_pid is null then
    return null;
  end if;
  select preview into v_preview
    from public.ksh_sync_state
   where project_id = v_pid;
  return v_preview;
end;
$$;

revoke all on function public.ksh_sync_preview_get() from public, anon;
grant execute on function public.ksh_sync_preview_get() to authenticated;

comment on function public.ksh_sync_preview_get() is
  '#567 23B: lista zmian KSH dla HHL (is_hhl); inni → null; bez assert_not_preview.';

commit;
