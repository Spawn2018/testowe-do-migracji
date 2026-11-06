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

# Przypięta wersja CLI (F7 #855) — check nie zmienia się sam po wydaniu nowej.
SB_CLI=${SB_CLI:-supabase@3.0.0}

echo "== supabase start =="
npx -y "$SB_CLI" start --workdir "$WD" -x studio,imgproxy,logflare,vector,supavisor

eval "$(npx -y "$SB_CLI" status --workdir "$WD" -o env 2>/dev/null | grep -E '^(API_URL|ANON_KEY|SERVICE_ROLE_KEY|DB_URL)=')"
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
-- SE_KAA_TRACK nie ma w seedzie / migracjach (buduje się ze śladu GPS).
-- Fixture jak tests/db/bmapa.sh #572 — bez tego here_corridor_points → null → „Zła geometria” (DP-228).
insert into corridor_polylines (code, geom, total_km, source, updated_at)
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
  'fixture DP-229 CI (nie GPS)',
  now()
)
on conflict (code) do update
  set geom = excluded.geom, total_km = excluded.total_km, source = excluded.source, updated_at = now();
update corridor_polylines
   set total_km = round((st_length(geom::geography)/1000.0)::numeric, 2)
 where code = 'SE_KAA_TRACK';
-- Pomarańczowe legi rdzenia (NETWORK_LINES na Kokpicie/Mapie) — geom_ok=true przy zapisie.
select here_store_road('SE-KAA', here_corridor_points('SE_KAA_TRACK'), 'DP-229 CI SE-KAA', now());
select here_store_road('PL-GDN', '[[52.07,17.02],[52.53,17.6],[53.41,18.45],[54.40,18.68]]'::jsonb, 'DP-229 CI PL-GDN', now());
select here_store_road('SE-NYN', '[[58.90,17.95],[60.67,17.14],[62.39,17.31],[65.80,21.76]]'::jsonb, 'DP-229 CI SE-NYN', now());
select here_store_road('PL-GDY', '[[52.07,17.02],[53.5,18.0],[54.53,18.54]]'::jsonb, 'DP-229 CI PL-GDY', now());
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

# AuthGate: magic link → „Dalej”; świeże konto → must_set_password → set-password.
# CI loguje hasłem (jak e2e-browser) — trzeba hasła Auth + must_set_password=false.
echo "== przygotowanie kont UI (hasło + profil) =="
export I667_TEST_PASSWORD="${I667_TEST_PASSWORD:-TowerDbTest-12roles!}"
node --input-type=module <<'NODE'
import pg from 'pg';

const base = (process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const sr = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const db = process.env.SUPABASE_DB_URL || '';
const pw = process.env.I667_TEST_PASSWORD || 'TowerDbTest-12roles!';
const emails = [
  'hhl@bk5.local',
  'hhl-ops@bk5.local',
  'ksh@bk5.local',
  'scx@bk5.local',
  'scx-user@bk5.local',
];
if (!base || !sr || !db) throw new Error('DP-229: brak URL / SERVICE_ROLE / DB_URL');

const list = await fetch(`${base}/auth/v1/admin/users?per_page=200`, {
  headers: { apikey: sr, Authorization: `Bearer ${sr}` },
}).then(async (r) => {
  if (!r.ok) throw new Error(`admin/users HTTP ${r.status}`);
  return r.json();
});
const users = (list.users || []).filter((u) => emails.includes(String(u.email || '').toLowerCase()));
if (users.length < 1) throw new Error('DP-229: brak kont UI po seed-test-users');
for (const u of users) {
  const r = await fetch(`${base}/auth/v1/admin/users/${u.id}`, {
    method: 'PUT',
    headers: {
      apikey: sr,
      Authorization: `Bearer ${sr}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ password: pw, email_confirm: true }),
  });
  if (!r.ok) throw new Error(`password ${u.email}: HTTP ${r.status}`);
}
const c = new pg.Client({ connectionString: db });
await c.connect();
try {
  const q = await c.query(
    `update app_users
        set must_set_password = false,
            phone = coalesce(nullif(trim(phone), ''), '+48111000229')
      where lower(email) = any($1::text[])`,
    [emails],
  );
  if ((q.rowCount ?? 0) < 1) {
    throw new Error('DP-229: app_users bez wierszy po seedzie (trigger zaproszenia?)');
  }
  console.log(`UI-ready: auth=${users.length} app_users=${q.rowCount}`);
} finally {
  await c.end();
}
NODE

echo "== Playwright i667 F =="
export SB_WORKDIR="$WD"
SPEC=tests/i667-f-orange-maps.local.spec.ts bash scripts/i2/local-ui.sh
