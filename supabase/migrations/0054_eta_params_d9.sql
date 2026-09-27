-- 0054 — D-9 (decyzja właściciela 27.09.2026): nowe wartości początkowe czasów odcinków ETA v1.
-- Model: obsada jednoosobowa; przeprawa promem = dobowy odpoczynek kierowcy (kabina na promie — potwierdzone
-- przez właściciela 27.09), więc BEZ postoju w Nynäshamn przed odcinkiem SE. CROSSING_DEFAULT bez zmian (18 h).
-- Idempotentna (UPDATE do stałych wartości), niedestrukcyjna: zmienia wyłącznie 4 wiersze parametrów
-- i przelicza ETA transportów w toku (tylko kolumny eta_*/delay_minutes przez refresh_load_eta).
update eta_segment_params set hours = 7.5, spread_pct = 25,
       source = 'szacunek koordynatora 27.09 — do potwierdzenia z SCX (II-3)', updated_at = now()
 where code = 'PL_ROAD' and (hours, spread_pct, source) is distinct from (7.5::numeric, 25::numeric, 'szacunek koordynatora 27.09 — do potwierdzenia z SCX (II-3)');
update eta_segment_params set hours = 17, spread_pct = 20,
       source = 'szacunek koordynatora 27.09 — do potwierdzenia z SCX (II-3)', updated_at = now()
 where code = 'SE_ROAD' and (hours, spread_pct, source) is distinct from (17::numeric, 20::numeric, 'szacunek koordynatora 27.09 — do potwierdzenia z SCX (II-3)');
update eta_segment_params set hours = 13, spread_pct = 30,
       label = 'Przerwy i odpoczynek 561/2006 na odcinku SE (obsada jednoosobowa)',
       source = 'właściciel 27.09: obsada jednoosobowa, odpoczynek na promie', updated_at = now()
 where code = 'SE_BREAKS' and (hours, spread_pct, source) is distinct from (13::numeric, 30::numeric, 'właściciel 27.09: obsada jednoosobowa, odpoczynek na promie');
update eta_segment_params set hours = 3,
       source = 'szacunek koordynatora 27.09 — do potwierdzenia z SCX (II-3)', updated_at = now()
 where code = 'PORT_CHECKIN' and (hours, source) is distinct from (3::numeric, 'szacunek koordynatora 27.09 — do potwierdzenia z SCX (II-3)');

comment on table eta_segment_params is
  'ETA v1 — czasy odcinków. D-9 (27.09.2026): obsada jednoosobowa, przeprawa = dobowy odpoczynek (bez postoju w Nynäshamn). Zmiana wartości = nowa migracja albo decyzja HHL.';

-- przeliczenie ETA transportów w toku (produkcja 27.09: 0 transportów)
do $$
declare r record;
begin
  for r in select id from loads where status not in ('CANCELLED','UNLOADED','DELIVERED') loop
    perform refresh_load_eta(r.id);
  end loop;
end $$;
