-- 0106 — DEC-5: SMS przy strefach (2+2 osoby, Śrem + Boden). Bez SMS do kierowców.
-- Listy odbiorców (admin), wyzwalacze APPROACH/ENTER, strefa zbliżania przed Śremem,
-- dedup per transport×zdarzenie, polskie SMS bez ogonków ≤160, limit 150/dobę.

-- ---------------------------------------------------------------- odbiorcy
alter table sms_outbox drop constraint if exists sms_outbox_kind_check;
alter table sms_outbox add constraint sms_outbox_kind_check check (kind in
  ('DRIVER_LINK','WINDOW_CHANGE','SAILING_CHANGE','SAILING_CANCELLED','LOAD_CANCELLED','TEST',
   'GPS_SILENT','UNLOAD_CONFIRM','ZONE_APPROACH','ZONE_ENTER','ZONE_TEST'));

create table if not exists sms_zone_recipients (
  id uuid primary key default gen_random_uuid(),
  list_key text not null check (list_key in ('LOAD_SREM', 'UNLOAD_BODEN')),
  slot smallint not null check (slot between 1 and 2),
  display_name text not null check (char_length(btrim(display_name)) between 1 and 80),
  phone_national text not null check (phone_national ~ '^[0-9]{7,12}$'),
  country char(2) not null default 'PL' check (country in ('PL', 'SE')),
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references app_users(id),
  unique (list_key, slot)
);
alter table sms_zone_recipients enable row level security;
revoke all on sms_zone_recipients from anon, authenticated;
grant select on sms_zone_recipients to authenticated;
drop policy if exists sms_zone_recipients_read on sms_zone_recipients;
create policy sms_zone_recipients_read on sms_zone_recipients for select to authenticated using (is_hhl());

-- ---------------------------------------------------------------- wyzwalacze (security_flags)
alter table security_flags drop constraint if exists security_flags_key_check;
alter table security_flags add constraint security_flags_key_check
  check (key in (
    'MFA_HHL_ADMIN', 'EXTERNAL_MESSAGING', 'PERMIT_REQUIRED_NON_STANDARD', 'FUEL_WOB_INGEST',
    'SMS_ZONE_APPROACH', 'SMS_ZONE_ENTER'
  ));
insert into security_flags (key, enabled, note) values
  ('SMS_ZONE_APPROACH', true, 'DEC-5: SMS przy wjeździe w strefę zbliżania (Śrem/Boden)'),
  ('SMS_ZONE_ENTER', true, 'DEC-5: SMS przy wjeździe na teren (załadunek/rozładunek)')
on conflict (key) do nothing;

-- ---------------------------------------------------------------- szablony (bez ogonków, ≤160)
create or replace function sms_strip_pl(p text) returns text
language sql immutable set search_path = public as $$
  select translate(coalesce(p, ''),
    'ąćęłńóśźżĄĆĘŁŃÓŚŹŻ',
    'acelnoszzACELNOSZZ')
$$;

create or replace function sms_zone_e164(p_national text, p_country char(2)) returns text
language plpgsql immutable set search_path = public as $$
declare d text;
begin
  d := regexp_replace(coalesce(p_national, ''), '\D', '', 'g');
  if d = '' then return null; end if;
  if p_country = 'PL' then
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

