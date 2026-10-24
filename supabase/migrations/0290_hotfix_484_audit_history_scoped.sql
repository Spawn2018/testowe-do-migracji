-- #484 / P2 (właściciel 23.10 08:17) + F7 #526 r3: Historia zmian dla HHL_OPS, KSH i SCX.
-- Bez zmiany polityki audit_read. Odczyt tylko przez RPC SECURITY DEFINER.
-- load_id + scope_* przy zapisie → szybki filtr; widoczność SCX = przewoźnik z chwili wpisu.
-- F7 r3: swap = fakt zmiany dla przewoźników; backfill bez bieżącego carrier; ocena bez comment;
-- faktury issuer/recipient; KSH bez kierowcy/pilotów; AGREED_FEE na entity load; UUID ścisły;
-- actor_party/actor_label; allowlista; BEFORE INSERT.

-- ── 0) Bezpieczne UUID (F7 r3 N7 — wyzwalacz audytu nie blokuje zapisu) ─────
create or replace function public.audit_history_try_uuid(p text)
returns uuid
language plpgsql
immutable
set search_path = public
as $$
begin
  if p is null or length(p) is distinct from 36 then
    return null;
  end if;
  if p !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
    return null;
  end if;
  return p::uuid;
exception when others then
  return null;
end;
$$;

revoke all on function public.audit_history_try_uuid(text) from public, anon, authenticated;

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
  v_lid uuid;
  v_id uuid;
  v_ent text := coalesce(p_entity, '');
begin
  v_lid := public.audit_history_try_uuid(coalesce(p_new ->> 'load_id', p_old ->> 'load_id'));
  if v_lid is not null then
    return v_lid;
  end if;

  if v_ent in ('loads', 'load') then
    return public.audit_history_try_uuid(p_entity_id);
  end if;

  if position(':' in coalesce(p_entity_id, '')) > 0 then
    v_lid := public.audit_history_try_uuid(split_part(p_entity_id, ':', 1));
    if v_lid is not null then
      return v_lid;
    end if;
  end if;

  v_id := public.audit_history_try_uuid(p_entity_id);
  if v_id is not null and v_ent in (
       'load_cost', 'load_revenue', 'load_agreed_fees', 'shipment_items',
       'load_escorts', 'carrier_ratings'
     ) then
    if exists (select 1 from public.loads l where l.id = v_id) then
      return v_id;
    end if;
    if v_ent = 'load_agreed_fees' then
      select f.load_id into v_lid from public.load_agreed_fees f where f.id = v_id;
      return v_lid;
    end if;
    if v_ent = 'shipment_items' then
      select s.load_id into v_lid from public.shipment_items s where s.id = v_id;
      return v_lid;
    end if;
    if v_ent = 'load_escorts' then
      select e.load_id into v_lid from public.load_escorts e where e.id = v_id;
      return v_lid;
    end if;
  end if;

  if v_id is not null and v_ent = 'documents' then
    select d.load_id into v_lid from public.documents d where d.id = v_id;
    return v_lid;
  end if;

  if v_id is not null and v_ent = 'permits' then
    -- load_permits: tylko (load_id, permit_id), bez created_at
    select lp.load_id into v_lid
      from public.load_permits lp
     where lp.permit_id = v_id
     order by lp.load_id
     limit 1;
    return v_lid;
  end if;

  return null;
end;
$$;

revoke all on function public.audit_history_resolve_load_id(text, text, jsonb, jsonb)
  from public, anon, authenticated;

