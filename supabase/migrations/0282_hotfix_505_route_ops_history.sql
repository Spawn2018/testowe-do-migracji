-- #505 / #413 c.d. (F7 #504 pkt 5, 7) — geofences.route w widoku/upsert;
-- powód z UI → audit_log (tower.audit_reason); workflow_rule_history dla HHL_OPS;
-- ROW_DELETE zwraca też `po` (powód widoczny).

select set_config('tower.audit_source', 'migracja 0282 (#505 route + historia OPS)', true);

-- ── 1) v_geofences_circle + route ────────────────────────────────────────────
create or replace view public.v_geofences_circle with (security_invoker = true) as
select g.id, g.project_id, g.name, g.kind, g.hysteresis_m, g.dwell_seconds, g.debounce_fixes,
       g.notify_enter, g.notify_exit, g.notify_dwell, g.notify_orgs, g.active, g.sort_order,
       st_y(st_centroid(g.geom))                                           as lat,
       st_x(st_centroid(g.geom))                                           as lng,
       round(st_distance(st_centroid(g.geom)::geography,
             st_pointn(st_exteriorring(g.geom), 1)::geography))::int       as radius_m,
       g.country,
       g.route
  from public.geofences g;

grant select on public.v_geofences_circle to authenticated;
revoke all on public.v_geofences_circle from anon;

-- ── 2) upsert_geofence_circle: p_route + p_reason ───────────────────────────
drop function if exists public.upsert_geofence_circle(
  uuid, uuid, text, geofence_kind, double precision, double precision,
  int, int, int, int, boolean, boolean, boolean, uuid[], boolean, char);

create function public.upsert_geofence_circle(
  p_id uuid, p_project uuid, p_name text, p_kind geofence_kind,
  p_lat double precision, p_lng double precision, p_radius_m int,
  p_hysteresis_m int, p_dwell_seconds int, p_debounce_fixes int,
  p_notify_enter boolean, p_notify_exit boolean, p_notify_dwell boolean,
  p_notify_orgs uuid[], p_active boolean, p_country char(2) default null,
  p_route text default null, p_reason text default null)
returns uuid language plpgsql security invoker set search_path = public, extensions as $$
declare v_geom geometry; v_id uuid; v_country char(2); v_route text;
begin
  if p_radius_m is null or p_radius_m < 10 or p_radius_m > 200000 then
    raise exception 'Promień strefy poza zakresem 10 m – 200 km';
  end if;
  if p_country is not null and p_country not in ('PL', 'SE', 'LT', 'DE') then
    raise exception 'Kraj strefy: PL, SE, LT albo DE' using errcode = '22023';
  end if;
  if p_route is not null and p_route not in ('POLFERRIES', 'STENA') then
    raise exception 'Trasa strefy: POLFERRIES albo STENA' using errcode = '22023';
  end if;
  v_country := p_country;
  v_route := p_route;
  if nullif(btrim(coalesce(p_reason, '')), '') is not null then
    perform set_config('tower.audit_reason', btrim(p_reason), true);
  end if;
  v_geom := st_buffer(st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography, p_radius_m, 32)::geometry;
  if p_id is null then
    insert into geofences (project_id, name, kind, geom, hysteresis_m, dwell_seconds, debounce_fixes,
                           notify_enter, notify_exit, notify_dwell, notify_orgs, active, country, route)
    values (p_project, p_name, p_kind, v_geom, p_hysteresis_m, p_dwell_seconds, p_debounce_fixes,
            p_notify_enter, p_notify_exit, p_notify_dwell, coalesce(p_notify_orgs, '{}'), p_active, v_country, v_route)
    returning id into v_id;
  else
    update geofences set name = p_name, kind = p_kind, geom = v_geom, hysteresis_m = p_hysteresis_m,
           dwell_seconds = p_dwell_seconds, debounce_fixes = p_debounce_fixes,
           notify_enter = p_notify_enter, notify_exit = p_notify_exit, notify_dwell = p_notify_dwell,
           notify_orgs = coalesce(p_notify_orgs, '{}'), active = p_active,
           country = coalesce(v_country, country),
           route = case when p_kind in ('PORT_OUT', 'PRE_PORT', 'PORT_IN') then v_route else route end
     where id = p_id
    returning id into v_id;
  end if;
  if v_id is null then raise exception 'Brak uprawnień lub nieznana strefa' using errcode = '42501'; end if;
  return v_id;
