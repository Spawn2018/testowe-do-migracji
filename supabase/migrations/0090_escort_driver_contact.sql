-- =====================================================================
-- TOWER — Migracja 0090: D-22 (decyzja właściciela 28.09) — imię i telefon kierowcy pojazdu pilotującego
--   Te same zasady co dane kierowcy transportu (0059, 0076):
--   1. load_escorts.driver_name / driver_phone — DANE OSOBOWE. Uprawnienia kolumnowe: SELECT dla authenticated na
--      wszystkie kolumny OPRÓCZ driver_name, driver_phone (anon nic). Odczyt wyłącznie przez load_escort_contacts():
--      HHL — wszystkie transporty, CARRIER_DISPATCH / CARRIER_USER — transporty własnego przewoźnika; KSH (CLIENT_*),
--      SITE_VIEWER i konto nieaktywne — 0 wierszy (KSH nie widzi, więc nie ma ich też w żadnym eksporcie KSH).
--   2. load_escorts_set: opcjonalne driver_name (≤ 120) i driver_phone (E.164, spacje usuwane); audit_log bez danych
--      osobowych (tylko znacznik „kontakt: tak/nie”).
--   3. purge_personal_data: dane pilotów czyszczone jak dane kierowcy — 90 dni po rozładunku, anulowany 90 dni po
--      anulowaniu; licznik 'piloci' w integration_runs (job 'rodo'). Reszta funkcji bez zmian (0059).
--   Idempotentna, bez usuwania danych.
-- =====================================================================
alter table load_escorts add column if not exists driver_name text check (driver_name is null or length(driver_name) between 1 and 120);
alter table load_escorts add column if not exists driver_phone text check (driver_phone is null or driver_phone ~ '^\+[1-9][0-9]{7,14}$');

revoke select on load_escorts from anon, authenticated;
do $$
declare v_cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into v_cols
    from information_schema.columns
   where table_schema = 'public' and table_name = 'load_escorts' and column_name not in ('driver_name', 'driver_phone');
  execute format('grant select (%s) on load_escorts to authenticated', v_cols);
end $$;

create or replace function load_escort_contacts()
returns table (load_id uuid, seq smallint, driver_name text, driver_phone text)
language plpgsql stable security definer set search_path = public as $$
declare v_role user_role; v_org uuid;
begin
  select u.role, u.org_id into v_role, v_org from app_users u where u.auth_id = auth.uid() and u.active;
  if v_role is null then return; end if;
  if v_role in ('HHL_ADMIN', 'HHL_OPS') then
    return query select e.load_id, e.seq, e.driver_name, e.driver_phone from load_escorts e
                  where e.driver_name is not null or e.driver_phone is not null;
  elsif v_role in ('CARRIER_DISPATCH', 'CARRIER_USER') then
    return query select e.load_id, e.seq, e.driver_name, e.driver_phone
                   from load_escorts e join loads l on l.id = e.load_id
                  where l.carrier_org_id = v_org and (e.driver_name is not null or e.driver_phone is not null);
  end if;
end $$;
revoke all on function load_escort_contacts() from public, anon;
grant execute on function load_escort_contacts() to authenticated;

