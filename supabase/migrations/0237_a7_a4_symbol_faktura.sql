-- A7 (D-20261016-0200-01 Z1/Z2, D-20261020-0010-01): tabela symboli, wymiary/piloci/Firma|Trasa,
-- zezwolenie firmowe 13/GD/2026 + polisa HHL PZU (metadane; PDF skryptem z D:\Watch Tower\dane\).
-- A4 dopisze się w kolejnym commicie tej samej migracji.

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

  update public.loads l
     set symbol = v_spec.symbol,
         permit_kind = v_spec.permit_kind,
         combo_length_m = v_spec.combo_length_m,
         combo_width_m = v_spec.combo_width_m,
         combo_height_m = v_spec.combo_height_m,
         escort_vehicles = v_escorts
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

  /* Firma: podepnij zezwolenie firmowe w okresie ważności. */
  if v_spec.permit_kind = 'FIRMA' then
    insert into public.load_permits (load_id, permit_id)
    select p_load, p.id
      from public.permits p
      join public.loads l on l.id = p_load
     where p.scope = 'FIRMA'
       and p.project_id = l.project_id
       and coalesce(l.plan_load_date, (now() at time zone 'Europe/Warsaw')::date)
           between p.valid_from and p.valid_until
    on conflict do nothing;
  end if;

  return jsonb_build_object('ok', true, 'symbol', v_spec.symbol, 'permit_kind', v_spec.permit_kind);
end $$;

revoke all on function public.a7_apply_symbol(uuid, text) from public, anon;
grant execute on function public.a7_apply_symbol(uuid, text) to authenticated;

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
  if public.permit_required_enabled() is true then
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
-- ---------------------------------------------------------------------
do $$
declare
  v_project uuid;
  v_hhl uuid;
  v_permit uuid;
  v_pol uuid;
  v_n int;
begin
  select id into v_project from public.projects order by created_at nulls last, id limit 1;
  select id into v_hhl from public.organizations where kind = 'FORWARDER' order by id limit 1;

  if v_project is not null then
    select id into v_permit from public.permits
     where permit_no = '13/GD/2026' and scope = 'FIRMA' limit 1;
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
                'note', 'wpis jednorazowy — decyzja właściciela 16.10.2026, 01:13'));
    end if;
  end if;

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

  /* Uzupełnij symbole i wymiary na istniejących transportach (cicho). */
  perform set_config('tower.bulk_quiet', 'on', true);
  select count(*) into v_n from public.loads l
   where l.status <> 'CANCELLED'
     and exists (select 1 from public.shipment_items si where si.load_id = l.id);
  perform public.a7_apply_symbol(l.id, 'A7 jednorazowe uzupełnienie')
    from public.loads l
   where l.status <> 'CANCELLED'
     and exists (select 1 from public.shipment_items si where si.load_id = l.id);
  perform set_config('tower.bulk_quiet', 'off', true);

  raise notice 'A7: permit %, policy %, apply na transportach z pozycjami (okolo %)',
    v_permit, v_pol, v_n;
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
