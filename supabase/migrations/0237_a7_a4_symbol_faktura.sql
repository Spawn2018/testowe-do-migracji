-- A7 (D-20261016-0200-01 Z1/Z2, D-20261020-0010-01): tabela symboli, wymiary/piloci/Firma|Trasa,
-- zezwolenie firmowe 13/GD/2026 + polisa HHL PZU (metadane; PDF skryptem z D:\Watch Tower\dane\).
-- A4 (ten commit): register_invoice / update_invoice / guard / INVOICE_OVERDUE / CMR C17.

-- ---------------------------------------------------------------------
-- 1. symbol_specs
-- ---------------------------------------------------------------------
create table if not exists public.symbol_specs (
  symbol           text primary key,
  family           text not null,
  position_name    text not null,
  cargo_length_m   numeric(6,2),
  cargo_width_m    numeric(6,2),
  cargo_height_m   numeric(6,2),
  cargo_weight_t   numeric(8,2),
  combo_length_m   numeric(6,2) not null,
  combo_width_m    numeric(6,2) not null,
  combo_height_m   numeric(6,2) not null,
  pilot            text not null check (pilot in ('BRAK', 'PL_SE')),
  permit_kind      text not null check (permit_kind in ('FIRMA', 'TRASA')),
  notes            text,
  created_at       timestamptz not null default now()
);

comment on table public.symbol_specs is
  'A7: wymiary zestawu, pilot i rodzaj zezwolenia według symbolu (tabela właściciela 07.10).';

alter table public.symbol_specs enable row level security;

drop policy if exists symbol_specs_select on public.symbol_specs;
create policy symbol_specs_select on public.symbol_specs
  for select to authenticated
  using (current_app_user_id() is not null);

revoke all on table public.symbol_specs from public, anon;
grant select on table public.symbol_specs to authenticated;

insert into public.symbol_specs (
  symbol, family, position_name,
  cargo_length_m, cargo_width_m, cargo_height_m, cargo_weight_t,
  combo_length_m, combo_width_m, combo_height_m, pilot, permit_kind, notes
) values
  ('BS-A', 'BS', 'Belki Suwnicowe', 12.50, 2.45, 1.30, 23.0,  18.19, 2.45, 2.60, 'BRAK',  'FIRMA', null),
  ('BS-B', 'BS', 'Belki Suwnicowe', 14.95, 2.45, 1.80, 31.1,  18.19, 2.45, 3.10, 'BRAK',  'FIRMA', 'elementy scalone'),
  ('BS-C', 'BS', 'Belki Suwnicowe', 16.50, 2.45, 1.80, 33.6,  19.69, 2.45, 3.10, 'BRAK',  'FIRMA', 'elementy scalone'),
  ('KR',   'KR', 'Kratownice',     20.20, 3.52, 2.60, 28.4,  23.69, 3.52, 3.90, 'PL_SE', 'TRASA', 'konwój 1–3'),
  ('PL-A', 'PL', 'Płatwie dachowe i stężenia', 14.70, 2.45, 2.45, 22.1, 18.19, 2.45, 3.75, 'BRAK',  'FIRMA', null),
  ('PL-B', 'PL', 'Płatwie dachowe i stężenia', 14.70, 3.40, 2.45, 14.6, 18.19, 3.40, 3.75, 'PL_SE', 'FIRMA', null),
  ('SG',   'SG', 'Słupy główne',   18.21, 2.45, 2.45, 20.8,  21.69, 2.45, 3.75, 'BRAK',  'FIRMA', null),
  ('SS',   'SS', 'Słupy skrajne oś A', 18.21, 3.00, 2.50, 21.3, 21.69, 3.00, 3.80, 'BRAK',  'FIRMA', null),
  ('T',    'T',  'Tężniki',        14.62, 2.45, 2.45, 20.2,  18.19, 2.45, 3.75, 'BRAK',  'FIRMA', null),
  ('TS',   'TS', 'Tężniki ściany A', 17.50, 2.45, 2.65, 22.4, 20.69, 2.45, 3.95, 'BRAK',  'FIRMA', null)
on conflict (symbol) do update set
  family = excluded.family,
  position_name = excluded.position_name,
  cargo_length_m = excluded.cargo_length_m,
  cargo_width_m = excluded.cargo_width_m,
  cargo_height_m = excluded.cargo_height_m,
  cargo_weight_t = excluded.cargo_weight_t,
  combo_length_m = excluded.combo_length_m,
  combo_width_m = excluded.combo_width_m,
  combo_height_m = excluded.combo_height_m,
  pilot = excluded.pilot,
  permit_kind = excluded.permit_kind,
  notes = excluded.notes;

-- ---------------------------------------------------------------------
-- 2. Kolumny na loads / permits
-- ---------------------------------------------------------------------
alter table public.loads
  add column if not exists symbol text,
  add column if not exists permit_kind text;

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'loads_permit_kind_check'
  ) then
    alter table public.loads
      add constraint loads_permit_kind_check
      check (permit_kind is null or permit_kind in ('FIRMA', 'TRASA'));
  end if;
end $$;

alter table public.permits
  add column if not exists scope text;

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'permits_scope_check'
  ) then
    alter table public.permits
      add constraint permits_scope_check
      check (scope is null or scope in ('FIRMA', 'TRASA'));
  end if;
end $$;

comment on column public.loads.symbol is 'A7: symbol z tabeli symbol_specs (SG, KR, PL-A…).';
comment on column public.loads.permit_kind is 'A7: FIRMA (zezwolenie firmowe) albo TRASA (PL+SE).';
comment on column public.permits.scope is 'A7: FIRMA (13/GD/2026) albo TRASA (ręczne PL/SE).';

-- 0076: nowe kolumny loads → jawne grant select
grant select (symbol, permit_kind) on public.loads to authenticated;

-- ---------------------------------------------------------------------
-- 3. symbol_spec_of / resolve / apply
-- ---------------------------------------------------------------------
create or replace function public.symbol_resolve_code(p_code text, p_width_m numeric default null)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  c text := upper(btrim(coalesce(p_code, '')));
  fam text;
begin
  if c = '' then return null; end if;
  /* Jawny symbol z kodu (BS-A, PL-B, SG-03 → rodzina). */
  if c ~ '^(BS-[ABC]|PL-[AB]|KR|SG|SS|TS|T)([.-]|$)' then
    if c ~ '^BS-A' then return 'BS-A'; end if;
    if c ~ '^BS-B' then return 'BS-B'; end if;
    if c ~ '^BS-C' then return 'BS-C'; end if;
    if c ~ '^PL-B' then return 'PL-B'; end if;
    if c ~ '^PL-A' then return 'PL-A'; end if;
    if c ~ '^KR' then return 'KR'; end if;
    if c ~ '^SG' then return 'SG'; end if;
    if c ~ '^SS' then return 'SS'; end if;
    if c ~ '^TS' then return 'TS'; end if;
    if c ~ '^T([.-]|$)' then return 'T'; end if;
  end if;
  fam := public.shipment_family(c);
  if fam = 'KR' then return 'KR'; end if;
  if fam = 'SG' then return 'SG'; end if;
  if fam = 'SS' then return 'SS'; end if;
  if fam = 'TS' then return 'TS'; end if;
  if fam = 'T' then return 'T'; end if;
  if fam = 'PL' then
    if coalesce(p_width_m, 0) >= 3.20 then return 'PL-B'; end if;
    return 'PL-A';
  end if;
  if fam = 'BS' then
    /* Bez dokładnego wariantu — BS-A; dokładniejsze dopasowanie w symbol_spec_of po cargo. */
    return 'BS-A';
  end if;
  return null;
end $$;

revoke all on function public.symbol_resolve_code(text, numeric) from public, anon;
grant execute on function public.symbol_resolve_code(text, numeric) to authenticated;

create or replace function public.symbol_spec_of(p_load uuid)
returns public.symbol_specs
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_code text;
  v_w numeric;
  v_l numeric;
  v_h numeric;
  v_sym text;
  v_row public.symbol_specs;
begin
  if (p_load is not null) is not true then
    return null;
  end if;
  select min(si.shipment_code),
         max(si.width_m), max(si.length_m), max(si.height_m)
    into v_code, v_w, v_l, v_h
    from public.shipment_items si
   where si.load_id = p_load;

  v_sym := public.symbol_resolve_code(v_code, v_w);

  /* BS: dopasuj wariant po wymiarach ładunku, gdy kod nie ma A/B/C. */
  if public.shipment_family(v_code) = 'BS'
     and (v_code is null or v_code !~* '^BS-[ABC]')
     and v_l is not null then
    select s.* into v_row
      from public.symbol_specs s
     where s.family = 'BS'
     order by abs(coalesce(s.cargo_length_m, 0) - v_l)
            + abs(coalesce(s.cargo_height_m, 0) - coalesce(v_h, 0))
     limit 1;
    if v_row.symbol is not null then
      return v_row;
    end if;
  end if;

  if v_sym is null then
    return null;
  end if;
  select s.* into v_row from public.symbol_specs s where s.symbol = v_sym;
  return v_row;
end $$;

revoke all on function public.symbol_spec_of(uuid) from public, anon;
grant execute on function public.symbol_spec_of(uuid) to authenticated;

