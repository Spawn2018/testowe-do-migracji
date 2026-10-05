-- =====================================================================
-- 0177 — H-12 kalendarz świąt PL/SE; B-10 odczyty czatu; H-10 parametry ETA+wiatr WYŁĄCZONE
-- TELM_EMTRACK_WEB / H1 / H3 / H6 / pilot_notify_redirect — bez zmian.
-- =====================================================================

-- H-12: święta ruchu ciężarówek (Europe/Warsaw / Europe/Stockholm)
create table if not exists public.truck_ban_holidays (
  country   char(2) not null check (country in ('PL', 'SE')),
  day       date not null,
  name      text not null,
  source    text not null default 'H-12 05.10.2026',
  primary key (country, day)
);
alter table public.truck_ban_holidays enable row level security;
revoke all on public.truck_ban_holidays from anon;
grant select on public.truck_ban_holidays to authenticated;
drop policy if exists truck_ban_holidays_read on public.truck_ban_holidays;
create policy truck_ban_holidays_read on public.truck_ban_holidays for select to authenticated using (true);

comment on table public.truck_ban_holidays is
  'H-12: dni świąteczne z zakazem/ograniczeniem ruchu ciężarówek (PL/SE). Weekendy osobno w kodzie.';

-- PL 2026–2027 (ustawowe + typowe ograniczenia TIR — lista robocza; źródło: kalendarz RP)
insert into public.truck_ban_holidays (country, day, name) values
  ('PL', '2026-01-01', 'Nowy Rok'),
  ('PL', '2026-01-06', 'Trzech Króli'),
  ('PL', '2026-04-05', 'Wielkanoc'),
  ('PL', '2026-04-06', 'Poniedziałek Wielkanocny'),
  ('PL', '2026-05-01', 'Święto Pracy'),
  ('PL', '2026-05-03', 'Święto Konstytucji 3 Maja'),
  ('PL', '2026-05-24', 'Boże Ciało'),
  ('PL', '2026-08-15', 'Wniebowzięcie NMP'),
  ('PL', '2026-11-01', 'Wszystkich Świętych'),
  ('PL', '2026-11-11', 'Święto Niepodległości'),
  ('PL', '2026-12-25', 'Boże Narodzenie'),
  ('PL', '2026-12-26', 'Drugi dzień BN'),
  ('PL', '2027-01-01', 'Nowy Rok'),
  ('PL', '2027-01-06', 'Trzech Króli'),
  ('PL', '2027-03-28', 'Wielkanoc'),
  ('PL', '2027-03-29', 'Poniedziałek Wielkanocny'),
  ('PL', '2027-05-01', 'Święto Pracy'),
  ('PL', '2027-05-03', 'Święto Konstytucji 3 Maja'),
  ('PL', '2027-05-27', 'Boże Ciało'),
  ('PL', '2027-08-15', 'Wniebowzięcie NMP'),
  ('PL', '2027-11-01', 'Wszystkich Świętych'),
  ('PL', '2027-11-11', 'Święto Niepodległości'),
  ('PL', '2027-12-25', 'Boże Narodzenie'),
  ('PL', '2027-12-26', 'Drugi dzień BN'),
  -- SE 2026–2027 (röda dagar — lista robocza)
  ('SE', '2026-01-01', 'Nyårsdagen'),
  ('SE', '2026-01-06', 'Trettondedag jul'),
  ('SE', '2026-04-03', 'Långfredagen'),
  ('SE', '2026-04-05', 'Påskdagen'),
  ('SE', '2026-04-06', 'Annandag påsk'),
  ('SE', '2026-05-01', 'Första maj'),
  ('SE', '2026-05-14', 'Kristi himmelsfärdsdag'),
  ('SE', '2026-06-06', 'Sveriges nationaldag'),
  ('SE', '2026-06-19', 'Midsommarafton'),
  ('SE', '2026-06-20', 'Midsommardagen'),
  ('SE', '2026-10-31', 'Allhelgonaafton'),
  ('SE', '2026-12-24', 'Julafton'),
  ('SE', '2026-12-25', 'Juldagen'),
  ('SE', '2026-12-26', 'Annandag jul'),
  ('SE', '2026-12-31', 'Nyårsafton'),
  ('SE', '2027-01-01', 'Nyårsdagen'),
  ('SE', '2027-01-06', 'Trettondedag jul'),
  ('SE', '2027-03-26', 'Långfredagen'),
  ('SE', '2027-03-28', 'Påskdagen'),
  ('SE', '2027-03-29', 'Annandag påsk'),
  ('SE', '2027-05-01', 'Första maj'),
  ('SE', '2027-05-06', 'Kristi himmelsfärdsdag'),
  ('SE', '2027-06-06', 'Sveriges nationaldag'),
  ('SE', '2027-06-25', 'Midsommarafton'),
  ('SE', '2027-06-26', 'Midsommardagen'),
  ('SE', '2027-11-06', 'Allhelgonaafton'),
  ('SE', '2027-12-24', 'Julafton'),
  ('SE', '2027-12-25', 'Juldagen'),
  ('SE', '2027-12-26', 'Annandag jul'),
  ('SE', '2027-12-31', 'Nyårsafton')
