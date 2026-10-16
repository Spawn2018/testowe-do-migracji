-- C3 (D-20261015-0300-01, Cz13, Cz25, D-20261016-0330, 1345 pkt 3.8, 1410 pkt 7, 1620 pkt 5.1–5.2, 1750 pkt 3.5)
-- Macierz po zdarzeniu (nie po 5 grupach). Wysyłka czyta wiersz zdarzenia i ustawienie osoby.
-- KSH nie dostaje stref ani zadań innych firm. Czat: visible_to, bez autora, telefon mimo C1 pkt 4, bez e-maila.

alter table public.notification_matrix
  add column if not exists event_key text,
  add column if not exists fixed_in_app boolean not null default false,
  add column if not exists fixed_email boolean not null default false,
  add column if not exists fixed_push boolean not null default false,
  add column if not exists risks_only boolean not null default false,
  add column if not exists label_pl text;

alter table public.notification_matrix drop constraint if exists notification_matrix_pkey;
alter table public.notification_matrix drop constraint if exists notification_matrix_by_role_pkey;

delete from public.notification_matrix;

insert into public.notification_matrix (
  event_key, event_group, role, in_app, email, push,
  fixed_in_app, fixed_email, fixed_push, risks_only, label_pl
) values
('dec_new','DECISION','HHL_ADMIN',true,false,false,false,false,false,false,'Nowa decyzja do podjęcia'),
('dec_new','DECISION','HHL_OPS',true,false,true,false,false,false,false,'Nowa decyzja do podjęcia'),
('dec_new','DECISION','CLIENT_USER',true,false,false,false,false,false,false,'Nowa decyzja do podjęcia'),
('dec_new','DECISION','CARRIER_DISPATCH',true,false,true,false,false,false,false,'Nowa decyzja do podjęcia'),
('dec_new','DECISION','CARRIER_USER',false,false,false,false,false,false,false,'Nowa decyzja do podjęcia'),
('dec_late','DECISION','HHL_ADMIN',true,true,true,false,false,false,false,'Decyzja po terminie'),
('dec_late','DECISION','HHL_OPS',true,true,true,false,false,false,false,'Decyzja po terminie'),
('dec_late','DECISION','CLIENT_USER',true,false,false,false,false,false,false,'Decyzja po terminie'),
('dec_late','DECISION','CARRIER_DISPATCH',true,true,true,false,false,false,false,'Decyzja po terminie'),
('dec_late','DECISION','CARRIER_USER',false,false,false,false,false,false,false,'Decyzja po terminie'),
('res_missing','LOAD_STATUS','HHL_ADMIN',true,false,false,false,false,false,false,'Brak kierowcy, pojazdu lub pilota'),
('res_missing','LOAD_STATUS','HHL_OPS',true,false,false,false,false,false,false,'Brak kierowcy, pojazdu lub pilota'),
('res_missing','LOAD_STATUS','CLIENT_USER',false,false,false,false,false,false,false,'Brak kierowcy, pojazdu lub pilota'),
('res_missing','LOAD_STATUS','CARRIER_DISPATCH',true,true,true,false,false,false,false,'Brak kierowcy, pojazdu lub pilota'),
('res_missing','LOAD_STATUS','CARRIER_USER',true,false,false,false,false,false,false,'Brak kierowcy, pojazdu lub pilota'),
('order_no','LOAD_STATUS','HHL_ADMIN',true,false,false,false,false,false,false,'Brak numeru zlecenia'),
('order_no','LOAD_STATUS','HHL_OPS',true,false,false,false,false,false,false,'Brak numeru zlecenia'),
('order_no','LOAD_STATUS','CLIENT_USER',false,false,false,false,false,false,false,'Brak numeru zlecenia'),
('order_no','LOAD_STATUS','CARRIER_DISPATCH',true,false,false,false,false,false,false,'Brak numeru zlecenia'),
('order_no','LOAD_STATUS','CARRIER_USER',false,false,false,false,false,false,false,'Brak numeru zlecenia'),
('chat','LOAD_STATUS','HHL_ADMIN',true,false,true,false,false,false,false,'Nowa wiadomość w czacie'),
('chat','LOAD_STATUS','HHL_OPS',true,false,true,false,false,false,false,'Nowa wiadomość w czacie'),
('chat','LOAD_STATUS','CLIENT_USER',true,false,true,false,false,false,false,'Nowa wiadomość w czacie'),
('chat','LOAD_STATUS','CARRIER_DISPATCH',true,false,true,false,false,false,false,'Nowa wiadomość w czacie'),
('chat','LOAD_STATUS','CARRIER_USER',true,false,true,false,false,false,false,'Nowa wiadomość w czacie'),
('scx_detour','DECISION','HHL_ADMIN',true,false,true,false,false,false,false,'Decyzja SCX: objazd albo postój'),
('scx_detour','DECISION','HHL_OPS',true,false,true,false,false,false,false,'Decyzja SCX: objazd albo postój'),
('scx_detour','DECISION','CLIENT_USER',false,false,false,false,false,false,false,'Decyzja SCX: objazd albo postój'),
('status','LOAD_STATUS','HHL_ADMIN',true,false,false,false,false,false,false,'Zmiana statusu transportu'),
('status','LOAD_STATUS','HHL_OPS',true,false,false,false,false,false,false,'Zmiana statusu transportu'),
('status','LOAD_STATUS','CLIENT_USER',true,false,false,false,false,false,false,'Zmiana statusu transportu'),
('status','LOAD_STATUS','CARRIER_DISPATCH',true,false,false,false,false,false,false,'Zmiana statusu transportu'),
('status','LOAD_STATUS','CARRIER_USER',true,false,false,false,false,false,false,'Zmiana statusu transportu'),
('dates','LOAD_STATUS','HHL_ADMIN',true,false,false,true,false,false,false,'Zmiana dat planu'),
('dates','LOAD_STATUS','HHL_OPS',true,false,false,true,false,false,false,'Zmiana dat planu'),
('dates','LOAD_STATUS','CLIENT_USER',false,false,false,false,false,false,false,'Zmiana dat planu'),
('dates','LOAD_STATUS','CARRIER_DISPATCH',true,false,true,true,false,false,false,'Zmiana dat planu'),
('dates','LOAD_STATUS','CARRIER_USER',true,false,false,true,false,false,false,'Zmiana dat planu'),
('zone','LOAD_STATUS','HHL_ADMIN',true,false,false,false,false,false,false,'Wjazd lub wyjazd ze strefy'),
('zone','LOAD_STATUS','HHL_OPS',true,false,false,false,false,false,false,'Wjazd lub wyjazd ze strefy'),
('zone','LOAD_STATUS','CLIENT_USER',false,false,false,false,false,false,false,'Wjazd lub wyjazd ze strefy'),
('zone','LOAD_STATUS','CARRIER_DISPATCH',true,false,false,false,false,false,false,'Wjazd lub wyjazd ze strefy'),
('zone','LOAD_STATUS','CARRIER_USER',true,false,false,false,false,false,false,'Wjazd lub wyjazd ze strefy'),
('pre_arrival','LOAD_STATUS','HHL_ADMIN',false,false,false,false,false,false,false,'Auto 50 km przed placem / przed Śremem'),
('pre_arrival','LOAD_STATUS','HHL_OPS',false,false,false,false,false,false,false,'Auto 50 km przed placem / przed Śremem'),
('pre_arrival','LOAD_STATUS','CLIENT_USER',true,false,false,false,false,false,false,'Auto 50 km przed placem / przed Śremem'),
('pre_arrival','LOAD_STATUS','CARRIER_DISPATCH',true,false,false,false,false,false,false,'Auto 50 km przed placem / przed Śremem'),
('pre_arrival','LOAD_STATUS','CARRIER_USER',false,false,false,false,false,false,false,'Auto 50 km przed placem / przed Śremem'),
('pre_port','LOAD_STATUS','HHL_ADMIN',true,false,false,false,false,false,false,'Auto 20 km przed portem'),
('pre_port','LOAD_STATUS','HHL_OPS',true,false,false,false,false,false,false,'Auto 20 km przed portem'),
('pre_port','LOAD_STATUS','CLIENT_USER',false,false,false,false,false,false,false,'Auto 20 km przed portem'),
('pre_port','LOAD_STATUS','CARRIER_DISPATCH',false,false,false,false,false,false,false,'Auto 20 km przed portem'),
('pre_port','LOAD_STATUS','CARRIER_USER',false,false,false,false,false,false,false,'Auto 20 km przed portem'),
('cmr','LOAD_STATUS','HHL_ADMIN',true,false,false,false,false,false,false,'Brak CMR'),
('cmr','LOAD_STATUS','HHL_OPS',true,false,false,false,false,false,false,'Brak CMR'),
('cmr','LOAD_STATUS','CLIENT_USER',false,false,false,false,false,false,false,'Brak CMR'),
('cmr','LOAD_STATUS','CARRIER_DISPATCH',true,false,false,false,false,false,false,'Brak CMR'),
('cmr','LOAD_STATUS','CARRIER_USER',true,false,false,false,false,false,false,'Brak CMR'),
('risk_route','RISK_FERRY_WEATHER','HHL_ADMIN',true,false,false,false,false,false,false,'Ryzyko na trasie przed pojazdem'),
('risk_route','RISK_FERRY_WEATHER','HHL_OPS',true,false,false,false,false,false,false,'Ryzyko na trasie przed pojazdem'),
('risk_route','RISK_FERRY_WEATHER','CLIENT_USER',true,false,false,false,false,false,false,'Ryzyko na trasie przed pojazdem'),
('risk_route','RISK_FERRY_WEATHER','CARRIER_DISPATCH',true,false,false,false,false,false,false,'Ryzyko na trasie przed pojazdem'),
('risk_route','RISK_FERRY_WEATHER','CARRIER_USER',true,false,false,false,false,false,false,'Ryzyko na trasie przed pojazdem'),
('risk_crit','RISK_FERRY_WEATHER','HHL_ADMIN',true,true,true,false,false,false,false,'Ryzyko podniesione do krytycznego'),
('risk_crit','RISK_FERRY_WEATHER','HHL_OPS',true,false,true,false,false,false,false,'Ryzyko podniesione do krytycznego'),
('risk_crit','RISK_FERRY_WEATHER','CLIENT_USER',true,true,false,false,false,false,false,'Ryzyko podniesione do krytycznego'),
('risk_crit','RISK_FERRY_WEATHER','CARRIER_DISPATCH',true,false,true,false,false,false,false,'Ryzyko podniesione do krytycznego'),
('risk_crit','RISK_FERRY_WEATHER','CARRIER_USER',true,false,false,false,false,false,false,'Ryzyko podniesione do krytycznego'),
('risk_general','RISK_FERRY_WEATHER','HHL_ADMIN',false,false,false,false,false,false,true,'Sytuacja ogólna: promy, drogi, pogoda'),
('risk_general','RISK_FERRY_WEATHER','HHL_OPS',false,false,false,false,false,false,true,'Sytuacja ogólna: promy, drogi, pogoda'),
('risk_general','RISK_FERRY_WEATHER','CLIENT_USER',false,false,false,false,false,false,true,'Sytuacja ogólna: promy, drogi, pogoda'),
('risk_general','RISK_FERRY_WEATHER','CARRIER_DISPATCH',false,false,false,false,false,false,true,'Sytuacja ogólna: promy, drogi, pogoda'),
('risk_general','RISK_FERRY_WEATHER','CARRIER_USER',false,false,false,false,false,false,true,'Sytuacja ogólna: promy, drogi, pogoda'),
('week','MONEY','HHL_ADMIN',true,true,false,false,false,false,false,'Tydzień zamknięty: faktura do wystawienia'),
('week','MONEY','HHL_OPS',false,false,false,false,false,false,false,'Tydzień zamknięty: faktura do wystawienia'),
('week','MONEY','CLIENT_USER',false,false,false,false,false,false,false,'Tydzień zamknięty: faktura do wystawienia'),
('week','MONEY','CARRIER_DISPATCH',true,true,false,false,false,false,false,'Tydzień zamknięty: faktura do wystawienia'),
('week','MONEY','CARRIER_USER',false,false,false,false,false,false,false,'Tydzień zamknięty: faktura do wystawienia'),
('inv_check','MONEY','HHL_ADMIN',true,true,false,false,false,false,false,'Faktura do weryfikacji'),
('inv_check','MONEY','HHL_OPS',false,false,false,false,false,false,false,'Faktura do weryfikacji'),
('inv_check','MONEY','CLIENT_USER',true,true,false,false,false,false,false,'Faktura do weryfikacji'),
('inv_check','MONEY','CARRIER_DISPATCH',false,false,false,false,false,false,false,'Faktura do weryfikacji'),
('inv_check','MONEY','CARRIER_USER',false,false,false,false,false,false,false,'Faktura do weryfikacji'),
('inv_dispute','MONEY','HHL_ADMIN',true,true,false,false,false,false,false,'Faktura sporna'),
('inv_dispute','MONEY','HHL_OPS',false,false,false,false,false,false,false,'Faktura sporna'),
('inv_dispute','MONEY','CLIENT_USER',true,true,false,false,false,false,false,'Faktura sporna'),
('inv_dispute','MONEY','CARRIER_DISPATCH',true,true,false,false,false,false,false,'Faktura sporna'),
('inv_dispute','MONEY','CARRIER_USER',false,false,false,false,false,false,false,'Faktura sporna'),
('factoring','MONEY','HHL_ADMIN',true,true,true,false,false,false,false,'Faktoring: wypłata'),
('factoring','MONEY','HHL_OPS',false,false,false,false,false,false,false,'Faktoring: wypłata'),
('factoring','MONEY','CARRIER_DISPATCH',true,true,false,false,false,false,false,'Faktoring: wypłata'),
('factoring','MONEY','CARRIER_USER',false,false,false,false,false,false,false,'Faktoring: wypłata'),
('sms_gw','SYSTEM','HHL_ADMIN',true,true,false,false,false,false,false,'Bramka SMS milczy albo SMS niedoręczony'),
('sms_gw','SYSTEM','HHL_OPS',true,true,false,false,false,false,false,'Bramka SMS milczy albo SMS niedoręczony'),
('src_down','SYSTEM','HHL_ADMIN',true,true,true,false,true,true,false,'Źródło danych nie działa / wróciło'),
('src_down','SYSTEM','HHL_OPS',false,false,false,false,false,false,false,'Źródło danych nie działa / wróciło'),
('app_err','SYSTEM','HHL_ADMIN',true,true,true,false,true,true,false,'Błąd aplikacji'),
('app_err','SYSTEM','HHL_OPS',false,false,false,false,false,false,false,'Błąd aplikacji'),
('daily','SYSTEM','HHL_ADMIN',false,true,false,false,false,false,false,'Raport dzienny'),
('daily','SYSTEM','HHL_OPS',false,false,false,false,false,false,false,'Raport dzienny')
;

