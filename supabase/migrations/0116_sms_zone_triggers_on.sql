-- 0116 — SMS strefy ON po udanym burst 10/10 DELIVERED (SMS-DELIV).
-- Przywraca wyzwalacze wyłączone w 0112 do czasu testu doręczenia.
-- Idempotentna.

update public.security_flags
   set enabled = true,
       updated_at = now()
 where key in ('SMS_ZONE_APPROACH', 'SMS_ZONE_ENTER')
   and enabled is distinct from true;
