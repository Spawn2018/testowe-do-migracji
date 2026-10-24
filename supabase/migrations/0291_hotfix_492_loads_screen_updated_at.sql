-- #492 — loads.updated_at tylko przy kolumnach widocznych na ekranie
-- (status, zasoby, daty, numery, rejs/awizacja, symbol/zezwolenie, konfiguracja RIO).
-- Bez bumpa przy refresh_load_eta / process_position (tracking_opened_at) /
-- stanie RIO (rio_check_*, rio_error_streak) — inaczej max(updated_at)
-- wymuszałby pełny zrzut kart co kilka minut.
-- Bez bumpa przy tower.audit_source='rodo' — purge_personal_data filtruje
-- anulowane po updated_at (F7 #529).

do $$
declare
  missing text;
begin
  select string_agg(c, ', ' order by c) into missing
  from unnest(array[
    'status', 'carrier_org_id', 'order_no', 'hhl_order_no', 'carrier_order_no',
    'plan_load_date', 'plan_load_from', 'plan_load_to',
    'plan_delivery_date', 'plan_delivery_from', 'plan_delivery_to',
    'plan_dates_status', 'plan_dates_confirmed_by', 'plan_dates_confirmed_at',
    'actual_load_at', 'actual_delivery_at',
    'tractor_plate', 'trailer_plate', 'trailer_type',
    'driver_name', 'driver_phone', 'driver_phone_country', 'driver_locale',
    'driver_delivery_name', 'driver_delivery_phone', 'driver_delivery_phone_country',
    'tractor_delivery_plate', 'trailer_swap', 'trailer_swap_at',
    'escort_vehicles', 'telematics_vehicle_id', 'telematics_provider',
    'sailing_id', 'ferry_booking_ref',
    'combo_length_m', 'combo_width_m', 'combo_height_m',
    'combo_axle_count', 'combo_axle_load_t',
    'delay_code', 'delay_owner', 'delay_note',
    'symbol', 'permit_kind',
    'rio_tracking_id', 'rio_secret', 'rio_asset_name', 'rio_tracker_on',
    'rio_valid_from', 'rio_valid_to',
    'updated_at'
  ]) as c
  where not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'loads' and column_name = c
  );
  if missing is not null then
    raise exception '0291: brak kolumn public.loads: %', missing;
  end if;
end $$;

create or replace function public.trg_loads_screen_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  /* RODO: purge czyści kierowcę i dalej filtruje po updated_at — bez podbicia. */
  if nullif(btrim(current_setting('tower.audit_source', true)), '') = 'rodo' then
    return new;
  end if;

  if (
       new.status is distinct from old.status
    or new.carrier_org_id is distinct from old.carrier_org_id
    or new.order_no is distinct from old.order_no
    or new.hhl_order_no is distinct from old.hhl_order_no
    or new.carrier_order_no is distinct from old.carrier_order_no
    or new.plan_load_date is distinct from old.plan_load_date
    or new.plan_load_from is distinct from old.plan_load_from
    or new.plan_load_to is distinct from old.plan_load_to
    or new.plan_delivery_date is distinct from old.plan_delivery_date
    or new.plan_delivery_from is distinct from old.plan_delivery_from
    or new.plan_delivery_to is distinct from old.plan_delivery_to
    or new.plan_dates_status is distinct from old.plan_dates_status
    or new.plan_dates_confirmed_by is distinct from old.plan_dates_confirmed_by
    or new.plan_dates_confirmed_at is distinct from old.plan_dates_confirmed_at
    or new.actual_load_at is distinct from old.actual_load_at
    or new.actual_delivery_at is distinct from old.actual_delivery_at
    or new.tractor_plate is distinct from old.tractor_plate
    or new.trailer_plate is distinct from old.trailer_plate
    or new.trailer_type is distinct from old.trailer_type
    or new.driver_name is distinct from old.driver_name
    or new.driver_phone is distinct from old.driver_phone
    or new.driver_phone_country is distinct from old.driver_phone_country
    or new.driver_locale is distinct from old.driver_locale
    or new.driver_delivery_name is distinct from old.driver_delivery_name
    or new.driver_delivery_phone is distinct from old.driver_delivery_phone
    or new.driver_delivery_phone_country is distinct from old.driver_delivery_phone_country
    or new.tractor_delivery_plate is distinct from old.tractor_delivery_plate
    or new.trailer_swap is distinct from old.trailer_swap
    or new.trailer_swap_at is distinct from old.trailer_swap_at
    or new.escort_vehicles is distinct from old.escort_vehicles
    or new.telematics_vehicle_id is distinct from old.telematics_vehicle_id
    or new.telematics_provider is distinct from old.telematics_provider
    or new.sailing_id is distinct from old.sailing_id
    or new.ferry_booking_ref is distinct from old.ferry_booking_ref
    or new.combo_length_m is distinct from old.combo_length_m
    or new.combo_width_m is distinct from old.combo_width_m
    or new.combo_height_m is distinct from old.combo_height_m
    or new.combo_axle_count is distinct from old.combo_axle_count
    or new.combo_axle_load_t is distinct from old.combo_axle_load_t
    or new.delay_code is distinct from old.delay_code
    or new.delay_owner is distinct from old.delay_owner
    or new.delay_note is distinct from old.delay_note
    or new.symbol is distinct from old.symbol
    or new.permit_kind is distinct from old.permit_kind
    or new.rio_tracking_id is distinct from old.rio_tracking_id
    or new.rio_secret is distinct from old.rio_secret
    or new.rio_asset_name is distinct from old.rio_asset_name
    or new.rio_tracker_on is distinct from old.rio_tracker_on
    or new.rio_valid_from is distinct from old.rio_valid_from
    or new.rio_valid_to is distinct from old.rio_valid_to
  ) then
    new.updated_at := now();
  end if;
  return new;
end;
$$;

comment on function public.trg_loads_screen_updated_at() is
  '#492: BEFORE UPDATE — updated_at tylko przy kolumnach ekranu; ETA/RIO-stan/tracking_opened_at/RODO bez bumpa.';

drop trigger if exists trg_loads_screen_updated_at on public.loads;
create trigger trg_loads_screen_updated_at
  before update on public.loads
  for each row
  execute function public.trg_loads_screen_updated_at();

revoke all on function public.trg_loads_screen_updated_at() from public, anon, authenticated;
