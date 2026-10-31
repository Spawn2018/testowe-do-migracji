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
# F7 #474: pełna lista z audytu + rpc_denied (42501) dla funkcji tylko-HHL.
# 105 asercji: 24 mapowe (8×3) + 57 wspólnych (19×3) + 21 HHL-only (7× HHL ok + KSH/SCX denied) + 3 carrier_scorecard.
echo; echo "[#465] RPC mapy i Stanu systemu — wywołanie jako zalogowany"
sys "update app_parameters set value=30000 where key='HERE_TILES_FREE'; update app_parameters set value=0.0002 where key='HERE_TILES_RATE_USD'" >/dev/null
HHL_465=11111111-0000-0000-0000-000000000001
KSH_465=11111111-0000-0000-0000-000000000002
SCX_465=11111111-0000-0000-0000-000000000003
L_465=33333333-0000-0000-0000-000000000001
P_465=22222222-0000-0000-0000-000000000001
rpc_ok() {
  # $1 etykieta, $2 auth_id, $3 SQL — brak ERROR/42702 = OK
  out=$($PSQL -v ON_ERROR_STOP=1 -c "begin; set local role authenticated; set local request.jwt.claim.sub='$2'; select set_config('request.jwt.claims', json_build_object('sub','$2','role','authenticated')::text, true); $3; commit;" 2>&1)
  if echo "$out" | grep -qiE 'ERROR:|42702|ambiguous|undefined_(column|function)'; then
    fail=$((fail+1)); echo "  FAIL  $1 → $(echo "$out" | grep -iE 'ERROR:|42702' | head -1)"
  else
    ok=$((ok+1)); echo "  OK    $1"
  fi
}
rpc_denied() {
  # $1 etykieta, $2 auth_id, $3 SQL — oczekiwane 42501 (rola bez dostępu), nie 42702/undefined
  out=$($PSQL -v ON_ERROR_STOP=1 -c "begin; set local role authenticated; set local request.jwt.claim.sub='$2'; select set_config('request.jwt.claims', json_build_object('sub','$2','role','authenticated')::text, true); $3; commit;" 2>&1)
  if echo "$out" | grep -qiE '42702|ambiguous|undefined_(column|function)'; then
    fail=$((fail+1)); echo "  FAIL  $1 → błąd definicji zamiast 42501: $(echo "$out" | grep -iE 'ERROR:' | head -1)"
  elif echo "$out" | grep -qiE '42501|tylko HHL|wyłącznie HHL|Tylko administrator|wyłącznie dla HHL|widzi wyłącznie'; then
    ok=$((ok+1)); echo "  OK    $1 (42501)"
  else
    fail=$((fail+1)); echo "  FAIL  $1 → oczekiwano 42501, otrzymano: $(echo "$out" | grep -iE 'ERROR:|COMMIT' | head -1 | cut -c1-140)"
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
  rpc_ok "#465 $R system_broadcast_current" "$U" "select count(*) from system_broadcast_current()"
  rpc_ok "#465 $R email_budget_status" "$U" "select email_budget_status()"
  rpc_ok "#465 $R my_profile" "$U" "select count(*) from my_profile()"
  rpc_ok "#465 $R a7_permits_list" "$U" "select a7_permits_list() is not null"
  rpc_ok "#465 $R a7_policies_list" "$U" "select a7_policies_list() is not null"
  rpc_ok "#465 $R insurance_policies_list" "$U" "select count(*) from insurance_policies_list()"
  rpc_ok "#465 $R my_mfa_status" "$U" "select my_mfa_status() is not null"
  rpc_ok "#465 $R my_sessions" "$U" "select count(*) from my_sessions()"
  rpc_ok "#465 $R fee_catalog_hints" "$U" "select count(*) from fee_catalog_hints()"
  rpc_ok "#465 $R load_order_numbers" "$U" "select count(*) from load_order_numbers()"
  rpc_ok "#465 $R load_ready_gaps" "$U" "select count(*) from load_ready_gaps()"
  rpc_ok "#465 $R my_notify_get" "$U" "select my_notify_get() is not null"
  rpc_ok "#465 $R kpi_detection_lag" "$U" "select count(*) from kpi_detection_lag('$P_465')"
  rpc_ok "#465 $R load_insurance_cover" "$U" "select count(*) from load_insurance_cover('$P_465')"
  rpc_ok "#465 $R doc_requirements_status" "$U" "select count(*) from doc_requirements_status('$P_465')"
  rpc_ok "#465 $R load_permit_status" "$U" "select count(*) from load_permit_status()"
  rpc_ok "#465 $R load_driver_contacts" "$U" "select count(*) from load_driver_contacts()"
  rpc_ok "#465 $R load_escort_contacts" "$U" "select count(*) from load_escort_contacts()"
  rpc_ok "#465 $R list_load_messages_ui" "$U" "select count(*) from list_load_messages_ui()"
done
# Tylko HHL (KSH/SCX → 42501, nie inny błąd)
rpc_ok "#465 HHL security_flags_list" "$HHL_465" "select security_flags_list() is not null"
rpc_denied "#465 KSH security_flags_list" "$KSH_465" "select security_flags_list()"
rpc_denied "#465 SCX security_flags_list" "$SCX_465" "select security_flags_list()"
rpc_ok "#465 HHL csp_status_view" "$HHL_465" "select csp_status_view() is not null"
rpc_denied "#465 KSH csp_status_view" "$KSH_465" "select csp_status_view()"
rpc_denied "#465 SCX csp_status_view" "$SCX_465" "select csp_status_view()"
rpc_ok "#465 HHL sms_external_messaging_state" "$HHL_465" "select sms_external_messaging_state() is not null"
rpc_denied "#465 KSH sms_external_messaging_state" "$KSH_465" "select sms_external_messaging_state()"
rpc_denied "#465 SCX sms_external_messaging_state" "$SCX_465" "select sms_external_messaging_state()"
rpc_ok "#465 HHL permit_requirement_state" "$HHL_465" "select permit_requirement_state() is not null"
rpc_denied "#465 KSH permit_requirement_state" "$KSH_465" "select permit_requirement_state()"
rpc_denied "#465 SCX permit_requirement_state" "$SCX_465" "select permit_requirement_state()"
rpc_ok "#465 HHL admin_auth_login_log" "$HHL_465" "select count(*) from admin_auth_login_log(5)"
rpc_denied "#465 KSH admin_auth_login_log" "$KSH_465" "select count(*) from admin_auth_login_log(5)"
rpc_denied "#465 SCX admin_auth_login_log" "$SCX_465" "select count(*) from admin_auth_login_log(5)"
rpc_ok "#465 HHL here_budget_view" "$HHL_465" "select here_budget_view() is not null"
rpc_denied "#465 KSH here_budget_view" "$KSH_465" "select here_budget_view()"
rpc_denied "#465 SCX here_budget_view" "$SCX_465" "select here_budget_view()"
rpc_ok "#465 HHL deepl_usage_view" "$HHL_465" "select deepl_usage_view() is not null"
rpc_denied "#465 KSH deepl_usage_view" "$KSH_465" "select deepl_usage_view()"
rpc_denied "#465 SCX deepl_usage_view" "$SCX_465" "select deepl_usage_view()"
# carrier_scorecard: HHL + SCX OK, KSH 42501
rpc_ok "#465 HHL carrier_scorecard" "$HHL_465" "select count(*) from carrier_scorecard()"
rpc_denied "#465 KSH carrier_scorecard" "$KSH_465" "select count(*) from carrier_scorecard()"
rpc_ok "#465 SCX carrier_scorecard" "$SCX_465" "select count(*) from carrier_scorecard()"

# #572 BN0 / F7 #585 r3: SE_KAA_TRACK; retry_after; N3 start po Verkö; NOWE-3
echo; echo "[#572] BN0 SE-KAA / SE_KAA_TRACK"
val "anon nie czyta here_corridor_points" "select has_function_privilege('anon','here_corridor_points(text)','execute')::text" "false"
val "authenticated nie czyta here_corridor_points" "select has_function_privilege('authenticated','here_corridor_points(text)','execute')::text" "false"
val "anon nie czyta here_corridor_via_points" "select has_function_privilege('anon','here_corridor_via_points(text,integer)','execute')::text" "false"
val "authenticated nie czyta here_corridor_via_points" "select has_function_privilege('authenticated','here_corridor_via_points(text,integer)','execute')::text" "false"
val "anon nie czyta here_road_corridor_dev_m" "select has_function_privilege('anon','here_road_corridor_dev_m(text,text)','execute')::text" "false"
val "anon nie woła rebuild_se_kaa_track" "select has_function_privilege('anon','rebuild_se_kaa_track(uuid)','execute')::text" "false"
val "authenticated nie woła rebuild_se_kaa_track" "select has_function_privilege('authenticated','rebuild_se_kaa_track(uuid)','execute')::text" "false"
# Fikcyjny korytarz inland (nie GPS kierowcy) — segmentize → ≥50 wierzchołków
sys "insert into corridor_polylines (code, geom, total_km, source, updated_at)
     values (
       'SE_KAA_TRACK',
       st_segmentize(st_setsrid(st_makeline(array[
         st_makepoint(15.63, 56.17), st_makepoint(16.05, 56.50), st_makepoint(16.40, 57.00),
         st_makepoint(16.50, 57.50), st_makepoint(16.45, 58.00), st_makepoint(16.18, 58.59),
         st_makepoint(16.30, 59.00), st_makepoint(16.54, 59.61), st_makepoint(16.80, 60.00),
         st_makepoint(17.10, 60.70), st_makepoint(17.20, 61.50), st_makepoint(17.40, 62.40),
         st_makepoint(18.50, 63.20), st_makepoint(20.20, 63.80), st_makepoint(21.00, 64.70),
         st_makepoint(21.50, 65.30), st_makepoint(21.76, 65.81)
       ]), 4326), 0.05),
       1400,
       'fixture CI #572 F7 (nie GPS)',
       now()
     )
     on conflict (code) do update
       set geom = excluded.geom, total_km = excluded.total_km, source = excluded.source, updated_at = now()" >/dev/null
sys "update corridor_polylines set total_km = round((st_length(geom::geography)/1000.0)::numeric,2) where code='SE_KAA_TRACK'" >/dev/null
e22_before=$(sys "select st_astext(geom) from corridor_polylines where code='SE_E22'")
n_pts=$(sys "select jsonb_array_length(here_corridor_points('SE_KAA_TRACK'))")
if [ "$n_pts" -ge 50 ] 2>/dev/null; then ok=$((ok+1)); echo "  OK    here_corridor_points(SE_KAA_TRACK) ≥ 50 ($n_pts)"; else fail=$((fail+1)); echo "  FAIL  here_corridor_points → $n_pts"; fi
n_via=$(sys "select jsonb_array_length(here_corridor_via_points('SE_KAA_TRACK', 14))")
if [ "$n_via" -ge 5 ] 2>/dev/null && [ "$n_via" -le 14 ] 2>/dev/null; then ok=$((ok+1)); echo "  OK    here_corridor_via_points 5–14 ($n_via)"; else fail=$((fail+1)); echo "  FAIL  via_points → $n_via"; fi
# Linia = wierzchołki SE_KAA_TRACK → odchyłka 0; 4 legi
sys "select here_store_road('SE-KAA', here_corridor_points('SE_KAA_TRACK'), 'trasa Karlskrona–Boden (test #572)', now())" >/dev/null
sys "select here_store_road('PL-GDN', '[[52.07,17.02],[52.53,17.6],[53.41,18.45],[54.40,18.68]]'::jsonb, 'PL-GDN test #572', now())" >/dev/null
sys "select here_store_road('SE-NYN', '[[58.90,17.95],[60.67,17.14],[62.39,17.31],[65.80,21.76]]'::jsonb, 'SE-NYN test #572', now())" >/dev/null
sys "select here_store_road('PL-GDY', '[[52.07,17.02],[53.5,18.0],[54.53,18.54]]'::jsonb, 'PL-GDY test #572', now())" >/dev/null
dev_m=$(sys "select coalesce(here_road_corridor_dev_m('SE-KAA','SE_KAA_TRACK')::text,'null')")
awk "BEGIN{exit !($dev_m+0 <= 2000)}" 2>/dev/null && { ok=$((ok+1)); echo "  OK    SE-KAA odchyłka ↔ SE_KAA_TRACK ≤ 2 km ($dev_m m)"; } || { fail=$((fail+1)); echo "  FAIL  odchyłka → $dev_m"; }
sys "select here_store_road('SE-KAA', '[[56.1646,15.6308],[65.80539,21.75914]]'::jsonb, 'cięciwa #572', now())" >/dev/null
dev_bad=$(sys "select coalesce(here_road_corridor_dev_m('SE-KAA','SE_KAA_TRACK')::text,'null')")
awk "BEGIN{exit !($dev_bad+0 > 2000)}" 2>/dev/null && { ok=$((ok+1)); echo "  OK    cięciwa SE-KAA > 2 km od SE_KAA_TRACK ($dev_bad m)"; } || { fail=$((fail+1)); echo "  FAIL  cięciwa odchyłka → $dev_bad"; }
sys "select here_store_road('SE-KAA', (
  select jsonb_agg(jsonb_build_array((p->>0)::float8, (p->>1)::float8 + 0.18) order by ord)
    from jsonb_array_elements(here_corridor_points('SE_KAA_TRACK')) with ordinality as t(p, ord)
), 'równoległa #572', now())" >/dev/null
dev_par=$(sys "select coalesce(here_road_corridor_dev_m('SE-KAA','SE_KAA_TRACK')::text,'null')")
awk "BEGIN{exit !($dev_par+0 > 2000)}" 2>/dev/null && { ok=$((ok+1)); echo "  OK    równoległa 10 km > 2 km ($dev_par m)"; } || { fail=$((fail+1)); echo "  FAIL  równoległa → $dev_par"; }
sys "select here_store_road('SE-KAA', here_corridor_points('SE_KAA_TRACK'), 'trasa Karlskrona–Boden (test #572)', now())" >/dev/null
fetched_before=$(sys "select fetched_at::text from here_road_geometry where leg='SE-KAA'")
sys "select here_store_road('SE-KAA', null, 'odrzut #572 — zostaw punkty', now() + interval '24 hours')" >/dev/null
keep=$(sys "select (points is not null and jsonb_array_length(points) >= 2)::text from here_road_geometry where leg='SE-KAA'")
[ "$keep" = "true" ] && { ok=$((ok+1)); echo "  OK    here_store_road(null) zostawia points"; } || { fail=$((fail+1)); echo "  FAIL  null kasuje points → $keep"; }
sum=$(sys "select summary from here_road_geometry where leg='SE-KAA'")
[ "$sum" = "odrzut #572 — zostaw punkty" ] && { ok=$((ok+1)); echo "  OK    summary po odrzuceniu"; } || { fail=$((fail+1)); echo "  FAIL  summary → $sum"; }
fetched_after=$(sys "select fetched_at::text from here_road_geometry where leg='SE-KAA'")
[ "$fetched_before" = "$fetched_after" ] && { ok=$((ok+1)); echo "  OK    odrzut nie cofa fetched_at (NOWE-1/2)"; } || { fail=$((fail+1)); echo "  FAIL  fetched_at zmienione"; }
retry_set=$(sys "select (retry_after is not null and retry_after > now())::text from here_road_geometry where leg='SE-KAA'")
[ "$retry_set" = "true" ] && { ok=$((ok+1)); echo "  OK    retry_after ustawione po odrzuceniu"; } || { fail=$((fail+1)); echo "  FAIL  retry_after → $retry_set"; }
sys "select here_store_road('SE-KAA', here_corridor_points('SE_KAA_TRACK'), 'trasa Karlskrona–Boden (test #572)', now())" >/dev/null
retry_clr=$(sys "select (retry_after is null)::text from here_road_geometry where leg='SE-KAA'")
[ "$retry_clr" = "true" ] && { ok=$((ok+1)); echo "  OK    sukces czyści retry_after"; } || { fail=$((fail+1)); echo "  FAIL  retry_after po sukcesie → $retry_clr"; }
# #667 E / DP-23: po 0355 roads = core(5)+BN7(7) = 12 (także points=null).
legs=$(asu "$HHL_465" "select jsonb_array_length(map_display_state()->'roads')")
if [ "$legs" = "12" ]; then ok=$((ok+1)); echo "  OK    map_display_state().roads = 12 (core+BN7, także bez punktów)"; else fail=$((fail+1)); echo "  FAIL  roads length → $legs"; fi
kaa=$(asu "$HHL_465" "select exists(select 1 from jsonb_array_elements(map_display_state()->'roads') e where e->>'leg'='SE-KAA' and jsonb_array_length(e->'points')>=2)::text")
[ "$kaa" = "true" ] && { ok=$((ok+1)); echo "  OK    roads zawiera SE-KAA z punktami"; } || { fail=$((fail+1)); echo "  FAIL  SE-KAA w roads → $kaa"; }
# F7 r5 uwaga 4: SE-KAA-INLAND w roads z points=null + summary (przed store poniżej).
# jsonb_build_object(…, NULL) → JSON null; (e->'points') IS NULL jest wtedy false — typeof.
inland_null=$(asu "$HHL_465" "select exists(select 1 from jsonb_array_elements(map_display_state()->'roads') e where e->>'leg'='SE-KAA-INLAND' and jsonb_typeof(e->'points') = 'null' and coalesce(e->>'summary','') <> '')::text")
[ "$inland_null" = "true" ] && { ok=$((ok+1)); echo "  OK    roads: SE-KAA-INLAND points=null + summary"; } || { fail=$((fail+1)); echo "  FAIL  SE-KAA-INLAND null+summary → $inland_null"; }
e22_after=$(sys "select st_astext(geom) from corridor_polylines where code='SE_E22'")
[ "$e22_before" = "$e22_after" ] && { ok=$((ok+1)); echo "  OK    SE_E22 bez zmian (N8)"; } || { fail=$((fail+1)); echo "  FAIL  SE_E22 nadpisane"; }

