-- III-1 — samotest szkieletu raportu na DANYCH SYNTETYCZNYCH (5 transportów), tylko w transakcji wycofanej.
-- Użycie: (echo 'begin;'; cat scripts/iii1/selftest.sql; echo 'rollback;') | psql "$URL" -At
-- Oczekiwane: PL_ROAD n=5 mediana 9.0 (+20% → PROPOZYCJA), PORT_CHECKIN 3.0, CROSSING 18.0, SE_TOTAL 30.0 (bez zmian).
set local session_replication_role = replica;  -- bez wyzwalaczy statusów i ETA (tylko zdarzenia do raportu)
create temp table iii1_l on commit drop as select gen_random_uuid() as id, i from generate_series(1, 5) i;
insert into loads (id, project_id, order_no) select id, (select id from projects where code = 'STEGRA_BODEN'), 'III1-' || i from iii1_l;
insert into geofences (project_id, name, kind, geom, country)
select p.id, 'III1 ' || k, k::geofence_kind, make_circle_fence(50 + n, 15, 500), 'PL'
  from projects p, (values ('LOADING', 1), ('PORT_OUT', 2), ('PORT_IN', 3), ('SITE', 4)) v(k, n) where p.code = 'STEGRA_BODEN';
with f as (select kind::text k, id from geofences where name like 'III1 %'),
t(ev, k, off_h) as (values ('GEOFENCE_EXIT', 'LOADING', 0.0), ('GEOFENCE_ENTER', 'PORT_OUT', 9.0), ('GEOFENCE_EXIT', 'PORT_OUT', 12.0),
                           ('GEOFENCE_ENTER', 'PORT_IN', 30.0), ('GEOFENCE_EXIT', 'PORT_IN', 31.0), ('GEOFENCE_ENTER', 'SITE', 61.0))
insert into load_events (load_id, event_type, occurred_at, payload)
select l.id, t.ev, timestamptz '2026-11-01 06:00+01' + make_interval(secs => ((t.off_h + case when t.off_h > 0 then (l.i - 3) * 0.2 else 0 end) * 3600)::int),
       jsonb_build_object('geofence_id', f.id)
  from iii1_l l cross join t join f on f.k = t.k;
\i scripts/iii1/calibration.sql
