-- =====================================================================
-- TOWER — Migracja 0123: II-7b fundament kalibracji uczącej się (szkielet)
--
--   Zastępuje III-1 (D-28). Pełna nauka wymaga zakończonych transportów z GPS
--   (TELM-2 / emtrack — blokada właściciela). Tu: tabele obserwacji i wersji
--   parametrów, zamrożenie HHL_ADMIN, bez automatycznej zmiany eta_segment_params.
-- =====================================================================

create table if not exists public.eta_segment_observations (
  id              bigserial primary key,
  load_id         uuid not null references loads(id),
  corridor        text not null check (corridor in ('PL_ROAD', 'SE_E4')),
  hours_observed  numeric(8,3) not null check (hours_observed >= 0),
  km_observed     numeric(8,2),
  tempo_h_per_100km numeric(8,4),
  features        jsonb not null default '{}'::jsonb,
  exclude_reason  text,
  observed_at     timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

create index if not exists eta_seg_obs_load on public.eta_segment_observations (load_id);
create index if not exists eta_seg_obs_corridor on public.eta_segment_observations (corridor, observed_at desc);

comment on table public.eta_segment_observations is
  'II-7b: czasy odcinków po rozładunku (GPS kasowany po 30 dniach — tu zostają). exclude_reason ≠ null → nie uczy tempa.';

create table if not exists public.eta_calibration_versions (
  id              bigserial primary key,
  created_at      timestamptz not null default now(),
  created_by      uuid references app_users(id),
  params_before   jsonb not null,
  params_after    jsonb not null,
  n_obs           int not null default 0,
  error_before_min numeric(10,2),
  error_after_min  numeric(10,2),
  applied         boolean not null default false,
  frozen          boolean not null default false,
  note            text
);

comment on table public.eta_calibration_versions is
  'II-7b: historia zmian parametrów ETA; HHL_ADMIN może zamrozić lub wrócić (apply_eta_calibration_version).';

alter table public.eta_segment_observations enable row level security;
alter table public.eta_calibration_versions enable row level security;
revoke all on public.eta_segment_observations from public, anon, authenticated;
revoke all on public.eta_calibration_versions from public, anon, authenticated;
grant select on public.eta_segment_observations to authenticated;
grant select on public.eta_calibration_versions to authenticated;
grant select, insert, update, delete on public.eta_segment_observations to service_role;
grant select, insert, update, delete on public.eta_calibration_versions to service_role;
grant usage, select on sequence public.eta_segment_observations_id_seq to service_role;
grant usage, select on sequence public.eta_calibration_versions_id_seq to service_role;

drop policy if exists eta_seg_obs_hhl on public.eta_segment_observations;
create policy eta_seg_obs_hhl on public.eta_segment_observations
  for select to authenticated using (is_hhl() is true);

drop policy if exists eta_cal_ver_hhl on public.eta_calibration_versions;
create policy eta_cal_ver_hhl on public.eta_calibration_versions
  for select to authenticated using (is_hhl() is true);

insert into public.app_parameters (key, value, label, source)
values (
  'ETA_CALIBRATION_FROZEN',
  0,
  'II-7b: 1 = zamrożenie kalibracji (HHL_ADMIN); silnik nie stosuje nowych wersji',
  'II-7b / ZLECENIE_POGODA_DROGI_ETA'
)
on conflict (key) do nothing;

-- zamrożenie / odmrożenie — tylko HHL_ADMIN
create or replace function public.admin_set_eta_calibration_frozen(p_frozen boolean)
returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if (current_app_role() = 'HHL_ADMIN') is not true then
    raise exception 'wyłącznie HHL_ADMIN';
  end if;
  insert into app_parameters (key, value, label, source)
  values ('ETA_CALIBRATION_FROZEN', case when p_frozen then 1 else 0 end,
          'II-7b: 1 = zamrożenie kalibracji', 'II-7b')
  on conflict (key) do update set value = excluded.value, updated_at = now();
  insert into audit_log (user_id, action, entity, entity_id, new_value)
  values (current_app_user_id(), 'ETA_CALIBRATION_FREEZE', 'app_parameters', 'ETA_CALIBRATION_FROZEN',
          jsonb_build_object('frozen', p_frozen));
  return p_frozen;
end $$;
revoke all on function public.admin_set_eta_calibration_frozen(boolean) from public, anon;
grant execute on function public.admin_set_eta_calibration_frozen(boolean) to authenticated;

-- powrót do wersji parametrów — tylko HHL_ADMIN; nie uruchamia się przy freeze
create or replace function public.apply_eta_calibration_version(p_version bigint)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v record;
  v_frozen numeric;
  k text; h numeric; sp numeric;
begin
  if (current_app_role() = 'HHL_ADMIN') is not true then
    raise exception 'wyłącznie HHL_ADMIN';
  end if;
  select value into v_frozen from app_parameters where key = 'ETA_CALIBRATION_FROZEN';
  if coalesce(v_frozen, 0) = 1 then
    raise exception 'kalibracja zamrożona — odmroź przed zastosowaniem wersji';
  end if;
  select * into v from eta_calibration_versions where id = p_version;
  if not found then raise exception 'brak wersji %', p_version; end if;
  for k, h, sp in
    select e.key, (e.value->>'hours')::numeric, (e.value->>'spread_pct')::numeric
      from jsonb_each(v.params_after) e
  loop
    update eta_segment_params set hours = h, spread_pct = coalesce(sp, spread_pct), updated_at = now(),
           updated_by = current_app_user_id(),
           source = 'II-7b kalibracja wersja ' || p_version
     where code = k and hours is distinct from h;
  end loop;
  update eta_calibration_versions set applied = true where id = p_version;
  insert into audit_log (user_id, action, entity, entity_id, new_value)
  values (current_app_user_id(), 'ETA_CALIBRATION_APPLY', 'eta_calibration_versions', p_version::text,
          jsonb_build_object('version', p_version));
  return true;
end $$;
revoke all on function public.apply_eta_calibration_version(bigint) from public, anon;
grant execute on function public.apply_eta_calibration_version(bigint) to authenticated;