alter table public.notification_matrix alter column event_key set not null;
alter table public.notification_matrix add primary key (event_key, role);

comment on table public.notification_matrix is
  'C3: kto co dostaje — zdarzenie × rodzaj konta × dzwonek/e-mail/telefon. risks_only = tylko strona Ryzyka.';

-- W39: zmiana statusu u Administratora HHL bez e-maila (gdyby seed się rozjechał).
update public.notification_matrix
   set email = false
 where event_key = 'status' and role = 'HHL_ADMIN' and email is true;

create table if not exists public.user_notify_pref (
  user_id uuid not null references public.app_users(id) on delete cascade,
  event_key text not null,
  channel text not null check (channel in ('bell', 'push', 'mail')),
  on_value boolean not null,
  primary key (user_id, event_key, channel)
);
alter table public.user_notify_pref enable row level security;
revoke all on public.user_notify_pref from public, anon;
revoke insert, update, delete, truncate on public.user_notify_pref from authenticated;
grant select on public.user_notify_pref to authenticated;
drop policy if exists user_notify_pref_own on public.user_notify_pref;
create policy user_notify_pref_own on public.user_notify_pref
  for select to authenticated
  using (user_id = public.current_app_user_id());
comment on table public.user_notify_pref is
  'C3/W47: ustawienie osoby (zdarzenie × kanał). Zapis tylko przez my_notify_set. Kanał „zawsze” nie schodzi.';