-- ── 3) Redakcja: allowlista kluczy (F7 r2 pkt 6; bez listy zabronionych) ─────
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
  v_keep boolean;
  v_child jsonb;
  v_arr jsonb;
  v_elem jsonb;
  i int;
  v_ent text := lower(coalesce(p_entity, ''));
  -- wspólne (status, daty, zasoby, nazwy) — bez kwot; bez kierowcy (N6: tylko CARRIER);
  -- bez comment oceny (N3); bez label/note na pieniądzach (F7 r3)
  v_ops constant text[] := array[
    'id', 'load_id', 'project_id', 'status', 'code', 'symbol', 'phase',
    'order_no', 'planned_load_at', 'planned_unload_at', 'load_date', 'unload_date',
    'eta_site', 'eta_confidence_min', 'eta_basis', 'ferry_sailing_id', 'sailing_id',
    'actual_departure_at', 'actual_arrival_at', 'delayed_arrival_at',
    'ready_at', 'cancelled_at', 'cancel_reason', 'tracking_window_start', 'tracking_window_end',
    'combo_length_m', 'combo_width_m', 'combo_height_m', 'combo_weight_t',
    'length_m', 'width_m', 'height_m', 'weight_t', 'axle_count', 'cargo_class',
    'route_code', 'corridor_code',
    'tractor_plate', 'trailer_plate', 'pilot_plates', 'escort_count',
    'awiz_se_at', 'unloaded_at', 'delivered_at', 'departed_at', 'arrived_at',
    'file_name', 'category', 'mime_type', 'size_bytes', 'visible_to',
    'kind', 'side', 'status', 'proposed_by_kind',
    'score', '_reason', 'event_type', 'occurred_at', '_carrier_changed',
    'count', 'qty', 'quantity', 'pieces',
    'permit_no', 'permit_id', 'insurance_id', 'firm', 'trasa', 'valid_from', 'valid_to'
  ];
  v_carrier_driver constant text[] := array[
    'driver_name', 'driver_phone', 'driver_phone_country'
  ];
  v_money_text constant text[] := array['label', 'note', 'name', 'comment', 'label_pl'];
  v_client_money constant text[] := array[
    'amount', 'amount_eur', 'net_amount', 'gross_amount', 'unit_price',
    'total', 'total_amount', 'base_amount', 'extras_amount', 'baf_amount',
    'computed_total_eur', 'invoiced_total_eur', 'revenue', 'revenue_pln', 'revenue_eur',
    'fee', 'fee_pln', 'fee_eur', 'net', 'gross'
  ];
  v_carrier_money constant text[] := array[
    'amount', 'amount_eur', 'net_amount', 'gross_amount', 'unit_price',
    'total', 'total_amount', 'base_amount', 'extras_amount', 'baf_amount',
    'computed_total_eur', 'invoiced_total_eur', 'cost', 'cost_pln', 'cost_eur',
    'fee', 'fee_pln', 'fee_eur', 'net', 'gross', 'baf', 'baf_pln'
  ];
  v_carrier_order constant text[] := array['carrier_order_no'];
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

  -- całe encje niewidoczne dla strony
  if p_kind = 'CLIENT' and v_ent in (
    'load_cost', 'rate_cards', 'rate_rules',
    'baf_definitions', 'baf_index_values', 'carrier_ratings'
  ) then
    return '{}'::jsonb;
  end if;
  if p_kind = 'CARRIER' and v_ent in ('load_revenue', 'invoices', 'invoice_lines') then
    return '{}'::jsonb;
  end if;

  for k in select key from jsonb_each(v) loop
    v_keep := lower(k) = any (v_ops);

    if p_kind = 'CLIENT' then
      -- własny order_no; bez hhl/carrier; bez kierowcy/pilotów (N6)
      if lower(k) = 'order_no' then
        v_keep := true;
      end if;
      if lower(k) in (
        'hhl_order_no', 'carrier_order_no',
        'driver_name', 'driver_phone', 'driver_phone_country',
        'contact_phone', 'contact_name', 'phone', 'phone_national', 'email_personal'
      ) then
        v_keep := false;
      end if;
      -- kwoty tylko load_revenue / dopłaty REVENUE (strona i tak filtruje wpisy)
      if v_ent in ('load_revenue', 'load_agreed_fees') and lower(k) = any (v_client_money) then
        v_keep := true;
      end if;
    elsif p_kind = 'CARRIER' then
      if lower(k) = any (v_carrier_order) then
        v_keep := true;
      end if;
      if lower(k) = any (v_carrier_driver) then
        v_keep := true;
      end if;
      if lower(k) in ('hhl_order_no', 'order_no') then
        v_keep := false;
      end if;
      if v_ent in ('load_cost', 'load_agreed_fees') and lower(k) = any (v_carrier_money) then
        v_keep := true;
      end if;
      -- N3: ocena bez wewnętrznego komentarza HHL
      if v_ent = 'carrier_ratings' and lower(k) = 'comment' then
        v_keep := false;
      end if;
    end if;

    -- F7 r3: label/note na wierszach pieniędzy nie dla drugiej strony (ani w ogóle poza HHL)
    if v_ent in ('load_agreed_fees', 'load_cost', 'load_revenue', 'load')
       and lower(k) = any (v_money_text) then
      v_keep := false;
    end if;

    if v_keep is not true then
      if jsonb_typeof(v -> k) in ('object', 'array') then
        v_child := public.audit_history_redact_payload(p_kind, p_entity, v -> k);
        if v_child = '{}'::jsonb or v_child = '[]'::jsonb then
          v := v - k;
        else
          -- zagnieżdżone obiekty (pricing itd.): tylko jeśli po allowliście coś zostało
          -- i klucz kontenera sam jest dozwolony — inaczej usuń całe (F7: margin_eur w pricing)
          v := v - k;
        end if;
      else
        v := v - k;
      end if;
    elsif jsonb_typeof(v -> k) in ('object', 'array') then
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

