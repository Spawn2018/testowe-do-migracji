-- =====================================================================
-- TOWER — Migracja 0087: III-4 (SCOPE 4.5) pojazdy pilotujące — dane i awizacja
--   1. load_escorts: pojazdy pilotujące transportu (kolejność 1–5, firma, tablica, zakres PL / SE / PL_SE). Bez danych
--      osobowych (imię i telefon pilota — decyzja właściciela D-22). Odczyt: HHL i strony widzące transport (RLS jak
--      loads); anon nic; zapis wyłącznie przez RPC.
--   2. load_escorts_set(p_load, p_escorts jsonb): pełna lista (zastępuje poprzednią) — HHL albo przewoźnik transportu,
--      do rozładunku (UNLOADED/DELIVERED/CANCELLED = odmowa); walidacja tablicy/firmy/zakresu, maks. 5; synchronizuje
--      loads.escort_vehicles; audit_log ESCORTS_SET (stara i nowa lista).
--   3. load_escort_status(): wymagane (maks. escort_required powiązanych zezwoleń) / awizowane / brakujące — security invoker.
--   4. Awizacja: termin ESCORT w resource_deadlines (48 / 12 h — PROPOZYCJA, do potwierdzenia z SCX, II-3);
--      detect_resource_deadlines: brak pilotów wymaganych zezwoleniem → RESOURCE_MISSING (rk_res_escort), eskalacja jak I-21.
--   Idempotentna, bez usuwania danych.
-- =====================================================================
create table if not exists load_escorts (
  id          uuid primary key default gen_random_uuid(),
  load_id     uuid not null references loads(id) on delete cascade,
  seq         smallint not null check (seq between 1 and 5),
  company     text not null check (length(btrim(company)) between 1 and 120),
  plate       text not null check (plate ~ '^[A-Z0-9 -]{2,15}$'),
  scope       text not null default 'PL_SE' check (scope in ('PL', 'SE', 'PL_SE')),
  updated_by  uuid references app_users(id),
  updated_at  timestamptz not null default now(),
  unique (load_id, seq)
);
alter table load_escorts enable row level security;
revoke all on load_escorts from anon, authenticated;
grant select on load_escorts to authenticated;
drop policy if exists load_escorts_read on load_escorts;
create policy load_escorts_read on load_escorts for select to authenticated
  using (is_hhl() or exists (select 1 from loads l where l.id = load_escorts.load_id));

