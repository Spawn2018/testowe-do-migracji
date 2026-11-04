-- DP-206 E49-b: F7/CI #791 cz.2 — e49_detour_decide: assert_not_preview (B5) + Brak aktywnego konta (nullguard).

begin;

create or replace function public.e49_detour_decide(
  p_case uuid,
  p_pick text,
  p_note text default null
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_case public.e49_detour_cases%rowtype;
  v_load public.loads%rowtype;
  v_pick text := upper(btrim(coalesce(p_pick, '')));
  v_choice text;
  v_hist text;
  v_via text;
  v_code text;
  v_payload jsonb;
  v_detour jsonb;
begin
  perform public.assert_not_preview();
  v_uid := public.current_app_user_id();
  if (v_uid is not null) is not true then
    raise exception 'Brak aktywnego konta' using errcode = '42501';
  end if;
  if v_pick not in ('HOLD', 'DETOUR') then
    raise exception 'e49_detour_decide: pick HOLD|DETOUR';
  end if;

  select * into v_case from public.e49_detour_cases where id = p_case for update;
  if not found then
    raise exception 'e49_detour_decide: brak sprawy';
  end if;
  if v_case.closed_at is not null or v_case.decision is not null then
    raise exception 'e49_detour_decide: sprawa już rozstrzygnięta';
  end if;

  select * into v_load from public.loads where id = v_case.load_id;
  if not found then
    raise exception 'e49_detour_decide: brak transportu';
  end if;

  -- SCX przewoźnika albo HHL (Administrator / Operacje mogą zapisać „za SCX”).
  if (public.is_hhl()) is not true
     and not (current_org_kind() = 'CARRIER' and v_load.carrier_org_id = current_org_id()) then
    raise exception 'e49_detour_decide: brak uprawnień';
  end if;

  if v_pick = 'DETOUR' and coalesce(v_case.payload->'detour'->>'none', '') = 'true' then
    raise exception 'e49_detour_decide: brak objazdu dla zestawu — tylko postój';
  end if;

  v_detour := coalesce(v_case.payload->'detour', '{}'::jsonb);
  v_via := coalesce(v_detour->>'via', 'objazd');
  v_choice := case when v_pick = 'HOLD' then 'postój' else 'objazd' end;
  v_code := coalesce(nullif(btrim(v_load.order_no), ''), v_load.id::text);

  if v_pick = 'HOLD' then
    v_hist := format(
      'SCX: postój%s — %s zamknięty',
      case
        when v_case.payload->'hold'->>'untilIso' is not null
          then ' do ' || left(v_case.payload->'hold'->>'untilIso', 16)
        else ' do odwołania'
      end,
      v_case.place
    );
  else
    v_hist := format(
      'SCX: objazd %s, +%s km, +%s min — %s zamknięty',
      v_via,
      coalesce(v_detour->>'addKm', '0'),
      coalesce(v_detour->>'addMin', '0'),
      v_case.place
    );
  end if;
  if nullif(btrim(coalesce(p_note, '')), '') is not null then
    v_hist := v_hist || ' · uwagi: ' || btrim(p_note);
  end if;

  v_payload := jsonb_build_object(
    'pick', v_pick,
    'by', v_uid::text,
    'atIso', now(),
    'note', nullif(btrim(coalesce(p_note, '')), '')
  );

  update public.e49_detour_cases
     set decision = v_payload,
         decided_at = now(),
         decided_by = v_uid,
         closed_at = now(),
         close_reason = 'decided',
         updated_at = now()
   where id = p_case;

  insert into public.load_events (load_id, event_type, occurred_at, actor_id, payload, dedup_key)
  values (
    v_case.load_id,
    'E49_DETOUR_DECISION',
    now(),
    v_uid,
    jsonb_build_object(
      'case_id', p_case,
      'pick', v_pick,
      'place', v_case.place,
      'text', v_hist,
      'note', nullif(btrim(coalesce(p_note, '')), '')
    ),
    'e49-detour:' || p_case::text || ':' || v_pick
  )
  on conflict (dedup_key) where dedup_key is not null do nothing;

  -- Macierz E11: event_group DECISION → notify_event_key(SCX_DETOUR_CHOICE)=scx_detour.
  perform public.matrix_notify(
    'DECISION',
    'SCX_DETOUR_CHOICE',
    v_case.load_id,
    v_load.project_id,
    jsonb_build_object(
      'code', v_code,
      'choice', v_choice,
      'closure', v_case.place,
      'author', coalesce(
        (select nullif(btrim(u.full_name), '') from public.app_users u where u.id = v_uid),
        (select nullif(btrim(u.email::text), '') from public.app_users u where u.id = v_uid),
        v_uid::text
      ),
      'pick', v_pick,
      'case_id', p_case
    ),
    'e49-detour-n:' || p_case::text,
    'FORWARDER'
  );

  return true;
end;
$$;

revoke all on function public.e49_detour_decide(uuid, text, text) from public, anon;
grant execute on function public.e49_detour_decide(uuid, text, text) to authenticated, service_role;

comment on function public.e49_detour_decide(uuid, text, text) is
  'E49-b: decyzja SCX HOLD|DETOUR — Historia + macierz scx_detour; KSH bez dostępu.';

commit;
