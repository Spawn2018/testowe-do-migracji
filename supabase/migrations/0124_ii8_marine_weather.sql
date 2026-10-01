-- =====================================================================
-- TOWER — Migracja 0124: II-8 pogoda morska FMI+DMI+SMHI
--
--   Edge `ferry-weather` zapisuje bieżący stan Bałtyku (okno odejścia ±6 h).
--   Progi WAVE_M / GUST_KN (D-39: 3,8 m / 40 kn — potwierdzone).
--   Źródło w UI: atrybucja CC BY 4.0 (FMI / DMI / SMHI).
--   IMGW pominięte — licencja komercyjna wymaga umowy (RAPORT_POGODA_MORSKA).
-- =====================================================================

create table if not exists public.marine_conditions (
  corridor       text primary key check (corridor in ('BALTIC_GDN_NYN')),
  max_wave_m     numeric(5,2),
  max_gust_kn    numeric(6,1),
  risk           text not null default 'niskie'
                   check (risk in ('niskie', 'podwyższone', 'wysokie')),
  wave_thr_m     numeric(5,2) not null default 3.8,
  gust_thr_kn    numeric(6,1) not null default 40,
  sources        text not null default '',
  attribution    text not null default 'Dane: FMI / DMI / SMHI (CC BY 4.0)',
  window_from    timestamptz,
  window_to      timestamptz,
  detail         jsonb not null default '{}'::jsonb,
  observed_at    timestamptz not null default now()
);

comment on table public.marine_conditions is
  'II-8: bieżąca pogoda morska Bałtyk (FMI+DMI+SMHI) — max fala/porywy w oknie rejsów; czyta UI Ryzyka';

alter table public.marine_conditions enable row level security;
revoke all on public.marine_conditions from public, anon, authenticated;
grant select on public.marine_conditions to authenticated;
grant select, insert, update, delete on public.marine_conditions to service_role;

drop policy if exists marine_conditions_read on public.marine_conditions;
create policy marine_conditions_read on public.marine_conditions
  for select to authenticated
  using (current_app_user_id() is not null);

insert into public.marine_conditions (
  corridor, max_wave_m, max_gust_kn, risk, sources, attribution, detail
) values (
  'BALTIC_GDN_NYN', null, null, 'niskie', '',
  'Dane: FMI / DMI / SMHI (CC BY 4.0)',
  jsonb_build_object('status', 'start — brak odczytu')
)
on conflict (corridor) do nothing;

-- D-39: progi potwierdzone (wartości już 3.8 / 40 z 0107 — aktualizujemy etykiety)
update public.ops_thresholds
   set label_pl = 'Fala znacząca (D-39 potwierdzone)',
       updated_at = now()
 where key = 'WAVE_M' and label_pl not like '%D-39%';

update public.ops_thresholds
   set label_pl = 'Porywy wiatru (D-39 potwierdzone)',
       updated_at = now()
 where key = 'GUST_KN' and label_pl not like '%D-39%';

insert into public.app_parameters (key, value, label, source)
values (
  'MARINE_WEATHER_ENABLED',
  1,
  'II-8: odczyt pogody morskiej FMI+DMI+SMHI (1=włączony)',
  'II-8 / ZLECENIE_POGODA_DROGI_ETA'
)
on conflict (key) do nothing;