-- F7 r3 N1: zmiana przewoźnika — dla CARRIER tylko fakt (bez wartości obu stron)
create or replace function public.audit_history_redact_carrier_swap(p jsonb)
returns jsonb
language plpgsql
immutable
set search_path = public
as $$
declare
  v jsonb := coalesce(p, '{}'::jsonb);
  k text;
  v_drop constant text[] := array[
    'carrier_org_id', 'carrier_order_no', 'hhl_order_no', 'order_no',
    'driver_name', 'driver_phone', 'driver_phone_country',
    'tractor_plate', 'trailer_plate', 'pilot_plates',
    'contact_phone', 'contact_name', 'phone', 'phone_national'
  ];
begin
  if jsonb_typeof(v) is distinct from 'object' then
    return jsonb_build_object('_carrier_changed', true);
  end if;
  foreach k in array v_drop loop
    v := v - k;
  end loop;
  -- usuń też warianty wielkości liter
  for k in select key from jsonb_each(v) loop
    if lower(k) = any (v_drop) then
      v := v - k;
    end if;
  end loop;
  return coalesce(v, '{}'::jsonb) || jsonb_build_object('_carrier_changed', true);
end;
$$;

revoke all on function public.audit_history_redact_carrier_swap(jsonb)
  from public, anon, authenticated;

