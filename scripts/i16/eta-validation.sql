-- I-16 — walidacja ETA v1 na 50 prawdziwych transportach (KSH_HARMONOGRAM.xlsx: 50 przyjętych wierszy; bez godzin).
-- Uruchamiać WYŁĄCZNIE w transakcji wycofanej (produkcja: prawdziwy rozkład rejsów GDN-NYN, parametry 0054).
-- Zapas [h] = termin planu KSH (dzień załadunku + 5 dni, koniec dnia, Europe/Stockholm) − ETA. Ujemny = spóźnienie.
-- Użycie: (echo begin; cat scripts/i16/eta-validation.sql; echo rollback) | psql "$SUPABASE_DB_POOLER_URL" -At
create temp table i16_rows (code text, load_date date, delivery_date date) on commit drop;
insert into i16_rows values
  ('SG-01', date '2026-09-30', date '2026-10-05'),
  ('SG-02', date '2026-09-30', date '2026-10-05'),
  ('T-01', date '2026-09-30', date '2026-10-05'),
  ('SG-03', date '2026-10-01', date '2026-10-06'),
  ('SG-04', date '2026-10-01', date '2026-10-06'),
  ('T-02', date '2026-10-01', date '2026-10-06'),
  ('SG-05', date '2026-10-02', date '2026-10-07'),
  ('SG-06', date '2026-10-02', date '2026-10-07'),
  ('T-03', date '2026-10-02', date '2026-10-07'),
  ('SG-07', date '2026-10-03', date '2026-10-08'),
  ('SG-08', date '2026-10-03', date '2026-10-08'),
  ('T-04', date '2026-10-03', date '2026-10-08'),
  ('SG-09', date '2026-10-05', date '2026-10-09'),
  ('SG-10', date '2026-10-05', date '2026-10-09'),
  ('T-05', date '2026-10-05', date '2026-10-09'),
  ('SG-11', date '2026-10-07', date '2026-10-12'),
  ('SG-12', date '2026-10-07', date '2026-10-12'),
  ('T-06', date '2026-10-07', date '2026-10-12'),
  ('SG-13', date '2026-10-08', date '2026-10-13'),
  ('SG-14', date '2026-10-08', date '2026-10-13'),
  ('T-07', date '2026-10-08', date '2026-10-13'),
  ('SG-15', date '2026-10-09', date '2026-10-14'),
  ('SG-16', date '2026-10-09', date '2026-10-14'),
  ('T-08', date '2026-10-09', date '2026-10-14'),
  ('SG-17', date '2026-10-16', date '2026-10-21'),
  ('SG-18', date '2026-10-16', date '2026-10-21'),
  ('SG-19', date '2026-10-17', date '2026-10-22'),
  ('SG-20', date '2026-10-17', date '2026-10-22'),
  ('T-09', date '2026-10-17', date '2026-10-22'),
  ('SG-21', date '2026-10-19', date '2026-10-23'),
  ('SG-22', date '2026-10-19', date '2026-10-23'),
  ('T-10', date '2026-10-19', date '2026-10-23'),
  ('T-11', date '2026-10-19', date '2026-10-24'),
  ('SG-23', date '2026-10-21', date '2026-10-26'),
  ('SG-24', date '2026-10-21', date '2026-10-26'),
  ('T-12', date '2026-10-21', date '2026-10-26'),
  ('SG-25', date '2026-10-22', date '2026-10-27'),
  ('SG-26', date '2026-10-22', date '2026-10-27'),
  ('T-13', date '2026-10-22', date '2026-10-27'),
  ('SG-27', date '2026-10-23', date '2026-10-28'),
  ('SG-28', date '2026-10-23', date '2026-10-28'),
  ('SG-29', date '2026-10-24', date '2026-10-29'),
  ('SG-30', date '2026-10-24', date '2026-10-29'),
  ('T-14', date '2026-10-24', date '2026-10-29'),
  ('SS-01', date '2026-10-29', date '2026-11-03'),
  ('T-15', date '2026-10-29', date '2026-11-03'),
  ('SS-02', date '2026-11-01', date '2026-11-06'),
  ('SS-03', date '2026-11-02', date '2026-11-09'),
  ('SS-04', date '2026-11-07', date '2026-11-12'),
  ('SS-05', date '2026-11-14', date '2026-11-19');
create temp table i16_loads on commit drop as
select r.*, gen_random_uuid() as id from i16_rows r;
insert into loads (id, project_id, status, plan_load_date, plan_delivery_date, order_no)
select id, (select id from projects where code = 'STEGRA_BODEN'), 'PLANNED', load_date, delivery_date, 'I16-' || code from i16_loads;
create temp table i16_eta on commit drop as
select x.code, x.load_date, x.delivery_date, e.eta, e.conf_min,
       (e.basis->'segments'->1->>'departure')::timestamptz as dep, e.basis->'segments'->1->>'source' as sail_src,
       round(extract(epoch from (((x.load_date + 6)::timestamp at time zone 'Europe/Stockholm') - e.eta)) / 3600, 1) as slack_plan5_h,
       round(extract(epoch from (((x.delivery_date + 1)::timestamp at time zone 'Europe/Stockholm') - e.eta)) / 3600, 1) as slack_file_h,
       round(extract(epoch from (e.eta - ((x.load_date + time '12:00') at time zone 'Europe/Warsaw'))) / 3600, 1) as door_h
  from i16_loads x cross join lateral compute_load_eta(x.id) e;
