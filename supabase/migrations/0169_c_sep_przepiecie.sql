-- 0169 — C-SEP: separator „ / ” / „|” (Przepięcie) + kierowca/ciągnik dostarczający.
--   Watch Tower: „|” tylko przy trailer_swap = true; SharePoint zawsze „ / ” (II-10).
--   Kolumny: driver_delivery_*, tractor_delivery_plate, trailer_swap.
--   load_driver_contacts zwraca też dane dostarczającego (te same role co I-7a).
--   guard_load_update: dopisanie kolumn do listy v_carrier (chirurgicznie).
--   H1/H3/H6 nie ruszane. Bez kasowania danych.

select set_config('tower.audit_source', 'migracja 0169 (C-SEP)', true);

alter table loads add column if not exists driver_delivery_name text;
alter table loads add column if not exists driver_delivery_phone text;
alter table loads add column if not exists driver_delivery_phone_country char(2) not null default 'PL';
alter table loads add column if not exists tractor_delivery_plate text;
alter table loads add column if not exists trailer_swap boolean not null default false;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'loads_driver_delivery_phone_country_chk') then
    alter table loads add constraint loads_driver_delivery_phone_country_chk
      check (driver_delivery_phone_country in ('PL', 'SE'));
  end if;
end $$;

comment on column loads.trailer_swap is 'C-SEP: Przepięcie naczepy — w Watch Tower separator „|”; SharePoint zawsze „ / ”.';
comment on column loads.driver_delivery_name is 'C-SEP: kierowca dostarczający (po przepięciu / drugi kierowca).';

drop function if exists public.load_driver_contacts();
create or replace function public.load_driver_contacts()
returns table (
  load_id uuid,
  driver_name text,
  driver_phone text,
  driver_phone_country char(2),
  driver_delivery_name text,
  driver_delivery_phone text,
  driver_delivery_phone_country char(2),
  tractor_delivery_plate text,
  trailer_swap boolean
)
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
      select l.id, l.driver_name::text, l.driver_phone::text, l.driver_phone_country,
             l.driver_delivery_name::text, l.driver_delivery_phone::text, l.driver_delivery_phone_country,
             l.tractor_delivery_plate::text, l.trailer_swap
        from loads l;
  elsif v_role in ('CARRIER_DISPATCH', 'CARRIER_USER') then
    return query
      select l.id, l.driver_name::text, l.driver_phone::text, l.driver_phone_country,
             l.driver_delivery_name::text, l.driver_delivery_phone::text, l.driver_delivery_phone_country,
             l.tractor_delivery_plate::text, l.trailer_swap
        from loads l
       where l.carrier_org_id = v_org;
  elsif v_role::text like 'CLIENT_%' then
    return query
      select l.id, l.driver_name::text, l.driver_phone::text, l.driver_phone_country,
             l.driver_delivery_name::text, l.driver_delivery_phone::text, l.driver_delivery_phone_country,
             l.tractor_delivery_plate::text, l.trailer_swap
        from loads l
        join projects p on p.id = l.project_id
       where p.client_org_id = v_org
         and (l.driver_name is not null or l.driver_phone is not null
              or l.driver_delivery_name is not null or l.driver_delivery_phone is not null);
  end if;
end $$;
revoke all on function public.load_driver_contacts() from public, anon;
grant execute on function public.load_driver_contacts() to authenticated;

-- Dopisz nowe kolumny do listy v_carrier w guard_load_update (bez przepisywania całej funkcji)
do $guard$
declare
  def text := pg_get_functiondef('public.guard_load_update()'::regprocedure);
  old text := '''driver_name'',''driver_phone''';
  new text := '''driver_name'',''driver_phone'',''driver_phone_country'',''driver_delivery_name'',''driver_delivery_phone'',''driver_delivery_phone_country'',''tractor_delivery_plate'',''trailer_swap''';
begin
  if def like '%driver_delivery_name%' then
    raise notice '0169: guard_load_update już zawiera C-SEP';
    return;
  end if;
  -- warianty cudzysłowów w definicji funkcji
  if def like '%''driver_name'',''driver_phone''%' then
    def := replace(def, old, new);
  elsif def like '%''driver_name'', ''driver_phone''%' then
    def := replace(def,
      '''driver_name'', ''driver_phone''',
      '''driver_name'', ''driver_phone'', ''driver_phone_country'', ''driver_delivery_name'', ''driver_delivery_phone'', ''driver_delivery_phone_country'', ''tractor_delivery_plate'', ''trailer_swap''');
  else
    raise exception '0169: nie znaleziono listy v_carrier (driver_name/driver_phone) w guard_load_update';
  end if;
  execute def;
end $guard$;
