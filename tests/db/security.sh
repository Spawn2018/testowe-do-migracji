#!/usr/bin/env bash
# TOWER — test bezpieczeństwa bazy. Podszywa się pod HHL, KSH i SCX
# i sprawdza, czego baza NIE pozwala zobaczyć ani zmienić.
# Użycie: PGURL=postgres://postgres@localhost:5433/tower bash tests/db/security.sh
PSQL="psql ${PGURL:-postgres://postgres@localhost:5433/tower} -Atq"
HHL=11111111-0000-0000-0000-000000000001; KSH=11111111-0000-0000-0000-000000000002; SCX=11111111-0000-0000-0000-000000000003
INVK=44444444-0000-0000-0000-00000000000c; INVP=44444444-0000-0000-0000-0000000000ee
L1=33333333-0000-0000-0000-000000000001; L2=33333333-0000-0000-0000-000000000002
ok=0; fail=0
run() { # uid, sql, commit?  → stdout, kod wyjścia
  local end="rollback"; [ "$3" = "commit" ] && end="commit"
  $PSQL -v ON_ERROR_STOP=1 -c "begin; set local role authenticated; set local request.jwt.claim.sub='$1'; $2; $end;" 2>&1
}
val()  { out=$(run "$2" "$3" "$5" | grep -v -E '^(BEGIN|SET|ROLLBACK|COMMIT)$' | tail -1)
         if [ "$out" = "$4" ]; then ok=$((ok+1)); echo "  OK    $1"; else fail=$((fail+1)); echo "  FAIL  $1  (otrzymano: $out, oczekiwano: $4)"; fi; }
err()  { out=$(run "$2" "$3"); if echo "$out" | grep -qiE "$4"; then ok=$((ok+1)); echo "  OK    $1"; else fail=$((fail+1)); echo "  FAIL  $1  →  $(echo "$out" | tail -1)"; fi; }
sys()  { $PSQL -v ON_ERROR_STOP=1 -c "$1" 2>&1; }

echo; echo "[1] Widoczność faktur"
val "HHL widzi obie faktury"                         $HHL "select count(*) from invoices" 2
val "KSH widzi tylko fakturę HHL (przychodową)"      $KSH "select string_agg(direction,',') from invoices" PRZYCHOD
val "SCX widzi tylko swoją fakturę (kosztową)"       $SCX "select string_agg(direction,',') from invoices" KOSZT
val "KSH nie widzi pozycji faktury kosztowej"        $KSH "select count(*) from invoice_lines where direction='KOSZT'" 0
val "SCX nie widzi pozycji faktury przychodowej"     $SCX "select count(*) from invoice_lines where direction='PRZYCHOD'" 0

echo; echo "[2] Rozdzielenie cen (z migracji 0001)"
err "KSH nie odczyta tabeli kosztów"                 $KSH "select * from load_cost" "permission denied"
err "SCX nie odczyta tabeli przychodów"              $SCX "select * from load_revenue" "permission denied"

echo; echo "[3] Kto może zmieniać co na fakturze"
err "KSH nie zmieni kwoty faktury HHL"               $KSH "update invoices set net_total=1 where id='$INVP'" "weryfikowa"
val "KSH może oznaczyć fakturę HHL jako sporną"      $KSH "with u as (update invoices set verification_status='SPORNA', dispute_note='test' where id='$INVP' returning 1) select count(*) from u" 1
val "KSH nie dosięgnie faktury kosztowej"            $KSH "with u as (update invoices set dispute_note='x' where id='$INVK' returning 1) select count(*) from u" 0
err "SCX nie zweryfikuje własnej faktury"            $SCX "update invoices set verification_status='ZAAKCEPTOWANA' where id='$INVK'" "Wystawca nie weryfikuje"