create table if not exists public.notification_copy (
  id text primary key,
  subject_pl text not null,
  body_pl text not null
);
alter table public.notification_copy enable row level security;
revoke all on public.notification_copy from public, anon;
revoke insert, update, delete, truncate on public.notification_copy from authenticated;
grant select on public.notification_copy to authenticated;
drop policy if exists notification_copy_read on public.notification_copy;
create policy notification_copy_read on public.notification_copy
  for select to authenticated
  using (public.current_app_user_id() is not null);

insert into public.notification_copy (id, subject_pl, body_pl) values
  ('PRE_ARRIVAL', '{{code}}: auto 50 km przed celem — {{site}}',
   'Auto {{trailer}} jest ok. 50 km przed celem: {{site}} (o {{time}}). Przyjazd ok. {{arrival}}.'),
  ('PRE_PORT', '{{code}}: auto 20 km przed portem {{port}}',
   'Auto {{trailer}} jest ok. 20 km przed portem {{port}} (o {{time}}).'),
  ('SCX_DETOUR_CHOICE', '{{code}}: decyzja SCX — {{choice}}',
   'Na trasie: {{closure}}. SCX wybrał: {{choice}} ({{author}}). ETA liczy ten wybór.'),
  ('SOURCE_DOWN', '{{feed}} nie działa od {{since}}',
   '{{feed}} nie działa od {{since}}. Skutek: {{effect}}. Przypomnienie po 2 h, jeśli nie wróci.'),
  ('SOURCE_BACK', 'Wróciło: {{feed}}',
   '{{feed}} działa znowu od {{time}}. Przerwa trwała od {{since}}.'),
  ('APP_ERROR', 'Błąd aplikacji: {{error}}',
   'Błąd „{{error}}”: {{times}} razy, u {{people}} osób, ostatnio o {{time}}, strona {{page}}.')