create or replace function public.a7_apply_symbol(p_load uuid, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_spec public.symbol_specs;
  v_old jsonb;
  v_escorts int;
  v_user uuid := current_app_user_id();
begin
  if current_setting('tower.bulk_quiet', true) = 'on' then
    null; /* jednorazowe / import */
  elsif (v_user is not null and is_hhl()) is not true then
    raise exception 'Brak aktywnego konta' using errcode = '42501';
  end if;
  v_spec := public.symbol_spec_of(p_load);
  if v_spec.symbol is null then
    return jsonb_build_object('ok', false, 'reason', 'NO_SYMBOL');
  end if;
  v_escorts := case when v_spec.pilot = 'PL_SE' then 2 else 0 end;

  select jsonb_build_object(
    'symbol', l.symbol, 'permit_kind', l.permit_kind,
    'combo_length_m', l.combo_length_m, 'combo_width_m', l.combo_width_m,
    'combo_height_m', l.combo_height_m, 'escort_vehicles', l.escort_vehicles
  ) into v_old
    from public.loads l where l.id = p_load;

  /* Zamknięte statusy: nie nadpisuj combo_* / escort (F7 D / P9). */
  update public.loads l
     set symbol = v_spec.symbol,
         permit_kind = v_spec.permit_kind,
         combo_length_m = case
           when l.status::text in ('DELIVERED','READY_TO_INVOICE','INVOICED','CANCELLED')
             then l.combo_length_m else v_spec.combo_length_m end,
         combo_width_m = case
           when l.status::text in ('DELIVERED','READY_TO_INVOICE','INVOICED','CANCELLED')
             then l.combo_width_m else v_spec.combo_width_m end,
         combo_height_m = case
           when l.status::text in ('DELIVERED','READY_TO_INVOICE','INVOICED','CANCELLED')
             then l.combo_height_m else v_spec.combo_height_m end,
         escort_vehicles = case
           when l.status::text in ('DELIVERED','READY_TO_INVOICE','INVOICED','CANCELLED')
             then l.escort_vehicles else v_escorts end
   where l.id = p_load;

  insert into public.audit_log (user_id, action, entity, entity_id, old_value, new_value)
  values (
    v_user, 'SYMBOL_APPLY', 'loads', p_load::text, v_old,
    jsonb_build_object(
      'symbol', v_spec.symbol, 'permit_kind', v_spec.permit_kind,
      'combo_length_m', v_spec.combo_length_m, 'combo_width_m', v_spec.combo_width_m,
      'combo_height_m', v_spec.combo_height_m, 'escort_vehicles', v_escorts,
      'note', coalesce(p_note, 'A7 symbol_specs')
    )
  );

  /* Firma: podepnij zezwolenie firmowe (13/GD/2026) w okresie ważności. */
  if v_spec.permit_kind = 'FIRMA' then
    insert into public.load_permits (load_id, permit_id)
    select p_load, p.id
      from public.permits p
      join public.loads l on l.id = p_load
     where p.scope = 'FIRMA'
       and p.permit_no = '13/GD/2026'
       and coalesce(l.plan_load_date, (now() at time zone 'Europe/Warsaw')::date)
           between p.valid_from and p.valid_until
    on conflict do nothing;
  end if;

  return jsonb_build_object('ok', true, 'symbol', v_spec.symbol, 'permit_kind', v_spec.permit_kind);
end $$;

revoke all on function public.a7_apply_symbol(uuid, text) from public, anon;
grant execute on function public.a7_apply_symbol(uuid, text) to authenticated;

/* Import / pozycja ładunku: symbol z shipment_code i wymiarów — F7 B3/P8. */
create or replace function public.trg_shipment_items_a7_symbol()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prev text;
begin
  if (new.load_id is not null) is not true then
    return new;
  end if;
  begin
    v_prev := current_setting('tower.bulk_quiet', true);
    perform set_config('tower.bulk_quiet', 'on', true);
    perform public.a7_apply_symbol(new.load_id, 'A7 przy imporcie / pozycja ładunku');
    perform set_config('tower.bulk_quiet', coalesce(v_prev, ''), true);
  exception when others then
    perform set_config('tower.bulk_quiet', coalesce(v_prev, ''), true);
    raise exception 'A7 symbol (load %): %', new.load_id, sqlerrm
      using errcode = sqlstate;
  end;
  return new;
end $$;

drop trigger if exists trg_shipment_items_a7_symbol on public.shipment_items;
create trigger trg_shipment_items_a7_symbol
  after insert or update of shipment_code, load_id, length_m, width_m, height_m, total_weight_t
  on public.shipment_items
  for each row execute function public.trg_shipment_items_a7_symbol();

revoke all on function public.trg_shipment_items_a7_symbol() from public, anon, authenticated;

/* Polisa SCX (przewoźnik): bez widoczności KSH. Polisa HHL zostaje widoczna dla KSH — F7 P4. */
create or replace function public.trg_documents_insurance_visibility()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.category = 'INSURANCE'
     and (
       exists (
         select 1 from public.app_users u
         join public.organizations o on o.id = u.org_id
         where u.id = new.uploaded_by and o.kind = 'CARRIER'
       )
       or exists (
         select 1 from public.insurance_policies ip
         join public.organizations o on o.id = ip.org_id
         where ip.document_id = new.id and o.kind = 'CARRIER'
       )
     ) then
    new.visible_to := array['FORWARDER', 'CARRIER']::org_kind[];
  end if;
  return new;
end $$;

drop trigger if exists trg_documents_insurance_visibility on public.documents;
create trigger trg_documents_insurance_visibility
  before insert or update of category, visible_to, uploaded_by on public.documents
  for each row execute function public.trg_documents_insurance_visibility();

update public.documents d
   set visible_to = array['FORWARDER', 'CARRIER']::org_kind[]
 where d.category = 'INSURANCE'
   and 'CLIENT'::org_kind = any (d.visible_to)
   and (
     exists (
       select 1 from public.app_users u
       join public.organizations o on o.id = u.org_id
       where u.id = d.uploaded_by and o.kind = 'CARRIER'
     )
     or exists (
       select 1 from public.insurance_policies ip
       join public.organizations o on o.id = ip.org_id
       where ip.document_id = d.id and o.kind = 'CARRIER'
     )
   );

revoke all on function public.trg_documents_insurance_visibility() from public, anon, authenticated;

/* F7 P2: HHL wgrywa dokument INSURANCE, potem insurance_policy_save(p_org=SCX).
   Przy INSERT dokumentu polisy jeszcze nie ma — zawężamy visible_to dopiero przy
   podpięciu document_id do polisy przewoźnika. */
create or replace function public.trg_insurance_policies_doc_visibility()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.document_id is not null
     and exists (
       select 1 from public.organizations o
        where o.id = new.org_id and o.kind = 'CARRIER'
     ) then
    update public.documents
       set visible_to = array['FORWARDER', 'CARRIER']::org_kind[]
     where id = new.document_id
       and category = 'INSURANCE'
       and (
         visible_to is null
         or 'CLIENT'::org_kind = any (visible_to)
         or not (visible_to @> array['FORWARDER', 'CARRIER']::org_kind[]
                 and cardinality(visible_to) = 2)
       );
  end if;
  return new;
end $$;

drop trigger if exists trg_insurance_policies_doc_visibility on public.insurance_policies;
create trigger trg_insurance_policies_doc_visibility
  after insert or update of document_id, org_id on public.insurance_policies
  for each row execute function public.trg_insurance_policies_doc_visibility();

revoke all on function public.trg_insurance_policies_doc_visibility() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. Seed PERMIT_SE z powrotem (tylko Trasa w statusie); filtr statusu
-- ---------------------------------------------------------------------
create or replace function public.doc_requirements_seed(p_project uuid) returns void
language sql security definer set search_path = public as $$
  insert into doc_requirements (project_id, category, required, responsible, anchor, offset_hours)
  select p_project, v.category::doc_category, true, v.responsible::org_kind, v.anchor, v.offset_hours
    from (values
      ('PERMIT_PL', 'CARRIER', 'BEFORE_LOAD',  24),
      ('PERMIT_SE', 'CARRIER', 'BEFORE_LOAD',  24),
      ('CMR',       'CARRIER', 'AFTER_UNLOAD', 24),
      ('INSURANCE', 'CARRIER', 'ORG',           0)
    ) as v(category, responsible, anchor, offset_hours)
  on conflict (project_id, category) do nothing
$$;
revoke all on function public.doc_requirements_seed(uuid) from public, anon, authenticated;

create or replace function public.doc_requirements_status(p_project uuid)
returns table (load_id uuid, category doc_category, responsible org_kind, due_at timestamptz, has_doc boolean, state text)
language sql stable security invoker set search_path = public as $$
  with req as (
    select r.* from doc_requirements r where r.project_id = p_project and r.required and r.anchor <> 'ORG'
  ), ld as (
    select l.id, l.plan_load_from, l.plan_load_to, l.plan_load_date, l.plan_delivery_from, l.plan_delivery_to,
           l.plan_delivery_date, l.actual_delivery_at, l.permit_kind,
           coalesce(s.delayed_departure_at, s.departure_at) as ferry_at
      from loads l left join sailings s on s.id = l.sailing_id
     where l.project_id = p_project and l.status <> 'CANCELLED'
  ), x as (
    select ld.id as load_id, req.category, req.responsible, req.anchor, ld.permit_kind,
      case
        when req.category = 'CMR' and req.anchor = 'AFTER_UNLOAD' then
          case when ld.actual_delivery_at is not null
            then ld.actual_delivery_at + make_interval(hours => req.offset_hours)
            else null
          end
        when req.anchor = 'BEFORE_LOAD' then coalesce(ld.plan_load_from, (ld.plan_load_date + time '06:00') at time zone 'Europe/Warsaw')
                                 - make_interval(hours => req.offset_hours)
        when req.anchor = 'AT_LOAD' then coalesce(ld.plan_load_to, ld.plan_load_from, (ld.plan_load_date + time '18:00') at time zone 'Europe/Warsaw')
                                 + make_interval(hours => req.offset_hours)
        when req.anchor = 'BEFORE_FERRY' then ld.ferry_at - make_interval(hours => req.offset_hours)
        when req.anchor = 'AFTER_UNLOAD' then coalesce(ld.plan_delivery_to, ld.plan_delivery_from,
                                 (ld.plan_delivery_date + time '23:59') at time zone 'Europe/Stockholm')
                                 + make_interval(hours => req.offset_hours)
      end as due_at,
      case
        when req.category = 'CMR' then
          exists (
            select 1 from documents d
             where d.load_id = ld.id
               and d.category = 'CMR'
               and d.superseded_at is null
               and d.purged_at is null
               and ld.actual_delivery_at is not null
               and d.uploaded_at >= ld.actual_delivery_at
          )
        else
          exists (
            select 1 from documents d
             where d.load_id = ld.id
               and d.category = req.category
               and d.superseded_at is null
          )
      end as has_doc,
      ld.actual_delivery_at
    from ld cross join req
  )
  select x.load_id, x.category, x.responsible, x.due_at, x.has_doc,
         case when x.has_doc then 'OK' when x.due_at is not null and x.due_at < now() then 'OVERDUE' else 'MISSING' end
    from x
   where not (
     x.category = 'CMR' and x.anchor = 'AFTER_UNLOAD'
     and x.has_doc is not true
     and x.actual_delivery_at is null
   )
   /* A7: PERMIT_* tylko dla Trasa; Firma = zezwolenie firmowe poza listą dokumentów. */
   and not (
     x.category in ('PERMIT_PL', 'PERMIT_SE')
     and coalesce(x.permit_kind, 'FIRMA') = 'FIRMA'
   )
$$;
revoke all on function public.doc_requirements_status(uuid) from public, anon;
grant execute on function public.doc_requirements_status(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 5. awiz_missing — PERMIT według Firma / Trasa
-- ---------------------------------------------------------------------
create or replace function public.awiz_missing(p_load uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  l public.loads%rowtype;
  gaps jsonb := '[]'::jsonb;
  awiz text[] := array[]::text[];
  v_pilots int;
  v_escorts int;
  v_items jsonb;
  v_anchor date;
  v_has_policy boolean;
  v_permit_missing boolean;
  v_kind text;
begin
  select * into l from public.loads where id = p_load;
  if l.id is null then
    return '[]'::jsonb;
  end if;
  if l.status::text not in ('PLANNED', 'RESOURCES_PENDING', 'DOCS_PENDING') then
    return '[]'::jsonb;
  end if;

  if l.carrier_org_id is null then
    gaps := gaps || jsonb_build_array(jsonb_build_object(
      'kind', 'CARRIER', 'items', jsonb_build_array('Brak przewoźnika'), 'who', 'HHL'
    ));
  end if;

  if coalesce(btrim(l.driver_name), '') = '' then awiz := array_append(awiz, 'kierowca'); end if;
  if coalesce(btrim(l.driver_phone), '') = '' then awiz := array_append(awiz, 'telefon'); end if;
  if coalesce(btrim(l.tractor_plate), '') = '' then awiz := array_append(awiz, 'ciągnik'); end if;
  if coalesce(btrim(l.trailer_plate), '') = '' then awiz := array_append(awiz, 'naczepa'); end if;
  if l.trailer_swap is true then
    if coalesce(btrim(l.driver_delivery_name), '') = '' then awiz := array_append(awiz, 'kierowca SE'); end if;
    if coalesce(btrim(l.driver_delivery_phone), '') = '' then awiz := array_append(awiz, 'telefon SE'); end if;
    if coalesce(btrim(l.tractor_delivery_plate), '') = '' then awiz := array_append(awiz, 'ciągnik SE'); end if;
  end if;
  if coalesce(array_length(awiz, 1), 0) > 0 then
    gaps := gaps || jsonb_build_array(jsonb_build_object(
      'kind', 'AWIZ', 'items', to_jsonb(awiz), 'who', 'SCX'
    ));
  end if;

  if l.sailing_id is null then
    gaps := gaps || jsonb_build_array(jsonb_build_object('kind', 'SAILING', 'who', 'SCX'));
  end if;

  select coalesce(max(p.escort_required), 0) into v_pilots
    from public.load_permits lp
    join public.permits p on p.id = lp.permit_id
   where lp.load_id = l.id;
  select count(*)::int into v_escorts from public.load_escorts e where e.load_id = l.id;
  if v_pilots < coalesce(l.escort_vehicles, 0) then
    v_pilots := coalesce(l.escort_vehicles, 0);
  end if;
  if v_pilots > 0 and v_escorts < v_pilots then
    v_items := case
      when v_pilots > 1 then jsonb_build_array('pilot ×' || v_pilots::text)
      else jsonb_build_array('pilot')
    end;
    gaps := gaps || jsonb_build_array(jsonb_build_object(
      'kind', 'PILOTS', 'items', v_items, 'who', 'SCX'
    ));
  end if;

  if coalesce(btrim(l.carrier_order_no), '') = '' then
    gaps := gaps || jsonb_build_array(jsonb_build_object('kind', 'ORDER_SCX', 'who', 'SCX'));
  end if;
  if coalesce(btrim(l.hhl_order_no), '') = '' then
    gaps := gaps || jsonb_build_array(jsonb_build_object('kind', 'ORDER_HHL', 'who', 'HHL'));
  end if;

  v_anchor := coalesce(l.plan_load_date, (now() at time zone 'Europe/Warsaw')::date);
  if l.carrier_org_id is not null then
    v_has_policy := exists (
      select 1 from public.insurance_policies ip
       where ip.org_id = l.carrier_org_id
         and ip.approval_status = 'APPROVED'
         and ip.valid_from <= v_anchor
         and ip.valid_until >= v_anchor
    );
    if v_has_policy is not true then
      gaps := gaps || jsonb_build_array(jsonb_build_object('kind', 'POLICY_SCX', 'who', 'SCX'));
    end if;
  end if;

  v_kind := coalesce(l.permit_kind, (public.symbol_spec_of(l.id)).permit_kind, 'FIRMA');
  if public.permit_required_enabled() is true
     and public.load_needs_permit(l.id) is true then
    if v_kind = 'TRASA' then
      v_permit_missing := exists (
        select 1 from unnest(array['PL', 'SE']) c
         where not exists (
           select 1
             from public.load_permits lp
             join public.permits p on p.id = lp.permit_id
            where lp.load_id = l.id
              and p.country = c
              and coalesce(p.scope, 'TRASA') = 'TRASA'
              and v_anchor between p.valid_from and p.valid_until
         )
      );
    else
      /* Firma: jedno zezwolenie firmowe w okresie ważności. */
      v_permit_missing := not exists (
        select 1
          from public.load_permits lp
          join public.permits p on p.id = lp.permit_id
         where lp.load_id = l.id
           and p.scope = 'FIRMA'
           and v_anchor between p.valid_from and p.valid_until
      );
    end if;
    if v_permit_missing is true then
      gaps := gaps || jsonb_build_array(jsonb_build_object(
        'kind', 'PERMIT',
        'items', case when v_kind = 'TRASA'
          then jsonb_build_array('Trasa')
          else jsonb_build_array('Firma') end,
        'who', 'SCX'
      ));
    end if;
  end if;

  return gaps;
end $$;

revoke all on function public.awiz_missing(uuid) from public, anon, authenticated;
comment on function public.awiz_missing(uuid) is
  'A9+A7: braki do Gotowy; PERMIT = Firma (scope FIRMA) albo Trasa (PL+SE).';

-- ---------------------------------------------------------------------
-- 6. Jednorazowo: zezwolenie firmowe + polisa HHL (metadane; PDF = skrypt)
-- Na świeżej bazie CI projekty/org są dopiero w seedzie — wołaj
-- a7_seed_firm_assets() z tests/db/seed.sql (i z e25). Na produkcji orgs już są.
-- ---------------------------------------------------------------------
create or replace function public.a7_seed_firm_assets()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project uuid;
  v_hhl uuid;
  v_permit uuid;
  v_pol uuid;
  v_n int := 0;
begin
  select id into v_hhl from public.organizations where kind = 'FORWARDER' order by id limit 1;

  if v_hhl is not null then
    select id into v_pol from public.insurance_policies
     where policy_no = '1106707356' and org_id = v_hhl limit 1;
    if v_pol is null then
      insert into public.insurance_policies (
        org_id, policy_no, insurer, scope, sum_insured, currency,
        covers_oversize, covers_sweden, valid_from, valid_until, approval_status
      ) values (
        v_hhl, '1106707356', 'PZU', 'OC przewoźnika — PZU', 300000, 'EUR',
        true, true, '2026-04-23', '2027-04-22', 'APPROVED'
      ) returning id into v_pol;
      insert into public.audit_log (user_id, action, entity, entity_id, new_value)
      values (null, 'A7_SEED_POLICY', 'insurance_policies', v_pol::text,
              jsonb_build_object('policy_no', '1106707356', 'insurer', 'PZU',
                'note', 'wpis jednorazowy — decyzja właściciela 16.10.2026, 01:13'));
    end if;
  end if;

  /* Jedno zezwolenie firmowe — pierwszy projekt (F7 D: permits ≠ 1 przy wielu projektach). */
  select id into v_project from public.projects order by created_at nulls last, id limit 1;
  if v_project is not null then
    select id into v_permit from public.permits
     where permit_no = '13/GD/2026' and scope = 'FIRMA'
     limit 1;
    if v_permit is null then
      insert into public.permits (
        project_id, country, permit_no, authority, category, scope,
        max_length_m, max_width_m, max_height_m, max_weight_t,
        escort_required, valid_from, valid_until, route_desc
      ) values (
        v_project, 'PL', '13/GD/2026', 'GDDKiA', 'IV', 'FIRMA',
        23.00, 3.40, 4.30, 60.00,
        0, '2026-01-25', '2028-01-25',
        'Zezwolenie firmowe kat. IV (druk AF 0082620) — Scandinavian Express Poland'
      ) returning id into v_permit;
      insert into public.audit_log (user_id, action, entity, entity_id, new_value)
      values (null, 'A7_SEED_PERMIT', 'permits', v_permit::text,
              jsonb_build_object('permit_no', '13/GD/2026', 'scope', 'FIRMA',
                'project_id', v_project,
                'note', 'wpis jednorazowy — decyzja właściciela 16.10.2026, 01:13'));
    end if;
  end if;

  perform set_config('tower.bulk_quiet', 'on', true);
  select count(*)::int into v_n
    from public.loads l
   where l.status <> 'CANCELLED'
     and exists (select 1 from public.shipment_items si where si.load_id = l.id);
  perform public.a7_apply_symbol(l.id, 'A7 jednorazowe uzupełnienie')
    from public.loads l
   where l.status <> 'CANCELLED'
     and exists (select 1 from public.shipment_items si where si.load_id = l.id);
  perform set_config('tower.bulk_quiet', 'off', true);

  return jsonb_build_object('permit', v_permit, 'policy', v_pol, 'applied', v_n);
end $$;

revoke all on function public.a7_seed_firm_assets() from public, anon, authenticated;

do $$
begin
  raise notice 'A7 seed: %', public.a7_seed_firm_assets();
end $$;

-- Seed PERMIT_SE na istniejących projektach
do $$
declare r record;
begin
  for r in select id from public.projects loop
    perform public.doc_requirements_seed(r.id);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 7. RPC pod widok (permitsOf / policiesOf)
-- ---------------------------------------------------------------------
create or replace function public.a7_permits_list()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_out jsonb;
begin
  if (current_app_user_id() is not null) is not true then
    raise exception 'Brak aktywnego konta' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id,
    'scope', coalesce(p.scope, 'TRASA'),
    'country', p.country,
    'number', p.permit_no,
    'validFrom', p.valid_from,
    'validTo', p.valid_until,
    'limits', jsonb_build_object(
      'l', p.max_length_m, 'w', p.max_width_m, 'h', p.max_height_m
    ),
    'pilot', case when p.escort_required > 0 then 'PL + SE' else null end,
    'appliesTo', case when p.scope = 'FIRMA' then 'Firma' else coalesce(p.route_desc, 'Trasa') end,
    'loads', (select count(*)::int from public.load_permits lp where lp.permit_id = p.id)
  ) order by p.valid_until desc nulls last), '[]'::jsonb)
    into v_out
    from public.permits p
   where is_hhl()
      or (current_org_kind() = 'CARRIER' and exists (
            select 1 from public.loads l
             where l.carrier_org_id = current_org_id()
               and l.project_id = p.project_id
          ))
      or (current_org_kind() = 'CLIENT' and p.scope = 'FIRMA');
  return v_out;