echo; echo "[4] Status Opłacona — wyłącznie HHL"
err "SCX nie zmieni statusu płatności bezpośrednio"  $SCX "update invoices set payment_status='OPLACONA' where id='$INVK'" "permission denied"
err "SCX nie wywoła oznaczenia płatności"            $SCX "select mark_invoice_paid('$INVK','2026-10-20')" "wyłącznie HHL"
err "KSH nie wywoła oznaczenia płatności"            $KSH "select mark_invoice_paid('$INVP','2026-10-20')" "wyłącznie HHL"
run $HHL "select mark_invoice_paid('$INVK','2026-10-20')" commit >/dev/null
val "HHL oznacza fakturę kosztową jako opłaconą"     $HHL "select payment_status||' '||paid_at from invoices where id='$INVK'" "OPLACONA 2026-10-20"
val "wpis w dzienniku audytu"                        $HHL "select count(*) from audit_log where action='INVOICE_MARK_PAID'" 1
err "cofnięcie bez powodu odrzucone"                 $HHL "select unmark_invoice_paid('$INVK','')" "powód"

echo; echo "[5] Termin płatności"
err "użytkownik nie wywoła odświeżania terminów"      $HHL "select refresh_payment_status('2099-01-01')" "permission denied"
out=$(sys "select refresh_payment_status('2026-10-29')"); [ "$(echo "$out"|tail -1)" = "1" ] && { ok=$((ok+1)); echo "  OK    zadanie systemowe: nieopłacona po terminie → PO_TERMINIE"; } || { fail=$((fail+1)); echo "  FAIL  odświeżenie: $out"; }
sys "update invoices set due_date='2026-11-15' where id='$INVP'" >/dev/null
out=$(sys "select refresh_payment_status('2026-10-29')"); [ "$(sys "select payment_status from invoices where id='$INVP'")" = "NIEOPLACONA" ] && { ok=$((ok+1)); echo "  OK    termin przesunięty z dokumentu → wraca do NIEOPLACONA"; } || { fail=$((fail+1)); echo "  FAIL  powrót statusu"; }
val "opłacona nie przechodzi na PO_TERMINIE"         $HHL "select payment_status from invoices where id='$INVK'" OPLACONA

echo; echo "[6] Numery zleceń obowiązkowe"
out=$(sys "update loads set status='READY' where id='$L2'"); echo "$out" | grep -q "numeru zlecenia HHL" && { ok=$((ok+1)); echo "  OK    status READY bez numeru HHL odrzucony"; } || { fail=$((fail+1)); echo "  FAIL  READY bez numeru HHL: $out"; }
sys "update loads set hhl_order_no='HHL/2026/0002', status='READY' where id='$L2'" >/dev/null
out=$(sys "update loads set status='AT_LOADING' where id='$L2'"); echo "$out" | grep -q "przewoźnika" && { ok=$((ok+1)); echo "  OK    załadunek bez numeru przewoźnika odrzucony"; } || { fail=$((fail+1)); echo "  FAIL  $out"; }
val "SCX wpisuje swój numer zlecenia"                $SCX "with u as (update loads set carrier_order_no='SCX-7781' where id='$L2' returning 1) select count(*) from u" 1 commit
val "KSH nie wpisze numeru przewoźnika"              $KSH "with u as (update loads set carrier_order_no='X' where id='$L2' returning 1) select count(*) from u" 0
out=$(sys "update loads set hhl_order_no='HHL/2026/0002' where id='$L1'"); echo "$out" | grep -qi "duplicate\|unique" && { ok=$((ok+1)); echo "  OK    numer zlecenia HHL unikalny w projekcie"; } || { fail=$((fail+1)); echo "  FAIL  duplikat numeru: $out"; }

echo; echo "[7] Podwójne fakturowanie"
out=$(sys "insert into invoice_lines (invoice_id, load_id, direction) values ('$INVP','$L1','KOSZT')"); echo "$out" | grep -qi "duplicate\|unique" && { ok=$((ok+1)); echo "  OK    ten sam transport dwa razy po stronie kosztu — zablokowane"; } || { fail=$((fail+1)); echo "  FAIL  $out"; }

echo; echo "[8] Waluty"
val "KSH ustawia sobie wyświetlanie w PLN"           $KSH "with i as (insert into user_preferences (user_id, display_currency) select id,'PLN' from app_users where auth_id='$KSH' returning 1) select count(*) from i" 1 commit
run $HHL "insert into user_preferences (user_id) select id from app_users where auth_id='$HHL'" commit >/dev/null
val "KSH widzi wyłącznie własne ustawienia"          $KSH "select count(*) from user_preferences" 1
err "waluta wyświetlania SEK odrzucona"              $KSH "update user_preferences set display_currency='SEK'" "check constraint"
out=$(sys "update invoices set currency='SEK' where id='$INVP'"); echo "$out" | grep -qi "check constraint" && { ok=$((ok+1)); echo "  OK    faktura w SEK odrzucona"; } || { fail=$((fail+1)); echo "  FAIL  $out"; }
val "faktura w PLN dopuszczona"                      $HHL "select currency from invoices where id='$INVK'" PLN

