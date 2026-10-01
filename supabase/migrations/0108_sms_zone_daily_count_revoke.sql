-- 0108 — poprawka DEC-5: sms_zone_daily_count tylko wewnętrznie (security definer),
-- bez EXECUTE dla authenticated (pomocnicza do enqueue, nie RPC UI).

revoke all on function public.sms_zone_daily_count() from public, anon, authenticated;
