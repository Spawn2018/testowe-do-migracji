-- BN5 (#714): korytarze pogody bałtyckiej — Zatoka Fińska, Paldiski–Kapellskär, Tallinn–Sztokholm.
-- CHECK marine_conditions + wiersze startowe; bez zmiany progów WAVE_M / GUST_KN (D-39).

alter table public.marine_conditions drop constraint if exists marine_conditions_corridor_check;
alter table public.marine_conditions add constraint marine_conditions_corridor_check
  check (corridor in (
    'BALTIC_GDN_NYN',
    'BALTIC_GDY_KAA',
    'BALTIC_GULF_FI',
    'BALTIC_PLD_KPS',
    'BALTIC_TLL_STO'
  ));

insert into public.marine_conditions (corridor, max_wave_m, max_gust_kn, risk, sources, attribution, detail)
values
  (
    'BALTIC_GULF_FI', null, null, 'niskie', '',
    'Dane: FMI / DMI / SMHI (CC BY 4.0)',
    jsonb_build_object(
      'status', 'start — brak odczytu',
      'punkty', jsonb_build_array('GULF_MID'),
      'rodziny', jsonb_build_array('TLL-HEL', 'MUU-VUO')
    )
  ),
  (
    'BALTIC_PLD_KPS', null, null, 'niskie', '',
    'Dane: FMI / DMI / SMHI (CC BY 4.0)',
    jsonb_build_object(
      'status', 'start — brak odczytu',
      'punkty', jsonb_build_array('NB_EAST', 'ALAND_S'),
      'rodziny', jsonb_build_array('PLD-KPS')
    )
  ),
  (
    'BALTIC_TLL_STO', null, null, 'niskie', '',
    'Dane: FMI / DMI / SMHI (CC BY 4.0)',
    jsonb_build_object(
      'status', 'start — brak odczytu',
      'punkty', jsonb_build_array('GULF_W', 'GULF_MID', 'ALAND_SEA'),
      'rodziny', jsonb_build_array('TLL-STO')
    )
  )
on conflict (corridor) do nothing;

comment on table public.marine_conditions is
  'II-8 / BN5: pogoda morska PL–SE + 3 korytarze bałtyckie (GULF_FI, PLD_KPS, TLL_STO). Progi D-39 (3,8 m / 40 kn).';
