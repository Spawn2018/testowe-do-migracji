-- 0111 — TEL-1 / DECYZJE §1: telefony zawsze bez kierunkowego.
-- Zapis/odczyt: numer krajowy. Kraj osobno (domyślnie PL) — tylko do bramki SMS (E.164 przy enqueue).
-- Idempotentna. Migracja istniejących E.164 → national + country.

-- ── loads: kraj numeru ──────────────────────────────────────────────────────
alter table public.loads
  add column if not exists driver_phone_country char(2) not null default 'PL';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'loads_driver_phone_country_chk'
  ) then
    alter table public.loads
      add constraint loads_driver_phone_country_chk
      check (driver_phone_country in ('PL', 'SE'));
  end if;
end $$;

-- konwersja istniejących E.164 → krajowy
update public.loads
set
  driver_phone_country = case
    when driver_phone like '+46%' or driver_phone like '0046%' then 'SE'
    when driver_phone like '+48%' or driver_phone like '0048%' then 'PL'
    else driver_phone_country
  end,
  driver_phone = case
    when driver_phone ~ '^\+?00?48' then regexp_replace(regexp_replace(driver_phone, '\D', '', 'g'), '^(00)?48', '')
    when driver_phone ~ '^\+?00?46' then
      case
        when regexp_replace(regexp_replace(driver_phone, '\D', '', 'g'), '^(00)?46', '') like '0%'
          then regexp_replace(regexp_replace(driver_phone, '\D', '', 'g'), '^(00)?46', '')
        else '0' || regexp_replace(regexp_replace(driver_phone, '\D', '', 'g'), '^(00)?46', '')
      end
    when driver_phone like '+%' then regexp_replace(driver_phone, '\D', '', 'g')
    else regexp_replace(coalesce(driver_phone, ''), '\D', '', 'g')
  end
where driver_phone is not null
  and (driver_phone like '+%' or driver_phone like '00%' or driver_phone ~ '[^0-9]');

update public.loads set driver_phone = nullif(driver_phone, '') where driver_phone is not null;

-- 0076: nowa kolumna loads → jawne grant select
grant select (driver_phone_country) on public.loads to authenticated;

-- load_driver_contacts: też kraj (TEL-1)
drop function if exists public.load_driver_contacts();
create or replace function public.load_driver_contacts()
returns table (load_id uuid, driver_name text, driver_phone text, driver_phone_country char(2))
language plpgsql stable security definer set search_path = public as $$
declare v_role user_role; v_org uuid;
begin
  select u.role, u.org_id into v_role, v_org from app_users u where u.auth_id = auth.uid() and u.active;
  if v_role is null then return; end if;
  if v_role in ('HHL_ADMIN', 'HHL_OPS') then
    return query select l.id, l.driver_name::text, l.driver_phone::text, l.driver_phone_country
      from loads l;
  elsif v_role in ('CARRIER_DISPATCH', 'CARRIER_USER') then
    return query select l.id, l.driver_name::text, l.driver_phone::text, l.driver_phone_country
      from loads l where l.carrier_org_id = v_org;
  elsif v_role::text like 'CLIENT_%' then
    return query
      select l.id, null::text, l.driver_phone::text, l.driver_phone_country
        from loads l join projects p on p.id = l.project_id
       where p.client_org_id = v_org and l.driver_phone is not null
         and abs(extract(epoch from (now() - coalesce(l.plan_delivery_from, l.eta_site,
               ((l.plan_delivery_date + time '12:00')::timestamp at time zone 'Europe/Stockholm'))))) <= 86400;
  end if;
end $$;
revoke all on function public.load_driver_contacts() from public, anon;
grant execute on function public.load_driver_contacts() to authenticated;

-- ── escorts: kraj + CHECK krajowy (zamiast E.164) ───────────────────────────
alter table public.load_escorts
  add column if not exists driver_phone_country char(2) not null default 'PL';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'load_escorts_driver_phone_country_chk'
  ) then
    alter table public.load_escorts
      add constraint load_escorts_driver_phone_country_chk
      check (driver_phone_country in ('PL', 'SE'));
  end if;
