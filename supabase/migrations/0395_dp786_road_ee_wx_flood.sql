-- #786 / DP-786: zalew powiadomień ROAD_EE (pogoda ee-wx:stacja:czas).
-- Jednorazowo: IN_APP ROAD_EE od 2026-11-03 23:40Z dla ee-wx → read_at + AUDYT17_MARK_READ.
-- Dedup per stacja (bez czasu) jest w Edge roadBaltic.parseEeWeatherData.

do $$
declare
  v_now timestamptz := clock_timestamp();
  v_from timestamptz := '2026-11-03 23:40:00+00'::timestamptz;
  v_before int;
  v_marked int;
  v_ids jsonb := '[]'::jsonb;
begin
  select count(*)::int into v_before
    from public.notifications n
   where n.channel = 'IN_APP'
     and n.read_at is null
     and n.created_at >= v_from
     and coalesce(n.payload->>'kind', '') = 'ROAD_EE'
     and (
       coalesce(n.dedup_key, '') like '%ee-wx:%'
       or n.payload::text like '%ee-wx:%'
     );

  with marked as (
    update public.notifications n
       set read_at = coalesce(n.read_at, v_now)
     where n.channel = 'IN_APP'
       and n.read_at is null
       and n.created_at >= v_from
       and coalesce(n.payload->>'kind', '') = 'ROAD_EE'
       and (
         coalesce(n.dedup_key, '') like '%ee-wx:%'
         or n.payload::text like '%ee-wx:%'
       )
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
    'dp786-0395',
    jsonb_build_object(
      'before', v_before,
      'count', v_marked,
      'notification_ids', v_ids,
      'from', v_from,
      'migration', '0395',
      'reason', '#786 ROAD_EE ee-wx zalew — oznacz IN_APP jako przeczytane'
    )
  );
end $$;