# #667 B: druga noga SE-KAA-INLAND + zapis z SE_E22 / SE_KAA_INLAND
echo; echo "[#667] B SE-KAA dual (E22 + inland)"
sys "select here_store_road('SE-KAA-INLAND', here_corridor_points('SE_KAA_INLAND'), 'trasa Karlskrona–Boden śródlądowa (test #667)', now())" >/dev/null
inland_ok=$(sys "select (points is not null and jsonb_array_length(points)>=2)::text from here_road_geometry where leg='SE-KAA-INLAND'")
[ "$inland_ok" = "true" ] && { ok=$((ok+1)); echo "  OK    SE-KAA-INLAND zapisany z SE_KAA_INLAND"; } || { fail=$((fail+1)); echo "  FAIL  SE-KAA-INLAND → $inland_ok"; }
dev_in=$(sys "select coalesce(here_road_corridor_dev_m('SE-KAA-INLAND','SE_KAA_INLAND')::text,'null')")
awk "BEGIN{exit !($dev_in+0 <= 2000)}" 2>/dev/null && { ok=$((ok+1)); echo "  OK    SE-KAA-INLAND odchyłka ↔ SE_KAA_INLAND ≤ 2 km ($dev_in m)"; } || { fail=$((fail+1)); echo "  FAIL  inland odchyłka → $dev_in"; }
sys "select here_store_road('SE-KAA', here_corridor_points('SE_E22'), 'trasa Karlskrona–Boden E22 (test #667)', now())" >/dev/null
dev_e22=$(sys "select coalesce(here_road_corridor_dev_m('SE-KAA','SE_E22')::text,'null')")
awk "BEGIN{exit !($dev_e22+0 <= 2000)}" 2>/dev/null && { ok=$((ok+1)); echo "  OK    SE-KAA odchyłka ↔ SE_E22 ≤ 2 km ($dev_e22 m)"; } || { fail=$((fail+1)); echo "  FAIL  E22 odchyłka → $dev_e22"; }
legs5=$(asu "$HHL_465" "select jsonb_array_length(map_display_state()->'roads')")
if [ "$legs5" = "12" ]; then ok=$((ok+1)); echo "  OK    map_display_state().roads = 12"; else fail=$((fail+1)); echo "  FAIL  roads length → $legs5"; fi
kaa_in=$(asu "$HHL_465" "select exists(select 1 from jsonb_array_elements(map_display_state()->'roads') e where e->>'leg'='SE-KAA-INLAND' and jsonb_array_length(e->'points')>=2)::text")
[ "$kaa_in" = "true" ] && { ok=$((ok+1)); echo "  OK    roads zawiera SE-KAA-INLAND"; } || { fail=$((fail+1)); echo "  FAIL  SE-KAA-INLAND w roads → $kaa_in"; }