end $$;

revoke all on function public.a7_permits_list() from public, anon;
grant execute on function public.a7_permits_list() to authenticated;

create or replace function public.a7_policies_list()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_out jsonb;
begin
  if (current_app_user_id() is not null) is not true then
    raise exception 'Brak aktywnego konta' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'org', case when o.kind = 'FORWARDER' then 'HHL' else 'SCX' end,
    'name', coalesce(nullif(btrim(ip.scope), ''), ip.insurer, ip.policy_no),
    'number', ip.policy_no,
    'validTo', ip.valid_until,
    'approved', ip.approval_status = 'APPROVED'
  ) order by o.kind, ip.valid_until desc), '[]'::jsonb)
    into v_out
    from public.insurance_policies ip
    join public.organizations o on o.id = ip.org_id
   where is_hhl()
      or (current_org_kind() = 'CARRIER' and ip.org_id = current_org_id())
      or (current_org_kind() = 'CLIENT' and o.kind = 'FORWARDER');
  /* KSH: tylko polisa HHL. SCX: tylko własna. */
  return v_out;
end $$;

revoke all on function public.a7_policies_list() from public, anon;
grant execute on function public.a7_policies_list() to authenticated;

-- =====================================================================
-- A4 (E4, D-20261017-2130-01, D-20261020-0115-01): register_invoice (CMR/VAT/grosz),
-- update_invoice, guard ról, INVOICE_OVERDUE, load_status_set = c17_cmr_after_delivery.
-- =====================================================================

alter type risk_kind add value if not exists 'INVOICE_OVERDUE';

-- Macierz: faktura po terminie + edycja (inv_updated / inv_corrected) — kolumny C3
insert into public.notification_matrix (
  event_key, event_group, role, in_app, email, push,
  fixed_in_app, fixed_email, fixed_push, risks_only, label_pl
) values
  ('inv_overdue','MONEY','HHL_ADMIN',true,true,false,false,false,false,false,'Faktura nieopłacona po terminie'),
  ('inv_overdue','MONEY','HHL_OPS',true,false,false,false,false,false,false,'Faktura nieopłacona po terminie'),
  ('inv_overdue','MONEY','CLIENT_USER',false,false,false,false,false,false,false,'Faktura nieopłacona po terminie'),
  ('inv_overdue','MONEY','CARRIER_DISPATCH',false,false,false,false,false,false,false,'Faktura nieopłacona po terminie'),
  ('inv_overdue','MONEY','CARRIER_USER',false,false,false,false,false,false,false,'Faktura nieopłacona po terminie'),
  ('inv_updated','MONEY','HHL_ADMIN',true,true,false,false,false,false,false,'Faktura zmieniona przez wystawcę'),
  ('inv_updated','MONEY','HHL_OPS',true,false,false,false,false,false,false,'Faktura zmieniona przez wystawcę'),
  ('inv_updated','MONEY','CLIENT_USER',true,true,false,false,false,false,false,'Faktura zmieniona przez wystawcę'),
  ('inv_updated','MONEY','CARRIER_DISPATCH',true,true,false,false,false,false,false,'Faktura zmieniona przez wystawcę'),
  ('inv_updated','MONEY','CARRIER_USER',false,false,false,false,false,false,false,'Faktura zmieniona przez wystawcę'),
  ('inv_corrected','MONEY','HHL_ADMIN',true,true,false,false,false,false,false,'Faktura poprawiona przez Administratora HHL'),
  ('inv_corrected','MONEY','HHL_OPS',true,false,false,false,false,false,false,'Faktura poprawiona przez Administratora HHL'),
  ('inv_corrected','MONEY','CLIENT_USER',true,true,false,false,false,false,false,'Faktura poprawiona przez Administratora HHL'),
  ('inv_corrected','MONEY','CARRIER_DISPATCH',true,true,false,false,false,false,false,'Faktura poprawiona przez Administratora HHL'),
  ('inv_corrected','MONEY','CARRIER_USER',false,false,false,false,false,false,false,'Faktura poprawiona przez Administratora HHL')
on conflict (event_key, role) do update set
  in_app = excluded.in_app,
  email = excluded.email,
  push = excluded.push,
  label_pl = excluded.label_pl;

create or replace function public.notify_event_key(p_template text, p_payload jsonb)
returns text
language sql
immutable
as $$
  select case
    when p_template = 'LOAD_CHAT_MESSAGE' then 'chat'
    when p_template = 'PLAN_DATES_CHANGED' then 'dates'
    when p_template in ('LOAD_STATUS_CHANGED', 'STATUS_CHANGE') then 'status'
    when p_template in ('ZONE_ENTER', 'GEOFENCE_ENTER')
         and coalesce(p_payload->>'geofence_kind', '') = 'PRE_PORT' then 'pre_port'
    when p_template in ('ZONE_ENTER', 'GEOFENCE_ENTER')
         and coalesce(p_payload->>'geofence_kind', '') = 'PRE_ARRIVAL'
         and (
           upper(coalesce(p_payload->>'geofence_country', p_payload->>'country', '')) = 'PL'
           or coalesce(p_payload->>'geofence_name', '') ilike '%srem%'
           or coalesce(p_payload->>'geofence_name', '') ilike '%śrem%'
         ) then 'pre_arrival_srem'
    when p_template in ('ZONE_ENTER', 'GEOFENCE_ENTER')
         and coalesce(p_payload->>'geofence_kind', '') = 'PRE_ARRIVAL' then 'pre_arrival_site'
    when p_template in ('ZONE_EXIT', 'GEOFENCE_EXIT', 'GEOFENCE_DWELL') then 'zone'
    when p_template in ('ZONE_ENTER', 'GEOFENCE_ENTER') then 'zone'
    when p_template = 'PRE_ARRIVAL_PL' then 'pre_arrival_srem'
    when p_template in ('PRE_ARRIVAL', 'PRE_ARRIVAL_SE') then 'pre_arrival_site'
    when p_template = 'PRE_PORT' then 'pre_port'
    when p_template = 'SCX_DETOUR_CHOICE' then 'scx_detour'
    when p_template = 'DECISION_ESCALATED' then 'dec_late'
    when p_template in ('DECISION_OPEN', 'DECISION_RESOLVED') then 'dec_new'
    when p_template in ('RESOURCE_DEADLINE', 'RESOURCE_MISSING') then 'res_missing'
    when p_template in ('ORDER_NO_MISSING', 'HHL_ORDER_MISSING', 'CARRIER_ORDER_MISSING') then 'order_no'
    when p_template in ('DOC_MISSING', 'CMR_MISSING') then 'cmr'
    when p_template in ('RISK_OPEN', 'RISK_SEVERITY')
         and coalesce(p_payload->>'kind', '') in ('DOC_MISSING', 'PERMIT', 'INSURANCE') then 'cmr'
    when p_template in ('RISK_OPEN', 'RISK_SEVERITY')
         and coalesce(p_payload->>'kind', '') = 'RESOURCE_MISSING' then 'res_missing'
    when p_template in ('RISK_OPEN', 'RISK_SEVERITY')
         and (
           coalesce(p_payload->>'title_key', '') in ('rk_order_no', 'rk_test_orderno')
           or coalesce(p_payload->>'kind', '') in ('ORDER_NO', 'HHL_ORDER_MISSING', 'CARRIER_ORDER_MISSING')
         ) then 'order_no'
    when p_template = 'SOURCE_BACK' then 'src_back'
    when coalesce(p_payload->>'kind', '') in ('USAGE_LIMIT', 'JOB_FAILURE')
         or p_template in ('JOB_FAILURE', 'SOURCE_DOWN') then 'src_down'
    when p_template = 'APP_ERROR' then 'app_err'
    when p_template in ('SMS_GATEWAY_SILENT', 'SMS_UNDELIVERED', 'SMS_FALLBACK', 'ZONE_LIMIT') then 'sms_gw'
    when p_template in ('DAILY_DIGEST', 'ADMIN_DIGEST') then 'daily'
    when p_template = 'INVOICE_NEW' then 'inv_check'
    when p_template = 'INVOICE_UPDATED' then 'inv_updated'
    when p_template = 'INVOICE_CORRECTED' then 'inv_corrected'
    when p_template in ('INVOICE_DISPUTED', 'INVOICE_DISPUTE_REPLY', 'INVOICE_DISPUTE_RESOLVED') then 'inv_dispute'
    when p_template = 'INVOICE_OVERDUE' then 'inv_overdue'
    when p_template in ('WEEK_CLOSED', 'INVOICE_WEEK') then 'week'
    when p_template like 'FACTOR%' then 'factoring'
    when p_template in ('RISK_OPEN', 'RISK_SEVERITY')
         and coalesce(p_payload->>'kind', '') in ('FERRY', 'WEATHER', 'ROAD_SE', 'ROAD_PL', 'ETA_BREACH')
         and coalesce(p_payload->>'severity', '') = 'CRITICAL' then 'risk_crit'
    when p_template in ('RISK_OPEN', 'RISK_SEVERITY')
         and coalesce(p_payload->>'kind', '') in ('FERRY', 'WEATHER', 'ROAD_SE', 'ROAD_PL', 'ETA_BREACH') then 'risk_route'
    when p_template in ('ROAD_RISK', 'FERRY_CANCELLED', 'FERRY_OVERDUE')
         and coalesce(p_payload->>'severity', '') = 'CRITICAL' then 'risk_crit'
    when p_template in ('ROAD_RISK', 'FERRY_CANCELLED', 'FERRY_OVERDUE') then 'risk_route'
    when p_template in ('FERRY', 'WEATHER', 'ROAD_SE', 'ROAD_PL')
         and nullif(coalesce(p_payload->>'load_id', ''), '') is null then 'risk_general'
    else null
  end
