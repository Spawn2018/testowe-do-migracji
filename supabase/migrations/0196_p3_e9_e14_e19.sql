-- TOWER — Migracja 0196: P3 — E9 (5 ról, koszty CARRIER_USER), E14 (rola bez zmiany = bez wpisu),
-- E19 (widoki cen security_invoker + admin_security_flag_set), G-20 (daty tylko CLIENT_USER).
-- Idempotentna. Bez zmian wyglądu.

-- 1) Zaproszenie / zmiana roli: tylko 5 rodzajów kont (E9, E14) -----------------
create or replace function public.admin_invite_user(
  p_email text, p_org_code text, p_role user_role,
  p_full_name text default null, p_locale text default 'pl'
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_org organizations%rowtype; v_id uuid; v_me uuid; v_user app_users%rowtype;
        v_signed boolean; v_reinvite boolean := false;
begin
  if current_app_role() is distinct from 'HHL_ADMIN' then
    raise exception 'Zapraszać może wyłącznie administrator HHL' using errcode = '42501';
  end if;
  if p_email is null or p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Nieprawidłowy adres e-mail';
  end if;
  if p_role in ('CLIENT_ADMIN', 'SITE_VIEWER') then
    raise exception 'Rola % nie jest w użyciu — wybierz jeden z 5 rodzajów kont (E9)', p_role
      using errcode = '22023';
  end if;
  select * into v_org from organizations where code = upper(p_org_code);
  if not found then raise exception 'Nieznana organizacja: %', p_org_code; end if;
  if role_matches_org(p_role, v_org.kind) is not true then
    raise exception 'Rola % nie pasuje do organizacji %', p_role, v_org.code;
  end if;
  if coalesce(p_locale,'pl') not in ('pl','en','sv') then raise exception 'Nieznany język'; end if;
  select * into v_user from app_users where email = lower(p_email)::citext;
  if found then
    v_signed := true;
    if to_regclass('auth.users') is not null then
      execute 'select last_sign_in_at is not null from auth.users where id = $1' into v_signed using v_user.auth_id;
    end if;
    if coalesce(v_signed, false) then
      raise exception 'Użytkownik już istnieje — zmień rolę zamiast zapraszać';
    end if;
    v_reinvite := true;
  end if;
  select id into v_me from app_users where auth_id = auth.uid();
  insert into user_invites (email, org_id, role, full_name, locale, invited_by)
  values (lower(p_email), v_org.id, p_role, p_full_name, coalesce(p_locale,'pl'), v_me)
  on conflict (email) do update
     set org_id = excluded.org_id, role = excluded.role, full_name = excluded.full_name,
         locale = excluded.locale, invited_by = excluded.invited_by, created_at = now()
   where user_invites.accepted_at is null
  returning id into v_id;
  if v_id is null then raise exception 'Zaproszenie już przyjęte'; end if;
  if v_reinvite then
    update app_users set active = true, org_id = v_org.id, role = p_role,
           full_name = coalesce(p_full_name, full_name), locale = coalesce(p_locale, locale)
     where id = v_user.id;
  end if;
  insert into audit_log (user_id, action, entity, entity_id, new_value)
  values (v_me, case when v_reinvite then 'USER_REINVITED' else 'USER_INVITED' end, 'user_invites', v_id::text,
          jsonb_build_object('org', v_org.code, 'role', p_role));
  return v_id;
end $$;

create or replace function public.admin_set_user_role(p_user uuid, p_role user_role)
returns void
language plpgsql security definer set search_path = public as $$
declare v_old user_role; v_kind org_kind; v_auth uuid;
begin
  if current_app_role() is distinct from 'HHL_ADMIN' then
    raise exception 'Role nadaje wyłącznie administrator HHL' using errcode = '42501';
  end if;
  if p_role in ('CLIENT_ADMIN', 'SITE_VIEWER') then
    raise exception 'Rola % nie jest w użyciu — wybierz jeden z 5 rodzajów kont (E9)', p_role
      using errcode = '22023';
  end if;
  select u.role, o.kind, u.auth_id into v_old, v_kind, v_auth
    from app_users u join organizations o on o.id = u.org_id where u.id = p_user;
  if not found then raise exception 'Nieznany użytkownik'; end if;
  if v_auth = auth.uid() and p_role <> 'HHL_ADMIN' then
    raise exception 'Nie możesz odebrać sobie roli administratora';
  end if;
  if role_matches_org(p_role, v_kind) is not true then
    raise exception 'Rola % nie pasuje do organizacji użytkownika', p_role;
  end if;
  -- E12 / E14: bez wpisu, gdy nic się nie zmieniło
  if v_old is not distinct from p_role then
    return;
  end if;
  update app_users set role = p_role where id = p_user;
  insert into audit_log (user_id, action, entity, entity_id, old_value, new_value)
  values ((select id from app_users where auth_id = auth.uid()), 'USER_ROLE_SET',
          'app_users', p_user::text, jsonb_build_object('role', v_old),
          jsonb_build_object('role', p_role));
end $$;

-- 2) Daty planu: tylko KSH Użytkownik (CLIENT_USER); G-20 — treść jak 0192 + rola ---------
create or replace function public.ksh_confirm_dates(
  p_load uuid,
  p_load_date date default null,
  p_delivery_date date default null,
  p_load_from timestamptz default null,
  p_load_to timestamptz default null,
  p_delivery_from timestamptz default null,
  p_delivery_to timestamptz default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  l loads%rowtype;
  v_client uuid;
  v_ld date; v_dd date;
  v_lf timestamptz; v_lt timestamptz; v_df timestamptz; v_dt timestamptz;
  v_changed boolean;
  v_actor uuid := current_app_user_id();
  v_label text;
  v_code text;
  v_awiz boolean;
  v_stamp text := to_char(clock_timestamp(), 'YYYYMMDDHH24MISSUS');
  v_payload jsonb;
begin
  if (v_actor is not null) is not true then
    raise exception 'Brak aktywnego konta' using errcode = '42501';
  end if;
  -- G-20: tylko CLIENT_USER (także przy „Działaj jako” — current_app_role = konto docelowe)
  if (current_app_role() = 'CLIENT_USER') is not true then
    raise exception 'Daty i godziny zmienia wyłącznie KSH Użytkownik' using errcode = '42501';
  end if;
  if (current_org_kind() = 'CLIENT') is not true then
    raise exception 'Daty i godziny w tym oknie zmienia wyłącznie KSH (zamawiający)' using errcode = '42501';
  end if;
  if p_load is null then raise exception 'Brak transportu' using errcode = '22023'; end if;
  select * into l from loads where id = p_load for update;
  if not found then raise exception 'Transport nie istnieje' using errcode = '42501'; end if;
  select client_org_id into v_client from projects where id = l.project_id;
  if (v_client = current_org_id()) is not true then
    raise exception 'Daty i godziny w tym oknie zmienia wyłącznie KSH (zamawiający)' using errcode = '42501';
  end if;
  if (l.status in ('PLANNED','RESOURCES_PENDING','DOCS_PENDING','READY')) is not true then
    raise exception 'Po wjeździe na załadunek (albo po anulowaniu) daty planu nie zmienia się w tym oknie' using errcode = '42501';
  end if;
  v_ld := coalesce(p_load_date, (p_load_from at time zone 'Europe/Warsaw')::date, l.plan_load_date);
  v_dd := coalesce(p_delivery_date, (p_delivery_from at time zone 'Europe/Stockholm')::date, l.plan_delivery_date);
  v_lf := coalesce(p_load_from, l.plan_load_from);
  v_lt := coalesce(p_load_to, l.plan_load_to);
  v_df := coalesce(p_delivery_from, l.plan_delivery_from);
  v_dt := coalesce(p_delivery_to, l.plan_delivery_to);
  if (v_ld is not null and v_dd is not null) is not true then
    raise exception 'Brak daty załadunku albo rozładunku' using errcode = '22023';
  end if;
  if (v_dd >= v_ld) is not true then
    raise exception 'Data rozładunku przed datą załadunku' using errcode = '22023';
  end if;
  if (v_lf <= v_lt) is false or (v_df <= v_dt) is false then
    raise exception 'Początek okna po jego końcu' using errcode = '22023';
  end if;
  if (v_df >= v_lf) is false then
    raise exception 'Rozładunek przed załadunkiem' using errcode = '22023';
  end if;
  v_changed := (v_ld, v_dd, v_lf, v_lt, v_df, v_dt)
               is distinct from (l.plan_load_date, l.plan_delivery_date, l.plan_load_from, l.plan_load_to, l.plan_delivery_from, l.plan_delivery_to);
  if v_changed is not true then
    return jsonb_build_object('changed', false);
  end if;

  select coalesce(nullif(btrim(u.full_name), ''), split_part(u.email::text, '@', 1), '—') || ' // KSH'
    into v_label from app_users u where u.id = v_actor;
  perform set_config('tower.dates_actor', v_label, true);
  perform set_config('tower.dates_ctx', 'on', true);
  update loads set plan_load_date = v_ld, plan_delivery_date = v_dd,
         plan_load_from = v_lf, plan_load_to = v_lt, plan_delivery_from = v_df, plan_delivery_to = v_dt,
         plan_dates_status = 'POTWIERDZONA', plan_dates_confirmed_by = v_actor, plan_dates_confirmed_at = now(),
         updated_at = now()
   where id = p_load;
  perform set_config('tower.dates_ctx', '', true);
  perform set_config('tower.dates_actor', '', true);

  v_code := coalesce(l.order_no, left(l.id::text, 8));
  v_payload := jsonb_build_object(
    'code', v_code, 'by', 'KSH', 'status', 'POTWIERDZONA',
    'load_date', v_ld, 'delivery_date', v_dd,
    'before_load_date', l.plan_load_date, 'before_delivery_date', l.plan_delivery_date);
  perform matrix_notify('LOAD_STATUS', 'PLAN_DATES_CHANGED', p_load, l.project_id, v_payload,
                        'PLAN_DATES:' || p_load || ':' || v_stamp);
  delete from notifications
   where user_id = v_actor and load_id = p_load and dedup_key like 'PLAN_DATES:' || p_load || ':' || v_stamp || ':%';

  v_awiz := l.status = 'READY' or l.sailing_id is not null
            or nullif(btrim(l.ferry_booking_ref), '') is not null
            or (nullif(btrim(l.driver_name), '') is not null and nullif(btrim(l.tractor_plate), '') is not null);
  if v_awiz and (v_ld, v_dd, v_lf, v_df) is distinct from (l.plan_load_date, l.plan_delivery_date, l.plan_load_from, l.plan_delivery_from) then
    insert into load_events (load_id, event_type, occurred_at, actor_id, payload)
    values (p_load, 'SCHEDULE_DATE_CRITICAL', now(), v_actor,
            jsonb_build_object('code', v_code, 'by', 'KSH', 'actor', v_label,
                               'fields', to_jsonb(array['load_date','delivery_date']),
                               'before', jsonb_build_object('load_date', l.plan_load_date, 'delivery_date', l.plan_delivery_date),
                               'after', jsonb_build_object('load_date', v_ld, 'delivery_date', v_dd)));
    insert into notifications (channel, recipient, user_id, load_id, template, payload, dedup_key)
    select 'IN_APP', coalesce(u.email::text, u.id::text), u.id, p_load, 'SCHEDULE_DATE_CRITICAL',
           jsonb_build_object('code', v_code, 'fields', to_jsonb(array['load_date','delivery_date']),
                              'load_date', v_ld, 'delivery_date', v_dd, 'locale', u.locale),
           'SCHED_CRIT:KSH:' || p_load || ':' || v_stamp || ':' || u.id
      from app_users u join organizations o on o.id = u.org_id
     where u.active and (o.kind = 'FORWARDER' or (l.carrier_org_id is not null and u.org_id = l.carrier_org_id))
    on conflict (dedup_key) where dedup_key is not null do nothing;
  end if;

  return jsonb_build_object('changed', true, 'awizowany', v_awiz, 'load_date', v_ld, 'delivery_date', v_dd);
end $$;
revoke all on function public.ksh_confirm_dates(uuid, date, date, timestamptz, timestamptz, timestamptz, timestamptz) from public, anon;
grant execute on function public.ksh_confirm_dates(uuid, date, date, timestamptz, timestamptz, timestamptz, timestamptz) to authenticated;

-- 3) E19: SELECT na tabelach cen + RLS; widoki security_invoker; CARRIER_USER widzi koszt (E9)
drop policy if exists cost_read on load_cost;
create policy cost_read on load_cost for select to authenticated using (
  is_hhl()
  or exists (select 1 from loads l where l.id = load_cost.load_id
             and current_org_kind() = 'CARRIER'
             and l.carrier_org_id = current_org_id()
             and current_app_role() in ('CARRIER_DISPATCH', 'CARRIER_USER'))
);