end $$;

revoke all on function public.upsert_geofence_circle(
  uuid, uuid, text, geofence_kind, double precision, double precision,
  int, int, int, int, boolean, boolean, boolean, uuid[], boolean, char, text, text)
  from public, anon;
grant execute on function public.upsert_geofence_circle(
  uuid, uuid, text, geofence_kind, double precision, double precision,
  int, int, int, int, boolean, boolean, boolean, uuid[], boolean, char, text, text)
  to authenticated;

-- ── 3) audit_row_change: tower.audit_reason → new_value.reason ──────────────
create or replace function public.audit_row_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_old jsonb; v_new jsonb; o jsonb; n jsonb; k text;
  v_skip constant text[] := array[
    'updated_at', 'eta_site', 'eta_confidence_min', 'eta_basis', 'eta_computed_at',
    'delay_minutes', 'fetched_at', 'beat_at', 'beats', 'last_seen_at',
    'rio_check_at', 'rio_last_fix_at'
  ];
  v_secret constant text[] := array['rio_secret'];
  v_pii constant text[] := array[
    'driver_name', 'driver_phone', 'phone_national', 'phone', 'contact_phone',
    'contact_name', 'email_personal'
  ];
  v_id text; v_user uuid; v_source text; v_row jsonb;
  v_mask text;
  v_rodo boolean;
  v_reason text;
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

  v_reason := nullif(btrim(current_setting('tower.audit_reason', true)), '');
  if v_reason is not null then
    v_new := coalesce(v_new, '{}'::jsonb) || jsonb_build_object('reason', v_reason);
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

  if v_user is null then
    v_source := coalesce(v_source, 'system');
  end if;

  insert into audit_log (user_id, action, entity, entity_id, old_value, new_value, source)
    values (v_user, 'ROW_' || tg_op, tg_table_name, v_id, v_old, v_new, v_source);
  return null;
end $$;

revoke all on function public.audit_row_change() from public, anon, authenticated;

comment on function public.audit_row_change() is
  'HIST-11 + #466 D1 + #505: PII jawne; rio_secret ••••; tower.audit_reason → new_value.reason.';

-- ── 4) workflow_rule_history: HHL_OPS + po przy ROW_DELETE ──────────────────
create or replace function public.workflow_rule_history(p_workflow uuid default null, p_limit int default 100)
returns table (at timestamptz, who text, action text, workflow_id text, rule_name text, changes jsonb, source text)
language plpgsql stable security definer set search_path = public as $$
begin
  if (current_app_role() in ('HHL_ADMIN', 'HHL_OPS')) is not true then
    raise exception 'Historia reguł — tylko HHL_ADMIN lub HHL_OPS' using errcode = '42501';
  end if;
  return query
    select a.created_at, coalesce(nullif(u.full_name, ''), u.email::text, a.source, 'system'),
           case a.action when 'ROW_INSERT' then 'UTWORZONO' when 'ROW_UPDATE' then 'ZMIENIONO' when 'ROW_DELETE' then 'USUNIĘTO' else a.action end,
           a.entity_id, coalesce(a.new_value ->> 'name', a.old_value ->> 'name',
                                 (select w.name from workflows w where w.id::text = a.entity_id)),
           case when a.action = 'ROW_UPDATE' then jsonb_build_object('przed', a.old_value, 'po', a.new_value)
                when a.action = 'ROW_DELETE' then jsonb_build_object('przed', a.old_value, 'po', coalesce(a.new_value, '{}'::jsonb))
                else jsonb_build_object('po', a.new_value) end,
           a.source
      from audit_log a left join app_users u on u.id = a.user_id
     where a.entity = 'workflows' and (p_workflow is null or a.entity_id = p_workflow::text)
     order by a.created_at desc, a.id desc
     limit greatest(1, least(coalesce(p_limit, 100), 500));
end $$;
revoke all on function public.workflow_rule_history(uuid, int) from public, anon;
grant execute on function public.workflow_rule_history(uuid, int) to authenticated;

comment on function public.workflow_rule_history(uuid, int) is
  '#505: odczyt HHL_ADMIN i HHL_OPS; ROW_DELETE z polem po (powód).';