# #667 E / DP-23: słownik + BN7
echo; echo "[#667] E słownik here_road_legs + BN7"
val "słownik = 12 legów" "select count(*)::text from here_road_legs where active" "12"
val "BN7 = 7" "select count(*)::text from here_road_legs where map_group='bn7' and active" "7"
val "core browser_fetch = 5" "select count(*)::text from here_road_legs where map_group='core' and browser_fetch and active" "5"
bn7_null=$(asu "$HHL_465" "select count(*)::text from jsonb_array_elements(map_display_state()->'roads') e where e->>'map_group'='bn7' and jsonb_typeof(e->'points')='null'")
[ "$bn7_null" = "7" ] && { ok=$((ok+1)); echo "  OK    roads: 7× BN7 points=null + spec"; } || { fail=$((fail+1)); echo "  FAIL  BN7 null → $bn7_null"; }
fk=$(sys "select count(*)::text from pg_constraint where conname='here_road_geometry_leg_fkey'")
[ "$fk" = "1" ] && { ok=$((ok+1)); echo "  OK    FK here_road_geometry → here_road_legs"; } || { fail=$((fail+1)); echo "  FAIL  FK → $fk"; }
no_in=$(sys "select count(*)::text from pg_constraint where conname='here_road_geometry_leg_check'")
[ "$no_in" = "0" ] && { ok=$((ok+1)); echo "  OK    brak CHECK IN (…) na leg"; } || { fail=$((fail+1)); echo "  FAIL  CHECK IN nadal → $no_in"; }

