#!/usr/bin/env bash
# DP-229 — jeden przebieg i667-f-orange-maps.local.spec.ts na buildzie supabase + lokalnym SB.
# Tylko CI / maszyna z Dockera (nigdy produkcja). Windows wykonawcy bez Dockera → ten skrypt w GHA.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

WD=${SB_WORKDIR:-/tmp/sblocal-i667}
rm -rf "$WD"
mkdir -p "$WD"
# Kopia katalogu supabase (CLI wymaga workdir z config + migrations).
cp -a supabase "$WD/supabase"
# Edge Functions importują ../../../../src/lib/pl/* i describe→../time.ts —
# workdir poza repo bez src/ → supabase start: „open src/lib/pl/deepl.ts: no such file”.
mkdir -p "$WD/src/lib"
cp -a src/lib/pl "$WD/src/lib/"
cp -a src/lib/time.ts "$WD/src/lib/time.ts"
# Brak ./seed.sql w repo — wyłącz auto-seed przy db reset, żeby nie padać na brak pliku.
python3 - <<'PY' "$WD/supabase/config.toml"
from pathlib import Path
import sys
p = Path(sys.argv[1])
t = p.read_text(encoding='utf-8')
t = t.replace('[db.seed]\n# If enabled, seeds the database after migrations during a db reset.\nenabled = true',
              '[db.seed]\n# DP-229 CI: seed.sql nie ma w repo — seed ręczny w skrypcie.\nenabled = false', 1)
p.write_text(t, encoding='utf-8')
PY

echo "== supabase start =="
npx -y supabase@latest start --workdir "$WD" -x studio,imgproxy,logflare,vector,supavisor

eval "$(npx -y supabase@latest status --workdir "$WD" -o env 2>/dev/null | grep -E '^(API_URL|ANON_KEY|SERVICE_ROLE_KEY|DB_URL)=')"
case "$API_URL" in http://127.0.0.1:*|http://localhost:*) ;; *) echo "DP-229 STOP: API_URL nie lokalny: $API_URL" >&2; exit 2 ;; esac

export VITE_SUPABASE_URL="$API_URL" VITE_SUPABASE_ANON_KEY="$ANON_KEY"
export SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY" SUPABASE_DB_URL="$DB_URL"
export TEST_SUPABASE_URL="$API_URL" TEST_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY" TEST_ANON_KEY="$ANON_KEY"
export TEST_USER_HHL_EMAIL=hhl@bk5.local
export TEST_USER_HHL_OPS_EMAIL=hhl-ops@bk5.local
export TEST_USER_KSH_USER_EMAIL=ksh@bk5.local
export TEST_USER_SCX_EMAIL=scx@bk5.local
export TEST_USER_SCX_USER_EMAIL=scx-user@bk5.local

# .env.local pod seed-test-users (loadEnvLocal czyta plik; process.env nadpisuje klucze z pliku).
cat > .env.local <<EOF
TEST_SUPABASE_URL=$API_URL
TEST_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY
TEST_ANON_KEY=$ANON_KEY
TEST_USER_HHL_EMAIL=hhl@bk5.local
TEST_USER_HHL_OPS_EMAIL=hhl-ops@bk5.local
TEST_USER_KSH_USER_EMAIL=ksh@bk5.local
TEST_USER_SCX_EMAIL=scx@bk5.local
TEST_USER_SCX_USER_EMAIL=scx-user@bk5.local
EOF

echo "== seed stegra + SE-KAA + 1 transport =="
psql "$DB_URL" -v ON_ERROR_STOP=1 -q -f supabase/seed/stegra.sql
psql "$DB_URL" -v ON_ERROR_STOP=1 -q <<'SQL'
-- Pomarańczowa linia SE-KAA (słownik SE_KAA_TRACK) — bez prawdziwego śladu GPS.
select here_store_road('SE-KAA', here_corridor_points('SE_KAA_TRACK'), 'DP-229 CI SE-KAA', now());
-- Jeden transport widoczny na Mapie / Harmonogramie (TrackReplay + szuflada).
insert into loads (
  id, project_id, carrier_org_id, order_no, hhl_order_no, carrier_order_no,
  status, plan_load_date, plan_delivery_date
)
select
  'a0000229-0000-4000-8000-000000000229'::uuid,
  p.id,
  c.id,
  'DP-229',
  'DP-229',
  'DP-229',
  'IN_TRANSIT_SE',
  current_date - 1,
  current_date + 2
from projects p
cross join organizations c
where p.code = 'STEGRA_BODEN' and c.code = 'SCX'
on conflict (id) do nothing;
-- Minimalna pozycja (Szwecja) — TrackReplay ma co pokazać.
insert into positions (load_id, ts, geom_raw, speed_kmh, source, raw)
select
  'a0000229-0000-4000-8000-000000000229'::uuid,
  now() - interval '10 minutes',
  st_setsrid(st_makepoint(16.2, 58.5), 4326),
  60,
  'TELEMATICS_API',
  '{}'::jsonb
where not exists (
  select 1 from positions
  where load_id = 'a0000229-0000-4000-8000-000000000229'::uuid
);
SQL

echo "== konta testowe =="
node scripts/auth/seed-test-users.mjs

echo "== Playwright i667 F =="
export SB_WORKDIR="$WD"
SPEC=tests/i667-f-orange-maps.local.spec.ts bash scripts/i2/local-ui.sh
