-- TOWER — Migracja 0206: D-20261014-1420-01 R3 — wylogowanie jednego urządzenia (my_session_revoke).
-- Wzorzec: revoke_user_sessions / my_sessions (0026). Nie kasuje bieżącej sesji JWT.

create or replace function public.my_session_revoke(p_session uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid;
  v_sid text;
  n int := 0;
begin
  select id into v_me from app_users where auth_id = auth.uid() and active;
  if (v_me is not null) is not true then
    raise exception 'Brak aktywnego konta' using errcode = '42501';
  end if;

  if (p_session is not null) is not true then
    raise exception 'Brak identyfikatora urządzenia' using errcode = '22023';
  end if;

  v_sid := nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'session_id';
  if v_sid is not null and v_sid = p_session::text then
    raise exception 'Tego urządzenia nie wylogujesz tutaj — użyj Wyloguj' using errcode = '22023';
  end if;

  if to_regclass('auth.sessions') is null then
    raise exception 'Nieznane urządzenie' using errcode = '22023';
  end if;

  execute 'delete from auth.sessions where id = $1 and user_id = $2'
    using p_session, auth.uid();
  get diagnostics n = row_count;

  if n = 0 then
    raise exception 'Nieznane urządzenie' using errcode = '22023';
  end if;

  insert into audit_log (user_id, action, entity, entity_id, new_value)
  values (v_me, 'SESSION_REVOKE', 'auth.sessions', p_session::text, jsonb_build_object('sessions', n));

  return n;
end $$;

revoke all on function public.my_session_revoke(uuid) from public, anon;
grant execute on function public.my_session_revoke(uuid) to authenticated;

comment on function public.my_session_revoke(uuid) is
  'D-20261014-1420-01 R3: wyloguj jedno obce urządzenie (nie bieżące); audit SESSION_REVOKE.';
