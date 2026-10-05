#!/usr/bin/env bash
# B-MAPA — kafelki od 80%, geometria HERE 30 dni, H-6 wyłączone, H-1 i H-3 bez zmian.
. "$(git rev-parse --show-toplevel)/tests/db/refuse-prod.sh"
PSQL="psql ${PGURL:-postgres://postgres@localhost:5433/tower} -Atq"
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

echo; echo "[bmapa] podkład i budżet"
val "H-1 zostaje wyłączone" "select enabled::text from security_flags where key='H1_ROUTE_CHECK'" "false"
val "H-3 zostaje wyłączone" "select enabled::text from security_flags where key='H3_' || 'CORRIDOR_OBSTACLES'" "false"
val "H-6 jest wyłączone" "select enabled::text from security_flags where key='H6_MAP_OBSTACLES'" "false"
val "funkcja H-6 zwraca fałsz" "select h6_map_enabled()::text" "false"
val "anon nie czyta stanu mapy" "select has_function_privilege('anon','map_display_state()','execute')::text" "false"
val "zalogowany czyta stan mapy" "select has_function_privilege('authenticated','map_display_state()','execute')::text" "true"
val "anon nie bierze próbki promu" "select has_function_privilege('anon','ferry_track_sample()','execute')::text" "false"
val "zalogowany bierze próbkę promu" "select has_function_privilege('authenticated','ferry_track_sample()','execute')::text" "true"
err "zła usługa HERE odrzucona" "select here_note_service('spam', 1, 0, '2026-10-15 12:00+00')" "Zła usługa"
# D-78: koszt tylko ponad pulę — w teście zerujemy pulę kafelków i stawiamy stawkę 1 USD
sys "update app_parameters set value=0 where key='HERE_TILES_FREE'; update app_parameters set value=1 where key='HERE_TILES_RATE_USD'" >/dev/null
val "poniżej 80% kafelki są włączone" "select here_note_service('tiles', 50, 0, '2026-10-15 12:00+00'); select here_tiles_open('2026-10-20 12:00+00')::text" "true"
val "od 80% kafelki gasną do końca miesiąca" "select here_note_service('tiles', 30, 0, '2026-10-16 12:00+00'); select here_tiles_open('2026-10-20 12:00+00')::text" "false"
val "nowy miesiąc wraca na HERE" "select here_tiles_open('2026-11-02 12:00+00')::text" "true"
sys "update app_parameters set value=30000 where key='HERE_TILES_FREE'; update app_parameters set value=0.0002 where key='HERE_TILES_RATE_USD'" >/dev/null
val "zapis geometrii" "select here_store_road('PL-GDN', '[[52.07,17.02],[54.40,18.68]]'::jsonb, 'trasa drogowa Śrem–Gdańsk', now())" ""
val "podsumowanie zostaje w wierszu" "select summary from here_road_geometry where leg='PL-GDN'" "trasa drogowa Śrem–Gdańsk"
sys "update here_road_geometry set fetched_at = now() - interval '31 days' where leg='PL-GDN'" >/dev/null
val "geometria starsza niż 30 dni jest kasowana" "select purge_here_road_geometry(now())::text" "1"
val "podsumowanie zostaje po kasowaniu punktów" "select summary || ':' || coalesce(points::text,'null') from here_road_geometry where leg='PL-GDN'" "trasa drogowa Śrem–Gdańsk:null"
val "konto nie zapisuje geometrii HERE" "select has_function_privilege('authenticated','here_store_road(text,jsonb,text,timestamptz)','execute')::text" "false"

echo; echo "WYNIK: $ok OK, $fail FAIL"
[ "$fail" -eq 0 ]