on conflict (id) do update
  set subject_pl = excluded.subject_pl, body_pl = excluded.body_pl;

create or replace function public.notify_event_key(p_template text, p_payload jsonb)
returns text
language sql
immutable
as $$
  select case
    when p_template = 'LOAD_CHAT_MESSAGE' then 'chat'
    when p_template = 'PLAN_DATES_CHANGED' then 'dates'
    when p_template in ('LOAD_STATUS_CHANGED', 'STATUS_CHANGE') then 'status'
    when p_template in ('ZONE_ENTER', 'ZONE_EXIT', 'GEOFENCE_ENTER', 'GEOFENCE_EXIT', 'GEOFENCE_DWELL') then 'zone'
    when p_template in ('PRE_ARRIVAL', 'PRE_ARRIVAL_PL', 'PRE_ARRIVAL_SE') then 'pre_arrival'
    when p_template = 'PRE_PORT' then 'pre_port'
    when p_template = 'SCX_DETOUR_CHOICE' then 'scx_detour'
    when p_template = 'DECISION_ESCALATED' then 'dec_late'
    when p_template in ('DECISION_OPEN', 'DECISION_RESOLVED') then 'dec_new'
    when p_template in ('RESOURCE_DEADLINE', 'RESOURCE_MISSING') then 'res_missing'
    when p_template in ('ORDER_NO_MISSING', 'HHL_ORDER_MISSING', 'CARRIER_ORDER_MISSING') then 'order_no'
    when p_template in ('DOC_MISSING', 'CMR_MISSING') then 'cmr'
    when p_template in ('RISK_OPEN', 'RISK_SEVERITY')
         and coalesce(p_payload->>'kind', '') in ('DOC_MISSING', 'PERMIT', 'INSURANCE') then 'cmr'
    when p_template in ('RISK_OPEN', 'RISK_SEVERITY')
         and coalesce(p_payload->>'kind', '') = 'RESOURCE_MISSING' then 'res_missing'
    when p_template in ('RISK_OPEN', 'RISK_SEVERITY')
         and (
           coalesce(p_payload->>'title_key', '') in ('rk_order_no', 'rk_test_orderno')
           or coalesce(p_payload->>'kind', '') in ('ORDER_NO', 'HHL_ORDER_MISSING', 'CARRIER_ORDER_MISSING')
         ) then 'order_no'
    when coalesce(p_payload->>'kind', '') in ('USAGE_LIMIT', 'JOB_FAILURE')
         or p_template in ('JOB_FAILURE', 'SOURCE_DOWN', 'SOURCE_BACK') then 'src_down'
    when p_template = 'APP_ERROR' then 'app_err'
    when p_template in ('SMS_GATEWAY_SILENT', 'SMS_UNDELIVERED', 'SMS_FALLBACK', 'ZONE_LIMIT') then 'sms_gw'
    when p_template in ('DAILY_DIGEST', 'ADMIN_DIGEST') then 'daily'
    when p_template = 'INVOICE_NEW' then 'inv_check'
    when p_template in ('INVOICE_DISPUTED', 'INVOICE_DISPUTE_REPLY', 'INVOICE_DISPUTE_RESOLVED') then 'inv_dispute'
    when p_template in ('WEEK_CLOSED', 'INVOICE_WEEK') then 'week'
    when p_template like 'FACTOR%' then 'factoring'
    when p_template in ('RISK_OPEN', 'RISK_SEVERITY', 'ROAD_RISK')
         and coalesce(p_payload->>'severity', '') = 'CRITICAL' then 'risk_crit'
    when p_template in ('RISK_OPEN', 'RISK_SEVERITY', 'ROAD_RISK', 'FERRY_CANCELLED', 'FERRY_OVERDUE') then 'risk_route'
    when p_template in ('FERRY', 'WEATHER', 'ROAD_SE', 'ROAD_PL')
         and nullif(coalesce(p_payload->>'load_id', ''), '') is null then 'risk_general'
    else null
  end