-- rozszerzenie render — ZONE_* (nadpisanie całego case z zachowaniem starych)
create or replace function sms_render(p_kind text, p_locale text, p jsonb) returns text
language plpgsql immutable set search_path = public as $$
declare t text; k text;
begin
  t := case p_kind || ':' || coalesce(p_locale, 'pl')
    when 'DRIVER_LINK:pl' then 'Watch Tower {nr}: link kierowcy {url} Nie udostepniaj.'
    when 'DRIVER_LINK:en' then 'Watch Tower {nr}: driver link {url} Do not share.'
    when 'DRIVER_LINK:sv' then 'Watch Tower {nr}: forarlank {url} Dela inte.'
    when 'WINDOW_CHANGE:pl' then 'Watch Tower {nr}: ZMIANA okna {okno_pl}: {dt}-{t2} (czas lokalny).'
    when 'WINDOW_CHANGE:en' then 'Watch Tower {nr}: CHANGED {okno_en} window: {dt}-{t2} (local time).'
    when 'WINDOW_CHANGE:sv' then 'Watch Tower {nr}: ANDRAT {okno_sv}: {dt}-{t2} (lokal tid).'
    when 'SAILING_CHANGE:pl' then 'Watch Tower {nr}: ZMIANA PROMU: {statek}, Gdansk {dt}, rezerwacja {ref}.'
    when 'SAILING_CHANGE:en' then 'Watch Tower {nr}: FERRY CHANGED: {statek}, Gdansk {dt}, booking {ref}.'
    when 'SAILING_CHANGE:sv' then 'Watch Tower {nr}: NY FARJA: {statek}, Gdansk {dt}, bokning {ref}.'
    when 'SAILING_CANCELLED:pl' then 'Watch Tower {nr}: PROM {statek} {dt} ODWOLANY. Czekaj na nowy rejs.'
    when 'SAILING_CANCELLED:en' then 'Watch Tower {nr}: FERRY {statek} {dt} CANCELLED. Wait for a new sailing.'
    when 'SAILING_CANCELLED:sv' then 'Watch Tower {nr}: FARJA {statek} {dt} INSTALLD. Vanta pa ny avgang.'
    when 'LOAD_CANCELLED:pl' then 'Watch Tower {nr}: TRANSPORT ANULOWANY.'
    when 'LOAD_CANCELLED:en' then 'Watch Tower {nr}: TRANSPORT CANCELLED.'
    when 'LOAD_CANCELLED:sv' then 'Watch Tower {nr}: TRANSPORT INSTALLD.'
    when 'GPS_SILENT:pl' then 'Watch Tower {nr}: brak pozycji GPS od {min} min. Otworz link i zostaw strone wlaczona.'
    when 'GPS_SILENT:en' then 'Watch Tower {nr}: no GPS position for {min} min. Open your link and keep the page open.'
    when 'GPS_SILENT:sv' then 'Watch Tower {nr}: ingen GPS-position pa {min} min. Oppna lankken och lat sidan vara oppen.'
    when 'UNLOAD_CONFIRM:pl' then 'Watch Tower {nr}: jestes na placu Stegra Boden. Po rozladunku potwierdz ROZLADOWANO w linku.'
    when 'UNLOAD_CONFIRM:en' then 'Watch Tower {nr}: you are at Stegra Boden. After unloading confirm UNLOADED in your link.'
    when 'UNLOAD_CONFIRM:sv' then 'Watch Tower {nr}: du ar pa Stegra Boden. Bekrafta LOSSAD i lankken efter lossning.'
    when 'TEST:pl' then 'Watch Tower: SMS testowy bramki.'
    when 'TEST:en' then 'Watch Tower: gateway test SMS.'
    when 'TEST:sv' then 'Watch Tower: test-SMS fran gatewayen.'
    when 'ZONE_APPROACH:pl' then 'Auto {rej} z {wysylka} zbliza sie, ok. {eta}'
    when 'ZONE_APPROACH:en' then 'Truck {rej} from {wysylka} approaching, eta {eta}'
    when 'ZONE_APPROACH:sv' then 'Lastbil {rej} fran {wysylka} narmar sig, ca {eta}'
    when 'ZONE_ENTER:pl' then 'Auto {rej} z {wysylka} wjechalo na {miejsce}'
    when 'ZONE_ENTER:en' then 'Truck {rej} from {wysylka} entered {miejsce}'
    when 'ZONE_ENTER:sv' then 'Lastbil {rej} fran {wysylka} korde in pa {miejsce}'
  end;
  if t is null then raise exception 'Nieznany szablon SMS: % / %', p_kind, p_locale; end if;
  if p ? 'okno' then
    p := p || case p->>'okno' when 'LOAD' then '{"okno_pl":"zaladunku","okno_en":"loading","okno_sv":"lastningsfonster"}'::jsonb
                              else '{"okno_pl":"rozladunku","okno_en":"unloading","okno_sv":"lossningsfonster"}'::jsonb end;
  end if;
  for k in select jsonb_object_keys(p) loop
    t := replace(t, '{' || k || '}', coalesce(left(p->>k, 120), ''));
  end loop;
  if t ~ '\{[a-z0-9_]+\}' then raise exception 'Szablon SMS % bez wartości: %', p_kind, substring(t from '\{[a-z0-9_]+\}'); end if;
  t := sms_strip_pl(t);
  if char_length(t) > 160 then t := left(t, 160); end if;
  return t;
