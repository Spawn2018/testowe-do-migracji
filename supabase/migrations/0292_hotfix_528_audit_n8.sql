-- #528 / D-20261024-1335-01 — Historia: N8 + ROW_UPDATE + wydajność + role faktur
-- Po 0291 (#492). B5 dostanie numer ≥0299 (po 0292–0298), nie 0293/0294.
-- 1) N8: przy zmianie carrier_org_id (gdy był poprzedni) zeruj pola przewoźnika
--    (kierowca/dostawa/tablice/order_no/telematyka/rio_*); phone_country → 'PL'.
--    Trigger po strażniku (zz_*), żeby HHL_OPS mógł zmienić przewoźnika przy
--    istniejącym carrier_order_no (clear nie wchodzi w guard jako „zmiana numeru”).
-- 2) Redakcja „zmiana przewoźnika” tylko gdy old i new nie-NULL (ROW_UPDATE; nie INSERT/DELETE).
-- 3) Szybkie filtry documents/load_agreed_fees (UUID regex, COST 10000 na entry_in_scope).
-- 4) KSH: invoice_documents.role w dozwolonych (FAKTURA_PDF/CMR/POD/KOREKTA).

-- ── 1) N8: czyszczenie pól przewoźnika ──────────────────────────────────────
create or replace function public.trg_loads_clear_on_carrier_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.carrier_org_id is not distinct from old.carrier_org_id then
    return new;
  end if;
  -- pierwsze przypisanie (NULL→org) nie czyści — nie ma poprzedniego przewoźnika
  if old.carrier_org_id is null then
    return new;
  end if;
  -- zostaw wartość tylko gdy ustawiona w tej samej instrukcji (NEW ≠ OLD)
  if new.driver_name is not distinct from old.driver_name then
    new.driver_name := null;
  end if;
  if new.driver_phone is not distinct from old.driver_phone then
    new.driver_phone := null;
  end if;
  -- NOT NULL DEFAULT 'PL' (0111) — nie null
  if new.driver_phone_country is not distinct from old.driver_phone_country then
    new.driver_phone_country := 'PL';
  end if;
  if new.tractor_plate is not distinct from old.tractor_plate then
    new.tractor_plate := null;
  end if;
  if new.trailer_plate is not distinct from old.trailer_plate then
    new.trailer_plate := null;
  end if;
  if new.carrier_order_no is not distinct from old.carrier_order_no then
    new.carrier_order_no := null;
  end if;
  -- F7 #531: pola dostawy / zestaw / piloci (lista v_carrier w guard)
  if new.driver_delivery_name is not distinct from old.driver_delivery_name then
    new.driver_delivery_name := null;
  end if;
  if new.driver_delivery_phone is not distinct from old.driver_delivery_phone then
    new.driver_delivery_phone := null;
  end if;
  if new.driver_delivery_phone_country is not distinct from old.driver_delivery_phone_country then
    new.driver_delivery_phone_country := 'PL';
  end if;
  if new.tractor_delivery_plate is not distinct from old.tractor_delivery_plate then
    new.tractor_delivery_plate := null;
  end if;
  if new.trailer_swap is not distinct from old.trailer_swap then
    new.trailer_swap := false;
  end if;
  if new.trailer_swap_at is not distinct from old.trailer_swap_at then
    new.trailer_swap_at := null;
  end if;
  -- NOT NULL DEFAULT 0 (0001) — nie null
  if new.escort_vehicles is not distinct from old.escort_vehicles then
    new.escort_vehicles := 0;
  end if;
  -- telematyka + RIO (sanitize/freeze nie odpalą się na NEW z tego triggera)
  if new.telematics_vehicle_id is not distinct from old.telematics_vehicle_id then
    new.telematics_vehicle_id := null;
  end if;
  if new.telematics_provider is not distinct from old.telematics_provider then
    new.telematics_provider := null;
  end if;
  if new.rio_tracking_id is not distinct from old.rio_tracking_id then
    new.rio_tracking_id := null;
  end if;
  if new.rio_secret is not distinct from old.rio_secret then
    new.rio_secret := null;
  end if;
  if new.rio_asset_name is not distinct from old.rio_asset_name then
    new.rio_asset_name := null;
  end if;
  if new.rio_tracker_on is not distinct from old.rio_tracker_on then
    new.rio_tracker_on := null;
  end if;
  if new.rio_valid_from is not distinct from old.rio_valid_from then
    new.rio_valid_from := null;
  end if;
  if new.rio_valid_to is not distinct from old.rio_valid_to then
    new.rio_valid_to := null;
  end if;
  if new.rio_check_at is not distinct from old.rio_check_at then
    new.rio_check_at := null;
  end if;
  if new.rio_last_fix_at is not distinct from old.rio_last_fix_at then
    new.rio_last_fix_at := null;
  end if;
  -- NOT NULL DEFAULT 0 (0261)
  if new.rio_error_streak is not distinct from old.rio_error_streak then
    new.rio_error_streak := 0;
  end if;
  if new.rio_check_state is not distinct from old.rio_check_state then
    new.rio_check_state := null;
  end if;
  return new;
