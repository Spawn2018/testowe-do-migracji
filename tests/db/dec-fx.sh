#!/usr/bin/env bash
# HOTFIX #384 / D-20261021-1130-01 pkt 1 — DECISION_* w CHECK + resolve wszystkich opcji.
set -e
ADMIN=${PGADMIN:-postgres://postgres@localhost:5433/postgres}
. "$(git rev-parse --show-toplevel)/tests/db/local-only.sh"
if [ "${TOWER_HOSTED_READY:-}" = "1" ]; then URL="$ADMIN"
else
  DB=tower_test_dec_fx; URL="${ADMIN%/*}/$DB"
  psql "$ADMIN" -q -c "drop database if exists $DB" -c "create database $DB"
  psql "$URL" -q -v ON_ERROR_STOP=1 -f tests/db/supabase_stub.sql
  for f in supabase/migrations/*.sql; do psql "$URL" -q -v ON_ERROR_STOP=1 -f "$f" >/dev/null 2>&1 || { echo "MIGRACJA $f"; exit 1; }; done
  psql "$URL" -q -v ON_ERROR_STOP=1 -f tests/db/seed.sql
fi
set +e
PSQL="psql $URL -Atq"
HHL=11111111-0000-0000-0000-000000000001
P=22222222-0000-0000-0000-000000000001
L=33333333-0000-0000-0000-000000000001
SCXO=00000000-0000-0000-0000-00000000a003
V1=55555555-0000-0000-0000-00000000df01
S1=55555555-0000-0000-0000-00000000df11
V2=55555555-0000-0000-0000-00000000df02
S2=55555555-0000-0000-0000-00000000df12
ok=0; fail=0
sys() { $PSQL -v ON_ERROR_STOP=1 -c "$1" 2>&1; }
run() {
  local end="rollback"; [ "$3" = "commit" ] && end="commit"
  $PSQL -v ON_ERROR_STOP=1 -c "begin; set local role authenticated; set local request.jwt.claim.sub='$1'; $2; $end;" 2>&1
}

echo; echo "[dec-fx] CHECK + literały + resolve wszystkich opcji (#384)"

for t in DECISION_EFFECT DECISION_SAILING DECISION_KEEP_TOWER; do
  out=$(sys "select pg_get_constraintdef(oid) from pg_constraint where conname='load_events_event_type_known'" | tr -d '\r')
  if echo "$out" | grep -q "'$t'"; then ok=$((ok+1)); echo "  OK    CHECK ma $t"; else fail=$((fail+1)); echo "  FAIL  CHECK ma $t"; fi
done

for t in DECISION_EFFECT DECISION_SAILING DECISION_KEEP_TOWER; do
  out=$(sys "begin; insert into load_events (load_id,event_type,occurred_at) values ('$L','$t',now()); rollback;" 2>&1)
  if echo "$out" | grep -qiE 'ERROR|check constraint'; then
    fail=$((fail+1)); echo "  FAIL  insert $t → $(echo "$out" | grep -i ERROR | head -1)"
  else
    ok=$((ok+1)); echo "  OK    insert $t"
  fi
done

# Tylko zwykłe funkcje (prokind=f). Po „insert into load_events” bierzemy max 255 znaków
# (limit kwantyfikatora ARE w PG) i literały 'UPPER_CASE'.
MISS=$(sys "
with defs as (
  select p.proname, pg_get_functiondef(p.oid) as def
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.prokind = 'f'
     and pg_get_functiondef(p.oid) ~* 'insert[[:space:]]+into[[:space:]]+(public\\.)?load_events'
),
parts as (
  select proname, left(chunk, 255) as chunk
    from defs,
         lateral unnest(regexp_split_to_array(def, 'insert[[:space:]]+into[[:space:]]+(public\\.)?load_events', 'i'))
           with ordinality as u(chunk, ord)
   where ord > 1
),
chunks as (
  select distinct m[1] as lit
    from parts,
         lateral regexp_matches(
           chunk,
           '''([A-Z][A-Z0-9_]*)''[[:space:]]*,[[:space:]]*now\(\)',
           'g'
         ) as m
),
allowed as (
  select (regexp_matches(pg_get_constraintdef(oid), '''([A-Z][A-Z0-9_]*)''', 'g'))[1] as t
    from pg_constraint where conname = 'load_events_event_type_known'
)
select count(*)::text from chunks x
 where x.lit is not null
   and not exists (select 1 from allowed a where a.t = x.lit);
" | grep -vE '^(BEGIN|SET|ROLLBACK|COMMIT)$' | tail -1 | tr -d '\r')
if [ "$MISS" = "0" ]; then ok=$((ok+1)); echo "  OK    literały event_type ⊆ CHECK"; else
  fail=$((fail+1)); echo "  FAIL  literały event_type ⊆ CHECK (braki=$MISS)"
  sys "
with defs as (
  select p.proname, pg_get_functiondef(p.oid) as def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prokind = 'f'
     and pg_get_functiondef(p.oid) ~* 'insert[[:space:]]+into[[:space:]]+(public\\.)?load_events'
),
parts as (
  select proname, left(chunk, 255) as chunk
    from defs,
         lateral unnest(regexp_split_to_array(def, 'insert[[:space:]]+into[[:space:]]+(public\\.)?load_events', 'i'))
           with ordinality as u(chunk, ord)
   where ord > 1
),
chunks as (
  select distinct proname, m[1] as lit
    from parts,
         lateral regexp_matches(chunk, '''([A-Z][A-Z0-9_]*)''[[:space:]]*,[[:space:]]*now\(\)', 'g') as m
),
allowed as (
  select (regexp_matches(pg_get_constraintdef(oid), '''([A-Z][A-Z0-9_]*)''', 'g'))[1] as t
    from pg_constraint where conname = 'load_events_event_type_known'
)
select proname || ':' || lit from chunks x
 where x.lit is not null and not exists (select 1 from allowed a where a.t = x.lit)
 limit 20;
" | head -25
fi

# Fixture rejsu + resolve wszystkich aktywnych opcji jako HHL_ADMIN (l2: admin rozstrzyga każdy typ).
sys "insert into vessels (id, name, operator) values ('$V1', 'DFX Ferry', 'Test') on conflict (id) do nothing" >/dev/null
sys "insert into sailings (id, project_id, vessel_id, route, departure_at, arrival_at, source)
     values ('$S1', '$P', '$V1', 'GDN-NYN', now() + interval '2 days', now() + interval '2 days 18 hours', 'RECZNIE')
     on conflict (id) do nothing" >/dev/null

RES=$(sys "
begin;
create temporary table dec_fx_result (pairs int, ok_n int, fail_n int);
do \$\$
declare
  r record;
  v_load uuid;
  v_dec uuid;
  v_note text;
  v_detail jsonb;
  v_sail uuid := '$S1'::uuid;
  n_ok int := 0;
  n_fail int := 0;
  n_pairs int := 0;
  err text;
begin
  -- security definer + auth.uid() z JWT; rola postgres (superuser) wystarczy — bez set role.
  perform set_config('request.jwt.claim.sub', '$HHL', true);
  for r in
    select t.code, o->>'code' as opt,
           coalesce((o->>'requires_comment')::boolean, false) as need_note,
           coalesce(o->>'effect', '') as effect
      from decision_types t, jsonb_array_elements(t.options) o
     where t.active
     order by t.code, o->>'code'
  loop
    n_pairs := n_pairs + 1;
    begin
      v_note := case when r.need_note then 'komentarz testowy hotfix 384' else null end;
      v_detail := '{}'::jsonb;
      if r.effect = 'CHANGE_SAILING' then
        v_detail := jsonb_build_object('sailing_id', v_sail::text);
      elsif r.effect = 'TAKE_FILE' then
        v_detail := jsonb_build_object('field', 'hhl_order_no', 'file_value', 'HHL-DFX-1');
      elsif r.code = 'DELIVERED_CHECK' then
        v_detail := jsonb_build_object('exit_at', now()::text, 'dwell_min', 12);
      end if;

      insert into loads (id, project_id, carrier_org_id, order_no, status)
      values (
        gen_random_uuid(), '$P', '$SCXO',
        'DFX-' || substr(md5(random()::text), 1, 6),
        case when r.code = 'DELIVERED_CHECK' then 'AT_SITE'::load_status else 'PLANNED'::load_status end
      )
      returning id into v_load;

      v_dec := decision_open('$P', r.code, 'dfx ' || r.code || ' ' || r.opt, v_detail, v_load);
      perform decision_resolve(v_dec, r.opt, v_note);
      n_ok := n_ok + 1;
    exception when others then
      get stacked diagnostics err = message_text;
      n_fail := n_fail + 1;
      raise notice 'FAIL %/%: %', r.code, r.opt, err;
    end;
  end loop;
  insert into dec_fx_result values (n_pairs, n_ok, n_fail);
end \$\$;
select fail_n::text || '/' || pairs::text || '/' || ok_n::text from dec_fx_result;
commit;
" 2>&1)
RES_LINE=$(printf '%s\n' "$RES" | grep -E '^[0-9]+/[0-9]+/[0-9]+$' | tail -1 | tr -d '\r')
FAIL_N=${RES_LINE%%/*}
REST=${RES_LINE#*/}
PAIRS=${REST%%/*}
OK_N=${REST#*/}
if [ -z "$RES_LINE" ]; then
  fail=$((fail+1)); echo "  FAIL  resolve-all (brak wyniku); bajtow RES=${#RES}"
  printf '%s\n' "$RES" | grep -iE 'ERROR|NOTICE|FATAL|HINT' | head -30
  printf '%s\n' "$RES" | tail -15
