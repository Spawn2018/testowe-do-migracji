-- =====================================================================
-- TOWER — Migracja 0020: ANEKS 3 §2.2 (widoczność ryzyk, zamknięte drzwi) + §2.4 (48 h)
--
--   risk_signals.audience: HHL · HHL_PRZEWOZNIK · HHL_KLIENT · WSZYSCY, domyślnie HHL.
--   Odbiorców wylicza baza (wyzwalacz) z rodzaju i szczegółów — nie klient API:
--     FERRY, ROAD_SE, ROAD_PL, WEATHER, ETA_BREACH                    → WSZYSCY
--     SILENT_VEHICLE, AUTO_STATUS, LOADING_UNCONFIRMED, RESOURCE_MISSING,
--     DOC_MISSING, PERMIT, INSURANCE                                   → HHL_PRZEWOZNIK
--     SEQUENCE                                                         → HHL_KLIENT
--     INVOICE_MISMATCH: faktura kosztowa → HHL_PRZEWOZNIK, przychodowa → HHL_KLIENT,
--                       kierunek nieznany → HHL
--     §2.4: brak numeru zlecenia HHL (RESOURCE_MISSING, detail.side = HHL) → HHL
--     każdy inny (także przyszły) rodzaj                               → HHL
--   RLS risks_read: przewoźnik — ryzyka swoich transportów, ryzyka korytarza bez
--   transportu (WSZYSCY) i ryzyka bez transportu przypisane jego firmie
--   (detail.carrier_org_id); klient — ryzyka swojego projektu; plac — WSZYSCY.
--   Idempotentna, niedestrukcyjna (kolumna z domyślną wartością + uzupełnienie).
-- =====================================================================

do $$ begin
  if not exists (select 1 from pg_type where typname = 'risk_audience') then
    create type risk_audience as enum ('HHL', 'HHL_PRZEWOZNIK', 'HHL_KLIENT', 'WSZYSCY');
  end if;
end $$;

alter table risk_signals add column if not exists audience risk_audience not null default 'HHL';

create or replace function risk_audience_for(p_kind text, p_detail jsonb)
returns risk_audience language plpgsql stable security definer set search_path = public as $$
declare v_dir text; v_inv text;
begin
  if p_kind in ('FERRY', 'ROAD_SE', 'ROAD_PL', 'WEATHER', 'ETA_BREACH') then
    return 'WSZYSCY';
  end if;
  if p_kind = 'RESOURCE_MISSING' and coalesce(p_detail->>'rule', '') = 'ORDER_NO'
     and coalesce(p_detail->>'side', '') = 'HHL' then
    return 'HHL';                       -- §2.4: numer HHL — sprawa wyłącznie HHL
  end if;
  if p_kind in ('SILENT_VEHICLE', 'AUTO_STATUS', 'LOADING_UNCONFIRMED', 'RESOURCE_MISSING',
                'DOC_MISSING', 'PERMIT', 'INSURANCE') then
    return 'HHL_PRZEWOZNIK';
  end if;
  if p_kind = 'SEQUENCE' then
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
  return 'HHL';                         -- zamknięte drzwi: rodzaj nieprzypisany widzi tylko HHL
end $$;

create or replace function set_risk_audience() returns trigger
language plpgsql as $$
begin
  new.audience := risk_audience_for(new.kind::text, new.detail);
  return new;
end $$;

drop trigger if exists risk_signals_audience on risk_signals;
create trigger risk_signals_audience before insert or update of kind, detail, audience on risk_signals
  for each row execute function set_risk_audience();

-- uzupełnienie istniejących wierszy (wyzwalacz przelicza przy update audience)
update risk_signals set audience = audience
 where audience is distinct from risk_audience_for(kind::text, detail);

drop policy if exists risks_read on risk_signals;
create policy risks_read on risk_signals for select to authenticated using (
  is_hhl()
  or (current_org_kind() = 'CARRIER'
      and audience in ('WSZYSCY', 'HHL_PRZEWOZNIK')
      and (
        (risk_signals.load_id is not null
         and exists (select 1 from loads l where l.id = risk_signals.load_id
                      and l.carrier_org_id = current_org_id()))
        or (risk_signals.load_id is null
            and (audience = 'WSZYSCY' or risk_signals.detail->>'carrier_org_id' = current_org_id()::text))
      ))
  or (current_org_kind() = 'CLIENT'
      and audience in ('WSZYSCY', 'HHL_KLIENT')
      and exists (select 1 from projects p where p.id = risk_signals.project_id
                   and p.client_org_id = current_org_id()))
  or (current_org_kind() = 'SITE' and audience = 'WSZYSCY')
);

revoke execute on function risk_audience_for(text, jsonb) from public, anon;
