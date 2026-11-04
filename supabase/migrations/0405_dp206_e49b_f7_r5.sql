-- DP-206 E49-b F7 #791 r5: B6b — przy baseMissing zachowaj stary objazd
-- z kotwicą / hereCalculatedAt / notices; bez stale_at=now() co przebieg.

begin;

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
  v_base_missing boolean := coalesce((v_new->>'baseMissing')::boolean, false);
begin
  if p_load is null or nullif(btrim(p_dedup), '') is null then
    raise exception 'e49_detour_case_upsert: wymagane load i dedup';
  end if;

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
    v_id := null;
  end if;

  select c.id, c.payload into v_id, v_old
    from public.e49_detour_cases c
   where c.dedup_key = p_dedup
     and c.closed_at is null
   limit 1;

  if v_id is not null then
    v_merged := v_new - 'baseMissing';
    -- F7 r5 B6b: zachowaj stary objazd + kotwicę / notices tylko przy baseMissing;
    -- bez nadpisywania stale_at na now() (czas liczenia = hereCalculatedAt z payload).
    if v_base_missing is true
       and v_old is not null
       and (v_old->'detour'->>'none') is distinct from 'true'
       and v_old->'detour' ? 'addKm' then
      v_merged := jsonb_set(v_merged, '{detour}', v_old->'detour');
      if v_old ? 'positionAtCalc' then
        v_merged := jsonb_set(v_merged, '{positionAtCalc}', v_old->'positionAtCalc');
      end if;
      if v_old ? 'hereCalculatedAt' then
        v_merged := jsonb_set(v_merged, '{hereCalculatedAt}', v_old->'hereCalculatedAt');
      end if;
      if v_old ? 'hereNotices' then
        v_merged := jsonb_set(v_merged, '{hereNotices}', v_old->'hereNotices');
      end if;
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

comment on function public.e49_detour_case_upsert(
  uuid, text, text, text, text, text, text, timestamptz, timestamptz, timestamptz, jsonb, text
) is
  'E49-b F7 r5 B6b: baseMissing zachowuje detour+kotwicę+notices; without stale_at=now().';

commit;