$$;

revoke all on function public.notify_event_key(text, jsonb) from public, anon, authenticated;

create or replace function public.notify_person_on(
  p_user uuid, p_event text, p_channel text, p_matrix boolean, p_fixed boolean
) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_fixed is true then p_matrix
    else coalesce(
      (select on_value from public.user_notify_pref
        where user_id = p_user and event_key = p_event and channel = p_channel),
      p_matrix
    )
  end
$$;

revoke all on function public.notify_person_on(uuid, text, text, boolean, boolean) from public, anon, authenticated;

create or replace function public.notify_audience_ok(
  p_user uuid, p_role text, p_org_kind text, p_template text, p_payload jsonb
) returns boolean
language sql
stable
as $$
  select case
    when p_role = 'CLIENT_USER'
         and public.notify_event_key(p_template, p_payload) in ('zone', 'cmr', 'res_missing', 'order_no')
      then false
    when p_template = 'LOAD_CHAT_MESSAGE'
         and p_user::text = coalesce(p_payload->>'author_id', '')
      then false
    when p_template = 'LOAD_CHAT_MESSAGE'
         and p_payload ? 'visible_to'
         and not exists (
           select 1 from jsonb_array_elements_text(p_payload->'visible_to') v(x)
            where v.x = p_org_kind
         )
      then false
    else true
  end
$$;

revoke all on function public.notify_audience_ok(uuid, text, text, text, jsonb) from public, anon, authenticated;

