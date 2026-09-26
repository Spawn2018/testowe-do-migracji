#!/usr/bin/env bash
# TOWER PR2 — test na żywo Workera zapisu kopii (tylko dopisywanie do R2).
# Użycie: set -a; . ./.env.local; set +a; bash scripts/r2/test-writer.sh
# Wymaga BACKUP_WRITER_URL i BACKUP_WRITER_SECRET. Zapisuje JEDEN obiekt testowy files/_test/… (bez blokady, bez cyklu życia).
set -u
: "${BACKUP_WRITER_URL:?}"; : "${BACKUP_WRITER_SECRET:?}"
U=${BACKUP_WRITER_URL%/}; K="files/_test/writer-$(date -u +%Y%m%dT%H%M%S)-$$.txt"
ok=0; fail=0
chk() { if [ "$2" = "$3" ]; then ok=$((ok+1)); echo "  OK    $1 → $2"; else fail=$((fail+1)); echo "  FAIL  $1 → $2 (oczekiwano $3)"; fi; }
code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }
chk "PUT bez sekretu"      "$(code -X PUT --data x "$U/$K")" 401
chk "PUT zły sekret"       "$(code -X PUT -H 'x-backup-secret: zly' --data x "$U/$K")" 401
chk "GET"                  "$(code -H "x-backup-secret: $BACKUP_WRITER_SECRET" "$U/$K")" 405
chk "DELETE"               "$(code -X DELETE -H "x-backup-secret: $BACKUP_WRITER_SECRET" "$U/$K")" 405
chk "LIST"                 "$(code -H "x-backup-secret: $BACKUP_WRITER_SECRET" "$U/?list-type=2")" 405
chk "PUT poza prefiksem"   "$(code -X PUT -H "x-backup-secret: $BACKUP_WRITER_SECRET" --data x "$U/inne/$$.txt")" 400
chk "PUT nowy obiekt"      "$(code -X PUT -H "x-backup-secret: $BACKUP_WRITER_SECRET" --data x "$U/$K")" 201
chk "PUT nadpisanie"       "$(code -X PUT -H "x-backup-secret: $BACKUP_WRITER_SECRET" --data y "$U/$K")" 409
echo "WRITER: OK=$ok FAIL=$fail (obiekt testowy: $K)"; [ $fail -eq 0 ]
