-- DP-220: ostrzeżenie ETA_BREACH odświeża tytuł i params (minuty) przy kolejnym
-- l3_upsert_alarm, także gdy severity / l3_level bez zmian.
-- Wcześniej (0243) update tylko przy zmianie CRITICAL↔HIGH → stare minuty w UI.

create or replace function public.l3_upsert_alarm(
  p_project uuid,
  p_load uuid,
  p_kind risk_kind,
  p_key text,
  p_title text,
  p_title_key text,
  p_active boolean,
  p_critical boolean,
  p_due timestamptz,
  p_detail jsonb,
  p_now timestamptz
) returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_sev text;
  v_old text;
  v_detail jsonb;
  v_level text;
  v_key text;
  v_code text;
  v_kept text;
  v_in text;
  v_bad boolean;
  v_cur_title text;
  v_cur_level text;
  v_cur_params jsonb;
begin
  if p_active is not true then
    update risk_signals
       set resolved_at = p_now
     where dedup_key = p_key and resolved_at is null and detail->>'l3' = '1';
    if found then
      perform l3_lapse(p_key, p_now);
    end if;
    return 0;
  end if;
  v_level := case when p_critical then 'critical' else 'warning' end;
  v_sev := case when p_critical then 'CRITICAL' else 'HIGH' end;
  v_detail := coalesce(p_detail, '{}'::jsonb) || jsonb_build_object(
    'l3', '1',
    'l3_level', v_level,
    'l3_due', p_due,
    'title_key', p_title_key
  );
  v_key := p_key;
  select id, severity::text, detail#>>'{params,code}', title, detail->>'l3_level',
         coalesce(detail->'params', '{}'::jsonb)
    into v_id, v_old, v_kept, v_cur_title, v_cur_level, v_cur_params
    from risk_signals
   where dedup_key = v_key and resolved_at is null;
  v_code := case when p_load is null then null else public.load_sms_code(p_load) end;
  v_in := v_detail #>> '{params,code}';
  v_bad := p_load is not null and v_in is not null and (
    lower(v_in) = lower(left(p_load::text, 8))
    or exists (
      select 1 from loads l
       where l.id = p_load and nullif(btrim(l.order_no), '') is not null and l.order_no = v_in
    )
  );
  if v_kept is not null
     and (p_load is null or lower(v_kept) is distinct from lower(left(p_load::text, 8)))
     and not exists (
       select 1 from loads l
        where l.id = p_load and nullif(btrim(l.order_no), '') is not null and l.order_no = v_kept
     )
     and (v_bad is true or v_code is null or v_code = '—')
     and v_detail ? 'params' then
    v_detail := jsonb_set(v_detail, '{params,code}', to_jsonb(v_kept), true);
  elsif v_code is not null and v_code is distinct from '—' and v_detail ? 'params'
        and (v_bad is true or v_in is not null) then
    v_detail := jsonb_set(v_detail, '{params,code}', to_jsonb(v_code), true);
  end if;
  if v_id is null then
    insert into risk_signals (project_id, load_id, kind, severity, title, title_key, detail, dedup_key, detected_at)
    values (
      p_project, p_load, p_kind, v_sev::risk_severity, p_title,
      case p_title_key
        when 'rk_res_driver' then 'rk_res_driver'
        when 'rk_res_docs' then 'rk_res_docs'
        when 'rk_silent_vehicle' then 'rk_silent_vehicle'
        when 'rk_eta_breach' then 'rk_eta_breach'
        when 'rk_off_corridor' then 'rk_off_corridor'
        when 'rk_no_sailing' then 'rk_no_sailing'
        when 'rk_no_tracking' then 'rk_no_tracking'
        when 'rk_no_awiz_se' then 'rk_no_awiz_se'
        else null
      end,
      v_detail, v_key, p_now
    )
    on conflict (dedup_key) where dedup_key is not null and resolved_at is null do nothing;
    update decisions
       set due_at = coalesce(p_due, due_at),
           detail = detail || jsonb_build_object('l3', true, 'level', v_level)
     where detail->>'event_key' = p_key
       and status in ('NEW', 'ASSIGNED', 'SNOOZED');
    return 1;
  end if;
  -- DP-220: także gdy title / params (minuty) się zmieniają przy tej samej severity.
  if v_old is distinct from v_sev
     or v_cur_level is distinct from v_level
     or v_cur_title is distinct from p_title
     or v_cur_params is distinct from coalesce(v_detail->'params', '{}'::jsonb)
  then
    update risk_signals
       set severity = v_sev::risk_severity,
           detail = detail || v_detail,
           title = p_title
     where id = v_id;
    update decisions
       set due_at = coalesce(p_due, due_at),
           detail = detail || jsonb_build_object('l3', true, 'level', v_level)
     where detail->>'event_key' = p_key
       and status in ('NEW', 'ASSIGNED', 'SNOOZED');
    if p_critical and v_old is distinct from 'CRITICAL' then
      perform l3_critical_notify(p_key, p_now);
      return 1;
    end if;
  end if;
  return 0;
end $$;

revoke all on function public.l3_upsert_alarm(uuid, uuid, risk_kind, text, text, text, boolean, boolean, timestamptz, jsonb, timestamptz) from public, anon, authenticated;
