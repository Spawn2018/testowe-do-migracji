-- #667 F7 r2 B4 / r3 B5: korytarze SE_E22 / SE_KAA_INLAND — origin Karlskrona + Luleå na E4/97.
-- SE_E22 = 30 pkt z 0298 (nie 21 z 0275); zmienione tylko origin HERE i Luleå E4/97.
-- DP-22: map_display_state zwraca też legi bez points + summary (odrzucone / oczekujące).

begin;

-- ---------------------------------------------------------------------------
-- SE_E22 — 30 pkt z 0298 (Lyckeby…Vagnhärad…Södertälje); zmienione tylko:
--   1) origin HERE 15.6308/56.1646 (nie Trossö 15.5866/56.1616)
--   2) Luleå E4/97 22.053/65.606 (nie centrum 22.1547/65.5848)
-- F7 r3 B5: nie cofać do 21 pkt z 0275 (usuwało Vagnhärad → fałszywy OFF_CORRIDOR).
-- ---------------------------------------------------------------------------
update public.corridor_polylines
   set geom = st_setsrid(st_makeline(array[
         st_makepoint(15.6308, 56.1646),  -- origin HERE Karlskrona (#667 F7 B4/B5)
         st_makepoint(15.656,  56.198),   -- Lyckeby (E22) F7 #496
         st_makepoint(15.84,   56.19),    -- Jämjö (E22)
         st_makepoint(15.99,   56.30),    -- Brömsebro (E22) — 15.99 z 0298 (nie 16.10)
         st_makepoint(16.06,   56.47),    -- Söderåkra (E22)
         st_makepoint(16.17,   56.63),    -- Ljungbyholm (E22)
         st_makepoint(16.366,  56.663),   -- Kalmar
         st_makepoint(16.32,   56.87),    -- Rockneby (E22)
         st_makepoint(16.45,   57.26),    -- Oskarshamn (E22)
         st_makepoint(16.637,  57.758),   -- Västervik (E22)
         st_makepoint(16.40,   57.89),    -- Gamleby (E22)
         st_makepoint(16.32,   58.48),    -- Söderköping (E22)
         st_makepoint(16.183,  58.594),   -- Norrköping → E4
         st_makepoint(17.008,  58.753),   -- Nyköping (E4)
         st_makepoint(17.50,   58.95),    -- Vagnhärad (E4) #496 — wymagane OFF_CORRIDOR=0
         st_makepoint(17.54,   59.03),    -- Hölö (E4)
         st_makepoint(17.57,   59.09),    -- Järna (E4)
         st_makepoint(17.628,  59.195),   -- Södertälje (E4)
         st_makepoint(18.0686, 59.3293),  -- Sztokholm
         st_makepoint(17.6389, 59.8586),
         st_makepoint(17.1413, 60.6749),  -- Gävle
         st_makepoint(17.1056, 61.7274),
         st_makepoint(17.3069, 62.3908),
         st_makepoint(17.9379, 62.6323),
         st_makepoint(18.7153, 63.2909),
         st_makepoint(20.2630, 63.8258),
         st_makepoint(20.9528, 64.7507),
         st_makepoint(21.4794, 65.3172),
         st_makepoint(22.053,  65.606),   -- E4/97 przy Luleå (nie centrum)
         st_makepoint(21.7591, 65.8054)   -- Boden
       ]), 4326),
       source = 'OSM / ODbL — Karlskrona (origin HERE) → E22 → E4 (Vagnhärad…Södertälje) → Boden (#667 F7 r3 B5)',
       updated_at = now()
 where code = 'SE_E22';

update public.corridor_polylines
   set total_km = round((st_length(geom::geography) / 1000.0)::numeric, 2),
       updated_at = now()
 where code = 'SE_E22';

-- ---------------------------------------------------------------------------
-- SE_KAA_INLAND — te same punkty co 0331, origin + Luleå jak wyżej.
-- ---------------------------------------------------------------------------
update public.corridor_polylines
   set geom = st_setsrid(st_makeline(array[
         st_makepoint(15.6308, 56.1646),  -- origin HERE
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
         st_makepoint(16.183,  58.594),  -- Norrköping
         st_makepoint(16.195,  58.795),
         st_makepoint(16.207,  58.996),  -- Katrineholm
         st_makepoint(16.337,  59.133),
         st_makepoint(16.507,  59.371),  -- Eskilstuna
         st_makepoint(16.5448, 59.6099), -- Västerås
         st_makepoint(16.6066, 59.9079), -- Sala
         st_makepoint(16.929,  60.151),
         st_makepoint(17.00,   60.45),
         st_makepoint(17.1413, 60.6749), -- Gävle
         st_makepoint(17.1056, 61.7274),
         st_makepoint(17.3069, 62.3908),
         st_makepoint(17.9379, 62.6323),
         st_makepoint(18.7153, 63.2909),
         st_makepoint(20.2630, 63.8258),
         st_makepoint(20.9528, 64.7507),
         st_makepoint(21.4794, 65.3172),
         st_makepoint(22.053,  65.606),  -- E4/97 przy Luleå
         st_makepoint(21.7591, 65.8054)  -- Boden
       ]), 4326),
       source = 'OSM / ODbL — Karlskrona (origin HERE) → Västerås → Gävle → Boden (#667 F7 r2 B4)',
       updated_at = now()
 where code = 'SE_KAA_INLAND';

update public.corridor_polylines
   set total_km = round((st_length(geom::geography) / 1000.0)::numeric, 2),
       updated_at = now()
 where code = 'SE_KAA_INLAND';

-- ---------------------------------------------------------------------------
-- DP-22 fundament: summary odrzuconego / oczekującego legu widoczne w RPC.
-- (UI Stan systemu — osobno w DP-22; tu dane dla frontu.)
-- ---------------------------------------------------------------------------
create or replace function public.map_display_state()
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare v_roads jsonb;
begin
  if (public.current_app_user_id() is null) then
    raise exception 'Brak aktywnego konta' using errcode = '42501';
  end if;
  perform public.purge_here_road_geometry(now());
  select coalesce(jsonb_agg(jsonb_build_object(
    'leg', leg,
    'points', points,
    'summary', summary,
    'fetched_at', fetched_at
  ) order by leg), '[]'::jsonb)
    into v_roads
    from here_road_geometry;
  return jsonb_build_object(
    'tiles_open', public.here_tiles_open(now()),
    'month', (date_trunc('month', now() at time zone 'Europe/Warsaw'))::date,
    'h6', public.h6_map_enabled(),
    'roads', v_roads
  );
end;
$$;

revoke all on function public.map_display_state() from public, anon;
grant execute on function public.map_display_state() to authenticated;

comment on function public.map_display_state() is
  '#667 F7 r2 / DP-22: roads = wszystkie legi (także points null) + summary; tiles/h6 jak 0170.';

commit;
