#!/usr/bin/env bash
# H-1 — kontrola trasy wyłączona, zezwolenie nie jest ryzykiem, surowe dane HERE gasną po 30 dniach.
. "$(git rev-parse --show-toplevel)/tests/db/refuse-prod.sh"
PSQL="psql ${PGURL:-postgres://postgres@localhost:5433/tower} -Atq"
HHL=11111111-0000-0000-0000-000000000001
KSH=11111111-0000-0000-0000-000000000002
SCX=11111111-0000-0000-0000-000000000003
L=33333333-0000-0000-0000-000000000001
ok=0; fail=0
sys() { $PSQL -v ON_ERROR_STOP=1 -c "$1" 2>&1; }
val() {
  out=$(sys "$2" | grep -v -E '^(BEGIN|SET|ROLLBACK|COMMIT)$' | tail -1)
  if [ "$out" = "$3" ]; then ok=$((ok+1)); echo "  OK    $1"; else fail=$((fail+1)); echo "  FAIL  $1 (otrzymano: $out, oczekiwano: $3)"; fi
}
err() {
  out=$(sys "$2")
  if echo "$out" | grep -qiE "$3"; then ok=$((ok+1)); echo "  OK    $1"; else fail=$((fail+1)); echo "  FAIL  $1 → $(echo "$out" | tail -1)"; fi
}
asuser() {
  $PSQL -v ON_ERROR_STOP=1 -c "begin; select set_config('request.jwt.claim.sub','$1',true); set local role authenticated; $2; commit;" 2>&1 \
    | grep -v -E '^(BEGIN|SET|COMMIT)$' | tail -1
}

echo; echo "[h1] kontrola trasy"
val "flaga H1 jest wyłączona" "select enabled::text from security_flags where key='H1_ROUTE_CHECK'" "false"
val "funkcja włączenia zwraca fałsz" "select h1_route_check_enabled()::text" "false"
val "osie transportu testowego są puste" "select (combo_axle_count is null and combo_axle_load_t is null)::text from loads where id='$L'" "true"
err "konto nie włącza kontroli" "begin; select set_config('request.jwt.claim.sub','$HHL',true); set local role authenticated; update security_flags set enabled=true where key='H1_ROUTE_CHECK'; rollback;" "permission denied"

val "zezwolenie nie tworzy ryzyka" "select h1_record_route_check('$L','PL', now(), 'k', 'ok', 'Kontrola trasy: brak przeszkody fizycznej. Wymaga zezwolenia: 1.', '[{\"kind\":\"zezwolenie\"}]'::jsonb, '[]'::jsonb, null); select count(*)::text from risk_signals where kind='ROUTE_OBSTACLE' and resolved_at is null" "0"

val "przeszkoda krytyczna jest dla HHL i przewoźnika" "select h1_record_route_check('$L','PL', now(), 'k2', 'ok', 'Kontrola trasy: 1 przeszkód fizycznych.', '[]'::jsonb, '[{\"place\":\"Wiadukt nad S5\",\"limitText\":\"410 cm wysokości\",\"setText\":\"450 cm\",\"critical\":true}]'::jsonb, null); select audience::text from risk_signals where kind='ROUTE_OBSTACLE' and resolved_at is null" "HHL_PRZEWOZNIK"

out=$(asuser "$HHL" "select count(*)::text from route_checks where load_id='$L'")
if [ "$out" = "2" ]; then ok=$((ok+1)); echo "  OK    HHL widzi kontrolę"; else fail=$((fail+1)); echo "  FAIL  HHL widzi kontrolę (otrzymano: $out)"; fi
out=$(asuser "$KSH" "select count(*)::text from route_checks where load_id='$L'")
if [ "$out" = "0" ]; then ok=$((ok+1)); echo "  OK    KSH nie widzi kontroli"; else fail=$((fail+1)); echo "  FAIL  KSH nie widzi kontroli (otrzymano: $out)"; fi
out=$(asuser "$SCX" "select count(*)::text from route_checks where load_id='$L'")
if [ "$out" = "2" ]; then ok=$((ok+1)); echo "  OK    przewoźnik widzi kontrolę"; else fail=$((fail+1)); echo "  FAIL  przewoźnik widzi kontrolę (otrzymano: $out)"; fi

val "pusta kontrola zamyka ryzyko przeszkody" "select h1_record_route_check('$L','PL', now(), 'k3', 'ok', 'Kontrola trasy: brak przeszkody fizycznej.', '[]'::jsonb, '[]'::jsonb, null); select count(*)::text from risk_signals where kind='ROUTE_OBSTACLE' and resolved_at is null" "0"

sys "insert into route_checks (load_id, leg, checked_at, dims_key, status, summary, raw_response, raw_expires_at) values ('$L','SE', now() - interval '40 days', 'stare', 'ok', 'stare podsumowanie', '{\"notices\":[1]}'::jsonb, now() - interval '10 days')" >/dev/null
val "surowe dane starsze niż 30 dni są kasowane" "select purge_here_route_raw(now())::text" "1"
val "podsumowanie zostaje" "select summary from route_checks where dims_key='stare'" "stare podsumowanie"
val "po kasacji nie ma surowych danych" "select (raw_response is null)::text from route_checks where dims_key='stare'" "true"
sys "insert into route_checks (load_id, leg, checked_at, dims_key, status, summary, raw_response, raw_expires_at) values ('$L','SE', now(), 'swieze', 'ok', 'swieze podsumowanie', '{\"notices\":[2]}'::jsonb, now() + interval '10 days')" >/dev/null
val "świeże surowe dane zostają" "select purge_here_route_raw(now()); select (raw_response is not null)::text from route_checks where dims_key='swieze'" "true"

echo; echo "WYNIK: $ok OK, $fail FAIL"
[ "$fail" -eq 0 ]