\echo '== podsumowanie: n | zapas wobec planu 5 dni [h] min / mediana / max | ujemnych | zapas wobec daty z pliku min / mediana / max | czas start→ETA min / mediana / max'
select count(*), min(slack_plan5_h), percentile_cont(0.5) within group (order by slack_plan5_h), max(slack_plan5_h),
       count(*) filter (where slack_plan5_h < 0),
       min(slack_file_h), percentile_cont(0.5) within group (order by slack_file_h), max(slack_file_h),
       min(door_h), percentile_cont(0.5) within group (order by door_h), max(door_h)
  from i16_eta;
\echo '== rozkład czasu start→ETA (h) i zapasu'
select door_h, slack_plan5_h, count(*) from i16_eta group by 1, 2 order by 1, 2;
\echo '== transporty: kod | załadunek | dostawa (plik) | rejs | ETA (PL) | zapas plan 5 d | zapas plik | ± min'
select code, load_date, delivery_date, to_char(dep at time zone 'Europe/Warsaw', 'Dy DD.MM HH24:MI') || ' (' || sail_src || ')',
       to_char(eta at time zone 'Europe/Warsaw', 'DD.MM HH24:MI'), slack_plan5_h, slack_file_h, conf_min
  from i16_eta order by load_date, code;

-- Transport wzorcowy D-9 (I-D9-a): załadunek 28.09.2026 bez godziny, dostawa 30.09.2026 — rozbicie na odcinki.
insert into loads (id, project_id, status, plan_load_date, plan_delivery_date, order_no)
values ('00000000-0000-0000-0000-0000000d0009', (select id from projects where code = 'STEGRA_BODEN'), 'PLANNED', date '2026-09-28', date '2026-09-30', 'I16-D9');
\echo '== D-9: odcinki (czas PL)'
with e as (select * from compute_load_eta('00000000-0000-0000-0000-0000000d0009')),
     p as (select (select hours from eta_segment_params where code='PL_ROAD') pl, (select hours from eta_segment_params where code='PORT_CHECKIN') ci,
                  (select hours from eta_segment_params where code='SE_ROAD') se, (select hours from eta_segment_params where code='SE_BREAKS') br),
     t as (select ((date '2026-09-28' + time '12:00') at time zone 'Europe/Warsaw') as start,
                  (e.basis->'segments'->1->>'departure')::timestamptz dep, (e.basis->'segments'->1->>'arrival')::timestamptz arr,
                  e.basis->'segments'->1->>'source' src, e.eta, e.conf_min from e)
select x.* from t, p, lateral (values
  ('1 start załadunku (sama data = 12:00)', to_char(t.start at time zone 'Europe/Warsaw','Dy DD.MM HH24:MI'), '—'),
  ('2 koniec PL_ROAD (' || p.pl || ' h)', to_char((t.start + make_interval(secs => (p.pl*3600)::int)) at time zone 'Europe/Warsaw','Dy DD.MM HH24:MI'), p.pl::text),
  ('3 koniec check-in (' || p.ci || ' h)', to_char((t.start + make_interval(secs => ((p.pl+p.ci)*3600)::int)) at time zone 'Europe/Warsaw','Dy DD.MM HH24:MI'), (p.pl+p.ci)::text),
  ('4 rejs: odpłynięcie (' || t.src || ')', to_char(t.dep at time zone 'Europe/Warsaw','Dy DD.MM HH24:MI'), round(extract(epoch from t.dep - t.start)/3600,1)::text),
  ('5 rejs: przypłynięcie (odpoczynek dobowy na promie)', to_char(t.arr at time zone 'Europe/Warsaw','Dy DD.MM HH24:MI'), round(extract(epoch from t.arr - t.start)/3600,1)::text),
  ('6 koniec SE_ROAD (' || p.se || ' h)', to_char((t.arr + make_interval(secs => (p.se*3600)::int)) at time zone 'Europe/Warsaw','Dy DD.MM HH24:MI'), round(extract(epoch from t.arr - t.start)/3600 + p.se,1)::text),
  ('7 koniec SE_BREAKS (' || p.br || ' h) = ETA', to_char(t.eta at time zone 'Europe/Warsaw','Dy DD.MM HH24:MI'), round(extract(epoch from t.eta - t.start)/3600,1)::text),
  ('8 pasmo ±', t.conf_min || ' min', '—'),
  ('9 termin z planu dostawy (koniec 30.09, Sztokholm)', to_char(((date '2026-10-01')::timestamp at time zone 'Europe/Stockholm') at time zone 'Europe/Warsaw','Dy DD.MM HH24:MI'),
     'zapas ' || round(extract(epoch from (((date '2026-10-01')::timestamp at time zone 'Europe/Stockholm') - t.eta))/3600,1) || ' h'),
  ('10 termin planu KSH 5 dni (koniec 03.10)', to_char(((date '2026-10-04')::timestamp at time zone 'Europe/Stockholm') at time zone 'Europe/Warsaw','Dy DD.MM HH24:MI'),
     'zapas ' || round(extract(epoch from (((date '2026-10-04')::timestamp at time zone 'Europe/Stockholm') - t.eta))/3600,1) || ' h')
) x(krok, czas_pl, h_od_startu);
