-- #567 23B: lista zmian dry_run z pliku KSH (podgląd dla właściciela przed importem).
-- Ta sama logika pól co import (N9 / v_fields w import_schedule.changed).
-- Bez PII kierowców; znacznik „zmieniane ręcznie w WT po ostatnim imporcie”.
begin;

alter table public.ksh_sync_state
  add column if not exists preview jsonb;

comment on column public.ksh_sync_state.preview is
  '#567 23B: lista zmian z ostatniego dry_run (kod/pole/WT/plik/manual); bez PII kierowców.';

-- Nazwy pól po polsku (front czyta field_label; bez kierowców).
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
    else p_field
  end;
$$;

revoke all on function public.ksh_sync_preview_field_label(text) from public, anon, authenticated;
grant execute on function public.ksh_sync_preview_field_label(text) to service_role;

-- Kolumny audit_log (ROW_UPDATE na loads) odpowiadające polom importu.
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

-- Pola bez PII (kierowca / telefon / piloci — nigdy na liście).
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

-- Buduje płaską listę z import_schedule.changed (+ znacznik ręcznej zmiany).
create or replace function public.ksh_sync_preview_build(
  p_project uuid,
  p_changed jsonb,
  p_read_at timestamptz default now(),
  p_bytes int default null,
  p_file_hash text default null
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
  v_wt text;
  v_file text;
begin
  select max(imported_at) into v_last_imp
    from public.schedule_imports
   where project_id = p_project;

  if p_changed is null or jsonb_typeof(p_changed) <> 'array' then
    return jsonb_build_object(
      'read_at', p_read_at,
      'bytes', p_bytes,
      'hash', p_file_hash,
      'changes', '[]'::jsonb,
      'n', 0
    );
  end if;

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
    foreach v_f in array v_fields loop
      if public.ksh_sync_preview_field_allowed(v_f) is not true then
        continue;
      end if;
      v_wt := v_item #>> array['before', v_f];
      v_file := v_item #>> array['after', v_f];
      v_manual := false;
      if v_lid is not null and v_last_imp is not null then
        v_keys := public.ksh_sync_preview_audit_keys(v_f);
        select exists (
          select 1
            from public.audit_log a
           where a.entity = 'loads'
             and a.entity_id = v_lid::text
             and a.action like 'ROW_%'
             and a.created_at > v_last_imp
             and (
               a.old_value ?| v_keys
               or a.new_value ?| v_keys
             )
        ) into v_manual;
      end if;
      v_rows := v_rows || jsonb_build_array(jsonb_build_object(
        'code', v_code,
        'load_id', v_lid,
        'field', v_f,
        'field_label', public.ksh_sync_preview_field_label(v_f),
        'wt', v_wt,
        'file', v_file,
        'manual_after_import', coalesce(v_manual, false)
      ));
    end loop;
  end loop;

  return jsonb_build_object(
    'read_at', p_read_at,
    'bytes', p_bytes,
    'hash', p_file_hash,
    'changes', v_rows,
    'n', jsonb_array_length(v_rows)
  );
end;
$$;

-- Tylko Edge / DEFINER (store). Nie PUBLIC — authenticated nie czyta audit przez build.
revoke all on function public.ksh_sync_preview_build(uuid, jsonb, timestamptz, int, text)
  from public, anon, authenticated;
grant execute on function public.ksh_sync_preview_build(uuid, jsonb, timestamptz, int, text)
  to service_role;

-- Zapis listy (Edge po dry_run / każdy przebieg podglądu).
-- Jak ksh_sync_state_upsert (0304): brama lokalna = session_user postgres; Edge = service_role.
create or replace function public.ksh_sync_preview_store(
  p_project uuid,
  p_changed jsonb,
  p_read_at timestamptz default now(),
  p_bytes int default null,
  p_file_hash text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_preview jsonb;
  v_jwt_role text;
begin
  if session_user not in ('postgres', 'supabase_admin') then
    if to_regprocedure('auth.role()') is not null then
      execute 'select auth.role()' into v_jwt_role;
    end if;
    if (coalesce(v_jwt_role, '') = 'service_role') is not true then
      raise exception 'ksh_sync_preview_store — tylko Edge (service_role)' using errcode = '42501';
    end if;
  end if;
  if p_project is null then
    raise exception 'ksh_sync_preview_store — brak projektu' using errcode = '22023';
  end if;

  v_preview := public.ksh_sync_preview_build(
    p_project, p_changed, coalesce(p_read_at, now()), p_bytes, p_file_hash
  );

  insert into public.ksh_sync_state (project_id, preview, updated_at)
  values (p_project, v_preview, now())
  on conflict (project_id) do update
    set preview = excluded.preview,
        updated_at = now();

  return v_preview;
end;
$$;

revoke all on function public.ksh_sync_preview_store(uuid, jsonb, timestamptz, int, text)
  from public, anon, authenticated;
grant execute on function public.ksh_sync_preview_store(uuid, jsonb, timestamptz, int, text)
  to service_role;

comment on function public.ksh_sync_preview_store(uuid, jsonb, timestamptz, int, text) is
  '#567 23B: zapis listy zmian dry_run do ksh_sync_state.preview (Edge).';

-- Odczyt dla HHL (front koordynatora); bez assert_not_preview.
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
