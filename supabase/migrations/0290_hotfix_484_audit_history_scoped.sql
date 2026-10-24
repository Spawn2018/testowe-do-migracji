-- #484 / P2 (właściciel 23.10 08:17) + F7 #526: Historia zmian dla HHL_OPS, KSH i SCX.
-- Bez zmiany polityki audit_read. Odczyt tylko przez RPC SECURITY DEFINER.
-- load_id + scope_* przy zapisie → szybki filtr; widoczność SCX = przewoźnik z chwili wpisu.

-- ── 1) Kolumny zakresu na audit_log ─────────────────────────────────────────
alter table public.audit_log
  add column if not exists load_id uuid,
  add column if not exists scope_carrier_org_id uuid,
  add column if not exists scope_client_org_id uuid;

comment on column public.audit_log.load_id is
  '#484: transport powiązany z wpisem (indeks pod historię KSH/SCX).';
comment on column public.audit_log.scope_carrier_org_id is
  '#484: przewoźnik w chwili wpisu (nie bieżący po przepięciu).';
comment on column public.audit_log.scope_client_org_id is
  '#484: klient projektu w chwili wpisu.';

create index if not exists audit_log_load_created_idx
  on public.audit_log (load_id, created_at desc)
  where load_id is not null;
create index if not exists audit_log_scope_carrier_created_idx
  on public.audit_log (scope_carrier_org_id, created_at desc)
  where scope_carrier_org_id is not null;
create index if not exists audit_log_scope_client_created_idx
  on public.audit_log (scope_client_org_id, created_at desc)
  where scope_client_org_id is not null;

-- ── 2) Pomocnicze: load_id z wiersza / entity ───────────────────────────────
create or replace function public.audit_history_resolve_load_id(
  p_entity text,
  p_entity_id text,
  p_old jsonb,
  p_new jsonb
) returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v text;
  v_lid uuid;
  v_ent text := coalesce(p_entity, '');
begin
  v := coalesce(p_new ->> 'load_id', p_old ->> 'load_id');
  if v ~ '^[0-9a-fA-F-]{36}$' then
    return v::uuid;
  end if;

  if v_ent in ('loads', 'load') and coalesce(p_entity_id, '') ~ '^[0-9a-fA-F-]{36}$' then
    return p_entity_id::uuid;
  end if;

  if position(':' in coalesce(p_entity_id, '')) > 0 then
    v := split_part(p_entity_id, ':', 1);
    if v ~ '^[0-9a-fA-F-]{36}$' then
      return v::uuid;
    end if;
  end if;

  if v_ent in (
       'load_cost', 'load_revenue', 'load_agreed_fees', 'shipment_items',
       'load_escorts', 'carrier_ratings'
     )
     and coalesce(p_entity_id, '') ~ '^[0-9a-fA-F-]{36}$' then
    if exists (select 1 from public.loads l where l.id = p_entity_id::uuid) then
      return p_entity_id::uuid;
    end if;
    if v_ent = 'load_agreed_fees' then
      select f.load_id into v_lid from public.load_agreed_fees f where f.id = p_entity_id::uuid;
      return v_lid;
    end if;
    if v_ent = 'shipment_items' then
      select s.load_id into v_lid from public.shipment_items s where s.id = p_entity_id::uuid;
      return v_lid;
    end if;
    if v_ent = 'load_escorts' then
      select e.load_id into v_lid from public.load_escorts e where e.id = p_entity_id::uuid;
      return v_lid;
    end if;
  end if;

  if v_ent = 'documents' and coalesce(p_entity_id, '') ~ '^[0-9a-fA-F-]{36}$' then
    select d.load_id into v_lid from public.documents d where d.id = p_entity_id::uuid;
    return v_lid;
  end if;

  if v_ent = 'permits' and coalesce(p_entity_id, '') ~ '^[0-9a-fA-F-]{36}$' then
    select lp.load_id into v_lid
      from public.load_permits lp
     where lp.permit_id = p_entity_id::uuid
     order by lp.created_at desc nulls last
     limit 1;
    return v_lid;
  end if;

  return null;
end;
$$;

revoke all on function public.audit_history_resolve_load_id(text, text, jsonb, jsonb)
  from public, anon, authenticated;

