-- DP-40 / F7 #673 r7: wierzchołki SE_KAA_INLAND vs realna linia HERE SE-KAA-INLAND.
-- SELECT prod 06.11.2026 (leg n_points=19409, geom_ok):
--   16.120/59.279 → 15,6 m — zostaje;
--   16.337/59.133 (Malmköping) → 9,3 km — przesunięty na st_closestpoint HERE (16.22388/59.06971).

update public.corridor_polylines
   set geom = st_setsrid(st_makeline(array[
         st_makepoint(15.6308, 56.1646),  -- origin HERE
         st_makepoint(15.656,  56.198),
         st_makepoint(15.84,   56.19),
         st_makepoint(15.99,   56.30),
         st_makepoint(16.06,   56.47),
         st_makepoint(16.17,   56.63),
         st_makepoint(16.366,  56.663),
         st_makepoint(16.385,  56.865),  -- Rockneby na E22 (F7 r4)
         st_makepoint(16.45,   57.26),
         st_makepoint(16.580,  57.755),  -- Västervik na E22 (F7 r4)
         st_makepoint(16.40,   57.89),
         st_makepoint(16.32,   58.48),
         st_makepoint(16.183,  58.594),  -- Norrköping
         st_makepoint(16.195,  58.795),
         st_makepoint(16.207,  58.996),  -- Katrineholm
         st_makepoint(16.22388, 59.06971), -- DP-40: closest HERE (było 16.337/59.133, 9,3 km)
         st_makepoint(16.120,  59.279),  -- Katrineholm–Eskilstuna (SELECT: 15,6 m — OK)
         st_makepoint(16.507,  59.371),  -- Eskilstuna
         st_makepoint(16.5448, 59.6099), -- Västerås
         st_makepoint(16.6066, 59.9079), -- Sala
         st_makepoint(16.929,  60.151),
         st_makepoint(17.00,   60.45),
         st_makepoint(17.109,  60.6638), -- Gävle E4 (F7 r5 B7)
         st_makepoint(17.065,  61.7279), -- Hudiksvall E4 (F7 r5 B7)
         st_makepoint(17.340,  62.391),  -- F7 r6: bliżej E4 (uwaga 3)
         st_makepoint(17.9379, 62.6323),
         st_makepoint(18.7153, 63.2909),
         st_makepoint(20.3263, 63.8127), -- F7 r6: Umeå na E4
         st_makepoint(21.2932, 64.3511), -- E4 Umeå–Skellefteå (F7 r4 B4)
         st_makepoint(20.9528, 64.7507),
         st_makepoint(21.4319, 65.3232), -- F7 r6: Piteå na E4
         st_makepoint(22.053,  65.606),  -- E4/97 przy Luleå
         st_makepoint(21.7591, 65.8054)  -- Boden
       ]), 4326),
       source = 'OSM / ODbL — Karlskrona → Västerås → E4; DP-40 Malmköping→HERE SE-KAA-INLAND',
       updated_at = now()
 where code = 'SE_KAA_INLAND';

update public.corridor_polylines
   set total_km = round((st_length(geom::geography) / 1000.0)::numeric, 2),
       updated_at = now()
 where code = 'SE_KAA_INLAND';