# N3: fikcyjny ładunek PL + Verkö + inland SE → start po Verkö (nie w PL)
# F7 r4 P3: odstępy SE 12 min (nie 1 min ≈ 810 km/h → filtr >150 km/h).
# F7 r6: source = TELEMATICS_API (enum); F7 r6b: hhl/carrier_order_no (enforce_order_numbers
# przy IN_TRANSIT_SE) — bez numerów insert ładunku padał cicho → positions 0.
L572=a572a572-0000-4000-8000-000000000572
sys "delete from positions where load_id='$L572'" >/dev/null
sys "delete from loads where id='$L572'" >/dev/null
sys "insert into loads (id, project_id, carrier_org_id, order_no, hhl_order_no, carrier_order_no, status)
     values ('$L572', '$P_465', '00000000-0000-0000-0000-00000000a003', 'KSH/572-N3', 'HHL/572-N3', 'SCX/572-N3', 'IN_TRANSIT_SE')" >/dev/null
val "N3 load istnieje" "select count(*)::text from loads where id='$L572'" "1"
sys "insert into positions (load_id, ts, geom_raw, speed_kmh, source, raw)
     select '$L572', timestamptz '2026-10-20 06:00:00+00' + (g.i * 12 || ' minutes')::interval,
            st_setsrid(st_makepoint(17.0 + g.i * 0.01, 52.08 + g.i * 0.01), 4326),
            60, 'TELEMATICS_API', '{}'::jsonb
       from generate_series(0, 9) as g(i)" >/dev/null