$$;

alter function public.notify_event_key(text, jsonb) set search_path = public;
revoke all on function public.notify_event_key(text, jsonb) from public, anon, authenticated;

-- KSH nie wystawia faktur; INSERT tylko z register_invoice (F7 P7).
drop policy if exists invoices_insert on invoices;
create policy invoices_insert on invoices for insert to authenticated with check (
  current_setting('tower.register_invoice', true) = 'on'
  and (current_org_kind() is distinct from 'CLIENT')
  and (is_hhl() or issuer_org_id = current_org_id())
);

/* F7 P5: korekta wystawcy (SPORNA→DO_WERYFIKACJI) nie wysyła „Spór zamknięty”. */
create or replace function public.invoices_dispute_track() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_kind text; v_ev bigint; v_user uuid := current_app_user_id(); v_org uuid := current_org_id();
begin
  if current_setting('tower.invoice_edit', true) = 'on' then
    return new;
  end if;
  if new.verification_status is not distinct from old.verification_status then return new; end if;
  v_kind := case
    when new.verification_status = 'SPORNA' then 'OPENED'
    when old.verification_status = 'SPORNA' and new.verification_status in ('ZGODNA', 'ZAAKCEPTOWANA') then 'RESOLVED'
    when old.verification_status = 'SPORNA' then 'WITHDRAWN'
    else null end;
  if v_kind is null then return new; end if;
  insert into invoice_dispute_events (invoice_id, kind, status_to, note, actor_user, actor_org)
  values (new.id, v_kind, new.verification_status, case when v_kind = 'OPENED' then new.dispute_note end, v_user, v_org)
  returning id into v_ev;
  if new.issuer_org_id is not null then
    perform invoice_dispute_notify(new.issuer_org_id,
      case v_kind when 'OPENED' then 'INVOICE_DISPUTED' else 'INVOICE_DISPUTE_RESOLVED' end,
      new, v_ev, case when v_kind = 'OPENED' then new.dispute_note end);
  end if;
  return new;
