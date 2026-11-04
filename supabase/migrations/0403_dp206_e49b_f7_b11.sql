-- DP-206 E49-b F7 #791 B11 (właściciel 04.11 12:37–12:38):
-- decyzja tylko SCX przewoźnika lub HHL_ADMIN; Historia z autorem;
-- powiadomienie HHL + SCX + KSH (KSH bez uwag); macierz scx_detour.
-- B6: upsert nie nadpisuje dobrego objazdu „tylko postój” po błędzie HERE.

begin;

-- Macierz: SCX + KSH dostają dzwonek o decyzji (B11).
insert into public.notification_matrix (
  event_key, event_group, role, in_app, email, push,
  fixed_in_app, fixed_email, fixed_push, risks_only, label_pl
) values
  ('scx_detour', 'DECISION', 'CARRIER_DISPATCH', true, false, true, false, false, false, false,
   'Decyzja: objazd albo postój'),
  ('scx_detour', 'DECISION', 'CARRIER_USER', true, false, false, false, false, false, false,
   'Decyzja: objazd albo postój')
on conflict (event_key, role) do update
  set in_app = excluded.in_app,
      push = excluded.push,
      label_pl = excluded.label_pl;

update public.notification_matrix
   set in_app = true,
       push = false,
       label_pl = 'Decyzja: objazd albo postój (bez uwag SCX)'
 where event_key = 'scx_detour'
   and role = 'CLIENT_USER';

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
  v_old jsonb;
  v_new jsonb := coalesce(p_payload, '{}'::jsonb);
  v_merged jsonb;
  v_prev_risk text;
  v_risk_open boolean := false;
begin
  if p_load is null or nullif(btrim(p_dedup), '') is null then
    raise exception 'e49_detour_case_upsert: wymagane load i dedup';
  end if;

  -- B2: dedup z decyzją — nie otwieraj ponownie, dopóki ryzyko źródła nadal otwarte
  -- (albo brak risk_dedup). Po resolved_at ryzyka blokada znika → nowa sprawa OK.
  select c.id, c.risk_dedup_key into v_id, v_prev_risk
    from public.e49_detour_cases c
   where c.dedup_key = p_dedup
     and c.decision is not null
   order by c.decided_at desc nulls last
   limit 1;
  if v_id is not null then
    if coalesce(nullif(btrim(p_risk_dedup), ''), nullif(btrim(v_prev_risk), '')) is null then
      return v_id;
    end if;
    select exists (
      select 1 from public.risk_signals r
       where r.dedup_key = coalesce(nullif(btrim(p_risk_dedup), ''), v_prev_risk)
         and r.resolved_at is null
    ) into v_risk_open;
    if v_risk_open is true then
      return v_id;
    end if;
    -- ryzyko zamknięte → wolno nową sprawę (ten sam dedup_key, nowy wiersz)
    v_id := null;
  end if;

  select c.id, c.payload into v_id, v_old
    from public.e49_detour_cases c
   where c.dedup_key = p_dedup
     and c.closed_at is null
   limit 1;

  if v_id is not null then
    -- B6: błąd HERE / limit nie nadpisuje dobrego objazdu „tylko postój”.
    v_merged := v_new;
    if (v_new->'detour'->>'none') = 'true'
       and v_old is not null
       and (v_old->'detour'->>'none') is distinct from 'true'
       and v_old->'detour' ? 'addKm' then
      v_merged := jsonb_set(
        v_new,
        '{detour}',
        (v_old->'detour') || jsonb_build_object('stale_at', now())
      );
    end if;
    -- Bez trasy bazowej (addKm z całej trasy) — nie licz objazdu w tym przebiegu.
    if v_new->'detour'->>'none' is distinct from 'true'
       and coalesce((v_new->>'baseMissing')::boolean, false) is true
       and v_old is not null
       and (v_old->'detour'->>'none') is distinct from 'true' then
      v_merged := jsonb_set(
        v_new - 'baseMissing',
        '{detour}',
        (v_old->'detour') || jsonb_build_object('stale_at', now())
      );
    end if;

    update public.e49_detour_cases
       set place = p_place,
           reason = p_reason,
           reason_detail = p_reason_detail,
           notice_at = p_notice_at,
           until_at = p_until_at,
           decide_by = p_decide_by,
           payload = coalesce(v_merged, '{}'::jsonb),
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
    p_notice_at, p_until_at, p_decide_by, coalesce(p_payload, '{}'::jsonb) - 'baseMissing', p_risk_dedup
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
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_who text;
  v_is_admin boolean;
  v_is_carrier boolean;
  v_payload_hhl jsonb;
  v_payload_ksh jsonb;
