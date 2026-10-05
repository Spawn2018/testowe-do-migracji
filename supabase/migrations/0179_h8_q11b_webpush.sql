-- =====================================================================
-- TOWER — 0179: H-8 A profil tras (cache) + Q-11b A Web Push VAPID
--   Nie rusza H1/H3/H6 flags, TELM, SMS właściciela.
-- =====================================================================

-- H-8 cache
create table if not exists public.load_route_profiles (
  load_id    uuid primary key references public.loads(id) on delete cascade,
  fetched_at timestamptz not null default now(),
  dims_mode  text not null check (dims_mode in ('standard_truck', 'with_dims')),
  payload    jsonb not null default '[]'::jsonb
);
alter table public.load_route_profiles enable row level security;
revoke all on public.load_route_profiles from public, anon, authenticated;
grant select on public.load_route_profiles to authenticated;
drop policy if exists load_route_profiles_select on public.load_route_profiles;
create policy load_route_profiles_select on public.load_route_profiles
  for select to authenticated
  using (
    exists (
      select 1 from loads l
      where l.id = load_route_profiles.load_id
        and (
          is_hhl() is true
          or l.carrier_org_id = current_org_id()
          or exists (
            select 1 from projects p
             where p.id = l.project_id and p.client_org_id = current_org_id()
          )
        )
    )
  );
-- zapis tylko service_role (Edge)
do $$ begin
  grant all on public.load_route_profiles to service_role;
exception when others then null;
end $$;

-- Q-11b preferencje
alter table public.user_preferences
  add column if not exists web_push_enabled boolean not null default true;

comment on column public.user_preferences.web_push_enabled is
  'Q-11b A: czy wysyłać Web Push (krytyczne + skrót dzienny).';

-- Subskrypcje Push
create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.app_users(id) on delete cascade,
  endpoint    text not null,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz not null default now(),
  unique (endpoint)
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from public, anon, authenticated;
grant select, insert, delete on public.push_subscriptions to authenticated;
drop policy if exists push_subscriptions_own on public.push_subscriptions;
create policy push_subscriptions_own on public.push_subscriptions
  for all to authenticated
  using (user_id = current_app_user_id())
  with check (user_id = current_app_user_id());
do $$ begin
  grant all on public.push_subscriptions to service_role;
exception when others then null;
end $$;

create or replace function public.push_subscribe(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_ua text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid;
  v_id uuid;
begin
  v_me := current_app_user_id();
  if v_me is null then
    raise exception 'Brak aktywnego konta' using errcode = '42501';
  end if;
  if (char_length(trim(coalesce(p_endpoint, ''))) between 8 and 2000) is not true then
    raise exception 'Zły endpoint' using errcode = '22023';
  end if;
  if (char_length(trim(coalesce(p_p256dh, ''))) between 8 and 500) is not true
     or (char_length(trim(coalesce(p_auth, ''))) between 8 and 500) is not true then
    raise exception 'Złe klucze push' using errcode = '22023';
  end if;
  insert into push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values (v_me, trim(p_endpoint), trim(p_p256dh), trim(p_auth), left(coalesce(p_ua, ''), 300))
  on conflict (endpoint) do update
    set user_id = excluded.user_id,
        p256dh = excluded.p256dh,
        auth = excluded.auth,
        user_agent = excluded.user_agent
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.push_subscribe(text, text, text, text) from public, anon;
grant execute on function public.push_subscribe(text, text, text, text) to authenticated;

create or replace function public.push_unsubscribe(p_endpoint text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_app_user_id() is null then
    raise exception 'Brak aktywnego konta' using errcode = '42501';
  end if;
  delete from push_subscriptions
   where user_id = current_app_user_id() and endpoint = trim(p_endpoint);
end $$;
revoke all on function public.push_unsubscribe(text) from public, anon;
grant execute on function public.push_unsubscribe(text) to authenticated;

create or replace function public.set_web_push_enabled(p_on boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid;
begin
  v_me := current_app_user_id();
  if v_me is null then
    raise exception 'Brak aktywnego konta' using errcode = '42501';
  end if;
  insert into user_preferences (user_id, web_push_enabled)
  values (v_me, coalesce(p_on, true))
  on conflict (user_id) do update set web_push_enabled = coalesce(p_on, true), updated_at = now();
end $$;
revoke all on function public.set_web_push_enabled(boolean) from public, anon;
grant execute on function public.set_web_push_enabled(boolean) to authenticated;

-- matrix_notify: dopisz WEB_PUSH (DEC-4 in_app ∧ web_push_enabled ∧ subskrypcja)
-- Krytyczne → PENDING; pozostałe → DIGEST (L-13 skrót 1×/dzień)
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

  insert into notifications (channel, recipient, user_id, load_id, template, payload, dedup_key)
  select 'IN_APP', coalesce(u.email::text, u.id::text), u.id, p_load_id, p_template,
         coalesce(p_payload, '{}'::jsonb) || jsonb_build_object('locale', u.locale, 'event_group', p_event_group),
         left(p_dedup_prefix || ':IN:' || u.id::text, 200)
    from app_users u
    join organizations o on o.id = u.org_id
    join notification_matrix m
      on m.event_group = p_event_group and m.org_kind = o.kind::text and m.in_app
   where u.active
     and (p_only_org_kind is null or o.kind::text = p_only_org_kind)
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

  insert into notifications (channel, recipient, user_id, load_id, template, payload, dedup_key)
  select 'EMAIL', coalesce(u.email::text, u.id::text), u.id, p_load_id, p_template,
         coalesce(p_payload, '{}'::jsonb) || jsonb_build_object('locale', u.locale, 'event_group', p_event_group),
         left(p_dedup_prefix || ':EM:' || u.id::text, 200)
    from app_users u
    join organizations o on o.id = u.org_id
    join notification_matrix m
      on m.event_group = p_event_group and m.org_kind = o.kind::text and m.email
   where u.active and u.email is not null
     and (p_only_org_kind is null or o.kind::text = p_only_org_kind)
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

  -- Q-11b A: Web Push — ta sama widoczność co IN_APP (DEC-4)
  v_critical := (
    coalesce(p_payload->>'severity', '') = 'CRITICAL'
    or p_template ilike '%CRITICAL%'
    or p_template in ('FERRY_CANCELLED', 'SCHEDULE_DATE_CRITICAL')
  );
  insert into notifications (channel, recipient, user_id, load_id, template, payload, dedup_key, status)
  select 'WEB_PUSH', coalesce(u.email::text, u.id::text), u.id, p_load_id, p_template,
         coalesce(p_payload, '{}'::jsonb) || jsonb_build_object('locale', u.locale, 'event_group', p_event_group, 'critical', v_critical),
         left(p_dedup_prefix || ':WP:' || u.id::text, 200),
         case when v_critical then 'PENDING' else 'DIGEST' end
    from app_users u
    join organizations o on o.id = u.org_id
    join notification_matrix m
      on m.event_group = p_event_group and m.org_kind = o.kind::text and m.in_app
    left join user_preferences pref on pref.user_id = u.id
   where u.active
     and coalesce(pref.web_push_enabled, true) is true
     and exists (select 1 from push_subscriptions ps where ps.user_id = u.id)
     and (p_only_org_kind is null or o.kind::text = p_only_org_kind)
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

  return n;
end $$;

comment on function public.matrix_notify(text, text, uuid, uuid, jsonb, text, text) is
  'DEC-4 + Q-11b: IN_APP/EMAIL + WEB_PUSH (krytyczne PENDING, reszta DIGEST).';