end $$;

-- usuń stary CHECK E.164 na driver_phone (nazwa generowana)
do $$
declare r record;
begin
  for r in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public' and t.relname = 'load_escorts'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%driver_phone%'
      and pg_get_constraintdef(c.oid) ilike '%+%[1-9]%'
  loop
    execute format('alter table public.load_escorts drop constraint %I', r.conname);
  end loop;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'load_escorts_driver_phone_national_chk'
  ) then
    alter table public.load_escorts
      add constraint load_escorts_driver_phone_national_chk
      check (driver_phone is null or driver_phone ~ '^[0-9]{7,12}$');
  end if;
end $$;

update public.load_escorts
set
  driver_phone_country = case
    when driver_phone like '+46%' then 'SE'
    when driver_phone like '+48%' then 'PL'
    else driver_phone_country
  end,
  driver_phone = case
    when driver_phone ~ '^\+?00?48' then regexp_replace(regexp_replace(driver_phone, '\D', '', 'g'), '^(00)?48', '')
    when driver_phone ~ '^\+?00?46' then
      case
        when regexp_replace(regexp_replace(driver_phone, '\D', '', 'g'), '^(00)?46', '') like '0%'
          then regexp_replace(regexp_replace(driver_phone, '\D', '', 'g'), '^(00)?46', '')
        else '0' || regexp_replace(regexp_replace(driver_phone, '\D', '', 'g'), '^(00)?46', '')
      end
    when driver_phone like '+%' then regexp_replace(driver_phone, '\D', '', 'g')
    else regexp_replace(coalesce(driver_phone, ''), '\D', '', 'g')
  end
where driver_phone is not null
  and (driver_phone like '+%' or driver_phone like '00%' or driver_phone ~ '[^0-9]');

update public.load_escorts set driver_phone = nullif(driver_phone, '') where driver_phone is not null;

grant select (driver_phone_country) on public.load_escorts to authenticated;

-- load_escort_contacts: też kraj
drop function if exists public.load_escort_contacts();
create or replace function public.load_escort_contacts()
returns table (load_id uuid, seq smallint, driver_name text, driver_phone text, driver_phone_country char(2))
language plpgsql stable security definer set search_path = public as $$
declare v_role user_role; v_org uuid;
begin
  select u.role, u.org_id into v_role, v_org from app_users u where u.auth_id = auth.uid() and u.active;
  if v_role is null then return; end if;
  if v_role in ('HHL_ADMIN', 'HHL_OPS') then
    return query select e.load_id, e.seq, e.driver_name, e.driver_phone, e.driver_phone_country
      from load_escorts e
     where e.driver_name is not null or e.driver_phone is not null;
  elsif v_role in ('CARRIER_DISPATCH', 'CARRIER_USER') then
    return query select e.load_id, e.seq, e.driver_name, e.driver_phone, e.driver_phone_country
      from load_escorts e join loads l on l.id = e.load_id
     where l.carrier_org_id = v_org and (e.driver_name is not null or e.driver_phone is not null);
  end if;
end $$;
revoke all on function public.load_escort_contacts() from public, anon;
grant execute on function public.load_escort_contacts() to authenticated;

-- ── helper: E.164 tylko przy wysyłce SMS ─────────────────────────────────────
create or replace function public.driver_phone_e164(p_national text, p_country char(2) default 'PL')
returns text
language plpgsql
immutable
set search_path = public
as $$
declare d text;
begin
  d := regexp_replace(coalesce(p_national, ''), '\D', '', 'g');
  if d = '' then return null; end if;
  if coalesce(p_country, 'PL') = 'PL' then
    if d like '48%' and length(d) >= 11 then d := substr(d, 3); end if;
    return '+48' || d;
  end if;
  if p_country = 'SE' then
    if d like '46%' then d := substr(d, 3); end if;
    if left(d, 1) = '0' then d := substr(d, 2); end if;
    return '+46' || d;
  end if;
  return null;
end $$;

revoke all on function public.driver_phone_e164(text, char) from public, anon;
grant execute on function public.driver_phone_e164(text, char) to authenticated;