create or replace function load_escorts_set(p_load uuid, p_escorts jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare v_load loads%rowtype; v_old jsonb; v_n int; e jsonb; i int := 0; v_phone text; v_name text;
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
    v_phone := nullif(regexp_replace(coalesce(e->>'driver_phone', ''), '\s', '', 'g'), '');
    if (v_phone is null or v_phone ~ '^\+[1-9][0-9]{7,14}$') is not true then
      raise exception 'Telefon kierowcy pilota w formacie międzynarodowym, np. +48 600 100 200' using errcode = '22023';
    end if;
    if (length(btrim(coalesce(e->>'driver_name', ''))) <= 120) is not true then
      raise exception 'Imię i nazwisko kierowcy pilota do 120 znaków' using errcode = '22023';
    end if;
  end loop;
  select coalesce(jsonb_agg(jsonb_build_object('seq', seq, 'company', company, 'plate', plate, 'scope', scope,
                  'kontakt', (driver_name is not null or driver_phone is not null)) order by seq), '[]')
    into v_old from load_escorts where load_id = p_load;
  delete from load_escorts where load_id = p_load;
  for e in select value from jsonb_array_elements(p_escorts) loop
    i := i + 1;
    v_phone := nullif(regexp_replace(coalesce(e->>'driver_phone', ''), '\s', '', 'g'), '');
    v_name := nullif(btrim(coalesce(e->>'driver_name', '')), '');
    insert into load_escorts (load_id, seq, company, plate, scope, driver_name, driver_phone, updated_by)
    values (p_load, i, btrim(e->>'company'), upper(btrim(e->>'plate')), coalesce(e->>'scope', 'PL_SE'), v_name, v_phone,
            current_app_user_id());
  end loop;
  v_n := i;
  if v_load.escort_vehicles is distinct from v_n then
    update loads set escort_vehicles = v_n where id = p_load;
  end if;
  insert into audit_log (user_id, action, entity, entity_id, old_value, new_value)
  values (current_app_user_id(), 'ESCORTS_SET', 'loads', p_load::text, v_old,
          (select coalesce(jsonb_agg(jsonb_build_object('seq', seq, 'company', company, 'plate', plate, 'scope', scope,
                  'kontakt', (driver_name is not null or driver_phone is not null)) order by seq), '[]')
             from load_escorts where load_id = p_load));
  return v_n;
end $$;
revoke all on function load_escorts_set(uuid, jsonb) from public, anon;
grant execute on function load_escorts_set(uuid, jsonb) to authenticated;

create or replace function public.purge_personal_data(p_days integer default 90)
returns integer
language plpgsql
set search_path to 'public', 'extensions'
as $function$
declare n int; n_c int; n_pos int; n_pos_c int; n_tok int; n_esc int;
begin
  if (p_days >= 0) is not true then raise exception 'p_days musi być ≥ 0' using errcode = '22023'; end if;

  update loads set driver_name = null, driver_phone = null
  where actual_delivery_at is not null
    and actual_delivery_at < now() - make_interval(days => p_days)
    and (driver_name is not null or driver_phone is not null);
  get diagnostics n = row_count;

  update loads set driver_name = null, driver_phone = null
  where status = 'CANCELLED' and actual_delivery_at is null
    and updated_at < now() - make_interval(days => p_days)
    and (driver_name is not null or driver_phone is not null);
  get diagnostics n_c = row_count;

  -- D-22 (0090): kierowcy pojazdów pilotujących — jak kierowca transportu
  update load_escorts e set driver_name = null, driver_phone = null
    from loads l
   where l.id = e.load_id
     and (e.driver_name is not null or e.driver_phone is not null)
     and ((l.actual_delivery_at is not null and l.actual_delivery_at < now() - make_interval(days => p_days))
       or (l.status = 'CANCELLED' and l.actual_delivery_at is null and l.updated_at < now() - make_interval(days => p_days)));
  get diagnostics n_esc = row_count;

  -- ANEKS 4 PR5: pozycje — 30 dni po rozładunku (cały ślad transportu)
  delete from positions p
  using loads l
  where l.id = p.load_id
    and l.actual_delivery_at is not null
    and l.actual_delivery_at < now() - interval '30 days';
  get diagnostics n_pos = row_count;

  delete from positions p
  using loads l
  where l.id = p.load_id and l.status = 'CANCELLED' and l.actual_delivery_at is null
    and l.updated_at < now() - make_interval(days => p_days);
  get diagnostics n_pos_c = row_count;

  delete from driver_tokens
  where coalesce(revoked_at, expires_at) < now() - make_interval(days => p_days);
  get diagnostics n_tok = row_count;

  insert into integration_runs (job, ok, result)
  values ('rodo', true, jsonb_build_object('dni', p_days, 'kierowcy_rozladowane', n, 'kierowcy_anulowane', n_c,
          'piloci', n_esc, 'pozycje_rozladowane', n_pos, 'pozycje_anulowane', n_pos_c, 'linki_kierowcy', n_tok));
  return n + n_c + n_esc;
end $function$;

revoke all on function public.purge_personal_data(integer) from public, anon, authenticated;
