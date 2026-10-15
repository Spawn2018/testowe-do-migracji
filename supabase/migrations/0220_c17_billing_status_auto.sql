-- C17 (D-20261015-2110-01): automat READY_TO_INVOICE (CMR po dostawie) i INVOICED (obie faktury);
-- UNLOADED → DELIVERED wszędzie; przebieg jednorazowy dla istniejących transportów.

-- ---------------------------------------------------------------------------
-- 1. Warunki i próby automatu (tylko do przodu; dedup w auto_set_status)
-- ---------------------------------------------------------------------------
create or replace function public.c17_cmr_after_delivery(p_load uuid)
returns uuid
language sql
stable
security definer
set search_path to 'public'
as $$
  select d.id
    from documents d
    join loads l on l.id = d.load_id
   where d.load_id = p_load
     and d.category = 'CMR'
     and d.superseded_at is null
     and (d.purged_at is null)
     and l.actual_delivery_at is not null
     and d.uploaded_at >= l.actual_delivery_at
   order by d.uploaded_at desc
   limit 1;
$$;

revoke all on function public.c17_cmr_after_delivery(uuid) from public, anon, authenticated;

create or replace function public.c17_invoice_pair_ok(p_load uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_k uuid;
  v_p uuid;
begin
  select i.id into v_k
    from invoice_lines il
    join invoices i on i.id = il.invoice_id
   where il.load_id = p_load
     and il.direction = 'KOSZT'
     and i.direction = 'KOSZT'
     and i.document_id is not null
     and i.status is distinct from 'DRAFT'
     and i.status is distinct from 'DISPUTED'
   order by i.submitted_at nulls last, i.id
   limit 1;
  select i.id into v_p
    from invoice_lines il
    join invoices i on i.id = il.invoice_id
   where il.load_id = p_load
     and il.direction = 'PRZYCHOD'
     and i.direction = 'PRZYCHOD'
     and i.document_id is not null
     and i.status is distinct from 'DRAFT'
     and i.status is distinct from 'DISPUTED'
   order by i.submitted_at nulls last, i.id
   limit 1;
  if v_k is null or v_p is null then
    return null;
  end if;
  return jsonb_build_object('koszt', v_k, 'przychod', v_p);
end;
$$;

revoke all on function public.c17_invoice_pair_ok(uuid) from public, anon, authenticated;

create or replace function public.c17_try_ready_to_invoice(p_load uuid, p_extra jsonb default '{}'::jsonb)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_status load_status;
  v_doc uuid;
  v_ts timestamptz;
begin
  select status into v_status from loads where id = p_load for update;
  if v_status is distinct from 'DELIVERED' then
    return false;
  end if;
  v_doc := public.c17_cmr_after_delivery(p_load);
  if v_doc is null then
    return false;
  end if;
  select d.uploaded_at into v_ts from documents d where d.id = v_doc;
  return public.auto_set_status(
    p_load,
    'DELIVERED'::load_status,
    'READY_TO_INVOICE'::load_status,
    'CMR z podpisem odbiorcy wgrany',
    coalesce(v_ts, now()),
    coalesce(p_extra, '{}'::jsonb) || jsonb_build_object(
      'actor', 'system',
      'source', 'DOC',
      'document_id', v_doc
    )
  );
end;
$$;

revoke all on function public.c17_try_ready_to_invoice(uuid, jsonb) from public, anon, authenticated;

create or replace function public.c17_try_invoiced(p_load uuid, p_extra jsonb default '{}'::jsonb)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_status load_status;
  v_pair jsonb;
begin
  select status into v_status from loads where id = p_load for update;
  if v_status is distinct from 'READY_TO_INVOICE' then
    return false;
  end if;
  v_pair := public.c17_invoice_pair_ok(p_load);
  if v_pair is null then
    return false;
  end if;
  return public.auto_set_status(
    p_load,
    'READY_TO_INVOICE'::load_status,
    'INVOICED'::load_status,
    'transport na obu fakturach',
    now(),
    coalesce(p_extra, '{}'::jsonb) || jsonb_build_object(
      'actor', 'system',
      'source', 'INVOICE',
      'invoice_ids', jsonb_build_array(v_pair->>'koszt', v_pair->>'przychod')
    )
  );
end;
$$;

revoke all on function public.c17_try_invoiced(uuid, jsonb) from public, anon, authenticated;

create or replace function public.c17_try_billing_status(p_load uuid, p_extra jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  perform public.c17_try_ready_to_invoice(p_load, p_extra);
  perform public.c17_try_invoiced(p_load, p_extra);
end;
$$;

revoke all on function public.c17_try_billing_status(uuid, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Wyzwalacze: CMR / faktury
-- ---------------------------------------------------------------------------
create or replace function public.c17_trg_documents_billing()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.category is distinct from 'CMR' then
    return new;
  end if;
  if new.load_id is null then
    return new;
  end if;
  if new.superseded_at is not null or new.purged_at is not null then
    return new;
  end if;
  perform public.c17_try_billing_status(new.load_id, '{}'::jsonb);
  return new;
end;
$$;

drop trigger if exists trg_c17_documents_billing on public.documents;
create trigger trg_c17_documents_billing
  after insert or update of category, superseded_at, purged_at, uploaded_at, load_id
  on public.documents
  for each row
  execute function public.c17_trg_documents_billing();

create or replace function public.c17_trg_invoice_billing()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_load uuid;
begin
  if tg_table_name = 'invoice_lines' then
    v_load := coalesce(new.load_id, old.load_id);
    if v_load is not null then
      perform public.c17_try_billing_status(v_load, '{}'::jsonb);
    end if;
    return coalesce(new, old);
  end if;
  -- invoices: status / document_id — wszystkie pozycje
  for v_load in
    select distinct il.load_id
      from invoice_lines il
     where il.invoice_id = coalesce(new.id, old.id)
  loop
    perform public.c17_try_billing_status(v_load, '{}'::jsonb);
  end loop;
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_c17_invoice_lines_billing on public.invoice_lines;
create trigger trg_c17_invoice_lines_billing
  after insert or update of load_id, direction, invoice_id
  on public.invoice_lines
  for each row
  execute function public.c17_trg_invoice_billing();

drop trigger if exists trg_c17_invoices_billing on public.invoices;
create trigger trg_c17_invoices_billing
  after insert or update of status, document_id, direction
  on public.invoices
  for each row
  execute function public.c17_trg_invoice_billing();

-- ---------------------------------------------------------------------------
-- 3. UNLOADED → DELIVERED (kierowca + zapis)
-- ---------------------------------------------------------------------------
create or replace function public.driver_post_event(
  p_token      text,
  p_load_id    uuid,
  p_event_type text,
  p_ts         timestamptz default now(),
  p_note       text default null
) returns text
language plpgsql security definer set search_path = public as $$
declare v_load uuid; v_status load_status;
begin
  v_load := driver_token_load(p_token);
  if v_load is distinct from p_load_id then
    raise exception 'Token kierowcy nie dotyczy tego transportu';
  end if;
  if p_event_type not in ('MILESTONE_LOADED', 'DRIVER_ON_FERRY', 'DRIVER_PROBLEM', 'MILESTONE_UNLOADED') then
    raise exception 'Niedozwolone zdarzenie kierowcy: %', p_event_type;
  end if;
  if p_ts is null or p_ts > now() + interval '5 minutes' then
    raise exception 'Czas zdarzenia z przyszłości';
  end if;
  insert into load_events (load_id, event_type, occurred_at, source, payload)
  values (v_load, p_event_type, p_ts, 'DRIVER_PWA',
          jsonb_build_object('via', 'driver_token') || case when p_note is null then '{}'::jsonb
                                                        else jsonb_build_object('note', left(p_note, 500)) end);
  if p_event_type = 'MILESTONE_UNLOADED' then
    select status into v_status from loads where id = v_load;
    if (
      public.load_status_rank(v_status) < public.load_status_rank('DELIVERED'::load_status)
      or v_status = 'UNLOADED'
    ) is true then
      perform set_config('tower.status_ctx', 'on', true);
      update loads
         set status = 'DELIVERED',
             actual_delivery_at = coalesce(actual_delivery_at, p_ts),
             updated_at = now()
       where id = v_load;
      insert into load_events (load_id, event_type, occurred_at, payload, dedup_key)
      values (
        v_load,
        'STATUS_AUTO',
        p_ts,
        jsonb_build_object(
          'from', v_status,
          'to', 'DELIVERED',
          'powod', 'rozładunek kierowcy',
          'actor', 'system',
          'source', 'DRIVER'
        ),
        'STATUS_AUTO:' || v_load || ':DELIVERED'
      )
      on conflict (dedup_key) where dedup_key is not null do nothing;
      perform public.c17_try_billing_status(v_load, '{}'::jsonb);
    end if;
  end if;
  return p_event_type;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Przebieg jednorazowy (istniejące transporty; 0 wierszy na TEST bez tych zleceń)
-- ---------------------------------------------------------------------------
do $c17$
declare
  r record;
  v_extra jsonb := jsonb_build_object('przebieg', 'jednorazowy C17');
  n_unloaded int := 0;
  n_ready int := 0;
  n_invoiced int := 0;
begin
  for r in
    select id, status, order_no
      from loads
     where status = 'UNLOADED'
  loop
    if public.auto_set_status(
      r.id,
      'UNLOADED'::load_status,
      'DELIVERED'::load_status,
      'scalenie UNLOADED → DELIVERED (C17)',
      coalesce((select actual_delivery_at from loads where id = r.id), now()),
      v_extra || jsonb_build_object('actor', 'system', 'source', 'C17_BACKFILL')
    ) then
      n_unloaded := n_unloaded + 1;
    end if;
  end loop;

  for r in
    select id from loads
     where status in ('DELIVERED', 'READY_TO_INVOICE')
  loop
    if public.c17_try_ready_to_invoice(r.id, v_extra) then
      n_ready := n_ready + 1;
    end if;
    if public.c17_try_invoiced(r.id, v_extra) then
      n_invoiced := n_invoiced + 1;
    end if;
  end loop;

  insert into audit_log (user_id, action, entity, entity_id, new_value)
  values (
    null,
    'C17_BILLING_STATUS_BACKFILL',
    'loads',
    'batch',
    jsonb_build_object(
      'unloaded_to_delivered', n_unloaded,
      'to_ready_to_invoice', n_ready,
      'to_invoiced', n_invoiced
    )
  );
end;
$c17$;