-- ── SMS: issue_driver_token_sms — krajowy w loads, E.164 w outbox ───────────
create or replace function public.issue_driver_token_sms(p_load_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_token text;
  v_load loads%rowtype;
  v_sms uuid;
  v_to text;
begin
  if (current_app_user_id() is not null) is not true then
    raise exception 'Brak aktywnego konta' using errcode = '42501';
  end if;
  select * into v_load from loads where id = p_load_id;
  v_to := driver_phone_e164(v_load.driver_phone, v_load.driver_phone_country);
  if (found and v_to ~ '^\+[1-9][0-9]{7,14}$') is not true then
    raise exception 'Brak numeru telefonu kierowcy (krajowy, np. 601234567) — link można tylko skopiować' using errcode = '22023';
  end if;
  v_token := issue_driver_token(p_load_id);
  v_sms := sms_enqueue('DRIVER_LINK', p_load_id, v_to, v_load.driver_locale,
                       jsonb_build_object('nr', coalesce(v_load.order_no, '—'), 'url', 'https://tower.log-mar.pl/#/driver/' || v_token),
                       100, null, true);
  return jsonb_build_object('token', v_token, 'sms_id', v_sms);
end $$;

revoke all on function public.issue_driver_token_sms(uuid) from public, anon;
grant execute on function public.issue_driver_token_sms(uuid) to authenticated;

-- ── wyzwalacz zmian transportu ──────────────────────────────────────────────
create or replace function public.trg_sms_load_changes() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  s record;
  v_nr text;
  v_to text;
begin
  if (new.driver_phone is not null and sms_has_driver_link(new.id)) is not true then return new; end if;
  v_to := driver_phone_e164(new.driver_phone, new.driver_phone_country);
  if (v_to is not null) is not true then return new; end if;
  v_nr := coalesce(new.order_no, '—');
  if new.status = 'CANCELLED' and old.status is distinct from 'CANCELLED' then
    perform sms_enqueue('LOAD_CANCELLED', new.id, v_to, new.driver_locale, jsonb_build_object('nr', v_nr),
                        100, 'LOAD_CANCELLED:' || new.id);
    return new;
  end if;
  if new.status in ('CANCELLED', 'UNLOADED', 'DELIVERED') then return new; end if;
  if new.plan_load_from is not null and new.plan_load_to is not null
     and (abs(extract(epoch from (new.plan_load_from - coalesce(old.plan_load_from, new.plan_load_from)))) >= 1800
          or abs(extract(epoch from (new.plan_load_to - coalesce(old.plan_load_to, new.plan_load_to)))) >= 1800)
     and new.status in ('PLANNED', 'RESOURCES_PENDING', 'DOCS_PENDING', 'READY') then
    perform sms_enqueue('WINDOW_CHANGE', new.id, v_to, new.driver_locale,
      jsonb_build_object('nr', v_nr, 'okno', 'LOAD', 'dt', sms_fmt_dt(new.plan_load_from), 't2', to_char(new.plan_load_to at time zone 'Europe/Warsaw', 'HH24:MI')),
      100, 'WINDOW_CHANGE:LOAD:' || new.id || ':' || new.plan_load_from || ':' || new.plan_load_to);
  end if;
  if new.plan_delivery_from is not null and new.plan_delivery_to is not null
     and (abs(extract(epoch from (new.plan_delivery_from - coalesce(old.plan_delivery_from, new.plan_delivery_from)))) >= 1800
          or abs(extract(epoch from (new.plan_delivery_to - coalesce(old.plan_delivery_to, new.plan_delivery_to)))) >= 1800) then
    perform sms_enqueue('WINDOW_CHANGE', new.id, v_to, new.driver_locale,
      jsonb_build_object('nr', v_nr, 'okno', 'DELIVERY', 'dt', sms_fmt_dt(new.plan_delivery_from), 't2', to_char(new.plan_delivery_to at time zone 'Europe/Warsaw', 'HH24:MI')),
      100, 'WINDOW_CHANGE:DELIVERY:' || new.id || ':' || new.plan_delivery_from || ':' || new.plan_delivery_to);
  end if;
  if new.sailing_id is distinct from old.sailing_id and new.sailing_id is not null then
    select v.name as statek, coalesce(sa.delayed_departure_at, sa.departure_at) as dep into s
      from sailings sa left join vessels v on v.id = sa.vessel_id where sa.id = new.sailing_id;
    perform sms_enqueue('SAILING_CHANGE', new.id, v_to, new.driver_locale,
      jsonb_build_object('nr', v_nr, 'statek', coalesce(s.statek, '—'), 'dt', coalesce(sms_fmt_dt(s.dep), '—'), 'ref', coalesce(new.ferry_booking_ref, '—')),
      100, 'SAILING_CHANGE:' || new.id || ':' || new.sailing_id || ':' || coalesce(s.dep::text, ''));
  end if;
  return new;
end $$;

-- ── SMS 8 / 9 ───────────────────────────────────────────────────────────────
create or replace function public.trg_sms_gps_silent() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  l loads%rowtype;
  v_last timestamptz;
  v_min int;
  v_to text;
begin
  if new.kind <> 'SILENT_VEHICLE' or new.load_id is null then return new; end if;
  select * into l from loads where id = new.load_id;
  v_to := driver_phone_e164(l.driver_phone, l.driver_phone_country);
  if (found and v_to is not null
      and l.status in ('AT_LOADING', 'IN_TRANSIT_PL', 'AT_PORT_GDANSK', 'AT_PORT_NYNASHAMN', 'IN_TRANSIT_SE', 'AT_SITE')
      and sms_has_driver_link(l.id)) is not true then
    return new;
  end if;
  select max(ts) into v_last from positions where load_id = l.id;
  v_min := greatest(coalesce(round(extract(epoch from (now() - v_last)) / 60)::int, 0), 1);
  perform sms_enqueue('GPS_SILENT', l.id, v_to, l.driver_locale,
    jsonb_build_object('nr', coalesce(l.order_no, '—'), 'min', v_min::text),
    100, 'GPS_SILENT:' || l.id || ':' || floor(extract(epoch from now()) / 10800)::bigint);
  return new;
end $$;

create or replace function public.sms_unload_confirm_scan(p_now timestamptz default now()) returns int
language plpgsql security definer set search_path = public as $$
declare
  l record;
  n int := 0;
  v_id uuid;
  v_to text;
begin
  for l in
    select x.* from loads x
     where x.status = 'AT_SITE' and x.driver_phone is not null
       and not exists (select 1 from load_events e where e.load_id = x.id and e.event_type = 'MILESTONE_UNLOADED')
       and coalesce((select max(e.occurred_at) from load_events e where e.load_id = x.id
                      and (e.event_type = 'STATUS_AT_SITE' or (e.event_type = 'STATUS_AUTO' and e.payload->>'to' = 'AT_SITE'))),
                    x.updated_at) <= p_now - interval '2 hours'
  loop
    if (sms_has_driver_link(l.id)) is not true then continue; end if;
    v_to := driver_phone_e164(l.driver_phone, l.driver_phone_country);
    if (v_to is not null) is not true then continue; end if;
    v_id := sms_enqueue('UNLOAD_CONFIRM', l.id, v_to, l.driver_locale,
      jsonb_build_object('nr', coalesce(l.order_no, '—')), 100, 'UNLOAD_CONFIRM:' || l.id);
    if v_id is not null then n := n + 1; end if;
  end loop;
  return n;
end $$;

-- ── sailing cancel/change (0067) — E.164 z kolumn krajowych ─────────────────
create or replace function public.trg_sms_sailing_changes() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  l record;
  v_name text;
  v_dep timestamptz;
  v_to text;
begin
  select name into v_name from vessels where id = new.vessel_id;
  v_dep := coalesce(new.delayed_departure_at, new.departure_at);
  for l in select * from loads where sailing_id = new.id and driver_phone is not null
             and status in ('PLANNED', 'RESOURCES_PENDING', 'DOCS_PENDING', 'READY', 'AT_LOADING', 'IN_TRANSIT_PL', 'AT_PORT_GDANSK') loop
    if (sms_has_driver_link(l.id)) is not true then continue; end if;
    v_to := driver_phone_e164(l.driver_phone, l.driver_phone_country);
    if (v_to is not null) is not true then continue; end if;
    if new.status = 'ODWOLANY' and old.status is distinct from 'ODWOLANY' then
      perform sms_enqueue('SAILING_CANCELLED', l.id, v_to, l.driver_locale,
        jsonb_build_object('nr', coalesce(l.order_no, '—'), 'statek', coalesce(v_name, '—'), 'dt', coalesce(sms_fmt_dt(new.departure_at), '—')),
        100, 'SAILING_CANCELLED:' || l.id || ':' || new.id);
    elsif new.status <> 'ODWOLANY' and abs(extract(epoch from (v_dep - coalesce(old.delayed_departure_at, old.departure_at)))) >= 1800 then
      perform sms_enqueue('SAILING_CHANGE', l.id, v_to, l.driver_locale,
        jsonb_build_object('nr', coalesce(l.order_no, '—'), 'statek', coalesce(v_name, '—'), 'dt', coalesce(sms_fmt_dt(v_dep), '—'), 'ref', coalesce(l.ferry_booking_ref, '—')),
        100, 'SAILING_CHANGE:' || l.id || ':' || new.id || ':' || v_dep);
    end if;
  end loop;
  return new;
end $$;

-- ── escorts_set: numer krajowy + kraj ───────────────────────────────────────
create or replace function public.load_escorts_set(p_load uuid, p_escorts jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_load loads%rowtype;
  v_old jsonb;
  v_n int;
  e jsonb;
  i int := 0;
  v_phone text;
  v_name text;
  v_country char(2);
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
    v_phone := nullif(regexp_replace(coalesce(e->>'driver_phone', ''), '\D', '', 'g'), '');
    v_country := coalesce(nullif(upper(btrim(coalesce(e->>'driver_phone_country', ''))), ''), 'PL');
    if v_phone is not null then
      if v_phone like '48%' and length(v_phone) >= 11 then
        v_phone := substr(v_phone, 3); v_country := 'PL';
      elsif v_phone like '46%' and length(v_phone) >= 10 then
        v_phone := substr(v_phone, 3);
        if left(v_phone, 1) <> '0' then v_phone := '0' || v_phone; end if;
        v_country := 'SE';
      end if;
      if (v_phone ~ '^[0-9]{7,12}$') is not true then
        raise exception 'Telefon kierowcy pilota: numer krajowy (7–12 cyfr), bez kierunkowego' using errcode = '22023';
      end if;
      if (v_country in ('PL', 'SE')) is not true then
        raise exception 'Kraj numeru pilota: PL albo SE' using errcode = '22023';
      end if;
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
    v_phone := nullif(regexp_replace(coalesce(e->>'driver_phone', ''), '\D', '', 'g'), '');
    v_country := coalesce(nullif(upper(btrim(coalesce(e->>'driver_phone_country', ''))), ''), 'PL');
    if v_phone is not null then
      if v_phone like '48%' and length(v_phone) >= 11 then
        v_phone := substr(v_phone, 3); v_country := 'PL';
      elsif v_phone like '46%' and length(v_phone) >= 10 then
        v_phone := substr(v_phone, 3);
        if left(v_phone, 1) <> '0' then v_phone := '0' || v_phone; end if;
        v_country := 'SE';
      end if;
    end if;
    v_name := nullif(btrim(coalesce(e->>'driver_name', '')), '');
    insert into load_escorts (load_id, seq, company, plate, scope, driver_name, driver_phone, driver_phone_country, updated_by)
    values (p_load, i, btrim(e->>'company'), upper(btrim(e->>'plate')), coalesce(e->>'scope', 'PL_SE'), v_name, v_phone,
            coalesce(v_country, 'PL'), current_app_user_id());
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

revoke all on function public.load_escorts_set(uuid, jsonb) from public, anon;
grant execute on function public.load_escorts_set(uuid, jsonb) to authenticated;