sys "insert into positions (load_id, ts, geom_raw, speed_kmh, source, raw)
     select '$L572', timestamptz '2026-10-20 08:00:00+00' + (g.i * 5 || ' minutes')::interval,
            st_setsrid(st_makepoint(15.6308 + (g.i % 3) * 0.001, 56.1646 + (g.i % 3) * 0.001), 4326),
            5, 'TELEMATICS_API', '{}'::jsonb
       from generate_series(0, 4) as g(i)" >/dev/null
# F7 r6 P3: łamana po miastach (jak fixture) + offset — 0.05*sin na CI → simplify 2 pkt → 0.
# 16 odcinków × 5 próbek = 80 pkt; 12 min; offset 0.15° → przeżywa simplify, ≤150 km/h.
sys "insert into positions (load_id, ts, geom_raw, speed_kmh, source, raw)
     with verts(i, lon, lat) as (
       values
         (0, 15.63, 56.17), (1, 16.05, 56.50), (2, 16.40, 57.00),
         (3, 16.50, 57.50), (4, 16.45, 58.00), (5, 16.18, 58.59),
         (6, 16.30, 59.00), (7, 16.54, 59.61), (8, 16.80, 60.00),
         (9, 17.10, 60.70), (10, 17.20, 61.50), (11, 17.40, 62.40),
         (12, 18.50, 63.20), (13, 20.20, 63.80), (14, 21.00, 64.70),
         (15, 21.50, 65.30), (16, 21.76, 65.81)
     ),
     seg as (
       select a.i as seg, a.lon as lon0, a.lat as lat0, b.lon as lon1, b.lat as lat1
         from verts a join verts b on b.i = a.i + 1
     ),
     samples as (
       select s.seg * 5 + g.k as seq,
              s.lon0 + (s.lon1 - s.lon0) * g.k / 5.0 + 0.15 * sin((s.seg * 5 + g.k) / 2.5),
              s.lat0 + (s.lat1 - s.lat0) * g.k / 5.0 + 0.12 * cos((s.seg * 5 + g.k) / 2.5)
         from seg s cross join generate_series(0, 4) as g(k)
     )
     select '$L572',
            timestamptz '2026-10-20 09:00:00+00' + (s.seq * 12 || ' minutes')::interval,
            st_setsrid(st_makepoint(s.lon, s.lat), 4326),
            70, 'TELEMATICS_API', '{}'::jsonb
       from samples s(seq, lon, lat)" >/dev/null
