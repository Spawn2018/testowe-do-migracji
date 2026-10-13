-- TOWER — Migracja 0200: P3 E5-1 — wartości startowe macierzy: e-mail wyłączony wszędzie
-- (stan 08.10; włącza właściciel w Opcjach). Idempotentna.

update public.notification_matrix
   set email = false
 where email is distinct from false;
