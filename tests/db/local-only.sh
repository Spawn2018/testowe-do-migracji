# Bezpiecznik: testy bazy tworzą i usuwają bazy tymczasowe (drop/create database) i piszą dane testowe.
# Wolno je uruchamiać wyłącznie na lokalnym serwerze Postgres — nigdy na produkcji Supabase.
# Użycie (po ustawieniu ADMIN): . "$(dirname "$0")/local-only.sh"
_tower_host=$(printf '%s' "$ADMIN" | sed -E 's#^[a-z]+://##; s#^[^@/]*@##; s#[/?].*$##; s#:[0-9]+$##; s#^\[(.*)\]$#\1#')
case "$_tower_host" in
  ""|localhost|127.0.0.1|::1) ;;
  *) echo "ODMOWA: testy bazy tylko na lokalnym Postgresie (host '$_tower_host' nie jest lokalny)." >&2; exit 2 ;;
esac
case "$ADMIN" in *supabase.co*|*supabase.com*|*pooler*) echo "ODMOWA: adres wygląda na Supabase w chmurze." >&2; exit 2 ;; esac
unset _tower_host