-- ── 4) Zakres wpisu: side/visible_to/status z wiersza tabeli (nie z diffu) ──
create or replace function public.audit_history_entry_in_scope(
  p_kind text,
  p_org uuid,
  p_entity text,
  p_action text,
  p_entity_id text,
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
  v_status text;
  v_proposed text;
  v_vis text[];
  v_cat text;
  v_doc_id uuid;
  v_fee_id uuid;
  v_ent text := coalesce(p_entity, '');
  v_is_fee boolean;
begin
  v_is_fee := v_ent = 'load_agreed_fees'
    or p_action in (
      'AGREED_FEE_ADD', 'AGREED_FEE_ACCEPT', 'AGREED_FEE_REJECT',
      'AGREED_FEE_UPDATE', 'AGREED_FEE_DELETE'
    );

  if p_kind = 'CLIENT' then
    if (coalesce(p_scope_client, '00000000-0000-0000-0000-000000000000'::uuid) = p_org) is not true then
      return false;
    end if;
    if (p_load_id is null) is true then
      return false;
    end if;
    if v_ent = 'carrier_ratings' or p_action in ('CARRIER_RATING', 'CARRIER_RATED') then
      return false;
    end if;
    if v_ent in ('load_cost') then
      return false;
    end if;
    if v_is_fee then
      v_side := null; v_status := null; v_proposed := null;
      v_fee_id := public.audit_history_try_uuid(
        coalesce(p_new ->> 'fee_id', p_old ->> 'fee_id', p_entity_id)
      );
      if v_fee_id is not null then
        select f.side, f.status, coalesce(f.proposed_by_kind, 'FORWARDER')
          into v_side, v_status, v_proposed
          from public.load_agreed_fees f where f.id = v_fee_id;
      end if;
      if v_side is null then
        v_side := coalesce(p_new ->> 'side', p_old ->> 'side');
        v_status := coalesce(p_new ->> 'status', p_old ->> 'status', 'ACCEPTED');
        v_proposed := coalesce(
          p_new ->> 'proposed_by_kind', p_old ->> 'proposed_by_kind',
          p_new ->> 'by', p_old ->> 'by', 'FORWARDER'
        );
      end if;
      -- jak RLS 0178: KSH tylko REVENUE/BOTH, PENDING/ACCEPTED, propozycja HHL
      if (v_side in ('REVENUE', 'BOTH')) is not true then
        return false;
      end if;
      if (coalesce(v_status, 'ACCEPTED') in ('PENDING', 'ACCEPTED')) is not true then
        return false;
      end if;
      if (coalesce(v_proposed, 'FORWARDER') = 'FORWARDER') is not true then
        return false;
      end if;
    end if;
    if v_ent = 'documents' then
      v_vis := null; v_cat := null;
      v_doc_id := public.audit_history_try_uuid(p_entity_id);
      if v_doc_id is not null then
        select d.visible_to::text[], d.category::text
          into v_vis, v_cat
          from public.documents d where d.id = v_doc_id;
        -- N5: INVOICE — wystawca lub odbiorca (nie client_org projektu)
        if v_cat = 'INVOICE' then
          if not exists (
            select 1 from public.invoice_documents x
            join public.invoices i on i.id = x.invoice_id
             where x.document_id = v_doc_id
               and (i.issuer_org_id = p_org or i.recipient_org_id = p_org)
          ) and not exists (
            select 1 from public.invoices i
             where i.document_id = v_doc_id
               and (i.issuer_org_id = p_org or i.recipient_org_id = p_org)
          ) then
            return false;
          end if;
        end if;
      end if;
      if v_vis is null then
        begin
          select array(select jsonb_array_elements_text(coalesce(p_new -> 'visible_to', p_old -> 'visible_to')))
            into v_vis;
        exception when others then
          v_vis := null;
        end;
        v_cat := coalesce(p_new ->> 'category', p_old ->> 'category', v_cat);
        if v_cat = 'INVOICE' then
          return false;
        end if;
      end if;
      -- F7 r2: nieznane visible_to → ukryj (UPDATE bez klucza nie przecieka)
      if (v_vis is null) is true or cardinality(v_vis) = 0
         or ('CLIENT' = any (v_vis)) is not true then
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
    if v_is_fee then
      v_side := null;
      v_fee_id := public.audit_history_try_uuid(
        coalesce(p_new ->> 'fee_id', p_old ->> 'fee_id', p_entity_id)
      );
      if v_fee_id is not null then
        select f.side into v_side from public.load_agreed_fees f where f.id = v_fee_id;
      end if;
      if v_side is null then
        v_side := coalesce(p_new ->> 'side', p_old ->> 'side');
      end if;
      if (v_side in ('COST', 'BOTH')) is not true then
        return false;
      end if;
    end if;
    if v_ent = 'documents' then
      v_vis := null; v_cat := null;
      v_doc_id := public.audit_history_try_uuid(p_entity_id);
      if v_doc_id is not null then
        select d.visible_to::text[], d.category::text
          into v_vis, v_cat
          from public.documents d where d.id = v_doc_id;
        -- N5: issuer/recipient (nie carrier_org_id na invoices — kolumna może nie istnieć)
        if v_cat = 'INVOICE' then
          if not exists (
            select 1 from public.invoice_documents x
            join public.invoices i on i.id = x.invoice_id
             where x.document_id = v_doc_id
               and (i.issuer_org_id = p_org or i.recipient_org_id = p_org)
          ) and not exists (
            select 1 from public.invoices i
             where i.document_id = v_doc_id
               and (i.issuer_org_id = p_org or i.recipient_org_id = p_org)
          ) then
            return false;
          end if;
        end if;
      end if;
      if v_vis is null then
        begin
          select array(select jsonb_array_elements_text(coalesce(p_new -> 'visible_to', p_old -> 'visible_to')))
            into v_vis;
        exception when others then
          v_vis := null;
        end;
        v_cat := coalesce(p_new ->> 'category', p_old ->> 'category', v_cat);
        if v_cat = 'INVOICE' then
          return false;
        end if;
      end if;
      if (v_vis is null) is true or cardinality(v_vis) = 0
         or ('CARRIER' = any (v_vis)) is not true then
        return false;
      end if;
    end if;
    return true;
  end if;

  return false;
end;
$$;

revoke all on function public.audit_history_entry_in_scope(
  text, uuid, text, text, text, uuid, uuid, uuid, jsonb, jsonb
) from public, anon, authenticated;

-- stara sygnatura (8 jsonb bez entity_id) — usuń po F7 r1
drop function if exists public.audit_history_entry_in_scope(
  text, uuid, text, text, uuid, uuid, uuid, jsonb, jsonb
);

-- ── 5) Uzupełnienie zakresu (wspólne: trigger INSERT + audit_row_change) ────
create or replace function public.audit_history_compute_scope(
  p_entity text,
  p_entity_id text,
  p_old jsonb,
  p_new jsonb,
  p_load uuid default null,
  p_carrier uuid default null,
  p_client uuid default null
) returns table (out_load uuid, out_carrier uuid, out_client uuid)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_load uuid := p_load;
  v_carrier uuid := p_carrier;
  v_client uuid := p_client;
  v_old_c uuid;
  v_new_c uuid;
  v_full jsonb;