# 10 PL + 5 Verkö + 80 SE = 95
val "N3 positions = 95 (10+5+80)" "select count(*)::text from positions where load_id='$L572'" "95"
sys "delete from corridor_polylines where code='SE_KAA_TRACK'" >/dev/null
n3=$(sys "select rebuild_se_kaa_track('$L572')")
if [ "$n3" -ge 10 ] 2>/dev/null; then ok=$((ok+1)); echo "  OK    N3 rebuild_se_kaa_track ≥ 10 ($n3)"; else fail=$((fail+1)); echo "  FAIL  N3 rebuild → $n3"; fi
start_lat=$(sys "select coalesce(round(st_y(st_startpoint(geom))::numeric, 2)::text,'') from corridor_polylines where code='SE_KAA_TRACK'")
# start po Verkö (~56.16), nie PL (~52); start_lat z wyniku rebuild (nie wcześniejszego fixture)
awk "BEGIN{exit !($start_lat+0 >= 55.5 && $start_lat+0 <= 57.5)}" 2>/dev/null \
  && { ok=$((ok+1)); echo "  OK    N3 start lat po Verkö ($start_lat), nie PL"; } \
  || { fail=$((fail+1)); echo "  FAIL  N3 start lat → $start_lat"; }
sys "delete from positions where load_id='$L572'" >/dev/null
sys "delete from loads where id='$L572'" >/dev/null