grant select on load_cost, load_revenue to authenticated;

create or replace view v_load_financials_hhl with (security_invoker = true, security_barrier = true) as
select
  l.id as load_id, l.project_id, l.order_no, l.hhl_order_no, l.carrier_order_no, l.status,
  money_least_tier(c.pricing_tier, r.pricing_tier) as pricing_tier,
  'EUR'::char(3) as currency,
  c.pricing_tier as cost_tier,
  c.computed_total_eur as cost_computed_eur,
  c.invoiced_total_eur as cost_invoiced_eur,
  money_effective_eur(c.invoiced_total_eur, c.computed_total_eur, c.total_amount) as cost_effective_eur,
  r.pricing_tier as rev_tier,
  r.computed_total_eur as rev_computed_eur,
  r.invoiced_total_eur as rev_invoiced_eur,
  money_effective_eur(r.invoiced_total_eur, r.computed_total_eur, r.total_amount) as rev_effective_eur,
  money_effective_eur(r.invoiced_total_eur, r.computed_total_eur, r.total_amount)
    - money_effective_eur(c.invoiced_total_eur, c.computed_total_eur, c.total_amount) as margin_eur,
  case when coalesce(money_effective_eur(r.invoiced_total_eur, r.computed_total_eur, r.total_amount), 0) = 0 then null
       else round((money_effective_eur(r.invoiced_total_eur, r.computed_total_eur, r.total_amount)
                   - money_effective_eur(c.invoiced_total_eur, c.computed_total_eur, c.total_amount))
                  / money_effective_eur(r.invoiced_total_eur, r.computed_total_eur, r.total_amount) * 100, 2) end as margin_pct,
  coalesce(c.fuel_ref_date, r.fuel_ref_date) as fuel_ref_date,
  c.fuel_applied_mult as cost_fuel_mult, r.fuel_applied_mult as rev_fuel_mult,
  c.fx_table_no as cost_fx_table_no, c.fx_effective_date as cost_fx_date, c.fx_rate_pln as cost_fx_mid, c.fx_provisional as cost_fx_provisional,
  r.fx_table_no as rev_fx_table_no,  r.fx_effective_date as rev_fx_date,  r.fx_rate_pln as rev_fx_mid,  r.fx_provisional as rev_fx_provisional