-- ── 3) Redakcja rekurencyjna (usuwa klucze; bez ••••) ───────────────────────
create or replace function public.audit_history_redact_payload(
  p_kind text,
  p_entity text,
  p_payload jsonb
) returns jsonb
language plpgsql
immutable
set search_path = public
as $$
declare
  v jsonb := p_payload;
  k text;
  v_order_hide constant text[] := array['hhl_order_no', 'carrier_order_no'];
  -- KSH: ceny SCX / koszt. SCX: ceny klienta / marża. Wspólne kwoty wg strony.
  v_money_client_hide constant text[] := array[
    'amount', 'amount_eur', 'net_amount', 'gross_amount', 'unit_price', 'total', 'total_amount',
    'base_amount', 'extras_amount', 'baf_amount', 'computed_total_eur', 'invoiced_total_eur',
    'fee', 'fee_pln', 'fee_eur', 'cost', 'cost_pln', 'cost_eur', 'baf', 'baf_pln',
    'carrier_amount', 'agreed_amount', 'line_total', 'price', 'rate', 'net', 'gross', 'payout'
  ];
  v_money_carrier_hide constant text[] := array[
    'amount', 'amount_eur', 'net_amount', 'gross_amount', 'unit_price', 'total', 'total_amount',
    'base_amount', 'extras_amount', 'baf_amount', 'computed_total_eur', 'invoiced_total_eur',
    'revenue', 'revenue_pln', 'revenue_eur', 'client_amount', 'margin', 'margin_pct', 'margin_pln',
    'margin_eur', 'line_total', 'price', 'rate', 'net', 'gross', 'payout', 'fee', 'fee_pln', 'fee_eur'
  ];
  v_child jsonb;
  v_arr jsonb;
  v_elem jsonb;
  i int;
begin
  if (v is null) is true or v = '{}'::jsonb then
    return v;
  end if;

  if jsonb_typeof(v) = 'array' then
    v_arr := '[]'::jsonb;
    for i in 0 .. jsonb_array_length(v) - 1 loop
      v_elem := v -> i;
      if jsonb_typeof(v_elem) in ('object', 'array') then
        v_arr := v_arr || jsonb_build_array(
          public.audit_history_redact_payload(p_kind, p_entity, v_elem)
        );
      else
        v_arr := v_arr || jsonb_build_array(v_elem);
      end if;
    end loop;
    return v_arr;
  end if;

  if jsonb_typeof(v) is distinct from 'object' then
    return v;
  end if;

  if p_kind = 'CLIENT' then
    if p_entity in (
      'load_cost', 'rate_cards', 'rate_rules',
      'baf_definitions', 'baf_index_values', 'carrier_ratings'
    ) then
      return '{}'::jsonb;
    end if;
    foreach k in array v_order_hide loop
      v := v - k;
    end loop;
    -- dopłaty REVENUE: KSH widzi amount_eur; ukryj tylko koszt/marżę SCX
    if p_entity = 'load_agreed_fees' then
      foreach k in array array[
        'cost', 'cost_pln', 'cost_eur', 'carrier_amount', 'margin', 'margin_pct', 'margin_pln', 'margin_eur'
      ] loop
        v := v - k;
      end loop;
    else
      foreach k in array v_money_client_hide loop
        v := v - k;
      end loop;
    end if;
  elsif p_kind = 'CARRIER' then
    if p_entity in ('load_revenue', 'invoices', 'invoice_lines') then
      return '{}'::jsonb;
    end if;
    if p_entity = 'load_agreed_fees' then
      foreach k in array array[
        'revenue', 'revenue_pln', 'revenue_eur', 'client_amount',
        'margin', 'margin_pct', 'margin_pln', 'margin_eur'
      ] loop
        v := v - k;
      end loop;
    else
      foreach k in array v_money_carrier_hide loop
        v := v - k;
      end loop;
    end if;
    -- numery zleceń KSH / HHL — nie dla SCX (E41); własny carrier_order_no zostaje
    v := v - 'hhl_order_no';
    v := v - 'order_no';
  end if;

  for k in select key from jsonb_each(v) loop
    if jsonb_typeof(v -> k) in ('object', 'array') then
      v_child := public.audit_history_redact_payload(p_kind, p_entity, v -> k);
      if v_child = '{}'::jsonb or v_child = '[]'::jsonb then
        v := v - k;
      else
        v := jsonb_set(v, array[k], v_child);
      end if;
    end if;
  end loop;

  return v;
end;
$$;

revoke all on function public.audit_history_redact_payload(text, text, jsonb)
  from public, anon, authenticated;

-- ── 4) Czy wpis jest w zakresie roli (po denormalizacji / side / visible_to) ─
create or replace function public.audit_history_entry_in_scope(
  p_kind text,
  p_org uuid,
  p_entity text,
  p_action text,
  p_load_id uuid,
  p_scope_carrier uuid,
  p_scope_client uuid,
  p_old jsonb,
  p_new jsonb
) returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_side text;
  v_vis text[];
  v_ent text := coalesce(p_entity, '');
