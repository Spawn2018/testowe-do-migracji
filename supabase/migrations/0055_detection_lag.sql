-- 0055 — I-2l: czas wykrycia odchylenia z bazy (kafelek kokpitu 10.7 zamiast wpisanych „8 min”).
-- risk_signals.occurred_at = chwila, w której odchylenie zaistniało (zdarzenie); detected_at = chwila wykrycia.
-- Wypełniane wyzwalaczem przy wstawieniu (bez zmian w funkcjach wykrywania):
--   • jawnie: detail->>'occurred_at' (nowe źródła mogą je podać),
--   • SILENT_VEHICLE: ostatnia pozycja + próg ciszy (detail.last_fix + threshold_min) — wtedy cisza staje się odchyleniem,
--   • ryzyka stref (detail.geofence_id + detail.zdarzenie): czas zdarzenia strefy z load_events (czas GPS).
-- Bez znanego czasu zdarzenia → NULL (nie zgadujemy). Istniejących wierszy nie zmieniamy.
-- KPI: kpi_detection_lag — mediana (wykrycie − zdarzenie) ryzyk transportów z 30 dni; SECURITY INVOKER (RLS risk_signals:
-- każdy widzi medianę wyłącznie ze swoich ryzyk; konto nieaktywne — 0 próbek). Idempotentna, niedestrukcyjna.
alter table public.risk_signals add column if not exists occurred_at timestamptz;
comment on column public.risk_signals.occurred_at is
  'I-2l: kiedy odchylenie zaistniało (zdarzenie); detected_at − occurred_at = czas wykrycia. NULL = czas zdarzenia nieznany.';

create or replace function public.risk_signals_fill_occurred_at() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.occurred_at is null and coalesce(new.detail->>'occurred_at', '') <> '' then
    begin
      new.occurred_at := (new.detail->>'occurred_at')::timestamptz;
    exception when others then
      new.occurred_at := null;
    end;
  end if;
  if new.occurred_at is null and new.kind::text = 'SILENT_VEHICLE' and coalesce(new.detail->>'last_fix', '') <> '' then
    new.occurred_at := (new.detail->>'last_fix')::timestamptz
                       + make_interval(mins => coalesce(nullif(new.detail->>'threshold_min', '')::int, 90));
  end if;
  if new.occurred_at is null and new.load_id is not null
     and coalesce(new.detail->>'geofence_id', '') <> '' and coalesce(new.detail->>'zdarzenie', '') <> '' then
    select max(e.occurred_at) into new.occurred_at
      from load_events e
     where e.load_id = new.load_id
       and e.event_type = new.detail->>'zdarzenie'
       and e.payload->>'geofence_id' = new.detail->>'geofence_id'
       and e.occurred_at <= coalesce(new.detected_at, now());
  end if;
  return new;
end $$;
revoke all on function public.risk_signals_fill_occurred_at() from public, anon, authenticated;

drop trigger if exists risk_signals_occurred_at on public.risk_signals;
create trigger risk_signals_occurred_at before insert on public.risk_signals
  for each row execute function public.risk_signals_fill_occurred_at();

create or replace function public.kpi_detection_lag(p_project uuid default null, p_days int default 30)
returns table (samples int, median_min int)
language sql stable security invoker set search_path = public as $$
  select count(*)::int,
         round(extract(epoch from percentile_cont(0.5) within group (order by r.detected_at - r.occurred_at)) / 60)::int
    from risk_signals r
   where r.load_id is not null
     and r.occurred_at is not null
     and r.detected_at >= r.occurred_at
     and r.detected_at > now() - make_interval(days => least(greatest(coalesce(p_days, 30), 1), 366))
     and (p_project is null or r.project_id = p_project);
$$;
revoke all on function public.kpi_detection_lag(uuid, int) from public, anon;
grant execute on function public.kpi_detection_lag(uuid, int) to authenticated;
