-- #412 / D-20261021-2040-01 pkt 4–6 (część): E16 próg marży + E11 liczba urządzeń push.
-- E43 treści wiadomości — osobna migracja (większy zakres).
-- Odczyt: HHL. Zapis progu: tylko Administrator HHL + audit. Front — koordynator.

select set_config('tower.audit_source', 'migracja 0288 (#412 E16 marża + E11 push)', true);

-- ---------------------------------------------------------------------------
-- E16 — próg marży (jeden wiersz; null = flaga wyłączona). Start 4 % (decyzja 08.10).
-- ---------------------------------------------------------------------------
create table if not exists public.margin_threshold (
  id          boolean primary key default true check (id),
  pct         numeric(5, 1) check (pct is null or (pct >= 0 and pct <= 100)),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.app_users(id)
);

alter table public.margin_threshold enable row level security;

revoke all on table public.margin_threshold from public, anon;
revoke insert, update, delete, truncate, references, trigger
  on table public.margin_threshold from authenticated;
grant select on table public.margin_threshold to authenticated;

drop policy if exists margin_threshold_read on public.margin_threshold;
create policy margin_threshold_read on public.margin_threshold
  for select to authenticated
  using ((public.is_hhl()) is true);

comment on table public.margin_threshold is
  '#412 E16: próg marży % (Opcje › Cennik); null = flaga wyłączona; zapis tylko przez margin_threshold_set.';

insert into public.margin_threshold (id, pct) values (true, 4.0)
on conflict (id) do nothing;

create or replace function public.margin_threshold_get()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_pct numeric;
  v_changed jsonb;
begin
  if (public.is_hhl()) is not true then
    raise exception 'Próg marży — tylko HHL' using errcode = '42501';
  end if;

  select m.pct into v_pct from public.margin_threshold m where m.id is true;

  select jsonb_build_object(
           'at', a.created_at,
           'by', coalesce(nullif(btrim(u.full_name), ''), split_part(u.email::text, '@', 1), '—')
         )
    into v_changed
    from public.audit_log a
    left join public.app_users u on u.id = a.user_id
   where a.action = 'MARGIN_THRESHOLD_SET'
   order by a.created_at desc
   limit 1;

  return jsonb_build_object(
    'pct', to_jsonb(v_pct),
    'changed', v_changed
  );
end $$;

revoke all on function public.margin_threshold_get() from public, anon;
grant execute on function public.margin_threshold_get() to authenticated;
comment on function public.margin_threshold_get() is
  '#412 E16: { pct, changed }; pct null = flaga wyłączona; tylko HHL.';

create or replace function public.margin_threshold_set(p_pct numeric)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid;
  v_old numeric;
  v_new numeric;
begin
  if (public.is_hhl_admin()) is not true then
    raise exception 'Próg marży — wyłącznie Administrator HHL' using errcode = '42501';
  end if;

  select id into v_me from public.app_users where auth_id = auth.uid() and active;
  if (v_me is not null) is not true then
    raise exception 'Brak konta' using errcode = 'P0002';
  end if;

  if p_pct is null then
    v_new := null;
  else
    if (p_pct >= 0 and p_pct <= 100) is not true then
      raise exception 'Próg marży: 0–100 %%' using errcode = '22023';
    end if;
    v_new := round(p_pct, 1);
  end if;

  select m.pct into v_old from public.margin_threshold m where m.id is true for update;
  if not found then
    insert into public.margin_threshold (id, pct, updated_at, updated_by)
    values (true, v_new, now(), v_me);
  elsif v_old is not distinct from v_new then
    return public.margin_threshold_get();
  else
    update public.margin_threshold
       set pct = v_new, updated_at = now(), updated_by = v_me
     where id is true;
  end if;

  insert into public.audit_log (user_id, action, entity, entity_id, old_value, new_value)
  values (
    v_me, 'MARGIN_THRESHOLD_SET', 'margin_threshold', 'singleton',
    jsonb_build_object('pct', v_old),
    jsonb_build_object('pct', v_new)
  );

  return public.margin_threshold_get();
end $$;

revoke all on function public.margin_threshold_set(numeric) from public, anon;
grant execute on function public.margin_threshold_set(numeric) to authenticated;
comment on function public.margin_threshold_set(numeric) is
  '#412 E16: zapis progu (null = wyłącz); Administrator HHL; audit MARGIN_THRESHOLD_SET.';

-- ---------------------------------------------------------------------------
-- E11 — liczba urządzeń push (własne + wszystkie) dla HHL.
-- ---------------------------------------------------------------------------
create or replace function public.push_devices_count()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_me uuid;
  v_own int;
  v_all int;
begin
  if (public.is_hhl()) is not true then
    raise exception 'Liczba urządzeń — tylko HHL' using errcode = '42501';
  end if;

  select id into v_me from public.app_users where auth_id = auth.uid() and active;
  if (v_me is not null) is not true then
    raise exception 'Brak konta' using errcode = 'P0002';
  end if;

  select count(*)::int into v_own
    from public.push_subscriptions s
   where s.user_id = v_me;

  select count(*)::int into v_all
    from public.push_subscriptions;

  return jsonb_build_object('own', v_own, 'all', v_all);
end $$;

revoke all on function public.push_devices_count() from public, anon;
grant execute on function public.push_devices_count() to authenticated;
comment on function public.push_devices_count() is
  '#412 E11: { own, all } z push_subscriptions; tylko HHL (security definer).';