begin
  if p_kind = 'CLIENT' then
    if (coalesce(p_scope_client, '00000000-0000-0000-0000-000000000000'::uuid) = p_org) is not true then
      return false;
    end if;
    if (p_load_id is null) is true then
      return false;
    end if;
    -- ocena przewoźnika tylko HHL (+ sam SCX)
    if v_ent = 'carrier_ratings' or p_action in ('CARRIER_RATING', 'CARRIER_RATED') then
      return false;
    end if;
    if v_ent in ('load_cost') then
      return false;
    end if;
    if v_ent = 'load_agreed_fees' then
      v_side := coalesce(p_new ->> 'side', p_old ->> 'side', '');
      if v_side in ('COST') then
        return false;
      end if;
    end if;
    if v_ent = 'documents' then
      begin
        select array(select jsonb_array_elements_text(coalesce(p_new -> 'visible_to', p_old -> 'visible_to')))
          into v_vis;
      exception when others then
        v_vis := null;
      end;
      if v_vis is not null and cardinality(v_vis) > 0
         and ('CLIENT' = any (v_vis)) is not true then
        return false;
      end if;
    end if;
    return true;
  end if;

  if p_kind = 'CARRIER' then
    if (coalesce(p_scope_carrier, '00000000-0000-0000-0000-000000000000'::uuid) = p_org) is not true then
      return false;
    end if;
    if (p_load_id is null) is true then
      return false;
    end if;
    if v_ent in ('load_revenue') then
      return false;
    end if;
    if v_ent = 'load_agreed_fees' then
      v_side := coalesce(p_new ->> 'side', p_old ->> 'side', '');
      if v_side in ('REVENUE') then
        return false;
      end if;
    end if;
    if v_ent = 'documents' then
      begin
        select array(select jsonb_array_elements_text(coalesce(p_new -> 'visible_to', p_old -> 'visible_to')))
          into v_vis;
      exception when others then
        v_vis := null;
      end;
      if v_vis is not null and cardinality(v_vis) > 0
         and ('CARRIER' = any (v_vis)) is not true then
        return false;
      end if;
    end if;
    return true;
  end if;

  return false;
end;
$$;

revoke all on function public.audit_history_entry_in_scope(
  text, uuid, text, text, uuid, uuid, uuid, jsonb, jsonb
) from public, anon, authenticated;

-- ── 5) audit_row_change: pełny wiersz → load_id + scope_* ───────────────────
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
  v_id text; v_user uuid; v_source text; v_row jsonb; v_full jsonb;
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

  /* F7 #526 pkt 9: id / load_id z pełnego wiersza, nie z samego diffu. */
  v_full := coalesce(n, o);
  v_row := v_full;
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
    case when (v_full ->> 'load_id') ~ '^[0-9a-fA-F-]{36}$' then v_full ->> 'load_id' end,
    tg_table_name
  );

  v_load := public.audit_history_resolve_load_id(tg_table_name, v_id, v_old, v_new);
  if v_load is null and (v_full ->> 'load_id') ~ '^[0-9a-fA-F-]{36}$' then
    v_load := (v_full ->> 'load_id')::uuid;
  end if;
  if v_load is null and tg_table_name in ('loads', 'load')
     and (v_full ->> 'id') ~ '^[0-9a-fA-F-]{36}$' then
    v_load := (v_full ->> 'id')::uuid;
  end if;

  v_carrier := null;
  begin
    if (v_full ->> 'carrier_org_id') ~ '^[0-9a-fA-F-]{36}$' then
      v_carrier := (v_full ->> 'carrier_org_id')::uuid;
    end if;
  exception when others then
    v_carrier := null;
  end;
  if v_carrier is null and v_load is not null then
    select l.carrier_org_id into v_carrier from public.loads l where l.id = v_load;
  end if;

  v_client := null;
  if v_load is not null then
    select p.client_org_id into v_client
      from public.loads l
      join public.projects p on p.id = l.project_id
     where l.id = v_load;
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
  'HIST-11 + #466 + #505 + #484: PII jawne; load_id/scope_* przy zapisie; id z pełnego wiersza.';

-- ── 6) Backfill istniejących wpisów ─────────────────────────────────────────
update public.audit_log a
   set load_id = public.audit_history_resolve_load_id(a.entity, a.entity_id, a.old_value, a.new_value)
 where a.load_id is null;

