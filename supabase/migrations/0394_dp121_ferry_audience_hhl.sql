-- DP-121 / F7 #782 r2: FERRY z detail.audience=HHL → tylko HHL (nie WSZYSCY).
-- Sygnały decyzji 100 / 61 / 61c: port-call v2 cancelled, cancel-suspect, ERR RSS.


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
  -- DP-121 F7 #782 r2: sygnał HHL (cancelled / cancel-suspect / ERR) — nie dla KSH/SCX
  if p_kind = 'FERRY' and coalesce(p_detail->>'audience', '') = 'HHL' then
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
  'BN6 + DP-203 TV_CODE + DP-121 F7 #782 r2: FERRY detail.audience=HHL → HHL.';
