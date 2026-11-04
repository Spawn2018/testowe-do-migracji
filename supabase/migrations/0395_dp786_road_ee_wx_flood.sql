-- #786 / DP-786: zalew powiadomień ROAD_EE (pogoda ee-wx:stacja:czas).
-- Jednorazowo: IN_APP ROAD_EE od 2026-11-03 23:40Z dla ryzyk ee-wx → read_at + AUDYT17_MARK_READ.
-- Powiadomienia mają dedup_key risk:RISK_OPEN:<risk_id>:… — łączenie przez risk_signals.dedup_key.
-- Dedup per stacja (bez czasu) jest w Edge roadBaltic.parseEeWeatherData.

create or replace function public.dp786_mark_road_ee_wx_in_app_read()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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
     and exists (
       select 1
         from public.risk_signals r
        where r.id::text = n.payload->>'risk_id'
          and r.dedup_key like 'ROAD_EE:v2:ee-wx:%'
     );

  with marked as (
    update public.notifications n
       set read_at = coalesce(n.read_at, v_now)
     where n.channel = 'IN_APP'
       and n.read_at is null
       and n.created_at >= v_from
       and coalesce(n.payload->>'kind', '') = 'ROAD_EE'
       and exists (
         select 1
           from public.risk_signals r
          where r.id::text = n.payload->>'risk_id'
            and r.dedup_key like 'ROAD_EE:v2:ee-wx:%'
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

  return jsonb_build_object(
    'before', v_before,
    'count', v_marked,
    'from', v_from
  );
end;
$$;

revoke all on function public.dp786_mark_road_ee_wx_in_app_read() from public, anon, authenticated;
comment on function public.dp786_mark_road_ee_wx_in_app_read() is
  'DP-786 / #786: IN_APP ROAD_EE dla ryzyk ee-wx → read_at + AUDYT17_MARK_READ.';

select public.dp786_mark_road_ee_wx_in_app_read();
