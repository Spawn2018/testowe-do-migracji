-- DP-203 / decyzja 99 / F7 #780 r2: „obok trasy” bez powiadomień; RESOURCE_MISSING TV_CODE → HHL.
-- • trg_risk_matrix_notify: ROAD_* z detail.obok_trasy=true → bez macierzy;
--   UPDATE z HIGH/CRIT → notify_mark_case_closed (jak bałtyk bez load).
-- • risk_audience_for: RESOURCE_MISSING + rule=TV_CODE → HHL (słownik SE tylko HHL).


create or replace function public.risk_audience_for(p_kind text, p_detail jsonb)
returns risk_audience language plpgsql stable security definer set search_path = public as $$
declare v_dir text; v_inv text;
begin
  if auth.uid() is not null and current_app_user_id() is null then
    raise exception 'Brak aktywnego konta' using errcode = '42501';
  end if;
  -- #398: cisza naczepy emtrack → tylko HHL (bez przewoźnika)
  if p_kind = 'SILENT_VEHICLE' and coalesce(p_detail->>'emtrack_trailer', '') = '1' then
    return 'HHL';
  end if;
  if p_kind in (
    'FERRY', 'ROAD_SE', 'ROAD_PL', 'ROAD_LT', 'ROAD_LV', 'ROAD_EE', 'ROAD_FI',
    'WEATHER', 'ETA_BREACH'
  ) then
    return 'WSZYSCY';
  end if;
  if p_kind = 'RESOURCE_MISSING' and coalesce(p_detail->>'rule', '') = 'ORDER_NO'
     and coalesce(p_detail->>'side', '') = 'HHL' then
    return 'HHL';
  end if;
  -- DP-203 F7 #780 r2: luka słownika Trafikverket — tylko HHL (nie HHL_PRZEWOZNIK)
  if p_kind = 'RESOURCE_MISSING' and coalesce(p_detail->>'rule', '') = 'TV_CODE' then
    return 'HHL';
  end if;
  if p_kind in ('SILENT_VEHICLE', 'AUTO_STATUS', 'LOADING_UNCONFIRMED', 'RESOURCE_MISSING',
                'DOC_MISSING', 'PERMIT', 'INSURANCE', 'LATE_DATE_CHANGE', 'ROUTE_OBSTACLE') then
    return 'HHL_PRZEWOZNIK';
  end if;
  if p_kind in ('SEQUENCE', 'DATES_UNCONFIRMED') then
    return 'HHL_KLIENT';
  end if;
  if p_kind = 'INVOICE_MISMATCH' then
    v_dir := upper(coalesce(p_detail->>'direction', ''));
    v_inv := p_detail->>'invoice_id';
    if v_dir = '' and v_inv ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      select i.direction::text into v_dir from invoices i where i.id = v_inv::uuid;
    end if;
    return case coalesce(v_dir, '')
             when 'KOSZT' then 'HHL_PRZEWOZNIK'
             when 'PRZYCHOD' then 'HHL_KLIENT'
             else 'HHL' end;
  end if;
  return 'HHL';
end $$;

revoke all on function public.risk_audience_for(text, jsonb) from public, anon;
grant execute on function public.risk_audience_for(text, jsonb) to authenticated;
comment on function public.risk_audience_for(text, jsonb) is
  'BN6 + DP-203 F7 #780 r2: ROAD_* WSZYSCY; RESOURCE_MISSING TV_CODE → HHL.';


create or replace function public.trg_risk_matrix_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_group text;
  v_tpl text;
  v_proj uuid;
  v_n int;
  v_url text;
  v_code text;
  v_payload jsonb;
begin
  if new.load_id is null
     and new.kind::text in ('FERRY', 'WEATHER', 'ROAD_SE', 'ROAD_PL') then
    return null;
  end if;
  -- DP-156 F7: bałtyk bez transportu — tylko HIGH/CRITICAL do macierzy
  if new.load_id is null
     and new.kind::text in ('ROAD_LT', 'ROAD_LV', 'ROAD_EE', 'ROAD_FI')
     and new.severity::text not in ('HIGH', 'CRITICAL') then
    if tg_op = 'UPDATE'
       and old.severity::text in ('HIGH', 'CRITICAL') then
      perform public.notify_mark_case_closed('sprawa zamknięta', null, new.id);
    end if;
    return null;
  end if;
  -- DP-203 / decyzja 99 / F7 #780 r2: „obok trasy” — zero powiadomień (także z load_id)
  if new.kind::text in ('ROAD_LT', 'ROAD_LV', 'ROAD_EE', 'ROAD_FI', 'ROAD_SE')
     and coalesce(new.detail->>'obok_trasy', '') = 'true' then
    if tg_op = 'UPDATE'
       and old.severity::text in ('HIGH', 'CRITICAL') then
      perform public.notify_mark_case_closed('sprawa zamknięta', null, new.id);
    end if;
    return null;
  end if;
  if current_setting('tower.escalate_overdue', true) = '1'
     and coalesce(new.dedup_key, '') like 'decision-overdue:%' then
    return null;
  end if;

  v_group := case
    when new.kind::text in ('FERRY', 'WEATHER', 'ETA_BREACH') then 'RISK_FERRY_WEATHER'
    when new.kind::text in ('INVOICE_MISMATCH') then 'MONEY'
    when new.kind::text in ('USAGE_LIMIT', 'JOB_FAILURE') then 'SYSTEM'
    else 'SYSTEM'
  end;

  if tg_op = 'INSERT' then
    v_tpl := 'RISK_OPEN';
  elsif new.severity is distinct from old.severity then
    v_tpl := 'RISK_SEVERITY';
  elsif new.resolved_at is not null and old.resolved_at is null then
    v_n := public.notify_mark_case_closed('sprawa zamknięta', null, new.id);
    insert into public.audit_log (user_id, action, entity, entity_id, old_value, new_value)
    values (
      null, 'C1_RISK_RESOLVE_MARK_READ', 'risk_signals', new.id::text,
      jsonb_build_object('template', 'RISK_RESOLVED_skipped'),
      jsonb_build_object('marked', v_n, 'hotfix', '0256')
    );
    return null;
  else
    return null;
  end if;

  if v_tpl = 'RISK_SEVERITY'
     and new.severity::text = 'CRITICAL'
     and coalesce(new.detail->>'l3_level', '') = 'critical' then
    return null;
  end if;

  v_proj := new.project_id;
  if v_proj is null and new.load_id is not null then
    select project_id into v_proj from loads where id = new.load_id;
  end if;
  if new.load_id is not null then
    select coalesce(nullif(l.order_no, ''), nullif(l.hhl_order_no, ''))
      into v_code from loads l where l.id = new.load_id;
  end if;
  v_payload := jsonb_build_object(
    'risk_id', new.id, 'kind', new.kind, 'severity', new.severity,
    'title', new.title, 'title_key', new.title_key,
    'code', v_code, 'load_id', new.load_id
  );
  v_url := public.notify_click_url(v_tpl, v_payload, new.load_id);
  v_payload := v_payload || jsonb_build_object('url', v_url);
  perform public.matrix_notify(
    v_group, v_tpl, new.load_id, v_proj,
    v_payload,
    'risk:' || v_tpl || ':' || new.id::text || ':' || new.severity::text
  );
  return null;
end $$;

revoke all on function public.trg_risk_matrix_notify() from public, anon, authenticated;
comment on function public.trg_risk_matrix_notify() is
  'DP-156 + DP-203 F7 #780 r2: bałtyk bez load tylko HIGH/CRIT; obok_trasy bez powiadomień; HIGH→MEDIUM zamyka dzwonek.';
