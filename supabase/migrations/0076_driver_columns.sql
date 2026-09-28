-- =====================================================================
-- TOWER — Migracja 0076: BEZPIECZEŃSTWO (PLAN §1.5, SCOPE 13.12) — dane kierowcy tylko dla HHL i przewoźnika transportu
--   Przed: `loads.driver_name` i `loads.driver_phone` były czytelne dla każdej roli, która widzi transport (RLS
--   ogranicza wiersze, nie kolumny) — klient (KSH) i SITE_VIEWER dostawali imię i telefon kierowcy w API i w XLSX.
--   Po: SELECT na loads dla authenticated = wszystkie kolumny OPRÓCZ driver_name, driver_phone (uprawnienia kolumnowe;
--   anon bez SELECT). Dane kierowcy wyłącznie przez load_driver_contacts(): HHL — wszystkie widoczne transporty,
--   CARRIER_DISPATCH / CARRIER_USER — transporty własnego przewoźnika; CLIENT_* — WYŁĄCZNIE telefon (bez imienia)
--   w oknie ±24 h od dostawy (reguła D6: plan_delivery_from → eta_site → południe dnia dostawy Europe/Stockholm),
--   tylko dla projektów klienta; SITE_VIEWER i konto nieaktywne — 0 wierszy.
--   Zapis (UPDATE driver_*) bez zmian — uprawnienie UPDATE i RLS jak dotąd.
--   UWAGA na przyszłość: nowa kolumna loads wymaga jawnego `grant select (kolumna) on loads to authenticated`.
--   Idempotentna.
-- =====================================================================
revoke select on loads from anon, authenticated;
do $$
declare v_cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into v_cols
    from information_schema.columns
   where table_schema = 'public' and table_name = 'loads' and column_name not in ('driver_name', 'driver_phone');
  execute format('grant select (%s) on loads to authenticated', v_cols);
end $$;

create or replace function load_driver_contacts()
returns table (load_id uuid, driver_name text, driver_phone text)
language plpgsql stable security definer set search_path = public as $$
declare v_role user_role; v_org uuid;
begin
  select u.role, u.org_id into v_role, v_org from app_users u where u.auth_id = auth.uid() and u.active;
  if v_role is null then return; end if;
  if v_role in ('HHL_ADMIN', 'HHL_OPS') then
    return query select l.id, l.driver_name::text, l.driver_phone::text from loads l;
  elsif v_role in ('CARRIER_DISPATCH', 'CARRIER_USER') then
    return query select l.id, l.driver_name::text, l.driver_phone::text from loads l where l.carrier_org_id = v_org;
  elsif v_role::text like 'CLIENT_%' then
    return query
      select l.id, null::text, l.driver_phone::text
        from loads l join projects p on p.id = l.project_id
       where p.client_org_id = v_org and l.driver_phone is not null
         and abs(extract(epoch from (now() - coalesce(l.plan_delivery_from, l.eta_site,
               ((l.plan_delivery_date + time '12:00')::timestamp at time zone 'Europe/Stockholm'))))) <= 86400;
  end if;
end $$;
revoke all on function load_driver_contacts() from public, anon;
grant execute on function load_driver_contacts() to authenticated;
