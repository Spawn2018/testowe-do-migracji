-- TOWER — Migracja 0207: P4 E44 / D-20261014-0640-01 H4 / D-20261014-1320-01 K2.1
-- Klucz RIO (`secret`) tylko po stronie serwera; w `telematics_vehicle_id` zostaje `rio:<uuid>`.
-- Wyzwalacz przy zapisie pełnego linku wycina secret. RPC `rio_tracking_open` — „Otwórz w RIO”.

alter table public.loads add column if not exists rio_tracking_id text;
alter table public.loads add column if not exists rio_secret text;
alter table public.loads add column if not exists rio_asset_name text;
alter table public.loads add column if not exists rio_tracker_on text;
alter table public.loads add column if not exists rio_valid_from timestamptz;
alter table public.loads add column if not exists rio_valid_to timestamptz;
alter table public.loads add column if not exists rio_check_state text;
alter table public.loads add column if not exists rio_check_at timestamptz;
alter table public.loads add column if not exists rio_last_fix_at timestamptz;

comment on column public.loads.rio_tracking_id is 'E44: identyfikator RIO (uuid); trackingRef w UI = rio:<uuid>';
comment on column public.loads.rio_secret is 'E44 pkt 8: klucz linku RIO — bez SELECT dla authenticated/anon';
comment on column public.loads.rio_asset_name is 'E44 pkt 6: rejestracja z lokalizatora (asset_name)';
comment on column public.loads.rio_tracker_on is 'E44 pkt 6: NACZEPA / CIAGNIK_PL / CIAGNIK_SE / NIEZNANY';
comment on column public.loads.rio_check_state is 'E44: wynik zapytania testowego — ok / pending / invalid / down';

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'loads_rio_tracker_on_chk') then
    alter table public.loads add constraint loads_rio_tracker_on_chk
      check (rio_tracker_on is null or rio_tracker_on in ('NACZEPA', 'CIAGNIK_PL', 'CIAGNIK_SE', 'NIEZNANY'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'loads_rio_check_state_chk') then
    alter table public.loads add constraint loads_rio_check_state_chk
      check (rio_check_state is null or rio_check_state in ('ok', 'pending', 'invalid', 'down'));
  end if;
end $$;

-- 0076: nowe kolumny loads → jawne grant select; secret bez SELECT
grant select (
  rio_tracking_id, rio_asset_name, rio_tracker_on,
  rio_valid_from, rio_valid_to, rio_check_state, rio_check_at, rio_last_fix_at
) on public.loads to authenticated;
revoke all (rio_secret) on public.loads from public, anon, authenticated;

create or replace function public.loads_rio_sanitize()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ref text;
  v_id text;
  v_secret text;
begin
  v_ref := nullif(btrim(coalesce(new.telematics_vehicle_id, '')), '');
  if v_ref is null then
    new.rio_tracking_id := null;
    new.rio_secret := null;
    new.rio_check_state := null;
    new.rio_check_at := null;
    return new;
  end if;

  if v_ref ~* '^rio:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    new.telematics_vehicle_id := lower(v_ref);
    new.rio_tracking_id := lower(substring(v_ref from 5));
    return new;
  end if;

  if v_ref ~* 'position-sharing\.rio\.cloud' or v_ref ~* '[?&]secret=' then
    v_id := (regexp_match(v_ref, '([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})', 'i'))[1];
    v_secret := (regexp_match(v_ref, '[?&]secret=([^&\s#]+)', 'i'))[1];
    if (v_id is not null) is not true then
      raise exception 'Link RIO bez identyfikatora' using errcode = '22023';
    end if;
    new.rio_tracking_id := lower(v_id);
    if v_secret is not null then
      new.rio_secret := v_secret;
    end if;
    new.telematics_vehicle_id := 'rio:' || lower(v_id);
    if new.rio_check_state is null then
      new.rio_check_state := 'pending';
      new.rio_check_at := now();
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_loads_rio_sanitize on public.loads;
create trigger trg_loads_rio_sanitize
  before insert or update of telematics_vehicle_id on public.loads
  for each row execute function public.loads_rio_sanitize();

revoke all on function public.loads_rio_sanitize() from public, anon, authenticated;

-- „Otwórz w RIO”: adres z kluczem tylko dla HHL / przewoźnika transportu (E44 pkt 8)
create or replace function public.rio_tracking_open(p_load_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role user_role;
  v_org uuid;
  v_carrier uuid;
  v_id text;
  v_secret text;
begin
  select u.role, u.org_id into v_role, v_org
    from app_users u where u.auth_id = auth.uid() and u.active;
  if (v_role is not null) is not true then
    raise exception 'Brak aktywnego konta' using errcode = '42501';
  end if;

  select l.carrier_org_id, l.rio_tracking_id, l.rio_secret
    into v_carrier, v_id, v_secret
    from loads l where l.id = p_load_id;
  if (v_id is not null) is not true then
    raise exception 'Brak linku RIO' using errcode = '22023';
  end if;
  if (v_secret is not null) is not true then
    raise exception 'Brak klucza RIO po stronie serwera' using errcode = '22023';
  end if;

  if v_role in ('HHL_ADMIN', 'HHL_OPS') then
    null;
  elsif v_role in ('CARRIER_DISPATCH', 'CARRIER_USER') and v_carrier is not distinct from v_org then
    null;
  else
    raise exception 'Brak uprawnień' using errcode = '42501';
  end if;

  -- B6 / E44: forma wklejana przez SCX — /?id=<UUID>&secret=<KLUCZ>, nie /share/…
  return format(
    'https://public.position-sharing.rio.cloud/?id=%s&secret=%s',
    v_id, v_secret
  );
end;
$$;

revoke all on function public.rio_tracking_open(uuid) from public, anon;
grant execute on function public.rio_tracking_open(uuid) to authenticated;

-- jednorazowo: pełne linki już w bazie → secret + rio:<uuid>
update public.loads l
   set telematics_vehicle_id = telematics_vehicle_id
 where telematics_vehicle_id is not null
   and (
     telematics_vehicle_id ~* 'position-sharing\.rio\.cloud'
     or telematics_vehicle_id ~* '[?&]secret='
   );
