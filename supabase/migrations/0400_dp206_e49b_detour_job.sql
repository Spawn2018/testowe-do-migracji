-- DP-206 E49-b cz.2 (#783 / D-20261104-0105-01 Z3): upsert spraw z joba, decyzja SCX,
-- Historia + macierz scx_detour (SCX_DETOUR_CHOICE). DETOUR_E49=true na froncie w tym PR.

begin;

-- Typ zdarzenia Historii: decyzja SCX objazd/postój.
alter table public.load_events drop constraint if exists load_events_event_type_known;
alter table public.load_events add constraint load_events_event_type_known check (event_type in (
    'NOTE', 'DOC_UPLOADED', 'PERMIT_MISMATCH', 'AWIZACJA_UPDATED', 'RESOURCES_UPDATED', 'ORDER_NO_UPDATED',
    'FERRY_UPDATED', 'SAILING_ASSIGNED', 'SCX_ASSIGNED', 'PLAN_B_ACTIVATED', 'READY_BLOCKED',
    'SCHEDULE_IMPORTED', 'SCHEDULE_DATE_CRITICAL', 'STATUS_APPROACHING_SITE', 'STATUS_AT_LOADING',
    'STATUS_AT_PORT', 'STATUS_AT_PORT_GDANSK', 'STATUS_AT_PORT_NYNASHAMN', 'STATUS_AT_SITE',
    'STATUS_CANCELLED', 'STATUS_DELAYED', 'STATUS_DELIVERED', 'STATUS_DOCS_PENDING', 'STATUS_DOC_MISSING',
    'STATUS_FERRY', 'STATUS_IN_TRANSIT_PL', 'STATUS_IN_TRANSIT_SE', 'STATUS_LOADING', 'STATUS_ON_FERRY',
    'STATUS_PLANNED', 'STATUS_READY', 'STATUS_RESOURCES_PENDING', 'STATUS_SILENT', 'STATUS_UNLOADED',
    'STATUS_UNLOADING', 'STATUS_READY_TO_INVOICE', 'STATUS_INVOICED',
    'MILESTONE_LOADED', 'MILESTONE_UNLOADED', 'DRIVER_ON_FERRY', 'DRIVER_PROBLEM',
    'GEOFENCE_ENTER', 'GEOFENCE_EXIT', 'GEOFENCE_DWELL', 'STATUS_AUTO', 'POSITION_SHARED',
    'POSITION_SHARE_DENIED', 'DELAY_DETECTED', 'RISK_RAISED', 'SILENT_VEHICLE',
    'PLAN_DATES_CONFIRMED', 'PLAN_DATES_CHANGED', 'DECISION_HOLD', 'PILOTS_SET',
    'DECISION_EFFECT', 'DECISION_SAILING', 'DECISION_KEEP_TOWER',
    'KSH_FILE_OUTBOUND',
    'LOAD_REMOVED', 'LOAD_RESTORED', 'DECISION_SNOOZED',
    'E49_DETOUR_DECISION'
));

-- Upsert sprawy z joba (service_role). Odświeża payload/termin przy tym samym dedup (otwarta).
create or replace function public.e49_detour_case_upsert(
  p_load uuid,
  p_dedup text,
  p_country text,
  p_place text,
  p_reason text,
  p_reason_detail text,
  p_source text,
  p_notice_at timestamptz,
  p_until_at timestamptz,
  p_decide_by timestamptz,
  p_payload jsonb,
  p_risk_dedup text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_load is null or nullif(btrim(p_dedup), '') is null then
    raise exception 'e49_detour_case_upsert: wymagane load i dedup';
  end if;

  select c.id into v_id
    from public.e49_detour_cases c
   where c.dedup_key = p_dedup
     and c.closed_at is null
   limit 1;

  if v_id is not null then
    update public.e49_detour_cases
       set place = p_place,
           reason = p_reason,
           reason_detail = p_reason_detail,
           notice_at = p_notice_at,
           until_at = p_until_at,
           decide_by = p_decide_by,
           payload = coalesce(p_payload, '{}'::jsonb),
           risk_dedup_key = coalesce(p_risk_dedup, risk_dedup_key),
           updated_at = now()
     where id = v_id
       and decision is null;
    return v_id;
  end if;

  insert into public.e49_detour_cases (
    load_id, dedup_key, country, place, reason, reason_detail, source,
    notice_at, until_at, decide_by, payload, risk_dedup_key
  ) values (
    p_load, p_dedup, p_country, p_place, p_reason, p_reason_detail, p_source,
    p_notice_at, p_until_at, p_decide_by, coalesce(p_payload, '{}'::jsonb), p_risk_dedup
  )
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.e49_detour_case_upsert(
  uuid, text, text, text, text, text, text, timestamptz, timestamptz, timestamptz, jsonb, text
) from public, anon, authenticated;
grant execute on function public.e49_detour_case_upsert(
  uuid, text, text, text, text, text, text, timestamptz, timestamptz, timestamptz, jsonb, text
) to service_role;

comment on function public.e49_detour_case_upsert(
  uuid, text, text, text, text, text, text, timestamptz, timestamptz, timestamptz, jsonb, text
) is
  'E49-b: upsert otwartej sprawy „Objazd czy postój?” (job route-hazards / roadClosed).';

-- Zamknij otwarte sprawy bez decyzji, których dedup nie ma na liście keep (zamknięcie odwołane).
create or replace function public.e49_detour_cases_close_stale(
  p_keep text[],
  p_reason text default 'closure_cleared'
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  update public.e49_detour_cases c
     set closed_at = now(),
         close_reason = coalesce(nullif(btrim(p_reason), ''), 'closure_cleared'),
         updated_at = now()
   where c.closed_at is null
     and c.decision is null
     and (
       p_keep is null
       or cardinality(p_keep) = 0
       or c.dedup_key <> all (p_keep)
     );
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.e49_detour_cases_close_stale(text[], text) from public, anon, authenticated;
grant execute on function public.e49_detour_cases_close_stale(text[], text) to service_role;

comment on function public.e49_detour_cases_close_stale(text[], text) is
  'E49-b: zamyka otwarte sprawy bez decyzji, gdy zamknięcie zniknęło z keep.';

-- Decyzja SCX (albo HHL przez „Działaj jako” — true actor w JWT).
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
  v_uid uuid := public.current_app_user_id();
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
  if v_uid is null then
    raise exception 'e49_detour_decide: brak sesji';
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
