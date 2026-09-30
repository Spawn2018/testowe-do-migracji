# Bezpiecznik produkcji: odmawia, gdy jakikolwiek adres bazy zawiera ref produkcji.
# Użycie (po ustawieniu ADMIN / PGURL / PGADMIN / TEST_DB_URL):
#   . "$(dirname "$0")/refuse-prod.sh"
# albo: bash tests/db/refuse-prod.sh   (wtedy czyta zmienne środowiskowe)
_tower_prod_ref='nglnnrmzmhusvxslousq'
_tower_check_prod() {
  case "$1" in
    *"$_tower_prod_ref"*)
      echo "ODMOWA: adres bazy wskazuje produkcję (ref $_tower_prod_ref)." >&2
      exit 2
      ;;
  esac
}
_tower_check_prod "${ADMIN:-}"
_tower_check_prod "${PGADMIN:-}"
_tower_check_prod "${PGURL:-}"
_tower_check_prod "${TEST_DB_URL:-}"
unset _tower_prod_ref
unset -f _tower_check_prod
