# Bezpiecznik: testy bazy tworzą i usuwają bazy tymczasowe (drop/create database) i piszą dane testowe.
# Wolno je uruchamiać wyłącznie na lokalnym serwerze Postgres — nigdy na produkcji Supabase.
# Hosted (projekt testowy): TOWER_HOSTED_READY=1 + PGURL z ref emkbykwenwrjmbprydml.
# Użycie (po ustawieniu ADMIN): . "…/tests/db/local-only.sh"
. "$(git rev-parse --show-toplevel)/tests/db/refuse-prod.sh"

if [ -n "${TOWER_HOSTED_READY:-}" ]; then
  _tower_u="${PGURL:-${ADMIN:-}}"
  case "$_tower_u" in
    *emkbykwenwrjmbprydml*) ;;
    *)
      echo "ODMOWA: TOWER_HOSTED_READY tylko dla projektu testowego emkbykwenwrjmbprydml." >&2
      exit 2
      ;;
  esac
  unset _tower_u
  return 0 2>/dev/null || exit 0
fi

_tower_host=$(printf '%s' "$ADMIN" | sed -E 's#^[a-z]+://##; s#^[^@/]*@##; s#[/?].*$##; s#:[0-9]+$##; s#^\[(.*)\]$#\1#')
case "$_tower_host" in
  ""|localhost|127.0.0.1|::1) ;;
  *) echo "ODMOWA: testy bazy tylko na lokalnym Postgresie (host '$_tower_host' nie jest lokalny)." >&2; exit 2 ;;
esac
case "$ADMIN" in *supabase.co*|*supabase.com*|*pooler*) echo "ODMOWA: adres wygląda na Supabase w chmurze." >&2; exit 2 ;; esac
unset _tower_host
