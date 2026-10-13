-- E41 + E18 P15 (P2). Nazwa transportu w bazie. KSH nie dostaje numerów przez load_order_numbers.
-- SMS Śrem/Boden: sam kod wysyłki. Otwarte sprawy: numery wewnętrzne → kod, szwedzki ROAD_SE → polski.
-- 16 spraw „Nieznany kod źródła drogowego” zostaje do P10a.

create or replace function public.transport_label(
  p_code text, p_hhl text, p_carrier text, p_party text, p_place text default 'plain'
) returns text
language sql immutable set search_path = public as $$
  select case
    when p_party = 'KSH' then btrim(coalesce(p_code, ''))
    when p_party = 'HHL' and nullif(btrim(coalesce(p_hhl, '')), '') is not null
      then btrim(coalesce(p_code, '')) || ' · ' || btrim(p_hhl)
    when p_party = 'SCX' and nullif(btrim(coalesce(p_carrier, '')), '') is not null
      then btrim(coalesce(p_code, '')) || ' · ' || btrim(p_carrier)
    when p_party = 'HHL' and p_place in ('schedule', 'panel')
      then btrim(coalesce(p_code, '')) || ' brak nr HHL'
    when p_party = 'SCX' and p_place in ('schedule', 'panel')
      then btrim(coalesce(p_code, '')) || ' brak nr SCX'
    else btrim(coalesce(p_code, ''))
  end
$$;
revoke all on function public.transport_label(text, text, text, text, text) from public, anon, authenticated;

create or replace function public.load_sms_code(p_load uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select min(si.shipment_code) from shipment_items si
      where si.load_id = p_load and nullif(btrim(si.shipment_code), '') is not null),
    '—'
  )
$$;
revoke all on function public.load_sms_code(uuid) from public, anon, authenticated;

create or replace function public.load_order_numbers()
returns table (load_id uuid, hhl_order_no text, carrier_order_no text)
language plpgsql stable security definer set search_path = public as $$
begin
  if current_app_user_id() is null then
    return;
  end if;
  if current_org_kind() is distinct from 'FORWARDER' and current_org_kind() is distinct from 'CARRIER' then
    if current_org_kind() = 'CLIENT' then
      return query
      select l.id, null::text, null::text
      from loads l
      where exists (
        select 1 from projects p
        where p.id = l.project_id and p.client_org_id = current_org_id()
      );
    end if;
    return;
  end if;
  if is_hhl() is true then
    return query select l.id, l.hhl_order_no, l.carrier_order_no from loads l;
    return;
  end if;
  if current_org_kind() = 'CARRIER' then
    return query
    select l.id, l.hhl_order_no, l.carrier_order_no
    from loads l
    where l.carrier_org_id = current_org_id();
  end if;
end
$$;
revoke all on function public.load_order_numbers() from public, anon;
grant execute on function public.load_order_numbers() to authenticated;

create or replace function public.e18_p15_pl_title(p_title text, p_code text) returns text
language plpgsql immutable set search_path = public as $$
declare t text := btrim(coalesce(p_title, ''));
begin
  if t = '' then return t; end if;
  if t like 'Nieznany kod źródła drogowego%' then return t; end if;
  if t ~* 'från|riktning|län' and t !~ 'Zakaz ruchu' then
    t := replace(t, 'från', 'od');
    t := replace(t, ' till ', ' do ');
    t := replace(t, 'båda riktningarna', 'oba kierunki');
    t := regexp_replace(t, ' i ([^ ]+) län', ' w regionie \1', 'g');
    if t !~ '^Zakaz' then
      t := 'Zakaz ruchu ciężarówek w Szwecji: ' || t;
    end if;
  end if;
  t := regexp_replace(t, '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}\s*[:—–-]\s*', '', 'i');
  t := regexp_replace(t, '^[0-9a-f]{8}\s*:\s*', '', 'i');
  t := regexp_replace(t, '^\d{4,6}/\d{4}/[A-Z0-9/]+\s*[:—–-]\s*', '', 'i');
  if p_code is not null and btrim(p_code) <> '' and t !~ ('^' || p_code || '(\s|·|—)') then
    t := btrim(p_code) || ' — ' || t;
  end if;
  return t;
end
$$;
revoke all on function public.e18_p15_pl_title(text, text) from public, anon, authenticated;

create or replace function public.e18_p15_apply() returns int
language plpgsql security definer set search_path = public as $$
declare
  n int := 0;
  r record;
  v_code text;
  v_new text;
begin
  for r in
    select id, load_id, title from risk_signals
    where resolved_at is null
      and title not like 'Nieznany kod źródła drogowego%'
      and (
        title ~* 'från|riktning|län'
        or title ~* '^[0-9a-f]{8}'
        or title ~ '^\d{4,6}/\d{4}/'
      )
  loop
    select min(si.shipment_code) into v_code from shipment_items si where si.load_id = r.load_id;
    v_new := e18_p15_pl_title(r.title, v_code);
    if v_new is distinct from r.title then
      insert into audit_log (action, entity, entity_id, old_value, new_value, source)
      values ('E18_P15_KOPIA', 'risk_signals', r.id::text,
              jsonb_build_object('title', r.title),
              jsonb_build_object('title', v_new, 'wykonawca', 'migracja E18 P15'),
              'e18-p15');
      update risk_signals set title = v_new where id = r.id;
      n := n + 1;
    end if;
  end loop;
  for r in
    select id, load_id, title from decisions
    where status in ('NEW', 'ASSIGNED', 'SNOOZED')
      and title not like 'Nieznany kod źródła drogowego%'
      and (
        title ~* 'från|riktning|län'
        or title ~* '^[0-9a-f]{8}'
        or title ~ '^\d{4,6}/\d{4}/'
      )
  loop
    select min(si.shipment_code) into v_code from shipment_items si where si.load_id = r.load_id;
    v_new := e18_p15_pl_title(r.title, v_code);
    if v_new is distinct from r.title then
      insert into audit_log (action, entity, entity_id, old_value, new_value, source)
      values ('E18_P15_KOPIA', 'decisions', r.id::text,
              jsonb_build_object('title', r.title),
              jsonb_build_object('title', v_new, 'wykonawca', 'migracja E18 P15'),
              'e18-p15');
      update decisions set title = v_new where id = r.id;
      n := n + 1;
    end if;
  end loop;
  if n > 500 then
    raise exception 'E18 P15: za szerokie dopasowanie (% wierszy)', n;
  end if;
  return n;
end
$$;
revoke all on function public.e18_p15_apply() from public, anon, authenticated;

select public.e18_p15_apply();

create or replace function sms_zone_enqueue_for_event(
  p_load uuid, p_list text, p_kind text, p_place text, p_eta text default null
) returns int
language plpgsql security definer set search_path = public as $$
declare
  r record; n int := 0; v_to text; v_id uuid; v_plate text; v_code text; v_eta text; v_who text;
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

  select coalesce(nullif(l.tractor_plate, ''), '?'),
         public.load_sms_code(l.id),
         coalesce(nullif(btrim(l.driver_name), ''), nullif(btrim(l.order_no), ''), 'transport')
    into v_plate, v_code, v_who from loads l where l.id = p_load;
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
        'kto', sms_strip_pl(v_who),
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