end;
$$;

revoke all on function public.trg_loads_clear_on_carrier_change()
  from public, anon, authenticated;

-- F7 #531: po trg_loads_guard (kolejność alfabetyczna), nie przed — OPS + carrier_order_no
drop trigger if exists trg_loads_clear_on_carrier_change on public.loads;
drop trigger if exists trg_loads_zz_clear_on_carrier_change on public.loads;
create trigger trg_loads_zz_clear_on_carrier_change
  before update of carrier_org_id on public.loads
  for each row
  execute function public.trg_loads_clear_on_carrier_change();

comment on function public.trg_loads_clear_on_carrier_change() is
  '#528 N8 F7: clear kierowca/dostawa/tablice/order_no/telematyka/rio_*; escort_vehicles=0; phone_country=PL; zz_* po guard; NULL→org bez clear.';

-- ── 2) Bez zbędnych indeksów (F7 #531: GIN nie pomaga = any(); side_id dubluje PK)
drop index if exists public.documents_visible_to_gin;
drop index if exists public.load_agreed_fees_side_id;

-- ── 3) entry_in_scope: role faktur dla KSH ────────────────────────────────
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
cost 10000
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
               and x.role in ('FAKTURA_PDF', 'CMR', 'POD', 'KOREKTA')
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

-- ── 4) admin_audit_history: ROW_UPDATE (old+new) + szybkie filtry ─────────
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
    -- F7 r4: rodzaj strony (nie kod SCX dla każdego CARRIER)
    case ou.kind::text
      when 'FORWARDER' then 'HHL'
      when 'CLIENT' then 'KSH'
      when 'CARRIER' then 'CARRIER'
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
           and a.entity in ('loads', 'load')
           and a.old_value is not null
           and a.new_value is not null
           and public.audit_history_try_uuid(a.old_value ->> 'carrier_org_id')
               is distinct from
               public.audit_history_try_uuid(a.new_value ->> 'carrier_org_id')
        then public.audit_history_redact_carrier_swap(
               public.audit_history_redact_payload(v_kind, a.entity, a.old_value)
             )
      else public.audit_history_redact_payload(v_kind, a.entity, a.old_value)
    end,
    case
      when v_full then a.new_value
      when v_kind = 'CARRIER'
           and a.entity in ('loads', 'load')
           and a.old_value is not null
           and a.new_value is not null
           and public.audit_history_try_uuid(a.old_value ->> 'carrier_org_id')
               is distinct from
               public.audit_history_try_uuid(a.new_value ->> 'carrier_org_id')
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
        -- #528 F7: UUID regex + rzutowanie (bez try_uuid / plpgsql na każdy wiersz)
        and not (
          a.entity = 'documents'
          and a.entity_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          and exists (
            select 1 from public.documents d
             where d.id = a.entity_id::uuid
               and (
                 (v_kind = 'CLIENT' and ('CLIENT' = any (d.visible_to)) is not true)
                 or (v_kind = 'CARRIER' and ('CARRIER' = any (d.visible_to)) is not true)
               )
          )
        )
        and not (
          a.entity = 'load_agreed_fees'
          and coalesce(a.new_value ->> 'fee_id', a.old_value ->> 'fee_id', a.entity_id)
                ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          and exists (
            select 1 from public.load_agreed_fees f
             where f.id = coalesce(a.new_value ->> 'fee_id', a.old_value ->> 'fee_id', a.entity_id)::uuid
               and (
                 (v_kind = 'CLIENT' and (f.side in ('REVENUE', 'BOTH')) is not true)
                 or (v_kind = 'CARRIER' and (f.side in ('COST', 'BOTH')) is not true)
               )
          )
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
  '#484/#528 F7: Historia — N8 clear; ROW_UPDATE swap; UUID regex + COST 10000 entry_in_scope; N1–N8.';

alter function public.audit_history_entry_in_scope(
  text, uuid, text, text, text, uuid, uuid, uuid, jsonb, jsonb
) cost 10000;
