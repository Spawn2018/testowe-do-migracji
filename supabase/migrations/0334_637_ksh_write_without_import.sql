-- #637: zapis WT→plik KSH bez importu (właściciel 29.10 11:29 — „włącz zapis”).
-- import_enabled zostaje false; write_enabled niezależne.
-- write_set(true) bez wymogu importu; import_set(false) nie gasi zapisu ani kolejki.

begin;

create or replace function public.ksh_sync_write_set(p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid;
  v_role public.user_role;
  v_pid uuid;
begin
  perform public.assert_not_preview();
  select id, role into v_me, v_role
    from public.app_users
   where auth_id = auth.uid() and active;
  if (v_me is not null and v_role = 'HHL_ADMIN' and public.mfa_satisfied(v_role) is true) is not true then
    raise exception 'Tylko Administrator HHL z 2FA' using errcode = '42501';
  end if;
  select id into v_pid from public.projects
   where code in ('STEGRA_BODEN', 'STEGRA')
   order by case code when 'STEGRA_BODEN' then 0 else 1 end
   limit 1;
  if v_pid is null then
    raise exception 'Brak projektu KSH (STEGRA_BODEN)' using errcode = 'P0002';
  end if;
  -- #637: bez wymogu import_enabled (wcześniej 0308 F7 r2).
  insert into public.ksh_sync_state (project_id, write_enabled)
  values (v_pid, coalesce(p_enabled, false))
  on conflict (project_id) do update
    set write_enabled = excluded.write_enabled, updated_at = now();
  perform 1
    from public.loads l
   where l.id in (
     select o.load_id from public.ksh_sync_outbound o
      where o.project_id = v_pid and o.status = 'pending'
   )
   order by l.id
     for update;
  if p_enabled is true then
    update public.ksh_sync_outbound
       set status = 'skipped',
           done_at = now(),
           last_error = 'write_enabled_on',
           rev = rev + 1
     where project_id = v_pid and status = 'pending';
  else
    update public.ksh_sync_outbound
       set status = 'skipped',
           done_at = now(),
           last_error = 'write_disabled',
           rev = rev + 1
     where project_id = v_pid and status = 'pending';
  end if;
  insert into public.audit_log (user_id, action, entity, entity_id, new_value)
  values (
    v_me, 'KSH_SYNC_WRITE_SET', 'ksh_sync_state', v_pid::text,
    jsonb_build_object('write_enabled', coalesce(p_enabled, false))
  );
end;
$$;

revoke all on function public.ksh_sync_write_set(boolean) from public, anon;
grant execute on function public.ksh_sync_write_set(boolean) to authenticated;

comment on function public.ksh_sync_write_set(boolean) is
  'A6/#637: przełącznik zapisu WT→plik; bez wymogu import_enabled; przy true/false zaległe pending→skipped; HHL_ADMIN+2FA.';

create or replace function public.ksh_sync_import_set(p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid;
  v_role public.user_role;
  v_pid uuid;
begin
  perform public.assert_not_preview();
  select id, role into v_me, v_role
    from public.app_users
   where auth_id = auth.uid() and active;
  if (v_me is not null and v_role = 'HHL_ADMIN' and public.mfa_satisfied(v_role) is true) is not true then
    raise exception 'Tylko Administrator HHL z 2FA' using errcode = '42501';
  end if;
  select id into v_pid from public.projects
   where code in ('STEGRA_BODEN', 'STEGRA')
   order by case code when 'STEGRA_BODEN' then 0 else 1 end
   limit 1;
  if v_pid is null then
    raise exception 'Brak projektu KSH (STEGRA_BODEN)' using errcode = 'P0002';
  end if;
  if coalesce(p_enabled, false) is not true then
    -- #637: nie gasimy write_enabled ani kolejki outbound (zapis niezależny od importu).
    insert into public.ksh_sync_state (project_id, import_enabled)
    values (v_pid, false)
    on conflict (project_id) do update
      set import_enabled = false,
          updated_at = now();
  else
    insert into public.ksh_sync_state (project_id, import_enabled)
    values (v_pid, true)
    on conflict (project_id) do update
      set import_enabled = true, updated_at = now();
  end if;
  insert into public.audit_log (user_id, action, entity, entity_id, new_value)
  values (
    v_me, 'KSH_SYNC_IMPORT_SET', 'ksh_sync_state', v_pid::text,
    jsonb_build_object(
      'import_enabled', coalesce(p_enabled, false),
      'write_enabled_cleared', false
    )
  );
end;
$$;

revoke all on function public.ksh_sync_import_set(boolean) from public, anon;
grant execute on function public.ksh_sync_import_set(boolean) to authenticated;

comment on function public.ksh_sync_import_set(boolean) is
  'A6/#637: przełącznik importu z pliku; wyłączenie nie gasi write_enabled ani kolejki; HHL_ADMIN+2FA.';

commit;
