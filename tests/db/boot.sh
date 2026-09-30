# Wspólny start zestawu testów bazy.
# Wymaga: ADMIN (lokalnie) albo TOWER_HOSTED_READY=1 + PGURL (projekt testowy).
# Opcjonalnie: DB=nazwa (tylko lokalnie), argument "storage" = atrapa storage (tylko lokalnie).
# Ustawia: URL
# Użycie: . "$(git rev-parse --show-toplevel)/tests/db/boot.sh" [storage]
_tower_root="$(git rev-parse --show-toplevel)"
# shellcheck source=refuse-prod.sh
. "$_tower_root/tests/db/refuse-prod.sh"

if [ -n "${TOWER_HOSTED_READY:-}" ]; then
  URL="${PGURL:?TOWER_HOSTED_READY wymaga PGURL}"
  case "$URL" in
    *emkbykwenwrjmbprydml*) ;;
    *)
      echo "ODMOWA: tryb hosted tylko na projekcie testowym emkbykwenwrjmbprydml." >&2
      exit 2
      ;;
  esac
  # Schemat i migracje nakłada brama hosted (scripts/test-db-gate.mjs) przed zestawem.
else
  # shellcheck source=local-only.sh
  . "$_tower_root/tests/db/local-only.sh"
  _tower_db="${DB:-tower_test}"
  URL="${ADMIN%/*}/$_tower_db"
  psql "$ADMIN" -q -c "drop database if exists $_tower_db" -c "create database $_tower_db"
  psql "$URL" -q -v ON_ERROR_STOP=1 -f "$_tower_root/tests/db/supabase_stub.sql"
  if [ "${1:-}" = "storage" ]; then
    psql "$URL" -q -v ON_ERROR_STOP=1 -f "$_tower_root/tests/db/storage_stub.sql"
  fi
  # release.sh: rola service_role jak w Supabase (przed migracjami)
  psql "$URL" -q -v ON_ERROR_STOP=1 -c "do \$\$ begin if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if; end \$\$;" \
    -c "grant usage on schema public, auth to service_role" \
    -c "alter default privileges in schema public grant all on tables to service_role" \
    -c "alter default privileges in schema public grant all on sequences to service_role"
  # invite.sh: atrapa auth.users (na hosted istnieje prawdziwa tabela)
  if [ -n "${TOWER_BOOT_INVITE:-}" ]; then
    psql "$URL" -q -v ON_ERROR_STOP=1 -c "create table if not exists auth.users (id uuid primary key default gen_random_uuid(),
      email text, created_at timestamptz not null default now(), last_sign_in_at timestamptz)"
  fi
  for _tower_f in "$_tower_root"/supabase/migrations/*.sql; do
    if ! psql "$URL" -q -v ON_ERROR_STOP=1 -f "$_tower_f" >/dev/null 2>&1; then
      echo "MIGRACJA $_tower_f: błąd" >&2
      psql "$URL" -q -v ON_ERROR_STOP=1 -f "$_tower_f" 2>&1 | tail -5 >&2
      exit 1
    fi
  done
  psql "$URL" -q -v ON_ERROR_STOP=1 -f "$_tower_root/tests/db/seed.sql"
  unset _tower_db _tower_f
fi
unset _tower_root
