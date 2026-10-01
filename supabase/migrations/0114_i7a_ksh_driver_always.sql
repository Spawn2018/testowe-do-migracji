-- =====================================================================
-- TOWER — Migracja 0114: I-7a (SHAREPOINT §1a, uzupełnienie 01.10)
--   KSH widzi na stałe imię, telefon i tablice (tablice już w SELECT loads).
--   load_driver_contacts: gałąź CLIENT — pełne dane (imię + telefon), bez okna ±24 h;
--   tylko transporty własnego projektu. Bez mechanizmu wycofania zgody (koordynator 01.10).
-- Idempotentna. Nie rusza bramki SMS.
-- =====================================================================

drop function if exists public.load_driver_contacts();
create or replace function public.load_driver_contacts()
returns table (load_id uuid, driver_name text, driver_phone text, driver_phone_country char(2))
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role user_role;
  v_org uuid;
begin
  select u.role, u.org_id into v_role, v_org
    from app_users u where u.auth_id = auth.uid() and u.active;
  if v_role is null then return; end if;

  if v_role in ('HHL_ADMIN', 'HHL_OPS') then
    return query
      select l.id, l.driver_name::text, l.driver_phone::text, l.driver_phone_country
        from loads l;
  elsif v_role in ('CARRIER_DISPATCH', 'CARRIER_USER') then
    return query
      select l.id, l.driver_name::text, l.driver_phone::text, l.driver_phone_country
        from loads l
       where l.carrier_org_id = v_org;
  elsif v_role::text like 'CLIENT_%' then
    -- I-7a: pełne dane na stałe (bez ±24 h), tylko własny projekt
    return query
      select l.id, l.driver_name::text, l.driver_phone::text, l.driver_phone_country
        from loads l
        join projects p on p.id = l.project_id
       where p.client_org_id = v_org
         and (l.driver_name is not null or l.driver_phone is not null);
  end if;
end $$;
revoke all on function public.load_driver_contacts() from public, anon;
grant execute on function public.load_driver_contacts() to authenticated;

comment on function public.load_driver_contacts() is
  'I-7a/TEL-1: kontakty kierowcy. HHL wszystkie; SCX własne; KSH pełne dane swojego projektu na stałe (bez okna ±24 h).';
