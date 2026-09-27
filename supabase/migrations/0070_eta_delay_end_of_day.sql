-- =====================================================================
-- TOWER — Migracja 0070: opóźnienie ETA od KOŃCA dnia dostawy w Europe/Stockholm (SCOPE §57, właściciel 28.09)
--   Było (0051): delay_minutes = ETA − plan_delivery_to (koniec okna), a gdy okna brak — koniec dnia plan_delivery_date.
--   Jest: zawsze ETA − północ po dniu dostawy w Europe/Stockholm; dzień dostawy = plan_delivery_date,
--   a gdy go brak — data plan_delivery_to w Europe/Stockholm. Przeliczenie transportów w toku. Idempotentna.
-- =====================================================================
create or replace function load_delivery_day_end(p_date date, p_to timestamptz) returns timestamptz
language sql immutable set search_path = public as $$
  select ((coalesce(p_date, (p_to at time zone 'Europe/Stockholm')::date) + 1)::timestamp at time zone 'Europe/Stockholm')
$$;
revoke all on function load_delivery_day_end(date, timestamptz) from public, anon, authenticated;

create or replace function refresh_load_eta(p_load uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r record; v_end timestamptz; v_delay int;
begin
  select * into r from compute_load_eta(p_load);
  select load_delivery_day_end(l.plan_delivery_date, l.plan_delivery_to) into v_end from loads l where l.id = p_load;
  v_delay := case when r.eta is null or v_end is null then null
                  else greatest(0, round(extract(epoch from (r.eta - v_end)) / 60))::int end;
  perform set_config('tower.eta_ctx', 'on', true);
  update loads l set eta_site = r.eta, eta_confidence_min = r.conf_min, eta_basis = r.basis, eta_computed_at = now(),
         delay_minutes = v_delay
   where l.id = p_load
     and (l.eta_site is distinct from r.eta or l.eta_confidence_min is distinct from r.conf_min
          or (l.eta_basis - 'computed_at') is distinct from (r.basis - 'computed_at')
          or l.delay_minutes is distinct from v_delay);
  perform set_config('tower.eta_ctx', '', true);
end $$;
revoke all on function refresh_load_eta(uuid) from public, anon, authenticated;

do $$
declare r record;
begin
  for r in select id from loads where status not in ('CANCELLED', 'UNLOADED', 'DELIVERED') loop
    perform refresh_load_eta(r.id);
  end loop;
end $$;
