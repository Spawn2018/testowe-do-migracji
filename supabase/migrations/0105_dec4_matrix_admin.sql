-- 0105 — DEC-4: administrator ustawia macierz powiadomień (typ × firma × kanał).
--   admin_notification_matrix_set — tylko HHL_ADMIN; blokady ochronne (SYSTEM tylko HHL;
--   MONEY: CLIENT bez CARRIER-only naruszeń na poziomie grupy — szczegóły koszt/przychód w UI).
--   audit_log NOTIFICATION_MATRIX_SET. Idempotentna.

create or replace function public.admin_notification_matrix_set(
  p_event_group text, p_org_kind text, p_in_app boolean, p_email boolean
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid;
  v_role text;
begin
  select id, role::text into v_me, v_role from app_users where auth_id = auth.uid() and active;
  if (v_me is not null and v_role = 'HHL_ADMIN') is not true then
    raise exception 'Macierz powiadomień — wyłącznie administrator HHL' using errcode = '42501';
  end if;
  if (p_org_kind in ('FORWARDER','CARRIER','CLIENT')) is not true then
    raise exception 'Nieznany rodzaj firmy' using errcode = '22023';
  end if;
  if (p_event_group in ('LOAD_STATUS','RISK_FERRY_WEATHER','DECISION','MONEY','SYSTEM')) is not true then
    raise exception 'Nieznana grupa zdarzeń' using errcode = '22023';
  end if;
  -- blokady ochronne (§4)
  if p_event_group = 'SYSTEM' and p_org_kind <> 'FORWARDER' then
    raise exception 'Zdarzenia systemowe — tylko HHL' using errcode = '22023';
  end if;
  if p_event_group = 'MONEY' and p_org_kind = 'CARRIER' and p_email is true and p_in_app is not true then
    raise exception 'Koszt: przewoźnik musi mieć IN_APP, gdy e-mail' using errcode = '22023';
  end if;

  insert into notification_matrix (event_group, org_kind, in_app, email)
  values (p_event_group, p_org_kind, coalesce(p_in_app, false), coalesce(p_email, false))
  on conflict (event_group, org_kind) do update
    set in_app = excluded.in_app, email = excluded.email;

  insert into audit_log (user_id, action, entity, entity_id, new_value)
  values (v_me, 'NOTIFICATION_MATRIX_SET', 'notification_matrix', p_event_group || ':' || p_org_kind,
          jsonb_build_object('in_app', p_in_app, 'email', p_email));
end $$;
revoke all on function public.admin_notification_matrix_set(text, text, boolean, boolean) from public, anon;
grant execute on function public.admin_notification_matrix_set(text, text, boolean, boolean) to authenticated;