end $$;

-- ---------------------------------------------------------------- kolejkowanie stref
create or replace function sms_zone_daily_count() returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from sms_outbox
  where kind in ('ZONE_APPROACH', 'ZONE_ENTER', 'ZONE_TEST')
    and created_at >= date_trunc('day', now() at time zone 'Europe/Warsaw') at time zone 'Europe/Warsaw'
$$;
revoke all on function sms_zone_daily_count() from public, anon, authenticated;
grant execute on function sms_zone_daily_count() to authenticated;

create or replace function sms_zone_enqueue_for_event(
  p_load uuid, p_list text, p_kind text, p_place text, p_eta text default null
) returns int
language plpgsql security definer set search_path = public as $$
declare
  r record; n int := 0; v_to text; v_id uuid; v_plate text; v_code text; v_eta text;
begin
  if (p_list in ('LOAD_SREM', 'UNLOAD_BODEN')) is not true then return 0; end if;
  if (p_kind in ('ZONE_APPROACH', 'ZONE_ENTER')) is not true then return 0; end if;
  if p_kind = 'ZONE_APPROACH' and coalesce((select enabled from security_flags where key = 'SMS_ZONE_APPROACH'), false) is not true then
    return 0;
  end if;
  if p_kind = 'ZONE_ENTER' and coalesce((select enabled from security_flags where key = 'SMS_ZONE_ENTER'), false) is not true then
    return 0;
  end if;
  if sms_zone_daily_count() >= 150 then
    insert into notifications (channel, recipient, user_id, load_id, template, payload, dedup_key)
    select 'EMAIL', u.email, u.id, p_load, 'SMS_FALLBACK',
           jsonb_build_object('kind', 'ZONE_LIMIT', 'text', 'Limit 150 SMS stref na dobe wyczerpany'),
           'smszone-limit:' || to_char(now(), 'YYYYMMDD') || ':' || u.id::text
    from app_users u
    where u.role = 'HHL_ADMIN' and u.active and u.email is not null
    on conflict do nothing;
    return 0;
  end if;

  select coalesce(nullif(l.tractor_plate, ''), '?'), coalesce(nullif(l.order_no, ''), left(l.id::text, 8))
    into v_plate, v_code from loads l where l.id = p_load;
  v_eta := coalesce(nullif(p_eta, ''), '—');

  for r in
    select * from sms_zone_recipients
    where list_key = p_list and active is true
    order by slot
  loop
    v_to := sms_zone_e164(r.phone_national, r.country);
    if v_to is null then continue; end if;
    v_id := sms_enqueue(
      p_kind, p_load, v_to, case when r.country = 'SE' then 'sv' else 'pl' end,
      jsonb_build_object(
        'rej', sms_strip_pl(v_plate),
        'wysylka', sms_strip_pl(v_code),
        'miejsce', sms_strip_pl(p_place),
        'eta', sms_strip_pl(v_eta)
      ),
      80,
      p_kind || ':' || p_load::text || ':' || p_list || ':' || r.slot::text,
      false
    );
    if v_id is not null then n := n + 1; end if;
  end loop;
  return n;
end $$;
revoke all on function sms_zone_enqueue_for_event(uuid, text, text, text, text) from public, anon, authenticated;

