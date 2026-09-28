-- =====================================================================
-- TOWER — Migracja 0080: I-25 (P0) cofnięcie reguły opóźnienia z 0070 (błąd w komunikacie koordynatora, 28.09)
--   0070 liczyła delay_minutes zawsze od końca DNIA dostawy i ignorowała plan_delivery_to (okno dostawy).
--   Poprawna reguła (SCOPE §57): opóźnienie liczone od końca okna dostawy, a gdy okna nie ma — od końca dnia
--   dostawy (północ po dniu plan_delivery_date, Europe/Stockholm).
--   Przykład: okno 01.10 08:00–12:00, ETA 18:00 → 360 min (0070 dawała 0).
--   Okno pochodzi wyłącznie od KSH (potwierdzenie dat, 0061) — import harmonogramu go nie ustawia.
--   load_delivery_day_end (0070) zostaje bez zmian (koniec dnia), ale refresh_load_eta używa load_delivery_deadline.
--   Przeliczenie transportów w toku. Idempotentna.
-- =====================================================================
create or replace function load_delivery_deadline(p_date date, p_to timestamptz) returns timestamptz
language sql immutable set search_path = public as $$
  select coalesce(p_to, ((p_date + 1)::timestamp at time zone 'Europe/Stockholm'))
$$;
revoke all on function load_delivery_deadline(date, timestamptz) from public, anon, authenticated;

create or replace function refresh_load_eta(p_load uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r record; v_end timestamptz; v_delay int;
begin
  select * into r from compute_load_eta(p_load);
  select load_delivery_deadline(l.plan_delivery_date, l.plan_delivery_to) into v_end from loads l where l.id = p_load;
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
