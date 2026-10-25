-- #519 / D-20261024-0900-01 — faktoring drobne F7 r3 (N2–N4) po #514 / 0287.
-- N2: bez invoice_lines → bez matrix_notify (nie do wszystkich przewoźników).
-- N3: dedup z factoring_accepted_at / paid_at / due_at (ponowna akceptacja / wypłata).
-- N4: raise warning zamiast połykania; url → Finanse › Faktury.
-- Numer 0296: 0292–0295 zarezerwowane (#528/#530/B5/#516 równolegle).

select set_config('tower.audit_source', 'migracja 0296 (#519 faktoring N2–N4)', true);

-- ---------------------------------------------------------------------------
-- Push/e-mail: FACTORING_* i faktury → /#/finanse/faktury/<id> (nie transport).
-- ---------------------------------------------------------------------------
create or replace function public.notify_click_url(
  p_template text,
  p_payload jsonb,
  p_load_id uuid
) returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_dec text;
  v_inv text;
  v_code text;
  v_tab text;
begin
  if p_template = 'DECISION_ESCALATED_BATCH' then
    return '/#/ryzyka';
  end if;

  v_inv := coalesce(
    nullif(p_payload->>'invoice_id', ''),
    nullif(p_payload->>'invoiceId', '')
  );
  if v_inv is not null
     and (
       p_template like 'FACTORING%'
       or p_template like 'INVOICE%'
       or p_template in ('PAYMENT_REMINDER')
     ) then
    return '/#/finanse/faktury/' || v_inv;
  end if;

  v_dec := coalesce(
    nullif(p_payload->>'decision_id', ''),
    nullif(p_payload->>'decisionId', '')
  );
  if v_dec is not null
     and (
       p_template like 'DECISION%'
       or p_template in ('FERRY_CANCELLED', 'ETA_AFTER_LATEST', 'NO_POSITION',
                         'SCHEDULE_DATE_CRITICAL', 'SILENT_VEHICLE', 'RISK_OPEN',
                         'RISK_SEVERITY', 'INSURANCE_EXPIRY', 'INSURANCE')
     ) then
    return '/#/decyzje/' || v_dec;
  end if;
  v_code := coalesce(
    nullif(p_payload->>'code', ''),
    nullif(p_payload->>'load_code', ''),
    nullif(p_payload->>'order_no', ''),
    nullif(p_payload->>'hhl_order_no', '')
  );
  if v_code is null and p_load_id is not null then
    select coalesce(nullif(l.order_no, ''), nullif(l.hhl_order_no, ''))
      into v_code
      from loads l where l.id = p_load_id;
  end if;
  if v_code is not null then
    v_tab := coalesce(nullif(p_payload->>'tab', ''), 'status');
    return '/#/transport/' || replace(v_code, '/', '%2F')
           || '?zakladka=' || replace(v_tab, ' ', '%20');
  end if;
  if v_dec is not null then
    return '/#/decyzje/' || v_dec;
  end if;
  return '/';
end $$;

revoke all on function public.notify_click_url(text, jsonb, uuid)
  from public, anon, authenticated;
comment on function public.notify_click_url(text, jsonb, uuid) is
  '#411+#519: url push = dzwonek (#/decyzje, #/transport, #/finanse/faktury).';

-- ---------------------------------------------------------------------------
-- N2/N3/N4: dzwonek po akceptacji
-- ---------------------------------------------------------------------------
create or replace function public.factoring_notify_on_accept()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lid uuid;
  v_dedup text;
  v_payload jsonb;
begin
  if new.factoring_selected is not true then
    return new;
  end if;
  if new.verification_status is distinct from 'ZAAKCEPTOWANA' then
    return new;
  end if;
  if old.verification_status is not distinct from 'ZAAKCEPTOWANA' then
    return new;
  end if;

  select load_id into v_lid
    from public.invoice_lines
   where invoice_id = new.id
   order by load_id
   limit 1;
  -- N2: bez linii → nie wołaj matrix_notify (null load_id = wszyscy przewoźnicy).
  if v_lid is null then
    return new;
  end if;

  -- ms: ponowna akceptacja w tej samej sekundzie musi dać nowy klucz.
  v_dedup := 'factoring-acc:' || new.id::text || ':'
    || coalesce(
         (floor(extract(epoch from new.factoring_accepted_at) * 1000))::bigint::text,
         '0'
       );
  v_payload := jsonb_build_object(
    'invoice_id', new.id,
    'number', new.invoice_number,
    'payout', new.factoring_net_payout,
    'dueAt', new.factoring_due_at,
    'matrix_event', 'factoring',
    'url', '/#/finanse/faktury/' || new.id::text
  );
  begin
    perform public.matrix_notify(
      'MONEY',
      'FACTORING_ACCEPTED',
      v_lid,
      new.project_id,
      v_payload,
      v_dedup,
      null
    );
  exception when others then
    -- N4: nie połykaj — ostrzeżenie w logu (jak wf_enqueue_*).
    raise warning '#519 factoring_notify_on_accept: %', sqlerrm;
  end;
  return new;
end $$;

drop trigger if exists trg_factoring_notify_on_accept on public.invoices;
create trigger trg_factoring_notify_on_accept
  after update of verification_status on public.invoices
  for each row execute function public.factoring_notify_on_accept();

revoke all on function public.factoring_notify_on_accept()
  from public, anon, authenticated;
comment on function public.factoring_notify_on_accept() is
  '#519: FACTORING_ACCEPTED — skip bez linii; dedup+accepted_at; warning; url faktury.';

-- ---------------------------------------------------------------------------
-- N2/N3/N4: wypłata
-- ---------------------------------------------------------------------------
create or replace function public.factoring_mark_paid(p_invoice uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.invoices%rowtype;
  v_me uuid;
  v_paid date := public.factoring_today();
  v_paid_at timestamptz := now();
  v_lid uuid;
  v_dedup text;
  v_payload jsonb;
begin
  if (public.is_hhl()) is not true then
    raise exception 'Wypłatę faktoringu oznacza wyłącznie HHL' using errcode = '42501';
  end if;

  select id into v_me from public.app_users where auth_id = auth.uid() and active;
  if (v_me is not null) is not true then
    raise exception 'Brak konta' using errcode = 'P0002';
  end if;

  select * into inv from public.invoices where id = p_invoice for update;
  if not found then
    raise exception 'Nieznana faktura' using errcode = 'P0002';
  end if;
  if (inv.factoring_selected is true) is not true then
    raise exception 'Faktura bez faktoringu' using errcode = '22023';
  end if;
  if inv.verification_status is distinct from 'ZAAKCEPTOWANA' then
    raise exception 'Najpierw akceptacja faktury' using errcode = '22023';
  end if;
  if inv.factoring_paid_at is not null or inv.payment_status = 'OPLACONA' then
    raise exception 'Faktura już opłacona' using errcode = 'P0001';
  end if;

  update public.invoices set
    factoring_paid_at = v_paid_at,
    payment_status = 'OPLACONA',
    paid_at = v_paid,
    paid_marked_by = v_me,
    paid_marked_at = now()
  where id = p_invoice;

  insert into public.audit_log (user_id, action, entity, entity_id, old_value, new_value)
  values (
    v_me, 'FACTORING_MARK_PAID', 'invoices', p_invoice::text,
    jsonb_build_object('paidAt', null, 'paymentStatus', inv.payment_status),
    jsonb_build_object(
      'paidAt', v_paid_at, 'payout', inv.factoring_net_payout,
      'paymentStatus', 'OPLACONA', 'paid_at', v_paid
    )
  );

  select load_id into v_lid
    from public.invoice_lines
   where invoice_id = p_invoice
   order by load_id
   limit 1;
  if v_lid is null then
    return;
  end if;

  v_dedup := 'factoring-paid:' || p_invoice::text || ':'
    || (floor(extract(epoch from v_paid_at) * 1000))::bigint::text;
  v_payload := jsonb_build_object(
    'invoice_id', p_invoice,
    'number', inv.invoice_number,
    'payout', inv.factoring_net_payout,
    'matrix_event', 'factoring',
    'url', '/#/finanse/faktury/' || p_invoice::text
  );
  begin
    perform public.matrix_notify(
      'MONEY',
      'FACTORING_PAID',
      v_lid,
      inv.project_id,
      v_payload,
      v_dedup,
      null
    );
  exception when others then
    raise warning '#519 factoring_mark_paid: %', sqlerrm;
  end;
end $$;

revoke all on function public.factoring_mark_paid(uuid) from public, anon;
grant execute on function public.factoring_mark_paid(uuid) to authenticated;
comment on function public.factoring_mark_paid(uuid) is
  '#519: wypłata — skip bez linii; dedup+paid_at; warning; url faktury.';

-- ---------------------------------------------------------------------------
-- N2/N3/N4: po terminie
-- ---------------------------------------------------------------------------
create or replace function public.factoring_overdue_notify()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_lid uuid;
  n int := 0;
  k int;
  v_dedup text;
  v_payload jsonb;
begin
  for r in
    select i.id, i.project_id, i.invoice_number, i.factoring_net_payout, i.factoring_due_at
      from public.invoices i
     where i.factoring_selected is true
       and i.verification_status = 'ZAAKCEPTOWANA'
       and i.factoring_due_at is not null
       and i.factoring_due_at < now()
       and i.factoring_paid_at is null
       and i.payment_status is distinct from 'OPLACONA'
  loop
    select load_id into v_lid
      from public.invoice_lines
     where invoice_id = r.id
     order by load_id
     limit 1;
    if v_lid is null then
      continue;
    end if;
    v_dedup := 'factoring-overdue:' || r.id::text || ':'
      || (floor(extract(epoch from r.factoring_due_at) * 1000))::bigint::text;
    v_payload := jsonb_build_object(
      'invoice_id', r.id,
      'number', r.invoice_number,
      'payout', r.factoring_net_payout,
      'dueAt', r.factoring_due_at,
      'matrix_event', 'factoring',
      'url', '/#/finanse/faktury/' || r.id::text
    );
    begin
      k := public.matrix_notify(
        'MONEY',
        'FACTORING_OVERDUE',
        v_lid,
        r.project_id,
        v_payload,
        v_dedup,
        null
      );
      n := n + coalesce(k, 0);
    exception when others then
      raise warning '#519 factoring_overdue_notify %: %', r.id, sqlerrm;
    end;
  end loop;
  return n;
end $$;

revoke all on function public.factoring_overdue_notify()
  from public, anon, authenticated;
do $g$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.factoring_overdue_notify() to service_role;
  end if;
end $g$;
comment on function public.factoring_overdue_notify() is
  '#519: OVERDUE — skip bez linii; dedup+due_at; warning; url faktury.';