else
  if [ "$FAIL_N" = "0" ]; then ok=$((ok+1)); echo "  OK    resolve-all fail=0 (pary=$PAIRS ok=$OK_N)"; else
    fail=$((fail+1)); echo "  FAIL  resolve-all fail=$FAIL_N / pary=$PAIRS"; printf '%s\n' "$RES" | grep 'NOTICE:' | head -25
  fi
  if [ "${PAIRS:-0}" -ge 40 ] 2>/dev/null; then ok=$((ok+1)); echo "  OK    resolve-all pary>=40 ($PAIRS)"; else
    fail=$((fail+1)); echo "  FAIL  resolve-all pary>=40 (otrzymano: ${PAIRS:-})"
  fi
fi

# Trzy skutki z load_id — resolve jako authenticated, odczyt zdarzeń jako postgres.
out=$(run "$HHL" "
  select decision_resolve(
    decision_open('$P','SEFS_INVOICE_DIFF','efekt', '{}'::jsonb, '$L'),
    'ACCEPT', 'akceptacja z load_id'
  );
" commit 2>&1)
CNT=$(sys "select count(*) from load_events
  where load_id='$L' and event_type='DECISION_EFFECT'
    and payload->>'note' = 'akceptacja z load_id'" | tail -1 | tr -d '\r')
if [ "$CNT" = "1" ]; then ok=$((ok+1)); echo "  OK    ACCEPT+load → DECISION_EFFECT"; else
  fail=$((fail+1)); echo "  FAIL  ACCEPT+load → DECISION_EFFECT (otrzymano: $CNT; resolve: $(echo "$out" | grep -iE 'ERROR|exception' | head -1))"
fi

out=$(run "$HHL" "
  select decision_resolve(
    decision_open('$P','TOWER_KSH_CONFLICT','keep', jsonb_build_object('field','hhl_order_no'), '$L'),
    'KEEP_TOWER', null
  );
" commit 2>&1)
CNT=$(sys "select count(*) from load_events
  where load_id='$L' and event_type='DECISION_KEEP_TOWER'" | tail -1 | tr -d '\r')
if [ "$CNT" = "1" ]; then ok=$((ok+1)); echo "  OK    KEEP_TOWER → DECISION_KEEP_TOWER"; else
  fail=$((fail+1)); echo "  FAIL  KEEP_TOWER → DECISION_KEEP_TOWER (otrzymano: $CNT; resolve: $(echo "$out" | grep -iE 'ERROR|exception' | head -1))"
fi

sys "insert into vessels (id, name, operator) values ('$V2','DFX2','Test') on conflict (id) do nothing" >/dev/null
sys "insert into sailings (id, project_id, vessel_id, route, departure_at, arrival_at, source)
     values ('$S2', '$P', '$V2', 'GDN-NYN', now() + interval '3 days', now() + interval '3 days 18 hours', 'RECZNIE')
     on conflict (id) do nothing" >/dev/null
out=$(run "$HHL" "
  select decision_resolve(
    decision_open('$P','FERRY_CANCELLED','sail', jsonb_build_object('sailing_id', '$S2'), '$L'),
    'NEXT_SAME', null
  );
" commit 2>&1)
CNT=$(sys "select count(*) from load_events
  where load_id='$L' and event_type='DECISION_SAILING'
    and payload->>'sailing_id' = '$S2'" | tail -1 | tr -d '\r')
if [ "$CNT" = "1" ]; then ok=$((ok+1)); echo "  OK    CHANGE_SAILING → DECISION_SAILING"; else
  fail=$((fail+1)); echo "  FAIL  CHANGE_SAILING → DECISION_SAILING (otrzymano: $CNT; resolve: $(echo "$out" | grep -iE 'ERROR|exception' | head -1))"
fi

echo; echo "WYNIK: $ok OK, $fail FAIL"
[ "$fail" -eq 0 ]