from loads l
left join load_cost    c on c.load_id = l.id
left join load_revenue r on r.load_id = l.id
where can_see_margin();

create or replace view v_load_price_carrier with (security_invoker = true, security_barrier = true) as
select l.id as load_id, l.project_id, l.order_no, l.hhl_order_no, l.carrier_order_no,
       c.currency, c.pricing_tier,
       c.base_amount, c.baf_pct, c.baf_amount, c.extras, c.extras_amount, c.total_amount,
       c.computed_total_eur, c.invoiced_total_eur,
       money_effective_eur(c.invoiced_total_eur, c.computed_total_eur, c.total_amount) as effective_total_eur,
       c.fuel_ref_date, c.fuel_mult_sek, c.fuel_mult_pln, c.fuel_applied_mult,
       c.fx_table_no, c.fx_effective_date, c.fx_rate_pln, c.fx_provisional,
       c.fuel_status
from loads l join load_cost c on c.load_id = l.id
where is_hhl()
   or (current_org_kind() = 'CARRIER'
       and l.carrier_org_id = current_org_id()
       and current_app_role() in ('CARRIER_DISPATCH', 'CARRIER_USER'));

create or replace view v_load_price_client with (security_invoker = true, security_barrier = true) as
select l.id as load_id, l.project_id, l.order_no, l.hhl_order_no, l.carrier_order_no,
       r.currency, r.pricing_tier,
       r.base_amount, r.baf_pct, r.baf_amount, r.extras, r.extras_amount, r.total_amount,
       r.computed_total_eur, r.invoiced_total_eur,
       money_effective_eur(r.invoiced_total_eur, r.computed_total_eur, r.total_amount) as effective_total_eur,
       r.fuel_ref_date, r.fuel_mult_sek, r.fuel_mult_pln, r.fuel_applied_mult,
       r.fx_table_no, r.fx_effective_date, r.fx_rate_pln, r.fx_provisional,
       r.fuel_status
