-- HOTFIX #467 / D3 (właściciel 22.10 21:25 + P1 23.10 08:17):
-- 1) Maile (także na adres bez konta) tylko przez „Kto co dostaje” (firma/rola/rodzaj).
--    Bez osobnego przełącznika ext_mail „domyślnie włączone”.
-- 2) Numery testowe SMS milczą przy włączonej EXTERNAL_MESSAGING (+ UI).
--    SMS ZONE_* na listę stref — także przy EXTERNAL off (P1 TAK; bez zmian enqueue/pull).
-- F7 #478: tylko sms_gw × CARRIER_*/CLIENT_USER (fixed_*=false, #402);
--    Admin HHL może włączyć sms_gw dla tych ról; my_notify_set SYSTEM nie-HHL = odmowa;
--    org z roli; sms_send_test = HHL_ADMIN; E42 dry-run bez insertu maila.

-- ---------------------------------------------------------------------------
-- 0. Tylko sms_gw × CARRIER_*/CLIENT_USER (maile bez konta: SMS_FALLBACK /
--    SMS_GATEWAY_* / ZONE_LIMIT → notify_event_key = sms_gw). fixed_* = false (#402);
--    włącza Administrator HHL w macierzy; przewoźnik/klient nie przez my_notify_set.
-- ---------------------------------------------------------------------------
insert into public.notification_matrix (
  event_key, event_group, role, in_app, email, push,
  fixed_in_app, fixed_email, fixed_push, risks_only, label_pl
)
select
  m.event_key,
  m.event_group,
  r.role::user_role,
  false,
  false,
  false,
  false,
  false,
  false,
  false,
  m.label_pl
from public.notification_matrix m
cross join (values
  ('CARRIER_DISPATCH'),
  ('CARRIER_USER'),
  ('CLIENT_USER')
) as r(role)
where m.role = 'HHL_ADMIN'
  and m.event_key = 'sms_gw'
  and not exists (
    select 1
      from public.notification_matrix x
     where x.event_key = m.event_key
       and x.role = r.role::user_role
  )
on conflict (event_key, role) do nothing;

-- F7: gdy wiersze powstały wcześniej z fixed_*=true — wróć do #402 (0 fixed).
update public.notification_matrix
   set fixed_in_app = false,
       fixed_email = false,
       fixed_push = false
 where event_key = 'sms_gw'
   and role in ('CARRIER_DISPATCH', 'CARRIER_USER', 'CLIENT_USER');

-- ---------------------------------------------------------------------------
-- 1. Bramka maili bez konta = ten sam rodzaj co w macierzy (bez ext_mail)
-- ---------------------------------------------------------------------------
update public.notification_matrix
   set email = false,
       label_pl = 'Maile do adresów spoza aplikacji (wycofane — użyj rodzaju zdarzenia)'
 where event_key = 'ext_mail';

create or replace function public.notify_orphan_email_allowed(
  p_template text,
  p_payload jsonb,
  p_recipient text
) returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_event text;
  v_role_txt text;
  v_role user_role;
  v_org text;
  v_group text;
  v_org_ok boolean;
  v_user uuid;
  v_matrix boolean;
begin
  if p_template in ('AUTH_INVITE', 'AUTH_PASSWORD_RESET')
     or p_template like 'INVITE%' then
    return true;
  end if;
  if coalesce(trim(p_recipient), '') = '' then
    return false;
  end if;

  select u.id into v_user
    from public.app_users u
   where lower(u.email::text) = lower(trim(p_recipient))
     and u.active is not false
   limit 1;
  if v_user is not null then
    return public.notify_channel_allowed(v_user, p_template, coalesce(p_payload, '{}'::jsonb), 'mail');
  end if;

  v_event := coalesce(
    public.notify_event_key(p_template, coalesce(p_payload, '{}'::jsonb)),
    nullif(coalesce(p_payload, '{}'::jsonb)->>'matrix_event', '')
  );
  if (v_event is not null) is not true then
    return false;
  end if;

  v_role_txt := coalesce(
    nullif(coalesce(p_payload, '{}'::jsonb)->>'matrix_role', ''),
    nullif(coalesce(p_payload, '{}'::jsonb)->>'role', '')
  );
  -- Adres wewnętrzny HHL bez konta: ta sama macierz co Administrator HHL (bez osobnego ext_mail).
  if v_role_txt is null
     and lower(split_part(trim(p_recipient), '@', 2)) = 'log-mar.pl' then
    v_role_txt := 'HHL_ADMIN';
  end if;
  if (v_role_txt is not null) is not true then
    return false; -- fail closed: bez roli w payloadzie nie ma „domyślnie włączone”
  end if;
  begin
    v_role := v_role_txt::user_role;
  exception when others then
    return false;
  end;

  -- F7: firma zawsze z roli (albo z payloadu); bez firmy = odmowa.
  v_org := coalesce(
    nullif(coalesce(p_payload, '{}'::jsonb)->>'org_kind', ''),
    nullif(coalesce(p_payload, '{}'::jsonb)->>'matrix_org', ''),
    case
      when v_role_txt like 'HHL_%' then 'FORWARDER'
      when v_role_txt like 'CARRIER_%' then 'CARRIER'
      when v_role_txt like 'CLIENT_%' then 'CLIENT'
      else null
    end
  );
  if (v_org is not null) is not true then
    return false;
  end if;
  if to_regclass('public.notification_matrix_org_kind') is not null then
    select m.event_group into v_group
      from public.notification_matrix m
     where m.event_key = v_event
     limit 1;
    if v_group is not null then
      select ok.email into v_org_ok
        from public.notification_matrix_org_kind ok
       where ok.event_group = v_group and ok.org_kind = v_org;
      if found and v_org_ok is not true then
        return false;
      end if;
    end if;
  end if;

  select m.email into v_matrix
    from public.notification_matrix m
   where m.event_key = v_event
     and m.role = v_role
     and m.risks_only is not true;
  return coalesce(v_matrix, false) is true;
end $$;

revoke all on function public.notify_orphan_email_allowed(text, jsonb, text)
  from public, anon, authenticated;
comment on function public.notify_orphan_email_allowed(text, jsonb, text) is
  '#467 F7: e-mail bez konta — firma (z roli) × rola × rodzaj; bez roli/firmy = odmowa.';

create or replace function public.trg_notifications_gate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.user_id is null then
    if NEW.channel = 'EMAIL' then
      if NEW.template in ('AUTH_INVITE', 'AUTH_PASSWORD_RESET')
         or NEW.template like 'INVITE%' then
        return NEW;
      end if;
      if NEW.status in ('SUPPRESSED', 'SENT', 'ERROR', 'CANCELLED', 'BLOCKED_R2') then
        return NEW;
      end if;
      if public.notify_orphan_email_allowed(
           NEW.template, coalesce(NEW.payload, '{}'::jsonb), NEW.recipient
         ) is not true then
        NEW.status := 'SUPPRESSED';
        NEW.error := left(coalesce(NEW.error || '; ', '') || 'gate:mail_off_orphan', 500);
      end if;
    end if;
    return NEW;
  end if;
  if NEW.channel = 'EMAIL' then
    if NEW.template in ('AUTH_INVITE', 'AUTH_PASSWORD_RESET')
       or NEW.template like 'INVITE%' then
      return NEW;
    end if;
    if NEW.status in ('SUPPRESSED', 'SENT', 'ERROR', 'CANCELLED', 'BLOCKED_R2') then
      return NEW;
    end if;
    if public.notify_channel_allowed(NEW.user_id, NEW.template, coalesce(NEW.payload, '{}'::jsonb), 'mail') is not true then
      NEW.status := 'SUPPRESSED';
      NEW.error := left(coalesce(NEW.error || '; ', '') || 'gate:mail_off', 500);
    end if;
    return NEW;
  end if;
  if NEW.channel = 'IN_APP' then
    if public.notify_channel_allowed(NEW.user_id, NEW.template, coalesce(NEW.payload, '{}'::jsonb), 'bell') is not true then
      return null;
    end if;
    return NEW;
  end if;
  return NEW;
end $$;

revoke all on function public.trg_notifications_gate() from public, anon, authenticated;
comment on function public.trg_notifications_gate() is
  '#467: IN_APP/EMAIL przez bramkę; bez user_id → rodzaj/rola (nie ext_mail); przed email_budget.';

create or replace function public.notify_email_still_allowed(p_id bigint)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  n public.notifications%rowtype;
  v_ok boolean;
begin
  select * into n from public.notifications where id = p_id;
  if not found then
    return false;
  end if;
  if n.channel is distinct from 'EMAIL' then
    return false;
  end if;
  if n.status is distinct from 'PENDING' and n.status is distinct from 'DIGEST' then
    return n.status = 'SENT';
  end if;
  if n.user_id is null then
    v_ok := public.notify_orphan_email_allowed(n.template, n.payload, n.recipient);
  else
    v_ok := public.notify_channel_allowed(n.user_id, n.template, n.payload, 'mail');
  end if;
  if v_ok is true then
    return true;
  end if;
  update public.notifications
     set status = 'SUPPRESSED',
         error = left(coalesce(error || '; ', '') || 'gate:mail_off', 500)
   where id = p_id
     and status in ('PENDING', 'DIGEST');
  return false;
end $$;

revoke all on function public.notify_email_still_allowed(bigint) from public, anon, authenticated;
grant execute on function public.notify_email_still_allowed(bigint) to service_role;
comment on function public.notify_email_still_allowed(bigint) is
  '#467: przed Resend — mail wyłączony (także bez konta) → SUPPRESSED.';

-- ---------------------------------------------------------------------------
-- 2. SMS: numery testowe tylko przy EXTERNAL off; przy on — tylko lista stref
-- ---------------------------------------------------------------------------
create or replace function public.sms_enqueue(
  p_kind text, p_load uuid, p_to text, p_locale text, p jsonb,
  p_priority int default 100, p_dedup text default null, p_secret boolean default false
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid; v_loc char(2); v_full text; v_to text; v_ok boolean := false;
  v_redir record; v_pilot boolean := false; v_ext boolean;
begin
  v_to := p_to;
  v_ext := external_messaging_enabled();

  if p_kind in ('ZONE_APPROACH', 'ZONE_ENTER') and p_load is not null then
    select * into v_redir from pilot_redirect_for_load(p_load);
    if found then
      v_to := v_redir.owner_phone_e164;
      v_pilot := true;
    end if;
  end if;

  if (v_to ~ '^\+[1-9][0-9]{7,14}$') is not true then return null; end if;

  if p_kind = 'TEST' then
    if v_ext then
      -- #467: przy EXTERNAL on numery testowe milczą — tylko lista stref
      v_ok := exists (
        select 1 from sms_zone_recipients r
         where r.active is true
           and sms_zone_e164(r.phone_national, r.country) = v_to
      );
    else
      v_ok := exists (select 1 from sms_test_numbers t where t.to_e164 = v_to);
    end if;
  elsif p_kind in ('ZONE_APPROACH', 'ZONE_ENTER') then
    v_ok := v_pilot
         or exists (
              select 1 from sms_zone_recipients r
               where r.active is true
                 and sms_zone_e164(r.phone_national, r.country) = v_to
            );
  else
    v_ok := false;
  end if;
  if v_ok is not true then
    return null;
  end if;

  v_loc := sms_locale_for(v_to, p_locale);
  v_full := sms_render(p_kind, v_loc, p);
  insert into sms_outbox (kind, load_id, to_e164, locale, body, contains_secret, priority, dedup_key, created_by)
  values (p_kind, p_load, v_to, v_loc,
          case when p_secret then sms_render(p_kind, v_loc, p || '{"url":"[link usunięty]"}'::jsonb) else v_full end,
          p_secret, p_priority, p_dedup, (select id from app_users where auth_id = auth.uid() and active))
  on conflict (dedup_key) do nothing
  returning id into v_id;
  if v_id is not null and p_secret then
    insert into sms_outbox_secret (sms_id, body) values (v_id, v_full);
  end if;
  return v_id;
end $$;
revoke all on function public.sms_enqueue(text, uuid, text, text, jsonb, int, text, boolean) from public, anon, authenticated;
comment on function public.sms_enqueue(text, uuid, text, text, jsonb, int, text, boolean) is
  '#467: TEST→sms_test_numbers tylko EXTERNAL off; EXTERNAL on → sms_zone_recipients; ZONE_*→lista/pilot.';

create or replace function public.sms_pull(p_token text default null, p_limit int default 5)
returns table (id uuid, to_e164 text, body text, attempts smallint, expires_at timestamptz)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_dev uuid;
  v_left int;
  v_paused boolean;
  v_ext boolean;
begin
  v_dev := sms_device_auth(p_token);
  v_ext := external_messaging_enabled();

  update sms_outbox o
     set status = 'EXPIRED',
         error = coalesce(nullif(o.error, ''), '467: poza dozwolonym odbiorcą')
   where o.status in ('QUEUED', 'CLAIMED')
     and (
       o.kind not in ('ZONE_APPROACH', 'ZONE_ENTER', 'TEST')
       or (
         o.kind = 'TEST'
         and (
           (v_ext is not true
            and not exists (select 1 from sms_test_numbers t where t.to_e164 = o.to_e164))
           or
           (v_ext
            and not exists (
              select 1 from sms_zone_recipients r
               where r.active is true
                 and sms_zone_e164(r.phone_national, r.country) = o.to_e164
            ))
         )
       )
       or (
         o.kind in ('ZONE_APPROACH', 'ZONE_ENTER')
         and not exists (
           select 1 from sms_zone_recipients r
            where r.active is true
              and sms_zone_e164(r.phone_national, r.country) = o.to_e164
         )
         and not exists (
           select 1 from pilot_notify_redirect r
            where r.active is true
              and r.owner_phone_e164 = o.to_e164
              and (o.load_id is null or o.load_id = r.load_id)
         )
       )
     );

  update sms_outbox o set
    status = case when o.attempts >= 3 then 'FAILED'::sms_status else 'QUEUED'::sms_status end,
    error = case when o.attempts >= 3 then 'brak raportu z telefonu po 3 próbach' else o.error end,
    not_before = case when o.attempts >= 3 then o.not_before else now() + interval '3 seconds' end,
    device_id = case when o.attempts >= 3 then o.device_id else null end
  where o.status = 'CLAIMED' and o.claimed_at < now() - interval '3 minutes';

  select greatest(day_limit - day_sent, 0), paused into v_left, v_paused from sms_devices where id = v_dev;
  if v_paused then return; end if;

  return query
  with c as (
    select o.id from sms_outbox o
     where o.status = 'QUEUED' and o.not_before <= now() and o.expires_at > now()
       and o.kind in ('ZONE_APPROACH', 'ZONE_ENTER', 'TEST')
       and (
         (
           o.kind = 'TEST'
           and (
             (v_ext is not true and exists (select 1 from sms_test_numbers t where t.to_e164 = o.to_e164))
             or (v_ext and exists (
                   select 1 from sms_zone_recipients r
                    where r.active is true
                      and sms_zone_e164(r.phone_national, r.country) = o.to_e164
                 ))
           )
         )
         or (
           o.kind in ('ZONE_APPROACH', 'ZONE_ENTER')
           and (
             exists (
               select 1 from sms_zone_recipients r
                where r.active is true
                  and sms_zone_e164(r.phone_national, r.country) = o.to_e164
             )
             or exists (
               select 1 from pilot_notify_redirect r
                where r.active is true
                  and r.owner_phone_e164 = o.to_e164
                  and (o.load_id is null or o.load_id = r.load_id)
             )
           )
         )
       )
     order by o.priority desc, o.created_at
     limit least(greatest(coalesce(p_limit, 5), 0), 5, v_left)
     for update skip locked
  )
  update sms_outbox o set
    status = 'CLAIMED',
    device_id = v_dev,
    claimed_at = now(),
    attempts = o.attempts + 1
  from c where o.id = c.id
  returning o.id, o.to_e164,
            coalesce((select s.body from sms_outbox_secret s where s.sms_id = o.id), o.body),
            o.attempts, o.expires_at;
end $$;

revoke all on function public.sms_pull(text, int) from public, authenticated;
grant execute on function public.sms_pull(text, int) to anon;
comment on function public.sms_pull(text, int) is
  '#467: pull TEST — test_numbers tylko EXTERNAL off; EXTERNAL on — lista stref; ZONE_* + pilot.';

create or replace function public.sms_send_test(p_to text) returns uuid
language plpgsql security definer set search_path = public as $$
begin
  -- F7 #478: poza zakresem #467 — zostaje is_hhl_admin() (nie HHL_OPS).
  if (is_hhl_admin()) is not true then
    raise exception 'SMS testowy wysyła wyłącznie Administrator HHL' using errcode = '42501';
  end if;
  if external_messaging_enabled() then
    raise exception 'Numery testowe wyłączone przy włączonej wysyłce zewnętrznej — SMS idą na listę stref'
      using errcode = 'P0001';
  end if;
  if (exists (select 1 from sms_test_numbers where to_e164 = p_to)) is not true then
    raise exception 'SMS testowy tylko na numer z listy numerów testowych' using errcode = '22023';
  end if;
  return sms_enqueue('TEST', null, p_to, null, '{}'::jsonb, 100, null, false);
end $$;
revoke all on function public.sms_send_test(text) from public, anon;
grant execute on function public.sms_send_test(text) to authenticated;
comment on function public.sms_send_test(text) is
  '#467: SMS na numer testowy tylko przy wyłączonej EXTERNAL_MESSAGING; tylko HHL_ADMIN.';

-- ---------------------------------------------------------------------------
-- 3. Macierz: Admin HHL może sms_gw × CARRIER_*/CLIENT_USER; inne SYSTEM — tylko HHL.
--    my_notify_set: SYSTEM (w tym sms_gw) dla ról nie-HHL = odmowa.
-- ---------------------------------------------------------------------------
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
  v_sms_gw_orphan boolean;
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
  -- #467 F7: wyjątek — sms_gw dla ról bez konta (maile z pliku) włącza Admin HHL.
  v_sms_gw_orphan := (
    p_event_group = 'sms_gw'
    and p_role in ('CARRIER_DISPATCH', 'CARRIER_USER', 'CLIENT_USER')
  );
  if (
    p_event_group = 'SYSTEM'
    or p_event_group in ('sms_gw', 'src_down', 'src_back', 'app_err', 'daily')
  ) and p_role not in ('HHL_ADMIN', 'HHL_OPS')
    and v_sms_gw_orphan is not true then
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
comment on function public.admin_notification_matrix_set(text, text, boolean, boolean, boolean) is
  '#467 F7: SYSTEM tylko HHL; wyjątek sms_gw × CARRIER_*/CLIENT_USER (maile bez konta).';

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
  v_group text;
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
    case p_channel when 'bell' then fixed_in_app when 'push' then fixed_push else fixed_email end,
    event_group
    into v_matrix, v_fixed, v_group
    from public.notification_matrix
   where event_key = p_event_key and role = v_role;
  if (v_matrix is not null) is not true then
    raise exception 'To zdarzenie nie dotyczy Twojego konta' using errcode = '42501';
  end if;
  -- #467 F7: SYSTEM (w tym sms_gw) — tylko HHL w „Moje powiadomienia”; SCX/KSH nie.
  if v_role::text not in ('HHL_ADMIN', 'HHL_OPS')
     and (
       v_group = 'SYSTEM'
       or p_event_key in ('sms_gw', 'src_down', 'src_back', 'app_err', 'daily')
     ) then
    raise exception 'Zdarzenia systemowe — tylko HHL' using errcode = '42501';
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
comment on function public.my_notify_set(text, text, boolean) is
  '#467 F7: prefs osoby; SYSTEM/sms_gw dla ról nie-HHL = odmowa (włącza Admin w macierzy).';

-- ---------------------------------------------------------------------------
-- 4. E42: pilot_redirect_dry_run — SMS przez enqueue; mail = odczyt bez insertu
--    (nie sprawdza już przekierowania maila przez bramkę #467).
-- ---------------------------------------------------------------------------
create or replace function public.pilot_redirect_dry_run(p_load uuid default '963e19dd-fe83-4690-9306-5c7fc4b95468')
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_sms uuid;
  v_to text;
  v_owner_phone text;
  v_owner_email text;
  v_redir record;
begin
  select * into v_redir from public.pilot_redirect_for_load(p_load);
  if not found or v_redir.owner_phone_e164 is null then
    return jsonb_build_object('ok', false, 'error', 'brak aktywnego redirectu');
  end if;
  v_owner_phone := v_redir.owner_phone_e164;
  v_owner_email := v_redir.owner_email;

  v_sms := sms_enqueue(
    'ZONE_APPROACH', p_load, '+48111222333', 'pl',
    jsonb_build_object('kto', 'TEST', 'rej', 'GD035YX', 'wysylka', 'DRY', 'miejsce', 'Boden', 'eta', '—'),
    10, 'PILOT_DRY_SMS:' || p_load::text || ':' || floor(extract(epoch from now()))::text, false
  );
  select to_e164 into v_to from sms_outbox where id = v_sms;

  update sms_outbox set status = 'EXPIRED', error = 'pilot dry-run — nie wysyłać'
   where id = v_sms;

  -- Bez insertu EMAIL: dry-run nie zależy od notify_orphan_email_allowed / macierzy.
  return jsonb_build_object(
    'ok', (
      v_to = v_owner_phone
      and v_owner_email is not null
      and length(trim(v_owner_email)) > 0
    ),
    'sms_id', v_sms,
    'sms_to', v_to,
    'expected_phone', v_owner_phone,
    'mail_to', v_owner_email,
    'expected_email', v_owner_email
  );
end $$;

revoke all on function public.pilot_redirect_dry_run(uuid) from public, anon;
grant execute on function public.pilot_redirect_dry_run(uuid) to service_role;
comment on function public.pilot_redirect_dry_run(uuid) is
  '#467 F7: dry-run ZONE_* → numer pilota; mail = adres z redirect (bez insertu, bez bramki).';
