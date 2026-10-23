-- #487 — OFF_CORRIDOR po Karlskronie: korytarz z trasy rejsu (STENA→SE_E22, POLFERRIES→SE_E4).
-- Bez znanego korytarza / bez geometrii — nie twórz sprawy. Zamknięcie fałszywej 518c010e… (SG-23).

-- ---------------------------------------------------------------------------
-- 1. refresh_load_eta — korytarz SE zależny od portu przypłynięcia (jak ETA A5)
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
  v_eta_ok := l3_eta_alarm(r.eta, v_end, v_has)
    and l.actual_delivery_at is null
    and l.status is distinct from 'CANCELLED'
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
  if l.sailing_id is not null then
    select case when sa.route in ('GDY-KAA', 'KAA-GDY') then 'STENA' else 'POLFERRIES' end
      into v_op from sailings sa where sa.id = l.sailing_id;
  end if;

  if l.status = 'IN_TRANSIT_SE' then
    v_kind := 'ROAD_SE'::risk_kind;
    if v_op = 'STENA' then
      v_corr := 'SE_E22';
    elsif v_op = 'POLFERRIES' then
      v_corr := 'SE_E4';
    else
      v_corr := null;
    end if;
  else
    v_kind := 'ROAD_PL'::risk_kind;
    v_corr := 'PL_ROAD';
  end if;

  /* Bez znanego korytarza / bez geometrii — nie twórz OFF_CORRIDOR (#487). */
  if v_corr is null
     or not exists (
       select 1 from corridor_polylines cp
        where cp.code = v_corr and coalesce(cp.total_km, 0) > 0
     ) then
    v_blocked := true;
    v_samples := 0;
    v_max_off := 0;
    v_span := 0;
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

-- ---------------------------------------------------------------------------
-- 1b. Geometria SE_E22: bez Karlshamn (14.862); Jämjö/Brömsebro; Västervik→
--     Söderköping/Norrköping (F7 r3: 16.637 to Västervik, nie Norrköping).
--     total_km z geom (drugi UPDATE) — listy punktów się nie rozjeżdżają.
-- ---------------------------------------------------------------------------
update public.corridor_polylines
   set geom = st_setsrid(st_makeline(array[
         st_makepoint(15.5866, 56.1616),  -- Karlskrona
         st_makepoint(15.95,   56.25),    -- Jämjö (E22)
         st_makepoint(16.10,   56.30),    -- Brömsebro (E22)
         st_makepoint(16.366,  56.663),   -- Kalmar
         st_makepoint(16.637,  57.758),   -- Västervik (E22)
         st_makepoint(16.40,   57.89),    -- Gamleby (E22)
         st_makepoint(16.32,   58.48),    -- Söderköping (E22)
         st_makepoint(16.183,  58.594),   -- Norrköping → E4
         st_makepoint(17.008,  58.753),   -- Nyköping (E4)
         st_makepoint(18.0686, 59.3293),
         st_makepoint(17.6389, 59.8586),
         st_makepoint(17.1413, 60.6749),
         st_makepoint(17.1056, 61.7274),
         st_makepoint(17.3069, 62.3908),
         st_makepoint(17.9379, 62.6323),
         st_makepoint(18.7153, 63.2909),
         st_makepoint(20.2630, 63.8258),
         st_makepoint(20.9528, 64.7507),
         st_makepoint(21.4794, 65.3172),
         st_makepoint(22.1547, 65.5848),
         st_makepoint(21.7591, 65.8054)   -- Boden
       ]), 4326),
       source = 'OSM / ODbL — Karlskrona → E22 (Jämjö…Norrköping) → E4 (Nyköping) → Boden (#487)',
       updated_at = now()
 where code = 'SE_E22';

update public.corridor_polylines
   set total_km = round((st_length(geom::geography) / 1000.0)::numeric, 2),
       updated_at = now()
 where code = 'SE_E22';

-- ---------------------------------------------------------------------------
-- 2. Zamknięcie fałszywej sprawy SG-23 (518c010e…) + Stena + SE_E4
-- F7: 518c010e bez warunku resolved_at (idempotentnie); SUPPRESSED tylko po risk_id;
--     audit_log tylko przy faktycznej zmianie.
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
  v_false uuid := '518c010e-b632-4dbb-92b8-4b29c10b3d02';
  v_sig int;
  v_notif int;
begin
  for r in
    select s.id, s.dedup_key, s.load_id
      from risk_signals s
      join loads l on l.id = s.load_id
      left join sailings sa on sa.id = l.sailing_id
     where s.title_key = 'rk_off_corridor'
       and s.dedup_key like 'OFF_CORRIDOR:%'
       and (
         s.id = v_false
         or (
           s.resolved_at is null
           and coalesce(s.detail->'params'->>'corridor', '') = 'SE_E4'
           and sa.route in ('GDY-KAA', 'KAA-GDY')
         )
       )
  loop
    update risk_signals
       set resolved_at = coalesce(resolved_at, now()),
           detail = coalesce(detail, '{}'::jsonb) || jsonb_build_object(
             'closed_by', '#487',
             'closed_note', 'fałszywa — brak korytarza E22 (Karlskrona)'
           )
     where id = r.id
       and (
         resolved_at is null
         or coalesce(detail->>'closed_by', '') is distinct from '#487'
       );
    get diagnostics v_sig = row_count;

    perform l3_lapse(r.dedup_key, now());

    /* Tylko powiadomienia tej sprawy — nie FERRY_OVERDUE / eskalacje SG-23. */
    update notifications
       set status = 'SUPPRESSED',
           error = coalesce(nullif(error, ''), 'fałszywa OFF_CORRIDOR #487')
     where status = 'PENDING'
       and payload->>'risk_id' = r.id::text;
    get diagnostics v_notif = row_count;

    if v_sig > 0 or v_notif > 0 then
      insert into audit_log (user_id, action, entity, entity_id, new_value)
      values (
        null, 'HOTFIX_487_OFF_CORRIDOR', 'risk_signals', r.id::text,
        jsonb_build_object(
          'dedup_key', r.dedup_key,
          'load_id', r.load_id,
          'note', 'fałszywa — brak korytarza E22 (Karlskrona)',
          'signals_updated', v_sig,
          'notifications_suppressed', v_notif
        )
      );
    end if;
  end loop;
end $$;
