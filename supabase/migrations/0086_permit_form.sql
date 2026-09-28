-- =====================================================================
-- TOWER — Migracja 0086: formularz zezwoleń w UI (SCOPE 6.4) — HHL i przewoźnik transportu
--   1. load_permit_save(): zapis zezwolenia (pola: kraj, numer, organ, okres ważności, limity wymiarów i masy,
--      pojazdy pilotujące, opis trasy) i powiązanie z transportem w jednej transakcji. HHL albo przewoźnik
--      transportu; transport anulowany = odmowa; audit_log PERMIT_SAVE + PERMIT_LINK.
--   2. load_permit_unlink(): odłączenie błędnie powiązanego zezwolenia — tylko przed READY (po READY blokada
--      z 0081/0084 już zadziałała, odłączenie obchodziłoby ją); audit_log PERMIT_UNLINK.
--   3. permit_save(): przewoźnik zapisuje zezwolenie tylko w projekcie, w którym ma transport (wcześniej
--      w dowolnym istniejącym projekcie — zezwolenie niewidoczne dla niego, ale zaśmiecające projekt HHL).
--   Idempotentna, bez usuwania danych.
-- =====================================================================
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
  if (is_hhl() or exists (select 1 from loads where project_id = p_project and carrier_org_id = current_org_id())) is not true then
    raise exception 'Przewoźnik zapisuje zezwolenie tylko w projekcie, w którym ma transport' using errcode = '42501';
  end if;
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

create or replace function load_permit_save(
  p_load uuid, p_country text, p_permit_no text, p_valid_from date, p_valid_until date,
  p_max_length_m numeric, p_max_width_m numeric, p_max_height_m numeric, p_max_weight_t numeric,
  p_escort_required integer default 0, p_route_desc text default null, p_authority text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_load loads%rowtype; v_id uuid; v_user uuid := current_app_user_id();
begin
  select * into v_load from loads where id = p_load;
  if (v_load.id is not null and (is_hhl() or (current_org_kind() = 'CARRIER' and v_load.carrier_org_id = current_org_id()))) is not true then
    raise exception 'Zezwolenie zapisuje HHL albo przewoźnik transportu' using errcode = '42501';
  end if;
  if (v_load.status <> 'CANCELLED') is not true then raise exception 'Transport anulowany' using errcode = '22023'; end if;
  if (p_country in ('PL', 'SE')) is not true then raise exception 'Kraj zezwolenia: PL albo SE' using errcode = '22023'; end if;
  if (length(btrim(coalesce(p_permit_no, ''))) between 1 and 80) is not true then raise exception 'Brak numeru zezwolenia' using errcode = '22023'; end if;
  if (p_valid_from <= p_valid_until) is not true then raise exception 'Nieprawidłowy okres ważności' using errcode = '22023'; end if;
  if (coalesce(p_max_length_m, 1) > 0 and coalesce(p_max_width_m, 1) > 0 and coalesce(p_max_height_m, 1) > 0
      and coalesce(p_max_weight_t, 1) > 0 and coalesce(p_escort_required, 0) between 0 and 5) is not true then
    raise exception 'Limity zezwolenia muszą być dodatnie' using errcode = '22023';
  end if;
  if (length(coalesce(p_route_desc, '')) <= 2000 and length(coalesce(p_authority, '')) <= 200) is not true then
    raise exception 'Opis trasy do 2000 znaków, organ do 200' using errcode = '22023';
  end if;
  insert into permits (project_id, country, permit_no, authority, valid_from, valid_until, max_length_m, max_width_m,
                       max_height_m, max_weight_t, escort_required, route_desc)
  values (v_load.project_id, p_country, btrim(p_permit_no), nullif(btrim(coalesce(p_authority, '')), ''), p_valid_from,
          p_valid_until, p_max_length_m, p_max_width_m, p_max_height_m, p_max_weight_t, coalesce(p_escort_required, 0),
          nullif(btrim(coalesce(p_route_desc, '')), ''))
  returning id into v_id;
  insert into load_permits (load_id, permit_id) values (p_load, v_id);
  insert into audit_log (user_id, action, entity, entity_id, new_value)
  values (v_user, 'PERMIT_SAVE', 'permits', v_id::text,
          jsonb_build_object('country', p_country, 'permit_no', btrim(p_permit_no), 'valid_until', p_valid_until, 'load_id', p_load)),
         (v_user, 'PERMIT_LINK', 'loads', p_load::text, jsonb_build_object('permit_id', v_id));
  return v_id;
end $$;
revoke all on function load_permit_save(uuid, text, text, date, date, numeric, numeric, numeric, numeric, integer, text, text) from public, anon;
grant execute on function load_permit_save(uuid, text, text, date, date, numeric, numeric, numeric, numeric, integer, text, text) to authenticated;

create or replace function load_permit_unlink(p_load uuid, p_permit uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_load loads%rowtype;
begin
  select * into v_load from loads where id = p_load;
  if (v_load.id is not null and (is_hhl() or (current_org_kind() = 'CARRIER' and v_load.carrier_org_id = current_org_id()))) is not true then
    raise exception 'Zezwolenie odłącza HHL albo przewoźnik transportu' using errcode = '42501';
  end if;
  if (v_load.status in ('PLANNED', 'RESOURCES_PENDING', 'DOCS_PENDING')) is not true then
    raise exception 'Zezwolenie można odłączyć tylko przed statusem Gotowy' using errcode = '22023';
  end if;
  if (exists (select 1 from load_permits where load_id = p_load and permit_id = p_permit)) is not true then
    raise exception 'Zezwolenie nie jest powiązane z tym transportem' using errcode = '22023';
  end if;
  delete from load_permits where load_id = p_load and permit_id = p_permit;
  insert into audit_log (user_id, action, entity, entity_id, old_value)
  values (current_app_user_id(), 'PERMIT_UNLINK', 'loads', p_load::text, jsonb_build_object('permit_id', p_permit));
  return true;
end $$;
revoke all on function load_permit_unlink(uuid, uuid) from public, anon;
grant execute on function load_permit_unlink(uuid, uuid) to authenticated;