-- ── 5) RPC zapisu reguł z powodem (ta sama sesja co audit) ──────────────────
create or replace function public.workflow_rule_write(
  p_id uuid,
  p_project uuid,
  p_name text,
  p_description text,
  p_trigger_type text,
  p_condition jsonb,
  p_actions jsonb,
  p_enabled boolean,
  p_reason text default null
) returns uuid
language plpgsql security invoker set search_path = public as $$
declare v_id uuid;
begin
  if (current_app_role() = 'HHL_ADMIN') is not true then
    raise exception 'Zapis reguł — tylko HHL_ADMIN' using errcode = '42501';
  end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is not null then
    perform set_config('tower.audit_reason', btrim(p_reason), true);
  end if;
  if p_id is null then
    if p_project is null then
      raise exception 'Brak projektu' using errcode = '22023';
    end if;
    insert into workflows (project_id, name, description, trigger_type, condition, actions, enabled)
    values (p_project, p_name, p_description, p_trigger_type, coalesce(p_condition, 'true'::jsonb),
            coalesce(p_actions, '[]'::jsonb), coalesce(p_enabled, true))
    returning id into v_id;
  else
    update workflows set
      name = coalesce(p_name, name),
      description = coalesce(p_description, description),
      trigger_type = coalesce(p_trigger_type, trigger_type),
      condition = coalesce(p_condition, condition),
      actions = coalesce(p_actions, actions),
      enabled = coalesce(p_enabled, enabled)
     where id = p_id and removed_at is null
    returning id into v_id;
    if v_id is null then
      raise exception 'Brak uprawnień lub nieznana reguła' using errcode = '42501';
    end if;
  end if;
  return v_id;
end $$;
revoke all on function public.workflow_rule_write(uuid, uuid, text, text, text, jsonb, jsonb, boolean, text) from public, anon;
grant execute on function public.workflow_rule_write(uuid, uuid, text, text, text, jsonb, jsonb, boolean, text) to authenticated;

create or replace function public.workflow_rule_set_enabled(p_id uuid, p_enabled boolean, p_reason text default null)
returns void
language plpgsql security invoker set search_path = public as $$
declare n int;
begin
  if (current_app_role() = 'HHL_ADMIN') is not true then
    raise exception 'Zapis reguł — tylko HHL_ADMIN' using errcode = '42501';
  end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is not null then
    perform set_config('tower.audit_reason', btrim(p_reason), true);
  end if;
  update workflows set enabled = p_enabled
   where id = p_id and removed_at is null;
  get diagnostics n = row_count;
  if n = 0 then
    raise exception 'Brak uprawnień lub nieznana reguła' using errcode = '42501';
  end if;
end $$;
revoke all on function public.workflow_rule_set_enabled(uuid, boolean, text) from public, anon;
grant execute on function public.workflow_rule_set_enabled(uuid, boolean, text) to authenticated;

create or replace function public.workflow_rule_soft_delete(p_id uuid, p_reason text default null)
returns void
language plpgsql security invoker set search_path = public as $$
declare n int;
begin
  if (current_app_role() = 'HHL_ADMIN') is not true then
    raise exception 'Zapis reguł — tylko HHL_ADMIN' using errcode = '42501';
  end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is not null then
    perform set_config('tower.audit_reason', btrim(p_reason), true);
  end if;
  update workflows set enabled = false, removed_at = now()
   where id = p_id and removed_at is null;
  get diagnostics n = row_count;
  if n = 0 then
    raise exception 'Brak uprawnień lub nieznana reguła' using errcode = '42501';
  end if;
end $$;
revoke all on function public.workflow_rule_soft_delete(uuid, text) from public, anon;
grant execute on function public.workflow_rule_soft_delete(uuid, text) to authenticated;

do $g$
begin
  if (select count(*) from information_schema.columns
       where table_schema = 'public' and table_name = 'v_geofences_circle' and column_name = 'route') <> 1 then
    raise exception '0282: v_geofences_circle bez route';
  end if;
  if to_regprocedure('public.upsert_geofence_circle(uuid,uuid,text,geofence_kind,double precision,double precision,int,int,int,int,boolean,boolean,boolean,uuid[],boolean,char,text,text)') is null then
    raise exception '0282: brak upsert_geofence_circle z p_route/p_reason';
  end if;
  if to_regprocedure('public.workflow_rule_write(uuid,uuid,text,text,text,jsonb,jsonb,boolean,text)') is null then
    raise exception '0282: brak workflow_rule_write';
  end if;
end $g$;
