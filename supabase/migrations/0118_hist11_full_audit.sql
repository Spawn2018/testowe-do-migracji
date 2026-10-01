-- 0118 — HIST-11 / §11: pełna historia zmian.
-- 1) audit_log.source — automatyczne zmiany ze źródłem
-- 2) rozszerzenie wyzwalaczy ROW_* na tabele biznesowe (nie tylko 7 z 0072)
-- 3) audit_row_change: current_app_user_id (ADM-10 acting_as), source, lepsze entity_id
-- 4) RPC admin_audit_history — filtry kto/kiedy/obiekt/rodzaj + wyszukiwanie
-- Idempotentna.

-- ── 1) Kolumna source ───────────────────────────────────────────────────────
alter table public.audit_log
  add column if not exists source text;

comment on column public.audit_log.source is
  'Źródło automatu (system, import, telematyka, kurs, cron, …); NULL = zmiana ręczna / RPC z user_id';

create index if not exists audit_log_created_at_idx on public.audit_log (created_at desc);
create index if not exists audit_log_action_created_idx on public.audit_log (action, created_at desc);
create index if not exists audit_log_entity_created_idx on public.audit_log (entity, created_at desc);
create index if not exists audit_log_user_created_idx on public.audit_log (user_id, created_at desc);

update public.audit_log
   set source = 'system'
 where user_id is null
   and (source is null or btrim(source) = '');

-- ── 2) Wyzwalacz wierszowy ──────────────────────────────────────────────────
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
    'contact_name', 'email_personal'
  ];
  v_id text; v_user uuid; v_source text; v_row jsonb;
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
    if v_old ? k and jsonb_typeof(v_old -> k) <> 'null' then
      v_old := jsonb_set(v_old, array[k], '"[dane osobowe]"');
    end if;
    if v_new ? k and jsonb_typeof(v_new -> k) <> 'null' then
      v_new := jsonb_set(v_new, array[k], '"[dane osobowe]"');
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

  -- current_app_user_id: przy impersonacji = konto docelowe → BI audit_log ustawi admin+acting_as
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

revoke all on function public.audit_row_change() from public, anon, authenticated;

-- ── 3) Lista tabel biznesowych ──────────────────────────────────────────────
do $$
declare
  t text;
  tables text[] := array[
    -- I-20 (0072)
    'loads', 'shipment_items', 'invoices', 'invoice_lines', 'rate_cards', 'rate_rules', 'sefs_parameters',
    -- konta / uprawnienia / ustawienia
    'app_users', 'user_invites', 'organizations', 'projects', 'security_flags', 'app_parameters',
    'ops_thresholds', 'notification_matrix', 'resource_deadlines', 'workflows', 'system_broadcast',
    -- awizacja / dokumenty / zezwolenia / polisy
    'schedule_imports', 'documents', 'permits', 'load_permits', 'insurance_policies',
    'doc_requirements', 'import_column_templates', 'geofences',
    -- finanse / cennik / opłaty
    'load_cost', 'load_revenue', 'load_agreed_fees', 'payment_terms', 'fx_rates',
    'fuel_index_readings', 'baf_definitions', 'baf_index_values',
    -- decyzje / ocena / eskorty / SMS stref (konfiguracja)
    'decisions', 'decision_types', 'carrier_ratings', 'load_escorts', 'sms_zone_recipients'
  ];
begin
  foreach t in array tables loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;
    execute format('drop trigger if exists trg_audit_row on public.%I', t);
    execute format(
      'create trigger trg_audit_row after insert or update or delete on public.%I for each row execute function public.audit_row_change()',
      t
    );
  end loop;
end $$;

-- ── 4) RPC: historia z filtrami ─────────────────────────────────────────────
create or replace function public.admin_audit_history(
  p_from     timestamptz default null,
  p_to       timestamptz default null,
  p_user_id  uuid default null,
  p_entity   text default null,
  p_action   text default null,
  p_q        text default null,
  p_limit    int default 100,
  p_offset   int default 0
)
returns table (
  id                 bigint,
  created_at         timestamptz,
  action             text,
  entity             text,
  entity_id          text,
  user_id            uuid,
  user_email         text,
  acting_as_user_id  uuid,
  acting_as_email    text,
  source             text,
  is_automatic       boolean,
  old_value          jsonb,
  new_value          jsonb
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_lim int;
  v_off int;
  v_q   text;
begin
  if (current_app_role() = 'HHL_ADMIN') is not true then
    raise exception 'Tylko administrator HHL' using errcode = '42501';
  end if;
  v_lim := least(greatest(coalesce(p_limit, 100), 1), 500);
  v_off := greatest(coalesce(p_offset, 0), 0);
  v_q := nullif(btrim(coalesce(p_q, '')), '');

  return query
  select
    a.id,
    a.created_at,
    a.action,
    a.entity,
    a.entity_id,
    a.user_id,
    u.email::text,
    a.acting_as_user_id,
    aa.email::text,
    a.source,
    (a.source is not null) as is_automatic,
    a.old_value,
    a.new_value
  from audit_log a
  left join app_users u on u.id = a.user_id
  left join app_users aa on aa.id = a.acting_as_user_id
  where (p_from is null or a.created_at >= p_from)
    and (p_to is null or a.created_at <= p_to)
    and (
      p_user_id is null
      or a.user_id = p_user_id
      or a.acting_as_user_id = p_user_id
    )
    and (p_entity is null or a.entity = p_entity)
    and (p_action is null or a.action = p_action)
    and (
      v_q is null
      or a.action ilike '%' || v_q || '%'
      or a.entity ilike '%' || v_q || '%'
      or coalesce(a.entity_id, '') ilike '%' || v_q || '%'
      or coalesce(a.source, '') ilike '%' || v_q || '%'
      or coalesce(u.email::text, '') ilike '%' || v_q || '%'
      or coalesce(aa.email::text, '') ilike '%' || v_q || '%'
      or coalesce(a.old_value::text, '') ilike '%' || v_q || '%'
      or coalesce(a.new_value::text, '') ilike '%' || v_q || '%'
    )
  order by a.created_at desc, a.id desc
  limit v_lim offset v_off;
end $$;

revoke all on function public.admin_audit_history(timestamptz, timestamptz, uuid, text, text, text, int, int)
  from public, anon;
grant execute on function public.admin_audit_history(timestamptz, timestamptz, uuid, text, text, text, int, int)
  to authenticated;
