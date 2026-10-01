-- 0110 — DEC-6: dziennik logowań Auth + komunikat (baner) dla firm.
-- Źródło logowań: auth.audit_log_entries (Supabase Auth). Bez zapisu z API.
-- Baner: treść + termin + wybór firm (FORWARDER/CARRIER/CLIENT).
-- Idempotentna, niedestrukcyjna.

-- ── Dziennik logowań ────────────────────────────────────────────────────────

create or replace function public.admin_auth_login_log(p_limit int default 50)
returns table (
  created_at timestamptz,
  ip_address text,
  action text,
  actor text,
  log_type text,
  email text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_lim int;
begin
  if (current_app_role() = 'HHL_ADMIN') is not true then
    raise exception 'Tylko administrator HHL' using errcode = '42501';
  end if;
  v_lim := least(greatest(coalesce(p_limit, 50), 1), 200);
  return query
  select
    a.created_at,
    nullif(btrim(coalesce(a.ip_address, '')), '')::text,
    coalesce(a.payload->>'action', a.payload->>'log_type', '')::text,
    coalesce(
      a.payload->>'actor_username',
      a.payload->'actor'->>'username',
      a.payload->>'email',
      ''
    )::text,
    coalesce(a.payload->>'log_type', '')::text,
    coalesce(
      a.payload->>'actor_username',
      a.payload->'actor'->>'username',
      a.payload->>'email',
      ''
    )::text
  from auth.audit_log_entries a
  order by a.created_at desc
  limit v_lim;
end $$;

revoke all on function public.admin_auth_login_log(int) from public, anon;
grant execute on function public.admin_auth_login_log(int) to authenticated;

-- ── Komunikat / baner ───────────────────────────────────────────────────────

create table if not exists public.system_broadcast (
  id              bigserial primary key,
  body            text not null check (char_length(btrim(body)) between 1 and 500),
  expires_at      timestamptz not null,
  for_forwarder   boolean not null default true,
  for_carrier     boolean not null default true,
  for_client      boolean not null default true,
  created_at      timestamptz not null default now(),
  created_by      uuid references public.app_users(id),
  cleared_at      timestamptz
);

alter table public.system_broadcast enable row level security;
revoke all on table public.system_broadcast from anon;
revoke insert, update, delete, truncate on table public.system_broadcast from authenticated;
grant select on table public.system_broadcast to authenticated;

drop policy if exists system_broadcast_read on public.system_broadcast;
create policy system_broadcast_read on public.system_broadcast for select to authenticated using (
  exists (
    select 1 from app_users u
    where u.auth_id = auth.uid() and u.active and u.role = 'HHL_ADMIN'
  )
);

create or replace function public.system_broadcast_current()
returns table (
  id bigint,
  body text,
  expires_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role text;
  v_fwd boolean;
  v_car boolean;
  v_cli boolean;
begin
  select role::text into v_role from app_users where auth_id = auth.uid() and active;
  if (v_role is not null) is not true then
    return;
  end if;
  v_fwd := v_role in ('HHL_ADMIN', 'HHL_OPS');
  v_car := v_role in ('CARRIER_DISPATCH', 'CARRIER_USER');
  v_cli := v_role in ('CLIENT_ADMIN', 'CLIENT_USER');
  return query
  select b.id, b.body, b.expires_at
  from system_broadcast b
  where b.cleared_at is null
    and b.expires_at > now()
    and (
      (v_fwd and b.for_forwarder) or
      (v_car and b.for_carrier) or
      (v_cli and b.for_client)
    )
  order by b.created_at desc
  limit 1;
end $$;

revoke all on function public.system_broadcast_current() from public, anon;
grant execute on function public.system_broadcast_current() to authenticated;

create or replace function public.admin_broadcast_set(
  p_body text,
  p_expires_at timestamptz,
  p_forwarder boolean,
  p_carrier boolean,
  p_client boolean
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid;
  v_id bigint;
  v_body text;
begin
  if (current_app_role() = 'HHL_ADMIN') is not true then
    raise exception 'Tylko administrator HHL' using errcode = '42501';
  end if;
  select id into v_me from app_users where auth_id = auth.uid() and active;
  v_body := btrim(coalesce(p_body, ''));
  if (char_length(v_body) between 1 and 500) is not true then
    raise exception 'Treść komunikatu: 1–500 znaków' using errcode = '22023';
  end if;
  if (p_expires_at is not null and p_expires_at > now()) is not true then
    raise exception 'Termin ważności musi być w przyszłości' using errcode = '22023';
  end if;
  if (coalesce(p_forwarder, false) or coalesce(p_carrier, false) or coalesce(p_client, false)) is not true then
    raise exception 'Wybierz co najmniej jedną firmę' using errcode = '22023';
  end if;

  update system_broadcast
     set cleared_at = now()
   where cleared_at is null;

  insert into system_broadcast (body, expires_at, for_forwarder, for_carrier, for_client, created_by)
  values (v_body, p_expires_at, coalesce(p_forwarder, false), coalesce(p_carrier, false), coalesce(p_client, false), v_me)
  returning id into v_id;

  insert into audit_log (user_id, action, entity, entity_id, new_value)
  values (v_me, 'BROADCAST_SET', 'system_broadcast', v_id::text,
          jsonb_build_object(
            'body', v_body,
            'expires_at', p_expires_at,
            'forwarder', p_forwarder,
            'carrier', p_carrier,
            'client', p_client
          ));
  return v_id;
end $$;

revoke all on function public.admin_broadcast_set(text, timestamptz, boolean, boolean, boolean) from public, anon;
grant execute on function public.admin_broadcast_set(text, timestamptz, boolean, boolean, boolean) to authenticated;

create or replace function public.admin_broadcast_clear()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid;
  v_n int;
begin
  if (current_app_role() = 'HHL_ADMIN') is not true then
    raise exception 'Tylko administrator HHL' using errcode = '42501';
  end if;
  select id into v_me from app_users where auth_id = auth.uid() and active;
  update system_broadcast
     set cleared_at = now()
   where cleared_at is null;
  get diagnostics v_n = row_count;
  insert into audit_log (user_id, action, entity, entity_id, new_value)
  values (v_me, 'BROADCAST_CLEAR', 'system_broadcast', null,
          jsonb_build_object('cleared', v_n));
end $$;

revoke all on function public.admin_broadcast_clear() from public, anon;
grant execute on function public.admin_broadcast_clear() to authenticated;
