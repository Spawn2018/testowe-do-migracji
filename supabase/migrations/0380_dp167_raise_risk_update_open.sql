-- DP-167: raise_integration_risk przy otwartym dedup aktualizuje wagę/etykietę/detail
-- (zmiana wag FI/EE po wdrożeniu trafia do otwartych). Bez nowego RISK_OPEN (return false).
-- F7 #734 r1: (a) tylko ROAD_* bez load_id; UPDATE wyłącznie gdy pola się zmieniają;
-- valid_until = coalesce(p_valid_until, valid_until) — job bez końca nie kasuje istniejącej daty.

create or replace function raise_integration_risk(
  p_project uuid, p_load uuid, p_kind risk_kind, p_sev risk_severity, p_title text, p_detail jsonb,
  p_dedup text, p_source_url text default null, p_valid_until timestamptz default null
) returns boolean language plpgsql security definer set search_path = public as $$
declare
  n int;
  v_id uuid;
  v_detail jsonb;
begin
  if p_dedup is null or length(p_dedup) = 0 then
    raise exception 'raise_integration_risk: wymagany klucz deduplikacji';
  end if;

  -- Otwarte z tym samym dedup: bez nowego wiersza.
  -- DP-167 / F7 #734 r1 (a): odśwież severity/title/detail tylko dla ROAD_* bez transportu
  -- (bez zalewu RISK_SEVERITY z FERRY/WEATHER/ETA przy load_id).
  if exists (
    select 1 from risk_signals
     where dedup_key = p_dedup and resolved_at is null
  ) then
    if p_kind in ('ROAD_SE', 'ROAD_PL', 'ROAD_LT', 'ROAD_LV', 'ROAD_EE', 'ROAD_FI')
       and p_load is null then
      v_detail := coalesce(p_detail, '{}'::jsonb);
      update risk_signals
         set severity = p_sev,
             title = p_title,
             detail = v_detail,
             source_url = coalesce(p_source_url, source_url),
             valid_until = coalesce(p_valid_until, valid_until)
       where dedup_key = p_dedup and resolved_at is null
         and (severity, title, detail, coalesce(source_url, ''), valid_until)
             is distinct from
             (p_sev, p_title, v_detail,
              coalesce(coalesce(p_source_url, source_url), ''),
              coalesce(p_valid_until, valid_until));
    end if;
    return false;
  end if;

  -- Klucze bez daty (np. SOURCE_DOWN:EMTRACK_WEB): miganie open/close nie tworzy nowego wiersza.
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
