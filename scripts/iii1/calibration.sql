-- III-1 — raport kalibracji czasów odcinków ETA (SZKIELET; prawdziwe dane po 5 transportach pilotażu).
-- Tylko odczyt: nic nie zmienia w eta_segment_params. Wynik = PROPOZYCJA do zatwierdzenia przez HHL
-- (nową wartość wpisuje się osobną migracją ze źródłem „III-1 <data>, n = …”), nigdy cicha zmiana.
--
-- Odcinki z wjazdów/wyjazdów stref (load_events GEOFENCE_ENTER/EXIT, payload.geofence_id → geofences.kind):
--   PL_ROAD       wyjazd z LOADING   → wjazd do PORT_OUT
--   PORT_CHECKIN  wjazd do PORT_OUT  → wyjazd z PORT_OUT   (odprawa + oczekiwanie; przybliżenie)
--   CROSSING      wyjazd z PORT_OUT  → wjazd do PORT_IN    (porównanie z CROSSING_DEFAULT; ETA używa rejsu z `sailings`)
--   SE_TOTAL      wyjazd z PORT_IN   → wjazd do SITE       (porównanie z SE_ROAD + SE_BREAKS + SE_DAILY_REST)
-- Dla każdego transportu brane jest pierwsze zdarzenie danego rodzaju (koniec odcinka — pierwsze po początku).
-- Próg: propozycja tylko przy n ≥ :min_n (domyślnie 5) i odchyleniu mediany od parametru > 10%.
-- Użycie: psql "$URL" -v min_n=5 -f scripts/iii1/calibration.sql   (produkcja: wystarczy odczyt)
\if :{?min_n}
\else
  \set min_n 5
\endif
with ev as (
  select e.load_id, e.event_type, e.occurred_at, g.kind::text as kind
    from load_events e join geofences g on g.id = (e.payload->>'geofence_id')::uuid
   where e.event_type in ('GEOFENCE_ENTER', 'GEOFENCE_EXIT')
     and not exists (select 1 from loads l where l.id = e.load_id and l.order_no like 'I16-%')
),
seg_def(code, from_type, from_kind, to_type, to_kind, param_codes, ord) as (values
  ('PL_ROAD',      'GEOFENCE_EXIT',  'LOADING',  'GEOFENCE_ENTER', 'PORT_OUT', array['PL_ROAD'], 1),
  ('PORT_CHECKIN', 'GEOFENCE_ENTER', 'PORT_OUT', 'GEOFENCE_EXIT',  'PORT_OUT', array['PORT_CHECKIN'], 2),
  ('CROSSING',     'GEOFENCE_EXIT',  'PORT_OUT', 'GEOFENCE_ENTER', 'PORT_IN',  array['CROSSING_DEFAULT'], 3),
  ('SE_TOTAL',     'GEOFENCE_EXIT',  'PORT_IN',  'GEOFENCE_ENTER', 'SITE',     array['SE_ROAD', 'SE_BREAKS', 'SE_DAILY_REST'], 4)
),
starts as (
  select d.code, s.load_id, min(s.occurred_at) as t0
    from seg_def d join ev s on s.event_type = d.from_type and s.kind = d.from_kind
   group by d.code, s.load_id
),
obs as (
  select st.code, st.load_id, extract(epoch from (min(e.occurred_at) - st.t0)) / 3600.0 as h
    from starts st join seg_def d on d.code = st.code
    join ev e on e.load_id = st.load_id and e.event_type = d.to_type and e.kind = d.to_kind and e.occurred_at > st.t0
   group by st.code, st.load_id, st.t0
),
stats as (
  select code, count(*) as n,
         percentile_cont(0.5) within group (order by h) as med,
         percentile_cont(0.1) within group (order by h) as p10,
         percentile_cont(0.9) within group (order by h) as p90,
         min(h) as hmin, max(h) as hmax
    from obs group by code
),
par as (
  select d.code, d.ord, sum(p.hours) as plan_h,
         string_agg(p.code || ' ' || round(p.hours, 1) || ' h ±' || round(p.spread_pct) || '%', ' + ' order by p.code) as plan_txt
    from seg_def d left join eta_segment_params p on p.code = any (d.param_codes)
   group by d.code, d.ord
)
select par.code as "odcinek",
       coalesce(s.n, 0) as "n",
       round(s.med::numeric, 1) as "mediana_h",
       round(s.p10::numeric, 1) || '–' || round(s.p90::numeric, 1) as "p10–p90_h",
       round(s.hmin::numeric, 1) || '–' || round(s.hmax::numeric, 1) as "min–max_h",
       par.plan_txt as "parametr",
       case when s.med is null or par.plan_h is null or par.plan_h = 0 then null
            else round(((s.med - par.plan_h) / par.plan_h * 100)::numeric) end as "odchylenie_%",
       case when coalesce(s.n, 0) < :min_n then 'za mało danych (n < ' || :min_n || ') — bez propozycji'
            when abs(s.med - par.plan_h) / nullif(par.plan_h, 0) <= 0.10 then 'bez zmian (odchylenie ≤ 10%)'
            else 'PROPOZYCJA: ' || round(s.med::numeric, 1) || ' h, rozrzut ±'
                 || round((greatest(s.p90 - s.med, s.med - s.p10) / nullif(s.med, 0) * 100)::numeric) || '% — do zatwierdzenia przez HHL'
       end as "wniosek"
  from par left join stats s on s.code = par.code
 order by par.ord;
