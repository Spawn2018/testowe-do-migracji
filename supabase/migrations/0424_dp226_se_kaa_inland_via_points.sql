-- DP-226 / F7 #843: here_road_legs.SE-KAA-INLAND.via_points było puste ([]),
-- a here_corridor_via_points('SE_KAA_INLAND',14) daje gotową listę passThrough.
-- Wypełniamy słownik z tej samej funkcji (jak BN7 dict dla innych legów).

update public.here_road_legs
   set via_points = public.here_corridor_via_points('SE_KAA_INLAND', 14)
 where leg = 'SE-KAA-INLAND'
   and corridor_code = 'SE_KAA_INLAND';

comment on column public.here_road_legs.via_points is
  'BN7 / DP-226: passThrough [[lat,lng],…] — SE-KAA-INLAND z here_corridor_via_points(SE_KAA_INLAND,14).';
