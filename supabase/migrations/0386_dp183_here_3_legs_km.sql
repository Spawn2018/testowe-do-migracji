-- DP-183 (#718 odbiór HERE 03.11): FI-HEL / FI-VUO / SE-STO — zakresy km
-- do realnej długości ±10 % (ochrona przed trasą przez Norwegię); clear retry_after
-- żeby następny cron here-roads (~04:15 UTC) pobrał bez czekania doby (DP-70).

-- SE-STO: odbiór ~900–940 km przy starym 950–1050 → min za wysoko.
-- ±10 % wokół ~920 → 828–1012; zostawiamy zapas 820–1030 (SE-KPS 950–1050 bez zmian).
update public.here_road_legs
   set min_km = 820, max_km = 1030
 where leg = 'SE-STO'
   and active;

-- FI-HEL / FI-VUO: stary 880–950 zbyt wąski (Helsinki/Vuosaari → Oulu → Tornio → Boden).
-- ±10 % wokół ~900–1000 → 800–1100; exclude RUS/BLR nadal odcina objazd.
update public.here_road_legs
   set min_km = 800, max_km = 1100
 where leg in ('FI-HEL', 'FI-VUO')
   and active;

-- Wymuś ponowne pobranie tylko tych 3 (retry_after z odrzucenia +24 h).
-- Punkty zostają null; fetched_at=-infinity już z odrzucenia → shouldFetch po clear.
update public.here_road_geometry
   set retry_after = null
 where leg in ('FI-HEL', 'FI-VUO', 'SE-STO');
