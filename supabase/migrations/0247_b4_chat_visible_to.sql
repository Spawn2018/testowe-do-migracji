-- B4 cz.1 · visible_to czatu na serwerze (Cz1–Cz3, Cz25; D-20261016-0250-01, D-20261016-0315-01)
-- Zapis wyboru odbiorców czatu pilnuje baza; lista UI zwraca visible_to (Cz2).
-- Powiadomienia z visible_to już w C3 (0222/0223). Plików src/ nie zmieniamy (UI w P6).
-- B4 cz.2 (osobny krok): visible_to przy dokumencie + test eksportu/paczki.

-- Obrona także dla cron / service_role (auth.uid() is null w wyzwalaczu).
alter table public.load_messages
  drop constraint if exists load_messages_visible_to_chk;

alter table public.load_messages
  add constraint load_messages_visible_to_chk check (
    (
      cardinality(visible_to) = 3
      and visible_to @> array['FORWARDER', 'CLIENT', 'CARRIER']::org_kind[]
      and visible_to <@ array['FORWARDER', 'CLIENT', 'CARRIER']::org_kind[]
    )
    or (
      cardinality(visible_to) = 2
      and visible_to @> array['FORWARDER', 'CARRIER']::org_kind[]
      and visible_to <@ array['FORWARDER', 'CARRIER']::org_kind[]
    )
  );

create or replace function public.set_message_author() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_org text;
  v_name text;
  v_kind text;
  v_vis org_kind[];
  v_all constant org_kind[] := array['FORWARDER', 'CLIENT', 'CARRIER']::org_kind[];
  v_hhl_scx constant org_kind[] := array['FORWARDER', 'CARRIER']::org_kind[];
begin
  /* Bez sesji (cron / service_role): CHECK load_messages_visible_to_chk pilnuje wartości. */
  if auth.uid() is null then
    return new;
  end if;

  select u.id, o.code, coalesce(nullif(trim(u.full_name), ''), u.email::text), o.kind::text
    into v_id, v_org, v_name, v_kind
    from app_users u
    join organizations o on o.id = u.org_id
   where u.auth_id = auth.uid() and u.active;
  if (v_id is not null) is not true then
    raise exception 'Brak aktywnego konta' using errcode = '42501';
  end if;

  new.author_id := v_id;
  new.author_org := v_org;
  new.author_display := v_name;
  new.created_at := now();

  /* Cz1: tylko ALL albo HHL+SCX; KSH zawsze ALL.
     Po normalizacji FORWARDER i firma autora są zawsze w zbiorze — bez osobnych asercji. */
  if v_kind = 'CLIENT' then
    new.visible_to := v_all;
    return new;
  end if;

  v_vis := coalesce(new.visible_to, v_all);
  v_vis := array(select distinct x from unnest(v_vis) as t(x) order by x);

  if v_vis @> v_all and cardinality(v_vis) = 3 then
    new.visible_to := v_all;
  elsif v_vis @> v_hhl_scx
        and cardinality(v_vis) = 2
        and not ('CLIENT'::org_kind = any (v_vis)) then
    if (v_kind in ('FORWARDER', 'CARRIER')) is not true then
      raise exception 'Widoczność wiadomości: tylko HHL i SCX albo wszyscy'
        using errcode = '22023';
    end if;
    new.visible_to := v_hhl_scx;
  else
    raise exception 'Widoczność wiadomości: dozwolone tylko „HHL, SCX i KSH” albo „tylko HHL i SCX”'
      using errcode = '22023';
  end if;

  return new;
end $$;

revoke execute on function public.set_message_author() from public, anon, authenticated;

comment on function public.set_message_author() is
  'B4 Cz1: autor + visible_to (ALL / HHL+SCX; KSH zawsze ALL).';

drop function if exists public.list_load_messages_ui();

create function public.list_load_messages_ui()
returns table (
  id bigint,
  load_id uuid,
  body text,
  created_at timestamptz,
  author_org text,
  author_display text,
  visible_to org_kind[],
  reads jsonb
)
language sql stable security definer set search_path = public as $$
  select m.id,
         m.load_id,
         m.body,
         m.created_at,
         m.author_org,
         coalesce(m.author_display, m.author_org, '—') as author_display,
         m.visible_to,
         coalesce((
           select jsonb_agg(
                    jsonb_build_object(
                      'userId', r.user_id,
                      'name', coalesce(nullif(trim(ru.full_name), ''), ru.email::text),
                      'org', o.code,
                      'at', r.read_at
                    )
                    order by r.read_at
                  )
             from load_message_reads r
             join app_users ru on ru.id = r.user_id
             left join organizations o on o.id = ru.org_id
            where r.message_id = m.id
         ), '[]'::jsonb) as reads
    from load_messages m
    join loads l on l.id = m.load_id
   where is_hhl()
      or (
           current_org_kind() = any (m.visible_to)
           and (
             (current_org_kind() = 'CLIENT'
              and exists (
                select 1 from projects p
                 where p.id = l.project_id and p.client_org_id = current_org_id()
              ))
             or (current_org_kind() = 'CARRIER' and l.carrier_org_id = current_org_id())
             or (current_org_kind() = 'SITE')
           )
         )
   order by m.created_at;
$$;

revoke all on function public.list_load_messages_ui() from public, anon;
grant execute on function public.list_load_messages_ui() to authenticated;

comment on function public.list_load_messages_ui() is
  'B4 Cz2: czat — autor, visible_to, odczyty; filtr jak load_message_read_list (0208).';

create or replace function public.mark_load_message_read(p_message bigint)
returns timestamptz
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid;
  v_at timestamptz := now();
begin
  v_uid := current_app_user_id();
  if v_uid is null then
    raise exception 'Brak użytkownika' using errcode = '42501';
  end if;

  if (
    exists (
      select 1
        from load_messages m
        join loads l on l.id = m.load_id
       where m.id = p_message
         and (
           public.is_hhl()
           or (
             current_org_kind() = any (m.visible_to)
             and (
               (current_org_kind() = 'CLIENT'
                and exists (
                  select 1 from projects p
                   where p.id = l.project_id and p.client_org_id = current_org_id()
                ))
               or (current_org_kind() = 'CARRIER' and l.carrier_org_id = current_org_id())
               or (current_org_kind() = 'SITE')
             )
           )
         )
    )
  ) is not true then
    raise exception 'Wiadomość niedostępna' using errcode = '42501';
  end if;

  insert into load_message_reads (message_id, user_id, read_at)
  values (p_message, v_uid, v_at)
  on conflict (message_id, user_id) do update set read_at = excluded.read_at
  returning read_at into v_at;
  return v_at;
end $$;

revoke all on function public.mark_load_message_read(bigint) from public, anon;
grant execute on function public.mark_load_message_read(bigint) to authenticated;

comment on function public.mark_load_message_read(bigint) is
  'B4: oznacz przeczytane — tylko gdy wiadomość i transport widoczne (jak 0208).';
