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
# #460: wywołanie (nie tylko privilege) — 0258 miało 42702 ambiguous vessel_id w CTE u
# source: tylko DIGITRAFFIC / AISSTREAM / STENA (0159) — 'AIS' pada na CHECK i daje 0 wierszy.
HHL_BM=11111111-0000-0000-0000-000000000001
V460=55555555-0000-0000-0000-00000000460a
sys "insert into vessels (id, name, operator, mmsi) values ('$V460','M/F Test 460','Polferries',999460001) on conflict (id) do update set name=excluded.name, mmsi=excluded.mmsi" >/dev/null
sys "delete from vessel_positions where vessel_id='$V460'" >/dev/null
sys "insert into vessel_positions (vessel_id, lat, lon, sog_kn, cog, observed_at, source) values ('$V460', 54.4, 18.7, 12, 10, now(), 'AISSTREAM')" >/dev/null
o=$(sys "begin; set local role authenticated; set local request.jwt.claim.sub='$HHL_BM'; select count(*) from ferry_track_sample(); commit;" | grep -v -E '^(BEGIN|SET|COMMIT|ROLLBACK)$' | tail -1)
if [ "$o" -ge 1 ] 2>/dev/null; then ok=$((ok+1)); echo "  OK    ferry_track_sample() authenticated ≥ 1 (#460)"; else fail=$((fail+1)); echo "  FAIL  ferry_track_sample() → $o (oczekiwano ≥ 1)"; fi
# #421/#429: ferry_sailings_map — departed_at/arrived_at + porty + AIS bez filtra świeżości
val "anon nie czyta ferry_sailings_map" "select has_function_privilege('anon','ferry_sailings_map()','execute')::text" "false"
val "zalogowany czyta ferry_sailings_map" "select has_function_privilege('authenticated','ferry_sailings_map()','execute')::text" "true"
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
# H-2-PL: osobna pula traffic
val "pule potwierdzone source tiles" "select source from app_parameters where key='HERE_TILES_FREE'" "konto HERE właściciela, 05.10"
val "pule potwierdzone source routes" "select source from app_parameters where key='HERE_ROUTES_FREE'" "konto HERE właściciela, 05.10"
val "label tiles bez wstępna" "select (label not ilike '%wstępna%')::text from app_parameters where key='HERE_TILES_FREE'" "true"
val "pula traffic w parametrach" "select value::text from app_parameters where key='HERE_TRAFFIC_FREE'" "5000"
val "traffic w puli koszt 0" "select here_note_service('traffic', 5000, 0, '2026-10-05 12:00+02'); select estimated_usd::text from here_usage where month='2026-10-01' and service='traffic'" "0.0000"
val "traffic ponad pulę liczy stawkę" "select here_note_service('traffic', 1, 0, '2026-10-05 12:05+02'); select estimated_usd::text from here_usage where month='2026-10-01' and service='traffic'" "0.0029"

# AUD-01d: przeglądarka zgłasza zbiorczo kafelki HERE (klucz przeglądarkowy) → here_usage.tiles
KSH=11111111-0000-0000-0000-000000000002
asu() { $PSQL -v ON_ERROR_STOP=1 -c "begin; set local role authenticated; set local request.jwt.claim.sub='$1'; $2; commit;" 2>&1 | grep -v -E '^(BEGIN|SET|COMMIT|ROLLBACK|CONTEXT:.*)$' | tail -1; }
val "anon nie zgłasza kafelków" "select has_function_privilege('anon','here_tiles_report(integer)','execute')::text" "false"
val "zalogowany zgłasza kafelki" "select has_function_privilege('authenticated','here_tiles_report(integer)','execute')::text" "true"
val "okno zgłoszeń niedostępne dla konta" "select has_table_privilege('authenticated','here_tile_reports','select')::text" "false"
sys "update app_parameters set value=100000000 where key='HERE_TILES_FREE'" >/dev/null
b=$(sys "select coalesce((select requests from here_usage where month=(date_trunc('month', now() at time zone 'Europe/Warsaw'))::date and service='tiles'),0)")
o=$(asu "$KSH" "select here_tiles_report(40)->>'tiles_open'")
a=$(sys "select requests from here_usage where month=(date_trunc('month', now() at time zone 'Europe/Warsaw'))::date and service='tiles'")
if [ "$o" = "true" ] && [ "$a" = "$((b+40))" ]; then ok=$((ok+1)); echo "  OK    zgłoszenie 40 kafelków → here_usage.tiles +40, tiles_open"; else fail=$((fail+1)); echo "  FAIL  zgłoszenie kafelków ($b → $a, $o)"; fi
o=$(asu "$KSH" "select here_tiles_report(0)->>'tiles_open'"); [ "$o" = "true" ] && { ok=$((ok+1)); echo "  OK    zgłoszenie 0 → stan budżetu"; } || { fail=$((fail+1)); echo "  FAIL  zgłoszenie 0 → $o"; }
o=$(asu "$KSH" "select here_tiles_report(5001)"); echo "$o" | grep -q "Zła liczba" && { ok=$((ok+1)); echo "  OK    > 5000 na wywołanie odrzucone"; } || { fail=$((fail+1)); echo "  FAIL  > 5000 → $o"; }
o=$(asu "$KSH" "select here_tiles_report(-1)"); echo "$o" | grep -q "Zła liczba" && { ok=$((ok+1)); echo "  OK    ujemne odrzucone"; } || { fail=$((fail+1)); echo "  FAIL  ujemne → $o"; }
o=$(asu "$KSH" "select here_tiles_report(5000); select here_tiles_report(5000); select here_tiles_report(5000); select here_tiles_report(5000)"); echo "$o" | grep -q "Za dużo" && { ok=$((ok+1)); echo "  OK    > 20000 na minutę na konto odrzucone"; } || { fail=$((fail+1)); echo "  FAIL  limit minutowy → $o"; }
o=$(asu "99999999-0000-0000-0000-000000000009" "select here_tiles_report(1)"); echo "$o" | grep -q "Brak aktywnego konta" && { ok=$((ok+1)); echo "  OK    bez konta odmowa"; } || { fail=$((fail+1)); echo "  FAIL  bez konta → $o"; }
sys "update app_parameters set value=0 where key='HERE_TILES_FREE'; update app_parameters set value=1 where key='HERE_TILES_RATE_USD'" >/dev/null
# Wydatek bieżącego miesiąca ≥ 80% budżetu niezależnie od daty uruchomienia (wcześniejsze zapisy mają daty z października 2026).
sys "select here_note_service('tiles', 80, 0, now())" >/dev/null
o=$(asu "11111111-0000-0000-0000-000000000003" "select here_tiles_report(1)->>'tiles_open'"); [ "$o" = "false" ] && { ok=$((ok+1)); echo "  OK    od 80% budżetu zgłoszenie zwraca tiles_open=false (zapas)"; } || { fail=$((fail+1)); echo "  FAIL  80% → $o"; }