begin
  if v_load is null then
    v_load := public.audit_history_resolve_load_id(p_entity, p_entity_id, p_old, p_new);
  end if;

  v_full := coalesce(p_new, p_old, '{}'::jsonb);
  v_old_c := public.audit_history_try_uuid(p_old ->> 'carrier_org_id');
  v_new_c := public.audit_history_try_uuid(p_new ->> 'carrier_org_id');

  -- Zmiana przewoźnika: zakres = OLD (F7 r2/r3) — nowy nie widzi PII starego
  if p_entity in ('loads', 'load')
     and v_old_c is not null
     and v_new_c is not null
     and v_old_c is distinct from v_new_c then
    v_carrier := v_old_c;
  elsif v_carrier is null then
    v_carrier := coalesce(
      v_old_c,
      v_new_c,
      public.audit_history_try_uuid(v_full ->> 'carrier_org_id')
    );
    -- live INSERT bez carrier w JSON: bieżący (chwila wpisu). Backfill NIE używa tej ścieżki.
    if v_carrier is null and v_load is not null then
      select l.carrier_org_id into v_carrier from public.loads l where l.id = v_load;
    end if;
  end if;

  if v_client is null and v_load is not null then
    select p.client_org_id into v_client
      from public.loads l
      join public.projects p on p.id = l.project_id
     where l.id = v_load;
  end if;

  return query select v_load, v_carrier, v_client;
end;
$$;

revoke all on function public.audit_history_compute_scope(text, text, jsonb, jsonb, uuid, uuid, uuid)
  from public, anon, authenticated;

-- BEFORE INSERT: wpisy z funkcji (LOAD_STATUS_SET itd.) dostają load_id/scope_*
create or replace function public.audit_log_before_insert_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_load uuid;
  v_carrier uuid;
  v_client uuid;
begin
  select s.out_load, s.out_carrier, s.out_client
    into v_load, v_carrier, v_client
    from public.audit_history_compute_scope(
      new.entity, new.entity_id, new.old_value, new.new_value,
      new.load_id, new.scope_carrier_org_id, new.scope_client_org_id
    ) s;
  new.load_id := v_load;
  new.scope_carrier_org_id := v_carrier;
  new.scope_client_org_id := v_client;
  return new;
