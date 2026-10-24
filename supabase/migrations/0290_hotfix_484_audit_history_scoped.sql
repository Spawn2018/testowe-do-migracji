-- #484 / P2 (właściciel 23.10 08:17): Historia zmian dla HHL_OPS, KSH i SCX.
-- Bez zmiany polityki audit_read (odczyt tylko przez RPC SECURITY DEFINER).
-- HHL_ADMIN / HHL_OPS — pełny zakres; CLIENT/CARRIER — tylko wpisy swoich transportów
-- + redakcja numerów zleceń (KSH) i cen drugiej strony (KSH↔SCX).

-- Rozwiązanie load_id z wiersza audytu (entity / entity_id / jsonb).
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
begin
  v := coalesce(p_new ->> 'load_id', p_old ->> 'load_id');
  if v ~ '^[0-9a-fA-F-]{36}$' then
    return v::uuid;
  end if;

  if p_entity = 'loads' and coalesce(p_entity_id, '') ~ '^[0-9a-fA-F-]{36}$' then
    return p_entity_id::uuid;
  end if;

  if position(':' in coalesce(p_entity_id, '')) > 0 then
    v := split_part(p_entity_id, ':', 1);
    if v ~ '^[0-9a-fA-F-]{36}$' then
      return v::uuid;
    end if;
  end if;

  if p_entity in ('load_cost', 'load_revenue', 'load_agreed_fees', 'shipment_items', 'load_escorts')
     and coalesce(p_entity_id, '') ~ '^[0-9a-fA-F-]{36}$' then
    -- często PK = load_id albo id dziecka z load_id w jsonb (wyżej)
    if exists (select 1 from public.loads l where l.id = p_entity_id::uuid) then
      return p_entity_id::uuid;
    end if;
  end if;

  if p_entity = 'documents' and coalesce(p_entity_id, '') ~ '^[0-9a-fA-F-]{36}$' then
    select d.load_id into v_lid from public.documents d where d.id = p_entity_id::uuid;
    return v_lid;
  end if;

  -- load_permits: entity_id = load_id:permit_id (obsłużone wyżej przez split_part)

  return null;
end;
$$;

revoke all on function public.audit_history_resolve_load_id(text, text, jsonb, jsonb)
  from public, anon, authenticated;
comment on function public.audit_history_resolve_load_id(text, text, jsonb, jsonb) is
  '#484: load_id z wpisu audit_log (wewnętrzne; bez EXECUTE dla ról API).';

-- Czy transport jest widoczny dla bieżącej org (jak RLS loads_read, bez SITE).
create or replace function public.audit_history_load_visible(p_load_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_load_id is null then false
    when public.is_hhl() is true then true
    when public.current_org_kind() = 'CLIENT' then exists (
      select 1 from public.loads l
      join public.projects p on p.id = l.project_id
      where l.id = p_load_id
        and p.client_org_id = public.current_org_id()
    )
    when public.current_org_kind() = 'CARRIER' then exists (
      select 1 from public.loads l
      where l.id = p_load_id
        and l.carrier_org_id = public.current_org_id()
    )
    else false
  end;
$$;

revoke all on function public.audit_history_load_visible(uuid)
  from public, anon, authenticated;
comment on function public.audit_history_load_visible(uuid) is
  '#484: widoczność transportu jak RLS loads (CLIENT/CARRIER); wewnętrzne.';

-- Redakcja old/new: KSH bez numerów zleceń i cen przewoźnika; SCX bez cen klienta/marży.
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
  v_order constant text[] := array['hhl_order_no', 'carrier_order_no', 'order_no'];
  v_carrier_money constant text[] := array[
    'amount', 'net_amount', 'gross_amount', 'unit_price', 'total', 'fee', 'fee_pln', 'fee_eur',
    'cost', 'cost_pln', 'cost_eur', 'baf', 'baf_pln', 'carrier_amount', 'agreed_amount',
    'line_total', 'price', 'rate'
  ];
  v_client_money constant text[] := array[
    'amount', 'net_amount', 'gross_amount', 'unit_price', 'total', 'revenue', 'revenue_pln',
    'revenue_eur', 'client_amount', 'margin', 'margin_pct', 'margin_pln', 'line_total',
    'price', 'rate'
  ];
begin
  if (v is null) is true or v = '{}'::jsonb then
    return v;
  end if;

  if p_kind = 'CLIENT' then
    foreach k in array v_order loop
      if v ? k then
        v := v - k;
      end if;
    end loop;
    if p_entity in ('load_cost', 'load_agreed_fees', 'rate_cards', 'rate_rules', 'baf_definitions', 'baf_index_values') then
      return '{}'::jsonb;
    end if;
    foreach k in array v_carrier_money loop
      if v ? k then
        v := jsonb_set(v, array[k], '"••••"'::jsonb);
      end if;
    end loop;
  elsif p_kind = 'CARRIER' then
    if p_entity in ('load_revenue', 'invoices', 'invoice_lines') then
      return '{}'::jsonb;
    end if;
    foreach k in array v_client_money loop
      if v ? k then
        v := jsonb_set(v, array[k], '"••••"'::jsonb);
      end if;
    end loop;
  end if;

  return v;
end;
$$;

revoke all on function public.audit_history_redact_payload(text, text, jsonb)
  from public, anon, authenticated;
comment on function public.audit_history_redact_payload(text, text, jsonb) is
  '#484: redakcja old_value/new_value dla CLIENT/CARRIER; wewnętrzne.';

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
  v_full boolean;
  v_load_entities constant text[] := array[
    'loads', 'shipment_items', 'load_escorts', 'load_permits', 'documents',
    'load_cost', 'load_revenue', 'load_agreed_fees', 'permits'
  ];
begin
  v_role := public.current_app_role();
  if (v_role is not null) is not true then
    raise exception 'Brak sesji' using errcode = '42501';
  end if;

  v_full := v_role in ('HHL_ADMIN', 'HHL_OPS');
  v_kind := public.current_org_kind()::text;

  if v_full is not true
     and (v_kind in ('CLIENT', 'CARRIER')) is not true then
    raise exception 'Brak dostępu do historii zmian' using errcode = '42501';
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
    and (
      v_full
      or (
        a.entity = any (v_load_entities)
        and (
          -- KSH nie widzi kosztu/opłat SCX; SCX nie widzi przychodu KSH
          (v_kind = 'CLIENT' and a.entity not in ('load_cost', 'load_agreed_fees'))
          or (v_kind = 'CARRIER' and a.entity not in ('load_revenue'))
          or (v_kind not in ('CLIENT', 'CARRIER'))
        )
        and public.audit_history_load_visible(
          public.audit_history_resolve_load_id(a.entity, a.entity_id, a.old_value, a.new_value)
        )
      )
    )
  order by a.created_at desc, a.id desc
  limit v_lim offset v_off;
end;
$$;

comment on function public.admin_audit_history(timestamptz, timestamptz, uuid, text, text, text, int, int) is
  '#484: Historia zmian — HHL_ADMIN/HHL_OPS pełna; KSH/SCX tylko swoje transporty + redakcja E41/cen.';
