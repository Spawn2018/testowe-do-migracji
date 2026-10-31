-- BN3 decyzja 58: próg opóźnienia z danych portowych (ATA − arrival) = 15 min.
-- ATD nie ustawia opóźnienia wypłynięcia bez weryfikacji (kod Edge).

insert into public.app_parameters (key, value, label, source) values
  (
    'FERRY_PORT_DELAY_MIN',
    15,
    'BN3: minuty ATA − arrival_at → delayed_arrival / OPOZNIONY (Portnet, Ports of Stockholm)',
    'BN3 31.10.2026 decyzja 58'
  )
on conflict (key) do update
  set value = excluded.value,
      label = excluded.label,
      source = excluded.source,
      updated_at = now();
