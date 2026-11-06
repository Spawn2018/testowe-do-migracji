-- DP-31 / F7 #668 r8: otwarte SOURCE_DOWN — aktualizacja severity/title/detail
-- (HIGH → MEDIUM + nowy opis) zamiast zamrożenia wagi przy ponownym raise.
-- Bez nowego wiersza (return false); p_load null jak ryzyka źródła.

begin;

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
    elsif p_dedup ~ '^SOURCE_DOWN:' and p_load is null then
      -- DP-31: źródło — HIGH→MEDIUM + nowy opis przy otwartym dedup (bez RISK_OPEN)
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
