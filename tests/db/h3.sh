#!/usr/bin/env bash
# H-3 — podświetlenie tylko dla wymiarów transportu. Puste wymiary = brak danych.
# H-1 zostaje wyłączone. Surowy zapis HERE gaśnie po 30 dniach, podsumowanie zostaje.
. "$(git rev-parse --show-toplevel)/tests/db/refuse-prod.sh"
PSQL="psql ${PGURL:-postgres://postgres@localhost:5433/tower} -Atq"
HHL=11111111-0000-0000-0000-000000000001
KSH=11111111-0000-0000-0000-000000000002
SCX=11111111-0000-0000-0000-000000000003
L=33333333-0000-0000-0000-000000000001
P=22222222-0000-0000-0000-000000000001
ok=0; fail=0
sys() { $PSQL -v ON_ERROR_STOP=1 -c "$1" 2>&1; }
val() {
  out=$(sys "$2" | grep -v -E '^(BEGIN|SET|ROLLBACK|COMMIT)$' | tail -1)
  if [ "$out" = "$3" ]; then ok=$((ok+1)); echo "  OK    $1"; else fail=$((fail+1)); echo "  FAIL  $1 (otrzymano: $out, oczekiwano: $3)"; fi
}
asuser() {
  $PSQL -v ON_ERROR_STOP=1 -c "begin; select set_config('request.jwt.claim.sub','$1',true); set local role authenticated; $2; commit;" 2>&1 \
    | grep -v -E '^(BEGIN|SET|COMMIT)$' | tail -1
}

echo; echo "[h3] przeszkody wzdłuż korytarza"
val "flaga H-1 nadal wyłączona" "select enabled::text from security_flags where key='H1_ROUTE_CHECK'" "false"
val "flaga H-3 jest wyłączona" "select enabled::text from security_flags where key='H3_CORRIDOR_OBSTACLES'" "false"
val "funkcja H-3 zwraca fałsz" "select h3_corridor_enabled()::text" "false"
err() {
  out=$(sys "$2")
  if echo "$out" | grep -qiE "$3"; then ok=$((ok+1)); echo "  OK    $1"; else fail=$((fail+1)); echo "  FAIL  $1 → $(echo "$out" | tail -1)"; fi
}
err "konto nie włącza H-3" "begin; select set_config('request.jwt.claim.sub','$HHL',true); set local role authenticated; update security_flags set enabled=true where key='H3_CORRIDOR_OBSTACLES'; rollback;" "permission denied"
val "anon nie woła podświetlenia" "select has_function_privilege('anon','h3_highlighted(uuid)','execute')::text" "false"
val "authenticated woła podświetlenie" "select has_function_privilege('authenticated','h3_highlighted(uuid)','execute')::text" "true"
val "wyłączone, zanim są wymiary" "select h3_highlighted('$L')->>'status'" "wylaczone"

sys "insert into vessels (id, name, operator) values ('77777777-0000-0000-0000-000000000073','H3 test','test') on conflict (id) do nothing" >/dev/null
sys "insert into sailings (id, project_id, vessel_id, route, departure_at, arrival_at, source) values ('88888888-0000-0000-0000-000000000083','$P','77777777-0000-0000-0000-000000000073','GDN-NYN','2026-11-01 08:00+00','2026-11-01 18:00+00','RECZNIE') on conflict (id) do nothing" >/dev/null
sys "update loads set sailing_id='88888888-0000-0000-0000-000000000083', combo_height_m=4.50, combo_width_m=3.00, combo_length_m=22, combo_weight_t=60, combo_axle_count=8, combo_axle_load_t=10 where id='$L'" >/dev/null

val "wyłączone mimo wymiarów" "select h3_highlighted('$L')->>'status'" "wylaczone"
sys "update security_flags set enabled=true where key='H3_CORRIDOR_OBSTACLES'" >/dev/null
val "katalog pusty to brak danych" "select h3_highlighted('$L')->>'status'" "brak_danych"

