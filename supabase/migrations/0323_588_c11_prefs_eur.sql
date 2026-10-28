-- #588 / C11: wiersz user_preferences z EUR przy pierwszym koncie (i uzupełnienie braków).
-- Widok #291; Auth W1 — tu tylko baza: każdy app_users ma preferencje (domyślnie EUR).

create or replace function public.trg_app_user_prefs_eur()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_preferences (user_id, display_currency)
  values (new.id, 'EUR')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

revoke all on function public.trg_app_user_prefs_eur() from public, anon, authenticated;

drop trigger if exists app_user_prefs_eur on public.app_users;
create trigger app_user_prefs_eur
  after insert on public.app_users
  for each row execute function public.trg_app_user_prefs_eur();

do $c11$
declare
  v_n int;
begin
  insert into public.user_preferences (user_id, display_currency)
  select au.id, 'EUR'
    from public.app_users au
   where not exists (
     select 1 from public.user_preferences up where up.user_id = au.id
   )
  on conflict (user_id) do nothing;
  get diagnostics v_n = row_count;

  insert into public.audit_log (action, entity, entity_id, new_value)
  values (
    'AUDYT17_C11_PREFS',
    'user_preferences',
    'c11-0323',
    jsonb_build_object(
      'note', 'C11: EUR przy pierwszym koncie + uzupełnienie braków',
      'backfilled', v_n
    )
  );
end;
$c11$;