echo; echo "[9] Spór i weryfikacja — decyzje Q7 i Q14"
err "spór bez uzasadnienia odrzucony"                $KSH "update invoices set verification_status='SPORNA', dispute_note=null where id='$INVP'" "uzasadnienia"
err "HHL nie zmieni statusu weryfikacji własnej faktury dla KSH" $HHL "update invoices set verification_status='ZAAKCEPTOWANA' where id='$INVP'" "Wystawca nie weryfikuje"
val "HHL weryfikuje fakturę kosztową od SCX"         $HHL "with u as (update invoices set verification_status='ZGODNA' where id='$INVK' returning 1) select count(*) from u" 1

echo; echo "[10] Warunki płatności — 30 dni KSH, 35 dni SCX, widoczne tylko stronom"
val "HHL widzi obie relacje"                         $HHL "select string_agg(term_days::text,',' order by term_days) from payment_terms" "30,35"
val "KSH widzi tylko swoją relację (30 dni)"         $KSH "select string_agg(term_days::text,',') from payment_terms" 30
val "SCX widzi tylko swoją relację (35 dni)"         $SCX "select string_agg(term_days::text,',') from payment_terms" 35
val "KSH nie zmieni warunków płatności"              $KSH "with u as (update payment_terms set term_days=90 returning 1) select count(*) from u" 0

echo; echo "[11] Kto zmienia co w transporcie — ślepa plamka testów do 24.09"
err "SCX nie zmieni numeru zlecenia HHL"              $SCX "update loads set hhl_order_no='PODROBIONY' where id='$L2'" "nie może zmieniać: hhl_order_no"
err "SCX nie zmieni numeru zlecenia KSH"              $SCX "update loads set order_no='PODROBIONY' where id='$L2'" "nie może zmieniać: order_no"
err "SCX nie przepnie transportu do innego projektu"  $SCX "update loads set project_id=gen_random_uuid() where id='$L2'" "nie może zmieniać"
err "SCX nie zmieni planowanego okna dostawy"         $SCX "update loads set plan_delivery_from='2026-10-20 08:00+00' where id='$L2'" "nie może zmieniać: plan_delivery_from"
err "SCX nie zmieni planowanego okna załadunku"       $SCX "update loads set plan_load_to='2026-10-20 08:00+00' where id='$L2'" "nie może zmieniać: plan_load_to"
val "SCX zmienia dane kierowcy we własnym transporcie" $SCX "with u as (update loads set driver_name='Jonas Lindqvist' where id='$L2' returning 1) select count(*) from u" 1
err "SCX nie anuluje transportu"                       $SCX "update loads set status='CANCELLED' where id='$L2'" "wyłącznie HHL"
err "HHL nie zmieni numeru zlecenia przewoźnika"       $HHL "update loads set carrier_order_no='ZMIENIONY' where id='$L2'" "wyłącznie przewoźnik"
val "HHL zmienia swój numer zlecenia"                  $HHL "with u as (update loads set hhl_order_no='HHL/2026/0777' where id='$L2' returning 1) select count(*) from u" 1
err "rozładunek bez daty rozładunku odrzucony"        $HHL "update loads set status='UNLOADED' where id='$L1'" "wymaga daty rozładunku"
err "SCX nie zmieni daty rozładunku transportu na fakturze" $SCX "update loads set actual_delivery_at='2026-09-20 10:00+00' where id='$L1'" "zamrożona"
val "HHL zmienia datę rozładunku zafakturowanego — z audytem" $HHL "with u as (update loads set actual_delivery_at='2026-09-24 10:00+00' where id='$L1' returning 1) select count(*) from u" 1 commit
val "zmiana daty rozładunku zapisana w dzienniku"      $HHL "select count(*) from audit_log where action='LOAD_DELIVERY_DATE_CHANGE'" 1

echo; echo "WYNIK: $ok OK, $fail FAIL"
[ "$fail" -eq 0 ]