create or replace function load_escorts_set(p_load uuid, p_escorts jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare v_load loads%rowtype; v_old jsonb; v_n int; e jsonb; i int := 0;
begin
  select * into v_load from loads where id = p_load;
  if (v_load.id is not null and (is_hhl() or (current_org_kind() = 'CARRIER' and v_load.carrier_org_id = current_org_id()))) is not true then
    raise exception 'Pojazdy pilotujące awizuje HHL albo przewoźnik transportu' using errcode = '42501';
  end if;
  if (v_load.status not in ('UNLOADED', 'DELIVERED', 'CANCELLED')) is not true then
    raise exception 'Transport zakończony albo anulowany — awizacja pilotów zamknięta' using errcode = '22023';
  end if;
  if (jsonb_typeof(p_escorts) = 'array' and jsonb_array_length(p_escorts) <= 5) is not true then
    raise exception 'Lista pojazdów pilotujących: tablica, maks. 5' using errcode = '22023';
  end if;
  for e in select value from jsonb_array_elements(p_escorts) loop
    if (upper(btrim(e->>'plate')) ~ '^[A-Z0-9 -]{2,15}$') is not true then
      raise exception 'Nieprawidłowa tablica pojazdu pilotującego' using errcode = '22023';
    end if;
    if (length(btrim(coalesce(e->>'company', ''))) between 1 and 120) is not true then
      raise exception 'Brak firmy pilotującej' using errcode = '22023';
    end if;
    if (coalesce(e->>'scope', 'PL_SE') in ('PL', 'SE', 'PL_SE')) is not true then
      raise exception 'Zakres pilotażu: PL, SE albo PL_SE' using errcode = '22023';
    end if;
  end loop;
  select coalesce(jsonb_agg(jsonb_build_object('seq', seq, 'company', company, 'plate', plate, 'scope', scope) order by seq), '[]')
    into v_old from load_escorts where load_id = p_load;
  delete from load_escorts where load_id = p_load;
  for e in select value from jsonb_array_elements(p_escorts) loop
    i := i + 1;
    insert into load_escorts (load_id, seq, company, plate, scope, updated_by)
    values (p_load, i, btrim(e->>'company'), upper(btrim(e->>'plate')), coalesce(e->>'scope', 'PL_SE'), current_app_user_id());
  end loop;
  v_n := i;
  if v_load.escort_vehicles is distinct from v_n then
    update loads set escort_vehicles = v_n where id = p_load;
  end if;
  insert into audit_log (user_id, action, entity, entity_id, old_value, new_value)
  values (current_app_user_id(), 'ESCORTS_SET', 'loads', p_load::text, v_old,
          (select coalesce(jsonb_agg(jsonb_build_object('seq', seq, 'company', company, 'plate', plate, 'scope', scope) order by seq), '[]')
             from load_escorts where load_id = p_load));
  return v_n;
end $$;
revoke all on function load_escorts_set(uuid, jsonb) from public, anon;
grant execute on function load_escorts_set(uuid, jsonb) to authenticated;

create or replace function load_escort_status()
returns table (load_id uuid, required int, assigned int, missing int)
language sql stable security invoker set search_path = public as $$
  select l.id, r.req, a.cnt, greatest(r.req - a.cnt, 0)
    from loads l
    cross join lateral (select coalesce(max(p.escort_required), 0)::int as req
                          from load_permits lp join permits p on p.id = lp.permit_id where lp.load_id = l.id) r
    cross join lateral (select count(*)::int as cnt from load_escorts e where e.load_id = l.id) a
   where l.status <> 'CANCELLED'
$$;
revoke all on function load_escort_status() from public, anon;
grant execute on function load_escort_status() to authenticated;

-- awizacja: termin pilotów w resource_deadlines (rozszerzenie CHECK bez usuwania danych)
alter table resource_deadlines drop constraint if exists resource_deadlines_kind_check;
alter table resource_deadlines add constraint resource_deadlines_kind_check check (kind in ('DRIVER', 'VEHICLE', 'DOCS', 'ESCORT'));
insert into resource_deadlines (kind, lead_h, critical_h, source) values
  ('ESCORT', 48, 12, 'propozycja 28.09 — do potwierdzenia z SCX (II-3)')
on conflict (kind) do nothing;

create or replace function detect_resource_deadlines(p_now timestamptz default now()) returns int
language plpgsql security definer set search_path = public as $$
declare
  r record; d record; v_missing boolean; v_sev risk_severity; v_key text; v_rid uuid; v_old risk_severity;
  n int := 0; v_code text;
begin
  for r in
    select l.*, coalesce(l.plan_load_from, (l.plan_load_date::timestamp at time zone 'Europe/Warsaw')) as due,
           coalesce(si.shipment_code, l.order_no, left(l.id::text, 8)) as code
      from loads l
      left join lateral (select shipment_code from shipment_items where load_id = l.id order by assembly_seq nulls last limit 1) si on true
     where l.carrier_org_id is not null
       and coalesce(l.plan_load_from, (l.plan_load_date::timestamp at time zone 'Europe/Warsaw')) is not null
  loop
    for d in select * from resource_deadlines loop
      v_key := 'RES:' || d.kind || ':' || r.id;
      v_missing := r.status in ('PLANNED', 'RESOURCES_PENDING', 'DOCS_PENDING') and case d.kind
        when 'DRIVER'  then coalesce(btrim(r.driver_name), '') = '' or coalesce(btrim(r.driver_phone), '') = ''
        when 'VEHICLE' then coalesce(btrim(r.tractor_plate), '') = '' or coalesce(btrim(r.trailer_plate), '') = ''
        when 'ESCORT'  then (select coalesce(max(p.escort_required), 0) from load_permits lp join permits p on p.id = lp.permit_id where lp.load_id = r.id)
                            > (select count(*) from load_escorts e where e.load_id = r.id)
        else r.status = 'DOCS_PENDING' end;
      select id, severity into v_rid, v_old from risk_signals where dedup_key = v_key and resolved_at is null;
      if (v_missing and r.due <= p_now + make_interval(hours => d.lead_h)) is not true then
        if v_rid is not null and v_missing is not true then
          update risk_signals set resolved_at = p_now where id = v_rid;   -- uzupełnione albo transport dalej
        end if;
        continue;
      end if;
      v_sev := case when r.due <= p_now + make_interval(hours => d.critical_h) then 'CRITICAL' else 'HIGH' end;
      v_code := r.code;
      if v_rid is null then
        insert into risk_signals (project_id, load_id, kind, severity, title, title_key, detail, dedup_key)
        values (r.project_id, r.id, 'RESOURCE_MISSING', v_sev,
                v_code || ': ' || case d.kind when 'DRIVER' then 'brak danych kierowcy' when 'VEHICLE' then 'brak tablic ciągnika lub naczepy'
                                   when 'ESCORT' then 'brak pojazdów pilotujących wymaganych zezwoleniem' else 'brak dokumentów' end || ' przed załadunkiem',
                case d.kind when 'DRIVER' then 'rk_res_driver' when 'VEHICLE' then 'rk_res_vehicle' when 'ESCORT' then 'rk_res_escort' else 'rk_res_docs' end,
                jsonb_build_object('rule', 'RESOURCE_DEADLINE', 'resource', d.kind, 'owner', 'SCX', 'due', r.due,
                  'lead_h', d.lead_h, 'critical_h', d.critical_h, 'params', jsonb_build_object('code', v_code, 'h', d.lead_h),
                  'text_key', case d.kind when 'DRIVER' then 'rk_res_driver_text' when 'VEHICLE' then 'rk_res_vehicle_text' when 'ESCORT' then 'rk_res_escort_text' else 'rk_res_docs_text' end,
                  'meta_key', 'risk_meta_carrier',
                  'next_action_key', case d.kind when 'DRIVER' then 'rk_res_driver_next' when 'VEHICLE' then 'rk_res_vehicle_next' when 'ESCORT' then 'rk_res_escort_next' else 'rk_res_docs_next' end),
                v_key);
        n := n + 1;
      elsif v_old = 'HIGH' and v_sev = 'CRITICAL' then
        update risk_signals set severity = 'CRITICAL' where id = v_rid;  -- eskalacja
        n := n + 1;
      else
        continue;
      end if;
      insert into notifications (channel, recipient, user_id, load_id, template, payload, dedup_key)
      select 'IN_APP', coalesce(u.email::text, u.id::text), u.id, r.id, 'RESOURCE_DEADLINE',
             jsonb_build_object('resource', d.kind, 'code', v_code, 'due', r.due, 'severity', v_sev, 'locale', u.locale),
             v_key || ':' || v_sev || ':' || u.id
        from app_users u
       where u.active and ((u.org_id = r.carrier_org_id and u.role in ('CARRIER_DISPATCH', 'CARRIER_USER'))
                           or (v_sev = 'CRITICAL' and u.role in ('HHL_ADMIN', 'HHL_OPS')))
      on conflict (dedup_key) where dedup_key is not null do nothing;
    end loop;
  end loop;
  return n;
end $$;
revoke all on function detect_resource_deadlines(timestamptz) from public, anon, authenticated;
