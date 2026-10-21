-- B4 · visible_to na serwerze (Cz1–Cz3, Cz25; D-20261016-0250-01, D-20261016-0315-01)
-- Zapis wyboru odbiorców czatu pilnuje baza; lista UI zwraca visible_to (Cz2).
-- Powiadomienia z visible_to już w C3 (0222/0223). Plików src/ nie zmieniamy (UI w P6).

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

  /* Cz1: tylko ALL albo HHL+SCX; KSH zawsze ALL; zawsze HHL + firma autora. */
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

  if ('FORWARDER'::org_kind = any (new.visible_to)) is not true then
    raise exception 'Widoczność wiadomości musi obejmować HHL' using errcode = '22023';
  end if;
  if (v_kind::org_kind = any (new.visible_to)) is not true then
    raise exception 'Widoczność wiadomości musi obejmować firmę autora' using errcode = '22023';
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
   where is_hhl()
      or (current_org_kind() = any (m.visible_to)
          and exists (select 1 from loads l where l.id = m.load_id))
   order by m.created_at;
$$;

revoke all on function public.list_load_messages_ui() from public, anon;
grant execute on function public.list_load_messages_ui() to authenticated;

comment on function public.list_load_messages_ui() is
  'B4 Cz2: czat — autor, visible_to, odczyty; widoczność jak msgs_read.';
