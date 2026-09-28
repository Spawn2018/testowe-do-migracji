-- =====================================================================
-- TOWER — Migracja 0081: walidator zezwoleń i wymiarów zestawu (SCOPE 6.5, PLAN „walidator zezwoleń i wymiarów”)
--   1. permits: RLS włączone bez polityk (nikt poza definer nie widział) + nadmiarowe uprawnienia anon.
--      Teraz: odczyt — HHL oraz strony widzące powiązany transport; anon bez dostępu; zapis tylko RPC.
--   2. permit_fits: nieznany wymiar zestawu (NULL) był liczony jako 0 = „pasuje”. Teraz NULL przy ustalonym
--      limicie zezwolenia = naruszenie DIMS_UNKNOWN (brak danych nie daje zgody); limit NULL = bez ograniczenia.
--   3. load_permit_status(): stan per widoczny transport (powiązane zezwolenia, zgodność, naruszenia,
--      brakujące kraje PL/SE) — security invoker (RLS).
--   4. permit_save / load_permit_link — HHL albo przewoźnik transportu; audit_log.
--   5. Blokada: transport z powiązanym zezwoleniem niezgodnym z zestawem nie przejdzie do READY i dalej
--      (brak zezwolenia nie blokuje — sygnalizowany w stanie; produkcja nie ma jeszcze zezwoleń w bazie).
--   Idempotentna.
-- =====================================================================
revoke all on permits from anon;
revoke insert, update, delete, truncate, references, trigger on permits from authenticated;
grant select on permits to authenticated;
drop policy if exists permits_read on permits;
create policy permits_read on permits for select to authenticated using (
  is_hhl() or exists (select 1 from load_permits lp join loads l on l.id = lp.load_id where lp.permit_id = permits.id)
);

create or replace function permit_fits(p_load_id uuid, p_permit_id uuid)
returns table (ok boolean, breaches text[])
language sql stable set search_path = public, extensions as $$
  select
    coalesce(bool_and(t.pass), false) as ok,
    array_remove(array_agg(case when t.pass is not true then t.label end), null) as breaches
  from loads l
  join permits p on p.id = p_permit_id
  cross join lateral (values
    ('LENGTH', coalesce(l.combo_length_m <= p.max_length_m, true)),
    ('WIDTH', coalesce(l.combo_width_m <= p.max_width_m, true)),
    ('HEIGHT', coalesce(l.combo_height_m <= p.max_height_m, true)),
    ('WEIGHT', coalesce(l.combo_weight_t <= p.max_weight_t, true)),
    ('DIMS_UNKNOWN', not ((p.max_length_m is not null and l.combo_length_m is null)
                       or (p.max_width_m  is not null and l.combo_width_m  is null)
                       or (p.max_height_m is not null and l.combo_height_m is null)
                       or (p.max_weight_t is not null and l.combo_weight_t is null))),
    ('VALIDITY', coalesce(l.plan_load_date, current_date) between p.valid_from and p.valid_until)
  ) as t(label, pass)
  where l.id = p_load_id;
$$;

create or replace function load_permit_status()
returns table (load_id uuid, permits_linked int, ok boolean, breaches text[], missing_countries text[])
language sql stable security invoker set search_path = public as $$
  select l.id,
         count(lp.permit_id)::int,
         coalesce(bool_and(f.ok), true),
         coalesce(array_remove(array_agg(distinct b.x), null), '{}'),
         array(select c from unnest(array['PL', 'SE']) c
                where not exists (select 1 from load_permits lp2 join permits p2 on p2.id = lp2.permit_id
                                   where lp2.load_id = l.id and p2.country = c))
    from loads l
    left join load_permits lp on lp.load_id = l.id
    left join lateral permit_fits(l.id, lp.permit_id) f on lp.permit_id is not null
    left join lateral unnest(coalesce(f.breaches, '{}')) b(x) on true
   where l.status <> 'CANCELLED'
   group by l.id
$$;
revoke all on function load_permit_status() from public, anon;
grant execute on function load_permit_status() to authenticated;

