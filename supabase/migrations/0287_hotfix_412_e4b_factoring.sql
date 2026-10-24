-- #412 / D-20261021-2040-01 pkt 3 — E4b: oferta faktoringu HHL + wybór na fakturze + zadania wypłaty 48 h.
-- Odczyt oferty: HHL (także wyłączona) i SCX (tylko włączona). Zapis oferty: tylko HHL_ADMIN (+ audit).
-- Wybór na fakturze KOSZT: SCX (snapshot). Start 48 h: przy akceptacji HHL. Wypłata: HHL → OPLACONA.
-- Front podłącza koordynator. Numer 0287 — po 0286 paczka (#512). F7 #514.

select set_config('tower.audit_source', 'migracja 0287 (#412 E4b faktoring)', true);

-- ---------------------------------------------------------------------------
-- Oferta HHL (wersje od daty PL; bieżąca = max valid_from ≤ dziś Warsaw).
-- ---------------------------------------------------------------------------
create table if not exists public.factoring_offers (
  id          uuid primary key default gen_random_uuid(),
  version     int not null check (version >= 1),
  enabled     boolean not null default true,
  fee_pct     numeric(5,2) not null check (fee_pct > 0 and fee_pct <= 20),
  hours       int not null check (hours >= 1 and hours <= 720),
  valid_from  date not null,
  created_at  timestamptz not null default now(),
  created_by  uuid references public.app_users(id),
  unique (version),
  unique (valid_from)
);

create index if not exists factoring_offers_valid_from_idx
  on public.factoring_offers (valid_from desc);

alter table public.factoring_offers enable row level security;

revoke all on table public.factoring_offers from public, anon;
revoke insert, update, delete, truncate, references, trigger
  on table public.factoring_offers from authenticated;
grant select on table public.factoring_offers to authenticated;

drop policy if exists factoring_offers_read on public.factoring_offers;
create policy factoring_offers_read on public.factoring_offers
  for select to authenticated
  using ((public.is_hhl() is true) or (public.current_org_kind()::text = 'CARRIER'));

comment on table public.factoring_offers is
  '#412 E4b: oferta faktoringu HHL (1 % / 48 h); zapis tylko przez factoring_offer_set.';

insert into public.factoring_offers (version, enabled, fee_pct, hours, valid_from)
values (1, true, 1.00, 48, date '2026-10-07')
on conflict (version) do nothing;

-- ---------------------------------------------------------------------------
-- Kolumny faktury — snapshot wyboru + wypłata.
-- ---------------------------------------------------------------------------
alter table public.invoices
  add column if not exists factoring_selected boolean not null default false,
  add column if not exists factoring_fee_pct numeric(5,2),
  add column if not exists factoring_fee_amount numeric(14,2),
  add column if not exists factoring_net_payout numeric(14,2),
  add column if not exists factoring_hours int,
  add column if not exists factoring_offer_version int,
  add column if not exists factoring_accepted_at timestamptz,
  add column if not exists factoring_due_at timestamptz,
  add column if not exists factoring_paid_at timestamptz;

comment on column public.invoices.factoring_selected is
  'E4b: SCX wybrał faktoring przy tej fakturze KOSZT.';
comment on column public.invoices.factoring_fee_pct is
  'E4b: % prowizji ze snapshotu oferty (od netto).';
comment on column public.invoices.factoring_net_payout is
  'E4b: brutto − prowizja (kwota wypłaty HHL → SCX).';
comment on column public.invoices.factoring_due_at is
  'E4b: akceptacja HHL + hours z oferty.';

create or replace function public.factoring_today()
returns date
language sql
stable
set search_path = public
as $$
  select (now() at time zone 'Europe/Warsaw')::date;
$$;

revoke all on function public.factoring_today() from public, anon, authenticated;
comment on function public.factoring_today() is
  '#412 E4b: dzień oferty / wyboru w Europe/Warsaw (jak przypomnienia).';

-- ---------------------------------------------------------------------------
-- Odczyt oferty → FactoringOfferView | null (SCX) / z enabled (HHL także false).
-- ---------------------------------------------------------------------------
create or replace function public.factoring_offer_get()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  r record;
  v_hhl boolean := (public.is_hhl() is true);
  v_carrier boolean := (public.current_org_kind()::text = 'CARRIER');
  v_today date := public.factoring_today();
begin
  if v_hhl is not true and v_carrier is not true then
    raise exception 'Oferta faktoringu — tylko HHL albo SCX' using errcode = '42501';
  end if;

  select o.fee_pct, o.hours, o.version, o.valid_from, o.enabled
    into r
    from public.factoring_offers o
   where o.valid_from <= v_today
   order by o.valid_from desc
   limit 1;

  if not found then
    return null;
  end if;

  -- SCX: tylko włączona (wybór przy fakturze). HHL: także wyłączona (ekran oferty).
  if (r.enabled is not true) and v_hhl is not true then
    return null;
  end if;

  return jsonb_build_object(
    'feePct', r.fee_pct,
    'hours', r.hours,
    'version', r.version,
    'from', to_char(r.valid_from, 'YYYY-MM-DD'),
    'enabled', r.enabled
  );
end $$;

revoke all on function public.factoring_offer_get() from public, anon;
grant execute on function public.factoring_offer_get() to authenticated;
comment on function public.factoring_offer_get() is
  '#412 E4b: bieżąca oferta; HHL widzi enabled=false; SCX null gdy wyłączona.';

-- ---------------------------------------------------------------------------
-- Zapis oferty — HHL_ADMIN; ten sam dzień = poprawka bez nowej wersji.
-- ---------------------------------------------------------------------------
create or replace function public.factoring_offer_set(
  p_enabled boolean,
  p_fee_pct numeric,
  p_hours int
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid;
  v_ver int;
  v_old jsonb;
  v_new jsonb;
  v_today date := public.factoring_today();
  v_exist int;
begin
  if (public.is_hhl_admin()) is not true then
    raise exception 'Ofertę faktoringu zmienia wyłącznie Administrator HHL'
      using errcode = '42501';
  end if;
  if (p_enabled is not null) is not true then
    raise exception 'Włącz/wyłącz — wymagane' using errcode = '22023';
  end if;
  if (p_fee_pct is not null and p_fee_pct > 0 and p_fee_pct <= 20) is not true then
    raise exception 'Prowizja: 0,01–20 %%' using errcode = '22023';
  end if;
  if (p_hours is not null and p_hours between 1 and 720) is not true then
    raise exception 'Wypłata: 1–720 godzin' using errcode = '22023';
  end if;

  select id into v_me from public.app_users where auth_id = auth.uid() and active;
  if (v_me is not null) is not true then
    raise exception 'Brak konta' using errcode = 'P0002';
  end if;

  v_old := public.factoring_offer_get();

  select version into v_exist
    from public.factoring_offers
   where valid_from = v_today
   limit 1;

  if v_exist is not null then
    -- F7: poprawka tego samego dnia — bez przenumerowania (faktury trzymają version).
    update public.factoring_offers set
      enabled = p_enabled,
      fee_pct = round(p_fee_pct, 2),
      hours = p_hours,
      created_by = v_me,
      created_at = now()
    where valid_from = v_today;
    v_ver := v_exist;
  else
    select coalesce(max(version), 0) + 1 into v_ver from public.factoring_offers;
    insert into public.factoring_offers (
      version, enabled, fee_pct, hours, valid_from, created_by
    ) values (
      v_ver, p_enabled, round(p_fee_pct, 2), p_hours, v_today, v_me
    );
  end if;

  v_new := public.factoring_offer_get();

  insert into public.audit_log (user_id, action, entity, entity_id, old_value, new_value)
  values (
    v_me,
    'FACTORING_OFFER_SET',
    'factoring_offers',
    v_ver::text,
    coalesce(v_old, '{}'::jsonb),
    coalesce(v_new, jsonb_build_object('enabled', false))
  );

  return v_new;
end $$;

revoke all on function public.factoring_offer_set(boolean, numeric, int) from public, anon;
grant execute on function public.factoring_offer_set(boolean, numeric, int) to authenticated;
comment on function public.factoring_offer_set(boolean, numeric, int) is
  '#412 E4b: oferta; ten sam dzień bez nowej wersji; audit FACTORING_OFFER_SET.';

-- ---------------------------------------------------------------------------
-- SCX: wybór faktoringu na fakturze KOSZT (snapshot oferty).
-- ---------------------------------------------------------------------------
create or replace function public.invoice_factoring_set(
  p_invoice uuid,
  p_selected boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.invoices%rowtype;
  v_me uuid;
  v_org uuid := public.current_org_id();
  offer jsonb;
  v_fee numeric;
  v_payout numeric;
  v_pct numeric;
  v_hours int;
  v_ver int;
begin
  if (p_invoice is not null and p_selected is not null) is not true then
    raise exception 'Brak faktury lub wyboru' using errcode = '22023';
  end if;

  select id into v_me from public.app_users where auth_id = auth.uid() and active;
  if (v_me is not null) is not true then
    raise exception 'Brak konta' using errcode = 'P0002';
  end if;

  select * into inv from public.invoices where id = p_invoice for update;
  if not found then
    raise exception 'Nieznana faktura' using errcode = 'P0002';
  end if;

  if (inv.direction = 'KOSZT') is not true then
    raise exception 'Faktoring tylko na fakturze kosztowej SCX' using errcode = '22023';
  end if;
  if (v_org is not null and v_org = inv.issuer_org_id
      and public.current_org_kind()::text = 'CARRIER') is not true then
    raise exception 'Faktoring wybiera przewoźnik (wystawca)' using errcode = '42501';
  end if;
  if inv.verification_status = 'ZAAKCEPTOWANA' then
    raise exception 'Po akceptacji HHL nie zmienia się wyboru faktoringu'
      using errcode = '22023';
  end if;
  if inv.verification_status = 'SPORNA' then
    raise exception 'Faktura w sporze — faktoring niedostępny' using errcode = '22023';
  end if;
  if inv.factoring_paid_at is not null
     or inv.payment_status = 'OPLACONA' then
    raise exception 'Faktura już opłacona — bez zmiany faktoringu'
      using errcode = 'P0001';
  end if;

  if p_selected is not true then
    update public.invoices set
      factoring_selected = false,
      factoring_fee_pct = null,
      factoring_fee_amount = null,
      factoring_net_payout = null,
      factoring_hours = null,
      factoring_offer_version = null,
      factoring_accepted_at = null,
      factoring_due_at = null
    where id = p_invoice;

    insert into public.audit_log (user_id, action, entity, entity_id, old_value, new_value)
    values (
      v_me, 'INVOICE_FACTORING_SET', 'invoices', p_invoice::text,
      jsonb_build_object('selected', inv.factoring_selected),
      jsonb_build_object('selected', false)
    );
    return;
  end if;

  offer := public.factoring_offer_get();
  if offer is null or (offer->>'enabled')::boolean is not true then
    raise exception 'Faktoring wyłączony — brak oferty HHL' using errcode = 'P0001';
  end if;

  v_pct := (offer->>'feePct')::numeric;
  v_hours := (offer->>'hours')::int;
  v_ver := (offer->>'version')::int;
  v_fee := round(coalesce(inv.net_total, 0) * v_pct / 100.0, 2);
  v_payout := round(coalesce(inv.gross_total, inv.net_total, 0) - v_fee, 2);

  update public.invoices set
    factoring_selected = true,
    factoring_fee_pct = v_pct,
    factoring_fee_amount = v_fee,
    factoring_net_payout = v_payout,
    factoring_hours = v_hours,
    factoring_offer_version = v_ver,
    factoring_accepted_at = null,
    factoring_due_at = null
  where id = p_invoice;

  insert into public.audit_log (user_id, action, entity, entity_id, old_value, new_value)
  values (
    v_me, 'INVOICE_FACTORING_SET', 'invoices', p_invoice::text,
    jsonb_build_object('selected', inv.factoring_selected),
    jsonb_build_object(
      'selected', true, 'feePct', v_pct, 'fee', v_fee, 'payout', v_payout,
      'hours', v_hours, 'version', v_ver
    )
  );
end $$;

revoke all on function public.invoice_factoring_set(uuid, boolean) from public, anon;
grant execute on function public.invoice_factoring_set(uuid, boolean) to authenticated;
comment on function public.invoice_factoring_set(uuid, boolean) is
  '#412 E4b: SCX wybiera faktoring (snapshot); bez SPORNA/OPLACONA; audit.';

-- ---------------------------------------------------------------------------
-- Przy akceptacji HHL: start okna wypłaty (zawsze now() przy przejściu).
-- ---------------------------------------------------------------------------
create or replace function public.factoring_on_accept()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.factoring_selected is not true then
    return new;
  end if;
  if new.verification_status is not distinct from old.verification_status then
    return new;
  end if;
  if new.verification_status = 'ZAAKCEPTOWANA'
     and (old.verification_status is distinct from 'ZAAKCEPTOWANA') then
    -- F7: ponowna akceptacja zawsze od now() (nie coalesce starego terminu).
    new.factoring_accepted_at := now();
    new.factoring_due_at := new.factoring_accepted_at
      + make_interval(hours => coalesce(new.factoring_hours, 48));
  end if;
  return new;
end $$;

drop trigger if exists trg_factoring_on_accept on public.invoices;
create trigger trg_factoring_on_accept
  before update of verification_status on public.invoices
  for each row execute function public.factoring_on_accept();

revoke all on function public.factoring_on_accept() from public, anon, authenticated;

-- Dzwonek po akceptacji (AFTER — matrix_notify nie w BEFORE).
create or replace function public.factoring_notify_on_accept()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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
  begin
    perform public.matrix_notify(
      'FACTORING',
      'FACTORING_ACCEPTED',
      null,
      new.project_id,
      jsonb_build_object(
        'invoiceId', new.id,
        'number', new.invoice_number,
        'payout', new.factoring_net_payout,
        'dueAt', new.factoring_due_at,
        'matrix_event', 'factoring'
      ),
      'factoring-acc:' || new.id::text,
      null
    );
  exception when others then
    null;
  end;
  return new;
end $$;

drop trigger if exists trg_factoring_notify_on_accept on public.invoices;
create trigger trg_factoring_notify_on_accept
  after update of verification_status on public.invoices
  for each row execute function public.factoring_notify_on_accept();

revoke all on function public.factoring_notify_on_accept() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Przeliczenie snapshotu przy zmianie kwot / waluty (zachowany %).
-- ---------------------------------------------------------------------------
create or replace function public.factoring_recalc_on_amount()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.factoring_selected is not true then
    return new;
  end if;
  if new.factoring_paid_at is not null or new.payment_status = 'OPLACONA' then
    return new;
  end if;
  if new.factoring_fee_pct is null then
    return new;
  end if;
  if new.net_total is not distinct from old.net_total
     and new.gross_total is not distinct from old.gross_total
     and new.currency is not distinct from old.currency then
    return new;
  end if;

  new.factoring_fee_amount :=
    round(coalesce(new.net_total, 0) * new.factoring_fee_pct / 100.0, 2);
  new.factoring_net_payout :=
    round(coalesce(new.gross_total, new.net_total, 0) - new.factoring_fee_amount, 2);
  return new;
end $$;

drop trigger if exists trg_factoring_recalc_on_amount on public.invoices;
create trigger trg_factoring_recalc_on_amount
  before update of net_total, gross_total, currency on public.invoices
  for each row execute function public.factoring_recalc_on_amount();

revoke all on function public.factoring_recalc_on_amount() from public, anon, authenticated;
comment on function public.factoring_recalc_on_amount() is
  '#412 E4b F7: przeliczenie prowizji/wypłaty przy edycji kwot (zachowany %).';

-- ---------------------------------------------------------------------------
-- Lista zadań wypłaty dla HHL (FactoringTask[]) — bez OPLACONA.
-- ---------------------------------------------------------------------------
create or replace function public.factoring_tasks()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_out jsonb := '[]'::jsonb;
  r record;
  v_issuer text;
begin
  if (public.is_hhl()) is not true then
    raise exception 'Zadania faktoringu — tylko HHL' using errcode = '42501';
  end if;

  for r in
    select i.id, i.invoice_number, i.currency, i.net_total, i.gross_total,
           i.factoring_fee_amount, i.factoring_net_payout, i.factoring_fee_pct,
           i.factoring_hours, i.issue_date, i.factoring_accepted_at,
           i.factoring_due_at, i.factoring_paid_at, i.issuer_org_id
      from public.invoices i
     where i.direction = 'KOSZT'
       and i.factoring_selected is true
       and i.verification_status = 'ZAAKCEPTOWANA'
       and i.factoring_paid_at is null
       and i.payment_status is distinct from 'OPLACONA'
     order by i.factoring_due_at nulls last, i.invoice_number
  loop
    select coalesce(nullif(btrim(o.name), ''), o.code, '—')
      into v_issuer
      from public.organizations o where o.id = r.issuer_org_id;

    v_out := v_out || jsonb_build_array(jsonb_build_object(
      'billId', r.id,
      'number', r.invoice_number,
      'issuer', v_issuer,
      'currency', r.currency,
      'net', r.net_total,
      'gross', r.gross_total,
      'fee', r.factoring_fee_amount,
      'payout', r.factoring_net_payout,
      'feePct', r.factoring_fee_pct,
      'hours', r.factoring_hours,
      'issuedAt', to_char(r.issue_date, 'YYYY-MM-DD'),
      'acceptedAt', to_jsonb(r.factoring_accepted_at),
      'dueAt', to_jsonb(r.factoring_due_at),
      'paidAt', null
    ));
  end loop;

  return v_out;
end $$;

revoke all on function public.factoring_tasks() from public, anon;
grant execute on function public.factoring_tasks() to authenticated;
comment on function public.factoring_tasks() is
  '#412 E4b: otwarte wypłaty faktoringu; bez OPLACONA; tylko HHL.';

-- ---------------------------------------------------------------------------
-- Oznacz wypłatę faktoringu = także payment_status OPLACONA (F7 #514).
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
    factoring_paid_at = now(),
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
      'paidAt', now(), 'payout', inv.factoring_net_payout,
      'paymentStatus', 'OPLACONA', 'paid_at', v_paid
    )
  );

  begin
    perform public.matrix_notify(
      'FACTORING',
      'FACTORING_PAID',
      null,
      inv.project_id,
      jsonb_build_object(
        'invoiceId', p_invoice,
        'number', inv.invoice_number,
        'payout', inv.factoring_net_payout,
        'matrix_event', 'factoring'
      ),
      'factoring-paid:' || p_invoice::text,
      null
    );
  exception when others then
    null;
  end;
end $$;

revoke all on function public.factoring_mark_paid(uuid) from public, anon;
grant execute on function public.factoring_mark_paid(uuid) to authenticated;
comment on function public.factoring_mark_paid(uuid) is
  '#412 E4b: HHL wypłata = factoring_paid_at + OPLACONA; audit + dzwonek.';