on conflict (country, day) do update set name = excluded.name, source = excluded.source;

create or replace function public.truck_ban_holiday_hit(p_country char(2), p_ts timestamptz)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from truck_ban_holidays h
     where h.country = p_country
       and h.day = (p_ts at time zone case when p_country = 'SE' then 'Europe/Stockholm' else 'Europe/Warsaw' end)::date
  );
$$;
revoke all on function public.truck_ban_holiday_hit(char, timestamptz) from public, anon;
grant execute on function public.truck_ban_holiday_hit(char, timestamptz) to authenticated, service_role;

-- H-10: parametry korekty ETA przez wiatr — WYŁĄCZONE do akceptacji właściciela
insert into public.app_parameters (key, value, label, source) values
  ('H10_ETA_WIND_ENABLED', 0, 'H-10: korekta ETA przez wiatr (0=wyłączone do akceptacji; ostrzeżenie ≥15 m/s działa osobno)', 'H-10 propozycja 05.10.2026'),
  ('H10_ETA_WIND_SPEED_FACTOR', 0.70, 'H-10 wstępne: mnożnik prędkości zestawu przy porywach ≥15 m/s (propozycja)', 'H-10 propozycja 05.10.2026'),
  ('H10_ETA_WIND_STOP_MS', 25, 'H-10 wstępne: porywy ≥ tej wartości → postój do spadku poniżej 15 (propozycja)', 'H-10 propozycja 05.10.2026')
on conflict (key) do update set label = excluded.label, source = excluded.source;
-- nie nadpisuj value jeśli właściciel już zmienił

-- B-10g: odczyty wiadomości czatu
create table if not exists public.load_message_reads (
  message_id bigint not null references public.load_messages(id) on delete cascade,
  user_id    uuid not null references public.app_users(id) on delete cascade,
  read_at    timestamptz not null default now(),
  primary key (message_id, user_id)
);
create index if not exists load_message_reads_msg_idx on public.load_message_reads (message_id);
alter table public.load_message_reads enable row level security;
revoke all on public.load_message_reads from anon;
grant select, insert on public.load_message_reads to authenticated;

drop policy if exists load_message_reads_select on public.load_message_reads;
create policy load_message_reads_select on public.load_message_reads for select to authenticated using (
  exists (
    select 1 from load_messages m
     where m.id = load_message_reads.message_id
       and (is_hhl() or current_org_kind() = any (m.visible_to))
  )
);
drop policy if exists load_message_reads_insert on public.load_message_reads;
create policy load_message_reads_insert on public.load_message_reads for insert to authenticated with check (
  user_id = current_app_user_id()
  and exists (
    select 1 from load_messages m
     where m.id = message_id
       and (is_hhl() or current_org_kind() = any (m.visible_to))
  )
);

create or replace function public.mark_load_message_read(p_message bigint)
returns timestamptz
language plpgsql security definer set search_path = public as $$
declare v_uid uuid; v_at timestamptz := now();
begin
  v_uid := current_app_user_id();
  if v_uid is null then raise exception 'Brak użytkownika' using errcode = '42501'; end if;
  insert into load_message_reads (message_id, user_id, read_at)
  values (p_message, v_uid, v_at)
  on conflict (message_id, user_id) do update set read_at = excluded.read_at
  returning read_at into v_at;
  return v_at;
end $$;
revoke all on function public.mark_load_message_read(bigint) from public, anon;
grant execute on function public.mark_load_message_read(bigint) to authenticated;

create or replace function public.load_message_read_list(p_message bigint)
returns table (user_id uuid, full_name text, org_code text, read_at timestamptz)
language sql stable security definer set search_path = public as $$
  select r.user_id, coalesce(u.full_name, u.email::text), o.code, r.read_at
    from load_message_reads r
    join app_users u on u.id = r.user_id
    left join organizations o on o.id = u.org_id
   where r.message_id = p_message
   order by r.read_at;
$$;
revoke all on function public.load_message_read_list(bigint) from public, anon;
grant execute on function public.load_message_read_list(bigint) to authenticated;
