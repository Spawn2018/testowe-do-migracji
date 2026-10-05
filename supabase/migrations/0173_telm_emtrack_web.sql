-- 0173 — TELM-EMTRACK-WEB (D-36 zapas): źródło pozycji EMTRACK_WEB + flaga + parametry.
-- H1/H3/H6 bez zmian (false). Idempotentna.

alter type public.position_source add value if not exists 'EMTRACK_WEB';
alter type public.position_source add value if not exists 'SUBCONTRACTOR_LINK';

alter table public.security_flags drop constraint if exists security_flags_key_check;
alter table public.security_flags add constraint security_flags_key_check check (key in (
  'MFA_HHL_ADMIN', 'EXTERNAL_MESSAGING', 'PERMIT_REQUIRED_NON_STANDARD', 'FUEL_WOB_INGEST',
  'SMS_ZONE_APPROACH', 'SMS_ZONE_ENTER', 'DRIVER_LINK_ACCEPT', 'AUTOMATIC_DECISION_EMAIL',
  'H1_ROUTE_CHECK', 'H3_CORRIDOR_OBSTACLES', 'H6_MAP_OBSTACLES', 'FUEL_SE_PL_INGEST',
  'TELM_EMTRACK_WEB'
));

insert into security_flags (key, enabled, note) values
  ('TELM_EMTRACK_WEB', false, 'TELM-EMTRACK-WEB: odczyt pozycji naczepy przez protokół web emtrack (zapas D-36). Wyłączone do włączenia HHL po weryfikacji.')
on conflict (key) do update
  set note = excluded.note;

insert into app_parameters (key, value, label, source) values
  ('TELM_WEB_EXPECTED_VERSION', 6.32, 'Oczekiwana meta version emtrack.eu/app (pełny string w kodzie: 6.32.0)', 'TELM-EMTRACK-WEB 05.10.2026'),
  ('TELM_WEB_MOVE_SEC', 120, 'PR5: odstęp odpytywania emtrack-web gdy naczepa w ruchu (s)', 'TELM-EMTRACK-WEB 05.10.2026'),
  ('TELM_WEB_STOP_SEC', 900, 'PR5: odstęp odpytywania emtrack-web gdy postój (s)', 'TELM-EMTRACK-WEB 05.10.2026')
on conflict (key) do update
  set value = excluded.value,
      label = excluded.label,
      source = excluded.source,
      updated_at = now();

create or replace function public.telm_emtrack_web_enabled()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select enabled from security_flags where key = 'TELM_EMTRACK_WEB'), false)
$$;
revoke all on function public.telm_emtrack_web_enabled() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.telm_emtrack_web_enabled() to service_role;
  end if;
end $$;

comment on function public.telm_emtrack_web_enabled() is
  'TELM-EMTRACK-WEB / D-36: czy warstwa web emtrack może zapisywać pozycje (flaga HHL).';