create or replace function permit_save(
  p_project uuid, p_country text, p_permit_no text, p_valid_from date, p_valid_until date,
  p_max_length_m numeric, p_max_width_m numeric, p_max_height_m numeric, p_max_weight_t numeric,
  p_escort_required integer default 0, p_route_desc text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_user uuid := current_app_user_id();
begin
  if (is_hhl() or current_org_kind() = 'CARRIER') is not true then
    raise exception 'Zezwolenie zapisuje HHL albo przewoźnik' using errcode = '42501';
  end if;
  if (p_country in ('PL', 'SE')) is not true then raise exception 'Kraj zezwolenia: PL albo SE' using errcode = '22023'; end if;
  if (length(btrim(coalesce(p_permit_no, ''))) between 1 and 80) is not true then raise exception 'Brak numeru zezwolenia' using errcode = '22023'; end if;
  if (p_valid_from <= p_valid_until) is not true then raise exception 'Nieprawidłowy okres ważności' using errcode = '22023'; end if;
  if (coalesce(p_max_length_m, 1) > 0 and coalesce(p_max_width_m, 1) > 0 and coalesce(p_max_height_m, 1) > 0
      and coalesce(p_max_weight_t, 1) > 0 and coalesce(p_escort_required, 0) between 0 and 5) is not true then
    raise exception 'Limity zezwolenia muszą być dodatnie' using errcode = '22023';
  end if;
  if (exists (select 1 from projects where id = p_project)) is not true then raise exception 'Nieznany projekt'; end if;
  insert into permits (project_id, country, permit_no, valid_from, valid_until, max_length_m, max_width_m, max_height_m,
                       max_weight_t, escort_required, route_desc)
  values (p_project, p_country, btrim(p_permit_no), p_valid_from, p_valid_until, p_max_length_m, p_max_width_m,
          p_max_height_m, p_max_weight_t, coalesce(p_escort_required, 0), p_route_desc)
  returning id into v_id;
  insert into audit_log (user_id, action, entity, entity_id, new_value)
  values (v_user, 'PERMIT_SAVE', 'permits', v_id::text,
          jsonb_build_object('country', p_country, 'permit_no', btrim(p_permit_no), 'valid_until', p_valid_until));
  return v_id;
end $$;
revoke all on function permit_save(uuid, text, text, date, date, numeric, numeric, numeric, numeric, integer, text) from public, anon;
grant execute on function permit_save(uuid, text, text, date, date, numeric, numeric, numeric, numeric, integer, text) to authenticated;

create or replace function load_permit_link(p_load uuid, p_permit uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_load loads%rowtype; v_permit permits%rowtype;
begin
  select * into v_load from loads where id = p_load;
  if (v_load.id is not null and (is_hhl() or (current_org_kind() = 'CARRIER' and v_load.carrier_org_id = current_org_id()))) is not true then
    raise exception 'Zezwolenie łączy HHL albo przewoźnik transportu' using errcode = '42501';
  end if;
  select * into v_permit from permits where id = p_permit;
  if (v_permit.id is not null and v_permit.project_id = v_load.project_id) is not true then
    raise exception 'Zezwolenie z innego projektu' using errcode = '22023';
  end if;
  insert into load_permits (load_id, permit_id) values (p_load, p_permit) on conflict do nothing;
  insert into audit_log (user_id, action, entity, entity_id, new_value)
  values (current_app_user_id(), 'PERMIT_LINK', 'loads', p_load::text, jsonb_build_object('permit_id', p_permit));
  return true;
end $$;
revoke all on function load_permit_link(uuid, uuid) from public, anon;
grant execute on function load_permit_link(uuid, uuid) to authenticated;

-- blokada: niezgodne zezwolenie zatrzymuje transport przed READY
create or replace function trg_loads_permit_gate() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_bad text;
begin
  if new.status is not distinct from old.status then return new; end if;
  if new.status in ('PLANNED', 'RESOURCES_PENDING', 'DOCS_PENDING', 'CANCELLED') then return new; end if;
  if old.status not in ('PLANNED', 'RESOURCES_PENDING', 'DOCS_PENDING') then return new; end if;
  select string_agg(distinct p.country || ' ' || p.permit_no || ': ' || array_to_string(f.breaches, ','), '; ')
    into v_bad
    from load_permits lp join permits p on p.id = lp.permit_id
    cross join lateral permit_fits(new.id, lp.permit_id) f
   where lp.load_id = new.id and f.ok is not true;
  if v_bad is not null then
    raise exception 'Zezwolenie niezgodne z zestawem — transport zablokowany (%)', v_bad using errcode = '23514';
  end if;
  return new;
end $$;
revoke all on function trg_loads_permit_gate() from public, anon, authenticated;
drop trigger if exists trg_loads_permit_gate on loads;
create trigger trg_loads_permit_gate before update of status on loads for each row execute function trg_loads_permit_gate();
