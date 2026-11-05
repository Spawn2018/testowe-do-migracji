-- DP-217 / #804: gołoledź FI przy transporcie — audience HHL+SCX (bez KSH), jak E49 Z2.
-- Segmenty fi-wx:seg:* zostają MEDIUM bez load_id; zbiorcze HIGH ma detail.audience=HHL_PRZEWOZNIK.
-- Aktualizacja otwartej sprawy zbiorczej w miejscu (tytuł/szczegóły), waga tylko w górę — bez
-- ponownego RISK_OPEN przy kolejnym przebiegu road-fi.

begin;

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
  -- DP-205 E49-a Z2: wiatr na trasie — HHL + przewoźnik (SCX), bez klienta
  if p_kind = 'WEATHER' and coalesce(p_detail->>'audience', '') = 'HHL_PRZEWOZNIK' then
    return 'HHL_PRZEWOZNIK';
  end if;
  -- DP-217 / #804: zbiorcza gołoledź FI przy transporcie — HHL + SCX, bez KSH
  if p_kind = 'ROAD_FI' and coalesce(p_detail->>'audience', '') = 'HHL_PRZEWOZNIK' then
    return 'HHL_PRZEWOZNIK';
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
  'BN6 + DP-203 TV_CODE + DP-121 FERRY audience=HHL + DP-205 E49 WEATHER + DP-217 ROAD_FI slip audience=HHL_PRZEWOZNIK.';

-- Jak E49_WIND: otwarta sprawa fi-wx:load przy kolejnym przebiegu — update w miejscu, waga ↑.
create or replace function raise_integration_risk(
  p_project uuid, p_load uuid, p_kind risk_kind, p_sev risk_severity, p_title text, p_detail jsonb,
  p_dedup text, p_source_url text default null, p_valid_until timestamptz default null
) returns boolean language plpgsql security definer set search_path = public as $$
declare
  n int;
  v_id uuid;
  v_detail jsonb;
  v_title_key text;
  v_title text;
begin
  if p_dedup is null or length(p_dedup) = 0 then
    raise exception 'raise_integration_risk: wymagany klucz deduplikacji';
  end if;

  if exists (
    select 1 from risk_signals
     where dedup_key = p_dedup and resolved_at is null
  ) then
    if p_kind in ('ROAD_SE', 'ROAD_PL', 'ROAD_LT', 'ROAD_LV', 'ROAD_EE', 'ROAD_FI')
       and p_load is null then
      v_title_key := nullif(coalesce(p_detail, '{}'::jsonb)->>'title_key', '');
      v_detail := coalesce(p_detail, '{}'::jsonb) - 'title_key';
      if (v_detail ? 'params') is not true then
        v_detail := v_detail || '{"params":{}}'::jsonb;
      end if;
      v_title := public.tower_public_title(null, p_title, 'CODE');
      update risk_signals
         set severity = p_sev,
             title = v_title,
             title_key = coalesce(v_title_key, title_key),
             detail = v_detail,
             source_url = coalesce(p_source_url, source_url),
             valid_until = coalesce(p_valid_until, valid_until)
       where dedup_key = p_dedup and resolved_at is null
         and (severity, title, title_key, detail, coalesce(source_url, ''), valid_until)
             is distinct from
             (p_sev, v_title, coalesce(v_title_key, title_key), v_detail,
              coalesce(coalesce(p_source_url, source_url), ''),
              coalesce(p_valid_until, valid_until));
    elsif p_kind = 'WEATHER' and p_load is not null and p_dedup ~ '^E49_WIND:' then
      v_title_key := nullif(coalesce(p_detail, '{}'::jsonb)->>'title_key', '');
      v_detail := coalesce(p_detail, '{}'::jsonb) - 'title_key';
      if (v_detail ? 'params') is not true then
        v_detail := v_detail || '{"params":{}}'::jsonb;
      end if;
      v_title := public.tower_public_title(p_load, p_title, 'CODE');
      update risk_signals
         set severity = case when p_sev > severity then p_sev else severity end,
             title = v_title,
             title_key = coalesce(v_title_key, title_key),
             detail = v_detail,
             valid_until = coalesce(p_valid_until, valid_until)
       where dedup_key = p_dedup and resolved_at is null
         and (severity, title, title_key, detail, valid_until)
             is distinct from
             (case when p_sev > severity then p_sev else severity end,
              v_title, coalesce(v_title_key, title_key), v_detail,
              coalesce(p_valid_until, valid_until));
    elsif p_kind = 'ROAD_FI' and p_load is not null and p_dedup ~ ':fi-wx:load:' then
      -- DP-217: zbiorcza gołoledź — update tytułu (liczba odcinków), waga tylko w górę
      v_title_key := nullif(coalesce(p_detail, '{}'::jsonb)->>'title_key', '');
      v_detail := coalesce(p_detail, '{}'::jsonb) - 'title_key';
      if (v_detail ? 'params') is not true then
        v_detail := v_detail || '{"params":{}}'::jsonb;
      end if;
      v_title := public.tower_public_title(p_load, p_title, 'CODE');
      update risk_signals
         set severity = case when p_sev > severity then p_sev else severity end,
             title = v_title,
             title_key = coalesce(v_title_key, title_key),
             detail = v_detail,
             source_url = coalesce(p_source_url, source_url),
             valid_until = coalesce(p_valid_until, valid_until)
       where dedup_key = p_dedup and resolved_at is null
         and (severity, title, title_key, detail, coalesce(source_url, ''), valid_until)
             is distinct from
             (case when p_sev > severity then p_sev else severity end,
              v_title, coalesce(v_title_key, title_key), v_detail,
              coalesce(coalesce(p_source_url, source_url), ''),
              coalesce(p_valid_until, valid_until));
    end if;
    return false;
  end if;

  if p_dedup ~ '^SOURCE_DOWN:[A-Z0-9_]+$' then
    select id into v_id
      from risk_signals
     where dedup_key = p_dedup
       and resolved_at is not null
       and resolved_at > now() - interval '60 minutes'
     order by resolved_at desc
     limit 1;
    if v_id is not null then
      update risk_signals
         set resolved_at = null,
             severity = p_sev,
             title = p_title,
             detail = coalesce(p_detail, '{}'::jsonb),
             source_url = coalesce(p_source_url, source_url),
             valid_until = p_valid_until
       where id = v_id;
      return false;
    end if;
  end if;

  insert into risk_signals (project_id, load_id, kind, severity, title, detail, source_url, valid_until, dedup_key)
  values (coalesce((select project_id from loads where id = p_load), p_project), p_load, p_kind, p_sev, p_title,
          coalesce(p_detail, '{}'::jsonb), p_source_url, p_valid_until, p_dedup)
  on conflict (dedup_key) where dedup_key is not null and resolved_at is null do nothing;
  get diagnostics n = row_count;
  return n > 0;
end $$;

revoke execute on function raise_integration_risk(uuid, uuid, risk_kind, risk_severity, text, jsonb, text, text, timestamptz)
  from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function raise_integration_risk(uuid, uuid, risk_kind, risk_severity, text, jsonb, text, text, timestamptz)
      to service_role;
  end if;
end $$;

commit;