-- wyzwalacz po GEOFENCE_ENTER
create or replace function sms_zone_on_geofence_enter() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_kind text; v_name text; v_country char(2); v_list text; v_sms_kind text; v_place text;
begin
  if new.event_type is distinct from 'GEOFENCE_ENTER' then return null; end if;
  v_kind := new.payload->>'geofence_kind';
  v_name := coalesce(new.payload->>'geofence_name', '');
  select g.country into v_country from geofences g where g.id = (new.payload->>'geofence_id')::uuid;

  v_list := null; v_sms_kind := null;
  if v_kind = 'LOADING' and coalesce(v_country, 'PL') = 'PL' then
    v_list := 'LOAD_SREM'; v_sms_kind := 'ZONE_ENTER'; v_place := 'zaladunek Srem';
  elsif v_kind = 'PRE_ARRIVAL' and coalesce(v_country, 'PL') = 'PL' then
    v_list := 'LOAD_SREM'; v_sms_kind := 'ZONE_APPROACH'; v_place := 'Srem';
  elsif v_kind = 'SITE' and coalesce(v_country, 'SE') = 'SE' then
    v_list := 'UNLOAD_BODEN'; v_sms_kind := 'ZONE_ENTER'; v_place := 'plac Stegra Boden';
  elsif v_kind = 'PRE_ARRIVAL' and coalesce(v_country, 'SE') = 'SE' then
    v_list := 'UNLOAD_BODEN'; v_sms_kind := 'ZONE_APPROACH'; v_place := 'Boden';
  elsif v_name ilike '%Srem%' and v_kind = 'CUSTOM' then
    v_list := 'LOAD_SREM'; v_sms_kind := 'ZONE_APPROACH'; v_place := 'Srem';
  end if;

  if v_list is not null then
    perform sms_zone_enqueue_for_event(new.load_id, v_list, v_sms_kind, v_place, null);
  end if;
  return null;
end $$;

drop trigger if exists trg_sms_zone_geofence on load_events;
create trigger trg_sms_zone_geofence
  after insert on load_events
  for each row when (new.event_type = 'GEOFENCE_ENTER')
  execute function sms_zone_on_geofence_enter();

-- ---------------------------------------------------------------- admin RPC
create or replace function admin_sms_zone_recipient_set(
  p_list text, p_slot int, p_name text, p_phone text, p_country char(2) default 'PL', p_active boolean default true
) returns void
language plpgsql security definer set search_path = public as $$
declare v_nat text; v_cty char(2);
begin
  if (current_app_role() = 'HHL_ADMIN') is not true then raise exception 'Tylko administrator HHL' using errcode = '42501'; end if;
  if (p_list in ('LOAD_SREM', 'UNLOAD_BODEN') and p_slot between 1 and 2) is not true then
    raise exception 'Lista lub slot niepoprawny' using errcode = '22023';
  end if;
  v_cty := case when p_country in ('PL', 'SE') then p_country else 'PL' end;
  -- TEL-1: normalizacja do numeru krajowego
  v_nat := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  if v_nat like '00%' then v_nat := substr(v_nat, 3); end if;
  if v_cty = 'PL' and v_nat like '48%' and length(v_nat) >= 11 then v_nat := substr(v_nat, 3); end if;
  if v_cty = 'SE' and v_nat like '46%' then
    v_nat := substr(v_nat, 3);
    if left(v_nat, 1) <> '0' then v_nat := '0' || v_nat; end if;
  end if;
  if (v_nat ~ '^[0-9]{7,12}$') is not true then raise exception 'Numer telefonu niepoprawny' using errcode = '22023'; end if;
  if nullif(btrim(p_name), '') is null then raise exception 'Imie wymagane' using errcode = '22023'; end if;

  insert into sms_zone_recipients (list_key, slot, display_name, phone_national, country, active, updated_by)
  values (p_list, p_slot, btrim(p_name), v_nat, v_cty, coalesce(p_active, true), current_app_user_id())
  on conflict (list_key, slot) do update set
    display_name = excluded.display_name,
    phone_national = excluded.phone_national,
    country = excluded.country,
    active = excluded.active,
    updated_at = now(),
    updated_by = excluded.updated_by;

  insert into audit_log (user_id, action, entity, entity_id, new_value)
  values (current_app_user_id(), 'SMS_ZONE_RECIPIENT_SET', 'sms_zone_recipients', p_list || ':' || p_slot::text,
          jsonb_build_object('name', btrim(p_name), 'country', v_cty, 'active', p_active));
