#!/usr/bin/env bash
# TOWER — I-31: SEFS hybrid_min (0101). Stawki/progi testowe zmyślone — wyjątek: asercja 1,14 na średnich koordynatora.
set -e
ADMIN=${PGADMIN:-postgres://postgres@localhost:5433/postgres}
. "$(git rev-parse --show-toplevel)/tests/db/local-only.sh"
if [ "${TOWER_HOSTED_READY:-}" = "1" ]; then
  URL="$ADMIN"
else
  DB=tower_test_i31; URL="${ADMIN%/*}/$DB"
  psql "$ADMIN" -q -c "drop database if exists $DB" -c "create database $DB"
  psql "$URL" -q -v ON_ERROR_STOP=1 -f tests/db/supabase_stub.sql
  for f in supabase/migrations/*.sql; do psql "$URL" -q -v ON_ERROR_STOP=1 -f "$f" >/dev/null 2>&1 || { echo "MIGRACJA $f"; exit 1; }; done
  psql "$URL" -q -v ON_ERROR_STOP=1 -f tests/db/seed.sql
fi
set +e

PSQL="psql $URL -Atq"
HHL=11111111-0000-0000-0000-000000000001
KSH=11111111-0000-0000-0000-000000000002
P=22222222-0000-0000-0000-000000000001
ok=0; fail=0
run() { local end="rollback"; [ "$3" = "commit" ] && end="commit"
  $PSQL -v ON_ERROR_STOP=1 -c "begin; set local role ${ROLE:-authenticated}; set local request.jwt.claim.sub='$1'; $2; $end;" 2>&1; }
val() { out=$(run "$2" "$3" "$5" | grep -v -E '^(BEGIN|SET|ROLLBACK|COMMIT)$' | tail -1 | tr -d '\r')
  if [ "$out" = "$4" ]; then ok=$((ok+1)); echo "  OK    $1"; else fail=$((fail+1)); echo "  FAIL  $1  (otrzymano: $out, oczekiwano: $4)"; fi; }
err() { out=$(run "$2" "$3"); if echo "$out" | grep -qiE "$4"; then ok=$((ok+1)); echo "  OK    $1"; else fail=$((fail+1)); echo "  FAIL  $1  →  $(echo "$out" | tail -1)"; fi; }
sys() { $PSQL -v ON_ERROR_STOP=1 -c "$1" >/dev/null 2>&1 || echo "  (sys błąd)"; }

echo; echo "[I-31] SEFS hybrid_min (progi TESTOWE)"

# Mini-tabela testowa: SEK 23→1.14, PLN 7.4→1.17
sys "begin; set local request.jwt.claim.sub='$HHL'; set local role authenticated;
  select sefs_save_parameters('$P', jsonb_build_object(
    'valid_from','2026-09-28',
    'base_sek',19.47,'base_pln',5.698,
    'index_sek','OKQ8_TEST','index_pln','ORLEN_TEST',
    'source_url_sek','https://www.okq8.se/foretag/priser/',
    'source_url_pln','https://www.orlen.pl/pl/dla-biznesu/hurtowe-ceny-paliw',
    'cycle','WEEKLY',
    'tiers_sek', jsonb_build_array(
      jsonb_build_object('lte',19.47,'mult',1.00),
      jsonb_build_object('lte',23.0,'mult',1.13),
      jsonb_build_object('lte',23.1,'mult',1.14),
      jsonb_build_object('lte',30.0,'mult',1.20)
    ),
    'tiers_pln', jsonb_build_array(
      jsonb_build_object('lte',5.698,'mult',1.00),
      jsonb_build_object('lte',7.40,'mult',1.16),
      jsonb_build_object('lte',7.50,'mult',1.17),
      jsonb_build_object('lte',10.0,'mult',1.30)
    ),
    'note','I-31 test'
  )); commit"

# D-1322: lte = próg „od”; 23.05 → 1,13 (wiersz 23,0), nie 1,14
val "lookup na progu (od)" $HHL "select sefs_lookup_mult(23.1, (select tiers_sek from sefs_parameters where project_id='$P' order by version desc limit 1))" "1.14"
val "lookup 23,05 → 1,13 (od progu)" $HHL "select sefs_lookup_mult(23.05, (select tiers_sek from sefs_parameters where project_id='$P' order by version desc limit 1))" "1.13"
val "hybrid 23.05/7.41 → 1.13" $HHL "select sefs_compute_hybrid('$P',23.05,7.41)->>'applied_mult'" "1.13"
val "over_table flaga przy SEK powyżej" $HHL "select sefs_compute_hybrid('$P',99,7.41)->>'over_table_sek'" "true"
err "KSH nie liczy SEFS" $KSH "select sefs_compute_hybrid('$P',23.05,7.41)" "wyłącznie HHL"

# Dzienne odczyty poprzedniego tygodnia względem załadunku 2026-10-05 (pon) → prev 28.09–04.10
sys "insert into fuel_index_readings (project_id, index_code, period, reading_date, value, source_url, source_note)
  select '22222222-0000-0000-0000-000000000001', 'SEK', to_char(d,'YYYY-MM-DD'), d, 23.05,
         'https://www.okq8.se/foretag/priser/', 'I-31 test'
    from generate_series('2026-09-28'::date, '2026-10-04'::date, '1 day') d
  on conflict do nothing"
sys "insert into fuel_index_readings (project_id, index_code, period, reading_date, value, source_url, source_note)
  select '22222222-0000-0000-0000-000000000001', 'PLN', to_char(d,'YYYY-MM-DD'), d, 7.41,
         'https://www.orlen.pl/pl/dla-biznesu/hurtowe-ceny-paliw', 'I-31 test'
    from generate_series('2026-09-28'::date, '2026-10-04'::date, '1 day') d
  on conflict do nothing"

# D-1300: n_sek=7; D-1322: 23.05 → 1,13
val "sefs_week_for_load 2026-10-05 → 1.13" $HHL "select sefs_week_for_load('$P','2026-10-05')->>'applied_mult'" "1.13"
ROLE=postgres val "awaria źródła bez odczytów (tydzień zamknięty)" $HHL "select sefs_week_calc('$P','2026-11-02','2026-11-03')->>'reason'" "SOURCE_FAILURE"


# SEFS-KOREKTA (0166) + D-1300: korekta 28.09 23.05→29.00 wchodzi w cenę dnia 28.09; n_sek zostaje 7
sys "insert into fuel_index_readings (project_id, index_code, period, reading_date, value, source_url, source_note, corrects_id, correction_reason)
  select r.project_id, r.index_code, r.period, r.reading_date, 29.00, r.source_url, 'korekta test 0166', r.id, 'SEFS-KOREKTA test'
    from fuel_index_readings r
   where r.project_id='22222222-0000-0000-0000-000000000001' and r.index_code='SEK' and r.period='2026-09-28' and r.corrects_id is null
     and not exists (select 1 from fuel_index_readings c where c.corrects_id=r.id)"
val "korekta: nadal 7 dni SEK (D-1300)" $HHL "select (sefs_week_for_load('$P','2026-10-05')->>'n_sek')::int" "7"
# bez korekty avg=23.05 → 1.13; z korektą 29 w dniu 28.09 średnia rośnie → inny próg
val "korekta wchodzi do średniej (mnożnik ≠ 1.13)" $HHL "select case when (sefs_week_for_load('$P','2026-10-05')->>'applied_mult') = '1.13' then 'same' else 'changed' end" "changed"
val "historia korekty zapisana" $HHL "select count(*)::text from fuel_index_readings where corrects_id is not null and correction_reason='SEFS-KOREKTA test'" "1"

echo; echo "WYNIK: $ok OK, $fail FAIL"
[ "$fail" -eq 0 ]
