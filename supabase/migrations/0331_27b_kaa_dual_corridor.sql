-- 27B:C (#608): Karlskrona→Boden — OFF_CORRIDOR do najbliższego z dwóch korytarzy
-- (SE_E22 = E4 przez Sztokholm; SE_KAA_INLAND = Norrköping→Västerås→Sala→Gävle→Boden).
-- Bez śladu GPS / kodów przesyłek / danych osobowych w repo (miasta publiczne).
-- ETA / mapa / mapowanie kalibracji SE_ROAD_KAA_INLAND — kolejne kroki tej pozycji.
-- F7 r1: begin/commit; total_km z geom; punkty ≤~30 km; TRACK tylko gdy faktycznie śródlądowy.

begin;

alter table public.corridor_polylines drop constraint if exists corridor_polylines_code_check;
alter table public.corridor_polylines
  add constraint corridor_polylines_code_check
  check (code in (
    'PL_ROAD', 'SE_E4', 'SE_E22', 'SE_APPROACH_SG03', 'SE_KAA_TRACK', 'SE_KAA_INLAND'
  ));

-- Korytarz śródlądowy: wspólny pień E22 do Norrköping, potem miasta publiczne (nie GPS).
-- Wierzchołki co ≤ ~30 km (F7: bez cięciw 115/90 km przy progu OFF 2 km).
-- total_km z geom w INSERT (CHECK total_km > 0 — nie wolno wstawiać 0).
with g as (
  select st_setsrid(st_makeline(array[
    st_makepoint(15.5866, 56.1616),  -- Karlskrona
    st_makepoint(15.656,  56.198),
    st_makepoint(15.84,   56.19),
    st_makepoint(15.99,   56.30),
    st_makepoint(16.06,   56.47),
    st_makepoint(16.17,   56.63),
    st_makepoint(16.366,  56.663),
    st_makepoint(16.32,   56.87),
    st_makepoint(16.45,   57.26),
    st_makepoint(16.637,  57.758),
    st_makepoint(16.40,   57.89),
    st_makepoint(16.32,   58.48),
    st_makepoint(16.183,  58.594),  -- Norrköping (rozwidlenie)
    st_makepoint(16.195,  58.795),  -- Norrköping→Katrineholm (~45 km — punkt pośredni)
    st_makepoint(16.207,  58.996),  -- Katrineholm
    st_makepoint(16.337,  59.133),  -- Malmköping (droga 55; Flen leży ~17 km na wschód od prostej)
    st_makepoint(16.507,  59.371),  -- Eskilstuna
    st_makepoint(16.5448, 59.6099), -- Västerås
    st_makepoint(16.6066, 59.9079), -- Sala
    st_makepoint(16.929,  60.151),  -- Tärnsjö
    st_makepoint(17.00,   60.45),   -- Hedesunda/Gysinge (kierunek Gävle; nie Ockelbo)
    st_makepoint(17.1413, 60.6749), -- Gävle (łączenie z E4)
    st_makepoint(17.1056, 61.7274),
    st_makepoint(17.3069, 62.3908),
    st_makepoint(17.9379, 62.6323),
    st_makepoint(18.7153, 63.2909),
    st_makepoint(20.2630, 63.8258),
    st_makepoint(20.9528, 64.7507),
    st_makepoint(21.4794, 65.3172),
    st_makepoint(22.1547, 65.5848),
    st_makepoint(21.7591, 65.8054)  -- Boden
  ]), 4326) as geom
)
insert into public.corridor_polylines (code, geom, total_km, attribution, source, updated_at)
select
  'SE_KAA_INLAND',
  geom,
  round((st_length(geom::geography) / 1000.0)::numeric, 2),
  '© OpenStreetMap contributors',
  'OSM / ODbL — Karlskrona → E22 → Norrköping → Västerås → Sala → Gävle → Boden (27B:C)',
  now()
from g
on conflict (code) do update
  set geom = excluded.geom,
      total_km = excluded.total_km,
      attribution = excluded.attribution,
      source = excluded.source,
      updated_at = now();

-- ---------------------------------------------------------------------------
-- Helper: odchyłka do najbliższego z dwóch korytarzy Stena (E4 / śródlądowy).
-- Preferuj SE_KAA_TRACK tylko gdy ślad faktycznie idzie śródlądziem (blisko Västerås);
-- inaczej SE_KAA_INLAND — żeby przebudowa TRACK z wybrzeżem nie ukryła wariantu inland.
-- ---------------------------------------------------------------------------
create or replace function public.stena_se_inland_corridor_code()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when exists (
      select 1 from corridor_polylines t
       where t.code = 'SE_KAA_TRACK'
         and coalesce(t.total_km, 0) > 0
         and t.geom is not null
         -- Västerås: TRACK musi przechodzić w pobliżu (≠ kopia SE_E22 wybrzeżem)
         and st_distance(
               t.geom::geography,
               st_setsrid(st_makepoint(16.5448, 59.6099), 4326)::geography
             ) < 8000
    ) then 'SE_KAA_TRACK'
    else 'SE_KAA_INLAND'
  end;
$$;

revoke all on function public.stena_se_inland_corridor_code() from public, anon, authenticated;
grant execute on function public.stena_se_inland_corridor_code() to service_role;

comment on function public.stena_se_inland_corridor_code() is
  '27B:C: kod korytarza śródlądowego — SE_KAA_TRACK gdy dostępny i blisko Västerås, inaczej SE_KAA_INLAND.';

create or replace function public.stena_se_corridor_nearest(p_geom geometry)
returns table (off_m numeric, corridor_code text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_inland text := public.stena_se_inland_corridor_code();
  v_e4 numeric;
  v_in numeric;
begin
  if p_geom is null then
    return;
  end if;
  select cp.off_m into v_e4 from corridor_progress('SE_E22', p_geom) cp;
  select cp.off_m into v_in from corridor_progress(v_inland, p_geom) cp;
  if v_e4 is null and v_in is null then
    return;
  elsif v_e4 is null then
    off_m := v_in;
    corridor_code := v_inland;
  elsif v_in is null then
    off_m := v_e4;
    corridor_code := 'SE_E22';
  elsif v_in < v_e4 then
    off_m := v_in;
    corridor_code := v_inland;
  else
    off_m := v_e4;
    corridor_code := 'SE_E22';
  end if;
  return next;
end;
$$;

revoke all on function public.stena_se_corridor_nearest(geometry) from public, anon, authenticated;
grant execute on function public.stena_se_corridor_nearest(geometry) to service_role;

comment on function public.stena_se_corridor_nearest(geometry) is
  '27B:C: OFF_CORRIDOR Stena — odchyłka i kod najbliższego z SE_E22 / śródlądowy.';

-- Przed rozwidleniem (płd. od Norrköping ≈ 58.594): SE_E22; potem najbliższy.
-- Próg lat < 58.55 = ~5 km na płd. od Norrköping (wspólny pień E22).
create or replace function public.stena_se_eta_corridor(p_geom geometry)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_lat double precision;
  n record;
begin
  if p_geom is null then
    return 'SE_E22';
  end if;
  v_lat := st_y(st_setsrid(p_geom, 4326));
  if v_lat is null or v_lat < 58.55 then
    return 'SE_E22';
  end if;
  select * into n from public.stena_se_corridor_nearest(p_geom);
  if found and n.corridor_code is not null then
    return n.corridor_code;
  end if;
  return 'SE_E22';
end;
$$;

revoke all on function public.stena_se_eta_corridor(geometry) from public, anon, authenticated;
grant execute on function public.stena_se_eta_corridor(geometry) to service_role;

comment on function public.stena_se_eta_corridor(geometry) is
  '27B:C: korytarz ETA Stena — lat<58.55 → SE_E22 (pień), potem najbliższy z dwóch.';

-- ---------------------------------------------------------------------------
-- refresh_load_eta: Stena IN_TRANSIT_SE → nearest-of-two (nie tylko SE_E22)
-- ---------------------------------------------------------------------------
create or replace function public.refresh_load_eta(p_load uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  r record;
  l record;
  v_end timestamptz;
  v_delay int;
  v_has boolean;
  v_kind risk_kind;
  v_off numeric;
  v_max_off numeric := null;
  v_span numeric := 0;
  v_samples int := 0;
  v_blocked boolean := false;
  v_corr text;
  v_eta_ok boolean;
  v_op text;
  v_route text;
  v_stena_dual boolean := false;
begin
  select * into r from compute_load_eta(p_load);
  select * into l from loads where id = p_load;
  if not found then return; end if;

  select load_delivery_deadline(l.plan_delivery_date, l.plan_delivery_to) into v_end;
  v_delay := case when r.eta is null or v_end is null then null
                  else greatest(0, round(extract(epoch from (r.eta - v_end)) / 60))::int end;

  perform set_config('tower.eta_ctx', 'on', true);
  update loads set eta_site = r.eta, eta_confidence_min = r.conf_min, eta_basis = r.basis, eta_computed_at = now(),
         delay_minutes = v_delay
   where id = p_load
     and (eta_site is distinct from r.eta or eta_confidence_min is distinct from r.conf_min
          or (eta_basis - 'computed_at') is distinct from (r.basis - 'computed_at')
          or delay_minutes is distinct from v_delay);
  perform set_config('tower.eta_ctx', '', true);

  v_has := exists (select 1 from positions p where p.load_id = p_load)
    or l.status in (
      'READY','AT_LOADING','IN_TRANSIT_PL','AT_PORT_GDANSK',
      'FERRY','AT_PORT_NYNASHAMN','IN_TRANSIT_SE','AT_SITE'
    );
  -- #590: wyklucz CANCELLED i REMOVED (strażnik import.sh; 0315 przepisało 0298 — nie zgub przy replace)
  v_eta_ok := l3_eta_alarm(r.eta, v_end, v_has)
    and l.actual_delivery_at is null
    and l.status::text not in ('CANCELLED', 'REMOVED')
    and public.load_status_rank(l.status) < public.load_status_rank('AT_SITE'::public.load_status);

  if v_eta_ok then
    perform l3_upsert_alarm(l.project_id, p_load, 'ETA_BREACH', 'ETA_BREACH:' || p_load,
      format('Opóźnienie %s min wobec planu dostawy (próg %s)', v_delay, l3_ops('DELAY_MIN')),
      'rk_eta_breach', true, true, now() + interval '2 hours',
      jsonb_build_object('params', jsonb_build_object('minutes', v_delay, 'threshold', l3_ops('DELAY_MIN'))),
      now());
  else
    perform l3_upsert_alarm(l.project_id, p_load, 'ETA_BREACH', 'ETA_BREACH:' || p_load,
      'ETA', 'rk_eta_breach', false, false, null, '{}'::jsonb, now());
    update risk_signals set resolved_at = now()
     where load_id = p_load and kind = 'ETA_BREACH' and resolved_at is null
       and dedup_key = 'ETA_BREACH:' || p_load and coalesce(detail->>'l3', '') <> '1';
  end if;

  v_blocked := l.status = 'FERRY' or l.status not in ('IN_TRANSIT_PL', 'IN_TRANSIT_SE');
  v_op := null;
  v_route := null;
  if l.sailing_id is not null then
    select sa.route into v_route from sailings sa where sa.id = l.sailing_id;
  end if;
  if v_route in ('GDY-KAA', 'KAA-GDY') then
    v_op := 'STENA';
  elsif v_route in ('GDN-NYN', 'NYN-GDN') then
    v_op := 'POLFERRIES';
  end if;

  if l.status = 'IN_TRANSIT_SE' then
    v_kind := 'ROAD_SE'::risk_kind;
    if v_op = 'STENA' then
      v_stena_dual := true;
      v_corr := 'SE_E22'; -- etykieta domyślna; faktyczny kod z nearest
    elsif v_op = 'POLFERRIES' then
      v_corr := 'SE_E4';
    else
      v_corr := null;
    end if;
  else
    v_kind := 'ROAD_PL'::risk_kind;
    v_corr := 'PL_ROAD';
  end if;

  if v_stena_dual is not true
     and (v_corr is null
          or not exists (
            select 1 from corridor_polylines cp
             where cp.code = v_corr and coalesce(cp.total_km, 0) > 0
          )) then
    v_blocked := true;
    v_samples := 0;
    v_max_off := 0;
    v_span := 0;
  elsif v_stena_dual is true
        and not exists (
          select 1 from corridor_polylines cp
           where cp.code = 'SE_E22' and coalesce(cp.total_km, 0) > 0
        )
        and not exists (
          select 1 from corridor_polylines cp
           where cp.code = public.stena_se_inland_corridor_code()
             and coalesce(cp.total_km, 0) > 0
        ) then
    v_blocked := true;
    v_samples := 0;
    v_max_off := 0;
    v_span := 0;
  else
    if v_stena_dual is true then
      select count(*)::int,
             max(n.off_m),
             min(n.off_m),
             coalesce(extract(epoch from (max(s.ts) - min(s.ts))) / 60.0, 0),
             coalesce(bool_or(l3_in_port_or_yard(s.g)), false),
             (array_agg(n.corridor_code order by s.ts desc))[1]
        into v_samples, v_max_off, v_off, v_span, v_has, v_corr
        from (
          select ts, coalesce(geom_snapped, geom_raw) as g
            from positions
           where load_id = p_load
           order by ts desc
           limit 2
        ) s
        cross join lateral stena_se_corridor_nearest(s.g) n;
    else
      select count(*)::int,
             max(cp.off_m),
             min(cp.off_m),
             coalesce(extract(epoch from (max(s.ts) - min(s.ts))) / 60.0, 0),
             coalesce(bool_or(l3_in_port_or_yard(s.g)), false)
        into v_samples, v_max_off, v_off, v_span, v_has
        from (
          select ts, coalesce(geom_snapped, geom_raw) as g
            from positions
           where load_id = p_load
           order by ts desc
           limit 2
        ) s
        cross join lateral corridor_progress(v_corr, s.g) cp;
    end if;
    if coalesce(v_off, 0) <= l3_ops('OFFROUTE_KM') * 1000 then
      v_max_off := 0;
    end if;
    v_blocked := v_blocked or coalesce(v_has, false);
  end if;

  if l3_deviation_alarm(v_max_off, v_samples, v_span, v_blocked) then
    perform l3_upsert_alarm(l.project_id, p_load, v_kind, 'OFF_CORRIDOR:' || p_load,
      format('Zjazd z trasy z zezwolenia: %s m od korytarza OSM (próg %s m)', round(v_max_off), l3_ops('OFFROUTE_KM') * 1000),
      'rk_off_corridor', true, true, now() + interval '1 hour',
      jsonb_build_object('params', jsonb_build_object(
        'meters', round(v_max_off), 'threshold', l3_ops('OFFROUTE_KM') * 1000, 'corridor', v_corr)),
      now());
  else
    update risk_signals set resolved_at = now()
     where load_id = p_load and resolved_at is null and dedup_key = 'OFF_CORRIDOR:' || p_load;
    perform l3_lapse('OFF_CORRIDOR:' || p_load, now());
  end if;
end $$;

revoke all on function public.refresh_load_eta(uuid) from public, anon, authenticated;
grant execute on function public.refresh_load_eta(uuid) to service_role;

comment on function public.refresh_load_eta(uuid) is
  '27B:C: Stena OFF_CORRIDOR = najbliższy z SE_E22 / śródlądowy; Polferries SE_E4; #496 bez korytarza przy nieznanej trasie.';

commit;