from loads l join load_revenue r on r.load_id = l.id
join projects p on p.id = l.project_id
where is_hhl()
   or (current_org_kind() = 'CLIENT' and p.client_org_id = current_org_id());

revoke all on v_load_financials_hhl, v_load_price_carrier, v_load_price_client from public, anon;
grant select on v_load_financials_hhl, v_load_price_carrier, v_load_price_client to authenticated;
revoke insert, update, delete on v_load_financials_hhl, v_load_price_carrier, v_load_price_client from authenticated;

-- 4) E19: jedna funkcja zmiany przełącznika bezpieczeństwa ------------------------
create or replace function public.admin_security_flag_set(p_key text, p_enabled boolean)
returns boolean
language plpgsql security definer set search_path = public as $$
declare v_old boolean; v_me uuid;
begin
  if current_app_role() is distinct from 'HHL_ADMIN' then
    raise exception 'Przełączniki bezpieczeństwa zmienia wyłącznie administrator HHL' using errcode = '42501';
  end if;
  if (p_key is not null and p_enabled is not null) is not true then
    raise exception 'Brak klucza albo stanu przełącznika' using errcode = '22023';
  end if;
  select enabled into v_old from security_flags where key = p_key for update;
  if not found then
    raise exception 'Nieznany przełącznik: %', p_key using errcode = '22023';
  end if;
  if v_old is not distinct from p_enabled then
    return p_enabled;
  end if;
  select id into v_me from app_users where auth_id = auth.uid();
  update security_flags
     set enabled = p_enabled, updated_at = now(), updated_by = v_me
   where key = p_key;
  insert into audit_log (user_id, action, entity, entity_id, old_value, new_value)
  values (v_me, 'SECURITY_FLAG_SET', 'security_flags', p_key,
          jsonb_build_object('enabled', v_old),
          jsonb_build_object('enabled', p_enabled));
  return p_enabled;
end $$;

revoke all on function public.admin_security_flag_set(text, boolean) from public, anon;
grant execute on function public.admin_security_flag_set(text, boolean) to authenticated;
