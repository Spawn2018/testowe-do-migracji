-- #648 F7 nieblokujące (po #654): ferry_route_set_active jak ksh_sync_write_set —
-- jawne HHL_ADMIN + mfa_satisfied (komunikat 2FA).

begin;

create or replace function public.ferry_route_set_active(p_code text, p_active boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_code text := upper(btrim(coalesce(p_code, '')));
  v_prev boolean;
  v_me uuid;
  v_role public.user_role;
begin
  perform public.assert_not_preview();
  select id, role into v_me, v_role
    from public.app_users
   where auth_id = auth.uid() and active;
  if (v_me is not null and v_role = 'HHL_ADMIN' and public.mfa_satisfied(v_role) is true) is not true then
    raise exception 'Tylko Administrator HHL z 2FA' using errcode = '42501';
  end if;
  if v_code = '' then
    raise exception 'Brak kodu trasy' using errcode = '22023';
  end if;
  if p_active is null then
    raise exception 'active wymagane' using errcode = '22023';
  end if;

  select fr.active into v_prev
    from public.ferry_routes fr
   where fr.code = v_code
   for update;
  if not found then
    raise exception 'Nieznana trasa %', v_code using errcode = 'P0002';
  end if;

  if v_prev is not distinct from p_active then
    return;
  end if;

  update public.ferry_routes
     set active = p_active
   where code = v_code;

  insert into public.audit_log (user_id, action, entity, entity_id, new_value)
  values (
    v_me,
    'FERRY_ROUTE_ACTIVE_SET',
    'ferry_routes',
    v_code,
    jsonb_build_object('active', p_active, 'previous', v_prev)
  );
end;
$$;

comment on function public.ferry_route_set_active(text, boolean) is
  'BN1/#648: włącza/wyłącza trasę (active=false → promote pomija); HHL_ADMIN + 2FA.';

revoke all on function public.ferry_route_set_active(text, boolean) from public, anon;
grant execute on function public.ferry_route_set_active(text, boolean) to authenticated;

commit;
