-- =====================================================================
-- TOWER — Migracja 0156: DRV-CLOSE (U-38, D-36)
--
-- Stary link kierowcy nie przyjmuje pozycji.
-- Anonim traci prawo wywołania driver_post_position.
-- Wszystkie wydane tokeny są unieważnione.
-- Funkcja zostaje w bazie. Pozycje mają przychodzić wyłącznie z telematyki.
-- Włączenie linku z powrotem wymaga nowej decyzji właściciela i nowego GRANT.
-- =====================================================================

revoke all on function public.driver_post_position(text, uuid, float8, float8, timestamptz, numeric, numeric, numeric) from public, anon;

update public.driver_tokens
   set revoked_at = now()
 where revoked_at is null;