# F7 r5 P2: brak Verkö → 0; fixture zygzak (≥10 pkt po simplify) — test startu, nie upraszczania
L572b=a572a572-0000-4000-8000-000000000573
sys "delete from positions where load_id='$L572b'" >/dev/null
sys "delete from loads where id='$L572b'" >/dev/null
sys "insert into loads (id, project_id, carrier_org_id, order_no, hhl_order_no, carrier_order_no, status)
     values ('$L572b', '$P_465', '00000000-0000-0000-0000-00000000a003', 'KSH/572-P2', 'HHL/572-P2', 'SCX/572-P2', 'IN_TRANSIT_SE')" >/dev/null
val "P2 load istnieje" "select count(*)::text from loads where id='$L572b'" "1"
sys "insert into positions (load_id, ts, geom_raw, speed_kmh, source, raw)
     select '$L572b', timestamptz '2026-10-20 06:00:00+00' + (g.i * 12 || ' minutes')::interval,
            st_setsrid(st_makepoint(
              17.0 + g.i * 0.01 + 0.08 * sin(g.i),
              52.08 + g.i * 0.01 + 0.08 * cos(g.i)
            ), 4326),
            60, 'TELEMATICS_API', '{}'::jsonb
       from generate_series(0, 60) as g(i)" >/dev/null
val "P2 positions = 61" "select count(*)::text from positions where load_id='$L572b'" "61"
sys "delete from corridor_polylines where code='SE_KAA_TRACK'" >/dev/null
n3b=$(sys "select rebuild_se_kaa_track('$L572b')")
if [ "$n3b" = "0" ]; then ok=$((ok+1)); echo "  OK    P2 brak Verkö → rebuild 0"; else fail=$((fail+1)); echo "  FAIL  P2 brak Verkö → $n3b"; fi
sys "delete from positions where load_id='$L572b'" >/dev/null
sys "delete from loads where id='$L572b'" >/dev/null

echo; echo "WYNIK: $ok OK, $fail FAIL"
[ "$fail" -eq 0 ]
