-- =====================================================================
-- TOWER — Migracja 0071: opłacona faktura anuluje także przypomnienia zablokowane przed R-2 (BLOCKED_R2, 0068)
--   Bez tego po włączeniu wiadomości zewnętrznych zablokowane przypomnienie opłaconej faktury zostałoby w kolejce.
--   Idempotentna.
-- =====================================================================
create or replace function invoices_paid_silence() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.payment_status = 'OPLACONA' and old.payment_status is distinct from 'OPLACONA' then
    update notifications set status = 'CANCELLED', error = 'opłacona'
     where template = 'PAYMENT_REMINDER' and channel = 'EMAIL' and status in ('PENDING', 'BLOCKED_R2')
       and payload->>'invoice_id' = new.id::text;
  end if;
  return new;
end $$;
revoke all on function invoices_paid_silence() from public, anon, authenticated;