create or replace function public.my_notify_get()
returns table (event_key text, channel text, on_value boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid;
begin
  v_me := public.current_app_user_id();
  if (v_me is not null) is not true then
    raise exception 'Brak aktywnego konta' using errcode = '42501';
  end if;
  return query
    select p.event_key, p.channel, p.on_value
      from public.user_notify_pref p
     where p.user_id = v_me;
end $$;

revoke all on function public.my_notify_get() from public, anon;
grant execute on function public.my_notify_get() to authenticated;

create or replace function public.my_notify_set(p_event_key text, p_channel text, p_on boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid;
  v_role user_role;
  v_old boolean;
  v_fixed boolean;
  v_matrix boolean;
begin
  v_me := public.current_app_user_id();
  if (v_me is not null) is not true then
    raise exception 'Brak aktywnego konta' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.impersonation_state i
      join public.app_users a on a.id = i.admin_user_id
     where a.auth_id = auth.uid()
  ) then
    raise exception 'Podgląd — tylko odczyt' using errcode = '42501';
  end if;
  if (p_channel in ('bell', 'push', 'mail')) is not true then
    raise exception 'Nieznany kanał' using errcode = '22023';
  end if;
  if (p_on is not null) is not true then
    raise exception 'Brak wartości kanału' using errcode = '22023';
  end if;
  select role into v_role from public.app_users where id = v_me;
  select
    case p_channel when 'bell' then in_app when 'push' then push else email end,
    case p_channel when 'bell' then fixed_in_app when 'push' then fixed_push else fixed_email end
    into v_matrix, v_fixed
    from public.notification_matrix
   where event_key = p_event_key and role = v_role;
  if (v_matrix is not null) is not true then
    raise exception 'To zdarzenie nie dotyczy Twojego konta' using errcode = '42501';
  end if;
  if v_fixed is true then
    raise exception 'Kanał jest zawsze włączony' using errcode = '42501';
  end if;
  select on_value into v_old
    from public.user_notify_pref
   where user_id = v_me and event_key = p_event_key and channel = p_channel;
  insert into public.user_notify_pref (user_id, event_key, channel, on_value)
  values (v_me, p_event_key, p_channel, p_on)
  on conflict (user_id, event_key, channel) do update set on_value = excluded.on_value;
  insert into public.audit_log (user_id, action, entity, entity_id, old_value, new_value)
  values (
    v_me, 'MY_NOTIFY_SET', 'user_notify_pref', p_event_key || ':' || p_channel,
    jsonb_build_object('on', v_old),
    jsonb_build_object('on', p_on)
  );
end $$;

revoke all on function public.my_notify_set(text, text, boolean) from public, anon;
grant execute on function public.my_notify_set(text, text, boolean) to authenticated;

create or replace function public.admin_notification_matrix_set(
  p_event_group text,
  p_role text,
  p_in_app boolean,
  p_email boolean,
  p_push boolean default false
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid;
  v_role text;
  v_old jsonb;
  n int;
begin
  select id, role::text into v_me, v_role from app_users where auth_id = auth.uid() and active;
  if (v_me is not null and v_role = 'HHL_ADMIN') is not true then
    raise exception 'Macierz powiadomień — wyłącznie administrator HHL' using errcode = '42501';
  end if;
  if (p_role in ('HHL_ADMIN','HHL_OPS','CLIENT_USER','CARRIER_DISPATCH','CARRIER_USER')) is not true then
    raise exception 'Nieznana rola macierzy' using errcode = '22023';
  end if;
  if (p_event_group is not null and length(trim(p_event_group)) > 0) is not true then
    raise exception 'Nieznane zdarzenie' using errcode = '22023';
  end if;
  if (
    p_event_group = 'SYSTEM'
    or p_event_group in ('sms_gw', 'src_down', 'app_err', 'daily')
  ) and p_role not in ('HHL_ADMIN', 'HHL_OPS') then
    raise exception 'Zdarzenia systemowe — tylko HHL' using errcode = '22023';
  end if;

  select jsonb_agg(jsonb_build_object(
           'event_key', m.event_key, 'in_app', m.in_app, 'email', m.email, 'push', m.push
         ))
    into v_old
    from notification_matrix m
   where m.role = p_role::user_role
     and (m.event_key = p_event_group or m.event_group = p_event_group);

  update notification_matrix m
     set in_app = case when m.fixed_in_app then m.in_app else coalesce(p_in_app, false) end,
         email = case when m.fixed_email then m.email else coalesce(p_email, false) end,
         push = case when m.fixed_push then m.push else coalesce(p_push, false) end
   where m.role = p_role::user_role
     and (m.event_key = p_event_group or m.event_group = p_event_group)
     and m.risks_only is not true;
  get diagnostics n = row_count;
  if (n > 0) is not true then
    raise exception 'Nieznane zdarzenie' using errcode = '22023';
  end if;

  insert into audit_log (user_id, action, entity, entity_id, old_value, new_value)
  values (
    v_me, 'NOTIFICATION_MATRIX_SET', 'notification_matrix', p_event_group || ':' || p_role,
    v_old,
    jsonb_build_object('in_app', p_in_app, 'email', p_email, 'push', p_push)
  );
end $$;

revoke all on function public.admin_notification_matrix_set(text, text, boolean, boolean, boolean) from public, anon;
grant execute on function public.admin_notification_matrix_set(text, text, boolean, boolean, boolean) to authenticated;

create or replace function public.matrix_notify(
  p_event_group text,
  p_template text,
  p_load_id uuid,
  p_project_id uuid,
  p_payload jsonb,
  p_dedup_prefix text,
  p_only_org_kind text default null
) returns int
language plpgsql security definer set search_path = public as $$
declare
  n int := 0;
  v_critical boolean;
  v_plan_dates boolean := (p_template = 'PLAN_DATES_CHANGED');
  v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
  v_decision text := coalesce(nullif(v_payload->>'decision_id', ''), nullif(v_payload->>'decisionId', ''));
  v_needs_transport boolean;
  v_source_alarm boolean;
  v_has_push_target boolean;
  v_kind text;
  v_order text;
  v_bundle text;
  v_event text;
  v_push_ok boolean;
  r record;
begin
  if (p_event_group in ('LOAD_STATUS','RISK_FERRY_WEATHER','DECISION','MONEY','SYSTEM')) is not true then
    return 0;
  end if;
  if (p_template is not null and length(trim(p_template)) > 0) is not true then
    return 0;
  end if;
  if p_only_org_kind is not null
     and (p_only_org_kind in ('FORWARDER','CARRIER','CLIENT')) is not true then
    return 0;
  end if;

  if p_template = 'RISK_RESOLVED' then
    return 0;
  end if;

  if p_load_id is null and p_template in ('RISK_OPEN', 'RISK_SEVERITY') then
    if coalesce(v_payload->>'kind', '') not in ('USAGE_LIMIT', 'JOB_FAILURE')
       and coalesce(v_payload->>'title_key', '') is distinct from 'rk_source_down'
       and p_dedup_prefix not like 'SOURCE_DOWN%' then
      return 0;
    end if;
  end if;
  v_needs_transport := p_template in (
    'ZONE_ENTER', 'ZONE_EXIT', 'LOAD_STATUS_CHANGED',
    'PLAN_DATES_CHANGED', 'STATUS_CHANGE', 'LOAD_CHAT_MESSAGE', 'FEE_PROPOSED', 'FEE_DECIDED',
    'RESOURCE_MISSING', 'RESOURCE_DEADLINE', 'ORDER_NO_MISSING', 'HHL_ORDER_MISSING',
    'CARRIER_ORDER_MISSING', 'LOADING_UNCONFIRMED', 'AUTO_STATUS', 'DATES_UNCONFIRMED', 'SEQUENCE'
  );
  if v_needs_transport and p_load_id is null then
    return 0;
  end if;
  if (p_event_group = 'DECISION' or p_template like 'DECISION%')
     and v_decision is null and p_load_id is null then
    return 0;
  end if;

  v_event := coalesce(
    public.notify_event_key(p_template, v_payload),
    case p_event_group
      when 'LOAD_STATUS' then 'status'
      when 'DECISION' then 'dec_new'
      when 'RISK_FERRY_WEATHER' then 'risk_route'
      when 'MONEY' then 'inv_check'
      when 'SYSTEM' then 'src_down'
      else null
    end
  );
  if (v_event is not null and v_event is distinct from 'risk_general') is not true then
    return 0;
  end if;

  v_payload := v_payload
    || jsonb_build_object('event_group', p_event_group, 'event_key', p_dedup_prefix, 'matrix_event', v_event);
  select order_no into v_order from loads where id = p_load_id;
  v_bundle := nullif(v_payload->>'bundle_key', '');
  v_kind := case
    when public.l13_email_is_critical(p_template, v_payload) then 'critical'
    else 'digest'
  end;

  insert into notifications (channel, recipient, user_id, load_id, template, payload, dedup_key)
  select 'IN_APP', coalesce(u.email::text, u.id::text), u.id, p_load_id, p_template,
         v_payload || jsonb_build_object('locale', u.locale),
         left(p_dedup_prefix || ':IN:' || u.id::text, 200)
    from app_users u
    join organizations o on o.id = u.org_id
    join notification_matrix m
      on m.event_key = v_event and m.role = u.role and m.risks_only is not true
   where u.active
     and u.role in ('HHL_ADMIN','HHL_OPS','CLIENT_USER','CARRIER_DISPATCH','CARRIER_USER')
     and (p_only_org_kind is null or o.kind::text = p_only_org_kind)
     and public.notify_person_on(u.id, v_event, 'bell', m.in_app, m.fixed_in_app) is true
     and public.notify_audience_ok(u.id, u.role::text, o.kind::text, p_template, v_payload)
     and (
       o.kind = 'FORWARDER'
       or (o.kind = 'CARRIER' and (
            p_load_id is null
            or exists (select 1 from loads l where l.id = p_load_id and l.carrier_org_id = o.id)))
       or (o.kind = 'CLIENT' and (
            p_project_id is null
            or exists (select 1 from projects p where p.id = p_project_id and p.client_org_id = o.id)
            or exists (select 1 from loads l join projects p on p.id = l.project_id
                        where l.id = p_load_id and p.client_org_id = o.id)))
     )
  on conflict (dedup_key) where dedup_key is not null do nothing;
  get diagnostics n = row_count;

  for r in
    select u.id as user_id, u.email::text as recipient, u.locale
      from app_users u
      join organizations o on o.id = u.org_id
      join notification_matrix m
        on m.event_key = v_event and m.role = u.role and m.risks_only is not true
       and public.notify_person_on(u.id, v_event, 'mail', m.email, m.fixed_email) is true
     where u.active and u.email is not null
       and u.role in ('HHL_ADMIN','HHL_OPS','CLIENT_USER','CARRIER_DISPATCH','CARRIER_USER')
       and (p_only_org_kind is null or o.kind::text = p_only_org_kind)
       and public.notify_audience_ok(u.id, u.role::text, o.kind::text, p_template, v_payload)
       and (
         o.kind = 'FORWARDER'
         or (o.kind = 'CARRIER' and (
              p_load_id is null
              or exists (select 1 from loads l where l.id = p_load_id and l.carrier_org_id = o.id)))
         or (o.kind = 'CLIENT' and (
              p_project_id is null
              or exists (select 1 from projects p where p.id = p_project_id and p.client_org_id = o.id)
              or exists (select 1 from loads l join projects p on p.id = l.project_id
                          where l.id = p_load_id and p.client_org_id = o.id)))
       )
  loop
    perform public.l13_queue_email(
      v_kind, p_template, r.user_id, r.recipient, p_load_id, v_order,
      v_payload || jsonb_build_object('locale', r.locale),
      left(p_dedup_prefix || ':EM:' || r.user_id::text, 200),
      case when v_kind = 'critical' then v_bundle else null end
    );
  end loop;
  perform public.l13_email_guard_note(now());

  v_critical := (
    coalesce(v_payload->>'severity', '') = 'CRITICAL'
    or p_template ilike '%CRITICAL%'
    or p_template in ('FERRY_CANCELLED', 'SCHEDULE_DATE_CRITICAL')
  );
  v_source_alarm := (
    p_dedup_prefix like 'SOURCE_DOWN%'
    or coalesce(v_payload->>'title_key', '') = 'rk_source_down'
    or coalesce(v_payload->>'kind', '') in ('JOB_FAILURE', 'SOURCE_DOWN')
    or p_template in ('SOURCE_DOWN', 'JOB_FAILURE')
  );
  v_has_push_target := p_load_id is not null or v_decision is not null or v_source_alarm;
  v_push_ok := (v_critical is true and v_has_push_target is true) or v_event = 'chat' or v_event = 'app_err';
  if v_push_ok is true then
  insert into notifications (channel, recipient, user_id, load_id, template, payload, dedup_key, status)
  select 'WEB_PUSH', coalesce(u.email::text, u.id::text), u.id, p_load_id, p_template,
         v_payload || jsonb_build_object('locale', u.locale, 'critical', true),
         left(p_dedup_prefix || ':WP:' || u.id::text, 200),
         'PENDING'
    from app_users u
    join organizations o on o.id = u.org_id
    join notification_matrix m
      on m.event_key = v_event and m.role = u.role and m.risks_only is not true
     and public.notify_person_on(u.id, v_event, 'push', m.push, m.fixed_push) is true
    left join user_preferences pref on pref.user_id = u.id
   where u.active
     and u.role in ('HHL_ADMIN','HHL_OPS','CLIENT_USER','CARRIER_DISPATCH','CARRIER_USER')
     and public.notify_audience_ok(u.id, u.role::text, o.kind::text, p_template, v_payload)
     and coalesce(pref.web_push_enabled, true) is true
     and exists (select 1 from push_subscriptions ps where ps.user_id = u.id)
     and (p_only_org_kind is null or o.kind::text = p_only_org_kind)
     and (
       v_source_alarm is not true
       or (o.kind = 'FORWARDER' and u.role in ('HHL_ADMIN', 'HHL_OPS'))
     )
     and (
       o.kind = 'FORWARDER'
       or (o.kind = 'CARRIER' and (
            p_load_id is null
            or exists (select 1 from loads l where l.id = p_load_id and l.carrier_org_id = o.id)))
       or (o.kind = 'CLIENT' and (
            p_project_id is null
            or exists (select 1 from projects p where p.id = p_project_id and p.client_org_id = o.id)
            or exists (select 1 from loads l join projects p on p.id = l.project_id
                        where l.id = p_load_id and p.client_org_id = o.id)))
     )
  on conflict (dedup_key) where dedup_key is not null do nothing;

  -- C16 N4 / W42: bez urządzenia → EMAIL zapasowy (czat zostaje bez e-maila — C3)
  if v_event is distinct from 'chat' then
  insert into notifications (channel, recipient, user_id, load_id, template, payload, dedup_key, status)
  select 'EMAIL', coalesce(u.email::text, u.id::text), u.id, p_load_id, p_template,
         v_payload || jsonb_build_object('locale', u.locale, 'critical', true, 'push_fallback', true),
         left('push_fallback:nosub:' || p_dedup_prefix || ':' || u.id::text, 200),
         'PENDING'
    from app_users u
    join organizations o on o.id = u.org_id
    join notification_matrix m
      on m.event_key = v_event and m.role = u.role and m.risks_only is not true
     and public.notify_person_on(u.id, v_event, 'push', m.push, m.fixed_push) is true
    left join user_preferences pref on pref.user_id = u.id
   where u.active and u.email is not null
     and u.role in ('HHL_ADMIN','HHL_OPS','CLIENT_USER','CARRIER_DISPATCH','CARRIER_USER')
     and public.notify_audience_ok(u.id, u.role::text, o.kind::text, p_template, v_payload)
     and coalesce(pref.web_push_enabled, true) is true
     and not exists (select 1 from push_subscriptions ps where ps.user_id = u.id)
     and (p_only_org_kind is null or o.kind::text = p_only_org_kind)
     and (
       v_source_alarm is not true
       or (o.kind = 'FORWARDER' and u.role in ('HHL_ADMIN', 'HHL_OPS'))
     )
     and (
       o.kind = 'FORWARDER'
       or (o.kind = 'CARRIER' and (
            p_load_id is null
            or exists (select 1 from loads l where l.id = p_load_id and l.carrier_org_id = o.id)))
       or (o.kind = 'CLIENT' and (
            p_project_id is null
            or exists (select 1 from projects p where p.id = p_project_id and p.client_org_id = o.id)
            or exists (select 1 from loads l join projects p on p.id = l.project_id
                        where l.id = p_load_id and p.client_org_id = o.id)))
     )
  on conflict (dedup_key) where dedup_key is not null do nothing;
  end if;
  end if;

  return n;
end $$;


comment on function public.matrix_notify(text, text, uuid, uuid, jsonb, text, text) is
  'C3: macierz po zdarzeniu + ustawienie osoby; czat na telefon bez e-maila; KSH bez stref i zadań innych firm.';

create or replace function public.notify_load_chat_message()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_project uuid;
  v_code text;
  v_preview text;
begin
  select l.project_id,
         coalesce(nullif(trim(l.hhl_order_no), ''), nullif(trim(l.order_no), ''), left(l.id::text, 8))
    into v_project, v_code
    from loads l
   where l.id = new.load_id;
  v_preview := left(regexp_replace(coalesce(new.body, ''), '\s+', ' ', 'g'), 120);
  perform public.matrix_notify(
    'LOAD_STATUS',
    'LOAD_CHAT_MESSAGE',
    new.load_id,
    v_project,
    jsonb_build_object(
      'load_code', v_code,
      'preview', v_preview,
      'author_org', new.author_org,
      'author_display', coalesce(new.author_display, new.author_org),
      'author_id', new.author_id,
      'visible_to', to_jsonb(new.visible_to)
    ),
    'CHAT:' || new.id::text
  );
  delete from notifications
   where load_id = new.load_id
     and template = 'LOAD_CHAT_MESSAGE'
     and user_id = new.author_id
     and dedup_key like 'CHAT:' || new.id::text || ':%';
  return new;
end $$;

comment on function public.notify_load_chat_message() is
  'C3 Cz13/Cz25: czat według macierzy chat; odbiorcy z visible_to, bez autora.';
