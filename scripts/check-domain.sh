#!/usr/bin/env bash
# TOWER — sprawdzenie adresu produkcyjnego po dodaniu CNAME (tower.log-mar.pl → Vercel).
# Użycie:
#   bash scripts/check-domain.sh                         # DNS, certyfikat, HTTP (bez e-maili)
#   SEND_LOGIN=1 LOGIN_EMAIL=Sebastian@log-mar.pl bash scripts/check-domain.sh
#       + wysyła JEDEN link logowania (tylko na konto właściciela; inny adres = odmowa), redirect na nowy adres
#   CHECK_LOGIN_SINCE='2026-09-27 12:00+02' LOGIN_EMAIL=Sebastian@log-mar.pl bash scripts/check-domain.sh
#       + po kliknięciu linku przez właściciela: czy last_sign_in_at > podany czas (tylko ODCZYT z bazy)
# Wymaga: curl, openssl, python3; do logowania .env.local (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_DB_POOLER_URL).
set -u
cd "$(dirname "$0")/.."
HOST=${HOST:-tower.log-mar.pl}
EXPECT_CNAME=${EXPECT_CNAME:-c8ddf203a73a39c2.vercel-dns-017.com}
OWNER=sebastian@log-mar.pl
rm -f /tmp/check-domain.html
ok=0; fail=0
chk() { if [ "$2" = "$3" ]; then ok=$((ok+1)); echo "  OK    $1: $2"; else fail=$((fail+1)); echo "  FAIL  $1: $2 (oczekiwano $3)"; fi; }
doh() { curl -s -H 'accept: application/dns-json' "https://cloudflare-dns.com/dns-query?name=$1&type=$2" |
  python3 -c 'import json,sys;print(" ".join(a["data"].rstrip(".") for a in json.load(sys.stdin).get("Answer",[])))'; }

echo "[1] DNS"
CN=$(doh "$HOST" CNAME)
chk "CNAME $HOST" "${CN:-brak}" "$EXPECT_CNAME"
echo "        A (po rozwiązaniu): $(doh "$HOST" A)"

echo "[2] Certyfikat HTTPS"
CERT=$(echo | timeout 15 openssl s_client -connect "$HOST:443" -servername "$HOST" 2>/dev/null | openssl x509 -noout -issuer -subject -startdate -enddate -ext subjectAltName 2>/dev/null)
echo "$CERT" | sed 's/^/        /'
chk "SAN zawiera $HOST" "$(echo "$CERT" | grep -c "DNS:$HOST")" 1
END=$(echo "$CERT" | sed -n 's/^notAfter=//p')
chk "certyfikat ważny (dni do wygaśnięcia > 0)" "$( [ -n "$END" ] && [ $(( ($(date -d "$END" +%s) - $(date +%s)) / 86400 )) -gt 0 ] && echo t || echo f)" t
[ -n "$END" ] && echo "        dni do wygaśnięcia: $(( ($(date -d "$END" +%s) - $(date +%s)) / 86400 ))"
chk "weryfikacja łańcucha (curl)" "$(curl -s -o /dev/null -w '%{ssl_verify_result}' "https://$HOST/")" 0

echo "[3] HTTP"
chk "https://$HOST/ kod" "$(curl -s -o /tmp/check-domain.html -w '%{http_code}' "https://$HOST/")" 200
chk "tytuł" "$(grep -o '<title>[^<]*' /tmp/check-domain.html | sed 's/<title>//')" "TOWER — Stegra Boden"
chk "http:// → https:// (kod 301/308)" "$(curl -s -o /dev/null -w '%{http_code}' "http://$HOST/" | grep -cE '^(301|308)$')" 1
# O2: build produkcyjny nie zawiera makiety — /download/… ma dać 404 bez załącznika.
DL=$(curl -s -o /dev/null -D - -w 'KOD:%{http_code}' "https://$HOST/download/tower-makieta.html")
chk "/download/tower-makieta.html: kod (makieta usunięta z produkcji)" "$(echo "$DL" | sed -n 's/.*KOD://p')" 404
chk "/download/tower-makieta.html: brak Content-Disposition attachment" "$(echo "$DL" | grep -ci '^content-disposition: attachment')" 0

if [ "${SEND_LOGIN:-0}" = 1 ] || [ -n "${CHECK_LOGIN_SINCE:-}" ]; then
  E=$(echo "${LOGIN_EMAIL:-}" | tr '[:upper:]' '[:lower:]')
  [ "$E" = "$OWNER" ] || { echo "ODMOWA: logowanie testowe wyłącznie na $OWNER"; exit 2; }
  set -a; . ./.env.local; set +a
fi
if [ "${SEND_LOGIN:-0}" = 1 ]; then
  echo "[4] Logowanie linkiem (1 e-mail na $OWNER, redirect https://$HOST/)"
  SENT=$(date '+%Y-%m-%d %H:%M:%S%z')
  code=$(curl -s -o /tmp/check-domain-otp.json -w '%{http_code}' -X POST \
    -H "apikey: $VITE_SUPABASE_ANON_KEY" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$E\",\"create_user\":false}" \
    "${VITE_SUPABASE_URL%/}/auth/v1/otp?redirect_to=https%3A%2F%2F$HOST%2F")
  chk "wysłanie linku (kod)" "$code" 200
  echo "        wysłano: $SENT — po kliknięciu: CHECK_LOGIN_SINCE='$SENT' LOGIN_EMAIL=$E bash scripts/check-domain.sh"
fi
if [ -n "${CHECK_LOGIN_SINCE:-}" ]; then
  echo "[5] Logowanie zakończone (odczyt auth.users)"
  R=$(psql "$SUPABASE_DB_POOLER_URL" -Atq -v e="$E" -v t="$CHECK_LOGIN_SINCE" \
    -c "select count(*) filter (where last_sign_in_at > :'t'::timestamptz) || ':' || count(*) from auth.users where lower(email) = :'e'")
  chk "konto istnieje i zalogowało się po wysłaniu linku (zalogowane:konta)" "$R" "1:1"
fi
echo "WYNIK: $ok OK, $fail FAIL"; [ "$fail" -eq 0 ]
