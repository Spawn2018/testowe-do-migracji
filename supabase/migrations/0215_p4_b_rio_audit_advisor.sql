-- TOWER — 0215: P4 B / D-20261015-0300-01 A7 + B12
-- A7: rio_secret w audit_log jako •••• (E44 pkt 8).
-- B12: doradca z advisor_ok=false → integration_runs.ok=false, detail „Brak pomiaru”.

create or replace function public.audit_row_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_old jsonb; v_new jsonb; o jsonb; n jsonb; k text;
  v_skip constant text[] := array[
    'updated_at', 'eta_site', 'eta_confidence_min', 'eta_basis', 'eta_computed_at',
    'delay_minutes', 'fetched_at', 'beat_at', 'beats', 'last_seen_at'
  ];
  v_pii  constant text[] := array[
    'driver_name', 'driver_phone', 'phone_national', 'phone', 'contact_phone',
    'contact_name', 'email_personal', 'rio_secret'
  ];
  v_id text; v_user uuid; v_source text; v_row jsonb;
  v_mask text;
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
  else
    v_old := o; v_new := n;
  end if;
  foreach k in array v_pii loop
    v_mask := case when k = 'rio_secret' then '"••••"' else '"[dane osobowe]"' end;
    if v_old ? k and jsonb_typeof(v_old -> k) <> 'null' then
      v_old := jsonb_set(v_old, array[k], v_mask::jsonb);
    end if;
    if v_new ? k and jsonb_typeof(v_new -> k) <> 'null' then
      v_new := jsonb_set(v_new, array[k], v_mask::jsonb);
    end if;
  end loop;

  v_row := coalesce(n, o);
  v_id := coalesce(
    v_row ->> 'id',
    v_row ->> 'key',
    v_row ->> 'kind',
    nullif((v_row ->> 'invoice_id') || ':' || (v_row ->> 'load_id'), ':'),
    nullif((v_row ->> 'load_id') || ':' || (v_row ->> 'permit_id'), ':'),
    nullif((v_row ->> 'event_group') || ':' || (v_row ->> 'org_kind'), ':'),
    nullif((v_row ->> 'currency') || ':' || (v_row ->> 'rate_date'), ':'),
    nullif((v_row ->> 'project_id') || ':' || (v_row ->> 'category'), ':'),
    nullif((v_row ->> 'list_key') || ':' || (v_row ->> 'slot'), ':'),
    tg_table_name
  );

  begin
    v_user := public.current_app_user_id();
  exception when others then
    v_user := null;
  end;

  v_source := nullif(btrim(current_setting('tower.audit_source', true)), '');
  if v_user is null then
    v_source := coalesce(v_source, 'system');
  end if;

  insert into audit_log (user_id, action, entity, entity_id, old_value, new_value, source)
    values (v_user, 'ROW_' || tg_op, tg_table_name, v_id, v_old, v_new, v_source);
  return null;
end $$;

comment on function public.audit_row_change() is
  'HIST-11 + A7 (D-20261015-0300-01): rio_secret maskowany jako ••••.';

-- B12: jak 0203, ale ok z meta.advisor_ok
create or replace function public.security_advisor_snapshot_capture(
  p_findings jsonb default '[]'::jsonb,
  p_source text default 'cron',
  p_meta jsonb default '{}'::jsonb
) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_id bigint;
  v_flags jsonb;
  v_src text := coalesce(nullif(trim(p_source), ''), 'cron');
  v_ok boolean := coalesce((p_meta ->> 'advisor_ok')::boolean, false);
begin
  if (v_src in ('cron', 'gate', 'manual', 'edge')) is not true then
    raise exception 'Nieznane źródło migawki doradcy' using errcode = '22023';
  end if;

  select coalesce(jsonb_object_agg(key, jsonb_build_object(
           'enabled', enabled,
           'note', note,
           'updated_at', updated_at
         )), '{}'::jsonb)
    into v_flags
    from security_flags;

  insert into security_advisor_snapshots (source, findings, flags, meta)
  values (
    v_src,
    coalesce(p_findings, '[]'::jsonb),
    v_flags,
    coalesce(p_meta, '{}'::jsonb) || jsonb_build_object('flag_count', (select count(*)::int from security_flags))
  )
  returning id into v_id;

  insert into integration_runs (job, ran_at, ok, result)
  values (
    'security-advisor-snapshot',
    now(),
    v_ok,
    jsonb_build_object(
      'snapshot_id', v_id,
      'source', v_src,
      'findings', jsonb_array_length(coalesce(p_findings, '[]'::jsonb)),
      'flags', (select count(*)::int from security_flags),
      'advisor_ok', v_ok,
      'detail', case when v_ok then 'doradca security' else 'Brak pomiaru' end
    )
  );

  return v_id;
end $$;
