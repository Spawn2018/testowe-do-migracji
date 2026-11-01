-- BN3 #686 (decyzja 72 cz. 2): kind PRZYWROCONY w operator_notices (AUTO Tallink restore).
-- Ręczne operator_notice_apply nadal tylko ODWOLANY/OPOZNIONY/ZMIANA_GODZINY.

alter table public.operator_notices
  drop constraint if exists operator_notices_kind_check;

alter table public.operator_notices
  add constraint operator_notices_kind_check
  check (kind in ('ODWOLANY', 'OPOZNIONY', 'ZMIANA_GODZINY', 'PRZYWROCONY'));

comment on constraint operator_notices_kind_check on public.operator_notices is
  'BN3 #686: PRZYWROCONY = AUTO Tallink Alert przywrócenie (Edge); ręczne apply bez tego rodzaju.';