ITEMS='[{"linkId":"m1","kind":"most","place":"Most na Warcie","lat":52.1,"lng":17.0,"maxHeightCm":400,"maxWeightKg":80000},{"linkId":"w1","kind":"wiadukt","place":"Wiadukt S5","lat":52.4,"lng":17.2,"maxHeightCm":500},{"linkId":"t1","kind":"tunel","place":"Tunel","lat":54.3,"lng":18.5,"maxHeightCm":460},{"linkId":"o1","kind":"ograniczenie","place":"DK11","lat":52.2,"lng":17.1,"maxWeightKg":40000}]'
sys "select h3_replace_leg('PL-GDN', now(), 'ok', 'Przeszkody wzdłuż korytarza: 4.', true, '$ITEMS'::jsonb, '{\"zrodlo\":\"test\"}'::jsonb)" >/dev/null
sys "select h3_replace_leg('SE-NYN', now(), 'ok', 'Brak danych', true, '[]'::jsonb, null)" >/dev/null

val "podświetlone są tylko przekroczone limity" "select h3_highlighted('$L')->>'status'" "podswietlone"
val "most 400 cm i limit 40 t, bez wiaduktu 500 cm" "select (select string_agg(x->>'place', ',' order by x->>'place') from jsonb_array_elements(h3_highlighted('$L')->'items') x)" "DK11,Most na Warcie"
val "limit mostu po polsku" "select (select x->>'limitText' from jsonb_array_elements(h3_highlighted('$L')->'items') x where x->>'place'='Most na Warcie')" "400 cm wysokości"

out=$(asuser "$HHL" "select h3_highlighted('$L')->>'status'")
if [ "$out" = "podswietlone" ]; then ok=$((ok+1)); echo "  OK    HHL widzi podświetlenie"; else fail=$((fail+1)); echo "  FAIL  HHL widzi podświetlenie (otrzymano: $out)"; fi
out=$(asuser "$KSH" "select h3_highlighted('$L')->>'status'")
if [ "$out" = "podswietlone" ]; then ok=$((ok+1)); echo "  OK    KSH widzi podświetlenie swojego transportu"; else fail=$((fail+1)); echo "  FAIL  KSH (otrzymano: $out)"; fi
out=$(asuser "$SCX" "select h3_highlighted('$L')->>'status'")
if [ "$out" = "podswietlone" ]; then ok=$((ok+1)); echo "  OK    przewoźnik widzi podświetlenie"; else fail=$((fail+1)); echo "  FAIL  przewoźnik (otrzymano: $out)"; fi

sys "update loads set combo_height_m=3.80, combo_weight_t=30, combo_axle_load_t=8 where id='$L'" >/dev/null
val "zestaw mieści się w limitach" "select h3_highlighted('$L')->>'status'" "bez_przeszkod"

sys "update corridor_fetches set raw_response='{\"n\":1}'::jsonb, raw_expires_at=now()-interval '1 day', summary='zostaje' where leg='PL-GDN'" >/dev/null
val "surowe dane starsze niż 30 dni są kasowane" "select purge_here_corridor_raw(now())::text" "1"
val "podsumowanie zostaje" "select summary from corridor_fetches where leg='PL-GDN'" "zostaje"
val "przeszkoda zostaje" "select count(*)::text from corridor_obstacles where leg='PL-GDN'" "4"

sys "update security_flags set enabled=false where key='H3_CORRIDOR_OBSTACLES'" >/dev/null
val "po teście flaga H-3 znowu wyłączona" "select enabled::text from security_flags where key='H3_CORRIDOR_OBSTACLES'" "false"
sys "update loads set sailing_id=null, combo_height_m=null, combo_width_m=null, combo_length_m=null, combo_weight_t=null, combo_axle_count=null, combo_axle_load_t=null where id='$L'" >/dev/null
sys "delete from corridor_obstacles; delete from corridor_fetches; delete from sailings where id='88888888-0000-0000-0000-000000000083'; delete from vessels where id='77777777-0000-0000-0000-000000000073'" >/dev/null

echo; echo "WYNIK: $ok OK, $fail FAIL"
[ "$fail" -eq 0 ]