update public.audit_log a
   set scope_carrier_org_id = l.carrier_org_id,
       scope_client_org_id = p.client_org_id
  from public.loads l
  join public.projects p on p.id = l.project_id
 where a.load_id = l.id
   and (a.scope_carrier_org_id is null or a.scope_client_org_id is null);

-- ── 7) admin_audit_history ──────────────────────────────────────────────────
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
  v_role text;
  v_kind text;
  v_org uuid;
  v_full boolean;
  v_load_entities constant text[] := array[
    'loads', 'load', 'shipment_items', 'load_escorts', 'load_permits', 'documents',
    'load_cost', 'load_revenue', 'load_agreed_fees', 'permits', 'carrier_ratings'
  ];
begin
  v_role := public.current_app_role();
  if (v_role is not null) is not true then
    raise exception 'Brak sesji' using errcode = '42501';
  end if;

  v_full := v_role in ('HHL_ADMIN', 'HHL_OPS');
  v_kind := public.current_org_kind()::text;
  v_org := public.current_org_id();

  if v_full is not true
     and (v_kind in ('CLIENT', 'CARRIER')) is not true then
    raise exception 'Brak dostępu do historii zmian' using errcode = '42501';
  end if;

  /* F7: p_user_id u KSH/SCX tylko własne osoby. */
  if v_full is not true and p_user_id is not null then
    if not exists (
      select 1 from public.app_users u
       where u.id = p_user_id and u.org_id = v_org
    ) then
      return;
    end if;
  end if;

  v_lim := least(greatest(coalesce(p_limit, 100), 1), 500);
  v_off := greatest(coalesce(p_offset, 0), 0);
  v_q := nullif(btrim(coalesce(p_q, '')), '');
  /* Bez wildcardów z zewnątrz w ilike — escape % _ \ */
  if v_q is not null then
    v_q := replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_');
  end if;

  return query
  select
    a.id,
    a.created_at,
    a.action,
    a.entity,
    a.entity_id,
    a.user_id,
    case
      when v_full then u.email::text
      when u.org_id = v_org then u.email::text
      when u.org_id is not null then coalesce(ou.name, ou.code, 'inna firma')
      else null
    end,
    a.acting_as_user_id,
    case
      when v_full then aa.email::text
      when aa.org_id = v_org then aa.email::text
      when aa.org_id is not null then coalesce(oa.name, oa.code, 'inna firma')
      else null
    end,
    a.source,
    (a.source is not null) as is_automatic,
    case
      when v_full then a.old_value
      else public.audit_history_redact_payload(v_kind, a.entity, a.old_value)
    end,
    case
      when v_full then a.new_value
      else public.audit_history_redact_payload(v_kind, a.entity, a.new_value)
    end
  from audit_log a
  left join app_users u on u.id = a.user_id
  left join app_users aa on aa.id = a.acting_as_user_id
  left join organizations ou on ou.id = u.org_id
  left join organizations oa on oa.id = aa.org_id
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
      or a.action ilike '%' || v_q || '%' escape '\'
      or a.entity ilike '%' || v_q || '%' escape '\'
      or coalesce(a.entity_id, '') ilike '%' || v_q || '%' escape '\'
      or coalesce(a.source, '') ilike '%' || v_q || '%' escape '\'
      /* F7 pkt 1: dla nie-HHL bez szukania w surowych old/new (wyciek); HHL jak dotąd. */
      or (
        v_full
        and (
          coalesce(u.email::text, '') ilike '%' || v_q || '%' escape '\'
          or coalesce(aa.email::text, '') ilike '%' || v_q || '%' escape '\'
          or coalesce(a.old_value::text, '') ilike '%' || v_q || '%' escape '\'
          or coalesce(a.new_value::text, '') ilike '%' || v_q || '%' escape '\'
        )
      )
    )
    and (
      v_full
      or (
        a.entity = any (v_load_entities)
        and public.audit_history_entry_in_scope(
          v_kind, v_org, a.entity, a.action,
          a.load_id, a.scope_carrier_org_id, a.scope_client_org_id,
          a.old_value, a.new_value
        )
      )
    )
  order by a.created_at desc, a.id desc
  limit v_lim offset v_off;
end;
$$;

comment on function public.admin_audit_history(timestamptz, timestamptz, uuid, text, text, text, int, int) is
  '#484/#526: Historia — HHL pełna; KSH/SCX scope_* + redakcja; szukaj bez raw JSON; e-mail obcej firmy → nazwa.';
