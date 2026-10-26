-- B8 · Stare nieprzeczytane (7A, D-20261017-0730-01): IN_APP starsze niż 7 dni → przeczytane.
-- Kopia id w audit_log (AUDYT17_MARK_READ). Jednorazowo przy nałożeniu + funkcja do testów / ponowienia.

create or replace function public.b8_mark_stale_in_app_read()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_cutoff timestamptz := v_now - interval '7 days';
  v_before int;
  v_marked int;
  v_ids jsonb := '[]'::jsonb;
begin
  select count(*)::int into v_before
    from public.notifications n
   where n.channel = 'IN_APP'
     and n.read_at is null
     and n.created_at < v_cutoff;

  with marked as (
    update public.notifications n
       set read_at = coalesce(n.read_at, v_now)
     where n.channel = 'IN_APP'
       and n.read_at is null
       and n.created_at < v_cutoff
    returning n.id
  )
  select count(*)::int, coalesce(jsonb_agg(id order by id), '[]'::jsonb)
    into v_marked, v_ids
    from marked;

  insert into public.audit_log (user_id, action, entity, entity_id, new_value)
  values (
    null,
    'AUDYT17_MARK_READ',
    'notifications',
    'b8-0301',
    jsonb_build_object(
      'before', v_before,
      'count', v_marked,
      'notification_ids', v_ids,
      'cutoff', v_cutoff,
      'migration', '0301',
      'reason', 'B8 stare nieprzeczytane IN_APP >7 dni'
    )
  );

  return jsonb_build_object(
    'before', v_before,
    'count', v_marked,
    'cutoff', v_cutoff
  );
end;
$$;

revoke all on function public.b8_mark_stale_in_app_read() from public, anon, authenticated;
comment on function public.b8_mark_stale_in_app_read() is
  'B8 (7A): IN_APP nieprzeczytane starsze niż 7 dni → read_at + AUDYT17_MARK_READ.';

-- Jednorazowe sprzątanie przy nałożeniu migracji.
select public.b8_mark_stale_in_app_read();
