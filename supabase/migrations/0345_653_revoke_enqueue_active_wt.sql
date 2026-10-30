-- #653: revoke ksh_sync_outbound_enqueue_active_wt z authenticated
-- Decyzja właściciela 30.10 01:15: bez uzupełniania wstecz; nie wołać backfillu.
-- Funkcja zostaje w bazie (HHL_ADMIN+2FA w ciele) — tylko do ręcznego SQL poza API.

begin;

revoke all on function public.ksh_sync_outbound_enqueue_active_wt() from public, anon, authenticated;

comment on function public.ksh_sync_outbound_enqueue_active_wt() is
  '#650/#653: jednorazowe zakolejkowanie kompletu 6 pól WT→plik dla aktywnych STEGRA_* — WYŁĄCZONE z API (revoke authenticated; decyzja właściciela 30.10: bez backfillu). Funkcja zostaje; HHL_ADMIN+2FA w ciele; wymaga write_enabled. Nie wywoływać.';

commit;