end;
$$;

revoke all on function public.audit_log_before_insert_scope() from public, anon, authenticated;

drop trigger if exists trg_audit_log_fill_scope on public.audit_log;
create trigger trg_audit_log_fill_scope
  before insert on public.audit_log
  for each row
  execute function public.audit_log_before_insert_scope();

comment on function public.audit_log_before_insert_scope() is
  '#484 F7 r2: każdy INSERT do audit_log uzupełnia load_id/scope_* (także z funkcji).';

-- ── 6) audit_row_change: pełny wiersz; side/status w diffie dopłat ──────────
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
  -- klucze zawsze w diffie (widoczność historii bez odczytu tabeli przy DELETE)
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
    -- F7 r2 pkt 2/4: side / visible_to zawsze w payloadzie (nie tylko gdy zmienione)
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
    -- zmiana przewoźnika: zachowaj carrier_org_id OLD+NEW w payloadzie
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
  'HIST-11 + #466 + #505 + #484: PII; load_id/scope_*; side/visible_to w UPDATE; zakres OLD przy zmianie przewoźnika.';

-- ── 7) Backfill: przewoźnik z chwili wpisu; nieznany → NULL (F7 r3 N2) ──────
-- Partiami po id. NIGDY nie bierze bieżącego loads.carrier_org_id.
do $$
declare
  v_batch int := 5000;
  v_max bigint;
  v_from bigint := 0;
  v_to bigint;
begin
  select coalesce(max(id), 0) into v_max from public.audit_log;
  while v_from < v_max loop
    v_to := v_from + v_batch;

    update public.audit_log a
       set load_id = public.audit_history_resolve_load_id(a.entity, a.entity_id, a.old_value, a.new_value)
     where a.id > v_from and a.id <= v_to
       and a.load_id is null;

    -- carrier wyłącznie z JSON (OLD przy zmianie); brak → NULL
    update public.audit_log a
       set scope_carrier_org_id = case
             when public.audit_history_try_uuid(a.old_value ->> 'carrier_org_id') is not null
              and public.audit_history_try_uuid(a.new_value ->> 'carrier_org_id') is not null
              and (a.old_value ->> 'carrier_org_id') is distinct from (a.new_value ->> 'carrier_org_id')
               then public.audit_history_try_uuid(a.old_value ->> 'carrier_org_id')
             else coalesce(
               public.audit_history_try_uuid(a.old_value ->> 'carrier_org_id'),
               public.audit_history_try_uuid(a.new_value ->> 'carrier_org_id')
             )
           end
     where a.id > v_from and a.id <= v_to
       and a.scope_carrier_org_id is null
       and a.entity in ('loads', 'load');

    -- pozostałe encje: carrier tylko z JSON (bez l.carrier_org_id); klient z projektu OK
    update public.audit_log a
       set scope_carrier_org_id = coalesce(
             a.scope_carrier_org_id,
             public.audit_history_try_uuid(a.old_value ->> 'carrier_org_id'),
             public.audit_history_try_uuid(a.new_value ->> 'carrier_org_id')
           ),
           scope_client_org_id = coalesce(a.scope_client_org_id, p.client_org_id)
      from public.loads l
      join public.projects p on p.id = l.project_id
     where a.load_id = l.id
       and a.id > v_from and a.id <= v_to
       and (a.scope_carrier_org_id is null or a.scope_client_org_id is null)
       and a.entity is distinct from 'loads'
       and a.entity is distinct from 'load';

    -- klient dla loads
    update public.audit_log a
       set scope_client_org_id = p.client_org_id
      from public.loads l
      join public.projects p on p.id = l.project_id
     where a.load_id = l.id
       and a.id > v_from and a.id <= v_to
       and a.scope_client_org_id is null;

    v_from := v_to;
  end loop;
end $$;

-- ── 8) admin_audit_history ──────────────────────────────────────────────────
drop function if exists public.admin_audit_history(timestamptz, timestamptz, uuid, text, text, text, int, int);

