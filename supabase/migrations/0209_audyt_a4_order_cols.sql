-- TOWER — 0209: A4 (D-20261015-0300-01) — KSH i SITE bez SELECT kolumn numerów zleceń.
-- Jak 0076 (driver_*): uprawnienia kolumnowe; numery tylko przez load_order_numbers() (E41).
-- Aplikacja już łączy numery z RPC (supabaseProvider) — LOAD_COLUMNS bez tych pól.

revoke select (hhl_order_no, carrier_order_no, order_no) on public.loads from authenticated;

comment on column public.loads.hhl_order_no is
  'A4 E41: SELECT tylko przez load_order_numbers() (HHL/SCX); KSH/SITE bez kolumny.';
comment on column public.loads.carrier_order_no is
  'A4 E41: SELECT tylko przez load_order_numbers() (HHL/SCX); KSH/SITE bez kolumny.';
comment on column public.loads.order_no is
  'A4 E41: numer z pliku KSH — SELECT tylko przez funkcje serwerowe; nie przez API kolumn.';
