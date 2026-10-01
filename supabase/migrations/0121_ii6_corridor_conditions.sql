-- =====================================================================
-- TOWER — Migracja 0121: II-6 Trafikverket — współczynnik spowolnienia SE
--
--   Edge `road-se` zapisuje bieżący stan korytarza E4 (RoadCondition +
--   WeatherMeasurepoint). Silnik ETA II-7 mnoży odcinek SE przez
--   slowdown_mult (1.00 norma; 1.15 przy śniegu/śliskości — parametr
--   app_parameters.SE_ROAD_SLOWDOWN_PCT, domyślnie 15).
--   ObjectType Situation usunięty z Open API Trafikverket (01.10.2026) —
--   utrudnienia/roboty wrócą, gdy dostawca udostępni zamiennik (DATEX?).
-- =====================================================================

create table if not exists public.corridor_conditions (
  corridor       text primary key check (corridor in ('SE_E4')),
  slowdown_mult  numeric(4,2) not null default 1.00
                   check (slowdown_mult >= 1.00 and slowdown_mult <= 3.00),
  reason         text,
  detail         jsonb not null default '{}'::jsonb,
  observed_at    timestamptz not null default now(),
  source         text not null default 'TRAFIKVERKET'
);

comment on table public.corridor_conditions is
  'II-6: bieżący współczynnik spowolnienia odcinka SE (E4) z Trafikverket — czyta II-7';

alter table public.corridor_conditions enable row level security;
revoke all on public.corridor_conditions from public, anon, authenticated;
grant select on public.corridor_conditions to authenticated;
grant select, insert, update, delete on public.corridor_conditions to service_role;

drop policy if exists corridor_conditions_read on public.corridor_conditions;
create policy corridor_conditions_read on public.corridor_conditions
  for select to authenticated
  using (current_app_user_id() is not null);

insert into public.corridor_conditions (corridor, slowdown_mult, reason, source)
values ('SE_E4', 1.00, 'start — normalne warunki', 'TRAFIKVERKET')
on conflict (corridor) do nothing;

insert into public.app_parameters (key, value, label, source)
values (
  'SE_ROAD_SLOWDOWN_PCT',
  15,
  'Spowolnienie odcinka SE przy śniegu/śliskości (%) — II-6 → II-7',
  'II-6 / ZLECENIE_POGODA_DROGI_ETA'
)
on conflict (key) do nothing;