create function public.admin_audit_history(
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
  actor_party        text,
  actor_label        text,
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
    case
      when v_full then a.user_id
      when u.org_id = v_org then a.user_id
      else null
    end,
    -- prawdziwy e-mail tylko własna firma / HHL (F7: nie mylić z nazwą firmy)
    case
      when v_full then u.email::text
      when u.org_id = v_org then u.email::text
      else null
    end,
    case
      when v_full then a.acting_as_user_id
      when aa.org_id = v_org then a.acting_as_user_id
      else null
    end,
    case
      when v_full then aa.email::text
      when aa.org_id = v_org then aa.email::text
      else null
    end,
    case ou.kind::text
      when 'FORWARDER' then 'HHL'
      when 'CLIENT' then 'KSH'
      when 'CARRIER' then 'SCX'
      else null
    end,
    case
      when v_full or u.org_id = v_org then coalesce(u.full_name, u.email::text)
      when u.org_id is not null then coalesce(ou.name, ou.code, 'inna firma')
      else null
    end,
    a.source,
    (a.source is not null) as is_automatic,
    case
      when v_full then a.old_value
      when v_kind = 'CARRIER'
           and public.audit_history_try_uuid(a.old_value ->> 'carrier_org_id') is not null
           and public.audit_history_try_uuid(a.new_value ->> 'carrier_org_id') is not null
           and (a.old_value ->> 'carrier_org_id') is distinct from (a.new_value ->> 'carrier_org_id')
        then public.audit_history_redact_carrier_swap(
               public.audit_history_redact_payload(v_kind, a.entity, a.old_value)
             )
      else public.audit_history_redact_payload(v_kind, a.entity, a.old_value)
    end,
    case
      when v_full then a.new_value
      when v_kind = 'CARRIER'
           and public.audit_history_try_uuid(a.old_value ->> 'carrier_org_id') is not null
           and public.audit_history_try_uuid(a.new_value ->> 'carrier_org_id') is not null
           and (a.old_value ->> 'carrier_org_id') is distinct from (a.new_value ->> 'carrier_org_id')
        then public.audit_history_redact_carrier_swap(
               public.audit_history_redact_payload(v_kind, a.entity, a.new_value)
             )
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
      or coalesce(a.source, '') ilike '%' || v_q || '%' escape '\'
      /* F7: nie-HHL bez entity_id (istnienie ukrytego id) i bez raw JSON */
      or (
        v_full
        and (
          coalesce(a.entity_id, '') ilike '%' || v_q || '%' escape '\'
          or coalesce(u.email::text, '') ilike '%' || v_q || '%' escape '\'
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
        and a.load_id is not null
        -- wydajność: ukryte encje wykluczone przed funkcją (F7 r3)
        and not (v_kind = 'CLIENT' and a.entity in ('load_cost', 'carrier_ratings'))
        and not (v_kind = 'CLIENT' and a.action in ('CARRIER_RATING', 'CARRIER_RATED'))
        and not (v_kind = 'CARRIER' and a.entity = 'load_revenue')
        and (
          (v_kind = 'CLIENT' and a.scope_client_org_id = v_org)
          or (v_kind = 'CARRIER' and a.scope_carrier_org_id = v_org)
        )
        and public.audit_history_entry_in_scope(
          v_kind, v_org, a.entity, a.action, a.entity_id,
          a.load_id, a.scope_carrier_org_id, a.scope_client_org_id,
          a.old_value, a.new_value
        )
      )
    )
  order by a.created_at desc, a.id desc
  limit v_lim offset v_off;
end;
$$;

revoke all on function public.admin_audit_history(timestamptz, timestamptz, uuid, text, text, text, int, int)
  from public, anon;
grant execute on function public.admin_audit_history(timestamptz, timestamptz, uuid, text, text, text, int, int)
  to authenticated;

comment on function public.admin_audit_history(timestamptz, timestamptz, uuid, text, text, text, int, int) is
  '#484/#526 r3: Historia — N1–N7; actor_party/label; scope indeksowany; allowlista.';
