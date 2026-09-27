#!/usr/bin/env bash
# TOWER — 0039 zaproszenia: przyjęcie przy pierwszym logowaniu, wygasanie kont bez logowania po 7 dniach,
# ponowne zaproszenie (reaktywacja). Czysty Postgres + atrapa auth.users (id, email, created_at, last_sign_in_at).
# Użycie: PGADMIN=postgres://postgres@localhost:5433/postgres bash tests/db/invite.sh
set -e
cd "$(git rev-parse --show-toplevel)"
ADMIN=${PGADMIN:-postgres://postgres@localhost:5433/postgres}
DB=tower_test_invite; URL="${ADMIN%/*}/$DB"
psql "$ADMIN" -q -c "drop database if exists $DB" -c "create database $DB"
psql "$URL" -q -v ON_ERROR_STOP=1 -f tests/db/supabase_stub.sql
psql "$URL" -q -v ON_ERROR_STOP=1 -c "create table if not exists auth.users (id uuid primary key default gen_random_uuid(),
  email text, created_at timestamptz not null default now(), last_sign_in_at timestamptz)"
for f in supabase/migrations/*.sql; do psql "$URL" -q -v ON_ERROR_STOP=1 -f "$f" >/dev/null 2>&1 || { echo "MIGRACJA $f: błąd"; exit 1; }; done
psql "$URL" -q -v ON_ERROR_STOP=1 -f tests/db/seed.sql
set +e
PSQL="psql $URL -Atq"
HHL=11111111-0000-0000-0000-000000000001
N1=aaaaaaaa-1111-0000-0000-000000000001; OLD=aaaaaaaa-1111-0000-0000-000000000002
LOG=aaaaaaaa-1111-0000-0000-000000000003; FRESH=aaaaaaaa-1111-0000-0000-000000000004; EXP2=aaaaaaaa-1111-0000-0000-000000000005
ok=0; fail=0
Q() { $PSQL -c "$1" 2>&1 | tail -1; }
chk() { if [ "$2" = "$3" ]; then ok=$((ok+1)); echo "  OK    $1"; else fail=$((fail+1)); echo "  FAIL  $1  (otrzymano: $2, oczekiwano: $3)"; fi; }
as() { $PSQL -c "begin; set local role authenticated; set local request.jwt.claim.sub='$1'; $2; commit;" 2>&1 | grep -vE '^(BEGIN|SET|COMMIT)$' | tail -1; }
sees() { as "$1" "select (select count(*) from organizations)+(select count(*) from projects)+(select count(*) from loads)+(select count(*) from app_users)"; }
acc() { Q "select count(*) from audit_log where action='USER_ACCEPTED_INVITE' and entity_id='$1'"; }
inv() { as $HHL "select admin_invite_user('$1','KSH','CLIENT_USER') is not null"; }

echo; echo "[0039] Przyjęcie zaproszenia dopiero przy pierwszym logowaniu"
chk "HHL zaprasza nowy@firma.pl"                                   "$(inv nowy@firma.pl)" t
$PSQL -c "insert into auth.users (id, email) values ('$N1','nowy@firma.pl')" >/dev/null
chk "wysłanie linku tworzy konto (app_users, aktywne)"         "$(Q "select active from app_users where auth_id='$N1'")" t
chk "przed kliknięciem: brak USER_ACCEPTED_INVITE"             "$(acc $N1)" 0
chk "przed kliknięciem: zaproszenie nieprzyjęte"               "$(Q "select accepted_at is null from user_invites where email='nowy@firma.pl'")" t
$PSQL -c "update auth.users set last_sign_in_at = now() where id='$N1'" >/dev/null
chk "pierwsze logowanie → USER_ACCEPTED_INVITE (1)"            "$(acc $N1)" 1
chk "pierwsze logowanie → zaproszenie przyjęte"                "$(Q "select accepted_at is not null from user_invites where email='nowy@firma.pl'")" t
$PSQL -c "update auth.users set last_sign_in_at = now() + interval '1 hour' where id='$N1'" >/dev/null
chk "kolejne logowanie → bez drugiego wpisu"                   "$(acc $N1)" 1

echo; echo "[0039] Wygasanie kont bez logowania (7 dni)"
inv stary@firma.pl >/dev/null; inv zalog@firma.pl >/dev/null; inv swiezy@firma.pl >/dev/null
$PSQL -c "insert into auth.users (id, email) values ('$OLD','stary@firma.pl'), ('$LOG','zalog@firma.pl'), ('$FRESH','swiezy@firma.pl');
  update auth.users set last_sign_in_at = now() - interval '7 days 23 hours' where id='$LOG';
  update auth.users set created_at = now() - interval '8 days' where id in ('$OLD','$LOG');
  update auth.users set created_at = now() - interval '6 days 23 hours' where id='$FRESH';
  update user_invites set created_at = now() - interval '8 days' where email in ('stary@firma.pl','zalog@firma.pl');
  update user_invites set created_at = now() - interval '6 days 23 hours' where email='swiezy@firma.pl'" >/dev/null
chk "przed wygaśnięciem konto bez logowania widzi dane (>0)"   "$( [ "$(sees $OLD)" -gt 0 ] && echo t)" t
chk "anon nie wywoła expire_unaccepted_accounts"              "$($PSQL -c "begin; set local role anon; select expire_unaccepted_accounts(); rollback;" 2>&1 | grep -c 'permission denied')" 1
chk "zalogowany (HHL) nie wywoła expire_unaccepted_accounts"  "$(as $HHL "select expire_unaccepted_accounts()" | grep -c 'permission denied')" 1
before=$(sees $LOG)
chk "zadanie dzienne wygasza 1 konto"                          "$(Q "select expire_unaccepted_accounts()")" 1
chk "konto bez logowania > 7 dni → nieaktywne"                 "$(Q "select active from app_users where auth_id='$OLD'")" f
chk "nieaktywne konto widzi 0 wierszy"                         "$(sees $OLD)" 0
chk "konto zalogowane (8 dni) bez zmian: aktywne"              "$(Q "select active from app_users where auth_id='$LOG'")" t
chk "konto zalogowane widzi tyle samo co przed zadaniem"       "$(sees $LOG)" "$before"
chk "konto 6 dni 23 h bez logowania: aktywne"                  "$(Q "select active from app_users where auth_id='$FRESH'")" t
chk "wpis audytu USER_INVITE_EXPIRED (1)"                      "$(Q "select count(*) from audit_log where action='USER_INVITE_EXPIRED' and entity_id=(select id::text from app_users where auth_id='$OLD')")" 1
chk "ponowne uruchomienie: 0 (idempotentne)"                   "$(Q "select expire_unaccepted_accounts()")" 0

echo; echo "[0039] Ponowne zaproszenie"
chk "HHL zaprasza ponownie wygasłe konto"                      "$(inv stary@firma.pl)" t
chk "konto reaktywowane"                                       "$(Q "select active from app_users where auth_id='$OLD'")" t
chk "nowy termin zaproszenia (7 dni od teraz)"                 "$(Q "select created_at > now() - interval '1 minute' from user_invites where email='stary@firma.pl'")" t
chk "wpis USER_REINVITED (1)"                                  "$(Q "select count(*) from audit_log where action='USER_REINVITED'")" 1
chk "zadanie po ponownym zaproszeniu: 0 (konto zostaje aktywne)" "$(Q "select expire_unaccepted_accounts()")" 0
chk "reaktywowane konto widzi dane (>0)"                       "$( [ "$(sees $OLD)" -gt 0 ] && echo t)" t
$PSQL -c "update auth.users set last_sign_in_at = now() where id='$OLD'" >/dev/null
chk "logowanie po ponownym zaproszeniu → USER_ACCEPTED_INVITE" "$(acc $OLD)" 1
chk "zalogowanego nie da się zaprosić ponownie"                "$($PSQL -c "begin; set local role authenticated; set local request.jwt.claim.sub='$HHL'; select admin_invite_user('zalog@firma.pl','KSH','CLIENT_USER'); rollback;" 2>&1 | grep -c 'już istnieje')" 1

echo; echo "[0039] Wygasłe konto loguje się starym linkiem (bez ponownego zaproszenia)"
inv wygasly@firma.pl >/dev/null
$PSQL -c "insert into auth.users (id, email, created_at) values ('$EXP2','wygasly@firma.pl', now() - interval '9 days');
  update user_invites set created_at = now() - interval '9 days' where email='wygasly@firma.pl'; select expire_unaccepted_accounts();
  update auth.users set last_sign_in_at = now() where id='$EXP2'" >/dev/null
chk "bez przyjęcia zaproszenia"                                "$(acc $EXP2)" 0
chk "konto dalej nieaktywne, widzi 0 wierszy"                  "$(Q "select active from app_users where auth_id='$EXP2'"):$(sees $EXP2)" "f:0"

echo; echo "[PR2-B / 0045] Konta po odtworzeniu kopii do nowego projektu — łączenie po e-mailu"
REL=aaaaaaaa-1111-0000-0000-000000000009
ORPH=$(Q "select count(*) from app_users u where not exists (select 1 from auth.users a where a.id = u.auth_id)")
chk "restore_mark_relink(): lista = konta bez auth.users (seed: 3)" "$(Q "select restore_mark_relink()"):$ORPH" "3:3"
chk "zaproszenie ksh@test przyjęte (restore) — bez listy byłby TOWER_NO_INVITE" "$(Q "select count(*) from user_invites where email='ksh@test' and accepted_at is null")" 0
$PSQL -c "insert into auth.users (id, email) values ('$REL','KSH@test')" >/dev/null 2>&1
chk "nowe konto auth z adresem z listy → app_users.auth_id = nowe konto" "$(Q "select count(*) from app_users where email='ksh@test' and auth_id='$REL'")" 1
chk "rola i organizacja bez zmian"                               "$(Q "select role||':'||(org_id is not null) from app_users where auth_id='$REL'")" "CLIENT_ADMIN:true"
chk "audit USER_RELINKED_AFTER_RESTORE, adres zdjęty z listy"   "$(Q "select count(*) from audit_log where action='USER_RELINKED_AFTER_RESTORE' and new_value->>'new_auth_id'='$REL'"):$(Q "select count(*) from account_relink_pending where email='ksh@test'")" "1:0"
chk "połączone konto widzi dane (>0)"                            "$( [ "$(sees $REL)" -gt 0 ] && echo t)" t
chk "adres spoza listy i bez zaproszenia → TOWER_NO_INVITE"      "$($PSQL -c "insert into auth.users (email) values ('obcy@firma.pl')" 2>&1 | grep -c TOWER_NO_INVITE)" 1
$PSQL -c "insert into account_relink_pending (email, app_user_id, old_auth_id) select 'scx@test', id, '$REL' from app_users where email='scx@test' on conflict (email) do update set old_auth_id = excluded.old_auth_id" >/dev/null
chk "wiersz nieosierocony (stare auth_id istnieje) → bez przejęcia" "$($PSQL -c "insert into auth.users (email) values ('scx@test')" 2>&1 | grep -c TOWER_NO_INVITE):$(Q "select count(*) from app_users where email='scx@test' and auth_id='11111111-0000-0000-0000-000000000003'")" "1:1"
chk "ponowne restore_mark_relink() — idempotentne (ksh połączony)" "$(Q "select restore_mark_relink()"):$(Q "select count(*) from account_relink_pending where email='ksh@test'")" "2:0"
chk "anon/authenticated: brak dostępu do listy i funkcji"        "$(Q "select has_table_privilege('authenticated','account_relink_pending','select') or has_table_privilege('anon','account_relink_pending','select') or has_function_privilege('authenticated','restore_mark_relink()','execute')")" f

echo "WYNIK: $ok OK, $fail FAIL"
