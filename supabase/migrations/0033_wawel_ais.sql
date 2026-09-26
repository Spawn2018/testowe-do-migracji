-- 0033 — dane AIS promu M/F Wawel (zatwierdzone przez właściciela 26.09.2026) + znak wywoławczy statków.
-- Źródła: Digitraffic (pozycja dla MMSI 311852000), Wikipedia/MarineTraffic (IMO 7814462, sygnał C6TY9).
-- Idempotentna: kolumna "if not exists", aktualizacja tylko gdy MMSI jeszcze pusty.
alter table public.vessels add column if not exists call_sign text;
update public.vessels set mmsi = 311852000, imo = 7814462, call_sign = 'C6TY9'
 where name = 'M/F Wawel' and mmsi is null;