begin
  perform public.assert_not_preview();
  v_uid := public.current_app_user_id();
  if (v_uid is not null) is not true then
    raise exception 'Brak aktywnego konta' using errcode = '42501';
  end if;
  if v_pick not in ('HOLD', 'DETOUR') then
    raise exception 'e49_detour_decide: pick HOLD|DETOUR';
  end if;
  if v_note is not null and char_length(v_note) > 500 then
    raise exception 'e49_detour_decide: uwagi za długie (max 500)';
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

  -- B11: wyłącznie SCX przewoźnika transportu albo HHL_ADMIN (nie HHL_OPS / is_hhl).
  v_is_admin := (public.is_hhl_admin()) is true;
  v_is_carrier := (
    public.current_org_kind() = 'CARRIER'
    and v_load.carrier_org_id = public.current_org_id()
  );
  if (v_is_admin or v_is_carrier) is not true then
    raise exception 'e49_detour_decide: brak uprawnień';
  end if;

  if v_pick = 'DETOUR' and coalesce(v_case.payload->'detour'->>'none', '') = 'true' then
    raise exception 'e49_detour_decide: brak objazdu dla zestawu — tylko postój';
  end if;

  v_detour := coalesce(v_case.payload->'detour', '{}'::jsonb);
  v_via := coalesce(v_detour->>'via', 'objazd');
  v_choice := case when v_pick = 'HOLD' then 'postój' else 'objazd' end;
  v_code := coalesce(nullif(btrim(v_load.order_no), ''), v_load.id::text);
  v_who := case when v_is_admin then 'Administrator HHL' else 'SCX' end;

  if v_pick = 'HOLD' then
    v_hist := format(
      '%s: postój%s — %s zamknięty',
      v_who,
      case
        when v_case.payload->'hold'->>'untilIso' is not null
          then ' do ' || left(v_case.payload->'hold'->>'untilIso', 16)
        else ' do odwołania'
      end,
      v_case.place
    );
  else
    v_hist := format(
      '%s: objazd %s, +%s km, +%s min — %s zamknięty',
      v_who,
      v_via,
      coalesce(v_detour->>'addKm', '0'),
      coalesce(v_detour->>'addMin', '0'),
      v_case.place
    );
  end if;
  if v_note is not null then
    v_hist := v_hist || ' · uwagi: ' || v_note;
  end if;

  v_payload := jsonb_build_object(
    'pick', v_pick,
    'by', v_uid::text,
    'byRole', case when v_is_admin then 'HHL_ADMIN' else 'CARRIER' end,
    'atIso', now(),
    'note', v_note
  );

  update public.e49_detour_cases
     set decision = v_payload,
         decided_at = now(),
         decided_by = v_uid,
         closed_at = now(),
         close_reason = 'decided',
         updated_at = now()
   where id = p_case;

  -- B1: KSH nie czyta decyzji w Historii (uwagi tylko HHL+SCX).
  insert into public.load_events (load_id, event_type, occurred_at, actor_id, payload, visible_to, dedup_key)
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
      'note', v_note,
      'byRole', case when v_is_admin then 'HHL_ADMIN' else 'CARRIER' end
    ),
    array['FORWARDER', 'CARRIER']::org_kind[],
    'e49-detour:' || p_case::text || ':' || v_pick
  )
  on conflict (dedup_key) where dedup_key is not null do nothing;

  v_payload_hhl := jsonb_build_object(
    'code', v_code,
    'choice', v_choice,
    'closure', v_case.place,
    'author', coalesce(
      (select nullif(btrim(u.full_name), '') from public.app_users u where u.id = v_uid),
      (select nullif(btrim(u.email::text), '') from public.app_users u where u.id = v_uid),
      v_uid::text
    ),
    'pick', v_pick,
    'case_id', p_case,
    'note', v_note,
    'via', v_via,
    'addKm', v_detour->>'addKm',
    'addMin', v_detour->>'addMin',
    'holdUntil', v_case.payload->'hold'->>'untilIso',
    'etaIso', coalesce(
      v_case.payload->'detour'->>'etaIso',
      v_case.payload->'hold'->>'etaIso'
    )
  );
  -- KSH: bez uwag (B11 12:38).
  v_payload_ksh := v_payload_hhl - 'note';

  -- HHL + SCX (z notatką gdy jest).
  perform public.matrix_notify(
    'DECISION',
    'SCX_DETOUR_CHOICE',
    v_case.load_id,
    v_load.project_id,
    v_payload_hhl,
    'e49-detour-n:' || p_case::text,
    'FORWARDER'
  );
  perform public.matrix_notify(
    'DECISION',
    'SCX_DETOUR_CHOICE',
    v_case.load_id,
    v_load.project_id,
    v_payload_hhl,
    'e49-detour-n:' || p_case::text,
    'CARRIER'
  );
  -- KSH bez note.
  perform public.matrix_notify(
    'DECISION',
    'SCX_DETOUR_CHOICE',
    v_case.load_id,
    v_load.project_id,
    v_payload_ksh,
    'e49-detour-n:' || p_case::text,
    'CLIENT'
  );

  return true;
end;
$$;

revoke all on function public.e49_detour_decide(uuid, text, text) from public, anon;
grant execute on function public.e49_detour_decide(uuid, text, text) to authenticated, service_role;

comment on function public.e49_detour_decide(uuid, text, text) is
  'E49-b B11: decyzja SCX przewoźnika lub HHL_ADMIN; Historia HHL+SCX; dzwonek HHL+SCX+KSH (KSH bez uwag).';

commit;