end $$;
revoke all on function admin_sms_zone_recipient_set(text, int, text, text, char, boolean) from public, anon;
grant execute on function admin_sms_zone_recipient_set(text, int, text, text, char, boolean) to authenticated;

create or replace function admin_sms_zone_trigger_set(p_key text, p_enabled boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if (current_app_role() = 'HHL_ADMIN') is not true then raise exception 'Tylko administrator HHL' using errcode = '42501'; end if;
  if (p_key in ('SMS_ZONE_APPROACH', 'SMS_ZONE_ENTER')) is not true then
    raise exception 'Nieznany wyzwalacz' using errcode = '22023';
  end if;
  update security_flags set enabled = coalesce(p_enabled, false), updated_at = now(), updated_by = current_app_user_id()
  where key = p_key;
  insert into audit_log (user_id, action, entity, entity_id, new_value)
  values (current_app_user_id(), 'SMS_ZONE_TRIGGER_SET', 'security_flags', p_key, jsonb_build_object('enabled', p_enabled));
end $$;
revoke all on function admin_sms_zone_trigger_set(text, boolean) from public, anon;
grant execute on function admin_sms_zone_trigger_set(text, boolean) to authenticated;

create or replace function admin_sms_zone_test(p_list text) returns int
language plpgsql security definer set search_path = public as $$
declare r record; n int := 0; v_to text; v_id uuid;
begin
  if (current_app_role() = 'HHL_ADMIN') is not true then raise exception 'Tylko administrator HHL' using errcode = '42501'; end if;
  if (p_list in ('LOAD_SREM', 'UNLOAD_BODEN')) is not true then raise exception 'Lista niepoprawna' using errcode = '22023'; end if;
  for r in select * from sms_zone_recipients where list_key = p_list and active is true order by slot loop
    v_to := sms_zone_e164(r.phone_national, r.country);
    if v_to is null then continue; end if;
    v_id := sms_enqueue('TEST', null, v_to, case when r.country = 'SE' then 'sv' else 'pl' end, '{}'::jsonb, 100,
                        'ZONE_TEST:' || p_list || ':' || r.slot::text || ':' || to_char(now(), 'YYYYMMDDHH24MI'), false);
    if v_id is not null then n := n + 1; end if;
  end loop;
  return n;
end $$;
revoke all on function admin_sms_zone_test(text) from public, anon;
grant execute on function admin_sms_zone_test(text) to authenticated;

-- ---------------------------------------------------------------- strefa zbliżania przed Śremem (PRE_ARRIVAL, PL)
do $$
declare v_proj uuid;
begin
  select id into v_proj from projects where code in ('STEGRA_BODEN', 'STEGRA') order by case code when 'STEGRA_BODEN' then 0 else 1 end limit 1;
  if v_proj is null then return; end if;
  if exists (select 1 from geofences where project_id = v_proj and name = 'Bufor przed Sremem') then return; end if;
  insert into geofences (
    project_id, name, kind, country, geom, hysteresis_m, dwell_seconds, debounce_fixes,
    notify_enter, notify_exit, notify_dwell, notify_orgs, active, sort_order
  )
  values (
    v_proj, 'Bufor przed Sremem', 'PRE_ARRIVAL', 'PL',
    make_circle_fence(52.07391, 17.0246, 50000),
    1000, 0, 2, true, false, false, '{}', true, 5
  );
end $$;