# #465: wywołanie RPC mapy/Stanu jako authenticated (lekcja 42702 z 0258 — privilege ≠ działa).
# Lista 26: 8 RPC × HHL/KSH/SCX + here_budget_view/deepl_usage_view tylko HHL.
echo; echo "[#465] RPC mapy i Stanu systemu — wywołanie jako zalogowany"
sys "update app_parameters set value=30000 where key='HERE_TILES_FREE'; update app_parameters set value=0.0002 where key='HERE_TILES_RATE_USD'" >/dev/null
HHL_465=11111111-0000-0000-0000-000000000001
KSH_465=11111111-0000-0000-0000-000000000002
SCX_465=11111111-0000-0000-0000-000000000003
L_465=33333333-0000-0000-0000-000000000001
rpc_ok() {
  # $1 etykieta, $2 auth_id, $3 SQL — brak ERROR/42702 = OK
  out=$($PSQL -v ON_ERROR_STOP=1 -c "begin; set local role authenticated; set local request.jwt.claim.sub='$2'; select set_config('request.jwt.claims', json_build_object('sub','$2','role','authenticated')::text, true); $3; commit;" 2>&1)
  if echo "$out" | grep -qiE 'ERROR:|42702|ambiguous|undefined_(column|function)'; then
    fail=$((fail+1)); echo "  FAIL  $1 → $(echo "$out" | grep -iE 'ERROR:|42702' | head -1)"
  else
    ok=$((ok+1)); echo "  OK    $1"
  fi
}
for role_pair in "HHL:$HHL_465" "KSH:$KSH_465" "SCX:$SCX_465"; do
  R=${role_pair%%:*}; U=${role_pair##*:}
  rpc_ok "#465 $R ferry_track_sample" "$U" "select count(*) from ferry_track_sample()"
  rpc_ok "#465 $R ferry_sailings_map" "$U" "select count(*) from ferry_sailings_map()"
  rpc_ok "#465 $R map_display_state" "$U" "select map_display_state() is not null"
  rpc_ok "#465 $R latest_vehicle_fixes" "$U" "select count(*) from latest_vehicle_fixes('{}'::uuid[])"
  rpc_ok "#465 $R here_tiles_report(0)" "$U" "select here_tiles_report(0) is not null"
  rpc_ok "#465 $R h1_route_check_state" "$U" "select h1_route_check_state() is not null"
  rpc_ok "#465 $R h3_corridor_state" "$U" "select h3_corridor_state() is not null"
  rpc_ok "#465 $R load_track" "$U" "select count(*) from load_track('$L_465')"
done
rpc_ok "#465 HHL here_budget_view" "$HHL_465" "select here_budget_view() is not null"
rpc_ok "#465 HHL deepl_usage_view" "$HHL_465" "select deepl_usage_view() is not null"

echo; echo "WYNIK: $ok OK, $fail FAIL"
[ "$fail" -eq 0 ]
