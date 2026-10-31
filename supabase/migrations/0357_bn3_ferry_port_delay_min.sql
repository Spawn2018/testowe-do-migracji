-- BN3 decyzja 58: próg opóźnienia z danych portowych (ATA − arrival) = 15 min.
-- ATD nie ustawia opóźnienia wypłynięcia bez weryfikacji (kod Edge).
-- F7 #682 DP-89: on conflict nie nadpisuje value zmienionego przez admina.

insert into public.app_parameters (key, value, label, source) values
  (
    'FERRY_PORT_DELAY_MIN',
    15,
    'BN3: minuty ATA − arrival_at → delayed_arrival (Portnet); ETD/ETA DFDS w ferry-status',
    'BN3 31.10.2026 decyzja 58'
  )
on conflict (key) do update
  set label = excluded.label,
      source = excluded.source,
      updated_at = now();
