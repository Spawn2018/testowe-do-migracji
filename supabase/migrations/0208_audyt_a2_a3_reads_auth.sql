-- TOWER — 0208: A2 + A3 (D-20261015-0300-01; D-20261015-0330-01; decyzja właściciela 15.10.2026 03:12)
-- A2: warunek widoczności jak msgs_read + transport jak loads_read (security definer omija RLS);
--     zwracane pola bez zmian (imiona, nazwiska, e-maile zostają; RODO).
-- A3: REVOKE auth_email_allowed FROM anon (E19).

-- ---------------------------------------------------------------------------
-- A2: load_message_read_list — lista tylko gdy pytający widzi wiadomość i transport
-- ---------------------------------------------------------------------------
create or replace function public.load_message_read_list(p_message bigint)
returns table (user_id uuid, full_name text, org_code text, read_at timestamptz)
language sql stable security definer set search_path = public as $$
  select r.user_id, coalesce(u.full_name, u.email::text), o.code, r.read_at
    from load_message_reads r
    join app_users u on u.id = r.user_id
    left join organizations o on o.id = u.org_id
   where r.message_id = p_message
     and exists (
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
   order by r.read_at;
$$;
revoke all on function public.load_message_read_list(bigint) from public, anon;
grant execute on function public.load_message_read_list(bigint) to authenticated;
comment on function public.load_message_read_list(bigint) is
  'A2 (D-0330): lista czytających — tylko widoczna wiadomość i transport (loads_read); nazwiska i e-maile dla wszystkich firm (decyzja 15.10, 03:12, zgody RODO).';

-- list_load_messages_ui: bez zmian pól reads (nazwiska/e-maile zostają); filtr wiadomości jak msgs_read.

-- ---------------------------------------------------------------------------
-- A3: anon nie sprawdza, czy adres ma konto
-- ---------------------------------------------------------------------------
revoke execute on function public.auth_email_allowed(text) from anon;