end $$;
revoke all on function public.invoices_dispute_track() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Sprawa INVOICE_OVERDUE
-- ---------------------------------------------------------------------
create or replace function public.a4_invoice_party_code(p_org uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case o.kind
    when 'FORWARDER' then 'HHL'
    when 'CARRIER' then coalesce(nullif(btrim(o.code), ''), 'SCX')
    when 'CLIENT' then coalesce(nullif(btrim(o.code), ''), 'KSH')
    else coalesce(nullif(btrim(o.code), ''), '—')
  end
  from organizations o where o.id = p_org;
$$;
revoke all on function public.a4_invoice_party_code(uuid) from public, anon, authenticated;

create or replace function public.a4_close_invoice_overdue(p_invoice uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update risk_signals
     set resolved_at = now()
   where dedup_key = 'INVOICE_OVERDUE:' || p_invoice
     and resolved_at is null;
end $$;
revoke all on function public.a4_close_invoice_overdue(uuid) from public, anon, authenticated;

create or replace function public.a4_open_invoice_overdue(p_invoice uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  inv invoices%rowtype;
  v_from text;
  v_to text;
  v_due text;
  v_title text;
  v_id uuid;
  v_n int;
begin
  select * into inv from invoices where id = p_invoice;
  if not found then
    return false;
  end if;
  if inv.paid_at is not null or inv.payment_status = 'OPLACONA' then
    return false;
  end if;
  if inv.verification_status = 'SPORNA' then
    return false;
  end if;
  if inv.due_date is null then
    return false;
  end if;
  if (timezone('Europe/Warsaw', now()))::date <= inv.due_date then
    return false;
  end if;

  v_from := public.a4_invoice_party_code(inv.issuer_org_id);
  v_to := public.a4_invoice_party_code(inv.recipient_org_id);
  v_due := to_char(inv.due_date, 'DD.MM.YYYY');
  v_title := format('Faktura %s (%s → %s) nieopłacona po terminie %s',
                    inv.invoice_number, v_from, v_to, v_due);

  insert into risk_signals (
    project_id, load_id, kind, severity, title, title_key, audience, detail, dedup_key
  ) values (
    inv.project_id,
    null,
    'INVOICE_OVERDUE',
    'HIGH',
    v_title,
    'rk_invoice_overdue',
    'HHL',
    jsonb_build_object(
      'owner', 'HHL',
      'invoice_id', inv.id,
      'params', jsonb_build_object(
        'number', inv.invoice_number,
        'from', v_from,
        'to', v_to,
        'due', v_due
      )
    ),
    'INVOICE_OVERDUE:' || inv.id
  )
  on conflict (dedup_key) where dedup_key is not null and resolved_at is null do nothing
  returning id into v_id;
  get diagnostics v_n = row_count;
  if v_n = 0 or v_id is null then
    return false;
  end if;

  perform public.matrix_notify(
    'MONEY',
    'INVOICE_OVERDUE',
    null,
    inv.project_id,
    jsonb_build_object(
      'invoice_id', inv.id,
      'number', inv.invoice_number,
      'week', inv.week_key,
      'amount', inv.gross_total,
      'currency', inv.currency,
      'due', inv.due_date,
      'kind', 'INVOICE_OVERDUE',
      'title_key', 'rk_invoice_overdue'
    ),
    'INVOICE_OVERDUE:' || inv.id || ':' || v_id
  );
  return true;
end $$;
revoke all on function public.a4_open_invoice_overdue(uuid) from public, anon, authenticated;

create or replace function public.refresh_payment_status(p_today date default current_date)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  n1 int;
  n2 int;
  r record;
begin
  update invoices set payment_status = 'PO_TERMINIE'
   where payment_status = 'NIEOPLACONA' and due_date is not null and due_date < p_today;
  get diagnostics n1 = row_count;
  update invoices set payment_status = 'NIEOPLACONA'
   where payment_status = 'PO_TERMINIE' and (due_date is null or due_date >= p_today);
  get diagnostics n2 = row_count;

  for r in
    select id from invoices
     where paid_at is null
       and payment_status is distinct from 'OPLACONA'
       and verification_status is distinct from 'SPORNA'
       and due_date is not null
       and due_date < coalesce(p_today, (timezone('Europe/Warsaw', now()))::date)
  loop
    perform public.a4_open_invoice_overdue(r.id);
  end loop;

  for r in
    select id from invoices
     where payment_status = 'OPLACONA'
        or paid_at is not null
        or verification_status = 'SPORNA'
        or due_date is null
        or due_date >= coalesce(p_today, (timezone('Europe/Warsaw', now()))::date)
  loop
    perform public.a4_close_invoice_overdue(r.id);
  end loop;

  return n1 + n2;
end $$;
revoke all on function public.refresh_payment_status(date) from public, anon, authenticated;

create or replace function public.a4_trg_invoice_overdue()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.a4_close_invoice_overdue(old.id);
    return old;
  end if;
  if new.payment_status = 'OPLACONA'
     or new.paid_at is not null
     or new.verification_status = 'SPORNA' then
    perform public.a4_close_invoice_overdue(new.id);
  elsif new.verification_status in ('ZAAKCEPTOWANA', 'ZGODNA', 'DO_WERYFIKACJI')
        and (old.payment_status = 'OPLACONA' or old.verification_status = 'SPORNA'
             or old.paid_at is not null) then
    perform public.a4_open_invoice_overdue(new.id);
  elsif new.payment_status is distinct from 'OPLACONA'
        and new.paid_at is null
        and new.verification_status is distinct from 'SPORNA' then
    perform public.a4_open_invoice_overdue(new.id);
  end if;
  return new;
end $$;
revoke all on function public.a4_trg_invoice_overdue() from public, anon, authenticated;

drop trigger if exists trg_a4_invoice_overdue on public.invoices;
create trigger trg_a4_invoice_overdue
  after update of payment_status, paid_at, verification_status, due_date
  on public.invoices
  for each row execute function public.a4_trg_invoice_overdue();

drop trigger if exists trg_a4_invoice_overdue_del on public.invoices;
create trigger trg_a4_invoice_overdue_del
  after delete on public.invoices
  for each row execute function public.a4_trg_invoice_overdue();

-- ---------------------------------------------------------------------
-- guard_invoice_update — tabela ról z D-0115
-- ---------------------------------------------------------------------
create or replace function public.guard_invoice_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  org uuid := current_org_id();
  v_role text := current_app_role()::text;
  v_kind text := current_org_kind()::text;
  issuer_changed boolean :=
       new.invoice_number is distinct from old.invoice_number
    or new.issue_date     is distinct from old.issue_date
    or new.receipt_date   is distinct from old.receipt_date
    or new.week_key       is distinct from old.week_key
    or new.currency       is distinct from old.currency
    or new.net_total      is distinct from old.net_total
    or new.vat_total      is distinct from old.vat_total
    or new.gross_total    is distinct from old.gross_total
    or new.due_date       is distinct from old.due_date
    or new.due_date_from_document is distinct from old.due_date_from_document
    or new.document_id    is distinct from old.document_id
    or new.issuer_org_id  is distinct from old.issuer_org_id
    or new.recipient_org_id is distinct from old.recipient_org_id
    or new.direction      is distinct from old.direction;
  verifier_changed boolean :=
       new.verification_status is distinct from old.verification_status
    or new.dispute_note        is distinct from old.dispute_note;
  payment_changed boolean :=
       new.payment_status is distinct from old.payment_status
    or new.paid_at is distinct from old.paid_at
    or new.paid_marked_by is distinct from old.paid_marked_by
    or new.paid_marked_at is distinct from old.paid_marked_at;
  v_accepted boolean := (old.verification_status = 'ZAAKCEPTOWANA');
  v_can_edit boolean := false;
  v_edit_ctx boolean := (current_setting('tower.invoice_edit', true) = 'on');
begin
  if new.verification_status = 'SPORNA'
     and (new.dispute_note is null or btrim(new.dispute_note) = '') then
    raise exception 'Status SPORNA wymaga uzasadnienia';
  end if;
  if auth.uid() is null then return new; end if;
  if (org is not null) is not true then
    raise exception 'Brak aktywnego konta' using errcode = '42501';
  end if;
  if payment_changed and (is_hhl() is not true) then
    raise exception 'Status płatności zmienia tylko HHL' using errcode = '42501';
  end if;

  if issuer_changed then
    /* Treść tylko przez update_invoice (F7 P7). */
    if v_edit_ctx is not true then
      raise exception 'Treść faktury zmieniasz przez Edytuj fakturę' using errcode = '42501';
    end if;
    if v_kind = 'CLIENT' then
      raise exception 'KSH nie zmienia faktur — może je zaakceptować albo zgłosić spór'
        using errcode = '42501';
    end if;
    if v_accepted then
      if (v_role = 'HHL_ADMIN') is not true then
        raise exception 'Fakturę zaakceptowaną zmienia tylko Administrator HHL'
          using errcode = '42501';
      end if;
    else
      if org = old.issuer_org_id then
        v_can_edit := true;
      elsif v_role = 'HHL_ADMIN' then
        v_can_edit := true;
      end if;
      if v_can_edit is not true then
        if old.direction = 'KOSZT' then
          raise exception 'Fakturę przewoźnika zmienia przewoźnik albo Administrator HHL'
            using errcode = '42501';
        end if;
        raise exception 'Nie masz uprawnień do zmiany tej faktury' using errcode = '42501';
      end if;
    end if;
  end if;

  if verifier_changed then
    /* Wystawca: tylko powrót do DO_WERYFIKACJI z update_invoice (F7 B3). */
    if org = old.issuer_org_id then
      if v_edit_ctx is true
         and new.verification_status = 'DO_WERYFIKACJI'
         and old.verification_status in ('SPORNA', 'ZGODNA', 'DO_WERYFIKACJI') then
        null;
      else
        raise exception 'Wystawca nie weryfikuje własnej faktury — spór klienta rozstrzyga rozmowa, nie przycisk wystawcy';
      end if;
    elsif (org = old.recipient_org_id or is_hhl()) is not true then
      raise exception 'Weryfikację robi odbiorca faktury' using errcode = '42501';
    end if;
  end if;

  /* Odbiorca nie zmienia treści — wyjątek: HHL_ADMIN na fakturze SCX (F7 B2). */
  if org = old.recipient_org_id and issuer_changed and (v_role = 'HHL_ADMIN') is not true then
    raise exception 'Odbiorca faktury może ją weryfikować, nie zmieniać jej treści';
  end if;

  return new;
end $$;

-- ---------------------------------------------------------------------
-- register_invoice (A4)
-- ---------------------------------------------------------------------
create or replace function public.register_invoice(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := current_org_id();
  v_kind text := current_org_kind()::text;
  v_dir text := p->>'direction';
  v_cur text := upper(coalesce(p->>'currency', ''));
  v_week text := p->>'week_key';
  v_issue date := (p->>'issue_date')::date;
  v_doc uuid := nullif(p->>'document_id', '')::uuid;
  v_project uuid; v_issuer uuid; v_recipient uuid; v_carrier uuid;
  v_term int; v_due date; v_id uuid; v_uid uuid := current_app_user_id();
  ln jsonb; v_load record; v_flags text[]; v_rule_no text; v_rule_mid numeric; v_rule_date date;
  v_exp numeric; v_net numeric; v_fuel numeric;
  v_fx_mid numeric; v_fx_no text; v_fx_date date; v_eur numeric; v_n int := 0;
  v_missing uuid[]; v_hdr text[] := '{}';
  v_net_sum numeric := 0; v_vat numeric; v_gross numeric;
  v_net_in numeric; v_vat_in numeric; v_gross_in numeric;
  v_cmr uuid; v_code text;
begin
  if v_org is null then raise exception 'Brak konta organizacji' using errcode = '42501'; end if;
  if v_kind = 'CLIENT' then
    raise exception 'KSH nie wystawia faktur' using errcode = '42501';
  end if;
  if v_dir not in ('KOSZT','PRZYCHOD') then raise exception 'Kierunek faktury: KOSZT albo PRZYCHOD'; end if;
  if v_cur not in ('EUR','PLN') then raise exception 'Waluta faktury: EUR albo PLN (wybór wystawcy)'; end if;
  if coalesce(btrim(p->>'invoice_number'), '') = '' then raise exception 'Numer faktury jest wymagany'; end if;
  if v_issue is null then raise exception 'Data wystawienia jest wymagana'; end if;
  if v_week !~ '^\d{4}-W\d{2}$' then raise exception 'Tydzień faktury w formacie RRRR-Www'; end if;
  if v_doc is null then raise exception 'Plik PDF faktury jest wymagany'; end if;
  if jsonb_array_length(coalesce(p->'lines', '[]'::jsonb)) = 0 then raise exception 'Faktura bez pozycji'; end if;

  select l.project_id into v_project from loads l where l.id = ((p->'lines'->0)->>'load_id')::uuid;
  if v_project is null then raise exception 'Transport pozycji nie istnieje'; end if;
  if v_dir = 'KOSZT' then
    if v_kind <> 'CARRIER' then raise exception 'Fakturę kosztową rejestruje przewoźnik (wystawca)' using errcode = '42501'; end if;
    v_issuer := v_org; v_carrier := v_org;
    select id into v_recipient from organizations where kind = 'FORWARDER' order by code limit 1;
  else
    if (is_hhl() is not true) then raise exception 'Fakturę przychodową rejestruje HHL (wystawca)' using errcode = '42501'; end if;
    v_issuer := v_org;
    select client_org_id into v_recipient from projects where id = v_project;
  end if;
  if v_recipient is null then raise exception 'Brak odbiorcy faktury'; end if;
  if not exists (select 1 from documents d where d.id = v_doc and d.category = 'INVOICE'
                  and (d.uploaded_by = v_uid or is_hhl())) then
    raise exception 'Plik PDF faktury: nieznany dokument albo nie Twój';
  end if;

  select t.term_days into v_term from payment_terms t
   where t.project_id = v_project and t.payer_org_id = v_recipient and t.payee_org_id = v_issuer
     and t.valid_from <= v_issue order by t.valid_from desc limit 1;
  v_term := coalesce(v_term, case v_dir when 'PRZYCHOD' then 30 else 35 end);
  v_due := coalesce(nullif(p->>'due_date', '')::date, v_issue + v_term);
  if v_due < v_issue then
    raise exception 'Termin płatności nie może być wcześniejszy niż data wystawienia';
  end if;

  for ln in select * from jsonb_array_elements(p->'lines') loop
    v_net_sum := v_net_sum + coalesce((ln->>'invoiced_net')::numeric, 0);
  end loop;
  v_vat := round(v_net_sum * 0.23, 2);
  v_gross := v_net_sum + v_vat;
  v_net_in := (p->>'net_total')::numeric;
  v_vat_in := (p->>'vat_total')::numeric;
  v_gross_in := (p->>'gross_total')::numeric;
  if v_net_in is null then
    raise exception 'Netto faktury jest wymagane';
  end if;
  if abs(coalesce(v_net_in, 0) - v_net_sum) >= 0.01 then
    raise exception 'Suma netto pozycji (% zł) nie zgadza się z netto faktury', v_net_sum;
  end if;
  if v_vat_in is not null and abs(v_vat_in - v_vat) >= 0.01 then
    raise exception 'VAT liczy baza (23 %%): oczekiwane %, podano %', v_vat, v_vat_in;
  end if;
  if v_gross_in is not null and abs(v_gross_in - v_gross) >= 0.01 then
    raise exception 'Brutto liczy baza: oczekiwane %, podano %', v_gross, v_gross_in;
  end if;

  perform set_config('tower.register_invoice', 'on', true);

  insert into invoices (project_id, carrier_org_id, period_start, period_end, currency, direction,
                        issuer_org_id, recipient_org_id, invoice_number, issue_date, receipt_date, week_key,
                        net_total, vat_total, gross_total, invoiced_amount, due_date, due_date_from_document,
                        document_id, status, submitted_by, submitted_at)
  values (v_project, v_carrier, to_date(v_week, 'IYYY-"W"IW'), to_date(v_week, 'IYYY-"W"IW') + 6, v_cur, v_dir,
          v_issuer, v_recipient, btrim(p->>'invoice_number'), v_issue, nullif(p->>'receipt_date', '')::date, v_week,
          v_net_sum, v_vat, v_gross, v_net_sum,
          v_due, nullif(p->>'due_date', '') is not null, v_doc, 'SUBMITTED', v_uid, now())
  returning id into v_id;

  for ln in select * from jsonb_array_elements(p->'lines') loop
    select l.id, l.project_id, l.carrier_org_id, l.actual_delivery_at, l.status, l.order_no,
           coalesce((select min(si.shipment_code) from shipment_items si where si.load_id = l.id), l.order_no) as code,
           (case v_dir when 'KOSZT' then c.computed_total_eur else r.computed_total_eur end) as computed_eur,
           (case v_dir when 'KOSZT' then c.baf_amount else r.baf_amount end) as baf_eur,
           (case v_dir when 'KOSZT' then c.fx_table_no else r.fx_table_no end) as snap_no,
           (case v_dir when 'KOSZT' then c.fx_rate_pln else r.fx_rate_pln end) as snap_mid,
           (case v_dir when 'KOSZT' then c.fx_effective_date else r.fx_effective_date end) as snap_date
      into v_load
      from loads l
      left join load_cost c on c.load_id = l.id
      left join load_revenue r on r.load_id = l.id
     where l.id = (ln->>'load_id')::uuid;
    if v_load.id is null or v_load.project_id <> v_project then
      raise exception 'Pozycja: transport spoza projektu faktury';
    end if;
    if v_dir = 'KOSZT' and v_load.carrier_org_id is distinct from v_issuer then
      raise exception 'Pozycja: transport innego przewoźnika' using errcode = '42501';
    end if;
    if (v_load.status in ('READY_TO_INVOICE', 'INVOICED')) is not true then
      raise exception 'Transport % czeka na CMR', coalesce(v_load.code, v_load.order_no, v_load.id::text);
    end if;
    v_cmr := public.c17_cmr_after_delivery(v_load.id);
    if v_cmr is null then
      raise exception 'Transport % czeka na CMR', coalesce(v_load.code, v_load.order_no, v_load.id::text);
    end if;

    v_flags := '{}';
    v_net := (ln->>'invoiced_net')::numeric;
    v_fuel := nullif(ln->>'invoiced_fuel', '')::numeric;
    v_fx_no := nullif(ln->>'fx_table_no', '');
    v_fx_mid := nullif(ln->>'fx_mid', '')::numeric;
    v_fx_date := nullif(ln->>'fx_effective_date', '')::date;
    if invoice_week_local(v_load.actual_delivery_at) is distinct from v_week then
      v_flags := array_append(v_flags, 'ZLY_TYDZIEN');
    end if;
    v_rule_no := null; v_rule_mid := null; v_rule_date := null;
    if v_load.snap_no is not null then
      v_rule_no := v_load.snap_no; v_rule_mid := v_load.snap_mid; v_rule_date := v_load.snap_date;
    elsif v_load.actual_delivery_at is not null then
      begin
        select f.table_no, f.rate_pln, f.rate_date into v_rule_no, v_rule_mid, v_rule_date
          from fx_rate_before((v_load.actual_delivery_at at time zone 'Europe/Warsaw')::date) f;
      exception when others then
        v_rule_no := null; v_rule_mid := null; v_rule_date := null;
      end;
    end if;
    if v_cur = 'PLN' and v_fx_mid is null then
      v_flags := array_append(v_flags, 'BRAK_KURSU');
    end if;
    if v_fx_mid is not null and v_rule_no is not null then
      if v_fx_no is distinct from v_rule_no then v_flags := array_append(v_flags, 'TABELA_NBP'); end if;
      if abs(v_fx_mid - v_rule_mid) > 0.00005 then v_flags := array_append(v_flags, 'KURS_NBP'); end if;
      if v_fx_date is distinct from v_rule_date then v_flags := array_append(v_flags, 'DATA_KURSU'); end if;
    end if;
    v_exp := null;
    if v_load.computed_eur is not null then
      v_exp := case v_cur
        when 'EUR' then round(v_load.computed_eur, 2)
        else case when v_rule_mid is not null then round(v_load.computed_eur * v_rule_mid, 2) end
      end;
      if v_exp is not null and abs(v_net - v_exp) >= 0.01 then
        v_flags := array_append(v_flags, 'KWOTA');
      end if;
    end if;
    if v_fuel is not null and v_load.baf_eur is not null then
      v_eur := case v_cur
        when 'EUR' then round(v_load.baf_eur, 2)
        else case when v_rule_mid is not null then round(v_load.baf_eur * v_rule_mid, 2) end
      end;
      if v_eur is not null and abs(v_fuel - v_eur) >= 0.01 then
        v_flags := array_append(v_flags, 'OPLATA_PALIWOWA');
      end if;
    end if;
    if coalesce((ln->'flags') ? 'OPLATA_PALIWOWA', false) and not ('OPLATA_PALIWOWA' = any (v_flags)) then
      v_flags := array_append(v_flags, 'OPLATA_PALIWOWA');
    end if;
    if coalesce((ln->'flags') ? 'KWOTA', false) and not ('KWOTA' = any (v_flags)) then
      v_flags := array_append(v_flags, 'KWOTA');
    end if;

    begin
      insert into invoice_lines (
        invoice_id, load_id, direction, expected_amount, invoiced_amount, invoiced_net,
        invoiced_fuel, fx_table_no, fx_mid, fx_effective_date, flags
      ) values (
        v_id, v_load.id, v_dir, v_exp, v_net, v_net, v_fuel,
        v_fx_no, v_fx_mid, v_fx_date, v_flags
      );
    exception when unique_violation then
      raise exception 'Transport jest już na innej fakturze tego kierunku — podwójne fakturowanie zablokowane';
    end;

    v_eur := case v_cur
      when 'EUR' then v_net
      else case when v_fx_mid > 0 then round(v_net / v_fx_mid, 2) end
    end;
    if v_eur is not null then
      if v_dir = 'KOSZT' then
        update load_cost set invoiced_total_eur = v_eur, pricing_tier = 'FAKTURA' where load_id = v_load.id;
      else
        update load_revenue set invoiced_total_eur = v_eur, pricing_tier = 'FAKTURA' where load_id = v_load.id;
      end if;
    end if;

    insert into invoice_documents (invoice_id, document_id, role)
    values (v_id, v_cmr, 'CMR')
    on conflict do nothing;
    insert into invoice_documents (invoice_id, document_id, role)
    select v_id, d.id, 'POD' from documents d
     where d.load_id = v_load.id and d.category = 'POD'
       and d.superseded_at is null and d.purged_at is null
    on conflict do nothing;
    v_n := v_n + 1;
  end loop;

  insert into invoice_documents (invoice_id, document_id, role) values (v_id, v_doc, 'FAKTURA_PDF')
  on conflict do nothing;

  select coalesce(array_agg(l.id), '{}') into v_missing from loads l
   where l.project_id = v_project
     and l.status = 'READY_TO_INVOICE'
     and l.actual_delivery_at is not null
     and invoice_week_local(l.actual_delivery_at) = v_week
     and (v_dir = 'PRZYCHOD' or l.carrier_org_id = v_issuer)
     and not exists (select 1 from invoice_lines x where x.load_id = l.id and x.direction = v_dir);
  if cardinality(v_missing) > 0 then
    v_hdr := array_append(v_hdr, 'BRAK_NA_FAKTURZE');
  end if;
  update invoices set check_flags = v_hdr, missing_load_ids = v_missing where id = v_id;

  insert into notifications (channel, recipient, user_id, template, payload, dedup_key)
  select 'IN_APP', coalesce(u.email::text, u.id::text), u.id, 'INVOICE_NEW',
         jsonb_build_object(
           'invoice_id', v_id, 'number', btrim(p->>'invoice_number'), 'week', v_week,
           'currency', v_cur, 'gross', v_gross, 'due', v_due, 'locale', u.locale
         ),
         'INVOICE_NEW:' || v_id || ':' || u.id
    from app_users u where u.org_id = v_recipient and u.active
  on conflict (dedup_key) where dedup_key is not null do nothing;

  insert into audit_log (user_id, action, entity, entity_id, new_value)
  values (v_uid, 'INVOICE_REGISTER', 'invoices', v_id::text,
          jsonb_build_object('direction', v_dir, 'number', btrim(p->>'invoice_number'), 'lines', v_n, 'currency', v_cur));
  return v_id;
end $$;

revoke all on function public.register_invoice(jsonb) from public, anon;
grant execute on function public.register_invoice(jsonb) to authenticated;

comment on function public.register_invoice(jsonb) is
  'A4: READY_TO_INVOICE + CMR po dostawie, VAT 23% w bazie, tolerancja 0, INVOICE_NEW także KOSZT.';

-- ---------------------------------------------------------------------
-- update_invoice (D-20261020-0115-01)
-- ---------------------------------------------------------------------
create or replace function public.update_invoice(
  p_invoice uuid,
  p_patch jsonb,
  p_lines jsonb default null,
  p_note text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  inv invoices%rowtype;
  v_me uuid := current_app_user_id();
  v_org uuid := current_org_id();
  v_role text := current_app_role()::text;
  v_kind text := current_org_kind()::text;
  v_accepted boolean;
  v_is_issuer boolean;
  v_is_admin boolean := (v_role = 'HHL_ADMIN');
  v_old jsonb;
  v_new jsonb;
  v_net_sum numeric := 0;
  v_vat numeric;
  v_gross numeric;
  v_due date;
  v_issue date;
  v_doc uuid;
  v_cur text;
  v_week text;
  v_number text;
  v_receipt date;
  v_due_from_doc boolean;
  ln jsonb;
  v_load record;
  v_flags text[];
  v_rule_no text; v_rule_mid numeric; v_rule_date date;
  v_exp numeric; v_net numeric; v_fuel numeric;
  v_fx_mid numeric; v_fx_no text; v_fx_date date; v_eur numeric;
  v_cmr uuid;
  v_old_loads uuid[];
  v_new_loads uuid[];
  v_lid uuid;
  v_tpl text;
  v_notify_org uuid;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_actor text;
begin
  if (v_me is not null) is not true then
    raise exception 'Brak aktywnego konta' using errcode = '42501';
  end if;
  if (p_invoice is not null) is not true or (p_patch is not null) is not true then
    raise exception 'Brak danych faktury' using errcode = '22023';
  end if;

  select * into inv from invoices where id = p_invoice for update;
  if not found then
    raise exception 'Nieznana faktura' using errcode = 'P0002';
  end if;

  v_accepted := (inv.verification_status = 'ZAAKCEPTOWANA');
  v_is_issuer := (v_org = inv.issuer_org_id);

  if v_kind = 'CLIENT' then
    raise exception 'KSH nie zmienia faktur — może je zaakceptować albo zgłosić spór'
      using errcode = '42501';
  end if;

  if v_accepted then
    if v_is_admin is not true then
      raise exception 'Fakturę zaakceptowaną zmienia tylko Administrator HHL'
        using errcode = '42501';
    end if;
  else
    if v_is_issuer then
      null; -- SCX swoją / HHL swoją (także HHL_OPS na PRZYCHOD)
    elsif v_is_admin then
      null; -- HHL_ADMIN na fakturze SCX (także jako odbiorca)
    else
      if inv.direction = 'KOSZT' then
        raise exception 'Fakturę przewoźnika zmienia przewoźnik albo Administrator HHL'
          using errcode = '42501';
      end if;
      raise exception 'Nie masz uprawnień do zmiany tej faktury' using errcode = '42501';
    end if;
  end if;

  perform set_config('tower.invoice_edit', 'on', true);

  select coalesce(nullif(btrim(u.full_name), ''), split_part(u.email::text, '@', 1), '—')
         || ' // ' || coalesce(nullif(btrim(o.name), ''), nullif(btrim(o.code), ''), '—')
    into v_actor
    from app_users u
    left join organizations o on o.id = u.org_id
   where u.id = v_me;

  v_old := to_jsonb(inv) - 'id';
  v_number := btrim(coalesce(p_patch->>'invoice_number', ''));
  v_issue := (p_patch->>'issue_date')::date;
  v_receipt := nullif(p_patch->>'receipt_date', '')::date;
  v_week := p_patch->>'week_key';
  v_cur := upper(coalesce(p_patch->>'currency', ''));
  v_due := (p_patch->>'due_date')::date;
  v_due_from_doc := coalesce((p_patch->>'due_date_from_document')::boolean, false);
  v_doc := nullif(p_patch->>'document_id', '')::uuid;

  if v_number = '' then raise exception 'Numer faktury jest wymagany'; end if;
  if v_issue is null then raise exception 'Data wystawienia jest wymagana'; end if;
  if v_week !~ '^\d{4}-W\d{2}$' then raise exception 'Tydzień faktury w formacie RRRR-Www'; end if;
  if v_cur not in ('EUR','PLN') then raise exception 'Waluta faktury: EUR albo PLN'; end if;
  if v_due is null then raise exception 'Termin płatności jest wymagany'; end if;
  if v_due < v_issue then
    raise exception 'Termin płatności nie może być wcześniejszy niż data wystawienia';
  end if;
  if v_doc is null then raise exception 'Plik PDF faktury jest wymagany'; end if;
  if not exists (
    select 1 from documents d
     where d.id = v_doc and d.category = 'INVOICE'
       and (d.uploaded_by = v_me or is_hhl() or d.id = inv.document_id)
  ) then
    raise exception 'Plik PDF faktury: nieznany dokument albo nie Twój';
  end if;

  select coalesce(array_agg(load_id), '{}') into v_old_loads
    from invoice_lines where invoice_id = p_invoice;

  if p_lines is not null then
    if jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines) = 0 then
      raise exception 'Faktura bez pozycji';
    end if;
    for ln in select * from jsonb_array_elements(p_lines) loop
      v_net_sum := v_net_sum + coalesce((ln->>'invoiced_net')::numeric, 0);
    end loop;
  else
    select coalesce(sum(invoiced_net), 0) into v_net_sum
      from invoice_lines where invoice_id = p_invoice;
  end if;

  v_vat := round(v_net_sum * 0.23, 2);
  v_gross := v_net_sum + v_vat;
  if p_patch ? 'net_total' and abs(coalesce((p_patch->>'net_total')::numeric, 0) - v_net_sum) >= 0.01 then
    raise exception 'Suma netto pozycji nie zgadza się z netto faktury';
  end if;
  if p_patch ? 'vat_total' and (p_patch->>'vat_total') is not null
     and abs((p_patch->>'vat_total')::numeric - v_vat) >= 0.01 then
    raise exception 'VAT liczy baza (23 %%): oczekiwane %, podano %', v_vat, (p_patch->>'vat_total')::numeric;
  end if;
  if p_patch ? 'gross_total' and (p_patch->>'gross_total') is not null
     and abs((p_patch->>'gross_total')::numeric - v_gross) >= 0.01 then
    raise exception 'Brutto liczy baza: oczekiwane %, podano %', v_gross, (p_patch->>'gross_total')::numeric;
  end if;

  if v_doc is distinct from inv.document_id then
    update documents set superseded_at = now()
     where id = inv.document_id and superseded_at is null;
  end if;

  update invoices set
    invoice_number = v_number,
    issue_date = v_issue,
    receipt_date = v_receipt,
    week_key = v_week,
    currency = v_cur,
    net_total = v_net_sum,
    vat_total = v_vat,
    gross_total = v_gross,
    invoiced_amount = v_net_sum,
    due_date = v_due,
    due_date_from_document = v_due_from_doc,
    document_id = v_doc,
    period_start = to_date(v_week, 'IYYY-"W"IW'),
    period_end = to_date(v_week, 'IYYY-"W"IW') + 6,
    verification_status = case
      when v_accepted then verification_status
      when v_is_issuer and verification_status in ('SPORNA', 'ZGODNA') then 'DO_WERYFIKACJI'
      when v_is_issuer then 'DO_WERYFIKACJI'
      else verification_status
    end
  where id = p_invoice;

  if p_lines is not null then
    /* Stare pozycje w audycie (F7 P8). */
    v_old := v_old || jsonb_build_object(
      'lines', coalesce((
        select jsonb_agg(to_jsonb(il) - 'invoice_id' order by il.load_id)
          from invoice_lines il where il.invoice_id = p_invoice
      ), '[]'::jsonb)
    );
    delete from invoice_lines where invoice_id = p_invoice;
    delete from invoice_documents where invoice_id = p_invoice and role = 'CMR';
    /* POD zostaje (F7 P8). */

    for ln in select * from jsonb_array_elements(p_lines) loop
      select l.id, l.project_id, l.carrier_org_id, l.actual_delivery_at, l.status, l.order_no,
             coalesce((select min(si.shipment_code) from shipment_items si where si.load_id = l.id), l.order_no) as code,
             (case inv.direction when 'KOSZT' then c.computed_total_eur else r.computed_total_eur end) as computed_eur,
             (case inv.direction when 'KOSZT' then c.baf_amount else r.baf_amount end) as baf_eur,
             (case inv.direction when 'KOSZT' then c.fx_table_no else r.fx_table_no end) as snap_no,
             (case inv.direction when 'KOSZT' then c.fx_rate_pln else r.fx_rate_pln end) as snap_mid,
             (case inv.direction when 'KOSZT' then c.fx_effective_date else r.fx_effective_date end) as snap_date
        into v_load
        from loads l
        left join load_cost c on c.load_id = l.id
        left join load_revenue r on r.load_id = l.id
       where l.id = (ln->>'load_id')::uuid;
      if v_load.id is null or v_load.project_id <> inv.project_id then
        raise exception 'Pozycja: transport spoza projektu faktury';
      end if;
      if inv.direction = 'KOSZT' and v_load.carrier_org_id is distinct from inv.issuer_org_id then
        raise exception 'Pozycja: transport innego przewoźnika' using errcode = '42501';
      end if;
      /* Pozycja bez zmian (load_id + netto + paliwo) — bez ponownego CMR/stanu (F7 P8). */
      if (v_load.id = any (v_old_loads)) is true
         and exists (
           select 1 from jsonb_array_elements(coalesce(v_old->'lines', '[]'::jsonb)) o(x)
            where (o.x->>'load_id')::uuid = v_load.id
              and abs(coalesce((o.x->>'invoiced_net')::numeric, 0)
                    - coalesce((ln->>'invoiced_net')::numeric, 0)) < 0.005
              and coalesce((o.x->>'invoiced_fuel')::numeric, -1)
                  is not distinct from coalesce(nullif(ln->>'invoiced_fuel', '')::numeric, -1)
         ) then
        v_cmr := public.c17_cmr_after_delivery(v_load.id);
        if v_cmr is null then
          select d.id into v_cmr from documents d
           where d.load_id = v_load.id and d.category = 'CMR'
             and d.superseded_at is null and d.purged_at is null
           order by d.uploaded_at desc nulls last limit 1;
        end if;
      else
        if (v_load.status in ('READY_TO_INVOICE', 'INVOICED')) is not true then
          raise exception 'Transport % czeka na CMR', coalesce(v_load.code, v_load.order_no, v_load.id::text);
        end if;
        v_cmr := public.c17_cmr_after_delivery(v_load.id);
        if v_cmr is null then
          raise exception 'Transport % czeka na CMR', coalesce(v_load.code, v_load.order_no, v_load.id::text);
        end if;
      end if;

      v_flags := '{}';
      v_net := (ln->>'invoiced_net')::numeric;
      v_fuel := nullif(ln->>'invoiced_fuel', '')::numeric;
      v_fx_no := nullif(ln->>'fx_table_no', '');
      v_fx_mid := nullif(ln->>'fx_mid', '')::numeric;
      v_fx_date := nullif(ln->>'fx_effective_date', '')::date;
      if invoice_week_local(v_load.actual_delivery_at) is distinct from v_week then
        v_flags := array_append(v_flags, 'ZLY_TYDZIEN');
      end if;
      v_rule_no := null; v_rule_mid := null; v_rule_date := null;
      if v_load.snap_no is not null then
        v_rule_no := v_load.snap_no; v_rule_mid := v_load.snap_mid; v_rule_date := v_load.snap_date;
      elsif v_load.actual_delivery_at is not null then
        begin
          select f.table_no, f.rate_pln, f.rate_date into v_rule_no, v_rule_mid, v_rule_date
            from fx_rate_before((v_load.actual_delivery_at at time zone 'Europe/Warsaw')::date) f;
        exception when others then
          v_rule_no := null; v_rule_mid := null; v_rule_date := null;
        end;
      end if;
      if v_cur = 'PLN' and v_fx_mid is null then
        v_flags := array_append(v_flags, 'BRAK_KURSU');
      end if;
      if v_fx_mid is not null and v_rule_no is not null then
        if v_fx_no is distinct from v_rule_no then v_flags := array_append(v_flags, 'TABELA_NBP'); end if;
        if abs(v_fx_mid - v_rule_mid) > 0.00005 then v_flags := array_append(v_flags, 'KURS_NBP'); end if;
        if v_fx_date is distinct from v_rule_date then v_flags := array_append(v_flags, 'DATA_KURSU'); end if;
      end if;
      v_exp := null;
      if v_load.computed_eur is not null then
        v_exp := case v_cur
          when 'EUR' then round(v_load.computed_eur, 2)
          else case when v_rule_mid is not null then round(v_load.computed_eur * v_rule_mid, 2) end
        end;
        if v_exp is not null and abs(v_net - v_exp) >= 0.01 then
          v_flags := array_append(v_flags, 'KWOTA');
        end if;
      end if;
      if v_fuel is not null and v_load.baf_eur is not null then
        v_eur := case v_cur
          when 'EUR' then round(v_load.baf_eur, 2)
          else case when v_rule_mid is not null then round(v_load.baf_eur * v_rule_mid, 2) end
        end;
        if v_eur is not null and abs(v_fuel - v_eur) >= 0.01 then
          v_flags := array_append(v_flags, 'OPLATA_PALIWOWA');
        end if;
      end if;
      if coalesce((ln->'flags') ? 'OPLATA_PALIWOWA', false) and not ('OPLATA_PALIWOWA' = any (v_flags)) then
        v_flags := array_append(v_flags, 'OPLATA_PALIWOWA');
      end if;

      begin
        insert into invoice_lines (
          invoice_id, load_id, direction, expected_amount, invoiced_amount, invoiced_net,
          invoiced_fuel, fx_table_no, fx_mid, fx_effective_date, flags
        ) values (
          p_invoice, v_load.id, inv.direction, v_exp, v_net, v_net, v_fuel,
          v_fx_no, v_fx_mid, v_fx_date, v_flags
        );
      exception when unique_violation then
        raise exception 'Transport jest już na innej fakturze tego kierunku — podwójne fakturowanie zablokowane';
      end;

      v_eur := case v_cur when 'EUR' then v_net else case when v_fx_mid > 0 then round(v_net / v_fx_mid, 2) end end;
      if v_eur is not null then
        if inv.direction = 'KOSZT' then
          update load_cost set invoiced_total_eur = v_eur, pricing_tier = 'FAKTURA' where load_id = v_load.id;
        else
          update load_revenue set invoiced_total_eur = v_eur, pricing_tier = 'FAKTURA' where load_id = v_load.id;
        end if;
      end if;

      if v_cmr is not null then
        insert into invoice_documents (invoice_id, document_id, role)
        values (p_invoice, v_cmr, 'CMR') on conflict do nothing;
      end if;
    end loop;

    select coalesce(array_agg(load_id), '{}') into v_new_loads
      from invoice_lines where invoice_id = p_invoice;

    foreach v_lid in array v_old_loads loop
      if (v_lid = any (v_new_loads)) is not true then
        if inv.direction = 'KOSZT' then
          update load_cost set invoiced_total_eur = null where load_id = v_lid;
        else
          update load_revenue set invoiced_total_eur = null where load_id = v_lid;
        end if;
        perform public.c17_try_billing_status(v_lid, '{}'::jsonb);
        /* usunięty → READY_TO_INVOICE ze ścieżką statusu + load_events (F7 B2).
           source: enum position_source — bez SYSTEM; jak C17. */
        if exists (select 1 from loads l where l.id = v_lid and l.status = 'INVOICED')
           and public.c17_invoice_pair_ok(v_lid) is null then
          perform set_config('tower.status_ctx', 'on', true);
          update loads set status = 'READY_TO_INVOICE', updated_at = now()
           where id = v_lid and status = 'INVOICED';
          insert into load_events (load_id, event_type, occurred_at, payload, dedup_key)
          values (
            v_lid, 'STATUS_AUTO', now(),
            jsonb_build_object(
              'from', 'INVOICED', 'to', 'READY_TO_INVOICE',
              'powod', 'usunięcie z faktury', 'actor', v_actor, 'source', 'INVOICE_EDIT'
            ),
            'STATUS_AUTO:' || v_lid || ':READY_TO_INVOICE:' || p_invoice::text
              || ':' || extract(epoch from clock_timestamp())::bigint
          )
          on conflict (dedup_key) where dedup_key is not null do nothing;
        end if;
      end if;
    end loop;
    foreach v_lid in array v_new_loads loop
      perform public.c17_try_billing_status(v_lid, '{}'::jsonb);
    end loop;
  end if;

  insert into invoice_documents (invoice_id, document_id, role)
  values (p_invoice, v_doc, 'FAKTURA_PDF')
  on conflict do nothing;

  if (v_accepted is not true) and v_is_issuer then
    insert into invoice_dispute_events (invoice_id, kind, status_to, note, actor_user, actor_org)
    values (p_invoice, 'CORRECTION', 'DO_WERYFIKACJI', coalesce(v_note, 'korekta wystawcy'), v_me, v_org);
  end if;

  select * into inv from invoices where id = p_invoice;
  v_new := to_jsonb(inv) - 'id';

  insert into audit_log (user_id, action, entity, entity_id, old_value, new_value)
  values (
    v_me, 'INVOICE_UPDATE', 'invoices', p_invoice::text, v_old,
    v_new || jsonb_build_object('note', v_note, 'actor', v_actor)
  );

  /* P5: INVOICE_CORRECTED do drugiej strony; HHL_ADMIN na KOSZT → wystawca SCX. */
  if v_accepted or (v_is_admin and v_is_issuer is not true) then
    v_tpl := 'INVOICE_CORRECTED';
    v_notify_org := case when v_is_issuer then inv.recipient_org_id else inv.issuer_org_id end;
  elsif v_is_issuer then
    v_tpl := 'INVOICE_UPDATED';
    v_notify_org := inv.recipient_org_id;
  else
    v_tpl := 'INVOICE_CORRECTED';
    v_notify_org := inv.issuer_org_id;
  end if;

  /* P6: macierz inv_updated / inv_corrected + matrix_notify (load z pozycji zawęża CARRIER). */
  select load_id into v_lid from invoice_lines where invoice_id = p_invoice order by load_id limit 1;
  perform public.matrix_notify(
    'MONEY',
    v_tpl,
    v_lid,
    inv.project_id,
    jsonb_build_object(
      'invoice_id', inv.id,
      'number', inv.invoice_number,
      'week', inv.week_key,
      'amount', inv.gross_total,
      'currency', inv.currency,
      'due', inv.due_date,
      'firm', split_part(v_actor, ' // ', 2),
      'note', v_note
    ),
    v_tpl || ':' || inv.id || ':' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS'),
    (select o.kind::text from organizations o where o.id = v_notify_org)
  );

  return jsonb_build_object('id', inv.id, 'verification_status', inv.verification_status,
                            'net_total', inv.net_total, 'vat_total', inv.vat_total, 'gross_total', inv.gross_total);
end $$;

revoke all on function public.update_invoice(uuid, jsonb, jsonb, text) from public, anon;
grant execute on function public.update_invoice(uuid, jsonb, jsonb, text) to authenticated;

comment on function public.update_invoice(uuid, jsonb, jsonb, text) is
  'A4 / D-0115: edycja faktury — pełny nagłówek, VAT w bazie, role SCX/HHL/HHL_ADMIN.';

/* F7 B2: SCX może cofnąć INVOICED → READY_TO_INVOICE w kontekście update_invoice. */
create or replace function public.guard_load_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_changed  text[];
  v_bad      text[];
  v_ctx      text;
  v_carrier  text[] := array[
    'tractor_plate','trailer_plate','trailer_type','driver_name','driver_phone',
    'escort_vehicles','telematics_vehicle_id','telematics_provider',
    'ferry_booking_ref','sailing_id','carrier_order_no',
    'combo_length_m','combo_width_m','combo_height_m','combo_weight_t',
    'actual_load_at','actual_delivery_at','status','updated_at'];
begin
  if current_setting('tower.eta_ctx', true) = 'on' then
    select coalesce(array_agg(n.key), '{}') into v_changed
      from jsonb_each(to_jsonb(new)) n
     where n.value is distinct from (to_jsonb(old) -> n.key);
    if (v_changed <@ array['eta_site','eta_confidence_min','eta_basis','eta_computed_at','delay_minutes','updated_at']::text[]) is not true then
      raise exception 'Przeliczenie ETA może zmienić wyłącznie kolumny eta_* (zmienione: %)', array_to_string(v_changed, ', ');
    end if;
    return new;
  end if;

  if current_setting('tower.track_ctx', true) = 'on' then
    select coalesce(array_agg(n.key), '{}') into v_changed
      from jsonb_each(to_jsonb(new)) n
     where n.value is distinct from (to_jsonb(old) -> n.key);
    if (v_changed <@ array['tracking_opened_at','updated_at']::text[]) is not true then
      raise exception 'Okno śledzenia może zmienić wyłącznie tracking_opened_at (zmienione: %)', array_to_string(v_changed, ', ');
    end if;
    return new;
  end if;

  if current_setting('tower.dates_ctx', true) = 'on' then
    select coalesce(array_agg(n.key), '{}') into v_changed
      from jsonb_each(to_jsonb(new)) n
     where n.value is distinct from (to_jsonb(old) -> n.key);
    if (v_changed <@ array['plan_load_date','plan_load_from','plan_load_to','plan_delivery_date','plan_delivery_from','plan_delivery_to',
                           'plan_dates_status','plan_dates_confirmed_by','plan_dates_confirmed_at','tracking_opened_at','updated_at']::text[]) is not true then
      raise exception 'Potwierdzenie dat może zmienić wyłącznie daty planu (zmienione: %)', array_to_string(v_changed, ', ');
    end if;
    return new;
  end if;

  if auth.uid() is not null and (new.plan_dates_status, new.plan_dates_confirmed_by, new.plan_dates_confirmed_at)
       is distinct from (old.plan_dates_status, old.plan_dates_confirmed_by, old.plan_dates_confirmed_at) then
    raise exception 'Status dat planu zmienia wyłącznie potwierdzenie KSH („Potwierdź daty”)';
  end if;

  if new.status = 'CANCELLED' and old.status is distinct from 'CANCELLED' then
    v_ctx := coalesce(current_setting('tower.cancel_ctx', true), '');
    if v_ctx = 'IMPORT' then
      if exists (select 1 from invoice_lines where load_id = old.id) then
        raise exception 'Import nie anuluje transportu na fakturze (%)', coalesce(old.order_no, left(old.id::text, 8));
      end if;
      if old.status not in ('PLANNED','RESOURCES_PENDING','DOCS_PENDING','READY') then
        raise exception 'Import nie anuluje transportu w statusie % — od AT_LOADING wyłącznie HHL ręcznie, z powodem', old.status;
      end if;
    elsif v_ctx = 'MANUAL' then
      null;
    elsif auth.uid() is not null then
      raise exception 'Anulować transport może wyłącznie HHL — przez cancel_load() z powodem albo import harmonogramu';
    end if;
  end if;

  if new.status = 'UNLOADED' and new.actual_delivery_at is null then
    raise exception 'Status UNLOADED wymaga daty rozładunku — to data realizacji usługi';
  end if;

  if new.actual_delivery_at is distinct from old.actual_delivery_at then
    if auth.uid() is not null and is_hhl() is not true
       and exists (select 1 from invoice_lines where load_id = old.id) then
      raise exception 'Data rozładunku transportu na fakturze jest zamrożona — zmiana wyłącznie przez HHL';
    end if;
    insert into audit_log (user_id, action, entity, entity_id, old_value, new_value)
    values ((select id from app_users where auth_id = auth.uid()),
            'LOAD_DELIVERY_DATE_CHANGE', 'loads', old.id::text,
            jsonb_build_object('actual_delivery_at', old.actual_delivery_at),
            jsonb_build_object('actual_delivery_at', new.actual_delivery_at));
  end if;

  if auth.uid() is null then return new; end if;

  v_ctx := coalesce(current_setting('tower.cancel_ctx', true), '');
  if (
    (new.status is distinct from old.status or new.actual_delivery_at is distinct from old.actual_delivery_at)
    and current_setting('tower.status_ctx', true) is distinct from 'on'
    and v_ctx not in ('MANUAL', 'IMPORT')
  ) then
    raise exception 'Status i datę rozładunku zmienia wyłącznie load_status_set albo automat'
      using errcode = '42501';
  end if;

  select coalesce(array_agg(n.key), '{}') into v_changed
    from jsonb_each(to_jsonb(new)) n
   where n.value is distinct from (to_jsonb(old) -> n.key);

  if is_hhl() is true then
    if new.carrier_order_no is distinct from old.carrier_order_no then
      raise exception 'Numer zlecenia przewoźnika wpisuje wyłącznie przewoźnik';
    end if;
    if (
      (new.plan_load_date, new.plan_load_from, new.plan_load_to,
       new.plan_delivery_date, new.plan_delivery_from, new.plan_delivery_to)
      is not distinct from
      (old.plan_load_date, old.plan_load_from, old.plan_load_to,
       old.plan_delivery_date, old.plan_delivery_from, old.plan_delivery_to)
      or current_setting('tower.import_ctx', true) = 'on'
      or current_app_role() = 'HHL_ADMIN'
    ) is not true then
      raise exception 'Daty i godziny załadunku i rozładunku zmienia wyłącznie KSH Użytkownik (G-20)'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if (current_org_kind() = 'CARRIER' and old.carrier_org_id = current_org_id()) is true then
    select coalesce(array_agg(c), '{}') into v_bad from unnest(v_changed) c where c <> all (v_carrier);
    if cardinality(v_bad) > 0 then
      raise exception 'Przewoźnik nie może zmieniać: %', array_to_string(v_bad, ', ');
    end if;
    if new.status is distinct from old.status then
      if new.status = 'CANCELLED' then
        raise exception 'Anulować transport może wyłącznie HHL';
      end if;
      if old.status <> 'CANCELLED' and new.status < old.status then
        /* Edycja faktury: usunięcie pozycji wraca INVOICED → READY_TO_INVOICE. */
        if current_setting('tower.invoice_edit', true) = 'on'
           and old.status = 'INVOICED'
           and new.status = 'READY_TO_INVOICE' then
          null;
        else
          raise exception 'Status nie może się cofnąć: % → %', old.status, new.status;
        end if;
      end if;
    end if;
    if new.sailing_id is distinct from old.sailing_id and old.status >= 'FERRY' then
      raise exception 'Zmiana rejsu po wypłynięciu — wyłącznie HHL';
    end if;
    return new;
  end if;

  raise exception 'Brak uprawnień do zmiany transportu';
end $$;

create or replace function public.load_status_set(
  p_load uuid,
  p_status text,
  p_occurred_at timestamptz,
  p_note text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := current_app_user_id();
  v_role text;
  v_org uuid;
  v_load loads%rowtype;
  v_new load_status;
  v_when timestamptz;
  v_note text := nullif(trim(coalesce(p_note, '')), '');
  v_actor text;
  v_prev_at timestamptz;
  v_missing text;
  v_ev_id bigint;
  v_ev_old timestamptz;
  v_old_load_at timestamptz;
  v_old_del_at timestamptz;
begin
  if (v_me is not null) is not true then
    raise exception 'Brak aktywnego konta' using errcode = '42501';
  end if;
  v_role := current_app_role()::text;
  select org_id into v_org from app_users where id = v_me;
  if (v_role in ('HHL_ADMIN', 'CARRIER_DISPATCH', 'CARRIER_USER')) is not true then
    raise exception 'Zmiana statusu — tylko Administrator HHL albo SCX' using errcode = '42501';
  end if;

  if (p_load is not null) is not true then
    raise exception 'Brak transportu' using errcode = '22023';
  end if;
  if (p_status is not null and length(trim(p_status)) > 0) is not true then
    raise exception 'Brak statusu' using errcode = '22023';
  end if;

  begin
    v_new := trim(p_status)::load_status;
  exception when others then
    raise exception 'Nieznany status' using errcode = '22023';
  end;

  if v_new = 'UNLOADED' then
    v_new := 'DELIVERED';
  end if;

  v_when := coalesce(p_occurred_at, now());
  if v_when > now() + interval '1 minute' and v_role is distinct from 'HHL_ADMIN' then
    raise exception 'Czas statusu nie może być w przyszłości' using errcode = '22023';
  end if;

  select * into v_load from loads where id = p_load for update;
  if not found then
    raise exception 'Nieznany transport' using errcode = 'P0002';
  end if;

  if v_role in ('CARRIER_DISPATCH', 'CARRIER_USER') then
    if (v_load.carrier_org_id is not null and v_load.carrier_org_id = v_org) is not true then
      raise exception 'Status — tylko własny transport SCX' using errcode = '42501';
    end if;
    if v_new = 'CANCELLED' then
      raise exception 'Anulowanie — tylko Administrator HHL' using errcode = '42501';
    end if;
    if public.load_status_rank(v_new) < public.load_status_rank(v_load.status) then
      raise exception 'SCX zmienia status tylko do przodu' using errcode = '22023';
    end if;
  end if;

  if v_new = 'CANCELLED' and (v_note is not null) is not true then
    raise exception 'Anulowanie wymaga powodu' using errcode = '22023';
  end if;

  if public.load_status_rank(v_new) < public.load_status_rank(v_load.status)
     and v_role = 'HHL_ADMIN'
     and (v_note is not null) is not true then
    raise exception 'Cofnięcie statusu wymaga powodu' using errcode = '22023';
  end if;

  if v_new = 'READY_TO_INVOICE' then
    if (public.c17_cmr_after_delivery(p_load) is not null) is not true then
      raise exception 'Gotowe do fakturowania wymaga pliku CMR z podpisem odbiorcy'
        using errcode = '22023';
    end if;
  end if;

  if v_new = 'INVOICED' then
    v_missing := null;
    if (
      exists (select 1 from invoice_lines il where il.load_id = p_load and il.direction = 'KOSZT')
    ) is not true then
      v_missing := 'brak faktury SCX → HHL';
    end if;
    if (
      exists (select 1 from invoice_lines il where il.load_id = p_load and il.direction = 'PRZYCHOD')
    ) is not true then
      v_missing := case
        when v_missing is null then 'brak faktury HHL → KSH'
        else v_missing || ' i brak faktury HHL → KSH'
      end;
    end if;
    if v_missing is not null then
      raise exception 'Zafakturowano — %', v_missing using errcode = '22023';
    end if;
  end if;

  select coalesce(nullif(btrim(u.full_name), ''), split_part(u.email::text, '@', 1), '—')
         || ' // ' || coalesce(nullif(btrim(o.name), ''), nullif(btrim(o.code), ''), '—')
    into v_actor
    from app_users u
    left join organizations o on o.id = u.org_id
   where u.id = v_me;

  if v_load.status is not distinct from v_new and v_role = 'HHL_ADMIN' then
    select e.id, e.occurred_at into v_ev_id, v_ev_old
      from load_events e
     where e.load_id = p_load
       and (
         e.event_type = 'STATUS_' || v_new::text
         or (e.event_type = 'STATUS_AUTO' and e.payload->>'to' = v_new::text)
       )
       and not exists (
         select 1 from load_events z
          where z.load_id = e.load_id
            and z.payload->>'zastepuje' = e.id::text
       )
     order by e.id desc
     limit 1;
    v_old_load_at := v_load.actual_load_at;
    v_old_del_at := v_load.actual_delivery_at;
    if v_ev_id is null then
      v_ev_old := case
        when v_new = 'DELIVERED' then v_load.actual_delivery_at
        when v_new in ('AT_LOADING', 'IN_TRANSIT_PL') then v_load.actual_load_at
        else null
      end;
    end if;
    if v_ev_old is distinct from v_when then
      insert into load_events (load_id, event_type, occurred_at, payload)
      values (
        p_load,
        'STATUS_' || v_new::text,
        v_when,
        jsonb_build_object(
          'korekta', true,
          'zastepuje', v_ev_id,
          'poprzednio', v_ev_old,
          'przez', 'HHL_ADMIN',
          'actor', v_actor,
          'actor_id', v_me,
          'note', v_note
        )
      );
    end if;
    perform set_config('tower.status_ctx', 'on', true);
    update loads
       set actual_delivery_at = case when v_new = 'DELIVERED' then v_when else actual_delivery_at end,
           actual_load_at = case
             when v_new in ('AT_LOADING', 'IN_TRANSIT_PL') then v_when
             else actual_load_at
           end,
           updated_at = now()
     where id = p_load;
    insert into audit_log (user_id, action, entity, entity_id, old_value, new_value)
    values (
      v_me,
      'LOAD_STATUS_SET',
      'loads',
      p_load::text,
      jsonb_build_object(
        'status', v_load.status::text,
        'occurred_at', v_ev_old,
        'actual_load_at', v_old_load_at,
        'actual_delivery_at', v_old_del_at
      ),
      jsonb_build_object(
        'status', v_new::text,
        'occurred_at', v_when,
        'note', v_note,
        'time_only', true
      )
    );
    return;
  end if;

  if v_load.status is not distinct from v_new then
    if (
      v_role in ('CARRIER_DISPATCH', 'CARRIER_USER')
      and v_new = 'DELIVERED'
      and v_load.actual_delivery_at is distinct from v_when
    ) is not true then
      select e.occurred_at into v_ev_old
        from load_events e
       where e.load_id = p_load
         and e.event_type = 'STATUS_' || v_new::text
         and not exists (
           select 1 from load_events z
            where z.load_id = e.load_id
              and z.payload->>'zastepuje' = e.id::text
         )
       order by e.id desc
       limit 1;
      if (v_ev_old is not null and v_when is distinct from v_ev_old)
         or (v_new = 'DELIVERED' and v_load.actual_delivery_at is distinct from v_when) then
        raise exception 'Korektę czasu statusu robi wyłącznie Administrator HHL'
          using errcode = '42501';
      end if;
      return;
    end if;
  end if;

  if v_new is distinct from 'DELIVERED' then
    select max(e.occurred_at) into v_prev_at
      from load_events e
     where e.load_id = p_load
       and e.event_type like 'STATUS_%'
       and not exists (
         select 1 from load_events z
          where z.load_id = e.load_id
            and z.payload->>'zastepuje' = e.id::text
       );
    if v_prev_at is not null and v_when < v_prev_at and v_role is distinct from 'HHL_ADMIN' then
      raise exception 'Czas statusu nie wcześniej niż poprzedni status' using errcode = '22023';
    end if;
  end if;

  if v_new = 'CANCELLED' then
    perform set_config('tower.cancel_ctx', 'MANUAL', true);
  end if;
  perform set_config('tower.status_ctx', 'on', true);

  update loads
     set status = v_new,
         actual_delivery_at = case
           when v_new = 'DELIVERED' then v_when
           else actual_delivery_at
         end,
         actual_load_at = case
           when v_new in ('AT_LOADING', 'IN_TRANSIT_PL') and actual_load_at is null then v_when
           else actual_load_at
         end,
         updated_at = now()
   where id = p_load;

  if v_load.status is distinct from v_new then
    insert into load_events (load_id, event_type, occurred_at, payload)
    values (
      p_load,
      'STATUS_' || v_new::text,
      v_when,
      jsonb_build_object(
        'actor', v_actor,
        'actor_user_id', v_me,
        'from', v_load.status::text,
        'to', v_new::text,
        'note', v_note,
        'manual', true
      )
    );
  end if;

  insert into audit_log (user_id, action, entity, entity_id, old_value, new_value)
  values (
    v_me,
    'LOAD_STATUS_SET',
    'loads',
    p_load::text,
    jsonb_build_object('status', v_load.status::text, 'actual_delivery_at', v_load.actual_delivery_at),
    jsonb_build_object('status', v_new::text, 'occurred_at', v_when, 'note', v_note)
  );
end $$;

revoke all on function public.load_status_set(uuid, text, timestamptz, text) from public, anon;
grant execute on function public.load_status_set(uuid, text, timestamptz, text) to authenticated;
comment on function public.load_status_set(uuid, text, timestamptz, text) is
  'A5 E25 + D-0005: HHL_ADMIN bez limitu czasu; current_app_*; korekta osi dopiskiem; SCX nadpisuje godzinę DELIVERED; READY_TO_INVOICE=CMR po dostawie (A4/C17); INVOICED=obie faktury. #338: ostatni niezastąpiony wpis, także STATUS_AUTO; actor, actor_id i note.';


-- F7 #340 P1: potwierdzenie dat niesie kod transportu, nie numer KSH.
